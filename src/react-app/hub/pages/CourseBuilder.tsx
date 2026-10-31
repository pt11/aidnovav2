import {
	lazy,
	Suspense,
	useEffect,
	useRef,
	useState,
	type DragEvent,
	type FormEvent,
	type ReactNode,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	ArrowDown,
	ArrowUp,
	ChevronLeft,
	FileText,
	GripVertical,
	ListChecks,
	Pencil,
	Plus,
	Search,
	UploadCloud,
	Video,
	X,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { api, ApiError } from "../api";
import { useI18n } from "../i18n";
import {
	ActionsMenu,
	Alert,
	buttonClass,
	ConfirmModal,
	Field,
	Modal,
	PageError,
	PageLoading,
	SelectField,
	StatePanel,
	TextareaField,
} from "../ui";
import { COURSES_KEY, CoverPicker, uploadCover } from "./Courses";

interface ManagedLesson {
	id: number;
	title: string;
	isRequired: boolean;
	materials: number;
}

interface ManagedModule {
	id: number;
	title: string;
	lessons: ManagedLesson[];
}

interface ManagedCourse {
	id: number;
	title: string;
	description: string | null;
	objectives: string | null;
	duration: string | null;
	status: "draft" | "published";
	isMandatory: boolean;
	hasCover: boolean;
	passingScore: number;
	quizTitle: string | null;
	certificateEnabled: boolean;
	updatedAt: string;
	publishProblem: string | null;
	modules: ManagedModule[];
	questionCount: number;
	stats: { enrolled: number; completed: number; inProgress: number };
}

interface Material {
	id: number;
	name: string;
	kind: "pdf" | "video" | "document" | "sheet";
	sizeBytes: number | null;
	isRequired: boolean;
	pageCount: number | null;
	fromHub: boolean;
	canBeRequired: boolean;
	unavailable: boolean;
}

export interface EditableLesson {
	id: number;
	moduleId: number;
	title: string;
	lessonType: "reading" | "document";
	content: string | null;
	videoUrl: string | null;
	completionMethod: "mark" | "scroll" | "open";
	estimatedTime: string | null;
	isRequired: boolean;
	materials: Material[];
}

interface HubFile {
	id: number;
	name: string;
	kind: Material["kind"] | null;
	sizeBytes: number | null;
	folderName: string | null;
	problem: "pin" | "limited" | "type" | null;
	createdAt: string;
}

interface Transfer {
	id: string;
	name: string;
	percent: number;
	status: "uploading" | "failed";
	error?: string;
	cancel?: () => void;
}

const RichEditor = lazy(() => import("../RichEditor"));

const MAX_MATERIAL_BYTES = 50 * 1024 * 1024;
const MAX_VIDEO_BYTES = 2 * 1024 * 1024 * 1024;
const MAX_PART_TRIES = 4;
const MATERIAL_ACCEPT = ".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.mp4,.webm";

export interface LessonValues {
	title: string;
	lessonType: EditableLesson["lessonType"];
	content: string;
	videoUrl: string;
	completionMethod: EditableLesson["completionMethod"];
	estimatedTime: string;
	isRequired: boolean;
}

export function lessonEditKey(lessonId: number | string) {
	return ["course-lesson-edit", String(lessonId)];
}

export function isVideoLink(link: string) {
	return /^https:\/\/((www|m)\.)?(youtube\.com\/(watch\?|embed\/|shorts\/|live\/)|youtube-nocookie\.com\/embed\/|youtu\.be\/|vimeo\.com\/\d|player\.vimeo\.com\/video\/\d)/.test(
		link.trim(),
	);
}

export function courseKey(id: string) {
	return ["course-manage", id];
}

export function formatSize(bytes: number | null) {
	if (bytes === null) return "";
	if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
	if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
	return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

export function KindBadge({ kind }: { kind: Material["kind"] | null }) {
	const styles: Record<string, string> = {
		pdf: "bg-[#DC2828]",
		video: "bg-[#753FF3]",
		document: "bg-primary",
		sheet: "bg-[#14795A]",
	};
	const labels: Record<string, string> = { pdf: "PDF", document: "DOC", sheet: "XLS" };
	return (
		<span
			aria-hidden="true"
			className={`grid size-9 shrink-0 place-items-center rounded-md text-[10px] font-bold text-white ${styles[kind ?? ""] ?? "bg-muted-foreground"}`}
		>
			{kind === "video" ? <Video size={15} /> : (labels[kind ?? ""] ?? <FileText size={15} />)}
		</span>
	);
}

// Sends one piece of a video. Mobile connections often drop, so a failed piece is
// tried again a few times with a pause, and earlier pieces are never sent twice.
async function sendPart(
	url: string,
	data: Blob,
	signal: AbortSignal,
): Promise<{ partNumber: number; etag: string }> {
	let lastError: unknown;
	for (let attempt = 0; attempt < MAX_PART_TRIES; attempt += 1) {
		if (attempt > 0) {
			await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
		}
		try {
			const response = await fetch(url, { method: "PUT", body: data, signal });
			if (response.ok) return (await response.json()) as { partNumber: number; etag: string };
			if (response.status < 500) throw new ApiError(response.status, "PART_REFUSED", "Refused");
			lastError = new ApiError(response.status, "PART_FAILED", "Failed");
		} catch (error) {
			if (signal.aborted || error instanceof ApiError) throw error;
			lastError = error;
		}
	}
	throw lastError;
}

function postFile(
	url: string,
	file: File,
	onProgress: (percent: number) => void,
	registerCancel: (cancel: () => void) => void,
) {
	return new Promise<void>((resolve, reject) => {
		const request = new XMLHttpRequest();
		request.open("POST", url);
		request.upload.onprogress = (event) => {
			if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
		};
		request.onload = () => {
			if (request.status < 300) {
				resolve();
				return;
			}
			let code = "UPLOAD_FAILED";
			try {
				code = (JSON.parse(request.responseText) as { code?: string }).code ?? code;
			} catch {
				// The status alone is enough to report the failure.
			}
			reject(new ApiError(request.status, code, "Upload failed"));
		};
		request.onerror = () => reject(new ApiError(0, "UPLOAD_FAILED", "Upload failed"));
		request.onabort = () => reject(new ApiError(0, "CANCELLED", "Cancelled"));
		registerCancel(() => request.abort());
		request.send(file);
	});
}

function NameDialog({
	title,
	label,
	initial = "",
	onSave,
	onClose,
}: {
	title: string;
	label: string;
	initial?: string;
	onSave: (name: string) => Promise<unknown>;
	onClose: () => void;
}) {
	const { t } = useI18n();
	const [name, setName] = useState(initial);
	const save = useMutation({ mutationFn: () => onSave(name), onSuccess: onClose });
	return (
		<Modal title={title} open onClose={onClose}>
			<form
				className="flex flex-col gap-3.5"
				onSubmit={(event) => {
					event.preventDefault();
					save.mutate();
				}}
			>
				{save.isError && <Alert>{t("error.generic")}</Alert>}
				<Field
					label={label}
					required
					autoFocus
					maxLength={200}
					value={name}
					onChange={(event) => setName(event.target.value)}
				/>
				<div className="flex justify-end gap-2">
					<button type="button" className={buttonClass("outline")} onClick={onClose}>
						{t("common.cancel")}
					</button>
					<button type="submit" disabled={save.isPending || !name.trim()} className={buttonClass()}>
						{t("common.save")}
					</button>
				</div>
			</form>
		</Modal>
	);
}

function IconButton({
	label,
	disabled,
	onClick,
	children,
}: {
	label: string;
	disabled?: boolean;
	onClick: () => void;
	children: ReactNode;
}) {
	return (
		<button
			type="button"
			aria-label={label}
			title={label}
			disabled={disabled}
			onClick={onClick}
			className="grid size-7 shrink-0 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
		>
			{children}
		</button>
	);
}

type OutlineDialog =
	| { type: "add-module" }
	| { type: "add-lesson"; moduleId: number }
	| { type: "rename"; module: ManagedModule }
	| { type: "delete-module"; module: ManagedModule }
	| { type: "delete-lesson"; lesson: ManagedLesson }
	| null;

type Dragged = { type: "module"; id: number } | { type: "lesson"; id: number } | null;

function Outline({
	course,
	activeLessonId,
}: {
	course: ManagedCourse;
	activeLessonId: number | null;
}) {
	const { t } = useI18n();
	const queryClient = useQueryClient();
	const [, navigate] = useLocation();
	const [dialog, setDialog] = useState<OutlineDialog>(null);
	const [dragged, setDragged] = useState<Dragged>(null);
	const base = `/courses/${course.id}`;
	const refresh = () => queryClient.invalidateQueries({ queryKey: courseKey(String(course.id)) });
	const lessonTotal = course.modules.reduce((sum, module) => sum + module.lessons.length, 0);
	const reorder = useMutation({
		mutationFn: (modules: ManagedModule[]) =>
			api(`/courses/${course.id}/reorder`, {
				method: "POST",
				body: {
					modules: modules.map((module) => ({
						id: module.id,
						lessonIds: module.lessons.map((lesson) => lesson.id),
					})),
				},
			}),
		onSettled: refresh,
	});
	const removeModule = useMutation({
		mutationFn: (moduleId: number) => api(`${base}/modules/${moduleId}`, { method: "DELETE" }),
		onSuccess: async () => {
			await refresh();
			setDialog(null);
			navigate(`${base}/manage`);
		},
	});
	const removeLesson = useMutation({
		mutationFn: (lessonId: number) => api(`${base}/lessons/${lessonId}`, { method: "DELETE" }),
		onSuccess: async () => {
			await refresh();
			setDialog(null);
			navigate(`${base}/manage`);
		},
	});

	function moveModule(index: number, change: number) {
		const next = [...course.modules];
		const [moved] = next.splice(index, 1);
		next.splice(index + change, 0, moved);
		reorder.mutate(next);
	}

	// Moving past the end of a module carries the lesson into the next one.
	function moveLesson(moduleIndex: number, lessonIndex: number, change: number) {
		const next = course.modules.map((module) => ({ ...module, lessons: [...module.lessons] }));
		const [moved] = next[moduleIndex].lessons.splice(lessonIndex, 1);
		const target = lessonIndex + change;
		if (target < 0) next[moduleIndex - 1].lessons.push(moved);
		else if (target > next[moduleIndex].lessons.length) next[moduleIndex + 1].lessons.unshift(moved);
		else next[moduleIndex].lessons.splice(target, 0, moved);
		reorder.mutate(next);
	}

	// A lesson dropped on a lesson goes before it, and on a module goes to its end.
	function dropOn(moduleId: number, lessonId: number | null) {
		if (!dragged) return;
		if (dragged.type === "module") {
			if (dragged.id === moduleId) return;
			const next = [...course.modules];
			const from = next.findIndex((module) => module.id === dragged.id);
			const [moved] = next.splice(from, 1);
			next.splice(next.findIndex((module) => module.id === moduleId), 0, moved);
			reorder.mutate(next);
			return;
		}
		if (dragged.id === lessonId) return;
		const next = course.modules.map((module) => ({ ...module, lessons: [...module.lessons] }));
		const source = next.find((module) => module.lessons.some((lesson) => lesson.id === dragged.id));
		const target = next.find((module) => module.id === moduleId);
		if (!source || !target) return;
		const [moved] = source.lessons.splice(source.lessons.findIndex((lesson) => lesson.id === dragged.id), 1);
		const at = lessonId === null ? -1 : target.lessons.findIndex((lesson) => lesson.id === lessonId);
		target.lessons.splice(at === -1 ? target.lessons.length : at, 0, moved);
		reorder.mutate(next);
	}

	const dropProps = (moduleId: number, lessonId: number | null) => ({
		onDragOver: (event: DragEvent) => {
			if (dragged) event.preventDefault();
		},
		onDrop: (event: DragEvent) => {
			event.preventDefault();
			event.stopPropagation();
			dropOn(moduleId, lessonId);
			setDragged(null);
		},
	});
	const dragProps = (item: NonNullable<Dragged>) => ({
		draggable: true,
		onDragStart: (event: DragEvent) => {
			event.stopPropagation();
			event.dataTransfer.effectAllowed = "move";
			setDragged(item);
		},
		onDragEnd: () => setDragged(null),
	});

	return (
		<nav
			aria-label={t("course.outline")}
			className="flex min-w-0 flex-col gap-3 border-border bg-card p-4 md:row-span-2 md:border-r xl:row-span-1"
		>
			<div className="flex items-center justify-between gap-2">
				<h2 className="text-[13px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
					{t("course.outline")}
				</h2>
				<span className="text-xs text-muted-foreground">
					{t(course.modules.length === 1 ? "course.one_module" : "course.count_modules", { count: course.modules.length })} ·{" "}
					{t(lessonTotal === 1 ? "course.one_lesson" : "course.count_lessons", { count: lessonTotal })}
				</span>
			</div>
			{reorder.isError && <Alert>{t("error.generic")}</Alert>}
			{course.modules.map((module, moduleIndex) => (
				<div key={module.id} className="overflow-hidden rounded-[9px] border border-border" {...dropProps(module.id, null)}>
					<div {...dragProps({ type: "module", id: module.id })} className="flex items-center gap-1.5 py-1.5 pl-2 pr-1">
						<GripVertical size={14} aria-hidden="true" className="shrink-0 cursor-grab text-muted-foreground" />
						<span className="min-w-0 flex-1 break-words font-semibold">
							{moduleIndex + 1}. {module.title}
						</span>
						<ActionsMenu
							label={t("course.module_actions", { title: module.title })}
							actions={[
								{ label: t("course.rename_module"), onSelect: () => setDialog({ type: "rename", module }) },
								...(moduleIndex > 0 ? [{ label: t("course.move_up"), onSelect: () => moveModule(moduleIndex, -1) }] : []),
								...(moduleIndex < course.modules.length - 1
									? [{ label: t("course.move_down"), onSelect: () => moveModule(moduleIndex, 1) }]
									: []),
								{ label: t("course.delete_module"), danger: true, onSelect: () => setDialog({ type: "delete-module", module }) },
							]}
						/>
					</div>
					{module.lessons.map((lesson, lessonIndex) => {
						const active = lesson.id === activeLessonId;
						const canMoveUp = moduleIndex > 0 || lessonIndex > 0;
						const canMoveDown = moduleIndex < course.modules.length - 1 || lessonIndex < module.lessons.length - 1;
						return (
							<div
								key={lesson.id}
								{...dragProps({ type: "lesson", id: lesson.id })}
								{...dropProps(module.id, lesson.id)}
								className={`flex items-center gap-1 border-t border-border pr-1 ${active ? "bg-primary text-primary-foreground [&_button]:text-primary-foreground [&_button:hover]:bg-white/20" : ""}`}
							>
								<GripVertical size={13} aria-hidden="true" className={`ml-2 shrink-0 cursor-grab ${active ? "opacity-70" : "text-muted-foreground"}`} />
								<Link
									href={`${base}/manage/lessons/${lesson.id}`}
									aria-current={active ? "true" : undefined}
									className={`min-w-0 flex-1 break-words py-2 pl-1 pr-1 no-underline ${active ? "font-medium text-primary-foreground" : "text-foreground hover:underline"}`}
								>
									{lesson.title}
								</Link>
								<ActionsMenu
									label={t("course.lesson_actions", { title: lesson.title })}
									actions={[
										{ label: t("course.edit_lesson"), onSelect: () => navigate(`${base}/lessons/${lesson.id}/edit`) },
										...(canMoveUp ? [{ label: t("course.move_up"), onSelect: () => moveLesson(moduleIndex, lessonIndex, -1) }] : []),
										...(canMoveDown ? [{ label: t("course.move_down"), onSelect: () => moveLesson(moduleIndex, lessonIndex, 1) }] : []),
										{ label: t("course.delete_lesson"), danger: true, onSelect: () => setDialog({ type: "delete-lesson", lesson }) },
									]}
								/>
							</div>
						);
					})}
					<button
						type="button"
						onClick={() => setDialog({ type: "add-lesson", moduleId: module.id })}
						className="flex w-full items-center gap-1.5 border-t border-border py-2 pl-7 text-[13px] font-medium text-selected-foreground hover:bg-muted"
					>
						<Plus size={14} aria-hidden="true" />
						{t("course.add_lesson")}
					</button>
				</div>
			))}
			<Link
				href={`${base}/quiz/edit`}
				className="flex items-center gap-2 rounded-[9px] border border-border bg-background px-3 py-2.5 text-foreground no-underline hover:border-input"
			>
				<ListChecks size={16} aria-hidden="true" className="shrink-0 text-[#753FF3]" />
				<span className="flex-1 font-semibold">{t("course.final_quiz")}</span>
				<span className="text-xs text-muted-foreground">
					{course.questionCount > 0
						? t("course.quiz_summary", { count: course.questionCount, score: course.passingScore })
						: t("course.quiz_none")}
				</span>
			</Link>
			<button
				type="button"
				onClick={() => setDialog({ type: "add-module" })}
				className="flex min-h-9 items-center justify-center gap-1.5 rounded-md border border-dashed border-input font-medium hover:bg-muted"
			>
				<Plus size={15} aria-hidden="true" />
				{t("course.add_module")}
			</button>

			{dialog?.type === "add-module" && (
				<NameDialog
					title={t("course.add_module")}
					label={t("course.module_title")}
					onClose={() => setDialog(null)}
					onSave={async (title) => {
						await api(`${base}/modules`, { method: "POST", body: { title } });
						await refresh();
					}}
				/>
			)}
			{dialog?.type === "rename" && (
				<NameDialog
					title={t("course.rename_module")}
					label={t("course.module_title")}
					initial={dialog.module.title}
					onClose={() => setDialog(null)}
					onSave={async (title) => {
						await api(`${base}/modules/${dialog.module.id}`, { method: "PATCH", body: { title } });
						await refresh();
					}}
				/>
			)}
			{dialog?.type === "add-lesson" && (
				<NameDialog
					title={t("course.add_lesson")}
					label={t("course.lesson_title")}
					onClose={() => setDialog(null)}
					onSave={async (title) => {
						const created = await api<{ id: number }>(`${base}/modules/${dialog.moduleId}/lessons`, {
							method: "POST",
							body: { title },
						});
						await refresh();
						navigate(`${base}/manage/lessons/${created.id}`);
					}}
				/>
			)}
			<ConfirmModal
				title={t("course.delete_module_title", {
					title: dialog?.type === "delete-module" ? dialog.module.title : "",
				})}
				description={t("course.delete_module_desc")}
				confirmLabel={t("common.delete")}
				open={dialog?.type === "delete-module"}
				pending={removeModule.isPending}
				failed={removeModule.isError}
				onConfirm={() => dialog?.type === "delete-module" && removeModule.mutate(dialog.module.id)}
				onClose={() => setDialog(null)}
			/>
			<ConfirmModal
				title={t("course.delete_lesson_title", {
					title: dialog?.type === "delete-lesson" ? dialog.lesson.title : "",
				})}
				description={t("course.delete_lesson_desc")}
				confirmLabel={t("common.delete")}
				open={dialog?.type === "delete-lesson"}
				pending={removeLesson.isPending}
				failed={removeLesson.isError}
				onConfirm={() => dialog?.type === "delete-lesson" && removeLesson.mutate(dialog.lesson.id)}
				onClose={() => setDialog(null)}
			/>
		</nav>
	);
}

function HubPicker({
	courseId,
	lessonId,
	onClose,
}: {
	courseId: number;
	lessonId: number;
	onClose: (added: boolean) => void;
}) {
	const { t } = useI18n();
	const [search, setSearch] = useState("");
	const [selected, setSelected] = useState<number[]>([]);
	const files = useQuery({
		queryKey: ["course-hub-files"],
		queryFn: () => api<{ files: HubFile[] }>("/course-hub-files"),
		select: (data) => data.files,
	});
	const add = useMutation({
		mutationFn: () =>
			api(`/courses/${courseId}/lessons/${lessonId}/materials/hub`, {
				method: "POST",
				body: { fileIds: selected },
			}),
		onSuccess: () => onClose(true),
	});
	const text = search.trim().toLowerCase();
	const visible = (files.data ?? []).filter((file) => !text || file.name.toLowerCase().includes(text));
	const problemText = { pin: "course.hub_pin", limited: "course.hub_limited", type: "course.hub_type" };
	return (
		<Modal title={t("course.hub_title")} description={t("course.hub_desc")} open wide onClose={() => onClose(false)}>
			<div className="flex flex-col gap-3">
				{add.isError && <Alert>{t("error.generic")}</Alert>}
				<label className="flex h-9 items-center gap-2 rounded-md border border-input bg-card px-2.5">
					<Search size={16} aria-hidden="true" className="text-muted-foreground" />
					<input
						type="search"
						aria-label={t("course.hub_search")}
						placeholder={t("course.hub_search")}
						value={search}
						onChange={(event) => setSearch(event.target.value)}
						className="min-w-0 flex-1 bg-transparent outline-none"
					/>
				</label>
				{files.isPending && <PageLoading />}
				{files.isError && <PageError onRetry={() => files.refetch()} />}
				{files.data && visible.length === 0 && (
					<p className="py-5 text-center text-muted-foreground">{t("course.hub_none")}</p>
				)}
				<ul className="flex max-h-[46vh] flex-col gap-1.5 overflow-auto">
					{visible.map((file) => (
						<li key={file.id}>
							<label
								className={`flex items-center gap-3 rounded-[9px] border border-border p-2.5 ${file.problem ? "opacity-60" : "cursor-pointer hover:bg-muted"}`}
							>
								<input
									type="checkbox"
									className="size-4 accent-primary"
									disabled={file.problem !== null}
									checked={selected.includes(file.id)}
									onChange={(event) =>
										setSelected((current) =>
											event.target.checked
												? [...current, file.id]
												: current.filter((id) => id !== file.id),
										)
									}
								/>
								<KindBadge kind={file.kind} />
								<span className="min-w-0 flex-1">
									<span className="block break-words font-medium">{file.name}</span>
									<span className="block text-xs text-muted-foreground">
										{file.problem
											? t(problemText[file.problem])
											: [file.folderName, formatSize(file.sizeBytes)].filter(Boolean).join(" · ")}
									</span>
								</span>
							</label>
						</li>
					))}
				</ul>
				<div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-3">
					<span className="mr-auto text-[13px] text-muted-foreground">
						{t("course.hub_selected", { count: selected.length })}
					</span>
					<button type="button" className={buttonClass("outline")} onClick={() => onClose(false)}>
						{t("common.cancel")}
					</button>
					<button
						type="button"
						disabled={selected.length === 0 || add.isPending}
						className={buttonClass()}
						onClick={() => add.mutate()}
					>
						{t(selected.length === 1 ? "course.hub_add_one" : "course.hub_add", { count: selected.length })}
					</button>
				</div>
			</div>
		</Modal>
	);
}

export function Materials({
	courseId,
	lesson,
	compact = false,
	onAddVideo,
	onChange,
	onStatus,
}: {
	courseId: number;
	lesson: EditableLesson;
	// The course builder shows a shorter version than the full lesson editor.
	compact?: boolean;
	onAddVideo?: () => void;
	onChange: () => unknown;
	onStatus?: (status: { uploading: number; failed: number }) => void;
}) {
	const { t } = useI18n();
	const input = useRef<HTMLInputElement>(null);
	const [transfers, setTransfers] = useState<Transfer[]>([]);
	const [picking, setPicking] = useState(false);
	const base = `/courses/${courseId}`;
	const patchTransfer = (id: string, change: Partial<Transfer>) =>
		setTransfers((current) =>
			current.map((transfer) => (transfer.id === id ? { ...transfer, ...change } : transfer)),
		);
	const dropTransfer = (id: string) =>
		setTransfers((current) => current.filter((transfer) => transfer.id !== id));
	const uploadingCount = transfers.filter((transfer) => transfer.status === "uploading").length;
	const failedCount = transfers.length - uploadingCount;
	useEffect(() => {
		onStatus?.({ uploading: uploadingCount, failed: failedCount });
	}, [onStatus, uploadingCount, failedCount]);
	const reorder = useMutation({
		mutationFn: (ids: number[]) =>
			api(`${base}/lessons/${lesson.id}/materials/reorder`, { method: "POST", body: { ids } }),
		onSettled: onChange,
	});
	function moveMaterial(index: number, change: number) {
		const ids = lesson.materials.map((material) => material.id);
		const [moved] = ids.splice(index, 1);
		ids.splice(index + change, 0, moved);
		reorder.mutate(ids);
	}
	const toggle = useMutation({
		mutationFn: ({ id, isRequired }: { id: number; isRequired: boolean }) =>
			api(`${base}/materials/${id}`, { method: "PATCH", body: { isRequired } }),
		onSettled: onChange,
	});
	const remove = useMutation({
		mutationFn: (id: number) => api(`${base}/materials/${id}`, { method: "DELETE" }),
		onSettled: onChange,
	});

	function errorFor(error: unknown) {
		const code = error instanceof ApiError ? error.code : "";
		if (code === "STORAGE_FULL") return t("course.upload_full");
		if (code === "TYPE_NOT_ALLOWED") return t("course.upload_type");
		return t("course.upload_failed");
	}

	async function uploadVideo(file: File, id: string) {
		const controller = new AbortController();
		let materialId: number | null = null;
		patchTransfer(id, {
			cancel: () => {
				controller.abort();
				dropTransfer(id);
				if (materialId !== null) {
					api(`${base}/materials/${materialId}`, { method: "DELETE" }).catch(() => undefined);
				}
			},
		});
		const started = await api<{ id: number; partBytes: number }>(
			`${base}/lessons/${lesson.id}/materials/video`,
			{ method: "POST", body: { name: file.name, sizeBytes: file.size, isRequired: true } },
		);
		materialId = started.id;
		const total = Math.ceil(file.size / started.partBytes);
		const parts = [];
		try {
			for (let index = 0; index < total; index += 1) {
				const from = index * started.partBytes;
				parts.push(
					await sendPart(
						`/api${base}/materials/${started.id}/video/${index + 1}`,
						file.slice(from, from + started.partBytes),
						controller.signal,
					),
				);
				patchTransfer(id, { percent: Math.round(((index + 1) / total) * 100) });
			}
			await api(`${base}/materials/${started.id}/video/complete`, {
				method: "POST",
				body: { parts },
			});
		} catch (error) {
			if (!controller.signal.aborted) {
				api(`${base}/materials/${started.id}`, { method: "DELETE" }).catch(() => undefined);
			}
			throw error;
		}
	}

	async function uploadOne(file: File) {
		const id = crypto.randomUUID();
		const isVideo = /\.(mp4|webm)$/i.test(file.name);
		setTransfers((current) => [...current, { id, name: file.name, percent: 0, status: "uploading" }]);
		const limit = isVideo ? MAX_VIDEO_BYTES : MAX_MATERIAL_BYTES;
		if (file.size > limit) {
			patchTransfer(id, {
				status: "failed",
				error: t(isVideo ? "course.video_too_big" : "course.file_too_big", {
					size: formatSize(file.size),
				}),
			});
			return;
		}
		try {
			if (isVideo) {
				await uploadVideo(file, id);
			} else {
				const required = /\.(xlsx?)$/i.test(file.name) ? "0" : "1";
				await postFile(
					`/api${base}/lessons/${lesson.id}/materials/upload?required=${required}&name=${encodeURIComponent(file.name)}`,
					file,
					(percent) => patchTransfer(id, { percent }),
					(cancel) => patchTransfer(id, { cancel }),
				);
			}
			dropTransfer(id);
			await onChange();
		} catch (error) {
			if (error instanceof ApiError && error.code === "CANCELLED") {
				dropTransfer(id);
			} else if (!(error instanceof DOMException && error.name === "AbortError")) {
				patchTransfer(id, { status: "failed", error: errorFor(error), cancel: undefined });
			}
		}
	}

	function choose(files: FileList | null) {
		if (!files) return;
		for (const file of [...files].slice(0, 20)) void uploadOne(file);
	}

	const fileInput = (
		<input
			ref={input}
			type="file"
			multiple
			hidden
			aria-label={t("course.upload")}
			accept={MATERIAL_ACCEPT}
			onChange={(event) => {
				choose(event.target.files);
				event.target.value = "";
			}}
		/>
	);

	return (
		<section className="rounded-card border border-border bg-card p-5">
			{compact ? (
				<div className="flex flex-wrap items-center justify-between gap-x-3">
					<h3 className="text-[15px] font-semibold">{t("course.lesson_materials")}</h3>
					<span className="text-xs text-muted-foreground">{t("course.materials_note")}</span>
				</div>
			) : (
				<>
					<h2 className="text-base font-semibold">{t("course.materials")}</h2>
					<p className="mt-0.5 text-[13px] text-muted-foreground">{t("course.materials_desc")}</p>
					<div
						onDragOver={(event) => event.preventDefault()}
						onDrop={(event) => {
							event.preventDefault();
							choose(event.dataTransfer.files);
						}}
						className="mt-3 flex flex-wrap items-center gap-3.5 rounded-[9px] border-2 border-dashed border-input p-4"
					>
						<span className="grid size-11 shrink-0 place-items-center rounded-[9px] bg-muted">
							<UploadCloud size={20} aria-hidden="true" className="text-muted-foreground" />
						</span>
						<div className="min-w-0 flex-[1_1_240px]">
							<p className="font-medium">{t("course.drop_files")}</p>
							<p className="text-xs text-muted-foreground">{t("course.drop_hint")}</p>
						</div>
						<div className="flex flex-wrap gap-2">
							<button type="button" className={buttonClass("outline", "min-h-9 py-0 text-[13px]")} onClick={() => input.current?.click()}>
								{t("course.upload")}
							</button>
							<button type="button" className={buttonClass("outline", "min-h-9 py-0 text-[13px]")} onClick={() => setPicking(true)}>
								{t("course.choose_hub")}
							</button>
						</div>
					</div>
				</>
			)}
			{fileInput}
			{(remove.isError || toggle.isError || reorder.isError) && (
				<div className="mt-3">
					<Alert>{t("error.generic")}</Alert>
				</div>
			)}
			<ul className="mt-3 flex flex-col gap-2">
				{lesson.materials.map((material, index) => (
					<li key={material.id} className="flex flex-wrap items-center gap-3 rounded-[9px] border border-border px-3 py-2.5">
						<KindBadge kind={material.kind} />
						<span className="min-w-0 flex-[1_1_180px]">
							<span className="block break-words font-medium">{material.name}</span>
							<span className="block text-xs text-muted-foreground">
								{[
									material.pageCount
										? t(material.pageCount === 1 ? "course.one_page" : "course.pages", { count: material.pageCount })
										: null,
									formatSize(material.sizeBytes),
									material.fromHub ? t("course.from_hub") : null,
								]
									.filter(Boolean)
									.join(" · ")}
							</span>
							{material.unavailable && (
								<span className="block text-xs text-danger-foreground">{t("course.material_unavailable")}</span>
							)}
						</span>
						{material.canBeRequired ? (
							<label className="inline-flex items-center gap-2 text-[13px]">
								<input
									type="checkbox"
									className="size-4 accent-primary"
									checked={material.isRequired}
									onChange={(event) => toggle.mutate({ id: material.id, isRequired: event.target.checked })}
								/>
								{t("course.required")}
							</label>
						) : (
							<span className="text-xs text-muted-foreground">{t("course.extra_only")}</span>
						)}
						{!compact && lesson.materials.length > 1 && (
							<span className="flex">
								<IconButton label={t("course.move_file_up", { name: material.name })} disabled={index === 0 || reorder.isPending} onClick={() => moveMaterial(index, -1)}>
									<ArrowUp size={15} aria-hidden="true" />
								</IconButton>
								<IconButton label={t("course.move_file_down", { name: material.name })} disabled={index === lesson.materials.length - 1 || reorder.isPending} onClick={() => moveMaterial(index, 1)}>
									<ArrowDown size={15} aria-hidden="true" />
								</IconButton>
							</span>
						)}
						<IconButton label={t("course.remove_file", { name: material.name })} disabled={remove.isPending} onClick={() => remove.mutate(material.id)}>
							<X size={15} aria-hidden="true" />
						</IconButton>
					</li>
				))}
				{transfers.map((transfer) => (
					<li
						key={transfer.id}
						className={`flex flex-wrap items-center gap-3 rounded-[9px] border px-3 py-2.5 ${transfer.status === "failed" ? "border-destructive" : "border-border bg-background"}`}
					>
						<span className="min-w-0 flex-[1_1_180px]">
							<span className="block break-words font-medium">
								{transfer.status === "failed"
									? t("course.not_added", { name: transfer.name })
									: transfer.name}
							</span>
							{transfer.status === "failed" ? (
								<span role="alert" className="block text-xs text-danger-foreground">{transfer.error}</span>
							) : (
								<>
									<span className="block text-xs text-muted-foreground">
										{t("course.uploading", { percent: transfer.percent })}
									</span>
									<span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-muted">
										<span className="block h-full rounded-full bg-primary" style={{ width: `${transfer.percent}%` }} />
									</span>
								</>
							)}
						</span>
						{transfer.status === "uploading" && transfer.cancel ? (
							<button type="button" className={buttonClass("outline", "min-h-[30px] px-2.5 py-0 text-xs")} onClick={transfer.cancel}>
								{t("common.cancel")}
							</button>
						) : transfer.status === "failed" ? (
							<button
								type="button"
								className={buttonClass("outline", "min-h-[30px] px-2.5 py-0 text-xs")}
								onClick={() => {
									dropTransfer(transfer.id);
									input.current?.click();
								}}
							>
								{t("course.choose_another")}
							</button>
						) : (
							<IconButton label={t("common.close")} onClick={() => dropTransfer(transfer.id)}>
								<X size={15} aria-hidden="true" />
							</IconButton>
						)}
					</li>
				))}
			</ul>
			{compact && (
				<div className="mt-3 flex flex-wrap gap-2">
					<button type="button" className={buttonClass("outline", "min-h-9 py-0 text-[13px]")} onClick={() => input.current?.click()}>
						{t("course.upload_slides")}
					</button>
					{onAddVideo && (
						<button type="button" className={buttonClass("outline", "min-h-9 py-0 text-[13px]")} onClick={onAddVideo}>
							{t("course.add_video_link")}
						</button>
					)}
					<button type="button" className={buttonClass("outline", "min-h-9 py-0 text-[13px]")} onClick={() => setPicking(true)}>
						{t("course.choose_hub")}
					</button>
				</div>
			)}
			{picking && (
				<HubPicker
					courseId={courseId}
					lessonId={lesson.id}
					onClose={(added) => {
						setPicking(false);
						if (added) void onChange();
					}}
				/>
			)}
		</section>
	);
}

function LessonPanel({
	course,
	lessonId,
	position,
}: {
	course: ManagedCourse;
	lessonId: number;
	position: string;
}) {
	const { t } = useI18n();
	const queryClient = useQueryClient();
	const base = `/courses/${course.id}`;
	const key = lessonEditKey(lessonId);
	const lesson = useQuery({
		queryKey: key,
		queryFn: () => api<EditableLesson>(`${base}/lessons/${lessonId}/edit`),
	});
	// Null until something is edited, so a refreshed file list never undoes typing.
	const [edits, setEdits] = useState<LessonValues | null>(null);
	const [showVideo, setShowVideo] = useState(false);
	const refreshAll = async () => {
		await Promise.all([
			queryClient.invalidateQueries({ queryKey: key }),
			queryClient.invalidateQueries({ queryKey: courseKey(String(course.id)) }),
		]);
	};
	const save = useMutation({
		mutationFn: (body: LessonValues) => api(`${base}/lessons/${lessonId}`, { method: "PATCH", body }),
		onSuccess: async () => {
			await refreshAll();
			setEdits(null);
		},
	});
	const saveCode = save.error instanceof ApiError ? save.error.code : "";

	if (lesson.isPending) return <PageLoading />;
	if (lesson.isError) return <PageError onRetry={() => lesson.refetch()} />;

	const data = lesson.data;
	const values: LessonValues = edits ?? {
		title: data.title,
		lessonType: data.lessonType,
		content: data.content ?? "",
		videoUrl: data.videoUrl ?? "",
		completionMethod: data.completionMethod,
		estimatedTime: data.estimatedTime ?? "",
		isRequired: data.isRequired,
	};
	const set = <K extends keyof LessonValues>(name: K, value: LessonValues[K]) => {
		save.reset();
		setEdits((current) => ({ ...(current ?? values), [name]: value }));
	};
	const dirty = edits !== null;

	function submit(event: FormEvent) {
		event.preventDefault();
		save.mutate(values);
	}

	return (
		<div className="flex flex-col gap-4">
			<form onSubmit={submit} className="flex flex-col gap-3.5 rounded-card border border-border bg-card p-5">
				<div className="flex flex-wrap items-center justify-between gap-2">
					<p className="text-xs text-muted-foreground">{position}</p>
					<Link href={`${base}/lessons/${lessonId}/edit`} className="text-[13px] font-medium text-selected-foreground no-underline hover:underline">
						{t("course.all_lesson_options")} →
					</Link>
				</div>
				{save.isError && (
					<Alert>{t(saveCode === "INVALID_VIDEO" ? "course.video_invalid" : "error.generic")}</Alert>
				)}
				<Field
					label={t("course.lesson_title")}
					required
					maxLength={200}
					value={values.title}
					onChange={(event) => set("title", event.target.value)}
				/>
				<Suspense fallback={<PageLoading />}>
					<RichEditor
						label={t("course.lesson_content")}
						initial={data.content ?? ""}
						onChange={(value) => set("content", value)}
					/>
				</Suspense>
				{(showVideo || values.videoUrl) && (
					<Field
						label={t("course.video_link")}
						type="url"
						hint={t("course.video_link_hint")}
						placeholder="https://youtu.be/…"
						maxLength={2000}
						autoFocus={showVideo && !data.videoUrl}
						value={values.videoUrl}
						onChange={(event) => set("videoUrl", event.target.value)}
					/>
				)}
				<div className="flex items-center justify-end gap-3">
					{dirty && <span className="text-[13px] text-muted-foreground">{t("common.unsaved")}</span>}
					{save.isSuccess && !dirty && (
						<span role="status" className="text-[13px] text-muted-foreground">{t("common.saved")}</span>
					)}
					<button type="submit" disabled={save.isPending || !dirty} className={buttonClass("primary", "min-h-9 py-0")}>
						{t("course.save_lesson")}
					</button>
				</div>
			</form>
			<Materials
				courseId={course.id}
				lesson={data}
				compact
				onAddVideo={() => setShowVideo(true)}
				onChange={refreshAll}
			/>
		</div>
	);
}

function DetailsDialog({ course, onClose }: { course: ManagedCourse; onClose: () => void }) {
	const { t } = useI18n();
	const queryClient = useQueryClient();
	const [values, setValues] = useState({
		title: course.title,
		description: course.description ?? "",
		objectives: course.objectives ?? "",
	});
	const [cover, setCover] = useState<File | null>(null);
	const [coverError, setCoverError] = useState("");
	const save = useMutation({
		mutationFn: async () => {
			await api(`/courses/${course.id}`, { method: "PATCH", body: values });
			if (cover) await uploadCover(course.id, cover);
		},
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: courseKey(String(course.id)) });
			await queryClient.invalidateQueries({ queryKey: COURSES_KEY });
			onClose();
		},
	});
	const removeCover = useMutation({
		mutationFn: () => api(`/courses/${course.id}/cover`, { method: "DELETE" }),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: courseKey(String(course.id)) }),
	});
	return (
		<Modal title={t("course.edit_details")} open wide onClose={onClose}>
			<form
				className="flex flex-col gap-3.5"
				onSubmit={(event) => {
					event.preventDefault();
					save.mutate();
				}}
			>
				{save.isError && <Alert>{t("error.generic")}</Alert>}
				<CoverPicker
					file={cover}
					error={coverError}
					onChoose={(file, error) => {
						setCover(file);
						setCoverError(error);
					}}
				/>
				{course.hasCover && (
					<button
						type="button"
						disabled={removeCover.isPending}
						className="self-start text-[13px] font-medium text-danger-foreground hover:underline"
						onClick={() => removeCover.mutate()}
					>
						{t("course.remove_cover")}
					</button>
				)}
				<Field
					label={t("course.title")}
					required
					maxLength={200}
					value={values.title}
					onChange={(event) => setValues({ ...values, title: event.target.value })}
				/>
				<TextareaField
					label={t("course.description")}
					rows={3}
					maxLength={2000}
					value={values.description}
					onChange={(event) => setValues({ ...values, description: event.target.value })}
				/>
				<TextareaField
					label={t("course.objectives")}
					rows={2}
					maxLength={2000}
					value={values.objectives}
					onChange={(event) => setValues({ ...values, objectives: event.target.value })}
				/>
				<div className="flex justify-end gap-2">
					<button type="button" className={buttonClass("outline")} onClick={onClose}>
						{t("common.cancel")}
					</button>
					<button type="submit" disabled={save.isPending} className={buttonClass()}>
						{t("common.save")}
					</button>
				</div>
			</form>
		</Modal>
	);
}

