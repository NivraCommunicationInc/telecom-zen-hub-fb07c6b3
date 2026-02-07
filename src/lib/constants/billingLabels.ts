/**
 * BILLING LABELS — CENTRALIZED TERMINOLOGY (NIVRA TELECOM)
 * 
 * RÈGLE ABSOLUE: Ces labels sont la source de vérité unique pour toute terminologie
 * liée à la facturation client-facing. Aucun terme "postpayé" ne doit être utilisé.
 * 
 * TERMES INTERDITS (ne jamais utiliser dans l'UI client):
 * - "impayé" / "unpaid"
 * - "dette" / "debt"
 * - "overdue" (comme statut visible client)
 * - tout équivalent postpayé ambigu
 * 
 * @see docs/billing_v2.md (Section: Terminologie Officielle)
 */

// =============================================================================
// INVOICE STATUS LABELS (CLIENT-FACING)
// =============================================================================

export const INVOICE_STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  issued: "Émise",
  paid: "Payée",
  partial: "Paiement partiel",
  cancelled: "Annulée",
  void: "Annulée (non-renouvellement)",
  refunded: "Remboursée",
  // PREPAID-SPECIFIC: No "overdue" debt terminology
  overdue: "Renouvellement requis",
  expired: "Service expiré",
  renewal_due: "Renouvellement dû",
  in_verification: "En vérification",
  pre_authorized: "Pré-autorisé",
  suspended: "Service suspendu (litige)",
  not_renewed: "Non renouvelé",
  failed: "Échec de paiement",
};

// =============================================================================
// INVOICE STATUS COLORS (SEMANTIC TOKENS)
// =============================================================================

export const INVOICE_STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-500/20 text-amber-500",
  issued: "bg-blue-500/20 text-blue-500",
  paid: "bg-emerald-500/20 text-emerald-500",
  partial: "bg-orange-500/20 text-orange-500",
  cancelled: "bg-muted text-muted-foreground",
  void: "bg-muted text-muted-foreground",
  refunded: "bg-purple-500/20 text-purple-500",
  // Prepaid urgency colors
  overdue: "bg-red-500/20 text-red-500",
  expired: "bg-red-600/20 text-red-600",
  renewal_due: "bg-orange-500/20 text-orange-500",
  in_verification: "bg-cyan-500/20 text-cyan-500",
  pre_authorized: "bg-blue-500/20 text-blue-500",
  suspended: "bg-red-500/20 text-red-500",
  not_renewed: "bg-muted text-muted-foreground",
  failed: "bg-red-500/20 text-red-500",
};

// =============================================================================
// PAYMENT STATUS LABELS (CLIENT-FACING)
// =============================================================================

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  completed: "Confirmé",
  confirmed: "Confirmé",
  captured: "Capturé",
  failed: "Échoué",
  refunded: "Remboursé",
  cancelled: "Annulé",
  disputed: "Contesté (litige)",
  chargeback: "Rétrofacturation",
  fraud: "Fraude détectée",
  reversed: "Inversé",
  voided: "Annulé",
  pre_authorized: "Pré-autorisé",
};

export const PAYMENT_STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-500/20 text-amber-500",
  completed: "bg-emerald-500/20 text-emerald-500",
  confirmed: "bg-emerald-500/20 text-emerald-500",
  captured: "bg-emerald-500/20 text-emerald-500",
  failed: "bg-red-500/20 text-red-500",
  refunded: "bg-purple-500/20 text-purple-500",
  cancelled: "bg-muted text-muted-foreground",
  disputed: "bg-purple-500/20 text-purple-500",
  chargeback: "bg-red-600/20 text-red-600",
  fraud: "bg-red-600/30 text-red-600",
  reversed: "bg-muted text-muted-foreground",
  voided: "bg-muted text-muted-foreground",
  pre_authorized: "bg-blue-500/20 text-blue-500",
};

// =============================================================================
// SUBSCRIPTION / SERVICE STATUS LABELS (CLIENT-FACING)
// =============================================================================

export const SERVICE_STATUS_LABELS: Record<string, string> = {
  active: "Actif",
  paused: "En pause",
  suspended: "Suspendu (litige)",
  expired: "Expiré (non renouvelé)",
  cancelled: "Annulé",
  pending: "En attente d'activation",
  hold: "En attente",
  frozen: "Compte gelé (litige)",
};

export const SERVICE_STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-500/20 text-emerald-500",
  paused: "bg-amber-500/20 text-amber-500",
  suspended: "bg-red-500/20 text-red-500",
  expired: "bg-red-600/20 text-red-600",
  cancelled: "bg-muted text-muted-foreground",
  pending: "bg-amber-500/20 text-amber-500",
  hold: "bg-purple-500/20 text-purple-500",
  frozen: "bg-red-600/30 text-red-600",
};

// =============================================================================
// PREPAID BANNER LABELS
// =============================================================================

export const PREPAID_BANNER_LABELS = {
  // Critical urgency (> 30 days)
  critical: {
    title: "Action urgente requise!",
    subtitle: "Service à risque d'expiration",
  },
  // Urgent (> 7 days)
  urgent: {
    title: "Renouvellement requis",
    subtitle: "Veuillez renouveler pour maintenir votre service",
  },
  // Normal pending
  normal: {
    title: "Facture(s) en attente",
    subtitle: "Renouvelez pour maintenir votre service actif",
  },
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get the appropriate invoice status label for client-facing UI
 * Converts internal statuses to prepaid-friendly terminology
 */
export function getInvoiceStatusLabel(status: string, isOverdue?: boolean): string {
  // If marked as overdue but status is still "pending", show renewal required
  if (isOverdue && status === "pending") {
    return INVOICE_STATUS_LABELS.overdue;
  }
  return INVOICE_STATUS_LABELS[status] || status;
}

/**
 * Get the appropriate invoice status color
 */
export function getInvoiceStatusColor(status: string, isOverdue?: boolean): string {
  if (isOverdue && status === "pending") {
    return INVOICE_STATUS_COLORS.overdue;
  }
  return INVOICE_STATUS_COLORS[status] || "bg-muted";
}

/**
 * Get payment status label
 */
export function getPaymentStatusLabel(status: string): string {
  return PAYMENT_STATUS_LABELS[status] || status;
}

/**
 * Get service status label
 */
export function getServiceStatusLabel(status: string): string {
  return SERVICE_STATUS_LABELS[status] || status;
}

/**
 * Get service status color
 */
export function getServiceStatusColor(status: string): string {
  return SERVICE_STATUS_COLORS[status] || "bg-muted";
}

/**
 * Get banner content based on urgency level
 */
export function getPrepaidBannerContent(daysOverdue: number) {
  if (daysOverdue > 30) return PREPAID_BANNER_LABELS.critical;
  if (daysOverdue > 7) return PREPAID_BANNER_LABELS.urgent;
  return PREPAID_BANNER_LABELS.normal;
}

// =============================================================================
// LEGACY ALIAS (for backwards compatibility during migration)
// =============================================================================

/** @deprecated Use INVOICE_STATUS_LABELS instead */
export const statusLabels = INVOICE_STATUS_LABELS;
/** @deprecated Use INVOICE_STATUS_COLORS instead */
export const statusColors = INVOICE_STATUS_COLORS;
