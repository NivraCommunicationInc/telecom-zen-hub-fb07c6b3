/**
 * FieldDailyReport — End-of-day summary for field reps.
 * Shows today's activity: sales, leads contacted, revenue, pipeline status.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStaffUser } from "@/lib/hooks/useStaffUser";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Calendar, ShoppingCart, UserPlus, DollarSign, TrendingUp, Loader2, CheckCircle2, Clock, AlertCircle, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

export default function FieldDailyReport() {
  const { user } = useStaffUser();
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();

  const { data, isLoading } = useQuery({
    queryKey: ["field-daily-report", user?.id, startOfDay],
    queryFn: async () => {
      const [salesToday, leadsToday, commissionsToday, profileRes] = await Promise.all([
        supabase.from("field_sales_orders")
          .select("id, customer_name, total_amount, payment_status, sync_status, customer_address, services, created_at")
          .eq("salesperson_id", user!.id).gte("created_at", startOfDay)
          .order("created_at", { ascending: false }),
        supabase.from("field_leads")
          .select("id, first_name, last_name, status, service_need, created_at")
          .eq("agent_id", user!.id).gte("created_at", startOfDay)
          .order("created_at", { ascending: false }),
        supabase.from("sales_commissions")
          .select("commission_amount, status")
          .eq("salesperson_id", user!.id).gte("created_at", startOfDay),
        supabase.from("profiles").select("full_name").eq("user_id", user!.id).maybeSingle(),
      ]);

      const sales = salesToday.data || [];
      const leads = leadsToday.data || [];
      const comms = commissionsToday.data || [];

      const totalRevenue = sales.reduce((sum: number, s: any) => sum + Number(s.total_amount || 0), 0);
      const totalCommissions = comms.reduce((sum: number, c: any) => sum + Number(c.commission_amount || c.amount || 0), 0);
      const paidSales = sales.filter((s: any) => s.payment_status === "confirmed").length;
      const syncedSales = sales.filter((s: any) => s.sync_status === "synced").length;

      return {
        sales,
        leads,
        totalRevenue,
        totalCommissions,
        paidSales,
        syncedSales,
        agentName: profileRes.data?.full_name ?? "Agent",
      };
    },
    enabled: !!user?.id,
  });

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-[#22C55E]" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[#000000]">Rapport du jour</h1>
        <p className="text-sm text-[#6B7280] mt-0.5">
          {format(today, "EEEE d MMMM yyyy", { locale: fr })} — {data?.agentName}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Ventes", value: data?.sales.length ?? 0, icon: ShoppingCart, color: "text-[#22C55E]", bg: "bg-[#DCFCE7]" },
          { label: "Leads créés", value: data?.leads.length ?? 0, icon: UserPlus, color: "text-[#3B82F6]", bg: "bg-[#DBEAFE]" },
          { label: "Revenu", value: `${(data?.totalRevenue ?? 0).toFixed(2)} $`, icon: TrendingUp, color: "text-[#8B5CF6]", bg: "bg-[#EDE9FE]" },
          { label: "Commissions", value: `${(data?.totalCommissions ?? 0).toFixed(2)} $`, icon: DollarSign, color: "text-[#F59E0B]", bg: "bg-[#FEF3C7]" },
        ].map((c) => (
          <div key={c.label} className="bg-white border border-[#E5E7EB] rounded-xl p-4">
            <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center mb-2", c.bg)}>
              <c.icon className={cn("h-4 w-4", c.color)} />
            </div>
            <p className="text-xl font-bold text-[#000000]">{c.value}</p>
            <p className="text-[11px] text-[#6B7280] font-medium">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Pipeline Status */}
      <div className="bg-white border border-[#E5E7EB] rounded-xl p-4">
        <h3 className="text-xs font-bold text-[#6B7280] uppercase tracking-wider mb-3">Statut pipeline</h3>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="h-10 w-10 rounded-full bg-[#DCFCE7] flex items-center justify-center mx-auto mb-1">
              <CheckCircle2 className="h-5 w-5 text-[#16A34A]" />
            </div>
            <p className="text-lg font-bold text-[#000000]">{data?.paidSales ?? 0}</p>
            <p className="text-[10px] text-[#6B7280]">Payées</p>
          </div>
          <div>
            <div className="h-10 w-10 rounded-full bg-[#FEF3C7] flex items-center justify-center mx-auto mb-1">
              <Clock className="h-5 w-5 text-[#D97706]" />
            </div>
            <p className="text-lg font-bold text-[#000000]">{(data?.sales.length ?? 0) - (data?.paidSales ?? 0)}</p>
            <p className="text-[10px] text-[#6B7280]">En attente</p>
          </div>
          <div>
            <div className="h-10 w-10 rounded-full bg-[#DBEAFE] flex items-center justify-center mx-auto mb-1">
              <TrendingUp className="h-5 w-5 text-[#3B82F6]" />
            </div>
            <p className="text-lg font-bold text-[#000000]">{data?.syncedSales ?? 0}</p>
            <p className="text-[10px] text-[#6B7280]">Synchronisées</p>
          </div>
        </div>
      </div>

      {/* Sales List */}
      <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#E5E7EB]">
          <h3 className="text-xs font-bold text-[#6B7280] uppercase tracking-wider">Ventes du jour ({data?.sales.length ?? 0})</h3>
        </div>
        {(data?.sales.length ?? 0) === 0 ? (
          <p className="p-6 text-center text-sm text-[#9CA3AF]">Aucune vente aujourd'hui</p>
        ) : (
          <div className="divide-y divide-[#F3F4F6]">
            {data!.sales.map((sale: any) => (
              <div key={sale.id} className="px-4 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[#000000]">{sale.customer_name}</p>
                    {sale.customer_address && (
                      <p className="text-[10px] text-[#6B7280] flex items-center gap-1 mt-0.5">
                        <MapPin className="h-3 w-3" /> {sale.customer_address}
                      </p>
                    )}
                  </div>
                  <p className="text-sm font-bold text-[#000000]">{sale.total_amount?.toFixed(2)} $</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Leads List */}
      {(data?.leads.length ?? 0) > 0 && (
        <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#E5E7EB]">
            <h3 className="text-xs font-bold text-[#6B7280] uppercase tracking-wider">Leads du jour ({data?.leads.length})</h3>
          </div>
          <div className="divide-y divide-[#F3F4F6]">
            {data!.leads.map((lead: any) => (
              <div key={lead.id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-[#000000]">{lead.first_name} {lead.last_name}</p>
                  <p className="text-[10px] text-[#6B7280]">{lead.service_need || "—"}</p>
                </div>
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#F3F4F6] text-[#374151]">{lead.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
