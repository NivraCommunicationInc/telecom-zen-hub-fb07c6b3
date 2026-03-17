/**
 * createCheckoutDraftInvoice — Canonical draft for Stripe Elements in public checkout.
 *
 * Strictly respects: Commande → Facture → Paiement → Abonnement
 *
 * 1. Resolve account (non-nullable on orders)
 * 2. Resolve billing_customer
 * 3. Create Order (pending)
 * 4. Create Invoice (pending) linked to order_id
 * 5. Return invoiceId for StripeInlinePayment
 *
 * On Stripe success → finalize order + canonical sync.
 * On abandon → records stay "pending".
 */
import { supabase } from "@/integrations/supabase/client";

export interface CheckoutDraftInput {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  totalAmount: number;
  subtotal: number;
  tpsAmount: number;
  tvqAmount: number;
  serviceAddress: string;
  serviceCity: string;
  servicePostalCode: string;
  serviceType: string;
  description?: string;
}

export interface CheckoutDraftInvoiceResult {
  orderId: string;
  orderNumber: string;
  invoiceId: string;
  invoiceNumber: string;
  customerId: string;
  accountId: string;
}

// ── Account resolution (non-nullable on orders) ──

async function resolveAccount(userId: string, address: {
  street: string; city: string; postalCode: string;
}): Promise<{ accountId: string; accountNumber: string }> {
  // Try existing active account
  const { data: existing } = await supabase
    .from("accounts")
    .select("id, account_number")
    .eq("client_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existing) return { accountId: existing.id, accountNumber: existing.account_number || "" };

  // Create new account
  const { data: created, error } = await supabase
    .from("accounts")
    .insert({
      client_id: userId,
      status: "active",
      primary_service_address: address.street || null,
      primary_service_city: address.city || null,
      primary_service_province: "QC",
      primary_service_postal_code: address.postalCode || null,
    })
    .select("id, account_number")
    .single();

  if (error) {
    if (error.code === "23505") {
      const { data: reFetched } = await supabase
        .from("accounts")
        .select("id, account_number")
        .eq("client_id", userId)
        .eq("status", "active")
        .maybeSingle();
      if (reFetched) return { accountId: reFetched.id, accountNumber: reFetched.account_number || "" };
    }
    throw new Error(`Échec résolution compte: ${error.message}`);
  }

  return { accountId: created.id, accountNumber: created.account_number || "" };
}

// ── Billing customer resolution ──

async function resolveBillingCustomer(input: {
  email: string; firstName: string; lastName: string; phone: string; userId: string;
}): Promise<string> {
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
      first_name: input.firstName,
      last_name: input.lastName,
      phone: input.phone,
      user_id: input.userId,
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
    throw new Error(`Échec résolution client facturation: ${error.message}`);
  }

  return created.id;
}

// ── Main function ──

export async function createCheckoutDraftInvoice(
  input: CheckoutDraftInput
): Promise<CheckoutDraftInvoiceResult> {
  const now = new Date().toISOString();

  // 1. Resolve account (orders.account_id is non-nullable)
  const { accountId, accountNumber } = await resolveAccount(input.userId, {
    street: input.serviceAddress,
    city: input.serviceCity,
    postalCode: input.servicePostalCode,
  });

  // 2. Resolve billing customer
  const customerId = await resolveBillingCustomer({
    email: input.email,
    firstName: input.firstName,
    lastName: input.lastName,
    phone: input.phone,
    userId: input.userId,
  });

  // 3. Create Order (pending) — BEFORE invoice
  const { data: newOrder, error: orderErr } = await supabase
    .from("orders")
    .insert([{
      user_id: input.userId,
      account_id: accountId,
      service_type: input.serviceType || "bundle",
      client_email: input.email,
      client_first_name: input.firstName,
      client_last_name: input.lastName,
      client_phone: input.phone,
      service_address: input.serviceAddress,
      service_city: input.serviceCity,
      service_postal_code: input.servicePostalCode,
      subtotal: input.subtotal,
      tps_amount: input.tpsAmount,
      tvq_amount: input.tvqAmount,
      total_amount: input.totalAmount,
      payment_status: "pending",
      payment_method: "card",
      status: "pending",
      internal_notes: "[Checkout public — Stripe card draft]",
    }])
    .select("id, order_number")
    .single();

  if (orderErr || !newOrder) {
    throw new Error(`Échec création commande draft: ${orderErr?.message || "unknown"}`);
  }

  // 4. Generate invoice number
  const d = new Date();
  const dateStr = `${d.getFullYear().toString().slice(-2)}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  const invoiceNumber = `INV-${dateStr}-${rand}`;

  // 5. Create Invoice (pending) linked to order_id
  const invoiceId = crypto.randomUUID();

  const { error: invErr } = await supabase.from("billing_invoices").insert({
    id: invoiceId,
    invoice_number: invoiceNumber,
    customer_id: customerId,
    order_id: newOrder.id,
    status: "pending",
    subtotal: input.subtotal,
    tps_amount: input.tpsAmount,
    tvq_amount: input.tvqAmount,
    total: input.totalAmount,
    amount_paid: 0,
    balance_due: input.totalAmount,
    due_date: now,
    cycle_start_date: now,
    cycle_end_date: now,
    type: "initial",
    currency: "CAD",
    payment_method: "card",
    environment: "live",
    billing_snapshot_account_number: accountNumber,
    billing_snapshot_client: {
      first_name: input.firstName,
      last_name: input.lastName,
      email: input.email,
      phone: input.phone,
    },
    notes: input.description || "Checkout public — Stripe card payment",
  });

  if (invErr) {
    throw new Error(`Échec création facture draft: ${invErr.message}`);
  }

  console.log(`[Checkout Draft] Order ${newOrder.order_number} → Invoice ${invoiceNumber} → ready for Stripe`);

  return {
    orderId: newOrder.id,
    orderNumber: newOrder.order_number,
    invoiceId,
    invoiceNumber,
    customerId,
    accountId,
  };
}
