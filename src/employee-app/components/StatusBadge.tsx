/**
 * StatusBadge — Unified status display for all employee portal tables.
 * Enforces canonical telecom status labels.
 */
import { cn } from "@/lib/utils";

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  // Order statuses
  pending: { label: "En attente", color: "text-amber-400 bg-amber-500/10" },
  submitted: { label: "Soumise", color: "text-blue-400 bg-blue-500/10" },
  received: { label: "Reçue", color: "text-blue-400 bg-blue-500/10" },
  processing: { label: "En traitement", color: "text-indigo-400 bg-indigo-500/10" },
  confirmed: { label: "Confirmée", color: "text-blue-400 bg-blue-500/10" },
  shipped: { label: "Expédiée", color: "text-cyan-400 bg-cyan-500/10" },
  delivered: { label: "Livrée", color: "text-blue-400 bg-blue-500/10" },
  installed: { label: "Installée", color: "text-indigo-400 bg-indigo-500/10" },
  activated: { label: "Activée", color: "text-emerald-400 bg-emerald-500/10" },
  completed: { label: "Complétée", color: "text-emerald-400 bg-emerald-500/10" },
  cancelled: { label: "Annulée", color: "text-red-400 bg-red-500/10" },
  on_hold: { label: "En pause", color: "text-amber-400 bg-amber-500/10" },
  // Payment statuses
  paid: { label: "Payé", color: "text-emerald-400 bg-emerald-500/10" },
  captured: { label: "Capturé", color: "text-emerald-400 bg-emerald-500/10" },
  failed: { label: "Échoué", color: "text-red-400 bg-red-500/10" },
  declined: { label: "Refusé", color: "text-red-400 bg-red-500/10" },
  // Invoice
  overdue: { label: "En retard", color: "text-red-400 bg-red-500/10" },
  sent: { label: "Envoyée", color: "text-blue-400 bg-blue-500/10" },
  draft: { label: "Brouillon", color: "text-muted-foreground bg-muted" },
  void: { label: "Annulée", color: "text-muted-foreground bg-muted" },
  // Subscription
  active: { label: "Actif", color: "text-emerald-400 bg-emerald-500/10" },
  suspended: { label: "Suspendu", color: "text-red-400 bg-red-500/10" },
  expired: { label: "Expiré", color: "text-amber-400 bg-amber-500/10" },
  pending_activation: { label: "En attente", color: "text-blue-400 bg-blue-500/10" },
  // Support
  open: { label: "Ouvert", color: "text-blue-400 bg-blue-500/10" },
  in_progress: { label: "En cours", color: "text-indigo-400 bg-indigo-500/10" },
  resolved: { label: "Résolu", color: "text-emerald-400 bg-emerald-500/10" },
  closed: { label: "Fermé", color: "text-muted-foreground bg-muted" },
  // KYC
  approved: { label: "Approuvé", color: "text-emerald-400 bg-emerald-500/10" },
  rejected: { label: "Rejeté", color: "text-red-400 bg-red-500/10" },
  // Equipment
  assigned: { label: "Assigné", color: "text-blue-400 bg-blue-500/10" },
  deployed: { label: "Déployé", color: "text-emerald-400 bg-emerald-500/10" },
  in_stock: { label: "En stock", color: "text-cyan-400 bg-cyan-500/10" },
  reserved: { label: "Réservé", color: "text-amber-400 bg-amber-500/10" },
  // Appointment
  scheduled: { label: "Planifié", color: "text-blue-400 bg-blue-500/10" },
  no_show: { label: "No-show", color: "text-amber-400 bg-amber-500/10" },
};

interface Props {
  status: string | null | undefined;
  className?: string;
}

export function StatusBadge({ status, className }: Props) {
  const s = status?.toLowerCase() ?? "";
  const config = STATUS_MAP[s];
  
  return (
    <span className={cn(
      "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap",
      config?.color ?? "text-muted-foreground bg-muted",
      className
    )}>
      {config?.label ?? status ?? "—"}
    </span>
  );
}
