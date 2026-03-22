/**
 * NextOperationalStep — Shows the ONE thing blocking this order
 * and what must happen next, with blocked reasons.
 */
import {
  AlertTriangle, CreditCard, Package, Calendar, Wrench,
  Zap, CheckCircle, Truck, Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  orderStatus: string;
  paymentStatus: string | null;
  hasEquipment: boolean;
  hasAppointment: boolean;
  subscriptionStatus: string | null;
  invoiceStatus: string | null;
}

interface StepResult {
  message: string;
  blockedReason?: string;
  icon: typeof AlertTriangle;
  variant: "warning" | "error" | "info" | "success";
}

const VARIANT_CLASSES = {
  warning: "border-amber-500/30 bg-amber-500/[0.06] text-amber-300",
  error: "border-red-500/30 bg-red-500/[0.06] text-red-300",
  info: "border-blue-500/30 bg-blue-500/[0.06] text-blue-300",
  success: "border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-300",
};

function resolve(props: Props): StepResult {
  const { orderStatus, paymentStatus, hasEquipment, hasAppointment, subscriptionStatus } = props;

  if (orderStatus === "completed" || orderStatus === "activated") {
    return { message: "Commande complétée — aucune action requise", icon: CheckCircle, variant: "success" };
  }

  if (orderStatus === "cancelled") {
    return { message: "Commande annulée", icon: CheckCircle, variant: "success" };
  }

  if (paymentStatus !== "paid" && paymentStatus !== "completed" && paymentStatus !== "captured") {
    return {
      message: "En attente de paiement",
      blockedReason: "Activation impossible — paiement non confirmé",
      icon: CreditCard,
      variant: "error",
    };
  }

  if (orderStatus === "pending" || orderStatus === "submitted") {
    return { message: "Marquer la commande comme reçue", icon: Package, variant: "info" };
  }

  if (orderStatus === "received") {
    return { message: "Commencer le traitement", icon: Package, variant: "info" };
  }

  if (orderStatus === "processing") {
    if (!hasEquipment) {
      return { message: "En attente d'équipement", blockedReason: "Assigner un équipement depuis l'inventaire", icon: Wrench, variant: "warning" };
    }
    if (!hasAppointment) {
      return { message: "En attente de rendez-vous", blockedReason: "Planifier un rendez-vous d'installation", icon: Calendar, variant: "warning" };
    }
    return { message: "Prêt pour expédition ou installation", icon: Truck, variant: "info" };
  }

  if (orderStatus === "shipped") {
    return { message: "En attente de livraison", icon: Truck, variant: "info" };
  }

  if (orderStatus === "delivered" || orderStatus === "installed") {
    if (subscriptionStatus !== "active") {
      return { message: "Prêt pour activation du service", icon: Zap, variant: "info" };
    }
    return { message: "Service activé — marquer comme complétée", icon: CheckCircle, variant: "success" };
  }

  if (orderStatus === "on_hold") {
    return { message: "Commande en pause — reprendre le traitement", blockedReason: "Vérifier la raison de la mise en pause", icon: Clock, variant: "warning" };
  }

  return { message: "Vérifier l'état de la commande", icon: AlertTriangle, variant: "warning" };
}

export function NextOperationalStep(props: Props) {
  const step = resolve(props);
  const Icon = step.icon;

  return (
    <div className={cn("rounded-xl border p-4", VARIANT_CLASSES[step.variant])}>
      <div className="flex items-center gap-3">
        <Icon className="h-5 w-5 shrink-0" />
        <div>
          <p className="text-sm font-semibold">{step.message}</p>
          {step.blockedReason && (
            <p className="text-xs opacity-75 mt-0.5 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> {step.blockedReason}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
