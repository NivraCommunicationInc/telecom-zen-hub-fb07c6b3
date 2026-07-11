/**
 * ClientPaymentsHistory — Reusable staff-side payments history for a client.
 * Shows ALL billing_payments for the given billingCustomerId with real
 * processor labels (Carte (Square) / Carte (PayPal) / etc.), invoice link,
 * NVR reference, full processor reference, source/channel, status, and
 * resend-receipt action. Realtime updates on billing_payments.
 *
 * Used in:
 *   - Nivra Core (already integrated via ClientFullHistory)
 *   - Employee portal (EmployeeAccountDetail)
 *   - OneView CS / Staff (StaffClientDetail)
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CreditCard, Send, ExternalLink, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

import { enqueueCommunication } from "@/lib/enqueueCommunication";
const SOURCE_LABELS: Record<string, string> = {
  admin: "Nivra Core",
  admin_confirm: "Nivra Core",
  portal: "Portail client",
  employee: "Employé",
  field: "Vente terrain",
  field_sales: "Vente terrain",
  public: "Caisse publique",
  pos: "POS",
  autopay: "Autopay",
  webhook: "Webhook (paiement externe)",
  webhook_subscription: "Autopay (webhook)",
  manual_correction: "Correction manuelle",
  system: "Système",
};

const STATUS_STYLES: Record<string, string> = {
  confirmed: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  completed: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  paid: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  pending: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  failed: "bg-red-500/10 text-red-600 border-red-500/30",
  declined: "bg-red-500/10 text-red-600 border-red-500/30",
  refunded: "bg-sky-500/10 text-sky-600 border-sky-500/30",
  reversed: "bg-sky-500/10 text-sky-600 border-sky-500/30",
};

const fmtDate = (d: string | null) => {
  if (!d) return "—";
  try { return format(new Date(d), "d MMM yyyy HH:mm", { locale: fr }); } catch { return "—"; }
};

const methodLabel = (method?: string | null, provider?: string | null): string => {
  const m = (method || "").toLowerCase();
  const base = m === "card" ? "Carte"
    : m === "paypal" ? "Carte"
    : m === "interac" ? "Interac"
    : m === "manual" ? "Manuel"
    : m === "internal" ? "Crédit promo"
    : (method || "—");
  const p = (provider || "").toLowerCase();
  const tag = p === "square" ? " (Square)" : p === "paypal" ? " (PayPal)" : m === "paypal" ? " (PayPal)" : "";
  return `${base}${tag}`;
};

interface Props {
  /** UUID from billing_customers.id — optional; component resolves from userId/email when absent */
  billingCustomerId: string | null | undefined;
  /** Auth/profile user_id used to resolve billing_customers when billingCustomerId is absent */
  userId?: string | null;
  /** Optional: link invoice numbers to a custom route (e.g. Core /invoices/:id) */
  invoiceHref?: (invoiceId: string) => string;
  /** Optional: fallback email if no customer_email column resolved */
  fallbackEmail?: string | null;
  /** Show the card wrapper title/border. Default: true */
  showWrapper?: boolean;
}

