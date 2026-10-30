import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { CircleAlert, type LucideIcon } from "lucide-react";
import { useI18n } from "./i18n";

export const LOGO = "/aidnova-logo.png";

const BUTTON_STYLES = {
	primary: "bg-primary text-primary-foreground hover:opacity-90",
	outline: "border border-input bg-card text-foreground hover:bg-muted",
	ghost: "text-foreground hover:bg-muted",
	danger: "bg-destructive text-primary-foreground hover:opacity-90",
};

const CONTROL_CLASS =
	"min-h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground";

export function buttonClass(
	variant: keyof typeof BUTTON_STYLES = "primary",
	className = "",
) {
	return `inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold no-underline transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${BUTTON_STYLES[variant]} ${className}`;
}

export function Field({
	label,
	hint,
	error,
	...inputProps
}: {
	label: string;
	hint?: string;
	error?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
	const id = useId();
	const hintId = `${id}-hint`;
	const describedBy = error || hint ? hintId : undefined;
	return (
		<div className="flex flex-col gap-1.5">
			<label htmlFor={id} className="text-sm font-medium">
				{label}
			</label>
			<input
				id={id}
				aria-invalid={error ? true : undefined}
				aria-describedby={describedBy}
				className={`${CONTROL_CLASS} aria-invalid:border-destructive`}
				{...inputProps}
			/>
			{(error || hint) && (
				<p
					id={hintId}
					className={`text-xs leading-5 ${error ? "text-danger-foreground" : "text-muted-foreground"}`}
				>
					{error || hint}
				</p>
			)}
		</div>
	);
}

export function TextareaField({
	label,
	hint,
	...props
}: {
	label: string;
	hint?: string;
} & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
	const id = useId();
	return (
		<div className="flex flex-col gap-1.5">
			<label htmlFor={id} className="text-sm font-medium">
				{label}
			</label>
			<textarea
				id={id}
				rows={4}
				aria-describedby={hint ? `${id}-hint` : undefined}
				className={CONTROL_CLASS}
				{...props}
			/>
			{hint && (
				<p id={`${id}-hint`} className="text-xs leading-5 text-muted-foreground">
					{hint}
				</p>
			)}
		</div>
	);
}

export function SelectField({
	label,
	children,
	...props
}: {
	label: string;
	children: ReactNode;
} & React.SelectHTMLAttributes<HTMLSelectElement>) {
	const id = useId();
	return (
		<div className="flex flex-col gap-1.5">
			<label htmlFor={id} className="text-sm font-medium">
				{label}
			</label>
			<select id={id} className={CONTROL_CLASS} {...props}>
				{children}
			</select>
		</div>
	);
}

export function PageHeader({
	title,
	subtitle,
	action,
}: {
	title: string;
	subtitle?: string;
	action?: ReactNode;
}) {
	return (
		<div className="flex flex-wrap items-start justify-between gap-3">
			<div className="min-w-0">
				<h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
				{subtitle && (
					<p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
				)}
			</div>
			{action}
		</div>
	);
}

export function PageLoading() {
	const { t } = useI18n();
	return (
		<p role="status" className="p-6 text-sm text-muted-foreground">
			{t("common.loading")}
		</p>
	);
}

export function PageError({ onRetry }: { onRetry: () => void }) {
	const { t } = useI18n();
	return (
		<StatePanel
			icon={CircleAlert}
			title={t("error.load")}
			action={
				<button
					type="button"
					className={buttonClass("outline")}
					onClick={onRetry}
				>
					{t("common.retry")}
				</button>
			}
		/>
	);
}

export function Modal({
	title,
	description,
	open,
	wide = false,
	onClose,
	children,
}: {
	title: string;
	description?: string;
	open: boolean;
	wide?: boolean;
	onClose: () => void;
	children: ReactNode;
}) {
	const ref = useRef<HTMLDialogElement>(null);
	const id = useId();

	useEffect(() => {
		const dialog = ref.current;
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		if (!open && dialog.open) dialog.close();
	}, [open]);

	return (
		<dialog
			ref={ref}
			aria-labelledby={id}
			onClose={onClose}
			className={`m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] overflow-y-auto rounded-card border border-border bg-card p-6 text-foreground shadow-lg backdrop:bg-black/50 ${wide ? "max-w-3xl" : "max-w-lg"}`}
		>
			{open && (
				<>
					<h2 id={id} className="text-lg font-semibold">
						{title}
					</h2>
					{description && (
						<p className="mt-1 text-sm text-muted-foreground">{description}</p>
					)}
					<div className="mt-4">{children}</div>
				</>
			)}
		</dialog>
	);
}

export function ConfirmModal({
	title,
	description,
	confirmLabel,
	open,
	pending,
	failed,
	onConfirm,
	onClose,
}: {
	title: string;
	description: string;
	confirmLabel: string;
	open: boolean;
	pending: boolean;
	failed: boolean;
	onConfirm: () => void;
	onClose: () => void;
}) {
	const { t } = useI18n();
	return (
		<Modal title={title} description={description} open={open} onClose={onClose}>
			{failed && (
				<div className="mb-4">
					<Alert>{t("error.generic")}</Alert>
				</div>
			)}
			<div className="flex justify-end gap-2">
				<button type="button" className={buttonClass("outline")} onClick={onClose}>
					{t("common.cancel")}
				</button>
				<button
					type="button"
					disabled={pending}
					className={buttonClass("danger")}
					onClick={onConfirm}
				>
					{confirmLabel}
				</button>
			</div>
		</Modal>
	);
}

export function Alert({ children }: { children: ReactNode }) {
	return (
		<p
			role="alert"
			className="rounded-md bg-danger-surface px-3 py-2 text-sm text-danger-foreground"
		>
			{children}
		</p>
	);
}

export function StatePanel({
	icon: Icon,
	title,
	description,
	action,
}: {
	icon?: LucideIcon;
	title: string;
	description?: string;
	action?: ReactNode;
}) {
	return (
		<div className="mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-16 text-center">
			{Icon && (
				<span className="grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
					<Icon size={20} aria-hidden="true" />
				</span>
			)}
			<h1 className="text-lg font-semibold">{title}</h1>
			{description && (
				<p className="text-sm text-muted-foreground">{description}</p>
			)}
			{action}
		</div>
	);
}

// Becomes a recovery prompt after about 12 seconds, matching v1's startup screen.
export function StartupScreen() {
	const { t } = useI18n();
	const [slow, setSlow] = useState(false);

	useEffect(() => {
		const timer = window.setTimeout(() => setSlow(true), 12_000);
		return () => window.clearTimeout(timer);
	}, []);

	return (
		<div
			role="status"
			className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center"
		>
			<img src={LOGO} alt="" width="48" height="48" className="rounded-md" />
			<p className="text-sm text-muted-foreground">
				{slow ? t("loading.slow") : t("loading.app")}
			</p>
			{slow && (
				<button
					type="button"
					className={buttonClass("outline")}
					onClick={() => window.location.reload()}
				>
					{t("common.retry")}
				</button>
			)}
		</div>
	);
}

export function AuthCard({
	title,
	subtitle,
	children,
	footer,
}: {
	title: string;
	subtitle?: string;
	children: ReactNode;
	footer?: ReactNode;
}) {
	return (
		<main className="flex min-h-dvh flex-col items-center justify-center gap-5 px-4 py-10">
			<div className="flex items-center gap-2 font-semibold tracking-tight">
				<img src={LOGO} alt="" width="28" height="28" className="rounded-[5px]" />
				AidNova
			</div>
			<div className="w-full max-w-sm rounded-card border border-border bg-card p-6 shadow-sm">
				<h1 className="text-xl font-semibold">{title}</h1>
				{subtitle && (
					<p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
				)}
				<div className="mt-5">{children}</div>
			</div>
			{footer && (
				<div className="text-center text-sm text-muted-foreground">{footer}</div>
			)}
			<LanguageSwitch />
		</main>
	);
}

export function LanguageSwitch() {
	const { language, setLanguage, t } = useI18n();
	const options = [
		{ value: "en" as const, label: "EN" },
		{ value: "my" as const, label: "မြန်မာ" },
	];
	return (
		<div
			role="group"
			aria-label={t("shell.language")}
			className="inline-flex rounded-md border border-border bg-muted p-0.5"
		>
			{options.map((option) => (
				<button
					key={option.value}
					type="button"
					lang={option.value}
					aria-pressed={language === option.value}
					onClick={() => setLanguage(option.value)}
					className={`rounded px-2.5 py-0.5 text-xs font-medium ${
						language === option.value
							? "bg-card text-foreground shadow-sm"
							: "text-muted-foreground"
					}`}
				>
					{option.label}
				</button>
			))}
		</div>
	);
}
