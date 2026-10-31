import { and, desc, eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import type { Db } from "./db";
import {
	projectFileVersions,
	projectFiles,
	projectMembers,
	projectMilestones,
	projectReports,
	projects,
	projectWidgets,
} from "./db/schema";
import { jsonError, requireOrg, requireRole, requireUser, type AppEnv } from "./middleware";
import { requireModule } from "./modules";
import { canEdit, canSee, expectedPeriods, loadPeople, loadVisible, record, type Project } from "./projects";
import { cleanText, readJson } from "./validate";

export const projectInsightRoutes = new Hono<AppEnv>();
const gate = [requireUser, requireOrg, requireModule("projects")] as const;
const NOT_FOUND = "That project doesn't exist.";
const DONE = ["approved", "locked"];

// ---- Close-out

async function completionChecks(db: Db, project: Project, today: string) {
	const [milestones, reports] = await Promise.all([
		db.select().from(projectMilestones).where(eq(projectMilestones.projectId, project.id)),
		db.select().from(projectReports).where(eq(projectReports.projectId, project.id)),
	]);
	const done = milestones.filter((milestone) => milestone.completedAt).length;
	const approvedPeriods = new Set(reports.filter((report) => report.type === "form" && DONE.includes(report.status)).map((report) => report.period));
	// A period that isn't due yet can't hold up closing a project early.
	const missing = expectedPeriods(project, today).filter((item) => item.dueDate <= today && !approvedPeriods.has(item.period));
	const open = reports.filter((report) => !DONE.includes(report.status));
	const notApproved = new Set([...missing.map((item) => item.period), ...open.map((report) => report.label ?? report.period)]);
	const checks: { key: string; level: "ok" | "block" | "warn"; count?: number; total?: number; items?: string[] }[] = [
		milestones.length === 0
			? { key: "no_milestones", level: "warn" }
			: { key: done === milestones.length ? "milestones_done" : "milestones_open", level: done === milestones.length ? "ok" : "block", count: done, total: milestones.length },
		notApproved.size > 0
			? { key: "reports_open", level: "block", count: notApproved.size, items: [...notApproved].sort().slice(0, 5) }
			: { key: "reports_done", level: "ok" },
	];
	if (!reports.some((report) => report.type === "file" && DONE.includes(report.status))) checks.push({ key: "no_final_report", level: "warn" });
	return checks;
}

projectInsightRoutes.get("/projects/:id/completion", ...gate, async (c) => {
	const project = await loadVisible(c);
	if (!project) return jsonError(c, 404, "NOT_FOUND", NOT_FOUND);
	if (!canEdit(project, c.get("user").id, c.get("org").role)) return jsonError(c, 403, "FORBIDDEN", "You can't change this project.");
	return c.json({ checks: await completionChecks(c.get("db"), project, new Date().toISOString().slice(0, 10)) });
});

projectInsightRoutes.post("/projects/:id/complete", ...gate, async (c) => {
	const db = c.get("db");
	const project = await loadVisible(c);
	if (!project) return jsonError(c, 404, "NOT_FOUND", NOT_FOUND);
	if (!canEdit(project, c.get("user").id, c.get("org").role)) return jsonError(c, 403, "FORBIDDEN", "You can't change this project.");
	if (!["planned", "in_progress", "on_hold"].includes(project.status)) return jsonError(c, 409, "WRONG_STATUS", "This project can't be completed now.");
	const checks = await completionChecks(db, project, new Date().toISOString().slice(0, 10));
	if (checks.some((check) => check.level === "block")) return jsonError(c, 409, "BLOCKED", "Fix what's still open first.");
	const notes = cleanText((await readJson(c.req.raw)).notes, { multiline: true });
	if (notes.length > 2000) return jsonError(c, 400, "TOO_LONG", "Those notes are too long.");
	await db
		.update(projects)
		.set({ status: "completed", completedAt: new Date(), completedBy: c.get("user").id, completionNotes: notes || null })
		.where(eq(projects.id, project.id));
	await record(db, c, project.id, "completed", notes || null);
	return c.json({ ok: true });
});

projectInsightRoutes.post("/projects/:id/reopen", ...gate, requireRole("admin"), async (c) => {
	const db = c.get("db");
	const project = await loadVisible(c);
	if (!project) return jsonError(c, 404, "NOT_FOUND", NOT_FOUND);
	if (project.status !== "completed") return jsonError(c, 409, "WRONG_STATUS", "Only a completed project can be reopened.");
	await db.update(projects).set({ status: "in_progress", completedAt: null, completedBy: null, completionNotes: null }).where(eq(projects.id, project.id));
	await record(db, c, project.id, "reopened");
	return c.json({ ok: true });
});

// ---- Portfolio: only what this person could open themselves.

projectInsightRoutes.get("/projects/portfolio", ...gate, async (c) => {
	const db = c.get("db");
	const org = c.get("org");
	const userId = c.get("user").id;
	const today = new Date().toISOString().slice(0, 10);
	const [rows, mine, milestones, reports, people] = await Promise.all([
		db.select().from(projects).where(eq(projects.organizationId, org.organizationId)).orderBy(desc(projects.updatedAt)),
		db
			.select({ projectId: projectMembers.projectId })
			.from(projectMembers)
			.where(and(eq(projectMembers.organizationId, org.organizationId), eq(projectMembers.userId, userId))),
		db.select().from(projectMilestones).where(eq(projectMilestones.organizationId, org.organizationId)),
		db
			.select({
				projectId: projectReports.projectId,
				type: projectReports.type,
				period: projectReports.period,
				status: projectReports.status,
				budgetSpent: projectReports.budgetSpent,
				beneficiaries: projectReports.beneficiaries,
			})
			.from(projectReports)
			.where(eq(projectReports.organizationId, org.organizationId)),
		loadPeople(db, org.organizationId),
	]);
	const memberOf = new Set(mine.map((row) => row.projectId));
	const visible = rows.filter((project) => project.status !== "archived" && project.status !== "draft" && canSee(project, userId, org.role, memberOf.has(project.id)));
	const horizon = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
	const upcoming: { kind: string; title: string; projectId: number; projectName: string; date: string }[] = [];
	const list = visible.map((project) => {
		const own = milestones.filter((milestone) => milestone.projectId === project.id);
		const owned = reports.filter((report) => report.projectId === project.id);
		const forms = owned.filter((report) => report.type === "form" && DONE.includes(report.status));
		const submitted = new Set(owned.filter((report) => report.type === "form" && ["submitted", ...DONE].includes(report.status)).map((report) => report.period));
		const schedule = expectedPeriods(project, today, submitted);
		for (const milestone of own) {
			if (!milestone.completedAt && milestone.dueDate >= today && milestone.dueDate <= horizon) {
				upcoming.push({ kind: "milestone", title: milestone.title, projectId: project.id, projectName: project.name, date: milestone.dueDate });
			}
		}
		for (const item of schedule) {
			if (!submitted.has(item.period) && item.dueDate >= today && item.dueDate <= horizon) {
				upcoming.push({ kind: "report", title: item.period, projectId: project.id, projectName: project.name, date: item.dueDate });
			}
		}
		if (project.endDate && project.endDate >= today && project.endDate <= horizon && project.status === "in_progress") {
			upcoming.push({ kind: "end", title: project.name, projectId: project.id, projectName: project.name, date: project.endDate });
		}
		return {
			id: project.id,
			name: project.name,
			category: project.category,
			status: project.status,
			health: project.health,
			currency: project.budgetCurrency,
			budget: project.budgetAmount,
			spent: forms.some((report) => report.budgetSpent !== null) ? forms.reduce((total, report) => total + (report.budgetSpent ?? 0), 0) : null,
			milestonesDone: own.filter((milestone) => milestone.completedAt).length,
			milestonesTotal: own.length,
			reportsOverdue: schedule.filter((item) => item.overdue).length,
			reportsRequired: project.reportingFrequency === "monthly" || project.reportingFrequency === "quarterly",
			completedAt: project.completedAt,
			ownerName: people.find((person) => person.userId === project.ownerId)?.name ?? null,
		};
	});
	upcoming.sort((a, b) => a.date.localeCompare(b.date));
	return c.json({ projects: list, upcoming: upcoming.slice(0, 8) });
});

// ---- Dashboard: numbers are worked out here from the file's rows.

const MAX_CSV_BYTES = 2 * 1024 * 1024;
const MAX_ROWS = 2000;
const MAX_COLUMNS = 30;
const KINDS = ["kpi_total", "bar", "line", "donut", "kpi_growth"] as const;

function parseCsv(text: string) {
	const rows: string[][] = [];
	let row: string[] = [];
	let cell = "";
	let quoted = false;
	const source = text.replace(/^\uFEFF/, "");
	for (let index = 0; index < source.length; index++) {
		const char = source[index];
		if (quoted) {
			if (char === '"' && source[index + 1] === '"') {
				cell += '"';
				index++;
			} else if (char === '"') quoted = false;
			else cell += char;
		} else if (char === '"') quoted = true;
		else if (char === ",") {
			row.push(cell.trim());
			cell = "";
		} else if (char === "\n" || char === "\r") {
			if (char === "\r" && source[index + 1] === "\n") index++;
			row.push(cell.trim());
			cell = "";
			if (row.some((value) => value !== "")) rows.push(row);
			row = [];
		} else cell += char;
	}
	row.push(cell.trim());
	if (row.some((value) => value !== "")) rows.push(row);
	return rows;
}

function toNumber(value: string | undefined) {
	if (value === undefined || value === "") return null;
	const number = Number(value.replace(/,/g, ""));
	return Number.isFinite(number) ? number : null;
}

async function readTable(c: { env: Env }, db: Db, projectId: number, fileId: number, wanted?: number) {
	const [file] = await db
		.select()
		.from(projectFiles)
		.where(and(eq(projectFiles.id, fileId), eq(projectFiles.projectId, projectId)));
	if (!file || file.orgFileId) return { error: "NOT_FOUND" as const };
	const version = wanted ?? file.currentVersion;
	const [row] = await db
		.select()
		.from(projectFileVersions)
		.where(and(eq(projectFileVersions.fileId, file.id), eq(projectFileVersions.version, version)));
	if (!row) return { error: "NOT_FOUND" as const };
	if (row.mimeType !== "text/csv" && !row.name.toLowerCase().endsWith(".csv")) return { error: "NOT_CSV" as const };
	if (row.sizeBytes > MAX_CSV_BYTES) return { error: "TOO_BIG" as const };
	const object = await c.env.FILES.get(row.storageKey);
	if (!object) return { error: "NOT_FOUND" as const };
	const rows = parseCsv(await object.text());
	if (rows.length < 2) return { error: "NO_ROWS" as const };
	if (rows.length - 1 > MAX_ROWS || rows[0].length > MAX_COLUMNS) return { error: "TOO_BIG" as const };
	const columns = rows[0].map((name, index) => name || `Column ${index + 1}`);
	const body = rows.slice(1).map((cells) => columns.map((_, index) => cells[index] ?? ""));
	const numeric = columns.map((_, index) => body.every((cells) => cells[index] === "" || toNumber(cells[index]) !== null) && body.some((cells) => cells[index] !== ""));
	return { file, version, name: row.name, columns, rows: body, numeric };
}

projectInsightRoutes.get("/projects/:id/files/:fileId/table", ...gate, async (c) => {
	const db = c.get("db");
	const project = await loadVisible(c);
	if (!project) return jsonError(c, 404, "NOT_FOUND", NOT_FOUND);
	if (!canEdit(project, c.get("user").id, c.get("org").role)) return jsonError(c, 403, "FORBIDDEN", "You can't change this project.");
	const table = await readTable(c, db, project.id, Number(c.req.param("fileId")));
	if ("error" in table) return jsonError(c, table.error === "NOT_FOUND" ? 404 : 400, table.error ?? "NOT_FOUND", "That file can't be used.");
	const labelIndex = table.numeric.findIndex((value) => !value);
	const labels = table.rows.map((cells) => cells[labelIndex === -1 ? 0 : labelIndex]);
	const empties = table.rows.reduce((total, cells) => total + cells.filter((value) => value === "").length, 0);
	const totalIndex = table.columns.findIndex((name) => name.toLowerCase() === "total");
	const parts = table.numeric.flatMap((value, index) => (value && index !== totalIndex ? [index] : []));
	const badTotals =
		totalIndex >= 0 && table.numeric[totalIndex] && parts.length > 1
			? table.rows.filter((cells) => parts.reduce((total, index) => total + (toNumber(cells[index]) ?? 0), 0) !== toNumber(cells[totalIndex])).length
			: null;
	return c.json({
		name: table.name,
		version: table.version,
		columns: table.columns,
		rows: table.rows.slice(0, 50),
		rowCount: table.rows.length,
		numeric: table.numeric,
		checks: {
			duplicates: labels.length - new Set(labels).size,
			empties,
			badTotals,
			formulas: table.rows.some((cells) => cells.some((value) => value.startsWith("="))),
		},
	});
});

function buildSeries(kind: (typeof KINDS)[number], labels: string[], names: string[], rows: (number | null)[][]) {
	const totals = rows.map((cells) => cells.reduce<number>((total, value) => total + (value ?? 0), 0));
	const sum = totals.reduce((total, value) => total + value, 0);
	if (kind === "kpi_total") return { value: sum };
	if (kind === "kpi_growth") {
		if (totals.length < 2) return null;
		const [previous, latest] = totals.slice(-2);
		return { latest, previous, latestLabel: labels[labels.length - 1], previousLabel: labels[labels.length - 2], percent: previous ? Math.round(((latest - previous) / previous) * 100) : null };
	}
	if (kind === "donut") {
		if (names.length < 2) return null;
		const parts = names.map((name, index) => ({ label: name, value: rows.reduce((total, cells) => total + (cells[index] ?? 0), 0) }));
		// More than four slices can't be told apart, so the rest fold into one.
		return { parts: parts.length > 4 ? [...parts.slice(0, 3), { label: "Other", value: parts.slice(3).reduce((total, part) => total + part.value, 0) }] : parts };
	}
	return { points: labels.map((label, index) => ({ label, value: totals[index] })).slice(0, 36) };
}

projectInsightRoutes.get("/projects/:id/widgets", ...gate, async (c) => {
	const db = c.get("db");
	const project = await loadVisible(c);
	if (!project) return jsonError(c, 404, "NOT_FOUND", NOT_FOUND);
	const [widgets, people] = await Promise.all([
		db
			.select({
				id: projectWidgets.id,
				kind: projectWidgets.kind,
				title: projectWidgets.title,
				series: projectWidgets.series,
				fileId: projectWidgets.fileId,
				fileVersion: projectWidgets.fileVersion,
				fileName: projectWidgets.fileName,
				checkedBy: projectWidgets.checkedBy,
				createdAt: projectWidgets.createdAt,
				currentVersion: projectFiles.currentVersion,
			})
			.from(projectWidgets)
			.leftJoin(projectFiles, eq(projectWidgets.fileId, projectFiles.id))
			.where(eq(projectWidgets.projectId, project.id))
			.orderBy(projectWidgets.id),
		loadPeople(db, project.organizationId),
	]);
	return c.json({
		widgets: widgets.map((widget) => ({
			...widget,
			series: JSON.parse(widget.series) as unknown,
			checkedByName: people.find((person) => person.userId === widget.checkedBy)?.name ?? null,
			stale: widget.currentVersion !== null && widget.currentVersion !== widget.fileVersion,
		})),
		canManage: canEdit(project, c.get("user").id, c.get("org").role),
	});
});

// A published widget keeps its numbers until someone publishes again from a newer
// version, so a dashboard never changes without anyone having checked the file.
projectInsightRoutes.post("/projects/:id/widgets", ...gate, async (c) => {
	const db = c.get("db");
	const project = await loadVisible(c);
	if (!project) return jsonError(c, 404, "NOT_FOUND", NOT_FOUND);
	const userId = c.get("user").id;
	if (!canEdit(project, userId, c.get("org").role)) return jsonError(c, 403, "FORBIDDEN", "You can't change this project.");
	const body = await readJson(c.req.raw);
	const table = await readTable(c, db, project.id, Number(body.fileId));
	if ("error" in table) return jsonError(c, table.error === "NOT_FOUND" ? 404 : 400, table.error ?? "NOT_FOUND", "That file can't be used.");
	const labelColumn = Number(body.labelColumn);
	const valueColumns = Array.isArray(body.valueColumns) ? [...new Set(body.valueColumns.map(Number))] : [];
	const kinds = Array.isArray(body.kinds) ? body.kinds.filter((kind): kind is (typeof KINDS)[number] => KINDS.includes(kind)) : [];
	if (
		!Number.isInteger(labelColumn) ||
		labelColumn < 0 ||
		labelColumn >= table.columns.length ||
		valueColumns.length === 0 ||
		kinds.length === 0 ||
		valueColumns.some((index) => !table.numeric[index] || index === labelColumn)
	) {
		return jsonError(c, 400, "INVALID_WIDGETS", "Choose a label column, number columns and at least one widget.");
	}
	const labels = table.rows.map((cells) => cells[labelColumn]);
	const names = valueColumns.map((index) => table.columns[index]);
	const values = table.rows.map((cells) => valueColumns.map((index) => toNumber(cells[index])));
	const values_ = kinds.flatMap((kind) => {
		const series = buildSeries(kind, labels, names, values);
		return series
			? [{
					projectId: project.id,
					organizationId: project.organizationId,
					fileId: table.file.id,
					fileVersion: table.version,
					fileName: table.name,
					kind,
					title: cleanText(body.title).slice(0, 120) || names.join(" + "),
					series: JSON.stringify(series),
					checkedBy: userId,
				}]
			: [];
	});
	if (values_.length === 0) return jsonError(c, 400, "INVALID_WIDGETS", "Those widgets need more rows or columns.");
	// Publishing again from this file replaces what it showed before.
	await db.delete(projectWidgets).where(and(eq(projectWidgets.projectId, project.id), inArray(projectWidgets.fileId, [table.file.id])));
	await db.insert(projectWidgets).values(values_);
	await record(db, c, project.id, "widgets_published", `${table.name} v${table.version}`);
	return c.json({ published: values_.length }, 201);
});

projectInsightRoutes.delete("/projects/:id/widgets/:widgetId", ...gate, async (c) => {
	const db = c.get("db");
	const project = await loadVisible(c);
	if (!project) return jsonError(c, 404, "NOT_FOUND", NOT_FOUND);
	if (!canEdit(project, c.get("user").id, c.get("org").role)) return jsonError(c, 403, "FORBIDDEN", "You can't change this project.");
	await db.delete(projectWidgets).where(and(eq(projectWidgets.id, Number(c.req.param("widgetId"))), eq(projectWidgets.projectId, project.id)));
	return c.json({ ok: true });
});
