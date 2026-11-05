import { and, count, desc, eq } from "drizzle-orm";
import { createMiddleware } from "hono/factory";
import { Hono } from "hono";
import type { Db } from "./db";
import {
	auditLog,
	modulePlatform,
	moduleOverrides,
	organizationModules,
	organizations,
	planModules,
	subscriptionPlans,
	user,
} from "./db/schema";
import {
	jsonError,
	requireOrg,
	requireRole,
	requireSuperAdmin,
	requireUser,
	type AppEnv,
} from "./middleware";
import { activeAddons } from "./addons";
import { cleanText, readJson } from "./validate";

// A safety review is recorded before these can go on, because who attends what
// training, or who has which skills, can put staff at risk in some contexts.
export const MODULES = [
	{ key: "projects", needsReview: false },
	{ key: "capacity_building", needsReview: true },
	{ key: "people_directory", needsReview: true },
] as const;
export type ModuleKey = (typeof MODULES)[number]["key"];

const RELEASES = ["coming_soon", "pilot", "available"] as const;

function isModuleKey(value: string): value is ModuleKey {
	return MODULES.some((module) => module.key === value);
}

export async function organizationModuleStates(db: Db, organizationId: number) {
	const [[org], platform, included, settings, overrides, plans, bought] = await Promise.all([
		db
			.select({
				status: organizations.subscriptionStatus,
				planId: organizations.planId,
			})
			.from(organizations)
			.where(eq(organizations.id, organizationId)),
		db.select().from(modulePlatform),
		db.select().from(planModules),
		db.select().from(organizationModules).where(eq(organizationModules.organizationId, organizationId)),
		db.select().from(moduleOverrides).where(eq(moduleOverrides.organizationId, organizationId)),
		db
			.select({ id: subscriptionPlans.id, name: subscriptionPlans.name })
			.from(subscriptionPlans)
			.where(eq(subscriptionPlans.isActive, true))
			.orderBy(subscriptionPlans.sortOrder),
		activeAddons(db, organizationId),
	]);
	const now = new Date();
	return MODULES.map(({ key, needsReview }) => {
		const state = platform.find((row) => row.moduleKey === key);
		const release = state?.release ?? "coming_soon";
		const paused = state?.paused ?? false;
		const setting = settings.find((row) => row.moduleKey === key);
		const override = overrides.find(
			(row) => row.moduleKey === key && (!row.until || row.until > now),
		);
		const inPlan = included.some((row) => row.moduleKey === key && row.planId === org?.planId);
		const released = release !== "coming_soon";
		const addon = bought.some((row) => row.addonKey === `module:${key}`);
		const source = override
			? ("override" as const)
			: released && addon
				? ("addon" as const)
				: released && org?.status === "trial"
				? ("trial" as const)
				: released && inPlan
					? ("plan" as const)
					: null;
		const entitled = !paused && source !== null;
		const reviewed = !needsReview || Boolean(setting?.reviewAt);
		const enabled = setting?.enabled ?? false;
		return {
			key,
			release,
			paused,
			needsReview,
			entitled,
			source,
			enabled,
			active: entitled && enabled && reviewed,
			overrideUntil: override?.until ?? null,
			reviewAt: setting?.reviewAt ?? null,
			reviewNote: setting?.reviewNote ?? null,
			plans: plans
				.filter((plan) =>
					included.some((row) => row.moduleKey === key && row.planId === plan.id),
				)
				.map((plan) => plan.name),
		};
	});
}

export async function activeModuleKeys(db: Db, organizationId: number) {
	const states = await organizationModuleStates(db, organizationId);
	return states.filter((state) => state.active).map((state) => state.key);
}

// Every optional module's API goes through this, so hiding it from the menu is
// never the only protection. It runs after requireOrg.
export function requireModule(key: ModuleKey) {
	return createMiddleware<AppEnv>(async (c, next) => {
		const active = await activeModuleKeys(c.get("db"), c.get("org").organizationId);
		if (!active.includes(key)) {
			return jsonError(c, 403, "MODULE_OFF", "This module isn't on for your organization.");
		}
		await next();
	});
}

