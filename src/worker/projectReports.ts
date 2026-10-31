import { and, desc, eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import type { Context } from "hono";
import type { Db } from "./db";
import { projectFileVersions, projectFiles, projectReportFiles, projectReports } from "./db/schema";
import { sendEmail } from "./email";
import { jsonError, requireOrg, requireUser, type AppEnv } from "./middleware";
import { requireModule } from "./modules";
import { canEdit, contributes, expectedPeriods, isLead, loadPeople, loadVisible, record, PERIOD } from "./projects";
import { cleanText, readJson } from "./validate";

type Project = NonNullable<Awaited<ReturnType<typeof loadVisible>>>;
type Report = typeof projectReports.$inferSelect;

export const projectReportRoutes = new Hono<AppEnv>();
const gate = [requireUser, requireOrg, requireModule("projects")] as const;
const NOT_FOUND = "That project doesn't exist.";
const NO_REPORT = "That report doesn't exist.";

function readFields(body: Record<string, unknown>) {
	const activities = cleanText(body.activities, { multiline: true });
	const challenges = cleanText(body.challenges, { multiline: true });
	const nextPlan = cleanText(body.nextPlan, { multiline: true });
	const beneficiaries = body.beneficiaries === null || body.beneficiaries === "" || body.beneficiaries === undefined ? null : Number(body.beneficiaries);
	const budgetSpent = body.budgetSpent === null || body.budgetSpent === "" || body.budgetSpent === undefined ? null : Number(body.budgetSpent);
	if (activities.length > 6000 || challenges.length > 6000 || nextPlan.length > 6000) return null;
	if (beneficiaries !== null && (!Number.isInteger(beneficiaries) || beneficiaries < 0 || beneficiaries > 1e9)) return null;
	if (budgetSpent !== null && (!Number.isFinite(budgetSpent) || budgetSpent < 0 || budgetSpent > 1e13)) return null;
	return { activities: activities || null, challenges: challenges || null, nextPlan: nextPlan || null, beneficiaries, budgetSpent };
}

async function validFiles(db: Db, projectId: number, value: unknown) {
	if (!Array.isArray(value)) return [];
	const ids = [...new Set(value.map(Number))].filter(Number.isInteger).slice(0, 20);
	if (ids.length === 0) return [];
	const rows = await db
		.select({ id: projectFiles.id })
		.from(projectFiles)
		.where(and(eq(projectFiles.projectId, projectId), inArray(projectFiles.id, ids)));
	return rows.map((row) => row.id);
}

async function saveFiles(db: Db, report: { id: number }, fileIds: number[]) {
	await db.delete(projectReportFiles).where(eq(projectReportFiles.reportId, report.id));
	if (fileIds.length) await db.insert(projectReportFiles).values(fileIds.map((fileId) => ({ reportId: report.id, fileId })));
}

async function findReport(db: Db, projectId: number, rawId: string | undefined) {
	const [report] = await db
		.select()
		.from(projectReports)
		.where(and(eq(projectReports.id, Number(rawId)), eq(projectReports.projectId, projectId)));
	return report ?? null;
}

// Whoever wrote or last submitted a report doesn't approve it, so a lead can't sign
// off their own revision of someone else's report. It goes to another lead or an admin.
function canReview(project: Project, report: Report, userId: string, role: string) {
	return report.createdBy !== userId && report.submittedBy !== userId && (role === "admin" || isLead(project, userId));
}

function canChange(project: Project, report: Report, userId: string, role: string) {
	return report.createdBy === userId || canEdit(project, userId, role);
}

function notify(c: Context<AppEnv>, to: (string | undefined)[], subject: string, projectId: number) {
	const link = `${c.env.HUB_URL}/projects/${projectId}`;
	c.executionCtx.waitUntil(
		Promise.allSettled(
			[...new Set(to.filter((address): address is string => !!address))].map((address) =>
				sendEmail(c.env, { to: address, subject, text: `${subject}\n\n${link}` }),
			),
		),
	);
}

projectReportRoutes.get("/projects/:id/reports", ...gate, async (c) => {
	const db = c.get("db");
	const project = await loadVisible(c);
	if (!project) return jsonError(c, 404, "NOT_FOUND", NOT_FOUND);
	const userId = c.get("user").id;
	const role = c.get("org").role;
	const [reports, attachments, people] = await Promise.all([
		db.select().from(projectReports).where(eq(projectReports.projectId, project.id)).orderBy(desc(projectReports.period), desc(projectReports.id)),
		db
			.select({
				reportId: projectReportFiles.reportId,
				fileId: projectReportFiles.fileId,
				name: projectFileVersions.name,
			})
			.from(projectReportFiles)
			.innerJoin(projectFiles, eq(projectReportFiles.fileId, projectFiles.id))
			.leftJoin(
				projectFileVersions,
				and(eq(projectFileVersions.fileId, projectFiles.id), eq(projectFileVersions.version, projectFiles.currentVersion)),
			)
			.where(eq(projectFiles.projectId, project.id)),
		loadPeople(db, project.organizationId),
	]);
	const names = new Map(people.map((person) => [person.userId, person.name]));
	const today = new Date().toISOString().slice(0, 10);
	return c.json({
		reports: reports.map((report) => ({
			...report,
			authorName: report.createdBy ? (names.get(report.createdBy) ?? null) : null,
			reviewerName: report.reviewedBy ? (names.get(report.reviewedBy) ?? null) : null,
			canChange: canChange(project, report, userId, role) && (report.status === "draft" || report.status === "needs_revision"),
			canReview: report.status === "submitted" && canReview(project, report, userId, role),
			files: attachments.filter((row) => row.reportId === report.id).map(({ fileId, name }) => ({ fileId, name })),
		})),
		schedule: expectedPeriods(
			project,
			today,
			new Set(reports.filter((report) => report.type === "form" && ["submitted", "approved", "locked"].includes(report.status)).map((report) => report.period)),
		).map((item) => ({
			...item,
			reportId: reports.find((report) => report.period === item.period && report.type === "form")?.id ?? null,
		})),
		canContribute: await contributes(db, project, userId, role),
		canManage: canEdit(project, userId, role),
		frequency: project.reportingFrequency,
		currency: project.budgetCurrency,
	});
});

projectReportRoutes.post("/projects/:id/reports", ...gate, async (c) => {
	const db = c.get("db");
	const project = await loadVisible(c);
	if (!project) return jsonError(c, 404, "NOT_FOUND", NOT_FOUND);
	const userId = c.get("user").id;
	if (!(await contributes(db, project, userId, c.get("org").role))) {
		return jsonError(c, 403, "FORBIDDEN", "You can't add reports to this project.");
	}
	const body = await readJson(c.req.raw);
	const type = body.type === "file" ? "file" : "form";
	const period = cleanText(body.period);
	const label = cleanText(body.label);
	if (type === "form" && !PERIOD.test(period)) return jsonError(c, 400, "INVALID_PERIOD", "Choose a reporting period.");
	if (type === "file" && (label.length < 1 || label.length > 120)) return jsonError(c, 400, "INVALID_LABEL", "Name this report.");
	const fields = readFields(body);
	if (!fields) return jsonError(c, 400, "INVALID_REPORT", "Check the report details.");
	if (type === "form") {
		const [existing] = await db
			.select({ id: projectReports.id })
			.from(projectReports)
			.where(and(eq(projectReports.projectId, project.id), eq(projectReports.type, "form"), eq(projectReports.period, period)));
		if (existing) return jsonError(c, 409, "PERIOD_EXISTS", "There's already a report for that period.");
	}
	const fileIds = await validFiles(db, project.id, body.fileIds);
	const [mainFile] = type === "file" ? await validFiles(db, project.id, [body.fileId]) : [];
	if (type === "file" && !mainFile) return jsonError(c, 400, "FILE_REQUIRED", "Attach the report file.");
	const [created] = await db
		.insert(projectReports)
		.values({
			...fields,
			projectId: project.id,
			organizationId: project.organizationId,
			type,
			period: type === "form" ? period : new Date().toISOString().slice(0, 10),
			label: type === "file" ? label : null,
			fileId: mainFile ?? null,
			createdBy: userId,
		})
		.returning({ id: projectReports.id });
	await saveFiles(db, created, fileIds);
	await record(db, c, project.id, "report_created", type === "form" ? period : label);
	return c.json(created, 201);
});

projectReportRoutes.patch("/projects/:id/reports/:reportId", ...gate, async (c) => {
	const db = c.get("db");
	const project = await loadVisible(c);
	if (!project) return jsonError(c, 404, "NOT_FOUND", NOT_FOUND);
	const report = await findReport(db, project.id, c.req.param("reportId"));
	if (!report) return jsonError(c, 404, "NOT_FOUND", NO_REPORT);
	if (!canChange(project, report, c.get("user").id, c.get("org").role)) return jsonError(c, 403, "FORBIDDEN", "You can't change this report.");
	if (report.status !== "draft" && report.status !== "needs_revision") return jsonError(c, 409, "LOCKED", "This report can't be changed now.");
	const body = await readJson(c.req.raw);
	const fields = readFields(body);
	if (!fields) return jsonError(c, 400, "INVALID_REPORT", "Check the report details.");
	await db.update(projectReports).set(fields).where(eq(projectReports.id, report.id));
	await saveFiles(db, report, await validFiles(db, project.id, body.fileIds));
	return c.json({ ok: true });
});

projectReportRoutes.delete("/projects/:id/reports/:reportId", ...gate, async (c) => {
	const db = c.get("db");
	const project = await loadVisible(c);
	if (!project) return jsonError(c, 404, "NOT_FOUND", NOT_FOUND);
	const report = await findReport(db, project.id, c.req.param("reportId"));
	if (!report) return jsonError(c, 404, "NOT_FOUND", NO_REPORT);
	if (!canChange(project, report, c.get("user").id, c.get("org").role)) return jsonError(c, 403, "FORBIDDEN", "You can't change this report.");
	if (report.status !== "draft") return jsonError(c, 409, "LOCKED", "Only a draft can be deleted.");
	await db.delete(projectReports).where(eq(projectReports.id, report.id));
	return c.json({ ok: true });
});

projectReportRoutes.post("/projects/:id/reports/:reportId/submit", ...gate, async (c) => {
	const db = c.get("db");
	const project = await loadVisible(c);
	if (!project) return jsonError(c, 404, "NOT_FOUND", NOT_FOUND);
	const report = await findReport(db, project.id, c.req.param("reportId"));
	if (!report) return jsonError(c, 404, "NOT_FOUND", NO_REPORT);
	if (!canChange(project, report, c.get("user").id, c.get("org").role)) return jsonError(c, 403, "FORBIDDEN", "You can't change this report.");
	if (report.status !== "draft" && report.status !== "needs_revision") return jsonError(c, 409, "LOCKED", "This report has already been submitted.");
	if (report.type === "form" && !report.activities) return jsonError(c, 400, "INCOMPLETE", "Say what was done in this period.");
	await db
		.update(projectReports)
		.set({ status: "submitted", submittedAt: new Date(), submittedBy: c.get("user").id, reviewComment: null, reviewedBy: null, reviewedAt: null })
		.where(eq(projectReports.id, report.id));
	await record(db, c, project.id, "report_submitted", report.label ?? report.period);
	const people = await loadPeople(db, project.organizationId);
	const leads = people.filter((person) => person.isActive && isLead(project, person.userId) && person.userId !== c.get("user").id);
	const reviewers = leads.length ? leads : people.filter((person) => person.isActive && person.role === "admin" && person.userId !== c.get("user").id);
	notify(c, reviewers.map((person) => person.email), `A report is waiting for review: ${project.name}`, project.id);
	return c.json({ ok: true });
});

projectReportRoutes.post("/projects/:id/reports/:reportId/decision", ...gate, async (c) => {
	const db = c.get("db");
	const project = await loadVisible(c);
	if (!project) return jsonError(c, 404, "NOT_FOUND", NOT_FOUND);
	const report = await findReport(db, project.id, c.req.param("reportId"));
	if (!report) return jsonError(c, 404, "NOT_FOUND", NO_REPORT);
	if (!canReview(project, report, c.get("user").id, c.get("org").role)) return jsonError(c, 403, "FORBIDDEN", "You can't review this report.");
	if (report.status !== "submitted") return jsonError(c, 409, "ALREADY_DECIDED", "This report isn't waiting for review.");
	const body = await readJson(c.req.raw);
	const comment = cleanText(body.comment, { multiline: true });
	if (body.decision !== "approve" && body.decision !== "revise") return jsonError(c, 400, "INVALID_DECISION", "Choose a decision.");
	if (body.decision === "revise" && !comment) return jsonError(c, 400, "COMMENT_REQUIRED", "Say what needs to change.");
	if (comment.length > 2000) return jsonError(c, 400, "INVALID_DECISION", "That comment is too long.");
	const status = body.decision === "approve" ? "approved" : "needs_revision";
	await db
		.update(projectReports)
		.set({ status, reviewComment: comment || null, reviewedBy: c.get("user").id, reviewedAt: new Date() })
		.where(eq(projectReports.id, report.id));
	await record(db, c, project.id, status === "approved" ? "report_approved" : "report_returned", report.label ?? report.period);
	const people = await loadPeople(db, project.organizationId);
	notify(c, [people.find((person) => person.userId === report.createdBy)?.email], `Your report was reviewed: ${project.name}`, project.id);
	return c.json({ ok: true });
});

// Locked is final. An approved report can still start a new revision.
projectReportRoutes.post("/projects/:id/reports/:reportId/lock", ...gate, async (c) => {
	const db = c.get("db");
	const project = await loadVisible(c);
	if (!project) return jsonError(c, 404, "NOT_FOUND", NOT_FOUND);
	if (!canEdit(project, c.get("user").id, c.get("org").role)) return jsonError(c, 403, "FORBIDDEN", "You can't change this project.");
	const report = await findReport(db, project.id, c.req.param("reportId"));
	if (!report) return jsonError(c, 404, "NOT_FOUND", NO_REPORT);
	if (report.status !== "approved") return jsonError(c, 409, "NOT_APPROVED", "Only an approved report can be locked.");
	await db.update(projectReports).set({ status: "locked" }).where(eq(projectReports.id, report.id));
	await record(db, c, project.id, "report_locked", report.label ?? report.period);
	return c.json({ ok: true });
});

projectReportRoutes.post("/projects/:id/reports/:reportId/revise", ...gate, async (c) => {
	const db = c.get("db");
	const project = await loadVisible(c);
	if (!project) return jsonError(c, 404, "NOT_FOUND", NOT_FOUND);
	if (!canEdit(project, c.get("user").id, c.get("org").role)) return jsonError(c, 403, "FORBIDDEN", "You can't change this project.");
	const report = await findReport(db, project.id, c.req.param("reportId"));
	if (!report) return jsonError(c, 404, "NOT_FOUND", NO_REPORT);
	if (report.status !== "approved") return jsonError(c, 409, "LOCKED", "Only an approved report can be revised.");
	await db
		.update(projectReports)
		.set({ status: "draft", revision: report.revision + 1, reviewComment: null, reviewedBy: null, reviewedAt: null })
		.where(eq(projectReports.id, report.id));
	await record(db, c, project.id, "report_revised", report.label ?? report.period);
	return c.json({ ok: true });
});
