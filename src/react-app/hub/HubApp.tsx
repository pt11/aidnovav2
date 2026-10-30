import { Component, useEffect, type ReactNode } from "react";
import {
	QueryClient,
	QueryClientProvider,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { CircleAlert, Hammer, Lock, SearchX } from "lucide-react";
import { Redirect, Route, Switch, useLocation } from "wouter";
import { api, authClient, useMe, type Me, type Membership } from "./api";
import "./hub.css";
import { I18nProvider, useI18n } from "./i18n";
import {
	ForgotPasswordPage,
	ResetPasswordPage,
	SignInPage,
	SignUpPage,
} from "./pages/auth";
import { AnnouncementsPage } from "./pages/Announcements";
import { CreateOrganizationPage } from "./pages/CreateOrganization";
import { DashboardPage } from "./pages/Dashboard";
import { FilesPage } from "./pages/Files";
import { HubPage } from "./pages/Hub";
import { InvitePage } from "./pages/Invite";
import { MyProfilePage } from "./pages/MyProfile";
import { PoliciesPage } from "./pages/Policies";
import { PolicyDetailPage } from "./pages/PolicyDetail";
import { SettingsPage } from "./pages/Settings";
import { UsersPage } from "./pages/Users";
import { canManage, Header, WorkspaceShell } from "./Shell";
import { buttonClass, LOGO, StartupScreen, StatePanel } from "./ui";

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: 30_000,
			refetchOnWindowFocus: false,
			retry: 1,
		},
	},
});

try {
	if (localStorage.getItem("aidnova_theme") === "dark") {
		document.documentElement.classList.add("dark");
	}
} catch {
	// Falls back to the light theme.
}

class ErrorBoundary extends Component<
	{ children: ReactNode },
	{ failed: boolean }
> {
	state = { failed: false };

	static getDerivedStateFromError() {
		return { failed: true };
	}

	render() {
		if (!this.state.failed) return this.props.children;
		return (
			<div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-4 text-center">
				<h1 className="text-lg font-semibold">
					Something went wrong. Please try again.
				</h1>
				<button
					type="button"
					className={buttonClass("outline")}
					onClick={() => window.location.reload()}
				>
					Try again
				</button>
			</div>
		);
	}
}

function LaterPage({ labelKey }: { labelKey: string }) {
	const { t } = useI18n();
	return (
		<StatePanel
			icon={Hammer}
			title={t("page.later_title")}
			description={t("page.later_desc", { page: t(labelKey) })}
		/>
	);
}

function NoAccessPage() {
	const { t } = useI18n();
	return (
		<StatePanel
			icon={Lock}
			title={t("page.no_access_title")}
			description={t("page.no_access_desc")}
		/>
	);
}

function NotFoundPage() {
	const { t } = useI18n();
	return (
		<StatePanel
			icon={SearchX}
			title={t("page.not_found_title")}
			description={t("page.not_found_desc")}
		/>
	);
}

function BlockedPage({ me, org }: { me: Me; org: Membership }) {
	const { t } = useI18n();
	const queryClient = useQueryClient();
	const others = me.memberships.filter(
		(membership) =>
			membership.organizationId !== org.organizationId &&
			membership.access === "ok",
	);

	async function switchTo(organizationId: number) {
		await api("/organizations/switch", {
			method: "POST",
			body: { organizationId },
		});
		queryClient.clear();
		window.location.assign("/");
	}

	async function signOut() {
		await authClient.signOut();
		queryClient.clear();
		window.location.assign("/sign-in");
	}

	return (
		<main className="flex min-h-dvh items-center justify-center">
			<StatePanel
				icon={Lock}
				title={
					org.access === "trial_expired"
						? t("trial.expired_title")
						: t("org.blocked_title")
				}
				description={
					org.access === "trial_expired"
						? t("org.trial_ended_desc")
						: t("org.blocked_desc")
				}
				action={
					<div className="flex flex-col items-center gap-2">
						<a href="mailto:helloaidnova@gmail.com" className={buttonClass()}>
							{t("org.contact")}
						</a>
						{others.map((other) => (
							<button
								key={other.organizationId}
								type="button"
								className={buttonClass("outline")}
								onClick={() => switchTo(other.organizationId)}
							>
								{t("org.switch")}: {other.name}
							</button>
						))}
						<button type="button" className={buttonClass("ghost")} onClick={signOut}>
							{t("nav.logout")}
						</button>
					</div>
				}
			/>
		</main>
	);
}

