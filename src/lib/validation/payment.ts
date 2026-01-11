/**
 * Payment Validation Functions
 * 
 * Centralized validation for payment data to ensure consistency
 * and prevent invalid data from being submitted.
 */

import { 
  PAYMENT_STATUS, 
  PaymentStatus, 
  CAPTURED_STATUSES,
  AUTOMATED_SOURCES,
  PaymentSource,
} from '@/lib/constants';

export interface PaymentPayload {
  amount: number;
  user_id?: string;
  client_id?: string;
  billing_id?: string;
  invoice_id?: string;
  order_id?: string;
  payment_method?: string;
  reference_number?: string;
  status?: PaymentStatus;
  source?: PaymentSource;
  created_by_id?: string;
  created_by_name?: string;
  created_by_role?: string;
  provider_payment_id?: string;
  notes?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate a payment payload before submission
 */
export function validatePaymentPayload(
  payload: PaymentPayload,
  context: {
    isManual?: boolean;
    actorId?: string;
    actorName?: string;
    actorRole?: string;
  } = {}
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Required fields
  if (!payload.amount || payload.amount <= 0) {
    errors.push('Le montant doit être supérieur à 0');
  }
  
  if (!payload.user_id && !payload.client_id) {
    errors.push('Un client (user_id ou client_id) est requis');
  }
  
  // For completed/processed payments, validate created_by fields
  const status = payload.status || PAYMENT_STATUS.PENDING;
  if (CAPTURED_STATUSES.includes(status as any)) {
    const source = payload.source || 'manual';
    
    // Only require created_by for non-automated sources
    if (!AUTOMATED_SOURCES.includes(source as any)) {
      if (!payload.created_by_id && !context.actorId) {
        warnings.push('created_by_id manquant pour un paiement finalisé');
      }
      if (!payload.created_by_role && !context.actorRole) {
        warnings.push('created_by_role manquant pour un paiement finalisé');
      }
    }
  }
  
  // Reference number format
  if (payload.reference_number && payload.reference_number.length < 3) {
    warnings.push('La référence de paiement semble trop courte');
  }
  
  // Provider payment ID uniqueness hint
  if (payload.provider_payment_id && !payload.provider_payment_id.includes('-')) {
    warnings.push('provider_payment_id devrait inclure un identifiant unique');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Enhance a payment payload with required fields
 */
export function enhancePaymentPayload(
  payload: PaymentPayload,
  actor: {
    id: string;
    name?: string;
    role: string;
  },
  source: PaymentSource = 'manual'
): PaymentPayload {
  return {
    ...payload,
    source: payload.source || source,
    created_by_id: payload.created_by_id || actor.id,
    created_by_name: payload.created_by_name || actor.name || actor.role,
    created_by_role: payload.created_by_role || actor.role,
  };
}

/**
 * Check if a payment status transition is valid
 */
export function isValidPaymentStatusTransition(
  from: PaymentStatus,
  to: PaymentStatus
): boolean {
  // Cannot transition from refunded
  if (from === PAYMENT_STATUS.REFUNDED) {
    return false;
  }
  
  // Cannot transition from error_captured except to specific states
  if (from === PAYMENT_STATUS.ERROR_CAPTURED) {
    const allowedFromError: PaymentStatus[] = [
      PAYMENT_STATUS.REFUNDED,
      PAYMENT_STATUS.COMPLETED, // retry
      PAYMENT_STATUS.PROCESSED, // credit
    ];
    return allowedFromError.includes(to);
  }
  
  // Cannot transition from completed/processed to pending/authorized
  if (CAPTURED_STATUSES.includes(from)) {
    return to === PAYMENT_STATUS.REFUNDED || to === PAYMENT_STATUS.ERROR_CAPTURED;
  }
  
  return true;
}

/**
 * Generate a unique payment reference
 */
export function generatePaymentReference(prefix = 'PAY'): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}
