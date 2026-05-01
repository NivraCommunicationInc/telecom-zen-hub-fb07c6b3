/**
 * CoreCommissionGridPage — Standalone Core page showing the official
 * commission & bonus grid + this-month totals + top 5 agents + DB rules.
 * Route: /core/commissions/grille
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import CommissionGridTables from "@/components/commissions/CommissionGridTables";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, DollarSign, TrendingUp, Trophy, BookOpen } from "lucide-react";

const fmt = (n: number) =>
  new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(n || 0);

function monthBounds() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
  return { start, end };
}

export default function CoreCommissionGridPage() {
  const { start, end } = monthBounds();

  // Total commissions paid this month
  const { data: monthStats, isLoading: l1 } = useQuery({
    queryKey: ["core-grid-month-stats", start, end],
    queryFn: async () => {
      const { data: paid } = await supabase
        .from("field_commissions")
        .select("amount, paid_at, status")
        .gte("paid_at", start)
        .lt("paid_at", end)
        .eq("status", "paid");
      const totalPaid = (paid ?? []).reduce((s: number, c: any) => s + Number(c.amount || 0), 0);

      // Bonuses identified by commission_type='bonus' if exists, else by description
      const { data: bonuses } = await supabase
        .from("field_commissions")
        .select("amount, commission_type, description, paid_at, status")
        .gte("paid_at", start)
        .lt("paid_at", end);
      const totalBonus = (bonuses ?? [])
        .filter((c: any) => (c.commission_type === "bonus") || /bonus/i.test(c.description || ""))
        .reduce((s: number, c: any) => s + Number(c.amount || 0), 0);

      return { totalPaid, totalBonus };
    },
  });

  // Top 5 agents by activated sales this month (orders status=activated)
  const { data: topAgents, isLoading: l2 } = useQuery({
    queryKey: ["core-grid-top-agents", start, end],
    queryFn: async () => {
      const { data: orders } = await supabase
        .from("orders")
        .select("field_agent_id, status, created_at, activated_at, total")
        .gte("created_at", start)
        .lt("created_at", end);
      const counts = new Map<string, { count: number; revenue: number }>();
      (orders ?? []).forEach((o: any) => {
        if (!o.field_agent_id) return;
        if (o.status !== "activated" && o.status !== "completed" && o.status !== "active") return;
        const cur = counts.get(o.field_agent_id) ?? { count: 0, revenue: 0 };
        cur.count += 1;
        cur.revenue += Number(o.total || 0);
        counts.set(o.field_agent_id, cur);
      });
      const ids = Array.from(counts.keys());
      if (!ids.length) return [];
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .in("user_id", ids);
      const profMap = new Map((profs ?? []).map((p: any) => [p.user_id, p]));
      return Array.from(counts.entries())
        .map(([id, v]) => ({
          id,
          name: profMap.get(id)?.full_name || profMap.get(id)?.email || id.slice(0, 8),
          count: v.count,
          revenue: v.revenue,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
    },
  });

  // Live commission rules from DB
  const { data: rules } = useQuery({
    queryKey: ["core-grid-rules-db"],
    queryFn: async () => {
      const { data } = await supabase
        .from("commission_rules")
        .select("applies_to, percentage, notes")
        .eq("role", "field_sales")
        .order("applies_to");
      return data ?? [];
    },
  });

  const { data: bonusRules } = useQuery({
    queryKey: ["core-grid-bonus-rules-db"],
    queryFn: async () => {
      const { data } = await supabase
        .from("field_bonus_rules")
        .select("min_sales, max_sales, bonus_amount")
        .order("min_sales");
      return data ?? [];
    },
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <DollarSign className="h-6 w-6 text-primary" />
          Grille de commission officielle
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Référence officielle pour tous les agents Field Sales — synchronisée avec le moteur de commission.
        </p>
      </div>

      {/* This-month KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card>
          <CardContent className="py-4 px-5">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <DollarSign className="h-3 w-3" /> Commissions payées (ce mois)
            </p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">
              {l1 ? <Loader2 className="h-5 w-5 animate-spin" /> : fmt(monthStats?.totalPaid ?? 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 px-5">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Trophy className="h-3 w-3" /> Bonus payés (ce mois)
            </p>
            <p className="text-2xl font-bold text-primary mt-1">
              {l1 ? <Loader2 className="h-5 w-5 animate-spin" /> : fmt(monthStats?.totalBonus ?? 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 px-5">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> Top agents (ce mois)
            </p>
            <p className="text-2xl font-bold text-foreground mt-1">
              {topAgents?.length ?? 0}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Top 5 agents */}
      <Card>
        <CardContent className="py-4 px-5">
          <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-500" /> Top 5 agents — ventes activées ce mois
          </h2>
          {l2 ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : !topAgents?.length ? (
            <p className="text-xs text-muted-foreground py-4 text-center">Aucune vente activée ce mois.</p>
          ) : (
            <div className="space-y-1.5">
              {topAgents.map((a, i) => (
                <div key={a.id} className="flex items-center justify-between py-2 px-3 rounded-lg border border-border bg-muted/20">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-muted-foreground w-5">#{i + 1}</span>
                    <span className="text-sm font-semibold text-foreground">{a.name}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-primary">{a.count} vente{a.count > 1 ? "s" : ""}</p>
                    <p className="text-[10px] text-muted-foreground">{fmt(a.revenue)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Canonical grids */}
      <CommissionGridTables variant="light" />

      {/* Live DB rules */}
      <Card>
        <CardContent className="py-4 px-5">
          <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" /> Règles actives (commission_rules)
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="text-left font-semibold text-muted-foreground py-1.5 px-2 border-b border-border">Catégorie</th>
                  <th className="text-right font-semibold text-muted-foreground py-1.5 px-2 border-b border-border">% commission</th>
                  <th className="text-left font-semibold text-muted-foreground py-1.5 px-2 border-b border-border">Notes</th>
                </tr>
              </thead>
              <tbody>
                {(rules ?? []).map((r: any, i: number) => (
                  <tr key={i}>
                    <td className="py-1.5 px-2 text-foreground border-b border-border/40 capitalize">{r.applies_to}</td>
                    <td className="py-1.5 px-2 text-right text-primary font-semibold border-b border-border/40">{Number(r.percentage).toFixed(2)} %</td>
                    <td className="py-1.5 px-2 text-muted-foreground border-b border-border/40">{r.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 className="text-xs font-bold text-foreground mt-5 mb-2 flex items-center gap-2">
            <Trophy className="h-3.5 w-3.5 text-amber-500" /> Paliers de bonus actifs (field_bonus_rules)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="text-left font-semibold text-muted-foreground py-1.5 px-2 border-b border-border">Min ventes</th>
                  <th className="text-left font-semibold text-muted-foreground py-1.5 px-2 border-b border-border">Max ventes</th>
                  <th className="text-right font-semibold text-muted-foreground py-1.5 px-2 border-b border-border">Bonus</th>
                </tr>
              </thead>
              <tbody>
                {(bonusRules ?? []).map((b: any, i: number) => (
                  <tr key={i}>
                    <td className="py-1.5 px-2 text-foreground border-b border-border/40">{b.min_sales}</td>
                    <td className="py-1.5 px-2 text-foreground border-b border-border/40">{b.max_sales ?? "∞"}</td>
                    <td className="py-1.5 px-2 text-right text-emerald-600 font-semibold border-b border-border/40">{fmt(Number(b.bonus_amount))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
