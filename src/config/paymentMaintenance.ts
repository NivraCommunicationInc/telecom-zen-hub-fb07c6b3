/**
 * Payment Provider Configuration
 * 
 * CARD/STRIPE PERMANENTLY DISABLED — 2026-03-21
 * PayPal is the primary payment provider. Interac is secondary.
 */

/** Card (Stripe) payments are permanently disabled across all portals */
export const CARD_PAYMENTS_DISABLED = true;

/** Stripe is no longer the live payment provider */
export const STRIPE_LIVE_DISABLED = true;

/** PayPal is the primary recommended payment method */
export const PAYPAL_PRIMARY = true;

/** Standard payment priority messaging */
export const PAYMENT_PRIORITY_MESSAGE_FR = 
  "Payez facilement par PayPal (recommandé) ou par virement Interac.";

export const PAYMENT_PRIORITY_MESSAGE_EN = 
  "Pay easily with PayPal (recommended) or by Interac transfer.";
