import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Award, Check, ClipboardCheck, Lock, Plus, Sparkles } from "lucide-react";
import { Link } from "wouter";
import { api, ApiError } from "../api";
import { useI18n } from "../i18n";
import {
	Alert,
	Avatar,
	buttonClass,
	ConfirmModal,
	DataTable,
	Field,
	Modal,
	PageError,
	PageHeader,
	PageLoading,
	SelectField,
	StatePanel,
	TextareaField,
	Toggle,
	useToast,
} from "../ui";
import { downloadCsv } from "../csv";
import { ReviewChip, TrainingChip, useCapacityMe, useRefreshCapacity, type ReviewStatus, type TrainingStatus } from "./Capacity";

const LEVELS = [1, 2, 3, 4, 5];

interface MySkill {
	id: number;
	skillId: number;
	name: string;
	category: string | null;
	rubric: string[];
	level: number | null;
	pendingLevel: number | null;
	evidence: string | null;
	feedback: string | null;
	nominatedAt: string | null;
	assessedAt: string | null;
	assessorName: string | null;
	revalidateBy: string | null;
	shared: boolean;
	canRename: boolean;
}

interface Badge {
	key: string;
	kind: "training" | "attendance" | "course" | "competency";
	title: string;
	level?: number;
	date: string | null;
	verified: boolean;
	sensitive: boolean;
	shareable: boolean;
	shared: boolean;
}

export interface CatalogSkill {
	id: number;
	name: string;
	category: string | null;
	description: string | null;
	revalidateMonths: number | null;
	rubric: string[];
	rubricVersion: number;
	retired: boolean;
	addedBy: string | null;
}

function LevelBars({ level, name }: { level: number; name: string }) {
	const { t } = useI18n();
	return (
		<span className="block">
			<span className="text-[13px] font-semibold">{t(`cb.level_${level}`)}</span>{" "}
			<span className="text-xs text-muted-foreground">L{level}</span>
			<span role="img" aria-label={`${name}: ${t(`cb.level_${level}`)}`} className="mt-1 flex gap-0.5">
				{LEVELS.map((value) => <span key={value} className={`h-1 w-6 rounded-full ${value <= level ? "bg-primary" : "bg-input"}`} />)}
			</span>
		</span>
	);
}

const SKILL_CATEGORIES = ["leadership", "project_management", "meal", "finance", "digital", "safeguarding", "safety", "community", "health", "communication", "other"];

