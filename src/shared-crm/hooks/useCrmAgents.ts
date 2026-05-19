/**
 * useCrmAgents — Lists internal staff agents available for assignment/transfer.
 * Joins user_roles with profiles to surface staff who can take a CRM contact.
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
      const { data: roles, error: rolesErr } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["employee", "field_sales", "supervisor", "admin", "sales"]);
      if (rolesErr) throw rolesErr;
      const ids = Array.from(new Set((roles ?? []).map((r: any) => r.user_id)));
      if (ids.length === 0) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .in("user_id", ids)
        .order("full_name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CrmAgent[];
    },
  });
}
