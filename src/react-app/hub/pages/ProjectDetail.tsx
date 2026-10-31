import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Plus, SearchX, Trash2 } from "lucide-react";
import { Link } from "wouter";
import { ProjectDashboardTab } from "./ProjectDashboard";
import { FileBadge, ProjectFilesTab, useProjectFiles } from "./ProjectFiles";
import { periodLabel, ProjectReportsTab, ReportChip, useProjectReports } from "./ProjectReports";
import { api, ApiError } from "../api";
import { useI18n } from "../i18n";
import {
	Alert,
	Avatar,
	buttonClass,
	Field,
	Modal,
	PageError,
	PageLoading,
	Segmented,
	SelectField,
	StatePanel,
	TextareaField,
} from "../ui";
import {
	PROJECT_CATEGORIES,
	PROJECT_HEALTHS,
	PROJECT_STATUSES,
	PROJECTS_KEY,
	projectBody,
	ProjectHealthChip,
	ProjectStatusChip,
	ProgressTrack,
	shortDay,
	type ProjectHealth,
	type ProjectStatus,
} from "./Projects";

interface Milestone {
	id: number;
	title: string;
	dueDate: string;
	completedAt: string | null;
}

interface ProjectData {
	project: {
		id: number;
		name: string;
		code: string;
		category: string | null;
		description: string | null;
		priority: string;
		status: ProjectStatus;
		health: ProjectHealth;
		healthReason: string | null;
		healthSetByName: string | null;
		healthSetAt: string | null;
		objectives: string | null;
		expectedOutcomes: string | null;
		startDate: string | null;
		endDate: string | null;
		ownerId: string | null;
		managerId: string | null;
		ownerName: string | null;
		managerName: string | null;
		visibility: string;
		funder: string | null;
		budgetCurrency: string;
		budgetAmount: number | null;
		beneficiaryTarget: number | null;
		locations: string | null;
		sdg: number | null;
		reportingFrequency: string | null;
		completedAt: string | null;
		completedByName: string | null;
		completionNotes: string | null;
	};
	canEdit: boolean;
	isAdmin: boolean;
	milestones: Milestone[];
	members: { userId: string; role: string; name: string }[];
	activity: { id: number; kind: string; detail: string | null; createdAt: string; actorName: string | null }[];
}

const TABS = ["overview", "dashboard", "files", "reports", "team", "activity", "settings"] as const;
type Tab = (typeof TABS)[number];
const SAVE_ERRORS: Record<string, string> = {
	CODE_TAKEN: "pr.code_taken",
	INVALID_CODE: "pr.code_invalid",
	INVALID_NAME: "pr.name_required",
	END_BEFORE_START: "pr.end_before_start",
	INVALID_NUMBER: "pr.invalid_number",
	TOO_LONG: "pr.too_long",
};

function useRefresh(id: string) {
	const queryClient = useQueryClient();
	return () =>
		Promise.all([
			queryClient.invalidateQueries({ queryKey: ["project", id] }),
			queryClient.invalidateQueries({ queryKey: PROJECTS_KEY }),
		]);
}

function today() {
	return new Date().toISOString().slice(0, 10);
}

function Tile({ label, chip, value, detail, source, children }: { label: string; chip: string; value: string; detail: string; source: string; children?: React.ReactNode }) {
	return (
		<div className="flex flex-col gap-1.5 rounded-card border border-border bg-card p-4">
			<div className="flex items-start justify-between gap-2">
				<span className="text-[13px] text-muted-foreground">{label}</span>
				<span className="whitespace-nowrap rounded-full border border-input px-2 text-[11px] font-semibold">{chip}</span>
			</div>
			<p className="break-words text-2xl font-semibold tracking-tight">{value}</p>
			<p className="text-[13px]">{detail}</p>
			{children}
			<p className="mt-auto pt-1 text-xs text-muted-foreground">{source}</p>
		</div>
	);
}

function HealthDialog({ data, onClose }: { data: ProjectData; onClose: () => void }) {
	const { t } = useI18n();
	const refresh = useRefresh(String(data.project.id));
	const [health, setHealth] = useState<ProjectHealth>(data.project.health);
	const [reason, setReason] = useState(data.project.healthReason ?? "");
	const needsReason = health === "needs_attention" || health === "at_risk";
	const save = useMutation({
		mutationFn: () => api(`/projects/${data.project.id}/health`, { method: "POST", body: { health, reason } }),
		onSuccess: async () => {
			await refresh();
			onClose();
		},
	});
	return (
		<Modal title={t("pr.set_health")} description={t("pr.set_health_desc")} open onClose={onClose}>
			<div className="flex flex-col gap-3.5">
				{save.isError && <Alert>{t("error.generic")}</Alert>}
				<SelectField label={t("pr.health")} value={health} onChange={(event) => setHealth(event.target.value as ProjectHealth)}>
					{PROJECT_HEALTHS.map((value) => <option key={value} value={value}>{t(`pr.health_${value}`)}</option>)}
				</SelectField>
				<Field label={t("pr.health_reason")} hint={needsReason ? t("cb.comment_required") : t("cb.optional")} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} />
				<div className="flex justify-end gap-2">
					<button type="button" className={buttonClass("outline")} onClick={onClose}>{t("common.cancel")}</button>
					<button type="button" disabled={save.isPending || (needsReason && !reason.trim())} className={buttonClass()} onClick={() => save.mutate()}>{t("common.save")}</button>
				</div>
			</div>
		</Modal>
	);
}

