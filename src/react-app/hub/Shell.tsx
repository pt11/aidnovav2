import { useEffect, useRef, useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
	BarChart3,
	Bell,
	CalendarDays,
	Check,
	ChevronsUpDown,
	Compass,
	FileText,
	FolderOpen,
	GraduationCap,
	LayoutDashboard,
	LogOut,
	Megaphone,
	Menu,
	Moon,
	MoreHorizontal,
	Settings,
	Sun,
	UserCircle,
	Users,
	X,
	type LucideIcon,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { api, authClient, type Me, type Membership, type Role } from "./api";
import { useI18n } from "./i18n";
import { LanguageSwitch } from "./ui";

interface NavItem {
	url: string;
	icon: LucideIcon;
	labelKey: string;
}

const CORE_ITEMS: NavItem[] = [
	{ url: "/", icon: Megaphone, labelKey: "nav.announcements" },
	{ url: "/dashboard", icon: LayoutDashboard, labelKey: "nav.dashboard" },
	{ url: "/hub", icon: Compass, labelKey: "nav.hub" },
	{ url: "/policies", icon: FileText, labelKey: "nav.policies" },
	{ url: "/courses", icon: GraduationCap, labelKey: "nav.courses" },
	{ url: "/files", icon: FolderOpen, labelKey: "nav.files" },
	{ url: "/calendar", icon: CalendarDays, labelKey: "nav.calendar" },
];

const MANAGER_ITEMS: NavItem[] = [
	{ url: "/users", icon: Users, labelKey: "nav.users" },
	{ url: "/reports", icon: BarChart3, labelKey: "nav.reports" },
	{ url: "/settings", icon: Settings, labelKey: "nav.settings" },
];

const PROFILE_ITEM: NavItem = {
	url: "/my-profile",
	icon: UserCircle,
	labelKey: "nav.my_profile",
};

const PRIMARY_TABS: NavItem[] = [
	CORE_ITEMS[0],
	CORE_ITEMS[1],
	CORE_ITEMS[4],
	CORE_ITEMS[2],
];

export function canManage(role: Role) {
	return role === "manager" || role === "admin";
}

function isActivePath(location: string, url: string) {
	return url === "/"
		? location === "/"
		: location === url || location.startsWith(`${url}/`);
}

function initials(name: string) {
	return (
		name
			.split(/\s+/)
			.slice(0, 2)
			.map((word) => word[0] ?? "")
			.join("")
			.toUpperCase() || "A"
	);
}

function OrgMark({ org, size = 28 }: { org: Membership; size?: number }) {
	const style = { width: size, height: size };
	return org.logoUrl ? (
		<img
			src={org.logoUrl}
			alt=""
			style={style}
			className="shrink-0 rounded-full border border-border object-cover"
		/>
	) : (
		<span
			style={style}
			aria-hidden="true"
			className="grid shrink-0 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground"
		>
			{initials(org.name)}
		</span>
	);
}

function useOrgSwitch() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (organizationId: number) =>
			api("/organizations/switch", {
				method: "POST",
				body: { organizationId },
			}),
		// A deliberate boundary: nothing from the previous organization may stay
		// on screen or in the cache.
		onSuccess: () => {
			queryClient.clear();
			window.location.assign("/");
		},
	});
}

