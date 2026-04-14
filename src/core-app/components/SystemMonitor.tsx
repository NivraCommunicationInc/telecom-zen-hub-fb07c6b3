/**
 * SystemMonitor — Live operational stats widget for admin dashboard
 * Shows: active clients, open tickets, errors (24h), security alerts (24h)
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Users, Ticket, AlertTriangle, ShieldAlert, Loader2 } from "lucide-react";

interface MonitorStats {
  activeClients: number;
  openTickets: number;
  errorsToday: number;
  securityEvents: number;
}

const useMonitorStats = () =>
  useQuery<MonitorStats>({
    queryKey: ["system-monitor-stats"],
    queryFn: async () => {
      const yesterday = new Date(Date.now() - 86_400_000).toISOString();

      const [clients, tickets, errors, security] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("support_tickets").select("id", { count: "exact", head: true }).in("status", ["open", "in_progress"]),
        supabase.from("client_errors").select("id", { count: "exact", head: true }).gte("created_at", yesterday),
        supabase.from("security_audit_log").select("id", { count: "exact", head: true }).gte("created_at", yesterday).eq("success", false),
      ]);

      return {
        activeClients: clients.count ?? 0,
        openTickets: tickets.count ?? 0,
        errorsToday: errors.count ?? 0,
        securityEvents: security.count ?? 0,
      };
    },
    refetchInterval: 30_000,
  });

const cards = [
  { key: "activeClients" as const, label: "Clients actifs", icon: Users, thresholdBad: -1 },
  { key: "openTickets" as const, label: "Tickets ouverts", icon: Ticket, thresholdBad: 10 },
  { key: "errorsToday" as const, label: "Erreurs (24h)", icon: AlertTriangle, thresholdBad: 5 },
  { key: "securityEvents" as const, label: "Alertes sécurité", icon: ShieldAlert, thresholdBad: 0 },
];

export default function SystemMonitor() {
  const { data, isLoading } = useMonitorStats();

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cards.map((c) => {
        const value = data?.[c.key] ?? 0;
        const isAlert = c.thresholdBad >= 0 && value > c.thresholdBad;
        const Icon = c.icon;

        return (
          <div
            key={c.key}
            className={`rounded-xl border p-4 transition-colors ${
              isAlert
                ? "border-red-500/40 bg-red-500/5"
                : "border-white/10 bg-white/5"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <Icon className={`w-5 h-5 ${isAlert ? "text-red-400" : "text-muted-foreground"}`} />
              {isAlert && <span className="text-[10px] font-bold uppercase tracking-wider text-red-400 animate-pulse">Attention</span>}
            </div>
            <div className={`text-2xl font-bold ${isAlert ? "text-red-400" : "text-foreground"}`}>
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : value.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{c.label}</p>
          </div>
        );
      })}
    </div>
  );
}
