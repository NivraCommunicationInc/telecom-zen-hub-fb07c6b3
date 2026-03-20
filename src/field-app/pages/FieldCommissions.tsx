/**
 * FieldCommissions — Commission tracking. Clean light UI.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStaffUser } from "@/lib/hooks/useStaffUser";
import { DollarSign, Loader2, Clock, Check, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: typeof Clock }> = {
  pending: { label: "En attente", color: "text-[#D97706]", bg: "bg-[#FEF3C7]", icon: Clock },
  approved: { label: "Approuvé", color: "text-[#3B82F6]", bg: "bg-[#DBEAFE]", icon: Check },
  paid: { label: "Payé", color: "text-[#16A34A]", bg: "bg-[#DCFCE7]", icon: Check },
  clawback: { label: "Récupéré", color: "text-[#DC2626]", bg: "bg-[#FEE2E2]", icon: AlertTriangle },
};

export default function FieldCommissions() {
  const { user } = useStaffUser();

  const { data, isLoading } = useQuery({
    queryKey: ["field-commissions", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("field_commissions")
        .select("*")
        .eq("agent_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const commissions = data || [];
  const totalPending = commissions.filter((c: any) => c.status === "pending").reduce((sum: number, c: any) => sum + Number(c.amount), 0);
  const totalApproved = commissions.filter((c: any) => c.status === "approved").reduce((sum: number, c: any) => sum + Number(c.amount), 0);
  const totalPaid = commissions.filter((c: any) => c.status === "paid").reduce((sum: number, c: any) => sum + Number(c.amount), 0);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-[#000000]">Commissions</h1>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-[#22C55E]" /></div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white border border-[#E5E7EB] rounded-xl p-4">
              <p className="text-[11px] text-[#6B7280] font-medium">En attente</p>
              <p className="text-lg font-bold text-[#D97706] mt-1">{totalPending.toFixed(2)} $</p>
            </div>
            <div className="bg-white border border-[#E5E7EB] rounded-xl p-4">
              <p className="text-[11px] text-[#6B7280] font-medium">Approuvé</p>
              <p className="text-lg font-bold text-[#3B82F6] mt-1">{totalApproved.toFixed(2)} $</p>
            </div>
            <div className="bg-white border border-[#E5E7EB] rounded-xl p-4">
              <p className="text-[11px] text-[#6B7280] font-medium">Payé</p>
              <p className="text-lg font-bold text-[#16A34A] mt-1">{totalPaid.toFixed(2)} $</p>
            </div>
          </div>

          {commissions.length === 0 ? (
            <div className="text-center py-12">
              <DollarSign className="h-8 w-8 mx-auto mb-2 text-[#D1D5DB]" />
              <p className="text-sm text-[#9CA3AF]">Aucune commission</p>
            </div>
          ) : (
            <div className="space-y-2">
              {commissions.map((c: any) => {
                const sc = STATUS_CONFIG[c.status] || STATUS_CONFIG.pending;
                const Icon = sc.icon;
                return (
                  <div key={c.id} className="flex items-center justify-between p-4 rounded-xl border border-[#E5E7EB] bg-white">
                    <div className="flex items-center gap-3">
                      <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center", sc.bg)}>
                        <Icon className={cn("h-4 w-4", sc.color)} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-[#000000]">{Number(c.amount).toFixed(2)} $</span>
                          <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded", sc.color, sc.bg)}>{sc.label}</span>
                        </div>
                        {c.notes && <p className="text-xs text-[#6B7280] mt-0.5">{c.notes}</p>}
                      </div>
                    </div>
                    <span className="text-[10px] text-[#9CA3AF]">
                      {formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: fr })}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
