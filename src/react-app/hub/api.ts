import { useQuery } from "@tanstack/react-query";
import { twoFactorClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({ plugins: [twoFactorClient()] });

export type Role = "staff" | "manager" | "admin";
export type OrgAccess = "ok" | "trial_expired" | "blocked";

export interface Membership {
	organizationId: number;
	name: string;
	slug: string;
	logoUrl: string | null;
	photoUrl: string | null;
	role: Role;
	subscriptionStatus: "trial" | "active" | "suspended" | "cancelled";
	trialEndDate: string | null;
	assistantEnabled: boolean;
	// Set by the AidNova team for every organization at once.
	assistantPaused: boolean;
	access: OrgAccess;
}

export const canAsk = (org: Pick<Membership, "assistantEnabled" | "assistantPaused">) => org.assistantEnabled && !org.assistantPaused;

export interface Me {
	user: {
		id: string;
		name: string;
		email: string;
		isSuperAdmin: boolean;
		twoFactorEnabled: boolean;
	};
	activeOrganizationId: number | null;
	memberships: Membership[];
	activeModules: string[];
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

export interface Department {
	id: number;
	name: string;
	description: string | null;
	memberCount: number;
}

export const DEPARTMENTS_QUERY_KEY = ["departments"];

export function useDepartments() {
	return useQuery({
		queryKey: DEPARTMENTS_QUERY_KEY,
		queryFn: () => api<{ departments: Department[] }>("/organizations/current/departments"),
		select: (data) => data.departments,
	});
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
