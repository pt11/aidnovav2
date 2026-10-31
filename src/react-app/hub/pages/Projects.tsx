import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, FolderKanban, Plus, SearchX, X } from "lucide-react";
import { Link, useLocation, useSearch } from "wouter";
import { api, ApiError } from "../api";
import { useI18n } from "../i18n";
import {
	Alert,
	buttonClass,
	DataTable,
	Field,
	FilterSelect,
	Modal,
	PageError,
	PageHeader,
	PageLoading,
	SearchField,
	Segmented,
	SelectField,
	StatePanel,
	TextareaField,
} from "../ui";

export type ProjectStatus = "draft" | "planned" | "in_progress" | "on_hold" | "completed" | "cancelled" | "archived";
export type ProjectHealth = "unknown" | "healthy" | "needs_attention" | "at_risk";

interface ProjectSummary {
	id: number;
	name: string;
	code: string;
	category: string | null;
	funder: string | null;
	status: ProjectStatus;
	health: ProjectHealth;
	endDate: string | null;
	ownerName: string | null;
	managerName: string | null;
	milestonesTotal: number;
	milestonesDone: number;
	mine: boolean;
	reportsOverdue: number;
	reportsRequired: boolean;
}

export const PROJECTS_KEY = ["projects"];
export const PROJECT_STATUSES: ProjectStatus[] = ["draft", "planned", "in_progress", "on_hold", "completed", "cancelled", "archived"];
export const PROJECT_HEALTHS: ProjectHealth[] = ["healthy", "needs_attention", "at_risk", "unknown"];
export const PROJECT_CATEGORIES = ["health", "wash", "education", "livelihoods", "emergency", "other"];
const SDGS = Array.from({ length: 17 }, (_, index) => index + 1);

const STATUS_LOOK: Record<ProjectStatus, string> = {
	draft: "border border-input bg-card text-foreground",
	planned: "bg-selected text-selected-foreground",
	in_progress: "bg-primary text-primary-foreground",
	on_hold: "bg-muted text-foreground",
	completed: "bg-[#14795A] text-white",
	cancelled: "bg-muted text-muted-foreground",
	archived: "bg-muted text-muted-foreground",
};

