/**
 * checkoutFallback — CANONICAL WRAPPER (Module 54.2 Phase 5)
 *
 * ⚠️ WRITER LOCKED — This file no longer performs any direct writes.
 *
 * Prior to Module 54.2 Phase 5, this module wrote directly into:
 *   - orders
 *   - billing_invoices
 *   - billing_payments
 *   - billing_subscriptions
 *
 * Those writes were the residual non-canonical path that created SUB-001025
 * and SUB-001030 (billing_subscriptions rows without source_type /
 * source_id / source_order_item_id).
 *
 * All operational record creation now routes through the SECURITY-DEFINER
 * canonical Edge Function `checkout-canonical-sync`, which is the sole
 * authorised writer path for guest / client checkouts.
 *
 * This wrapper exists only to preserve the historical call sites in
 * `GuestCheckout.tsx` and `ClientNewOrder.tsx`. It MUST NOT be extended
 * to perform any direct table writes.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { NivraFullCheckoutPayload, NivraFullCheckoutResponse } from "@/lib/api/nivraApi";

/**
 * Route a checkout payload through the canonical `checkout-canonical-sync`
 * Edge Function. Returns a `NivraFullCheckoutResponse` shape for backwards
 * compatibility with the two call sites.
 *
 * No direct writes are performed. If the canonical EF is unavailable, this
 * function throws — checkout MUST fail closed rather than fall back to a
 * non-canonical write path.
 */
export async function fallbackCheckout(
  supabase: SupabaseClient,
  payload: NivraFullCheckoutPayload,
): Promise<NivraFullCheckoutResponse> {
  console.log(
    "[checkoutFallback] Routing through canonical checkout-canonical-sync EF (direct writes disabled — Module 54.2 Phase 5)",
  );

  const { data, error } = await supabase.functions.invoke("checkout-canonical-sync", {
    body: { payload, source: "checkout_fallback_wrapper" },
  });

  if (error) {
    console.error("[checkoutFallback] Canonical EF failed:", error);
    throw new Error(
      `Checkout blocked: canonical sync failed (${error.message}). Direct fallback writes are disabled by Module 54.2 Phase 5 (writer locked).`,
    );
  }

  if (!data || typeof data !== "object") {
    throw new Error("Checkout blocked: canonical EF returned no data.");
  }

  const response = data as Partial<NivraFullCheckoutResponse> & { success?: boolean; error?: string };

  if (response.success === false || response.error) {
    throw new Error(
      `Checkout blocked: canonical EF rejected payload (${response.error || "unknown reason"}).`,
    );
  }

  if (!response.order_id || !response.order_number) {
    throw new Error("Checkout blocked: canonical EF response missing order_id/order_number.");
  }

  return response as NivraFullCheckoutResponse;
}
