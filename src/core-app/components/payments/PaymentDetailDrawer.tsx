/**
 * Payment detail drawer — full payment file with identity, links, timeline, actions.
 * ★ Now includes Stripe authorization controls (capture, cancel, refund).
 */
import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { corePath } from "@/core-app/lib/corePaths";
import { StatusBadge, statusToVariant } from "@/core-app/components/ui/StatusBadge";
import { PAYMENT_STATUSES, PAYMENT_METHODS, fmtCAD } from "./PaymentConstants";
import type { AdminPayment } from "@/core-app/hooks/useAdminPayments";
import { supabase } from "@/integrations/supabase/client";
import { useStripeAdminActions } from "@/core-app/hooks/useStripeAdminActions";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  X, User, FileText, ShoppingCart, CreditCard, Clock, Hash,
  MessageSquare, CheckCircle2, XCircle, AlertTriangle, RotateCcw,
  ShieldCheck, ExternalLink, Copy, Loader2, Zap, Ban, DollarSign,
} from "lucide-react";
import { toast } from "sonner";

interface Props {
  payment: AdminPayment | null;
  onClose: () => void;
}

const fmtDate = (d: string | null) => {
  if (!d) return "—";
  try { return format(new Date(d), "d MMM yyyy à HH:mm", { locale: fr }); } catch { return "—"; }
};

function Field({ label, value, mono, link, copyable }: {
  label: string; value: string; mono?: boolean; link?: string; copyable?: boolean;
}) {
  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    toast.success("Copié");
  };

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
          <button onClick={handleCopy} className="text-[#64748B] hover:text-[#F8FAFC] transition-colors">
            <Copy className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}

// ═══ AUTHORIZATION STATUS LABELS ═══
const AUTH_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  authorized: { label: "Autorisé (non capturé)", color: "text-amber-400 border-amber-500/30 bg-amber-500/10" },
  captured: { label: "Capturé", color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" },
  cancelled: { label: "Autorisation annulée", color: "text-red-400 border-red-500/30 bg-red-500/10" },
  expired: { label: "Autorisation expirée", color: "text-orange-400 border-orange-500/30 bg-orange-500/10" },
  none: { label: "—", color: "" },
};