// Adds a skill, or edits one already on the person's list.
function NominateDialog({ existing, mine, onClose }: { existing?: MySkill; mine: number[]; onClose: () => void }) {
	const { t } = useI18n();
	const toast = useToast();
	const queryClient = useQueryClient();
	const [skillId, setSkillId] = useState("");
	const [wantsNew, setWantsNew] = useState(false);
	const [name, setName] = useState(existing?.name ?? "");
	const [category, setCategory] = useState("other");
	const [level, setLevel] = useState(String(existing?.pendingLevel ?? existing?.level ?? 2));
	const [evidence, setEvidence] = useState(existing?.evidence ?? "");
	const catalog = useQuery({
		queryKey: ["capacity-skills"],
		queryFn: () => api<{ skills: CatalogSkill[] }>("/capacity/skills"),
		select: (data) => data.skills.filter((skill) => !skill.retired && !mine.includes(skill.id)),
	});
	const adding = !existing && (wantsNew || (catalog.isSuccess && catalog.data.length === 0));
	const save = useMutation({
		mutationFn: () =>
			existing
				? api(`/capacity/my-skills/${existing.id}`, { method: "PATCH", body: { name: existing.canRename ? name : undefined, level: Number(level), evidence } })
				: api("/capacity/my-skills", { method: "POST", body: adding ? { newSkillName: name, newSkillCategory: category, level: Number(level), evidence } : { skillId: Number(skillId), level: Number(level), evidence } }),
		onSuccess: async () => {
			await Promise.all([queryClient.invalidateQueries({ queryKey: ["capacity-my-skills"] }), queryClient.invalidateQueries({ queryKey: ["capacity-skills"] })]);
			toast.success(t("cb.toast_sent"), t("cb.toast_sent_desc"));
			onClose();
		},
	});
	const chosen = catalog.data?.find((skill) => skill.id === Number(skillId));
	const criteria = (existing?.rubric ?? chosen?.rubric)?.[Number(level) - 1];
	const code = save.error instanceof ApiError ? save.error.code : "";
	const ready = (existing ? !existing.canRename || name.trim() : adding ? name.trim() : skillId) && evidence.trim();
	return (
		<Modal title={t(existing ? "cb.edit_my_skill" : "cb.nominate")} description={t(existing?.level ? "cb.edit_verified_desc" : "cb.nominate_desc")} open onClose={onClose}>
			<div className="flex flex-col gap-3.5">
				{save.isError && <Alert>{t(code === "SKILL_EXISTS" ? "cb.skill_exists" : code === "TOO_MANY_SKILLS" ? "cb.too_many_skills" : "error.generic")}</Alert>}
				{existing ? (
					existing.canRename ? (
						<Field label={t("cb.skill_name")} maxLength={120} value={name} onChange={(event) => setName(event.target.value)} />
					) : (
						<p className="text-sm"><b>{existing.name}</b></p>
					)
				) : adding ? (
					<div className="flex flex-col gap-3 rounded-[9px] bg-muted p-3">
						<Field label={t("cb.skill_name")} autoFocus maxLength={120} value={name} onChange={(event) => setName(event.target.value)} />
						<SelectField label={t("cb.field_category")} value={category} onChange={(event) => setCategory(event.target.value)}>
							{SKILL_CATEGORIES.map((value) => <option key={value} value={value}>{t(`cb.cat_${value}`)}</option>)}
						</SelectField>
						{catalog.data && catalog.data.length > 0 && (
							<button type="button" className="self-start text-[13px] font-medium text-selected-foreground" onClick={() => setWantsNew(false)}>{t("cb.choose_from_list")}</button>
						)}
					</div>
				) : (
					<div className="flex flex-col gap-1.5">
						<SelectField label={t("cb.skill")} value={skillId} onChange={(event) => setSkillId(event.target.value)}>
							<option value="">{t("cb.choose")}</option>
							{catalog.data?.map((skill) => <option key={skill.id} value={skill.id}>{skill.name}</option>)}
						</SelectField>
						<button type="button" className="inline-flex items-center gap-1 self-start text-[13px] font-medium text-selected-foreground" onClick={() => setWantsNew(true)}>
							<Plus size={14} aria-hidden="true" />
							{t("cb.add_new_skill")}
						</button>
					</div>
				)}
				<div className="flex flex-col gap-1">
					<SelectField label={t("cb.level_claim")} value={level} onChange={(event) => setLevel(event.target.value)}>
						{LEVELS.map((value) => <option key={value} value={value}>{`${t(`cb.level_${value}`)} · ${t(`cb.level_${value}_hint`)}`}</option>)}
					</SelectField>
					{criteria && <p className="text-xs text-muted-foreground">{criteria}</p>}
				</div>
				<TextareaField label={t("cb.evidence_note")} hint={t("cb.evidence_note_hint")} rows={3} maxLength={2000} value={evidence} onChange={(event) => setEvidence(event.target.value)} />
				<div className="flex justify-end gap-2">
					<button type="button" className={buttonClass("outline")} onClick={onClose}>{t("common.cancel")}</button>
					<button type="button" disabled={!ready || save.isPending} className={buttonClass()} onClick={() => save.mutate()}>{t("cb.send_for_assessment")}</button>
				</div>
			</div>
		</Modal>
	);
}

interface Assessment {
	id: number;
	ownerName: string;
	skillName: string;
	rubric: string[];
	rubricVersion: number;
	pendingLevel: number;
	currentLevel: number | null;
	evidence: string | null;
}

function AssessDialog({ item, onClose }: { item: Assessment; onClose: () => void }) {
	const { t } = useI18n();
	const refreshCapacity = useRefreshCapacity();
	const toast = useToast();
	const queryClient = useQueryClient();
	const [level, setLevel] = useState(item.pendingLevel);
	const [feedback, setFeedback] = useState("");
	const [note, setNote] = useState("");
	const decide = useMutation({
		mutationFn: (decline: boolean) => api(`/capacity/assessments/${item.id}`, { method: "POST", body: { level, feedback, privateNote: note, decline } }),
		onSuccess: async () => {
			await Promise.all([queryClient.invalidateQueries({ queryKey: ["capacity-assessments"] }), refreshCapacity()]);
			toast.success(t("cb.toast_assessed", { name: item.ownerName }));
			onClose();
		},
	});
	return (
		<Modal title={t("cb.assess_title", { name: item.ownerName, skill: item.skillName })} description={t("cb.rubric_version", { version: item.rubricVersion })} open onClose={onClose}>
			<div className="flex flex-col gap-3.5">
				{decide.isError && <Alert>{t("error.generic")}</Alert>}
				<div className="rounded-md bg-muted p-3 text-[13px]">
					<b>{t("cb.evidence_note")}:</b> <span className="whitespace-pre-wrap break-words">{item.evidence}</span>
				</div>
				<fieldset>
					<legend className="mb-1.5 text-sm font-medium">{t("cb.level")}</legend>
					<div className="flex flex-col gap-1.5 text-[13px]">
						{LEVELS.map((value) => (
							<label key={value} className="flex items-start gap-2">
								<input type="radio" name="assess-level" className="mt-1 size-4 accent-primary" checked={level === value} onChange={() => setLevel(value)} />
								<span>
									<b>{t(`cb.level_${value}`)}</b> · {item.rubric[value - 1] || t(`cb.level_${value}_hint`)}
								</span>
							</label>
						))}
					</div>
				</fieldset>
				<TextareaField label={t("cb.feedback_for", { name: item.ownerName })} rows={2} maxLength={2000} value={feedback} onChange={(event) => setFeedback(event.target.value)} />
				<Field label={t("cb.private_assessor_notes")} hint={t("cb.private_assessor_hint")} maxLength={2000} value={note} onChange={(event) => setNote(event.target.value)} />
				<div className="flex flex-wrap justify-end gap-2">
					<button type="button" disabled={!feedback.trim() || decide.isPending} className={buttonClass("outline")} onClick={() => decide.mutate(true)}>{t("cb.not_yet")}</button>
					<button type="button" disabled={decide.isPending} className={buttonClass()} onClick={() => decide.mutate(false)}>{t("cb.save_assessment")}</button>
				</div>
			</div>
		</Modal>
	);
}

