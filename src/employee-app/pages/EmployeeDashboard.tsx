/**
 * EmployeeDashboard — Phase 2: Operational command center.
 * Priority zone (urgent/assigned), actionable widgets, recent activity feed.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import {
  ShoppingCart, CreditCard, ShieldCheck, Zap, Headphones,
  UserCheck, AlertTriangle, Search, FileText, ListTodo, Clock,
  Loader2, ArrowUpRight, TrendingUp, Activity,
} from "lucide-react";
import { useState, useEffect } from "react";
import { employeePath } from "@/employee-app/lib/employeePaths";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface DashboardCounts {
  pendingOrders: number;
  manualPayments: number;
  kycPending: number;
  blockedActivations: number;
  openTickets: number;
  assignedToMe: number;
  overdueItems: number;
}

interface RecentItem {
  id: string;
  type: "order" | "ticket";
  reference: string;
  status: string;
  createdAt: string;
  href: string;
}

function useEmployeeDashboard() {
  return useQuery<{ counts: DashboardCounts; recentItems: RecentItem[]; userName: string | null }>({
    queryKey: ["employee-dashboard-v2"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;

      const [ordersRes, paymentsRes, kycRes, activationsRes, ticketsRes, profileRes] = await Promise.all([
        supabase.from("orders").select("id", { count: "exact", head: true })
          .in("status", ["pending", "submitted", "received"]).eq("environment", "live"),
        supabase.from("billing_payments").select("id", { count: "exact", head: true })
          .eq("status", "pending").eq("method", "etransfer").eq("environment", "live"),
        supabase.from("order_identity_data").select("id", { count: "exact", head: true })
          .eq("verification_status", "pending"),
        supabase.from("orders").select("id", { count: "exact", head: true })
          .in("status", ["delivered", "installed"]).eq("environment", "live"),
        supabase.from("support_tickets").select("id", { count: "exact", head: true })
          .in("status", ["open", "in_progress"]),
        userId ? supabase.from("profiles").select("full_name").eq("user_id", userId).maybeSingle() : Promise.resolve({ data: null }),
      ]);

      const assignedRes = userId
        ? await supabase.from("orders").select("id", { count: "exact", head: true })
            .eq("assigned_to", userId).not("status", "in", '("completed","cancelled")').eq("environment", "live")
        : { count: 0 };

      const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      const overdueRes = await supabase.from("orders").select("id", { count: "exact", head: true })
        .in("status", ["pending", "submitted"]).lt("created_at", cutoff).eq("environment", "live");

      // Recent items for activity feed
      const [recentOrders, recentTickets] = await Promise.all([
        supabase.from("orders").select("id, order_number, status, created_at")
          .eq("environment", "live").order("created_at", { ascending: false }).limit(5),
        supabase.from("support_tickets").select("id, ticket_number, status, created_at")
          .order("created_at", { ascending: false }).limit(5),
      ]);

      const recentItems: RecentItem[] = [
        ...(recentOrders.data ?? []).map(o => ({
          id: o.id, type: "order" as const, reference: o.order_number ?? o.id.slice(0, 8),
          status: o.status, createdAt: o.created_at, href: employeePath(`/orders/${o.id}`),
        })),
        ...(recentTickets.data ?? []).map(t => ({
          id: t.id, type: "ticket" as const, reference: t.ticket_number ?? t.id.slice(0, 8),
          status: t.status ?? "open", createdAt: t.created_at, href: employeePath("/support"),
        })),
      ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 8);

      return {
        counts: {
          pendingOrders: ordersRes.count ?? 0,
          manualPayments: paymentsRes.count ?? 0,
          kycPending: kycRes.count ?? 0,
          blockedActivations: activationsRes.count ?? 0,
          openTickets: ticketsRes.count ?? 0,
          assignedToMe: assignedRes.count ?? 0,
          overdueItems: overdueRes.count ?? 0,
        },
        recentItems,
        userName: profileRes.data?.full_name ?? null,
      };
    },
    staleTime: 1000 * 60 * 2,
  });
}

export default function EmployeeDashboard() {
  const navigate = useNavigate();
  const { data, isLoading } = useEmployeeDashboard();
  const [searchQuery, setSearchQuery] = useState("");
  const counts = data?.counts;
  const recentItems = data?.recentItems ?? [];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(employeePath(`/clients?q=${encodeURIComponent(searchQuery.trim())}`));
    }
  };

  // Split into priority zone (urgent) and standard widgets
  const urgentWidgets = [
    { label: "Assignés à moi", value: counts?.assignedToMe ?? 0, icon: UserCheck, color: "text-blue-400", ring: "ring-blue-500/30", bg: "bg-blue-500/10", href: employeePath("/work-queue?filter=mine"), highlight: true },
    { label: "Urgents / en retard", value: counts?.overdueItems ?? 0, icon: AlertTriangle, color: "text-red-400", ring: "ring-red-500/30", bg: "bg-red-500/10", href: employeePath("/work-queue?filter=overdue"), highlight: true },
  ];

  const standardWidgets = [
    { label: "Commandes", value: counts?.pendingOrders ?? 0, icon: ShoppingCart, color: "text-blue-400", bg: "bg-blue-500/10", href: employeePath("/orders?status=pending") },
    { label: "Paiements manuels", value: counts?.manualPayments ?? 0, icon: CreditCard, color: "text-emerald-400", bg: "bg-emerald-500/10", href: employeePath("/payments?tab=manual") },
    { label: "KYC", value: counts?.kycPending ?? 0, icon: ShieldCheck, color: "text-amber-400", bg: "bg-amber-500/10", href: employeePath("/kyc") },
    { label: "Activations", value: counts?.blockedActivations ?? 0, icon: Zap, color: "text-purple-400", bg: "bg-purple-500/10", href: employeePath("/activations") },
    { label: "Tickets", value: counts?.openTickets ?? 0, icon: Headphones, color: "text-cyan-400", bg: "bg-cyan-500/10", href: employeePath("/support") },
  ];

  const quickActions = [
    { label: "Rechercher client", icon: Search, action: () => document.getElementById("emp-search")?.focus() },
    { label: "Ma file", icon: ListTodo, action: () => navigate(employeePath("/work-queue?filter=mine")) },
    { label: "Commandes", icon: FileText, action: () => navigate(employeePath("/orders")) },
    { label: "Paiements", icon: CreditCard, action: () => navigate(employeePath("/payments")) },
  ];

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Bonjour";
    if (h < 18) return "Bon après-midi";
    return "Bonsoir";
  };

  return (
    <div className="space-y-6">
      {/* Header with greeting */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">
            {greeting()}{data?.userName ? `, ${data.userName.split(" ")[0]}` : ""}
          </h1>
          <p className="text-sm text-[hsl(220,10%,45%)] mt-0.5">
            Vue opérationnelle — {new Date().toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        <div className="flex gap-2">
          {quickActions.map((a) => (
            <button
              key={a.label}
              onClick={a.action}
              title={a.label}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[hsl(220,15%,15%)] bg-[hsl(220,20%,8%)] text-xs text-[hsl(220,10%,55%)] hover:text-white hover:border-blue-500/30 hover:bg-blue-500/5 transition-colors"
            >
              <a.icon className="h-3 w-3" />
              <span className="hidden md:inline">{a.label}</span>
            </button>
          ))}
        </div>
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
          {/* Priority Zone — Assigned & Overdue */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {urgentWidgets.map((w) => {
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
                  {hasItems && (
                    <div className={cn("absolute top-0 left-0 w-1 h-full rounded-l-xl", w.color === "text-red-400" ? "bg-red-500" : "bg-blue-500")} />
                  )}
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
                    {hasItems && (
                      <ArrowUpRight className="h-4 w-4 text-[hsl(220,10%,30%)] group-hover:text-white transition-colors" />
                    )}
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

          {/* Activity feed */}
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
                          : <Headphones className="h-3 w-3 text-cyan-400" />
                        }
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
    </div>
  );
}
