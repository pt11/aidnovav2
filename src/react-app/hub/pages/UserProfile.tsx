import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { api, ApiError, type Me, type Role } from "../api";
import { useI18n } from "../i18n";
import {
	ActionsMenu,
	Alert,
	Avatar,
	BUTTON_SMALL,
	buttonClass,
	Chip,
	ConfirmModal,
	Field,
	Modal,
	PageError,
	PageLoading,
	Segmented,
	StatePanel,
} from "../ui";
import { AssignCourseDialog, DepartmentDialog, RoleDialog } from "./Users";

interface ProfileCourse {
	id: number;
	title: string;
	isMandatory: boolean;
	status: "completed" | "in_progress" | "not_started";
	lessonsDone: number;
	lessonTotal: number;
	bestScore: number | null;
	passed: boolean;
	completedAt: string | null;
}

interface StaffProfile {
	userId: string;
	name: string;
	email: string;
	role: Role;
	isActive: boolean;
	departmentId: number | null;
	departmentName: string | null;
	position: string | null;
	bio: string | null;
	contactEmail: string | null;
	viberLink: string | null;
	facebookLink: string | null;
	photoUrl: string | null;
	joinedAt: string | null;
	interviewDate: string | null;
	onboardingDate: string | null;
	policies: { id: number; title: string; isMandatory: boolean; acknowledgedAt: string | null }[];
	courses: ProfileCourse[];
	certificates: { id: number; courseTitle: string; issuedAt: string; score: number | null }[];
}

const TABS = ["learning", "policies", "certificates", "employment"] as const;
const ROLE_TONES = { admin: "primary", manager: "neutral", staff: "outline" } as const;

function profileKey(id: string) {
	return ["staff-profile", id];
}

function EmploymentDialog({ profile, onClose }: { profile: StaffProfile; onClose: () => void }) {
	const { t } = useI18n();
	const queryClient = useQueryClient();
	const [position, setPosition] = useState(profile.position ?? "");
	const [interviewDate, setInterviewDate] = useState(profile.interviewDate?.slice(0, 10) ?? "");
	const [onboardingDate, setOnboardingDate] = useState(profile.onboardingDate?.slice(0, 10) ?? "");
	const save = useMutation({
		mutationFn: () =>
			api(`/organizations/current/members/${profile.userId}/employment`, {
				method: "PATCH",
				body: { position, interviewDate, onboardingDate },
			}),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: profileKey(profile.userId) });
			onClose();
		},
	});
	const code = save.error instanceof ApiError ? save.error.code : "";
	return (
		<Modal title={t("people.edit_details")} description={profile.name} open onClose={onClose}>
			<form
				className="flex flex-col gap-3.5"
				onSubmit={(event) => {
					event.preventDefault();
					save.mutate();
				}}
			>
				{save.isError && (
					<Alert>{t(code === "FORBIDDEN" ? "people.admin_only" : "error.generic")}</Alert>
				)}
				<Field
					label={t("profile.position")}
					maxLength={255}
					value={position}
					onChange={(event) => setPosition(event.target.value)}
				/>
				<div className="grid gap-3 sm:grid-cols-2">
					<Field
						label={t("people.interview_date")}
						type="date"
						value={interviewDate}
						onChange={(event) => setInterviewDate(event.target.value)}
					/>
					<Field
						label={t("people.onboarding_date")}
						type="date"
						value={onboardingDate}
						onChange={(event) => setOnboardingDate(event.target.value)}
					/>
				</div>
				<div className="flex justify-end gap-2">
					<button type="button" className={buttonClass("outline")} onClick={onClose}>
						{t("common.cancel")}
					</button>
					<button type="submit" disabled={save.isPending} className={buttonClass()}>
						{t("common.save")}
					</button>
				</div>
			</form>
		</Modal>
	);
}

