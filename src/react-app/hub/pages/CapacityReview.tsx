import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, Check, ClipboardCheck, FileText, Lock } from "lucide-react";
import { Link } from "wouter";
import { api, ApiError } from "../api";
import { useI18n } from "../i18n";
import {
	Alert,
	Avatar,
	buttonClass,
	DataTable,
	PageError,
	PageHeader,
	PageLoading,
	Segmented,
	StatePanel,
	TextareaField,
} from "../ui";
import {
	dateRange,
	durationText,
	evidenceUrl,
	fileSize,
	MessagesPanel,
	ReviewChip,
	SensitiveChip,
	trainingMeta,
	TrainingChip,
	TrainingFacts,
	useRefreshCapacity,
	type RecordDetail,
	type ReviewStatus,
	type TrainingStatus,
} from "./Capacity";
import { SkillCatalogTab } from "./CapacitySkills";
import { DirectoryRulesTab } from "./Directory";

interface QueueItem {
	id: number;
	title: string | null;
	category: string | null;
	isSensitive: boolean;
	ownerName: string;
	reviewStatus: ReviewStatus;
	trainingStatus: TrainingStatus;
	submittedAt: string | null;
	version: number;
	evidenceCount: number;
	tab: "to_review" | "sent_back";
}

const TABS = ["to_review", "missing", "sent_back"] as const;
type Tab = (typeof TABS)[number];
const DAY_MS = 24 * 60 * 60 * 1000;
const LATE_DAYS = 14;

function inTab(item: QueueItem, tab: Tab) {
	if (tab === "missing") return item.tab === "to_review" && item.evidenceCount === 0 && item.trainingStatus === "completed";
	return item.tab === tab;
}

