/**
 * Hook for counting overdue/unpaid invoices - UNIFIED Billing System
 * Counts from both V2 (billing_invoices) and legacy (billing) tables
 * Used for badge display in navigation
 * 
 * CRITICAL: For client portal, pass portalClient for proper RLS authentication
 */

import { useQuery } from "@tanstack/react-query";
import { SupabaseClient } from "@supabase/supabase-js";
import { backendClient } from "@/integrations/backend/client";

/**
 * @param userId - The user ID to count overdue invoices for
 * @param supabaseClient - Optional: The authenticated Supabase client to use
 *                         For portal context, pass portalClient
 *                         Defaults to backendClient for admin/staff contexts
 */
export function useOverdueCount(
  userId: string | undefined,
  supabaseClient?: SupabaseClient
) {
  const client = supabaseClient || backendClient;
  
  return useQuery({
    queryKey: ["overdue-count-unified", userId],
    queryFn: async () => {
      if (!userId) return 0;
      
      let totalCount = 0;

      // 1. V2 System: Count from billing_invoices
      const { data: customer } = await client
        .from('billing_customers')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (customer) {
        const { count: v2Count } = await client
          .from('billing_invoices')
          .select('id', { count: 'exact', head: true })
          .eq('customer_id', customer.id)
          .not('status', 'in', '("paid","cancelled","refunded")')
          .gt('balance_due', 0);

        totalCount += v2Count || 0;
      }

      // 2. Legacy System: Count from billing table
      const { count: legacyCount } = await client
        .from('billing')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .not('status', 'in', '("paid","cancelled","voided","refunded")');

      totalCount += legacyCount || 0;

      return totalCount;
    },
    enabled: !!userId,
    staleTime: 60000, // 1 minute
  });
}

export default useOverdueCount;