function MilestonesCard({ data }: { data: ProjectData }) {
	const { t, language } = useI18n();
	const refresh = useRefresh(String(data.project.id));
	const [adding, setAdding] = useState(false);
	const [title, setTitle] = useState("");
	const [dueDate, setDueDate] = useState("");
	const base = `/projects/${data.project.id}/milestones`;
	const add = useMutation({
		mutationFn: () => api(base, { method: "POST", body: { title, dueDate } }),
		onSuccess: async () => {
			setTitle("");
			setDueDate("");
			setAdding(false);
			await refresh();
		},
	});
	const toggle = useMutation({
		mutationFn: (milestone: Milestone) => api(`${base}/${milestone.id}`, { method: "PATCH", body: { completed: !milestone.completedAt } }),
		onSuccess: refresh,
	});
	const remove = useMutation({
		mutationFn: (id: number) => api(`${base}/${id}`, { method: "DELETE" }),
		onSuccess: refresh,
	});
	const now = today();
	const dates = data.milestones.map((milestone) => milestone.dueDate);
	const from = data.project.startDate ?? dates[0];
	const to = data.project.endDate ?? dates[dates.length - 1];
	const at = (date: string) => {
		const start = new Date(from).getTime();
		const span = new Date(to).getTime() - start;
		return span > 0 ? Math.min(100, Math.max(0, ((new Date(date).getTime() - start) / span) * 100)) : 0;
	};
	function submit(event: FormEvent) {
		event.preventDefault();
		add.mutate();
	}
	return (
		<section className="rounded-card border border-border bg-card p-4 md:p-5">
			<div className="flex items-center justify-between gap-2">
				<h2 className="text-base font-semibold">{t("pr.milestones")}</h2>
				{data.canEdit && (
					<button type="button" className={buttonClass("outline", "min-h-8 px-3 py-0")} onClick={() => setAdding((value) => !value)}>
						<Plus size={15} aria-hidden="true" />
						{t("pr.add_milestone")}
					</button>
				)}
			</div>
			{from && to && data.milestones.length > 0 && (
				<div className="mt-5 px-1" aria-hidden="true">
					<div className="relative h-1.5 rounded-full bg-input">
						{now >= from && now <= to && (
							<span className="absolute -top-2 h-5 w-0.5 bg-foreground" style={{ left: `${at(now)}%` }}>
								<span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[11px] font-semibold">{t("calendar.today")}</span>
							</span>
						)}
						{data.milestones.map((milestone) => (
							<span
								key={milestone.id}
								className={`absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-card ${
									milestone.completedAt ? "bg-[#22A076]" : milestone.dueDate < now ? "bg-destructive" : "border border-input bg-card"
								}`}
								style={{ left: `${at(milestone.dueDate)}%` }}
							/>
						))}
					</div>
					<p className="mt-2 flex justify-between text-xs text-muted-foreground">
						<span>{shortDay(from, language)}</span>
						<span>{shortDay(to, language)}</span>
					</p>
				</div>
			)}
			{adding && (
				<form onSubmit={submit} className="mt-3 flex flex-wrap items-end gap-2 rounded-[9px] border border-border p-3">
					<div className="min-w-48 flex-1"><Field label={t("pr.milestone_title")} required maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} /></div>
					<div className="w-44"><Field label={t("pr.milestone_due")} type="date" required value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></div>
					<button type="submit" disabled={add.isPending} className={buttonClass()}>{t("common.save")}</button>
				</form>
			)}
			{data.milestones.length === 0 ? (
				<p className="mt-3 text-sm text-muted-foreground">{t("pr.no_milestones")}</p>
			) : (
				<ul className="mt-3 flex flex-col">
					{data.milestones.map((milestone) => {
						const overdue = !milestone.completedAt && milestone.dueDate < now;
						return (
							<li key={milestone.id} className="flex items-center gap-2.5 border-t border-border py-2.5 first:border-t-0">
								<button
									type="button"
									disabled={!data.canEdit || toggle.isPending}
									aria-pressed={!!milestone.completedAt}
									aria-label={t(milestone.completedAt ? "pr.milestone_reopen" : "pr.milestone_done", { title: milestone.title })}
									className={`grid size-5 shrink-0 place-items-center rounded-full border-2 ${
										milestone.completedAt ? "border-[#14795A] bg-[#14795A] text-white" : overdue ? "border-destructive" : "border-input"
									}`}
									onClick={() => toggle.mutate(milestone)}
								>
									{milestone.completedAt && <Check size={12} strokeWidth={3} aria-hidden="true" />}
								</button>
								<span className="min-w-0 flex-1 break-words text-sm">{milestone.title}</span>
								<span className={`whitespace-nowrap text-[13px] ${overdue ? "font-semibold text-danger-foreground" : "text-muted-foreground"}`}>
									{shortDay(milestone.dueDate, language)}
									{overdue && ` · ${t("pr.overdue")}`}
								</span>
								{data.canEdit && (
									<button
										type="button"
										aria-label={t("cb.remove_file", { name: milestone.title })}
										className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted"
										onClick={() => remove.mutate(milestone.id)}
									>
										<Trash2 size={14} aria-hidden="true" />
									</button>
								)}
							</li>
						);
					})}
				</ul>
			)}
		</section>
	);
}

