/**
 * CoreMRRDashboardPage — MRR mensuel, churn, tickets ouverts, paiements en attente
 */
import { useEffect, useState } from "react";
import { backendClient } from "@/integrations/backend/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { TrendingUp, TrendingDown, MessageSquare, Clock, DollarSign, Users } from "lucide-react";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { fr } from "date-fns/locale";

const fmtCAD = (n: number) =>
  new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(n || 0);
const fmtPct = (n: number) => `${(n * 100).toFixed(1)} %`;

function getLast6Months() {
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = subMonths(new Date(), i);
    months.push({
      label: format(d, "MMM yy", { locale: fr }),
      start: startOfMonth(d).toISOString(),
      end: endOfMonth(d).toISOString(),
    });
  }
  return months;
}

const MONTHS = getLast6Months();

export default function CoreMRRDashboardPage() {
  const [mrrData, setMrrData] = useState<Array<{ mois: string; mrr: number; churn: number; nouveaux: number }>>([]);
  const [openTickets, setOpenTickets] = useState(0);
  const [pendingPayments, setPendingPayments] = useState(0);
  const [pendingAmount, setPendingAmount] = useState(0);
  const [activeClients, setActiveClients] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [ticketsRes, pendingRes, clientsRes] = await Promise.all([
          backendClient.from("support_tickets" as any)
            .select("id", { count: "exact", head: true })
            .in("status", ["open", "pending"]),
          backendClient.from("billing_payments")
            .select("amount")
            .eq("status", "pending"),
          backendClient.from("billing_subscriptions")
            .select("id", { count: "exact", head: true })
            .eq("status", "active"),
        ]);

        setOpenTickets((ticketsRes as any).count || 0);
        setPendingPayments(((pendingRes as any).data || []).length);
        setPendingAmount(((pendingRes as any).data || []).reduce((s: number, r: any) => s + Number(r.amount || 0), 0));
        setActiveClients((clientsRes as any).count || 0);

        // MRR par mois: somme des paiements renewals confirmés
        const monthData = await Promise.all(
          MONTHS.map(async (m) => {
            const [paidRes, cancelledRes, newRes] = await Promise.all([
              backendClient.from("billing_invoices")
                .select("total")
                .eq("status", "paid")
                .eq("type", "renewal")
                .gte("created_at", m.start)
                .lte("created_at", m.end),
              backendClient.from("billing_subscriptions")
                .select("id", { count: "exact", head: true })
                .eq("status", "cancelled")
                .gte("cancelled_at" as any, m.start)
                .lte("cancelled_at" as any, m.end),
              backendClient.from("billing_subscriptions")
                .select("id", { count: "exact", head: true })
                .gte("created_at", m.start)
                .lte("created_at", m.end),
            ]);

            const mrr = ((paidRes as any).data || []).reduce((s: number, r: any) => s + Number(r.total || 0), 0);
            const cancelled = (cancelledRes as any).count || 0;
            const created = (newRes as any).count || 0;
            const churnRate = activeClients > 0 ? cancelled / Math.max(activeClients, 1) : 0;

            return {
              mois: m.label,
              mrr: Math.round(mrr * 100) / 100,
              churn: Math.round(churnRate * 1000) / 10,
              nouveaux: created,
            };
          })
        );

        setMrrData(monthData);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const latestMRR = mrrData[mrrData.length - 1]?.mrr || 0;
  const prevMRR = mrrData[mrrData.length - 2]?.mrr || 0;
  const mrrGrowth = prevMRR > 0 ? ((latestMRR - prevMRR) / prevMRR) * 100 : 0;
  const latestChurn = mrrData[mrrData.length - 1]?.churn || 0;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-card border border-border rounded-lg p-3 shadow-lg text-sm">
        <p className="font-semibold mb-1">{label}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} style={{ color: p.color }}>
            {p.name}: {p.dataKey === "mrr" ? fmtCAD(p.value) : p.dataKey === "churn" ? `${p.value} %` : p.value}
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-3xl font-bold">MRR & Métriques</h1>
        <p className="text-slate-500 mt-1">Revenus récurrents, churn et performance — 6 derniers mois</p>
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-violet-500" />
              <p className="text-xs text-muted-foreground">MRR (ce mois)</p>
            </div>
            <p className="text-2xl font-bold">{loading ? "—" : fmtCAD(latestMRR)}</p>
            {!loading && prevMRR > 0 && (
              <p className={`text-xs mt-1 flex items-center gap-1 ${mrrGrowth >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                {mrrGrowth >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {mrrGrowth >= 0 ? "+" : ""}{mrrGrowth.toFixed(1)} % vs mois dernier
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="w-4 h-4 text-red-400" />
              <p className="text-xs text-muted-foreground">Churn (ce mois)</p>
            </div>
            <p className="text-2xl font-bold">{loading ? "—" : `${latestChurn} %`}</p>
            <p className="text-xs mt-1 text-muted-foreground">Annulations / clients actifs</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <MessageSquare className="w-4 h-4 text-amber-400" />
              <p className="text-xs text-muted-foreground">Tickets ouverts</p>
            </div>
            <p className="text-2xl font-bold">{loading ? "—" : openTickets}</p>
            <p className="text-xs mt-1 text-muted-foreground">Support en attente</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-orange-400" />
              <p className="text-xs text-muted-foreground">Paiements en attente</p>
            </div>
            <p className="text-2xl font-bold">{loading ? "—" : pendingPayments}</p>
            <p className="text-xs mt-1 text-muted-foreground">{fmtCAD(pendingAmount)} à percevoir</p>
          </CardContent>
        </Card>
      </div>

      {/* MRR Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-violet-500" />
            MRR mensuel — 6 derniers mois
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-64 flex items-center justify-center text-muted-foreground">Chargement…</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={mrrData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="mois" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(v) => fmtCAD(v)} tick={{ fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="mrr" name="MRR" fill="#7c3aed" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Churn + Nouveaux clients */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingDown className="w-4 h-4 text-red-400" />
              Taux de churn mensuel (%)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground">Chargement…</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={mrrData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="mois" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} unit="%" />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="churn" name="Churn" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="w-4 h-4 text-emerald-500" />
              Nouveaux abonnements / mois
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground">Chargement…</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={mrrData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="mois" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="nouveaux" name="Nouveaux" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
