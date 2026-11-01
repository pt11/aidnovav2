import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Contact, Check } from "lucide-react";
import { Link } from "wouter";
import { api } from "../api";
import { useI18n } from "../i18n";
import { Alert, buttonClass, Toggle, useToast, FilterSelect, PageError, PageHeader, PageLoading, StatePanel, TextareaField } from "../ui";

interface Card {
	key: number;
	name: string;
	isDisplayName: boolean;
	picture: "photo" | "initials" | "pattern";
	photoUrl: string | null;
	position: string | null;
	team: string | null;
	bio: string | null;
	skills: { name: string; category: string | null; level: number }[];
	badges: { kind: string; title: string }[];
}

interface Rules {
	showTeams: boolean;
	allowPhotos: boolean;
	allowDisplayNames: boolean;
}

// A pattern comes from the name alone, so it doesn't reveal a face or a colour choice.
function patternFor(name: string) {
	const hash = [...name].reduce((total, char) => total + char.charCodeAt(0), 0);
	const hues = ["#22A076", "#0066F5", "#753FF3", "#E92063"];
	return `conic-gradient(from ${hash % 360}deg, ${hues[hash % 4]} 0 35%, ${hues[(hash + 1) % 4]} 35% 70%, var(--muted) 70% 100%)`;
}

function Picture({ card, size = 52 }: { card: Pick<Card, "name" | "picture" | "photoUrl">; size?: number }) {
	const style = { width: size, height: size };
	if (card.picture === "photo" && card.photoUrl) return <img src={card.photoUrl} alt="" style={style} className="shrink-0 rounded-full object-cover" />;
	if (card.picture === "pattern") return <span aria-hidden="true" style={{ ...style, background: patternFor(card.name) }} className="shrink-0 rounded-full" />;
	const initials = card.name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join("").toUpperCase();
	return <span aria-hidden="true" style={style} className="grid shrink-0 place-items-center rounded-full bg-primary text-[15px] font-semibold text-primary-foreground">{initials}</span>;
}

function DirectoryCard({ card }: { card: Card }) {
	const { t } = useI18n();
	return (
		<article className="flex flex-col gap-2.5 rounded-card border border-border bg-card p-4">
			<div className="flex items-center gap-3">
				<Picture card={card} />
				<span className="min-w-0">
					<b className="break-words text-[15px]">{card.name}</b>
					{card.isDisplayName && <span className="ml-1.5 rounded-md border border-input px-1.5 text-[11px] font-semibold text-muted-foreground">{t("dir.display_name")}</span>}
					{card.position && <span className="block break-words text-[13px] text-muted-foreground">{card.position}</span>}
					{card.team && <span className="block break-words text-xs text-muted-foreground">{card.team}</span>}
				</span>
			</div>
			{card.bio && <p className="break-words text-[13px]">{card.bio}</p>}
			{card.skills.length > 0 && (
				<div className="flex flex-wrap gap-1.5">
					{card.skills.map((skill) => (
						<span key={skill.name} className="inline-flex flex-wrap gap-1.5 rounded-md bg-muted px-2 py-0.5 text-xs">
							<b>{skill.name}</b>
							<span className="text-muted-foreground">{t(`cb.level_${skill.level}`)}</span>
						</span>
					))}
				</div>
			)}
			{card.badges.length > 0 && (
				<div className="flex flex-wrap gap-1.5">
					{card.badges.map((badge) => (
						<span key={`${badge.kind}-${badge.title}`} className="inline-flex items-center gap-1 rounded-full border border-[#22A076] px-2 text-[11px] font-semibold">
							<Check size={11} aria-hidden="true" className="text-[#14795A]" />
							{badge.title}
						</span>
					))}
				</div>
			)}
		</article>
	);
}

// Tells people why they aren't in the list, instead of leaving them to guess.
function MyListing({ data }: { data: MyProfile }) {
	const { t } = useI18n();
	const { listed, displayName, displayNameApproved } = data.profile;
	if (listed && (!displayName || (displayNameApproved && data.rules.allowDisplayNames))) return null;
	const message = !listed
		? t("dir.status_not_listed")
		: !data.rules.allowDisplayNames
			? t("dir.status_names_off", { name: displayName ?? "" })
			: t("dir.status_pending", { name: displayName ?? "" });
	return <Alert tone={listed ? "warning" : "info"}>{message}</Alert>;
}

