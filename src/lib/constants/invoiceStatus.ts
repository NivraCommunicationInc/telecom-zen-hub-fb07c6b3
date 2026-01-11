/**
 * Invoice Status Constants - Single Source of Truth
 */

export const INVOICE_STATUS = {
  // Draft/pending states
  DRAFT: 'draft',
  PENDING: 'pending',
  ISSUED: 'issued',
  
  // Payment states
  PARTIAL: 'partial',
  PAID: 'paid',
  
  // Problem states
  OVERDUE: 'overdue',
  FAILED: 'failed',
  DECLINED: 'declined',
  
  // Reversal states
  REFUNDED: 'refunded',
  CREDITED: 'credited',
  CANCELLED: 'cancelled',
  VOIDED: 'voided',
} as const;

export type InvoiceStatus = typeof INVOICE_STATUS[keyof typeof INVOICE_STATUS];

// Statuses that count towards balance
export const ACTIVE_INVOICE_STATUSES: InvoiceStatus[] = [
  INVOICE_STATUS.PENDING,
  INVOICE_STATUS.ISSUED,
  INVOICE_STATUS.PARTIAL,
  INVOICE_STATUS.OVERDUE,
];

// Statuses where invoice is considered "closed"
export const CLOSED_INVOICE_STATUSES: InvoiceStatus[] = [
  INVOICE_STATUS.PAID,
  INVOICE_STATUS.REFUNDED,
  INVOICE_STATUS.CREDITED,
  INVOICE_STATUS.CANCELLED,
  INVOICE_STATUS.VOIDED,
];

// Statuses that are immutable (financial fields cannot be changed)
export const IMMUTABLE_INVOICE_STATUSES: InvoiceStatus[] = [
  INVOICE_STATUS.PAID,
];

// Human-readable labels (French)
export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  [INVOICE_STATUS.DRAFT]: 'Brouillon',
  [INVOICE_STATUS.PENDING]: 'En attente',
  [INVOICE_STATUS.ISSUED]: 'Émise',
  [INVOICE_STATUS.PARTIAL]: 'Partielle',
  [INVOICE_STATUS.PAID]: 'Payée',
  [INVOICE_STATUS.OVERDUE]: 'En retard',
  [INVOICE_STATUS.FAILED]: 'Échouée',
  [INVOICE_STATUS.DECLINED]: 'Refusée',
  [INVOICE_STATUS.REFUNDED]: 'Remboursée',
  [INVOICE_STATUS.CREDITED]: 'Créditée',
  [INVOICE_STATUS.CANCELLED]: 'Annulée',
  [INVOICE_STATUS.VOIDED]: 'Annulée',
};

// CSS classes for status badges
export const INVOICE_STATUS_COLORS: Record<InvoiceStatus, string> = {
  [INVOICE_STATUS.DRAFT]: 'bg-gray-100 text-gray-800',
  [INVOICE_STATUS.PENDING]: 'bg-yellow-100 text-yellow-800',
  [INVOICE_STATUS.ISSUED]: 'bg-blue-100 text-blue-800',
  [INVOICE_STATUS.PARTIAL]: 'bg-orange-100 text-orange-800',
  [INVOICE_STATUS.PAID]: 'bg-green-100 text-green-800',
  [INVOICE_STATUS.OVERDUE]: 'bg-red-100 text-red-800',
  [INVOICE_STATUS.FAILED]: 'bg-red-100 text-red-800',
  [INVOICE_STATUS.DECLINED]: 'bg-red-100 text-red-800',
  [INVOICE_STATUS.REFUNDED]: 'bg-purple-100 text-purple-800',
  [INVOICE_STATUS.CREDITED]: 'bg-purple-100 text-purple-800',
  [INVOICE_STATUS.CANCELLED]: 'bg-gray-100 text-gray-800',
  [INVOICE_STATUS.VOIDED]: 'bg-gray-100 text-gray-800',
};

/**
 * Check if an invoice status transition is valid
 */
export function isValidInvoiceStatusTransition(from: InvoiceStatus, to: InvoiceStatus): boolean {
  // Cannot transition from paid to anything except refunded/credited
  if (from === INVOICE_STATUS.PAID) {
    return to === INVOICE_STATUS.REFUNDED || to === INVOICE_STATUS.CREDITED;
  }
  
  // Cannot transition from refunded/credited/cancelled/voided
  const closedNonPaid = CLOSED_INVOICE_STATUSES.filter(s => s !== INVOICE_STATUS.PAID);
  if (closedNonPaid.includes(from)) {
    return false;
  }
  
  // All other transitions are allowed
  return true;
}
