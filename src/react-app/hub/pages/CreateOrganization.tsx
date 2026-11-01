import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError, ME_QUERY_KEY } from "../api";
import { useI18n } from "../i18n";
import { Alert, AuthCard, buttonClass, Field } from "../ui";

function toSlug(name: string) {
	return name
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 63);
}

const ERROR_KEYS: Record<string, string> = {
	SLUG_TAKEN: "org.slug_taken",
	ALREADY_OWNER: "org.already_owner",
};

export function CreateOrganizationPage() {
	const { t } = useI18n();
	const queryClient = useQueryClient();
	const [name, setName] = useState("");
	const [slug, setSlug] = useState("");
	const [slugEdited, setSlugEdited] = useState(false);

	const create = useMutation({
		mutationFn: () =>
			api("/organizations", { method: "POST", body: { name, slug } }),
		// A new admin's first steps are on the Dashboard, not the empty announcements feed.
		onSuccess: async () => {
			window.history.replaceState({}, "", "/dashboard");
			await queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
		},
	});

	function submit(event: FormEvent) {
		event.preventDefault();
		create.mutate();
	}

	const errorCode =
		create.error instanceof ApiError ? create.error.code : undefined;

	return (
		<AuthCard title={t("org.create_title")} subtitle={t("org.create_subtitle")}>
			<form onSubmit={submit} className="flex flex-col gap-4">
				{create.isError && (
					<Alert>{t(ERROR_KEYS[errorCode ?? ""] ?? "org.create_failed")}</Alert>
				)}
				<Field
					label={t("org.name")}
					placeholder={t("org.name_placeholder")}
					required
					minLength={2}
					maxLength={255}
					value={name}
					onChange={(event) => {
						setName(event.target.value);
						if (!slugEdited) setSlug(toSlug(event.target.value));
					}}
				/>
				<Field
					label={t("org.slug")}
					placeholder={t("org.slug_placeholder")}
					hint={t("org.slug_hint")}
					required
					minLength={2}
					maxLength={63}
					pattern="[a-z0-9]+(-[a-z0-9]+)*"
					value={slug}
					onChange={(event) => {
						setSlugEdited(true);
						setSlug(event.target.value);
					}}
				/>
				<button type="submit" disabled={create.isPending} className={buttonClass()}>
					{create.isPending ? t("org.creating") : t("org.create_button")}
				</button>
			</form>
		</AuthCard>
	);
}
