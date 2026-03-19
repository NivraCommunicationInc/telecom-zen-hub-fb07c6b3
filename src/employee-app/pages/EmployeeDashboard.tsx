/**
 * EmployeeDashboard — Operational dashboard showing what needs attention.
 * Widgets: Orders pending, Manual payments, KYC reviews, Activations blocked,
 * Open tickets, Assigned to me, Urgent/overdue.
 * Quick actions: Search client, Open order, Open payment, View queue.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import {
  ShoppingCart, CreditCard, ShieldCheck, Zap, Headphones,
  UserCheck, AlertTriangle, Search, FileText, ListTodo, Clock,
  Loader2,
} from "lucide-react";
import { useState } from "react";
import { employeePath } from "@/employee-app/lib/employeePaths";

interface DashboardCounts {
  pendingOrders: number;
  manualPayments: number;
  kycPending: number;
  blockedActivations: number;
  openTickets: number;
  assignedToMe: number;
  overdueItems: number;
}

function useEmployeeDashboard() {
  return useQuery<DashboardCounts>({
    queryKey: ["employee-dashboard-counts"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;

      const [ordersRes, paymentsRes, kycRes, activationsRes, ticketsRes] = await Promise.all([
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
      ]);

      // Assigned to me
      const assignedRes = userId
        ? await supabase.from("orders").select("id", { count: "exact", head: true })
            .eq("assigned_to", userId).not("status", "in", '("completed","cancelled")').eq("environment", "live")
        : { count: 0 };

      // Overdue (orders older than 48h in pending)
      const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      const overdueRes = await supabase.from("orders").select("id", { count: "exact", head: true })
        .in("status", ["pending", "submitted"]).lt("created_at", cutoff).eq("environment", "live");

      return {
        pendingOrders: ordersRes.count ?? 0,
        manualPayments: paymentsRes.count ?? 0,
        kycPending: kycRes.count ?? 0,
        blockedActivations: activationsRes.count ?? 0,
        openTickets: ticketsRes.count ?? 0,
        assignedToMe: assignedRes.count ?? 0,
        overdueItems: overdueRes.count ?? 0,
      };
    },
    staleTime: 1000 * 60 * 2,
  });
}

export default function EmployeeDashboard() {
  const navigate = useNavigate();
  const { data: counts, isLoading } = useEmployeeDashboard();
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(employeePath(`/clients?q=${encodeURIComponent(searchQuery.trim())}`));
    }
  };

  const widgets = [
    { label: "Commandes en attente", value: counts?.pendingOrders ?? 0, icon: ShoppingCart, color: "text-blue-400", bg: "bg-blue-500/10", href: employeePath("/orders?status=pending") },
    { label: "Paiements manuels", value: counts?.manualPayments ?? 0, icon: CreditCard, color: "text-emerald-400", bg: "bg-emerald-500/10", href: employeePath("/payments?tab=manual") },
    { label: "KYC en attente", value: counts?.kycPending ?? 0, icon: ShieldCheck, color: "text-amber-400", bg: "bg-amber-500/10", href: employeePath("/kyc") },
    { label: "Activations bloquées", value: counts?.blockedActivations ?? 0, icon: Zap, color: "text-purple-400", bg: "bg-purple-500/10", href: employeePath("/activations?status=blocked") },
    { label: "Tickets ouverts", value: counts?.openTickets ?? 0, icon: Headphones, color: "text-cyan-400", bg: "bg-cyan-500/10", href: employeePath("/support") },
    { label: "Assignés à moi", value: counts?.assignedToMe ?? 0, icon: UserCheck, color: "text-indigo-400", bg: "bg-indigo-500/10", href: employeePath("/work-queue?filter=mine") },
    { label: "Urgents / en retard", value: counts?.overdueItems ?? 0, icon: AlertTriangle, color: "text-red-400", bg: "bg-red-500/10", href: employeePath("/work-queue?filter=overdue") },
  ];

  const quickActions = [
    { label: "Rechercher client", icon: Search, action: () => document.getElementById("emp-search")?.focus() },
    { label: "Ouvrir commande", icon: FileText, action: () => navigate(employeePath("/orders")) },
    { label: "Ouvrir paiement", icon: CreditCard, action: () => navigate(employeePath("/payments")) },
    { label: "Ma file de travail", icon: ListTodo, action: () => navigate(employeePath("/work-queue?filter=mine")) },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight">Tableau de bord</h1>
        <p className="text-sm text-[hsl(220,10%,45%)]">Vue opérationnelle — actions requises</p>
      </div>

      {/* Quick search */}
      <form onSubmit={handleSearch} className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(220,10%,35%)]" />
        <input
          id="emp-search"
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Rechercher un client, commande, compte…"
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-[hsl(220,15%,15%)] bg-[hsl(220,20%,8%)] text-sm text-white placeholder:text-[hsl(220,10%,35%)] focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20"
        />
      </form>

      {/* Widgets */}
      {isLoading ? (
        <div className="flex items-center gap-3 py-10 justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
          <span className="text-sm text-[hsl(220,10%,45%)]">Chargement…</span>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {widgets.map((w) => (
            <button
              key={w.label}
              onClick={() => navigate(w.href)}
              className="text-left p-4 rounded-xl border border-[hsl(220,15%,13%)] bg-[hsl(220,20%,8%)] hover:bg-[hsl(220,20%,10%)] hover:border-[hsl(220,15%,18%)] transition-all group"
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`h-8 w-8 rounded-lg ${w.bg} flex items-center justify-center`}>
                  <w.icon className={`h-4 w-4 ${w.color}`} />
                </div>
                <span className="text-2xl font-bold text-white">{w.value}</span>
              </div>
              <p className="text-[11px] text-[hsl(220,10%,45%)] font-medium leading-tight">{w.label}</p>
            </button>
          ))}
        </div>
      )}

      {/* Quick actions */}
      <div>
        <h2 className="text-xs font-semibold text-[hsl(220,10%,40%)] uppercase tracking-wider mb-3">Actions rapides</h2>
        <div className="flex flex-wrap gap-2">
          {quickActions.map((a) => (
            <button
              key={a.label}
              onClick={a.action}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg border border-[hsl(220,15%,15%)] bg-[hsl(220,20%,8%)] text-sm text-[hsl(220,10%,60%)] hover:text-white hover:border-blue-500/30 hover:bg-blue-500/5 transition-colors"
            >
              <a.icon className="h-3.5 w-3.5" />
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {/* Recent activity placeholder */}
      <div className="rounded-xl border border-[hsl(220,15%,13%)] bg-[hsl(220,20%,8%)] p-5">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="h-4 w-4 text-[hsl(220,10%,35%)]" />
          <h3 className="text-sm font-semibold text-[hsl(220,10%,60%)]">Activité récente</h3>
        </div>
        <p className="text-xs text-[hsl(220,10%,35%)]">Les dernières actions seront affichées ici.</p>
      </div>
    </div>
  );
}
