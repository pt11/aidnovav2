import { useState, type FormEvent, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
	FileSpreadsheet,
	FileText,
	FolderOpen,
	GraduationCap,
	Image,
	Link2,
	Lock,
	Search,
	Sparkles,
	Video,
	type LucideIcon,
} from "lucide-react";
import { Link, useSearch } from "wouter";
import { api, type Membership } from "../api";
import {
	ASSISTANT_ERRORS,
	sourceLinks,
	useAssistantChat,
	type AssistantSources as Sources,
	type ChatMessage,
} from "../AskPanel";
import { useI18n } from "../i18n";
import { Alert, Chip, PageLoading, Segmented, StatePanel } from "../ui";
import { CATEGORY_KEYS } from "./Policies";

interface HubPolicy {
	id: number;
	title: string;
	category: string;
	status: string;
	isMandatory: boolean;
	acknowledged: boolean;
	required: boolean;
}

interface HubCourse {
	id: number;
	title: string;
	status: string;
	isMandatory: boolean;
	lessons: number;
}

interface HubFile {
	id: number;
	name: string;
	mimeType: string | null;
	sizeBytes: number | null;
	fileType: "upload" | "link";
	folderId: number | null;
	pinProtected: boolean;
	url: string | null;
}

const TABS = ["all", "policies", "courses", "files", "links"] as const;
const SUGGESTION_KEYS = ["hub.suggest_policies", "hub.suggest_leave", "hub.suggest_news"];
function fileHref(file: { folderId: number | null }) {
	return file.folderId ? `/files?folder=${file.folderId}` : "/files";
}

function fileLook(file: HubFile): { icon: LucideIcon; color: string } {
	if (file.pinProtected) return { icon: Lock, color: "bg-[#030711]" };
	if (file.fileType === "link") return { icon: Link2, color: "bg-[#22A076]" };
	const type = file.mimeType ?? "";
	if (type.includes("sheet") || type.includes("excel") || type === "text/csv") {
		return { icon: FileSpreadsheet, color: "bg-[#DC2828]" };
	}
	if (type.startsWith("image/")) return { icon: Image, color: "bg-[#22A076]" };
	if (type.startsWith("video/")) return { icon: Video, color: "bg-[#753FF3]" };
	return { icon: FileText, color: "bg-primary" };
}

