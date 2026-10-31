import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { Link } from "wouter";
import { api, useDepartments } from "../api";
import { downloadCsv } from "../csv";
import { useI18n } from "../i18n";
import {
	Avatar,
	BUTTON_SMALL,
	buttonClass,
	Chip,
	FilterSelect,
	Modal,
	PageError,
	PageHeader,
	PageLoading,
	SearchField,
	Segmented,
	StatePanel,
} from "../ui";

const TABS = ["overview", "courses", "policies", "announcements", "files", "departments"] as const;
type Tab = (typeof TABS)[number];
const PERIODS = ["1", "3", "6", "12", "0"];

interface CourseRow {
	id: number;
	title: string;
	isMandatory: boolean;
	enrolled: number;
	completed: number;
	inProgress: number;
	notStarted: number;
	averageScore: number | null;
}

interface Overview {
	policies: { required: number; acknowledged: number; mandatoryPolicies: number };
	courses: { enrolled: number; completed: number; averageDays: number | null };
	certificates: number;
	months: { month: string; started: number; completed: number }[];
	courseList: CourseRow[];
}

interface PolicyRow {
	id: number;
	title: string;
	category: string;
	isMandatory: boolean;
	required: number;
	acknowledged: number;
	viewers: number;
	views: number;
}

interface AnnouncementRow {
	id: number;
	title: string;
	priority: "normal" | "high" | "urgent";
	createdAt: string;
	viewers: number;
	views: number;
	responses: number;
}

interface FileRow {
	id: number;
	name: string;
	fileType: "upload" | "link";
	views: number;
	downloads: number;
	people: number;
}

interface DepartmentRow {
	id: number | null;
	name: string | null;
	members: number;
	required: number;
	acknowledged: number;
	enrolled: number;
	completed: number;
	inProgress: number;
}

interface ActivityPerson {
	userId: string;
	name: string;
	email: string;
	departmentName: string | null;
	photoUrl: string | null;
	views: number;
	downloads?: number;
	lastViewedAt: string | null;
	acknowledgedAt?: string | null;
	respondedAt?: string | null;
}

function percentOf(done: number, total: number) {
	return total === 0 ? 0 : Math.round((done / total) * 100);
}

function Bar({ percent, label }: { percent: number; label: string }) {
	return (
		<span className="flex min-w-32 items-center gap-2 text-[13px]">
			<span
				role="progressbar"
				aria-valuenow={percent}
				aria-valuemin={0}
				aria-valuemax={100}
				aria-label={label}
				className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
			>
				<span className="block h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
			</span>
			{percent}%
		</span>
	);
}

function Tile({ label, value, detail }: { label: string; value: ReactNode; detail?: string }) {
	return (
		<div className="rounded-card border border-border bg-card p-4">
			<dt className="text-[13px] text-muted-foreground">{label}</dt>
			<dd>
				<span className="block text-[28px] font-semibold leading-9">{value}</span>
				{detail && <span className="text-xs text-muted-foreground">{detail}</span>}
			</dd>
		</div>
	);
}

function Table({
	minWidth = 640,
	head,
	children,
}: {
	minWidth?: number;
	head: string[];
	children: ReactNode;
}) {
	return (
		<div className="overflow-x-auto rounded-card border border-border bg-card">
			<table className="w-full text-left text-[13px]" style={{ minWidth }}>
				<thead className="bg-background text-xs text-muted-foreground">
					<tr>
						{head.map((title) => (
							<th key={title} scope="col" className="px-3 py-2.5 font-semibold first:pl-4 last:pr-4">
								{title}
							</th>
						))}
					</tr>
				</thead>
				<tbody>{children}</tbody>
			</table>
		</div>
	);
}

const cellClass = "px-3 py-2.5 first:pl-4 last:pr-4";

