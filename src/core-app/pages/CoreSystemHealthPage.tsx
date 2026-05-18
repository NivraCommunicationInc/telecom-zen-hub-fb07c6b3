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
