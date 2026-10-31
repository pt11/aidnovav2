import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
	Building2,
	CalendarClock,
	ChevronRight,
	CircleAlert,
	FileText,
	Mail,
	Megaphone,
	Plus,
	UserPlus,
	type LucideIcon,
} from "lucide-react";
import { Link } from "wouter";
import { api, type Me } from "../api";
import { useI18n } from "../i18n";
import { buttonClass, PageError, PageLoading } from "../ui";
import { PriorityBadge, type Priority } from "./Announcements";

interface ManagerData {
	compliance: {
		required: number;
		acknowledged: number;
		mandatoryPolicies: number;
		departments: { name: string; percent: number }[];
		behind: { id: number; title: string; pending: number }[];
	};
	membersWithoutDepartment: number;
	draftPolicies: { id: number; title: string }[];
	reviewDue: { id: number; title: string; reviewDate: string }[];
	activity: {
		key: string;
		actor: string;
		kind: "acknowledged" | "joined" | "uploaded";
		subject: string | null;
		at: string;
	}[];
}

export interface DashboardData {
	recent: { id: number; title: string; priority: Priority; createdAt: string }[];
	members: number;
	departments: number;
	invitations: number;
	announcements: number;
	pendingPolicies: { id: number; title: string }[];
	manager: ManagerData | null;
}

function percentOf(done: number, total: number) {
	return total === 0 ? 0 : Math.round((done / total) * 100);
}

function ProgressBar({
	percent,
	label,
	low = false,
}: {
	percent: number;
	label: string;
	low?: boolean;
}) {
	return (
		<div
			role="progressbar"
			aria-valuenow={percent}
			aria-valuemin={0}
			aria-valuemax={100}
			aria-label={label}
			className="h-1.5 overflow-hidden rounded-full bg-muted"
		>
			<div
				className={`h-full rounded-full ${low ? "bg-destructive" : "bg-primary"}`}
				style={{ width: `${percent}%` }}
			/>
		</div>
	);
}

function Kpi({
	label,
	value,
	detail,
	footnote,
	children,
}: {
	label: string;
	value: string | number;
	detail?: string;
	footnote?: string;
	children?: ReactNode;
}) {
	return (
		<div className="rounded-card border border-border bg-card p-4">
			<dt className="text-[13px] text-muted-foreground">{label}</dt>
			<dd className="mt-1">
				<span className="flex flex-wrap items-baseline gap-x-2">
					<span className="text-[28px] font-semibold leading-9">{value}</span>
					{detail && <span className="text-xs text-muted-foreground">{detail}</span>}
				</span>
				{children && <div className="mt-2">{children}</div>}
				{footnote && <p className="mt-2 text-xs text-muted-foreground">{footnote}</p>}
			</dd>
		</div>
	);
}

function AttentionRow({
	icon: Icon,
	urgent = false,
	title,
	detail,
	action,
	href,
	primary = false,
}: {
	icon: LucideIcon;
	urgent?: boolean;
	title: string;
	detail: string;
	action: string;
	href: string;
	primary?: boolean;
}) {
	return (
		<li className="flex flex-wrap items-center gap-3 border-t border-border px-5 py-3.5 first:border-t-0">
			<span
				className={`grid size-9 shrink-0 place-items-center rounded-[9px] ${
					urgent ? "bg-destructive text-primary-foreground" : "bg-muted text-foreground"
				}`}
			>
				<Icon size={18} aria-hidden="true" />
			</span>
			<div className="min-w-0 flex-1 basis-56">
				<p className="break-words font-semibold">{title}</p>
				<p className="text-[13px] text-muted-foreground">{detail}</p>
			</div>
			<Link
				href={href}
				className={buttonClass(
					primary ? "primary" : "outline",
					"min-h-8 px-3 py-0 text-[13px] font-medium",
				)}
			>
				{action}
			</Link>
		</li>
	);
}

function ToDoCard({ policies }: { policies: DashboardData["pendingPolicies"] }) {
	const { t } = useI18n();
	return (
		<section className="rounded-card bg-primary p-4 text-primary-foreground">
			<div className="flex items-center justify-between gap-3">
				<h2 className="font-semibold">{t("dashboard.todo")}</h2>
				<span className="rounded-full bg-card px-2 text-xs font-semibold text-selected-foreground">
					{policies.length}
				</span>
			</div>
			<ul className="mt-3 flex flex-col gap-2">
				{policies.slice(0, 5).map((policy) => (
					<li key={policy.id}>
						<Link
							href={`/policies/${policy.id}`}
							className="flex items-center gap-2.5 rounded-[9px] bg-card px-3 py-2.5 text-foreground no-underline hover:bg-muted"
						>
							<span className="grid size-[34px] shrink-0 place-items-center rounded-md bg-muted text-selected-foreground">
								<FileText size={16} aria-hidden="true" />
							</span>
							<span className="min-w-0 flex-1">
								<span className="block font-semibold">{t("dashboard.todo_acknowledge")}</span>
								<span className="block break-words text-xs text-muted-foreground">
									{policy.title}
								</span>
							</span>
							<ChevronRight
								size={16}
								className="shrink-0 text-muted-foreground"
								aria-hidden="true"
							/>
						</Link>
					</li>
				))}
			</ul>
		</section>
	);
}

