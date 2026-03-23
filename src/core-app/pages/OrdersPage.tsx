/**
 * OrdersPage — Nivra Core operations hub for orders.
 * Professional telecom operations console with priority indicators,
 * order age, revenue KPIs, and advanced filtering.
 */
import { useState, useMemo } from "react";
import { useAdminOrders } from "@/core-app/hooks/useAdminOrders";
import { StatusBadge, statusToVariant } from "@/core-app/components/ui/StatusBadge";
import { Link, useNavigate } from "react-router-dom";
import { corePath } from "@/core-app/lib/corePaths";
import type { EnvironmentFilter } from "@/core-app/hooks/useEnvironmentFilter";
import { CoreEnvironmentToggle, TestBadge } from "@/core-app/components/CoreEnvironmentToggle";
import {
  Search, ArrowRight, ShoppingCart, RefreshCw,
  Clock, AlertTriangle, TrendingUp, Pause,
  ArrowUpDown, ChevronUp, ChevronDown, Zap, DollarSign
} from "lucide-react";
import { format, differenceInHours, differenceInDays } from "date-fns";
import { fr } from "date-fns/locale";

const STATUS_FILTERS = [
  { label: "Tous", value: "" },
  { label: "Pending", value: "pending" },
  { label: "Validated", value: "validated" },
  { label: "Paid", value: "paid" },
  { label: "Processing", value: "processing" },
  { label: "Shipped", value: "shipped" },
  { label: "Delivered", value: "delivered" },
  { label: "Activated", value: "activated" },
  { label: "Completed", value: "completed" },
  { label: "On Hold", value: "on_hold" },
  { label: "Cancelled", value: "cancelled" },
];

type SortKey = "created_at" | "total_amount" | "status" | "order_number";
type SortDir = "asc" | "desc";

/** Calculate order age and urgency level */
function getOrderAge(createdAt: string): { label: string; urgency: "normal" | "warning" | "critical" } {
  const hours = differenceInHours(new Date(), new Date(createdAt));
  const days = differenceInDays(new Date(), new Date(createdAt));

  if (days >= 7) return { label: `${days}j`, urgency: "critical" };
  if (days >= 3) return { label: `${days}j`, urgency: "warning" };
  if (hours >= 24) return { label: `${days}j`, urgency: "normal" };
  return { label: `${hours}h`, urgency: "normal" };
}

function getPriorityIndicator(order: any): { level: "high" | "medium" | "low"; reasons: string[] } {
  const reasons: string[] = [];
  const hours = differenceInHours(new Date(), new Date(order.created_at));

  if (order.status === "on_hold") reasons.push("En attente");
  if (order.payment_status === "failed") reasons.push("Paiement échoué");
  if (order.risk_flags && order.risk_flags.length > 0) reasons.push("Risque");
  if (hours > 72 && !["completed", "cancelled", "activated"].includes(order.status)) reasons.push("SLA");

  if (reasons.length >= 2) return { level: "high", reasons };
  if (reasons.length === 1) return { level: "medium", reasons };
  return { level: "low", reasons: [] };
}

