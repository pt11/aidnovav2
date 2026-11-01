import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Download, FolderKanban } from "lucide-react";
import { Link } from "wouter";
import { api } from "../api";
import { downloadCsv } from "../csv";
import { useI18n } from "../i18n";
import { DataTable, FilterSelect, PageError, PageHeader, PageLoading, buttonClass, StatePanel } from "../ui";
import { PROJECT_CATEGORIES, ProjectHealthChip, ProjectStatusChip, shortDay, type ProjectHealth, type ProjectStatus } from "./Projects";
import { periodLabel } from "./ProjectReports";

interface Row {
	id: number;
	name: string;
	category: string | null;
	status: ProjectStatus;
	health: ProjectHealth;
	currency: string;
	budget: number | null;
	spent: number | null;
	milestonesDone: number;
	milestonesTotal: number;
	reportsOverdue: number;
	reportsRequired: boolean;
	completedAt: string | null;
}

interface Upcoming {
	kind: "milestone" | "report" | "end";
	title: string;
	projectId: number;
	projectName: string;
	date: string;
}

const HEALTH_FILL: Record<ProjectHealth, string> = {
	healthy: "bg-[#22A076]",
	needs_attention: "bg-[#F59F0A]",
	at_risk: "bg-destructive",
	unknown: "bg-muted-foreground",
};
// Spending this far ahead of finished milestones is worth a second look.
const AHEAD_POINTS = 25;

function Tile({ label, value, note, danger = false }: { label: string; value: string | number; note: string; danger?: boolean }) {
	return (
		<div className="rounded-card border border-border bg-card p-4">
			<dt className="text-[13px] text-muted-foreground">{label}</dt>
			<dd className={`mt-1 break-words text-2xl font-semibold tracking-tight ${danger ? "text-danger-foreground" : ""}`}>{value}</dd>
			<dd className="mt-0.5 break-words text-xs text-muted-foreground">{note}</dd>
		</div>
	);
}

