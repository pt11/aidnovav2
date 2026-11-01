import { lazy, Suspense, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, FileText, Link2 } from "lucide-react";
import { Link, useLocation, useSearch } from "wouter";
import { api, ApiError, useDepartments } from "../api";
import { useI18n } from "../i18n";
import { fileSize } from "./Capacity";
import {
	Alert,
	buttonClass,
	Field,
	PageError,
	PageLoading,
	SelectField,
} from "../ui";
import {
	CATEGORY_KEYS,
	POLICIES_KEY,
	StatusBadge,
	type PolicyDraft,
	type PolicyStatus,
} from "./Policies";

const RichEditor = lazy(() => import("../RichEditor"));
const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024;
const ATTACHMENT_ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.webp";
const ATTACHMENT_ERRORS: Record<string, string> = {
	TYPE_NOT_ALLOWED: "files.type_not_allowed",
	FILE_TOO_LARGE: "files.file_too_large",
	STORAGE_FULL: "files.storage_full",
	INVALID_LINK: "form.invalid_link",
};

type AttachmentDraft =
	| { type: "file"; name: string; sizeBytes: number | null; file?: File }
	| { type: "link"; name: string; url: string }
	| null;

async function saveAttachment(policyId: number, attachment: AttachmentDraft) {
	if (attachment === null) {
		await api(`/policies/${policyId}/attachment`, { method: "DELETE" });
	} else if (attachment.type === "link") {
		await api(`/policies/${policyId}/attachment/link`, {
			method: "PUT",
			body: { name: attachment.name, url: attachment.url },
		});
	} else if (attachment.file) {
		const response = await fetch(`/api/policies/${policyId}/attachment/file?${new URLSearchParams({ name: attachment.file.name })}`, {
			method: "PUT",
			body: attachment.file,
		});
		if (!response.ok) {
			const data = (await response.json().catch(() => null)) as { code?: string } | null;
			throw new ApiError(response.status, data?.code ?? "UNKNOWN", "");
		}
	}
}

function AttachmentSection({
	value,
	error,
	onChange,
	onError,
}: {
	value: AttachmentDraft;
	error: string;
	onChange: (value: AttachmentDraft) => void;
	onError: (key: string) => void;
}) {
	const { t } = useI18n();
	const input = useRef<HTMLInputElement>(null);
	const [linking, setLinking] = useState(false);
	const [url, setUrl] = useState("");
	const [name, setName] = useState("");
	const pick = () => input.current?.click();
	function addLink() {
		if (!/^https?:\/\/\S+$/.test(url.trim())) {
			onError("form.invalid_link");
			return;
		}
		onError("");
		onChange({ type: "link", url: url.trim(), name: name.trim() || url.trim() });
		setLinking(false);
		setUrl("");
		setName("");
	}
	return (
		<section className="flex flex-col gap-2.5 rounded-card border border-border bg-card p-5">
			<h2 className="text-base font-semibold">
				{t("policies.attachment")}{" "}
				<span className="text-[13px] font-normal text-muted-foreground">· {t("policies.attachment_optional")}</span>
			</h2>
			{error && <Alert>{t(error)}</Alert>}
			<input
				ref={input}
				type="file"
				accept={ATTACHMENT_ACCEPT}
				className="sr-only"
				aria-label={t("policies.attachment_upload")}
				onChange={(event) => {
					const file = event.target.files?.[0];
					event.target.value = "";
					if (!file) return;
					if (file.size > MAX_ATTACHMENT_BYTES) {
						onError("files.file_too_large");
						return;
					}
					onError("");
					setLinking(false);
					onChange({ type: "file", name: file.name, sizeBytes: file.size, file });
				}}
			/>
			{value && (
				<div className="flex flex-wrap items-center gap-3 rounded-[9px] border border-border p-3">
					<span className="grid size-9 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
						{value.type === "link" ? <Link2 size={17} aria-hidden="true" /> : <FileText size={17} aria-hidden="true" />}
					</span>
					<span className="min-w-0 flex-[1_1_200px]">
						<span className="block break-words font-medium">{value.name}</span>
						<span className="block break-all text-xs text-muted-foreground">
							{value.type === "link"
								? value.url
								: value.sizeBytes !== null
									? fileSize(value.sizeBytes)
									: ""}
						</span>
					</span>
					<button type="button" className={buttonClass("outline", "min-h-8 px-3 py-0")} onClick={value.type === "file" ? pick : () => setLinking(true)}>
						{t("policies.attachment_replace")}
					</button>
					<button
						type="button"
						className="min-h-8 px-2.5 text-[13px] font-medium text-danger-foreground"
						onClick={() => onChange(null)}
					>
						{t("policies.attachment_remove")}
					</button>
				</div>
			)}
			{!value && !linking && (
				<div className="flex flex-wrap gap-2">
					<button type="button" className={buttonClass("outline")} onClick={pick}>
						<FileText size={15} aria-hidden="true" />
						{t("policies.attachment_upload")}
					</button>
					<button type="button" className={buttonClass("outline")} onClick={() => setLinking(true)}>
						<Link2 size={15} aria-hidden="true" />
						{t("policies.attachment_link")}
					</button>
				</div>
			)}
			{linking && (
				<div className="flex flex-col gap-3 rounded-[9px] border border-border p-3">
					<Field label={t("policies.attachment_url")} type="url" placeholder="https://" value={url} onChange={(event) => setUrl(event.target.value)} />
					<Field label={t("policies.attachment_name")} hint={t("cb.optional")} maxLength={300} value={name} onChange={(event) => setName(event.target.value)} />
					<div className="flex justify-end gap-2">
						<button type="button" className={buttonClass("ghost")} onClick={() => setLinking(false)}>
							{t("common.cancel")}
						</button>
						<button type="button" className={buttonClass("outline")} onClick={addLink}>
							{t("policies.attachment_add")}
						</button>
					</div>
				</div>
			)}
			<p className="text-xs text-muted-foreground">{t("policies.attachment_hint")}</p>
		</section>
	);
}