function ReviewPane({ id, onDecided, onBack }: { id: number; onDecided: () => void; onBack: () => void }) {
	const { t, language } = useI18n();
	const refresh = useRefreshCapacity();
	const queryClient = useQueryClient();
	const [decision, setDecision] = useState<"verify" | "changes" | "reject">("verify");
	const [comment, setComment] = useState("");
	const [note, setNote] = useState("");
	const [viewing, setViewing] = useState<number | null>(null);
	// Opening it tells the person their report is being read, and is logged, so it
	// happens before the record is read.
	const opened = useQuery({
		queryKey: ["capacity-open", id],
		queryFn: async () => {
			await api(`/capacity/reviews/${id}/open`, { method: "POST" });
			await queryClient.invalidateQueries({ queryKey: ["capacity-reviews"] });
			return true;
		},
		gcTime: 0,
		retry: false,
		refetchOnWindowFocus: false,
	});
	const detail = useQuery({
		queryKey: ["capacity-record", String(id)],
		queryFn: () => api<RecordDetail>(`/capacity/records/${id}`),
		enabled: opened.isFetched,
		retry: false,
	});
	const decide = useMutation({
		mutationFn: (version: number) =>
			api(`/capacity/reviews/${id}/decision`, {
				method: "POST",
				body: { decision, comment, privateNote: note, version },
			}),
		onSuccess: async () => {
			await refresh();
			onDecided();
		},
		onError: () => refresh(),
	});

	if (detail.isPending) return <PageLoading />;
	if (detail.isError) return <PageError onRetry={() => detail.refetch()} />;
	const data = detail.data;
	const { record } = data;
	const open = record.reviewStatus === "submitted" || record.reviewStatus === "under_review";
	const code = decide.error instanceof ApiError ? decide.error.code : "";
	const needsComment = decision !== "verify" && !comment.trim();
	const datesOk = !!record.startDate && !!record.endDate && record.endDate >= record.startDate;
	const lastSubmit = [...data.events].reverse().find((event) => event.kind === "submitted");
	const checks = [
		{ ok: datesOk, title: "cb.check_dates", detail: `${dateRange(record, language)} · ${durationText(record, t)}` },
		{
			ok: data.evidence.length > 0,
			title: "cb.check_evidence",
			detail: data.evidence.length > 0 ? t("cb.evidence_count", { count: data.evidence.length }) : t("cb.no_evidence"),
		},
		{ ok: !!record.objectives, title: "cb.check_objectives", detail: t(record.shareReflection ? "cb.check_reflection_shared" : "cb.check_reflection_private") },
		{ ok: record.isSensitive || !!record.provider, title: "cb.check_provider", detail: record.provider ?? t(record.isSensitive ? "cb.check_provider_sensitive" : "cb.not_shared") },
	];
	const viewed = data.evidence.find((file) => file.id === viewing);

	return (
		<div className="flex min-w-0 flex-col gap-4">
			<button type="button" className="inline-flex items-center gap-1.5 self-start text-sm text-muted-foreground lg:hidden" onClick={onBack}>
				<ArrowLeft size={15} aria-hidden="true" />
				{t("cb.reviews")}
			</button>
			<section className="rounded-card border border-border bg-card p-4 md:p-5">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div className="flex items-center gap-2.5">
						<Avatar name={data.owner.name} />
						<div>
							<p className="font-semibold">{data.owner.name}</p>
							<p className="text-xs text-muted-foreground">
								{[data.owner.department, t("cb.version", { version: record.version })].filter(Boolean).join(" · ")}
							</p>
						</div>
					</div>
					<p className="flex max-w-[260px] items-start gap-1.5 text-xs text-muted-foreground">
						<Lock size={13} aria-hidden="true" className="mt-0.5 shrink-0" />
						{t("cb.seeing_because", { name: data.owner.name })}
					</p>
				</div>
				<h2 className="mt-3 break-words text-lg font-semibold">{record.title}</h2>
				<div className="mt-1.5 flex flex-wrap items-center gap-2">
					<TrainingChip status={record.trainingStatus} />
					<ReviewChip status={record.reviewStatus} />
					{record.isSensitive && <SensitiveChip />}
					<span className="text-[13px] text-muted-foreground">{trainingMeta(record, t)}</span>
				</div>
				<div className="mt-3.5"><TrainingFacts data={data} /></div>
				{lastSubmit?.message && (
					<p className="mt-3 rounded-md bg-selected px-3 py-2 text-[13px]">
						<b>{t("cb.changes_note")}:</b> {lastSubmit.message}
					</p>
				)}
			</section>
			<div className="grid items-start gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
				<section className="min-w-0 rounded-card border border-border bg-card p-4">
					<h3 className="mb-2.5 text-[15px] font-semibold">{t("cb.col_evidence")}</h3>
					{data.evidence.length === 0 ? (
						<p className="text-sm text-muted-foreground">{t("cb.no_evidence")}</p>
					) : (
						<ul className="flex flex-col gap-2">
							{data.evidence.map((file) => (
								<li key={file.id} className="flex flex-wrap items-center gap-2.5 rounded-[9px] border border-border p-2.5">
									<FileText size={18} aria-hidden="true" className="shrink-0 text-muted-foreground" />
									<span className="min-w-0 flex-[1_1_140px]">
										<span className="block break-words text-sm font-medium">{file.name}</span>
										<span className="block text-xs text-muted-foreground">{fileSize(file.sizeBytes)}</span>
									</span>
									<button type="button" className={buttonClass("outline", "min-h-8 px-3 py-0")} onClick={() => setViewing(file.id)}>
										{t("cb.view")}
									</button>
									<a href={evidenceUrl(record.id, file.id, true)} className="text-xs text-selected-foreground">{t("files.download")}</a>
								</li>
							))}
						</ul>
					)}
					{viewed &&
						(viewed.mimeType === "application/pdf" ? (
							<iframe title={viewed.name} src={evidenceUrl(record.id, viewed.id)} className="mt-3 h-[420px] w-full rounded-md border border-border" />
						) : (
							<img src={evidenceUrl(record.id, viewed.id)} alt={viewed.name} className="mt-3 max-h-[420px] w-full rounded-md border border-border object-contain" />
						))}
					<p className="mt-2.5 text-xs text-muted-foreground">{t("cb.evidence_logged")}</p>
				</section>
				<section className="min-w-0 rounded-card border border-border bg-card p-4">
					<h3 className="mb-2.5 text-[15px] font-semibold">{t("cb.check_title")}</h3>
					<ul className="flex flex-col gap-2.5">
						{checks.map((check) => (
							<li key={check.title} className="flex items-start gap-2.5 text-[13px]">
								{check.ok ? (
									<Check size={16} aria-label={t("cb.check_ok")} className="mt-0.5 shrink-0 text-[#14795A]" />
								) : (
									<AlertTriangle size={16} aria-label={t("cb.check_look")} className="mt-0.5 shrink-0 text-[#B45309]" />
								)}
								<span className="min-w-0">
									<span className="block font-medium">{t(check.title)}</span>
									<span className="block break-words text-xs text-muted-foreground">{check.detail}</span>
								</span>
							</li>
						))}
					</ul>
				</section>
			</div>
			{open && (
				<section className="rounded-card border border-border bg-card p-4 md:p-5">
					<h3 className="mb-3 text-[15px] font-semibold">{t("cb.your_decision")}</h3>
					<div role="radiogroup" aria-label={t("cb.your_decision")} className="grid gap-2.5 sm:grid-cols-3">
						{(["verify", "changes", "reject"] as const).map((value) => (
							<label
								key={value}
								className={`flex cursor-pointer items-start gap-2.5 rounded-[9px] border p-3 ${decision === value ? "border-primary bg-selected" : "border-border"}`}
							>
								<input type="radio" name="decision" className="mt-1 size-4 accent-primary" checked={decision === value} onChange={() => setDecision(value)} />
								<span>
									<span className="block text-sm font-semibold">{t(`cb.decide_${value}`)}</span>
									<span className="block text-xs text-muted-foreground">{t(`cb.decide_${value}_hint`)}</span>
								</span>
							</label>
						))}
					</div>
					<div className="mt-3.5 flex flex-col gap-3.5">
						<TextareaField
							label={t("cb.comment_for", { name: data.owner.name })}
							hint={decision === "verify" ? t("cb.comment_optional") : t("cb.comment_required")}
							rows={2}
							maxLength={2000}
							value={comment}
							onChange={(event) => setComment(event.target.value)}
						/>
						<TextareaField
							label={t("cb.private_reviewer_note")}
							hint={t("cb.private_reviewer_hint")}
							rows={2}
							maxLength={2000}
							value={note}
							onChange={(event) => setNote(event.target.value)}
						/>
						{decide.isError && <Alert>{t(code === "RECORD_CHANGED" ? "cb.record_changed" : code === "ALREADY_DECIDED" ? "cb.already_decided" : "error.generic")}</Alert>}
						<p className="text-xs text-muted-foreground">{t("cb.verify_note")}</p>
						<div className="flex justify-end">
							<button type="button" disabled={needsComment || decide.isPending} className={buttonClass()} onClick={() => decide.mutate(record.version)}>
								{t(`cb.decide_${decision}`)}
							</button>
						</div>
					</div>
				</section>
			)}
			<MessagesPanel data={data} />
		</div>
	);
}

