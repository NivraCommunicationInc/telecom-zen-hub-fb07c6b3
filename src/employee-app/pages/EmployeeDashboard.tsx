/**
 * EmployeeDashboard — Operational cockpit with top action bar and actionable widgets.
 * Priority zone shows SLA breaches, urgent items, and assigned tasks.
 */
import { useNavigate } from "react-router-dom";
import {
  ShoppingCart, CreditCard, ShieldCheck, Zap, Headphones,
  UserCheck, AlertTriangle, Search, FileText, ListTodo,
  Loader2, ArrowUpRight, Activity, Clock, Calendar, Ban, DollarSign,
  Receipt,
} from "lucide-react";
import { useState } from "react";
import { employeePath } from "@/employee-app/lib/employeePaths";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { useWorkItemCounts } from "@/employee-app/hooks/useWorkItems";
import { usePortalRealtime } from "@/hooks/usePortalRealtime";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStaffUser } from "@/lib/hooks/useStaffUser";
import { CreateTicketDialog } from "@/employee-app/components/CreateTicketDialog";

function useEmployeeName() {
  const { user } = useStaffUser();
  return useQuery({
    queryKey: ["employee-name", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data?.full_name ?? null;
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 30,
  });
}

interface RecentItem {
  id: string;
  type: "order" | "ticket";
  reference: string;
  status: string;
  createdAt: string;
  href: string;
}

function useRecentActivity() {
  return useQuery<RecentItem[]>({
    queryKey: ["employee-recent-activity"],
    queryFn: async () => {
      const [recentOrders, recentTickets] = await Promise.all([
        supabase.from("orders").select("id, order_number, status, created_at")
          .eq("environment", "live").order("created_at", { ascending: false }).limit(5),
        supabase.from("support_tickets").select("id, ticket_number, status, created_at")
          .order("created_at", { ascending: false }).limit(5),
      ]);

      return [
        ...(recentOrders.data ?? []).map(o => ({
          id: o.id, type: "order" as const, reference: o.order_number ?? o.id.slice(0, 8),
          status: o.status, createdAt: o.created_at, href: employeePath(`/orders/${o.order_number ?? o.id}`),
        })),
        ...(recentTickets.data ?? []).map(t => ({
          id: t.id, type: "ticket" as const, reference: t.ticket_number ?? t.id.slice(0, 8),
          status: t.status ?? "open", createdAt: t.created_at, href: employeePath("/support"),
        })),
      ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 8);
    },
    staleTime: 1000 * 60 * 2,
  });
}

function useDashboardExtras() {
  return useQuery({
    queryKey: ["employee-dashboard-extras"],
    queryFn: async () => {
      const today = new Date();
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
      const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();

      const [appointmentsRes, suspendedRes, overdueRes] = await Promise.all([
        supabase.from("appointments")
          .select("id, appointment_number, title, scheduled_at, status, client_id, service_address")
          .eq("environment", "live")
          .gte("scheduled_at", todayStart).lt("scheduled_at", todayEnd)
          .order("scheduled_at", { ascending: true }).limit(20),
        supabase.from("billing_subscriptions")
          .select("id, plan_name, customer_id, status")
          .eq("environment", "live").eq("status", "suspended").limit(20),
        supabase.from("billing_invoices")
          .select("id, invoice_number, total, balance_due, status, due_date, customer_id")
          .eq("environment", "live").eq("status", "overdue").limit(20),
      ]);

      return {
        appointmentsToday: appointmentsRes.data ?? [],
        suspendedSubs: suspendedRes.data ?? [],
        overdueInvoices: overdueRes.data ?? [],
      };
    },
    staleTime: 1000 * 60 * 3,
  });
}

export default function EmployeeDashboard() {
  const navigate = useNavigate();
  const { data: counts, isLoading } = useWorkItemCounts();
  const { data: userName } = useEmployeeName();
  const { data: recentItems = [] } = useRecentActivity();
  const { data: extras } = useDashboardExtras();
  const [searchQuery, setSearchQuery] = useState("");
  const [showNewTicket, setShowNewTicket] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(employeePath(`/clients?q=${encodeURIComponent(searchQuery.trim())}`));
    }
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Bonjour";
    if (h < 18) return "Bon après-midi";
    return "Bonsoir";
  };

  // Top action bar — real operational actions
  const topActions = [
    { label: "Nouvelle commande", icon: ShoppingCart, color: "text-blue-400 hover:bg-blue-500/10", action: () => navigate(employeePath("/orders/new")) },
    { label: "Enregistrer paiement", icon: DollarSign, color: "text-emerald-400 hover:bg-emerald-500/10", action: () => navigate(employeePath("/payments")) },
    { label: "Créer ticket", icon: Headphones, color: "text-cyan-400 hover:bg-cyan-500/10", action: () => setShowNewTicket(true) },
    { label: "Rechercher client", icon: Search, color: "text-amber-400 hover:bg-amber-500/10", action: () => document.getElementById("emp-search")?.focus() },
  ];

  const quickNav = [
    { label: "Ma file", icon: ListTodo, action: () => navigate(employeePath("/work-queue?filter=mine")) },
    { label: "Commandes", icon: FileText, action: () => navigate(employeePath("/orders")) },
    { label: "Comptes", icon: Receipt, action: () => navigate(employeePath("/accounts")) },
    { label: "Paiements", icon: CreditCard, action: () => navigate(employeePath("/payments")) },
  ];

  const priorityWidgets = [
    {
      label: "SLA dépassés", value: counts?.breached ?? 0, icon: AlertTriangle,
      color: "text-red-400", ring: "ring-red-500/30", bg: "bg-red-500/10", bar: "bg-red-500",
      href: employeePath("/work-queue?filter=breached"),
    },
    {
      label: "Assignés à moi", value: counts?.mine ?? 0, icon: UserCheck,
      color: "text-blue-400", ring: "ring-blue-500/30", bg: "bg-blue-500/10", bar: "bg-blue-500",
      href: employeePath("/work-queue?filter=mine"),
    },
    {
      label: "À risque", value: counts?.atRisk ?? 0, icon: Clock,
      color: "text-amber-400", ring: "ring-amber-500/30", bg: "bg-amber-500/10", bar: "bg-amber-500",
      href: employeePath("/work-queue?filter=urgent"),
    },
  ];

  const standardWidgets = [
    { label: "Commandes", value: counts?.byType?.order ?? 0, icon: ShoppingCart, color: "text-blue-400", bg: "bg-blue-500/10", href: employeePath("/work-queue?filter=order") },
    { label: "Paiements", value: counts?.byType?.payment ?? 0, icon: CreditCard, color: "text-emerald-400", bg: "bg-emerald-500/10", href: employeePath("/work-queue?filter=payment") },
    { label: "KYC", value: counts?.byType?.kyc ?? 0, icon: ShieldCheck, color: "text-amber-400", bg: "bg-amber-500/10", href: employeePath("/work-queue?filter=kyc") },
    { label: "Activations", value: counts?.byType?.activation ?? 0, icon: Zap, color: "text-purple-400", bg: "bg-purple-500/10", href: employeePath("/work-queue?filter=activation") },
    { label: "Tickets", value: counts?.byType?.ticket ?? 0, icon: Headphones, color: "text-cyan-400", bg: "bg-cyan-500/10", href: employeePath("/work-queue?filter=ticket") },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">
            {greeting()}{userName ? `, ${userName.split(" ")[0]}` : ""}
          </h1>
          <p className="text-sm text-[hsl(220,10%,45%)] mt-0.5">
            Vue opérationnelle — {new Date().toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
      </div>

      {/* TOP ACTION BAR */}
      <div className="flex items-center gap-2 flex-wrap">
        {topActions.map(a => (
          <button
            key={a.label}
            onClick={a.action}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[hsl(220,15%,15%)] bg-[hsl(220,20%,8%)] text-sm font-medium transition-all",
              a.color
            )}
          >
            <a.icon className="h-4 w-4" />
            {a.label}
          </button>
        ))}
        <div className="border-l border-[hsl(220,15%,15%)] h-8 mx-1" />
        {quickNav.map(a => (
          <button
            key={a.label}
            onClick={a.action}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[hsl(220,15%,15%)] bg-[hsl(220,20%,8%)] text-xs text-[hsl(220,10%,55%)] hover:text-white hover:border-blue-500/30 hover:bg-blue-500/5 transition-colors"
          >
            <a.icon className="h-3 w-3" />
            <span className="hidden md:inline">{a.label}</span>
          </button>
        ))}
      </div>

      {/* Quick search */}
      <form onSubmit={handleSearch} className="relative max-w-lg">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(220,10%,35%)]" />
        <input
          id="emp-search"
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Rechercher par nom, email, # commande, # compte…"
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-[hsl(220,15%,15%)] bg-[hsl(220,20%,8%)] text-sm text-white placeholder:text-[hsl(220,10%,35%)] focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20"
        />
      </form>

      {isLoading ? (
        <div className="flex items-center gap-3 py-12 justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
          <span className="text-sm text-[hsl(220,10%,45%)]">Chargement…</span>
        </div>
      ) : (
        <>
          {/* Priority Zone */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {priorityWidgets.map((w) => {
              const hasItems = w.value > 0;
              return (
                <button
                  key={w.label}
                  onClick={() => navigate(w.href)}
                  className={cn(
                    "relative text-left p-5 rounded-xl border transition-all group overflow-hidden",
                    hasItems
                      ? `border-[hsl(220,15%,16%)] bg-[hsl(220,20%,8%)] ring-1 ${w.ring} hover:bg-[hsl(220,20%,10%)]`
                      : "border-[hsl(220,15%,12%)] bg-[hsl(220,20%,7%)] opacity-60"
                  )}
                >
                  {hasItems && <div className={cn("absolute top-0 left-0 w-1 h-full rounded-l-xl", w.bar)} />}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center", w.bg)}>
                        <w.icon className={cn("h-5 w-5", w.color)} />
                      </div>
                      <div>
                        <p className="text-xs text-[hsl(220,10%,50%)] font-medium">{w.label}</p>
                        <p className="text-2xl font-bold text-white mt-0.5">{w.value}</p>
                      </div>
                    </div>
                    {hasItems && <ArrowUpRight className="h-4 w-4 text-[hsl(220,10%,30%)] group-hover:text-white transition-colors" />}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Standard counters */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
            {standardWidgets.map((w) => (
              <button
                key={w.label}
                onClick={() => navigate(w.href)}
                className="text-left p-3.5 rounded-xl border border-[hsl(220,15%,12%)] bg-[hsl(220,20%,7.5%)] hover:bg-[hsl(220,20%,10%)] hover:border-[hsl(220,15%,18%)] transition-all group"
              >
                <div className="flex items-center gap-2.5 mb-2">
                  <div className={cn("h-7 w-7 rounded-md flex items-center justify-center", w.bg)}>
                    <w.icon className={cn("h-3.5 w-3.5", w.color)} />
                  </div>
                  <span className="text-xl font-bold text-white">{w.value}</span>
                </div>
                <p className="text-[10px] text-[hsl(220,10%,42%)] font-medium leading-tight">{w.label}</p>
              </button>
            ))}
          </div>

          {/* Operational Widgets Row — Actionable */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Appointments today */}
            <div className="rounded-xl border border-[hsl(220,15%,12%)] bg-[hsl(220,20%,7.5%)]">
              <div className="flex items-center justify-between px-4 py-3 border-b border-[hsl(220,15%,11%)]">
                <div className="flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5 text-blue-400" />
                  <h3 className="text-xs font-semibold text-[hsl(220,10%,50%)] uppercase tracking-wider">
                    RDV aujourd'hui ({extras?.appointmentsToday?.length ?? 0})
                  </h3>
                </div>
                <button
                  onClick={() => navigate(employeePath("/appointments"))}
                  className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors"
                >
                  Voir tout →
                </button>
              </div>
              <div className="p-3 space-y-1.5 max-h-[200px] overflow-y-auto">
                {(extras?.appointmentsToday ?? []).length === 0 ? (
                  <p className="text-xs text-[hsl(220,10%,30%)]">Aucun rendez-vous.</p>
                ) : (
                  (extras?.appointmentsToday ?? []).map((apt: any) => (
                    <button
                      key={apt.id}
                      onClick={() => navigate(employeePath(`/appointments/${apt.id}`))}
                      className="w-full text-left text-xs p-2 rounded-lg hover:bg-[hsl(220,20%,10%)] transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-white font-medium truncate">{apt.title}</span>
                        <span className="text-[hsl(220,10%,45%)] shrink-0 ml-2">
                          {new Date(apt.scheduled_at).toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Suspended subscriptions */}
            <div className="rounded-xl border border-[hsl(220,15%,12%)] bg-[hsl(220,20%,7.5%)]">
              <div className="flex items-center justify-between px-4 py-3 border-b border-[hsl(220,15%,11%)]">
                <div className="flex items-center gap-2">
                  <Ban className="h-3.5 w-3.5 text-red-400" />
                  <h3 className="text-xs font-semibold text-[hsl(220,10%,50%)] uppercase tracking-wider">
                    Suspendus ({extras?.suspendedSubs?.length ?? 0})
                  </h3>
                </div>
                <button
                  onClick={() => navigate(employeePath("/activations"))}
                  className="text-[10px] text-red-400 hover:text-red-300 transition-colors"
                >
                  Gérer →
                </button>
              </div>
              <div className="p-3 space-y-1.5 max-h-[200px] overflow-y-auto">
                {(extras?.suspendedSubs ?? []).length === 0 ? (
                  <p className="text-xs text-[hsl(220,10%,30%)]">Aucun service suspendu.</p>
                ) : (
                  (extras?.suspendedSubs ?? []).map((s: any) => (
                    <button
                      key={s.id}
                      onClick={() => navigate(employeePath(`/subscriptions/${s.id}`))}
                      className="w-full text-left text-xs p-2 rounded-lg hover:bg-[hsl(220,20%,10%)] transition-colors"
                    >
                      <span className="text-red-300">{s.plan_name}</span>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Overdue invoices — actionable */}
            <div className="rounded-xl border border-[hsl(220,15%,12%)] bg-[hsl(220,20%,7.5%)]">
              <div className="flex items-center justify-between px-4 py-3 border-b border-[hsl(220,15%,11%)]">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-3.5 w-3.5 text-amber-400" />
                  <h3 className="text-xs font-semibold text-[hsl(220,10%,50%)] uppercase tracking-wider">
                    En souffrance ({extras?.overdueInvoices?.length ?? 0})
                  </h3>
                </div>
                <button
                  onClick={() => navigate(employeePath("/payments"))}
                  className="text-[10px] text-amber-400 hover:text-amber-300 transition-colors"
                >
                  Paiements →
                </button>
              </div>
              <div className="p-3 space-y-1.5 max-h-[200px] overflow-y-auto">
                {(extras?.overdueInvoices ?? []).length === 0 ? (
                  <p className="text-xs text-[hsl(220,10%,30%)]">Aucune facture en souffrance.</p>
                ) : (
                  (extras?.overdueInvoices ?? []).map((inv: any) => (
                    <button
                      key={inv.id}
                      onClick={() => navigate(employeePath(`/invoices/${inv.id}`))}
                      className="w-full text-left text-xs p-2 rounded-lg hover:bg-[hsl(220,20%,10%)] transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-white font-mono">{inv.invoice_number}</span>
                        <span className="text-amber-400">{inv.balance_due?.toFixed(2) ?? inv.total?.toFixed(2)} $</span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Recent activity */}
          <div className="rounded-xl border border-[hsl(220,15%,12%)] bg-[hsl(220,20%,7.5%)]">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-[hsl(220,15%,11%)]">
              <Activity className="h-3.5 w-3.5 text-[hsl(220,10%,35%)]" />
              <h3 className="text-xs font-semibold text-[hsl(220,10%,50%)] uppercase tracking-wider">Activité récente</h3>
            </div>
            {recentItems.length === 0 ? (
              <p className="text-xs text-[hsl(220,10%,30%)] p-4">Aucune activité récente.</p>
            ) : (
              <div className="divide-y divide-[hsl(220,15%,10%)]">
                {recentItems.map((item) => (
                  <button
                    key={`${item.type}-${item.id}`}
                    onClick={() => navigate(item.href)}
                    className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-[hsl(220,20%,9%)] transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "h-6 w-6 rounded flex items-center justify-center",
                        item.type === "order" ? "bg-blue-500/10" : "bg-cyan-500/10"
                      )}>
                        {item.type === "order"
                          ? <ShoppingCart className="h-3 w-3 text-blue-400" />
                          : <Headphones className="h-3 w-3 text-cyan-400" />}
                      </div>
                      <div>
                        <span className="text-xs text-white font-mono">{item.reference}</span>
                        <span className="mx-2 text-[hsl(220,10%,25%)]">·</span>
                        <span className={cn(
                          "text-[10px] font-medium px-1.5 py-0.5 rounded",
                          item.status === "completed" || item.status === "resolved"
                            ? "text-emerald-400 bg-emerald-500/10"
                            : item.status === "cancelled" || item.status === "closed"
                            ? "text-[hsl(220,10%,40%)] bg-[hsl(220,15%,13%)]"
                            : "text-amber-400 bg-amber-500/10"
                        )}>
                          {item.status}
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] text-[hsl(220,10%,35%)]">
                      {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true, locale: fr })}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Create ticket dialog — accessible from dashboard */}
      {showNewTicket && (
        <CreateTicketDialog
          clientId=""
          clientName=""
          onClose={() => setShowNewTicket(false)}
        />
      )}
    </div>
  );
}
