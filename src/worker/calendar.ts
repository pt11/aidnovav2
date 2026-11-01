import { and, asc, eq, gte, lt, or } from "drizzle-orm";
import { Hono } from "hono";
import type { Db } from "./db";
import { auditLog, calendarEvents, policies, user } from "./db/schema";
import {
	jsonError,
	requireOrg,
	requireRole,
	requireUser,
	type AppEnv,
} from "./middleware";
import { cleanText, isSafeLink, readJson } from "./validate";
import { activeMemberIds, notifyPeople } from "./notifications";

const EVENT_TYPES = ["training", "meeting", "deadline", "holiday"] as const;
type EventType = (typeof EVENT_TYPES)[number];
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_RANGE_MS = 400 * DAY_MS;
const UPCOMING_LIMIT = 3;

function readEvent(body: Record<string, unknown>) {
	const title = cleanText(body.title);
	const location = cleanText(body.location);
	const meetingUrl = cleanText(body.meetingUrl);
	const details = cleanText(body.details, { multiline: true });
	const type = body.type as EventType;
	const startsAt = new Date(String(body.startsAt));
	const endsAt = new Date(String(body.endsAt));
	if (
		title.length < 1 ||
		title.length > 200 ||
		location.length > 300 ||
		details.length > 2000 ||
		!EVENT_TYPES.includes(type) ||
		typeof body.allDay !== "boolean" ||
		Number.isNaN(startsAt.getTime()) ||
		Number.isNaN(endsAt.getTime())
	) {
		return { error: "INVALID_EVENT" as const };
	}
	if (endsAt < startsAt) return { error: "END_BEFORE_START" as const };
	if (meetingUrl && !isSafeLink(meetingUrl, ["https:"])) {
		return { error: "INVALID_LINK" as const };
	}
	return {
		values: {
			title,
			type,
			startsAt,
			endsAt,
			allDay: body.allDay,
			location: location || null,
			meetingUrl: meetingUrl || null,
			details: details || null,
		},
	};
}

const EVENT_FIELDS = {
	id: calendarEvents.id,
	title: calendarEvents.title,
	type: calendarEvents.type,
	startsAt: calendarEvents.startsAt,
	endsAt: calendarEvents.endsAt,
	allDay: calendarEvents.allDay,
	location: calendarEvents.location,
	meetingUrl: calendarEvents.meetingUrl,
	details: calendarEvents.details,
};

export async function upcomingEvents(db: Db, organizationId: number) {
	const now = new Date();
	// All-day events end at midnight UTC on their last day, and still count all that day.
	const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
	return db
		.select(EVENT_FIELDS)
		.from(calendarEvents)
		.where(
			and(
				eq(calendarEvents.organizationId, organizationId),
				or(
					gte(calendarEvents.endsAt, now),
					and(eq(calendarEvents.allDay, true), gte(calendarEvents.endsAt, startOfToday)),
				),
			),
		)
		.orderBy(asc(calendarEvents.startsAt))
		.limit(UPCOMING_LIMIT);
}

export const calendarRoutes = new Hono<AppEnv>();

const requireManager = requireRole("manager", "admin");

calendarRoutes.get("/events", requireUser, requireOrg, async (c) => {
	const db = c.get("db");
	const org = c.get("org");
	const from = new Date(Number(c.req.query("from")));
	const to = new Date(Number(c.req.query("to")));
	if (
		Number.isNaN(from.getTime()) ||
		Number.isNaN(to.getTime()) ||
		to <= from ||
		to.getTime() - from.getTime() > MAX_RANGE_MS
	) {
		return jsonError(c, 400, "INVALID_RANGE", "Choose a valid date range.");
	}
	const isManager = org.role !== "staff";
	const [rows, reviews] = await Promise.all([
		db
			.select({ ...EVENT_FIELDS, createdByName: user.name })
			.from(calendarEvents)
			.leftJoin(user, eq(calendarEvents.createdBy, user.id))
			.where(
				and(
					eq(calendarEvents.organizationId, org.organizationId),
					lt(calendarEvents.startsAt, to),
					gte(calendarEvents.endsAt, from),
				),
			)
			.orderBy(asc(calendarEvents.startsAt))
			.limit(1000),
		// Review dates only matter to the people who look after the policies.
		isManager
			? db
					.select({ id: policies.id, title: policies.title, reviewDate: policies.reviewDate })
					.from(policies)
					.where(
						and(
							eq(policies.organizationId, org.organizationId),
							eq(policies.status, "published"),
							gte(policies.reviewDate, from),
							lt(policies.reviewDate, to),
						),
					)
			: Promise.resolve([]),
	]);
	return c.json({
		events: rows,
		policyReviews: reviews,
	});
});

calendarRoutes.post("/events", requireUser, requireOrg, requireManager, async (c) => {
	const db = c.get("db");
	const org = c.get("org");
	const parsed = readEvent(await readJson(c.req.raw));
	if ("error" in parsed) {
		return jsonError(c, 400, parsed.error as string, "Check the event details.");
	}
	const [created] = await db
		.insert(calendarEvents)
		.values({
			...parsed.values,
			organizationId: org.organizationId,
			createdBy: c.get("user").id,
		})
		.returning({ id: calendarEvents.id });
	await db.insert(auditLog).values({
		organizationId: org.organizationId,
		actorUserId: c.get("user").id,
		action: "event.created",
		targetType: "event",
		targetId: String(created.id),
	});
	await notifyPeople(c, await activeMemberIds(db, org.organizationId), "event_new", { title: parsed.values.title }, "/calendar");
	return c.json(created, 201);
});

calendarRoutes.patch("/events/:id", requireUser, requireOrg, requireManager, async (c) => {
	const db = c.get("db");
	const org = c.get("org");
	const id = Number(c.req.param("id"));
	const parsed = readEvent(await readJson(c.req.raw));
	if ("error" in parsed) {
		return jsonError(c, 400, parsed.error as string, "Check the event details.");
	}
	const updated = Number.isInteger(id)
		? await db
				.update(calendarEvents)
				.set(parsed.values)
				.where(
					and(eq(calendarEvents.id, id), eq(calendarEvents.organizationId, org.organizationId)),
				)
				.returning({ id: calendarEvents.id })
		: [];
	if (updated.length === 0) return jsonError(c, 404, "NOT_FOUND", "That event doesn't exist.");
	return c.json({ ok: true });
});

calendarRoutes.delete("/events/:id", requireUser, requireOrg, requireManager, async (c) => {
	const db = c.get("db");
	const org = c.get("org");
	const id = Number(c.req.param("id"));
	const removed = Number.isInteger(id)
		? await db
				.delete(calendarEvents)
				.where(
					and(eq(calendarEvents.id, id), eq(calendarEvents.organizationId, org.organizationId)),
				)
				.returning({ title: calendarEvents.title })
		: [];
	if (removed.length === 0) return jsonError(c, 404, "NOT_FOUND", "That event doesn't exist.");
	await db.insert(auditLog).values({
		organizationId: org.organizationId,
		actorUserId: c.get("user").id,
		action: "event.deleted",
		targetType: "event",
		targetId: String(id),
		metadata: JSON.stringify({ title: removed[0].title }),
	});
	return c.json({ ok: true });
});
