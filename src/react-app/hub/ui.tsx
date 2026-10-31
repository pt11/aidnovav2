import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Check, CircleAlert, MoreHorizontal, Search, type LucideIcon } from "lucide-react";
import { useI18n } from "./i18n";

export const LOGO = "/aidnova-logo.png";

const BUTTON_STYLES = {
	primary: "bg-primary text-primary-foreground hover:opacity-90",
	outline: "border border-input bg-card text-foreground hover:bg-muted",
	ghost: "text-foreground hover:bg-muted",
	danger: "bg-destructive text-primary-foreground hover:opacity-90",
	dangerOutline: "border border-destructive bg-card text-danger-foreground hover:bg-danger-surface",
	dangerGhost: "text-danger-foreground hover:bg-danger-surface",
};

// The small button, for actions inside rows and cards.
export const BUTTON_SMALL = "min-h-8 px-3 py-0 text-[13px]";

const CONTROL_CLASS =
	"min-h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground";

// One button everywhere: 36px on desktop, and 40px on phones for easier tapping.
export function buttonClass(
	variant: keyof typeof BUTTON_STYLES = "primary",
	className = "",
) {
	const height = className.includes("min-h-") ? "" : "min-h-10 md:min-h-9";
	const paddingX = /\bpx-/.test(className) ? "" : "px-3.5";
	const paddingY = /\bpy-/.test(className) ? "" : "py-1.5";
	return `inline-flex ${height} ${paddingX} ${paddingY} items-center justify-center gap-2 rounded-md text-sm font-medium no-underline transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${BUTTON_STYLES[variant]} ${className}`;
}

const CHIP_TONES = {
	primary: "bg-primary text-primary-foreground",
	danger: "bg-destructive text-primary-foreground",
	success: "bg-[#14795A] text-white",
	neutral: "bg-muted text-foreground",
	outline: "border border-input bg-card text-foreground",
};

