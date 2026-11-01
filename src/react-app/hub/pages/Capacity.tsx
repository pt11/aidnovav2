import { useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Award, Check, FileText, Lock, Plus, SearchX, Trash2, X } from "lucide-react";
import { Link, useLocation } from "wouter";
import { api, ApiError } from "../api";
import { useI18n } from "../i18n";
import {
	Alert,
	Avatar,
	buttonClass,
	ConfirmModal,
	DataTable,
	Field,
	FilePreviewDrawer,
	PageError,
	PageHeader,
	PageLoading,
	SearchField,
	Segmented,
	SelectField,
	StatePanel,
	TextareaField,
} from "../ui";

export type ReviewStatus = "draft" | "submitted" | "under_review" | "verified" | "changes_requested" | "rejected";
export type TrainingStatus = "applied" | "started" | "in_progress" | "completed" | "cancelled";

export interface TrainingRecord {
	id: number;
	title: string;
	category: string | null;
	isSensitive: boolean;
	format: "in_person" | "online" | "hybrid" | null;
	startDate: string | null;
	endDate: string | null;
	durationValue: number | null;
	durationUnit: "training_days" | "calendar_days" | "contact_hours";
	trainingStatus: TrainingStatus;
	applicationOutcome: "applied" | "accepted" | "waitlisted" | "declined" | null;
	objectives: string | null;
	provider: string | null;
	language: "my" | "en" | "both";
	locationMode: "withheld" | "region" | "online";
	region: string | null;
	reflection: string | null;
	shareReflection: boolean;
	reviewStatus: ReviewStatus;
	version: number;
	submittedAt: string | null;
	updatedAt: string;
}

export interface TrainingEvent {
	id: number;
	kind: string;
	message: string | null;
	privateNote: string | null;
	version: number;
	createdAt: string;
	actorId: string | null;
	actorName: string | null;
}

export interface Evidence {
	id: number;
	name: string;
	mimeType: string;
	sizeBytes: number;
	createdAt: string;
}

export interface RecordDetail {
	record: TrainingRecord;
	viewer: "owner" | "reviewer";
	canEdit: boolean;
	owner: { name: string; department: string | null };
	reviewers: string[];
	evidence: Evidence[];
	events: TrainingEvent[];
}

export interface CapacityMe {
	assessCount: number;
	reviewers: string[];
	inDepartment: boolean;
	canReview: boolean;
	reviewCount: number;
	isAdmin: boolean;
	reportScopes: string[];
}

export const CAPACITY_ME_KEY = ["capacity-me"];
const RECORDS_KEY = ["capacity-records"];
const CATEGORIES = [
	"leadership",
	"project_management",
	"meal",
	"finance",
	"digital",
	"safeguarding",
	"safety",
	"community",
	"health",
	"communication",
	"other",
];
const SENSITIVE = ["safeguarding", "safety"];
const REGIONS = [
	"Ayeyarwady",
	"Bago",
	"Chin",
	"Kachin",
	"Kayah",
	"Kayin",
	"Magway",
	"Mandalay",
	"Mon",
	"Naypyitaw",
	"Rakhine",
	"Sagaing",
	"Shan",
	"Tanintharyi",
	"Yangon",
	"Outside Myanmar",
];
const MAX_EVIDENCE_BYTES = 10 * 1024 * 1024;

export function useCapacityMe() {
	return useQuery({ queryKey: CAPACITY_ME_KEY, queryFn: () => api<CapacityMe>("/capacity/me") });
}

export function useRefreshCapacity() {
	const queryClient = useQueryClient();
	return () =>
		Promise.all(
			[RECORDS_KEY, CAPACITY_ME_KEY, ["capacity-record"], ["capacity-reviews"], ["capacity-report"]].map((queryKey) =>
				queryClient.invalidateQueries({ queryKey }),
			),
		);
}

const TRAINING_DOT: Record<TrainingStatus, string> = {
	applied: "bg-muted-foreground",
	started: "bg-primary",
	in_progress: "bg-primary",
	completed: "bg-[#22A076]",
	cancelled: "bg-input",
};

export function TrainingChip({ status }: { status: TrainingStatus }) {
	const { t } = useI18n();
	return (
		<span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-input bg-card px-2.5 py-px text-xs font-semibold">
			<span aria-hidden="true" className={`size-2 rounded-full ${TRAINING_DOT[status]}`} />
			{t(`cb.training_${status}`)}
		</span>
	);
}

const REVIEW_LOOK: Record<ReviewStatus, { icon: string; className: string }> = {
	draft: { icon: "✎", className: "bg-muted text-foreground" },
	submitted: { icon: "↑", className: "bg-selected text-selected-foreground" },
	under_review: { icon: "◔", className: "bg-selected text-selected-foreground" },
	verified: { icon: "✓", className: "bg-[#14795A] text-white" },
	changes_requested: { icon: "↺", className: "border border-[#F59F0A] bg-warning-surface text-foreground" },
	rejected: { icon: "✕", className: "border border-destructive bg-danger-surface text-danger-foreground" },
};