function OrgSwitcher({ me, org }: { me: Me; org: Membership }) {
	const { t } = useI18n();
	const [open, setOpen] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);
	const switchOrg = useOrgSwitch();

	useEffect(() => {
		if (!open) return;
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") setOpen(false);
		};
		const onPointerDown = (event: PointerEvent) => {
			if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
		};
		document.addEventListener("keydown", onKeyDown);
		document.addEventListener("pointerdown", onPointerDown);
		return () => {
			document.removeEventListener("keydown", onKeyDown);
			document.removeEventListener("pointerdown", onPointerDown);
		};
	}, [open]);

	if (me.memberships.length < 2) {
		return (
			<div className="flex min-h-9 items-center gap-2.5">
				<OrgMark org={org} />
				<span className="truncate text-[13px] font-semibold">{org.name}</span>
			</div>
		);
	}

	return (
		<div ref={containerRef} className="relative">
			<button
				type="button"
				aria-expanded={open}
				aria-label={`${t("org.switch")}: ${org.name}`}
				onClick={() => setOpen((value) => !value)}
				className="flex min-h-9 w-full items-center gap-2.5 rounded-md px-1 text-left hover:bg-muted"
			>
				<OrgMark org={org} />
				<span className="flex-1 truncate text-[13px] font-semibold">{org.name}</span>
				<ChevronsUpDown size={14} className="shrink-0 text-muted-foreground" aria-hidden="true" />
			</button>
			{open && (
				<ul className="absolute inset-x-0 top-full z-30 mt-1 rounded-md border border-border bg-card p-1 shadow-lg">
					{me.memberships.map((membership) => (
						<li key={membership.organizationId}>
							<button
								type="button"
								onClick={() => {
									setOpen(false);
									if (membership.organizationId !== org.organizationId) {
										switchOrg.mutate(membership.organizationId);
									}
								}}
								className="flex min-h-9 w-full items-center gap-2 rounded px-2 text-left text-[13px] hover:bg-muted"
							>
								<OrgMark org={membership} size={20} />
								<span className="flex-1 truncate">{membership.name}</span>
								{membership.organizationId === org.organizationId && (
									<Check size={14} className="shrink-0 text-selected-foreground" aria-label="Current" />
								)}
							</button>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}

function TrialBanner({ org }: { org: Membership }) {
	const { t } = useI18n();
	const [now] = useState(() => Date.now());
	if (org.subscriptionStatus !== "trial" || !org.trialEndDate) return null;
	const days = Math.max(
		0,
		Math.ceil((new Date(org.trialEndDate).getTime() - now) / 86_400_000),
	);
	const tone =
		days <= 3
			? "bg-danger-surface text-danger-foreground"
			: "bg-warning-surface text-warning-foreground";
	return (
		<p className={`mx-3 mt-3 rounded-md px-3 py-2 text-xs font-medium ${tone}`}>
			{t("trial.days_remaining", { days })}
		</p>
	);
}

function SidebarContent({
	me,
	org,
	onNavigate,
}: {
	me: Me;
	org: Membership;
	onNavigate?: () => void;
}) {
	const { t } = useI18n();
	const [location] = useLocation();
	const queryClient = useQueryClient();
	const items = canManage(org.role)
		? [...CORE_ITEMS, ...MANAGER_ITEMS]
		: [...CORE_ITEMS, PROFILE_ITEM];

	async function signOut() {
		await authClient.signOut();
		queryClient.clear();
		window.location.assign("/sign-in");
	}

	return (
		<>
			<div className="border-b border-border px-3 py-2.5">
				<OrgSwitcher me={me} org={org} />
			</div>
			<TrialBanner org={org} />
			<nav aria-label={t("shell.main_nav")} className="flex-1 overflow-y-auto p-2">
				<ul className="flex flex-col gap-0.5">
					{items.map((item) => {
						const active = isActivePath(location, item.url);
						return (
							<li key={item.url}>
								<Link
									href={item.url}
									onClick={onNavigate}
									aria-current={active ? "page" : undefined}
									className={`flex min-h-9 items-center gap-2.5 rounded-md px-3 text-[13px] no-underline transition-colors ${
										active
											? "bg-primary font-medium text-primary-foreground"
											: "text-muted-foreground hover:bg-muted hover:text-foreground"
									}`}
								>
									<item.icon size={15} aria-hidden="true" className="shrink-0" />
									{t(item.labelKey)}
								</Link>
							</li>
						);
					})}
				</ul>
			</nav>
			<div className="flex items-center gap-2.5 border-t border-border px-3 py-3">
				<span
					aria-hidden="true"
					className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground"
				>
					{initials(me.user.name)}
				</span>
				<div className="min-w-0 flex-1 leading-tight">
					<p className="truncate text-xs font-medium">{me.user.name}</p>
					<p className="truncate text-[11px] text-muted-foreground">{me.user.email}</p>
				</div>
				<button
					type="button"
					onClick={signOut}
					aria-label={t("nav.logout")}
					title={t("nav.logout")}
					className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
				>
					<LogOut size={15} aria-hidden="true" />
				</button>
			</div>
		</>
	);
}

function useTheme() {
	const [dark, setDark] = useState(() =>
		document.documentElement.classList.contains("dark"),
	);
	function toggle() {
		const next = !dark;
		document.documentElement.classList.toggle("dark", next);
		try {
			localStorage.setItem("aidnova_theme", next ? "dark" : "light");
		} catch {
			// The choice just won't persist, for example in a private window.
		}
		setDark(next);
	}
	return { dark, toggle };
}

export function Header({ onOpenMenu }: { onOpenMenu?: () => void }) {
	const { t } = useI18n();
	const { dark, toggle } = useTheme();
	const iconButton =
		"grid size-9 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground";
	return (
		<header className="sticky top-0 z-20 flex h-12 shrink-0 items-center gap-1 border-b border-border bg-background/85 px-2 backdrop-blur md:px-4">
			{onOpenMenu && (
				<button
					type="button"
					onClick={onOpenMenu}
					aria-label={t("shell.menu")}
					className={`${iconButton} md:hidden`}
				>
					<Menu size={18} aria-hidden="true" />
				</button>
			)}
			<div className="flex-1" />
			<LanguageSwitch />
			<button
				type="button"
				onClick={toggle}
				aria-label={dark ? t("shell.theme_light") : t("shell.theme_dark")}
				className={iconButton}
			>
				{dark ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
			</button>
			{onOpenMenu && (
				<Link
					href="/notifications"
					aria-label={t("shell.notifications")}
					className={iconButton}
				>
					<Bell size={16} aria-hidden="true" />
				</Link>
			)}
		</header>
	);
}

function MobileBottomNav({ role }: { role: Role }) {
	const { t } = useI18n();
	const [location] = useLocation();
	const [moreOpen, setMoreOpen] = useState(false);

	useEffect(() => {
		if (!moreOpen) return;
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") setMoreOpen(false);
		};
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, [moreOpen]);

	if (/^\/courses\/[^/]+\/lessons\/[^/]+/.test(location)) return null;

	const moreItems = [
		CORE_ITEMS[3],
		CORE_ITEMS[6],
		CORE_ITEMS[5],
		...(canManage(role) ? MANAGER_ITEMS : [PROFILE_ITEM]),
	];
	const moreActive =
		moreOpen || !PRIMARY_TABS.some((tab) => isActivePath(location, tab.url));
	const tabClass = (active: boolean) =>
		`flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium no-underline ${
			active ? "text-selected-foreground" : "text-muted-foreground"
		}`;
	const iconWrap = (active: boolean) =>
		`grid h-7 w-9 place-items-center rounded-lg ${active ? "bg-selected" : ""}`;

	return (
		<>
			{moreOpen && (
				<>
					<button
						type="button"
						aria-label={t("common.close")}
						onClick={() => setMoreOpen(false)}
						className="fixed inset-0 z-30 bg-black/30 md:hidden"
					/>
					<div
						className="fixed inset-x-0 z-40 rounded-t-2xl border-t border-border bg-card p-3 shadow-lg md:hidden"
						style={{ bottom: "calc(3.5rem + env(safe-area-inset-bottom))" }}
					>
						<ul className="grid grid-cols-4 gap-1">
							{moreItems.map((item) => (
								<li key={item.url}>
									<Link
										href={item.url}
										onClick={() => setMoreOpen(false)}
										className={`flex min-h-16 flex-col items-center justify-center gap-1.5 rounded-xl text-center text-[11px] font-medium no-underline ${
											isActivePath(location, item.url)
												? "bg-selected text-selected-foreground"
												: "text-foreground"
										}`}
									>
										<item.icon size={20} aria-hidden="true" />
										{t(item.labelKey)}
									</Link>
								</li>
							))}
						</ul>
					</div>
				</>
			)}
			<nav
				aria-label={t("shell.main_nav")}
				className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-background md:hidden"
				style={{
					height: "calc(3.5rem + env(safe-area-inset-bottom))",
					paddingBottom: "env(safe-area-inset-bottom)",
				}}
			>
				{PRIMARY_TABS.map((tab) => {
					const active = !moreOpen && isActivePath(location, tab.url);
					return (
						<Link
							key={tab.url}
							href={tab.url}
							onClick={() => setMoreOpen(false)}
							aria-current={active ? "page" : undefined}
							className={tabClass(active)}
						>
							<span className={iconWrap(active)}>
								<tab.icon size={18} aria-hidden="true" />
							</span>
							<span className="max-w-full truncate px-0.5">{t(tab.labelKey)}</span>
						</Link>
					);
				})}
				<button
					type="button"
					aria-expanded={moreOpen}
					onClick={() => setMoreOpen((value) => !value)}
					className={tabClass(moreActive)}
				>
					<span className={iconWrap(moreActive)}>
						<MoreHorizontal size={18} aria-hidden="true" />
					</span>
					{t("shell.more")}
				</button>
			</nav>
		</>
	);
}

export function WorkspaceShell({
	me,
	org,
	children,
}: {
	me: Me;
	org: Membership;
	children: ReactNode;
}) {
	const { t } = useI18n();
	const [drawerOpen, setDrawerOpen] = useState(false);
	const [location] = useLocation();
	const isLesson = /^\/courses\/[^/]+\/lessons\/[^/]+/.test(location);

	useEffect(() => {
		if (!drawerOpen) return;
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") setDrawerOpen(false);
		};
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, [drawerOpen]);

	return (
		<div className="flex h-dvh overflow-hidden">
			<aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-card md:flex">
				<SidebarContent me={me} org={org} />
			</aside>

			{drawerOpen && (
				<div className="fixed inset-0 z-50 md:hidden">
					<button
						type="button"
						aria-label={t("common.close")}
						onClick={() => setDrawerOpen(false)}
						className="absolute inset-0 bg-black/30"
					/>
					<aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col bg-card shadow-lg">
						<button
							type="button"
							aria-label={t("common.close")}
							onClick={() => setDrawerOpen(false)}
							className="absolute -right-11 top-2 grid size-9 place-items-center rounded-md bg-card text-foreground"
						>
							<X size={18} aria-hidden="true" />
						</button>
						<SidebarContent
							me={me}
							org={org}
							onNavigate={() => setDrawerOpen(false)}
						/>
					</aside>
				</div>
			)}

			<div className="flex min-w-0 flex-1 flex-col">
				<Header onOpenMenu={() => setDrawerOpen(true)} />
				<main className={`min-h-0 flex-1 overflow-auto ${isLesson ? "" : "pb-16 md:pb-0"}`}>
					{children}
				</main>
			</div>

			<MobileBottomNav role={org.role} />
		</div>
	);
}
