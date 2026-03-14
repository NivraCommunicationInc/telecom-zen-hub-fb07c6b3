/**
 * Hook to fetch dispute counts for navigation badges
 * Returns counts for disputed invoices and payments
 */
import { useQuery } from "@tanstack/react-query";
import { adminClient as supabase } from "@/integrations/backend/adminClient";

export interface DisputeCounts {
  invoices: number;
  payments: number;
  total: number;
}

export function useDisputeCounts() {
  return useQuery({
    queryKey: ["admin-dispute-counts"],
    queryFn: async (): Promise<DisputeCounts> => {
      // Count disputed invoices — canonical billing_invoices table
      const { count: invoiceCount, error: invoiceError } = await supabase
        .from("billing_invoices")
        .select("id", { count: "exact", head: true })
        .or("status.eq.disputed,status.eq.contested,status.eq.chargeback");

      if (invoiceError) {
        console.error("Error counting disputed invoices:", invoiceError);
      }

      // Count active payment disputes (not resolved)
      const { count: paymentCount, error: paymentError } = await supabase
        .from("payment_disputes")
        .select("id", { count: "exact", head: true })
        .in("status", ["submitted", "under_review", "awaiting_client"]);

      if (paymentError) {
        console.error("Error counting payment disputes:", paymentError);
      }

      const invoices = invoiceCount || 0;
      const payments = paymentCount || 0;

      return {
        invoices,
        payments,
        total: invoices + payments,
      };
    },
    refetchInterval: 60000, // Refresh every minute
    staleTime: 30000,
  });
}
