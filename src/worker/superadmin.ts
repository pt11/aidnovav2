import { and, count, desc, eq, gt, isNotNull, lt, or, sql, sum } from "drizzle-orm";
import { Hono } from "hono";
import {
	auditLog,
	courses,
	lessonMaterials,
	orgFiles,
	organizations,
	policies,
	session,
	subscriptionPlans,
	upgradeRequests,
	user,
	userProfiles,
} from "./db/schema";
import {
	jsonError,
	requireSuperAdmin,
	requireUser,
	type AppEnv,
} from "./middleware";
import { computeLimits, MAX_USER_BLOCKS } from "./plans";
import { cleanText, readJson } from "./validate";

const DAY_MS = 24 * 60 * 60 * 1000;
const STATUSES = ["trial", "active", "suspended", "cancelled"] as const;
type Status = (typeof STATUSES)[number];

// Every route here changes or reveals data across all organizations.
export const superadminRoutes = new Hono<AppEnv>();
superadminRoutes.use("/superadmin/*", requireUser, requireSuperAdmin);

function audit(
	actorUserId: string,
	organizationId: number | null,
	action: string,
	targetType: string,
	targetId: string,
	metadata?: unknown,
) {
	return {
		organizationId,
		actorUserId,
		action,
		targetType,
		targetId,
		metadata: metadata === undefined ? null : JSON.stringify(metadata),
	};
}

function toCount(value: unknown): number | null | undefined {
	if (value === undefined) return undefined;
	if (value === null || value === "") return null;
	return typeof value === "number" && Number.isInteger(value) && value >= 0
		? value
		: undefined;
}

function toDate(value: unknown): Date | null | undefined {
	if (value === null || value === "") return null;
	if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
	const date = new Date(`${value}T23:59:59.000Z`);
	return Number.isNaN(date.getTime()) ? undefined : date;
}

superadminRoutes.get("/superadmin/overview", async (c) => {
	const db = c.get("db");
	const monthAgo = new Date(Date.now() - 30 * DAY_MS);
	const weekAhead = new Date(Date.now() + 7 * DAY_MS);
	const [
		orgRows,
		[users],
		[activeUsers],
		[newUsers],
		[newOrgs],
		[storage],
		[materialStorage],
		[coverStorage],
		requests,
		trials,
	] = await Promise.all([
		db
			.select({
				status: organizations.subscriptionStatus,
				plan: subscriptionPlans.name,
				total: count(),
			})
			.from(organizations)
			.leftJoin(subscriptionPlans, eq(organizations.planId, subscriptionPlans.id))
			.groupBy(organizations.subscriptionStatus, subscriptionPlans.name),
		db.select({ total: count() }).from(user),
		db.select({ total: count() }).from(user).where(eq(user.isActive, true)),
		db.select({ total: count() }).from(user).where(gt(user.createdAt, monthAgo)),
		db
			.select({ total: count() })
			.from(organizations)
			.where(gt(organizations.createdAt, monthAgo)),
		db.select({ used: sum(orgFiles.sizeBytes) }).from(orgFiles),
		db
			.select({ used: sum(lessonMaterials.sizeBytes) })
			.from(lessonMaterials)
			.where(isNotNull(lessonMaterials.storageKey)),
		db.select({ used: sum(courses.coverBytes) }).from(courses),
		db
			.select({
				id: upgradeRequests.id,
				organizationId: upgradeRequests.organizationId,
				organizationName: organizations.name,
				planName: subscriptionPlans.name,
				billingCycle: upgradeRequests.billingCycle,
				extraUserBlocks: upgradeRequests.extraUserBlocks,
				createdAt: upgradeRequests.createdAt,
			})
			.from(upgradeRequests)
			.innerJoin(organizations, eq(upgradeRequests.organizationId, organizations.id))
			.leftJoin(subscriptionPlans, eq(upgradeRequests.planId, subscriptionPlans.id))
			.where(eq(upgradeRequests.status, "pending"))
			.orderBy(desc(upgradeRequests.createdAt))
			.limit(5),
		db
			.select({
				id: organizations.id,
				name: organizations.name,
				trialEndDate: organizations.trialEndDate,
			})
			.from(organizations)
			.where(
				and(
					eq(organizations.subscriptionStatus, "trial"),
					lt(organizations.trialEndDate, weekAhead),
				),
			)
			.orderBy(organizations.trialEndDate)
			.limit(8),
	]);
	const statusTotals: Record<Status, number> = {
		trial: 0,
		active: 0,
		suspended: 0,
		cancelled: 0,
	};
	const planTotals = new Map<string, number>();
	for (const row of orgRows) {
		statusTotals[row.status] += row.total;
		if (row.status === "active") {
			const name = row.plan ?? "No plan";
			planTotals.set(name, (planTotals.get(name) ?? 0) + row.total);
		}
	}
	return c.json({
		organizations: statusTotals,
		users: users.total,
		activeUsers: activeUsers.total,
		newUsers: newUsers.total,
		newOrganizations: newOrgs.total,
		storageUsed:
			Number(storage.used ?? 0) +
			Number(materialStorage.used ?? 0) +
			Number(coverStorage.used ?? 0),
		requests,
		trials,
		plans: [...planTotals].map(([name, total]) => ({ name, total })),
	});
});

