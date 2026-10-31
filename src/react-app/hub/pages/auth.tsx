import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { authClient, ME_QUERY_KEY } from "../api";
import { useI18n } from "../i18n";
import { useTurnstile } from "../turnstile";
import { Alert, AuthCard, buttonClass, Field, PasswordField, siteUrl } from "../ui";

const linkClass = "font-medium text-selected-foreground underline-offset-2 hover:underline";

interface AuthError {
	status?: number;
	code?: string;
}

// Where to go after signing in. Only invitation links are accepted, so a crafted
// link can't send someone to another site.
function inviteReturnPath(): string | null {
	const next = new URLSearchParams(window.location.search).get("next");
	return next?.startsWith("/invite?token=") ? next : null;
}

function messageKey(error: AuthError): string {
	if (error.status === 429) return "auth.too_many";
	if (error.code === "INVALID_EMAIL_OR_PASSWORD") return "auth.invalid";
	if (error.code?.startsWith("USER_ALREADY_EXISTS")) return "auth.email_exists";
	if (error.code === "MISSING_RESPONSE" || error.code === "VERIFICATION_FAILED") {
		return "auth.security_check";
	}
	return "error.generic";
}

function TwoStepForm({ onDone }: { onDone: () => Promise<void> }) {
	const { t } = useI18n();
	const [useBackup, setUseBackup] = useState(false);
	const [code, setCode] = useState("");
	const [error, setError] = useState("");
	const [saving, setSaving] = useState(false);

	async function submit(event: FormEvent) {
		event.preventDefault();
		setSaving(true);
		setError("");
		const result = useBackup
			? await authClient.twoFactor.verifyBackupCode({ code: code.trim() })
			: await authClient.twoFactor.verifyTotp({ code: code.trim() });
		setSaving(false);
		if (result.error) {
			setError(t(result.error.status === 429 ? "twofactor.too_many" : "twofactor.code_wrong"));
			return;
		}
		await onDone();
	}

	return (
		<AuthCard title={t("twofactor.title")} subtitle={t(useBackup ? "twofactor.enter_backup" : "twofactor.enter_code")}>
			<form onSubmit={submit} className="flex flex-col gap-3.5">
				{error && <Alert>{error}</Alert>}
				<Field
					label={t(useBackup ? "twofactor.backup_code" : "twofactor.code")}
					autoFocus
					required
					inputMode={useBackup ? "text" : "numeric"}
					autoComplete="one-time-code"
					maxLength={useBackup ? 30 : 6}
					value={code}
					onChange={(event) => setCode(event.target.value)}
				/>
				<button type="submit" disabled={saving} className={buttonClass()}>
					{t("twofactor.verify")}
				</button>
				<button
					type="button"
					className="text-[13px] font-medium text-selected-foreground hover:underline"
					onClick={() => {
						setError("");
						setCode("");
						setUseBackup((current) => !current);
					}}
				>
					{t(useBackup ? "twofactor.use_app" : "twofactor.use_backup")}
				</button>
			</form>
		</AuthCard>
	);
}

