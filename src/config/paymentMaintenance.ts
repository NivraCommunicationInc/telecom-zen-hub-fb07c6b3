/**
 * Payment Maintenance Configuration
 * 
 * Central flag to disable credit card (Stripe) payments across the platform.
 * Set CARD_PAYMENTS_DISABLED to false to re-enable card payments.
 * 
 * DO NOT modify backend billing logic or Stripe configuration.
 * This only affects UI entry points.
 */

export const CARD_PAYMENTS_DISABLED = true;

export const CARD_MAINTENANCE_MESSAGE_FR = 
  "Les paiements par carte sont temporairement indisponibles pour maintenance. Veuillez utiliser PayPal.";

export const CARD_MAINTENANCE_MESSAGE_EN = 
  "Card payments are temporarily unavailable for maintenance. Please use PayPal.";
