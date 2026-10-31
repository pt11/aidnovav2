import { and, asc, count, desc, eq, gt, inArray, sql } from "drizzle-orm";
import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import type { Db } from "./db";
import {
	announcements,
	certificates,
	contentViews,
	courseEnrollments,
	courses,
	departments,
	fileAccessLog,
	orgFiles,
	policyAcknowledgments,
	quizAttempts,
	user,
	userProfiles,
} from "./db/schema";
import { memberPhotoUrl } from "./media";
import { organizations } from "./db/schema";
import {
	jsonError,
	requireOrg,
	requireRole,
	requireUser,
	type AppEnv,
} from "./middleware";
import { policyReportRows } from "./policies";
import { readJson } from "./validate";

// Coming back within this time counts as the same view, so refreshing a page or
// returning to the tab doesn't inflate the numbers.
const SAME_VIEW_MS = 30 * 60 * 1000;
const MAX_VIEWS_AT_ONCE = 100;
const DAY_MS = 24 * 60 * 60 * 1000;

type TargetType = "policy" | "announcement";

function viewStatement(
	db: Db,
	organizationId: number,
	targetType: TargetType,
	targetId: number,
	userId: string,
) {
	const now = Date.now();
	return db
		.insert(contentViews)
		.values({ organizationId, targetType, targetId, userId })
		.onConflictDoUpdate({
			target: [contentViews.targetType, contentViews.targetId, contentViews.userId],
			set: {
				viewCount: sql`${contentViews.viewCount} + (CASE WHEN ${contentViews.lastViewedAt} < ${now - SAME_VIEW_MS} THEN 1 ELSE 0 END)`,
				lastViewedAt: sql`${now}`,
			},
		});
}

export function recordView(
	db: Db,
	organizationId: number,
	targetType: TargetType,
	targetId: number,
	userId: string,
) {
	return viewStatement(db, organizationId, targetType, targetId, userId);
}

interface Person {
	userId: string;
	name: string;
	email: string;
	departmentId: number | null;
	departmentName: string | null;
	photoKey: string | null;
}

async function peopleIn(db: Db, organizationId: number, departmentId: number | null) {
	const rows = await db
		.select({
			userId: user.id,
			name: user.name,
			email: user.email,
			departmentId: userProfiles.departmentId,
			departmentName: departments.name,
			photoKey: userProfiles.photoKey,
		})
		.from(userProfiles)
		.innerJoin(user, eq(userProfiles.userId, user.id))
		.leftJoin(departments, eq(userProfiles.departmentId, departments.id))
		.where(
			and(eq(userProfiles.organizationId, organizationId), eq(userProfiles.isActive, true)),
		)
		.orderBy(asc(user.name));
	return departmentId === null ? rows : rows.filter((row) => row.departmentId === departmentId);
}

function personView({ photoKey, ...person }: Person) {
	return { ...person, photoUrl: memberPhotoUrl(person.userId, photoKey) };
}

function departmentParam(value: string | undefined) {
	const id = Number(value);
	return value && Number.isInteger(id) && id > 0 ? id : null;
}

// 0 means all time.
function periodStart(value: string | undefined) {
	const months = Number(value);
	if (!Number.isInteger(months) || months <= 0 || months > 60) return new Date(0);
	const start = new Date();
	start.setUTCMonth(start.getUTCMonth() - months);
	return start;
}

function monthKey(date: Date) {
	return date.toISOString().slice(0, 7);
}

