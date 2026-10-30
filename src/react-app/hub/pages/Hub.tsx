import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
	Bot,
	FileText,
	FolderOpen,
	Link2,
	Lock,
	Search,
	Send,
} from "lucide-react";
import { Link } from "wouter";
import { api, ApiError } from "../api";
import { useI18n } from "../i18n";
import { Alert, buttonClass, PageHeader, StatePanel } from "../ui";
import { CATEGORY_KEYS, MandatoryBadge } from "./Policies";

interface HubPolicy {
	id: number;
	title: string;
	category: string;
	status: string;
	isMandatory: boolean;
}

interface HubFile {
	id: number;
	name: string;
	fileType: "upload" | "link";
	folderId: number | null;
	pinProtected: boolean;
	url: string | null;
}

interface Sources {
	policies: { id: number; title: string }[];
	files: { id: number; name: string; folderId: number | null }[];
	announcements: { id: number; title: string }[];
}

interface ChatMessage {
	role: "user" | "assistant";
	content: string;
	sources?: Sources;
}

const MAX_HISTORY = 10;
const TABS = ["all", "policies", "documents"] as const;
const SUGGESTION_KEYS = ["hub.suggest_policies", "hub.suggest_leave", "hub.suggest_news"];
const ERROR_KEYS: Record<string, string> = {
	ASSISTANT_LIMIT: "hub.assistant_limit",
	INVALID_MESSAGES: "hub.assistant_too_long",
};

function fileHref(file: { folderId: number | null }) {
	return file.folderId ? `/files?folder=${file.folderId}` : "/files";
}

function SourceLinks({ sources }: { sources: Sources }) {
	const { t } = useI18n();
	const links = [
		...sources.policies.map((policy) => ({
			key: `policy-${policy.id}`,
			href: `/policies/${policy.id}`,
			label: policy.title,
		})),
		...sources.files.map((file) => ({
			key: `file-${file.id}`,
			href: fileHref(file),
			label: file.name,
		})),
		...sources.announcements.map((item) => ({
			key: `announcement-${item.id}`,
			href: "/",
			label: item.title,
		})),
	];
	if (links.length === 0) return null;
	return (
		<div className="mt-2 border-t border-border pt-2">
			<p className="text-xs text-muted-foreground">{t("hub.sources")}</p>
			<ul className="mt-1 flex flex-wrap gap-1.5">
				{links.map((link) => (
					<li key={link.key} className="min-w-0">
						<Link
							href={link.href}
							className="block break-words rounded-full bg-selected px-2.5 py-0.5 text-xs font-medium text-selected-foreground no-underline hover:underline"
						>
							{link.label}
						</Link>
					</li>
				))}
			</ul>
		</div>
	);
}