export const moduleRoutes = new Hono<AppEnv>();

moduleRoutes.get(
	"/organizations/current/modules",
	requireUser,
	requireOrg,
	requireRole("manager", "admin"),
	async (c) => {
		const organizationId = c.get("org").organizationId;
		const [modules, [org]] = await Promise.all([
			organizationModuleStates(c.get("db"), organizationId),
			c
				.get("db")
				.select({ status: organizations.subscriptionStatus, trialEndDate: organizations.trialEndDate })
				.from(organizations)
				.where(eq(organizations.id, organizationId)),
		]);
		return c.json({ modules, status: org.status, trialEndDate: org.trialEndDate });
	},
);

moduleRoutes.post(
	"/organizations/current/modules/:key/:action{enable|disable}",
	requireUser,
	requireOrg,
	requireRole("admin"),
	async (c) => {
		const db = c.get("db");
		const organizationId = c.get("org").organizationId;
		const key = c.req.param("key");
		const enable = c.req.param("action") === "enable";
		if (!isModuleKey(key)) return jsonError(c, 404, "NOT_FOUND", "That module doesn't exist.");
		const state = (await organizationModuleStates(db, organizationId)).find((row) => row.key === key);
		if (enable) {
			if (!state?.entitled) {
				return jsonError(c, 409, "NOT_ENTITLED", "This module isn't included in your plan.");
			}
			if (state.needsReview && !state.reviewAt) {
				return jsonError(c, 409, "NEEDS_REVIEW", "Record a privacy and safety review first.");
			}
		}
		// Only the switch changes. No records are touched, so turning it back on restores them.
		await db.batch([
			db
				.insert(organizationModules)
				.values({ organizationId, moduleKey: key, enabled: enable, changedBy: c.get("user").id })
				.onConflictDoUpdate({
					target: [organizationModules.organizationId, organizationModules.moduleKey],
					set: { enabled: enable, changedBy: c.get("user").id, changedAt: new Date() },
				}),
			db.insert(auditLog).values({
				organizationId,
				actorUserId: c.get("user").id,
				action: enable ? "module.enabled" : "module.disabled",
				targetType: "module",
				targetId: key,
			}),
		]);
		return c.json({ ok: true });
	},
);

moduleRoutes.post(
	"/organizations/current/modules/:key/review",
	requireUser,
	requireOrg,
	requireRole("admin"),
	async (c) => {
		const db = c.get("db");
		const organizationId = c.get("org").organizationId;
		const key = c.req.param("key");
		const module = MODULES.find((row) => row.key === key);
		if (!module?.needsReview) return jsonError(c, 404, "NOT_FOUND", "That module doesn't need a review.");
		const body = await readJson(c.req.raw);
		const note = cleanText(body.note, { multiline: true });
		const reviewAt = new Date(String(body.date));
		if (note.length < 1 || note.length > 1000 || Number.isNaN(reviewAt.getTime()) || reviewAt > new Date()) {
			return jsonError(c, 400, "INVALID_REVIEW", "Add the review date and who took part.");
		}
		await db.batch([
			db
				.insert(organizationModules)
				.values({
					organizationId,
					moduleKey: module.key,
					reviewAt,
					reviewNote: note,
					reviewBy: c.get("user").id,
				})
				.onConflictDoUpdate({
					target: [organizationModules.organizationId, organizationModules.moduleKey],
					set: { reviewAt, reviewNote: note, reviewBy: c.get("user").id },
				}),
			db.insert(auditLog).values({
				organizationId,
				actorUserId: c.get("user").id,
				action: "module.review_recorded",
				targetType: "module",
				targetId: module.key,
			}),
		]);
		return c.json({ ok: true });
	},
);