function Lines({ title, text }: { title: string; text: string | null }) {
	if (!text) return null;
	return (
		<section className="rounded-card border border-border bg-card p-4 md:p-5">
			<h2 className="mb-2 text-base font-semibold">{title}</h2>
			<ul className="list-disc pl-5 text-sm leading-6">
				{text.split("\n").filter((line) => line.trim()).map((line, index) => <li key={index} className="break-words">{line}</li>)}
			</ul>
		</section>
	);
}

function activityText(item: ProjectData["activity"][number], t: ReturnType<typeof useI18n>["t"]) {
	const name = item.actorName ?? "—";
	if (item.kind === "health" && item.detail) {
		const { health, reason } = JSON.parse(item.detail) as { health: string; reason: string };
		return `${t("pr.activity_health", { name, health: t(`pr.health_${health}`) })}${reason ? ` · “${reason}”` : ""}`;
	}
	if (item.kind === "status" && item.detail) return t("pr.activity_status", { name, status: t(`pr.status_${item.detail}`) });
	return t(`pr.activity_${item.kind}`, { name, detail: item.detail ?? "" });
}

function ActivityList({ data, limit }: { data: ProjectData; limit?: number }) {
	const { t, language } = useI18n();
	const items = limit ? data.activity.slice(0, limit) : data.activity;
	return (
		<ul className="flex flex-col gap-3 text-[13px]">
			{items.map((item) => (
				<li key={item.id} className="flex items-start gap-2.5">
					<Avatar name={item.actorName ?? "?"} size={28} />
					<span className="min-w-0 flex-1 break-words">
						{activityText(item, t)}
						<span className="block text-xs text-muted-foreground">
							{new Date(item.createdAt).toLocaleDateString(language, { day: "numeric", month: "short", year: "numeric" })}
						</span>
					</span>
				</li>
			))}
		</ul>
	);
}

