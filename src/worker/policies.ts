import { and, desc, eq, gt, inArray } from "drizzle-orm";
import { Hono } from "hono";
import { getBaseUrl } from "./auth";
import type { Db } from "./db";
import {
	auditLog,
	departments,
	policies,
	policyAccessDepartments,
	policyAcknowledgments,
	policyReminderLog,
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
	type Membership,
} from "./middleware";
import { cleanText, readJson } from "./validate";

const CATEGORIES = [
	"Human Resources",
	"Finance",
	"IT & Security",
	"Operations",
	"Compliance",
	"Health & Safety",
	"General",
];
const STATUSES = ["draft", "published", "archived"] as const;
type Status = (typeof STATUSES)[number];

// Sending happens inside the request, so one click can't run for too long.
// Reminded people are skipped for a day, so clicking again reaches the rest.
const MAX_REMINDERS_PER_REQUEST = 40;
const REMINDER_COOLDOWN_MS = 24 * 60 * 60 * 1000;

const requireManager = requireRole("manager", "admin");

interface Member {
	userId: string;
	name: string;
	email: string;
	departmentId: number | null;
	departmentName: string | null;
}

function isManager(org: Membership) {
	return org.role === "manager" || org.role === "admin";
}

export async function getOwnDepartmentId(db: Db, org: Membership, userId: string) {
	const [profile] = await db
		.select({ departmentId: userProfiles.departmentId })
		.from(userProfiles)
		.where(
			and(
				eq(userProfiles.userId, userId),
				eq(userProfiles.organizationId, org.organizationId),
			),
		);
	return profile?.departmentId ?? null;
}

// Managers see everything. Everyone else sees published policies, limited to
// their department when the policy names departments.
function canRead(
	policy: { status: Status },
	accessIds: number[],
	org: Membership,
	departmentId: number | null,
) {
	if (isManager(org)) return true;
	if (policy.status !== "published") return false;
	return (
		accessIds.length === 0 ||
		(departmentId !== null && accessIds.includes(departmentId))
	);
}

// Who has to acknowledge a policy: everyone in the organization, or the people
// in the departments it names.
function audienceOf(members: Member[], accessIds: number[]) {
	return accessIds.length === 0
		? members
		: members.filter(
				(member) =>
					member.departmentId !== null &&
					accessIds.includes(member.departmentId),
			);
}

function activeMembers(db: Db, organizationId: number): Promise<Member[]> {
	return db
		.select({
			userId: user.id,
			name: user.name,
			email: user.email,
			departmentId: userProfiles.departmentId,
			departmentName: departments.name,
		})
		.from(userProfiles)
		.innerJoin(user, eq(userProfiles.userId, user.id))
		.leftJoin(departments, eq(userProfiles.departmentId, departments.id))
		.where(
			and(
				eq(userProfiles.organizationId, organizationId),
				eq(userProfiles.isActive, true),
			),
		)
		.orderBy(user.name);
}

async function loadAccess(db: Db, organizationId: number) {
	const rows = await db
		.select({
			policyId: policyAccessDepartments.policyId,
			departmentId: departments.id,
			departmentName: departments.name,
		})
		.from(policyAccessDepartments)
		.innerJoin(
			departments,
			eq(policyAccessDepartments.departmentId, departments.id),
		)
		.where(eq(departments.organizationId, organizationId));
	const access = new Map<number, { id: number; name: string }[]>();
	for (const row of rows) {
		const list = access.get(row.policyId) ?? [];
		list.push({ id: row.departmentId, name: row.departmentName });
		access.set(row.policyId, list);
	}
	return access;
}

function loadPolicy(db: Db, id: number, organizationId: number) {
	return db
		.select()
		.from(policies)
		.where(and(eq(policies.id, id), eq(policies.organizationId, organizationId)))
		.then((rows) => rows[0]);
}

// Mandatory policies this person still has to acknowledge, at their current version.
export async function pendingPoliciesFor(
	db: Db,
	org: Membership,
	userId: string,
) {
	const [rows, access, acks, departmentId] = await Promise.all([
		db
			.select({
				id: policies.id,
				title: policies.title,
				version: policies.version,
			})
			.from(policies)
			.where(
				and(
					eq(policies.organizationId, org.organizationId),
					eq(policies.status, "published"),
					eq(policies.isMandatory, true),
				),
			)
			.orderBy(desc(policies.updatedAt)),
		loadAccess(db, org.organizationId),
		db
			.select({
				policyId: policyAcknowledgments.policyId,
				version: policyAcknowledgments.policyVersion,
			})
			.from(policyAcknowledgments)
			.where(eq(policyAcknowledgments.userId, userId)),
		getOwnDepartmentId(db, org, userId),
	]);
	const done = new Set(acks.map((ack) => `${ack.policyId}:${ack.version}`));
	return rows.filter((policy) => {
		const accessIds = (access.get(policy.id) ?? []).map((d) => d.id);
		const required =
			accessIds.length === 0 ||
			(departmentId !== null && accessIds.includes(departmentId));
		return required && !done.has(`${policy.id}:${policy.version}`);
	});
}

