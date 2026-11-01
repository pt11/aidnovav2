import { and, count, eq, gt, sql } from "drizzle-orm";
import { Hono } from "hono";
import { createAuth, getBaseUrl } from "./auth";
import type { Db } from "./db";
import {
	auditLog,
	departments,
	fileAccessDepartments,
	folderAccessDepartments,
	invitations,
	organizations,
	policyAccessDepartments,
	user,
	userProfiles,
} from "./db/schema";
import { sendEmail } from "./email";
import {
	jsonError,
	requireOrg,
	requireRole,
	requireUser,
	setActiveOrgCookie,
	type AppEnv,
	type Role,
} from "./middleware";
import { getOrgLimits, getSeatUsage } from "./plans";
import { cleanText, isEmail, readJson } from "./validate";
import { welcomeNotice } from "./notifications";

const ROLES: Role[] = ["staff", "manager", "admin"];
const INVITE_DAYS = 7;
const MAX_PENDING_INVITES = 200;
// Invitations email addresses anyone can type in, so one organization can't
// use them to send unlimited mail from the AidNova domain.
const MAX_INVITES_PER_DAY = 50;

const requireManager = requireRole("manager", "admin");

function makeToken(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(32));
	return btoa(String.fromCharCode(...bytes))
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
}

async function hashToken(token: string): Promise<string> {
	const digest = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(token),
	);
	return [...new Uint8Array(digest)]
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
}

async function findDepartment(
	db: Db,
	organizationId: number,
	departmentId: unknown,
) {
	if (typeof departmentId !== "number") return undefined;
	const [department] = await db
		.select({ id: departments.id })
		.from(departments)
		.where(
			and(
				eq(departments.id, departmentId),
				eq(departments.organizationId, organizationId),
			),
		);
	return department;
}

export const team = new Hono<AppEnv>();

// Counts pending invitations too. Stops new people joining, and never removes anyone.
async function isOrgFull(db: Db, organizationId: number) {
	const [limits, seats] = await Promise.all([
		getOrgLimits(db, organizationId),
		getSeatUsage(db, organizationId),
	]);
	return limits.maxUsers !== null && seats.active + seats.pending >= limits.maxUsers;
}

team.get(
	"/organizations/current/departments",
	requireUser,
	requireOrg,
	async (c) => {
		const organizationId = c.get("org").organizationId;
		const rows = await c
			.get("db")
			.select({
				id: departments.id,
				name: departments.name,
				description: departments.description,
				memberCount: count(userProfiles.id),
			})
			.from(departments)
			.leftJoin(
				userProfiles,
				and(
					eq(userProfiles.departmentId, departments.id),
					eq(userProfiles.isActive, true),
				),
			)
			.where(eq(departments.organizationId, organizationId))
			.groupBy(departments.id)
			.orderBy(departments.name);
		return c.json({ departments: rows });
	},
);

async function isDepartmentNameTaken(
	db: Db,
	organizationId: number,
	name: string,
	exceptId?: number,
) {
	const rows = await db
		.select({ id: departments.id })
		.from(departments)
		.where(
			and(
				eq(departments.organizationId, organizationId),
				sql`lower(${departments.name}) = lower(${name})`,
			),
		);
	return rows.some((row) => row.id !== exceptId);
}

team.post(
	"/organizations/current/departments",
	requireUser,
	requireOrg,
	requireManager,
	async (c) => {
		const body = await readJson(c.req.raw);
		const name = cleanText(body.name);
		const description = cleanText(body.description);
		if (name.length < 1 || name.length > 255 || description.length > 1000) {
			return jsonError(c, 400, "INVALID_DEPARTMENT", "Enter a department name.");
		}
		const db = c.get("db");
		const org = c.get("org");
		if (await isDepartmentNameTaken(db, org.organizationId, name)) {
			return jsonError(c, 409, "DEPARTMENT_EXISTS", "That department already exists.");
		}
		const [created] = await db
			.insert(departments)
			.values({
				name,
				description: description || null,
				organizationId: org.organizationId,
			})
			.returning({ id: departments.id });
		await db.insert(auditLog).values({
			organizationId: org.organizationId,
			actorUserId: c.get("user").id,
			action: "department.created",
			targetType: "department",
			targetId: String(created.id),
		});
		return c.json(created, 201);
	},
);

