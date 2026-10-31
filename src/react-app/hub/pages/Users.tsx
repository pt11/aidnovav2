import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import {
	api,
	ApiError,
	useDepartments,
	type Me,
	type Role,
} from "../api";
import { useI18n } from "../i18n";
import {
	ActionsMenu,
	Alert,
	Avatar,
	BUTTON_SMALL,
	buttonClass,
	Chip,
	ConfirmModal,
	Field,
	FilterSelect,
	Modal,
	PageError,
	PageHeader,
	PageLoading,
	SearchField,
	SelectField,
	TextareaField,
} from "../ui";

interface Member {
	userId: string;
	name: string;
	email: string;
	role: Role;
	isActive: boolean;
	departmentId: number | null;
	departmentName: string | null;
	photoUrl: string | null;
	joinedAt: string | null;
	policies: { done: number; total: number };
	learning: { total: number; completed: number };
}

interface Invitation {
	id: number;
	email: string;
	role: Role;
	departmentId: number | null;
	departmentName: string | null;
	expiresAt: string;
}

const ROLES: Role[] = ["staff", "manager", "admin"];
const QUERY_KEY = ["members"];
const INVITES_KEY = ["invitations"];
const INVITE_ERRORS: Record<string, string> = {
	ALREADY_MEMBER: "invite.error_member",
	INVALID_EMAIL: "form.invalid_email",
	TOO_MANY_INVITES: "invite.error_limit",
	USER_LIMIT: "plan.user_limit",
	EMAIL_FAILED: "invite.error_email",
};

function InviteForm({ role, onDone }: { role: Role; onDone: () => void }) {
	const { t } = useI18n();
	const queryClient = useQueryClient();
	const departments = useDepartments();
	const [email, setEmail] = useState("");
	const [nextRole, setNextRole] = useState<Role>("staff");
	const [departmentId, setDepartmentId] = useState("");
	const send = useMutation({
		mutationFn: () =>
			api("/organizations/current/invitations", {
				method: "POST",
				body: {
					email,
					role: nextRole,
					departmentId: departmentId ? Number(departmentId) : null,
				},
			}),
		onSettled: () => queryClient.invalidateQueries({ queryKey: INVITES_KEY }),
		onSuccess: onDone,
	});
	const errorCode = send.error instanceof ApiError ? send.error.code : "";

	function submit(event: FormEvent) {
		event.preventDefault();
		send.mutate();
	}

	return (
		<form onSubmit={submit} className="flex flex-col gap-4">
			{send.isError && (
				<Alert>{t(INVITE_ERRORS[errorCode] ?? "error.generic")}</Alert>
			)}
			<Field
				label={t("users.email")}
				type="email"
				autoComplete="off"
				required
				value={email}
				onChange={(event) => setEmail(event.target.value)}
			/>
			<SelectField
				label={t("users.role")}
				value={nextRole}
				disabled={role !== "admin"}
				onChange={(event) => setNextRole(event.target.value as Role)}
			>
				{ROLES.map((option) => (
					<option key={option} value={option}>
						{t(`role.${option}`)}
					</option>
				))}
			</SelectField>
			<SelectField
				label={t("users.department")}
				value={departmentId}
				onChange={(event) => setDepartmentId(event.target.value)}
			>
				<option value="">{t("users.no_department")}</option>
				{departments.data?.map((department) => (
					<option key={department.id} value={department.id}>
						{department.name}
					</option>
				))}
			</SelectField>
			<div className="flex justify-end gap-2">
				<button type="button" className={buttonClass("outline")} onClick={onDone}>
					{t("common.cancel")}
				</button>
				<button type="submit" disabled={send.isPending} className={buttonClass()}>
					{t("invite.send")}
				</button>
			</div>
		</form>
	);
}

