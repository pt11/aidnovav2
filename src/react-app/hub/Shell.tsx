import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	Award,
	BarChart3,
	Bell,
	CalendarDays,
	Check,
	ChevronsUpDown,
	Compass,
	Search,
	Sparkles,
	FileText,
	FolderKanban,
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
import { Avatar, LanguageSwitch } from "./ui";

interface NavItem {
	url: string;
	icon: LucideIcon;
	labelKey: string;
	badge?: "pendingPolicies";
}

const CORE_ITEMS: NavItem[] = [
	{ url: "/", icon: Megaphone, labelKey: "nav.announcements" },
	{ url: "/dashboard", icon: LayoutDashboard, labelKey: "nav.dashboard" },
	{ url: "/hub", icon: Compass, labelKey: "nav.hub" },
	{
		url: "/policies",
		icon: FileText,
		labelKey: "nav.policies",
		badge: "pendingPolicies",
	},
	{ url: "/courses", icon: GraduationCap, labelKey: "nav.courses" },
	{ url: "/files", icon: FolderOpen, labelKey: "nav.files" },
	{ url: "/calendar", icon: CalendarDays, labelKey: "nav.calendar" },
];

// Optional modules only appear in the menu once they're on for the organization.
const MODULE_ITEMS: { key: string; item: NavItem }[] = [
	{ key: "projects", item: { url: "/projects", icon: FolderKanban, labelKey: "nav.projects" } },
	{ key: "capacity_building", item: { url: "/capacity", icon: Award, labelKey: "nav.capacity" } },
];

function moduleItems(activeModules: string[]) {
	return MODULE_ITEMS.filter(({ key }) => activeModules.includes(key)).map(({ item }) => item);
}

const MANAGER_ITEMS: NavItem[] = [
	{ url: "/users", icon: Users, labelKey: "nav.users" },
	{ url: "/reports", icon: BarChart3, labelKey: "nav.reports" },
	{ url: "/settings", icon: Settings, labelKey: "nav.settings" },
];

const PROFILE_ITEM: NavItem = {
	url: "/settings/profile",
	icon: UserCircle,
	labelKey: "nav.my_profile",
};