team.patch(
	"/organizations/current/departments/:id",
	requireUser,
	requireOrg,
	requireManager,
	async (c) => {
		const body = await readJson(c.req.raw);
		const name = cleanText(body.name);
		const description = cleanText(body.description);
		if (name.length < 1 || name.length > 255 || description.length > 1000) {
			return jsonError(c, 400, "INVALID_DEPARTMENT", "Enter a department name.");
		}
		const db = c.get("db");
		const organizationId = c.get("org").organizationId;
		const id = Number(c.req.param("id"));
		if (await isDepartmentNameTaken(db, organizationId, name, id)) {
			return jsonError(c, 409, "DEPARTMENT_EXISTS", "That department already exists.");
		}
		const updated = await db
			.update(departments)
			.set({ name, description: description || null })
			.where(
				and(
					eq(departments.id, id),
					eq(departments.organizationId, organizationId),
				),
			)
			.returning({ id: departments.id });
		if (!updated.length) {
			return jsonError(c, 404, "NOT_FOUND", "That department doesn't exist.");
		}
		return c.json({ id });
	},
);

team.delete(
	"/organizations/current/departments/:id",
	requireUser,
	requireOrg,
	requireManager,
	async (c) => {
		const db = c.get("db");
		const org = c.get("org");
		const id = Number(c.req.param("id"));
		const scope = and(
			eq(departments.id, id),
			eq(departments.organizationId, org.organizationId),
		);
		// Removing the last department from a limited item would open it to everyone,
		// so anything it limits has to be changed first.
		const [[policies], [files], [folders]] = await Promise.all([
			db
				.select({ total: count() })
				.from(policyAccessDepartments)
				.innerJoin(departments, eq(policyAccessDepartments.departmentId, departments.id))
				.where(scope),
			db
				.select({ total: count() })
				.from(fileAccessDepartments)
				.innerJoin(departments, eq(fileAccessDepartments.departmentId, departments.id))
				.where(scope),
			db
				.select({ total: count() })
				.from(folderAccessDepartments)
				.innerJoin(departments, eq(folderAccessDepartments.departmentId, departments.id))
				.where(scope),
		]);
		if (policies.total + files.total + folders.total > 0) {
			return jsonError(c, 409, "DEPARTMENT_IN_USE", "Change what this department limits first.");
		}
		// Members and invitations in the department stay, without a department.
		const deleted = await db
			.delete(departments)
			.where(scope)
			.returning({ id: departments.id });
		if (!deleted.length) {
			return jsonError(c, 404, "NOT_FOUND", "That department doesn't exist.");
		}
		await db.insert(auditLog).values({
			organizationId: org.organizationId,
			actorUserId: c.get("user").id,
			action: "department.deleted",
			targetType: "department",
			targetId: String(id),
		});
		return c.json({ id });
	},
);

team.patch(
	"/organizations/current/members/:userId/department",
	requireUser,
	requireOrg,
	requireManager,
	async (c) => {
		const { departmentId } = await readJson(c.req.raw);
		const db = c.get("db");
		const organizationId = c.get("org").organizationId;
		if (
			departmentId !== null &&
			!(await findDepartment(db, organizationId, departmentId))
		) {
			return jsonError(c, 400, "INVALID_DEPARTMENT", "Choose a valid department.");
		}
		const updated = await db
			.update(userProfiles)
			.set({ departmentId: departmentId as number | null })
			.where(
				and(
					eq(userProfiles.userId, c.req.param("userId")),
					eq(userProfiles.organizationId, organizationId),
				),
			)
			.returning({ id: userProfiles.id });
		if (!updated.length) {
			return jsonError(c, 404, "NOT_FOUND", "That person isn't in this organization.");
		}
		return c.json({ departmentId });
	},
);

