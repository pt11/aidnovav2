import { and, count, desc, eq, inArray, isNull, lte } from "drizzle-orm";
import { Hono } from "hono";
import {
	announcements,
	auditLog,
	departments,
	invitations,
	organizations,
	policies,
	policyAcknowledgments,
	user,
	userProfiles,
} from "./db/schema";
import {
	jsonError,
	requireOrg,
	requireRole,
	requireUser,
	type AppEnv,
	type Membership,
} from "./middleware";
import { pendingCoursesFor } from "./courses";
import { complianceOverview, pendingPoliciesFor } from "./policies";
import type { Db } from "./db";
import { cleanText, isEmail, isSafeLink, readJson } from "./validate";

const PRIORITIES = ["normal", "high", "urgent"] as const;
type Priority = (typeof PRIORITIES)[number];

const requireManager = requireRole("manager", "admin");

export const workspace = new Hono<AppEnv>();

workspace.get("/organizations/current", requireUser, requireOrg, async (c) => {
	const [org] = await c
		.get("db")
		.select({
			name: organizations.name,
			slug: organizations.slug,
			email: organizations.email,
			phone: organizations.phone,
			website: organizations.website,
			address: organizations.address,
		})
		.from(organizations)
		.where(eq(organizations.id, c.get("org").organizationId));
	return c.json(org);
});

workspace.patch(
	"/organizations/current",
	requireUser,
	requireOrg,
	requireRole("admin"),
	async (c) => {
		const body = await readJson(c.req.raw);
		const name = cleanText(body.name);
		const email = cleanText(body.email).toLowerCase();
		const phone = cleanText(body.phone);
		const website = cleanText(body.website);
		const address = cleanText(body.address, { multiline: true });
		if (name.length < 2 || name.length > 255) {
			return jsonError(c, 400, "INVALID_NAME", "Enter an organization name.");
		}
		if (email && !isEmail(email)) {
			return jsonError(c, 400, "INVALID_EMAIL", "Enter a valid email address.");
		}
		if (website && !isSafeLink(website)) {
			return jsonError(c, 400, "INVALID_WEBSITE", "Enter a full website address, starting with https://.");
		}
		if (phone.length > 50 || address.length > 1000) {
			return jsonError(c, 400, "INVALID_DETAILS", "Those details are too long.");
		}
		const db = c.get("db");
		const org = c.get("org");
		await db.batch([
			db
				.update(organizations)
				.set({
					name,
					email: email || null,
					phone: phone || null,
					website: website || null,
					address: address || null,
				})
				.where(eq(organizations.id, org.organizationId)),
			db.insert(auditLog).values({
				organizationId: org.organizationId,
				actorUserId: c.get("user").id,
				action: "organization.updated",
				targetType: "organization",
				targetId: String(org.organizationId),
			}),
		]);
		return c.json({ name });
	},
);

workspace.get("/me/profile", requireUser, requireOrg, async (c) => {
	const [profile] = await c
		.get("db")
		.select({
			position: userProfiles.position,
			bio: userProfiles.bio,
			contactEmail: userProfiles.contactEmail,
			viberLink: userProfiles.viberLink,
			facebookLink: userProfiles.facebookLink,
			departmentName: departments.name,
		})
		.from(userProfiles)
		.leftJoin(departments, eq(userProfiles.departmentId, departments.id))
		.where(
			and(
				eq(userProfiles.userId, c.get("user").id),
				eq(userProfiles.organizationId, c.get("org").organizationId),
			),
		);
	return c.json(profile);
});

