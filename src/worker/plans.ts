import { and, count, eq, gt, isNotNull, sql, sum } from "drizzle-orm";
import { Hono } from "hono";
import type { Db } from "./db";
import {
	auditLog,
	courses,
	invitations,
	lessonMaterials,
	orgFiles,
	organizations,
	subscriptionPlans,
	upgradeRequests,
	userProfiles,
} from "./db/schema";
import {
	jsonError,
	requireOrg,
	requireRole,
	requireUser,
	type AppEnv,
} from "./middleware";
import { cleanText, readJson } from "./validate";

const GB = 1024 * 1024 * 1024;
// Trials get Basic's limits, so open sign-ups can't use unlimited storage.
const TRIAL_MAX_USERS = 50;
const TRIAL_STORAGE_GB = 25;
export const USERS_PER_BLOCK = 25;
export const STORAGE_GB_PER_BLOCK = 10;
export const BLOCK_PRICE_CENTS = 1000;
export const MAX_USER_BLOCKS = 200;

interface LimitInputs {
	maxUsers: number | null | undefined;
	storageLimitGb: number | null | undefined;
	hasPlan: boolean;
	extraUserBlocks: number;
	customMaxUsers: number | null;
	customStorageGb: number | null;
}

// null means no limit. A custom number, for a custom quote, beats everything else.
export function computeLimits(org: LimitInputs) {
	const baseUsers = org.hasPlan ? (org.maxUsers ?? null) : TRIAL_MAX_USERS;
	const baseStorage = org.hasPlan ? (org.storageLimitGb ?? null) : TRIAL_STORAGE_GB;
	const maxUsers =
		org.customMaxUsers ??
		(baseUsers === null ? null : baseUsers + org.extraUserBlocks * USERS_PER_BLOCK);
	const storageGb =
		org.customStorageGb ??
		(baseStorage === null
			? null
			: baseStorage + org.extraUserBlocks * STORAGE_GB_PER_BLOCK);
	return {
		maxUsers,
		storageLimitBytes: storageGb === null ? null : storageGb * GB,
	};
}

export async function getOrgLimits(db: Db, organizationId: number) {
	const [row] = await db
		.select({
			hasPlan: sql<number>`${subscriptionPlans.id} IS NOT NULL`,
			maxUsers: subscriptionPlans.maxUsers,
			storageLimitGb: subscriptionPlans.storageLimitGb,
			extraUserBlocks: organizations.extraUserBlocks,
			customMaxUsers: organizations.customMaxUsers,
			customStorageGb: organizations.customStorageGb,
		})
		.from(organizations)
		.leftJoin(subscriptionPlans, eq(organizations.planId, subscriptionPlans.id))
		.where(eq(organizations.id, organizationId));
	return computeLimits({ ...row, hasPlan: Boolean(row.hasPlan) });
}

// Live invitations count, so a plan can't be overfilled by sending more of them.
// Expired ones can't be accepted, so they don't hold a seat.
export async function getSeatUsage(db: Db, organizationId: number) {
	const [[active], [pending]] = await Promise.all([
		db
			.select({ total: count() })
			.from(userProfiles)
			.where(
				and(
					eq(userProfiles.organizationId, organizationId),
					eq(userProfiles.isActive, true),
				),
			),
		db
			.select({ total: count() })
			.from(invitations)
			.where(
				and(
					eq(invitations.organizationId, organizationId),
					gt(invitations.expiresAt, new Date()),
				),
			),
	]);
	return { active: active.total, pending: pending.total };
}

// Counts everything an organization keeps in storage, including course uploads.
// A file chosen from the Hub has no key of its own, so it isn't counted twice.
export async function getStorageUsed(db: Db, organizationId: number) {
	const [[files], [materials], [covers], [logo], [photos]] = await Promise.all([
		db
			.select({ used: sum(orgFiles.sizeBytes) })
			.from(orgFiles)
			.where(eq(orgFiles.organizationId, organizationId)),
		db
			.select({ used: sum(lessonMaterials.sizeBytes) })
			.from(lessonMaterials)
			.where(
				and(
					eq(lessonMaterials.organizationId, organizationId),
					isNotNull(lessonMaterials.storageKey),
				),
			),
		db
			.select({ used: sum(courses.coverBytes) })
			.from(courses)
			.where(eq(courses.organizationId, organizationId)),
		db
			.select({ used: organizations.logoBytes })
			.from(organizations)
			.where(eq(organizations.id, organizationId)),
		db
			.select({ used: sum(userProfiles.photoBytes) })
			.from(userProfiles)
			.where(eq(userProfiles.organizationId, organizationId)),
	]);
	return [files, materials, covers, logo, photos].reduce(
		(total, row) => total + Number(row?.used ?? 0),
		0,
	);
}