// The one label chip, for priorities, statuses and roles.
export function Chip({
	tone = "outline",
	children,
}: {
	tone?: keyof typeof CHIP_TONES;
	children: ReactNode;
}) {
	return (
		<span
			className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-px text-xs font-semibold leading-5 ${CHIP_TONES[tone]}`}
		>
			{children}
		</span>
	);
}

// The one search box.
export function SearchField({
	label,
	value,
	onChange,
	autoFocus,
	className = "",
}: {
	label: string;
	value: string;
	onChange: (value: string) => void;
	autoFocus?: boolean;
	className?: string;
}) {
	return (
		<label
			className={`flex h-10 min-w-0 items-center gap-2 rounded-md border border-input bg-card px-2.5 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 md:h-9 ${className}`}
		>
			<Search size={16} aria-hidden="true" className="shrink-0 text-muted-foreground" />
			<input
				type="search"
				aria-label={label}
				placeholder={label}
				autoFocus={autoFocus}
				value={value}
				onChange={(event) => onChange(event.target.value)}
				className="min-w-0 flex-1 bg-transparent text-foreground outline-none"
			/>
		</label>
	);
}

// The one filter dropdown: the label stays visible next to the choice.
export function FilterSelect({
	label,
	value,
	onChange,
	children,
}: {
	label: string;
	value: string;
	onChange: (value: string) => void;
	children: ReactNode;
}) {
	return (
		<label className="inline-flex h-10 max-w-full items-center gap-1.5 rounded-md border border-input bg-card pl-2.5 pr-1 text-[13px] focus-within:border-primary md:h-9">
			<span className="shrink-0 text-muted-foreground">{label}</span>
			<select
				value={value}
				onChange={(event) => onChange(event.target.value)}
				className="min-w-0 bg-transparent py-1 pr-1 font-medium text-foreground outline-none"
			>
				{children}
			</select>
		</label>
	);
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

// The one filter and choice control, used everywhere the design has tabs of options.
export function Segmented<T extends string>({
	label,
	options,
	value,
	onChange,
}: {
	label: string;
	options: readonly { value: T; label: string }[];
	value: T;
	onChange: (value: T) => void;
}) {
	return (
		<div role="group" aria-label={label} className="inline-flex max-w-full flex-wrap rounded-md border border-border bg-muted p-[3px]">
			{options.map((option) => (
				<button
					key={option.value}
					type="button"
					aria-pressed={value === option.value}
					onClick={() => onChange(option.value)}
					className={`rounded px-3 py-1.5 text-[13px] font-medium leading-[18px] ${
						value === option.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
					}`}
				>
					{option.label}
				</button>
			))}
		</div>
	);
}

export function initialsOf(name: string) {
	return (
		name
			.split(/\s+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((word) => word[0])
			.join("")
			.toUpperCase() || "A"
	);
}

export function Avatar({
	name,
	photoUrl,
	size = 32,
	muted = false,
}: {
	name: string;
	photoUrl?: string | null;
	size?: number;
	muted?: boolean;
}) {
	const style = { width: size, height: size, fontSize: Math.max(11, Math.round(size * 0.36)) };
	return photoUrl ? (
		<img src={photoUrl} alt="" style={style} className="shrink-0 rounded-full object-cover" />
	) : (
		<span
			aria-hidden="true"
			style={style}
			className={`grid shrink-0 place-items-center rounded-full font-semibold ${
				muted ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground"
			}`}
		>
			{initialsOf(name)}
		</span>
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
				<h1 className="text-[26px] font-semibold leading-[34px] tracking-tight">{title}</h1>
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
	failedMessage,
	onConfirm,
	onClose,
}: {
	title: string;
	description: string;
	confirmLabel: string;
	open: boolean;
	pending: boolean;
	failed: boolean;
	failedMessage?: string;
	onConfirm: () => void;
	onClose: () => void;
}) {
	const { t } = useI18n();
	return (
		<Modal title={title} description={description} open={open} onClose={onClose}>
			{failed && (
				<div className="mb-4">
					<Alert>{failedMessage ?? t("error.generic")}</Alert>
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

// The public site is on the bare domain, and locally on plain localhost.
export function siteUrl(path = "") {
	const { protocol, hostname, port } = window.location;
	return hostname.endsWith("localhost")
		? `${protocol}//localhost:${port}${path}`
		: `https://aidnova.app${path}`;
}

function BrandPanel() {
	const { t } = useI18n();
	return (
		<section
			aria-label={t("brand.about")}
			className="relative hidden flex-col overflow-hidden bg-primary px-12 py-10 text-primary-foreground lg:flex"
		>
			<span
				aria-hidden="true"
				className="absolute -right-40 -bottom-40 size-[520px] rounded-full border border-white/20"
			/>
			<span
				aria-hidden="true"
				className="absolute -right-[60px] -bottom-[60px] size-80 rounded-full bg-white/10"
			/>
			<div className="flex items-center gap-2 font-semibold">
				<img src={LOGO} alt="" width="28" height="28" className="rounded-[5px]" />
				AidNova
			</div>
			<div className="relative my-auto max-w-[460px]">
				<h2 className="text-[36px] font-semibold leading-[44px] tracking-tight">
					{t("brand.title")}
				</h2>
				<p className="mt-4 text-base leading-[26px] text-white/90">{t("brand.desc")}</p>
				<ul className="mt-6 flex flex-col gap-2.5">
					{["brand.point_policies", "brand.point_courses", "brand.point_ngos"].map((key) => (
						<li key={key} className="flex items-center gap-2.5">
							<Check size={16} aria-hidden="true" className="shrink-0" />
							{t(key)}
						</li>
					))}
				</ul>
			</div>
			<p className="relative text-xs text-white/85">
				© 2026 AidNova ·{" "}
				<a href={siteUrl("/privacy-policy")} className="text-inherit underline">
					{t("brand.privacy")}
				</a>{" "}
				·{" "}
				<a href={siteUrl("/terms-of-service")} className="text-inherit underline">
					{t("brand.terms")}
				</a>
			</p>
		</section>
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
	const { t } = useI18n();
	return (
		<div className="grid min-h-dvh lg:grid-cols-2">
			<BrandPanel />
			<main className="flex min-w-0 flex-col bg-card">
				<div className="flex items-center justify-between gap-3 px-5 py-4 md:px-8">
					<a
						href={siteUrl()}
						className="text-[13px] text-muted-foreground no-underline hover:text-foreground"
					>
						← {t("brand.back_home")}
					</a>
					<LanguageSwitch />
				</div>
				<div className="flex flex-1 items-center justify-center px-5 pb-10">
					<div className="w-full max-w-[400px]">
						<div className="mb-6 flex items-center gap-2 font-semibold tracking-tight lg:hidden">
							<img src={LOGO} alt="" width="28" height="28" className="rounded-[5px]" />
							AidNova
						</div>
						<h1 className="text-[26px] font-semibold leading-[34px] tracking-tight">{title}</h1>
						{subtitle && <p className="mt-1 text-muted-foreground">{subtitle}</p>}
						<div className="mt-6">{children}</div>
						{footer && (
							<div className="mt-5 text-center text-[13px] text-muted-foreground">{footer}</div>
						)}
					</div>
				</div>
			</main>
		</div>
	);
}

export function PasswordField({
	label,
	hint,
	action,
	...inputProps
}: {
	label: string;
	hint?: string;
	action?: ReactNode;
} & React.InputHTMLAttributes<HTMLInputElement>) {
	const { t } = useI18n();
	const id = useId();
	const [shown, setShown] = useState(false);
	return (
		<div className="flex flex-col gap-1.5">
			<div className="flex items-center justify-between gap-3">
				<label htmlFor={id} className="text-sm font-medium">
					{label}
				</label>
				{action}
			</div>
			<div className="relative">
				<input
					id={id}
					aria-describedby={hint ? `${id}-hint` : undefined}
					className={`${CONTROL_CLASS} pr-16`}
					{...inputProps}
					type={shown ? "text" : "password"}
				/>
				<button
					type="button"
					aria-pressed={shown}
					onClick={() => setShown((value) => !value)}
					className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded px-2 py-1 text-xs font-medium text-selected-foreground hover:bg-muted"
				>
					{t(shown ? "auth.hide" : "auth.show")}
				</button>
			</div>
			{hint && (
				<p id={`${id}-hint`} className="text-xs leading-5 text-muted-foreground">
					{hint}
				</p>
			)}
		</div>
	);
}

export interface MenuAction {
	label: string;
	onSelect?: () => void;
	href?: string;
	newTab?: boolean;
	danger?: boolean;
	separated?: boolean;
}

// Uses fixed positioning, so a scrolling table around it can't clip the menu.
export function ActionsMenu({
	label,
	actions,
	triggerLabel,
	triggerIcon,
}: {
	label: string;
	actions: MenuAction[];
	triggerLabel?: string;
	triggerIcon?: ReactNode;
}) {
	const [position, setPosition] = useState<{ top: number; right: number } | null>(null);
	const trigger = useRef<HTMLButtonElement>(null);
	const menu = useRef<HTMLDivElement>(null);
	const open = position !== null;

	useEffect(() => {
		if (!open) return;
		const close = () => setPosition(null);
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				close();
				trigger.current?.focus();
			}
		};
		const onPointerDown = (event: PointerEvent) => {
			const target = event.target as Node;
			if (!menu.current?.contains(target) && !trigger.current?.contains(target)) close();
		};
		document.addEventListener("keydown", onKeyDown);
		document.addEventListener("pointerdown", onPointerDown);
		window.addEventListener("resize", close);
		document.addEventListener("scroll", close, true);
		return () => {
			document.removeEventListener("keydown", onKeyDown);
			document.removeEventListener("pointerdown", onPointerDown);
			window.removeEventListener("resize", close);
			document.removeEventListener("scroll", close, true);
		};
	}, [open]);

	const itemClass = (danger?: boolean) =>
		`block w-full rounded-md px-2.5 py-[7px] text-left text-[13px] no-underline ${
			danger
				? "text-danger-foreground hover:bg-danger-surface"
				: "text-foreground hover:bg-muted"
		}`;

	return (
		<>
			<button
				ref={trigger}
				type="button"
				aria-label={triggerLabel ? undefined : label}
				aria-haspopup="menu"
				aria-expanded={open}
				className={triggerLabel ? buttonClass() : "grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"}
				onClick={() => {
					if (open) {
						setPosition(null);
						return;
					}
					const rect = trigger.current?.getBoundingClientRect();
					if (rect) {
						setPosition({
							top: Math.min(rect.bottom + 4, window.innerHeight - 260),
							right: Math.max(8, window.innerWidth - rect.right),
						});
					}
				}}
			>
				{triggerLabel ? (
					<>
						{triggerIcon}
						{triggerLabel}
					</>
				) : (
					<MoreHorizontal size={18} aria-hidden="true" />
				)}
			</button>
			{open && (
				<div
					ref={menu}
					role="menu"
					aria-label={label}
					style={{ top: position.top, right: position.right }}
					className="fixed z-40 min-w-44 rounded-[9px] border border-border bg-card p-1 shadow-lg"
				>
					{actions.map((action) => (
						<div key={action.label}>
							{action.separated && <div role="separator" className="my-1 h-px bg-border" />}
							{action.href ? (
								<a
									role="menuitem"
									href={action.href}
									target={action.newTab ? "_blank" : undefined}
									rel={action.newTab ? "noopener noreferrer" : undefined}
									className={itemClass(action.danger)}
									onClick={() => setPosition(null)}
								>
									{action.label}
								</a>
							) : (
								<button
									type="button"
									role="menuitem"
									className={itemClass(action.danger)}
									onClick={() => {
										setPosition(null);
										action.onSelect?.();
									}}
								>
									{action.label}
								</button>
							)}
						</div>
					))}
				</div>
			)}
		</>
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
