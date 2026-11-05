import { and, eq, gte, sql } from "drizzle-orm";
import { extraAiMessages } from "./addons";
import type { Db } from "./db";
import { aiOrganizationLimits, aiPlatform, assistantUsage, organizations, subscriptionPlans } from "./db/schema";

// Measured on 2026-11-05 with SEA-LION on Workers AI: English questions read about
// 4,400 tokens and Burmese ones about 7,000, with short answers. The high figure
// allows for a long conversation and a long answer. Used for estimates only.
export const COST_PER_MESSAGE = 0.0025;
export const COST_PER_MESSAGE_HIGH = 0.006;

// Limits follow the calendar in Myanmar, which has no daylight saving.
const MYANMAR_OFFSET_MS = 6.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface AiLimits {
	perDay: number | null;
	perWeek: number | null;
	perMonth: number | null;
	perPersonDay: number | null;
}

export type LimitSource = "custom" | "plan" | "trial";

export const PERIODS = ["perDay", "perWeek", "perMonth", "perPersonDay"] as const;

// When each period started, and when the next one starts, as real instants.
export function periodsAt(now = Date.now()) {
	const local = new Date(now + MYANMAR_OFFSET_MS);
	const dayStart = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
	const weekStart = dayStart - ((local.getUTCDay() + 6) % 7) * DAY_MS;
	const monthStart = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1);
	const nextMonth = Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + 1, 1);
	const real = (value: number) => new Date(value - MYANMAR_OFFSET_MS);
	return {
		day: real(dayStart),
		week: real(weekStart),
		month: real(monthStart),
		nextDay: real(dayStart + DAY_MS),
		nextWeek: real(weekStart + 7 * DAY_MS),
		nextMonth: real(nextMonth),
	};
}

export async function getAiPlatform(db: Db) {
	const [row] = await db.select().from(aiPlatform).where(eq(aiPlatform.id, 1));
	if (row) return row;
	// The migration adds the row. This keeps a fresh database working anyway.
	const [created] = await db.insert(aiPlatform).values({ id: 1 }).onConflictDoNothing().returning();
	return created ?? (await db.select().from(aiPlatform).where(eq(aiPlatform.id, 1)))[0];
}

type Platform = Awaited<ReturnType<typeof getAiPlatform>>;

export function trialLimits(platform: Platform): AiLimits {
	return {
		perDay: platform.trialPerDay,
		perWeek: platform.trialPerWeek,
		perMonth: platform.trialPerMonth,
		perPersonDay: platform.trialPerPersonDay,
	};
}

// Custom limits beat the plan's. Without a plan, an organization is on trial.
// Extra user blocks add to the monthly allowance, as they add users and storage.
// Message packs are paid for, so they add to the month whatever the limits come from.
export function resolveLimits(
	platform: Platform,
	org: { hasPlan: boolean; extraUserBlocks: number; packMessages?: number },
	plan: AiLimits | null,
	custom: AiLimits | null,
): { limits: AiLimits; source: LimitSource } {
	const add = (limits: AiLimits, extra: number) => ({
		...limits,
		perMonth: limits.perMonth === null ? null : limits.perMonth + extra,
	});
	const packs = org.packMessages ?? 0;
	if (custom) {
		const { perDay, perWeek, perMonth, perPersonDay } = custom;
		return { limits: add({ perDay, perWeek, perMonth, perPersonDay }, packs), source: "custom" };
	}
	if (!org.hasPlan || !plan) return { limits: add(trialLimits(platform), packs), source: "trial" };
	return { limits: add(plan, org.extraUserBlocks * platform.perExtraBlock + packs), source: "plan" };
}