export function SignInPage() {
	const [needsCode, setNeedsCode] = useState(false);
	const { t } = useI18n();
	const queryClient = useQueryClient();
	const [, navigate] = useLocation();
	const next = inviteReturnPath();
	const [email, setEmail] = useState(
		() => new URLSearchParams(window.location.search).get("email") ?? "",
	);
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [unverified, setUnverified] = useState(false);
	const [resent, setResent] = useState(false);
	const [saving, setSaving] = useState(false);

	async function submit(event: FormEvent) {
		event.preventDefault();
		setError("");
		setUnverified(false);
		setResent(false);
		setSaving(true);
		const result = await authClient.signIn.email({ email, password });
		setSaving(false);
		if (result.error) {
			if (result.error.status === 403) {
				setUnverified(true);
				return;
			}
			setError(t(messageKey(result.error)));
			return;
		}
		if ((result.data as { twoFactorRedirect?: boolean } | null)?.twoFactorRedirect) {
			setNeedsCode(true);
			return;
		}
		if (next) navigate(next, { replace: true });
		await queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
	}

	if (needsCode) {
		return (
			<TwoStepForm
				onDone={async () => {
					if (next) navigate(next, { replace: true });
					await queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
				}}
			/>
		);
	}

	async function resend() {
		await authClient.sendVerificationEmail({ email, callbackURL: next ?? "/" });
		setResent(true);
	}

	return (
		<AuthCard
			title={t("auth.welcome")}
			subtitle={t("auth.welcome_sub")}
			footer={
				<>
					{t("auth.no_account")}{" "}
					<Link href={`/sign-up${window.location.search}`} className={linkClass}>
						{t("auth.sign_up")}
					</Link>
				</>
			}
		>
			<form onSubmit={submit} className="flex flex-col gap-4">
				{error && <Alert>{error}</Alert>}
				{unverified && (
					<Alert>
						{resent ? t("auth.check_email", { email }) : t("auth.unverified")}{" "}
						{!resent && (
							<button type="button" onClick={resend} className="font-semibold underline">
								{t("auth.resend")}
							</button>
						)}
					</Alert>
				)}
				<Field
					label={t("auth.email")}
					type="email"
					autoComplete="email"
					required
					value={email}
					onChange={(event) => setEmail(event.target.value)}
				/>
				<PasswordField
					label={t("auth.password")}
					autoComplete="current-password"
					required
					value={password}
					onChange={(event) => setPassword(event.target.value)}
					action={
						<Link href="/forgot-password" className={`text-[13px] ${linkClass}`}>
							{t("auth.forgot")}
						</Link>
					}
				/>
				<button type="submit" disabled={saving} className={buttonClass()}>
					{t("auth.sign_in")}
				</button>
			</form>
		</AuthCard>
	);
}

export function SignUpPage() {
	const { t } = useI18n();
	const turnstile = useTurnstile();
	const next = inviteReturnPath();
	const [name, setName] = useState("");
	const [email, setEmail] = useState(
		() => new URLSearchParams(window.location.search).get("email") ?? "",
	);
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [saving, setSaving] = useState(false);
	const [sent, setSent] = useState(false);

	async function submit(event: FormEvent) {
		event.preventDefault();
		setError("");
		setSaving(true);
		const result = await authClient.signUp.email({
			name: name.trim(),
			email,
			password,
			callbackURL: next ?? "/",
			fetchOptions: turnstile.fetchOptions,
		});
		setSaving(false);
		if (result.error) {
			setError(t(messageKey(result.error)));
			turnstile.reset();
			return;
		}
		setSent(true);
	}

	if (sent) {
		return (
			<AuthCard title={t("auth.check_email_title")}>
				<p role="status" className="text-sm text-muted-foreground">
					{t("auth.check_email", { email })}
				</p>
			</AuthCard>
		);
	}

	return (
		<AuthCard
			title={t("auth.sign_up_title")}
			subtitle={t("auth.sign_up_subtitle")}
			footer={
				<>
					{t("auth.has_account")}{" "}
					<Link href={`/sign-in${window.location.search}`} className={linkClass}>
						{t("auth.sign_in")}
					</Link>
				</>
			}
		>
			<form onSubmit={submit} className="flex flex-col gap-4">
				{error && <Alert>{error}</Alert>}
				<Field
					label={t("auth.name")}
					autoComplete="name"
					required
					value={name}
					onChange={(event) => setName(event.target.value)}
				/>
				<Field
					label={t("auth.email")}
					type="email"
					autoComplete="email"
					required
					value={email}
					onChange={(event) => setEmail(event.target.value)}
				/>
				<PasswordField
					label={t("auth.password")}
					autoComplete="new-password"
					hint={t("auth.password_hint")}
					minLength={8}
					required
					value={password}
					onChange={(event) => setPassword(event.target.value)}
				/>
				{turnstile.widget}
				<button type="submit" disabled={saving} className={buttonClass()}>
					{t("auth.sign_up")}
				</button>
				<p className="text-xs leading-5 text-muted-foreground">
					{t("auth.agree_before")}{" "}
					<a href={siteUrl("/terms-of-service")} target="_blank" rel="noopener noreferrer" className={linkClass}>
						{t("brand.terms")}
					</a>{" "}
					{t("auth.agree_and")}{" "}
					<a href={siteUrl("/privacy-policy")} target="_blank" rel="noopener noreferrer" className={linkClass}>
						{t("brand.privacy")}
					</a>
					{t("auth.agree_after")}
				</p>
				<p className="rounded-md bg-background px-3 py-2 text-xs leading-5 text-muted-foreground">
					{t("auth.joining_note")}
				</p>
			</form>
		</AuthCard>
	);
}

