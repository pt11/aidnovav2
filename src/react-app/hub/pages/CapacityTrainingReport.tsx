import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Download, Lock, Users } from "lucide-react";
import { api } from "../api";
import { downloadCsv } from "../csv";
import { useI18n } from "../i18n";
import {
	Alert,
	Avatar,
	buttonClass,
	DataTable,
	FilterSelect,
	PageError,
	PageHeader,
	PageLoading,
	Segmented,
	StatePanel,
} from "../ui";
import {
	dateRange,
	durationText,
	LockNote,
	ReviewChip,
	TrainingChip,
	useCapacityMe,
	type ReviewStatus,
	type TrainingRecord,
	type TrainingStatus,
} from "./Capacity";

type Scope = "team" | "department" | "organization";

interface ReportRow {
	id: number;
	ownerName: string;
	department: string | null;
	restricted: boolean;
	title: string | null;
	category: string | null;
	format: TrainingRecord["format"];
	startDate: string | null;
	endDate: string | null;
	durationValue: number | null;
	durationUnit: TrainingRecord["durationUnit"];
	trainingStatus: TrainingStatus;
	applicationOutcome: TrainingRecord["applicationOutcome"];
	reviewStatus: ReviewStatus;
	reviewers: string[];
	evidenceCount: number | null;
}

const STATUS_TABS = ["all", "planned", "current", "completed", "cancelled"] as const;
type StatusTab = (typeof STATUS_TABS)[number];
const REVIEW_STATUSES: ReviewStatus[] = ["submitted", "under_review", "verified", "changes_requested", "rejected"];
const PAGE_SIZE = 25;
const PERIODS = ["all", "this_year", "last_6"] as const;

function inTab(row: ReportRow, tab: StatusTab) {
	if (tab === "planned") return row.trainingStatus === "applied";
	if (tab === "current") return row.trainingStatus === "started" || row.trainingStatus === "in_progress";
	if (tab === "completed") return row.trainingStatus === "completed";
	if (tab === "cancelled") return row.trainingStatus === "cancelled";
	return true;
}

function inPeriod(row: ReportRow, period: (typeof PERIODS)[number], now: number) {
	// A restricted row has no dates to go on, so it stays in every period.
	if (period === "all" || !row.startDate) return true;
	const date = row.endDate ?? row.startDate;
	if (period === "this_year") return date.startsWith(String(new Date(now).getFullYear()));
	return new Date(`${date}T00:00:00Z`).getTime() >= now - 183 * 24 * 60 * 60 * 1000;
}

function Stat({ label, value, note }: { label: string; value: string | number; note: string }) {
	return (
		<div className="rounded-card border border-border bg-card p-4">
			<dt className="text-[13px] text-muted-foreground">{label}</dt>
			<dd className="mt-1 text-2xl font-semibold tracking-tight">{value}</dd>
			<dd className="mt-0.5 text-xs text-muted-foreground">{note}</dd>
		</div>
	);
}

