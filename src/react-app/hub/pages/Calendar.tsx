import { useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, ChevronLeft, ChevronRight, ChevronDown, Plus } from "lucide-react";
import { Link } from "wouter";
import { api, ApiError } from "../api";
import { useI18n } from "../i18n";
import {
	ActionsMenu,
	Alert,
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
	TextareaField,
} from "../ui";

type EventType = "training" | "meeting" | "deadline" | "holiday";

interface CalendarEvent {
	id: number;
	title: string;
	type: EventType;
	startsAt: string;
	endsAt: string;
	allDay: boolean;
	location: string | null;
	meetingUrl: string | null;
	details: string | null;
	createdByName?: string | null;
}

interface PolicyReview {
	id: number;
	title: string;
	reviewDate: string;
}

export const EVENT_TYPES: EventType[] = ["training", "meeting", "deadline", "holiday"];
const EVENTS_KEY = ["events"];
const MAX_IN_CELL = 2;
const CHIP_TONES = { training: "primary", meeting: "neutral", deadline: "outline", holiday: "neutral" } as const;

function pad(value: number) {
	return String(value).padStart(2, "0");
}

function localKey(date: Date) {
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// All-day events are stored at midnight UTC, so their dates are read in UTC.
function dayKeys(event: Pick<CalendarEvent, "startsAt" | "endsAt" | "allDay">) {
	const start = new Date(event.startsAt);
	const end = new Date(event.endsAt);
	return event.allDay
		? [start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)]
		: [localKey(start), localKey(end)];
}

function occursOn(event: CalendarEvent, key: string) {
	const [first, last] = dayKeys(event);
	return first <= key && key <= last;
}

function timeOf(value: string, language: string) {
	return new Date(value).toLocaleTimeString(language, {
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	});
}

function gridDays(month: Date) {
	const first = new Date(month.getFullYear(), month.getMonth(), 1);
	// Weeks start on Monday.
	const lead = (first.getDay() + 6) % 7;
	const start = new Date(first);
	start.setDate(first.getDate() - lead);
	const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
	const trail = 6 - ((last.getDay() + 6) % 7);
	const total = lead + last.getDate() + trail;
	return Array.from({ length: total }, (_, index) => {
		const day = new Date(start);
		day.setDate(start.getDate() + index);
		return day;
	});
}

function TypeMark({ type }: { type: EventType }) {
	const shapes: Record<EventType, string> = {
		training: "size-2 rounded-[2px] bg-primary",
		meeting: "size-2 rounded-full bg-[#753FF3]",
		deadline: "size-2 rotate-45 bg-foreground",
		holiday: "h-0.5 w-2.5 bg-muted-foreground",
	};
	return <span aria-hidden="true" className={`inline-block shrink-0 ${shapes[type]}`} />;
}

function eventBarClass(type: EventType) {
	const styles: Record<EventType, string> = {
		training: "bg-primary text-primary-foreground",
		meeting: "bg-[#753FF3] text-white",
		deadline: "border border-foreground text-foreground",
		holiday: "text-muted-foreground",
	};
	return `block w-full truncate rounded px-1.5 py-px text-left text-xs font-medium ${styles[type]}`;
}

