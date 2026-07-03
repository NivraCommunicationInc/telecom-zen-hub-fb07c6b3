/**
 * useAdminPayments — Core-local copy for deployment decoupling.
 * Identical logic to @/hooks/admin/useAdminPayments.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  assertCanonicalAccountInvariant,
  buildCanonicalAccountMaps,
  resolveCanonicalAccountNumber,
} from "@/lib/canonicalAccountResolver";
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
  nivra_reference?: string | null;
  square_receipt_url?: string | null;
  square_payment_id?: string | null;

  authorized_amount?: number | null;
  authorization_status?: string | null;
  authorized_at?: string | null;
  captured_at?: string | null;
  captured_by?: string | null;
}

export function useAdminPayments(environment: EnvironmentFilter = "all") {
  return useQuery<AdminPayment[]>({
    queryKey: ["admin-payments-v2", environment],
    queryFn: async () => {
      let query = supabase
        .from("billing_payments")
        .select(`
          id, payment_number, amount, method, status, reference, provider,
          provider_payment_id, source, received_at, created_at, confirmed_by,
          legacy_note, created_by_name, invoice_id, customer_id, environment,
          authorized_amount, authorization_status,
          authorized_at, captured_at, captured_by,
          nivra_reference, square_payment_id, square_receipt_url,
          invoice:billing_invoices(invoice_number, order_id, customer_id),
          customer:billing_customers(id, first_name, last_name, email, user_id)
        `)
        .order("created_at", { ascending: false })
        .limit(500);
      if (environment !== "all") query = query.eq("environment", environment);
      const { data, error } = await query;
      if (error) throw error;
      if (!data) return [];

      const maps = await buildCanonicalAccountMaps(supabase, {
        orderIds: data.map((p: any) => p.invoice?.order_id),
        customerIds: data.map((p: any) => p.invoice?.customer_id ?? p.customer?.id ?? p.customer_id),
      });

      const _uids = [...new Set(data.map((p: any) => p.customer?.user_id).filter(Boolean))];
      const { data: _profs } = _uids.length > 0 ? await supabase.from("profiles").select("user_id, first_name, last_name").in("user_id", _uids) : { data: [] };
      const _profileMap = new Map((_profs || []).map((p: any) => [p.user_id, p]));

      return data.map((p: any): AdminPayment => {
        if (!p.payment_number) {
          throw new Error(`CANONICAL_IDENTIFIER_INVARIANT_VIOLATION: payment(${p.id}) missing payment_number.`);
        }

        const accountNumber = resolveCanonicalAccountNumber(maps, {
          orderId: p.invoice?.order_id,
          customerId: p.invoice?.customer_id ?? p.customer?.id ?? p.customer_id,
        });

        assertCanonicalAccountInvariant(
          "payment",
          p.id,
          {
            orderId: p.invoice?.order_id,
            customerId: p.invoice?.customer_id ?? p.customer?.id ?? p.customer_id,
          },
          accountNumber,
        );

        return {
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
          customer_name: (() => { const prof = p.customer?.user_id ? _profileMap.get(p.customer.user_id) : null; return [prof?.first_name ?? p.customer?.first_name, prof?.last_name ?? p.customer?.last_name].filter(Boolean).join(" ") || null; })(),
          customer_email: p.customer?.email ?? null,
          account_number: accountNumber,
          environment: p.environment,
          nivra_reference: p.nivra_reference,
          square_payment_id: p.square_payment_id,
          square_receipt_url: p.square_receipt_url,
          authorized_amount: p.authorized_amount,
          authorization_status: p.authorization_status,
          authorized_at: p.authorized_at,
          captured_at: p.captured_at,
          captured_by: p.captured_by,
        };
      });
    },
  });
}
