import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleCheck, Download, FileText, Plus, X } from "lucide-react";
import { Link } from "wouter";
import { api } from "../api";
import { useI18n } from "../i18n";
import {
	Alert,
	Avatar,
	buttonClass,
	Chip,
	FilterSelect,
	PageError,
	PageHeader,
	PageLoading,
	SearchField,
	Segmented,
	StatePanel,
} from "../ui";

import { downloadCsv } from "../csv";
import { ActivityDialog } from "./Reports";

export type PolicyStatus = "draft" | "published" | "archived";

export interface PolicyDraft {
	id: number;
	title: string;
	category: string;
	content: string;
	status: PolicyStatus;
	isMandatory: boolean;
	effectiveDate: string | null;
	reviewDate: string | null;
	departments: { id: number; name: string }[];
	attachment?: {
		type: "file" | "link";
		name: string;
		url: string | null;
		mimeType: string | null;
		sizeBytes: number | null;
	} | null;
}

interface PolicySummary {
	id: number;
	title: string;
	category: string;
	status: PolicyStatus;
	isMandatory: boolean;
	version: number;
	effectiveDate: string | null;
	reviewDate: string | null;
	departments: { id: number; name: string }[];
	acknowledged: boolean;
	required: boolean;
	compliance: { total: number; acknowledged: number } | null;
}

export const POLICIES_KEY = ["policies"];
export const CATEGORY_KEYS: Record<string, string> = {
	"Human Resources": "policies.cat_hr",
	Finance: "policies.cat_finance",
	"IT & Security": "policies.cat_it",
	Operations: "policies.cat_operations",
	Compliance: "policies.cat_compliance",
	"Health & Safety": "policies.cat_safety",
	General: "policies.cat_general",
};
const STATUS_TONES = { draft: "neutral", published: "primary", archived: "outline" } as const;

export function StatusBadge({ status }: { status: PolicyStatus }) {
	const { t } = useI18n();
	return <Chip tone={STATUS_TONES[status]}>{t(`policies.${status}`)}</Chip>;
}

export function MandatoryBadge() {
	const { t } = useI18n();
	return <Chip tone="primary">{t("policies.mandatory_badge")}</Chip>;
}

// Dates are stored at midnight UTC, so they're shown in UTC to stay the same day.
export function formatPolicyDate(value: string, language: string) {
	return new Date(value).toLocaleDateString(language, {
		dateStyle: "medium",
		timeZone: "UTC",
	});
}

function PolicyCard({ policy }: { policy: PolicySummary }) {
	const { t } = useI18n();
	const percent = policy.compliance?.total
		? Math.round((policy.compliance.acknowledged / policy.compliance.total) * 100)
		: 0;
	const needsAction =
		policy.status === "published" &&
		policy.isMandatory &&
		policy.required &&
		!policy.acknowledged;

	return (
		<li>
			<Link
				href={`/policies/${policy.id}`}
				className="block rounded-card border border-border bg-card p-4 text-foreground no-underline transition-colors hover:border-input hover:bg-muted/40"
			>
				<div className="flex flex-wrap items-center gap-2">
					<h2 className="min-w-0 break-words font-semibold">{policy.title}</h2>
					{policy.isMandatory && <MandatoryBadge />}
					{policy.status !== "published" && <StatusBadge status={policy.status} />}
				</div>
				<p className="mt-1 text-xs text-muted-foreground">
					{t(CATEGORY_KEYS[policy.category] ?? "policies.cat_general")}
					{" · "}
					{t("policies.version", { version: policy.version })}
					{policy.departments.length > 0 &&
						` · ${policy.departments.map((d) => d.name).join(", ")}`}
				</p>
				<div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
					{policy.acknowledged && (
						<span className="flex items-center gap-1.5 text-muted-foreground">
							<CircleCheck size={15} aria-hidden="true" />
							{t("policies.acknowledged")}
						</span>
					)}
					{needsAction && (
						<span className="font-medium text-warning-foreground">
							{t("policies.needs_acknowledgment")}
						</span>
					)}
					{policy.compliance &&
						policy.status === "published" &&
						policy.isMandatory && (
							<span className="flex min-w-48 flex-1 items-center gap-2 text-xs text-muted-foreground">
								<span
									role="progressbar"
									aria-valuenow={percent}
									aria-valuemin={0}
									aria-valuemax={100}
									aria-label={t("policies.tab_compliance")}
									className="h-1.5 max-w-48 flex-1 overflow-hidden rounded-full bg-input"
								>
									<span
										className="block h-full rounded-full bg-primary"
										style={{ width: `${percent}%` }}
									/>
								</span>
								{t("policies.compliance_count", {
									done: policy.compliance.acknowledged,
									total: policy.compliance.total,
								})}
							</span>
						)}
				</div>
			</Link>
		</li>
	);
}

