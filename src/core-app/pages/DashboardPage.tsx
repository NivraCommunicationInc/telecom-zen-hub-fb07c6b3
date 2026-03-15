/**
 * DashboardPage — Nivra Core Operational Cockpit
 * 
 * Real-time readiness console pulling from canonical tables:
 * orders, subscriptions, equipment_inventory, installation_jobs,
 * billing_invoices, billing_automation_runs, order_automation_log
 */
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkQueue } from "@/core-app/hooks/useWorkQueue";
import { useAdminInvoices } from "@/core-app/hooks/useAdminInvoices";
import { useAdminPayments } from "@/core-app/hooks/useAdminPayments";
import { useAdminOrders } from "@/core-app/hooks/useAdminOrders";
import { StatusBadge, statusToVariant } from "@/core-app/components/ui/StatusBadge";
import { corePath } from "@/core-app/lib/corePaths";
import {
  ShoppingCart, CreditCard, FileText, AlertTriangle, ArrowRight,
  Zap, CalendarDays, ListTodo, Package, Wrench, Receipt,
  RefreshCw, Activity, Clock, TrendingUp, Server
} from "lucide-react";
import { format, isToday, isBefore, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";

const fmtCAD = (n: number | null | undefined) => (n != null ? `${n.toFixed(2)} $` : "—");
const fmtDate = (d: string | null | undefined) => {
  if (!d) return "—";
  try { return format(new Date(d), "d MMM yyyy", { locale: fr }); } catch { return "—"; }
};
const fmtShort = (d: string | null | undefined) => {
  if (!d) return "—";
  try { return format(new Date(d), "d MMM HH:mm", { locale: fr }); } catch { return "—"; }
};

/* ═══ Canonical data hooks ═══ */
function useSubscriptionStats() {
  return useQuery({
    queryKey: ["dashboard-subscriptions"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const in3Days = new Date(Date.now() + 3 * 86400000).toISOString().split("T")[0];

      const [activeRes, renewalDueRes] = await Promise.all([
        supabase.from("subscriptions").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("subscriptions").select("id", { count: "exact", head: true }).eq("status", "active").lte("next_billing_date", in3Days),
      ]);
      return {
        active: activeRes.count ?? 0,
        renewalDue: renewalDueRes.count ?? 0,
      };
    },
    refetchInterval: 60000,
  });
}

function useEquipmentStats() {
  return useQuery({
    queryKey: ["dashboard-equipment"],
    queryFn: async () => {
      const [inStockRes, reservedRes, deployedRes, defectiveRes] = await Promise.all([
        supabase.from("equipment_inventory").select("id", { count: "exact", head: true }).eq("status", "in_stock"),
        supabase.from("equipment_inventory").select("id", { count: "exact", head: true }).eq("status", "reserved"),
        supabase.from("equipment_inventory").select("id", { count: "exact", head: true }).eq("status", "deployed"),
        supabase.from("equipment_inventory").select("id", { count: "exact", head: true }).eq("status", "defective"),
      ]);
      return {
        inStock: inStockRes.count ?? 0,
        reserved: reservedRes.count ?? 0,
        deployed: deployedRes.count ?? 0,
        defective: defectiveRes.count ?? 0,
      };
    },
    refetchInterval: 60000,
  });
}

function useInstallationStats() {
  return useQuery({
    queryKey: ["dashboard-installations"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const [pendingRes, todayRes, failedRes] = await Promise.all([
        supabase.from("installation_jobs").select("id", { count: "exact", head: true }).in("status", ["pending", "scheduled", "assigned"]),
        supabase.from("installation_jobs").select("id", { count: "exact", head: true }).eq("scheduled_date", today).not("status", "in", '("completed","cancelled")'),
        supabase.from("installation_jobs").select("id", { count: "exact", head: true }).eq("status", "failed"),
      ]);
      return {
        pending: pendingRes.count ?? 0,
        today: todayRes.count ?? 0,
        failed: failedRes.count ?? 0,
      };
    },
    refetchInterval: 60000,
  });
}

function useAutomationHealth() {
  return useQuery({
    queryKey: ["dashboard-automation-health"],
    queryFn: async () => {
      // Latest automation runs
      const { data: runs } = await supabase
        .from("billing_automation_runs")
        .select("id, run_type, status, renewals_generated, errors_count, summary, completed_at, created_at")
        .order("created_at", { ascending: false })
        .limit(5);

      // Failed automation events
      const { data: failedLogs } = await supabase
        .from("order_automation_log")
        .select("id, order_id, action, details, created_at")
        .order("created_at", { ascending: false })
        .limit(100);

      // Recent automation actions count
      const { count: recentActions } = await supabase
        .from("order_automation_log")
        .select("id", { count: "exact", head: true })
        .gte("created_at", new Date(Date.now() - 24 * 3600000).toISOString());

      return {
        runs: (runs || []) as any[],
        recentActions: recentActions ?? 0,
        lastRun: runs?.[0] || null,
        totalErrors: (runs || []).reduce((s: number, r: any) => s + (r.errors_count || 0), 0),
      };
    },
    refetchInterval: 60000,
  });
}

/* ═══ Main Component ═══ */
const DashboardPage = () => {
  const wq = useWorkQueue();
  const { data: invoices = [], isLoading: invLoading } = useAdminInvoices('live');
  const { data: payments = [], isLoading: payLoading } = useAdminPayments('live');
  const { data: orders = [], isLoading: ordLoading } = useAdminOrders('live');
  const { data: subStats } = useSubscriptionStats();
  const { data: equipStats } = useEquipmentStats();
  const { data: installStats } = useInstallationStats();
  const { data: autoHealth } = useAutomationHealth();

  const metrics = useMemo(() => {
    const ordersToday = orders.filter(o => o.created_at && isToday(new Date(o.created_at))).length;
    const paymentsToday = payments.filter(p => p.status === "confirmed" && p.received_at && isToday(new Date(p.received_at))).length;
    const pendingOrders = orders.filter(o => o.status === "pending").length;
    const confirmedOrders = orders.filter(o => o.status === "confirmed").length;
    const unpaidInvoices = invoices.filter(i => (i.balance_due ?? 0) > 0 && !["paid", "paid_by_promo", "cancelled", "void"].includes(i.status ?? "")).length;
    const overdueInvoices = invoices.filter(i => {
      if (["paid", "paid_by_promo", "cancelled", "void"].includes(i.status ?? "")) return false;
      if (!i.due_date) return false;
      try { return isBefore(parseISO(i.due_date), new Date()); } catch { return false; }
    }).length;
    return { ordersToday, paymentsToday, pendingOrders, confirmedOrders, unpaidInvoices, overdueInvoices, onHold: wq.onHold.length, pendingActivations: wq.activations.length };
  }, [orders, payments, invoices, wq.activations, wq.onHold]);

  const recentOrders = useMemo(() => orders.slice(0, 6), [orders]);
  const unpaidList = useMemo(() =>
    invoices.filter(i => (i.balance_due ?? 0) > 0 && !["paid", "paid_by_promo", "cancelled", "void"].includes(i.status ?? "")).slice(0, 6),
    [invoices]
  );

  const anyLoading = wq.isLoading || invLoading || payLoading || ordLoading;
  const criticalAlerts: string[] = [];
  if (metrics.overdueInvoices > 0) criticalAlerts.push(`${metrics.overdueInvoices} facture${metrics.overdueInvoices > 1 ? 's' : ''} en souffrance`);
  if (metrics.onHold > 0) criticalAlerts.push(`${metrics.onHold} commande${metrics.onHold > 1 ? 's' : ''} bloquée${metrics.onHold > 1 ? 's' : ''}`);
  if ((installStats?.failed ?? 0) > 0) criticalAlerts.push(`${installStats!.failed} installation${installStats!.failed > 1 ? 's' : ''} échouée${installStats!.failed > 1 ? 's' : ''}`);
  if ((equipStats?.defective ?? 0) > 0) criticalAlerts.push(`${equipStats!.defective} équipement${equipStats!.defective > 1 ? 's' : ''} défectueux`);
  if ((autoHealth?.totalErrors ?? 0) > 0) criticalAlerts.push(`${autoHealth!.totalErrors} erreur${autoHealth!.totalErrors > 1 ? 's' : ''} d'automatisation`);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white tracking-tight">Cockpit opérationnel</h1>
          <p className="text-[12px] text-[hsl(220,10%,45%)] mt-0.5">Vue d'ensemble en temps réel — données canoniques</p>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-[hsl(220,10%,40%)]">
          <Activity className="h-3 w-3 text-emerald-400 animate-pulse" /> Live
        </div>
      </div>

      {/* ═══ CRITICAL ALERTS ═══ */}
      {criticalAlerts.length > 0 && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
          <div className="flex items-center gap-2 mb-1.5">
            <AlertTriangle className="h-4 w-4 text-red-400" />
            <h2 className="text-xs font-semibold text-red-400">Alertes critiques</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {criticalAlerts.map((a, i) => (
              <Badge key={i} variant="destructive" className="text-[10px]">{a}</Badge>
            ))}
          </div>
        </div>
      )}

      {/* ═══ PRIMARY KPI STRIP ═══ */}
      <div className="grid grid-cols-4 xl:grid-cols-8 gap-2">
        {[
          { label: "Commandes (auj.)", value: anyLoading ? "—" : metrics.ordersToday, icon: ShoppingCart, color: "text-foreground", link: corePath("/orders") },
          { label: "Commandes pending", value: anyLoading ? "—" : metrics.pendingOrders, icon: Clock, color: metrics.pendingOrders > 0 ? "text-amber-400" : "text-foreground", link: corePath("/orders") },
          { label: "Paiements (auj.)", value: anyLoading ? "—" : metrics.paymentsToday, icon: CreditCard, color: "text-emerald-400", link: corePath("/payments") },
          { label: "Factures impayées", value: anyLoading ? "—" : metrics.unpaidInvoices, icon: FileText, color: metrics.unpaidInvoices > 0 ? "text-red-400" : "text-foreground", link: corePath("/invoices") },
          { label: "Abonnements actifs", value: subStats?.active ?? "—", icon: TrendingUp, color: "text-emerald-400", link: corePath("/subscriptions") },
          { label: "Renouvell. à venir", value: subStats?.renewalDue ?? "—", icon: Receipt, color: (subStats?.renewalDue ?? 0) > 0 ? "text-purple-400" : "text-foreground", link: corePath("/automation") },
          { label: "Installations (auj.)", value: installStats?.today ?? "—", icon: Wrench, color: (installStats?.today ?? 0) > 0 ? "text-amber-400" : "text-foreground", link: corePath("/installations") },
          { label: "Équipement en stock", value: equipStats?.inStock ?? "—", icon: Package, color: "text-blue-400", link: corePath("/equipment") },
        ].map((kpi) => (
          <Link key={kpi.label} to={kpi.link} className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-2.5 hover:border-emerald-500/30 transition-colors group">
            <div className="flex items-center justify-between">
              <p className="text-[9px] font-medium uppercase tracking-wider text-[hsl(220,10%,40%)] leading-tight">{kpi.label}</p>
              <kpi.icon className="h-3 w-3 text-[hsl(220,10%,30%)] group-hover:text-[hsl(220,10%,50%)] transition-colors" />
            </div>
            <p className={`mt-1 text-lg font-bold tabular-nums ${kpi.color}`}>{kpi.value}</p>
          </Link>
        ))}
      </div>

      {/* ═══ QUICK LINKS ═══ */}
      <div className="flex items-center gap-2 flex-wrap">
        {[
          { label: "Work Queue", href: corePath("/work-queue"), icon: ListTodo },
          { label: "Commandes", href: corePath("/orders"), icon: ShoppingCart },
          { label: "Factures", href: corePath("/invoices"), icon: FileText },
          { label: "Paiements", href: corePath("/payments"), icon: CreditCard },
          { label: "Installations", href: corePath("/installations"), icon: Wrench },
          { label: "Équipement", href: corePath("/equipment"), icon: Package },
          { label: "Abonnements", href: corePath("/subscriptions"), icon: TrendingUp },
          { label: "Automatisation", href: corePath("/automation"), icon: Zap },
        ].map(q => (
          <Link key={q.label} to={q.href} className="flex items-center gap-1.5 rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] px-3 py-1.5 text-[11px] font-medium text-[hsl(220,10%,50%)] hover:text-white hover:border-emerald-500/30 transition-colors">
            <q.icon className="h-3.5 w-3.5" /> {q.label}
          </Link>
        ))}
      </div>

      {/* ═══ 3-COLUMN OPERATIONAL WIDGETS ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">

        {/* ── Equipment Readiness ── */}
        <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-[hsl(220,15%,14%)]">
            <h2 className="text-xs font-semibold text-white flex items-center gap-1.5"><Package className="h-3.5 w-3.5 text-blue-400" /> Inventaire équipement</h2>
            <Link to={corePath("/equipment")} className="text-[11px] text-blue-400 hover:underline flex items-center gap-1">Détails <ArrowRight className="h-3 w-3" /></Link>
          </div>
          <div className="p-3 space-y-2">
            {[
              { label: "En stock", value: equipStats?.inStock ?? 0, color: "bg-emerald-500" },
              { label: "Réservé", value: equipStats?.reserved ?? 0, color: "bg-amber-500" },
              { label: "Déployé", value: equipStats?.deployed ?? 0, color: "bg-blue-500" },
              { label: "Défectueux", value: equipStats?.defective ?? 0, color: "bg-red-500" },
            ].map(s => {
              const total = (equipStats?.inStock ?? 0) + (equipStats?.reserved ?? 0) + (equipStats?.deployed ?? 0) + (equipStats?.defective ?? 0);
              const pct = total > 0 ? (s.value / total) * 100 : 0;
              return (
                <div key={s.label} className="flex items-center gap-2">
                  <span className="text-[11px] text-[hsl(220,10%,50%)] w-20">{s.label}</span>
                  <div className="flex-1 h-2 rounded-full bg-[hsl(220,15%,14%)] overflow-hidden">
                    <div className={`h-full rounded-full ${s.color}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-[11px] font-mono text-white w-8 text-right">{s.value}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Installations Today ── */}
        <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-[hsl(220,15%,14%)]">
            <h2 className="text-xs font-semibold text-white flex items-center gap-1.5"><Wrench className="h-3.5 w-3.5 text-amber-400" /> Installations</h2>
            <Link to={corePath("/installations")} className="text-[11px] text-blue-400 hover:underline flex items-center gap-1">Tout voir <ArrowRight className="h-3 w-3" /></Link>
          </div>
          <div className="p-3 space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Aujourd'hui", value: installStats?.today ?? 0, color: "text-amber-400" },
                { label: "En attente", value: installStats?.pending ?? 0, color: "text-foreground" },
                { label: "Échouées", value: installStats?.failed ?? 0, color: (installStats?.failed ?? 0) > 0 ? "text-red-400" : "text-foreground" },
              ].map(s => (
                <div key={s.label} className="text-center">
                  <p className={`text-xl font-bold tabular-nums ${s.color}`}>{s.value}</p>
                  <p className="text-[9px] text-[hsl(220,10%,40%)] uppercase">{s.label}</p>
                </div>
              ))}
            </div>
            {(installStats?.failed ?? 0) > 0 && (
              <div className="rounded bg-red-500/10 border border-red-500/20 p-2 text-[11px] text-red-400">
                ⚠️ {installStats!.failed} job{installStats!.failed > 1 ? 's' : ''} en échec — intervention requise
              </div>
            )}
          </div>
        </div>

        {/* ── Automation Health ── */}
        <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-[hsl(220,15%,14%)]">
            <h2 className="text-xs font-semibold text-white flex items-center gap-1.5"><Server className="h-3.5 w-3.5 text-purple-400" /> Santé automatisation</h2>
            <Link to={corePath("/automation")} className="text-[11px] text-blue-400 hover:underline flex items-center gap-1">Logs <ArrowRight className="h-3 w-3" /></Link>
          </div>
          <div className="p-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-[9px] text-[hsl(220,10%,40%)] uppercase">Actions (24h)</p>
                <p className="text-xl font-bold text-foreground tabular-nums">{autoHealth?.recentActions ?? 0}</p>
              </div>
              <div>
                <p className="text-[9px] text-[hsl(220,10%,40%)] uppercase">Erreurs totales</p>
                <p className={`text-xl font-bold tabular-nums ${(autoHealth?.totalErrors ?? 0) > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                  {autoHealth?.totalErrors ?? 0}
                </p>
              </div>
            </div>
            {autoHealth?.lastRun && (
              <div className="rounded bg-[hsl(220,15%,14%)] p-2 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-[hsl(220,10%,50%)]">Dernier cycle</span>
                  <Badge variant={autoHealth.lastRun.status === "completed" ? "default" : "destructive"} className="text-[9px]">
                    {autoHealth.lastRun.status === "completed" ? "OK" : autoHealth.lastRun.status}
                  </Badge>
                </div>
                <p className="text-[hsl(220,10%,40%)] mt-0.5">{fmtShort(autoHealth.lastRun.completed_at || autoHealth.lastRun.created_at)}</p>
                {autoHealth.lastRun.summary && <p className="text-[hsl(220,10%,50%)] mt-0.5 truncate">{autoHealth.lastRun.summary}</p>}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ TWO-PANEL: Recent Orders + Unpaid Invoices ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Recent Orders */}
        <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-[hsl(220,15%,14%)]">
            <h2 className="text-xs font-semibold text-white">Commandes récentes</h2>
            <Link to={corePath("/orders")} className="text-[11px] text-blue-400 hover:underline flex items-center gap-1">Tout voir <ArrowRight className="h-3 w-3" /></Link>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[hsl(220,15%,14%)]">
                {["#", "Client", "Service", "Statut", "Date"].map(h => (
                  <th key={h} className="text-left px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[hsl(220,10%,38%)]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {anyLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="border-b border-[hsl(220,15%,13%)]">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} className="px-3 py-2"><div className="h-3 w-14 rounded bg-[hsl(220,15%,14%)] animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : recentOrders.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-[hsl(220,10%,30%)] text-xs">Aucune commande</td></tr>
              ) : recentOrders.map((o: any) => (
                <tr key={o.id} className="border-b border-[hsl(220,15%,13%)] last:border-0 hover:bg-[hsl(220,20%,12%)]">
                  <td className="px-3 py-2">
                    <Link to={corePath(`/orders/${o.id}`)} className="font-mono text-white hover:text-blue-400">{o.order_number || "—"}</Link>
                  </td>
                  <td className="px-3 py-2 text-white truncate max-w-[120px]">{o.client_full_name || "—"}</td>
                  <td className="px-3 py-2 text-[hsl(220,10%,50%)]">{o.service_type || "—"}</td>
                  <td className="px-3 py-2"><StatusBadge label={o.status || "—"} variant={statusToVariant(o.status || "")} size="sm" /></td>
                  <td className="px-3 py-2 text-[hsl(220,10%,40%)] whitespace-nowrap">{fmtDate(o.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Unpaid Invoices */}
        <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-[hsl(220,15%,14%)]">
            <h2 className="text-xs font-semibold text-white">Factures impayées prioritaires</h2>
            <Link to={corePath("/invoices")} className="text-[11px] text-blue-400 hover:underline flex items-center gap-1">Tout voir <ArrowRight className="h-3 w-3" /></Link>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[hsl(220,15%,14%)]">
                {["Facture", "Client", "Solde dû", "Statut", "Échéance"].map(h => (
                  <th key={h} className="text-left px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[hsl(220,10%,38%)]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {anyLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="border-b border-[hsl(220,15%,13%)]">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} className="px-3 py-2"><div className="h-3 w-14 rounded bg-[hsl(220,15%,14%)] animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : unpaidList.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-emerald-400/60 text-xs">Aucune facture impayée 🎉</td></tr>
              ) : unpaidList.map((inv) => (
                <tr key={inv.id} className="border-b border-[hsl(220,15%,13%)] last:border-0 hover:bg-[hsl(220,20%,12%)]">
                  <td className="px-3 py-2">
                    <Link to={corePath(`/invoices/${inv.id}`)} className="font-mono text-white hover:text-blue-400">{inv.invoice_number}</Link>
                  </td>
                  <td className="px-3 py-2 text-white truncate max-w-[120px]">{inv.customer_name || "—"}</td>
                  <td className="px-3 py-2 tabular-nums text-red-400 font-medium font-mono">{fmtCAD(inv.balance_due)}</td>
                  <td className="px-3 py-2"><StatusBadge label={inv.status || "—"} variant={statusToVariant(inv.status || "")} size="sm" /></td>
                  <td className="px-3 py-2 text-[hsl(220,10%,40%)] whitespace-nowrap">{fmtDate(inv.due_date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══ LATEST AUTOMATION RUNS ═══ */}
      {(autoHealth?.runs?.length ?? 0) > 0 && (
        <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-[hsl(220,15%,14%)]">
            <h2 className="text-xs font-semibold text-white flex items-center gap-1.5"><RefreshCw className="h-3.5 w-3.5 text-purple-400" /> Derniers cycles d'automatisation</h2>
            <Link to={corePath("/automation")} className="text-[11px] text-blue-400 hover:underline flex items-center gap-1">Tous les logs <ArrowRight className="h-3 w-3" /></Link>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[hsl(220,15%,14%)]">
                {["Date", "Type", "Statut", "Créées", "Erreurs", "Résumé"].map(h => (
                  <th key={h} className="text-left px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[hsl(220,10%,38%)]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {autoHealth!.runs.map((run: any) => (
                <tr key={run.id} className="border-b border-[hsl(220,15%,13%)] last:border-0 hover:bg-[hsl(220,20%,12%)]">
                  <td className="px-3 py-2 text-[hsl(220,10%,50%)] whitespace-nowrap">{fmtShort(run.completed_at || run.created_at)}</td>
                  <td className="px-3 py-2"><Badge variant="outline" className="text-[9px]">{run.run_type === "subscription_renewal_cycle" ? "Renouvellement" : run.run_type}</Badge></td>
                  <td className="px-3 py-2"><Badge variant={run.status === "completed" ? "default" : "destructive"} className="text-[9px]">{run.status === "completed" ? "OK" : run.status}</Badge></td>
                  <td className="px-3 py-2 font-mono text-emerald-400">{run.renewals_generated ?? 0}</td>
                  <td className="px-3 py-2 font-mono text-red-400">{run.errors_count ?? 0}</td>
                  <td className="px-3 py-2 text-[hsl(220,10%,45%)] truncate max-w-[250px]">{run.summary || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default DashboardPage;