export function CapacityReviewsPage() {
	const { t } = useI18n();
	const [tab, setTab] = useState<Tab>("to_review");
	const [selected, setSelected] = useState<number | null>(null);
	const [now] = useState(() => Date.now());
	const queue = useQuery({
		queryKey: ["capacity-reviews"],
		queryFn: () => api<{ isReviewer: boolean; items: QueueItem[] }>("/capacity/reviews"),
		retry: false,
	});
	if (queue.isPending) return <PageLoading />;
	if (queue.isError) return <PageError onRetry={() => queue.refetch()} />;
	const items = queue.data.items;
	const visible = items.filter((item) => inTab(item, tab));

	return (
		<div className="flex flex-col gap-4 p-4 md:px-6 md:py-7">
			<PageHeader title={t("cb.reviews")} subtitle={t("cb.reviews_desc")} />
			{items.length === 0 ? (
				<StatePanel icon={ClipboardCheck} title={t("cb.reviews_empty")} description={t("cb.reviews_empty_desc")} />
			) : (
				<div className="grid items-start gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
					<div className={`flex min-w-0 flex-col gap-2.5 rounded-card border border-border bg-card p-2.5 ${selected !== null ? "max-lg:hidden" : ""}`}>
						<Segmented
							label={t("cb.reviews")}
							options={TABS.map((value) => ({
								value,
								label: `${t(`cb.tab_${value}`)} ${items.filter((item) => inTab(item, value)).length}`,
							}))}
							value={tab}
							onChange={setTab}
						/>
						{visible.length === 0 && <p className="p-3 text-sm text-muted-foreground">{t("cb.tab_empty")}</p>}
						<ul className="flex flex-col gap-1">
							{visible.map((item) => {
								const days = item.submittedAt ? Math.floor((now - new Date(item.submittedAt).getTime()) / DAY_MS) : 0;
								return (
									<li key={item.id}>
										<button
											type="button"
											aria-current={selected === item.id ? "true" : undefined}
											className={`flex w-full flex-col gap-1 rounded-md border-l-[3px] p-2.5 text-left ${
												selected === item.id ? "border-primary bg-selected" : "border-transparent hover:bg-muted"
											}`}
											onClick={() => setSelected(item.id)}
										>
											<span className="flex flex-wrap items-center justify-between gap-1.5">
												<span className="flex items-center gap-2 text-sm font-semibold">
													<Avatar name={item.ownerName} size={24} />
													{item.ownerName}
												</span>
												<ReviewChip status={item.reviewStatus} />
											</span>
											<span className="flex items-center gap-1.5 text-[13px]">
												{item.isSensitive && <Lock size={13} aria-hidden="true" className="shrink-0" />}
												<span className="break-words">
													{item.title ?? `${t("cb.restricted")} · ${t(`cb.cat_${item.category}`)}`}
												</span>
											</span>
											<span className={`text-xs ${days > LATE_DAYS ? "font-semibold text-danger-foreground" : "text-muted-foreground"}`}>
												{item.tab === "to_review" && t("cb.waiting_days", { days })}
												{item.tab === "to_review" && item.evidenceCount === 0 && item.trainingStatus === "completed" && ` · ${t("cb.no_evidence_short")}`}
												{item.tab === "to_review" && item.version > 1 && ` · ${t("cb.resubmitted")}`}
											</span>
										</button>
									</li>
								);
							})}
						</ul>
						<p className="px-2 text-xs text-muted-foreground">{t("cb.target")}</p>
					</div>
					{selected === null ? (
						<StatePanel icon={ClipboardCheck} title={t("cb.choose_report")} />
					) : (
						<ReviewPane key={selected} id={selected} onDecided={() => setSelected(null)} onBack={() => setSelected(null)} />
					)}
				</div>
			)}
		</div>
	);
}

