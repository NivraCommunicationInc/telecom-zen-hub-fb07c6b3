/**
 * Payment module constants — statuses, methods, labels
 */

export const PAYMENT_STATUSES = {
  pending: "En attente",
  in_verification: "En vérification",
  confirmed: "Confirmé",
  completed: "Complété",
  failed: "Échoué",
  declined: "Refusé",
  fraud: "Fraude",
  refunded: "Remboursé",
  reversed: "Annulé",
  manual_review: "Révision manuelle",
} as const;

export const PAYMENT_METHODS = {
  card: "Carte de crédit",
  paypal: "PayPal",
  interac: "Interac e-Transfer",
  manual: "Manuel",
  internal: "Ajustement interne",
} as const;

export type PaymentStatusKey = keyof typeof PAYMENT_STATUSES;
export type PaymentMethodKey = keyof typeof PAYMENT_METHODS;

export const STATUS_VARIANT_MAP: Record<string, string> = {
  pending: "warning",
  in_verification: "purple",
  confirmed: "success",
  completed: "success",
  failed: "danger",
  declined: "danger",
  fraud: "danger",
  refunded: "info",
  reversed: "info",
  manual_review: "purple",
};

export const fmtCAD = (n: number | null | undefined) =>
  n != null ? `${n.toFixed(2)} $` : "—";