function useRefreshDirectory() {
	const queryClient = useQueryClient();
	return () =>
		Promise.all(["directory", "directory-me", "directory-settings"].map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
}

function PendingNames({ pending, hideWhenEmpty = false }: { pending: { id: number; displayName: string; person: string }[]; hideWhenEmpty?: boolean }) {
	const { t } = useI18n();
	const refresh = useRefreshDirectory();
	const toast = useToast();
	const decide = useMutation({
		mutationFn: ({ id, approve }: { id: number; approve: boolean }) => api(`/directory/display-names/${id}`, { method: "POST", body: { approve } }),
		onSuccess: async (_, { approve }) => {
			await refresh();
			toast.success(t(approve ? "dir.toast_approved" : "dir.toast_declined"));
		},
		onError: () => toast.error(t("toast.failed"), t("toast.try_again")),
	});
	if (hideWhenEmpty && pending.length === 0) return null;
	return (
		<section className="rounded-card border border-border bg-card p-4">
			<h2 className="mb-2 text-[15px] font-semibold">{t("dir.pending_names")}</h2>
			{pending.length === 0 ? (
				<p className="text-[13px] text-muted-foreground">{t("dir.no_pending")}</p>
			) : (
				<ul className="flex flex-col gap-2 text-[13px]">
					{pending.map((item) => (
						<li key={item.id} className="flex flex-wrap items-center gap-2">
							<span className="min-w-0 flex-1 break-words"><b>{item.displayName}</b> · {item.person}</span>
							<button type="button" disabled={decide.isPending} className={buttonClass("outline", "min-h-8 px-3 py-0")} onClick={() => decide.mutate({ id: item.id, approve: false })}>{t("dir.decline")}</button>
							<button type="button" disabled={decide.isPending} className={buttonClass("primary", "min-h-8 px-3 py-0")} onClick={() => decide.mutate({ id: item.id, approve: true })}>{t("dir.approve")}</button>
						</li>
					))}
				</ul>
			)}
		</section>
	);
}

interface DirectorySettings {
	rules: Rules;
	pending: { id: number; displayName: string; person: string }[];
}

export function DirectoryPage() {
	const { t } = useI18n();
	const mine = useQuery({ queryKey: ["directory-me"], queryFn: () => api<MyProfile>("/directory/me") });
	const settings = useQuery({
		queryKey: ["directory-settings"],
		queryFn: () => api<DirectorySettings>("/directory/settings"),
		enabled: !!mine.data?.isAdmin,
		retry: false,
	});
	const [query, setQuery] = useState("");
	const [area, setArea] = useState("all");
	const [level, setLevel] = useState("any");
	const data = useQuery({ queryKey: ["directory"], queryFn: () => api<{ cards: Card[]; staff: number }>("/directory") });
	const cards = useMemo(() => data.data?.cards ?? [], [data.data]);
	if (data.isPending) return <PageLoading variant="cards" />;
	if (data.isError) return <PageError onRetry={() => data.refetch()} />;
	const text = query.trim().toLowerCase();
	const areas = [...new Set(cards.flatMap((card) => card.skills.map((skill) => skill.category).filter((value): value is string => !!value)))];
	const visible = cards.filter((card) => {
		const skills = card.skills.filter((skill) => (area === "all" || skill.category === area) && (level === "any" || skill.level >= 3));
		if ((area !== "all" || level !== "any") && skills.length === 0) return false;
		if (!text) return true;
		return [card.name, card.position ?? "", card.team ?? "", card.bio ?? "", ...card.skills.map((skill) => skill.name), ...card.badges.map((badge) => badge.title)].some((value) => value.toLowerCase().includes(text));
	});
	return (
		<div className="flex flex-col gap-4 p-4 md:px-6 md:py-7">
			<PageHeader title={t("dir.title")} subtitle={t("dir.desc")} action={
				<div className="flex flex-wrap gap-2">
					{mine.data?.isAdmin && <Link href="/directory/rules" className={buttonClass("ghost")}>{t("cb.tab_directory")}</Link>}
					<Link href="/directory/privacy" className={buttonClass("outline")}>{t("dir.edit_mine")}</Link>
				</div>
			} />
			{mine.data && <MyListing data={mine.data} />}
			{settings.data && <PendingNames pending={settings.data.pending} hideWhenEmpty />}
			<div className="flex flex-wrap items-center gap-2">
				<input
					type="search"
					aria-label={t("dir.search")}
					placeholder={t("dir.search")}
					value={query}
					className="h-10 min-w-52 flex-1 rounded-md border border-input bg-card px-3"
					onChange={(event) => setQuery(event.target.value)}
				/>
				<FilterSelect label={t("dir.area")} value={area} onChange={setArea}>
					<option value="all">{t("cb.filter_all")}</option>
					{areas.map((value) => <option key={value} value={value}>{t(`cb.cat_${value}`)}</option>)}
				</FilterSelect>
				<FilterSelect label={t("cb.level")} value={level} onChange={setLevel}>
					<option value="any">{t("dir.any_level")}</option>
					<option value="proficient">{t("dir.proficient_up")}</option>
				</FilterSelect>
			</div>
			<p className="text-[13px] text-muted-foreground">{t("dir.count", { listed: cards.length, staff: data.data.staff })}</p>
			{visible.length === 0 ? (
				<StatePanel icon={Contact} title={t(cards.length ? "dir.no_results" : "dir.empty")} description={cards.length ? undefined : t("dir.empty_desc")} />
			) : (
				<div className="grid grid-cols-[repeat(auto-fill,minmax(min(300px,100%),1fr))] gap-3">
					{visible.map((card) => <DirectoryCard key={card.key} card={card} />)}
				</div>
			)}
			<section className="grid gap-4 rounded-card border border-border bg-card p-4 text-[13px] sm:grid-cols-3">
				{(["shown", "never", "social"] as const).map((key) => (
					<div key={key}>
						<h2 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{t(`dir.${key}_title`)}</h2>
						<p className="mt-1">{t(`dir.${key}_text`)}</p>
					</div>
				))}
			</section>
		</div>
	);
}

interface MyProfile {
	profile: { listed: boolean; displayName: string | null; displayNameApproved: boolean; picture: "photo" | "initials" | "pattern"; showTitle: boolean; showTeam: boolean; bio: string | null };
	rules: Rules;
	isAdmin: boolean;
	me: { name: string; position: string | null; team: string | null; photoUrl: string | null };
}

function PrivacyForm({ data }: { data: MyProfile }) {
	const { t } = useI18n();
	const { rules, me } = data;
	const [listed, setListed] = useState(data.profile.listed);
	const [useDisplay, setUseDisplay] = useState(rules.allowDisplayNames && !!data.profile.displayName);
	const [displayName, setDisplayName] = useState(data.profile.displayName ?? "");
	const [picture, setPicture] = useState(data.profile.picture);
	const [showTitle, setShowTitle] = useState(data.profile.showTitle);
	const [showTeam, setShowTeam] = useState(data.profile.showTeam);
	const [bio, setBio] = useState(data.profile.bio ?? "");
	const refresh = useRefreshDirectory();
	const toast = useToast();
	const save = useMutation({
		mutationFn: (nextListed?: boolean) => api<{ displayNamePending: boolean }>("/directory/me", { method: "PUT", body: { listed: nextListed ?? listed, displayName: useDisplay ? displayName : "", picture, showTitle, showTeam, bio } }),
		onSuccess: refresh,
	});
	const unsaved =
		listed !== data.profile.listed ||
		(useDisplay ? displayName.trim() : "") !== (data.profile.displayName ?? "") ||
		picture !== data.profile.picture ||
		showTitle !== data.profile.showTitle ||
		showTeam !== data.profile.showTeam ||
		bio.trim() !== (data.profile.bio ?? "");
	const approved = useDisplay && displayName === data.profile.displayName && data.profile.displayNameApproved;
	const named = useDisplay && !!displayName.trim();
	const previewName = named ? displayName : me.name;
	const previewPicture = picture === "photo" && (!rules.allowPhotos || named) ? (named ? "pattern" : "initials") : picture;
	const row = (title: string, detail: string | null, control: React.ReactNode, note?: string) => (
		<div className="flex items-center gap-3 border-t border-border py-3 first:border-t-0">
			<span className="min-w-0 flex-1">
				<b className="block">{title}</b>
				{detail && <span className="block break-words text-xs text-muted-foreground">{detail}</span>}
				{note && <span className="mt-0.5 block text-xs">{note}</span>}
			</span>
			{control}
		</div>
	);
	return (
		<div className="grid items-start gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
			<div className="flex min-w-0 flex-col gap-4">
				<section className="rounded-card border border-border bg-card px-4 py-1">
					{row(t("dir.show_me"), t("dir.show_me_hint"), <Toggle
						checked={listed}
						label={t("dir.show_me")}
						disabled={save.isPending}
						onChange={(value) => {
							// This is the one people expect to work on its own, like the other switches.
							setListed(value);
							save.mutate(value, {
								onSuccess: () => toast.success(t(value ? "dir.toast_on" : "dir.toast_off")),
								onError: () => {
									setListed(!value);
									toast.error(t("toast.failed"), t("toast.try_again"));
								},
							});
						}}
					/>)}
					<div className="flex flex-col gap-2 border-t border-border py-3 text-[13px]">
						<b className="text-sm">{t("dir.name_shown")}</b>
						<label className="flex items-center gap-2">
							<input type="radio" name="name" className="size-4 accent-primary" checked={!useDisplay} onChange={() => setUseDisplay(false)} />
							{t("dir.my_name", { name: me.name })}
						</label>
						{rules.allowDisplayNames && (
							<label className="flex flex-wrap items-center gap-2">
								<input type="radio" name="name" className="size-4 accent-primary" checked={useDisplay} onChange={() => setUseDisplay(true)} />
								{t("dir.a_display_name")}
								<input
									aria-label={t("dir.a_display_name")}
									placeholder={t("dir.display_placeholder")}
									maxLength={60}
									value={displayName}
									className="h-8 w-40 rounded-md border border-input bg-card px-2"
									onChange={(event) => {
										setDisplayName(event.target.value);
										setUseDisplay(true);
									}}
								/>
								<span className="text-xs text-muted-foreground">{t(approved ? "dir.name_approved" : "dir.needs_approval")}</span>
							</label>
						)}
					</div>
					<div className="flex flex-col gap-2 border-t border-border py-3 text-[13px]">
						<b className="text-sm">{t("dir.picture")}</b>
						<div className="flex flex-wrap gap-2">
							{(["photo", "initials", "pattern"] as const).filter((value) => value !== "photo" || (rules.allowPhotos && me.photoUrl)).map((value) => (
								<label key={value} className={`flex items-center gap-2 rounded-[9px] border px-2.5 py-2 ${picture === value ? "border-primary bg-selected font-semibold" : "border-input"}`}>
									<input type="radio" name="picture" className="accent-primary" checked={picture === value} onChange={() => setPicture(value)} />
									{t(`dir.picture_${value}`)}
								</label>
							))}
						</div>
					</div>
					{row(t("dir.job_title"), me.position ?? t("dir.no_title"), <Toggle checked={showTitle} label={t("dir.job_title")} onChange={setShowTitle} />)}
					{row(t("dir.team"), me.team ?? t("users.no_department"), <Toggle checked={rules.showTeams && showTeam} disabled={!rules.showTeams} label={t("dir.team")} onChange={setShowTeam} />, rules.showTeams ? undefined : t("dir.team_hidden"))}
					<div className="border-t border-border py-3">
						<TextareaField label={t("dir.bio")} hint={t("dir.bio_count", { count: bio.length })} rows={2} maxLength={160} value={bio} onChange={(event) => setBio(event.target.value)} />
					</div>
				</section>
				<section className="rounded-card border border-border bg-card p-4 text-[13px]">
					<p>{t("dir.share_where")} <Link href="/capacity/skills" className="font-medium text-selected-foreground">{t("cb.skills_title")}</Link></p>
				</section>
				<section className="rounded-card border border-border bg-card p-4 text-[13px]">
					<h2 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{t("dir.never_shared")}</h2>
					<p className="mt-1">{t("dir.never_shared_text")}</p>
				</section>
			</div>
			<aside className="flex min-w-0 flex-col gap-2.5 lg:sticky lg:top-4">
				<h2 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{t("dir.preview")}</h2>
				<DirectoryCard
					card={{
						key: 0,
						name: previewName,
						isDisplayName: named,
						picture: previewPicture,
						photoUrl: me.photoUrl,
						position: showTitle ? me.position : null,
						team: rules.showTeams && showTeam ? me.team : null,
						bio: bio || null,
						skills: [],
						badges: [],
					}}
				/>
				<p className="text-xs text-muted-foreground">{t(!listed ? "dir.preview_hidden" : named && !approved ? "dir.preview_waiting" : "dir.preview_listed")}</p>
				{save.isError && <Alert>{t("error.generic")}</Alert>}
				{unsaved && !save.isPending ? (
					<p role="status" className="text-[13px] font-medium">{t("dir.unsaved")}</p>
				) : (
					save.isSuccess && <p role="status" className="text-[13px] text-muted-foreground">{t(save.data.displayNamePending ? "dir.saved_pending" : "common.saved")}</p>
				)}
				<div className="flex justify-end">
					<button type="button" disabled={save.isPending || (useDisplay && !displayName.trim())} className={buttonClass()} onClick={() => save.mutate(undefined)}>{t("common.save")}</button>
				</div>
			</aside>
		</div>
	);
}

export function DirectoryPrivacyPage() {
	const { t } = useI18n();
	const data = useQuery({ queryKey: ["directory-me"], queryFn: () => api<MyProfile>("/directory/me") });
	if (data.isPending) return <PageLoading />;
	if (data.isError) return <PageError onRetry={() => data.refetch()} />;
	return (
		<div className="flex flex-col gap-4 p-4 md:px-6 md:py-7">
			<PageHeader title={t("dir.privacy_title")} subtitle={t("dir.privacy_desc")} />
			<PrivacyForm data={data.data} />
		</div>
	);
}

export function DirectoryRulesTab() {
	const { t } = useI18n();
	const data = useQuery({
		queryKey: ["directory-settings"],
		queryFn: () => api<DirectorySettings>("/directory/settings"),
		retry: false,
	});
	const refresh = useRefreshDirectory();
	const save = useMutation({ mutationFn: (rules: Rules) => api("/directory/settings", { method: "PUT", body: rules }), onSuccess: refresh });
	if (data.isPending) return <PageLoading variant="inline" />;
	if (data.isError) return <StatePanel icon={Contact} title={t("dir.module_off")} description={t("dir.module_off_desc")} />;
	const { rules, pending } = data.data;
	const row = (key: keyof Rules, title: string, hint: string) => (
		<div className="flex items-center gap-3 border-t border-border py-3 first:border-t-0">
			<span className="min-w-0 flex-1"><b className="block">{title}</b><span className="block text-xs text-muted-foreground">{hint}</span></span>
			<Toggle checked={rules[key]} label={title} disabled={save.isPending} onChange={(value) => save.mutate({ ...rules, [key]: value })} />
		</div>
	);
	return (
		<div className="flex max-w-[760px] flex-col gap-4">
			<section className="rounded-card border border-border bg-card px-4 py-1">
				{row("allowDisplayNames", t("dir.rule_names"), t("dir.rule_names_hint"))}
				{row("showTeams", t("dir.rule_teams"), t("dir.rule_teams_hint"))}
				{row("allowPhotos", t("dir.rule_photos"), t("dir.rule_photos_hint"))}
			</section>
			<PendingNames pending={pending} />
		</div>
	);
}

// Organizations can use People & Skills without Capacity Building, so the rules
// need a home of their own.
export function DirectoryRulesPage() {
	const { t } = useI18n();
	return (
		<div className="flex flex-col gap-4 p-4 md:px-6 md:py-7">
			<PageHeader title={t("cb.tab_directory")} subtitle={t("dir.rules_desc")} action={<Link href="/directory" className={buttonClass("outline")}>{t("dir.title")}</Link>} />
			<DirectoryRulesTab />
		</div>
	);
}
