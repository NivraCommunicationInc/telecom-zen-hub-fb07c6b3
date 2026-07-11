/**
 * AccountFraudRiskDialog — Phase 20.
 * Risk score assessment + fraud incident log for staff.
 */
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldAlert, AlertTriangle, CheckCircle2, XCircle, ArrowUpCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  clientUserId: string;
  clientName: string;
  accountId: string | null;
}

interface Incident {
  id: string;
  incident_type: string;
  severity: string;
  description: string;
  status: string;
  risk_score_delta: number;
  resolution_notes: string | null;
  detected_at: string;
  resolved_at: string | null;
  created_by_email: string | null;
}

interface RiskScore {
  id: string;
  current_score: number;
  risk_level: string;
  factors: any[];
  notes: string | null;
  last_assessed_at: string;
  last_assessed_by_email: string | null;
}

interface Preset {
  key: string;
  label: string;
  severity: string;
}

const SEVERITY_COLORS: Record<string, string> = {
  low: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  medium: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  high: "bg-orange-500/10 text-orange-400 border-orange-500/30",
  critical: "bg-red-500/10 text-red-400 border-red-500/30",
};

const STATUS_COLORS: Record<string, string> = {
  open: "bg-red-500/10 text-red-400 border-red-500/30",
  investigating: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  escalated: "bg-orange-500/10 text-orange-400 border-orange-500/30",
  resolved: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  false_positive: "bg-slate-500/10 text-slate-400 border-slate-500/30",
};