async function courseRows(db: Db, organizationId: number, people: Person[]) {
	const [rows, enrollments, attempts] = await Promise.all([
		db
			.select({ id: courses.id, title: courses.title, isMandatory: courses.isMandatory })
			.from(courses)
			.where(and(eq(courses.organizationId, organizationId), eq(courses.status, "published")))
			.orderBy(asc(courses.title)),
		db
			.select({
				courseId: courseEnrollments.courseId,
				userId: courseEnrollments.userId,
				isAssigned: courseEnrollments.isAssigned,
				startedAt: courseEnrollments.startedAt,
				completedAt: courseEnrollments.completedAt,
			})
			.from(courseEnrollments)
			.innerJoin(courses, eq(courseEnrollments.courseId, courses.id))
			.where(eq(courses.organizationId, organizationId)),
		db
			.select({
				courseId: quizAttempts.courseId,
				userId: quizAttempts.userId,
				score: quizAttempts.score,
			})
			.from(quizAttempts)
			.innerJoin(courses, eq(quizAttempts.courseId, courses.id))
			.where(eq(courses.organizationId, organizationId)),
	]);
	const ids = new Set(people.map((person) => person.userId));
	const list = rows.map((course) => {
		const mine = enrollments.filter((row) => row.courseId === course.id && ids.has(row.userId));
		const enrolled = course.isMandatory ? ids.size : mine.filter((row) => row.isAssigned).length;
		const completed = mine.filter((row) => row.completedAt);
		const inProgress = mine.filter((row) => row.startedAt && !row.completedAt).length;
		const best = new Map<string, number>();
		for (const attempt of attempts) {
			if (attempt.courseId === course.id && ids.has(attempt.userId)) {
				best.set(attempt.userId, Math.max(best.get(attempt.userId) ?? 0, attempt.score));
			}
		}
		const scores = [...best.values()];
		return {
			id: course.id,
			title: course.title,
			isMandatory: course.isMandatory,
			enrolled,
			completed: completed.length,
			inProgress,
			notStarted: Math.max(0, enrolled - completed.length - inProgress),
			averageScore: scores.length
				? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
				: null,
		};
	});
	return { list, enrollments: enrollments.filter((row) => ids.has(row.userId)) };
}

export const reportRoutes = new Hono<AppEnv>();

const requireManager = requireRole("manager", "admin");

// An organization can keep person-by-person activity to its admins.
const requirePeopleAccess = createMiddleware<AppEnv>(async (c, next) => {
	const org = c.get("org");
	if (org.role !== "admin") {
		const [row] = await c
			.get("db")
			.select({ access: organizations.activityReportAccess })
			.from(organizations)
			.where(eq(organizations.id, org.organizationId));
		if (row?.access === "admins") {
			return jsonError(c, 403, "ACTIVITY_ADMINS_ONLY", "Only admins can see this in your organization.");
		}
	}
	await next();
});

reportRoutes.post("/announcements/views", requireUser, requireOrg, async (c) => {
	const db = c.get("db");
	const org = c.get("org");
	const { ids } = await readJson(c.req.raw);
	const list = Array.isArray(ids) ? [...new Set(ids as unknown[])] : [];
	if (
		list.length < 1 ||
		list.length > MAX_VIEWS_AT_ONCE ||
		!list.every((id) => Number.isInteger(id))
	) {
		return jsonError(c, 400, "INVALID_IDS", "Check the announcements.");
	}
	const real = await db
		.select({ id: announcements.id })
		.from(announcements)
		.where(
			and(
				eq(announcements.organizationId, org.organizationId),
				inArray(announcements.id, list as number[]),
			),
		);
	if (real.length > 0) {
		const statements = real.map((row) =>
			viewStatement(db, org.organizationId, "announcement", row.id, c.get("user").id),
		);
		await db.batch(statements as [(typeof statements)[number], ...typeof statements]);
	}
	return c.json({ ok: true });
});

// "Got it" tells whoever posted it that the person has read and understood it.
reportRoutes.post("/announcements/:id/respond", requireUser, requireOrg, async (c) => {
	const db = c.get("db");
	const org = c.get("org");
	const id = Number(c.req.param("id"));
	const [announcement] = Number.isInteger(id)
		? await db
				.select({ id: announcements.id })
				.from(announcements)
				.where(and(eq(announcements.id, id), eq(announcements.organizationId, org.organizationId)))
		: [];
	if (!announcement) return jsonError(c, 404, "NOT_FOUND", "That announcement doesn't exist.");
	const now = new Date();
	await db
		.insert(contentViews)
		.values({
			organizationId: org.organizationId,
			targetType: "announcement",
			targetId: id,
			userId: c.get("user").id,
			respondedAt: now,
		})
		.onConflictDoUpdate({
			target: [contentViews.targetType, contentViews.targetId, contentViews.userId],
			set: { respondedAt: now },
		});
	return c.json({ ok: true });
});

