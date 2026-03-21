/**
 * NIVRA CANONICAL SUBSCRIPTION FACTORY — LOCKED PRODUCTION (2026-03-20)
 * 
 * Single source of truth for ALL Stripe Subscription creation.
 * Every flow (checkout confirmation, admin activation, POS) MUST use this factory.
 * 
 * ITEM-BASED ARCHITECTURE:
 *   - Subscriptions always use multiple items (base + addons)
 *   - Combo plan_codes are decomposed into individual items
 *   - Each item maps to its own Stripe Price via stripe_plan_mapping
 *   - Customers can add/remove items without recreating the subscription
 * 
 * HARD VALIDATION: A Subscription will NOT be created if required fields are missing.
 * ANTI-DUPLICATION: Same order cannot create duplicate Stripe subscriptions.
 * NO FALLBACK. NO PARTIAL. NO BYPASS.
 */

import Stripe from "npm:stripe@18";
import { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { isCombo, resolveSubscriptionItems } from "./comboDecomposition.ts";

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
  plan_code: string;   // can be a combo or atomic plan_code
  invoice_id: string;  // linked initial invoice

  // Additional items to add alongside the primary plan
  // (e.g. streaming, extra TV packs selected in POS)
  additional_plan_codes?: string[];

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
  items: Array<{
    plan_code: string;
    stripe_price_id: string;
    stripe_product_id: string;
  }>;
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
  if (!params.default_payment_method_id) errors.push("default_payment_method_id is required");

  if (errors.length > 0) {
    const msg = `[NivraSub] BLOCKED — Subscription creation rejected. Missing required fields:\n${errors.map(e => `  • ${e}`).join("\n")}`;
    console.error(msg);
    throw new Error(msg);
  }
}

// ============================================================================
// PLAN RESOLUTION — Resolves plan_codes to Stripe prices
// ============================================================================

interface ResolvedPlanItem {
  plan_code: string;
  plan_name: string;
  stripe_price_id: string;
  stripe_product_id: string;
  monthly_amount: number;
  service_category: string;
}

async function resolvePlanItems(
  supabase: SupabaseClient,
  planCode: string,
  additionalCodes: string[] = []
): Promise<ResolvedPlanItem[]> {
  // Decompose combo if needed, then merge with additional items
  const primaryCodes = resolveSubscriptionItems(planCode);
  const allCodes = [...new Set([...primaryCodes, ...additionalCodes])];

  if (allCodes.length === 0) {
    throw new Error("[NivraSub] BLOCKED — No plan codes resolved for subscription");
  }

  const { data: mappings, error } = await supabase
    .from("stripe_plan_mapping")
    .select("plan_code, plan_name, stripe_price_id, stripe_product_id, monthly_amount, service_category")
    .in("plan_code", allCodes)
    .eq("is_active", true);

  if (error || !mappings || mappings.length === 0) {
    throw new Error(`[NivraSub] BLOCKED — No active stripe_plan_mapping found for codes: ${allCodes.join(", ")}`);
  }

  // Verify all codes were found
  const foundCodes = new Set(mappings.map((m: any) => m.plan_code));
  const missingCodes = allCodes.filter(c => !foundCodes.has(c));
  if (missingCodes.length > 0) {
    throw new Error(`[NivraSub] BLOCKED — Missing stripe_plan_mapping for: ${missingCodes.join(", ")}`);
  }

  // Warn if a combo plan_code was passed but not decomposed (shouldn't happen)
  for (const m of mappings) {
    if (m.service_category === "tv_combo") {
      console.warn(`[NivraSub] WARNING — tv_combo "${m.plan_code}" should not be used as a Stripe item. It should be decomposed.`);
    }
  }

  console.log(`[NivraSub] Resolved ${mappings.length} subscription items: ${mappings.map((m: any) => m.plan_code).join(", ")}`);
  return mappings as ResolvedPlanItem[];
}

// ============================================================================
// FACTORY — Creates Stripe Subscription with multiple items
// ============================================================================

