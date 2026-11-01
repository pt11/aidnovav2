import { useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GraduationCap, ImageIcon, LayoutGrid, List, Plus, Search } from "lucide-react";
import { Link, useLocation } from "wouter";
import { api, ApiError } from "../api";
import { useI18n } from "../i18n";
import {
	Chip,
	SearchField,
	Alert,
	buttonClass,
	Field,
	Modal,
	PageError,
	PageHeader,
	PageLoading,
	Segmented,
	StatePanel,
	TextareaField,
} from "../ui";

interface CourseSummary {
	id: number;
	title: string;
	description: string | null;
	duration: string | null;
	status: "draft" | "published";
	isMandatory: boolean;
	hasCover: boolean;
	updatedAt: string;
	modules: number;
	lessons: number;
	questions: number;
}

interface ManagedCourse extends CourseSummary {
	enrolled: number;
	completed: number;
	publishProblem: string | null;
}

interface LearningCourse extends CourseSummary {
	completed: boolean;
	started: boolean;
	percent: number;
}

export const COURSES_KEY = ["courses"];
const MAX_COVER_BYTES = 2 * 1024 * 1024;

export function coverUrl(courseId: number, version: string) {
	return `/api/courses/${courseId}/cover?v=${encodeURIComponent(version)}`;
}

export async function uploadCover(courseId: number, file: File) {
	const response = await fetch(
		`/api/courses/${courseId}/cover?name=${encodeURIComponent(file.name)}`,
		{ method: "POST", body: file },
	);
	if (!response.ok) throw new ApiError(response.status, "COVER_FAILED", "Upload failed");
}

function ProgressBar({ percent, label }: { percent: number; label: string }) {
	return (
		<div
			role="progressbar"
			aria-valuenow={percent}
			aria-valuemin={0}
			aria-valuemax={100}
			aria-label={label}
			className="mt-1 h-1.5 overflow-hidden rounded-full bg-input"
		>
			<div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
		</div>
	);
}

function Cover({ course }: { course: CourseSummary }) {
	const { t } = useI18n();
	return (
		<div className="relative flex h-[120px] items-end gap-1.5 border-b border-border bg-muted p-3">
			{course.hasCover && (
				<img
					src={coverUrl(course.id, course.updatedAt)}
					alt=""
					loading="lazy"
					className="absolute inset-0 size-full object-cover"
				/>
			)}
			<span className="relative flex flex-wrap gap-1.5">
				<Chip tone={course.status === "published" ? "primary" : "outline"}>{t(course.status === "published" ? "policies.published" : "policies.draft")}</Chip>
				{course.isMandatory && <Chip tone="neutral">{t("course.mandatory_chip")}</Chip>}
			</span>
		</div>
	);
}

function courseShape(course: CourseSummary, t: ReturnType<typeof useI18n>["t"]) {
	return [
		t(course.modules === 1 ? "course.one_module" : "course.count_modules", { count: course.modules }),
		t(course.lessons === 1 ? "course.one_lesson" : "course.count_lessons", { count: course.lessons }),
		course.questions > 0 ? t("course.has_quiz") : null,
		course.duration,
	]
		.filter(Boolean)
		.join(" · ");
}

function ManageCard({ course }: { course: ManagedCourse }) {
	const { t } = useI18n();
	const percent = course.enrolled ? Math.round((course.completed / course.enrolled) * 100) : 0;
	return (
		<Link
			href={`/courses/${course.id}/manage`}
			className="flex flex-col overflow-hidden rounded-card border border-border bg-card text-foreground no-underline hover:border-input"
		>
			<Cover course={course} />
			<div className="flex flex-1 flex-col gap-2.5 px-4 py-3.5">
				<div>
					<p className="break-words text-[15px] font-semibold">{course.title}</p>
					<p className="text-[13px] text-muted-foreground">{courseShape(course, t)}</p>
				</div>
				{course.status === "published" ? (
					<div>
						<p className="flex justify-between text-xs text-muted-foreground">
							<span>
								{t("course.completed_of", { done: course.completed, total: course.enrolled })}
							</span>
							<span className="font-semibold text-foreground">{percent}%</span>
						</p>
						<ProgressBar percent={percent} label={course.title} />
					</div>
				) : (
					<p className="rounded-md bg-background px-2.5 py-2 text-xs">
						{course.publishProblem ? t("course.publish_needs_content") : t("course.ready_to_publish")}
					</p>
				)}
				<span className="mt-auto text-[13px] font-semibold text-selected-foreground">
					{t(course.status === "published" ? "course.manage" : "course.continue_editing")} →
				</span>
			</div>
		</Link>
	);
}