moduleRoutes.use("/superadmin/modules/*", requireUser, requireSuperAdmin);
moduleRoutes.use("/superadmin/modules", requireUser, requireSuperAdmin);
moduleRoutes.use("/superadmin/module-overrides/*", requireUser, requireSuperAdmin);
moduleRoutes.use("/superadmin/module-overrides", requireUser, requireSuperAdmin);
moduleRoutes.use("/superadmin/plan-modules", requireUser, requireSuperAdmin);

moduleRoutes.get("/superadmin/modules", async (c) => {
	const db = c.get("db");
	const [platform, included, plans, on, overrides, settings, [totalOrgs]] = await Promise.all([
		db.select().from(modulePlatform),
		db.select().from(planModules),
		db
			.select({ id: subscriptionPlans.id, name: subscriptionPlans.name })
			.from(subscriptionPlans)
			.orderBy(subscriptionPlans.sortOrder),
		db
			.select({ moduleKey: organizationModules.moduleKey, total: count() })
			.from(organizationModules)
			.where(eq(organizationModules.enabled, true))
			.groupBy(organizationModules.moduleKey),
		db
			.select({
				id: moduleOverrides.id,
				organizationId: moduleOverrides.organizationId,
				organizationName: organizations.name,
				moduleKey: moduleOverrides.moduleKey,
				until: moduleOverrides.until,
				note: moduleOverrides.note,
				grantedByName: user.name,
				createdAt: moduleOverrides.createdAt,
			})
			.from(moduleOverrides)
			.innerJoin(organizations, eq(moduleOverrides.organizationId, organizations.id))
			.leftJoin(user, eq(moduleOverrides.grantedBy, user.id))
			.orderBy(desc(moduleOverrides.createdAt)),
		// Which organizations switched what on, and nothing about their people or records.
		db
			.select({
				organizationId: organizationModules.organizationId,
				organizationName: organizations.name,
				moduleKey: organizationModules.moduleKey,
				enabled: organizationModules.enabled,
				reviewAt: organizationModules.reviewAt,
				changedAt: organizationModules.changedAt,
			})
			.from(organizationModules)
			.innerJoin(organizations, eq(organizationModules.organizationId, organizations.id))
			.orderBy(desc(organizationModules.changedAt))
			.limit(200),
		db.select({ total: count() }).from(organizations),
	]);
	return c.json({
		totalOrganizations: totalOrgs.total,
		modules: MODULES.map(({ key, needsReview }) => {
			const state = platform.find((row) => row.moduleKey === key);
			return {
				key,
				needsReview,
				release: state?.release ?? "coming_soon",
				paused: state?.paused ?? false,
				organizationsOn: on.find((row) => row.moduleKey === key)?.total ?? 0,
			};
		}),
		plans: plans.map((plan) => ({
			...plan,
			modules: included.filter((row) => row.planId === plan.id).map((row) => row.moduleKey),
		})),
		overrides,
		settings,
	});
});

moduleRoutes.patch("/superadmin/modules/:key", async (c) => {
	const db = c.get("db");
	const key = c.req.param("key");
	if (!isModuleKey(key)) return jsonError(c, 404, "NOT_FOUND", "That module doesn't exist.");
	const body = await readJson(c.req.raw);
	const changes: Partial<typeof modulePlatform.$inferInsert> = {};
	if ("release" in body) {
		if (!RELEASES.includes(body.release as (typeof RELEASES)[number])) {
			return jsonError(c, 400, "INVALID_RELEASE", "Choose a valid release stage.");
		}
		changes.release = body.release as (typeof RELEASES)[number];
	}
	if ("paused" in body) {
		if (typeof body.paused !== "boolean") {
			return jsonError(c, 400, "INVALID_PAUSE", "Choose whether it's paused.");
		}
		changes.paused = body.paused;
	}
	if (Object.keys(changes).length === 0) {
		return jsonError(c, 400, "NOTHING_TO_CHANGE", "Nothing to change.");
	}
	await db.batch([
		db
			.insert(modulePlatform)
			.values({ moduleKey: key, ...changes })
			.onConflictDoUpdate({ target: modulePlatform.moduleKey, set: changes }),
		db.insert(auditLog).values({
			actorUserId: c.get("user").id,
			action: "superadmin.module_changed",
			targetType: "module",
			targetId: key,
			metadata: JSON.stringify(changes),
		}),
	]);
	return c.json({ ok: true });
});