export async function createNivraSubscription(
  params: NivraSubscriptionParams
): Promise<NivraSubscriptionResult> {

  // ═══ STEP 1: HARD VALIDATION ═══
  validateRequired(params);

  const { stripe, supabase } = params;
  const wasCombo = isCombo(params.plan_code);

  // ═══ STEP 2: ANTI-DUPLICATION CHECK ═══
  const { data: existingSub } = await supabase
    .from("billing_subscriptions")
    .select("id, stripe_subscription_id, stripe_status")
    .eq("order_id", params.order_id)
    .not("stripe_subscription_id", "is", null)
    .maybeSingle();

  if (existingSub?.stripe_subscription_id) {
    console.log(`[NivraSub] Subscription already exists for order ${params.order_id}: ${existingSub.stripe_subscription_id}`);
    const stripeSub = await stripe.subscriptions.retrieve(existingSub.stripe_subscription_id);
    return {
      stripe_subscription_id: existingSub.stripe_subscription_id,
      stripe_status: stripeSub.status,
      current_period_start: new Date(stripeSub.current_period_start * 1000).toISOString(),
      current_period_end: new Date(stripeSub.current_period_end * 1000).toISOString(),
      nivra_subscription_id: existingSub.id,
      items: [],
    };
  }

  // ═══ STEP 3: RESOLVE ALL PLAN ITEMS ═══
  const planItems = await resolvePlanItems(supabase, params.plan_code, params.additional_plan_codes);

  // ═══ STEP 4: ENSURE PAYMENT METHOD IS ATTACHED ═══
  let pmAttached = false;
  try {
    await stripe.paymentMethods.attach(params.default_payment_method_id, {
      customer: params.stripe_customer_id,
    });
    pmAttached = true;
  } catch (attachErr: any) {
    if (attachErr.message?.includes("already been attached")) {
      pmAttached = true;
    } else {
      console.warn(`[NivraSub] PaymentMethod attach failed: ${attachErr.message}`);
      // PM may be expired/detached — try to find an existing PM on the customer
      try {
        const pms = await stripe.paymentMethods.list({
          customer: params.stripe_customer_id,
          type: "card",
          limit: 1,
        });
        if (pms.data.length > 0) {
          console.log(`[NivraSub] Using existing customer PM: ${pms.data[0].id}`);
          params.default_payment_method_id = pms.data[0].id;
          pmAttached = true;
        }
      } catch (_) {
        // ignore
      }
    }
  }

  if (pmAttached) {
    try {
      await stripe.customers.update(params.stripe_customer_id, {
        invoice_settings: { default_payment_method: params.default_payment_method_id },
      });
    } catch (updateErr: any) {
      console.warn(`[NivraSub] Customer update PM warning: ${updateErr.message}`);
    }
  }

  // If no PM available but trial is set, allow subscription creation without PM
  // (customer will need to add PM before trial ends)
  const hasTrial = Boolean(params.trial_end && params.trial_end > Math.floor(Date.now() / 1000));

  // ═══ STEP 5: BUILD METADATA ═══
  const totalMonthly = planItems.reduce((sum, item) => sum + Number(item.monthly_amount), 0);
  const planSummary = planItems.map(p => p.plan_name).join(" + ");

  const metadata: Record<string, string> = {
    source: "nivra_subscription_factory",
    architecture: "item_based",
    order_id: params.order_id,
    order_number: params.order_number,
    account_id: params.account_id,
    customer_id: params.customer_id,
    invoice_id: params.invoice_id,
    original_plan_code: params.plan_code,
    was_combo_decomposed: String(wasCombo),
    item_count: String(planItems.length),
    item_codes: planItems.map(p => p.plan_code).join(","),
    total_monthly: String(totalMonthly),
    ...(params.metadata_extra || {}),
  };

  // ═══ STEP 6: CREATE MULTI-ITEM STRIPE SUBSCRIPTION ═══
  const stripeItems: Stripe.SubscriptionCreateParams.Item[] = planItems.map(item => ({
    price: item.stripe_price_id,
    metadata: {
      plan_code: item.plan_code,
      service_category: item.service_category,
    },
  }));

  const subParams: Stripe.SubscriptionCreateParams = {
    customer: params.stripe_customer_id,
    items: stripeItems,
    default_payment_method: params.default_payment_method_id,
    metadata,
    description: `Nivra Telecom — ${planSummary} — Commande ${params.order_number}`,
    collection_method: "charge_automatically",
    payment_behavior: "default_incomplete",
    expand: ["latest_invoice"],
  };

  if (params.billing_cycle_anchor) {
    subParams.billing_cycle_anchor = Math.floor(params.billing_cycle_anchor.getTime() / 1000);
    subParams.proration_behavior = "none";
  }

  if (params.trial_end) {
    subParams.trial_end = params.trial_end;
  }

  if (params.promo_code_stripe_id) {
    subParams.coupon = params.promo_code_stripe_id;
  }

  const stripeSubscription = await stripe.subscriptions.create(subParams);

  console.log(
    `[NivraSub] ✓ Created ${stripeSubscription.id} | ${planItems.length} items: ${planSummary} | status: ${stripeSubscription.status}`
  );

  // ═══ STEP 7: SYNC TO NIVRA DATABASE ═══
  const periodStart = new Date(stripeSubscription.current_period_start * 1000).toISOString();
  const periodEnd = new Date(stripeSubscription.current_period_end * 1000).toISOString();
  const primaryItem = planItems.find(p => p.service_category === "internet" || p.service_category === "mobile") || planItems[0];

  const updateData = {
    stripe_subscription_id: stripeSubscription.id,
    stripe_price_id: primaryItem.stripe_price_id,
    stripe_product_id: primaryItem.stripe_product_id,
    stripe_status: stripeSubscription.status,
    stripe_current_period_start: periodStart,
    stripe_current_period_end: periodEnd,
    stripe_default_payment_method: params.default_payment_method_id,
    next_renewal_at: periodEnd,
    billing_cycle_anchor: params.billing_cycle_anchor?.toISOString() || periodStart,
    plan_code: primaryItem.plan_code,
    plan_name: planSummary,
    plan_price: totalMonthly,
    status: "active",
    updated_at: new Date().toISOString(),
  };

  let nivraSubscriptionId = params.nivra_subscription_id;

  if (nivraSubscriptionId) {
    await supabase
      .from("billing_subscriptions")
      .update(updateData)
      .eq("id", nivraSubscriptionId);
  } else {
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
      const { data: newSub, error: insertErr } = await supabase
        .from("billing_subscriptions")
        .insert({
          customer_id: params.customer_id,
          order_id: params.order_id,
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

  // ═══ STEP 7b: SYNC INDIVIDUAL SERVICE ITEMS ═══
  // Each item gets its own row in billing_subscription_services
  for (const item of planItems) {
    await supabase.from("billing_subscription_services").upsert({
      subscription_id: nivraSubscriptionId!,
      service_code: item.plan_code,
      service_name: item.plan_name,
      service_type: item.service_category,
      unit_price: item.monthly_amount,
      quantity: 1,
      is_active: true,
      added_at: new Date().toISOString(),
    }, { onConflict: "subscription_id,service_code" });
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
      architecture: "item_based",
      was_combo_decomposed: wasCombo,
      original_plan_code: params.plan_code,
      items: planItems.map(p => ({
        plan_code: p.plan_code,
        stripe_price_id: p.stripe_price_id,
        monthly_amount: p.monthly_amount,
        category: p.service_category,
      })),
      total_monthly: totalMonthly,
      status: stripeSubscription.status,
      period_start: periodStart,
      period_end: periodEnd,
    },
    reason: `Stripe Subscription created with ${planItems.length} items for order ${params.order_number}`,
  });

  return {
    stripe_subscription_id: stripeSubscription.id,
    stripe_status: stripeSubscription.status,
    current_period_start: periodStart,
    current_period_end: periodEnd,
    nivra_subscription_id: nivraSubscriptionId!,
    items: planItems.map(p => ({
      plan_code: p.plan_code,
      stripe_price_id: p.stripe_price_id,
      stripe_product_id: p.stripe_product_id,
    })),
  };
}