interface ReviewerData {
	teams: { id: number; name: string; staff: number; waiting: number; reviewerId: string | null; backupId: string | null }[];
	candidates: { userId: string; name: string; role: string }[];
	withoutTeam: number;
}

function TeamRow({ team, candidates }: { team: ReviewerData["teams"][number]; candidates: ReviewerData["candidates"] }) {
	const { t } = useI18n();
	const queryClient = useQueryClient();
	const [saved, setSaved] = useState(false);
	const save = useMutation({
		mutationFn: (body: { reviewerId: string | null; backupId: string | null }) =>
			api(`/capacity/reviewers/${team.id}`, { method: "PUT", body }),
		onMutate: () => setSaved(false),
		onSuccess: async () => {
			setSaved(true);
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: ["capacity-reviewers"] }),
				queryClient.invalidateQueries({ queryKey: ["capacity-audit"] }),
			]);
		},
	});
	const code = save.error instanceof ApiError ? save.error.code : "";
	const picker = (label: string, value: string | null, onChange: (id: string | null) => void) => (
		<select
			aria-label={`${label}: ${team.name}`}
			value={value ?? ""}
			disabled={save.isPending}
			className={`h-9 max-w-[180px] rounded-md border bg-card px-2 text-[13px] ${!value && label === t("cb.col_reviewer") ? "border-[#F59F0A]" : "border-input"}`}
			onChange={(event) => onChange(event.target.value || null)}
		>
			<option value="">{t("cb.choose")}</option>
			{candidates.map((person) => (
				<option key={person.userId} value={person.userId}>
					{person.name}
				</option>
			))}
		</select>
	);
	return (
		<tr>
			<td className="px-3 py-2.5 first:pl-4">
				<b>{team.name}</b>
				<span className="block text-xs text-muted-foreground">{t("shell.staff_count", { count: team.staff })}</span>
			</td>
			<td className="px-3 py-2.5">{picker(t("cb.col_reviewer"), team.reviewerId, (reviewerId) => save.mutate({ reviewerId, backupId: team.backupId }))}</td>
			<td className="px-3 py-2.5">{picker(t("cb.col_backup"), team.backupId, (backupId) => save.mutate({ reviewerId: team.reviewerId, backupId }))}</td>
			<td className="px-3 py-2.5 last:pr-4 text-xs">
				{save.isError ? (
					<span className="text-danger-foreground">{t(code === "SAME_REVIEWER" ? "cb.same_reviewer" : "error.generic")}</span>
				) : !team.reviewerId ? (
					<span className="font-semibold"><span aria-hidden="true" className="text-[#F59F0A]">● </span>{t("cb.no_reviewer_waits")}</span>
				) : saved ? (
					<span role="status" className="text-muted-foreground">{t("common.saved")}</span>
				) : (
					<span className="text-muted-foreground">{t("cb.waiting_count", { count: team.waiting })}</span>
				)}
			</td>
		</tr>
	);
}