moduleRoutes.post("/superadmin/plan-modules", async (c) => {
	const db = c.get("db");
	const { planId, moduleKey, included } = await readJson(c.req.raw);
	if (typeof moduleKey !== "string" || !isModuleKey(moduleKey) || typeof included !== "boolean" || !Number.isInteger(planId)) {
		return jsonError(c, 400, "INVALID_PLAN_MODULE", "Check the plan and module.");
	}
	const [plan] = await db
		.select({ id: subscriptionPlans.id })
		.from(subscriptionPlans)
		.where(eq(subscriptionPlans.id, planId as number));
	if (!plan) return jsonError(c, 404, "NOT_FOUND", "That plan doesn't exist.");
	const write = included
		? db.insert(planModules).values({ planId: plan.id, moduleKey }).onConflictDoNothing()
		: db
				.delete(planModules)
				.where(and(eq(planModules.planId, plan.id), eq(planModules.moduleKey, moduleKey)));
	await db.batch([
		write,
		db.insert(auditLog).values({
			actorUserId: c.get("user").id,
			action: "superadmin.plan_module_changed",
			targetType: "plan",
			targetId: String(plan.id),
			metadata: JSON.stringify({ moduleKey, included }),
		}),
	]);
	return c.json({ ok: true });
});

moduleRoutes.post("/superadmin/module-overrides", async (c) => {
	const db = c.get("db");
	const body = await readJson(c.req.raw);
	const note = cleanText(body.note);
	const until = body.until ? new Date(String(body.until)) : null;
	if (
		!Number.isInteger(body.organizationId) ||
		typeof body.moduleKey !== "string" ||
		!isModuleKey(body.moduleKey) ||
		note.length < 1 ||
		note.length > 500 ||
		(until && Number.isNaN(until.getTime()))
	) {
		return jsonError(c, 400, "INVALID_OVERRIDE", "Check the organization, module and note.");
	}
	const [org] = await db
		.select({ id: organizations.id })
		.from(organizations)
		.where(eq(organizations.id, body.organizationId as number));
	if (!org) return jsonError(c, 404, "NOT_FOUND", "That organization doesn't exist.");
	await db.batch([
		db
			.insert(moduleOverrides)
			.values({
				organizationId: org.id,
				moduleKey: body.moduleKey,
				until,
				note,
				grantedBy: c.get("user").id,
			})
			.onConflictDoUpdate({
				target: [moduleOverrides.organizationId, moduleOverrides.moduleKey],
				set: { until, note, grantedBy: c.get("user").id },
			}),
		db.insert(auditLog).values({
			organizationId: org.id,
			actorUserId: c.get("user").id,
			action: "superadmin.module_granted",
			targetType: "module",
			targetId: body.moduleKey,
		}),
	]);
	return c.json({ ok: true }, 201);
});

moduleRoutes.delete("/superadmin/module-overrides/:id", async (c) => {
	const db = c.get("db");
	const id = Number(c.req.param("id"));
	const removed = Number.isInteger(id)
		? await db.delete(moduleOverrides).where(eq(moduleOverrides.id, id)).returning()
		: [];
	if (removed.length === 0) return jsonError(c, 404, "NOT_FOUND", "That grant doesn't exist.");
	await db.insert(auditLog).values({
		organizationId: removed[0].organizationId,
		actorUserId: c.get("user").id,
		action: "superadmin.module_grant_removed",
		targetType: "module",
		targetId: removed[0].moduleKey,
	});
	return c.json({ ok: true });
});