// Published policies this person can read. Drafts stay out even for managers,
// because they aren't official yet.
export async function readablePublishedPolicies(
	db: Db,
	org: Membership,
	departmentId: number | null,
) {
	const [rows, access] = await Promise.all([
		db
			.select({
				id: policies.id,
				title: policies.title,
				category: policies.category,
				content: policies.content,
				version: policies.version,
				status: policies.status,
			})
			.from(policies)
			.where(
				and(
					eq(policies.organizationId, org.organizationId),
					eq(policies.status, "published"),
				),
			)
			.orderBy(desc(policies.updatedAt)),
		loadAccess(db, org.organizationId),
	]);
	return rows.filter((policy) =>
		canRead(
			policy,
			(access.get(policy.id) ?? []).map((department) => department.id),
			org,
			departmentId,
		),
	);
}

function parseDate(value: unknown): Date | null | undefined {
	if (value === null || value === undefined || value === "") return null;
	if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
		return undefined;
	}
	const date = new Date(`${value}T00:00:00.000Z`);
	return Number.isNaN(date.getTime()) ? undefined : date;
}

function readPolicy(body: Record<string, unknown>) {
	const title = cleanText(body.title);
	const content = cleanText(body.content, { multiline: true });
	const category = cleanText(body.category);
	const status = body.status as Status;
	const effectiveDate = parseDate(body.effectiveDate);
	const reviewDate = parseDate(body.reviewDate);
	const departmentIds = Array.isArray(body.departmentIds)
		? [...new Set(body.departmentIds)]
		: [];
	if (
		title.length < 1 ||
		title.length > 500 ||
		content.length < 1 ||
		content.length > 100_000 ||
		!CATEGORIES.includes(category) ||
		!STATUSES.includes(status) ||
		typeof body.isMandatory !== "boolean" ||
		effectiveDate === undefined ||
		reviewDate === undefined ||
		!departmentIds.every((id) => typeof id === "number")
	) {
		return null;
	}
	return {
		values: {
			title,
			content,
			category,
			status,
			isMandatory: body.isMandatory,
			effectiveDate,
			reviewDate,
		},
		departmentIds: departmentIds as number[],
	};
}

async function departmentsBelongToOrg(
	db: Db,
	organizationId: number,
	ids: number[],
) {
	if (ids.length === 0) return true;
	const rows = await db
		.select({ id: departments.id })
		.from(departments)
		.where(
			and(
				eq(departments.organizationId, organizationId),
				inArray(departments.id, ids),
			),
		);
	return rows.length === ids.length;
}

export const policyRoutes = new Hono<AppEnv>();

policyRoutes.get("/policies", requireUser, requireOrg, async (c) => {
	const db = c.get("db");
	const org = c.get("org");
	const userId = c.get("user").id;
	const manager = isManager(org);
	const [rows, access, departmentId, members, acks] = await Promise.all([
		db
			.select({
				id: policies.id,
				title: policies.title,
				category: policies.category,
				status: policies.status,
				isMandatory: policies.isMandatory,
				version: policies.version,
				effectiveDate: policies.effectiveDate,
				reviewDate: policies.reviewDate,
				updatedAt: policies.updatedAt,
			})
			.from(policies)
			.where(eq(policies.organizationId, org.organizationId))
			.orderBy(desc(policies.updatedAt), desc(policies.id)),
		loadAccess(db, org.organizationId),
		getOwnDepartmentId(db, org, userId),
		manager ? activeMembers(db, org.organizationId) : Promise.resolve([]),
		db
			.select({
				policyId: policyAcknowledgments.policyId,
				userId: policyAcknowledgments.userId,
				version: policyAcknowledgments.policyVersion,
			})
			.from(policyAcknowledgments)
			.innerJoin(policies, eq(policyAcknowledgments.policyId, policies.id))
			.where(
				manager
					? eq(policies.organizationId, org.organizationId)
					: and(
							eq(policies.organizationId, org.organizationId),
							eq(policyAcknowledgments.userId, userId),
						),
			),
	]);

	const acked = new Set(
		acks.map((ack) => `${ack.policyId}:${ack.version}:${ack.userId}`),
	);
	const visible = rows.flatMap((policy) => {
		const allowed = access.get(policy.id) ?? [];
		const accessIds = allowed.map((department) => department.id);
		if (!canRead(policy, accessIds, org, departmentId)) return [];
		const audience = manager ? audienceOf(members, accessIds) : [];
		return [
			{
				...policy,
				departments: allowed,
				acknowledged: acked.has(`${policy.id}:${policy.version}:${userId}`),
				// Whether this person is someone the policy asks to acknowledge it.
				required:
					accessIds.length === 0 ||
					(departmentId !== null && accessIds.includes(departmentId)),
				compliance: manager
					? {
							total: audience.length,
							acknowledged: audience.filter((member) =>
								acked.has(`${policy.id}:${policy.version}:${member.userId}`),
							).length,
						}
					: null,
			},
		];
	});
	return c.json({ policies: visible });
});