const PRIMARY_TABS: NavItem[] = [
	{ ...CORE_ITEMS[0], labelKey: "nav.home" },
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
			className="shrink-0 rounded-md border border-border object-cover"
		/>
	) : (
		<span
			style={style}
			aria-hidden="true"
			className="grid shrink-0 place-items-center rounded-md bg-foreground text-xs font-semibold text-background"
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

function OrgLabel({ org }: { org: Membership }) {
	const { t } = useI18n();
	return (
		<span className="min-w-0 flex-1 leading-tight">
			<span className="block truncate font-semibold">{org.name}</span>
			<span className="block truncate text-xs text-muted-foreground">
				{t(`role.${org.role}`)}
			</span>
		</span>
	);
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
			<div className="flex items-center gap-2.5 rounded-[9px] border border-border bg-background px-2.5 py-2">
				<OrgMark org={org} size={32} />
				<OrgLabel org={org} />
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
				className="flex w-full items-center gap-2.5 rounded-[9px] border border-border bg-background px-2.5 py-2 text-left hover:bg-muted"
			>
				<OrgMark org={org} size={32} />
				<OrgLabel org={org} />
				<ChevronsUpDown size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />
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

const TRIAL_DAYS = 14;

function TrialCard({ org }: { org: Membership }) {
	const { t } = useI18n();
	const [now] = useState(() => Date.now());
	if (org.subscriptionStatus !== "trial" || !org.trialEndDate) return null;
	const days = Math.max(
		0,
		Math.ceil((new Date(org.trialEndDate).getTime() - now) / 86_400_000),
	);
	const percent = Math.min(100, Math.round((days / TRIAL_DAYS) * 100));
	return (
		<div className="rounded-[9px] border border-border p-3">
			<div className="flex justify-between gap-2 text-xs">
				<span className="font-semibold">{t("shell.free_trial")}</span>
				<span className={days <= 3 ? "font-semibold text-danger-foreground" : "text-muted-foreground"}>
					{t("trial.days_left", { days })}
				</span>
			</div>
			<div
				role="progressbar"
				aria-valuenow={percent}
				aria-valuemin={0}
				aria-valuemax={100}
				aria-label={t("shell.free_trial")}
				className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
			>
				<div
					className={`h-full rounded-full ${days <= 3 ? "bg-destructive" : "bg-primary"}`}
					style={{ width: `${percent}%` }}
				/>
			</div>
			{canManage(org.role) && (
				<Link href="/settings/plan" className="mt-2 block text-xs font-medium text-selected-foreground no-underline hover:underline">
					{t("shell.request_upgrade")} →
				</Link>
			)}
		</div>
	);
}

interface NavGroup {
	labelKey: string;
	items: NavItem[];
}

function navGroups(role: Role, activeModules: string[]): NavGroup[] {
	const [announcements, dashboard, hub, policies, courses, files, calendar] = CORE_ITEMS;
	return [
		{ labelKey: "shell.workspace", items: [dashboard, announcements, hub] },
		{ labelKey: "shell.content", items: [...moduleItems(activeModules), policies, courses, files, calendar] },
		canManage(role)
			? { labelKey: "shell.manage", items: MANAGER_ITEMS }
			: { labelKey: "shell.account", items: [PROFILE_ITEM] },
	];
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
	const dashboard = useQuery({
		queryKey: ["dashboard"],
		queryFn: () => api<{ pendingPolicies: unknown[] }>("/dashboard"),
	});
	const pendingPolicies = dashboard.data?.pendingPolicies.length ?? 0;

	async function signOut() {
		await authClient.signOut();
		queryClient.clear();
		window.location.assign("/sign-in");
	}

	return (
		<>
			<div className="px-3 pt-3.5">
				<OrgSwitcher me={me} org={org} />
			</div>
			<nav
				aria-label={t("shell.main_nav")}
				className="flex-1 overflow-y-auto px-3 pt-4 pb-2"
			>
				{navGroups(org.role, me.activeModules).map((group, index) => (
					<div key={group.labelKey} className={index > 0 ? "mt-3.5" : ""}>
						<p className="px-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
							{t(group.labelKey)}
						</p>
						<ul className="flex flex-col gap-0.5">
							{group.items.map((item) => {
								const active = isActivePath(location, item.url);
								const badge = item.badge === "pendingPolicies" ? pendingPolicies : 0;
								return (
									<li key={item.url}>
										<Link
											href={item.url}
											onClick={onNavigate}
											aria-current={active ? "page" : undefined}
											className={`flex min-h-9 items-center gap-2.5 rounded-md px-2.5 no-underline transition-colors ${
												active
													? "bg-primary font-medium text-primary-foreground"
													: "text-foreground hover:bg-muted"
											}`}
										>
											<item.icon size={18} aria-hidden="true" className="shrink-0" />
											<span className="min-w-0 flex-1 truncate">{t(item.labelKey)}</span>
											{badge > 0 && (
												<span className="rounded-full bg-destructive px-[7px] text-[11px] font-semibold text-primary-foreground">
													{badge}
												</span>
											)}
										</Link>
									</li>
								);
							})}
						</ul>
					</div>
				))}
			</nav>
			<div className="flex flex-col gap-3 px-3 pt-2 pb-3">
				{me.user.isSuperAdmin && (
					<Link
						href="/superadmin"
						className="rounded-[9px] border border-border px-3 py-2 text-xs font-semibold text-foreground no-underline hover:bg-muted"
					>
						{t("shell.platform_admin")}
					</Link>
				)}
				<TrialCard org={org} />
				<div className="flex items-center gap-2.5 p-1">
					<Avatar name={me.user.name} photoUrl={org.photoUrl} />
					<div className="min-w-0 flex-1 leading-tight">
						<p className="truncate font-semibold">{me.user.name}</p>
						<p className="truncate text-xs text-muted-foreground">{me.user.email}</p>
					</div>
					<button
						type="button"
						onClick={signOut}
						aria-label={t("nav.logout")}
						title={t("nav.logout")}
						className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
					>
						<LogOut size={16} aria-hidden="true" />
					</button>
				</div>
			</div>
		</>
	);
}

export type ThemeMode = "light" | "dark" | "system";

function readThemeMode(): ThemeMode {
	try {
		const stored = localStorage.getItem("aidnova_theme");
		return stored === "dark" || stored === "system" ? stored : "light";
	} catch {
		return "light";
	}
}

function deviceIsDark() {
	return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function useTheme() {
	const [mode, setModeState] = useState(readThemeMode);
	const [dark, setDarkState] = useState(() =>
		document.documentElement.classList.contains("dark"),
	);

	// The header button and Settings stay in step, and "match device" follows the device.
	useEffect(() => {
		const apply = () => {
			const next = readThemeMode();
			const isDark = next === "dark" || (next === "system" && deviceIsDark());
			document.documentElement.classList.toggle("dark", isDark);
			setModeState(next);
			setDarkState(isDark);
		};
		const media = window.matchMedia("(prefers-color-scheme: dark)");
		media.addEventListener("change", apply);
		window.addEventListener("aidnova-theme", apply);
		return () => {
			media.removeEventListener("change", apply);
			window.removeEventListener("aidnova-theme", apply);
		};
	}, []);

	function setMode(next: ThemeMode) {
		try {
			localStorage.setItem("aidnova_theme", next);
		} catch {
			// The choice just won't persist, for example in a private window.
		}
		document.documentElement.classList.toggle(
			"dark",
			next === "dark" || (next === "system" && deviceIsDark()),
		);
		setModeState(next);
		setDarkState(document.documentElement.classList.contains("dark"));
		window.dispatchEvent(new Event("aidnova-theme"));
	}
	return { mode, dark, setMode, toggle: () => setMode(dark ? "light" : "dark") };
}

function HeaderSearch() {
	const { t } = useI18n();
	const [, navigate] = useLocation();
	const [query, setQuery] = useState("");
	const input = useRef<HTMLInputElement>(null);
	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
				event.preventDefault();
				input.current?.focus();
			}
		};
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, []);
	function submit(event: FormEvent) {
		event.preventDefault();
		navigate(`/hub?q=${encodeURIComponent(query.trim())}`);
	}
	return (
		<form role="search" onSubmit={submit} className="hidden max-w-[480px] flex-1 md:block">
			<label className="flex h-9 items-center gap-2 rounded-md border border-border bg-background px-2.5 text-muted-foreground">
				<Search size={16} aria-hidden="true" className="shrink-0" />
				<span className="sr-only">{t("hub.search_placeholder")}</span>
				<input
					ref={input}
					type="search"
					placeholder={t("hub.search_placeholder")}
					value={query}
					onChange={(event) => setQuery(event.target.value)}
					className="min-w-0 flex-1 bg-transparent text-foreground outline-none"
				/>
				<kbd className="hidden rounded border border-border bg-card px-1.5 font-sans text-[11px] text-muted-foreground lg:block">
					⌘K
				</kbd>
			</label>
		</form>
	);
}

