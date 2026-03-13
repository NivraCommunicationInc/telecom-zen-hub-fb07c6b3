/**
 * Server-Side Pricing Engine Client
 * Calls compute_checkout_pricing RPC for authoritative pricing.
 * All math is done server-side in cents to avoid floating-point errors.
 */

import { supabase } from "@/integrations/supabase/client";
import { normalizeServerPricingResult } from "@/lib/pricing/money";

export interface CartLineItem {
  type: 'service' | 'one_time_fee' | 'equipment' | 'delivery' | 'installation' | 'activation';
  name: string;
  amount: number; // dollars
  quantity?: number;
}

export interface ServerPricingResult {
  recurring_subtotal: number;
  one_time_subtotal: number;
  /** Combined total: promo_discount + welcome_discount (display only) */
  discount_total_combined: number;
  promo_discount: number;
  welcome_discount: number;
  welcome_applied: boolean;
  is_new_customer: boolean;
  preauth_discount: number;
  taxable_base: number;
  tps_amount: number;
  tvq_amount: number;
  grand_total: number;
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
    blocked_reason?: string;
  } | null;
  computed_at: string;
  cents: {
    recurring_subtotal: number;
    one_time_subtotal: number;
    /** Combined total: promo_discount + welcome_discount (display only) */
    discount_total_combined: number;
    promo_discount: number;
    welcome_discount: number;
    taxable_base: number;
    tps: number;
    tvq: number;
    grand_total: number;
  };
}

/**
 * Call server-side pricing engine.
 * Returns authoritative totals computed in cents (no floating-point drift).
 */
export async function computeCheckoutPricing(
  cartItems: CartLineItem[],
  promoCode?: string | null,
  clientEmail?: string | null,
  clientId?: string | null,
  preauthDiscount: number = 0,
): Promise<ServerPricingResult> {
  const { data, error } = await supabase.rpc("compute_checkout_pricing" as any, {
    p_cart_items: cartItems,
    p_promo_code: promoCode || null,
    p_client_email: clientEmail || null,
    p_client_id: clientId || null,
    p_preauth_discount: preauthDiscount,
  });

  if (error) {
    console.error("[ServerPricing] RPC error:", error);
    throw new Error(`Pricing calculation failed: ${error.message}`);
  }

  return data as unknown as ServerPricingResult;
}
