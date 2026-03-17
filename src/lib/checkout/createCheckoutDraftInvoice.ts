/**
 * createCheckoutDraftInvoice — Creates a draft billing_invoice for Stripe Elements
 * in the public checkout flow. This provides a real `invoiceId` before payment capture.
 *
 * On Stripe success, the existing checkout-canonical-sync pipeline finalizes everything.
 * On failure/abandon, the invoice remains in "pending" state.
 */
import { supabase } from "@/integrations/supabase/client";

export interface CheckoutDraftInvoiceInput {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  totalAmount: number;
  subtotal: number;
  tpsAmount: number;
  tvqAmount: number;
  description?: string;
}

export interface CheckoutDraftInvoiceResult {
  invoiceId: string;
  invoiceNumber: string;
  customerId: string;
}

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

export async function createCheckoutDraftInvoice(
  input: CheckoutDraftInvoiceInput
): Promise<CheckoutDraftInvoiceResult> {
  const now = new Date().toISOString();

  // 1. Resolve billing customer
  const customerId = await resolveBillingCustomer({
    email: input.email,
    firstName: input.firstName,
    lastName: input.lastName,
    phone: input.phone,
    userId: input.userId,
  });

  // 2. Generate invoice number
  const d = new Date();
  const dateStr = `${d.getFullYear().toString().slice(-2)}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  const invoiceNumber = `INV-${dateStr}-${rand}`;

  // 3. Create pending invoice (no order_id yet — will be linked by canonical sync)
  const invoiceId = crypto.randomUUID();

  const { error: invErr } = await supabase.from("billing_invoices").insert({
    id: invoiceId,
    invoice_number: invoiceNumber,
    customer_id: customerId,
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
    notes: input.description || "Checkout public — Stripe card payment",
  });

  if (invErr) {
    throw new Error(`Échec création facture draft: ${invErr.message}`);
  }

  console.log(`[Checkout Draft Invoice] Created ${invoiceNumber} (${invoiceId}) for Stripe`);

  return { invoiceId, invoiceNumber, customerId };
}
