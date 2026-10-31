import { and, eq } from "drizzle-orm";
import type { Context, MiddlewareHandler } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import { createAuth, getBaseUrl } from "./auth";
import { getDb, type Db } from "./db";
import { organizations, userProfiles } from "./db/schema";

export type Role = "staff" | "manager" | "admin";

export interface SessionUser {
	id: string;
	name: string;
	email: string;
	isSuperAdmin: boolean;
	twoFactorEnabled: boolean;
}

export interface Membership {
	organizationId: number;
	name: string;
	slug: string;
	logoUrl: string | null;
	photoKey: string | null;
	ownerId: string;
	role: Role;
	subscriptionStatus: "trial" | "active" | "suspended" | "cancelled";
	trialEndDate: Date | null;
}

export interface AppEnv {
	Bindings: Env;
	Variables: {
		db: Db;
		user: SessionUser;
		org: Membership;
	};
}

const ACTIVE_ORG_COOKIE = "active-org-id";

export function jsonError(
	c: Context,
	status: 400 | 401 | 403 | 404 | 409 | 413 | 429 | 502,
	code: string,
	message: string,
) {
	return c.json({ code, message }, status);
}

export const withDb = createMiddleware<AppEnv>(async (c, next) => {
	c.set("db", getDb(c.env));
	await next();
});

// Better Auth checks origins on its own routes. This covers every other API
// write, so another site can't submit requests using a signed-in user's cookie.
export const requireSameOrigin = createMiddleware<AppEnv>(async (c, next) => {
	if (c.req.method !== "GET" && c.req.method !== "HEAD") {
		const expected = new URL(getBaseUrl(c.env, c.req.raw)).origin;
		if (c.req.header("origin") !== expected) {
			return jsonError(c, 403, "BAD_ORIGIN", "Request origin not allowed.");
		}
	}
	await next();
});

export const requireUser = createMiddleware<AppEnv>(async (c, next) => {
	const session = await createAuth(c.env, c.req.raw).api.getSession({
		headers: c.req.raw.headers,
	});
	if (!session) return jsonError(c, 401, "UNAUTHENTICATED", "Please sign in.");
	if (session.user.isActive === false) {
		return jsonError(c, 403, "ACCOUNT_DISABLED", "This account is disabled.");
	}
	c.set("user", {
		id: session.user.id,
		name: session.user.name,
		email: session.user.email,
		isSuperAdmin: session.user.isSuperAdmin === true,
		twoFactorEnabled:
			(session.user as { twoFactorEnabled?: boolean | null }).twoFactorEnabled === true,
	});
	await next();
});

export function getMemberships(db: Db, userId: string): Promise<Membership[]> {
	return db
		.select({
			organizationId: organizations.id,
			name: organizations.name,
			slug: organizations.slug,
			logoUrl: organizations.logoUrl,
			photoKey: userProfiles.photoKey,
			ownerId: organizations.ownerId,
			role: userProfiles.role,
			subscriptionStatus: organizations.subscriptionStatus,
			trialEndDate: organizations.trialEndDate,
		})
		.from(userProfiles)
		.innerJoin(
			organizations,
			eq(userProfiles.organizationId, organizations.id),
		)
		.where(and(eq(userProfiles.userId, userId), eq(userProfiles.isActive, true)))
		.orderBy(organizations.name);
}

export function pickActiveMembership(
	c: Context,
	memberships: Membership[],
): Membership | undefined {
	const selected = Number(getCookie(c, ACTIVE_ORG_COOKIE));
	return (
		memberships.find((m) => m.organizationId === selected) ?? memberships[0]
	);
}

export function setActiveOrgCookie(c: Context, organizationId: number) {
	setCookie(c, ACTIVE_ORG_COOKIE, String(organizationId), {
		httpOnly: true,
		sameSite: "Lax",
		secure: new URL(c.req.url).protocol === "https:",
		path: "/",
		maxAge: 60 * 60 * 24 * 30,
	});
}

export type OrgAccess = "ok" | "trial_expired" | "blocked";

export function getOrgAccess(org: Membership, now = new Date()): OrgAccess {
	if (org.subscriptionStatus === "active") return "ok";
	if (org.subscriptionStatus === "trial") {
		return org.trialEndDate && org.trialEndDate < now ? "trial_expired" : "ok";
	}
	return "blocked";
}

// Runs after requireUser. The cookie only selects among the user's own active
// memberships, so changing it can't reach another organization.
export const requireOrg = createMiddleware<AppEnv>(async (c, next) => {
	const db = c.get("db");
	const org = pickActiveMembership(
		c,
		await getMemberships(db, c.get("user").id),
	);
	if (!org) {
		return jsonError(c, 403, "NO_ORGANIZATION", "Join an organization first.");
	}
	const access = getOrgAccess(org);
	if (access === "trial_expired") {
		await db
			.update(organizations)
			.set({ subscriptionStatus: "suspended" })
			.where(
				and(
					eq(organizations.id, org.organizationId),
					eq(organizations.subscriptionStatus, "trial"),
				),
			);
		return jsonError(c, 403, "TRIAL_EXPIRED", "This organization's trial ended.");
	}
	if (access === "blocked") {
		return jsonError(c, 403, "ORG_BLOCKED", "This organization is not active.");
	}
	c.set("org", org);
	await next();
});

export function requireRole(...roles: Role[]): MiddlewareHandler<AppEnv> {
	return async (c, next) => {
		if (!roles.includes(c.get("org").role)) {
			return jsonError(c, 403, "FORBIDDEN", "You don't have access to this.");
		}
		await next();
	};
}

export const requireSuperAdmin = createMiddleware<AppEnv>(async (c, next) => {
	if (!c.get("user").isSuperAdmin) {
		return jsonError(c, 403, "FORBIDDEN", "You don't have access to this.");
	}
	await next();
});
