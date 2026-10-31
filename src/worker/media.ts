import { and, count, eq, gt } from "drizzle-orm";
import { Hono } from "hono";
import { createAuth } from "./auth";
import { auditLog, organizations, user, userProfiles } from "./db/schema";
import {
	jsonError,
	requireOrg,
	requireRole,
	requireUser,
	type AppEnv,
} from "./middleware";
import { getOrgLimits, getStorageUsed } from "./plans";
import { cleanText } from "./validate";

const MAX_LOGO_BYTES = 5 * 1024 * 1024;
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
const MAX_RESET_EMAILS_PER_HOUR = 3;

// SVG is left out on purpose, because it can run scripts when opened.
const IMAGE_TYPES: Record<string, string> = {
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	png: "image/png",
	webp: "image/webp",
};

function imageTypeOf(name: string) {
	const dot = name.lastIndexOf(".");
	return dot === -1 ? undefined : IMAGE_TYPES[name.slice(dot + 1).toLowerCase()];
}

function imageResponse(object: R2ObjectBody, contentType: string) {
	return new Response(object.body, {
		headers: {
			"Content-Type": contentType,
			"Cache-Control": "private, max-age=3600",
			"X-Content-Type-Options": "nosniff",
			"Content-Security-Policy": "default-src 'none'; sandbox",
		},
	});
}

// The address changes with each upload, so a new image shows straight away.
export function memberPhotoUrl(userId: string, photoKey: string | null) {
	return photoKey ? `/api/members/${userId}/photo?v=${photoKey.slice(-8)}` : null;
}

function logoUrl(organizationId: number, key: string) {
	return `/api/organizations/${organizationId}/logo?v=${key.slice(-8)}`;
}

export const mediaRoutes = new Hono<AppEnv>();

mediaRoutes.post(
	"/organizations/current/logo",
	requireUser,
	requireOrg,
	requireRole("admin"),
	async (c) => {
		const db = c.get("db");
		const org = c.get("org");
		const logoType = imageTypeOf(cleanText(c.req.query("name")));
		const size = Number(c.req.header("content-length"));
		if (!logoType) {
			return jsonError(c, 400, "TYPE_NOT_ALLOWED", "Choose a PNG, JPG or WebP image.");
		}
		if (!Number.isFinite(size) || size <= 0 || !c.req.raw.body) {
			return jsonError(c, 400, "EMPTY_FILE", "That file is empty.");
		}
		if (size > MAX_LOGO_BYTES) {
			return jsonError(c, 413, "FILE_TOO_LARGE", "Choose an image up to 5 MB.");
		}
		const [[current], used, limits] = await Promise.all([
			db
				.select({ logoKey: organizations.logoKey, logoBytes: organizations.logoBytes })
				.from(organizations)
				.where(eq(organizations.id, org.organizationId)),
			getStorageUsed(db, org.organizationId),
			getOrgLimits(db, org.organizationId),
		]);
		if (
			limits.storageLimitBytes !== null &&
			used - (current.logoBytes ?? 0) + size > limits.storageLimitBytes
		) {
			return jsonError(c, 413, "STORAGE_FULL", "Your organization's storage is full.");
		}
		const logoKey = `org/${org.organizationId}/${crypto.randomUUID()}`;
		const stored = await c.env.FILES.put(logoKey, c.req.raw.body, {
			httpMetadata: { contentType: logoType },
		});
		await db.batch([
			db
				.update(organizations)
				.set({
					logoKey,
					logoType,
					logoBytes: stored.size,
					logoUrl: logoUrl(org.organizationId, logoKey),
				})
				.where(eq(organizations.id, org.organizationId)),
			db.insert(auditLog).values({
				organizationId: org.organizationId,
				actorUserId: c.get("user").id,
				action: "organization.logo_changed",
				targetType: "organization",
				targetId: String(org.organizationId),
			}),
		]);
		if (current.logoKey) await c.env.FILES.delete(current.logoKey);
		return c.json({ logoUrl: logoUrl(org.organizationId, logoKey) });
	},
);

mediaRoutes.delete(
	"/organizations/current/logo",
	requireUser,
	requireOrg,
	requireRole("admin"),
	async (c) => {
		const db = c.get("db");
		const org = c.get("org");
		const [current] = await db
			.select({ logoKey: organizations.logoKey })
			.from(organizations)
			.where(eq(organizations.id, org.organizationId));
		await db
			.update(organizations)
			.set({ logoKey: null, logoType: null, logoBytes: null, logoUrl: null })
			.where(eq(organizations.id, org.organizationId));
		if (current.logoKey) await c.env.FILES.delete(current.logoKey);
		return c.json({ ok: true });
	},
);

// Anyone in the organization can see its logo, including from a switcher that
// lists several organizations, so this checks membership rather than the active one.
mediaRoutes.get("/organizations/:id/logo", requireUser, async (c) => {
	const db = c.get("db");
	const organizationId = Number(c.req.param("id"));
	if (!Number.isInteger(organizationId)) {
		return jsonError(c, 404, "NOT_FOUND", "That image doesn't exist.");
	}
	const [row] = await db
		.select({ logoKey: organizations.logoKey, logoType: organizations.logoType })
		.from(organizations)
		.innerJoin(
			userProfiles,
			and(
				eq(userProfiles.organizationId, organizations.id),
				eq(userProfiles.userId, c.get("user").id),
				eq(userProfiles.isActive, true),
			),
		)
		.where(eq(organizations.id, organizationId));
	if (!row?.logoKey || !row.logoType) {
		return jsonError(c, 404, "NOT_FOUND", "That image doesn't exist.");
	}
	const object = await c.env.FILES.get(row.logoKey);
	if (!object) return jsonError(c, 404, "NOT_FOUND", "That image doesn't exist.");
	return imageResponse(object, row.logoType);
});

