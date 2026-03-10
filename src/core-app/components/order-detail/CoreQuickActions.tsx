/**
 * CoreQuickActions — Operational quick-action bar for the order console
 */
import { useState } from "react";
import { toast } from "sonner";
import {
  Wrench, Calendar, FileText, Wifi, Headphones, Ban,
  Loader2, ChevronDown
} from "lucide-react";

interface Props {
  proc: any;
}

interface QuickAction {
  id: string;
  label: string;
  icon: any;
  variant: "default" | "success" | "danger" | "warning";
  disabled?: boolean;
  disabledReason?: string;
  handler: () => Promise<void>;
}

export function CoreQuickActions({ proc }: Props) {
  const [loading, setLoading] = useState<string | null>(null);

  const order = proc.order;
  const isCompleted = order?.status === "completed" || order?.status === "cancelled";

  const actions: QuickAction[] = [
    {
      id: "assign_tech",
      label: "Assigner technicien",
      icon: Wrench,
      variant: "default",
      disabled: !!order?.technician_id,
      disabledReason: "Technicien déjà assigné",
      handler: async () => {
        // Set active step to shipping/technician for assignment
        proc.setActiveStep("shipping");
        toast.info("Naviguez vers l'étape Technicien pour assigner");
      },
    },
    {
      id: "schedule",
      label: "Planifier installation",
      icon: Calendar,
      variant: "default",
      disabled: !!proc.appointment,
      disabledReason: "Rendez-vous déjà planifié",
      handler: async () => {
        proc.setActiveStep("fulfillment");
        toast.info("Naviguez vers l'étape Fulfillment pour planifier");
      },
    },
    {
      id: "send_contract",
      label: "Envoyer contrat",
      icon: FileText,
      variant: "default",
      handler: async () => {
        if (!order?.client_email) {
          toast.error("Aucun courriel client disponible");
          return;
        }
        await proc.sendClientNotification(
          "contract_ready",
          "Votre contrat est prêt — Nivra"
        );
      },
    },
    {
      id: "activate",
      label: "Activer service",
      icon: Wifi,
      variant: "success",
      disabled: isCompleted || order?.status === "activated",
      disabledReason: "Service déjà actif",
      handler: async () => {
        await proc.changeStatus("activated", "Activation manuelle via console");
      },
    },
    {
      id: "ticket",
      label: "Créer ticket",
      icon: Headphones,
      variant: "default",
      handler: async () => {
        // Navigate to support ticket creation — placeholder
        toast.info("Fonctionnalité de création de ticket à venir");
      },
    },
    {
      id: "suspend",
      label: "Suspendre",
      icon: Ban,
      variant: "danger",
      disabled: isCompleted || order?.status === "suspended",
      disabledReason: "Déjà suspendu ou complété",
      handler: async () => {
        await proc.changeStatus("suspended", "Suspension manuelle via console");
      },
    },
  ];

  const handleAction = async (action: QuickAction) => {
    if (action.disabled) {
      toast.info(action.disabledReason || "Action non disponible");
      return;
    }
    setLoading(action.id);
    try {
      await action.handler();
    } catch (err: any) {
      toast.error(err?.message || "Erreur lors de l'action");
    } finally {
      setLoading(null);
    }
  };

  const variantClasses: Record<string, string> = {
    default: "border-[hsl(220,15%,20%)] bg-[hsl(220,20%,13%)] text-[hsl(220,10%,55%)] hover:text-white hover:border-[hsl(220,15%,28%)]",
    success: "border-emerald-500/25 bg-emerald-500/8 text-emerald-400 hover:bg-emerald-500/15 hover:border-emerald-500/40",
    danger: "border-red-500/25 bg-red-500/8 text-red-400 hover:bg-red-500/15 hover:border-red-500/40",
    warning: "border-amber-500/25 bg-amber-500/8 text-amber-400 hover:bg-amber-500/15 hover:border-amber-500/40",
  };

  return (
    <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] px-4 py-2.5">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[9px] uppercase tracking-widest text-[hsl(220,10%,35%)] font-semibold mr-1">
          Actions rapides
        </span>
        {actions.map((action) => {
          const Icon = action.icon;
          const isLoading = loading === action.id;
          return (
            <button
              key={action.id}
              onClick={() => handleAction(action)}
              disabled={isLoading}
              className={`
                inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5
                text-[10px] font-medium transition-colors
                ${action.disabled ? "opacity-40 cursor-not-allowed" : variantClasses[action.variant]}
                ${isLoading ? "opacity-60" : ""}
              `}
            >
              {isLoading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Icon className="h-3 w-3" />
              )}
              {action.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
