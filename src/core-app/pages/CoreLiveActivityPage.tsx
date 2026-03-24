/**
 * CoreLiveActivityPage — Conversion Center v2
 * Full analytics dashboard: KPIs, funnel, top plans, attempts table, activity feed
 * Source: live_activity_logs table
 */
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Activity, Users, Clock, RefreshCw, Eye, ShoppingCart, CreditCard,
  UserPlus, Globe, MapPin, TrendingUp, AlertTriangle, BarChart3,
  ArrowDown, Filter, Smartphone, Wifi, Tv,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

/* ═══════════ Types ═══════════ */

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
type PeriodFilter = "today" | "7d" | "30d";
type CategoryFilter = "all" | "internet" | "mobile" | "tv";

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

interface CheckoutAttempt {
  session_id: string;
  last_activity: string;
  highest_step: number;
  highest_type: string;
  last_page: string | null;
  category: string | null;
  plan_name: string | null;
  status: "active" | "abandoned" | "completed";
}

/* ═══════════ Constants ═══════════ */

const CHECKOUT_TYPES = [
  "checkout_started", "checkout_step_completed", "payment_started",
  "order_submitted", "order_completed", "checkout_abandoned", "add_to_cart",
];

const CHECKOUT_RANK: Record<string, number> = {
  add_to_cart: 0,
  checkout_started: 1,
  checkout_step_completed: 2,
  payment_started: 3,
  order_submitted: 4,
  order_completed: 5,
};

const FUNNEL_STEPS = [
  { key: "plan_view", label: "Consultation forfait", icon: Eye },
  { key: "add_to_cart", label: "Ajout au panier", icon: ShoppingCart },
  { key: "checkout_started", label: "Checkout débuté", icon: ShoppingCart },
  { key: "checkout_step_completed", label: "Étapes complétées", icon: CreditCard },
  { key: "payment_started", label: "Paiement initié", icon: CreditCard },
  { key: "order_completed", label: "Conversion", icon: TrendingUp },
];

const ABANDON_THRESHOLD_MS = 30 * 60 * 1000;

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
  page_view: Eye, plan_view: Eye, add_to_cart: ShoppingCart,
  checkout_started: ShoppingCart, checkout_step_completed: ShoppingCart,
  checkout_abandoned: AlertTriangle, payment_started: CreditCard,
  order_submitted: ShoppingCart, order_started: ShoppingCart,
  order_completed: TrendingUp, signup: UserPlus, login: UserPlus,
};

const CATEGORY_ICONS: Record<string, typeof Wifi> = {
  internet: Wifi, mobile: Smartphone, tv: Tv,
};

/* ═══════════ Helpers ═══════════ */

function getPeriodStart(period: PeriodFilter): Date {
  const d = new Date();
  if (period === "today") { d.setHours(0, 0, 0, 0); return d; }
  if (period === "7d") { d.setDate(d.getDate() - 7); d.setHours(0, 0, 0, 0); return d; }
  d.setDate(d.getDate() - 30); d.setHours(0, 0, 0, 0);
  return d;
}

function extractCategory(log: LiveLog): string | null {
  const meta = log.metadata as any;
  if (meta?.category) return meta.category.toLowerCase();
  const label = log.activity_label?.toLowerCase() || "";
  if (label.includes("internet")) return "internet";
  if (label.includes("mobile")) return "mobile";
  if (label.includes("tv") || label.includes("télé")) return "tv";
  return null;
}

function formatTimeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 10) return "à l'instant";
  if (seconds < 60) return `il y a ${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `il y a ${minutes}m`;
  return `il y a ${Math.floor(minutes / 60)}h`;
}

/* ═══════════ Component ═══════════ */

export default function CoreLiveActivityPage() {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [showOffline, setShowOffline] = useState(false);
  const [period, setPeriod] = useState<PeriodFilter>("today");
  const [category, setCategory] = useState<CategoryFilter>("all");

  const periodStart = useMemo(() => getPeriodStart(period), [period]);

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

  /* ── Fetch period logs ── */
  const { data: periodLogs = [] } = useQuery({
    queryKey: ["core-live-period", period],
    queryFn: async () => {
      const { data } = await supabase
        .from("live_activity_logs")
        .select("*")
        .gte("created_at", periodStart.toISOString())
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

  /* ── Apply category filter ── */
  const filteredPeriodLogs = useMemo(() => {
    if (category === "all") return periodLogs;
    return periodLogs.filter(l => extractCategory(l) === category);
  }, [periodLogs, category]);

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
    const uniqueSessions = new Set(filteredPeriodLogs.map(l => l.session_id)).size;
    const checkoutsStarted = filteredPeriodLogs.filter(l => l.activity_type === "checkout_started").length;
    const conversions = filteredPeriodLogs.filter(l => l.activity_type === "order_completed" || l.activity_type === "order_submitted").length;
    const planViews = filteredPeriodLogs.filter(l => l.activity_type === "plan_view").length;
    const addToCarts = filteredPeriodLogs.filter(l => l.activity_type === "add_to_cart").length;
    return { activeNow, uniqueSessions, checkoutsStarted, conversions, planViews, addToCarts };
  }, [sessions, filteredPeriodLogs]);

  /* ── Funnel data ── */
  const funnel = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const step of FUNNEL_STEPS) {
      if (step.key === "order_completed") {
        counts[step.key] = filteredPeriodLogs.filter(l =>
          l.activity_type === "order_completed" || l.activity_type === "order_submitted"
        ).length;
      } else {
        counts[step.key] = filteredPeriodLogs.filter(l => l.activity_type === step.key).length;
      }
    }
    const maxCount = Math.max(...Object.values(counts), 1);
    return FUNNEL_STEPS.map((step, i) => {
      const count = counts[step.key] || 0;
      const prevCount = i > 0 ? (counts[FUNNEL_STEPS[i - 1].key] || 0) : count;
      const dropRate = prevCount > 0 && i > 0 ? Math.round(((prevCount - count) / prevCount) * 100) : null;
      return { ...step, count, pct: Math.round((count / maxCount) * 100), dropRate };
    });
  }, [filteredPeriodLogs]);

  /* ── Top plans ── */
  const topPlans = useMemo(() => {
    const planLogs = filteredPeriodLogs.filter(l => l.activity_type === "plan_view" || l.activity_type === "add_to_cart");
    const planCounts = new Map<string, { views: number; carts: number; checkouts: number; category: string }>();

    for (const log of planLogs) {
      const meta = log.metadata as any;
      const cat = meta?.category || extractCategory(log) || "autre";
      const label = log.activity_label || cat;
      const key = label;
      if (!planCounts.has(key)) planCounts.set(key, { views: 0, carts: 0, checkouts: 0, category: cat });
      const entry = planCounts.get(key)!;
      if (log.activity_type === "plan_view") entry.views++;
      if (log.activity_type === "add_to_cart") entry.carts++;
    }

    // Count checkouts per category from checkout logs
    for (const log of filteredPeriodLogs) {
      if (log.activity_type === "checkout_started") {
        const cat = extractCategory(log);
        for (const [key, entry] of planCounts) {
          if (entry.category === cat) entry.checkouts++;
        }
      }
    }

    return Array.from(planCounts.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => (b.views + b.carts) - (a.views + a.carts))
      .slice(0, 8);
  }, [filteredPeriodLogs]);

  /* ── Checkout attempts ── */
  const checkoutAttempts = useMemo<CheckoutAttempt[]>(() => {
    const sessionCheckouts = new Map<string, LiveLog[]>();
    for (const log of filteredPeriodLogs) {
      if (CHECKOUT_TYPES.includes(log.activity_type)) {
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

      let highestRank = 0;
      let highestType = "add_to_cart";
      let highestStep = 0;
      let cat: string | null = null;
      let planName: string | null = null;

      for (const log of logs) {
        const rank = CHECKOUT_RANK[log.activity_type] || 0;
        if (rank > highestRank) {
          highestRank = rank;
          highestType = log.activity_type;
          highestStep = (log.metadata as any)?.step || rank;
        }
        if (!cat) cat = extractCategory(log);
        if (!planName && log.activity_label) {
          const match = log.activity_label.match(/Ajout:\s*(.+)/);
          if (match) planName = match[1];
        }
      }

      const hasCompleted = logs.some(l => l.activity_type === "order_completed" || l.activity_type === "order_submitted");
      const timeSinceLast = now - new Date(latest.created_at).getTime();

      let status: CheckoutAttempt["status"] = "active";
      if (hasCompleted) status = "completed";
      else if (timeSinceLast > ABANDON_THRESHOLD_MS) status = "abandoned";

      attempts.push({
        session_id: sessionId,
        last_activity: latest.created_at,
        highest_step: highestStep,
        highest_type: highestType,
        last_page: page,
        category: cat,
        plan_name: planName,
        status,
      });
    }

    return attempts.sort((a, b) => new Date(b.last_activity).getTime() - new Date(a.last_activity).getTime());
  }, [filteredPeriodLogs]);

  const filteredSessions = showOffline ? sessions : sessions.filter(s => s.status !== "offline");

  const attemptStatusConfig: Record<string, { label: string; class: string; icon: string }> = {
    active: { label: "En cours", class: "bg-emerald-600/15 text-emerald-400 border-0", icon: "🟢" },
    abandoned: { label: "Abandonné", class: "bg-red-600/15 text-red-400 border-0", icon: "🔴" },
    completed: { label: "Complété", class: "bg-sky-600/15 text-sky-400 border-0", icon: "🔵" },
  };

  const stepLabel = (type: string, step: number): string => {
    if (type === "order_completed" || type === "order_submitted") return "✅ Complété";
    if (type === "payment_started") return `Étape ${step} — Paiement`;
    if (type === "checkout_step_completed") return `Étape ${step}`;
    if (type === "checkout_started") return "Étape 1 — Début";
    return "Sélection";
  };

  const periodLabels: Record<PeriodFilter, string> = { today: "Aujourd'hui", "7d": "7 jours", "30d": "30 jours" };
  const categoryLabels: Record<CategoryFilter, string> = { all: "Tout", internet: "Internet", mobile: "Mobile", tv: "TV" };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-[hsl(var(--core-text-primary))]">Centre de conversion</h1>
          <p className="text-sm text-[hsl(var(--core-text-secondary))]">Visiteurs en direct • Funnel • Abandons</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Period filter */}
          <div className="flex items-center gap-1 bg-[hsl(220,15%,13%)] rounded-lg p-0.5">
            {(["today", "7d", "30d"] as PeriodFilter[]).map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={cn("px-3 py-1 text-xs font-medium rounded-md transition-colors",
                  period === p ? "bg-[hsl(220,15%,18%)] text-[hsl(var(--core-text-primary))] shadow-sm"
                    : "text-[hsl(var(--core-text-label))] hover:text-[hsl(var(--core-text-secondary))]"
                )}>
                {periodLabels[p]}
              </button>
            ))}
          </div>
          {/* Category filter */}
          <div className="flex items-center gap-1 bg-[hsl(220,15%,13%)] rounded-lg p-0.5">
            {(["all", "internet", "mobile", "tv"] as CategoryFilter[]).map(c => {
              const CatIcon = CATEGORY_ICONS[c];
              return (
                <button key={c} onClick={() => setCategory(c)}
                  className={cn("px-2.5 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1",
                    category === c ? "bg-[hsl(220,15%,18%)] text-[hsl(var(--core-text-primary))] shadow-sm"
                      : "text-[hsl(var(--core-text-label))] hover:text-[hsl(var(--core-text-secondary))]"
                  )}>
                  {CatIcon && <CatIcon className="w-3 h-3" />}
                  {categoryLabels[c]}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={showOffline} onCheckedChange={setShowOffline} />
            <span className="text-xs text-[hsl(var(--core-text-label))]">Offline</span>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} />
            <span className="text-xs text-[hsl(var(--core-text-label))]">Live</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2 border-[hsl(220,15%,20%)] bg-transparent text-[hsl(var(--core-text-secondary))]">
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        {[
          { label: "Visiteurs actifs", value: kpis.activeNow, icon: Users, color: "text-emerald-400" },
          { label: "Sessions", value: kpis.uniqueSessions, icon: Globe, color: "text-sky-400" },
          { label: "Consultations", value: kpis.planViews, icon: Eye, color: "text-violet-400" },
          { label: "Ajouts panier", value: kpis.addToCarts, icon: ShoppingCart, color: "text-orange-400" },
          { label: "Checkouts", value: kpis.checkoutsStarted, icon: ShoppingCart, color: "text-amber-400" },
          { label: "Conversions", value: kpis.conversions, icon: TrendingUp, color: "text-green-400" },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-[hsl(220,15%,16%)] bg-[hsl(220,15%,11%)] p-3">
            <div className="flex items-center gap-2 mb-1.5">
              <kpi.icon className={`w-3.5 h-3.5 ${kpi.color}`} />
              <span className="text-[10px] text-[hsl(var(--core-text-label))] uppercase tracking-wider">{kpi.label}</span>
            </div>
            <div className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* ── Funnel Visualization ── */}
      <div className="rounded-xl border border-[hsl(220,15%,16%)] bg-[hsl(220,15%,11%)] p-4">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-4 h-4 text-violet-400" />
          <h2 className="text-sm font-semibold text-[hsl(var(--core-text-primary))]">Entonnoir de conversion</h2>
          <Badge className="bg-violet-600/15 text-violet-400 border-0 text-[10px]">{periodLabels[period]}</Badge>
        </div>
        <div className="space-y-2">
          {funnel.map((step, i) => {
            const StepIcon = step.icon;
            return (
              <div key={step.key} className="flex items-center gap-3">
                <StepIcon className="w-4 h-4 text-[hsl(var(--core-text-label))] shrink-0" />
                <span className="text-xs text-[hsl(var(--core-text-secondary))] w-36 shrink-0">{step.label}</span>
                <div className="flex-1 h-6 bg-[hsl(220,15%,14%)] rounded-md overflow-hidden relative">
                  <div
                    className={cn(
                      "h-full rounded-md transition-all duration-500",
                      i === funnel.length - 1 ? "bg-green-500/40" : "bg-violet-500/30"
                    )}
                    style={{ width: `${Math.max(step.pct, 2)}%` }}
                  />
                  <span className="absolute inset-0 flex items-center px-2 text-xs font-medium text-[hsl(var(--core-text-primary))]">
                    {step.count}
                  </span>
                </div>
                {step.dropRate !== null && step.dropRate > 0 && (
                  <span className="text-[10px] text-red-400 flex items-center gap-0.5 w-16 shrink-0">
                    <ArrowDown className="w-3 h-3" />-{step.dropRate}%
                  </span>
                )}
                {step.dropRate === null && <span className="w-16 shrink-0" />}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Top Plans + Checkout Attempts (2 columns on lg) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Plans */}
        <div className="rounded-xl border border-[hsl(220,15%,16%)] bg-[hsl(220,15%,11%)] p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-orange-400" />
            <h2 className="text-sm font-semibold text-[hsl(var(--core-text-primary))]">Top forfaits</h2>
          </div>
          {topPlans.length === 0 ? (
            <p className="text-sm text-[hsl(var(--core-text-label))] py-4 text-center">Aucune consultation de forfait</p>
          ) : (
            <div className="space-y-2">
              {topPlans.map((plan, i) => {
                const CatIcon = CATEGORY_ICONS[plan.category] || Globe;
                return (
                  <div key={plan.name} className="flex items-center gap-3 py-1.5">
                    <span className="text-xs text-[hsl(var(--core-text-label))] w-5 text-right">{i + 1}.</span>
                    <CatIcon className="w-3.5 h-3.5 text-[hsl(var(--core-text-label))] shrink-0" />
                    <span className="text-xs text-[hsl(var(--core-text-primary))] flex-1 truncate">{plan.name}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-[hsl(var(--core-text-label))]">{plan.views} vues</span>
                      {plan.carts > 0 && (
                        <Badge className="bg-orange-600/15 text-orange-400 border-0 text-[10px]">{plan.carts} ajouts</Badge>
                      )}
                      {plan.checkouts > 0 && (
                        <Badge className="bg-amber-600/15 text-amber-400 border-0 text-[10px]">{plan.checkouts} checkout</Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Checkout Attempts Table */}
        <div className="rounded-xl border border-[hsl(220,15%,16%)] bg-[hsl(220,15%,11%)] p-4">
          <div className="flex items-center gap-2 mb-3">
            <ShoppingCart className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-semibold text-[hsl(var(--core-text-primary))]">Tentatives de commande</h2>
            <Badge className="bg-amber-600/15 text-amber-400 border-0 text-[10px]">{checkoutAttempts.length}</Badge>
          </div>
          {checkoutAttempts.length === 0 ? (
            <p className="text-sm text-[hsl(var(--core-text-label))] py-4 text-center">Aucune tentative</p>
          ) : (
            <div className="overflow-x-auto max-h-[320px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-[hsl(220,15%,16%)] hover:bg-transparent">
                    <TableHead className="text-[hsl(var(--core-text-label))] text-[10px]">Session</TableHead>
                    <TableHead className="text-[hsl(var(--core-text-label))] text-[10px]">Catégorie</TableHead>
                    <TableHead className="text-[hsl(var(--core-text-label))] text-[10px]">Étape</TableHead>
                    <TableHead className="text-[hsl(var(--core-text-label))] text-[10px]">Dernière activité</TableHead>
                    <TableHead className="text-[hsl(var(--core-text-label))] text-[10px]">Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {checkoutAttempts.slice(0, 20).map((attempt) => {
                    const cfg = attemptStatusConfig[attempt.status];
                    const CatIcon = attempt.category ? CATEGORY_ICONS[attempt.category] : null;
                    return (
                      <TableRow key={attempt.session_id} className="border-[hsl(220,15%,16%)] hover:bg-[hsl(220,15%,14%)]">
                        <TableCell className="font-mono text-[10px] text-[hsl(var(--core-text-secondary))] py-2">
                          {attempt.session_id.slice(0, 18)}…
                        </TableCell>
                        <TableCell className="py-2">
                          <div className="flex items-center gap-1.5">
                            {CatIcon && <CatIcon className="w-3 h-3 text-[hsl(var(--core-text-label))]" />}
                            <span className="text-[10px] text-[hsl(var(--core-text-secondary))] capitalize">{attempt.category || "—"}</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-2">
                          <Badge className={cn("text-[10px] border-0",
                            attempt.status === "completed" ? "bg-green-600/15 text-green-400"
                              : attempt.highest_step >= 3 ? "bg-amber-600/15 text-amber-400"
                              : "bg-zinc-600/15 text-zinc-400"
                          )}>
                            {stepLabel(attempt.highest_type, attempt.highest_step)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-[10px] text-[hsl(var(--core-text-label))] py-2">
                          {formatTimeAgo(attempt.last_activity)}
                        </TableCell>
                        <TableCell className="py-2">
                          <Badge className={`text-[10px] ${cfg.class}`}>{cfg.icon} {cfg.label}</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
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
                      <span className="text-[10px] text-[hsl(var(--core-text-label))] font-mono">{s.session_id.slice(0, 16)}…</span>
                      <Badge className={`text-[10px] px-1.5 py-0 ${cfg.color}`}>{cfg.label}</Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-[hsl(var(--core-text-label))] mt-0.5">
                      {s.last_page && <span className="truncate">{s.last_page}</span>}
                      {s.city && <span className="flex items-center gap-1 shrink-0"><MapPin className="w-3 h-3" />{s.city}</span>}
                      <span className="shrink-0">{s.activity_count} action{s.activity_count > 1 ? "s" : ""}</span>
                    </div>
                  </div>
                  <span className="text-xs text-[hsl(var(--core-text-label))] shrink-0">{formatTimeAgo(s.last_activity)}</span>
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
                {log.city && <span className="text-[10px] text-[hsl(var(--core-text-label))] shrink-0">{log.city}</span>}
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
