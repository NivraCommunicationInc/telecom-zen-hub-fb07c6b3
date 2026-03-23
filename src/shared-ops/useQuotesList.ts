/**
 * Shared hook: fetches quotes list with filters.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useQuotesList(filters?: {
  status?: string;
  sourcePortal?: string;
  limit?: number;
}) {
  return useQuery({
    queryKey: ["quotes-list", filters],
    queryFn: async () => {
      let query = supabase
        .from("quotes" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(filters?.limit || 200);

      if (filters?.status) {
        query = query.eq("status", filters.status);
      }
      if (filters?.sourcePortal) {
        query = query.eq("source_portal", filters.sourcePortal);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });
}
