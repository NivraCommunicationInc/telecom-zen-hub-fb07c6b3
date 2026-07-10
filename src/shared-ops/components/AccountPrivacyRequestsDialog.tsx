/**
 * AccountPrivacyRequestsDialog — Loi 25 privacy requests (Module 38 Phase C).
 *
 * Frontend is a thin client of the canonical Edge Function
 * `privacy-requests-actions`. No direct writes to `privacy_requests`.
 * All identity / IP / UA / hashes / timestamps are generated server-side.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Loader2, ShieldQuestion, Plus, AlertCircle, CheckCircle2, XCircle, Clock, FileSearch } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { callCoreAction } from "@/core-app/lib/callCoreAction";
import { toast } from "sonner";
import { z } from "zod";

interface Props {
  open: boolean;
  onClose: () => void;
  clientUserId: string;
  clientName: string;
  accountId: string | null;
}

const REQUEST_TYPES = [
  { value: "access", label: "Accès aux renseignements" },
  { value: "rectification", label: "Rectification de données" },
  { value: "deletion", label: "Suppression / Droit à l'oubli" },
  { value: "portability", label: "Portabilité des données" },
  { value: "withdrawal_consent", label: "Retrait du consentement" },
  { value: "complaint", label: "Plainte confidentialité" },
] as const;

const STATUS_META: Record<string, { label: string; color: string; icon: any }> = {
  received: { label: "Reçue", color: "bg-blue-500/10 text-blue-300 border-blue-500/30", icon: Clock },
  in_review: { label: "En traitement", color: "bg-amber-500/10 text-amber-300 border-amber-500/30", icon: FileSearch },
  awaiting_client: { label: "En attente client", color: "bg-violet-500/10 text-violet-300 border-violet-500/30", icon: Clock },
  completed: { label: "Complétée", color: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30", icon: CheckCircle2 },
  refused: { label: "Refusée", color: "bg-red-500/10 text-red-300 border-red-500/30", icon: XCircle },
  cancelled: { label: "Annulée", color: "bg-zinc-500/10 text-zinc-300 border-zinc-500/30", icon: XCircle },
};

// ── Frontend Zod alignment (server remains source of truth) ────────────────
const RequestTypeEnum = z.enum([
  "access", "rectification", "deletion", "portability", "withdrawal_consent", "complaint",
]);
const StatusEnum = z.enum([
  "received", "in_review", "awaiting_client", "completed", "refused", "cancelled",
]);
const CreateSchema = z.object({
  requestType: RequestTypeEnum,
  description: z.string().trim().min(1, "Description requise").max(5000, "Max 5000 caractères"),
  reason: z.string().trim().min(3, "Motif requis (3+ car.)").max(2000),
  internalNotes: z.string().trim().max(5000).optional().nullable(),
});
const UpdateSchema = z
  .object({
    status: StatusEnum,
    reason: z.string().trim().min(3, "Motif requis (3+ car.)").max(2000),
    refusalReason: z.string().trim().max(2000).optional().nullable(),
  })
  .superRefine((v, ctx) => {
    if (v.status === "refused" && !v.refusalReason?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["refusalReason"], message: "Motif de refus requis" });
    }
  });

type PendingTransition = { requestId: string; status: string } | null;

export function AccountPrivacyRequestsDialog({ open, onClose, clientUserId, clientName, accountId }: Props) {
  const [tab, setTab] = useState("list");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [requests, setRequests] = useState<any[]>([]);

  // Create form
  const [requestType, setRequestType] = useState<z.infer<typeof RequestTypeEnum>>("access");
  const [description, setDescription] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [reason, setReason] = useState("");
  const createIdemRef = useRef<string>(crypto.randomUUID());

  // Transition dialog
  const [pending, setPending] = useState<PendingTransition>(null);
  const [transitionReason, setTransitionReason] = useState("");
  const [refusalReason, setRefusalReason] = useState("");
  const transitionIdemRef = useRef<string>(crypto.randomUUID());

  const pendingMeta = useMemo(
    () => (pending ? STATUS_META[pending.status] ?? STATUS_META.received : null),
    [pending],
  );

  const load = async () => {
    if (!open) return;
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("privacy-requests-actions", {
      body: { action: "list", clientId: clientUserId },
    });
    setLoading(false);
    if (error) { toast.error((error as any)?.message ?? "Erreur de chargement"); return; }
    if ((data as any)?.error) { toast.error((data as any).error); return; }
    setRequests((data as any)?.requests ?? []);
  };

  useEffect(() => {
    if (!open) return;
    createIdemRef.current = crypto.randomUUID();
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, clientUserId]);

  const create = async () => {
    const parsed = CreateSchema.safeParse({ requestType, description, reason, internalNotes });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Validation échouée");
      return;
    }
    if (submitting) return;
    setSubmitting(true);
    const res = await callCoreAction("privacy-requests-actions", {
      action: "create",
      clientId: clientUserId,
      accountId: accountId ?? null,
      requestType: parsed.data.requestType,
      description: parsed.data.description,
      internalNotes: parsed.data.internalNotes ?? null,
      reason: parsed.data.reason,
      idempotencyKey: createIdemRef.current,
    }, {
      reason: parsed.data.reason,
      successMessage: "Demande Loi 25 créée",
      skipInvalidation: true,
    });
    setSubmitting(false);
    if (!res.ok) return;
    // Rotate idempotency key AFTER a successful submission.
    createIdemRef.current = crypto.randomUUID();
    setDescription(""); setInternalNotes(""); setReason("");
    setTab("list");
    load();
  };

  const openTransition = (requestId: string, status: string) => {
    setPending({ requestId, status });
    setTransitionReason("");
    setRefusalReason("");
    transitionIdemRef.current = crypto.randomUUID();
  };

  const confirmTransition = async () => {
    if (!pending) return;
    const parsed = UpdateSchema.safeParse({
      status: pending.status,
      reason: transitionReason,
      refusalReason: pending.status === "refused" ? refusalReason : null,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Validation échouée");
      return;
    }
    if (submitting) return;
    setSubmitting(true);
    const res = await callCoreAction("privacy-requests-actions", {
      action: "update_status",
      requestId: pending.requestId,
      status: parsed.data.status,
      reason: parsed.data.reason,
      refusalReason: parsed.data.refusalReason ?? null,
      idempotencyKey: transitionIdemRef.current,
    }, {
      reason: parsed.data.reason,
      successMessage: "Statut mis à jour",
      skipInvalidation: true,
    });
    setSubmitting(false);
    if (!res.ok) return;
    setPending(null);
    load();
  };

  const daysUntilDue = (dueAt: string) => {
    const diff = new Date(dueAt).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ShieldQuestion className="h-5 w-5" /> Demandes Loi 25 — {clientName}</DialogTitle>
            <DialogDescription>Conformité Loi 25 (Québec) — délai légal de 30 jours pour répondre.</DialogDescription>
          </DialogHeader>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="list">Demandes ({requests.length})</TabsTrigger>
              <TabsTrigger value="new"><Plus className="h-3 w-3 mr-1" /> Nouvelle</TabsTrigger>
            </TabsList>

            <TabsContent value="list" className="space-y-2 max-h-[400px] overflow-y-auto">
              {loading && <Loader2 className="h-5 w-5 animate-spin mx-auto" />}
              {!loading && requests.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">Aucune demande de confidentialité enregistrée.</p>
              )}
              {requests.map((r) => {
                const meta = STATUS_META[r.status] ?? STATUS_META.received;
                const Icon = meta.icon;
                const typeLabel = REQUEST_TYPES.find((t) => t.value === r.request_type)?.label ?? r.request_type;
                const days = daysUntilDue(r.due_at);
                const isActive = !["completed", "refused", "cancelled"].includes(r.status);
                const overdue = isActive && days < 0;
                return (
                  <div key={r.id} className="rounded-lg border border-border bg-background/50 p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold">{typeLabel}</span>
                          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${meta.color}`}>
                            <Icon className="h-3 w-3" /> {meta.label}
                          </span>
                          {isActive && (
                            <span className={`text-[10px] font-medium ${overdue ? "text-red-400" : days <= 7 ? "text-amber-400" : "text-muted-foreground"}`}>
                              {overdue ? `Hors délai (${Math.abs(days)}j)` : `${days}j restants`}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{r.description}</p>
                        {r.refusal_reason && (
                          <p className="text-xs text-red-400 mt-1"><AlertCircle className="inline h-3 w-3 mr-1" />Refus: {r.refusal_reason}</p>
                        )}
                        {r.internal_notes && (
                          <p className="text-[11px] text-muted-foreground mt-1 italic">Note: {r.internal_notes}</p>
                        )}
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Reçue {new Date(r.received_at).toLocaleDateString("fr-CA")} · Échéance {new Date(r.due_at).toLocaleDateString("fr-CA")}
                          {r.created_by_email && ` · par ${r.created_by_email}`}
                        </p>
                      </div>
                    </div>
                    {isActive && (
                      <div className="flex flex-wrap gap-1">
                        {r.status === "received" && (
                          <Button size="sm" variant="outline" onClick={() => openTransition(r.id, "in_review")}>Démarrer</Button>
                        )}
                        {(r.status === "in_review" || r.status === "received") && (
                          <Button size="sm" variant="outline" onClick={() => openTransition(r.id, "awaiting_client")}>En attente client</Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => openTransition(r.id, "completed")}>Compléter</Button>
                        <Button size="sm" variant="destructive" onClick={() => openTransition(r.id, "refused")}>Refuser</Button>
                        <Button size="sm" variant="ghost" onClick={() => openTransition(r.id, "cancelled")}>Annuler</Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </TabsContent>

            <TabsContent value="new" className="space-y-3">
              <div>
                <label className="text-xs font-medium">Type de demande *</label>
                <select value={requestType} onChange={(e) => setRequestType(e.target.value as any)}
                  className="w-full mt-1 rounded-md border border-border bg-background px-3 py-2 text-sm">
                  {REQUEST_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium">Description de la demande *</label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4}
                  maxLength={5000}
                  placeholder="Détails de ce que le client demande..." />
              </div>
              <div>
                <label className="text-xs font-medium">Notes internes (optionnel)</label>
                <Textarea value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} rows={2}
                  maxLength={5000} />
              </div>
              <div>
                <label className="text-xs font-medium">Motif d'enregistrement (audit) *</label>
                <Input value={reason} onChange={(e) => setReason(e.target.value)}
                  maxLength={2000}
                  placeholder="Ex: Reçu par téléphone le..." />
              </div>
              <div className="rounded-md bg-amber-500/10 border border-amber-500/30 p-2 text-xs text-amber-300">
                <AlertCircle className="inline h-3 w-3 mr-1" />
                Délai légal de 30 jours déclenché automatiquement à la création.
              </div>
              <Button onClick={create} disabled={submitting} className="w-full">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enregistrer la demande"}
              </Button>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Transition dialog — replaces window.prompt */}
      <Dialog open={!!pending} onOpenChange={(o) => !o && !submitting && setPending(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Transition — {pendingMeta?.label ?? ""}</DialogTitle>
            <DialogDescription>
              Motif obligatoire (journal d'audit Loi 25).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium">Motif *</label>
              <Textarea
                value={transitionReason}
                onChange={(e) => setTransitionReason(e.target.value)}
                rows={3}
                maxLength={2000}
                placeholder="Justification du changement de statut..."
              />
            </div>
            {pending?.status === "refused" && (
              <div>
                <label className="text-xs font-medium">Motif de refus (visible au dossier) *</label>
                <Textarea
                  value={refusalReason}
                  onChange={(e) => setRefusalReason(e.target.value)}
                  rows={3}
                  maxLength={2000}
                  placeholder="Motif communicable au client..."
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(null)} disabled={submitting}>Annuler</Button>
            <Button onClick={confirmTransition} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
