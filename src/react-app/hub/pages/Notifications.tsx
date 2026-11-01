import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Award, Bell, BellOff, CalendarDays, Check, Contact, FileText, FolderKanban, GraduationCap, Megaphone, TriangleAlert, type LucideIcon } from "lucide-react";
import { Link, useLocation } from "wouter";
import { api, useMe } from "../api";
import { useI18n } from "../i18n";
import { ActionsMenu, buttonClass, PageError, PageHeader, PageLoading, Segmented, StatePanel, useToast } from "../ui";
import { periodLabel } from "./periods";

export interface NotificationItem {
	id: number;
	kind: string;
	category: string;
	params: Record<string, string | number>;
	href: string;
	createdAt: string;
	read: boolean;
}

const LIST_KEY = ["notifications"];
const COUNT_KEY = ["notifications", "count"];
const FILTERS = ["all", "policies", "courses", "announcements", "events", "projects", "capacity", "people"] as const;
const ICONS: Record<string, LucideIcon> = {
	policies: FileText,
	courses: GraduationCap,
	announcements: Megaphone,
	events: CalendarDays,
	projects: FolderKanban,
	capacity: Award,
	people: Contact,
	general: Bell,
};
const TONES: Record<string, string> = {
	policies: "bg-primary text-white",
	courses: "bg-[#753FF3] text-white",
	announcements: "bg-[#0E7490] text-white",
	events: "bg-muted text-foreground",
	projects: "bg-[#14795A] text-white",
	capacity: "bg-[#B45309] text-white",
	people: "bg-muted text-foreground",
	general: "bg-muted text-foreground",
};

function useText() {
	const { t, language } = useI18n();
	return (item: NotificationItem) => {
		const period = item.params.period ? periodLabel(String(item.params.period), language) : String(item.params.label ?? "");
		const level = item.params.level ? t(`cb.level_${item.params.level}`) : "";
		const values = { ...item.params, period, level };
		const detailKey = `notif.${item.kind}_detail`;
		const detail = t(detailKey, values);
		return { title: t(`notif.${item.kind}`, values), detail: detail === detailKey ? "" : detail, area: t(`notif.area_${item.category}`) };
	};
}

function useTimeAgo() {
	const { language, t } = useI18n();
	const [now] = useState(() => Date.now());
	return (value: string) => {
		const minutes = Math.max(0, Math.round((now - new Date(value).getTime()) / 60000));
		if (minutes < 1) return t("notif.just_now");
		const format = new Intl.RelativeTimeFormat(language, { numeric: "auto" });
		if (minutes < 60) return format.format(-minutes, "minute");
		if (minutes < 1440) return format.format(-Math.round(minutes / 60), "hour");
		return format.format(-Math.round(minutes / 1440), "day");
	};
}

function useNotificationActions() {
	const queryClient = useQueryClient();
	const toast = useToast();
	const { t } = useI18n();
	const refresh = () => queryClient.invalidateQueries({ queryKey: LIST_KEY });
	const failed = () => toast.error(t("toast.failed"), t("toast.try_again"));
	return {
		markRead: useMutation({ mutationFn: (id: number) => api(`/notifications/${id}/read`, { method: "POST" }), onSuccess: refresh, onError: failed }),
		markAll: useMutation({ mutationFn: () => api("/notifications/read-all", { method: "POST" }), onSuccess: refresh, onError: failed }),
		remove: useMutation({ mutationFn: (id: number) => api(`/notifications/${id}`, { method: "DELETE" }), onSuccess: refresh, onError: failed }),
	};
}

