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

  const { data: snapshot, error } = await supabaseClient.rpc("get_client_history_snapshot", {
    _user_id: clientId,
  });

  if (error) throw error;

  const invoices = [
    ...(((snapshot as any)?.invoices || []) as any[]),
    ...(((snapshot as any)?.monthlyInvoices || []) as any[]),
  ];
  const payments = [
    ...(((snapshot as any)?.payments || []) as any[]),
    ...(((snapshot as any)?.legacyPayments || []) as any[]),
  ];

  // CANONICAL INVARIANT: paid/void/cancelled invoices contribute ZERO to balance
  const CLOSED_STATUSES = ["paid", "paid_by_promo", "void", "cancelled", "refunded"];
  for (const inv of invoices || []) {
    totalDebits += Number(inv.total ?? inv.amount ?? inv.total_amount) || 0;
    if (!CLOSED_STATUSES.includes(inv.status) && (Number(inv.balance_due) || 0) > 0) {
      unpaidInvoiceCount++;
    }
  }

  // ── Credits: sum confirmed payments ──
  for (const pay of payments || []) {
    if (!["confirmed", "completed", "paid", "succeeded"].includes(String(pay?.status || "").toLowerCase())) continue;
    totalCredits += Number(pay.amount) || 0;
  }

  // Get last payment
  if (payments && payments.length > 0) {
    const confirmed = payments
      .filter((p: any) => ["confirmed", "completed", "paid", "succeeded"].includes(String(p?.status || "").toLowerCase()))
      .sort((a: any, b: any) => new Date(b.received_at || b.created_at || 0).getTime() - new Date(a.received_at || a.created_at || 0).getTime());
    const lastPay = confirmed[0];
    if (lastPay) {
      lastPaymentDate = lastPay.received_at || lastPay.created_at || null;
      lastPaymentAmount = Number(lastPay.amount) || null;
      lastPaymentMethod = lastPay.method || lastPay.payment_method || null;
    }
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
