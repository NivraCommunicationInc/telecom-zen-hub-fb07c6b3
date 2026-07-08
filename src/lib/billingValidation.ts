/**
 * Billing Validation Utilities - V2.5
 * Simplified validation for payment capture status
 */

/**
 * Determines if a payment has been captured (actually received).
 * Only captured payments should affect account balance.
 */
export function isPaymentCaptured(
  status: string | null | undefined,
  paidAt: string | null | undefined,
  paymentMethod?: string | null,
  etransferStatus?: string | null,
  capturedAt?: string | null | undefined
): boolean {
  // If captured_at is set, it's definitely captured
  if (capturedAt) {
    return true;
  }
  
  // If explicitly marked as paid with a timestamp
  if (status === "paid" && paidAt) {
    return true;
  }
  
  // Status-based check
  const capturedStatuses = ['paid', 'complete', 'captured', 'confirmed', 'settled'];
  if (capturedStatuses.includes((status || '').toLowerCase()) && paidAt) {
    return true;
  }
  
  // e-Transfer: only "complete" status counts
  const method = (paymentMethod || '').toLowerCase();
  if (method.includes("interac") || method.includes("etransfer") || method.includes("e-transfer")) {
    return (etransferStatus || '').toLowerCase() === "complete";
  }
  
  // Default: only 'paid' status with paid_at counts
  return status === "paid" && !!paidAt;
}

// ═══ PHASE 3: TAX_RATES re-export REMOVED ═══
// verifyBillingInvariant retained for audit usage only
export { verifyBillingInvariant } from "@/lib/pdf/billingCalculator";
