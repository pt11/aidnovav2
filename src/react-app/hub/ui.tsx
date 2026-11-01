import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { Archive, Check, CircleAlert, CircleCheck, Download, Info, MoreHorizontal, Search, Sparkles, TriangleAlert, X, type LucideIcon } from "lucide-react";
import { useLocation } from "wouter";
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
	warning: "border border-[#F59F0A] bg-[#FEF6E7] text-[#030711] dark:bg-[#F59F0A]/15 dark:text-foreground",
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
					className={`flex items-start gap-1.5 text-xs leading-5 ${error ? "text-danger-foreground" : "text-muted-foreground"}`}
				>
					{error && <CircleAlert size={13} aria-hidden="true" className="mt-[3px] shrink-0" />}
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
	look = "segmented",
}: {
	label: string;
	options: readonly { value: T; label: string }[];
	value: T;
	onChange: (value: T) => void;
	look?: "segmented" | "underline" | "pills";
}) {
	const group = {
		segmented: "inline-flex max-w-full flex-wrap rounded-md border border-border bg-muted p-[3px]",
		underline: "flex max-w-full gap-4 overflow-x-auto border-b border-border",
		pills: "inline-flex max-w-full flex-wrap justify-center gap-2",
	}[look];
	const item = (selected: boolean) =>
		({
			segmented: `rounded px-3 py-1.5 text-[13px] font-medium leading-[18px] ${
				selected ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
			}`,
			underline: `-mb-px shrink-0 whitespace-nowrap border-b-2 px-0.5 py-2 text-sm font-medium ${
				selected ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
			}`,
			pills: `rounded-full border px-3.5 py-1 text-[13px] font-medium leading-5 ${
				selected ? "border-foreground bg-foreground text-background" : "border-border bg-card text-foreground hover:bg-muted"
			}`,
		})[look];
	return (
		<div role="group" aria-label={label} className={group}>
			{options.map((option) => (
				<button
					key={option.value}
					type="button"
					aria-pressed={value === option.value}
					onClick={() => onChange(option.value)}
					className={item(value === option.value)}
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

export function Skeleton({ className = "" }: { className?: string }) {
	return <span aria-hidden="true" className={`skeleton block rounded-md ${className}`} />;
}

function SkeletonTiles({ count = 4 }: { count?: number }) {
	return (
		<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
			{Array.from({ length: count }, (_, index) => (
				<div key={index} className="flex flex-col gap-2.5 rounded-card border border-border bg-card p-4">
					<Skeleton className="h-3.5 w-1/2" />
					<Skeleton className="h-7 w-1/3" />
					<Skeleton className="h-3 w-3/4" />
				</div>
			))}
		</div>
	);
}

function SkeletonRows({ count = 5 }: { count?: number }) {
	return (
		<div className="rounded-card border border-border bg-card">
			{Array.from({ length: count }, (_, index) => (
				<div key={index} className="flex items-center gap-3 border-t border-border px-4 py-3.5 first:border-t-0">
					<Skeleton className="size-8 shrink-0 rounded-full" />
					<div className="flex min-w-0 flex-1 flex-col gap-2">
						<Skeleton className="h-3.5 w-2/5" />
						<Skeleton className="h-3 w-3/5" />
					</div>
					<Skeleton className="h-6 w-16 shrink-0 max-sm:hidden" />
				</div>
			))}
		</div>
	);
}

function SkeletonCards({ count = 6 }: { count?: number }) {
	return (
		<div className="grid grid-cols-[repeat(auto-fill,minmax(min(280px,100%),1fr))] gap-3">
			{Array.from({ length: count }, (_, index) => (
				<div key={index} className="flex flex-col gap-3 rounded-card border border-border bg-card p-4">
					<Skeleton className="h-4 w-3/5" />
					<Skeleton className="h-3 w-2/5" />
					<Skeleton className="h-2 w-full rounded-full" />
					<Skeleton className="h-3 w-4/5" />
				</div>
			))}
		</div>
	);
}

// Shaped like the page on its way, so nothing jumps when it arrives. "inline" is
// for a section inside a page that already has its own heading.
export function PageLoading({ variant = "table" }: { variant?: "table" | "cards" | "detail" | "dashboard" | "inline" }) {
	const { t } = useI18n();
	const body =
		variant === "cards" ? (
			<SkeletonCards />
		) : variant === "dashboard" ? (
			<>
				<SkeletonTiles />
				<div className="grid items-start gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
					<SkeletonRows count={4} />
					<SkeletonRows count={3} />
				</div>
			</>
		) : variant === "detail" ? (
			<>
				<SkeletonTiles />
				<SkeletonRows count={4} />
			</>
		) : (
			<SkeletonRows count={variant === "inline" ? 3 : 6} />
		);
	return (
		<div role="status" className={`flex flex-col gap-4 ${variant === "inline" ? "" : "p-4 md:px-6 md:py-7"}`}>
			<span className="sr-only">{t("common.loading")}</span>
			{variant !== "inline" && (
				<div className="flex flex-col gap-2.5">
					<Skeleton className="h-7 w-52 max-w-full" />
					<Skeleton className="h-3.5 w-80 max-w-full" />
				</div>
			)}
			{body}
		</div>
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

const PREVIEWABLE = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp", "image/gif"]);

export function canPreviewFile(mimeType: string | null | undefined) {
	return !!mimeType && PREVIEWABLE.has(mimeType);
}

// The one way to look at a PDF or image: it stays on the page, in a drawer.
export function FilePreviewDrawer({
	name,
	mimeType,
	src,
	downloadHref,
	onClose,
}: {
	name: string;
	mimeType: string | null;
	src: string;
	downloadHref: string;
	onClose: () => void;
}) {
	const { t } = useI18n();
	const closeButton = useRef<HTMLButtonElement>(null);
	useEffect(() => {
		closeButton.current?.focus();
	}, []);
	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") onClose();
		};
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, [onClose]);
	return (
		<>
			<button type="button" aria-label={t("common.close")} onClick={onClose} className="fixed inset-0 z-50 bg-black/40" />
			<aside aria-label={name} className="fixed inset-y-0 right-0 z-50 flex w-[min(820px,100%)] flex-col bg-card shadow-lg">
				<header className="flex items-center gap-2 border-b border-border px-4 py-2.5">
					<h2 className="min-w-0 flex-1 truncate text-[15px] font-semibold">{name}</h2>
					<a href={downloadHref} className={buttonClass("outline", "min-h-9 px-3 py-0")}>
						<Download size={15} aria-hidden="true" />
						{t("files.download")}
					</a>
					<button
						ref={closeButton}
						type="button"
						aria-label={t("common.close")}
						className="grid size-9 shrink-0 place-items-center rounded-md hover:bg-muted"
						onClick={onClose}
					>
						<X size={18} aria-hidden="true" />
					</button>
				</header>
				<div className="min-h-0 flex-1 bg-muted">
					{mimeType === "application/pdf" ? (
						<iframe title={name} src={src} className="size-full border-0" />
					) : (
						<img src={src} alt={name} className="size-full object-contain p-4" />
					)}
				</div>
			</aside>
		</>
	);
}

export function Modal({
	title,
	description,
	open,
	wide = false,
	locked = false,
	onClose,
	children,
}: {
	title: string;
	description?: string;
	open: boolean;
	wide?: boolean;
	locked?: boolean;
	onClose: () => void;
	children: ReactNode;
}) {
	const { t } = useI18n();
	const ref = useRef<HTMLDialogElement>(null);
	const id = useId();
	// Clicking outside or pressing Esc closes it, unless that would lose what someone typed.
	const edited = useRef(false);
	const pressedOutside = useRef(false);
	const [kept, setKept] = useState(false);

	useEffect(() => {
		const dialog = ref.current;
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		if (!open && dialog.open) dialog.close();
	}, [open]);

	const isOutside = (event: MouseEvent<HTMLDialogElement>) => {
		const box = event.currentTarget.getBoundingClientRect();
		return event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom;
	};
	const keepOpen = () => {
		setKept(true);
		ref.current?.scrollTo({ top: 0 });
	};

	return (
		<dialog
			ref={ref}
			aria-labelledby={id}
			onClose={() => {
				edited.current = false;
				pressedOutside.current = false;
				setKept(false);
				onClose();
			}}
			onCancel={(event) => {
				if (edited.current || locked) {
					event.preventDefault();
					if (edited.current) keepOpen();
				}
			}}
			onInput={() => {
				edited.current = true;
				setKept(false);
			}}
			// Only a press that began outside counts, so dragging to select text doesn't close it.
			onMouseDown={(event) => {
				pressedOutside.current = event.target === event.currentTarget && isOutside(event);
			}}
			onClick={(event) => {
				if (event.target !== event.currentTarget || !isOutside(event) || !pressedOutside.current || locked) return;
				if (edited.current) keepOpen();
				else event.currentTarget.close();
			}}
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
					{kept && (
						<div className="mt-3">
							<Alert tone="warning">{t("common.kept_open")}</Alert>
						</div>
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
		<Modal title={title} description={description} open={open} locked={pending} onClose={onClose}>
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

export type AlertTone = "info" | "success" | "warning" | "error" | "neutral" | "ai";

const TONE_ICONS: Record<AlertTone, LucideIcon> = {
	info: Info,
	success: CircleCheck,
	warning: TriangleAlert,
	error: CircleAlert,
	neutral: Archive,
	ai: Sparkles,
};

function DismissButton({ onClick, className = "" }: { onClick: () => void; className?: string }) {
	const { t } = useI18n();
	return (
		<button type="button" aria-label={t("common.dismiss")} onClick={onClick} className={`grid size-7 shrink-0 place-items-center rounded-md hover:bg-black/5 dark:hover:bg-white/10 ${className}`}>
			<X size={15} aria-hidden="true" />
		</button>
	);
}

// With no title, the message itself is the title. Errors interrupt screen readers; the rest wait.
export function Alert({
	children,
	tone = "error",
	title,
	actions,
	onDismiss,
}: {
	children?: ReactNode;
	tone?: AlertTone;
	title?: ReactNode;
	actions?: ReactNode;
	onDismiss?: () => void;
}) {
	const Icon = TONE_ICONS[tone];
	return (
		<div
			role={tone === "error" ? "alert" : "status"}
			className={`tone-${tone} flex items-start gap-3 rounded-[10px] border border-[var(--tone-border)] bg-[var(--tone-bg)] py-3.5 pr-3.5 pl-4`}
		>
			<Icon size={18} aria-hidden="true" className="mt-px shrink-0 text-[var(--tone-icon)]" />
			<div className="min-w-0 flex-1 break-words">
				<div className="text-sm leading-5 font-semibold text-[var(--tone-title)]">{title ?? children}</div>
				{title && children && <div className="mt-0.5 text-sm leading-[21px] text-[var(--alert-body)]">{children}</div>}
				{actions && <div className="mt-3 flex flex-wrap gap-2">{actions}</div>}
			</div>
			{onDismiss && <DismissButton onClick={onDismiss} className="text-muted-foreground" />}
		</div>
	);
}

// Quiet, for inside a card.
export function AccentNote({ tone = "info", label, children }: { tone?: AlertTone; label?: string; children: ReactNode }) {
	const Icon = TONE_ICONS[tone];
	return (
		<div role="status" className={`tone-${tone} flex items-start gap-3 rounded-lg border border-l-4 border-border border-l-[var(--tone-icon)] bg-card px-3.5 py-3 text-sm leading-5`}>
			<Icon size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--tone-icon)]" />
			<span className="min-w-0 break-words">
				{label && <b>{label} </b>}
				<span className="text-muted-foreground">{children}</span>
			</span>
		</div>
	);
}

// Small, next to the thing it's about.
export function StatusTag({ tone = "info", children }: { tone?: AlertTone; children: ReactNode }) {
	const Icon = TONE_ICONS[tone];
	return (
		<span role="status" className={`tone-${tone} inline-flex items-center gap-2 rounded-md bg-[var(--tone-bg)] px-2.5 py-1.5 text-[13px] leading-[18px] text-[var(--tone-title)]`}>
			<Icon size={14} aria-hidden="true" className="shrink-0" />
			{children}
		</span>
	);
}

// Full width at the top of the app, for things that affect the whole workspace.
export function PageBanner({ tone = "info", action, onDismiss, children }: { tone?: AlertTone; action?: ReactNode; onDismiss?: () => void; children: ReactNode }) {
	const Icon = TONE_ICONS[tone];
	return (
		<div
			role={tone === "error" ? "alert" : "status"}
			className={`tone-${tone} flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[var(--tone-border)] bg-[var(--tone-solid)] px-4 py-2.5 text-sm text-[var(--tone-solid-text)] md:px-5`}
		>
			<Icon size={17} aria-hidden="true" className="shrink-0" />
			<span className="min-w-0 flex-1 basis-52 break-words">{children}</span>
			{action && <span className="font-semibold underline underline-offset-2 [&_a]:text-inherit">{action}</span>}
			{onDismiss && <DismissButton onClick={onDismiss} />}
		</div>
	);
}

interface ToastMessage {
	id: number;
	tone: "success" | "info" | "error";
	title: string;
	description?: string;
}

type ShowToast = (toast: Omit<ToastMessage, "id">) => void;
const ToastContext = createContext<ShowToast>(() => {});
const MAX_TOASTS = 3;

// For the result of something the person just did. Anything they have to act on
// later belongs in an inline alert instead.
export function useToast() {
	const show = useContext(ToastContext);
	return useMemo(
		() => ({
			success: (title: string, description?: string) => show({ tone: "success", title, description }),
			info: (title: string, description?: string) => show({ tone: "info", title, description }),
			error: (title: string, description?: string) => show({ tone: "error", title, description }),
		}),
		[show],
	);
}

function Toast({ toast, onDismiss }: { toast: ToastMessage; onDismiss: () => void }) {
	const Icon = TONE_ICONS[toast.tone];
	return (
		<div
			role={toast.tone === "error" ? "alert" : "status"}
			className={`toast tone-${toast.tone} pointer-events-auto relative flex w-full items-start gap-3 overflow-hidden rounded-xl border border-border bg-card p-3.5 shadow-[0_16px_40px_rgba(3,7,17,0.14)]`}
		>
			<Icon size={18} aria-hidden="true" className="mt-px shrink-0 text-[var(--tone-icon)]" />
			<div className="min-w-0 flex-1 break-words">
				<b className="block text-sm leading-5">{toast.title}</b>
				{toast.description && <span className="block text-[13px] leading-[19px] text-muted-foreground">{toast.description}</span>}
			</div>
			<DismissButton onClick={onDismiss} className="text-muted-foreground" />
			{/* Errors stay until dismissed. The rest close when this runs out, and hovering pauses it. */}
			{toast.tone !== "error" && (
				<span aria-hidden="true" onAnimationEnd={onDismiss} className="toast-timer absolute bottom-0 left-0 h-[3px] w-full bg-[var(--tone-icon)]" />
			)}
		</div>
	);
}

export function ToastProvider({ children }: { children: ReactNode }) {
	const [toasts, setToasts] = useState<ToastMessage[]>([]);
	const nextId = useRef(1);
	const show = useCallback<ShowToast>((toast) => {
		const id = nextId.current++;
		setToasts((current) => [...current, { ...toast, id }].slice(-MAX_TOASTS));
	}, []);
	return (
		<ToastContext.Provider value={show}>
			{children}
			<div className="pointer-events-none fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-4 z-[60] flex flex-col gap-2.5 md:bottom-4 md:left-auto md:w-[380px]">
				{toasts.map((toast) => (
					<Toast key={toast.id} toast={toast} onDismiss={() => setToasts((current) => current.filter((item) => item.id !== toast.id))} />
				))}
			</div>
		</ToastContext.Provider>
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

// The outlined nova star from the brand, drawn as an inside stroke.
export function NovaStar({ className, width = 498, strokeWidth = 14 }: { className?: string; width?: number; strokeWidth?: number }) {
	const mask = useId();
	return (
		<svg
			aria-hidden="true"
			width={width}
			height={(width * 576) / 498}
			viewBox="0 0 498 576"
			fill="none"
			className={className}
		>
			<mask id={mask} fill="white">
				<path d="M496.515 432.848C496.515 432.848 496.515 432.848 496.564 432.848C496.614 432.848 496.663 432.898 496.762 432.947C496.861 432.997 496.911 433.047 497.01 433.097C497.109 433.146 497.257 433.246 497.356 433.296C497.406 433.296 497.455 433.346 497.505 433.395L498 433.694C497.95 433.694 497.851 433.594 497.802 433.545C497.406 433.296 497.01 433.097 496.663 432.848C484.73 425.779 473.64 417.167 463.688 407.161C432.544 375.848 415.017 333.385 415.017 289.08C415.017 244.774 432.495 202.311 463.688 170.998C473.739 160.893 484.929 152.231 496.911 145.162C496.96 145.162 497.059 145.062 497.109 145.062C497.257 144.963 497.356 144.913 497.505 144.814C497.406 144.863 497.307 144.913 497.257 144.963C472.402 159.2 444.13 166.867 415.066 166.867C371 166.867 328.765 149.294 297.622 117.932C266.924 87.0674 249.495 45.3507 249 1.74234C249 1.14497 249 0.547593 249 0C249 132.816 301.533 260.206 394.964 354.144C425.612 384.958 459.826 411.342 496.614 432.848H496.515Z" />
				<path d="M200.281 118.081C169.076 149.433 126.708 167.078 82.6031 167.078C53.4811 167.078 25.153 159.402 0.248057 145.146C0.148834 145.096 0.0496114 145.046 0 144.997C0.148834 145.096 0.248057 145.146 0.396892 145.246C0.396892 145.246 0.446503 145.246 0.496115 145.296C12.5517 152.423 23.8135 161.096 33.8846 171.215C65.0902 202.567 82.6031 245.084 82.6031 289.445C82.6031 333.806 65.0902 376.323 33.8846 407.675C23.9127 417.694 12.7501 426.367 0.793783 433.445C0.69456 433.495 0.595337 433.544 0.496115 433.644C0.496115 433.644 0.446503 433.644 0.396892 433.694C0.396892 433.694 0.396892 433.694 0.446503 433.694C0.595337 433.644 0.69456 433.544 0.843395 433.445C37.7543 411.862 72.0854 385.445 102.845 354.541C196.362 260.535 249 132.984 249 0C249 0.59813 249 1.19624 249 1.74452C248.504 45.408 231.041 87.1774 200.281 118.081Z" />
				<path d="M300.842 458.91C331.783 427.834 373.743 410.345 417.523 410.345C445.956 410.345 473.601 417.706 498 431.391C423.869 388.853 339.359 365.929 252.488 365.929C165.616 365.929 80.9588 388.903 6.72966 431.49C31.1776 417.706 58.9213 410.295 87.452 410.295C131.232 410.295 173.192 427.785 204.133 458.86C234.631 489.492 251.947 530.893 252.438 574.172C252.438 574.814 252.438 575.407 252.438 576C252.438 575.358 252.438 574.765 252.438 574.172C252.93 530.893 270.246 489.492 300.744 458.86L300.842 458.91Z" />
			</mask>
			<path
				d="M249 0C249 0.547593 249 1.14497 249 1.74234C249.495 45.3507 266.924 87.0674 297.622 117.932C328.765 149.294 371 166.867 415.066 166.867C444.13 166.867 472.402 159.2 497.257 144.963C497.307 144.913 497.406 144.863 497.505 144.814C497.356 144.913 497.257 144.963 497.109 145.062C497.059 145.062 496.96 145.162 496.911 145.162C484.929 152.231 473.739 160.893 463.688 170.998C432.495 202.311 415.017 244.774 415.017 289.08C415.017 333.385 432.544 375.848 463.688 407.161C473.64 417.167 484.731 425.779 496.663 432.848C497.01 433.097 497.406 433.296 497.802 433.545C497.851 433.594 497.95 433.694 498 433.694L497.505 433.395C497.455 433.346 497.406 433.296 497.356 433.296C497.257 433.246 497.109 433.146 497.01 433.097C496.911 433.047 496.861 432.997 496.762 432.947C496.663 432.898 496.614 432.848 496.564 432.848C496.515 432.848 496.515 432.848 496.515 432.848H496.614C459.826 411.342 425.612 384.958 394.964 354.144C301.533 260.206 249 132.816 249 0ZM249 0C249 132.984 196.362 260.535 102.845 354.541C72.0854 385.445 37.7543 411.862 0.843395 433.445C0.69456 433.544 0.595337 433.644 0.446503 433.694C0.396892 433.694 0.396892 433.694 0.396892 433.694C0.446503 433.644 0.496115 433.644 0.496115 433.644C0.595337 433.544 0.69456 433.495 0.793783 433.445C12.7501 426.367 23.9127 417.694 33.8846 407.675C65.0902 376.323 82.6031 333.806 82.6031 289.445C82.6031 245.084 65.0902 202.567 33.8846 171.215C23.8135 161.096 12.5517 152.423 0.496115 145.296C0.446503 145.246 0.396892 145.246 0.396892 145.246C0.248057 145.146 0.148834 145.096 0 144.997C0.0496115 145.046 0.148834 145.096 0.248057 145.146C25.153 159.402 53.4811 167.078 82.6031 167.078C126.708 167.078 169.076 149.433 200.281 118.081C231.041 87.1774 248.504 45.408 249 1.74452C249 1.19624 249 0.59813 249 0ZM252.438 574.172C251.947 530.893 234.631 489.492 204.133 458.86C173.192 427.785 131.232 410.295 87.452 410.295C58.9213 410.295 31.1776 417.706 6.72966 431.49C80.9588 388.903 165.616 365.929 252.488 365.929C339.359 365.929 423.869 388.853 498 431.391C473.601 417.706 445.956 410.345 417.523 410.345C373.743 410.345 331.783 427.834 300.842 458.91L300.744 458.86C270.246 489.492 252.93 530.893 252.438 574.172ZM252.438 574.172C252.438 574.814 252.438 575.407 252.438 576C252.438 575.358 252.438 574.765 252.438 574.172Z"
				strokeWidth={strokeWidth}
				stroke="currentColor"
				mask={`url(#${mask})`}
			/>
		</svg>
	);
}

function BrandPanel() {
	const { t } = useI18n();
	return (
		<section
			aria-label={t("brand.about")}
			className="relative hidden flex-col overflow-hidden bg-primary px-12 py-10 text-primary-foreground lg:flex"
		>
			<NovaStar className="pointer-events-none absolute -right-[156px] bottom-[15px] max-w-none text-white/15" />
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

export const TABLE_CELL = "px-3 py-2.5 first:pl-4 last:pr-4";
export const ROW_LINK = "cursor-pointer";

// The one data table. `bare` leaves out the card, for a table sharing one with a footer.
export function DataTable({
	minWidth = 640,
	head,
	bare = false,
	stacked = false,
	children,
}: {
	minWidth?: number;
	head: ReactNode[];
	bare?: boolean;
	stacked?: boolean;
	children: ReactNode;
}) {
	return (
		<div className={`overflow-x-auto ${bare ? "" : "rounded-card border border-border bg-card"}`}>
			<table className={`w-full text-left text-[13px] ${stacked ? "stack-table" : ""}`} style={stacked ? undefined : { minWidth }}>
				<thead className="bg-background text-xs text-muted-foreground">
					<tr>
						{head.map((title, index) => (
							<th key={index} scope="col" className="px-3 py-2.5 font-semibold first:pl-4 last:pr-4">
								{title}
							</th>
						))}
					</tr>
				</thead>
				<tbody className="[&>tr]:border-t [&>tr]:border-border [&>tr]:transition-colors [&>tr:hover]:bg-muted/50">
					{children}
				</tbody>
			</table>
		</div>
	);
}

// Makes a whole row or card open a page. The name inside it stays a real link for
// keyboards and screen readers. Mark a cell data-no-row-link to keep misclicks
// around a checkbox or menu from navigating away.
export function useRowLink() {
	const [, navigate] = useLocation();
	return (href: string) => (event: MouseEvent) => {
		const target = event.target as Element;
		if (target.closest("a, button, input, select, textarea, label, [role=menu], [data-no-row-link]")) return;
		if (window.getSelection()?.toString()) return;
		if (event.metaKey || event.ctrlKey) {
			window.open(href, "_blank", "noopener");
			return;
		}
		navigate(href);
	};
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
	triggerClass,
}: {
	label: string;
	actions: MenuAction[];
	triggerLabel?: string;
	triggerIcon?: ReactNode;
	triggerClass?: string;
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
				className={triggerClass ?? (triggerLabel ? buttonClass() : "grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground")}
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
