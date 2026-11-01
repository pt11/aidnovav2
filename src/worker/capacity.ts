import { and, desc, eq, inArray, isNotNull, like, sql } from "drizzle-orm";
import { Hono } from "hono";
import type { Context } from "hono";
import type { Db } from "./db";
import {
	capacityUserSkills,
	auditLog,
	capacityTeamReviewers,
	departments,
	trainingEvents,
	trainingEvidence,
	trainingRecords,
	user,
	userProfiles,
} from "./db/schema";
import { sendEmail } from "./email";
import {
	jsonError,
	requireOrg,
	requireRole,
	requireUser,
	type AppEnv,
} from "./middleware";
import { requireModule } from "./modules";
import { getOrgLimits, getStorageUsed } from "./plans";
import { cleanText, readJson } from "./validate";

// Who attends what training can put staff at risk, so a record's details only ever
// reach its owner and the people reviewing that owner. Managers and admins get the
// Training report's short summary of submitted records, with sensitive ones reduced
// to "Restricted". It's kept out of Reports, Hub search, the assistant and the
// platform admin area on purpose.

const CATEGORIES = [
	"leadership",
	"project_management",
	"meal",
	"finance",
	"digital",
	"safeguarding",
	"safety",
	"community",
	"health",
	"communication",
	"other",
] as const;
const SENSITIVE = new Set<string>(["safeguarding", "safety"]);
const FORMATS = ["in_person", "online", "hybrid"] as const;
const DURATION_UNITS = ["training_days", "calendar_days", "contact_hours"] as const;
const TRAINING_STATUSES = ["applied", "started", "in_progress", "completed", "cancelled"] as const;
const OUTCOMES = ["applied", "accepted", "waitlisted", "declined"] as const;
const LANGUAGES = ["my", "en", "both"] as const;
const LOCATION_MODES = ["withheld", "region", "online"] as const;
const REGIONS = [
	"Ayeyarwady",
	"Bago",
	"Chin",
	"Kachin",
	"Kayah",
	"Kayin",
	"Magway",
	"Mandalay",
	"Mon",
	"Naypyitaw",
	"Rakhine",
	"Sagaing",
	"Shan",
	"Tanintharyi",
	"Yangon",
	"Outside Myanmar",
];
const EVIDENCE_TYPES: Record<string, string> = {
	pdf: "application/pdf",
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	png: "image/png",
};
const MAX_EVIDENCE_BYTES = 10 * 1024 * 1024;
const MAX_EVIDENCE_FILES = 5;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

type Record_ = typeof trainingRecords.$inferSelect;

export const capacityRoutes = new Hono<AppEnv>();
const gate = [requireUser, requireOrg, requireModule("capacity_building")] as const;

function pick<T extends string>(value: unknown, allowed: readonly T[]): T | null {
	return allowed.includes(value as T) ? (value as T) : null;
}

function readDate(value: unknown) {
	if (typeof value !== "string" || !DATE.test(value)) return null;
	return Number.isNaN(new Date(`${value}T00:00:00Z`).getTime()) ? null : value;
}

function readFields(body: Record<string, unknown>) {
	const category = pick(body.category, CATEGORIES);
	const format = pick(body.format, FORMATS);
	const sensitive = category !== null && SENSITIVE.has(category);
	const duration = Number(body.durationValue);
	const requested = pick(body.locationMode, LOCATION_MODES) ?? "withheld";
	// Safety comes first: a sensitive record never stores a place or a provider,
	// whatever was sent, and online training has no place to store.
	const locationMode: (typeof LOCATION_MODES)[number] =
		format === "online" ? "online" : sensitive || requested === "online" ? "withheld" : requested;
	const region = locationMode === "region" && REGIONS.includes(String(body.region)) ? String(body.region) : null;
	const trainingStatus = pick(body.trainingStatus, TRAINING_STATUSES) ?? "applied";
	return {
		title: cleanText(body.title),
		category,
		isSensitive: sensitive,
		format,
		startDate: readDate(body.startDate),
		endDate: readDate(body.endDate),
		durationValue: body.durationValue !== null && Number.isFinite(duration) && duration > 0 ? duration : null,
		durationUnit: pick(body.durationUnit, DURATION_UNITS) ?? "training_days",
		trainingStatus,
		applicationOutcome: trainingStatus === "applied" ? pick(body.applicationOutcome, OUTCOMES) : null,
		objectives: cleanText(body.objectives, { multiline: true }) || null,
		provider: sensitive ? null : cleanText(body.provider) || null,
		language: pick(body.language, LANGUAGES) ?? "my",
		locationMode: locationMode === "region" && !region ? "withheld" : locationMode,
		region,
		reflection: cleanText(body.reflection, { multiline: true }) || null,
		shareReflection: body.shareReflection === true,
	};
}