superadminRoutes.get("/superadmin/organizations", async (c) => {
	const db = c.get("db");
	const [rows, members, files, materials, covers, policyCounts, requests] = await Promise.all([
		db
			.select({
				id: organizations.id,
				name: organizations.name,
				slug: organizations.slug,
				status: organizations.subscriptionStatus,
				trialEndDate: organizations.trialEndDate,
				paidUntil: organizations.paidUntil,
				billingCycle: organizations.billingCycle,
				extraUserBlocks: organizations.extraUserBlocks,
				customMaxUsers: organizations.customMaxUsers,
				customStorageGb: organizations.customStorageGb,
				planId: organizations.planId,
				planName: subscriptionPlans.name,
				planMaxUsers: subscriptionPlans.maxUsers,
				planStorageGb: subscriptionPlans.storageLimitGb,
				createdAt: organizations.createdAt,
				ownerName: user.name,
				ownerEmail: user.email,
			})
			.from(organizations)
			.innerJoin(user, eq(organizations.ownerId, user.id))
			.leftJoin(subscriptionPlans, eq(organizations.planId, subscriptionPlans.id))
			.orderBy(desc(organizations.createdAt)),
		db
			.select({
				organizationId: userProfiles.organizationId,
				active: sql<number>`SUM(CASE WHEN ${userProfiles.isActive} THEN 1 ELSE 0 END)`,
				total: count(),
			})
			.from(userProfiles)
			.groupBy(userProfiles.organizationId),
		db
			.select({
				organizationId: orgFiles.organizationId,
				used: sum(orgFiles.sizeBytes),
				total: count(),
			})
			.from(orgFiles)
			.groupBy(orgFiles.organizationId),
		db
			.select({
				organizationId: lessonMaterials.organizationId,
				used: sum(lessonMaterials.sizeBytes),
			})
			.from(lessonMaterials)
			.where(isNotNull(lessonMaterials.storageKey))
			.groupBy(lessonMaterials.organizationId),
		db
			.select({ organizationId: courses.organizationId, used: sum(courses.coverBytes) })
			.from(courses)
			.groupBy(courses.organizationId),
		db
			.select({ organizationId: policies.organizationId, total: count() })
			.from(policies)
			.groupBy(policies.organizationId),
		db
			.select({
				id: upgradeRequests.id,
				organizationId: upgradeRequests.organizationId,
				planId: upgradeRequests.planId,
				planName: subscriptionPlans.name,
				billingCycle: upgradeRequests.billingCycle,
				extraUserBlocks: upgradeRequests.extraUserBlocks,
				message: upgradeRequests.message,
				createdAt: upgradeRequests.createdAt,
			})
			.from(upgradeRequests)
			.leftJoin(subscriptionPlans, eq(upgradeRequests.planId, subscriptionPlans.id))
			.where(eq(upgradeRequests.status, "pending")),
	]);
	const memberMap = new Map(members.map((row) => [row.organizationId, row]));
	const fileMap = new Map(files.map((row) => [row.organizationId, row]));
	const materialMap = new Map(materials.map((row) => [row.organizationId, row.used]));
	const coverMap = new Map(covers.map((row) => [row.organizationId, row.used]));
	const policyMap = new Map(policyCounts.map((row) => [row.organizationId, row.total]));
	const requestMap = new Map(requests.map((row) => [row.organizationId, row]));
	return c.json({
		organizations: rows.map((row) => {
			const limits = computeLimits({
				hasPlan: row.planId !== null,
				maxUsers: row.planMaxUsers,
				storageLimitGb: row.planStorageGb,
				extraUserBlocks: row.extraUserBlocks,
				customMaxUsers: row.customMaxUsers,
				customStorageGb: row.customStorageGb,
			});
			return {
				...row,
				...limits,
				activeMembers: Number(memberMap.get(row.id)?.active ?? 0),
				members: memberMap.get(row.id)?.total ?? 0,
				storageUsed:
					Number(fileMap.get(row.id)?.used ?? 0) +
					Number(materialMap.get(row.id) ?? 0) +
					Number(coverMap.get(row.id) ?? 0),
				fileCount: fileMap.get(row.id)?.total ?? 0,
				policyCount: policyMap.get(row.id) ?? 0,
				request: requestMap.get(row.id) ?? null,
			};
		}),
	});
});