reportRoutes.get("/reports/overview", requireUser, requireOrg, requireManager, async (c) => {
	const db = c.get("db");
	const organizationId = c.get("org").organizationId;
	const departmentId = departmentParam(c.req.query("departmentId"));
	const start = periodStart(c.req.query("months"));
	const allPeople = await peopleIn(db, organizationId, null);
	const people = departmentId === null
		? allPeople
		: allPeople.filter((person) => person.departmentId === departmentId);
	const ids = new Set(people.map((person) => person.userId));
	const [policyRows, courseData, issued] = await Promise.all([
		policyReportRows(db, organizationId, departmentId),
		courseRows(db, organizationId, people),
		db
			.select({ userId: certificates.userId, issuedAt: certificates.issuedAt })
			.from(certificates)
			.where(
				and(eq(certificates.organizationId, organizationId), gt(certificates.issuedAt, start)),
			),
	]);
	const mandatory = policyRows.filter((policy) => policy.isMandatory);
	const required = mandatory.reduce((sum, policy) => sum + policy.required, 0);
	const acknowledged = mandatory.reduce((sum, policy) => sum + policy.acknowledged, 0);
	const enrolled = courseData.list.reduce((sum, course) => sum + course.enrolled, 0);
	const completed = courseData.list.reduce((sum, course) => sum + course.completed, 0);
	const finished = courseData.enrollments.filter((row) => row.startedAt && row.completedAt);
	const averageDays = finished.length
		? finished.reduce(
				(sum, row) =>
					sum + ((row.completedAt as Date).getTime() - (row.startedAt as Date).getTime()) / DAY_MS,
				0,
			) / finished.length
		: null;

	// Newest last, including quiet months so the chart's spacing stays true.
	const earliest = new Date(Math.max(start.getTime(), Date.now() - 365 * DAY_MS));
	const months: { month: string; started: number; completed: number }[] = [];
	const cursor = new Date(Date.UTC(earliest.getUTCFullYear(), earliest.getUTCMonth(), 1));
	while (cursor.getTime() <= Date.now()) {
		months.push({ month: monthKey(cursor), started: 0, completed: 0 });
		cursor.setUTCMonth(cursor.getUTCMonth() + 1);
	}
	const byMonth = new Map(months.map((row) => [row.month, row]));
	for (const row of courseData.enrollments) {
		if (row.startedAt) {
			const entry = byMonth.get(monthKey(row.startedAt));
			if (entry) entry.started++;
		}
		if (row.completedAt) {
			const entry = byMonth.get(monthKey(row.completedAt));
			if (entry) entry.completed++;
		}
	}

	return c.json({
		policies: { required, acknowledged, mandatoryPolicies: mandatory.length },
		courses: { enrolled, completed, averageDays: averageDays === null ? null : Number(averageDays.toFixed(1)) },
		certificates: issued.filter((row) => ids.has(row.userId)).length,
		months,
		courseList: courseData.list,
	});
});

reportRoutes.get("/reports/departments", requireUser, requireOrg, requireManager, async (c) => {
	const db = c.get("db");
	const organizationId = c.get("org").organizationId;
	const people = await peopleIn(db, organizationId, null);
	const groups = new Map<number | null, { name: string | null; people: Person[] }>();
	for (const person of people) {
		const group = groups.get(person.departmentId) ?? {
			name: person.departmentName,
			people: [],
		};
		group.people.push(person);
		groups.set(person.departmentId, group);
	}
	const rows = await Promise.all(
		[...groups.entries()].map(async ([departmentId, group]) => {
			const [policyRows, courseData] = await Promise.all([
				departmentId === null
					? policyReportRows(db, organizationId, "none")
					: policyReportRows(db, organizationId, departmentId),
				courseRows(db, organizationId, group.people),
			]);
			const mandatory = policyRows.filter((policy) => policy.isMandatory);
			return {
				id: departmentId,
				name: group.name,
				members: group.people.length,
				required: mandatory.reduce((sum, policy) => sum + policy.required, 0),
				acknowledged: mandatory.reduce((sum, policy) => sum + policy.acknowledged, 0),
				enrolled: courseData.list.reduce((sum, course) => sum + course.enrolled, 0),
				completed: courseData.list.reduce((sum, course) => sum + course.completed, 0),
				inProgress: courseData.list.reduce((sum, course) => sum + course.inProgress, 0),
			};
		}),
	);
	rows.sort((a, b) => (a.name === null ? 1 : b.name === null ? -1 : a.name.localeCompare(b.name)));
	return c.json({ departments: rows });
});

