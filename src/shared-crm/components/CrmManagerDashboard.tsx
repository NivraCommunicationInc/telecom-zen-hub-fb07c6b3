/**
 * CrmManagerDashboard — Per-agent KPIs (calls, sales, conversion, callbacks).
 * Admin-only. Uses RPC `crm_manager_dashboard(days)`.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props { isDark?: boolean }
interface Row {
  agent_id: string;
  agent_name: string;
  total_calls: number;
  total_sales: number;
  conversion_rate: number;
  avg_duration_seconds: number;
  callbacks_pending: number;
}

export function CrmManagerDashboard({ isDark }: Props) {
  const [days, setDays] = useState(7);
  const { data, isLoading } = useQuery({
    queryKey: ["crm-manager-dashboard", days],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("crm_manager_dashboard", { days });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
    refetchInterval: 60_000,
  });

  const cardCls = isDark
    ? "rounded-xl bg-gray-900/60 border border-gray-800"
    : "rounded-xl bg-card border border-border";
  const titleCls = isDark ? "text-white" : "text-foreground";
  const mutedCls = isDark ? "text-gray-400" : "text-muted-foreground";

  return (
    <div className={cn(cardCls, "p-4")}>
      <div className="flex items-center justify-between mb-3">
        <h3 className={cn("text-sm font-bold flex items-center gap-2", titleCls)}>
          <BarChart3 className="h-4 w-4 text-violet-500" />
          Tableau de bord manager
        </h3>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className={cn(
            "text-xs rounded-md border px-2 py-1",
            isDark ? "bg-gray-800 border-gray-700 text-white" : "bg-background border-border text-foreground"
          )}
        >
          <option value={1}>24h</option>
          <option value={7}>7 jours</option>
          <option value={30}>30 jours</option>
          <option value={90}>90 jours</option>
        </select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-violet-500" /></div>
      ) : !data || data.length === 0 ? (
        <p className={cn("text-xs text-center py-4", mutedCls)}>Aucune activité sur la période.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className={cn("text-left border-b", isDark ? "border-gray-800" : "border-border")}>
              <tr className={mutedCls}>
                <th className="py-1.5 pr-2 font-semibold">Agent</th>
                <th className="py-1.5 px-2 font-semibold text-right">Appels</th>
                <th className="py-1.5 px-2 font-semibold text-right">Ventes</th>
                <th className="py-1.5 px-2 font-semibold text-right">Conv.</th>
                <th className="py-1.5 px-2 font-semibold text-right">Durée moy.</th>
                <th className="py-1.5 pl-2 font-semibold text-right">Rappels</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.agent_id} className={cn("border-b last:border-0", isDark ? "border-gray-800/60" : "border-border/60")}>
                  <td className={cn("py-1.5 pr-2 font-medium truncate max-w-[120px]", titleCls)}>{r.agent_name}</td>
                  <td className="py-1.5 px-2 text-right tabular-nums">{r.total_calls}</td>
                  <td className="py-1.5 px-2 text-right tabular-nums font-bold text-emerald-500">{r.total_sales}</td>
                  <td className="py-1.5 px-2 text-right tabular-nums">{r.conversion_rate}%</td>
                  <td className="py-1.5 px-2 text-right tabular-nums">{Math.round(r.avg_duration_seconds)}s</td>
                  <td className="py-1.5 pl-2 text-right tabular-nums">{r.callbacks_pending}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
