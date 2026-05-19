/**
 * CrmLeaderboard — Top agents (today / week / month).
 */
import { useState } from "react";
import { Trophy, TrendingUp, Phone } from "lucide-react";
import { useCrmLeaderboard } from "../hooks/useCrmLeaderboard";
import { cn } from "@/lib/utils";

type Period = "today" | "week" | "month";

export function CrmLeaderboard({ darkPortal = false }: { darkPortal?: boolean }) {
  const [period, setPeriod] = useState<Period>("today");
  const { data: rows = [], isLoading } = useCrmLeaderboard();

  const getCalls = (r: typeof rows[number]) =>
    period === "today" ? r.calls_today : period === "week" ? r.calls_week : r.calls_month;
  const getSales = (r: typeof rows[number]) =>
    period === "today" ? r.sales_today : period === "week" ? r.sales_week : r.sales_month;

  const sorted = [...rows].sort((a, b) => getSales(b) - getSales(a) || getCalls(b) - getCalls(a));

  const panelCls = darkPortal
    ? "rounded-xl bg-gray-800 border border-gray-700"
    : "rounded-xl bg-card border border-border";
  const titleCls = darkPortal ? "text-white" : "text-foreground";
  const mutedCls = darkPortal ? "text-gray-400" : "text-muted-foreground";

  return (
    <div className={cn(panelCls, "p-4")}>
      <div className="flex items-center justify-between mb-3">
        <h2 className={cn("text-sm font-bold flex items-center gap-2", titleCls)}>
          <Trophy className="h-4 w-4 text-amber-400" />
          Leaderboard
        </h2>
        <div className="flex gap-1">
          {(["today", "week", "month"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                "px-2 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wide transition-colors",
                period === p
                  ? "bg-violet-600 text-white"
                  : darkPortal
                  ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {p === "today" ? "Jour" : p === "week" ? "Sem." : "Mois"}
            </button>
          ))}
        </div>
      </div>
      {isLoading ? (
        <div className={cn("text-xs", mutedCls)}>Chargement…</div>
      ) : sorted.length === 0 ? (
        <div className={cn("text-xs", mutedCls)}>Aucune activité pour cette période.</div>
      ) : (
        <ol className="space-y-1.5">
          {sorted.slice(0, 10).map((r, i) => (
            <li
              key={r.agent_id}
              className={cn(
                "flex items-center gap-2 px-2 py-1.5 rounded-md",
                i === 0 && "bg-amber-500/10",
                i === 1 && "bg-gray-400/10",
                i === 2 && "bg-orange-700/10"
              )}
            >
              <span className={cn(
                "w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold shrink-0",
                i === 0 ? "bg-amber-500 text-white"
                  : i === 1 ? "bg-gray-400 text-white"
                  : i === 2 ? "bg-orange-700 text-white"
                  : darkPortal ? "bg-gray-700 text-gray-300" : "bg-muted text-muted-foreground"
              )}>
                {i + 1}
              </span>
              <span className={cn("flex-1 text-xs font-medium truncate", titleCls)}>
                {r.agent_name || "Agent"}
              </span>
              <span className="flex items-center gap-1 text-[10px] text-emerald-500 font-bold">
                <Trophy className="h-3 w-3" />
                {getSales(r)}
              </span>
              <span className={cn("flex items-center gap-1 text-[10px]", mutedCls)}>
                <Phone className="h-3 w-3" />
                {getCalls(r)}
              </span>
              {period === "today" && (
                <span className="flex items-center gap-0.5 text-[10px] text-violet-400 font-semibold">
                  <TrendingUp className="h-3 w-3" />
                  {r.conversion_rate_today}%
                </span>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
