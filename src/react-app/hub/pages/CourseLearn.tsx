import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	Award,
	Check,
	ChevronLeft,
	ChevronRight,
	Circle,
	Download,
	ListChecks,
	Lock,
	Menu,
	Minus,
	Plus,
	Printer,
} from "lucide-react";
import { Link } from "wouter";
import { api, ApiError } from "../api";
import { useI18n } from "../i18n";
import { RichText } from "../RichText";
import { Alert, buttonClass, PageError, PageLoading, StatePanel } from "../ui";
import { KindBadge } from "./CourseBuilder";
import { COURSES_KEY, coverUrl } from "./Courses";

interface OutlineLesson {
	id: number;
	title: string;
	isRequired: boolean;
	estimatedTime: string | null;
	done: boolean;
}

interface LearnerCourse {
	id: number;
	title: string;
	description: string | null;
	objectives: string | null;
	duration: string | null;
	status: "draft" | "published";
	isMandatory: boolean;
	hasCover: boolean;
	updatedAt: string;
	preview: boolean;
	completed: boolean;
	started: boolean;
	percent: number;
	certificateId: number | null;
	nextLessonId: number | null;
	lessonTotal: number;
	lessonsDone: number;
	modules: { id: number; title: string; lessons: OutlineLesson[] }[];
	quiz: {
		title: string | null;
		questions: number;
		passingScore: number;
		passed: boolean;
		unlocked: boolean;
	} | null;
}

interface LessonMaterial {
	id: number;
	name: string;
	kind: "pdf" | "video" | "document" | "sheet";
	sizeBytes: number | null;
	isRequired: boolean;
	pageCount: number | null;
	viewedPages: number[];
	done: boolean;
}

interface LearnerLesson {
	id: number;
	title: string;
	content: string | null;
	videoEmbed: string | null;
	completionMethod: "mark" | "scroll" | "open";
	estimatedTime: string | null;
	isRequired: boolean;
	done: boolean;
	preview: boolean;
	materials: LessonMaterial[];
}

function learnerKey(id: string) {
	return ["course-learn", id];
}

function fileUrl(courseId: string, materialId: number, download = false) {
	return `/api/courses/${courseId}/materials/${materialId}/file${download ? "?download=1" : ""}`;
}

function BackToCourses() {
	const { t } = useI18n();
	return (
		<Link href="/courses" className={buttonClass("outline")}>
			{t("course.back_to_courses")}
		</Link>
	);
}

function PreviewBanner({ draft }: { draft: boolean }) {
	const { t } = useI18n();
	return (
		<p role="status" className="bg-selected px-4 py-2 text-[13px] text-selected-foreground md:px-6">
			{t(draft ? "course.preview_draft" : "course.preview_note")}
		</p>
	);
}

