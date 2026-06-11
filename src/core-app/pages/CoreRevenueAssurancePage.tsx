/**
 * CoreRevenueAssurancePage — Revenue Assurance Dashboard
 *
 * Runs the revenue-assurance engine on-demand and displays results.
 * Also shows historical billing_system_alerts with ra_ prefix.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminClient } from "@/integrations/backend";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import {
  RefreshCw, DollarSign, AlertTriangle, CheckCircle2,
  XCircle, TrendingDown, Loader2, Play, ChevronDown, ChevronRight,
  ShieldAlert, Receipt, CreditCard, Repeat,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CheckResult {
  check: string;
  label: string;
  findings: number;
  alerts_raised: number;
  revenue_at_risk: number;
  status: "ok" | "warning" | "critical";
  message: string;
}

interface RAReport {
  checks: CheckResult[];
  summary: {
    total_findings: number;
    total_alerts_raised: number;
    total_revenue_at_risk: number;
    critical: number;
    warning: number;
    ok: number;
    ran_at: string;
  };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CHECK_ICON: Record<string, React.ReactNode> = {
  ra_renewal_gap:             <Repeat className="w-4 h-4" />,
  ra_paid_balance_mismatch:   <Receipt className="w-4 h-4" />,
  ra_missing_tax:             <ShieldAlert className="w-4 h-4" />,
  ra_duplicate_payment:       <CreditCard className="w-4 h-4" />,
  ra_voided_with_payment:     <XCircle className="w-4 h-4" />,
  ra_active_overdue_unsuspended: <AlertTriangle className="w-4 h-4" />,
  ra_price_mismatch:          <TrendingDown className="w-4 h-4" />,
  ra_orphaned_payment:        <DollarSign className="w-4 h-4" />,
};

const STATUS_STYLE = {
  ok:       "border-emerald-500/30 bg-emerald-500/5 text-emerald-400",
  warning:  "border-amber-500/30 bg-amber-500/5 text-amber-400",
  critical: "border-red-500/30 bg-red-500/5 text-red-400",
};

const ALERT_TYPE_LABEL: Record<string, string> = {
  ra_renewal_gap:               "Renouvellement manquant",
  ra_paid_balance_mismatch:     "Solde résiduel",
  ra_missing_tax:               "Taxes manquantes",
  ra_duplicate_payment:         "Paiement en double",
  ra_voided_with_payment:       "Facture annulée avec paiement",
  ra_active_overdue_unsuspended:"Actif en retard non-suspendu",
  ra_price_mismatch:            "Écart de prix",
  ra_orphaned_payment:          "Paiement orphelin",
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function CoreRevenueAssurancePage() {
  const qc = useQueryClient();
  const [report, setReport] = useState<RAReport | null>(null);
  const [expandedCheck, setExpandedCheck] = useState<string | null>(null);
  const [expandedAlertId, setExpandedAlertId] = useState<string | null>(null);

  // Open RA alerts from billing_system_alerts
  const { data: openAlerts = [], refetch: refetchAlerts } = useQuery({
    queryKey: ["ra-open-alerts"],
    queryFn: async () => {
      const { data, error } = await adminClient
        .from("billing_system_alerts")
        .select("*")
        .like("alert_type", "ra_%")
        .eq("resolved", false)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
  });

  // Resolved RA alerts (last 7 days)
  const { data: resolvedAlerts = [] } = useQuery({
    queryKey: ["ra-resolved-alerts"],
    queryFn: async () => {
      const since = new Date(Date.now() - 7 * 86400 * 1000).toISOString();
      const { data } = await adminClient
        .from("billing_system_alerts")
        .select("*")
        .like("alert_type", "ra_%")
        .eq("resolved", true)
        .gte("resolved_at", since)
        .order("resolved_at", { ascending: false })
        .limit(50);
      return data || [];
    },
  });

  // Run engine mutation
  const runMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("revenue-assurance");
      if (error) throw error;
      return data as RAReport;
    },
    onSuccess: (data) => {
      setReport(data);
      qc.invalidateQueries({ queryKey: ["ra-open-alerts"] });
      qc.invalidateQueries({ queryKey: ["ra-resolved-alerts"] });
      const risk = data.summary.total_revenue_at_risk;
      if (data.summary.critical > 0) {
        toast.error(`Revenue Assurance: ${data.summary.total_findings} anomalie(s) — ${risk.toFixed(2)}$ à risque`);
      } else if (data.summary.total_findings > 0) {
        toast.warning(`Revenue Assurance: ${data.summary.total_findings} anomalie(s) — ${risk.toFixed(2)}$ à risque`);
      } else {
        toast.success("Revenue Assurance: aucune anomalie détectée");
      }
    },
    onError: (e: any) => toast.error(e.message || "Erreur lors de l'analyse"),
  });

  // Resolve alert mutation
  const resolveMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const { error } = await adminClient
        .from("billing_system_alerts")
        .update({ resolved: true, resolved_at: new Date().toISOString(), resolved_by: "admin" })
        .eq("id", alertId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ra-open-alerts"] });
      qc.invalidateQueries({ queryKey: ["ra-resolved-alerts"] });
      toast.success("Alerte résolue");
    },
  });

  // Group open alerts by type
  const alertsByType: Record<string, any[]> = {};
  for (const a of openAlerts) {
    if (!alertsByType[a.alert_type]) alertsByType[a.alert_type] = [];
    alertsByType[a.alert_type].push(a);
  }

  const totalRisk = openAlerts.reduce((s: number, a: any) => {
    return s + Number(a.details?.balance_due || a.details?.deviation || a.details?.total_amount || a.details?.amount || 0);
  }, 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[hsl(var(--core-text-primary))]">
            Revenue Assurance
          </h1>
          <p className="text-sm text-[hsl(var(--core-text-secondary))]">
            Détection de fuites de revenus — TPS/TVQ · Renouvellements · Paiements · Tarification
          </p>
        </div>
        <Button
          onClick={() => runMutation.mutate()}
          disabled={runMutation.isPending}
          className="gap-2"
        >
          {runMutation.isPending
            ? <><Loader2 className="w-4 h-4 animate-spin" />Analyse en cours…</>
            : <><Play className="w-4 h-4" />Lancer l'analyse</>
          }
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-[hsl(220,15%,11%)] border-[hsl(220,15%,16%)]">
          <CardContent className="p-4">
            <p className="text-xs text-[hsl(var(--core-text-label))] mb-1">Alertes ouvertes</p>
            <p className={cn("text-2xl font-bold", openAlerts.length > 0 ? "text-red-400" : "text-emerald-400")}>
              {openAlerts.length}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-[hsl(220,15%,11%)] border-[hsl(220,15%,16%)]">
          <CardContent className="p-4">
            <p className="text-xs text-[hsl(var(--core-text-label))] mb-1">Revenus à risque (estimé)</p>
            <p className="text-2xl font-bold text-amber-400">
              {report ? `${report.summary.total_revenue_at_risk.toFixed(2)}$` : "—"}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-[hsl(220,15%,11%)] border-[hsl(220,15%,16%)]">
          <CardContent className="p-4">
            <p className="text-xs text-[hsl(var(--core-text-label))] mb-1">Résolus (7j)</p>
            <p className="text-2xl font-bold text-emerald-400">{resolvedAlerts.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-[hsl(220,15%,11%)] border-[hsl(220,15%,16%)]">
          <CardContent className="p-4">
            <p className="text-xs text-[hsl(var(--core-text-label))] mb-1">Dernière analyse</p>
            <p className="text-sm font-medium text-[hsl(var(--core-text-primary))]">
              {report ? format(new Date(report.summary.ran_at), "HH:mm 'd' d MMM", { locale: fr }) : "Jamais"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Last run results */}
      {report && (
        <div>
          <h2 className="text-sm font-semibold text-[hsl(var(--core-text-label))] uppercase tracking-wide mb-2">
            Résultats de la dernière analyse
          </h2>
          <div className="space-y-2">
            {report.checks.map((check) => (
              <button
                key={check.check}
                className="w-full text-left"
                onClick={() => setExpandedCheck(expandedCheck === check.check ? null : check.check)}
              >
                <div className={cn(
                  "flex items-center justify-between p-3 rounded-lg border transition-colors",
                  STATUS_STYLE[check.status],
                )}>
                  <div className="flex items-center gap-3">
                    <span className="opacity-70">{CHECK_ICON[check.check]}</span>
                    <div>
                      <p className="text-sm font-medium">{check.label}</p>
                      <p className="text-xs opacity-70">{check.message}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {check.revenue_at_risk > 0 && (
                      <span className="text-xs font-mono">{check.revenue_at_risk.toFixed(2)}$</span>
                    )}
                    <Badge variant="outline" className={cn("text-xs border", STATUS_STYLE[check.status])}>
                      {check.findings === 0 ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <AlertTriangle className="w-3 h-3 mr-1" />}
                      {check.findings} anomalie{check.findings !== 1 ? "s" : ""}
                    </Badge>
                    {expandedCheck === check.check
                      ? <ChevronDown className="w-4 h-4 opacity-50" />
                      : <ChevronRight className="w-4 h-4 opacity-50" />
                    }
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Open alerts grouped by type */}
      {Object.keys(alertsByType).length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-[hsl(var(--core-text-label))] uppercase tracking-wide">
              Alertes ouvertes ({openAlerts.length})
            </h2>
            <Button size="sm" variant="ghost" onClick={() => refetchAlerts()} className="h-7 text-xs">
              <RefreshCw className="w-3 h-3 mr-1" />Actualiser
            </Button>
          </div>
          <div className="space-y-3">
            {Object.entries(alertsByType).map(([type, alerts]) => (
              <div key={type} className="rounded-lg border border-[hsl(220,15%,16%)] overflow-hidden">
                {/* Group header */}
                <button
                  className="w-full flex items-center justify-between px-4 py-2.5 bg-[hsl(220,15%,12%)] hover:bg-[hsl(220,15%,14%)] transition-colors"
                  onClick={() => setExpandedCheck(expandedCheck === type ? null : type)}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[hsl(var(--core-text-label))]">{CHECK_ICON[type]}</span>
                    <span className="text-sm font-medium text-[hsl(var(--core-text-primary))]">
                      {ALERT_TYPE_LABEL[type] || type}
                    </span>
                    <Badge variant="outline" className="text-xs border-red-500/30 text-red-400">
                      {alerts.length}
                    </Badge>
                  </div>
                  {expandedCheck === type
                    ? <ChevronDown className="w-4 h-4 text-[hsl(var(--core-text-label))]" />
                    : <ChevronRight className="w-4 h-4 text-[hsl(var(--core-text-label))]" />
                  }
                </button>

                {/* Alert rows */}
                {expandedCheck === type && (
                  <div className="divide-y divide-[hsl(220,15%,14%)]">
                    {alerts.map((alert) => (
                      <div key={alert.id}>
                        <button
                          className="w-full px-4 py-3 text-left hover:bg-[hsl(220,15%,13%)] transition-colors"
                          onClick={() => setExpandedAlertId(expandedAlertId === alert.id ? null : alert.id)}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1 min-w-0">
                              <p className="text-xs text-[hsl(var(--core-text-secondary))] leading-snug">
                                {alert.message}
                              </p>
                              <p className="text-xs text-[hsl(var(--core-text-label))]">
                                {format(new Date(alert.created_at), "d MMM yyyy HH:mm", { locale: fr })}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Badge
                                variant="outline"
                                className={cn("text-xs border", {
                                  "border-red-500/30 text-red-400":    alert.severity === "critical" || alert.severity === "high",
                                  "border-amber-500/30 text-amber-400": alert.severity === "warning" || alert.severity === "medium",
                                  "border-sky-500/30 text-sky-400":     alert.severity === "info" || alert.severity === "low",
                                })}
                              >
                                {alert.severity}
                              </Badge>
                              {expandedAlertId === alert.id
                                ? <ChevronDown className="w-3.5 h-3.5 text-[hsl(var(--core-text-label))]" />
                                : <ChevronRight className="w-3.5 h-3.5 text-[hsl(var(--core-text-label))]" />
                              }
                            </div>
                          </div>
                        </button>

                        {/* Alert detail + resolve */}
                        {expandedAlertId === alert.id && (
                          <div className="px-4 pb-3 space-y-2 bg-[hsl(220,15%,10%)]">
                            {alert.details && Object.keys(alert.details).length > 0 && (
                              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                {Object.entries(alert.details as Record<string, unknown>)
                                  .filter(([, v]) => v !== null && v !== undefined && v !== "")
                                  .map(([k, v]) => (
                                    <div key={k}>
                                      <span className="text-xs text-[hsl(var(--core-text-label))]">{k}: </span>
                                      <span className="text-xs text-[hsl(var(--core-text-primary))] font-mono break-all">
                                        {typeof v === "object" ? JSON.stringify(v) : String(v)}
                                      </span>
                                    </div>
                                  ))
                                }
                              </div>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                              onClick={() => resolveMutation.mutate(alert.id)}
                              disabled={resolveMutation.isPending}
                            >
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Marquer résolu
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {openAlerts.length === 0 && !report && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <DollarSign className="w-10 h-10 text-emerald-400" />
          <p className="text-sm font-medium text-[hsl(var(--core-text-primary))]">
            Aucune anomalie de revenu ouverte
          </p>
          <p className="text-xs text-[hsl(var(--core-text-secondary))]">
            Lancez une analyse pour détecter les fuites de revenus
          </p>
        </div>
      )}

      {/* Resolved (last 7 days) */}
      {resolvedAlerts.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-[hsl(var(--core-text-label))] uppercase tracking-wide mb-2">
            Résolus (7 derniers jours)
          </h2>
          <div className="space-y-1.5">
            {resolvedAlerts.map((a: any) => (
              <div key={a.id} className="flex items-center justify-between px-3 py-2 rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,15%,11%)] opacity-60">
                <div>
                  <p className="text-xs text-[hsl(var(--core-text-secondary))]">{a.message}</p>
                  <p className="text-xs text-[hsl(var(--core-text-label))]">
                    Résolu {format(new Date(a.resolved_at), "d MMM HH:mm", { locale: fr })}
                    {a.resolved_by ? ` par ${a.resolved_by}` : ""}
                  </p>
                </div>
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
