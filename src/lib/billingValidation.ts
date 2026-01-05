/**
 * Billing Validation & Regression Checks
 * 
 * CRITICAL: Single source of truth for billing validation.
 * Ensures billing data integrity across Invoice, Contract, and UI.
 * Use these functions to validate data before PDF generation and snapshot save.
 * 
 * INVARIANTS:
 * 1. SIM cards are ALWAYS equipment (one-time), never recurring services
 * 2. recurring_subtotal = sum(recurring line_items only)
 * 3. taxable_subtotal = recurring + one_time - discounts
 * 4. Only CAPTURED payments affect balance
 */

import { extractLineItemsFromOrder, calculateLineItemTotals, type OrderLineItem } from "./orderLineItems";
import { TAX_RATES, verifyBillingInvariant } from "./pdfEngine/billingCalculator";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  /** If true, this is a BLOCKING error that should prevent snapshot save */
  blockingSave: boolean;
  calculatedTotals?: {
    recurringSubtotal: number;
    oneTimeSubtotal: number;
    discountTotal: number;
    taxableAmount: number;
    tps: number;
    tvq: number;
    grandTotal: number;
  };
}

/** Items that must ALWAYS be categorized as equipment (one-time) */
const EQUIPMENT_TYPES = ['sim', 'esim', 'router', 'routeur', 'terminal', 'modem', 'device'];

/** Items that must ALWAYS be categorized as fees (one-time) */
const FEE_TYPES = ['activation', 'installation', 'livraison', 'delivery', 'frais'];

/**
 * Checks if an item name indicates it should be equipment (one-time)
 */
function isEquipmentByName(name: string): boolean {
  const lower = name.toLowerCase();
  return EQUIPMENT_TYPES.some(type => lower.includes(type));
}

/**
 * Checks if an item name indicates it should be a fee (one-time)
 */
function isFeeByName(name: string): boolean {
  const lower = name.toLowerCase();
  return FEE_TYPES.some(type => lower.includes(type));
}

/**
 * Validates that order line items are properly structured.
 * Returns errors for critical issues, warnings for non-critical.
 * 
 * REGRESSION CHECK: Will block save if recurring subtotal doesn't match sum of recurring items.
 */
