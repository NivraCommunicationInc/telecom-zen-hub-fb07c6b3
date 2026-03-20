/**
 * NIVRA — ACTIVATE SUBSCRIPTION FOR ORDER
 * 
 * Shared function called after any payment capture (Stripe or PayPal)
 * to create a Stripe subscription for recurring-eligible orders.
 * 
 * CANONICAL TRIGGER: Called after invoice.status = 'paid' for an order
 * with recurring services.
 * 
 * BLOCKING STATES:
 *   - stripe_setup_status = 'pending'   → waiting for activation
 *   - stripe_setup_status = 'active'    → subscription created
 *   - stripe_setup_status = 'failed'    → creation failed (alert created)
 *   - stripe_setup_status = 'skipped'   → not recurring-eligible (one-time only)
 *   - stripe_setup_status = 'no_stripe' → PayPal/Interac (no Stripe sub possible)
 * 
 * ANTI-DUPLICATION: Factory-level check + pre-check here.
 * RACE-SAFE: Both layers check independently.
 */

import Stripe from "npm:stripe@18";
import { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { createNivraSubscription } from "./nivraSubscriptionFactory.ts";

// ============================================================================
// TYPES
// ============================================================================

export interface ActivateSubscriptionParams {
  stripe: Stripe;
  supabase: SupabaseClient;
  invoice_id: string;
  payment_method_id?: string;       // Stripe PM from captured PI
  stripe_customer_id?: string;      // Override (from PI customer)
  trigger_source: string;           // e.g. "stripe_webhook", "admin_capture", "paypal_capture"
}

export interface ActivateSubscriptionResult {
  activated: boolean;
  skipped: boolean;
  skip_reason?: string;
  stripe_subscription_id?: string;
  items?: Array<{ plan_code: string; stripe_price_id: string; stripe_product_id: string }>;
  stripe_setup_status: string;
  error?: string;
}

// ============================================================================
// NON-RECURRING SERVICE DETECTION
// ============================================================================

const RECURRING_CATEGORIES = new Set([
  "internet", "mobile", "tv_combo", "tv_pack", "streaming", "security",
]);

function isRecurringService(serviceType: string | null, pricingSnapshot: any): boolean {
  if (!serviceType && !pricingSnapshot) return false;
  
  // Check pricing_snapshot for plan_code or category
  if (pricingSnapshot) {
    const planCode = pricingSnapshot.plan_code;
    const category = pricingSnapshot.category || pricingSnapshot.service_category;
    if (planCode || (category && RECURRING_CATEGORIES.has(category))) return true;
  }
  
  // Check service_type string for recurring keywords
  if (serviceType) {
    const lower = serviceType.toLowerCase();
    if (lower.includes("internet") || lower.includes("mobile") || lower.includes("tv") ||
        lower.includes("streaming") || lower.includes("sécurité") || lower.includes("security")) {
      return true;
    }
  }
  
  return false;
}

// ============================================================================
// MAIN ACTIVATION FUNCTION
// ============================================================================

export async function activateSubscriptionForOrder(
  params: ActivateSubscriptionParams
): Promise<ActivateSubscriptionResult> {
  const { stripe, supabase, invoice_id, trigger_source } = params;
  const log = (msg: string) => console.log(`[ActivateSub][${trigger_source}] ${msg}`);

  // ═══ STEP 1: LOAD INVOICE + ORDER CHAIN ═══
  const { data: invoice, error: invErr } = await supabase
    .from("billing_invoices")
    .select("id, order_id, customer_id, status, subscription_id")
    .eq("id", invoice_id)
    .single();

  if (invErr || !invoice) {
    log(`Invoice ${invoice_id} not found — skipping`);
    return { activated: false, skipped: true, skip_reason: "invoice_not_found", stripe_setup_status: "skipped" };
  }

  if (invoice.status !== "paid") {
    log(`Invoice ${invoice_id} not paid (status=${invoice.status}) — skipping`);
    return { activated: false, skipped: true, skip_reason: "invoice_not_paid", stripe_setup_status: "skipped" };
  }

  if (!invoice.order_id) {
    log(`Invoice ${invoice_id} has no order_id — skipping (renewal or credit)`);
    return { activated: false, skipped: true, skip_reason: "no_order_id", stripe_setup_status: "skipped" };
  }

  const orderId = invoice.order_id;

  // ═══ STEP 2: LOAD ORDER ═══
  const { data: order } = await supabase
    .from("orders")
    .select("id, order_number, account_id, service_type, pricing_snapshot")
    .eq("id", orderId)
    .single();

  if (!order) {
    log(`Order ${orderId} not found — skipping`);
    return { activated: false, skipped: true, skip_reason: "order_not_found", stripe_setup_status: "skipped" };
  }

  // ═══ STEP 3: CHECK IF RECURRING-ELIGIBLE ═══
  if (!isRecurringService(order.service_type, order.pricing_snapshot)) {
    log(`Order ${order.order_number} is not recurring-eligible (service_type=${order.service_type}) — marking skipped`);
    
    // Update subscription if exists
    if (invoice.subscription_id) {
      await supabase.from("billing_subscriptions")
        .update({ stripe_setup_status: "skipped" } as any)
        .eq("id", invoice.subscription_id);
    }

    return { activated: false, skipped: true, skip_reason: "not_recurring", stripe_setup_status: "skipped" };
  }

  // ═══ STEP 4: ANTI-DUPLICATION — check existing Stripe subscription ═══
  const { data: existingSub } = await supabase
    .from("billing_subscriptions")
    .select("id, stripe_subscription_id, plan_code, stripe_setup_status")
    .eq("order_id", orderId)
    .maybeSingle();

  if (existingSub?.stripe_subscription_id) {
    log(`Stripe subscription already exists: ${existingSub.stripe_subscription_id} — anti-duplication gate`);
    return {
      activated: false,
      skipped: true,
      skip_reason: "already_exists",
      stripe_subscription_id: existingSub.stripe_subscription_id,
      stripe_setup_status: "active",
    };
  }

  // ═══ STEP 5: RESOLVE BILLING CUSTOMER ═══
  const { data: billingCustomer } = await supabase
    .from("billing_customers")
    .select("id, email, stripe_customer_id, default_payment_method_id")
    .eq("id", invoice.customer_id)
    .single();

  if (!billingCustomer) {
    log(`Billing customer ${invoice.customer_id} not found — FAILED`);
    await setSetupFailed(supabase, existingSub?.id, orderId, "billing_customer_not_found", trigger_source);
    return { activated: false, skipped: false, stripe_setup_status: "failed", error: "billing_customer_not_found" };
  }

  // Use override or stored Stripe customer ID
  const stripeCustomerId = params.stripe_customer_id || billingCustomer.stripe_customer_id;
  if (!stripeCustomerId) {
    log(`No Stripe customer ID for ${billingCustomer.email} — marking no_stripe`);
    await setSetupStatus(supabase, existingSub?.id, "no_stripe");
    return { activated: false, skipped: true, skip_reason: "no_stripe_customer", stripe_setup_status: "no_stripe" };
  }

  // ═══ STEP 6: RESOLVE PAYMENT METHOD ═══
  const paymentMethodId = params.payment_method_id || billingCustomer.default_payment_method_id;
  if (!paymentMethodId) {
    log(`No payment method available — FAILED`);
    await setSetupFailed(supabase, existingSub?.id, orderId, "no_payment_method", trigger_source);
    return { activated: false, skipped: false, stripe_setup_status: "failed", error: "no_payment_method" };
  }

  // ═══ STEP 7: RESOLVE PLAN CODE ═══
  let planCode = (order.pricing_snapshot as any)?.plan_code
    || existingSub?.plan_code || null;

  if (!planCode && order.service_type) {
    const { data: mapping } = await supabase
      .from("stripe_plan_mapping")
      .select("plan_code")
      .ilike("plan_name", `%${order.service_type}%`)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    planCode = mapping?.plan_code;
  }

  if (!planCode) {
    log(`Cannot resolve plan_code for order ${order.order_number} — FAILED`);
    await setSetupFailed(supabase, existingSub?.id, orderId, "plan_code_unresolvable", trigger_source);
    return { activated: false, skipped: false, stripe_setup_status: "failed", error: "plan_code_unresolvable" };
  }

  // ═══ STEP 8: SET PENDING STATUS ═══
  if (existingSub?.id) {
    await supabase.from("billing_subscriptions")
      .update({ stripe_setup_status: "pending" } as any)
      .eq("id", existingSub.id);
  }

  log(`✓ All gates passed — creating subscription: order=${order.order_number}, plan=${planCode}, customer=${stripeCustomerId}`);

  // ═══ STEP 9: RESOLVE ADDITIONAL ITEMS ═══
  const { data: subServices } = await supabase
    .from("billing_subscription_services")
    .select("service_code")
    .eq("subscription_id", existingSub?.id || "")
    .eq("is_active", true);

  const additionalCodes = (subServices || [])
    .map((s: any) => s.service_code)
    .filter((c: string) => c !== planCode);

  // ═══ STEP 10: CREATE STRIPE SUBSCRIPTION (BLOCKING) ═══
  try {
    const result = await createNivraSubscription({
      stripe,
      supabase,
      stripe_customer_id: stripeCustomerId,
      customer_email: billingCustomer.email,
      order_id: orderId,
      order_number: String(order.order_number),
      account_id: order.account_id,
      customer_id: billingCustomer.id,
      plan_code: planCode,
      invoice_id,
      default_payment_method_id: paymentMethodId,
      nivra_subscription_id: existingSub?.id || undefined,
      additional_plan_codes: additionalCodes.length > 0 ? additionalCodes : undefined,
      // Trial = 30 days (first period already paid at checkout)
      trial_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
    });

    // ═══ STEP 11: MARK ACTIVE ═══
    await supabase.from("billing_subscriptions")
      .update({ stripe_setup_status: "active" } as any)
      .eq("id", result.nivra_subscription_id);

    log(`✓ Stripe subscription created: ${result.stripe_subscription_id} | ${result.items.length} items | status: ${result.stripe_status}`);

    return {
      activated: true,
      skipped: false,
      stripe_subscription_id: result.stripe_subscription_id,
      items: result.items,
      stripe_setup_status: "active",
    };

  } catch (createErr: any) {
    log(`✗ Subscription creation FAILED: ${createErr.message}`);
    await setSetupFailed(supabase, existingSub?.id, orderId, createErr.message, trigger_source);

    return {
      activated: false,
      skipped: false,
      stripe_setup_status: "failed",
      error: createErr.message,
    };
  }
}

// ============================================================================
// HELPERS
// ============================================================================

async function setSetupStatus(supabase: SupabaseClient, subId: string | undefined, status: string) {
  if (subId) {
    await supabase.from("billing_subscriptions")
      .update({ stripe_setup_status: status } as any)
      .eq("id", subId);
  }
}

async function setSetupFailed(
  supabase: SupabaseClient,
  subId: string | undefined,
  orderId: string,
  reason: string,
  triggerSource: string,
) {
  // Update subscription status
  if (subId) {
    await supabase.from("billing_subscriptions")
      .update({ stripe_setup_status: "failed" } as any)
      .eq("id", subId);
  }

  // Create system alert for admin visibility
  await supabase.from("billing_system_alerts").insert({
    alert_type: "subscription_setup_failed",
    entity_type: "order",
    entity_id: orderId,
    details: {
      reason,
      trigger_source: triggerSource,
      subscription_id: subId || null,
      timestamp: new Date().toISOString(),
    },
  });

  console.error(`[ActivateSub] ALERT: subscription_setup_failed for order ${orderId}: ${reason}`);
}