const BADGE_LOOK: Record<Badge["kind"], { icon: string; className: string }> = {
	training: { icon: "✓", className: "bg-[#14795A] text-white" },
	course: { icon: "🎓", className: "bg-primary text-primary-foreground" },
	competency: { icon: "★", className: "bg-[#753FF3] text-white" },
	attendance: { icon: "○", className: "bg-muted-foreground text-white" },
};

export function CapacitySkillsPage() {
	const { t, language } = useI18n();
	const queryClient = useQueryClient();
	const me = useCapacityMe();
	const [nominating, setNominating] = useState(false);
	const [editing, setEditing] = useState<MySkill | null>(null);
	const [removing, setRemoving] = useState<MySkill | null>(null);
	const [assessing, setAssessing] = useState<Assessment | null>(null);
	const data = useQuery({
		queryKey: ["capacity-my-skills"],
		queryFn: () => api<{ skills: MySkill[]; badges: Badge[] }>("/capacity/my-skills"),
	});
	const assessments = useQuery({
		queryKey: ["capacity-assessments"],
		queryFn: () => api<{ assessments: Assessment[] }>("/capacity/assessments"),
		select: (result) => result.assessments,
		enabled: !!me.data?.reportScopes.length,
	});
	const refresh = () => queryClient.invalidateQueries({ queryKey: ["capacity-my-skills"] });
	const removeSkill = useMutation({
		mutationFn: (id: number) => api(`/capacity/my-skills/${id}`, { method: "DELETE" }),
		onSuccess: async () => {
			await Promise.all([refresh(), queryClient.invalidateQueries({ queryKey: ["capacity-skills"] })]);
			toast.success(t("cb.toast_removed", { name: removing?.name ?? "" }));
			setRemoving(null);
		},
	});
	const toast = useToast();
	const shareFailed = () => toast.error(t("toast.failed"), t("toast.try_again"));
	const shareDone = async (_: unknown, { shared }: { shared: boolean }) => {
		await refresh();
		toast.success(t(shared ? "cb.toast_shared" : "cb.toast_private"));
	};
	const shareSkill = useMutation({ mutationFn: ({ id, shared }: { id: number; shared: boolean }) => api(`/capacity/my-skills/${id}/share`, { method: "PUT", body: { shared } }), onSuccess: shareDone, onError: shareFailed });
	const shareBadge = useMutation({ mutationFn: ({ key, shared }: { key: string; shared: boolean }) => api("/capacity/my-badges/share", { method: "PUT", body: { key, shared } }), onSuccess: shareDone, onError: shareFailed });
	if (data.isPending) return <PageLoading />;
	if (data.isError) return <PageError onRetry={() => data.refetch()} />;
	const { skills, badges } = data.data;
	const day = (value: string) => new Date(value).toLocaleDateString(language, { dateStyle: "medium" });
	return (
		<div className="flex flex-col gap-4 p-4 md:px-6 md:py-7">
			<PageHeader
				title={t("cb.skills_title")}
				subtitle={t("cb.skills_desc")}
				action={
					<button type="button" className={buttonClass()} onClick={() => setNominating(true)}>
						<Plus size={16} aria-hidden="true" />
						{t("cb.nominate")}
					</button>
				}
			/>
			{!!assessments.data?.length && (
				<section className="rounded-card border border-border bg-card p-4">
					<h2 className="mb-2 text-[15px] font-semibold">{t("cb.to_assess", { count: assessments.data.length })}</h2>
					<ul className="flex flex-col gap-2">
						{assessments.data.map((item) => (
							<li key={item.id} className="flex flex-wrap items-center gap-2.5 text-[13px]">
								<Avatar name={item.ownerName} size={28} />
								<span className="min-w-0 flex-1"><b>{item.ownerName}</b> · {item.skillName} · {t(`cb.level_${item.pendingLevel}`)}</span>
								<button type="button" className={buttonClass("outline", "min-h-8 px-3 py-0")} onClick={() => setAssessing(item)}>{t("cb.assess")}</button>
							</li>
						))}
					</ul>
				</section>
			)}
			<div className="grid items-start gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
				<div className="flex min-w-0 flex-col gap-4">
					<section className="min-w-0 rounded-card border border-border bg-card">
						<h2 className="px-4 py-3 text-[15px] font-semibold">{t("cb.my_skills")}</h2>
						{skills.length === 0 ? (
							<div className="border-t border-border"><StatePanel icon={Sparkles} title={t("cb.no_my_skills")} description={t("cb.no_my_skills_desc")} /></div>
						) : (
							<DataTable bare minWidth={660} head={[t("cb.skill"), t("cb.level"), t("cb.assessment"), t("cb.directory"), ""]}>
								{skills.map((skill) => (
									<tr key={skill.id}>
										<td className="px-3 py-3 first:pl-4">
											<span className="block break-words font-semibold">{skill.name}</span>
											<span className="text-xs text-muted-foreground">{skill.category ? t(`cb.cat_${skill.category}`) : "—"}</span>
										</td>
										<td className="px-3 py-3">
											{skill.level !== null ? <LevelBars level={skill.level} name={skill.name} /> : <span className="text-muted-foreground">—</span>}
											{skill.pendingLevel !== null && <span className="mt-1 block text-xs text-muted-foreground">{t("cb.nominated_for", { level: t(`cb.level_${skill.pendingLevel}`) })}</span>}
										</td>
										<td className="px-3 py-3 text-xs">
											{skill.pendingLevel !== null ? (
												<ReviewChip status="under_review" />
											) : skill.level !== null ? (
												<ReviewChip status="verified" />
											) : (
												<span className="font-medium">{t("cb.not_assessed_yet")}</span>
											)}
											{skill.assessedAt && <span className="mt-1 block text-muted-foreground">{skill.assessorName} · {day(skill.assessedAt)}</span>}
											{skill.revalidateBy && <span className="block text-muted-foreground">{t("cb.revalidate_by", { date: day(skill.revalidateBy) })}</span>}
											{skill.feedback && <span className="mt-1 block break-words text-muted-foreground">“{skill.feedback}”</span>}
										</td>
										<td className="px-3 py-3 last:pr-4">
											{skill.level !== null ? (
												<span className="flex items-center gap-2 text-xs">
													<Toggle checked={skill.shared} label={t("cb.share_skill", { name: skill.name })} disabled={shareSkill.isPending} onChange={(shared) => shareSkill.mutate({ id: skill.id, shared })} />
													{t(skill.shared ? "cb.in_directory" : "cb.private_label")}
												</span>
											) : (
												<span className="text-xs text-muted-foreground">{t("cb.share_after")}</span>
											)}
										</td>
										<td className="px-3 py-3 last:pr-4">
											<span className="flex flex-col items-start gap-1.5 whitespace-nowrap text-[13px] font-medium">
												<button type="button" aria-label={t("cb.edit_named", { name: skill.name })} className="text-selected-foreground" onClick={() => setEditing(skill)}>{t("common.edit")}</button>
												<button type="button" aria-label={t("cb.remove_named", { name: skill.name })} className="text-danger-foreground" onClick={() => setRemoving(skill)}>{t("cb.remove")}</button>
											</span>
										</td>
									</tr>
								))}
							</DataTable>
						)}
						<p className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground">{t("cb.level_rule")}</p>
					</section>
					<section>
						<h2 className="mb-2.5 text-[15px] font-semibold">{t("cb.badges")}</h2>
						{badges.length === 0 ? (
							<p className="rounded-card border border-border bg-card p-4 text-[13px] text-muted-foreground">{t("cb.no_badges")}</p>
						) : (
							<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
								{badges.map((badge) => (
									<article key={badge.key} className={`flex flex-col gap-2 rounded-card border bg-card p-3.5 ${badge.kind === "attendance" ? "border-dashed border-input" : "border-border"}`}>
										<div className="flex items-start gap-2.5">
											<span aria-hidden="true" className={`grid size-8 shrink-0 place-items-center rounded-full text-sm ${BADGE_LOOK[badge.kind].className}`}>{BADGE_LOOK[badge.kind].icon}</span>
											<span className="min-w-0">
												<span className="block text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{t(`cb.badge_${badge.kind}`)}</span>
												<span className="block break-words text-[13px] font-semibold">{badge.title}{badge.level ? ` · ${t(`cb.level_${badge.level}`)}` : ""}</span>
											</span>
										</div>
										{badge.shareable ? (
											<span className="mt-auto flex items-center gap-2 text-xs">
												<Toggle checked={badge.shared} label={t("cb.share_skill", { name: badge.title })} disabled={shareBadge.isPending} onChange={(shared) => shareBadge.mutate({ key: badge.key, shared })} />
												{t(badge.shared ? "cb.in_directory" : "cb.private_label")}
											</span>
										) : (
											<span className="mt-auto flex items-center gap-1.5 text-xs text-muted-foreground">
												<Lock size={12} aria-hidden="true" />
												{t(badge.sensitive ? "cb.cant_share_sensitive" : "cb.private_not_verified")}
											</span>
										)}
									</article>
								))}
							</div>
						)}
						<p className="mt-2 text-xs text-muted-foreground">{t("cb.badge_rule")}</p>
					</section>
				</div>
				<section className="rounded-card border border-border bg-card p-4">
					<h2 className="mb-2 text-[15px] font-semibold">{t("cb.levels_mean")}</h2>
					<dl className="flex flex-col gap-2 text-[13px]">
						{LEVELS.map((value) => (
							<div key={value}>
								<dt className="font-semibold">{t(`cb.level_${value}`)}</dt>
								<dd className="text-muted-foreground">{t(`cb.level_${value}_hint`)}</dd>
							</div>
						))}
					</dl>
				</section>
			</div>
			{nominating && <NominateDialog mine={skills.map((skill) => skill.skillId)} onClose={() => setNominating(false)} />}
			{editing && <NominateDialog existing={editing} mine={[]} onClose={() => setEditing(null)} />}
			<ConfirmModal
				title={t("cb.remove_skill_title", { name: removing?.name ?? "" })}
				description={t(removing?.level ? "cb.remove_verified_desc" : "cb.remove_skill_desc")}
				confirmLabel={t("cb.remove")}
				open={!!removing}
				pending={removeSkill.isPending}
				failed={removeSkill.isError}
				onConfirm={() => removing && removeSkill.mutate(removing.id)}
				onClose={() => setRemoving(null)}
			/>
			{assessing && <AssessDialog item={assessing} onClose={() => setAssessing(null)} />}
		</div>
	);
}

