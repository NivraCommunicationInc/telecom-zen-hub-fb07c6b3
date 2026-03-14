/**
 * useAdminOrders — Core-local copy for deployment decoupling.
 * CANONICAL: Uses billing_invoices.total as the authoritative transaction amount.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { EnvironmentFilter } from "./useEnvironmentFilter";

export interface AdminOrder {
  id: string;
  order_number: string | null;
  user_id: string;
  service_type: string | null;
  order_type: string | null;
  status: string;
  payment_status: string | null;
  total_amount: number | null;
  risk_flags: string[] | null;
  created_at: string;
  environment?: string;
  client_full_name: string | null;
  client_email: string | null;
  account_number: string | null;
  invoice_number: string | null;
  invoice_status: string | null;
}

export function useAdminOrders(environment: EnvironmentFilter = 'all') {
  return useQuery<AdminOrder[]>({
    queryKey: ["admin-orders-v2", environment],
    queryFn: async () => {
      let query = supabase
        .from("orders")
        .select("id, order_number, user_id, service_type, order_type, status, payment_status, total_amount, risk_flags, created_at, environment")
        .order("created_at", { ascending: false })
        .limit(500);
      if (environment !== 'all') query = query.eq("environment", environment);
      const { data: orders, error } = await query;
      if (error) throw error;
      if (!orders || orders.length === 0) return [];

      const userIds = [...new Set(orders.map((o) => o.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, account_number")
        .in("user_id", userIds);

      const orderIds = orders.map((o) => o.id);
      const { data: invoices } = await supabase
        .from("billing_invoices")
        .select("order_id, invoice_number, status, total")
        .in("order_id", orderIds);

      const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) ?? []);
      // Group invoices by order_id, pick first non-void
      const invoiceMap = new Map<string, { invoice_number: string; status: string; total: number }>();
      for (const inv of (invoices || [])) {
        if (!inv.order_id) continue;
        const existing = invoiceMap.get(inv.order_id);
        // Prefer non-void invoice; if none yet, take the first
        if (!existing || (existing.status === 'void' && inv.status !== 'void')) {
          invoiceMap.set(inv.order_id, inv as any);
        }
      }

      return orders.map((o): AdminOrder => {
        const profile = profileMap.get(o.user_id);
        const invoice = invoiceMap.get(o.id);
        return {
          id: o.id,
          order_number: o.order_number,
          user_id: o.user_id,
          service_type: o.service_type,
          order_type: o.order_type,
          status: o.status,
          payment_status: o.payment_status,
          // CANONICAL: prefer billing_invoices.total over orders.total_amount
          total_amount: invoice?.total ?? o.total_amount,
          risk_flags: o.risk_flags as string[] | null,
          created_at: o.created_at,
          environment: (o as any).environment,
          client_full_name: profile?.full_name ?? null,
          client_email: profile?.email ?? null,
          account_number: profile?.account_number ?? null,
          invoice_number: invoice?.invoice_number ?? null,
          invoice_status: invoice?.status ?? null,
        };
      });
    },
  });
}