const REVIEW_SOON_MS = 30 * 24 * 60 * 60 * 1000;

function complianceOf(policy: PolicySummary) {
	return policy.status === "published" && policy.isMandatory ? policy.compliance : null;
}

function Stat({ label, value, alert = false }: { label: string; value: string | number; alert?: boolean }) {
	return (
		<div className="rounded-card border border-border bg-card px-4 py-3">
			<dt className="text-[13px] text-muted-foreground">{label}</dt>
			<dd className={`text-2xl font-semibold leading-8 ${alert ? "text-danger-foreground" : ""}`}>{value}</dd>
		</div>
	);
}

function AckBar({ done, total, label }: { done: number; total: number; label: string }) {
	const percent = total ? Math.round((done / total) * 100) : 0;
	return (
		<span className="flex min-w-36 items-center gap-2 text-[13px]">
			<span
				role="progressbar"
				aria-valuenow={percent}
				aria-valuemin={0}
				aria-valuemax={100}
				aria-label={label}
				className="h-1.5 flex-1 overflow-hidden rounded-full bg-input"
			>
				<span className="block h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
			</span>
			{done}/{total}
		</span>
	);
}

function Donut({ percent }: { percent: number }) {
	const radius = 32;
	const length = 2 * Math.PI * radius;
	return (
		<span className="relative grid size-[76px] shrink-0 place-items-center">
			<svg viewBox="0 0 76 76" className="absolute inset-0 -rotate-90" aria-hidden="true">
				<circle cx="38" cy="38" r={radius} fill="none" strokeWidth="8" className="stroke-muted" />
				<circle
					cx="38"
					cy="38"
					r={radius}
					fill="none"
					strokeWidth="8"
					strokeDasharray={length}
					strokeDashoffset={length * (1 - percent / 100)}
					className="stroke-primary"
				/>
			</svg>
			<span className="text-[15px] font-semibold">{percent}%</span>
		</span>
	);
}

interface PanelPerson {
	userId: string;
	name: string;
	departmentName: string | null;
	acknowledgedAt: string | null;
	remindedAt: string | null;
}

