import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, BarChart3, Check, Trash2, Upload } from "lucide-react";
import { api, ApiError } from "../api";
import { useI18n } from "../i18n";
import { Alert, buttonClass, DataTable, Modal, PageError, PageLoading, SelectField, StatePanel } from "../ui";
import { useProjectFiles } from "./ProjectFiles";

type Kind = "kpi_total" | "bar" | "line" | "donut" | "kpi_growth";

interface Widget {
	id: number;
	kind: Kind;
	title: string;
	series: {
		value?: number;
		points?: { label: string; value: number }[];
		parts?: { label: string; value: number }[];
		latest?: number;
		previous?: number;
		latestLabel?: string;
		previousLabel?: string;
		percent?: number | null;
	};
	fileId: number | null;
	fileVersion: number;
	fileName: string;
	checkedByName: string | null;
	stale: boolean;
}

interface TableData {
	name: string;
	version: number;
	columns: string[];
	rows: string[][];
	rowCount: number;
	numeric: boolean[];
	checks: { duplicates: number; empties: number; badTotals: number | null; formulas: boolean };
}

const KINDS: Kind[] = ["kpi_total", "bar", "donut", "line", "kpi_growth"];
const SLICE_VARS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"];
const number = (value: number) => value.toLocaleString("en");

function BarChart({ points, label }: { points: { label: string; value: number }[]; label: string }) {
	const top = Math.max(1, ...points.map((point) => point.value));
	// Every value is written on the bar only while there's room for it.
	const showValues = points.length <= 12;
	return (
		<div role="img" aria-label={label} className="flex h-44 items-end gap-1.5">
			{points.map((point) => (
				<div key={point.label} title={`${point.label}: ${number(point.value)}`} className="flex min-w-0 flex-1 flex-col items-center gap-1">
					{showValues && <span className="text-[11px] font-semibold">{number(point.value)}</span>}
					<div className="w-full max-w-10 rounded-t" style={{ height: `${(point.value / top) * 120}px`, background: "var(--chart-1)" }} />
					<span className="w-full truncate text-center text-[11px] text-muted-foreground">{point.label}</span>
				</div>
			))}
		</div>
	);
}

function LineChart({ points, label }: { points: { label: string; value: number }[]; label: string }) {
	const width = 320;
	const height = 130;
	const top = Math.max(1, ...points.map((point) => point.value));
	const x = (index: number) => (points.length > 1 ? 12 + (index / (points.length - 1)) * (width - 24) : width / 2);
	const y = (value: number) => height - 12 - (value / top) * (height - 28);
	const last = points[points.length - 1];
	return (
		<div>
			<svg role="img" aria-label={label} viewBox={`0 0 ${width} ${height}`} className="w-full">
				<line x1="12" x2={width - 12} y1={height - 12} y2={height - 12} stroke="var(--border)" />
				<polyline fill="none" stroke="var(--chart-1)" strokeWidth="2" strokeLinejoin="round" points={points.map((point, index) => `${x(index)},${y(point.value)}`).join(" ")} />
				{points.map((point, index) => (
					<circle key={point.label} cx={x(index)} cy={y(point.value)} r="4" fill="var(--chart-1)" stroke="var(--card)" strokeWidth="2">
						<title>{`${point.label}: ${number(point.value)}`}</title>
					</circle>
				))}
				{last && (
					<text x={Math.min(x(points.length - 1), width - 4)} y={Math.max(10, y(last.value) - 8)} textAnchor="end" fontSize="11" fontWeight="600" fill="currentColor">
						{number(last.value)}
					</text>
				)}
			</svg>
			<p className="flex justify-between text-[11px] text-muted-foreground">
				<span>{points[0]?.label}</span>
				<span>{last?.label}</span>
			</p>
		</div>
	);
}