const AUDIT_KEYS: Record<string, string> = {
	"capacity.verified": "cb.audit_verified",
	"capacity.changes_requested": "cb.audit_changes",
	"capacity.rejected": "cb.audit_rejected",
	"capacity.sensitive_opened": "cb.audit_sensitive",
	"capacity.evidence_viewed": "cb.audit_viewed",
	"capacity.evidence_downloaded": "cb.audit_downloaded",
	"capacity.reviewers_changed": "cb.audit_reviewers",
	"capacity.report_exported": "cb.audit_exported",
	"capacity.skill_added": "cb.audit_skill",
	"capacity.skill_changed": "cb.audit_skill",
	"capacity.skill_assessed": "cb.audit_assessed",
	"capacity.skill_declined": "cb.audit_assessed",
	"capacity.directory_rules_changed": "cb.audit_directory",
	"capacity.display_name_approved": "cb.audit_display",
	"capacity.display_name_declined": "cb.audit_display",
};

export function CapacitySettingsPage() {
	const { t } = useI18n();
	const [tab, setTab] = useState<"catalog" | "directory" | "reviewers">("reviewers");
	return (
		<div className="flex flex-col gap-4 p-4 md:px-6 md:py-7">
			<PageHeader title={t("cb.settings_title")} subtitle={t("cb.settings_desc")} />
			<Segmented
				label={t("cb.settings_title")}
				look="underline"
				options={[
					{ value: "reviewers", label: t("cb.tab_reviewers") },
					{ value: "catalog", label: t("cb.tab_catalog") },
					{ value: "directory", label: t("cb.tab_directory") },
				]}
				value={tab}
				onChange={setTab}
			/>
			{tab === "reviewers" && <ReviewersTab />}
			{tab === "catalog" && <SkillCatalogTab />}
			{tab === "directory" && <DirectoryRulesTab />}
		</div>
	);
}

