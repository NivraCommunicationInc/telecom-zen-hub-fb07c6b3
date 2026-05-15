import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, Loader2 } from "lucide-react";

export default function HubLeaderboard() {
  const [period, setPeriod] = useState<"week" | "month">("month");

  const { data, isLoading } = useQuery({
    queryKey: ["hub-leaderboard", period],
    queryFn: async () => {
      const since = new Date();
      if (period === "week") since.setDate(since.getDate() - 7);
      else since.setDate(1);
      const { data: comm } = await supabase
        .from("field_commissions")
        .select("agent_id, amount")
        .gte("earned_at", since.toISOString());
      const agg: Record<string, { count: number; total: number }> = {};
      (comm || []).forEach((c: any) => {
        const k = c.agent_id;
        if (!k) return;
        agg[k] ||= { count: 0, total: 0 };
        agg[k].count += 1;
        agg[k].total += Number(c.amount || 0);
      });
      const ids = Object.keys(agg);
      if (ids.length === 0) return [];
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", ids);
      const profMap: Record<string, string> = {};
      (profs || []).forEach((p: any) => { profMap[p.user_id] = p.full_name || "Agent"; });
      return ids
        .map((id) => ({ id, name: profMap[id] || "Agent", ...agg[id] }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 20);
    },
  });

  const { data: { user: me } = { user: null as any } } = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data;
    },
  }) as any;

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div className="max-w-3xl">
      <div className="flex gap-2 mb-4">
        {(["week", "month"] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`min-h-[44px] sm:min-h-0 px-4 py-1.5 rounded-full text-xs font-semibold ${period === p ? "bg-violet-600 text-white" : "bg-secondary text-muted-foreground"}`}
          >
            {p === "week" ? "Semaine" : "Mois"}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : !data || data.length === 0 ? (
        <div className="text-center py-16">
          <Trophy className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Aucune commission cette période.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {data.map((row, i) => {
            const isMe = me?.id === row.id;
            return (
              <div key={row.id} className={`flex items-center gap-3 rounded-xl border p-3 ${isMe ? "border-violet-400 bg-violet-50" : "border-border bg-card"}`}>
                <div className="w-8 text-center text-lg">{medals[i] || <span className="text-xs font-bold text-muted-foreground">{i + 1}</span>}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-foreground truncate">{row.name} {isMe && <span className="text-[10px] font-bold text-violet-700">(moi)</span>}</div>
                  <div className="text-[11px] text-muted-foreground">{row.count} vente{row.count > 1 ? "s" : ""}</div>
                </div>
                <div className="text-sm font-bold text-violet-700">{row.total.toFixed(2)} $</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
