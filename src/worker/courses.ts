import { and, asc, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { Context } from "hono";
import { Hono } from "hono";
import type { Db } from "./db";
import {
	auditLog,
	certificates,
	courseEnrollments,
	courseLessons,
	courseModules,
	courses,
	departments,
	fileAccessDepartments,
	folderAccessDepartments,
	hubFolders,
	lessonMaterials,
	lessonProgress,
	materialProgress,
	orgFiles,
	organizations,
	quizAttempts,
	quizQuestions,
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
import { getOrgLimits, getStorageUsed } from "./plans";
import { cleanText, isSafeLink, readJson } from "./validate";

const MAX_COVER_BYTES = 2 * 1024 * 1024;
const MAX_MATERIAL_BYTES = 50 * 1024 * 1024;
const MAX_VIDEO_BYTES = 2 * 1024 * 1024 * 1024;
// A big video goes up in pieces, so a dropped connection only loses one piece.
const VIDEO_PART_BYTES = 10 * 1024 * 1024;
const MAX_QUESTIONS = 200;
const MAX_OPTIONS = 10;
const MAX_PAGES = 5000;

const COVER_TYPES: Record<string, string> = {
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	png: "image/png",
	webp: "image/webp",
};
// The type comes from these lists, never from the browser.
const MATERIAL_TYPES: Record<string, string> = {
	pdf: "application/pdf",
	doc: "application/msword",
	docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	ppt: "application/vnd.ms-powerpoint",
	pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
	xls: "application/vnd.ms-excel",
	xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};
// Formats every current browser plays, because a required video has to play.
const VIDEO_TYPES: Record<string, string> = {
	mp4: "video/mp4",
	webm: "video/webm",
};
const ALLOWED_MIME = new Set([
	...Object.values(MATERIAL_TYPES),
	...Object.values(VIDEO_TYPES),
]);
const SHEET_MIME = new Set([MATERIAL_TYPES.xls, MATERIAL_TYPES.xlsx]);

type MaterialKind = "pdf" | "video" | "document" | "sheet";

function kindOf(mimeType: string): MaterialKind {
	if (mimeType === MATERIAL_TYPES.pdf) return "pdf";
	if (mimeType.startsWith("video/")) return "video";
	if (SHEET_MIME.has(mimeType)) return "sheet";
	return "document";
}

// A spreadsheet can't be followed through in a lesson, so it's only ever extra.
function canBeRequired(mimeType: string) {
	return kindOf(mimeType) !== "sheet";
}

function extensionOf(name: string) {
	const dot = name.lastIndexOf(".");
	return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

function isManager(org: Membership) {
	return org.role === "manager" || org.role === "admin";
}

function idOf(value: string | undefined) {
	const id = Number(value);
	return Number.isInteger(id) && id > 0 ? id : null;
}

function contentDisposition(type: "inline" | "attachment", name: string) {
	const ascii = name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
	return `${type}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

// Only these two sites can be shown inside a lesson, at addresses built here.
export function videoEmbedUrl(link: string | null) {
	if (!link || !isSafeLink(link, ["https:"])) return null;
	const url = new URL(link);
	const host = url.hostname.replace(/^(www|m)\./, "");
	let youtubeId: string | null | undefined;
	if (host === "youtu.be") youtubeId = url.pathname.split("/")[1];
	if (host === "youtube.com" || host === "youtube-nocookie.com") {
		const [, first, second] = url.pathname.split("/");
		youtubeId =
			first === "watch"
				? url.searchParams.get("v")
				: first === "embed" || first === "shorts" || first === "live"
					? second
					: null;
	}
	if (youtubeId) {
		return /^[\w-]{6,20}$/.test(youtubeId)
			? `https://www.youtube-nocookie.com/embed/${youtubeId}`
			: null;
	}
	if (host === "vimeo.com" || host === "player.vimeo.com") {
		const match = url.pathname.match(/^\/(?:video\/)?(\d{5,12})(?:\/([0-9a-f]{6,20}))?\/?$/);
		if (!match) return null;
		const hash = match[2] ?? url.searchParams.get("h");
		const safeHash = hash && /^[0-9a-f]{6,20}$/.test(hash) ? hash : null;
		return `https://player.vimeo.com/video/${match[1]}${safeHash ? `?h=${safeHash}` : ""}`;
	}
	return null;
}

function audit(
	db: Db,
	organizationId: number,
	actorUserId: string,
	action: string,
	courseId: number,
	metadata?: Record<string, unknown>,
) {
	return db.insert(auditLog).values({
		organizationId,
		actorUserId,
		action,
		targetType: "course",
		targetId: String(courseId),
		metadata: metadata ? JSON.stringify(metadata) : null,
	});
}

async function findCourse(db: Db, id: number | null, organizationId: number) {
	if (id === null) return null;
	const [course] = await db
		.select()
		.from(courses)
		.where(and(eq(courses.id, id), eq(courses.organizationId, organizationId)));
	return course ?? null;
}

type Course = typeof courses.$inferSelect;
type Material = typeof lessonMaterials.$inferSelect;

async function findLesson(db: Db, courseId: number, id: number | null) {
	if (id === null) return null;
	const [lesson] = await db
		.select()
		.from(courseLessons)
		.where(and(eq(courseLessons.id, id), eq(courseLessons.courseId, courseId)));
	return lesson ?? null;
}

async function findModule(db: Db, courseId: number, id: number | null) {
	if (id === null) return null;
	const [module] = await db
		.select()
		.from(courseModules)
		.where(and(eq(courseModules.id, id), eq(courseModules.courseId, courseId)));
	return module ?? null;
}

async function findMaterial(db: Db, courseId: number, id: number | null) {
	if (id === null) return null;
	const [material] = await db
		.select()
		.from(lessonMaterials)
		.where(and(eq(lessonMaterials.id, id), eq(lessonMaterials.courseId, courseId)));
	return material ?? null;
}

async function nextOrder(
	db: Db,
	table: typeof courseModules | typeof quizQuestions,
	courseId: number,
) {
	const [row] = await db
		.select({ last: sql<number | null>`max(${table.sortOrder})` })
		.from(table)
		.where(eq(table.courseId, courseId));
	return (row.last ?? -1) + 1;
}

// Why a Hub file can't be shown to a course's learners, or null if it can.
// Limited files stay out: enrolled staff may be outside the departments allowed.
async function hubFileProblems(db: Db, organizationId: number) {
	const [folders, fileLimits, folderLimits] = await Promise.all([
		db
			.select({ id: hubFolders.id, pinHash: hubFolders.pinHash, name: hubFolders.name })
			.from(hubFolders)
			.where(eq(hubFolders.organizationId, organizationId)),
		db
			.select({ fileId: fileAccessDepartments.fileId })
			.from(fileAccessDepartments)
			.innerJoin(departments, eq(fileAccessDepartments.departmentId, departments.id))
			.where(eq(departments.organizationId, organizationId)),
		db
			.select({ folderId: folderAccessDepartments.folderId })
			.from(folderAccessDepartments)
			.innerJoin(departments, eq(folderAccessDepartments.departmentId, departments.id))
			.where(eq(departments.organizationId, organizationId)),
	]);
	const pinnedFolders = new Set(folders.filter((f) => f.pinHash).map((f) => f.id));
	const limitedFiles = new Set(fileLimits.map((row) => row.fileId));
	const limitedFolders = new Set(folderLimits.map((row) => row.folderId));
	return {
		folders: new Map(folders.map((folder) => [folder.id, folder.name])),
		problem(file: { id: number; pinHash: string | null; folderId: number | null }) {
			if (file.pinHash || (file.folderId && pinnedFolders.has(file.folderId))) return "pin";
			if (
				limitedFiles.has(file.id) ||
				(file.folderId && limitedFolders.has(file.folderId))
			) {
				return "limited";
			}
			return null;
		},
	};
}

// Hub files can gain a PIN or limits after being attached. Learners then lose
// them, and a required one stops counting so nobody gets stuck on it.
async function usableMaterialIds(db: Db, organizationId: number, materials: Material[]) {
	const hubIds = materials.flatMap((m) => (m.fileId ? [m.fileId] : []));
	const usable = new Set(materials.filter((m) => !m.fileId && !m.uploadId).map((m) => m.id));
	if (hubIds.length === 0) return usable;
	const [files, checks] = await Promise.all([
		db
			.select({ id: orgFiles.id, pinHash: orgFiles.pinHash, folderId: orgFiles.folderId })
			.from(orgFiles)
			.where(eq(orgFiles.organizationId, organizationId)),
		hubFileProblems(db, organizationId),
	]);
	const byId = new Map(files.map((file) => [file.id, file]));
	for (const material of materials) {
		const file = material.fileId ? byId.get(material.fileId) : undefined;
		if (file && !checks.problem(file)) usable.add(material.id);
	}
	return usable;
}

async function loadOutline(db: Db, courseId: number) {
	const [modules, lessons, [questions]] = await Promise.all([
		db
			.select({
				id: courseModules.id,
				title: courseModules.title,
				sortOrder: courseModules.sortOrder,
			})
			.from(courseModules)
			.where(eq(courseModules.courseId, courseId))
			.orderBy(asc(courseModules.sortOrder), asc(courseModules.id)),
		db
			.select({
				id: courseLessons.id,
				moduleId: courseLessons.moduleId,
				title: courseLessons.title,
				isRequired: courseLessons.isRequired,
				estimatedTime: courseLessons.estimatedTime,
				sortOrder: courseLessons.sortOrder,
			})
			.from(courseLessons)
			.where(eq(courseLessons.courseId, courseId))
			.orderBy(asc(courseLessons.sortOrder), asc(courseLessons.id)),
		db
			.select({ total: count() })
			.from(quizQuestions)
			.where(eq(quizQuestions.courseId, courseId)),
	]);
	return { modules, lessons, questionCount: questions.total };
}

// Lessons in the order staff meet them: module by module.
function orderedLessons(outline: Awaited<ReturnType<typeof loadOutline>>) {
	return outline.modules.flatMap((module) =>
		outline.lessons.filter((lesson) => lesson.moduleId === module.id),
	);
}

async function nextMaterialOrder(db: Db, lessonId: number) {
	const [row] = await db
		.select({ last: sql<number | null>`max(${lessonMaterials.sortOrder})` })
		.from(lessonMaterials)
		.where(eq(lessonMaterials.lessonId, lessonId));
	return (row.last ?? -1) + 1;
}

async function publishProblem(db: Db, course: Course) {
	const [lessons, materials] = await Promise.all([
		db
			.select({
				id: courseLessons.id,
				content: courseLessons.content,
				videoUrl: courseLessons.videoUrl,
			})
			.from(courseLessons)
			.where(eq(courseLessons.courseId, course.id)),
		db
			.select({ lessonId: lessonMaterials.lessonId })
			.from(lessonMaterials)
			.where(
				and(eq(lessonMaterials.courseId, course.id), isNull(lessonMaterials.uploadId)),
			),
	]);
	const withFiles = new Set(materials.map((m) => m.lessonId));
	const ready = lessons.some(
		(lesson) => lesson.content || lesson.videoUrl || withFiles.has(lesson.id),
	);
	return ready ? null : "NO_CONTENT";
}

// Everyone in the organization for a mandatory course, otherwise who was assigned.
async function learnerAccess(db: Db, course: Course, userId: string) {
	const [enrollment] = await db
		.select()
		.from(courseEnrollments)
		.where(and(eq(courseEnrollments.courseId, course.id), eq(courseEnrollments.userId, userId)));
	const enrolled =
		course.status === "published" && (course.isMandatory || Boolean(enrollment?.isAssigned));
	return { enrollment: enrollment ?? null, enrolled };
}

async function markStarted(db: Db, courseId: number, userId: string) {
	await db
		.insert(courseEnrollments)
		.values({ courseId, userId, startedAt: new Date() })
		.onConflictDoUpdate({
			target: [courseEnrollments.courseId, courseEnrollments.userId],
			set: { startedAt: sql`coalesce(${courseEnrollments.startedAt}, ${Date.now()})` },
		});
}

async function learnerState(db: Db, course: Course, userId: string) {
	const [outline, done, attempts] = await Promise.all([
		loadOutline(db, course.id),
		db
			.select({ lessonId: lessonProgress.lessonId })
			.from(lessonProgress)
			.where(and(eq(lessonProgress.courseId, course.id), eq(lessonProgress.userId, userId))),
		db
			.select({ passed: quizAttempts.passed })
			.from(quizAttempts)
			.where(and(eq(quizAttempts.courseId, course.id), eq(quizAttempts.userId, userId))),
	]);
	const doneIds = new Set(done.map((row) => row.lessonId));
	const required = outline.lessons.filter((lesson) => lesson.isRequired);
	const requiredDone = required.filter((lesson) => doneIds.has(lesson.id)).length;
	const hasQuiz = outline.questionCount > 0;
	const quizPassed = attempts.some((attempt) => attempt.passed);
	const lessonsFinished = required.length === requiredDone && doneIds.size > 0;
	const quizUnlocked = required.length === requiredDone;
	const steps = required.length + (hasQuiz ? 1 : 0);
	const stepsDone = requiredDone + (hasQuiz && quizPassed ? 1 : 0);
	return {
		outline,
		doneIds,
		hasQuiz,
		quizPassed,
		quizUnlocked,
		attempts: attempts.length,
		percent: steps === 0 ? 0 : Math.round((stepsDone / steps) * 100),
		ready: (lessonsFinished || (required.length === 0 && hasQuiz)) && (!hasQuiz || quizPassed),
	};
}

// Finishing is permanent, so changing a course later doesn't undo anyone's work.
async function completeIfFinished(
	db: Db,
	course: Course,
	org: Membership,
	currentUser: { id: string; name: string },
	score: number | null,
) {
	const state = await learnerState(db, course, currentUser.id);
	if (!state.ready) return { completed: false, certificateId: null };
	await db
		.update(courseEnrollments)
		.set({ completedAt: sql`coalesce(${courseEnrollments.completedAt}, ${Date.now()})` })
		.where(
			and(
				eq(courseEnrollments.courseId, course.id),
				eq(courseEnrollments.userId, currentUser.id),
			),
		);
	if (!course.certificateEnabled) return { completed: true, certificateId: null };
	const [organization] = await db
		.select({ name: organizations.name })
		.from(organizations)
		.where(eq(organizations.id, org.organizationId));
	const bytes = crypto.getRandomValues(new Uint8Array(6));
	const code = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
	await db
		.insert(certificates)
		.values({
			organizationId: org.organizationId,
			courseId: course.id,
			userId: currentUser.id,
			recipientName: currentUser.name,
			courseTitle: course.title,
			organizationName: organization.name,
			score,
			code,
		})
		.onConflictDoNothing();
	const [certificate] = await db
		.select({ id: certificates.id })
		.from(certificates)
		.where(and(eq(certificates.courseId, course.id), eq(certificates.userId, currentUser.id)));
	return { completed: true, certificateId: certificate?.id ?? null };
}

function courseText(body: Record<string, unknown>) {
	return {
		title: cleanText(body.title),
		description: cleanText(body.description, { multiline: true }),
		objectives: cleanText(body.objectives, { multiline: true }),
		duration: cleanText(body.duration),
	};
}

function courseTextProblem(text: ReturnType<typeof courseText>) {
	return (
		text.title.length < 1 ||
		text.title.length > 200 ||
		text.description.length > 2000 ||
		text.objectives.length > 2000 ||
		text.duration.length > 50
	);
}

interface QuizOption {
	text: string;
	correct: boolean;
}

function parseQuestion(body: Record<string, unknown>) {
	const question = cleanText(body.question, { multiline: true });
	const type = body.type;
	if (
		question.length < 1 ||
		question.length > 1000 ||
		(type !== "single" && type !== "multiple" && type !== "truefalse") ||
		!Array.isArray(body.options) ||
		body.options.length < 2 ||
		body.options.length > MAX_OPTIONS
	) {
		return null;
	}
	const options: QuizOption[] = [];
	for (const raw of body.options as unknown[]) {
		const option = (raw ?? {}) as Record<string, unknown>;
		const text = cleanText(option.text);
		if (text.length < 1 || text.length > 500 || typeof option.correct !== "boolean") {
			return null;
		}
		options.push({ text, correct: option.correct });
	}
	const correct = options.filter((option) => option.correct).length;
	if (type === "multiple" ? correct < 1 : correct !== 1) return null;
	if (type === "truefalse" && options.length !== 2) return null;
	return { question, type, options: JSON.stringify(options) } as const;
}

function sameAnswers(chosen: number[], options: QuizOption[]) {
	const right = options.flatMap((option, index) => (option.correct ? [index] : []));
	return (
		chosen.length === right.length && [...chosen].sort((a, b) => a - b).every((v, i) => v === right[i])
	);
}

async function reachesStorageLimit(db: Db, organizationId: number, bytes: number) {
	const [used, limits] = await Promise.all([
		getStorageUsed(db, organizationId),
		getOrgLimits(db, organizationId),
	]);
	return limits.storageLimitBytes !== null && used + bytes > limits.storageLimitBytes;
}

async function deleteStored(bucket: R2Bucket, keys: (string | null)[]) {
	const real = keys.filter((key): key is string => Boolean(key));
	if (real.length > 0) await bucket.delete(real);
}

async function abortUpload(bucket: R2Bucket, material: Material) {
	if (!material.uploadId || !material.storageKey) return;
	await bucket
		.resumeMultipartUpload(material.storageKey, material.uploadId)
		.abort()
		.catch(() => undefined);
}

function materialView(material: Material) {
	return {
		id: material.id,
		name: material.name,
		kind: kindOf(material.mimeType),
		sizeBytes: material.sizeBytes,
		isRequired: material.isRequired,
		pageCount: material.pageCount,
		fromHub: material.fileId !== null,
		uploading: material.uploadId !== null,
	};
}

export const courseRoutes = new Hono<AppEnv>();

const requireManager = requireRole("manager", "admin");

courseRoutes.get("/courses", requireUser, requireOrg, async (c) => {
	const db = c.get("db");
	const org = c.get("org");
	const userId = c.get("user").id;
	const [rows, modules, lessons, questions, members, enrollments, mine, done] = await Promise.all([
		db
			.select()
			.from(courses)
			.where(eq(courses.organizationId, org.organizationId))
			.orderBy(desc(courses.updatedAt), desc(courses.id)),
		db
			.select({ courseId: courseModules.courseId, total: count() })
			.from(courseModules)
			.innerJoin(courses, eq(courseModules.courseId, courses.id))
			.where(eq(courses.organizationId, org.organizationId))
			.groupBy(courseModules.courseId),
		db
			.select({
				courseId: courseLessons.courseId,
				total: count(),
				required: sql<number>`sum(${courseLessons.isRequired})`,
			})
			.from(courseLessons)
			.innerJoin(courses, eq(courseLessons.courseId, courses.id))
			.where(eq(courses.organizationId, org.organizationId))
			.groupBy(courseLessons.courseId),
		db
			.select({ courseId: quizQuestions.courseId, total: count() })
			.from(quizQuestions)
			.innerJoin(courses, eq(quizQuestions.courseId, courses.id))
			.where(eq(courses.organizationId, org.organizationId))
			.groupBy(quizQuestions.courseId),
		db
			.select({ total: count() })
			.from(userProfiles)
			.where(
				and(
					eq(userProfiles.organizationId, org.organizationId),
					eq(userProfiles.isActive, true),
				),
			),
		// Only people still active here count towards the numbers managers see.
		db
			.select({
				courseId: courseEnrollments.courseId,
				isAssigned: courseEnrollments.isAssigned,
				completedAt: courseEnrollments.completedAt,
			})
			.from(courseEnrollments)
			.innerJoin(courses, eq(courseEnrollments.courseId, courses.id))
			.innerJoin(
				userProfiles,
				and(
					eq(userProfiles.userId, courseEnrollments.userId),
					eq(userProfiles.organizationId, org.organizationId),
					eq(userProfiles.isActive, true),
				),
			)
			.where(eq(courses.organizationId, org.organizationId)),
		db
			.select({
				courseId: courseEnrollments.courseId,
				isAssigned: courseEnrollments.isAssigned,
				completedAt: courseEnrollments.completedAt,
			})
			.from(courseEnrollments)
			.where(eq(courseEnrollments.userId, userId)),
		db
			.select({
				courseId: lessonProgress.courseId,
				required: courseLessons.isRequired,
			})
			.from(lessonProgress)
			.innerJoin(courseLessons, eq(lessonProgress.lessonId, courseLessons.id))
			.where(eq(lessonProgress.userId, userId)),
	]);
	const totals = (list: { courseId: number; total: number }[]) =>
		new Map(list.map((row) => [row.courseId, row.total]));
	const moduleTotals = totals(modules);
	const questionTotals = totals(questions);
	const lessonTotals = new Map(lessons.map((row) => [row.courseId, row]));
	const myEnrollments = new Map(mine.map((row) => [row.courseId, row]));

	const summary = (course: Course) => ({
		id: course.id,
		title: course.title,
		description: course.description,
		duration: course.duration,
		status: course.status,
		isMandatory: course.isMandatory,
		hasCover: course.coverKey !== null,
		updatedAt: course.updatedAt,
		modules: moduleTotals.get(course.id) ?? 0,
		lessons: lessonTotals.get(course.id)?.total ?? 0,
		questions: questionTotals.get(course.id) ?? 0,
	});

	const learning = rows.flatMap((course) => {
		const enrollment = myEnrollments.get(course.id);
		if (
			course.status !== "published" ||
			(!course.isMandatory && !enrollment?.isAssigned)
		) {
			return [];
		}
		const required = Number(lessonTotals.get(course.id)?.required ?? 0);
		const finished = done.filter((row) => row.courseId === course.id && row.required).length;
		return [
			{
				...summary(course),
				completed: Boolean(enrollment?.completedAt),
				started: finished > 0 || Boolean(enrollment?.completedAt),
				percent: enrollment?.completedAt
					? 100
					: required === 0
						? 0
						: Math.round((finished / required) * 100),
			},
		];
	});

	if (!isManager(org)) return c.json({ learning, manage: null });

	const manage = await Promise.all(
		rows.map(async (course) => {
			const rowsForCourse = enrollments.filter((row) => row.courseId === course.id);
			const assigned = rowsForCourse.filter((row) => row.isAssigned).length;
			return {
				...summary(course),
				enrolled: course.isMandatory ? members[0].total : assigned,
				completed: rowsForCourse.filter((row) => row.completedAt).length,
				publishProblem: course.status === "draft" ? await publishProblem(db, course) : null,
			};
		}),
	);
	return c.json({ learning, manage });
});

courseRoutes.post("/courses", requireUser, requireOrg, requireManager, async (c) => {
	const db = c.get("db");
	const org = c.get("org");
	const body = await readJson(c.req.raw);
	const text = courseText(body);
	if (courseTextProblem(text)) {
		return jsonError(c, 400, "INVALID_COURSE", "Check the course details.");
	}
	const [created] = await db
		.insert(courses)
		.values({
			organizationId: org.organizationId,
			title: text.title,
			description: text.description || null,
			objectives: text.objectives || null,
			duration: text.duration || null,
			isMandatory: body.isMandatory === true,
			createdBy: c.get("user").id,
		})
		.returning({ id: courses.id });
	await audit(db, org.organizationId, c.get("user").id, "course.created", created.id);
	return c.json(created, 201);
});

courseRoutes.get("/courses/:id/manage", requireUser, requireOrg, requireManager, async (c) => {
	const db = c.get("db");
	const org = c.get("org");
	const course = await findCourse(db, idOf(c.req.param("id")), org.organizationId);
	if (!course) return jsonError(c, 404, "NOT_FOUND", "That course doesn't exist.");
	const [outline, members, enrollments, materials, problem] = await Promise.all([
		loadOutline(db, course.id),
		db
			.select({ total: count() })
			.from(userProfiles)
			.where(
				and(
					eq(userProfiles.organizationId, org.organizationId),
					eq(userProfiles.isActive, true),
				),
			),
		db
			.select({
				isAssigned: courseEnrollments.isAssigned,
				startedAt: courseEnrollments.startedAt,
				completedAt: courseEnrollments.completedAt,
			})
			.from(courseEnrollments)
			.innerJoin(
				userProfiles,
				and(
					eq(userProfiles.userId, courseEnrollments.userId),
					eq(userProfiles.organizationId, org.organizationId),
					eq(userProfiles.isActive, true),
				),
			)
			.where(eq(courseEnrollments.courseId, course.id)),
		db
			.select({ lessonId: lessonMaterials.lessonId, total: count() })
			.from(lessonMaterials)
			.where(eq(lessonMaterials.courseId, course.id))
			.groupBy(lessonMaterials.lessonId),
		publishProblem(db, course),
	]);
	const materialTotals = new Map(materials.map((row) => [row.lessonId, row.total]));
	const completed = enrollments.filter((row) => row.completedAt).length;
	return c.json({
		id: course.id,
		title: course.title,
		description: course.description,
		objectives: course.objectives,
		duration: course.duration,
		status: course.status,
		isMandatory: course.isMandatory,
		hasCover: course.coverKey !== null,
		passingScore: course.passingScore,
		quizTitle: course.quizTitle,
		certificateEnabled: course.certificateEnabled,
		updatedAt: course.updatedAt,
		publishProblem: problem,
		modules: outline.modules.map((module) => ({
			id: module.id,
			title: module.title,
			lessons: outline.lessons
				.filter((lesson) => lesson.moduleId === module.id)
				.map((lesson) => ({
					id: lesson.id,
					title: lesson.title,
					isRequired: lesson.isRequired,
					materials: materialTotals.get(lesson.id) ?? 0,
				})),
		})),
		questionCount: outline.questionCount,
		stats: {
			enrolled: course.isMandatory
				? members[0].total
				: enrollments.filter((row) => row.isAssigned).length,
			completed,
			inProgress: enrollments.filter((row) => row.startedAt && !row.completedAt).length,
		},
	});
});

courseRoutes.patch("/courses/:id", requireUser, requireOrg, requireManager, async (c) => {
	const db = c.get("db");
	const org = c.get("org");
	const course = await findCourse(db, idOf(c.req.param("id")), org.organizationId);
	if (!course) return jsonError(c, 404, "NOT_FOUND", "That course doesn't exist.");
	const body = await readJson(c.req.raw);
	const changes: Partial<typeof courses.$inferInsert> = {};
	if ("title" in body) {
		const text = courseText({ ...body, description: "", objectives: "", duration: "" });
		if (courseTextProblem(text)) {
			return jsonError(c, 400, "INVALID_COURSE", "Check the course details.");
		}
		changes.title = text.title;
	}
	if ("description" in body) {
		const value = cleanText(body.description, { multiline: true });
		if (value.length > 2000) return jsonError(c, 400, "INVALID_COURSE", "Check the course details.");
		changes.description = value || null;
	}
	if ("objectives" in body) {
		const value = cleanText(body.objectives, { multiline: true });
		if (value.length > 2000) return jsonError(c, 400, "INVALID_COURSE", "Check the course details.");
		changes.objectives = value || null;
	}
	if ("duration" in body) {
		const value = cleanText(body.duration);
		if (value.length > 50) return jsonError(c, 400, "INVALID_COURSE", "Check the course details.");
		changes.duration = value || null;
	}
	if ("quizTitle" in body) {
		const value = cleanText(body.quizTitle);
		if (value.length > 200) return jsonError(c, 400, "INVALID_COURSE", "Check the course details.");
		changes.quizTitle = value || null;
	}
	if ("isMandatory" in body) {
		if (typeof body.isMandatory !== "boolean") {
			return jsonError(c, 400, "INVALID_COURSE", "Check the course details.");
		}
		changes.isMandatory = body.isMandatory;
	}
	if ("certificateEnabled" in body) {
		if (typeof body.certificateEnabled !== "boolean") {
			return jsonError(c, 400, "INVALID_COURSE", "Check the course details.");
		}
		changes.certificateEnabled = body.certificateEnabled;
	}
	if ("passingScore" in body) {
		const score = body.passingScore;
		if (typeof score !== "number" || !Number.isInteger(score) || score < 1 || score > 100) {
			return jsonError(c, 400, "INVALID_SCORE", "The passing score must be from 1 to 100.");
		}
		changes.passingScore = score;
	}
	if ("status" in body) {
		if (body.status !== "draft" && body.status !== "published") {
			return jsonError(c, 400, "INVALID_COURSE", "Check the course details.");
		}
		if (body.status === "published" && (await publishProblem(db, course))) {
			return jsonError(c, 409, "NO_CONTENT", "Add at least one lesson with content first.");
		}
		changes.status = body.status;
	}
	await db.batch([
		db.update(courses).set(changes).where(eq(courses.id, course.id)),
		audit(
			db,
			org.organizationId,
			c.get("user").id,
			changes.status && changes.status !== course.status
				? `course.${changes.status}`
				: "course.updated",
			course.id,
		),
	]);
	return c.json({ ok: true });
});

courseRoutes.delete("/courses/:id", requireUser, requireOrg, requireManager, async (c) => {
	const db = c.get("db");
	const org = c.get("org");
	const course = await findCourse(db, idOf(c.req.param("id")), org.organizationId);
	if (!course) return jsonError(c, 404, "NOT_FOUND", "That course doesn't exist.");
	const materials = await db
		.select()
		.from(lessonMaterials)
		.where(eq(lessonMaterials.courseId, course.id));
	await db.batch([
		db.delete(courses).where(eq(courses.id, course.id)),
		audit(db, org.organizationId, c.get("user").id, "course.deleted", course.id, {
			title: course.title,
		}),
	]);
	await Promise.all(
		materials.filter((m) => m.uploadId).map((m) => abortUpload(c.env.FILES, m)),
	);
	await deleteStored(c.env.FILES, [
		course.coverKey,
		...materials.filter((m) => !m.uploadId).map((m) => m.storageKey),
	]);
	return c.json({ ok: true });
});

courseRoutes.post("/courses/:id/cover", requireUser, requireOrg, requireManager, async (c) => {
	const db = c.get("db");
	const org = c.get("org");
	const course = await findCourse(db, idOf(c.req.param("id")), org.organizationId);
	if (!course) return jsonError(c, 404, "NOT_FOUND", "That course doesn't exist.");
	const coverType = COVER_TYPES[extensionOf(cleanText(c.req.query("name")))];
	const size = Number(c.req.header("content-length"));
	if (!coverType) {
		return jsonError(c, 400, "TYPE_NOT_ALLOWED", "Choose a JPG, PNG or WebP image.");
	}
	if (!Number.isFinite(size) || size <= 0 || !c.req.raw.body) {
		return jsonError(c, 400, "EMPTY_FILE", "That file is empty.");
	}
	if (size > MAX_COVER_BYTES) {
		return jsonError(c, 413, "FILE_TOO_LARGE", "Choose an image under 2 MB.");
	}
	if (await reachesStorageLimit(db, org.organizationId, size - (course.coverBytes ?? 0))) {
		return jsonError(c, 413, "STORAGE_FULL", "Your organization's storage is full.");
	}
	const coverKey = `org/${org.organizationId}/${crypto.randomUUID()}`;
	const stored = await c.env.FILES.put(coverKey, c.req.raw.body, {
		httpMetadata: { contentType: coverType },
	});
	await db
		.update(courses)
		.set({ coverKey, coverType, coverBytes: stored.size })
		.where(eq(courses.id, course.id));
	await deleteStored(c.env.FILES, [course.coverKey]);
	return c.json({ ok: true });
});

courseRoutes.delete("/courses/:id/cover", requireUser, requireOrg, requireManager, async (c) => {
	const db = c.get("db");
	const course = await findCourse(db, idOf(c.req.param("id")), c.get("org").organizationId);
	if (!course) return jsonError(c, 404, "NOT_FOUND", "That course doesn't exist.");
	await db
		.update(courses)
		.set({ coverKey: null, coverType: null, coverBytes: null })
		.where(eq(courses.id, course.id));
	await deleteStored(c.env.FILES, [course.coverKey]);
	return c.json({ ok: true });
});

courseRoutes.get("/courses/:id/cover", requireUser, requireOrg, async (c) => {
	const db = c.get("db");
	const org = c.get("org");
	const course = await findCourse(db, idOf(c.req.param("id")), org.organizationId);
	if (!course?.coverKey || !course.coverType) {
		return jsonError(c, 404, "NOT_FOUND", "That image doesn't exist.");
	}
	if (!isManager(org) && !(await learnerAccess(db, course, c.get("user").id)).enrolled) {
		return jsonError(c, 404, "NOT_FOUND", "That image doesn't exist.");
	}
	const object = await c.env.FILES.get(course.coverKey);
	if (!object) return jsonError(c, 404, "NOT_FOUND", "That image doesn't exist.");
	return new Response(object.body, {
		headers: {
			"Content-Type": course.coverType,
			"Cache-Control": "private, max-age=300",
			"X-Content-Type-Options": "nosniff",
			"Content-Security-Policy": "default-src 'none'; sandbox",
		},
	});
});

courseRoutes.post("/courses/:id/modules", requireUser, requireOrg, requireManager, async (c) => {
	const db = c.get("db");
	const course = await findCourse(db, idOf(c.req.param("id")), c.get("org").organizationId);
	if (!course) return jsonError(c, 404, "NOT_FOUND", "That course doesn't exist.");
	const title = cleanText((await readJson(c.req.raw)).title);
	if (title.length < 1 || title.length > 200) {
		return jsonError(c, 400, "INVALID_TITLE", "Give the module a title.");
	}
	const [created] = await db
		.insert(courseModules)
		.values({
			courseId: course.id,
			title,
			sortOrder: await nextOrder(db, courseModules, course.id),
		})
		.returning({ id: courseModules.id });
	await touchCourse(db, course.id);
	return c.json(created, 201);
});

// Keeps "last edited" true when only something inside the course changed.
function touchCourse(db: Db, courseId: number) {
	return db.update(courses).set({ updatedAt: new Date() }).where(eq(courses.id, courseId));
}

courseRoutes.patch(
	"/courses/:id/modules/:moduleId",
	requireUser,
	requireOrg,
	requireManager,
	async (c) => {
		const db = c.get("db");
		const course = await findCourse(db, idOf(c.req.param("id")), c.get("org").organizationId);
		const module = course && (await findModule(db, course.id, idOf(c.req.param("moduleId"))));
		if (!course || !module) return jsonError(c, 404, "NOT_FOUND", "That module doesn't exist.");
		const title = cleanText((await readJson(c.req.raw)).title);
		if (title.length < 1 || title.length > 200) {
			return jsonError(c, 400, "INVALID_TITLE", "Give the module a title.");
		}
		await db.update(courseModules).set({ title }).where(eq(courseModules.id, module.id));
		await touchCourse(db, course.id);
		return c.json({ ok: true });
	},
);

courseRoutes.delete(
	"/courses/:id/modules/:moduleId",
	requireUser,
	requireOrg,
	requireManager,
	async (c) => {
		const db = c.get("db");
		const course = await findCourse(db, idOf(c.req.param("id")), c.get("org").organizationId);
		const module = course && (await findModule(db, course.id, idOf(c.req.param("moduleId"))));
		if (!course || !module) return jsonError(c, 404, "NOT_FOUND", "That module doesn't exist.");
		const lessons = await db
			.select({ id: courseLessons.id })
			.from(courseLessons)
			.where(eq(courseLessons.moduleId, module.id));
		const lessonIds = new Set(lessons.map((lesson) => lesson.id));
		const materials = (
			await db.select().from(lessonMaterials).where(eq(lessonMaterials.courseId, course.id))
		).filter((material) => lessonIds.has(material.lessonId));
		await db.delete(courseModules).where(eq(courseModules.id, module.id));
		await removeStoredMaterials(c.env.FILES, materials);
		await touchCourse(db, course.id);
		return c.json({ ok: true });
	},
);

async function removeStoredMaterials(bucket: R2Bucket, materials: Material[]) {
	await Promise.all(materials.filter((m) => m.uploadId).map((m) => abortUpload(bucket, m)));
	await deleteStored(
		bucket,
		materials.filter((m) => !m.uploadId).map((m) => m.storageKey),
	);
}

courseRoutes.post(
	"/courses/:id/modules/:moduleId/lessons",
	requireUser,
	requireOrg,
	requireManager,
	async (c) => {
		const db = c.get("db");
		const course = await findCourse(db, idOf(c.req.param("id")), c.get("org").organizationId);
		const module = course && (await findModule(db, course.id, idOf(c.req.param("moduleId"))));
		if (!course || !module) return jsonError(c, 404, "NOT_FOUND", "That module doesn't exist.");
		const title = cleanText((await readJson(c.req.raw)).title);
		if (title.length < 1 || title.length > 200) {
			return jsonError(c, 400, "INVALID_TITLE", "Give the lesson a title.");
		}
		const [last] = await db
			.select({ last: sql<number | null>`max(${courseLessons.sortOrder})` })
			.from(courseLessons)
			.where(eq(courseLessons.moduleId, module.id));
		const [created] = await db
			.insert(courseLessons)
			.values({
				courseId: course.id,
				moduleId: module.id,
				title,
				sortOrder: (last.last ?? -1) + 1,
			})
			.returning({ id: courseLessons.id });
		await touchCourse(db, course.id);
		return c.json(created, 201);
	},
);

// The new order of everything, which is also how a lesson moves between modules.
courseRoutes.post("/courses/:id/reorder", requireUser, requireOrg, requireManager, async (c) => {
	const db = c.get("db");
	const course = await findCourse(db, idOf(c.req.param("id")), c.get("org").organizationId);
	if (!course) return jsonError(c, 404, "NOT_FOUND", "That course doesn't exist.");
	const body = await readJson(c.req.raw);
	const outline = await loadOutline(db, course.id);
	const sent = Array.isArray(body.modules)
		? (body.modules as { id?: unknown; lessonIds?: unknown }[])
		: [];
	const sentModules = sent.map((module) => module?.id);
	const sentLessons = sent.flatMap((module) =>
		Array.isArray(module?.lessonIds) ? (module.lessonIds as unknown[]) : [],
	);
	const sameItems = (list: unknown[], real: number[]) =>
		list.length === real.length &&
		new Set(list).size === list.length &&
		real.every((id) => list.includes(id));
	if (
		!sameItems(sentModules, outline.modules.map((module) => module.id)) ||
		!sameItems(sentLessons, outline.lessons.map((lesson) => lesson.id))
	) {
		return jsonError(c, 400, "INVALID_ORDER", "Reload the page and try again.");
	}
	const updates = sent.flatMap((module, moduleIndex) => [
		db
			.update(courseModules)
			.set({ sortOrder: moduleIndex })
			.where(eq(courseModules.id, module.id as number)),
		...(module.lessonIds as number[]).map((lessonId, lessonIndex) =>
			db
				.update(courseLessons)
				.set({ moduleId: module.id as number, sortOrder: lessonIndex })
				.where(eq(courseLessons.id, lessonId)),
		),
	]);
	await db.batch(updates as [(typeof updates)[number], ...typeof updates]);
	return c.json({ ok: true });
});

courseRoutes.get(
	"/courses/:id/lessons/:lessonId/edit",
	requireUser,
	requireOrg,
	requireManager,
	async (c) => {
		const db = c.get("db");
		const org = c.get("org");
		const course = await findCourse(db, idOf(c.req.param("id")), org.organizationId);
		const lesson = course && (await findLesson(db, course.id, idOf(c.req.param("lessonId"))));
		if (!course || !lesson) return jsonError(c, 404, "NOT_FOUND", "That lesson doesn't exist.");
		const materials = await db
			.select()
			.from(lessonMaterials)
			.where(eq(lessonMaterials.lessonId, lesson.id))
			.orderBy(asc(lessonMaterials.sortOrder), asc(lessonMaterials.id));
		const usable = await usableMaterialIds(db, org.organizationId, materials);
		return c.json({
			id: lesson.id,
			moduleId: lesson.moduleId,
			title: lesson.title,
			lessonType: lesson.lessonType,
			content: lesson.content,
			videoUrl: lesson.videoUrl,
			completionMethod: lesson.completionMethod,
			estimatedTime: lesson.estimatedTime,
			isRequired: lesson.isRequired,
			materials: materials
				.filter((material) => !material.uploadId)
				.map((material) => ({
					...materialView(material),
					canBeRequired: canBeRequired(material.mimeType),
					unavailable: !usable.has(material.id),
				})),
		});
	},
);

courseRoutes.patch(
	"/courses/:id/lessons/:lessonId",
	requireUser,
	requireOrg,
	requireManager,
	async (c) => {
		const db = c.get("db");
		const course = await findCourse(db, idOf(c.req.param("id")), c.get("org").organizationId);
		const lesson = course && (await findLesson(db, course.id, idOf(c.req.param("lessonId"))));
		if (!course || !lesson) return jsonError(c, 404, "NOT_FOUND", "That lesson doesn't exist.");
		const body = await readJson(c.req.raw);
		const title = cleanText(body.title);
		const content = cleanText(body.content, { multiline: true });
		const videoUrl = cleanText(body.videoUrl);
		const estimatedTime = cleanText(body.estimatedTime);
		const method = body.completionMethod;
		const lessonType = body.lessonType ?? lesson.lessonType;
		if (
			(lessonType !== "reading" && lessonType !== "document") ||
			title.length < 1 ||
			title.length > 200 ||
			content.length > 50000 ||
			estimatedTime.length > 50 ||
			typeof body.isRequired !== "boolean" ||
			(method !== "mark" && method !== "scroll" && method !== "open")
		) {
			return jsonError(c, 400, "INVALID_LESSON", "Check the lesson details.");
		}
		if (videoUrl && !videoEmbedUrl(videoUrl)) {
			return jsonError(c, 400, "INVALID_VIDEO", "Use a YouTube or Vimeo link.");
		}
		await db
			.update(courseLessons)
			.set({
				title,
				lessonType,
				content: content || null,
				videoUrl: videoUrl || null,
				estimatedTime: estimatedTime || null,
				completionMethod: method,
				isRequired: body.isRequired,
			})
			.where(eq(courseLessons.id, lesson.id));
		await touchCourse(db, course.id);
		return c.json({ ok: true });
	},
);

courseRoutes.delete(
	"/courses/:id/lessons/:lessonId",
	requireUser,
	requireOrg,
	requireManager,
	async (c) => {
		const db = c.get("db");
		const course = await findCourse(db, idOf(c.req.param("id")), c.get("org").organizationId);
		const lesson = course && (await findLesson(db, course.id, idOf(c.req.param("lessonId"))));
		if (!course || !lesson) return jsonError(c, 404, "NOT_FOUND", "That lesson doesn't exist.");
		const materials = await db
			.select()
			.from(lessonMaterials)
			.where(eq(lessonMaterials.lessonId, lesson.id));
		await db.delete(courseLessons).where(eq(courseLessons.id, lesson.id));
		await removeStoredMaterials(c.env.FILES, materials);
		await touchCourse(db, course.id);
		return c.json({ ok: true });
	},
);

courseRoutes.post(
	"/courses/:id/lessons/:lessonId/materials/upload",
	requireUser,
	requireOrg,
	requireManager,
	async (c) => {
		const db = c.get("db");
		const org = c.get("org");
		const course = await findCourse(db, idOf(c.req.param("id")), org.organizationId);
		const lesson = course && (await findLesson(db, course.id, idOf(c.req.param("lessonId"))));
		if (!course || !lesson) return jsonError(c, 404, "NOT_FOUND", "That lesson doesn't exist.");
		const name = cleanText(c.req.query("name"));
		const mimeType = MATERIAL_TYPES[extensionOf(name)];
		const size = Number(c.req.header("content-length"));
		if (name.length < 1 || name.length > 500) {
			return jsonError(c, 400, "INVALID_NAME", "That file needs a name.");
		}
		if (!mimeType) {
			return jsonError(c, 400, "TYPE_NOT_ALLOWED", "That type of file can't be added to a lesson.");
		}
		if (!Number.isFinite(size) || size <= 0 || !c.req.raw.body) {
			return jsonError(c, 400, "EMPTY_FILE", "That file is empty.");
		}
		if (size > MAX_MATERIAL_BYTES) {
			return jsonError(c, 413, "FILE_TOO_LARGE", "Files can be up to 50 MB.");
		}
		if (await reachesStorageLimit(db, org.organizationId, size)) {
			return jsonError(c, 413, "STORAGE_FULL", "Your organization's storage is full.");
		}
		const storageKey = `org/${org.organizationId}/${crypto.randomUUID()}`;
		const stored = await c.env.FILES.put(storageKey, c.req.raw.body, {
			httpMetadata: { contentType: mimeType },
		});
		try {
			const [created] = await db
				.insert(lessonMaterials)
				.values({
					organizationId: org.organizationId,
					courseId: course.id,
					lessonId: lesson.id,
					name,
					mimeType,
					sizeBytes: stored.size,
					storageKey,
					isRequired: canBeRequired(mimeType) && c.req.query("required") === "1",
					sortOrder: await nextMaterialOrder(db, lesson.id),
				})
				.returning({ id: lessonMaterials.id });
			await touchCourse(db, course.id);
			return c.json(created, 201);
		} catch (error) {
			await c.env.FILES.delete(storageKey);
			throw error;
		}
	},
);

courseRoutes.post(
	"/courses/:id/lessons/:lessonId/materials/video",
	requireUser,
	requireOrg,
	requireManager,
	async (c) => {
		const db = c.get("db");
		const org = c.get("org");
		const course = await findCourse(db, idOf(c.req.param("id")), org.organizationId);
		const lesson = course && (await findLesson(db, course.id, idOf(c.req.param("lessonId"))));
		if (!course || !lesson) return jsonError(c, 404, "NOT_FOUND", "That lesson doesn't exist.");
		const body = await readJson(c.req.raw);
		const name = cleanText(body.name);
		const size = body.sizeBytes;
		const mimeType = VIDEO_TYPES[extensionOf(name)];
		if (name.length < 1 || name.length > 500) {
			return jsonError(c, 400, "INVALID_NAME", "That file needs a name.");
		}
		if (!mimeType) {
			return jsonError(c, 400, "TYPE_NOT_ALLOWED", "Videos must be MP4 or WebM.");
		}
		if (typeof size !== "number" || !Number.isInteger(size) || size <= 0) {
			return jsonError(c, 400, "EMPTY_FILE", "That file is empty.");
		}
		if (size > MAX_VIDEO_BYTES) {
			return jsonError(c, 413, "FILE_TOO_LARGE", "Videos can be up to 2 GB.");
		}
		if (await reachesStorageLimit(db, org.organizationId, size)) {
			return jsonError(c, 413, "STORAGE_FULL", "Your organization's storage is full.");
		}
		const storageKey = `org/${org.organizationId}/${crypto.randomUUID()}`;
		const upload = await c.env.FILES.createMultipartUpload(storageKey, {
			httpMetadata: { contentType: mimeType },
		});
		const [created] = await db
			.insert(lessonMaterials)
			.values({
				organizationId: org.organizationId,
				courseId: course.id,
				lessonId: lesson.id,
				name,
				mimeType,
				storageKey,
				uploadId: upload.uploadId,
				isRequired: body.isRequired === true,
				sortOrder: await nextMaterialOrder(db, lesson.id),
			})
			.returning({ id: lessonMaterials.id });
		return c.json({ id: created.id, partBytes: VIDEO_PART_BYTES }, 201);
	},
);

courseRoutes.put(
	"/courses/:id/materials/:materialId/video/:part",
	requireUser,
	requireOrg,
	requireManager,
	async (c) => {
		const db = c.get("db");
		const course = await findCourse(db, idOf(c.req.param("id")), c.get("org").organizationId);
		const material = course && (await findMaterial(db, course.id, idOf(c.req.param("materialId"))));
		const part = Number(c.req.param("part"));
		if (!material?.uploadId || !material.storageKey) {
			return jsonError(c, 404, "NOT_FOUND", "That upload doesn't exist.");
		}
		if (!Number.isInteger(part) || part < 1 || part > 1000) {
			return jsonError(c, 400, "INVALID_PART", "That part isn't valid.");
		}
		const size = Number(c.req.header("content-length"));
		if (!Number.isFinite(size) || size <= 0 || size > VIDEO_PART_BYTES) {
			return jsonError(c, 413, "FILE_TOO_LARGE", "That part is too big.");
		}
		const data = await c.req.arrayBuffer();
		const uploaded = await c.env.FILES.resumeMultipartUpload(
			material.storageKey,
			material.uploadId,
		).uploadPart(part, data);
		return c.json({ partNumber: uploaded.partNumber, etag: uploaded.etag });
	},
);

courseRoutes.post(
	"/courses/:id/materials/:materialId/video/complete",
	requireUser,
	requireOrg,
	requireManager,
	async (c) => {
		const db = c.get("db");
		const org = c.get("org");
		const course = await findCourse(db, idOf(c.req.param("id")), org.organizationId);
		const material = course && (await findMaterial(db, course.id, idOf(c.req.param("materialId"))));
		if (!course || !material?.uploadId || !material.storageKey) {
			return jsonError(c, 404, "NOT_FOUND", "That upload doesn't exist.");
		}
		const body = await readJson(c.req.raw);
		const parts = Array.isArray(body.parts) ? (body.parts as R2UploadedPart[]) : [];
		if (
			parts.length === 0 ||
			!parts.every(
				(part) =>
					Number.isInteger(part?.partNumber) && typeof part?.etag === "string",
			)
		) {
			return jsonError(c, 400, "INVALID_PART", "That upload isn't complete.");
		}
		const object = await c.env.FILES.resumeMultipartUpload(
			material.storageKey,
			material.uploadId,
		).complete(parts);
		// Checked again, because only now is the real size known.
		if (
			object.size > MAX_VIDEO_BYTES ||
			(await reachesStorageLimit(db, org.organizationId, object.size))
		) {
			await c.env.FILES.delete(material.storageKey);
			await db.delete(lessonMaterials).where(eq(lessonMaterials.id, material.id));
			return jsonError(c, 413, "STORAGE_FULL", "Your organization's storage is full.");
		}
		await db
			.update(lessonMaterials)
			.set({ uploadId: null, sizeBytes: object.size })
			.where(eq(lessonMaterials.id, material.id));
		await touchCourse(db, course.id);
		return c.json({ ok: true });
	},
);

courseRoutes.get("/course-hub-files", requireUser, requireOrg, requireManager, async (c) => {
	const db = c.get("db");
	const org = c.get("org");
	const [rows, checks] = await Promise.all([
		db
			.select({
				id: orgFiles.id,
				name: orgFiles.name,
				mimeType: orgFiles.mimeType,
				sizeBytes: orgFiles.sizeBytes,
				pinHash: orgFiles.pinHash,
				folderId: orgFiles.folderId,
				createdAt: orgFiles.createdAt,
			})
			.from(orgFiles)
			.where(and(eq(orgFiles.organizationId, org.organizationId), eq(orgFiles.fileType, "upload")))
			.orderBy(desc(orgFiles.createdAt)),
		hubFileProblems(db, org.organizationId),
	]);
	return c.json({
		files: rows.map(({ pinHash, ...file }) => {
			const mimeType = file.mimeType ?? "";
			return {
				...file,
				kind: ALLOWED_MIME.has(mimeType) ? kindOf(mimeType) : null,
				folderName: file.folderId ? (checks.folders.get(file.folderId) ?? null) : null,
				problem: ALLOWED_MIME.has(mimeType) ? checks.problem({ ...file, pinHash }) : "type",
				canBeRequired: canBeRequired(mimeType),
			};
		}),
	});
});

courseRoutes.post(
	"/courses/:id/lessons/:lessonId/materials/hub",
	requireUser,
	requireOrg,
	requireManager,
	async (c) => {
		const db = c.get("db");
		const org = c.get("org");
		const course = await findCourse(db, idOf(c.req.param("id")), org.organizationId);
		const lesson = course && (await findLesson(db, course.id, idOf(c.req.param("lessonId"))));
		if (!course || !lesson) return jsonError(c, 404, "NOT_FOUND", "That lesson doesn't exist.");
		const body = await readJson(c.req.raw);
		const fileIds = Array.isArray(body.fileIds) ? (body.fileIds as unknown[]) : [];
		if (
			fileIds.length < 1 ||
			fileIds.length > 20 ||
			!fileIds.every((id) => Number.isInteger(id))
		) {
			return jsonError(c, 400, "INVALID_FILES", "Choose at least one file.");
		}
		const [files, checks, existing] = await Promise.all([
			db
				.select()
				.from(orgFiles)
				.where(
					and(
						eq(orgFiles.organizationId, org.organizationId),
						inArray(orgFiles.id, fileIds as number[]),
					),
				),
			hubFileProblems(db, org.organizationId),
			db
				.select({ fileId: lessonMaterials.fileId })
				.from(lessonMaterials)
				.where(eq(lessonMaterials.lessonId, lesson.id)),
		]);
		const already = new Set(existing.map((row) => row.fileId));
		const unique = new Set(fileIds);
		if (
			files.length !== unique.size ||
			files.some(
				(file) =>
					file.fileType !== "upload" ||
					!ALLOWED_MIME.has(file.mimeType ?? "") ||
					checks.problem(file) !== null,
			)
		) {
			return jsonError(c, 400, "FILE_NOT_ALLOWED", "One of those files can't be added to a lesson.");
		}
		const fresh = files.filter((file) => !already.has(file.id));
		if (fresh.length > 0) {
			const firstOrder = await nextMaterialOrder(db, lesson.id);
			await db.insert(lessonMaterials).values(
				fresh.map((file, index) => ({
					sortOrder: firstOrder + index,
					organizationId: org.organizationId,
					courseId: course.id,
					lessonId: lesson.id,
					name: file.name,
					mimeType: file.mimeType as string,
					sizeBytes: file.sizeBytes,
					fileId: file.id,
					isRequired: canBeRequired(file.mimeType as string),
				})),
			);
		}
		await touchCourse(db, course.id);
		return c.json({ added: fresh.length }, 201);
	},
);

courseRoutes.post(
	"/courses/:id/lessons/:lessonId/materials/reorder",
	requireUser,
	requireOrg,
	requireManager,
	async (c) => {
		const db = c.get("db");
		const course = await findCourse(db, idOf(c.req.param("id")), c.get("org").organizationId);
		const lesson = course && (await findLesson(db, course.id, idOf(c.req.param("lessonId"))));
		if (!course || !lesson) return jsonError(c, 404, "NOT_FOUND", "That lesson doesn't exist.");
		const { ids } = await readJson(c.req.raw);
		const rows = await db
			.select({ id: lessonMaterials.id })
			.from(lessonMaterials)
			.where(and(eq(lessonMaterials.lessonId, lesson.id), isNull(lessonMaterials.uploadId)));
		const list = Array.isArray(ids) ? (ids as unknown[]) : [];
		if (
			rows.length === 0 ||
			list.length !== rows.length ||
			new Set(list).size !== list.length ||
			!rows.every((row) => list.includes(row.id))
		) {
			return jsonError(c, 400, "INVALID_ORDER", "Reload the page and try again.");
		}
		const updates = (list as number[]).map((id, index) =>
			db.update(lessonMaterials).set({ sortOrder: index }).where(eq(lessonMaterials.id, id)),
		);
		await db.batch(updates as [(typeof updates)[number], ...typeof updates]);
		return c.json({ ok: true });
	},
);

courseRoutes.patch(
	"/courses/:id/materials/:materialId",
	requireUser,
	requireOrg,
	requireManager,
	async (c) => {
		const db = c.get("db");
		const course = await findCourse(db, idOf(c.req.param("id")), c.get("org").organizationId);
		const material = course && (await findMaterial(db, course.id, idOf(c.req.param("materialId"))));
		if (!course || !material) return jsonError(c, 404, "NOT_FOUND", "That file doesn't exist.");
		const { isRequired } = await readJson(c.req.raw);
		if (typeof isRequired !== "boolean") {
			return jsonError(c, 400, "INVALID_MATERIAL", "Check the file details.");
		}
		if (isRequired && !canBeRequired(material.mimeType)) {
			return jsonError(c, 400, "CANNOT_BE_REQUIRED", "Spreadsheets can only be extra resources.");
		}
		await db
			.update(lessonMaterials)
			.set({ isRequired })
			.where(eq(lessonMaterials.id, material.id));
		return c.json({ ok: true });
	},
);

courseRoutes.delete(
	"/courses/:id/materials/:materialId",
	requireUser,
	requireOrg,
	requireManager,
	async (c) => {
		const db = c.get("db");
		const course = await findCourse(db, idOf(c.req.param("id")), c.get("org").organizationId);
		const material = course && (await findMaterial(db, course.id, idOf(c.req.param("materialId"))));
		if (!course || !material) return jsonError(c, 404, "NOT_FOUND", "That file doesn't exist.");
		await db.delete(lessonMaterials).where(eq(lessonMaterials.id, material.id));
		await removeStoredMaterials(c.env.FILES, [material]);
		await touchCourse(db, course.id);
		return c.json({ ok: true });
	},
);

// The learner side. Managers can read any course to preview it, but nothing is
// recorded unless the course is actually theirs to take.
async function loadForLearner(
	c: Context<AppEnv>,
	id: number | null,
) {
	const db = c.get("db");
	const org = c.get("org");
	const course = await findCourse(db, id, org.organizationId);
	if (!course) return null;
	const access = await learnerAccess(db, course, c.get("user").id);
	if (!access.enrolled && !isManager(org)) return null;
	return { course, ...access, preview: !access.enrolled };
}

courseRoutes.get("/courses/:id", requireUser, requireOrg, async (c) => {
	const db = c.get("db");
	const loaded = await loadForLearner(c, idOf(c.req.param("id")));
	if (!loaded) return jsonError(c, 404, "NOT_FOUND", "That course doesn't exist.");
	const { course, enrollment, preview } = loaded;
	const userId = c.get("user").id;
	const [state, [certificate]] = await Promise.all([
		learnerState(db, course, userId),
		db
			.select({ id: certificates.id })
			.from(certificates)
			.where(and(eq(certificates.courseId, course.id), eq(certificates.userId, userId))),
	]);
	const ordered = orderedLessons(state.outline);
	const next = ordered.find((lesson) => !state.doneIds.has(lesson.id));
	return c.json({
		id: course.id,
		title: course.title,
		description: course.description,
		objectives: course.objectives,
		duration: course.duration,
		status: course.status,
		isMandatory: course.isMandatory,
		hasCover: course.coverKey !== null,
		updatedAt: course.updatedAt,
		preview,
		completed: Boolean(enrollment?.completedAt),
		started: Boolean(enrollment?.startedAt),
		percent: enrollment?.completedAt ? 100 : state.percent,
		certificateId: certificate?.id ?? null,
		nextLessonId: next?.id ?? ordered[0]?.id ?? null,
		lessonTotal: ordered.length,
		lessonsDone: ordered.filter((lesson) => state.doneIds.has(lesson.id)).length,
		modules: state.outline.modules.map((module) => ({
			id: module.id,
			title: module.title,
			lessons: state.outline.lessons
				.filter((lesson) => lesson.moduleId === module.id)
				.map((lesson) => ({
					id: lesson.id,
					title: lesson.title,
					isRequired: lesson.isRequired,
					estimatedTime: lesson.estimatedTime,
					done: state.doneIds.has(lesson.id),
				})),
		})),
		quiz: state.hasQuiz
			? {
					title: course.quizTitle,
					questions: state.outline.questionCount,
					passingScore: course.passingScore,
					passed: state.quizPassed,
					unlocked: state.quizUnlocked,
				}
			: null,
	});
});

courseRoutes.get("/courses/:id/lessons/:lessonId", requireUser, requireOrg, async (c) => {
	const db = c.get("db");
	const org = c.get("org");
	const userId = c.get("user").id;
	const loaded = await loadForLearner(c, idOf(c.req.param("id")));
	const lesson = loaded && (await findLesson(db, loaded.course.id, idOf(c.req.param("lessonId"))));
	if (!loaded || !lesson) return jsonError(c, 404, "NOT_FOUND", "That lesson doesn't exist.");
	const [materials, viewed, [done]] = await Promise.all([
		db
			.select()
			.from(lessonMaterials)
			.where(eq(lessonMaterials.lessonId, lesson.id))
			.orderBy(asc(lessonMaterials.sortOrder), asc(lessonMaterials.id)),
		db
			.select({
				materialId: materialProgress.materialId,
				viewedPages: materialProgress.viewedPages,
				completedAt: materialProgress.completedAt,
			})
			.from(materialProgress)
			.innerJoin(lessonMaterials, eq(materialProgress.materialId, lessonMaterials.id))
			.where(and(eq(lessonMaterials.lessonId, lesson.id), eq(materialProgress.userId, userId))),
		db
			.select({ at: lessonProgress.completedAt })
			.from(lessonProgress)
			.where(and(eq(lessonProgress.lessonId, lesson.id), eq(lessonProgress.userId, userId))),
	]);
	const usable = await usableMaterialIds(db, org.organizationId, materials);
	const viewedBy = new Map(viewed.map((row) => [row.materialId, row]));
	if (!loaded.preview) await markStarted(db, loaded.course.id, userId);
	return c.json({
		id: lesson.id,
		title: lesson.title,
		content: lesson.content,
		videoEmbed: videoEmbedUrl(lesson.videoUrl),
		completionMethod: lesson.completionMethod,
		estimatedTime: lesson.estimatedTime,
		isRequired: lesson.isRequired,
		done: Boolean(done),
		preview: loaded.preview,
		materials: materials
			.filter((material) => usable.has(material.id))
			.map((material) => {
				const progress = viewedBy.get(material.id);
				return {
					...materialView(material),
					viewedPages: progress ? (JSON.parse(progress.viewedPages) as number[]) : [],
					done: Boolean(progress?.completedAt),
				};
			}),
	});
});

// Supports range requests so big videos and PDFs load a piece at a time.
courseRoutes.get("/courses/:id/materials/:materialId/file", requireUser, requireOrg, async (c) => {
	const db = c.get("db");
	const org = c.get("org");
	const loaded = await loadForLearner(c, idOf(c.req.param("id")));
	const material =
		loaded && (await findMaterial(db, loaded.course.id, idOf(c.req.param("materialId"))));
	if (!material) return jsonError(c, 404, "NOT_FOUND", "That file doesn't exist.");
	let storageKey = material.storageKey;
	if (material.fileId) {
		const usable = await usableMaterialIds(db, org.organizationId, [material]);
		if (!usable.has(material.id)) {
			return jsonError(c, 404, "NOT_FOUND", "That file doesn't exist.");
		}
		const [file] = await db
			.select({ storageKey: orgFiles.storageKey })
			.from(orgFiles)
			.where(eq(orgFiles.id, material.fileId));
		storageKey = file?.storageKey ?? null;
	}
	if (!storageKey || material.uploadId) {
		return jsonError(c, 404, "NOT_FOUND", "That file doesn't exist.");
	}
	const range = c.req.header("range");
	const object = await c.env.FILES.get(storageKey, range ? { range: c.req.raw.headers } : {});
	if (!object) return jsonError(c, 404, "NOT_FOUND", "That file doesn't exist.");
	const kind = kindOf(material.mimeType);
	const headers = new Headers({
		"Content-Type": material.mimeType,
		"Accept-Ranges": "bytes",
		"Content-Disposition": contentDisposition(
			(kind === "pdf" || kind === "video") && c.req.query("download") !== "1"
				? "inline"
				: "attachment",
			material.name,
		),
		"Cache-Control": "private, no-store",
		"X-Content-Type-Options": "nosniff",
		"Content-Security-Policy": "default-src 'none'; sandbox",
	});
	const part = object.range as { offset?: number; length?: number } | undefined;
	if (range && part && part.length !== undefined) {
		const offset = part.offset ?? 0;
		headers.set("Content-Range", `bytes ${offset}-${offset + part.length - 1}/${object.size}`);
		headers.set("Content-Length", String(part.length));
		return new Response(object.body, { status: 206, headers });
	}
	headers.set("Content-Length", String(object.size));
	return new Response(object.body, { headers });
});

courseRoutes.post("/courses/:id/materials/:materialId/view", requireUser, requireOrg, async (c) => {
	const db = c.get("db");
	const userId = c.get("user").id;
	const loaded = await loadForLearner(c, idOf(c.req.param("id")));
	const material =
		loaded && (await findMaterial(db, loaded.course.id, idOf(c.req.param("materialId"))));
	if (!loaded || !material) return jsonError(c, 404, "NOT_FOUND", "That file doesn't exist.");
	if (loaded.preview) return c.json({ preview: true, viewedPages: [], done: false });

	const body = await readJson(c.req.raw);
	const kind = kindOf(material.mimeType);
	const [existing] = await db
		.select()
		.from(materialProgress)
		.where(and(eq(materialProgress.materialId, material.id), eq(materialProgress.userId, userId)));
	let viewedPages = existing ? (JSON.parse(existing.viewedPages) as number[]) : [];
	let done = Boolean(existing?.completedAt);

	if (kind === "pdf") {
		const { page, pageCount } = body;
		if (
			typeof page !== "number" ||
			typeof pageCount !== "number" ||
			!Number.isInteger(page) ||
			!Number.isInteger(pageCount) ||
			pageCount < 1 ||
			pageCount > MAX_PAGES ||
			page < 1
		) {
			return jsonError(c, 400, "INVALID_PAGE", "That page isn't valid.");
		}
		// Whoever views it first sets the count, so later learners can't shorten it.
		const total = material.pageCount ?? pageCount;
		if (material.pageCount === null) {
			await db
				.update(lessonMaterials)
				.set({ pageCount })
				.where(eq(lessonMaterials.id, material.id));
		}
		if (page > total) return jsonError(c, 400, "INVALID_PAGE", "That page isn't valid.");
		viewedPages = [...new Set([...viewedPages, page])].sort((a, b) => a - b);
		done = done || viewedPages.length >= total;
	} else if (kind === "video") {
		if (body.event === "ended") done = true;
	} else {
		done = true;
	}
	await db
		.insert(materialProgress)
		.values({
			materialId: material.id,
			userId,
			viewedPages: JSON.stringify(viewedPages),
			completedAt: done ? new Date() : null,
		})
		.onConflictDoUpdate({
			target: [materialProgress.materialId, materialProgress.userId],
			set: {
				viewedPages: JSON.stringify(viewedPages),
				completedAt: sql`coalesce(${materialProgress.completedAt}, ${done ? Date.now() : null})`,
			},
		});
	return c.json({ viewedPages, done });
});

courseRoutes.post("/courses/:id/lessons/:lessonId/complete", requireUser, requireOrg, async (c) => {
	const db = c.get("db");
	const org = c.get("org");
	const currentUser = c.get("user");
	const loaded = await loadForLearner(c, idOf(c.req.param("id")));
	const lesson = loaded && (await findLesson(db, loaded.course.id, idOf(c.req.param("lessonId"))));
	if (!loaded || !lesson) return jsonError(c, 404, "NOT_FOUND", "That lesson doesn't exist.");
	if (loaded.preview) return jsonError(c, 403, "PREVIEW_ONLY", "Previews aren't recorded.");

	const [materials, viewed] = await Promise.all([
		db.select().from(lessonMaterials).where(eq(lessonMaterials.lessonId, lesson.id)),
		db
			.select({ materialId: materialProgress.materialId, completedAt: materialProgress.completedAt })
			.from(materialProgress)
			.innerJoin(lessonMaterials, eq(materialProgress.materialId, lessonMaterials.id))
			.where(and(eq(lessonMaterials.lessonId, lesson.id), eq(materialProgress.userId, currentUser.id))),
	]);
	const usable = await usableMaterialIds(db, org.organizationId, materials);
	const finished = new Set(viewed.filter((row) => row.completedAt).map((row) => row.materialId));
	const waiting = materials.filter(
		(material) => material.isRequired && usable.has(material.id) && !finished.has(material.id),
	);
	if (waiting.length > 0) {
		return jsonError(c, 409, "MATERIALS_REQUIRED", "View the required materials first.");
	}
	await markStarted(db, loaded.course.id, currentUser.id);
	await db
		.insert(lessonProgress)
		.values({ lessonId: lesson.id, courseId: loaded.course.id, userId: currentUser.id })
		.onConflictDoNothing();
	const result = await completeIfFinished(db, loaded.course, org, currentUser, null);
	return c.json(result);
});

courseRoutes.get("/courses/:id/quiz/edit", requireUser, requireOrg, requireManager, async (c) => {
	const db = c.get("db");
	const course = await findCourse(db, idOf(c.req.param("id")), c.get("org").organizationId);
	if (!course) return jsonError(c, 404, "NOT_FOUND", "That course doesn't exist.");
	const rows = await db
		.select()
		.from(quizQuestions)
		.where(eq(quizQuestions.courseId, course.id))
		.orderBy(asc(quizQuestions.sortOrder), asc(quizQuestions.id));
	return c.json({
		courseTitle: course.title,
		quizTitle: course.quizTitle,
		passingScore: course.passingScore,
		questions: rows.map((row) => ({
			id: row.id,
			question: row.question,
			type: row.type,
			options: JSON.parse(row.options) as QuizOption[],
		})),
	});
});

courseRoutes.post("/courses/:id/quiz/questions", requireUser, requireOrg, requireManager, async (c) => {
	const db = c.get("db");
	const course = await findCourse(db, idOf(c.req.param("id")), c.get("org").organizationId);
	if (!course) return jsonError(c, 404, "NOT_FOUND", "That course doesn't exist.");
	const parsed = parseQuestion(await readJson(c.req.raw));
	if (!parsed) return jsonError(c, 400, "INVALID_QUESTION", "Check the question and its answers.");
	const [existing] = await db
		.select({ total: count() })
		.from(quizQuestions)
		.where(eq(quizQuestions.courseId, course.id));
	if (existing.total >= MAX_QUESTIONS) {
		return jsonError(c, 409, "TOO_MANY_QUESTIONS", "A quiz can have up to 200 questions.");
	}
	const [created] = await db
		.insert(quizQuestions)
		.values({
			courseId: course.id,
			...parsed,
			sortOrder: await nextOrder(db, quizQuestions, course.id),
		})
		.returning({ id: quizQuestions.id });
	await touchCourse(db, course.id);
	return c.json(created, 201);
});

courseRoutes.patch(
	"/courses/:id/quiz/questions/:questionId",
	requireUser,
	requireOrg,
	requireManager,
	async (c) => {
		const db = c.get("db");
		const course = await findCourse(db, idOf(c.req.param("id")), c.get("org").organizationId);
		const questionId = idOf(c.req.param("questionId"));
		if (!course || questionId === null) {
			return jsonError(c, 404, "NOT_FOUND", "That question doesn't exist.");
		}
		const parsed = parseQuestion(await readJson(c.req.raw));
		if (!parsed) return jsonError(c, 400, "INVALID_QUESTION", "Check the question and its answers.");
		const updated = await db
			.update(quizQuestions)
			.set(parsed)
			.where(and(eq(quizQuestions.id, questionId), eq(quizQuestions.courseId, course.id)))
			.returning({ id: quizQuestions.id });
		if (updated.length === 0) return jsonError(c, 404, "NOT_FOUND", "That question doesn't exist.");
		await touchCourse(db, course.id);
		return c.json({ ok: true });
	},
);

courseRoutes.delete(
	"/courses/:id/quiz/questions/:questionId",
	requireUser,
	requireOrg,
	requireManager,
	async (c) => {
		const db = c.get("db");
		const course = await findCourse(db, idOf(c.req.param("id")), c.get("org").organizationId);
		const questionId = idOf(c.req.param("questionId"));
		if (!course || questionId === null) {
			return jsonError(c, 404, "NOT_FOUND", "That question doesn't exist.");
		}
		const removed = await db
			.delete(quizQuestions)
			.where(and(eq(quizQuestions.id, questionId), eq(quizQuestions.courseId, course.id)))
			.returning({ id: quizQuestions.id });
		if (removed.length === 0) return jsonError(c, 404, "NOT_FOUND", "That question doesn't exist.");
		await touchCourse(db, course.id);
		return c.json({ ok: true });
	},
);

courseRoutes.post("/courses/:id/quiz/reorder", requireUser, requireOrg, requireManager, async (c) => {
	const db = c.get("db");
	const course = await findCourse(db, idOf(c.req.param("id")), c.get("org").organizationId);
	if (!course) return jsonError(c, 404, "NOT_FOUND", "That course doesn't exist.");
	const { ids } = await readJson(c.req.raw);
	const rows = await db
		.select({ id: quizQuestions.id })
		.from(quizQuestions)
		.where(eq(quizQuestions.courseId, course.id));
	const list = Array.isArray(ids) ? (ids as unknown[]) : [];
	if (
		rows.length === 0 ||
		list.length !== rows.length ||
		new Set(list).size !== list.length ||
		!rows.every((row) => list.includes(row.id))
	) {
		return jsonError(c, 400, "INVALID_ORDER", "Reload the page and try again.");
	}
	const updates = (list as number[]).map((id, index) =>
		db.update(quizQuestions).set({ sortOrder: index }).where(eq(quizQuestions.id, id)),
	);
	await db.batch(updates as [(typeof updates)[number], ...typeof updates]);
	return c.json({ ok: true });
});

interface ReviewItem {
	question: string;
	type: "single" | "multiple" | "truefalse";
	options: QuizOption[];
	chosen: number[];
	right: boolean;
}

function attemptView(
	attempt: typeof quizAttempts.$inferSelect,
	passingScore: number,
	attemptNumber: number,
) {
	return {
		score: attempt.score,
		correct: attempt.correct,
		total: attempt.total,
		passed: attempt.passed,
		passingScore,
		attemptNumber,
		// Answers stay hidden after a fail, as they could otherwise just be copied.
		review: attempt.passed ? (JSON.parse(attempt.review) as ReviewItem[]) : null,
	};
}

// The right answers are left out, and marking only ever happens on the server.
courseRoutes.get("/courses/:id/quiz", requireUser, requireOrg, async (c) => {
	const db = c.get("db");
	const userId = c.get("user").id;
	const loaded = await loadForLearner(c, idOf(c.req.param("id")));
	if (!loaded) return jsonError(c, 404, "NOT_FOUND", "That course doesn't exist.");
	const { course, preview } = loaded;
	const [state, rows, attempts, [certificate]] = await Promise.all([
		learnerState(db, course, userId),
		db
			.select()
			.from(quizQuestions)
			.where(eq(quizQuestions.courseId, course.id))
			.orderBy(asc(quizQuestions.sortOrder), asc(quizQuestions.id)),
		db
			.select()
			.from(quizAttempts)
			.where(and(eq(quizAttempts.courseId, course.id), eq(quizAttempts.userId, userId)))
			.orderBy(asc(quizAttempts.id)),
		db
			.select({ id: certificates.id })
			.from(certificates)
			.where(and(eq(certificates.courseId, course.id), eq(certificates.userId, userId))),
	]);
	if (rows.length === 0) return jsonError(c, 404, "NOT_FOUND", "This course has no quiz.");
	const last = attempts.at(-1);
	const passed = attempts.findLast((attempt) => attempt.passed);
	const shown = passed ?? last;
	const canSeeQuestions = preview || state.quizUnlocked;
	return c.json({
		courseTitle: course.title,
		title: course.quizTitle,
		passingScore: course.passingScore,
		unlocked: state.quizUnlocked,
		preview,
		certificateId: certificate?.id ?? null,
		result: shown
			? attemptView(shown, course.passingScore, attempts.indexOf(shown) + 1)
			: null,
		questions: canSeeQuestions
			? rows.map((row) => ({
					id: row.id,
					question: row.question,
					type: row.type,
					options: (JSON.parse(row.options) as QuizOption[]).map((option) => option.text),
				}))
			: [],
	});
});

courseRoutes.post("/courses/:id/quiz/attempts", requireUser, requireOrg, async (c) => {
	const db = c.get("db");
	const org = c.get("org");
	const currentUser = c.get("user");
	const loaded = await loadForLearner(c, idOf(c.req.param("id")));
	if (!loaded) return jsonError(c, 404, "NOT_FOUND", "That course doesn't exist.");
	const { course, preview } = loaded;
	if (preview) return jsonError(c, 403, "PREVIEW_ONLY", "Previews aren't recorded.");
	const state = await learnerState(db, course, currentUser.id);
	if (!state.hasQuiz) return jsonError(c, 404, "NOT_FOUND", "This course has no quiz.");
	if (!state.quizUnlocked) {
		return jsonError(c, 409, "QUIZ_LOCKED", "Finish the required lessons first.");
	}
	if (state.quizPassed) {
		return jsonError(c, 409, "ALREADY_PASSED", "You've already passed this quiz.");
	}
	const { answers } = await readJson(c.req.raw);
	const rows = await db
		.select()
		.from(quizQuestions)
		.where(eq(quizQuestions.courseId, course.id))
		.orderBy(asc(quizQuestions.sortOrder), asc(quizQuestions.id));
	const given = (answers && typeof answers === "object" ? answers : {}) as Record<string, unknown>;
	const review: ReviewItem[] = [];
	for (const row of rows) {
		const options = JSON.parse(row.options) as QuizOption[];
		const chosen = given[row.id];
		if (
			!Array.isArray(chosen) ||
			chosen.length === 0 ||
			new Set(chosen).size !== chosen.length ||
			!chosen.every(
				(index) => Number.isInteger(index) && index >= 0 && index < options.length,
			)
		) {
			return jsonError(c, 400, "UNANSWERED", "Answer every question to submit.");
		}
		review.push({
			question: row.question,
			type: row.type,
			options,
			chosen: chosen as number[],
			right: sameAnswers(chosen as number[], options),
		});
	}
	const correct = review.filter((item) => item.right).length;
	const total = review.length;
	const passed = correct * 100 >= course.passingScore * total;
	const score = Math.round((correct / total) * 100);
	const [attempt] = await db
		.insert(quizAttempts)
		.values({
			courseId: course.id,
			userId: currentUser.id,
			score,
			correct,
			total,
			passed,
			review: JSON.stringify(review),
		})
		.returning();
	await markStarted(db, course.id, currentUser.id);
	const finished = passed
		? await completeIfFinished(db, course, org, currentUser, score)
		: { completed: false, certificateId: null };
	return c.json(
		{
			...attemptView(attempt, course.passingScore, state.attempts + 1),
			...finished,
		},
		201,
	);
});

courseRoutes.get("/courses/:id/learners", requireUser, requireOrg, requireManager, async (c) => {
	const db = c.get("db");
	const org = c.get("org");
	const course = await findCourse(db, idOf(c.req.param("id")), org.organizationId);
	if (!course) return jsonError(c, 404, "NOT_FOUND", "That course doesn't exist.");
	const [members, enrollments, progress, attempts, outline] = await Promise.all([
		db
			.select({
				id: user.id,
				name: user.name,
				email: user.email,
				departmentId: userProfiles.departmentId,
				departmentName: departments.name,
			})
			.from(userProfiles)
			.innerJoin(user, eq(userProfiles.userId, user.id))
			.leftJoin(departments, eq(userProfiles.departmentId, departments.id))
			.where(
				and(
					eq(userProfiles.organizationId, org.organizationId),
					eq(userProfiles.isActive, true),
				),
			)
			.orderBy(asc(user.name)),
		db.select().from(courseEnrollments).where(eq(courseEnrollments.courseId, course.id)),
		db
			.select({
				userId: lessonProgress.userId,
				isRequired: courseLessons.isRequired,
			})
			.from(lessonProgress)
			.innerJoin(courseLessons, eq(lessonProgress.lessonId, courseLessons.id))
			.where(eq(lessonProgress.courseId, course.id)),
		db
			.select({ userId: quizAttempts.userId, score: quizAttempts.score, passed: quizAttempts.passed })
			.from(quizAttempts)
			.where(eq(quizAttempts.courseId, course.id)),
		loadOutline(db, course.id),
	]);
	const required = outline.lessons.filter((lesson) => lesson.isRequired).length;
	const steps = required + (outline.questionCount > 0 ? 1 : 0);
	const byUser = new Map(enrollments.map((row) => [row.userId, row]));
	const learners = members.flatMap((member) => {
		const enrollment = byUser.get(member.id);
		if (!course.isMandatory && !enrollment?.isAssigned) return [];
		const lessonsDone = progress.filter((row) => row.userId === member.id && row.isRequired).length;
		const mine = attempts.filter((row) => row.userId === member.id);
		const passed = mine.some((row) => row.passed);
		const stepsDone = lessonsDone + (passed ? 1 : 0);
		return [
			{
				...member,
				isAssigned: Boolean(enrollment?.isAssigned),
				status: enrollment?.completedAt
					? ("completed" as const)
					: enrollment?.startedAt
						? ("in_progress" as const)
						: ("not_started" as const),
				percent: enrollment?.completedAt
					? 100
					: steps === 0
						? 0
						: Math.round((stepsDone / steps) * 100),
				bestScore: mine.length > 0 ? Math.max(...mine.map((row) => row.score)) : null,
				attempts: mine.length,
				completedAt: enrollment?.completedAt ?? null,
			},
		];
	});
	return c.json({
		title: course.title,
		isMandatory: course.isMandatory,
		learners,
		members,
	});
});

courseRoutes.post("/courses/:id/enrollments", requireUser, requireOrg, requireManager, async (c) => {
	const db = c.get("db");
	const org = c.get("org");
	const course = await findCourse(db, idOf(c.req.param("id")), org.organizationId);
	if (!course) return jsonError(c, 404, "NOT_FOUND", "That course doesn't exist.");
	const { userIds } = await readJson(c.req.raw);
	const list = Array.isArray(userIds) ? [...new Set(userIds as unknown[])] : [];
	if (list.length < 1 || list.length > 1000 || !list.every((id) => typeof id === "string")) {
		return jsonError(c, 400, "INVALID_USERS", "Choose at least one person.");
	}
	const members = await db
		.select({ userId: userProfiles.userId })
		.from(userProfiles)
		.where(
			and(eq(userProfiles.organizationId, org.organizationId), eq(userProfiles.isActive, true)),
		);
	const allowed = new Set(members.map((member) => member.userId));
	if (!list.every((id) => allowed.has(id as string))) {
		return jsonError(c, 400, "INVALID_USERS", "Choose people in your organization.");
	}
	const actorId = c.get("user").id;
	// D1 limits how many values one statement can carry.
	const statements = (list as string[]).map((userId) =>
		db
			.insert(courseEnrollments)
			.values({ courseId: course.id, userId, isAssigned: true, assignedBy: actorId })
			.onConflictDoUpdate({
				target: [courseEnrollments.courseId, courseEnrollments.userId],
				set: { isAssigned: true, assignedBy: actorId },
			}),
	);
	await db.batch([
		audit(db, org.organizationId, actorId, "course.assigned", course.id, { people: list.length }),
		...statements,
	]);
	return c.json({ assigned: list.length }, 201);
});

// Their progress stays, so assigning them again picks up where they left off.
courseRoutes.delete(
	"/courses/:id/enrollments/:userId",
	requireUser,
	requireOrg,
	requireManager,
	async (c) => {
		const db = c.get("db");
		const org = c.get("org");
		const course = await findCourse(db, idOf(c.req.param("id")), org.organizationId);
		if (!course) return jsonError(c, 404, "NOT_FOUND", "That course doesn't exist.");
		await db
			.update(courseEnrollments)
			.set({ isAssigned: false })
			.where(
				and(
					eq(courseEnrollments.courseId, course.id),
					eq(courseEnrollments.userId, c.req.param("userId")),
				),
			);
		return c.json({ ok: true });
	},
);

courseRoutes.get("/me/certificates", requireUser, requireOrg, async (c) => {
	const rows = await c
		.get("db")
		.select({
			id: certificates.id,
			courseTitle: certificates.courseTitle,
			issuedAt: certificates.issuedAt,
			score: certificates.score,
		})
		.from(certificates)
		.where(
			and(
				eq(certificates.userId, c.get("user").id),
				eq(certificates.organizationId, c.get("org").organizationId),
			),
		)
		.orderBy(desc(certificates.issuedAt));
	return c.json({ certificates: rows });
});

courseRoutes.get("/certificates/:id", requireUser, requireOrg, async (c) => {
	const org = c.get("org");
	const id = idOf(c.req.param("id"));
	const [certificate] =
		id === null
			? []
			: await c
					.get("db")
					.select()
					.from(certificates)
					.where(
						and(eq(certificates.id, id), eq(certificates.organizationId, org.organizationId)),
					);
	if (!certificate || (certificate.userId !== c.get("user").id && !isManager(org))) {
		return jsonError(c, 404, "NOT_FOUND", "That certificate doesn't exist.");
	}
	return c.json({
		id: certificate.id,
		recipientName: certificate.recipientName,
		courseTitle: certificate.courseTitle,
		organizationName: certificate.organizationName,
		score: certificate.score,
		code: certificate.code,
		issuedAt: certificate.issuedAt,
	});
});

// For the dashboard to-do list.
export async function pendingCoursesFor(db: Db, org: Membership, userId: string) {
	const [rows, mine] = await Promise.all([
		db
			.select({ id: courses.id, title: courses.title, isMandatory: courses.isMandatory })
			.from(courses)
			.where(and(eq(courses.organizationId, org.organizationId), eq(courses.status, "published")))
			.orderBy(desc(courses.isMandatory), desc(courses.updatedAt)),
		db
			.select({
				courseId: courseEnrollments.courseId,
				isAssigned: courseEnrollments.isAssigned,
				completedAt: courseEnrollments.completedAt,
			})
			.from(courseEnrollments)
			.where(eq(courseEnrollments.userId, userId)),
	]);
	const byCourse = new Map(mine.map((row) => [row.courseId, row]));
	return rows
		.filter((course) => {
			const enrollment = byCourse.get(course.id);
			return !enrollment?.completedAt && (course.isMandatory || enrollment?.isAssigned);
		})
		.map(({ id, title }) => ({ id, title }));
}