export function validateOrderLineItems(equipmentDetails: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let blockingSave = false;
  
  if (!equipmentDetails) {
    errors.push("Missing equipment_details on order");
    return { valid: false, errors, warnings, blockingSave: true };
  }
  
  const lineItems = extractLineItemsFromOrder(equipmentDetails);
  
  if (!lineItems || lineItems.length === 0) {
    errors.push("No line_items found in equipment_details");
    return { valid: false, errors, warnings, blockingSave: true };
  }
  
  // Check each line item for proper categorization
  let serviceCount = 0;
  let equipmentCount = 0;
  let feeCount = 0;
  let recurringTotal = 0;
  
  for (const item of lineItems) {
    // Required fields
    if (!item.name) {
      errors.push(`Line item missing name: ${JSON.stringify(item)}`);
      blockingSave = true;
      continue;
    }
    
    if (typeof item.unit_price !== "number" || item.unit_price < 0) {
      warnings.push(`Line item "${item.name}" has invalid price: ${item.unit_price}`);
    }
    
    if (!item.category) {
      warnings.push(`Line item "${item.name}" missing category`);
    }
    
    // CRITICAL: Enforce strict categorization rules
    const nameLower = item.name.toLowerCase();
    
    // Rule 1: SIM cards MUST be equipment (one-time), NEVER recurring
    if (nameLower.includes('sim') || nameLower.includes('esim')) {
      if (item.category === 'service' || item.period !== 'one_time') {
        errors.push(`CATEGORIZATION ERROR: "${item.name}" is a SIM card - must be equipment (one_time), not ${item.category}/${item.period}`);
        blockingSave = true;
      }
    }
    
    // Rule 2: Equipment items must be one_time
    if (isEquipmentByName(item.name)) {
      if (item.period !== 'one_time') {
        errors.push(`CATEGORIZATION ERROR: "${item.name}" is equipment - must be one_time, got ${item.period}`);
        blockingSave = true;
      }
    }
    
    // Rule 3: Fee items must be one_time
    if (isFeeByName(item.name) && item.category !== 'discount') {
      if (item.period !== 'one_time') {
        warnings.push(`Fee "${item.name}" should have one_time period`);
      }
    }
    
    // Category counts
    if (item.category === "service") {
      serviceCount++;
      if (!item.period) {
        warnings.push(`Service "${item.name}" missing period`);
      }
      // Services should NOT be one_time
      if (item.period === "one_time") {
        errors.push(`Service "${item.name}" has one_time period - should be fee or equipment category`);
        blockingSave = true;
      }
      // Track recurring total
      if (item.period !== 'one_time' && item.unit_price >= 0) {
        recurringTotal += item.unit_price * (item.qty || 1);
      }
    } else if (item.category === "equipment") {
      equipmentCount++;
      if (item.period !== "one_time") {
        errors.push(`Equipment "${item.name}" must have one_time period, got ${item.period}`);
        blockingSave = true;
      }
    } else if (item.category === "fee") {
      feeCount++;
      if (item.period !== "one_time") {
        warnings.push(`Fee "${item.name}" should have one_time period`);
      }
    }
  }
  
  // Must have at least one service for most orders
  if (serviceCount === 0) {
    warnings.push("No recurring services found in line_items");
  }
  
  // Calculate totals for validation
  const totals = calculateLineItemTotals(lineItems);
  
  // REGRESSION CHECK: Verify recurring subtotal matches sum of recurring line items
  const calculatedRecurring = Math.round(recurringTotal * 100) / 100;
  const reportedRecurring = Math.round(totals.serviceSubtotal * 100) / 100;
  
  if (Math.abs(calculatedRecurring - reportedRecurring) > 0.01) {
    errors.push(`REGRESSION: Recurring subtotal mismatch! Calculated: ${calculatedRecurring}, Reported: ${reportedRecurring}`);
    console.error("[BillingValidation] BLOCKING ERROR: Recurring subtotal mismatch", {
      calculated: calculatedRecurring,
      reported: reportedRecurring,
      lineItems: lineItems.filter(i => i.category === 'service'),
    });
    blockingSave = true;
  }
  
  const taxableAmount = totals.taxableSubtotal;
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    blockingSave,
    calculatedTotals: {
      recurringSubtotal: totals.serviceSubtotal,
      oneTimeSubtotal: totals.equipmentSubtotal + totals.feeSubtotal,
      discountTotal: totals.discountTotal,
      taxableAmount,
      tps: Math.round(taxableAmount * TAX_RATES.TPS * 100) / 100,
      tvq: Math.round(taxableAmount * TAX_RATES.TVQ * 100) / 100,
      grandTotal: Math.round((taxableAmount * (1 + TAX_RATES.TPS + TAX_RATES.TVQ)) * 100) / 100,
    },
  };
}

/**
 * Validates that stored billing matches calculated billing from line items.
 * Use before generating PDF or saving snapshots to ensure consistency.
 * 
 * CRITICAL: Always compute from line_items, never trust stored subtotals.
 */
