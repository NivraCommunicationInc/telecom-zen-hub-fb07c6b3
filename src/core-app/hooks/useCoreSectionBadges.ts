/**
 * useCoreSectionBadges — Compteurs de notifications non-lues par section Core.
 *
 * SOURCE UNIQUE : table `staff_notifications` (filtrée sur is_read = false).
 *
 * Mapping notification_type → section sidebar :
 *   new_order               → orders
 *   invoice_created         → invoices
 *   payment_received        → payments
 *   service_suspended       → subscriptions
 *   service_cancelled       → subscriptions
 *   commission_approved     → hr
 *   payroll_paid|ready      → hr
 *   tax_document            → hr
 *   withdrawal_update       → hr
 *
 * Le hook expose aussi `total` pour le menu "Notifications" global.
 */
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CoreBadgeKey =
  | "orders"
  | "invoices"
  | "payments"
  | "subscriptions"
  | "support"
  | "activations"
  | "hr"
  | "careers"
  | "notifications";

export type CoreSectionBadges = Record<CoreBadgeKey, number>;

const EMPTY: CoreSectionBadges = {
  orders: 0,
  invoices: 0,
  payments: 0,
  subscriptions: 0,
  support: 0,
  activations: 0,
  hr: 0,
  careers: 0,
  notifications: 0,
};

const TYPE_TO_SECTION: Record<string, CoreBadgeKey> = {
  new_order: "orders",
  invoice_created: "invoices",
  payment_received: "payments",
  service_suspended: "subscriptions",
  service_cancelled: "subscriptions",
  commission_approved: "hr",
  payroll_paid: "hr",
  payroll_ready: "hr",
  tax_document: "hr",
  withdrawal_update: "hr",
};

export function useCoreSectionBadges(): {
  badges: CoreSectionBadges;
  isLoading: boolean;
} {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["core-section-badges"],
    staleTime: 30_000,
    refetchInterval: 60_000,
    queryFn: async (): Promise<CoreSectionBadges> => {
      // Aggregate unread counts by notification_type in a single roundtrip
      const { data: rows, error } = await supabase
        .from("staff_notifications")
        .select("notification_type")
        .eq("is_read", false)
        .limit(1000);
      if (error) throw error;

      const acc: CoreSectionBadges = { ...EMPTY };
      let total = 0;
      for (const r of rows ?? []) {
        const section = TYPE_TO_SECTION[(r as any).notification_type as string];
        if (section) acc[section] = (acc[section] ?? 0) + 1;
        total += 1;
      }
      acc.notifications = total;

      // Activations : demandes WiFi en attente (source dédiée, hors staff_notifications)
      const { count: actCount } = await supabase
        .from("activation_requests")
        .select("id", { count: "exact", head: true })
        .in("status", ["submitted", "in_progress"]);
      acc.activations = actCount ?? 0;

      // Support : tickets clients ouverts
      const { count: ticketCount } = await supabase
        .from("tickets")
        .select("id", { count: "exact", head: true })
        .in("status", ["open", "in_progress"]);
      acc.support = ticketCount ?? 0;

      // Careers : candidatures non lues (read_at IS NULL)
      const { count: careersCount } = await supabase
        .from("job_applications")
        .select("id", { count: "exact", head: true })
        .is("read_at", null);
      acc.careers = careersCount ?? 0;

      return acc;
    },
  });

  // Realtime invalidation on staff_notifications changes
  useEffect(() => {
    const channel = supabase
      .channel("core-section-badges-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "staff_notifications" },
        () => queryClient.invalidateQueries({ queryKey: ["core-section-badges"] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "activation_requests" },
        () => queryClient.invalidateQueries({ queryKey: ["core-section-badges"] }),
      )
      // 'tickets' is a view; subscribe to the underlying 'support_tickets' table
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "support_tickets" },
        () => queryClient.invalidateQueries({ queryKey: ["core-section-badges"] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "job_applications" },
        () => queryClient.invalidateQueries({ queryKey: ["core-section-badges"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return { badges: data ?? EMPTY, isLoading };
}

/**
 * Marque toutes les notifications non-lues d'un type donné comme lues.
 * À appeler quand l'utilisateur ouvre une page concernée.
 */
export async function markSectionAsRead(types: string[]): Promise<void> {
  if (!types.length) return;
  const { data: auth } = await supabase.auth.getUser();
  await supabase
    .from("staff_notifications")
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
      read_by: auth.user?.id ?? null,
    })
    .in("notification_type", types as any)
    .eq("is_read", false);
}

export const SECTION_TO_TYPES: Record<CoreBadgeKey, string[]> = {
  orders: ["new_order"],
  invoices: ["invoice_created"],
  payments: ["payment_received"],
  subscriptions: ["service_suspended", "service_cancelled"],
  hr: [
    "commission_approved",
    "payroll_paid",
    "payroll_ready",
    "tax_document",
    "withdrawal_update",
  ],
  support: [],
  activations: [],
  careers: [],
  notifications: [],
};
