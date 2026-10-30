import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";
import {
	api,
	ApiError,
	useDepartments,
	type Me,
	type Role,
} from "../api";
import { useI18n } from "../i18n";
import {
	Alert,
	buttonClass,
	ConfirmModal,
	Field,
	Modal,
	PageError,
	PageHeader,
	PageLoading,
	SelectField,
} from "../ui";

interface Member {
	userId: string;
	name: string;
	email: string;
	role: Role;
	isActive: boolean;
	departmentId: number | null;
	departmentName: string | null;
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
										className={buttonClass("outline", "min-h-9 px-3")}
										onClick={() => resend.mutate(invite)}
									>
										{t("invite.resend")}
									</button>
									<button
										type="button"
										className={buttonClass("ghost", "min-h-9 px-3")}
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

export function UsersPage({ me, role }: { me: Me; role: Role }) {
	const { t } = useI18n();
	const queryClient = useQueryClient();
	const [inviteOpen, setInviteOpen] = useState(false);
	const [changingStatus, setChangingStatus] = useState<Member | null>(null);
	const departments = useDepartments();
	const members = useQuery({
		queryKey: QUERY_KEY,
		queryFn: () =>
			api<{ members: Member[]; ownerId: string }>(
				"/organizations/current/members",
			),
	});
	const refresh = () => queryClient.invalidateQueries({ queryKey: QUERY_KEY });
	const changeRole = useMutation({
		mutationFn: ({ userId, next }: { userId: string; next: Role }) =>
			api(`/organizations/current/members/${userId}/role`, {
				method: "PATCH",
				body: { role: next },
			}),
		onSettled: refresh,
	});
	const changeDepartment = useMutation({
		mutationFn: ({
			userId,
			departmentId,
		}: {
			userId: string;
			departmentId: number | null;
		}) =>
			api(`/organizations/current/members/${userId}/department`, {
				method: "PATCH",
				body: { departmentId },
			}),
		onSettled: refresh,
	});
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

	if (members.isPending) return <PageLoading />;
	if (members.isError) return <PageError onRetry={() => members.refetch()} />;

	const { members: people, ownerId } = members.data;
	const deactivating = changingStatus?.isActive ?? false;
	const canEdit = (person: Member) =>
		role === "admin" && person.userId !== ownerId && person.userId !== me.user.id;

	const ownerBadge = (person: Member) =>
		person.userId === ownerId && (
			<span className="ml-2 whitespace-nowrap rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
				{t("users.owner")}
			</span>
		);

	const roleControl = (person: Member) =>
		canEdit(person) ? (
			<select
				aria-label={`${t("users.role")}: ${person.name}`}
				value={person.role}
				disabled={changeRole.isPending}
				onChange={(event) =>
					changeRole.mutate({
						userId: person.userId,
						next: event.target.value as Role,
					})
				}
				className="min-h-9 rounded-md border border-input bg-card px-2 text-sm"
			>
				{ROLES.map((option) => (
					<option key={option} value={option}>
						{t(`role.${option}`)}
					</option>
				))}
			</select>
		) : (
			t(`role.${person.role}`)
		);

	const departmentControl = (person: Member) => (
		<select
			aria-label={`${t("users.department")}: ${person.name}`}
			value={person.departmentId ?? ""}
			disabled={changeDepartment.isPending}
			onChange={(event) =>
				changeDepartment.mutate({
					userId: person.userId,
					departmentId: event.target.value ? Number(event.target.value) : null,
				})
			}
			className="min-h-9 max-w-44 rounded-md border border-input bg-card px-2 text-sm"
		>
			<option value="">{t("users.no_department")}</option>
			{departments.data?.map((department) => (
				<option key={department.id} value={department.id}>
					{department.name}
				</option>
			))}
		</select>
	);

	const statusControl = (person: Member) => (
		<div className="flex items-center gap-3">
			<span className={person.isActive ? "" : "text-muted-foreground"}>
				{person.isActive ? t("users.active") : t("users.inactive")}
			</span>
			{canEdit(person) && (
				<button
					type="button"
					className="text-xs font-medium text-selected-foreground hover:underline"
					onClick={() => {
						changeStatus.reset();
						setChangingStatus(person);
					}}
				>
					{person.isActive ? t("users.deactivate") : t("users.reactivate")}
				</button>
			)}
		</div>
	);

	return (
		<div className="mx-auto max-w-5xl p-4 md:p-6">
			<PageHeader
				title={t("nav.users")}
				subtitle={t("users.subtitle")}
				action={
					<button
						type="button"
						className={buttonClass()}
						onClick={() => setInviteOpen(true)}
					>
						<UserPlus size={16} aria-hidden="true" />
						{t("invite.button")}
					</button>
				}
			/>
			{(changeRole.isError || changeDepartment.isError) && (
				<div className="mt-4">
					<Alert>{t("users.role_failed")}</Alert>
				</div>
			)}
			<div className="mt-5 hidden overflow-x-auto rounded-card border border-border bg-card md:block">
				<table className="w-full text-left text-sm">
					<thead className="bg-muted text-xs text-muted-foreground">
						<tr>
							<th scope="col" className="px-4 py-2.5 font-semibold">{t("users.name")}</th>
							<th scope="col" className="px-4 py-2.5 font-semibold">{t("users.email")}</th>
							<th scope="col" className="px-4 py-2.5 font-semibold">{t("users.role")}</th>
							<th scope="col" className="px-4 py-2.5 font-semibold">{t("users.department")}</th>
							<th scope="col" className="px-4 py-2.5 font-semibold">{t("users.status")}</th>
						</tr>
					</thead>
					<tbody>
						{people.map((person) => (
							<tr key={person.userId} className="border-t border-border">
								<td className="px-4 py-3 font-medium">
									{person.name}
									{ownerBadge(person)}
								</td>
								<td className="break-all px-4 py-3 text-muted-foreground">{person.email}</td>
								<td className="px-4 py-3">{roleControl(person)}</td>
								<td className="px-4 py-3">{departmentControl(person)}</td>
								<td className="px-4 py-3">{statusControl(person)}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
			<ul className="mt-5 flex flex-col gap-3 md:hidden">
				{people.map((person) => (
					<li
						key={person.userId}
						className="rounded-card border border-border bg-card p-4 text-sm"
					>
						<p className="font-medium">
							{person.name}
							{ownerBadge(person)}
						</p>
						<p className="mt-0.5 break-all text-muted-foreground">{person.email}</p>
						<dl className="mt-3 flex flex-col gap-2">
							{[
								{ label: t("users.role"), value: roleControl(person) },
								{ label: t("users.department"), value: departmentControl(person) },
								{ label: t("users.status"), value: statusControl(person) },
							].map((row) => (
								<div key={row.label} className="flex items-center justify-between gap-3">
									<dt className="text-muted-foreground">{row.label}</dt>
									<dd>{row.value}</dd>
								</div>
							))}
						</dl>
					</li>
				))}
			</ul>
			{people.length === 1 && (
				<p className="mt-4 text-sm text-muted-foreground">{t("users.only_you")}</p>
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
				onConfirm={() => changingStatus && changeStatus.mutate(changingStatus)}
				onClose={() => setChangingStatus(null)}
			/>
		</div>
	);
}