export function ReviewChip({ status }: { status: ReviewStatus }) {
	const { t } = useI18n();
	const look = REVIEW_LOOK[status];
	return (
		<span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-px text-xs font-semibold ${look.className}`}>
			<span aria-hidden="true">{look.icon}</span>
			{t(`cb.review_${status}`)}
		</span>
	);
}

export function SensitiveChip() {
	const { t } = useI18n();
	return (
		<span className="inline-flex whitespace-nowrap rounded-full border border-accent bg-card px-2 py-px text-xs font-semibold">
			{t("cb.sensitive")}
		</span>
	);
}

export function LockNote({ children }: { children: ReactNode }) {
	return (
		<p className="flex items-start gap-2 rounded-md bg-selected px-3 py-2 text-xs leading-[18px]">
			<Lock size={14} aria-hidden="true" className="mt-0.5 shrink-0 text-selected-foreground" />
			<span>{children}</span>
		</p>
	);
}

function shortDate(value: string, language: string, withYear = true) {
	return new Date(`${value}T00:00:00Z`).toLocaleDateString(language, {
		day: "numeric",
		month: "short",
		year: withYear ? "numeric" : undefined,
		timeZone: "UTC",
	});
}

export function dateRange(record: TrainingRecord, language: string) {
	if (!record.startDate) return "—";
	if (!record.endDate || record.endDate === record.startDate) return shortDate(record.startDate, language);
	return `${shortDate(record.startDate, language, false)} – ${shortDate(record.endDate, language)}`;
}

export function durationText(record: TrainingRecord, t: ReturnType<typeof useI18n>["t"]) {
	if (record.durationValue === null) return "—";
	return t(`cb.duration_${record.durationUnit}`, { count: record.durationValue });
}

export function trainingMeta(record: TrainingRecord, t: ReturnType<typeof useI18n>["t"]) {
	const place =
		record.locationMode === "region" && record.region
			? record.region
			: record.locationMode === "withheld" && record.format !== "online"
				? t("cb.location_withheld_short")
				: null;
	return [
		record.category ? t(`cb.cat_${record.category}`) : null,
		record.format ? t(`cb.format_${record.format}`) : null,
		place,
	]
		.filter(Boolean)
		.join(" · ");
}

function Stat({ label, value, note, alert = false }: { label: string; value: string | number; note: string; alert?: boolean }) {
	return (
		<div className={`rounded-card border bg-card p-4 ${alert ? "border-[#F59F0A]" : "border-border"}`}>
			<dt className="text-[13px] text-muted-foreground">{label}</dt>
			<dd className="mt-1 text-2xl font-semibold tracking-tight">{value}</dd>
			<dd className="mt-0.5 text-xs text-muted-foreground">{note}</dd>
		</div>
	);
}

const FILTERS = ["all", "current", "planned", "completed"] as const;
type Filter = (typeof FILTERS)[number];

function inFilter(record: TrainingRecord, filter: Filter) {
	if (filter === "current") return record.trainingStatus === "started" || record.trainingStatus === "in_progress";
	if (filter === "planned") return record.trainingStatus === "applied";
	if (filter === "completed") return record.trainingStatus === "completed";
	return true;
}

export function MyTrainingPage() {
	const { t, language } = useI18n();
	const [filter, setFilter] = useState<Filter>("all");
	const [search, setSearch] = useState("");
	const [year] = useState(() => String(new Date().getFullYear()));
	const me = useCapacityMe();
	const records = useQuery({
		queryKey: RECORDS_KEY,
		queryFn: () => api<{ records: (TrainingRecord & { evidenceCount: number })[] }>("/capacity/records"),
		select: (data) => data.records,
	});

	if (records.isPending || me.isPending) return <PageLoading />;
	if (records.isError || me.isError) return <PageError onRetry={() => records.refetch()} />;

	const all = records.data;
	const text = search.trim().toLowerCase();
	const visible = all.filter((record) => inFilter(record, filter) && (!text || record.title.toLowerCase().includes(text)));
	// Only verified, finished training counts in anything official.
	const verified = all.filter((record) => record.reviewStatus === "verified" && record.trainingStatus === "completed");
	const thisYear = verified.filter((record) => record.endDate?.startsWith(year)).length;
	const waiting = all.filter((record) => record.reviewStatus === "submitted" || record.reviewStatus === "under_review").length;
	const changes = all.filter((record) => record.reviewStatus === "changes_requested").length;
	const drafts = all.filter((record) => record.reviewStatus === "draft").length;
	const add = (unit: TrainingRecord["durationUnit"]) =>
		verified.filter((record) => record.durationUnit === unit).reduce((total, record) => total + (record.durationValue ?? 0), 0);
	const reviewers = me.data.reviewers.join(", ");

	return (
		<div className="flex flex-col gap-4 p-4 md:px-6 md:py-7">
			<PageHeader
				title={t("cb.my_training")}
				subtitle={t("cb.my_training_desc")}
				action={
					<div className="flex flex-wrap gap-2">
						{me.data.canReview && (
							<Link href="/capacity/reviews" className={buttonClass("outline", "lg:hidden")}>
								{t("cb.reviews")}
								{me.data.reviewCount > 0 && ` · ${me.data.reviewCount}`}
							</Link>
						)}
						<Link href="/capacity/report" className={buttonClass()}>
							<Plus size={16} aria-hidden="true" />
							{t("cb.report_training")}
						</Link>
					</div>
				}
			/>
			<LockNote>
				{reviewers ? t("cb.private_note", { reviewers }) : t("cb.private_note_none")} {t("cb.private_note_2")}
			</LockNote>
			{all.length === 0 ? (
				<StatePanel
					icon={Award}
					title={t("cb.empty_title")}
					description={t("cb.empty_desc")}
					action={
						<Link href="/capacity/report" className={buttonClass()}>
							{t("cb.report_training")}
						</Link>
					}
				/>
			) : (
				<>
					<dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
						<Stat label={t("cb.stat_verified")} value={thisYear} note={t("cb.stat_this_year")} />
						<Stat label={t("cb.stat_waiting")} value={waiting} note={t("cb.stat_waiting_note")} />
						<Stat
							label={t("cb.stat_action")}
							value={changes + drafts}
							note={t("cb.stat_action_note", { changes, drafts })}
							alert={changes + drafts > 0}
						/>
						<Stat
							label={t("cb.stat_time")}
							value={t("cb.stat_time_value", { days: add("training_days"), hours: add("contact_hours") })}
							note={t("cb.stat_time_note")}
						/>
					</dl>
					<div className="flex flex-wrap items-center gap-2.5">
						<Segmented
							label={t("cb.filter")}
							options={FILTERS.map((value) => ({
								value,
								label: `${t(`cb.filter_${value}`)} ${all.filter((record) => inFilter(record, value)).length}`,
							}))}
							value={filter}
							onChange={setFilter}
						/>
						<SearchField label={t("cb.search")} value={search} onChange={setSearch} className="min-w-52 flex-1" />
					</div>
					{visible.length === 0 ? (
						<StatePanel icon={SearchX} title={t("cb.no_results")} />
					) : (
						<DataTable
							minWidth={860}
							head={[t("cb.col_training"), t("cb.col_when"), t("cb.col_training_status"), t("cb.col_review_status"), t("cb.col_evidence"), t("cb.col_action")]}
						>
							{visible.map((record) => {
								const editing = record.reviewStatus === "draft" || record.reviewStatus === "changes_requested";
								const action = record.reviewStatus === "draft" ? "cb.continue" : record.reviewStatus === "changes_requested" ? "cb.fix_resubmit" : "cb.open";
								return (
									<tr key={record.id}>
										<td className="px-3 py-3 first:pl-4">
											<span className="flex flex-wrap items-center gap-2 font-semibold">
												<Link href={`/capacity/records/${record.id}`} className="break-words text-foreground no-underline hover:underline">
													{record.title}
												</Link>
												{record.isSensitive && <SensitiveChip />}
											</span>
											<span className="block text-xs text-muted-foreground">{trainingMeta(record, t)}</span>
										</td>
										<td className="px-3 py-3">
											<span className="block whitespace-nowrap">{dateRange(record, language)}</span>
											<span className="block text-xs text-muted-foreground">{durationText(record, t)}</span>
										</td>
										<td className="px-3 py-3"><TrainingChip status={record.trainingStatus} /></td>
										<td className="px-3 py-3"><ReviewChip status={record.reviewStatus} /></td>
										<td className="px-3 py-3 text-muted-foreground">
											{record.evidenceCount > 0 ? t("cb.evidence_count", { count: record.evidenceCount }) : "—"}
										</td>
										<td className="px-3 py-3 last:pr-4">
											<Link
												href={editing ? `/capacity/records/${record.id}/edit` : `/capacity/records/${record.id}`}
												className="whitespace-nowrap font-medium text-selected-foreground"
											>
												{t(action)}
											</Link>
										</td>
									</tr>
								);
							})}
						</DataTable>
					)}
					<section className="rounded-card border border-border bg-card p-4 text-[13px]">
						<div className="flex flex-wrap gap-x-8 gap-y-3">
							<div>
								<h2 className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{t("cb.legend_training")}</h2>
								<div className="flex flex-wrap gap-1.5">
									{(["applied", "started", "in_progress", "completed", "cancelled"] as const).map((status) => (
										<TrainingChip key={status} status={status} />
									))}
								</div>
							</div>
							<div>
								<h2 className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{t("cb.legend_review")}</h2>
								<div className="flex flex-wrap gap-1.5">
									{(["draft", "submitted", "under_review", "verified", "changes_requested", "rejected"] as const).map((status) => (
										<ReviewChip key={status} status={status} />
									))}
								</div>
							</div>
						</div>
						<p className="mt-3 text-muted-foreground">{t("cb.legend_note")}</p>
					</section>
				</>
			)}
		</div>
	);
}

interface FormValues {
	title: string;
	category: string;
	format: string;
	startDate: string;
	endDate: string;
	durationValue: string;
	durationUnit: string;
	trainingStatus: string;
	applicationOutcome: string;
	objectives: string;
	provider: string;
	language: string;
	locationMode: string;
	region: string;
	reflection: string;
	shareReflection: boolean;
}

function formFrom(record?: TrainingRecord): FormValues {
	return {
		title: record?.title ?? "",
		category: record?.category ?? "",
		format: record?.format ?? "",
		startDate: record?.startDate ?? "",
		endDate: record?.endDate ?? "",
		durationValue: record?.durationValue != null ? String(record.durationValue) : "",
		durationUnit: record?.durationUnit ?? "training_days",
		trainingStatus: record?.trainingStatus ?? "completed",
		applicationOutcome: record?.applicationOutcome ?? "applied",
		objectives: record?.objectives ?? "",
		provider: record?.provider ?? "",
		language: record?.language ?? "my",
		locationMode: record?.locationMode === "region" ? "region" : "withheld",
		region: record?.region ?? "",
		reflection: record?.reflection ?? "",
		shareReflection: record?.shareReflection ?? false,
	};
}

function FormSection({
	id,
	number,
	title,
	privateToMe = false,
	children,
}: {
	id: string;
	number: number;
	title: string;
	privateToMe?: boolean;
	children: ReactNode;
}) {
	const { t } = useI18n();
	return (
		<section id={id} className="scroll-mt-20 rounded-card border border-border bg-card p-4 md:p-5">
			<div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
				<h2 className="text-base font-semibold">
					{number}. {title}
				</h2>
				<span className="rounded-full bg-muted px-2.5 py-px text-xs font-medium text-muted-foreground">
					{t(privateToMe ? "cb.only_me" : "cb.me_reviewers")}
				</span>
			</div>
			<div className="flex flex-col gap-3.5">{children}</div>
		</section>
	);
}

const SAVE_ERRORS: Record<string, string> = {
	END_BEFORE_START: "cb.end_before_start",
	INVALID_TITLE: "cb.title_required",
	TOO_LONG: "cb.too_long",
	INVALID_DURATION: "cb.invalid_duration",
	LOCKED: "cb.locked",
};
const UPLOAD_ERRORS: Record<string, string> = {
	TYPE_NOT_ALLOWED: "cb.file_type",
	FILE_TOO_LARGE: "cb.file_big",
	STORAGE_FULL: "files.storage_full",
	TOO_MANY_FILES: "cb.file_many",
};

export function ReportTrainingPage({ id }: { id?: string }) {
	const detail = useQuery({
		queryKey: ["capacity-record", id],
		queryFn: () => api<RecordDetail>(`/capacity/records/${id}`),
		enabled: !!id,
		retry: false,
	});
	const { t } = useI18n();
	if (id && detail.isPending) return <PageLoading />;
	if (id && detail.isError) {
		return <StatePanel icon={SearchX} title={t("cb.not_found")} action={<Link href="/capacity" className={buttonClass("outline")}>{t("cb.back")}</Link>} />;
	}
	return <ReportForm key={id ?? "new"} initial={detail.data} />;
}

function ReportForm({ initial }: { initial?: RecordDetail }) {
	const { t } = useI18n();
	const [, navigate] = useLocation();
	const refresh = useRefreshCapacity();
	const me = useCapacityMe();
	const fileInput = useRef<HTMLInputElement>(null);
	const [recordId, setRecordId] = useState<number | null>(initial?.record.id ?? null);
	const [form, setForm] = useState(() => formFrom(initial?.record));
	const [note, setNote] = useState("");
	const [missing, setMissing] = useState<string[]>([]);
	const [saved, setSaved] = useState(false);
	const [error, setError] = useState("");
	const [uploadError, setUploadError] = useState("");
	const [evidence, setEvidence] = useState<Evidence[]>(initial?.evidence ?? []);
	const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) => {
		setSaved(false);
		setForm((current) => ({ ...current, [key]: value }));
	};

	const sensitive = SENSITIVE.includes(form.category);
	const online = form.format === "online";
	const endBeforeStart = !!form.startDate && !!form.endDate && form.endDate < form.startDate;
	const sentBack = initial?.record.reviewStatus === "changes_requested";
	const lastRequest = sentBack ? [...(initial?.events ?? [])].reverse().find((event) => event.kind === "changes_requested") : undefined;

	const save = async () => {
		const body = { ...form, durationValue: form.durationValue === "" ? null : Number(form.durationValue) };
		if (recordId) {
			await api(`/capacity/records/${recordId}`, { method: "PUT", body });
			return recordId;
		}
		const created = await api<{ id: number }>("/capacity/records", { method: "POST", body });
		setRecordId(created.id);
		return created.id;
	};
	const onFail = (failure: unknown) => {
		const code = failure instanceof ApiError ? failure.code : "";
		setError(SAVE_ERRORS[code] ?? "error.generic");
	};
	const draft = useMutation({
		mutationFn: save,
		onMutate: () => setError(""),
		onSuccess: async () => {
			setSaved(true);
			await refresh();
		},
		onError: onFail,
	});
	const submit = useMutation({
		mutationFn: async () => {
			const id = await save();
			const response = await fetch(`/api/capacity/records/${id}/submit`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ note }),
			});
			if (!response.ok) {
				const data = (await response.json().catch(() => null)) as { code?: string; message?: string; missing?: string[] } | null;
				setMissing(data?.missing ?? []);
				throw new ApiError(response.status, data?.code ?? "UNKNOWN", data?.message ?? "");
			}
			return id;
		},
		onMutate: () => {
			setError("");
			setMissing([]);
		},
		onSuccess: async (id) => {
			await refresh();
			navigate(`/capacity/records/${id}`);
		},
		onError: (failure) => {
			if (failure instanceof ApiError && failure.code === "INCOMPLETE") setError("cb.incomplete");
			else onFail(failure);
		},
	});
	const upload = useMutation({
		mutationFn: async (files: File[]) => {
			const id = await save();
			for (const file of files) {
				if (file.size > MAX_EVIDENCE_BYTES) throw new ApiError(413, "FILE_TOO_LARGE", "");
				const response = await fetch(`/api/capacity/records/${id}/evidence?${new URLSearchParams({ name: file.name })}`, {
					method: "POST",
					body: file,
				});
				if (!response.ok) {
					const data = (await response.json().catch(() => null)) as { code?: string } | null;
					throw new ApiError(response.status, data?.code ?? "UNKNOWN", "");
				}
			}
			return api<RecordDetail>(`/capacity/records/${id}`);
		},
		onMutate: () => setUploadError(""),
		onSuccess: async (data) => {
			setEvidence(data.evidence);
			await refresh();
		},
		onError: (failure) => {
			const code = failure instanceof ApiError ? failure.code : "";
			setUploadError(UPLOAD_ERRORS[code] ?? SAVE_ERRORS[code] ?? "cb.file_failed");
		},
	});
	const removeFile = useMutation({
		mutationFn: (fileId: number) => api(`/capacity/records/${recordId}/evidence/${fileId}`, { method: "DELETE" }),
		onSuccess: (_, fileId) => setEvidence((current) => current.filter((file) => file.id !== fileId)),
	});

	const steps = [
		{ id: "what", done: !!form.title && !!form.category && !!form.format },
		{ id: "when", done: !!form.startDate && !!form.endDate && !!form.durationValue && !endBeforeStart },
		{ id: "where", done: !!form.trainingStatus },
		{ id: "details", done: !!form.objectives },
		{ id: "gained", done: !!form.reflection },
		{ id: "evidence", done: evidence.length > 0 },
	];
	// A field stops being marked as soon as it's filled in.
	const filled: Record<string, string> = {
		category: form.category,
		format: form.format,
		startDate: form.startDate,
		endDate: form.endDate,
		duration: form.durationValue,
		objectives: form.objectives,
	};
	const needs = (field: string) => (missing.includes(field) && !filled[field] ? t("cb.required") : undefined);
	const busy = draft.isPending || submit.isPending || upload.isPending;
	const reviewer = me.data?.reviewers.join(", ");

	return (
		<div className="flex min-h-full flex-col">
			<div className="flex-1 p-4 md:px-6 md:py-7">
				<PageHeader title={t("cb.report_training")} subtitle={t("cb.report_desc")} />
				<div className="mt-4 grid items-start gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
					<aside className="flex flex-col gap-3 max-lg:hidden lg:sticky lg:top-4">
						<nav aria-label={t("cb.report_training")} className="rounded-card border border-border bg-card p-2">
							<ul className="flex flex-col gap-0.5 text-[13px]">
								{steps.map((step) => (
									<li key={step.id}>
										<a
											href={`#${step.id}`}
											onClick={(event) => {
												event.preventDefault();
												document.getElementById(step.id)?.scrollIntoView({ behavior: "smooth" });
											}}
											className="flex items-center gap-2 rounded px-2 py-1.5 text-foreground no-underline hover:bg-muted"
										>
											<span aria-hidden="true" className={`grid size-4 shrink-0 place-items-center rounded-full border ${step.done ? "border-[#14795A] bg-[#14795A] text-white" : "border-input"}`}>
												{step.done && <Check size={11} strokeWidth={3} />}
											</span>
											{t(`cb.step_${step.id}`)}
										</a>
									</li>
								))}
							</ul>
						</nav>
						<div className="rounded-card border border-border bg-card p-3 text-xs leading-[18px] text-muted-foreground">
							<p className="mb-1 font-semibold text-foreground">{t("cb.who_sees")}</p>
							<p>{t("cb.who_sees_only_me")}</p>
							<p>{t("cb.who_sees_reviewers")}</p>
							<p className="mt-1.5">{t("cb.who_sees_never")}</p>
						</div>
					</aside>
					<div className="flex min-w-0 flex-col gap-4">
						{lastRequest && (
							<div className="rounded-card border border-[#F59F0A] bg-warning-surface p-4 text-sm">
								<p className="font-semibold">{t("cb.reviewer_asked", { name: lastRequest.actorName ?? "" })}</p>
								<p className="mt-1 whitespace-pre-wrap break-words">{lastRequest.message}</p>
							</div>
						)}
						<FormSection id="what" number={1} title={t("cb.step_what")}>
							<Field label={t("cb.field_title")} required maxLength={200} value={form.title} onChange={(event) => set("title", event.target.value)} />
							<SelectField label={t("cb.field_category")} value={form.category} onChange={(event) => set("category", event.target.value)}>
								<option value="">{t("cb.choose")}</option>
								{CATEGORIES.map((value) => (
									<option key={value} value={value}>{t(`cb.cat_${value}`)}</option>
								))}
							</SelectField>
							{needs("category") && <p className="text-xs text-danger-foreground">{needs("category")}</p>}
							{sensitive && (
								<p className="rounded-md border border-accent p-3 text-[13px] leading-5">
									<b>{t("cb.sensitive")}.</b> {t("cb.sensitive_note")}
								</p>
							)}
							<fieldset>
								<legend className="mb-1.5 text-sm font-medium">{t("cb.field_format")}</legend>
								<div className="flex flex-wrap gap-4 text-sm">
									{(["in_person", "online", "hybrid"] as const).map((value) => (
										<label key={value} className="flex items-center gap-2">
											<input type="radio" name="format" className="size-4 accent-primary" checked={form.format === value} onChange={() => set("format", value)} />
											{t(`cb.format_${value}`)}
										</label>
									))}
								</div>
								{needs("format") && <p className="mt-1 text-xs text-danger-foreground">{needs("format")}</p>}
							</fieldset>
						</FormSection>
						<FormSection id="when" number={2} title={t("cb.step_when")}>
							<div className="grid gap-3.5 sm:grid-cols-2">
								<Field label={t("cb.field_start")} type="date" value={form.startDate} error={needs("startDate")} onChange={(event) => set("startDate", event.target.value)} />
								<Field label={t("cb.field_end")} type="date" value={form.endDate} error={endBeforeStart ? t("cb.end_before_start") : needs("endDate")} onChange={(event) => set("endDate", event.target.value)} />
							</div>
							<div className="grid gap-3.5 sm:grid-cols-2">
								<Field label={t("cb.field_duration")} type="number" min="0.5" step="0.5" value={form.durationValue} error={needs("duration")} onChange={(event) => set("durationValue", event.target.value)} />
								<SelectField label={t("cb.field_unit")} value={form.durationUnit} onChange={(event) => set("durationUnit", event.target.value)}>
									{(["training_days", "calendar_days", "contact_hours"] as const).map((value) => (
										<option key={value} value={value}>{t(`cb.unit_${value}`)}</option>
									))}
								</SelectField>
							</div>
							<p className="text-xs text-muted-foreground">{t("cb.duration_hint")}</p>
						</FormSection>
						<FormSection id="where" number={3} title={t("cb.step_where")}>
							<SelectField label={t("cb.col_training_status")} value={form.trainingStatus} onChange={(event) => set("trainingStatus", event.target.value)}>
								{(["applied", "started", "in_progress", "completed", "cancelled"] as const).map((value) => (
									<option key={value} value={value}>{t(`cb.training_${value}`)}</option>
								))}
							</SelectField>
							{form.trainingStatus === "applied" && (
								<SelectField label={t("cb.field_outcome")} value={form.applicationOutcome} onChange={(event) => set("applicationOutcome", event.target.value)}>
									{(["applied", "accepted", "waitlisted", "declined"] as const).map((value) => (
										<option key={value} value={value}>{t(`cb.outcome_${value}`)}</option>
									))}
								</SelectField>
							)}
						</FormSection>
						<FormSection id="details" number={4} title={t("cb.step_details")}>
							<TextareaField label={t("cb.field_objectives")} rows={3} maxLength={2000} value={form.objectives} onChange={(event) => set("objectives", event.target.value)} />
							{needs("objectives") && <p className="text-xs text-danger-foreground">{needs("objectives")}</p>}
							{!sensitive && (
								<Field label={t("cb.field_provider")} hint={t("cb.optional")} maxLength={200} value={form.provider} onChange={(event) => set("provider", event.target.value)} />
							)}
							<SelectField label={t("cb.field_language")} value={form.language} onChange={(event) => set("language", event.target.value)}>
								{(["my", "en", "both"] as const).map((value) => (
									<option key={value} value={value}>{t(`cb.language_${value}`)}</option>
								))}
							</SelectField>
							{!sensitive && !online && (
								<fieldset>
									<legend className="text-sm font-medium">{t("cb.field_location")}</legend>
									<p className="mb-2 text-xs text-muted-foreground">{t("cb.location_hint")}</p>
									<div className="flex flex-col gap-2 text-sm">
										<label className="flex items-center gap-2">
											<input type="radio" name="location" className="size-4 accent-primary" checked={form.locationMode === "withheld"} onChange={() => set("locationMode", "withheld")} />
											{t("cb.location_withheld")}
										</label>
										<label className="flex items-center gap-2">
											<input type="radio" name="location" className="size-4 accent-primary" checked={form.locationMode === "region"} onChange={() => set("locationMode", "region")} />
											{t("cb.location_region")}
										</label>
										{form.locationMode === "region" && (
											<SelectField label={t("cb.field_region")} value={form.region} onChange={(event) => set("region", event.target.value)}>
												<option value="">{t("cb.choose")}</option>
												{REGIONS.map((value) => (
													<option key={value} value={value}>{value}</option>
												))}
											</SelectField>
										)}
									</div>
								</fieldset>
							)}
							<p className="text-xs text-muted-foreground">{t("cb.no_gps")}</p>
						</FormSection>
						<FormSection id="gained" number={5} title={t("cb.step_gained")} privateToMe={!form.shareReflection}>
							<TextareaField label={t("cb.field_reflection")} rows={3} maxLength={2000} value={form.reflection} onChange={(event) => set("reflection", event.target.value)} />
							<label className="flex items-center gap-2 text-sm">
								<input type="checkbox" className="size-4 accent-primary" checked={form.shareReflection} onChange={(event) => set("shareReflection", event.target.checked)} />
								{t("cb.share_reflection")}
							</label>
						</FormSection>
						<FormSection id="evidence" number={6} title={t("cb.step_evidence")}>
							{uploadError && <Alert>{t(uploadError)}</Alert>}
							{evidence.length > 0 && (
								<ul className="flex flex-col gap-2">
									{evidence.map((file) => (
										<li key={file.id} className="flex items-center gap-3 rounded-[9px] border border-border p-2.5">
											<FileText size={18} aria-hidden="true" className="shrink-0 text-muted-foreground" />
											<span className="min-w-0 flex-1 break-words text-sm">{file.name}</span>
											<button
												type="button"
												aria-label={t("cb.remove_file", { name: file.name })}
												className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted"
												onClick={() => removeFile.mutate(file.id)}
											>
												<X size={16} aria-hidden="true" />
											</button>
										</li>
									))}
								</ul>
							)}
							<input
								ref={fileInput}
								type="file"
								multiple
								accept=".pdf,.jpg,.jpeg,.png"
								className="sr-only"
								aria-label={t("cb.upload")}
								onChange={(event) => {
									const files = [...(event.target.files ?? [])];
									event.target.value = "";
									if (files.length) upload.mutate(files);
								}}
							/>
							<div>
								<button type="button" disabled={upload.isPending || !form.title.trim()} className={buttonClass("outline")} onClick={() => fileInput.current?.click()}>
									{t(upload.isPending ? "cb.uploading" : "cb.upload")}
								</button>
							</div>
							<p className="text-xs text-muted-foreground">{t("cb.upload_hint")}</p>
						</FormSection>
						{initial && initial.record.version > 0 && (
							<section className="rounded-card border border-border bg-card p-4 md:p-5">
								<TextareaField label={t("cb.field_note")} hint={t("cb.field_note_hint")} rows={2} maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} />
							</section>
						)}
					</div>
				</div>
			</div>
			<div className="sticky bottom-0 z-10 border-t border-border bg-card px-4 py-3 md:px-6">
				{error && (
					<div className="mb-2.5">
						<Alert>{t(error)}</Alert>
					</div>
				)}
				<div className="flex flex-wrap items-center justify-end gap-2">
					<p role="status" className="mr-auto text-[13px] text-muted-foreground max-sm:w-full">
						{saved && `${t("cb.draft_saved")} · `}
						{reviewer ? t("cb.reviewer_is", { name: reviewer }) : t("cb.no_reviewer_short")}
					</p>
					<Link href="/capacity" className={buttonClass("ghost", "max-sm:hidden")}>{t("common.cancel")}</Link>
					<button type="button" disabled={busy || !form.title.trim()} className={buttonClass("outline", "max-sm:flex-1")} onClick={() => draft.mutate()}>
						{t("cb.save_draft")}
					</button>
					<button type="button" disabled={busy || !form.title.trim() || endBeforeStart} className={buttonClass("primary", "max-sm:flex-1")} onClick={() => submit.mutate()}>
						{t(initial && initial.record.version > 0 ? "cb.resubmit" : "cb.submit")}
					</button>
				</div>
			</div>
		</div>
	);
}

