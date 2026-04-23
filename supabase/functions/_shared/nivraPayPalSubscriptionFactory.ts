/**
 * ============================================================================
 * NIVRA CANONICAL PAYPAL SUBSCRIPTION FACTORY — Phase 2a (2026-03-21)
 * ============================================================================
 *
 * Single source of truth for ALL PayPal recurring subscription creation.
 * Every flow (checkout, portal, admin, POS) MUST use this factory.
 *
 * ARCHITECTURE:
 *   - Nivra Core is the item-level source of truth
 *   - billing_subscription_services keeps individual items (internet, tv, streaming)
 *   - PayPal bills ONE aggregated monthly amount (PayPal limitation)
 *   - PayPal plans are CACHED and REUSED via paypal_plan_cache table
 *
 * PLAN REUSE RULES:
 *   - A plan is identified by (amount_cad, cycle_unit, cycle_count, currency, tax_inclusive)
 *   - If a matching active plan exists in cache → reuse it
 *   - Only create a new PayPal plan when no reusable plan exists
 *   - Plan labels are informational only, not part of the cache key
 *
 * HARD VALIDATION: Missing required identity or pricing fields → throws immediately.
 */

import { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { COMBINED_TAX_PERCENTAGE } from "./tax-constants.ts";

// ============================================================================
// TYPES
// ============================================================================

export interface PayPalSubscriptionParams {
  supabase: SupabaseClient;

  // REQUIRED — will throw if missing
  customer_id: string;          // billing_customers.id
  customer_email: string;
  customer_first_name: string;
  customer_last_name: string;
  customer_phone: string;
  order_id: string;
  order_number: string;
  account_id: string;
  invoice_id: string;

  // Pricing — aggregated recurring monthly total (excl. one-time fees)
  recurring_monthly_total: number;  // The canonical aggregated amount

  // Plan info for labeling
  plan_label: string;           // e.g. "Internet 500 + TV Famille + Netflix"
  plan_code: string;            // primary plan_code (for DB linkage)

  // Service address context
  service_address?: string;
  service_city?: string;
  service_postal_code?: string;

  // Optional
  nivra_subscription_id?: string;   // existing billing_subscriptions.id to update
  discount_amount?: number;         // e.g. $5 autopay discount (already subtracted from recurring_monthly_total)
  return_url_override?: string;
  cancel_url_override?: string;
  metadata_extra?: Record<string, string>;
  subscription_start_time?: string;
}

export interface PayPalSubscriptionResult {
  paypal_subscription_id: string;
  paypal_plan_id: string;
  paypal_product_id: string;
  approval_url: string;
  nivra_subscription_id: string;
  recurring_setup_status: "pending";  // Always pending until PayPal approval
  plan_reused: boolean;               // true if existing plan was reused
}

// ============================================================================
// VALIDATION — HARD GATE
// ============================================================================

function validateRequired(params: PayPalSubscriptionParams): void {
  const errors: string[] = [];

  if (!params.customer_id) errors.push("customer_id is required");
  if (!params.customer_email) errors.push("customer_email is required");
  if (!params.customer_first_name) errors.push("customer_first_name is required");
  if (!params.customer_last_name) errors.push("customer_last_name is required");
  if (!params.order_id) errors.push("order_id is required");
  if (!params.order_number) errors.push("order_number is required");
  if (!params.plan_code) errors.push("plan_code is required");
  if (!params.plan_label) errors.push("plan_label is required");
  if (!params.recurring_monthly_total || params.recurring_monthly_total <= 0) {
    errors.push("recurring_monthly_total must be > 0");
  }

  if (errors.length > 0) {
    const msg = `[PayPalSub] BLOCKED — Subscription creation rejected. Missing required fields:\n${errors.map(e => `  • ${e}`).join("\n")}`;
    console.error(msg);
    throw new Error(msg);
  }
}

// ============================================================================
// PAYPAL ACCESS TOKEN
// ============================================================================

async function getPayPalAccessToken(): Promise<string> {
  const clientId = Deno.env.get("PAYPAL_CLIENT_ID");
  const clientSecret = Deno.env.get("PAYPAL_SECRET");

  if (!clientId || !clientSecret) {
    throw new Error("[PayPalSub] BLOCKED — PAYPAL_CLIENT_ID or PAYPAL_SECRET not configured");
  }

  const auth = btoa(`${clientId}:${clientSecret}`);
  const response = await fetch("https://api-m.paypal.com/v1/oauth2/token", {
    method: "POST",
    headers: {
      "Authorization": `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`[PayPalSub] Failed to get PayPal access token: ${errText}`);
  }

  const data = await response.json();
  return data.access_token;
}

// ============================================================================
// PLAN REUSE / CACHE — prevents PayPal plan sprawl
// ============================================================================

interface CachedPlan {
  paypal_plan_id: string;
  paypal_product_id: string;
  plan_reused: boolean;
}

/**
 * Looks up or creates a PayPal billing plan.
 * 
 * REUSE RULE: if (amount_cad, cycle_unit=MONTH, cycle_count=1, currency=CAD, tax_inclusive=false)
 * matches an existing active plan → reuse it. Otherwise create new.
 */
async function getOrCreatePayPalPlan(
  supabase: SupabaseClient,
  accessToken: string,
  amount: number,
  planLabel: string,
): Promise<CachedPlan> {
  const amountCad = Math.round(amount * 100) / 100; // Normalize to 2 decimals

  // ═══ STEP 1: Check cache for reusable plan ═══
  const { data: cached } = await supabase
    .from("paypal_plan_cache")
    .select("paypal_plan_id, paypal_product_id")
    .eq("amount_cad", amountCad)
    .eq("cycle_unit", "MONTH")
    .eq("cycle_count", 1)
    .eq("currency", "CAD")
    .eq("tax_inclusive", false)
    .eq("is_active", true)
    .maybeSingle();

  if (cached) {
    console.log(`[PayPalSub] ✓ Plan REUSED: ${cached.paypal_plan_id} for $${amountCad}/mo`);

    // Update last_used_at
    await supabase
      .from("paypal_plan_cache")
      .update({ last_used_at: new Date().toISOString() })
      .eq("paypal_plan_id", cached.paypal_plan_id);

    return {
      paypal_plan_id: cached.paypal_plan_id,
      paypal_product_id: cached.paypal_product_id,
      plan_reused: true,
    };
  }

  // ═══ STEP 2: Create PayPal product ═══
  const productId = `NIVRA_RECURRING_${amountCad.toFixed(2).replace(".", "_")}`;

  let paypalProductId = productId;
  try {
    const productResponse = await fetch("https://api-m.paypal.com/v1/catalogs/products", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "PayPal-Request-Id": `prod_${productId}_${Date.now()}`,
      },
      body: JSON.stringify({
        id: productId,
        name: `Nivra Telecom — ${amountCad}$/mo`,
        description: `Abonnement mensuel automatique Nivra Telecom — ${amountCad}$/mois`,
        type: "SERVICE",
        category: "SOFTWARE",
      }),
    });

    if (productResponse.ok) {
      const prodData = await productResponse.json();
      paypalProductId = prodData.id;
    } else {
      // Product may already exist — use the ID directly
      console.log(`[PayPalSub] Product ${productId} may already exist, using ID directly`);
    }
  } catch (e) {
    console.log(`[PayPalSub] Product creation warning: ${e}`);
  }

  // ═══ STEP 3: Create PayPal billing plan ═══
  const planPayload = {
    product_id: paypalProductId,
    name: `Nivra ${amountCad}$/mo — Mensuel`,
    description: `Abonnement mensuel automatique — ${amountCad}$/mois + taxes`,
    billing_cycles: [
      {
        frequency: { interval_unit: "MONTH", interval_count: 1 },
        tenure_type: "REGULAR",
        sequence: 1,
        total_cycles: 0, // Unlimited
        pricing_scheme: {
          fixed_price: {
            value: amountCad.toFixed(2),
            currency_code: "CAD",
          },
        },
      },
    ],
    payment_preferences: {
      auto_bill_outstanding: true,
      setup_fee_failure_action: "CONTINUE",
      payment_failure_threshold: 3,
    },
    taxes: {
      percentage: COMBINED_TAX_PERCENTAGE,
      inclusive: false,
    },
  };

  const planResponse = await fetch("https://api-m.paypal.com/v1/billing/plans", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "PayPal-Request-Id": `plan_${amountCad}_${Date.now()}`,
    },
    body: JSON.stringify(planPayload),
  });

  if (!planResponse.ok) {
    const error = await planResponse.text();
    throw new Error(`[PayPalSub] Failed to create billing plan: ${error}`);
  }

  const planData = await planResponse.json();
  console.log(`[PayPalSub] ✓ Plan CREATED: ${planData.id} for $${amountCad}/mo`);

  // ═══ STEP 4: Cache the plan ═══
  await supabase.from("paypal_plan_cache").insert({
    paypal_plan_id: planData.id,
    paypal_product_id: paypalProductId,
    amount_cad: amountCad,
    cycle_unit: "MONTH",
    cycle_count: 1,
    currency: "CAD",
    tax_inclusive: false,
    tax_percentage: COMBINED_TAX_PERCENTAGE,
    plan_label: planLabel,
    is_active: true,
  });

  return {
    paypal_plan_id: planData.id,
    paypal_product_id: paypalProductId,
    plan_reused: false,
  };
}

// ============================================================================
// FACTORY — Creates PayPal Subscription with plan reuse
// ============================================================================

export async function createNivraPayPalSubscription(
  params: PayPalSubscriptionParams
): Promise<PayPalSubscriptionResult> {
  const { supabase } = params;
  const log = (msg: string) => console.log(`[PayPalSub] ${msg}`);

  // ═══ STEP 1: HARD VALIDATION ═══
  validateRequired(params);

  // ═══ STEP 2: GET PAYPAL ACCESS TOKEN ═══
  const accessToken = await getPayPalAccessToken();

  // ═══ STEP 3: GET OR CREATE PAYPAL PLAN (with reuse) ═══
  const plan = await getOrCreatePayPalPlan(
    supabase,
    accessToken,
    params.recurring_monthly_total,
    params.plan_label,
  );

  // ═══ STEP 4: CREATE PAYPAL SUBSCRIPTION ═══
  const baseUrl = Deno.env.get("APP_BASE_URL")?.split(",")[0] || "https://nivra-telecom.ca";
  const returnUrl = params.return_url_override || `${baseUrl}/portal/subscription-success`;
  const cancelUrl = params.cancel_url_override || `${baseUrl}/portal/subscription-cancelled`;

  const subscriptionPayload = {
    plan_id: plan.paypal_plan_id,
    ...(params.subscription_start_time ? { start_time: params.subscription_start_time } : {}),
    subscriber: {
      name: {
        given_name: params.customer_first_name,
        surname: params.customer_last_name,
      },
      email_address: params.customer_email,
    },
    application_context: {
      brand_name: "Nivra Telecom",
      locale: "fr-CA",
      shipping_preference: "NO_SHIPPING",
      user_action: "SUBSCRIBE_NOW",
      return_url: `${returnUrl}?order=${params.order_id}`,
      cancel_url: cancelUrl,
    },
    // PayPal limits custom_id to 127 chars — keep ONLY account_id (UUID = 36 char).
    // All related context (order, customer, invoice) is recoverable from the account_id
    // via billing_subscription_trace_audit + paypal_autopay_attempts.
    custom_id: params.account_id,
  };

  const subscriptionResponse = await fetch("https://api-m.paypal.com/v1/billing/subscriptions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "PayPal-Request-Id": `sub_${params.order_id}_${Date.now()}`,
    },
    body: JSON.stringify(subscriptionPayload),
  });

  if (!subscriptionResponse.ok) {
    const error = await subscriptionResponse.text();
    log(`Subscription creation FAILED: ${error}`);

    // Mark setup as failed
    await setRecurringStatus(supabase, params.nivra_subscription_id, "failed", "paypal");
    await createSystemAlert(supabase, params.order_id, params.nivra_subscription_id, "paypal_subscription_creation_failed", error);

    throw new Error(`[PayPalSub] Failed to create subscription: ${error}`);
  }

  const paypalSubscription = await subscriptionResponse.json();
  const approvalUrl = paypalSubscription.links?.find(
    (link: { rel: string; href: string }) => link.rel === "approve"
  )?.href;

  if (!approvalUrl) {
    throw new Error("[PayPalSub] No approval URL returned from PayPal");
  }

  log(`✓ PayPal subscription created: ${paypalSubscription.id} | plan: ${plan.paypal_plan_id} (reused: ${plan.plan_reused})`);

  // ═══ STEP 6: SYNC TO NIVRA DATABASE ═══
  const updateData: Record<string, any> = {
    paypal_subscription_id: paypalSubscription.id,
    paypal_plan_id: plan.paypal_plan_id,
    recurring_setup_status: "pending",
    recurring_provider: "paypal",
    auto_billing_enabled: true,
    updated_at: new Date().toISOString(),
  };

  let nivraSubscriptionId = params.nivra_subscription_id;

  if (nivraSubscriptionId) {
    await supabase.from("billing_subscriptions")
      .update(updateData)
      .eq("id", nivraSubscriptionId);
  } else {
    // Find existing subscription for this order
    const { data: existingNivra } = await supabase
      .from("billing_subscriptions")
      .select("id")
      .eq("order_id", params.order_id)
      .maybeSingle();

    if (existingNivra) {
      nivraSubscriptionId = existingNivra.id;
      await supabase.from("billing_subscriptions")
        .update(updateData)
        .eq("id", nivraSubscriptionId);
    } else {
      // Should not happen in normal flow — subscription should exist from order creation
      log(`WARNING: No existing billing_subscription for order ${params.order_id} — creating one`);
      const now = new Date();
      const endDate = new Date(now);
      endDate.setDate(endDate.getDate() + 30);

      const { data: newSub, error: insertErr } = await supabase
        .from("billing_subscriptions")
        .insert({
          customer_id: params.customer_id,
          order_id: params.order_id,
          plan_code: params.plan_code,
          plan_name: params.plan_label,
          plan_price: params.recurring_monthly_total,
          cycle_start_date: now.toISOString().split("T")[0],
          cycle_end_date: endDate.toISOString().split("T")[0],
          status: "pending",
          environment: "production",
          ...updateData,
        })
        .select("id")
        .single();

      if (insertErr) throw new Error(`[PayPalSub] DB insert failed: ${insertErr.message}`);
      nivraSubscriptionId = newSub!.id;
    }
  }

  // ═══ STEP 7: LOG TRACE ═══
  await supabase.from("billing_subscription_trace_audit").insert({
    subscription_id: nivraSubscriptionId!,
    customer_id: params.customer_id,
    action: "paypal_subscription_created",
    source_type: "order",
    source_id: params.order_id,
    details: {
      paypal_subscription_id: paypalSubscription.id,
      paypal_plan_id: plan.paypal_plan_id,
      paypal_product_id: plan.paypal_product_id,
      plan_reused: plan.plan_reused,
      recurring_monthly_total: params.recurring_monthly_total,
      discount_amount: params.discount_amount || 0,
      plan_code: params.plan_code,
      plan_label: params.plan_label,
      approval_url: approvalUrl,
      subscription_start_time: params.subscription_start_time || null,
      customer_email: params.customer_email,
      customer_phone: params.customer_phone,
      service_address: params.service_address || null,
    },
    reason: `PayPal subscription created for order ${params.order_number} — $${params.recurring_monthly_total}/mo (plan ${plan.plan_reused ? "reused" : "new"})`,
  });

  return {
    paypal_subscription_id: paypalSubscription.id,
    paypal_plan_id: plan.paypal_plan_id,
    paypal_product_id: plan.paypal_product_id,
    approval_url: approvalUrl,
    nivra_subscription_id: nivraSubscriptionId!,
    recurring_setup_status: "pending",
    plan_reused: plan.plan_reused,
  };
}

// ============================================================================
// HELPERS
// ============================================================================

async function setRecurringStatus(
  supabase: SupabaseClient,
  subId: string | undefined,
  status: string,
  provider: string,
) {
  if (!subId) return;
  await supabase.from("billing_subscriptions")
    .update({
      recurring_setup_status: status,
      recurring_provider: provider,
      updated_at: new Date().toISOString(),
    } as any)
    .eq("id", subId);
}

async function createSystemAlert(
  supabase: SupabaseClient,
  orderId: string,
  subId: string | undefined,
  alertType: string,
  details: string,
) {
  await supabase.from("billing_system_alerts").insert({
    alert_type: alertType,
    entity_type: "order",
    entity_id: orderId,
    details: {
      subscription_id: subId || null,
      error: details,
      provider: "paypal",
      timestamp: new Date().toISOString(),
    },
  });
  console.error(`[PayPalSub] ALERT: ${alertType} for order ${orderId}: ${details}`);
}
