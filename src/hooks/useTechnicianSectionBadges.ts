/**
 * useTechnicianSectionBadges — Points rouges sidebar Technicien.
 *
 * Sources :
 *  - Rendez-vous assignés à venir (today + 7j)
 *  - Installations en attente
 */
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface TechBadgeState {
  show: boolean;
  urgent: boolean;
}

export type TechnicianBadges = Record<string, TechBadgeState>;

const EMPTY: TechnicianBadges = {
  "/staff/appointments": { show: false, urgent: false },
};

export function useTechnicianSectionBadges(): {
  badges: TechnicianBadges;
  isLoading: boolean;
} {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;

  const { data, isLoading } = useQuery({
    queryKey: ["technician-section-badges", userId],
    enabled: !!userId,
    staleTime: 30_000,
    refetchInterval: 60_000,
    queryFn: async (): Promise<TechnicianBadges> => {
      const today = new Date();
      const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
      const end = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();

      const { count: apptCount } = await supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .gte("scheduled_at", start)
        .lt("scheduled_at", end)
        .in("status", ["pending_scheduling", "scheduled", "confirmed", "in_progress"]);

      const { count: todayCount } = await supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .gte("scheduled_at", start)
        .lt("scheduled_at", new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString())
        .in("status", ["pending_scheduling", "scheduled", "confirmed", "in_progress"]);

      return {
        "/staff/appointments": {
          show: (apptCount ?? 0) > 0,
          urgent: (todayCount ?? 0) > 0, // Si rdv aujourd'hui → urgent
        },
      };
    },
  });

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`technician-section-badges-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments" }, () =>
        queryClient.invalidateQueries({ queryKey: ["technician-section-badges", userId] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

  return { badges: data ?? EMPTY, isLoading };
}

export default useTechnicianSectionBadges;