function calendarStamp(value: string, allDay: boolean) {
	const iso = new Date(value).toISOString();
	return allDay ? iso.slice(0, 10).replace(/-/g, "") : iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

// Calendar apps treat an all-day end date as the day after the event finishes.
function exclusiveEnd(event: CalendarEvent) {
	const end = new Date(event.endsAt);
	if (event.allDay) end.setUTCDate(end.getUTCDate() + 1);
	return end.toISOString();
}

function googleLink(event: CalendarEvent) {
	const query = new URLSearchParams({
		action: "TEMPLATE",
		text: event.title,
		dates: `${calendarStamp(event.startsAt, event.allDay)}/${calendarStamp(exclusiveEnd(event), event.allDay)}`,
		details: [event.details, event.meetingUrl].filter(Boolean).join("\n\n"),
		location: event.location ?? "",
	});
	return `https://calendar.google.com/calendar/render?${query}`;
}

function outlookLink(event: CalendarEvent) {
	const query = new URLSearchParams({
		path: "/calendar/action/compose",
		rru: "addevent",
		subject: event.title,
		startdt: event.allDay ? event.startsAt.slice(0, 10) : event.startsAt,
		enddt: event.allDay ? exclusiveEnd(event).slice(0, 10) : event.endsAt,
		body: [event.details, event.meetingUrl].filter(Boolean).join("\n\n"),
		location: event.location ?? "",
		...(event.allDay ? { allday: "true" } : {}),
	});
	return `https://outlook.office.com/calendar/0/deeplink/compose?${query}`;
}

function icsText(value: string) {
	return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

function downloadIcs(event: CalendarEvent) {
	const dateLine = (name: string, value: string) =>
		event.allDay
			? `${name};VALUE=DATE:${calendarStamp(value, true)}`
			: `${name}:${calendarStamp(value, false)}`;
	const lines = [
		"BEGIN:VCALENDAR",
		"VERSION:2.0",
		"PRODID:-//AidNova//Calendar//EN",
		"BEGIN:VEVENT",
		`UID:aidnova-event-${event.id}@hub.aidnova.app`,
		`DTSTAMP:${calendarStamp(new Date().toISOString(), false)}`,
		dateLine("DTSTART", event.startsAt),
		dateLine("DTEND", exclusiveEnd(event)),
		`SUMMARY:${icsText(event.title)}`,
		...(event.location ? [`LOCATION:${icsText(event.location)}`] : []),
		...(event.details || event.meetingUrl
			? [`DESCRIPTION:${icsText([event.details, event.meetingUrl].filter(Boolean).join("\n\n"))}`]
			: []),
		"END:VEVENT",
		"END:VCALENDAR",
	];
	const url = URL.createObjectURL(new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" }));
	const link = document.createElement("a");
	link.href = url;
	link.download = "event.ics";
	link.click();
	URL.revokeObjectURL(url);
}

function toLocalInput(value: Date) {
	return `${localKey(value)}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

function EventDialog({
	existing,
	day,
	onClose,
}: {
	existing: CalendarEvent | null;
	day: string;
	onClose: () => void;
}) {
	const { t } = useI18n();
	const queryClient = useQueryClient();
	const [title, setTitle] = useState(existing?.title ?? "");
	const [type, setType] = useState<EventType>(existing?.type ?? "meeting");
	const [allDay, setAllDay] = useState(existing?.allDay ?? false);
	const [starts, setStarts] = useState(() =>
		existing
			? existing.allDay
				? existing.startsAt.slice(0, 16)
				: toLocalInput(new Date(existing.startsAt))
			: `${day}T09:00`,
	);
	const [ends, setEnds] = useState(() =>
		existing
			? existing.allDay
				? existing.endsAt.slice(0, 16)
				: toLocalInput(new Date(existing.endsAt))
			: `${day}T10:00`,
	);
	const [location, setLocation] = useState(existing?.location ?? "");
	const [meetingUrl, setMeetingUrl] = useState(existing?.meetingUrl ?? "");
	const [details, setDetails] = useState(existing?.details ?? "");
	const save = useMutation({
		mutationFn: () =>
			api(existing ? `/events/${existing.id}` : "/events", {
				method: existing ? "PATCH" : "POST",
				body: {
					title,
					type,
					allDay,
					location,
					meetingUrl,
					details,
					startsAt: allDay ? `${starts.slice(0, 10)}T00:00:00.000Z` : new Date(starts).toISOString(),
					endsAt: allDay ? `${ends.slice(0, 10)}T00:00:00.000Z` : new Date(ends).toISOString(),
				},
			}),
		onSuccess: async () => {
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: EVENTS_KEY }),
				queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
			]);
			onClose();
		},
	});
	const code = save.error instanceof ApiError ? save.error.code : "";
	const endsBefore = allDay ? ends.slice(0, 10) < starts.slice(0, 10) : ends < starts;
	const linkBad = meetingUrl.trim() !== "" && !/^https:\/\/\S+$/.test(meetingUrl.trim());

	function submit(event: FormEvent) {
		event.preventDefault();
		if (!endsBefore && !linkBad) save.mutate();
	}

	return (
		<Modal title={t(existing ? "calendar.edit" : "calendar.new")} open wide onClose={onClose}>
			<form onSubmit={submit} className="flex flex-col gap-3.5">
				{save.isError && (
					<Alert>{t(code === "INVALID_LINK" ? "calendar.link_invalid" : "error.generic")}</Alert>
				)}
				<Field
					label={t("calendar.field_title")}
					required
					autoFocus
					maxLength={200}
					value={title}
					onChange={(event) => setTitle(event.target.value)}
				/>
				<fieldset>
					<legend className="pb-1.5 text-sm font-medium">{t("calendar.field_type")}</legend>
					<div className="flex flex-wrap gap-1.5">
						{EVENT_TYPES.map((option) => (
							<label
								key={option}
								className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1 text-[13px] ${
									type === option ? "border-2 border-primary font-medium" : "border border-input"
								}`}
							>
								<input
									type="radio"
									name="event-type"
									className="accent-primary"
									checked={type === option}
									onChange={() => setType(option)}
								/>
								{t(`calendar.type_${option}`)}
							</label>
						))}
					</div>
				</fieldset>
				<div className="grid gap-3 sm:grid-cols-2">
					<Field
						label={t("calendar.starts")}
						type={allDay ? "date" : "datetime-local"}
						required
						value={allDay ? starts.slice(0, 10) : starts}
						onChange={(event) =>
							setStarts(allDay ? `${event.target.value}T00:00` : event.target.value)
						}
					/>
					<Field
						label={t("calendar.ends")}
						type={allDay ? "date" : "datetime-local"}
						required
						error={endsBefore ? t("calendar.end_before") : undefined}
						value={allDay ? ends.slice(0, 10) : ends}
						onChange={(event) =>
							setEnds(allDay ? `${event.target.value}T00:00` : event.target.value)
						}
					/>
				</div>
				<label className="flex items-center gap-2 text-[13px]">
					<input
						type="checkbox"
						className="size-4 accent-primary"
						checked={allDay}
						onChange={(event) => setAllDay(event.target.checked)}
					/>
					{t("calendar.all_day")}
				</label>
				<Field
					label={t("calendar.location")}
					maxLength={300}
					value={location}
					onChange={(event) => setLocation(event.target.value)}
				/>
				<Field
					label={t("calendar.online")}
					type="url"
					hint={t("calendar.online_hint")}
					error={linkBad ? t("calendar.link_invalid") : undefined}
					placeholder="https://meet.google.com/…"
					maxLength={2000}
					value={meetingUrl}
					onChange={(event) => setMeetingUrl(event.target.value)}
				/>
				<TextareaField
					label={t("calendar.details")}
					rows={3}
					maxLength={2000}
					placeholder={t("calendar.details_placeholder")}
					value={details}
					onChange={(event) => setDetails(event.target.value)}
				/>
				<p className="rounded-md bg-background px-3 py-2.5 text-[13px]">{t("calendar.notice")}</p>
				<div className="flex justify-end gap-2 border-t border-border pt-3.5">
					<button type="button" className={buttonClass("outline")} onClick={onClose}>
						{t("common.cancel")}
					</button>
					<button type="submit" disabled={save.isPending || endsBefore || linkBad} className={buttonClass()}>
						{t(existing ? "common.save" : "calendar.create")}
					</button>
				</div>
			</form>
		</Modal>
	);
}