mediaRoutes.post("/me/photo", requireUser, requireOrg, async (c) => {
	const db = c.get("db");
	const org = c.get("org");
	const userId = c.get("user").id;
	const photoType = imageTypeOf(cleanText(c.req.query("name")));
	const size = Number(c.req.header("content-length"));
	if (!photoType) {
		return jsonError(c, 400, "TYPE_NOT_ALLOWED", "Choose a PNG, JPG or WebP image.");
	}
	if (!Number.isFinite(size) || size <= 0 || !c.req.raw.body) {
		return jsonError(c, 400, "EMPTY_FILE", "That file is empty.");
	}
	if (size > MAX_PHOTO_BYTES) {
		return jsonError(c, 413, "FILE_TOO_LARGE", "Choose an image up to 2 MB.");
	}
	const where = and(
		eq(userProfiles.userId, userId),
		eq(userProfiles.organizationId, org.organizationId),
	);
	const [[current], used, limits] = await Promise.all([
		db
			.select({ photoKey: userProfiles.photoKey, photoBytes: userProfiles.photoBytes })
			.from(userProfiles)
			.where(where),
		getStorageUsed(db, org.organizationId),
		getOrgLimits(db, org.organizationId),
	]);
	if (
		limits.storageLimitBytes !== null &&
		used - (current.photoBytes ?? 0) + size > limits.storageLimitBytes
	) {
		return jsonError(c, 413, "STORAGE_FULL", "Your organization's storage is full.");
	}
	const photoKey = `org/${org.organizationId}/${crypto.randomUUID()}`;
	const stored = await c.env.FILES.put(photoKey, c.req.raw.body, {
		httpMetadata: { contentType: photoType },
	});
	await db
		.update(userProfiles)
		.set({ photoKey, photoType, photoBytes: stored.size })
		.where(where);
	if (current.photoKey) await c.env.FILES.delete(current.photoKey);
	return c.json({ photoUrl: memberPhotoUrl(userId, photoKey) });
});

mediaRoutes.delete("/me/photo", requireUser, requireOrg, async (c) => {
	const db = c.get("db");
	const where = and(
		eq(userProfiles.userId, c.get("user").id),
		eq(userProfiles.organizationId, c.get("org").organizationId),
	);
	const [current] = await db
		.select({ photoKey: userProfiles.photoKey })
		.from(userProfiles)
		.where(where);
	await db
		.update(userProfiles)
		.set({ photoKey: null, photoType: null, photoBytes: null })
		.where(where);
	if (current?.photoKey) await c.env.FILES.delete(current.photoKey);
	return c.json({ ok: true });
});

// Photos belong to one organization, and are only shown to its members.
mediaRoutes.get("/members/:userId/photo", requireUser, requireOrg, async (c) => {
	const [row] = await c
		.get("db")
		.select({ photoKey: userProfiles.photoKey, photoType: userProfiles.photoType })
		.from(userProfiles)
		.where(
			and(
				eq(userProfiles.userId, c.req.param("userId")),
				eq(userProfiles.organizationId, c.get("org").organizationId),
			),
		);
	if (!row?.photoKey || !row.photoType) {
		return jsonError(c, 404, "NOT_FOUND", "That image doesn't exist.");
	}
	const object = await c.env.FILES.get(row.photoKey);
	if (!object) return jsonError(c, 404, "NOT_FOUND", "That image doesn't exist.");
	return imageResponse(object, row.photoType);
});

// The link goes only to the person's own email, so an admin never learns or sets
// a password that also opens that person's other organizations.
mediaRoutes.post(
	"/organizations/current/members/:userId/send-reset",
	requireUser,
	requireOrg,
	requireRole("admin"),
	async (c) => {
		const db = c.get("db");
		const org = c.get("org");
		const targetId = c.req.param("userId");
		const [target] = await db
			.select({ email: user.email })
			.from(userProfiles)
			.innerJoin(user, eq(userProfiles.userId, user.id))
			.where(
				and(
					eq(userProfiles.userId, targetId),
					eq(userProfiles.organizationId, org.organizationId),
					eq(userProfiles.isActive, true),
				),
			);
		if (!target) return jsonError(c, 404, "NOT_FOUND", "That person isn't in your organization.");
		const [sent] = await db
			.select({ total: count() })
			.from(auditLog)
			.where(
				and(
					eq(auditLog.organizationId, org.organizationId),
					eq(auditLog.action, "member.reset_link_sent"),
					eq(auditLog.targetId, targetId),
					gt(auditLog.createdAt, new Date(Date.now() - 60 * 60 * 1000)),
				),
			);
		if (sent.total >= MAX_RESET_EMAILS_PER_HOUR) {
			return jsonError(c, 429, "TOO_MANY_EMAILS", "Too many links were sent. Try again in an hour.");
		}
		await createAuth(c.env, c.req.raw).api.requestPasswordReset({
			body: { email: target.email, redirectTo: "/reset-password" },
		});
		await db.insert(auditLog).values({
			organizationId: org.organizationId,
			actorUserId: c.get("user").id,
			action: "member.reset_link_sent",
			targetType: "user",
			targetId,
		});
		return c.json({ ok: true });
	},
);
