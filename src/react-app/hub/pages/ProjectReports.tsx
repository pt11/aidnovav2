import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardList, Lock, Plus, Upload, X } from "lucide-react";
import { api, ApiError } from "../api";
import { useI18n } from "../i18n";
import {
	Alert,
	buttonClass,
	Field,
	Modal,
	PageError,
	PageLoading,
	SelectField,
	StatePanel,
	TextareaField, useToast } from "../ui";
import { uploadProjectFile, useProjectFiles } from "./ProjectFiles";
import { shortDay } from "./Projects";

export type ReportStatus = "draft" | "submitted" | "needs_revision" | "approved" | "locked";

export interface ProjectReport {
	id: number;
	type: "form" | "file";
	period: string;
	label: string | null;
	status: ReportStatus;
	revision: number;
	beneficiaries: number | null;
	activities: string | null;
	budgetSpent: number | null;
	challenges: string | null;
	nextPlan: string | null;
	fileId: number | null;
	reviewComment: string | null;
	authorName: string | null;
	reviewerName: string | null;
	submittedAt: string | null;
	reviewedAt: string | null;
	canChange: boolean;
	canReview: boolean;
	files: { fileId: number; name: string | null }[];
}

export interface ScheduleItem {
	period: string;
	dueDate: string;
	overdue: boolean;
	reportId: number | null;
}

export interface ReportsData {
	reports: ProjectReport[];
	schedule: ScheduleItem[];
	canContribute: boolean;
	canManage: boolean;
	frequency: string | null;
	currency: string;
}

export function projectReportsKey(projectId: number) {
	return ["project-reports", projectId];
}

export function useProjectReports(projectId: number) {
	return useQuery({
		queryKey: projectReportsKey(projectId),
		queryFn: () => api<ReportsData>(`/projects/${projectId}/reports`),
	});
}

export function periodLabel(period: string, language: string) {
	const quarter = /^(\d{4})-Q([1-4])$/.exec(period);
	if (quarter) return `Q${quarter[2]} ${quarter[1]}`;
	if (/^\d{4}-\d{2}$/.test(period)) {
		return new Date(`${period}-01T00:00:00Z`).toLocaleDateString(language, { month: "long", year: "numeric", timeZone: "UTC" });
	}
	return period;
}

const STATUS_LOOK: Record<ReportStatus | "overdue" | "due", string> = {
	draft: "border border-input bg-card text-foreground",
	submitted: "bg-selected text-selected-foreground",
	needs_revision: "border border-[#F59F0A] bg-warning-surface text-foreground",
	approved: "bg-[#14795A] text-white",
	locked: "bg-foreground text-background",
	overdue: "border border-destructive bg-danger-surface text-danger-foreground",
	due: "bg-muted text-foreground",
};