policyRoutes.post(
	"/policies",
	requireUser,
	requireOrg,
	requireManager,
	async (c) => {
		const input = readPolicy(await readJson(c.req.raw));
		if (!input) {
			return jsonError(c, 400, "INVALID_POLICY", "Check the policy details.");
		}
		const db = c.get("db");
		const org = c.get("org");
		const userId = c.get("user").id;
		if (
			!(await departmentsBelongToOrg(db, org.organizationId, input.departmentIds))
		) {
			return jsonError(c, 400, "INVALID_DEPARTMENT", "Choose valid departments.");
		}

		// Starts as a draft so a restricted policy is never visible to everyone,
		// even if saving its departments fails.
		const [created] = await db
			.insert(policies)
			.values({
				...input.values,
				status: "draft",
				organizationId: org.organizationId,
				createdBy: userId,
			})
			.returning({ id: policies.id });
		const publish = db
			.update(policies)
			.set({ status: input.values.status })
			.where(eq(policies.id, created.id));
		const audit = db.insert(auditLog).values({
			organizationId: org.organizationId,
			actorUserId: userId,
			action: "policy.created",
			targetType: "policy",
			targetId: String(created.id),
		});
		if (input.departmentIds.length) {
			await db.batch([
				db.insert(policyAccessDepartments).values(
					input.departmentIds.map((departmentId) => ({
						policyId: created.id,
						departmentId,
					})),
				),
				publish,
				audit,
			]);
		} else {
			await db.batch([publish, audit]);
		}
		return c.json(created, 201);
	},
);

policyRoutes.get("/policies/:id", requireUser, requireOrg, async (c) => {
	const db = c.get("db");
	const org = c.get("org");
	const userId = c.get("user").id;
	const policy = await loadPolicy(db, Number(c.req.param("id")), org.organizationId);
	if (!policy) return jsonError(c, 404, "NOT_FOUND", "That policy doesn't exist.");
	const [access, departmentId] = await Promise.all([
		loadAccess(db, org.organizationId),
		getOwnDepartmentId(db, org, userId),
	]);
	const allowed = access.get(policy.id) ?? [];
	const accessIds = allowed.map((department) => department.id);
	// The same answer as a missing policy, so its existence isn't revealed.
	if (!canRead(policy, accessIds, org, departmentId)) {
		return jsonError(c, 404, "NOT_FOUND", "That policy doesn't exist.");
	}
	const [ack] = await db
		.select({ acknowledgedAt: policyAcknowledgments.acknowledgedAt })
		.from(policyAcknowledgments)
		.where(
			and(
				eq(policyAcknowledgments.policyId, policy.id),
				eq(policyAcknowledgments.userId, userId),
				eq(policyAcknowledgments.policyVersion, policy.version),
			),
		);
	return c.json({
		id: policy.id,
		title: policy.title,
		category: policy.category,
		content: policy.content,
		status: policy.status,
		isMandatory: policy.isMandatory,
		version: policy.version,
		effectiveDate: policy.effectiveDate,
		reviewDate: policy.reviewDate,
		updatedAt: policy.updatedAt,
		departments: allowed,
		acknowledgedAt: ack?.acknowledgedAt ?? null,
	});
});

