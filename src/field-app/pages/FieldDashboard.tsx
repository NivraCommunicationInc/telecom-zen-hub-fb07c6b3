/**
 * FieldDashboard — Mobile-first field sales command center.
 * Shows both leads and orders KPIs, recent orders with status.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useStaffUser } from "@/lib/hooks/useStaffUser";
import {
  TrendingUp, DollarSign, UserPlus, Send,
  Package, Loader2, ArrowUpRight, Plus, BarChart3, Clock,
  ShoppingCart, CheckCircle2, AlertCircle, Truck,
} from "lucide-react";
import { fieldPath } from "@/field-app/lib/fieldPaths";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

function useFieldDashboard() {
  const { user } = useStaffUser();
  return useQuery({
    queryKey: ["field-dashboard-v2", user?.id],
    queryFn: async () => {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();

      const [ordersAll, ordersToday, ordersMonth, commissionsRes, profileRes, recentOrders, leadsRes] = await Promise.all([
        supabase.from("field_sales_orders").select("id, payment_status, sync_status", { count: "exact" })
          .eq("salesperson_id", user!.id),
        supabase.from("field_sales_orders").select("id", { count: "exact", head: true })
          .eq("salesperson_id", user!.id).gte("created_at", startOfDay),
        supabase.from("field_sales_orders").select("id", { count: "exact", head: true })
          .eq("salesperson_id", user!.id).gte("created_at", startOfMonth),
        supabase.from("field_commissions").select("amount, status")
          .eq("agent_id", user!.id),
        supabase.from("profiles").select("full_name").eq("user_id", user!.id).maybeSingle(),
        supabase.from("field_sales_orders")
          .select("id, customer_name, payment_status, sync_status, total_amount, created_at")
          .eq("salesperson_id", user!.id).order("created_at", { ascending: false }).limit(5),
        supabase.from("field_leads").select("id, status", { count: "exact" })
          .eq("agent_id", user!.id).not("status", "in", '("won","lost")'),
      ]);

      const commissions = commissionsRes.data || [];
      const pendingCommissions = commissions
        .filter((c: any) => c.status === "pending")
        .reduce((sum: number, c: any) => sum + Number(c.amount), 0);

      const allOrders = ordersAll.data || [];
      const pendingPayment = allOrders.filter((o: any) => o.payment_status === "pending").length;
      const syncErrors = allOrders.filter((o: any) => o.sync_status === "error").length;

      return {
        salesToday: ordersToday.count ?? 0,
        salesMonth: ordersMonth.count ?? 0,
        pendingCommissions,
        pendingPayment,
        syncErrors,
        openLeads: leadsRes.count ?? 0,
        totalOrders: ordersAll.count ?? 0,
        userName: profileRes.data?.full_name ?? null,
        recentOrders: (recentOrders.data || []) as any[],
      };
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 2,
  });
}

const SYNC_ICON: Record<string, { icon: typeof CheckCircle2; color: string }> = {
  synced: { icon: CheckCircle2, color: "text-[#16A34A]" },
  pending: { icon: Clock, color: "text-[#D97706]" },
  error: { icon: AlertCircle, color: "text-[#DC2626]" },
};

const PAYMENT_LABEL: Record<string, { label: string; color: string }> = {
  confirmed: { label: "Payé", color: "text-[#16A34A]" },
  pending: { label: "En attente", color: "text-[#D97706]" },
  failed: { label: "Échoué", color: "text-[#DC2626]" },
  cancelled: { label: "Annulé", color: "text-[#6B7280]" },
};

export default function FieldDashboard() {
  const navigate = useNavigate();
  const { data, isLoading } = useFieldDashboard();

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Bonjour";
    if (h < 18) return "Bon après-midi";
    return "Bonsoir";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-[#22C55E]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#000000]">
            {greeting()}{data?.userName ? `, ${data.userName.split(" ")[0]}` : ""}
          </h1>
          <p className="text-sm text-[#6B7280] mt-0.5">
            {new Date().toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        <button
          onClick={() => navigate(fieldPath("/sale/new"))}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#22C55E] text-white text-sm font-semibold hover:bg-[#16A34A] transition-colors shadow-sm"
        >
          <Plus className="h-4 w-4" />
          Nouvelle vente
        </button>
      </div>

      {/* KPI widgets — now includes orders */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: "Ventes aujourd'hui", value: data?.salesToday ?? 0, icon: TrendingUp, iconColor: "text-[#22C55E]", iconBg: "bg-[#DCFCE7]" },
          { label: "Ventes ce mois", value: data?.salesMonth ?? 0, icon: BarChart3, iconColor: "text-[#3B82F6]", iconBg: "bg-[#DBEAFE]" },
          { label: "Commissions en attente", value: `${(data?.pendingCommissions ?? 0).toFixed(2)} $`, icon: DollarSign, iconColor: "text-[#F59E0B]", iconBg: "bg-[#FEF3C7]" },
          { label: "Paiements en attente", value: data?.pendingPayment ?? 0, icon: Clock, iconColor: "text-[#D97706]", iconBg: "bg-[#FEF3C7]" },
          { label: "Leads ouverts", value: data?.openLeads ?? 0, icon: UserPlus, iconColor: "text-[#8B5CF6]", iconBg: "bg-[#EDE9FE]" },
          { label: "Erreurs sync", value: data?.syncErrors ?? 0, icon: AlertCircle, iconColor: data?.syncErrors ? "text-[#DC2626]" : "text-[#6B7280]", iconBg: data?.syncErrors ? "bg-[#FEE2E2]" : "bg-[#F3F4F6]" },
        ].map((w) => (
          <div key={w.label} className="bg-white border border-[#E5E7EB] rounded-xl p-4">
            <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center mb-3", w.iconBg)}>
              <w.icon className={cn("h-4.5 w-4.5", w.iconColor)} />
            </div>
            <p className="text-2xl font-bold text-[#000000]">{w.value}</p>
            <p className="text-[11px] text-[#6B7280] font-medium mt-0.5">{w.label}</p>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: "Nouvelle vente", icon: Plus, path: "/sale/new", primary: true },
          { label: "Mes commandes", icon: Send, path: "/submissions" },
          { label: "Mes leads", icon: UserPlus, path: "/leads" },
          { label: "Commissions", icon: DollarSign, path: "/commissions" },
        ].map((a) => (
          <button
            key={a.label}
            onClick={() => navigate(fieldPath(a.path))}
            className={cn(
              "flex items-center gap-2.5 p-3.5 rounded-xl border text-left transition-colors",
              a.primary
                ? "bg-[#F0FDF4] border-[#BBF7D0] text-[#16A34A] hover:bg-[#DCFCE7]"
                : "bg-white border-[#E5E7EB] text-[#374151] hover:bg-[#F9FAFB]"
            )}
          >
            <a.icon className="h-5 w-5 shrink-0" />
            <span className="text-sm font-medium">{a.label}</span>
          </button>
        ))}
      </div>

      {/* Recent orders */}
      <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#E5E7EB]">
          <h3 className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Dernières commandes</h3>
          <button onClick={() => navigate(fieldPath("/submissions"))} className="text-xs text-[#22C55E] hover:text-[#16A34A] font-medium">
            Voir tout
          </button>
        </div>
        {(data?.recentOrders?.length ?? 0) === 0 ? (
          <p className="text-sm text-[#9CA3AF] p-4 text-center">Aucune commande encore.</p>
        ) : (
          <div className="divide-y divide-[#F3F4F6]">
            {data!.recentOrders.map((order: any) => {
              const syncCfg = SYNC_ICON[order.sync_status] || SYNC_ICON.pending;
              const SIcon = syncCfg.icon;
              const payCfg = PAYMENT_LABEL[order.payment_status] || PAYMENT_LABEL.pending;
              return (
                <button
                  key={order.id}
                  onClick={() => navigate(fieldPath(`/orders/${order.id}`))}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#F9FAFB] transition-colors text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-[#000000] font-medium truncate">{order.customer_name}</span>
                      <SIcon className={cn("h-3.5 w-3.5 shrink-0", syncCfg.color)} />
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={cn("text-[10px] font-semibold", payCfg.color)}>{payCfg.label}</span>
                      <span className="text-[10px] text-[#9CA3AF]">•</span>
                      <span className="text-[10px] font-semibold text-[#000000]">{order.total_amount?.toFixed(2)} $</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-[#9CA3AF]">
                      {formatDistanceToNow(new Date(order.created_at), { addSuffix: true, locale: fr })}
                    </span>
                    <ArrowUpRight className="h-3.5 w-3.5 text-[#D1D5DB]" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