function fieldProblem(fields: ReturnType<typeof readFields>) {
	if (fields.title.length < 1 || fields.title.length > 200) return "INVALID_TITLE";
	if ((fields.objectives?.length ?? 0) > 2000 || (fields.reflection?.length ?? 0) > 2000) return "TOO_LONG";
	if ((fields.provider?.length ?? 0) > 200) return "TOO_LONG";
	if (fields.durationValue !== null && fields.durationValue > 10000) return "INVALID_DURATION";
	if (fields.startDate && fields.endDate && fields.endDate < fields.startDate) return "END_BEFORE_START";
	return null;
}

// What a reviewer needs before they can make a decision. A draft can be saved
// without any of it.
function missingForSubmit(record: Record_) {
	const missing: string[] = [];
	if (!record.category) missing.push("category");
	if (!record.format) missing.push("format");
	if (!record.startDate) missing.push("startDate");
	if (!record.endDate) missing.push("endDate");
	if (record.durationValue === null) missing.push("duration");
	if (!record.objectives) missing.push("objectives");
	return missing;
}

function canEdit(record: Record_) {
	return (
		record.reviewStatus === "draft" ||
		record.reviewStatus === "changes_requested" ||
		(record.reviewStatus === "verified" && record.trainingStatus !== "completed")
	);
}

interface Person {
	userId: string;
	name: string;
	email: string;
	role: "staff" | "manager" | "admin";
	isActive: boolean;
	departmentId: number | null;
}

async function loadPeople(db: Db, organizationId: number): Promise<Person[]> {
	return db
		.select({
			userId: user.id,
			name: user.name,
			email: user.email,
			role: userProfiles.role,
			isActive: userProfiles.isActive,
			departmentId: userProfiles.departmentId,
		})
		.from(userProfiles)
		.innerJoin(user, eq(userProfiles.userId, user.id))
		.where(eq(userProfiles.organizationId, organizationId));
}

export async function loadRouting(db: Db, organizationId: number) {
	const [people, teams] = await Promise.all([
		loadPeople(db, organizationId),
		db.select().from(capacityTeamReviewers).where(eq(capacityTeamReviewers.organizationId, organizationId)),
	]);
	const byId = new Map(people.map((person) => [person.userId, person]));
	const teamByDepartment = new Map(teams.map((team) => [team.departmentId, team]));
	const canReview = (id: string | null | undefined, ownerId: string) => {
		const person = id ? byId.get(id) : undefined;
		return !!person && person.isActive && person.role !== "staff" && person.userId !== ownerId;
	};
	const admins = (ownerId: string) =>
		people.filter((person) => person.role === "admin" && person.isActive && person.userId !== ownerId);
	// Nobody reviews their own training. It goes to the team's backup, and then
	// to an admin. A team with no reviewer at all waits until one is chosen.
	const reviewersFor = (ownerId: string): Person[] => {
		const owner = byId.get(ownerId);
		const team = owner?.departmentId ? teamByDepartment.get(owner.departmentId) : undefined;
		if (!owner?.departmentId) return admins(ownerId);
		if (!team) return [];
		if (canReview(team.reviewerId, ownerId)) return [byId.get(team.reviewerId!)!];
		if (canReview(team.backupId, ownerId)) return [byId.get(team.backupId!)!];
		return team.reviewerId === ownerId || team.backupId === ownerId ? admins(ownerId) : [];
	};
	return { people, byId, teams, reviewersFor };
}

function writeAudit(
	db: Db,
	c: Context<AppEnv>,
	action: string,
	targetId: string,
	metadata: Record<string, unknown>,
) {
	// Training names, providers and places are never written here.
	return db.insert(auditLog).values({
		organizationId: c.get("org").organizationId,
		actorUserId: c.get("user").id,
		action: `capacity.${action}`,
		targetType: "training_record",
		targetId,
		metadata: JSON.stringify(metadata),
	});
}

// Emails say only that something happened, so a training name never shows up on
// a lock screen.
function notify(c: Context<AppEnv>, to: string[], subject: string, path: string) {
	const organization = c.get("org").name;
	const link = `${c.env.HUB_URL}${path}`;
	const sending = Promise.allSettled(
		to.map((address) =>
			sendEmail(c.env, { to: address, subject, text: `${subject}\n\n${organization} on AidNova:\n${link}` }),
		),
	);
	c.executionCtx.waitUntil(sending);
}

async function findRecord(db: Db, organizationId: number, rawId: string) {
	const id = Number(rawId);
	if (!Number.isInteger(id)) return null;
	const [record] = await db
		.select()
		.from(trainingRecords)
		.where(and(eq(trainingRecords.id, id), eq(trainingRecords.organizationId, organizationId)));
	return record ?? null;
}

