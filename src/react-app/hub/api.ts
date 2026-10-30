import { useQuery } from "@tanstack/react-query";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient();

export type Role = "staff" | "manager" | "admin";
export type OrgAccess = "ok" | "trial_expired" | "blocked";

export interface Membership {
	organizationId: number;
	name: string;
	slug: string;
	logoUrl: string | null;
	role: Role;
	subscriptionStatus: "trial" | "active" | "suspended" | "cancelled";
	trialEndDate: string | null;
	access: OrgAccess;
}

export interface Me {
	user: { id: string; name: string; email: string; isSuperAdmin: boolean };
	activeOrganizationId: number | null;
	memberships: Membership[];
}

export class ApiError extends Error {
	status: number;
	code: string;

	constructor(status: number, code: string, message: string) {
		super(message);
		this.status = status;
		this.code = code;
	}
}

export async function api<T>(
	path: string,
	options: { method?: string; body?: unknown } = {},
): Promise<T> {
	const response = await fetch(`/api${path}`, {
		method: options.method ?? "GET",
		headers:
			options.body === undefined
				? undefined
				: { "Content-Type": "application/json" },
		body: options.body === undefined ? undefined : JSON.stringify(options.body),
	});
	const data = (await response.json().catch(() => null)) as
		| (T & { code?: string; message?: string })
		| null;
	if (!response.ok) {
		throw new ApiError(
			response.status,
			data?.code ?? "UNKNOWN",
			data?.message ?? "Request failed",
		);
	}
	return data as T;
}

export const ME_QUERY_KEY = ["me"];

// Returns null when signed out, which is a normal state rather than an error.
export function useMe() {
	return useQuery({
		queryKey: ME_QUERY_KEY,
		retry: false,
		queryFn: async () => {
			try {
				return await api<Me>("/me");
			} catch (error) {
				if (error instanceof ApiError && error.status === 401) return null;
				throw error;
			}
		},
	});
}