export function Header({ onOpenMenu }: { onOpenMenu?: () => void }) {
	const { t } = useI18n();
	const { dark, toggle } = useTheme();
	const iconButton =
		"grid size-9 place-items-center rounded-md text-foreground hover:bg-muted";
	return (
		<header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-1.5 border-b border-border bg-card/85 px-2 backdrop-blur md:gap-3 md:px-6">
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
			{onOpenMenu && <HeaderSearch />}
			<div className="ml-auto flex items-center gap-1.5">
				{onOpenMenu && (
					<Link
						href="/hub"
						className="hidden h-9 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-[13px] font-medium text-foreground no-underline hover:bg-muted lg:inline-flex"
					>
						<Sparkles size={16} aria-hidden="true" className="text-accent" />
						{t("shell.ask_aidnova")}
					</Link>
				)}
				<LanguageSwitch />
				<button
					type="button"
					onClick={toggle}
					aria-label={dark ? t("shell.theme_light") : t("shell.theme_dark")}
					className={iconButton}
				>
					{dark ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
				</button>
				{onOpenMenu && (
					<Link
						href="/notifications"
						aria-label={t("shell.notifications")}
						className={iconButton}
					>
						<Bell size={18} aria-hidden="true" />
					</Link>
				)}
			</div>
		</header>
	);
}

function MobileBottomNav({ role, activeModules }: { role: Role; activeModules: string[] }) {
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
		...moduleItems(activeModules),
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
				className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
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
			{!isLesson && (
			<aside className="hidden w-[248px] shrink-0 flex-col border-r border-border bg-card md:flex">
				<SidebarContent me={me} org={org} />
			</aside>
			)}

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
				{!isLesson && <Header onOpenMenu={() => setDrawerOpen(true)} />}
				<main className={`relative min-h-0 flex-1 ${isLesson ? "overflow-hidden" : "overflow-auto pb-16 md:pb-0"}`}>
					{children}
				</main>
			</div>

			<MobileBottomNav role={org.role} activeModules={me.activeModules} />
		</div>
	);
}
