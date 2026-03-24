/**
 * CoreLiveActivityPage — Conversion Center v3
 * Business intelligence dashboard: KPIs, funnel with friction, plan performance, attempts, feed
 * Source: live_activity_logs table
 */
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Activity, Users, RefreshCw, Eye, ShoppingCart, CreditCard,
  UserPlus, Globe, MapPin, TrendingUp, AlertTriangle, BarChart3,
  ArrowDown, Smartphone, Wifi, Tv, Flame, Target, Percent,
  ArrowRight, AlertCircle, CheckCircle2, XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  useConversionAnalytics,
  formatTimeAgo,
  type LiveLog, type VisitorStatus, type PlanPerformance,
} from "@/core-app/hooks/useConversionAnalytics";

/* ═══════════ Config ═══════════ */

type PeriodFilter = "today" | "7d" | "30d";
type CategoryFilter = "all" | "internet" | "mobile" | "tv";

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

const CATEGORY_ICONS: Record<string, typeof Wifi> = { internet: Wifi, mobile: Smartphone, tv: Tv };

const HEALTH_CONFIG: Record<PlanPerformance["health"], { label: string; icon: typeof CheckCircle2; class: string }> = {
  strong: { label: "Performant", icon: CheckCircle2, class: "text-emerald-400 bg-emerald-600/15" },
  moderate: { label: "Moyen", icon: AlertCircle, class: "text-amber-400 bg-amber-600/15" },
  weak: { label: "Faible", icon: XCircle, class: "text-red-400 bg-red-600/15" },
  no_data: { label: "—", icon: AlertCircle, class: "text-zinc-500 bg-zinc-600/15" },
};

function getPeriodStart(period: PeriodFilter): Date {
  const d = new Date();
  if (period === "today") { d.setHours(0, 0, 0, 0); return d; }
  if (period === "7d") { d.setDate(d.getDate() - 7); d.setHours(0, 0, 0, 0); return d; }
  d.setDate(d.getDate() - 30); d.setHours(0, 0, 0, 0);
  return d;
}

const periodLabels: Record<PeriodFilter, string> = { today: "Aujourd'hui", "7d": "7 jours", "30d": "30 jours" };
const categoryLabels: Record<CategoryFilter, string> = { all: "Tout", internet: "Internet", mobile: "Mobile", tv: "TV" };

/* ═══════════ Component ═══════════ */

