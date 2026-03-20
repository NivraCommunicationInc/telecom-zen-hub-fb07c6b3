/**
 * Stripe configuration — LIVE MODE.
 * The publishable key is loaded from environment variables.
 * Publishable keys are PUBLIC and safe for client-side usage.
 */

// Priority: live key env → test key env (no hardcoded fallback)
const envLiveKey = (import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY_LIVE as string | undefined)?.trim();
const envTestKey = (import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY_TEST as string | undefined)?.trim();

export type StripeMode = "test" | "live";

export const STRIPE_PUBLISHABLE_KEY = envLiveKey || envTestKey || "";
export const STRIPE_CHECKOUT_MODE: StripeMode = STRIPE_PUBLISHABLE_KEY.startsWith("pk_live_") ? "live" : "test";

export const getStripePublishableKeyMode = (key: string): StripeMode | "invalid" => {
  if (key.startsWith("pk_test_")) return "test";
  if (key.startsWith("pk_live_")) return "live";
  return "invalid";
};

export const getStripePublishableKey = (): string => STRIPE_PUBLISHABLE_KEY;
