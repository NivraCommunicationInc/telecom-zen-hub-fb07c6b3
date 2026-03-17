/**
 * ============================================================================
 * CANONICAL TAX CONSTANTS — SINGLE SOURCE OF TRUTH (SERVER-SIDE)
 * ============================================================================
 *
 * All Edge Functions MUST import from this module.
 * DO NOT declare TPS_RATE, TVQ_RATE, or any tax multiplier inline.
 *
 * Quebec tax rates (2024–2025):
 *   TPS (GST) = 5.000 %
 *   TVQ (QST) = 9.975 %
 *   Combined  = 14.975 %
 *
 * Any future rate change is applied HERE and propagates everywhere.
 */

export const TPS_RATE = 0.05;
export const TVQ_RATE = 0.09975;
export const COMBINED_TAX_RATE = TPS_RATE + TVQ_RATE; // 0.14975
export const COMBINED_TAX_PERCENTAGE = "14.975"; // For PayPal API

/**
 * Compute taxes for a given subtotal.
 * All amounts are rounded to 2 decimals (banker-safe).
 */
export function computeTaxes(subtotal: number): {
  tps: number;
  tvq: number;
  total: number;
} {
  const tps = Math.round(subtotal * TPS_RATE * 100) / 100;
  const tvq = Math.round(subtotal * TVQ_RATE * 100) / 100;
  const total = Math.round((subtotal + tps + tvq) * 100) / 100;
  return { tps, tvq, total };
}
