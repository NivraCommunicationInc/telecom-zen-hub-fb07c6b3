/**
 * ClientUsageHistory — Historique de consommation avec graphiques recharts
 *
 * Onglets: Données internet / Appels / SMS
 * Par mois (6 derniers mois)
 * Proxy: montants facturés depuis billing_invoices si pas de usage_records
 */
import { useState } from "react";
import ClientLayout from "@/components/client/ClientLayout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useClientAuth } from "@/hooks/useClientAuth";
import { useQuery } from "@tanstack/react-query";
import { portalClient as portalSupabase } from "@/integrations/backend";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { fr } from "date-fns/locale";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from "recharts";
import { Wifi, Phone, MessageSquare, TrendingUp } from "lucide-react";

function getLast6Months() {
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = subMonths(new Date(), i);
    months.push({
      label: format(d, "MMM yy", { locale: fr }),
      start: startOfMonth(d).toISOString(),
      end: endOfMonth(d).toISOString(),
      month: format(d, "yyyy-MM"),
    });
  }
  return months;
}

const MONTHS = getLast6Months();

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border rounded-lg p-3 shadow-lg text-sm">
        <p className="font-semibold mb-1">{label}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} style={{ color: p.color }}>
            {p.name}: {p.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function ClientUsageHistory() {
  const { user } = useClientAuth();
  const [activeTab, setActiveTab] = useState("internet");

  // Fetch billing invoices as proxy for usage (last 6 months)
  const { data: invoicesByMonth, isLoading } = useQuery({
    queryKey: ["usage-history-invoices", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data: customer } = await portalSupabase
        .from("billing_customers")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!customer) return [];

      const { data: invoices } = await portalSupabase
        .from("billing_invoices")
        .select("total, created_at, status, type")
        .eq("customer_id", customer.id)
        .eq("status", "paid")
        .gte("created_at", MONTHS[0].start)
        .order("created_at", { ascending: true });

      // Group by month
      const byMonth: Record<string, number> = {};
      for (const inv of invoices || []) {
        const m = inv.created_at.slice(0, 7); // YYYY-MM
        byMonth[m] = (byMonth[m] || 0) + Number(inv.total || 0);
      }

      return MONTHS.map((m) => ({
        mois: m.label,
        montant: Math.round((byMonth[m.month] || 0) * 100) / 100,
      }));
    },
    enabled: !!user?.id,
  });

  // Try to fetch real usage records
  const { data: usageRecords } = useQuery({
    queryKey: ["usage-records", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      // Try usage_records table — may not exist yet
      const { data, error } = await portalSupabase
        .from("usage_records" as any)
        .select("month, data_gb, calls_minutes, sms_count")
        .eq("user_id", user.id)
        .gte("month", MONTHS[0].month)
        .order("month", { ascending: true });
      if (error) return null; // Table may not exist
      return data;
    },
    enabled: !!user?.id,
  });

  // Build chart data
  const chartData = MONTHS.map((m) => {
    const usage = usageRecords?.find((r: any) => r.month === m.month);
    const invoice = invoicesByMonth?.find((i) => i.mois === m.label);
    return {
      mois: m.label,
      data_gb: usage?.data_gb ?? null,
      calls_minutes: usage?.calls_minutes ?? null,
      sms_count: usage?.sms_count ?? null,
      montant: invoice?.montant ?? 0,
    };
  });

  const hasRealUsage = usageRecords && usageRecords.length > 0;

  return (
    <ClientLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">
            Historique de consommation
          </h1>
          <p className="text-muted-foreground mt-1">
            Votre utilisation des 6 derniers mois
          </p>
        </div>

        {!hasRealUsage && (
          <Card className="border-amber-200 bg-amber-50/50">
            <CardContent className="p-4 text-sm text-amber-800">
              Les données de consommation détaillées (Go, minutes, SMS) ne sont pas encore disponibles.
              Les graphiques affichent vos montants facturés mensuels comme indicateur de consommation.
            </CardContent>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-3 w-full max-w-md gap-1 bg-muted/50 p-1">
            <TabsTrigger value="internet" className="gap-2">
              <Wifi className="w-4 h-4" />
              Internet
            </TabsTrigger>
            <TabsTrigger value="appels" className="gap-2">
              <Phone className="w-4 h-4" />
              Appels
            </TabsTrigger>
            <TabsTrigger value="sms" className="gap-2">
              <MessageSquare className="w-4 h-4" />
              SMS
            </TabsTrigger>
          </TabsList>

          {/* ─── DONNÉES INTERNET ─── */}
          <TabsContent value="internet" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wifi className="w-5 h-5 text-primary" />
                  {hasRealUsage ? "Données utilisées (Go)" : "Montants facturés (CAD)"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="h-64 flex items-center justify-center text-muted-foreground">Chargement…</div>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="mois" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar
                        dataKey={hasRealUsage ? "data_gb" : "montant"}
                        name={hasRealUsage ? "Go utilisés" : "Montant ($)"}
                        fill="#6b21e8"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── APPELS ─── */}
          <TabsContent value="appels" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Phone className="w-5 h-5 text-emerald-500" />
                  {hasRealUsage ? "Minutes d'appels" : "Activité mensuelle"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="h-64 flex items-center justify-center text-muted-foreground">Chargement…</div>
                ) : hasRealUsage ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="mois" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Line
                        type="monotone"
                        dataKey="calls_minutes"
                        name="Minutes"
                        stroke="#10b981"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-64 flex flex-col items-center justify-center text-muted-foreground gap-3">
                    <Phone className="w-10 h-10 opacity-30" />
                    <p className="text-sm">Les données d'appels détaillées seront disponibles prochainement.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── SMS ─── */}
          <TabsContent value="sms" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-sky-500" />
                  {hasRealUsage ? "Nombre de SMS" : "Activité mensuelle"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="h-64 flex items-center justify-center text-muted-foreground">Chargement…</div>
                ) : hasRealUsage ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="mois" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar
                        dataKey="sms_count"
                        name="SMS"
                        fill="#0ea5e9"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-64 flex flex-col items-center justify-center text-muted-foreground gap-3">
                    <MessageSquare className="w-10 h-10 opacity-30" />
                    <p className="text-sm">Les données SMS détaillées seront disponibles prochainement.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Trend summary */}
        {invoicesByMonth && invoicesByMonth.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="w-5 h-5 text-violet-500" />
                Tendance de facturation — 6 mois
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={invoicesByMonth} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="mois" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="montant"
                    name="Montant ($)"
                    stroke="#6b21e8"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>
    </ClientLayout>
  );
}
