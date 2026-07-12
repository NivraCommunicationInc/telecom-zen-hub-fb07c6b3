/**
 * createPOSDraftInvoice — Creates a draft order + invoice for POS card payments.
 *
 * Enables the POS to mount the card processor (PayPal hosted card) with a real
 * invoice_id BEFORE the card payment is captured. On success the order/invoice
 * are finalized; on failure/abandon they remain in "pending" state.
 *
 * Flow: Resolve Account → Create Order (pending) → Find/Create billing_customer
 *       → Create Invoice (pending) → Create Invoice Lines
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
  accountId: string;
  totalAmount: number;
}

/**
 * Resolve or create an account for the client.
 * Follows the same idempotent pattern as checkoutFallback.
 */
async function resolveAccount(clientId: string | null, serviceAddress: {
  address: string;
  city: string;
  postal_code: string;
}): Promise<{ accountId: string; accountNumber: string }> {
  // If we have a client_id, try to find their existing account
  if (clientId) {
    const { data: existing } = await supabase
      .from("accounts")
      .select("id, account_number")
      .eq("client_id", clientId)
      .eq("status", "active")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (existing) {
      return { accountId: existing.id, accountNumber: existing.account_number || "" };
    }
  }

  // Create new account — requires a client_id
  if (!clientId) {
    throw new Error("Impossible de créer un compte sans client_id. Créez d'abord le client.");
  }

  const { data: newAcct, error: acctErr } = await supabase
    .from("accounts")
    .insert({
      client_id: clientId,
      status: "active",
      primary_service_address: serviceAddress.address || null,
      primary_service_city: serviceAddress.city || null,
      primary_service_province: "QC",
      primary_service_postal_code: serviceAddress.postal_code || null,
    })
    .select("id, account_number")
    .single();

  if (acctErr) {
    // Handle race condition
    if (acctErr.code === "23505") {
      const { data: reFetched } = await supabase
        .from("accounts")
        .select("id, account_number")
        .eq("client_id", clientId)
        .eq("status", "active")
        .maybeSingle();
      if (reFetched) {
        return { accountId: reFetched.id, accountNumber: reFetched.account_number || "" };
      }
    }
    throw new Error(`Échec de création du compte: ${acctErr.message}`);
  }

  return { accountId: newAcct.id, accountNumber: newAcct.account_number || "" };
}

/**
 * Resolve or create billing_customer.
 */
async function resolveBillingCustomer(input: {
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  client_id: string | null;
}): Promise<string> {
  // Try by email first
  const { data: existing } = await supabase
    .from("billing_customers")
    .select("id")
    .eq("email", input.email)
    .limit(1)
    .maybeSingle();

  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from("billing_customers")
    .insert({
      email: input.email,
      first_name: input.first_name,
      last_name: input.last_name,
      phone: input.phone,
      user_id: input.client_id,
      status: "active",
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      const { data: reFetched } = await supabase
        .from("billing_customers")
        .select("id")
        .eq("email", input.email)
        .maybeSingle();
      if (reFetched) return reFetched.id;
    }
    throw new Error(`Échec de création client facturation: ${error.message}`);
  }

  return created.id;
}

/**
 * For POS card payments, we first need to ensure the client has an auth user
 * and account. This calls auto-create-client-account to handle that.
 */
async function ensureClientAccount(input: POSDraftInvoiceInput): Promise<string> {
  // If we already have a client_id, use it
  if (input.customer.client_id) return input.customer.client_id;

  // Create via edge function
  const { data, error } = await supabase.functions.invoke("auto-create-client-account", {
    body: {
      email: input.customer.email,
      first_name: input.customer.first_name,
      last_name: input.customer.last_name,
      phone: input.customer.phone,
      service_address: input.customer.service_address,
      service_city: input.customer.service_city,
      service_postal_code: input.customer.service_postal_code,
      date_of_birth: input.customer.date_of_birth,
    },
  });

  if (error) throw new Error(`Échec de création du compte client: ${error.message}`);
  if (!data?.user_id) throw new Error("Le compte client n'a pas retourné de user_id");

  return data.user_id;
}

