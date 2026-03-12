/**
 * Subscription module constants
 */

export const SUB_STATUSES: Record<string, string> = {
  pending: "En attente",
  active: "Actif",
  suspended: "Suspendu",
  expired: "Expiré",
  cancelled: "Annulé",
};

export const SUB_CATEGORIES: Record<string, string> = {
  internet: "Internet",
  tv: "Télévision",
  mobile: "Mobile",
  combo: "Combo",
  streaming: "Streaming",
  security: "Sécurité",
};

export const fmtCAD = (n: number | null | undefined) =>
  n != null ? `${n.toFixed(2)} $` : "—";
