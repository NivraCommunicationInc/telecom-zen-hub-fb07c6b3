/**
 * useAdminSectionBadges — Points rouges sur la sidebar Nivra Core.
 *
 * Sources combinées:
 *  - Notifications non-lues du staff (table notifications, user_role=admin)
 *  - État métier: commandes en attente, KYC pending, paiements à confirmer,
 *    tickets ouverts, recouvrement, contestations.
 *
 * Indexé par groupe de la sidebar (`navGroups[].id`).
 */
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { adminClient as supabase } from "@/integrations/backend";
import { useAuth } from "@/hooks/useAuth";

export interface AdminBadgeState {
  show: boolean;
  urgent: boolean;
}

export type AdminBadges = Record<string, AdminBadgeState>;

const EMPTY: AdminBadges = {
  overview: { show: false, urgent: false },
  operations: { show: false, urgent: false },
  clients: { show: false, urgent: false },
  billing: { show: false, urgent: false },
  support: { show: false, urgent: false },
  hr: { show: false, urgent: false },
  system: { show: false, urgent: false },
};

export function useAdminSectionBadges(): { badges: AdminBadges; isLoading: boolean } {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;

  const { data, isLoading } = useQuery({
    queryKey: ["admin-section-badges", userId],
    enabled: !!userId,
    staleTime: 30_000,
    refetchInterval: 60_000,
    queryFn: async (): Promise<AdminBadges> => {
      // Compteurs métier en parallèle
      const [
        pendingOrders,
        pendingKyc,
        pendingPayments,
        openTickets,
        openInternalTickets,
        recouvrement,
        contestedPayments,
        unreadNotifs,
      ] = await Promise.all([
        supabase
          .from("orders")
          .select("id", { count: "exact", head: true })
          .in("status", ["pending", "confirmed", "processing"]),
        supabase
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending")
          .not("kyc_status", "eq", "approved"),
        supabase
          .from("billing_payments")
          .select("id", { count: "exact", head: true })
          .in("status", ["pending", "requires_capture"]),
        supabase
          .from("tickets")
          .select("id", { count: "exact", head: true })
          .in("status", ["open", "in_progress"]),
        supabase
          .from("internal_tickets")
          .select("id", { count: "exact", head: true })
          .in("status", ["open", "in_progress"]),
        supabase
          .from("billing_invoices")
          .select("id", { count: "exact", head: true })
          .eq("status", "overdue")
          .gt("balance_due", 0),
        supabase
          .from("billing_payments")
          .select("id", { count: "exact", head: true })
          .eq("status", "disputed"),
        userId
          ? supabase
              .from("notifications")
              .select("link_target")
              .eq("user_id", userId)
              .eq("is_read", false)
              .limit(200)
          : Promise.resolve({ data: [] as { link_target: string | null }[], count: null, error: null } as any),
      ]);

      const ordersN = pendingOrders.count ?? 0;
      const kycN = pendingKyc.count ?? 0;
      const paymentsN = pendingPayments.count ?? 0;
      const ticketsN = openTickets.count ?? 0;
      const internalN = openInternalTickets.count ?? 0;
      const recouvN = recouvrement.count ?? 0;
      const contestedN = contestedPayments.count ?? 0;

      const targets = new Map<string, number>();
      ((unreadNotifs as any).data ?? []).forEach((n: { link_target: string | null }) => {
        const t = (n.link_target ?? "").toLowerCase();
        if (t) targets.set(t, (targets.get(t) ?? 0) + 1);
      });

      return {
        overview: { show: false, urgent: false },
        operations: {
          show: ordersN + kycN > 0,
          urgent: kycN > 0, // KYC en attente est prioritaire
        },
        clients: { show: false, urgent: false },
        billing: {
          show: paymentsN + recouvN + contestedN > 0,
          urgent: contestedN > 0 || recouvN > 0,
        },
        support: {
          show: ticketsN + internalN > 0,
          urgent: false,
        },
        hr: { show: false, urgent: false },
        system: {
          show: (targets.get("system") ?? 0) > 0,
          urgent: false,
        },
        offers: { show: false, urgent: false },
        marketing: { show: false, urgent: false },
        partners: { show: false, urgent: false },
      };
    },
  });

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`admin-section-badges-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () =>
        queryClient.invalidateQueries({ queryKey: ["admin-section-badges", userId] })
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "billing_payments" }, () =>
        queryClient.invalidateQueries({ queryKey: ["admin-section-badges", userId] })
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "tickets" }, () =>
        queryClient.invalidateQueries({ queryKey: ["admin-section-badges", userId] })
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, () =>
        queryClient.invalidateQueries({ queryKey: ["admin-section-badges", userId] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

  return { badges: data ?? EMPTY, isLoading };
}

export default useAdminSectionBadges;