// Returns who is asking, or null. A reviewer sees nothing until it's submitted.
async function accessTo(db: Db, c: Context<AppEnv>, record: Record_) {
	const userId = c.get("user").id;
	const routing = await loadRouting(db, record.organizationId);
	const reviewers = routing.reviewersFor(record.userId);
	if (record.userId === userId) return { as: "owner" as const, routing, reviewers };
	if (record.reviewStatus !== "draft" && reviewers.some((person) => person.userId === userId)) {
		return { as: "reviewer" as const, routing, reviewers };
	}
	return null;
}

const NOT_FOUND = "That training record doesn't exist.";

const SCOPES = ["team", "department", "organization"] as const;
type Scope = (typeof SCOPES)[number];

function reportScopes(role: string): Scope[] {
	if (role === "admin") return [...SCOPES];
	return role === "manager" ? ["team", "department"] : [];
}

capacityRoutes.get("/capacity/me", ...gate, async (c) => {
	const db = c.get("db");
	const userId = c.get("user").id;
	const routing = await loadRouting(db, c.get("org").organizationId);
	const waiting = await reviewQueue(db, c.get("org").organizationId, userId, routing);
	const pendingSkills = await db
		.select({ userId: capacityUserSkills.userId })
		.from(capacityUserSkills)
		.where(and(eq(capacityUserSkills.organizationId, c.get("org").organizationId), isNotNull(capacityUserSkills.pendingLevel)));
	return c.json({
		assessCount: pendingSkills.filter((row) => routing.reviewersFor(row.userId).some((person) => person.userId === userId)).length,
		reviewers: routing.reviewersFor(userId).map((person) => person.name),
		inDepartment: !!routing.byId.get(userId)?.departmentId,
		canReview: waiting.isReviewer,
		reviewCount: waiting.items.filter((item) => item.tab === "to_review").length,
		isAdmin: c.get("org").role === "admin",
		reportScopes: reportScopes(c.get("org").role),
	});
});

capacityRoutes.get("/capacity/records", ...gate, async (c) => {
	const db = c.get("db");
	const organizationId = c.get("org").organizationId;
	const records = await db
		.select()
		.from(trainingRecords)
		.where(and(eq(trainingRecords.organizationId, organizationId), eq(trainingRecords.userId, c.get("user").id)))
		.orderBy(desc(trainingRecords.updatedAt));
	const counts = records.length
		? await db
				.select({ recordId: trainingEvidence.recordId, total: sql<number>`count(*)` })
				.from(trainingEvidence)
				.where(eq(trainingEvidence.organizationId, organizationId))
				.groupBy(trainingEvidence.recordId)
		: [];
	const evidence = new Map(counts.map((row) => [row.recordId, row.total]));
	return c.json({ records: records.map((record) => ({ ...record, evidenceCount: evidence.get(record.id) ?? 0 })) });
});

capacityRoutes.post("/capacity/records", ...gate, async (c) => {
	const fields = readFields(await readJson(c.req.raw));
	const problem = fieldProblem(fields);
	if (problem) return jsonError(c, 400, problem, "Check the details and try again.");
	const [created] = await c
		.get("db")
		.insert(trainingRecords)
		.values({ ...fields, organizationId: c.get("org").organizationId, userId: c.get("user").id })
		.returning({ id: trainingRecords.id });
	return c.json(created, 201);
});

capacityRoutes.get("/capacity/records/:id", ...gate, async (c) => {
	const db = c.get("db");
	const record = await findRecord(db, c.get("org").organizationId, c.req.param("id"));
	const access = record && (await accessTo(db, c, record));
	if (!record || !access) return jsonError(c, 404, "NOT_FOUND", NOT_FOUND);
	const [evidence, events] = await Promise.all([
		db
			.select({
				id: trainingEvidence.id,
				name: trainingEvidence.name,
				mimeType: trainingEvidence.mimeType,
				sizeBytes: trainingEvidence.sizeBytes,
				createdAt: trainingEvidence.createdAt,
			})
			.from(trainingEvidence)
			.where(eq(trainingEvidence.recordId, record.id)),
		db
			.select({
				id: trainingEvents.id,
				kind: trainingEvents.kind,
				message: trainingEvents.message,
				privateNote: trainingEvents.privateNote,
				version: trainingEvents.version,
				createdAt: trainingEvents.createdAt,
				actorId: trainingEvents.actorId,
				actorName: user.name,
			})
			.from(trainingEvents)
			.leftJoin(user, eq(trainingEvents.actorId, user.id))
			.where(eq(trainingEvents.recordId, record.id))
			.orderBy(trainingEvents.id),
	]);
	const owner = access.routing.byId.get(record.userId);
	const asOwner = access.as === "owner";
	const department = owner?.departmentId
		? (
				await db
					.select({ name: departments.name })
					.from(departments)
					.where(eq(departments.id, owner.departmentId))
			)[0]?.name
		: null;
	return c.json({
		record: { ...record, reflection: asOwner || record.shareReflection ? record.reflection : null },
		viewer: access.as,
		canEdit: asOwner && canEdit(record),
		owner: { name: owner?.name ?? "", department: department ?? null },
		reviewers: access.reviewers.map((person) => person.name),
		evidence,
		events: events.map((event) => ({ ...event, privateNote: asOwner ? null : event.privateNote })),
	});
});