team.patch(
	"/organizations/current/members/:userId/status",
	requireUser,
	requireOrg,
	requireRole("admin"),
	async (c) => {
		const { isActive } = await readJson(c.req.raw);
		if (typeof isActive !== "boolean") {
			return jsonError(c, 400, "INVALID_STATUS", "Choose a valid status.");
		}
		const org = c.get("org");
		const targetUserId = c.req.param("userId");
		if (targetUserId === org.ownerId) {
			return jsonError(c, 403, "OWNER_LOCKED", "The owner can't be deactivated.");
		}
		if (targetUserId === c.get("user").id) {
			return jsonError(c, 403, "SELF_LOCKED", "You can't deactivate yourself.");
		}
		const db = c.get("db");
		if (isActive) {
			const [member] = await db
				.select({ isActive: userProfiles.isActive })
				.from(userProfiles)
				.where(
					and(
						eq(userProfiles.userId, targetUserId),
						eq(userProfiles.organizationId, org.organizationId),
					),
				);
			if (member && !member.isActive && (await isOrgFull(db, org.organizationId))) {
				return jsonError(c, 409, "USER_LIMIT", "Your plan's user limit has been reached.");
			}
		}
		const updated = await db
			.update(userProfiles)
			.set({ isActive })
			.where(
				and(
					eq(userProfiles.userId, targetUserId),
					eq(userProfiles.organizationId, org.organizationId),
				),
			)
			.returning({ id: userProfiles.id });
		if (!updated.length) {
			return jsonError(c, 404, "NOT_FOUND", "That person isn't in this organization.");
		}
		await db.insert(auditLog).values({
			organizationId: org.organizationId,
			actorUserId: c.get("user").id,
			action: isActive ? "member.reactivated" : "member.deactivated",
			targetType: "user",
			targetId: targetUserId,
		});
		return c.json({ isActive });
	},
);

team.get(
	"/organizations/current/invitations",
	requireUser,
	requireOrg,
	requireManager,
	async (c) => {
		const rows = await c
			.get("db")
			.select({
				id: invitations.id,
				email: invitations.email,
				role: invitations.role,
				departmentId: invitations.departmentId,
				departmentName: departments.name,
				expiresAt: invitations.expiresAt,
			})
			.from(invitations)
			.leftJoin(departments, eq(invitations.departmentId, departments.id))
			.where(eq(invitations.organizationId, c.get("org").organizationId))
			.orderBy(invitations.email);
		return c.json({ invitations: rows });
	},
);