function Assistant() {
	const { t } = useI18n();
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [draft, setDraft] = useState("");
	const end = useRef<HTMLDivElement>(null);
	const ask = useMutation({
		mutationFn: (history: ChatMessage[]) =>
			api<{ answer: string; sources: Sources }>("/assistant", {
				method: "POST",
				body: {
					messages: history
						.slice(-MAX_HISTORY)
						.map(({ role, content }) => ({ role, content })),
				},
			}),
		onSuccess: (data) =>
			setMessages((current) => [
				...current,
				{ role: "assistant", content: data.answer, sources: data.sources },
			]),
	});
	const errorCode = ask.error instanceof ApiError ? ask.error.code : "";

	useEffect(() => {
		end.current?.scrollIntoView({ block: "nearest" });
	}, [messages, ask.isPending]);

	function send(text: string) {
		const content = text.trim();
		if (!content || ask.isPending) return;
		const next = [...messages, { role: "user" as const, content }];
		// History has to start with a question, even after trimming to the limit.
		const start = next.length - MAX_HISTORY;
		const trimmed =
			start > 0 && next[start].role === "assistant" ? next.slice(start + 1) : next;
		setMessages(next);
		setDraft("");
		ask.mutate(trimmed);
	}

	function submit(event: FormEvent) {
		event.preventDefault();
		send(draft);
	}

	function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
		if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
			event.preventDefault();
			send(draft);
		}
	}

	return (
		<section
			aria-label={t("hub.assistant")}
			className="flex min-h-96 flex-col rounded-card border border-border bg-card lg:sticky lg:top-4 lg:h-[calc(100dvh-11rem)]"
		>
			<header className="flex items-center gap-2.5 border-b border-border px-4 py-3">
				<span className="grid size-8 place-items-center rounded-md bg-selected text-selected-foreground">
					<Bot size={17} aria-hidden="true" />
				</span>
				<h2 className="font-semibold">{t("hub.assistant")}</h2>
			</header>

			<div className="min-h-0 flex-1 overflow-y-auto p-4" aria-live="polite">
				{messages.length === 0 && (
					<div>
						<p className="text-sm text-muted-foreground">{t("hub.assistant_intro")}</p>
						<ul className="mt-3 flex flex-col gap-1.5">
							{SUGGESTION_KEYS.map((key) => (
								<li key={key}>
									<button
										type="button"
										onClick={() => send(t(key))}
										className="w-full rounded-md border border-border px-3 py-2 text-left text-sm hover:bg-muted"
									>
										{t(key)}
									</button>
								</li>
							))}
						</ul>
					</div>
				)}
				<ul className="flex flex-col gap-3">
					{messages.map((message, index) => (
						<li
							key={index}
							className={message.role === "user" ? "flex justify-end" : "flex"}
						>
							<div
								className={`max-w-[92%] rounded-lg px-3 py-2 text-sm leading-6 ${
									message.role === "user"
										? "bg-primary text-primary-foreground"
										: "bg-muted text-foreground"
								}`}
							>
								<p className="whitespace-pre-wrap break-words">{message.content}</p>
								{message.sources && <SourceLinks sources={message.sources} />}
							</div>
						</li>
					))}
				</ul>
				{ask.isPending && (
					<p role="status" className="mt-3 text-sm text-muted-foreground">
						{t("hub.assistant_thinking")}
					</p>
				)}
				{ask.isError && (
					<div className="mt-3">
						<Alert>{t(ERROR_KEYS[errorCode] ?? "hub.assistant_failed")}</Alert>
					</div>
				)}
				<div ref={end} />
			</div>

			<form onSubmit={submit} className="border-t border-border p-3">
				<div className="flex items-end gap-2">
					<textarea
						aria-label={t("hub.assistant_placeholder")}
						placeholder={t("hub.assistant_placeholder")}
						rows={2}
						maxLength={2000}
						value={draft}
						onChange={(event) => setDraft(event.target.value)}
						onKeyDown={onKeyDown}
						className="min-h-10 flex-1 resize-none rounded-md border border-input bg-card px-3 py-2 text-sm"
					/>
					<button
						type="submit"
						aria-label={t("hub.assistant_send")}
						disabled={ask.isPending || !draft.trim()}
						className={buttonClass("primary", "size-10 shrink-0 px-0")}
					>
						<Send size={16} aria-hidden="true" />
					</button>
				</div>
				<p className="mt-2 text-xs leading-5 text-muted-foreground">
					{t("hub.assistant_disclaimer")}
				</p>
			</form>
		</section>
	);
}

