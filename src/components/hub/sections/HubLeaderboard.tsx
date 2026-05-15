import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

type Period = "weekly" | "monthly";

interface AgentRow {
  agent_id: string;
  full_name: string;
  initials: string;
  sales_count: number;
  total: number;
  is_me: boolean;
}

interface BonusTier {
  min_sales: number;
  max_sales: number | null;
  bonus_amount: number;
  description?: string | null;
}

function startOf(period: Period): string {
  const d = new Date();
  if (period === "weekly") {
    const day = d.getDay();
    const diff = (day + 6) % 7; // Monday start
    d.setDate(d.getDate() - diff);
  } else {
    d.setDate(1);
  }
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function useLeaderboard(period: Period) {
  return useQuery({
    queryKey: ["hub-leaderboard", period],
    queryFn: async (): Promise<{ rows: AgentRow[]; me: string | null }> => {
      const { data: auth } = await supabase.auth.getUser();
      const me = auth.user?.id ?? null;

      const { data: commissions, error } = await supabase
        .from("field_commissions")
        .select("agent_id, amount, status, earned_at, created_at")
        .gte("created_at", startOf(period))
        .in("status", ["approved", "paid", "pending"]);
      if (error) throw error;

      const agg = new Map<string, { total: number; count: number }>();
      (commissions ?? []).forEach((c: any) => {
        if (!c.agent_id) return;
        const cur = agg.get(c.agent_id) ?? { total: 0, count: 0 };
        cur.total += Number(c.amount ?? 0);
        cur.count += 1;
        agg.set(c.agent_id, cur);
      });

      const ids = Array.from(agg.keys());
      let profiles: any[] = [];
      if (ids.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name, first_name, last_name")
          .in("id", ids);
        profiles = profs ?? [];
      }

      const rows: AgentRow[] = ids.map((id) => {
        const p = profiles.find((x) => x.id === id);
        const full =
          p?.full_name ||
          [p?.first_name, p?.last_name].filter(Boolean).join(" ") ||
          "Agent";
        const initials = full
          .split(" ")
          .map((s: string) => s[0])
          .filter(Boolean)
          .slice(0, 2)
          .join("")
          .toUpperCase();
        const a = agg.get(id)!;
        return {
          agent_id: id,
          full_name: full,
          initials,
          sales_count: a.count,
          total: a.total,
          is_me: id === me,
        };
      });

      rows.sort((a, b) => b.total - a.total);
      return { rows, me };
    },
  });
}

function MedalRow({ rank, row }: { rank: number; row: AgentRow }) {
  const medal = rank === 0 ? "🥇" : rank === 1 ? "🥈" : "🥉";
  const pct = Math.min(100, (row.total / TIER_TARGET) * 100);
  return (
    <Card
      className={cn(
        "p-4 flex items-center gap-4",
        row.is_me && "ring-2 ring-purple-500 bg-purple-500/5"
      )}
    >
      <div className="text-3xl w-10 text-center">{medal}</div>
      <div className="w-12 h-12 rounded-full bg-purple-600 text-white grid place-items-center font-bold">
        {row.initials || "?"}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold truncate">
          {row.full_name}
          {row.is_me && <span className="ml-2 text-xs text-purple-400">(vous)</span>}
        </div>
        <div className="text-xs text-muted-foreground">
          {row.sales_count} vente{row.sales_count > 1 ? "s" : ""} · ${row.total.toFixed(2)}
        </div>
        <div className="mt-2">
          <Progress value={pct} className="h-1.5" />
          <div className="text-[10px] text-muted-foreground mt-1">
            Palier bonus : {pct.toFixed(0)}% de ${TIER_TARGET}
          </div>
        </div>
      </div>
    </Card>
  );
}

function StandardRow({ rank, row }: { rank: number; row: AgentRow }) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg border border-border",
        row.is_me && "ring-2 ring-purple-500 bg-purple-500/5"
      )}
    >
      <div className="w-8 text-center text-muted-foreground font-mono">#{rank + 1}</div>
      <div className="w-10 h-10 rounded-full bg-muted grid place-items-center font-semibold">
        {row.initials || "?"}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">
          {row.full_name}
          {row.is_me && <span className="ml-2 text-xs text-purple-400">(vous)</span>}
        </div>
        <div className="text-xs text-muted-foreground">
          {row.sales_count} vente{row.sales_count > 1 ? "s" : ""}
        </div>
      </div>
      <div className="font-semibold tabular-nums">${row.total.toFixed(2)}</div>
    </div>
  );
}

function Board({ period }: { period: Period }) {
  const { data, isLoading } = useLeaderboard(period);
  const rows = data?.rows ?? [];

  if (isLoading) {
    return <div className="text-sm text-muted-foreground p-6">Chargement…</div>;
  }
  if (rows.length === 0) {
    return (
      <Card className="p-10 text-center">
        <Trophy className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
        <div className="text-muted-foreground">Aucun classement disponible</div>
      </Card>
    );
  }

  const top3 = rows.slice(0, 3);
  const rest = rows.slice(3);

  return (
    <div className="space-y-4">
      <div className="grid gap-3">
        {top3.map((r, i) => (
          <MedalRow key={r.agent_id} rank={i} row={r} />
        ))}
      </div>
      {rest.length > 0 && (
        <div className="space-y-2">
          {rest.map((r, i) => (
            <StandardRow key={r.agent_id} rank={i + 3} row={r} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function HubLeaderboard() {
  const [period, setPeriod] = useState<Period>("weekly");
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Classement des agents</h2>
        <p className="text-sm text-muted-foreground">
          Basé sur les commissions field_commissions
        </p>
      </div>
      <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
        <TabsList>
          <TabsTrigger value="weekly">Cette semaine</TabsTrigger>
          <TabsTrigger value="monthly">Ce mois</TabsTrigger>
        </TabsList>
        <TabsContent value="weekly" className="mt-4">
          <Board period="weekly" />
        </TabsContent>
        <TabsContent value="monthly" className="mt-4">
          <Board period="monthly" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