// Also resends: inviting the same address replaces the old link.
team.post(
	"/organizations/current/invitations",
	requireUser,
	requireOrg,
	requireManager,
	async (c) => {
		const body = await readJson(c.req.raw);
		const email = cleanText(body.email).toLowerCase();
		const role = body.role as Role;
		const db = c.get("db");
		const org = c.get("org");
		const actor = c.get("user");

		if (!isEmail(email)) {
			return jsonError(c, 400, "INVALID_EMAIL", "Enter a valid email address.");
		}
		if (!ROLES.includes(role)) {
			return jsonError(c, 400, "INVALID_ROLE", "Choose a valid role.");
		}
		if (org.role !== "admin" && role !== "staff") {
			return jsonError(c, 403, "FORBIDDEN", "Only admins can invite managers and admins.");
		}
		const departmentId = (body.departmentId ?? null) as number | null;
		if (
			departmentId !== null &&
			!(await findDepartment(db, org.organizationId, departmentId))
		) {
			return jsonError(c, 400, "INVALID_DEPARTMENT", "Choose a valid department.");
		}

		const [member] = await db
			.select({ id: userProfiles.id })
			.from(userProfiles)
			.innerJoin(user, eq(userProfiles.userId, user.id))
			.where(
				and(
					eq(user.email, email),
					eq(userProfiles.organizationId, org.organizationId),
				),
			);
		if (member) {
			return jsonError(c, 409, "ALREADY_MEMBER", "That person is already in this organization.");
		}

		const [existing] = await db
			.select({ role: invitations.role })
			.from(invitations)
			.where(
				and(
					eq(invitations.organizationId, org.organizationId),
					eq(invitations.email, email),
				),
			);
		if (existing && org.role !== "admin" && existing.role !== "staff") {
			return jsonError(c, 403, "FORBIDDEN", "Only admins can change that invitation.");
		}

		if (!existing && (await isOrgFull(db, org.organizationId))) {
			return jsonError(c, 409, "USER_LIMIT", "Your plan's user limit has been reached.");
		}

		const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
		const [[pending], [sentToday]] = await Promise.all([
			db
				.select({ total: count() })
				.from(invitations)
				.where(eq(invitations.organizationId, org.organizationId)),
			db
				.select({ total: count() })
				.from(auditLog)
				.where(
					and(
						eq(auditLog.organizationId, org.organizationId),
						eq(auditLog.action, "invitation.sent"),
						gt(auditLog.createdAt, dayAgo),
					),
				),
		]);
		if (
			(!existing && pending.total >= MAX_PENDING_INVITES) ||
			sentToday.total >= MAX_INVITES_PER_DAY
		) {
			return jsonError(c, 429, "TOO_MANY_INVITES", "Too many invitations. Try again tomorrow.");
		}

		const token = makeToken();
		const tokenHash = await hashToken(token);
		const expiresAt = new Date(
			Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000,
		);
		await db.batch([
			db
				.insert(invitations)
				.values({
					organizationId: org.organizationId,
					email,
					role,
					departmentId,
					tokenHash,
					invitedBy: actor.id,
					expiresAt,
				})
				.onConflictDoUpdate({
					target: [invitations.organizationId, invitations.email],
					set: { role, departmentId, tokenHash, invitedBy: actor.id, expiresAt },
				}),
			db.insert(auditLog).values({
				organizationId: org.organizationId,
				actorUserId: actor.id,
				action: "invitation.sent",
				targetType: "email",
				targetId: email,
				metadata: JSON.stringify({ role }),
			}),
		]);

		const url = `${getBaseUrl(c.env, c.req.raw)}/invite?token=${token}`;
		const orgName = cleanText(org.name);
		try {
			await sendEmail(c.env, {
				to: email,
				subject: `Join ${orgName} on AidNova`,
				text: `${cleanText(actor.name)} invited you to join ${orgName} on AidNova.\n\nUse this link to accept. It works for ${INVITE_DAYS} days:\n\n${url}\n\nIf you weren't expecting this, you can ignore this email.`,
			});
		} catch (error) {
			console.error(error);
			return jsonError(c, 502, "EMAIL_FAILED", "We couldn't send that email. Try again.");
		}
		return c.json({ email }, 201);
	},
);

team.delete(
	"/organizations/current/invitations/:id",
	requireUser,
	requireOrg,
	requireManager,
	async (c) => {
		const db = c.get("db");
		const org = c.get("org");
		const scope = and(
			eq(invitations.id, Number(c.req.param("id"))),
			eq(invitations.organizationId, org.organizationId),
		);
		const [existing] = await db
			.select({ role: invitations.role, email: invitations.email })
			.from(invitations)
			.where(scope);
		if (!existing) {
			return jsonError(c, 404, "NOT_FOUND", "That invitation doesn't exist.");
		}
		if (org.role !== "admin" && existing.role !== "staff") {
			return jsonError(c, 403, "FORBIDDEN", "Only admins can change that invitation.");
		}
		await db.batch([
			db.delete(invitations).where(scope),
			db.insert(auditLog).values({
				organizationId: org.organizationId,
				actorUserId: c.get("user").id,
				action: "invitation.revoked",
				targetType: "email",
				targetId: existing.email,
			}),
		]);
		return c.json({ ok: true });
	},
);

