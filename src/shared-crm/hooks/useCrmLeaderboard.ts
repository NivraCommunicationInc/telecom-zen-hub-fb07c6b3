/**
 * useCrmLeaderboard — Realtime top agents stats.
 */
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CrmLeaderboardEntry } from "../lib/crmTypes";

export function useCrmLeaderboard() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["crm-leaderboard"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_leaderboard_v" as never)
        .select("*")
        .order("sales_today", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as unknown as CrmLeaderboardEntry[];
    },
    staleTime: 30_000,
  });

  useEffect(() => {
    const ch = supabase
      .channel("crm-leaderboard-rt")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "crm_call_logs" },
        () => qc.invalidateQueries({ queryKey: ["crm-leaderboard"] })
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  return query;
}

export function useCrmContactCallHistory(contactId: string | null) {
  return useQuery({
    queryKey: ["crm-call-history", contactId],
    queryFn: async () => {
      if (!contactId) return [];
      const { data, error } = await supabase
        .from("crm_call_logs")
        .select("*")
        .eq("contact_id", contactId)
        .order("started_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!contactId,
  });
}