function SettingsPanel({ course }: { course: ManagedCourse }) {
	const { t } = useI18n();
	const queryClient = useQueryClient();
	const [, navigate] = useLocation();
	const [values, setValues] = useState({
		isMandatory: course.isMandatory,
		duration: course.duration ?? "",
		passingScore: String(course.passingScore),
		certificateEnabled: course.certificateEnabled,
	});
	const [deleting, setDeleting] = useState(false);
	const save = useMutation({
		mutationFn: () =>
			api(`/courses/${course.id}`, {
				method: "PATCH",
				body: { ...values, passingScore: Number(values.passingScore) },
			}),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: courseKey(String(course.id)) }),
	});
	const remove = useMutation({
		mutationFn: () => api(`/courses/${course.id}`, { method: "DELETE" }),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: COURSES_KEY });
			navigate("/courses");
		},
	});
	const set = <K extends keyof typeof values>(name: K, value: (typeof values)[K]) => {
		save.reset();
		setValues((current) => ({ ...current, [name]: value }));
	};
	const stats = [
		{ label: t("course.enrolled"), value: course.stats.enrolled },
		{ label: t("course.status_completed"), value: course.stats.completed },
		{ label: t("course.status_in_progress"), value: course.stats.inProgress },
	];
	return (
		<aside
			aria-label={t("course.settings")}
			className="flex min-w-0 flex-col gap-4 p-4 md:px-6 md:pb-6 md:pt-0 xl:pl-0 xl:pr-4 xl:pt-6"
		>
			<section className="rounded-card border border-border bg-card p-4">
				<h2 className="mb-3 text-[15px] font-semibold">{t("course.enrolment")}</h2>
				<dl className="grid grid-cols-3 gap-2 text-center">
					{stats.map((stat) => (
						<div key={stat.label} className="rounded-[9px] bg-background px-1 py-2.5">
							<dd className="text-xl font-semibold">{stat.value}</dd>
							<dt className="text-xs text-muted-foreground">{stat.label}</dt>
						</div>
					))}
				</dl>
				<Link href={`/courses/${course.id}/learners`} className="mt-3 block text-[13px] no-underline hover:underline">
					{t("course.view_progress")} →
				</Link>
			</section>
			<form
				className="flex flex-col gap-3 rounded-card border border-border bg-card p-4"
				onSubmit={(event) => {
					event.preventDefault();
					save.mutate();
				}}
			>
				<h2 className="text-[15px] font-semibold">{t("course.settings")}</h2>
				{save.isError && <Alert>{t("error.generic")}</Alert>}
				<label className="flex items-center justify-between gap-3 text-[13px]">
					{t("course.mandatory")}
					<input
						type="checkbox"
						className="size-[18px] shrink-0 accent-primary"
						checked={values.isMandatory}
						onChange={(event) => set("isMandatory", event.target.checked)}
					/>
				</label>
				<Field
					label={t("course.duration")}
					maxLength={50}
					value={values.duration}
					onChange={(event) => set("duration", event.target.value)}
				/>
				<Field
					label={t("course.passing_score")}
					type="number"
					min={1}
					max={100}
					required
					value={values.passingScore}
					onChange={(event) => set("passingScore", event.target.value)}
				/>
				<SelectField
					label={t("course.certificate")}
					value={values.certificateEnabled ? "yes" : "no"}
					onChange={(event) => set("certificateEnabled", event.target.value === "yes")}
				>
					<option value="yes">{t("course.certificate_auto")}</option>
					<option value="no">{t("course.certificate_none")}</option>
				</SelectField>
				<div className="flex items-center gap-3">
					<button type="submit" disabled={save.isPending} className={buttonClass("outline", "min-h-9 py-0")}>
						{t("common.save")}
					</button>
					{save.isSuccess && <span role="status" className="text-[13px] text-muted-foreground">{t("common.saved")}</span>}
				</div>
			</form>
			<section className="rounded-card border border-border bg-card p-4">
				<h2 className="text-[15px] font-semibold">{t("course.delete")}</h2>
				<p className="mb-2.5 mt-1.5 text-[13px] text-muted-foreground">{t("course.delete_desc")}</p>
				<button
					type="button"
					className="min-h-8 rounded-md border border-destructive px-3 text-[13px] font-medium text-danger-foreground hover:bg-danger-surface"
					onClick={() => setDeleting(true)}
				>
					{t("course.delete")}…
				</button>
			</section>
			<ConfirmModal
				title={t("course.delete_title", { title: course.title })}
				description={t("course.delete_desc")}
				confirmLabel={t("common.delete")}
				open={deleting}
				pending={remove.isPending}
				failed={remove.isError}
				onConfirm={() => remove.mutate()}
				onClose={() => setDeleting(false)}
			/>
		</aside>
	);
}