function formatSize(bytes: number | null) {
	if (!bytes) return "";
	if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
	return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function ResultCard({
	href,
	icon: Icon,
	color,
	title,
	detail,
	chips,
}: {
	href: string;
	icon: LucideIcon;
	color: string;
	title: string;
	detail?: string;
	chips?: ReactNode;
}) {
	return (
		<li>
			<Link
				href={href}
				className="flex h-full gap-3 rounded-card border border-border bg-card p-3.5 text-foreground no-underline hover:border-input hover:shadow-sm"
			>
				<span className={`grid size-10 shrink-0 place-items-center rounded-[9px] text-white ${color}`}>
					<Icon size={18} aria-hidden="true" />
				</span>
				<span className="min-w-0 flex-1">
					<span className="block break-words font-semibold">{title}</span>
					{detail && <span className="block break-words text-[13px] text-muted-foreground">{detail}</span>}
					{chips && <span className="mt-1.5 flex flex-wrap gap-1">{chips}</span>}
				</span>
			</Link>
		</li>
	);
}

function SourceLinks({ sources }: { sources: Sources }) {
	const links = sourceLinks(sources);
	if (links.length === 0) return null;
	return (
		<ul className="mt-3 flex flex-wrap gap-2">
			{links.map((link) => (
				<li key={link.key} className="min-w-0">
					<Link
						href={link.href}
						className="flex items-center gap-1.5 break-words rounded-md border border-border px-2.5 py-1 text-[13px] text-foreground no-underline hover:bg-muted"
					>
						<FileText size={14} aria-hidden="true" className="shrink-0 text-selected-foreground" />
						{link.label}
					</Link>
				</li>
			))}
		</ul>
	);
}

export function HubPage({ org }: { org: Membership }) {
	const { t } = useI18n();
	const search = useSearch();
	const initialQuery = new URLSearchParams(search).get("q") ?? "";
	const [query, setQuery] = useState(initialQuery);
	const [tab, setTab] = useState<(typeof TABS)[number]>("all");
	// A new search from the header bar replaces what's in this page's box.
	const [lastInitial, setLastInitial] = useState(initialQuery);
	if (initialQuery !== lastInitial) {
		setLastInitial(initialQuery);
		setQuery(initialQuery);
	}
	const policies = useQuery({
		queryKey: ["policies"],
		queryFn: () => api<{ policies: HubPolicy[] }>("/policies"),
		select: (data) => data.policies.filter((policy) => policy.status === "published"),
	});
	const courses = useQuery({
		queryKey: ["courses"],
		queryFn: () => api<{ learning: HubCourse[]; manage: HubCourse[] | null }>("/courses"),
		select: (data) => data.manage?.filter((course) => course.status === "published") ?? data.learning,
	});
	const files = useQuery({
		queryKey: ["files"],
		queryFn: () => api<{ files: HubFile[] }>("/files"),
		select: (data) => data.files,
	});
	const chat = useAssistantChat();
	const { messages, send } = chat;

	function submit(event: FormEvent) {
		event.preventDefault();
		send(query);
	}

	// Asking a full question shouldn't empty the results below it.
	const words = query.trim().toLowerCase();
	const questions = messages.filter((message) => message.role === "user");
	const lastAsked = questions[questions.length - 1]?.content;
	const text = lastAsked && lastAsked.trim().toLowerCase() === words ? "" : words;
	const matches = (value: string) => !text || value.toLowerCase().includes(text);
	const visiblePolicies =
		tab === "all" || tab === "policies"
			? (policies.data ?? []).filter((policy) => matches(policy.title))
			: [];
	const visibleCourses =
		tab === "all" || tab === "courses"
			? (courses.data ?? []).filter((course) => matches(course.title))
			: [];
	const visibleFiles = (files.data ?? []).filter(
		(file) =>
			matches(file.name) &&
			(tab === "all" ||
				(tab === "files" && file.fileType === "upload") ||
				(tab === "links" && file.fileType === "link")),
	);
	const total = visiblePolicies.length + visibleCourses.length + visibleFiles.length;
	const loading = policies.isPending || files.isPending || courses.isPending;
	const failed = policies.isError || files.isError || courses.isError;
	const exchanges = messages.reduce<{ question: string; answer?: ChatMessage }[]>(
		(list, message) => {
			if (message.role === "user") list.push({ question: message.content });
			else if (list.length > 0) list[list.length - 1].answer = message;
			return list;
		},
		[],
	);

	return (
		<div className="mx-auto flex max-w-[1100px] flex-col items-center gap-5 p-4 md:px-6 md:py-8">
			<div className="flex w-full max-w-[820px] flex-col items-center gap-4">
				<div className="text-center">
					<h1 className="break-words text-[26px] font-semibold leading-tight tracking-tight md:text-[32px]">
						{t("hub.find_anything", { organization: org.name })}
					</h1>
					<p className="mt-1.5 text-muted-foreground">{t("hub.desc")}</p>
				</div>
				<form onSubmit={submit} role="search" className="w-full">
					<label className="flex h-14 items-center gap-3 rounded-[12px] border-2 border-input bg-card px-4 shadow-sm focus-within:border-primary">
						<Search size={20} aria-hidden="true" className="shrink-0 text-selected-foreground" />
						<input
							type="search"
							aria-label={t("hub.big_search")}
							placeholder={t("hub.big_search")}
							maxLength={2000}
							value={query}
							onChange={(event) => setQuery(event.target.value)}
							className="min-w-0 flex-1 bg-transparent text-base text-foreground outline-none"
						/>
						<kbd className="hidden rounded border border-border px-1.5 py-0.5 font-sans text-[11px] text-muted-foreground sm:block">
							{t("hub.enter")}
						</kbd>
					</label>
				</form>
				<Segmented
					label={t("hub.title")}
					options={TABS.map((option) => ({ value: option, label: t(`hub.tab_${option}`) }))}
					value={tab}
					onChange={setTab}
					look="pills"
				/>

				{exchanges.length === 0 ? (
					<ul className="flex flex-wrap justify-center gap-2">
						{SUGGESTION_KEYS.map((key) => (
							<li key={key}>
								<button
									type="button"
									onClick={() => {
										setQuery(t(key));
										send(t(key));
									}}
									className="rounded-full border border-input bg-card px-3 py-1 text-[13px] text-foreground hover:bg-muted"
								>
									{t(key)}
								</button>
							</li>
						))}
					</ul>
				) : (
					<section aria-label={t("hub.assistant")} aria-live="polite" className="flex w-full flex-col gap-4 rounded-card border border-border bg-card p-5">
						{exchanges.map((exchange, index) => (
							<div key={index} className={index ? "border-t border-border pt-4" : ""}>
								<p className="flex items-center gap-2 text-[13px] font-semibold text-[#753FF3] dark:text-[#B69CFA]">
									<Sparkles size={15} aria-hidden="true" />
									{t("hub.assistant")}
								</p>
								{exchanges.length > 1 && (
									<p className="mt-1 break-words text-[13px] text-muted-foreground">{exchange.question}</p>
								)}
								{exchange.answer ? (
									<>
										<p className="mt-2 whitespace-pre-wrap break-words text-[15px] leading-[26px]">
											{exchange.answer.content}
										</p>
										{exchange.answer.sources && <SourceLinks sources={exchange.answer.sources} />}
									</>
								) : chat.failed ? (
									<div className="mt-2">
										<Alert>{t(ASSISTANT_ERRORS[chat.errorCode] ?? "hub.assistant_failed")}</Alert>
									</div>
								) : (
									<p role="status" className="mt-2 text-muted-foreground">
										{t("hub.assistant_thinking")}
									</p>
								)}
							</div>
						))}
						<p className="text-xs leading-5 text-muted-foreground">{t("hub.assistant_disclaimer")}</p>
					</section>
				)}
			</div>

			<section className="w-full">
				{failed && <Alert>{t("error.load")}</Alert>}
				{loading && <PageLoading />}
				{!loading && !failed && total === 0 && (
					<StatePanel
						icon={FolderOpen}
						title={text ? t("hub.no_results", { q: query.trim() }) : t("hub.empty")}
					/>
				)}
				{total > 0 && (
					<>
						<div className="mb-3 flex flex-wrap items-center justify-between gap-2">
							<h2 className="font-semibold">{t("hub.results", { count: total })}</h2>
							<p className="text-[13px] text-muted-foreground">{t("hub.only_yours")}</p>
						</div>
						<ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
							{visiblePolicies.map((policy) => (
								<ResultCard
									key={`policy-${policy.id}`}
									href={`/policies/${policy.id}`}
									icon={FileText}
									color="bg-primary"
									title={policy.title}
									detail={`${t("hub.kind_policy")} · ${t(CATEGORY_KEYS[policy.category] ?? "policies.cat_general")}`}
									chips={
										(policy.isMandatory || policy.acknowledged) && (
											<>
												{policy.isMandatory && <Chip tone="primary">{t("policies.mandatory_badge")}</Chip>}
												{policy.acknowledged && <Chip tone="neutral">{t("policies.acknowledged")}</Chip>}
											</>
										)
									}
								/>
							))}
							{visibleCourses.map((course) => (
								<ResultCard
									key={`course-${course.id}`}
									href={`/courses/${course.id}`}
									icon={GraduationCap}
									color="bg-[#753FF3]"
									title={course.title}
									detail={t("hub.course_detail", { count: course.lessons })}
									chips={course.isMandatory ? <Chip tone="primary">{t("course.mandatory_chip")}</Chip> : undefined}
								/>
							))}
							{visibleFiles.map((file) => {
								const look = fileLook(file);
								return (
									<ResultCard
										key={`file-${file.id}`}
										href={fileHref(file)}
										icon={look.icon}
										color={look.color}
										title={file.name}
										detail={[
											t(file.fileType === "link" ? "hub.kind_link" : "hub.kind_file"),
											file.pinProtected ? t("files.pin_protected") : formatSize(file.sizeBytes),
										]
											.filter(Boolean)
											.join(" · ")}
									/>
								);
							})}
						</ul>
					</>
				)}
			</section>
		</div>
	);
}
