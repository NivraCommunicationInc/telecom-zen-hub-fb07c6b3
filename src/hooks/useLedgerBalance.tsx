/**
 * Hook for real-time ledger balance
 * Uses Realtime for instant updates across Admin/Employee/Client
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { backendClient } from "@/integrations/backend/client";

export interface LedgerBalance {
  totalDebits: number;
  totalCredits: number;
  balance: number;
  availableCredit: number;
  isCredit: boolean;
  display: string;
  preauthorized: number;
}

export interface LedgerEntry {
  id: string;
  client_id: string;
  entry_type: string;
  amount: number;
  description: string | null;
  reference_type: string | null;
  reference_id: string | null;
  reference_number: string | null;
  payment_method: string | null;
  payment_status: string | null;
  captured_at: string | null;
  created_at: string;
}

/**
 * Fetch ledger balance using database function
 */
async function fetchLedgerBalance(clientId: string): Promise<LedgerBalance> {
  // Try to use the database function first
  const { data, error } = await backendClient.rpc('get_client_ledger_balance', {
    p_client_id: clientId
  });

  if (error) {
    console.warn("[useLedgerBalance] RPC error, falling back to manual calculation:", error);
    // Fallback to manual calculation from ledger_entries
    return await calculateFromLedgerEntries(clientId);
  }

  if (data && data.length > 0) {
    const result = data[0];
    const balance = Number(result.balance) || 0;
    const isCredit = balance < 0;
    
    return {
      totalDebits: Number(result.total_debits) || 0,
      totalCredits: Number(result.total_credits) || 0,
      balance,
      availableCredit: Number(result.available_credit) || 0,
      isCredit,
      display: isCredit
        ? `Crédit: ${Math.abs(balance).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}`
        : balance.toLocaleString("fr-CA", { style: "currency", currency: "CAD" }),
      preauthorized: 0, // Would need separate query for preauthorized
    };
  }

  return {
    totalDebits: 0,
    totalCredits: 0,
    balance: 0,
    availableCredit: 0,
    isCredit: false,
    display: "0,00 $",
    preauthorized: 0,
  };
}

/**
 * Fallback: calculate from ledger_entries directly
 */
async function calculateFromLedgerEntries(clientId: string): Promise<LedgerBalance> {
  const { data: entries, error } = await backendClient
    .from('ledger_entries')
    .select('*')
    .eq('client_id', clientId);

  if (error) {
    console.error("[useLedgerBalance] Error fetching entries:", error);
    return {
      totalDebits: 0,
      totalCredits: 0,
      balance: 0,
      availableCredit: 0,
      isCredit: false,
      display: "0,00 $",
      preauthorized: 0,
    };
  }

  let totalDebits = 0;
  let totalCredits = 0;

  for (const entry of entries || []) {
    const amount = Number(entry.amount) || 0;
    if (amount > 0) {
      totalDebits += amount;
    } else if (amount < 0) {
      // Only count captured payments
      const isCaptured = entry.captured_at || 
        ['paid', 'complete', 'captured'].includes(entry.payment_status || '');
      if (isCaptured) {
        totalCredits += Math.abs(amount);
      }
    }
  }

  const balance = totalDebits - totalCredits;
  const isCredit = balance < 0;

  return {
    totalDebits,
    totalCredits,
    balance,
    availableCredit: isCredit ? Math.abs(balance) : 0,
    isCredit,
    display: isCredit
      ? `Crédit: ${Math.abs(balance).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}`
      : balance.toLocaleString("fr-CA", { style: "currency", currency: "CAD" }),
    preauthorized: 0,
  };
}

/**
 * Hook for real-time ledger balance with auto-refresh on changes
 */
export function useLedgerBalance(clientId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["ledger-balance", clientId],
    queryFn: () => fetchLedgerBalance(clientId!),
    enabled: !!clientId,
    staleTime: 30000, // 30 seconds
  });

  // Subscribe to real-time changes
  useEffect(() => {
    if (!clientId) return;

    const channel = backendClient
      .channel(`ledger-${clientId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ledger_entries',
          filter: `client_id=eq.${clientId}`,
        },
        () => {
          // Invalidate and refetch on any change
          queryClient.invalidateQueries({ queryKey: ["ledger-balance", clientId] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'billing',
          filter: `user_id=eq.${clientId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["ledger-balance", clientId] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'payment_proofs',
          filter: `client_id=eq.${clientId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["ledger-balance", clientId] });
        }
      )
      .subscribe();

    return () => {
      backendClient.removeChannel(channel);
    };
  }, [clientId, queryClient]);

  return query;
}

/**
 * Hook for ledger entries list
 */
export function useLedgerEntries(clientId: string | undefined) {
  return useQuery({
    queryKey: ["ledger-entries", clientId],
    queryFn: async () => {
      const { data, error } = await backendClient
        .from('ledger_entries')
        .select('*')
        .eq('client_id', clientId!)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as LedgerEntry[];
    },
    enabled: !!clientId,
  });
}

export default useLedgerBalance;
