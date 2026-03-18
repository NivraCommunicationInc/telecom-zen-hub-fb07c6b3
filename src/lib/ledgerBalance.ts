/**
 * Ledger-Based Account Balance Calculator
 * 
 * Single source of truth for account balance calculations.
 * Now uses ONLY canonical billing_invoices + billing_payments tables.
 * 
 * Balance = sum(invoice totals) - sum(confirmed payments)
 * 
 * RULES:
 * - Only CONFIRMED payments reduce balance
 * - Pre-authorizations do NOT affect balance until confirmed
 * - Negative balance = "Crédit disponible" (credit on account)
 * - All debits come from billing_invoices (canonical Core table)
 * - All credits come from billing_payments (canonical Core table)
 */

import { adminClient as supabase } from "@/integrations/backend";

export interface LedgerEntry {
  id: string;
  type: "debit" | "credit";
  amount: number;
  description: string;
  source: "invoice" | "payment";
  date: string;
  reference?: string;
  status?: string;
  isPreauth?: boolean;
}

export interface LedgerSummary {
  totalInvoiced: number;
  totalPaid: number;
  totalPreauthorized: number;
  balance: number;
  balanceDisplay: string;
  isCredit: boolean;
  entries: LedgerEntry[];
}

/**
 * Calculate ledger-based account balance for a user
 * Uses canonical billing_invoices + billing_payments exclusively.
 */
export async function calculateLedgerBalance(
  userId: string,
  _userEmail?: string
): Promise<LedgerSummary> {
  const entries: LedgerEntry[] = [];
  let totalInvoiced = 0;
  let totalPaid = 0;
  const totalPreauthorized = 0;

  try {
    // Resolve billing_customer
    const { data: customer } = await supabase
      .from("billing_customers")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (customer) {
      // 1. Fetch canonical invoices
      const { data: invoices, error: invError } = await supabase
        .from("billing_invoices")
        .select("id, invoice_number, total, status, created_at, due_date")
        .eq("customer_id", customer.id)
        .not("status", "in", '("void","cancelled")');

      if (invError) {
        console.error("[LedgerBalance] Error fetching billing_invoices:", invError);
      }

      for (const inv of invoices || []) {
        const invoiceAmount = Number(inv.total) || 0;
        entries.push({
          id: `invoice-debit-${inv.id}`,
          type: "debit",
          amount: invoiceAmount,
          description: `Facture ${inv.invoice_number || "—"}`,
          source: "invoice",
          date: inv.created_at,
          reference: inv.invoice_number,
          status: inv.status,
        });
        totalInvoiced += invoiceAmount;
      }

      // 2. Fetch canonical payments
      const { data: payments, error: payError } = await supabase
        .from("billing_payments")
        .select("id, amount, payment_number, status, created_at, reference")
        .eq("customer_id", customer.id)
        .eq("status", "confirmed");

      if (payError) {
        console.error("[LedgerBalance] Error fetching billing_payments:", payError);
      }

      for (const pay of payments || []) {
        const payAmount = Number(pay.amount) || 0;
        entries.push({
          id: `payment-credit-${pay.id}`,
          type: "credit",
          amount: payAmount,
          description: `Paiement ${pay.payment_number || pay.reference || ""}`.trim(),
          source: "payment",
          date: pay.created_at,
          reference: pay.reference,
          status: "confirmed",
          isPreauth: false,
        });
        totalPaid += payAmount;
      }
    }

    // Sort entries by date (oldest first)
    entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const balance = totalInvoiced - totalPaid;
    const isCredit = balance < 0;
    const absBalance = Math.abs(balance);
    const balanceDisplay = isCredit
      ? `Crédit disponible : ${absBalance.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}`
      : absBalance.toLocaleString("fr-CA", { style: "currency", currency: "CAD" });

    return {
      totalInvoiced: Math.round(totalInvoiced * 100) / 100,
      totalPaid: Math.round(totalPaid * 100) / 100,
      totalPreauthorized: Math.round(totalPreauthorized * 100) / 100,
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
      totalPreauthorized: 0,
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
  preauthorized: number;
}> {
  const summary = await calculateLedgerBalance(userId, userEmail);
  return {
    balance: summary.balance,
    isCredit: summary.isCredit,
    display: summary.balanceDisplay,
    preauthorized: summary.totalPreauthorized,
  };
}

export { isPaymentCaptured } from "./billingValidation";
