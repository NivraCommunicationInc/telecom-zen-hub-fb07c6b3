/**
 * useAdminInvoiceDetail — Core-local copy for deployment decoupling.
 * Identical logic to @/hooks/admin/useAdminInvoiceDetail.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  assertCanonicalAccountInvariant,
  buildCanonicalAccountMaps,
  resolveCanonicalAccountNumber,
} from "@/lib/canonicalAccountResolver";

export interface InvoiceDetailLine {
  id: string;
  description: string;
  unit_price: number;
  quantity: number;
  line_total: number;
  line_type: string;
}

export interface InvoiceDetailPayment {
  id: string;
  payment_number: string;
  amount: number;
  method: string;
  status: string | null;
  reference: string | null;
  received_at: string | null;
  created_at: string | null;
  created_by_name: string | null;
  confirmed_by_name: string | null;
}

export interface InvoiceDetail {
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
  fees: number | null;
  activation_fee: number | null;
  account_number: string | null;
  order_id: string | null;
  order_number: string | null;
  customer_id: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  lines: InvoiceDetailLine[];
  payments: InvoiceDetailPayment[];
}

export function useAdminInvoiceDetail(invoiceId: string | undefined) {
  return useQuery<InvoiceDetail | null>({
    queryKey: ["admin-invoice-detail", invoiceId],
    enabled: !!invoiceId,
    queryFn: async () => {
      if (!invoiceId) return null;

      const { data: inv, error } = await supabase
        .from("billing_invoices")
        .select(`
          id, invoice_number, type, subtotal, tps_amount, tvq_amount, total,
          amount_paid, balance_due, status, payment_method, due_date,
          cycle_start_date, cycle_end_date, created_at, paid_at, notes,
          fees, activation_fee, order_id, customer_id,
          customer:billing_customers(id, first_name, last_name, email, phone, user_id),
          order:orders(order_number, account_id, user_id, client_first_name, client_last_name)
        `)
        .eq("id", invoiceId)
        .single();
      if (error) throw error;
      if (!inv) return null;

      if (!inv.invoice_number) {
        throw new Error(`CANONICAL_IDENTIFIER_INVARIANT_VIOLATION: invoice(${inv.id}) missing invoice_number.`);
      }

      const customerRel = Array.isArray(inv.customer) ? inv.customer[0] : inv.customer;
      const orderRel = Array.isArray(inv.order) ? inv.order[0] : inv.order;

      const maps = await buildCanonicalAccountMaps(supabase, {
        orderIds: [inv.order_id],
        customerIds: [customerRel?.id ?? inv.customer_id],
        accountIds: [orderRel?.account_id],
        userIds: [orderRel?.user_id],
      });

      const accountNumber = resolveCanonicalAccountNumber(maps, {
        orderId: inv.order_id,
        accountId: orderRel?.account_id,
        userId: orderRel?.user_id,
        customerId: customerRel?.id ?? inv.customer_id,
      });

      assertCanonicalAccountInvariant(
        "invoice",
        inv.id,
        {
          orderId: inv.order_id,
          accountId: orderRel?.account_id,
          userId: orderRel?.user_id,
          customerId: customerRel?.id ?? inv.customer_id,
        },
        accountNumber,
      );

      const { data: lines } = await supabase
        .from("billing_invoice_lines")
        .select("id, description, unit_price, quantity, line_total, line_type")
        .eq("invoice_id", invoiceId)
        .order("created_at", { ascending: true });

      const { data: payments } = await supabase
        .from("billing_payments")
        .select("id, payment_number, amount, method, status, reference, received_at, created_at, created_by_name, confirmed_by")
        .eq("invoice_id", invoiceId)
        .order("created_at", { ascending: true });

      const confirmedByIds = (payments ?? [])
        .map((p: any) => p.confirmed_by)
        .filter((id: string | null) => id && id.length > 10);

      let confirmedByMap: Record<string, string> = {};
      if (confirmedByIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, first_name, last_name")
          .in("id", confirmedByIds);
        if (profiles) {
          for (const p of profiles) {
            confirmedByMap[p.id] = `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || p.id;
          }
        }
      }

      const c = customerRel as any;
      const o = orderRel as any;

      const _custUid = c?.user_id || o?.user_id;
      const { data: _custProf } = _custUid
        ? await supabase.from("profiles").select("first_name, last_name").eq("user_id", _custUid).maybeSingle()
        : { data: null };

      return {
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
        fees: inv.fees,
        activation_fee: inv.activation_fee,
        account_number: accountNumber,
        order_id: inv.order_id,
        order_number: o?.order_number ?? null,
        customer_id: c?.id ?? inv.customer_id,
        customer_name: [(_custProf as any)?.first_name ?? o?.client_first_name ?? c?.first_name, (_custProf as any)?.last_name ?? o?.client_last_name ?? c?.last_name].filter(Boolean).join(" ") || null,
        customer_email: c?.email ?? null,
        customer_phone: c?.phone ?? null,
        lines: (lines ?? []).map((l: any) => ({
          id: l.id,
          description: l.description,
          unit_price: l.unit_price,
          quantity: l.quantity,
          line_total: l.line_total,
          line_type: l.line_type,
        })),
        payments: (payments ?? []).map((p: any) => ({
          id: p.id,
          payment_number: p.payment_number,
          amount: p.amount,
          method: p.method,
          status: p.status,
          reference: p.reference,
          received_at: p.received_at,
          created_at: p.created_at,
          created_by_name: p.created_by_name,
          confirmed_by_name: p.confirmed_by
            ? confirmedByMap[p.confirmed_by] || p.confirmed_by
            : null,
        })),
      };
    },
  });
}
