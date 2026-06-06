/**
 * DashboardPage — Nivra Core operational morning dashboard.
 *
 * Layout:
 *  1) 6 live metric cards (operations)
 *  2) 4 business KPI cards (MRR, subs, churn, tickets) + revenue trend bar chart
 *  3) Urgent orders table (60%) + Activity feed (40%)
 *  4) Status breakdown / Weekly performance / System alerts
 *
 * All numbers come from live Supabase queries. Auto-refresh every 30s + Realtime.
 */
import { useMemo, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { corePath } from "@/core-app/lib/corePaths";
import {
  ShoppingCart, AlertTriangle, ShieldCheck, Zap, DollarSign, UserPlus,
  ArrowRight, CheckCircle2, Clock, Activity, Mail, TrendingUp,
  Users, TrendingDown, Ticket,
} from "lucide-react";
import { formatDistanceToNow, subMonths, startOfMonth, endOfMonth, format as dateFmt } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const REFRESH_MS = 30_000;
const ACTIVE_EXCLUDED = ["completed", "cancelled"];

const startOfTodayISO = () => {
  const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString();
};
const startOfMonthISO = () => {
  const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d.toISOString();
};
const startOfWeekISO = () => {
  const d = new Date(); const day = d.getDay() || 7;
  d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (day - 1)); return d.toISOString();
};
const sevenDaysAgoISO = () => new Date(Date.now() - 7 * 86400000).toISOString();
const seventyTwoHoursAgoISO = () => new Date(Date.now() - 72 * 3600000).toISOString();

const timeAgo = (iso: string | null | undefined) => {
  if (!iso) return "—";
  try { return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: fr }); } catch { return "—"; }
};