capacityRoutes.put("/capacity/records/:id", ...gate, async (c) => {
	const db = c.get("db");
	const record = await findRecord(db, c.get("org").organizationId, c.req.param("id"));
	if (!record || record.userId !== c.get("user").id) return jsonError(c, 404, "NOT_FOUND", NOT_FOUND);
	if (!canEdit(record)) return jsonError(c, 409, "LOCKED", "This record can't be changed right now.");
	const fields = readFields(await readJson(c.req.raw));
	const problem = fieldProblem(fields);
	if (problem) return jsonError(c, 400, problem, "Check the details and try again.");
	// An application verified earlier has to be reviewed again once it moves on.
	const reviewStatus = record.reviewStatus === "verified" ? ("draft" as const) : record.reviewStatus;
	await db
		.update(trainingRecords)
		.set({ ...fields, reviewStatus })
		.where(eq(trainingRecords.id, record.id));
	return c.json({ ok: true });
});

capacityRoutes.delete("/capacity/records/:id", ...gate, async (c) => {
	const db = c.get("db");
	const record = await findRecord(db, c.get("org").organizationId, c.req.param("id"));
	if (!record || record.userId !== c.get("user").id) return jsonError(c, 404, "NOT_FOUND", NOT_FOUND);
	if (record.reviewStatus !== "draft") {
		return jsonError(c, 409, "LOCKED", "Only a draft can be deleted.");
	}
	const files = await db
		.select({ storageKey: trainingEvidence.storageKey })
		.from(trainingEvidence)
		.where(eq(trainingEvidence.recordId, record.id));
	await db.delete(trainingRecords).where(eq(trainingRecords.id, record.id));
	if (files.length) await c.env.FILES.delete(files.map((file) => file.storageKey));
	return c.json({ ok: true });
});

capacityRoutes.post("/capacity/records/:id/submit", ...gate, async (c) => {
	const db = c.get("db");
	const record = await findRecord(db, c.get("org").organizationId, c.req.param("id"));
	if (!record || record.userId !== c.get("user").id) return jsonError(c, 404, "NOT_FOUND", NOT_FOUND);
	if (record.reviewStatus !== "draft" && record.reviewStatus !== "changes_requested") {
		return jsonError(c, 409, "LOCKED", "This record has already been submitted.");
	}
	const missing = missingForSubmit(record);
	if (missing.length) {
		return c.json({ code: "INCOMPLETE", message: "Fill in the required details first.", missing }, 400);
	}
	const body = await readJson(c.req.raw);
	const note = cleanText(body.note, { multiline: true }).slice(0, 1000);
	const version = record.version + 1;
	await db
		.update(trainingRecords)
		.set({ reviewStatus: "submitted", version, submittedAt: new Date() })
		.where(eq(trainingRecords.id, record.id));
	await db.insert(trainingEvents).values({
		recordId: record.id,
		organizationId: record.organizationId,
		actorId: c.get("user").id,
		kind: "submitted",
		message: note || null,
		version,
	});
	const routing = await loadRouting(db, record.organizationId);
	notify(
		c,
		routing.reviewersFor(record.userId).map((person) => person.email),
		"A training report is waiting for your review",
		"/capacity/reviews",
	);
	return c.json({ ok: true, version });
});

capacityRoutes.post("/capacity/records/:id/withdraw", ...gate, async (c) => {
	const db = c.get("db");
	const record = await findRecord(db, c.get("org").organizationId, c.req.param("id"));
	if (!record || record.userId !== c.get("user").id) return jsonError(c, 404, "NOT_FOUND", NOT_FOUND);
	if (record.reviewStatus !== "submitted" && record.reviewStatus !== "under_review") {
		return jsonError(c, 409, "LOCKED", "This record can't be withdrawn now.");
	}
	await db.update(trainingRecords).set({ reviewStatus: "draft" }).where(eq(trainingRecords.id, record.id));
	await db.insert(trainingEvents).values({
		recordId: record.id,
		organizationId: record.organizationId,
		actorId: c.get("user").id,
		kind: "withdrawn",
		version: record.version,
	});
	return c.json({ ok: true });
});

