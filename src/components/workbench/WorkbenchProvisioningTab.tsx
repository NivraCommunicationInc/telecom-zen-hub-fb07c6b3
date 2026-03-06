/**
 * WorkbenchProvisioningTab V3 — Uses correct provisioning_jobs column names
 */
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { RefreshCw, ShieldCheck, AlertTriangle, Clock, CheckCircle, XCircle, Loader2, Wifi, Tv, Smartphone, Film } from "lucide-react";
import { canPerformAction } from "@/lib/workbenchRoles";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Props {
  provisioningJobs: any[];
  orderId: string;
  role: string | null;
  onRetry: (jobId: string) => Promise<void>;
  onOverride: (jobId: string, reason: string, executionLog: any[]) => Promise<void>;
  onComplete: (jobId: string, providerRef?: string) => Promise<void>;
}

const JOB_STATUS_CFG: Record<string, { color: string; icon: any; label: string }> = {
  queued: { color: "bg-amber-500/20 text-amber-400", icon: Clock, label: "En file" },
  pending: { color: "bg-amber-500/20 text-amber-400", icon: Clock, label: "En attente" },
  in_progress: { color: "bg-blue-500/20 text-blue-400", icon: Loader2, label: "En cours" },
  completed: { color: "bg-emerald-500/20 text-emerald-400", icon: CheckCircle, label: "Complété" },
  failed: { color: "bg-red-500/20 text-red-400", icon: XCircle, label: "Échoué" },
  blocked: { color: "bg-orange-500/20 text-orange-400", icon: AlertTriangle, label: "Bloqué" },
  skipped: { color: "bg-muted text-muted-foreground", icon: Clock, label: "Ignoré" },
};

const TYPE_ICONS: Record<string, any> = {
  INTERNET_ACTIVATE: Wifi,
  internet_activation: Wifi,
  TV_ACTIVATE: Tv,
  tv_activation: Tv,
  MOBILE_ACTIVATE: Smartphone,
  mobile_activation: Smartphone,
  STREAMING_ACTIVATE: Film,
  streaming_activation: Film,
};