export function CourseOverviewPage({ id, canManage }: { id: string; canManage: boolean }) {
	const { t } = useI18n();
	const course = useQuery({
		queryKey: learnerKey(id),
		queryFn: () => api<LearnerCourse>(`/courses/${id}`),
	});
	if (course.isPending) return <PageLoading />;
	if (course.isError) {
		return course.error instanceof ApiError && course.error.status === 404 ? (
			<StatePanel title={t("course.not_found")} description={t("course.not_found_desc")} action={<BackToCourses />} />
		) : (
			<PageError onRetry={() => course.refetch()} />
		);
	}
	const data = course.data;
	const cta = data.completed ? "course.review" : data.started ? "course.continue" : "course.start";
	return (
		<div className="flex flex-col">
			{data.preview && <PreviewBanner draft={data.status === "draft"} />}
			<div className="flex flex-col gap-4 p-4 md:px-6 md:py-7">
				<Link href="/courses" className="flex items-center gap-1 self-start text-[13px] text-muted-foreground no-underline hover:underline">
					<ChevronLeft size={14} aria-hidden="true" />
					{t("nav.courses")}
				</Link>
				<div className="flex flex-wrap items-start gap-4">
					<div className="flex min-w-0 flex-[999_1_420px] flex-col gap-4">
						<section className="overflow-hidden rounded-card border border-border bg-card">
							{data.hasCover && (
								<img src={coverUrl(data.id, data.updatedAt)} alt="" className="aspect-[16/6] w-full object-cover" />
							)}
							<div className="flex flex-col gap-3 p-5">
								<h1 className="break-words text-[24px] font-semibold leading-8">{data.title}</h1>
								{data.description && <p className="whitespace-pre-wrap break-words">{data.description}</p>}
								{data.objectives && (
									<div>
										<h2 className="text-[13px] font-semibold">{t("course.objectives")}</h2>
										<p className="whitespace-pre-wrap break-words text-[13px] text-muted-foreground">{data.objectives}</p>
									</div>
								)}
								{data.duration && <p className="text-[13px] text-muted-foreground">{t("course.duration")}: {data.duration}</p>}
							</div>
						</section>
						<section className="rounded-card border border-border bg-card">
							<h2 className="border-b border-border px-5 py-3.5 text-[15px] font-semibold">{t("course.outline")}</h2>
							{data.modules.map((module, moduleIndex) => (
								<div key={module.id} className="border-b border-border last:border-b-0">
									<h3 className="px-5 pb-1 pt-3 text-[12px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
										{moduleIndex + 1} · {module.title}
									</h3>
									<ul className="pb-2">
										{module.lessons.map((lesson) => (
											<li key={lesson.id}>
												<Link href={`/courses/${id}/lessons/${lesson.id}`} className="flex items-center gap-2.5 px-5 py-2 text-foreground no-underline hover:bg-muted">
													{lesson.done ? (
														<Check size={16} aria-label={t("course.status_completed")} className="shrink-0 text-[#14795A]" />
													) : (
														<Circle size={16} aria-hidden="true" className="shrink-0 text-muted-foreground" />
													)}
													<span className="min-w-0 flex-1 break-words">{lesson.title}</span>
													{lesson.estimatedTime && <span className="shrink-0 text-xs text-muted-foreground">{lesson.estimatedTime}</span>}
												</Link>
											</li>
										))}
									</ul>
								</div>
							))}
							{data.quiz && (
								<Link href={`/courses/${id}/quiz`} className="flex items-center gap-2.5 border-t border-border px-5 py-3 text-foreground no-underline hover:bg-muted">
									{data.quiz.unlocked || data.preview ? (
										<ListChecks size={16} aria-hidden="true" className="shrink-0 text-[#753FF3]" />
									) : (
										<Lock size={16} aria-hidden="true" className="shrink-0 text-muted-foreground" />
									)}
									<span className="flex-1 font-semibold">{data.quiz.title || t("course.final_quiz")}</span>
									<span className="text-xs text-muted-foreground">
										{data.quiz.passed
											? t("quiz.passed_short")
											: data.quiz.unlocked
												? t("quiz.pass_mark", { score: data.quiz.passingScore })
												: t("quiz.locked_short")}
									</span>
								</Link>
							)}
						</section>
					</div>
					<aside className="flex min-w-0 flex-[1_1_280px] flex-col gap-3 rounded-card border border-border bg-card p-5 lg:max-w-[320px]">
						<p className="flex justify-between text-[13px]">
							<span className="text-muted-foreground">{t("course.your_progress")}</span>
							<span className="font-semibold">{data.percent}%</span>
						</p>
						<div
							role="progressbar"
							aria-valuenow={data.percent}
							aria-valuemin={0}
							aria-valuemax={100}
							aria-label={t("course.your_progress")}
							className="h-2 overflow-hidden rounded-full bg-input"
						>
							<div className="h-full rounded-full bg-primary" style={{ width: `${data.percent}%` }} />
						</div>
						<p className="text-[13px] text-muted-foreground">
							{t("course.lessons_done", { done: data.lessonsDone, total: data.lessonTotal })}
						</p>
						{data.nextLessonId !== null && (
							<Link href={`/courses/${id}/lessons/${data.nextLessonId}`} className={buttonClass()}>
								{t(cta)}
							</Link>
						)}
						{data.certificateId !== null && (
							<Link href={`/certificates/${data.certificateId}`} className={buttonClass("outline")}>
								<Award size={16} aria-hidden="true" />
								{t("course.view_certificate")}
							</Link>
						)}
						{canManage && (
							<Link href={`/courses/${id}/manage`} className={buttonClass("outline")}>
								{t("course.manage")}
							</Link>
						)}
					</aside>
				</div>
			</div>
		</div>
	);
}

type PdfDocument = {
	numPages: number;
	getPage(page: number): Promise<{
		getViewport(options: { scale: number }): { width: number; height: number };
		render(options: {
			canvasContext: CanvasRenderingContext2D;
			viewport: { width: number; height: number };
		}): { promise: Promise<void>; cancel(): void };
	}>;
	destroy(): Promise<void>;
};

// The PDF library is large, so it only loads for people opening a document. The
// legacy build also works on the older phones many staff use.
async function openPdf(url: string): Promise<PdfDocument> {
	const [pdfjs, worker] = await Promise.all([
		import("pdfjs-dist/legacy/build/pdf.mjs"),
		import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url"),
	]);
	pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
	const task = pdfjs.getDocument({
		url,
		withCredentials: true,
		isEvalSupported: false,
		disableAutoFetch: true,
	});
	return (await task.promise) as unknown as PdfDocument;
}

