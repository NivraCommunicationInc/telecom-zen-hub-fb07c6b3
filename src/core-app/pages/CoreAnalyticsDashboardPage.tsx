/**
 * CoreAnalyticsDashboardPage — AI-powered business analytics dashboard.
 * Reads analytics_reports + live KPIs, lets admin force generation,
 * surfaces Gemini 2.5 Pro analysis and recommendations.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Loader2, RefreshCw, TrendingUp, Users, ShoppingCart, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend,
} from "recharts";

interface AnalyticsReport {
  id: string;
  report_type: string;
  period_start: string;
  period_end: string;
  metrics: Record<string, unknown>;
  ai_analysis: string | null;
  ai_recommendations: {
    summary?: string;
    positives?: string[];
    concerns?: string[];
    recommendations?: string[];
    forecast?: string;
    actions?: string[];
  } | null;
  generated_at: string;
}

const COLORS = ["hsl(var(--primary))", "#10b981", "#f59e0b", "#ef4444", "#3b82f6", "#8b5cf6"];

const money = (n: unknown) =>
  Number(n ?? 0).toLocaleString("fr-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " $";

export default function CoreAnalyticsDashboardPage() {
  const qc = useQueryClient();

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["analytics-reports"],
    queryFn: async (): Promise<AnalyticsReport[]> => {
      const { data, error } = await supabase
        .from("analytics_reports")
        .select("*")
        .order("generated_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as AnalyticsReport[];
    },
  });

  const generateMutation = useMutation({
    mutationFn: async (type: "daily" | "weekly") => {
      const { data, error } = await supabase.functions.invoke("agent-analytics", {
        body: { report_type: type },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Rapport généré");
      qc.invalidateQueries({ queryKey: ["analytics-reports"] });
    },
    onError: (e: Error) => toast.error("Erreur : " + e.message),
  });

  const latest = reports[0];
  const m = (latest?.metrics ?? {}) as Record<string, number | Record<string, number>>;
  const ai = latest?.ai_recommendations ?? null;

  const ordersByPlan = Object.entries((m.orders_by_plan ?? {}) as Record<string, number>)
    .map(([name, value]) => ({ name, value }));
  const complaintsByCategory = Object.entries((m.complaints_by_category ?? {}) as Record<string, number>)
    .map(([name, value]) => ({ name, value }));

  // MRR trend across weekly reports
  const mrrTrend = [...reports].reverse()
    .filter((r) => r.report_type === "weekly")
    .map((r) => ({
      week: r.period_end,
      mrr: Number((r.metrics as { mrr?: number }).mrr ?? 0),
    }));

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary" />
            Analytics IA
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {latest ? `Dernier rapport : ${new Date(latest.generated_at).toLocaleString("fr-CA")}` : "Aucun rapport"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => generateMutation.mutate("daily")} disabled={generateMutation.isPending}>
            {generateMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Rapport quotidien
          </Button>
          <Button onClick={() => generateMutation.mutate("weekly")} disabled={generateMutation.isPending}>
            {generateMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Rapport hebdomadaire
          </Button>
        </div>
      </div>

      {isLoading && <div className="text-sm text-muted-foreground"><Loader2 className="w-4 h-4 inline animate-spin mr-2" />Chargement…</div>}

      {latest && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card><CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-muted-foreground flex items-center gap-1"><TrendingUp className="w-3 h-3" /> MRR</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{money(m.mrr)}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-muted-foreground flex items-center gap-1"><Users className="w-3 h-3" /> Nouveaux clients</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{Number(m.new_clients ?? 0)}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-muted-foreground flex items-center gap-1"><ShoppingCart className="w-3 h-3" /> Commandes</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{Number(m.new_orders ?? 0)}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-muted-foreground flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Plaintes</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{Number(m.total_complaints ?? 0)}</div></CardContent></Card>
          </div>

          {ai && (
            <Card className="border-primary/30 bg-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Badge variant="default">Analyse Gemini 2.5 Pro</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {ai.summary && (
                  <div>
                    <h4 className="font-semibold text-sm mb-1">Résumé exécutif</h4>
                    <p className="text-sm text-foreground">{ai.summary}</p>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {ai.positives && ai.positives.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-sm mb-2 text-green-500">Points positifs</h4>
                      <ul className="text-sm space-y-1 list-disc list-inside text-foreground">{ai.positives.map((p, i) => <li key={i}>{p}</li>)}</ul>
                    </div>
                  )}
                  {ai.concerns && ai.concerns.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-sm mb-2 text-amber-500">Points d'attention</h4>
                      <ul className="text-sm space-y-1 list-disc list-inside text-foreground">{ai.concerns.map((c, i) => <li key={i}>{c}</li>)}</ul>
                    </div>
                  )}
                </div>
                {ai.recommendations && ai.recommendations.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-sm mb-2">Recommandations prioritaires</h4>
                    <div className="grid gap-2">{ai.recommendations.map((r, i) => (
                      <div key={i} className="p-3 rounded-md bg-card border border-border text-sm">{r}</div>
                    ))}</div>
                  </div>
                )}
                {ai.forecast && (
                  <div>
                    <h4 className="font-semibold text-sm mb-1">Prévision MRR</h4>
                    <p className="text-2xl font-bold text-primary">{ai.forecast}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {mrrTrend.length > 1 && (
              <Card>
                <CardHeader><CardTitle>Tendance MRR</CardTitle></CardHeader>
                <CardContent style={{ height: 250 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={mrrTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="week" stroke="hsl(var(--muted-foreground))" />
                      <YAxis stroke="hsl(var(--muted-foreground))" />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                      <Bar dataKey="mrr" fill="hsl(var(--primary))" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
            {ordersByPlan.length > 0 && (
              <Card>
                <CardHeader><CardTitle>Commandes par forfait</CardTitle></CardHeader>
                <CardContent style={{ height: 250 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={ordersByPlan} dataKey="value" nameKey="name" outerRadius={80} label>
                        {ordersByPlan.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
            {complaintsByCategory.length > 0 && (
              <Card>
                <CardHeader><CardTitle>Plaintes par catégorie</CardTitle></CardHeader>
                <CardContent style={{ height: 250 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={complaintsByCategory} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" stroke="hsl(var(--muted-foreground))" />
                      <YAxis dataKey="name" type="category" stroke="hsl(var(--muted-foreground))" width={120} />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                      <Bar dataKey="value" fill="#f59e0b" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </div>
        </>
      )}

      <Card>
        <CardHeader><CardTitle>Historique des rapports</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {reports.map((r) => (
              <div key={r.id} className="flex items-center justify-between p-3 border border-border rounded-md">
                <div>
                  <div className="font-semibold capitalize">{r.report_type}</div>
                  <div className="text-xs text-muted-foreground">{r.period_start} → {r.period_end}</div>
                </div>
                <div className="text-xs text-muted-foreground">{new Date(r.generated_at).toLocaleString("fr-CA")}</div>
              </div>
            ))}
            {reports.length === 0 && <div className="text-sm text-muted-foreground">Aucun rapport généré.</div>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
