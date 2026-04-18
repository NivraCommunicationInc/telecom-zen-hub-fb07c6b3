/**
 * OrdersPage — Nivra Core ops queue.
 * Dark professional console with SLA KPIs, priority indicators,
 * pill "Traiter" CTA per row, red left-border on overdue.
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
  ArrowUpDown, ChevronUp, ChevronDown, Zap, DollarSign, ShieldCheck, Timer
} from "lucide-react";
import { format, differenceInHours, differenceInDays, differenceInMinutes } from "date-fns";
import { fr } from "date-fns/locale";

/** PHASE C: SLA badge config based on deadline + status */
function getSlaBadge(deadline: string | null, status: string | null, orderStatus: string): {
  label: string; className: string; urgency: "ok" | "warning" | "overdue" | "done";
} | null {
  if (["activated", "completed", "cancelled", "installation_completed", "delivered"].includes(orderStatus)) {
    return null;
  }
  if (!deadline) return null;

  const now = new Date();
  const dl = new Date(deadline);
  const minsLeft = differenceInMinutes(dl, now);

  if (status === "overdue" || minsLeft < 0) {
    const overdue = Math.abs(minsLeft);
    const label = overdue >= 60 ? `DÉPASSÉ ${Math.floor(overdue / 60)}h` : `DÉPASSÉ ${overdue}min`;
    return { label, className: "bg-core-danger/15 text-core-danger border-core-danger/30", urgency: "overdue" };
  }
  if (minsLeft < 60 || status === "warning") {
    return { label: `${minsLeft} min`, className: "bg-core-warning/15 text-core-warning border-core-warning/30", urgency: "warning" };
  }
  const hoursLeft = Math.floor(minsLeft / 60);
  const remainMins = minsLeft % 60;
  const label = hoursLeft > 0 ? `${hoursLeft}h${remainMins > 0 ? remainMins.toString().padStart(2, "0") : ""}` : `${minsLeft}min`;
  return { label: `${label} restantes`, className: "bg-core-success/15 text-core-success border-core-success/30", urgency: "ok" };
}

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

type SortKey = "created_at" | "total_amount" | "status" | "order_number" | "sla";
type SortDir = "asc" | "desc";

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

function getKycBadge(status: string | null | undefined): { label: string; icon: string; className: string } | null {
  switch (status) {
    case "pending":   return { label: "KYC Demandé",  icon: "🟡", className: "bg-core-warning/15 text-core-warning border-core-warning/25" };
    case "completed": return { label: "KYC Complété", icon: "🟠", className: "bg-orange-500/15 text-orange-400 border-orange-500/25" };
    case "approved":  return { label: "KYC Approuvé", icon: "✅", className: "bg-core-success/15 text-core-success border-core-success/25" };
    case "rejected":  return { label: "KYC Rejeté",   icon: "❌", className: "bg-core-danger/15 text-core-danger border-core-danger/25" };
    default: return null;
  }
}