reportRoutes.get("/reports/policies", requireUser, requireOrg, requireManager, async (c) => {
	const db = c.get("db");
	const organizationId = c.get("org").organizationId;
	const departmentId = departmentParam(c.req.query("departmentId"));
	const [rows, people, views] = await Promise.all([
		policyReportRows(db, organizationId, departmentId),
		peopleIn(db, organizationId, departmentId),
		db
			.select({
				targetId: contentViews.targetId,
				userId: contentViews.userId,
				viewCount: contentViews.viewCount,
			})
			.from(contentViews)
			.where(
				and(
					eq(contentViews.organizationId, organizationId),
					eq(contentViews.targetType, "policy"),
				),
			),
	]);
	const ids = new Set(people.map((person) => person.userId));
	return c.json({
		policies: rows.map((policy) => {
			const mine = views.filter((view) => view.targetId === policy.id && ids.has(view.userId));
			return {
				id: policy.id,
				title: policy.title,
				category: policy.category,
				isMandatory: policy.isMandatory,
				version: policy.version,
				required: policy.required,
				acknowledged: policy.acknowledged,
				viewers: mine.length,
				views: mine.reduce((sum, view) => sum + view.viewCount, 0),
			};
		}),
	});
});

reportRoutes.get("/reports/policies/:id/people", requireUser, requireOrg, requireManager, requirePeopleAccess, async (c) => {
	const db = c.get("db");
	const organizationId = c.get("org").organizationId;
	const id = Number(c.req.param("id"));
	const rows = await policyReportRows(db, organizationId, null);
	const policy = rows.find((row) => row.id === id);
	if (!policy) return jsonError(c, 404, "NOT_FOUND", "That policy doesn't exist.");
	const [people, views, acks] = await Promise.all([
		peopleIn(db, organizationId, null),
		db
			.select()
			.from(contentViews)
			.where(and(eq(contentViews.targetType, "policy"), eq(contentViews.targetId, id))),
		db
			.select({
				userId: policyAcknowledgments.userId,
				acknowledgedAt: policyAcknowledgments.acknowledgedAt,
			})
			.from(policyAcknowledgments)
			.where(
				and(
					eq(policyAcknowledgments.policyId, id),
					eq(policyAcknowledgments.policyVersion, policy.version),
				),
			),
	]);
	const viewBy = new Map(views.map((row) => [row.userId, row]));
	const ackBy = new Map(acks.map((row) => [row.userId, row.acknowledgedAt]));
	const audience = new Set(policy.audienceIds);
	return c.json({
		title: policy.title,
		people: people
			.filter((person) => audience.has(person.userId) || viewBy.has(person.userId))
			.map((person) => ({
				...personView(person),
				views: viewBy.get(person.userId)?.viewCount ?? 0,
				lastViewedAt: viewBy.get(person.userId)?.lastViewedAt ?? null,
				acknowledgedAt: ackBy.get(person.userId) ?? null,
			})),
	});
});

reportRoutes.get("/reports/announcements", requireUser, requireOrg, requireManager, async (c) => {
	const db = c.get("db");
	const organizationId = c.get("org").organizationId;
	const start = periodStart(c.req.query("months"));
	const departmentId = departmentParam(c.req.query("departmentId"));
	const [rows, people, views] = await Promise.all([
		db
			.select({
				id: announcements.id,
				title: announcements.title,
				priority: announcements.priority,
				createdAt: announcements.createdAt,
			})
			.from(announcements)
			.where(
				and(eq(announcements.organizationId, organizationId), gt(announcements.createdAt, start)),
			)
			.orderBy(desc(announcements.createdAt))
			.limit(200),
		peopleIn(db, organizationId, departmentId),
		db
			.select({
				targetId: contentViews.targetId,
				userId: contentViews.userId,
				viewCount: contentViews.viewCount,
				respondedAt: contentViews.respondedAt,
			})
			.from(contentViews)
			.where(
				and(
					eq(contentViews.organizationId, organizationId),
					eq(contentViews.targetType, "announcement"),
				),
			),
	]);
	const ids = new Set(people.map((person) => person.userId));
	return c.json({
		audience: ids.size,
		announcements: rows.map((row) => {
			const mine = views.filter((view) => view.targetId === row.id && ids.has(view.userId));
			return {
				...row,
				viewers: mine.filter((view) => view.viewCount > 0).length,
				views: mine.reduce((sum, view) => sum + view.viewCount, 0),
				responses: mine.filter((view) => view.respondedAt).length,
			};
		}),
	});
});

