import { and, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import type { Context } from "hono";
import type { Db } from "./db";
import {
	auditLog,
	capacityBadgeShares,
	capacitySkills,
	capacityUserSkills,
	certificates,
	departments,
	directoryProfiles,
	directorySettings,
	trainingRecords,
	userProfiles,
} from "./db/schema";
import { loadRouting } from "./capacity";
import { memberPhotoUrl } from "./media";
import { jsonError, requireOrg, requireRole, requireUser, type AppEnv } from "./middleware";
import { requireModule } from "./modules";
import { cleanText, readJson } from "./validate";
import { notifyPeople } from "./notifications";

// Each skill stands on its own. There's no overall score and no ranking anywhere,
// and finishing a workshop never raises a level: only an assessor does.

export const capacitySkillRoutes = new Hono<AppEnv>();
const gate = [requireUser, requireOrg, requireModule("capacity_building")] as const;
const directoryGate = [requireUser, requireOrg, requireModule("people_directory")] as const;
const LEVELS = [1, 2, 3, 4, 5];
const COMPETENCY_LEVEL = 3;
const MAX_ADDED_SKILLS = 30;
const CATEGORIES = ["leadership", "project_management", "meal", "finance", "digital", "safeguarding", "safety", "community", "health", "communication", "other"];

// A starting point that organizations edit. Rubrics are theirs to write.
const STARTER_SKILLS: [string, string][] = [
	["Survey design", "meal"],
	["Kobo / ODK data collection", "meal"],
	["Data analysis", "meal"],
	["Safeguarding case referral", "safeguarding"],
	["Survivor-centred approach", "safeguarding"],
	["Community mobilisation", "community"],
	["Facilitation", "communication"],
	["Report writing", "communication"],
	["Budget monitoring", "finance"],
	["Project management", "project_management"],
	["Donor reporting", "project_management"],
];

function audit(c: Context<AppEnv>, action: string, targetId: string, metadata: Record<string, unknown> = {}) {
	return c.get("db").insert(auditLog).values({
		organizationId: c.get("org").organizationId,
		actorUserId: c.get("user").id,
		action: `capacity.${action}`,
		targetType: "skill",
		targetId,
		metadata: JSON.stringify(metadata),
	});
}

function readSkill(body: Record<string, unknown>) {
	const name = cleanText(body.name);
	const description = cleanText(body.description, { multiline: true });
	const category = CATEGORIES.includes(String(body.category)) ? String(body.category) : "other";
	const revalidateMonths = [12, 24].includes(Number(body.revalidateMonths)) ? Number(body.revalidateMonths) : null;
	const raw = Array.isArray(body.rubric) ? body.rubric : [];
	const rubric = LEVELS.map((_, index) => cleanText(raw[index], { multiline: true }).slice(0, 500));
	if (name.length < 1 || name.length > 120 || description.length > 1000) return null;
	return { name, description: description || null, category, revalidateMonths, rubric: JSON.stringify(rubric) };
}

capacitySkillRoutes.get("/capacity/skills", ...gate, async (c) => {
	const db = c.get("db");
	const organizationId = c.get("org").organizationId;
	const [skills, routing] = await Promise.all([
		db.select().from(capacitySkills).where(eq(capacitySkills.organizationId, organizationId)).orderBy(capacitySkills.name),
		loadRouting(db, organizationId),
	]);
	return c.json({
		skills: skills.map(({ createdBy, ...skill }) => ({
			...skill,
			addedBy: createdBy ? (routing.byId.get(createdBy)?.name ?? null) : null,
			rubric: JSON.parse(skill.rubric) as string[],
		})),
	});
});

capacitySkillRoutes.post("/capacity/skills", ...gate, requireRole("admin"), async (c) => {
	const values = readSkill(await readJson(c.req.raw));
	if (!values) return jsonError(c, 400, "INVALID_SKILL", "Give the skill a name.");
	const [created] = await c.get("db").insert(capacitySkills).values({ ...values, organizationId: c.get("org").organizationId }).returning({ id: capacitySkills.id });
	await audit(c, "skill_added", String(created.id), { name: values.name });
	return c.json(created, 201);
});

capacitySkillRoutes.post("/capacity/skills/starter", ...gate, requireRole("admin"), async (c) => {
	const db = c.get("db");
	const organizationId = c.get("org").organizationId;
	const existing = await db.select({ name: capacitySkills.name }).from(capacitySkills).where(eq(capacitySkills.organizationId, organizationId));
	const names = new Set(existing.map((skill) => skill.name.toLowerCase()));
	const rows = STARTER_SKILLS.filter(([name]) => !names.has(name.toLowerCase())).map(([name, category]) => ({ organizationId, name, category, rubric: JSON.stringify(["", "", "", "", ""]) }));
	if (rows.length) await db.insert(capacitySkills).values(rows);
	return c.json({ added: rows.length });
});

// A changed rubric is a new version. Past assessments keep the one they used.
capacitySkillRoutes.put("/capacity/skills/:id", ...gate, requireRole("admin"), async (c) => {
	const db = c.get("db");
	const organizationId = c.get("org").organizationId;
	const [skill] = await db.select().from(capacitySkills).where(and(eq(capacitySkills.id, Number(c.req.param("id"))), eq(capacitySkills.organizationId, organizationId)));
	if (!skill) return jsonError(c, 404, "NOT_FOUND", "That skill doesn't exist.");
	const body = await readJson(c.req.raw);
	const values = readSkill(body);
	if (!values) return jsonError(c, 400, "INVALID_SKILL", "Give the skill a name.");
	const rubricVersion = values.rubric === skill.rubric ? skill.rubricVersion : skill.rubricVersion + 1;
	await db.update(capacitySkills).set({ ...values, rubricVersion, retired: body.retired === true }).where(eq(capacitySkills.id, skill.id));
	await audit(c, "skill_changed", String(skill.id), { name: values.name, rubricVersion });
	return c.json({ ok: true, rubricVersion });
});

function trainingBadges(records: (typeof trainingRecords.$inferSelect)[]) {
	return records
		.filter((record) => record.trainingStatus === "completed" && record.reviewStatus !== "draft" && record.reviewStatus !== "rejected")
		.map((record) => {
			const verified = record.reviewStatus === "verified";
			return {
				key: `training:${record.id}`,
				kind: verified ? "training" : "attendance",
				title: record.title,
				date: record.decidedAt ?? record.submittedAt,
				verified,
				sensitive: record.isSensitive,
				shareable: verified && !record.isSensitive,
			};
		});
}

async function loadBadges(db: Db, organizationId: number, userId: string) {
	const [records, certs, skills] = await Promise.all([
		db.select().from(trainingRecords).where(and(eq(trainingRecords.organizationId, organizationId), eq(trainingRecords.userId, userId))),
		db.select().from(certificates).where(and(eq(certificates.organizationId, organizationId), eq(certificates.userId, userId))),
		db
			.select({ id: capacityUserSkills.id, level: capacityUserSkills.level, assessedAt: capacityUserSkills.assessedAt, name: capacitySkills.name })
			.from(capacityUserSkills)
			.innerJoin(capacitySkills, eq(capacityUserSkills.skillId, capacitySkills.id))
			.where(and(eq(capacityUserSkills.organizationId, organizationId), eq(capacityUserSkills.userId, userId))),
	]);
	return [
		...trainingBadges(records),
		...certs.map((cert) => ({ key: `course:${cert.id}`, kind: "course", title: cert.courseTitle, date: cert.issuedAt, verified: true, sensitive: false, shareable: true })),
		...skills
			.filter((skill) => skill.level !== null && skill.level >= COMPETENCY_LEVEL)
			.map((skill) => ({ key: `competency:${skill.id}`, kind: "competency", title: skill.name, level: skill.level, date: skill.assessedAt, verified: true, sensitive: false, shareable: true })),
	];
}

function expiry(assessedAt: Date | null, months: number | null) {
	if (!assessedAt || !months) return null;
	const date = new Date(assessedAt);
	date.setMonth(date.getMonth() + months);
	return date.toISOString().slice(0, 10);
}

capacitySkillRoutes.get("/capacity/my-skills", ...gate, async (c) => {
	const db = c.get("db");
	const organizationId = c.get("org").organizationId;
	const userId = c.get("user").id;
	const [rows, shares, badges, routing] = await Promise.all([
		db
			.select({ row: capacityUserSkills, skill: capacitySkills })
			.from(capacityUserSkills)
			.innerJoin(capacitySkills, eq(capacityUserSkills.skillId, capacitySkills.id))
			.where(and(eq(capacityUserSkills.organizationId, organizationId), eq(capacityUserSkills.userId, userId))),
		db.select({ badgeKey: capacityBadgeShares.badgeKey }).from(capacityBadgeShares).where(and(eq(capacityBadgeShares.organizationId, organizationId), eq(capacityBadgeShares.userId, userId))),
		loadBadges(db, organizationId, userId),
		loadRouting(db, organizationId),
	]);
	const shared = new Set(shares.map((share) => share.badgeKey));
	const others = new Set(
		(await db.select({ skillId: capacityUserSkills.skillId, userId: capacityUserSkills.userId }).from(capacityUserSkills).where(eq(capacityUserSkills.organizationId, organizationId)))
			.filter((row) => row.userId !== userId)
			.map((row) => row.skillId),
	);
	const name = (id: string | null) => (id ? (routing.byId.get(id)?.name ?? null) : null);
	return c.json({
		skills: rows.map(({ row, skill }) => ({
			id: row.id,
			skillId: skill.id,
			name: skill.name,
			category: skill.category,
			rubric: JSON.parse(skill.rubric) as string[],
			level: row.level,
			pendingLevel: row.pendingLevel,
			evidence: row.evidence,
			feedback: row.feedback,
			nominatedAt: row.nominatedAt,
			assessedAt: row.assessedAt,
			assessorName: name(row.assessedBy),
			revalidateBy: expiry(row.assessedAt, skill.revalidateMonths),
			shared: row.shared,
			// Only a skill they added, nobody else uses, and nobody has assessed yet.
			canRename: skill.createdBy === userId && row.level === null && !others.has(skill.id),
		})),
		badges: badges.map((badge) => ({ ...badge, shared: badge.shareable && shared.has(badge.key) })),
	});
});

// Picks a skill from the list, or adds a new one. A name already on the list is
// reused, so the catalog doesn't fill up with the same skill spelled twice.
async function skillToNominate(db: Db, organizationId: number, userId: string, body: Record<string, unknown>) {
	const name = cleanText(body.newSkillName);
	if (!name) {
		const [skill] = await db.select().from(capacitySkills).where(and(eq(capacitySkills.id, Number(body.skillId)), eq(capacitySkills.organizationId, organizationId), eq(capacitySkills.retired, false)));
		return skill ?? null;
	}
	if (name.length > 120) return null;
	const existing = await db.select().from(capacitySkills).where(eq(capacitySkills.organizationId, organizationId));
	const same = existing.find((skill) => skill.name.toLowerCase() === name.toLowerCase());
	if (same) {
		if (!same.retired) return same;
		const [revived] = await db.update(capacitySkills).set({ retired: false }).where(eq(capacitySkills.id, same.id)).returning();
		return revived;
	}
	if (existing.filter((skill) => skill.createdBy === userId).length >= MAX_ADDED_SKILLS) return "TOO_MANY" as const;
	const category = CATEGORIES.includes(String(body.newSkillCategory)) ? String(body.newSkillCategory) : "other";
	const [created] = await db.insert(capacitySkills).values({ organizationId, name, category, createdBy: userId, rubric: JSON.stringify(["", "", "", "", ""]) }).returning();
	return created;
}

capacitySkillRoutes.post("/capacity/my-skills", ...gate, async (c) => {
	const db = c.get("db");
	const organizationId = c.get("org").organizationId;
	const userId = c.get("user").id;
	const body = await readJson(c.req.raw);
	const level = Number(body.level);
	const evidence = cleanText(body.evidence, { multiline: true });
	if (!LEVELS.includes(level)) return jsonError(c, 400, "INVALID_LEVEL", "Choose a level.");
	if (evidence.length < 1 || evidence.length > 2000) return jsonError(c, 400, "EVIDENCE_REQUIRED", "Say what shows this.");
	const skill = await skillToNominate(db, organizationId, userId, body);
	if (skill === "TOO_MANY") return jsonError(c, 429, "TOO_MANY_SKILLS", "You've added a lot of new skills. Ask an admin to tidy the list.");
	if (!skill) return jsonError(c, 400, "INVALID_SKILL", "Choose a skill from the list.");
	const pending = { pendingLevel: level, evidence, nominatedAt: new Date(), feedback: null };
	await db
		.insert(capacityUserSkills)
		.values({ ...pending, organizationId, userId, skillId: skill.id })
		.onConflictDoUpdate({ target: [capacityUserSkills.userId, capacityUserSkills.skillId], set: pending });
	const routing = await loadRouting(db, organizationId);
	await notifyPeople(c, routing.reviewersFor(userId).map((person) => person.userId), "skill_nominated", { person: routing.byId.get(userId)?.name ?? "", skill: skill.name }, "/capacity/skills");
	return c.json({ ok: true }, 201);
});

// Editing a verified skill asks for a new assessment, and the verified level stays until then.
capacitySkillRoutes.patch("/capacity/my-skills/:id", ...gate, async (c) => {
	const db = c.get("db");
	const organizationId = c.get("org").organizationId;
	const userId = c.get("user").id;
	const [found] = await db
		.select({ row: capacityUserSkills, skill: capacitySkills })
		.from(capacityUserSkills)
		.innerJoin(capacitySkills, eq(capacityUserSkills.skillId, capacitySkills.id))
		.where(and(eq(capacityUserSkills.id, Number(c.req.param("id"))), eq(capacityUserSkills.userId, userId), eq(capacityUserSkills.organizationId, organizationId)));
	if (!found) return jsonError(c, 404, "NOT_FOUND", "That skill doesn't exist.");
	const body = await readJson(c.req.raw);
	const level = Number(body.level);
	const evidence = cleanText(body.evidence, { multiline: true });
	if (!LEVELS.includes(level)) return jsonError(c, 400, "INVALID_LEVEL", "Choose a level.");
	if (evidence.length < 1 || evidence.length > 2000) return jsonError(c, 400, "EVIDENCE_REQUIRED", "Say what shows this.");
	const name = cleanText(body.name);
	if (name && name !== found.skill.name) {
		const everyone = await db.select({ userId: capacityUserSkills.userId }).from(capacityUserSkills).where(eq(capacityUserSkills.skillId, found.skill.id));
		const mineAlone = found.skill.createdBy === userId && found.row.level === null && everyone.every((row) => row.userId === userId);
		if (!mineAlone) return jsonError(c, 409, "CANT_RENAME", "This skill can't be renamed now.");
		if (name.length > 120) return jsonError(c, 400, "INVALID_SKILL", "That name is too long.");
		const taken = await db.select({ name: capacitySkills.name }).from(capacitySkills).where(eq(capacitySkills.organizationId, organizationId));
		if (taken.some((skill) => skill.name.toLowerCase() === name.toLowerCase() && skill.name !== found.skill.name)) {
			return jsonError(c, 409, "SKILL_EXISTS", "That skill is already on the list.");
		}
		await db.update(capacitySkills).set({ name }).where(eq(capacitySkills.id, found.skill.id));
	}
	await db.update(capacityUserSkills).set({ pendingLevel: level, evidence, nominatedAt: new Date(), feedback: null }).where(eq(capacityUserSkills.id, found.row.id));
	return c.json({ ok: true });
});

capacitySkillRoutes.delete("/capacity/my-skills/:id", ...gate, async (c) => {
	const db = c.get("db");
	const organizationId = c.get("org").organizationId;
	const userId = c.get("user").id;
	const [found] = await db
		.select({ row: capacityUserSkills, skill: capacitySkills })
		.from(capacityUserSkills)
		.innerJoin(capacitySkills, eq(capacityUserSkills.skillId, capacitySkills.id))
		.where(and(eq(capacityUserSkills.id, Number(c.req.param("id"))), eq(capacityUserSkills.userId, userId), eq(capacityUserSkills.organizationId, organizationId)));
	if (!found) return jsonError(c, 404, "NOT_FOUND", "That skill doesn't exist.");
	await db.delete(capacityUserSkills).where(eq(capacityUserSkills.id, found.row.id));
	await db.delete(capacityBadgeShares).where(and(eq(capacityBadgeShares.organizationId, organizationId), eq(capacityBadgeShares.userId, userId), eq(capacityBadgeShares.badgeKey, `competency:${found.row.id}`)));
	// A skill they added and nobody else uses goes too, so typos don't stay on the list.
	if (found.skill.createdBy === userId) {
		const others = await db.select({ id: capacityUserSkills.id }).from(capacityUserSkills).where(eq(capacityUserSkills.skillId, found.skill.id)).limit(1);
		if (others.length === 0) await db.delete(capacitySkills).where(eq(capacitySkills.id, found.skill.id));
	}
	if (found.row.level !== null) await audit(c, "skill_removed", String(found.row.id), { name: found.skill.name });
	return c.json({ ok: true });
});

capacitySkillRoutes.put("/capacity/my-skills/:id/share", ...gate, async (c) => {
	const db = c.get("db");
	const [row] = await db
		.select()
		.from(capacityUserSkills)
		.where(and(eq(capacityUserSkills.id, Number(c.req.param("id"))), eq(capacityUserSkills.userId, c.get("user").id), eq(capacityUserSkills.organizationId, c.get("org").organizationId)));
	if (!row) return jsonError(c, 404, "NOT_FOUND", "That skill doesn't exist.");
	const shared = (await readJson(c.req.raw)).shared === true;
	if (shared && row.level === null) return jsonError(c, 409, "NOT_VERIFIED", "Only verified skills can be shown.");
	await db.update(capacityUserSkills).set({ shared }).where(eq(capacityUserSkills.id, row.id));
	return c.json({ ok: true });
});

capacitySkillRoutes.put("/capacity/my-badges/share", ...gate, async (c) => {
	const db = c.get("db");
	const organizationId = c.get("org").organizationId;
	const userId = c.get("user").id;
	const body = await readJson(c.req.raw);
	const badge = (await loadBadges(db, organizationId, userId)).find((item) => item.key === body.key);
	if (!badge) return jsonError(c, 404, "NOT_FOUND", "That badge doesn't exist.");
	if (body.shared === true && !badge.shareable) return jsonError(c, 409, "NOT_SHAREABLE", "This badge can't be shared.");
	await db.delete(capacityBadgeShares).where(and(eq(capacityBadgeShares.organizationId, organizationId), eq(capacityBadgeShares.userId, userId), eq(capacityBadgeShares.badgeKey, badge.key)));
	if (body.shared === true) await db.insert(capacityBadgeShares).values({ organizationId, userId, badgeKey: badge.key });
	return c.json({ ok: true });
});

// The same people who review someone's training assess their skills.
capacitySkillRoutes.get("/capacity/assessments", ...gate, requireRole("manager", "admin"), async (c) => {
	const db = c.get("db");
	const organizationId = c.get("org").organizationId;
	const userId = c.get("user").id;
	const [rows, routing] = await Promise.all([
		db
			.select({ row: capacityUserSkills, skill: capacitySkills })
			.from(capacityUserSkills)
			.innerJoin(capacitySkills, eq(capacityUserSkills.skillId, capacitySkills.id))
			.where(eq(capacityUserSkills.organizationId, organizationId)),
		loadRouting(db, organizationId),
	]);
	return c.json({
		assessments: rows
			.filter(({ row }) => row.pendingLevel !== null && routing.reviewersFor(row.userId).some((person) => person.userId === userId))
			.map(({ row, skill }) => ({
				id: row.id,
				ownerName: routing.byId.get(row.userId)?.name ?? "",
				skillName: skill.name,
				rubric: JSON.parse(skill.rubric) as string[],
				rubricVersion: skill.rubricVersion,
				pendingLevel: row.pendingLevel,
				currentLevel: row.level,
				evidence: row.evidence,
				nominatedAt: row.nominatedAt,
			})),
	});
});

capacitySkillRoutes.post("/capacity/assessments/:id", ...gate, async (c) => {
	const db = c.get("db");
	const organizationId = c.get("org").organizationId;
	const [found] = await db
		.select({ row: capacityUserSkills, skill: capacitySkills })
		.from(capacityUserSkills)
		.innerJoin(capacitySkills, eq(capacityUserSkills.skillId, capacitySkills.id))
		.where(and(eq(capacityUserSkills.id, Number(c.req.param("id"))), eq(capacityUserSkills.organizationId, organizationId)));
	const routing = await loadRouting(db, organizationId);
	if (!found || !routing.reviewersFor(found.row.userId).some((person) => person.userId === c.get("user").id)) {
		return jsonError(c, 404, "NOT_FOUND", "That assessment doesn't exist.");
	}
	if (found.row.pendingLevel === null) return jsonError(c, 409, "ALREADY_DECIDED", "This has already been assessed.");
	const body = await readJson(c.req.raw);
	const feedback = cleanText(body.feedback, { multiline: true }).slice(0, 2000);
	const privateNote = cleanText(body.privateNote, { multiline: true }).slice(0, 2000);
	if (body.decline === true) {
		if (!feedback) return jsonError(c, 400, "FEEDBACK_REQUIRED", "Say why.");
		await db.update(capacityUserSkills).set({ pendingLevel: null, feedback, privateNote: privateNote || null }).where(eq(capacityUserSkills.id, found.row.id));
		await audit(c, "skill_declined", String(found.row.id));
		await notifyPeople(c, [found.row.userId], "skill_declined", { skill: found.skill.name }, "/capacity/skills");
		return c.json({ ok: true });
	}
	const level = Number(body.level);
	if (!LEVELS.includes(level)) return jsonError(c, 400, "INVALID_LEVEL", "Choose a level.");
	await db
		.update(capacityUserSkills)
		.set({ level, pendingLevel: null, feedback: feedback || null, privateNote: privateNote || null, assessedBy: c.get("user").id, assessedAt: new Date(), rubricVersion: found.skill.rubricVersion })
		.where(eq(capacityUserSkills.id, found.row.id));
	await audit(c, "skill_assessed", String(found.row.id));
	await notifyPeople(c, [found.row.userId], "skill_assessed", { skill: found.skill.name, level }, "/capacity/skills");
	return c.json({ ok: true });
});

const SMALL_GROUP = 3;

// Summaries hide any group small enough to point at one person. Sensitive records
// count only in totals, and never by category.
capacitySkillRoutes.get("/capacity/team-overview", ...gate, requireRole("manager", "admin"), async (c) => {
	const db = c.get("db");
	const organizationId = c.get("org").organizationId;
	const userId = c.get("user").id;
	const [records, routing, teams] = await Promise.all([
		db.select().from(trainingRecords).where(eq(trainingRecords.organizationId, organizationId)).orderBy(desc(trainingRecords.updatedAt)),
		loadRouting(db, organizationId),
		db.select({ id: departments.id, name: departments.name }).from(departments).where(eq(departments.organizationId, organizationId)),
	]);
	const people = routing.people.filter((person) => person.isActive && routing.reviewersFor(person.userId).some((reviewer) => reviewer.userId === userId));
	const ids = new Set(people.map((person) => person.userId));
	const mine = records.filter((record) => ids.has(record.userId) && record.reviewStatus !== "draft");
	const completed = mine.filter((record) => record.trainingStatus === "completed");
	const verified = completed.filter((record) => record.reviewStatus === "verified");
	const waiting = mine.filter((record) => record.reviewStatus === "submitted" || record.reviewStatus === "under_review");
	const categories = new Map<string, { people: Set<string>; verified: number; reported: number }>();
	for (const record of completed) {
		if (record.isSensitive || !record.category) continue;
		const group = categories.get(record.category) ?? { people: new Set<string>(), verified: 0, reported: 0 };
		group.people.add(record.userId);
		group.reported += 1;
		if (record.reviewStatus === "verified") group.verified += 1;
		categories.set(record.category, group);
	}
	const add = (unit: string) => verified.filter((record) => record.durationUnit === unit).reduce((total, record) => total + (record.durationValue ?? 0), 0);
	const today = new Date().toISOString().slice(0, 10);
	const upcoming = mine.filter((record) => record.startDate && record.startDate >= today && record.trainingStatus !== "cancelled").sort((a, b) => (a.startDate ?? "").localeCompare(b.startDate ?? ""));
	const latest = new Map<string, (typeof trainingRecords.$inferSelect)>();
	for (const record of mine) if (!latest.has(record.userId)) latest.set(record.userId, record);
	const teamNames = new Map(teams.map((team) => [team.id, team.name]));
	return c.json({
		staff: people.length,
		departments: [...new Set(people.map((person) => (person.departmentId ? teamNames.get(person.departmentId) : null)).filter(Boolean))],
		planned: mine.filter((record) => record.trainingStatus === "applied").length,
		inProgress: mine.filter((record) => record.trainingStatus === "started" || record.trainingStatus === "in_progress").length,
		completedReported: completed.length,
		completedVerified: verified.length,
		waiting: waiting.length,
		trainingDays: add("training_days"),
		contactHours: add("contact_hours"),
		categories: [...categories.entries()].map(([key, group]) =>
			group.people.size < SMALL_GROUP ? { key, hidden: true } : { key, hidden: false, verified: group.verified, reported: group.reported },
		),
		upcoming: upcoming.slice(0, 5).map((record) => ({
			id: record.id,
			restricted: record.isSensitive,
			title: record.isSensitive ? null : record.title,
			person: record.isSensitive ? null : (routing.byId.get(record.userId)?.name ?? ""),
			startDate: record.isSensitive ? null : record.startDate,
		})),
		// Sensitive details open only from the review queue, where opening is audited.
		latest: [...latest.values()].map((record) => ({
			id: record.id,
			person: routing.byId.get(record.userId)?.name ?? "",
			title: record.isSensitive ? null : record.title,
			category: record.isSensitive ? null : record.category,
			restricted: record.isSensitive,
			trainingStatus: record.trainingStatus,
			reviewStatus: record.reviewStatus,
		})),
	});
});

capacitySkillRoutes.post("/capacity/team-overview/exported", ...gate, requireRole("manager", "admin"), async (c) => {
	const body = await readJson(c.req.raw);
	await audit(c, "report_exported", "team-overview", { scope: "team_overview", count: Number(body.count) || 0 });
	return c.json({ ok: true });
});

// ---- Directory: only people who opted in, and only what each chose to share.

async function loadRules(db: Db, organizationId: number) {
	const [rules] = await db.select().from(directorySettings).where(eq(directorySettings.organizationId, organizationId));
	return { showTeams: rules?.showTeams ?? false, allowPhotos: rules?.allowPhotos ?? false, allowDisplayNames: rules?.allowDisplayNames ?? true };
}

function publicCard(
	person: { userId: string; name: string; departmentId: number | null; position: string | null; photoKey: string | null },
	profile: typeof directoryProfiles.$inferSelect,
	rules: Awaited<ReturnType<typeof loadRules>>,
	teamNames: Map<number, string>,
	skills: { name: string; category: string | null; level: number }[],
	badges: { kind: string; title: string }[],
) {
	const approvedName = profile.displayNameApproved ? profile.displayName : null;
	return {
		key: profile.id,
		name: approvedName ?? person.name,
		isDisplayName: !!approvedName,
		// With an approved display name, nothing here may lead back to the real person.
		picture: approvedName && profile.picture === "photo" ? "pattern" : rules.allowPhotos || profile.picture !== "photo" ? profile.picture : "initials",
		photoUrl: !approvedName && rules.allowPhotos && profile.picture === "photo" ? memberPhotoUrl(person.userId, person.photoKey) : null,
		position: profile.showTitle ? person.position : null,
		team: rules.showTeams && profile.showTeam && person.departmentId ? (teamNames.get(person.departmentId) ?? null) : null,
		bio: profile.bio,
		skills,
		badges,
	};
}

async function loadDirectory(db: Db, organizationId: number, onlyUser?: string) {
	const [rules, profiles, people, teams, skills, shares] = await Promise.all([
		loadRules(db, organizationId),
		db.select().from(directoryProfiles).where(eq(directoryProfiles.organizationId, organizationId)),
		db
			.select({ userId: userProfiles.userId, position: userProfiles.position, departmentId: userProfiles.departmentId, isActive: userProfiles.isActive, photoKey: userProfiles.photoKey })
			.from(userProfiles)
			.where(eq(userProfiles.organizationId, organizationId)),
		db.select({ id: departments.id, name: departments.name }).from(departments).where(eq(departments.organizationId, organizationId)),
		db
			.select({ userId: capacityUserSkills.userId, name: capacitySkills.name, category: capacitySkills.category, level: capacityUserSkills.level, shared: capacityUserSkills.shared })
			.from(capacityUserSkills)
			.innerJoin(capacitySkills, eq(capacityUserSkills.skillId, capacitySkills.id))
			.where(eq(capacityUserSkills.organizationId, organizationId)),
		db.select().from(capacityBadgeShares).where(eq(capacityBadgeShares.organizationId, organizationId)),
	]);
	return { rules, profiles, people, teamNames: new Map(teams.map((team) => [team.id, team.name])), skills, shares, onlyUser };
}

capacitySkillRoutes.get("/directory", ...directoryGate, async (c) => {
	const db = c.get("db");
	const organizationId = c.get("org").organizationId;
	const data = await loadDirectory(db, organizationId);
	const routing = await loadRouting(db, organizationId);
	const active = data.people.filter((person) => person.isActive);
	// Someone who asked for a display name is never shown under their real name instead:
	// they stay out while it waits, and if display names get turned off.
	const hidesName = (profile: typeof directoryProfiles.$inferSelect) => !!profile.displayName && (!profile.displayNameApproved || !data.rules.allowDisplayNames);
	const listed = data.profiles.filter((profile) => profile.listed && !hidesName(profile) && active.some((person) => person.userId === profile.userId));
	const cards = await Promise.all(
		listed.map(async (profile) => {
			const person = active.find((item) => item.userId === profile.userId)!;
			const badges = await loadBadges(db, organizationId, profile.userId);
			const shared = new Set(data.shares.filter((share) => share.userId === profile.userId).map((share) => share.badgeKey));
			return publicCard(
				{ ...person, name: routing.byId.get(profile.userId)?.name ?? "" },
				profile,
				data.rules,
				data.teamNames,
				data.skills.flatMap((skill) => (skill.userId === profile.userId && skill.shared && skill.level !== null ? [{ name: skill.name, category: skill.category, level: skill.level }] : [])),
				badges.filter((badge) => badge.shareable && shared.has(badge.key)).map((badge) => ({ kind: badge.kind, title: badge.title })),
			);
		}),
	);
	// Alphabetical, so the order never reads as a ranking.
	return c.json({ cards: cards.sort((a, b) => a.name.localeCompare(b.name)), staff: active.length });
});

capacitySkillRoutes.get("/directory/me", ...directoryGate, async (c) => {
	const db = c.get("db");
	const organizationId = c.get("org").organizationId;
	const userId = c.get("user").id;
	const [[profile], rules, [me], routing] = await Promise.all([
		db.select().from(directoryProfiles).where(and(eq(directoryProfiles.organizationId, organizationId), eq(directoryProfiles.userId, userId))),
		loadRules(db, organizationId),
		db.select({ position: userProfiles.position, departmentId: userProfiles.departmentId, photoKey: userProfiles.photoKey }).from(userProfiles).where(and(eq(userProfiles.organizationId, organizationId), eq(userProfiles.userId, userId))),
		loadRouting(db, organizationId),
	]);
	const [team] = me?.departmentId ? await db.select({ name: departments.name }).from(departments).where(eq(departments.id, me.departmentId)) : [];
	return c.json({
		profile: profile ?? { listed: false, displayName: null, displayNameApproved: false, picture: "initials", showTitle: true, showTeam: false, bio: null },
		rules,
		isAdmin: c.get("org").role === "admin",
		me: { name: routing.byId.get(userId)?.name ?? "", position: me?.position ?? null, team: team?.name ?? null, photoUrl: memberPhotoUrl(userId, me?.photoKey ?? null) },
	});
});

capacitySkillRoutes.put("/directory/me", ...directoryGate, async (c) => {
	const db = c.get("db");
	const organizationId = c.get("org").organizationId;
	const userId = c.get("user").id;
	const body = await readJson(c.req.raw);
	const bio = cleanText(body.bio).slice(0, 160);
	const displayName = cleanText(body.displayName).slice(0, 60);
	const picture = ["photo", "initials", "pattern"].includes(String(body.picture)) ? (body.picture as "photo" | "initials" | "pattern") : "initials";
	const [existing] = await db.select().from(directoryProfiles).where(and(eq(directoryProfiles.organizationId, organizationId), eq(directoryProfiles.userId, userId)));
	// A changed display name goes back to an admin before anyone sees it.
	const approved = !!displayName && existing?.displayName === displayName && existing.displayNameApproved;
	const values = {
		listed: body.listed === true,
		displayName: displayName || null,
		displayNameApproved: approved,
		picture,
		showTitle: body.showTitle !== false,
		showTeam: body.showTeam === true,
		bio: bio || null,
	};
	await db
		.insert(directoryProfiles)
		.values({ ...values, organizationId, userId })
		.onConflictDoUpdate({ target: [directoryProfiles.organizationId, directoryProfiles.userId], set: values });
	if (displayName && !approved && existing?.displayName !== displayName) {
		const routing = await loadRouting(db, organizationId);
		await notifyPeople(c, routing.people.filter((person) => person.role === "admin" && person.isActive).map((person) => person.userId), "display_name_waiting", { name: displayName }, "/directory");
	}
	return c.json({ ok: true, displayNamePending: !!displayName && !approved });
});

capacitySkillRoutes.get("/directory/settings", ...directoryGate, requireRole("admin"), async (c) => {
	const db = c.get("db");
	const organizationId = c.get("org").organizationId;
	const [rules, profiles, routing] = await Promise.all([
		loadRules(db, organizationId),
		db.select().from(directoryProfiles).where(eq(directoryProfiles.organizationId, organizationId)),
		loadRouting(db, organizationId),
	]);
	return c.json({
		rules,
		pending: profiles
			.filter((profile) => profile.displayName && !profile.displayNameApproved)
			.map((profile) => ({ id: profile.id, displayName: profile.displayName, person: routing.byId.get(profile.userId)?.name ?? "" })),
	});
});

capacitySkillRoutes.put("/directory/settings", ...directoryGate, requireRole("admin"), async (c) => {
	const body = await readJson(c.req.raw);
	const values = { showTeams: body.showTeams === true, allowPhotos: body.allowPhotos === true, allowDisplayNames: body.allowDisplayNames !== false };
	await c
		.get("db")
		.insert(directorySettings)
		.values({ ...values, organizationId: c.get("org").organizationId })
		.onConflictDoUpdate({ target: directorySettings.organizationId, set: values });
	await audit(c, "directory_rules_changed", "directory", values);
	return c.json({ ok: true });
});

capacitySkillRoutes.post("/directory/display-names/:id", ...directoryGate, requireRole("admin"), async (c) => {
	const db = c.get("db");
	const organizationId = c.get("org").organizationId;
	const [profile] = await db.select().from(directoryProfiles).where(and(eq(directoryProfiles.id, Number(c.req.param("id"))), eq(directoryProfiles.organizationId, organizationId)));
	if (!profile) return jsonError(c, 404, "NOT_FOUND", "That request doesn't exist.");
	const approve = (await readJson(c.req.raw)).approve === true;
	await db.update(directoryProfiles).set(approve ? { displayNameApproved: true } : { displayName: null, displayNameApproved: false, listed: false }).where(eq(directoryProfiles.id, profile.id));
	await audit(c, approve ? "display_name_approved" : "display_name_declined", String(profile.id));
	await notifyPeople(c, [profile.userId], approve ? "display_name_approved" : "display_name_declined", { name: profile.displayName ?? "" }, approve ? "/directory" : "/directory/privacy");
	return c.json({ ok: true });
});
