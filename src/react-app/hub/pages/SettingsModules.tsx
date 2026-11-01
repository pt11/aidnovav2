import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Award, Check, CircleAlert, Contact, FolderKanban, type LucideIcon } from "lucide-react";
import { Link } from "wouter";
import { api, ME_QUERY_KEY, type Membership } from "../api";
import { useI18n } from "../i18n";
import {
	Alert,
	BUTTON_SMALL,
	buttonClass,
	Chip,
	Field,
	Modal,
	PageError,
	PageLoading,
	TextareaField,
} from "../ui";
import { SettingsLayout } from "./SettingsArea";

interface ModuleState {
	key: "projects" | "capacity_building" | "people_directory";
	release: "coming_soon" | "pilot" | "available";
	paused: boolean;
	needsReview: boolean;
	entitled: boolean;
	source: "override" | "trial" | "plan" | null;
	enabled: boolean;
	active: boolean;
	overrideUntil: string | null;
	reviewAt: string | null;
	reviewNote: string | null;
	plans: string[];
}

interface ModulesData {
	modules: ModuleState[];
	status: string;
	trialEndDate: string | null;
}

const MODULES_KEY = ["organization-modules"];
const ICONS: Record<ModuleState["key"], LucideIcon> = {
	projects: FolderKanban,
	capacity_building: Award,
	people_directory: Contact,
};
const ALWAYS_ON = [
	"nav.policies",
	"nav.courses",
	"modules.files_hub",
	"nav.calendar",
	"nav.announcements",
	"shell.notifications",
];

function statusOf(module: ModuleState) {
	if (module.paused) return { key: "modules.status_paused", tone: "outline" } as const;
	if (!module.entitled) {
		return module.release === "coming_soon" && module.source === null
			? ({ key: "modules.status_coming_soon", tone: "neutral" } as const)
			: ({ key: "modules.status_not_in_plan", tone: "outline" } as const);
	}
	if (module.active) return { key: "modules.status_on", tone: "success" } as const;
	if (module.needsReview && !module.reviewAt) return { key: "modules.status_setting_up", tone: "warning" } as const;
	return { key: "modules.status_off", tone: "neutral" } as const;
}

function ReviewDialog({ module, onClose }: { module: ModuleState; onClose: () => void }) {
	const { t } = useI18n();
	const queryClient = useQueryClient();
	const [today] = useState(() => new Date().toISOString().slice(0, 10));
	const [date, setDate] = useState(module.reviewAt?.slice(0, 10) ?? today);
	const [note, setNote] = useState(module.reviewNote ?? "");
	const save = useMutation({
		mutationFn: () =>
			api(`/organizations/current/modules/${module.key}/review`, {
				method: "POST",
				body: { date, note },
			}),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: MODULES_KEY });
			onClose();
		},
	});
	function submit(event: FormEvent) {
		event.preventDefault();
		save.mutate();
	}
	return (
		<Modal
			title={t("modules.review_title")}
			description={t("modules.review_desc")}
			open
			onClose={onClose}
		>
			<form onSubmit={submit} className="flex flex-col gap-3.5">
				{save.isError && <Alert>{t("error.generic")}</Alert>}
				<Field
					label={t("modules.review_date")}
					type="date"
					required
					max={today}
					value={date}
					onChange={(event) => setDate(event.target.value)}
				/>
				<TextareaField
					label={t("modules.review_who")}
					hint={t("modules.review_who_hint")}
					rows={3}
					required
					maxLength={1000}
					value={note}
					onChange={(event) => setNote(event.target.value)}
				/>
				<div className="flex justify-end gap-2">
					<button type="button" className={buttonClass("outline")} onClick={onClose}>
						{t("common.cancel")}
					</button>
					<button type="submit" disabled={save.isPending || !note.trim()} className={buttonClass()}>
						{t("common.save")}
					</button>
				</div>
			</form>
		</Modal>
	);
}

