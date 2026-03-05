/**
 * WorkbenchProvisioningTab - Provisioning jobs with retry/override actions
 */
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { RefreshCw, ShieldCheck, AlertTriangle, Clock, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { canPerformAction } from "@/lib/workbenchRoles";
import { adminClient as supabase } from "@/integrations/backend";
import { useActivityLog } from "@/hooks/useActivityLog";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Props {
  provisioningJobs: any[];
  orderId: string;
  role: string | null;
  onRefresh: () => void;
}

const JOB_STATUS_CFG: Record<string, { color: string; icon: any }> = {
  pending: { color: "bg-amber-500/20 text-amber-400", icon: Clock },
  in_progress: { color: "bg-blue-500/20 text-blue-400", icon: Loader2 },
  completed: { color: "bg-emerald-500/20 text-emerald-400", icon: CheckCircle },
  failed: { color: "bg-red-500/20 text-red-400", icon: XCircle },
  blocked: { color: "bg-orange-500/20 text-orange-400", icon: AlertTriangle },
  skipped: { color: "bg-muted text-muted-foreground", icon: Clock },
};

export function WorkbenchProvisioningTab({ provisioningJobs, orderId, role, onRefresh }: Props) {
  const { logActivity } = useActivityLog();
  const [overrideJob, setOverrideJob] = useState<any>(null);
  const [overrideReason, setOverrideReason] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const handleRetry = async (job: any) => {
    setIsProcessing(true);
    try {
      await supabase.from("provisioning_jobs").update({
        status: "pending",
        attempts: (job.attempts || 0),
        last_error: null,
      }).eq("id", job.id);
      await logActivity("retry_provisioning", "provisioning_job", job.id, { job_type: job.job_type, order_id: orderId });
      toast.success(`Job ${job.job_type} relancé`);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOverride = async () => {
    if (!overrideJob || !overrideReason.trim()) return;
    setIsProcessing(true);
    try {
      const executionLog = Array.isArray(overrideJob.execution_log) ? overrideJob.execution_log : [];
      await supabase.from("provisioning_jobs").update({
        status: "completed",
        completed_at: new Date().toISOString(),
        execution_log: [...executionLog, {
          event: "manual_override",
          reason: overrideReason,
          timestamp: new Date().toISOString(),
        }],
      }).eq("id", overrideJob.id);
      await logActivity("override_provisioning", "provisioning_job", overrideJob.id, {
        job_type: overrideJob.job_type,
        reason: overrideReason,
        order_id: orderId,
      });
      toast.success(`Job ${overrideJob.job_type} marqué comme résolu (override)`);
      setOverrideJob(null);
      setOverrideReason("");
      onRefresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  if (provisioningJobs.length === 0) {
    return (
      <Card className="bg-slate-800/50 border-slate-700/50">
        <CardContent className="py-8 text-center text-muted-foreground">
          Aucun job de provisioning.
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {provisioningJobs.map((job: any) => {
          const cfg = JOB_STATUS_CFG[job.status] || JOB_STATUS_CFG.pending;
          const Icon = cfg.icon;
          return (
            <Card key={job.id} className="bg-slate-800/50 border-slate-700/50">
              <CardContent className="pt-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Icon className="h-5 w-5 text-slate-400" />
                    <div>
                      <p className="font-medium text-white font-mono text-sm">{job.job_type}</p>
                      {job.provider && <p className="text-xs text-muted-foreground">Provider: {job.provider}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={cfg.color}>{job.status}</Badge>
                    {job.priority && <Badge variant="outline" className="text-xs">P{job.priority}</Badge>}
                  </div>
                </div>

                {/* Details */}
                <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-muted-foreground">
                  <div>
                    <span className="block text-slate-500">Tentatives</span>
                    <span className="text-white">{job.attempts || 0} / {job.max_retries || 3}</span>
                  </div>
                  <div>
                    <span className="block text-slate-500">Prochaine tentative</span>
                    <span className="text-white">{job.next_retry_at ? format(new Date(job.next_retry_at), "dd/MM HH:mm") : "—"}</span>
                  </div>
                  <div>
                    <span className="block text-slate-500">Créé</span>
                    <span className="text-white">{format(new Date(job.created_at), "dd/MM HH:mm", { locale: fr })}</span>
                  </div>
                  <div>
                    <span className="block text-slate-500">Complété</span>
                    <span className="text-white">{job.completed_at ? format(new Date(job.completed_at), "dd/MM HH:mm") : "—"}</span>
                  </div>
                </div>

                {/* Last Error */}
                {job.last_error && (
                  <div className="mt-3 p-2 rounded bg-red-500/10 border border-red-500/20">
                    <p className="text-xs text-red-400 font-mono">{job.last_error}</p>
                  </div>
                )}

                {/* Actions */}
                {(job.status === "failed" || job.status === "blocked") && (
                  <div className="mt-3 flex gap-2 justify-end">
                    {canPerformAction(role, "retry_provisioning") && (
                      <Button size="sm" variant="outline" onClick={() => handleRetry(job)} disabled={isProcessing}>
                        <RefreshCw className="h-3 w-3 mr-1" /> Retry
                      </Button>
                    )}
                    {canPerformAction(role, "override_provisioning") && (
                      <Button size="sm" variant="destructive" onClick={() => setOverrideJob(job)} disabled={isProcessing}>
                        <ShieldCheck className="h-3 w-3 mr-1" /> Override
                      </Button>
                    )}
                  </div>
                )}

                {/* Execution Log */}
                {Array.isArray(job.execution_log) && job.execution_log.length > 0 && (
                  <div className="mt-3 border-t border-slate-700/50 pt-2">
                    <p className="text-xs text-slate-500 mb-1">Logs d'exécution</p>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {job.execution_log.slice(-5).map((log: any, i: number) => (
                        <div key={i} className="text-xs text-muted-foreground font-mono">
                          [{log.timestamp?.slice(0, 16)}] {log.event} {log.reason && `— ${log.reason}`}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Override Dialog */}
      <Dialog open={!!overrideJob} onOpenChange={() => { setOverrideJob(null); setOverrideReason(""); }}>
        <DialogContent className="bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle>Override: {overrideJob?.job_type}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Cette action force le job comme résolu. Un motif est obligatoire et sera enregistré dans le journal d'audit.
          </p>
          <Textarea
            placeholder="Raison de l'override (obligatoire)..."
            value={overrideReason}
            onChange={(e) => setOverrideReason(e.target.value)}
            className="bg-slate-800 border-slate-700"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOverrideJob(null)}>Annuler</Button>
            <Button variant="destructive" onClick={handleOverride} disabled={!overrideReason.trim() || isProcessing}>
              Confirmer Override
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