capacityRoutes.post("/capacity/records/:id/messages", ...gate, async (c) => {
	const db = c.get("db");
	const record = await findRecord(db, c.get("org").organizationId, c.req.param("id"));
	const access = record && (await accessTo(db, c, record));
	if (!record || !access) return jsonError(c, 404, "NOT_FOUND", NOT_FOUND);
	if (record.reviewStatus === "draft") {
		return jsonError(c, 409, "LOCKED", "Submit it first, then you can message your reviewer.");
	}
	const message = cleanText((await readJson(c.req.raw)).message, { multiline: true });
	if (message.length < 1 || message.length > 2000) {
		return jsonError(c, 400, "INVALID_MESSAGE", "Write a message first.");
	}
	await db.insert(trainingEvents).values({
		recordId: record.id,
		organizationId: record.organizationId,
		actorId: c.get("user").id,
		kind: "message",
		message,
		version: record.version,
	});
	const to = access.as === "owner"
		? access.reviewers.map((person) => person.email)
		: [access.routing.byId.get(record.userId)?.email].filter((email): email is string => !!email);
	notify(c, to, "You have an update on a training record", access.as === "owner" ? "/capacity/reviews" : `/capacity/records/${record.id}`);
	return c.json({ ok: true }, 201);
});

capacityRoutes.post("/capacity/records/:id/evidence", ...gate, async (c) => {
	const db = c.get("db");
	const organizationId = c.get("org").organizationId;
	const record = await findRecord(db, organizationId, c.req.param("id"));
	if (!record || record.userId !== c.get("user").id) return jsonError(c, 404, "NOT_FOUND", NOT_FOUND);
	if (!canEdit(record)) return jsonError(c, 409, "LOCKED", "This record can't be changed right now.");
	const name = cleanText(c.req.query("name"));
	const mimeType = EVIDENCE_TYPES[name.split(".").pop()?.toLowerCase() ?? ""];
	const declaredSize = Number(c.req.header("content-length"));
	if (name.length < 1 || name.length > 300) return jsonError(c, 400, "INVALID_NAME", "That file needs a name.");
	if (!mimeType) return jsonError(c, 400, "TYPE_NOT_ALLOWED", "Use a PDF, JPG or PNG file.");
	if (!Number.isFinite(declaredSize) || declaredSize <= 0 || !c.req.raw.body) {
		return jsonError(c, 400, "EMPTY_FILE", "That file is empty.");
	}
	if (declaredSize > MAX_EVIDENCE_BYTES) return jsonError(c, 413, "FILE_TOO_LARGE", "Files can be up to 10 MB.");
	const existing = await db
		.select({ id: trainingEvidence.id })
		.from(trainingEvidence)
		.where(eq(trainingEvidence.recordId, record.id));
	if (existing.length >= MAX_EVIDENCE_FILES) {
		return jsonError(c, 400, "TOO_MANY_FILES", "A record can have up to 5 files.");
	}
	const [used, limits] = await Promise.all([getStorageUsed(db, organizationId), getOrgLimits(db, organizationId)]);
	if (limits.storageLimitBytes !== null && used + declaredSize > limits.storageLimitBytes) {
		return jsonError(c, 413, "STORAGE_FULL", "Your organization's storage is full.");
	}
	const storageKey = `org/${organizationId}/capacity/${crypto.randomUUID()}`;
	const stored = await c.env.FILES.put(storageKey, c.req.raw.body, { httpMetadata: { contentType: mimeType } });
	try {
		const [created] = await db
			.insert(trainingEvidence)
			.values({
				recordId: record.id,
				organizationId,
				name,
				mimeType,
				sizeBytes: stored.size,
				storageKey,
				uploadedBy: c.get("user").id,
			})
			.returning({ id: trainingEvidence.id });
		return c.json(created, 201);
	} catch (error) {
		await c.env.FILES.delete(storageKey);
		throw error;
	}
});

capacityRoutes.delete("/capacity/records/:id/evidence/:evidenceId", ...gate, async (c) => {
	const db = c.get("db");
	const record = await findRecord(db, c.get("org").organizationId, c.req.param("id"));
	if (!record || record.userId !== c.get("user").id) return jsonError(c, 404, "NOT_FOUND", NOT_FOUND);
	if (!canEdit(record)) return jsonError(c, 409, "LOCKED", "This record can't be changed right now.");
	const [file] = await db
		.select()
		.from(trainingEvidence)
		.where(and(eq(trainingEvidence.id, Number(c.req.param("evidenceId"))), eq(trainingEvidence.recordId, record.id)));
	if (!file) return jsonError(c, 404, "NOT_FOUND", "That file doesn't exist.");
	await db.delete(trainingEvidence).where(eq(trainingEvidence.id, file.id));
	await c.env.FILES.delete(file.storageKey);
	return c.json({ ok: true });
});

