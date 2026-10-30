import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Pencil, Plus, Trash2 } from "lucide-react";
import {
	api,
	ApiError,
	DEPARTMENTS_QUERY_KEY,
	ME_QUERY_KEY,
	useDepartments,
	type Department,
	type Membership,
} from "../api";
import { useI18n } from "../i18n";
import {
	Alert,
	buttonClass,
	ConfirmModal,
	Field,
	Modal,
	PageError,
	PageHeader,
	PageLoading,
	StatePanel,
	TextareaField,
} from "../ui";

interface OrgDetails {
	name: string;
	slug: string;
	email: string | null;
	phone: string | null;
	website: string | null;
	address: string | null;
}

const ORG_QUERY_KEY = ["organization"];
const ORG_ERROR_KEYS: Record<string, string> = {
	INVALID_EMAIL: "form.invalid_email",
	INVALID_WEBSITE: "form.invalid_link",
};

function OrganizationForm({
	details,
	canEdit,
}: {
	details: OrgDetails;
	canEdit: boolean;
}) {
	const { t } = useI18n();
	const queryClient = useQueryClient();
	const [values, setValues] = useState({
		name: details.name,
		email: details.email ?? "",
		phone: details.phone ?? "",
		website: details.website ?? "",
		address: details.address ?? "",
	});
	const save = useMutation({
		mutationFn: () =>
			api("/organizations/current", { method: "PATCH", body: values }),
		onSuccess: () =>
			Promise.all([
				queryClient.invalidateQueries({ queryKey: ORG_QUERY_KEY }),
				queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY }),
			]),
	});
	const set = (name: keyof typeof values) => (value: string) => {
		save.reset();
		setValues((current) => ({ ...current, [name]: value }));
	};
	const errorCode = save.error instanceof ApiError ? save.error.code : "";

	function submit(event: FormEvent) {
		event.preventDefault();
		save.mutate();
	}

	return (
		<form
			onSubmit={submit}
			className="flex flex-col gap-4 rounded-card border border-border bg-card p-5"
		>
			<div>
				<h2 className="font-semibold">{t("settings.organization")}</h2>
				{!canEdit && (
					<p className="mt-1 text-sm text-muted-foreground">
						{t("settings.admin_only")}
					</p>
				)}
			</div>
			{save.isError && (
				<Alert>{t(ORG_ERROR_KEYS[errorCode] ?? "error.generic")}</Alert>
			)}
			<Field
				label={t("org.name")}
				required
				minLength={2}
				maxLength={255}
				disabled={!canEdit}
				value={values.name}
				onChange={(event) => set("name")(event.target.value)}
			/>
			<Field
				label={t("org.slug")}
				disabled
				hint={t("settings.slug_hint")}
				value={details.slug}
				readOnly
			/>
			<div className="grid gap-4 sm:grid-cols-2">
				<Field
					label={t("users.email")}
					type="email"
					disabled={!canEdit}
					value={values.email}
					onChange={(event) => set("email")(event.target.value)}
				/>
				<Field
					label={t("settings.phone")}
					type="tel"
					maxLength={50}
					disabled={!canEdit}
					value={values.phone}
					onChange={(event) => set("phone")(event.target.value)}
				/>
			</div>
			<Field
				label={t("settings.website")}
				type="url"
				placeholder="https://"
				disabled={!canEdit}
				value={values.website}
				onChange={(event) => set("website")(event.target.value)}
			/>
			<TextareaField
				label={t("settings.address")}
				rows={3}
				maxLength={1000}
				disabled={!canEdit}
				value={values.address}
				onChange={(event) => set("address")(event.target.value)}
			/>
			{canEdit && (
				<div className="flex items-center gap-3">
					<button type="submit" disabled={save.isPending} className={buttonClass()}>
						{t("common.save")}
					</button>
					{save.isSuccess && (
						<p role="status" className="text-sm text-muted-foreground">
							{t("common.saved")}
						</p>
					)}
				</div>
			)}
		</form>
	);
}

function DepartmentForm({
	existing,
	onDone,
}: {
	existing: Department | null;
	onDone: () => void;
}) {
	const { t } = useI18n();
	const queryClient = useQueryClient();
	const [name, setName] = useState(existing?.name ?? "");
	const [description, setDescription] = useState(existing?.description ?? "");
	const save = useMutation({
		mutationFn: () =>
			api(
				existing
					? `/organizations/current/departments/${existing.id}`
					: "/organizations/current/departments",
				{
					method: existing ? "PATCH" : "POST",
					body: { name, description },
				},
			),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: DEPARTMENTS_QUERY_KEY });
			onDone();
		},
	});
	const errorCode = save.error instanceof ApiError ? save.error.code : "";

	function submit(event: FormEvent) {
		event.preventDefault();
		save.mutate();
	}

	return (
		<form onSubmit={submit} className="flex flex-col gap-4">
			{save.isError && (
				<Alert>
					{t(errorCode === "DEPARTMENT_EXISTS" ? "departments.exists" : "error.generic")}
				</Alert>
			)}
			<Field
				label={t("departments.name")}
				required
				maxLength={255}
				value={name}
				onChange={(event) => setName(event.target.value)}
			/>
			<TextareaField
				label={t("departments.description")}
				rows={3}
				maxLength={1000}
				value={description}
				onChange={(event) => setDescription(event.target.value)}
			/>
			<div className="flex justify-end gap-2">
				<button type="button" className={buttonClass("outline")} onClick={onDone}>
					{t("common.cancel")}
				</button>
				<button type="submit" disabled={save.isPending} className={buttonClass()}>
					{t("common.save")}
				</button>
			</div>
		</form>
	);
}