// Checks once a minute and when someone comes back to the tab. Fine for notices,
// and light on phones and slow connections.
export function NotificationBell({ className }: { className: string }) {
	const { t } = useI18n();
	const [location, navigate] = useLocation();
	const [open, setOpen] = useState(false);
	const box = useRef<HTMLDivElement>(null);
	const text = useText();
	const timeAgo = useTimeAgo();
	const { markRead, markAll } = useNotificationActions();
	const count = useQuery({
		queryKey: COUNT_KEY,
		queryFn: () => api<{ unread: number }>("/notifications/unread-count"),
		select: (data) => data.unread,
		refetchInterval: 60_000,
		refetchOnWindowFocus: true,
		staleTime: 0,
	});
	const recent = useQuery({
		queryKey: LIST_KEY,
		queryFn: () => api<{ notifications: NotificationItem[] }>("/notifications"),
		select: (data) => data.notifications,
		enabled: open,
		staleTime: 0,
	});
	const unread = count.data ?? 0;

	useEffect(() => {
		if (!open) return;
		const close = (event: Event) => {
			if (event instanceof KeyboardEvent ? event.key === "Escape" : !box.current?.contains(event.target as Node)) setOpen(false);
		};
		document.addEventListener("keydown", close);
		document.addEventListener("pointerdown", close);
		return () => {
			document.removeEventListener("keydown", close);
			document.removeEventListener("pointerdown", close);
		};
	}, [open]);

	return (
		<div ref={box} className="relative">
			<button
				type="button"
				aria-label={unread ? t("notif.bell_unread", { count: unread }) : t("shell.notifications")}
				aria-expanded={open}
				className={`relative ${className}`}
				onClick={() => setOpen((current) => !current)}
			>
				<Bell size={18} aria-hidden="true" />
				{unread > 0 && (
					<span aria-hidden="true" className="absolute -top-1 -right-1 grid h-[18px] min-w-[18px] place-items-center rounded-full border-2 border-card bg-[#DC2828] px-1 text-[10px] font-bold text-white">
						{unread > 99 ? "99+" : unread}
					</span>
				)}
			</button>
			{open && (
				<section aria-label={t("notif.recent")} className="fixed inset-x-3 top-16 z-50 overflow-hidden rounded-xl border border-border bg-card shadow-[0_10px_15px_-3px_rgba(0,0,0,0.12),0_4px_6px_-4px_rgba(0,0,0,0.1)] sm:absolute sm:inset-x-auto sm:top-[calc(100%+8px)] sm:right-0 sm:w-[380px]">
					<div className="flex items-center justify-between gap-2 border-b border-border px-3.5 py-3">
						<h2 className="flex items-center gap-2 text-[15px] font-semibold">
							{t("shell.notifications")}
							{unread > 0 && <span className="rounded-full bg-[#DC2828] px-[7px] text-xs font-semibold text-white">{unread}</span>}
						</h2>
						{unread > 0 && (
							<button type="button" disabled={markAll.isPending} className="min-h-8 text-[13px] font-medium text-selected-foreground" onClick={() => markAll.mutate()}>
								{t("notif.mark_all_short")}
							</button>
						)}
					</div>
					{recent.isPending ? (
						<PageLoading variant="inline" />
					) : (recent.data ?? []).length === 0 ? (
						<p className="px-4 py-6 text-center text-[13px] text-muted-foreground">{t("notif.empty_short")}</p>
					) : (
						<ul className="max-h-[50dvh] overflow-y-auto">
							{(recent.data ?? []).slice(0, 5).map((item) => {
								const words = text(item);
								return (
									<li key={item.id} className="border-t border-border first:border-t-0">
										<button
											type="button"
											className={`flex w-full gap-2.5 px-3.5 py-3 text-left text-[13px] leading-5 hover:bg-muted ${item.read ? "" : "bg-selected"}`}
											onClick={() => {
												if (!item.read) markRead.mutate(item.id);
												setOpen(false);
												navigate(item.href);
											}}
										>
											<span aria-hidden="true" className={`mt-[7px] size-2 shrink-0 rounded-full ${item.read ? "" : "bg-primary"}`} />
											<span className="min-w-0 break-words">
												{!item.read && <span className="sr-only">{t("notif.unread")}: </span>}
												<b className="font-semibold">{words.title}</b>
												<span className="block text-muted-foreground">{timeAgo(item.createdAt)}</span>
											</span>
										</button>
									</li>
								);
							})}
						</ul>
					)}
					<Link href="/notifications" onClick={() => setOpen(false)} aria-current={location === "/notifications" ? "page" : undefined} className="block border-t border-border p-2.5 text-center text-[13px] font-semibold text-selected-foreground no-underline">
						{t("notif.view_all")}
					</Link>
				</section>
			)}
		</div>
	);
}