export default function CoreLiveActivityPage() {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [showOffline, setShowOffline] = useState(false);
  const [period, setPeriod] = useState<PeriodFilter>("today");
  const [category, setCategory] = useState<CategoryFilter>("all");

  const periodStart = useMemo(() => getPeriodStart(period), [period]);

  /* ── Queries ── */
  const { data: recentLogs = [], refetch, isLoading } = useQuery({
    queryKey: ["core-live-activity"],
    queryFn: async () => {
      const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const { data } = await supabase.from("live_activity_logs").select("*")
        .gte("created_at", tenMinAgo).order("created_at", { ascending: false }).limit(200);
      return (data || []) as LiveLog[];
    },
    refetchInterval: autoRefresh ? 5000 : false,
  });

  const { data: periodLogs = [] } = useQuery({
    queryKey: ["core-live-period", period],
    queryFn: async () => {
      const { data } = await supabase.from("live_activity_logs").select("*")
        .gte("created_at", periodStart.toISOString()).order("created_at", { ascending: false }).limit(1000);
      return (data || []) as LiveLog[];
    },
    refetchInterval: autoRefresh ? 10000 : false,
  });

  const { data: feedLogs = [] } = useQuery({
    queryKey: ["core-live-feed"],
    queryFn: async () => {
      const { data } = await supabase.from("live_activity_logs").select("*")
        .order("created_at", { ascending: false }).limit(30);
      return (data || []) as LiveLog[];
    },
    refetchInterval: autoRefresh ? 5000 : false,
  });

  /* ── Analytics ── */
  const { sessions, kpis, funnel, planPerformance, checkoutAttempts, frictionSummary } =
    useConversionAnalytics(recentLogs, periodLogs, category);

  const filteredSessions = showOffline ? sessions : sessions.filter(s => s.status !== "offline");

  const attemptStatusConfig: Record<string, { label: string; class: string; icon: string }> = {
    active: { label: "En cours", class: "bg-emerald-600/15 text-emerald-400 border-0", icon: "🟢" },
    abandoned: { label: "Abandonné", class: "bg-red-600/15 text-red-400 border-0", icon: "🔴" },
    completed: { label: "Complété", class: "bg-sky-600/15 text-sky-400 border-0", icon: "🔵" },
  };

  const stepLabel = (type: string, step: number): string => {
    if (type === "order_completed" || type === "order_submitted") return "✅ Converti";
    if (type === "payment_started") return `Étape ${step} — Paiement`;
    if (type === "checkout_step_completed") return `Étape ${step}`;
    if (type === "checkout_started") return "Étape 1 — Début";
    return "Sélection";
  };

  return (
    <div className="space-y-6">
      {/* ═══ Header ═══ */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-[hsl(var(--core-text-primary))]">Centre de conversion</h1>
          <p className="text-sm text-[hsl(var(--core-text-secondary))]">
            Pilotage commercial • Funnel • Performance forfaits
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
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
          <Button variant="outline" size="sm" onClick={() => refetch()}
            className="gap-2 border-[hsl(220,15%,20%)] bg-transparent text-[hsl(var(--core-text-secondary))]">
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* ═══ KPI Cards with rates ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-3">
        {[
          { label: "Visiteurs actifs", value: kpis.activeNow, icon: Users, color: "text-emerald-400" },
          { label: "Sessions", value: kpis.uniqueSessions, icon: Globe, color: "text-sky-400" },
          { label: "Consultations", value: kpis.planViews, icon: Eye, color: "text-violet-400" },
          { label: "Ajouts panier", value: kpis.addToCarts, icon: ShoppingCart, color: "text-orange-400" },
          { label: "Checkouts", value: kpis.checkoutsStarted, icon: ShoppingCart, color: "text-amber-400" },
          { label: "Conversions", value: kpis.conversions, icon: TrendingUp, color: "text-green-400" },
          { label: "Taux conversion", value: `${kpis.overallConversionRate}%`, icon: Target, color: "text-green-400", isRate: true },
          { label: "Taux abandon", value: `${kpis.abandonRate}%`, icon: AlertTriangle, color: kpis.abandonRate > 70 ? "text-red-400" : "text-amber-400", isRate: true },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-[hsl(220,15%,16%)] bg-[hsl(220,15%,11%)] p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <kpi.icon className={`w-3.5 h-3.5 ${kpi.color}`} />
              <span className="text-[10px] text-[hsl(var(--core-text-label))] uppercase tracking-wider truncate">{kpi.label}</span>
            </div>
            <div className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* ═══ Friction Alert ═══ */}
      {frictionSummary.biggestDrop && frictionSummary.biggestDrop.isFrictionPoint && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 flex items-center gap-3">
          <Flame className="w-5 h-5 text-red-400 shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-400">Point de friction principal détecté</p>
            <p className="text-xs text-[hsl(var(--core-text-secondary))]">
              <strong>{frictionSummary.biggestDrop.businessLabel}</strong> : perte de {frictionSummary.biggestDrop.dropRate}%
              ({frictionSummary.biggestDrop.dropVolume} visiteurs perdus entre «{funnel[funnel.indexOf(frictionSummary.biggestDrop) - 1]?.label || "—"}» et «{frictionSummary.biggestDrop.label}»)
            </p>
          </div>
        </div>
      )}

      {/* ═══ Detailed Funnel ═══ */}
      <div className="rounded-xl border border-[hsl(220,15%,16%)] bg-[hsl(220,15%,11%)] p-4">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-4 h-4 text-violet-400" />
          <h2 className="text-sm font-semibold text-[hsl(var(--core-text-primary))]">Entonnoir de conversion détaillé</h2>
          <Badge className="bg-violet-600/15 text-violet-400 border-0 text-[10px]">{periodLabels[period]}</Badge>
        </div>
        <div className="space-y-1">
          {funnel.map((step, i) => (
            <div key={step.key}>
              <div className="flex items-center gap-3 py-1">
                <span className={cn(
                  "text-xs w-40 shrink-0 font-medium",
                  step.isFrictionPoint ? "text-red-400" : "text-[hsl(var(--core-text-secondary))]"
                )}>
                  {step.businessLabel}
                </span>
                <div className="flex-1 h-7 bg-[hsl(220,15%,14%)] rounded-md overflow-hidden relative">
                  <div
                    className={cn(
                      "h-full rounded-md transition-all duration-500",
                      step.isFrictionPoint ? "bg-red-500/30"
                        : i === funnel.length - 1 ? "bg-green-500/40"
                        : "bg-violet-500/30"
                    )}
                    style={{ width: `${Math.max(step.pct, 3)}%` }}
                  />
                  <span className="absolute inset-0 flex items-center justify-between px-2.5 text-xs">
                    <span className="font-semibold text-[hsl(var(--core-text-primary))]">{step.count}</span>
                    <span className="text-[hsl(var(--core-text-label))]">{step.uniqueSessions} sessions</span>
                  </span>
                </div>
                <div className="w-20 shrink-0 text-right">
                  {step.dropRate !== null && step.dropRate > 0 ? (
                    <span className={cn(
                      "text-[11px] font-medium flex items-center justify-end gap-0.5",
                      step.isFrictionPoint ? "text-red-400" : "text-amber-400"
                    )}>
                      <ArrowDown className="w-3 h-3" />-{step.dropRate}%
                    </span>
                  ) : step.dropRate === 0 ? (
                    <span className="text-[11px] text-emerald-400">→ 0%</span>
                  ) : null}
                </div>
              </div>
              {/* Inter-step connector with volume lost */}
              {i < funnel.length - 1 && step.dropVolume !== null && step.dropVolume > 0 && (
                <div className="flex items-center gap-3 py-0.5 ml-40 pl-3">
                  <div className="flex-1 flex items-center gap-1.5">
                    <ArrowRight className="w-3 h-3 text-[hsl(var(--core-text-label))]" />
                    <span className="text-[10px] text-[hsl(var(--core-text-label))]">
                      {step.dropVolume} perdu{step.dropVolume > 1 ? "s" : ""}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ═══ Plan Performance Table ═══ */}
      <div className="rounded-xl border border-[hsl(220,15%,16%)] bg-[hsl(220,15%,11%)] p-4">
        <div className="flex items-center gap-2 mb-3">
          <Percent className="w-4 h-4 text-orange-400" />
          <h2 className="text-sm font-semibold text-[hsl(var(--core-text-primary))]">Performance par forfait</h2>
          <Badge className="bg-orange-600/15 text-orange-400 border-0 text-[10px]">Vus vs Convertis</Badge>
        </div>
        {planPerformance.length === 0 ? (
          <p className="text-sm text-[hsl(var(--core-text-label))] py-4 text-center">Aucune donnée de forfait</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-[hsl(220,15%,16%)] hover:bg-transparent">
                  <TableHead className="text-[hsl(var(--core-text-label))] text-[10px]">Forfait</TableHead>
                  <TableHead className="text-[hsl(var(--core-text-label))] text-[10px] text-center">Vues</TableHead>
                  <TableHead className="text-[hsl(var(--core-text-label))] text-[10px] text-center">Panier</TableHead>
                  <TableHead className="text-[hsl(var(--core-text-label))] text-[10px] text-center">Checkout</TableHead>
                  <TableHead className="text-[hsl(var(--core-text-label))] text-[10px] text-center">Conversions</TableHead>
                  <TableHead className="text-[hsl(var(--core-text-label))] text-[10px] text-center">Vue→Panier</TableHead>
                  <TableHead className="text-[hsl(var(--core-text-label))] text-[10px] text-center">Panier→Checkout</TableHead>
                  <TableHead className="text-[hsl(var(--core-text-label))] text-[10px] text-center">Santé</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {planPerformance.map((plan) => {
                  const CatIcon = CATEGORY_ICONS[plan.category] || Globe;
                  const healthCfg = HEALTH_CONFIG[plan.health];
                  const HealthIcon = healthCfg.icon;
                  return (
                    <TableRow key={plan.name} className="border-[hsl(220,15%,16%)] hover:bg-[hsl(220,15%,14%)]">
                      <TableCell className="py-2">
                        <div className="flex items-center gap-2">
                          <CatIcon className="w-3.5 h-3.5 text-[hsl(var(--core-text-label))] shrink-0" />
                          <span className="text-xs text-[hsl(var(--core-text-primary))] truncate max-w-[200px]">{plan.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-center text-[hsl(var(--core-text-secondary))] py-2 tabular-nums">{plan.views}</TableCell>
                      <TableCell className="text-xs text-center text-[hsl(var(--core-text-secondary))] py-2 tabular-nums">{plan.carts}</TableCell>
                      <TableCell className="text-xs text-center text-[hsl(var(--core-text-secondary))] py-2 tabular-nums">{plan.checkouts}</TableCell>
                      <TableCell className="text-xs text-center py-2 tabular-nums">
                        <span className={plan.conversions > 0 ? "text-green-400 font-semibold" : "text-[hsl(var(--core-text-label))]"}>
                          {plan.conversions}
                        </span>
                      </TableCell>
                      <TableCell className="text-center py-2">
                        <span className={cn("text-[10px] font-medium",
                          plan.viewToCartRate >= 20 ? "text-emerald-400" : plan.viewToCartRate >= 10 ? "text-amber-400" : "text-red-400"
                        )}>
                          {plan.viewToCartRate}%
                        </span>
                      </TableCell>
                      <TableCell className="text-center py-2">
                        <span className={cn("text-[10px] font-medium",
                          plan.cartToCheckoutRate >= 50 ? "text-emerald-400" : plan.cartToCheckoutRate >= 25 ? "text-amber-400" : "text-red-400"
                        )}>
                          {plan.carts > 0 ? `${plan.cartToCheckoutRate}%` : "—"}
                        </span>
                      </TableCell>
                      <TableCell className="py-2">
                        <Badge className={cn("text-[10px] border-0 gap-1", healthCfg.class)}>
                          <HealthIcon className="w-3 h-3" />
                          {healthCfg.label}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* ═══ Checkout Attempts ═══ */}
      <div className="rounded-xl border border-[hsl(220,15%,16%)] bg-[hsl(220,15%,11%)] p-4">
        <div className="flex items-center gap-2 mb-3">
          <ShoppingCart className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-semibold text-[hsl(var(--core-text-primary))]">Tentatives de commande</h2>
          <Badge className="bg-amber-600/15 text-amber-400 border-0 text-[10px]">{checkoutAttempts.length}</Badge>
          {checkoutAttempts.filter(a => a.status === "abandoned").length > 0 && (
            <Badge className="bg-red-600/15 text-red-400 border-0 text-[10px]">
              {checkoutAttempts.filter(a => a.status === "abandoned").length} abandonnées
            </Badge>
          )}
        </div>
        {checkoutAttempts.length === 0 ? (
          <p className="text-sm text-[hsl(var(--core-text-label))] py-4 text-center">Aucune tentative</p>
        ) : (
          <div className="overflow-x-auto max-h-[320px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-[hsl(220,15%,16%)] hover:bg-transparent">
                  <TableHead className="text-[hsl(var(--core-text-label))] text-[10px]">Session</TableHead>
                  <TableHead className="text-[hsl(var(--core-text-label))] text-[10px]">Service</TableHead>
                  <TableHead className="text-[hsl(var(--core-text-label))] text-[10px]">Progression</TableHead>
                  <TableHead className="text-[hsl(var(--core-text-label))] text-[10px]">Il y a</TableHead>
                  <TableHead className="text-[hsl(var(--core-text-label))] text-[10px]">Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {checkoutAttempts.slice(0, 25).map((attempt) => {
                  const cfg = attemptStatusConfig[attempt.status];
                  const CatIcon = attempt.category ? CATEGORY_ICONS[attempt.category] : null;
                  return (
                    <TableRow key={attempt.session_id}
                      className={cn("border-[hsl(220,15%,16%)]",
                        attempt.status === "abandoned" ? "hover:bg-red-500/5" : "hover:bg-[hsl(220,15%,14%)]"
                      )}>
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

      {/* ═══ Sessions + Feed (2 columns) ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
            <p className="text-sm text-[hsl(var(--core-text-label))]">Aucun visiteur détecté.</p>
          ) : (
            <div className="space-y-2 max-h-[350px] overflow-y-auto">
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

        {/* Activity feed */}
        <div className="rounded-xl border border-[hsl(220,15%,16%)] bg-[hsl(220,15%,11%)] p-4">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-sky-400" />
            <h2 className="text-sm font-semibold text-[hsl(var(--core-text-primary))]">Fil d'activité</h2>
          </div>
          <div className="space-y-1.5 max-h-[350px] overflow-y-auto">
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
    </div>
  );
}
