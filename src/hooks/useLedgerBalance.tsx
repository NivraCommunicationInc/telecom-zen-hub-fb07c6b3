/**
 * Hook for real-time ledger balance — V2 Billing System ONLY
 * 
 * CANONICAL SOURCE: billing_invoices + billing_payments (V2 system)
 * Legacy `billing` table is NO LONGER mixed in to prevent double-counting.
 * 
 * Balance = sum(non-cancelled invoice totals) - sum(confirmed payments)
 * 
 * CRITICAL: This hook requires an authenticated Supabase client to work correctly
 * with RLS policies. Pass the appropriate client based on context:
 * - Portal: use portalClient from @/integrations/backend/portalClient
 * - Admin/Staff: use backendClient from @/integrations/backend/client
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { SupabaseClient } from "@supabase/supabase-js";
import { backendClient } from "@/integrations/backend/client";

export interface LedgerBalance {
  totalDebits: number;
  totalCredits: number;
  balance: number;
  availableCredit: number;
  isCredit: boolean;
  display: string;
  lastPaymentDate: string | null;
  lastPaymentAmount: number | null;
  lastPaymentMethod: string | null;
  unpaidInvoiceCount: number;
}

/**
 * Fetch unified ledger balance from V2 billing system ONLY.
 * Single source of truth: billing_invoices + billing_payments.
 */
async function fetchLedgerBalance(
  clientId: string,
  supabaseClient: SupabaseClient
): Promise<LedgerBalance> {
  let totalDebits = 0;
  let totalCredits = 0;
  let unpaidInvoiceCount = 0;
  let lastPaymentDate: string | null = null;
  let lastPaymentAmount: number | null = null;
  let lastPaymentMethod: string | null = null;

  // Get customer_id from billing_customers (linked to user_id)
  const { data: customer, error: customerErr } = await supabaseClient
    .from("billing_customers")
    .select("id")
    .eq("user_id", clientId)
    .maybeSingle();

  if (customerErr) {
    console.warn("[useLedgerBalance] billing_customers lookup failed:", customerErr);
  }

  if (!customer) {
    // No V2 billing customer → balance is 0
    return {
      totalDebits: 0,
      totalCredits: 0,
      balance: 0,
      availableCredit: 0,
      isCredit: false,
      display: (0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" }),
      lastPaymentDate: null,
      lastPaymentAmount: null,
      lastPaymentMethod: null,
      unpaidInvoiceCount: 0,
    };
  }

  // ── Debits: sum canonical invoice totals ──
  const { data: invoices, error: invoicesErr } = await supabaseClient
    .from("billing_invoices")
    .select("total, status, balance_due")
    .eq("customer_id", customer.id)
    .not("status", "in", '("cancelled","refunded","void")');

  if (invoicesErr) {
    console.warn("[useLedgerBalance] billing_invoices query failed:", invoicesErr);
  }

  // CANONICAL INVARIANT: paid/void/cancelled invoices contribute ZERO to balance
  const CLOSED_STATUSES = ["paid", "paid_by_promo", "void", "cancelled", "refunded"];
  for (const inv of invoices || []) {
    totalDebits += Number(inv.total) || 0;
    if (!CLOSED_STATUSES.includes(inv.status) && (Number(inv.balance_due) || 0) > 0) {
      unpaidInvoiceCount++;
    }
  }

  // ── Credits: sum confirmed payments ──
  const { data: payments, error: paymentsErr } = await supabaseClient
    .from("billing_payments")
    .select("amount, status, method, received_at, created_at")
    .eq("customer_id", customer.id)
    .eq("status", "confirmed")
    .order("received_at", { ascending: false, nullsFirst: false });

  if (paymentsErr) {
    console.warn("[useLedgerBalance] billing_payments query failed:", paymentsErr);
  }

  for (const pay of payments || []) {
    totalCredits += Number(pay.amount) || 0;
  }

  // Get last payment
  if (payments && payments.length > 0) {
    const lastPay = payments[0];
    lastPaymentDate = lastPay.received_at || lastPay.created_at;
    lastPaymentAmount = Number(lastPay.amount) || null;
    lastPaymentMethod = lastPay.method;
  }

  // ── Final balance ──
  const balance = Math.round((totalDebits - totalCredits) * 100) / 100;
  const isCredit = balance < 0;

  return {
    totalDebits: Math.round(totalDebits * 100) / 100,
    totalCredits: Math.round(totalCredits * 100) / 100,
    balance,
    availableCredit: isCredit ? Math.abs(balance) : 0,
    isCredit,
    display: isCredit
      ? `Crédit: ${Math.abs(balance).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}`
      : balance.toLocaleString("fr-CA", { style: "currency", currency: "CAD" }),
    lastPaymentDate,
    lastPaymentAmount,
    lastPaymentMethod,
    unpaidInvoiceCount,
  };
}

/**
 * Hook for real-time ledger balance with auto-refresh on changes
 */
export function useLedgerBalance(
  clientId: string | undefined,
  supabaseClient?: SupabaseClient
) {
  const queryClient = useQueryClient();
  const client = supabaseClient || backendClient;

  const query = useQuery({
    queryKey: ["ledger-balance", clientId],
    queryFn: () => fetchLedgerBalance(clientId!, client),
    enabled: !!clientId,
    staleTime: 30000,
  });

  // Subscribe to real-time changes on V2 tables only
  useEffect(() => {
    if (!clientId) return;

    const channel = client
      .channel(`ledger-v2-${clientId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "billing_invoices" },
        () => queryClient.invalidateQueries({ queryKey: ["ledger-balance", clientId] })
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "billing_payments" },
        () => queryClient.invalidateQueries({ queryKey: ["ledger-balance", clientId] })
      )
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  }, [clientId, queryClient, client]);

  return query;
}

export default useLedgerBalance;