// The invitation was emailed to this address, so holding it already proves the
// address is theirs and there's nothing left to confirm. It only ever creates a new
// account: an existing one, confirmed or not, has to sign in as usual.
team.post("/invitations/sign-up", async (c) => {
	const db = c.get("db");
	const body = await readJson(c.req.raw);
	const name = cleanText(body.name);
	const password = typeof body.password === "string" ? body.password : "";
	if (typeof body.token !== "string" || !body.token) return jsonError(c, 404, "NOT_FOUND", "That invitation doesn't exist.");
	const [invite] = await db.select({ email: invitations.email, expiresAt: invitations.expiresAt }).from(invitations).where(eq(invitations.tokenHash, await hashToken(body.token)));
	if (!invite) return jsonError(c, 404, "NOT_FOUND", "That invitation doesn't exist.");
	if (invite.expiresAt < new Date()) return jsonError(c, 409, "INVITE_EXPIRED", "That invitation has expired.");
	if (name.length < 1 || name.length > 255) return jsonError(c, 400, "INVALID_NAME", "Enter your name.");
	if (password.length < 8 || password.length > 128) return jsonError(c, 400, "INVALID_PASSWORD", "Choose a password of at least 8 characters.");
	const [existing] = await db.select({ id: user.id }).from(user).where(eq(user.email, invite.email));
	if (existing) return jsonError(c, 409, "EMAIL_EXISTS", "An account with this email already exists.");
	await createAuth(c.env, c.req.raw, { skipConfirmationEmail: true }).api.signUpEmail({ body: { name, email: invite.email, password } });
	await db.update(user).set({ emailVerified: true }).where(eq(user.email, invite.email));
	return c.json({ email: invite.email }, 201);
});

// Public, because invited people may not have an account yet. Only someone
// holding the emailed token can read it.
team.get("/invitations/lookup", async (c) => {
	const token = c.req.query("token");
	if (!token) return jsonError(c, 404, "NOT_FOUND", "That invitation doesn't exist.");
	const [invite] = await c
		.get("db")
		.select({
			email: invitations.email,
			role: invitations.role,
			expiresAt: invitations.expiresAt,
			organizationName: organizations.name,
		})
		.from(invitations)
		.innerJoin(organizations, eq(invitations.organizationId, organizations.id))
		.where(eq(invitations.tokenHash, await hashToken(token)));
	if (!invite) return jsonError(c, 404, "NOT_FOUND", "That invitation doesn't exist.");
	return c.json({
		email: invite.email,
		role: invite.role,
		organizationName: invite.organizationName,
		expired: invite.expiresAt < new Date(),
	});
});

team.post("/invitations/accept", requireUser, async (c) => {
	const { token } = await readJson(c.req.raw);
	const db = c.get("db");
	const currentUser = c.get("user");
	const [invite] =
		typeof token === "string"
			? await db
					.select()
					.from(invitations)
					.where(eq(invitations.tokenHash, await hashToken(token)))
			: [];
	if (!invite) return jsonError(c, 404, "NOT_FOUND", "That invitation doesn't exist.");
	if (invite.expiresAt < new Date()) {
		return jsonError(c, 409, "INVITE_EXPIRED", "That invitation has expired.");
	}
	if (currentUser.email.toLowerCase() !== invite.email) {
		return jsonError(c, 403, "WRONG_ACCOUNT", "That invitation is for a different email address.");
	}
	// The invitation itself is already counted, so only people already in matter.
	const [limits, seats] = await Promise.all([
		getOrgLimits(db, invite.organizationId),
		getSeatUsage(db, invite.organizationId),
	]);
	if (limits.maxUsers !== null && seats.active >= limits.maxUsers) {
		return jsonError(c, 409, "USER_LIMIT", "This organization's user limit has been reached.");
	}

	try {
		await db.batch([
			db.insert(userProfiles).values({
				userId: currentUser.id,
				organizationId: invite.organizationId,
				role: invite.role,
				departmentId: invite.departmentId,
			}),
			db.delete(invitations).where(eq(invitations.id, invite.id)),
			db.insert(auditLog).values({
				organizationId: invite.organizationId,
				actorUserId: currentUser.id,
				action: "invitation.accepted",
				targetType: "user",
				targetId: currentUser.id,
				metadata: JSON.stringify({ role: invite.role }),
			}),
		]);
	} catch (error) {
		const text = String(
			(error as { cause?: unknown })?.cause ?? (error as Error)?.message,
		);
		if (text.includes("user_profiles")) {
			return jsonError(c, 409, "ALREADY_MEMBER", "You're already in this organization.");
		}
		throw error;
	}

	const [joined] = await db.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, invite.organizationId));
	await welcomeNotice(db, invite.organizationId, currentUser.id, joined?.name ?? "");
	setActiveOrgCookie(c, invite.organizationId);
	return c.json({ organizationId: invite.organizationId });
});
