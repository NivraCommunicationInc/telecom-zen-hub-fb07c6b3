/**
 * Billing Validation & Regression Checks
 * 
 * Ensures billing data integrity across Invoice, Contract, and UI.
 * Use these functions to validate data before PDF generation.
 */

import { extractLineItemsFromOrder, calculateLineItemTotals, type OrderLineItem } from "./orderLineItems";
import { TAX_RATES, verifyBillingInvariant } from "./pdfEngine/billingCalculator";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
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

/**
 * Validates that order line items are properly structured.
 * Returns errors for critical issues, warnings for non-critical.
 */
export function validateOrderLineItems(equipmentDetails: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!equipmentDetails) {
    errors.push("Missing equipment_details on order");
    return { valid: false, errors, warnings };
  }
  
  const lineItems = extractLineItemsFromOrder(equipmentDetails);
  
  if (!lineItems || lineItems.length === 0) {
    errors.push("No line_items found in equipment_details");
    return { valid: false, errors, warnings };
  }
  
  // Check each line item
  let serviceCount = 0;
  let equipmentCount = 0;
  let feeCount = 0;
  
  for (const item of lineItems) {
    // Required fields
    if (!item.name) {
      errors.push(`Line item missing name: ${JSON.stringify(item)}`);
    }
    if (typeof item.unit_price !== "number" || item.unit_price < 0) {
      warnings.push(`Line item "${item.name}" has invalid price: ${item.unit_price}`);
    }
    if (!item.category) {
      warnings.push(`Line item "${item.name}" missing category`);
    }
    
    // Category checks
    if (item.category === "service") {
      serviceCount++;
      // Services should have period
      if (!item.period) {
        warnings.push(`Service "${item.name}" missing period`);
      }
      // Services should NOT be one_time (those are fees)
      if (item.period === "one_time") {
        errors.push(`Service "${item.name}" has one_time period - should be fee category`);
      }
    } else if (item.category === "equipment") {
      equipmentCount++;
      // Equipment should be one_time
      if (item.period !== "one_time") {
        warnings.push(`Equipment "${item.name}" should have one_time period`);
      }
    } else if (item.category === "fee") {
      feeCount++;
      // Fees should be one_time
      if (item.period !== "one_time") {
        warnings.push(`Fee "${item.name}" should have one_time period`);
      }
    }
  }
  
  // Must have at least one service
  if (serviceCount === 0) {
    warnings.push("No recurring services found in line_items");
  }
  
  // Calculate totals for validation
  const totals = calculateLineItemTotals(lineItems);
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    calculatedTotals: {
      recurringSubtotal: totals.serviceSubtotal,
      oneTimeSubtotal: totals.equipmentSubtotal + totals.feeSubtotal,
      discountTotal: totals.discountTotal,
      taxableAmount: totals.taxableSubtotal,
      tps: Math.round(totals.taxableSubtotal * TAX_RATES.TPS * 100) / 100,
      tvq: Math.round(totals.taxableSubtotal * TAX_RATES.TVQ * 100) / 100,
      grandTotal: Math.round((totals.taxableSubtotal * (1 + TAX_RATES.TPS + TAX_RATES.TVQ)) * 100) / 100,
    },
  };
}

/**
 * Validates that stored billing matches calculated billing.
 * Use before generating PDF to ensure consistency.
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
  
  const totals = calculateLineItemTotals(lineItems);
  const calculatedSubtotal = totals.serviceSubtotal;
  const oneTimeTotal = totals.equipmentSubtotal + totals.feeSubtotal;
  const taxableAmount = Math.max(0, calculatedSubtotal + oneTimeTotal - totals.discountTotal);
  const calculatedTps = Math.round(taxableAmount * TAX_RATES.TPS * 100) / 100;
  const calculatedTvq = Math.round(taxableAmount * TAX_RATES.TVQ * 100) / 100;
  const calculatedTotal = Math.round((taxableAmount + calculatedTps + calculatedTvq) * 100) / 100;
  
  // Check subtotal
  if (storedBilling.subtotal !== undefined) {
    const diff = Math.abs(storedBilling.subtotal - calculatedSubtotal);
    if (diff > 0.01) {
      errors.push(
        `Subtotal mismatch: stored=${storedBilling.subtotal}, calculated=${calculatedSubtotal} (diff=${diff.toFixed(2)})`
      );
    }
  }
  
  // Check TPS
  if (storedBilling.tpsAmount !== undefined) {
    const diff = Math.abs(storedBilling.tpsAmount - calculatedTps);
    if (diff > 0.02) {
      warnings.push(
        `TPS mismatch: stored=${storedBilling.tpsAmount}, calculated=${calculatedTps}`
      );
    }
  }
  
  // Check TVQ
  if (storedBilling.tvqAmount !== undefined) {
    const diff = Math.abs(storedBilling.tvqAmount - calculatedTvq);
    if (diff > 0.02) {
      warnings.push(
        `TVQ mismatch: stored=${storedBilling.tvqAmount}, calculated=${calculatedTvq}`
      );
    }
  }
  
  // Check total
  if (storedBilling.total !== undefined) {
    const diff = Math.abs(storedBilling.total - calculatedTotal);
    if (diff > 0.10) {
      errors.push(
        `Total mismatch: stored=${storedBilling.total}, calculated=${calculatedTotal} (diff=${diff.toFixed(2)})`
      );
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
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
