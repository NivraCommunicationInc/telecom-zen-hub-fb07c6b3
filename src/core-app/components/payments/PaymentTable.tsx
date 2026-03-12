/**
 * Professional payment operations table
 */
import { Link } from "react-router-dom";
import { corePath } from "@/core-app/lib/corePaths";
import { StatusBadge, statusToVariant } from "@/core-app/components/ui/StatusBadge";
import { PAYMENT_STATUSES, PAYMENT_METHODS, fmtCAD } from "./PaymentConstants";
import { TestBadge } from "@/core-app/components/CoreEnvironmentToggle";
import { ArrowRight, AlertTriangle, Wallet } from "lucide-react";
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

const COLS = ["#Paiement", "Client / Compte", "Facture", "Méthode", "Montant", "Statut", "Référence", "Date", "Agent", ""];

export function PaymentTable({ payments, isLoading, onSelect }: Props) {
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
                const methodLabel = PAYMENT_METHODS[p.method as keyof typeof PAYMENT_METHODS] || p.method;

                return (
                  <tr
                    key={p.id}
                    onClick={() => onSelect(p)}
                    className={`border-b border-[hsl(220,15%,14%)] last:border-0 cursor-pointer transition-colors ${
                      isFraud
                        ? "hover:bg-red-500/5 bg-red-500/[0.02]"
                        : "hover:bg-[hsl(220,20%,13%)]"
                    }`}
                  >
                    {/* Payment # */}
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        {isFraud && <AlertTriangle className="h-3 w-3 text-orange-400 shrink-0" />}
                        <span className="font-mono font-medium text-[#F8FAFC]">{p.payment_number}</span>
                        {p.environment === 'test' && <TestBadge />}
                      </div>
                    </td>

                    {/* Client / Account */}
                    <td className="px-3 py-2.5">
                      <div className="max-w-[180px]">
                        <p className="text-[#F8FAFC] truncate font-medium">{p.customer_name || "—"}</p>
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

                    {/* Method */}
                    <td className="px-3 py-2.5">
                      <span className="text-[#CBD5E1]">{methodLabel}</span>
                    </td>

                    {/* Amount */}
                    <td className="px-3 py-2.5">
                      <span className="tabular-nums text-emerald-400 font-semibold">{fmtCAD(p.amount)}</span>
                    </td>

                    {/* Status */}
                    <td className="px-3 py-2.5">
                      <StatusBadge label={statusLabel} variant={statusToVariant(p.status ?? "")} size="sm" />
                    </td>

                    {/* Reference */}
                    <td className="px-3 py-2.5">
                      <span className="font-mono text-[#94A3B8] text-[11px] truncate max-w-[120px] block">
                        {p.reference || p.provider_payment_id || "—"}
                      </span>
                    </td>

                    {/* Date */}
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className="text-[#CBD5E1]">{fmtDate(p.received_at || p.created_at)}</span>
                    </td>

                    {/* Agent */}
                    <td className="px-3 py-2.5">
                      <span className="text-[#94A3B8] truncate max-w-[100px] block">
                        {p.confirmed_by || p.created_by_name || "—"}
                      </span>
                    </td>

                    {/* Action */}
                    <td className="px-3 py-2.5">
                      <button
                        onClick={e => { e.stopPropagation(); onSelect(p); }}
                        className="h-7 w-7 flex items-center justify-center rounded-md border border-[hsl(220,15%,20%)] text-[#94A3B8] hover:text-[#F8FAFC] hover:border-emerald-500/40 transition-colors"
                      >
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
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
