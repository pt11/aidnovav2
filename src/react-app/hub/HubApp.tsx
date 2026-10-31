import { Component, useEffect, type ReactNode } from "react";
import {
	QueryClient,
	QueryClientProvider,
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
import { PoliciesPage } from "./pages/Policies";
import { PolicyDetailPage } from "./pages/PolicyDetail";
import { PolicyEditorPage } from "./pages/PolicyEditor";
import {
	SettingsDepartmentsPage,
	SettingsGeneralPage,
	SettingsPlanPage,
	SettingsProfilePage,
	SettingsSecurityPage,
	SettingsStaffSignInPage,
} from "./pages/SettingsArea";
import {
	SuperModulesPage,
	SuperOrganizationsPage,
	SuperOverviewPage,
	SuperPlansPage,
	SuperStoragePage,
	SuperUsersPage,
} from "./pages/SuperAdmin";
import { CourseBuilderPage, CourseLearnersPage } from "./pages/CourseBuilder";
import {
	CertificatePage,
	CourseLessonPage,
	CourseOverviewPage,
	CourseQuizPage,
} from "./pages/CourseLearn";
import { CoursesPage } from "./pages/Courses";
import { LessonEditorPage } from "./pages/LessonEditor";
import { QuizBuilderPage } from "./pages/QuizBuilder";
import { ReportsPage } from "./pages/Reports";
import { UsersPage } from "./pages/Users";
import { CalendarPage } from "./pages/Calendar";
import { SettingsModulesPage } from "./pages/SettingsModules";
import { UserProfilePage } from "./pages/UserProfile";
import { canManage, WorkspaceShell } from "./Shell";
import { buttonClass, StartupScreen, StatePanel } from "./ui";

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
	const theme = localStorage.getItem("aidnova_theme");
	if (
		theme === "dark" ||
		(theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)
	) {
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

	return (
		<WorkspaceShell me={me} org={org}>
			<Switch>
				<Route path="/">
					<AnnouncementsPage canManage={manager} />
				</Route>
				<Route path="/dashboard">
					<DashboardPage me={me} />
				</Route>
				<Route path="/hub">
					<HubPage org={org} />
				</Route>
				<Route path="/policies">
					<PoliciesPage canManage={manager} />
				</Route>
				<Route path="/policies/new">
					{manager ? <PolicyEditorPage /> : <NoAccessPage />}
				</Route>
				<Route path="/policies/:id/edit">
					{({ id }) =>
						manager ? <PolicyEditorPage key={id} id={id} /> : <NoAccessPage />
					}
				</Route>
				<Route path="/policies/:id">
					{({ id }) => <PolicyDetailPage key={id} id={id} canManage={manager} />}
				</Route>
				<Route path="/courses">
					<CoursesPage canManage={manager} />
				</Route>
				<Route path="/courses/:id/manage/lessons/:lessonId">
					{({ id, lessonId }) =>
						manager ? <CourseBuilderPage key={id} id={id} lessonId={lessonId} /> : <NoAccessPage />
					}
				</Route>
				<Route path="/courses/:id/manage">
					{({ id }) => (manager ? <CourseBuilderPage key={id} id={id} /> : <NoAccessPage />)}
				</Route>
				<Route path="/courses/:id/learners">
					{({ id }) => (manager ? <CourseLearnersPage key={id} id={id} /> : <NoAccessPage />)}
				</Route>
				<Route path="/courses/:id/quiz/edit">
					{({ id }) => (manager ? <QuizBuilderPage key={id} id={id} /> : <NoAccessPage />)}
				</Route>
				<Route path="/courses/:id/quiz">
					{({ id }) => <CourseQuizPage key={id} id={id} />}
				</Route>
				<Route path="/courses/:id/lessons/:lessonId/edit">
					{({ id, lessonId }) =>
						manager ? <LessonEditorPage key={lessonId} id={id} lessonId={lessonId} /> : <NoAccessPage />
					}
				</Route>
				<Route path="/courses/:id/lessons/:lessonId">
					{({ id, lessonId }) => (
						<CourseLessonPage key={`${id}-${lessonId}`} id={id} lessonId={lessonId} />
					)}
				</Route>
				<Route path="/courses/:id">
					{({ id }) => <CourseOverviewPage key={id} id={id} canManage={manager} />}
				</Route>
				<Route path="/certificates/:id">
					{({ id }) => <CertificatePage key={id} id={id} />}
				</Route>
				<Route path="/files">
					<FilesPage canManage={manager} />
				</Route>
				<Route path="/calendar">
					<CalendarPage canManage={manager} />
				</Route>
				<Route path="/projects">
					{me.activeModules.includes("projects") ? <LaterPage labelKey="nav.projects" /> : <NoAccessPage />}
				</Route>
				<Route path="/capacity">
					{me.activeModules.includes("capacity_building") ? <LaterPage labelKey="nav.capacity" /> : <NoAccessPage />}
				</Route>
				<Route path="/notifications">
					<LaterPage labelKey="shell.notifications" />
				</Route>
				<Route path="/my-profile">
					<Redirect to="/settings/profile" replace />
				</Route>
				<Route path="/settings/profile">
					<SettingsProfilePage me={me} org={org} />
				</Route>
				<Route path="/settings/security">
					<SettingsSecurityPage me={me} org={org} />
				</Route>
				<Route path="/settings/sign-in">
					{org.role === "admin" ? <SettingsStaffSignInPage me={me} /> : <NoAccessPage />}
				</Route>
				<Route path="/settings/plan">
					{manager ? <SettingsPlanPage org={org} /> : <NoAccessPage />}
				</Route>
				<Route path="/settings/modules">
					{org.role === "admin" ? <SettingsModulesPage org={org} /> : <NoAccessPage />}
				</Route>
				<Route path="/settings/departments">
					{manager ? <SettingsDepartmentsPage isAdmin={org.role === "admin"} /> : <NoAccessPage />}
				</Route>
				<Route path="/users">
					{manager ? <UsersPage me={me} role={org.role} /> : <NoAccessPage />}
				</Route>
				<Route path="/users/:id">
					{({ id }) =>
						manager ? <UserProfilePage key={id} id={id} me={me} role={org.role} /> : <NoAccessPage />
					}
				</Route>
				<Route path="/reports">{manager ? <ReportsPage /> : <NoAccessPage />}</Route>
				<Route path="/settings">
					{manager ? <SettingsGeneralPage org={org} /> : <NoAccessPage />}
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
		const superMe = me.data;
		return superMe.user.isSuperAdmin ? (
			<Switch>
				<Route path="/superadmin/organizations">
					<SuperOrganizationsPage me={superMe} />
				</Route>
				<Route path="/superadmin/users">
					<SuperUsersPage me={superMe} />
				</Route>
				<Route path="/superadmin/plans">
					<SuperPlansPage me={superMe} />
				</Route>
				<Route path="/superadmin/modules">
					<SuperModulesPage me={superMe} />
				</Route>
				<Route path="/superadmin/storage">
					<SuperStoragePage me={superMe} />
				</Route>
				<Route>
					<SuperOverviewPage me={superMe} />
				</Route>
			</Switch>
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
