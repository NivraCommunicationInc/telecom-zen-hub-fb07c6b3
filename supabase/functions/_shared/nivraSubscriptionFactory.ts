/**
 * NIVRA CANONICAL SUBSCRIPTION FACTORY — LOCKED PRODUCTION (2026-03-20)
 * 
 * Single source of truth for ALL Stripe Subscription creation.
 * Every flow (checkout confirmation, admin activation, POS) MUST use this factory.
 * 
 * HARD VALIDATION: A Subscription will NOT be created if required fields are missing.
 * ANTI-DUPLICATION: Same order cannot create duplicate Stripe subscriptions.
 * NO FALLBACK. NO PARTIAL. NO BYPASS.
 */

import Stripe from "npm:stripe@18";
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

// ============================================================================
// TYPES
// ============================================================================

export interface NivraSubscriptionParams {
  stripe: Stripe;
  supabase: SupabaseClient;

  // REQUIRED — will throw if missing
  stripe_customer_id: string;
  customer_email: string;
  order_id: string;
  order_number: string;
  account_id: string;
  customer_id: string; // billing_customers.id
  plan_code: string;   // must exist in stripe_plan_mapping
  invoice_id: string;  // linked initial invoice

  // Payment method — REQUIRED for future charges
  default_payment_method_id: string; // Stripe PaymentMethod ID

  // Optional context
  nivra_subscription_id?: string; // existing billing_subscriptions.id to update
  billing_cycle_anchor?: Date;    // anchor to specific date (default: now)
  trial_end?: number;             // Unix timestamp for trial end
  promo_code_stripe_id?: string;  // Stripe coupon/promo for first period
  metadata_extra?: Record<string, string>;
}

export interface NivraSubscriptionResult {
  stripe_subscription_id: string;
  stripe_status: string;
  current_period_start: string;
  current_period_end: string;
  nivra_subscription_id: string;
  stripe_price_id: string;
  stripe_product_id: string;
}

// ============================================================================
// VALIDATION — HARD GATE
// ============================================================================

function validateRequired(params: NivraSubscriptionParams): void {
  const errors: string[] = [];

  if (!params.stripe_customer_id) errors.push("stripe_customer_id is required");
  if (!params.customer_email) errors.push("customer_email is required");
  if (!params.order_id) errors.push("order_id is required");
  if (!params.order_number) errors.push("order_number is required");
  if (!params.account_id) errors.push("account_id is required");
  if (!params.customer_id) errors.push("customer_id is required");
  if (!params.plan_code) errors.push("plan_code is required");
  if (!params.invoice_id) errors.push("invoice_id is required");
  if (!params.default_payment_method_id) errors.push("default_payment_method_id is required (saved payment method for future charges)");

  if (errors.length > 0) {
    const msg = `[NivraSub] BLOCKED — Subscription creation rejected. Missing required fields:\n${errors.map(e => `  • ${e}`).join("\n")}`;
    console.error(msg);
    throw new Error(msg);
  }
}

// ============================================================================
// FACTORY — Creates Stripe Subscription with full Nivra context
// ============================================================================