function Editor({ existing, attachmentFailed = false }: { existing: PolicyDraft | null; attachmentFailed?: boolean }) {
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
	const [attachment, setAttachment] = useState<AttachmentDraft>(() => {
		const saved = existing?.attachment;
		if (!saved) return null;
		return saved.type === "link"
			? { type: "link", name: saved.name, url: saved.url ?? "" }
			: { type: "file", name: saved.name, sizeBytes: saved.sizeBytes };
	});
	const [attachmentDirty, setAttachmentDirty] = useState(false);
	const [attachmentError, setAttachmentError] = useState(attachmentFailed ? "policies.attachment_failed" : "");
	const [contentMissing, setContentMissing] = useState(false);
	const unsaved = attachmentDirty || JSON.stringify(values) !== JSON.stringify(initial);
	const save = useMutation({
		mutationFn: async (nextStatus: PolicyStatus) => {
			const body = {
				...values,
				departmentIds: someDepartments ? values.departmentIds : [],
				status: nextStatus,
				attachmentChanged: attachmentDirty,
			};
			if (existing) {
				if (attachmentDirty) await saveAttachment(existing.id, attachment);
				return api<{ id: number }>(`/policies/${existing.id}`, { method: "PATCH", body });
			}
			const created = await api<{ id: number }>("/policies", { method: "POST", body });
			// The policy is safe by now, so a failed upload is fixed from its edit page.
			if (attachmentDirty && attachment) {
				try {
					await saveAttachment(created.id, attachment);
				} catch {
					navigate(`/policies/${created.id}/edit?attachment=failed`);
					throw new ApiError(0, "ATTACHMENT_FAILED", "");
				}
			}
			return created;
		},
		onError: (error) => {
			const code = error instanceof ApiError ? error.code : "";
			if (ATTACHMENT_ERRORS[code]) setAttachmentError(ATTACHMENT_ERRORS[code]);
		},
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
		(attachmentDirty ||
			values.title.trim() !== existing.title ||
			values.content.trim() !== existing.content);
	const changeAttachment = (next: AttachmentDraft) => {
		setAttachment(next);
		setAttachmentDirty(true);
	};
	function saveAs(nextStatus: PolicyStatus) {
		if (!values.content.trim()) {
			setContentMissing(true);
			return;
		}
		setContentMissing(false);
		save.mutate(nextStatus);
	}

	function submit(event: FormEvent) {
		event.preventDefault();
		saveAs(status === "archived" ? "archived" : status);
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
						<h1 className="min-w-0 break-words text-base font-semibold">
							{values.title || t("policies.new")}
						</h1>
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
							className={buttonClass("outline")}
						>
							{t("policies.save_draft")}
						</button>
						<button
							type="button"
							disabled={save.isPending}
							className={buttonClass()}
							onClick={(event) => {
								if (event.currentTarget.form?.reportValidity()) saveAs("published");
							}}
						>
							{t("policies.publish")}
						</button>
					</>
				) : (
					<button
						type="submit"
						disabled={save.isPending}
						className={buttonClass()}
					>
						{t("common.save")}
					</button>
				)}
			</header>

			<div className="mx-auto flex max-w-[1180px] flex-wrap items-start gap-6 p-4 md:p-6">
				<div className="flex min-w-0 flex-[999_1_560px] flex-col gap-4">
					{save.isError && !ATTACHMENT_ERRORS[save.error instanceof ApiError ? save.error.code : ""] && <Alert>{t("error.generic")}</Alert>}
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
					<section className="flex flex-col gap-2.5 rounded-card border border-border bg-card p-5">
						<h2 className="text-base font-semibold">{t("policies.content")}</h2>
						<Suspense fallback={<PageLoading />}>
							<RichEditor
								label={t("policies.content")}
								initial={existing?.content ?? ""}
								onChange={(value) => {
									setContentMissing(false);
									set("content", value);
								}}
							/>
						</Suspense>
						{contentMissing && <p className="text-xs text-danger-foreground">{t("policies.content_required")}</p>}
					</section>
					<AttachmentSection value={attachment} error={attachmentError} onChange={changeAttachment} onError={setAttachmentError} />
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
	const search = useSearch();
	const policy = useQuery({
		queryKey: ["policy", id],
		enabled: id !== undefined,
		queryFn: () => api<PolicyDraft>(`/policies/${id}`),
	});

	const attachmentFailed = new URLSearchParams(search).get("attachment") === "failed";

	if (id === undefined) return <Editor existing={null} />;
	if (policy.isPending) return <PageLoading />;
	if (policy.isError) return <PageError onRetry={() => policy.refetch()} />;
	return <Editor key={id} existing={policy.data} attachmentFailed={attachmentFailed} />;
}