function ReviewersTab() {
	const { t, language } = useI18n();
	const reviewers = useQuery({ queryKey: ["capacity-reviewers"], queryFn: () => api<ReviewerData>("/capacity/reviewers") });
	const audit = useQuery({
		queryKey: ["capacity-audit"],
		queryFn: () =>
			api<{ entries: { id: number; action: string; metadata: string | null; createdAt: string; actorName: string | null }[] }>("/capacity/audit"),
		select: (data) => data.entries,
	});
	if (reviewers.isPending) return <PageLoading />;
	if (reviewers.isError) return <PageError onRetry={() => reviewers.refetch()} />;
	const { teams, candidates, withoutTeam } = reviewers.data;
	const missing = teams.filter((team) => !team.reviewerId).length;

	return (
		<div className="flex flex-col gap-4">
			<div className="grid items-start gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]">
				<section className="min-w-0 rounded-card border border-border bg-card">
					<div className="px-4 py-3">
						<h2 className="text-[15px] font-semibold">{t("cb.who_reviews")}</h2>
						<p className="mt-0.5 text-xs text-muted-foreground">{t("cb.who_reviews_desc")}</p>
					</div>
					{teams.length === 0 ? (
						<div className="border-t border-border px-4 py-5 text-sm text-muted-foreground">
							{t("cb.no_teams")} <Link href="/settings/departments" className="font-medium text-selected-foreground">{t("cb.add_departments")}</Link>
						</div>
					) : (
						<DataTable bare minWidth={620} head={[t("cb.col_team"), t("cb.col_reviewer"), t("cb.col_backup"), t("cb.col_status")]}>
							{teams.map((team) => (
								<TeamRow key={team.id} team={team} candidates={candidates} />
							))}
						</DataTable>
					)}
					{missing > 0 && (
						<p className="flex items-start gap-2 rounded-b-card border-t border-border bg-warning-surface px-4 py-2.5 text-[13px]">
							<AlertTriangle size={15} aria-hidden="true" className="mt-0.5 shrink-0" />
							{t("cb.teams_missing", { count: missing })}
						</p>
					)}
				</section>
				<div className="flex min-w-0 flex-col gap-4">
					<section className="rounded-card border border-border bg-card p-4 text-[13px]">
						<h2 className="mb-2 text-[15px] font-semibold">{t("cb.rules")}</h2>
						<ul className="flex flex-col gap-2">
							{["cb.rule_self", "cb.rule_edit", "cb.rule_admin"].map((key) => (
								<li key={key} className="flex items-start gap-2">
									<Check size={15} aria-hidden="true" className="mt-0.5 shrink-0 text-[#14795A]" />
									{t(key)}
								</li>
							))}
						</ul>
					</section>
					<section className="rounded-card border border-border bg-card p-4 text-[13px]">
						<h2 className="mb-1.5 text-[15px] font-semibold">{t("cb.without_team")}</h2>
						<p>{t("cb.without_team_desc", { count: withoutTeam })} <Link href="/settings/departments" className="font-medium text-selected-foreground">{t("cb.fix_departments")}</Link></p>
					</section>
				</div>
			</div>
			<section className="min-w-0 rounded-card border border-border bg-card">
				<div className="px-4 py-3">
					<h2 className="text-[15px] font-semibold">{t("cb.audit")}</h2>
					<p className="mt-0.5 text-xs text-muted-foreground">{t("cb.audit_desc")}</p>
				</div>
				{audit.data?.length ? (
					<DataTable bare minWidth={560} head={[t("cb.audit_when"), t("cb.audit_who"), t("cb.audit_what")]}>
						{audit.data.map((entry) => {
							const metadata = entry.metadata ? (JSON.parse(entry.metadata) as { department?: string; sensitive?: boolean }) : {};
							return (
								<tr key={entry.id}>
									<td className="whitespace-nowrap px-3 py-2 text-muted-foreground first:pl-4">
										{new Date(entry.createdAt).toLocaleString(language, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
									</td>
									<td className="px-3 py-2">{entry.actorName ?? "—"}</td>
									<td className="px-3 py-2 last:pr-4">
										{t(AUDIT_KEYS[entry.action] ?? "cb.audit_other", { department: metadata.department ?? "" })}
										{metadata.sensitive && entry.action !== "capacity.sensitive_opened" && ` · ${t("cb.sensitive")}`}
									</td>
								</tr>
							);
						})}
					</DataTable>
				) : (
					<p className="border-t border-border px-4 py-5 text-sm text-muted-foreground">{t("cb.audit_empty")}</p>
				)}
			</section>
		</div>
	);
}
