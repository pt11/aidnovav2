import { lazy, Suspense, useEffect, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronLeft } from "lucide-react";
import { Link, useLocation } from "wouter";
import { api, ApiError } from "../api";
import { useI18n } from "../i18n";
import {
	Alert,
	buttonClass,
	ConfirmModal,
	Field,
	PageError,
	PageLoading,
} from "../ui";
import {
	courseKey,
	isVideoLink,
	lessonEditKey,
	Materials,
	type EditableLesson,
	type LessonValues,
} from "./CourseBuilder";

const RichEditor = lazy(() => import("../RichEditor"));

const SECTIONS = ["basics", "content", "materials", "completion", "settings"] as const;
type Section = (typeof SECTIONS)[number];

interface CourseContext {
	title: string;
	modules: { id: number; title: string }[];
}

export function LessonEditorPage({ id, lessonId }: { id: string; lessonId: string }) {
	const { t } = useI18n();
	const queryClient = useQueryClient();
	const [, navigate] = useLocation();
	const base = `/courses/${id}`;
	const builderUrl = `${base}/manage/lessons/${lessonId}`;
	const key = lessonEditKey(lessonId);
	const lesson = useQuery({
		queryKey: key,
		queryFn: () => api<EditableLesson>(`${base}/lessons/${lessonId}/edit`),
	});
	const course = useQuery({
		queryKey: courseKey(id),
		queryFn: () => api<CourseContext>(`${base}/manage`),
	});
	const [edits, setEdits] = useState<LessonValues | null>(null);
	const [status, setStatus] = useState({ uploading: 0, failed: 0 });
	const [active, setActive] = useState<Section>("basics");
	const [leaving, setLeaving] = useState(false);
	const [deleting, setDeleting] = useState(false);
	const scroller = useRef<HTMLDivElement>(null);
	// A short section near the end can't reach the top, so a jump keeps its highlight.
	const jumpUntil = useRef(0);
	const loaded = lesson.data !== undefined;

	useEffect(() => {
		if (!loaded || !scroller.current) return;
		const observer = new IntersectionObserver(
			(entries) => {
				const visible = entries.find((entry) => entry.isIntersecting);
				if (visible && Date.now() > jumpUntil.current) setActive(visible.target.id as Section);
			},
			{ root: scroller.current, rootMargin: "-15% 0px -75% 0px" },
		);
		for (const section of SECTIONS) {
			const element = document.getElementById(section);
			if (element) observer.observe(element);
		}
		return () => observer.disconnect();
	}, [loaded]);

	const refreshAll = () =>
		Promise.all([
			queryClient.invalidateQueries({ queryKey: key }),
			queryClient.invalidateQueries({ queryKey: courseKey(id) }),
		]);
	const save = useMutation({
		mutationFn: (body: LessonValues) => api(`${base}/lessons/${lessonId}`, { method: "PATCH", body }),
		onSuccess: async () => {
			await refreshAll();
			navigate(builderUrl);
		},
	});
	const remove = useMutation({
		mutationFn: () => api(`${base}/lessons/${lessonId}`, { method: "DELETE" }),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: courseKey(id) });
			navigate(`${base}/manage`);
		},
	});

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
	const moduleTitle = course.data?.modules.find((module) => module.id === data.moduleId)?.title;
	const saveCode = save.error instanceof ApiError ? save.error.code : "";
	const hasPdf = data.materials.some((material) => material.kind === "pdf");
	const requiredNames = data.materials
		.filter((material) => material.isRequired && !material.unavailable)
		.map((material) => material.name);
	const videoValid = isVideoLink(values.videoUrl);
	const sectionLabels: Record<Section, string> = {
		basics: t("course.section_basics"),
		content: t("course.lesson_content"),
		materials: t("course.materials"),
		completion: t("course.section_completion"),
		settings: t("course.section_settings"),
	};
	const types = [
		{ id: "reading", label: "course.type_reading", hint: "course.type_reading_hint" },
		{ id: "document", label: "course.type_document", hint: "course.type_document_hint" },
	] as const;
	const methods = [
		{ id: "mark", label: "course.method_mark", hint: "course.method_mark_hint" },
		{ id: "scroll", label: "course.method_scroll", hint: "course.method_scroll_hint" },
		{ id: "open", label: "course.method_open", hint: "course.method_open_hint" },
	] as const;
	const choiceClass = (selected: boolean) =>
		`flex cursor-pointer gap-2.5 rounded-[9px] px-3.5 py-3 ${selected ? "border-2 border-primary" : "border border-input"}`;

	function submit(event: FormEvent) {
		event.preventDefault();
		save.mutate(values);
	}

	return (
		<form onSubmit={submit} className="flex h-full min-h-0 flex-col bg-background">
			<header className="flex flex-wrap items-center gap-3 border-b border-border bg-card px-4 py-2.5 md:px-6">
				<button
					type="button"
					aria-label={t("course.back_to_course")}
					className="grid size-8 place-items-center rounded-md border border-border"
					onClick={() => (dirty ? setLeaving(true) : navigate(builderUrl))}
				>
					<ChevronLeft size={16} aria-hidden="true" />
				</button>
				<div className="min-w-0 flex-[1_1_240px]">
					<p className="truncate text-xs text-muted-foreground">
						{[course.data?.title, moduleTitle].filter(Boolean).join(" · ")}
					</p>
					<h1 className="text-base font-semibold">{t("course.edit_lesson")}</h1>
				</div>
				{dirty && (
					<span className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground">
						<span aria-hidden="true" className="size-2 rounded-full bg-[#753FF3]" />
						{t("common.unsaved")}
					</span>
				)}
				<Link href={`${base}/lessons/${lessonId}`} className={buttonClass("outline")}>
					{t("course.preview_staff")}
				</Link>
			</header>

			{/* Relative, so hidden screen-reader labels can't make the page behind it scroll. */}
			<div ref={scroller} className="relative min-h-0 flex-1 overflow-auto">
				<div className="mx-auto flex w-full max-w-[1180px] flex-wrap items-start gap-6 p-4 md:p-6">
					<nav
						aria-label={t("course.lesson_sections")}
						className="sticky top-6 hidden w-[200px] shrink-0 flex-col gap-0.5 md:flex"
					>
						{SECTIONS.map((section, index) => (
							<a
								key={section}
								href={`#${section}`}
								onClick={(event) => {
									event.preventDefault();
									jumpUntil.current = Date.now() + 1000;
									setActive(section);
									document.getElementById(section)?.scrollIntoView({ block: "start" });
								}}
								aria-current={active === section ? "true" : undefined}
								className={`flex items-center justify-between rounded-md border px-3 py-2 text-foreground no-underline ${
									active === section ? "border-border bg-card font-semibold" : "border-transparent hover:bg-muted"
								}`}
							>
								{index + 1} · {sectionLabels[section]}
								{section === "materials" && status.failed > 0 && (
									<span className="rounded-full bg-[#DC2828] px-[7px] text-[11px] font-semibold text-white">
										{status.failed}
									</span>
								)}
							</a>
						))}
					</nav>

					<div className="flex min-w-0 flex-[999_1_560px] flex-col gap-4">
						{save.isError && (
							<Alert>{t(saveCode === "INVALID_VIDEO" ? "course.video_invalid" : "error.generic")}</Alert>
						)}
						<section id="basics" className="flex scroll-mt-6 flex-col gap-3.5 rounded-card border border-border bg-card p-5">
							<h2 className="text-base font-semibold">{sectionLabels.basics}</h2>
							<Field
								label={t("course.lesson_title")}
								required
								maxLength={200}
								value={values.title}
								onChange={(event) => set("title", event.target.value)}
							/>
							<fieldset>
								<legend className="pb-2 text-sm font-medium">{t("course.lesson_type")}</legend>
								<div className="grid gap-2.5 sm:grid-cols-2">
									{types.map((type) => (
										<label key={type.id} className={choiceClass(values.lessonType === type.id)}>
											<input
												type="radio"
												name="lesson-type"
												className="mt-1 accent-primary"
												checked={values.lessonType === type.id}
												onChange={() => set("lessonType", type.id)}
											/>
											<span>
												<span className="block font-semibold">{t(type.label)}</span>
												<span className="block text-[13px] text-muted-foreground">{t(type.hint)}</span>
											</span>
										</label>
									))}
								</div>
							</fieldset>
						</section>

						<section id="content" className="flex scroll-mt-6 flex-col gap-3 rounded-card border border-border bg-card p-5">
							<h2 className="text-base font-semibold">{sectionLabels.content}</h2>
							<Suspense fallback={<PageLoading />}>
								<RichEditor
									label={sectionLabels.content}
									initial={data.content ?? ""}
									onChange={(value) => set("content", value)}
								/>
							</Suspense>
							{values.lessonType === "reading" ? (
								<div className="flex flex-col gap-1.5">
									<label htmlFor="lesson-video" className="text-sm font-medium">
										{t("course.video")}{" "}
										<span className="font-normal text-muted-foreground">{t("course.video_hint")}</span>
									</label>
									<span className="flex items-center gap-2">
										<input
											id="lesson-video"
											type="url"
											maxLength={2000}
											placeholder="https://youtu.be/…"
											value={values.videoUrl}
											onChange={(event) => set("videoUrl", event.target.value)}
											className="min-h-10 min-w-0 flex-1 rounded-md border border-input bg-card px-3 py-2"
										/>
										{videoValid && (
											<span className="inline-flex shrink-0 items-center gap-1.5 text-[13px] font-medium">
												<Check size={15} aria-hidden="true" className="text-[#14795A]" />
												{t("course.valid_link")}
											</span>
										)}
									</span>
								</div>
							) : (
								!hasPdf && <p className="rounded-md bg-background px-3 py-2.5 text-[13px]">{t("course.document_needs_pdf")}</p>
							)}
						</section>

						<section id="materials" className="scroll-mt-6">
							<Materials
								courseId={Number(id)}
								lesson={data}
								onChange={refreshAll}
								onStatus={setStatus}
							/>
						</section>

						<section id="completion" className="flex scroll-mt-6 flex-col gap-3 rounded-card border border-border bg-card p-5">
							<h2 className="text-base font-semibold">{t("course.how_complete")}</h2>
							<fieldset className="grid grid-cols-[repeat(auto-fit,minmax(min(220px,100%),1fr))] gap-2.5">
								<legend className="sr-only">{t("course.completion_method")}</legend>
								{methods.map((method) => (
									<label key={method.id} className={choiceClass(values.completionMethod === method.id)}>
										<input
											type="radio"
											name="completion"
											className="mt-1 accent-primary"
											checked={values.completionMethod === method.id}
											onChange={() => set("completionMethod", method.id)}
										/>
										<span>
											<span className="block font-semibold">{t(method.label)}</span>
											<span className="block text-[13px] text-muted-foreground">{t(method.hint)}</span>
										</span>
									</label>
								))}
							</fieldset>
							{requiredNames.length > 0 && (
								<p className="break-words rounded-md bg-background px-3 py-2.5 text-[13px]">
									{t("course.required_always_named", { names: requiredNames.join(", ") })}
								</p>
							)}
						</section>

						<section id="settings" className="grid scroll-mt-6 grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))] items-end gap-4 rounded-card border border-border bg-card p-5">
							<h2 className="col-span-full text-base font-semibold">{sectionLabels.settings}</h2>
							<div className="flex flex-col gap-1.5">
								<span className="text-sm font-medium">{t("course.who_can_see")}</span>
								<span className="flex min-h-10 items-center rounded-md border border-input bg-background px-3 text-muted-foreground">
									{t("course.everyone_enrolled")}
								</span>
							</div>
							<Field
								label={t("course.estimated_time")}
								maxLength={50}
								placeholder={t("course.estimated_placeholder")}
								value={values.estimatedTime}
								onChange={(event) => set("estimatedTime", event.target.value)}
							/>
							<label className="flex min-h-10 items-center gap-2.5 text-sm font-medium">
								<input
									type="checkbox"
									className="size-[18px] accent-primary"
									checked={values.isRequired}
									onChange={(event) => set("isRequired", event.target.checked)}
								/>
								{t("course.lesson_required")}
							</label>
							<button
								type="button"
								className="col-span-full justify-self-start text-[13px] font-medium text-danger-foreground hover:underline"
								onClick={() => setDeleting(true)}
							>
								{t("course.delete_lesson")}…
							</button>
						</section>
					</div>
				</div>
			</div>

			<footer className="flex flex-wrap items-center justify-end gap-2 border-t border-border bg-card px-4 py-3 md:px-6">
				{status.uploading > 0 && (
					<span className="mr-auto text-[13px] text-muted-foreground">{t("course.wait_uploads")}</span>
				)}
				<button
					type="button"
					className={buttonClass("outline")}
					onClick={() => (dirty ? setLeaving(true) : navigate(builderUrl))}
				>
					{t("common.cancel")}
				</button>
				<button
					type="submit"
					disabled={save.isPending || status.uploading > 0 || !values.title.trim()}
					className={buttonClass()}
				>
					{t("course.save_lesson")}
				</button>
			</footer>

			<ConfirmModal
				title={t("course.discard_title")}
				description={t("course.discard_desc")}
				confirmLabel={t("common.discard")}
				open={leaving}
				pending={false}
				failed={false}
				onConfirm={() => navigate(builderUrl)}
				onClose={() => setLeaving(false)}
			/>
			<ConfirmModal
				title={t("course.delete_lesson_title", { title: data.title })}
				description={t("course.delete_lesson_desc")}
				confirmLabel={t("common.delete")}
				open={deleting}
				pending={remove.isPending}
				failed={remove.isError}
				onConfirm={() => remove.mutate()}
				onClose={() => setDeleting(false)}
			/>
		</form>
	);
}
