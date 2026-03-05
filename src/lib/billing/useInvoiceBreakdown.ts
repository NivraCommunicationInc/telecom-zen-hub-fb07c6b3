/**
 * useInvoiceBreakdown - SINGLE SOURCE OF TRUTH hook
 * Calls compute_invoice_breakdown RPC (server-side, cents-based)
 * All UI consumers MUST use this — zero client-side math.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface InvoiceBreakdownItem {
  id: string;
  line_type: string; // 'service' | 'equipment' | 'fee' | 'discount' | 'credit'
  description: string;
  quantity: number;
  unit_price_cents: number;
  line_total_cents: number;
  metadata: Record<string, any>;
}

export interface InvoiceBreakdownPayment {
  id: string;
  method: string;
  amount_cents: number;
  status: string;
  reference: string | null;
  provider: string | null;
  provider_payment_id: string | null;
  received_at: string | null;
  created_at: string;
}

export interface InvoiceBreakdown {
  invoice_id: string;
  invoice_number: string;
  type: string;
  status: string;
  customer_id: string;
  cycle_start_date: string;
  cycle_end_date: string;
  due_date: string;
  created_at: string;
  paid_at: string | null;
  order_id: string | null;
  notes: string | null;
  billing_snapshot_client: any;
  billing_snapshot_account_number: string | null;
  items: InvoiceBreakdownItem[];
  // Cents (source of truth)
  subtotal_cents: number;
  services_subtotal_cents: number;
  discounts_total_cents: number;
  taxable_subtotal_cents: number;
  tps_cents: number;
  tvq_cents: number;
  total_cents: number;
  amount_paid_cents: number;
  balance_due_cents: number;
  payments: InvoiceBreakdownPayment[];
  // Convenience dollars (display only)
  subtotal: number;
  discounts_total: number;
  taxable_subtotal: number;
  tps_amount: number;
  tvq_amount: number;
  total: number;
  amount_paid: number;
  balance_due: number;
  // Error case
  error?: string;
}

/**
 * Fetch breakdown for a single invoice via RPC
 */
export async function fetchInvoiceBreakdown(invoiceId: string): Promise<InvoiceBreakdown> {
  const { data, error } = await supabase.rpc("compute_invoice_breakdown", {
    p_invoice_id: invoiceId,
  });

  if (error) throw new Error(`compute_invoice_breakdown failed: ${error.message}`);
  if (!data || (data as any).error) {
    throw new Error((data as any)?.error || "No breakdown returned");
  }

  return data as unknown as InvoiceBreakdown;
}

/**
 * Fetch breakdowns for multiple invoices (batched)
 */
export async function fetchInvoiceBreakdowns(invoiceIds: string[]): Promise<Map<string, InvoiceBreakdown>> {
  const results = new Map<string, InvoiceBreakdown>();
  
  // Batch in parallel (max 20 concurrent)
  const batches: string[][] = [];
  for (let i = 0; i < invoiceIds.length; i += 20) {
    batches.push(invoiceIds.slice(i, i + 20));
  }

  for (const batch of batches) {
    const promises = batch.map(async (id) => {
      try {
        const bd = await fetchInvoiceBreakdown(id);
        results.set(id, bd);
      } catch (e) {
        console.error(`[breakdown] Failed for ${id}:`, e);
      }
    });
    await Promise.all(promises);
  }

  return results;
}

/**
 * React Query hook for a single invoice breakdown
 */
export function useInvoiceBreakdown(invoiceId: string | undefined | null) {
  return useQuery({
    queryKey: ["invoice-breakdown", invoiceId],
    queryFn: () => fetchInvoiceBreakdown(invoiceId!),
    enabled: !!invoiceId,
    staleTime: 30_000, // 30s cache
  });
}

/**
 * React Query hook for multiple invoice breakdowns
 */
export function useInvoiceBreakdowns(invoiceIds: string[]) {
  return useQuery({
    queryKey: ["invoice-breakdowns", invoiceIds.sort().join(",")],
    queryFn: () => fetchInvoiceBreakdowns(invoiceIds),
    enabled: invoiceIds.length > 0,
    staleTime: 30_000,
  });
}

/**
 * Format cents to CAD string
 */
export function centsToCAD(cents: number): string {
  return (cents / 100).toLocaleString("fr-CA", { style: "currency", currency: "CAD" });
}

/**
 * Convert breakdown to InvoiceDataV2 for PDF generation
 */
export function breakdownToInvoiceDataV2(
  bd: InvoiceBreakdown,
  customer: {
    full_name: string;
    email: string;
    phone?: string;
    address_line1: string;
    city: string;
    province: string;
    postal_code: string;
  },
  accountNumber: string,
) {
  const items = bd.items
    .filter((i) => i.line_type !== "discount")
    .map((i) => ({
      category: mapLineTypeToCategory(i.line_type),
      description: i.description,
      qty: i.quantity,
      unit_price: i.unit_price_cents / 100,
      amount: i.line_total_cents / 100,
      is_recurring: bd.type === "renewal",
    }));

  const discounts = bd.items
    .filter((i) => i.line_type === "discount")
    .map((i) => ({
      label: i.description,
      amount: Math.abs(i.line_total_cents) / 100,
      applies_to: "services",
    }));

  const payments = bd.payments
    .filter((p) => p.status === "confirmed")
    .map((p) => ({
      method: p.method || "Manual",
      status: "Captured" as const,
      paid_amount: p.amount_cents / 100,
      paid_at: p.received_at || p.created_at,
      payment_reference: p.reference || "",
      processor_txn_id: p.provider_payment_id || undefined,
    }));

  return {
    invoice_type: bd.type === "renewal" ? ("MONTHLY" as const) : ("ONETIME" as const),
    invoice_number: bd.invoice_number,
    account_number: accountNumber || "Non fourni par le client",
    invoice_date: bd.created_at,
    due_date: bd.due_date,
    billing_period_start: bd.type === "renewal" ? bd.cycle_start_date : undefined,
    billing_period_end: bd.type === "renewal" ? bd.cycle_end_date : undefined,
    currency: "CAD" as const,
    status: mapStatus(bd.status),
    customer,
    items,
    discounts: discounts.length > 0 ? discounts : undefined,
    subtotal: bd.subtotal,
    taxes: {
      gst_rate: 0.05,
      gst_amount: bd.tps_amount,
      qst_rate: 0.09975,
      qst_amount: bd.tvq_amount,
    },
    total: bd.total,
    balance_due: bd.balance_due,
    payments,
    payments_total: bd.amount_paid,
  };
}

function mapLineTypeToCategory(lineType: string) {
  switch (lineType) {
    case "service": return "Mobile" as const;
    case "equipment": return "Equipment" as const;
    case "fee": return "Fees" as const;
    case "credit": return "Other" as const;
    default: return "Other" as const;
  }
}

function mapStatus(status: string) {
  switch (status) {
    case "paid": return "Paid" as const;
    case "pending": return "Pending" as const;
    case "overdue": return "Expired" as const;
    case "void":
    case "cancelled": return "Cancelled" as const;
    default: return "Pending" as const;
  }
}
