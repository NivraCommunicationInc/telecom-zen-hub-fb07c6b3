/**
 * useCrmAgents — Lists internal staff agents available for assignment/transfer.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CrmAgent {
  user_id: string;
  full_name: string | null;
  email: string | null;
}

export function useCrmAgents() {
  return useQuery({
    queryKey: ["crm-agents"],
    staleTime: 60_000,
    queryFn: async (): Promise<CrmAgent[]> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, account_type")
        .in("account_type", ["employee", "field_sales", "supervisor", "admin", "sales"])
        .order("full_name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CrmAgent[];
    },
  });
}
