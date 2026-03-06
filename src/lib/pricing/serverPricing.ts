/**
 * Server-Side Pricing Engine Client
 * Calls compute_checkout_pricing RPC for authoritative pricing.
 * All math is done server-side in cents to avoid floating-point errors.
 * 
 * CRITICAL: This is the ONLY source of truth for all checkout pricing.
 * The frontend must NEVER compute taxes, totals, discounts, or subtotals locally.
 */

import { supabase as defaultClient } from "@/integrations/supabase/client";

export interface CartLineItem {
  type: 'service' | 'one_time_fee' | 'equipment' | 'delivery' | 'installation' | 'activation';
  name: string;
  amount: number; // dollars
  quantity?: number;
}

export interface ServerPricingResult {
  // === Global totals ===
  recurring_subtotal: number;
  one_time_subtotal: number;
  discount_total: number;
  promo_discount: number;
  welcome_discount: number;
  preauth_discount: number;
  taxable_base: number;
  tps_amount: number;
  tvq_amount: number;
  grand_total: number;

  // === Per-block breakdown (one-time) ===
  one_time_tps: number;
  one_time_tvq: number;
  one_time_total_with_tax: number;

  // === Per-block breakdown (monthly) ===
  monthly_tps: number;
  monthly_tvq: number;
  monthly_total_with_tax: number;

  // === Promo details ===
  promo_applied: {
    id: string;
    code: string;
    name: string;
    discount_type: string;
    discount_value: number;
    discount_cents: number;
    discount_amount: number;
    min_payable_cents: number;
    duration: string;
    applies_to: Record<string, boolean>;
  } | null;
  is_new_customer: boolean;
  computed_at: string;

  // === Cent-precision values (for audit / idempotency) ===
  cents: {
    recurring_subtotal: number;
    one_time_subtotal: number;
    discount_total: number;
    promo_discount: number;
    welcome_discount: number;
    taxable_base: number;
    tps: number;
    tvq: number;
    grand_total: number;
    one_time_tps: number;
    one_time_tvq: number;
    one_time_total_with_tax: number;
    monthly_tps: number;
    monthly_tvq: number;
    monthly_total_with_tax: number;
  };
}

/**
 * Runtime guard: prevent silent UI corruption when RPC payload shape is incomplete.
 */
function assertCompletePricingPayload(payload: any): asserts payload is ServerPricingResult {
  const requiredNumericFields: Array<keyof ServerPricingResult> = [
    "recurring_subtotal",
    "one_time_subtotal",
    "discount_total",
    "promo_discount",
    "welcome_discount",
    "preauth_discount",
    "taxable_base",
    "tps_amount",
    "tvq_amount",
    "grand_total",
    "one_time_tps",
    "one_time_tvq",
    "one_time_total_with_tax",
    "monthly_tps",
    "monthly_tvq",
    "monthly_total_with_tax",
  ];

  const missing = requiredNumericFields.filter(
    (field) => typeof payload?.[field] !== "number" || Number.isNaN(payload?.[field]),
  );

  if (missing.length > 0) {
    throw new Error(
      `[ServerPricing] Incomplete pricing payload. Missing/invalid fields: ${missing.join(", ")}`,
    );
  }
}

/**
 * Call server-side pricing engine.
 * Returns authoritative totals computed in cents (no floating-point drift).
 * This is the ONLY function that should provide pricing data to the checkout UI.
 * 
 * @param supabaseClient - Optional Supabase client override (use portalClient for client checkout)
 */
export async function computeCheckoutPricing(
  cartItems: CartLineItem[],
  promoCode?: string | null,
  clientEmail?: string | null,
  clientId?: string | null,
  preauthDiscount: number = 0,
  isNewCustomer: boolean = false,
  supabaseClient?: any,
): Promise<ServerPricingResult> {
  const client = supabaseClient || defaultClient;

  const { data, error } = await client.rpc("compute_checkout_pricing" as any, {
    p_cart_items: cartItems,
    p_promo_code: promoCode || null,
    p_client_email: clientEmail || null,
    p_client_id: clientId || null,
    p_preauth_discount: preauthDiscount,
    p_is_new_customer: isNewCustomer,
  });

  if (error) {
    console.error("[ServerPricing] RPC error:", error);
    throw new Error(`Pricing calculation failed: ${error.message}`);
  }

  assertCompletePricingPayload(data);
  return data;
}
