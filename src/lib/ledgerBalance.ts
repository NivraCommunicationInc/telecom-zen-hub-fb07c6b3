/**
 * Ledger-Based Account Balance Calculator
 * 
 * Single source of truth for account balance calculations.
 * Balance = sum(invoice debits) - sum(captured payments) ± adjustments
 * 
 * RULES:
 * - Only CAPTURED payments reduce balance (not authorized/pending)
 * - Negative balance = "Crédit disponible" (credit on account)
 * - All invoices (billing + monthly_invoices) contribute to debits
 * - e-Transfer must have status 'complete' to count as captured
 */

import { supabase } from "@/integrations/supabase/client";

export interface LedgerEntry {
  id: string;
  type: "debit" | "credit";
  amount: number;
  description: string;
  source: "billing" | "monthly_invoice" | "payment" | "adjustment";
  date: string;
  reference?: string;
  status?: string;
}

export interface LedgerSummary {
  /** Total amount invoiced (debits) */
  totalInvoiced: number;
  /** Total amount captured/paid (credits) */
  totalPaid: number;
  /** Current balance (positive = owes money, negative = credit) */
  balance: number;
  /** Human-readable balance display */
  balanceDisplay: string;
  /** Whether balance is a credit (negative balance) */
  isCredit: boolean;
  /** Detailed ledger entries */
  entries: LedgerEntry[];
}

/**
 * Checks if a payment is considered "captured" (affects balance)
 * 
 * Captured payments:
 * - billing.status = 'paid' with paid_at set
 * - etransfer with complete status
 * - credit card with captured authorization
 */
function isPaymentCaptured(
  status: string | null,
  paidAt: string | null,
  paymentMethod?: string | null,
  etransferStatus?: string | null
): boolean {
  // If explicitly marked as paid with a timestamp, it's captured
  if (status === "paid" && paidAt) {
    return true;
  }
  
  // e-Transfer: only "complete" status counts
  if (paymentMethod?.toLowerCase().includes("interac") || 
      paymentMethod?.toLowerCase().includes("etransfer") ||
      paymentMethod?.toLowerCase().includes("e-transfer")) {
    return etransferStatus?.toLowerCase() === "complete";
  }
  
  // Credit card: if status is paid, it's captured
  if (paymentMethod?.toLowerCase().includes("credit") ||
      paymentMethod?.toLowerCase().includes("card")) {
    return status === "paid";
  }
  
  // Default: only 'paid' status with paid_at counts
  return status === "paid" && !!paidAt;
}

/**
 * Calculate ledger-based account balance for a user
 * 
 * @param userId - The user/client ID
 * @param userEmail - Optional email for cross-referencing
 * @returns LedgerSummary with balance and entries
 */
export async function calculateLedgerBalance(
  userId: string,
  userEmail?: string
): Promise<LedgerSummary> {
  const entries: LedgerEntry[] = [];
  let totalInvoiced = 0;
  let totalPaid = 0;

  try {
    // 1. Fetch billing invoices
    let billingQuery = supabase
      .from("billing")
      .select("*");

    if (userEmail) {
      billingQuery = billingQuery.or(`user_id.eq.${userId},client_email.eq.${userEmail}`);
    } else {
      billingQuery = billingQuery.eq("user_id", userId);
    }

    const { data: billingData, error: billingError } = await billingQuery;
    if (billingError) {
      console.error("[LedgerBalance] Error fetching billing:", billingError);
    }

    // Process billing invoices
    for (const inv of billingData || []) {
      const invoiceAmount = Number(inv.amount) || 0;
      const amountPaid = Number(inv.amount_paid) || 0;
      
      // Skip cancelled/voided invoices
      if (inv.status === "cancelled" || inv.status === "voided") {
        continue;
      }
      
      // Add debit entry for invoice total
      entries.push({
        id: `billing-debit-${inv.id}`,
        type: "debit",
        amount: invoiceAmount,
        description: `Facture ${inv.invoice_number || inv.id.slice(0, 8)}`,
        source: "billing",
        date: inv.created_at,
        reference: inv.invoice_number,
        status: inv.status,
      });
      totalInvoiced += invoiceAmount;
      
      // Only count captured payments as credits
      if (amountPaid > 0 && isPaymentCaptured(inv.status, inv.paid_at)) {
        entries.push({
          id: `billing-credit-${inv.id}`,
          type: "credit",
          amount: amountPaid,
          description: `Paiement ${inv.payment_reference || inv.invoice_number || ""}`.trim(),
          source: "payment",
          date: inv.paid_at || inv.created_at,
          reference: inv.payment_reference,
          status: "captured",
        });
        totalPaid += amountPaid;
      }
    }

    // 2. Fetch monthly invoices
    const { data: monthlyData, error: monthlyError } = await supabase
      .from("monthly_invoices")
      .select("*")
      .eq("client_id", userId);

    if (monthlyError) {
      console.error("[LedgerBalance] Error fetching monthly invoices:", monthlyError);
    }

    // Process monthly invoices
    for (const inv of monthlyData || []) {
      const invoiceAmount = Number(inv.total) || 0;
      const amountPaid = Number(inv.amount_paid) || 0;
      
      // Skip cancelled/voided invoices
      if (inv.status === "cancelled" || inv.status === "voided") {
        continue;
      }
      
      // Add debit entry for invoice total
      entries.push({
        id: `monthly-debit-${inv.id}`,
        type: "debit",
        amount: invoiceAmount,
        description: `Facture mensuelle ${inv.invoice_number || inv.id.slice(0, 8)}`,
        source: "monthly_invoice",
        date: inv.issue_date,
        reference: inv.invoice_number,
        status: inv.status,
      });
      totalInvoiced += invoiceAmount;
      
      // Only count captured payments as credits
      if (amountPaid > 0 && isPaymentCaptured(inv.status, inv.paid_at)) {
        entries.push({
          id: `monthly-credit-${inv.id}`,
          type: "credit",
          amount: amountPaid,
          description: `Paiement ${inv.payment_reference || inv.invoice_number || ""}`.trim(),
          source: "payment",
          date: inv.paid_at || inv.issue_date,
          reference: inv.payment_reference,
          status: "captured",
        });
        totalPaid += amountPaid;
      }
    }

    // Sort entries by date (oldest first)
    entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Calculate balance
    const balance = totalInvoiced - totalPaid;
    const isCredit = balance < 0;
    
    // Format display - if negative, show as "Crédit disponible"
    const absBalance = Math.abs(balance);
    const balanceDisplay = isCredit
      ? `Crédit disponible : ${absBalance.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}`
      : absBalance.toLocaleString("fr-CA", { style: "currency", currency: "CAD" });

    return {
      totalInvoiced: Math.round(totalInvoiced * 100) / 100,
      totalPaid: Math.round(totalPaid * 100) / 100,
      balance: Math.round(balance * 100) / 100,
      balanceDisplay,
      isCredit,
      entries,
    };
  } catch (error) {
    console.error("[LedgerBalance] Calculation error:", error);
    return {
      totalInvoiced: 0,
      totalPaid: 0,
      balance: 0,
      balanceDisplay: "0,00 $",
      isCredit: false,
      entries: [],
    };
  }
}

/**
 * Quick balance check (for UI display, less detailed)
 */
export async function getQuickBalance(userId: string, userEmail?: string): Promise<{
  balance: number;
  isCredit: boolean;
  display: string;
}> {
  const summary = await calculateLedgerBalance(userId, userEmail);
  return {
    balance: summary.balance,
    isCredit: summary.isCredit,
    display: summary.balanceDisplay,
  };
}
