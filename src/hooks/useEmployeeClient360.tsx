/**
 * useEmployeeClient360 - Server-side client data with PIN gate
 * 
 * Fetches client data from the employee-operations/client-360 endpoint.
 * Returns masked data if no unlock, full data if unlocked.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { employeeClient } from "@/integrations/backend/employeeClient";

const EDGE_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/employee-operations/client-360`;

interface Client360Response {
  success: boolean;
  unlocked: boolean;
  requiresPin?: boolean;
  unlockedAccountId?: string;
  profile: any;
  accounts: any[];
  orders: any[];
  billing: any[];
  tickets: any[];
  streaming: any[];
  error?: string;
}

export const useEmployeeClient360 = (clientId: string | null, accountId?: string) => {
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["employee-client-360", clientId, accountId],
    queryFn: async (): Promise<Client360Response> => {
      if (!clientId) {
        throw new Error("No client ID");
      }

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
        body: JSON.stringify({ clientId, accountId }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch client data");
      }

      return response.json();
    },
    enabled: !!clientId,
    staleTime: 30 * 1000, // 30 seconds - refresh frequently for unlock status
    retry: 1,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["employee-client-360", clientId] });
  };

  return {
    data,
    isLoading,
    error,
    refetch,
    invalidate,
    unlocked: data?.unlocked ?? false,
    requiresPin: data?.requiresPin ?? true,
    profile: data?.profile,
    accounts: data?.accounts || [],
    orders: data?.orders || [],
    billing: data?.billing || [],
    tickets: data?.tickets || [],
    streaming: data?.streaming || [],
  };
};

export default useEmployeeClient360;