export function ForgotPasswordPage() {
	const { t } = useI18n();
	const turnstile = useTurnstile();
	const [email, setEmail] = useState("");
	const [error, setError] = useState("");
	const [saving, setSaving] = useState(false);
	const [sent, setSent] = useState(false);

	async function submit(event: FormEvent) {
		event.preventDefault();
		setError("");
		setSaving(true);
		const result = await authClient.requestPasswordReset({
			email,
			redirectTo: "/reset-password",
			fetchOptions: turnstile.fetchOptions,
		});
		setSaving(false);
		if (result.error) {
			setError(t(messageKey(result.error)));
			turnstile.reset();
			return;
		}
		setSent(true);
	}

	return (
		<AuthCard
			title={t("auth.forgot_title")}
			footer={
				<Link href="/sign-in" className={linkClass}>
					{t("auth.back_to_sign_in")}
				</Link>
			}
		>
			{sent ? (
				<p role="status" className="text-sm text-muted-foreground">
					{t("auth.forgot_sent", { email })}
				</p>
			) : (
				<form onSubmit={submit} className="flex flex-col gap-4">
					{error && <Alert>{error}</Alert>}
					<Field
						label={t("auth.email")}
						type="email"
						autoComplete="email"
						required
						value={email}
						onChange={(event) => setEmail(event.target.value)}
					/>
					{turnstile.widget}
					<button type="submit" disabled={saving} className={buttonClass()}>
						{t("auth.forgot_button")}
					</button>
				</form>
			)}
		</AuthCard>
	);
}

export function ResetPasswordPage() {
	const { t } = useI18n();
	const [, navigate] = useLocation();
	const token = new URLSearchParams(window.location.search).get("token");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [saving, setSaving] = useState(false);

	async function submit(event: FormEvent) {
		event.preventDefault();
		if (!token) return;
		setError("");
		setSaving(true);
		const result = await authClient.resetPassword({
			newPassword: password,
			token,
		});
		setSaving(false);
		if (result.error) {
			setError(
				result.error.status === 400
					? t("auth.reset_invalid")
					: t(messageKey(result.error)),
			);
			return;
		}
		navigate("/sign-in", { replace: true });
	}

	return (
		<AuthCard
			title={t("auth.reset_title")}
			footer={
				<Link href="/sign-in" className={linkClass}>
					{t("auth.back_to_sign_in")}
				</Link>
			}
		>
			{token ? (
				<form onSubmit={submit} className="flex flex-col gap-4">
					{error && <Alert>{error}</Alert>}
					<Field
						label={t("auth.password")}
						type="password"
						autoComplete="new-password"
						hint={t("auth.password_hint")}
						minLength={8}
						required
						value={password}
						onChange={(event) => setPassword(event.target.value)}
					/>
					<button type="submit" disabled={saving} className={buttonClass()}>
						{t("auth.reset_button")}
					</button>
				</form>
			) : (
				<Alert>{t("auth.reset_invalid")}</Alert>
			)}
		</AuthCard>
	);
}
