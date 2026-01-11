/**
 * Payment/Transaction Source Constants
 */

export const PAYMENT_SOURCES = {
  MANUAL: 'manual',
  PORTAL: 'portal',
  ADMIN: 'admin',
  SYSTEM: 'system',
  AUTO: 'auto',
  TRIGGER: 'trigger',
  ETRANSFER: 'etransfer',
  CARD: 'card',
  CRYPTO: 'crypto',
  CASH: 'cash',
  CHECK: 'check',
  BANK_TRANSFER: 'bank_transfer',
} as const;

export type PaymentSource = typeof PAYMENT_SOURCES[keyof typeof PAYMENT_SOURCES];

// Sources that are automated (don't require created_by_id)
export const AUTOMATED_SOURCES: PaymentSource[] = [
  PAYMENT_SOURCES.SYSTEM,
  PAYMENT_SOURCES.AUTO,
  PAYMENT_SOURCES.TRIGGER,
];

// Human-readable labels (French)
export const PAYMENT_SOURCE_LABELS: Record<PaymentSource, string> = {
  [PAYMENT_SOURCES.MANUAL]: 'Manuel',
  [PAYMENT_SOURCES.PORTAL]: 'Portail client',
  [PAYMENT_SOURCES.ADMIN]: 'Administration',
  [PAYMENT_SOURCES.SYSTEM]: 'Système',
  [PAYMENT_SOURCES.AUTO]: 'Automatique',
  [PAYMENT_SOURCES.TRIGGER]: 'Déclencheur',
  [PAYMENT_SOURCES.ETRANSFER]: 'Virement Interac',
  [PAYMENT_SOURCES.CARD]: 'Carte',
  [PAYMENT_SOURCES.CRYPTO]: 'Cryptomonnaie',
  [PAYMENT_SOURCES.CASH]: 'Espèces',
  [PAYMENT_SOURCES.CHECK]: 'Chèque',
  [PAYMENT_SOURCES.BANK_TRANSFER]: 'Virement bancaire',
};