function PdfViewer({
	courseId,
	material,
	onViewed,
}: {
	courseId: string;
	material: LessonMaterial;
	onViewed: (result: { viewedPages: number[]; done: boolean; total?: number }) => void;
}) {
	const { t } = useI18n();
	const canvas = useRef<HTMLCanvasElement>(null);
	const frame = useRef<HTMLDivElement>(null);
	const [pdf, setPdf] = useState<PdfDocument | null>(null);
	const [failed, setFailed] = useState(false);
	const [page, setPage] = useState(1);
	const [zoom, setZoom] = useState(1);
	const [viewed, setViewed] = useState<number[]>(material.viewedPages);
	const [width, setWidth] = useState(0);

	// Redraws when a phone turns or the window changes size.
	useEffect(() => {
		if (!frame.current) return;
		const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
		observer.observe(frame.current);
		return () => observer.disconnect();
	}, []);

	useEffect(() => {
		let active = true;
		let opened: PdfDocument | null = null;
		openPdf(fileUrl(courseId, material.id))
			.then((document) => {
				if (active) {
					opened = document;
					setPdf(document);
				} else {
					void document.destroy();
				}
			})
			.catch(() => active && setFailed(true));
		return () => {
			active = false;
			void opened?.destroy();
		};
	}, [courseId, material.id]);

	useEffect(() => {
		if (!pdf || !canvas.current || width === 0) return;
		let cancelled = false;
		let task: { cancel(): void } | null = null;
		const target = canvas.current;
		pdf
			.getPage(page)
			.then((loaded) => {
				if (cancelled) return undefined;
				const base = loaded.getViewport({ scale: 1 });
				const ratio = window.devicePixelRatio || 1;
				const viewport = loaded.getViewport({ scale: (width / base.width) * zoom * ratio });
				target.width = viewport.width;
				target.height = viewport.height;
				target.style.width = `${viewport.width / ratio}px`;
				target.style.height = `${viewport.height / ratio}px`;
				const context = target.getContext("2d");
				if (!context) return undefined;
				const render = loaded.render({ canvasContext: context, viewport });
				task = render;
				return render.promise;
			})
			.catch(() => undefined);
		return () => {
			cancelled = true;
			task?.cancel();
		};
	}, [pdf, page, zoom, width]);

	const report = useRef(onViewed);
	useEffect(() => {
		report.current = onViewed;
	});
	useEffect(() => {
		if (!pdf) return;
		api<{ viewedPages: number[]; done: boolean; preview?: boolean }>(
			`/courses/${courseId}/materials/${material.id}/view`,
			{ method: "POST", body: { page, pageCount: pdf.numPages } },
		)
			.then((result) => {
				if (!result.preview) {
					setViewed(result.viewedPages);
					report.current({ ...result, total: pdf.numPages });
				}
			})
			.catch(() => undefined);
	}, [courseId, material.id, pdf, page]);

	const total = pdf?.numPages ?? material.pageCount ?? 0;
	return (
		<section className="overflow-hidden rounded-card border border-border bg-card">
			<div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
				<KindBadge kind="pdf" />
				<span className="min-w-0 flex-[1_1_160px]">
					<span className="block break-words font-medium">{material.name}</span>
					<span className="block text-xs text-muted-foreground">
						{t("course.viewed_pages", { viewed: viewed.length, total })}
					</span>
				</span>
				<button type="button" aria-label={t("course.zoom_out")} disabled={zoom <= 1} onClick={() => setZoom((value) => value - 0.25)} className="grid size-8 place-items-center rounded border border-input disabled:opacity-40">
					<Minus size={14} aria-hidden="true" />
				</button>
				<button type="button" aria-label={t("course.zoom_in")} disabled={zoom >= 3} onClick={() => setZoom((value) => value + 0.25)} className="grid size-8 place-items-center rounded border border-input disabled:opacity-40">
					<Plus size={14} aria-hidden="true" />
				</button>
				<a href={fileUrl(courseId, material.id, true)} aria-label={t("course.download_file", { name: material.name })} className="grid size-8 place-items-center rounded border border-input text-foreground">
					<Download size={14} aria-hidden="true" />
				</a>
			</div>
			<div ref={frame} className="grid max-h-[72vh] min-h-64 overflow-auto bg-muted">
				{failed ? (
					<p className="self-center p-6 text-center text-[13px] text-muted-foreground">
						{t("course.pdf_failed")}{" "}
						<a href={fileUrl(courseId, material.id, true)}>{t("course.download")}</a>
					</p>
				) : (
					<>
						{!pdf && <PageLoading />}
						<canvas ref={canvas} aria-label={t("course.page_of", { page, total })} className={pdf ? "mx-auto block bg-white" : "hidden"} />
					</>
				)}
			</div>
			<div className="flex items-center gap-2 border-t border-border px-3 py-2">
				<button type="button" disabled={page <= 1} className={buttonClass("outline", "min-h-10 px-3 py-0")} onClick={() => setPage((value) => value - 1)}>
					<ChevronLeft size={16} aria-hidden="true" />
					<span className="hidden sm:inline">{t("course.previous_page")}</span>
				</button>
				<span className="flex-1 text-center text-[13px]">{t("course.page_of", { page, total })}</span>
				<button type="button" disabled={!pdf || page >= total} className={buttonClass("primary", "min-h-10 px-3 py-0")} onClick={() => setPage((value) => value + 1)}>
					<span className="hidden sm:inline">{t("course.next_page")}</span>
					<ChevronRight size={16} aria-hidden="true" />
				</button>
			</div>
		</section>
	);
}

function VideoMaterial({
	courseId,
	material,
	onViewed,
}: {
	courseId: string;
	material: LessonMaterial;
	onViewed: (result: { viewedPages: number[]; done: boolean }) => void;
}) {
	const { t } = useI18n();
	return (
		<section className="overflow-hidden rounded-card border border-border bg-card">
			<video
				controls
				preload="metadata"
				playsInline
				src={fileUrl(courseId, material.id)}
				className="aspect-video w-full bg-black"
				onEnded={() => {
					api<{ viewedPages: number[]; done: boolean; preview?: boolean }>(
						`/courses/${courseId}/materials/${material.id}/view`,
						{ method: "POST", body: { event: "ended" } },
					)
						.then((result) => {
							if (!result.preview) onViewed(result);
						})
						.catch(() => undefined);
				}}
			/>
			<p className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-[13px]">
				<span className="min-w-0 break-words font-medium">{material.name}</span>
				{material.isRequired && (
					<span className={material.done ? "text-[#14795A]" : "text-muted-foreground"}>
						{t(material.done ? "course.watched" : "course.watch_to_end")}
					</span>
				)}
			</p>
		</section>
	);
}