function EventDetails({
	event,
	canManage,
	onEdit,
	onDelete,
}: {
	event: CalendarEvent;
	canManage: boolean;
	onEdit: () => void;
	onDelete: () => void;
}) {
	const { t, language } = useI18n();
	const dateOptions = { day: "numeric", month: "short", year: "numeric" } as const;
	const [first, last] = dayKeys(event);
	const when = event.allDay
		? first === last
			? t("calendar.all_day")
			: `${new Date(event.startsAt).toLocaleDateString(language, { ...dateOptions, timeZone: "UTC" })} – ${new Date(event.endsAt).toLocaleDateString(language, { ...dateOptions, timeZone: "UTC" })}`
		: first === last
			? `${timeOf(event.startsAt, language)} – ${timeOf(event.endsAt, language)}`
			: `${new Date(event.startsAt).toLocaleDateString(language, dateOptions)} ${timeOf(event.startsAt, language)} – ${new Date(event.endsAt).toLocaleDateString(language, dateOptions)} ${timeOf(event.endsAt, language)}`;
	const rows: { label: string; value: ReactNode }[] = [
		{ label: t("calendar.when"), value: when },
		...(event.location ? [{ label: t("calendar.where"), value: event.location }] : []),
		...(event.meetingUrl
			? [
					{
						label: t("calendar.online_short"),
						value: (
							<a href={event.meetingUrl} target="_blank" rel="noreferrer noopener" className="break-all">
								{event.meetingUrl.replace(/^https:\/\//, "")}
							</a>
						),
					},
				]
			: []),
	];
	return (
		<div className="flex flex-col gap-3">
			<div>
				<Chip tone={CHIP_TONES[event.type]}>{t(`calendar.type_${event.type}`)}</Chip>
				<h2 className="mt-1.5 break-words text-lg font-semibold leading-[26px]">{event.title}</h2>
			</div>
			<dl className="flex flex-col gap-2 text-[13px]">
				{rows.map((row) => (
					<div key={row.label} className="flex gap-2.5">
						<dt className="w-[70px] shrink-0 text-muted-foreground">{row.label}</dt>
						<dd className="min-w-0">{row.value}</dd>
					</div>
				))}
			</dl>
			{event.details && <p className="whitespace-pre-wrap break-words text-[13px]">{event.details}</p>}
			<div className="flex flex-wrap items-center gap-2">
				<ActionsMenu
					label={t("calendar.add_to")}
					triggerLabel={t("calendar.add_to")}
					triggerIcon={<ChevronDown size={14} aria-hidden="true" />}
					triggerClass={buttonClass("outline", BUTTON_SMALL)}
					actions={[
						{ label: "Google Calendar", href: googleLink(event), newTab: true },
						{ label: "Outlook", href: outlookLink(event), newTab: true },
						{ label: t("calendar.download_ics"), onSelect: () => downloadIcs(event) },
					]}
				/>
				{canManage && (
					<>
						<button type="button" className={buttonClass("outline", BUTTON_SMALL)} onClick={onEdit}>
							{t("common.edit")}
						</button>
						<button type="button" className={buttonClass("dangerGhost", BUTTON_SMALL)} onClick={onDelete}>
							{t("common.delete")}…
						</button>
					</>
				)}
			</div>
		</div>
	);
}

export function CalendarPage({ canManage }: { canManage: boolean }) {
	const { t, language } = useI18n();
	const queryClient = useQueryClient();
	const [today] = useState(() => localKey(new Date()));
	const [month, setMonth] = useState(() => {
		const now = new Date();
		return new Date(now.getFullYear(), now.getMonth(), 1);
	});
	const [view, setView] = useState<"month" | "agenda">(() =>
		window.matchMedia("(max-width: 767px)").matches ? "agenda" : "month",
	);
	const [selectedDay, setSelectedDay] = useState(today);
	const [selectedId, setSelectedId] = useState<number | null>(null);
	const [editing, setEditing] = useState<CalendarEvent | "new" | null>(null);
	const [deleting, setDeleting] = useState<CalendarEvent | null>(null);

	const days = gridDays(month);
	const from = days[0].getTime() - 86_400_000;
	const to = days[days.length - 1].getTime() + 2 * 86_400_000;
	const events = useQuery({
		queryKey: [...EVENTS_KEY, from],
		queryFn: () =>
			api<{ events: CalendarEvent[]; policyReviews: PolicyReview[] }>(`/events?from=${from}&to=${to}`),
	});
	const remove = useMutation({
		mutationFn: (id: number) => api(`/events/${id}`, { method: "DELETE" }),
		onSuccess: async () => {
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: EVENTS_KEY }),
				queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
			]);
			setDeleting(null);
			setSelectedId(null);
		},
	});

	const list = events.data?.events ?? [];
	const reviews = events.data?.policyReviews ?? [];
	const reviewsOn = (key: string) => reviews.filter((review) => review.reviewDate.slice(0, 10) === key);
	const eventsOn = (key: string) => list.filter((event) => occursOn(event, key));
	const selectedEvents = eventsOn(selectedDay);
	const selected =
		list.find((event) => event.id === selectedId && occursOn(event, selectedDay)) ?? selectedEvents[0] ?? null;
	const others = selectedEvents.filter((event) => event.id !== selected?.id);
	const monthKey = `${month.getFullYear()}-${pad(month.getMonth() + 1)}`;
	const agendaDays = days
		.map(localKey)
		.filter((key) => key.startsWith(monthKey) && (eventsOn(key).length > 0 || reviewsOn(key).length > 0));
	const longDate = (key: string) =>
		new Date(`${key}T12:00:00`).toLocaleDateString(language, { weekday: "long", day: "numeric", month: "long" });
	const shiftMonth = (change: number) => {
		setMonth(new Date(month.getFullYear(), month.getMonth() + change, 1));
		setSelectedId(null);
	};
	const pickDay = (key: string, id: number | null = null) => {
		setSelectedDay(key);
		setSelectedId(id);
	};
	const newEventDay = selectedDay.startsWith(monthKey) ? selectedDay : `${monthKey}-01`;
	const weekdays = Array.from({ length: 7 }, (_, index) =>
		new Date(2024, 0, 1 + index).toLocaleDateString(language, { weekday: "short" }),
	);

	return (
		<div className="mx-auto flex max-w-[1400px] flex-col gap-4 p-4 md:px-6 md:py-7">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div className="flex flex-wrap items-center gap-2.5">
					<h1 className="text-[26px] font-semibold leading-[34px] tracking-tight">
						{month.toLocaleDateString(language, { month: "long", year: "numeric" })}
					</h1>
					<div className="inline-flex overflow-hidden rounded-md border border-input bg-card">
						<button
							type="button"
							aria-label={t("calendar.previous")}
							className="grid size-9 place-items-center hover:bg-muted"
							onClick={() => shiftMonth(-1)}
						>
							<ChevronLeft size={16} aria-hidden="true" />
						</button>
						<button
							type="button"
							className="border-x border-input px-3 text-[13px] font-medium hover:bg-muted"
							onClick={() => {
								const now = new Date();
								setMonth(new Date(now.getFullYear(), now.getMonth(), 1));
								pickDay(today);
							}}
						>
							{t("calendar.today")}
						</button>
						<button
							type="button"
							aria-label={t("calendar.next")}
							className="grid size-9 place-items-center hover:bg-muted"
							onClick={() => shiftMonth(1)}
						>
							<ChevronRight size={16} aria-hidden="true" />
						</button>
					</div>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<Segmented
						label={t("calendar.view")}
						options={[
							{ value: "month", label: t("calendar.month") },
							{ value: "agenda", label: t("calendar.agenda") },
						]}
						value={view}
						onChange={setView}
					/>
					{canManage && (
						<button type="button" className={buttonClass()} onClick={() => setEditing("new")}>
							<Plus size={16} aria-hidden="true" />
							{t("calendar.new")}
						</button>
					)}
				</div>
			</div>
			<ul aria-label={t("calendar.field_type")} className="flex flex-wrap gap-2 text-xs">
				{EVENT_TYPES.map((type) => (
					<li key={type} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-0.5">
						<TypeMark type={type} />
						{t(`calendar.type_${type}`)}
					</li>
				))}
			</ul>

			{events.isPending && <PageLoading variant="inline" />}
			{events.isError && <PageError onRetry={() => events.refetch()} />}
			{events.data && (
				<div className="flex flex-wrap items-start gap-4">
					<div className="min-w-0 flex-[999_1_560px]">
						{view === "month" ? (
							<div className="overflow-x-auto rounded-card border border-border bg-card">
								<div className="min-w-[640px]">
									<div className="grid grid-cols-7 border-b border-border text-xs font-semibold text-muted-foreground">
										{weekdays.map((name) => (
											<span key={name} className="px-2.5 py-2">{name}</span>
										))}
									</div>
									<div className="grid grid-cols-7">
										{days.map((day, index) => {
											const key = localKey(day);
											const inMonth = key.startsWith(monthKey);
											const dayEvents = eventsOn(key);
											const dayReviews = reviewsOn(key);
											const shown = dayEvents.slice(0, MAX_IN_CELL);
											const more = dayEvents.length - shown.length;
											const isSelected = key === selectedDay;
											return (
												<div
													key={key}
													className={`flex min-h-[104px] min-w-0 flex-col gap-0.5 border-border p-1.5 ${index % 7 !== 6 ? "border-r" : ""} ${index < days.length - 7 ? "border-b" : ""} ${isSelected ? "bg-background ring-2 ring-inset ring-primary" : ""}`}
												>
													<button
														type="button"
														aria-label={longDate(key)}
														aria-pressed={isSelected}
														onClick={() => pickDay(key)}
														className={`self-start rounded-full px-1.5 text-xs ${
															key === today
																? "bg-foreground font-semibold text-background"
																: isSelected
																	? "font-semibold"
																	: inMonth
																		? ""
																		: "text-muted-foreground"
														}`}
													>
														{day.getDate()}
													</button>
													{shown.map((event) => (
														<button
															key={event.id}
															type="button"
															className={eventBarClass(event.type)}
															onClick={() => pickDay(key, event.id)}
														>
															{event.type === "deadline" && "◆ "}
															{event.type === "holiday" && "— "}
															{!event.allDay && dayKeys(event)[0] === key && `${timeOf(event.startsAt, language)} `}
															{event.title}
														</button>
													))}
													{more > 0 && (
														<button
															type="button"
															className="px-1.5 text-left text-xs font-semibold text-selected-foreground"
															onClick={() => pickDay(key)}
														>
															{t("calendar.more", { count: more })}
														</button>
													)}
													{dayReviews.slice(0, 1).map((review) => (
														<Link
															key={review.id}
															href={`/policies/${review.id}`}
															className="block truncate rounded border border-foreground px-1.5 text-xs font-medium text-foreground no-underline"
														>
															◆ {review.title}
														</Link>
													))}
												</div>
											);
										})}
									</div>
								</div>
							</div>
						) : agendaDays.length === 0 ? (
							<div className="rounded-card border border-border bg-card">
								<StatePanel
									icon={CalendarDays}
									title={t("calendar.empty_title")}
									description={t(canManage ? "calendar.empty_manager" : "calendar.empty_staff")}
								/>
							</div>
						) : (
							<ul className="flex flex-col gap-3">
								{agendaDays.map((key) => (
									<li key={key} className="overflow-hidden rounded-card border border-border bg-card">
										<h2 className={`border-b border-border px-4 py-2.5 text-[13px] font-semibold ${key === today ? "text-selected-foreground" : ""}`}>
											{longDate(key)}
										</h2>
										<ul className="divide-y divide-border">
											{eventsOn(key).map((event) => (
												<li key={event.id}>
													<button
														type="button"
														className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-left hover:bg-muted/40 ${selected?.id === event.id && selectedDay === key ? "bg-background" : ""}`}
														onClick={() => pickDay(key, event.id)}
													>
														<TypeMark type={event.type} />
														<span className="min-w-0 flex-1">
															<span className="block break-words font-medium">{event.title}</span>
															<span className="block text-xs text-muted-foreground">
																{[
																	event.allDay ? t("calendar.all_day") : `${timeOf(event.startsAt, language)} – ${timeOf(event.endsAt, language)}`,
																	event.location,
																]
																	.filter(Boolean)
																	.join(" · ")}
															</span>
														</span>
													</button>
												</li>
											))}
											{reviewsOn(key).map((review) => (
												<li key={`review-${review.id}`}>
													<Link href={`/policies/${review.id}`} className="flex items-center gap-2.5 px-4 py-2.5 text-foreground no-underline hover:bg-muted/40">
														<TypeMark type="deadline" />
														<span className="min-w-0 flex-1 break-words font-medium">
															{t("calendar.policy_review", { title: review.title })}
														</span>
													</Link>
												</li>
											))}
										</ul>
									</li>
								))}
							</ul>
						)}
					</div>
					<aside
						aria-label={t("calendar.selected")}
						className="flex min-w-0 flex-[1_1_300px] flex-col gap-3 rounded-card border border-border bg-card p-4 xl:max-w-[360px]"
					>
						<p className="text-xs text-muted-foreground">
							{longDate(selectedDay)} · {t(selectedEvents.length === 1 ? "calendar.one_event" : "calendar.count_events", { count: selectedEvents.length })}
						</p>
						{selected ? (
							<EventDetails
								key={selected.id}
								event={selected}
								canManage={canManage}
								onEdit={() => setEditing(selected)}
								onDelete={() => {
									remove.reset();
									setDeleting(selected);
								}}
							/>
						) : (
							<p className="text-muted-foreground">{t("calendar.nothing_on_day")}</p>
						)}
						{others.map((event) => (
							<button
								key={event.id}
								type="button"
								className="flex items-center gap-2.5 border-t border-border pt-3 text-left"
								onClick={() => setSelectedId(event.id)}
							>
								<TypeMark type={event.type} />
								<span className="min-w-0">
									<span className="block break-words font-semibold">{event.title}</span>
									<span className="block text-[13px] text-muted-foreground">
										{event.allDay ? t("calendar.all_day") : `${timeOf(event.startsAt, language)} – ${timeOf(event.endsAt, language)}`}
									</span>
								</span>
							</button>
						))}
						{reviewsOn(selectedDay).map((review) => (
							<Link key={review.id} href={`/policies/${review.id}`} className="flex items-center gap-2.5 border-t border-border pt-3 text-foreground no-underline hover:underline">
								<TypeMark type="deadline" />
								<span className="min-w-0 break-words text-[13px] font-medium">
									{t("calendar.policy_review", { title: review.title })}
								</span>
							</Link>
						))}
					</aside>
				</div>
			)}

			{editing && (
				<EventDialog
					key={editing === "new" ? "new" : editing.id}
					existing={editing === "new" ? null : editing}
					day={newEventDay}
					onClose={() => setEditing(null)}
				/>
			)}
			<ConfirmModal
				title={t("calendar.delete_title", { title: deleting?.title ?? "" })}
				description={t("calendar.delete_desc")}
				confirmLabel={t("common.delete")}
				open={deleting !== null}
				pending={remove.isPending}
				failed={remove.isError}
				onConfirm={() => deleting && remove.mutate(deleting.id)}
				onClose={() => setDeleting(null)}
			/>
		</div>
	);
}