function Meter({ label, percent, tone }: { label: string; percent: number; tone: string }) {
	return (
		<div>
			<p className="text-xs text-muted-foreground">{label}</p>
			<div role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label={label} className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-input">
				<div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.min(100, percent)}%` }} />
			</div>
		</div>
	);
}

export function ProjectPortfolioPage() {
	const { t, language } = useI18n();
	const [category, setCategory] = useState("all");
	const [year] = useState(() => String(new Date().getFullYear()));
	const portfolio = useQuery({
		queryKey: ["projects-portfolio"],
		queryFn: () => api<{ projects: Row[]; upcoming: Upcoming[] }>("/projects/portfolio"),
	});
	if (portfolio.isPending) return <PageLoading variant="dashboard" />;
	if (portfolio.isError) return <PageError onRetry={() => portfolio.refetch()} />;
	const rows = portfolio.data.projects.filter((project) => category === "all" || project.category === category);
	const active = rows.filter((project) => ["planned", "in_progress", "on_hold"].includes(project.status));
	const atRisk = active.filter((project) => project.health === "at_risk");
	const completed = rows.filter((project) => project.completedAt?.startsWith(year));
	const overdueProjects = rows.filter((project) => project.reportsOverdue > 0);
	const overdue = overdueProjects.reduce((total, project) => total + project.reportsOverdue, 0);
	const currencies = [...new Set(rows.filter((project) => project.budget !== null).map((project) => project.currency))];
	const money = (value: number, currency: string) =>
		new Intl.NumberFormat(language === "my" ? "en" : language, { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
	const percentDone = (project: Row) => (project.milestonesTotal ? Math.round((project.milestonesDone / project.milestonesTotal) * 100) : 0);
	const percentSpent = (project: Row) => (project.budget && project.spent !== null ? Math.round((project.spent / project.budget) * 100) : 0);
	const isAhead = (project: Row) => project.spent !== null && !!project.budget && percentSpent(project) - percentDone(project) >= AHEAD_POINTS;
	const statusCount = (status: ProjectStatus) => active.filter((project) => project.status === status).length;
	const programs = PROJECT_CATEGORIES.map((key) => ({ key, projects: active.filter((project) => project.category === key) })).filter((group) => group.projects.length > 0);
	const uncategorized = active.filter((project) => !project.category);
	function exportCsv() {
		downloadCsv("portfolio.csv", [
			[t("nav.projects"), t("pr.field_category"), t("users.status"), t("pr.health"), t("pr.milestones_complete"), t("pr.spent"), t("pr.field_budget"), t("pr.field_currency"), t("pr.overdue_reports")],
			...rows.map((project) => [
				project.name,
				project.category ? t(`pr.cat_${project.category}`) : "",
				t(`pr.status_${project.status}`),
				t(`pr.health_${project.health}`),
				`${project.milestonesDone}/${project.milestonesTotal}`,
				project.spent === null ? "" : String(project.spent),
				project.budget === null ? "" : String(project.budget),
				project.currency,
				String(project.reportsOverdue),
			]),
		]);
	}
	const upcomingText = (item: Upcoming) =>
		item.kind === "report" ? t("pr.upcoming_report", { period: periodLabel(item.title, language), project: item.projectName }) : item.kind === "end" ? t("pr.upcoming_end", { project: item.projectName }) : `${item.title} · ${item.projectName}`;

	return (
		<div className="flex flex-col gap-4 p-4 md:px-6 md:py-7">
			<nav aria-label={t("people.breadcrumb")} className="text-[13px] text-muted-foreground">
				<Link href="/projects" className="no-underline hover:underline">{t("nav.projects")}</Link> / <span>{t("pr.portfolio")}</span>
			</nav>
			<PageHeader
				title={t("pr.portfolio_title")}
				subtitle={t("pr.portfolio_desc")}
				action={
					<div className="flex flex-wrap items-center gap-2">
						<FilterSelect label={t("pr.field_category")} value={category} onChange={setCategory}>
							<option value="all">{t("cb.filter_all")}</option>
							{PROJECT_CATEGORIES.map((value) => <option key={value} value={value}>{t(`pr.cat_${value}`)}</option>)}
						</FilterSelect>
						<button type="button" disabled={rows.length === 0} className={buttonClass("outline")} onClick={exportCsv}>
							<Download size={15} aria-hidden="true" />
							{t("policies.export")}
						</button>
					</div>
				}
			/>
			{portfolio.data.projects.length === 0 ? (
				<StatePanel icon={FolderKanban} title={t("pr.portfolio_empty")} description={t("pr.portfolio_empty_desc")} />
			) : (
				<>
					<dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
						<Tile label={t("pr.tile_active")} value={active.length} note={t("pr.tile_active_note", { progress: statusCount("in_progress"), planned: statusCount("planned"), hold: statusCount("on_hold") })} />
						<Tile label={t("pr.tile_risk")} value={atRisk.length} note={atRisk.map((project) => project.name).join(", ") || t("pr.none_at_risk")} danger={atRisk.length > 0} />
						<Tile label={t("pr.tile_completed")} value={completed.length} note={t("pr.tile_completed_note")} />
						<Tile label={t("pr.overdue_reports")} value={overdue} note={t("pr.tile_overdue_note", { count: overdueProjects.length })} danger={overdue > 0} />
						{currencies.map((currency) => {
							const own = rows.filter((project) => project.currency === currency && project.budget !== null);
							return (
								<Tile
									key={currency}
									label={t("pr.tile_spent", { currency })}
									value={money(own.reduce((total, project) => total + (project.spent ?? 0), 0), currency)}
									note={t("pr.tile_spent_note", { budget: money(own.reduce((total, project) => total + (project.budget ?? 0), 0), currency), count: own.length })}
								/>
							);
						})}
					</dl>
					{currencies.length > 1 && <p className="text-[13px] text-muted-foreground">{t("pr.currencies_note")}</p>}
					<div className="grid items-start gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
						<section className="min-w-0 rounded-card border border-border bg-card">
							<div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
								<h2 className="text-[15px] font-semibold">{t("nav.projects")}</h2>
								<span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
									<AlertTriangle size={13} aria-hidden="true" className="text-danger-foreground" />
									{t("pr.ahead_legend")}
								</span>
							</div>
							<DataTable bare minWidth={660} head={[t("nav.projects"), t("users.status"), t("pr.health"), t("pr.col_progress"), t("pr.spent"), t("pr.col_reports")]}>
								{rows.map((project) => (
									<tr key={project.id}>
										<td className="px-3 py-3 first:pl-4">
											<Link href={`/projects/${project.id}`} className="block break-words font-semibold text-foreground no-underline hover:underline">{project.name}</Link>
											<span className="text-xs text-muted-foreground">{project.category ? t(`pr.cat_${project.category}`) : "—"}</span>
										</td>
										<td className="px-3 py-3"><ProjectStatusChip status={project.status} /></td>
										<td className="px-3 py-3"><ProjectHealthChip health={project.health} /></td>
										<td className="w-36 px-3 py-3">
											<div className="flex flex-col gap-1.5">
												<Meter label={t("pr.meter_milestones", { percent: percentDone(project) })} percent={percentDone(project)} tone="bg-primary" />
												{project.spent !== null && project.budget ? <Meter label={t("pr.meter_spent", { percent: percentSpent(project) })} percent={percentSpent(project)} tone="bg-accent" /> : null}
											</div>
											{isAhead(project) && (
												<span className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-danger-foreground">
													<AlertTriangle size={12} aria-hidden="true" />
													{t("pr.ahead_flag")}
												</span>
											)}
										</td>
										<td className="px-3 py-3">
											{project.spent !== null ? <span className="block font-semibold">{money(project.spent, project.currency)}</span> : <span className="block">—</span>}
											{project.budget !== null && <span className="block text-xs text-muted-foreground">{t("pr.of_budget", { budget: money(project.budget, project.currency) })}</span>}
										</td>
										<td className="px-3 py-3 last:pr-4">
											{project.reportsOverdue > 0 ? (
												<span className="font-semibold text-danger-foreground">{t("pr.count_overdue", { count: project.reportsOverdue })}</span>
											) : project.reportsRequired ? (
												<span className="text-muted-foreground">{t("pr.on_track")}</span>
											) : (
												"—"
											)}
										</td>
									</tr>
								))}
							</DataTable>
						</section>
						<div className="flex min-w-0 flex-col gap-4">
							<section className="rounded-card border border-border bg-card p-4">
								<h2 className="mb-2.5 text-[15px] font-semibold">{t("pr.health_by_program")}</h2>
								{active.length === 0 ? (
									<p className="text-[13px] text-muted-foreground">{t("pr.no_active")}</p>
								) : (
									<>
										<ul className="flex flex-col gap-2 text-[13px]">
											{[...programs, ...(uncategorized.length ? [{ key: "other", projects: uncategorized }] : [])].map((group) => (
												<li key={group.key} className="flex items-center gap-2">
													<span className="w-24 shrink-0 break-words">{t(`pr.cat_${group.key}`)}</span>
													<span className="flex flex-wrap gap-0.5">
														{group.projects.map((project) => (
															<span key={project.id} title={`${project.name}: ${t(`pr.health_${project.health}`)}`} className={`h-3.5 w-6 rounded-sm ${HEALTH_FILL[project.health]}`}>
																<span className="sr-only">{`${project.name}: ${t(`pr.health_${project.health}`)}`}</span>
															</span>
														))}
													</span>
												</li>
											))}
										</ul>
										<ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
											{(["healthy", "needs_attention", "at_risk", "unknown"] as const).map((health) => (
												<li key={health} className="flex items-center gap-1.5">
													<span aria-hidden="true" className={`size-2.5 rounded-sm ${HEALTH_FILL[health]}`} />
													{t(`pr.health_${health}`)}
												</li>
											))}
										</ul>
									</>
								)}
							</section>
							<section className="rounded-card border border-border bg-card p-4">
								<h2 className="mb-2.5 text-[15px] font-semibold">{t("pr.next_30")}</h2>
								{portfolio.data.upcoming.length === 0 ? (
									<p className="text-[13px] text-muted-foreground">{t("pr.next_30_empty")}</p>
								) : (
									<ul className="flex flex-col gap-2 text-[13px]">
										{portfolio.data.upcoming.map((item) => (
											<li key={`${item.kind}-${item.projectId}-${item.title}-${item.date}`} className="flex items-start justify-between gap-3">
												<Link href={`/projects/${item.projectId}`} className="min-w-0 break-words text-foreground no-underline hover:underline">{upcomingText(item)}</Link>
												<span className="shrink-0 text-muted-foreground">{shortDay(item.date, language)}</span>
											</li>
										))}
									</ul>
								)}
							</section>
						</div>
					</div>
					<p className="text-xs text-muted-foreground">{t("pr.portfolio_note")}</p>
				</>
			)}
		</div>
	);
}