workspace.patch("/me/profile", requireUser, requireOrg, async (c) => {
	const body = await readJson(c.req.raw);
	const name = cleanText(body.name);
	const position = cleanText(body.position);
	const bio = cleanText(body.bio, { multiline: true });
	const contactEmail = cleanText(body.contactEmail).toLowerCase();
	const viberLink = cleanText(body.viberLink);
	const facebookLink = cleanText(body.facebookLink);
	if (name.length < 1 || name.length > 255) {
		return jsonError(c, 400, "INVALID_NAME", "Enter your name.");
	}
	if (position.length > 255 || bio.length > 2000) {
		return jsonError(c, 400, "INVALID_DETAILS", "Those details are too long.");
	}
	if (contactEmail && !isEmail(contactEmail)) {
		return jsonError(c, 400, "INVALID_EMAIL", "Enter a valid email address.");
	}
	if (
		(viberLink && !isSafeLink(viberLink, ["https:", "viber:"])) ||
		(facebookLink && !isSafeLink(facebookLink, ["https:"]))
	) {
		return jsonError(c, 400, "INVALID_LINK", "Enter a full link, starting with https://.");
	}
	const db = c.get("db");
	const userId = c.get("user").id;
	await db.batch([
		db.update(user).set({ name }).where(eq(user.id, userId)),
		db
			.update(userProfiles)
			.set({
				position: position || null,
				bio: bio || null,
				contactEmail: contactEmail || null,
				viberLink: viberLink || null,
				facebookLink: facebookLink || null,
			})
			.where(
				and(
					eq(userProfiles.userId, userId),
					eq(userProfiles.organizationId, c.get("org").organizationId),
				),
			),
	]);
	return c.json({ name });
});

workspace.get("/announcements", requireUser, requireOrg, async (c) => {
	const rows = await c
		.get("db")
		.select({
			id: announcements.id,
			title: announcements.title,
			content: announcements.content,
			priority: announcements.priority,
			createdAt: announcements.createdAt,
			authorName: user.name,
		})
		.from(announcements)
		.leftJoin(user, eq(announcements.createdBy, user.id))
		.where(eq(announcements.organizationId, c.get("org").organizationId))
		.orderBy(desc(announcements.createdAt), desc(announcements.id))
		.limit(100);
	return c.json({ announcements: rows });
});

function readAnnouncement(body: Record<string, unknown>) {
	const title = cleanText(body.title);
	const content = cleanText(body.content, { multiline: true });
	const priority = body.priority as Priority;
	const valid =
		title.length >= 1 &&
		title.length <= 500 &&
		content.length >= 1 &&
		content.length <= 10_000 &&
		PRIORITIES.includes(priority);
	return valid ? { title, content, priority } : null;
}

workspace.post(
	"/announcements",
	requireUser,
	requireOrg,
	requireManager,
	async (c) => {
		const values = readAnnouncement(await readJson(c.req.raw));
		if (!values) {
			return jsonError(c, 400, "INVALID_ANNOUNCEMENT", "Enter a title and message.");
		}
		const org = c.get("org");
		const [created] = await c
			.get("db")
			.insert(announcements)
			.values({
				...values,
				organizationId: org.organizationId,
				createdBy: c.get("user").id,
			})
			.returning({ id: announcements.id });
		return c.json(created, 201);
	},
);

workspace.patch(
	"/announcements/:id",
	requireUser,
	requireOrg,
	requireManager,
	async (c) => {
		const values = readAnnouncement(await readJson(c.req.raw));
		if (!values) {
			return jsonError(c, 400, "INVALID_ANNOUNCEMENT", "Enter a title and message.");
		}
		const updated = await c
			.get("db")
			.update(announcements)
			.set(values)
			.where(
				and(
					eq(announcements.id, Number(c.req.param("id"))),
					eq(announcements.organizationId, c.get("org").organizationId),
				),
			)
			.returning({ id: announcements.id });
		if (!updated.length) {
			return jsonError(c, 404, "NOT_FOUND", "That announcement doesn't exist.");
		}
		return c.json(updated[0]);
	},
);

workspace.delete(
	"/announcements/:id",
	requireUser,
	requireOrg,
	requireManager,
	async (c) => {
		const deleted = await c
			.get("db")
			.delete(announcements)
			.where(
				and(
					eq(announcements.id, Number(c.req.param("id"))),
					eq(announcements.organizationId, c.get("org").organizationId),
				),
			)
			.returning({ id: announcements.id });
		if (!deleted.length) {
			return jsonError(c, 404, "NOT_FOUND", "That announcement doesn't exist.");
		}
		return c.json(deleted[0]);
	},
);

const ACTIVITY_LIMIT = 6;
const REVIEW_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