reportRoutes.get("/reports/announcements/:id/people", requireUser, requireOrg, requireManager, requirePeopleAccess, async (c) => {
	const db = c.get("db");
	const organizationId = c.get("org").organizationId;
	const id = Number(c.req.param("id"));
	const [announcement] = Number.isInteger(id)
		? await db
				.select({ title: announcements.title })
				.from(announcements)
				.where(and(eq(announcements.id, id), eq(announcements.organizationId, organizationId)))
		: [];
	if (!announcement) return jsonError(c, 404, "NOT_FOUND", "That announcement doesn't exist.");
	const [people, views] = await Promise.all([
		peopleIn(db, organizationId, null),
		db
			.select()
			.from(contentViews)
			.where(and(eq(contentViews.targetType, "announcement"), eq(contentViews.targetId, id))),
	]);
	const viewBy = new Map(views.map((row) => [row.userId, row]));
	return c.json({
		title: announcement.title,
		people: people.map((person) => ({
			...personView(person),
			views: viewBy.get(person.userId)?.viewCount ?? 0,
			lastViewedAt: viewBy.get(person.userId)?.lastViewedAt ?? null,
			respondedAt: viewBy.get(person.userId)?.respondedAt ?? null,
		})),
	});
});

reportRoutes.get("/reports/files", requireUser, requireOrg, requireManager, async (c) => {
	const db = c.get("db");
	const organizationId = c.get("org").organizationId;
	const start = periodStart(c.req.query("months"));
	const departmentId = departmentParam(c.req.query("departmentId"));
	const [files, people, activity] = await Promise.all([
		db
			.select({
				id: orgFiles.id,
				name: orgFiles.name,
				fileType: orgFiles.fileType,
				sizeBytes: orgFiles.sizeBytes,
				createdAt: orgFiles.createdAt,
			})
			.from(orgFiles)
			.where(eq(orgFiles.organizationId, organizationId))
			.orderBy(asc(orgFiles.name)),
		peopleIn(db, organizationId, departmentId),
		db
			.select({
				fileId: fileAccessLog.orgFileId,
				userId: fileAccessLog.userId,
				action: fileAccessLog.action,
				total: count(),
			})
			.from(fileAccessLog)
			.where(
				and(
					eq(fileAccessLog.organizationId, organizationId),
					gt(fileAccessLog.accessedAt, start),
				),
			)
			.groupBy(fileAccessLog.orgFileId, fileAccessLog.userId, fileAccessLog.action),
	]);
	const ids = new Set(people.map((person) => person.userId));
	return c.json({
		files: files.map((file) => {
			const mine = activity.filter((row) => row.fileId === file.id && ids.has(row.userId));
			const opens = mine.filter((row) => row.action === "view");
			const downloads = mine.filter((row) => row.action === "download");
			return {
				...file,
				views: opens.reduce((sum, row) => sum + row.total, 0),
				downloads: downloads.reduce((sum, row) => sum + row.total, 0),
				people: new Set(
					mine.filter((row) => row.action !== "pin_failed").map((row) => row.userId),
				).size,
			};
		}),
	});
});

reportRoutes.get("/reports/files/:id/people", requireUser, requireOrg, requireManager, requirePeopleAccess, async (c) => {
	const db = c.get("db");
	const organizationId = c.get("org").organizationId;
	const id = Number(c.req.param("id"));
	const [file] = Number.isInteger(id)
		? await db
				.select({ name: orgFiles.name, fileType: orgFiles.fileType })
				.from(orgFiles)
				.where(and(eq(orgFiles.id, id), eq(orgFiles.organizationId, organizationId)))
		: [];
	if (!file) return jsonError(c, 404, "NOT_FOUND", "That file doesn't exist.");
	const [people, activity] = await Promise.all([
		peopleIn(db, organizationId, null),
		db
			.select({
				userId: fileAccessLog.userId,
				action: fileAccessLog.action,
				total: count(),
				last: sql<number>`max(${fileAccessLog.accessedAt})`,
			})
			.from(fileAccessLog)
			.where(eq(fileAccessLog.orgFileId, id))
			.groupBy(fileAccessLog.userId, fileAccessLog.action),
	]);
	return c.json({
		title: file.name,
		people: people
			.map((person) => {
				const mine = activity.filter(
					(row) => row.userId === person.userId && row.action !== "pin_failed",
				);
				const last = mine.length ? Math.max(...mine.map((row) => row.last)) : null;
				return {
					...personView(person),
					views: mine.find((row) => row.action === "view")?.total ?? 0,
					downloads: mine.find((row) => row.action === "download")?.total ?? 0,
					lastViewedAt: last ? new Date(last) : null,
				};
			})
			.sort((a, b) => b.views + b.downloads - (a.views + a.downloads)),
	});
});