function OverviewTab({ data, onHealth, onTeam, onFiles, onReports }: { data: ProjectData; onHealth: () => void; onTeam: () => void; onFiles: () => void; onReports: () => void }) {
	const { t, language } = useI18n();
	const { project, milestones } = data;
	const reporting = useProjectReports(project.id);
	const files = useProjectFiles(project.id);
	const reports = reporting.data?.reports ?? [];
	const schedule = reporting.data?.schedule ?? [];
	// Only approved reports feed these numbers. Everything else is still a draft.
	const approved = reports.filter((report) => report.status === "approved" || report.status === "locked");
	const forms = approved.filter((report) => report.type === "form");
	const reached = forms.reduce((total, report) => total + (report.beneficiaries ?? 0), 0);
	const spent = forms.reduce((total, report) => total + (report.budgetSpent ?? 0), 0);
	const hasSpend = forms.some((report) => report.budgetSpent !== null);
	const hasReach = forms.some((report) => report.beneficiaries !== null);
	const overdueReports = schedule.filter((item) => item.overdue && !reports.some((report) => report.type === "form" && report.period === item.period && ["submitted", "approved", "locked"].includes(report.status)));
	const required = new Set([...schedule.map((item) => item.period), ...reports.filter((report) => report.type === "form").map((report) => report.period)]).size;
	const returned = reports.filter((report) => report.status === "needs_revision");
	const money = (value: number) =>
		new Intl.NumberFormat(language === "my" ? "en" : language, { style: "currency", currency: project.budgetCurrency, maximumFractionDigits: 0 }).format(value);
	const done = milestones.filter((milestone) => milestone.completedAt).length;
	const percent = milestones.length ? Math.round((done / milestones.length) * 100) : 0;
	const now = today();
	const overdue = milestones.filter((milestone) => !milestone.completedAt && milestone.dueDate < now);
	const budget = project.budgetAmount !== null ? money(project.budgetAmount) : "—";
	const attention = project.health === "needs_attention" || project.health === "at_risk" || overdue.length > 0 || overdueReports.length > 0 || returned.length > 0;
	return (
		<div className="flex flex-col gap-4">
			<dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
				<Tile
					label={t("pr.tile_operational")}
					chip={t("pr.chip_tracked")}
					value={milestones.length ? t("pr.of", { done, total: milestones.length }) : "—"}
					detail={t("pr.milestones_complete")}
					source={t("pr.source_milestones")}
				>
					<ProgressTrack percent={percent} label={t("pr.tile_operational")} />
				</Tile>
				<Tile
					label={t("pr.tile_financial")}
					chip={t(hasSpend ? "pr.chip_reported" : "pr.chip_planned")}
					value={hasSpend ? money(spent) : budget}
					detail={
						hasSpend && project.budgetAmount !== null
							? t("pr.spent_of", { budget, left: money(Math.max(0, project.budgetAmount - spent)) })
							: (project.funder ?? t("pr.no_funder"))
					}
					source={t(hasSpend ? "pr.source_approved" : "pr.source_budget")}
				>
					{hasSpend && project.budgetAmount ? <ProgressTrack percent={Math.min(100, Math.round((spent / project.budgetAmount) * 100))} label={t("pr.tile_financial")} /> : null}
				</Tile>
				<Tile
					label={t("pr.tile_impact")}
					chip={t(hasReach ? "pr.chip_reported" : "pr.chip_planned")}
					value={hasReach ? reached.toLocaleString("en") : project.beneficiaryTarget !== null ? project.beneficiaryTarget.toLocaleString("en") : "—"}
					detail={hasReach && project.beneficiaryTarget !== null ? t("pr.reached_of", { target: project.beneficiaryTarget.toLocaleString("en") }) : t("pr.people_target")}
					source={t(hasReach ? "pr.source_approved" : "pr.source_impact")}
				>
					{hasReach && project.beneficiaryTarget ? <ProgressTrack percent={Math.min(100, Math.round((reached / project.beneficiaryTarget) * 100))} label={t("pr.tile_impact")} /> : null}
				</Tile>
				<Tile
					label={t("pr.tile_reporting")}
					chip={t("pr.chip_tracked")}
					value={required ? t("pr.of", { done: forms.length, total: required }) : "—"}
					detail={overdueReports.length ? t("pr.reports_overdue", { count: overdueReports.length }) : t("pr.reports_approved")}
					source={t("pr.source_register")}
				/>
			</dl>
			<div className="grid items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
				<div className="flex min-w-0 flex-col gap-4">
					{attention && (
						<section className="rounded-card border border-border border-l-4 border-l-[#F59F0A] bg-card p-4 md:p-5">
							<div className="flex flex-wrap items-baseline justify-between gap-2">
								<h2 className="text-base font-semibold">{t("dashboard.attention")}</h2>
								{project.healthSetByName && project.healthSetAt && (
									<span className="text-xs text-muted-foreground">
										{t("pr.health_set_by", { name: project.healthSetByName, date: new Date(project.healthSetAt).toLocaleDateString(language, { day: "numeric", month: "short" }) })}
									</span>
								)}
							</div>
							<ul className="mt-2 list-disc pl-5 text-sm leading-6">
								{project.healthReason && (project.health === "needs_attention" || project.health === "at_risk") && <li className="break-words">{project.healthReason}</li>}
								{overdueReports.slice(0, 3).map((item) => (
									<li key={item.period} className="break-words">
										{t("pr.report_overdue_line", { period: periodLabel(item.period, language), date: shortDay(item.dueDate, language) })}{" "}
										<button type="button" className="font-medium text-selected-foreground" onClick={onReports}>{t("cb.open")}</button>
									</li>
								))}
								{overdueReports.length > 3 && (
									<li>
										<button type="button" className="font-medium text-selected-foreground" onClick={onReports}>
											{t("pr.more_overdue", { count: overdueReports.length - 3 })}
										</button>
									</li>
								)}
								{returned.map((report) => (
									<li key={report.id} className="break-words">{t("pr.report_returned_line", { period: report.label ?? periodLabel(report.period, language) })}</li>
								))}
								{overdue.map((milestone) => (
									<li key={milestone.id} className="break-words">
										{t("pr.milestone_overdue", { title: milestone.title, date: shortDay(milestone.dueDate, language) })}
									</li>
								))}
							</ul>
						</section>
					)}
					<MilestonesCard data={data} />
					<Lines title={t("pr.objectives")} text={project.objectives} />
					<Lines title={t("pr.outcomes")} text={project.expectedOutcomes} />
				</div>
				<div className="flex min-w-0 flex-col gap-4">
					<section className="rounded-card border border-border bg-card p-4">
						<div className="mb-2 flex items-center justify-between gap-2">
							<h2 className="text-[15px] font-semibold">{t("pr.health")}</h2>
							{data.canEdit && (
								<button type="button" className="text-[13px] font-medium text-selected-foreground" onClick={onHealth}>{t("pr.set_health")}</button>
							)}
						</div>
						<ProjectHealthChip health={project.health} />
					</section>
					<section className="rounded-card border border-border bg-card p-4">
						<div className="mb-2 flex items-center justify-between gap-2">
							<h2 className="text-[15px] font-semibold">{t("pr.reports_due")}</h2>
							<button type="button" className="text-[13px] font-medium text-selected-foreground" onClick={onReports}>{t("pr.all_reports")}</button>
						</div>
						{schedule.length === 0 && reports.length === 0 ? (
							<p className="text-[13px] text-muted-foreground">{t("pr.no_reports_yet")}</p>
						) : (
							<ul className="flex flex-col gap-2 text-[13px]">
								{schedule.slice(0, 3).map((item) => {
									const report = reports.find((candidate) => candidate.type === "form" && candidate.period === item.period);
									return (
										<li key={item.period} className="flex flex-wrap items-center justify-between gap-2">
											<span>{periodLabel(item.period, language)}</span>
											{report ? <ReportChip status={report.status} /> : <ReportChip status={item.overdue ? "overdue" : "due"} />}
										</li>
									);
								})}
								{schedule.length === 0 && reports.slice(0, 3).map((report) => (
									<li key={report.id} className="flex flex-wrap items-center justify-between gap-2">
										<span className="min-w-0 break-words">{report.label ?? periodLabel(report.period, language)}</span>
										<ReportChip status={report.status} />
									</li>
								))}
							</ul>
						)}
					</section>
					<section className="rounded-card border border-border bg-card p-4">
						<div className="mb-2 flex items-center justify-between gap-2">
							<h2 className="text-[15px] font-semibold">{t("pr.recent_files")}</h2>
							<button type="button" className="text-[13px] font-medium text-selected-foreground" onClick={onFiles}>{t("nav.files")}</button>
						</div>
						{files.data?.files.length ? (
							<ul className="flex flex-col gap-2 text-[13px]">
								{files.data.files.slice(0, 3).map((file) => (
									<li key={file.id} className="flex items-center gap-2">
										<FileBadge name={file.name} />
										<span className="min-w-0 flex-1 truncate">{file.name ?? t("pr.link_unavailable")}</span>
										{!file.orgFileId && <span className="text-xs text-muted-foreground">v{file.currentVersion}</span>}
									</li>
								))}
							</ul>
						) : (
							<p className="text-[13px] text-muted-foreground">{t("pr.no_files_yet")}</p>
						)}
					</section>
					<section className="rounded-card border border-border bg-card p-4">
						<h2 className="mb-2 text-[15px] font-semibold">{t("cb.step_details")}</h2>
						<dl className="grid gap-x-3 gap-y-1.5 text-[13px] sm:grid-cols-[110px_minmax(0,1fr)]">
							{[
								[t("pr.field_category"), project.category ? t(`pr.cat_${project.category}`) : "—"],
								[t("pr.field_priority"), t(`pr.priority_${project.priority}`)],
								[t("pr.field_locations"), project.locations ?? "—"],
								[t("pr.field_sdg"), project.sdg ? `SDG ${project.sdg}` : "—"],
								[t("pr.field_frequency"), project.reportingFrequency ? t(`pr.frequency_${project.reportingFrequency}`) : "—"],
								[t("pr.field_visibility"), t(`pr.visibility_${project.visibility}`)],
							].map(([label, value]) => (
								<div key={label} className="contents">
									<dt className="text-muted-foreground">{label}</dt>
									<dd className="min-w-0 break-words">{value}</dd>
								</div>
							))}
						</dl>
						{project.description && <p className="mt-2.5 whitespace-pre-wrap break-words border-t border-border pt-2.5 text-[13px]">{project.description}</p>}
					</section>
					<section className="rounded-card border border-border bg-card p-4">
						<h2 className="mb-2.5 text-[15px] font-semibold">{t("dashboard.activity")}</h2>
						<ActivityList data={data} limit={5} />
					</section>
					<section className="rounded-card border border-border bg-card p-4">
						<div className="mb-2 flex items-center justify-between">
							<h2 className="text-[15px] font-semibold">{t("pr.team")}</h2>
							<button type="button" className="text-[13px] font-medium text-selected-foreground" onClick={onTeam}>{t("pr.view_team")}</button>
						</div>
						<div className="flex flex-wrap gap-1.5">
							{[project.ownerName, project.managerName, ...data.members.map((member) => member.name)]
								.filter((name, index, list): name is string => !!name && list.indexOf(name) === index)
								.map((name) => <span key={name} title={name}><Avatar name={name} size={30} /></span>)}
						</div>
					</section>
				</div>
			</div>
		</div>
	);
}