// What managers see on their dashboard, built only from this organization.
async function managerDashboard(db: Db, org: Membership) {
	const organizationId = org.organizationId;
	const [compliance, [withoutDepartment], draftPolicies, reviewDue, acks, events] =
		await Promise.all([
			complianceOverview(db, org),
			db
				.select({ total: count() })
				.from(userProfiles)
				.where(
					and(
						eq(userProfiles.organizationId, organizationId),
						eq(userProfiles.isActive, true),
						isNull(userProfiles.departmentId),
					),
				),
			db
				.select({ id: policies.id, title: policies.title })
				.from(policies)
				.where(
					and(
						eq(policies.organizationId, organizationId),
						eq(policies.status, "draft"),
					),
				)
				.orderBy(desc(policies.updatedAt))
				.limit(2),
			db
				.select({
					id: policies.id,
					title: policies.title,
					reviewDate: policies.reviewDate,
				})
				.from(policies)
				.where(
					and(
						eq(policies.organizationId, organizationId),
						eq(policies.status, "published"),
						lte(policies.reviewDate, new Date(Date.now() + REVIEW_WINDOW_MS)),
					),
				)
				.orderBy(policies.reviewDate)
				.limit(2),
			db
				.select({
					id: policyAcknowledgments.id,
					actor: user.name,
					subject: policies.title,
					at: policyAcknowledgments.acknowledgedAt,
				})
				.from(policyAcknowledgments)
				.innerJoin(policies, eq(policyAcknowledgments.policyId, policies.id))
				.innerJoin(user, eq(policyAcknowledgments.userId, user.id))
				.where(eq(policies.organizationId, organizationId))
				.orderBy(desc(policyAcknowledgments.acknowledgedAt))
				.limit(ACTIVITY_LIMIT),
			db
				.select({
					id: auditLog.id,
					actor: user.name,
					action: auditLog.action,
					metadata: auditLog.metadata,
					at: auditLog.createdAt,
				})
				.from(auditLog)
				.innerJoin(user, eq(auditLog.actorUserId, user.id))
				.where(
					and(
						eq(auditLog.organizationId, organizationId),
						inArray(auditLog.action, ["invitation.accepted", "file.uploaded"]),
					),
				)
				.orderBy(desc(auditLog.createdAt))
				.limit(ACTIVITY_LIMIT),
		]);
	const activity = [
		...acks.map((ack) => ({
			key: `ack-${ack.id}`,
			actor: ack.actor,
			kind: "acknowledged" as const,
			subject: ack.subject,
			at: ack.at,
		})),
		...events.map((event) => ({
			key: `event-${event.id}`,
			actor: event.actor,
			kind:
				event.action === "file.uploaded"
					? ("uploaded" as const)
					: ("joined" as const),
			subject:
				event.action === "file.uploaded" && event.metadata
					? ((JSON.parse(event.metadata) as { name?: string }).name ?? null)
					: null,
			at: event.at,
		})),
	]
		.sort((a, b) => b.at.getTime() - a.at.getTime())
		.slice(0, ACTIVITY_LIMIT);
	return {
		compliance,
		membersWithoutDepartment: withoutDepartment.total,
		draftPolicies,
		reviewDue,
		activity,
	};
}

workspace.get("/dashboard", requireUser, requireOrg, async (c) => {
	const db = c.get("db");
	const organizationId = c.get("org").organizationId;
	const org = c.get("org");
	const isManager = org.role === "manager" || org.role === "admin";
	const [recent, [members], [departmentTotal], [invited], [posted], pendingPolicies, pendingCourses, manager] =
		await Promise.all([
			db
				.select({
					id: announcements.id,
					title: announcements.title,
					priority: announcements.priority,
					createdAt: announcements.createdAt,
				})
				.from(announcements)
				.where(eq(announcements.organizationId, organizationId))
				.orderBy(desc(announcements.createdAt), desc(announcements.id))
				.limit(3),
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
				.from(departments)
				.where(eq(departments.organizationId, organizationId)),
			db
				.select({ total: count() })
				.from(invitations)
				.where(eq(invitations.organizationId, organizationId)),
			db
				.select({ total: count() })
				.from(announcements)
				.where(eq(announcements.organizationId, organizationId)),
			pendingPoliciesFor(db, c.get("org"), c.get("user").id),
			pendingCoursesFor(db, c.get("org"), c.get("user").id),
			isManager ? managerDashboard(db, org) : Promise.resolve(null),
		]);
	return c.json({
		recent,
		members: members.total,
		departments: departmentTotal.total,
		invitations: invited.total,
		announcements: posted.total,
		pendingPolicies,
		pendingCourses,
		manager,
	});
});
