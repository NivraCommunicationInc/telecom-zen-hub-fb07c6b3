/**
 * CoreFinancePage — Real-time finance dashboard (revenue, MRR, cashflow, alerts).
 */
import { useEffect, useState } from "react";
import { backendClient } from "@/integrations/backend/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { AlertTriangle, DollarSign } from "lucide-react";

const fmtCAD = (n: number) => new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(n || 0);
const COLORS = ["#7c3aed", "#a78bfa", "#ddd6fe"];

export default function CoreFinancePage() {
  const [todayRev, setTodayRev] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [failedToday, setFailedToday] = useState(0);
  const [refundsToday, setRefundsToday] = useState(0);
  const [mrr, setMrr] = useState<any>(null);
  const [daily, setDaily] = useState<Array<{ d: string; v: number; ma7: number }>>([]);
  const [breakdown, setBreakdown] = useState<Array<{ name: string; value: number }>>([]);
  const [pastDue, setPastDue] = useState(0);

  useEffect(() => {
    (async () => {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const todayIso = today.toISOString();
      const start30 = new Date(Date.now() - 30 * 86400_000).toISOString();

      const [pay, pend, fail, ref, mrrRow, last30, subs] = await Promise.all([
        backendClient.from("billing_payments").select("amount,created_at,status").gte("created_at", todayIso).eq("status", "confirmed"),
        backendClient.from("billing_invoices").select("id", { count: "exact", head: true }).eq("status", "pending"),
        backendClient.from("billing_payments").select("id", { count: "exact", head: true }).gte("created_at", todayIso).eq("status", "failed"),
        backendClient.from("billing_payments").select("amount,created_at,status").gte("created_at", todayIso).eq("status", "refunded"),
        backendClient.from("mrr_metrics" as any).select("*").maybeSingle(),
        backendClient.from("billing_payments").select("amount,created_at,status").gte("created_at", start30).eq("status", "confirmed"),
        backendClient.from("billing_subscriptions").select("service_category,status").eq("status", "active"),
      ]);

      setTodayRev((pay.data || []).reduce((s, r: any) => s + Number(r.amount || 0), 0));
      setPendingCount(pend.count || 0);
      setFailedToday(fail.count || 0);
      setRefundsToday((ref.data || []).reduce((s, r: any) => s + Number(r.amount || 0), 0));
      setMrr(mrrRow.data);

      // past-due
      const { count: pdCount } = await backendClient
        .from("billing_invoices")
        .select("id", { count: "exact", head: true })
        .eq("status", "overdue");
      setPastDue(pdCount || 0);

      // cashflow daily
      const byDay = new Map<string, number>();
      (last30.data || []).forEach((r: any) => {
        const d = new Date(r.created_at).toISOString().slice(0, 10);
        byDay.set(d, (byDay.get(d) || 0) + Number(r.amount || 0));
      });
      const days: Array<{ d: string; v: number; ma7: number }> = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10);
        days.push({ d, v: byDay.get(d) || 0, ma7: 0 });
      }
      for (let i = 0; i < days.length; i++) {
        const s = Math.max(0, i - 6);
        const slice = days.slice(s, i + 1);
        days[i].ma7 = slice.reduce((a, b) => a + b.v, 0) / slice.length;
      }
      setDaily(days);

      // breakdown
      const counts = new Map<string, number>();
      (subs.data || []).forEach((s: any) => {
        const k = s.service_category || "autre";
        counts.set(k, (counts.get(k) || 0) + 1);
      });
      setBreakdown(Array.from(counts.entries()).map(([name, value]) => ({ name, value })));
    })();
  }, []);

  const monthRev = Number(mrr?.mrr || 0);
  const estExpenses = monthRev * 0.65;
  const estProfit = monthRev - estExpenses;

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-3xl font-bold">Finance</h1>
        <p className="text-slate-500 mt-1">Aujourd'hui — {new Date().toLocaleDateString("fr-CA")}</p>
      </header>

      {(failedToday > 0 || pastDue > 0) && (
        <div className="flex items-center gap-2 p-4 rounded-md bg-red-50 border border-red-200 text-red-800">
          <AlertTriangle className="w-5 h-5" />
          <span className="text-sm">
            {failedToday > 0 && <>Paiements échoués aujourd'hui : <strong>{failedToday}</strong>. </>}
            {pastDue > 0 && <>Factures en souffrance : <strong>{pastDue}</strong>.</>}
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><p className="text-xs text-slate-500">Revenus du jour</p><p className="text-xl font-bold">{fmtCAD(todayRev)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-slate-500">Paiements en attente</p><p className="text-xl font-bold">{pendingCount}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-slate-500">Paiements échoués</p><p className="text-xl font-bold">{failedToday}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-slate-500">Remboursements (jour)</p><p className="text-xl font-bold">{fmtCAD(refundsToday)}</p></CardContent></Card>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><p className="text-xs text-slate-500">MRR actuel</p><p className="text-xl font-bold">{fmtCAD(monthRev)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-slate-500">Dépenses estimées (65%)</p><p className="text-xl font-bold">{fmtCAD(estExpenses)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-slate-500">Profit estimé (35%)</p><p className="text-xl font-bold text-emerald-600">{fmtCAD(estProfit)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-slate-500">ARR</p><p className="text-xl font-bold">{fmtCAD(Number(mrr?.arr || 0))}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><DollarSign className="w-5 h-5" />Cashflow — 30 derniers jours</CardTitle></CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={daily}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="d" tickFormatter={(v) => v.slice(5)} />
              <YAxis />
              <Tooltip formatter={(v: any) => fmtCAD(Number(v))} />
              <Legend />
              <Line type="monotone" dataKey="v" stroke="#7c3aed" strokeWidth={2} name="Revenu quotidien" dot={false} />
              <Line type="monotone" dataKey="ma7" stroke="#a78bfa" strokeWidth={2} name="Moyenne mobile 7j" strokeDasharray="4 4" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Répartition des revenus actifs</CardTitle></CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={breakdown} dataKey="value" nameKey="name" outerRadius={100} label>
                {breakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
