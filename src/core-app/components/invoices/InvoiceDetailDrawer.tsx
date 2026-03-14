/**
 * Invoice detail drawer — full invoice file with breakdown, links, actions
 * ALL action buttons are wired to real DB operations.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { corePath } from "@/core-app/lib/corePaths";
import { StatusBadge, statusToVariant } from "@/core-app/components/ui/StatusBadge";
import { INVOICE_STATUSES, INVOICE_TYPES, fmtCAD } from "./InvoiceConstants";
import type { AdminInvoice } from "@/core-app/hooks/useAdminInvoices";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  X, User, FileText, ShoppingCart, CreditCard, Hash, Calendar,
  CheckCircle2, XCircle, AlertTriangle, Send, Download, DollarSign,
  ExternalLink, Copy, MessageSquare, RefreshCcw, Loader2,
} from "lucide-react";
import { toast } from "sonner";

interface Props {
  invoice: AdminInvoice | null;
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

function BreakdownRow({ label, value, bold, negative }: { label: string; value: string; bold?: boolean; negative?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className={`text-[11px] ${bold ? "text-[#F8FAFC] font-semibold" : "text-[#CBD5E1]"}`}>{label}</span>
      <span className={`text-[12px] tabular-nums ${negative ? "text-emerald-400" : bold ? "text-[#F8FAFC] font-bold" : "text-[#CBD5E1]"}`}>{value}</span>
    </div>
  );
}

export function InvoiceDetailDrawer({ invoice, onClose }: Props) {
  const queryClient = useQueryClient();
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  if (!invoice) return null;
  const inv = invoice;
  const statusLabel = INVOICE_STATUSES[inv.status ?? ""] || inv.status || "—";
  const typeLabel = INVOICE_TYPES[inv.type] || inv.type;
  const hasBalance = (inv.balance_due ?? 0) > 0;
  const isPaid = inv.status === "paid" || inv.status === "paid_by_promo";
  const isVoid = inv.status === "void" || inv.status === "cancelled";
  const isDisputed = inv.status === "disputed";
  const taxes = (inv.tps_amount ?? 0) + (inv.tvq_amount ?? 0);

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-invoices"] });
    queryClient.invalidateQueries({ queryKey: ["admin-payments-v2"] });
  };

  const handleMarkPaid = async () => {
    setActionLoading("markPaid");
    try {
      const { error } = await supabase.rpc("apply_payment_to_invoice" as any, {
        p_invoice_id: inv.id,
        p_customer_id: inv.customer_id,
        p_amount: inv.balance_due ?? inv.total,
        p_method: "manual",
        p_provider: "manual",
        p_provider_payment_id: `mark_paid_drawer_${Date.now()}`,
        p_source: "admin",
        p_created_by_name: "Invoice Drawer",
        p_created_by_role: "admin",
      });
      if (error) throw error;

      toast.success(`Facture ${inv.invoice_number} marquée payée`);
      refreshAll();
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setActionLoading(null);
    }
  };

  const handleSendInvoice = async () => {
    setActionLoading("send");
    try {
      const recipientEmail = inv.customer_email;
      if (!recipientEmail) {
        toast.error("Aucune adresse courriel trouvée pour ce client");
        return;
      }
      const eventKey = `manual_invoice_sent_${inv.id}_${Date.now()}`;
      const { error } = await supabase.from("email_queue").insert({
        event_key: eventKey,
        template_key: "invoice_sent",
        to_email: recipientEmail,
        subject: `Facture ${inv.invoice_number}`,
        template_vars: {
          invoice_number: inv.invoice_number,
          total: inv.total,
          due_date: inv.due_date,
          balance_due: inv.balance_due,
          manual_send: true,
        },
        entity_type: "invoice",
        entity_id: inv.id,
        message_type: "invoice_sent",
        status: "queued",
      });
      if (error) throw error;
      toast.success(`Facture envoyée à ${recipientEmail}`);
      refreshAll();
    } catch (e: any) {
      toast.error(e.message || "Erreur d'envoi");
    } finally {
      setActionLoading(null);
    }
  };

  const handleVoidInvoice = async () => {
    setActionLoading("void");
    try {
      const { error } = await supabase.from("billing_invoices").update({
        status: "void" as any,
      }).eq("id", inv.id);
      if (error) throw error;
      toast.success(`Facture ${inv.invoice_number} annulée`);
      refreshAll();
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDispute = async () => {
    setActionLoading("dispute");
    try {
      const { error } = await supabase.from("billing_invoices").update({
        status: "disputed" as any,
      }).eq("id", inv.id);
      if (error) throw error;
      toast.success(`Litige ouvert pour ${inv.invoice_number}`);
      refreshAll();
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-[500px] bg-[hsl(220,20%,9%)] border-l border-[hsl(220,15%,16%)] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-[hsl(220,15%,16%)] bg-[hsl(220,20%,9%)]/95 backdrop-blur">
          <div>
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-emerald-400" />
              <h2 className="text-sm font-bold text-[#F8FAFC]">Dossier Facture</h2>
            </div>
            <p className="text-[11px] font-mono text-[#94A3B8] mt-0.5">{inv.invoice_number}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[hsl(220,15%,14%)] transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Status + Total hero */}
          <div className="flex items-center justify-between p-4 rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)]">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[#94A3B8] mb-1">Total facturé</p>
              <p className="text-2xl font-bold tabular-nums text-[#F8FAFC]">{fmtCAD(inv.total)}</p>
              {hasBalance && (
                <p className="text-xs text-red-400 font-semibold mt-0.5">Solde dû : {fmtCAD(inv.balance_due)}</p>
              )}
            </div>
            <div className="text-right space-y-1.5">
              <StatusBadge label={statusLabel} variant={statusToVariant(inv.status ?? "")} size="md" />
              <p className="text-[10px] text-[#94A3B8] capitalize">{typeLabel}</p>
            </div>
          </div>

          {/* Dispute alert */}
          {isDisputed && (
            <div className="flex items-center gap-2 p-3 rounded-lg border border-orange-500/30 bg-orange-500/10">
              <AlertTriangle className="h-4 w-4 text-orange-400 shrink-0" />
              <p className="text-xs text-orange-300">Cette facture fait l'objet d'un litige.</p>
            </div>
          )}

          {/* ═══ Billing Breakdown ═══ */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <DollarSign className="h-3.5 w-3.5 text-[#94A3B8]" />
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">Ventilation financière</h3>
            </div>
            <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] px-4 py-3 space-y-0.5">
              <BreakdownRow label="Sous-total" value={fmtCAD(inv.subtotal)} />
              <BreakdownRow label="TPS (5%)" value={fmtCAD(inv.tps_amount)} />
              <BreakdownRow label="TVQ (9.975%)" value={fmtCAD(inv.tvq_amount)} />
              <div className="border-t border-[hsl(220,15%,16%)] my-1" />
              <BreakdownRow label="Total" value={fmtCAD(inv.total)} bold />
              <BreakdownRow label="Montant payé" value={fmtCAD(inv.amount_paid)} negative />
              <div className="border-t border-[hsl(220,15%,16%)] my-1" />
              <BreakdownRow label="Solde à payer" value={fmtCAD(inv.balance_due)} bold />
            </div>
          </div>

          {/* ═══ Client Identity ═══ */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <User className="h-3.5 w-3.5 text-[#94A3B8]" />
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">Identité client</h3>
            </div>
            <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] px-4 py-2">
              <Field label="Nom" value={inv.customer_name || "—"} />
              <Field label="Email" value={inv.customer_email || "—"} copyable />
              <Field label="Compte" value={inv.account_number || "—"} mono copyable />
              <Field label="Client ID" value={inv.customer_id} mono link={corePath(`/accounts/${inv.customer_id}`)} />
            </div>
          </div>

          {/* ═══ Dates & Cycle ═══ */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Calendar className="h-3.5 w-3.5 text-[#94A3B8]" />
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">Dates & Cycle</h3>
            </div>
            <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] px-4 py-2">
              <Field label="Créée le" value={fmtDate(inv.created_at)} />
              <Field label="Échéance" value={fmtDate(inv.due_date)} />
              <Field label="Payée le" value={fmtDate(inv.paid_at)} />
              <Field label="Début cycle" value={fmtDate(inv.cycle_start_date)} />
              <Field label="Fin cycle" value={fmtDate(inv.cycle_end_date)} />
              <Field label="Méthode paiement" value={inv.payment_method || "—"} />
            </div>
          </div>

          {/* ═══ Linked Documents ═══ */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Hash className="h-3.5 w-3.5 text-[#94A3B8]" />
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">Documents liés</h3>
            </div>
            <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] px-4 py-2">
              <Field
                label="Commande"
                value={inv.order_number || "—"}
                mono
                link={inv.order_id ? corePath(`/orders/${inv.order_id}`) : undefined}
              />
            </div>
          </div>

          {/* ═══ Notes ═══ */}
          {inv.notes && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <MessageSquare className="h-3.5 w-3.5 text-[#94A3B8]" />
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">Notes internes</h3>
              </div>
              <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-4">
                <p className="text-xs text-[#CBD5E1] whitespace-pre-wrap">{inv.notes}</p>
              </div>
            </div>
          )}

          {/* ═══ Quick Actions ═══ */}
          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-2">Actions rapides</h3>
            <div className="grid grid-cols-2 gap-2">
              {/* Full detail page */}
              <Link to={corePath(`/invoices/${inv.id}`)} className="col-span-2">
                <ActionBtn icon={FileText} label="Ouvrir dossier complet" color="emerald" />
              </Link>

              {hasBalance && !isVoid && (
                <ActionBtn icon={CreditCard} label="Enregistrer paiement" color="emerald" onClick={handleMarkPaid} loading={actionLoading === "markPaid"} />
              )}
              {!isPaid && !isVoid && (
                <>
                  <ActionBtn icon={Send} label="Renvoyer facture" color="sky" onClick={handleSendInvoice} loading={actionLoading === "send"} />
                  <ActionBtn icon={XCircle} label="Annuler facture" color="red" onClick={handleVoidInvoice} loading={actionLoading === "void"} />
                </>
              )}
              {!isDisputed && !isVoid && (
                <ActionBtn icon={AlertTriangle} label="Ouvrir litige" color="orange" onClick={handleDispute} loading={actionLoading === "dispute"} />
              )}

              <Link to={corePath(`/accounts/${inv.customer_id}`)}>
                <ActionBtn icon={User} label="Voir compte" color="sky" />
              </Link>

              {inv.order_id && (
                <Link to={corePath(`/orders/${inv.order_id}`)}>
                  <ActionBtn icon={ShoppingCart} label="Voir commande" color="sky" />
                </Link>
              )}
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
