/**
 * useEmployeeSectionBadges — Points rouges pour la sidebar Employé.
 *
 * Sources :
 *  - employee_work_items (statut open/assigned)
 *  - activations en attente
 *  - KYC à valider
 *  - tickets ouverts (clients + internes)
 *  - notifications non-lues du staff
 */
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { adminClient as supabase } from "@/integrations/backend";
import { useAuth } from "@/hooks/useAuth";

export interface EmployeeBadgeState {
  show: boolean;
  urgent: boolean;
}

export type EmployeeBadges = Record<string, EmployeeBadgeState>;

const EMPTY: EmployeeBadges = {
  "Opérations": { show: false, urgent: false },
  "Ventes": { show: false, urgent: false },
  "Service client": { show: false, urgent: false },
  "Planification": { show: false, urgent: false },
  "Vérification": { show: false, urgent: false },
};

export function useEmployeeSectionBadges(): { badges: EmployeeBadges; isLoading: boolean } {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;

  const { data, isLoading } = useQuery({
    queryKey: ["employee-section-badges", userId],
    enabled: !!userId,
    staleTime: 30_000,
    refetchInterval: 60_000,
    queryFn: async (): Promise<EmployeeBadges> => {
      const [workItems, activations, kyc, tickets, appointments] = await Promise.all([
        supabase
          .from("employee_work_items")
          .select("id", { count: "exact", head: true })
          .in("status", ["open", "in_progress"]),
        supabase
          .from("activation_requests")
          .select("id", { count: "exact", head: true })
          .in("status", ["submitted", "in_progress"]),
        supabase
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("kyc_status", "pending"),
        supabase
          .from("tickets")
          .select("id", { count: "exact", head: true })
          .in("status", ["open", "in_progress"]),
        supabase
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .gte("scheduled_at", new Date().toISOString())
          .lt("scheduled_at", new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString()),
      ]);

      const workN = workItems.count ?? 0;
      const actN = activations.count ?? 0;
      const kycN = kyc.count ?? 0;
      const ticketsN = tickets.count ?? 0;
      const apptN = appointments.count ?? 0;

      return {
        "Opérations": { show: workN + actN > 0, urgent: actN > 0 },
        "Ventes": { show: false, urgent: false },
        "Service client": { show: ticketsN > 0, urgent: false },
        "Planification": { show: apptN > 0, urgent: false },
        "Vérification": { show: kycN > 0, urgent: kycN > 0 },
      };
    },
  });

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`employee-section-badges-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "employee_work_items" }, () =>
        queryClient.invalidateQueries({ queryKey: ["employee-section-badges", userId] })
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "activation_requests" }, () =>
        queryClient.invalidateQueries({ queryKey: ["employee-section-badges", userId] })
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "tickets" }, () =>
        queryClient.invalidateQueries({ queryKey: ["employee-section-badges", userId] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

  return { badges: data ?? EMPTY, isLoading };
}

export default useEmployeeSectionBadges;