// The summary beside the table: who's still missing, and a one-click reminder.
function PolicyPanel({ policy, onClose }: { policy: PolicySummary; onClose: () => void }) {
	const { t, language } = useI18n();
	const queryClient = useQueryClient();
	const key = ["policy-compliance", policy.id];
	const [showActivity, setShowActivity] = useState(false);
	const mandatoryLive = policy.status === "published" && policy.isMandatory;
	const compliance = useQuery({
		queryKey: key,
		enabled: mandatoryLive,
		queryFn: () => api<{ people: PanelPerson[] }>(`/policies/${policy.id}/compliance`),
		select: (data) => data.people,
	});
	const remind = useMutation({
		mutationFn: () =>
			api<{ sent: number }>(`/policies/${policy.id}/remind`, { method: "POST", body: {} }),
		onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
	});
	const people = compliance.data ?? [];
	const pending = people.filter((person) => !person.acknowledgedAt);
	const done = people.length - pending.length;
	const percent = people.length ? Math.round((done / people.length) * 100) : 0;
	const category = t(CATEGORY_KEYS[policy.category] ?? "policies.cat_general");
	const closeButton = useRef<HTMLButtonElement>(null);
	useEffect(() => {
		closeButton.current?.focus();
	}, []);
	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape" && !document.querySelector("dialog[open]")) onClose();
		};
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, [onClose]);
	return (
		<>
			{/* There's only room beside the table on wide screens, so it slides over otherwise. */}
			<button
				type="button"
				aria-label={t("common.close")}
				onClick={onClose}
				className="fixed inset-0 z-40 bg-black/30 xl:hidden"
			/>
			<aside
				aria-label={policy.title}
				className="fixed inset-y-0 right-0 z-50 flex w-[min(380px,100%)] flex-col gap-4 overflow-y-auto border-l border-border bg-card p-5 shadow-lg xl:static xl:z-auto xl:w-[320px] xl:shrink-0 xl:overflow-visible xl:rounded-card xl:border xl:shadow-none"
			>
			<div className="flex items-start gap-2">
				<div className="min-w-0 flex-1">
					<p className="text-xs text-muted-foreground">
						{category} · {t("policies.version", { version: policy.version })}
					</p>
					<h2 className="mt-0.5 break-words text-lg font-semibold">{policy.title}</h2>
				</div>
				<button
					type="button"
					aria-label={t("common.close")}
					ref={closeButton}
					className="grid size-8 shrink-0 place-items-center rounded-md bg-muted"
					onClick={onClose}
				>
					<X size={15} aria-hidden="true" />
				</button>
			</div>
			{mandatoryLive && (
				<>
					<div className="flex items-center gap-3">
						<Donut percent={percent} />
						<p className="text-[13px]">
							<span className="block font-semibold">{t("policies.panel_done", { count: done })}</span>
							<span className="block">{t("policies.panel_pending", { count: pending.length })}</span>
							{policy.effectiveDate && (
								<span className="block text-muted-foreground">
									{t("policies.panel_effective", { date: formatPolicyDate(policy.effectiveDate, language) })}
								</span>
							)}
						</p>
					</div>
					{remind.isError && <Alert>{t("error.generic")}</Alert>}
					{remind.isSuccess && (
						<p role="status" className="rounded-md bg-selected px-2.5 py-1.5 text-[13px]">
							{t("policies.panel_reminded", { count: remind.data.sent })}
						</p>
					)}
				</>
			)}
			<div className="flex gap-2">
				{mandatoryLive && pending.length > 0 && (
					<button
						type="button"
						disabled={remind.isPending}
						className={buttonClass("primary", "flex-1")}
						onClick={() => remind.mutate()}
					>
						{t("policies.panel_remind", { count: pending.length })}
					</button>
				)}
				<Link href={`/policies/${policy.id}`} className={buttonClass("outline", mandatoryLive && pending.length ? "" : "flex-1")}>
					{t("policies.panel_open")}
				</Link>
			</div>
			{policy.status === "published" && (
				<button
					type="button"
					className="self-start text-[13px] font-medium text-selected-foreground hover:underline"
					onClick={() => setShowActivity(true)}
				>
					{t("reports.who_viewed")} →
				</button>
			)}
			{showActivity && (
				<ActivityDialog
					path={`/reports/policies/${policy.id}/people`}
					kind="policy"
					onClose={() => setShowActivity(false)}
				/>
			)}
			{mandatoryLive && pending.length > 0 && (
				<div>
					<div className="flex items-center justify-between">
						<h3 className="font-semibold">{t("policies.panel_pending_title", { count: pending.length })}</h3>
						<Link href={`/policies/${policy.id}`} className="text-[13px] text-selected-foreground no-underline hover:underline">
							{t("policies.panel_show_all", { count: people.length })}
						</Link>
					</div>
					<ul className="mt-2 divide-y divide-border rounded-[9px] border border-border">
						{pending.slice(0, 3).map((person) => (
							<li key={person.userId} className="flex items-center gap-2.5 px-3 py-2">
								<Avatar name={person.name} muted />
								<span className="min-w-0">
									<Link
										href={`/users/${person.userId}`}
										className="block break-words font-medium text-foreground no-underline hover:underline"
									>
										{person.name}
									</Link>
									<span className="block text-xs text-muted-foreground">
										{[
											person.departmentName,
											person.remindedAt ? t("policies.panel_was_reminded") : t("policies.panel_not_reminded"),
										]
											.filter(Boolean)
											.join(" · ")}
									</span>
								</span>
							</li>
						))}
						{pending.length > 3 && (
							<li className="px-3 py-2 text-[13px] text-muted-foreground">
								{t("policies.panel_more", { count: pending.length - 3 })}
							</li>
						)}
					</ul>
				</div>
			)}
			<div>
				<h3 className="font-semibold">{t("policies.panel_details")}</h3>
				<dl className="mt-2 grid grid-cols-2 gap-3 text-[13px]">
					<div>
						<dt className="text-muted-foreground">{t("policies.panel_applies")}</dt>
						<dd className="break-words">
							{policy.departments.length
								? policy.departments.map((department) => department.name).join(", ")
								: t("policies.all_departments_short")}
						</dd>
					</div>
					<div>
						<dt className="text-muted-foreground">{t("policies.col_review")}</dt>
						<dd>{policy.reviewDate ? formatPolicyDate(policy.reviewDate, language) : "—"}</dd>
					</div>
				</dl>
			</div>
			</aside>
		</>
	);
}

