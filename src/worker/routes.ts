import { activeModuleKeys } from "./modules";
import { memberCourseStats } from "./courses";
import { memberPolicyStats } from "./policies";
import { memberPhotoUrl } from "./media";
import { and, count, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import {
	auditLog,
	departments,
	organizations,
	user,
	userProfiles,
} from "./db/schema";
import {
	getMemberships,
	getOrgAccess,
	jsonError,
	pickActiveMembership,
	requireOrg,
	requireRole,
	requireSuperAdmin,
	requireUser,
	setActiveOrgCookie,
	type AppEnv,
	type Role,
} from "./middleware";
import { cleanText, readJson } from "./validate";

const TRIAL_DAYS = 14;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ROLES: Role[] = ["staff", "manager", "admin"];

export const api = new Hono<AppEnv>();

api.get("/config", (c) =>
	c.json({ turnstileSiteKey: c.env.TURNSTILE_SITE_KEY || null }),
);

api.get("/me", requireUser, async (c) => {
	const currentUser = c.get("user");
	const memberships = await getMemberships(c.get("db"), currentUser.id);
	const active = pickActiveMembership(c, memberships);
	return c.json({
		user: currentUser,
		activeOrganizationId: active?.organizationId ?? null,
		activeModules: active ? await activeModuleKeys(c.get("db"), active.organizationId) : [],
		memberships: memberships.map(({ ownerId: _ownerId, photoKey, ...membership }) => ({
			...membership,
			photoUrl: memberPhotoUrl(currentUser.id, photoKey),
			access: getOrgAccess({ ...membership, photoKey, ownerId: _ownerId }),
		})),
	});
});

api.post("/organizations", requireUser, async (c) => {
	const body = await readJson(c.req.raw);
	const name = cleanText(body.name);
	const slug = typeof body.slug === "string" ? body.slug.trim() : "";
	if (name.length < 2 || name.length > 255) {
		return jsonError(c, 400, "INVALID_NAME", "Enter an organization name.");
	}
	if (slug.length < 2 || slug.length > 63 || !SLUG_PATTERN.test(slug)) {
		return jsonError(
			c,
			400,
			"INVALID_SLUG",
			"Use lowercase letters, numbers and hyphens.",
		);
	}

	const db = c.get("db");
	const userId = c.get("user").id;
	const now = new Date();
	const trialEndDate = new Date(
		now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000,
	);

	// A batch is atomic, so an organization can't exist without its admin.
	// The new id is looked up by owner, which the schema keeps unique.
	const newOrgId = sql<number>`(SELECT id FROM organizations WHERE owner_id = ${userId})`;
	try {
		await db.batch([
			db.insert(organizations).values({
				name,
				slug,
				ownerId: userId,
				trialStartDate: now,
				trialEndDate,
				subscriptionStatus: "trial",
			}),
			db.insert(userProfiles).values({
				userId,
				organizationId: newOrgId,
				role: "admin",
			}),
			db.insert(auditLog).values({
				organizationId: newOrgId,
				actorUserId: userId,
				action: "organization.created",
				targetType: "organization",
				targetId: sql`CAST(${newOrgId} AS TEXT)`,
			}),
		]);
	} catch (error) {
		const text = String(
			(error as { cause?: unknown })?.cause ?? (error as Error)?.message,
		);
		if (text.includes("organizations.owner_id")) {
			return jsonError(c, 409, "ALREADY_OWNER", "You already own an organization.");
		}
		if (text.includes("organizations.slug")) {
			return jsonError(c, 409, "SLUG_TAKEN", "That URL identifier is taken.");
		}
		throw error;
	}

	const [created] = await db
		.select({ id: organizations.id })
		.from(organizations)
		.where(eq(organizations.ownerId, userId));
	setActiveOrgCookie(c, created.id);
	return c.json({ id: created.id }, 201);
});

api.post("/organizations/switch", requireUser, async (c) => {
	const { organizationId } = await readJson(c.req.raw);
	const memberships = await getMemberships(c.get("db"), c.get("user").id);
	const target = memberships.find((m) => m.organizationId === organizationId);
	if (!target) {
		return jsonError(c, 403, "NOT_A_MEMBER", "You aren't a member of that organization.");
	}
	setActiveOrgCookie(c, target.organizationId);
	return c.json({ activeOrganizationId: target.organizationId });
});

api.get(
	"/organizations/current/members",
	requireUser,
	requireOrg,
	requireRole("manager", "admin"),
	async (c) => {
		const members = await c
			.get("db")
			.select({
				userId: user.id,
				name: user.name,
				email: user.email,
				role: userProfiles.role,
				isActive: userProfiles.isActive,
				departmentId: userProfiles.departmentId,
				departmentName: departments.name,
				photoKey: userProfiles.photoKey,
				joinedAt: userProfiles.joinedAt,
			})
			.from(userProfiles)
			.innerJoin(user, eq(userProfiles.userId, user.id))
			.leftJoin(
				departments,
				and(
					eq(userProfiles.departmentId, departments.id),
					eq(departments.organizationId, c.get("org").organizationId),
				),
			)
			.where(eq(userProfiles.organizationId, c.get("org").organizationId))
			.orderBy(user.name);
		const organizationId = c.get("org").organizationId;
		const [policyStats, courseStats] = await Promise.all([
			memberPolicyStats(c.get("db"), organizationId),
			memberCourseStats(c.get("db"), organizationId),
		]);
		return c.json({
			members: members.map(({ photoKey, ...member }) => ({
				...member,
				photoUrl: memberPhotoUrl(member.userId, photoKey),
				policies: policyStats.get(member.userId) ?? { done: 0, total: 0 },
				learning: courseStats.get(member.userId) ?? { total: 0, completed: 0 },
			})),
			ownerId: c.get("org").ownerId,
		});
	},
);

api.patch(
	"/organizations/current/members/:userId/role",
	requireUser,
	requireOrg,
	requireRole("admin"),
	async (c) => {
		const { role } = await readJson(c.req.raw);
		if (!ROLES.includes(role as Role)) {
			return jsonError(c, 400, "INVALID_ROLE", "Choose a valid role.");
		}
		const org = c.get("org");
		const targetUserId = c.req.param("userId");
		if (targetUserId === org.ownerId) {
			return jsonError(c, 403, "OWNER_ROLE_LOCKED", "The owner's role can't be changed.");
		}
		if (targetUserId === c.get("user").id) {
			return jsonError(c, 403, "OWN_ROLE_LOCKED", "You can't change your own role.");
		}

		const db = c.get("db");
		const scope = and(
			eq(userProfiles.userId, targetUserId),
			eq(userProfiles.organizationId, org.organizationId),
		);
		const [existing] = await db
			.select({ role: userProfiles.role })
			.from(userProfiles)
			.where(scope);
		if (!existing) {
			return jsonError(c, 404, "NOT_FOUND", "That person isn't in this organization.");
		}
		await db.batch([
			db.update(userProfiles).set({ role: role as Role }).where(scope),
			db.insert(auditLog).values({
				organizationId: org.organizationId,
				actorUserId: c.get("user").id,
				action: "member.role_changed",
				targetType: "user",
				targetId: targetUserId,
				metadata: JSON.stringify({ from: existing.role, to: role }),
			}),
		]);
		return c.json({ role });
	},
);

api.get("/superadmin/stats", requireUser, requireSuperAdmin, async (c) => {
	const db = c.get("db");
	const [[orgs], [users]] = await Promise.all([
		db.select({ total: count() }).from(organizations),
		db.select({ total: count() }).from(user),
	]);
	return c.json({ organizations: orgs.total, users: users.total });
});
