/**
 * Payment detail drawer — full payment file with identity, links, timeline, actions
 */
import { Link } from "react-router-dom";
import { corePath } from "@/core-app/lib/corePaths";
import { StatusBadge, statusToVariant } from "@/core-app/components/ui/StatusBadge";
import { PAYMENT_STATUSES, PAYMENT_METHODS, fmtCAD } from "./PaymentConstants";
import type { AdminPayment } from "@/core-app/hooks/useAdminPayments";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  X, User, FileText, ShoppingCart, CreditCard, Clock, Hash,
  MessageSquare, CheckCircle2, XCircle, AlertTriangle, RotateCcw,
  ShieldCheck, ExternalLink, Copy,
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

export function PaymentDetailDrawer({ payment, onClose }: Props) {
  if (!payment) return null;

  const p = payment;
  const statusLabel = PAYMENT_STATUSES[p.status as keyof typeof PAYMENT_STATUSES] || p.status || "—";
  const methodLabel = PAYMENT_METHODS[p.method as keyof typeof PAYMENT_METHODS] || p.method;
  const isPending = p.status === "pending";
  const isInVerification = p.status === "in_verification" || p.status === "manual_review";
  const isConfirmed = p.status === "confirmed" || p.status === "completed";
  const isFailed = p.status === "failed" || p.status === "declined";
  const isFraud = p.status === "fraud";

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
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
              <Field label="ID fournisseur" value={p.provider_payment_id || "—"} mono copyable />
              <Field label="Référence" value={p.reference || "—"} mono copyable />
              <Field label="Source" value={p.source || "—"} />
              <Field label="Reçu le" value={fmtDate(p.received_at)} />
              <Field label="Créé le" value={fmtDate(p.created_at)} />
              <Field label="Confirmé par" value={p.confirmed_by || p.created_by_name || "—"} />
            </div>
          </div>

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

          {/* ═══ Quick Actions ═══ */}
          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-2">Actions rapides</h3>
            <div className="grid grid-cols-2 gap-2">
              {isPending && (
                <>
                  <ActionBtn icon={ShieldCheck} label="En vérification" color="violet" />
                  <ActionBtn icon={CheckCircle2} label="Confirmer" color="emerald" />
                  <ActionBtn icon={XCircle} label="Refuser" color="red" />
                </>
              )}
              {isInVerification && (
                <>
                  <ActionBtn icon={CheckCircle2} label="Confirmer" color="emerald" />
                  <ActionBtn icon={XCircle} label="Refuser" color="red" />
                  <ActionBtn icon={AlertTriangle} label="Signaler fraude" color="orange" />
                </>
              )}
              {isConfirmed && (
                <>
                  <ActionBtn icon={RotateCcw} label="Rembourser" color="sky" />
                </>
              )}
              {isFailed && (
                <>
                  <ActionBtn icon={RotateCcw} label="Réessayer" color="amber" />
                </>
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

function ActionBtn({ icon: Icon, label, color }: { icon: any; label: string; color: string }) {
  const colorMap: Record<string, string> = {
    emerald: "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10",
    red: "border-red-500/30 text-red-400 hover:bg-red-500/10",
    amber: "border-amber-500/30 text-amber-400 hover:bg-amber-500/10",
    orange: "border-orange-500/30 text-orange-400 hover:bg-orange-500/10",
    sky: "border-sky-500/30 text-sky-400 hover:bg-sky-500/10",
    violet: "border-violet-500/30 text-violet-400 hover:bg-violet-500/10",
  };

  return (
    <button className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors w-full ${colorMap[color] || colorMap.sky}`}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
