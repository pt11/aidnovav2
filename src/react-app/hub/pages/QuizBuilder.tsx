import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronLeft, ChevronUp, Plus, X } from "lucide-react";
import { Link } from "wouter";
import { api } from "../api";
import { useI18n } from "../i18n";
import {
	Alert,
	buttonClass,
	ConfirmModal,
	Field,
	PageError,
	PageLoading,
	TextareaField,
} from "../ui";
import { courseKey } from "./CourseBuilder";

type QuestionType = "single" | "multiple" | "truefalse";

interface Option {
	text: string;
	correct: boolean;
}

interface Question {
	id: number;
	question: string;
	type: QuestionType;
	options: Option[];
}

interface QuizData {
	courseTitle: string;
	quizTitle: string | null;
	passingScore: number;
	questions: Question[];
}

function QuestionEditor({
	courseId,
	question,
	onDone,
}: {
	courseId: string;
	question: Question | null;
	onDone: () => void;
}) {
	const { t } = useI18n();
	const queryClient = useQueryClient();
	const trueFalse = (): Option[] => [
		{ text: t("quiz.true"), correct: true },
		{ text: t("quiz.false"), correct: false },
	];
	const [text, setText] = useState(question?.question ?? "");
	const [type, setType] = useState<QuestionType>(question?.type ?? "single");
	const [options, setOptions] = useState<Option[]>(
		question?.options ?? [
			{ text: "", correct: true },
			{ text: "", correct: false },
		],
	);
	const [deleting, setDeleting] = useState(false);
	const [problem, setProblem] = useState("");
	const refresh = async () => {
		await queryClient.invalidateQueries({ queryKey: ["quiz-edit", courseId] });
		await queryClient.invalidateQueries({ queryKey: courseKey(courseId) });
	};
	const save = useMutation({
		mutationFn: () =>
			api(
				question
					? `/courses/${courseId}/quiz/questions/${question.id}`
					: `/courses/${courseId}/quiz/questions`,
				{
					method: question ? "PATCH" : "POST",
					body: { question: text, type, options },
				},
			),
		onSuccess: async () => {
			await refresh();
			onDone();
		},
	});
	const remove = useMutation({
		mutationFn: () =>
			api(`/courses/${courseId}/quiz/questions/${question?.id}`, { method: "DELETE" }),
		onSuccess: async () => {
			await refresh();
			onDone();
		},
	});

	function changeType(next: QuestionType) {
		setProblem("");
		setType(next);
		if (next === "truefalse") {
			setOptions(trueFalse());
		} else if (type === "truefalse") {
			setOptions([
				{ text: "", correct: true },
				{ text: "", correct: false },
			]);
		} else if (next === "single") {
			const first = options.findIndex((option) => option.correct);
			setOptions(options.map((option, index) => ({ ...option, correct: index === Math.max(first, 0) })));
		}
	}

	function markCorrect(index: number, checked: boolean) {
		setProblem("");
		setOptions((current) =>
			current.map((option, position) =>
				type === "multiple"
					? position === index
						? { ...option, correct: checked }
						: option
					: { ...option, correct: position === index },
			),
		);
	}

	function submit(event: FormEvent) {
		event.preventDefault();
		const empty = options.findIndex((option) => !option.text.trim());
		if (empty !== -1) {
			setProblem(t("quiz.answer_empty", { number: empty + 1 }));
		} else if (!options.some((option) => option.correct)) {
			setProblem(t("quiz.choose_correct"));
		} else {
			setProblem("");
			save.mutate();
		}
	}

	const types: { id: QuestionType; label: string }[] = [
		{ id: "single", label: t("quiz.type_single") },
		{ id: "multiple", label: t("quiz.type_multiple") },
		{ id: "truefalse", label: t("quiz.type_truefalse") },
	];

	return (
		<form onSubmit={submit} className="flex flex-col gap-3.5 rounded-card border border-border bg-card p-5">
			{save.isError && <Alert>{t("error.generic")}</Alert>}
			<TextareaField
				label={t("quiz.question")}
				rows={2}
				required
				maxLength={1000}
				value={text}
				onChange={(event) => setText(event.target.value)}
			/>
			<fieldset className="flex flex-wrap gap-x-4 gap-y-1.5">
				<legend className="mb-1.5 text-sm font-medium">{t("quiz.answer_type")}</legend>
				{types.map((item) => (
					<label key={item.id} className="flex items-center gap-2 text-[13px]">
						<input
							type="radio"
							name="question-type"
							className="accent-primary"
							checked={type === item.id}
							onChange={() => changeType(item.id)}
						/>
						{item.label}
					</label>
				))}
			</fieldset>
			<fieldset className="flex flex-col gap-2">
				<legend className="mb-1.5 text-sm font-medium">
					{t(type === "multiple" ? "quiz.answers_multiple" : "quiz.answers_single")}
				</legend>
				{options.map((option, index) => (
					<div key={index} className="flex items-center gap-2">
						<input
							type={type === "multiple" ? "checkbox" : "radio"}
							name="correct-answer"
							aria-label={t("quiz.mark_correct", { number: index + 1 })}
							className="size-4 shrink-0 accent-primary"
							checked={option.correct}
							onChange={(event) => markCorrect(index, event.target.checked)}
						/>
						<input
							type="text"
							aria-label={t("quiz.answer_number", { number: index + 1 })}
							placeholder={t("quiz.answer_number", { number: index + 1 })}
							maxLength={500}
							readOnly={type === "truefalse"}
							value={option.text}
							onChange={(event) => {
								setProblem("");
								setOptions((current) =>
									current.map((item, position) =>
										position === index ? { ...item, text: event.target.value } : item,
									),
								);
							}}
							className="min-h-10 min-w-0 flex-1 rounded-md border border-input bg-card px-3"
						/>
						{type !== "truefalse" && options.length > 2 && (
							<button
								type="button"
								aria-label={t("quiz.remove_answer", { number: index + 1 })}
								className="grid size-8 shrink-0 place-items-center rounded text-muted-foreground hover:bg-muted"
								onClick={() =>
									setOptions((current) => {
										const next = current.filter((_, position) => position !== index);
										return next.some((item) => item.correct) || type === "multiple"
											? next
											: next.map((item, position) => ({ ...item, correct: position === 0 }));
									})
								}
							>
								<X size={15} aria-hidden="true" />
							</button>
						)}
					</div>
				))}
				{problem && <p role="alert" className="text-[13px] text-danger-foreground">{problem}</p>}
				{type !== "truefalse" && options.length < 10 && (
					<button
						type="button"
						className="flex items-center gap-1.5 self-start text-[13px] font-medium text-selected-foreground hover:underline"
						onClick={() => setOptions((current) => [...current, { text: "", correct: false }])}
					>
						<Plus size={14} aria-hidden="true" />
						{t("quiz.add_answer")}
					</button>
				)}
			</fieldset>
			<div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-3">
				{question && (
					<button
						type="button"
						className="mr-auto min-h-10 rounded-md px-3 text-[13px] font-medium text-danger-foreground hover:bg-danger-surface"
						onClick={() => setDeleting(true)}
					>
						{t("quiz.delete_question")}
					</button>
				)}
				<button type="button" className={buttonClass("outline")} onClick={onDone}>
					{t("common.cancel")}
				</button>
				<button type="submit" disabled={save.isPending || !text.trim()} className={buttonClass()}>
					{t("quiz.save_question")}
				</button>
			</div>
			<ConfirmModal
				title={t("quiz.delete_question")}
				description={t("quiz.delete_question_desc")}
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

function QuizSettings({ courseId, data }: { courseId: string; data: QuizData }) {
	const { t } = useI18n();
	const queryClient = useQueryClient();
	const [title, setTitle] = useState(data.quizTitle ?? "");
	const [score, setScore] = useState(String(data.passingScore));
	const save = useMutation({
		mutationFn: () =>
			api(`/courses/${courseId}`, {
				method: "PATCH",
				body: { quizTitle: title, passingScore: Number(score) },
			}),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: ["quiz-edit", courseId] });
			await queryClient.invalidateQueries({ queryKey: courseKey(courseId) });
		},
	});
	const total = data.questions.length;
	const needed = Math.ceil((Number(score) * total) / 100);
	return (
		<form
			className="flex flex-col gap-3 rounded-card border border-border bg-card p-4"
			onSubmit={(event) => {
				event.preventDefault();
				save.mutate();
			}}
		>
			<h2 className="text-[15px] font-semibold">{t("quiz.settings")}</h2>
			{save.isError && <Alert>{t("error.generic")}</Alert>}
			<Field
				label={t("quiz.title")}
				maxLength={200}
				placeholder={t("course.final_quiz")}
				value={title}
				onChange={(event) => {
					save.reset();
					setTitle(event.target.value);
				}}
			/>
			<Field
				label={t("course.passing_score")}
				type="number"
				min={1}
				max={100}
				required
				hint={total > 0 ? t("quiz.pass_hint", { needed, total }) : undefined}
				value={score}
				onChange={(event) => {
					save.reset();
					setScore(event.target.value);
				}}
			/>
			<p className="text-xs leading-5 text-muted-foreground">{t("quiz.rules")}</p>
			<div className="flex items-center gap-3">
				<button type="submit" disabled={save.isPending} className={buttonClass("outline", "min-h-9 py-0")}>
					{t("common.save")}
				</button>
				{save.isSuccess && <span role="status" className="text-[13px] text-muted-foreground">{t("common.saved")}</span>}
			</div>
		</form>
	);
}