function Row({ item }: { item: NotificationItem }) {
	const { t } = useI18n();
	const [, navigate] = useLocation();
	const words = useText()(item);
	const timeAgo = useTimeAgo();
	const { markRead, remove } = useNotificationActions();
	const urgent = item.kind === "announcement_urgent";
	const Icon = urgent ? TriangleAlert : (ICONS[item.category] ?? Bell);
	return (
		<li className={`flex items-start gap-3 border-t border-border px-4 py-3.5 first:border-t-0 ${item.read ? "" : "bg-selected"}`}>
			<span aria-hidden="true" className={`grid size-9 shrink-0 place-items-center rounded-[9px] ${urgent ? "bg-[#DC2828] text-white" : (TONES[item.category] ?? TONES.general)}`}>
				<Icon size={16} />
			</span>
			<button
				type="button"
				className="min-w-0 flex-1 break-words text-left"
				onClick={() => {
					if (!item.read) markRead.mutate(item.id);
					navigate(item.href);
				}}
			>
				{!item.read && <span className="sr-only">{t("notif.unread")}: </span>}
				<span className={`block ${item.read ? "font-medium" : "font-semibold"}`}>{words.title}</span>
				{words.detail && <span className="block text-[13px] text-muted-foreground">{words.detail}</span>}
				<span className="block text-xs text-muted-foreground">{words.area} · {timeAgo(item.createdAt)}</span>
			</button>
			{!item.read && <span aria-hidden="true" className="mt-1.5 size-2.5 shrink-0 rounded-full bg-primary" />}
			<ActionsMenu
				label={t("notif.actions")}
				actions={[
					...(item.read ? [] : [{ label: t("notif.mark_read"), onSelect: () => markRead.mutate(item.id) }]),
					{ label: t("common.delete"), danger: true, onSelect: () => remove.mutate(item.id) },
				]}
			/>
		</li>
	);
}

export function NotificationsPage() {
	const { t } = useI18n();
	const me = useMe();
	const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
	const [unreadOnly, setUnreadOnly] = useState(false);
	const { markAll } = useNotificationActions();
	const list = useQuery({ queryKey: LIST_KEY, queryFn: () => api<{ notifications: NotificationItem[]; unread: number }>("/notifications"), staleTime: 0 });
	if (list.isPending) return <PageLoading />;
	if (list.isError) return <PageError onRetry={() => list.refetch()} />;
	const { notifications, unread } = list.data;
	const isAdmin = me.data?.memberships.find((org) => org.organizationId === me.data?.activeOrganizationId)?.role === "admin";
	const present = new Set(notifications.map((item) => item.category));
	const filters = FILTERS.filter((value) => value === "all" || present.has(value));
	const visible = notifications.filter((item) => (filter === "all" || item.category === filter) && (!unreadOnly || !item.read));
	const startOfDay = new Date().setHours(0, 0, 0, 0);
	const today = visible.filter((item) => new Date(item.createdAt).getTime() >= startOfDay);
	const earlier = visible.filter((item) => new Date(item.createdAt).getTime() < startOfDay);
	const group = (label: string, items: NotificationItem[]) =>
		items.length > 0 && (
			<section className="flex flex-col gap-2">
				<h2 className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">{label}</h2>
				<ul className="overflow-hidden rounded-card border border-border bg-card">
					{items.map((item) => <Row key={item.id} item={item} />)}
				</ul>
			</section>
		);
	return (
		<div className="flex max-w-[860px] flex-col gap-4 p-4 md:px-6 md:py-7">
			<PageHeader
				title={t("shell.notifications")}
				subtitle={t("notif.subtitle", { count: unread })}
				action={
					<div className="flex flex-wrap gap-2">
						{isAdmin && <Link href="/settings/notifications" className={buttonClass("outline")}>{t("notif.settings")}</Link>}
						<button type="button" disabled={unread === 0 || markAll.isPending} className={buttonClass()} onClick={() => markAll.mutate()}>
							<Check size={16} aria-hidden="true" />
							{t("notif.mark_all")}
						</button>
					</div>
				}
			/>
			{notifications.length === 0 ? (
				<StatePanel icon={BellOff} title={t("notif.empty")} description={t("notif.empty_desc")} />
			) : (
				<>
					<div className="flex flex-wrap items-center gap-3">
						<Segmented label={t("shell.notifications")} look="pills" options={filters.map((value) => ({ value, label: t(`notif.filter_${value}`) }))} value={filter} onChange={setFilter} />
						<label className="ml-auto flex min-h-8 items-center gap-2 text-[13px]">
							<input type="checkbox" className="size-4 accent-primary" checked={unreadOnly} onChange={(event) => setUnreadOnly(event.target.checked)} />
							{t("notif.unread_only")}
						</label>
					</div>
					{visible.length === 0 ? (
						<p className="rounded-card border border-border bg-card p-5 text-center text-sm text-muted-foreground">{t("notif.none_here")}</p>
					) : (
						<>
							{group(t("notif.today"), today)}
							{group(t("notif.earlier"), earlier)}
						</>
					)}
				</>
			)}
		</div>
	);
}
