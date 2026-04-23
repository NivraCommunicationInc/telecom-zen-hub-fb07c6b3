/**
 * NextActionBanner — Single clear directive for field agents.
 * Shows exactly ONE thing the agent should do next for this order.
 */
import {
  Send, RefreshCw, Clock, CheckCircle2, Calendar,
  AlertCircle, XCircle, CreditCard, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  paymentStatus: string | null;
  syncStatus: string | null;
  convertedOrderId: string | null;
  canonicalOrderStatus?: string | null;
  hasAppointment?: boolean;
  subscriptionStatus?: string | null;
}

interface ActionConfig {
  message: string;
  icon: typeof Send;
  classes: string;
}

function resolveNextAction(props: Props): ActionConfig {
  const { paymentStatus, syncStatus, convertedOrderId, canonicalOrderStatus, hasAppointment, subscriptionStatus } = props;

  if (paymentStatus === "cancelled") {
    return { message: "Commande annulée — aucune action requise", icon: XCircle, classes: "bg-[hsl(var(--field-card))] border-[hsl(var(--field-border-subtle))] text-[hsl(var(--field-text-muted))]" };
  }

  if (paymentStatus === "failed") {
    return { message: "Paiement échoué — contacter le client pour nouveau paiement", icon: AlertCircle, classes: "bg-[hsl(var(--field-danger)/0.12)] border-[hsl(var(--field-danger)/0.3)] text-[hsl(var(--field-danger))]" };
  }

  if (paymentStatus === "pending" || paymentStatus !== "confirmed") {
    return { message: "Envoyer le lien de paiement au client", icon: CreditCard, classes: "bg-[hsl(var(--field-warning)/0.12)] border-[hsl(var(--field-warning)/0.3)] text-[hsl(var(--field-warning))]" };
  }

  // Paid but not synced
  if (!convertedOrderId && syncStatus === "error") {
    return { message: "Relancer la synchronisation vers Core", icon: RefreshCw, classes: "bg-[hsl(var(--field-danger)/0.12)] border-[hsl(var(--field-danger)/0.3)] text-[hsl(var(--field-danger))]" };
  }

  if (!convertedOrderId) {
    return { message: "En attente de synchronisation Core", icon: Clock, classes: "bg-[hsl(var(--field-warning)/0.12)] border-[hsl(var(--field-warning)/0.3)] text-[hsl(var(--field-warning))]" };
  }

  // Synced — check operational state
  if (canonicalOrderStatus === "completed" || canonicalOrderStatus === "activated") {
    return { message: "Commande complétée — service actif", icon: CheckCircle2, classes: "bg-[hsl(var(--field-success)/0.12)] border-[hsl(var(--field-success)/0.3)] text-[hsl(var(--field-success))]" };
  }

  if (subscriptionStatus === "active") {
    return { message: "Service activé — aucune action requise", icon: Zap, classes: "bg-[hsl(var(--field-success)/0.12)] border-[hsl(var(--field-success)/0.3)] text-[hsl(var(--field-success))]" };
  }

  if (!hasAppointment && ["processing", "received", "confirmed"].includes(canonicalOrderStatus || "")) {
    return { message: "Planification du rendez-vous requise", icon: Calendar, classes: "bg-[hsl(var(--field-accent)/0.12)] border-[hsl(var(--field-accent)/0.3)] text-[hsl(var(--field-accent-glow))]" };
  }

  return { message: "Pris en charge par les opérations", icon: CheckCircle2, classes: "bg-[hsl(var(--field-success)/0.12)] border-[hsl(var(--field-success)/0.3)] text-[hsl(var(--field-success))]" };
}

export function NextActionBanner(props: Props) {
  const action = resolveNextAction(props);
  const Icon = action.icon;

  return (
    <div className={cn("flex items-center gap-3 p-4 rounded-xl border", action.classes)}>
      <Icon className="h-5 w-5 shrink-0" />
      <p className="text-sm font-semibold">{action.message}</p>
    </div>
  );
}
