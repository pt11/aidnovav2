import { useRef, useState, type DragEvent, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	File as FileIcon,
	FileText,
	Film,
	Folder,
	FolderOpen,
	Image,
	Link2,
	Lock,
	Music,
	Plus,
	Trash2,
} from "lucide-react";
import { Link, useSearch } from "wouter";
import { api, ApiError, useDepartments } from "../api";
import { useI18n } from "../i18n";
import {
	SearchField,
	ActionsMenu,
	Alert,
	buttonClass,
	ConfirmModal,
	Field,
	FilePreviewDrawer,
	Modal,
	PageError,
	PageHeader,
	PageLoading,
	Segmented,
	SelectField,
	StatePanel,
} from "../ui";
import { ActivityDialog } from "./Reports";

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

const UPLOAD_ERRORS: Record<string, string> = {
	TYPE_NOT_ALLOWED: "files.type_not_allowed",
	FILE_TOO_LARGE: "files.file_too_large",
	STORAGE_FULL: "files.storage_full",
};

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
			<p className="text-xs leading-5 text-muted-foreground">{t("files.link_saved_note")}</p>
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

type UploadStatus = "waiting" | "uploading" | "done" | string;

function AddFilesForm({
	folder,
	onDone,
}: {
	folder: FolderItem | null;
	onDone: () => void;
}) {
	const { t } = useI18n();
	const refresh = useRefreshLibrary();
	const [tab, setTab] = useState<"upload" | "links">("upload");
	const [items, setItems] = useState<{ name: string; size: number; status: UploadStatus }[]>([]);
	const [busy, setBusy] = useState(false);
	const [tooMany, setTooMany] = useState(false);
	const picker = useRef<HTMLInputElement>(null);

	async function upload(list: FileList | null) {
		const chosen = [...(list ?? [])];
		if (chosen.length === 0 || busy) return;
		setTooMany(chosen.length > MAX_BATCH);
		if (chosen.length > MAX_BATCH) return;
		setBusy(true);
		const update = (index: number, status: UploadStatus) =>
			setItems((current) =>
				current.map((item, position) => (position === index ? { ...item, status } : item)),
			);
		setItems(chosen.map((file) => ({ name: file.name, size: file.size, status: "waiting" })));
		for (const [index, file] of chosen.entries()) {
			update(index, "uploading");
			try {
				if (file.size > MAX_FILE_BYTES) throw new ApiError(413, "FILE_TOO_LARGE", "");
				await uploadFile(file, folder?.id ?? null);
				update(index, "done");
			} catch (error) {
				const code = error instanceof ApiError ? error.code : "";
				update(index, t(UPLOAD_ERRORS[code] ?? "files.upload_failed"));
			}
		}
		setBusy(false);
		await refresh();
	}

	function onDrop(event: DragEvent) {
		event.preventDefault();
		void upload(event.dataTransfer.files);
	}

	const tabClass = (active: boolean) =>
		`-mb-px border-b-2 py-2 ${
			active
				? "border-primary font-semibold text-foreground"
				: "border-transparent font-medium text-muted-foreground"
		}`;

	return (
		<div>
			<div role="tablist" className="mb-4 flex gap-4 border-b border-border">
				<button
					type="button"
					role="tab"
					aria-selected={tab === "upload"}
					className={tabClass(tab === "upload")}
					onClick={() => setTab("upload")}
				>
					{t("files.tab_upload")}
				</button>
				<button
					type="button"
					role="tab"
					aria-selected={tab === "links"}
					className={tabClass(tab === "links")}
					onClick={() => setTab("links")}
				>
					{t("files.tab_links")}
				</button>
			</div>
			{tab === "links" ? (
				<LinkForm folderId={folder?.id ?? null} onDone={onDone} />
			) : (
				<div className="flex flex-col gap-3">
					{tooMany && <Alert>{t("files.too_many_at_once", { count: MAX_BATCH })}</Alert>}
					<button
						type="button"
						disabled={busy}
						onClick={() => picker.current?.click()}
						onDragOver={(event) => event.preventDefault()}
						onDrop={onDrop}
						className="rounded-[9px] border-2 border-dashed border-input p-5 text-center hover:bg-muted disabled:opacity-60"
					>
						<span className="block font-medium">{t("files.drop")}</span>
						<span className="mt-1 block text-xs text-muted-foreground">{t("files.limits")}</span>
						<span className="block text-xs text-muted-foreground">{t("files.types")}</span>
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
					{items.length > 0 && (
						<ul aria-live="polite" className="flex flex-col gap-1.5 text-[13px]">
							{items.map((item, index) => {
								const failed = !["waiting", "uploading", "done"].includes(item.status);
								return (
									<li
										key={`${item.name}-${index}`}
										className={`rounded-md border px-2.5 py-1.5 ${
											failed ? "border-destructive" : "border-border"
										}`}
									>
										<span className="flex items-center gap-2">
											<span className="min-w-0 flex-1 break-all">{item.name}</span>
											<span className="shrink-0 text-muted-foreground">
												{formatSize(item.size)}
											</span>
											{item.status === "done" && (
												<span className="shrink-0 font-medium text-selected-foreground">
													{t("files.status_ready")}
												</span>
											)}
											{item.status === "waiting" && (
												<span className="shrink-0 text-muted-foreground">
													{t("files.status_waiting")}
												</span>
											)}
											{item.status === "uploading" && (
												<span className="shrink-0 text-muted-foreground">
													{t("files.status_uploading")}
												</span>
											)}
										</span>
										{failed && (
											<span role="alert" className="block text-xs text-danger-foreground">
												{item.status}
											</span>
										)}
									</li>
								);
							})}
						</ul>
					)}
					{folder && (
						<p className="text-xs leading-5 text-muted-foreground">
							{t("files.folder_rules_hint")}
						</p>
					)}
					<div className="flex justify-end">
						<button
							type="button"
							disabled={busy}
							className={buttonClass("outline")}
							onClick={onDone}
						>
							{t("common.close")}
						</button>
					</div>
				</div>
			)}
		</div>
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

function FileLinks({ file, unlock, onPreview }: { file: FileItem; unlock?: string; onPreview: () => void }) {
	const { t } = useI18n();
	const suffix = unlock ? `?unlock=${encodeURIComponent(unlock)}` : "";
	const actionClass = buttonClass("outline");
	return (
		<>
			{file.canPreview && (
				<button type="button" className={actionClass} onClick={onPreview}>
					{t("files.preview")}
				</button>
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
	onPreview,
}: {
	file: FileItem;
	token?: string;
	onToken: (scope: string, token: string) => void;
	onClose: () => void;
	onPreview: (token?: string) => void;
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
					<button type="button" className={buttonClass("ghost")} onClick={onClose}>
						{t("common.close")}
					</button>
					{file.fileType === "link" ? (
						link.data && (
							<a
								href={link.data.url}
								target="_blank"
								rel="noopener noreferrer"
								className={buttonClass("outline")}
							>
								{t("files.open_link")}
							</a>
						)
					) : (
						<FileLinks file={file} unlock={token} onPreview={() => onPreview(token)} />
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

// Applied one at a time, because each file keeps its own name and PIN.
function BulkFilesDialog({
	mode,
	files,
	folders,
	onDone,
}: {
	mode: "move" | "access";
	files: FileItem[];
	folders: FolderItem[];
	onDone: () => void;
}) {
	const { t } = useI18n();
	const refresh = useRefreshLibrary();
	const [folderId, setFolderId] = useState("");
	const [departmentIds, setDepartmentIds] = useState<number[]>([]);
	const save = useMutation({
		mutationFn: async () => {
			for (const file of files) {
				await api(`/files/${file.id}`, {
					method: "PATCH",
					body: {
						name: file.name,
						folderId: mode === "move" ? (folderId ? Number(folderId) : null) : file.folderId,
						departmentIds: mode === "access" ? departmentIds : file.departments.map((d) => d.id),
					},
				});
			}
		},
		onSettled: refresh,
		onSuccess: onDone,
	});
	const inFolders = files.filter((file) => file.folderId !== null).length;
	return (
		<Modal
			title={t(mode === "move" ? "files.bulk_move" : "files.bulk_access")}
			description={t("users.selected_count", { count: files.length })}
			open
			onClose={onDone}
		>
			<div className="flex flex-col gap-4">
				{save.isError && <Alert>{t("error.generic")}</Alert>}
				{mode === "move" ? (
					<SelectField label={t("files.folder")} value={folderId} onChange={(event) => setFolderId(event.target.value)}>
						<option value="">{t("files.no_folder")}</option>
						{folders.map((folder) => (
							<option key={folder.id} value={folder.id}>
								{folder.name}
							</option>
						))}
					</SelectField>
				) : (
					<>
						<DepartmentChecks selected={departmentIds} onChange={setDepartmentIds} />
						{inFolders > 0 && (
							<p className="text-xs leading-5 text-muted-foreground">{t("files.folder_rules_hint")}</p>
						)}
					</>
				)}
				<div className="flex justify-end gap-2">
					<button type="button" className={buttonClass("outline")} onClick={onDone}>
						{t("common.cancel")}
					</button>
					<button type="button" disabled={save.isPending} className={buttonClass()} onClick={() => save.mutate()}>
						{t("common.save")}
					</button>
				</div>
			</div>
		</Modal>
	);
}

function FileRow({
	file,
	folderName,
	canManage,
	selected,
	onSelect,
	onUnlock,
	onPreview,
	onEdit,
	onDelete,
}: {
	file: FileItem;
	folderName: string | null;
	canManage: boolean;
	selected: boolean;
	onSelect: (selected: boolean) => void;
	onUnlock: () => void;
	onPreview: () => void;
	onEdit: () => void;
	onDelete: () => void;
}) {
	const { t, language } = useI18n();
	const who = file.folderId
		? t("files.same_as_folder")
		: file.departments.length
			? file.departments.map((d) => d.name).join(", ")
			: t("files.everyone");
	const detail = [
		file.fileType === "upload" && file.sizeBytes !== null
			? formatSize(file.sizeBytes)
			: t("files.type_link"),
		file.pinProtected && t("files.pin_protected"),
		folderName,
	]
		.filter(Boolean)
		.join(" · ");
	const open = file.pinProtected
		? [{ label: t("files.unlock"), onSelect: onUnlock }]
		: file.fileType === "link"
			? [{ label: t("files.open_link"), href: file.url ?? "#", newTab: true }]
			: [
					...(file.canPreview
						? [
								{
									label: t("files.preview"),
									onSelect: onPreview,
								},
							]
						: []),
					{ label: t("files.download"), href: `/api/files/${file.id}/download` },
				];
	const [showActivity, setShowActivity] = useState(false);
	const actions = [
		...open,
		...(canManage
			? [
					{ label: t("reports.who_viewed"), onSelect: () => setShowActivity(true), separated: true },
					{ label: t("common.edit"), onSelect: onEdit },
					{ label: t("common.delete"), onSelect: onDelete, danger: true, separated: true },
				]
			: []),
	];

	return (
		<li className={`flex items-center gap-3 border-t border-border px-4 py-2.5 first:border-t-0 ${selected ? "bg-muted/60" : ""}`}>
			{canManage && (
				<input
					type="checkbox"
					aria-label={t("files.select", { name: file.name })}
					className="size-4 shrink-0 accent-primary"
					checked={selected}
					onChange={(event) => onSelect(event.target.checked)}
				/>
			)}
			<span className="grid size-9 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
				<FileKindIcon file={file} />
			</span>
			<div className="min-w-0 flex-1">
				<p className="flex items-center gap-1.5 font-medium">
					<span className="min-w-0 break-words">{file.name}</span>
					{file.pinProtected && (
						<Lock size={13} className="shrink-0 text-muted-foreground" aria-hidden="true" />
					)}
				</p>
				<p className="break-words text-xs text-muted-foreground">{detail}</p>
			</div>
			<p className="hidden w-36 shrink-0 break-words text-[13px] md:block">{who}</p>
			<p className="hidden w-40 shrink-0 text-[13px] text-muted-foreground lg:block">
				{[
					file.uploaderName,
					new Date(file.createdAt).toLocaleDateString(language, { dateStyle: "medium" }),
				]
					.filter(Boolean)
					.join(" · ")}
			</p>
			<ActionsMenu label={t("files.actions_for", { name: file.name })} actions={actions} />
			{showActivity && (
				<ActivityDialog path={`/reports/files/${file.id}/people`} kind="file" onClose={() => setShowActivity(false)} />
			)}
		</li>
	);
}

function StorageUsage() {
	const { t } = useI18n();
	const usage = useQuery({
		queryKey: USAGE_KEY,
		queryFn: () => api<{ usedBytes: number; limitBytes: number | null }>("/files/usage"),
	});
	if (!usage.data || usage.data.limitBytes === null) return null;
	const percent = usage.data.limitBytes
		? Math.min(100, Math.round((usage.data.usedBytes / usage.data.limitBytes) * 100))
		: 100;
	return (
		<div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
			<span
				role="progressbar"
				aria-valuenow={percent}
				aria-valuemin={0}
				aria-valuemax={100}
				aria-label={t("files.storage")}
				className="h-2 w-40 overflow-hidden rounded-full bg-input"
			>
				<span
					className={`block h-full rounded-full ${percent >= 90 ? "bg-destructive" : "bg-primary"}`}
					style={{ width: `${percent}%`, minWidth: usage.data.usedBytes > 0 ? 4 : 0 }}
				/>
			</span>
			{t("files.storage_used", {
				used: formatSize(usage.data.usedBytes),
				limit: formatSize(usage.data.limitBytes),
			})}
		</div>
	);
}

export function FilesPage({ canManage }: { canManage: boolean }) {
	const { t } = useI18n();
	const refresh = useRefreshLibrary();
	const search = useSearch();
	const folderParam = new URLSearchParams(search).get("folder");
	const currentFolderId = folderParam ? Number(folderParam) : null;

	const [query, setQuery] = useState("");
	const [filter, setFilter] = useState<Filter>("all");
	const [modal, setModal] = useState<"folder" | "add" | null>(null);
	const [editingFolder, setEditingFolder] = useState<FolderItem | null>(null);
	const [deletingFolder, setDeletingFolder] = useState<FolderItem | null>(null);
	const [editingFile, setEditingFile] = useState<FileItem | null>(null);
	const [deletingFile, setDeletingFile] = useState<FileItem | null>(null);
	const [unlocking, setUnlocking] = useState<FileItem | null>(null);
	const [tokens, setTokens] = useState<Record<string, string>>({});
	const [previewing, setPreviewing] = useState<{ file: FileItem; token?: string } | null>(null);
	const [selectedIds, setSelectedIds] = useState<number[]>([]);
	const [bulk, setBulk] = useState<"move" | "access" | null>(null);

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
	const selectedFiles = visibleFiles.filter((file) => selectedIds.includes(file.id));
	const allSelected = visibleFiles.length > 0 && selectedFiles.length === visibleFiles.length;

	return (
		<div className="p-4 md:px-6 md:py-7">
			{currentFolderId !== null && (
				<p className="mb-1 flex flex-wrap items-center gap-1.5 text-[13px] text-muted-foreground">
					<Link href="/files" className="no-underline hover:underline">
						{t("files.title")}
					</Link>
					<span aria-hidden="true">/</span>
					<span>{currentFolder?.name}</span>
					{canManage && currentFolder && (
						<button
							type="button"
							className="ml-2 font-medium text-selected-foreground hover:underline"
							onClick={() => setEditingFolder(currentFolder)}
						>
							{t("files.edit_folder")}
						</button>
					)}
				</p>
			)}
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
								className={buttonClass()}
								onClick={() => setModal("add")}
							>
								<Plus size={16} aria-hidden="true" />
								{t("files.add_files")}
							</button>
						</div>
					)
				}
			/>

			{canManage && <StorageUsage />}

			{(files.data.length > 0 || folders.data.length > 0) && (
				<div className="mt-5 flex flex-wrap items-center gap-2">
					<SearchField label={t("files.search")} value={query} onChange={setQuery} className="min-w-52 flex-1" />
					<Segmented
						label={t("files.col_type")}
						options={FILTERS.map((option) => ({
							value: option,
							label: t(`files.filter_${option}`),
						}))}
						value={filter}
						onChange={setFilter}
					/>
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

			{selectedFiles.length > 0 && (
				<div className="mt-4 flex flex-wrap items-center gap-2 rounded-card bg-foreground px-4 py-2.5 text-background">
					<span className="mr-auto text-[13px] font-semibold">
						{t("users.selected_count", { count: selectedFiles.length })}
					</span>
					{(
						[
							["move", "files.bulk_move"],
							["access", "files.bulk_access"],
						] as const
					).map(([value, key]) => (
						<button
							key={value}
							type="button"
							className="rounded-md border border-background/30 px-3 py-1.5 text-[13px] font-medium hover:bg-background/10"
							onClick={() => setBulk(value)}
						>
							{t(key)}
						</button>
					))}
					<button
						type="button"
						className="rounded-md bg-background px-3 py-1.5 text-[13px] font-medium text-foreground"
						onClick={() => setSelectedIds([])}
					>
						{t("files.bulk_clear")}
					</button>
				</div>
			)}

			{visibleFiles.length > 0 && (
				<ul className="mt-4 rounded-card border border-border bg-card">
					<li
						className="hidden items-center gap-3 rounded-t-card bg-background px-4 py-2.5 text-xs font-semibold text-muted-foreground md:flex"
					>
						{canManage && (
							<input
								type="checkbox"
								aria-label={t("files.select_all")}
								className="size-4 shrink-0 accent-primary"
								checked={allSelected}
								onChange={(event) => setSelectedIds(event.target.checked ? visibleFiles.map((file) => file.id) : [])}
							/>
						)}
						{canManage && <span className="w-9 shrink-0" />}
						<span className="min-w-0 flex-1">{t("files.col_name")}</span>
						<span className="w-36 shrink-0">{t("files.col_who")}</span>
						<span className="hidden w-40 shrink-0 lg:block">{t("files.col_added")}</span>
						<span className="w-8 shrink-0" />
					</li>
					{visibleFiles.map((file) => (
						<FileRow
							key={file.id}
							file={file}
							folderName={
								searching
									? (folders.data.find((folder) => folder.id === file.folderId)?.name ?? null)
									: null
							}
							canManage={canManage}
							selected={selectedIds.includes(file.id)}
							onSelect={(selected) =>
								setSelectedIds((current) =>
									selected ? [...current, file.id] : current.filter((id) => id !== file.id),
								)
							}
							onUnlock={() => setUnlocking(file)}
							onPreview={() => setPreviewing({ file })}
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

			{bulk && (
				<BulkFilesDialog
					mode={bulk}
					files={selectedFiles}
					folders={folders.data}
					onDone={() => {
						setBulk(null);
						setSelectedIds([]);
					}}
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
				title={
					currentFolder
						? t("files.add_to", { name: currentFolder.name })
						: t("files.add_files")
				}
				open={modal === "add"}
				onClose={() => setModal(null)}
			>
				<AddFilesForm folder={currentFolder} onDone={() => setModal(null)} />
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
						onPreview={(token) => {
							setPreviewing({ file: unlocking, token });
							setUnlocking(null);
						}}
					/>
				)}
			</Modal>
			{previewing && (
				<FilePreviewDrawer
					name={previewing.file.name}
					mimeType={previewing.file.mimeType}
					src={`/api/files/${previewing.file.id}/download?inline=1${previewing.token ? `&unlock=${encodeURIComponent(previewing.token)}` : ""}`}
					downloadHref={`/api/files/${previewing.file.id}/download${previewing.token ? `?unlock=${encodeURIComponent(previewing.token)}` : ""}`}
					onClose={() => setPreviewing(null)}
				/>
			)}
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
