/**
 * createPOSDraftInvoice — Creates a draft order + invoice for POS card payments.
 *
 * This enables the POS to mount StripeInlinePayment with a real invoice_id
 * BEFORE the card payment is captured. On Stripe success, the order/invoice
 * are finalized. On failure/abandon, they remain in "pending" state.
 *
 * Flow: Create Order (pending) → Find/Create billing_customer → Create Invoice (pending) → Create Invoice Lines
 */

import { supabase } from "@/integrations/supabase/client";
import type { SelectedService } from "@/hooks/useFieldSalesOffers";
import type { EquipmentItem } from "@/components/pos/POSEquipmentSelector";
import type { AdjustmentItem } from "@/components/pos/POSAdjustments";
import type { POSCartTotals } from "@/hooks/useUnifiedPOS";

export interface POSDraftInvoiceInput {
  customer: {
    full_name: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    service_address: string;
    service_city: string;
    service_postal_code: string;
    date_of_birth: string | null;
    client_id?: string | null;
  };
  services: SelectedService[];
  equipment: EquipmentItem[];
  adjustments: AdjustmentItem[];
  totals: POSCartTotals;
  portalType: string;
  notes?: string;
  orderPayload: Record<string, unknown>;
}

export interface POSDraftInvoiceResult {
  orderId: string;
  orderNumber: string;
  invoiceId: string;
  invoiceNumber: string;
  customerId: string;
  totalAmount: number;
}