export async function createNivraSubscription(
  params: NivraSubscriptionParams
): Promise<NivraSubscriptionResult> {

  // ═══ STEP 1: HARD VALIDATION ═══
  validateRequired(params);

  const { stripe, supabase } = params;

  // ═══ STEP 2: ANTI-DUPLICATION CHECK ═══
  // Check if a Stripe subscription already exists for this order
  const { data: existingSub } = await supabase
    .from("billing_subscriptions")
    .select("id, stripe_subscription_id, stripe_status")
    .eq("order_id", params.order_id)
    .not("stripe_subscription_id", "is", null)
    .maybeSingle();

  if (existingSub?.stripe_subscription_id) {
    console.log(`[NivraSub] Subscription already exists for order ${params.order_id}: ${existingSub.stripe_subscription_id} (status: ${existingSub.stripe_status})`);
    
    // Return existing — idempotent
    const stripeSub = await stripe.subscriptions.retrieve(existingSub.stripe_subscription_id);
    return {
      stripe_subscription_id: existingSub.stripe_subscription_id,
      stripe_status: stripeSub.status,
      current_period_start: new Date(stripeSub.current_period_start * 1000).toISOString(),
      current_period_end: new Date(stripeSub.current_period_end * 1000).toISOString(),
      nivra_subscription_id: existingSub.id,
      stripe_price_id: "",
      stripe_product_id: "",
    };
  }

  // ═══ STEP 3: RESOLVE PLAN MAPPING ═══
  const { data: planMapping, error: planError } = await supabase
    .from("stripe_plan_mapping")
    .select("*")
    .eq("plan_code", params.plan_code)
    .eq("is_active", true)
    .single();

  if (planError || !planMapping) {
    throw new Error(`[NivraSub] BLOCKED — No active Stripe plan mapping found for plan_code="${params.plan_code}". Register it in stripe_plan_mapping first.`);
  }

  // ═══ STEP 4: ENSURE PAYMENT METHOD IS ATTACHED TO CUSTOMER ═══
  try {
    await stripe.paymentMethods.attach(params.default_payment_method_id, {
      customer: params.stripe_customer_id,
    });
  } catch (attachErr: any) {
    // Already attached is fine
    if (!attachErr.message?.includes("already been attached")) {
      console.warn(`[NivraSub] PaymentMethod attach warning: ${attachErr.message}`);
    }
  }

  // Set as default for invoices
  await stripe.customers.update(params.stripe_customer_id, {
    invoice_settings: { default_payment_method: params.default_payment_method_id },
  });

  // ═══ STEP 5: BUILD METADATA ═══
  const metadata: Record<string, string> = {
    source: "nivra_subscription_factory",
    order_id: params.order_id,
    order_number: params.order_number,
    account_id: params.account_id,
    customer_id: params.customer_id,
    invoice_id: params.invoice_id,
    plan_code: params.plan_code,
    plan_name: planMapping.plan_name,
    monthly_amount: String(planMapping.monthly_amount),
    ...(params.metadata_extra || {}),
  };

  // ═══ STEP 6: CREATE STRIPE SUBSCRIPTION ═══
  const subParams: Stripe.SubscriptionCreateParams = {
    customer: params.stripe_customer_id,
    items: [{ price: planMapping.stripe_price_id }],
    default_payment_method: params.default_payment_method_id,
    metadata,
    description: `Nivra Telecom — ${planMapping.plan_name} — Commande ${params.order_number}`,
    collection_method: "charge_automatically",
    payment_behavior: "default_incomplete",
    expand: ["latest_invoice"],
  };

  // Anchor billing cycle if specified
  if (params.billing_cycle_anchor) {
    subParams.billing_cycle_anchor = Math.floor(params.billing_cycle_anchor.getTime() / 1000);
    subParams.proration_behavior = "none";
  }

  // Trial end (skip first charge if initial invoice already paid)
  if (params.trial_end) {
    subParams.trial_end = params.trial_end;
  }

  // Apply Stripe promo/coupon
  if (params.promo_code_stripe_id) {
    subParams.coupon = params.promo_code_stripe_id;
  }

  const stripeSubscription = await stripe.subscriptions.create(subParams);

  console.log(
    `[NivraSub] ✓ Created Stripe Subscription ${stripeSubscription.id} | ${planMapping.plan_name} | status: ${stripeSubscription.status}`
  );

  // ═══ STEP 7: SYNC TO NIVRA DATABASE ═══
  const periodStart = new Date(stripeSubscription.current_period_start * 1000).toISOString();
  const periodEnd = new Date(stripeSubscription.current_period_end * 1000).toISOString();

  const updateData = {
    stripe_subscription_id: stripeSubscription.id,
    stripe_price_id: planMapping.stripe_price_id,
    stripe_product_id: planMapping.stripe_product_id,
    stripe_status: stripeSubscription.status,
    stripe_current_period_start: periodStart,
    stripe_current_period_end: periodEnd,
    stripe_default_payment_method: params.default_payment_method_id,
    next_renewal_at: periodEnd,
    billing_cycle_anchor: params.billing_cycle_anchor?.toISOString() || periodStart,
    status: "active",
    updated_at: new Date().toISOString(),
  };

  let nivraSubscriptionId = params.nivra_subscription_id;

  if (nivraSubscriptionId) {
    // Update existing Nivra subscription
    await supabase
      .from("billing_subscriptions")
      .update(updateData)
      .eq("id", nivraSubscriptionId);
  } else {
    // Find by order_id
    const { data: existingNivra } = await supabase
      .from("billing_subscriptions")
      .select("id")
      .eq("order_id", params.order_id)
      .maybeSingle();

    if (existingNivra) {
      nivraSubscriptionId = existingNivra.id;
      await supabase
        .from("billing_subscriptions")
        .update(updateData)
        .eq("id", nivraSubscriptionId);
    } else {
      // Create new Nivra subscription record
      const { data: newSub, error: insertErr } = await supabase
        .from("billing_subscriptions")
        .insert({
          customer_id: params.customer_id,
          order_id: params.order_id,
          plan_code: params.plan_code,
          plan_name: planMapping.plan_name,
          plan_price: planMapping.monthly_amount,
          cycle_start_date: periodStart.split("T")[0],
          cycle_end_date: periodEnd.split("T")[0],
          environment: "production",
          ...updateData,
        })
        .select("id")
        .single();

      if (insertErr) throw new Error(`[NivraSub] DB insert failed: ${insertErr.message}`);
      nivraSubscriptionId = newSub!.id;
    }
  }

  // ═══ STEP 8: LOG TRACE ═══
  await supabase.from("billing_subscription_trace_audit").insert({
    subscription_id: nivraSubscriptionId!,
    customer_id: params.customer_id,
    action: "stripe_subscription_created",
    source_type: "order",
    source_id: params.order_id,
    details: {
      stripe_subscription_id: stripeSubscription.id,
      stripe_price_id: planMapping.stripe_price_id,
      plan_code: params.plan_code,
      plan_name: planMapping.plan_name,
      status: stripeSubscription.status,
      period_start: periodStart,
      period_end: periodEnd,
    },
    reason: `Stripe Subscription created for order ${params.order_number}`,
  });

  return {
    stripe_subscription_id: stripeSubscription.id,
    stripe_status: stripeSubscription.status,
    current_period_start: periodStart,
    current_period_end: periodEnd,
    nivra_subscription_id: nivraSubscriptionId!,
    stripe_price_id: planMapping.stripe_price_id,
    stripe_product_id: planMapping.stripe_product_id,
  };
}
