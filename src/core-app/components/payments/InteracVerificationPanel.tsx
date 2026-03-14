/**
 * Interac / manual verification workspace — pending transfer queue
 * ALL inline action buttons are wired to real canonical mutations.
 */
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { AdminPayment } from "@/core-app/hooks/useAdminPayments";
import { StatusBadge } from "@/core-app/components/ui/StatusBadge";
import { fmtCAD } from "./PaymentConstants";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import {
  Clock, CheckCircle2, XCircle, AlertTriangle, ShieldCheck, Loader2,
} from "lucide-react";

interface Props {
  payments: AdminPayment[];
  onSelect: (p: AdminPayment) => void;
}

const fmtDate = (d: string | null) => {
  if (!d) return "—";
  try { return format(new Date(d), "d MMM HH:mm", { locale: fr }); } catch { return "—"; }
};

export function InteracVerificationPanel({ payments, onSelect }: Props) {
  const queryClient = useQueryClient();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const pendingInterac = payments.filter(
    p => (p.method === "interac" || p.method === "manual") && (p.status === "pending" || p.status === "in_verification")
  );

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-payments-v2"] });
    queryClient.invalidateQueries({ queryKey: ["admin-invoices"] });
  };

  const handleConfirm = async (p: AdminPayment) => {
    setLoadingId(`confirm-${p.id}`);
    try {
      // ★ FIX: Do NOT call apply_payment_to_invoice RPC for existing pending payments.
      // The RPC creates a NEW payment row, causing duplicates.
      // Instead: confirm the existing payment + update the invoice directly.

      // 1. Confirm the existing pending payment
      const { error: payErr } = await supabase.from("billing_payments")
        .update({ status: "confirmed" as any, confirmed_by: "admin", received_at: new Date().toISOString() })
        .eq("id", p.id);
      if (payErr) throw payErr;

      // 2. Update invoice: add to amount_paid, reduce balance_due, set status
      const { data: inv, error: invFetchErr } = await supabase.from("billing_invoices")
        .select("amount_paid, balance_due, total, status")
        .eq("id", p.invoice_id)
        .single();
      if (invFetchErr) throw invFetchErr;

      const newAmountPaid = (inv.amount_paid ?? 0) + p.amount;
      const newBalanceDue = Math.max(0, (inv.total ?? 0) - newAmountPaid);
      const newStatus = newBalanceDue <= 0 ? "paid" : "partially_paid";

      const { error: invErr } = await supabase.from("billing_invoices")
        .update({
          amount_paid: newAmountPaid,
          balance_due: newBalanceDue,
          status: newStatus as any,
          paid_at: newBalanceDue <= 0 ? new Date().toISOString() : (inv as any).paid_at,
        })
        .eq("id", p.invoice_id);
      if (invErr) throw invErr;

      toast.success(`Paiement ${p.payment_number} confirmé`);
      refreshAll();
    } catch (e: any) {
      toast.error(e.message || "Erreur de confirmation");
    } finally {
      setLoadingId(null);
    }
  };

  const handleReject = async (p: AdminPayment) => {
    setLoadingId(`reject-${p.id}`);
    try {
      const { error } = await supabase.from("billing_payments")
        .update({ status: "failed" as any, legacy_note: `${p.legacy_note ? p.legacy_note + "\n" : ""}[REFUSÉ depuis vérification]` })
        .eq("id", p.id);
      if (error) throw error;

      // Revert invoice if needed
      await supabase.from("billing_invoices")
        .update({ status: "unpaid" as any })
        .eq("id", p.invoice_id);

      toast.success(`Paiement ${p.payment_number} refusé`);
      refreshAll();
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setLoadingId(null);
    }
  };

  const handleFraud = async (p: AdminPayment) => {
    setLoadingId(`fraud-${p.id}`);
    try {
      const { error } = await supabase.from("billing_payments")
        .update({ status: "fraud" as any, legacy_note: `${p.legacy_note ? p.legacy_note + "\n" : ""}[FRAUDE signalée]` })
        .eq("id", p.id);
      if (error) throw error;

      await supabase.from("billing_invoices")
        .update({ status: "unpaid" as any })
        .eq("id", p.invoice_id);

      toast.success(`Paiement ${p.payment_number} signalé comme fraude`);
      refreshAll();
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setLoadingId(null);
    }
  };

  if (pendingInterac.length === 0) {
    return (
      <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-6 text-center">
        <ShieldCheck className="h-8 w-8 mx-auto mb-2 text-emerald-400 opacity-50" />
        <p className="text-xs text-[#94A3B8]">Aucun transfert en attente de vérification</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[hsl(220,15%,16%)]">
        <ShieldCheck className="h-4 w-4 text-violet-400" />
        <h3 className="text-xs font-semibold text-[#F8FAFC]">File de vérification Interac / Manuel</h3>
        <span className="ml-auto text-[10px] font-semibold text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded-full">
          {pendingInterac.length} en attente
        </span>
      </div>

      <div className="divide-y divide-[hsl(220,15%,14%)]">
        {pendingInterac.map(p => {
          const isLoading = loadingId?.includes(p.id);
          return (
            <div
              key={p.id}
              onClick={() => onSelect(p)}
              className="flex items-center gap-4 px-4 py-3 hover:bg-[hsl(220,20%,13%)] cursor-pointer transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[12px] font-medium text-[#F8FAFC]">{p.payment_number}</span>
                  <StatusBadge
                    label={p.status === "in_verification" ? "En vérification" : "En attente"}
                    variant={p.status === "in_verification" ? "purple" : "warning"}
                    size="sm"
                  />
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-[11px] text-[#CBD5E1]">{p.customer_name || "—"}</span>
                  <span className="text-[11px] text-[#64748B]">•</span>
                  <span className="text-[11px] font-mono text-[#94A3B8]">{p.reference || "Aucune réf."}</span>
                </div>
              </div>

              <div className="text-right shrink-0">
                <p className="text-sm font-bold tabular-nums text-emerald-400">{fmtCAD(p.amount)}</p>
                <p className="text-[10px] text-[#64748B]">{fmtDate(p.created_at)}</p>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={e => { e.stopPropagation(); handleConfirm(p); }}
                  disabled={isLoading}
                  className="h-7 w-7 flex items-center justify-center rounded-md border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 transition-colors disabled:opacity-40"
                  title="Confirmer"
                >
                  {loadingId === `confirm-${p.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                </button>
                <button
                  onClick={e => { e.stopPropagation(); handleReject(p); }}
                  disabled={isLoading}
                  className="h-7 w-7 flex items-center justify-center rounded-md border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40"
                  title="Refuser"
                >
                  {loadingId === `reject-${p.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                </button>
                <button
                  onClick={e => { e.stopPropagation(); handleFraud(p); }}
                  disabled={isLoading}
                  className="h-7 w-7 flex items-center justify-center rounded-md border border-orange-500/30 text-orange-400 hover:bg-orange-500/10 transition-colors disabled:opacity-40"
                  title="Fraude"
                >
                  {loadingId === `fraud-${p.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