export async function createPOSDraftInvoice(
  input: POSDraftInvoiceInput
): Promise<POSDraftInvoiceResult> {
  const now = new Date().toISOString();

  // ── 1. Create Order (pending payment) ──
  const { data: newOrder, error: orderErr } = await supabase
    .from("orders")
    .insert([{
      user_id: input.customer.client_id || null,
      service_type: input.services[0]?.category || "bundle",
      client_email: input.customer.email,
      client_dob: input.customer.date_of_birth,
      client_first_name: input.customer.first_name,
      client_last_name: input.customer.last_name,
      client_phone: input.customer.phone,
      service_address: input.customer.service_address,
      service_city: input.customer.service_city,
      service_postal_code: input.customer.service_postal_code,
      equipment_details: JSON.parse(JSON.stringify(input.orderPayload)),
      subtotal: input.totals.taxableAmount,
      tps_amount: input.totals.tps,
      tvq_amount: input.totals.tvq,
      total_amount: input.totals.firstMonthTotal,
      payment_status: "pending",
      payment_reference: null,
      internal_notes: `[POS ${input.portalType.toUpperCase()} — Stripe card] ${input.notes || ""}`,
      status: "pending",
    }])
    .select("id, order_number")
    .single();

  if (orderErr || !newOrder) {
    throw new Error(`Échec de création de commande: ${orderErr?.message || "unknown"}`);
  }

  // ── 2. Find or create billing_customer ──
  let customerId: string;

  // Try to find existing customer by email
  const { data: existingCustomer } = await supabase
    .from("billing_customers")
    .select("id")
    .eq("email", input.customer.email)
    .limit(1)
    .maybeSingle();

  if (existingCustomer) {
    customerId = existingCustomer.id;
  } else {
    const { data: newCustomer, error: custErr } = await supabase
      .from("billing_customers")
      .insert({
        email: input.customer.email,
        first_name: input.customer.first_name,
        last_name: input.customer.last_name,
        phone: input.customer.phone,
        user_id: input.customer.client_id || null,
        status: "active",
      })
      .select("id")
      .single();

    if (custErr || !newCustomer) {
      throw new Error(`Échec de création client: ${custErr?.message || "unknown"}`);
    }
    customerId = newCustomer.id;
  }

  // ── 3. Generate invoice number ──
  const d = new Date();
  const dateStr = `${d.getFullYear().toString().slice(-2)}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  const invoiceNumber = `INV-${dateStr}-${rand}`;

  // ── 4. Create billing_invoice (pending) ──
  const invoiceId = crypto.randomUUID();

  const { error: invErr } = await supabase.from("billing_invoices").insert({
    id: invoiceId,
    invoice_number: invoiceNumber,
    customer_id: customerId,
    order_id: newOrder.id,
    status: "pending",
    subtotal: input.totals.taxableAmount,
    tps_amount: input.totals.tps,
    tvq_amount: input.totals.tvq,
    total: input.totals.firstMonthTotal,
    amount_paid: 0,
    balance_due: input.totals.firstMonthTotal,
    due_date: now,
    cycle_start_date: now,
    cycle_end_date: now,
    type: "initial",
    currency: "CAD",
    payment_method: "card",
    environment: "live",
    billing_snapshot_client: {
      first_name: input.customer.first_name,
      last_name: input.customer.last_name,
      email: input.customer.email,
      phone: input.customer.phone,
    },
  });

  if (invErr) {
    throw new Error(`Échec de création de facture: ${invErr.message}`);
  }

  // ── 5. Create invoice lines ──
  const lines: Array<{
    invoice_id: string;
    description: string;
    unit_price: number;
    quantity: number;
    line_total: number;
    line_type: string;
  }> = [];

  // Service lines
  for (const s of input.services) {
    if (s.priceMonthly > 0) {
      lines.push({
        invoice_id: invoiceId,
        description: `${s.name} — mensuel`,
        unit_price: s.priceMonthly,
        quantity: s.quantity,
        line_total: s.priceMonthly * s.quantity,
        line_type: "service",
      });
    }
    if (s.priceSetup > 0) {
      lines.push({
        invoice_id: invoiceId,
        description: `${s.name} — frais d'installation`,
        unit_price: s.priceSetup,
        quantity: s.quantity,
        line_total: s.priceSetup * s.quantity,
        line_type: "setup",
      });
    }
  }

  // Equipment lines
  for (const e of input.equipment) {
    lines.push({
      invoice_id: invoiceId,
      description: e.name,
      unit_price: e.price,
      quantity: e.quantity,
      line_total: e.price * e.quantity,
      line_type: "equipment",
    });
  }

  // Adjustment lines
  for (const a of input.adjustments) {
    lines.push({
      invoice_id: invoiceId,
      description: a.name,
      unit_price: a.amount,
      quantity: 1,
      line_total: a.amount,
      line_type: a.amount < 0 ? "credit" : "fee",
    });
  }

  // Activation fee
  if (input.totals.activationFee > 0) {
    lines.push({
      invoice_id: invoiceId,
      description: "Frais d'activation",
      unit_price: input.totals.activationFee,
      quantity: 1,
      line_total: input.totals.activationFee,
      line_type: "fee",
    });
  }

  if (lines.length > 0) {
    const { error: linesErr } = await supabase
      .from("billing_invoice_lines")
      .insert(lines);
    if (linesErr) {
      console.error("[POS Draft Invoice] Invoice lines error:", linesErr);
    }
  }

  console.log(`[POS Draft Invoice] Created order ${newOrder.order_number}, invoice ${invoiceNumber} for Stripe payment`);

  return {
    orderId: newOrder.id,
    orderNumber: newOrder.order_number,
    invoiceId,
    invoiceNumber,
    customerId,
    totalAmount: input.totals.firstMonthTotal,
  };
}

/**
 * Finalize a POS order after successful Stripe payment.
 * Updates order payment_status and triggers orchestration.
 */
export async function finalizePOSCardPayment(
  orderId: string,
  portalType: string
): Promise<void> {
  // Update order payment_status
  const { error } = await supabase
    .from("orders")
    .update({ payment_status: "confirmed" })
    .eq("id", orderId);

  if (error) {
    console.error("[POS Finalize] Order update error:", error);
    throw new Error(`Échec de finalisation: ${error.message}`);
  }

  // Trigger orchestration (non-blocking)
  try {
    const { orchestrateOrder } = await import("@/lib/orderOrchestration");
    const result = await orchestrateOrder(orderId);
    console.log(`[POS Finalize] Orchestration result:`, result);
  } catch (orchErr) {
    console.warn("[POS Finalize] Orchestration failed (non-blocking):", orchErr);
  }

  // Auto-create client account (non-blocking)
  // This is handled separately if needed
}
