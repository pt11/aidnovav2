import { useQuery } from "@tanstack/react-query";
import {
	Building2,
	Check,
	FileText,
	Mail,
	Megaphone,
	Users,
	type LucideIcon,
} from "lucide-react";
import { Link } from "wouter";
import { api, type Me, type Membership } from "../api";
import { useI18n } from "../i18n";
import { PageError, PageHeader, PageLoading } from "../ui";
import { PriorityBadge, type Priority } from "./Announcements";

interface DashboardData {
	recent: { id: number; title: string; priority: Priority; createdAt: string }[];
	members: number;
	departments: number;
	invitations: number;
	announcements: number;
	pendingPolicies: { id: number; title: string }[];
}

function Stat({
	icon: Icon,
	label,
	value,
}: {
	icon: LucideIcon;
	label: string;
	value: number;
}) {
	return (
		<div className="flex items-center gap-3 rounded-card border border-border bg-card p-4">
			<span className="grid size-10 shrink-0 place-items-center rounded-md bg-selected text-selected-foreground">
				<Icon size={18} aria-hidden="true" />
			</span>
			<div className="min-w-0">
				<dd className="text-2xl font-semibold leading-7">{value}</dd>
				<dt className="text-xs text-muted-foreground">{label}</dt>
			</div>
		</div>
	);
}

export function DashboardPage({ me, org }: { me: Me; org: Membership }) {
	const { t, language } = useI18n();
	const dashboard = useQuery({
		queryKey: ["dashboard"],
		queryFn: () => api<DashboardData>("/dashboard"),
	});

	if (dashboard.isPending) return <PageLoading />;
	if (dashboard.isError) return <PageError onRetry={() => dashboard.refetch()} />;

	const data = dashboard.data;
	const isManager = org.role !== "staff";
	const steps = [
		{
			done: data.departments > 0,
			label: t("dashboard.step_departments"),
			href: "/settings",
		},
		{
			done: data.members > 1 || data.invitations > 0,
			label: t("dashboard.step_invite"),
			href: "/users",
		},
		{
			done: data.announcements > 0,
			label: t("dashboard.step_announce"),
			href: "/",
		},
	];
	const showSteps = isManager && steps.some((step) => !step.done);

	return (
		<div className="mx-auto max-w-5xl p-4 md:p-6">
			<PageHeader
				title={t("dashboard.welcome", { name: me.user.name })}
				subtitle={org.name}
			/>

			{isManager && (
				<dl className="mt-5 grid gap-3 sm:grid-cols-3">
					<Stat icon={Users} label={t("dashboard.members")} value={data.members} />
					<Stat
						icon={Building2}
						label={t("dashboard.departments")}
						value={data.departments}
					/>
					<Stat
						icon={Mail}
						label={t("dashboard.invitations")}
						value={data.invitations}
					/>
				</dl>
			)}

			<div
				className={`mt-5 grid items-start gap-5 ${showSteps || data.pendingPolicies.length ? "lg:grid-cols-2" : ""}`}
			>
				{data.pendingPolicies.length > 0 && (
					<section className="rounded-card border border-border bg-card p-5">
						<h2 className="font-semibold">{t("dashboard.policies_title")}</h2>
						<p className="mt-1 text-sm text-muted-foreground">
							{t("dashboard.policies_desc", { count: data.pendingPolicies.length })}
						</p>
						<ul className="mt-3 flex flex-col gap-1">
							{data.pendingPolicies.slice(0, 5).map((policy) => (
								<li key={policy.id}>
									<Link
										href={`/policies/${policy.id}`}
										className="flex min-h-10 items-center gap-2.5 rounded-md px-2 text-sm font-medium text-foreground no-underline hover:bg-muted"
									>
										<FileText
											size={16}
											aria-hidden="true"
											className="shrink-0 text-warning-foreground"
										/>
										<span className="min-w-0 break-words">{policy.title}</span>
									</Link>
								</li>
							))}
						</ul>
					</section>
				)}
				{showSteps && (
					<section className="rounded-card border border-border bg-card p-5">
						<h2 className="font-semibold">{t("dashboard.setup_title")}</h2>
						<p className="mt-1 text-sm text-muted-foreground">
							{t("dashboard.setup_desc")}
						</p>
						<ol className="mt-4 flex flex-col gap-1">
							{steps.map((step) => (
								<li key={step.href}>
									<Link
										href={step.href}
										className="flex min-h-10 items-center gap-3 rounded-md px-2 text-sm no-underline hover:bg-muted"
									>
										<span
											className={`grid size-5 shrink-0 place-items-center rounded-full border ${
												step.done
													? "border-primary bg-primary text-primary-foreground"
													: "border-input"
											}`}
										>
											{step.done && <Check size={12} aria-label={t("dashboard.done")} />}
										</span>
										<span
											className={
												step.done ? "text-muted-foreground line-through" : "font-medium"
											}
										>
											{step.label}
										</span>
									</Link>
								</li>
							))}
						</ol>
					</section>
				)}

				<section className="rounded-card border border-border bg-card p-5">
					<div className="flex items-center justify-between gap-3">
						<h2 className="font-semibold">{t("dashboard.recent")}</h2>
						{data.recent.length > 0 && (
							<Link
								href="/"
								className="text-sm font-medium text-selected-foreground no-underline hover:underline"
							>
								{t("dashboard.view_all")}
							</Link>
						)}
					</div>
					{data.recent.length === 0 ? (
						<div className="mt-4 flex items-center gap-3 text-sm text-muted-foreground">
							<Megaphone size={18} aria-hidden="true" />
							{t("announcements.empty_title")}
						</div>
					) : (
						<ul className="mt-3 flex flex-col divide-y divide-border">
							{data.recent.map((item) => (
								<li key={item.id} className="py-2.5">
									<div className="flex flex-wrap items-center gap-2">
										<span className="min-w-0 break-words text-sm font-medium">
											{item.title}
										</span>
										{item.priority !== "normal" && (
											<PriorityBadge priority={item.priority} />
										)}
									</div>
									<p className="mt-0.5 text-xs text-muted-foreground">
										{new Date(item.createdAt).toLocaleDateString(language, {
											dateStyle: "medium",
										})}
									</p>
								</li>
							))}
						</ul>
					)}
				</section>
			</div>
		</div>
	);
}