export function ActivityDialog({
	path,
	kind,
	onClose,
}: {
	path: string;
	kind: "policy" | "announcement" | "file";
	onClose: () => void;
}) {
	const { t, language } = useI18n();
	const [search, setSearch] = useState("");
	const activity = useQuery({
		queryKey: ["report-activity", path],
		queryFn: () => api<{ title: string; people: ActivityPerson[] }>(path),
	});
	const when = (value: string | null | undefined) =>
		value ? new Date(value).toLocaleDateString(language, { dateStyle: "medium" }) : "—";
	const text = search.trim().toLowerCase();
	const people = (activity.data?.people ?? []).filter(
		(person) =>
			!text || person.name.toLowerCase().includes(text) || person.email.toLowerCase().includes(text),
	);
	const opened = (activity.data?.people ?? []).filter(
		(person) => person.views + (person.downloads ?? 0) > 0,
	).length;

	function exportPeople() {
		const header = [
			t("reports.col_person"),
			t("users.email"),
			t("users.department"),
			t("reports.col_views"),
			...(kind === "file" ? [t("reports.col_downloads")] : []),
			t("reports.col_last"),
			...(kind === "policy" ? [t("reports.col_acknowledged")] : []),
			...(kind === "announcement" ? [t("reports.col_got_it")] : []),
		];
		const rows = (activity.data?.people ?? []).map((person) => [
			person.name,
			person.email,
			person.departmentName ?? "",
			person.views,
			...(kind === "file" ? [person.downloads ?? 0] : []),
			person.lastViewedAt?.slice(0, 10) ?? "",
			...(kind === "policy" ? [person.acknowledgedAt?.slice(0, 10) ?? ""] : []),
			...(kind === "announcement" ? [person.respondedAt?.slice(0, 10) ?? ""] : []),
		]);
		downloadCsv(`${kind}-activity.csv`, [header, ...rows]);
	}

	return (
		<Modal
			title={activity.data?.title ?? t("reports.activity")}
			description={
				activity.data
					? t("reports.activity_summary", { opened, total: activity.data.people.length })
					: undefined
			}
			open
			wide
			onClose={onClose}
		>
			<div className="flex flex-col gap-3">
				{activity.isPending && <PageLoading />}
				{activity.isError && <PageError onRetry={() => activity.refetch()} />}
				{activity.data && (
					<>
						<div className="flex flex-wrap items-center gap-2">
							<SearchField label={t("users.search")} value={search} onChange={setSearch} className="min-w-48 flex-1" />
							<button type="button" className={buttonClass("outline")} onClick={exportPeople}>
								<Download size={15} aria-hidden="true" />
								{t("policies.export")}
							</button>
						</div>
						<ul className="max-h-[55vh] divide-y divide-border overflow-auto rounded-[9px] border border-border">
							{people.map((person) => (
								<li key={person.userId} className="flex flex-wrap items-center gap-2.5 px-3 py-2.5">
									<Avatar name={person.name} photoUrl={person.photoUrl} muted={person.views + (person.downloads ?? 0) === 0} />
									<span className="min-w-0 flex-[1_1_160px]">
										<span className="block break-words font-medium">{person.name}</span>
										<span className="block text-xs text-muted-foreground">
											{person.departmentName ?? t("users.not_set")}
										</span>
									</span>
									<span className="flex flex-wrap items-center justify-end gap-1.5 text-xs">
										{kind === "policy" &&
											(person.acknowledgedAt ? (
												<Chip tone="success">{t("reports.acknowledged_on", { date: when(person.acknowledgedAt) })}</Chip>
											) : (
												<Chip>{t("reports.not_acknowledged")}</Chip>
											))}
										{kind === "announcement" && person.respondedAt && (
											<Chip tone="success">{t("reports.col_got_it")}</Chip>
										)}
										{person.views + (person.downloads ?? 0) === 0 ? (
											<Chip tone="neutral">{t(kind === "file" ? "reports.not_opened" : "reports.not_viewed")}</Chip>
										) : (
											<span className="text-muted-foreground">
												{[
													t("reports.count_views", { count: person.views }),
													kind === "file" ? t("reports.count_downloads", { count: person.downloads ?? 0 }) : null,
													t("reports.last_seen", { date: when(person.lastViewedAt) }),
												]
													.filter(Boolean)
													.join(" · ")}
											</span>
										)}
									</span>
								</li>
							))}
						</ul>
					</>
				)}
				<div className="flex justify-end">
					<button type="button" className={buttonClass("outline")} onClick={onClose}>
						{t("common.close")}
					</button>
				</div>
			</div>
		</Modal>
	);
}