export function ReportChip({ status }: { status: ReportStatus | "overdue" | "due" }) {
	const { t } = useI18n();
	return (
		<span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-px text-xs font-semibold ${STATUS_LOOK[status]}`}>
			{status === "locked" && <Lock size={11} aria-hidden="true" />}
			{t(`pr.report_${status}`)}
		</span>
	);
}

const WORKFLOW = ["draft", "submitted", "needs_revision_or_approved", "locked"];

const SAVE_ERRORS: Record<string, string> = {
	PERIOD_EXISTS: "pr.period_exists",
	INVALID_PERIOD: "pr.period_invalid",
	INVALID_REPORT: "pr.report_invalid",
	INCOMPLETE: "pr.report_incomplete",
	INVALID_LABEL: "pr.label_required",
	FILE_REQUIRED: "pr.file_required",
	TYPE_NOT_ALLOWED: "files.type_not_allowed",
	FILE_TOO_LARGE: "files.file_too_large",
	STORAGE_FULL: "files.storage_full",
	ALREADY_DECIDED: "cb.already_decided",
	LOCKED: "cb.locked",
};

function ReportForm({
	projectId,
	report,
	period,
	currency,
	onSaved,
}: {
	projectId: number;
	report: ProjectReport | null;
	period: string;
	currency: string;
	onSaved: (id: number) => void;
}) {
	const { t } = useI18n();
	const queryClient = useQueryClient();
	const files = useProjectFiles(projectId);
	const [values, setValues] = useState({
		beneficiaries: report?.beneficiaries != null ? String(report.beneficiaries) : "",
		activities: report?.activities ?? "",
		budgetSpent: report?.budgetSpent != null ? String(report.budgetSpent) : "",
		challenges: report?.challenges ?? "",
		nextPlan: report?.nextPlan ?? "",
	});
	const [fileIds, setFileIds] = useState<number[]>(report?.files.map((file) => file.fileId) ?? []);
	const [saved, setSaved] = useState(false);
	const set = (key: keyof typeof values, value: string) => {
		setSaved(false);
		setValues((current) => ({ ...current, [key]: value }));
	};
	const refresh = () => queryClient.invalidateQueries({ queryKey: projectReportsKey(projectId) });
	const save = async () => {
		const body = { ...values, fileIds };
		if (report) {
			await api(`/projects/${projectId}/reports/${report.id}`, { method: "PATCH", body });
			return report.id;
		}
		const created = await api<{ id: number }>(`/projects/${projectId}/reports`, { method: "POST", body: { ...body, type: "form", period } });
		return created.id;
	};
	const draft = useMutation({
		mutationFn: save,
		onSuccess: async (id) => {
			setSaved(true);
			await refresh();
			onSaved(id);
		},
	});
	const submit = useMutation({
		mutationFn: async () => {
			const id = await save();
			await api(`/projects/${projectId}/reports/${id}/submit`, { method: "POST" });
			return id;
		},
		onSuccess: async (id) => {
			await refresh();
			onSaved(id);
		},
	});
	const error = draft.error ?? submit.error;
	const code = error instanceof ApiError ? error.code : "";
	const busy = draft.isPending || submit.isPending;
	const available = (files.data?.files ?? []).filter((file) => file.name && !fileIds.includes(file.id));
	const nameOf = (id: number) => files.data?.files.find((file) => file.id === id)?.name ?? report?.files.find((file) => file.fileId === id)?.name ?? "";
	return (
		<div className="flex flex-col gap-3.5">
			{error && <Alert>{t(SAVE_ERRORS[code] ?? "error.generic")}</Alert>}
			<div className="grid gap-3.5 sm:grid-cols-2">
				<Field label={t("pr.report_beneficiaries")} inputMode="numeric" value={values.beneficiaries} onChange={(event) => set("beneficiaries", event.target.value)} />
				<Field label={t("pr.report_budget", { currency })} hint={t("pr.report_budget_hint")} inputMode="decimal" value={values.budgetSpent} onChange={(event) => set("budgetSpent", event.target.value)} />
			</div>
			<TextareaField label={`${t("pr.report_activities")} *`} rows={3} maxLength={6000} value={values.activities} onChange={(event) => set("activities", event.target.value)} />
			<TextareaField label={t("pr.report_challenges")} rows={2} maxLength={6000} value={values.challenges} onChange={(event) => set("challenges", event.target.value)} />
			<TextareaField label={t("pr.report_next")} rows={2} maxLength={6000} value={values.nextPlan} onChange={(event) => set("nextPlan", event.target.value)} />
			<div>
				<p className="mb-1.5 text-sm font-medium">{t("pr.report_files")}</p>
				<div className="flex flex-wrap items-center gap-2">
					{fileIds.map((id) => (
						<span key={id} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[13px]">
							<span className="max-w-[220px] truncate">{nameOf(id)}</span>
							<button type="button" aria-label={t("cb.remove_file", { name: nameOf(id) })} onClick={() => setFileIds((current) => current.filter((item) => item !== id))}>
								<X size={13} aria-hidden="true" />
							</button>
						</span>
					))}
					<select
						aria-label={t("pr.attach_from_files")}
						value=""
						className="h-9 max-w-[240px] rounded-md border border-dashed border-input bg-card px-2 text-[13px]"
						onChange={(event) => {
							const id = Number(event.target.value);
							if (id) setFileIds((current) => [...current, id]);
						}}
					>
						<option value="">{`+ ${t("pr.attach_from_files")}`}</option>
						{available.map((file) => <option key={file.id} value={file.id}>{file.name}</option>)}
					</select>
				</div>
			</div>
			<div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-3.5">
				{saved && <span role="status" className="mr-auto text-[13px] text-muted-foreground">{t("cb.draft_saved")}</span>}
				<button type="button" disabled={busy} className={buttonClass("outline")} onClick={() => draft.mutate()}>{t("cb.save_draft")}</button>
				<button type="button" disabled={busy || !values.activities.trim()} className={buttonClass()} onClick={() => submit.mutate()}>{t("cb.submit")}</button>
			</div>
		</div>
	);
}

function ReportView({ report, currency, projectId }: { report: ProjectReport; currency: string; projectId: number }) {
	const { t } = useI18n();
	const row = (label: string, value: string | number | null) =>
		value === null || value === "" ? null : (
			<div className="contents" key={label}>
				<dt className="text-muted-foreground">{label}</dt>
				<dd className="min-w-0 whitespace-pre-wrap break-words">{value}</dd>
			</div>
		);
	return (
		<dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[170px_minmax(0,1fr)]">
			{row(t("pr.report_beneficiaries"), report.beneficiaries !== null ? report.beneficiaries.toLocaleString("en") : null)}
			{row(t("pr.report_budget", { currency }), report.budgetSpent !== null ? report.budgetSpent.toLocaleString("en") : null)}
			{row(t("pr.report_activities"), report.activities)}
			{row(t("pr.report_challenges"), report.challenges)}
			{row(t("pr.report_next"), report.nextPlan)}
			{report.type === "file" && report.fileId && (
				<div className="contents">
					<dt className="text-muted-foreground">{t("pr.report_file")}</dt>
					<dd><a href={`/api/projects/${projectId}/files/${report.fileId}/download`} className="font-medium text-selected-foreground">{t("files.download")}</a></dd>
				</div>
			)}
			{report.files.length > 0 && (
				<div className="contents">
					<dt className="text-muted-foreground">{t("pr.report_files")}</dt>
					<dd className="flex flex-wrap gap-2">
						{report.files.map((file) => (
							<a key={file.fileId} href={`/api/projects/${projectId}/files/${file.fileId}/download`} className="text-selected-foreground">{file.name}</a>
						))}
					</dd>
				</div>
			)}
		</dl>
	);
}

function ReviewBox({ projectId, report, onDone }: { projectId: number; report: ProjectReport; onDone: () => void }) {
	const { t } = useI18n();
	const queryClient = useQueryClient();
	const [comment, setComment] = useState("");
	const toast = useToast();
	const decide = useMutation({
		mutationFn: (decision: "approve" | "revise") => api(`/projects/${projectId}/reports/${report.id}/decision`, { method: "POST", body: { decision, comment } }),
		onSuccess: async (_, decision) => {
			await queryClient.invalidateQueries({ queryKey: projectReportsKey(projectId) });
			toast.success(t(decision === "approve" ? "pr.toast_approved" : "pr.toast_returned"));
			onDone();
		},
	});
	const code = decide.error instanceof ApiError ? decide.error.code : "";
	return (
		<div className="flex flex-col gap-3 rounded-[9px] border border-border bg-background p-3.5">
			{decide.isError && <Alert>{t(SAVE_ERRORS[code] ?? "error.generic")}</Alert>}
			<TextareaField
				label={t("cb.comment_for", { name: report.authorName ?? "" })}
				hint={t("pr.review_comment_hint")}
				rows={2}
				maxLength={2000}
				value={comment}
				onChange={(event) => setComment(event.target.value)}
			/>
			<div className="flex flex-wrap justify-end gap-2">
				<button type="button" disabled={!comment.trim() || decide.isPending} className={buttonClass("outline")} onClick={() => decide.mutate("revise")}>{t("pr.send_back")}</button>
				<button type="button" disabled={decide.isPending} className={buttonClass()} onClick={() => decide.mutate("approve")}>{t("pr.approve")}</button>
			</div>
		</div>
	);
}

function FileReportDialog({ projectId, onClose, onCreated }: { projectId: number; onClose: () => void; onCreated: (id: number) => void }) {
	const { t } = useI18n();
	const queryClient = useQueryClient();
	const input = useRef<HTMLInputElement>(null);
	const [label, setLabel] = useState("");
	const [chosen, setChosen] = useState<File | null>(null);
	const create = useMutation({
		mutationFn: async () => {
			const uploaded = await uploadProjectFile(projectId, chosen as File, null);
			return api<{ id: number }>(`/projects/${projectId}/reports`, { method: "POST", body: { type: "file", label, fileId: uploaded.id } });
		},
		onSuccess: async ({ id }) => {
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: projectReportsKey(projectId) }),
				queryClient.invalidateQueries({ queryKey: ["project-files", projectId] }),
			]);
			onCreated(id);
			onClose();
		},
	});
	const code = create.error instanceof ApiError ? create.error.code : "";
	return (
		<Modal title={t("pr.upload_report")} description={t("pr.upload_report_desc")} open onClose={onClose}>
			<div className="flex flex-col gap-3.5">
				{create.isError && <Alert>{t(SAVE_ERRORS[code] ?? "error.generic")}</Alert>}
				<Field label={t("pr.report_label")} placeholder={t("pr.report_label_placeholder")} maxLength={120} value={label} onChange={(event) => setLabel(event.target.value)} />
				<input ref={input} type="file" className="sr-only" aria-label={t("pr.choose_file")} accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.png,.jpg,.jpeg,.webp,.zip" onChange={(event) => setChosen(event.target.files?.[0] ?? null)} />
				<div className="flex items-center gap-2.5 rounded-[9px] border border-border p-2.5">
					<span className="min-w-0 flex-1 truncate text-sm">{chosen?.name ?? t("pr.no_file_chosen")}</span>
					<button type="button" className={buttonClass("outline", "min-h-8 px-3 py-0")} onClick={() => input.current?.click()}>{t("pr.choose_file")}</button>
				</div>
				<div className="flex justify-end gap-2">
					<button type="button" className={buttonClass("outline")} onClick={onClose}>{t("common.cancel")}</button>
					<button type="button" disabled={!label.trim() || !chosen || create.isPending} className={buttonClass()} onClick={() => create.mutate()}>{t("pr.create_report")}</button>
				</div>
			</div>
		</Modal>
	);
}

function NewPeriodDialog({ frequency, onClose, onChoose }: { frequency: string | null; onClose: () => void; onChoose: (period: string) => void }) {
	const { t } = useI18n();
	const [year] = useState(() => new Date().getFullYear());
	const [period, setPeriod] = useState("");
	const quarterly = frequency === "quarterly";
	return (
		<Modal title={t("pr.new_report")} open onClose={onClose}>
			<div className="flex flex-col gap-3.5">
				{quarterly ? (
					<SelectField label={t("pr.report_period")} value={period} onChange={(event) => setPeriod(event.target.value)}>
						<option value="">{t("cb.choose")}</option>
						{[year, year - 1].flatMap((value) => [4, 3, 2, 1].map((quarter) => <option key={`${value}-${quarter}`} value={`${value}-Q${quarter}`}>{`Q${quarter} ${value}`}</option>))}
					</SelectField>
				) : (
					<Field label={t("pr.report_period")} type="month" value={period} onChange={(event) => setPeriod(event.target.value)} />
				)}
				<div className="flex justify-end gap-2">
					<button type="button" className={buttonClass("outline")} onClick={onClose}>{t("common.cancel")}</button>
					<button type="button" disabled={!period} className={buttonClass()} onClick={() => onChoose(period)}>{t("pr.start_report")}</button>
				</div>
			</div>
		</Modal>
	);
}

type Selection = { reportId: number } | { period: string } | null;

export function ProjectReportsTab({ projectId }: { projectId: number }) {
	const { t, language } = useI18n();
	const queryClient = useQueryClient();
	const data = useProjectReports(projectId);
	const [selection, setSelection] = useState<Selection>(null);
	const [picking, setPicking] = useState(false);
	const [uploading, setUploading] = useState(false);
	const refresh = () => queryClient.invalidateQueries({ queryKey: projectReportsKey(projectId) });
	const lock = useMutation({ mutationFn: (id: number) => api(`/projects/${projectId}/reports/${id}/lock`, { method: "POST" }), onSuccess: refresh });
	const revise = useMutation({ mutationFn: (id: number) => api(`/projects/${projectId}/reports/${id}/revise`, { method: "POST" }), onSuccess: refresh });
	const remove = useMutation({
		mutationFn: (id: number) => api(`/projects/${projectId}/reports/${id}`, { method: "DELETE" }),
		onSuccess: async () => {
			setSelection(null);
			await refresh();
		},
	});
	if (data.isPending) return <PageLoading variant="inline" />;
	if (data.isError) return <PageError onRetry={() => data.refetch()} />;
	const { reports, schedule, canContribute, canManage, frequency, currency } = data.data;
	const missing = schedule.filter((item) => item.reportId === null);
	const approved = reports.filter((report) => report.status === "approved" || report.status === "locked").length;
	const overdue = schedule.filter((item) => item.overdue).length;
	const selected = selection && "reportId" in selection ? (reports.find((report) => report.id === selection.reportId) ?? null) : null;
	const newPeriod = selection && "period" in selection ? selection.period : null;
	const dueOf = (period: string) => schedule.find((item) => item.period === period);
	const titleOf = (report: ProjectReport) => report.label ?? periodLabel(report.period, language);
	const rowClass = (active: boolean) => `flex w-full flex-wrap items-center gap-x-3 gap-y-1 border-t border-l-[3px] border-t-border px-3.5 py-2.5 text-left first:border-t-0 ${active ? "border-l-primary bg-selected" : "border-l-transparent hover:bg-muted/50"}`;

	return (
		<div className="flex flex-col gap-3">
			<div className="flex flex-wrap items-center gap-2">
				<p className="mr-auto flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
					<span>{t("pr.workflow")}</span>
					{WORKFLOW.map((step, index) => (
						<span key={step} className="flex items-center gap-1.5">
							{index > 0 && <span aria-hidden="true">→</span>}
							<span className="rounded-full border border-border bg-card px-2 py-px font-medium text-foreground">{t(`pr.workflow_${step}`)}</span>
						</span>
					))}
				</p>
				{canContribute && (
					<>
						<button type="button" className={buttonClass("outline")} onClick={() => setUploading(true)}>
							<Upload size={15} aria-hidden="true" />
							{t("pr.upload_report")}
						</button>
						<button type="button" className={buttonClass()} onClick={() => setPicking(true)}>
							<Plus size={15} aria-hidden="true" />
							{t("pr.new_report")}
						</button>
					</>
				)}
			</div>
			<div className="grid items-start gap-3 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
				<section className="min-w-0 overflow-hidden rounded-card border border-border bg-card">
					<div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-3.5 py-3">
						<h3 className="text-[15px] font-semibold">{t("pr.register")}</h3>
						<span className="text-xs text-muted-foreground">{t("pr.register_summary", { approved, total: reports.length + missing.length, overdue })}</span>
					</div>
					{reports.length + missing.length === 0 ? (
						<p className="p-4 text-sm text-muted-foreground">{t("pr.register_empty")}</p>
					) : (
						<ul>
							{[
								...missing.map((item) => ({ sort: item.period, item, report: null as ProjectReport | null })),
								...reports.map((report) => ({ sort: report.period, item: null as ScheduleItem | null, report })),
							]
								.sort((a, b) => b.sort.localeCompare(a.sort))
								.map(({ item, report }) =>
									item ? (
										<li key={item.period}>
											<button type="button" disabled={!canContribute} className={rowClass(newPeriod === item.period)} onClick={() => setSelection({ period: item.period })}>
												<span className="min-w-0 flex-1">
													<span className="block font-semibold">{periodLabel(item.period, language)}</span>
													<span className="block text-xs text-muted-foreground">{t("pr.due_on", { date: shortDay(item.dueDate, language) })}</span>
												</span>
												<ReportChip status={item.overdue ? "overdue" : "due"} />
											</button>
										</li>
									) : report ? (
										<li key={report.id}>
											<button type="button" className={rowClass(selected?.id === report.id)} onClick={() => setSelection({ reportId: report.id })}>
												<span className="min-w-0 flex-1">
													<span className="block break-words font-semibold">{titleOf(report)}</span>
													<span className="block text-xs text-muted-foreground">
														{t(report.type === "file" ? "pr.type_file" : "pr.type_form")} · {report.authorName ?? "—"}
														{report.reviewerName && ` · ${t("cb.reviewer_is", { name: report.reviewerName })}`}
													</span>
												</span>
												<ReportChip status={report.status} />
											</button>
										</li>
									) : null,
								)}
						</ul>
					)}
					<p className="border-t border-border px-3.5 py-2.5 text-xs text-muted-foreground">
						{frequency === "monthly" ? t("pr.schedule_monthly") : frequency === "quarterly" ? t("pr.schedule_quarterly") : t("pr.schedule_none")} {t("pr.approved_only")}
					</p>
				</section>
				<section className="min-w-0 rounded-card border border-border bg-card p-4 md:p-5">
					{!selected && !newPeriod ? (
						<StatePanel icon={ClipboardList} title={t("pr.choose_report")} description={canContribute ? t("pr.choose_report_desc") : undefined} />
					) : (
						<div className="flex flex-col gap-3.5">
							<div className="flex flex-wrap items-start justify-between gap-2">
								<div className="min-w-0">
									<h3 className="break-words text-base font-semibold">{selected ? titleOf(selected) : periodLabel(newPeriod as string, language)}</h3>
									<p className="text-xs text-muted-foreground">
										{selected ? [selected.authorName, selected.revision > 1 ? t("pr.revision", { number: selected.revision }) : null].filter(Boolean).join(" · ") : t("pr.not_started")}
									</p>
								</div>
								{selected ? <ReportChip status={selected.status} /> : dueOf(newPeriod as string)?.overdue ? <ReportChip status="overdue" /> : null}
							</div>
							{selected?.reviewComment && (
								<p className={`rounded-md p-3 text-[13px] ${selected.status === "needs_revision" ? "border border-[#F59F0A] bg-warning-surface" : "bg-muted"}`}>
									<b>{selected.reviewerName}:</b> <span className="whitespace-pre-wrap break-words">{selected.reviewComment}</span>
								</p>
							)}
							{newPeriod || selected?.canChange ? (
								selected?.type === "file" ? (
									<>
										<ReportView report={selected} currency={currency} projectId={projectId} />
										<FileReportActions projectId={projectId} report={selected} />
									</>
								) : (
									<ReportForm
										key={selected?.period ?? newPeriod}
										projectId={projectId}
										report={selected}
										period={newPeriod ?? selected?.period ?? ""}
										currency={currency}
										onSaved={(id) => setSelection({ reportId: id })}
									/>
								)
							) : (
								selected && <ReportView report={selected} currency={currency} projectId={projectId} />
							)}
							{selected?.canReview && <ReviewBox projectId={projectId} report={selected} onDone={() => undefined} />}
							{selected && selected.status === "submitted" && !selected.canReview && <p className="text-[13px] text-muted-foreground">{t("pr.waiting_review")}</p>}
							{selected && (canManage || selected.canChange) && (
								<div className="flex flex-wrap justify-end gap-2 border-t border-border pt-3">
									{selected.status === "draft" && selected.canChange && (
										<button type="button" disabled={remove.isPending} className={buttonClass("ghost")} onClick={() => remove.mutate(selected.id)}>{t("common.delete")}</button>
									)}
									{selected.status === "approved" && canManage && (
										<>
											<button type="button" disabled={revise.isPending} className={buttonClass("outline")} onClick={() => revise.mutate(selected.id)}>{t("pr.start_revision")}</button>
											<button type="button" disabled={lock.isPending} className={buttonClass("outline")} onClick={() => lock.mutate(selected.id)}>
												<Lock size={14} aria-hidden="true" />
												{t("pr.lock")}
											</button>
										</>
									)}
								</div>
							)}
						</div>
					)}
				</section>
			</div>
			{picking && (
				<NewPeriodDialog
					frequency={frequency}
					onClose={() => setPicking(false)}
					onChoose={(period) => {
						const existing = reports.find((report) => report.type === "form" && report.period === period);
						setSelection(existing ? { reportId: existing.id } : { period });
						setPicking(false);
					}}
				/>
			)}
			{uploading && <FileReportDialog projectId={projectId} onClose={() => setUploading(false)} onCreated={(id) => setSelection({ reportId: id })} />}
		</div>
	);
}

function FileReportActions({ projectId, report }: { projectId: number; report: ProjectReport }) {
	const { t } = useI18n();
	const queryClient = useQueryClient();
	const submit = useMutation({
		mutationFn: () => api(`/projects/${projectId}/reports/${report.id}/submit`, { method: "POST" }),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: projectReportsKey(projectId) }),
	});
	return (
		<div className="flex justify-end">
			<button type="button" disabled={submit.isPending} className={buttonClass()} onClick={() => submit.mutate()}>{t("cb.submit")}</button>
		</div>
	);
}