export function CourseBuilderPage({ id, lessonId }: { id: string; lessonId?: string }) {
	const { t } = useI18n();
	const queryClient = useQueryClient();
	const [editing, setEditing] = useState(false);
	const course = useQuery({
		queryKey: courseKey(id),
		queryFn: () => api<ManagedCourse>(`/courses/${id}/manage`),
	});
	const publish = useMutation({
		mutationFn: (status: "draft" | "published") =>
			api(`/courses/${id}`, { method: "PATCH", body: { status } }),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: courseKey(id) });
			await queryClient.invalidateQueries({ queryKey: COURSES_KEY });
		},
	});

	if (course.isPending) return <PageLoading />;
	if (course.isError) {
		const missing = course.error instanceof ApiError && course.error.status === 404;
		return missing ? (
			<StatePanel
				title={t("course.not_found")}
				action={
					<Link href="/courses" className={buttonClass("outline")}>
						{t("course.back_to_courses")}
					</Link>
				}
			/>
		) : (
			<PageError onRetry={() => course.refetch()} />
		);
	}

	const data = course.data;
	const published = data.status === "published";
	const activeLessonId = lessonId ? Number(lessonId) : null;
	const lessonExists = data.modules.some((module) =>
		module.lessons.some((lesson) => lesson.id === activeLessonId),
	);
	const moduleIndex = data.modules.findIndex((module) =>
		module.lessons.some((lesson) => lesson.id === activeLessonId),
	);
	const lessonPosition = lessonExists
		? t("course.module_lesson", {
				module: moduleIndex + 1,
				lesson: data.modules[moduleIndex].lessons.findIndex((lesson) => lesson.id === activeLessonId) + 1,
			})
		: "";
	return (
		<div className="flex min-h-full flex-col">
			<header className="flex flex-wrap items-center gap-3 border-b border-border bg-card px-4 py-2.5 md:px-6">
				<Link href="/courses" aria-label={t("course.back_to_courses")} className="grid size-8 place-items-center rounded-md border border-border text-foreground">
					<ChevronLeft size={16} aria-hidden="true" />
				</Link>
				<div className="min-w-0 flex-[1_1_260px]">
					<p className="text-xs text-muted-foreground">{t("nav.courses")}</p>
					<div className="flex flex-wrap items-center gap-2">
						<h1 className="min-w-0 break-words text-lg font-semibold">{data.title}</h1>
						<span className={`rounded-full px-2 py-px text-[11px] font-semibold ${published ? "bg-primary text-primary-foreground" : "border border-input"}`}>
							{t(published ? "policies.published" : "policies.draft")}
						</span>
						<IconButton label={t("course.edit_details")} onClick={() => setEditing(true)}>
							<Pencil size={14} aria-hidden="true" />
						</IconButton>
					</div>
				</div>
				<div className="flex flex-wrap gap-2">
					<Link href={`/courses/${id}`} className={buttonClass("outline", "min-h-9 py-0")}>
						{t("course.preview")}
					</Link>
					<Link href={`/courses/${id}/learners`} className={buttonClass("outline", "min-h-9 py-0")}>
						{t("course.assign")}
					</Link>
					<button
						type="button"
						disabled={publish.isPending || (!published && data.publishProblem !== null)}
						title={!published && data.publishProblem ? t("course.publish_needs_content") : undefined}
						className={buttonClass(published ? "outline" : "primary", "min-h-9 py-0")}
						onClick={() => publish.mutate(published ? "draft" : "published")}
					>
						{t(published ? "course.unpublish" : "course.publish")}
					</button>
				</div>
			</header>
			{publish.isError && (
				<div className="px-4 pt-3 md:px-6">
					<Alert>{t("error.generic")}</Alert>
				</div>
			)}
			{!published && data.publishProblem && (
				<p className="border-b border-border bg-background px-4 py-2 text-[13px] md:px-6">
					<strong className="font-semibold">{t("course.to_publish")}</strong> {t("course.publish_needs_content")}
				</p>
			)}
			{/* Explicit columns, so nothing can wrap into a gap at in-between widths. */}
			<div className="grid flex-1 grid-cols-1 md:grid-cols-[260px_minmax(0,1fr)] md:grid-rows-[auto_1fr] xl:grid-cols-[280px_minmax(0,1fr)_300px] xl:grid-rows-1">
				<Outline course={data} activeLessonId={lessonExists ? activeLessonId : null} />
				<main className="min-w-0 p-4 md:p-6">
					{lessonExists && activeLessonId !== null ? (
						<LessonPanel
							key={activeLessonId}
							course={data}
							lessonId={activeLessonId}
							position={lessonPosition}
						/>
					) : (
						<div className="rounded-card border border-dashed border-input bg-card p-8 text-center">
							<p className="font-semibold">
								{data.modules.length === 0 ? t("course.start_outline") : t("course.choose_lesson")}
							</p>
							<p className="mx-auto mt-1 max-w-sm text-[13px] text-muted-foreground">
								{data.modules.length === 0 ? t("course.start_outline_desc") : t("course.choose_lesson_desc")}
							</p>
						</div>
					)}
				</main>
				<SettingsPanel
					key={[data.isMandatory, data.duration, data.passingScore, data.certificateEnabled].join()}
					course={data}
				/>
			</div>
			{editing && <DetailsDialog course={data} onClose={() => setEditing(false)} />}
		</div>
	);
}

