/**
 * Hook for counting open invoices from canonical customer portal snapshot only.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SupabaseClient } from "@supabase/supabase-js";
import { backendClient } from "@/integrations/backend/client";
import { useEffect } from "react";

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

      const { data, error } = await client.rpc("get_customer_portal_snapshot", { _user_id: userId });
      if (error) throw error;
      const closed = new Set(["paid", "paid_by_promo", "cancelled", "refunded", "void"]);
      return [...(((data as any)?.invoices || []) as any[]), ...(((data as any)?.monthlyInvoices || []) as any[])]
        .filter((invoice) => !closed.has(String(invoice?.status || "").toLowerCase()) && Number(invoice?.balance_due ?? invoice?.total ?? 0) > 0)
        .length;
    },
    enabled: !!userId,
    staleTime: 30000,
  });

  useEffect(() => {
    if (!userId) return;

    const channel = client
      .channel(`overdue-count-canonical-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "customer_portal_snapshots", filter: `user_id=eq.${userId}` }, () => {
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