function Donut({ parts, label }: { parts: { label: string; value: number }[]; label: string }) {
	const total = parts.reduce((sum, part) => sum + part.value, 0) || 1;
	const radius = 42;
	const circumference = 2 * Math.PI * radius;
	const lengths = parts.map((part) => (part.value / total) * circumference);
	return (
		<div className="flex flex-wrap items-center gap-4">
			<svg role="img" aria-label={label} viewBox="0 0 110 110" className="size-28 shrink-0 -rotate-90">
				{parts.map((part, index) => (
					// A small surface gap keeps neighbouring slices apart.
					<circle
						key={part.label}
						cx="55"
						cy="55"
						r={radius}
						fill="none"
						stroke={SLICE_VARS[index]}
						strokeWidth="16"
						strokeDasharray={`${Math.max(0, lengths[index] - 2)} ${circumference}`}
						strokeDashoffset={-lengths.slice(0, index).reduce((sum, length) => sum + length, 0)}
					>
						<title>{`${part.label}: ${number(part.value)}`}</title>
					</circle>
				))}
			</svg>
			<ul className="flex min-w-0 flex-col gap-1 text-[13px]">
				{parts.map((part, index) => (
					<li key={part.label} className="flex items-center gap-2">
						<span aria-hidden="true" className="size-2.5 shrink-0 rounded-sm" style={{ background: SLICE_VARS[index] }} />
						<span className="min-w-0 break-words">{part.label}</span>
						<b>{number(part.value)}</b>
						<span className="text-muted-foreground">({Math.round((part.value / total) * 100)}%)</span>
					</li>
				))}
			</ul>
		</div>
	);
}

function WidgetBody({ widget }: { widget: Pick<Widget, "kind" | "title" | "series"> }) {
	const { t } = useI18n();
	const { series, kind } = widget;
	if (kind === "kpi_total") {
		return <p className="text-[34px] font-semibold tracking-tight">{number(series.value ?? 0)}</p>;
	}
	if (kind === "kpi_growth") {
		const percent = series.percent;
		return (
			<div>
				<p className={`text-[34px] font-semibold tracking-tight ${percent !== null && percent !== undefined && percent < 0 ? "text-danger-foreground" : "text-[#14795A]"}`}>
					{percent === null || percent === undefined ? "—" : `${percent > 0 ? "+" : ""}${percent}%`}
				</p>
				<p className="text-[13px] text-muted-foreground">
					{t("pr.growth_detail", { latest: series.latestLabel ?? "", previous: series.previousLabel ?? "", latestValue: number(series.latest ?? 0), previousValue: number(series.previous ?? 0) })}
				</p>
			</div>
		);
	}
	if (kind === "donut") return <Donut parts={series.parts ?? []} label={widget.title} />;
	if (kind === "line") return <LineChart points={series.points ?? []} label={widget.title} />;
	return <BarChart points={series.points ?? []} label={widget.title} />;
}

const ERRORS: Record<string, string> = {
	NOT_CSV: "pr.widget_not_csv",
	TOO_BIG: "pr.widget_too_big",
	NO_ROWS: "pr.widget_no_rows",
	INVALID_WIDGETS: "pr.widget_invalid",
};

