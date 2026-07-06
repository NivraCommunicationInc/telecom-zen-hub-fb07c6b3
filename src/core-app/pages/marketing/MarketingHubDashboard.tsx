/**
 * MarketingHubDashboard — KPI overview + realtime activity feed (Nivra dark theme).
 * Backend logic preserved: marketing-stats edge function + Supabase Realtime feed.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2, MessageSquare, Send, TrendingUp, AlertCircle, DollarSign,
  Bot, MailCheck, MessageCircle, Activity, Tag, Sparkles,
} from "lucide-react";
import { Link } from "react-router-dom";
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

  if (loading) {
    return (
      <MKPage title="Marketing Hub" subtitle="Vue d'ensemble">
        <div className="flex items-center justify-center py-16 text-[#888]">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Chargement…
        </div>
      </MKPage>
    );
  }
  if (error || !stats) {
    return (
      <MKPage title="Marketing Hub">
        <div className="text-sm text-[#EF4444]">Erreur de chargement: {error}</div>
      </MKPage>
    );
  }

  return (
    <MKPage
      title="Marketing Hub"
      subtitle="Vue d'ensemble · IA, conversations, campagnes — temps réel"
      actions={
        <Link
          to="/marketing/sms-campaigns"
          className="px-3.5 h-9 inline-flex items-center rounded-[10px] text-sm font-semibold text-white"
          style={{ background: "#7C3AED" }}
        >
          <Sparkles className="h-4 w-4 mr-1.5" /> Nouvelle campagne
        </Link>
      }
    >
      <MarketingNav />
      {/* 8 KPIs in 2 rows of 4 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MKStat label="Conversations actives" value={stats.active_conversations_today} icon={MessageSquare} accent="#7C3AED" />
        <MKStat label="SMS aujourd'hui" value={stats.sms_today} icon={Send} accent="#10B981" />
        <MKStat label="SMS cette semaine" value={stats.sms_week} icon={Send} accent="#10B981" />
        <MKStat label="SMS ce mois" value={stats.sms_month} icon={Send} accent="#10B981" />
        <MKStat label="Ventes IA conclues" value={stats.sales_closed} icon={Bot} accent="#7C3AED" hint={`$${stats.revenue_total.toFixed(2)} attribués`} />
        <MKStat label="Taux de réponse" value={`${stats.response_rate_pct}%`} icon={TrendingUp} accent="#10B981" hint="7 derniers jours" />
        <MKStat label="Live chats en attente" value={stats.live_chats_waiting ?? 0} icon={MessageCircle} accent="#F59E0B" hint="à reprendre" />
        <MKStat label="Emails délivrés" value={`${stats.emails_delivered_pct ?? 0}%`} icon={MailCheck} accent="#10B981" hint="30 derniers jours" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Activity feed */}
        <MKCard className="lg:col-span-2">
          <MKCardHeader title="Activité temps réel" />
          <div className="divide-y divide-[#1E1E2E]">
            {feed.length === 0 ? (
              <div className="p-6 text-sm text-[#888] text-center">Aucune activité récente</div>
            ) : (
              feed.map((f) => (
                <div key={f.id} className="flex items-start gap-3 px-5 py-3">
                  <div
                    className="h-8 w-8 rounded-md flex items-center justify-center shrink-0 text-sm"
                    style={{
                      background:
                        f.kind === "sale" ? "#10B98122" :
                        f.kind === "takeover" ? "#F59E0B22" :
                        f.kind === "campaign" ? "#7C3AED22" :
                        "#1E1E2E",
                    }}
                  >
                    {f.kind === "sale" ? "💰" : f.kind === "takeover" ? "👤" : f.kind === "campaign" ? "📣" : f.kind === "chat" ? "🌐" : "💬"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-white truncate">{f.label}</div>
                    {f.detail && <div className="text-xs text-[#888] truncate mt-0.5">{f.detail}</div>}
                  </div>
                  <span className="text-[11px] text-[#888] whitespace-nowrap">
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
            {Object.entries(stats.discount_breakdown || {}).map(([key, v]) => (
              <div key={key} className={cn("rounded-[10px] p-3", MK_CARD)}>
                <div className="text-[10px] uppercase tracking-[2px] text-[#888] flex items-center gap-1">
                  <Tag className="h-3 w-3" /> {DISCOUNT_LABELS[key] || key}
                </div>
                <div className="text-xl font-bold text-white mt-1">{v.offered}</div>
                <div className="text-[11px] text-[#10B981] mt-0.5">Acceptés: {v.accepted}</div>
              </div>
            ))}
          </div>
        </MKCard>
      </div>

      {/* System status */}
      <MKCard>
        <MKCardHeader title="Statut système" />
        <div className="px-5 py-4 grid sm:grid-cols-3 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#10B981]" />
            <span className="text-[#888]">Webhook OpenPhone</span>
            <span className="text-white font-medium">Actif</span>
          </div>
          <div className="flex items-center gap-2">
            <Activity className="h-3.5 w-3.5 text-[#7C3AED]" />
            <span className="text-[#888]">Agent IA</span>
            <Link to="/marketing/ai-config" className="text-[#7C3AED] hover:underline">Configurer</Link>
          </div>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-3.5 w-3.5 text-[#F59E0B]" />
            <span className="text-[#888]">À reprendre</span>
            <span className="text-white font-medium">{stats.waiting_human}</span>
          </div>
        </div>
      </MKCard>
    </MKPage>
  );
}
