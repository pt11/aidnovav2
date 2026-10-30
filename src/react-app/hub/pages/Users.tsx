import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleAlert } from "lucide-react";
import { api, type Me, type Role } from "../api";
import { useI18n } from "../i18n";
import { Alert, buttonClass, StatePanel } from "../ui";

interface Member {
	userId: string;
	name: string;
	email: string;
	role: Role;
	isActive: boolean;
	departmentName: string | null;
}

const ROLES: Role[] = ["staff", "manager", "admin"];
const QUERY_KEY = ["members"];

export function UsersPage({ me, role }: { me: Me; role: Role }) {
	const { t } = useI18n();
	const queryClient = useQueryClient();
	const members = useQuery({
		queryKey: QUERY_KEY,
		queryFn: () =>
			api<{ members: Member[]; ownerId: string }>(
				"/organizations/current/members",
			),
	});
	const changeRole = useMutation({
		mutationFn: ({ userId, next }: { userId: string; next: Role }) =>
			api(`/organizations/current/members/${userId}/role`, {
				method: "PATCH",
				body: { role: next },
			}),
		onSettled: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
	});

	if (members.isPending) {
		return <p className="p-6 text-sm text-muted-foreground">{t("common.loading")}</p>;
	}
	if (members.isError) {
		return (
			<StatePanel
				icon={CircleAlert}
				title={t("error.load")}
				action={
					<button
						type="button"
						className={buttonClass("outline")}
						onClick={() => members.refetch()}
					>
						{t("common.retry")}
					</button>
				}
			/>
		);
	}

	const { members: people, ownerId } = members.data;

	return (
		<div className="mx-auto max-w-5xl p-4 md:p-6">
			<h1 className="text-2xl font-semibold tracking-tight">{t("nav.users")}</h1>
			<p className="mt-1 text-sm text-muted-foreground">{t("users.subtitle")}</p>
			{changeRole.isError && (
				<div className="mt-4">
					<Alert>{t("users.role_failed")}</Alert>
				</div>
			)}
			<div className="mt-5 overflow-x-auto rounded-card border border-border bg-card">
				<table className="w-full min-w-[640px] text-left text-sm">
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
						{people.map((person) => {
							const isOwner = person.userId === ownerId;
							const canEdit =
								role === "admin" && !isOwner && person.userId !== me.user.id;
							return (
								<tr key={person.userId} className="border-t border-border">
									<td className="px-4 py-3 font-medium">
										{person.name}
										{isOwner && (
											<span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
												{t("users.owner")}
											</span>
										)}
									</td>
									<td className="px-4 py-3 text-muted-foreground">{person.email}</td>
									<td className="px-4 py-3">
										{canEdit ? (
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
										)}
									</td>
									<td className="px-4 py-3 text-muted-foreground">
										{person.departmentName ?? "—"}
									</td>
									<td className="px-4 py-3">
										{person.isActive ? t("users.active") : t("users.inactive")}
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>
			{people.length === 1 && (
				<p className="mt-4 text-sm text-muted-foreground">{t("users.only_you")}</p>
			)}
		</div>
	);
}
