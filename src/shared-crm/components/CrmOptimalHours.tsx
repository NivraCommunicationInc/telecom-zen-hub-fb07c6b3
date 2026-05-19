/**
 * CrmOptimalHours — Best hours of day to call based on historical connect rate.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props { isDark?: boolean }
interface Row { hour_of_day: number; total_calls: number; connected: number; connect_rate: number }

export function CrmOptimalHours({ isDark }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["crm-optimal-hours"],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("crm_optimal_call_hours");
      if (error) throw error;
      return (data ?? []) as Row[];
    },
    staleTime: 5 * 60_000,
  });

  const cardCls = isDark ? "rounded-xl bg-gray-900/60 border border-gray-800" : "rounded-xl bg-card border border-border";
  const titleCls = isDark ? "text-white" : "text-foreground";
  const mutedCls = isDark ? "text-gray-400" : "text-muted-foreground";
  const max = Math.max(1, ...(data?.map((d) => Number(d.connect_rate)) ?? [0]));

  return (
    <div className={cn(cardCls, "p-4")}>
      <h3 className={cn("text-sm font-bold flex items-center gap-2 mb-3", titleCls)}>
        <Clock className="h-4 w-4 text-violet-500" />
        Heures optimales (90j)
      </h3>
      {isLoading ? (
        <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-violet-500" /></div>
      ) : !data || data.length === 0 ? (
        <p className={cn("text-xs text-center py-4", mutedCls)}>Pas assez de données historiques.</p>
      ) : (
        <div className="space-y-1.5">
          {data.map((r) => {
            const pct = (Number(r.connect_rate) / max) * 100;
            return (
              <div key={r.hour_of_day} className="flex items-center gap-2 text-[11px]">
                <span className={cn("w-12 tabular-nums", mutedCls)}>{String(r.hour_of_day).padStart(2, "0")}h</span>
                <div className={cn("flex-1 h-3 rounded-full overflow-hidden", isDark ? "bg-gray-800" : "bg-muted")}>
                  <div className="h-full bg-gradient-to-r from-violet-500 to-emerald-500" style={{ width: `${pct}%` }} />
                </div>
                <span className={cn("w-14 text-right tabular-nums font-semibold", titleCls)}>{r.connect_rate}%</span>
                <span className={cn("w-10 text-right tabular-nums", mutedCls)}>{r.total_calls}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
