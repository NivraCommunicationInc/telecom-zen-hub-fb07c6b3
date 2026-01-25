/**
 * Hook for counting overdue invoices - V2 Billing System
 * Used for badge display in navigation
 */

import { useQuery } from "@tanstack/react-query";
import { backendClient } from "@/integrations/backend/client";

export function useOverdueCount(userId: string | undefined) {
  return useQuery({
    queryKey: ["overdue-count-v2", userId],
    queryFn: async () => {
      if (!userId) return 0;

      // Get customer_id first
      const { data: customer } = await backendClient
        .from('billing_customers')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (!customer) return 0;

      // Count overdue invoices
      const { count, error } = await backendClient
        .from('billing_invoices')
        .select('id', { count: 'exact', head: true })
        .eq('customer_id', customer.id)
        .in('status', ['overdue', 'pending'])
        .lt('due_date', new Date().toISOString());

      if (error) return 0;
      return count || 0;
    },
    enabled: !!userId,
    staleTime: 60000, // 1 minute
  });
}

export default useOverdueCount;
