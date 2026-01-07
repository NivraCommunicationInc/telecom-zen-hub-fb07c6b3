/**
 * useEmployeeClientsList - Paginated, masked clients list
 * 
 * Fetches clients from server with PII masking and pagination.
 */

import { useQuery } from "@tanstack/react-query";
import { employeeClient } from "@/integrations/backend/employeeClient";

const EDGE_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/employee-operations/clients-list`;

interface ClientsListResponse {
  success: boolean;
  clients: any[];
  total: number;
  page: number;
  pageSize: number;
  error?: string;
}

export const useEmployeeClientsList = (
  page: number = 0,
  pageSize: number = 50,
  search: string = ""
) => {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["employee-clients-list", page, pageSize, search],
    queryFn: async (): Promise<ClientsListResponse> => {
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
        body: JSON.stringify({ page, pageSize, search }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch clients");
      }

      return response.json();
    },
    staleTime: 30 * 1000,
    retry: 1,
  });

  return {
    clients: data?.clients || [],
    total: data?.total || 0,
    page: data?.page || 0,
    pageSize: data?.pageSize || pageSize,
    isLoading,
    error,
    refetch,
  };
};

export default useEmployeeClientsList;
