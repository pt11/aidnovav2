import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { api, ApiError, authClient, type Me } from "../api";
import {
	Chip,
	SearchField,
	BUTTON_SMALL,
	Alert,
	buttonClass,
	Field,
	LOGO,
	Modal,
	PageError,
	PageLoading,
	SelectField,
	TextareaField,
} from "../ui";

// These screens are only for the AidNova team, so they're in English only.

interface PendingRequest {
	id: number;
	organizationId?: number;
	organizationName?: string;
	planId?: number | null;
	planName: string | null;
	billingCycle: "monthly" | "yearly";
	extraUserBlocks: number;
	message?: string | null;
	createdAt: string;
}

interface Overview {
	organizations: Record<"trial" | "active" | "suspended" | "cancelled", number>;
	users: number;
	activeUsers: number;
	newUsers: number;
	newOrganizations: number;
	storageUsed: number;
	requests: PendingRequest[];
	trials: { id: number; name: string; trialEndDate: string | null }[];
	plans: { name: string; total: number }[];
}

type OrgStatus = "trial" | "active" | "suspended" | "cancelled";

interface Organization {
	id: number;
	name: string;
	slug: string;
	status: OrgStatus;
	trialEndDate: string | null;
	paidUntil: string | null;
	billingCycle: "monthly" | "yearly";
	extraUserBlocks: number;
	customMaxUsers: number | null;
	customStorageGb: number | null;
	planId: number | null;
	planName: string | null;
	createdAt: string;
	ownerName: string;
	ownerEmail: string;
	maxUsers: number | null;
	storageLimitBytes: number | null;
	activeMembers: number;
	members: number;
	storageUsed: number;
	fileCount: number;
	policyCount: number;
	request: PendingRequest | null;
}

interface Plan {
	id: number;
	name: string;
	description: string | null;
	monthlyPrice: number;
	yearlyPrice: number;
	maxUsers: number | null;
	storageLimitGb: number | null;
	isActive: boolean;
	sortOrder: number;
	organizations: number;
}

const ORGS_KEY = ["superadmin", "organizations"];
const OVERVIEW_KEY = ["superadmin", "overview"];
const PLANS_KEY = ["superadmin", "plans"];

