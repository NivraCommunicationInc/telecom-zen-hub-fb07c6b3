/**
 * FieldDashboard — Mobile-first field sales command center.
 * Clean light UI. Professional sales tool.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useStaffUser } from "@/lib/hooks/useStaffUser";
import {
  TrendingUp, DollarSign, UserPlus, Send,
  Package, Loader2, ArrowUpRight, Plus, BarChart3, Clock,
} from "lucide-react";
import { fieldPath } from "@/field-app/lib/fieldPaths";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

function useFieldDashboard() {
  const { user } = useStaffUser();
  return useQuery({
    queryKey: ["field-dashboard", user?.id],
    queryFn: async () => {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();

      const [leadsAll, leadsToday, leadsMonth, commissionsRes, profileRes, recentLeads] = await Promise.all([
        supabase.from("field_leads").select("id, status", { count: "exact" })
          .eq("agent_id", user!.id).not("status", "in", '("won","lost")'),
        supabase.from("field_leads").select("id", { count: "exact", head: true })
          .eq("agent_id", user!.id).eq("status", "submitted").gte("submitted_at", startOfDay),
        supabase.from("field_leads").select("id", { count: "exact", head: true })
          .eq("agent_id", user!.id).eq("status", "submitted").gte("submitted_at", startOfMonth),
        supabase.from("field_commissions").select("amount, status")
          .eq("agent_id", user!.id),
        supabase.from("profiles").select("full_name").eq("user_id", user!.id).maybeSingle(),
        supabase.from("field_leads").select("id, first_name, last_name, status, created_at, service_need")
          .eq("agent_id", user!.id).order("created_at", { ascending: false }).limit(5),
      ]);

      const commissions = commissionsRes.data || [];
      const pendingCommissions = commissions
        .filter((c: any) => c.status === "pending")
        .reduce((sum: number, c: any) => sum + Number(c.amount), 0);
      const totalPaid = commissions
        .filter((c: any) => c.status === "paid")
        .reduce((sum: number, c: any) => sum + Number(c.amount), 0);

      return {
        salesToday: leadsToday.count ?? 0,
        salesMonth: leadsMonth.count ?? 0,
        pendingCommissions,
        totalPaid,
        openLeads: leadsAll.count ?? 0,
        userName: profileRes.data?.full_name ?? null,
        recentLeads: (recentLeads.data || []) as any[],
      };
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 2,
  });
}

const STATUS_COLORS: Record<string, string> = {
  submitted: "bg-[#DBEAFE] text-[#1D4ED8]",
  won: "bg-[#DCFCE7] text-[#16A34A]",
  lost: "bg-[#FEE2E2] text-[#DC2626]",
  new: "bg-[#FEF3C7] text-[#D97706]",
  contacted: "bg-[#E0E7FF] text-[#4338CA]",
  qualified: "bg-[#FEF3C7] text-[#D97706]",
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

      {/* KPI widgets */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Ventes aujourd'hui", value: data?.salesToday ?? 0, icon: TrendingUp, iconColor: "text-[#22C55E]", iconBg: "bg-[#DCFCE7]" },
          { label: "Ventes ce mois", value: data?.salesMonth ?? 0, icon: BarChart3, iconColor: "text-[#3B82F6]", iconBg: "bg-[#DBEAFE]" },
          { label: "Commissions en attente", value: `${(data?.pendingCommissions ?? 0).toFixed(2)} $`, icon: Clock, iconColor: "text-[#F59E0B]", iconBg: "bg-[#FEF3C7]" },
          { label: "Leads ouverts", value: data?.openLeads ?? 0, icon: UserPlus, iconColor: "text-[#8B5CF6]", iconBg: "bg-[#EDE9FE]" },
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
          { label: "Mes leads", icon: UserPlus, path: "/leads" },
          { label: "Offres", icon: Package, path: "/offers" },
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

      {/* Recent leads */}
      <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#E5E7EB]">
          <h3 className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Dernières ventes</h3>
          <button onClick={() => navigate(fieldPath("/leads"))} className="text-xs text-[#22C55E] hover:text-[#16A34A] font-medium">
            Voir tout
          </button>
        </div>
        {(data?.recentLeads?.length ?? 0) === 0 ? (
          <p className="text-sm text-[#9CA3AF] p-4 text-center">Aucune vente encore.</p>
        ) : (
          <div className="divide-y divide-[#F3F4F6]">
            {data!.recentLeads.map((lead: any) => (
              <button
                key={lead.id}
                onClick={() => navigate(fieldPath(`/leads/${lead.id}`))}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#F9FAFB] transition-colors text-left"
              >
                <div>
                  <span className="text-sm text-[#000000] font-medium">
                    {lead.first_name} {lead.last_name}
                  </span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={cn(
                      "text-[10px] font-semibold px-1.5 py-0.5 rounded",
                      STATUS_COLORS[lead.status] || "bg-[#F3F4F6] text-[#6B7280]"
                    )}>
                      {lead.status}
                    </span>
                    {lead.service_need && (
                      <span className="text-[10px] text-[#9CA3AF]">{lead.service_need}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[#9CA3AF]">
                    {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true, locale: fr })}
                  </span>
                  <ArrowUpRight className="h-3.5 w-3.5 text-[#D1D5DB]" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
