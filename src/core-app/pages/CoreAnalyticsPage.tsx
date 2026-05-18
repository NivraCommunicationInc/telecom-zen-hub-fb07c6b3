/**
 * CoreAnalyticsPage — Feature 2 business analytics dashboard.
 * Reads mrr_metrics, churn_metrics, growth_metrics, nps_score views.
 */
import { useEffect, useState } from "react";
import { backendClient } from "@/integrations/backend/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { DollarSign, Users, TrendingDown, Smile, Download, Target, Wallet, Activity, Coins } from "lucide-react";

const fmtCAD = (n: number) => new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(n || 0);
const fmtMonth = (d: string) => new Date(d).toLocaleDateString("fr-CA", { month: "short", year: "numeric" });

export default function CoreAnalyticsPage() {
  const [mrr, setMrr] = useState<any>(null);
  const [churn, setChurn] = useState<any[]>([]);
  const [growth, setGrowth] = useState<any[]>([]);
  const [nps, setNps] = useState<any>(null);
  const [cac, setCac] = useState<any>(null);
  const [ltv, setLtv] = useState<any>(null);
  const [profit, setProfit] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    (async () => {
      const [m, c, g, n, ca, lt, pr] = await Promise.all([
        backendClient.from("mrr_metrics" as any).select("*").maybeSingle(),
        backendClient.from("churn_metrics" as any).select("*").limit(12),
        backendClient.from("growth_metrics" as any).select("*").limit(12),
        backendClient.from("nps_score" as any).select("*").maybeSingle(),
        backendClient.from("cac_metric" as any).select("*").maybeSingle(),
        backendClient.from("ltv_metric" as any).select("*").maybeSingle(),
        backendClient.from("profit_per_client" as any).select("*").maybeSingle(),
      ]);
      setMrr(m.data); setChurn((c.data as any[]) || []); setGrowth((g.data as any[]) || []); setNps(n.data);
      setCac(ca.data); setLtv(lt.data); setProfit(pr.data);
      setLoading(false);
    })();
  }, []);

  const runWeeklyReport = async () => {
    setRunning(true);
    const { error } = await backendClient.functions.invoke("weekly-sales-report", { body: {} });
    setRunning(false);
    if (error) toast.error("Erreur lors de l'envoi du rapport");
    else toast.success("Rapport envoyé par courriel à l'admin");
  };

  const npsScore = Math.round(Number(nps?.nps_score || 0));
  const npsColor = npsScore < 0 ? "#dc2626" : npsScore < 30 ? "#f59e0b" : npsScore < 70 ? "#10b981" : "#065f46";

  const growthChart = [...growth].reverse().map((g) => ({ month: fmtMonth(g.month), new_subscriptions: Number(g.new_subscriptions), new_mrr: Number(g.new_mrr) }));
  const churnRows = churn.map((c) => ({ month: fmtMonth(c.month), churned: Number(c.churned_count), rate: Number(c.churn_rate_pct || 0) }));

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Analytics</h1>
          <p className="text-slate-500 mt-1">MRR, ARR, NPS, churn, croissance</p>
        </div>
        <Button onClick={runWeeklyReport} disabled={running} variant="outline">
          <Download className="w-4 h-4 mr-2" />{running ? "Envoi…" : "Envoyer rapport hebdo"}
        </Button>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card><CardContent className="p-4"><p className="text-xs text-slate-500">MRR</p><p className="text-xl font-bold">{loading ? "…" : fmtCAD(Number(mrr?.mrr))}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-slate-500">ARR</p><p className="text-xl font-bold">{loading ? "…" : fmtCAD(Number(mrr?.arr))}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-slate-500">Abonnés actifs</p><p className="text-xl font-bold">{loading ? "…" : mrr?.active_subscriptions || 0}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-slate-500">ARPU</p><p className="text-xl font-bold">{loading ? "…" : fmtCAD(Number(mrr?.arpu))}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-slate-500">Churn (dernier mois)</p><p className="text-xl font-bold">{churnRows[0] ? `${churnRows[0].rate.toFixed(1)}%` : "—"}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-slate-500">NPS</p><p className="text-xl font-bold" style={{ color: npsColor }}>{loading ? "…" : npsScore}</p></CardContent></Card>
      </div>

      {/* Métriques d'acquisition — CAC / LTV / Ratio / Profit */}
      {(() => {
        const cacVal = Number(cac?.cac_per_client || 0);
        const ltvVal = Number(ltv?.ltv || 0);
        const ratio = cacVal > 0 ? ltvVal / cacVal : 0;
        const ratioColor = ratio < 2 ? "#dc2626" : ratio < 3 ? "#f59e0b" : "#10b981";
        const ratioLabel = ratio < 2 ? "Insuffisant" : ratio < 3 ? "Acceptable" : "Excellent";
        return (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold flex items-center gap-2"><Target className="w-5 h-5" />Métriques d'acquisition</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-slate-500 flex items-center gap-1"><Wallet className="w-3 h-3" />CAC</p>
                  <p className="text-2xl font-bold mt-1">{loading ? "…" : fmtCAD(cacVal)}</p>
                  <p className="text-xs text-slate-400 mt-1">Coût moyen par client acquis</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-slate-500 flex items-center gap-1"><Coins className="w-3 h-3" />LTV</p>
                  <p className="text-2xl font-bold mt-1">{loading ? "…" : fmtCAD(ltvVal)}</p>
                  <p className="text-xs text-slate-400 mt-1">Revenu total par client</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-slate-500 flex items-center gap-1"><Activity className="w-3 h-3" />Ratio LTV/CAC</p>
                  <p className="text-2xl font-bold mt-1" style={{ color: ratioColor }}>
                    {loading ? "…" : (cacVal > 0 ? `${ratio.toFixed(2)}:1` : "—")}
                  </p>
                  <p className="text-xs font-semibold mt-1" style={{ color: ratioColor }}>{loading ? "" : ratioLabel}</p>
                  <p className="text-xs text-slate-400 mt-1">Objectif : minimum 3:1</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-slate-500 flex items-center gap-1"><DollarSign className="w-3 h-3" />Profit net/client</p>
                  <p className="text-2xl font-bold mt-1">{loading ? "…" : fmtCAD(Number(profit?.avg_profit_per_client || 0))}</p>
                  <p className="text-xs text-slate-400 mt-1">Après wholesale + support + infra</p>
                </CardContent>
              </Card>
            </div>
          </section>
        );
      })()}

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><DollarSign className="w-5 h-5" />MRR — Revenu mensuel récurrent (par mois ajouté)</CardTitle></CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={growthChart}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" /><YAxis /><Tooltip /><Legend />
              <Line type="monotone" dataKey="new_mrr" stroke="#7c3aed" strokeWidth={2} name="Nouveau MRR ($)" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Users className="w-5 h-5" />Croissance — nouveaux abonnés par mois</CardTitle></CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={growthChart}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" /><YAxis /><Tooltip /><Legend />
              <Bar dataKey="new_subscriptions" fill="#7c3aed" name="Nouveaux abonnés" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><TrendingDown className="w-5 h-5" />Analyse du churn</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left"><th className="py-2">Mois</th><th className="py-2 text-right">Annulés</th><th className="py-2 text-right">Taux %</th></tr></thead>
            <tbody>
              {churnRows.length === 0 && <tr><td colSpan={3} className="py-4 text-center text-slate-500">Aucune donnée</td></tr>}
              {churnRows.map((r, i) => (
                <tr key={i} className="border-b">
                  <td className="py-2">{r.month}</td>
                  <td className="py-2 text-right">{r.churned}</td>
                  <td className="py-2 text-right">{r.rate.toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Smile className="w-5 h-5" />NPS — Net Promoter Score (90 jours)</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center gap-8">
            <div className="text-center">
              <p className="text-6xl font-bold" style={{ color: npsColor }}>{npsScore}</p>
              <p className="text-xs text-slate-500 mt-1">{nps?.total_responses || 0} réponses</p>
            </div>
            <div className="flex-1 grid grid-cols-3 gap-4 text-center">
              <div><p className="text-emerald-600 text-2xl font-bold">{nps?.promoters || 0}</p><p className="text-xs text-slate-500">Promoteurs</p></div>
              <div><p className="text-amber-600 text-2xl font-bold">{nps?.passives || 0}</p><p className="text-xs text-slate-500">Passifs</p></div>
              <div><p className="text-red-600 text-2xl font-bold">{nps?.detractors || 0}</p><p className="text-xs text-slate-500">Détracteurs</p></div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
