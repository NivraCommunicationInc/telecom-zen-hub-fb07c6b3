/**
 * Installation Status Utilities
 * Handles the installation workflow statuses and automatic transitions
 */

// Installation-specific statuses in order of progression
export const INSTALLATION_STATUSES = {
  installation_scheduled: {
    label: "Installation planifiée",
    color: "bg-blue-500/20 text-blue-500",
    icon: "Calendar",
    order: 1,
  },
  technician_en_route: {
    label: "Technicien en route",
    color: "bg-cyan-500/20 text-cyan-500",
    icon: "Truck",
    order: 2,
  },
  installation_in_progress: {
    label: "Installation en cours",
    color: "bg-amber-500/20 text-amber-500",
    icon: "Wrench",
    order: 3,
  },
  installation_completed: {
    label: "Installation terminée",
    color: "bg-emerald-500/20 text-emerald-500",
    icon: "CheckCircle",
    order: 4,
  },
} as const;

export type InstallationStatus = keyof typeof INSTALLATION_STATUSES;

// Status that should trigger auto-transition to "completed"
export const FINAL_INSTALLATION_STATUS = "installation_completed";
export const ORDER_COMPLETED_STATUS = "completed";

// Check if a status is an installation status
export function isInstallationStatus(status: string): status is InstallationStatus {
  return status in INSTALLATION_STATUSES;
}

// Get the current progression order of a status
export function getStatusOrder(status: string): number {
  if (isInstallationStatus(status)) {
    return INSTALLATION_STATUSES[status].order;
  }
  // Non-installation statuses
  switch (status) {
    case "pending": return 0;
    case "completed": return 5;
    case "cancelled": return -1;
    default: return 0;
  }
}

// Check if the current status should allow automatic transition to "installation_scheduled"
export function shouldAutoSetInstallationScheduled(currentStatus: string): boolean {
  // Only auto-set if status is at a lower progression than installation_scheduled
  const currentOrder = getStatusOrder(currentStatus);
  const scheduledOrder = INSTALLATION_STATUSES.installation_scheduled.order;
  
  // Don't auto-set if already at or past installation_scheduled, or if completed/cancelled
  return currentOrder < scheduledOrder && currentStatus !== "cancelled" && currentStatus !== "completed";
}

// Check if installation_completed should trigger order completion
export function shouldAutoCompleteOrder(newStatus: string): boolean {
  return newStatus === FINAL_INSTALLATION_STATUS;
}

// Get the label for a status (installation or regular)
export function getInstallationStatusLabel(status: string): string {
  if (isInstallationStatus(status)) {
    return INSTALLATION_STATUSES[status].label;
  }
  
  // Fallback for regular statuses
  const regularLabels: Record<string, string> = {
    pending: "En attente",
    hold: "Suspendu",
    verification: "Vérification",
    back_order: "Back Order",
    cancelled: "Annulé",
    shipped: "Expédié",
    completed: "Terminé",
  };
  
  return regularLabels[status] || status;
}

// All order status options including installation statuses
export const ALL_ORDER_STATUS_OPTIONS = [
  { value: "pending", label: "En attente" },
  { value: "hold", label: "Suspendu" },
  { value: "verification", label: "Vérification" },
  { value: "back_order", label: "Back Order" },
  { value: "cancelled", label: "Annulé" },
  { value: "shipped", label: "Expédié" },
  { value: "installation_scheduled", label: "Installation planifiée" },
  { value: "technician_en_route", label: "Technicien en route" },
  { value: "installation_in_progress", label: "Installation en cours" },
  { value: "installation_completed", label: "Installation terminée" },
  { value: "completed", label: "Commande complétée" },
];

// Status configuration for display (merged with installation statuses)
export const ORDER_STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  pending: { color: "bg-amber-500/20 text-amber-500", label: "En attente" },
  hold: { color: "bg-purple-500/20 text-purple-500", label: "Suspendu" },
  verification: { color: "bg-blue-500/20 text-blue-500", label: "Vérification" },
  back_order: { color: "bg-orange-500/20 text-orange-500", label: "Back Order" },
  cancelled: { color: "bg-red-500/20 text-red-500", label: "Annulé" },
  shipped: { color: "bg-cyan-500/20 text-cyan-400", label: "Expédié" },
  completed: { color: "bg-emerald-500/20 text-emerald-500", label: "Terminé" },
  installation_scheduled: { color: "bg-blue-500/20 text-blue-500", label: "Installation planifiée" },
  technician_en_route: { color: "bg-cyan-500/20 text-cyan-500", label: "Technicien en route" },
  installation_in_progress: { color: "bg-amber-500/20 text-amber-500", label: "Installation en cours" },
  installation_completed: { color: "bg-emerald-500/20 text-emerald-500", label: "Installation terminée" },
};