export async function getOrgAiLimits(db: Db, organizationId: number, platform?: Platform) {
	const [settings, [row], [custom], packMessages] = await Promise.all([
		platform ?? getAiPlatform(db),
		db
			.select({
				planId: subscriptionPlans.id,
				planName: subscriptionPlans.name,
				extraUserBlocks: organizations.extraUserBlocks,
				perDay: subscriptionPlans.aiPerDay,
				perWeek: subscriptionPlans.aiPerWeek,
				perMonth: subscriptionPlans.aiPerMonth,
				perPersonDay: subscriptionPlans.aiPerPersonDay,
			})
			.from(organizations)
			.leftJoin(subscriptionPlans, eq(organizations.planId, subscriptionPlans.id))
			.where(eq(organizations.id, organizationId)),
		db.select().from(aiOrganizationLimits).where(eq(aiOrganizationLimits.organizationId, organizationId)),
		extraAiMessages(db, organizationId),
	]);
	const hasPlan = row?.planId != null;
	const resolved = resolveLimits(
		settings,
		{ hasPlan, extraUserBlocks: row?.extraUserBlocks ?? 0, packMessages },
		hasPlan ? { perDay: row.perDay, perWeek: row.perWeek, perMonth: row.perMonth, perPersonDay: row.perPersonDay } : null,
		custom ?? null,
	);
	return { ...resolved, planName: hasPlan ? row.planName : null, note: custom?.note ?? null, enabled: settings.enabled, packMessages };
}

// Messages since the start of today, this week and this month, for one organization.
export async function getOrgAiUsage(db: Db, organizationId: number, now = Date.now()) {
	const periods = periodsAt(now);
	const since = periods.week < periods.month ? periods.week : periods.month;
	const [row] = await db
		.select({
			day: sql<number>`coalesce(sum(${assistantUsage.createdAt} >= ${periods.day.getTime()}), 0)`,
			week: sql<number>`coalesce(sum(${assistantUsage.createdAt} >= ${periods.week.getTime()}), 0)`,
			month: sql<number>`coalesce(sum(${assistantUsage.createdAt} >= ${periods.month.getTime()}), 0)`,
		})
		.from(assistantUsage)
		.where(and(eq(assistantUsage.organizationId, organizationId), gte(assistantUsage.createdAt, since)));
	return { day: Number(row.day), week: Number(row.week), month: Number(row.month), periods };
}

export async function getPersonAiUsageToday(db: Db, organizationId: number, userId: string, now = Date.now()) {
	const [row] = await db
		.select({ total: sql<number>`count(*)` })
		.from(assistantUsage)
		.where(
			and(
				eq(assistantUsage.organizationId, organizationId),
				eq(assistantUsage.userId, userId),
				gte(assistantUsage.createdAt, periodsAt(now).day),
			),
		);
	return Number(row.total);
}

export type LimitReached = "ASSISTANT_PAUSED" | "ASSISTANT_LIMIT_PERSON" | "ASSISTANT_LIMIT_DAY" | "ASSISTANT_LIMIT_WEEK" | "ASSISTANT_LIMIT_MONTH";

// The first limit this person has reached, or null if they can ask.
export async function checkAiAllowance(db: Db, organizationId: number, userId: string): Promise<LimitReached | null> {
	const { limits, enabled } = await getOrgAiLimits(db, organizationId);
	if (!enabled) return "ASSISTANT_PAUSED";
	const [usage, mine] = await Promise.all([
		getOrgAiUsage(db, organizationId),
		limits.perPersonDay === null ? Promise.resolve(0) : getPersonAiUsageToday(db, organizationId, userId),
	]);
	if (limits.perPersonDay !== null && mine >= limits.perPersonDay) return "ASSISTANT_LIMIT_PERSON";
	if (limits.perDay !== null && usage.day >= limits.perDay) return "ASSISTANT_LIMIT_DAY";
	if (limits.perWeek !== null && usage.week >= limits.perWeek) return "ASSISTANT_LIMIT_WEEK";
	if (limits.perMonth !== null && usage.month >= limits.perMonth) return "ASSISTANT_LIMIT_MONTH";
	return null;
}

// A limit from a form: a whole number from 0 to a million, or empty for no limit.
export function readLimit(value: unknown): number | null | undefined {
	if (value === null || value === "") return null;
	return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 1_000_000 ? value : undefined;
}

export function readLimits(body: Record<string, unknown>): AiLimits | null {
	const values = PERIODS.map((key) => readLimit(body[key]));
	if (values.some((value) => value === undefined)) return null;
	const [perDay, perWeek, perMonth, perPersonDay] = values as (number | null)[];
	return { perDay, perWeek, perMonth, perPersonDay };
}
