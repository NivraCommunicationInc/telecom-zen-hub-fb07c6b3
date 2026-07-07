/**
 * Payment Provider Configuration — Phase 3.B.3
 *
 * Square is the sole active payment processor for Nivra Telecom.
 * PayPal has been decommissioned (see docs/PHASE_3B2_AUDIT.md).
 */

/** Square is the only accepted payment method */
export const ACTIVE_PAYMENT_PROVIDER = "square" as const;

/** @deprecated PayPal is no longer an active provider. Kept for reference by legacy readers. */
export const PAYPAL_PRIMARY = false;

/** Standard payment priority messaging */
export const PAYMENT_PRIORITY_MESSAGE_FR =
  "Payez facilement par carte de crédit ou débit via Square.";

export const PAYMENT_PRIORITY_MESSAGE_EN =
  "Pay easily with credit or debit card via Square.";
