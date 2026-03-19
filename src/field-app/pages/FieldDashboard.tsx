/**
 * FieldDashboard — Mobile-first field sales command center.
 * Shows today's sales, month total, pending commissions, leads, orders.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  TrendingUp, DollarSign, UserPlus, Send, Search,
  Package, Loader2, ArrowUpRight, Clock,
} from "lucide-react";
import { useState } from "react";
import { fieldPath } from "@/field-app/lib/fieldPaths";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

function useFieldDashboard() {
  const { user } = useAuth();
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
      const totalEarned = commissions
        .filter((c: any) => c.status === "approved" || c.status === "paid")
        .reduce((sum: number, c: any) => sum + Number(c.amount), 0);

      return {
        salesToday: leadsToday.count ?? 0,
        salesMonth: leadsMonth.count ?? 0,
        pendingCommissions,
        totalEarned,
        openLeads: leadsAll.count ?? 0,
        submittedOrders: (leadsAll.data || []).filter((l: any) => l.status === "submitted").length,
        userName: profileRes.data?.full_name ?? null,
        recentLeads: (recentLeads.data || []) as any[],
      };
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 2,
  });
}

export default function FieldDashboard() {
  const navigate = useNavigate();
  const { data, isLoading } = useFieldDashboard();

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Bonjour";
    if (h < 18) return "Bon après-midi";
    return "Bonsoir";
  };

  const widgets = [
    { label: "Ventes aujourd'hui", value: data?.salesToday ?? 0, icon: TrendingUp, color: "text-emerald-400", bg: "bg-emerald-500/10" },
    { label: "Ventes ce mois", value: data?.salesMonth ?? 0, icon: Send, color: "text-blue-400", bg: "bg-blue-500/10" },
    { label: "Commissions en attente", value: `${(data?.pendingCommissions ?? 0).toFixed(2)} $`, icon: DollarSign, color: "text-amber-400", bg: "bg-amber-500/10" },
    { label: "Leads ouverts", value: data?.openLeads ?? 0, icon: UserPlus, color: "text-purple-400", bg: "bg-purple-500/10" },
  ];

  const quickActions = [
    { label: "Nouveau lead", icon: UserPlus, action: () => navigate(fieldPath("/leads/new")), primary: true },
    { label: "Mes leads", icon: Search, action: () => navigate(fieldPath("/leads")) },
    { label: "Offres", icon: Package, action: () => navigate(fieldPath("/offers")) },
    { label: "Suivi", icon: TrendingUp, action: () => navigate(fieldPath("/tracking")) },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight">
          {greeting()}{data?.userName ? `, ${data.userName.split(" ")[0]}` : ""}
        </h1>
        <p className="text-sm text-[hsl(220,10%,45%)] mt-0.5">
          {new Date().toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long" })}
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-amber-500" />
        </div>
      ) : (
        <>
          {/* Quick actions — mobile-first large tap targets */}
          <div className="grid grid-cols-2 gap-2">
            {quickActions.map((a) => (
              <button
                key={a.label}
                onClick={a.action}
                className={cn(
                  "flex items-center gap-2.5 p-3.5 rounded-xl border transition-colors text-left",
                  a.primary
                    ? "bg-amber-600/15 border-amber-500/30 text-amber-400 hover:bg-amber-600/25"
                    : "bg-[hsl(225,20%,8%)] border-[hsl(225,15%,14%)] text-[hsl(220,10%,55%)] hover:text-white hover:border-[hsl(225,15%,20%)]"
                )}
              >
                <a.icon className="h-5 w-5 shrink-0" />
                <span className="text-sm font-medium">{a.label}</span>
              </button>
            ))}
          </div>

          {/* Widgets */}
          <div className="grid grid-cols-2 gap-2.5">
            {widgets.map((w) => (
              <div
                key={w.label}
                className="p-4 rounded-xl border border-[hsl(225,15%,12%)] bg-[hsl(225,20%,7%)]"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", w.bg)}>
                    <w.icon className={cn("h-4 w-4", w.color)} />
                  </div>
                </div>
                <p className="text-xl font-bold text-white">{w.value}</p>
                <p className="text-[10px] text-[hsl(220,10%,42%)] font-medium mt-0.5">{w.label}</p>
              </div>
            ))}
          </div>

          {/* Recent leads */}
          <div className="rounded-xl border border-[hsl(225,15%,12%)] bg-[hsl(225,20%,7%)]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[hsl(225,15%,11%)]">
              <h3 className="text-xs font-semibold text-[hsl(220,10%,50%)] uppercase tracking-wider">Derniers leads</h3>
              <button onClick={() => navigate(fieldPath("/leads"))} className="text-[10px] text-amber-400 hover:text-amber-300">
                Voir tout
              </button>
            </div>
            {(data?.recentLeads?.length ?? 0) === 0 ? (
              <p className="text-xs text-[hsl(220,10%,30%)] p-4">Aucun lead encore.</p>
            ) : (
              <div className="divide-y divide-[hsl(225,15%,10%)]">
                {data!.recentLeads.map((lead: any) => (
                  <button
                    key={lead.id}
                    onClick={() => navigate(fieldPath(`/leads/${lead.id}`))}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-[hsl(225,20%,9%)] transition-colors text-left"
                  >
                    <div>
                      <span className="text-sm text-white font-medium">
                        {lead.first_name} {lead.last_name}
                      </span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={cn(
                          "text-[10px] font-medium px-1.5 py-0.5 rounded",
                          lead.status === "submitted" || lead.status === "won"
                            ? "text-emerald-400 bg-emerald-500/10"
                            : lead.status === "lost"
                            ? "text-red-400 bg-red-500/10"
                            : "text-amber-400 bg-amber-500/10"
                        )}>
                          {lead.status}
                        </span>
                        {lead.service_need && (
                          <span className="text-[10px] text-[hsl(220,10%,40%)]">{lead.service_need}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-[hsl(220,10%,35%)]">
                        {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true, locale: fr })}
                      </span>
                      <ArrowUpRight className="h-3.5 w-3.5 text-[hsl(220,10%,25%)]" />
                    </div>
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
