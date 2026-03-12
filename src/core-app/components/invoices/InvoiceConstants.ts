/**
 * Invoice module constants — statuses, types, labels
 */

export const INVOICE_STATUSES: Record<string, string> = {
  draft: "Brouillon",
  pending: "En attente",
  unpaid: "Impayée",
  partially_paid: "Partielle",
  paid: "Payée",
  paid_by_promo: "Promo",
  void: "Annulée",
  cancelled: "Annulée",
  failed: "Échouée",
  disputed: "En litige",
  overdue: "En retard",
  not_renewed: "Non renouvelée",
  refunded: "Remboursée",
};

export const INVOICE_TYPES: Record<string, string> = {
  initial: "Initiale",
  renewal: "Renouvellement",
  one_time: "Ponctuelle",
  adjustment: "Ajustement",
  credit_note: "Note de crédit",
};

export const fmtCAD = (n: number | null | undefined) =>
  n != null ? `${n.toFixed(2)} $` : "—";