function CompletionChart({ months }: { months: Overview["months"] }) {
	const { t, language } = useI18n();
	const highest = Math.max(1, ...months.flatMap((row) => [row.started, row.completed]));
	const label = (month: string) =>
		new Date(`${month}-01T00:00:00Z`).toLocaleDateString(language, { month: "short", timeZone: "UTC" });
	const total = months.reduce((sum, row) => sum + row.completed, 0);
	return (
		<section className="min-w-0 flex-[3_1_480px] rounded-card border border-border bg-card px-5 py-4">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<h2 className="text-[15px] font-semibold">{t("reports.chart_title")}</h2>
				<span className="flex gap-3 text-xs text-muted-foreground">
					<span className="flex items-center gap-1.5">
						<span aria-hidden="true" className="size-2.5 rounded-sm bg-[var(--chart-started)]" />
						{t("reports.started")}
					</span>
					<span className="flex items-center gap-1.5">
						<span aria-hidden="true" className="size-2.5 rounded-sm bg-primary" />
						{t("course.status_completed")}
					</span>
				</span>
			</div>
			<div
				role="img"
				aria-label={t("reports.chart_summary", { count: total })}
				className="mt-4 flex h-48 items-end gap-3 border-b border-border"
			>
				{months.map((row) => (
					<div key={row.month} className="group relative flex h-full min-w-0 flex-1 items-end justify-center gap-0.5">
						<div
							className="w-full max-w-5 rounded-t bg-[var(--chart-started)]"
							style={{ height: `${(row.started / highest) * 100}%` }}
						/>
						<div
							className="w-full max-w-5 rounded-t bg-primary"
							style={{ height: `${(row.completed / highest) * 100}%` }}
						/>
						<div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-card px-2 py-1 text-xs shadow-md group-hover:block">
							<span className="block font-semibold">{label(row.month)}</span>
							<span className="block text-muted-foreground">{t("reports.started")}: {row.started}</span>
							<span className="block text-muted-foreground">{t("course.status_completed")}: {row.completed}</span>
						</div>
					</div>
				))}
			</div>
			<div className="mt-1.5 flex gap-3 text-xs text-muted-foreground">
				{months.map((row, index) => (
					<span key={row.month} className="min-w-0 flex-1 truncate text-center">
						{months.length <= 12 || index % 3 === 0 ? label(row.month) : ""}
					</span>
				))}
			</div>
			<table className="sr-only">
				<caption>{t("reports.chart_title")}</caption>
				<thead>
					<tr>
						<th scope="col">{t("reports.month")}</th>
						<th scope="col">{t("reports.started")}</th>
						<th scope="col">{t("course.status_completed")}</th>
					</tr>
				</thead>
				<tbody>
					{months.map((row) => (
						<tr key={row.month}>
							<th scope="row">{row.month}</th>
							<td>{row.started}</td>
							<td>{row.completed}</td>
						</tr>
					))}
				</tbody>
			</table>
		</section>
	);
}

function CourseTable({ rows }: { rows: CourseRow[] }) {
	const { t } = useI18n();
	if (rows.length === 0) return <StatePanel title={t("reports.no_courses")} />;
	return (
		<Table
			minWidth={760}
			head={[
				t("nav.courses"),
				t("course.enrolled"),
				t("course.status_completed"),
				t("course.status_in_progress"),
				t("course.status_not_started"),
				t("reports.col_avg_score"),
				t("reports.col_completion"),
			]}
		>
			{rows.map((row) => (
				<tr key={row.id} className="border-t border-border">
					<td className={`${cellClass} font-medium`}>
						<Link href={`/courses/${row.id}/learners`} className="break-words text-foreground no-underline hover:underline">
							{row.title}
						</Link>
					</td>
					<td className={cellClass}>{row.enrolled}</td>
					<td className={cellClass}>{row.completed}</td>
					<td className={cellClass}>{row.inProgress}</td>
					<td className={cellClass}>{row.notStarted}</td>
					<td className={cellClass}>{row.averageScore === null ? "—" : `${row.averageScore}%`}</td>
					<td className={cellClass}>
						<Bar percent={percentOf(row.completed, row.enrolled)} label={row.title} />
					</td>
				</tr>
			))}
		</Table>
	);
}