function BuildDialog({ projectId, initialFileId, onClose }: { projectId: number; initialFileId: number | null; onClose: () => void }) {
	const { t } = useI18n();
	const queryClient = useQueryClient();
	const files = useProjectFiles(projectId);
	const [fileId, setFileId] = useState(initialFileId);
	const [labelColumn, setLabelColumn] = useState<number | null>(null);
	const [valueColumns, setValueColumns] = useState<number[] | null>(null);
	const [kinds, setKinds] = useState<Kind[]>(["kpi_total", "bar"]);
	const table = useQuery({
		queryKey: ["project-table", projectId, fileId],
		queryFn: () => api<TableData>(`/projects/${projectId}/files/${fileId}/table`),
		enabled: fileId !== null,
		retry: false,
	});
	const data = table.data;
	const label = labelColumn ?? (data ? Math.max(0, data.numeric.findIndex((value) => !value)) : 0);
	const defaults = useMemo(
		() =>
			data
				? data.numeric.flatMap((value, index) => {
						const name = data.columns[index].toLowerCase();
						// A total column only checks the others, so counting it would double everything.
						const useful = value && index !== label && name !== "total" && !name.includes("year") && name !== "id";
						return useful ? [index] : [];
					})
				: [],
		[data, label],
	);
	const values = valueColumns ?? defaults;
	const publish = useMutation({
		mutationFn: () => api(`/projects/${projectId}/widgets`, { method: "POST", body: { fileId, labelColumn: label, valueColumns: values, kinds, title: data && values.map((index) => data.columns[index]).join(" + ") } }),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: ["project-widgets", projectId] });
			onClose();
		},
	});
	const csvFiles = files.data?.files.filter((file) => !file.orgFileId && (file.name ?? "").toLowerCase().endsWith(".csv")) ?? [];
	const tableCode = table.error instanceof ApiError ? table.error.code : "";
	const publishCode = publish.error instanceof ApiError ? publish.error.code : "";
	const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
	const check = (ok: boolean, text: string) => (
		<li key={text} className="flex items-start gap-2 text-[13px]">
			{ok ? <Check size={15} aria-label={t("cb.check_ok")} className="mt-0.5 shrink-0 text-[#14795A]" /> : <AlertTriangle size={15} aria-label={t("cb.check_look")} className="mt-0.5 shrink-0 text-[#B45309]" />}
			<span>{text}</span>
		</li>
	);
	const donutPossible = values.length >= 2;
	const growthPossible = !!data && data.rowCount >= 2;
	return (
		<Modal title={t("pr.build_widgets")} description={t("pr.build_desc")} open wide onClose={onClose}>
			<div className="flex flex-col gap-4">
				<SelectField
					label={t("pr.data_file")}
					value={fileId ?? ""}
					onChange={(event) => {
						setFileId(event.target.value ? Number(event.target.value) : null);
						setLabelColumn(null);
						setValueColumns(null);
					}}
				>
					<option value="">{t("cb.choose")}</option>
					{csvFiles.map((file) => <option key={file.id} value={file.id}>{`${file.name} · v${file.currentVersion}`}</option>)}
				</SelectField>
				{files.isSuccess && csvFiles.length === 0 && <p className="text-[13px] text-muted-foreground">{t("pr.no_csv")}</p>}
				{table.isError && <Alert>{t(ERRORS[tableCode] ?? "error.generic")}</Alert>}
				{table.isFetching && <PageLoading />}
				{data && (
					<>
						<section>
							<h3 className="mb-1.5 text-[13px] font-semibold">{t("pr.data_preview", { count: data.rowCount })}</h3>
							<DataTable minWidth={Math.min(720, data.columns.length * 120)} head={data.columns}>
								{data.rows.slice(0, 6).map((row, index) => (
									<tr key={index}>
										{row.map((cell, column) => <td key={column} className={`px-3 py-1.5 first:pl-4 last:pr-4 ${data.numeric[column] ? "tabular-nums" : ""}`}>{cell}</td>)}
									</tr>
								))}
							</DataTable>
						</section>
						<section>
							<h3 className="mb-1.5 text-[13px] font-semibold">{t("pr.data_checks")}</h3>
							<ul className="flex flex-col gap-1">
								{data.checks.badTotals !== null && check(data.checks.badTotals === 0, data.checks.badTotals === 0 ? t("pr.check_totals_ok") : t("pr.check_totals_bad", { count: data.checks.badTotals }))}
								{check(data.checks.duplicates === 0, data.checks.duplicates === 0 ? t("pr.check_no_duplicates") : t("pr.check_duplicates", { count: data.checks.duplicates }))}
								{check(data.checks.empties === 0, data.checks.empties === 0 ? t("pr.check_no_empties") : t("pr.check_empties", { count: data.checks.empties }))}
								{check(!data.checks.formulas, data.checks.formulas ? t("pr.check_formulas") : t("pr.check_no_formulas"))}
							</ul>
						</section>
						<section className="grid gap-3 sm:grid-cols-2">
							<SelectField label={t("pr.label_column")} value={label} onChange={(event) => setLabelColumn(Number(event.target.value))}>
								{data.columns.map((name, index) => <option key={index} value={index}>{name}</option>)}
							</SelectField>
							<fieldset>
								<legend className="mb-1.5 text-sm font-medium">{t("pr.value_columns")}</legend>
								<div className="flex flex-col gap-1 text-[13px]">
									{data.columns.map((name, index) =>
										data.numeric[index] && index !== label ? (
											<label key={index} className="flex items-center gap-2">
												<input type="checkbox" className="size-4 accent-primary" checked={values.includes(index)} onChange={() => setValueColumns(toggle(values, index))} />
												{name}
											</label>
										) : null,
									)}
								</div>
							</fieldset>
						</section>
						<section>
							<h3 className="mb-1.5 text-[13px] font-semibold">{t("pr.pick_widgets")}</h3>
							<div className="flex flex-wrap gap-2">
								{KINDS.map((kind) => {
									const possible = kind === "donut" ? donutPossible : kind === "kpi_growth" ? growthPossible : true;
									return (
										<label key={kind} className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-[13px] ${kinds.includes(kind) && possible ? "border-primary bg-selected font-medium" : "border-input"} ${possible ? "" : "opacity-50"}`}>
											<input type="checkbox" className="size-4 accent-primary" disabled={!possible} checked={kinds.includes(kind) && possible} onChange={() => setKinds(toggle(kinds, kind))} />
											{t(`pr.kind_${kind}`)}
										</label>
									);
								})}
							</div>
							<p className="mt-2 text-xs text-muted-foreground">{t("pr.widgets_note")}</p>
						</section>
						{publish.isError && <Alert>{t(ERRORS[publishCode] ?? "error.generic")}</Alert>}
					</>
				)}
				<div className="flex justify-end gap-2 border-t border-border pt-3.5">
					<button type="button" className={buttonClass("outline")} onClick={onClose}>{t("common.cancel")}</button>
					<button
						type="button"
						disabled={!data || values.length === 0 || kinds.filter((kind) => (kind === "donut" ? donutPossible : kind === "kpi_growth" ? growthPossible : true)).length === 0 || publish.isPending}
						className={buttonClass()}
						onClick={() => publish.mutate()}
					>
						{t("pr.publish_widgets")}
					</button>
				</div>
			</div>
		</Modal>
	);
}

export function ProjectDashboardTab({ projectId }: { projectId: number }) {
	const { t } = useI18n();
	const queryClient = useQueryClient();
	const [building, setBuilding] = useState<{ fileId: number | null } | null>(null);
	const widgets = useQuery({
		queryKey: ["project-widgets", projectId],
		queryFn: () => api<{ widgets: Widget[]; canManage: boolean }>(`/projects/${projectId}/widgets`),
	});
	const remove = useMutation({
		mutationFn: (id: number) => api(`/projects/${projectId}/widgets/${id}`, { method: "DELETE" }),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["project-widgets", projectId] }),
	});
	if (widgets.isPending) return <PageLoading />;
	if (widgets.isError) return <PageError onRetry={() => widgets.refetch()} />;
	const { widgets: list, canManage } = widgets.data;
	const stale = list.find((widget) => widget.stale);
	return (
		<div className="flex flex-col gap-3">
			{list.length > 0 && canManage && (
				<div className="flex justify-end">
					<button type="button" className={buttonClass()} onClick={() => setBuilding({ fileId: null })}>
						<Upload size={15} aria-hidden="true" />
						{t("pr.build_widgets")}
					</button>
				</div>
			)}
			{stale && (
				<div className="flex flex-wrap items-center gap-3 rounded-card border border-[#F59F0A] bg-warning-surface p-3 text-[13px]">
					<AlertTriangle size={16} aria-hidden="true" className="shrink-0" />
					<span className="min-w-0 flex-1">{t("pr.widgets_stale", { name: stale.fileName, version: stale.fileVersion })}</span>
					{canManage && <button type="button" className={buttonClass("outline", "min-h-8 px-3 py-0")} onClick={() => setBuilding({ fileId: stale.fileId })}>{t("pr.recheck")}</button>}
				</div>
			)}
			{list.length === 0 ? (
				<StatePanel
					icon={BarChart3}
					title={t("pr.no_widgets")}
					description={t(canManage ? "pr.no_widgets_desc" : "pr.no_widgets_staff")}
					action={canManage ? <button type="button" className={buttonClass()} onClick={() => setBuilding({ fileId: null })}>{t("pr.build_widgets")}</button> : undefined}
				/>
			) : (
				<div className="grid gap-3 md:grid-cols-2">
					{list.map((widget) => (
						<section key={widget.id} className="flex min-w-0 flex-col gap-3 rounded-card border border-border bg-card p-4">
							<div className="flex items-start justify-between gap-2">
								<div className="min-w-0">
									<h3 className="break-words text-[15px] font-semibold">{t(`pr.kind_${widget.kind}`)}</h3>
									<p className="break-words text-xs text-muted-foreground">{widget.title}</p>
								</div>
								{canManage && (
									<button type="button" aria-label={t("cb.remove_file", { name: t(`pr.kind_${widget.kind}`) })} className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted" onClick={() => remove.mutate(widget.id)}>
										<Trash2 size={14} aria-hidden="true" />
									</button>
								)}
							</div>
							<WidgetBody widget={widget} />
							{(widget.series.points || widget.series.parts) && (
								<table className="sr-only">
									<caption>{widget.title}</caption>
									<tbody>
										{(widget.series.points ?? widget.series.parts ?? []).map((row) => (
											<tr key={row.label}><th scope="row">{row.label}</th><td>{row.value}</td></tr>
										))}
									</tbody>
								</table>
							)}
							<p className="mt-auto border-t border-border pt-2 text-xs text-muted-foreground">
								{t("pr.widget_source", { name: widget.fileName, version: widget.fileVersion, person: widget.checkedByName ?? "—" })}
							</p>
						</section>
					))}
				</div>
			)}
			{building && <BuildDialog projectId={projectId} initialFileId={building.fileId} onClose={() => setBuilding(null)} />}
		</div>
	);
}