function TeamTab({ data }: { data: ProjectData }) {
	const { t } = useI18n();
	const { project } = data;
	const refresh = useRefresh(String(project.id));
	const [adding, setAdding] = useState("");
	const people = useQuery({
		queryKey: ["project-people", project.id],
		queryFn: () => api<{ people: { userId: string; name: string }[] }>(`/projects/${project.id}/people`),
		select: (result) => result.people,
		enabled: data.canEdit,
	});
	const add = useMutation({
		mutationFn: ({ userId, role }: { userId: string; role: string }) => api(`/projects/${project.id}/members/${userId}`, { method: "PUT", body: { role } }),
		onSuccess: async () => {
			setAdding("");
			await refresh();
		},
	});
	const remove = useMutation({
		mutationFn: (userId: string) => api(`/projects/${project.id}/members/${userId}`, { method: "DELETE" }),
		onSuccess: refresh,
	});
	const onTeam = new Set([project.ownerId, project.managerId, ...data.members.map((member) => member.userId)]);
	const row = (name: string, role: string, actions?: React.ReactNode) => (
		<li key={`${name}-${role}`} className="flex flex-wrap items-center gap-2.5 border-t border-border px-4 py-2.5 first:border-t-0">
			<Avatar name={name} size={30} />
			<span className="min-w-0 flex-1 break-words font-medium">{name}</span>
			{actions ?? <span className="text-[13px] text-muted-foreground">{role}</span>}
		</li>
	);
	return (
		<div className="flex max-w-[760px] flex-col gap-3">
			{data.canEdit && (
				<section className="flex flex-wrap items-end gap-2 rounded-card border border-border bg-card p-4">
					<div className="min-w-52 flex-1">
						<SelectField label={t("pr.add_member")} value={adding} onChange={(event) => setAdding(event.target.value)}>
							<option value="">{t("cb.choose")}</option>
							{people.data?.filter((person) => !onTeam.has(person.userId)).map((person) => <option key={person.userId} value={person.userId}>{person.name}</option>)}
						</SelectField>
					</div>
					<button type="button" disabled={!adding || add.isPending} className={buttonClass()} onClick={() => add.mutate({ userId: adding, role: "member" })}>{t("pr.add")}</button>
				</section>
			)}
			<ul className="rounded-card border border-border bg-card">
				{project.ownerName && row(project.ownerName, t("pr.owner"))}
				{project.managerName && project.managerId !== project.ownerId && row(project.managerName, t("pr.manager"))}
				{data.members.map((member) =>
					row(
						member.name,
						t(`pr.role_${member.role}`),
						data.canEdit ? (
							<span className="flex items-center gap-1.5">
								<select
									aria-label={t("pr.member_role", { name: member.name })}
									value={member.role}
									className="h-8 rounded-md border border-input bg-card px-1.5 text-[13px]"
									onChange={(event) => add.mutate({ userId: member.userId, role: event.target.value })}
								>
									{(["member", "viewer"] as const).map((value) => <option key={value} value={value}>{t(`pr.role_${value}`)}</option>)}
								</select>
								<button type="button" aria-label={t("cb.remove_file", { name: member.name })} className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted" onClick={() => remove.mutate(member.userId)}>
									<Trash2 size={14} aria-hidden="true" />
								</button>
							</span>
						) : undefined,
					),
				)}
			</ul>
		</div>
	);
}

