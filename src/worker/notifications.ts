import { and, count, desc, eq, gte, isNull, lt } from "drizzle-orm";
import { Hono } from "hono";
import type { Context } from "hono";
import { getOrgAiLimits, getOrgAiUsage } from "./aiLimits";
import { auditLog, notifications, notificationSettings, organizations, userProfiles } from "./db/schema";
import { sendEmail } from "./email";
import type { Db } from "./db";
import { jsonError, requireOrg, requireRole, requireUser, type AppEnv } from "./middleware";
import { cleanText, readJson } from "./validate";

const KEEP_MS = 90 * 24 * 60 * 60 * 1000;
const PAGE = 200;
// D1 allows 100 values in a statement, and each notification uses 6 here.
const CHUNK = 15;

// What each kind is filed under, and which organization switch can turn it off.
// The rest are about someone's own work or review, so they always arrive.
const KINDS = {
	policy_required: { category: "policies", setting: "policies" },
	policy_reminder: { category: "policies", setting: "policies" },
	course_assigned: { category: "courses", setting: "courses" },
	announcement: { category: "announcements", setting: "announcements" },
	announcement_urgent: { category: "announcements", setting: "announcements" },
	event_new: { category: "events", setting: "events" },
	welcome: { category: "general", setting: "welcome" },
	training_waiting: { category: "capacity", setting: null },
	training_verified: { category: "capacity", setting: null },
	training_changes: { category: "capacity", setting: null },
	training_rejected: { category: "capacity", setting: null },
	training_message: { category: "capacity", setting: null },
	skill_nominated: { category: "capacity", setting: null },
	skill_assessed: { category: "capacity", setting: null },
	skill_declined: { category: "capacity", setting: null },
	report_waiting: { category: "projects", setting: null },
	report_approved: { category: "projects", setting: null },
	report_returned: { category: "projects", setting: null },
	display_name_waiting: { category: "people", setting: null },
	display_name_approved: { category: "people", setting: null },
	display_name_declined: { category: "people", setting: null },
} as const;

export type NotificationKind = keyof typeof KINDS;
type Switch = "policies" | "courses" | "announcements" | "events" | "welcome";
const DEFAULT_SWITCHES: Record<Switch, boolean> = { policies: true, courses: true, announcements: true, events: true, welcome: true };

async function switchesFor(db: Db, organizationId: number) {
	const [row] = await db.select().from(notificationSettings).where(eq(notificationSettings.organizationId, organizationId));
	return row ? { policies: row.policies, courses: row.courses, announcements: row.announcements, events: row.events, welcome: row.welcome } : DEFAULT_SWITCHES;
}

// A notice failing must never undo or fail the thing that caused it, so problems
// are logged here and not passed on. Nobody is told about their own action.
export async function notifyPeople(
	c: Context<AppEnv>,
	userIds: (string | null | undefined)[],
	kind: NotificationKind,
	params: Record<string, string | number> = {},
	href = "/notifications",
) {
	try {
		const db = c.get("db");
		const organizationId = c.get("org").organizationId;
		const { category, setting } = KINDS[kind];
		if (setting && !(await switchesFor(db, organizationId))[setting]) return;
		const actor = c.get("user").id;
		const people = [...new Set(userIds)].filter((id): id is string => !!id && id !== actor);
		for (let at = 0; at < people.length; at += CHUNK) {
			await db.insert(notifications).values(
				people.slice(at, at + CHUNK).map((userId) => ({ organizationId, userId, kind, category, params: JSON.stringify(params), href })),
			);
		}
	} catch (error) {
		console.error("A notification couldn't be saved", kind, error);
	}
}

// Sent when someone joins, before they have an organization in the session.
export async function welcomeNotice(db: Db, organizationId: number, userId: string, name: string) {
	try {
		if (!(await switchesFor(db, organizationId)).welcome) return;
		await db.insert(notifications).values({ organizationId, userId, kind: "welcome", category: "general", params: JSON.stringify({ organization: name }), href: "/dashboard" });
	} catch (error) {
		console.error("A welcome notice couldn't be saved", error);
	}
}

export async function activeMemberIds(db: Db, organizationId: number) {
	const rows = await db
		.select({ userId: userProfiles.userId })
		.from(userProfiles)
		.where(and(eq(userProfiles.organizationId, organizationId), eq(userProfiles.isActive, true)));
	return rows.map((row) => row.userId);
}

export const notificationRoutes = new Hono<AppEnv>();
const gate = [requireUser, requireOrg] as const;

function mine(c: Context<AppEnv>) {
	return and(eq(notifications.userId, c.get("user").id), eq(notifications.organizationId, c.get("org").organizationId));
}

notificationRoutes.get("/notifications/unread-count", ...gate, async (c) => {
	const since = new Date(Date.now() - KEEP_MS);
	const [row] = await c.get("db").select({ total: count() }).from(notifications).where(and(mine(c), isNull(notifications.readAt), gte(notifications.createdAt, since)));
	return c.json({ unread: row.total });
});

