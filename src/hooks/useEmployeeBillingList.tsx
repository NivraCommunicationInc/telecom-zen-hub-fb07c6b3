/**
 * useEmployeeBillingList - Server-side billing list with pagination
 * 
 * Fetches billing from the employee-operations/billing-list endpoint.
 * Respects permissions server-side.
 */

import { useQuery } from "@tanstack/react-query";
import { employeeClient } from "@/integrations/backend/employeeClient";

const EDGE_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/employee-operations/billing-list`;

interface BillingListResponse {
  success: boolean;
  billing: any[];
  total: number;
  page: number;
  pageSize: number;
  error?: string;
}

export const useEmployeeBillingList = (
  page: number = 0,
  pageSize: number = 50,
  status: string = "all",
  search: string = ""
) => {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["employee-billing-list", page, pageSize, status, search],
    queryFn: async (): Promise<BillingListResponse> => {
      const { data: sessionData } = await employeeClient.auth.getSession();
      if (!sessionData.session) {
        throw new Error("No session");
      }

      const response = await fetch(EDGE_FUNCTION_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${sessionData.session.access_token}`,
          "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ page, pageSize, status, search }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch billing");
      }

      return response.json();
    },
    staleTime: 30 * 1000,
    retry: 1,
  });

  return {
    billing: data?.billing || [],
    total: data?.total || 0,
    page: data?.page || 0,
    pageSize: data?.pageSize || pageSize,
    isLoading,
    error,
    refetch,
  };
};

export default useEmployeeBillingList;
