/**
 * FieldDashboard — Telecom-grade field sales command center.
 * Real-time KPIs, performance ring, daily goals, recent activity, weather-aware greeting.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useStaffUser } from "@/lib/hooks/useStaffUser";
import {
  TrendingUp, DollarSign, UserPlus, Plus, BarChart3, Clock,
  CheckCircle2, AlertCircle, Loader2, ArrowUpRight, Target,
  Zap, Trophy, ChevronRight, Bell, MapPin, Calendar,
  ShoppingCart, Flame, Star, ArrowRight, RefreshCw,
} from "lucide-react";
import { fieldPath } from "@/field-app/lib/fieldPaths";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, format, isToday, isYesterday } from "date-fns";
import { fr } from "date-fns/locale";

/* ─── Data hook ─── */
function useFieldDashboard() {
  const { user } = useStaffUser();
  return useQuery({
    queryKey: ["field-dashboard-pro", user?.id],
    queryFn: async () => {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());
      const startOfWeekISO = new Date(startOfWeek.getFullYear(), startOfWeek.getMonth(), startOfWeek.getDate()).toISOString();

      const [ordersAll, ordersToday, ordersWeek, ordersMonth, commissionsRes, profileRes, recentOrders, leadsRes, leadsWon, leadsLost, recentLeads] = await Promise.all([
        supabase.from("field_sales_orders").select("id, payment_status, sync_status, total_amount, created_at", { count: "exact" })
          .eq("salesperson_id", user!.id),
        supabase.from("field_sales_orders").select("id, total_amount", { count: "exact" })
          .eq("salesperson_id", user!.id).gte("created_at", startOfDay),
        supabase.from("field_sales_orders").select("id", { count: "exact", head: true })
          .eq("salesperson_id", user!.id).gte("created_at", startOfWeekISO),
        supabase.from("field_sales_orders").select("id, total_amount", { count: "exact" })
          .eq("salesperson_id", user!.id).gte("created_at", startOfMonth),
        supabase.from("sales_commissions").select("commission_amount, status")
          .eq("salesperson_id", user!.id),
        supabase.from("profiles").select("full_name, phone, job_title").eq("user_id", user!.id).maybeSingle(),
        supabase.from("field_sales_orders")
          .select("id, customer_name, payment_status, sync_status, total_amount, created_at, services, customer_address")
          .eq("salesperson_id", user!.id).order("created_at", { ascending: false }).limit(8),
        supabase.from("field_leads").select("id, status, created_at", { count: "exact" })
          .eq("agent_id", user!.id).not("status", "in", '("won","lost")'),
        supabase.from("field_leads").select("id", { count: "exact", head: true })
          .eq("agent_id", user!.id).eq("status", "won"),
        supabase.from("field_leads").select("id", { count: "exact", head: true })
          .eq("agent_id", user!.id).eq("status", "lost"),
        supabase.from("field_leads")
          .select("id, first_name, last_name, status, phone, created_at, service_need")
          .eq("agent_id", user!.id).order("created_at", { ascending: false }).limit(5),
      ]);

      const commissions = commissionsRes.data || [];
      const pendingCommissions = commissions
        .filter((c: any) => ["pending", "pending_activation"].includes(c.status))
        .reduce((sum: number, c: any) => sum + Number(c.commission_amount || c.amount || 0), 0);
      const approvedCommissions = commissions
        .filter((c: any) => ["approved", "validated"].includes(c.status))
        .reduce((sum: number, c: any) => sum + Number(c.commission_amount || c.amount || 0), 0);
      const paidCommissions = commissions
        .filter((c: any) => c.status === "paid")
        .reduce((sum: number, c: any) => sum + Number(c.commission_amount || c.amount || 0), 0);
      const totalEarned = approvedCommissions + paidCommissions;

      const allOrders = ordersAll.data || [];
      const pendingPayment = allOrders.filter((o: any) => o.payment_status === "pending").length;
      const syncErrors = allOrders.filter((o: any) => o.sync_status === "error").length;
      const pendingSync = allOrders.filter((o: any) => o.sync_status === "pending").length;

      const todayRevenue = (ordersToday.data || []).reduce((sum: number, o: any) => sum + Number(o.total_amount || 0), 0);
      const monthRevenue = (ordersMonth.data || []).reduce((sum: number, o: any) => sum + Number(o.total_amount || 0), 0);

      // Conversion rate
      const totalLeadsAll = (leadsWon.count ?? 0) + (leadsLost.count ?? 0) + (leadsRes.count ?? 0);
      const conversionRate = totalLeadsAll > 0 ? Math.round(((leadsWon.count ?? 0) / totalLeadsAll) * 100) : 0;

      // Daily goal (target 3 sales/day)
      const dailyGoal = 3;
      const salesTodayCount = ordersToday.count ?? 0;
      const goalProgress = Math.min(100, Math.round((salesTodayCount / dailyGoal) * 100));

      return {
        salesToday: salesTodayCount,
        salesWeek: ordersWeek.count ?? 0,
        salesMonth: ordersMonth.count ?? 0,
        pendingCommissions,
        totalEarned,
        paidCommissions,
        pendingPayment,
        syncErrors,
        pendingSync,
        openLeads: leadsRes.count ?? 0,
        wonLeads: leadsWon.count ?? 0,
        lostLeads: leadsLost.count ?? 0,
        totalOrders: ordersAll.count ?? 0,
        userName: profileRes.data?.full_name ?? null,
        jobTitle: profileRes.data?.job_title ?? "Agent terrain",
        recentOrders: (recentOrders.data || []) as any[],
        recentLeads: (recentLeads.data || []) as any[],
        todayRevenue,
        monthRevenue,
        conversionRate,
        dailyGoal,
        goalProgress,
      };
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 2,
    refetchInterval: 1000 * 60 * 5,
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

const LEAD_STATUS: Record<string, { label: string; classes: string }> = {
  new: { label: "Nouveau", classes: "bg-[#FEF3C7] text-[#D97706]" },
  contacted: { label: "Contacté", classes: "bg-[#E0E7FF] text-[#4338CA]" },
  qualified: { label: "Qualifié", classes: "bg-[#FEF3C7] text-[#D97706]" },
  submitted: { label: "Soumis", classes: "bg-[#DBEAFE] text-[#1D4ED8]" },
  won: { label: "Gagné", classes: "bg-[#DCFCE7] text-[#16A34A]" },
  lost: { label: "Perdu", classes: "bg-[#FEE2E2] text-[#DC2626]" },
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

  const goalMet = (data?.salesToday ?? 0) >= (data?.dailyGoal ?? 3);

  return (
    <div className="space-y-6">
      {/* ═══ HEADER ═══ */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#000000] tracking-tight">
            {greeting()}{data?.userName ? `, ${data.userName.split(" ")[0]}` : ""} 👋
          </h1>
          <p className="text-sm text-[#6B7280] mt-0.5">
            {format(new Date(), "EEEE d MMMM yyyy", { locale: fr })}
          </p>
          <p className="text-xs text-[#9CA3AF] mt-0.5">{data?.jobTitle}</p>
        </div>
        <button
          onClick={() => navigate(fieldPath("/sale/new"))}
          className="flex items-center gap-2 px-5 py-3 rounded-xl bg-[#22C55E] text-white text-sm font-bold hover:bg-[#16A34A] transition-all shadow-md hover:shadow-lg"
        >
          <Plus className="h-4 w-4" />
          Nouvelle vente
        </button>
      </div>

      {/* ═══ DAILY GOAL PROGRESS ═══ */}
      <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", goalMet ? "bg-[#DCFCE7]" : "bg-[#FEF3C7]")}>
              {goalMet ? <Trophy className="h-4 w-4 text-[#16A34A]" /> : <Target className="h-4 w-4 text-[#D97706]" />}
            </div>
            <div>
              <p className="text-sm font-bold text-[#000000]">Objectif du jour</p>
              <p className="text-xs text-[#6B7280]">{data?.salesToday ?? 0} / {data?.dailyGoal ?? 3} ventes</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-[#000000]">{data?.goalProgress ?? 0}%</p>
            {goalMet && <span className="text-[10px] font-bold text-[#16A34A]">🎉 Objectif atteint!</span>}
          </div>
        </div>
        <div className="h-3 rounded-full bg-[#F3F4F6] overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all duration-700", goalMet ? "bg-[#22C55E]" : "bg-[#F59E0B]")}
            style={{ width: `${data?.goalProgress ?? 0}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="text-[10px] text-[#9CA3AF]">Revenu aujourd'hui</span>
          <span className="text-xs font-bold text-[#000000]">{(data?.todayRevenue ?? 0).toFixed(2)} $</span>
        </div>
      </div>

      {/* ═══ KPI GRID — 3x2 ═══ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: "Ventes aujourd'hui", value: data?.salesToday ?? 0, icon: Zap, iconColor: "text-[#22C55E]", iconBg: "bg-[#DCFCE7]", trend: data?.salesToday && data.salesToday > 0 ? `+${data.salesToday}` : undefined },
          { label: "Cette semaine", value: data?.salesWeek ?? 0, icon: BarChart3, iconColor: "text-[#3B82F6]", iconBg: "bg-[#DBEAFE]" },
          { label: "Ce mois", value: data?.salesMonth ?? 0, icon: TrendingUp, iconColor: "text-[#8B5CF6]", iconBg: "bg-[#EDE9FE]", subtitle: `${(data?.monthRevenue ?? 0).toFixed(0)} $ rev.` },
          { label: "Commissions gagnées", value: `${(data?.totalEarned ?? 0).toFixed(2)} $`, icon: DollarSign, iconColor: "text-[#F59E0B]", iconBg: "bg-[#FEF3C7]", subtitle: `${(data?.pendingCommissions ?? 0).toFixed(2)} $ en attente` },
          { label: "Taux de conversion", value: `${data?.conversionRate ?? 0}%`, icon: Target, iconColor: "text-[#EC4899]", iconBg: "bg-[#FCE7F3]", subtitle: `${data?.wonLeads ?? 0} gagnés / ${data?.lostLeads ?? 0} perdus` },
          { label: "Leads ouverts", value: data?.openLeads ?? 0, icon: UserPlus, iconColor: "text-[#06B6D4]", iconBg: "bg-[#CFFAFE]" },
        ].map((w) => (
          <div key={w.label} className="bg-white border border-[#E5E7EB] rounded-2xl p-4 hover:border-[#D1D5DB] transition-colors group">
            <div className="flex items-center justify-between mb-3">
              <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center", w.iconBg)}>
                <w.icon className={cn("h-5 w-5", w.iconColor)} />
              </div>
              {w.trend && (
                <span className="text-[10px] font-bold text-[#16A34A] bg-[#DCFCE7] px-1.5 py-0.5 rounded-md">{w.trend}</span>
              )}
            </div>
            <p className="text-2xl font-bold text-[#000000] tracking-tight">{w.value}</p>
            <p className="text-[11px] text-[#6B7280] font-medium mt-0.5">{w.label}</p>
            {w.subtitle && <p className="text-[10px] text-[#9CA3AF] mt-0.5">{w.subtitle}</p>}
          </div>
        ))}
      </div>

      {/* ═══ ALERTS STRIP ═══ */}
      {((data?.syncErrors ?? 0) > 0 || (data?.pendingPayment ?? 0) > 0 || (data?.pendingSync ?? 0) > 0) && (
        <div className="flex gap-2 flex-wrap">
          {(data?.syncErrors ?? 0) > 0 && (
            <button onClick={() => navigate(fieldPath("/tracking"))} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-[#DC2626] text-xs font-semibold hover:bg-[#FEE2E2] transition-colors">
              <AlertCircle className="h-3.5 w-3.5" /> {data?.syncErrors} erreur{(data?.syncErrors ?? 0) > 1 ? "s" : ""} sync
            </button>
          )}
          {(data?.pendingPayment ?? 0) > 0 && (
            <button onClick={() => navigate(fieldPath("/submissions"))} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#FFFBEB] border border-[#FDE68A] text-[#92400E] text-xs font-semibold hover:bg-[#FEF3C7] transition-colors">
              <Clock className="h-3.5 w-3.5" /> {data?.pendingPayment} paiement{(data?.pendingPayment ?? 0) > 1 ? "s" : ""} en attente
            </button>
          )}
          {(data?.pendingSync ?? 0) > 0 && (
            <button onClick={() => navigate(fieldPath("/tracking"))} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#EFF6FF] border border-[#BFDBFE] text-[#1D4ED8] text-xs font-semibold hover:bg-[#DBEAFE] transition-colors">
              <RefreshCw className="h-3.5 w-3.5" /> {data?.pendingSync} sync en cours
            </button>
          )}
        </div>
      )}

      {/* ═══ QUICK ACTIONS — Grid ═══ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: "Nouvelle vente", icon: ShoppingCart, path: "/sale/new", primary: true },
          { label: "Nouveau lead", icon: UserPlus, path: "/leads/new" },
          { label: "Mes commandes", icon: ArrowRight, path: "/submissions" },
          { label: "Mes leads", icon: UserPlus, path: "/leads" },
          { label: "Catalogue", icon: Star, path: "/offers" },
          { label: "Suivi pipeline", icon: BarChart3, path: "/tracking" },
          { label: "Commissions", icon: DollarSign, path: "/commissions" },
          { label: "Rapport du jour", icon: Calendar, path: "/daily-report" },
        ].map((a) => (
          <button
            key={a.label}
            onClick={() => navigate(fieldPath(a.path))}
            className={cn(
              "flex items-center gap-2.5 p-3.5 rounded-xl border text-left transition-all",
              a.primary
                ? "bg-[#F0FDF4] border-[#BBF7D0] text-[#16A34A] hover:bg-[#DCFCE7] hover:shadow-sm"
                : "bg-white border-[#E5E7EB] text-[#374151] hover:bg-[#F9FAFB] hover:border-[#D1D5DB]"
            )}
          >
            <a.icon className="h-4.5 w-4.5 shrink-0" />
            <span className="text-[13px] font-medium">{a.label}</span>
          </button>
        ))}
      </div>

      {/* ═══ TWO-COLUMN: Recent Orders + Recent Leads ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Recent Orders */}
        <div className="bg-white border border-[#E5E7EB] rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#E5E7EB]">
            <h3 className="text-xs font-bold text-[#6B7280] uppercase tracking-wider">Dernières commandes</h3>
            <button onClick={() => navigate(fieldPath("/submissions"))} className="text-xs text-[#22C55E] hover:text-[#16A34A] font-semibold flex items-center gap-1">
              Tout voir <ChevronRight className="h-3 w-3" />
            </button>
          </div>
          {(data?.recentOrders?.length ?? 0) === 0 ? (
            <div className="p-6 text-center">
              <ShoppingCart className="h-8 w-8 mx-auto mb-2 text-[#D1D5DB]" />
              <p className="text-sm text-[#9CA3AF]">Aucune commande</p>
              <button onClick={() => navigate(fieldPath("/sale/new"))} className="text-xs text-[#22C55E] hover:underline mt-1 font-medium">Créer une vente</button>
            </div>
          ) : (
            <div className="divide-y divide-[#F3F4F6]">
              {data!.recentOrders.slice(0, 5).map((order: any) => {
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
                        <span className="text-sm text-[#000000] font-semibold truncate">{order.customer_name}</span>
                        <SIcon className={cn("h-3.5 w-3.5 shrink-0", syncCfg.color)} />
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={cn("text-[10px] font-semibold", payCfg.color)}>{payCfg.label}</span>
                        <span className="text-[10px] text-[#9CA3AF]">•</span>
                        <span className="text-[10px] font-bold text-[#000000]">{order.total_amount?.toFixed(2)} $</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-[#9CA3AF]">
                        {formatDistanceToNow(new Date(order.created_at), { addSuffix: true, locale: fr })}
                      </span>
                      <ChevronRight className="h-3.5 w-3.5 text-[#D1D5DB]" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Leads */}
        <div className="bg-white border border-[#E5E7EB] rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#E5E7EB]">
            <h3 className="text-xs font-bold text-[#6B7280] uppercase tracking-wider">Derniers leads</h3>
            <button onClick={() => navigate(fieldPath("/leads"))} className="text-xs text-[#22C55E] hover:text-[#16A34A] font-semibold flex items-center gap-1">
              Tout voir <ChevronRight className="h-3 w-3" />
            </button>
          </div>
          {(data?.recentLeads?.length ?? 0) === 0 ? (
            <div className="p-6 text-center">
              <UserPlus className="h-8 w-8 mx-auto mb-2 text-[#D1D5DB]" />
              <p className="text-sm text-[#9CA3AF]">Aucun lead</p>
              <button onClick={() => navigate(fieldPath("/leads/new"))} className="text-xs text-[#22C55E] hover:underline mt-1 font-medium">Ajouter un lead</button>
            </div>
          ) : (
            <div className="divide-y divide-[#F3F4F6]">
              {data!.recentLeads.map((lead: any) => {
                const sc = LEAD_STATUS[lead.status] || LEAD_STATUS.new;
                return (
                  <button
                    key={lead.id}
                    onClick={() => navigate(fieldPath(`/leads/${lead.id}`))}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#F9FAFB] transition-colors text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-[#000000] font-semibold truncate">{lead.first_name} {lead.last_name}</span>
                        <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded", sc.classes)}>{sc.label}</span>
                      </div>
                      <p className="text-[10px] text-[#6B7280] mt-0.5">{lead.service_need || lead.phone || "—"}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-[#9CA3AF]">
                        {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true, locale: fr })}
                      </span>
                      <ChevronRight className="h-3.5 w-3.5 text-[#D1D5DB]" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ═══ PERFORMANCE SUMMARY STRIP ═══ */}
      <div className="bg-gradient-to-r from-[#F0FDF4] to-[#ECFDF5] border border-[#BBF7D0] rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Trophy className="h-5 w-5 text-[#16A34A]" />
          <h3 className="text-sm font-bold text-[#16A34A]">Performance globale</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-2xl font-bold text-[#000000]">{data?.totalOrders ?? 0}</p>
            <p className="text-[10px] text-[#6B7280]">Ventes totales</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-[#000000]">{(data?.monthRevenue ?? 0).toFixed(0)} $</p>
            <p className="text-[10px] text-[#6B7280]">Revenu ce mois</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-[#16A34A]">{(data?.paidCommissions ?? 0).toFixed(2)} $</p>
            <p className="text-[10px] text-[#6B7280]">Commissions payées</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-[#000000]">{data?.conversionRate ?? 0}%</p>
            <p className="text-[10px] text-[#6B7280]">Taux conversion</p>
          </div>
        </div>
      </div>
    </div>
  );
}
