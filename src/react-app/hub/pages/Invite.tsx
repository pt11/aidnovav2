import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { api, ApiError, authClient, ME_QUERY_KEY, type Me, type Role } from "../api";
import { useI18n } from "../i18n";
import { Alert, AuthCard, buttonClass, PageLoading } from "../ui";

interface InviteDetails {
	email: string;
	role: Role;
	organizationName: string;
	expired: boolean;
}

const ERROR_KEYS: Record<string, string> = {
	INVITE_EXPIRED: "invite.expired_desc",
	WRONG_ACCOUNT: "invite.wrong_account",
	ALREADY_MEMBER: "invite.already_member",
	NOT_FOUND: "invite.invalid_desc",
};

export function InvitePage({ me }: { me: Me | null }) {
	const { t } = useI18n();
	const queryClient = useQueryClient();
	const token = new URLSearchParams(window.location.search).get("token") ?? "";

	const invite = useQuery({
		queryKey: ["invite", token],
		enabled: token !== "",
		retry: false,
		queryFn: () =>
			api<InviteDetails>(`/invitations/lookup?token=${encodeURIComponent(token)}`),
	});
	const accept = useMutation({
		mutationFn: () =>
			api("/invitations/accept", { method: "POST", body: { token } }),
		// A full reload, so nothing from a previous organization stays on screen.
		onSuccess: () => {
			queryClient.clear();
			window.location.assign("/");
		},
	});

	if (token !== "" && invite.isPending) {
		return (
			<main className="flex min-h-dvh items-center justify-center">
				<PageLoading />
			</main>
		);
	}

	if (!invite.data) {
		return (
			<AuthCard title={t("invite.invalid_title")}>
				<p className="text-sm text-muted-foreground">{t("invite.invalid_desc")}</p>
			</AuthCard>
		);
	}

	const details = invite.data;
	if (details.expired) {
		return (
			<AuthCard title={t("invite.expired_title")}>
				<p className="text-sm text-muted-foreground">{t("invite.expired_desc")}</p>
			</AuthCard>
		);
	}

	const search = new URLSearchParams({
		next: `/invite?token=${token}`,
		email: details.email,
	}).toString();
	const signedInElsewhere =
		me !== null && me.user.email.toLowerCase() !== details.email;
	const errorCode = accept.error instanceof ApiError ? accept.error.code : "";

	return (
		<AuthCard
			title={t("invite.title", { organization: details.organizationName })}
			subtitle={t("invite.subtitle", {
				role: t(`role.${details.role}`),
				email: details.email,
			})}
		>
			<div className="flex flex-col gap-3">
				{accept.isError && (
					<Alert>{t(ERROR_KEYS[errorCode] ?? "error.generic")}</Alert>
				)}
				{me === null && (
					<>
						<Link href={`/sign-up?${search}`} className={buttonClass()}>
							{t("invite.create_account")}
						</Link>
						<Link href={`/sign-in?${search}`} className={buttonClass("outline")}>
							{t("invite.have_account")}
						</Link>
					</>
				)}
				{signedInElsewhere && (
					<>
						<Alert>
							{t("invite.signed_in_as", {
								current: me.user.email,
								email: details.email,
							})}
						</Alert>
						<button
							type="button"
							className={buttonClass("outline")}
							onClick={async () => {
								await authClient.signOut();
								await queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
							}}
						>
							{t("nav.logout")}
						</button>
					</>
				)}
				{me !== null && !signedInElsewhere && (
					<button
						type="button"
						disabled={accept.isPending}
						className={buttonClass()}
						onClick={() => accept.mutate()}
					>
						{t("invite.accept")}
					</button>
				)}
			</div>
		</AuthCard>
	);
}
