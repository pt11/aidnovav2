import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Megaphone, Pencil, Plus, Trash2 } from "lucide-react";
import { api } from "../api";
import { useI18n } from "../i18n";
import {
	Alert,
	buttonClass,
	ConfirmModal,
	Field,
	Modal,
	PageError,
	PageHeader,
	PageLoading,
	SelectField,
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
	normal: "bg-muted text-muted-foreground",
	high: "bg-warning-surface text-warning-foreground",
	urgent: "bg-danger-surface text-danger-foreground",
};

export function PriorityBadge({ priority }: { priority: Priority }) {
	const { t } = useI18n();
	return (
		<span
			className={`rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_STYLES[priority]}`}
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
	onDone: () => void;
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
			await queryClient.invalidateQueries({ queryKey: QUERY_KEY });
			onDone();
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
			<SelectField
				label={t("announcements.priority")}
				value={priority}
				onChange={(event) => setPriority(event.target.value as Priority)}
			>
				<option value="normal">{t("announcements.normal")}</option>
				<option value="high">{t("announcements.high")}</option>
				<option value="urgent">{t("announcements.urgent")}</option>
			</SelectField>
			<div className="flex justify-end gap-2">
				<button type="button" className={buttonClass("outline")} onClick={onDone}>
					{t("common.cancel")}
				</button>
				<button type="submit" disabled={save.isPending} className={buttonClass()}>
					{existing ? t("common.save") : t("announcements.post")}
				</button>
			</div>
		</form>
	);
}

export function AnnouncementsPage({ canManage }: { canManage: boolean }) {
	const { t, language } = useI18n();
	const queryClient = useQueryClient();
	const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
	const [formOpen, setFormOpen] = useState(false);
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

	const visible = announcements.data.filter(
		(item) => filter === "all" || item.priority === filter,
	);

	function closeForm() {
		setFormOpen(false);
		setEditing(null);
	}

	return (
		<div className="mx-auto max-w-3xl p-4 md:p-6">
			<PageHeader
				title={t("nav.announcements")}
				subtitle={t("announcements.subtitle")}
				action={
					canManage && (
						<button
							type="button"
							className={buttonClass()}
							onClick={() => setFormOpen(true)}
						>
							<Plus size={16} aria-hidden="true" />
							{t("announcements.new")}
						</button>
					)
				}
			/>

			{announcements.data.length > 0 && (
				<div
					role="group"
					aria-label={t("announcements.priority")}
					className="mt-5 flex flex-wrap gap-1.5"
				>
					{FILTERS.map((option) => (
						<button
							key={option}
							type="button"
							aria-pressed={filter === option}
							onClick={() => setFilter(option)}
							className={`rounded-full px-3 py-1 text-xs font-medium ${
								filter === option
									? "bg-selected text-selected-foreground"
									: "text-muted-foreground hover:bg-muted"
							}`}
						>
							{t(`announcements.${option}`)}
						</button>
					))}
				</div>
			)}

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
							className="rounded-card border border-border bg-card p-4 md:p-5"
						>
							<div className="flex items-start justify-between gap-3">
								<div className="min-w-0">
									<div className="flex flex-wrap items-center gap-2">
										<h2 className="font-semibold">{item.title}</h2>
										{item.priority !== "normal" && (
											<PriorityBadge priority={item.priority} />
										)}
									</div>
									<p className="mt-0.5 text-xs text-muted-foreground">
										{item.authorName && `${item.authorName} · `}
										{new Date(item.createdAt).toLocaleDateString(language, {
											dateStyle: "medium",
										})}
									</p>
								</div>
								{canManage && (
									<div className="flex shrink-0 gap-1">
										<button
											type="button"
											aria-label={`${t("common.edit")}: ${item.title}`}
											className="grid size-9 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
											onClick={() => {
												setEditing(item);
												setFormOpen(true);
											}}
										>
											<Pencil size={15} aria-hidden="true" />
										</button>
										<button
											type="button"
											aria-label={`${t("common.delete")}: ${item.title}`}
											className="grid size-9 place-items-center rounded-md text-muted-foreground hover:bg-danger-surface hover:text-danger-foreground"
											onClick={() => {
												remove.reset();
												setDeleting(item);
											}}
										>
											<Trash2 size={15} aria-hidden="true" />
										</button>
									</div>
								)}
							</div>
							<p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6">
								{item.content}
							</p>
						</li>
					))}
				</ul>
			)}

			<Modal
				title={t(editing ? "announcements.edit" : "announcements.new")}
				open={formOpen}
				onClose={closeForm}
			>
				<AnnouncementForm existing={editing} onDone={closeForm} />
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
