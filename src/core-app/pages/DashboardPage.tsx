/**
 * DashboardPage — Nivra Core real operational dashboard.
 * Reuses useWorkQueue, useAdminInvoices, useAdminPayments, useAdminOrders.
 */
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useWorkQueue } from "@/core-app/hooks/useWorkQueue";
import { useAdminInvoices } from "@/core-app/hooks/useAdminInvoices";
import { useAdminPayments } from "@/core-app/hooks/useAdminPayments";
import { useAdminOrders } from "@/core-app/hooks/useAdminOrders";
import { StatusBadge, statusToVariant } from "@/core-app/components/ui/StatusBadge";
import { ShoppingCart, CreditCard, FileText, AlertTriangle, ArrowRight, Zap, CalendarDays, ListTodo } from "lucide-react";
import { format, isToday } from "date-fns";
import { fr } from "date-fns/locale";

const fmtCAD = (n: number | null | undefined) => (n != null ? `${n.toFixed(2)} $` : "—");
const fmtDate = (d: string | null | undefined) => {
  if (!d) return "—";
  try { return format(new Date(d), "d MMM yyyy", { locale: fr }); } catch { return "—"; }
};

const DashboardPage = () => {
  const wq = useWorkQueue();
  const { data: invoices = [], isLoading: invLoading } = useAdminInvoices('live');
  const { data: payments = [], isLoading: payLoading } = useAdminPayments('live');
  const { data: orders = [], isLoading: ordLoading } = useAdminOrders('live');

  const metrics = useMemo(() => {
    const ordersToday = orders.filter(o => o.created_at && isToday(new Date(o.created_at))).length;
    const paymentsToday = payments.filter(p => p.status === "confirmed" && p.received_at && isToday(new Date(p.received_at))).length;
    const unpaidInvoices = invoices.filter(i => (i.balance_due ?? 0) > 0 && !["paid", "paid_by_promo", "cancelled", "void"].includes(i.status ?? "")).length;
    const pendingActivations = wq.activations.length;
    const onHold = wq.onHold.length;
    return { ordersToday, paymentsToday, unpaidInvoices, pendingActivations, onHold };
  }, [orders, payments, invoices, wq.activations, wq.onHold]);

  const recentOrders = useMemo(() => orders.slice(0, 8), [orders]);
  const unpaidList = useMemo(() =>
    invoices
      .filter(i => (i.balance_due ?? 0) > 0 && !["paid", "paid_by_promo", "cancelled", "void"].includes(i.status ?? ""))
      .slice(0, 8),
    [invoices]
  );

  const anyLoading = wq.isLoading || invLoading || payLoading || ordLoading;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-white tracking-tight">Dashboard</h1>
        <p className="text-[12px] text-[hsl(220,10%,45%)] mt-0.5">Vue opérationnelle en temps réel</p>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: "Commandes aujourd'hui", value: metrics.ordersToday, icon: ShoppingCart, color: "text-white", link: "/core/orders" },
          { label: "Paiements confirmés (auj.)", value: metrics.paymentsToday, icon: CreditCard, color: "text-emerald-400", link: "/core/payments" },
          { label: "Factures impayées", value: metrics.unpaidInvoices, icon: FileText, color: metrics.unpaidInvoices > 0 ? "text-red-400" : "text-white", link: "/core/invoices" },
          { label: "Activations en attente", value: metrics.pendingActivations, icon: Zap, color: metrics.pendingActivations > 0 ? "text-amber-400" : "text-white", link: "/core/work-queue" },
          { label: "Bloquées / Hold", value: metrics.onHold, icon: AlertTriangle, color: metrics.onHold > 0 ? "text-red-400" : "text-white", link: "/core/work-queue" },
        ].map((kpi) => (
          <Link key={kpi.label} to={kpi.link} className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-3 hover:border-emerald-500/30 transition-colors group">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-medium uppercase tracking-wider text-[hsl(220,10%,40%)]">{kpi.label}</p>
              <kpi.icon className="h-3.5 w-3.5 text-[hsl(220,10%,30%)] group-hover:text-[hsl(220,10%,50%)] transition-colors" />
            </div>
            <p className={`mt-1.5 text-lg font-bold tabular-nums ${kpi.color}`}>{anyLoading ? "—" : kpi.value}</p>
          </Link>
        ))}
      </div>

      {/* Quick Links */}
      <div className="flex items-center gap-2">
        {[
          { label: "Work Queue", href: "/core/work-queue", icon: ListTodo },
          { label: "Commandes", href: "/core/orders", icon: ShoppingCart },
          { label: "Factures", href: "/core/invoices", icon: FileText },
          { label: "Paiements", href: "/core/payments", icon: CreditCard },
          { label: "RDV", href: "/core/work-queue", icon: CalendarDays },
        ].map(q => (
          <Link key={q.label} to={q.href} className="flex items-center gap-1.5 rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] px-3 py-1.5 text-[11px] font-medium text-[hsl(220,10%,50%)] hover:text-white hover:border-emerald-500/30 transition-colors">
            <q.icon className="h-3.5 w-3.5" /> {q.label}
          </Link>
        ))}
      </div>

      {/* Two-panel layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Recent Orders */}
        <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-[hsl(220,15%,14%)]">
            <h2 className="text-xs font-semibold text-white">Commandes récentes</h2>
            <Link to="/core/orders" className="text-[11px] text-blue-400 hover:underline flex items-center gap-1">Tout voir <ArrowRight className="h-3 w-3" /></Link>
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
                  <td className="px-3 py-2 font-mono text-white">{o.order_number || "—"}</td>
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
            <Link to="/core/invoices" className="text-[11px] text-blue-400 hover:underline flex items-center gap-1">Tout voir <ArrowRight className="h-3 w-3" /></Link>
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
                    <Link to={`/core/invoices/${inv.id}`} className="font-mono text-white hover:text-blue-400">{inv.invoice_number}</Link>
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

      {/* Operational alerts */}
      {(metrics.onHold > 0 || metrics.pendingActivations > 0) && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            <h2 className="text-xs font-semibold text-amber-400">Alertes opérationnelles</h2>
          </div>
          <div className="space-y-1 text-xs text-[hsl(220,10%,55%)]">
            {metrics.onHold > 0 && (
              <p>⚠️ <strong className="text-amber-400">{metrics.onHold}</strong> commande{metrics.onHold > 1 ? "s" : ""} bloquée{metrics.onHold > 1 ? "s" : ""} / en hold — <Link to="/core/work-queue" className="text-blue-400 hover:underline">voir la file</Link></p>
            )}
            {metrics.pendingActivations > 0 && (
              <p>⏳ <strong className="text-amber-400">{metrics.pendingActivations}</strong> activation{metrics.pendingActivations > 1 ? "s" : ""} en attente — <Link to="/core/work-queue" className="text-blue-400 hover:underline">voir la file</Link></p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardPage;