export const planRoutes = new Hono<AppEnv>();

planRoutes.get(
	"/organizations/current/plan",
	requireUser,
	requireOrg,
	requireRole("manager", "admin"),
	async (c) => {
		const db = c.get("db");
		const organizationId = c.get("org").organizationId;
		const [[org], limits, seats, storageUsed, plans, [request]] = await Promise.all([
			db
				.select({
					status: organizations.subscriptionStatus,
					trialEndDate: organizations.trialEndDate,
					billingCycle: organizations.billingCycle,
					extraUserBlocks: organizations.extraUserBlocks,
					paidUntil: organizations.paidUntil,
					planName: subscriptionPlans.name,
				})
				.from(organizations)
				.leftJoin(subscriptionPlans, eq(organizations.planId, subscriptionPlans.id))
				.where(eq(organizations.id, organizationId)),
			getOrgLimits(db, organizationId),
			getSeatUsage(db, organizationId),
			getStorageUsed(db, organizationId),
			db
				.select({
					id: subscriptionPlans.id,
					name: subscriptionPlans.name,
					description: subscriptionPlans.description,
					monthlyPrice: subscriptionPlans.monthlyPrice,
					yearlyPrice: subscriptionPlans.yearlyPrice,
					maxUsers: subscriptionPlans.maxUsers,
					storageLimitGb: subscriptionPlans.storageLimitGb,
				})
				.from(subscriptionPlans)
				.where(eq(subscriptionPlans.isActive, true))
				.orderBy(subscriptionPlans.sortOrder),
			db
				.select({
					planName: subscriptionPlans.name,
					billingCycle: upgradeRequests.billingCycle,
					extraUserBlocks: upgradeRequests.extraUserBlocks,
					createdAt: upgradeRequests.createdAt,
				})
				.from(upgradeRequests)
				.leftJoin(subscriptionPlans, eq(upgradeRequests.planId, subscriptionPlans.id))
				.where(
					and(
						eq(upgradeRequests.organizationId, organizationId),
						eq(upgradeRequests.status, "pending"),
					),
				),
		]);
		return c.json({
			...org,
			...limits,
			seats,
			storageUsed,
			plans,
			pendingRequest: request ?? null,
			blockPriceCents: BLOCK_PRICE_CENTS,
			usersPerBlock: USERS_PER_BLOCK,
		});
	},
);

planRoutes.post(
	"/organizations/current/upgrade-request",
	requireUser,
	requireOrg,
	requireRole("admin"),
	async (c) => {
		const body = await readJson(c.req.raw);
		const db = c.get("db");
		const org = c.get("org");
		const message = cleanText(body.message, { multiline: true });
		const billingCycle = body.billingCycle;
		const extraUserBlocks = body.extraUserBlocks ?? 0;
		if (
			(billingCycle !== "monthly" && billingCycle !== "yearly") ||
			!Number.isInteger(extraUserBlocks) ||
			(extraUserBlocks as number) < 0 ||
			(extraUserBlocks as number) > MAX_USER_BLOCKS ||
			message.length > 1000
		) {
			return jsonError(c, 400, "INVALID_REQUEST", "Check the upgrade details.");
		}
		const [plan] =
			typeof body.planId === "number"
				? await db
						.select({ id: subscriptionPlans.id })
						.from(subscriptionPlans)
						.where(
							and(
								eq(subscriptionPlans.id, body.planId),
								eq(subscriptionPlans.isActive, true),
							),
						)
				: [];
		if (!plan) return jsonError(c, 400, "INVALID_PLAN", "Choose a valid plan.");
		try {
			await db.batch([
				db.insert(upgradeRequests).values({
					organizationId: org.organizationId,
					requestedBy: c.get("user").id,
					planId: plan.id,
					billingCycle,
					extraUserBlocks: extraUserBlocks as number,
					message: message || null,
				}),
				db.insert(auditLog).values({
					organizationId: org.organizationId,
					actorUserId: c.get("user").id,
					action: "upgrade.requested",
					targetType: "plan",
					targetId: String(plan.id),
				}),
			]);
		} catch (error) {
			const text = String(
				(error as { cause?: unknown })?.cause ?? (error as Error)?.message,
			);
			if (text.includes("upgrade_requests")) {
				return jsonError(c, 409, "REQUEST_PENDING", "An upgrade request is already waiting.");
			}
			throw error;
		}
		return c.json({ ok: true }, 201);
	},
);
