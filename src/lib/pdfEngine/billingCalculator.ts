/**
 * Nivra Document Engine - Unified Billing Calculator
 * Single source of truth for all billing calculations
 * Used by: UI components, Contract PDF, Invoice PDF
 * 
 * INVARIANT: taxable_subtotal = recurring_subtotal + one_time_subtotal - discounts_total
 * TPS = 5% of taxable_subtotal
 * TVQ = 9.975% of taxable_subtotal
 * total = taxable_subtotal + TPS + TVQ
 */

import type { ServiceLineItem, EquipmentItem, OneTimeFee, DiscountItem, BillingSummary } from "./types";

// Tax rates for Quebec
export const TAX_RATES = {
  TPS: 0.05,
  TVQ: 0.09975,
} as const;

export interface BillingInput {
  services: ServiceLineItem[];
  equipment: EquipmentItem[];
  oneTimeFees: OneTimeFee[];
  discounts: DiscountItem[];
}

export interface CalculatedBilling extends BillingSummary {
  // Breakdown for display
  recurringSubtotal: number;
  oneTimeSubtotal: number;
  equipmentSubtotal: number;
  feeSubtotal: number;
  taxableSubtotal: number;
  // Invariant check
  isValid: boolean;
  validationError?: string;
}

/**
 * Calculate billing totals from line items
 * This is the SINGLE SOURCE OF TRUTH for all billing calculations
 */
export function calculateBillingTotals(input: BillingInput): CalculatedBilling {
  const { services, equipment, oneTimeFees, discounts } = input;

  // 1. Calculate recurring subtotal (monthly/30-day services)
  const recurringSubtotal = services
    .filter(s => !s.isOneTime && s.monthlyPrice >= 0)
    .reduce((sum, s) => sum + (s.monthlyPrice * (s.quantity || 1)), 0);

  // 2. Calculate equipment subtotal
  const equipmentSubtotal = equipment
    .filter(e => e.unitPrice >= 0)
    .reduce((sum, e) => sum + (e.unitPrice * e.quantity), 0);

  // 3. Calculate one-time fees subtotal
  const feeSubtotal = oneTimeFees
    .filter(f => f.amount >= 0)
    .reduce((sum, f) => sum + f.amount, 0);

  // 4. Total one-time charges (equipment + fees)
  const oneTimeSubtotal = equipmentSubtotal + feeSubtotal;

  // 5. Calculate discounts total
  const discountTotal = discounts
    .filter(d => d.amount >= 0)
    .reduce((sum, d) => sum + d.amount, 0);

  // 6. CRITICAL: Calculate taxable subtotal
  // taxable_subtotal = recurring + one_time - discounts
  const taxableSubtotal = Math.max(0, recurringSubtotal + oneTimeSubtotal - discountTotal);

  // 7. Calculate taxes
  const tps = roundToTwo(taxableSubtotal * TAX_RATES.TPS);
  const tvq = roundToTwo(taxableSubtotal * TAX_RATES.TVQ);

  // 8. Calculate total
  const total = roundToTwo(taxableSubtotal + tps + tvq);

  // 9. Invariant check
  const expectedTaxBase = roundToTwo(recurringSubtotal + oneTimeSubtotal - discountTotal);
  const isValid = Math.abs(taxableSubtotal - expectedTaxBase) < 0.01;
  const validationError = isValid 
    ? undefined 
    : `Billing invariant violated: taxableSubtotal (${taxableSubtotal}) != recurring (${recurringSubtotal}) + oneTime (${oneTimeSubtotal}) - discounts (${discountTotal})`;

  if (!isValid) {
    console.error("[BillingCalculator] INVARIANT ERROR:", validationError);
  }

  return {
    // BillingSummary fields
    subtotal: recurringSubtotal,
    oneTimeTotal: oneTimeSubtotal,
    discountTotal,
    tps,
    tvq,
    total,
    
    // Additional breakdown
    recurringSubtotal,
    oneTimeSubtotal,
    equipmentSubtotal,
    feeSubtotal,
    taxableSubtotal,
    
    // Validation
    isValid,
    validationError,
  };
}

/**
 * Round to 2 decimal places (standard currency rounding)
 */
function roundToTwo(num: number): number {
  return Math.round(num * 100) / 100;
}

/**
 * Verify billing totals match expected invariants
 * Use this before generating PDFs to catch calculation errors
 */
export function verifyBillingInvariant(billing: BillingSummary): { valid: boolean; error?: string } {
  const taxableSubtotal = billing.subtotal + billing.oneTimeTotal - billing.discountTotal;
  const expectedTps = roundToTwo(taxableSubtotal * TAX_RATES.TPS);
  const expectedTvq = roundToTwo(taxableSubtotal * TAX_RATES.TVQ);
  const expectedTotal = roundToTwo(taxableSubtotal + expectedTps + expectedTvq);

  // Check TPS
  if (Math.abs(billing.tps - expectedTps) > 0.02) {
    return {
      valid: false,
      error: `TPS mismatch: got ${billing.tps}, expected ${expectedTps} (5% of ${taxableSubtotal})`,
    };
  }

  // Check TVQ
  if (Math.abs(billing.tvq - expectedTvq) > 0.02) {
    return {
      valid: false,
      error: `TVQ mismatch: got ${billing.tvq}, expected ${expectedTvq} (9.975% of ${taxableSubtotal})`,
    };
  }

  // Check total
  if (Math.abs(billing.total - expectedTotal) > 0.05) {
    return {
      valid: false,
      error: `Total mismatch: got ${billing.total}, expected ${expectedTotal}`,
    };
  }

  return { valid: true };
}

/**
 * Recalculate billing from existing data (for validation/correction)
 */
export function recalculateBilling(billing: Partial<BillingSummary>): BillingSummary {
  const subtotal = billing.subtotal || 0;
  const oneTimeTotal = billing.oneTimeTotal || 0;
  const discountTotal = billing.discountTotal || 0;
  
  const taxableSubtotal = Math.max(0, subtotal + oneTimeTotal - discountTotal);
  const tps = roundToTwo(taxableSubtotal * TAX_RATES.TPS);
  const tvq = roundToTwo(taxableSubtotal * TAX_RATES.TVQ);
  const total = roundToTwo(taxableSubtotal + tps + tvq);

  return {
    subtotal,
    oneTimeTotal,
    discountTotal,
    tps,
    tvq,
    total,
  };
}
