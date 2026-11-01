import { Component, useEffect, type ReactNode, lazy, Suspense } from "react";
import {
	QueryClient,
	QueryClientProvider,
	useQueryClient,
} from "@tanstack/react-query";
import { CircleAlert, Lock, SearchX } from "lucide-react";
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
import { canManage, WorkspaceShell } from "./Shell";
import { buttonClass, StartupScreen, StatePanel , ToastProvider, PageLoading } from "./ui";
import { NotificationsPage } from "./pages/Notifications";

// Each page downloads when it's first opened, so the app starts fast on a slow connection.
const AnnouncementsPage = lazy(() => import("./pages/Announcements").then((page) => ({ default: page.AnnouncementsPage })));
const MyTrainingPage = lazy(() => import("./pages/Capacity").then((page) => ({ default: page.MyTrainingPage })));
const ReportTrainingPage = lazy(() => import("./pages/Capacity").then((page) => ({ default: page.ReportTrainingPage })));
const TrainingDetailPage = lazy(() => import("./pages/Capacity").then((page) => ({ default: page.TrainingDetailPage })));
const CapacityReviewsPage = lazy(() => import("./pages/CapacityReview").then((page) => ({ default: page.CapacityReviewsPage })));
const CapacitySettingsPage = lazy(() => import("./pages/CapacityReview").then((page) => ({ default: page.CapacitySettingsPage })));
const CapacitySkillsPage = lazy(() => import("./pages/CapacitySkills").then((page) => ({ default: page.CapacitySkillsPage })));
const CapacityTeamPage = lazy(() => import("./pages/CapacitySkills").then((page) => ({ default: page.CapacityTeamPage })));
const CapacityTrainingReportPage = lazy(() => import("./pages/CapacityTrainingReport").then((page) => ({ default: page.CapacityTrainingReportPage })));
const DirectoryPage = lazy(() => import("./pages/Directory").then((page) => ({ default: page.DirectoryPage })));
const DirectoryPrivacyPage = lazy(() => import("./pages/Directory").then((page) => ({ default: page.DirectoryPrivacyPage })));
const DirectoryRulesPage = lazy(() => import("./pages/Directory").then((page) => ({ default: page.DirectoryRulesPage })));
const CreateOrganizationPage = lazy(() => import("./pages/CreateOrganization").then((page) => ({ default: page.CreateOrganizationPage })));
const DashboardPage = lazy(() => import("./pages/Dashboard").then((page) => ({ default: page.DashboardPage })));
const FilesPage = lazy(() => import("./pages/Files").then((page) => ({ default: page.FilesPage })));
const HubPage = lazy(() => import("./pages/Hub").then((page) => ({ default: page.HubPage })));
const InvitePage = lazy(() => import("./pages/Invite").then((page) => ({ default: page.InvitePage })));
const PoliciesPage = lazy(() => import("./pages/Policies").then((page) => ({ default: page.PoliciesPage })));
const PolicyDetailPage = lazy(() => import("./pages/PolicyDetail").then((page) => ({ default: page.PolicyDetailPage })));
const PolicyEditorPage = lazy(() => import("./pages/PolicyEditor").then((page) => ({ default: page.PolicyEditorPage })));
const ProjectDetailPage = lazy(() => import("./pages/ProjectDetail").then((page) => ({ default: page.ProjectDetailPage })));
const ProjectPortfolioPage = lazy(() => import("./pages/ProjectPortfolio").then((page) => ({ default: page.ProjectPortfolioPage })));
const ProjectsPage = lazy(() => import("./pages/Projects").then((page) => ({ default: page.ProjectsPage })));
const SettingsDepartmentsPage = lazy(() => import("./pages/SettingsArea").then((page) => ({ default: page.SettingsDepartmentsPage })));
const SettingsGeneralPage = lazy(() => import("./pages/SettingsArea").then((page) => ({ default: page.SettingsGeneralPage })));
const SettingsIntegrationsPage = lazy(() => import("./pages/SettingsArea").then((page) => ({ default: page.SettingsIntegrationsPage })));
const SettingsNotificationsPage = lazy(() => import("./pages/SettingsArea").then((page) => ({ default: page.SettingsNotificationsPage })));
const SettingsPlanPage = lazy(() => import("./pages/SettingsArea").then((page) => ({ default: page.SettingsPlanPage })));
const SettingsProfilePage = lazy(() => import("./pages/SettingsArea").then((page) => ({ default: page.SettingsProfilePage })));
const SettingsSecurityPage = lazy(() => import("./pages/SettingsArea").then((page) => ({ default: page.SettingsSecurityPage })));
const SettingsStaffSignInPage = lazy(() => import("./pages/SettingsArea").then((page) => ({ default: page.SettingsStaffSignInPage })));
const SuperModulesPage = lazy(() => import("./pages/SuperAdmin").then((page) => ({ default: page.SuperModulesPage })));
const SuperOrganizationsPage = lazy(() => import("./pages/SuperAdmin").then((page) => ({ default: page.SuperOrganizationsPage })));
const SuperOverviewPage = lazy(() => import("./pages/SuperAdmin").then((page) => ({ default: page.SuperOverviewPage })));
const SuperPlansPage = lazy(() => import("./pages/SuperAdmin").then((page) => ({ default: page.SuperPlansPage })));
const SuperStoragePage = lazy(() => import("./pages/SuperAdmin").then((page) => ({ default: page.SuperStoragePage })));
const SuperUsersPage = lazy(() => import("./pages/SuperAdmin").then((page) => ({ default: page.SuperUsersPage })));
const CourseBuilderPage = lazy(() => import("./pages/CourseBuilder").then((page) => ({ default: page.CourseBuilderPage })));
const CourseLearnersPage = lazy(() => import("./pages/CourseBuilder").then((page) => ({ default: page.CourseLearnersPage })));
const CertificatePage = lazy(() => import("./pages/CourseLearn").then((page) => ({ default: page.CertificatePage })));
const CourseLessonPage = lazy(() => import("./pages/CourseLearn").then((page) => ({ default: page.CourseLessonPage })));
const CourseOverviewPage = lazy(() => import("./pages/CourseLearn").then((page) => ({ default: page.CourseOverviewPage })));
const CourseQuizPage = lazy(() => import("./pages/CourseLearn").then((page) => ({ default: page.CourseQuizPage })));
const CoursesPage = lazy(() => import("./pages/Courses").then((page) => ({ default: page.CoursesPage })));
const LessonEditorPage = lazy(() => import("./pages/LessonEditor").then((page) => ({ default: page.LessonEditorPage })));
const QuizBuilderPage = lazy(() => import("./pages/QuizBuilder").then((page) => ({ default: page.QuizBuilderPage })));
const ReportsPage = lazy(() => import("./pages/Reports").then((page) => ({ default: page.ReportsPage })));
const UsersPage = lazy(() => import("./pages/Users").then((page) => ({ default: page.UsersPage })));
const CalendarPage = lazy(() => import("./pages/Calendar").then((page) => ({ default: page.CalendarPage })));
const SettingsModulesPage = lazy(() => import("./pages/SettingsModules").then((page) => ({ default: page.SettingsModulesPage })));
const UserProfilePage = lazy(() => import("./pages/UserProfile").then((page) => ({ default: page.UserProfilePage })));

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