function SettingsTab({ data }: { data: ProjectData }) {
	const { t } = useI18n();
	const { project } = data;
	const refresh = useRefresh(String(project.id));
	const [form, setForm] = useState({
		name: project.name,
		code: project.code,
		category: project.category ?? "",
		description: project.description ?? "",
		priority: project.priority,
		status: project.status as string,
		objectives: project.objectives ?? "",
		expectedOutcomes: project.expectedOutcomes ?? "",
		startDate: project.startDate ?? "",
		endDate: project.endDate ?? "",
		ownerId: project.ownerId ?? "",
		managerId: project.managerId ?? "",
		visibility: project.visibility,
		funder: project.funder ?? "",
		budgetCurrency: project.budgetCurrency,
		budgetAmount: project.budgetAmount !== null ? String(project.budgetAmount) : "",
		beneficiaryTarget: project.beneficiaryTarget !== null ? String(project.beneficiaryTarget) : "",
		locations: project.locations ?? "",
		sdg: project.sdg ? String(project.sdg) : "",
		reportingFrequency: project.reportingFrequency ?? "",
	});
	const [saved, setSaved] = useState(false);
	const people = useQuery({
		queryKey: ["project-people", project.id],
		queryFn: () => api<{ people: { userId: string; name: string }[] }>(`/projects/${project.id}/people`),
		select: (result) => result.people,
	});
	const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
		setSaved(false);
		setForm((current) => ({ ...current, [key]: value }));
	};
	const save = useMutation({
		mutationFn: () => api(`/projects/${project.id}`, { method: "PATCH", body: projectBody(form) }),
		onSuccess: async () => {
			setSaved(true);
			await refresh();
		},
	});
	const code = save.error instanceof ApiError ? save.error.code : "";
	function submit(event: FormEvent) {
		event.preventDefault();
		save.mutate();
	}
	const picker = (label: string, key: "ownerId" | "managerId") => (
		<SelectField label={label} value={form[key]} onChange={(event) => set(key, event.target.value)}>
			{people.data?.map((person) => <option key={person.userId} value={person.userId}>{person.name}</option>)}
		</SelectField>
	);
	return (
		<form onSubmit={submit} className="flex max-w-[860px] flex-col gap-4">
			{save.isError && <Alert>{t(SAVE_ERRORS[code] ?? "error.generic")}</Alert>}
			<section className="flex flex-col gap-3.5 rounded-card border border-border bg-card p-4 md:p-5">
				<Field label={t("pr.field_name")} required maxLength={200} value={form.name} onChange={(event) => set("name", event.target.value)} />
				<div className="grid gap-3.5 sm:grid-cols-3">
					<Field label={t("pr.field_code")} required maxLength={30} value={form.code} onChange={(event) => set("code", event.target.value.toUpperCase())} />
					<SelectField label={t("users.status")} value={form.status} onChange={(event) => set("status", event.target.value)}>
						{PROJECT_STATUSES.filter((value) =>
							project.status === "completed" ? value === "completed" || value === "archived" : value !== "completed",
						).map((value) => <option key={value} value={value}>{t(`pr.status_${value}`)}</option>)}
					</SelectField>
					<SelectField label={t("pr.field_category")} value={form.category} onChange={(event) => set("category", event.target.value)}>
						<option value="">{t("cb.choose")}</option>
						{PROJECT_CATEGORIES.map((value) => <option key={value} value={value}>{t(`pr.cat_${value}`)}</option>)}
					</SelectField>
				</div>
				<TextareaField label={t("pr.field_description")} rows={3} maxLength={4000} value={form.description} onChange={(event) => set("description", event.target.value)} />
				<TextareaField label={t("pr.field_objectives")} hint={t("pr.one_per_line")} rows={3} maxLength={4000} value={form.objectives} onChange={(event) => set("objectives", event.target.value)} />
				<TextareaField label={t("pr.field_outcomes")} hint={t("pr.one_per_line")} rows={3} maxLength={4000} value={form.expectedOutcomes} onChange={(event) => set("expectedOutcomes", event.target.value)} />
				<div className="grid gap-3.5 sm:grid-cols-2">
					<Field label={t("pr.field_start")} type="date" value={form.startDate} onChange={(event) => set("startDate", event.target.value)} />
					<Field label={t("pr.field_end")} type="date" value={form.endDate} onChange={(event) => set("endDate", event.target.value)} />
					{picker(t("pr.owner"), "ownerId")}
					{picker(t("pr.manager"), "managerId")}
				</div>
				<SelectField label={t("pr.field_visibility")} value={form.visibility} onChange={(event) => set("visibility", event.target.value)}>
					{(["members", "organization"] as const).map((value) => <option key={value} value={value}>{t(`pr.visibility_${value}`)}</option>)}
				</SelectField>
			</section>
			<section className="grid gap-3.5 rounded-card border border-border bg-card p-4 sm:grid-cols-2 md:p-5">
				<Field label={t("pr.field_funder")} maxLength={200} value={form.funder} onChange={(event) => set("funder", event.target.value)} />
				<div className="flex gap-2">
					<div className="w-24 shrink-0">
						<SelectField label={t("pr.field_currency")} value={form.budgetCurrency} onChange={(event) => set("budgetCurrency", event.target.value)}>
							{["USD", "MMK", "EUR"].map((value) => <option key={value} value={value}>{value}</option>)}
						</SelectField>
					</div>
					<div className="min-w-0 flex-1"><Field label={t("pr.field_budget")} inputMode="decimal" value={form.budgetAmount} onChange={(event) => set("budgetAmount", event.target.value)} /></div>
				</div>
				<Field label={t("pr.field_target")} inputMode="numeric" value={form.beneficiaryTarget} onChange={(event) => set("beneficiaryTarget", event.target.value)} />
				<Field label={t("pr.field_locations")} hint={t("pr.locations_hint")} maxLength={300} value={form.locations} onChange={(event) => set("locations", event.target.value)} />
			</section>
			<div className="flex items-center justify-end gap-3">
				{saved && <span role="status" className="text-[13px] text-muted-foreground">{t("common.saved")}</span>}
				<button type="submit" disabled={save.isPending} className={buttonClass()}>{t("common.save")}</button>
			</div>
		</form>
	);
}