export function AccountFraudRiskDialog({ open, onClose, clientUserId, clientName, accountId }: Props) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [score, setScore] = useState<RiskScore | null>(null);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [tab, setTab] = useState<"score" | "incidents" | "new">("score");

  // New incident form
  const [incidentType, setIncidentType] = useState("");
  const [severity, setSeverity] = useState<string>("medium");
  const [description, setDescription] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [reason, setReason] = useState("");

  // Score form
  const [scoreValue, setScoreValue] = useState<number>(0);
  const [riskLevel, setRiskLevel] = useState<string>("low");
  const [scoreNotes, setScoreNotes] = useState("");
  const [scoreReason, setScoreReason] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("fraud-risk-actions", {
        body: { action: "list", clientId: clientUserId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setIncidents(data.incidents ?? []);
      setScore(data.score ?? null);
      setPresets(data.presets ?? []);
      if (data.score) {
        setScoreValue(data.score.current_score);
        setRiskLevel(data.score.risk_level);
        setScoreNotes(data.score.notes ?? "");
      }
    } catch (e: any) {
      // Extract actual server error if available
      let msg = e?.message || "Erreur";
      try { const b = await (e?.context as Response)?.json?.(); if (b?.error) msg = b.error; } catch {}
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && clientUserId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, clientUserId]);

  const handleCreateIncident = async () => {
    if (!incidentType || !description.trim() || !reason.trim()) {
      toast.error("Type, description et motif requis");
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("fraud-risk-actions", {
        body: {
          action: "create_incident",
          clientId: clientUserId,
          accountId,
          incidentType,
          severity,
          description: description.trim(),
          internalNotes: internalNotes.trim() || undefined,
          reason: reason.trim(),
          idempotency_key: crypto.randomUUID(),
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Incident enregistré");
      setIncidentType("");
      setSeverity("medium");
      setDescription("");
      setInternalNotes("");
      setReason("");
      setTab("incidents");
      await load();
    } catch (e: any) {
      // Extract actual server error if available
      let msg = e?.message || "Erreur";
      try { const b = await (e?.context as Response)?.json?.(); if (b?.error) msg = b.error; } catch {}
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (incidentId: string, newStatus: string) => {
    const needsNotes = newStatus === "resolved" || newStatus === "false_positive";
    const resNotes = needsNotes ? window.prompt("Notes de résolution (obligatoire)") : undefined;
    if (needsNotes && !resNotes?.trim()) return;
    const r = window.prompt("Motif du changement (obligatoire)");
    if (!r?.trim()) return;

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("fraud-risk-actions", {
        body: { action: "update_status", incidentId, status: newStatus, resolutionNotes: resNotes, reason: r.trim() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Incident mis à jour");
      await load();
    } catch (e: any) {
      // Extract actual server error if available
      let msg = e?.message || "Erreur";
      try { const b = await (e?.context as Response)?.json?.(); if (b?.error) msg = b.error; } catch {}
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveScore = async () => {
    if (!scoreReason.trim()) {
      toast.error("Motif requis");
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("fraud-risk-actions", {
        body: {
          action: "upsert_score",
          clientId: clientUserId,
          accountId,
          score: scoreValue,
          riskLevel,
          notes: scoreNotes.trim() || undefined,
          reason: scoreReason.trim(),
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Score de risque enregistré");
      setScoreReason("");
      await load();
    } catch (e: any) {
      // Extract actual server error if available
      let msg = e?.message || "Erreur";
      try { const b = await (e?.context as Response)?.json?.(); if (b?.error) msg = b.error; } catch {}
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("fr-CA", { dateStyle: "short", timeStyle: "short" });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-red-400" />
            Évaluation de risque & fraude
          </DialogTitle>
          <DialogDescription>
            {clientName} — score, incidents et investigations
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="score">Score</TabsTrigger>
              <TabsTrigger value="incidents">
                Incidents {incidents.length > 0 && <Badge variant="secondary" className="ml-2">{incidents.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="new">Nouveau</TabsTrigger>
            </TabsList>

            {/* SCORE TAB */}
            <TabsContent value="score" className="space-y-4">
              {score ? (
                <div className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Score actuel</p>
                      <p className="text-3xl font-bold">{score.current_score}/100</p>
                    </div>
                    <Badge className={SEVERITY_COLORS[score.risk_level]}>
                      Niveau: {score.risk_level}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Dernière éval.: {fmt(score.last_assessed_at)} {score.last_assessed_by_email && `— ${score.last_assessed_by_email}`}
                  </p>
                  {score.notes && <p className="text-sm mt-2">{score.notes}</p>}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">Aucun score enregistré.</p>
              )}

              <div className="space-y-3 border-t border-border pt-4">
                <p className="text-sm font-semibold">Mettre à jour le score</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Score (0-100)</Label>
                    <Input
                      type="number" min={0} max={100}
                      value={scoreValue}
                      onChange={(e) => setScoreValue(Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <Label>Niveau de risque</Label>
                    <Select value={riskLevel} onValueChange={setRiskLevel}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Bas</SelectItem>
                        <SelectItem value="medium">Moyen</SelectItem>
                        <SelectItem value="high">Élevé</SelectItem>
                        <SelectItem value="critical">Critique</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Notes (facultatif)</Label>
                  <Textarea value={scoreNotes} onChange={(e) => setScoreNotes(e.target.value)} rows={2} />
                </div>
                <div>
                  <Label>Motif (obligatoire)</Label>
                  <Input value={scoreReason} onChange={(e) => setScoreReason(e.target.value)} placeholder="Justification de l'évaluation" />
                </div>
                <Button onClick={handleSaveScore} disabled={submitting} className="w-full">
                  {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Enregistrer le score
                </Button>
              </div>
            </TabsContent>

            {/* INCIDENTS TAB */}
            <TabsContent value="incidents" className="space-y-3 max-h-[60vh] overflow-y-auto">
              {incidents.length === 0 ? (
                <p className="text-sm text-muted-foreground italic py-4 text-center">Aucun incident.</p>
              ) : (
                incidents.map((inc) => (
                  <div key={inc.id} className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className={SEVERITY_COLORS[inc.severity]}>{inc.severity}</Badge>
                          <Badge variant="outline" className={STATUS_COLORS[inc.status]}>{inc.status}</Badge>
                          <span className="text-xs text-muted-foreground">+{inc.risk_score_delta} pts</span>
                        </div>
                        <p className="text-sm font-medium mt-1">{inc.incident_type}</p>
                        <p className="text-xs text-muted-foreground">{inc.description}</p>
                        {inc.resolution_notes && (
                          <p className="text-xs italic mt-1 text-emerald-400">Résolution: {inc.resolution_notes}</p>
                        )}
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {fmt(inc.detected_at)} {inc.created_by_email && `— ${inc.created_by_email}`}
                        </p>
                      </div>
                    </div>
                    {(inc.status === "open" || inc.status === "investigating") && (
                      <div className="flex gap-1 flex-wrap pt-1 border-t border-border">
                        {inc.status === "open" && (
                          <Button size="sm" variant="outline" onClick={() => handleUpdateStatus(inc.id, "investigating")} disabled={submitting}>
                            <AlertTriangle className="h-3 w-3 mr-1" /> Investiguer
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => handleUpdateStatus(inc.id, "resolved")} disabled={submitting}>
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Résoudre
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleUpdateStatus(inc.id, "false_positive")} disabled={submitting}>
                          <XCircle className="h-3 w-3 mr-1" /> Faux positif
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleUpdateStatus(inc.id, "escalated")} disabled={submitting}>
                          <ArrowUpCircle className="h-3 w-3 mr-1" /> Escalader
                        </Button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </TabsContent>

            {/* NEW INCIDENT TAB */}
            <TabsContent value="new" className="space-y-3">
              <div>
                <Label>Type d'incident</Label>
                <Select value={incidentType} onValueChange={(v) => {
                  setIncidentType(v);
                  const p = presets.find((x) => x.key === v);
                  if (p) setSeverity(p.severity);
                }}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner un type" /></SelectTrigger>
                  <SelectContent>
                    {presets.map((p) => (
                      <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Sévérité</Label>
                <Select value={severity} onValueChange={setSeverity}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Basse (+5 pts)</SelectItem>
                    <SelectItem value="medium">Moyenne (+10 pts)</SelectItem>
                    <SelectItem value="high">Élevée (+20 pts)</SelectItem>
                    <SelectItem value="critical">Critique (+30 pts)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Description</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Décrire l'incident…" />
              </div>
              <div>
                <Label>Notes internes (facultatif)</Label>
                <Textarea value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} rows={2} />
              </div>
              <div>
                <Label>Motif (obligatoire)</Label>
                <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Raison de l'enregistrement" />
              </div>
              <Button onClick={handleCreateIncident} disabled={submitting} className="w-full">
                {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Enregistrer l'incident
              </Button>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