policyRoutes.patch(
	"/policies/:id",
	requireUser,
	requireOrg,
	requireManager,
	async (c) => {
		const input = readPolicy(await readJson(c.req.raw));
		if (!input) {
			return jsonError(c, 400, "INVALID_POLICY", "Check the policy details.");
		}
		const db = c.get("db");
		const org = c.get("org");
		const existing = await loadPolicy(
			db,
			Number(c.req.param("id")),
			org.organizationId,
		);
		if (!existing) {
			return jsonError(c, 404, "NOT_FOUND", "That policy doesn't exist.");
		}
		if (
			!(await departmentsBelongToOrg(db, org.organizationId, input.departmentIds))
		) {
			return jsonError(c, 400, "INVALID_DEPARTMENT", "Choose valid departments.");
		}

		// Once people may have read it, a change to the wording is a new version,
		// and earlier acknowledgments no longer count.
		const reworded =
			existing.title !== input.values.title ||
			existing.content !== input.values.content;
		const version =
			existing.status !== "draft" && reworded
				? existing.version + 1
				: existing.version;
		const update = db
			.update(policies)
			.set({ ...input.values, version, updatedAt: new Date() })
			.where(eq(policies.id, existing.id));
		const clearAccess = db
			.delete(policyAccessDepartments)
			.where(eq(policyAccessDepartments.policyId, existing.id));
		const audit = db.insert(auditLog).values({
			organizationId: org.organizationId,
			actorUserId: c.get("user").id,
			action: "policy.updated",
			targetType: "policy",
			targetId: String(existing.id),
			metadata: JSON.stringify({ version, status: input.values.status }),
		});
		if (input.departmentIds.length) {
			await db.batch([
				clearAccess,
				db.insert(policyAccessDepartments).values(
					input.departmentIds.map((departmentId) => ({
						policyId: existing.id,
						departmentId,
					})),
				),
				update,
				audit,
			]);
		} else {
			await db.batch([clearAccess, update, audit]);
		}
		return c.json({ id: existing.id, version });
	},
);

policyRoutes.delete(
	"/policies/:id",
	requireUser,
	requireOrg,
	requireManager,
	async (c) => {
		const db = c.get("db");
		const org = c.get("org");
		const existing = await loadPolicy(
			db,
			Number(c.req.param("id")),
			org.organizationId,
		);
		if (!existing) {
			return jsonError(c, 404, "NOT_FOUND", "That policy doesn't exist.");
		}
		await db.batch([
			db.delete(policies).where(eq(policies.id, existing.id)),
			db.insert(auditLog).values({
				organizationId: org.organizationId,
				actorUserId: c.get("user").id,
				action: "policy.deleted",
				targetType: "policy",
				targetId: String(existing.id),
				metadata: JSON.stringify({ title: existing.title }),
			}),
		]);
		return c.json({ id: existing.id });
	},
);

policyRoutes.post(
	"/policies/:id/acknowledge",
	requireUser,
	requireOrg,
	async (c) => {
		const { version } = await readJson(c.req.raw);
		const db = c.get("db");
		const org = c.get("org");
		const userId = c.get("user").id;
		const policy = await loadPolicy(
			db,
			Number(c.req.param("id")),
			org.organizationId,
		);
		const [access, departmentId] = await Promise.all([
			loadAccess(db, org.organizationId),
			getOwnDepartmentId(db, org, userId),
		]);
		const accessIds = policy
			? (access.get(policy.id) ?? []).map((department) => department.id)
			: [];
		if (!policy || !canRead(policy, accessIds, org, departmentId)) {
			return jsonError(c, 404, "NOT_FOUND", "That policy doesn't exist.");
		}
		if (policy.status !== "published") {
			return jsonError(c, 409, "NOT_PUBLISHED", "That policy isn't published.");
		}
		// The version they read. If it changed meanwhile, they must read the new one.
		if (version !== policy.version) {
			return jsonError(c, 409, "POLICY_CHANGED", "This policy has changed. Please read the new version.");
		}
		await db
			.insert(policyAcknowledgments)
			.values({ policyId: policy.id, userId, policyVersion: policy.version })
			.onConflictDoNothing();
		return c.json({ version: policy.version });
	},
);