const OrdersPage = () => {
  const navigate = useNavigate();
  const [envFilter, setEnvFilter] = useState<EnvironmentFilter>('live');
  const { data: orders, isLoading, refetch } = useAdminOrders(envFilter);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("sla");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir(key === "sla" ? "asc" : "desc"); }
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
    list = [...list].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "created_at":  cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime(); break;
        case "total_amount": cmp = (a.total_amount ?? 0) - (b.total_amount ?? 0); break;
        case "status":       cmp = (a.status || "").localeCompare(b.status || ""); break;
        case "order_number": cmp = (a.order_number || "").localeCompare(b.order_number || ""); break;
        case "sla": {
          // SLA ascending = most urgent first (overdue, then nearest deadline)
          const da = a.sla_deadline ? new Date(a.sla_deadline).getTime() : Number.POSITIVE_INFINITY;
          const db = b.sla_deadline ? new Date(b.sla_deadline).getTime() : Number.POSITIVE_INFINITY;
          cmp = da - db;
          break;
        }
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [orders, search, statusFilter, sortKey, sortDir]);

  const counts = useMemo(() => {
    if (!orders) return { total: 0, pending: 0, active: 0, completed: 0, onHold: 0, revenue: 0, needsAttention: 0, slaOnTime: 0, slaWarning: 0, slaOverdue: 0 };
    const active = orders.filter(o => !["pending", "completed", "cancelled", "activated"].includes(o.status));
    const terminal = ["activated", "completed", "cancelled", "installation_completed", "delivered"];
    const slaTracked = orders.filter(o => o.sla_deadline && !terminal.includes(o.status));
    const now = Date.now();
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
      slaOnTime: slaTracked.filter(o => {
        const dl = new Date(o.sla_deadline!).getTime();
        return o.sla_status !== "overdue" && dl - now > 60 * 60 * 1000;
      }).length,
      slaWarning: slaTracked.filter(o => {
        const dl = new Date(o.sla_deadline!).getTime();
        const minsLeft = (dl - now) / 60000;
        return o.sla_status === "warning" || (minsLeft >= 0 && minsLeft < 60);
      }).length,
      slaOverdue: slaTracked.filter(o => {
        const dl = new Date(o.sla_deadline!).getTime();
        return o.sla_status === "overdue" || dl < now;
      }).length,
    };
  }, [orders]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-core-fg tracking-tight">Commandes</h1>
          <p className="text-[12px] text-core-muted mt-0.5">
            Hub opérationnel · {counts.total} commande{counts.total !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <CoreEnvironmentToggle value={envFilter} onChange={setEnvFilter} />
          <button onClick={() => refetch()} className="inline-flex items-center gap-1.5 rounded-full border border-core-border bg-core-card px-3.5 py-1.5 text-[11px] font-medium text-core-muted hover:text-core-fg hover:border-core-accent/40 transition-colors">
            <RefreshCw className="h-3.5 w-3.5" /> Actualiser
          </button>
        </div>
      </div>

      {/* PHASE C: SLA tracking strip — 3 PROMINENT KPIs (top of page) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[
          { label: "Dans les délais", value: counts.slaOnTime, icon: ShieldCheck, color: "text-core-success", iconBg: "bg-core-success/10", borderColor: "border-core-success/25", glow: "shadow-[0_0_24px_-12px_hsl(var(--core-success)/0.3)]" },
          { label: "À risque (< 1h)", value: counts.slaWarning, icon: Clock, color: "text-core-warning", iconBg: "bg-core-warning/10", borderColor: "border-core-warning/30", glow: "shadow-[0_0_24px_-12px_hsl(var(--core-warning)/0.4)]" },
          { label: "En retard (SLA)", value: counts.slaOverdue, icon: Timer, color: "text-core-danger", iconBg: "bg-core-danger/10", borderColor: "border-core-danger/40", glow: "shadow-[0_0_28px_-10px_hsl(var(--core-danger)/0.5)]" },
        ].map(k => {
          const Icon = k.icon;
          return (
            <div key={k.label} className={`rounded-xl border ${k.borderColor} bg-core-card ${k.glow} p-4`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={`h-7 w-7 rounded-lg ${k.iconBg} flex items-center justify-center`}>
                    <Icon className={`h-3.5 w-3.5 ${k.color}`} />
                  </div>
                  <p className="text-[11px] uppercase tracking-wider text-core-muted font-semibold">{k.label}</p>
                </div>
              </div>
              <p className={`text-2xl font-bold tabular-nums ${k.color}`}>
                {isLoading ? "—" : k.value}
              </p>
            </div>
          );
        })}
      </div>

      {/* Secondary KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {[
          { label: "Total", value: counts.total, icon: ShoppingCart, color: "text-core-fg", iconBg: "bg-core-border" },
          { label: "En attente", value: counts.pending, icon: Clock, color: "text-core-warning", iconBg: "bg-core-warning/10" },
          { label: "En cours", value: counts.active, icon: Zap, color: "text-core-accent", iconBg: "bg-core-accent/10" },
          { label: "On Hold", value: counts.onHold, icon: Pause, color: "text-core-danger", iconBg: "bg-core-danger/10" },
          { label: "Complétées", value: counts.completed, icon: TrendingUp, color: "text-core-success", iconBg: "bg-core-success/10" },
          { label: "Revenu total", value: isLoading ? "—" : counts.revenue.toLocaleString("fr-CA", { style: "currency", currency: "CAD", minimumFractionDigits: 0 }), icon: DollarSign, color: "text-core-success", iconBg: "bg-core-success/10", isString: true },
        ].map(k => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="rounded-lg border border-core-border bg-core-card p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <div className={`h-6 w-6 rounded-md ${k.iconBg} flex items-center justify-center`}>
                  <Icon className={`h-3 w-3 ${k.color}`} />
                </div>
                <p className="text-[10px] uppercase tracking-wider text-core-muted font-medium">{k.label}</p>
              </div>
              <p className={`text-lg font-bold tabular-nums ${k.color}`}>
                {isLoading ? "—" : (k as any).isString ? k.value : k.value}
              </p>
            </div>
          );
        })}
      </div>

      {/* Alert bar */}
      {!isLoading && counts.needsAttention > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-core-warning/25 bg-core-warning/5 px-4 py-2">
          <AlertTriangle className="h-3.5 w-3.5 text-core-warning shrink-0" />
          <p className="text-[11px] text-core-warning font-medium">
            {counts.needsAttention} commande{counts.needsAttention > 1 ? "s" : ""} nécessite{counts.needsAttention > 1 ? "nt" : ""} une attention immédiate
          </p>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
        <div className="flex-1 flex items-center gap-2 rounded-lg border border-core-border bg-core-card px-3 py-2">
          <Search className="h-4 w-4 text-core-muted" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher par numéro, client, courriel, compte, facture…"
            className="flex-1 bg-transparent text-xs text-core-fg placeholder:text-core-muted-soft outline-none"
          />
        </div>
        <div className="flex items-center gap-0.5 rounded-lg border border-core-border bg-core-card px-1 py-1 overflow-x-auto">
          {STATUS_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap ${
                statusFilter === f.value
                  ? "bg-core-accent/20 text-core-accent"
                  : "text-core-muted hover:text-core-fg"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-core-border bg-core-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-core-border bg-core-bg/40">
                <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-core-muted whitespace-nowrap w-5" />
                <SortableHeader label="N° commande" sortKey="order_number" currentSort={sortKey} currentDir={sortDir} onSort={toggleSort} />
                <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-core-muted whitespace-nowrap">Client</th>
                <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-core-muted whitespace-nowrap">Service</th>
                <SortableHeader label="Statut" sortKey="status" currentSort={sortKey} currentDir={sortDir} onSort={toggleSort} />
                <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-core-muted whitespace-nowrap">KYC</th>
                <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-core-muted whitespace-nowrap">Paiement</th>
                <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-core-muted whitespace-nowrap">Facture</th>
                <SortableHeader label="Montant" sortKey="total_amount" currentSort={sortKey} currentDir={sortDir} onSort={toggleSort} />
                <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-core-muted whitespace-nowrap">Âge</th>
                <SortableHeader label="SLA" sortKey="sla" currentSort={sortKey} currentDir={sortDir} onSort={toggleSort} />
                <SortableHeader label="Date" sortKey="created_at" currentSort={sortKey} currentDir={sortDir} onSort={toggleSort} />
                <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-core-muted whitespace-nowrap">Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-core-border/50">
                    {Array.from({ length: 13 }).map((_, j) => (
                      <td key={j} className="px-3 py-3"><div className="h-3.5 w-16 rounded bg-core-border animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={13} className="text-center py-12 text-core-muted">
                    <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-xs">{search || statusFilter ? "Aucune commande ne correspond aux filtres." : "Aucune commande trouvée."}</p>
                  </td>
                </tr>
              ) : (
                filtered.map(o => {
                  const priority = getPriorityIndicator(o);
                  const age = getOrderAge(o.created_at);
                  const sla = getSlaBadge(o.sla_deadline, o.sla_status, o.status);
                  const isOverdue = sla?.urgency === "overdue";

                  return (
                    <tr
                      key={o.id}
                      onClick={() => navigate(corePath(`/orders/${o.id}`))}
                      className={`border-b border-core-border/50 last:border-0 hover:bg-core-card-raised transition-colors group cursor-pointer ${
                        isOverdue ? "border-l-[3px] border-l-core-danger" : "border-l-[3px] border-l-transparent"
                      }`}
                    >
                      <td className="px-2 py-3">
                        {priority.level === "high" ? (
                          <div className="h-2 w-2 rounded-full bg-core-danger animate-pulse" title={priority.reasons.join(", ")} />
                        ) : priority.level === "medium" ? (
                          <div className="h-2 w-2 rounded-full bg-core-warning" title={priority.reasons.join(", ")} />
                        ) : null}
                      </td>
                      <td className="px-3 py-3">
                        <span className="font-mono font-semibold text-core-fg">{o.order_number || o.id.slice(0, 8)}</span>
                        {o.environment === 'test' && <span className="ml-1.5"><TestBadge /></span>}
                      </td>
                      <td className="px-3 py-3">
                        <div className="max-w-[160px]">
                          <p className="text-core-fg truncate">{o.client_full_name || "—"}</p>
                          {o.account_number && <p className="text-[11px] text-core-muted font-mono">#{o.account_number}</p>}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-core-muted">{o.service_type || "—"}</td>
                      <td className="px-3 py-3"><StatusBadge label={o.status} variant={statusToVariant(o.status)} size="sm" /></td>
                      <td className="px-3 py-3">
                        {(() => {
                          const kyc = getKycBadge(o.kyc_status);
                          return kyc ? (
                            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap ${kyc.className}`}>
                              <span>{kyc.icon}</span>{kyc.label}
                            </span>
                          ) : <span className="text-core-muted-soft">—</span>;
                        })()}
                      </td>
                      <td className="px-3 py-3">
                        {o.payment_status ? <StatusBadge label={o.payment_status} variant={statusToVariant(o.payment_status)} size="sm" /> : <span className="text-core-muted-soft">—</span>}
                      </td>
                      <td className="px-3 py-3">
                        {o.invoice_number ? <span className="font-mono text-[11px] text-core-success">#{o.invoice_number}</span> : <span className="text-core-muted-soft">—</span>}
                      </td>
                      <td className="px-3 py-3 tabular-nums text-core-fg/80">
                        {o.total_amount != null ? o.total_amount.toLocaleString("fr-CA", { style: "currency", currency: "CAD" }) : "—"}
                      </td>
                      <td className="px-3 py-3">
                        <span className={`text-[11px] font-mono tabular-nums ${
                          age.urgency === "critical" ? "text-core-danger" :
                          age.urgency === "warning" ? "text-core-warning" :
                          "text-core-muted"
                        }`}>
                          {age.label}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        {sla ? (
                          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap ${sla.className}`}>
                            <Timer className="h-2.5 w-2.5" />
                            {sla.label}
                          </span>
                        ) : <span className="text-core-muted-soft">—</span>}
                      </td>
                      <td className="px-3 py-3 text-core-muted whitespace-nowrap">{format(new Date(o.created_at), "d MMM yyyy", { locale: fr })}</td>
                      <td className="px-3 py-3 text-right">
                        <Link to={corePath(`/orders/${o.id}`)} onClick={(e) => e.stopPropagation()}>
                          <button className="inline-flex items-center gap-1.5 rounded-full bg-core-accent/15 border border-core-accent/30 px-3 py-1.5 text-[11px] font-semibold text-core-accent hover:bg-core-accent hover:text-white transition-all">
                            Traiter
                            <ArrowRight className="h-3 w-3" />
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
        <p className="text-[11px] text-core-muted-soft text-center">
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
          isActive ? "text-core-accent" : "text-core-muted hover:text-core-fg"
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