// Stays inside AidNova unless someone chooses to download. Whenever anyone but the
// owner opens it, the owner can see that they did.
capacityRoutes.get("/capacity/records/:id/evidence/:evidenceId", ...gate, async (c) => {
	const db = c.get("db");
	const record = await findRecord(db, c.get("org").organizationId, c.req.param("id"));
	const access = record && (await accessTo(db, c, record));
	if (!record || !access) return jsonError(c, 404, "NOT_FOUND", NOT_FOUND);
	const [file] = await db
		.select()
		.from(trainingEvidence)
		.where(and(eq(trainingEvidence.id, Number(c.req.param("evidenceId"))), eq(trainingEvidence.recordId, record.id)));
	const object = file ? await c.env.FILES.get(file.storageKey) : null;
	if (!file || !object) return jsonError(c, 404, "NOT_FOUND", "That file doesn't exist.");
	const download = c.req.query("download") === "1";
	if (access.as === "reviewer") {
		await db.insert(trainingEvents).values({
			recordId: record.id,
			organizationId: record.organizationId,
			actorId: c.get("user").id,
			kind: download ? "evidence_downloaded" : "evidence_viewed",
			version: record.version,
		});
		await writeAudit(db, c, download ? "evidence_downloaded" : "evidence_viewed", String(record.id), {
			sensitive: record.isSensitive,
		});
	}
	const ascii = file.name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
	return new Response(object.body, {
		headers: {
			"Content-Type": file.mimeType,
			"Content-Length": String(object.size),
			"Content-Disposition": `${download ? "attachment" : "inline"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(file.name)}`,
			"Cache-Control": "private, no-store",
			"X-Content-Type-Options": "nosniff",
			"Content-Security-Policy":
				file.mimeType === "application/pdf"
					? "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'self'"
					: "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
		},
	});
});

export async function reviewQueue(
	db: Db,
	organizationId: number,
	userId: string,
	routing: Awaited<ReturnType<typeof loadRouting>>,
) {
	const me = routing.byId.get(userId);
	const isAdmin = me?.role === "admin";
	const namedOnTeam = routing.teams.some((team) => team.reviewerId === userId || team.backupId === userId);
	if (!me || me.role === "staff") return { isReviewer: false, items: [] };
	const records = await db
		.select()
		.from(trainingRecords)
		.where(
			and(
				eq(trainingRecords.organizationId, organizationId),
				inArray(trainingRecords.reviewStatus, ["submitted", "under_review", "changes_requested"]),
			),
		)
		.orderBy(trainingRecords.submittedAt);
	const mine = records.filter((record) =>
		routing.reviewersFor(record.userId).some((person) => person.userId === userId),
	);
	const counts = mine.length
		? await db
				.select({ recordId: trainingEvidence.recordId, total: sql<number>`count(*)` })
				.from(trainingEvidence)
				.where(eq(trainingEvidence.organizationId, organizationId))
				.groupBy(trainingEvidence.recordId)
		: [];
	const evidence = new Map(counts.map((row) => [row.recordId, row.total]));
	return {
		isReviewer: isAdmin || namedOnTeam || mine.length > 0,
		items: mine.map((record) => {
			const evidenceCount = evidence.get(record.id) ?? 0;
			return {
				id: record.id,
				// The list can be seen over a shoulder, so a sensitive name stays out of it.
				title: record.isSensitive ? null : record.title,
				category: record.category,
				isSensitive: record.isSensitive,
				ownerName: routing.byId.get(record.userId)?.name ?? "",
				reviewStatus: record.reviewStatus,
				trainingStatus: record.trainingStatus,
				submittedAt: record.submittedAt,
				version: record.version,
				evidenceCount,
				tab: record.reviewStatus === "changes_requested" ? "sent_back" : "to_review",
			};
		}),
	};
}

capacityRoutes.get("/capacity/reviews", ...gate, requireRole("manager", "admin"), async (c) => {
	const db = c.get("db");
	const organizationId = c.get("org").organizationId;
	const routing = await loadRouting(db, organizationId);
	return c.json(await reviewQueue(db, organizationId, c.get("user").id, routing));
});

capacityRoutes.post("/capacity/reviews/:id/open", ...gate, async (c) => {
	const db = c.get("db");
	const record = await findRecord(db, c.get("org").organizationId, c.req.param("id"));
	const access = record && (await accessTo(db, c, record));
	if (!record || access?.as !== "reviewer") return jsonError(c, 404, "NOT_FOUND", NOT_FOUND);
	// Conditional, so two tabs opening it at once only record it once.
	const started = await db
		.update(trainingRecords)
		.set({ reviewStatus: "under_review" })
		.where(and(eq(trainingRecords.id, record.id), eq(trainingRecords.reviewStatus, "submitted")))
		.returning({ id: trainingRecords.id });
	if (started.length > 0) {
		await db.insert(trainingEvents).values({
			recordId: record.id,
			organizationId: record.organizationId,
			actorId: c.get("user").id,
			kind: "review_started",
			version: record.version,
		});
	}
	if (record.isSensitive) await writeAudit(db, c, "sensitive_opened", String(record.id), { sensitive: true });
	return c.json({ ok: true });
});

