import { and, desc, eq, gte, inArray, like, or, sql } from "drizzle-orm";
import { Hono } from "hono";
import {
	COST_PER_MESSAGE,
	COST_PER_MESSAGE_HIGH,
	getAiPlatform,
	periodsAt,
	readLimit,
	readLimits,
	resolveLimits,
} from "./aiLimits";
import { activeAddonFilter, getAddonCatalog } from "./addons";
import { aiOrganizationLimits, aiPlatform, assistantUsage, auditLog, organizationAddons, organizations, subscriptionPlans } from "./db/schema";
import { jsonError, requireSuperAdmin, requireUser, type AppEnv } from "./middleware";
import { cleanText, readJson } from "./validate";

// Counts only. The AidNova team never sees anyone's questions, which aren't saved.
export const superadminAiRoutes = new Hono<AppEnv>();
superadminAiRoutes.use("/superadmin/*", requireUser, requireSuperAdmin);

const LIST_SIZE = 50;

function audit(actorUserId: string, organizationId: number | null, action: string, targetId: string, metadata: unknown) {
	return { organizationId, actorUserId, action, targetType: "ai", targetId, metadata: JSON.stringify(metadata) };
}

superadminAiRoutes.get("/superadmin/ai", async (c) => {
	const db = c.get("db");
	const q = cleanText(c.req.query("q")).slice(0, 100);
	const periods = periodsAt();
	const since = periods.week < periods.month ? periods.week : periods.month;
	const day = periods.day.getTime();
	const week = periods.week.getTime();
	const month = periods.month.getTime();

	const [platform, plans, usage, customRows, [people], catalog, packs] = await Promise.all([
		getAiPlatform(db),
		db.select().from(subscriptionPlans).orderBy(subscriptionPlans.sortOrder, subscriptionPlans.id),
		db
			.select({
				organizationId: assistantUsage.organizationId,
				day: sql<number>`sum(${assistantUsage.createdAt} >= ${day})`,
				week: sql<number>`sum(${assistantUsage.createdAt} >= ${week})`,
				month: sql<number>`sum(${assistantUsage.createdAt} >= ${month})`,
			})
			.from(assistantUsage)
			.where(gte(assistantUsage.createdAt, since))
			.groupBy(assistantUsage.organizationId),
		db.select().from(aiOrganizationLimits),
		db
			.select({ total: sql<number>`count(distinct ${assistantUsage.userId})` })
			.from(assistantUsage)
			.where(gte(assistantUsage.createdAt, periods.month)),
		getAddonCatalog(db),
		db
			.select({ organizationId: organizationAddons.organizationId, quantity: organizationAddons.quantity })
			.from(organizationAddons)
			.where(and(eq(organizationAddons.addonKey, "ai:messages"), activeAddonFilter())),
	]);
	const packSize = catalog.find((item) => item.key === "ai:messages")?.unitSize ?? 0;
	const packMessages = new Map<number, number>();
	for (const row of packs) packMessages.set(row.organizationId, (packMessages.get(row.organizationId) ?? 0) + row.quantity * packSize);
	const used = new Map(usage.map((row) => [row.organizationId, { day: Number(row.day), week: Number(row.week), month: Number(row.month) }]));
	const custom = new Map(customRows.map((row) => [row.organizationId, row]));

	// Searching looks at every organization. Otherwise, the ones using AI this
	// month and the ones with custom limits are the ones worth watching.
	const watched = [...new Set([...usage.filter((row) => Number(row.month) > 0).map((row) => row.organizationId), ...custom.keys()])];
	const where = q ? or(like(organizations.name, `%${q}%`), like(organizations.slug, `%${q}%`)) : watched.length ? inArray(organizations.id, watched) : sql`0`;
	const orgRows = await db
		.select({
			id: organizations.id,
			name: organizations.name,
			planId: organizations.planId,
			planName: subscriptionPlans.name,
			extraUserBlocks: organizations.extraUserBlocks,
			assistantEnabled: organizations.assistantEnabled,
			perDay: subscriptionPlans.aiPerDay,
			perWeek: subscriptionPlans.aiPerWeek,
			perMonth: subscriptionPlans.aiPerMonth,
			perPersonDay: subscriptionPlans.aiPerPersonDay,
		})
		.from(organizations)
		.leftJoin(subscriptionPlans, eq(organizations.planId, subscriptionPlans.id))
		.where(where)
		.orderBy(desc(organizations.createdAt))
		.limit(q ? LIST_SIZE : 1000);

	const list = orgRows
		.map((row) => {
			const hasPlan = row.planId !== null;
			const own = custom.get(row.id);
			const { limits, source } = resolveLimits(
				platform,
				{ hasPlan, extraUserBlocks: row.extraUserBlocks, packMessages: packMessages.get(row.id) ?? 0 },
				hasPlan ? { perDay: row.perDay, perWeek: row.perWeek, perMonth: row.perMonth, perPersonDay: row.perPersonDay } : null,
				own ?? null,
			);
			return {
				id: row.id,
				name: row.name,
				planName: row.planName,
				assistantEnabled: row.assistantEnabled,
				source,
				limits,
				note: own?.note ?? null,
				packMessages: packMessages.get(row.id) ?? 0,
				usage: used.get(row.id) ?? { day: 0, week: 0, month: 0 },
			};
		})
		.sort((a, b) => b.usage.month - a.usage.month || a.name.localeCompare(b.name));

	const totals = usage.reduce(
		(sum, row) => ({ day: sum.day + Number(row.day), week: sum.week + Number(row.week), month: sum.month + Number(row.month) }),
		{ day: 0, week: 0, month: 0 },
	);
	return c.json({
		platform: {
			enabled: platform.enabled,
			trial: { perDay: platform.trialPerDay, perWeek: platform.trialPerWeek, perMonth: platform.trialPerMonth, perPersonDay: platform.trialPerPersonDay },
			perExtraBlock: platform.perExtraBlock,
		},
		plans: plans.map((plan) => ({
			id: plan.id,
			name: plan.name,
			monthlyPrice: plan.monthlyPrice,
			isActive: plan.isActive,
			limits: { perDay: plan.aiPerDay, perWeek: plan.aiPerWeek, perMonth: plan.aiPerMonth, perPersonDay: plan.aiPerPersonDay },
		})),
		totals: { ...totals, organizations: usage.filter((row) => Number(row.month) > 0).length, people: Number(people.total) },
		cost: { perMessage: COST_PER_MESSAGE, perMessageHigh: COST_PER_MESSAGE_HIGH },
		resets: { day: periods.nextDay, week: periods.nextWeek, month: periods.nextMonth },
		organizations: list.slice(0, LIST_SIZE),
		matching: list.length,
	});
});