function Workspace({ me, org }: { me: Me; org: Membership }) {
	const manager = canManage(org.role);
	const managerRoute = (labelKey: string) =>
		manager ? <LaterPage labelKey={labelKey} /> : <NoAccessPage />;

	return (
		<WorkspaceShell me={me} org={org}>
			<Switch>
				<Route path="/">
					<AnnouncementsPage canManage={manager} />
				</Route>
				<Route path="/dashboard">
					<DashboardPage me={me} org={org} />
				</Route>
				<Route path="/hub">
					<HubPage />
				</Route>
				<Route path="/policies">
					<PoliciesPage canManage={manager} />
				</Route>
				<Route path="/policies/:id">
					{({ id }) => <PolicyDetailPage key={id} id={id} canManage={manager} />}
				</Route>
				<Route path="/courses">
					<LaterPage labelKey="nav.courses" />
				</Route>
				<Route path="/files">
					<FilesPage canManage={manager} />
				</Route>
				<Route path="/calendar">
					<LaterPage labelKey="nav.calendar" />
				</Route>
				<Route path="/notifications">
					<LaterPage labelKey="shell.notifications" />
				</Route>
				<Route path="/my-profile">
					<MyProfilePage me={me} org={org} />
				</Route>
				<Route path="/users">
					{manager ? <UsersPage me={me} role={org.role} /> : <NoAccessPage />}
				</Route>
				<Route path="/reports">{managerRoute("nav.reports")}</Route>
				<Route path="/settings">
					{manager ? <SettingsPage org={org} /> : <NoAccessPage />}
				</Route>
				{/* Signed-in people arriving on an auth address go to the workspace. */}
				<Route path="/sign-in">
					<Redirect to="/" replace />
				</Route>
				<Route path="/sign-up">
					<Redirect to="/" replace />
				</Route>
				<Route>
					<NotFoundPage />
				</Route>
			</Switch>
		</WorkspaceShell>
	);
}

function SuperAdminPage() {
	const { t } = useI18n();
	const stats = useQuery({
		queryKey: ["superadmin-stats"],
		queryFn: () =>
			api<{ organizations: number; users: number }>("/superadmin/stats"),
	});

	return (
		<div className="flex h-dvh flex-col">
			<Header />
			<main className="mx-auto w-full max-w-5xl flex-1 overflow-auto p-4 md:p-6">
				<div className="flex items-center gap-2">
					<img src={LOGO} alt="" width="28" height="28" className="rounded-[5px]" />
					<h1 className="text-2xl font-semibold tracking-tight">
						{t("superadmin.title")}
					</h1>
				</div>
				{stats.isError && (
					<div className="mt-6">
						<StatePanel icon={CircleAlert} title={t("error.load")} />
					</div>
				)}
				<dl className="mt-6 grid gap-4 sm:grid-cols-2">
					{[
						{ label: t("superadmin.organizations"), value: stats.data?.organizations },
						{ label: t("superadmin.users"), value: stats.data?.users },
					].map((stat) => (
						<div key={stat.label} className="rounded-card border border-border bg-card p-5">
							<dt className="text-sm text-muted-foreground">{stat.label}</dt>
							<dd className="mt-1 text-3xl font-semibold">{stat.value ?? "–"}</dd>
						</div>
					))}
				</dl>
			</main>
		</div>
	);
}

function Gate() {
	const { t } = useI18n();
	const me = useMe();
	const [location] = useLocation();

	useEffect(() => {
		document.title = "AidNova - Policy & Learning Hub";
	}, []);

	if (me.isPending) return <StartupScreen />;

	if (me.isError) {
		return (
			<main className="flex min-h-dvh items-center justify-center">
				<StatePanel
					icon={CircleAlert}
					title={t("error.load")}
					action={
						<button
							type="button"
							className={buttonClass("outline")}
							onClick={() => me.refetch()}
						>
							{t("common.retry")}
						</button>
					}
				/>
			</main>
		);
	}

	if (location === "/invite") return <InvitePage me={me.data ?? null} />;

	if (!me.data) {
		return (
			<Switch>
				<Route path="/sign-in" component={SignInPage} />
				<Route path="/sign-up" component={SignUpPage} />
				<Route path="/forgot-password" component={ForgotPasswordPage} />
				<Route path="/reset-password" component={ResetPasswordPage} />
				<Route>
					<Redirect to="/sign-in" replace />
				</Route>
			</Switch>
		);
	}

	if (location === "/superadmin" || location.startsWith("/superadmin/")) {
		return me.data.user.isSuperAdmin ? (
			<SuperAdminPage />
		) : (
			<main className="flex min-h-dvh items-center justify-center">
				<NoAccessPage />
			</main>
		);
	}

	const org = me.data.memberships.find(
		(membership) => membership.organizationId === me.data?.activeOrganizationId,
	);

	if (!org) {
		return me.data.user.isSuperAdmin ? (
			<Redirect to="/superadmin" replace />
		) : (
			<CreateOrganizationPage />
		);
	}

	if (org.access !== "ok") return <BlockedPage me={me.data} org={org} />;

	return <Workspace me={me.data} org={org} />;
}

export default function HubApp() {
	return (
		<ErrorBoundary>
			<QueryClientProvider client={queryClient}>
				<I18nProvider>
					<Gate />
				</I18nProvider>
			</QueryClientProvider>
		</ErrorBoundary>
	);
}