function NoAccessPage() {
	const { t } = useI18n();
	return (
		<StatePanel
			pageTitle
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
			pageTitle
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

	const capacityOn = me.activeModules.includes("capacity_building");
	const projectsOn = me.activeModules.includes("projects");
	const directoryOn = me.activeModules.includes("people_directory");
	return (
		<WorkspaceShell me={me} org={org}>
			<Suspense fallback={<PageLoading />}>
			<Switch>
				<Route path="/announcements">
					<Redirect to="/" replace />
				</Route>
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
				<Route path="/projects/portfolio">
					{projectsOn ? <ProjectPortfolioPage /> : <NoAccessPage />}
				</Route>
				<Route path="/projects/:id">
					{({ id }) => (projectsOn ? <ProjectDetailPage key={id} id={id} /> : <NoAccessPage />)}
				</Route>
				<Route path="/projects">
					{projectsOn ? <ProjectsPage me={me.user.id} /> : <NoAccessPage />}
				</Route>
				<Route path="/capacity/report">
					{capacityOn ? <ReportTrainingPage /> : <NoAccessPage />}
				</Route>
				<Route path="/capacity/records/:id/edit">
					{({ id }) => (capacityOn ? <ReportTrainingPage key={id} id={id} /> : <NoAccessPage />)}
				</Route>
				<Route path="/capacity/records/:id">
					{({ id }) => (capacityOn ? <TrainingDetailPage key={id} id={id} /> : <NoAccessPage />)}
				</Route>
				<Route path="/capacity/skills">
					{capacityOn ? <CapacitySkillsPage /> : <NoAccessPage />}
				</Route>
				<Route path="/capacity/team">
					{capacityOn && manager ? <CapacityTeamPage /> : <NoAccessPage />}
				</Route>
				<Route path="/directory/rules">
					{directoryOn && org.role === "admin" ? <DirectoryRulesPage /> : <NoAccessPage />}
				</Route>
				<Route path="/directory/privacy">
					{directoryOn ? <DirectoryPrivacyPage /> : <NoAccessPage />}
				</Route>
				<Route path="/directory">
					{directoryOn ? <DirectoryPage /> : <NoAccessPage />}
				</Route>
				<Route path="/capacity/training-report">
					{capacityOn && manager ? <CapacityTrainingReportPage /> : <NoAccessPage />}
				</Route>
				<Route path="/capacity/reviews">
					{capacityOn && manager ? <CapacityReviewsPage /> : <NoAccessPage />}
				</Route>
				<Route path="/capacity/settings">
					{capacityOn && org.role === "admin" ? <CapacitySettingsPage /> : <NoAccessPage />}
				</Route>
				<Route path="/capacity">
					{capacityOn ? <MyTrainingPage /> : <NoAccessPage />}
				</Route>
				<Route path="/notifications">
					<NotificationsPage />
				</Route>
				<Route path="/settings/integrations">
					{org.role === "admin" ? <SettingsIntegrationsPage org={org} email={me.user.email} /> : <NoAccessPage />}
				</Route>
				<Route path="/settings/notifications">
					{org.role === "admin" ? <SettingsNotificationsPage org={org} /> : <NoAccessPage />}
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
			</Suspense>
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
					<ToastProvider>
						<Suspense fallback={<StartupScreen />}>
							<Gate />
						</Suspense>
					</ToastProvider>
				</I18nProvider>
			</QueryClientProvider>
		</ErrorBoundary>
	);
}