superadminRoutes.patch("/superadmin/organizations/:id", async (c) => {
	const db = c.get("db");
	const id = Number(c.req.param("id"));
	const body = await readJson(c.req.raw);
	const [existing] = await db
		.select({ id: organizations.id })
		.from(organizations)
		.where(eq(organizations.id, id));
	if (!existing) return jsonError(c, 404, "NOT_FOUND", "That organization doesn't exist.");

	const changes: Partial<typeof organizations.$inferInsert> = {};
	if ("status" in body) {
		if (!STATUSES.includes(body.status as Status)) {
			return jsonError(c, 400, "INVALID_STATUS", "Choose a valid status.");
		}
		changes.subscriptionStatus = body.status as Status;
	}
	if ("billingCycle" in body) {
		if (body.billingCycle !== "monthly" && body.billingCycle !== "yearly") {
			return jsonError(c, 400, "INVALID_CYCLE", "Choose monthly or yearly.");
		}
		changes.billingCycle = body.billingCycle;
	}
	if ("planId" in body) {
		if (body.planId !== null) {
			const [plan] =
				typeof body.planId === "number"
					? await db
							.select({ id: subscriptionPlans.id })
							.from(subscriptionPlans)
							.where(eq(subscriptionPlans.id, body.planId))
					: [];
			if (!plan) return jsonError(c, 400, "INVALID_PLAN", "Choose a valid plan.");
		}
		changes.planId = body.planId as number | null;
	}
	if ("extraUserBlocks" in body) {
		const blocks = toCount(body.extraUserBlocks);
		if (typeof blocks !== "number" || blocks > MAX_USER_BLOCKS) {
			return jsonError(c, 400, "INVALID_BLOCKS", "Enter a valid number of user blocks.");
		}
		changes.extraUserBlocks = blocks;
	}
	for (const field of ["customMaxUsers", "customStorageGb"] as const) {
		if (field in body) {
			const value = toCount(body[field]);
			if (value === undefined) {
				return jsonError(c, 400, "INVALID_LIMIT", "Enter a whole number, or leave it empty.");
			}
			changes[field] = value;
		}
	}
	for (const field of ["paidUntil", "trialEndDate"] as const) {
		if (field in body) {
			const value = toDate(body[field]);
			if (value === undefined) {
				return jsonError(c, 400, "INVALID_DATE", "Enter a valid date.");
			}
			changes[field] = value;
		}
	}
	if (Object.keys(changes).length === 0) {
		return jsonError(c, 400, "NO_CHANGES", "Nothing to change.");
	}
	await db.batch([
		db.update(organizations).set(changes).where(eq(organizations.id, id)),
		db.insert(auditLog).values(
			audit(c.get("user").id, id, "organization.plan_changed", "organization", String(id), body),
		),
	]);
	return c.json({ id });
});

