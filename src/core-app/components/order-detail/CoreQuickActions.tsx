/**
 * CoreQuickActions — Contextual operational quick-action bar
 * Actions adapt based on current order state and workflow progress
 */
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Wrench, Calendar, FileText, Wifi, Headphones, Ban,
  Loader2, CreditCard, Package, Send, CheckCircle2,
  RotateCcw, AlertTriangle, Pencil, RotateCw
} from "lucide-react";
import { EditOrderDialog } from "@/core-app/components/account-actions/EditOrderDialog";

interface Props {
  proc: any;
}

interface QuickAction {
  id: string;
  label: string;
  icon: any;
  variant: "default" | "success" | "danger" | "warning" | "primary";
  disabled?: boolean;
  disabledReason?: string;
  hidden?: boolean;
  handler: () => Promise<void>;
}

export function CoreQuickActions({ proc }: Props) {
  const [loading, setLoading] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<string | null>(null);
  const [editOrderOpen, setEditOrderOpen] = useState(false);
  const [equipReturnConfirmed, setEquipReturnConfirmed] = useState(false);

  const order = proc.order;
  const isTerminal = ["cancelled", "activated"].includes(order?.status);
  const isPaid = proc.invoice && (proc.invoice.status === "paid" || Number(proc.invoice.balance_due ?? 1) <= 0);
  const hasAppointment = !!proc.appointment;
  const hasTechnician = !!order?.technician_id;
  const hasContract = proc.contracts?.length > 0;

  // Equipment refund eligibility
  const FIRST_MONTH_FREE_CODES = ['BIENVENUE2026', 'NIVRA2026'];
  const orderPromoCode = (order?.promo_code || order?.discount_code || '').toUpperCase();
  const isFirstMonthFreeOrder = FIRST_MONTH_FREE_CODES.includes(orderPromoCode);
  const orderAge = order?.created_at ? Math.floor((Date.now() - new Date(order.created_at).getTime()) / (1000 * 60 * 60 * 24)) : 999;
  const canRefundEquipment = isFirstMonthFreeOrder && orderAge <= 30 && !order?.equipment_refunded;

  const actions: QuickAction[] = [
    // Edit order
    {
      id: "edit_order",
      label: "Modifier commande",
      icon: Pencil,
      variant: "primary",
      hidden: isTerminal,
      handler: async () => { setEditOrderOpen(true); },
    },
    // Payment - show when not paid
    {
      id: "confirm_payment",
      label: "Confirmer paiement",
      icon: CreditCard,
      variant: "success",
      hidden: isPaid || isTerminal,
      handler: async () => {
        await proc.confirmPayment();
      },
    },
    // Assign technician - show for residential orders
    {
      id: "assign_tech",
      label: hasTechnician ? "Technicien assigné ✓" : "Assigner technicien",
      icon: Wrench,
      variant: "default",
      disabled: hasTechnician,
      disabledReason: "Technicien déjà assigné",
      hidden: isTerminal,
      handler: async () => {
        proc.setActiveStep("shipping");
      },
    },
    // Schedule appointment
    {
      id: "schedule",
      label: hasAppointment ? "RDV planifié ✓" : "Planifier installation",
      icon: Calendar,
      variant: "default",
      disabled: hasAppointment,
      disabledReason: "Rendez-vous déjà planifié",
      hidden: isTerminal,
      handler: async () => {
        proc.setActiveStep("fulfillment");
      },
    },
    // Assign equipment
    {
      id: "equipment",
      label: "Assigner équipement",
      icon: Package,
      variant: "default",
      hidden: isTerminal || !!order?.equipment_id,
      handler: async () => {
        proc.setActiveStep("equipment");
      },
    },
    // Send contract
    {
      id: "send_contract",
      label: "Envoyer contrat",
      icon: FileText,
      variant: "default",
      hidden: !hasContract,
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
    // Activate service - prominent when paid but not activated
    {
      id: "activate",
      label: "Activer service",
      icon: Wifi,
      variant: "success",
      hidden: isTerminal || order?.status === "activated",
      disabled: !isPaid,
      disabledReason: "Le paiement doit être confirmé avant l'activation",
      handler: async () => {
        await proc.activateService();
      },
    },
    // Complete order
    {
      id: "complete",
      label: "Compléter commande",
      icon: CheckCircle2,
      variant: "success",
      hidden: isTerminal || order?.status !== "activated",
      handler: async () => {
        await proc.completeOrder();
      },
    },
    // Send notification
    {
      id: "notify",
      label: "Notifier client",
      icon: Send,
      variant: "primary",
      handler: async () => {
        if (!order?.client_email) {
          toast.error("Aucun courriel client disponible");
          return;
        }
        await proc.sendClientNotification(
          "order_update",
          "Mise à jour de votre commande — Nivra"
        );
      },
    },
    // Create ticket
    {
      id: "ticket",
      label: "Créer ticket",
      icon: Headphones,
      variant: "default",
      handler: async () => {
        const user = (await supabase.auth.getUser()).data.user;
        if (!order?.user_id) {
          toast.error("Impossible de créer un ticket : aucun client lié à cette commande");
          return;
        }
        const { error } = await supabase.from("support_tickets").insert({
          user_id: order.user_id,
          owner_user_id: order.user_id,
          subject: `Support — Commande ${order?.order_number || order?.id?.slice(0, 8)}`,
          description: `Ticket créé depuis la console de traitement pour la commande ${order?.order_number || order?.id || ""}`,
          category: "order_issue",
          priority: "medium",
          status: "open",
          related_order_id: order?.id || null,
          related_order_reference: order?.order_number || null,
          client_email: order?.client_email || null,
          created_by_user_id: user?.id || null,
          created_by_role: "admin",
        });
        if (error) throw error;
        toast.success("Ticket de support créé");
      },
    },
    // Suspend - destructive, needs confirmation
    {
      id: "suspend",
      label: "Suspendre",
      icon: Ban,
      variant: "danger",
      hidden: isTerminal || order?.status === "suspended",
      handler: async () => {
        await proc.changeStatus("suspended", "Suspension manuelle via console");
      },
    },
    // Reopen - show for suspended
    {
      id: "reopen",
      label: "Réouvrir",
      icon: RotateCcw,
      variant: "warning",
      hidden: order?.status !== "suspended" && order?.status !== "on_hold",
      handler: async () => {
        await proc.changeStatus("processing", "Réouverture manuelle via console");
      },
    },
    // Equipment refund - only for first-month-free promo orders within 30 days
    {
      id: "refund_equipment",
      label: order?.equipment_refunded ? "Équipement remboursé ✓" : "Rembourser équipement",
      icon: RotateCw,
      variant: "warning",
      hidden: !isFirstMonthFreeOrder,
      disabled: !canRefundEquipment || !equipReturnConfirmed,
      disabledReason: order?.equipment_refunded
        ? "Équipement déjà remboursé"
        : orderAge > 30
        ? "Délai de 30 jours dépassé"
        : !equipReturnConfirmed
        ? "Confirmez le retour de l'équipement d'abord"
        : undefined,
      handler: async () => {
        const user = (await supabase.auth.getUser()).data.user;
        // Calculate equipment total from pricing_snapshot
        const pricingSnapshot = order?.pricing_snapshot as Record<string, any> | null;
        const equipmentTotal = Number(pricingSnapshot?.one_time_subtotal ?? 0);

        // Mark order as equipment refunded
        const { error: updateError } = await supabase
          .from("orders")
          .update({
            equipment_refunded: true,
            equipment_refund_date: new Date().toISOString(),
          })
          .eq("id", order.id);
        if (updateError) throw updateError;

        // Add activity log
        await supabase.from("activity_logs").insert({
          user_id: user?.id || order.user_id,
          entity_type: "order",
          entity_id: order.id,
          action: "equipment_refund",
          reason: `Remboursement équipement approuvé par ${user?.email || "admin"} — Montant: ${equipmentTotal.toFixed(2)} $ — Code promo: ${orderPromoCode}`,
        });

        toast.success(`Remboursement équipement enregistré (${equipmentTotal.toFixed(2)} $)`);
        proc.refetch();
      },
    },
  ];

  const visibleActions = actions.filter(a => !a.hidden);

  const handleAction = async (action: QuickAction) => {
    if (action.disabled) {
      toast.info(action.disabledReason || "Action non disponible");
      return;
    }
    // Destructive actions need confirmation
    if (action.variant === "danger" && confirmAction !== action.id) {
      setConfirmAction(action.id);
      setTimeout(() => setConfirmAction(null), 3000);
      return;
    }
    setConfirmAction(null);
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
    primary: "border-blue-500/25 bg-blue-500/8 text-blue-400 hover:bg-blue-500/15 hover:border-blue-500/40",
  };

  return (
    <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] px-4 py-2.5">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[9px] uppercase tracking-widest text-[hsl(220,10%,35%)] font-semibold mr-1">
          Actions
        </span>
        {visibleActions.map((action) => {
          const Icon = action.icon;
          const isLoading = loading === action.id;
          const isConfirming = confirmAction === action.id;
          return (
            <button
              key={action.id}
              onClick={() => handleAction(action)}
              disabled={isLoading}
              className={`
                inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5
                text-[10px] font-medium transition-all
                ${action.disabled ? "opacity-40 cursor-not-allowed" : variantClasses[action.variant]}
                ${isLoading ? "opacity-60" : ""}
                ${isConfirming ? "ring-1 ring-red-500 animate-pulse" : ""}
              `}
            >
              {isLoading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : isConfirming ? (
                <AlertTriangle className="h-3 w-3" />
              ) : (
                <Icon className="h-3 w-3" />
              )}
              {isConfirming ? "Confirmer?" : action.label}
            </button>
          );
        })}
      </div>

      <EditOrderDialog
        order={order}
        open={editOrderOpen}
        onClose={() => setEditOrderOpen(false)}
        onRefresh={() => proc.refetch()}
      />
    </div>
  );
}
