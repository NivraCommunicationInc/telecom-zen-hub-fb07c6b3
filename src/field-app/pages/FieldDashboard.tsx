/**
 * FieldDashboard — Premium dark navy + purple dashboard.
 * Real-time KPIs, commission grid, quick actions, recent activity.
 */
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import {
  fetchDashboardSummary,
  fetchDashboardActivity,
} from "@/field-app/lib/fieldServices";
import { supabase } from "@/integrations/supabase/client";
import { useStaffUser } from "@/lib/hooks/useStaffUser";
import { useQueryClient } from "@tanstack/react-query";
import {
  TrendingUp, DollarSign, UserPlus, Plus, Clock,
  CheckCircle2, AlertCircle, Loader2, Target,
  Trophy, ChevronRight, MapPin, Calendar,
  ShoppingCart, ArrowRight, Zap, Tag, Sparkles,
  Activity, Wifi, BarChart3,
} from "lucide-react";
import { fieldPath } from "@/field-app/lib/fieldPaths";
import { usePortalRealtime } from "@/hooks/usePortalRealtime";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";

/* ─────────────────────────────────────────────────────────────
   Reusable atoms — all dark theme
   ───────────────────────────────────────────────────────────── */

function StatusDot({ live = true }: { live?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={cn("h-2 w-2 rounded-full field-pulse")}
        style={{
          background: live ? "hsl(var(--field-success))" : "hsl(var(--field-danger))",
          boxShadow: `0 0 8px hsl(var(--field-${live ? "success" : "danger"}) / 0.6)`,
        }}
      />
      <span className="text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: live ? "hsl(var(--field-success))" : "hsl(var(--field-danger))" }}>
        {live ? "En ligne" : "Hors ligne"}
      </span>
    </span>
  );
}

function Card({
  children,
  className,
  interactive = false,
  gradient = false,
}: {
  children: React.ReactNode;
  className?: string;
  interactive?: boolean;
  gradient?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl p-5",
        gradient ? "field-gradient-card" : "",
        interactive && "field-card-interactive cursor-pointer",
        className,
      )}
      style={{
        background: gradient ? undefined : "hsl(var(--field-card))",
        border: "1px solid hsl(var(--field-border) / 0.15)",
      }}
    >
      {children}
    </div>
  );
}