policyRoutes.get(
	"/policies/:id/compliance",
	requireUser,
	requireOrg,
	requireManager,
	async (c) => {
		const db = c.get("db");
		const org = c.get("org");
		const policy = await loadPolicy(
			db,
			Number(c.req.param("id")),
			org.organizationId,
		);
		if (!policy) return jsonError(c, 404, "NOT_FOUND", "That policy doesn't exist.");
		const [members, access, acks, reminders] = await Promise.all([
			activeMembers(db, org.organizationId),
			loadAccess(db, org.organizationId),
			db
				.select({
					userId: policyAcknowledgments.userId,
					acknowledgedAt: policyAcknowledgments.acknowledgedAt,
				})
				.from(policyAcknowledgments)
				.where(
					and(
						eq(policyAcknowledgments.policyId, policy.id),
						eq(policyAcknowledgments.policyVersion, policy.version),
					),
				),
			db
				.select({
					userId: policyReminderLog.userId,
					sentAt: policyReminderLog.sentAt,
				})
				.from(policyReminderLog)
				.where(eq(policyReminderLog.policyId, policy.id))
				.orderBy(desc(policyReminderLog.sentAt)),
		]);
		const ackAt = new Map(acks.map((ack) => [ack.userId, ack.acknowledgedAt]));
		const remindedAt = new Map<string, Date>();
		for (const reminder of reminders) {
			if (!remindedAt.has(reminder.userId)) {
				remindedAt.set(reminder.userId, reminder.sentAt);
			}
		}
		const accessIds = (access.get(policy.id) ?? []).map((d) => d.id);
		return c.json({
			version: policy.version,
			people: audienceOf(members, accessIds).map((member) => ({
				userId: member.userId,
				name: member.name,
				email: member.email,
				departmentName: member.departmentName,
				acknowledgedAt: ackAt.get(member.userId) ?? null,
				remindedAt: remindedAt.get(member.userId) ?? null,
			})),
		});
	},
);

policyRoutes.post(
	"/policies/:id/remind",
	requireUser,
	requireOrg,
	requireManager,
	async (c) => {
		const body = await readJson(c.req.raw);
		const db = c.get("db");
		const org = c.get("org");
		const policy = await loadPolicy(
			db,
			Number(c.req.param("id")),
			org.organizationId,
		);
		if (!policy) return jsonError(c, 404, "NOT_FOUND", "That policy doesn't exist.");
		if (policy.status !== "published" || !policy.isMandatory) {
			return jsonError(c, 409, "NOT_REMINDABLE", "Only published, mandatory policies can have reminders.");
		}
		const since = new Date(Date.now() - REMINDER_COOLDOWN_MS);
		const [members, access, acks, recent] = await Promise.all([
			activeMembers(db, org.organizationId),
			loadAccess(db, org.organizationId),
			db
				.select({ userId: policyAcknowledgments.userId })
				.from(policyAcknowledgments)
				.where(
					and(
						eq(policyAcknowledgments.policyId, policy.id),
						eq(policyAcknowledgments.policyVersion, policy.version),
					),
				),
			db
				.select({ userId: policyReminderLog.userId })
				.from(policyReminderLog)
				.where(
					and(
						eq(policyReminderLog.policyId, policy.id),
						gt(policyReminderLog.sentAt, since),
					),
				),
		]);
		const accessIds = (access.get(policy.id) ?? []).map((d) => d.id);
		const acknowledged = new Set(acks.map((ack) => ack.userId));
		const remindedRecently = new Set(recent.map((row) => row.userId));
		const requested = Array.isArray(body.userIds)
			? new Set(body.userIds)
			: null;
		const pending = audienceOf(members, accessIds).filter(
			(member) =>
				!acknowledged.has(member.userId) &&
				(!requested || requested.has(member.userId)),
		);
		const eligible = pending.filter(
			(member) => !remindedRecently.has(member.userId),
		);
		const batch = eligible.slice(0, MAX_REMINDERS_PER_REQUEST);

		const url = `${getBaseUrl(c.env, c.req.raw)}/policies/${policy.id}`;
		const orgName = cleanText(org.name);
		const title = cleanText(policy.title);
		const results = await Promise.allSettled(
			batch.map((member) =>
				sendEmail(c.env, {
					to: member.email,
					subject: `Please acknowledge: ${title}`,
					text: `${orgName} asks you to read and acknowledge "${title}" on AidNova.\n\n${url}`,
				}),
			),
		);
		const sent = batch.filter((_, index) => {
			const result = results[index];
			if (result.status === "rejected") console.error(result.reason);
			return result.status === "fulfilled";
		});
		if (sent.length) {
			await db.insert(policyReminderLog).values(
				sent.map((member) => ({
					policyId: policy.id,
					userId: member.userId,
					sentBy: c.get("user").id,
				})),
			);
		}
		return c.json({
			sent: sent.length,
			failed: batch.length - sent.length,
			skipped: pending.length - eligible.length,
			remaining: eligible.length - batch.length,
		});
	},
);