superadminRoutes.post("/superadmin/upgrade-requests/:id/:decision", async (c) => {
	const db = c.get("db");
	const decision = c.req.param("decision");
	if (decision !== "approve" && decision !== "dismiss") {
		return jsonError(c, 404, "NOT_FOUND", "Not found.");
	}
	const id = Number(c.req.param("id"));
	const [request] = await db
		.select()
		.from(upgradeRequests)
		.where(and(eq(upgradeRequests.id, id), eq(upgradeRequests.status, "pending")));
	if (!request) return jsonError(c, 404, "NOT_FOUND", "That request isn't waiting any more.");
	const actor = c.get("user").id;
	const resolve = db
		.update(upgradeRequests)
		.set({
			status: decision === "approve" ? "approved" : "dismissed",
			resolvedAt: new Date(),
			resolvedBy: actor,
		})
		.where(eq(upgradeRequests.id, id));
	const log = db.insert(auditLog).values(
		audit(actor, request.organizationId, `upgrade.${decision}d`, "upgrade_request", String(id)),
	);
	if (decision === "approve") {
		await db.batch([
			resolve,
			db
				.update(organizations)
				.set({
					planId: request.planId,
					billingCycle: request.billingCycle,
					extraUserBlocks: request.extraUserBlocks,
					subscriptionStatus: "active",
				})
				.where(eq(organizations.id, request.organizationId)),
			log,
		]);
	} else {
		await db.batch([resolve, log]);
	}
	return c.json({ id });
});

superadminRoutes.get("/superadmin/users", async (c) => {
	const db = c.get("db");
	const weekAgo = new Date(Date.now() - 7 * DAY_MS);
	const search = cleanText(c.req.query("q")).toLowerCase();
	const pattern = `%${search.replace(/[%_]/g, "")}%`;
	const [rows, memberships, sessions, [totals], [recent], [deactivated], [withoutOrg]] =
		await Promise.all([
			db
				.select({
					id: user.id,
					name: user.name,
					email: user.email,
					isActive: user.isActive,
					isSuperAdmin: user.isSuperAdmin,
					emailVerified: user.emailVerified,
					createdAt: user.createdAt,
				})
				.from(user)
				.where(
					search
						? or(
								sql`lower(${user.name}) LIKE ${pattern}`,
								sql`lower(${user.email}) LIKE ${pattern}`,
							)
						: undefined,
				)
				.orderBy(desc(user.createdAt))
				.limit(200),
			db
				.select({
					userId: userProfiles.userId,
					name: organizations.name,
					role: userProfiles.role,
					isActive: userProfiles.isActive,
				})
				.from(userProfiles)
				.innerJoin(organizations, eq(userProfiles.organizationId, organizations.id)),
			db
				.select({
					userId: session.userId,
					lastActive: sql<number>`MAX(${session.updatedAt})`,
				})
				.from(session)
				.groupBy(session.userId),
			db.select({ total: count() }).from(user),
			db.select({ total: count() }).from(user).where(gt(user.createdAt, weekAgo)),
			db.select({ total: count() }).from(user).where(eq(user.isActive, false)),
			db
				.select({ total: count() })
				.from(user)
				.where(
					sql`NOT EXISTS (SELECT 1 FROM ${userProfiles} WHERE ${userProfiles.userId} = ${user.id})`,
				),
		]);
	const orgMap = new Map<string, { name: string; role: string; isActive: boolean }[]>();
	for (const { userId, ...membership } of memberships) {
		orgMap.set(userId, [...(orgMap.get(userId) ?? []), membership]);
	}
	const lastActive = new Map(sessions.map((row) => [row.userId, row.lastActive]));
	return c.json({
		totals: {
			all: totals.total,
			signedUpThisWeek: recent.total,
			deactivated: deactivated.total,
			withoutOrganization: withoutOrg.total,
		},
		users: rows.map((row) => ({
			...row,
			organizations: orgMap.get(row.id) ?? [],
			lastActive: lastActive.get(row.id) ?? null,
		})),
	});
});