export function QuizBuilderPage({ id }: { id: string }) {
	const { t } = useI18n();
	const queryClient = useQueryClient();
	const quiz = useQuery({
		queryKey: ["quiz-edit", id],
		queryFn: () => api<QuizData>(`/courses/${id}/quiz/edit`),
	});
	const [editing, setEditing] = useState<number | "new" | null>(null);
	const reorder = useMutation({
		mutationFn: (ids: number[]) => api(`/courses/${id}/quiz/reorder`, { method: "POST", body: { ids } }),
		onSettled: () => queryClient.invalidateQueries({ queryKey: ["quiz-edit", id] }),
	});
	if (quiz.isPending) return <PageLoading />;
	if (quiz.isError) return <PageError onRetry={() => quiz.refetch()} />;
	const data = quiz.data;
	const move = (index: number, change: number) => {
		const ids = data.questions.map((question) => question.id);
		const [moved] = ids.splice(index, 1);
		ids.splice(index + change, 0, moved);
		reorder.mutate(ids);
	};
	const current = data.questions.find((question) => question.id === editing) ?? null;
	return (
		<div className="flex flex-col gap-4 p-4 md:px-6 md:py-7">
			<div className="flex items-center gap-3">
				<Link href={`/courses/${id}/manage`} aria-label={t("course.back_to_course")} className="grid size-8 shrink-0 place-items-center rounded-md border border-border text-foreground">
					<ChevronLeft size={16} aria-hidden="true" />
				</Link>
				<div className="min-w-0">
					<p className="break-words text-xs text-muted-foreground">{data.courseTitle}</p>
					<h1 className="text-[22px] font-semibold">{t("course.final_quiz")}</h1>
				</div>
			</div>
			<div className="flex flex-wrap items-start gap-4">
				<div className="flex min-w-0 flex-[1_1_280px] flex-col gap-4 lg:max-w-[360px]">
					<QuizSettings key={`${data.quizTitle}-${data.passingScore}`} courseId={id} data={data} />
					<section className="rounded-card border border-border bg-card p-4">
						<h2 className="text-[15px] font-semibold">
							{t("quiz.questions_count", { count: data.questions.length })}
						</h2>
						{reorder.isError && <div className="mt-2"><Alert>{t("error.generic")}</Alert></div>}
						<ol className="mt-2 flex flex-col gap-1">
							{data.questions.map((question, index) => (
								<li
									key={question.id}
									className={`flex items-center gap-1 rounded-md pr-1 ${editing === question.id ? "bg-selected" : "hover:bg-muted"}`}
								>
									<button type="button" className="min-w-0 flex-1 break-words px-2 py-2 text-left text-[13px]" onClick={() => setEditing(question.id)}>
										<span className="font-semibold">{index + 1}.</span> {question.question}
									</button>
									<button
										type="button"
										aria-label={t("course.move_up")}
										disabled={index === 0 || reorder.isPending}
										className="grid size-7 shrink-0 place-items-center rounded text-muted-foreground hover:bg-card disabled:opacity-30"
										onClick={() => move(index, -1)}
									>
										<ChevronUp size={14} aria-hidden="true" />
									</button>
									<button
										type="button"
										aria-label={t("course.move_down")}
										disabled={index === data.questions.length - 1 || reorder.isPending}
										className="grid size-7 shrink-0 place-items-center rounded text-muted-foreground hover:bg-card disabled:opacity-30"
										onClick={() => move(index, 1)}
									>
										<ChevronDown size={14} aria-hidden="true" />
									</button>
								</li>
							))}
						</ol>
						<button
							type="button"
							className="mt-2 flex min-h-9 w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-input font-medium hover:bg-muted"
							onClick={() => setEditing("new")}
						>
							<Plus size={15} aria-hidden="true" />
							{t("quiz.add_question")}
						</button>
					</section>
				</div>
				<div className="min-w-0 flex-[999_1_420px]">
					{editing === null ? (
						<div className="rounded-card border border-dashed border-input bg-card p-8 text-center text-muted-foreground">
							{t(data.questions.length === 0 ? "quiz.empty" : "quiz.choose_question")}
						</div>
					) : (
						<QuestionEditor
							key={editing}
							courseId={id}
							question={editing === "new" ? null : current}
							onDone={() => setEditing(null)}
						/>
					)}
				</div>
			</div>
		</div>
	);
}