interface TeamData {
	staff: number;
	departments: string[];
	planned: number;
	inProgress: number;
	completedReported: number;
	completedVerified: number;
	waiting: number;
	trainingDays: number;
	contactHours: number;
	categories: { key: string; hidden: boolean; verified?: number; reported?: number }[];
	upcoming: { id: number; restricted: boolean; title: string | null; person: string | null; startDate: string | null }[];
	latest: { id: number; person: string; title: string | null; category: string | null; restricted: boolean; trainingStatus: TrainingStatus; reviewStatus: ReviewStatus }[];
}

export function CapacityTeamPage() {
	const { t, language } = useI18n();
	const team = useQuery({ queryKey: ["capacity-team"], queryFn: () => api<TeamData>("/capacity/team-overview") });
	const exportLog = useMutation({
		mutationFn: () => api("/capacity/team-overview/exported", { method: "POST", body: { count: team.data?.latest.length ?? 0 } }),
		onSuccess: () =>
			downloadCsv("team-overview.csv", [
				[t("cb.col_person"), t("cb.col_training"), t("cb.col_training_status"), t("cb.col_review_status")],
				...(team.data?.latest ?? []).map((row) => [row.person, row.title ?? t("cb.restricted_training"), t(`cb.training_${row.trainingStatus}`), t(`cb.review_${row.reviewStatus}`)]),
			]),
	});
	if (team.isPending) return <PageLoading />;
	if (team.isError) return <PageError onRetry={() => team.refetch()} />;
	const data = team.data;
	const top = Math.max(1, ...data.categories.map((group) => group.reported ?? 0));
	const tiles: [string, number, string, boolean][] = [
		[t("cb.filter_planned"), data.planned, t("cb.team_planned_note"), false],
		[t("cb.training_in_progress"), data.inProgress, t("cb.team_progress_note"), false],
		[t("cb.team_reported"), data.completedReported, t("cb.team_reported_note"), false],
		[t("cb.team_verified"), data.completedVerified, t("cb.team_verified_note"), false],
		[t("cb.stat_waiting"), data.waiting, t("cb.stat_waiting_note"), data.waiting > 0],
	];
	return (
		<div className="flex flex-col gap-4 p-4 md:px-6 md:py-7">
			<PageHeader
				title={t("cb.team_title")}
				subtitle={t("cb.team_desc", { count: data.staff })}
				action={
					<button type="button" disabled={data.latest.length === 0} className={buttonClass("outline")} onClick={() => exportLog.mutate()}>{t("cb.export_logged")}</button>
				}
			/>
			{data.staff === 0 ? (
				<StatePanel icon={ClipboardCheck} title={t("cb.team_empty")} description={t("cb.team_empty_desc")} />
			) : (
				<>
					<dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
						{tiles.map(([label, value, note, alert]) => (
							<div key={label} className={`rounded-card border bg-card p-4 ${alert ? "border-[#F59F0A]" : "border-border"}`}>
								<dt className="text-[13px] text-muted-foreground">{label}</dt>
								<dd className="mt-1 text-2xl font-semibold tracking-tight">{value}</dd>
								<dd className="mt-0.5 text-xs text-muted-foreground">{note}</dd>
							</div>
						))}
					</dl>
					<div className="grid items-start gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
						<section className="min-w-0 rounded-card border border-border bg-card p-4">
							<div className="mb-3 flex flex-wrap items-center justify-between gap-2">
								<h2 className="text-[15px] font-semibold">{t("cb.by_category")}</h2>
								<ul className="flex gap-3 text-xs text-muted-foreground">
									<li className="flex items-center gap-1.5"><span aria-hidden="true" className="size-2.5 rounded-sm bg-primary" />{t("cb.review_verified")}</li>
									<li className="flex items-center gap-1.5"><span aria-hidden="true" className="size-2.5 rounded-sm border border-dashed border-muted-foreground" />{t("cb.reported")}</li>
								</ul>
							</div>
							{data.categories.length === 0 ? (
								<p className="text-[13px] text-muted-foreground">{t("cb.no_completions")}</p>
							) : (
								<ul className="flex flex-col gap-2.5 text-[13px]">
									{data.categories.map((group) => (
										<li key={group.key} className="grid items-center gap-2 sm:grid-cols-[170px_minmax(0,1fr)_130px]">
											<span className="min-w-0 break-words">{t(`cb.cat_${group.key}`)}</span>
											{group.hidden ? (
												<span className="text-xs text-muted-foreground sm:col-span-2">{t("cb.small_group")}</span>
											) : (
												<>
													<span
														role="img"
														title={t("cb.verified_of", { verified: group.verified ?? 0, reported: group.reported ?? 0 })}
														aria-label={t("cb.verified_of", { verified: group.verified ?? 0, reported: group.reported ?? 0 })}
														className="relative block h-3.5 rounded-sm border border-dashed border-muted-foreground"
														style={{ width: `${((group.reported ?? 0) / top) * 100}%` }}
													>
														<span className="block h-full rounded-sm bg-primary" style={{ width: `${((group.verified ?? 0) / (group.reported || 1)) * 100}%` }} />
													</span>
													<span className="text-xs text-muted-foreground">{t("cb.verified_of", { verified: group.verified ?? 0, reported: group.reported ?? 0 })}</span>
												</>
											)}
										</li>
									))}
								</ul>
							)}
							<p className="mt-3 text-xs text-muted-foreground">{t("cb.small_group_note")}</p>
						</section>
						<div className="flex min-w-0 flex-col gap-4">
							<section className="rounded-card border border-border bg-card p-4">
								<h2 className="mb-2 text-[15px] font-semibold">{t("cb.stat_time")}</h2>
								<div className="flex gap-6">
									<p><span className="block text-2xl font-semibold">{data.trainingDays}</span><span className="text-xs text-muted-foreground">{t("cb.unit_training_days")}</span></p>
									<p><span className="block text-2xl font-semibold">{data.contactHours}</span><span className="text-xs text-muted-foreground">{t("cb.unit_contact_hours")}</span></p>
								</div>
								<p className="mt-1 text-xs text-muted-foreground">{t("cb.time_apart")}</p>
							</section>
							<section className="rounded-card border border-border bg-card p-4">
								<h2 className="mb-2 text-[15px] font-semibold">{t("cb.coming_up")}</h2>
								{data.upcoming.length === 0 ? (
									<p className="text-[13px] text-muted-foreground">{t("cb.nothing_coming")}</p>
								) : (
									<ul className="flex flex-col gap-1.5 text-[13px]">
										{data.upcoming.map((item) => (
											<li key={item.id} className="flex items-start justify-between gap-3">
												{item.restricted ? (
													<span className="flex items-center gap-1.5"><Lock size={12} aria-hidden="true" />{t("cb.restricted_activity")}</span>
												) : (
													<>
														<span className="min-w-0 break-words">{item.title} · {item.person}</span>
														{item.startDate && <span className="shrink-0 text-muted-foreground">{new Date(`${item.startDate}T00:00:00Z`).toLocaleDateString(language, { day: "numeric", month: "short", timeZone: "UTC" })}</span>}
													</>
												)}
											</li>
										))}
									</ul>
								)}
								<p className="mt-2 text-xs text-muted-foreground">{t("cb.no_venues")}</p>
							</section>
						</div>
					</div>
					<section className="min-w-0 rounded-card border border-border bg-card">
						<div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
							<h2 className="text-[15px] font-semibold">{t("cb.latest_by_person")}</h2>
							<Link href="/capacity/reviews" className="text-[13px] font-medium text-selected-foreground">{t("cb.open_queue", { count: data.waiting })}</Link>
						</div>
						{data.latest.length === 0 ? (
							<p className="border-t border-border p-4 text-sm text-muted-foreground">{t("cb.report_empty_desc")}</p>
						) : (
							<DataTable bare minWidth={640} head={[t("cb.col_person"), t("cb.col_training"), t("cb.col_training_status"), t("cb.col_review_status")]}>
								{data.latest.map((row) => (
									<tr key={row.id}>
										<td className="px-3 py-2.5 first:pl-4"><span className="flex items-center gap-2"><Avatar name={row.person} size={28} /><span className="font-semibold">{row.person}</span></span></td>
										<td className="px-3 py-2.5">
											<span className="flex items-center gap-1.5 break-words font-semibold">{row.restricted && <Lock size={12} aria-hidden="true" />}{row.title ?? t("cb.restricted_training")}</span>
											<span className="text-xs text-muted-foreground">{row.category ? t(`cb.cat_${row.category}`) : "—"}</span>
										</td>
										<td className="px-3 py-2.5"><TrainingChip status={row.trainingStatus} /></td>
										<td className="px-3 py-2.5 last:pr-4"><ReviewChip status={row.reviewStatus} /></td>
									</tr>
								))}
							</DataTable>
						)}
					</section>
				</>
			)}
		</div>
	);
}

