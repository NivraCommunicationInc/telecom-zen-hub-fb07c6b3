/**
 * useAccountState — Read the canonical account state for any portal.
 *
 *   const { state, isLoading, error, refresh } = useAccountState(accountId);
 *
 * Caches per-account state for 60s in react-query. Critical mutations (paying
 * an invoice, completing KYC, etc.) should invalidate the cache so the UI
 * reflects reality immediately.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AccountStateResult } from "@/lib/accountState";

const ACCOUNT_STATE_QUERY_KEY = "account-state" as const;

export function useAccountState(accountId: string | null | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [ACCOUNT_STATE_QUERY_KEY, accountId],
    enabled: !!accountId,
    staleTime: 60_000, // 1 min — state changes are rare; we invalidate on mutations
    queryFn: async (): Promise<AccountStateResult | null> => {
      if (!accountId) return null;
      const { data, error } = await supabase.rpc("get_account_state", {
        p_account_id: accountId,
      });
      if (error) throw error;
      return data as unknown as AccountStateResult;
    },
  });

  return {
    state: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error as Error | null,
    /** Call this after any mutation that could change the canonical state. */
    refresh: () =>
      queryClient.invalidateQueries({ queryKey: [ACCOUNT_STATE_QUERY_KEY, accountId] }),
  };
}

/**
 * Invalidate every account state in the cache. Use after batch operations
 * (admin importing payments, running a renewal cron, etc.).
 */
export function invalidateAllAccountStates(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: [ACCOUNT_STATE_QUERY_KEY] });
}
