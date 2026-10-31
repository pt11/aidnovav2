import { useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Laptop, Smartphone } from "lucide-react";
import { Link, useLocation } from "wouter";
import {
	api,
	ApiError,
	authClient,
	DEPARTMENTS_QUERY_KEY,
	ME_QUERY_KEY,
	useDepartments,
	type Department,
	type Me,
	type Membership,
} from "../api";
import { useI18n } from "../i18n";
import { useTheme } from "../Shell";
import {
	Alert,
	buttonClass,
	ConfirmModal,
	Field,
	LanguageSwitch,
	Modal,
	PageError,
	PageLoading,
	PasswordField,
	SelectField,
	TextareaField,
} from "../ui";

const ERROR_KEYS: Record<string, string> = {
	INVALID_EMAIL: "form.invalid_email",
	INVALID_WEBSITE: "form.invalid_link",
	INVALID_LINK: "form.invalid_link",
	DEPARTMENT_EXISTS: "departments.exists",
};

function errorKey(error: unknown) {
	const code = error instanceof ApiError ? error.code : "";
	return ERROR_KEYS[code] ?? "error.generic";
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

function SettingsLayout({
	canManage,
	title,
	subtitle,
	children,
}: {
	canManage: boolean;
	title: string;
	subtitle: string;
	children: ReactNode;
}) {
	const { t } = useI18n();
	const [location] = useLocation();
	const groups = [
		...(canManage
			? [
					{
						label: "settings.group_org",
						links: [
							{ href: "/settings", label: "settings.general" },
							{ href: "/settings/departments", label: "settings.departments" },
							{ href: "/settings/plan", label: "plan.title" },
						],
					},
				]
			: []),
		{
			label: "settings.group_you",
			links: [
				{ href: "/settings/profile", label: "nav.my_profile" },
				{ href: "/settings/security", label: "settings.security" },
			],
		},
	];
	return (
		<div className="mx-auto flex max-w-[1180px] flex-col gap-4 p-4 md:px-6 md:py-7">
			<h1 className="text-[26px] font-semibold leading-[34px] tracking-tight">
				{t("nav.settings")}
			</h1>
			<div className="flex flex-wrap items-start gap-6">
				<nav
					aria-label={t("settings.sections")}
					className="flex min-w-0 flex-[1_1_200px] flex-col gap-0.5 md:max-w-[220px]"
				>
					{groups.map((group, index) => (
						<div key={group.label} className={index ? "mt-3.5" : ""}>
							<p className="px-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
								{t(group.label)}
							</p>
							{group.links.map((link) => {
								const active = location === link.href;
								return (
									<Link
										key={link.href}
										href={link.href}
										aria-current={active ? "page" : undefined}
										className={`block rounded-md border px-2.5 py-[7px] text-foreground no-underline ${
											active
												? "border-border bg-card font-semibold"
												: "border-transparent hover:bg-muted"
										}`}
									>
										{t(link.label)}
									</Link>
								);
							})}
						</div>
					))}
				</nav>
				<div className="flex min-w-0 flex-[999_1_480px] flex-col gap-4">
					<div>
						<h2 className="text-lg font-semibold leading-[26px]">{title}</h2>
						<p className="mt-0.5 text-muted-foreground">{subtitle}</p>
					</div>
					{children}
				</div>
			</div>
		</div>
	);
}

interface OrgDetails {
	name: string;
	slug: string;
	email: string | null;
	phone: string | null;
	website: string | null;
	address: string | null;
}

const ORG_KEY = ["organization"];

function GeneralForm({
	details,
	canEdit,
}: {
	details: OrgDetails;
	canEdit: boolean;
}) {
	const { t } = useI18n();
	const queryClient = useQueryClient();
	const saved = {
		name: details.name,
		email: details.email ?? "",
		phone: details.phone ?? "",
		website: details.website ?? "",
		address: details.address ?? "",
	};
	const [values, setValues] = useState(saved);
	const unsaved = JSON.stringify(values) !== JSON.stringify(saved);
	const save = useMutation({
		mutationFn: () =>
			api("/organizations/current", { method: "PATCH", body: values }),
		onSuccess: () =>
			Promise.all([
				queryClient.invalidateQueries({ queryKey: ORG_KEY }),
				queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY }),
			]),
	});
	const set = (name: keyof typeof values) => (value: string) => {
		save.reset();
		setValues((current) => ({ ...current, [name]: value }));
	};

	function submit(event: FormEvent) {
		event.preventDefault();
		save.mutate();
	}

	return (
		<form onSubmit={submit} className="flex flex-col gap-4">
			<section className="flex flex-col gap-3.5 rounded-card border border-border bg-card p-5">
				<h3 className="text-[15px] font-semibold">{t("settings.organization")}</h3>
				{!canEdit && (
					<p className="text-[13px] text-muted-foreground">{t("settings.admin_only")}</p>
				)}
				{save.isError && <Alert>{t(errorKey(save.error))}</Alert>}
				<Field
					label={t("org.name")}
					required
					minLength={2}
					maxLength={255}
					disabled={!canEdit}
					value={values.name}
					onChange={(event) => set("name")(event.target.value)}
				/>
				<div className="grid gap-3.5 sm:grid-cols-2">
					<Field
						label={t("settings.contact_email")}
						type="email"
						disabled={!canEdit}
						value={values.email}
						onChange={(event) => set("email")(event.target.value)}
					/>
					<Field
						label={t("settings.phone")}
						type="tel"
						maxLength={50}
						disabled={!canEdit}
						value={values.phone}
						onChange={(event) => set("phone")(event.target.value)}
					/>
					<Field
						label={t("settings.website")}
						type="url"
						placeholder="https://"
						disabled={!canEdit}
						value={values.website}
						onChange={(event) => set("website")(event.target.value)}
					/>
					<Field
						label={t("org.slug")}
						disabled
						readOnly
						hint={t("settings.slug_hint")}
						value={details.slug}
					/>
				</div>
				<TextareaField
					label={t("settings.address")}
					rows={2}
					maxLength={1000}
					disabled={!canEdit}
					value={values.address}
					onChange={(event) => set("address")(event.target.value)}
				/>
			</section>
			{canEdit && (unsaved || save.isSuccess) && (
				<div className="sticky bottom-14 flex flex-wrap items-center justify-between gap-3 rounded-card border border-border bg-card px-4 py-3 md:bottom-3">
					<span role="status" className="text-[13px] text-muted-foreground">
						{unsaved ? t("common.unsaved") : t("common.saved")}
					</span>
					{unsaved && (
						<div className="flex gap-2">
							<button
								type="button"
								className={buttonClass("outline", "min-h-9 py-0")}
								onClick={() => setValues(saved)}
							>
								{t("common.discard")}
							</button>
							<button
								type="submit"
								disabled={save.isPending}
								className={buttonClass("primary", "min-h-9 py-0")}
							>
								{t("common.save_changes")}
							</button>
						</div>
					)}
				</div>
			)}
		</form>
	);
}

