import { useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	ArrowLeft,
	File as FileIcon,
	FileText,
	Film,
	Folder,
	FolderOpen,
	Image,
	Link2,
	Lock,
	Music,
	Pencil,
	Plus,
	Search,
	Trash2,
	Upload,
} from "lucide-react";
import { Link, useSearch } from "wouter";
import { api, ApiError, useDepartments } from "../api";
import { useI18n } from "../i18n";
import {
	Alert,
	buttonClass,
	ConfirmModal,
	Field,
	Modal,
	PageError,
	PageHeader,
	PageLoading,
	SelectField,
	StatePanel,
} from "../ui";

interface FolderItem {
	id: number;
	name: string;
	pinProtected: boolean;
	departments: { id: number; name: string }[];
	fileCount: number;
}

interface FileItem {
	id: number;
	name: string;
	fileType: "upload" | "link";
	mimeType: string | null;
	sizeBytes: number | null;
	url: string | null;
	folderId: number | null;
	createdAt: string;
	uploaderName: string | null;
	departments: { id: number; name: string }[];
	pinProtected: boolean;
	pinScope: string;
	canPreview: boolean;
}

const FILES_KEY = ["files"];
const FOLDERS_KEY = ["folders"];
const USAGE_KEY = ["files-usage"];
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const MAX_BATCH = 20;
const ACCEPT =
	".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.png,.jpg,.jpeg,.webp,.gif,.mp4,.mov,.webm,.mp3,.m4a,.zip";
const FILTERS = ["all", "document", "image", "video", "link", "other"] as const;
type Filter = (typeof FILTERS)[number];

function kindOf(file: FileItem): Exclude<Filter, "all"> {
	if (file.fileType === "link") return "link";
	const mime = file.mimeType ?? "";
	if (mime.startsWith("image/")) return "image";
	if (mime.startsWith("video/")) return "video";
	if (mime.startsWith("audio/") || mime === "application/zip") return "other";
	return "document";
}

function FileKindIcon({ file }: { file: FileItem }) {
	const mime = file.mimeType ?? "";
	const props = { size: 17, "aria-hidden": true };
	if (file.fileType === "link") return <Link2 {...props} />;
	if (mime.startsWith("image/")) return <Image {...props} />;
	if (mime.startsWith("video/")) return <Film {...props} />;
	if (mime.startsWith("audio/")) return <Music {...props} />;
	if (mime === "application/zip") return <FileIcon {...props} />;
	return <FileText {...props} />;
}

