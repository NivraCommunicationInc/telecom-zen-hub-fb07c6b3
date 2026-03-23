/**
 * useSubscriptionDetail — Shared canonical subscription detail loader.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SubscriptionDetailData {
  subscription: any;
  serviceLines: any[];
  customer: any | null;
  invoices: any[];
  order: { id: string; order_number: string; status: string } | null;
}

export function useSubscriptionDetail(subscriptionId: string | undefined) {
  return useQuery<SubscriptionDetailData>({
    queryKey: ["shared-subscription-detail", subscriptionId],
    enabled: !!subscriptionId,
    staleTime: 1000 * 60 * 2,
    queryFn: async () => {
      if (!subscriptionId) throw new Error("ID abonnement manquant");
      const { data: subscription, error } = await supabase
        .from("billing_subscriptions")
        .select("*")
        .eq("id", subscriptionId)
        .single();
      if (error) throw error;

      const [linesRes, customerRes, invoicesRes, orderRes] = await Promise.all([
        supabase.from("billing_subscription_services")
          .select("*").eq("subscription_id", subscriptionId).eq("is_active", true)
          .order("created_at", { ascending: true }),
        supabase.from("billing_customers")
          .select("id, first_name, last_name, email, phone, user_id")
          .eq("id", subscription.customer_id).maybeSingle(),
        supabase.from("billing_invoices")
          .select("id, invoice_number, total, status, due_date, paid_at, balance_due, type, created_at")
          .eq("subscription_id", subscriptionId).eq("environment", "live")
          .order("created_at", { ascending: false }).limit(20),
        subscription.order_id
          ? supabase.from("orders").select("id, order_number, status").eq("id", subscription.order_id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      return {
        subscription,
        serviceLines: linesRes.data ?? [],
        customer: customerRes.data,
        invoices: invoicesRes.data ?? [],
        order: orderRes.data,
      };
    },
  });
}