interface CompletionCheck {
	key: string;
	level: "ok" | "block" | "warn";
	count?: number;
	total?: number;
	items?: string[];
}

function CompleteDialog({ data, onClose, onReports }: { data: ProjectData; onClose: () => void; onReports: () => void }) {
	const { t, language } = useI18n();
	const refresh = useRefresh(String(data.project.id));
	const [step, setStep] = useState(1);
	const [notes, setNotes] = useState("");
	const checks = useQuery({
		queryKey: ["project-completion", data.project.id],
		queryFn: () => api<{ checks: CompletionCheck[] }>(`/projects/${data.project.id}/completion`),
		select: (result) => result.checks,
		gcTime: 0,
	});
	const complete = useMutation({
		mutationFn: () => api(`/projects/${data.project.id}/complete`, { method: "POST", body: { notes } }),
		onSuccess: async () => {
			await refresh();
			onClose();
		},
	});
	const blocks = checks.data?.filter((check) => check.level === "block").length ?? 0;
	const look = {
		ok: "bg-[#22A076] text-white",
		block: "bg-destructive text-primary-foreground",
		warn: "bg-[#F59F0A] text-[#030711]",
	};
	return (
		<Modal title={t("pr.complete_title", { name: data.project.name })} description={t(step === 1 ? "pr.complete_desc" : "pr.complete_confirm_desc")} open onClose={onClose}>
			{step === 1 ? (
				<div className="flex flex-col gap-3">
					{checks.isPending && <PageLoading />}
					{checks.isError && <Alert>{t("error.generic")}</Alert>}
					<ul className="flex flex-col">
						{checks.data?.map((check) => (
							<li key={check.key} className="flex items-start gap-3 border-t border-border py-2.5 first:border-t-0">
								<span aria-hidden="true" className={`grid size-5 shrink-0 place-items-center rounded-full text-xs font-bold ${look[check.level]}`}>{check.level === "ok" ? "✓" : "!"}</span>
								<span className="min-w-0 flex-1 text-sm">
									<span className="flex flex-wrap items-center gap-2">
										<b>{t(`pr.check_${check.key}`, { count: check.count ?? 0, total: check.total ?? 0 })}</b>
										{check.level !== "ok" && (
											<span className={`rounded-full border px-2 text-xs font-semibold ${check.level === "block" ? "border-destructive" : "border-[#F59F0A]"}`}>
												{t(check.level === "block" ? "pr.check_blocks" : "pr.check_warning")}
											</span>
										)}
									</span>
									{check.items && check.items.length > 0 && (
										<span className="block break-words text-[13px] text-muted-foreground">{check.items.map((item) => periodLabel(item, language)).join(", ")}</span>
									)}
								</span>
								{check.key === "reports_open" && (
									<button
										type="button"
										className="shrink-0 text-[13px] font-semibold text-selected-foreground"
										onClick={() => {
											onReports();
											onClose();
										}}
									>
										{t("pr.all_reports")}
									</button>
								)}
							</li>
						))}
					</ul>
					<div className="rounded-[9px] bg-muted px-3 py-2.5 text-[13px]">
						<b>{t("pr.complete_does")}</b>
						<ul className="mt-1 list-disc pl-[18px] text-muted-foreground">
							<li>{t("pr.complete_does_1")}</li>
							<li>{t("pr.complete_does_2")}</li>
							<li>{t("pr.complete_does_3")}</li>
						</ul>
					</div>
					<div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-3.5">
						{blocks > 0 && <span className="mr-auto text-[13px] font-semibold text-danger-foreground">{t("pr.fix_first", { count: blocks })}</span>}
						<button type="button" className={buttonClass("outline")} onClick={onClose}>{t("common.cancel")}</button>
						<button type="button" disabled={!checks.isSuccess || blocks > 0} className={buttonClass()} onClick={() => setStep(2)}>{t("twofactor.continue")}</button>
					</div>
				</div>
			) : (
				<div className="flex flex-col gap-3.5">
					{complete.isError && <Alert>{t("error.generic")}</Alert>}
					<TextareaField label={t("pr.completion_notes")} hint={t("pr.completion_notes_hint")} rows={3} maxLength={2000} value={notes} onChange={(event) => setNotes(event.target.value)} />
					<div className="flex justify-end gap-2">
						<button type="button" className={buttonClass("outline")} onClick={() => setStep(1)}>{t("pr.back_step")}</button>
						<button type="button" disabled={complete.isPending} className={buttonClass()} onClick={() => complete.mutate()}>{t("pr.complete")}</button>
					</div>
				</div>
			)}
		</Modal>
	);
}