function PendingInvitations({ role }: { role: Role }) {
	const { t, language } = useI18n();
	const queryClient = useQueryClient();
	const invitations = useQuery({
		queryKey: INVITES_KEY,
		queryFn: () =>
			api<{ invitations: Invitation[] }>("/organizations/current/invitations"),
		select: (data) => data.invitations,
	});
	const [revoking, setRevoking] = useState<Invitation | null>(null);
	const refresh = () => queryClient.invalidateQueries({ queryKey: INVITES_KEY });
	const resend = useMutation({
		mutationFn: (invite: Invitation) =>
			api("/organizations/current/invitations", {
				method: "POST",
				body: {
					email: invite.email,
					role: invite.role,
					departmentId: invite.departmentId,
				},
			}),
		onSettled: refresh,
	});
	const revoke = useMutation({
		mutationFn: (id: number) =>
			api(`/organizations/current/invitations/${id}`, { method: "DELETE" }),
		onSuccess: async () => {
			await refresh();
			setRevoking(null);
		},
	});

	if (!invitations.data?.length) return null;

	return (
		<section className="mt-6">
			<h2 className="font-semibold">{t("invite.pending")}</h2>
			{resend.isError && (
				<div className="mt-3">
					<Alert>{t("invite.error_email")}</Alert>
				</div>
			)}
			{resend.isSuccess && (
				<p role="status" className="mt-2 text-sm text-muted-foreground">
					{t("invite.resent", { email: resend.variables.email })}
				</p>
			)}
			<ul className="mt-3 divide-y divide-border rounded-card border border-border bg-card">
				{invitations.data.map((invite) => {
					const canChange = role === "admin" || invite.role === "staff";
					const expired = new Date(invite.expiresAt) < new Date();
					return (
						<li
							key={invite.id}
							className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
						>
							<div className="min-w-0">
								<p className="break-all text-sm font-medium">{invite.email}</p>
								<p className="mt-0.5 text-xs text-muted-foreground">
									{t(`role.${invite.role}`)}
									{invite.departmentName && ` · ${invite.departmentName}`}
									{" · "}
									{expired
										? t("invite.expired_label")
										: t("invite.expires", {
												date: new Date(invite.expiresAt).toLocaleDateString(language, {
													dateStyle: "medium",
												}),
											})}
								</p>
							</div>
							{canChange && (
								<div className="flex gap-2">
									<button
										type="button"
										disabled={resend.isPending}
										className={buttonClass("outline")}
										onClick={() => resend.mutate(invite)}
									>
										{t("invite.resend")}
									</button>
									<button
										type="button"
										className={buttonClass("ghost")}
										onClick={() => {
											revoke.reset();
											setRevoking(invite);
										}}
									>
										{t("invite.revoke")}
									</button>
								</div>
							)}
						</li>
					);
				})}
			</ul>
			<ConfirmModal
				title={t("invite.revoke_title")}
				description={t("invite.revoke_desc", { email: revoking?.email ?? "" })}
				confirmLabel={t("invite.revoke")}
				open={revoking !== null}
				pending={revoke.isPending}
				failed={revoke.isError}
				onConfirm={() => revoking && revoke.mutate(revoking.id)}
				onClose={() => setRevoking(null)}
			/>
		</section>
	);
}

const PAGE_SIZE = 25;
const NEW_MEMBER_MS = 14 * 24 * 60 * 60 * 1000;
const MAX_IMPORT = 100;

