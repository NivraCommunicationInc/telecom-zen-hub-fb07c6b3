/**
 * CoreAgentMonitorPage — AI surveillance dashboard.
 * Reads from site_health_checks, lets admin force a scan,
 * shows health score, issues list and 24h history chart.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, RefreshCw, Loader2, AlertTriangle, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

interface HealthCheck {
  id: string;
  check_type: string;
  status: "ok" | "warning" | "critical" | "error";
  title: string;
  description: string | null;
  details: Record<string, unknown> | null;
  auto_fixed: boolean;
  resolved_at: string | null;
  created_at: string;
}

const STATUS_LABEL: Record<string, string> = {
  ok: "OK",
  warning: "AVERTISSEMENT",
  critical: "CRITIQUE",
  error: "ERREUR",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  ok: "secondary",
  warning: "default",
  critical: "destructive",
  error: "destructive",
};

export default function CoreAgentMonitorPage() {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: checks = [], isLoading } = useQuery({
    queryKey: ["site-health-checks"],
    refetchInterval: 600_000,
    queryFn: async (): Promise<HealthCheck[]> => {
      const { data, error } = await supabase
        .from("site_health_checks")
        .select("*")
        .gte("created_at", new Date(Date.now() - 86_400_000).toISOString())
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as HealthCheck[];
    },
  });

  const scanMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("agent-site-monitor");
      if (error) throw error;
      return data;
    },
    onSuccess: (d: { score?: number; critical?: number }) => {
      toast.success(`Scan terminé — Score : ${d?.score ?? "?"}/100`);
      qc.invalidateQueries({ queryKey: ["site-health-checks"] });
    },
    onError: (e: Error) => toast.error("Erreur scan : " + e.message),
  });

  const resolveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("site_health_checks")
        .update({ resolved_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Marqué résolu");
      qc.invalidateQueries({ queryKey: ["site-health-checks"] });
    },
  });

  const active = checks.filter((c) => !c.resolved_at);
  const latestScan = checks[0]?.created_at;
  const latestScore = (checks[0]?.details as { ai_score?: number } | null)?.ai_score ?? null;

  const stats = {
    critical: active.filter((c) => c.status === "critical").length,
    warning: active.filter((c) => c.status === "warning").length,
    ok: active.filter((c) => c.status === "ok").length,
  };

  // Build a 24h score-over-time series from latest score per scan group
  const chartData = (() => {
    const byTime = new Map<string, number>();
    for (const c of [...checks].reverse()) {
      const score = (c.details as { ai_score?: number } | null)?.ai_score;
      if (typeof score === "number") {
        const t = new Date(c.created_at).toISOString().slice(0, 16);
        byTime.set(t, score);
      }
    }
    return Array.from(byTime.entries()).map(([t, score]) => ({ t: t.slice(11), score }));
  })();

  const scoreColor = latestScore == null ? "text-muted-foreground"
    : latestScore < 50 ? "text-destructive"
    : latestScore < 75 ? "text-amber-500" : "text-green-500";

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" />
            Surveillance IA
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Scan automatique toutes les 10 minutes • Analyse Gemini 2.5 Pro
          </p>
        </div>
        <Button onClick={() => scanMutation.mutate()} disabled={scanMutation.isPending}>
          {scanMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
          Forcer un scan maintenant
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase text-muted-foreground">Score global</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-5xl font-bold ${scoreColor}`}>
              {latestScore ?? "—"}<span className="text-xl text-muted-foreground">/100</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {latestScan ? `Mis à jour ${new Date(latestScan).toLocaleString("fr-CA")}` : "Aucun scan"}
            </p>
          </CardContent>
        </Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-muted-foreground">Critiques</CardTitle></CardHeader><CardContent><div className="text-4xl font-bold text-destructive">{stats.critical}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-muted-foreground">Avertissements</CardTitle></CardHeader><CardContent><div className="text-4xl font-bold text-amber-500">{stats.warning}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-muted-foreground">OK</CardTitle></CardHeader><CardContent><div className="text-4xl font-bold text-green-500">{stats.ok}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Score de santé (24h)</CardTitle></CardHeader>
        <CardContent style={{ height: 220 }}>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="t" stroke="hsl(var(--muted-foreground))" />
                <YAxis domain={[0, 100]} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                <Line type="monotone" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-sm text-muted-foreground text-center py-12">Aucune donnée historique.</div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Problèmes détectés ({active.length})</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {isLoading && <div className="text-sm text-muted-foreground"><Loader2 className="w-4 h-4 inline animate-spin mr-2" />Chargement…</div>}
          {!isLoading && active.length === 0 && (
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-500" /> Aucun problème actif.
            </div>
          )}
          {active.map((c) => {
            const Icon = c.status === "critical" || c.status === "error" ? AlertTriangle
              : c.status === "warning" ? AlertCircle : CheckCircle2;
            return (
              <div key={c.id} className="rounded-lg border border-border bg-card p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${
                      c.status === "critical" || c.status === "error" ? "text-destructive" :
                      c.status === "warning" ? "text-amber-500" : "text-green-500"
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={STATUS_VARIANT[c.status]}>{STATUS_LABEL[c.status]}</Badge>
                        <Badge variant="outline">{c.check_type}</Badge>
                        {c.auto_fixed && <Badge variant="secondary">Auto-corrigé</Badge>}
                      </div>
                      <div className="font-semibold mt-2">{c.title}</div>
                      {c.description && <p className="text-sm text-muted-foreground mt-1">{c.description}</p>}
                      <p className="text-xs text-muted-foreground mt-1">{new Date(c.created_at).toLocaleString("fr-CA")}</p>
                      {expanded === c.id && c.details && (
                        <pre className="text-xs bg-muted p-2 rounded mt-2 overflow-x-auto">{JSON.stringify(c.details, null, 2)}</pre>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    {c.details && (
                      <Button size="sm" variant="ghost" onClick={() => setExpanded(expanded === c.id ? null : c.id)}>
                        {expanded === c.id ? "Masquer" : "Détails"}
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => resolveMutation.mutate(c.id)}>
                      Marquer résolu
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