export async function createPOSDraftInvoice(
  input: POSDraftInvoiceInput
): Promise<POSDraftInvoiceResult> {
  const now = new Date().toISOString();

  // ── 1. Ensure client has an auth user ──
  const clientId = await ensureClientAccount(input);

  // ── 2. Resolve or create account ──
  const { accountId, accountNumber } = await resolveAccount(clientId, {
    address: input.customer.service_address,
    city: input.customer.service_city,
    postal_code: input.customer.service_postal_code,
  });

  // ── 3. Resolve or create billing_customer ──
  const customerId = await resolveBillingCustomer({
    email: input.customer.email,
    first_name: input.customer.first_name,
    last_name: input.customer.last_name,
    phone: input.customer.phone,
    client_id: clientId,
  });

  // ── 4. Create Order (pending payment) ──
  const { data: newOrder, error: orderErr } = await supabase
    .from("orders")
    .insert([{
      user_id: clientId,
      account_id: accountId,
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
      payment_method: "card",
      payment_reference: null,
      internal_notes: `[POS ${input.portalType.toUpperCase()} — card] ${input.notes || ""}`,
      status: "pending",
    }])
    .select("id, order_number")
    .single();

  if (orderErr || !newOrder) {
    throw new Error(`Échec de création de commande: ${orderErr?.message || "unknown"}`);
  }

  // ── BUG-CORE-002C Phase 1: appointments hold ONLY for technician installs ──
  //   installation.mode: "self" → auto (no hold, ship path) | "technician" → hold created
  try {
    const installation = (input.orderPayload as any)?.installation;
    const rawMode = String(installation?.mode || "").toLowerCase().trim();
    let installationMethod: "auto" | "technician" | null = null;
    if (rawMode === "technician") installationMethod = "technician";
    else if (rawMode === "self") installationMethod = "auto";
    else if (rawMode) {
      console.warn(`[createPOSDraftInvoice] invalid installation.mode='${rawMode}' — no hold created`);
    }

    if (
      installationMethod === "technician" &&
      installation?.required &&
      installation?.date &&
      typeof installation?.time_slot === "string" &&
      /^\d{2}:\d{2}-\d{2}:\d{2}$/.test(installation.time_slot)
    ) {
      const startTime = installation.time_slot.split("-")[0];
      const scheduledAt = new Date(`${installation.date}T${startTime}:00`).toISOString();
      const { error: apptErr } = await supabase.from("appointments").insert({
        order_id: newOrder.id,
        client_id: input.customer.client_id || null,
        client_email: input.customer.email,
        client_phone: input.customer.phone,
        service_address: input.customer.service_address,
        service_city: input.customer.service_city,
        service_postal_code: input.customer.service_postal_code,
        title: `Installation — ${newOrder.order_number}`,
        scheduled_at: scheduledAt,
        status: "hold",
        installation_method: installationMethod,
        internal_notes: `[BUG-CORE-002C] Hold technicien créé depuis POS ${input.portalType} • window=${installation.time_slot}`,
      } as any);
      if (apptErr) {
        console.warn("[createPOSDraftInvoice] appointment hold insert failed (non-blocking):", apptErr.message);
      }
    } else if (installationMethod === "auto") {
      console.log(`[createPOSDraftInvoice] auto-install order ${newOrder.order_number} — no appointment hold`);
    }
  } catch (holdErr) {
    console.warn("[createPOSDraftInvoice] appointment hold exception (non-blocking):", holdErr);
  }

  // ── 5. Generate invoice number ──
  const d = new Date();
  const dateStr = `${d.getFullYear().toString().slice(-2)}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  const invoiceNumber = `INV-${dateStr}-${rand}`;

  // ── 6. Create billing_invoice (pending) ──
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
    billing_snapshot_account_number: accountNumber,
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

  // ── 7. Create invoice lines ──
  const lines: Array<{
    invoice_id: string;
    description: string;
    unit_price: number;
    quantity: number;
    line_total: number;
    line_type: string;
  }> = [];

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

  console.log(`[POS Draft Invoice] Created order ${newOrder.order_number}, invoice ${invoiceNumber}, account ${accountNumber} for card payment`);

  return {
    orderId: newOrder.id,
    orderNumber: newOrder.order_number,
    invoiceId,
    invoiceNumber,
    customerId,
    accountId,
    totalAmount: input.totals.firstMonthTotal,
  };
}

/**
 * Finalize a POS order after successful card payment.
 * Updates order payment_status and triggers orchestration.
 */
export async function finalizePOSCardPayment(
  orderId: string,
  _portalType: string
): Promise<void> {
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
}
