import { and, asc, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import {
	auditLog,
	certificates,
	courseEnrollments,
	courseLessons,
	courses,
	departments,
	lessonProgress,
	policyAcknowledgments,
	quizAttempts,
	user,
	userProfiles,
} from "./db/schema";
import { memberPhotoUrl } from "./media";
import {
	jsonError,
	requireOrg,
	requireRole,
	requireUser,
	type AppEnv,
} from "./middleware";
import { policyReportRows } from "./policies";
import { cleanText, readJson } from "./validate";

const requireManager = requireRole("manager", "admin");

function dateOrNull(value: unknown) {
	if (value === null || value === undefined || value === "") return null;
	const date = new Date(String(value));
	return Number.isNaN(date.getTime()) ? undefined : date;
}

export const peopleRoutes = new Hono<AppEnv>();

// Everything a manager needs about one person, always within their own organization.
peopleRoutes.get(
	"/organizations/current/members/:userId/profile",
	requireUser,
	requireOrg,
	requireManager,
	async (c) => {
		const db = c.get("db");
		const org = c.get("org");
		const targetId = c.req.param("userId");
		const [member] = await db
			.select({
				userId: user.id,
				name: user.name,
				email: user.email,
				role: userProfiles.role,
				isActive: userProfiles.isActive,
				departmentId: userProfiles.departmentId,
				departmentName: departments.name,
				position: userProfiles.position,
				bio: userProfiles.bio,
				contactEmail: userProfiles.contactEmail,
				viberLink: userProfiles.viberLink,
				facebookLink: userProfiles.facebookLink,
				photoKey: userProfiles.photoKey,
				joinedAt: userProfiles.joinedAt,
				interviewDate: userProfiles.interviewDate,
				onboardingDate: userProfiles.onboardingDate,
			})
			.from(userProfiles)
			.innerJoin(user, eq(userProfiles.userId, user.id))
			.leftJoin(departments, eq(userProfiles.departmentId, departments.id))
			.where(
				and(
					eq(userProfiles.userId, targetId),
					eq(userProfiles.organizationId, org.organizationId),
				),
			);
		if (!member) return jsonError(c, 404, "NOT_FOUND", "That person isn't in your organization.");

		const [policyRows, acks, courseRows, enrollments, lessons, done, attempts, certificateRows] =
			await Promise.all([
				policyReportRows(db, org.organizationId, null),
				db
					.select({
						policyId: policyAcknowledgments.policyId,
						version: policyAcknowledgments.policyVersion,
						at: policyAcknowledgments.acknowledgedAt,
					})
					.from(policyAcknowledgments)
					.where(eq(policyAcknowledgments.userId, targetId)),
				db
					.select({ id: courses.id, title: courses.title, isMandatory: courses.isMandatory })
					.from(courses)
					.where(and(eq(courses.organizationId, org.organizationId), eq(courses.status, "published")))
					.orderBy(asc(courses.title)),
				db
					.select()
					.from(courseEnrollments)
					.where(eq(courseEnrollments.userId, targetId)),
				db
					.select({ courseId: courseLessons.courseId, isRequired: courseLessons.isRequired, id: courseLessons.id })
					.from(courseLessons)
					.innerJoin(courses, eq(courseLessons.courseId, courses.id))
					.where(eq(courses.organizationId, org.organizationId)),
				db
					.select({ lessonId: lessonProgress.lessonId })
					.from(lessonProgress)
					.where(eq(lessonProgress.userId, targetId)),
				db
					.select({ courseId: quizAttempts.courseId, score: quizAttempts.score, passed: quizAttempts.passed })
					.from(quizAttempts)
					.where(eq(quizAttempts.userId, targetId)),
				db
					.select({
						id: certificates.id,
						courseTitle: certificates.courseTitle,
						issuedAt: certificates.issuedAt,
						score: certificates.score,
					})
					.from(certificates)
					.where(
						and(eq(certificates.userId, targetId), eq(certificates.organizationId, org.organizationId)),
					)
					.orderBy(desc(certificates.issuedAt)),
			]);

		const doneIds = new Set(done.map((row) => row.lessonId));
		const { photoKey, ...details } = member;
		return c.json({
			...details,
			photoUrl: memberPhotoUrl(member.userId, photoKey),
			policies: policyRows
				.filter((policy) => policy.audienceIds.includes(targetId))
				.map((policy) => ({
					id: policy.id,
					title: policy.title,
					isMandatory: policy.isMandatory,
					acknowledgedAt:
						acks.find((ack) => ack.policyId === policy.id && ack.version === policy.version)?.at ??
						null,
				})),
			courses: courseRows.flatMap((course) => {
				const enrollment = enrollments.find((row) => row.courseId === course.id);
				if (!course.isMandatory && !enrollment?.isAssigned) return [];
				const required = lessons.filter((row) => row.courseId === course.id && row.isRequired);
				const scores = attempts.filter((row) => row.courseId === course.id);
				return [
					{
						id: course.id,
						title: course.title,
						isMandatory: course.isMandatory,
						isAssigned: Boolean(enrollment?.isAssigned),
						status: enrollment?.completedAt
							? "completed"
							: enrollment?.startedAt
								? "in_progress"
								: "not_started",
						lessonsDone: required.filter((row) => doneIds.has(row.id)).length,
						lessonTotal: required.length,
						bestScore: scores.length ? Math.max(...scores.map((row) => row.score)) : null,
						passed: scores.some((row) => row.passed),
						completedAt: enrollment?.completedAt ?? null,
					},
				];
			}),
			certificates: certificateRows,
		});
	},
);

peopleRoutes.patch(
	"/organizations/current/members/:userId/employment",
	requireUser,
	requireOrg,
	requireManager,
	async (c) => {
		const db = c.get("db");
		const org = c.get("org");
		const targetId = c.req.param("userId");
		const where = and(
			eq(userProfiles.userId, targetId),
			eq(userProfiles.organizationId, org.organizationId),
		);
		const [target] = await db.select({ role: userProfiles.role }).from(userProfiles).where(where);
		if (!target) return jsonError(c, 404, "NOT_FOUND", "That person isn't in your organization.");
		// The same rule as changing roles: managers look after staff, admins everyone.
		if (org.role !== "admin" && target.role !== "staff") {
			return jsonError(c, 403, "FORBIDDEN", "Only an admin can change this person's details.");
		}
		const body = await readJson(c.req.raw);
		const position = cleanText(body.position);
		const interviewDate = dateOrNull(body.interviewDate);
		const onboardingDate = dateOrNull(body.onboardingDate);
		if (position.length > 255 || interviewDate === undefined || onboardingDate === undefined) {
			return jsonError(c, 400, "INVALID_DETAILS", "Check the details.");
		}
		await db.batch([
			db
				.update(userProfiles)
				.set({ position: position || null, interviewDate, onboardingDate })
				.where(where),
			db.insert(auditLog).values({
				organizationId: org.organizationId,
				actorUserId: c.get("user").id,
				action: "member.employment_updated",
				targetType: "user",
				targetId,
			}),
		]);
		return c.json({ ok: true });
	},
);
