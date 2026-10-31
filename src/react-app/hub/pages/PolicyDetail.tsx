import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CircleCheck, Pencil, SearchX, Trash2 } from "lucide-react";
import { Link, useLocation } from "wouter";
import { api, ApiError } from "../api";
import { useI18n } from "../i18n";
import {
	Alert,
	buttonClass,
	ConfirmModal,
	PageError,
	PageLoading,
	StatePanel,
} from "../ui";
import {
	CATEGORY_KEYS,
	formatPolicyDate,
	MandatoryBadge,
	POLICIES_KEY,
	StatusBadge,
	type PolicyDraft,
} from "./Policies";

interface Policy extends PolicyDraft {
	version: number;
	updatedAt: string;
	acknowledgedAt: string | null;
}

interface CompliancePerson {
	userId: string;
	name: string;
	email: string;
	departmentName: string | null;
	acknowledgedAt: string | null;
	remindedAt: string | null;
}

interface ReminderResult {
	sent: number;
	failed: number;
	skipped: number;
	remaining: number;
}

function formatDay(value: string, language: string) {
	return new Date(value).toLocaleDateString(language, { dateStyle: "medium" });
}

function AcknowledgeBox({
	policy,
	onChanged,
}: {
	policy: Policy;
	onChanged: () => Promise<unknown>;
}) {
	const { t, language } = useI18n();
	const [understood, setUnderstood] = useState(false);
	const acknowledge = useMutation({
		mutationFn: () =>
			api(`/policies/${policy.id}/acknowledge`, {
				method: "POST",
				body: { version: policy.version },
			}),
		onSuccess: onChanged,
		// Someone edited it while this person was reading, so show the new text.
		onError: (error) => {
			if (error instanceof ApiError && error.code === "POLICY_CHANGED") {
				setUnderstood(false);
				void onChanged();
			}
		},
	});

	if (policy.acknowledgedAt) {
		return (
			<p className="flex items-center gap-2 rounded-card border border-border bg-card p-4 text-sm">
				<CircleCheck size={18} className="shrink-0 text-selected-foreground" aria-hidden="true" />
				{t("policies.acknowledged_on", {
					date: formatDay(policy.acknowledgedAt, language),
					version: policy.version,
				})}
			</p>
		);
	}

	const changed =
		acknowledge.error instanceof ApiError &&
		acknowledge.error.code === "POLICY_CHANGED";

	return (
		<div className="sticky bottom-14 z-10 -mx-4 border-t border-border bg-card px-4 py-3.5 md:bottom-0 md:-mx-6 md:px-6">
			{acknowledge.isError && (
				<div className="mb-3">
					<Alert>{t(changed ? "policies.changed" : "error.generic")}</Alert>
				</div>
			)}
			<div className="flex flex-wrap items-center gap-3.5">
				<label className="flex min-w-0 flex-[1_1_320px] items-start gap-2.5">
					<input
						type="checkbox"
						className="mt-0.5 size-5 shrink-0 accent-primary"
						checked={understood}
						onChange={(event) => setUnderstood(event.target.checked)}
					/>
					<span>
						{t("policies.read_understood_named", {
							title: policy.title,
							version: policy.version,
						})}
					</span>
				</label>
				<button
					type="button"
					disabled={!understood || acknowledge.isPending}
					className={buttonClass("primary", "min-h-11 px-5 max-sm:w-full")}
					onClick={() => acknowledge.mutate()}
				>
					{t("policies.acknowledge_this")}
				</button>
			</div>
		</div>
	);
}