notificationRoutes.get("/notifications", ...gate, async (c) => {
	const db = c.get("db");
	const since = new Date(Date.now() - KEEP_MS);
	await db.delete(notifications).where(and(mine(c), lt(notifications.createdAt, since)));
	const rows = await db.select().from(notifications).where(mine(c)).orderBy(desc(notifications.createdAt), desc(notifications.id)).limit(PAGE);
	return c.json({
		notifications: rows.map((row) => ({
			id: row.id,
			kind: row.kind,
			category: row.category,
			params: JSON.parse(row.params) as Record<string, string | number>,
			href: row.href,
			createdAt: row.createdAt,
			read: row.readAt !== null,
		})),
		unread: rows.filter((row) => row.readAt === null).length,
	});
});

notificationRoutes.post("/notifications/read-all", ...gate, async (c) => {
	await c.get("db").update(notifications).set({ readAt: new Date() }).where(and(mine(c), isNull(notifications.readAt)));
	return c.json({ ok: true });
});

notificationRoutes.post("/notifications/:id/read", ...gate, async (c) => {
	const db = c.get("db");
	const id = Number(c.req.param("id"));
	const updated = await db.update(notifications).set({ readAt: new Date() }).where(and(mine(c), eq(notifications.id, id))).returning({ id: notifications.id });
	if (!updated.length) return jsonError(c, 404, "NOT_FOUND", "That notification doesn't exist.");
	return c.json({ ok: true });
});

notificationRoutes.delete("/notifications/:id", ...gate, async (c) => {
	const db = c.get("db");
	const removed = await db.delete(notifications).where(and(mine(c), eq(notifications.id, Number(c.req.param("id"))))).returning({ id: notifications.id });
	if (!removed.length) return jsonError(c, 404, "NOT_FOUND", "That notification doesn't exist.");
	return c.json({ ok: true });
});

notificationRoutes.get("/organizations/current/integrations", ...gate, requireRole("admin"), (c) => {
	return c.json({ assistantEnabled: c.get("org").assistantEnabled });
});

// Counts only, so admins can see how much of their allowance is left.
notificationRoutes.get("/organizations/current/assistant-usage", ...gate, requireRole("admin"), async (c) => {
	const db = c.get("db");
	const org = c.get("org");
	const [{ limits, source, planName, enabled, packMessages }, usage] = await Promise.all([
		getOrgAiLimits(db, org.organizationId),
		getOrgAiUsage(db, org.organizationId),
	]);
	return c.json({
		paused: !enabled,
		source,
		planName,
		packMessages,
		limits,
		usage: { day: usage.day, week: usage.week, month: usage.month },
		resets: { day: usage.periods.nextDay, week: usage.periods.nextWeek, month: usage.periods.nextMonth },
	});
});

notificationRoutes.put("/organizations/current/assistant", ...gate, requireRole("admin"), async (c) => {
	const db = c.get("db");
	const org = c.get("org");
	const enabled = (await readJson(c.req.raw)).enabled === true;
	await db.update(organizations).set({ assistantEnabled: enabled }).where(eq(organizations.id, org.organizationId));
	await db.insert(auditLog).values({ organizationId: org.organizationId, actorUserId: c.get("user").id, action: enabled ? "assistant.enabled" : "assistant.disabled", targetType: "organization", targetId: String(org.organizationId) });
	return c.json({ assistantEnabled: enabled });
});

// Goes only to the admin who asked, so it can't be used to send mail to anyone else.
notificationRoutes.post("/organizations/current/test-email", ...gate, requireRole("admin"), async (c) => {
	const user = c.get("user");
	try {
		await sendEmail(c.env, { to: user.email, subject: "AidNova test email", text: `This is a test from ${cleanText(c.get("org").name)} on AidNova. If you can read it, email is working.` });
		return c.json({ sentTo: user.email });
	} catch (error) {
		console.error(error);
		return jsonError(c, 502, "EMAIL_FAILED", "That email couldn't be sent.");
	}
});

notificationRoutes.get("/organizations/current/notification-settings", ...gate, requireRole("admin"), async (c) => {
	return c.json(await switchesFor(c.get("db"), c.get("org").organizationId));
});

notificationRoutes.put("/organizations/current/notification-settings", ...gate, requireRole("admin"), async (c) => {
	const body = await readJson(c.req.raw);
	const values = {
		policies: body.policies !== false,
		courses: body.courses !== false,
		announcements: body.announcements !== false,
		events: body.events !== false,
		welcome: body.welcome !== false,
	};
	const organizationId = c.get("org").organizationId;
	await c.get("db").insert(notificationSettings).values({ ...values, organizationId }).onConflictDoUpdate({ target: notificationSettings.organizationId, set: values });
	return c.json(values);
});

