/**
 * useAdminPayments — Core-local copy for deployment decoupling.
 * Identical logic to @/hooks/admin/useAdminPayments.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { EnvironmentFilter } from "./useEnvironmentFilter";

export interface AdminPayment {
  id: string;
  payment_number: string;
  amount: number;
  method: string;
  status: string | null;
  reference: string | null;
  provider: string | null;
  provider_payment_id: string | null;
  source: string | null;
  received_at: string | null;
  created_at: string | null;
  confirmed_by: string | null;
  legacy_note: string | null;
  created_by_name: string | null;
  invoice_id: string;
  invoice_number: string | null;
  customer_id: string;
  customer_name: string | null;
  customer_email: string | null;
  account_number: string | null;
  environment?: string;
  // ★ Stripe authorization fields
  stripe_payment_intent_id?: string | null;
  authorized_amount?: number | null;
  authorization_status?: string | null;
  authorized_at?: string | null;
  captured_at?: string | null;
  captured_by?: string | null;
}

export function useAdminPayments(environment: EnvironmentFilter = 'all') {
  return useQuery<AdminPayment[]>({
    queryKey: ["admin-payments-v2", environment],
    queryFn: async () => {
      let query = supabase
        .from("billing_payments")
        .select(`
          id, payment_number, amount, method, status, reference, provider,
          provider_payment_id, source, received_at, created_at, confirmed_by,
          legacy_note, created_by_name, invoice_id, customer_id, environment,
          stripe_payment_intent_id, authorized_amount, authorization_status,
          authorized_at, captured_at, captured_by,
          invoice:billing_invoices(invoice_number, billing_snapshot_account_number),
          customer:billing_customers(id, first_name, last_name, email)
        `)
        .order("created_at", { ascending: false })
        .limit(500);
      if (environment !== 'all') query = query.eq("environment", environment);
      const { data, error } = await query;
      if (error) throw error;
      if (!data) return [];

      return data.map((p: any): AdminPayment => ({
        id: p.id,
        payment_number: p.payment_number,
        amount: p.amount,
        method: p.method,
        status: p.status,
        reference: p.reference,
        provider: p.provider,
        provider_payment_id: p.provider_payment_id,
        source: p.source,
        received_at: p.received_at,
        created_at: p.created_at,
        confirmed_by: p.confirmed_by,
        legacy_note: p.legacy_note,
        created_by_name: p.created_by_name,
        invoice_id: p.invoice_id,
        invoice_number: p.invoice?.invoice_number ?? null,
        customer_id: p.customer?.id ?? p.customer_id,
        customer_name: p.customer ? `${p.customer.first_name} ${p.customer.last_name}`.trim() : null,
        customer_email: p.customer?.email ?? null,
        account_number: p.invoice?.billing_snapshot_account_number ?? null,
        environment: p.environment,
      }));
    },
  });
}
