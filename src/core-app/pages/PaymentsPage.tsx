/**
 * Nivra Core — Payments (ops-grade)
 * Reuses useAdminPayments hook — zero duplicated business logic.
 */
import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useAdminPayments, AdminPayment } from "@/hooks/admin/useAdminPayments";
import { StatusBadge, statusToVariant } from "@/components/admin/ui/StatusBadge";
import { Search, Wallet, RefreshCw, Eye, Filter } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente", confirmed: "Confirmé", failed: "Échoué",
};
const METHOD_LABELS: Record<string, string> = {
  interac: "Interac", paypal: "PayPal", manual: "Manuel",
};
const STATUS_OPTIONS = Object.entries(STATUS_LABELS);
const METHOD_OPTIONS = Object.entries(METHOD_LABELS);

const fmtCAD = (n: number | null) => (n != null ? `${n.toFixed(2)} $` : "—");
const fmtDate = (d: string | null) => {
  if (!d) return "—";
  try { return format(new Date(d), "d MMM yyyy", { locale: fr }); } catch { return "—"; }
};

const PaymentsPage = () => {
  const { data: payments = [], isLoading, refetch } = useAdminPayments();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [methodFilter, setMethodFilter] = useState("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return payments.filter((p) => {
      if (statusFilter && p.status !== statusFilter) return false;
      if (methodFilter && p.method !== methodFilter) return false;
      if (!q) return true;
      return (
        p.payment_number?.toLowerCase().includes(q) ||
        p.customer_name?.toLowerCase().includes(q) ||
        p.customer_email?.toLowerCase().includes(q) ||
        p.account_number?.toLowerCase().includes(q) ||
        p.invoice_number?.toLowerCase().includes(q) ||
        p.reference?.toLowerCase().includes(q)
      );
    });
  }, [payments, search, statusFilter, methodFilter]);

  const stats = useMemo(() => {
    const total = payments.length;
    const confirmed = payments.filter(p => p.status === "confirmed").length;
    const pending = payments.filter(p => p.status === "pending").length;
    const failed = payments.filter(p => p.status === "failed").length;
    return { total, confirmed, pending, failed };
  }, [payments]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Paiements</h1>
          <p className="text-[13px] text-[hsl(220,10%,50%)] mt-0.5">
            Billing V2 · {filtered.length} résultat{filtered.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1.5 rounded-lg border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,13%)] px-3 py-1.5 text-[12px] text-[hsl(220,10%,55%)] hover:text-white transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Actualiser
        </button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total", value: stats.total, color: "text-white" },
          { label: "Confirmés", value: stats.confirmed, color: "text-emerald-400" },
          { label: "En attente", value: stats.pending, color: "text-amber-400" },
          { label: "Échoués", value: stats.failed, color: "text-red-400" },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-4">
            <p className="text-[11px] uppercase tracking-wider text-[hsl(220,10%,40%)]">{s.label}</p>
            <p className={`text-lg font-semibold mt-1 ${s.color}`}>{isLoading ? "…" : s.value}</p>
          </div>
        ))}
      </div>

      {/* Search + Filters */}
      <div className="flex items-center gap-3">
        <div className="flex-1 flex items-center gap-2 rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] px-3 py-2">
          <Search className="h-4 w-4 text-[hsl(220,10%,40%)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par #paiement, client, facture, référence…"
            className="flex-1 bg-transparent text-[13px] text-white placeholder:text-[hsl(220,10%,35%)] outline-none"
          />
        </div>
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="appearance-none rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] px-3 py-2 pr-8 text-[13px] text-[hsl(220,10%,55%)] outline-none cursor-pointer"
          >
            <option value="">Tous les statuts</option>
            {STATUS_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <Filter className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[hsl(220,10%,40%)] pointer-events-none" />
        </div>
        <div className="relative">
          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            className="appearance-none rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] px-3 py-2 pr-8 text-[13px] text-[hsl(220,10%,55%)] outline-none cursor-pointer"
          >
            <option value="">Toutes méthodes</option>
            {METHOD_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <Wallet className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[hsl(220,10%,40%)] pointer-events-none" />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[hsl(220,15%,16%)]">
                {["Paiement", "Compte", "Client", "Facture", "Méthode", "Montant", "Statut", "Référence", "Reçu le", "Confirmé par", ""].map((h) => (
                  <th key={h} className="text-left px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[hsl(220,10%,40%)] whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-[hsl(220,15%,14%)]">
                    {Array.from({ length: 11 }).map((_, j) => (
                      <td key={j} className="px-3 py-2.5">
                        <div className="h-3.5 w-16 rounded bg-[hsl(220,15%,14%)] animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={11} className="text-center py-12 text-[hsl(220,10%,35%)]">
                    <Wallet className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    Aucun paiement trouvé
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr key={p.id} className="border-b border-[hsl(220,15%,14%)] last:border-0 hover:bg-[hsl(220,20%,13%)] transition-colors">
                    <td className="px-3 py-2.5">
                      <span className="font-mono font-medium text-white text-xs">{p.payment_number}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="font-mono text-[hsl(220,10%,50%)] text-xs">{p.account_number || "—"}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="max-w-[150px]">
                        <p className="text-white text-xs truncate">{p.customer_name || "—"}</p>
                        <p className="text-[hsl(220,10%,40%)] text-[11px] truncate">{p.customer_email || ""}</p>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      {p.invoice_number ? (
                        <span className="font-mono text-xs text-blue-400">{p.invoice_number}</span>
                      ) : (
                        <span className="text-[hsl(220,10%,30%)] text-xs">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-[hsl(220,10%,55%)] text-xs">{METHOD_LABELS[p.method] || p.method}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="tabular-nums text-emerald-400 text-xs font-medium">{fmtCAD(p.amount)}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge
                        label={STATUS_LABELS[p.status ?? ""] || p.status || "—"}
                        variant={statusToVariant(p.status ?? "")}
                        size="sm"
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="font-mono text-[hsl(220,10%,45%)] text-[11px] truncate max-w-[120px] block">
                        {p.reference || p.provider_payment_id || "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className="text-[hsl(220,10%,45%)] text-xs">{fmtDate(p.received_at)}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-[hsl(220,10%,45%)] text-xs truncate max-w-[100px] block">
                        {p.confirmed_by || p.created_by_name || "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <Link to={`/admin/invoices/${p.invoice_id}`}>
                        <button className="flex items-center gap-1 rounded border border-[hsl(220,15%,20%)] bg-[hsl(220,20%,14%)] px-2 py-1 text-[11px] text-[hsl(220,10%,55%)] hover:text-white transition-colors">
                          <Eye className="h-3 w-3" /> Voir
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
    </div>
  );
};

export default PaymentsPage;
