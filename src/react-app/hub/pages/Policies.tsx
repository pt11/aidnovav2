import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CircleCheck, FileText, Plus, Search } from "lucide-react";
import { Link } from "wouter";
import { api } from "../api";
import { useI18n } from "../i18n";
import {
	buttonClass,
	PageError,
	PageHeader,
	PageLoading,
	StatePanel,
} from "../ui";

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
const STATUS_STYLES: Record<PolicyStatus, string> = {
	draft: "border border-border bg-muted text-foreground",
	published: "bg-selected text-selected-foreground",
	archived: "border border-border bg-muted text-muted-foreground",
};

export function StatusBadge({ status }: { status: PolicyStatus }) {
	const { t } = useI18n();
	return (
		<span
			className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}
		>
			{t(`policies.${status}`)}
		</span>
	);
}

export function MandatoryBadge() {
	const { t } = useI18n();
	return (
		<span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
			{t("policies.mandatory_badge")}
		</span>
	);
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
									className="h-1.5 max-w-48 flex-1 overflow-hidden rounded-full bg-muted"
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

function Stat({ label, value }: { label: string; value: string | number }) {
	return (
		<div className="rounded-card border border-border bg-card px-4 py-3">
			<dt className="text-[13px] text-muted-foreground">{label}</dt>
			<dd className="text-2xl font-semibold leading-8">{value}</dd>
		</div>
	);
}

function ManagerTable({ policies }: { policies: PolicySummary[] }) {
	const { t, language } = useI18n();
	const [now] = useState(() => Date.now());
	return (
		<div className="mt-3 overflow-x-auto rounded-card border border-border bg-card">
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
							<tr key={policy.id} className="border-t border-border hover:bg-muted/40">
								<td className="px-4 py-3">
									<Link
										href={`/policies/${policy.id}`}
										className="break-words font-semibold text-foreground no-underline hover:underline"
									>
										{policy.title}
									</Link>
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
												<span className="rounded-full border border-border px-2 py-0.5 text-xs font-medium">
													{t("policies.optional")}
												</span>
											)
										) : (
											<StatusBadge status={policy.status} />
										)}
										{reviewSoon && policy.status === "published" && (
											<span className="rounded-full bg-warning-surface px-2 py-0.5 text-xs font-medium text-warning-foreground">
												{t("policies.review_due")}
											</span>
										)}
									</span>
								</td>
								<td className="px-2 py-3 text-[13px]">
									{compliance ? (
										<span className="font-medium">
											{compliance.acknowledged}/{compliance.total}
										</span>
									) : (
										<span className="text-muted-foreground">
											{policy.status === "published" ? t("policies.not_required") : "—"}
										</span>
									)}
								</td>
								<td className="px-4 py-3 text-[13px] text-muted-foreground">
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
	const [tab, setTab] = useState<"all" | "followup" | "drafts">("all");
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

	return (
		<div className="mx-auto max-w-[1180px] p-4 md:px-6 md:py-7">
			<PageHeader
				title={t("nav.policies")}
				subtitle={t(canManage ? "policies.desc_admin" : "policies.desc_staff")}
				action={
					canManage && (
						<Link href="/policies/new" className={buttonClass("primary", "min-h-9 py-0")}>
							<Plus size={16} aria-hidden="true" />
							{t("policies.new")}
						</Link>
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
					<Stat label={t("policies.pending")} value={totals.total - totals.done} />
				</dl>
			)}

			{policies.data.length > 0 && (
				<div className="mt-4 flex flex-wrap items-center gap-2">
					{canManage && (
						<div role="group" aria-label={t("policies.status")} className="flex flex-wrap gap-1.5">
							{(
								[
									["all", policies.data.length],
									["followup", policies.data.filter(hasPending).length],
									["drafts", policies.data.filter((p) => p.status === "draft").length],
								] as const
							).map(([option, count]) => (
								<button
									key={option}
									type="button"
									aria-pressed={tab === option}
									onClick={() => setTab(option)}
									className={`rounded-full border px-3 py-1 text-[13px] font-medium ${
										tab === option
											? "border-transparent bg-foreground text-background"
											: "border-border bg-card text-foreground hover:bg-muted"
									}`}
								>
									{t(`policies.tab_${option}`)} · {count}
								</button>
							))}
						</div>
					)}
					<div className="relative min-w-52 flex-1">
						<Search
							size={15}
							aria-hidden="true"
							className="pointer-events-none absolute top-2.5 left-2.5 text-muted-foreground"
						/>
						<input
							type="search"
							aria-label={t("policies.search")}
							placeholder={t("policies.search")}
							value={search}
							onChange={(event) => setSearch(event.target.value)}
							className="min-h-9 w-full rounded-md border border-input bg-card py-1.5 pr-3 pl-8"
						/>
					</div>
					<select
						aria-label={t("policies.category")}
						value={category}
						onChange={(event) => setCategory(event.target.value)}
						className="min-h-9 rounded-md border border-input bg-card px-2 text-[13px]"
					>
						<option value="all">{t("policies.all_categories")}</option>
						{Object.entries(CATEGORY_KEYS).map(([value, key]) => (
							<option key={value} value={value}>
								{t(key)}
							</option>
						))}
					</select>
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
						<div className="hidden md:block">
							<ManagerTable policies={visible} />
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