export function HubPage() {
	const { t } = useI18n();
	const [query, setQuery] = useState("");
	const [tab, setTab] = useState<(typeof TABS)[number]>("all");
	const policies = useQuery({
		queryKey: ["policies"],
		queryFn: () => api<{ policies: HubPolicy[] }>("/policies"),
		select: (data) => data.policies.filter((policy) => policy.status === "published"),
	});
	const files = useQuery({
		queryKey: ["files"],
		queryFn: () => api<{ files: HubFile[] }>("/files"),
		select: (data) => data.files,
	});

	const text = query.trim().toLowerCase();
	const matches = (value: string) => !text || value.toLowerCase().includes(text);
	const visiblePolicies =
		tab === "documents" ? [] : (policies.data ?? []).filter((p) => matches(p.title));
	const visibleFiles =
		tab === "policies" ? [] : (files.data ?? []).filter((f) => matches(f.name));
	const loading = policies.isPending || files.isPending;
	const failed = policies.isError || files.isError;

	return (
		<div className="mx-auto max-w-6xl p-4 md:p-6">
			<PageHeader title={t("hub.title")} subtitle={t("hub.desc")} />
			<div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_400px]">
				<div className="min-w-0">
					<div className="relative">
						<Search
							size={15}
							aria-hidden="true"
							className="pointer-events-none absolute top-3 left-3 text-muted-foreground"
						/>
						<input
							type="search"
							aria-label={t("hub.search_placeholder")}
							placeholder={t("hub.search_placeholder")}
							value={query}
							onChange={(event) => setQuery(event.target.value)}
							className="min-h-10 w-full rounded-md border border-input bg-card py-2 pr-3 pl-9 text-sm"
						/>
					</div>
					<div role="group" aria-label={t("hub.title")} className="mt-3 flex flex-wrap gap-1">
						{TABS.map((option) => (
							<button
								key={option}
								type="button"
								aria-pressed={tab === option}
								onClick={() => setTab(option)}
								className={`rounded-full px-3 py-1 text-xs font-medium ${
									tab === option
										? "bg-selected text-selected-foreground"
										: "text-muted-foreground hover:bg-muted"
								}`}
							>
								{t(`hub.tab_${option}`)}
							</button>
						))}
					</div>

					{failed && (
						<div className="mt-4">
							<Alert>{t("error.load")}</Alert>
						</div>
					)}
					{loading && (
						<p role="status" className="mt-4 text-sm text-muted-foreground">
							{t("common.loading")}
						</p>
					)}
					{!loading && !failed && visiblePolicies.length + visibleFiles.length === 0 && (
						<StatePanel
							icon={FolderOpen}
							title={text ? t("hub.no_results", { q: query.trim() }) : t("hub.empty")}
						/>
					)}
					{visiblePolicies.length + visibleFiles.length > 0 && (
						<ul className="mt-4 divide-y divide-border rounded-card border border-border bg-card">
							{visiblePolicies.map((policy) => (
								<li key={`policy-${policy.id}`}>
									<Link
										href={`/policies/${policy.id}`}
										className="flex items-center gap-3 px-4 py-3 text-foreground no-underline hover:bg-muted/40"
									>
										<span className="grid size-9 shrink-0 place-items-center rounded-md bg-selected text-selected-foreground">
											<FileText size={17} aria-hidden="true" />
										</span>
										<span className="min-w-0 flex-1">
											<span className="flex flex-wrap items-center gap-2 text-sm font-medium">
												<span className="min-w-0 break-words">{policy.title}</span>
												{policy.isMandatory && <MandatoryBadge />}
											</span>
											<span className="mt-0.5 block text-xs text-muted-foreground">
												{t(CATEGORY_KEYS[policy.category] ?? "policies.cat_general")}
											</span>
										</span>
									</Link>
								</li>
							))}
							{visibleFiles.map((file) => (
								<li key={`file-${file.id}`}>
									<Link
										href={fileHref(file)}
										className="flex items-center gap-3 px-4 py-3 text-foreground no-underline hover:bg-muted/40"
									>
										<span className="grid size-9 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
											{file.fileType === "link" ? (
												<Link2 size={17} aria-hidden="true" />
											) : (
												<FolderOpen size={17} aria-hidden="true" />
											)}
										</span>
										<span className="flex min-w-0 flex-1 items-center gap-1.5 text-sm font-medium">
											<span className="min-w-0 break-words">{file.name}</span>
											{file.pinProtected && (
												<Lock
													size={13}
													className="shrink-0 text-muted-foreground"
													aria-label={t("files.pin_protected")}
												/>
											)}
										</span>
									</Link>
								</li>
							))}
						</ul>
					)}
				</div>
				<Assistant />
			</div>
		</div>
	);
}