export function ProjectDetailPage({ id }: { id: string }) {
	const { t, language } = useI18n();
	const [tab, setTab] = useState<Tab>("overview");
	const [healthOpen, setHealthOpen] = useState(false);
	const [completing, setCompleting] = useState(false);
	const refresh = useRefresh(id);
	const reopen = useMutation({ mutationFn: () => api(`/projects/${id}/reopen`, { method: "POST" }), onSuccess: refresh });
	const detail = useQuery({
		queryKey: ["project", id],
		queryFn: () => api<ProjectData>(`/projects/${id}`),
		retry: false,
	});
	if (detail.isPending) return <PageLoading />;
	if (detail.isError) {
		if (detail.error instanceof ApiError && detail.error.status === 404) {
			return <StatePanel icon={SearchX} title={t("pr.not_found")} action={<Link href="/projects" className={buttonClass("outline")}>{t("pr.back")}</Link>} />;
		}
		return <PageError onRetry={() => detail.refetch()} />;
	}
	const data = detail.data;
	const { project } = data;
	const tabs = TABS.filter((value) => value !== "settings" || data.canEdit);
	const meta = [
		project.startDate && project.endDate ? `${shortDay(project.startDate, language)} – ${shortDay(project.endDate, language)}` : null,
		project.ownerName && t("pr.owner_name", { name: project.ownerName }),
		project.managerName && t("pr.manager_name", { name: project.managerName }),
	]
		.filter(Boolean)
		.join(" · ");
	return (
		<div className="flex flex-col gap-4 p-4 md:px-6 md:py-7">
			<nav aria-label={t("people.breadcrumb")} className="text-[13px] text-muted-foreground">
				<Link href="/projects" className="no-underline hover:underline">{t("nav.projects")}</Link> / <span>{project.name}</span>
			</nav>
			<div className="flex flex-wrap items-start justify-between gap-3">
			<div className="min-w-0">
				<h1 className="flex flex-wrap items-baseline gap-x-2 break-words text-[26px] font-semibold leading-[34px] tracking-tight">
					{project.name}
					<span className="text-[13px] font-medium tracking-normal text-muted-foreground">{project.code}</span>
				</h1>
				<div className="mt-1.5 flex flex-wrap items-center gap-2.5">
					<ProjectStatusChip status={project.status} />
					<ProjectHealthChip health={project.health} />
					{meta && <span className="text-[13px] text-muted-foreground">{meta}</span>}
				</div>
				{project.status === "completed" && project.completedAt && (
					<p className="mt-1.5 text-[13px]">
						{t("pr.completed_by", { name: project.completedByName ?? "—", date: new Date(project.completedAt).toLocaleDateString(language, { dateStyle: "medium" }) })}
						{project.completionNotes && <span className="block break-words text-muted-foreground">{project.completionNotes}</span>}
					</p>
				)}
			</div>
			<div className="flex flex-wrap gap-2">
				{data.canEdit && ["planned", "in_progress", "on_hold"].includes(project.status) && (
					<button type="button" className={buttonClass("outline")} onClick={() => setCompleting(true)}>{t("pr.complete")}</button>
				)}
				{data.isAdmin && project.status === "completed" && (
					<button type="button" disabled={reopen.isPending} className={buttonClass("outline")} onClick={() => reopen.mutate()}>{t("pr.reopen")}</button>
				)}
			</div>
			</div>
			<Segmented
				label={project.name}
				look="underline"
				options={tabs.map((value) => ({ value, label: t(`pr.tab_${value}`) }))}
				value={tab}
				onChange={setTab}
			/>
			{tab === "overview" && <OverviewTab data={data} onHealth={() => setHealthOpen(true)} onTeam={() => setTab("team")} onFiles={() => setTab("files")} onReports={() => setTab("reports")} />}
			{tab === "dashboard" && <ProjectDashboardTab projectId={project.id} />}
			{tab === "files" && <ProjectFilesTab projectId={project.id} projectName={project.name} />}
			{tab === "reports" && <ProjectReportsTab projectId={project.id} />}
			{tab === "team" && <TeamTab data={data} />}
			{tab === "activity" && (
				<section className="max-w-[760px] rounded-card border border-border bg-card p-4 md:p-5">
					<ActivityList data={data} />
				</section>
			)}
			{tab === "settings" && data.canEdit && <SettingsTab key={project.id} data={data} />}
			{healthOpen && <HealthDialog data={data} onClose={() => setHealthOpen(false)} />}
			{completing && <CompleteDialog data={data} onClose={() => setCompleting(false)} onReports={() => setTab("reports")} />}
		</div>
	);
}