function CsvImportDialog({ onClose }: { onClose: () => void }) {
	const { t } = useI18n();
	const queryClient = useQueryClient();
	const departments = useDepartments();
	const [text, setText] = useState("");
	const [running, setRunning] = useState(false);
	const [done, setDone] = useState(0);
	const [failures, setFailures] = useState<string[] | null>(null);

	// One person per line: email, then optional role and department in any order.
	const rows = text
		.split(/\r?\n/)
		.map((line) => line.split(",").map((cell) => cell.trim()))
		.filter((cells) => cells[0] && cells[0].toLowerCase() !== "email")
		.slice(0, MAX_IMPORT)
		.map(([email, ...rest]) => {
			const lower = rest.map((cell) => cell.toLowerCase());
			const roleText = ROLES.find((option) => lower.includes(option));
			const department = departments.data?.find((item) => lower.includes(item.name.toLowerCase()));
			return { email, role: roleText ?? "staff", departmentId: department?.id ?? null };
		});

	async function run() {
		setRunning(true);
		setDone(0);
		const failed: string[] = [];
		for (const row of rows) {
			try {
				await api("/organizations/current/invitations", { method: "POST", body: row });
			} catch {
				failed.push(row.email);
			}
			setDone((current) => current + 1);
		}
		await queryClient.invalidateQueries({ queryKey: INVITES_KEY });
		setRunning(false);
		setFailures(failed);
	}

	return (
		<Modal title={t("users.import_title")} description={t("users.import_desc")} open wide onClose={onClose}>
			<div className="flex flex-col gap-3.5">
				{failures === null ? (
					<>
						<TextareaField
							label={t("users.import_label")}
							rows={8}
							placeholder={"thura@example.org, staff, Programmes\nayeaye@example.org, manager, HR"}
							value={text}
							onChange={(event) => setText(event.target.value)}
						/>
						<input
							type="file"
							accept=".csv,text/csv"
							aria-label={t("users.import_file")}
							className="text-[13px]"
							onChange={async (event) => {
								const file = event.target.files?.[0];
								if (file && file.size < 200_000) setText(await file.text());
							}}
						/>
						<p className="text-[13px] text-muted-foreground">
							{running
								? t("users.import_progress", { done, total: rows.length })
								: t("users.import_count", { count: rows.length, max: MAX_IMPORT })}
						</p>
						<div className="flex justify-end gap-2">
							<button type="button" className={buttonClass("outline")} onClick={onClose}>
								{t("common.cancel")}
							</button>
							<button
								type="button"
								disabled={running || rows.length === 0}
								className={buttonClass()}
								onClick={run}
							>
								{t("users.import_send", { count: rows.length })}
							</button>
						</div>
					</>
				) : (
					<>
						<p role="status">
							{t("users.import_done", { sent: rows.length - failures.length, total: rows.length })}
						</p>
						{failures.length > 0 && (
							<div className="rounded-md border border-destructive p-3 text-[13px]">
								<p className="font-semibold">{t("users.import_failed")}</p>
								<ul className="mt-1 list-disc break-all pl-4">
									{failures.map((email) => (
										<li key={email}>{email}</li>
									))}
								</ul>
							</div>
						)}
						<div className="flex justify-end">
							<button type="button" className={buttonClass()} onClick={onClose}>
								{t("common.close")}
							</button>
						</div>
					</>
				)}
			</div>
		</Modal>
	);
}

function DepartmentDialog({
	people,
	onClose,
}: {
	people: Member[];
	onClose: () => void;
}) {
	const { t } = useI18n();
	const queryClient = useQueryClient();
	const departments = useDepartments();
	const [departmentId, setDepartmentId] = useState(
		people.length === 1 && people[0].departmentId ? String(people[0].departmentId) : "",
	);
	const save = useMutation({
		mutationFn: async () => {
			for (const person of people) {
				await api(`/organizations/current/members/${person.userId}/department`, {
					method: "PATCH",
					body: { departmentId: departmentId ? Number(departmentId) : null },
				});
			}
		},
		onSettled: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
		onSuccess: onClose,
	});
	return (
		<Modal
			title={t("users.set_department")}
			description={
				people.length === 1 ? people[0].name : t("users.selected_count", { count: people.length })
			}
			open
			onClose={onClose}
		>
			<div className="flex flex-col gap-3.5">
				{save.isError && <Alert>{t("users.role_failed")}</Alert>}
				<SelectField
					label={t("users.department")}
					value={departmentId}
					onChange={(event) => setDepartmentId(event.target.value)}
				>
					<option value="">{t("users.no_department")}</option>
					{departments.data?.map((department) => (
						<option key={department.id} value={department.id}>
							{department.name}
						</option>
					))}
				</SelectField>
				<div className="flex justify-end gap-2">
					<button type="button" className={buttonClass("outline")} onClick={onClose}>
						{t("common.cancel")}
					</button>
					<button type="button" disabled={save.isPending} className={buttonClass()} onClick={() => save.mutate()}>
						{t("common.save")}
					</button>
				</div>
			</div>
		</Modal>
	);
}