const OrdersPage = () => {
  const navigate = useNavigate();
  const [envFilter, setEnvFilter] = useState<EnvironmentFilter>('live');
  const { data: orders, isLoading, refetch } = useAdminOrders(envFilter);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

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
    // Sort
    list = [...list].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "created_at": cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime(); break;
        case "total_amount": cmp = (a.total_amount ?? 0) - (b.total_amount ?? 0); break;
        case "status": cmp = (a.status || "").localeCompare(b.status || ""); break;
        case "order_number": cmp = (a.order_number || "").localeCompare(b.order_number || ""); break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [orders, search, statusFilter, sortKey, sortDir]);

  const counts = useMemo(() => {
    if (!orders) return { total: 0, pending: 0, active: 0, completed: 0, onHold: 0, revenue: 0, needsAttention: 0 };
    const active = orders.filter(o => !["pending", "completed", "cancelled", "activated"].includes(o.status));
    return {
      total: orders.length,
      pending: orders.filter(o => o.status === "pending").length,
      active: active.length,
      completed: orders.filter(o => ["completed", "activated"].includes(o.status)).length,
      onHold: orders.filter(o => o.status === "on_hold").length,
      revenue: orders.reduce((s, o) => s + (o.total_amount ?? 0), 0),
      needsAttention: orders.filter(o => {
        const p = getPriorityIndicator(o);
        return p.level === "high" || p.level === "medium";
      }).length,
    };
  }, [orders]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white tracking-tight">Commandes</h1>
          <p className="text-[12px] text-[hsl(220,10%,45%)] mt-0.5">
            Hub opérationnel · {counts.total} commande{counts.total !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <CoreEnvironmentToggle value={envFilter} onChange={setEnvFilter} />
          <button onClick={() => refetch()} className="flex items-center gap-1.5 rounded-lg border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,13%)] px-3 py-1.5 text-[11px] font-medium text-[hsl(220,10%,50%)] hover:text-white hover:border-emerald-500/30 transition-colors">
            <RefreshCw className="h-3.5 w-3.5" /> Actualiser
          </button>
        </div>
      </div>

      {/* KPI strip — 6 metrics */}
      <div className="grid grid-cols-6 gap-3">
        {[
          { label: "Total", value: counts.total, icon: ShoppingCart, color: "text-white", iconBg: "bg-[hsl(220,15%,18%)]" },
          { label: "En attente", value: counts.pending, icon: Clock, color: "text-amber-400", iconBg: "bg-amber-500/10" },
          { label: "En cours", value: counts.active, icon: Zap, color: "text-sky-400", iconBg: "bg-sky-500/10" },
          { label: "On Hold", value: counts.onHold, icon: Pause, color: "text-red-400", iconBg: "bg-red-500/10" },
          { label: "Complétées", value: counts.completed, icon: TrendingUp, color: "text-emerald-400", iconBg: "bg-emerald-500/10" },
          { label: "Revenu total", value: isLoading ? "—" : counts.revenue.toLocaleString("fr-CA", { style: "currency", currency: "CAD", minimumFractionDigits: 0 }), icon: DollarSign, color: "text-emerald-400", iconBg: "bg-emerald-500/10", isString: true },
        ].map(k => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <div className={`h-6 w-6 rounded-md ${k.iconBg} flex items-center justify-center`}>
                  <Icon className={`h-3 w-3 ${k.color}`} />
                </div>
                <p className="text-[10px] uppercase tracking-wider text-[hsl(220,10%,40%)] font-medium">{k.label}</p>
              </div>
              <p className={`text-lg font-bold tabular-nums ${k.color}`}>
                {isLoading ? "—" : (k as any).isString ? k.value : k.value}
              </p>
            </div>
          );
        })}
      </div>

      {/* Alert bar if orders need attention */}
      {!isLoading && counts.needsAttention > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-2">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
          <p className="text-[11px] text-amber-400 font-medium">
            {counts.needsAttention} commande{counts.needsAttention > 1 ? "s" : ""} nécessite{counts.needsAttention > 1 ? "nt" : ""} une attention immédiate
          </p>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 flex items-center gap-2 rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] px-3 py-2">
          <Search className="h-4 w-4 text-[hsl(220,10%,40%)]" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher par numéro, client, courriel, compte, facture…"
            className="flex-1 bg-transparent text-xs text-white placeholder:text-[hsl(220,10%,35%)] outline-none"
          />
        </div>
        <div className="flex items-center gap-0.5 rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] px-1 py-1 overflow-x-auto">
          {STATUS_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap ${
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
                <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-[hsl(220,10%,38%)] whitespace-nowrap w-5">
                  {/* Priority */}
                </th>
                <SortableHeader label="N° commande" sortKey="order_number" currentSort={sortKey} currentDir={sortDir} onSort={toggleSort} />
                <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-[hsl(220,10%,38%)] whitespace-nowrap">Client</th>
                <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-[hsl(220,10%,38%)] whitespace-nowrap">Service</th>
                <SortableHeader label="Statut" sortKey="status" currentSort={sortKey} currentDir={sortDir} onSort={toggleSort} />
                <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-[hsl(220,10%,38%)] whitespace-nowrap">Paiement</th>
                <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-[hsl(220,10%,38%)] whitespace-nowrap">Facture</th>
                <SortableHeader label="Montant" sortKey="total_amount" currentSort={sortKey} currentDir={sortDir} onSort={toggleSort} />
                <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-[hsl(220,10%,38%)] whitespace-nowrap">Âge</th>
                <SortableHeader label="Date" sortKey="created_at" currentSort={sortKey} currentDir={sortDir} onSort={toggleSort} />
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-[hsl(220,15%,14%)]">
                    {Array.from({ length: 11 }).map((_, j) => (
                      <td key={j} className="px-3 py-2.5"><div className="h-3.5 w-16 rounded bg-[hsl(220,15%,14%)] animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={11} className="text-center py-12 text-[hsl(220,10%,35%)]">
                    <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-xs">{search || statusFilter ? "Aucune commande ne correspond aux filtres." : "Aucune commande trouvée."}</p>
                  </td>
                </tr>
              ) : (
                filtered.map(o => {
                  const priority = getPriorityIndicator(o);
                  const age = getOrderAge(o.created_at);

                  return (
                    <tr key={o.id} className="border-b border-[hsl(220,15%,14%)] last:border-0 hover:bg-[hsl(220,20%,13%)] transition-colors group">
                      {/* Priority indicator */}
                      <td className="px-2 py-2.5">
                        {priority.level === "high" ? (
                          <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" title={priority.reasons.join(", ")} />
                        ) : priority.level === "medium" ? (
                          <div className="h-2 w-2 rounded-full bg-amber-500" title={priority.reasons.join(", ")} />
                        ) : null}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="font-mono font-medium text-white">{o.order_number || o.id.slice(0, 8)}</span>
                        {o.environment === 'test' && <span className="ml-1.5"><TestBadge /></span>}
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
                      <td className="px-3 py-2.5">
                        <span className={`text-[11px] font-mono tabular-nums ${
                          age.urgency === "critical" ? "text-red-400" :
                          age.urgency === "warning" ? "text-amber-400" :
                          "text-[hsl(220,10%,45%)]"
                        }`}>
                          {age.label}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-[hsl(220,10%,45%)] whitespace-nowrap">{format(new Date(o.created_at), "d MMM yyyy", { locale: fr })}</td>
                      <td className="px-3 py-2.5">
                        <Link to={corePath(`/orders/${o.id}`)}>
                          <button className="h-7 w-7 flex items-center justify-center rounded-md border border-[hsl(220,15%,20%)] text-[hsl(220,10%,50%)] hover:text-white hover:border-emerald-500/40 transition-colors opacity-60 group-hover:opacity-100">
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

      {!isLoading && filtered.length > 0 && (
        <p className="text-[11px] text-[hsl(220,10%,30%)] text-center">
          {filtered.length} commande{filtered.length !== 1 ? "s" : ""} affichée{filtered.length !== 1 ? "s" : ""}
          {(search || statusFilter) && ` sur ${counts.total}`}
        </p>
      )}
    </div>
  );
};

/* ─── Sortable header cell ─── */
function SortableHeader({ label, sortKey, currentSort, currentDir, onSort }: {
  label: string; sortKey: SortKey; currentSort: SortKey; currentDir: SortDir; onSort: (key: SortKey) => void;
}) {
  const isActive = currentSort === sortKey;
  return (
    <th className="text-left px-3 py-2.5 whitespace-nowrap">
      <button
        onClick={() => onSort(sortKey)}
        className={`flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
          isActive ? "text-emerald-400" : "text-[hsl(220,10%,38%)] hover:text-[hsl(220,10%,55%)]"
        }`}
      >
        {label}
        {isActive ? (
          currentDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-2.5 w-2.5 opacity-40" />
        )}
      </button>
    </th>
  );
}

export default OrdersPage;
