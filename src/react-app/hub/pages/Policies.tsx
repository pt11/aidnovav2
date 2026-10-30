import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleCheck, FileText, Plus, Search } from "lucide-react";
import { Link, useLocation } from "wouter";
import { api, useDepartments } from "../api";
import { useI18n } from "../i18n";
import {
	Alert,
	buttonClass,
	Field,
	Modal,
	PageError,
	PageHeader,
	PageLoading,
	SelectField,
	StatePanel,
	TextareaField,
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
	draft: "bg-muted text-muted-foreground",
	published: "bg-selected text-selected-foreground",
	archived: "bg-muted text-muted-foreground",
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
		<span className="rounded-full bg-warning-surface px-2 py-0.5 text-xs font-medium text-warning-foreground">
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

export function PolicyForm({
	existing,
	onDone,
}: {
	existing: PolicyDraft | null;
	onDone: (id: number) => void;
}) {
	const { t } = useI18n();
	const queryClient = useQueryClient();
	const departments = useDepartments();
	const [values, setValues] = useState({
		title: existing?.title ?? "",
		category: existing?.category ?? "General",
		content: existing?.content ?? "",
		status: existing?.status ?? ("draft" as PolicyStatus),
		isMandatory: existing?.isMandatory ?? false,
		effectiveDate: existing?.effectiveDate?.slice(0, 10) ?? "",
		reviewDate: existing?.reviewDate?.slice(0, 10) ?? "",
		departmentIds: existing?.departments.map((d) => d.id) ?? [],
	});
	const save = useMutation({
		mutationFn: () =>
			api<{ id: number }>(existing ? `/policies/${existing.id}` : "/policies", {
				method: existing ? "PATCH" : "POST",
				body: values,
			}),
		onSuccess: async ({ id }) => {
			await queryClient.invalidateQueries({ queryKey: POLICIES_KEY });
			onDone(id);
		},
	});
	const set = <K extends keyof typeof values>(name: K, value: (typeof values)[K]) =>
		setValues((current) => ({ ...current, [name]: value }));
	const willAskAgain =
		existing !== null &&
		existing.status !== "draft" &&
		(values.title.trim() !== existing.title ||
			values.content.trim() !== existing.content);

	function submit(event: FormEvent) {
		event.preventDefault();
		save.mutate();
	}

	return (
		<form onSubmit={submit} className="flex flex-col gap-4">
			{save.isError && <Alert>{t("error.generic")}</Alert>}
			<Field
				label={t("policies.title")}
				required
				maxLength={500}
				value={values.title}
				onChange={(event) => set("title", event.target.value)}
			/>
			<div className="grid gap-4 sm:grid-cols-2">
				<SelectField
					label={t("policies.category")}
					value={values.category}
					onChange={(event) => set("category", event.target.value)}
				>
					{Object.entries(CATEGORY_KEYS).map(([value, key]) => (
						<option key={value} value={value}>
							{t(key)}
						</option>
					))}
				</SelectField>
				<SelectField
					label={t("policies.status")}
					value={values.status}
					onChange={(event) => set("status", event.target.value as PolicyStatus)}
				>
					<option value="draft">{t("policies.draft")}</option>
					<option value="published">{t("policies.published")}</option>
					{existing && <option value="archived">{t("policies.archived")}</option>}
				</SelectField>
			</div>
			<TextareaField
				label={t("policies.content")}
				required
				maxLength={100000}
				rows={12}
				value={values.content}
				onChange={(event) => set("content", event.target.value)}
			/>
			{willAskAgain && <p className="rounded-md bg-warning-surface px-3 py-2 text-sm text-warning-foreground">{t("policies.new_version_warning")}</p>}
			<div className="grid gap-4 sm:grid-cols-2">
				<Field
					label={t("policies.effective_date")}
					type="date"
					value={values.effectiveDate}
					onChange={(event) => set("effectiveDate", event.target.value)}
				/>
				<Field
					label={t("policies.review_date")}
					type="date"
					value={values.reviewDate}
					onChange={(event) => set("reviewDate", event.target.value)}
				/>
			</div>
			<label className="flex items-start gap-2.5 text-sm">
				<input
					type="checkbox"
					className="mt-1 size-4 shrink-0"
					checked={values.isMandatory}
					onChange={(event) => set("isMandatory", event.target.checked)}
				/>
				<span>
					<span className="font-medium">{t("policies.mandatory")}</span>
					<span className="block text-muted-foreground">
						{t("policies.mandatory_hint")}
					</span>
				</span>
			</label>
			<fieldset className="flex flex-col gap-2">
				<legend className="text-sm font-medium">{t("policies.who_can_see")}</legend>
				<p className="text-xs leading-5 text-muted-foreground">
					{t("policies.who_can_see_hint")}
				</p>
				{departments.data?.length === 0 && (
					<p className="text-sm text-muted-foreground">
						{t("policies.no_departments")}
					</p>
				)}
				<div className="grid gap-1.5 sm:grid-cols-2">
					{departments.data?.map((department) => (
						<label key={department.id} className="flex items-center gap-2 text-sm">
							<input
								type="checkbox"
								className="size-4 shrink-0"
								checked={values.departmentIds.includes(department.id)}
								onChange={(event) =>
									set(
										"departmentIds",
										event.target.checked
											? [...values.departmentIds, department.id]
											: values.departmentIds.filter((id) => id !== department.id),
									)
								}
							/>
							<span className="min-w-0 break-words">{department.name}</span>
						</label>
					))}
				</div>
			</fieldset>
			<div className="flex justify-end gap-2">
				<button
					type="button"
					className={buttonClass("outline")}
					onClick={() => onDone(existing?.id ?? 0)}
				>
					{t("common.cancel")}
				</button>
				<button type="submit" disabled={save.isPending} className={buttonClass()}>
					{t("common.save")}
				</button>
			</div>
		</form>
	);
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

export function PoliciesPage({ canManage }: { canManage: boolean }) {
	const { t } = useI18n();
	const [, navigate] = useLocation();
	const [search, setSearch] = useState("");
	const [category, setCategory] = useState("all");
	const [status, setStatus] = useState("all");
	const [formOpen, setFormOpen] = useState(false);
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
	const query = search.trim().toLowerCase();
	const visible = policies.data
		.filter(
			(policy) =>
				(!query || policy.title.toLowerCase().includes(query)) &&
				(category === "all" || policy.category === category) &&
				(status === "all" || policy.status === status),
		)
		.sort((a, b) => Number(needsAction(b)) - Number(needsAction(a)));

	return (
		<div className="mx-auto max-w-4xl p-4 md:p-6">
			<PageHeader
				title={t("nav.policies")}
				subtitle={t(canManage ? "policies.desc_admin" : "policies.desc_staff")}
				action={
					canManage && (
						<button
							type="button"
							className={buttonClass()}
							onClick={() => setFormOpen(true)}
						>
							<Plus size={16} aria-hidden="true" />
							{t("policies.new")}
						</button>
					)
				}
			/>

			{policies.data.length > 0 && (
				<div className="mt-5 flex flex-wrap gap-2">
					<div className="relative min-w-52 flex-1">
						<Search
							size={15}
							aria-hidden="true"
							className="pointer-events-none absolute top-3 left-3 text-muted-foreground"
						/>
						<input
							type="search"
							aria-label={t("policies.search")}
							placeholder={t("policies.search")}
							value={search}
							onChange={(event) => setSearch(event.target.value)}
							className="min-h-10 w-full rounded-md border border-input bg-card py-2 pr-3 pl-9 text-sm"
						/>
					</div>
					<select
						aria-label={t("policies.category")}
						value={category}
						onChange={(event) => setCategory(event.target.value)}
						className="min-h-10 rounded-md border border-input bg-card px-2 text-sm"
					>
						<option value="all">{t("policies.all_categories")}</option>
						{Object.entries(CATEGORY_KEYS).map(([value, key]) => (
							<option key={value} value={value}>
								{t(key)}
							</option>
						))}
					</select>
					{canManage && (
						<select
							aria-label={t("policies.status")}
							value={status}
							onChange={(event) => setStatus(event.target.value)}
							className="min-h-10 rounded-md border border-input bg-card px-2 text-sm"
						>
							<option value="all">{t("policies.all_statuses")}</option>
							<option value="draft">{t("policies.draft")}</option>
							<option value="published">{t("policies.published")}</option>
							<option value="archived">{t("policies.archived")}</option>
						</select>
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
				<ul className="mt-4 flex flex-col gap-3">
					{visible.map((policy) => (
						<PolicyCard key={policy.id} policy={policy} />
					))}
				</ul>
			)}

			<Modal
				wide
				title={t("policies.new")}
				open={formOpen}
				onClose={() => setFormOpen(false)}
			>
				<PolicyForm
					existing={null}
					onDone={(id) => {
						setFormOpen(false);
						if (id) navigate(`/policies/${id}`);
					}}
				/>
			</Modal>
		</div>
	);
}