interface PlanOption {
	id: number;
	name: string;
	description: string | null;
	monthlyPrice: number;
	yearlyPrice: number;
	maxUsers: number | null;
	storageLimitGb: number | null;
}

interface PlanInfo {
	status: "trial" | "active" | "suspended" | "cancelled";
	trialEndDate: string | null;
	billingCycle: "monthly" | "yearly";
	extraUserBlocks: number;
	paidUntil: string | null;
	planName: string | null;
	maxUsers: number | null;
	storageLimitBytes: number | null;
	seats: { active: number; pending: number };
	storageUsed: number;
	plans: PlanOption[];
	pendingRequest: {
		planName: string | null;
		billingCycle: "monthly" | "yearly";
		extraUserBlocks: number;
		createdAt: string;
	} | null;
	blockPriceCents: number;
	usersPerBlock: number;
}

const PLAN_KEY = ["organization-plan"];

function formatStorage(bytes: number) {
	if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
	if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
	return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function dollars(cents: number) {
	return `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function UsageBar({ percent, label }: { percent: number; label: string }) {
	return (
		<div
			role="progressbar"
			aria-valuenow={percent}
			aria-valuemin={0}
			aria-valuemax={100}
			aria-label={label}
			className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted"
		>
			<div
				className={`h-full rounded-full ${percent >= 90 ? "bg-destructive" : "bg-primary"}`}
				style={{ width: `${percent}%` }}
			/>
		</div>
	);
}

function UpgradeForm({ info, canRequest }: { info: PlanInfo; canRequest: boolean }) {
	const { t } = useI18n();
	const queryClient = useQueryClient();
	const needed = info.seats.active + info.seats.pending;
	const fitting =
		info.plans.find((plan) => plan.maxUsers === null || plan.maxUsers >= needed) ??
		info.plans[info.plans.length - 1];
	const [planId, setPlanId] = useState(fitting?.id ?? 0);
	const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");
	const [blocks, setBlocks] = useState(0);
	const [message, setMessage] = useState("");
	const send = useMutation({
		mutationFn: () =>
			api("/organizations/current/upgrade-request", {
				method: "POST",
				body: { planId, billingCycle: cycle, extraUserBlocks: blocks, message },
			}),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: PLAN_KEY }),
	});
	const plan = info.plans.find((option) => option.id === planId);
	const monthly = plan ? plan.monthlyPrice + blocks * info.blockPriceCents : 0;
	const yearly = plan ? plan.yearlyPrice + blocks * info.blockPriceCents * 10 : 0;

	function submit(event: FormEvent) {
		event.preventDefault();
		send.mutate();
	}

	return (
		<form onSubmit={submit} className="flex flex-col gap-3.5 rounded-card border border-border bg-card p-5">
			<h3 className="text-[15px] font-semibold">{t("plan.choose")}</h3>
			{send.isError && <Alert>{t("error.generic")}</Alert>}
			<div role="group" aria-label={t("plan.billing")} className="inline-flex self-start rounded-md border border-border bg-muted p-0.5">
				{(["monthly", "yearly"] as const).map((option) => (
					<button
						key={option}
						type="button"
						aria-pressed={cycle === option}
						onClick={() => setCycle(option)}
						className={`rounded px-3 py-1 text-[13px] font-medium ${
							cycle === option ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
						}`}
					>
						{t(`plan.${option}`)}
					</button>
				))}
			</div>
			<div className="grid gap-3 sm:grid-cols-2">
				{info.plans.map((option) => (
					<label
						key={option.id}
						className={`flex cursor-pointer items-start gap-2.5 rounded-[9px] p-3 ${
							planId === option.id ? "border-2 border-primary" : "border border-input"
						}`}
					>
						<input
							type="radio"
							name="plan-choice"
							className="mt-1 accent-primary"
							checked={planId === option.id}
							onChange={() => setPlanId(option.id)}
						/>
						<span className="min-w-0">
							<span className="block font-semibold">{option.name}</span>
							<span className="block font-medium">
								{cycle === "monthly"
									? t("plan.per_month", { price: dollars(option.monthlyPrice) })
									: t("plan.per_year", { price: dollars(option.yearlyPrice) })}
							</span>
							<span className="block text-[13px] text-muted-foreground">
								{t("plan.includes", {
									users: option.maxUsers ?? "∞",
									storage: option.storageLimitGb ?? "∞",
								})}
							</span>
						</span>
					</label>
				))}
			</div>
			<SelectField
				label={t("plan.extra_users")}
				value={blocks}
				onChange={(event) => setBlocks(Number(event.target.value))}
			>
				{Array.from({ length: 9 }, (_, count) => (
					<option key={count} value={count}>
						{count === 0
							? t("plan.no_extra")
							: t("plan.extra_option", {
									users: count * info.usersPerBlock,
									price: dollars(count * info.blockPriceCents),
								})}
					</option>
				))}
			</SelectField>
			{plan && (
				<p className="font-semibold">
					{t("plan.total")}:{" "}
					{cycle === "monthly"
						? t("plan.per_month", { price: dollars(monthly) })
						: t("plan.per_year", { price: dollars(yearly) })}
				</p>
			)}
			<TextareaField
				label={t("plan.message")}
				rows={2}
				maxLength={1000}
				value={message}
				onChange={(event) => setMessage(event.target.value)}
			/>
			<p className="text-[13px] text-muted-foreground">{t("plan.no_payment")}</p>
			{canRequest ? (
				<button type="submit" disabled={send.isPending || !plan} className={buttonClass("primary", "self-start")}>
					{t("plan.send")}
				</button>
			) : (
				<p className="text-[13px] font-medium">{t("plan.admin_only")}</p>
			)}
		</form>
	);
}

export function SettingsPlanPage({ org }: { org: Membership }) {
	const { t, language } = useI18n();
	const plan = useQuery({
		queryKey: PLAN_KEY,
		queryFn: () => api<PlanInfo>("/organizations/current/plan"),
	});
	const data = plan.data;
	const used = data ? data.seats.active + data.seats.pending : 0;
	const date = (value: string) =>
		new Date(value).toLocaleDateString(language, { dateStyle: "long" });
	return (
		<SettingsLayout canManage title={t("plan.title")} subtitle={t("plan.desc")}>
			{plan.isPending && <PageLoading />}
			{plan.isError && <PageError onRetry={() => plan.refetch()} />}
			{data && (
				<>
					<section className="rounded-card border border-border bg-card p-5">
						<p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
							{t("plan.current")}
						</p>
						<p className="mt-1 text-lg font-semibold">
							{data.planName ?? t("shell.free_trial")}
							{data.planName && ` · ${t(`plan.${data.billingCycle}`)}`}
						</p>
						{data.status === "trial" && data.trialEndDate && (
							<p className="text-[13px] text-muted-foreground">
								{t("plan.trial_ends", { date: date(data.trialEndDate) })}
							</p>
						)}
						{data.paidUntil && (
							<p className="text-[13px] text-muted-foreground">
								{t("plan.paid_until", { date: date(data.paidUntil) })}
							</p>
						)}
					</section>
					<section className="grid gap-4 rounded-card border border-border bg-card p-5 sm:grid-cols-2">
						<div>
							<p className="font-semibold">{t("departments.staff")}</p>
							<p className="text-[13px] text-muted-foreground">
								{data.maxUsers === null
									? t("plan.seats_unlimited", { used })
									: t("plan.seats", { used, limit: data.maxUsers })}
							</p>
							{data.maxUsers !== null && data.maxUsers > 0 && (
								<UsageBar
									percent={Math.min(100, Math.round((used / data.maxUsers) * 100))}
									label={t("departments.staff")}
								/>
							)}
							<p className="mt-1 text-xs text-muted-foreground">
								{t("plan.seats_detail", {
									active: data.seats.active,
									pending: data.seats.pending,
								})}
							</p>
						</div>
						<div>
							<p className="font-semibold">{t("files.storage")}</p>
							<p className="text-[13px] text-muted-foreground">
								{data.storageLimitBytes === null
									? formatStorage(data.storageUsed)
									: t("files.storage_used", {
											used: formatStorage(data.storageUsed),
											limit: formatStorage(data.storageLimitBytes),
										})}
							</p>
							{data.storageLimitBytes !== null && data.storageLimitBytes > 0 && (
								<UsageBar
									percent={Math.min(
										100,
										Math.round((data.storageUsed / data.storageLimitBytes) * 100),
									)}
									label={t("files.storage")}
								/>
							)}
						</div>
					</section>
					{data.pendingRequest ? (
						<section role="status" className="rounded-card border border-border bg-selected p-5">
							<p className="font-semibold">{t("plan.request_waiting")}</p>
							<p className="mt-1 text-[13px]">
								{t("plan.request_detail", {
									plan: data.pendingRequest.planName ?? "",
									cycle: t(`plan.${data.pendingRequest.billingCycle}`),
									date: date(data.pendingRequest.createdAt),
								})}
							</p>
						</section>
					) : (
						<UpgradeForm info={data} canRequest={org.role === "admin"} />
					)}
				</>
			)}
		</SettingsLayout>
	);
}

export function SettingsGeneralPage({ org }: { org: Membership }) {
	const { t } = useI18n();
	const details = useQuery({
		queryKey: ORG_KEY,
		queryFn: () => api<OrgDetails>("/organizations/current"),
	});
	return (
		<SettingsLayout
			canManage
			title={t("settings.general")}
			subtitle={t("settings.general_desc")}
		>
			{details.isPending && <PageLoading />}
			{details.isError && <PageError onRetry={() => details.refetch()} />}
			{details.data && (
				<GeneralForm details={details.data} canEdit={org.role === "admin"} />
			)}
		</SettingsLayout>
	);
}

function DepartmentEditForm({
	department,
	onDone,
}: {
	department: Department;
	onDone: () => void;
}) {
	const { t } = useI18n();
	const queryClient = useQueryClient();
	const [name, setName] = useState(department.name);
	const [description, setDescription] = useState(department.description ?? "");
	const save = useMutation({
		mutationFn: () =>
			api(`/organizations/current/departments/${department.id}`, {
				method: "PATCH",
				body: { name, description },
			}),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: DEPARTMENTS_QUERY_KEY });
			onDone();
		},
	});

	function submit(event: FormEvent) {
		event.preventDefault();
		save.mutate();
	}

	return (
		<form onSubmit={submit} className="flex flex-col gap-4">
			{save.isError && <Alert>{t(errorKey(save.error))}</Alert>}
			<Field
				label={t("departments.name")}
				required
				maxLength={255}
				value={name}
				onChange={(event) => setName(event.target.value)}
			/>
			<TextareaField
				label={t("departments.description")}
				rows={3}
				maxLength={1000}
				value={description}
				onChange={(event) => setDescription(event.target.value)}
			/>
			<div className="flex justify-end gap-2">
				<button type="button" className={buttonClass("outline")} onClick={onDone}>
					{t("common.cancel")}
				</button>
				<button type="submit" disabled={save.isPending} className={buttonClass()}>
					{t("common.save")}
				</button>
			</div>
		</form>
	);
}

export function SettingsDepartmentsPage() {
	const { t } = useI18n();
	const queryClient = useQueryClient();
	const departments = useDepartments();
	const members = useQuery({
		queryKey: ["members"],
		queryFn: () =>
			api<{ members: { departmentId: number | null; isActive: boolean }[] }>(
				"/organizations/current/members",
			),
	});
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [editing, setEditing] = useState<Department | null>(null);
	const [deleting, setDeleting] = useState<Department | null>(null);
	const refresh = () =>
		Promise.all([
			queryClient.invalidateQueries({ queryKey: DEPARTMENTS_QUERY_KEY }),
			queryClient.invalidateQueries({ queryKey: ["members"] }),
		]);
	const add = useMutation({
		mutationFn: () =>
			api("/organizations/current/departments", {
				method: "POST",
				body: { name, description },
			}),
		onSuccess: async () => {
			setName("");
			setDescription("");
			await refresh();
		},
	});
	const remove = useMutation({
		mutationFn: (id: number) =>
			api(`/organizations/current/departments/${id}`, { method: "DELETE" }),
		onSuccess: async () => {
			await refresh();
			setDeleting(null);
		},
	});
	const unassigned =
		members.data?.members.filter(
			(member) => member.isActive && member.departmentId === null,
		).length ?? 0;

	function submit(event: FormEvent) {
		event.preventDefault();
		add.mutate();
	}

	return (
		<SettingsLayout
			canManage
			title={t("settings.departments")}
			subtitle={t("departments.subtitle")}
		>
			<form
				onSubmit={submit}
				className="flex flex-wrap items-start gap-2 rounded-card border border-border bg-card px-4 py-3.5"
			>
				<div className="min-w-0 flex-[1_1_200px]">
					<Field
						label={t("departments.name")}
						placeholder={t("departments.name_placeholder")}
						required
						maxLength={255}
						value={name}
						onChange={(event) => setName(event.target.value)}
					/>
				</div>
				<div className="min-w-0 flex-[2_1_260px]">
					<Field
						label={t("departments.description")}
						placeholder={t("departments.description_placeholder")}
						maxLength={1000}
						value={description}
						onChange={(event) => setDescription(event.target.value)}
					/>
				</div>
				<button
					type="submit"
					disabled={add.isPending}
					className={buttonClass("primary", "mt-[28px]")}
				>
					{t("departments.add")}
				</button>
				{add.isError && (
					<div className="w-full">
						<Alert>{t(errorKey(add.error))}</Alert>
					</div>
				)}
			</form>

			{departments.isPending && <PageLoading />}
			{departments.isError && <PageError onRetry={() => departments.refetch()} />}
			{departments.data && (
				<div className="overflow-x-auto rounded-card border border-border bg-card">
					<table className="w-full min-w-[480px] text-left">
						<thead className="bg-background text-xs text-muted-foreground">
							<tr>
								<th scope="col" className="px-4 py-2.5 font-semibold">
									{t("users.department")}
								</th>
								<th scope="col" className="px-2 py-2.5 font-semibold">
									{t("departments.staff")}
								</th>
								<th scope="col" className="px-4 py-2.5">
									<span className="sr-only">{t("policies.actions")}</span>
								</th>
							</tr>
						</thead>
						<tbody>
							{departments.data.map((department) => (
								<tr key={department.id} className="border-t border-border">
									<td className="px-4 py-3">
										<p className="break-words font-semibold">{department.name}</p>
										{department.description && (
											<p className="break-words text-xs text-muted-foreground">
												{department.description}
											</p>
										)}
									</td>
									<td className="px-2 py-3">{department.memberCount}</td>
									<td className="px-4 py-3">
										<div className="flex justify-end gap-1.5">
											<button
												type="button"
												aria-label={`${t("common.edit")}: ${department.name}`}
												className={buttonClass("outline", "min-h-[30px] px-2.5 py-0 text-xs font-medium")}
												onClick={() => setEditing(department)}
											>
												{t("common.edit")}
											</button>
											<button
												type="button"
												aria-label={`${t("common.delete")}: ${department.name}`}
												className="min-h-[30px] rounded-md px-2.5 text-xs font-medium text-danger-foreground hover:bg-danger-surface"
												onClick={() => {
													remove.reset();
													setDeleting(department);
												}}
											>
												{t("common.delete")}
											</button>
										</div>
									</td>
								</tr>
							))}
							{unassigned > 0 && (
								<tr className="border-t border-border bg-background">
									<td className="px-4 py-3">
										<p className="font-semibold text-danger-foreground">
											{t("users.no_department")}
										</p>
										<p className="text-xs text-muted-foreground">
											{t("dashboard.attention_no_department_detail")}
										</p>
									</td>
									<td className="px-2 py-3 font-semibold">{unassigned}</td>
									<td className="px-4 py-3 text-right">
										<Link
											href="/users"
											className={buttonClass("primary", "min-h-[30px] px-2.5 py-0 text-xs font-medium")}
										>
											{t("departments.assign_people")}
										</Link>
									</td>
								</tr>
							)}
						</tbody>
					</table>
				</div>
			)}

			<Modal
				title={t("departments.edit")}
				open={editing !== null}
				onClose={() => setEditing(null)}
			>
				{editing && (
					<DepartmentEditForm department={editing} onDone={() => setEditing(null)} />
				)}
			</Modal>
			<ConfirmModal
				title={t("departments.delete_title_named", { name: deleting?.name ?? "" })}
				description={
					remove.error instanceof ApiError &&
					remove.error.code === "DEPARTMENT_IN_USE"
						? t("departments.in_use")
						: deleting && deleting.memberCount > 0
							? t("departments.delete_with_people", { count: deleting.memberCount })
							: t("departments.delete_empty")
				}
				confirmLabel={t("common.delete")}
				open={deleting !== null}
				pending={remove.isPending}
				failed={
					remove.isError &&
					!(remove.error instanceof ApiError && remove.error.code === "DEPARTMENT_IN_USE")
				}
				onConfirm={() => deleting && remove.mutate(deleting.id)}
				onClose={() => setDeleting(null)}
			/>
		</SettingsLayout>
	);
}

interface Profile {
	position: string | null;
	bio: string | null;
	contactEmail: string | null;
	viberLink: string | null;
	facebookLink: string | null;
	departmentName: string | null;
}

const PROFILE_KEY = ["my-profile"];
const BIO_LIMIT = 300;

function ProfileForm({ me, profile }: { me: Me; profile: Profile }) {
	const { t } = useI18n();
	const queryClient = useQueryClient();
	const [values, setValues] = useState({
		name: me.user.name,
		position: profile.position ?? "",
		bio: profile.bio ?? "",
		contactEmail: profile.contactEmail ?? "",
		viberLink: profile.viberLink ?? "",
		facebookLink: profile.facebookLink ?? "",
	});
	const save = useMutation({
		mutationFn: () => api("/me/profile", { method: "PATCH", body: values }),
		onSuccess: () =>
			Promise.all([
				queryClient.invalidateQueries({ queryKey: PROFILE_KEY }),
				queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY }),
			]),
	});
	const set = (name: keyof typeof values) => (value: string) => {
		save.reset();
		setValues((current) => ({ ...current, [name]: value }));
	};

	function submit(event: FormEvent) {
		event.preventDefault();
		save.mutate();
	}

	const contactLinks = [
		values.contactEmail && t("users.email"),
		values.viberLink && t("profile.viber_short"),
		values.facebookLink && t("profile.facebook_short"),
	].filter(Boolean);

	return (
		<div className="flex flex-wrap items-start gap-4">
			<form
				onSubmit={submit}
				className="flex min-w-0 flex-[999_1_360px] flex-col gap-3.5 rounded-card border border-border bg-card p-5"
			>
				{save.isError && <Alert>{t(errorKey(save.error))}</Alert>}
				<Field
					label={t("auth.name")}
					autoComplete="name"
					required
					maxLength={255}
					value={values.name}
					onChange={(event) => set("name")(event.target.value)}
				/>
				<Field
					label={t("profile.position")}
					maxLength={255}
					value={values.position}
					onChange={(event) => set("position")(event.target.value)}
				/>
				<TextareaField
					label={`${t("profile.bio")} · ${values.bio.length} / ${BIO_LIMIT}`}
					maxLength={BIO_LIMIT}
					value={values.bio}
					onChange={(event) => set("bio")(event.target.value)}
				/>
				<Field
					label={t("profile.contact_email")}
					type="email"
					hint={t("profile.contact_email_hint")}
					value={values.contactEmail}
					onChange={(event) => set("contactEmail")(event.target.value)}
				/>
				<div className="grid gap-3.5 sm:grid-cols-2">
					<Field
						label={t("profile.viber")}
						type="url"
						placeholder="https://"
						value={values.viberLink}
						onChange={(event) => set("viberLink")(event.target.value)}
					/>
					<Field
						label={t("profile.facebook")}
						type="url"
						placeholder="https://"
						value={values.facebookLink}
						onChange={(event) => set("facebookLink")(event.target.value)}
					/>
				</div>
				<div className="flex items-center gap-3">
					<button type="submit" disabled={save.isPending} className={buttonClass()}>
						{t("profile.save")}
					</button>
					{save.isSuccess && (
						<p role="status" className="text-[13px] text-muted-foreground">
							{t("common.saved")}
						</p>
					)}
				</div>
			</form>
			<aside className="flex min-w-0 flex-[1_1_240px] flex-col gap-2 rounded-card border border-border bg-card p-4">
				<p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
					{t("profile.preview")}
				</p>
				<span
					aria-hidden="true"
					className="grid size-12 place-items-center rounded-full bg-primary font-semibold text-primary-foreground"
				>
					{initials(values.name)}
				</span>
				<p className="break-words font-semibold">{values.name}</p>
				{(values.position || profile.departmentName) && (
					<p className="break-words text-[13px] text-muted-foreground">
						{[values.position, profile.departmentName].filter(Boolean).join(" · ")}
					</p>
				)}
				{values.bio && <p className="whitespace-pre-wrap break-words text-[13px]">{values.bio}</p>}
				{contactLinks.length > 0 && (
					<p className="text-[13px] text-selected-foreground">{contactLinks.join(" · ")}</p>
				)}
			</aside>
		</div>
	);
}

export function SettingsProfilePage({ me, org }: { me: Me; org: Membership }) {
	const { t } = useI18n();
	const profile = useQuery({
		queryKey: PROFILE_KEY,
		queryFn: () => api<Profile>("/me/profile"),
	});
	return (
		<SettingsLayout
			canManage={org.role !== "staff"}
			title={t("nav.my_profile")}
			subtitle={t("profile.desc", { organization: org.name })}
		>
			{profile.isPending && <PageLoading />}
			{profile.isError && <PageError onRetry={() => profile.refetch()} />}
			{profile.data && <ProfileForm me={me} profile={profile.data} />}
		</SettingsLayout>
	);
}

function PasswordRow() {
	const { t } = useI18n();
	const [open, setOpen] = useState(false);
	const [currentPassword, setCurrentPassword] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [status, setStatus] = useState<"idle" | "saving" | "saved" | "wrong" | "failed">("idle");

	async function submit(event: FormEvent) {
		event.preventDefault();
		setStatus("saving");
		const result = await authClient.changePassword({
			currentPassword,
			newPassword,
			revokeOtherSessions: true,
		});
		if (result.error) {
			setStatus(result.error.code === "INVALID_PASSWORD" ? "wrong" : "failed");
			return;
		}
		setCurrentPassword("");
		setNewPassword("");
		setOpen(false);
		setStatus("saved");
	}

	return (
		<div className="border-t border-border px-5 py-4">
			<div className="flex flex-wrap items-center gap-3">
				<div className="min-w-0 flex-[1_1_240px]">
					<p className="font-semibold">{t("auth.password")}</p>
					<p className="text-[13px] text-muted-foreground">
						{status === "saved" ? t("profile.password_changed") : t("profile.password_desc")}
					</p>
				</div>
				<button
					type="button"
					aria-expanded={open}
					className={buttonClass("outline", "min-h-[34px] px-3 py-0 text-[13px] font-medium")}
					onClick={() => setOpen((value) => !value)}
				>
					{t("profile.password_title")}
				</button>
			</div>
			{open && (
				<form onSubmit={submit} className="mt-3.5 flex max-w-md flex-col gap-3">
					{status === "wrong" && <Alert>{t("profile.password_wrong")}</Alert>}
					{status === "failed" && <Alert>{t("error.generic")}</Alert>}
					<PasswordField
						label={t("profile.password_current")}
						autoComplete="current-password"
						required
						value={currentPassword}
						onChange={(event) => setCurrentPassword(event.target.value)}
					/>
					<PasswordField
						label={t("profile.password_new")}
						autoComplete="new-password"
						hint={t("auth.password_hint")}
						required
						minLength={8}
						value={newPassword}
						onChange={(event) => setNewPassword(event.target.value)}
					/>
					<button
						type="submit"
						disabled={status === "saving"}
						className={buttonClass("primary", "self-start")}
					>
						{t("profile.password_button")}
					</button>
				</form>
			)}
		</div>
	);
}

function describeDevice(userAgent: string | null | undefined) {
	const agent = userAgent ?? "";
	const browser = /Edg\//.test(agent)
		? "Edge"
		: /Chrome\//.test(agent)
			? "Chrome"
			: /Firefox\//.test(agent)
				? "Firefox"
				: /Safari\//.test(agent)
					? "Safari"
					: null;
	const system = /Android/.test(agent)
		? "Android"
		: /iPhone|iPad/.test(agent)
			? "iOS"
			: /Windows/.test(agent)
				? "Windows"
				: /Mac OS X/.test(agent)
					? "Mac"
					: /Linux/.test(agent)
						? "Linux"
						: null;
	return {
		label: [browser, system].filter(Boolean).join(" · "),
		mobile: /Android|iPhone|iPad/.test(agent),
	};
}

function SessionsSection() {
	const { t, language } = useI18n();
	const sessions = useQuery({
		queryKey: ["sessions"],
		queryFn: async () => {
			const [list, current] = await Promise.all([
				authClient.listSessions(),
				authClient.getSession(),
			]);
			if (list.error) throw new Error(list.error.message);
			return {
				sessions: list.data ?? [],
				currentToken: current.data?.session.token ?? null,
			};
		},
	});
	const signOutOthers = useMutation({
		mutationFn: async () => {
			const result = await authClient.revokeOtherSessions();
			if (result.error) throw new Error(result.error.message);
		},
		onSettled: () => sessions.refetch(),
	});
	const signOutOne = useMutation({
		mutationFn: async (token: string) => {
			const result = await authClient.revokeSession({ token });
			if (result.error) throw new Error(result.error.message);
		},
		onSettled: () => sessions.refetch(),
	});

	return (
		<section className="rounded-card border border-border bg-card px-5 py-4">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<h3 className="text-[15px] font-semibold">{t("settings.where_signed_in")}</h3>
				{(sessions.data?.sessions.length ?? 0) > 1 && (
					<button
						type="button"
						disabled={signOutOthers.isPending}
						className={buttonClass("outline", "min-h-8 px-3 py-0 text-[13px] font-medium")}
						onClick={() => signOutOthers.mutate()}
					>
						{t("settings.sign_out_others")}
					</button>
				)}
			</div>
			{(signOutOthers.isError || signOutOne.isError) && (
				<div className="mt-3">
					<Alert>{t("error.generic")}</Alert>
				</div>
			)}
			{sessions.isPending && <PageLoading />}
			{sessions.isError && <PageError onRetry={() => sessions.refetch()} />}
			<ul className="mt-3 flex flex-col gap-2.5 text-[13px]">
				{sessions.data?.sessions.map((session) => {
					const device = describeDevice(session.userAgent);
					const current = session.token === sessions.data?.currentToken;
					return (
						<li key={session.token} className="flex items-center gap-2.5">
							<span className="grid size-8 shrink-0 place-items-center rounded-md bg-muted">
								{device.mobile ? (
									<Smartphone size={16} aria-hidden="true" />
								) : (
									<Laptop size={16} aria-hidden="true" />
								)}
							</span>
							<span className="min-w-0 flex-1">
								<span className="block font-semibold">
									{device.label || t("settings.unknown_device")}
								</span>
								<span className="block text-muted-foreground">
									{current
										? t("settings.this_device")
										: new Date(session.updatedAt).toLocaleDateString(language, {
												dateStyle: "medium",
											})}
								</span>
							</span>
							{!current && (
								<button
									type="button"
									disabled={signOutOne.isPending}
									className="min-h-[30px] rounded-md px-2.5 text-xs font-medium text-danger-foreground hover:bg-danger-surface"
									onClick={() => signOutOne.mutate(session.token)}
								>
									{t("settings.sign_out")}
								</button>
							)}
						</li>
					);
				})}
			</ul>
		</section>
	);
}

function OrganizationsSection({ me, org }: { me: Me; org: Membership }) {
	const { t } = useI18n();
	const queryClient = useQueryClient();
	const switchOrg = useMutation({
		mutationFn: (organizationId: number) =>
			api("/organizations/switch", { method: "POST", body: { organizationId } }),
		onSuccess: () => {
			queryClient.clear();
			window.location.assign("/");
		},
	});
	return (
		<section className="rounded-card border border-border bg-card px-5 py-4">
			<h3 className="text-[15px] font-semibold">{t("settings.your_organizations")}</h3>
			<ul className="mt-3 flex flex-col gap-2.5 text-[13px]">
				{me.memberships.map((membership) => (
					<li key={membership.organizationId} className="flex items-center gap-2.5">
						<span
							aria-hidden="true"
							className="grid size-8 shrink-0 place-items-center rounded-md bg-foreground text-[11px] font-semibold text-background"
						>
							{initials(membership.name)}
						</span>
						<span className="min-w-0 flex-1 break-words">
							<b className="font-semibold">{membership.name}</b> · {t(`role.${membership.role}`)}
						</span>
						{membership.organizationId === org.organizationId ? (
							<span className="rounded-full bg-primary px-2 text-[11px] font-semibold text-primary-foreground">
								{t("settings.current")}
							</span>
						) : (
							<button
								type="button"
								disabled={switchOrg.isPending}
								className="font-medium text-selected-foreground hover:underline"
								onClick={() => switchOrg.mutate(membership.organizationId)}
							>
								{t("settings.switch")}
							</button>
						)}
					</li>
				))}
			</ul>
		</section>
	);
}

export function SettingsSecurityPage({ me, org }: { me: Me; org: Membership }) {
	const { t } = useI18n();
	const { dark, setDark } = useTheme();
	return (
		<SettingsLayout
			canManage={org.role !== "staff"}
			title={t("settings.security")}
			subtitle={t("settings.security_desc")}
		>
			<section className="rounded-card border border-border bg-card">
				<div className="px-5 py-4">
					<p className="font-semibold">{t("settings.sign_in_email")}</p>
					<p className="break-all text-[13px] text-muted-foreground">{me.user.email}</p>
				</div>
				<PasswordRow />
			</section>
			<SessionsSection />
			<OrganizationsSection me={me} org={org} />
			<section className="flex flex-wrap gap-6 rounded-card border border-border bg-card px-5 py-4">
				<h3 className="w-full text-[15px] font-semibold">{t("settings.preferences")}</h3>
				<div>
					<p className="pb-1.5 text-[13px] font-medium">{t("shell.language")}</p>
					<LanguageSwitch />
				</div>
				<div>
					<p className="pb-1.5 text-[13px] font-medium">{t("settings.theme")}</p>
					<div className="inline-flex rounded-md border border-border bg-muted p-0.5">
						{[false, true].map((option) => (
							<button
								key={String(option)}
								type="button"
								aria-pressed={dark === option}
								onClick={() => setDark(option)}
								className={`rounded px-2.5 py-0.5 text-xs font-medium ${
									dark === option
										? "bg-card text-foreground shadow-sm"
										: "text-muted-foreground"
								}`}
							>
								{t(option ? "settings.theme_dark" : "settings.theme_light")}
							</button>
						))}
					</div>
				</div>
			</section>
		</SettingsLayout>
	);
}
