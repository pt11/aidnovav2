import { useEffect, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Megaphone } from "lucide-react";
import { api } from "../api";
import { useI18n } from "../i18n";
import {
	Chip,
	BUTTON_SMALL,
	Alert,
	buttonClass,
	ConfirmModal,
	Field,
	Modal,
	PageError,
	PageLoading,
	Segmented,
	StatePanel,
	TextareaField,
} from "../ui";

import { ActivityDialog } from "./Reports";

export type Priority = "normal" | "high" | "urgent";

interface Announcement {
	id: number;
	title: string;
	content: string;
	priority: Priority;
	createdAt: string;
	authorName: string | null;
	responded: boolean;
	viewers?: number;
	responses?: number;
}

// Counted after a card has been at least half on screen for a moment, because a
// quick scroll past isn't reading it.
function useRecordsViews() {
	const pending = useRef(new Set<number>());
	const sent = useRef(new Set<number>());
	const timers = useRef(new Map<number, number>());
	const observer = useRef<IntersectionObserver | null>(null);
	useEffect(() => {
		const flushTimer = window.setInterval(() => {
			if (pending.current.size === 0) return;
			const ids = [...pending.current];
			pending.current.clear();
			api("/announcements/views", { method: "POST", body: { ids } }).catch(() => undefined);
		}, 2000);
		const visibleFor = timers.current;
		observer.current = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					const id = Number((entry.target as HTMLElement).dataset.announcementId);
					if (entry.isIntersecting) {
						if (!sent.current.has(id) && !visibleFor.has(id)) {
							visibleFor.set(
								id,
								window.setTimeout(() => {
									sent.current.add(id);
									pending.current.add(id);
								}, 1200),
							);
						}
					} else {
						window.clearTimeout(visibleFor.get(id));
						visibleFor.delete(id);
					}
				}
			},
			{ threshold: 0.5 },
		);
		return () => {
			observer.current?.disconnect();
			window.clearInterval(flushTimer);
			visibleFor.forEach((timer) => window.clearTimeout(timer));
			visibleFor.clear();
		};
	}, []);
	return (element: HTMLElement | null) => {
		if (element) observer.current?.observe(element);
	};
}

const QUERY_KEY = ["announcements"];
const FILTERS = ["all", "urgent", "high", "normal"] as const;
const PRIORITY_TONES = { normal: "outline", high: "primary", urgent: "danger" } as const;
const PRIORITY_ORDER: Record<Priority, number> = { urgent: 0, high: 1, normal: 2 };

export function PriorityBadge({ priority }: { priority: Priority }) {
	const { t } = useI18n();
	return <Chip tone={PRIORITY_TONES[priority]}>{t(`announcements.${priority}`)}</Chip>;
}

function AnnouncementForm({
	existing,
	onDone,
}: {
	existing: Announcement | null;
	onDone?: () => void;
}) {
	const { t } = useI18n();
	const queryClient = useQueryClient();
	const [title, setTitle] = useState(existing?.title ?? "");
	const [content, setContent] = useState(existing?.content ?? "");
	const [priority, setPriority] = useState<Priority>(
		existing?.priority ?? "normal",
	);

	const save = useMutation({
		mutationFn: () =>
			api(existing ? `/announcements/${existing.id}` : "/announcements", {
				method: existing ? "PATCH" : "POST",
				body: { title, content, priority },
			}),
		onSuccess: async () => {
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
				queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
			]);
			setTitle("");
			setContent("");
			setPriority("normal");
			onDone?.();
		},
	});

	function submit(event: FormEvent) {
		event.preventDefault();
		save.mutate();
	}

	return (
		<form onSubmit={submit} className="flex flex-col gap-4">
			{save.isError && <Alert>{t("error.generic")}</Alert>}
			<Field
				label={t("announcements.title_field")}
				required
				maxLength={500}
				placeholder={t("announcements.title_placeholder")}
				value={title}
				onChange={(event) => setTitle(event.target.value)}
			/>
			<TextareaField
				label={t("announcements.content")}
				required
				maxLength={10000}
				rows={6}
				placeholder={t("announcements.content_placeholder")}
				value={content}
				onChange={(event) => setContent(event.target.value)}
			/>
			<fieldset className="flex flex-col gap-2">
				<legend className="pb-1.5 text-sm font-medium">{t("announcements.priority")}</legend>
				{(["normal", "high", "urgent"] as const).map((option) => (
					<label key={option} className="flex items-start gap-2 text-[13px]">
						<input
							type="radio"
							name={`priority-${existing?.id ?? "new"}`}
							className="mt-1 accent-primary"
							checked={priority === option}
							onChange={() => setPriority(option)}
						/>
						<span>
							<b className="font-semibold">{t(`announcements.${option}`)}</b> —{" "}
							{t(`announcements.${option}_hint`)}
						</span>
					</label>
				))}
			</fieldset>
			{!existing && (
				<p className="rounded-md bg-background px-2.5 py-2 text-[13px]">{t("announcements.notice")}</p>
			)}
			<div className="flex justify-end gap-2">
				{onDone && (
					<button type="button" className={buttonClass("outline")} onClick={onDone}>
						{t("common.cancel")}
					</button>
				)}
				<button
					type="submit"
					disabled={save.isPending}
					className={buttonClass("primary", onDone ? "" : "w-full")}
				>
					{existing ? t("common.save") : t("dashboard.post_announcement")}
				</button>
			</div>
		</form>
	);
}

