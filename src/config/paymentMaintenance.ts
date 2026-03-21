/**
 * Payment Provider Configuration
 * 
 * CARD/STRIPE PERMANENTLY DISABLED — 2026-03-21
 * Stripe account under review. PayPal is now the primary payment provider.
 * 
 * This flag disables all card/Stripe payment UI entry points system-wide.
 * PayPal and Interac remain active.
 */

/** Card (Stripe) payments are permanently disabled across all portals */
export const CARD_PAYMENTS_DISABLED = true;

/** Stripe is no longer the live payment provider */
export const STRIPE_LIVE_DISABLED = true;

export const CARD_MAINTENANCE_MESSAGE_FR = 
  "Les paiements par carte ne sont pas disponibles pour le moment. Veuillez utiliser PayPal ou Interac.";

export const CARD_MAINTENANCE_MESSAGE_EN = 
  "Card payments are currently unavailable. Please use PayPal or Interac.";
