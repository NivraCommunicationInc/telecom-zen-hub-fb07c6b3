/**
 * useAdminInvoices — Fetches billing_invoices with customer + order joins
 * All amounts are authoritative DB values. No local math.
 */
import { useQuery } from "@tanstack/react-query";
import { adminClient as supabase } from "@/integrations/backend";

export interface AdminInvoice {
  id: string;
  invoice_number: string;
  type: string;
  subtotal: number;
  tps_amount: number;
  tvq_amount: number;
  total: number;
  amount_paid: number | null;
  balance_due: number | null;
  status: string | null;
  payment_method: string | null;
  due_date: string;
  cycle_start_date: string;
  cycle_end_date: string;
  created_at: string | null;
  paid_at: string | null;
  notes: string | null;
  // Joined order
  order_id: string | null;
  order_number: string | null;
  // Joined customer
  customer_id: string;
  customer_name: string | null;
  customer_email: string | null;
  // Account
  account_number: string | null;
}

export function useAdminInvoices() {
  return useQuery<AdminInvoice[]>({
    queryKey: ["admin-invoices-v2"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("billing_invoices")
        .select(`
          id, invoice_number, type, subtotal, tps_amount, tvq_amount, total,
          amount_paid, balance_due, status, payment_method, due_date,
          cycle_start_date, cycle_end_date, created_at, paid_at, notes,
          order_id, billing_snapshot_account_number,
          customer:billing_customers(id, first_name, last_name, email),
          order:orders(order_number)
        `)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      if (!data) return [];

      return data.map((inv: any): AdminInvoice => ({
        id: inv.id,
        invoice_number: inv.invoice_number,
        type: inv.type,
        subtotal: inv.subtotal,
        tps_amount: inv.tps_amount,
        tvq_amount: inv.tvq_amount,
        total: inv.total,
        amount_paid: inv.amount_paid,
        balance_due: inv.balance_due,
        status: inv.status,
        payment_method: inv.payment_method,
        due_date: inv.due_date,
        cycle_start_date: inv.cycle_start_date,
        cycle_end_date: inv.cycle_end_date,
        created_at: inv.created_at,
        paid_at: inv.paid_at,
        notes: inv.notes,
        order_id: inv.order_id,
        order_number: inv.order?.order_number ?? null,
        customer_id: inv.customer?.id ?? inv.customer_id,
        customer_name: inv.customer ? `${inv.customer.first_name} ${inv.customer.last_name}`.trim() : null,
        customer_email: inv.customer?.email ?? null,
        account_number: inv.billing_snapshot_account_number ?? null,
      }));
    },
  });
}
