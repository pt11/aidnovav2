import { and, desc, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import type { Context } from "hono";
import type { Db } from "./db";
import {
	projectActivity,
	projectMembers,
	projectFolders,
	projectMilestones,
	projectReports,
	projects,
	user,
	userProfiles,
} from "./db/schema";
import {
	jsonError,
	requireOrg,
	requireRole,
	requireUser,
	type AppEnv,
} from "./middleware";
import { requireModule } from "./modules";
import { cleanText, readJson } from "./validate";

const STATUSES = ["draft", "planned", "in_progress", "on_hold", "completed", "cancelled", "archived"] as const;
const HEALTHS = ["unknown", "healthy", "needs_attention", "at_risk"] as const;
const PRIORITIES = ["low", "medium", "high"] as const;
const CATEGORIES = ["health", "wash", "education", "livelihoods", "emergency", "other"] as const;
const VISIBILITIES = ["members", "organization"] as const;
const FREQUENCIES = ["monthly", "quarterly", "custom"] as const;
const CURRENCIES = ["USD", "MMK", "EUR"] as const;
const MEMBER_ROLES = ["member", "viewer"] as const;
const STANDARD_FOLDERS = [
	"01 Project Planning",
	"02 Financial Reports",
	"03 Progress Reports",
	"04 Beneficiary Data",
	"05 Monitoring & Evaluation",
	"06 Annual Reports",
];
const CODE = /^[A-Z0-9][A-Z0-9-]{1,29}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export type Project = typeof projects.$inferSelect;

export const projectRoutes = new Hono<AppEnv>();
const gate = [requireUser, requireOrg, requireModule("projects")] as const;

export function pick<T extends string>(value: unknown, allowed: readonly T[]): T | null {
	return allowed.includes(value as T) ? (value as T) : null;
}

function readDate(value: unknown) {
	if (typeof value !== "string" || !DATE.test(value)) return null;
	return Number.isNaN(new Date(`${value}T00:00:00Z`).getTime()) ? null : value;
}

function readCount(value: unknown) {
	if (value === null || value === undefined || value === "") return null;
	const number = Number(value);
	return Number.isFinite(number) && number >= 0 && number <= 1e13 ? number : undefined;
}

export async function loadPeople(db: Db, organizationId: number) {
	return db
		.select({
			userId: user.id,
			name: user.name,
			email: user.email,
			role: userProfiles.role,
			isActive: userProfiles.isActive,
		})
		.from(userProfiles)
		.innerJoin(user, eq(userProfiles.userId, user.id))
		.where(eq(userProfiles.organizationId, organizationId));
}

function readProject(body: Record<string, unknown>) {
	const name = cleanText(body.name);
	const code = cleanText(body.code).toUpperCase();
	const description = cleanText(body.description, { multiline: true });
	const objectives = cleanText(body.objectives, { multiline: true });
	const outcomes = cleanText(body.expectedOutcomes, { multiline: true });
	const funder = cleanText(body.funder);
	const locations = cleanText(body.locations);
	const sdg = Number(body.sdg);
	const budgetAmount = readCount(body.budgetAmount);
	const beneficiaryTarget = readCount(body.beneficiaryTarget);
	const startDate = readDate(body.startDate);
	const endDate = readDate(body.endDate);
	if (name.length < 1 || name.length > 200) return { error: "INVALID_NAME" as const };
	if (!CODE.test(code)) return { error: "INVALID_CODE" as const };
	if (description.length > 4000 || objectives.length > 4000 || outcomes.length > 4000) return { error: "TOO_LONG" as const };
	if (funder.length > 200 || locations.length > 300) return { error: "TOO_LONG" as const };
	if (budgetAmount === undefined || beneficiaryTarget === undefined) return { error: "INVALID_NUMBER" as const };
	if (startDate && endDate && endDate < startDate) return { error: "END_BEFORE_START" as const };
	return {
		values: {
			name,
			code,
			category: pick(body.category, CATEGORIES),
			description: description || null,
			priority: pick(body.priority, PRIORITIES) ?? "medium",
			objectives: objectives || null,
			expectedOutcomes: outcomes || null,
			startDate,
			endDate,
			visibility: pick(body.visibility, VISIBILITIES) ?? "members",
			funder: funder || null,
			budgetCurrency: pick(body.budgetCurrency, CURRENCIES) ?? "USD",
			budgetAmount,
			beneficiaryTarget: beneficiaryTarget === null ? null : Math.floor(beneficiaryTarget),
			locations: locations || null,
			sdg: Number.isInteger(sdg) && sdg >= 1 && sdg <= 17 ? sdg : null,
			reportingFrequency: pick(body.reportingFrequency, FREQUENCIES),
		},
	};
}

function codeTaken(db: Db, organizationId: number, code: string) {
	return db
		.select({ id: projects.id, name: projects.name, status: projects.status })
		.from(projects)
		.where(and(eq(projects.organizationId, organizationId), eq(projects.code, code)))
		.then((rows) => rows[0]);
}

export function record(db: Db, c: Context<AppEnv>, projectId: number, kind: string, detail?: string | null) {
	return db.insert(projectActivity).values({
		projectId,
		organizationId: c.get("org").organizationId,
		actorId: c.get("user").id,
		kind,
		detail: detail ?? null,
	});
}

async function findProject(db: Db, organizationId: number, rawId: string) {
	const id = Number(rawId);
	if (!Number.isInteger(id)) return null;
	const [project] = await db
		.select()
		.from(projects)
		.where(and(eq(projects.id, id), eq(projects.organizationId, organizationId)));
	return project ?? null;
}

export function isLead(project: Project, userId: string) {
	return project.ownerId === userId || project.managerId === userId;
}

// Admins see every project. A draft stays with whoever is setting it up; after
// that, it's the team, or everyone if the project is open to the organization.
export function canSee(project: Project, userId: string, role: string, isMember: boolean) {
	if (role === "admin") return true;
	if (project.status === "draft") return project.createdBy === userId;
	return isLead(project, userId) || isMember || project.visibility === "organization";
}

export function canEdit(project: Project, userId: string, role: string) {
	return role === "admin" || isLead(project, userId) || (project.status === "draft" && project.createdBy === userId);
}

async function memberIds(db: Db, projectId: number) {
	const rows = await db
		.select({ userId: projectMembers.userId })
		.from(projectMembers)
		.where(eq(projectMembers.projectId, projectId));
	return new Set(rows.map((row) => row.userId));
}

// Loads a project this person may see, or answers as if it doesn't exist.
export async function loadVisible(c: Context<AppEnv>) {
	const db = c.get("db");
	const org = c.get("org");
	const project = await findProject(db, org.organizationId, c.req.param("id") ?? "");
	if (!project) return null;
	const members = await memberIds(db, project.id);
	return canSee(project, c.get("user").id, org.role, members.has(c.get("user").id)) ? project : null;
}

// A team member can add files and reports. A viewer, or someone who can only see
// the project because it's open to everyone, can read them.
export async function contributes(db: Db, project: Project, userId: string, role: string) {
	if (canEdit(project, userId, role)) return true;
	const [member] = await db
		.select({ role: projectMembers.role })
		.from(projectMembers)
		.where(and(eq(projectMembers.projectId, project.id), eq(projectMembers.userId, userId)));
	return member?.role === "member";
}

export const PERIOD = /^\d{4}-(0[1-9]|1[0-2]|Q[1-4])$/;

function addMonths(year: number, month: number, count: number) {
	const total = year * 12 + (month - 1) + count;
	return { year: Math.floor(total / 12), month: (total % 12) + 1 };
}

// Reports expected so far: due on the 10th after each period ends. Only a running
// project owes reports, so planned or paused ones aren't marked overdue.
export function expectedPeriods(project: Project, today: string, submitted: Set<string> = new Set()) {
	if (project.status !== "in_progress" || !project.startDate) return [];
	if (project.reportingFrequency !== "monthly" && project.reportingFrequency !== "quarterly") return [];
	const step = project.reportingFrequency === "monthly" ? 1 : 3;
	const last = project.endDate && project.endDate < today ? project.endDate : today;
	let cursor = { year: Number(project.startDate.slice(0, 4)), month: Number(project.startDate.slice(5, 7)) };
	if (step === 3) cursor.month = Math.floor((cursor.month - 1) / 3) * 3 + 1;
	const items: { period: string; dueDate: string; overdue: boolean }[] = [];
	const pad = (value: number) => String(value).padStart(2, "0");
	while (`${cursor.year}-${pad(cursor.month)}-01` <= last && items.length < 120) {
		const period = step === 1 ? `${cursor.year}-${pad(cursor.month)}` : `${cursor.year}-Q${(cursor.month + 2) / 3}`;
		const next = addMonths(cursor.year, cursor.month, step);
		const dueDate = `${next.year}-${pad(next.month)}-10`;
		items.push({ period, dueDate, overdue: dueDate < today && !submitted.has(period) });
		cursor = next;
	}
	return items.reverse();
}

const NOT_FOUND = "That project doesn't exist.";

projectRoutes.get("/projects", ...gate, async (c) => {
	const db = c.get("db");
	const org = c.get("org");
	const userId = c.get("user").id;
	const [rows, mine, counts, people, reports] = await Promise.all([
		db.select().from(projects).where(eq(projects.organizationId, org.organizationId)).orderBy(desc(projects.updatedAt)),
		db
			.select({ projectId: projectMembers.projectId })
			.from(projectMembers)
			.where(and(eq(projectMembers.organizationId, org.organizationId), eq(projectMembers.userId, userId))),
		db
			.select({
				projectId: projectMilestones.projectId,
				total: sql<number>`count(*)`,
				done: sql<number>`sum(case when ${projectMilestones.completedAt} is null then 0 else 1 end)`,
			})
			.from(projectMilestones)
			.where(eq(projectMilestones.organizationId, org.organizationId))
			.groupBy(projectMilestones.projectId),
		loadPeople(db, org.organizationId),
		db
			.select({ projectId: projectReports.projectId, period: projectReports.period, status: projectReports.status, type: projectReports.type })
			.from(projectReports)
			.where(eq(projectReports.organizationId, org.organizationId)),
	]);
	const today = new Date().toISOString().slice(0, 10);
	const memberOf = new Set(mine.map((row) => row.projectId));
	const milestones = new Map(counts.map((row) => [row.projectId, row]));
	const names = new Map(people.map((person) => [person.userId, person.name]));
	const list = rows
		.filter((project) => canSee(project, userId, org.role, memberOf.has(project.id)))
		.map((project) => ({
			id: project.id,
			name: project.name,
			code: project.code,
			category: project.category,
			funder: project.funder,
			status: project.status,
			health: project.health,
			endDate: project.endDate,
			ownerName: project.ownerId ? (names.get(project.ownerId) ?? null) : null,
			managerName: project.managerId ? (names.get(project.managerId) ?? null) : null,
			milestonesTotal: milestones.get(project.id)?.total ?? 0,
			milestonesDone: milestones.get(project.id)?.done ?? 0,
			mine: isLead(project, userId) || memberOf.has(project.id),
			reportsOverdue: expectedPeriods(
				project,
				today,
				new Set(reports.filter((report) => report.projectId === project.id && report.type === "form" && ["submitted", "approved", "locked"].includes(report.status)).map((report) => report.period)),
			).filter((item) => item.overdue).length,
			reportsRequired: project.reportingFrequency === "monthly" || project.reportingFrequency === "quarterly",
		}));
	return c.json({ projects: list, canCreate: org.role !== "staff" });
});

projectRoutes.get("/projects/code-check", ...gate, requireRole("manager", "admin"), async (c) => {
	const code = cleanText(c.req.query("code")).toUpperCase();
	if (!CODE.test(code)) return c.json({ valid: false, available: false });
	const taken = await codeTaken(c.get("db"), c.get("org").organizationId, code);
	// Naming the other project only helps someone who could already see it.
	return c.json({ valid: true, available: !taken, suggestion: taken ? `${code.slice(0, 27)}-B` : null });
});

projectRoutes.get("/projects/people", ...gate, requireRole("manager", "admin"), async (c) => {
	const people = await loadPeople(c.get("db"), c.get("org").organizationId);
	return c.json({
		people: people
			.filter((person) => person.isActive)
			.map(({ userId, name }) => ({ userId, name }))
			.sort((a, b) => a.name.localeCompare(b.name)),
	});
});

projectRoutes.post("/projects", ...gate, requireRole("manager", "admin"), async (c) => {
	const db = c.get("db");
	const org = c.get("org");
	const userId = c.get("user").id;
	const body = await readJson(c.req.raw);
	const input = readProject(body);
	if ("error" in input) return jsonError(c, 400, input.error ?? "INVALID", "Check the project details.");
	if (await codeTaken(db, org.organizationId, input.values.code)) {
		return jsonError(c, 409, "CODE_TAKEN", "That project code is already used.");
	}
	const people = await loadPeople(db, org.organizationId);
	const active = new Set(people.filter((person) => person.isActive).map((person) => person.userId));
	const ownerId = typeof body.ownerId === "string" && body.ownerId ? body.ownerId : userId;
	const managerId = typeof body.managerId === "string" && body.managerId ? body.managerId : userId;
	if (!active.has(ownerId) || !active.has(managerId)) {
		return jsonError(c, 400, "INVALID_PERSON", "Choose people in your organization.");
	}
	const status = pick(body.status, ["draft", "planned", "in_progress"] as const) ?? "planned";
	const members = Array.isArray(body.members) ? (body.members as { userId?: unknown; role?: unknown }[]) : [];
	const [created] = await db
		.insert(projects)
		.values({ ...input.values, organizationId: org.organizationId, status, ownerId, managerId, createdBy: userId })
		.returning({ id: projects.id });
	const chosen = members.filter(
		(member) => typeof member.userId === "string" && active.has(member.userId) && member.userId !== ownerId && member.userId !== managerId,
	);
	for (const member of chosen.slice(0, 200)) {
		await db
			.insert(projectMembers)
			.values({
				projectId: created.id,
				organizationId: org.organizationId,
				userId: member.userId as string,
				role: pick(member.role, MEMBER_ROLES) ?? "member",
			})
			.onConflictDoNothing();
	}
	if (body.folderTemplate === "standard") {
		await db.insert(projectFolders).values(
			STANDARD_FOLDERS.map((name) => ({ projectId: created.id, organizationId: org.organizationId, name })),
		);
	}
	await record(db, c, created.id, "created");
	return c.json(created, 201);
});

projectRoutes.get("/projects/:id", ...gate, async (c) => {
	const db = c.get("db");
	const org = c.get("org");
	const project = await loadVisible(c);
	if (!project) return jsonError(c, 404, "NOT_FOUND", NOT_FOUND);
	const [people, milestones, members, activity] = await Promise.all([
		loadPeople(db, org.organizationId),
		db.select().from(projectMilestones).where(eq(projectMilestones.projectId, project.id)).orderBy(projectMilestones.dueDate, projectMilestones.id),
		db.select().from(projectMembers).where(eq(projectMembers.projectId, project.id)),
		db
			.select({
				id: projectActivity.id,
				kind: projectActivity.kind,
				detail: projectActivity.detail,
				createdAt: projectActivity.createdAt,
				actorName: user.name,
			})
			.from(projectActivity)
			.leftJoin(user, eq(projectActivity.actorId, user.id))
			.where(eq(projectActivity.projectId, project.id))
			.orderBy(desc(projectActivity.id))
			.limit(50),
	]);
	const names = new Map(people.map((person) => [person.userId, person.name]));
	const name = (id: string | null) => (id ? (names.get(id) ?? null) : null);
	return c.json({
		project: {
			...project,
			ownerName: name(project.ownerId),
			managerName: name(project.managerId),
			healthSetByName: name(project.healthSetBy),
			completedByName: name(project.completedBy),
		},
		canEdit: canEdit(project, c.get("user").id, org.role),
		isAdmin: org.role === "admin",
		milestones,
		members: members.map((member) => ({ userId: member.userId, role: member.role, name: names.get(member.userId) ?? "" })),
		activity,
	});
});

projectRoutes.patch("/projects/:id", ...gate, async (c) => {
	const db = c.get("db");
	const org = c.get("org");
	const project = await loadVisible(c);
	if (!project) return jsonError(c, 404, "NOT_FOUND", NOT_FOUND);
	if (!canEdit(project, c.get("user").id, org.role)) return jsonError(c, 403, "FORBIDDEN", "You can't change this project.");
	const body = await readJson(c.req.raw);
	const input = readProject(body);
	if ("error" in input) return jsonError(c, 400, input.error ?? "INVALID", "Check the project details.");
	const clash = await codeTaken(db, org.organizationId, input.values.code);
	if (clash && clash.id !== project.id) return jsonError(c, 409, "CODE_TAKEN", "That project code is already used.");
	const status = pick(body.status, STATUSES) ?? project.status;
	// Finishing has its own checks, and only an admin reopens. An archive can still follow it.
	if (status !== project.status && (status === "completed" || (project.status === "completed" && status !== "archived"))) {
		return jsonError(c, 409, "USE_COMPLETE", "Use Complete project, or ask an admin to reopen it.");
	}
	const people = await loadPeople(db, org.organizationId);
	const active = new Set(people.filter((person) => person.isActive).map((person) => person.userId));
	const ownerId = typeof body.ownerId === "string" && active.has(body.ownerId) ? body.ownerId : project.ownerId;
	const managerId = typeof body.managerId === "string" && active.has(body.managerId) ? body.managerId : project.managerId;
	await db.update(projects).set({ ...input.values, status, ownerId, managerId }).where(eq(projects.id, project.id));
	if (ownerId) await db.delete(projectMembers).where(and(eq(projectMembers.projectId, project.id), eq(projectMembers.userId, ownerId)));
	if (managerId) await db.delete(projectMembers).where(and(eq(projectMembers.projectId, project.id), eq(projectMembers.userId, managerId)));
	await record(db, c, project.id, status !== project.status ? "status" : "updated", status !== project.status ? status : null);
	return c.json({ ok: true });
});

projectRoutes.post("/projects/:id/health", ...gate, async (c) => {
	const db = c.get("db");
	const project = await loadVisible(c);
	if (!project) return jsonError(c, 404, "NOT_FOUND", NOT_FOUND);
	if (!canEdit(project, c.get("user").id, c.get("org").role)) return jsonError(c, 403, "FORBIDDEN", "You can't change this project.");
	const body = await readJson(c.req.raw);
	const health = pick(body.health, HEALTHS);
	const reason = cleanText(body.reason);
	if (!health || reason.length > 500) return jsonError(c, 400, "INVALID_HEALTH", "Choose a health status.");
	if ((health === "needs_attention" || health === "at_risk") && reason.length < 1) {
		return jsonError(c, 400, "REASON_REQUIRED", "Say why.");
	}
	await db
		.update(projects)
		.set({ health, healthReason: reason || null, healthSetBy: c.get("user").id, healthSetAt: new Date() })
		.where(eq(projects.id, project.id));
	await record(db, c, project.id, "health", JSON.stringify({ health, reason }));
	return c.json({ ok: true });
});

function readMilestone(body: Record<string, unknown>) {
	const title = cleanText(body.title);
	const dueDate = readDate(body.dueDate);
	return title.length >= 1 && title.length <= 200 && dueDate ? { title, dueDate } : null;
}

projectRoutes.post("/projects/:id/milestones", ...gate, async (c) => {
	const db = c.get("db");
	const project = await loadVisible(c);
	if (!project) return jsonError(c, 404, "NOT_FOUND", NOT_FOUND);
	if (!canEdit(project, c.get("user").id, c.get("org").role)) return jsonError(c, 403, "FORBIDDEN", "You can't change this project.");
	const values = readMilestone(await readJson(c.req.raw));
	if (!values) return jsonError(c, 400, "INVALID_MILESTONE", "Add a title and a due date.");
	const [created] = await db
		.insert(projectMilestones)
		.values({ ...values, projectId: project.id, organizationId: project.organizationId })
		.returning({ id: projectMilestones.id });
	await db.update(projects).set({ updatedAt: new Date() }).where(eq(projects.id, project.id));
	await record(db, c, project.id, "milestone_added", values.title);
	return c.json(created, 201);
});

async function findMilestone(db: Db, project: Project, rawId: string | undefined) {
	const [milestone] = await db
		.select()
		.from(projectMilestones)
		.where(and(eq(projectMilestones.id, Number(rawId)), eq(projectMilestones.projectId, project.id)));
	return milestone ?? null;
}

projectRoutes.patch("/projects/:id/milestones/:milestoneId", ...gate, async (c) => {
	const db = c.get("db");
	const project = await loadVisible(c);
	if (!project) return jsonError(c, 404, "NOT_FOUND", NOT_FOUND);
	if (!canEdit(project, c.get("user").id, c.get("org").role)) return jsonError(c, 403, "FORBIDDEN", "You can't change this project.");
	const milestone = await findMilestone(db, project, c.req.param("milestoneId"));
	if (!milestone) return jsonError(c, 404, "NOT_FOUND", "That milestone doesn't exist.");
	const body = await readJson(c.req.raw);
	if (typeof body.completed === "boolean") {
		await db
			.update(projectMilestones)
			.set({ completedAt: body.completed ? new Date() : null, completedBy: body.completed ? c.get("user").id : null })
			.where(eq(projectMilestones.id, milestone.id));
		await record(db, c, project.id, body.completed ? "milestone_done" : "milestone_reopened", milestone.title);
	} else {
		const values = readMilestone(body);
		if (!values) return jsonError(c, 400, "INVALID_MILESTONE", "Add a title and a due date.");
		await db.update(projectMilestones).set(values).where(eq(projectMilestones.id, milestone.id));
		await record(db, c, project.id, "milestone_changed", values.title);
	}
	await db.update(projects).set({ updatedAt: new Date() }).where(eq(projects.id, project.id));
	return c.json({ ok: true });
});

projectRoutes.delete("/projects/:id/milestones/:milestoneId", ...gate, async (c) => {
	const db = c.get("db");
	const project = await loadVisible(c);
	if (!project) return jsonError(c, 404, "NOT_FOUND", NOT_FOUND);
	if (!canEdit(project, c.get("user").id, c.get("org").role)) return jsonError(c, 403, "FORBIDDEN", "You can't change this project.");
	const milestone = await findMilestone(db, project, c.req.param("milestoneId"));
	if (!milestone) return jsonError(c, 404, "NOT_FOUND", "That milestone doesn't exist.");
	await db.delete(projectMilestones).where(eq(projectMilestones.id, milestone.id));
	await record(db, c, project.id, "milestone_removed", milestone.title);
	return c.json({ ok: true });
});

// A project lead may be staff, so they get the list of people here.
projectRoutes.get("/projects/:id/people", ...gate, async (c) => {
	const project = await loadVisible(c);
	if (!project) return jsonError(c, 404, "NOT_FOUND", NOT_FOUND);
	if (!canEdit(project, c.get("user").id, c.get("org").role)) return jsonError(c, 403, "FORBIDDEN", "You can't change this project.");
	const people = await loadPeople(c.get("db"), project.organizationId);
	return c.json({
		people: people
			.filter((person) => person.isActive)
			.map(({ userId, name }) => ({ userId, name }))
			.sort((a, b) => a.name.localeCompare(b.name)),
	});
});

projectRoutes.put("/projects/:id/members/:userId", ...gate, async (c) => {
	const db = c.get("db");
	const project = await loadVisible(c);
	if (!project) return jsonError(c, 404, "NOT_FOUND", NOT_FOUND);
	if (!canEdit(project, c.get("user").id, c.get("org").role)) return jsonError(c, 403, "FORBIDDEN", "You can't change this project.");
	const targetId = c.req.param("userId");
	const people = await loadPeople(db, project.organizationId);
	const person = people.find((candidate) => candidate.userId === targetId && candidate.isActive);
	if (!person) return jsonError(c, 400, "INVALID_PERSON", "Choose someone in your organization.");
	if (isLead(project, targetId)) return jsonError(c, 400, "ALREADY_LEAD", "They already lead this project.");
	const role = pick((await readJson(c.req.raw)).role, MEMBER_ROLES) ?? "member";
	await db
		.insert(projectMembers)
		.values({ projectId: project.id, organizationId: project.organizationId, userId: targetId, role })
		.onConflictDoUpdate({ target: [projectMembers.projectId, projectMembers.userId], set: { role } });
	await record(db, c, project.id, "member_added", person.name);
	return c.json({ ok: true });
});

projectRoutes.delete("/projects/:id/members/:userId", ...gate, async (c) => {
	const db = c.get("db");
	const project = await loadVisible(c);
	if (!project) return jsonError(c, 404, "NOT_FOUND", NOT_FOUND);
	if (!canEdit(project, c.get("user").id, c.get("org").role)) return jsonError(c, 403, "FORBIDDEN", "You can't change this project.");
	const targetId = c.req.param("userId");
	const people = await loadPeople(db, project.organizationId);
	await db.delete(projectMembers).where(and(eq(projectMembers.projectId, project.id), eq(projectMembers.userId, targetId)));
	await record(db, c, project.id, "member_removed", people.find((person) => person.userId === targetId)?.name ?? null);
	return c.json({ ok: true });
});