superadminRoutes.patch("/superadmin/users/:id", async (c) => {
	const db = c.get("db");
	const id = c.req.param("id");
	const { isActive } = await readJson(c.req.raw);
	if (typeof isActive !== "boolean") {
		return jsonError(c, 400, "INVALID_STATUS", "Choose a valid status.");
	}
	if (id === c.get("user").id) {
		return jsonError(c, 403, "SELF_LOCKED", "You can't change your own account here.");
	}
	const [target] = await db
		.select({ isSuperAdmin: user.isSuperAdmin })
		.from(user)
		.where(eq(user.id, id));
	if (!target) return jsonError(c, 404, "NOT_FOUND", "That user doesn't exist.");
	if (target.isSuperAdmin) {
		return jsonError(c, 403, "PROTECTED", "Superadmin accounts are protected.");
	}
	const update = db.update(user).set({ isActive }).where(eq(user.id, id));
	const log = db.insert(auditLog).values(
		audit(c.get("user").id, null, isActive ? "user.activated" : "user.deactivated", "user", id),
	);
	// Deactivating signs them out everywhere, straight away.
	if (isActive) await db.batch([update, log]);
	else await db.batch([update, db.delete(session).where(eq(session.userId, id)), log]);
	return c.json({ isActive });
});

superadminRoutes.get("/superadmin/plans", async (c) => {
	const db = c.get("db");
	const [rows, usage] = await Promise.all([
		db.select().from(subscriptionPlans).orderBy(subscriptionPlans.sortOrder, subscriptionPlans.id),
		db
			.select({ planId: organizations.planId, total: count() })
			.from(organizations)
			.groupBy(organizations.planId),
	]);
	const totals = new Map(usage.map((row) => [row.planId, row.total]));
	return c.json({
		plans: rows.map((row) => ({ ...row, organizations: totals.get(row.id) ?? 0 })),
	});
});

function readPlan(body: Record<string, unknown>) {
	const name = cleanText(body.name);
	const description = cleanText(body.description);
	const monthlyPrice = toCount(body.monthlyPrice);
	const yearlyPrice = toCount(body.yearlyPrice);
	const maxUsers = toCount(body.maxUsers);
	const storageLimitGb = toCount(body.storageLimitGb);
	const sortOrder = toCount(body.sortOrder);
	if (
		name.length < 1 ||
		name.length > 100 ||
		description.length > 500 ||
		typeof monthlyPrice !== "number" ||
		typeof yearlyPrice !== "number" ||
		maxUsers === undefined ||
		storageLimitGb === undefined ||
		typeof sortOrder !== "number" ||
		typeof body.isActive !== "boolean"
	) {
		return null;
	}
	return {
		name,
		description: description || null,
		monthlyPrice,
		yearlyPrice,
		maxUsers,
		storageLimitGb,
		sortOrder,
		isActive: body.isActive,
	};
}

superadminRoutes.post("/superadmin/plans", async (c) => {
	const values = readPlan(await readJson(c.req.raw));
	if (!values) return jsonError(c, 400, "INVALID_PLAN", "Check the plan details.");
	const [created] = await c
		.get("db")
		.insert(subscriptionPlans)
		.values(values)
		.returning({ id: subscriptionPlans.id });
	return c.json(created, 201);
});

superadminRoutes.patch("/superadmin/plans/:id", async (c) => {
	const values = readPlan(await readJson(c.req.raw));
	if (!values) return jsonError(c, 400, "INVALID_PLAN", "Check the plan details.");
	const updated = await c
		.get("db")
		.update(subscriptionPlans)
		.set(values)
		.where(eq(subscriptionPlans.id, Number(c.req.param("id"))))
		.returning({ id: subscriptionPlans.id });
	if (!updated.length) return jsonError(c, 404, "NOT_FOUND", "That plan doesn't exist.");
	return c.json(updated[0]);
});

superadminRoutes.delete("/superadmin/plans/:id", async (c) => {
	const db = c.get("db");
	const id = Number(c.req.param("id"));
	const [[onPlan], [requested]] = await Promise.all([
		db.select({ total: count() }).from(organizations).where(eq(organizations.planId, id)),
		db
			.select({ total: count() })
			.from(upgradeRequests)
			.where(and(eq(upgradeRequests.planId, id), eq(upgradeRequests.status, "pending"))),
	]);
	if (onPlan.total + requested.total > 0) {
		return jsonError(c, 409, "PLAN_IN_USE", "Move organizations off this plan first, or turn it off.");
	}
	const deleted = await db
		.delete(subscriptionPlans)
		.where(eq(subscriptionPlans.id, id))
		.returning({ id: subscriptionPlans.id });
	if (!deleted.length) return jsonError(c, 404, "NOT_FOUND", "That plan doesn't exist.");
	return c.json(deleted[0]);
});
