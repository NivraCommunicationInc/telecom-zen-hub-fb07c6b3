/**
 * MarketingHubDashboard — KPI overview + realtime activity feed (Nivra dark theme).
 * Backend logic preserved: marketing-stats edge function + Supabase Realtime feed.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2, MessageSquare, Send, TrendingUp, AlertCircle, DollarSign,
  Bot, MailCheck, MessageCircle, Activity, Tag, Sparkles, Target,
  Users, LayoutTemplate, CalendarClock, Bell, Zap, BarChart3,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { MKPage, MKCard, MKCardHeader, MKStat, MK_CARD } from "./_marketing-ui";
import MarketingNav from "./MarketingNav";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

type Stats = {
  active_conversations_today: number;
  sms_today: number;
  sms_week: number;
  sms_month: number;
  response_rate_pct: number;
  sales_closed: number;
  waiting_human: number;
  revenue_total: number;
  emails_delivered_pct?: number;
  live_chats_waiting?: number;
  discount_breakdown: Record<string, { offered: number; accepted: number }>;
};

type FeedItem = {
  id: string;
  kind: "sms_in" | "sms_out" | "sale" | "takeover" | "campaign" | "chat";
  label: string;
  detail?: string;
  at: string;
};

const DISCOUNT_LABELS: Record<string, string> = {
  none: "Aucune",
  "5_per_month": "5 $/mois × 24",
  "10_per_month": "10 $/mois × 24",
  free_installation: "Installation gratuite",
};

export default function MarketingHubDashboard() {
  const { pathname } = useLocation();
  const base = pathname === "/core/marketing" || pathname.startsWith("/core/marketing/") ? "/core/marketing" : "/marketing";
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feed, setFeed] = useState<FeedItem[]>([]);

  const loadStats = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("marketing-stats");
      if (error) throw error;
      setStats(data?.stats ?? null);
      setError(null);
    } catch (e: any) {
      setError(e?.message || "Erreur");
    } finally {
      setLoading(false);
    }
  };

  const loadFeed = async () => {
    const [{ data: convos }, { data: campaigns }, { data: chats }] = await Promise.all([
      supabase
        .from("marketing_conversations")
        .select("id, contact_phone, last_message_at, sale_closed, status")
        .order("last_message_at", { ascending: false })
        .limit(8),
      supabase
        .from("sms_campaigns")
        .select("id, message, sent_count, created_at, status")
        .order("created_at", { ascending: false })
        .limit(3),
      supabase
        .from("live_chat_sessions")
        .select("session_id, status, last_message_at, visitor_name")
        .order("last_message_at", { ascending: false })
        .limit(4),
    ]);

    const items: FeedItem[] = [];
    (convos ?? []).forEach((c: any) => {
      items.push({
        id: `c-${c.id}`,
        kind: c.sale_closed ? "sale" : "sms_in",
        label: c.sale_closed
          ? `💰 Vente conclue · ${c.contact_phone}`
          : `💬 SMS · ${c.contact_phone}`,
        detail: c.status,
        at: c.last_message_at,
      });
    });
    (campaigns ?? []).forEach((c: any) => {
      items.push({
        id: `cmp-${c.id}`,
        kind: "campaign",
        label: `📣 Campagne SMS — ${c.sent_count} envoyés`,
        detail: c.message?.slice(0, 60),
        at: c.created_at,
      });
    });
    (chats ?? []).forEach((c: any) => {
      items.push({
        id: `lc-${c.session_id}`,
        kind: c.status === "human_takeover" ? "takeover" : "chat",
        label: c.status === "human_takeover"
          ? `👤 Reprise humaine — ${c.visitor_name || "Visiteur"}`
          : `🌐 Chat web — ${c.visitor_name || "Visiteur"}`,
        at: c.last_message_at,
      });
    });
    items.sort((a, b) => +new Date(b.at) - +new Date(a.at));
    setFeed(items.slice(0, 10));
  };

  useEffect(() => {
    loadStats();
    loadFeed();
    const t = setInterval(() => { loadStats(); loadFeed(); }, 30_000);
    const channel = supabase
      .channel("marketing-dashboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "marketing_conversations" }, () => loadFeed())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "sms_campaigns" }, () => loadFeed())
      .on("postgres_changes", { event: "*", schema: "public", table: "live_chat_sessions" }, () => loadFeed())
      .subscribe();
    return () => { clearInterval(t); supabase.removeChannel(channel); };
  }, []);

  const quickActions = [
    { to: `${base}/audiences`, title: "Créer une audience", desc: "Segments dynamiques CRM, clients et imports", icon: Target },
    { to: `${base}/contacts`, title: "Gérer les contacts", desc: "Recherche, sélection et export CSV", icon: Users },
    { to: `${base}/templates`, title: "Designer un email", desc: "Éditeur HTML avec aperçu WYSIWYG", icon: LayoutTemplate },
    { to: `${base}/campaigns`, title: "Lancer une campagne", desc: "Email Resend, test, A/B et planification", icon: Send },
    { to: `${base}/push-campaigns`, title: "Préparer un push web", desc: "Notification navigateur avec aperçu", icon: Bell },
    { to: `${base}/automations`, title: "Construire une séquence", desc: "Bienvenue, relance, réactivation", icon: Zap },
  ];

  if (loading) {
    return (
      <MKPage title="Marketing Hub" subtitle="Vue d'ensemble">
        <MarketingNav />
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Chargement…
        </div>
      </MKPage>
    );
  }

  return (
    <MKPage
      title="Nivra Marketing Hub"
      subtitle="Plateforme campagnes type Mailchimp: audiences, emails, SMS, push, séquences, tests et analytics."
      actions={
        <Link
          to={`${base}/campaigns`}
          className="px-4 h-11 inline-flex items-center rounded-full bg-primary text-sm font-black text-primary-foreground shadow-sm hover:opacity-90"
        >
          <Sparkles className="h-4 w-4 mr-1.5" /> Nouvelle campagne
        </Link>
      }
    >
      <MarketingNav />
      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          Données temps réel temporairement indisponibles: {error}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
        <div className="rounded-3xl border border-border bg-primary p-6 text-primary-foreground shadow-sm">
          <div className="max-w-2xl">
            <div className="mb-3 inline-flex rounded-full bg-primary-foreground/15 px-3 py-1 text-xs font-black uppercase tracking-normal">
              Centre de croissance
            </div>
            <h2 className="text-3xl font-black leading-tight tracking-normal md:text-4xl">
              Crée, cible, teste et envoie depuis un seul endroit.
            </h2>
            <p className="mt-3 max-w-xl text-sm font-medium opacity-90">
              Les modules ci-dessous ouvrent directement les vraies sections: contacts, audiences, templates, campagnes, push, automations et analytics.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Link to={`${base}/audiences`} className="rounded-full bg-primary-foreground px-4 py-2 text-sm font-black text-primary">Audiences</Link>
              <Link to={`${base}/templates`} className="rounded-full bg-primary-foreground/15 px-4 py-2 text-sm font-black text-primary-foreground">Templates</Link>
              <Link to={`${base}/analytics`} className="rounded-full bg-primary-foreground/15 px-4 py-2 text-sm font-black text-primary-foreground">Analytics</Link>
            </div>
          </div>
        </div>
        <MKCard className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-black uppercase text-muted-foreground">Santé campagnes</div>
              <div className="mt-2 text-4xl font-black text-foreground">{stats?.emails_delivered_pct ?? "—"}%</div>
              <div className="text-sm text-muted-foreground">Emails délivrés · 30 derniers jours</div>
            </div>
            <BarChart3 className="h-12 w-12 text-primary" />
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-xl bg-secondary p-3"><div className="font-black text-foreground">{stats?.sms_today ?? "—"}</div><div className="text-muted-foreground">SMS/jour</div></div>
            <div className="rounded-xl bg-secondary p-3"><div className="font-black text-foreground">{stats?.waiting_human ?? "—"}</div><div className="text-muted-foreground">À traiter</div></div>
            <div className="rounded-xl bg-secondary p-3"><div className="font-black text-foreground">{stats?.response_rate_pct ?? "—"}%</div><div className="text-muted-foreground">Réponse</div></div>
          </div>
        </MKCard>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {quickActions.map((a) => (
          <Link key={a.to} to={a.to} className="group rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/60 hover:bg-secondary/60">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground"><a.icon className="h-5 w-5" /></div>
            <div className="text-base font-black text-foreground">{a.title}</div>
            <div className="mt-1 text-sm text-muted-foreground">{a.desc}</div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MKStat label="Conversations actives" value={stats?.active_conversations_today ?? "—"} icon={MessageSquare} />
        <MKStat label="SMS aujourd'hui" value={stats?.sms_today ?? "—"} icon={Send} accent="hsl(var(--success))" />
        <MKStat label="SMS cette semaine" value={stats?.sms_week ?? "—"} icon={Send} accent="hsl(var(--success))" />
        <MKStat label="SMS ce mois" value={stats?.sms_month ?? "—"} icon={Send} accent="hsl(var(--success))" />
        <MKStat label="Ventes IA conclues" value={stats?.sales_closed ?? "—"} icon={Bot} hint={stats ? `$${stats.revenue_total.toFixed(2)} attribués` : undefined} />
        <MKStat label="Taux de réponse" value={stats ? `${stats.response_rate_pct}%` : "—"} icon={TrendingUp} accent="hsl(var(--success))" hint="7 derniers jours" />
        <MKStat label="Live chats en attente" value={stats?.live_chats_waiting ?? "—"} icon={MessageCircle} accent="hsl(var(--core-warning))" hint="à reprendre" />
        <MKStat label="Emails délivrés" value={stats ? `${stats.emails_delivered_pct ?? 0}%` : "—"} icon={MailCheck} accent="hsl(var(--success))" hint="30 derniers jours" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Activity feed */}
        <MKCard className="lg:col-span-2">
          <MKCardHeader title="Activité temps réel" />
          <div className="divide-y divide-border">
            {feed.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground text-center">Aucune activité récente</div>
            ) : (
              feed.map((f) => (
                <div key={f.id} className="flex items-start gap-3 px-5 py-3">
                  <div
                    className="h-8 w-8 rounded-md flex items-center justify-center shrink-0 text-sm"
                    style={{
                      background:
                        "hsl(var(--secondary))",
                    }}
                  >
                    {f.kind === "sale" ? "💰" : f.kind === "takeover" ? "👤" : f.kind === "campaign" ? "📣" : f.kind === "chat" ? "🌐" : "💬"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-foreground truncate">{f.label}</div>
                    {f.detail && <div className="text-xs text-muted-foreground truncate mt-0.5">{f.detail}</div>}
                  </div>
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(new Date(f.at), { addSuffix: true, locale: fr })}
                  </span>
                </div>
              ))
            )}
          </div>
        </MKCard>

        {/* Discounts breakdown */}
        <MKCard>
          <MKCardHeader title="Rabais offerts par l'IA" />
          <div className="p-5 grid grid-cols-2 gap-3">
            {Object.entries(stats?.discount_breakdown || {}).map(([key, v]) => (
              <div key={key} className={cn("rounded-[10px] p-3", MK_CARD)}>
                <div className="text-xs font-black uppercase tracking-normal text-muted-foreground flex items-center gap-1">
                  <Tag className="h-3 w-3" /> {DISCOUNT_LABELS[key] || key}
                </div>
                <div className="text-xl font-bold text-foreground mt-1">{v.offered}</div>
                <div className="text-[11px] text-primary mt-0.5">Acceptés: {v.accepted}</div>
              </div>
            ))}
            {!Object.keys(stats?.discount_breakdown || {}).length && <div className="col-span-2 text-sm text-muted-foreground">Aucune donnée de rabais.</div>}
          </div>
        </MKCard>
      </div>

      {/* System status */}
      <MKCard>
        <MKCardHeader title="Statut système" />
        <div className="px-5 py-4 grid sm:grid-cols-3 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-primary" />
            <span className="text-muted-foreground">Webhook OpenPhone</span>
            <span className="text-foreground font-medium">Actif</span>
          </div>
          <div className="flex items-center gap-2">
            <Activity className="h-3.5 w-3.5 text-primary" />
            <span className="text-muted-foreground">Agent IA</span>
            <Link to={`${base}/ai-config`} className="text-primary hover:underline">Configurer</Link>
          </div>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-3.5 w-3.5 text-primary" />
            <span className="text-muted-foreground">À reprendre</span>
            <span className="text-foreground font-medium">{stats?.waiting_human ?? "—"}</span>
          </div>
        </div>
      </MKCard>
    </MKPage>
  );
}
