/**
 * createCheckoutDraftInvoice — Draft Stripe invoice for public checkout.
 *
 * Important behavior:
 * - Creates billing_customer (if missing)
 * - Creates billing_invoice (pending) for Stripe PaymentIntent
 * - Does NOT create orders anymore (prevents ghost orders before final confirmation)
 */
import { portalClient as supabase } from "@/integrations/backend/portalClient";

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
  orderId: string | null;
  orderNumber: string | null;
  invoiceId: string;
  invoiceNumber: string;
  customerId: string;
  accountId: string | null;
}

// ── Account resolution (for billing snapshot only) ──

async function resolveAccount(
  userId: string,
  address: {
    street: string;
    city: string;
    postalCode: string;
  }
): Promise<{ accountId: string; accountNumber: string }> {
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
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  userId: string;
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

  // 1) Resolve account for snapshot only (no order creation here)
  const { accountId, accountNumber } = await resolveAccount(input.userId, {
    street: input.serviceAddress,
    city: input.serviceCity,
    postalCode: input.servicePostalCode,
  });

  // 2) Resolve billing customer
  const customerId = await resolveBillingCustomer({
    email: input.email,
    firstName: input.firstName,
    lastName: input.lastName,
    phone: input.phone,
    userId: input.userId,
  });

  // 3) Generate invoice number
  const d = new Date();
  const dateStr = `${d.getFullYear().toString().slice(-2)}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  const invoiceNumber = `INV-${dateStr}-${rand}`;

  // 4) Create draft invoice (order_id intentionally NULL until final checkout confirmation)
  const invoiceId = crypto.randomUUID();
  const { error: invErr } = await supabase.from("billing_invoices").insert({
    id: invoiceId,
    invoice_number: invoiceNumber,
    customer_id: customerId,
    order_id: null,
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
    notes: input.description || "Checkout public — Stripe card payment draft",
  });

  if (invErr) {
    throw new Error(`Échec création facture draft: ${invErr.message}`);
  }

  console.log(`[Checkout Draft] Invoice ${invoiceNumber} ready for Stripe (no order yet)`);

  return {
    orderId: null,
    orderNumber: null,
    invoiceId,
    invoiceNumber,
    customerId,
    accountId,
  };
}