const DECISIONS = {
	verify: "verified",
	changes: "changes_requested",
	reject: "rejected",
} as const;

capacityRoutes.post("/capacity/reviews/:id/decision", ...gate, async (c) => {
	const db = c.get("db");
	const record = await findRecord(db, c.get("org").organizationId, c.req.param("id"));
	const access = record && (await accessTo(db, c, record));
	if (!record || access?.as !== "reviewer") return jsonError(c, 404, "NOT_FOUND", NOT_FOUND);
	const body = await readJson(c.req.raw);
	const decision = DECISIONS[body.decision as keyof typeof DECISIONS];
	const comment = cleanText(body.comment, { multiline: true });
	const privateNote = cleanText(body.privateNote, { multiline: true });
	if (!decision || comment.length > 2000 || privateNote.length > 2000) {
		return jsonError(c, 400, "INVALID_DECISION", "Choose a decision.");
	}
	if (decision !== "verified" && comment.length < 1) {
		return jsonError(c, 400, "COMMENT_REQUIRED", "Say what needs to change, or why.");
	}
	if (record.reviewStatus !== "submitted" && record.reviewStatus !== "under_review") {
		return jsonError(c, 409, "ALREADY_DECIDED", "This record has already been decided.");
	}
	if (body.version !== record.version) {
		return jsonError(c, 409, "RECORD_CHANGED", "They changed this while you were reading it.");
	}
	await db
		.update(trainingRecords)
		.set({ reviewStatus: decision, decidedAt: new Date(), decidedBy: c.get("user").id })
		.where(eq(trainingRecords.id, record.id));
	await db.insert(trainingEvents).values({
		recordId: record.id,
		organizationId: record.organizationId,
		actorId: c.get("user").id,
		kind: decision,
		message: comment || null,
		privateNote: privateNote || null,
		version: record.version,
	});
	await writeAudit(db, c, decision, String(record.id), { sensitive: record.isSensitive });
	const owner = access.routing.byId.get(record.userId);
	if (owner) notify(c, [owner.email], "You have an update on a training record", `/capacity/records/${record.id}`);
	return c.json({ ok: true });
});

const adminGate = [...gate, requireRole("admin")] as const;

capacityRoutes.get("/capacity/reviewers", ...adminGate, async (c) => {
	const db = c.get("db");
	const organizationId = c.get("org").organizationId;
	const [routing, teams, waiting] = await Promise.all([
		loadRouting(db, organizationId),
		db
			.select({ id: departments.id, name: departments.name })
			.from(departments)
			.where(eq(departments.organizationId, organizationId))
			.orderBy(departments.name),
		db
			.select({ userId: trainingRecords.userId })
			.from(trainingRecords)
			.where(
				and(
					eq(trainingRecords.organizationId, organizationId),
					inArray(trainingRecords.reviewStatus, ["submitted", "under_review"]),
				),
			),
	]);
	const active = routing.people.filter((person) => person.isActive);
	return c.json({
		teams: teams.map((team) => {
			const saved = routing.teams.find((row) => row.departmentId === team.id);
			const members = active.filter((person) => person.departmentId === team.id);
			const ids = new Set(members.map((person) => person.userId));
			return {
				...team,
				staff: members.length,
				waiting: waiting.filter((row) => ids.has(row.userId)).length,
				reviewerId: saved?.reviewerId ?? null,
				backupId: saved?.backupId ?? null,
			};
		}),
		candidates: active
			.filter((person) => person.role !== "staff")
			.map(({ userId, name, role }) => ({ userId, name, role }))
			.sort((a, b) => a.name.localeCompare(b.name)),
		withoutTeam: active.filter((person) => !person.departmentId).length,
	});
});

capacityRoutes.put("/capacity/reviewers/:departmentId", ...adminGate, async (c) => {
	const db = c.get("db");
	const organizationId = c.get("org").organizationId;
	const departmentId = Number(c.req.param("departmentId"));
	const [team] = await db
		.select({ id: departments.id, name: departments.name })
		.from(departments)
		.where(and(eq(departments.id, departmentId), eq(departments.organizationId, organizationId)));
	if (!team) return jsonError(c, 404, "NOT_FOUND", "That department doesn't exist.");
	const body = await readJson(c.req.raw);
	const reviewerId = typeof body.reviewerId === "string" && body.reviewerId ? body.reviewerId : null;
	const backupId = typeof body.backupId === "string" && body.backupId ? body.backupId : null;
	const people = await loadPeople(db, organizationId);
	const allowed = (id: string | null) =>
		id === null || people.some((person) => person.userId === id && person.isActive && person.role !== "staff");
	if (!allowed(reviewerId) || !allowed(backupId)) {
		return jsonError(c, 400, "INVALID_REVIEWER", "Reviewers must be active managers or admins.");
	}
	if (reviewerId && reviewerId === backupId) {
		return jsonError(c, 400, "SAME_REVIEWER", "Choose a different backup.");
	}
	await db
		.insert(capacityTeamReviewers)
		.values({ organizationId, departmentId, reviewerId, backupId })
		.onConflictDoUpdate({ target: capacityTeamReviewers.departmentId, set: { reviewerId, backupId } });
	await writeAudit(db, c, "reviewers_changed", String(departmentId), { department: team.name });
	return c.json({ ok: true });
});

