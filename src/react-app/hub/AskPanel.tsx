import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { ArrowUp, FileText, FolderOpen, Maximize2, Megaphone, Minimize2, Plus, Search, Sparkles, X, type LucideIcon } from "lucide-react";
import { Link } from "wouter";
import { api, ApiError } from "./api";
import { useI18n } from "./i18n";
import { Alert, buttonClass } from "./ui";

export interface AssistantSources {
	policies: { id: number; title: string }[];
	files: { id: number; name: string; folderId: number | null }[];
	announcements: { id: number; title: string }[];
}

export interface ChatMessage {
	role: "user" | "assistant";
	content: string;
	sources?: AssistantSources;
}

const MAX_HISTORY = 10;
const SUPPORT_EMAIL = "helloaidnova@gmail.com";
export const ASSISTANT_ERRORS: Record<string, string> = {
	ASSISTANT_LIMIT: "hub.assistant_limit",
	INVALID_MESSAGES: "hub.assistant_too_long",
};

// One conversation with the assistant, kept in memory until it's cleared.
export function useAssistantChat() {
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const ask = useMutation({
		mutationFn: (history: ChatMessage[]) =>
			api<{ answer: string; sources: AssistantSources }>("/assistant", {
				method: "POST",
				body: {
					messages: history.slice(-MAX_HISTORY).map(({ role, content }) => ({ role, content })),
				},
			}),
	});

	function request(history: ChatMessage[]) {
		// Set per call so an answer that arrives after "New conversation" is dropped.
		ask.mutate(history, {
			onSuccess: (data) =>
				setMessages((current) => [...current, { role: "assistant", content: data.answer, sources: data.sources }]),
		});
	}

	function trimmed(history: ChatMessage[]) {
		// History has to start with a question, even after trimming to the limit.
		const start = history.length - MAX_HISTORY;
		return start > 0 && history[start].role === "assistant" ? history.slice(start + 1) : history;
	}

	function send(text: string) {
		const content = text.trim();
		if (!content || ask.isPending) return false;
		const next = [...messages, { role: "user" as const, content }];
		setMessages(next);
		request(trimmed(next));
		return true;
	}

	function retry() {
		if (!ask.isPending && messages[messages.length - 1]?.role === "user") request(trimmed(messages));
	}

	function reset() {
		ask.reset();
		setMessages([]);
	}

	const errorCode = ask.error instanceof ApiError ? ask.error.code : "";
	return { messages, send, retry, reset, pending: ask.isPending, failed: ask.isError, errorCode };
}

export function sourceLinks(sources: AssistantSources) {
	return [
		...sources.policies.map((policy) => ({
			key: `policy-${policy.id}`,
			href: `/policies/${policy.id}`,
			label: policy.title,
		})),
		...sources.files.map((file) => ({
			key: `file-${file.id}`,
			href: file.folderId ? `/files?folder=${file.folderId}` : "/files",
			label: file.name,
		})),
		...sources.announcements.map((announcement) => ({
			key: `announcement-${announcement.id}`,
			href: "/",
			label: announcement.title,
		})),
	];
}

function Orbs({ small = false }: { small?: boolean }) {
	return (
		<div aria-hidden="true" className={`relative mx-auto ${small ? "h-[110px] w-[176px]" : "h-[150px] w-[240px]"}`}>
			<span className="absolute left-0 top-[42%] aspect-square w-[26%] rounded-full bg-[radial-gradient(circle_at_35%_30%,#eef4ff,#9ebfff_55%,#4e81ef)]" />
			<span className="absolute left-[11%] top-[16%] aspect-square w-[34%] rounded-full bg-[radial-gradient(circle_at_35%_30%,#fff,#b9d2ff_50%,#4e81ef)]" />
			<span className="absolute right-0 top-[24%] aspect-square w-[31%] rounded-full bg-[radial-gradient(circle_at_30%_30%,#8a5cf5,#753ff3_55%,#3b1c99)]" />
			<span className="absolute left-[26%] top-0 aspect-square w-[54%] overflow-hidden rounded-full bg-[radial-gradient(circle_at_32%_28%,#fff_0%,#cfe0ff_22%,#4e81ef_58%,#0066f5_100%)] shadow-[0_18px_40px_rgba(0,102,245,0.25)]">
				<img src="/blog-mark.webp" alt="" className="absolute -left-[12%] -top-[8%] h-[120%] w-auto max-w-none opacity-90" />
			</span>
		</div>
	);
}

function AnswerMark() {
	return (
		<span aria-hidden="true" className="relative size-8 shrink-0 overflow-hidden rounded-full bg-[radial-gradient(circle_at_32%_28%,#fff,#4e81ef_60%,#0066f5)]">
			<img src="/blog-mark.webp" alt="" className="absolute -left-[10%] -top-[5%] h-[115%] w-auto max-w-none" />
		</span>
	);
}

