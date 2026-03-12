/**
 * Professional invoice operations table
 */
import { Link } from "react-router-dom";
import { corePath } from "@/core-app/lib/corePaths";
import { StatusBadge, statusToVariant } from "@/core-app/components/ui/StatusBadge";
import { INVOICE_STATUSES, INVOICE_TYPES, fmtCAD } from "./InvoiceConstants";
import { TestBadge } from "@/core-app/components/CoreEnvironmentToggle";
import { ArrowRight, FileText } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { AdminInvoice } from "@/core-app/hooks/useAdminInvoices";

interface Props {
  invoices: AdminInvoice[];
  isLoading: boolean;
  onSelect: (inv: AdminInvoice) => void;
}

const fmtDate = (d: string | null) => {
  if (!d) return "—";
  try { return format(new Date(d), "d MMM yyyy", { locale: fr }); } catch { return "—"; }
};

const COLS = ["Facture", "Client / Compte", "Commande", "Type", "Sous-total", "Taxes", "Total", "Payé", "Solde dû", "Statut", "Échéance", "Créée le", ""];

export function InvoiceTable({ invoices, isLoading, onSelect }: Props) {
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
            ) : invoices.length === 0 ? (
              <tr>
                <td colSpan={COLS.length} className="text-center py-16 text-[#64748B]">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-xs">Aucune facture trouvée</p>
                </td>
              </tr>
            ) : (
              invoices.map(inv => {
                const statusLabel = INVOICE_STATUSES[inv.status ?? ""] || inv.status || "—";
                const typeLabel = INVOICE_TYPES[inv.type] || inv.type;
                const hasBalance = (inv.balance_due ?? 0) > 0;

                return (
                  <tr
                    key={inv.id}
                    onClick={() => onSelect(inv)}
                    className="border-b border-[hsl(220,15%,14%)] last:border-0 cursor-pointer hover:bg-[hsl(220,20%,13%)] transition-colors"
                  >
                    {/* Invoice # */}
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-medium text-[#F8FAFC]">{inv.invoice_number}</span>
                        {inv.environment === 'test' && <TestBadge />}
                      </div>
                    </td>

                    {/* Client / Account */}
                    <td className="px-3 py-2.5">
                      <div className="max-w-[180px]">
                        <p className="text-[#F8FAFC] truncate font-medium">{inv.customer_name || "—"}</p>
                        <p className="text-[#64748B] text-[11px] truncate font-mono">{inv.account_number || inv.customer_email || ""}</p>
                      </div>
                    </td>

                    {/* Order */}
                    <td className="px-3 py-2.5">
                      {inv.order_number ? (
                        <Link
                          to={corePath(`/orders/${inv.order_id}`)}
                          onClick={e => e.stopPropagation()}
                          className="font-mono text-[11px] text-[#38BDF8] hover:underline"
                        >
                          {inv.order_number}
                        </Link>
                      ) : (
                        <span className="text-[#64748B]">—</span>
                      )}
                    </td>

                    {/* Type */}
                    <td className="px-3 py-2.5">
                      <span className="text-[#CBD5E1] capitalize">{typeLabel}</span>
                    </td>

                    {/* Subtotal */}
                    <td className="px-3 py-2.5">
                      <span className="tabular-nums text-[#CBD5E1]">{fmtCAD(inv.subtotal)}</span>
                    </td>

                    {/* Taxes */}
                    <td className="px-3 py-2.5">
                      <span className="tabular-nums text-[#94A3B8]">{fmtCAD((inv.tps_amount ?? 0) + (inv.tvq_amount ?? 0))}</span>
                    </td>

                    {/* Total */}
                    <td className="px-3 py-2.5">
                      <span className="tabular-nums text-[#F8FAFC] font-semibold">{fmtCAD(inv.total)}</span>
                    </td>

                    {/* Paid */}
                    <td className="px-3 py-2.5">
                      <span className="tabular-nums text-emerald-400">{fmtCAD(inv.amount_paid)}</span>
                    </td>

                    {/* Balance */}
                    <td className="px-3 py-2.5">
                      <span className={`tabular-nums font-semibold ${hasBalance ? "text-red-400" : "text-[#64748B]"}`}>
                        {fmtCAD(inv.balance_due)}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-3 py-2.5">
                      <StatusBadge label={statusLabel} variant={statusToVariant(inv.status ?? "")} size="sm" />
                    </td>

                    {/* Due date */}
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className="text-[#CBD5E1]">{fmtDate(inv.due_date)}</span>
                    </td>

                    {/* Created */}
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className="text-[#94A3B8]">{fmtDate(inv.created_at)}</span>
                    </td>

                    {/* Action */}
                    <td className="px-3 py-2.5">
                      <Link to={corePath(`/invoices/${inv.id}`)} onClick={e => e.stopPropagation()}>
                        <button className="h-7 w-7 flex items-center justify-center rounded-md border border-[hsl(220,15%,20%)] text-[#94A3B8] hover:text-[#F8FAFC] hover:border-emerald-500/40 transition-colors">
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      </Link>
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
