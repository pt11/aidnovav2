import { useQuery } from "@tanstack/react-query";
import { api } from "../api";

export interface CapacityMe {
	assessCount: number;
	reviewers: string[];
	inDepartment: boolean;
	canReview: boolean;
	reviewCount: number;
	isAdmin: boolean;
	reportScopes: string[];
}

export const CAPACITY_ME_KEY = ["capacity-me"];

export function useCapacityMe() {
	return useQuery({ queryKey: CAPACITY_ME_KEY, queryFn: () => api<CapacityMe>("/capacity/me") });
}
