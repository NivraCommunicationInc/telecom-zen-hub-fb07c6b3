/**
 * Nivra Core — Subscriptions (ops-grade)
 * Reuses useAdminSubscriptions hook — zero duplicated business logic.
 */
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAdminSubscriptions } from "@/hooks/admin/useAdminSubscriptions";
import { StatusBadge, statusToVariant } from "@/components/admin/ui/StatusBadge";
import { Search, RefreshCw, Filter, Repeat, Zap } from "lucide-react";
import type { EnvironmentFilter } from "@/hooks/admin/useEnvironmentFilter";
import { CoreEnvironmentToggle, TestBadge } from "@/core-app/components/CoreEnvironmentToggle";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const STATUS_LABELS: Record<string, string> = {
  active: "Actif", pending: "En attente", suspended: "Suspendu", cancelled: "Annulé",
};
const CATEGORY_LABELS: Record<string, string> = {
  mobile: "Mobile", internet: "Internet", tv: "Télévision", combo: "Combo", security: "Sécurité",
};
const STATUS_OPTIONS = Object.entries(STATUS_LABELS);

const fmtCAD = (n: number | null) => (n != null ? `${n.toFixed(2)} $` : "—");
const fmtDate = (d: string | null) => {
  if (!d) return "—";
  try { return format(new Date(d), "d MMM yyyy", { locale: fr }); } catch { return "—"; }
};

const SubscriptionsPage = () => {
  const [envFilter, setEnvFilter] = useState<EnvironmentFilter>('live');
  const { data: subs = [], isLoading, refetch } = useAdminSubscriptions(envFilter);
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return subs.filter((s) => {
      if (statusFilter && s.status !== statusFilter) return false;
      if (!q) return true;
      return (
        s.plan_name?.toLowerCase().includes(q) ||
        s.plan_code?.toLowerCase().includes(q) ||
        s.client_name?.toLowerCase().includes(q) ||
        s.client_email?.toLowerCase().includes(q) ||
        s.account_number?.toLowerCase().includes(q) ||
        s.service_category?.toLowerCase().includes(q)
      );
    });
  }, [subs, search, statusFilter]);

  const stats = useMemo(() => ({
    total: subs.length,
    active: subs.filter(s => s.status === "active").length,
    pending: subs.filter(s => s.status === "pending").length,
    suspended: subs.filter(s => s.status === "suspended" || s.status === "cancelled").length,
  }), [subs]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white tracking-tight">Abonnements</h1>
          <p className="text-[12px] text-[hsl(220,10%,45%)] mt-0.5">
            Gestion des abonnements · {stats.total} abonnement{stats.total !== 1 ? "s" : ""}
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
          { label: "Actifs", value: stats.active, color: "text-emerald-400" },
          { label: "En attente", value: stats.pending, color: "text-amber-400" },
          { label: "Suspendus / Annulés", value: stats.suspended, color: "text-red-400" },
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
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher par plan, client, compte, catégorie…" className="flex-1 bg-transparent text-xs text-white placeholder:text-[hsl(220,10%,35%)] outline-none" />
        </div>
        <div className="relative">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="appearance-none rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] px-3 py-2 pr-8 text-xs text-[hsl(220,10%,55%)] outline-none cursor-pointer">
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
                {["Compte", "Client", "Plan", "Catégorie", "Prix/mois", "Statut", "Cycle début", "Cycle fin", "Auto-billing", "Commande", "Créé le"].map((h) => (
                  <th key={h} className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-[hsl(220,10%,38%)] whitespace-nowrap">{h}</th>
                ))}
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
                    <Repeat className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-xs">Aucun abonnement trouvé</p>
                  </td>
                </tr>
              ) : (
                filtered.map((s) => (
                  <tr key={s.id} className="border-b border-[hsl(220,15%,14%)] last:border-0 hover:bg-[hsl(220,20%,13%)] transition-colors cursor-pointer" onClick={() => navigate(`/core/subscriptions/${s.id}`)}>
                    <td className="px-3 py-2.5"><span className="font-mono text-[hsl(220,10%,50%)]">{s.account_number || "—"}</span></td>
                    <td className="px-3 py-2.5">
                      <div className="max-w-[150px]">
                        <p className="text-white truncate">{s.client_name || "—"}</p>
                        <p className="text-[hsl(220,10%,40%)] text-[11px] truncate">{s.client_email || ""}</p>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <p className="text-white font-medium truncate max-w-[180px]">{s.plan_name}</p>
                      <p className="text-[hsl(220,10%,40%)] text-[11px] font-mono">{s.plan_code}</p>
                    </td>
                    <td className="px-3 py-2.5"><span className="text-[hsl(220,10%,55%)]">{CATEGORY_LABELS[s.service_category ?? ""] || s.service_category || "—"}</span></td>
                    <td className="px-3 py-2.5"><span className="tabular-nums text-emerald-400 font-medium">{fmtCAD(s.plan_price)}</span></td>
                    <td className="px-3 py-2.5">
                      <StatusBadge label={STATUS_LABELS[s.status ?? ""] || s.status || "—"} variant={statusToVariant(s.status ?? "")} size="sm" />
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap"><span className="text-[hsl(220,10%,45%)]">{fmtDate(s.cycle_start_date)}</span></td>
                    <td className="px-3 py-2.5 whitespace-nowrap"><span className="text-[hsl(220,10%,45%)]">{fmtDate(s.cycle_end_date)}</span></td>
                    <td className="px-3 py-2.5">
                      {s.auto_billing_enabled ? (
                        <span className="inline-flex items-center gap-1 text-emerald-400 text-[11px]"><Zap className="h-3 w-3" /> Oui</span>
                      ) : (
                        <span className="text-[hsl(220,10%,35%)] text-[11px]">Non</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {s.order_id ? <span className="font-mono text-blue-400">Lié</span> : <span className="text-[hsl(220,10%,30%)]">—</span>}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap"><span className="text-[hsl(220,10%,45%)]">{fmtDate(s.created_at)}</span></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {!isLoading && filtered.length > 0 && (
        <p className="text-[11px] text-[hsl(220,10%,30%)] text-center">
          {filtered.length} abonnement{filtered.length !== 1 ? "s" : ""} affiché{filtered.length !== 1 ? "s" : ""}
          {(search || statusFilter) && ` sur ${stats.total}`}
        </p>
      )}
    </div>
  );
};

export default SubscriptionsPage;
