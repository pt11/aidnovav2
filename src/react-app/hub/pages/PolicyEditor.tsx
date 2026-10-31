import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { Link, useLocation } from "wouter";
import { api, useDepartments } from "../api";
import { useI18n } from "../i18n";
import {
	Alert,
	buttonClass,
	Field,
	PageError,
	PageLoading,
	SelectField,
	TextareaField,
} from "../ui";
import {
	CATEGORY_KEYS,
	POLICIES_KEY,
	StatusBadge,
	type PolicyDraft,
	type PolicyStatus,
} from "./Policies";

function Editor({ existing }: { existing: PolicyDraft | null }) {
	const { t } = useI18n();
	const queryClient = useQueryClient();
	const [, navigate] = useLocation();
	const departments = useDepartments();
	const initial = {
		title: existing?.title ?? "",
		category: existing?.category ?? "General",
		content: existing?.content ?? "",
		isMandatory: existing?.isMandatory ?? false,
		effectiveDate: existing?.effectiveDate?.slice(0, 10) ?? "",
		reviewDate: existing?.reviewDate?.slice(0, 10) ?? "",
		departmentIds: existing?.departments.map((d) => d.id) ?? [],
	};
	const [values, setValues] = useState(initial);
	const [someDepartments, setSomeDepartments] = useState(
		initial.departmentIds.length > 0,
	);
	const status: PolicyStatus = existing?.status ?? "draft";
	const unsaved = JSON.stringify(values) !== JSON.stringify(initial);
	const save = useMutation({
		mutationFn: (nextStatus: PolicyStatus) =>
			api<{ id: number }>(existing ? `/policies/${existing.id}` : "/policies", {
				method: existing ? "PATCH" : "POST",
				body: {
					...values,
					departmentIds: someDepartments ? values.departmentIds : [],
					status: nextStatus,
				},
			}),
		onSuccess: async ({ id }) => {
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: POLICIES_KEY }),
				queryClient.invalidateQueries({ queryKey: ["policy", String(id)] }),
				queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
			]);
			navigate(`/policies/${id}`);
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
		save.mutate(status === "archived" ? "archived" : status);
	}

	return (
		<form onSubmit={submit}>
			<header className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-border bg-card px-4 py-2.5 md:px-6">
				<Link
					href={existing ? `/policies/${existing.id}` : "/policies"}
					aria-label={t("policies.back")}
					className="grid size-8 shrink-0 place-items-center rounded-md border border-border text-foreground"
				>
					<ChevronLeft size={16} aria-hidden="true" />
				</Link>
				<div className="min-w-0 flex-1 basis-48">
					<p className="text-xs text-muted-foreground">{t("nav.policies")}</p>
					<div className="flex flex-wrap items-center gap-2">
						<span className="min-w-0 break-words text-base font-semibold">
							{values.title || t("policies.new")}
						</span>
						<StatusBadge status={status} />
					</div>
				</div>
				{unsaved && (
					<span className="text-[13px] text-muted-foreground">{t("common.unsaved")}</span>
				)}
				{status === "draft" ? (
					<>
						<button
							type="submit"
							disabled={save.isPending}
							className={buttonClass("outline", "min-h-9 py-0")}
						>
							{t("policies.save_draft")}
						</button>
						<button
							type="button"
							disabled={save.isPending}
							className={buttonClass("primary", "min-h-9 py-0")}
							onClick={(event) => {
								if (event.currentTarget.form?.reportValidity()) save.mutate("published");
							}}
						>
							{t("policies.publish")}
						</button>
					</>
				) : (
					<button
						type="submit"
						disabled={save.isPending}
						className={buttonClass("primary", "min-h-9 py-0")}
					>
						{t("common.save")}
					</button>
				)}
			</header>

			<div className="mx-auto flex max-w-[1180px] flex-wrap items-start gap-6 p-4 md:p-6">
				<div className="flex min-w-0 flex-[999_1_560px] flex-col gap-4">
					{save.isError && <Alert>{t("error.generic")}</Alert>}
					{willAskAgain && (
						<p className="rounded-md bg-warning-surface px-3 py-2 text-warning-foreground">
							{t("policies.new_version_warning")}
						</p>
					)}
					<section className="flex flex-col gap-3.5 rounded-card border border-border bg-card p-5">
						<Field
							label={t("policies.title")}
							required
							maxLength={500}
							value={values.title}
							onChange={(event) => set("title", event.target.value)}
						/>
						<div className="grid gap-3 sm:grid-cols-3">
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
					</section>
					<section className="rounded-card border border-border bg-card p-5">
						<TextareaField
							label={t("policies.content")}
							required
							maxLength={100000}
							rows={18}
							value={values.content}
							onChange={(event) => set("content", event.target.value)}
						/>
					</section>
				</div>

				<aside className="flex min-w-0 flex-[1_1_300px] flex-col gap-4 lg:max-w-[360px]">
					<section className="flex flex-col gap-3 rounded-card border border-border bg-card p-4">
						<h2 className="text-[15px] font-semibold">{t("policies.who_for")}</h2>
						<label className="flex items-start gap-2.5">
							<input
								type="checkbox"
								className="mt-0.5 size-[18px] shrink-0 accent-primary"
								checked={values.isMandatory}
								onChange={(event) => set("isMandatory", event.target.checked)}
							/>
							<span>
								<span className="block font-medium">{t("policies.must_acknowledge")}</span>
								<span className="block text-[13px] text-muted-foreground">
									{t("policies.must_acknowledge_hint")}
								</span>
							</span>
						</label>
						<fieldset className="flex flex-col gap-1.5">
							<legend className="pb-1.5 text-[13px] font-medium">
								{t("settings.departments")}
							</legend>
							<label className="flex items-center gap-2 text-[13px]">
								<input
									type="radio"
									name="policy-audience"
									className="accent-primary"
									checked={!someDepartments}
									onChange={() => setSomeDepartments(false)}
								/>
								{t("policies.all_departments")}
							</label>
							<label className="flex items-center gap-2 text-[13px]">
								<input
									type="radio"
									name="policy-audience"
									className="accent-primary"
									checked={someDepartments}
									onChange={() => setSomeDepartments(true)}
								/>
								{t("policies.some_departments")}
							</label>
						</fieldset>
						{someDepartments && (
							<div className="flex flex-col gap-1.5 border-t border-border pt-3">
								{departments.data?.length === 0 && (
									<p className="text-[13px] text-muted-foreground">
										{t("policies.no_departments")}
									</p>
								)}
								{departments.data?.map((department) => (
									<label key={department.id} className="flex items-center gap-2 text-[13px]">
										<input
											type="checkbox"
											className="size-4 shrink-0 accent-primary"
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
						)}
					</section>
					<section className="flex flex-col gap-2 rounded-card border border-border bg-card p-4">
						<h2 className="text-[15px] font-semibold">{t("policies.when_publish")}</h2>
						<ul className="list-disc pl-[18px] text-[13px]">
							<li>{t("policies.when_publish_todo")}</li>
							<li>{t("policies.when_publish_progress")}</li>
							<li>{t("policies.when_publish_version")}</li>
						</ul>
					</section>
					{status !== "draft" && (
						<section className="rounded-card border border-border bg-card p-4">
							<h2 className="text-[15px] font-semibold">
								{t(status === "archived" ? "policies.restore_title" : "policies.archive_title")}
							</h2>
							<p className="mt-1 text-[13px] text-muted-foreground">
								{t(status === "archived" ? "policies.restore_desc" : "policies.archive_desc")}
							</p>
							<button
								type="button"
								disabled={save.isPending}
								className={buttonClass("outline", "mt-2.5 min-h-8 px-3 py-0 text-[13px] font-medium")}
								onClick={() =>
									save.mutate(status === "archived" ? "published" : "archived")
								}
							>
								{t(status === "archived" ? "policies.restore" : "policies.archive")}
							</button>
						</section>
					)}
				</aside>
			</div>
		</form>
	);
}

export function PolicyEditorPage({ id }: { id?: string }) {
	const policy = useQuery({
		queryKey: ["policy", id],
		enabled: id !== undefined,
		queryFn: () => api<PolicyDraft>(`/policies/${id}`),
	});

	if (id === undefined) return <Editor existing={null} />;
	if (policy.isPending) return <PageLoading />;
	if (policy.isError) return <PageError onRetry={() => policy.refetch()} />;
	return <Editor key={id} existing={policy.data} />;
}