function FileMaterial({
	courseId,
	material,
	onViewed,
}: {
	courseId: string;
	material: LessonMaterial;
	onViewed: (result: { viewedPages: number[]; done: boolean }) => void;
}) {
	const { t } = useI18n();
	return (
		<a
			href={fileUrl(courseId, material.id, material.kind !== "pdf")}
			target={material.kind === "pdf" ? "_blank" : undefined}
			rel="noreferrer"
			className="flex items-center gap-3 rounded-[9px] border border-border bg-card px-3 py-2.5 text-foreground no-underline hover:bg-muted"
			onClick={() => {
				// An extra PDF has no page tracking, so opening it records nothing.
				if (material.kind === "pdf") return;
				api<{ viewedPages: number[]; done: boolean; preview?: boolean }>(
					`/courses/${courseId}/materials/${material.id}/view`,
					{ method: "POST", body: { event: "opened" } },
				)
					.then((result) => {
						if (!result.preview && material.isRequired) onViewed(result);
					})
					.catch(() => undefined);
			}}
		>
			<KindBadge kind={material.kind} />
			<span className="min-w-0 flex-1">
				<span className="block break-words font-medium">{material.name}</span>
				{material.isRequired && (
					<span className={`block text-xs ${material.done ? "text-[#14795A]" : "text-muted-foreground"}`}>
						{t(material.done ? "course.opened" : "course.open_to_complete")}
					</span>
				)}
			</span>
			<span className="text-[13px] font-medium text-selected-foreground">{t("course.open")}</span>
		</a>
	);
}