export function SkillCatalogTab() {
	const { t } = useI18n();
	const queryClient = useQueryClient();
	const [editing, setEditing] = useState<CatalogSkill | "new" | null>(null);
	const catalog = useQuery({ queryKey: ["capacity-skills"], queryFn: () => api<{ skills: CatalogSkill[] }>("/capacity/skills"), select: (data) => data.skills });
	const starter = useMutation({
		mutationFn: () => api("/capacity/skills/starter", { method: "POST" }),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["capacity-skills"] }),
	});
	if (catalog.isPending) return <PageLoading variant="inline" />;
	if (catalog.isError) return <PageError onRetry={() => catalog.refetch()} />;
	return (
		<div className="flex flex-col gap-3">
			<div className="flex flex-wrap items-center justify-end gap-2">
				<p className="mr-auto text-[13px] text-muted-foreground">{t("cb.catalog_desc")}</p>
				<button type="button" disabled={starter.isPending} className={buttonClass("outline")} onClick={() => starter.mutate()}>{t("cb.add_starter")}</button>
				<button type="button" className={buttonClass()} onClick={() => setEditing("new")}><Plus size={16} aria-hidden="true" />{t("cb.add_skill")}</button>
			</div>
			{catalog.data.length === 0 ? (
				<StatePanel icon={Award} title={t("cb.no_skills_title")} description={t("cb.no_skills_desc")} />
			) : (
				<DataTable minWidth={620} head={[t("cb.skill"), t("cb.field_category"), t("cb.rubric"), t("cb.revalidate"), ""]}>
					{catalog.data.map((skill) => (
						<tr key={skill.id} className={skill.retired ? "opacity-60" : ""}>
							<td className="px-3 py-2.5 first:pl-4"><b className="break-words">{skill.name}</b>{skill.retired && <span className="ml-2 text-xs text-muted-foreground">{t("cb.retired")}</span>}{skill.addedBy && <span className="block text-xs font-normal text-muted-foreground">{t("cb.added_by", { name: skill.addedBy })}</span>}</td>
							<td className="px-3 py-2.5">{skill.category ? t(`cb.cat_${skill.category}`) : "—"}</td>
							<td className="px-3 py-2.5 text-muted-foreground">
								<span className="inline-flex items-center gap-1">
									{skill.rubric.some(Boolean) && <Check size={13} aria-hidden="true" className="text-[#14795A]" />}
									{skill.rubric.some(Boolean) ? t("cb.rubric_version", { version: skill.rubricVersion }) : t("cb.rubric_empty")}
								</span>
							</td>
							<td className="px-3 py-2.5 text-muted-foreground">{skill.revalidateMonths ? t("cb.months", { count: skill.revalidateMonths }) : t("cb.never")}</td>
							<td className="px-3 py-2.5 last:pr-4"><button type="button" className="font-medium text-selected-foreground" onClick={() => setEditing(skill)}>{t("common.edit")}</button></td>
						</tr>
					))}
				</DataTable>
			)}
			<p className="text-xs text-muted-foreground">{t("cb.catalog_note")}</p>
			{editing && <SkillDialog skill={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
		</div>
	);
}

function SkillDialog({ skill, onClose }: { skill: CatalogSkill | null; onClose: () => void }) {
	const { t } = useI18n();
	const queryClient = useQueryClient();
	const [name, setName] = useState(skill?.name ?? "");
	const [category, setCategory] = useState(skill?.category ?? "other");
	const [description, setDescription] = useState(skill?.description ?? "");
	const [months, setMonths] = useState(skill?.revalidateMonths ? String(skill.revalidateMonths) : "");
	const [rubric, setRubric] = useState<string[]>(skill?.rubric ?? ["", "", "", "", ""]);
	const save = useMutation({
		mutationFn: (retired: boolean) =>
			api(skill ? `/capacity/skills/${skill.id}` : "/capacity/skills", {
				method: skill ? "PUT" : "POST",
				body: { name, category, description, revalidateMonths: months ? Number(months) : null, rubric, retired },
			}),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: ["capacity-skills"] });
			onClose();
		},
	});
	const code = save.error instanceof ApiError ? save.error.code : "";
	return (
		<Modal title={t(skill ? "cb.edit_skill" : "cb.add_skill")} open wide onClose={onClose}>
			<div className="flex flex-col gap-3.5">
				{save.isError && <Alert>{t(code === "INVALID_SKILL" ? "cb.skill_name_required" : "error.generic")}</Alert>}
				<div className="grid gap-3 sm:grid-cols-3">
					<div className="sm:col-span-1"><Field label={t("cb.skill_name")} maxLength={120} value={name} onChange={(event) => setName(event.target.value)} /></div>
					<SelectField label={t("cb.field_category")} value={category} onChange={(event) => setCategory(event.target.value)}>
						{SKILL_CATEGORIES.map((value) => <option key={value} value={value}>{t(`cb.cat_${value}`)}</option>)}
					</SelectField>
					<SelectField label={t("cb.revalidate")} value={months} onChange={(event) => setMonths(event.target.value)}>
						<option value="">{t("cb.never")}</option>
						<option value="12">{t("cb.months", { count: 12 })}</option>
						<option value="24">{t("cb.months", { count: 24 })}</option>
					</SelectField>
				</div>
				<TextareaField label={t("cb.skill_description")} rows={2} maxLength={1000} value={description} onChange={(event) => setDescription(event.target.value)} />
				<fieldset>
					<legend className="mb-1.5 text-sm font-medium">{t("cb.rubric_title")}</legend>
					<div className="flex flex-col gap-2">
						{LEVELS.map((value, index) => (
							<label key={value} className="grid items-start gap-2 text-[13px] sm:grid-cols-[150px_minmax(0,1fr)]">
								<span className="pt-1.5 font-semibold">{t(`cb.level_${value}`)} <span className="text-xs font-normal text-muted-foreground">L{value}</span></span>
								<textarea
									rows={1}
									maxLength={500}
									placeholder={t(`cb.level_${value}_hint`)}
									value={rubric[index]}
									className="w-full rounded-md border border-input bg-card px-2.5 py-1.5"
									onChange={(event) => setRubric((current) => current.map((item, position) => (position === index ? event.target.value : item)))}
								/>
							</label>
						))}
					</div>
					<p className="mt-2 text-xs text-muted-foreground">{t("cb.rubric_note")}</p>
				</fieldset>
				<div className="flex flex-wrap justify-end gap-2">
					{skill && !skill.retired && <button type="button" disabled={save.isPending} className={`${buttonClass("ghost")} mr-auto`} onClick={() => save.mutate(true)}>{t("cb.retire")}</button>}
					<button type="button" className={buttonClass("outline")} onClick={onClose}>{t("common.cancel")}</button>
					<button type="button" disabled={!name.trim() || save.isPending} className={buttonClass()} onClick={() => save.mutate(false)}>{t("common.save")}</button>
				</div>
			</div>
		</Modal>
	);
}
