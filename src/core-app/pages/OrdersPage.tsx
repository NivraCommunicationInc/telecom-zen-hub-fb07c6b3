/**
 * OrdersPage — Nivra Core orders list.
 * Reuses useAdminOrders hook (same data source as /admin/orders).
 */
import { useState, useMemo } from "react";
import { useAdminOrders } from "@/hooks/admin/useAdminOrders";
import { StatusBadge, statusToVariant } from "@/components/admin/ui/StatusBadge";
import { Link } from "react-router-dom";
import type { EnvironmentFilter } from "@/hooks/admin/useEnvironmentFilter";
import { CoreEnvironmentToggle, TestBadge } from "@/core-app/components/CoreEnvironmentToggle";
import { Search, ArrowRight, ShoppingCart, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const STATUS_FILTERS = [
  { label: "Tous", value: "" },
  { label: "Pending", value: "pending" },
  { label: "Validated", value: "validated" },
  { label: "Paid", value: "paid" },
  { label: "Shipped", value: "shipped" },
  { label: "Delivered", value: "delivered" },
  { label: "Completed", value: "completed" },
  { label: "On Hold", value: "on_hold" },
  { label: "Cancelled", value: "cancelled" },
];

const OrdersPage = () => {
  const [envFilter, setEnvFilter] = useState<EnvironmentFilter>('live');
  const { data: orders, isLoading, refetch } = useAdminOrders(envFilter);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const filtered = useMemo(() => {
    if (!orders) return [];
    let list = orders;
    if (statusFilter) list = list.filter(o => o.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(o =>
        (o.order_number?.toLowerCase().includes(q)) ||
        (o.client_full_name?.toLowerCase().includes(q)) ||
        (o.client_email?.toLowerCase().includes(q)) ||
        (o.account_number?.toLowerCase().includes(q)) ||
        (o.invoice_number?.toLowerCase().includes(q))
      );
    }
    return list;
  }, [orders, search, statusFilter]);

  const counts = useMemo(() => {
    if (!orders) return { total: 0, pending: 0, active: 0, completed: 0 };
    return {
      total: orders.length,
      pending: orders.filter(o => o.status === "pending").length,
      active: orders.filter(o => !["pending", "completed", "cancelled"].includes(o.status)).length,
      completed: orders.filter(o => o.status === "completed").length,
    };
  }, [orders]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white tracking-tight">Commandes</h1>
          <p className="text-[12px] text-[hsl(220,10%,45%)] mt-0.5">
            Gestion des commandes · {counts.total} commande{counts.total !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <CoreEnvironmentToggle value={envFilter} onChange={setEnvFilter} />
          <button onClick={() => refetch()} className="flex items-center gap-1.5 rounded-lg border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,13%)] px-3 py-1.5 text-[11px] font-medium text-[hsl(220,10%,50%)] hover:text-white hover:border-emerald-500/30 transition-colors">
            <RefreshCw className="h-3.5 w-3.5" /> Actualiser
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total", value: counts.total, color: "text-white" },
          { label: "En attente", value: counts.pending, color: "text-amber-400" },
          { label: "En cours", value: counts.active, color: "text-sky-400" },
          { label: "Complétées", value: counts.completed, color: "text-emerald-400" },
        ].map(k => (
          <div key={k.label} className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-3">
            <p className="text-[10px] uppercase tracking-wider text-[hsl(220,10%,40%)] font-medium">{k.label}</p>
            <p className={`text-lg font-bold tabular-nums mt-1 ${k.color}`}>{isLoading ? "—" : k.value}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 flex items-center gap-2 rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] px-3 py-2">
          <Search className="h-4 w-4 text-[hsl(220,10%,40%)]" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher par numéro, client, courriel, compte…"
            className="flex-1 bg-transparent text-xs text-white placeholder:text-[hsl(220,10%,35%)] outline-none"
          />
        </div>
        <div className="flex items-center gap-0.5 rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] px-1 py-1">
          {STATUS_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                statusFilter === f.value
                  ? "bg-emerald-600/20 text-emerald-400"
                  : "text-[hsl(220,10%,45%)] hover:text-white"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[hsl(220,15%,16%)]">
                {["N° commande", "Client", "Service", "Statut", "Paiement", "Facture", "Montant", "Date", ""].map(h => (
                  <th key={h} className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-[hsl(220,10%,38%)] whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-[hsl(220,15%,14%)]">
                    {Array.from({ length: 9 }).map((_, j) => (
                      <td key={j} className="px-3 py-2.5"><div className="h-3.5 w-16 rounded bg-[hsl(220,15%,14%)] animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-[hsl(220,10%,35%)]">
                    <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-xs">{search || statusFilter ? "Aucune commande ne correspond aux filtres." : "Aucune commande trouvée."}</p>
                  </td>
                </tr>
              ) : (
                filtered.map(o => (
                  <tr key={o.id} className="border-b border-[hsl(220,15%,14%)] last:border-0 hover:bg-[hsl(220,20%,13%)] transition-colors">
                    <td className="px-3 py-2.5">
                      <span className="font-mono font-medium text-white">{o.order_number || o.id.slice(0, 8)}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="max-w-[160px]">
                        <p className="text-white truncate">{o.client_full_name || "—"}</p>
                        {o.account_number && <p className="text-[11px] text-[hsl(220,10%,40%)] font-mono">#{o.account_number}</p>}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-[hsl(220,10%,55%)]">{o.service_type || "—"}</td>
                    <td className="px-3 py-2.5"><StatusBadge label={o.status} variant={statusToVariant(o.status)} size="sm" /></td>
                    <td className="px-3 py-2.5">
                      {o.payment_status ? <StatusBadge label={o.payment_status} variant={statusToVariant(o.payment_status)} size="sm" /> : <span className="text-[hsl(220,10%,30%)]">—</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      {o.invoice_number ? <span className="font-mono text-[11px] text-emerald-400">#{o.invoice_number}</span> : <span className="text-[hsl(220,10%,30%)]">—</span>}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-[hsl(220,10%,70%)]">
                      {o.total_amount != null ? o.total_amount.toLocaleString("fr-CA", { style: "currency", currency: "CAD" }) : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-[hsl(220,10%,45%)] whitespace-nowrap">{format(new Date(o.created_at), "d MMM yyyy", { locale: fr })}</td>
                    <td className="px-3 py-2.5">
                      <Link to={`/core/orders/${o.id}`}>
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
          {filtered.length} commande{filtered.length !== 1 ? "s" : ""} affichée{filtered.length !== 1 ? "s" : ""}
          {(search || statusFilter) && ` sur ${counts.total}`}
        </p>
      )}
    </div>
  );
};

export default OrdersPage;