export function ReportsPage() {
	const { t, language } = useI18n();
	const departments = useDepartments();
	const [tab, setTab] = useState<Tab>("overview");
	const [months, setMonths] = useState("6");
	const [departmentId, setDepartmentId] = useState("all");
	const [activity, setActivity] = useState<{ path: string; kind: "policy" | "announcement" | "file" } | null>(null);
	const query = `months=${months}${departmentId === "all" ? "" : `&departmentId=${departmentId}`}`;

	const overview = useQuery({
		queryKey: ["reports", "overview", query],
		enabled: tab === "overview" || tab === "courses",
		queryFn: () => api<Overview>(`/reports/overview?${query}`),
	});
	const policies = useQuery({
		queryKey: ["reports", "policies", query],
		enabled: tab === "policies",
		queryFn: () => api<{ policies: PolicyRow[] }>(`/reports/policies?${query}`),
		select: (data) => data.policies,
	});
	const announcements = useQuery({
		queryKey: ["reports", "announcements", query],
		enabled: tab === "announcements",
		queryFn: () => api<{ audience: number; announcements: AnnouncementRow[] }>(`/reports/announcements?${query}`),
	});
	const files = useQuery({
		queryKey: ["reports", "files", query],
		enabled: tab === "files",
		queryFn: () => api<{ files: FileRow[] }>(`/reports/files?${query}`),
		select: (data) => data.files,
	});
	const byDepartment = useQuery({
		queryKey: ["reports", "departments"],
		enabled: tab === "overview" || tab === "departments",
		queryFn: () => api<{ departments: DepartmentRow[] }>("/reports/departments"),
		select: (data) => data.departments,
	});

	const active = {
		overview,
		courses: overview,
		policies,
		announcements,
		files,
		departments: byDepartment,
	}[tab];

	function exportTab() {
		const course = overview.data?.courseList ?? [];
		const sheets: Record<Tab, (string | number)[][]> = {
			overview: [
				[t("reports.month"), t("reports.started"), t("course.status_completed")],
				...(overview.data?.months ?? []).map((row) => [row.month, row.started, row.completed]),
			],
			courses: [
				[t("nav.courses"), t("course.enrolled"), t("course.status_completed"), t("course.status_in_progress"), t("course.status_not_started"), t("reports.col_avg_score")],
				...course.map((row) => [row.title, row.enrolled, row.completed, row.inProgress, row.notStarted, row.averageScore ?? ""]),
			],
			policies: [
				[t("policies.col_policy"), t("policies.mandatory_badge"), t("reports.col_required"), t("reports.col_acknowledged"), t("reports.col_viewers"), t("reports.col_views")],
				...(policies.data ?? []).map((row) => [row.title, row.isMandatory ? "yes" : "no", row.required, row.acknowledged, row.viewers, row.views]),
			],
			announcements: [
				[t("nav.announcements"), t("announcements.priority"), t("reports.col_viewers"), t("reports.col_views"), t("reports.col_got_it")],
				...(announcements.data?.announcements ?? []).map((row) => [row.title, row.priority, row.viewers, row.views, row.responses]),
			],
			files: [
				[t("nav.files"), t("reports.col_people"), t("reports.col_views"), t("reports.col_downloads")],
				...(files.data ?? []).map((row) => [row.name, row.people, row.views, row.downloads]),
			],
			departments: [
				[t("users.department"), t("reports.col_people"), t("nav.policies"), t("nav.courses"), t("course.status_in_progress")],
				...(byDepartment.data ?? []).map((row) => [
					row.name ?? t("users.no_department"),
					row.members,
					`${percentOf(row.acknowledged, row.required)}%`,
					`${percentOf(row.completed, row.enrolled)}%`,
					row.inProgress,
				]),
			],
		};
		downloadCsv(`report-${tab}.csv`, sheets[tab]);
	}

	const usesPeriod = tab === "overview" || tab === "files" || tab === "announcements";
	const usesDepartment = tab !== "departments";

	return (
		<div className="mx-auto flex max-w-[1180px] flex-col gap-4 p-4 md:px-6 md:py-7">
			<PageHeader
				title={t("nav.reports")}
				subtitle={t("reports.subtitle")}
				action={
					<div className="flex flex-wrap items-center gap-2">
						{usesPeriod && (
							<FilterSelect label={t("reports.period")} value={months} onChange={setMonths}>
								{PERIODS.map((value) => (
									<option key={value} value={value}>
										{t(value === "0" ? "reports.period_all" : "reports.period_months", { count: value })}
									</option>
								))}
							</FilterSelect>
						)}
						{usesDepartment && (
							<FilterSelect label={t("users.department")} value={departmentId} onChange={setDepartmentId}>
								<option value="all">{t("course.all")}</option>
								{departments.data?.map((department) => (
									<option key={department.id} value={department.id}>
										{department.name}
									</option>
								))}
							</FilterSelect>
						)}
						<button type="button" disabled={!active.data} className={buttonClass()} onClick={exportTab}>
							<Download size={15} aria-hidden="true" />
							{t("policies.export")}
						</button>
					</div>
				}
			/>
			<div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:px-0">
				<Segmented
					label={t("reports.type")}
					options={TABS.map((value) => ({ value, label: t(`reports.tab_${value}`) }))}
					value={tab}
					onChange={setTab}
				/>
			</div>

			{active.isPending && <PageLoading />}
			{active.isError && <PageError onRetry={() => active.refetch()} />}

			{tab === "overview" && overview.data && (
				<>
					<dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
						<Tile
							label={t("dashboard.kpi_compliance")}
							value={overview.data.policies.required ? `${percentOf(overview.data.policies.acknowledged, overview.data.policies.required)}%` : "—"}
							detail={t("reports.of_required", { done: overview.data.policies.acknowledged, total: overview.data.policies.required })}
						/>
						<Tile
							label={t("dashboard.kpi_courses")}
							value={overview.data.courses.enrolled ? `${percentOf(overview.data.courses.completed, overview.data.courses.enrolled)}%` : "—"}
							detail={t("dashboard.kpi_courses_count", { done: overview.data.courses.completed, total: overview.data.courses.enrolled })}
						/>
						<Tile
							label={t("reports.avg_days")}
							value={overview.data.courses.averageDays ?? "—"}
							detail={t("reports.avg_days_note")}
						/>
						<Tile label={t("dashboard.kpi_certificates")} value={overview.data.certificates} detail={t("reports.in_period")} />
					</dl>
					<div className="flex flex-wrap items-start gap-4">
						<CompletionChart months={overview.data.months} />
						<section className="min-w-0 flex-[2_1_320px] rounded-card border border-border bg-card px-5 py-4">
							<h2 className="text-[15px] font-semibold">{t("reports.by_department")}</h2>
							<table className="mt-2 w-full text-[13px]">
								<thead className="text-left text-xs text-muted-foreground">
									<tr>
										<th scope="col" className="py-1.5 font-semibold">{t("users.department")}</th>
										<th scope="col" className="py-1.5 text-right font-semibold">{t("nav.policies")}</th>
										<th scope="col" className="py-1.5 text-right font-semibold">{t("nav.courses")}</th>
									</tr>
								</thead>
								<tbody>
									{byDepartment.data?.map((row) => {
										const policyPercent = percentOf(row.acknowledged, row.required);
										const coursePercent = percentOf(row.completed, row.enrolled);
										const low = "font-semibold text-danger-foreground";
										return (
											<tr key={row.id ?? "none"} className="border-t border-border">
												<td className={`break-words py-2 ${row.id === null ? "text-muted-foreground" : ""}`}>
													{row.name ?? t("users.no_department")} · {row.members}
												</td>
												<td className={`py-2 text-right ${row.required && policyPercent < 70 ? low : ""}`}>
													{row.required ? `${policyPercent}%` : "—"}
												</td>
												<td className={`py-2 text-right ${row.enrolled && coursePercent < 50 ? low : ""}`}>
													{row.enrolled ? `${coursePercent}%` : "—"}
												</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						</section>
					</div>
					<section className="flex flex-col gap-2">
						<h2 className="text-[15px] font-semibold">{t("nav.courses")}</h2>
						<CourseTable rows={overview.data.courseList} />
					</section>
				</>
			)}

			{tab === "courses" && overview.data && <CourseTable rows={overview.data.courseList} />}

			{tab === "policies" && policies.data &&
				(policies.data.length === 0 ? (
					<StatePanel title={t("reports.no_policies")} />
				) : (
					<Table
						minWidth={760}
						head={[
							t("policies.col_policy"),
							t("reports.col_viewers"),
							t("reports.col_views"),
							t("reports.col_acknowledged"),
							t("reports.col_completion"),
							"",
						]}
					>
						{policies.data.map((row) => (
							<tr key={row.id} className="border-t border-border">
								<td className={`${cellClass} font-medium`}>
									<span className="flex flex-wrap items-center gap-1.5">
										<span className="break-words">{row.title}</span>
										{row.isMandatory && <Chip tone="primary">{t("policies.mandatory_badge")}</Chip>}
									</span>
								</td>
								<td className={cellClass}>{row.viewers}</td>
								<td className={cellClass}>{row.views}</td>
								<td className={cellClass}>{row.isMandatory ? `${row.acknowledged}/${row.required}` : t("policies.not_required")}</td>
								<td className={cellClass}>
									{row.isMandatory ? <Bar percent={percentOf(row.acknowledged, row.required)} label={row.title} /> : "—"}
								</td>
								<td className={`${cellClass} text-right`}>
									<button
										type="button"
										className={buttonClass("outline", BUTTON_SMALL)}
										aria-label={t("reports.who_for", { title: row.title })}
										onClick={() => setActivity({ path: `/reports/policies/${row.id}/people`, kind: "policy" })}
									>
										{t("reports.who")}
									</button>
								</td>
							</tr>
						))}
					</Table>
				))}

			{tab === "announcements" && announcements.data &&
				(announcements.data.announcements.length === 0 ? (
					<StatePanel title={t("reports.no_announcements")} />
				) : (
					<Table
						minWidth={720}
						head={[
							t("nav.announcements"),
							t("reports.col_posted"),
							t("reports.col_viewers"),
							t("reports.col_views"),
							t("reports.col_got_it"),
							"",
						]}
					>
						{announcements.data.announcements.map((row) => (
							<tr key={row.id} className="border-t border-border">
								<td className={`${cellClass} break-words font-medium`}>{row.title}</td>
								<td className={cellClass}>
									{new Date(row.createdAt).toLocaleDateString(language, { dateStyle: "medium" })}
								</td>
								<td className={cellClass}>{row.viewers}/{announcements.data.audience}</td>
								<td className={cellClass}>{row.views}</td>
								<td className={cellClass}>{row.responses}</td>
								<td className={`${cellClass} text-right`}>
									<button
										type="button"
										className={buttonClass("outline", BUTTON_SMALL)}
										aria-label={t("reports.who_for", { title: row.title })}
										onClick={() => setActivity({ path: `/reports/announcements/${row.id}/people`, kind: "announcement" })}
									>
										{t("reports.who")}
									</button>
								</td>
							</tr>
						))}
					</Table>
				))}

			{tab === "files" && files.data &&
				(files.data.length === 0 ? (
					<StatePanel title={t("reports.no_files")} />
				) : (
					<Table
						minWidth={640}
						head={[t("nav.files"), t("reports.col_people"), t("reports.col_views_clicks"), t("reports.col_downloads"), ""]}
					>
						{files.data.map((row) => (
							<tr key={row.id} className="border-t border-border">
								<td className={`${cellClass} font-medium`}>
									<span className="flex flex-wrap items-center gap-1.5">
										<span className="break-all">{row.name}</span>
										{row.fileType === "link" && <Chip>{t("hub.kind_link")}</Chip>}
									</span>
								</td>
								<td className={cellClass}>{row.people}</td>
								<td className={cellClass}>{row.views}</td>
								<td className={cellClass}>{row.fileType === "link" ? "—" : row.downloads}</td>
								<td className={`${cellClass} text-right`}>
									<button
										type="button"
										className={buttonClass("outline", BUTTON_SMALL)}
										aria-label={t("reports.who_for", { title: row.name })}
										onClick={() => setActivity({ path: `/reports/files/${row.id}/people`, kind: "file" })}
									>
										{t("reports.who")}
									</button>
								</td>
							</tr>
						))}
					</Table>
				))}

			{tab === "departments" && byDepartment.data && (
				<Table
					minWidth={720}
					head={[
						t("users.department"),
						t("reports.col_people"),
						t("nav.policies"),
						t("nav.courses"),
						t("course.status_in_progress"),
					]}
				>
					{byDepartment.data.map((row) => (
						<tr key={row.id ?? "none"} className="border-t border-border">
							<td className={`${cellClass} break-words font-medium`}>{row.name ?? t("users.no_department")}</td>
							<td className={cellClass}>{row.members}</td>
							<td className={cellClass}>
								{row.required ? <Bar percent={percentOf(row.acknowledged, row.required)} label={t("nav.policies")} /> : "—"}
							</td>
							<td className={cellClass}>
								{row.enrolled ? <Bar percent={percentOf(row.completed, row.enrolled)} label={t("nav.courses")} /> : "—"}
							</td>
							<td className={cellClass}>{row.inProgress}</td>
						</tr>
					))}
				</Table>
			)}

			<p className="text-xs text-muted-foreground">{t("reports.footnote")}</p>
			{activity && <ActivityDialog path={activity.path} kind={activity.kind} onClose={() => setActivity(null)} />}
		</div>
	);
}
