/**
 * @deprecated — DO NOT USE FOR TRANSACTIONAL CALCULATIONS.
 * All pricing, taxes, and totals must come from Nivra Core API or
 * the compute_checkout_pricing / compute_invoice_breakdown server RPCs.
 * This file is retained only for legacy PDF rendering compatibility.
 * No frontend component should import TAX_RATES or calculateBillingTotals
 * for checkout, orders, payments, or confirmation flows.
 */

export const TAX_RATES = {
  TPS: 0.05,    // 5%
  TVQ: 0.09975, // 9.975%
};

export interface BillingService {
  type: string;
  name: string;
  description?: string;
  monthlyPrice: number;
  quantity?: number;
  isOneTime?: boolean;
  priceLabel?: string;
}

export interface BillingEquipment {
  name: string;
  quantity: number;
  unitPrice: number;
  serial?: string;
}

export interface BillingFee {
  label: string;
  amount: number;
}

export interface BillingDiscount {
  label: string;
  amount: number;
  type?: "promo" | "preauth" | "loyalty" | "multiLine" | "other";
}

export interface BillingInput {
  services?: BillingService[];
  equipment?: BillingEquipment[];
  oneTimeFees?: BillingFee[];
  discounts?: BillingDiscount[];
}

export interface CalculatedBilling {
  recurringSubtotal: number;
  equipmentSubtotal: number;
  oneTimeFeesSubtotal: number;
  discountsTotal: number;
  taxableSubtotal: number;
  tpsAmount: number;
  tvqAmount: number;
  totalBeforeTax: number;
  grandTotal: number;
  isValid: boolean;
  validationError?: string;
}

/**
 * Calculate billing totals from structured input
 */
export function calculateBillingTotals(input: BillingInput): CalculatedBilling {
  const services = input.services || [];
  const equipment = input.equipment || [];
  const fees = input.oneTimeFees || [];
  const discounts = input.discounts || [];
  
  // Calculate recurring services
  const recurringSubtotal = services
    .filter(s => !s.isOneTime)
    .reduce((sum, s) => sum + (s.monthlyPrice * (s.quantity || 1)), 0);
  
  // Calculate equipment
  const equipmentSubtotal = equipment
    .reduce((sum, e) => sum + (e.unitPrice * e.quantity), 0);
  
  // Calculate one-time fees
  const oneTimeFeesSubtotal = fees
    .reduce((sum, f) => sum + f.amount, 0);
  
  // Calculate discounts
  const discountsTotal = discounts
    .reduce((sum, d) => sum + d.amount, 0);
  
  // Taxable subtotal
  const taxableSubtotal = Math.max(0, 
    recurringSubtotal + equipmentSubtotal + oneTimeFeesSubtotal - discountsTotal
  );
  
  // Calculate taxes
  const tpsAmount = Math.round(taxableSubtotal * TAX_RATES.TPS * 100) / 100;
  const tvqAmount = Math.round(taxableSubtotal * TAX_RATES.TVQ * 100) / 100;
  
  // Grand total
  const grandTotal = Math.round((taxableSubtotal + tpsAmount + tvqAmount) * 100) / 100;
  
  return {
    recurringSubtotal: Math.round(recurringSubtotal * 100) / 100,
    equipmentSubtotal: Math.round(equipmentSubtotal * 100) / 100,
    oneTimeFeesSubtotal: Math.round(oneTimeFeesSubtotal * 100) / 100,
    discountsTotal: Math.round(discountsTotal * 100) / 100,
    taxableSubtotal: Math.round(taxableSubtotal * 100) / 100,
    tpsAmount,
    tvqAmount,
    totalBeforeTax: taxableSubtotal,
    grandTotal,
    isValid: true,
  };
}

/**
 * Verify billing invariant: grandTotal = taxableSubtotal + TPS + TVQ
 */
export function verifyBillingInvariant(
  grandTotal: number,
  taxableSubtotal: number,
  tpsAmount: number,
  tvqAmount: number
): { isValid: boolean; error?: string } {
  const calculated = Math.round((taxableSubtotal + tpsAmount + tvqAmount) * 100) / 100;
  const difference = Math.abs(grandTotal - calculated);
  
  if (difference > 0.02) {
    return {
      isValid: false,
      error: `Billing invariant violation: grandTotal=${grandTotal}, calculated=${calculated}, diff=${difference}`,
    };
  }
  
  return { isValid: true };
}

/**
 * Recalculate billing from line items
 */
export function recalculateBilling(input: BillingInput): CalculatedBilling {
  return calculateBillingTotals(input);
}