function ModuleCard({ module }: { module: ModuleState }) {
	const { t, language } = useI18n();
	const queryClient = useQueryClient();
	const [confirmingOff, setConfirmingOff] = useState(false);
	const [reviewing, setReviewing] = useState(false);
	const change = useMutation({
		mutationFn: (enable: boolean) =>
			api(`/organizations/current/modules/${module.key}/${enable ? "enable" : "disable"}`, {
				method: "POST",
			}),
		onSuccess: async () => {
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: MODULES_KEY }),
				queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY }),
			]);
			setConfirmingOff(false);
		},
	});
	const Icon = ICONS[module.key];
	const status = statusOf(module);
	const name = t(`modules.${module.key}`);
	const blockedByReview = module.needsReview && !module.reviewAt;
	const planNames = [t("shell.free_trial"), ...module.plans].join(" · ");
	return (
		<section
			className={`flex flex-col gap-3 rounded-card bg-card px-5 py-[18px] ${
				module.entitled && blockedByReview ? "border-2 border-primary" : "border border-border"
			}`}
		>
			<div className="flex flex-wrap items-start gap-3.5">
				<span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-card bg-selected text-selected-foreground">
					<Icon size={20} />
				</span>
				<div className="min-w-0 flex-[1_1_280px]">
					<div className="flex flex-wrap items-center gap-2">
						<h3 className="text-base font-semibold">{name}</h3>
						<Chip tone={status.tone}>{t(status.key)}</Chip>
						<span className="text-xs text-muted-foreground">{planNames}</span>
					</div>
					<p className="mt-1 text-[13px] text-muted-foreground">{t(`modules.${module.key}_desc`)}</p>
					{module.source === "override" && (
						<p className="mt-1 text-xs text-muted-foreground">
							{module.overrideUntil
								? t("modules.granted_until", {
										date: new Date(module.overrideUntil).toLocaleDateString(language, { dateStyle: "medium" }),
									})
								: t("modules.granted")}
						</p>
					)}
				</div>
				{module.entitled &&
					(blockedByReview ? (
						<button
							type="button"
							disabled
							title={t("modules.finish_steps")}
							className={buttonClass()}
						>
							{t("modules.turn_on")}
						</button>
					) : (
						<button
							type="button"
							role="switch"
							aria-checked={module.enabled}
							aria-label={name}
							disabled={change.isPending}
							className="inline-flex shrink-0 items-center gap-2 text-[13px] font-medium disabled:opacity-60"
							onClick={() => {
								change.reset();
								if (module.enabled) setConfirmingOff(true);
								else change.mutate(true);
							}}
						>
							<span
								aria-hidden="true"
								className={`relative h-[22px] w-10 rounded-full transition-colors ${module.enabled ? "bg-primary" : "bg-input"}`}
							>
								<span
									className={`absolute top-0.5 size-[18px] rounded-full bg-white transition-[left] ${module.enabled ? "left-5" : "left-0.5"}`}
								/>
							</span>
							{t(module.enabled ? "modules.on" : "modules.off")}
						</button>
					))}
			</div>
			{change.isError && !confirmingOff && <Alert>{t("error.generic")}</Alert>}
			{module.paused && (
				<p className="border-t border-border pt-2.5 text-[13px] text-muted-foreground">{t("modules.paused_note")}</p>
			)}
			{!module.paused && !module.entitled && module.enabled && (
				<p className="border-t border-border pt-2.5 text-[13px] text-muted-foreground">{t("modules.kept_note")}</p>
			)}
			{module.entitled && module.needsReview && (
				<div className="border-t border-border pt-2">
					<p className="text-[13px] font-semibold">{t("modules.before_staff")}</p>
					<div className="mt-1 flex items-start gap-2.5 border-t border-border py-2 text-[13px]">
						{module.reviewAt ? (
							<span
								role="img"
								aria-label={t("modules.done")}
								className="grid size-5 shrink-0 place-items-center rounded-full bg-[#22A076] text-[#030711]"
							>
								<Check size={12} strokeWidth={3} aria-hidden="true" />
							</span>
						) : (
							<span
								role="img"
								aria-label={t("modules.to_do")}
								className="size-5 shrink-0 rounded-full border-2 border-[#F59F0A]"
							/>
						)}
						<span className="min-w-0 flex-1">
							<span className="block font-semibold">{t("modules.review_step")}</span>
							<span className="block whitespace-pre-wrap break-words text-xs text-muted-foreground">
								{module.reviewAt
									? `${new Date(module.reviewAt).toLocaleDateString(language, { dateStyle: "medium", timeZone: "UTC" })} · ${module.reviewNote ?? ""}`
									: t("modules.review_step_hint")}
							</span>
						</span>
						<button
							type="button"
							className={buttonClass("outline", BUTTON_SMALL)}
							onClick={() => setReviewing(true)}
						>
							{t(module.reviewAt ? "common.edit" : "modules.record")}
						</button>
					</div>
				</div>
			)}
			{reviewing && <ReviewDialog module={module} onClose={() => setReviewing(false)} />}
			<Modal title={t("modules.off_title", { name })} open={confirmingOff} onClose={() => setConfirmingOff(false)}>
				<div className="flex flex-col gap-3.5">
					{change.isError && <Alert>{t("error.generic")}</Alert>}
					<ul className="flex list-disc flex-col gap-1.5 pl-5 text-[13px]">
						<li>{t("modules.off_menu", { name })}</li>
						<li>{t("modules.off_kept")}</li>
						<li>{t("modules.off_back")}</li>
					</ul>
					<div className="flex justify-end gap-2">
						<button type="button" className={buttonClass("outline")} onClick={() => setConfirmingOff(false)}>
							{t("common.cancel")}
						</button>
						<button
							type="button"
							disabled={change.isPending}
							className={buttonClass("danger")}
							onClick={() => change.mutate(false)}
						>
							{t("modules.turn_off")}
						</button>
					</div>
				</div>
			</Modal>
		</section>
	);
}