function DepartmentsSection() {
	const { t } = useI18n();
	const queryClient = useQueryClient();
	const departments = useDepartments();
	const [formOpen, setFormOpen] = useState(false);
	const [editing, setEditing] = useState<Department | null>(null);
	const [deleting, setDeleting] = useState<Department | null>(null);
	const remove = useMutation({
		mutationFn: (id: number) =>
			api(`/organizations/current/departments/${id}`, { method: "DELETE" }),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: DEPARTMENTS_QUERY_KEY });
			setDeleting(null);
		},
	});

	function closeForm() {
		setFormOpen(false);
		setEditing(null);
	}

	return (
		<section className="rounded-card border border-border bg-card p-5">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div>
					<h2 className="font-semibold">{t("departments.title")}</h2>
					<p className="mt-1 text-sm text-muted-foreground">
						{t("departments.subtitle")}
					</p>
				</div>
				<button
					type="button"
					className={buttonClass("outline")}
					onClick={() => setFormOpen(true)}
				>
					<Plus size={16} aria-hidden="true" />
					{t("departments.add")}
				</button>
			</div>

			{departments.isPending && <PageLoading />}
			{departments.isError && <PageError onRetry={() => departments.refetch()} />}
			{departments.data?.length === 0 && (
				<StatePanel
					icon={Building2}
					title={t("departments.empty_title")}
					description={t("departments.empty_desc")}
				/>
			)}
			{departments.data && departments.data.length > 0 && (
				<ul className="mt-4 divide-y divide-border border-t border-border">
					{departments.data.map((department) => (
						<li key={department.id} className="flex items-start justify-between gap-3 py-3">
							<div className="min-w-0">
								<p className="break-words text-sm font-medium">{department.name}</p>
								{department.description && (
									<p className="mt-0.5 break-words text-sm text-muted-foreground">
										{department.description}
									</p>
								)}
								<p className="mt-0.5 text-xs text-muted-foreground">
									{t("departments.members", { count: department.memberCount })}
								</p>
							</div>
							<div className="flex shrink-0 gap-1">
								<button
									type="button"
									aria-label={`${t("common.edit")}: ${department.name}`}
									className="grid size-9 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
									onClick={() => {
										setEditing(department);
										setFormOpen(true);
									}}
								>
									<Pencil size={15} aria-hidden="true" />
								</button>
								<button
									type="button"
									aria-label={`${t("common.delete")}: ${department.name}`}
									className="grid size-9 place-items-center rounded-md text-muted-foreground hover:bg-danger-surface hover:text-danger-foreground"
									onClick={() => {
										remove.reset();
										setDeleting(department);
									}}
								>
									<Trash2 size={15} aria-hidden="true" />
								</button>
							</div>
						</li>
					))}
				</ul>
			)}

			<Modal
				title={t(editing ? "departments.edit" : "departments.add")}
				open={formOpen}
				onClose={closeForm}
			>
				<DepartmentForm existing={editing} onDone={closeForm} />
			</Modal>
			<ConfirmModal
				title={t("departments.delete_title")}
				description={t("departments.delete_desc", { name: deleting?.name ?? "" })}
				confirmLabel={t("common.delete")}
				open={deleting !== null}
				pending={remove.isPending}
				failed={remove.isError}
				onConfirm={() => deleting && remove.mutate(deleting.id)}
				onClose={() => setDeleting(null)}
			/>
		</section>
	);
}

export function SettingsPage({ org }: { org: Membership }) {
	const { t } = useI18n();
	const details = useQuery({
		queryKey: ORG_QUERY_KEY,
		queryFn: () => api<OrgDetails>("/organizations/current"),
	});

	if (details.isPending) return <PageLoading />;
	if (details.isError) return <PageError onRetry={() => details.refetch()} />;

	return (
		<div className="mx-auto max-w-3xl p-4 md:p-6">
			<PageHeader title={t("nav.settings")} subtitle={t("settings.subtitle")} />
			<div className="mt-5 flex flex-col gap-5">
				<OrganizationForm details={details.data} canEdit={org.role === "admin"} />
				<DepartmentsSection />
			</div>
		</div>
	);
}