function formatSize(bytes: number) {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
	if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
	return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

async function uploadFile(file: File, folderId: number | null) {
	const params = new URLSearchParams({ name: file.name });
	if (folderId) params.set("folderId", String(folderId));
	const response = await fetch(`/api/files/upload?${params}`, {
		method: "POST",
		body: file,
	});
	if (!response.ok) {
		const data = (await response.json().catch(() => null)) as {
			code?: string;
			message?: string;
		} | null;
		throw new ApiError(response.status, data?.code ?? "UNKNOWN", data?.message ?? "");
	}
}

function useRefreshLibrary() {
	const queryClient = useQueryClient();
	return () =>
		Promise.all([
			queryClient.invalidateQueries({ queryKey: FILES_KEY }),
			queryClient.invalidateQueries({ queryKey: FOLDERS_KEY }),
			queryClient.invalidateQueries({ queryKey: USAGE_KEY }),
		]);
}

function DepartmentChecks({
	selected,
	onChange,
}: {
	selected: number[];
	onChange: (ids: number[]) => void;
}) {
	const { t } = useI18n();
	const departments = useDepartments();
	return (
		<fieldset className="flex flex-col gap-2">
			<legend className="text-sm font-medium">{t("policies.who_can_see")}</legend>
			<p className="text-xs leading-5 text-muted-foreground">
				{t("policies.who_can_see_hint")}
			</p>
			{departments.data?.length === 0 && (
				<p className="text-sm text-muted-foreground">{t("files.no_departments")}</p>
			)}
			<div className="grid gap-1.5 sm:grid-cols-2">
				{departments.data?.map((department) => (
					<label key={department.id} className="flex items-center gap-2 text-sm">
						<input
							type="checkbox"
							className="size-4 shrink-0"
							checked={selected.includes(department.id)}
							onChange={(event) =>
								onChange(
									event.target.checked
										? [...selected, department.id]
										: selected.filter((id) => id !== department.id),
								)
							}
						/>
						<span className="min-w-0 break-words">{department.name}</span>
					</label>
				))}
			</div>
		</fieldset>
	);
}

function PinFields({
	hasPin,
	pin,
	removePin,
	onPinChange,
	onRemoveChange,
}: {
	hasPin: boolean;
	pin: string;
	removePin: boolean;
	onPinChange: (value: string) => void;
	onRemoveChange: (value: boolean) => void;
}) {
	const { t } = useI18n();
	return (
		<div className="flex flex-col gap-2">
			{!removePin && (
				<Field
					label={t(hasPin ? "files.pin_change" : "files.pin_set")}
					type="password"
					inputMode="numeric"
					autoComplete="new-password"
					pattern="[0-9]{4,8}"
					maxLength={8}
					hint={t("files.pin_hint")}
					value={pin}
					onChange={(event) => onPinChange(event.target.value)}
				/>
			)}
			{hasPin && (
				<label className="flex items-center gap-2 text-sm">
					<input
						type="checkbox"
						className="size-4"
						checked={removePin}
						onChange={(event) => onRemoveChange(event.target.checked)}
					/>
					{t("files.pin_remove")}
				</label>
			)}
		</div>
	);
}

function pinValue(pin: string, removePin: boolean) {
	if (removePin) return null;
	return pin === "" ? undefined : pin;
}

const SAVE_ERRORS: Record<string, string> = {
	INVALID_PIN: "files.pin_invalid",
	INVALID_LINK: "form.invalid_link",
};

function FolderForm({
	existing,
	onDone,
}: {
	existing: FolderItem | null;
	onDone: () => void;
}) {
	const { t } = useI18n();
	const refresh = useRefreshLibrary();
	const [name, setName] = useState(existing?.name ?? "");
	const [departmentIds, setDepartmentIds] = useState(
		existing?.departments.map((d) => d.id) ?? [],
	);
	const [pin, setPin] = useState("");
	const [removePin, setRemovePin] = useState(false);
	const save = useMutation({
		mutationFn: () =>
			api(existing ? `/folders/${existing.id}` : "/folders", {
				method: existing ? "PATCH" : "POST",
				body: { name, departmentIds, pin: pinValue(pin, removePin) },
			}),
		onSuccess: async () => {
			await refresh();
			onDone();
		},
	});
	const code = save.error instanceof ApiError ? save.error.code : "";

	function submit(event: FormEvent) {
		event.preventDefault();
		save.mutate();
	}

	return (
		<form onSubmit={submit} className="flex flex-col gap-4">
			{save.isError && <Alert>{t(SAVE_ERRORS[code] ?? "error.generic")}</Alert>}
			<Field
				label={t("files.folder_name")}
				required
				maxLength={255}
				value={name}
				onChange={(event) => setName(event.target.value)}
			/>
			<DepartmentChecks selected={departmentIds} onChange={setDepartmentIds} />
			<PinFields
				hasPin={existing?.pinProtected ?? false}
				pin={pin}
				removePin={removePin}
				onPinChange={setPin}
				onRemoveChange={setRemovePin}
			/>
			<p className="text-xs leading-5 text-muted-foreground">
				{t("files.folder_rules_hint")}
			</p>
			<div className="flex justify-end gap-2">
				<button type="button" className={buttonClass("outline")} onClick={onDone}>
					{t("common.cancel")}
				</button>
				<button type="submit" disabled={save.isPending} className={buttonClass()}>
					{t("common.save")}
				</button>
			</div>
		</form>
	);
}

function LinkForm({
	folderId,
	onDone,
}: {
	folderId: number | null;
	onDone: () => void;
}) {
	const { t } = useI18n();
	const refresh = useRefreshLibrary();
	const [name, setName] = useState("");
	const [url, setUrl] = useState("");
	const save = useMutation({
		mutationFn: () =>
			api("/files/link", { method: "POST", body: { name, url, folderId } }),
		onSuccess: async () => {
			await refresh();
			onDone();
		},
	});
	const code = save.error instanceof ApiError ? save.error.code : "";

	function submit(event: FormEvent) {
		event.preventDefault();
		save.mutate();
	}

	return (
		<form onSubmit={submit} className="flex flex-col gap-4">
			{save.isError && <Alert>{t(SAVE_ERRORS[code] ?? "error.generic")}</Alert>}
			<Field
				label={t("files.link_name")}
				placeholder={t("files.link_name_placeholder")}
				required
				maxLength={500}
				value={name}
				onChange={(event) => setName(event.target.value)}
			/>
			<Field
				label={t("files.link_url")}
				type="url"
				placeholder="https://"
				required
				value={url}
				onChange={(event) => setUrl(event.target.value)}
			/>
			<div className="flex justify-end gap-2">
				<button type="button" className={buttonClass("outline")} onClick={onDone}>
					{t("common.cancel")}
				</button>
				<button type="submit" disabled={save.isPending} className={buttonClass()}>
					{t("files.save_link")}
				</button>
			</div>
		</form>
	);
}

function FileForm({
	file,
	folders,
	onDone,
}: {
	file: FileItem;
	folders: FolderItem[];
	onDone: () => void;
}) {
	const { t } = useI18n();
	const refresh = useRefreshLibrary();
	const [name, setName] = useState(file.name);
	const [folderId, setFolderId] = useState(file.folderId ? String(file.folderId) : "");
	const [departmentIds, setDepartmentIds] = useState(file.departments.map((d) => d.id));
	const [pin, setPin] = useState("");
	const [removePin, setRemovePin] = useState(false);
	const save = useMutation({
		mutationFn: () =>
			api(`/files/${file.id}`, {
				method: "PATCH",
				body: {
					name,
					folderId: folderId ? Number(folderId) : null,
					departmentIds,
					pin: pinValue(pin, removePin),
				},
			}),
		onSuccess: async () => {
			await refresh();
			onDone();
		},
	});
	const code = save.error instanceof ApiError ? save.error.code : "";

	function submit(event: FormEvent) {
		event.preventDefault();
		save.mutate();
	}

	return (
		<form onSubmit={submit} className="flex flex-col gap-4">
			{save.isError && <Alert>{t(SAVE_ERRORS[code] ?? "error.generic")}</Alert>}
			<Field
				label={t("files.col_name")}
				required
				maxLength={500}
				value={name}
				onChange={(event) => setName(event.target.value)}
			/>
			<SelectField
				label={t("files.folder")}
				value={folderId}
				onChange={(event) => setFolderId(event.target.value)}
			>
				<option value="">{t("files.no_folder")}</option>
				{folders.map((folder) => (
					<option key={folder.id} value={folder.id}>
						{folder.name}
					</option>
				))}
			</SelectField>
			{folderId ? (
				<p className="text-xs leading-5 text-muted-foreground">
					{t("files.folder_rules_hint")}
				</p>
			) : (
				<>
					<DepartmentChecks selected={departmentIds} onChange={setDepartmentIds} />
					<PinFields
						hasPin={file.pinProtected && file.folderId === null}
						pin={pin}
						removePin={removePin}
						onPinChange={setPin}
						onRemoveChange={setRemovePin}
					/>
				</>
			)}
			<div className="flex justify-end gap-2">
				<button type="button" className={buttonClass("outline")} onClick={onDone}>
					{t("common.cancel")}
				</button>
				<button type="submit" disabled={save.isPending} className={buttonClass()}>
					{t("common.save")}
				</button>
			</div>
		</form>
	);
}

function FileLinks({ file, unlock }: { file: FileItem; unlock?: string }) {
	const { t } = useI18n();
	const suffix = unlock ? `?unlock=${encodeURIComponent(unlock)}` : "";
	const previewSuffix = unlock ? `${suffix}&inline=1` : "?inline=1";
	const actionClass = buttonClass("outline", "min-h-9 px-3");
	return (
		<>
			{file.canPreview && (
				<a
					href={`/api/files/${file.id}/download${previewSuffix}`}
					target="_blank"
					rel="noopener noreferrer"
					className={actionClass}
				>
					{t("files.preview")}
				</a>
			)}
			<a href={`/api/files/${file.id}/download${suffix}`} className={actionClass}>
				{t("files.download")}
			</a>
		</>
	);
}

function UnlockModal({
	file,
	token,
	onToken,
	onClose,
}: {
	file: FileItem;
	token?: string;
	onToken: (scope: string, token: string) => void;
	onClose: () => void;
}) {
	const { t } = useI18n();
	const [pin, setPin] = useState("");
	const unlock = useMutation({
		mutationFn: () =>
			api<{ token: string; pinScope: string }>(`/files/${file.id}/unlock`, {
				method: "POST",
				body: { pin },
			}),
		onSuccess: (data) => onToken(data.pinScope, data.token),
	});
	const link = useQuery({
		queryKey: ["file-link", file.id, token],
		enabled: file.fileType === "link" && !!token,
		retry: false,
		queryFn: () =>
			api<{ url: string }>(
				`/files/${file.id}/open-link?unlock=${encodeURIComponent(token ?? "")}`,
			),
	});
	const code = unlock.error instanceof ApiError ? unlock.error.code : "";

	if (token) {
		return (
			<div className="flex flex-col gap-4">
				<p className="text-sm text-muted-foreground">{t("files.unlocked")}</p>
				<div className="flex flex-wrap justify-end gap-2">
					<button type="button" className={buttonClass("ghost", "min-h-9 px-3")} onClick={onClose}>
						{t("common.close")}
					</button>
					{file.fileType === "link" ? (
						link.data && (
							<a
								href={link.data.url}
								target="_blank"
								rel="noopener noreferrer"
								className={buttonClass("outline", "min-h-9 px-3")}
							>
								{t("files.open_link")}
							</a>
						)
					) : (
						<FileLinks file={file} unlock={token} />
					)}
				</div>
			</div>
		);
	}

	function submit(event: FormEvent) {
		event.preventDefault();
		unlock.mutate();
	}

	return (
		<form onSubmit={submit} className="flex flex-col gap-4">
			{unlock.isError && (
				<Alert>
					{t(
						code === "WRONG_PIN"
							? "files.pin_wrong"
							: code === "TOO_MANY_ATTEMPTS"
								? "files.pin_too_many"
								: "error.generic",
					)}
				</Alert>
			)}
			<Field
				label={t("files.pin_enter")}
				type="password"
				inputMode="numeric"
				autoComplete="off"
				autoFocus
				required
				maxLength={8}
				value={pin}
				onChange={(event) => setPin(event.target.value)}
			/>
			<div className="flex justify-end gap-2">
				<button type="button" className={buttonClass("outline")} onClick={onClose}>
					{t("common.cancel")}
				</button>
				<button type="submit" disabled={unlock.isPending} className={buttonClass()}>
					{t("files.unlock")}
				</button>
			</div>
		</form>
	);
}

function FileRow({
	file,
	canManage,
	onUnlock,
	onEdit,
	onDelete,
}: {
	file: FileItem;
	canManage: boolean;
	onUnlock: () => void;
	onEdit: () => void;
	onDelete: () => void;
}) {
	const { t, language } = useI18n();
	const details = [
		file.fileType === "upload" && file.sizeBytes !== null
			? formatSize(file.sizeBytes)
			: t("files.type_link"),
		file.uploaderName,
		new Date(file.createdAt).toLocaleDateString(language, { dateStyle: "medium" }),
		file.departments.length > 0 && file.departments.map((d) => d.name).join(", "),
	].filter(Boolean);

	return (
		<li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
			<div className="flex min-w-0 flex-1 basis-64 items-center gap-3">
				<span className="grid size-9 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
					<FileKindIcon file={file} />
				</span>
				<div className="min-w-0">
					<p className="flex items-center gap-1.5 text-sm font-medium">
						<span className="min-w-0 break-words">{file.name}</span>
						{file.pinProtected && (
							<Lock
								size={13}
								className="shrink-0 text-muted-foreground"
								aria-label={t("files.pin_protected")}
							/>
						)}
					</p>
					<p className="mt-0.5 break-words text-xs text-muted-foreground">
						{details.join(" · ")}
					</p>
				</div>
			</div>
			<div className="flex flex-wrap items-center gap-2">
				{file.pinProtected ? (
					<button
						type="button"
						className={buttonClass("outline", "min-h-9 px-3")}
						onClick={onUnlock}
					>
						<Lock size={14} aria-hidden="true" />
						{t("files.unlock")}
					</button>
				) : file.fileType === "link" ? (
					<a
						href={file.url ?? undefined}
						target="_blank"
						rel="noopener noreferrer"
						className={buttonClass("outline", "min-h-9 px-3")}
					>
						{t("files.open_link")}
					</a>
				) : (
					<FileLinks file={file} />
				)}
				{canManage && (
					<>
						<button
							type="button"
							aria-label={`${t("common.edit")}: ${file.name}`}
							className="grid size-9 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
							onClick={onEdit}
						>
							<Pencil size={15} aria-hidden="true" />
						</button>
						<button
							type="button"
							aria-label={`${t("common.delete")}: ${file.name}`}
							className="grid size-9 place-items-center rounded-md text-muted-foreground hover:bg-danger-surface hover:text-danger-foreground"
							onClick={onDelete}
						>
							<Trash2 size={15} aria-hidden="true" />
						</button>
					</>
				)}
			</div>
		</li>
	);
}

function StorageUsage() {
	const { t } = useI18n();
	const usage = useQuery({
		queryKey: USAGE_KEY,
		queryFn: () => api<{ usedBytes: number; limitBytes: number }>("/files/usage"),
	});
	if (!usage.data) return null;
	const percent = Math.min(
		100,
		Math.round((usage.data.usedBytes / usage.data.limitBytes) * 100),
	);
	return (
		<div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
			<span
				role="progressbar"
				aria-valuenow={percent}
				aria-valuemin={0}
				aria-valuemax={100}
				aria-label={t("files.storage")}
				className="h-1.5 w-32 overflow-hidden rounded-full bg-muted"
			>
				<span
					className={`block h-full rounded-full ${percent >= 90 ? "bg-destructive" : "bg-primary"}`}
					style={{ width: `${percent}%` }}
				/>
			</span>
			{t("files.storage_used", {
				used: formatSize(usage.data.usedBytes),
				limit: formatSize(usage.data.limitBytes),
			})}
		</div>
	);
}

const UPLOAD_ERRORS: Record<string, string> = {
	TYPE_NOT_ALLOWED: "files.type_not_allowed",
	FILE_TOO_LARGE: "files.file_too_large",
	STORAGE_FULL: "files.storage_full",
};

export function FilesPage({ canManage }: { canManage: boolean }) {
	const { t } = useI18n();
	const refresh = useRefreshLibrary();
	const search = useSearch();
	const folderParam = new URLSearchParams(search).get("folder");
	const currentFolderId = folderParam ? Number(folderParam) : null;

	const [query, setQuery] = useState("");
	const [filter, setFilter] = useState<Filter>("all");
	const [modal, setModal] = useState<"folder" | "link" | null>(null);
	const [editingFolder, setEditingFolder] = useState<FolderItem | null>(null);
	const [deletingFolder, setDeletingFolder] = useState<FolderItem | null>(null);
	const [editingFile, setEditingFile] = useState<FileItem | null>(null);
	const [deletingFile, setDeletingFile] = useState<FileItem | null>(null);
	const [unlocking, setUnlocking] = useState<FileItem | null>(null);
	const [tokens, setTokens] = useState<Record<string, string>>({});
	const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
	const [uploadErrors, setUploadErrors] = useState<string[]>([]);
	const picker = useRef<HTMLInputElement>(null);

	const files = useQuery({
		queryKey: FILES_KEY,
		queryFn: () => api<{ files: FileItem[] }>("/files"),
		select: (data) => data.files,
	});
	const folders = useQuery({
		queryKey: FOLDERS_KEY,
		queryFn: () => api<{ folders: FolderItem[] }>("/folders"),
		select: (data) => data.folders,
	});
	const removeFile = useMutation({
		mutationFn: (id: number) => api(`/files/${id}`, { method: "DELETE" }),
		onSuccess: async () => {
			await refresh();
			setDeletingFile(null);
		},
	});
	const removeFolder = useMutation({
		mutationFn: (id: number) => api(`/folders/${id}`, { method: "DELETE" }),
		onSuccess: async () => {
			await refresh();
			setDeletingFolder(null);
		},
	});

	if (files.isPending || folders.isPending) return <PageLoading />;
	if (files.isError || folders.isError) {
		return (
			<PageError
				onRetry={() => {
					void files.refetch();
					void folders.refetch();
				}}
			/>
		);
	}

	async function upload(list: FileList | null) {
		const chosen = [...(list ?? [])];
		if (chosen.length === 0) return;
		setUploadErrors([]);
		if (chosen.length > MAX_BATCH) {
			setUploadErrors([t("files.too_many_at_once", { count: MAX_BATCH })]);
			return;
		}
		const errors: string[] = [];
		setProgress({ done: 0, total: chosen.length });
		for (const [index, file] of chosen.entries()) {
			try {
				if (file.size > MAX_FILE_BYTES) {
					throw new ApiError(413, "FILE_TOO_LARGE", "");
				}
				await uploadFile(file, currentFolderId);
			} catch (error) {
				const code = error instanceof ApiError ? error.code : "";
				errors.push(`${file.name}: ${t(UPLOAD_ERRORS[code] ?? "files.upload_failed")}`);
			}
			setProgress({ done: index + 1, total: chosen.length });
		}
		setProgress(null);
		setUploadErrors(errors);
		await refresh();
	}

	const currentFolder =
		folders.data.find((folder) => folder.id === currentFolderId) ?? null;
	const text = query.trim().toLowerCase();
	const searching = text !== "" || filter !== "all";
	// A search looks everywhere, as v1 does. Otherwise show the open folder.
	const visibleFiles = files.data.filter((file) =>
		searching
			? (!text || file.name.toLowerCase().includes(text)) &&
				(filter === "all" || kindOf(file) === filter)
			: file.folderId === currentFolderId,
	);
	const showFolders = !searching && currentFolderId === null;
	const nothingHere =
		visibleFiles.length === 0 && (!showFolders || folders.data.length === 0);

	return (
		<div className="mx-auto max-w-5xl p-4 md:p-6">
			<PageHeader
				title={currentFolder?.name ?? t("files.title")}
				subtitle={currentFolder ? undefined : t(canManage ? "files.desc" : "files.desc_staff")}
				action={
					canManage && (
						<div className="flex flex-wrap gap-2">
							{currentFolderId === null && (
								<button
									type="button"
									className={buttonClass("outline")}
									onClick={() => setModal("folder")}
								>
									<Plus size={16} aria-hidden="true" />
									{t("files.new_folder")}
								</button>
							)}
							<button
								type="button"
								className={buttonClass("outline")}
								onClick={() => setModal("link")}
							>
								<Link2 size={16} aria-hidden="true" />
								{t("files.add_link")}
							</button>
							<button
								type="button"
								disabled={progress !== null}
								className={buttonClass()}
								onClick={() => picker.current?.click()}
							>
								<Upload size={16} aria-hidden="true" />
								{t("files.upload")}
							</button>
							<input
								ref={picker}
								type="file"
								multiple
								hidden
								accept={ACCEPT}
								aria-label={t("files.upload")}
								onChange={(event) => {
									void upload(event.target.files);
									event.target.value = "";
								}}
							/>
						</div>
					)
				}
			/>

			{currentFolderId !== null && (
				<div className="mt-2 flex flex-wrap items-center gap-3">
					<Link
						href="/files"
						className="inline-flex items-center gap-1.5 text-sm text-muted-foreground no-underline hover:text-foreground"
					>
						<ArrowLeft size={15} aria-hidden="true" />
						{t("files.back")}
					</Link>
					{canManage && currentFolder && (
						<button
							type="button"
							className="text-sm font-medium text-selected-foreground hover:underline"
							onClick={() => setEditingFolder(currentFolder)}
						>
							{t("files.edit_folder")}
						</button>
					)}
				</div>
			)}

			{canManage && <StorageUsage />}

			{progress && (
				<p role="status" className="mt-4 text-sm text-muted-foreground">
					{t("files.uploading_count", { done: progress.done, total: progress.total })}
				</p>
			)}
			{uploadErrors.length > 0 && (
				<div className="mt-4 flex flex-col gap-2">
					{uploadErrors.map((error) => (
						<Alert key={error}>{error}</Alert>
					))}
				</div>
			)}

			{(files.data.length > 0 || folders.data.length > 0) && (
				<div className="mt-5 flex flex-wrap items-center gap-2">
					<div className="relative min-w-52 flex-1">
						<Search
							size={15}
							aria-hidden="true"
							className="pointer-events-none absolute top-3 left-3 text-muted-foreground"
						/>
						<input
							type="search"
							aria-label={t("files.search")}
							placeholder={t("files.search")}
							value={query}
							onChange={(event) => setQuery(event.target.value)}
							className="min-h-10 w-full rounded-md border border-input bg-card py-2 pr-3 pl-9 text-sm"
						/>
					</div>
					<div role="group" aria-label={t("files.col_type")} className="flex flex-wrap gap-1">
						{FILTERS.map((option) => (
							<button
								key={option}
								type="button"
								aria-pressed={filter === option}
								onClick={() => setFilter(option)}
								className={`rounded-full px-3 py-1 text-xs font-medium ${
									filter === option
										? "bg-selected text-selected-foreground"
										: "text-muted-foreground hover:bg-muted"
								}`}
							>
								{t(`files.filter_${option}`)}
							</button>
						))}
					</div>
				</div>
			)}

			{showFolders && folders.data.length > 0 && (
				<ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
					{folders.data.map((folder) => (
						<li key={folder.id} className="relative">
							<Link
								href={`/files?folder=${folder.id}`}
								className="flex items-center gap-3 rounded-card border border-border bg-card p-4 pr-11 text-foreground no-underline transition-colors hover:border-input hover:bg-muted/40"
							>
								<Folder size={20} className="shrink-0 text-selected-foreground" aria-hidden="true" />
								<span className="min-w-0">
									<span className="flex items-center gap-1.5 text-sm font-medium">
										<span className="min-w-0 break-words">{folder.name}</span>
										{folder.pinProtected && (
											<Lock
												size={13}
												className="shrink-0 text-muted-foreground"
												aria-label={t("files.pin_protected")}
											/>
										)}
									</span>
									<span className="mt-0.5 block text-xs text-muted-foreground">
										{t("files.item_count", { count: folder.fileCount })}
										{folder.departments.length > 0 &&
											` · ${folder.departments.map((d) => d.name).join(", ")}`}
									</span>
								</span>
							</Link>
							{canManage && (
								<button
									type="button"
									aria-label={`${t("common.delete")}: ${folder.name}`}
									className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-danger-surface hover:text-danger-foreground"
									onClick={() => {
										removeFolder.reset();
										setDeletingFolder(folder);
									}}
								>
									<Trash2 size={14} aria-hidden="true" />
								</button>
							)}
						</li>
					))}
				</ul>
			)}

			{visibleFiles.length > 0 && (
				<ul className="mt-4 divide-y divide-border rounded-card border border-border bg-card">
					{visibleFiles.map((file) => (
						<FileRow
							key={file.id}
							file={file}
							canManage={canManage}
							onUnlock={() => setUnlocking(file)}
							onEdit={() => setEditingFile(file)}
							onDelete={() => {
								removeFile.reset();
								setDeletingFile(file);
							}}
						/>
					))}
				</ul>
			)}

			{nothingHere && (
				<StatePanel
					icon={FolderOpen}
					title={t(
						searching
							? "files.no_results"
							: currentFolderId !== null
								? "files.empty_folder"
								: "files.empty_title",
					)}
					description={
						searching
							? undefined
							: t(canManage ? "files.empty" : "files.empty_staff")
					}
				/>
			)}

			<Modal
				title={t(editingFolder ? "files.edit_folder" : "files.new_folder")}
				open={modal === "folder" || editingFolder !== null}
				onClose={() => {
					setModal(null);
					setEditingFolder(null);
				}}
			>
				<FolderForm
					existing={editingFolder}
					onDone={() => {
						setModal(null);
						setEditingFolder(null);
					}}
				/>
			</Modal>
			<Modal
				title={t("files.add_link")}
				open={modal === "link"}
				onClose={() => setModal(null)}
			>
				<LinkForm folderId={currentFolderId} onDone={() => setModal(null)} />
			</Modal>
			<Modal
				title={t("files.edit_file")}
				open={editingFile !== null}
				onClose={() => setEditingFile(null)}
			>
				{editingFile && (
					<FileForm
						file={editingFile}
						folders={folders.data}
						onDone={() => setEditingFile(null)}
					/>
				)}
			</Modal>
			<Modal
				title={unlocking?.name ?? ""}
				description={t("files.pin_protected")}
				open={unlocking !== null}
				onClose={() => setUnlocking(null)}
			>
				{unlocking && (
					<UnlockModal
						file={unlocking}
						token={tokens[unlocking.pinScope]}
						onToken={(scope, token) =>
							setTokens((current) => ({ ...current, [scope]: token }))
						}
						onClose={() => setUnlocking(null)}
					/>
				)}
			</Modal>
			<ConfirmModal
				title={t("files.delete_confirm_title")}
				description={t("files.delete_file_desc", { name: deletingFile?.name ?? "" })}
				confirmLabel={t("common.delete")}
				open={deletingFile !== null}
				pending={removeFile.isPending}
				failed={removeFile.isError}
				onConfirm={() => deletingFile && removeFile.mutate(deletingFile.id)}
				onClose={() => setDeletingFile(null)}
			/>
			<ConfirmModal
				title={t("files.delete_folder_title")}
				description={t(
					removeFolder.error instanceof ApiError &&
						removeFolder.error.code === "FOLDER_NOT_EMPTY"
						? "files.folder_not_empty"
						: "files.delete_folder_desc",
					{ name: deletingFolder?.name ?? "" },
				)}
				confirmLabel={t("common.delete")}
				open={deletingFolder !== null}
				pending={removeFolder.isPending}
				failed={
					removeFolder.isError &&
					!(
						removeFolder.error instanceof ApiError &&
						removeFolder.error.code === "FOLDER_NOT_EMPTY"
					)
				}
				onConfirm={() => deletingFolder && removeFolder.mutate(deletingFolder.id)}
				onClose={() => setDeletingFolder(null)}
			/>
		</div>
	);
}
