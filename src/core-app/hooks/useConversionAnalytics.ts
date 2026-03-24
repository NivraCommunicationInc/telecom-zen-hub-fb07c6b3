/**
 * useConversionAnalytics — Centralized analytics computations for the Conversion Center
 * Extracts all business logic from the page component for reusability and testability.
 * 
 * Future-ready: data model supports session scoring, email capture, and campaign tagging.
 */
import { useMemo } from "react";

export interface LiveLog {
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

export type VisitorStatus = "active" | "inactive" | "offline";

export interface SessionSummary {
  session_id: string;
  user_id: string | null;
  last_activity: string;
  last_label: string | null;
  last_page: string | null;
  city: string | null;
  activity_count: number;
  status: VisitorStatus;
  /** Future: engagement score based on depth + recency */
  score?: number;
}

export interface CheckoutAttempt {
  session_id: string;
  last_activity: string;
  highest_step: number;
  highest_type: string;
  last_page: string | null;
  category: string | null;
  plan_name: string | null;
  status: "active" | "abandoned" | "completed";
  /** Future: captured email for retargeting */
  email?: string | null;
}

export interface PlanPerformance {
  name: string;
  category: string;
  views: number;
  carts: number;
  checkouts: number;
  conversions: number;
  viewToCartRate: number;
  cartToCheckoutRate: number;
  checkoutToConversionRate: number;
  overallConversionRate: number;
  health: "strong" | "moderate" | "weak" | "no_data";
}

export interface FunnelStep {
  key: string;
  label: string;
  businessLabel: string;
  count: number;
  uniqueSessions: number;
  pct: number;
  dropRate: number | null;
  dropVolume: number | null;
  isFrictionPoint: boolean;
}

export interface ConversionKPIs {
  activeNow: number;
  uniqueSessions: number;
  planViews: number;
  addToCarts: number;
  checkoutsStarted: number;
  conversions: number;
  overallConversionRate: number;
  abandonRate: number;
}

/* ═══════════ Constants ═══════════ */

const ABANDON_THRESHOLD_MS = 30 * 60 * 1000;

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

const FUNNEL_DEFINITION = [
  { key: "plan_view", label: "Consultation forfait", businessLabel: "Visiteurs intéressés" },
  { key: "add_to_cart", label: "Ajout au panier", businessLabel: "Intention d'achat" },
  { key: "checkout_started", label: "Checkout débuté", businessLabel: "Engagement achat" },
  { key: "checkout_step_completed", label: "Formulaire complété", businessLabel: "Qualification client" },
  { key: "payment_started", label: "Paiement initié", businessLabel: "Prêt à payer" },
  { key: "order_completed", label: "Conversion", businessLabel: "Client converti ✓" },
];

/* ═══════════ Helpers ═══════════ */

export function extractCategory(log: LiveLog): string | null {
  const meta = log.metadata as any;
  if (meta?.category) return meta.category.toLowerCase();
  const label = log.activity_label?.toLowerCase() || "";
  if (label.includes("internet")) return "internet";
  if (label.includes("mobile")) return "mobile";
  if (label.includes("tv") || label.includes("télé")) return "tv";
  return null;
}

export function getVisitorStatus(lastActivity: string): VisitorStatus {
  const diffSec = (Date.now() - new Date(lastActivity).getTime()) / 1000;
  if (diffSec <= 60) return "active";
  if (diffSec <= 300) return "inactive";
  return "offline";
}

export function formatTimeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 10) return "à l'instant";
  if (seconds < 60) return `il y a ${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `il y a ${minutes}m`;
  return `il y a ${Math.floor(minutes / 60)}h`;
}

function safeRate(numerator: number, denominator: number): number {
  return denominator > 0 ? Math.round((numerator / denominator) * 100) : 0;
}

function getHealth(overallRate: number, views: number): PlanPerformance["health"] {
  if (views === 0) return "no_data";
  if (overallRate >= 15) return "strong";
  if (overallRate >= 5) return "moderate";
  return "weak";
}

/* ═══════════ Hook ═══════════ */

export function useConversionAnalytics(
  recentLogs: LiveLog[],
  periodLogs: LiveLog[],
  category: string
) {
  const filteredLogs = useMemo(() => {
    if (category === "all") return periodLogs;
    return periodLogs.filter(l => extractCategory(l) === category);
  }, [periodLogs, category]);

  /* ── Sessions ── */
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
  const kpis = useMemo<ConversionKPIs>(() => {
    const activeNow = sessions.filter(s => s.status === "active").length;
    const uniqueSessions = new Set(filteredLogs.map(l => l.session_id)).size;
    const planViews = filteredLogs.filter(l => l.activity_type === "plan_view").length;
    const addToCarts = filteredLogs.filter(l => l.activity_type === "add_to_cart").length;
    const checkoutsStarted = filteredLogs.filter(l => l.activity_type === "checkout_started").length;
    const conversions = filteredLogs.filter(l =>
      l.activity_type === "order_completed" || l.activity_type === "order_submitted"
    ).length;
    return {
      activeNow, uniqueSessions, planViews, addToCarts, checkoutsStarted, conversions,
      overallConversionRate: safeRate(conversions, planViews),
      abandonRate: checkoutsStarted > 0 ? safeRate(checkoutsStarted - conversions, checkoutsStarted) : 0,
    };
  }, [sessions, filteredLogs]);

  /* ── Detailed Funnel ── */
  const funnel = useMemo<FunnelStep[]>(() => {
    // Count unique sessions per step for more accurate funnel
    const sessionsByStep: Record<string, Set<string>> = {};
    const countsByStep: Record<string, number> = {};

    for (const def of FUNNEL_DEFINITION) {
      sessionsByStep[def.key] = new Set();
      countsByStep[def.key] = 0;
    }

    for (const log of filteredLogs) {
      const key = log.activity_type === "order_submitted" ? "order_completed" : log.activity_type;
      if (sessionsByStep[key]) {
        sessionsByStep[key].add(log.session_id || log.id);
        countsByStep[key]++;
      }
    }

    const maxCount = Math.max(...Object.values(countsByStep), 1);

    return FUNNEL_DEFINITION.map((def, i) => {
      const count = countsByStep[def.key] || 0;
      const uniqueSessions = sessionsByStep[def.key]?.size || 0;
      const prevCount = i > 0 ? (countsByStep[FUNNEL_DEFINITION[i - 1].key] || 0) : count;
      const dropRate = prevCount > 0 && i > 0 ? safeRate(prevCount - count, prevCount) : null;
      const dropVolume = prevCount > 0 && i > 0 ? prevCount - count : null;
      // Friction point = drop > 60% AND volume lost > 0
      const isFrictionPoint = (dropRate !== null && dropRate > 60 && (dropVolume || 0) > 0);

      return {
        ...def,
        count,
        uniqueSessions,
        pct: Math.round((count / maxCount) * 100),
        dropRate,
        dropVolume,
        isFrictionPoint,
      };
    });
  }, [filteredLogs]);

  /* ── Plan Performance ── */
  const planPerformance = useMemo<PlanPerformance[]>(() => {
    // Build per-session journey to track which plans led to conversions
    const sessionJourneys = new Map<string, { plans: Set<string>; categories: Set<string>; maxStep: string }>();

    for (const log of filteredLogs) {
      const sid = log.session_id || log.id;
      if (!sessionJourneys.has(sid)) {
        sessionJourneys.set(sid, { plans: new Set(), categories: new Set(), maxStep: "" });
      }
      const journey = sessionJourneys.get(sid)!;

      if (log.activity_type === "plan_view" || log.activity_type === "add_to_cart") {
        const label = log.activity_label || "";
        journey.plans.add(label);
        const cat = extractCategory(log);
        if (cat) journey.categories.add(cat);
      }

      const rank = CHECKOUT_RANK[log.activity_type] ?? -1;
      const currentRank = CHECKOUT_RANK[journey.maxStep] ?? -1;
      if (rank > currentRank) journey.maxStep = log.activity_type;
    }

    // Aggregate per plan
    const planMap = new Map<string, { views: number; carts: number; checkouts: number; conversions: number; category: string }>();

    for (const log of filteredLogs) {
      if (log.activity_type !== "plan_view" && log.activity_type !== "add_to_cart") continue;
      const label = log.activity_label || "Inconnu";
      const cat = extractCategory(log) || "autre";

      if (!planMap.has(label)) {
        planMap.set(label, { views: 0, carts: 0, checkouts: 0, conversions: 0, category: cat });
      }
      const entry = planMap.get(label)!;
      if (log.activity_type === "plan_view") entry.views++;
      if (log.activity_type === "add_to_cart") entry.carts++;
    }

    // Attribute checkouts and conversions based on session journeys
    for (const [, journey] of sessionJourneys) {
      for (const planLabel of journey.plans) {
        const entry = planMap.get(planLabel);
        if (!entry) continue;

        const rank = CHECKOUT_RANK[journey.maxStep] ?? -1;
        if (rank >= CHECKOUT_RANK.checkout_started) entry.checkouts++;
        if (rank >= CHECKOUT_RANK.order_completed) entry.conversions++;
      }
    }

    return Array.from(planMap.entries())
      .map(([name, data]) => ({
        name,
        ...data,
        viewToCartRate: safeRate(data.carts, data.views),
        cartToCheckoutRate: safeRate(data.checkouts, data.carts),
        checkoutToConversionRate: safeRate(data.conversions, data.checkouts),
        overallConversionRate: safeRate(data.conversions, data.views),
        health: getHealth(safeRate(data.conversions, data.views), data.views),
      }))
      .sort((a, b) => (b.views + b.carts * 2) - (a.views + a.carts * 2))
      .slice(0, 10);
  }, [filteredLogs]);

  /* ── Checkout Attempts ── */
  const checkoutAttempts = useMemo<CheckoutAttempt[]>(() => {
    const sessionCheckouts = new Map<string, LiveLog[]>();
    for (const log of filteredLogs) {
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

      let highestRank = 0, highestType = "add_to_cart", highestStep = 0;
      let cat: string | null = null, planName: string | null = null;

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
  }, [filteredLogs]);

  /* ── Friction Summary ── */
  const frictionSummary = useMemo(() => {
    const frictionPoints = funnel.filter(s => s.isFrictionPoint);
    const biggestDrop = funnel.reduce<FunnelStep | null>((max, step) => {
      if (step.dropRate === null) return max;
      if (!max || (step.dropRate > (max.dropRate || 0))) return step;
      return max;
    }, null);

    return { frictionPoints, biggestDrop };
  }, [funnel]);

  return {
    filteredLogs,
    sessions,
    kpis,
    funnel,
    planPerformance,
    checkoutAttempts,
    frictionSummary,
  };
}