export function PaymentDetailDrawer({ payment, onClose }: Props) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [stripeDetails, setStripeDetails] = useState<Record<string, any> | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [showCancelInput, setShowCancelInput] = useState(false);

  const {
    loading: stripeLoading,
    capturePayment,
    cancelAuthorization,
    refundPayment,
    getPaymentIntentStatus,
  } = useStripeAdminActions();

  if (!payment) return null;

  const p = payment;
  const statusLabel = PAYMENT_STATUSES[p.status as keyof typeof PAYMENT_STATUSES] || p.status || "—";
  const methodLabel = PAYMENT_METHODS[p.method as keyof typeof PAYMENT_METHODS] || p.method;
  const isPending = p.status === "pending";
  const isInVerification = p.status === "in_verification" || p.status === "manual_review";
  const isConfirmed = p.status === "confirmed" || p.status === "completed";
  const isFailed = p.status === "failed" || p.status === "declined";
  const isFraud = p.status === "fraud";

  // ★ Stripe authorization state
  const stripePI = (p as any).stripe_payment_intent_id || (p as any).provider_payment_id;
  const authStatus = (p as any).authorization_status || "none";
  const isAuthorized = authStatus === "authorized";
  const isCaptured = authStatus === "captured";
  const isStripePayment = p.provider === "stripe" || p.method === "card";
  const authStatusInfo = AUTH_STATUS_LABELS[authStatus] || AUTH_STATUS_LABELS.none;

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-payments-v2"] });
    queryClient.invalidateQueries({ queryKey: ["admin-invoices"] });
    queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
  };

  const updatePaymentStatus = async (newStatus: string, extra: Record<string, any> = {}) => {
    setActionLoading(newStatus);
    try {
      if (newStatus === "confirmed" || newStatus === "completed") {
        const { error: payErr } = await supabase.from("billing_payments")
          .update({ status: "confirmed" as any, confirmed_by: "admin", received_at: new Date().toISOString(), ...extra })
          .eq("id", p.id);
        if (payErr) throw payErr;

        const { data: inv, error: invFetchErr } = await supabase.from("billing_invoices")
          .select("amount_paid, balance_due, total, status, paid_at")
          .eq("id", p.invoice_id)
          .single();
        if (invFetchErr) throw invFetchErr;

        const newAmountPaid = (inv.amount_paid ?? 0) + p.amount;
        const newBalanceDue = Math.max(0, (inv.total ?? 0) - newAmountPaid);
        const isFullyPaid = newBalanceDue <= 0;

        const { error: invErr } = await supabase.from("billing_invoices")
          .update({
            amount_paid: newAmountPaid,
            balance_due: newBalanceDue,
            status: (isFullyPaid ? "paid" : "partially_paid") as any,
            paid_at: isFullyPaid ? new Date().toISOString() : inv.paid_at,
          })
          .eq("id", p.invoice_id);
        if (invErr) throw invErr;
      } else {
        const { error } = await supabase
          .from("billing_payments")
          .update({ status: newStatus as any, ...extra })
          .eq("id", p.id);
        if (error) throw error;

        if (newStatus === "failed" || newStatus === "declined" || newStatus === "fraud") {
          await supabase
            .from("billing_invoices")
            .update({ status: "unpaid" as any })
            .eq("id", p.invoice_id);
        }
      }

      refreshAll();
      toast.success(`Paiement mis à jour : ${PAYMENT_STATUSES[newStatus as keyof typeof PAYMENT_STATUSES] || newStatus}`);
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la mise à jour");
    } finally {
      setActionLoading(null);
    }
  };

  const handleVerification = () => updatePaymentStatus("in_verification");
  const handleConfirm = () => updatePaymentStatus("confirmed");
  const handleReject = () => {
    if (!showRejectInput) { setShowRejectInput(true); return; }
    updatePaymentStatus("failed", rejectReason ? { legacy_note: `${p.legacy_note ? p.legacy_note + "\n" : ""}[REFUSÉ] ${rejectReason}` } : {});
  };
  const handleFraud = () => updatePaymentStatus("fraud");
  const handleRefundLegacy = () => updatePaymentStatus("refunded");

  // ★ STRIPE ACTIONS
  const handleStripeCapture = async () => {
    if (!stripePI) return;
    setActionLoading("stripe_capture");
    await capturePayment(stripePI, {
      payment_id: p.id,
      invoice_id: p.invoice_id,
    });
    refreshAll();
    setActionLoading(null);
    onClose();
  };

  const handleStripeCancelAuth = async () => {
    if (!stripePI) return;
    if (!showCancelInput) { setShowCancelInput(true); return; }
    setActionLoading("stripe_cancel");
    await cancelAuthorization(stripePI, {
      payment_id: p.id,
      invoice_id: p.invoice_id,
      reason: cancelReason || undefined,
    });
    refreshAll();
    setActionLoading(null);
    onClose();
  };

  const handleStripeRefund = async () => {
    if (!stripePI) return;
    setActionLoading("stripe_refund");
    await refundPayment(stripePI, {
      payment_id: p.id,
      invoice_id: p.invoice_id,
    });
    refreshAll();
    setActionLoading(null);
    onClose();
  };

  const handleFetchStripeStatus = async () => {
    if (!stripePI) return;
    setActionLoading("stripe_status");
    const result = await getPaymentIntentStatus(stripePI);
    if (result.success && result.data) {
      setStripeDetails(result.data);
    }
    setActionLoading(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-[480px] bg-[hsl(220,20%,9%)] border-l border-[hsl(220,15%,16%)] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-[hsl(220,15%,16%)] bg-[hsl(220,20%,9%)]/95 backdrop-blur">
          <div>
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-emerald-400" />
              <h2 className="text-sm font-bold text-[#F8FAFC]">Dossier Paiement</h2>
            </div>
            <p className="text-[11px] font-mono text-[#94A3B8] mt-0.5">{p.payment_number}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[hsl(220,15%,14%)] transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Status + Amount hero */}
          <div className="flex items-center justify-between p-4 rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)]">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[#94A3B8] mb-1">Montant</p>
              <p className="text-2xl font-bold tabular-nums text-emerald-400">{fmtCAD(p.amount)}</p>
            </div>
            <StatusBadge label={statusLabel} variant={statusToVariant(p.status ?? "")} size="md" />
          </div>

          {/* ═══ STRIPE AUTHORIZATION STATUS ═══ */}
          {isStripePayment && authStatus !== "none" && (
            <div className={`flex items-center gap-2 p-3 rounded-lg border ${authStatusInfo.color}`}>
              {isAuthorized && <Zap className="h-4 w-4 shrink-0" />}
              {isCaptured && <CheckCircle2 className="h-4 w-4 shrink-0" />}
              {authStatus === "cancelled" && <Ban className="h-4 w-4 shrink-0" />}
              <div>
                <p className="text-xs font-semibold">{authStatusInfo.label}</p>
                {isAuthorized && (
                  <p className="text-[10px] opacity-80 mt-0.5">
                    Le montant de {fmtCAD((p as any).authorized_amount || p.amount)} est retenu sur la carte.
                    L'admin doit capturer ou annuler.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Fraud alert */}
          {isFraud && (
            <div className="flex items-center gap-2 p-3 rounded-lg border border-orange-500/30 bg-orange-500/10">
              <AlertTriangle className="h-4 w-4 text-orange-400 shrink-0" />
              <p className="text-xs text-orange-300">Ce paiement a été signalé comme frauduleux.</p>
            </div>
          )}

          {/* ═══ Client Identity ═══ */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <User className="h-3.5 w-3.5 text-[#94A3B8]" />
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">Identité client</h3>
            </div>
            <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] px-4 py-2">
              <Field label="Nom" value={p.customer_name || "—"} />
              <Field label="Email" value={p.customer_email || "—"} copyable />
              <Field label="Compte" value={p.account_number || "—"} mono copyable />
              <Field label="Client ID" value={p.customer_id} mono link={corePath(`/accounts/${p.customer_id}`)} />
            </div>
          </div>

          {/* ═══ Transaction Details ═══ */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Hash className="h-3.5 w-3.5 text-[#94A3B8]" />
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">Détails transaction</h3>
            </div>
            <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] px-4 py-2">
              <Field label="Méthode" value={methodLabel} />
              <Field label="Fournisseur" value={p.provider || "—"} />
              <Field label="Stripe PI" value={stripePI || "—"} mono copyable />
              <Field label="Référence" value={p.reference || "—"} mono copyable />
              <Field label="Source" value={p.source || "—"} />
              <Field label="Statut autorisation" value={authStatusInfo.label} />
              <Field label="Montant autorisé" value={(p as any).authorized_amount ? fmtCAD((p as any).authorized_amount) : "—"} />
              <Field label="Autorisé le" value={fmtDate((p as any).authorized_at)} />
              <Field label="Capturé le" value={fmtDate((p as any).captured_at)} />
              <Field label="Reçu le" value={fmtDate(p.received_at)} />
              <Field label="Créé le" value={fmtDate(p.created_at)} />
              <Field label="Confirmé par" value={(p as any).captured_by || p.confirmed_by || p.created_by_name || "—"} />
            </div>
          </div>

          {/* ═══ Stripe Live Details (fetched on demand) ═══ */}
          {stripeDetails && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <CreditCard className="h-3.5 w-3.5 text-[#94A3B8]" />
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">Stripe — Détails en direct</h3>
              </div>
              <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] px-4 py-2">
                <Field label="Statut PI" value={stripeDetails.status || "—"} />
                <Field label="Capturable" value={stripeDetails.amount_capturable ? fmtCAD(stripeDetails.amount_capturable) : "—"} />
                <Field label="Reçu" value={stripeDetails.amount_received ? fmtCAD(stripeDetails.amount_received) : "—"} />
                <Field label="Mode capture" value={stripeDetails.capture_method || "—"} />
                <Field label="Mode" value={stripeDetails.livemode ? "PRODUCTION" : "TEST"} />
                <Field label="Créé" value={fmtDate(stripeDetails.created)} />
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
                label="Facture"
                value={p.invoice_number || "—"}
                mono
                link={p.invoice_id ? corePath(`/invoices/${p.invoice_id}`) : undefined}
              />
            </div>
          </div>

          {/* ═══ Notes ═══ */}
          {p.legacy_note && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <MessageSquare className="h-3.5 w-3.5 text-[#94A3B8]" />
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">Notes internes</h3>
              </div>
              <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-4">
                <p className="text-xs text-[#CBD5E1] whitespace-pre-wrap">{p.legacy_note}</p>
              </div>
            </div>
          )}

          {/* ═══ Cancel reason input ═══ */}
          {showCancelInput && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
              <label className="text-[11px] text-amber-400 font-medium block mb-1.5">Raison de l'annulation (optionnel)</label>
              <textarea
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
                rows={2}
                className="w-full bg-[hsl(220,20%,11%)] border border-[hsl(220,15%,20%)] rounded-md text-xs text-[#F8FAFC] p-2 resize-none focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                placeholder="Entrez la raison de l'annulation..."
              />
            </div>
          )}

          {/* ═══ Reject reason input ═══ */}
          {showRejectInput && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3">
              <label className="text-[11px] text-red-400 font-medium block mb-1.5">Raison du refus (optionnel)</label>
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                rows={2}
                className="w-full bg-[hsl(220,20%,11%)] border border-[hsl(220,15%,20%)] rounded-md text-xs text-[#F8FAFC] p-2 resize-none focus:outline-none focus:ring-1 focus:ring-red-500/50"
                placeholder="Entrez la raison du refus..."
              />
            </div>
          )}

          {/* ═══ STRIPE AUTHORIZATION ACTIONS ═══ */}
          {isStripePayment && stripePI && (
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-2">
                Contrôles Stripe
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {/* Fetch live status */}
                <ActionBtn
                  icon={CreditCard}
                  label="Statut Stripe"
                  color="sky"
                  onClick={handleFetchStripeStatus}
                  loading={actionLoading === "stripe_status"}
                />

                {/* Capture authorized payment */}
                {isAuthorized && (
                  <ActionBtn
                    icon={Zap}
                    label="Capturer paiement"
                    color="emerald"
                    onClick={handleStripeCapture}
                    loading={actionLoading === "stripe_capture" || stripeLoading}
                  />
                )}

                {/* Cancel authorization */}
                {isAuthorized && (
                  <ActionBtn
                    icon={Ban}
                    label="Annuler autorisation"
                    color="amber"
                    onClick={handleStripeCancelAuth}
                    loading={actionLoading === "stripe_cancel" || stripeLoading}
                  />
                )}

                {/* Refund captured payment */}
                {(isCaptured || isConfirmed) && (
                  <ActionBtn
                    icon={RotateCcw}
                    label="Rembourser (Stripe)"
                    color="red"
                    onClick={handleStripeRefund}
                    loading={actionLoading === "stripe_refund" || stripeLoading}
                  />
                )}
              </div>
            </div>
          )}

          {/* ═══ Quick Actions (non-Stripe) ═══ */}
          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-2">Actions rapides</h3>
            <div className="grid grid-cols-2 gap-2">
              {isPending && !isAuthorized && (
                <>
                  <ActionBtn icon={ShieldCheck} label="En vérification" color="violet" onClick={handleVerification} loading={actionLoading === "in_verification"} />
                  <ActionBtn icon={CheckCircle2} label="Confirmer" color="emerald" onClick={handleConfirm} loading={actionLoading === "confirmed"} />
                  <ActionBtn icon={XCircle} label="Refuser" color="red" onClick={handleReject} loading={actionLoading === "failed"} />
                </>
              )}
              {isInVerification && (
                <>
                  <ActionBtn icon={CheckCircle2} label="Confirmer" color="emerald" onClick={handleConfirm} loading={actionLoading === "confirmed"} />
                  <ActionBtn icon={XCircle} label="Refuser" color="red" onClick={handleReject} loading={actionLoading === "failed"} />
                  <ActionBtn icon={AlertTriangle} label="Signaler fraude" color="orange" onClick={handleFraud} loading={actionLoading === "fraud"} />
                </>
              )}
              {isConfirmed && !isStripePayment && (
                <ActionBtn icon={RotateCcw} label="Rembourser" color="sky" onClick={handleRefundLegacy} loading={actionLoading === "refunded"} />
              )}
              {isFailed && (
                <ActionBtn icon={RotateCcw} label="Réessayer" color="amber" onClick={() => updatePaymentStatus("pending")} loading={actionLoading === "pending"} />
              )}

              {/* Always available */}
              {p.invoice_id && (
                <Link to={corePath(`/invoices/${p.invoice_id}`)} className="col-span-1">
                  <ActionBtn icon={FileText} label="Voir facture" color="sky" />
                </Link>
              )}
              <Link to={corePath(`/accounts/${p.customer_id}`)} className="col-span-1">
                <ActionBtn icon={User} label="Voir compte" color="sky" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ActionBtn({ icon: Icon, label, color, onClick, loading }: {
  icon: any; label: string; color: string; onClick?: () => void; loading?: boolean;
}) {
  const colorMap: Record<string, string> = {
    emerald: "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10",
    red: "border-red-500/30 text-red-400 hover:bg-red-500/10",
    amber: "border-amber-500/30 text-amber-400 hover:bg-amber-500/10",
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
