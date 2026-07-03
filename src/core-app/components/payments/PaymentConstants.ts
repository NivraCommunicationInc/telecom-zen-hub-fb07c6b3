/**
 * Payment module constants — statuses, methods, labels
 * NOTE: PayPal masked as "Carte" per branding rule (no "PayPal" visible to users).
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
  card: "Carte",
  paypal: "Carte", // masked — legacy provider
  interac: "Interac",
  manual: "Manuel",
  internal: "Ajustement interne",
} as const;

export const PAYMENT_SOURCES: Record<string, string> = {
  admin: "Nivra Core",
  admin_confirm: "Nivra Core",
  portal: "Portail client",
  employee: "Employé",
  field: "Vente terrain",
  public: "Caisse publique",
  pos: "POS",
  autopay: "Autopay",
  manual_correction: "Correction manuelle",
  system: "Système",
};

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