export function ClientPaymentsHistory({
  billingCustomerId,
  userId,
  invoiceHref,
  fallbackEmail,
  showWrapper = true,
}: Props) {
  const qc = useQueryClient();
  const [sending, setSending] = useState<string | null>(null);

  const normalizedEmail = useMemo(() => fallbackEmail?.trim().toLowerCase() || null, [fallbackEmail]);

  const resolvedCustomerQ = useQuery({
    queryKey: ["client-payments-history-customer", billingCustomerId, userId, normalizedEmail],
    queryFn: async () => {
      if (billingCustomerId) return billingCustomerId;

      if (userId) {
        const { data, error } = await supabase
          .from("billing_customers")
          .select("id")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error) throw error;
        if (data?.id) return data.id as string;
      }

      if (normalizedEmail) {
        const { data, error } = await supabase
          .from("billing_customers")
          .select("id")
          .eq("email", normalizedEmail)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error) throw error;
        if (data?.id) return data.id as string;
      }

      return null;
    },
    enabled: !!billingCustomerId || !!userId || !!normalizedEmail,
  });

  const resolvedBillingCustomerId = resolvedCustomerQ.data ?? null;

  const paymentsQ = useQuery({
    queryKey: ["client-payments-history", resolvedBillingCustomerId],
    queryFn: async () => {
      if (!resolvedBillingCustomerId) return [];
      const { data, error } = await supabase
        .from("billing_payments")
        .select(`
          id, payment_number, amount, method, reference, status, created_at, received_at,
          provider, provider_payment_id, source, nivra_reference, square_payment_id,
          square_receipt_url, invoice_id,
          invoice:billing_invoices(invoice_number),
          customer:billing_customers(email)
        `)
        .eq("customer_id", resolvedBillingCustomerId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!resolvedBillingCustomerId,
  });

  // Realtime — refresh on any change to this customer's payments
  useEffect(() => {
    if (!resolvedBillingCustomerId) return;
    const channel = supabase
      .channel(`payments-history-${resolvedBillingCustomerId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "billing_payments", filter: `customer_id=eq.${resolvedBillingCustomerId}` },
        () => qc.invalidateQueries({ queryKey: ["client-payments-history", resolvedBillingCustomerId] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [resolvedBillingCustomerId, qc]);

  const resendReceipt = async (p: any) => {
    const email = p.customer?.email || fallbackEmail;
    if (!email) { toast.error("Aucun courriel client."); return; }
    setSending(p.id);
    try {
      let error: any = null;
      try { await enqueueCommunication({
        channel: "email",
        templateKey: "payment_receipt",
        recipient: email,
        idempotencyKey: `resend_receipt_${p.id}_${Date.now()}`,
        templateVars: {
          client_name: "Client",
          invoice_number: p.invoice?.invoice_number || p.nivra_reference || p.payment_number,
          amount: p.amount,
          amount_paid_today: p.amount,
          reference: p.nivra_reference || p.payment_number,
          payment_method: methodLabel(p.method, p.provider),
          payment_date: p.received_at || p.created_at,
          receipt_url: p.square_receipt_url || undefined,
        },
      }); } catch (__e) { error = __e; }
      if (error) throw error;
      toast.success("Reçu envoyé à " + email);
    } catch (e: any) {
      toast.error("Envoi échoué : " + (e?.message || String(e)));
    } finally {
      setSending(null);
    }
  };

  const rows = paymentsQ.data || [];

  const inner = (
    <>
      {resolvedCustomerQ.isLoading || paymentsQ.isLoading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin mr-2" /> Chargement…
        </div>
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center">Aucun paiement enregistré</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                {["Date", "Montant", "Méthode", "Facture", "Réf NVR", "Réf processeur", "Source", "Statut", ""].map((h) => (
                  <th key={h} className="text-left px-2 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((p: any) => {
                const procRef = p.square_payment_id || p.provider_payment_id || p.reference || "—";
                const nvrRef = p.nivra_reference || p.payment_number;
                const src = p.source ? (SOURCE_LABELS[p.source] || p.source) : "—";
                const statusKey = (p.status || "confirmed").toLowerCase();
                const statusCls = STATUS_STYLES[statusKey] || "bg-muted text-foreground border-border";
                return (
                  <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                    <td className="px-2 py-2 whitespace-nowrap">{fmtDate(p.received_at || p.created_at)}</td>
                    <td className="px-2 py-2 tabular-nums font-medium text-emerald-600 whitespace-nowrap">{Number(p.amount).toFixed(2)} $</td>
                    <td className="px-2 py-2 whitespace-nowrap">{methodLabel(p.method, p.provider)}</td>
                    <td className="px-2 py-2 font-mono text-[10px]">
                      {p.invoice?.invoice_number ? (
                        invoiceHref && p.invoice_id ? (
                          <a href={invoiceHref(p.invoice_id)} className="text-primary hover:underline">{p.invoice.invoice_number}</a>
                        ) : (
                          <span>{p.invoice.invoice_number}</span>
                        )
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-2 py-2 font-mono text-[10px]">{nvrRef}</td>
                    <td className="px-2 py-2 font-mono text-[10px] text-muted-foreground truncate max-w-[160px]">{procRef}</td>
                    <td className="px-2 py-2 text-[10px] text-muted-foreground">{src}</td>
                    <td className="px-2 py-2">
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusCls}`}>
                        {p.status || "confirmed"}
                      </span>
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap">
                      {p.square_receipt_url && (
                        <a href={p.square_receipt_url} target="_blank" rel="noreferrer" className="text-primary hover:underline text-[10px] inline-flex items-center gap-1 mr-2">
                          <ExternalLink className="h-3 w-3" /> Reçu
                        </a>
                      )}
                      <button
                        disabled={sending === p.id}
                        onClick={() => resendReceipt(p)}
                        className="text-primary hover:underline text-[10px] inline-flex items-center gap-1 disabled:opacity-40"
                      >
                        <Send className="h-3 w-3" /> {sending === p.id ? "Envoi…" : "Renvoyer"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );

  if (!showWrapper) return inner;

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <CreditCard className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Historique des paiements</h3>
        <span className="text-xs text-muted-foreground ml-auto">{rows.length} paiement{rows.length > 1 ? "s" : ""}</span>
      </div>
      <div className="p-2">{inner}</div>
    </div>
  );
}