function Steps({ title, steps, note }: { title: string; steps: { label: string; done: boolean; current: boolean }[]; note?: string }) {
	return (
		<div className="min-w-0 flex-[1_1_360px]">
			<h2 className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{title}</h2>
			<ol className="flex flex-wrap items-start gap-y-2">
				{steps.map((step) => (
					<li key={step.label} className="flex min-w-[72px] flex-1 flex-col items-center gap-1 text-center text-xs">
						<span
							aria-hidden="true"
							className={`grid size-6 place-items-center rounded-full border-2 text-white ${
								step.done ? "border-[#14795A] bg-[#14795A]" : step.current ? "border-primary bg-primary" : "border-input bg-card"
							}`}
						>
							{step.done && <Check size={13} strokeWidth={3} />}
						</span>
						<span className={step.current ? "font-semibold" : ""}>{step.label}</span>
					</li>
				))}
			</ol>
			{note && <p className="mt-1.5 text-xs text-muted-foreground">{note}</p>}
		</div>
	);
}

export function TrainingFacts({ data }: { data: RecordDetail }) {
	const { t } = useI18n();
	const { record } = data;
	const row = (label: string, value: ReactNode) => (
		<div className="contents" key={label}>
			<dt className="text-muted-foreground">{label}</dt>
			<dd className="min-w-0 whitespace-pre-wrap break-words">{value}</dd>
		</div>
	);
	const hidden = <i className="text-muted-foreground">{t("cb.not_shared")}</i>;
	return (
		<dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[170px_minmax(0,1fr)]">
			{row(t("cb.field_objectives"), record.objectives ?? "—")}
			{row(t("cb.field_provider"), record.provider ?? hidden)}
			{row(
				t("cb.field_location"),
				record.locationMode === "region" && record.region
					? record.region
					: record.format === "online"
						? t("cb.format_online")
						: t("cb.location_withheld"),
			)}
			{row(t("cb.field_language"), t(`cb.language_${record.language}`))}
			{record.applicationOutcome && row(t("cb.field_outcome"), t(`cb.outcome_${record.applicationOutcome}`))}
			{(data.viewer === "owner" || record.shareReflection) &&
				row(
					t("cb.field_reflection"),
					<>
						{record.reflection ?? "—"}
						{data.viewer === "owner" && record.reflection && (
							<span className="ml-1 text-xs text-muted-foreground">({t(record.shareReflection ? "cb.shared_with_reviewer" : "cb.only_me")})</span>
						)}
					</>,
				)}
		</dl>
	);
}

