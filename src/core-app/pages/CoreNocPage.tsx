/**
 * CoreNocPage — Network Operations Center (BSS Health Dashboard)
 * Shows live billing_system_alerts, summary stats, and allows triggering
 * the noc-monitor edge function (available after Pro upgrade 2026-06-14).
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  AlertTriangle, CheckCircle2, Clock, XCircle, RefreshCw,
  ShieldAlert, Activity, Zap, Info,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

const SEVERITY_STYLE: Record<string, string> = {
  critical: "bg-red-500/15 text-red-400 border-red-500/30",
  warning:  "bg-amber-500/15 text-amber-400 border-amber-500/30",
  info:     "bg-sky-500/15 text-sky-400 border-sky-500/30",
};

const SEVERITY_ICON: Record<string, React.ReactNode> = {
  critical: <XCircle className="w-4 h-4 text-red-400 shrink-0" />,
  warning:  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />,
  info:     <Info className="w-4 h-4 text-sky-400 shrink-0" />,
};

const ALERT_TYPE_FR: Record<string, string> = {
  dispute_created:             "Litige PayPal",
  dispute_status_changed:      "Litige mis à jour",
  orphaned_payment:            "Paiement orphelin",
  payment_failed:              "Échec de paiement",
  subscription_suspended_too_long: "Suspension prolongée",
  subscription_pending_stuck:  "Abonnement bloqué",
  invoice_overdue_not_voided:  "Facture impayée",
  email_queue_failures_spike:  "Pic d'échecs courriel",
  provisioning_failures_spike: "Échecs de provisioning",
  noc_escalation:              "Escalade NOC",
  inventory_low_stock:         "Stock bas",
  network_element_offline:     "Équipement hors-ligne",
  ra_renewal_gap:              "Renouvellement manquant",
  ra_paid_balance_mismatch:    "Écart solde payé",
  ra_missing_tax:              "Taxes manquantes",
  ra_duplicate_payment:        "Paiement en double",
  ra_voided_with_payment:      "Annulation avec paiement",
  ra_active_overdue_unsuspended: "Actif non-suspendu",
  ra_price_mismatch:           "Écart de prix",
  ra_orphaned_payment:         "Paiement orphelin (RA)",
};

interface Alert {
  id: string;
  alert_type: string;
  entity_type: string;
  entity_id: string | null;
  entity_reference: string | null;
  severity: string;
  details: Record<string, any>;
  resolved: boolean;
  resolved_at: string | null;
  resolution_note: string | null;
  created_at: string;
  updated_at: string;
}

export default function CoreNocPage() {
  const qc = useQueryClient();
  const [resolveOpen, setResolveOpen] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [note, setNote] = useState("");
  const [showResolved, setShowResolved] = useState(false);
  const [nocRunning, setNocRunning] = useState(false);

  const { data: alerts = [], isLoading, refetch } = useQuery({
    queryKey: ["noc-alerts", showResolved],
    refetchInterval: 60_000,
    queryFn: async () => {
      let q = supabase
        .from("billing_system_alerts")
        .select("*")
        .order("severity", { ascending: true })
        .order("created_at", { ascending: false })
        .limit(100);

      if (!showResolved) q = q.eq("resolved", false);
      else q = q.eq("resolved", true).gte("resolved_at", new Date(Date.now() - 7 * 86400_000).toISOString());

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as Alert[];
    },
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const openAlerts = alerts.filter(a => !a.resolved);
  const criticals = openAlerts.filter(a => a.severity === "critical");
  const warnings  = openAlerts.filter(a => a.severity === "warning");

  const resolvedToday = useQuery({
    queryKey: ["noc-resolved-today"],
    refetchInterval: 120_000,
    queryFn: async () => {
      const { count } = await supabase
        .from("billing_system_alerts")
        .select("*", { count: "exact", head: true })
        .eq("resolved", true)
        .gte("resolved_at", today.toISOString());
      return count || 0;
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async ({ id, note }: { id: string; note: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("billing_system_alerts")
        .update({
          resolved: true,
          resolved_at: new Date().toISOString(),
          resolved_by: user?.id ?? null,
          resolution_note: note || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Alerte résolue");
      setResolveOpen(false);
      setNote("");
      setSelectedAlert(null);
      qc.invalidateQueries({ queryKey: ["noc-alerts"] });
      qc.invalidateQueries({ queryKey: ["noc-resolved-today"] });
    },
    onError: (e: any) => toast.error("Erreur", { description: e.message }),
  });

  const runNocCheck = async () => {
    setNocRunning(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Session expirée");

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/noc-monitor`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Authorization": `Bearer ${session.access_token}` },
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`NOC monitor: ${res.status} — ${txt.slice(0, 200)}`);
      }

      const result = await res.json();
      const { summary } = result;
      toast.success("Vérification NOC terminée", {
        description: `OK: ${summary.ok} | Warnings: ${summary.warning} | Critiques: ${summary.critical} | Alertes créées: ${summary.total_alerts_raised}`,
        duration: 8000,
      });
      refetch();
    } catch (e: any) {
      toast.error("Erreur NOC", { description: e.message });
    } finally {
      setNocRunning(false);
    }
  };

  const openResolve = (alert: Alert) => {
    setSelectedAlert(alert);
    setNote("");
    setResolveOpen(true);
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-core-text-primary flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-core-accent" />
            Centre d'Opérations Réseau (NOC)
          </h1>
          <p className="text-sm text-core-text-secondary mt-0.5">
            Alertes BSS temps réel — Santé infrastructure Nivra
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { refetch(); resolvedToday.refetch(); }}
            className="border-core-border"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Actualiser
          </Button>
          <Button
            size="sm"
            onClick={runNocCheck}
            disabled={nocRunning}
            className="bg-core-accent hover:bg-core-accent/90 text-white"
          >
            {nocRunning
              ? <><RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />Vérification…</>
              : <><Zap className="w-3.5 h-3.5 mr-1.5" />Lancer vérification NOC</>
            }
          </Button>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Alertes ouvertes", value: openAlerts.length, icon: Activity, color: openAlerts.length > 0 ? "text-amber-400" : "text-emerald-400" },
          { label: "Critiques", value: criticals.length, icon: XCircle, color: criticals.length > 0 ? "text-red-400" : "text-emerald-400" },
          { label: "Avertissements", value: warnings.length, icon: AlertTriangle, color: warnings.length > 0 ? "text-amber-400" : "text-emerald-400" },
          { label: "Résolues aujourd'hui", value: resolvedToday.data ?? 0, icon: CheckCircle2, color: "text-emerald-400" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-core-card rounded-xl border border-core-border p-4">
            <div className="flex items-center gap-2 text-core-text-secondary text-xs mb-1">
              <Icon className={`w-3.5 h-3.5 ${color}`} />
              {label}
            </div>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Toggle resolved */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setShowResolved(false)}
          className={`text-sm px-3 py-1 rounded-lg transition-colors ${!showResolved ? "bg-core-accent/15 text-core-accent" : "text-core-text-secondary hover:text-core-text-primary"}`}
        >
          Alertes ouvertes ({openAlerts.length})
        </button>
        <button
          onClick={() => setShowResolved(true)}
          className={`text-sm px-3 py-1 rounded-lg transition-colors ${showResolved ? "bg-core-accent/15 text-core-accent" : "text-core-text-secondary hover:text-core-text-primary"}`}
        >
          Résolues (7 derniers jours)
        </button>
      </div>

      {/* Alerts list */}
      <div className="space-y-3">
        {isLoading && (
          <div className="flex items-center justify-center py-12 text-core-text-secondary">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" />Chargement…
          </div>
        )}

        {!isLoading && alerts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-core-text-secondary bg-core-card rounded-xl border border-core-border">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mb-3" />
            <p className="font-medium text-core-text-primary">
              {showResolved ? "Aucune alerte résolue dans les 7 derniers jours" : "Aucune alerte ouverte — tout est opérationnel"}
            </p>
          </div>
        )}

        {alerts.map((alert) => (
          <AlertRow
            key={alert.id}
            alert={alert}
            onResolve={openResolve}
          />
        ))}
      </div>

      {/* Resolve modal */}
      <Dialog open={resolveOpen} onOpenChange={setResolveOpen}>
        <DialogContent className="bg-core-card border-core-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-core-text-primary">Résoudre l'alerte</DialogTitle>
          </DialogHeader>
          {selectedAlert && (
            <div className="space-y-4">
              <div className={`rounded-lg border p-3 text-sm ${SEVERITY_STYLE[selectedAlert.severity] ?? SEVERITY_STYLE.info}`}>
                <p className="font-medium">{ALERT_TYPE_FR[selectedAlert.alert_type] ?? selectedAlert.alert_type}</p>
                <p className="text-xs mt-1 opacity-80">{selectedAlert.details?.message || selectedAlert.entity_reference || selectedAlert.entity_id}</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-core-text-secondary">Note de résolution (optionnelle)</label>
                <Textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Décrivez comment l'alerte a été résolue…"
                  className="bg-core-card border-core-border-strong text-core-text-primary text-sm resize-none h-24"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setResolveOpen(false)} className="border-core-border">
                  Annuler
                </Button>
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  disabled={resolveMutation.isPending}
                  onClick={() => resolveMutation.mutate({ id: selectedAlert.id, note })}
                >
                  {resolveMutation.isPending ? "Résolution…" : "Marquer comme résolu"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AlertRow({ alert, onResolve }: { alert: Alert; onResolve: (a: Alert) => void }) {
  const typeLabel = ALERT_TYPE_FR[alert.alert_type] ?? alert.alert_type;
  const message = alert.details?.message || alert.entity_reference || alert.entity_id || "—";

  return (
    <div className="bg-core-card rounded-xl border border-core-border p-4 flex flex-col sm:flex-row sm:items-start gap-3">
      <div className="flex items-start gap-3 flex-1 min-w-0">
        {SEVERITY_ICON[alert.severity] ?? <Info className="w-4 h-4 shrink-0" />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-core-text-primary">{typeLabel}</span>
            <Badge className={`text-xs border ${SEVERITY_STYLE[alert.severity] ?? SEVERITY_STYLE.info}`}>
              {alert.severity}
            </Badge>
            {alert.entity_type && (
              <span className="text-xs text-core-text-label bg-core-card-raised px-2 py-0.5 rounded-full border border-core-border">
                {alert.entity_type}
              </span>
            )}
          </div>
          <p className="text-xs text-core-text-secondary mt-1 truncate">{String(message)}</p>
          {alert.entity_reference && (
            <p className="text-xs text-core-accent mt-0.5">{alert.entity_reference}</p>
          )}
          <div className="flex items-center gap-3 mt-1.5 text-xs text-core-text-label">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true, locale: fr })}
            </span>
            {alert.resolved && alert.resolved_at && (
              <span className="flex items-center gap-1 text-emerald-400">
                <CheckCircle2 className="w-3 h-3" />
                Résolu {formatDistanceToNow(new Date(alert.resolved_at), { addSuffix: true, locale: fr })}
              </span>
            )}
          </div>
          {alert.resolved && alert.resolution_note && (
            <p className="text-xs text-core-text-secondary mt-1 italic">"{alert.resolution_note}"</p>
          )}
        </div>
      </div>
      {!alert.resolved && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => onResolve(alert)}
          className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 shrink-0 text-xs"
        >
          <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
          Résoudre
        </Button>
      )}
    </div>
  );
}
