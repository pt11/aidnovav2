import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	api,
	ApiError,
	authClient,
	ME_QUERY_KEY,
	type Me,
	type Membership,
} from "../api";
import { useI18n } from "../i18n";
import {
	Alert,
	buttonClass,
	Field,
	PageError,
	PageHeader,
	PageLoading,
	TextareaField,
} from "../ui";

interface Profile {
	position: string | null;
	bio: string | null;
	contactEmail: string | null;
	viberLink: string | null;
	facebookLink: string | null;
	departmentName: string | null;
}

const QUERY_KEY = ["my-profile"];
const ERROR_KEYS: Record<string, string> = {
	INVALID_EMAIL: "form.invalid_email",
	INVALID_LINK: "form.invalid_link",
};

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
				queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
				queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY }),
			]),
	});
	const set = (name: keyof typeof values) => (value: string) => {
		save.reset();
		setValues((current) => ({ ...current, [name]: value }));
	};
	const errorCode = save.error instanceof ApiError ? save.error.code : "";

	function submit(event: FormEvent) {
		event.preventDefault();
		save.mutate();
	}

	return (
		<form
			onSubmit={submit}
			className="flex flex-col gap-4 rounded-card border border-border bg-card p-5"
		>
			<h2 className="font-semibold">{t("profile.details")}</h2>
			{save.isError && <Alert>{t(ERROR_KEYS[errorCode] ?? "error.generic")}</Alert>}
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
				label={t("profile.bio")}
				maxLength={2000}
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
			<div className="grid gap-4 sm:grid-cols-2">
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
					{t("common.save")}
				</button>
				{save.isSuccess && (
					<p role="status" className="text-sm text-muted-foreground">
						{t("common.saved")}
					</p>
				)}
			</div>
		</form>
	);
}

function PasswordForm() {
	const { t } = useI18n();
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
		setStatus("saved");
	}

	return (
		<form
			onSubmit={submit}
			className="flex flex-col gap-4 rounded-card border border-border bg-card p-5"
		>
			<div>
				<h2 className="font-semibold">{t("profile.password_title")}</h2>
				<p className="mt-1 text-sm text-muted-foreground">
					{t("profile.password_desc")}
				</p>
			</div>
			{status === "wrong" && <Alert>{t("profile.password_wrong")}</Alert>}
			{status === "failed" && <Alert>{t("error.generic")}</Alert>}
			<Field
				label={t("profile.password_current")}
				type="password"
				autoComplete="current-password"
				required
				value={currentPassword}
				onChange={(event) => setCurrentPassword(event.target.value)}
			/>
			<Field
				label={t("profile.password_new")}
				type="password"
				autoComplete="new-password"
				hint={t("auth.password_hint")}
				required
				minLength={8}
				value={newPassword}
				onChange={(event) => setNewPassword(event.target.value)}
			/>
			<div className="flex items-center gap-3">
				<button
					type="submit"
					disabled={status === "saving"}
					className={buttonClass("outline")}
				>
					{t("profile.password_button")}
				</button>
				{status === "saved" && (
					<p role="status" className="text-sm text-muted-foreground">
						{t("common.saved")}
					</p>
				)}
			</div>
		</form>
	);
}

export function MyProfilePage({ me, org }: { me: Me; org: Membership }) {
	const { t } = useI18n();
	const profile = useQuery({
		queryKey: QUERY_KEY,
		queryFn: () => api<Profile>("/me/profile"),
	});

	if (profile.isPending) return <PageLoading />;
	if (profile.isError) return <PageError onRetry={() => profile.refetch()} />;

	const facts = [
		{ label: t("users.email"), value: me.user.email },
		{ label: t("users.role"), value: t(`role.${org.role}`) },
		{ label: t("users.department"), value: profile.data.departmentName ?? "—" },
	];

	return (
		<div className="mx-auto max-w-3xl p-4 md:p-6">
			<PageHeader title={t("nav.my_profile")} subtitle={org.name} />
			<dl className="mt-5 grid gap-3 rounded-card border border-border bg-card p-5 sm:grid-cols-3">
				{facts.map((fact) => (
					<div key={fact.label} className="min-w-0">
						<dt className="text-xs text-muted-foreground">{fact.label}</dt>
						<dd className="mt-0.5 break-words text-sm font-medium">{fact.value}</dd>
					</div>
				))}
			</dl>
			<div className="mt-5 flex flex-col gap-5">
				<ProfileForm me={me} profile={profile.data} />
				<PasswordForm />
			</div>
		</div>
	);
}
