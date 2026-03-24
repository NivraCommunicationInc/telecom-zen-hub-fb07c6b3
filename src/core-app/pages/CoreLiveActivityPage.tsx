/**
 * CoreLiveActivityPage — Conversion Center
 * KPIs + active sessions + checkout attempts + activity feed
 * Source: live_activity_logs table
 */
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Activity, Users, Clock, RefreshCw, Eye, ShoppingCart, CreditCard,
  UserPlus, Globe, MapPin, TrendingUp, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

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

/* ── Checkout attempt row ── */
interface CheckoutAttempt {
  session_id: string;
  last_activity: string;
  highest_step: number;
  highest_type: string;
  last_page: string | null;
  status: "active" | "abandoned" | "completed";
}

const CHECKOUT_TYPES = [
  "checkout_started",
  "checkout_step_completed",
  "payment_started",
  "order_submitted",
  "order_completed",
  "checkout_abandoned",
];

const CHECKOUT_RANK: Record<string, number> = {
  checkout_started: 1,
  checkout_step_completed: 2,
  payment_started: 3,
  order_submitted: 4,
  order_completed: 5,
};

const ABANDON_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

const getVisitorStatus = (lastActivity: string): VisitorStatus => {
  const diffSec = (Date.now() - new Date(lastActivity).getTime()) / 1000;
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
  checkout_abandoned: AlertTriangle,
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

  /* ── Fetch recent 10-min logs for sessions ── */
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

  /* ── Fetch today's logs for KPIs + checkout attempts ── */
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data: todayLogs = [] } = useQuery({
    queryKey: ["core-live-today"],
    queryFn: async () => {
      const { data } = await supabase
        .from("live_activity_logs")
        .select("*")
        .gte("created_at", todayStart.toISOString())
        .order("created_at", { ascending: false })
        .limit(1000);
      return (data || []) as LiveLog[];
    },
    refetchInterval: autoRefresh ? 10000 : false,
  });

  /* ── Feed (latest 30) ── */
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

  /* ── Build session summaries ── */
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
      summaries.push({
        session_id: sessionId,
        user_id: latest.user_id,
        last_activity: latest.created_at,
        last_label: latest.activity_label,
        last_page: (latest.metadata as any)?.page || null,
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

  /* ── KPIs ── */
  const kpis = useMemo(() => {
    const activeNow = sessions.filter(s => s.status === "active").length;
    const uniqueSessions = new Set(todayLogs.map(l => l.session_id)).size;
    const checkoutsStarted = todayLogs.filter(l => l.activity_type === "checkout_started").length;
    const conversions = todayLogs.filter(l => l.activity_type === "order_completed" || l.activity_type === "order_submitted").length;
    return { activeNow, uniqueSessions, checkoutsStarted, conversions };
  }, [sessions, todayLogs]);

  /* ── Checkout attempts ── */
  const checkoutAttempts = useMemo<CheckoutAttempt[]>(() => {
    // Group today's checkout-related logs by session
    const sessionCheckouts = new Map<string, LiveLog[]>();
    for (const log of todayLogs) {
      if (CHECKOUT_TYPES.includes(log.activity_type) || log.activity_type === "add_to_cart") {
        const key = log.session_id || log.id;
        if (!sessionCheckouts.has(key)) sessionCheckouts.set(key, []);
        sessionCheckouts.get(key)!.push(log);
      }
    }

    const attempts: CheckoutAttempt[] = [];
    const now = Date.now();

    for (const [sessionId, logs] of sessionCheckouts) {
      const sorted = logs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      const latest = sorted[0];
      const page = (latest.metadata as any)?.page || (latest.metadata as any)?.path || null;

      // Find highest step
      let highestRank = 0;
      let highestType = "add_to_cart";
      let highestStep = 0;
      for (const log of logs) {
        const rank = CHECKOUT_RANK[log.activity_type] || 0;
        if (rank > highestRank) {
          highestRank = rank;
          highestType = log.activity_type;
          highestStep = (log.metadata as any)?.step || rank;
        }
      }

      // Determine status
      const hasCompleted = logs.some(l => l.activity_type === "order_completed" || l.activity_type === "order_submitted");
      const timeSinceLast = now - new Date(latest.created_at).getTime();

      let status: CheckoutAttempt["status"] = "active";
      if (hasCompleted) {
        status = "completed";
      } else if (timeSinceLast > ABANDON_THRESHOLD_MS) {
        status = "abandoned";
      }

      attempts.push({
        session_id: sessionId,
        last_activity: latest.created_at,
        highest_step: highestStep,
        highest_type: highestType,
        last_page: page,
        status,
      });
    }

    return attempts.sort((a, b) => new Date(b.last_activity).getTime() - new Date(a.last_activity).getTime());
  }, [todayLogs]);

  const filteredSessions = showOffline ? sessions : sessions.filter(s => s.status !== "offline");

  const attemptStatusConfig: Record<string, { label: string; class: string }> = {
    active: { label: "En cours", class: "bg-emerald-600/15 text-emerald-400 border-0" },
    abandoned: { label: "Abandonné", class: "bg-red-600/15 text-red-400 border-0" },
    completed: { label: "Complété", class: "bg-sky-600/15 text-sky-400 border-0" },
  };

  const stepLabel = (type: string, step: number): string => {
    if (type === "order_completed" || type === "order_submitted") return "✅ Complété";
    if (type === "payment_started") return `Étape ${step} — Paiement`;
    if (type === "checkout_step_completed") return `Étape ${step}`;
    if (type === "checkout_started") return "Étape 1 — Début";
    return "Sélection";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[hsl(var(--core-text-primary))]">Centre de conversion</h1>
          <p className="text-sm text-[hsl(var(--core-text-secondary))]">Visiteurs en direct • Funnel • Abandons</p>
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

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Visiteurs actifs", value: kpis.activeNow, icon: Users, color: "text-emerald-400" },
          { label: "Sessions aujourd'hui", value: kpis.uniqueSessions, icon: Globe, color: "text-sky-400" },
          { label: "Checkouts commencés", value: kpis.checkoutsStarted, icon: ShoppingCart, color: "text-amber-400" },
          { label: "Conversions", value: kpis.conversions, icon: TrendingUp, color: "text-green-400" },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-[hsl(220,15%,16%)] bg-[hsl(220,15%,11%)] p-4">
            <div className="flex items-center gap-2 mb-2">
              <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
              <span className="text-xs text-[hsl(var(--core-text-label))]">{kpi.label}</span>
            </div>
            <div className={`text-3xl font-bold ${kpi.color}`}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* ── Checkout Attempts Table ── */}
      <div className="rounded-xl border border-[hsl(220,15%,16%)] bg-[hsl(220,15%,11%)] p-4">
        <div className="flex items-center gap-2 mb-3">
          <ShoppingCart className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-semibold text-[hsl(var(--core-text-primary))]">Tentatives de commande</h2>
          <Badge className="bg-amber-600/15 text-amber-400 border-0 text-[10px]">{checkoutAttempts.length}</Badge>
        </div>
        {checkoutAttempts.length === 0 ? (
          <p className="text-sm text-[hsl(var(--core-text-label))] py-4 text-center">Aucune tentative de checkout aujourd'hui</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-[hsl(220,15%,16%)] hover:bg-transparent">
                  <TableHead className="text-[hsl(var(--core-text-label))] text-xs">Session</TableHead>
                  <TableHead className="text-[hsl(var(--core-text-label))] text-xs">Étape atteinte</TableHead>
                  <TableHead className="text-[hsl(var(--core-text-label))] text-xs">Page</TableHead>
                  <TableHead className="text-[hsl(var(--core-text-label))] text-xs">Dernière activité</TableHead>
                  <TableHead className="text-[hsl(var(--core-text-label))] text-xs">Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {checkoutAttempts.slice(0, 20).map((attempt) => {
                  const cfg = attemptStatusConfig[attempt.status];
                  return (
                    <TableRow key={attempt.session_id} className="border-[hsl(220,15%,16%)] hover:bg-[hsl(220,15%,14%)]">
                      <TableCell className="font-mono text-xs text-[hsl(var(--core-text-secondary))]">
                        {attempt.session_id.slice(0, 20)}…
                      </TableCell>
                      <TableCell className="text-xs text-[hsl(var(--core-text-primary))]">
                        {stepLabel(attempt.highest_type, attempt.highest_step)}
                      </TableCell>
                      <TableCell className="text-xs text-[hsl(var(--core-text-label))]">
                        {attempt.last_page || "—"}
                      </TableCell>
                      <TableCell className="text-xs text-[hsl(var(--core-text-label))]">
                        {formatTimeAgo(attempt.last_activity)}
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-[10px] ${cfg.class}`}>{cfg.label}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* ── Active sessions ── */}
      <div className="rounded-xl border border-[hsl(220,15%,16%)] bg-[hsl(220,15%,11%)] p-4">
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-4 h-4 text-emerald-400" />
          <h2 className="text-sm font-semibold text-[hsl(var(--core-text-primary))]">Sessions visiteurs</h2>
          <Badge className="bg-emerald-600/15 text-emerald-400 border-0 text-[10px]">{filteredSessions.length}</Badge>
        </div>
        {isLoading ? (
          <p className="text-sm text-[hsl(var(--core-text-label))]">Chargement…</p>
        ) : filteredSessions.length === 0 ? (
          <p className="text-sm text-[hsl(var(--core-text-label))]">Aucun visiteur détecté.</p>
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
                        {s.user_id ? "Utilisateur" : "Visiteur"}
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

      {/* ── Activity feed ── */}
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
