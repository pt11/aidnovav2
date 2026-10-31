import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, FileText, Folder, FolderOpen, Link2, Plus, Upload, X } from "lucide-react";
import { api, ApiError } from "../api";
import { useI18n } from "../i18n";
import {
	ActionsMenu,
	Alert,
	buttonClass,
	canPreviewFile,
	ConfirmModal,
	DataTable,
	Field,
	FilePreviewDrawer,
	Modal,
	PageError,
	PageLoading,
	SearchField,
	SelectField,
	StatePanel,
} from "../ui";
import { fileSize } from "./Capacity";

export interface ProjectFileVersion {
	version: number;
	name: string;
	mimeType: string;
	sizeBytes: number;
	note: string | null;
	createdAt: string;
	uploaderName: string | null;
}

export interface ProjectFile {
	id: number;
	folderId: number | null;
	currentVersion: number;
	updatedAt: string;
	orgFileId: number | null;
	unavailable: boolean;
	name: string | null;
	mimeType: string | null;
	sizeBytes: number | null;
	note: string | null;
	updatedBy: string | null;
	versions: ProjectFileVersion[];
}

export interface ProjectFilesData {
	folders: { id: number; name: string; parentId: number | null }[];
	files: ProjectFile[];
	usedBytes: number;
	canContribute: boolean;
	canManage: boolean;
}

const MAX_BYTES = 50 * 1024 * 1024;
const ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.png,.jpg,.jpeg,.webp,.zip";
const UPLOAD_ERRORS: Record<string, string> = {
	TYPE_NOT_ALLOWED: "files.type_not_allowed",
	FILE_TOO_LARGE: "files.file_too_large",
	STORAGE_FULL: "files.storage_full",
	NOTE_REQUIRED: "pr.note_required",
};

export function projectFilesKey(projectId: number) {
	return ["project-files", projectId];
}

export function useProjectFiles(projectId: number) {
	return useQuery({
		queryKey: projectFilesKey(projectId),
		queryFn: () => api<ProjectFilesData>(`/projects/${projectId}/files`),
	});
}

export function typeLabel(name: string | null) {
	return (name?.split(".").pop() ?? "").toUpperCase().slice(0, 4);
}

export function FileBadge({ name }: { name: string | null }) {
	return (
		<span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-md bg-muted text-[10px] font-bold text-muted-foreground">
			{typeLabel(name) || <FileText size={16} />}
		</span>
	);
}

async function uploadTo(url: string, file: File) {
	const response = await fetch(url, { method: "POST", body: file });
	if (!response.ok) {
		const data = (await response.json().catch(() => null)) as { code?: string } | null;
		throw new ApiError(response.status, data?.code ?? "UNKNOWN", "");
	}
	return (await response.json()) as { id?: number; version?: number };
}

export function uploadProjectFile(projectId: number, file: File, folderId: number | null) {
	const params = new URLSearchParams({ name: file.name });
	if (folderId) params.set("folderId", String(folderId));
	return uploadTo(`/api/projects/${projectId}/files?${params}`, file);
}

function downloadUrl(projectId: number, file: ProjectFile, version?: number, inline = false) {
	if (file.orgFileId) return `/api/files/${file.orgFileId}/download${inline ? "?inline=1" : ""}`;
	const params = new URLSearchParams();
	if (version) params.set("version", String(version));
	if (inline) params.set("inline", "1");
	const query = params.toString();
	return `/api/projects/${projectId}/files/${file.id}/download${query ? `?${query}` : ""}`;
}