const EVENT_CHIP: Record<string, ReviewStatus> = {
	submitted: "submitted",
	verified: "verified",
	changes_requested: "changes_requested",
	rejected: "rejected",
};

export function MessagesPanel({ data }: { data: RecordDetail }) {
	const { t, language } = useI18n();
	const refresh = useRefreshCapacity();
	const [text, setText] = useState("");
	const send = useMutation({
		mutationFn: () => api(`/capacity/records/${data.record.id}/messages`, { method: "POST", body: { message: text } }),
		onSuccess: async () => {
			setText("");
			await refresh();
		},
	});
	const when = (value: string) => new Date(value).toLocaleDateString(language, { day: "numeric", month: "short" });
	return (
		<section aria-label={t("cb.messages")} className="flex min-w-0 flex-col rounded-card border border-border bg-card">
			<div className="border-b border-border px-4 py-3.5">
				<h2 className="text-[15px] font-semibold">{t(data.viewer === "owner" ? "cb.messages" : "cb.messages_reviewer", { name: data.owner.name })}</h2>
				<p className="text-xs text-muted-foreground">{t("cb.messages_private")}</p>
			</div>
			<ol className="flex flex-col gap-3.5 px-4 py-3.5 text-[13px]">
				{data.events.length === 0 && <li className="text-muted-foreground">{t("cb.messages_empty")}</li>}
				{data.events.map((event) => {
					if (event.message || EVENT_CHIP[event.kind]) {
						const name = event.actorName ?? "";
						return (
							<li key={event.id} className="flex gap-2.5">
								<Avatar name={name} size={28} />
								<div className="min-w-0 flex-1">
									<b>{name}</b> <span className="text-muted-foreground">· {when(event.createdAt)}</span>
									{event.message && <p className="mt-1 whitespace-pre-wrap break-words rounded-[3px_9px_9px_9px] bg-muted px-2.5 py-2">{event.message}</p>}
									{EVENT_CHIP[event.kind] && (
										<p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
											<ReviewChip status={EVENT_CHIP[event.kind]} />
											{t("cb.version", { version: event.version })}
										</p>
									)}
									{event.privateNote && (
										<p className="mt-1 rounded-md border border-dashed border-input px-2.5 py-1.5 text-xs">
											<b>{t("cb.private_reviewer_note")}:</b> {event.privateNote}
										</p>
									)}
								</div>
							</li>
						);
					}
					return (
						<li key={event.id} className="flex gap-2.5 text-muted-foreground">
							<span aria-hidden="true" className="w-7 shrink-0 text-center">◔</span>
							<span>{t(`cb.event_${event.kind}`, { name: event.actorName ?? "" })} · {when(event.createdAt)}</span>
						</li>
					);
				})}
			</ol>
			{data.record.reviewStatus !== "draft" && (
				<form
					className="mt-auto flex gap-2 border-t border-border px-4 py-3"
					onSubmit={(event) => {
						event.preventDefault();
						if (text.trim()) send.mutate();
					}}
				>
					<label className="min-w-0 flex-1">
						<span className="sr-only">{t("cb.message")}</span>
						<input
							value={text}
							maxLength={2000}
							placeholder={t("cb.message_placeholder")}
							className="h-10 w-full rounded-md border border-input bg-card px-3"
							onChange={(event) => setText(event.target.value)}
						/>
					</label>
					<button type="submit" disabled={!text.trim() || send.isPending} className={buttonClass()}>
						{t("hub.assistant_send")}
					</button>
				</form>
			)}
		</section>
	);
}

