/**
 * Payment Provider Configuration
 *
 * PayPal is the primary payment provider. Interac is secondary.
 * Card / Stripe has been fully decommissioned (purged 2026-05-18).
 */

/** Card payments are permanently disabled across all portals */
export const CARD_PAYMENTS_DISABLED = true;

/** Stripe is fully removed from the platform */
export const STRIPE_LIVE_DISABLED = true;

/** PayPal is the primary recommended payment method */
export const PAYPAL_PRIMARY = true;

/** Standard payment priority messaging */
export const PAYMENT_PRIORITY_MESSAGE_FR =
  "Payez facilement par PayPal (recommandé) ou par virement Interac.";

export const PAYMENT_PRIORITY_MESSAGE_EN =
  "Pay easily with PayPal (recommended) or by Interac transfer.";