/* ── Status → French label + color ── */
const STATUS_FR: Record<string, { label: string; color: string }> = {
  pending_admin_review: { label: "Révision admin", color: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  confirmed: { label: "Confirmé", color: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
  activated: { label: "Activé", color: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  provisioning_failed: { label: "Échec provisionnement", color: "bg-red-500/15 text-red-300 border-red-500/30" },
  cancelled: { label: "Annulé", color: "bg-slate-500/15 text-slate-300 border-slate-500/30" },
  submitted: { label: "Soumis", color: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
  pending: { label: "En attente", color: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  fraud: { label: "Fraude", color: "bg-red-500/15 text-red-300 border-red-500/30" },
  completed: { label: "Complété", color: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  processing: { label: "En traitement", color: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
};
const statusFr = (s: string | null | undefined) => STATUS_FR[s ?? ""] ?? { label: s ?? "—", color: "bg-slate-500/15 text-slate-300 border-slate-500/30" };

/* ── Order workflow step inference (FR) ── */
function currentStepFr(o: any): string {
  if (o.status === "completed") return "Complété";
  if (o.status === "cancelled") return "Annulé";
  if (o.status === "activated") return "Activé";
  if (o.kyc_status === "pending") return "Vérification KYC";
  if (o.payment_status && o.payment_status !== "paid") return "Paiement";
  if (["confirmed", "processing"].includes(o.status)) return "Activation";
  if (o.status === "submitted") return "Confirmation";
  return "En cours";
}

/* ─────────── HOOKS ─────────── */
function useTopStats() {
  return useQuery({
    queryKey: ["dash-top-stats"],
    refetchInterval: REFRESH_MS,
    queryFn: async () => {
      const today = startOfTodayISO();
      const month = startOfMonthISO();
      const sla = seventyTwoHoursAgoISO();

      const [active, slaOver, kycPending, activToday, monthInv, newClients] = await Promise.all([
        supabase.from("orders").select("id", { count: "exact", head: true }).not("status", "in", `(${ACTIVE_EXCLUDED.join(",")})`),
        supabase.from("orders").select("id", { count: "exact", head: true }).lt("created_at", sla).not("status", "in", `(${ACTIVE_EXCLUDED.join(",")})`),
        supabase.from("orders").select("id", { count: "exact", head: true }).eq("kyc_status", "pending"),
        supabase.from("orders").select("id", { count: "exact", head: true }).gte("activated_at", today),
        supabase.from("billing_invoices").select("total").gte("created_at", month).eq("status", "paid"),
        supabase.from("profiles").select("user_id", { count: "exact", head: true }).gte("created_at", today),
      ]);

      const monthRevenue = (monthInv.data ?? []).reduce((s: number, r: any) => s + (Number(r.total) || 0), 0);

      return {
        active: active.count ?? 0,
        slaOverdue: slaOver.count ?? 0,
        kycPending: kycPending.count ?? 0,
        activationsToday: activToday.count ?? 0,
        monthRevenue,
        newClientsToday: newClients.count ?? 0,
      };
    },
  });
}

function useUrgentOrders() {
  return useQuery({
    queryKey: ["dash-urgent-orders"],
    refetchInterval: REFRESH_MS,
    queryFn: async () => {
      const sla = seventyTwoHoursAgoISO();
      const { data: orders } = await supabase
        .from("orders")
        .select("id, order_number, user_id, service_type, status, payment_status, kyc_status, created_at")
        .not("status", "in", `(${ACTIVE_EXCLUDED.join(",")})`)
        .or(`created_at.lt.${sla},kyc_status.eq.pending,status.eq.submitted`)
        .order("created_at", { ascending: true })
        .limit(8);

      const userIds = [...new Set((orders ?? []).map((o) => o.user_id).filter(Boolean))];
      const { data: profiles } = userIds.length
        ? await supabase.from("profiles").select("user_id, full_name, email").in("user_id", userIds)
        : { data: [] as any[] };
      const pmap = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));

      return (orders ?? []).map((o: any) => ({
        ...o,
        client_name: pmap.get(o.user_id)?.full_name ?? pmap.get(o.user_id)?.email ?? "—",
      }));
    },
  });
}

function useActivityFeed() {
  return useQuery({
    queryKey: ["dash-activity-feed"],
    refetchInterval: REFRESH_MS,
    queryFn: async () => {
      const { data } = await supabase
        .from("activity_logs")
        .select("id, action, entity_type, entity_id, actor_name, reason, created_at, details")
        .order("created_at", { ascending: false })
        .limit(15);
      return data ?? [];
    },
  });
}

function useStatusBreakdown() {
  return useQuery({
    queryKey: ["dash-status-breakdown"],
    refetchInterval: REFRESH_MS,
    queryFn: async () => {
      const { data } = await supabase.from("orders").select("status").limit(5000);
      const counts: Record<string, number> = {};
      for (const r of data ?? []) counts[r.status] = (counts[r.status] ?? 0) + 1;
      return counts;
    },
  });
}

function useWeeklyPerformance() {
  return useQuery({
    queryKey: ["dash-weekly-perf"],
    refetchInterval: REFRESH_MS,
    queryFn: async () => {
      const week = startOfWeekISO();
      const seven = sevenDaysAgoISO();

      const [processedRes, processedCount, kycAll, kycApproved, emails] = await Promise.all([
        // For avg processing time: completed orders this week with activated_at
        supabase.from("orders").select("created_at, activated_at")
          .gte("updated_at", seven).in("status", ["activated", "completed"]),
        // Count of orders processed this week (status activated or completed, updated in last 7 days)
        supabase.from("orders").select("id", { count: "exact", head: true })
          .gte("updated_at", seven).in("status", ["activated", "completed"]),
        supabase.from("orders").select("id", { count: "exact", head: true }).gte("created_at", week).not("kyc_status", "is", null),
        supabase.from("orders").select("id", { count: "exact", head: true }).gte("created_at", week).eq("kyc_status", "approved"),
        supabase.from("email_queue").select("id", { count: "exact", head: true }).gte("created_at", seven),
      ]);

      const rows = processedRes.data ?? [];
      const withActivation = rows.filter((r: any) => r.activated_at);
      const avgHours = withActivation.length
        ? withActivation.reduce((s: number, r: any) => s + (new Date(r.activated_at).getTime() - new Date(r.created_at).getTime()), 0) /
          withActivation.length / 3600000
        : 0;

      return {
        processed: processedCount.count ?? 0,
        avgHours,
        kycRate: kycAll.count && kycAll.count > 0 ? ((kycApproved.count ?? 0) / kycAll.count) * 100 : 0,
        emails: emails.count ?? 0,
      };
    },
  });
}

function useSystemAlerts() {
  return useQuery({
    queryKey: ["dash-system-alerts"],
    refetchInterval: REFRESH_MS,
    queryFn: async () => {
      const { data } = await supabase
        .from("billing_system_alerts")
        .select("id, alert_type, entity_type, entity_reference, details, created_at")
        .eq("resolved", false)
        .order("created_at", { ascending: false })
        .limit(8);
      return data ?? [];
    },
  });
}

function useBusinessKpis() {
  return useQuery({
    queryKey: ["dash-business-kpis"],
    refetchInterval: REFRESH_MS,
    queryFn: async () => {
      const month = startOfMonthISO();

      const [subsActive, subsCancelled, complaintsOpen] = await Promise.all([
        supabase
          .from("subscriptions")
          .select("monthly_price")
          .eq("status", "active"),
        supabase
          .from("subscriptions")
          .select("id", { count: "exact", head: true })
          .in("status", ["cancelled", "suspended"])
          .gte("updated_at", month),
        supabase
          .from("complaints" as any)
          .select("id", { count: "exact", head: true })
          .not("status", "in", "(resolved,closed)"),
      ]);

      const portinRes = await supabase
        .from("activity_logs")
        .select("id", { count: "exact", head: true })
        .eq("action", "portin_initiated")
        .gte("created_at", month);

      const mrr = (subsActive.data ?? []).reduce((s: number, r: any) => s + (Number(r.monthly_price) || 0), 0);
      const activeCount = (subsActive.data ?? []).length;
      const churnThisMonth = subsCancelled.count ?? 0;
      const openTickets = complaintsOpen.count ?? 0;
      const portinThisMonth = portinRes.count ?? 0;

      return { mrr, activeCount, churnThisMonth, openTickets, portinThisMonth };
    },
  });
}

function useRevenueTrend() {
  return useQuery({
    queryKey: ["dash-revenue-trend"],
    refetchInterval: 5 * 60_000, // 5 min is enough for historical
    queryFn: async () => {
      const months: { label: string; start: string; end: string }[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = subMonths(new Date(), i);
        months.push({
          label: dateFmt(d, "MMM", { locale: fr }),
          start: startOfMonth(d).toISOString(),
          end: endOfMonth(d).toISOString(),
        });
      }

      const [revenueResults, activationResults] = await Promise.all([
        Promise.all(
          months.map(({ start, end }) =>
            supabase.from("billing_invoices").select("total").eq("status", "paid")
              .gte("created_at", start).lte("created_at", end)
          )
        ),
        Promise.all(
          months.map(({ start, end }) =>
            supabase.from("orders").select("id", { count: "exact", head: true })
              .not("activated_at", "is", null).gte("activated_at", start).lte("activated_at", end)
          )
        ),
      ]);

      return months.map((m, i) => ({
        label: m.label,
        revenue: (revenueResults[i].data ?? []).reduce((s: number, r: any) => s + (Number(r.total) || 0), 0),
        activations: activationResults[i].count ?? 0,
      }));
    },
  });
}

/* ─────────── UI BITS ─────────── */
function MetricCard({ label, value, icon: Icon, accent, href }: {
  label: string; value: string | number; icon: any; accent: "red" | "amber" | "green" | "blue"; href?: string;
}) {
  const accentMap = {
    red: "text-red-400 bg-red-500/10",
    amber: "text-amber-400 bg-amber-500/10",
    green: "text-emerald-400 bg-emerald-500/10",
    blue: "text-blue-400 bg-blue-500/10",
  };
  const body = (
    <div className="rounded-lg border border-slate-800 bg-[#0d1421] p-3 hover:border-slate-700 transition-colors">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-2xl font-bold text-white tabular-nums leading-tight">{value}</p>
          <p className="text-[11px] text-slate-400 mt-1 leading-tight">{label}</p>
        </div>
        <div className={`h-7 w-7 rounded-md flex items-center justify-center ${accentMap[accent]}`}>
          <Icon className="h-3.5 w-3.5" />
        </div>
      </div>
    </div>
  );
  return href ? <Link to={href}>{body}</Link> : body;
}

function actionDotColor(action: string): string {
  const a = action.toLowerCase();
  if (a.includes("create") || a.includes("submit")) return "bg-blue-400";
  if (a.includes("activat") || a.includes("complete") || a.includes("approve")) return "bg-emerald-400";
  if (a.includes("fail") || a.includes("reject") || a.includes("cancel") || a.includes("error")) return "bg-red-400";
  if (a.includes("update") || a.includes("modif")) return "bg-amber-400";
  if (a.includes("payment") || a.includes("invoice")) return "bg-purple-400";
  return "bg-slate-400";
}

function actionLabelFr(action: string): string {
  if (!action) return "—";
  const key = action.toLowerCase();
  const map: Record<string, string> = {
    kyc_requested: "Vérification KYC demandée",
    kyc_approved: "KYC approuvé",
    kyc_rejected: "KYC rejeté",
    kyc_submitted: "KYC soumis",
    order_created: "Nouvelle commande créée",
    order_submitted: "Commande soumise",
    order_confirmed: "Commande confirmée",
    order_activated: "Commande activée",
    order_completed: "Commande complétée",
    order_cancelled: "Commande annulée",
    order_updated: "Commande mise à jour",
    payment_confirmed: "Paiement confirmé",
    payment_received: "Paiement reçu",
    payment_failed: "Paiement échoué",
    payment_captured: "Paiement capturé",
    invoice_created: "Facture créée",
    invoice_paid: "Facture payée",
    invoice_voided: "Facture annulée",
    service_activated: "Service activé",
    service_suspended: "Service suspendu",
    service_cancelled: "Service annulé",
    activation_force_override: "Activation forcée (override)",
    contract_gate_bypassed: "Expédition forcée (override)",
    technician_assigned: "Technicien assigné",
    equipment_assigned: "Équipement assigné",
    equipment_shipped: "Équipement expédié",
    equipment_delivered: "Équipement livré",
    sim_activated: "SIM activée",
    esim_provisioned: "eSIM provisionnée",
    portin_initiated: "Port-in initié",
    portin_completed: "Port-in complété",
    portin_failed: "Port-in échoué",
    appointment_scheduled: "Rendez-vous planifié",
    appointment_completed: "Rendez-vous complété",
    appointment_cancelled: "Rendez-vous annulé",
    contract_signed: "Contrat signé",
    contract_sent: "Contrat envoyé",
    created: "Création",
    completed: "Complété",
    updated: "Mise à jour",
  };
  if (map[key]) return map[key];
  return action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/* ─────────── PAGE ─────────── */
export default function DashboardPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: stats } = useTopStats();
  const { data: urgent = [] } = useUrgentOrders();
  const { data: feed = [] } = useActivityFeed();
  const { data: statusCounts = {} } = useStatusBreakdown();
  const { data: perf } = useWeeklyPerformance();
  const { data: alerts = [] } = useSystemAlerts();
  const { data: kpis } = useBusinessKpis();
  const { data: revenueTrend = [] } = useRevenueTrend();

  // Realtime subscriptions — invalidate relevant queries on DB changes
  useEffect(() => {
    const ch = supabase
      .channel("dash-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        qc.invalidateQueries({ queryKey: ["dash-top-stats"] });
        qc.invalidateQueries({ queryKey: ["dash-urgent-orders"] });
        qc.invalidateQueries({ queryKey: ["dash-status-breakdown"] });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "activity_logs" }, () => {
        qc.invalidateQueries({ queryKey: ["dash-activity-feed"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "billing_invoices" }, () => {
        qc.invalidateQueries({ queryKey: ["dash-top-stats"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "billing_system_alerts" }, () => {
        qc.invalidateQueries({ queryKey: ["dash-system-alerts"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "subscriptions" }, () => {
        qc.invalidateQueries({ queryKey: ["dash-business-kpis"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "complaints" }, () => {
        qc.invalidateQueries({ queryKey: ["dash-business-kpis"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const resolveAlert = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("billing_system_alerts")
        .update({ resolved: true, resolved_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["dash-system-alerts"] }); toast.success("Alerte résolue"); },
    onError: (e: any) => toast.error(e?.message || "Échec de la résolution"),
  });

  const breakdown = useMemo(() => {
    const items = [
      { key: "submitted", color: "bg-blue-500" },
      { key: "pending", color: "bg-amber-500" },
      { key: "confirmed", color: "bg-blue-400" },
      { key: "activated", color: "bg-emerald-500" },
      { key: "completed", color: "bg-emerald-400" },
      { key: "cancelled", color: "bg-slate-500" },
    ];
    const total = Object.values(statusCounts).reduce((s, n) => s + (n as number), 0) || 1;
    return items.map((i) => ({
      ...i,
      label: statusFr(i.key).label,
      value: (statusCounts as any)[i.key] ?? 0,
      pct: (((statusCounts as any)[i.key] ?? 0) / total) * 100,
    }));
  }, [statusCounts]);

  const fmtCAD = (n: number) => new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(n);

  return (
    <div className="space-y-5 bg-[#111827] -m-4 p-4 min-h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white tracking-tight">Tableau de bord</h1>
          <p className="text-[12px] text-slate-400 mt-0.5">Vue opérationnelle en temps réel</p>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
          <Activity className="h-3 w-3 text-emerald-400 animate-pulse" /> Live · Realtime + refresh 30s
        </div>
      </div>

      {/* SECTION 0 — BUSINESS KPIs */}
      <div>
        <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-3">Métriques business</p>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
          <MetricCard label="MRR (abonnements actifs)" value={kpis ? fmtCAD(kpis.mrr) : "—"} icon={TrendingUp} accent="green" href={corePath("/invoices")} />
          <MetricCard label="Abonnements actifs" value={kpis?.activeCount ?? "—"} icon={Users} accent="blue" href={corePath("/customers")} />
          <MetricCard label="Résiliations ce mois" value={kpis?.churnThisMonth ?? "—"} icon={TrendingDown} accent={kpis && kpis.churnThisMonth > 0 ? "red" : "green"} />
          <MetricCard label="Tickets ouverts" value={kpis?.openTickets ?? "—"} icon={Ticket} accent={kpis && kpis.openTickets > 5 ? "amber" : "green"} href={corePath("/complaints")} />
          <MetricCard label="Port-ins ce mois" value={kpis?.portinThisMonth ?? "—"} icon={ArrowRight} accent="blue" />
        </div>

        {/* Trend charts — 2 columns */}
        {revenueTrend.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="rounded-lg border border-slate-800 bg-[#0d1421] p-4">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-3">Revenus encaissés — 6 mois</p>
              <ResponsiveContainer width="100%" height={110}>
                <BarChart data={revenueTrend} barCategoryGap="30%">
                  <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={(v) => v === 0 ? "0" : `${(v / 1000).toFixed(0)}k`} width={32} />
                  <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 6, fontSize: 11 }} labelStyle={{ color: "#cbd5e1" }} formatter={(v: number) => [fmtCAD(v), "Revenus"]} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                  <Bar dataKey="revenue" radius={[3, 3, 0, 0]}>
                    {revenueTrend.map((_, idx) => <Cell key={idx} fill={idx === revenueTrend.length - 1 ? "#34d399" : "#3b82f6"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="rounded-lg border border-slate-800 bg-[#0d1421] p-4">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-3">Activations — 6 mois</p>
              <ResponsiveContainer width="100%" height={110}>
                <BarChart data={revenueTrend} barCategoryGap="30%">
                  <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 9 }} axisLine={false} tickLine={false} allowDecimals={false} width={24} />
                  <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 6, fontSize: 11 }} labelStyle={{ color: "#cbd5e1" }} formatter={(v: number) => [v, "Activations"]} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                  <Bar dataKey="activations" radius={[3, 3, 0, 0]}>
                    {revenueTrend.map((_, idx) => <Cell key={idx} fill={idx === revenueTrend.length - 1 ? "#a78bfa" : "#6366f1"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* SECTION 1 — TOP STATS */}
      <div>
        <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-3">Vue d'ensemble</p>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <MetricCard label="Commandes actives" value={stats?.active ?? "—"} icon={ShoppingCart} accent="blue" href={corePath("/orders")} />
          <MetricCard label="SLA dépassés" value={stats?.slaOverdue ?? "—"} icon={AlertTriangle} accent="red" href={corePath("/work-queue")} />
          <MetricCard label="En attente KYC" value={stats?.kycPending ?? "—"} icon={ShieldCheck} accent="amber" href={corePath("/work-queue")} />
          <MetricCard label="Activations aujourd'hui" value={stats?.activationsToday ?? "—"} icon={Zap} accent="green" href={corePath("/orders")} />
          <MetricCard label="Revenus du mois" value={stats ? fmtCAD(stats.monthRevenue) : "—"} icon={DollarSign} accent="blue" href={corePath("/invoices")} />
          <MetricCard label="Nouveaux clients (auj.)" value={stats?.newClientsToday ?? "—"} icon={UserPlus} accent="blue" href={corePath("/customers")} />
        </div>
      </div>

      {/* SECTION 2 — Two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* LEFT — Urgent orders (60%) */}
        <div className="lg:col-span-3 rounded-lg border border-slate-800 bg-[#0d1421] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
            <p className="text-[10px] uppercase tracking-wider text-slate-400">Commandes urgentes</p>
            <span className="text-[10px] text-slate-500">{urgent.length} affiché{urgent.length > 1 ? "s" : ""}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-800">
                  <th className="px-4 py-2 font-medium"># Commande</th>
                  <th className="px-3 py-2 font-medium">Client</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Statut</th>
                  <th className="px-3 py-2 font-medium">SLA</th>
                  <th className="px-3 py-2 font-medium">Étape</th>
                  <th className="px-3 py-2 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {urgent.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500 text-[12px]">Aucune commande urgente — bravo</td></tr>
                )}
                {urgent.map((o: any) => {
                  const fr = statusFr(o.status);
                  const ageMs = Date.now() - new Date(o.created_at).getTime();
                  const overdue = ageMs > 72 * 3600000;
                  return (
                    <tr key={o.id} className="border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-2.5 font-mono text-white">{o.order_number ?? o.id.slice(0, 8)}</td>
                      <td className="px-3 py-2.5 text-slate-300 truncate max-w-[160px]">{o.client_name}</td>
                      <td className="px-3 py-2.5 text-slate-400">{o.service_type ?? "—"}</td>
                      <td className="px-3 py-2.5"><span className={`inline-flex px-2 py-0.5 rounded-md border text-[10px] font-medium ${fr.color}`}>{fr.label}</span></td>
                      <td className={`px-3 py-2.5 tabular-nums ${overdue ? "text-red-400 font-semibold" : "text-slate-400"}`}>{timeAgo(o.created_at)}</td>
                      <td className="px-3 py-2.5 text-slate-300">{currentStepFr(o)}</td>
                      <td className="px-3 py-2.5 text-right">
                        <button
                          onClick={() => navigate(corePath(`/orders/${o.id}`))}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-600/20 border border-blue-500/30 text-blue-300 text-[11px] hover:bg-blue-600/30 transition-colors"
                        >Ouvrir <ArrowRight className="h-3 w-3" /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2.5 border-t border-slate-800">
            <Link to={corePath("/work-queue")} className="text-[12px] text-blue-400 hover:underline inline-flex items-center gap-1">
              Voir toutes les commandes <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        {/* RIGHT — Activity feed (40%) */}
        <div className="lg:col-span-2 rounded-lg border border-slate-800 bg-[#0d1421] overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-slate-800">
            <p className="text-[10px] uppercase tracking-wider text-slate-400">Activité récente</p>
          </div>
          <div className="p-3 space-y-2 max-h-[480px] overflow-y-auto">
            {feed.length === 0 && (
              <p className="text-center text-slate-500 text-[12px] py-6">Aucune activité récente</p>
            )}
            {feed.map((ev: any) => {
              const isOrder = ev.entity_type === "order";
              return (
                <div key={ev.id} className="flex items-start gap-2.5 py-1.5">
                  <span className={`h-2 w-2 rounded-full mt-1.5 shrink-0 ${actionDotColor(ev.action)}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] text-slate-200 leading-snug">
                      {actionLabelFr(ev.action)}
                      {isOrder && ev.entity_id && (
                        <Link to={corePath(`/orders/${ev.entity_id}`)} className="ml-1.5 font-mono text-blue-400 hover:underline">
                          #{String(ev.entity_id).slice(0, 8)}
                        </Link>
                      )}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {ev.actor_name ? `${ev.actor_name} · ` : ""}{timeAgo(ev.created_at)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* SECTION 3 — Bottom 3 cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* CARD 1 — Status breakdown */}
        <div className="rounded-lg border border-slate-800 bg-[#0d1421] p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-3">Commandes par statut</p>
          <div className="space-y-2">
            {breakdown.map((b) => (
              <div key={b.key}>
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="text-slate-300">{b.label}</span>
                  <span className="text-slate-400 tabular-nums">{b.value}</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                  <div className={`h-full ${b.color}`} style={{ width: `${b.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CARD 2 — Weekly perf */}
        <div className="rounded-lg border border-slate-800 bg-[#0d1421] p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-3">Performance de la semaine</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-md bg-slate-800/40 p-3">
              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 uppercase"><CheckCircle2 className="h-3 w-3 text-emerald-400" /> Traitées</div>
              <p className="text-xl font-bold text-white mt-1 tabular-nums">{perf?.processed ?? "—"}</p>
            </div>
            <div className="rounded-md bg-slate-800/40 p-3">
              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 uppercase"><Clock className="h-3 w-3 text-blue-400" /> Temps moy.</div>
              <p className="text-xl font-bold text-white mt-1 tabular-nums">{perf ? `${perf.avgHours.toFixed(1)} h` : "—"}</p>
            </div>
            <div className="rounded-md bg-slate-800/40 p-3">
              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 uppercase"><ShieldCheck className="h-3 w-3 text-amber-400" /> KYC complété</div>
              <p className="text-xl font-bold text-white mt-1 tabular-nums">{perf ? `${perf.kycRate.toFixed(0)} %` : "—"}</p>
            </div>
            <div className="rounded-md bg-slate-800/40 p-3">
              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 uppercase"><Mail className="h-3 w-3 text-purple-400" /> Courriels</div>
              <p className="text-xl font-bold text-white mt-1 tabular-nums">{perf?.emails ?? "—"}</p>
            </div>
          </div>
        </div>

        {/* CARD 3 — System alerts */}
        <div className="rounded-lg border border-slate-800 bg-[#0d1421] p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-3">Alertes système</p>
          {alerts.length === 0 ? (
            <div className="flex items-center gap-2 px-3 py-3 rounded-md bg-emerald-500/10 border border-emerald-500/30">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <p className="text-[12px] text-emerald-300">Tous les systèmes sont opérationnels</p>
            </div>
          ) : (
            <div className="space-y-2">
              {alerts.map((a: any) => {
                const sev = (a.alert_type ?? "").toLowerCase().includes("critical") ? "critical"
                  : (a.alert_type ?? "").toLowerCase().includes("warning") ? "warning" : "info";
                const sevColor = sev === "critical" ? "bg-red-500/15 text-red-300 border-red-500/30"
                  : sev === "warning" ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                  : "bg-blue-500/15 text-blue-300 border-blue-500/30";
                const rawMsg = (a.details && typeof a.details === "object" && (
                  (a.details as any).message || (a.details as any).description ||
                  (a.details as any).error || (a.details as any).reason
                )) || null;
                const ref = a.entity_reference;
                const isOrderRef = a.entity_type === "order" && ref;
                const detailMsg = rawMsg
                  ? rawMsg
                  : isOrderRef
                  ? `Commande #${ref} — Vérification requise`
                  : ref
                  ? `${a.entity_type ?? "Entité"} ${ref} — ${(a.alert_type ?? "alerte").replace(/_/g, " ")}`
                  : (a.alert_type ?? "Alerte système").replace(/_/g, " ");
                return (
                  <div key={a.id} className="flex items-start gap-2 p-2 rounded-md bg-slate-800/30 border border-slate-800">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] uppercase font-semibold border ${sevColor}`}>{sev}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-slate-200 truncate">{String(detailMsg)}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">{timeAgo(a.created_at)}</p>
                    </div>
                    <button
                      onClick={() => resolveAlert.mutate(a.id)}
                      disabled={resolveAlert.isPending}
                      className="text-[10px] px-2 py-0.5 rounded bg-slate-700/50 hover:bg-slate-700 text-slate-200 transition-colors disabled:opacity-50"
                    >Résoudre</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