interface Learner {
	id: string;
	name: string;
	email: string;
	departmentId: number | null;
	departmentName: string | null;
	isAssigned: boolean;
	status: "not_started" | "in_progress" | "completed";
	percent: number;
	bestScore: number | null;
	attempts: number;
	completedAt: string | null;
}

interface LearnersData {
	title: string;
	isMandatory: boolean;
	learners: Learner[];
	members: {
		id: string;
		name: string;
		email: string;
		departmentId: number | null;
		departmentName: string | null;
	}[];
}

function AssignDialog({
	courseId,
	data,
	onClose,
}: {
	courseId: string;
	data: LearnersData;
	onClose: () => void;
}) {
	const { t } = useI18n();
	const queryClient = useQueryClient();
	const assigned = new Set(data.learners.map((learner) => learner.id));
	const available = data.members.filter((member) => !assigned.has(member.id));
	const [search, setSearch] = useState("");
	const [department, setDepartment] = useState("all");
	const [selected, setSelected] = useState<string[]>([]);
	const departments = [
		...new Map(
			available.flatMap((member) =>
				member.departmentId ? [[member.departmentId, member.departmentName ?? ""] as const] : [],
			),
		),
	];
	const text = search.trim().toLowerCase();
	const visible = available.filter(
		(member) =>
			(department === "all" || String(member.departmentId) === department) &&
			(!text || member.name.toLowerCase().includes(text) || member.email.toLowerCase().includes(text)),
	);
	const assign = useMutation({
		mutationFn: () =>
			api(`/courses/${courseId}/enrollments`, { method: "POST", body: { userIds: selected } }),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: ["course-learners", courseId] });
			await queryClient.invalidateQueries({ queryKey: courseKey(courseId) });
			onClose();
		},
	});
	return (
		<Modal title={t("course.assign_title")} description={t("course.assign_desc")} open wide onClose={onClose}>
			<div className="flex flex-col gap-3">
				{assign.isError && <Alert>{t("error.generic")}</Alert>}
				<div className="flex flex-wrap gap-2">
					<input
						type="search"
						aria-label={t("course.assign_search")}
						placeholder={t("course.assign_search")}
						value={search}
						onChange={(event) => setSearch(event.target.value)}
						className="min-h-9 min-w-48 flex-1 rounded-md border border-input bg-card px-3"
					/>
					{departments.length > 0 && (
						<select
							aria-label={t("departments.title")}
							value={department}
							onChange={(event) => setDepartment(event.target.value)}
							className="min-h-9 rounded-md border border-input bg-card px-2.5"
						>
							<option value="all">{t("course.all_departments")}</option>
							{departments.map(([id, name]) => (
								<option key={id} value={id}>{name}</option>
							))}
						</select>
					)}
					<button
						type="button"
						disabled={visible.length === 0}
						className={buttonClass("outline", "min-h-9 py-0")}
						onClick={() =>
							setSelected((current) => [...new Set([...current, ...visible.map((member) => member.id)])])
						}
					>
						{t("course.select_all", { count: visible.length })}
					</button>
				</div>
				{visible.length === 0 && (
					<p className="py-5 text-center text-muted-foreground">{t("course.assign_none")}</p>
				)}
				<ul className="flex max-h-[46vh] flex-col overflow-auto">
					{visible.map((member) => (
						<li key={member.id}>
							<label className="flex cursor-pointer items-center gap-3 border-b border-border px-1 py-2 hover:bg-muted">
								<input
									type="checkbox"
									className="size-4 accent-primary"
									checked={selected.includes(member.id)}
									onChange={(event) =>
										setSelected((current) =>
											event.target.checked
												? [...current, member.id]
												: current.filter((id) => id !== member.id),
										)
									}
								/>
								<span className="min-w-0 flex-1">
									<span className="block break-words font-medium">{member.name}</span>
									<span className="block break-all text-xs text-muted-foreground">
										{[member.email, member.departmentName].filter(Boolean).join(" · ")}
									</span>
								</span>
							</label>
						</li>
					))}
				</ul>
				<div className="flex items-center justify-end gap-2">
					<button type="button" className={buttonClass("outline")} onClick={onClose}>
						{t("common.cancel")}
					</button>
					<button
						type="button"
						disabled={selected.length === 0 || assign.isPending}
						className={buttonClass()}
						onClick={() => assign.mutate()}
					>
						{t("course.assign_count", { count: selected.length })}
					</button>
				</div>
			</div>
		</Modal>
	);
}