function CourseRow({
	href,
	course,
	progress,
	status,
}: {
	href: string;
	course: CourseSummary;
	progress: string;
	status: string;
}) {
	const { t } = useI18n();
	return (
		<li className="border-t border-border first:border-t-0">
			<Link href={href} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-foreground no-underline hover:bg-muted/40">
				<span className="min-w-0 flex-[1_1_260px]">
					<span className="block break-words font-semibold">{course.title}</span>
					<span className="block text-[13px] text-muted-foreground">{courseShape(course, t)}</span>
				</span>
				<span className="flex shrink-0 flex-wrap gap-1.5">
					<Chip tone={course.status === "published" ? "primary" : "outline"}>{status}</Chip>
					{course.isMandatory && <Chip tone="neutral">{t("course.mandatory_chip")}</Chip>}
				</span>
				<span className="w-36 shrink-0 text-[13px] text-muted-foreground">{progress}</span>
			</Link>
		</li>
	);
}

function LearningCard({ course }: { course: LearningCourse }) {
	const { t } = useI18n();
	return (
		<Link
			href={`/courses/${course.id}`}
			className="flex flex-col overflow-hidden rounded-card border border-border bg-card text-foreground no-underline hover:border-input"
		>
			<div className="relative flex h-[120px] items-end gap-1.5 border-b border-border bg-muted p-3">
				{course.hasCover && (
					<img
						src={coverUrl(course.id, course.updatedAt)}
						alt=""
						loading="lazy"
						className="absolute inset-0 size-full object-cover"
					/>
				)}
				{course.isMandatory && (
					<span className="relative">
						<Chip tone="neutral">{t("course.mandatory_chip")}</Chip>
					</span>
				)}
			</div>
			<div className="flex flex-1 flex-col gap-2.5 px-4 py-3.5">
				<div>
					<p className="break-words text-[15px] font-semibold">{course.title}</p>
					<p className="text-[13px] text-muted-foreground">{courseShape(course, t)}</p>
				</div>
				<div>
					<p className="flex justify-between text-xs text-muted-foreground">
						<span>{course.completed ? t("course.status_completed") : t("course.your_progress")}</span>
						<span className="font-semibold text-foreground">{course.percent}%</span>
					</p>
					<ProgressBar percent={course.percent} label={course.title} />
				</div>
				<span className="mt-auto text-[13px] font-semibold text-selected-foreground">
					{t(
						course.completed
							? "course.review"
							: course.started
								? "course.continue"
								: "course.start",
					)}{" "}
					→
				</span>
			</div>
		</Link>
	);
}

export function CoverPicker({
	file,
	error,
	onChoose,
}: {
	file: File | null;
	error: string;
	onChoose: (file: File | null, error: string) => void;
}) {
	const { t } = useI18n();
	const input = useRef<HTMLInputElement>(null);

	function choose(chosen: File | undefined) {
		if (!chosen) return;
		if (!/\.(jpe?g|png|webp)$/i.test(chosen.name)) {
			onChoose(null, t("course.cover_type"));
		} else if (chosen.size > MAX_COVER_BYTES) {
			onChoose(
				null,
				t("course.cover_too_big", {
					name: chosen.name,
					size: (chosen.size / 1024 / 1024).toFixed(1),
				}),
			);
		} else {
			onChoose(chosen, "");
		}
	}

	return (
		<div className="flex flex-col gap-1.5">
			<span className="text-sm font-medium">
				{t("course.cover")} <span className="font-normal text-muted-foreground">· {t("course.optional")}</span>
			</span>
			<button
				type="button"
				onClick={() => input.current?.click()}
				onDragOver={(event) => event.preventDefault()}
				onDrop={(event) => {
					event.preventDefault();
					choose(event.dataTransfer.files[0]);
				}}
				className={`flex items-center gap-3.5 rounded-[9px] border-2 border-dashed p-4 text-left ${
					error ? "border-destructive" : "border-input"
				}`}
			>
				<span className="grid size-12 shrink-0 place-items-center rounded-[9px] bg-muted">
					<ImageIcon size={22} aria-hidden="true" className="text-muted-foreground" />
				</span>
				<span className="min-w-0">
					<span className="block break-words font-medium">
						{file ? file.name : t("course.cover_drop")}
					</span>
					<span className="block text-xs text-muted-foreground">{t("course.cover_hint")}</span>
				</span>
			</button>
			<input
				ref={input}
				type="file"
				hidden
				aria-label={t("course.cover")}
				accept=".jpg,.jpeg,.png,.webp"
				onChange={(event) => {
					choose(event.target.files?.[0]);
					event.target.value = "";
				}}
			/>
			{error && (
				<p role="alert" className="text-[13px] text-danger-foreground">
					{error}
				</p>
			)}
		</div>
	);
}

function NewCourseDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
	const { t } = useI18n();
	const queryClient = useQueryClient();
	const [, navigate] = useLocation();
	const [values, setValues] = useState({
		title: "",
		description: "",
		objectives: "",
		duration: "",
		isMandatory: false,
	});
	const [cover, setCover] = useState<File | null>(null);
	const [coverError, setCoverError] = useState("");
	const [titleError, setTitleError] = useState(false);
	const create = useMutation({
		mutationFn: async () => {
			const created = await api<{ id: number }>("/courses", { method: "POST", body: values });
			if (cover) await uploadCover(created.id, cover).catch(() => undefined);
			return created;
		},
		onSuccess: async (created) => {
			await queryClient.invalidateQueries({ queryKey: COURSES_KEY });
			navigate(`/courses/${created.id}/manage`);
		},
	});

	function submit(event: FormEvent) {
		event.preventDefault();
		if (!values.title.trim()) {
			setTitleError(true);
			return;
		}
		create.mutate();
	}

	return (
		<Modal title={t("course.new")} description={t("course.new_desc")} open={open} wide onClose={onClose}>
			<form onSubmit={submit} className="flex flex-col gap-4" noValidate>
				{create.isError && <Alert>{t("error.generic")}</Alert>}
				<CoverPicker
					file={cover}
					error={coverError}
					onChoose={(file, error) => {
						setCover(file);
						setCoverError(error);
					}}
				/>
				<Field
					label={t("course.title")}
					maxLength={200}
					placeholder={t("course.title_placeholder")}
					error={titleError ? t("course.title_required") : undefined}
					value={values.title}
					onChange={(event) => {
						setTitleError(false);
						setValues({ ...values, title: event.target.value });
					}}
				/>
				<TextareaField
					label={t("course.description")}
					rows={3}
					maxLength={2000}
					placeholder={t("course.description_placeholder")}
					value={values.description}
					onChange={(event) => setValues({ ...values, description: event.target.value })}
				/>
				<TextareaField
					label={t("course.objectives")}
					rows={2}
					maxLength={2000}
					placeholder={t("course.objectives_placeholder")}
					value={values.objectives}
					onChange={(event) => setValues({ ...values, objectives: event.target.value })}
				/>
				<Field
					label={t("course.duration")}
					maxLength={50}
					placeholder={t("course.duration_placeholder")}
					value={values.duration}
					onChange={(event) => setValues({ ...values, duration: event.target.value })}
				/>
				<label className="flex items-start gap-3 rounded-[9px] border border-border px-3.5 py-3">
					<input
						type="checkbox"
						className="mt-0.5 size-4 accent-primary"
						checked={values.isMandatory}
						onChange={(event) => setValues({ ...values, isMandatory: event.target.checked })}
					/>
					<span>
						<span className="block font-medium">{t("course.mandatory")}</span>
						<span className="block text-[13px] text-muted-foreground">{t("course.mandatory_desc")}</span>
					</span>
				</label>
				<div className="flex justify-end gap-2 border-t border-border pt-3.5">
					<button type="button" className={buttonClass("outline")} onClick={onClose}>
						{t("common.cancel")}
					</button>
					<button type="submit" disabled={create.isPending} className={buttonClass()}>
						{t("course.create")}
					</button>
				</div>
			</form>
		</Modal>
	);
}

type ManageFilter = "all" | "published" | "draft" | "mandatory";

