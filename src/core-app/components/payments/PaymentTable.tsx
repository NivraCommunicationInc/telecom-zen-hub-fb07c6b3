/**
 * Professional payment operations table — with source, split refs, row actions.
 */
import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { corePath } from "@/core-app/lib/corePaths";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { StatusBadge, statusToVariant } from "@/core-app/components/ui/StatusBadge";
import { PAYMENT_STATUSES, PAYMENT_METHODS, PAYMENT_SOURCES, fmtCAD } from "./PaymentConstants";
import { TestBadge } from "@/core-app/components/CoreEnvironmentToggle";
import { MoreHorizontal, AlertTriangle, Wallet, Eye, ExternalLink, User, Send } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { AdminPayment } from "@/core-app/hooks/useAdminPayments";

interface Props {
  payments: AdminPayment[];
  isLoading: boolean;
  onSelect: (payment: AdminPayment) => void;
}

const fmtDate = (d: string | null) => {
  if (!d) return "—";
  try { return format(new Date(d), "d MMM yyyy HH:mm", { locale: fr }); } catch { return "—"; }
};

const COLS = ["Date", "Client", "Facture", "Montant", "Méthode", "Source", "Réf NVR", "Réf processeur", "Statut", "Agent", ""];

export function PaymentTable({ payments, isLoading, onSelect }: Props) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenu(null);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const resendReceipt = async (p: AdminPayment) => {
    if (!p.customer_email) { toast.error("Aucun courriel client."); return; }
    setSending(p.id);
    try {
      const { error } = await supabase.from("email_queue").insert({
        event_key: `resend_receipt_${p.id}_${Date.now()}`,
        to_email: p.customer_email,
        template_key: "payment_receipt",
        template_vars: {
          client_name: p.customer_name || "Client",
          first_name: (p.customer_name || "Client").split(" ")[0],
          invoice_number: p.invoice_number || p.nivra_reference || p.payment_number,
          amount: p.amount,
          amount_paid_today: p.amount,
          reference: p.nivra_reference || p.payment_number,
          payment_method: PAYMENT_METHODS[p.method as keyof typeof PAYMENT_METHODS] || p.method,
          payment_date: p.received_at || p.created_at,
          receipt_url: p.square_receipt_url || undefined,
        },
        status: "queued",
        attempts: 0,
        max_attempts: 5,
      });
      if (error) throw error;
      toast.success("Reçu envoyé à " + p.customer_email);
    } catch (e: any) {
      toast.error("Envoi échoué : " + (e?.message || String(e)));
    } finally {
      setSending(null);
      setOpenMenu(null);
    }
  };

  return (
    <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[hsl(220,15%,16%)]">
              {COLS.map(h => (
                <th key={h} className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8] whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <tr key={i} className="border-b border-[hsl(220,15%,14%)]">
                  {Array.from({ length: COLS.length }).map((_, j) => (
                    <td key={j} className="px-3 py-3">
                      <div className="h-3.5 w-16 rounded bg-[hsl(220,15%,14%)] animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : payments.length === 0 ? (
              <tr>
                <td colSpan={COLS.length} className="text-center py-16 text-[#64748B]">
                  <Wallet className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-xs">Aucun paiement trouvé</p>
                </td>
              </tr>
            ) : (
              payments.map(p => {
                const isFraud = p.status === "fraud";
                const statusLabel = PAYMENT_STATUSES[p.status as keyof typeof PAYMENT_STATUSES] || p.status || "—";
                // STAFF VIEW — show real processor (Square / PayPal) alongside method
                const baseMethod = PAYMENT_METHODS[p.method as keyof typeof PAYMENT_METHODS] || p.method;
                const providerTag =
                  p.provider === "square" ? " (Square)"
                  : p.provider === "paypal" ? " (PayPal)"
                  : p.method === "paypal" ? " (PayPal)"
                  : "";
                const methodLabel = `${baseMethod}${providerTag}`;
                const sourceLabel = p.source ? (PAYMENT_SOURCES[p.source] || p.source) : "—";
                // STAFF VIEW — full processor reference, never masked
                const processorRef = p.square_payment_id || p.provider_payment_id || p.reference || "—";


                return (
                  <tr
                    key={p.id}
                    onClick={() => onSelect(p)}
                    className={`border-b border-[hsl(220,15%,14%)] last:border-0 cursor-pointer transition-colors ${
                      isFraud ? "hover:bg-red-500/5 bg-red-500/[0.02]" : "hover:bg-[hsl(220,20%,13%)]"
                    }`}
                  >
                    {/* Date */}
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className="text-[#CBD5E1]">{fmtDate(p.received_at || p.created_at)}</span>
                    </td>

                    {/* Client */}
                    <td className="px-3 py-2.5">
                      <div className="max-w-[180px]">
                        {p.customer_id ? (
                          <Link
                            to={corePath(`/clients/${p.customer_id}`)}
                            onClick={e => e.stopPropagation()}
                            className="text-[#38BDF8] hover:underline truncate font-medium block"
                          >
                            {p.customer_name || p.customer_email || "—"}
                          </Link>
                        ) : (
                          <p className="text-[#F8FAFC] truncate font-medium">{p.customer_name || "—"}</p>
                        )}
                        <p className="text-[#64748B] text-[11px] truncate font-mono">{p.account_number || p.customer_email || ""}</p>
                      </div>
                    </td>

                    {/* Invoice */}
                    <td className="px-3 py-2.5">
                      {p.invoice_number ? (
                        <Link
                          to={corePath(`/invoices/${p.invoice_id}`)}
                          onClick={e => e.stopPropagation()}
                          className="font-mono text-[11px] text-[#38BDF8] hover:underline"
                        >
                          {p.invoice_number}
                        </Link>
                      ) : (
                        <span className="text-[#64748B]">—</span>
                      )}
                    </td>

                    {/* Amount */}
                    <td className="px-3 py-2.5">
                      <span className="tabular-nums text-emerald-400 font-semibold">{fmtCAD(p.amount)}</span>
                    </td>

                    {/* Method */}
                    <td className="px-3 py-2.5">
                      <span className="text-[#CBD5E1]">{methodLabel}</span>
                    </td>

                    {/* Source */}
                    <td className="px-3 py-2.5">
                      <span className="text-[#94A3B8] text-[11px]">{sourceLabel}</span>
                    </td>

                    {/* NVR ref */}
                    <td className="px-3 py-2.5">
                      <span className="font-mono text-[11px] text-[#F8FAFC]">
                        {p.nivra_reference || p.payment_number}
                      </span>
                      {p.environment === 'test' && <TestBadge />}
                    </td>

                    {/* Processor ref */}
                    <td className="px-3 py-2.5">
                      <span className="font-mono text-[#94A3B8] text-[11px] truncate max-w-[140px] block">
                        {processorRef}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-3 py-2.5">
                      <StatusBadge label={statusLabel} variant={statusToVariant(p.status ?? "")} size="sm" />
                    </td>

                    {/* Agent */}
                    <td className="px-3 py-2.5">
                      <span className="text-[#94A3B8] truncate max-w-[100px] block">
                        {p.confirmed_by || p.created_by_name || "—"}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-3 py-2.5 relative">
                      <button
                        onClick={e => { e.stopPropagation(); setOpenMenu(openMenu === p.id ? null : p.id); }}
                        className="h-7 w-7 flex items-center justify-center rounded-md border border-[hsl(220,15%,20%)] text-[#94A3B8] hover:text-[#F8FAFC] hover:border-emerald-500/40 transition-colors"
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </button>
                      {openMenu === p.id && (
                        <div
                          ref={menuRef}
                          onClick={e => e.stopPropagation()}
                          className="absolute right-2 top-9 z-20 w-56 rounded-lg border border-[hsl(220,15%,20%)] bg-[hsl(220,20%,13%)] shadow-xl py-1"
                        >
                          <button
                            onClick={() => { onSelect(p); setOpenMenu(null); }}
                            className="w-full text-left px-3 py-2 text-[11px] text-[#CBD5E1] hover:bg-[hsl(220,20%,16%)] flex items-center gap-2"
                          >
                            <Eye className="h-3.5 w-3.5" /> Détails du paiement
                          </button>
                          {p.square_receipt_url && (
                            <a
                              href={p.square_receipt_url}
                              target="_blank"
                              rel="noreferrer"
                              onClick={() => setOpenMenu(null)}
                              className="w-full text-left px-3 py-2 text-[11px] text-[#CBD5E1] hover:bg-[hsl(220,20%,16%)] flex items-center gap-2"
                            >
                              <ExternalLink className="h-3.5 w-3.5" /> Voir le reçu processeur
                            </a>
                          )}
                          <button
                            disabled={!p.customer_email || sending === p.id}
                            onClick={() => resendReceipt(p)}
                            className="w-full text-left px-3 py-2 text-[11px] text-[#CBD5E1] hover:bg-[hsl(220,20%,16%)] flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <Send className="h-3.5 w-3.5" /> {sending === p.id ? "Envoi…" : "Renvoyer le reçu par courriel"}
                          </button>
                          {p.customer_id && (
                            <button
                              onClick={() => { navigate(corePath(`/clients/${p.customer_id}`)); setOpenMenu(null); }}
                              className="w-full text-left px-3 py-2 text-[11px] text-[#CBD5E1] hover:bg-[hsl(220,20%,16%)] flex items-center gap-2"
                            >
                              <User className="h-3.5 w-3.5" /> Ouvrir le compte client
                            </button>
                          )}
                          {p.invoice_id && (
                            <button
                              onClick={() => { navigate(corePath(`/invoices/${p.invoice_id}`)); setOpenMenu(null); }}
                              className="w-full text-left px-3 py-2 text-[11px] text-[#CBD5E1] hover:bg-[hsl(220,20%,16%)] flex items-center gap-2"
                            >
                              <ExternalLink className="h-3.5 w-3.5" /> Ouvrir la facture
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