export function evidenceUrl(recordId: number, fileId: number, download = false) {
	return `/api/capacity/records/${recordId}/evidence/${fileId}${download ? "?download=1" : ""}`;
}

export function fileSize(bytes: number) {
	return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function TrainingDetailPage({ id }: { id: string }) {
	const { t, language } = useI18n();
	const [, navigate] = useLocation();
	const refresh = useRefreshCapacity();
	const [deleting, setDeleting] = useState(false);
	const [previewing, setPreviewing] = useState<Evidence | null>(null);
	const detail = useQuery({
		queryKey: ["capacity-record", id],
		queryFn: () => api<RecordDetail>(`/capacity/records/${id}`),
		retry: false,
	});
	const withdraw = useMutation({
		mutationFn: () => api(`/capacity/records/${id}/withdraw`, { method: "POST" }),
		onSuccess: refresh,
	});
	const remove = useMutation({
		mutationFn: () => api(`/capacity/records/${id}`, { method: "DELETE" }),
		onSuccess: async () => {
			await refresh();
			navigate("/capacity");
		},
	});
	if (detail.isPending) return <PageLoading />;
	if (detail.isError) {
		if (detail.error instanceof ApiError && detail.error.status === 404) {
			return <StatePanel icon={SearchX} title={t("cb.not_found")} action={<Link href="/capacity" className={buttonClass("outline")}>{t("cb.back")}</Link>} />;
		}
		return <PageError onRetry={() => detail.refetch()} />;
	}
	const data = detail.data;
	const { record } = data;
	const owner = data.viewer === "owner";
	const order: TrainingStatus[] = ["applied", "started", "in_progress", "completed"];
	const reached = order.indexOf(record.trainingStatus);
	const trainingSteps = order.map((status, index) => ({
		label: t(`cb.training_${status}`),
		done: record.trainingStatus !== "cancelled" && (index < reached || record.trainingStatus === "completed"),
		current: status === record.trainingStatus && status !== "completed",
	}));
	const reviewOrder: ReviewStatus[] = ["draft", "submitted", "under_review", "verified"];
	const reviewReached = record.reviewStatus === "changes_requested" || record.reviewStatus === "rejected" ? 2 : reviewOrder.indexOf(record.reviewStatus);
	const reviewSteps = reviewOrder.map((status, index) => ({
		label: t(`cb.review_${status}`),
		done: index < reviewReached || record.reviewStatus === "verified",
		current: index === reviewReached && record.reviewStatus !== "verified",
	}));
	const canWithdraw = owner && (record.reviewStatus === "submitted" || record.reviewStatus === "under_review");
	const reviewers = data.reviewers.join(", ");
	return (
		<div className="flex flex-col gap-4 p-4 md:px-6 md:py-7">
			<nav aria-label={t("people.breadcrumb")} className="text-[13px] text-muted-foreground">
				<Link href="/capacity" className="no-underline hover:underline">{t("cb.my_training")}</Link> / <span>{record.title}</span>
			</nav>
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div className="min-w-0">
					<h1 className="break-words text-[26px] font-semibold leading-[34px] tracking-tight">{record.title}</h1>
					<div className="mt-1.5 flex flex-wrap items-center gap-2">
						<TrainingChip status={record.trainingStatus} />
						<ReviewChip status={record.reviewStatus} />
						{record.isSensitive && <SensitiveChip />}
						<span className="text-[13px] text-muted-foreground">
							{[trainingMeta(record, t), dateRange(record, language), durationText(record, t)].filter(Boolean).join(" · ")}
						</span>
					</div>
				</div>
				{owner && (
					<div className="flex flex-wrap gap-2">
						{canWithdraw && (
							<button type="button" disabled={withdraw.isPending} className={buttonClass("outline")} onClick={() => withdraw.mutate()}>
								{t("cb.withdraw")}
							</button>
						)}
						{data.canEdit && (
							<Link href={`/capacity/records/${record.id}/edit`} className={buttonClass("outline")}>{t("common.edit")}</Link>
						)}
						{record.reviewStatus === "draft" && (
							<button type="button" aria-label={t("common.delete")} className={buttonClass("ghost", "px-3")} onClick={() => setDeleting(true)}>
								<Trash2 size={15} aria-hidden="true" />
							</button>
						)}
					</div>
				)}
			</div>
			<LockNote>{reviewers ? t("cb.visible_to", { reviewers }) : t("cb.visible_to_none")}</LockNote>
			<section className="flex flex-wrap gap-7 rounded-card border border-border bg-card p-4 md:p-5">
				<Steps title={t("cb.col_training_status")} steps={trainingSteps} note={record.trainingStatus === "cancelled" ? t("cb.training_cancelled") : undefined} />
				<Steps title={t("cb.col_review_status")} steps={reviewSteps} note={
						record.reviewStatus === "changes_requested" || record.reviewStatus === "rejected"
							? t(`cb.review_${record.reviewStatus}`)
							: record.reviewStatus === "verified"
								? undefined
								: t("cb.review_note")
					} />
			</section>
			<div className="grid items-start gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
				<div className="flex min-w-0 flex-col gap-4">
					<section className="rounded-card border border-border bg-card p-4 md:p-5">
						<div className="mb-3 flex flex-wrap items-center justify-between gap-2">
							<h2 className="text-[15px] font-semibold">{t(owner ? "cb.what_i_submitted" : "cb.what_they_submitted")}</h2>
							{record.version > 0 && <span className="text-xs text-muted-foreground">{t("cb.version", { version: record.version })}</span>}
						</div>
						<TrainingFacts data={data} />
					</section>
					<section className="rounded-card border border-border bg-card p-4 md:p-5">
						<h2 className="mb-2.5 text-[15px] font-semibold">{t("cb.col_evidence")}</h2>
						{data.evidence.length === 0 ? (
							<p className="text-sm text-muted-foreground">{t("cb.no_evidence")}</p>
						) : (
							<ul className="flex flex-col gap-2">
								{data.evidence.map((file) => (
									<li key={file.id} className="flex items-center gap-3 rounded-[9px] border border-border p-2.5">
										<FileText size={18} aria-hidden="true" className="shrink-0 text-muted-foreground" />
										<span className="min-w-0 flex-1">
											<span className="block break-words text-sm font-medium">{file.name}</span>
											<span className="block text-xs text-muted-foreground">{fileSize(file.sizeBytes)} · {t("cb.private")}</span>
										</span>
										<button type="button" className={buttonClass("outline", "min-h-8 px-3 py-0")} onClick={() => setPreviewing(file)}>
											{t("cb.view")}
										</button>
									</li>
								))}
							</ul>
						)}
					</section>
				</div>
				<MessagesPanel data={data} />
			</div>
			{previewing && (
				<FilePreviewDrawer
					name={previewing.name}
					mimeType={previewing.mimeType}
					src={evidenceUrl(record.id, previewing.id)}
					downloadHref={evidenceUrl(record.id, previewing.id, true)}
					onClose={() => setPreviewing(null)}
				/>
			)}
			<ConfirmModal
				title={t("cb.delete_title")}
				description={t("cb.delete_desc", { title: record.title })}
				confirmLabel={t("common.delete")}
				open={deleting}
				pending={remove.isPending}
				failed={remove.isError}
				onConfirm={() => remove.mutate()}
				onClose={() => setDeleting(false)}
			/>
		</div>
	);
}