function LessonOutline({
	course,
	lessonId,
	onNavigate,
}: {
	course: LearnerCourse;
	lessonId: number;
	onNavigate?: () => void;
}) {
	const { t } = useI18n();
	return (
		<nav aria-label={t("course.outline")} className="flex flex-col gap-3">
			{course.modules.map((module, index) => (
				<div key={module.id}>
					<p className="px-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
						{index + 1} · {module.title}
					</p>
					<ul className="mt-1 flex flex-col gap-0.5">
						{module.lessons.map((lesson) => {
							const active = lesson.id === lessonId;
							return (
								<li key={lesson.id}>
									<Link
										href={`/courses/${course.id}/lessons/${lesson.id}`}
										aria-current={active ? "page" : undefined}
										onClick={onNavigate}
										className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] no-underline ${active ? "bg-primary font-medium text-primary-foreground" : "text-foreground hover:bg-muted"}`}
									>
										{lesson.done ? (
											<Check size={14} aria-label={t("course.status_completed")} className={`shrink-0 ${active ? "" : "text-[#14795A]"}`} />
										) : (
											<Circle size={14} aria-hidden="true" className="shrink-0 opacity-60" />
										)}
										<span className="min-w-0 break-words">{lesson.title}</span>
									</Link>
								</li>
							);
						})}
					</ul>
				</div>
			))}
			{course.quiz && (
				<Link
					href={`/courses/${course.id}/quiz`}
					onClick={onNavigate}
					className="flex items-center gap-2 rounded-md border border-border px-2 py-2 text-[13px] text-foreground no-underline hover:bg-muted"
				>
					{course.quiz.unlocked || course.preview ? (
						<ListChecks size={14} aria-hidden="true" className="shrink-0 text-[#753FF3]" />
					) : (
						<Lock size={14} aria-hidden="true" className="shrink-0 text-muted-foreground" />
					)}
					<span className="min-w-0">
						<span className="block font-semibold">{course.quiz.title || t("course.final_quiz")}</span>
						{!course.quiz.unlocked && <span className="block text-xs text-muted-foreground">{t("quiz.unlocks_after")}</span>}
					</span>
				</Link>
			)}
		</nav>
	);
}

export function CourseLessonPage({ id, lessonId }: { id: string; lessonId: string }) {
	const { t } = useI18n();
	const queryClient = useQueryClient();
	const [outlineOpen, setOutlineOpen] = useState(false);
	const course = useQuery({
		queryKey: learnerKey(id),
		queryFn: () => api<LearnerCourse>(`/courses/${id}`),
	});
	const key = ["course-learn-lesson", id, lessonId];
	const lesson = useQuery({
		queryKey: key,
		queryFn: () => api<LearnerLesson>(`/courses/${id}/lessons/${lessonId}`),
		// A lesson's own viewer keeps progress on screen, so refocusing mustn't reset it.
		refetchOnWindowFocus: false,
	});
	const [finishedMaterials, setFinishedMaterials] = useState<number[]>([]);
	const [pageNotes, setPageNotes] = useState<Record<number, { seen: number; total?: number }>>({});
	const [reachedEnd, setReachedEnd] = useState(false);
	const bottom = useRef<HTMLDivElement>(null);
	const scrollArea = useRef<HTMLDivElement>(null);

	const complete = useMutation({
		mutationFn: () => api(`/courses/${id}/lessons/${lessonId}/complete`, { method: "POST" }),
		onSuccess: async () => {
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: key }),
				queryClient.invalidateQueries({ queryKey: learnerKey(id) }),
				queryClient.invalidateQueries({ queryKey: COURSES_KEY }),
				queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
			]);
		},
	});

	const data = lesson.data;
	const recordViewed = useCallback(
		(material: LessonMaterial, result: { viewedPages: number[]; done: boolean; total?: number }) => {
			setPageNotes((current) => ({
				...current,
				[material.id]: { seen: result.viewedPages.length, total: result.total },
			}));
			if (result.done) {
				setFinishedMaterials((current) =>
					current.includes(material.id) ? current : [...current, material.id],
				);
			}
		},
		[],
	);

	const required = data?.materials.filter((material) => material.isRequired) ?? [];
	const waiting = required.filter(
		(material) => !material.done && !finishedMaterials.includes(material.id),
	);
	const canComplete = data !== undefined && !data.preview && !data.done && waiting.length === 0;

	useEffect(() => {
		if (!bottom.current || !data || data.completionMethod !== "scroll") return;
		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) setReachedEnd(true);
			},
			{ root: scrollArea.current },
		);
		observer.observe(bottom.current);
		return () => observer.disconnect();
	}, [data]);

	const autoComplete =
		canComplete &&
		(data.completionMethod === "open" || (data.completionMethod === "scroll" && reachedEnd));
	const completeLesson = complete.mutate;
	const attempted = complete.isPending || complete.isError;
	useEffect(() => {
		if (autoComplete && !attempted) completeLesson();
	}, [autoComplete, attempted, completeLesson]);

	if (course.isPending || lesson.isPending) return <PageLoading />;
	if (course.isError || lesson.isError) {
		const missing =
			(course.error instanceof ApiError && course.error.status === 404) ||
			(lesson.error instanceof ApiError && lesson.error.status === 404);
		return missing ? (
			<StatePanel title={t("course.not_found")} description={t("course.not_found_desc")} action={<BackToCourses />} />
		) : (
			<PageError
				onRetry={() => {
					void course.refetch();
					void lesson.refetch();
				}}
			/>
		);
	}

	const outline = course.data;
	const current = lesson.data;
	const ordered = outline.modules.flatMap((module) => module.lessons);
	const position = ordered.findIndex((item) => item.id === current.id);
	const previous = ordered[position - 1];
	const next = ordered[position + 1];
	const pagesLeft = waiting.reduce((sum, material) => {
		if (material.kind !== "pdf") return sum;
		const note = pageNotes[material.id];
		const seen = note?.seen ?? material.viewedPages.length;
		return sum + Math.max(0, (note?.total ?? material.pageCount ?? 0) - seen);
	}, 0);
	const statusText = current.preview
		? t("course.preview_not_recorded")
		: current.done
			? t("course.lesson_done")
			: waiting.length > 0
				? waiting.some((material) => material.kind === "pdf") && pagesLeft > 0
					? t("course.view_more_pages", { count: pagesLeft })
					: t("course.finish_materials", { count: waiting.length })
				: current.completionMethod === "scroll"
					? t("course.scroll_to_finish")
					: t("course.ready_to_complete");
	const afterLast = outline.quiz ? `/courses/${id}/quiz` : `/courses/${id}`;
	const viewers = current.materials.filter(
		(material) => material.kind === "video" || (material.kind === "pdf" && material.isRequired),
	);
	const others = current.materials.filter((material) => !viewers.includes(material));

	return (
		<div className="flex h-full min-h-0 flex-col">
			<header className="flex flex-wrap items-center gap-3 border-b border-border bg-card px-4 py-2.5 md:px-5">
				<Link href={`/courses/${id}`} className={buttonClass("outline", "min-h-[34px] gap-1.5 px-3 py-0")}>
					<ChevronLeft size={16} aria-hidden="true" />
					{t("course.exit_lesson")}
				</Link>
				<div className="min-w-0 flex-[1_1_220px]">
					<p className="truncate font-semibold">{outline.title}</p>
					<p className="flex items-center gap-2 text-xs text-muted-foreground">
						<span className="whitespace-nowrap">{t("course.lessons_done", { done: ordered.filter((lesson) => lesson.done).length, total: ordered.length })}</span>
						<span
							role="progressbar"
							aria-valuenow={outline.percent}
							aria-valuemin={0}
							aria-valuemax={100}
							aria-label={t("course.your_progress")}
							className="h-1.5 w-[140px] max-w-[30%] overflow-hidden rounded-full bg-input"
						>
							<span className="block h-full rounded-full bg-primary" style={{ width: `${outline.percent}%` }} />
						</span>
						{outline.percent}%
					</p>
				</div>
				{!current.preview && (
					<span className="hidden items-center gap-1.5 text-[13px] text-muted-foreground md:inline-flex">
						<Check size={14} strokeWidth={2.5} aria-hidden="true" className="text-[#22A076]" />
						{t("course.progress_saved")}
					</span>
				)}
				<button
					type="button"
					aria-label={t("course.open_outline")}
					aria-expanded={outlineOpen}
					onClick={() => setOutlineOpen((open) => !open)}
					className="grid size-10 shrink-0 place-items-center rounded-md border border-border lg:hidden"
				>
					<Menu size={18} aria-hidden="true" />
				</button>
			</header>
			{current.preview && <PreviewBanner draft={outline.status === "draft"} />}
			<div className="flex min-h-0 flex-1">
				<aside className={`${outlineOpen ? "absolute inset-x-0 z-20 max-h-[70vh] shadow-lg" : "hidden"} overflow-auto border-r border-border bg-card p-3 lg:static lg:block lg:max-h-none lg:w-[280px] lg:shrink-0 lg:shadow-none`}>
					<LessonOutline course={outline} lessonId={current.id} onNavigate={() => setOutlineOpen(false)} />
				</aside>
				<div ref={scrollArea} className="relative min-w-0 flex-1 overflow-auto">
					<article className="mx-auto flex max-w-[820px] flex-col gap-4 p-4 md:p-6">
						<div>
							<p className="text-xs text-muted-foreground">
								{[
									current.isRequired ? t("course.required") : t("course.optional"),
									current.estimatedTime,
								]
									.filter(Boolean)
									.join(" · ")}
							</p>
							<h1 className="break-words text-[22px] font-semibold leading-8">{current.title}</h1>
						</div>
						{current.videoEmbed && (
							<div className="aspect-video overflow-hidden rounded-card bg-black">
								<iframe
									src={current.videoEmbed}
									title={current.title}
									className="size-full"
									allow="encrypted-media; picture-in-picture; fullscreen"
									allowFullScreen
									referrerPolicy="strict-origin-when-cross-origin"
									sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
								/>
							</div>
						)}
						{current.content && <RichText text={current.content} />}
						{viewers.map((material) =>
							material.kind === "pdf" ? (
								<PdfViewer
									key={material.id}
									courseId={id}
									material={material}
									onViewed={(result) => recordViewed(material, result)}
								/>
							) : (
								<VideoMaterial
									key={material.id}
									courseId={id}
									material={{ ...material, done: material.done || finishedMaterials.includes(material.id) }}
									onViewed={(result) => recordViewed(material, result)}
								/>
							),
						)}
						{others.length > 0 && (
							<section className="flex flex-col gap-2">
								<h2 className="text-[13px] font-semibold">{t("course.resources")}</h2>
								{others.map((material) => (
									<FileMaterial
										key={material.id}
										courseId={id}
										material={{ ...material, done: material.done || finishedMaterials.includes(material.id) }}
										onViewed={(result) => recordViewed(material, result)}
									/>
								))}
							</section>
						)}
						<div ref={bottom} aria-hidden="true" className="h-px" />
					</article>
				</div>
			</div>
			<footer className="flex flex-col gap-2 border-t border-border bg-card px-3 py-2.5 md:px-5">
				{complete.isError && <Alert>{t("error.generic")}</Alert>}
				<div className="flex items-center gap-2">
					{previous ? (
						<Link href={`/courses/${id}/lessons/${previous.id}`} aria-label={t("course.previous_lesson")} className={buttonClass("outline", "min-h-11 px-3 py-0")}>
							<ChevronLeft size={16} aria-hidden="true" />
							<span className="hidden md:inline">{t("course.previous_lesson")}</span>
						</Link>
					) : (
						<span className="hidden size-11 md:block" />
					)}
					<div className="flex min-w-0 flex-1 flex-col items-center gap-1 md:flex-row md:justify-center md:gap-3">
						<span role="status" className="text-center text-xs text-muted-foreground">{statusText}</span>
						{!current.done && !current.preview && current.completionMethod === "mark" && (
							<button
								type="button"
								disabled={!canComplete || complete.isPending}
								className={buttonClass("primary", "min-h-11 w-full md:w-auto")}
								onClick={() => complete.mutate()}
							>
								{t("course.mark_complete")}
							</button>
						)}
					</div>
					{next ? (
						<Link href={`/courses/${id}/lessons/${next.id}`} aria-label={t("course.next_lesson")} className={buttonClass(current.done ? "primary" : "outline", "min-h-11 px-3 py-0")}>
							<span className="hidden md:inline">{t("course.next_lesson")}</span>
							<ChevronRight size={16} aria-hidden="true" />
						</Link>
					) : (
						<Link href={afterLast} aria-label={t(outline.quiz ? "course.go_to_quiz" : "course.finish")} className={buttonClass(current.done ? "primary" : "outline", "min-h-11 px-3 py-0")}>
							<span className="hidden md:inline">{t(outline.quiz ? "course.go_to_quiz" : "course.finish")}</span>
							<ChevronRight size={16} aria-hidden="true" />
						</Link>
					)}
				</div>
			</footer>
		</div>
	);
}

interface QuizResult {
	score: number;
	correct: number;
	total: number;
	passed: boolean;
	passingScore: number;
	attemptNumber: number;
	review:
		| {
				question: string;
				options: { text: string; correct: boolean }[];
				chosen: number[];
				right: boolean;
		  }[]
		| null;
	certificateId?: number | null;
}

interface LearnerQuiz {
	courseTitle: string;
	title: string | null;
	passingScore: number;
	unlocked: boolean;
	preview: boolean;
	certificateId: number | null;
	result: QuizResult | null;
	questions: {
		id: number;
		question: string;
		type: "single" | "multiple" | "truefalse";
		options: string[];
	}[];
}

function ResultView({
	id,
	result,
	certificateId,
	onRetry,
}: {
	id: string;
	result: QuizResult;
	certificateId: number | null;
	onRetry: () => void;
}) {
	const { t } = useI18n();
	const [reviewing, setReviewing] = useState(false);
	return (
		<section className="flex flex-col items-center gap-3 rounded-card border border-border bg-card p-6 text-center">
			<p className="text-xs font-semibold tracking-[0.06em] text-muted-foreground">{t("quiz.result")}</p>
			<p className="text-[44px] font-semibold leading-none">{result.score}%</p>
			<h1 className="text-lg font-semibold">
				{result.passed
					? t("quiz.passed")
					: t("quiz.failed", { score: result.score, needed: result.passingScore })}
			</h1>
			<p className="text-[13px] text-muted-foreground">
				{t("quiz.score_detail", {
					correct: result.correct,
					total: result.total,
					score: result.passingScore,
					attempt: result.attemptNumber,
				})}
			</p>
			<div className="flex flex-wrap justify-center gap-2">
				{result.passed ? (
					<>
						{certificateId !== null && (
							<Link href={`/certificates/${certificateId}`} className={buttonClass()}>
								<Award size={16} aria-hidden="true" />
								{t("course.view_certificate")}
							</Link>
						)}
						<button type="button" className={buttonClass("outline")} onClick={() => setReviewing((open) => !open)}>
							{t("quiz.review_answers")}
						</button>
					</>
				) : (
					<button type="button" className={buttonClass()} onClick={onRetry}>
						{t("quiz.try_again")}
					</button>
				)}
				<Link href={`/courses/${id}`} className={buttonClass("outline")}>
					{t("quiz.back_to_lessons")}
				</Link>
			</div>
			{reviewing && result.review && (
				<ol className="mt-2 flex w-full flex-col gap-3 text-left">
					{result.review.map((item, index) => (
						<li key={index} className="rounded-[9px] border border-border p-3">
							<p className="break-words font-semibold">{index + 1}. {item.question}</p>
							<ul className="mt-1.5 flex flex-col gap-1 text-[13px]">
								{item.options.map((option, optionIndex) => (
									<li key={optionIndex} className="flex items-start gap-2">
										{option.correct ? (
											<Check size={14} aria-label={t("quiz.correct_answer")} className="mt-1 shrink-0 text-[#14795A]" />
										) : (
											<span className="size-3.5 shrink-0" />
										)}
										<span className={`min-w-0 break-words ${item.chosen.includes(optionIndex) ? "font-semibold" : ""}`}>
											{option.text}
											{item.chosen.includes(optionIndex) && ` · ${t("quiz.your_answer")}`}
										</span>
									</li>
								))}
							</ul>
						</li>
					))}
				</ol>
			)}
		</section>
	);
}

export function CourseQuizPage({ id }: { id: string }) {
	const { t } = useI18n();
	const queryClient = useQueryClient();
	const quiz = useQuery({
		queryKey: ["course-quiz", id],
		queryFn: () => api<LearnerQuiz>(`/courses/${id}/quiz`),
		refetchOnWindowFocus: false,
	});
	const [answers, setAnswers] = useState<Record<number, number[]>>({});
	const [retrying, setRetrying] = useState(false);
	const [missing, setMissing] = useState<number | null>(null);
	const submit = useMutation({
		mutationFn: () =>
			api<QuizResult>(`/courses/${id}/quiz/attempts`, { method: "POST", body: { answers } }),
		onSuccess: async () => {
			setRetrying(false);
			setAnswers({});
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: ["course-quiz", id] }),
				queryClient.invalidateQueries({ queryKey: learnerKey(id) }),
				queryClient.invalidateQueries({ queryKey: COURSES_KEY }),
				queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
			]);
		},
	});
	if (quiz.isPending) return <PageLoading />;
	if (quiz.isError) {
		return quiz.error instanceof ApiError && quiz.error.status === 404 ? (
			<StatePanel title={t("course.not_found")} action={<BackToCourses />} />
		) : (
			<PageError onRetry={() => quiz.refetch()} />
		);
	}
	const data = quiz.data;
	const answered = data.questions.filter((question) => answers[question.id]?.length).length;
	const showForm = !data.result || (retrying && !data.result.passed);

	function send() {
		const first = data.questions.findIndex((question) => !answers[question.id]?.length);
		if (first !== -1) {
			setMissing(first);
			return;
		}
		setMissing(null);
		submit.mutate();
	}

	return (
		<div className="mx-auto flex w-full max-w-[760px] flex-col gap-4 p-4 md:py-7">
			<Link href={`/courses/${id}`} className="flex items-center gap-1 self-start text-[13px] text-muted-foreground no-underline hover:underline">
				<ChevronLeft size={14} aria-hidden="true" />
				{t("course.back_to_course")}
			</Link>
			{data.preview && <PreviewBanner draft={false} />}
			<p className="break-words text-[13px] text-muted-foreground">
				{data.courseTitle} · {data.title || t("course.final_quiz")}
			</p>
			{!data.unlocked && !data.preview ? (
				<StatePanel icon={Lock} title={t("quiz.locked_title")} description={t("quiz.locked_desc")} action={
					<Link href={`/courses/${id}`} className={buttonClass("outline")}>{t("quiz.back_to_lessons")}</Link>
				} />
			) : showForm ? (
				<>
					<div className="flex flex-wrap items-center justify-between gap-2">
						<h1 className="text-lg font-semibold">
							{t("quiz.answered", { done: answered, total: data.questions.length })}
						</h1>
						<span className="text-[13px] text-muted-foreground">
							{t("quiz.pass_mark", { score: data.passingScore })}
						</span>
					</div>
					{data.questions.map((question, index) => {
						const multiple = question.type === "multiple";
						const chosen = answers[question.id] ?? [];
						return (
							<fieldset key={question.id} id={`question-${index}`} className={`rounded-card border bg-card p-4 ${missing === index ? "border-destructive" : "border-border"}`}>
								<legend className="sr-only">{question.question}</legend>
								<p className="text-xs text-muted-foreground">
									{t(multiple ? "quiz.question_select_all" : "quiz.question_number", { number: index + 1 })}
								</p>
								<p className="mt-1 whitespace-pre-wrap break-words font-semibold">{question.question}</p>
								<div className="mt-3 flex flex-col gap-1.5">
									{question.options.map((option, optionIndex) => (
										<label key={optionIndex} className="flex cursor-pointer items-start gap-2.5 rounded-md border border-border px-3 py-2.5 has-checked:border-primary has-checked:bg-selected">
											<input
												type={multiple ? "checkbox" : "radio"}
												name={`question-${question.id}`}
												className="mt-1 size-4 shrink-0 accent-primary"
												checked={chosen.includes(optionIndex)}
												onChange={(event) => {
													setMissing(null);
													setAnswers((current) => ({
														...current,
														[question.id]: multiple
															? event.target.checked
																? [...chosen, optionIndex]
																: chosen.filter((value) => value !== optionIndex)
															: [optionIndex],
													}));
												}}
											/>
											<span className="min-w-0 break-words">{option}</span>
										</label>
									))}
								</div>
							</fieldset>
						);
					})}
					{missing !== null && (
						<div role="alert" className="rounded-md border border-destructive p-3 text-[13px]">
							{t("quiz.not_answered", { number: missing + 1 })}{" "}
							<a href={`#question-${missing}`}>{t("quiz.go_to_question", { number: missing + 1 })}</a>
						</div>
					)}
					{submit.isError && <Alert>{t("error.generic")}</Alert>}
					{data.preview ? (
						<p className="text-center text-[13px] text-muted-foreground">{t("course.preview_not_recorded")}</p>
					) : (
						<button type="button" disabled={submit.isPending} className={buttonClass("primary", "self-end")} onClick={send}>
							{t("quiz.submit")}
						</button>
					)}
				</>
			) : (
				data.result && (
					<ResultView id={id} result={data.result} certificateId={data.certificateId} onRetry={() => setRetrying(true)} />
				)
			)}
		</div>
	);
}

interface Certificate {
	id: number;
	logoUrl: string | null;
	recipientName: string;
	courseTitle: string;
	organizationName: string;
	score: number | null;
	code: string;
	issuedAt: string;
}

function CertificateSheet({ certificate }: { certificate: Certificate }) {
	const { t, language } = useI18n();
	return (
		<div className="flex flex-col items-center gap-2 rounded-card border-2 border-[#0066F5] bg-white p-8 text-center text-[#030711] sm:p-12">
			{certificate.logoUrl && (
				<img src={certificate.logoUrl} alt="" className="mb-2 size-14 rounded-md object-contain" />
			)}
			<p className="text-xs font-semibold tracking-[0.1em] text-[#0066F5]">{t("certificate.heading")}</p>
			<p className="mt-4 break-words text-3xl font-semibold">{certificate.recipientName}</p>
			<p className="text-[#666D7A]">{t("certificate.has_completed")}</p>
			<p className="break-words text-xl font-semibold">{certificate.courseTitle}</p>
			<p className="mt-4 break-words text-[13px] text-[#666D7A]">
				{certificate.organizationName} ·{" "}
				{new Date(certificate.issuedAt).toLocaleDateString(language, { dateStyle: "long" })}
			</p>
			<p className="text-[11px] text-[#666D7A]">{t("certificate.code", { code: certificate.code })}</p>
		</div>
	);
}

export function CertificatePage({ id }: { id: string }) {
	const { t } = useI18n();
	const certificate = useQuery({
		queryKey: ["certificate", id],
		queryFn: () => api<Certificate>(`/certificates/${id}`),
	});
	if (certificate.isPending) return <PageLoading />;
	if (certificate.isError) {
		return certificate.error instanceof ApiError && certificate.error.status === 404 ? (
			<StatePanel title={t("certificate.not_found")} action={<BackToCourses />} />
		) : (
			<PageError onRetry={() => certificate.refetch()} />
		);
	}
	return (
		<div className="mx-auto flex w-full max-w-[720px] flex-col gap-4 p-4 md:py-7">
			<h1 className="text-[22px] font-semibold">{t("certificate.title")}</h1>
			<CertificateSheet certificate={certificate.data} />
			<div className="flex flex-wrap items-center gap-2">
				<button type="button" className={buttonClass()} onClick={() => window.print()}>
					<Printer size={16} aria-hidden="true" />
					{t("certificate.print")}
				</button>
				<span className="text-[13px] text-muted-foreground">{t("certificate.print_hint")}</span>
			</div>
			{createPortal(
				<div className="print-only">
					<CertificateSheet certificate={certificate.data} />
				</div>,
				document.body,
			)}
		</div>
	);
}

export function MyCertificates() {
	const { t, language } = useI18n();
	const list = useQuery({
		queryKey: ["my-certificates"],
		queryFn: () =>
			api<{ certificates: { id: number; courseTitle: string; issuedAt: string; score: number | null }[] }>(
				"/me/certificates",
			),
		select: (data) => data.certificates,
	});
	return (
		<section className="rounded-card border border-border bg-card p-5">
			<h2 className="text-[15px] font-semibold">{t("certificate.list_title")}</h2>
			{list.isError && <p className="mt-2 text-[13px] text-danger-foreground">{t("error.generic")}</p>}
			{list.data?.length === 0 && <p className="mt-1 text-[13px] text-muted-foreground">{t("certificate.none")}</p>}
			<ul className="mt-2 flex flex-col gap-1.5">
				{list.data?.map((item) => (
					<li key={item.id}>
						<Link href={`/certificates/${item.id}`} className="flex items-center gap-2.5 rounded-md border border-border px-3 py-2.5 text-foreground no-underline hover:bg-muted">
							<Award size={16} aria-hidden="true" className="shrink-0 text-selected-foreground" />
							<span className="min-w-0 flex-1 break-words font-medium">{item.courseTitle}</span>
							<span className="shrink-0 text-xs text-muted-foreground">
								{new Date(item.issuedAt).toLocaleDateString(language, { dateStyle: "medium" })}
							</span>
						</Link>
					</li>
				))}
			</ul>
		</section>
	);
}