function CompliancePanel({ policy }: { policy: Policy }) {
	const { t, language } = useI18n();
	const queryClient = useQueryClient();
	const [now] = useState(() => Date.now());
	const key = ["policy-compliance", policy.id];
	const compliance = useQuery({
		queryKey: key,
		queryFn: () =>
			api<{ people: CompliancePerson[] }>(`/policies/${policy.id}/compliance`),
		select: (data) => data.people,
	});
	const remind = useMutation({
		mutationFn: (userIds?: string[]) =>
			api<ReminderResult>(`/policies/${policy.id}/remind`, {
				method: "POST",
				body: userIds ? { userIds } : {},
			}),
		onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
	});

	if (compliance.isPending) return <PageLoading />;
	if (compliance.isError) return <PageError onRetry={() => compliance.refetch()} />;

	const people = compliance.data;
	const done = people.filter((person) => person.acknowledgedAt).length;
	const canRemind = policy.status === "published" && policy.isMandatory;
	const pending = people.length - done;
	const result = remind.data;
	const recentlyReminded = (person: CompliancePerson) =>
		person.remindedAt !== null &&
		now - new Date(person.remindedAt).getTime() < 24 * 60 * 60 * 1000;

	return (
		<section className="rounded-card border border-border bg-card p-4 md:p-5">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div>
					<h2 className="font-semibold">
						{t("policies.compliance_count", { done, total: people.length })}
					</h2>
					<p className="mt-0.5 text-sm text-muted-foreground">
						{t("policies.compliance_version", { version: policy.version })}
					</p>
				</div>
				{canRemind && pending > 0 && (
					<button
						type="button"
						disabled={remind.isPending}
						className={buttonClass("outline")}
						onClick={() => remind.mutate(undefined)}
					>
						{t("policies.remind_all")}
					</button>
				)}
			</div>
			{remind.isError && (
				<div className="mt-3">
					<Alert>{t("error.generic")}</Alert>
				</div>
			)}
			{result && (
				<p role="status" className="mt-3 text-sm text-muted-foreground">
					{t("policies.remind_result", { sent: result.sent })}
					{result.skipped > 0 &&
						` ${t("policies.remind_skipped", { count: result.skipped })}`}
					{result.remaining > 0 &&
						` ${t("policies.remind_remaining", { count: result.remaining })}`}
					{result.failed > 0 &&
						` ${t("policies.remind_failed", { count: result.failed })}`}
				</p>
			)}
			{people.length === 0 ? (
				<p className="mt-4 text-sm text-muted-foreground">
					{t("policies.no_audience")}
				</p>
			) : (
				<ul className="mt-4 divide-y divide-border border-t border-border">
					{people.map((person) => (
						<li
							key={person.userId}
							className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 py-3"
						>
							<div className="min-w-0">
								<p className="break-words text-sm font-medium">{person.name}</p>
								<p className="break-all text-xs text-muted-foreground">
									{person.email}
									{person.departmentName && ` · ${person.departmentName}`}
								</p>
							</div>
							{person.acknowledgedAt ? (
								<span className="flex items-center gap-1.5 text-sm text-muted-foreground">
									<CircleCheck size={15} aria-hidden="true" />
									{formatDay(person.acknowledgedAt, language)}
								</span>
							) : (
								<div className="flex items-center gap-3">
									<span className="text-sm font-medium text-warning-foreground">
										{t("policies.pending")}
									</span>
									{canRemind &&
										(recentlyReminded(person) ? (
											<span className="text-xs text-muted-foreground">
												{t("policies.reminded")}
											</span>
										) : (
											<button
												type="button"
												disabled={remind.isPending}
												className="text-xs font-medium text-selected-foreground hover:underline disabled:opacity-60"
												onClick={() => remind.mutate([person.userId])}
											>
												{t("policies.remind")}
											</button>
										))}
								</div>
							)}
						</li>
					))}
				</ul>
			)}
		</section>
	);
}

