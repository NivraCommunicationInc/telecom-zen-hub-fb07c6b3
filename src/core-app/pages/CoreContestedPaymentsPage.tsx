import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertTriangle, Search, ExternalLink, CheckCircle2, ShieldAlert,
  RefreshCcw, Ban, FileText, Activity, ChevronRight, Clock, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";

const formatCAD = (v: number | null | undefined) =>
  Number(v ?? 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" });

const ALERT_LABELS: Record<string, string> = {
  dispute_created: "Litige créé",
  dispute_resolved: "Litige résolu",
  orphan_recurring_payment: "Paiement orphelin",
  payment_failed: "Échec paiement",
  paypal_webhook_config_missing: "Config manquante",
};

const ALERT_ICONS: Record<string, any> = {
  dispute_created: ShieldAlert,
  dispute_resolved: CheckCircle2,
  orphan_recurring_payment: RefreshCcw,
  payment_failed: Ban,
  paypal_webhook_config_missing: Zap,
};

const SEVERITY_STYLE: Record<string, string> = {
  critical: "bg-rose-500/15 text-rose-400 border-rose-500/30",
  high: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  medium: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  low: "bg-blue-500/15 text-blue-400 border-blue-500/30",
};

const DISPUTE_STATUS_LABELS: Record<string, string> = {
  OPEN: "Ouvert",
  WAITING_FOR_SELLER_RESPONSE: "En attente réponse",
  UNDER_REVIEW: "Sous révision",
  RESOLVED: "Résolu",
};

interface Alert {
  id: string;
  alert_type: string;
  entity_type: string | null;
  entity_id: string | null;
  entity_reference: string | null;
  severity: string;
  details: any;
  resolved: boolean;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_note: string | null;
  created_at: string;
}

interface AuditRow {
  id: string;
  subscription_id: string | null;
  customer_id: string | null;
  action: string;
  source_type: string | null;
  source_id: string | null;
  details: any;
  reason: string | null;
  created_at: string;
}

const ACTION_LABELS: Record<string, string> = {
  paypal_subscription_activated: "Abonnement activé",
  paypal_subscription_cancelled: "Abonnement annulé",
  paypal_subscription_suspended: "Abonnement suspendu",
  paypal_payment_failed: "Paiement échoué",
  paypal_recurring_payment_received: "Paiement récurrent reçu",
};

type Tab = "alerts" | "audit";

export default function CoreContestedPaymentsPage() {
  const [tab, setTab] = useState<Tab>("alerts");
  const [search, setSearch] = useState("");
  const [showResolved, setShowResolved] = useState(false);
  const [resolving, setResolving] = useState<Alert | null>(null);
  const [resolveNote, setResolveNote] = useState("");
  const qc = useQueryClient();

  const { data: alerts = [], isLoading: loadingAlerts } = useQuery<Alert[]>({
    queryKey: ["billing-system-alerts"],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("billing_system_alerts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: audit = [], isLoading: loadingAudit } = useQuery<AuditRow[]>({
    queryKey: ["billing-subscription-trace-audit"],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("billing_subscription_trace_audit")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const markResolved = useMutation({
    mutationFn: async ({ id, note }: { id: string; note: string }) => {
      const { error } = await (supabase as any)
        .from("billing_system_alerts")
        .update({ resolved: true, resolved_at: new Date().toISOString(), resolution_note: note })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["billing-system-alerts"] });
      toast.success("Alerte marquée comme résolue");
      setResolving(null);
      setResolveNote("");
    },
    onError: () => toast.error("Erreur lors de la résolution"),
  });

  const filtered = useMemo(() => {
    let list = alerts.filter((a) => showResolved ? true : !a.resolved);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((a) =>
        [a.alert_type, a.entity_reference, a.details?.paypal_dispute_id, a.details?.message, a.severity]
          .filter(Boolean).join(" ").toLowerCase().includes(q)
      );
    }
    return list;
  }, [alerts, search, showResolved]);

  const disputes = filtered.filter((a) => a.alert_type === "dispute_created" || a.alert_type === "dispute_resolved");
  const otherAlerts = filtered.filter((a) => a.alert_type !== "dispute_created" && a.alert_type !== "dispute_resolved");

  const unresolvedCount = alerts.filter((a) => !a.resolved).length;
  const criticalCount = alerts.filter((a) => !a.resolved && a.severity === "critical").length;
  const openDisputeCount = alerts.filter((a) => !a.resolved && a.alert_type === "dispute_created").length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-core-text-primary flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-core-danger" />
            Contestations &amp; Alertes PayPal
          </h1>
          <p className="text-sm text-core-text-secondary mt-0.5">
            Litiges, échecs de paiement, anomalies de facturation
          </p>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Alertes actives", value: unresolvedCount, color: "text-amber-400", bg: "bg-amber-500/10" },
          { label: "Critiques", value: criticalCount, color: "text-rose-400", bg: "bg-rose-500/10" },
          { label: "Litiges ouverts", value: openDisputeCount, color: "text-orange-400", bg: "bg-orange-500/10" },
        ].map((s) => (
          <div key={s.label} className={cn("rounded-xl border border-core-border p-3 flex items-center gap-3", s.bg)}>
            <div className="flex-1">
              <p className="text-xs text-core-text-label">{s.label}</p>
              <p className={cn("text-2xl font-bold mt-0.5", s.color)}>{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-core-border">
        {([
          { key: "alerts", label: "Alertes & Litiges", icon: ShieldAlert },
          { key: "audit", label: "Trace Audit Abonnements", icon: Activity },
        ] as { key: Tab; label: string; icon: any }[]).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              tab === key
                ? "border-primary text-primary"
                : "border-transparent text-core-text-label hover:text-core-text-primary"
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Alerts tab */}
      {tab === "alerts" && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-core-text-label" />
              <Input
                placeholder="Rechercher alertes, litiges…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-core-card-raised border-core-border-strong text-core-text-primary"
              />
            </div>
            <button
              onClick={() => setShowResolved(!showResolved)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                showResolved
                  ? "bg-primary/10 text-primary border-primary/30"
                  : "border-core-border text-core-text-label hover:text-core-text-primary"
              )}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {showResolved ? "Masquer résolus" : "Voir résolus"}
            </button>
            <span className="text-xs text-core-text-label">{filtered.length} alerte{filtered.length !== 1 ? "s" : ""}</span>
          </div>

          {loadingAlerts && <div className="text-center py-12 text-core-text-label">Chargement…</div>}

          {/* Disputes section */}
          {!loadingAlerts && disputes.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-xs font-semibold text-core-text-label uppercase tracking-wider flex items-center gap-2">
                <ShieldAlert className="w-3.5 h-3.5" /> Litiges PayPal ({disputes.length})
              </h2>
              {disputes.map((a) => (
                <AlertCard key={a.id} alert={a} onResolve={() => setResolving(a)} />
              ))}
            </section>
          )}

          {/* Other alerts */}
          {!loadingAlerts && otherAlerts.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-xs font-semibold text-core-text-label uppercase tracking-wider flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5" /> Autres alertes ({otherAlerts.length})
              </h2>
              {otherAlerts.map((a) => (
                <AlertCard key={a.id} alert={a} onResolve={() => setResolving(a)} />
              ))}
            </section>
          )}

          {!loadingAlerts && filtered.length === 0 && (
            <div className="text-center py-16 text-core-text-label">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-emerald-500/40" />
              <p className="font-medium">Aucune alerte active</p>
              <p className="text-xs mt-1">Tout est en ordre !</p>
            </div>
          )}
        </div>
      )}

      {/* Audit tab */}
      {tab === "audit" && (
        <div className="space-y-2">
          {loadingAudit && <div className="text-center py-12 text-core-text-label">Chargement…</div>}
          {!loadingAudit && audit.length === 0 && (
            <div className="text-center py-12 text-core-text-label">Aucune entrée d'audit</div>
          )}
          {!loadingAudit && audit.map((row) => (
            <div key={row.id} className="p-3 rounded-lg border border-core-border bg-core-card flex items-start gap-3">
              <div className="shrink-0 mt-0.5 p-1.5 rounded-md bg-secondary">
                <Activity className="w-3.5 h-3.5 text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-core-text-primary">
                    {ACTION_LABELS[row.action] ?? row.action}
                  </span>
                  {row.source_type && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-core-text-label font-mono">
                      {row.source_type}
                    </span>
                  )}
                </div>
                {row.reason && (
                  <p className="text-xs text-core-text-secondary mt-0.5">{row.reason}</p>
                )}
                {row.details?.amount && (
                  <p className="text-xs text-core-text-label mt-0.5">
                    Montant: {formatCAD(row.details.amount)}
                  </p>
                )}
                <p className="text-[10px] text-core-text-label/60 mt-1">
                  <Clock className="w-3 h-3 inline mr-1" />
                  {formatDistanceToNow(new Date(row.created_at), { addSuffix: true, locale: fr })}
                  {" · "}{format(new Date(row.created_at), "d MMM yyyy HH:mm", { locale: fr })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Resolve modal */}
      <Dialog open={!!resolving} onOpenChange={(o) => { if (!o) { setResolving(null); setResolveNote(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marquer comme résolu</DialogTitle>
          </DialogHeader>
          {resolving && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-secondary text-sm">
                <p className="font-medium">{ALERT_LABELS[resolving.alert_type] ?? resolving.alert_type}</p>
                {resolving.entity_reference && (
                  <p className="text-xs text-muted-foreground mt-0.5">Ref: {resolving.entity_reference}</p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Note de résolution</label>
                <Textarea
                  placeholder="Décrire comment ce problème a été résolu…"
                  value={resolveNote}
                  onChange={(e) => setResolveNote(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setResolving(null); setResolveNote(""); }}>Annuler</Button>
            <Button
              onClick={() => resolving && markResolved.mutate({ id: resolving.id, note: resolveNote })}
              disabled={markResolved.isPending}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <CheckCircle2 className="w-4 h-4 mr-1.5" />
              Confirmer résolution
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AlertCard({ alert, onResolve }: { alert: Alert; onResolve: () => void }) {
  const Icon = ALERT_ICONS[alert.alert_type] ?? AlertTriangle;
  const d = alert.details ?? {};
  const isDispute = alert.alert_type === "dispute_created";

  return (
    <div className={cn(
      "p-4 rounded-xl border transition-colors",
      alert.resolved
        ? "border-core-border bg-core-card opacity-60"
        : "border-core-border-strong bg-core-card"
    )}>
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={cn(
          "shrink-0 p-2 rounded-lg",
          alert.resolved ? "bg-secondary" : isDispute ? "bg-rose-500/10" : "bg-amber-500/10"
        )}>
          <Icon className={cn("w-4 h-4", alert.resolved ? "text-muted-foreground" : isDispute ? "text-rose-400" : "text-amber-400")} />
        </div>

        {/* Body */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-core-text-primary">
                  {ALERT_LABELS[alert.alert_type] ?? alert.alert_type}
                </span>
                <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded border", SEVERITY_STYLE[alert.severity])}>
                  {alert.severity.toUpperCase()}
                </span>
                {alert.resolved && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    RÉSOLU
                  </span>
                )}
              </div>
              {d.message && (
                <p className="text-xs text-core-text-secondary mt-1 leading-relaxed">{d.message}</p>
              )}
            </div>
          </div>

          {/* Dispute-specific info */}
          {isDispute && (
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              {d.paypal_dispute_id && (
                <div>
                  <p className="text-core-text-label">ID Litige PayPal</p>
                  <p className="font-mono text-core-text-primary">{d.paypal_dispute_id}</p>
                </div>
              )}
              {d.dispute_amount && (
                <div>
                  <p className="text-core-text-label">Montant contesté</p>
                  <p className="font-semibold text-rose-400">{formatCAD(d.dispute_amount)}</p>
                </div>
              )}
              {d.dispute_reason && (
                <div>
                  <p className="text-core-text-label">Raison</p>
                  <p className="text-core-text-primary">{d.dispute_reason}</p>
                </div>
              )}
              {d.dispute_status && (
                <div>
                  <p className="text-core-text-label">Statut PayPal</p>
                  <p className="text-core-text-primary">{DISPUTE_STATUS_LABELS[d.dispute_status] ?? d.dispute_status}</p>
                </div>
              )}
              {d.seller_response_due_date && (
                <div className="col-span-2">
                  <p className="text-core-text-label">Réponse requise avant</p>
                  <p className="font-medium text-amber-400">
                    {format(new Date(d.seller_response_due_date), "d MMMM yyyy", { locale: fr })}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Orphan / payment failed info */}
          {(alert.alert_type === "orphan_recurring_payment" || alert.alert_type === "payment_failed") && d.amount && (
            <div className="mt-2 flex items-center gap-3 text-xs">
              <span className="text-core-text-label">Montant:</span>
              <span className="font-semibold text-orange-400">{formatCAD(d.amount)}</span>
              {d.paypal_subscription_id && (
                <>
                  <span className="text-core-text-label">Abonnement:</span>
                  <span className="font-mono text-core-text-primary">{d.paypal_subscription_id}</span>
                </>
              )}
            </div>
          )}

          {/* Resolution info */}
          {alert.resolved && alert.resolution_note && (
            <div className="mt-2 p-2 rounded-md bg-emerald-500/5 border border-emerald-500/15">
              <p className="text-[11px] text-emerald-400"><FileText className="w-3 h-3 inline mr-1" />{alert.resolution_note}</p>
            </div>
          )}

          {/* Footer row */}
          <div className="flex items-center justify-between mt-3 gap-2 flex-wrap">
            <p className="text-[10px] text-core-text-label/60">
              <Clock className="w-3 h-3 inline mr-0.5" />
              {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true, locale: fr })}
            </p>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {isDispute && d.paypal_dispute_url && !alert.resolved && (
                <a
                  href={d.paypal_dispute_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  Voir sur PayPal
                </a>
              )}
              {!alert.resolved && (
                <button
                  onClick={onResolve}
                  className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 transition-colors border border-emerald-500/20 px-2 py-1 rounded-md hover:bg-emerald-500/10"
                >
                  <CheckCircle2 className="w-3 h-3" />
                  Résoudre
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