export function CapacityTrainingReportPage() {
	const { t, language } = useI18n();
	const me = useCapacityMe();
	const scopes = me.data?.reportScopes ?? [];
	const [chosenScope, setChosenScope] = useState<Scope | null>(null);
	const scope = chosenScope ?? (scopes[scopes.length - 1] as Scope | undefined) ?? "team";
	const [tab, setTab] = useState<StatusTab>("all");
	const [period, setPeriod] = useState<(typeof PERIODS)[number]>("all");
	const [department, setDepartment] = useState("all");
	const [category, setCategory] = useState("all");
	const [review, setReview] = useState("all");
	const [reviewer, setReviewer] = useState("all");
	const [page, setPage] = useState(0);
	const [now] = useState(() => Date.now());
	const report = useQuery({
		queryKey: ["capacity-report", scope],
		queryFn: () => api<{ rows: ReportRow[] }>(`/capacity/report?scope=${scope}`),
		select: (data) => data.rows,
		enabled: scopes.length > 0,
	});
	const rows = useMemo(() => report.data ?? [], [report.data]);
	const filtered = rows.filter(
		(row) =>
			inPeriod(row, period, now) &&
			(department === "all" || (row.department ?? "") === department) &&
			(category === "all" || row.category === category) &&
			(review === "all" || row.reviewStatus === review) &&
			(reviewer === "all" || row.reviewers.includes(reviewer)),
	);
	const visible = filtered.filter((row) => inTab(row, tab));
	const pages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
	const shown = visible.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
	const exportLog = useMutation({
		mutationFn: () => api("/capacity/report/exported", { method: "POST", body: { scope, count: visible.length } }),
		onSuccess: () =>
			downloadCsv("training-report.csv", [
				[t("cb.col_person"), t("cb.col_team"), t("cb.col_training"), t("cb.field_category"), t("cb.field_start"), t("cb.field_end"), t("cb.field_duration"), t("cb.col_training_status"), t("cb.col_review_status"), t("cb.col_reviewer"), t("cb.col_evidence")],
				...visible.map((row) => [
					row.ownerName,
					row.department ?? "",
					row.restricted ? t("cb.restricted_training") : (row.title ?? ""),
					row.category ? t(`cb.cat_${row.category}`) : "",
					row.startDate ?? "",
					row.endDate ?? "",
					row.durationValue !== null ? durationText(row as unknown as TrainingRecord, t) : "",
					t(`cb.training_${row.trainingStatus}`),
					t(`cb.review_${row.reviewStatus}`),
					row.reviewers.join(", "),
					row.evidenceCount === null ? "" : String(row.evidenceCount),
				]),
			]),
	});

	if (me.isPending || (report.isPending && scopes.length > 0)) return <PageLoading />;
	if (me.isError || report.isError) return <PageError onRetry={() => report.refetch()} />;

	const count = (test: (row: ReportRow) => boolean) => filtered.filter(test).length;
	const completed = filtered.filter((row) => row.trainingStatus === "completed");
	const verified = completed.filter((row) => row.reviewStatus === "verified");
	const add = (unit: ReportRow["durationUnit"]) =>
		verified.filter((row) => row.durationUnit === unit).reduce((total, row) => total + (row.durationValue ?? 0), 0);
	const departments = [...new Set(rows.map((row) => row.department).filter((name): name is string => !!name))].sort();
	const categories = [...new Set(rows.map((row) => row.category).filter((name): name is string => !!name))];
	const reviewers = [...new Set(rows.flatMap((row) => row.reviewers))].sort();
	const resetPage = <T,>(setter: (value: T) => void) => (value: T) => {
		setPage(0);
		setter(value);
	};

	return (
		<div className="flex flex-col gap-4 p-4 md:px-6 md:py-7">
			<PageHeader
				title={t("cb.report_title")}
				subtitle={t("cb.report_subtitle")}
				action={
					<div className="flex flex-wrap items-center gap-2">
						{scopes.length > 1 && (
							<Segmented
								label={t("cb.report_scope")}
								options={scopes.map((value) => ({ value: value as Scope, label: t(`cb.scope_${value}`) }))}
								value={scope}
								onChange={resetPage(setChosenScope)}
							/>
						)}
						<button type="button" disabled={visible.length === 0 || exportLog.isPending} className={buttonClass("outline")} onClick={() => exportLog.mutate()}>
							<Download size={16} aria-hidden="true" />
							{t("cb.export_logged")}
						</button>
					</div>
				}
			/>
			{exportLog.isError && <Alert>{t("error.generic")}</Alert>}
			<dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
				<Stat
					label={t("cb.filter_completed")}
					value={completed.length}
					note={t("cb.report_completed_note", {
						verified: verified.length,
						review: completed.filter((row) => row.reviewStatus === "submitted" || row.reviewStatus === "under_review").length,
					})}
				/>
				<Stat
					label={t("cb.report_current")}
					value={count((row) => inTab(row, "current"))}
					note={t("cb.report_current_note", {
						started: count((row) => row.trainingStatus === "started"),
						progress: count((row) => row.trainingStatus === "in_progress"),
					})}
				/>
				<Stat
					label={t("cb.report_planned")}
					value={count((row) => inTab(row, "planned"))}
					note={t("cb.report_planned_note", {
						accepted: count((row) => row.applicationOutcome === "accepted"),
						waitlisted: count((row) => row.applicationOutcome === "waitlisted"),
					})}
				/>
				<Stat
					label={t("cb.stat_time")}
					value={t("cb.stat_time_value", { days: add("training_days"), hours: add("contact_hours") })}
					note={t("cb.report_time_note")}
				/>
			</dl>
			<div className="flex flex-col gap-2.5">
				<Segmented
					label={t("cb.filter")}
					options={STATUS_TABS.map((value) => ({
						value,
						label: `${t(`cb.report_tab_${value}`)} ${filtered.filter((row) => inTab(row, value)).length}`,
					}))}
					value={tab}
					onChange={resetPage(setTab)}
				/>
				<div className="flex flex-wrap gap-2">
					<FilterSelect label={t("cb.report_period")} value={period} onChange={resetPage((value: string) => setPeriod(value as (typeof PERIODS)[number]))}>
						{PERIODS.map((value) => <option key={value} value={value}>{t(`cb.period_${value}`)}</option>)}
					</FilterSelect>
					{scope === "organization" && (
						<FilterSelect label={t("cb.col_team")} value={department} onChange={resetPage(setDepartment)}>
							<option value="all">{t("cb.filter_all")}</option>
							{departments.map((value) => <option key={value} value={value}>{value}</option>)}
						</FilterSelect>
					)}
					<FilterSelect label={t("cb.field_category")} value={category} onChange={resetPage(setCategory)}>
						<option value="all">{t("cb.filter_all")}</option>
						{categories.map((value) => <option key={value} value={value}>{t(`cb.cat_${value}`)}</option>)}
					</FilterSelect>
					<FilterSelect label={t("cb.col_review_status")} value={review} onChange={resetPage(setReview)}>
						<option value="all">{t("cb.filter_all")}</option>
						{REVIEW_STATUSES.map((value) => <option key={value} value={value}>{t(`cb.review_${value}`)}</option>)}
					</FilterSelect>
					<FilterSelect label={t("cb.col_reviewer")} value={reviewer} onChange={resetPage(setReviewer)}>
						<option value="all">{t("cb.filter_all")}</option>
						{reviewers.map((value) => <option key={value} value={value}>{value}</option>)}
					</FilterSelect>
				</div>
			</div>
			{visible.length === 0 ? (
				<StatePanel icon={Users} title={t("cb.report_empty")} description={t("cb.report_empty_desc")} />
			) : (
				<DataTable
					minWidth={940}
					head={[
						t("cb.col_person"),
						t("cb.col_training"),
						t("cb.report_col_dates"),
						t("cb.col_training_status"),
						t("cb.report_col_review"),
						t("cb.col_reviewer"),
						t("cb.col_evidence"),
					]}
				>
					{shown.map((row) => (
						<tr key={row.id}>
							<td className="px-3 py-2.5 first:pl-4">
								<span className="flex items-center gap-2.5">
									<Avatar name={row.ownerName} size={28} />
									<span className="min-w-0">
										<span className="block font-semibold">{row.ownerName}</span>
										<span className="block text-xs text-muted-foreground">{row.department ?? t("users.no_department")}</span>
									</span>
								</span>
							</td>
							<td className="px-3 py-2.5">
								{row.restricted ? (
									<>
										<span className="flex items-center gap-1.5 font-semibold">
											<Lock size={13} aria-hidden="true" />
											{t("cb.restricted_training")}
										</span>
										<span className="block text-xs text-muted-foreground">{t("cb.restricted_note")}</span>
									</>
								) : (
									<>
										<span className="block break-words font-semibold">{row.title}</span>
										<span className="block text-xs text-muted-foreground">
											{[row.category ? t(`cb.cat_${row.category}`) : null, row.format ? t(`cb.format_${row.format}`) : null].filter(Boolean).join(" · ")}
										</span>
									</>
								)}
							</td>
							<td className="px-3 py-2.5">
								<span className="block whitespace-nowrap">{dateRange(row as unknown as TrainingRecord, language)}</span>
								{row.durationValue !== null && <span className="block text-xs text-muted-foreground">{durationText(row as unknown as TrainingRecord, t)}</span>}
							</td>
							<td className="px-3 py-2.5"><TrainingChip status={row.trainingStatus} /></td>
							<td className="px-3 py-2.5">
								<ReviewChip status={row.reviewStatus} />
								{row.applicationOutcome && <span className="mt-0.5 block text-xs text-muted-foreground">{t(`cb.outcome_${row.applicationOutcome}`)}</span>}
							</td>
							<td className="px-3 py-2.5">{row.reviewers.join(", ") || "—"}</td>
							<td className="px-3 py-2.5 text-muted-foreground last:pr-4">
								{row.evidenceCount === null ? (
									<span className="inline-flex items-center gap-1"><Lock size={12} aria-hidden="true" />{t("cb.private")}</span>
								) : row.evidenceCount > 0 ? (
									t("cb.evidence_count", { count: row.evidenceCount })
								) : row.trainingStatus === "completed" ? (
									<span className="font-medium text-danger-foreground">{t("cb.evidence_missing")}</span>
								) : (
									"—"
								)}
							</td>
						</tr>
					))}
				</DataTable>
			)}
			{pages > 1 && (
				<div className="flex items-center justify-end gap-2 text-[13px]">
					<span className="mr-auto text-muted-foreground">{t("users.showing", { shown: shown.length, total: visible.length })}</span>
					<button type="button" disabled={page === 0} className={buttonClass("outline")} onClick={() => setPage(page - 1)}>{t("users.previous")}</button>
					<button type="button" disabled={page >= pages - 1} className={buttonClass("outline")} onClick={() => setPage(page + 1)}>{t("users.next")}</button>
				</div>
			)}
			<p className="text-xs text-muted-foreground">{t("cb.report_time_footnote")}</p>
			<LockNote>{t("cb.report_scope_note")} {t("cb.report_export_note")}</LockNote>
		</div>
	);
}