function KpiCard({
  label, value, hint, icon: Icon, accent = "purple",
  progress, progressColor,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: any;
  accent?: "purple" | "success" | "warning" | "danger" | "info";
  progress?: number;
  progressColor?: string;
}) {
  const accentMap = {
    purple: "hsl(var(--field-accent))",
    success: "hsl(var(--field-success))",
    warning: "hsl(var(--field-warning))",
    danger: "hsl(var(--field-danger))",
    info: "hsl(var(--field-info))",
  };
  const c = accentMap[accent];
  return (
    <div
      className="rounded-2xl p-4 sm:p-5 field-card-interactive"
      style={{
        background: "hsl(var(--field-card))",
        border: `1px solid ${c} / 0.2`,
        borderColor: `hsl(var(--field-border) / 0.15)`,
      }}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div
          className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `${c.replace(")", " / 0.15)")}` }}
        >
          <Icon className="h-5 w-5" style={{ color: c }} />
        </div>
      </div>
      <p className="text-2xl font-bold tracking-tight text-white">{value}</p>
      <p className="text-[11px] font-semibold mt-1"
         style={{ color: "hsl(var(--field-text-muted))" }}>{label}</p>
      {hint && (
        <p className="text-[10px] mt-1"
           style={{ color: "hsl(var(--field-text-dim))" }}>{hint}</p>
      )}
      {typeof progress === "number" && (
        <div
          className="h-1.5 rounded-full mt-3 overflow-hidden"
          style={{ background: "hsl(var(--field-bg))" }}
        >
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${Math.min(100, progress)}%`,
              background: progressColor || c,
            }}
          />
        </div>
      )}
    </div>
  );
}

function QuickAction({
  label, sub, icon: Icon, onClick, primary = false,
}: {
  label: string; sub?: string; icon: any; onClick: () => void; primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group flex flex-col items-start gap-2 p-4 md:p-5 rounded-2xl transition-all text-left field-card-interactive w-full min-h-[112px] md:min-h-[128px]",
        primary && "field-glow",
      )}
      style={{
        background: primary
          ? "linear-gradient(135deg, hsl(var(--field-accent)) 0%, hsl(var(--field-accent-glow)) 100%)"
          : "hsl(var(--field-card))",
        border: primary ? "none" : "1px solid hsl(var(--field-border) / 0.15)",
      }}
    >
      <div
        className="h-11 w-11 md:h-12 md:w-12 rounded-xl flex items-center justify-center"
        style={{
          background: primary ? "rgba(255,255,255,0.2)" : "hsl(var(--field-accent) / 0.15)",
        }}
      >
        <Icon className="h-5 w-5 md:h-6 md:w-6" style={{ color: primary ? "white" : "hsl(var(--field-accent-glow))" }} />
      </div>
      <div>
        <p className={cn("text-sm md:text-base font-bold", primary ? "text-white" : "text-white")}>{label}</p>
        {sub && (
          <p
            className="text-[11px] md:text-xs mt-0.5"
            style={{ color: primary ? "rgba(255,255,255,0.85)" : "hsl(var(--field-text-dim))" }}
          >
            {sub}
          </p>
        )}
      </div>
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────
   Commission rules hook — reads commission_rules table directly
   (filtered by current agent or their role)
   ───────────────────────────────────────────────────────────── */

function useCommissionRules(userId?: string) {
  return useQuery({
    queryKey: ["field-commission-rules", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commission_rules")
        .select("*")
        .eq("is_active", true)
        .or(`employee_id.eq.${userId},role.eq.field_sales`)
        .order("applies_to");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });
}

function useMonthlyTarget(userId?: string) {
  return useQuery({
    queryKey: ["field-monthly-target", userId],
    enabled: !!userId,
    queryFn: async () => {
      const now = new Date();
      const { data } = await supabase
        .from("sales_targets")
        .select("*")
        .or(`employee_id.eq.${userId},role.eq.field_sales`)
        .eq("period_month", now.getMonth() + 1)
        .eq("period_year", now.getFullYear())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    staleTime: 120_000,
  });
}

/* Field commissions — stats + recent rows for the current agent. */
function useFieldCommissions(userId?: string) {
  return useQuery({
    queryKey: ["field-commissions-dashboard", userId],
    enabled: !!userId,
    queryFn: async () => {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const { data } = await supabase
        .from("field_commissions")
        .select("id, amount, status, earned_at, created_at, description, order_id")
        .eq("agent_id", userId as string)
        .order("created_at", { ascending: false })
        .limit(50);
      const rows = data || [];
      const isThisMonth = (d: string | null) => d && new Date(d) >= monthStart;
      const monthRows = rows.filter((r: any) => isThisMonth(r.earned_at || r.created_at));
      const sales_count = monthRows.length;
      const month_total = monthRows.reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
      const pending_total = rows
        .filter((r: any) => r.status === "pending")
        .reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
      const approved_total = rows
        .filter((r: any) => r.status === "approved" || r.status === "paid")
        .reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
      return {
        sales_count,
        month_total,
        pending_total,
        approved_total,
        recent: rows.slice(0, 5),
      };
    },
    staleTime: 60_000,
  });
}

/* ─────────────────────────────────────────────────────────────
   Main dashboard
   ───────────────────────────────────────────────────────────── */

const SYNC_ICON: Record<string, { icon: typeof CheckCircle2; color: string }> = {
  synced: { icon: CheckCircle2, color: "hsl(var(--field-success))" },
  pending: { icon: Clock, color: "hsl(var(--field-warning))" },
  error: { icon: AlertCircle, color: "hsl(var(--field-danger))" },
};

const PAYMENT_LABEL: Record<string, { label: string; color: string }> = {
  confirmed: { label: "Payé", color: "hsl(var(--field-success))" },
  pending: { label: "En attente", color: "hsl(var(--field-warning))" },
  failed: { label: "Échoué", color: "hsl(var(--field-danger))" },
  cancelled: { label: "Annulé", color: "hsl(var(--field-text-dim))" },
};

const LEAD_STATUS: Record<string, { label: string; bg: string; color: string }> = {
  new: { label: "Nouveau", bg: "hsl(var(--field-warning) / 0.15)", color: "hsl(var(--field-warning))" },
  contacted: { label: "Contacté", bg: "hsl(var(--field-info) / 0.15)", color: "hsl(var(--field-info))" },
  qualified: { label: "Qualifié", bg: "hsl(var(--field-accent) / 0.15)", color: "hsl(var(--field-accent-glow))" },
  submitted: { label: "Soumis", bg: "hsl(var(--field-info) / 0.15)", color: "hsl(var(--field-info))" },
  won: { label: "Gagné", bg: "hsl(var(--field-success) / 0.15)", color: "hsl(var(--field-success))" },
  lost: { label: "Perdu", bg: "hsl(var(--field-danger) / 0.15)", color: "hsl(var(--field-danger))" },
};

export default function FieldDashboard() {
  const navigate = useNavigate();
  const { user } = useStaffUser();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["field-dashboard-summary"],
    queryFn: fetchDashboardSummary,
    staleTime: 1000 * 60 * 2,
    refetchInterval: 1000 * 60 * 5,
  });

  const { data: activity } = useQuery({
    queryKey: ["field-dashboard-activity"],
    queryFn: fetchDashboardActivity,
    staleTime: 1000 * 60 * 2,
  });

  const { data: commissionRules } = useCommissionRules(user?.id);
  const { data: monthlyTarget } = useMonthlyTarget(user?.id);
  const { data: fieldComm } = useFieldCommissions(user?.id);

  /* Portal-wide realtime — invalidates dashboard queries whenever any
     field_commissions / orders / field_payment_intents row changes. */
  usePortalRealtime(
    ["field_commissions", "orders", "field_payment_intents"],
    [
      ["field-dashboard-summary"],
      ["field-dashboard-activity"],
      ["field-commissions", user?.id],
    ],
  );

  /* Real-time subscriptions — Core RH ⇄ Field Sales sync.
     Tables: commission_rules, sales_targets, sales_commissions, orders.
     Toast notifications keep agents aware of upstream changes. */
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`field-dashboard-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "commission_rules" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["field-commission-rules"] });
          toast("Grille de commission mise à jour", { description: "Les nouveaux taux sont actifs." });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sales_targets" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["field-monthly-target"] });
          queryClient.invalidateQueries({ queryKey: ["field-dashboard-summary"] });
          toast("Objectifs mis à jour", { description: "Vos KPI ont été recalculés." });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "sales_commissions",
          filter: `salesperson_id=eq.${user.id}`,
        },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ["field-dashboard-summary"] });
          if (payload.eventType === "INSERT") {
            toast.success("Nouvelle commission ajoutée");
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `created_by_agent_id=eq.${user.id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["field-dashboard-summary"] });
          queryClient.invalidateQueries({ queryKey: ["field-dashboard-activity"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Bonjour";
    if (h < 18) return "Bon après-midi";
    return "Bonsoir";
  };

  const initials = (data?.userName ?? "Agent")
    .split(" ").map((p: string) => p[0]).join("").slice(0, 2).toUpperCase();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: "hsl(var(--field-accent-glow))" }} />
      </div>
    );
  }

  const salesToday = data?.salesToday ?? 0;
  const dailyGoal = data?.dailyGoal ?? 3;
  const goalProgress = dailyGoal > 0 ? Math.round((salesToday / dailyGoal) * 100) : 0;
  const goalColor = goalProgress >= 80
    ? "hsl(var(--field-success))"
    : goalProgress >= 50
      ? "hsl(var(--field-warning))"
      : "hsl(var(--field-danger))";

  const monthRevenue = data?.monthRevenue ?? 0;
  const monthlyTargetAmount = monthlyTarget?.target_amount ?? 0;
  const monthRevenueProgress = monthlyTargetAmount > 0
    ? Math.round((monthRevenue / Number(monthlyTargetAmount)) * 100)
    : 0;

  const totalEarned = data?.totalEarned ?? 0;
  const conversionRate = data?.conversionRate ?? 0;
  const openLeads = data?.openLeads ?? 0;

  /* Bonus preview from monthlyTarget */
  const bonus100 = Number(monthlyTarget?.bonus_amount ?? 0);
  const bonus120 = bonus100 * 2;

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 field-glow"
            style={{
              background: "linear-gradient(135deg, hsl(var(--field-accent)) 0%, hsl(var(--field-accent-glow)) 100%)",
            }}
          >
            <span className="text-base font-bold text-white">{initials}</span>
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              {greeting()}{data?.userName ? `, ${data.userName.split(" ")[0]}` : ""}
            </h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-xs" style={{ color: "hsl(var(--field-text-muted))" }}>
                {format(new Date(), "EEEE d MMMM", { locale: fr })}
              </span>
              <span style={{ color: "hsl(var(--field-text-dim))" }}>·</span>
              <StatusDot live />
            </div>
          </div>
        </div>
        <button
          onClick={() => navigate(fieldPath("/sale/new"))}
          className="hidden sm:flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-white field-glow transition-all hover:scale-105"
          style={{
            background: "linear-gradient(135deg, hsl(var(--field-accent)) 0%, hsl(var(--field-accent-glow)) 100%)",
          }}
        >
          <Plus className="h-4 w-4" /> Nouvelle vente
        </button>
      </div>

      {/* KPI ROW 0 — Field commissions snapshot (field_commissions) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <KpiCard label="Ventes ce mois" value={`${fieldComm?.sales_count ?? 0}`} hint="Commissions générées" icon={ShoppingCart} accent="purple" />
        <KpiCard label="Commission ce mois" value={`${(fieldComm?.month_total ?? 0).toFixed(2)} $`} hint="Total gagné" icon={DollarSign} accent="success" />
        <KpiCard label="En attente" value={`${(fieldComm?.pending_total ?? 0).toFixed(2)} $`} hint="À approuver" icon={Clock} accent="warning" />
        <KpiCard label="Approuvée" value={`${(fieldComm?.approved_total ?? 0).toFixed(2)} $`} hint="Validée / payée" icon={CheckCircle2} accent="info" />
      </div>

      {/* Bonus tier progress */}
      {(() => {
        const target = Number(monthlyTarget?.target_count ?? 0);
        const achieved = fieldComm?.sales_count ?? 0;
        if (target <= 0) return null;
        const pct = Math.min(100, Math.round((achieved / target) * 100));
        const nextTier = pct >= 100 ? Math.ceil(target * 1.2) : target;
        const nextLabel = pct >= 100 ? `Palier 120% (${nextTier} ventes)` : `Palier 100% (${target} ventes)`;
        return (
          <Card>
            <div className="flex items-center justify-between mb-2">
              <div className="text-[12px] font-bold uppercase tracking-wider text-white/80">Progression bonus</div>
              <div className="text-[11px]" style={{ color: "hsl(var(--field-text-muted))" }}>{achieved} / {nextTier}</div>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: "hsl(var(--field-border) / 0.25)" }}>
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "linear-gradient(90deg, hsl(var(--field-accent)), hsl(var(--field-accent-glow)))" }} />
            </div>
            <div className="text-[11px] mt-2" style={{ color: "hsl(var(--field-text-dim))" }}>{nextLabel}</div>
          </Card>
        );
      })()}

      {/* Recent commissions list */}
      {(fieldComm?.recent?.length ?? 0) > 0 && (
        <Card>
          <div className="flex items-center justify-between mb-3">
            <div className="text-[12px] font-bold uppercase tracking-wider text-white/80">Commissions récentes</div>
            <button onClick={() => navigate(fieldPath("/commissions"))} className="text-[11px] font-semibold flex items-center gap-1" style={{ color: "hsl(var(--field-accent-glow))" }}>
              Tout voir <ChevronRight className="h-3 w-3" />
            </button>
          </div>
          <ul className="divide-y" style={{ borderColor: "hsl(var(--field-border) / 0.15)" }}>
            {fieldComm!.recent.map((r: any) => (
              <li key={r.id} className="flex items-center justify-between py-2">
                <div>
                  <div className="text-[12px] font-semibold text-white">{r.description || "Commission"}</div>
                  <div className="text-[10px]" style={{ color: "hsl(var(--field-text-dim))" }}>
                    {format(new Date(r.earned_at || r.created_at), "d MMM yyyy", { locale: fr })} · {r.status}
                  </div>
                </div>
                <div className="text-[13px] font-bold" style={{ color: "hsl(var(--field-success))" }}>+{Number(r.amount || 0).toFixed(2)} $</div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* KPI ROW 1 — Goal + Revenue + Commissions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-5">
        <KpiCard
          label="Ventes aujourd'hui"
          value={`${salesToday} / ${dailyGoal}`}
          hint={goalProgress >= 100 ? "🎉 Objectif atteint!" : `${goalProgress}% de l'objectif`}
          icon={Trophy}
          accent={goalProgress >= 80 ? "success" : goalProgress >= 50 ? "warning" : "danger"}
          progress={goalProgress}
          progressColor={goalColor}
        />
        <KpiCard
          label="Revenus ce mois"
          value={`${monthRevenue.toFixed(0)} $`}
          hint={monthlyTargetAmount > 0
            ? `${monthRevenueProgress}% de ${Number(monthlyTargetAmount).toFixed(0)} $`
            : "Objectif non défini"}
          icon={TrendingUp}
          accent="purple"
          progress={monthRevenueProgress}
        />
        <KpiCard
          label="Commissions ce mois"
          value={`${totalEarned.toFixed(2)} $`}
          hint={`${(data?.pendingCommissions ?? 0).toFixed(2)} $ en attente`}
          icon={DollarSign}
          accent="success"
        />
      </div>

      {/* KPI ROW 2 — Conversion + Leads + Bonus */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-5">
        <KpiCard
          label="Taux de conversion"
          value={`${conversionRate}%`}
          hint={`${data?.wonLeads ?? 0} gagnés / ${data?.lostLeads ?? 0} perdus`}
          icon={Target}
          accent="info"
        />
        <KpiCard
          label="Leads actifs"
          value={openLeads}
          hint="Ce mois"
          icon={UserPlus}
          accent="warning"
        />
        <Card gradient className="flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-4 w-4" style={{ color: "hsl(var(--field-accent-glow))" }} />
            <span className="text-[11px] font-bold uppercase tracking-wider"
                  style={{ color: "hsl(var(--field-accent-glow))" }}>
              Bonus preview
            </span>
          </div>
          {bonus100 > 0 ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: "hsl(var(--field-text-muted))" }}>À 100%</span>
                <span className="text-sm font-bold text-white">+{bonus100.toFixed(0)} $</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: "hsl(var(--field-text-muted))" }}>À 120%</span>
                <span className="text-sm font-bold" style={{ color: "hsl(var(--field-accent-glow))" }}>
                  +{bonus120.toFixed(0)} $
                </span>
              </div>
            </div>
          ) : (
            <p className="text-xs" style={{ color: "hsl(var(--field-text-dim))" }}>
              Aucun bonus configuré ce mois
            </p>
          )}
        </Card>
      </div>

      {/* COMMISSION GRID */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4" style={{ color: "hsl(var(--field-accent-glow))" }} />
            <h3 className="text-sm font-bold text-white">Mes taux de commission</h3>
          </div>
          <span className="text-[10px] font-semibold flex items-center gap-1"
                style={{ color: "hsl(var(--field-success))" }}>
            <Wifi className="h-3 w-3 field-pulse" /> En direct
          </span>
        </div>
        {!commissionRules || commissionRules.length === 0 ? (
          <p className="text-xs py-4 text-center" style={{ color: "hsl(var(--field-text-dim))" }}>
            Aucun taux configuré. Contactez votre superviseur.
          </p>
        ) : (
          <div className="space-y-2">
            {commissionRules.map((r: any) => {
              const exampleBase = 60;
              const exampleCommission = (exampleBase * Number(r.percentage)) / 100;
              return (
                <div
                  key={r.id}
                  className="flex items-center justify-between p-3 rounded-xl"
                  style={{
                    background: "hsl(var(--field-bg-elevated))",
                    border: "1px solid hsl(var(--field-border) / 0.1)",
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="h-8 w-8 rounded-lg flex items-center justify-center"
                      style={{ background: "hsl(var(--field-accent) / 0.15)" }}
                    >
                      <Tag className="h-3.5 w-3.5" style={{ color: "hsl(var(--field-accent-glow))" }} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white capitalize">
                        {r.applies_to === "all" ? "Tous les services" : r.applies_to}
                      </p>
                      <p className="text-[10px]" style={{ color: "hsl(var(--field-text-dim))" }}>
                        Sur 60$ /mois → {exampleCommission.toFixed(2)} $
                      </p>
                    </div>
                  </div>
                  <span
                    className="text-base font-bold px-3 py-1 rounded-lg"
                    style={{
                      background: "hsl(var(--field-accent) / 0.2)",
                      color: "hsl(var(--field-accent-glow))",
                    }}
                  >
                    {Number(r.percentage).toFixed(1)}%
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* QUICK ACTIONS */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider mb-3 px-1"
            style={{ color: "hsl(var(--field-text-dim))" }}>
          Actions rapides
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
          <QuickAction
            label="Nouvelle vente"
            sub="Placer une commande"
            icon={ShoppingCart}
            onClick={() => navigate(fieldPath("/sale/new"))}
            primary
          />
          <QuickAction
            label="Nouveau lead"
            sub="Ajouter un prospect"
            icon={UserPlus}
            onClick={() => navigate(fieldPath("/leads/new"))}
          />
          <QuickAction
            label="Mon territoire"
            sub="Marquer rue faite"
            icon={MapPin}
            onClick={() => navigate(fieldPath("/territory"))}
          />
          <QuickAction
            label="Mes rabais"
            sub="Voir disponibles"
            icon={Tag}
            onClick={() => navigate(fieldPath("/offers"))}
          />
          <QuickAction
            label="Rapport du jour"
            sub="Générer"
            icon={Calendar}
            onClick={() => navigate(fieldPath("/daily-report"))}
          />
        </div>
      </div>

      {/* RECENT ACTIVITY */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
        {/* Orders */}
        <Card className="!p-0 overflow-hidden">
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: "1px solid hsl(var(--field-border) / 0.12)" }}
          >
            <h3 className="text-xs font-bold uppercase tracking-wider"
                style={{ color: "hsl(var(--field-text-muted))" }}>
              Dernières commandes
            </h3>
            <button
              onClick={() => navigate(fieldPath("/submissions"))}
              className="text-[11px] font-semibold flex items-center gap-1 transition-colors"
              style={{ color: "hsl(var(--field-accent-glow))" }}
            >
              Tout voir <ChevronRight className="h-3 w-3" />
            </button>
          </div>
          {(activity?.recentOrders?.length ?? 0) === 0 ? (
            <div className="p-8 text-center">
              <ShoppingCart className="h-10 w-10 mx-auto mb-3"
                            style={{ color: "hsl(var(--field-text-dim))" }} />
              <p className="text-sm" style={{ color: "hsl(var(--field-text-muted))" }}>
                Aucune commande récente
              </p>
              <button
                onClick={() => navigate(fieldPath("/sale/new"))}
                className="text-xs font-semibold mt-2 hover:underline"
                style={{ color: "hsl(var(--field-accent-glow))" }}
              >
                Créer une vente
              </button>
            </div>
          ) : (
            <div>
              {activity!.recentOrders.slice(0, 5).map((order: any, idx: number) => {
                const syncCfg = SYNC_ICON[order.sync_status] || SYNC_ICON.pending;
                const SIcon = syncCfg.icon;
                const payCfg = PAYMENT_LABEL[order.payment_status] || PAYMENT_LABEL.pending;
                return (
                  <button
                    key={order.id}
                    onClick={() => navigate(fieldPath(`/orders/${order.id}`))}
                    className="w-full flex items-center justify-between px-4 py-3 transition-colors text-left"
                    style={{
                      borderTop: idx === 0 ? "none" : "1px solid hsl(var(--field-border) / 0.08)",
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "hsl(var(--field-card-hover))"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white truncate">
                          {order.customer_name}
                        </span>
                        <SIcon className="h-3.5 w-3.5 shrink-0" style={{ color: syncCfg.color }} />
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-semibold" style={{ color: payCfg.color }}>
                          {payCfg.label}
                        </span>
                        <span style={{ color: "hsl(var(--field-text-dim))" }}>·</span>
                        <span className="text-[10px] font-bold text-white">
                          {order.total_amount?.toFixed(2)} $
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px]" style={{ color: "hsl(var(--field-text-dim))" }}>
                        {formatDistanceToNow(new Date(order.created_at), { addSuffix: true, locale: fr })}
                      </span>
                      <ChevronRight className="h-3.5 w-3.5" style={{ color: "hsl(var(--field-text-dim))" }} />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </Card>

        {/* Leads */}
        <Card className="!p-0 overflow-hidden">
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: "1px solid hsl(var(--field-border) / 0.12)" }}
          >
            <h3 className="text-xs font-bold uppercase tracking-wider"
                style={{ color: "hsl(var(--field-text-muted))" }}>
              Derniers leads
            </h3>
            <button
              onClick={() => navigate(fieldPath("/leads"))}
              className="text-[11px] font-semibold flex items-center gap-1"
              style={{ color: "hsl(var(--field-accent-glow))" }}
            >
              Tout voir <ChevronRight className="h-3 w-3" />
            </button>
          </div>
          {(activity?.recentLeads?.length ?? 0) === 0 ? (
            <div className="p-8 text-center">
              <UserPlus className="h-10 w-10 mx-auto mb-3"
                        style={{ color: "hsl(var(--field-text-dim))" }} />
              <p className="text-sm" style={{ color: "hsl(var(--field-text-muted))" }}>
                Aucun lead récent
              </p>
            </div>
          ) : (
            <div>
              {activity!.recentLeads.slice(0, 3).map((lead: any, idx: number) => {
                const sc = LEAD_STATUS[lead.status] || LEAD_STATUS.new;
                return (
                  <button
                    key={lead.id}
                    onClick={() => navigate(fieldPath(`/leads/${lead.id}`))}
                    className="w-full flex items-center justify-between px-4 py-3 transition-colors text-left"
                    style={{
                      borderTop: idx === 0 ? "none" : "1px solid hsl(var(--field-border) / 0.08)",
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "hsl(var(--field-card-hover))"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white truncate">
                          {lead.first_name} {lead.last_name}
                        </span>
                        <span
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                          style={{ background: sc.bg, color: sc.color }}
                        >
                          {sc.label}
                        </span>
                      </div>
                      <p className="text-[10px] mt-0.5"
                         style={{ color: "hsl(var(--field-text-muted))" }}>
                        {lead.service_need || lead.phone || "—"}
                      </p>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5"
                                  style={{ color: "hsl(var(--field-text-dim))" }} />
                  </button>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* MOBILE SALE BUTTON (sticky on mobile) */}
      <button
        onClick={() => navigate(fieldPath("/sale/new"))}
        className="sm:hidden fixed bottom-24 right-4 h-14 w-14 rounded-full flex items-center justify-center field-glow-strong z-40 transition-transform active:scale-95"
        style={{
          background: "linear-gradient(135deg, hsl(var(--field-accent)) 0%, hsl(var(--field-accent-glow)) 100%)",
        }}
        aria-label="Nouvelle vente"
      >
        <Plus className="h-6 w-6 text-white" />
      </button>
    </div>
  );
}
