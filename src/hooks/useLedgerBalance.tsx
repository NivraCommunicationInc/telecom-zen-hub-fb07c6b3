/**
 * Hook for real-time ledger balance - V2 Billing System
 * 
 * Uses billing_invoices and billing_payments as source of truth.
 * Balance = sum(invoice totals) - sum(confirmed payments)
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { backendClient } from "@/integrations/backend/client";

export interface LedgerBalance {
  totalDebits: number;
  totalCredits: number;
  balance: number;
  availableCredit: number;
  isCredit: boolean;
  display: string;
  /** Last confirmed payment date */
  lastPaymentDate: string | null;
  /** Last payment amount */
  lastPaymentAmount: number | null;
  /** Last payment method */
  lastPaymentMethod: string | null;
}

/**
 * Fetch ledger balance from V2 billing system
 */
async function fetchLedgerBalance(clientId: string): Promise<LedgerBalance> {
  // Try RPC function first (most efficient)
  const { data: rpcData, error: rpcError } = await backendClient.rpc('get_client_ledger_balance', {
    p_client_id: clientId
  });

  let totalDebits = 0;
  let totalCredits = 0;

  if (!rpcError && rpcData && rpcData.length > 0) {
    const result = rpcData[0];
    totalDebits = Number(result.total_debits) || 0;
    totalCredits = Number(result.total_credits) || 0;
  } else {
    // Fallback: Calculate from V2 tables directly
    console.warn("[useLedgerBalance] RPC unavailable, using V2 tables directly");
    
    // Get customer_id from billing_customers (linked to user_id)
    const { data: customer } = await backendClient
      .from('billing_customers')
      .select('id')
      .eq('user_id', clientId)
      .maybeSingle();

    if (customer) {
      // Sum all invoice totals (debits)
      const { data: invoices } = await backendClient
        .from('billing_invoices')
        .select('total, status')
        .eq('customer_id', customer.id)
        .not('status', 'in', '("cancelled","refunded")');

      for (const inv of invoices || []) {
        totalDebits += Number(inv.total) || 0;
      }

      // Sum all confirmed payments (credits)
      const { data: payments } = await backendClient
        .from('billing_payments')
        .select('amount, status')
        .eq('customer_id', customer.id)
        .eq('status', 'confirmed');

      for (const pay of payments || []) {
        totalCredits += Number(pay.amount) || 0;
      }
    }
  }

  // Fetch last payment info
  const { data: customer } = await backendClient
    .from('billing_customers')
    .select('id')
    .eq('user_id', clientId)
    .maybeSingle();

  let lastPaymentDate: string | null = null;
  let lastPaymentAmount: number | null = null;
  let lastPaymentMethod: string | null = null;

  if (customer) {
    const { data: lastPayment } = await backendClient
      .from('billing_payments')
      .select('amount, method, received_at, created_at')
      .eq('customer_id', customer.id)
      .eq('status', 'confirmed')
      .order('received_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    if (lastPayment) {
      lastPaymentDate = lastPayment.received_at || lastPayment.created_at;
      lastPaymentAmount = Number(lastPayment.amount) || null;
      lastPaymentMethod = lastPayment.method;
    }
  }

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
  };
}

/**
 * Hook for real-time ledger balance with auto-refresh on changes
 */
export function useLedgerBalance(clientId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["ledger-balance", clientId],
    queryFn: () => fetchLedgerBalance(clientId!),
    enabled: !!clientId,
    staleTime: 30000, // 30 seconds
  });

  // Subscribe to real-time changes on V2 tables
  useEffect(() => {
    if (!clientId) return;

    const channel = backendClient
      .channel(`ledger-v2-${clientId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'billing_invoices',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["ledger-balance", clientId] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'billing_payments',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["ledger-balance", clientId] });
        }
      )
      .subscribe();

    return () => {
      backendClient.removeChannel(channel);
    };
  }, [clientId, queryClient]);

  return query;
}

export default useLedgerBalance;