function ManagerTable({
	policies,
	selectedId,
	onSelect,
}: {
	policies: PolicySummary[];
	selectedId: number | null;
	onSelect: (id: number) => void;
}) {
	const { t, language } = useI18n();
	const [now] = useState(() => Date.now());
	return (
		<div className="overflow-x-auto rounded-card border border-border bg-card">
			<table className="w-full min-w-[720px] text-left">
				<thead className="bg-background text-xs text-muted-foreground">
					<tr>
						<th scope="col" className="px-4 py-2.5 font-semibold">{t("policies.col_policy")}</th>
						<th scope="col" className="px-2 py-2.5 font-semibold">{t("policies.status")}</th>
						<th scope="col" className="px-2 py-2.5 font-semibold">{t("policies.acknowledged")}</th>
						<th scope="col" className="px-4 py-2.5 font-semibold">{t("policies.col_review")}</th>
					</tr>
				</thead>
				<tbody>
					{policies.map((policy) => {
						const compliance = complianceOf(policy);
						const reviewSoon =
							policy.reviewDate !== null &&
							new Date(policy.reviewDate).getTime() - now < REVIEW_SOON_MS;
						return (
							<tr
								key={policy.id}
								onClick={() => onSelect(policy.id)}
								className={`cursor-pointer border-t border-border hover:bg-muted/40 ${selectedId === policy.id ? "bg-background" : ""}`}
							>
								<td className="px-4 py-3">
																			<button
											type="button"
											aria-pressed={selectedId === policy.id}
											className="break-words text-left font-semibold hover:underline"
											onClick={(event) => {
												event.stopPropagation();
												onSelect(policy.id);
											}}
										>
											{policy.title}
										</button>
									<p className="break-words text-xs text-muted-foreground">
										{t(CATEGORY_KEYS[policy.category] ?? "policies.cat_general")}
										{" · "}
										{t("policies.version", { version: policy.version })}
										{" · "}
										{policy.departments.length
											? policy.departments.map((d) => d.name).join(", ")
											: t("policies.all_departments_short")}
									</p>
								</td>
								<td className="px-2 py-3">
									<span className="flex flex-wrap gap-1">
										{policy.status === "published" ? (
											policy.isMandatory ? (
												<MandatoryBadge />
											) : (
																									<Chip>{t("policies.optional")}</Chip>
											)
										) : (
											<StatusBadge status={policy.status} />
										)}
										{reviewSoon && policy.status === "published" && (
																							<Chip tone="neutral">{t("policies.review_due")}</Chip>
										)}
									</span>
								</td>
								<td className="px-2 py-3 text-[13px]">
									{compliance ? (
										<AckBar
											done={compliance.acknowledged}
											total={compliance.total}
											label={t("policies.tab_compliance")}
										/>
									) : (
										<span className="text-muted-foreground">
											{policy.status === "published" ? t("policies.not_required") : "—"}
										</span>
									)}
								</td>
																	<td className={`px-4 py-3 text-[13px] ${reviewSoon && policy.status === "published" ? "text-danger-foreground" : "text-muted-foreground"}`}>
										{policy.reviewDate
										? formatPolicyDate(policy.reviewDate, language)
										: "—"}
								</td>
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}

export function PoliciesPage({ canManage }: { canManage: boolean }) {
	const { t } = useI18n();
	const [search, setSearch] = useState("");
	const [category, setCategory] = useState("all");
	const [department, setDepartment] = useState("all");
	const [tab, setTab] = useState<"all" | "followup" | "drafts">("all");
	const [selectedId, setSelectedId] = useState<number | null>(null);
	const policies = useQuery({
		queryKey: POLICIES_KEY,
		queryFn: () => api<{ policies: PolicySummary[] }>("/policies"),
		select: (data) => data.policies,
	});

	if (policies.isPending) return <PageLoading />;
	if (policies.isError) return <PageError onRetry={() => policies.refetch()} />;

	const needsAction = (policy: PolicySummary) =>
		policy.status === "published" &&
		policy.isMandatory &&
		policy.required &&
		!policy.acknowledged;
	const hasPending = (policy: PolicySummary) => {
		const compliance = complianceOf(policy);
		return !!compliance && compliance.acknowledged < compliance.total;
	};
	const inTab = (policy: PolicySummary) =>
		tab === "all" ||
		(tab === "followup" ? hasPending(policy) : policy.status === "draft");
	const query = search.trim().toLowerCase();
	const visible = policies.data
		.filter(
			(policy) =>
				(!query || policy.title.toLowerCase().includes(query)) &&
				(category === "all" || policy.category === category) &&
				(department === "all" ||
					policy.departments.length === 0 ||
					policy.departments.some((item) => String(item.id) === department)) &&
				(!canManage || inTab(policy)),
		)
		.sort((a, b) => Number(needsAction(b)) - Number(needsAction(a)));

	const published = policies.data.filter((policy) => policy.status === "published");
	const mandatory = published.filter((policy) => policy.isMandatory);
	const totals = mandatory.reduce(
		(sum, policy) => ({
			done: sum.done + (policy.compliance?.acknowledged ?? 0),
			total: sum.total + (policy.compliance?.total ?? 0),
		}),
		{ done: 0, total: 0 },
	);

	const departmentOptions = [
		...new Map(
			policies.data.flatMap((policy) =>
				policy.departments.map((item) => [item.id, item.name] as const),
			),
		),
	];
	const selected = policies.data.find((policy) => policy.id === selectedId) ?? null;

	function exportCsv() {
		const rows = [
			[t("policies.col_policy"), t("policies.category"), t("policies.status"), t("policies.mandatory_badge"), t("policies.acknowledged"), t("policies.col_review")],
			...visible.map((policy) => [
				policy.title,
				policy.category,
				policy.status,
				policy.isMandatory ? "yes" : "no",
				policy.compliance ? `${policy.compliance.acknowledged}/${policy.compliance.total}` : "",
				policy.reviewDate?.slice(0, 10) ?? "",
			]),
		];
		downloadCsv("policies.csv", rows);
	}

	return (
		<div className="mx-auto max-w-[1400px] p-4 md:px-6 md:py-7">
			<PageHeader
				title={t("nav.policies")}
				subtitle={t(canManage ? "policies.desc_admin" : "policies.desc_staff")}
				action={
					canManage && (
						<div className="flex flex-wrap gap-2">
							<button type="button" disabled={visible.length === 0} className={buttonClass("outline")} onClick={exportCsv}>
								<Download size={15} aria-hidden="true" />
								{t("policies.export")}
							</button>
							<Link href="/policies/new" className={buttonClass()}>
								<Plus size={16} aria-hidden="true" />
								{t("policies.new")}
							</Link>
						</div>
					)
				}
			/>

			{canManage && (
				<dl className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
					<Stat label={t("policies.published")} value={published.length} />
					<Stat label={t("policies.mandatory_badge")} value={mandatory.length} />
					<Stat
						label={t("policies.acknowledged")}
						value={totals.total ? `${Math.round((totals.done / totals.total) * 100)}%` : "—"}
					/>
					<Stat label={t("policies.pending")} value={totals.total - totals.done} alert={totals.total > totals.done} />
				</dl>
			)}

			{policies.data.length > 0 && (
				<div className="mt-4 flex flex-wrap items-center gap-2">
					{canManage && (
						<Segmented
							label={t("policies.status")}
							options={(
								[
									["all", policies.data.length],
									["followup", policies.data.filter(hasPending).length],
									["drafts", policies.data.filter((p) => p.status === "draft").length],
								] as const
							).map(([option, count]) => ({
								value: option,
								label: `${t(`policies.tab_${option}`)} · ${count}`,
							}))}
							value={tab}
							onChange={setTab}
						/>
					)}
					<SearchField label={t("policies.search")} value={search} onChange={setSearch} className="min-w-52 flex-1" />
					<FilterSelect label={t("policies.category")} value={category} onChange={setCategory}>
						<option value="all">{t("course.all")}</option>
						{Object.entries(CATEGORY_KEYS).map(([value, key]) => (
							<option key={value} value={value}>
								{t(key)}
							</option>
						))}
					</FilterSelect>
					{departmentOptions.length > 0 && (
						<FilterSelect label={t("users.department")} value={department} onChange={setDepartment}>
							<option value="all">{t("course.all")}</option>
							{departmentOptions.map(([id, name]) => (
								<option key={id} value={id}>
									{name}
								</option>
							))}
						</FilterSelect>
					)}
				</div>
			)}

			{visible.length === 0 ? (
				<StatePanel
					icon={FileText}
					title={t(
						policies.data.length ? "policies.no_policies" : "policies.empty_title",
					)}
					description={
						policies.data.length
							? t("policies.adjust_filters")
							: t(canManage ? "policies.create_first" : "policies.empty_staff")
					}
				/>
			) : (
				<>
					{canManage && (
						<div className="mt-3 hidden items-start gap-4 md:flex">
							<div className="min-w-0 flex-1">
								<ManagerTable policies={visible} selectedId={selectedId} onSelect={setSelectedId} />
							</div>
							{selected && (
								<PolicyPanel key={selected.id} policy={selected} onClose={() => setSelectedId(null)} />
							)}
						</div>
					)}
					<ul className={`mt-4 flex flex-col gap-3 ${canManage ? "md:hidden" : ""}`}>
						{visible.map((policy) => (
							<PolicyCard key={policy.id} policy={policy} />
						))}
					</ul>
				</>
			)}
		</div>
	);
}
