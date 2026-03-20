/**
 * FieldCommissions — Commission tracking for field agents.
 * Pending → Approved → Paid. Read-only financials.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStaffUser } from "@/lib/hooks/useStaffUser";
import { DollarSign, Loader2, Clock, Check, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: typeof Clock }> = {
  pending: { label: "En attente", color: "text-amber-400", bg: "bg-amber-500/10", icon: Clock },
  approved: { label: "Approuvé", color: "text-blue-400", bg: "bg-blue-500/10", icon: Check },
  paid: { label: "Payé", color: "text-emerald-400", bg: "bg-emerald-500/10", icon: Check },
  clawback: { label: "Récupéré", color: "text-red-400", bg: "bg-red-500/10", icon: AlertTriangle },
};

export default function FieldCommissions() {
  const { user } = useAuth();

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
  const totalPending = commissions
    .filter((c: any) => c.status === "pending")
    .reduce((sum: number, c: any) => sum + Number(c.amount), 0);
  const totalApproved = commissions
    .filter((c: any) => c.status === "approved")
    .reduce((sum: number, c: any) => sum + Number(c.amount), 0);
  const totalPaid = commissions
    .filter((c: any) => c.status === "paid")
    .reduce((sum: number, c: any) => sum + Number(c.amount), 0);

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold tracking-tight">Commissions</h1>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-amber-500" />
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-2">
            <div className="p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/5">
              <p className="text-[10px] text-amber-400/70 font-medium">En attente</p>
              <p className="text-lg font-bold text-amber-400 mt-1">{totalPending.toFixed(2)} $</p>
            </div>
            <div className="p-3.5 rounded-xl border border-blue-500/20 bg-blue-500/5">
              <p className="text-[10px] text-blue-400/70 font-medium">Approuvé</p>
              <p className="text-lg font-bold text-blue-400 mt-1">{totalApproved.toFixed(2)} $</p>
            </div>
            <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
              <p className="text-[10px] text-emerald-400/70 font-medium">Payé</p>
              <p className="text-lg font-bold text-emerald-400 mt-1">{totalPaid.toFixed(2)} $</p>
            </div>
          </div>

          {/* Commission list */}
          {commissions.length === 0 ? (
            <div className="text-center py-12">
              <DollarSign className="h-8 w-8 mx-auto mb-2 text-[hsl(220,10%,20%)]" />
              <p className="text-sm text-[hsl(220,10%,35%)]">Aucune commission</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {commissions.map((c: any) => {
                const sc = STATUS_CONFIG[c.status] || STATUS_CONFIG.pending;
                const Icon = sc.icon;
                return (
                  <div
                    key={c.id}
                    className="flex items-center justify-between p-4 rounded-xl border border-[hsl(225,15%,12%)] bg-[hsl(225,20%,7%)]"
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", sc.bg)}>
                        <Icon className={cn("h-4 w-4", sc.color)} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white">{Number(c.amount).toFixed(2)} $</span>
                          <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded", sc.color, sc.bg)}>
                            {sc.label}
                          </span>
                        </div>
                        {c.notes && (
                          <p className="text-[10px] text-[hsl(220,10%,40%)] mt-0.5">{c.notes}</p>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] text-[hsl(220,10%,30%)]">
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
