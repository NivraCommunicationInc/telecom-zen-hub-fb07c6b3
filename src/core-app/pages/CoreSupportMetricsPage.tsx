/**
 * CoreSupportMetricsPage — Support performance dashboard.
 */
import { useEffect, useState } from "react";
import { backendClient } from "@/integrations/backend/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { AlertTriangle } from "lucide-react";

const COLORS = ["#7c3aed", "#a78bfa", "#c4b5fd", "#ddd6fe"];

export default function CoreSupportMetricsPage() {
  const [m, setM] = useState<any>(null);
  const [byCat, setByCat] = useState<Array<{ name: string; value: number }>>([]);
  const [trend, setTrend] = useState<Array<{ d: string; n: number }>>([]);

  useEffect(() => {
    (async () => {
      const [metrics, all] = await Promise.all([
        backendClient.from("support_metrics" as any).select("*").maybeSingle(),
        backendClient.from("support_tickets").select("category,created_at,status").gte("created_at", new Date(Date.now() - 30 * 86400_000).toISOString()),
      ]);
      setM(metrics.data);

      const c = new Map<string, number>();
      (all.data || []).forEach((r: any) => c.set(r.category || "autre", (c.get(r.category || "autre") || 0) + 1));
      setByCat(Array.from(c.entries()).map(([name, value]) => ({ name, value })));

      const days = new Map<string, number>();
      (all.data || []).forEach((r: any) => {
        const d = new Date(r.created_at).toISOString().slice(0, 10);
        days.set(d, (days.get(d) || 0) + 1);
      });
      const arr: Array<{ d: string; n: number }> = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10);
        arr.push({ d: d.slice(5), n: days.get(d) || 0 });
      }
      setTrend(arr);
    })();
  }, []);

  const fr = Number(m?.avg_first_response_hours || 0);
  const res = Number(m?.avg_resolution_hours || 0);
  const total = Number(m?.total_tickets || 0);
  const resolved = Number(m?.resolved_tickets || 0);
  const open = Number(m?.open_tickets || 0);
  const resRate = total ? Math.round((resolved / total) * 100) : 0;

  const flagFR = fr > 4;
  const flagRES = res > 72;
  const flagOpen = open > 20;

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-3xl font-bold">Métriques du support</h1>
        <p className="text-slate-500 mt-1">Volume, temps de réponse et résolution</p>
      </header>

      {(flagFR || flagRES || flagOpen) && (
        <div className="flex items-center gap-2 p-4 rounded-md bg-red-50 border border-red-200 text-red-800 text-sm">
          <AlertTriangle className="w-5 h-5" />
          <span>
            {flagFR && <>Temps de première réponse {">"} 4h. </>}
            {flagRES && <>Temps de résolution {">"} 3j. </>}
            {flagOpen && <>Plus de 20 tickets ouverts.</>}
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Card><CardContent className="p-4"><p className="text-xs text-slate-500">Tickets totaux</p><p className="text-xl font-bold">{total}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-slate-500">Ouverts</p><p className={`text-xl font-bold ${flagOpen ? "text-red-600" : ""}`}>{open}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-slate-500">Première réponse (h)</p><p className={`text-xl font-bold ${flagFR ? "text-red-600" : ""}`}>{fr.toFixed(1)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-slate-500">Résolution (h)</p><p className={`text-xl font-bold ${flagRES ? "text-red-600" : ""}`}>{res.toFixed(1)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-slate-500">Taux résolution</p><p className="text-xl font-bold">{resRate}%</p></CardContent></Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Par catégorie</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={byCat} dataKey="value" nameKey="name" outerRadius={100} label>
                  {byCat.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip /><Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Volume (30 jours)</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="d" /><YAxis /><Tooltip />
                <Bar dataKey="n" fill="#7c3aed" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