export function WorkbenchProvisioningTab({ provisioningJobs, orderId, role, onRetry, onOverride, onComplete }: Props) {
  const [overrideJob, setOverrideJob] = useState<any>(null);
  const [overrideReason, setOverrideReason] = useState("");
  const [completeJob, setCompleteJob] = useState<any>(null);
  const [providerRef, setProviderRef] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const handleRetry = async (job: any) => {
    setIsProcessing(true);
    try { await onRetry(job.id); } finally { setIsProcessing(false); }
  };

  const handleOverride = async () => {
    if (!overrideJob || !overrideReason.trim()) return;
    setIsProcessing(true);
    try {
      await onOverride(overrideJob.id, overrideReason, Array.isArray(overrideJob.execution_log) ? overrideJob.execution_log : []);
      setOverrideJob(null);
      setOverrideReason("");
    } finally { setIsProcessing(false); }
  };

  const handleComplete = async () => {
    if (!completeJob) return;
    setIsProcessing(true);
    try {
      await onComplete(completeJob.id, providerRef || undefined);
      setCompleteJob(null);
      setProviderRef("");
    } finally { setIsProcessing(false); }
  };

  if (provisioningJobs.length === 0) {
    return (
      <div className="border border-border rounded-lg bg-card p-8 text-center text-muted-foreground">
        Aucun job de provisioning.
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {provisioningJobs.map((job: any) => {
          const cfg = JOB_STATUS_CFG[job.status] || JOB_STATUS_CFG.pending;
          const Icon = TYPE_ICONS[job.job_type] || cfg.icon;
          const provRef = job.result_data?.provider_reference;
          return (
            <div key={job.id} className="border border-border rounded-lg bg-card p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-muted">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground font-mono text-sm">{job.job_type}</p>
                    {job.job_label && <p className="text-xs text-muted-foreground">{job.job_label}</p>}
                    {provRef && <p className="text-xs text-muted-foreground">Réf: <span className="font-mono">{provRef}</span></p>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={cfg.color}>{cfg.label}</Badge>
                  {job.priority && <Badge variant="outline" className="text-xs">P{job.priority}</Badge>}
                </div>
              </div>

              {/* Details grid */}
              <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div><span className="text-muted-foreground block">Tentatives</span><span className="text-foreground">{job.attempts || 0} / {job.max_attempts || 3}</span></div>
                <div><span className="text-muted-foreground block">Prochaine</span><span className="text-foreground">{job.next_retry_at ? format(new Date(job.next_retry_at), "dd/MM HH:mm") : "—"}</span></div>
                <div><span className="text-muted-foreground block">Créé</span><span className="text-foreground">{format(new Date(job.created_at), "dd/MM HH:mm", { locale: fr })}</span></div>
                <div><span className="text-muted-foreground block">Complété</span><span className="text-foreground">{job.completed_at ? format(new Date(job.completed_at), "dd/MM HH:mm") : "—"}</span></div>
              </div>

              {/* Error */}
              {job.error_message && (
                <div className="mt-3 p-2 rounded bg-destructive/10 border border-destructive/20">
                  <p className="text-xs text-destructive font-mono">{job.error_message}</p>
                  {job.error_code && <p className="text-xs text-muted-foreground mt-1">Code: {job.error_code}</p>}
                </div>
              )}

              {/* Manual override info */}
              {job.manual_override_reason && (
                <div className="mt-3 p-2 rounded bg-amber-500/10 border border-amber-500/20">
                  <p className="text-xs text-amber-400">Override: {job.manual_override_reason}</p>
                  {job.manual_override_at && <p className="text-xs text-muted-foreground">{format(new Date(job.manual_override_at), "dd/MM HH:mm")}</p>}
                </div>
              )}

              {/* Execution Log */}
              {Array.isArray(job.execution_log) && job.execution_log.length > 0 && (
                <div className="mt-3 border-t border-border pt-2">
                  <p className="text-xs text-muted-foreground mb-1">Logs</p>
                  <div className="space-y-1 max-h-24 overflow-y-auto">
                    {job.execution_log.slice(-5).map((log: any, i: number) => (
                      <div key={i} className="text-xs text-muted-foreground font-mono">
                        [{log.timestamp?.slice(0, 16)}] {log.event} {log.reason && `— ${log.reason}`}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              {job.status !== "completed" && job.status !== "skipped" && (
                <div className="mt-3 flex gap-2 justify-end border-t border-border pt-3">
                  {["queued", "pending", "in_progress"].includes(job.status) && canPerformAction(role, "retry_provisioning") && (
                    <Button size="sm" variant="outline" className="text-xs" onClick={() => setCompleteJob(job)}>
                      <CheckCircle className="h-3 w-3 mr-1" /> Marquer complété
                    </Button>
                  )}
                  {["failed", "blocked"].includes(job.status) && (
                    <>
                      {canPerformAction(role, "retry_provisioning") && (
                        <Button size="sm" variant="outline" className="text-xs" onClick={() => handleRetry(job)} disabled={isProcessing}>
                          <RefreshCw className="h-3 w-3 mr-1" /> Retry
                        </Button>
                      )}
                      {canPerformAction(role, "override_provisioning") && (
                        <Button size="sm" variant="destructive" className="text-xs" onClick={() => setOverrideJob(job)} disabled={isProcessing}>
                          <ShieldCheck className="h-3 w-3 mr-1" /> Override
                        </Button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Override Dialog */}
      <Dialog open={!!overrideJob} onOpenChange={() => { setOverrideJob(null); setOverrideReason(""); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Override: {overrideJob?.job_type}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Force le job comme résolu. Un motif est obligatoire et sera enregistré dans l'audit.</p>
          <Textarea placeholder="Raison de l'override (obligatoire)…" value={overrideReason} onChange={e => setOverrideReason(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOverrideJob(null)}>Annuler</Button>
            <Button variant="destructive" onClick={handleOverride} disabled={!overrideReason.trim() || isProcessing}>Confirmer Override</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Complete with provider ref Dialog */}
      <Dialog open={!!completeJob} onOpenChange={() => { setCompleteJob(null); setProviderRef(""); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Compléter: {completeJob?.job_type}</DialogTitle></DialogHeader>
          <div>
            <label className="text-xs text-muted-foreground">Référence provider (optionnel)</label>
            <Input placeholder="Numéro d'activation, référence…" value={providerRef} onChange={e => setProviderRef(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteJob(null)}>Annuler</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleComplete} disabled={isProcessing}>
              <CheckCircle className="h-4 w-4 mr-1" /> Marquer complété
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