const PROMPTS: { icon: LucideIcon; title: string; text: string; fill: string }[] = [
	{ icon: Search, title: "ask.prompt_policy", text: "ask.prompt_policy_text", fill: "ask.prompt_policy_fill" },
	{ icon: FileText, title: "ask.prompt_explain", text: "ask.prompt_explain_text", fill: "ask.prompt_explain_fill" },
	{ icon: FolderOpen, title: "ask.prompt_file", text: "ask.prompt_file_text", fill: "ask.prompt_file_fill" },
	{ icon: Megaphone, title: "ask.prompt_news", text: "ask.prompt_news_text", fill: "ask.prompt_news_fill" },
];

export function AskPanel({
	open,
	expanded,
	name,
	onClose,
	onToggleExpanded,
}: {
	open: boolean;
	expanded: boolean;
	name: string;
	onClose: () => void;
	onToggleExpanded: () => void;
}) {
	const { t } = useI18n();
	const chat = useAssistantChat();
	const [draft, setDraft] = useState("");
	const [hour] = useState(() => new Date().getHours());
	const input = useRef<HTMLTextAreaElement>(null);
	const scroller = useRef<HTMLDivElement>(null);
	const greeting = hour < 12 ? "ask.morning" : hour < 18 ? "ask.afternoon" : "ask.evening";
	const started = chat.messages.length > 0;
	const firstQuestion = chat.messages[0]?.content;

	useEffect(() => {
		if (open) input.current?.focus();
	}, [open]);

	useEffect(() => {
		scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
	}, [chat.messages.length, chat.pending, chat.failed]);

	function submit(event?: FormEvent) {
		event?.preventDefault();
		if (chat.send(draft)) setDraft("");
	}

	function onKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
		if (event.key === "Enter" && !event.shiftKey) {
			event.preventDefault();
			submit();
		}
	}

	function applyPrompt(fill: string) {
		setDraft(t(fill));
		input.current?.focus();
	}

	// A source opens in the page, so the page has to be visible afterwards.
	function showPage() {
		if (expanded) onToggleExpanded();
		if (window.matchMedia("(max-width: 1279px)").matches) onClose();
	}

	if (!open) return null;

	const iconButton = "grid size-9 place-items-center rounded-md text-foreground hover:bg-muted";
	return (
		<>
			<button
				type="button"
				aria-label={t("common.close")}
				onClick={onClose}
				className="fixed inset-0 z-50 bg-black/35 md:hidden"
			/>
			<aside
				aria-label={t("shell.ask_aidnova")}
				className={`ask-panel fixed inset-x-0 bottom-0 top-8 z-50 flex flex-col overflow-hidden rounded-t-2xl md:top-0 md:rounded-none md:border-l md:border-border md:shadow-[-12px_0_40px_rgba(3,7,17,0.1)] xl:static xl:z-auto ${
					expanded ? "xl:min-w-0 xl:flex-1" : "md:left-auto md:w-[440px] xl:shrink-0"
				}`}
			>
				<div aria-hidden="true" className="flex justify-center bg-card pt-2 md:hidden">
					<span className="h-[5px] w-10 rounded-full bg-input" />
				</div>
				<header className="flex items-center gap-1 border-b border-border bg-card py-3 pl-[18px] pr-3">
					<h2 className="min-w-0 flex-1 truncate text-[17px] font-semibold leading-6">
						{firstQuestion ?? t("ask.new")}
					</h2>
					<button
						type="button"
						aria-label={t("ask.new")}
						title={t("ask.new")}
						className={iconButton}
						onClick={() => {
							chat.reset();
							setDraft("");
							input.current?.focus();
						}}
					>
						<Plus size={20} aria-hidden="true" />
					</button>
					<button
						type="button"
						aria-label={t(expanded ? "ask.shrink" : "ask.expand")}
						title={t(expanded ? "ask.shrink" : "ask.expand")}
						className={`${iconButton} max-md:hidden`}
						onClick={onToggleExpanded}
					>
						{expanded ? <Minimize2 size={18} aria-hidden="true" /> : <Maximize2 size={18} aria-hidden="true" />}
					</button>
					<button type="button" aria-label={t("ask.close")} title={t("ask.close")} className={iconButton} onClick={onClose}>
						<X size={20} aria-hidden="true" />
					</button>
				</header>

				<div ref={scroller} className="min-h-0 flex-1 overflow-y-auto">
					<div className={`mx-auto flex min-h-full flex-col ${expanded ? "max-w-[760px]" : ""}`}>
						<div className="mx-3.5 mt-3.5 flex items-center justify-between gap-2.5 rounded-card border border-border bg-card py-2.5 pl-4 pr-2.5">
							<span className="text-[15px] font-medium">{t("ask.need_help")}</span>
							<a href={`mailto:${SUPPORT_EMAIL}`} className={buttonClass("outline", "min-h-[34px] px-3.5 py-0")}>
								{t("ask.support")}
							</a>
						</div>
						{!started ? (
							<div className="flex flex-col items-center px-5 pb-4 pt-7 text-center">
								<Orbs />
								<h3 className="mt-5 text-2xl font-semibold leading-8 tracking-tight">
									{t(greeting, { name: name.trim() })}
								</h3>
								<p className="mt-1 text-base text-muted-foreground">{t("ask.today")}</p>
								<div className="mt-6 flex w-full max-w-[380px] flex-col gap-2.5">
									{PROMPTS.map((prompt) => {
										const Icon = prompt.icon;
										return (
											<button
												key={prompt.title}
												type="button"
												className="flex w-full items-center gap-3.5 rounded-card border border-border bg-card/85 px-3.5 py-3 text-left hover:border-input"
												onClick={() => applyPrompt(prompt.fill)}
											>
												<span className="grid size-9 shrink-0 place-items-center rounded-[9px] bg-muted text-muted-foreground">
													<Icon size={18} aria-hidden="true" />
												</span>
												<span className="min-w-0">
													<span className="block text-[15px] font-medium">{t(prompt.title)}</span>
													<span className="block text-sm text-muted-foreground">{t(prompt.text)}</span>
												</span>
											</button>
										);
									})}
								</div>
							</div>
						) : (
							<div aria-live="polite" className="flex flex-col gap-4 px-3.5 py-4">
								{chat.messages.map((message, index) =>
									message.role === "user" ? (
										<p
											key={index}
											className="ml-auto max-w-[85%] whitespace-pre-wrap break-words rounded-[16px_16px_4px_16px] bg-primary px-3.5 py-2.5 text-[15px] leading-6 text-primary-foreground"
										>
											{message.content}
										</p>
									) : (
										<div key={index} className="flex items-start gap-2.5">
											<AnswerMark />
											<div className="min-w-0 flex-1 rounded-[4px_16px_16px_16px] border border-border bg-card px-3.5 py-3">
												<p className="whitespace-pre-wrap break-words text-[15px] leading-6">{message.content}</p>
												{message.sources && sourceLinks(message.sources).length > 0 && (
													<div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-border pt-2.5">
														<span className="text-xs text-muted-foreground">{t("ask.sources")}</span>
														{sourceLinks(message.sources).map((source) => (
															<Link
																key={source.key}
																href={source.href}
																onClick={showPage}
																className="inline-flex max-w-full items-center gap-1 rounded-md border border-border px-2 py-0.5 text-xs text-foreground no-underline hover:bg-muted"
															>
																<FileText size={12} aria-hidden="true" className="shrink-0 text-primary" />
																<span className="truncate">{source.label}</span>
															</Link>
														))}
													</div>
												)}
											</div>
										</div>
									),
								)}
								{chat.pending && (
									<div className="flex items-start gap-2.5">
										<AnswerMark />
										<div role="status" className="rounded-[4px_16px_16px_16px] border border-border bg-card px-3.5 py-3">
											<span className="flex items-center gap-1" aria-hidden="true">
												<i className="ask-dot" />
												<i className="ask-dot [animation-delay:0.15s]" />
												<i className="ask-dot [animation-delay:0.3s]" />
											</span>
											<span className="mt-1.5 block text-[13px] text-muted-foreground">{t("ask.thinking")}</span>
										</div>
									</div>
								)}
								{chat.failed && (
									<div className="flex flex-col gap-2">
										<Alert>{t(ASSISTANT_ERRORS[chat.errorCode] ?? "hub.assistant_failed")}</Alert>
										{chat.errorCode !== "ASSISTANT_LIMIT" && chat.errorCode !== "INVALID_MESSAGES" && (
											<button type="button" className={buttonClass("outline", "self-start")} onClick={chat.retry}>
												{t("ask.try_again")}
											</button>
										)}
									</div>
								)}
							</div>
						)}
					</div>
				</div>

				<form onSubmit={submit} className={`w-full px-3.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1 ${expanded ? "mx-auto max-w-[760px]" : ""}`}>
					<div className="rounded-2xl border border-input bg-card px-3.5 pb-2.5 pt-3 shadow-[0_1px_2px_rgba(3,7,17,0.05)] focus-within:border-primary">
						<label className="block">
							<span className="sr-only">{t("ask.message")}</span>
							<textarea
								ref={input}
								rows={2}
								maxLength={2000}
								value={draft}
								placeholder={t("ask.placeholder")}
								className="block w-full resize-none bg-transparent text-[15px] leading-6 outline-none placeholder:text-muted-foreground"
								onChange={(event) => setDraft(event.target.value)}
								onKeyDown={onKeyDown}
							/>
						</label>
						<div className="mt-1.5 flex items-center justify-between gap-2">
							<span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
								<Sparkles size={14} aria-hidden="true" className="text-accent" />
								{t("ask.beta")}
							</span>
							<button
								type="submit"
								aria-label={t("hub.assistant_send")}
								disabled={!draft.trim() || chat.pending}
								className="grid size-[38px] place-items-center rounded-full bg-primary text-white disabled:bg-[#9ebfff] dark:disabled:bg-muted"
							>
								<ArrowUp size={18} strokeWidth={2.2} aria-hidden="true" />
							</button>
						</div>
					</div>
					<p className="px-1 pt-1.5 text-center text-xs leading-5 text-muted-foreground">{t("ask.disclaimer")}</p>
				</form>
			</aside>
		</>
	);
}