function RoleDialog({ person, onClose }: { person: Member; onClose: () => void }) {
	const { t } = useI18n();
	const queryClient = useQueryClient();
	const [role, setRole] = useState<Role>(person.role);
	const save = useMutation({
		mutationFn: () =>
			api(`/organizations/current/members/${person.userId}/role`, {
				method: "PATCH",
				body: { role },
			}),
		onSettled: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
		onSuccess: onClose,
	});
	return (
		<Modal title={t("users.change_role")} description={person.name} open onClose={onClose}>
			<div className="flex flex-col gap-3.5">
				{save.isError && <Alert>{t("users.role_failed")}</Alert>}
				<SelectField
					label={t("users.role")}
					value={role}
					onChange={(event) => setRole(event.target.value as Role)}
				>
					{ROLES.map((option) => (
						<option key={option} value={option}>
							{t(`role.${option}`)}
						</option>
					))}
				</SelectField>
				<div className="flex justify-end gap-2">
					<button type="button" className={buttonClass("outline")} onClick={onClose}>
						{t("common.cancel")}
					</button>
					<button type="button" disabled={save.isPending} className={buttonClass()} onClick={() => save.mutate()}>
						{t("common.save")}
					</button>
				</div>
			</div>
		</Modal>
	);
}

function AssignCourseDialog({ people, onClose }: { people: Member[]; onClose: () => void }) {
	const { t } = useI18n();
	const courses = useQuery({
		queryKey: ["courses"],
		queryFn: () =>
			api<{ manage: { id: number; title: string; status: string; isMandatory: boolean }[] | null }>(
				"/courses",
			),
		select: (data) =>
			(data.manage ?? []).filter((course) => course.status === "published" && !course.isMandatory),
	});
	const [courseId, setCourseId] = useState("");
	const assign = useMutation({
		mutationFn: () =>
			api(`/courses/${courseId}/enrollments`, {
				method: "POST",
				body: { userIds: people.map((person) => person.userId) },
			}),
		onSuccess: onClose,
	});
	return (
		<Modal
			title={t("users.assign_course")}
			description={t("users.selected_count", { count: people.length })}
			open
			onClose={onClose}
		>
			<div className="flex flex-col gap-3.5">
				{assign.isError && <Alert>{t("error.generic")}</Alert>}
				{courses.data?.length === 0 ? (
					<p className="text-[13px] text-muted-foreground">{t("users.assign_none")}</p>
				) : (
					<SelectField
						label={t("nav.courses")}
						value={courseId}
						onChange={(event) => setCourseId(event.target.value)}
					>
						<option value="">{t("users.choose_course")}</option>
						{courses.data?.map((course) => (
							<option key={course.id} value={course.id}>
								{course.title}
							</option>
						))}
					</SelectField>
				)}
				<div className="flex justify-end gap-2">
					<button type="button" className={buttonClass("outline")} onClick={onClose}>
						{t("common.cancel")}
					</button>
					<button
						type="button"
						disabled={!courseId || assign.isPending}
						className={buttonClass()}
						onClick={() => assign.mutate()}
					>
						{t("users.assign_course")}
					</button>
				</div>
			</div>
		</Modal>
	);
}