export function AnnouncementsPage({ canManage }: { canManage: boolean }) {
	const { t, language } = useI18n();
	const queryClient = useQueryClient();
	const watch = useRecordsViews();
	const [activityFor, setActivityFor] = useState<number | null>(null);
	const respond = useMutation({
		mutationFn: (id: number) => api(`/announcements/${id}/respond`, { method: "POST" }),
		onSettled: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
	});
	const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
	const [editing, setEditing] = useState<Announcement | null>(null);
	const [deleting, setDeleting] = useState<Announcement | null>(null);

	const announcements = useQuery({
		queryKey: QUERY_KEY,
		queryFn: () => api<{ announcements: Announcement[] }>("/announcements"),
		select: (data) => data.announcements,
	});
	const remove = useMutation({
		mutationFn: (id: number) => api(`/announcements/${id}`, { method: "DELETE" }),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: QUERY_KEY });
			setDeleting(null);
		},
	});

	if (announcements.isPending) return <PageLoading />;
	if (announcements.isError) {
		return <PageError onRetry={() => announcements.refetch()} />;
	}

	const visible = announcements.data
		.filter((item) => filter === "all" || item.priority === filter)
		.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
			new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
	const countOf = (option: (typeof FILTERS)[number]) =>
		option === "all"
			? announcements.data.length
			: announcements.data.filter((item) => item.priority === option).length;

	return (
		<div className="mx-auto max-w-[1180px] p-4 md:px-6 md:py-7">
			<div className="flex flex-wrap items-start gap-6">
				<div className="min-w-0 flex-[999_1_480px]">
					<div className="flex flex-wrap items-center justify-between gap-3">
						<h1 className="text-[26px] font-semibold leading-[34px] tracking-tight">
							{t("nav.announcements")}
						</h1>
						<Segmented
							label={t("announcements.priority")}
							options={FILTERS.map((option) => ({
								value: option,
								label: `${t(`announcements.${option}`)} · ${countOf(option)}`,
							}))}
							value={filter}
							onChange={setFilter}
						/>
					</div>
					{visible.length === 0 ? (
						<StatePanel
							icon={Megaphone}
							title={t(
								announcements.data.length
									? "announcements.none_match"
									: "announcements.empty_title",
							)}
							description={
								announcements.data.length
									? undefined
									: t(canManage ? "announcements.empty_manager" : "announcements.empty_staff")
							}
						/>
					) : (
						<ul className="mt-4 flex flex-col gap-3">
							{visible.map((item) => (
								<li
									key={item.id}
									data-announcement-id={item.id}
									ref={watch}
									className={`rounded-card bg-card p-4 md:p-5 ${
										item.priority === "urgent" ? "border-2 border-destructive" : "border border-border"
									}`}
								>
									<div className="flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
										<PriorityBadge priority={item.priority} />
										<span className="min-w-0 flex-1">
											{item.priority === "urgent" && `${t("announcements.pinned")} · `}
											{item.authorName && `${item.authorName} · `}
											{new Date(item.createdAt).toLocaleDateString(language, {
												dateStyle: "medium",
											})}
										</span>
										{canManage && (
											<span className="flex gap-1.5">
												<button
													type="button"
													aria-label={`${t("common.edit")}: ${item.title}`}
													className={buttonClass("outline", BUTTON_SMALL)}
													onClick={() => setEditing(item)}
												>
													{t("common.edit")}
												</button>
												<button
													type="button"
													aria-label={`${t("common.delete")}: ${item.title}`}
													className={buttonClass("dangerGhost", BUTTON_SMALL)}
													onClick={() => {
														remove.reset();
														setDeleting(item);
													}}
												>
													{t("common.delete")}…
												</button>
											</span>
										)}
									</div>
									<h2 className="mt-2 break-words text-[17px] font-semibold">{item.title}</h2>
									<p className="mt-1 whitespace-pre-wrap break-words">{item.content}</p>
									<div className="mt-3 flex flex-wrap items-center gap-3">
										{item.responded ? (
											<span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#14795A] dark:text-[#4CC9A0]">
												<Check size={15} aria-hidden="true" />
												{t("announcements.got_it_done")}
											</span>
										) : (
											<button
												type="button"
												disabled={respond.isPending}
												aria-label={`${t("announcements.got_it")}: ${item.title}`}
												className={buttonClass("outline", BUTTON_SMALL)}
												onClick={() => respond.mutate(item.id)}
											>
												{t("announcements.got_it")}
											</button>
										)}
										{canManage && item.viewers !== undefined && (
											<button
												type="button"
												className="text-[13px] text-muted-foreground hover:underline"
												onClick={() => setActivityFor(item.id)}
											>
												{t("announcements.stats", { viewers: item.viewers, responses: item.responses ?? 0 })}
											</button>
										)}
									</div>
								</li>
							))}
						</ul>
					)}
				</div>
				{canManage && (
					<aside className="min-w-0 flex-[1_1_300px] rounded-card border border-border bg-card p-4 md:max-w-[360px]">
						<h2 className="mb-3 text-base font-semibold">{t("announcements.new")}</h2>
						<AnnouncementForm existing={null} />
					</aside>
				)}
			</div>

			{activityFor !== null && (
				<ActivityDialog
					path={`/reports/announcements/${activityFor}/people`}
					kind="announcement"
					onClose={() => setActivityFor(null)}
				/>
			)}
			<Modal
				title={t("announcements.edit")}
				open={editing !== null}
				onClose={() => setEditing(null)}
			>
				{editing && (
					<AnnouncementForm
						key={editing.id}
						existing={editing}
						onDone={() => setEditing(null)}
					/>
				)}
			</Modal>
			<ConfirmModal
				title={t("announcements.delete_title")}
				description={t("announcements.delete_desc", { title: deleting?.title ?? "" })}
				confirmLabel={t("common.delete")}
				open={deleting !== null}
				pending={remove.isPending}
				failed={remove.isError}
				onConfirm={() => deleting && remove.mutate(deleting.id)}
				onClose={() => setDeleting(null)}
			/>
		</div>
	);
}
