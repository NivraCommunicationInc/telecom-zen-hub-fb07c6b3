/**
 * Nivra Core — Invoices (ops-grade)
 * Reuses useAdminInvoices hook — zero duplicated business logic.
 */
import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useAdminInvoices } from "@/hooks/admin/useAdminInvoices";
import { StatusBadge, statusToVariant } from "@/components/admin/ui/StatusBadge";
import { Search, FileText, RefreshCw, ArrowRight, Filter } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon", pending: "En attente", partially_paid: "Partielle",
  paid: "Payée", paid_by_promo: "Promo", failed: "Échouée",
  cancelled: "Annulée", refunded: "Remboursée", overdue: "En retard",
  void: "Annulée", not_renewed: "Non renouvelée",
};
const STATUS_OPTIONS = Object.entries(STATUS_LABELS);

const fmtCAD = (n: number | null) => (n != null ? `${n.toFixed(2)} $` : "—");
const fmtDate = (d: string | null) => {
  if (!d) return "—";
  try { return format(new Date(d), "d MMM yyyy", { locale: fr }); } catch { return "—"; }
};

const InvoicesPage = () => {
  const { data: invoices = [], isLoading, refetch } = useAdminInvoices();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return invoices.filter((inv) => {
      if (statusFilter && inv.status !== statusFilter) return false;
      if (!q) return true;
      return (
        inv.invoice_number?.toLowerCase().includes(q) ||
        inv.customer_name?.toLowerCase().includes(q) ||
        inv.customer_email?.toLowerCase().includes(q) ||
        inv.account_number?.toLowerCase().includes(q) ||
        inv.order_number?.toLowerCase().includes(q)
      );
    });
  }, [invoices, search, statusFilter]);

  const stats = useMemo(() => {
    const total = invoices.length;
    const paid = invoices.filter(i => i.status === "paid" || i.status === "paid_by_promo").length;
    const pending = invoices.filter(i => i.status === "pending").length;
    const overdue = invoices.filter(i => i.status === "overdue" || ((i.balance_due ?? 0) > 0 && i.status !== "paid" && i.status !== "paid_by_promo" && i.status !== "cancelled" && i.status !== "void")).length;
    return { total, paid, pending, overdue };
  }, [invoices]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white tracking-tight">Factures</h1>
          <p className="text-[12px] text-[hsl(220,10%,45%)] mt-0.5">
            Gestion de la facturation · {stats.total} facture{stats.total !== 1 ? "s" : ""}
          </p>
        </div>
        <button onClick={() => refetch()} className="flex items-center gap-1.5 rounded-lg border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,13%)] px-3 py-1.5 text-[11px] font-medium text-[hsl(220,10%,50%)] hover:text-white hover:border-emerald-500/30 transition-colors">
          <RefreshCw className="h-3.5 w-3.5" /> Actualiser
        </button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total", value: stats.total, color: "text-white" },
          { label: "Payées", value: stats.paid, color: "text-emerald-400" },
          { label: "En attente", value: stats.pending, color: "text-amber-400" },
          { label: "Impayées", value: stats.overdue, color: "text-red-400" },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-3">
            <p className="text-[10px] uppercase tracking-wider text-[hsl(220,10%,40%)] font-medium">{s.label}</p>
            <p className={`text-lg font-bold tabular-nums mt-1 ${s.color}`}>{isLoading ? "—" : s.value}</p>
          </div>
        ))}
      </div>

      {/* Search + Filter */}
      <div className="flex items-center gap-3">
        <div className="flex-1 flex items-center gap-2 rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] px-3 py-2">
          <Search className="h-4 w-4 text-[hsl(220,10%,40%)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par #facture, client, compte, commande…"
            className="flex-1 bg-transparent text-xs text-white placeholder:text-[hsl(220,10%,35%)] outline-none"
          />
        </div>
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="appearance-none rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] px-3 py-2 pr-8 text-xs text-[hsl(220,10%,55%)] outline-none cursor-pointer"
          >
            <option value="">Tous les statuts</option>
            {STATUS_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <Filter className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[hsl(220,10%,40%)] pointer-events-none" />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[hsl(220,15%,16%)]">
                {["Facture", "Compte", "Client", "Commande", "Type", "Total", "Payé", "Solde dû", "Statut", "Échéance", "Créée le", ""].map((h) => (
                  <th key={h} className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-[hsl(220,10%,38%)] whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-[hsl(220,15%,14%)]">
                    {Array.from({ length: 12 }).map((_, j) => (
                      <td key={j} className="px-3 py-2.5"><div className="h-3.5 w-16 rounded bg-[hsl(220,15%,14%)] animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={12} className="text-center py-12 text-[hsl(220,10%,35%)]">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-xs">Aucune facture trouvée</p>
                  </td>
                </tr>
              ) : (
                filtered.map((inv) => (
                  <tr key={inv.id} className="border-b border-[hsl(220,15%,14%)] last:border-0 hover:bg-[hsl(220,20%,13%)] transition-colors">
                    <td className="px-3 py-2.5"><span className="font-mono font-medium text-white">{inv.invoice_number}</span></td>
                    <td className="px-3 py-2.5"><span className="font-mono text-[hsl(220,10%,50%)]">{inv.account_number || "—"}</span></td>
                    <td className="px-3 py-2.5">
                      <div className="max-w-[160px]">
                        <p className="text-white truncate">{inv.customer_name || "—"}</p>
                        <p className="text-[hsl(220,10%,40%)] text-[11px] truncate">{inv.customer_email || ""}</p>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      {inv.order_number ? <span className="font-mono text-[11px] text-blue-400">{inv.order_number}</span> : <span className="text-[hsl(220,10%,30%)]">—</span>}
                    </td>
                    <td className="px-3 py-2.5"><span className="text-[hsl(220,10%,50%)] capitalize">{inv.type}</span></td>
                    <td className="px-3 py-2.5"><span className="tabular-nums text-white font-medium">{fmtCAD(inv.total)}</span></td>
                    <td className="px-3 py-2.5"><span className="tabular-nums text-emerald-400">{fmtCAD(inv.amount_paid)}</span></td>
                    <td className="px-3 py-2.5">
                      <span className={`tabular-nums font-medium ${(inv.balance_due ?? 0) > 0 ? "text-red-400" : "text-[hsl(220,10%,40%)]"}`}>{fmtCAD(inv.balance_due)}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge label={STATUS_LABELS[inv.status ?? ""] || inv.status || "—"} variant={statusToVariant(inv.status ?? "")} size="sm" />
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap"><span className="text-[hsl(220,10%,45%)]">{fmtDate(inv.due_date)}</span></td>
                    <td className="px-3 py-2.5 whitespace-nowrap"><span className="text-[hsl(220,10%,45%)]">{fmtDate(inv.created_at)}</span></td>
                    <td className="px-3 py-2.5">
                      <Link to={`/core/invoices/${inv.id}`}>
                        <button className="h-7 w-7 flex items-center justify-center rounded-md border border-[hsl(220,15%,20%)] text-[hsl(220,10%,50%)] hover:text-white hover:border-emerald-500/40 transition-colors">
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {!isLoading && filtered.length > 0 && (
        <p className="text-[11px] text-[hsl(220,10%,30%)] text-center">
          {filtered.length} facture{filtered.length !== 1 ? "s" : ""} affichée{filtered.length !== 1 ? "s" : ""}
          {(search || statusFilter) && ` sur ${stats.total}`}
        </p>
      )}
    </div>
  );
};

export default InvoicesPage;
