import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { Hono } from "hono";
import { loadRouting, reviewQueue } from "./capacity";
import { capacityUserSkills, directoryProfiles, projectReports, projects, trainingRecords } from "./db/schema";
import { requireOrg, requireUser, type AppEnv } from "./middleware";
import { activeModuleKeys } from "./modules";
import { canReview } from "./projectReports";

// What this person has to do next, across the modules. Everything here is theirs
// to see already, and restricted training is only ever counted.
export const taskRoutes = new Hono<AppEnv>();

type Task =
	| { kind: "training_changes"; title: string; href: string }
	| { kind: "report_revise"; title: string; period: string | null; label: string | null; href: string }
	| { kind: "report_review"; title: string; count: number; href: string }
	| { kind: "training_reviews" | "skills_assess" | "display_names"; count: number; href: string };

taskRoutes.get("/my-tasks", requireUser, requireOrg, async (c) => {
	const db = c.get("db");
	const org = c.get("org");
	const userId = c.get("user").id;
	const active = await activeModuleKeys(db, org.organizationId);
	const tasks: Task[] = [];

	if (active.includes("capacity_building")) {
		const [sentBack, routing, pendingSkills] = await Promise.all([
			db
				.select({ id: trainingRecords.id, title: trainingRecords.title })
				.from(trainingRecords)
				.where(and(eq(trainingRecords.organizationId, org.organizationId), eq(trainingRecords.userId, userId), eq(trainingRecords.reviewStatus, "changes_requested"))),
			loadRouting(db, org.organizationId),
			db
				.select({ userId: capacityUserSkills.userId })
				.from(capacityUserSkills)
				.where(and(eq(capacityUserSkills.organizationId, org.organizationId), isNotNull(capacityUserSkills.pendingLevel))),
		]);
		for (const record of sentBack) tasks.push({ kind: "training_changes", title: record.title, href: `/capacity/records/${record.id}` });
		const queue = await reviewQueue(db, org.organizationId, userId, routing);
		const toReview = queue.items.filter((item) => item.tab === "to_review").length;
		if (toReview) tasks.push({ kind: "training_reviews", count: toReview, href: "/capacity/reviews" });
		const toAssess = pendingSkills.filter((row) => routing.reviewersFor(row.userId).some((person) => person.userId === userId)).length;
		if (toAssess) tasks.push({ kind: "skills_assess", count: toAssess, href: "/capacity/skills" });
	}

	if (active.includes("projects")) {
		const rows = await db
			.select({ report: projectReports, project: projects })
			.from(projectReports)
			.innerJoin(projects, eq(projectReports.projectId, projects.id))
			.where(and(eq(projects.organizationId, org.organizationId), inArray(projectReports.status, ["needs_revision", "submitted"])));
		const waiting = new Map<number, { title: string; count: number }>();
		for (const { report, project } of rows) {
			if (report.status === "needs_revision" && report.createdBy === userId) {
				tasks.push({ kind: "report_revise", title: project.name, period: report.period, label: report.label, href: `/projects/${project.id}?tab=reports` });
			}
			if (report.status === "submitted" && canReview(project, report, userId, org.role)) {
				const entry = waiting.get(project.id) ?? { title: project.name, count: 0 };
				entry.count += 1;
				waiting.set(project.id, entry);
			}
		}
		for (const [id, entry] of waiting) tasks.push({ kind: "report_review", ...entry, href: `/projects/${id}?tab=reports` });
	}

	if (active.includes("people_directory") && org.role === "admin") {
		const names = await db
			.select({ approved: directoryProfiles.displayNameApproved })
			.from(directoryProfiles)
			.where(and(eq(directoryProfiles.organizationId, org.organizationId), isNotNull(directoryProfiles.displayName)));
		const count = names.filter((row) => !row.approved).length;
		if (count) tasks.push({ kind: "display_names", count, href: "/directory" });
	}
	return c.json({ tasks });
});
