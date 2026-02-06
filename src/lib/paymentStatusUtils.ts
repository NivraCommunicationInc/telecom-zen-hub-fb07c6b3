/**
 * Payment Status Utilities
 * Shared logic for displaying payment statuses based on payment method
 * 
 * This centralizes the status label/color logic to avoid duplication
 * across client portal, admin dashboard, and staff interfaces.
 */

export type PaymentMethod = 
  | 'paypal' 
  | 'interac' 
  | 'e_transfer' 
  | 'card' 
  | 'credit_card' 
  | 'cash' 
  | 'manual'
  | 'bank_transfer';

export type PaymentStatus = 
  | 'pending' 
  | 'confirmed' 
  | 'completed' 
  | 'captured' 
  | 'pre_authorized' 
  | 'failed' 
  | 'refunded'
  | 'error_captured';

export interface PaymentStatusInfo {
  label: string;
  color: string;
  textClass: string;
  bgClass: string;
}

/**
 * Get contextual status information based on payment method
 * 
 * - PayPal: confirmed/captured → "Payé"
 * - Interac: pending → "En attente", confirmed → "Reçu"
 * - Credit Card: pre_authorized → "Autorisé", captured → "Payé"
 */
export function getPaymentStatusInfo(
  status: string, 
  method?: string
): PaymentStatusInfo {
  const normalizedMethod = method?.toLowerCase() || '';
  const normalizedStatus = status?.toLowerCase() || '';

  // PayPal: instant confirmation
  if (normalizedMethod === 'paypal') {
    if (['confirmed', 'completed', 'captured'].includes(normalizedStatus)) {
      return {
        label: 'Payé',
        color: 'emerald',
        textClass: 'text-emerald-600 dark:text-emerald-400',
        bgClass: 'bg-emerald-100 dark:bg-emerald-900/30',
      };
    }
    if (normalizedStatus === 'pending') {
      return {
        label: 'En cours',
        color: 'amber',
        textClass: 'text-amber-600 dark:text-amber-400',
        bgClass: 'bg-amber-100 dark:bg-amber-900/30',
      };
    }
    if (normalizedStatus === 'failed') {
      return {
        label: 'Échoué',
        color: 'red',
        textClass: 'text-red-600 dark:text-red-400',
        bgClass: 'bg-red-100 dark:bg-red-900/30',
      };
    }
  }

  // Interac / E-Transfer: manual confirmation
  if (normalizedMethod === 'interac' || normalizedMethod === 'e_transfer') {
    if (normalizedStatus === 'pending') {
      return {
        label: 'En attente',
        color: 'amber',
        textClass: 'text-amber-600 dark:text-amber-400',
        bgClass: 'bg-amber-100 dark:bg-amber-900/30',
      };
    }
    if (['confirmed', 'completed'].includes(normalizedStatus)) {
      return {
        label: 'Reçu',
        color: 'emerald',
        textClass: 'text-emerald-600 dark:text-emerald-400',
        bgClass: 'bg-emerald-100 dark:bg-emerald-900/30',
      };
    }
  }

  // Credit Card: pre-auth then capture
  if (normalizedMethod === 'card' || normalizedMethod === 'credit_card') {
    if (normalizedStatus === 'pre_authorized') {
      return {
        label: 'Autorisé',
        color: 'purple',
        textClass: 'text-purple-600 dark:text-purple-400',
        bgClass: 'bg-purple-100 dark:bg-purple-900/30',
      };
    }
    if (['confirmed', 'completed', 'captured'].includes(normalizedStatus)) {
      return {
        label: 'Payé',
        color: 'emerald',
        textClass: 'text-emerald-600 dark:text-emerald-400',
        bgClass: 'bg-emerald-100 dark:bg-emerald-900/30',
      };
    }
  }

  // Cash: always confirmed immediately
  if (normalizedMethod === 'cash') {
    if (['confirmed', 'completed'].includes(normalizedStatus)) {
      return {
        label: 'Reçu',
        color: 'emerald',
        textClass: 'text-emerald-600 dark:text-emerald-400',
        bgClass: 'bg-emerald-100 dark:bg-emerald-900/30',
      };
    }
  }

  // Default fallbacks
  if (['confirmed', 'completed', 'captured'].includes(normalizedStatus)) {
    return {
      label: 'Confirmé',
      color: 'emerald',
      textClass: 'text-emerald-600 dark:text-emerald-400',
      bgClass: 'bg-emerald-100 dark:bg-emerald-900/30',
    };
  }

  if (normalizedStatus === 'pending') {
    return {
      label: 'En attente',
      color: 'amber',
      textClass: 'text-amber-600 dark:text-amber-400',
      bgClass: 'bg-amber-100 dark:bg-amber-900/30',
    };
  }

  if (normalizedStatus === 'pre_authorized') {
    return {
      label: 'Autorisé',
      color: 'purple',
      textClass: 'text-purple-600 dark:text-purple-400',
      bgClass: 'bg-purple-100 dark:bg-purple-900/30',
    };
  }

  if (normalizedStatus === 'failed' || normalizedStatus === 'error_captured') {
    return {
      label: 'Échoué',
      color: 'red',
      textClass: 'text-red-600 dark:text-red-400',
      bgClass: 'bg-red-100 dark:bg-red-900/30',
    };
  }

  if (normalizedStatus === 'refunded') {
    return {
      label: 'Remboursé',
      color: 'gray',
      textClass: 'text-gray-600 dark:text-gray-400',
      bgClass: 'bg-gray-100 dark:bg-gray-800',
    };
  }

  // Unknown status
  return {
    label: status || 'Inconnu',
    color: 'gray',
    textClass: 'text-muted-foreground',
    bgClass: 'bg-muted',
  };
}

/**
 * Payment method display configuration
 */
export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  paypal: 'PayPal',
  interac: 'Interac',
  e_transfer: 'Interac',
  card: 'Carte',
  credit_card: 'Carte',
  cash: 'Comptant',
  manual: 'Manuel',
  bank_transfer: 'Virement',
};

/**
 * Get display label for payment method
 */
export function getPaymentMethodLabel(method: string): string {
  return PAYMENT_METHOD_LABELS[method?.toLowerCase()] || method || 'Autre';
}