export function UsersPage({ me, role }: { me: Me; role: Role }) {
	const { t } = useI18n();
	const queryClient = useQueryClient();
	const [inviteOpen, setInviteOpen] = useState(false);
	const [importOpen, setImportOpen] = useState(false);
	const [changingStatus, setChangingStatus] = useState<Member | null>(null);
	const [changingRole, setChangingRole] = useState<Member | null>(null);
	const [departmentFor, setDepartmentFor] = useState<Member[] | null>(null);
	const [courseFor, setCourseFor] = useState<Member[] | null>(null);
	const [resetFor, setResetFor] = useState<Member | null>(null);
	const [selected, setSelected] = useState<string[]>([]);
	const [query, setQuery] = useState("");
	const [roleFilter, setRoleFilter] = useState("all");
	const [departmentFilter, setDepartmentFilter] = useState("all");
	const [statusFilter, setStatusFilter] = useState("active");
	const [page, setPage] = useState(0);
	const [now] = useState(() => Date.now());
	const departments = useDepartments();
	const members = useQuery({
		queryKey: QUERY_KEY,
		queryFn: () =>
			api<{ members: Member[]; ownerId: string }>("/organizations/current/members"),
	});
	const refresh = () => queryClient.invalidateQueries({ queryKey: QUERY_KEY });
	const changeStatus = useMutation({
		mutationFn: (member: Member) =>
			api(`/organizations/current/members/${member.userId}/status`, {
				method: "PATCH",
				body: { isActive: !member.isActive },
			}),
		onSuccess: async () => {
			await refresh();
			setChangingStatus(null);
		},
	});
	const sendReset = useMutation({
		mutationFn: (member: Member) =>
			api(`/organizations/current/members/${member.userId}/send-reset`, { method: "POST" }),
	});

	if (members.isPending) return <PageLoading />;
	if (members.isError) return <PageError onRetry={() => members.refetch()} />;

	const { members: people, ownerId } = members.data;
	const deactivating = changingStatus?.isActive ?? false;
	const text = query.trim().toLowerCase();
	const visible = people.filter(
		(person) =>
			(!text ||
				person.name.toLowerCase().includes(text) ||
				person.email.toLowerCase().includes(text)) &&
			(roleFilter === "all" || person.role === roleFilter) &&
			(departmentFilter === "all" ||
				(departmentFilter === "none"
					? person.departmentId === null
					: String(person.departmentId) === departmentFilter)) &&
			(statusFilter === "all" || person.isActive === (statusFilter === "active")),
	);
	const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
	const currentPage = Math.min(page, pageCount - 1);
	const shown = visible.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
	const activeCount = people.filter((person) => person.isActive).length;
	const chosen = people.filter((person) => selected.includes(person.userId));
	const allShownSelected = shown.length > 0 && shown.every((person) => selected.includes(person.userId));
	const isNew = (person: Member) =>
		person.joinedAt !== null && now - new Date(person.joinedAt).getTime() < NEW_MEMBER_MS;
	const canEdit = (person: Member) =>
		role === "admin" && person.userId !== ownerId && person.userId !== me.user.id;
	const toggle = (userId: string, on: boolean) =>
		setSelected((current) => (on ? [...current, userId] : current.filter((id) => id !== userId)));
	const roleTone = { admin: "primary", manager: "neutral", staff: "outline" } as const;

	const personCell = (person: Member) => (
		<div className="flex min-w-0 items-center gap-2.5">
			<Avatar name={person.name} photoUrl={person.photoUrl} muted={!person.isActive} />
			<span className="min-w-0">
				<span className="flex flex-wrap items-center gap-1.5 font-semibold">
					<span className="min-w-0 break-words">{person.name}</span>
					{person.userId === ownerId && <Chip tone="neutral">{t("users.owner")}</Chip>}
					{isNew(person) && person.userId !== ownerId && <Chip>{t("users.new")}</Chip>}
				</span>
				<span className="block break-all text-[13px] text-muted-foreground">{person.email}</span>
			</span>
		</div>
	);
	const departmentCell = (person: Member) =>
		person.departmentName ?? <span className="font-medium text-danger-foreground">{t("users.not_set")}</span>;
	const policiesCell = (person: Member) =>
		person.policies.total === 0 ? (
			<span className="text-muted-foreground">—</span>
		) : (
			`${person.policies.done}/${person.policies.total}`
		);
	const learningCell = (person: Member) =>
		person.learning.total === 0 ? (
			<span className="text-muted-foreground">{t("users.not_enrolled")}</span>
		) : (
			t(person.learning.total === 1 ? "users.learning_one" : "users.learning", {
				count: person.learning.total,
				percent: Math.round((person.learning.completed / person.learning.total) * 100),
			})
		);
	const statusCell = (person: Member) => (
		<span className={person.isActive ? "" : "text-muted-foreground"}>
			{person.isActive ? t("users.active") : t("users.inactive")}
		</span>
	);
	const actionsFor = (person: Member) => [
		...(canEdit(person)
			? [{ label: t("users.change_role"), onSelect: () => setChangingRole(person) }]
			: []),
		{ label: t("users.set_department"), onSelect: () => setDepartmentFor([person]) },
		...(role === "admin" && person.isActive
			? [
					{
						label: t("users.send_reset"),
						onSelect: () => {
							sendReset.reset();
							setResetFor(person);
						},
					},
				]
			: []),
		...(canEdit(person)
			? [
					{
						label: person.isActive ? t("users.deactivate") : t("users.reactivate"),
						danger: person.isActive,
						separated: true,
						onSelect: () => {
							changeStatus.reset();
							setChangingStatus(person);
						},
					},
				]
			: []),
	];

	return (
		<div className="mx-auto flex max-w-[1180px] flex-col gap-4 p-4 md:px-6 md:py-7">
			<PageHeader
				title={t("users.title")}
				subtitle={t("users.summary", {
					active: activeCount,
					inactive: people.length - activeCount,
					departments: departments.data?.length ?? 0,
				})}
				action={
					<div className="flex flex-wrap gap-2">
						<button type="button" className={buttonClass("outline")} onClick={() => setImportOpen(true)}>
							{t("users.import")}
						</button>
						<button type="button" className={buttonClass()} onClick={() => setInviteOpen(true)}>
							<Plus size={16} aria-hidden="true" />
							{t("users.add_staff")}
						</button>
					</div>
				}
			/>
			<div className="flex flex-wrap items-center gap-2">
				<SearchField
					label={t("users.search")}
					value={query}
					onChange={(value) => {
						setQuery(value);
						setPage(0);
					}}
					className="min-w-52 flex-1"
				/>
				<FilterSelect
					label={t("users.role")}
					value={roleFilter}
					onChange={(value) => {
						setRoleFilter(value);
						setPage(0);
					}}
				>
					<option value="all">{t("course.all")}</option>
					{ROLES.map((option) => (
						<option key={option} value={option}>
							{t(`role.${option}`)}
						</option>
					))}
				</FilterSelect>
				<FilterSelect
					label={t("users.department")}
					value={departmentFilter}
					onChange={(value) => {
						setDepartmentFilter(value);
						setPage(0);
					}}
				>
					<option value="all">{t("course.all")}</option>
					<option value="none">{t("users.not_set")}</option>
					{departments.data?.map((department) => (
						<option key={department.id} value={department.id}>
							{department.name}
						</option>
					))}
				</FilterSelect>
				<FilterSelect
					label={t("users.status")}
					value={statusFilter}
					onChange={(value) => {
						setStatusFilter(value);
						setPage(0);
					}}
				>
					<option value="all">{t("course.all")}</option>
					<option value="active">{t("users.active")}</option>
					<option value="inactive">{t("users.inactive")}</option>
				</FilterSelect>
			</div>
			{chosen.length > 0 && (
				<div className="flex flex-wrap items-center gap-2 rounded-[9px] bg-[#030711] px-3 py-2.5 text-white dark:border dark:border-border">
					<span className="mr-auto font-semibold">{t("users.selected_count", { count: chosen.length })}</span>
					<button
						type="button"
						className="min-h-8 rounded-md border border-white/40 px-3 text-[13px] font-medium hover:bg-white/10"
						onClick={() => setDepartmentFor(chosen)}
					>
						{t("users.set_department")}
					</button>
					<button
						type="button"
						className="min-h-8 rounded-md border border-white/40 px-3 text-[13px] font-medium hover:bg-white/10"
						onClick={() => setCourseFor(chosen)}
					>
						{t("users.assign_course")}
					</button>
					<button
						type="button"
						className="min-h-8 rounded-md bg-white px-3 text-[13px] font-medium text-[#030711]"
						onClick={() => setSelected([])}
					>
						{t("users.clear")}
					</button>
				</div>
			)}
			{visible.length === 0 ? (
				<p role="status" className="rounded-card border border-border bg-card p-5 text-center text-muted-foreground">
					{t("users.no_results")}
				</p>
			) : (
				<section className="overflow-hidden rounded-card border border-border bg-card">
					<div className="hidden overflow-x-auto md:block">
						<table className="w-full min-w-[820px] text-left">
							<thead className="bg-background text-xs text-muted-foreground">
								<tr>
									<th scope="col" className="w-10 py-2.5 pl-4">
										<input
											type="checkbox"
											aria-label={t("users.select_all")}
											className="size-4 accent-primary"
											checked={allShownSelected}
											onChange={(event) =>
												setSelected((current) =>
													event.target.checked
														? [...new Set([...current, ...shown.map((person) => person.userId)])]
														: current.filter((id) => !shown.some((person) => person.userId === id)),
												)
											}
										/>
									</th>
									<th scope="col" className="px-2 py-2.5 font-semibold">{t("users.name")}</th>
									<th scope="col" className="px-2 py-2.5 font-semibold">{t("users.role")}</th>
									<th scope="col" className="px-2 py-2.5 font-semibold">{t("users.department")}</th>
									<th scope="col" className="px-2 py-2.5 font-semibold">{t("nav.policies")}</th>
									<th scope="col" className="px-2 py-2.5 font-semibold">{t("users.learning_col")}</th>
									<th scope="col" className="px-2 py-2.5 font-semibold">{t("users.status")}</th>
									<th scope="col" className="w-12 py-2.5 pr-3">
										<span className="sr-only">{t("course.actions")}</span>
									</th>
								</tr>
							</thead>
							<tbody>
								{shown.map((person) => {
									const isSelected = selected.includes(person.userId);
									return (
										<tr key={person.userId} className={`border-t border-border ${isSelected ? "bg-background" : ""}`}>
											<td className="py-3 pl-4">
												<input
													type="checkbox"
													aria-label={t("users.select_person", { name: person.name })}
													className="size-4 accent-primary"
													checked={isSelected}
													onChange={(event) => toggle(person.userId, event.target.checked)}
												/>
											</td>
											<td className="px-2 py-3">{personCell(person)}</td>
											<td className="px-2 py-3"><Chip tone={roleTone[person.role]}>{t(`role.${person.role}`)}</Chip></td>
											<td className="px-2 py-3">{departmentCell(person)}</td>
											<td className="px-2 py-3">{policiesCell(person)}</td>
											<td className="px-2 py-3">{learningCell(person)}</td>
											<td className="px-2 py-3">{statusCell(person)}</td>
											<td className="py-3 pr-3">
												<ActionsMenu label={t("users.actions_for", { name: person.name })} actions={actionsFor(person)} />
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
					<ul className="divide-y divide-border md:hidden">
						{shown.map((person) => (
							<li key={person.userId} className="p-4">
								<div className="flex items-start gap-2">
									<input
										type="checkbox"
										aria-label={t("users.select_person", { name: person.name })}
										className="mt-2 size-4 shrink-0 accent-primary"
										checked={selected.includes(person.userId)}
										onChange={(event) => toggle(person.userId, event.target.checked)}
									/>
									<div className="min-w-0 flex-1">{personCell(person)}</div>
									<ActionsMenu label={t("users.actions_for", { name: person.name })} actions={actionsFor(person)} />
								</div>
								<div className="mt-2 flex flex-wrap items-center gap-1.5 pl-6">
									<Chip tone={roleTone[person.role]}>{t(`role.${person.role}`)}</Chip>
									<span className="text-[13px]">{departmentCell(person)}</span>
								</div>
								<dl className="mt-2 grid grid-cols-3 gap-2 pl-6 text-[13px]">
									<div>
										<dt className="text-xs text-muted-foreground">{t("nav.policies")}</dt>
										<dd>{policiesCell(person)}</dd>
									</div>
									<div>
										<dt className="text-xs text-muted-foreground">{t("users.learning_col")}</dt>
										<dd>{learningCell(person)}</dd>
									</div>
									<div>
										<dt className="text-xs text-muted-foreground">{t("users.status")}</dt>
										<dd>{statusCell(person)}</dd>
									</div>
								</dl>
							</li>
						))}
					</ul>
					<div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-2.5">
						<p className="text-[13px] text-muted-foreground">
							{t("users.showing", { shown: shown.length, total: visible.length })}
						</p>
						{pageCount > 1 && (
							<div className="flex gap-2">
								<button
									type="button"
									disabled={currentPage === 0}
									className={buttonClass("outline", BUTTON_SMALL)}
									onClick={() => setPage(currentPage - 1)}
								>
									{t("users.previous")}
								</button>
								<button
									type="button"
									disabled={currentPage >= pageCount - 1}
									className={buttonClass("outline", BUTTON_SMALL)}
									onClick={() => setPage(currentPage + 1)}
								>
									{t("users.next")}
								</button>
							</div>
						)}
					</div>
				</section>
			)}
			{people.length === 1 && (
				<p className="text-sm text-muted-foreground">{t("users.only_you")}</p>
			)}

			<PendingInvitations role={role} />

			<Modal
				title={t("invite.modal_title")}
				description={t("invite.modal_desc")}
				open={inviteOpen}
				onClose={() => setInviteOpen(false)}
			>
				<InviteForm role={role} onDone={() => setInviteOpen(false)} />
			</Modal>
			{importOpen && <CsvImportDialog onClose={() => setImportOpen(false)} />}
			{changingRole && <RoleDialog person={changingRole} onClose={() => setChangingRole(null)} />}
			{departmentFor && (
				<DepartmentDialog
					people={departmentFor}
					onClose={() => {
						setDepartmentFor(null);
						setSelected([]);
					}}
				/>
			)}
			{courseFor && (
				<AssignCourseDialog
					people={courseFor}
					onClose={() => {
						setCourseFor(null);
						setSelected([]);
					}}
				/>
			)}
			<Modal
				title={t("signin.send_title")}
				description={resetFor ? t("signin.note", { name: resetFor.name }) : ""}
				open={resetFor !== null}
				onClose={() => setResetFor(null)}
			>
				<div className="flex flex-col gap-3.5">
					{sendReset.isError && (
						<Alert>
							{t(
								sendReset.error instanceof ApiError && sendReset.error.code === "TOO_MANY_EMAILS"
									? "signin.too_many"
									: "error.generic",
							)}
						</Alert>
					)}
					{sendReset.isSuccess && resetFor && (
						<p role="status" className="rounded-md bg-selected px-3 py-2.5 text-[13px]">
							{t("signin.sent", { email: resetFor.email })}
						</p>
					)}
					<div className="flex justify-end gap-2">
						<button type="button" className={buttonClass("outline")} onClick={() => setResetFor(null)}>
							{t("common.close")}
						</button>
						{!sendReset.isSuccess && (
							<button
								type="button"
								disabled={sendReset.isPending}
								className={buttonClass()}
								onClick={() => resetFor && sendReset.mutate(resetFor)}
							>
								{t("signin.send")}
							</button>
						)}
					</div>
				</div>
			</Modal>
			<ConfirmModal
				title={t(deactivating ? "users.deactivate_title" : "users.reactivate_title")}
				description={t(
					deactivating ? "users.deactivate_desc" : "users.reactivate_desc",
					{ name: changingStatus?.name ?? "" },
				)}
				confirmLabel={t(deactivating ? "users.deactivate" : "users.reactivate")}
				open={changingStatus !== null}
				pending={changeStatus.isPending}
				failed={changeStatus.isError}
				failedMessage={
					changeStatus.error instanceof ApiError &&
					changeStatus.error.code === "USER_LIMIT"
						? t("plan.user_limit")
						: undefined
				}
				onConfirm={() => changingStatus && changeStatus.mutate(changingStatus)}
				onClose={() => setChangingStatus(null)}
			/>
		</div>
	);
}
