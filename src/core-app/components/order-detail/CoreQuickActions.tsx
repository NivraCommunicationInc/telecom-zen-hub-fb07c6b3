/**
 * CoreQuickActions — Contextual operational quick-action bar.
 * Renders in two layouts:
 *   - "bar"     (default) horizontal toolbar (legacy)
 *   - "sidebar" stacked vertical list (used inside the dark order console)
 *
 * Logic, mutations, and behavior are unchanged. Only the visual layer is
 * updated to match the dark reference design.
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
  /** Visual layout. Defaults to "bar" for backward compatibility. */
  layout?: "bar" | "sidebar";
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

export function CoreQuickActions({ proc, layout = "bar" }: Props) {
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
    { id: "edit_order", label: "Modifier commande", icon: Pencil, variant: "primary",
      hidden: isTerminal, handler: async () => { setEditOrderOpen(true); } },
    { id: "confirm_payment", label: "Confirmer paiement", icon: CreditCard, variant: "success",
      hidden: isPaid || isTerminal, handler: async () => { await proc.confirmPayment(); } },
    { id: "assign_tech", label: hasTechnician ? "Technicien assigné ✓" : "Assigner technicien",
      icon: Wrench, variant: "default", disabled: hasTechnician,
      disabledReason: "Technicien déjà assigné", hidden: isTerminal,
      handler: async () => { proc.setActiveStep("shipping"); } },
    { id: "schedule", label: hasAppointment ? "RDV planifié ✓" : "Planifier installation",
      icon: Calendar, variant: "default", disabled: hasAppointment,
      disabledReason: "Rendez-vous déjà planifié", hidden: isTerminal,
      handler: async () => { proc.setActiveStep("fulfillment"); } },
    { id: "equipment", label: "Assigner équipement", icon: Package, variant: "default",
      hidden: isTerminal || !!order?.equipment_id,
      handler: async () => { proc.setActiveStep("equipment"); } },
    { id: "send_contract", label: "Envoyer contrat", icon: FileText, variant: "default",
      hidden: !hasContract,
      handler: async () => {
        if (!order?.client_email) { toast.error("Aucun courriel client disponible"); return; }
        await proc.sendClientNotification("contract_ready", "Votre contrat est prêt — Nivra");
      } },
    { id: "activate", label: "Activer service", icon: Wifi, variant: "success",
      hidden: isTerminal || order?.status === "activated", disabled: !isPaid,
      disabledReason: "Le paiement doit être confirmé avant l'activation",
      handler: async () => { await proc.activateService(); } },
    { id: "complete", label: "Compléter commande", icon: CheckCircle2, variant: "success",
      hidden: isTerminal || order?.status !== "activated",
      handler: async () => { await proc.completeOrder(); } },
    // "Notifier client" button retired 2026-07-04 — emitted a content-free
    // "Mise à jour Nivra" email that triggered support calls. Use a targeted
    // template (order_status_update, invoice_sent, etc.) via the processing
    // console instead.

    { id: "ticket", label: "Créer ticket", icon: Headphones, variant: "default",
      handler: async () => {
        const user = (await supabase.auth.getUser()).data.user;
        if (!order?.user_id) {
          toast.error("Impossible de créer un ticket : aucun client lié à cette commande"); return;
        }
        const { error } = await supabase.from("support_tickets").insert({
          user_id: order.user_id, owner_user_id: order.user_id,
          subject: `Support — Commande ${order?.order_number || order?.id?.slice(0, 8)}`,
          description: `Ticket créé depuis la console de traitement pour la commande ${order?.order_number || order?.id || ""}`,
          category: "order_issue", priority: "medium", status: "open",
          related_order_id: order?.id || null,
          related_order_reference: order?.order_number || null,
          client_email: order?.client_email || null,
          created_by_user_id: user?.id || null, created_by_role: "admin",
        });
        if (error) throw error;
        toast.success("Ticket de support créé");
      } },
    { id: "suspend", label: "Suspendre", icon: Ban, variant: "danger",
      hidden: isTerminal || order?.status === "suspended",
      handler: async () => { await proc.changeStatus("suspended", "Suspension manuelle via console"); } },
    { id: "reopen", label: "Réouvrir", icon: RotateCcw, variant: "warning",
      hidden: order?.status !== "suspended" && order?.status !== "on_hold",
      handler: async () => { await proc.changeStatus("processing", "Réouverture manuelle via console"); } },
    { id: "refund_equipment",
      label: order?.equipment_refunded ? "Équipement remboursé ✓" : "Rembourser équipement",
      icon: RotateCw, variant: "warning",
      hidden: !isFirstMonthFreeOrder,
      disabled: !canRefundEquipment || !equipReturnConfirmed,
      disabledReason: order?.equipment_refunded
        ? "Équipement déjà remboursé"
        : orderAge > 30 ? "Délai de 30 jours dépassé"
        : !equipReturnConfirmed ? "Confirmez le retour de l'équipement d'abord"
        : undefined,
      handler: async () => {
        const user = (await supabase.auth.getUser()).data.user;
        const pricingSnapshot = order?.pricing_snapshot as Record<string, any> | null;
        const equipmentTotal = Number(pricingSnapshot?.one_time_subtotal ?? 0);

        const { error: updateError } = await supabase.from("orders")
          .update({ equipment_refunded: true, equipment_refund_date: new Date().toISOString() })
          .eq("id", order.id);
        if (updateError) throw updateError;

        await supabase.from("activity_logs").insert({
          user_id: user?.id || order.user_id,
          entity_type: "order", entity_id: order.id, action: "equipment_refund",
          reason: `Remboursement équipement approuvé par ${user?.email || "admin"} — Montant: ${equipmentTotal.toFixed(2)} $ — Code promo: ${orderPromoCode}`,
        });

        toast.success(`Remboursement équipement enregistré (${equipmentTotal.toFixed(2)} $)`);
        proc.refetch();
      } },
  ];

  const visibleActions = actions.filter(a => !a.hidden);

  const handleAction = async (action: QuickAction) => {
    if (action.disabled) {
      toast.info(action.disabledReason || "Action non disponible"); return;
    }
    if (action.variant === "danger" && confirmAction !== action.id) {
      setConfirmAction(action.id);
      setTimeout(() => setConfirmAction(null), 3000);
      return;
    }
    setConfirmAction(null);
    setLoading(action.id);
    try { await action.handler(); }
    catch (err: any) { toast.error(err?.message || "Erreur lors de l'action"); }
    finally { setLoading(null); }
  };

  // ── Sidebar layout ─────────────────────────────────────
  if (layout === "sidebar") {
    const variantClasses: Record<string, { dot: string; text: string }> = {
      default: { dot: "border-[#2a3142] text-[#7c8ba1]", text: "text-[#9eb0c5] hover:text-white" },
      success: { dot: "bg-[#1b4a1b] border-[#2e7d32] text-[#81c784]", text: "text-[#81c784] hover:text-white" },
      danger:  { dot: "bg-[#5a0a0a] border-[#ef5350] text-[#ef9a9a]", text: "text-[#ef9a9a] hover:text-white" },
      warning: { dot: "bg-[#5a3500] border-[#f59e0b] text-[#ffd54f]", text: "text-[#ffd54f] hover:text-white" },
      primary: { dot: "bg-[#0d2d54] border-[#1976d2] text-[#64b5f6]", text: "text-[#64b5f6] hover:text-white" },
    };

    return (
      <>
        <div className="space-y-0.5">
          {visibleActions.map((action) => {
            const Icon = action.icon;
            const isLoading = loading === action.id;
            const isConfirming = confirmAction === action.id;
            const v = variantClasses[action.variant];
            return (
              <button
                key={action.id}
                onClick={() => handleAction(action)}
                disabled={isLoading}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-[12px] transition-colors hover:bg-[#0a0e16] ${v.text} ${
                  action.disabled ? "opacity-40 cursor-not-allowed" : ""
                } ${isConfirming ? "ring-1 ring-[#ef5350] animate-pulse" : ""}`}
                title={action.disabled ? action.disabledReason : action.label}
              >
                <span className={`w-4 h-4 rounded-full border-[1.5px] flex items-center justify-center text-[9px] shrink-0 ${v.dot}`}>
                  {isLoading ? <Loader2 className="h-2.5 w-2.5 animate-spin" />
                   : isConfirming ? "?" : <Icon className="h-2.5 w-2.5" />}
                </span>
                <span className="truncate">{isConfirming ? "Confirmer ?" : action.label}</span>
              </button>
            );
          })}
        </div>

        {canRefundEquipment && (
          <div className="flex items-start gap-2 mt-2 px-2 py-1.5 border-t border-[#1e2535]">
            <input
              type="checkbox"
              id="equip-return-confirm"
              checked={equipReturnConfirmed}
              onChange={(e) => setEquipReturnConfirmed(e.target.checked)}
              className="mt-0.5 rounded border-[#2a3142] bg-[#0a0e16]"
            />
            <label htmlFor="equip-return-confirm" className="text-[10px] text-[#ffd54f] cursor-pointer leading-tight">
              Confirmer le retour de l'équipement
            </label>
          </div>
        )}

        <EditOrderDialog
          order={order}
          open={editOrderOpen}
          onClose={() => setEditOrderOpen(false)}
          onRefresh={() => proc.refetch()}
        />
      </>
    );
  }

  // ── Bar layout (legacy) ────────────────────────────────
  const barVariantClasses: Record<string, string> = {
    default: "border-[#1e2535] bg-[#131929] text-[#8b9ab0] hover:text-white hover:border-[#3a4456]",
    success: "border-[#2e7d32]/40 bg-[#1b4a1b]/30 text-[#81c784] hover:bg-[#1b4a1b]/50",
    danger:  "border-[#c62828]/40 bg-[#7f0000]/30 text-[#ef9a9a] hover:bg-[#7f0000]/50",
    warning: "border-[#f59e0b]/40 bg-[#5a3500]/30 text-[#ffd54f] hover:bg-[#5a3500]/50",
    primary: "border-[#1976d2]/40 bg-[#0d2d54]/40 text-[#64b5f6] hover:bg-[#0d2d54]/70",
  };

  return (
    <div className="rounded-lg border border-[#1e2535] bg-[#0f1623] px-4 py-2.5">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] uppercase tracking-[0.07em] text-[#6b7a90] font-semibold mr-1">
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
              className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] font-medium transition-all ${
                action.disabled ? "opacity-40 cursor-not-allowed" : barVariantClasses[action.variant]
              } ${isLoading ? "opacity-60" : ""} ${isConfirming ? "ring-1 ring-[#ef5350] animate-pulse" : ""}`}
            >
              {isLoading ? <Loader2 className="h-3 w-3 animate-spin" />
               : isConfirming ? <AlertTriangle className="h-3 w-3" />
               : <Icon className="h-3 w-3" />}
              {isConfirming ? "Confirmer ?" : action.label}
            </button>
          );
        })}
      </div>

      {canRefundEquipment && (
        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-[#1e2535]">
          <input
            type="checkbox"
            id="equip-return-confirm-bar"
            checked={equipReturnConfirmed}
            onChange={(e) => setEquipReturnConfirmed(e.target.checked)}
            className="rounded border-[#2a3142] bg-[#0a0e16]"
          />
          <label htmlFor="equip-return-confirm-bar" className="text-[11px] text-[#ffd54f] cursor-pointer">
            Équipement retourné confirmé — J'ai vérifié que l'équipement a été reçu en bon état
          </label>
        </div>
      )}

      <EditOrderDialog
        order={order}
        open={editOrderOpen}
        onClose={() => setEditOrderOpen(false)}
        onRefresh={() => proc.refetch()}
      />
    </div>
  );
}