function NewVersionDialog({ projectId, file, onClose }: { projectId: number; file: ProjectFile; onClose: () => void }) {
	const { t } = useI18n();
	const queryClient = useQueryClient();
	const input = useRef<HTMLInputElement>(null);
	const [chosen, setChosen] = useState<File | null>(null);
	const [note, setNote] = useState("");
	const save = useMutation({
		mutationFn: () => {
			const params = new URLSearchParams({ name: chosen?.name ?? "", note });
			return uploadTo(`/api/projects/${projectId}/files/${file.id}/versions?${params}`, chosen as File);
		},
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: projectFilesKey(projectId) });
			onClose();
		},
	});
	const code = save.error instanceof ApiError ? save.error.code : "";
	const tooBig = !!chosen && chosen.size > MAX_BYTES;
	return (
		<Modal title={t("pr.new_version_of", { name: file.name ?? "" })} description={t("pr.new_version_desc")} open onClose={onClose}>
			<div className="flex flex-col gap-3.5">
				{save.isError && <Alert>{t(UPLOAD_ERRORS[code] ?? "error.generic")}</Alert>}
				{tooBig && <Alert>{t("files.file_too_large")}</Alert>}
				<input ref={input} type="file" accept={ACCEPT} className="sr-only" aria-label={t("pr.choose_file")} onChange={(event) => setChosen(event.target.files?.[0] ?? null)} />
				<div className="flex items-center gap-2.5 rounded-[9px] border border-border p-2.5">
					<FileBadge name={chosen?.name ?? null} />
					<span className="min-w-0 flex-1 truncate text-sm">{chosen ? `${chosen.name} · ${fileSize(chosen.size)}` : t("pr.no_file_chosen")}</span>
					<button type="button" className={buttonClass("outline", "min-h-8 px-3 py-0")} onClick={() => input.current?.click()}>{t("pr.choose_file")}</button>
				</div>
				<Field label={t("pr.what_changed")} hint={t("pr.what_changed_hint")} required maxLength={300} value={note} onChange={(event) => setNote(event.target.value)} />
				<div className="flex justify-end gap-2">
					<button type="button" className={buttonClass("outline")} onClick={onClose}>{t("common.cancel")}</button>
					<button type="button" disabled={!chosen || tooBig || !note.trim() || save.isPending} className={buttonClass()} onClick={() => save.mutate()}>
						{t("pr.upload_as", { version: file.currentVersion + 1 })}
					</button>
				</div>
			</div>
		</Modal>
	);
}

function LinkFromFilesDialog({ projectId, folderId, onClose }: { projectId: number; folderId: number | null; onClose: () => void }) {
	const { t } = useI18n();
	const queryClient = useQueryClient();
	const [choice, setChoice] = useState("");
	const library = useQuery({
		queryKey: ["files"],
		queryFn: () =>
			api<{ files: { id: number; name: string; fileType: string; pinProtected: boolean; departments: unknown[]; folderId: number | null }[] }>("/files"),
		select: (data) => data.files,
	});
	const link = useMutation({
		mutationFn: () => api(`/projects/${projectId}/files/link`, { method: "POST", body: { orgFileId: Number(choice), folderId } }),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: projectFilesKey(projectId) });
			onClose();
		},
	});
	const code = link.error instanceof ApiError ? link.error.code : "";
	const options = library.data?.filter((file) => file.fileType === "upload" && !file.pinProtected && file.departments.length === 0) ?? [];
	return (
		<Modal title={t("pr.link_from_files")} description={t("pr.link_desc")} open onClose={onClose}>
			<div className="flex flex-col gap-3.5">
				{link.isError && <Alert>{t(code === "CANT_LINK" ? "pr.cant_link" : code === "ALREADY_LINKED" ? "pr.already_linked" : "error.generic")}</Alert>}
				<SelectField label={t("nav.files")} value={choice} onChange={(event) => setChoice(event.target.value)}>
					<option value="">{t("cb.choose")}</option>
					{options.map((file) => <option key={file.id} value={file.id}>{file.name}</option>)}
				</SelectField>
				{library.isSuccess && options.length === 0 && <p className="text-[13px] text-muted-foreground">{t("pr.nothing_to_link")}</p>}
				<div className="flex justify-end gap-2">
					<button type="button" className={buttonClass("outline")} onClick={onClose}>{t("common.cancel")}</button>
					<button type="button" disabled={!choice || link.isPending} className={buttonClass()} onClick={() => link.mutate()}>{t("pr.link")}</button>
				</div>
			</div>
		</Modal>
	);
}

interface Upload {
	key: string;
	name: string;
	state: "waiting" | "uploading" | "done" | "failed";
	error?: string;
}

