/**
 * Subscription detail drawer — service lifecycle file
 * ALL action buttons wired to real DB operations.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { corePath } from "@/core-app/lib/corePaths";
import { StatusBadge, statusToVariant } from "@/core-app/components/ui/StatusBadge";
import { SUB_STATUSES, SUB_CATEGORIES, fmtCAD } from "./SubscriptionConstants";
import type { AdminSubscription } from "@/core-app/hooks/useAdminSubscriptions";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  X, User, Repeat, Calendar, ShoppingCart, FileText,
  CheckCircle2, PauseCircle, PlayCircle, XCircle,
  Package, Wrench, MessageSquare, ExternalLink, Copy, Zap, Loader2, MapPin,
} from "lucide-react";
import { toast } from "sonner";

import { logActivityLog } from "@/lib/logActivityLog";
interface Props {
  subscription: AdminSubscription | null;
  onClose: () => void;
}

const fmtDate = (d: string | null) => {
  if (!d) return "—";
  try { return format(new Date(d), "d MMM yyyy", { locale: fr }); } catch { return "—"; }
};

function Field({ label, value, mono, link, copyable }: {
  label: string; value: string; mono?: boolean; link?: string; copyable?: boolean;
}) {
  return (
    <div className="flex items-start justify-between py-1.5 border-b border-[hsl(220,15%,14%)]">
      <span className="text-[11px] text-[#94A3B8] shrink-0">{label}</span>
      <div className="flex items-center gap-1.5 text-right">
        {link ? (
          <Link to={link} className={`text-[12px] text-[#38BDF8] hover:underline ${mono ? "font-mono" : ""}`}>
            {value} <ExternalLink className="inline h-2.5 w-2.5" />
          </Link>
        ) : (
          <span className={`text-[12px] text-[#F8FAFC] ${mono ? "font-mono" : ""}`}>{value}</span>
        )}
        {copyable && value && value !== "—" && (
          <button onClick={() => { navigator.clipboard.writeText(value); toast.success("Copié"); }} className="text-[#64748B] hover:text-[#F8FAFC] transition-colors">
            <Copy className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}

export function SubscriptionDetailDrawer({ subscription, onClose }: Props) {
  const queryClient = useQueryClient();
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  if (!subscription) return null;
  const s = subscription;
  const statusLabel = SUB_STATUSES[s.status ?? ""] || s.status || "—";
  const catLabel = SUB_CATEGORIES[s.service_category ?? ""] || s.service_category || "—";
  const isActive = s.status === "active";
  const isPending = s.status === "pending";
  const isSuspended = s.status === "suspended";
  const isCancelled = s.status === "cancelled" || s.status === "expired";

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-subscriptions"] });
  };

  const updateSubStatus = async (newStatus: string, actionKey: string) => {
    setActionLoading(actionKey);
    try {
      // Phase 6A — canonical state-machine gateway
      let rpcRes;
      if (newStatus === "suspended") {
        rpcRes = await supabase.rpc("suspend_subscription", {
          p_subscription_id: s.id, p_reason: "subscription_drawer",
          p_pause_until: null, p_context: { source: "subscription_drawer" },
        });
      } else if (newStatus === "cancelled") {
        rpcRes = await supabase.rpc("cancel_subscription", {
          p_subscription_id: s.id, p_reason: "subscription_drawer",
          p_context: { source: "subscription_drawer" },
        });
      } else if (newStatus === "active") {
        rpcRes = await supabase.rpc("reactivate_subscription", {
          p_subscription_id: s.id, p_context: { source: "subscription_drawer" },
        });
      } else {
        throw new Error(`Unsupported status transition: ${newStatus}`);
      }
      const { error } = rpcRes;


      const labels: Record<string, string> = {
        active: "activé", suspended: "suspendu", cancelled: "annulé",
      };
      toast.success(`Service ${labels[newStatus] || newStatus}`);
      refreshAll();
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setActionLoading(null);
    }
  };

  const handleActivate = () => updateSubStatus("active", "activate");
  const handleSuspend = () => updateSubStatus("suspended", "suspend");
  const handleResume = () => updateSubStatus("active", "resume");
  const handleCancel = () => updateSubStatus("cancelled", "cancel");

  const handleAssignEquipment = () => {
    if (s.customer_id) {
      onClose();
      // Navigate via window since we don't have navigate in scope
      window.location.href = `/core/accounts/${s.customer_id}?section=equipment`;
    } else {
      toast.error("Aucun compte client lié");
    }
  };

  const handleScheduleTech = () => {
    if (s.customer_id) {
      onClose();
      window.location.href = `/core/accounts/${s.customer_id}?section=appointments`;
    } else {
      toast.error("Aucun compte client lié");
    }
  };

  const handleAddNote = async () => {
    const note = prompt("Note interne:");
    if (!note?.trim()) return;
    setActionLoading("note");
    try {
      const user = (await supabase.auth.getUser()).data.user;
      await logActivityLog({
        user_id: user?.id || "system",
        entity_type: "subscription",
        entity_id: s.id,
        action: "internal_note",
        reason: note.trim(),
        details: { plan: s.plan_name, source: "subscription_drawer" },
      });
toast.success("Note ajoutée");
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-[480px] bg-[hsl(220,20%,9%)] border-l border-[hsl(220,15%,16%)] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-[hsl(220,15%,16%)] bg-[hsl(220,20%,9%)]/95 backdrop-blur">
          <div>
            <div className="flex items-center gap-2">
              <Repeat className="h-4 w-4 text-emerald-400" />
              <h2 className="text-sm font-bold text-[#F8FAFC]">Dossier Service</h2>
            </div>
            <p className="text-[11px] text-[#94A3B8] mt-0.5">{s.plan_name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[hsl(220,15%,14%)] transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Status + Price hero */}
          <div className="flex items-center justify-between p-4 rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)]">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[#94A3B8] mb-1">Prix mensuel</p>
              <p className="text-2xl font-bold tabular-nums text-emerald-400">{fmtCAD(s.plan_price)}</p>
              <p className="text-[11px] text-[#94A3B8] mt-0.5">{catLabel}</p>
            </div>
            <div className="text-right space-y-1.5">
              <StatusBadge label={statusLabel} variant={statusToVariant(s.status ?? "")} size="md" />
              {s.auto_billing_enabled && (
                <p className="inline-flex items-center gap-1 text-[11px] text-emerald-400">
                  <Zap className="h-3 w-3" /> Auto-billing
                </p>
              )}
            </div>
          </div>

          {/* ═══ Service Plan ═══ */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Repeat className="h-3.5 w-3.5 text-[#94A3B8]" />
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">Plan de service</h3>
            </div>
            <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] px-4 py-2">
              <Field label="Nom du plan" value={s.plan_name} />
              <Field label="Code" value={s.plan_code} mono copyable />
              <Field label="Catégorie" value={catLabel} />
              <Field label="Prix mensuel" value={fmtCAD(s.plan_price)} />
              <Field label="Auto-billing" value={s.auto_billing_enabled ? "Activé" : "Désactivé"} />
            </div>
          </div>

          {/* ═══ Client Identity ═══ */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <User className="h-3.5 w-3.5 text-[#94A3B8]" />
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">Identité client</h3>
            </div>
            <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] px-4 py-2">
              <Field label="Nom" value={s.client_name || "—"} />
              <Field label="Email" value={s.client_email || "—"} copyable />
              <Field label="Compte" value={s.account_number || "—"} mono copyable />
            </div>
          </div>

          {/* ═══ Cycle de facturation ═══ */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Calendar className="h-3.5 w-3.5 text-[#94A3B8]" />
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">Cycle de facturation</h3>
            </div>
            <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] px-4 py-2">
              <Field label="Fréquence" value="Mensuel (30 jours)" />
              {s.billing_cycle_day && (
                <Field label="Jour de facturation" value={`Le ${s.billing_cycle_day} de chaque mois`} />
              )}
              <Field label="Prochaine facture" value={fmtDate(s.next_invoice_date || s.cycle_end_date)} />
              <Field label="Début de cycle actuel" value={fmtDate(s.cycle_start_date)} />
              <Field label="Fin de cycle actuel" value={fmtDate(s.cycle_end_date)} />
              <Field label="Créé le" value={fmtDate(s.created_at)} />
            </div>
          </div>

          {/* ═══ Adresse de service ═══ */}
          {s.service_address && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <MapPin className="h-3.5 w-3.5 text-[#94A3B8]" />
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">Adresse de service</h3>
              </div>
              <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] px-4 py-2">
                {s.service_address.address_line && (
                  <Field label="Adresse" value={s.service_address.address_line} />
                )}
                {s.service_address.city && (
                  <Field label="Ville" value={s.service_address.city} />
                )}
                {s.service_address.province && (
                  <Field label="Province" value={s.service_address.province} />
                )}
                {s.service_address.postal_code && (
                  <Field label="Code postal" value={s.service_address.postal_code} mono copyable />
                )}
              </div>
            </div>
          )}

          {/* ═══ Linked Documents ═══ */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <FileText className="h-3.5 w-3.5 text-[#94A3B8]" />
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">Documents liés</h3>
            </div>
            <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] px-4 py-2">
              <Field
                label="Commande"
                value={s.order_id ? "Voir commande" : "—"}
                link={s.order_id ? corePath(`/orders/${s.order_id}`) : undefined}
              />
              <Field
                label="Détails complets"
                value="Ouvrir fiche"
                link={corePath(`/subscriptions/${s.id}`)}
              />
            </div>
          </div>

          {/* ═══ Quick Actions ═══ */}
          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-2">Actions rapides</h3>
            <div className="grid grid-cols-2 gap-2">
              {/* Full detail page */}
              <Link to={corePath(`/subscriptions/${s.id}`)} className="col-span-2">
                <ActionBtn icon={Repeat} label="Ouvrir dossier complet" color="emerald" />
              </Link>

              {isPending && (
                <ActionBtn icon={CheckCircle2} label="Activer service" color="emerald" onClick={handleActivate} loading={actionLoading === "activate"} />
              )}
              {isActive && (
                <>
                  <ActionBtn icon={PauseCircle} label="Suspendre service" color="orange" onClick={handleSuspend} loading={actionLoading === "suspend"} />
                  <ActionBtn icon={XCircle} label="Annuler service" color="red" onClick={handleCancel} loading={actionLoading === "cancel"} />
                </>
              )}
              {isSuspended && (
                <>
                  <ActionBtn icon={PlayCircle} label="Réactiver service" color="emerald" onClick={handleResume} loading={actionLoading === "resume"} />
                  <ActionBtn icon={XCircle} label="Annuler service" color="red" onClick={handleCancel} loading={actionLoading === "cancel"} />
                </>
              )}

              <ActionBtn icon={Package} label="Assigner équipement" color="sky" onClick={handleAssignEquipment} />
              <ActionBtn icon={Wrench} label="Planifier technicien" color="sky" onClick={handleScheduleTech} />

              {s.order_id && (
                <Link to={corePath(`/orders/${s.order_id}`)}>
                  <ActionBtn icon={ShoppingCart} label="Voir commande" color="sky" />
                </Link>
              )}
              <ActionBtn icon={MessageSquare} label="Note interne" color="violet" onClick={handleAddNote} loading={actionLoading === "note"} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ActionBtn({ icon: Icon, label, color, onClick, loading }: { icon: any; label: string; color: string; onClick?: () => void; loading?: boolean }) {
  const colorMap: Record<string, string> = {
    emerald: "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10",
    red: "border-red-500/30 text-red-400 hover:bg-red-500/10",
    orange: "border-orange-500/30 text-orange-400 hover:bg-orange-500/10",
    sky: "border-sky-500/30 text-sky-400 hover:bg-sky-500/10",
    violet: "border-violet-500/30 text-violet-400 hover:bg-violet-500/10",
  };
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors w-full disabled:opacity-50 ${colorMap[color] || colorMap.sky}`}
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
      {label}
    </button>
  );
}