function formatBytes(bytes: number) {
	if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
	if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
	return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function formatDate(value: string | number | null) {
	if (!value) return "—";
	return new Date(value).toLocaleDateString("en-GB", { dateStyle: "medium" });
}

function plural(total: number, word: string) {
	return `${total} ${word}${total === 1 ? "" : "s"}`;
}

function money(cents: number) {
	return `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function usePendingCount() {
	const overview = useQuery({
		queryKey: OVERVIEW_KEY,
		queryFn: () => api<Overview>("/superadmin/overview"),
	});
	return overview.data?.requests.length ?? 0;
}

const NAV = [
	{ href: "/superadmin", label: "Overview" },
	{ href: "/superadmin/organizations", label: "Organizations" },
	{ href: "/superadmin/users", label: "Users" },
	{ href: "/superadmin/plans", label: "Plans" },
	{ href: "/superadmin/storage", label: "Storage" },
];

function Layout({
	me,
	title,
	subtitle,
	action,
	children,
}: {
	me: Me;
	title: string;
	subtitle?: string;
	action?: ReactNode;
	children: ReactNode;
}) {
	const [location] = useLocation();
	const queryClient = useQueryClient();
	const pending = usePendingCount();

	async function signOut() {
		await authClient.signOut();
		queryClient.clear();
		window.location.assign("/sign-in");
	}

	return (
		<div className="flex min-h-dvh flex-col bg-background md:flex-row">
			<aside className="flex shrink-0 flex-col bg-[#101219] px-3 py-4 text-[#F3F4F7] md:sticky md:top-0 md:h-dvh md:w-[248px]">
				<div className="flex items-center gap-2.5 px-1.5 py-1">
					<img src={LOGO} alt="" width="30" height="30" className="rounded-md" />
					<span className="leading-tight">
						<span className="block font-semibold">AidNova</span>
						<span className="block text-[11px] font-semibold tracking-[0.06em] text-[#A9B4C4]">
							PLATFORM ADMIN
						</span>
					</span>
				</div>
				<nav aria-label="Platform" className="mt-4 flex flex-row flex-wrap gap-0.5 md:flex-col">
					{NAV.map((item) => {
						const active = location === item.href;
						return (
							<Link
								key={item.href}
								href={item.href}
								aria-current={active ? "page" : undefined}
								className={`flex items-center gap-2 rounded-md px-2.5 py-2 no-underline ${
									active
										? "bg-[#4E81EF] font-semibold text-[#030711]"
										: "text-[#F3F4F7] hover:bg-white/10"
								}`}
							>
								<span className="flex-1">{item.label}</span>
								{item.label === "Organizations" && pending > 0 && (
									<span className="rounded-full bg-[#DC2828] px-[7px] text-[11px] font-bold text-white">
										{pending}
									</span>
								)}
							</Link>
						);
					})}
				</nav>
				<div className="mt-4 flex flex-col gap-2 border-t border-white/15 px-1.5 pt-2 text-xs text-[#A9B4C4] md:mt-auto">
					<p>Signed in as a superadmin. Changes here affect every organization.</p>
					{me.memberships.length > 0 && (
						<Link href="/dashboard" className="font-medium text-[#F3F4F7] no-underline hover:underline">
							← Back to my organization
						</Link>
					)}
					<p className="min-w-0 break-all">{me.user.email}</p>
					<button
						type="button"
						onClick={signOut}
						className="self-start font-medium text-[#F3F4F7] hover:underline"
					>
						Sign out
					</button>
				</div>
			</aside>
			<main className="flex min-w-0 flex-1 flex-col gap-4 p-4 md:px-6 md:py-7">
				<div className="flex flex-wrap items-end justify-between gap-3">
					<div>
						<h1 className="text-[26px] font-semibold leading-[34px] tracking-tight">{title}</h1>
						{subtitle && <p className="mt-0.5 text-muted-foreground">{subtitle}</p>}
					</div>
					{action}
				</div>
				{children}
			</main>
		</div>
	);
}

function StatCard({ label, value, detail }: { label: string; value: ReactNode; detail?: string }) {
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

function StatusChip({ status }: { status: OrgStatus }) {
	const tones = { trial: "neutral", active: "success", suspended: "danger", cancelled: "outline" } as const;
	return <Chip tone={tones[status]}><span className="capitalize">{status}</span></Chip>;
}

function useDecide() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ id, decision }: { id: number; decision: "approve" | "dismiss" }) =>
			api(`/superadmin/upgrade-requests/${id}/${decision}`, { method: "POST" }),
		onSettled: () => queryClient.invalidateQueries({ queryKey: ["superadmin"] }),
	});
}

function describeRequest(request: PendingRequest) {
	const users = request.extraUserBlocks ? ` + ${request.extraUserBlocks * 25} users` : "";
	return `${request.planName ?? "Plan"}${users} · ${request.billingCycle}`;
}

export function SuperOverviewPage({ me }: { me: Me }) {
	const overview = useQuery({
		queryKey: OVERVIEW_KEY,
		queryFn: () => api<Overview>("/superadmin/overview"),
	});
	const decide = useDecide();
	const data = overview.data;
	const totalOrgs = data ? Object.values(data.organizations).reduce((a, b) => a + b, 0) : 0;
	return (
		<Layout
			me={me}
			title="Platform overview"
			subtitle={new Date().toLocaleDateString("en-GB", { dateStyle: "full" })}
		>
			{overview.isPending && <PageLoading />}
			{overview.isError && <PageError onRetry={() => overview.refetch()} />}
			{data && (
				<>
					<dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
						<StatCard
							label="Organizations"
							value={totalOrgs}
							detail={`${data.organizations.active} active · ${data.organizations.trial} trial · ${data.organizations.suspended} suspended`}
						/>
						<StatCard
							label="New in the last 30 days"
							value={data.newUsers}
							detail={`users · ${data.newOrganizations} new ${data.newOrganizations === 1 ? "organization" : "organizations"}`}
						/>
						<StatCard label="Total users" value={data.users} detail={`${data.activeUsers} active`} />
						<StatCard
							label="Storage used"
							value={formatBytes(data.storageUsed)}
							detail="across all organizations"
						/>
					</dl>
					<div className="flex flex-wrap items-start gap-4">
						<section className="min-w-0 flex-[1_1_360px] rounded-card border border-border bg-card">
							<h2 className="border-b border-border px-4 py-3.5 text-[15px] font-semibold">
								Upgrade requests
							</h2>
							{decide.isError && (
								<div className="px-4 pt-3">
									<Alert>That didn't work. Please try again.</Alert>
								</div>
							)}
							{data.requests.length === 0 && (
								<p className="px-4 py-3.5 text-muted-foreground">Nothing waiting.</p>
							)}
							{data.requests.map((request) => (
								<div
									key={request.id}
									className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-3 first-of-type:border-t-0"
								>
									<span className="min-w-0 flex-[1_1_160px]">
										<span className="block break-words font-semibold">
											{request.organizationName}
										</span>
										<span className="block text-xs text-muted-foreground">
											{describeRequest(request)} · {formatDate(request.createdAt)}
										</span>
									</span>
									<button
										type="button"
										disabled={decide.isPending}
										className={buttonClass("primary", BUTTON_SMALL)}
										onClick={() => decide.mutate({ id: request.id, decision: "approve" })}
									>
										Approve
									</button>
									<button
										type="button"
										disabled={decide.isPending}
										className={buttonClass("outline", BUTTON_SMALL)}
										onClick={() => decide.mutate({ id: request.id, decision: "dismiss" })}
									>
										Dismiss
									</button>
								</div>
							))}
						</section>
						<section className="min-w-0 flex-[1_1_360px] rounded-card border border-border bg-card">
							<h2 className="border-b border-border px-4 py-3.5 text-[15px] font-semibold">
								Trials ending in 7 days
							</h2>
							{data.trials.length === 0 && (
								<p className="px-4 py-3.5 text-muted-foreground">None.</p>
							)}
							{data.trials.map((trial) => (
								<p key={trial.id} className="flex justify-between gap-3 border-t border-border px-4 py-2.5 text-[13px] first-of-type:border-t-0">
									<span className="min-w-0 break-words font-medium">{trial.name}</span>
									<span className="shrink-0 text-muted-foreground">{formatDate(trial.trialEndDate)}</span>
								</p>
							))}
						</section>
						<section className="min-w-0 flex-[1_1_240px] rounded-card border border-border bg-card px-4 py-3.5">
							<h2 className="text-[15px] font-semibold">Active organizations by plan</h2>
							{data.plans.length === 0 && (
								<p className="mt-2 text-muted-foreground">None yet.</p>
							)}
							<ul className="mt-2 flex flex-col gap-1 text-[13px]">
								{data.plans.map((plan) => (
									<li key={plan.name} className="flex justify-between">
										<span>{plan.name}</span>
										<span className="font-semibold">{plan.total}</span>
									</li>
								))}
							</ul>
						</section>
					</div>
				</>
			)}
		</Layout>
	);
}

function toDateInput(value: string | null) {
	return value ? value.slice(0, 10) : "";
}

function numberOrNull(value: string) {
	return value.trim() === "" ? null : Number(value);
}

function OrganizationPanel({ org, plans }: { org: Organization; plans: Plan[] }) {
	const queryClient = useQueryClient();
	const decide = useDecide();
	const saved = {
		planId: org.planId ? String(org.planId) : "",
		billingCycle: org.billingCycle,
		extraUserBlocks: String(org.extraUserBlocks),
		paidUntil: toDateInput(org.paidUntil),
		trialEndDate: toDateInput(org.trialEndDate),
		customMaxUsers: org.customMaxUsers === null ? "" : String(org.customMaxUsers),
		customStorageGb: org.customStorageGb === null ? "" : String(org.customStorageGb),
	};
	const [values, setValues] = useState(saved);
	// Approving a request changes the plan, so the form has to follow what's saved.
	const savedKey = JSON.stringify(saved);
	const [seenKey, setSeenKey] = useState(savedKey);
	if (savedKey !== seenKey) {
		setSeenKey(savedKey);
		setValues(saved);
	}
	const [suspendOpen, setSuspendOpen] = useState(false);
	const [confirmName, setConfirmName] = useState("");
	const refresh = () => queryClient.invalidateQueries({ queryKey: ["superadmin"] });
	const save = useMutation({
		mutationFn: (status?: OrgStatus) =>
			api(`/superadmin/organizations/${org.id}`, {
				method: "PATCH",
				body: {
					planId: values.planId ? Number(values.planId) : null,
					billingCycle: values.billingCycle,
					extraUserBlocks: Number(values.extraUserBlocks || 0),
					paidUntil: values.paidUntil,
					trialEndDate: values.trialEndDate,
					customMaxUsers: numberOrNull(values.customMaxUsers),
					customStorageGb: numberOrNull(values.customStorageGb),
					...(status ? { status } : {}),
				},
			}),
		onSuccess: refresh,
	});
	// Only the status, so suspending can't also save half-finished plan changes.
	const changeStatus = useMutation({
		mutationFn: (status: OrgStatus) =>
			api(`/superadmin/organizations/${org.id}`, {
				method: "PATCH",
				body: { status },
			}),
		onSuccess: async () => {
			await refresh();
			setSuspendOpen(false);
			setConfirmName("");
		},
	});
	const set = <K extends keyof typeof values>(name: K, value: (typeof values)[K]) => {
		save.reset();
		setValues((current) => ({ ...current, [name]: value }));
	};
	const error = save.error instanceof ApiError ? save.error.message : "";

	function submit(event: FormEvent) {
		event.preventDefault();
		save.mutate(undefined);
	}

	return (
		<aside
			aria-label={`${org.name} details`}
			className="min-w-0 flex-[1_1_320px] rounded-card border border-border bg-card xl:max-w-[400px]"
		>
			<div className="border-b border-border px-4 py-4">
				<div className="flex flex-wrap items-center gap-2">
					<h2 className="min-w-0 break-words text-base font-semibold">{org.name}</h2>
					<StatusChip status={org.status} />
				</div>
				<dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]">
					<dt className="text-muted-foreground">Owner</dt>
					<dd className="min-w-0 break-words">{org.ownerName} · {org.ownerEmail}</dd>
					<dt className="text-muted-foreground">Users</dt>
					<dd>{org.activeMembers} active of {org.members}{org.maxUsers !== null ? ` · limit ${org.maxUsers}` : " · no limit"}</dd>
					<dt className="text-muted-foreground">Storage</dt>
					<dd>{formatBytes(org.storageUsed)}{org.storageLimitBytes !== null ? ` of ${formatBytes(org.storageLimitBytes)}` : " · no limit"}</dd>
					<dt className="text-muted-foreground">Content</dt>
					<dd>{org.policyCount} {org.policyCount === 1 ? "policy" : "policies"} · {plural(org.fileCount, "file")}</dd>
				</dl>
			</div>

			{org.request && (
				<div className="border-b border-border bg-selected px-4 py-3.5">
					<p className="font-semibold">Upgrade request</p>
					<p className="mt-0.5 text-[13px]">
						{describeRequest(org.request)} · {formatDate(org.request.createdAt)}. Approving
						activates the organization on that plan.
					</p>
					{org.request.message && (
						<p className="mt-1.5 whitespace-pre-wrap break-words rounded-md bg-card px-2.5 py-1.5 text-[13px]">
							{org.request.message}
						</p>
					)}
					<div className="mt-2.5 flex gap-2">
						<button
							type="button"
							disabled={decide.isPending}
							className={buttonClass("primary", BUTTON_SMALL)}
							onClick={() => decide.mutate({ id: org.request!.id, decision: "approve" })}
						>
							Approve and activate
						</button>
						<button
							type="button"
							disabled={decide.isPending}
							className={buttonClass("outline", BUTTON_SMALL)}
							onClick={() => decide.mutate({ id: org.request!.id, decision: "dismiss" })}
						>
							Dismiss
						</button>
					</div>
				</div>
			)}

			<form onSubmit={submit} className="flex flex-col gap-3 border-b border-border px-4 py-3.5">
				<p className="font-semibold">Assign plan</p>
				{save.isError && <Alert>{error || "That didn't save. Please try again."}</Alert>}
				<SelectField
					label="Plan"
					value={values.planId}
					onChange={(event) => set("planId", event.target.value)}
				>
					<option value="">No plan (trial limits)</option>
					{plans.map((plan) => (
						<option key={plan.id} value={plan.id}>
							{plan.name} — {plan.maxUsers ?? "no limit on"} users, {plan.storageLimitGb ?? "no limit on"} GB
							{plan.isActive ? "" : " (off)"}
						</option>
					))}
				</SelectField>
				<div className="grid grid-cols-2 gap-3">
					<SelectField
						label="Billing"
						value={values.billingCycle}
						onChange={(event) =>
							set("billingCycle", event.target.value as "monthly" | "yearly")
						}
					>
						<option value="monthly">Monthly</option>
						<option value="yearly">Yearly</option>
					</SelectField>
					<Field
						label="Extra 25-user blocks"
						type="number"
						min={0}
						max={200}
						hint="$10 a month, +10 GB each"
						value={values.extraUserBlocks}
						onChange={(event) => set("extraUserBlocks", event.target.value)}
					/>
					<Field
						label="Paid until"
						type="date"
						hint="For your records. Nothing blocks automatically."
						value={values.paidUntil}
						onChange={(event) => set("paidUntil", event.target.value)}
					/>
					<Field
						label="Trial ends"
						type="date"
						value={values.trialEndDate}
						onChange={(event) => set("trialEndDate", event.target.value)}
					/>
					<Field
						label="Custom user limit"
						type="number"
						min={0}
						hint="For custom quotes"
						value={values.customMaxUsers}
						onChange={(event) => set("customMaxUsers", event.target.value)}
					/>
					<Field
						label="Custom storage (GB)"
						type="number"
						min={0}
						hint="For custom quotes"
						value={values.customStorageGb}
						onChange={(event) => set("customStorageGb", event.target.value)}
					/>
				</div>
				<div className="flex items-center gap-3">
					<button
						type="submit"
						disabled={save.isPending}
						className={buttonClass("outline", BUTTON_SMALL)}
					>
						Save
					</button>
					{save.isSuccess && <span role="status" className="text-[13px] text-muted-foreground">Saved</span>}
				</div>
			</form>

			<div className="px-4 py-3.5">
				<p className="font-semibold">Access</p>
				{org.status === "active" ? (
					<>
						<p className="mt-0.5 text-[13px] text-muted-foreground">
							Suspending blocks access for {plural(org.activeMembers, "user")}. Their content is kept.
						</p>
						<button
							type="button"
							className="mt-2.5 min-h-[34px] rounded-md border border-destructive px-3 text-[13px] font-medium text-danger-foreground hover:bg-danger-surface"
							onClick={() => setSuspendOpen(true)}
						>
							Suspend organization…
						</button>
					</>
				) : (
					<>
						<p className="mt-0.5 text-[13px] text-muted-foreground">
							Mark this organization as paid, which saves the plan above and gives everyone access.
						</p>
						<div className="mt-2.5 flex flex-wrap gap-2">
							<button
								type="button"
								disabled={save.isPending}
								className={buttonClass("primary", BUTTON_SMALL)}
								onClick={() => save.mutate("active")}
							>
								Activate
							</button>
							{org.status === "trial" && (
								<button
									type="button"
									className={buttonClass("dangerOutline", BUTTON_SMALL)}
									onClick={() => setSuspendOpen(true)}
								>
									Suspend…
								</button>
							)}
							{org.status === "suspended" && (
								<button
									type="button"
									disabled={changeStatus.isPending}
									className={buttonClass("outline", BUTTON_SMALL)}
									onClick={() => changeStatus.mutate("trial")}
								>
									Back to trial
								</button>
							)}
						</div>
					</>
				)}
			</div>

			<Modal
				title={`Suspend ${org.name}?`}
				description={`${plural(org.activeMembers, "user")} will lose access until you reactivate it. Policies and files stay as they are.`}
				open={suspendOpen}
				onClose={() => setSuspendOpen(false)}
			>
				<div className="flex flex-col gap-3">
					{changeStatus.isError && <Alert>That didn't work. Please try again.</Alert>}
					<Field
						label="Type the organization name to confirm"
						autoComplete="off"
						value={confirmName}
						onChange={(event) => setConfirmName(event.target.value)}
					/>
					<div className="flex justify-end gap-2">
						<button
							type="button"
							className={buttonClass("outline")}
							onClick={() => setSuspendOpen(false)}
						>
							Cancel
						</button>
						<button
							type="button"
							disabled={confirmName !== org.name || changeStatus.isPending}
							className={buttonClass("danger")}
							onClick={() => changeStatus.mutate("suspended")}
						>
							Suspend
						</button>
					</div>
				</div>
			</Modal>
		</aside>
	);
}

export function SuperOrganizationsPage({ me }: { me: Me }) {
	const organizations = useQuery({
		queryKey: ORGS_KEY,
		queryFn: () => api<{ organizations: Organization[] }>("/superadmin/organizations"),
		select: (data) => data.organizations,
	});
	const plans = useQuery({
		queryKey: PLANS_KEY,
		queryFn: () => api<{ plans: Plan[] }>("/superadmin/plans"),
		select: (data) => data.plans,
	});
	const [selectedId, setSelectedId] = useState<number | null>(null);
	const [search, setSearch] = useState("");
	const [status, setStatus] = useState("all");
	const [requestsOnly, setRequestsOnly] = useState(false);

	const list = organizations.data ?? [];
	const text = search.trim().toLowerCase();
	const visible = list.filter(
		(org) =>
			(!text ||
				org.name.toLowerCase().includes(text) ||
				org.ownerEmail.toLowerCase().includes(text)) &&
			(status === "all" || org.status === status) &&
			(!requestsOnly || org.request),
	);
	const selected = list.find((org) => org.id === selectedId) ?? null;
	const waiting = list.filter((org) => org.request).length;

	return (
		<Layout
			me={me}
			title="Organizations"
			subtitle={`${plural(list.length, "organization")} · ${plural(waiting, "upgrade request")} waiting`}
		>
			{organizations.isPending && <PageLoading />}
			{organizations.isError && <PageError onRetry={() => organizations.refetch()} />}
			{organizations.data && (
				<>
					<div className="flex flex-wrap items-center gap-2">
						<SearchField label={"Search by name or owner email…"} value={search} onChange={setSearch} className="min-w-52 flex-1" />
						<select
							aria-label="Status"
							value={status}
							onChange={(event) => setStatus(event.target.value)}
							className="min-h-[38px] rounded-md border border-input bg-card px-2.5"
						>
							<option value="all">All statuses</option>
							<option value="trial">Trial</option>
							<option value="active">Active</option>
							<option value="suspended">Suspended</option>
							<option value="cancelled">Cancelled</option>
						</select>
						<label className="flex items-center gap-2 text-[13px]">
							<input
								type="checkbox"
								className="size-4 accent-primary"
								checked={requestsOnly}
								onChange={(event) => setRequestsOnly(event.target.checked)}
							/>
							Upgrade requests only
						</label>
					</div>
					<div className="flex flex-wrap items-start gap-4">
						<section className="min-w-0 flex-[999_1_520px] overflow-x-auto rounded-card border border-border bg-card">
							<table className="w-full min-w-[640px] text-left text-[13px]">
								<thead className="bg-background text-xs text-muted-foreground">
									<tr>
										<th scope="col" className="px-4 py-2.5 font-semibold">Organization</th>
										<th scope="col" className="px-2 py-2.5 font-semibold">Status</th>
										<th scope="col" className="px-2 py-2.5 font-semibold">Plan</th>
										<th scope="col" className="px-2 py-2.5 font-semibold">Users</th>
										<th scope="col" className="px-2 py-2.5 font-semibold">Storage</th>
										<th scope="col" className="px-2 py-2.5 font-semibold">Created</th>
									</tr>
								</thead>
								<tbody>
									{visible.map((org) => (
										<tr
											key={org.id}
											className={`border-t border-border ${org.id === selectedId ? "bg-selected" : ""}`}
										>
											<td className="px-4 py-2.5">
												<button
													type="button"
													className="text-left font-semibold hover:underline"
													onClick={() => setSelectedId(org.id)}
												>
													{org.name}
												</button>
												<span className="block break-all text-xs text-muted-foreground">
													{org.ownerName} · {org.ownerEmail}
												</span>
											</td>
											<td className="px-2 py-2.5">
												<StatusChip status={org.status} />
												{org.request && (
													<span className="ml-1 text-xs font-semibold text-selected-foreground">
														· upgrade asked
													</span>
												)}
											</td>
											<td className="px-2 py-2.5">
												{org.planName ? `${org.planName} · ${org.billingCycle}` : "—"}
											</td>
											<td className="px-2 py-2.5">{org.activeMembers}</td>
											<td className="px-2 py-2.5">{formatBytes(org.storageUsed)}</td>
											<td className="px-2 py-2.5">{formatDate(org.createdAt)}</td>
										</tr>
									))}
								</tbody>
							</table>
							{visible.length === 0 && (
								<p className="p-4 text-center text-muted-foreground">No organizations match.</p>
							)}
						</section>
						{selected && plans.data && (
							<OrganizationPanel key={selected.id} org={selected} plans={plans.data} />
						)}
					</div>
				</>
			)}
		</Layout>
	);
}

interface PlatformUser {
	id: string;
	name: string;
	email: string;
	isActive: boolean;
	isSuperAdmin: boolean;
	twoFactorEnabled: boolean;
	createdAt: string;
	lastActive: number | null;
	organizations: { name: string; role: string; isActive: boolean }[];
}

export function SuperUsersPage({ me }: { me: Me }) {
	const queryClient = useQueryClient();
	const [search, setSearch] = useState("");
	const [query, setQuery] = useState("");
	const [changing, setChanging] = useState<PlatformUser | null>(null);
	useEffect(() => {
		const timer = window.setTimeout(() => setQuery(search.trim()), 300);
		return () => window.clearTimeout(timer);
	}, [search]);
	const users = useQuery({
		queryKey: ["superadmin", "users", query],
		queryFn: () =>
			api<{
				totals: {
					all: number;
					signedUpThisWeek: number;
					deactivated: number;
					withoutOrganization: number;
				};
				users: PlatformUser[];
			}>(`/superadmin/users?q=${encodeURIComponent(query)}`),
	});
	const [resetting, setResetting] = useState<PlatformUser | null>(null);
	const resetTwoStep = useMutation({
		mutationFn: (target: PlatformUser) =>
			api(`/superadmin/users/${target.id}/two-factor/reset`, { method: "POST" }),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: ["superadmin"] });
			setResetting(null);
		},
	});
	const change = useMutation({
		mutationFn: (target: PlatformUser) =>
			api(`/superadmin/users/${target.id}`, {
				method: "PATCH",
				body: { isActive: !target.isActive },
			}),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: ["superadmin"] });
			setChanging(null);
		},
	});
	return (
		<Layout me={me} title="Users" subtitle="Everyone who has signed up, across all organizations">
			{users.isError && <PageError onRetry={() => users.refetch()} />}
			{users.data && (
				<dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
					<StatCard label="All users" value={users.data.totals.all} />
					<StatCard label="Signed up this week" value={users.data.totals.signedUpThisWeek} />
					<StatCard label="No organization yet" value={users.data.totals.withoutOrganization} />
					<StatCard label="Deactivated" value={users.data.totals.deactivated} />
				</dl>
			)}
			<SearchField label={"Search by name or email…"} value={search} onChange={setSearch} />
			{users.isPending && <PageLoading />}
			{users.data && (
				<section className="overflow-x-auto rounded-card border border-border bg-card">
					<table className="w-full min-w-[720px] text-left text-[13px]">
						<thead className="bg-background text-xs text-muted-foreground">
							<tr>
								<th scope="col" className="px-4 py-2.5 font-semibold">User</th>
								<th scope="col" className="px-2 py-2.5 font-semibold">Organizations</th>
								<th scope="col" className="px-2 py-2.5 font-semibold">Signed up</th>
								<th scope="col" className="px-2 py-2.5 font-semibold">Last active</th>
								<th scope="col" className="px-2 py-2.5 font-semibold">Status</th>
								<th scope="col" className="px-4 py-2.5 text-right font-semibold">Action</th>
							</tr>
						</thead>
						<tbody>
							{users.data.users.map((person) => (
								<tr key={person.id} className={`border-t border-border ${person.isActive ? "" : "bg-background"}`}>
									<td className="px-4 py-2.5">
										<span className="block break-words font-semibold">{person.name}</span>
										<span className="block break-all text-xs text-muted-foreground">{person.email}</span>
									</td>
									<td className="px-2 py-2.5">
										{person.isSuperAdmin && (
											<span className="mr-1 rounded-full border border-accent px-2 text-xs font-semibold text-accent">
												Superadmin
											</span>
										)}
										{person.organizations.length === 0 && !person.isSuperAdmin && (
											<span className="text-muted-foreground">None yet</span>
										)}
										{person.organizations.map((org) => (
											<span key={org.name} className="block break-words">
												{org.name} <span className="capitalize text-muted-foreground">· {org.role}</span>
											</span>
										))}
									</td>
									<td className="px-2 py-2.5">{formatDate(person.createdAt)}</td>
									<td className="px-2 py-2.5">{formatDate(person.lastActive)}</td>
									<td className="px-2 py-2.5">
										{person.isActive ? "Active" : "Deactivated"}
										{person.twoFactorEnabled && (
											<button
												type="button"
												className="block text-xs text-selected-foreground hover:underline"
												onClick={() => {
													resetTwoStep.reset();
													setResetting(person);
												}}
											>
												Reset two-step…
											</button>
										)}
									</td>
									<td className="px-4 py-2.5 text-right">
										{person.isSuperAdmin || person.id === me.user.id ? (
											<span className="text-xs text-muted-foreground">Protected</span>
										) : (
											<button
												type="button"
												className={buttonClass(
													person.isActive ? "outline" : "primary",
													BUTTON_SMALL,
												)}
												onClick={() => {
													change.reset();
													setChanging(person);
												}}
											>
												{person.isActive ? "Deactivate" : "Activate"}
											</button>
										)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</section>
			)}
			<Modal
				title={changing ? `${changing.isActive ? "Deactivate" : "Activate"} ${changing.name} everywhere?` : ""}
				description={
					changing?.isActive
						? "They'll be signed out straight away and lose access to every organization they belong to. To remove them from one organization only, ask that organization's admin."
						: "They'll be able to sign in again."
				}
				open={changing !== null}
				onClose={() => setChanging(null)}
			>
				{change.isError && (
					<div className="mb-3">
						<Alert>That didn't work. Please try again.</Alert>
					</div>
				)}
				{changing && changing.organizations.length > 0 && (
					<ul className="mb-3 list-disc pl-[18px] text-[13px]">
						{changing.organizations.map((org) => (
							<li key={org.name}>{org.name} · {org.role}</li>
						))}
					</ul>
				)}
				<div className="flex justify-end gap-2">
					<button type="button" className={buttonClass("outline")} onClick={() => setChanging(null)}>
						Cancel
					</button>
					<button
						type="button"
						disabled={change.isPending}
						className={buttonClass(changing?.isActive ? "danger" : "primary")}
						onClick={() => changing && change.mutate(changing)}
					>
						{changing?.isActive ? "Deactivate" : "Activate"}
					</button>
				</div>
			</Modal>
			<Modal
				title={resetting ? `Reset two-step for ${resetting.name}?` : ""}
				description="Only do this once you've confirmed it's really them, for example when they've lost their phone and backup codes. They'll be signed out and can sign in with just their password."
				open={resetting !== null}
				onClose={() => setResetting(null)}
			>
				{resetTwoStep.isError && (
					<div className="mb-3">
						<Alert>That didn't work. Please try again.</Alert>
					</div>
				)}
				<div className="flex justify-end gap-2">
					<button type="button" className={buttonClass("outline")} onClick={() => setResetting(null)}>
						Cancel
					</button>
					<button
						type="button"
						disabled={resetTwoStep.isPending}
						className={buttonClass("danger")}
						onClick={() => resetting && resetTwoStep.mutate(resetting)}
					>
						Reset two-step
					</button>
				</div>
			</Modal>
		</Layout>
	);
}

function PlanForm({ plan, onDone }: { plan: Plan | null; onDone: () => void }) {
	const queryClient = useQueryClient();
	const [values, setValues] = useState({
		name: plan?.name ?? "",
		description: plan?.description ?? "",
		monthly: plan ? String(plan.monthlyPrice / 100) : "",
		yearly: plan ? String(plan.yearlyPrice / 100) : "",
		maxUsers: plan?.maxUsers == null ? "" : String(plan.maxUsers),
		storageLimitGb: plan?.storageLimitGb == null ? "" : String(plan.storageLimitGb),
		sortOrder: String(plan?.sortOrder ?? 10),
		isActive: plan?.isActive ?? true,
	});
	const refresh = () => queryClient.invalidateQueries({ queryKey: ["superadmin"] });
	const save = useMutation({
		mutationFn: () =>
			api(plan ? `/superadmin/plans/${plan.id}` : "/superadmin/plans", {
				method: plan ? "PATCH" : "POST",
				body: {
					name: values.name,
					description: values.description,
					monthlyPrice: Math.round(Number(values.monthly) * 100),
					yearlyPrice: Math.round(Number(values.yearly) * 100),
					maxUsers: numberOrNull(values.maxUsers),
					storageLimitGb: numberOrNull(values.storageLimitGb),
					sortOrder: Number(values.sortOrder || 0),
					isActive: values.isActive,
				},
			}),
		onSuccess: async () => {
			await refresh();
			onDone();
		},
	});
	const remove = useMutation({
		mutationFn: () => api(`/superadmin/plans/${plan?.id}`, { method: "DELETE" }),
		onSuccess: async () => {
			await refresh();
			onDone();
		},
	});
	const set = <K extends keyof typeof values>(name: K, value: (typeof values)[K]) =>
		setValues((current) => ({ ...current, [name]: value }));
	const inUse = remove.error instanceof ApiError && remove.error.code === "PLAN_IN_USE";

	function submit(event: FormEvent) {
		event.preventDefault();
		save.mutate();
	}

	return (
		<form onSubmit={submit} className="flex flex-col gap-3.5">
			{save.isError && <Alert>That didn't save. Check the details.</Alert>}
			{remove.isError && (
				<Alert>
					{inUse
						? "Organizations are on this plan, or asked for it. Move them first, or turn the plan off."
						: "That didn't work. Please try again."}
				</Alert>
			)}
			<Field
				label="Plan name"
				required
				maxLength={100}
				value={values.name}
				onChange={(event) => set("name", event.target.value)}
			/>
			<TextareaField
				label="Description"
				rows={2}
				maxLength={500}
				value={values.description}
				onChange={(event) => set("description", event.target.value)}
			/>
			<div className="grid grid-cols-2 gap-3">
				<Field
					label="Monthly price (USD)"
					type="number"
					min={0}
					step="0.01"
					required
					value={values.monthly}
					onChange={(event) => set("monthly", event.target.value)}
				/>
				<Field
					label="Yearly price (USD)"
					type="number"
					min={0}
					step="0.01"
					required
					hint="Your rule: 10 × monthly"
					value={values.yearly}
					onChange={(event) => set("yearly", event.target.value)}
				/>
				<Field
					label="Max users"
					type="number"
					min={0}
					hint="Empty for no limit"
					value={values.maxUsers}
					onChange={(event) => set("maxUsers", event.target.value)}
				/>
				<Field
					label="Storage (GB)"
					type="number"
					min={0}
					hint="Empty for no limit"
					value={values.storageLimitGb}
					onChange={(event) => set("storageLimitGb", event.target.value)}
				/>
				<Field
					label="Sort order"
					type="number"
					min={0}
					value={values.sortOrder}
					onChange={(event) => set("sortOrder", event.target.value)}
				/>
			</div>
			<label className="flex items-start gap-2.5">
				<input
					type="checkbox"
					className="mt-0.5 size-4 accent-primary"
					checked={values.isActive}
					onChange={(event) => set("isActive", event.target.checked)}
				/>
				<span>
					<span className="block font-medium">Active</span>
					<span className="block text-[13px] text-muted-foreground">
						Turn off to hide it from new requests. Organizations already on it keep it.
					</span>
				</span>
			</label>
			<p className="text-xs leading-5 text-muted-foreground">
				Lowering a limit doesn't remove anyone or delete files. It only stops new invitations
				and uploads.
			</p>
			<div className="flex flex-wrap justify-end gap-2">
				{plan && (
					<button
						type="button"
						disabled={remove.isPending}
						className={buttonClass("dangerGhost", "mr-auto")}
						onClick={() => remove.mutate()}
					>
						Delete plan
					</button>
				)}
				<button type="button" className={buttonClass("outline")} onClick={onDone}>
					Cancel
				</button>
				<button type="submit" disabled={save.isPending} className={buttonClass()}>
					Save plan
				</button>
			</div>
		</form>
	);
}

export function SuperPlansPage({ me }: { me: Me }) {
	const plans = useQuery({
		queryKey: PLANS_KEY,
		queryFn: () => api<{ plans: Plan[] }>("/superadmin/plans"),
		select: (data) => data.plans,
	});
	const [editing, setEditing] = useState<Plan | "new" | null>(null);
	return (
		<Layout
			me={me}
			title="Plans"
			subtitle="Packages shown in Plan & usage. Extra users cost $10 a month per 25, with 10 GB more storage."
			action={
				<button type="button" className={buttonClass()} onClick={() => setEditing("new")}>
					+ New plan
				</button>
			}
		>
			{plans.isPending && <PageLoading />}
			{plans.isError && <PageError onRetry={() => plans.refetch()} />}
			<ul className="flex flex-col gap-3">
				{plans.data?.map((plan) => (
					<li key={plan.id} className="flex flex-wrap items-center gap-3 rounded-card border border-border bg-card p-4">
						<div className="min-w-0 flex-[1_1_260px]">
							<p className="flex flex-wrap items-center gap-2 font-semibold">
								{plan.name}
								{!plan.isActive && (
									<span className="rounded-full border border-input px-2 text-xs font-medium text-muted-foreground">
										Off
									</span>
								)}
							</p>
							<p className="text-[13px] text-muted-foreground">
								{money(plan.monthlyPrice)} / month · {money(plan.yearlyPrice)} / year ·{" "}
								{plan.maxUsers ?? "no limit on"} users · {plan.storageLimitGb ?? "no limit on"} GB ·{" "}
								{plural(plan.organizations, "organization")}
							</p>
						</div>
						<button
							type="button"
							aria-label={`Edit ${plan.name}`}
							className={buttonClass("outline")}
							onClick={() => setEditing(plan)}
						>
							Edit
						</button>
					</li>
				))}
			</ul>
			<Modal
				title={editing === "new" ? "New plan" : `Edit ${editing?.name ?? ""}`}
				open={editing !== null}
				onClose={() => setEditing(null)}
			>
				{editing && (
					<PlanForm
						key={editing === "new" ? "new" : editing.id}
						plan={editing === "new" ? null : editing}
						onDone={() => setEditing(null)}
					/>
				)}
			</Modal>
		</Layout>
	);
}

export function SuperStoragePage({ me }: { me: Me }) {
	const organizations = useQuery({
		queryKey: ORGS_KEY,
		queryFn: () => api<{ organizations: Organization[] }>("/superadmin/organizations"),
		select: (data) => data.organizations,
	});
	const percentOf = (org: Organization) =>
		org.storageLimitBytes ? (org.storageUsed / org.storageLimitBytes) * 100 : 0;
	const list = [...(organizations.data ?? [])].sort((a, b) => percentOf(b) - percentOf(a));
	const total = list.reduce((sum, org) => sum + org.storageUsed, 0);
	const files = list.reduce((sum, org) => sum + org.fileCount, 0);
	const nearLimit = list.filter((org) => percentOf(org) >= 90).length;
	return (
		<Layout me={me} title="Storage" subtitle="File storage by organization, against each limit">
			{organizations.isPending && <PageLoading />}
			{organizations.isError && <PageError onRetry={() => organizations.refetch()} />}
			{organizations.data && (
				<>
					<dl className="grid gap-3 sm:grid-cols-3">
						<StatCard label="Total stored" value={formatBytes(total)} detail={plural(files, "file")} />
						<StatCard label="Over 90% of limit" value={nearLimit} detail={nearLimit === 1 ? "organization" : "organizations"} />
						<StatCard label="Organizations" value={list.length} />
					</dl>
					<section className="overflow-x-auto rounded-card border border-border bg-card">
						<table className="w-full min-w-[560px] text-left text-[13px]">
							<thead className="bg-background text-xs text-muted-foreground">
								<tr>
									<th scope="col" className="px-4 py-2.5 font-semibold">Organization</th>
									<th scope="col" className="px-2 py-2.5 font-semibold">Plan</th>
									<th scope="col" className="px-2 py-2.5 font-semibold">Used / limit</th>
									<th scope="col" className="px-4 py-2.5 font-semibold">Files</th>
								</tr>
							</thead>
							<tbody>
								{list.map((org) => {
									const percent = Math.min(100, Math.round(percentOf(org)));
									return (
										<tr key={org.id} className="border-t border-border">
											<td className="break-words px-4 py-2.5 font-medium">{org.name}</td>
											<td className="px-2 py-2.5">{org.planName ?? "Trial"}</td>
											<td className="px-2 py-2.5">
												<span className="block">
													{formatBytes(org.storageUsed)}
													{org.storageLimitBytes !== null
														? ` of ${formatBytes(org.storageLimitBytes)} · ${percent}%`
														: " · no limit"}
												</span>
												{org.storageLimitBytes !== null && (
													<span className="mt-1 block h-1.5 max-w-52 overflow-hidden rounded-full bg-muted">
														<span
															className={`block h-full rounded-full ${percent >= 90 ? "bg-destructive" : "bg-primary"}`}
															style={{ width: `${percent}%` }}
														/>
													</span>
												)}
											</td>
											<td className="px-4 py-2.5">{org.fileCount}</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</section>
				</>
			)}
		</Layout>
	);
}