export function ProjectFilesTab({ projectId, projectName }: { projectId: number; projectName: string }) {
	const { t, language } = useI18n();
	const queryClient = useQueryClient();
	const input = useRef<HTMLInputElement>(null);
	const data = useProjectFiles(projectId);
	const [folderId, setFolderId] = useState<number | null>(null);
	const [query, setQuery] = useState("");
	const [selectedId, setSelectedId] = useState<number | null>(null);
	const [uploads, setUploads] = useState<Upload[]>([]);
	const [naming, setNaming] = useState(false);
	const [folderName, setFolderName] = useState("");
	const [versioning, setVersioning] = useState<ProjectFile | null>(null);
	const [linking, setLinking] = useState(false);
	const [deleting, setDeleting] = useState<ProjectFile | null>(null);
	const [preview, setPreview] = useState<{ file: ProjectFile; version?: ProjectFileVersion } | null>(null);
	const refresh = () => queryClient.invalidateQueries({ queryKey: projectFilesKey(projectId) });
	const addFolder = useMutation({
		mutationFn: (body: { name?: string; standard?: boolean; parentId?: number | null }) => api(`/projects/${projectId}/folders`, { method: "POST", body }),
		onSuccess: async () => {
			setNaming(false);
			setFolderName("");
			await refresh();
		},
	});
	const removeFolder = useMutation({
		mutationFn: (id: number) => api(`/projects/${projectId}/folders/${id}`, { method: "DELETE" }),
		onSuccess: async () => {
			setFolderId(null);
			await refresh();
		},
	});
	const removeFile = useMutation({
		mutationFn: (id: number) => api(`/projects/${projectId}/files/${id}`, { method: "DELETE" }),
		onSuccess: async () => {
			setDeleting(null);
			setSelectedId(null);
			await refresh();
		},
	});
	const restore = useMutation({
		mutationFn: ({ id, version }: { id: number; version: number }) => api(`/projects/${projectId}/files/${id}/restore`, { method: "POST", body: { version } }),
		onSuccess: refresh,
	});
	const move = useMutation({
		mutationFn: ({ id, folder }: { id: number; folder: number | null }) => api(`/projects/${projectId}/files/${id}`, { method: "PATCH", body: { folderId: folder } }),
		onSuccess: refresh,
	});

	async function startUploads(files: File[]) {
		const started = files.map((file, index) => ({ key: `${Date.now()}-${index}`, name: file.name, state: "waiting" as Upload["state"] }));
		setUploads(started);
		for (const [index, file] of files.entries()) {
			const update = (patch: Partial<Upload>) =>
				setUploads((current) => current.map((item) => (item.key === started[index].key ? { ...item, ...patch } : item)));
			if (file.size > MAX_BYTES) {
				update({ state: "failed", error: "files.file_too_large" });
				continue;
			}
			update({ state: "uploading" });
			try {
				await uploadProjectFile(projectId, file, folderId);
				update({ state: "done" });
			} catch (error) {
				const code = error instanceof ApiError ? error.code : "";
				update({ state: "failed", error: UPLOAD_ERRORS[code] ?? "cb.file_failed" });
			}
			await refresh();
		}
	}

	if (data.isPending) return <PageLoading />;
	if (data.isError) return <PageError onRetry={() => data.refetch()} />;
	const { folders, files, usedBytes, canContribute, canManage } = data.data;
	const text = query.trim().toLowerCase();
	const countIn = (id: number) => files.filter((file) => file.folderId === id).length;
	const visible = files.filter((file) => (text ? (file.name ?? "").toLowerCase().includes(text) : file.folderId === folderId));
	const selected = files.find((file) => file.id === selectedId) ?? null;
	const current = folders.find((folder) => folder.id === folderId);
	const roots = folders.filter((folder) => folder.parentId === null);
	const folderButton = (id: number | null, label: string, count: number | null, nested = false) => (
		<button
			type="button"
			aria-current={folderId === id ? "true" : undefined}
			className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] ${nested ? "pl-7" : ""} ${folderId === id ? "bg-selected font-semibold" : "hover:bg-muted"}`}
			onClick={() => {
				setFolderId(id);
				setSelectedId(null);
			}}
		>
			{folderId === id ? <FolderOpen size={15} aria-hidden="true" className="shrink-0" /> : <Folder size={15} aria-hidden="true" className="shrink-0" />}
			<span className="min-w-0 flex-1 break-words">{label}</span>
			{count !== null && <span className="text-xs text-muted-foreground">{count}</span>}
		</button>
	);
	const canOpen = (file: ProjectFile) => !file.unavailable;

	return (
		<div className="flex flex-col gap-3">
			<div className="flex flex-wrap items-center gap-2">
				<p className="mr-auto min-w-0 break-words text-[13px] text-muted-foreground">
					<button type="button" className="text-selected-foreground" onClick={() => setFolderId(null)}>{projectName}</button>
					{current && ` / ${current.name}`}
				</p>
				<SearchField label={t("pr.search_files")} value={query} onChange={setQuery} className="min-w-52" />
				{canContribute && (
					<>
						<button type="button" className={buttonClass("outline")} onClick={() => setNaming((value) => !value)}>
							<Plus size={15} aria-hidden="true" />
							{t("pr.folder")}
						</button>
						<button type="button" className={buttonClass("outline")} onClick={() => setLinking(true)}>
							<Link2 size={15} aria-hidden="true" />
							{t("pr.link_from_files")}
						</button>
						<button type="button" className={buttonClass()} onClick={() => input.current?.click()}>
							<Upload size={15} aria-hidden="true" />
							{t("files.upload")}
						</button>
						<input
							ref={input}
							type="file"
							multiple
							accept={ACCEPT}
							className="sr-only"
							aria-label={t("files.upload")}
							onChange={(event) => {
								const chosen = [...(event.target.files ?? [])];
								event.target.value = "";
								if (chosen.length) void startUploads(chosen);
							}}
						/>
					</>
				)}
			</div>
			{naming && (
				<form
					className="flex flex-wrap items-end gap-2 rounded-card border border-border bg-card p-3"
					onSubmit={(event) => {
						event.preventDefault();
						if (folderName.trim()) addFolder.mutate({ name: folderName, parentId: current && current.parentId === null ? current.id : null });
					}}
				>
					<div className="min-w-52 flex-1"><Field label={t("files.folder_name")} maxLength={120} value={folderName} onChange={(event) => setFolderName(event.target.value)} /></div>
					<button type="submit" disabled={!folderName.trim() || addFolder.isPending} className={buttonClass()}>{t("common.save")}</button>
				</form>
			)}
			<div className="grid items-start gap-3 lg:grid-cols-[230px_minmax(0,1fr)] xl:grid-cols-[230px_minmax(0,1fr)_300px]">
				<aside className="flex min-w-0 flex-col gap-2 rounded-card border border-border bg-card p-2.5">
					<nav aria-label={t("files.folder")} className="flex flex-col gap-0.5">
						{folderButton(null, t("pr.all_top_level"), null)}
						{roots.map((folder) => (
							<div key={folder.id}>
								{folderButton(folder.id, folder.name, countIn(folder.id))}
								{folders.filter((child) => child.parentId === folder.id).map((child) => <div key={child.id}>{folderButton(child.id, child.name, countIn(child.id), true)}</div>)}
							</div>
						))}
					</nav>
					{folders.length === 0 && canContribute && (
						<button type="button" disabled={addFolder.isPending} className={buttonClass("outline", "w-full")} onClick={() => addFolder.mutate({ standard: true })}>
							{t("pr.add_standard_folders")}
						</button>
					)}
					{canManage && current && countIn(current.id) === 0 && !folders.some((child) => child.parentId === current.id) && (
						<button type="button" className="px-2 py-1 text-left text-xs font-medium text-danger-foreground" onClick={() => removeFolder.mutate(current.id)}>
							{t("pr.delete_folder")}
						</button>
					)}
					<div className="border-t border-border px-2 pt-2 text-xs text-muted-foreground">
						<p className="font-semibold text-foreground">{t("pr.used_by_project", { size: fileSize(usedBytes) })}</p>
						<p>{t("pr.used_hint")}</p>
					</div>
				</aside>
				<div className="flex min-w-0 flex-col gap-3">
					{uploads.length > 0 && (
						<section className="rounded-card border border-border bg-card p-3">
							<div className="mb-2 flex items-center justify-between gap-2">
								<h3 className="text-[13px] font-semibold">{t("pr.upload_progress", { done: uploads.filter((item) => item.state === "done").length, total: uploads.length })}</h3>
								<button type="button" aria-label={t("common.close")} className="grid size-7 place-items-center rounded-md hover:bg-muted" onClick={() => setUploads([])}>
									<X size={14} aria-hidden="true" />
								</button>
							</div>
							<ul className="flex flex-col gap-1.5 text-[13px]">
								{uploads.map((item) => (
									<li key={item.key} className="flex items-center gap-2">
										<span className="min-w-0 flex-1 truncate">{item.name}</span>
										{item.state === "done" && <span className="inline-flex items-center gap-1 text-[#14795A]"><Check size={14} aria-hidden="true" />{t("files.status_ready")}</span>}
										{item.state === "uploading" && <span className="text-muted-foreground">{t("files.status_uploading")}</span>}
										{item.state === "waiting" && <span className="text-muted-foreground">{t("files.status_waiting")}</span>}
										{item.state === "failed" && <span className="font-medium text-danger-foreground">{t(item.error ?? "cb.file_failed")}</span>}
									</li>
								))}
							</ul>
						</section>
					)}
					{visible.length === 0 ? (
						<StatePanel icon={FolderOpen} title={t(text ? "files.no_results" : "pr.folder_empty")} description={text || !canContribute ? undefined : t("pr.folder_empty_desc")} />
					) : (
						<DataTable minWidth={620} head={[t("files.col_name"), t("pr.col_version"), t("pr.col_updated"), t("pr.col_size"), ""]}>
							{visible.map((file) => (
								<tr key={file.id} className={selectedId === file.id ? "bg-selected" : ""}>
									<td className="px-3 py-2.5 first:pl-4">
										<span className="flex items-center gap-2.5">
											<FileBadge name={file.name} />
											<span className="min-w-0">
												<button type="button" className="block break-words text-left font-semibold hover:underline" onClick={() => setSelectedId(file.id)}>
													{file.name ?? t("pr.link_unavailable")}
												</button>
												<span className="block break-words text-xs text-muted-foreground">
													{file.orgFileId ? t("pr.linked_from_files") : file.note}
												</span>
											</span>
										</span>
									</td>
									<td className="px-3 py-2.5">{file.orgFileId ? "—" : `v${file.currentVersion}`}</td>
									<td className="px-3 py-2.5 text-muted-foreground">
										<span className="block">{file.updatedBy ?? "—"}</span>
										<span className="block whitespace-nowrap text-xs">{new Date(file.updatedAt).toLocaleDateString(language, { dateStyle: "medium" })}</span>
									</td>
									<td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{file.sizeBytes !== null ? fileSize(file.sizeBytes) : "—"}</td>
									<td className="px-3 py-2.5 last:pr-4">
										<ActionsMenu
											label={t("files.actions_for", { name: file.name ?? "" })}
											actions={[
												{ label: t("pr.details"), onSelect: () => setSelectedId(file.id) },
												...(canOpen(file) && canPreviewFile(file.mimeType) ? [{ label: t("files.preview"), onSelect: () => setPreview({ file }) }] : []),
												...(canOpen(file) ? [{ label: t("files.download"), href: downloadUrl(projectId, file) }] : []),
												...(canContribute && !file.orgFileId ? [{ label: t("pr.new_version"), onSelect: () => setVersioning(file) }] : []),
												...(canManage ? [{ label: t("common.delete"), onSelect: () => { removeFile.reset(); setDeleting(file); }, danger: true, separated: true }] : []),
											]}
										/>
									</td>
								</tr>
							))}
						</DataTable>
					)}
				</div>
				{selected && (
					<section className="flex min-w-0 flex-col gap-3 rounded-card border border-border bg-card p-4 lg:col-span-2 xl:col-span-1">
						<div className="flex items-start gap-2.5">
							<FileBadge name={selected.name} />
							<h3 className="min-w-0 flex-1 break-words text-[15px] font-semibold">{selected.name ?? t("pr.link_unavailable")}</h3>
							<button type="button" aria-label={t("common.close")} className="grid size-7 shrink-0 place-items-center rounded-md bg-muted" onClick={() => setSelectedId(null)}>
								<X size={14} aria-hidden="true" />
							</button>
						</div>
						{!selected.unavailable && (
							<div className="flex flex-wrap gap-2">
								{canPreviewFile(selected.mimeType) && <button type="button" className={buttonClass("outline", "min-h-8 px-3 py-0")} onClick={() => setPreview({ file: selected })}>{t("files.preview")}</button>}
								<a href={downloadUrl(projectId, selected)} className={buttonClass("outline", "min-h-8 px-3 py-0")}>{t("files.download")}</a>
								{canContribute && !selected.orgFileId && <button type="button" className={buttonClass("outline", "min-h-8 px-3 py-0")} onClick={() => setVersioning(selected)}>{t("pr.new_version")}</button>}
							</div>
						)}
						{canContribute ? (
							<SelectField
								label={t("files.folder")}
								value={selected.folderId ?? ""}
								onChange={(event) => move.mutate({ id: selected.id, folder: event.target.value ? Number(event.target.value) : null })}
							>
								<option value="">{t("pr.all_top_level")}</option>
								{folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
							</SelectField>
						) : null}
						<p className="text-xs text-muted-foreground">{t("pr.file_access")}</p>
						{selected.orgFileId ? (
							<p className="text-[13px] text-muted-foreground">{t("pr.linked_note")}</p>
						) : (
							<div>
								<h4 className="mb-2 text-[13px] font-semibold">{t("pr.version_history")}</h4>
								<ol className="flex flex-col gap-2.5">
									{selected.versions.map((version) => (
										<li key={version.version} className="flex items-start gap-2 text-[13px]">
											<b className="w-7 shrink-0">v{version.version}</b>
											<span className="min-w-0 flex-1">
												{version.note && <span className="block break-words">“{version.note}”</span>}
												<span className="block text-xs text-muted-foreground">
													{version.uploaderName ?? "—"} · {new Date(version.createdAt).toLocaleDateString(language, { dateStyle: "medium" })}
												</span>
												{version.version !== selected.currentVersion && (
													<span className="mt-1 flex gap-2 text-xs font-medium">
														{canPreviewFile(version.mimeType) ? (
															<button type="button" className="text-selected-foreground" onClick={() => setPreview({ file: selected, version })}>{t("files.preview")}</button>
														) : (
															<a href={downloadUrl(projectId, selected, version.version)} className="text-selected-foreground">{t("files.download")}</a>
														)}
														{canContribute && (
															<button type="button" disabled={restore.isPending} className="text-selected-foreground" onClick={() => restore.mutate({ id: selected.id, version: version.version })}>
																{t("pr.restore")}
															</button>
														)}
													</span>
												)}
											</span>
											{version.version === selected.currentVersion && (
												<span className="rounded-full bg-primary px-2 text-[11px] font-semibold text-primary-foreground">{t("settings.current")}</span>
											)}
										</li>
									))}
								</ol>
								<p className="mt-2.5 text-xs text-muted-foreground">{t("pr.restore_note")}</p>
							</div>
						)}
					</section>
				)}
			</div>
			{versioning && <NewVersionDialog projectId={projectId} file={versioning} onClose={() => setVersioning(null)} />}
			{linking && <LinkFromFilesDialog projectId={projectId} folderId={folderId} onClose={() => setLinking(false)} />}
			{preview && (
				<FilePreviewDrawer
					name={preview.version?.name ?? preview.file.name ?? ""}
					mimeType={preview.version?.mimeType ?? preview.file.mimeType}
					src={downloadUrl(projectId, preview.file, preview.version?.version, true)}
					downloadHref={downloadUrl(projectId, preview.file, preview.version?.version)}
					onClose={() => setPreview(null)}
				/>
			)}
			<ConfirmModal
				title={t("files.delete_confirm_title")}
				description={t(
					removeFile.error instanceof ApiError && removeFile.error.code === "IN_REPORT" ? "pr.file_in_report" : deleting?.orgFileId ? "pr.unlink_desc" : "pr.delete_file_desc",
					{ name: deleting?.name ?? "" },
				)}
				confirmLabel={t("common.delete")}
				open={deleting !== null}
				pending={removeFile.isPending}
				failed={removeFile.isError && !(removeFile.error instanceof ApiError && removeFile.error.code === "IN_REPORT")}
				onConfirm={() => deleting && removeFile.mutate(deleting.id)}
				onClose={() => setDeleting(null)}
			/>
		</div>
	);
}
