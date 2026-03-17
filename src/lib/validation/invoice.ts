/**
 * Invoice Validation Functions
 */

import {
  INVOICE_STATUS,
  InvoiceStatus,
  IMMUTABLE_INVOICE_STATUSES,
  isValidInvoiceStatusTransition,
} from '@/lib/constants';

export interface InvoicePayload {
  amount: number;
  subtotal?: number;
  tps_amount?: number;
  tvq_amount?: number;
  fees?: number;
  delivery_fee?: number;
  installation_fee?: number;
  activation_fee?: number;
  discount_amount?: number;
  balance_due?: number;
  amount_paid?: number;
  status?: InvoiceStatus;
  user_id: string;
  client_email?: string;
}

export interface InvoiceValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate an invoice payload
 */
export function validateInvoicePayload(payload: InvoicePayload): InvoiceValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Required fields
  if (!payload.user_id) {
    errors.push('user_id est requis');
  }
  
  if (payload.amount === undefined || payload.amount < 0) {
    errors.push('Le montant doit être >= 0');
  }
  
  // Balance consistency
  if (payload.balance_due !== undefined && payload.balance_due < 0) {
    errors.push('balance_due ne peut pas être négatif');
  }
  
  if (payload.amount_paid !== undefined && payload.amount_paid < 0) {
    errors.push('amount_paid ne peut pas être négatif');
  }
  
  // Tax validation — centralized server tax engine
  if (payload.subtotal !== undefined && payload.amount !== undefined) {
    const { estimateTaxes } = require("@/lib/pricing/serverTaxEngine");
    const { tps: expectedTps, tvq: expectedTvq } = estimateTaxes(payload.subtotal);
    
    if (payload.tps_amount !== undefined && Math.abs(payload.tps_amount - expectedTps) > 0.02) {
      warnings.push(`TPS potentiellement incorrecte: ${payload.tps_amount} vs attendu ${expectedTps}`);
    }
    
    if (payload.tvq_amount !== undefined && Math.abs(payload.tvq_amount - expectedTvq) > 0.02) {
      warnings.push(`TVQ potentiellement incorrecte: ${payload.tvq_amount} vs attendu ${expectedTvq}`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate a status transition for an invoice
 */
export function validateInvoiceStatusChange(
  currentStatus: InvoiceStatus,
  newStatus: InvoiceStatus,
  hasFinancialChanges: boolean = false
): InvoiceValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check immutability
  if (IMMUTABLE_INVOICE_STATUSES.includes(currentStatus) && hasFinancialChanges) {
    errors.push(`Impossible de modifier les champs financiers d'une facture ${currentStatus}. Utilisez une note de crédit.`);
  }
  
  // Check transition validity
  if (!isValidInvoiceStatusTransition(currentStatus, newStatus)) {
    errors.push(`Transition de statut invalide: ${currentStatus} → ${newStatus}`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Calculate the expected balance_due based on amount and payments
 */
export function calculateBalanceDue(invoiceAmount: number, totalPaid: number): number {
  return Math.max(0, invoiceAmount - totalPaid);
}

/**
 * Determine the invoice status based on balance
 */
export function determineInvoiceStatus(
  invoiceAmount: number,
  totalPaid: number,
  currentStatus?: InvoiceStatus
): InvoiceStatus {
  const balanceDue = calculateBalanceDue(invoiceAmount, totalPaid);
  
  if (balanceDue <= 0) {
    return INVOICE_STATUS.PAID;
  }
  
  if (totalPaid > 0) {
    return INVOICE_STATUS.PARTIAL;
  }
  
  // Keep current status if no payment has been made
  return currentStatus || INVOICE_STATUS.PENDING;
}