export function UserProfilePage({ id, me, role }: { id: string; me: Me; role: Role }) {
	const { t, language } = useI18n();
	const queryClient = useQueryClient();
	const [tab, setTab] = useState<(typeof TABS)[number]>("learning");
	const [copied, setCopied] = useState(false);
	const [dialog, setDialog] = useState<"details" | "role" | "department" | "course" | "reset" | "status" | null>(null);
	const profile = useQuery({
		queryKey: profileKey(id),
		retry: false,
		queryFn: () => api<StaffProfile>(`/organizations/current/members/${id}/profile`),
	});
	const owner = useQuery({
		queryKey: ["members"],
		queryFn: () => api<{ ownerId: string }>("/organizations/current/members"),
		select: (data) => data.ownerId,
	});
	const refresh = () =>
		Promise.all([
			queryClient.invalidateQueries({ queryKey: profileKey(id) }),
			queryClient.invalidateQueries({ queryKey: ["members"] }),
		]);
	const changeStatus = useMutation({
		mutationFn: (isActive: boolean) =>
			api(`/organizations/current/members/${id}/status`, { method: "PATCH", body: { isActive } }),
		onSuccess: async () => {
			await refresh();
			setDialog(null);
		},
	});
	const sendReset = useMutation({
		mutationFn: () => api(`/organizations/current/members/${id}/send-reset`, { method: "POST" }),
	});

	if (profile.isPending) return <PageLoading />;
	if (profile.isError) {
		return profile.error instanceof ApiError && profile.error.status === 404 ? (
			<StatePanel
				title={t("people.not_found")}
				action={
					<Link href="/users" className={buttonClass("outline")}>
						{t("people.back")}
					</Link>
				}
			/>
		) : (
			<PageError onRetry={() => profile.refetch()} />
		);
	}

	const data = profile.data;
	const date = (value: string | null) =>
		value ? new Date(value).toLocaleDateString(language, { dateStyle: "medium" }) : "—";
	const utcDate = (value: string | null) =>
		value ? new Date(value).toLocaleDateString(language, { dateStyle: "medium", timeZone: "UTC" }) : "—";
	const required = data.policies.filter((policy) => policy.isMandatory);
	const acknowledged = required.filter((policy) => policy.acknowledgedAt).length;
	const done = data.courses.filter((course) => course.status === "completed").length;
	const inProgress = data.courses.filter((course) => course.status === "in_progress").length;
	const canEditRole = role === "admin" && data.userId !== owner.data && data.userId !== me.user.id;
	const canEditDetails = role === "admin" || data.role === "staff";
	const statusLabels = {
		completed: "course.status_completed",
		in_progress: "course.status_in_progress",
		not_started: "course.status_not_started",
	};
	const asMember = {
		userId: data.userId,
		name: data.name,
		role: data.role,
		departmentId: data.departmentId,
	};

	return (
		<div className="mx-auto flex max-w-[1180px] flex-col gap-4 p-4 md:px-6 md:py-7">
			<nav aria-label={t("people.breadcrumb")} className="text-[13px] text-muted-foreground">
				<Link href="/users" className="text-selected-foreground no-underline hover:underline">
					{t("users.title")}
				</Link>{" "}
				/ {data.name}
			</nav>

			<section className="flex flex-wrap items-start gap-5 rounded-card border border-border bg-card p-5">
				<Avatar name={data.name} photoUrl={data.photoUrl} size={72} muted={!data.isActive} />
				<div className="flex min-w-0 flex-[1_1_300px] flex-col gap-1.5">
					<div className="flex flex-wrap items-center gap-2">
						<h1 className="min-w-0 break-words text-2xl font-semibold leading-8">{data.name}</h1>
						<Chip tone={ROLE_TONES[data.role]}>{t(`role.${data.role}`)}</Chip>
						<Chip tone={data.isActive ? "neutral" : "outline"}>
							{t(data.isActive ? "users.active" : "users.inactive")}
						</Chip>
						{data.userId === owner.data && <Chip tone="neutral">{t("users.owner")}</Chip>}
					</div>
					<p className="break-words text-muted-foreground">
						{[data.position, data.departmentName].filter(Boolean).join(" · ") || t("people.no_details")}
					</p>
					{data.bio && <p className="max-w-xl whitespace-pre-wrap break-words text-[13px]">{data.bio}</p>}
					{data.certificates.length > 0 && (
						<div className="flex flex-wrap gap-1.5">
							{data.certificates.slice(0, 3).map((certificate) => (
								<Chip key={certificate.id}>
									{t("people.completed_chip", { title: certificate.courseTitle })}
								</Chip>
							))}
						</div>
					)}
				</div>
				<div className="flex min-w-0 flex-[1_1_240px] flex-col gap-1.5 rounded-[9px] border border-border p-3.5 text-[13px] md:max-w-[300px]">
					<p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
						{t("people.contact")}
					</p>
					<a href={`mailto:${data.contactEmail ?? data.email}`} className="break-all no-underline hover:underline">
						{data.contactEmail ?? data.email}
					</a>
					{data.viberLink && (
						<a href={data.viberLink} className="no-underline hover:underline" rel="noreferrer noopener">
							{t("profile.viber_short")}
						</a>
					)}
					{data.facebookLink && (
						<a href={data.facebookLink} target="_blank" className="no-underline hover:underline" rel="noreferrer noopener">
							{t("profile.facebook_short")}
						</a>
					)}
					<button
						type="button"
						className={buttonClass("outline", "mt-1 self-start")}
						onClick={() => {
							void navigator.clipboard.writeText(window.location.href).then(() => setCopied(true));
						}}
					>
						{t(copied ? "people.card_copied" : "people.copy_card")}
					</button>
					<p className="text-xs text-muted-foreground">{t("people.card_note")}</p>
				</div>
				<div className="flex flex-wrap items-center gap-2 lg:ml-auto">
					{canEditDetails && (
						<button type="button" className={buttonClass("outline")} onClick={() => setDialog("details")}>
							{t("common.edit")}
						</button>
					)}
					<ActionsMenu
						label={t("users.actions_for", { name: data.name })}
						actions={[
							...(canEditRole ? [{ label: t("users.change_role"), onSelect: () => setDialog("role") }] : []),
							{ label: t("users.set_department"), onSelect: () => setDialog("department") },
							...(data.isActive ? [{ label: t("users.assign_course"), onSelect: () => setDialog("course") }] : []),
							...(role === "admin" && data.isActive
								? [
										{
											label: t("users.send_reset"),
											onSelect: () => {
												sendReset.reset();
												setDialog("reset");
											},
										},
									]
								: []),
							...(canEditRole
								? [
										{
											label: t(data.isActive ? "users.deactivate" : "users.reactivate"),
											danger: data.isActive,
											separated: true,
											onSelect: () => {
												changeStatus.reset();
												setDialog("status");
											},
										},
									]
								: []),
						]}
					/>
				</div>
			</section>

			<dl className="grid gap-3 sm:grid-cols-3">
				<div className="rounded-card border border-border bg-card px-4 py-3.5">
					<dt className="text-[13px] text-muted-foreground">{t("people.policies_acknowledged")}</dt>
					<dd className="text-[22px] font-semibold leading-[30px]">
						{t("people.of", { done: acknowledged, total: required.length })}
					</dd>
					{required.length > acknowledged && (
						<dd className="text-xs font-semibold text-danger-foreground">
							{t("people.policies_left", { count: required.length - acknowledged })}
						</dd>
					)}
				</div>
				<div className="rounded-card border border-border bg-card px-4 py-3.5">
					<dt className="text-[13px] text-muted-foreground">{t("nav.courses")}</dt>
					<dd className="text-[22px] font-semibold leading-[30px]">
						{t("people.courses_summary", { done, progress: inProgress })}
					</dd>
				</div>
				<div className="rounded-card border border-border bg-card px-4 py-3.5">
					<dt className="text-[13px] text-muted-foreground">{t("certificate.list_title")}</dt>
					<dd className="text-[22px] font-semibold leading-[30px]">{data.certificates.length}</dd>
				</div>
			</dl>

			<div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:px-0">
				<Segmented
					label={t("people.sections")}
					options={TABS.map((value) => ({ value, label: t(`people.tab_${value}`) }))}
					value={tab}
					onChange={setTab}
					look="underline"
				/>
			</div>

			{tab === "learning" && (
				<section className="overflow-hidden rounded-card border border-border bg-card">
					<div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
						<h2 className="text-[15px] font-semibold">{t("nav.courses")}</h2>
						{data.isActive && (
							<button type="button" className={buttonClass("outline", BUTTON_SMALL)} onClick={() => setDialog("course")}>
								{t("users.assign_course")}
							</button>
						)}
					</div>
					{data.courses.length === 0 ? (
						<p className="border-t border-border px-4 py-5 text-center text-muted-foreground">{t("users.not_enrolled")}</p>
					) : (
						<div className="overflow-x-auto">
							<table className="w-full min-w-[560px] text-left text-[13px]">
								<thead className="bg-background text-xs text-muted-foreground">
									<tr>
										<th scope="col" className="px-4 py-2 font-semibold">{t("nav.courses")}</th>
										<th scope="col" className="px-2 py-2 font-semibold">{t("course.progress")}</th>
										<th scope="col" className="px-2 py-2 font-semibold">{t("people.quiz")}</th>
										<th scope="col" className="px-4 py-2 font-semibold">{t("people.finished")}</th>
									</tr>
								</thead>
								<tbody>
									{data.courses.map((course) => {
										const percent = course.lessonTotal ? Math.round((course.lessonsDone / course.lessonTotal) * 100) : 0;
										return (
											<tr key={course.id} className="border-t border-border">
												<td className="break-words px-4 py-2.5 font-medium">
													<Link href={`/courses/${course.id}/learners`} className="text-foreground no-underline hover:underline">
														{course.title}
													</Link>
												</td>
												<td className="px-2 py-2.5">
													{course.status === "in_progress" ? (
														<span className="flex items-center gap-2">
															<span
																role="progressbar"
																aria-valuenow={percent}
																aria-valuemin={0}
																aria-valuemax={100}
																aria-label={course.title}
																className="h-1.5 w-28 overflow-hidden rounded-full bg-input"
															>
																<span className="block h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
															</span>
															{t("people.lessons_of", { done: course.lessonsDone, total: course.lessonTotal })}
														</span>
													) : (
														t(statusLabels[course.status])
													)}
												</td>
												<td className="px-2 py-2.5">
													{course.bestScore === null ? (
														<span className="text-muted-foreground">{t("people.not_yet")}</span>
													) : (
														`${course.bestScore}%${course.passed ? ` · ${t("quiz.passed_short")}` : ""}`
													)}
												</td>
												<td className="px-4 py-2.5">{date(course.completedAt)}</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>
					)}
				</section>
			)}

			{tab === "policies" && (
				<section className="overflow-hidden rounded-card border border-border bg-card">
					{data.policies.length === 0 ? (
						<p className="px-4 py-5 text-center text-muted-foreground">{t("people.no_policies")}</p>
					) : (
						<ul className="divide-y divide-border">
							{data.policies.map((policy) => (
								<li key={policy.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5">
									<Link href={`/policies/${policy.id}`} className="min-w-0 flex-[1_1_220px] break-words font-medium text-foreground no-underline hover:underline">
										{policy.title}
									</Link>
									{policy.isMandatory && <Chip tone="primary">{t("policies.mandatory_badge")}</Chip>}
									{policy.acknowledgedAt ? (
										<Chip tone="success">{t("reports.acknowledged_on", { date: date(policy.acknowledgedAt) })}</Chip>
									) : (
										policy.isMandatory && <Chip>{t("reports.not_acknowledged")}</Chip>
									)}
								</li>
							))}
						</ul>
					)}
				</section>
			)}

			{tab === "certificates" && (
				<section className="overflow-hidden rounded-card border border-border bg-card">
					{data.certificates.length === 0 ? (
						<p className="px-4 py-5 text-center text-muted-foreground">{t("people.no_certificates")}</p>
					) : (
						<ul className="divide-y divide-border">
							{data.certificates.map((certificate) => (
								<li key={certificate.id}>
									<Link href={`/certificates/${certificate.id}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-foreground no-underline hover:bg-muted/40">
										<span className="min-w-0 break-words font-medium">{certificate.courseTitle}</span>
										<span className="text-[13px] text-muted-foreground">{date(certificate.issuedAt)}</span>
									</Link>
								</li>
							))}
						</ul>
					)}
				</section>
			)}

			{tab === "employment" && (
				<section className="rounded-card border border-border bg-card p-5">
					<dl className="grid gap-4 text-[13px] sm:grid-cols-2 lg:grid-cols-3">
						{[
							{ label: t("profile.position"), value: data.position ?? "—" },
							{ label: t("users.department"), value: data.departmentName ?? t("users.not_set") },
							{ label: t("users.role"), value: t(`role.${data.role}`) },
							{ label: t("people.sign_in_email"), value: data.email },
							{ label: t("people.joined"), value: date(data.joinedAt) },
							{ label: t("people.interview_date"), value: utcDate(data.interviewDate) },
							{ label: t("people.onboarding_date"), value: utcDate(data.onboardingDate) },
						].map((row) => (
							<div key={row.label}>
								<dt className="text-muted-foreground">{row.label}</dt>
								<dd className="break-words font-medium">{row.value}</dd>
							</div>
						))}
					</dl>
				</section>
			)}

			{dialog === "details" && <EmploymentDialog profile={data} onClose={() => setDialog(null)} />}
			{dialog === "role" && (
				<RoleDialog
					person={asMember}
					onClose={() => {
						setDialog(null);
						void refresh();
					}}
				/>
			)}
			{dialog === "department" && (
				<DepartmentDialog
					people={[asMember]}
					onClose={() => {
						setDialog(null);
						void refresh();
					}}
				/>
			)}
			{dialog === "course" && (
				<AssignCourseDialog
					people={[asMember]}
					onClose={() => {
						setDialog(null);
						void refresh();
					}}
				/>
			)}
			<Modal
				title={t("signin.send_title")}
				description={t("signin.note", { name: data.name })}
				open={dialog === "reset"}
				onClose={() => setDialog(null)}
			>
				<div className="flex flex-col gap-3.5">
					{sendReset.isError && (
						<Alert>
							{t(
								sendReset.error instanceof ApiError && sendReset.error.code === "TOO_MANY_EMAILS"
									? "signin.too_many"
									: "error.generic",
							)}
						</Alert>
					)}
					{sendReset.isSuccess && (
						<p role="status" className="rounded-md bg-selected px-3 py-2.5 text-[13px]">
							{t("signin.sent", { email: data.email })}
						</p>
					)}
					<div className="flex justify-end gap-2">
						<button type="button" className={buttonClass("outline")} onClick={() => setDialog(null)}>
							{t("common.close")}
						</button>
						{!sendReset.isSuccess && (
							<button type="button" disabled={sendReset.isPending} className={buttonClass()} onClick={() => sendReset.mutate()}>
								{t("signin.send")}
							</button>
						)}
					</div>
				</div>
			</Modal>
			<ConfirmModal
				title={t(data.isActive ? "users.deactivate_title" : "users.reactivate_title")}
				description={t(data.isActive ? "users.deactivate_desc" : "users.reactivate_desc", { name: data.name })}
				confirmLabel={t(data.isActive ? "users.deactivate" : "users.reactivate")}
				open={dialog === "status"}
				pending={changeStatus.isPending}
				failed={changeStatus.isError}
				failedMessage={
					changeStatus.error instanceof ApiError && changeStatus.error.code === "USER_LIMIT"
						? t("plan.user_limit")
						: undefined
				}
				onConfirm={() => changeStatus.mutate(!data.isActive)}
				onClose={() => setDialog(null)}
			/>
		</div>
	);
}
