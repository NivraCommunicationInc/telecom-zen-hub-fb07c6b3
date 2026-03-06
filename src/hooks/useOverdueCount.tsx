/**
 * Hook for counting open invoices - V2 Billing ONLY
 * Single source of truth: billing_invoices.balance_due/status
 */

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SupabaseClient } from "@supabase/supabase-js";
import { backendClient } from "@/integrations/backend/client";

/**
 * @param userId - The user ID to count open invoices for
 * @param supabaseClient - Optional authenticated client (portalClient in portal context)
 */
export function useOverdueCount(
  userId: string | undefined,
  supabaseClient?: SupabaseClient
) {
  const client = supabaseClient || backendClient;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["overdue-count-unified", userId],
    queryFn: async () => {
      if (!userId) return 0;

      const { data: customer } = await client
        .from("billing_customers")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (!customer) return 0;

      const { count } = await client
        .from("billing_invoices")
        .select("id", { count: "exact", head: true })
        .eq("customer_id", customer.id)
        .not("status", "in", '("paid","paid_by_promo","cancelled","refunded","void")')
        .gt("balance_due", 0);

      return count || 0;
    },
    enabled: !!userId,
    staleTime: 30000,
  });

  useEffect(() => {
    if (!userId) return;

    const channel = client
      .channel(`overdue-count-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "billing_invoices" }, () => {
        queryClient.invalidateQueries({ queryKey: ["overdue-count-unified", userId] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "billing_payments" }, () => {
        queryClient.invalidateQueries({ queryKey: ["overdue-count-unified", userId] });
      })
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  }, [client, queryClient, userId]);

  return query;
}

export default useOverdueCount;
