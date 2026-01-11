/**
 * Payment Status Constants - Single Source of Truth
 * 
 * These constants define all valid payment statuses used throughout the application.
 * Any new status should be added here to maintain consistency.
 */

export const PAYMENT_STATUS = {
  // Initial states
  PENDING: 'pending',
  AUTHORIZED: 'authorized',
  
  // Success states
  COMPLETED: 'completed',
  PROCESSED: 'processed',
  CAPTURED: 'captured',
  
  // Error states
  FAILED: 'failed',
  DECLINED: 'declined',
  ERROR_CAPTURED: 'error_captured', // Payment captured but order/invoice failed
  
  // Reversal states
  REFUNDED: 'refunded',
  VOIDED: 'voided',
  CANCELLED: 'cancelled',
} as const;

export type PaymentStatus = typeof PAYMENT_STATUS[keyof typeof PAYMENT_STATUS];

// Statuses that count as "paid" for balance calculations
export const CAPTURED_STATUSES: PaymentStatus[] = [
  PAYMENT_STATUS.COMPLETED,
  PAYMENT_STATUS.PROCESSED,
  PAYMENT_STATUS.CAPTURED,
];

// Statuses that indicate a final successful payment
export const SUCCESS_STATUSES: PaymentStatus[] = [
  PAYMENT_STATUS.COMPLETED,
  PAYMENT_STATUS.PROCESSED,
  PAYMENT_STATUS.CAPTURED,
];

// Statuses that need admin attention
export const ATTENTION_REQUIRED_STATUSES: PaymentStatus[] = [
  PAYMENT_STATUS.ERROR_CAPTURED,
  PAYMENT_STATUS.FAILED,
  PAYMENT_STATUS.DECLINED,
];

// Human-readable labels (French)
export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  [PAYMENT_STATUS.PENDING]: 'En attente',
  [PAYMENT_STATUS.AUTHORIZED]: 'Autorisé',
  [PAYMENT_STATUS.COMPLETED]: 'Complété',
  [PAYMENT_STATUS.PROCESSED]: 'Traité',
  [PAYMENT_STATUS.CAPTURED]: 'Capturé',
  [PAYMENT_STATUS.FAILED]: 'Échoué',
  [PAYMENT_STATUS.DECLINED]: 'Refusé',
  [PAYMENT_STATUS.ERROR_CAPTURED]: 'Erreur (capturé)',
  [PAYMENT_STATUS.REFUNDED]: 'Remboursé',
  [PAYMENT_STATUS.VOIDED]: 'Annulé',
  [PAYMENT_STATUS.CANCELLED]: 'Annulé',
};

// CSS classes for status badges
export const PAYMENT_STATUS_COLORS: Record<PaymentStatus, string> = {
  [PAYMENT_STATUS.PENDING]: 'bg-yellow-100 text-yellow-800',
  [PAYMENT_STATUS.AUTHORIZED]: 'bg-blue-100 text-blue-800',
  [PAYMENT_STATUS.COMPLETED]: 'bg-green-100 text-green-800',
  [PAYMENT_STATUS.PROCESSED]: 'bg-green-100 text-green-800',
  [PAYMENT_STATUS.CAPTURED]: 'bg-green-100 text-green-800',
  [PAYMENT_STATUS.FAILED]: 'bg-red-100 text-red-800',
  [PAYMENT_STATUS.DECLINED]: 'bg-red-100 text-red-800',
  [PAYMENT_STATUS.ERROR_CAPTURED]: 'bg-orange-100 text-orange-800',
  [PAYMENT_STATUS.REFUNDED]: 'bg-gray-100 text-gray-800',
  [PAYMENT_STATUS.VOIDED]: 'bg-gray-100 text-gray-800',
  [PAYMENT_STATUS.CANCELLED]: 'bg-gray-100 text-gray-800',
};
