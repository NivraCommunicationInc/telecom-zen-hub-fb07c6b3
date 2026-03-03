/**
 * Hook for real-time ledger balance - UNIFIED Billing System
 * 
 * Combines data from:
 * - billing_invoices + billing_payments (V2 system)
 * - billing table (legacy system)
 * 
 * Balance = sum(all invoice totals) - sum(all confirmed payments)
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
  /** Last confirmed payment date */
  lastPaymentDate: string | null;
  /** Last payment amount */
  lastPaymentAmount: number | null;
  /** Last payment method */
  lastPaymentMethod: string | null;
  /** Number of unpaid invoices */
  unpaidInvoiceCount: number;
}

interface LegacyInvoice {
  id: string;
  invoice_number: string | null;
  amount: number;
  amount_paid: number | null;
  balance_due: number | null;
  status: string;
  due_date: string | null;
  // Some environments/roles may not have column-level SELECT on paid_at.
  // Keep optional so we can safely retry the query without it.
  paid_at?: string | null;
}

/**
 * Fetch unified ledger balance from both V2 and legacy systems
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

  // ============================================
  // PART 1: V2 System (billing_invoices + billing_payments)
  // ============================================
  
  // Get customer_id from billing_customers (linked to user_id)
  const { data: customer, error: customerErr } = await supabaseClient
    .from('billing_customers')
    .select('id')
    .eq('user_id', clientId)
    .maybeSingle();

  if (customerErr) {
    // Don't fail the whole balance if V2 linkage isn't available; legacy billing can still compute the real balance.
    console.warn('[useLedgerBalance] billing_customers lookup failed (will fallback to legacy):', customerErr);
  }

  if (customer) {
    // Sum all invoice totals (debits) from V2
    const { data: invoices, error: invoicesErr } = await supabaseClient
      .from('billing_invoices')
      .select('total, status, balance_due')
      .eq('customer_id', customer.id)
      .not('status', 'in', '("cancelled","refunded")');

    if (invoicesErr) {
      console.warn('[useLedgerBalance] billing_invoices query failed (skipping V2 invoices):', invoicesErr);
    }

    for (const inv of invoices || []) {
      totalDebits += Number(inv.total) || 0;
      // Count unpaid invoices
      const balanceDue = Number(inv.balance_due) || 0;
      if (balanceDue > 0 && inv.status !== 'paid') {
        unpaidInvoiceCount++;
      }
    }

    // Sum all confirmed payments (credits) from V2
    const { data: payments, error: paymentsErr } = await supabaseClient
      .from('billing_payments')
      .select('amount, status, method, received_at, created_at')
      .eq('customer_id', customer.id)
      .eq('status', 'confirmed')
      .order('received_at', { ascending: false, nullsFirst: false });

    if (paymentsErr) {
      console.warn('[useLedgerBalance] billing_payments query failed (skipping V2 payments):', paymentsErr);
    }

    for (const pay of payments || []) {
      totalCredits += Number(pay.amount) || 0;
    }

    // Get last payment from V2
    if (payments && payments.length > 0) {
      const lastPay = payments[0];
      lastPaymentDate = lastPay.received_at || lastPay.created_at;
      lastPaymentAmount = Number(lastPay.amount) || null;
      lastPaymentMethod = lastPay.method;
    }
  }

  // ============================================
  // PART 2: Legacy System (billing table)
  // ============================================

  // IMPORTANT: Some roles may not be allowed to SELECT certain legacy columns (ex: paid_at).
  // We first try the full select, then fallback to a minimal select so balance doesn't incorrectly show 0.
  let legacyInvoices: LegacyInvoice[] = [];

  const queryLegacy = async (select: string) => {
    return await supabaseClient
      .from('billing')
      .select(select)
      .eq('user_id', clientId)
      .not('status', 'in', '("cancelled","voided","refunded")');
  };

  const { data: legacyInvoicesFull, error: legacyFullErr } = await queryLegacy(
    'id, invoice_number, amount, amount_paid, balance_due, status, due_date, paid_at'
  );

  if (!legacyFullErr && legacyInvoicesFull) {
    // Supabase JS typing can return "GenericStringError[]" when schema typings aren't available.
    // We validate at runtime by only using expected fields downstream.
    legacyInvoices = legacyInvoicesFull as unknown as LegacyInvoice[];
  } else {
    if (legacyFullErr) {
      console.warn('[useLedgerBalance] legacy billing query failed with paid_at; retrying minimal select:', legacyFullErr);
    }

    const { data: legacyInvoicesMin, error: legacyMinErr } = await queryLegacy(
      'id, invoice_number, amount, amount_paid, balance_due, status, due_date'
    );

    if (legacyMinErr) {
      console.error('[useLedgerBalance] legacy billing query failed even after retry:', legacyMinErr);
      // If we can't read legacy invoices at all, balance will be unreliable; surface a hard error.
      throw legacyMinErr;
    }

    legacyInvoices = (legacyInvoicesMin || []) as unknown as LegacyInvoice[];
  }

  for (const inv of legacyInvoices as LegacyInvoice[]) {
    const invoiceAmount = Number(inv.amount) || 0;
    const amountPaid = Number(inv.amount_paid) || 0;
    
    // Add invoice total to debits
    totalDebits += invoiceAmount;
    
    // Add confirmed payments to credits
    if (inv.status === 'paid' || inv.paid_at) {
      totalCredits += amountPaid > 0 ? amountPaid : invoiceAmount;
      
      // Track last payment from legacy
      if (inv.paid_at && (!lastPaymentDate || new Date(inv.paid_at) > new Date(lastPaymentDate))) {
        lastPaymentDate = inv.paid_at;
        lastPaymentAmount = amountPaid > 0 ? amountPaid : invoiceAmount;
        lastPaymentMethod = 'interac'; // Legacy mostly used Interac
      }
    } else {
      // Count unpaid legacy invoices
      const rawBalanceDue = inv.balance_due;
      const balanceDue = rawBalanceDue === null || rawBalanceDue === undefined
        ? (invoiceAmount - amountPaid)
        : (Number(rawBalanceDue) || 0);
      if (balanceDue > 0) {
        unpaidInvoiceCount++;
      }
      // If partially paid, add the partial payment to credits
      if (amountPaid > 0) {
        totalCredits += amountPaid;
      }
    }
  }

  // ============================================
  // PART 3: Calculate final balance
  // ============================================
  
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
 * 
 * @param clientId - The user ID to fetch balance for
 * @param supabaseClient - Optional: The authenticated Supabase client to use
 *                         For portal context, pass portalClient
 *                         Defaults to backendClient for admin/staff contexts
 */
export function useLedgerBalance(
  clientId: string | undefined, 
  supabaseClient?: SupabaseClient
) {
  const queryClient = useQueryClient();
  // Use provided client or default to backendClient
  const client = supabaseClient || backendClient;

  const query = useQuery({
    queryKey: ["ledger-balance", clientId],
    queryFn: () => fetchLedgerBalance(clientId!, client),
    enabled: !!clientId,
    staleTime: 30000, // 30 seconds
  });

  // Subscribe to real-time changes on both V2 and legacy tables
  useEffect(() => {
    if (!clientId) return;

    const channel = client
      .channel(`ledger-unified-${clientId}`)
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
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'billing',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["ledger-balance", clientId] });
        }
      )
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  }, [clientId, queryClient, client]);

  return query;
}

export default useLedgerBalance;
