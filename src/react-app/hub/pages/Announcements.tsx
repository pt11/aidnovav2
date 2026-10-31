import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Megaphone } from "lucide-react";
import { api } from "../api";
import { useI18n } from "../i18n";
import {
	Alert,
	buttonClass,
	ConfirmModal,
	Field,
	Modal,
	PageError,
	PageLoading,
	StatePanel,
	TextareaField,
} from "../ui";

export type Priority = "normal" | "high" | "urgent";

interface Announcement {
	id: number;
	title: string;
	content: string;
	priority: Priority;
	createdAt: string;
	authorName: string | null;
}

const QUERY_KEY = ["announcements"];
const FILTERS = ["all", "urgent", "high", "normal"] as const;
const PRIORITY_STYLES: Record<Priority, string> = {
	normal: "border border-border text-foreground",
	high: "bg-primary text-primary-foreground",
	urgent: "bg-destructive text-primary-foreground",
};
const PRIORITY_ORDER: Record<Priority, number> = { urgent: 0, high: 1, normal: 2 };

export function PriorityBadge({ priority }: { priority: Priority }) {
	const { t } = useI18n();
	return (
		<span
			className={`inline-block whitespace-nowrap rounded-full px-2 text-[11px] font-semibold leading-5 ${PRIORITY_STYLES[priority]}`}
		>
			{t(`announcements.${priority}`)}
		</span>
	);
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
				value={title}
				onChange={(event) => setTitle(event.target.value)}
			/>
			<TextareaField
				label={t("announcements.content")}
				required
				maxLength={10000}
				rows={6}
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
			<h1 className="text-[26px] font-semibold leading-[34px] tracking-tight">
				{t("nav.announcements")}
			</h1>
			<div className="mt-4 flex flex-wrap items-start gap-6">
				<div className="min-w-0 flex-[999_1_480px]">
					<div
						role="group"
						aria-label={t("announcements.priority")}
						className="flex flex-wrap gap-1.5"
					>
						{FILTERS.map((option) => (
							<button
								key={option}
								type="button"
								aria-pressed={filter === option}
								onClick={() => setFilter(option)}
								className={`rounded-full border px-3 py-1 text-[13px] font-medium ${
									filter === option
										? "border-transparent bg-foreground text-background"
										: "border-border bg-card text-foreground hover:bg-muted"
								}`}
							>
								{t(`announcements.${option}`)} · {countOf(option)}
							</button>
						))}
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
								<li key={item.id} className="rounded-card border border-border bg-card p-4 md:p-5">
									<div className="flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
										<PriorityBadge priority={item.priority} />
										<span className="min-w-0 flex-1">
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
													className={buttonClass("outline", "min-h-[30px] px-2.5 py-0 text-xs font-medium")}
													onClick={() => setEditing(item)}
												>
													{t("common.edit")}
												</button>
												<button
													type="button"
													aria-label={`${t("common.delete")}: ${item.title}`}
													className="min-h-[30px] rounded-md px-2.5 text-xs font-medium text-danger-foreground hover:bg-danger-surface"
													onClick={() => {
														remove.reset();
														setDeleting(item);
													}}
												>
													{t("common.delete")}
												</button>
											</span>
										)}
									</div>
									<h2 className="mt-2 break-words text-base font-semibold">{item.title}</h2>
									<p className="mt-1 whitespace-pre-wrap break-words">{item.content}</p>
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