export function PolicyDetailPage({
	id,
	canManage,
}: {
	id: string;
	canManage: boolean;
}) {
	const { t, language } = useI18n();
	const queryClient = useQueryClient();
	const [, navigate] = useLocation();
	const [tab, setTab] = useState<"policy" | "compliance">("policy");
	const [deleting, setDeleting] = useState(false);
	const key = ["policy", id];
	const policy = useQuery({
		queryKey: key,
		retry: false,
		queryFn: () => api<Policy>(`/policies/${id}?view=1`),
	});
	const refresh = () =>
		Promise.all([
			queryClient.invalidateQueries({ queryKey: key }),
			queryClient.invalidateQueries({ queryKey: POLICIES_KEY }),
			queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
			queryClient.invalidateQueries({ queryKey: ["policy-compliance"] }),
		]);
	const remove = useMutation({
		mutationFn: () => api(`/policies/${id}`, { method: "DELETE" }),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: POLICIES_KEY });
			navigate("/policies");
		},
	});

	if (policy.isPending) return <PageLoading />;
	if (policy.isError) {
		if (policy.error instanceof ApiError && policy.error.status === 404) {
			return (
				<StatePanel
					icon={SearchX}
					title={t("policies.not_found")}
					action={
						<Link href="/policies" className={buttonClass("outline")}>
							{t("policies.back")}
						</Link>
					}
				/>
			);
		}
		return <PageError onRetry={() => policy.refetch()} />;
	}

	const data = policy.data;
	const facts = [
		data.effectiveDate && {
			label: t("policies.effective_date"),
			value: formatPolicyDate(data.effectiveDate, language),
		},
		data.reviewDate && {
			label: t("policies.review_date"),
			value: formatPolicyDate(data.reviewDate, language),
		},
		{
			label: t("policies.who_can_see"),
			value: data.departments.length
				? data.departments.map((department) => department.name).join(", ")
				: t("policies.everyone"),
		},
	].filter((fact) => !!fact);

	return (
		<div className="mx-auto max-w-3xl p-4 md:p-6">
			<Link
				href="/policies"
				className="inline-flex items-center gap-1.5 text-sm text-muted-foreground no-underline hover:text-foreground"
			>
				<ArrowLeft size={15} aria-hidden="true" />
				{t("policies.back")}
			</Link>

			<div className="mt-3 flex flex-wrap items-start justify-between gap-3">
				<div className="min-w-0">
					<h1 className="break-words text-[30px] font-semibold leading-[38px] tracking-tight">
						{data.title}
					</h1>
					<div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
						{data.isMandatory && <MandatoryBadge />}
						{data.status !== "published" && <StatusBadge status={data.status} />}
						<span>
							{t(CATEGORY_KEYS[data.category] ?? "policies.cat_general")}
							{" · "}
							{t("policies.version", { version: data.version })}
						</span>
					</div>
				</div>
				{canManage && (
					<div className="flex gap-2">
						<Link href={`/policies/${data.id}/edit`} className={buttonClass("outline")}>
							<Pencil size={15} aria-hidden="true" />
							{t("common.edit")}
						</Link>
						<button
							type="button"
							aria-label={t("common.delete")}
							className={buttonClass("ghost", "px-3")}
							onClick={() => {
								remove.reset();
								setDeleting(true);
							}}
						>
							<Trash2 size={15} aria-hidden="true" />
						</button>
					</div>
				)}
			</div>

			{canManage && (
				<div
					role="tablist"
					className="mt-5 flex gap-1 border-b border-border"
				>
					{(["policy", "compliance"] as const).map((option) => (
						<button
							key={option}
							type="button"
							role="tab"
							aria-selected={tab === option}
							onClick={() => setTab(option)}
							className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
								tab === option
									? "border-primary text-foreground"
									: "border-transparent text-muted-foreground hover:text-foreground"
							}`}
						>
							{t(option === "policy" ? "policies.tab_policy" : "policies.tab_compliance")}
						</button>
					))}
				</div>
			)}

			<div className="mt-5 flex flex-col gap-4">
				{tab === "compliance" ? (
					<CompliancePanel policy={data} />
				) : (
					<>
						<dl className="grid gap-3 rounded-card border border-border bg-card p-4 sm:grid-cols-3">
							{facts.map((fact) => (
								<div key={fact.label} className="min-w-0">
									<dt className="text-xs text-muted-foreground">{fact.label}</dt>
									<dd className="mt-0.5 break-words text-sm font-medium">{fact.value}</dd>
								</div>
							))}
						</dl>
						<article className="whitespace-pre-wrap break-words rounded-card border border-border bg-card p-5 text-base leading-7 md:px-9 md:py-8">
							{data.content}
						</article>
						{data.status === "published" && (
							<AcknowledgeBox policy={data} onChanged={refresh} />
						)}
					</>
				)}
			</div>

			<ConfirmModal
				title={t("policies.delete_title")}
				description={t("policies.delete_desc", { title: data.title })}
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