capacityRoutes.get("/capacity/audit", ...adminGate, async (c) => {
	const entries = await c
		.get("db")
		.select({
			id: auditLog.id,
			action: auditLog.action,
			metadata: auditLog.metadata,
			createdAt: auditLog.createdAt,
			actorName: user.name,
		})
		.from(auditLog)
		.leftJoin(user, eq(auditLog.actorUserId, user.id))
		.where(and(eq(auditLog.organizationId, c.get("org").organizationId), like(auditLog.action, "capacity.%")))
		.orderBy(desc(auditLog.id))
		.limit(100);
	return c.json({ entries });
});

// Unsubmitted drafts are still the person's own, so they're never listed here.
async function reportRecords(db: Db, c: Context<AppEnv>, scope: Scope) {
	const organizationId = c.get("org").organizationId;
	const userId = c.get("user").id;
	const [routing, records] = await Promise.all([
		loadRouting(db, organizationId),
		db
			.select()
			.from(trainingRecords)
			.where(
				and(
					eq(trainingRecords.organizationId, organizationId),
					inArray(trainingRecords.reviewStatus, ["submitted", "under_review", "verified", "changes_requested", "rejected"]),
				),
			)
			.orderBy(desc(trainingRecords.submittedAt)),
	]);
	const myDepartment = routing.byId.get(userId)?.departmentId ?? null;
	const inScope = records.filter((record) => {
		if (scope === "organization") return true;
		if (scope === "team") return routing.reviewersFor(record.userId).some((person) => person.userId === userId);
		return myDepartment !== null && routing.byId.get(record.userId)?.departmentId === myDepartment;
	});
	return { routing, records: inScope };
}

function readScope(c: Context<AppEnv>, value: unknown) {
	const scope = pick(value, SCOPES);
	return scope && reportScopes(c.get("org").role).includes(scope) ? scope : null;
}

capacityRoutes.get("/capacity/report", ...gate, async (c) => {
	const db = c.get("db");
	const scope = readScope(c, c.req.query("scope"));
	if (!scope) return jsonError(c, 403, "FORBIDDEN", "You don't have access to this.");
	const organizationId = c.get("org").organizationId;
	const userId = c.get("user").id;
	const [{ routing, records }, teams, counts] = await Promise.all([
		reportRecords(db, c, scope),
		db.select({ id: departments.id, name: departments.name }).from(departments).where(eq(departments.organizationId, organizationId)),
		db
			.select({ recordId: trainingEvidence.recordId, total: sql<number>`count(*)` })
			.from(trainingEvidence)
			.where(eq(trainingEvidence.organizationId, organizationId))
			.groupBy(trainingEvidence.recordId),
	]);
	const teamNames = new Map(teams.map((team) => [team.id, team.name]));
	const evidence = new Map(counts.map((row) => [row.recordId, row.total]));
	return c.json({
		rows: records.map((record) => {
			const owner = routing.byId.get(record.userId);
			const reviewers = routing.reviewersFor(record.userId);
			const involved = record.userId === userId || reviewers.some((person) => person.userId === userId);
			// Enforced here, not on screen: a sensitive record tells nobody else what or when.
			const restricted = record.isSensitive && !involved;
			return {
				id: record.id,
				ownerName: owner?.name ?? "",
				department: owner?.departmentId ? (teamNames.get(owner.departmentId) ?? null) : null,
				restricted,
				title: restricted ? null : record.title,
				category: restricted ? null : record.category,
				format: restricted ? null : record.format,
				startDate: restricted ? null : record.startDate,
				endDate: restricted ? null : record.endDate,
				durationValue: restricted ? null : record.durationValue,
				durationUnit: record.durationUnit,
				trainingStatus: record.trainingStatus,
				applicationOutcome: restricted ? null : record.applicationOutcome,
				reviewStatus: record.reviewStatus,
				reviewers: reviewers.map((person) => person.name),
				evidenceCount: restricted ? null : (evidence.get(record.id) ?? 0),
			};
		}),
	});
});

capacityRoutes.post("/capacity/report/exported", ...gate, async (c) => {
	const db = c.get("db");
	const body = await readJson(c.req.raw);
	const scope = readScope(c, body.scope);
	if (!scope) return jsonError(c, 403, "FORBIDDEN", "You don't have access to this.");
	await writeAudit(db, c, "report_exported", "report", { scope, count: Number(body.count) || 0 });
	return c.json({ ok: true });
});
