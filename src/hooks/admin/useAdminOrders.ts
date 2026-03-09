/**
 * useAdminOrders — Fetches orders with joined profile + invoice data
 * All financial amounts are read-only from DB, no local math.
 */
import { useQuery } from "@tanstack/react-query";
import { adminClient as supabase } from "@/integrations/backend";

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
  // Joined profile
  client_full_name: string | null;
  client_email: string | null;
  account_number: string | null;
  // Joined invoice
  invoice_number: string | null;
  invoice_status: string | null;
}

export function useAdminOrders() {
  return useQuery<AdminOrder[]>({
    queryKey: ["admin-orders-v2"],
    queryFn: async () => {
      // Fetch orders
      const { data: orders, error } = await supabase
        .from("orders")
        .select("id, order_number, user_id, service_type, order_type, status, payment_status, total_amount, risk_flags, created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      if (!orders || orders.length === 0) return [];

      // Batch join profiles
      const userIds = [...new Set(orders.map((o) => o.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, account_number")
        .in("user_id", userIds);

      // Batch join invoices (one invoice per order)
      const orderIds = orders.map((o) => o.id);
      const { data: invoices } = await supabase
        .from("billing_invoices")
        .select("order_id, invoice_number, status")
        .in("order_id", orderIds);

      const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) ?? []);
      const invoiceMap = new Map(invoices?.map((i) => [i.order_id, i]) ?? []);

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
          total_amount: o.total_amount,
          risk_flags: o.risk_flags as string[] | null,
          created_at: o.created_at,
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
