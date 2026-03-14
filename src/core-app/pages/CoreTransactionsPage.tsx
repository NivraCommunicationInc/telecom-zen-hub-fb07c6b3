/**
 * CoreTransactionsPage — Operational Transaction Visibility Console
 * Shows orphan payments, incomplete orders, abandoned checkouts, failed checkouts,
 * pending payment confirmations, and missing invoices.
 *
 * Data sources: orders, billing_payments, billing_invoices, transaction_events
 */
import { useState, useMemo } from "react";
import { useTransactionVisibility, getCategoryCounts, type TransactionRow, type TransactionCategory } from "@/core-app/hooks/useTransactionVisibility";
import { StatusBadge, statusToVariant } from "@/core-app/components/ui/StatusBadge";
import { Link } from "react-router-dom";
import { corePath } from "@/core-app/lib/corePaths";
import {
  Search, RefreshCw, AlertTriangle, CreditCard, ShoppingCart,
  Clock, XCircle, FileText, Eye, ExternalLink, DollarSign,
  Activity, Ban, Inbox,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const CATEGORY_FILTERS: { label: string; value: TransactionCategory; icon: typeof AlertTriangle; color: string }[] = [
  { label: "Tous", value: "all", icon: Activity, color: "text-white" },
  { label: "Paiements orphelins", value: "orphan_payment", icon: AlertTriangle, color: "text-red-400" },
  { label: "Paiements en attente", value: "pending_payment", icon: Clock, color: "text-amber-400" },
  { label: "Commandes échouées", value: "failed_order", icon: XCircle, color: "text-red-400" },
  { label: "Factures manquantes", value: "missing_invoice", icon: FileText, color: "text-orange-400" },
  { label: "Checkouts abandonnés", value: "abandoned_checkout", icon: Ban, color: "text-violet-400" },
];

const STATUS_VARIANT_MAP: Record<string, string> = {
  payment_orphaned: "danger",
  payment_pending: "warning",
  payment_failed: "danger",
  order_failed: "danger",
  order_incomplete: "warning",
  checkout_abandoned: "neutral",
  checkout_error: "danger",
};

function getStatusVariant(status: string) {
  return (STATUS_VARIANT_MAP[status] || statusToVariant(status)) as any;
}

const formatCAD = (n: number | null) =>
  n != null ? n.toLocaleString("fr-CA", { style: "currency", currency: "CAD" }) : "—";

const CoreTransactionsPage = () => {
  const { data: rows = [], isLoading, refetch } = useTransactionVisibility();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<TransactionCategory>("all");

  const counts = useMemo(() => getCategoryCounts(rows), [rows]);

  const filtered = useMemo(() => {
    let list = rows;
    if (categoryFilter !== "all") {
      list = list.filter(r => r.category === categoryFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(r =>
        r.customer_name?.toLowerCase().includes(q) ||
        r.customer_email?.toLowerCase().includes(q) ||
        r.order_number?.toLowerCase().includes(q) ||
        r.invoice_number?.toLowerCase().includes(q) ||
        r.payment_number?.toLowerCase().includes(q) ||
        r.paypal_reference?.toLowerCase().includes(q) ||
        r.status_label.toLowerCase().includes(q) ||
        r.failure_reason?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [rows, search, categoryFilter]);

  // Count items needing action
  const actionNeededCount = rows.filter(r =>
    ["orphan_payment", "pending_payment", "failed_order", "missing_invoice"].includes(r.category)
  ).length;

  return (
    <div className="space-y-4">
      {/* ═══ HEADER ═══ */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-amber-400" />
            <h1 className="text-lg font-bold text-[#F8FAFC] tracking-tight">Transactions</h1>
          </div>
          <p className="text-[12px] text-[#94A3B8] mt-0.5">
            Visibilité opérationnelle · Paiements orphelins, commandes incomplètes, checkouts abandonnés
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1.5 rounded-lg border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,13%)] px-3 py-1.5 text-[11px] font-medium text-[#94A3B8] hover:text-[#F8FAFC] hover:border-emerald-500/30 transition-colors"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} /> Actualiser
        </button>
      </div>

      {/* ═══ ALERT BAR ═══ */}
      {!isLoading && actionNeededCount > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-2.5">
          <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
          <p className="text-[12px] text-red-400 font-medium">
            {actionNeededCount} transaction{actionNeededCount > 1 ? "s" : ""} nécessite{actionNeededCount > 1 ? "nt" : ""} une action administrative immédiate
          </p>
        </div>
      )}

      {/* ═══ KPI STRIP ═══ */}
      <div className="grid grid-cols-6 gap-3">
        {[
          { label: "Total", value: counts.total, icon: Activity, color: "text-white", bg: "bg-[hsl(220,15%,18%)]" },
          { label: "Orphelins", value: counts.orphan_payment, icon: AlertTriangle, color: "text-red-400", bg: "bg-red-500/10" },
          { label: "En attente", value: counts.pending_payment, icon: Clock, color: "text-amber-400", bg: "bg-amber-500/10" },
          { label: "Échouées", value: counts.failed_order, icon: XCircle, color: "text-red-400", bg: "bg-red-500/10" },
          { label: "Sans facture", value: counts.missing_invoice, icon: FileText, color: "text-orange-400", bg: "bg-orange-500/10" },
          { label: "Abandonnés", value: counts.abandoned_checkout, icon: Ban, color: "text-violet-400", bg: "bg-violet-500/10" },
        ].map(k => (
          <div key={k.label} className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-3">
            <div className="flex items-center gap-2 mb-1.5">
              <div className={`h-6 w-6 rounded-md ${k.bg} flex items-center justify-center`}>
                <k.icon className={`h-3 w-3 ${k.color}`} />
              </div>
              <p className="text-[10px] uppercase tracking-wider text-[hsl(220,10%,40%)] font-medium">{k.label}</p>
            </div>
            <p className={`text-lg font-bold tabular-nums ${k.color}`}>
              {isLoading ? "—" : k.value}
            </p>
          </div>
        ))}
      </div>

      {/* ═══ FILTER BAR ═══ */}
      <div className="flex items-center gap-3">
        <div className="flex-1 flex items-center gap-2 rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] px-3 py-2">
          <Search className="h-4 w-4 text-[hsl(220,10%,40%)]" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher par client, email, commande, facture, référence PayPal…"
            className="flex-1 bg-transparent text-xs text-white placeholder:text-[hsl(220,10%,35%)] outline-none"
          />
        </div>
        <div className="flex items-center gap-0.5 rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] px-1 py-1 overflow-x-auto">
          {CATEGORY_FILTERS.map(f => {
            const count = f.value === "all" ? counts.total : (counts as any)[f.value] ?? 0;
            return (
              <button
                key={f.value}
                onClick={() => setCategoryFilter(f.value)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap ${
                  categoryFilter === f.value
                    ? "bg-emerald-600/20 text-emerald-400"
                    : "text-[hsl(220,10%,45%)] hover:text-white"
                }`}
              >
                <f.icon className="h-3 w-3" />
                {f.label}
                {count > 0 && (
                  <span className={`ml-0.5 text-[10px] ${categoryFilter === f.value ? "text-emerald-400" : "text-[hsl(220,10%,35%)]"}`}>
                    ({count})
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ═══ TABLE ═══ */}
      <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[hsl(220,15%,16%)]">
                {["Date", "Client", "Montant", "Méthode", "Réf. PayPal", "Statut", "N° Commande", "N° Facture", "N° Paiement", "Raison", "Action requise"].map(h => (
                  <th key={h} className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-[hsl(220,10%,38%)] whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-[hsl(220,15%,14%)]">
                    {Array.from({ length: 11 }).map((_, j) => (
                      <td key={j} className="px-3 py-2.5"><div className="h-3.5 w-16 rounded bg-[hsl(220,15%,14%)] animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={11} className="text-center py-16 text-[hsl(220,10%,35%)]">
                    <Inbox className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-medium text-[hsl(220,10%,45%)]">
                      {categoryFilter !== "all" ? "Aucun élément dans cette catégorie" : "Aucune transaction problématique détectée"}
                    </p>
                    <p className="text-[11px] text-[hsl(220,10%,35%)] mt-1">
                      {categoryFilter === "all" ? "Le système est sain — tous les paiements sont liés." : "Changez de filtre pour voir d'autres catégories."}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map(row => (
                  <tr key={row.id} className="border-b border-[hsl(220,15%,14%)] last:border-0 hover:bg-[hsl(220,20%,13%)] transition-colors">
                    {/* Date */}
                    <td className="px-3 py-2.5 text-[#94A3B8] whitespace-nowrap">
                      {row.date ? format(new Date(row.date), "d MMM yyyy HH:mm", { locale: fr }) : "—"}
                    </td>
                    {/* Client */}
                    <td className="px-3 py-2.5">
                      <div>
                        <p className="text-[#F8FAFC] font-medium truncate max-w-[140px]">{row.customer_name || "—"}</p>
                        <p className="text-[#64748B] text-[10px] truncate max-w-[140px]">{row.customer_email || ""}</p>
                      </div>
                    </td>
                    {/* Amount */}
                    <td className="px-3 py-2.5 text-[#F8FAFC] font-medium tabular-nums whitespace-nowrap">
                      {formatCAD(row.amount)}
                    </td>
                    {/* Method */}
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5 text-[#94A3B8]">
                        <CreditCard className="h-3 w-3" />
                        <span className="capitalize">{row.payment_method || "—"}</span>
                      </div>
                    </td>
                    {/* PayPal ref */}
                    <td className="px-3 py-2.5">
                      {row.paypal_reference ? (
                        <span className="font-mono text-[10px] text-sky-400 truncate max-w-[100px] block">{row.paypal_reference}</span>
                      ) : (
                        <span className="text-[#475569]">—</span>
                      )}
                    </td>
                    {/* Status */}
                    <td className="px-3 py-2.5">
                      <StatusBadge label={row.status_label} variant={getStatusVariant(row.status)} size="sm" />
                    </td>
                    {/* Order # */}
                    <td className="px-3 py-2.5">
                      {row.order_number ? (
                        <Link to={corePath(`/orders`)} className="font-mono text-[11px] text-emerald-400 hover:underline">
                          {row.order_number}
                        </Link>
                      ) : (
                        <span className="text-[#475569]">—</span>
                      )}
                    </td>
                    {/* Invoice # */}
                    <td className="px-3 py-2.5">
                      {row.invoice_number ? (
                        <Link to={corePath(`/invoices`)} className="font-mono text-[11px] text-sky-400 hover:underline">
                          {row.invoice_number}
                        </Link>
                      ) : (
                        <span className="text-[#475569]">—</span>
                      )}
                    </td>
                    {/* Payment # */}
                    <td className="px-3 py-2.5">
                      {row.payment_number ? (
                        <span className="font-mono text-[11px] text-[#94A3B8]">{row.payment_number}</span>
                      ) : (
                        <span className="text-[#475569]">—</span>
                      )}
                    </td>
                    {/* Failure reason */}
                    <td className="px-3 py-2.5">
                      {row.failure_reason ? (
                        <span className="text-red-400 text-[10px] truncate max-w-[160px] block" title={row.failure_reason}>
                          {row.failure_reason}
                        </span>
                      ) : (
                        <span className="text-[#475569]">—</span>
                      )}
                    </td>
                    {/* Action needed */}
                    <td className="px-3 py-2.5">
                      <span className="text-amber-400 text-[10px] font-medium truncate max-w-[160px] block">
                        {row.action_needed}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══ FOOTER ═══ */}
      {!isLoading && filtered.length > 0 && (
        <p className="text-[11px] text-[#64748B] text-center">
          {filtered.length} élément{filtered.length !== 1 ? "s" : ""} affiché{filtered.length !== 1 ? "s" : ""}
          {categoryFilter !== "all" && ` · Filtre: ${CATEGORY_FILTERS.find(f => f.value === categoryFilter)?.label}`}
        </p>
      )}

      {/* ═══ DATA SOURCES REFERENCE ═══ */}
      <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-3 text-[10px] font-mono text-[#64748B]">
        <p className="mb-1 text-[#94A3B8] font-sans text-[11px] font-medium">Sources de données</p>
        <p>orders · billing_payments · billing_invoices · billing_customers · transaction_events · profiles</p>
      </div>
    </div>
  );
};

export default CoreTransactionsPage;