function SectionCard({
	title,
	linkLabel,
	href,
	children,
}: {
	title: string;
	linkLabel?: string;
	href?: string;
	children: ReactNode;
}) {
	return (
		<section className="rounded-card border border-border bg-card px-5 py-4">
			<div className="flex items-center justify-between gap-3">
				<h2 className="text-base font-semibold">{title}</h2>
				{href && linkLabel && (
					<Link
						href={href}
						className="text-[13px] text-selected-foreground no-underline hover:underline"
					>
						{linkLabel}
					</Link>
				)}
			</div>
			<div className="mt-3">{children}</div>
		</section>
	);
}

function relativeTime(value: string, now: number, language: string) {
	const minutes = Math.round((new Date(value).getTime() - now) / 60_000);
	const format = new Intl.RelativeTimeFormat(language, { numeric: "auto" });
	if (Math.abs(minutes) < 60) return format.format(minutes, "minute");
	const hours = Math.round(minutes / 60);
	if (Math.abs(hours) < 24) return format.format(hours, "hour");
	return format.format(Math.round(hours / 24), "day");
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

export function DashboardPage({ me }: { me: Me }) {
	const { t, language } = useI18n();
	const [now] = useState(() => Date.now());
	const dashboard = useQuery({
		queryKey: ["dashboard"],
		queryFn: () => api<DashboardData>("/dashboard"),
	});

	if (dashboard.isPending) return <PageLoading />;
	if (dashboard.isError) return <PageError onRetry={() => dashboard.refetch()} />;

	const data = dashboard.data;
	const manager = data.manager;
	const hour = new Date(now).getHours();
	const greeting = t(
		hour < 12
			? "dashboard.morning"
			: hour < 17
				? "dashboard.afternoon"
				: "dashboard.evening",
		{ name: me.user.name },
	);
	const compliance = manager?.compliance;
	const compliancePercent = compliance
		? percentOf(compliance.acknowledged, compliance.required)
		: 0;
	const noPeopleYet = !!manager && data.members <= 1 && data.invitations === 0;
	const noDepartmentsYet = !!manager && data.departments === 0;
	const needsAttention =
		!!manager &&
		(manager.compliance.behind.length > 0 ||
			manager.membersWithoutDepartment > 0 ||
			manager.draftPolicies.length > 0 ||
			manager.reviewDue.length > 0 ||
			noPeopleYet ||
			noDepartmentsYet);

	return (
		<div className="mx-auto flex max-w-[1180px] flex-col gap-5 p-4 md:px-6 md:py-7">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div className="min-w-0">
					<p className="text-[13px] text-muted-foreground">
						{new Date(now).toLocaleDateString(language, {
							weekday: "long",
							day: "numeric",
							month: "long",
						})}
					</p>
					<h1 className="mt-0.5 break-words text-[28px] font-semibold leading-9 tracking-tight">
						{greeting}
					</h1>
				</div>
				{manager && (
					<div className="flex flex-wrap gap-2">
						<Link href="/" className={buttonClass("outline", "min-h-9 py-0 font-medium")}>
							{t("dashboard.post_announcement")}
						</Link>
						<Link
							href="/policies"
							className={buttonClass("primary", "min-h-9 py-0 font-medium")}
						>
							<Plus size={16} aria-hidden="true" />
							{t("dashboard.new_policy")}
						</Link>
					</div>
				)}
			</div>

			{manager && compliance && (
				<dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
					<Kpi
						label={t("dashboard.kpi_compliance")}
						value={compliance.required ? `${compliancePercent}%` : "—"}
						detail={
							compliance.required
								? t("policies.compliance_count", {
										done: compliance.acknowledged,
										total: compliance.required,
									})
								: undefined
						}
						footnote={t("dashboard.kpi_compliance_note", {
							count: compliance.mandatoryPolicies,
						})}
					>
						{compliance.required > 0 && (
							<ProgressBar
								percent={compliancePercent}
								label={t("dashboard.kpi_compliance")}
							/>
						)}
					</Kpi>
					<Kpi
						label={t("dashboard.members")}
						value={data.members}
						detail={t("dashboard.in_departments", { count: data.departments })}
					/>
					<Kpi label={t("dashboard.invitations")} value={data.invitations} />
				</dl>
			)}

			<div className="flex flex-wrap items-start gap-4">
				<div className="flex min-w-0 flex-[2_1_520px] flex-col gap-4">
					{data.pendingPolicies.length > 0 && <ToDoCard policies={data.pendingPolicies} />}

					{manager && needsAttention && (
						<section className="rounded-card border border-border bg-card">
							<div className="border-b border-border px-5 py-4">
								<h2 className="text-base font-semibold">{t("dashboard.attention")}</h2>
							</div>
							<ul>
								{manager.compliance.behind.map((policy) => (
									<AttentionRow
										key={`behind-${policy.id}`}
										icon={CircleAlert}
										urgent
										primary
										title={t("dashboard.attention_behind", {
											count: policy.pending,
											title: policy.title,
										})}
										detail={t("dashboard.attention_behind_detail")}
										action={t("dashboard.attention_open_compliance")}
										href={`/policies/${policy.id}`}
									/>
								))}
								{manager.membersWithoutDepartment > 0 && data.departments > 0 && (
									<AttentionRow
										icon={UserPlus}
										title={t("dashboard.attention_no_department", {
											count: manager.membersWithoutDepartment,
										})}
										detail={t("dashboard.attention_no_department_detail")}
										action={t("dashboard.attention_assign")}
										href="/users"
									/>
								)}
								{noDepartmentsYet && (
									<AttentionRow
										icon={Building2}
										title={t("dashboard.step_departments")}
										detail={t("dashboard.step_departments_detail")}
										action={t("dashboard.step_open")}
										href="/settings"
									/>
								)}
								{noPeopleYet && (
									<AttentionRow
										icon={Mail}
										title={t("dashboard.step_invite")}
										detail={t("dashboard.step_invite_detail")}
										action={t("dashboard.step_open")}
										href="/users"
									/>
								)}
								{manager.draftPolicies.map((policy) => (
									<AttentionRow
										key={`draft-${policy.id}`}
										icon={FileText}
										title={t("dashboard.attention_draft", { title: policy.title })}
										detail={t("dashboard.attention_draft_detail")}
										action={t("dashboard.attention_review")}
										href={`/policies/${policy.id}`}
									/>
								))}
								{manager.reviewDue.map((policy) => (
									<AttentionRow
										key={`review-${policy.id}`}
										icon={CalendarClock}
										title={t("dashboard.attention_review_due", { title: policy.title })}
										detail={t("dashboard.attention_review_date", {
											date: new Date(policy.reviewDate).toLocaleDateString(language, {
												dateStyle: "medium",
												timeZone: "UTC",
											}),
										})}
										action={t("dashboard.attention_open_policy")}
										href={`/policies/${policy.id}`}
									/>
								))}
							</ul>
						</section>
					)}

					<SectionCard
						title={t("dashboard.recent")}
						linkLabel={t("dashboard.view_all")}
						href="/"
					>
						{data.recent.length === 0 ? (
							<p className="flex items-center gap-3 text-muted-foreground">
								<Megaphone size={18} aria-hidden="true" />
								{t("announcements.empty_title")}
							</p>
						) : (
							<ul className="flex flex-col gap-2.5">
								{data.recent.map((item) => (
									<li key={item.id} className="rounded-[9px] border border-border p-3">
										<div className="flex items-start justify-between gap-2">
											<span className="min-w-0 break-words font-semibold">{item.title}</span>
											{item.priority !== "normal" && (
												<PriorityBadge priority={item.priority} />
											)}
										</div>
										<p className="text-[13px] text-muted-foreground">
											{relativeTime(item.createdAt, now, language)}
										</p>
									</li>
								))}
							</ul>
						)}
					</SectionCard>
				</div>

				{manager && (
					<div className="flex min-w-0 flex-[1_1_300px] flex-col gap-4">
						{manager.compliance.departments.length > 0 && (
							<SectionCard title={t("dashboard.compliance_by_department")}>
								<ul className="flex flex-col gap-2.5 text-[13px]">
									{manager.compliance.departments.map((department) => (
										<li key={department.name}>
											<div className="flex justify-between gap-3">
												<span className="min-w-0 break-words">{department.name}</span>
												<span className="font-semibold">{department.percent}%</span>
											</div>
											<div className="mt-1">
												<ProgressBar
													percent={department.percent}
													label={department.name}
													low={department.percent < 70}
												/>
											</div>
										</li>
									))}
								</ul>
							</SectionCard>
						)}
						<SectionCard title={t("dashboard.activity")}>
							{manager.activity.length === 0 ? (
								<p className="text-muted-foreground">{t("dashboard.activity_empty")}</p>
							) : (
								<ul className="flex flex-col gap-3">
									{manager.activity.map((item) => (
										<li key={item.key} className="flex items-start gap-2.5">
											<span
												aria-hidden="true"
												className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground"
											>
												{initials(item.actor)}
											</span>
											<span className="min-w-0 flex-1 break-words">
												{t(`dashboard.activity_${item.kind}`, {
													name: item.actor,
													subject: item.subject ?? "",
												})}
												<span className="block text-xs text-muted-foreground">
													{relativeTime(item.at, now, language)}
												</span>
											</span>
										</li>
									))}
								</ul>
							)}
						</SectionCard>
					</div>
				)}
			</div>
		</div>
	);
}
