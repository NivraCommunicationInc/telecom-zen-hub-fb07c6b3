/**
 * Stripe configuration — LIVE MODE.
 * The publishable key is loaded from environment variables.
 * Publishable keys are PUBLIC and safe for client-side usage.
 */

const normalizePublishableKey = (value: string | undefined): string => {
  if (!value) return "";
  const unquoted = value.trim().replace(/^['\"]+|['\"]+$/g, "");
  if (!unquoted) return "";

  const extracted = unquoted.match(/pk_(?:live|test)_[A-Za-z0-9_]+/);
  return extracted?.[0] ?? unquoted;
};

// Priority: explicit live key -> generic key -> explicit test key
const envLiveKey = normalizePublishableKey(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY_LIVE as string | undefined);
const envGenericKey = normalizePublishableKey(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined);
const envTestKey = normalizePublishableKey(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY_TEST as string | undefined);

export type StripeMode = "test" | "live";

export const STRIPE_PUBLISHABLE_KEY = envLiveKey || envGenericKey || envTestKey || "";
export const STRIPE_CHECKOUT_MODE: StripeMode = STRIPE_PUBLISHABLE_KEY.startsWith("pk_live_") ? "live" : "test";

export const getStripePublishableKeyMode = (key: string): StripeMode | "invalid" => {
  const normalized = normalizePublishableKey(key);
  if (normalized.startsWith("pk_test_")) return "test";
  if (normalized.startsWith("pk_live_")) return "live";
  return "invalid";
};

export const getStripePublishableKey = (): string => STRIPE_PUBLISHABLE_KEY;