export function CourseLearnersPage({ id }: { id: string }) {
	const { t, language } = useI18n();
	const queryClient = useQueryClient();
	const [assigning, setAssigning] = useState(false);
	const learners = useQuery({
		queryKey: ["course-learners", id],
		queryFn: () => api<LearnersData>(`/courses/${id}/learners`),
	});
	const unassign = useMutation({
		mutationFn: (userId: string) => api(`/courses/${id}/enrollments/${userId}`, { method: "DELETE" }),
		onSettled: () => queryClient.invalidateQueries({ queryKey: ["course-learners", id] }),
	});
	if (learners.isPending) return <PageLoading />;
	if (learners.isError) return <PageError onRetry={() => learners.refetch()} />;
	const data = learners.data;
	const labels = {
		not_started: "course.status_not_started",
		in_progress: "course.status_in_progress",
		completed: "course.status_completed",
	};
	return (
		<div className="flex flex-col gap-4 p-4 md:px-6 md:py-7">
			<div className="flex flex-wrap items-center gap-3">
				<Link href={`/courses/${id}/manage`} aria-label={t("course.back_to_course")} className="grid size-8 place-items-center rounded-md border border-border text-foreground">
					<ChevronLeft size={16} aria-hidden="true" />
				</Link>
				<div className="min-w-0 flex-[1_1_260px]">
					<h1 className="text-[22px] font-semibold">{t("course.learner_progress")}</h1>
					<p className="break-words text-muted-foreground">{data.title}</p>
				</div>
				{!data.isMandatory && (
					<button type="button" className={buttonClass("primary", "min-h-9 py-0")} onClick={() => setAssigning(true)}>
						{t("course.assign")}
					</button>
				)}
			</div>
			{data.isMandatory && <p className="rounded-md bg-selected px-3 py-2 text-[13px]">{t("course.mandatory_everyone")}</p>}
			{unassign.isError && <Alert>{t("error.generic")}</Alert>}
			{data.learners.length === 0 ? (
				<StatePanel title={t("course.no_learners")} description={t("course.no_learners_desc")} />
			) : (
				<section className="overflow-x-auto rounded-card border border-border bg-card">
					<table className="w-full min-w-[640px] text-left text-[13px]">
						<thead className="bg-background text-xs text-muted-foreground">
							<tr>
								<th scope="col" className="px-4 py-2.5 font-semibold">{t("course.learner")}</th>
								<th scope="col" className="px-2 py-2.5 font-semibold">{t("course.status")}</th>
								<th scope="col" className="px-2 py-2.5 font-semibold">{t("course.progress")}</th>
								<th scope="col" className="px-2 py-2.5 font-semibold">{t("course.best_score")}</th>
								<th scope="col" className="px-2 py-2.5 font-semibold">{t("course.completed_on")}</th>
								<th scope="col" className="px-4 py-2.5"><span className="sr-only">{t("course.actions")}</span></th>
							</tr>
						</thead>
						<tbody>
							{data.learners.map((learner) => (
								<tr key={learner.id} className="border-t border-border">
									<td className="px-4 py-2.5">
										<span className="block break-words font-semibold">{learner.name}</span>
										<span className="block break-all text-xs text-muted-foreground">
											{[learner.email, learner.departmentName].filter(Boolean).join(" · ")}
										</span>
									</td>
									<td className="px-2 py-2.5">{t(labels[learner.status])}</td>
									<td className="px-2 py-2.5">{learner.percent}%</td>
									<td className="px-2 py-2.5">{learner.bestScore === null ? "—" : `${learner.bestScore}%`}</td>
									<td className="px-2 py-2.5">
										{learner.completedAt
											? new Date(learner.completedAt).toLocaleDateString(language, { dateStyle: "medium" })
											: "—"}
									</td>
									<td className="px-4 py-2.5 text-right">
										{!data.isMandatory && (
											<button
												type="button"
												disabled={unassign.isPending}
												className="text-xs font-medium text-danger-foreground hover:underline"
												onClick={() => unassign.mutate(learner.id)}
											>
												{t("course.unassign")}
											</button>
										)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</section>
			)}
			{assigning && <AssignDialog courseId={id} data={data} onClose={() => setAssigning(false)} />}
		</div>
	);
}
