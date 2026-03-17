/**
 * ════════════════════════════════════════════════════════════════
 * Nivra Server Tax Engine — SINGLE SOURCE OF TRUTH
 * ════════════════════════════════════════════════════════════════
 *
 * ALL tax calculations across the entire frontend MUST go through
 * this module. No component is allowed to define its own TAX_RATES
 * or compute TPS/TVQ inline.
 *
 * Two modes:
 *  1. estimateTaxes()     — synchronous, for real-time UI previews only
 *  2. computeServerTaxes() — async RPC call, authoritative for transactions
 *
 * RULE: Any flow that writes to the database (checkout, invoice creation,
 * order processing) MUST use computeServerTaxes() or the dedicated
 * compute_checkout_pricing / compute_invoice_breakdown RPCs.
 *
 * estimateTaxes() is acceptable ONLY for:
 *  - Cart previews while user is still editing
 *  - POS real-time display
 *  - Promotion preview calculators
 *  - Admin estimation displays
 *
 * The rates here mirror the server RPC. If tax rates change,
 * update THIS file and the server RPC together.
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