export function validateBillingConsistency(
  lineItems: OrderLineItem[],
  storedBilling: {
    subtotal?: number;
    tpsAmount?: number;
    tvqAmount?: number;
    total?: number;
  }
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let blockingSave = false;
  
  const totals = calculateLineItemTotals(lineItems);
  const calculatedSubtotal = totals.serviceSubtotal;
  const oneTimeTotal = totals.equipmentSubtotal + totals.feeSubtotal;
  const taxableAmount = Math.max(0, calculatedSubtotal + oneTimeTotal - totals.discountTotal);
  const calculatedTps = Math.round(taxableAmount * TAX_RATES.TPS * 100) / 100;
  const calculatedTvq = Math.round(taxableAmount * TAX_RATES.TVQ * 100) / 100;
  const calculatedTotal = Math.round((taxableAmount + calculatedTps + calculatedTvq) * 100) / 100;
  
  // Check subtotal - BLOCKING if mismatch is significant
  if (storedBilling.subtotal !== undefined) {
    const diff = Math.abs(storedBilling.subtotal - calculatedSubtotal);
    if (diff > 0.01) {
      const msg = `SUBTOTAL MISMATCH: stored=${storedBilling.subtotal}, calculated=${calculatedSubtotal} (diff=${diff.toFixed(2)})`;
      errors.push(msg);
      console.error("[BillingValidation]", msg, { lineItems });
      
      // Block save if difference is more than $1 (indicates real problem)
      if (diff > 1.00) {
        blockingSave = true;
      }
    }
  }
  
  // Check TPS
  if (storedBilling.tpsAmount !== undefined) {
    const diff = Math.abs(storedBilling.tpsAmount - calculatedTps);
    if (diff > 0.02) {
      warnings.push(`TPS mismatch: stored=${storedBilling.tpsAmount}, calculated=${calculatedTps}`);
    }
  }
  
  // Check TVQ
  if (storedBilling.tvqAmount !== undefined) {
    const diff = Math.abs(storedBilling.tvqAmount - calculatedTvq);
    if (diff > 0.02) {
      warnings.push(`TVQ mismatch: stored=${storedBilling.tvqAmount}, calculated=${calculatedTvq}`);
    }
  }
  
  // Check total - BLOCKING if mismatch is significant
  if (storedBilling.total !== undefined) {
    const diff = Math.abs(storedBilling.total - calculatedTotal);
    if (diff > 0.10) {
      const msg = `TOTAL MISMATCH: stored=${storedBilling.total}, calculated=${calculatedTotal} (diff=${diff.toFixed(2)})`;
      errors.push(msg);
      
      if (diff > 5.00) {
        console.error("[BillingValidation] BLOCKING:", msg);
        blockingSave = true;
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    blockingSave,
    calculatedTotals: {
      recurringSubtotal: calculatedSubtotal,
      oneTimeSubtotal: oneTimeTotal,
      discountTotal: totals.discountTotal,
      taxableAmount,
      tps: calculatedTps,
      tvq: calculatedTvq,
      grandTotal: calculatedTotal,
    },
  };
}

/**
 * Validates payment capture status.
 * Only CAPTURED payments should affect balance.
 */
export function isPaymentCaptured(
  status: string | null | undefined,
  paidAt: string | null | undefined,
  paymentMethod?: string | null,
  etransferStatus?: string | null
): boolean {
  // If explicitly marked as paid with a timestamp, it's captured
  if (status === "paid" && paidAt) {
    return true;
  }
  
  // e-Transfer: only "complete" status counts
  const method = (paymentMethod || '').toLowerCase();
  if (method.includes("interac") || method.includes("etransfer") || method.includes("e-transfer")) {
    return (etransferStatus || '').toLowerCase() === "complete";
  }
  
  // Credit card: if status is paid, it's captured
  if (method.includes("credit") || method.includes("card")) {
    return status === "paid";
  }
  
  // Default: only 'paid' status with paid_at counts
  return status === "paid" && !!paidAt;
}

/**
 * REGRESSION CHECK: Validate that invoice snapshot can be saved.
 * Returns false if there are blocking errors.
 */
export function canSaveInvoiceSnapshot(
  equipmentDetails: any,
  storedBilling?: { subtotal?: number; total?: number }
): { canSave: boolean; errors: string[] } {
  const itemsValidation = validateOrderLineItems(equipmentDetails);
  
  if (itemsValidation.blockingSave) {
    console.error("[BillingValidation] BLOCKED: Cannot save invoice snapshot", itemsValidation.errors);
    return { canSave: false, errors: itemsValidation.errors };
  }
  
  // If stored billing provided, validate consistency
  if (storedBilling && itemsValidation.calculatedTotals) {
    const lineItems = extractLineItemsFromOrder(equipmentDetails);
    if (lineItems) {
      const consistency = validateBillingConsistency(lineItems, storedBilling);
      if (consistency.blockingSave) {
        console.error("[BillingValidation] BLOCKED: Billing consistency failed", consistency.errors);
        return { canSave: false, errors: [...itemsValidation.errors, ...consistency.errors] };
      }
    }
  }
  
  return { canSave: true, errors: itemsValidation.errors };
}

/**
 * Logs validation results to console with appropriate severity.
 * Call this before PDF generation to catch issues early.
 */
export function logValidationResults(
  context: string,
  result: ValidationResult
): void {
  if (result.errors.length > 0) {
    console.error(`[${context}] VALIDATION ERRORS:`, result.errors);
  }
  if (result.warnings.length > 0) {
    console.warn(`[${context}] Validation warnings:`, result.warnings);
  }
  if (result.valid) {
    console.log(`[${context}] Validation passed`, result.calculatedTotals);
  }
}

/**
 * Quick check that account number is present.
 * Returns empty string if valid, error message if not.
 */
export function validateAccountNumber(
  accountNumber: string | null | undefined,
  context: string
): string {
  if (!accountNumber || accountNumber.trim() === "" || accountNumber.trim().toUpperCase() === "N/A") {
    console.error(`[${context}] Missing account number`);
    return `Missing account number for ${context}`;
  }
  return "";
}