export function ProjectStatusChip({ status }: { status: ProjectStatus }) {
	const { t } = useI18n();
	return (
		<span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-px text-xs font-semibold ${STATUS_LOOK[status]}`}>
			{t(`pr.status_${status}`)}
		</span>
	);
}

const HEALTH_DOT: Record<ProjectHealth, string> = {
	unknown: "bg-muted-foreground",
	healthy: "bg-[#22A076]",
	needs_attention: "bg-[#F59F0A]",
	at_risk: "bg-destructive",
};

export function ProjectHealthChip({ health }: { health: ProjectHealth }) {
	const { t } = useI18n();
	return (
		<span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold">
			<span aria-hidden="true" className={`size-2 rounded-full ${HEALTH_DOT[health]}`} />
			{t(`pr.health_${health}`)}
		</span>
	);
}

export function shortDay(value: string, language: string) {
	return new Date(`${value}T00:00:00Z`).toLocaleDateString(language, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export function ProgressTrack({ percent, label }: { percent: number; label: string }) {
	return (
		<div
			role="progressbar"
			aria-valuenow={percent}
			aria-valuemin={0}
			aria-valuemax={100}
			aria-label={label}
			className="h-1.5 overflow-hidden rounded-full bg-input"
		>
			<div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
		</div>
	);
}

function percentOf(project: ProjectSummary) {
	return project.milestonesTotal ? Math.round((project.milestonesDone / project.milestonesTotal) * 100) : 0;
}

function ProjectCard({ project }: { project: ProjectSummary }) {
	const { t, language } = useI18n();
	const percent = percentOf(project);
	const people = [
		project.ownerName && t("pr.owner_name", { name: project.ownerName }),
		project.managerName && t("pr.manager_name", { name: project.managerName }),
	]
		.filter(Boolean)
		.join(" · ");
	return (
		<Link
			href={`/projects/${project.id}`}
			className="flex flex-col gap-3 rounded-card border border-border bg-card p-4 text-foreground no-underline hover:border-input"
		>
			<div className="flex items-start justify-between gap-2">
				<div className="min-w-0">
					<p className="break-words text-[15px] font-semibold">{project.name}</p>
					<p className="break-words text-xs text-muted-foreground">
						{project.code} · {project.funder ?? "—"}
					</p>
				</div>
				<ProjectStatusChip status={project.status} />
			</div>
			<div className="flex flex-wrap items-center justify-between gap-2 text-xs">
				<ProjectHealthChip health={project.health} />
				{project.reportsRequired && (
					<span className={project.reportsOverdue > 0 ? "font-semibold text-danger-foreground" : "text-muted-foreground"}>
						{project.reportsOverdue > 0 ? t("pr.reports_overdue", { count: project.reportsOverdue }) : t("pr.reports_on_track")}
					</span>
				)}
			</div>
			<div>
				<p className="mb-1 flex justify-between text-xs text-muted-foreground">
					<span>{t("pr.milestones_complete")}</span>
					<span className="font-semibold text-foreground">{project.milestonesTotal ? `${percent}%` : "—"}</span>
				</p>
				<ProgressTrack percent={percent} label={t("pr.milestones_complete")} />
			</div>
			<p className="mt-auto flex flex-wrap justify-between gap-x-3 gap-y-0.5 border-t border-border pt-2.5 text-xs text-muted-foreground">
				<span>{people}</span>
				{project.endDate && <span>{t("pr.ends", { date: shortDay(project.endDate, language) })}</span>}
			</p>
		</Link>
	);
}

interface Person {
	userId: string;
	name: string;
}

const emptyForm = {
	name: "",
	code: "",
	category: "",
	description: "",
	priority: "medium",
	status: "planned",
	objectives: "",
	expectedOutcomes: "",
	startDate: "",
	endDate: "",
	ownerId: "",
	managerId: "",
	visibility: "members",
	funder: "",
	budgetCurrency: "USD",
	budgetAmount: "",
	beneficiaryTarget: "",
	locations: "",
	sdg: "",
	reportingFrequency: "",
	folderTemplate: "standard",
};

const STEPS = ["basics", "goals", "people", "ngo", "review"] as const;
const SAVE_ERRORS: Record<string, string> = {
	CODE_TAKEN: "pr.code_taken",
	INVALID_CODE: "pr.code_invalid",
	INVALID_NAME: "pr.name_required",
	END_BEFORE_START: "pr.end_before_start",
	INVALID_NUMBER: "pr.invalid_number",
	TOO_LONG: "pr.too_long",
	INVALID_PERSON: "pr.invalid_person",
};

export function projectBody(form: Omit<typeof emptyForm, "folderTemplate"> & { folderTemplate?: string }) {
	return {
		...form,
		sdg: form.sdg ? Number(form.sdg) : null,
		budgetAmount: form.budgetAmount === "" ? null : Number(form.budgetAmount.replace(/,/g, "")),
		beneficiaryTarget: form.beneficiaryTarget === "" ? null : Number(form.beneficiaryTarget.replace(/,/g, "")),
	};
}

function NewProjectDialog({ me, onClose }: { me: string; onClose: () => void }) {
	const { t } = useI18n();
	const [, navigate] = useLocation();
	const queryClient = useQueryClient();
	const [form, setForm] = useState({ ...emptyForm, ownerId: me, managerId: me });
	const [step, setStep] = useState(0);
	const [members, setMembers] = useState<{ userId: string; role: string }[]>([]);
	const [touched, setTouched] = useState(false);
	const [debounced, setDebounced] = useState("");
	const set = <K extends keyof typeof emptyForm>(key: K, value: (typeof emptyForm)[K]) =>
		setForm((current) => ({ ...current, [key]: value }));
	const people = useQuery({
		queryKey: ["project-people"],
		queryFn: () => api<{ people: Person[] }>("/projects/people"),
		select: (data) => data.people,
	});
	useEffect(() => {
		const timer = setTimeout(() => setDebounced(form.code.trim().toUpperCase()), 300);
		return () => clearTimeout(timer);
	}, [form.code]);
	const check = useQuery({
		queryKey: ["project-code", debounced],
		queryFn: () => api<{ valid: boolean; available: boolean; suggestion: string | null }>(`/projects/code-check?code=${encodeURIComponent(debounced)}`),
		enabled: debounced.length > 0,
	});
	const create = useMutation({
		mutationFn: (status: string) =>
			api<{ id: number }>("/projects", { method: "POST", body: { ...projectBody(form), status, members } }),
		onSuccess: async ({ id }) => {
			await queryClient.invalidateQueries({ queryKey: PROJECTS_KEY });
			navigate(`/projects/${id}`);
		},
	});
	const code = create.error instanceof ApiError ? create.error.code : "";
	const nameMissing = !form.name.trim();
	const codeBad = !form.code.trim() || check.data?.valid === false || check.data?.available === false;
	const datesBad = !!form.startDate && !!form.endDate && form.endDate < form.startDate;
	const stepProblem = (index: number) => (index === 0 ? nameMissing || codeBad : index === 1 ? datesBad : index === 2 ? !form.ownerId || !form.managerId : false);
	const firstProblem = STEPS.findIndex((_, index) => stepProblem(index));
	const name = (id: string) => people.data?.find((person) => person.userId === id)?.name ?? "—";
	const goNext = () => {
		setTouched(true);
		if (!stepProblem(step)) {
			setTouched(false);
			setStep(step + 1);
		}
	};
	const finish = (status: string) => {
		if (firstProblem >= 0) {
			setTouched(true);
			setStep(firstProblem);
			return;
		}
		create.mutate(status);
	};
	const picker = (label: string, key: "ownerId" | "managerId") => (
		<SelectField label={label} value={form[key]} onChange={(event) => set(key, event.target.value)}>
			{people.data?.map((person) => (
				<option key={person.userId} value={person.userId}>{person.name}</option>
			))}
		</SelectField>
	);
	const reviewRow = (label: string, value: string) => (
		<div className="contents" key={label}>
			<dt className="text-muted-foreground">{label}</dt>
			<dd className="min-w-0 whitespace-pre-wrap break-words">{value || "—"}</dd>
		</div>
	);

	return (
		<Modal title={t("pr.new")} description={t("pr.new_desc")} open wide onClose={onClose}>
			<div className="grid gap-4 md:grid-cols-[180px_minmax(0,1fr)]">
				<ol aria-label={t("pr.steps")} className="flex flex-wrap gap-1 md:flex-col">
					{STEPS.map((value, index) => (
						<li key={value}>
							<button
								type="button"
								aria-current={index === step ? "step" : undefined}
								disabled={index > step && firstProblem >= 0 && firstProblem < index}
								className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] ${index === step ? "bg-selected font-semibold" : "text-muted-foreground hover:bg-muted"} disabled:opacity-60`}
								onClick={() => setStep(index)}
							>
								<span
									aria-hidden="true"
									className={`grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold ${index === step ? "bg-primary text-primary-foreground" : "border border-input bg-card"}`}
								>
									{index + 1}
								</span>
								<span className="max-md:sr-only">{t(`pr.step_${value}`)}</span>
							</button>
						</li>
					))}
				</ol>
				<div className="flex min-w-0 flex-col gap-3.5">
					{create.isError && <Alert>{t(SAVE_ERRORS[code] ?? "error.generic")}</Alert>}
					{step === 0 && (
						<>
							<Field label={`${t("pr.field_name")} *`} maxLength={200} value={form.name} error={touched && nameMissing ? t("pr.name_required") : undefined} onChange={(event) => set("name", event.target.value)} />
							<div className="grid gap-3.5 sm:grid-cols-2">
								<div className="flex flex-col gap-1">
									<Field
										label={`${t("pr.field_code")} *`}
										maxLength={30}
										value={form.code}
										error={
											check.data?.valid === false
												? t("pr.code_invalid")
												: check.data?.available === false
													? t("pr.code_used", { code: check.data.suggestion ?? "" })
													: touched && !form.code.trim()
														? t("pr.code_required")
														: undefined
										}
										onChange={(event) => set("code", event.target.value.toUpperCase())}
									/>
									{check.data?.available && (
										<p className="flex items-center gap-1 text-xs text-muted-foreground">
											<Check size={13} aria-hidden="true" className="text-[#14795A]" />
											{t("pr.code_free")}
										</p>
									)}
								</div>
								<SelectField label={t("pr.field_category")} value={form.category} onChange={(event) => set("category", event.target.value)}>
									<option value="">{t("cb.choose")}</option>
									{PROJECT_CATEGORIES.map((value) => <option key={value} value={value}>{t(`pr.cat_${value}`)}</option>)}
								</SelectField>
							</div>
							<TextareaField label={t("pr.field_description")} rows={3} maxLength={4000} value={form.description} onChange={(event) => set("description", event.target.value)} />
							<fieldset>
								<legend className="mb-1.5 text-sm font-medium">{t("pr.field_priority")}</legend>
								<div className="flex flex-wrap gap-2">
									{(["low", "medium", "high"] as const).map((value) => (
										<label key={value} className={`flex h-9 items-center gap-1.5 rounded-md border px-3 text-[13px] ${form.priority === value ? "border-primary bg-selected font-semibold" : "border-input"}`}>
											<input type="radio" name="priority" className="accent-primary" checked={form.priority === value} onChange={() => set("priority", value)} />
											{t(`pr.priority_${value}`)}
										</label>
									))}
								</div>
							</fieldset>
							<div className="flex flex-col gap-1">
								<SelectField label={t("pr.field_status")} value={form.status} onChange={(event) => set("status", event.target.value)}>
									{(["draft", "planned", "in_progress"] as const).map((value) => <option key={value} value={value}>{t(`pr.status_${value}`)}</option>)}
								</SelectField>
								<p className="text-xs text-muted-foreground">{t("pr.status_hint")}</p>
							</div>
							<div className="flex flex-col gap-1">
								<SelectField label={t("pr.field_folders")} value={form.folderTemplate} onChange={(event) => set("folderTemplate", event.target.value)}>
									<option value="standard">{t("pr.folders_standard")}</option>
									<option value="empty">{t("pr.folders_empty")}</option>
								</SelectField>
								{form.folderTemplate === "standard" && <p className="text-xs text-muted-foreground">{t("pr.folders_hint")}</p>}
							</div>
						</>
					)}
					{step === 1 && (
						<>
							<TextareaField label={t("pr.field_objectives")} hint={t("pr.one_per_line")} rows={4} maxLength={4000} value={form.objectives} onChange={(event) => set("objectives", event.target.value)} />
							<TextareaField label={t("pr.field_outcomes")} hint={t("pr.one_per_line")} rows={3} maxLength={4000} value={form.expectedOutcomes} onChange={(event) => set("expectedOutcomes", event.target.value)} />
							<div className="grid gap-3.5 sm:grid-cols-2">
								<Field label={t("pr.field_start")} type="date" value={form.startDate} onChange={(event) => set("startDate", event.target.value)} />
								<Field label={t("pr.field_end")} type="date" value={form.endDate} error={datesBad ? t("pr.end_before_start") : undefined} onChange={(event) => set("endDate", event.target.value)} />
							</div>
						</>
					)}
					{step === 2 && (
						<>
							<div className="grid gap-3.5 sm:grid-cols-2">
								{picker(`${t("pr.owner")} *`, "ownerId")}
								{picker(`${t("pr.manager")} *`, "managerId")}
							</div>
							<fieldset>
								<legend className="mb-1.5 text-sm font-medium">{t("pr.field_visibility")}</legend>
								<div className="flex flex-col gap-1.5 text-sm">
									{(["members", "organization"] as const).map((value) => (
										<label key={value} className="flex items-center gap-2">
											<input type="radio" name="visibility" className="size-4 accent-primary" checked={form.visibility === value} onChange={() => set("visibility", value)} />
											{t(`pr.visibility_${value}`)}
										</label>
									))}
								</div>
							</fieldset>
							<SelectField
								label={t("pr.add_member")}
								value=""
								onChange={(event) => {
									const userId = event.target.value;
									if (userId) setMembers((current) => [...current, { userId, role: "member" }]);
								}}
							>
								<option value="">{t("cb.choose")}</option>
								{people.data
									?.filter((person) => person.userId !== form.ownerId && person.userId !== form.managerId && !members.some((member) => member.userId === person.userId))
									.map((person) => <option key={person.userId} value={person.userId}>{person.name}</option>)}
							</SelectField>
							{members.length > 0 && (
								<ul className="flex flex-col gap-1.5">
									{members.map((member) => (
										<li key={member.userId} className="flex items-center gap-2 rounded-md border border-border p-2 text-sm">
											<span className="min-w-0 flex-1 truncate">{name(member.userId)}</span>
											<select
												aria-label={t("pr.member_role", { name: name(member.userId) })}
												value={member.role}
												className="h-8 rounded-md border border-input bg-card px-1.5 text-[13px]"
												onChange={(event) => setMembers((current) => current.map((item) => (item.userId === member.userId ? { ...item, role: event.target.value } : item)))}
											>
												{(["member", "viewer"] as const).map((value) => <option key={value} value={value}>{t(`pr.role_${value}`)}</option>)}
											</select>
											<button
												type="button"
												aria-label={t("cb.remove_file", { name: name(member.userId) })}
												className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted"
												onClick={() => setMembers((current) => current.filter((item) => item.userId !== member.userId))}
											>
												<X size={15} aria-hidden="true" />
											</button>
										</li>
									))}
								</ul>
							)}
						</>
					)}
					{step === 3 && (
						<div className="grid gap-3.5 sm:grid-cols-2">
							<Field label={t("pr.field_funder")} maxLength={200} value={form.funder} onChange={(event) => set("funder", event.target.value)} />
							<div className="flex gap-2">
								<div className="w-24 shrink-0">
									<SelectField label={t("pr.field_currency")} value={form.budgetCurrency} onChange={(event) => set("budgetCurrency", event.target.value)}>
										{["USD", "MMK", "EUR"].map((value) => <option key={value} value={value}>{value}</option>)}
									</SelectField>
								</div>
								<div className="min-w-0 flex-1">
									<Field label={t("pr.field_budget")} inputMode="decimal" value={form.budgetAmount} onChange={(event) => set("budgetAmount", event.target.value)} />
								</div>
							</div>
							<Field label={t("pr.field_target")} hint={t("pr.target_hint")} inputMode="numeric" value={form.beneficiaryTarget} onChange={(event) => set("beneficiaryTarget", event.target.value)} />
							<Field label={t("pr.field_locations")} hint={t("pr.locations_hint")} maxLength={300} value={form.locations} onChange={(event) => set("locations", event.target.value)} />
							<SelectField label={t("pr.field_sdg")} value={form.sdg} onChange={(event) => set("sdg", event.target.value)}>
								<option value="">{t("cb.choose")}</option>
								{SDGS.map((value) => <option key={value} value={value}>SDG {value}</option>)}
							</SelectField>
							<SelectField label={t("pr.field_frequency")} value={form.reportingFrequency} onChange={(event) => set("reportingFrequency", event.target.value)}>
								<option value="">{t("cb.choose")}</option>
								{(["monthly", "quarterly", "custom"] as const).map((value) => <option key={value} value={value}>{t(`pr.frequency_${value}`)}</option>)}
							</SelectField>
						</div>
					)}
					{step === 4 && (
						<dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[150px_minmax(0,1fr)]">
							{reviewRow(t("pr.field_name"), form.name)}
							{reviewRow(t("pr.field_code"), form.code)}
							{reviewRow(t("pr.field_category"), form.category ? t(`pr.cat_${form.category}`) : "")}
							{reviewRow(t("pr.field_priority"), t(`pr.priority_${form.priority}`))}
							{reviewRow(t("pr.field_start"), form.startDate)}
							{reviewRow(t("pr.field_end"), form.endDate)}
							{reviewRow(t("pr.owner"), name(form.ownerId))}
							{reviewRow(t("pr.manager"), name(form.managerId))}
							{reviewRow(t("pr.team"), members.map((member) => name(member.userId)).join(", "))}
							{reviewRow(t("pr.field_visibility"), t(`pr.visibility_${form.visibility}`))}
							{reviewRow(t("pr.field_funder"), form.funder)}
							{reviewRow(t("pr.field_budget"), form.budgetAmount && `${form.budgetCurrency} ${form.budgetAmount}`)}
							{reviewRow(t("pr.field_target"), form.beneficiaryTarget)}
						</dl>
					)}
				</div>
			</div>
			<div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-border pt-3.5">
				<span className="mr-auto text-[13px] text-muted-foreground">{t("pr.step_of", { step: step + 1, total: STEPS.length })}</span>
				<button type="button" className={buttonClass("ghost")} onClick={onClose}>{t("common.cancel")}</button>
				<button type="button" disabled={create.isPending} className={buttonClass("outline")} onClick={() => finish("draft")}>{t("pr.create_draft")}</button>
				{step < STEPS.length - 1 ? (
					<button type="button" className={buttonClass()} onClick={goNext}>{t("pr.next", { step: t(`pr.step_${STEPS[step + 1]}`) })}</button>
				) : (
					<button type="button" disabled={create.isPending} className={buttonClass()} onClick={() => finish(form.status)}>{t("pr.create")}</button>
				)}
			</div>
		</Modal>
	);
}

