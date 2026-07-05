/**
 * CoreSystemHealthPage — Operational health dashboard.
 * Surfaces real-time signals so emails/notifications never silently block again.
 * - Email DLQ count
 * - Emails queued > 1h (stuck)
 * - Notification outbox blocked
 * - PayPal payment failures (24h)
 * - Critical edge-function checks via nivra-health-check
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertTriangle,
  CheckCircle2,
  Mail,
  Clock,
  Bell,
  CreditCard,
  Activity,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { toast } from "sonner";

interface HealthStats {
  emailDlq: number;
  emailStuck: number;
  emailQueued: number;
  notifBlocked: number;
  paypalFailed24h: number;
  paymentFailed24h: number;
}

interface HealthCheckResult {
  ok: boolean;
  passed: number;
  failed: number;
  checks: { name: string; ok: boolean; detail?: string }[];
}

const useHealthStats = () =>
  useQuery<HealthStats>({
    queryKey: ["core-system-health-stats"],
    queryFn: async () => {
      const oneHourAgo = new Date(Date.now() - 3600_000).toISOString();
      const yesterday = new Date(Date.now() - 86_400_000).toISOString();

      const [dlq, stuck, queued, notif, paypal, payFail] = await Promise.all([
        supabase.from("email_queue").select("id", { count: "exact", head: true }).eq("status", "dlq"),
        supabase
          .from("email_queue")
          .select("id", { count: "exact", head: true })
          .eq("status", "queued")
          .lt("created_at", oneHourAgo),
        supabase.from("email_queue").select("id", { count: "exact", head: true }).eq("status", "queued"),
        supabase
          .from("notification_outbox")
          .select("id", { count: "exact", head: true })
          .in("status", ["failed", "blocked"]),
        supabase
          .from("payments")
          .select("id", { count: "exact", head: true })
          .eq("provider", "paypal")
          .eq("status", "failed")
          .gte("created_at", yesterday),
        supabase
          .from("payments")
          .select("id", { count: "exact", head: true })
          .eq("status", "failed")
          .gte("created_at", yesterday),
      ]);

      return {
        emailDlq: dlq.count ?? 0,
        emailStuck: stuck.count ?? 0,
        emailQueued: queued.count ?? 0,
        notifBlocked: notif.count ?? 0,
        paypalFailed24h: paypal.count ?? 0,
        paymentFailed24h: payFail.count ?? 0,
      };
    },
    refetchInterval: 30_000,
  });

interface CronHealthRow {
  cron_name: string;
  last_started_at: string | null;
  last_finished_at: string | null;
  last_status: string | null;
  last_duration_ms: number | null;
  last_error: string | null;
  seconds_since_last: number | null;
  health: "ok" | "warning" | "stale" | "error";
}

const useCronHealth = () =>
  useQuery<CronHealthRow[]>({
    queryKey: ["core-cron-health"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cron_health_summary" as any)
        .select("*")
        .order("cron_name");
      if (error) throw error;
      return (data ?? []) as unknown as CronHealthRow[];
    },
    refetchInterval: 30_000,
  });

function fmtAge(seconds: number | null): string {
  if (seconds == null) return "—";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}min`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}j`;
}

function CronHealthSection() {
  const { data, isLoading } = useCronHealth();
  const badge = (h: string) => {
    const map: Record<string, string> = {
      ok: "bg-green-500/10 text-green-600 border-green-500/30",
      warning: "bg-amber-500/10 text-amber-600 border-amber-500/30",
      stale: "bg-red-500/10 text-red-600 border-red-500/30",
      error: "bg-red-500/10 text-red-600 border-red-500/30",
    };
    return map[h] || "bg-muted text-muted-foreground border-border";
  };
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" /> Crons — dernière exécution
        </h2>
        <span className="text-xs text-muted-foreground">
          {isLoading ? "…" : `${data?.length ?? 0} cron(s) suivis`}
        </span>
      </div>
      <div className="space-y-1.5">
        {(data ?? []).map((r) => (
          <div key={r.cron_name} className="flex items-center justify-between text-sm py-1.5 border-b border-border last:border-0">
            <div className="flex-1 min-w-0">
              <div className="font-mono text-xs text-foreground truncate">{r.cron_name}</div>
              {r.last_error && (
                <div className="text-[11px] text-red-500 truncate">Err: {r.last_error}</div>
              )}
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-xs text-muted-foreground tabular-nums">
                il y a {fmtAge(r.seconds_since_last)}
              </span>
              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${badge(r.health)}`}>
                {r.health}
              </span>
            </div>
          </div>
        ))}
        {!isLoading && (data?.length ?? 0) === 0 && (
          <div className="text-xs text-muted-foreground py-3 text-center">
            Aucun heartbeat enregistré (les crons instrumentés apparaîtront après leur prochaine exécution).
          </div>
        )}
      </div>
    </div>
  );
}


export default function CoreSystemHealthPage() {
  const { data, isLoading, refetch, isFetching } = useHealthStats();
  const [check, setCheck] = useState<HealthCheckResult | null>(null);
  const [running, setRunning] = useState(false);

  const runCheck = async () => {
    setRunning(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("nivra-health-check");
      if (error) throw error;
      setCheck(result as HealthCheckResult);
      toast.success(result.ok ? "Tous les systèmes opérationnels" : `${result.failed} échec(s) détecté(s)`);
    } catch (e) {
      toast.error("Erreur health check: " + (e as Error).message);
    } finally {
      setRunning(false);
    }
  };

  const drainQueue = async () => {
    try {
      const { error } = await supabase.functions.invoke("email-queue-drain");
      if (error) throw error;
      toast.success("File email vidée");
      refetch();
    } catch (e) {
      toast.error("Erreur: " + (e as Error).message);
    }
  };

  const drainNotif = async () => {
    try {
      const { error } = await supabase.functions.invoke("process-notification-outbox");
      if (error) throw error;
      toast.success("Outbox notifications vidée");
      refetch();
    } catch (e) {
      toast.error("Erreur: " + (e as Error).message);
    }
  };

  const cards = [
    { key: "emailDlq", label: "Emails DLQ", icon: Mail, alert: (v: number) => v > 0, action: drainQueue, actionLabel: "Drain" },
    { key: "emailStuck", label: "Emails bloqués (>1h)", icon: Clock, alert: (v: number) => v > 0, action: drainQueue, actionLabel: "Drain" },
    { key: "emailQueued", label: "Emails en file", icon: Mail, alert: (v: number) => v > 50 },
    { key: "notifBlocked", label: "Notifications bloquées", icon: Bell, alert: (v: number) => v > 0, action: drainNotif, actionLabel: "Drain" },
    { key: "paypalFailed24h", label: "PayPal échecs (24h)", icon: CreditCard, alert: (v: number) => v > 5 },
    { key: "paymentFailed24h", label: "Paiements échecs (24h)", icon: CreditCard, alert: (v: number) => v > 10 },
  ] as const;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Activity className="w-6 h-6 text-primary" />
            System Health
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Surveillance temps réel des files, paiements et workers
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
            Rafraîchir
          </Button>
          <Button size="sm" onClick={runCheck} disabled={running}>
            {running ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Activity className="w-4 h-4 mr-2" />}
            Health check complet
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((c) => {
          const value = data?.[c.key] ?? 0;
          const isAlert = !isLoading && c.alert(value);
          const Icon = c.icon;
          return (
            <div
              key={c.key}
              className={`rounded-xl border p-4 transition-colors ${
                isAlert ? "border-destructive/40 bg-destructive/5" : "border-border bg-card"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <Icon className={`w-5 h-5 ${isAlert ? "text-destructive" : "text-muted-foreground"}`} />
                {isAlert && (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-destructive animate-pulse">
                    Attention
                  </span>
                )}
              </div>
              <div className={`text-2xl font-bold ${isAlert ? "text-destructive" : "text-foreground"}`}>
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : value.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{c.label}</p>
              {isAlert && "action" in c && c.action && (
                <Button variant="outline" size="sm" className="mt-3 w-full" onClick={c.action}>
                  {c.actionLabel}
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {check && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground">Health check critique</h2>
            <span
              className={`text-xs font-bold ${check.ok ? "text-green-500" : "text-destructive"}`}
            >
              {check.passed}/{check.passed + check.failed} OK
            </span>
          </div>
          <div className="space-y-2">
            {check.checks.map((c) => (
              <div key={c.name} className="flex items-start gap-2 text-sm">
                {c.ok ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                )}
                <div className="flex-1">
                  <div className="text-foreground">{c.name}</div>
                  {c.detail && !c.ok && (
                    <div className="text-xs text-muted-foreground mt-0.5">{c.detail}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
