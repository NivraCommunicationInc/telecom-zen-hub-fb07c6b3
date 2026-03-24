/**
 * CoreLiveActivityPage — Real-time visitor tracking
 * Source: live_activity_logs table
 */
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Activity, Users, Clock, RefreshCw, Eye, ShoppingCart, CreditCard, UserPlus, Globe, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LiveLog {
  id: string;
  user_id: string | null;
  session_id: string | null;
  activity_type: string;
  activity_label: string | null;
  city: string | null;
  province: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

type VisitorStatus = "active" | "inactive" | "offline";

interface SessionSummary {
  session_id: string;
  user_id: string | null;
  last_activity: string;
  last_label: string | null;
  last_page: string | null;
  city: string | null;
  activity_count: number;
  status: VisitorStatus;
}

const getVisitorStatus = (lastActivity: string): VisitorStatus => {
  const now = Date.now();
  const last = new Date(lastActivity).getTime();
  const diffSec = (now - last) / 1000;
  if (diffSec <= 60) return "active";
  if (diffSec <= 300) return "inactive";
  return "offline";
};

const STATUS_CONFIG: Record<VisitorStatus, { label: string; color: string; dot: string }> = {
  active: { label: "Actif", color: "bg-emerald-600/15 text-emerald-400 border-0", dot: "bg-emerald-400 animate-pulse" },
  inactive: { label: "Inactif", color: "bg-amber-600/15 text-amber-400 border-0", dot: "bg-amber-400" },
  offline: { label: "Hors ligne", color: "bg-zinc-600/15 text-zinc-400 border-0", dot: "bg-zinc-500" },
};

const ACTIVITY_ICONS: Record<string, typeof Eye> = {
  page_view: Eye,
  plan_view: Eye,
  add_to_cart: ShoppingCart,
  checkout_started: ShoppingCart,
  checkout_step_completed: ShoppingCart,
  payment_started: CreditCard,
  order_submitted: ShoppingCart,
  order_started: ShoppingCart,
  order_completed: ShoppingCart,
  signup: UserPlus,
  login: UserPlus,
};

export default function CoreLiveActivityPage() {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [showOffline, setShowOffline] = useState(false);

  // Fetch recent activity logs (last 10 minutes for sessions, last 100 events for feed)
  const { data: recentLogs = [], refetch, isLoading } = useQuery({
    queryKey: ["core-live-activity"],
    queryFn: async () => {
      const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("live_activity_logs")
        .select("*")
        .gte("created_at", tenMinAgo)
        .order("created_at", { ascending: false })
        .limit(200);
      return (data || []) as LiveLog[];
    },
    refetchInterval: autoRefresh ? 5000 : false,
  });

  // Fetch latest events for the activity feed
  const { data: feedLogs = [] } = useQuery({
    queryKey: ["core-live-feed"],
    queryFn: async () => {
      const { data } = await supabase
        .from("live_activity_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30);
      return (data || []) as LiveLog[];
    },
    refetchInterval: autoRefresh ? 5000 : false,
  });

  // Build session summaries
  const sessions = useMemo<SessionSummary[]>(() => {
    const sessionMap = new Map<string, LiveLog[]>();
    for (const log of recentLogs) {
      const key = log.session_id || log.id;
      if (!sessionMap.has(key)) sessionMap.set(key, []);
      sessionMap.get(key)!.push(log);
    }

    const summaries: SessionSummary[] = [];
    for (const [sessionId, logs] of sessionMap) {
      const sorted = logs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      const latest = sorted[0];
      const page = (latest.metadata as any)?.page || null;
      summaries.push({
        session_id: sessionId,
        user_id: latest.user_id,
        last_activity: latest.created_at,
        last_label: latest.activity_label,
        last_page: page,
        city: latest.city,
        activity_count: logs.length,
        status: getVisitorStatus(latest.created_at),
      });
    }

    return summaries.sort((a, b) => {
      const order: Record<VisitorStatus, number> = { active: 0, inactive: 1, offline: 2 };
      if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
      return new Date(b.last_activity).getTime() - new Date(a.last_activity).getTime();
    });
  }, [recentLogs]);

  const filteredSessions = showOffline ? sessions : sessions.filter(s => s.status !== "offline");
  const activeSessions = sessions.filter(s => s.status === "active");
  const inactiveSessions = sessions.filter(s => s.status === "inactive");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[hsl(var(--core-text-primary))]">Visiteurs en direct</h1>
          <p className="text-sm text-[hsl(var(--core-text-secondary))]">Tracking temps réel — live_activity_logs</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch checked={showOffline} onCheckedChange={setShowOffline} />
            <span className="text-xs text-[hsl(var(--core-text-label))]">Hors ligne</span>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} />
            <span className="text-xs text-[hsl(var(--core-text-label))]">Auto-refresh</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2 border-[hsl(220,15%,20%)] bg-transparent text-[hsl(var(--core-text-secondary))]">
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-[hsl(220,15%,16%)] bg-[hsl(220,15%,11%)] p-4 text-center">
          <div className="text-2xl font-bold text-emerald-400">{activeSessions.length}</div>
          <div className="text-xs text-[hsl(var(--core-text-label))] mt-1">Actifs (≤60s)</div>
        </div>
        <div className="rounded-xl border border-[hsl(220,15%,16%)] bg-[hsl(220,15%,11%)] p-4 text-center">
          <div className="text-2xl font-bold text-amber-400">{inactiveSessions.length}</div>
          <div className="text-xs text-[hsl(var(--core-text-label))] mt-1">Inactifs (1–5 min)</div>
        </div>
        <div className="rounded-xl border border-[hsl(220,15%,16%)] bg-[hsl(220,15%,11%)] p-4 text-center">
          <div className="text-2xl font-bold text-[hsl(var(--core-text-primary))]">{sessions.length}</div>
          <div className="text-xs text-[hsl(var(--core-text-label))] mt-1">Total sessions (10 min)</div>
        </div>
      </div>

      {/* Active sessions */}
      <div className="rounded-xl border border-[hsl(220,15%,16%)] bg-[hsl(220,15%,11%)] p-4">
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-4 h-4 text-emerald-400" />
          <h2 className="text-sm font-semibold text-[hsl(var(--core-text-primary))]">Sessions visiteurs</h2>
          <Badge className="bg-emerald-600/15 text-emerald-400 border-0 text-[10px]">{filteredSessions.length}</Badge>
        </div>
        {isLoading ? (
          <p className="text-sm text-[hsl(var(--core-text-label))]">Chargement…</p>
        ) : filteredSessions.length === 0 ? (
          <p className="text-sm text-[hsl(var(--core-text-label))]">Aucun visiteur détecté. Les données apparaîtront dès qu'un visiteur navigue sur le site.</p>
        ) : (
          <div className="space-y-2">
            {filteredSessions.map((s) => {
              const cfg = STATUS_CONFIG[s.status];
              return (
                <div key={s.session_id} className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-[hsl(220,15%,14%)] transition-colors">
                  <div className={`h-2.5 w-2.5 rounded-full ${cfg.dot} shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[hsl(var(--core-text-primary))] truncate">
                        {s.user_id ? `Utilisateur` : `Visiteur`}
                      </span>
                      <span className="text-[10px] text-[hsl(var(--core-text-label))] font-mono">
                        {s.session_id.slice(0, 16)}…
                      </span>
                      <Badge className={`text-[10px] px-1.5 py-0 ${cfg.color}`}>{cfg.label}</Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-[hsl(var(--core-text-label))] mt-0.5">
                      {s.last_page && <span className="truncate">{s.last_page}</span>}
                      {s.city && (
                        <span className="flex items-center gap-1 shrink-0">
                          <MapPin className="w-3 h-3" />{s.city}
                        </span>
                      )}
                      <span className="shrink-0">{s.activity_count} action{s.activity_count > 1 ? "s" : ""}</span>
                    </div>
                  </div>
                  <span className="text-xs text-[hsl(var(--core-text-label))] shrink-0">
                    {formatTimeAgo(s.last_activity)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent activity feed */}
      <div className="rounded-xl border border-[hsl(220,15%,16%)] bg-[hsl(220,15%,11%)] p-4">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-4 h-4 text-sky-400" />
          <h2 className="text-sm font-semibold text-[hsl(var(--core-text-primary))]">Fil d'activité</h2>
        </div>
        <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
          {feedLogs.map((log) => {
            const IconComp = ACTIVITY_ICONS[log.activity_type] || Globe;
            return (
              <div key={log.id} className="flex items-center gap-3 py-1.5 text-sm">
                <IconComp className="w-3.5 h-3.5 text-[hsl(var(--core-text-label))] shrink-0" />
                <span className="text-[hsl(var(--core-text-secondary))] truncate flex-1">
                  {log.activity_label || log.activity_type}
                </span>
                {log.city && (
                  <span className="text-[10px] text-[hsl(var(--core-text-label))] shrink-0">{log.city}</span>
                )}
                <span className="text-[hsl(var(--core-text-label))] text-xs shrink-0">
                  {new Date(log.created_at).toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
              </div>
            );
          })}
          {feedLogs.length === 0 && (
            <p className="text-sm text-[hsl(var(--core-text-label))] py-4 text-center">Aucune activité récente</p>
          )}
        </div>
      </div>
    </div>
  );
}

function formatTimeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 10) return "à l'instant";
  if (seconds < 60) return `il y a ${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `il y a ${minutes}m`;
  return `il y a ${Math.floor(minutes / 60)}h`;
}