export function ProjectsPage({ me }: { me: string }) {
	const { t } = useI18n();
	const search = useSearch();
	const [, navigate] = useLocation();
	const mine = new URLSearchParams(search).get("view") === "mine";
	const [query, setQuery] = useState("");
	const [status, setStatus] = useState("active");
	const [health, setHealth] = useState("all");
	const [category, setCategory] = useState("all");
	const [view, setView] = useState<"cards" | "table">("cards");
	const [creating, setCreating] = useState(false);
	const list = useQuery({
		queryKey: PROJECTS_KEY,
		queryFn: () => api<{ projects: ProjectSummary[]; canCreate: boolean }>("/projects"),
	});
	if (list.isPending) return <PageLoading />;
	if (list.isError) return <PageError onRetry={() => list.refetch()} />;
	const all = list.data.projects;
	const text = query.trim().toLowerCase();
	const visible = all.filter(
		(project) =>
			(!mine || project.mine) &&
			(status === "active" ? project.status !== "archived" : project.status === status) &&
			(health === "all" || project.health === health) &&
			(category === "all" || project.category === category) &&
			(!text || [project.name, project.code, project.funder ?? ""].some((value) => value.toLowerCase().includes(text))),
	);
	return (
		<div className="flex flex-col gap-4 p-4 md:px-6 md:py-7">
			<PageHeader
				title={t("nav.projects")}
				subtitle={t("pr.desc")}
				action={
					<div className="flex flex-wrap gap-2">
						<Link href="/projects/portfolio" className={buttonClass("outline")}>{t("pr.portfolio_title")}</Link>
						{list.data.canCreate && (
							<button type="button" className={buttonClass()} onClick={() => setCreating(true)}>
								<Plus size={16} aria-hidden="true" />
								{t("pr.new")}
							</button>
						)}
					</div>
				}
			/>
			<Segmented
				label={t("nav.projects")}
				look="underline"
				options={[
					{ value: "all", label: `${t("pr.all")} ${all.length}` },
					{ value: "mine", label: `${t("pr.mine")} ${all.filter((project) => project.mine).length}` },
				]}
				value={mine ? "mine" : "all"}
				onChange={(value) => navigate(value === "mine" ? "/projects?view=mine" : "/projects")}
			/>
			{all.length === 0 ? (
				<StatePanel
					icon={FolderKanban}
					title={t(list.data.canCreate ? "pr.empty_title" : "pr.empty_staff_title")}
					description={t(list.data.canCreate ? "pr.empty_desc" : "pr.empty_staff_desc")}
					action={
						list.data.canCreate ? (
							<button type="button" className={buttonClass()} onClick={() => setCreating(true)}>{t("pr.new")}</button>
						) : undefined
					}
				/>
			) : (
				<>
					<div className="flex flex-wrap items-center gap-2">
						<SearchField label={t("pr.search")} value={query} onChange={setQuery} className="min-w-52 flex-1" />
						<FilterSelect label={t("users.status")} value={status} onChange={setStatus}>
							<option value="active">{t("pr.status_active")}</option>
							{PROJECT_STATUSES.map((value) => <option key={value} value={value}>{t(`pr.status_${value}`)}</option>)}
						</FilterSelect>
						<FilterSelect label={t("pr.health")} value={health} onChange={setHealth}>
							<option value="all">{t("cb.filter_all")}</option>
							{PROJECT_HEALTHS.map((value) => <option key={value} value={value}>{t(`pr.health_${value}`)}</option>)}
						</FilterSelect>
						<FilterSelect label={t("pr.field_category")} value={category} onChange={setCategory}>
							<option value="all">{t("cb.filter_all")}</option>
							{PROJECT_CATEGORIES.map((value) => <option key={value} value={value}>{t(`pr.cat_${value}`)}</option>)}
						</FilterSelect>
						<Segmented
							label={t("course.view")}
							options={[
								{ value: "cards", label: t("course.view_cards") },
								{ value: "table", label: t("pr.view_table") },
							]}
							value={view}
							onChange={setView}
						/>
					</div>
					{visible.length === 0 ? (
						<StatePanel icon={SearchX} title={t("pr.no_results")} />
					) : view === "cards" ? (
						<div className="grid grid-cols-[repeat(auto-fill,minmax(min(320px,100%),1fr))] gap-3">
							{visible.map((project) => <ProjectCard key={project.id} project={project} />)}
						</div>
					) : (
						<DataTable minWidth={760} head={[t("nav.projects"), t("users.status"), t("pr.health"), t("pr.milestones_complete"), t("pr.owner")]}>
							{visible.map((project) => (
								<tr key={project.id}>
									<td className="px-3 py-3 first:pl-4">
										<Link href={`/projects/${project.id}`} className="block break-words font-semibold text-foreground no-underline hover:underline">{project.name}</Link>
										<span className="text-xs text-muted-foreground">{project.code}</span>
									</td>
									<td className="px-3 py-3"><ProjectStatusChip status={project.status} /></td>
									<td className="px-3 py-3"><ProjectHealthChip health={project.health} /></td>
									<td className="w-44 px-3 py-3">
										<span className="mb-1 block text-xs">{project.milestonesTotal ? `${percentOf(project)}%` : "—"}</span>
										<ProgressTrack percent={percentOf(project)} label={t("pr.milestones_complete")} />
									</td>
									<td className="px-3 py-3 last:pr-4">{project.ownerName ?? "—"}</td>
								</tr>
							))}
						</DataTable>
					)}
				</>
			)}
			<section className="rounded-card border border-border bg-card p-4 text-[13px]">
				<h2 className="mb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{t("pr.who_sees")}</h2>
				<p>{t("pr.who_sees_desc")}</p>
			</section>
			{creating && <NewProjectDialog me={me} onClose={() => setCreating(false)} />}
		</div>
	);
}