export function SettingsModulesPage({ org }: { org: Membership }) {
	const { t, language } = useI18n();
	const modules = useQuery({
		queryKey: MODULES_KEY,
		queryFn: () => api<ModulesData>("/organizations/current/modules"),
	});
	const plan = useQuery({
		queryKey: ["organization-plan"],
		queryFn: () => api<{ pendingRequest: { planName: string | null } | null }>("/organizations/current/plan"),
	});
	const requested = plan.data?.pendingRequest?.planName ?? null;
	const data = modules.data;
	// Only a trial can lose a module this way, and only if the plan it asked for leaves it out.
	const atRisk =
		data?.status === "trial" && requested
			? data.modules.filter((module) => module.enabled && module.source === "trial" && !module.plans.includes(requested))
			: [];
	return (
		<SettingsLayout
			canManage
			isAdmin={org.role === "admin"}
			title={t("modules.title")}
			subtitle={t("modules.desc", { org: org.name })}
		>
			{modules.isPending && <PageLoading variant="inline" />}
			{modules.isError && <PageError onRetry={() => modules.refetch()} />}
			{data && (
				<>
					{atRisk.length > 0 && (
						<div role="alert" className="flex flex-wrap items-start gap-2.5 rounded-[9px] border border-l-4 border-[#F59F0A] bg-card px-3.5 py-3 text-[13px]">
							<CircleAlert size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
							<span className="min-w-0 flex-[1_1_260px]">
								<b>{t("modules.trial_title")}</b>{" "}
								{t("modules.trial_warning", {
									plan: requested ?? "",
									modules: atRisk.map((module) => t(`modules.${module.key}`)).join(", "),
									date: data.trialEndDate
										? new Date(data.trialEndDate).toLocaleDateString(language, { day: "numeric", month: "short" })
										: "",
								})}
							</span>
							<Link href="/settings/plan" className={buttonClass("outline", BUTTON_SMALL)}>
								{t("modules.change_request")}
							</Link>
						</div>
					)}
					<section className="rounded-card border border-border bg-card px-[18px] py-3.5">
						<div className="flex flex-wrap items-center justify-between gap-2">
							<h3 className="text-[15px] font-semibold">{t("modules.always_on")}</h3>
							<span className="text-xs text-muted-foreground">{t("modules.every_plan")}</span>
						</div>
						<ul className="mt-2.5 flex flex-wrap gap-2">
							{ALWAYS_ON.map((key) => (
								<li key={key} className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-[13px]">
									<Check size={14} strokeWidth={3} aria-hidden="true" className="text-[#22A076]" />
									{t(key)}
								</li>
							))}
						</ul>
					</section>
					{data.modules.map((module) => (
						<ModuleCard key={module.key} module={module} />
					))}
					<p className="text-xs text-muted-foreground">{t("modules.set_by_aidnova")}</p>
				</>
			)}
		</SettingsLayout>
	);
}
