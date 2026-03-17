/**
 * Stripe configuration — publishable keys for Elements integration.
 * Publishable keys are PUBLIC and safe for client-side usage.
 */

const DEFAULT_TEST_PUBLISHABLE_KEY =
  "pk_test_51TBfz40SJA9ekHDikHYOdjeq5eULJrccdfaBS8YVINunYgME0qpAS1Pg407yLmLBBhYbQBDHSMIBsIMi8TrVLN4c003LCvH2p5";

const envTestKey = (import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY_TEST as string | undefined)?.trim();
const envLiveKey = (import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY_LIVE as string | undefined)?.trim();

export type StripeMode = "test" | "live";

export const STRIPE_PUBLISHABLE_KEYS: Record<StripeMode, string> = {
  test: envTestKey || DEFAULT_TEST_PUBLISHABLE_KEY,
  live: envLiveKey || (envTestKey || DEFAULT_TEST_PUBLISHABLE_KEY).replace(/^pk_test_/, "pk_live_"),
};

export const STRIPE_PUBLISHABLE_KEY = STRIPE_PUBLISHABLE_KEYS.test;

export const getStripePublishableKeyMode = (key: string): StripeMode | "invalid" => {
  if (key.startsWith("pk_test_")) return "test";
  if (key.startsWith("pk_live_")) return "live";
  return "invalid";
};

export const getStripePublishableKey = (mode: StripeMode): string =>
  STRIPE_PUBLISHABLE_KEYS[mode];
