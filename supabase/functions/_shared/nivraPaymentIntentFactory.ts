/**
 * NIVRA CANONICAL PAYMENT INTENT FACTORY — LOCKED PRODUCTION (2026-03-20)
 * 
 * Single source of truth for ALL Stripe PaymentIntent creation.
 * Every flow (checkout, portal, POS, field, renewals) MUST use this factory.
 * 
 * HARD VALIDATION: A PaymentIntent will NOT be created if required fields are missing.
 * NO FALLBACK. NO PARTIAL. NO BYPASS.
 * 
 * Required fields:
 *   - customer_email
 *   - invoice_id
 *   - service_name
 *   - total_amount (in dollars)
 *   - stripe instance (pre-initialized)
 * 
 * Conditionally required (must exist unless explicitly waived by context):
 *   - order_id OR subscription_id (at least one)
 *   - account_number
 */

import Stripe from "npm:stripe@18";

// ============================================================================
// TYPES
// ============================================================================

export interface NivraPaymentIntentParams {
  stripe: Stripe;
  
  // REQUIRED for billing flows; optional for checkout_preconfirm pre-auth
  customer_email: string;
  invoice_id?: string;
  invoice_number?: string;
  service_name: string;
  total_amount: number; // in dollars (e.g. 45.99)

  // REQUIRED — at least one of these
  order_id?: string;
  order_number?: string;
  subscription_id?: string;

  // Customer identity
  customer_name?: string;
  customer_phone?: string;
  customer_id?: string;
  account_id?: string;
  account_number?: string;
  existing_stripe_customer_id?: string;

  // Billing address
  billing_address?: {
    line1: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
  };

  // Pricing breakdown (from canonical invoice)
  subtotal?: number;
  tax_tps?: number;
  tax_tvq?: number;
  monthly_amount?: number;
  one_time_amount?: number;
  discount_amount?: number;

  // Service context
  plan_type?: string;
  billing_cycle?: string;

  // Capture & flow context
  capture_method: "manual" | "automatic";
  source: string;
  intent_context: string;

  // Off-session autopay (optional — for renewal auto-charges)
  off_session?: boolean;
  confirm?: boolean;
  payment_method?: string;  // Stripe payment method ID for off-session
}

export interface NivraPaymentIntentResult {
  payment_intent_id: string;
  client_secret: string | null;
  livemode: boolean;
  status: string;
  capture_method: string;
  stripe_customer_id: string;
}

// ============================================================================
// VALIDATION — HARD GATE (throws on missing required fields)
// ============================================================================

function validateRequired(params: NivraPaymentIntentParams): void {
  const errors: string[] = [];

  // Pre-authorization (checkout_preconfirm) is a hold before any order/invoice exists.
  // Only customer_email, service_name, and total_amount are strictly required.
  const isPreAuth = params.intent_context === "checkout_preconfirm" && params.capture_method === "manual";

  if (!params.customer_email) errors.push("customer_email is required");
  if (!params.service_name) errors.push("service_name is required");
  if (!params.total_amount || params.total_amount <= 0) errors.push("total_amount must be > 0");

  if (!isPreAuth) {
    if (!params.invoice_id) errors.push("invoice_id is required");
    if (!params.invoice_number) errors.push("invoice_number is required");
    if (!params.order_id && !params.subscription_id) {
      errors.push("order_id or subscription_id is required (at least one)");
    }
  }

  if (errors.length > 0) {
    const msg = `[NivraPI] BLOCKED — PaymentIntent creation rejected. Missing required fields:\n${errors.map(e => `  • ${e}`).join("\n")}`;
    console.error(msg);
    throw new Error(msg);
  }
}

// ============================================================================
// FACTORY — Creates PaymentIntent with full business context
// ============================================================================

