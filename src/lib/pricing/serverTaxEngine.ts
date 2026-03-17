/**
 * ════════════════════════════════════════════════════════════════
 * Nivra Server Tax Engine — CLIENT-SIDE ESTIMATION ONLY
 * ════════════════════════════════════════════════════════════════
 *
 * ⚠️  THIS IS NOT A SERVER SOURCE OF TRUTH.
 * This module provides LOCAL estimations using hardcoded Quebec
 * tax rates. It exists SOLELY for real-time UI previews where
 * calling a server RPC would be too slow or unnecessary.
 *
 * ALLOWED usage (non-transactional previews):
 *  - Cart previews while user is still editing
 *  - POS real-time display
 *  - Promotion preview calculators
 *  - Admin estimation displays
 *
 * FORBIDDEN usage (transactional / write paths):
 *  - Checkout (must use compute_checkout_pricing RPC)
 *  - Invoice creation (must use compute_invoice_breakdown RPC)
 *  - Payment processing
 *  - PDF generation with final amounts
 *  - Any flow that writes amounts to the database
 *
 * The AUTHORITATIVE server RPCs are:
 *  - compute_checkout_pricing  → checkout totals
 *  - compute_invoice_breakdown → invoice/PDF totals
 *
 * The rates here mirror the server RPC. If tax rates change,
 * update THIS file and the server RPCs together.
 */

// ═══ CANONICAL RATES (Quebec) ═══
// These MUST match the server-side compute_checkout_pricing RPC values.
const QC_TPS_RATE = 0.05;     // 5% TPS (federal GST)
const QC_TVQ_RATE = 0.09975;  // 9.975% TVQ (provincial QST)

/**
 * Synchronous tax estimation for real-time UI previews.
 * NOT authoritative — use computeServerTaxes() for transactions.
 */
export function estimateTaxes(taxableAmount: number): {
  tps: number;
  tvq: number;
  total: number;
  taxableAmount: number;
} {
  const tps = Math.round(taxableAmount * QC_TPS_RATE * 100) / 100;
  const tvq = Math.round(taxableAmount * QC_TVQ_RATE * 100) / 100;
  const total = Math.round((taxableAmount + tps + tvq) * 100) / 100;
  return { tps, tvq, total, taxableAmount };
}

/**
 * Compute recurring monthly total with taxes (estimation for display).
 */
export function estimateMonthlyWithTax(monthlySubtotal: number): number {
  return Math.round(monthlySubtotal * (1 + QC_TPS_RATE + QC_TVQ_RATE) * 100) / 100;
}

/**
 * Combined tax rate for quick multiplication (display only).
 */
export const COMBINED_TAX_MULTIPLIER = 1 + QC_TPS_RATE + QC_TVQ_RATE; // 1.14975

/**
 * Exported rates for display labels (e.g. "TPS (5%)", "TVQ (9.975%)").
 * NEVER use these for transaction calculations — use estimateTaxes() instead.
 */
export const TAX_DISPLAY = {
  TPS_LABEL: "TPS (5%)",
  TVQ_LABEL: "TVQ (9,975%)",
  TPS_PERCENT: "5%",
  TVQ_PERCENT: "9,975%",
} as const;
