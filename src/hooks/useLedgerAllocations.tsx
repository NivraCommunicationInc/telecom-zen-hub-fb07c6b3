/**
 * Hook to fetch ledger allocations for a specific entry
 */

import { useQuery } from "@tanstack/react-query";
import { backendClient } from "@/integrations/backend/client";

export interface LedgerAllocation {
  allocation_id: string;
  other_entry_id: string;
  other_reference_number: string | null;
  other_description: string | null;
  other_entry_type: string;
  amount_allocated: number;
  allocated_at: string;
  is_payment: boolean;
}

/**
 * Fetch allocations for a specific ledger entry
 * - For payments: returns invoices the payment was allocated to
 * - For invoices: returns payments that were allocated to it
 */
export function useLedgerAllocations(entryId: string | null | undefined) {
  return useQuery({
    queryKey: ["ledger-allocations", entryId],
    queryFn: async () => {
      if (!entryId) return [];

      const { data, error } = await backendClient.rpc("get_ledger_allocations", {
        p_entry_id: entryId,
      });

      if (error) {
        console.error("[useLedgerAllocations] Error:", error);
        throw error;
      }

      return (data as LedgerAllocation[]) || [];
    },
    enabled: !!entryId,
    staleTime: 30000,
  });
}

export default useLedgerAllocations;