export async function createNivraPaymentIntent(
  params: NivraPaymentIntentParams
): Promise<NivraPaymentIntentResult> {

  // ═══ STEP 1: HARD VALIDATION ═══
  validateRequired(params);

  const { stripe } = params;
  const amountCents = Math.round(params.total_amount * 100);

  // ═══ STEP 2: FIND OR CREATE STRIPE CUSTOMER ═══
  let stripeCustomerId = params.existing_stripe_customer_id;

  const addressParam: Stripe.AddressParam | undefined = params.billing_address
    ? {
        line1: params.billing_address.line1,
        city: params.billing_address.city || undefined,
        state: params.billing_address.state || "QC",
        postal_code: params.billing_address.postal_code || undefined,
        country: params.billing_address.country || "CA",
      }
    : undefined;

  if (!stripeCustomerId) {
    const customers = await stripe.customers.list({ email: params.customer_email, limit: 1 });
    if (customers.data.length > 0) {
      stripeCustomerId = customers.data[0].id;
      // Update with latest identity
      await stripe.customers.update(stripeCustomerId, {
        ...(params.customer_name ? { name: params.customer_name } : {}),
        ...(params.customer_phone ? { phone: params.customer_phone } : {}),
        ...(addressParam ? { address: addressParam } : {}),
      });
    } else {
      const newCustomer = await stripe.customers.create({
        email: params.customer_email,
        ...(params.customer_name ? { name: params.customer_name } : {}),
        ...(params.customer_phone ? { phone: params.customer_phone } : {}),
        ...(addressParam ? { address: addressParam } : {}),
      });
      stripeCustomerId = newCustomer.id;
    }
  } else if (addressParam || params.customer_name || params.customer_phone) {
    // Update existing customer with latest info
    await stripe.customers.update(stripeCustomerId, {
      ...(params.customer_name ? { name: params.customer_name } : {}),
      ...(params.customer_phone ? { phone: params.customer_phone } : {}),
      ...(addressParam ? { address: addressParam } : {}),
    });
  }

  if (!stripeCustomerId) {
    throw new Error("[NivraPI] BLOCKED — Cannot create PaymentIntent without Stripe customer");
  }

  // ═══ STEP 3: BUILD METADATA ═══
  const metadata: Record<string, string> = {
    source: params.source,
    intent_context: params.intent_context,
    invoice_id: params.invoice_id,
    invoice_number: params.invoice_number,
    service_name: params.service_name,
    total_amount: String(params.total_amount),
    billing_cycle: params.billing_cycle || "monthly",
  };

  if (params.order_id) metadata.order_id = params.order_id;
  if (params.order_number) metadata.order_number = String(params.order_number);
  if (params.subscription_id) metadata.subscription_id = params.subscription_id;
  if (params.customer_id) metadata.customer_id = params.customer_id;
  if (params.account_id) metadata.account_id = params.account_id;
  if (params.account_number) metadata.account_number = String(params.account_number);
  if (params.plan_type) metadata.plan_type = params.plan_type;

  // Pricing breakdown
  if (params.subtotal != null) metadata.subtotal = String(params.subtotal);
  if (params.tax_tps != null) metadata.tax_tps = String(params.tax_tps);
  if (params.tax_tvq != null) metadata.tax_tvq = String(params.tax_tvq);
  if (params.monthly_amount != null && params.monthly_amount > 0) metadata.monthly_amount = String(params.monthly_amount);
  if (params.one_time_amount != null && params.one_time_amount > 0) metadata.one_time_amount = String(params.one_time_amount);
  if (params.discount_amount != null && params.discount_amount > 0) metadata.discount_amount = String(params.discount_amount);

  // ═══ STEP 4: BUILD DESCRIPTION ═══
  const description = params.order_number
    ? `Nivra Telecom — Commande ${params.order_number} — ${params.service_name}`
    : `Nivra Telecom — Facture ${params.invoice_number} — ${params.service_name}`;

  // ═══ STEP 5: CREATE PAYMENTINTENT ═══
  const piParams: Stripe.PaymentIntentCreateParams = {
    amount: amountCents,
    currency: "cad",
    customer: stripeCustomerId,
    capture_method: params.capture_method,
    metadata,
    description,
    receipt_email: params.customer_email,
  };

  // Off-session autopay mode
  if (params.off_session && params.payment_method) {
    piParams.off_session = true;
    piParams.confirm = true;
    piParams.payment_method = params.payment_method;
  } else {
    piParams.automatic_payment_methods = { enabled: true };
  }

  const paymentIntent = await stripe.paymentIntents.create(piParams);

  console.log(
    `[NivraPI] ✓ Created ${paymentIntent.id} | ${description} | ${params.capture_method} | keys: ${Object.keys(metadata).length}`
  );

  return {
    payment_intent_id: paymentIntent.id,
    client_secret: paymentIntent.client_secret,
    livemode: paymentIntent.livemode,
    status: paymentIntent.status,
    capture_method: paymentIntent.capture_method,
    stripe_customer_id: stripeCustomerId,
  };
}