superadminAiRoutes.put("/superadmin/ai/platform", async (c) => {
	const db = c.get("db");
	const body = await readJson(c.req.raw);
	const trial = readLimits((body.trial ?? {}) as Record<string, unknown>);
	const perExtraBlock = readLimit(body.perExtraBlock);
	if (typeof body.enabled !== "boolean" || !trial || typeof perExtraBlock !== "number") {
		return jsonError(c, 400, "INVALID_LIMITS", "Check the limits. Each one is a whole number, or empty for no limit.");
	}
	const before = await getAiPlatform(db);
	const values = {
		enabled: body.enabled,
		trialPerDay: trial.perDay,
		trialPerWeek: trial.perWeek,
		trialPerMonth: trial.perMonth,
		trialPerPersonDay: trial.perPersonDay,
		perExtraBlock,
		updatedBy: c.get("user").id,
		updatedAt: new Date(),
	};
	await db.batch([
		db.update(aiPlatform).set(values).where(eq(aiPlatform.id, 1)),
		db.insert(auditLog).values(
			audit(c.get("user").id, null, before.enabled === body.enabled ? "ai.platform_limits_changed" : body.enabled ? "ai.resumed" : "ai.paused", "platform", { trial, perExtraBlock }),
		),
	]);
	return c.json({ ok: true });
});

superadminAiRoutes.put("/superadmin/ai/plans/:id", async (c) => {
	const db = c.get("db");
	const limits = readLimits(await readJson(c.req.raw));
	if (!limits) return jsonError(c, 400, "INVALID_LIMITS", "Check the limits. Each one is a whole number, or empty for no limit.");
	const id = Number(c.req.param("id"));
	const updated = await db
		.update(subscriptionPlans)
		.set({ aiPerDay: limits.perDay, aiPerWeek: limits.perWeek, aiPerMonth: limits.perMonth, aiPerPersonDay: limits.perPersonDay })
		.where(eq(subscriptionPlans.id, id))
		.returning({ id: subscriptionPlans.id });
	if (!updated.length) return jsonError(c, 404, "NOT_FOUND", "That plan doesn't exist.");
	await db.insert(auditLog).values(audit(c.get("user").id, null, "ai.plan_limits_changed", String(id), limits));
	return c.json({ ok: true });
});

superadminAiRoutes.put("/superadmin/ai/organizations/:id", async (c) => {
	const db = c.get("db");
	const body = await readJson(c.req.raw);
	const limits = readLimits(body);
	const note = cleanText(body.note).slice(0, 300);
	if (!limits) return jsonError(c, 400, "INVALID_LIMITS", "Check the limits. Each one is a whole number, or empty for no limit.");
	const id = Number(c.req.param("id"));
	const [org] = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.id, id));
	if (!org) return jsonError(c, 404, "NOT_FOUND", "That organization doesn't exist.");
	const values = { ...limits, note: note || null, updatedBy: c.get("user").id, updatedAt: new Date() };
	await db.batch([
		db.insert(aiOrganizationLimits).values({ organizationId: id, ...values }).onConflictDoUpdate({ target: aiOrganizationLimits.organizationId, set: values }),
		db.insert(auditLog).values(audit(c.get("user").id, id, "ai.custom_limits_set", String(id), limits)),
	]);
	return c.json({ ok: true });
});

superadminAiRoutes.delete("/superadmin/ai/organizations/:id", async (c) => {
	const db = c.get("db");
	const id = Number(c.req.param("id"));
	const removed = await db.delete(aiOrganizationLimits).where(eq(aiOrganizationLimits.organizationId, id)).returning({ id: aiOrganizationLimits.organizationId });
	if (!removed.length) return jsonError(c, 404, "NOT_FOUND", "That organization has no custom limits.");
	await db.insert(auditLog).values(audit(c.get("user").id, id, "ai.custom_limits_removed", String(id), null));
	return c.json({ ok: true });
});