export function CoursesPage({ canManage }: { canManage: boolean }) {
	const { t } = useI18n();
	const courses = useQuery({
		queryKey: COURSES_KEY,
		queryFn: () =>
			api<{ learning: LearningCourse[]; manage: ManagedCourse[] | null }>("/courses"),
	});
	const [tab, setTab] = useState<"manage" | "learning">("manage");
	const [filter, setFilter] = useState<ManageFilter>("all");
	const [search, setSearch] = useState("");
	const [creating, setCreating] = useState(false);
	const [view, setView] = useState<"cards" | "rows">("cards");

	const managed = courses.data?.manage ?? [];
	const learning = courses.data?.learning ?? [];
	const text = search.trim().toLowerCase();
	const matches = (course: CourseSummary) => !text || course.title.toLowerCase().includes(text);
	const showManage = canManage && tab === "manage";
	const inFilter = (course: ManagedCourse) =>
		filter === "all" ||
		(filter === "mandatory" ? course.isMandatory : course.status === filter);
	const visibleManaged = managed.filter((course) => inFilter(course) && matches(course));
	const visibleLearning = learning.filter(matches);
	const published = managed.filter((course) => course.status === "published").length;
	const filters: { id: ManageFilter; label: string; total: number }[] = [
		{ id: "all", label: t("course.all"), total: managed.length },
		{ id: "published", label: t("policies.published"), total: published },
		{ id: "draft", label: t("course.drafts"), total: managed.length - published },
		{
			id: "mandatory",
			label: t("course.mandatory_chip"),
			total: managed.filter((course) => course.isMandatory).length,
		},
	];
	const clear = () => {
		setSearch("");
		setFilter("all");
	};

	return (
		<div className="flex flex-col gap-4 p-4 md:px-6 md:py-7">
			<PageHeader
				title={t("nav.courses")}
				subtitle={
					canManage
						? t("course.summary", {
								published,
								drafts: managed.length - published,
									enrolled: managed.reduce((total, course) => total + course.enrolled, 0),
								})
						: t("course.staff_subtitle")
				}
				action={
					canManage ? (
						<button type="button" className={buttonClass()} onClick={() => setCreating(true)}>
							<Plus size={16} aria-hidden="true" />
							{t("course.new")}
						</button>
					) : undefined
				}
			/>
			{courses.isPending && <PageLoading variant="inline" />}
			{courses.isError && <PageError onRetry={() => courses.refetch()} />}
			{courses.data && (
				<>
					<div className="flex flex-wrap items-center gap-2.5">
						{canManage && (
							<Segmented
								label={t("nav.courses")}
								options={[
									{ value: "manage", label: t("course.tab_manage") },
									{ value: "learning", label: `${t("course.tab_learning")} · ${learning.length}` },
								]}
								value={tab}
								onChange={setTab}
							/>
						)}
						{showManage && (
							<Segmented
								label={t("course.filter")}
								options={filters.map((item) => ({ value: item.id, label: `${item.label} · ${item.total}` }))}
								value={filter}
								onChange={setFilter}
							/>
						)}
						<SearchField label={t("course.search")} value={search} onChange={setSearch} className="min-w-52 flex-1" />
						<div role="group" aria-label={t("course.view")} className="inline-flex rounded-md border border-border bg-muted p-[3px]">
							{(
								[
									["cards", LayoutGrid, "course.view_cards"],
									["rows", List, "course.view_rows"],
								] as const
							).map(([value, Icon, key]) => (
								<button
									key={value}
									type="button"
									aria-pressed={view === value}
									aria-label={t(key)}
									title={t(key)}
									onClick={() => setView(value)}
									className={`grid size-8 place-items-center rounded ${
										view === value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
									}`}
								>
									<Icon size={16} aria-hidden="true" />
								</button>
							))}
						</div>
					</div>
					{showManage && managed.length === 0 && (
						<StatePanel
							icon={GraduationCap}
							title={t("course.empty_title")}
							description={t("course.empty_desc")}
							action={
								<button type="button" className={buttonClass()} onClick={() => setCreating(true)}>
									{t("course.create_first")}
								</button>
							}
						/>
					)}
					{!showManage && learning.length === 0 && (
						<StatePanel
							icon={GraduationCap}
							title={t("course.none_assigned")}
							description={t("course.none_assigned_desc")}
						/>
					)}
					{((showManage && managed.length > 0 && visibleManaged.length === 0) ||
						(!showManage && learning.length > 0 && visibleLearning.length === 0)) && (
						<StatePanel
							icon={Search}
							title={t("course.no_results")}
							description={t("course.no_results_desc")}
							action={
								<button type="button" className={buttonClass("outline")} onClick={clear}>
									{t("course.clear_filters")}
								</button>
							}
						/>
					)}
					{view === "cards" ? (
						<div className="grid grid-cols-[repeat(auto-fill,minmax(min(280px,100%),1fr))] gap-4">
							{showManage
								? visibleManaged.map((course) => <ManageCard key={course.id} course={course} />)
								: visibleLearning.map((course) => <LearningCard key={course.id} course={course} />)}
						</div>
					) : (
						(showManage ? visibleManaged : visibleLearning).length > 0 && (
							<ul className="rounded-card border border-border bg-card">
								{showManage
									? visibleManaged.map((course) => (
											<CourseRow
												key={course.id}
												href={`/courses/${course.id}/manage`}
												course={course}
												status={t(course.status === "published" ? "policies.published" : "policies.draft")}
												progress={t("course.completed_of", { done: course.completed, total: course.enrolled })}
											/>
										))
									: visibleLearning.map((course) => (
											<CourseRow
												key={course.id}
												href={`/courses/${course.id}`}
												course={course}
												status={t("policies.published")}
												progress={`${course.percent}%`}
											/>
										))}
							</ul>
						)
					)}
				</>
			)}
			{creating && <NewCourseDialog open onClose={() => setCreating(false)} />}
		</div>
	);
}
