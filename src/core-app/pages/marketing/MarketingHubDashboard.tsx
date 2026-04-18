/**
 * MarketingHubDashboard — KPI overview for the Nivra Marketing Hub.
 * Calls the marketing-stats edge function and renders cards.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, MessageSquare, Send, TrendingUp, AlertCircle, DollarSign, Tag, Activity, Bot } from "lucide-react";
import { Link } from "react-router-dom";
import { corePath } from "@/core-app/lib/corePaths";

type Stats = {
  active_conversations_today: number;
  sms_today: number;
  sms_week: number;
  sms_month: number;
  response_rate_pct: number;
  sales_closed: number;
  waiting_human: number;
  revenue_total: number;
  discount_breakdown: Record<string, { offered: number; accepted: number }>;
};

const DISCOUNT_LABELS: Record<string, string> = {
  none: "Aucune",
  "5_per_month": "5 $/mois × 24",
  "10_per_month": "10 $/mois × 24",
  free_installation: "Installation gratuite",
};

export default function MarketingHubDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("marketing-stats");
        if (cancelled) return;
        if (error) throw error;
        setStats(data?.stats ?? null);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Erreur");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    const t = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Chargement…</div>;
  }
  if (error || !stats) {
    return <div className="text-sm text-destructive">Erreur de chargement: {error}</div>;
  }

  const KPI = ({ icon: Icon, label, value, hint }: { icon: any; label: string; value: string | number; hint?: string }) => (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2"><Icon className="h-3.5 w-3.5" /> {label}</CardTitle></CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
        {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Marketing Hub</h1>
          <p className="text-sm text-muted-foreground">Vue d'ensemble des conversations IA et campagnes SMS</p>
        </div>
        <div className="flex gap-2 text-sm">
          <Link to={corePath("/marketing/conversations")} className="px-3 py-1.5 rounded-md bg-secondary hover:bg-secondary/80">Conversations</Link>
          <Link to={corePath("/marketing/ai-config")} className="px-3 py-1.5 rounded-md bg-secondary hover:bg-secondary/80">Agent IA</Link>
          <Link to={corePath("/marketing/sms-campaigns")} className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90">Nouvelle campagne</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI icon={MessageSquare} label="Conversations actives (24h)" value={stats.active_conversations_today} />
        <KPI icon={Send} label="SMS envoyés (aujourd'hui)" value={stats.sms_today} hint={`${stats.sms_week} cette semaine · ${stats.sms_month} ce mois`} />
        <KPI icon={TrendingUp} label="Taux de réponse" value={`${stats.response_rate_pct}%`} hint="7 derniers jours" />
        <KPI icon={AlertCircle} label="En attente humain" value={stats.waiting_human} hint="à reprendre manuellement" />
        <KPI icon={Bot} label="Ventes IA conclues" value={stats.sales_closed} hint="30 derniers jours" />
        <KPI icon={DollarSign} label="Revenu attribué" value={`$${stats.revenue_total.toFixed(2)}`} hint="ventes IA" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2"><Tag className="h-4 w-4" /> Rabais offerts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(stats.discount_breakdown).map(([key, v]) => (
              <div key={key} className="rounded-md border border-border p-3">
                <div className="text-xs text-muted-foreground">{DISCOUNT_LABELS[key] || key}</div>
                <div className="text-lg font-semibold mt-1">{v.offered}</div>
                <div className="text-xs text-emerald-600">Acceptés: {v.accepted}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Activity className="h-4 w-4" /> Statut système</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-1">
          <div>OpenPhone webhook: <span className="text-emerald-600 font-medium">Actif</span></div>
          <div>Agent IA: <Link to={corePath("/marketing/ai-config")} className="text-primary underline">Configurer</Link></div>
          <div>Modèle: Lovable AI · Gemini 2.5 Pro</div>
        </CardContent>
      </Card>
    </div>
  );
}
