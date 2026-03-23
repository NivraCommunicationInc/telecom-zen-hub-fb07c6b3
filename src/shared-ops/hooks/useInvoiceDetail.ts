/**
 * useInvoiceDetail — Shared canonical invoice detail loader.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface InvoiceDetailData {
  invoice: any;
  lines: any[];
  payments: any[];
  customer: any | null;
  subscription: { id: string; plan_name: string; status: string | null } | null;
  order: { id: string; order_number: string; status: string } | null;
}

export function useInvoiceDetail(invoiceId: string | undefined) {
  return useQuery<InvoiceDetailData>({
    queryKey: ["shared-invoice-detail", invoiceId],
    enabled: !!invoiceId,
    staleTime: 1000 * 60 * 2,
    queryFn: async () => {
      if (!invoiceId) throw new Error("ID facture manquant");
      const { data: invoice, error } = await supabase
        .from("billing_invoices")
        .select("*")
        .eq("id", invoiceId)
        .single();
      if (error) throw error;

      const [linesRes, paymentsRes, customerRes, subscriptionRes, orderRes] = await Promise.all([
        supabase.from("billing_invoice_lines").select("*").eq("invoice_id", invoiceId).order("created_at", { ascending: true }),
        supabase.from("billing_payments")
          .select("id, payment_number, amount, method, status, received_at, reference, created_at")
          .eq("invoice_id", invoiceId).order("created_at", { ascending: false }),
        supabase.from("billing_customers")
          .select("id, first_name, last_name, email, phone, user_id")
          .eq("id", invoice.customer_id).maybeSingle(),
        invoice.subscription_id
          ? supabase.from("billing_subscriptions").select("id, plan_name, status").eq("id", invoice.subscription_id).maybeSingle()
          : Promise.resolve({ data: null }),
        invoice.order_id
          ? supabase.from("orders").select("id, order_number, status").eq("id", invoice.order_id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      return {
        invoice,
        lines: linesRes.data ?? [],
        payments: paymentsRes.data ?? [],
        customer: customerRes.data,
        subscription: subscriptionRes.data,
        order: orderRes.data,
      };
    },
  });
}
