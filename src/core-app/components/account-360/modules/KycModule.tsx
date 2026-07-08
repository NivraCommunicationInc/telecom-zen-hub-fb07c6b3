/**
 * KycModule — Client 360 KYC command center.
 *
 * Orchestre le workflow KYC canonique déjà existant dans Nivra :
 *  - Tables : kyc_verifications (demande admin niveau client),
 *             identity_verification_sessions (soumissions client),
 *             identity_documents (fichiers reçus),
 *             identity_verification_events (journal),
 *             admin_audit_log (audit staff via ClientModuleShell).
 *  - Edge Function : kyc-account-actions (toutes les actions).
 *  - Templates emails officiels : client_kyc_requested, client_kyc_approved,
 *             client_kyc_rejected, client_kyc_additional_docs.
 *
 * Aucun système parallèle — le module est une interface de contrôle.
 */
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ClientModuleShell, ImpactRow, ImpactedTable, PlannedEmail } from "./ClientModuleShell";
import { callCoreAction } from "@/core-app/lib/callCoreAction";
import { useModuleRealtime } from "@/core-app/hooks/useModuleRealtime";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ShieldCheck, ShieldAlert, ShieldQuestion, Send, RefreshCw, CheckCircle2,
  XCircle, FilePlus2, Eye, Info, Clock, User, FileText, Calendar,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  accountId: string;
  clientId: string;
  clientName: string;
  clientEmail?: string | null;
}

const ID_TYPES: { value: string; label: string }[] = [
  { value: "drivers_license", label: "Permis de conduire" },
  { value: "passport", label: "Passeport" },
  { value: "provincial_id", label: "Carte d'identité provinciale" },
  { value: "health_card", label: "Carte d'assurance-maladie" },
  { value: "other", label: "Autre" },
];

const STATUS_BADGE: Record<string, { label: string; variant: any }> = {
  pending: { label: "En attente", variant: "secondary" },
  submitted: { label: "Soumis", variant: "default" },
  in_review: { label: "En révision", variant: "default" },
  additional_required: { label: "Docs additionnels", variant: "outline" },
  additional_docs_required: { label: "Docs additionnels", variant: "outline" },
  approved: { label: "Approuvé", variant: "default" },
  rejected: { label: "Rejeté", variant: "destructive" },
  expired: { label: "Expiré", variant: "outline" },
};

const fmtDate = (d: string | null | undefined) =>
  !d ? "—" : format(new Date(d), "dd MMM yyyy HH:mm", { locale: fr });

type ActionMode =
  | "idle"
  | "request"
  | "resend"
  | "approve"
  | "reject"
  | "additional"
  | "view_docs";

export function KycModule({ open, onClose, accountId, clientId, clientName, clientEmail }: Props) {
  const qc = useQueryClient();

  // Realtime sync
  useModuleRealtime({
    tables: ["kyc_verifications", "identity_verification_sessions", "identity_verification_events"],
    clientId,
  });

  // ── STATE actuelle: verifications côté admin ─────────
  const verificationsQ = useQuery({
    queryKey: ["core-kyc-module-verifications", clientId],
    enabled: open && !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kyc_verifications")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
  });

  // Sessions client (soumissions)
  const sessionsQ = useQuery({
    queryKey: ["core-kyc-module-sessions", clientId],
    enabled: open && !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("identity_verification_sessions")
        .select("*")
        .eq("user_id", clientId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
  });

  const latestVerification = verificationsQ.data?.[0];
  const latestSession = sessionsQ.data?.[0];
  const selectedSessionId = latestSession?.id ?? null;

  // Documents rattachés à la session courante
  const docsQ = useQuery({
    queryKey: ["core-kyc-module-docs", selectedSessionId],
    enabled: open && !!selectedSessionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("identity_documents")
        .select("id, doc_type, mime_type, file_size_bytes, created_at")
        .eq("kyc_session_id", selectedSessionId as string);
      if (error) throw error;
      return data || [];
    },
  });

  // Événements (historique validations)
  const eventsQ = useQuery({
    queryKey: ["core-kyc-module-events", clientId],
    enabled: open && !!clientId,
    queryFn: async () => {
      const sessionIds = (sessionsQ.data ?? []).map((s: any) => s.id);
      if (sessionIds.length === 0) return [];
      const { data, error } = await supabase
        .from("identity_verification_events")
        .select("*")
        .in("session_id", sessionIds)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  // Statut global calculé
  const kycState = useMemo(() => {
    if (latestSession?.status === "approved") return { label: "Vérifié", color: "text-emerald-500", icon: ShieldCheck };
    if (latestSession?.status === "rejected") return { label: "Rejeté", color: "text-red-500", icon: ShieldAlert };
    if (latestSession?.status === "additional_required") return { label: "Docs additionnels requis", color: "text-amber-500", icon: ShieldQuestion };
    if (latestSession?.status === "submitted" || latestSession?.status === "in_review") return { label: "En révision", color: "text-blue-500", icon: Clock };
    if (latestVerification?.status === "pending") return { label: "Demande envoyée", color: "text-amber-500", icon: Clock };
    return { label: "Non vérifié", color: "text-muted-foreground", icon: ShieldQuestion };
  }, [latestSession, latestVerification]);

  const StateIcon = kycState.icon;

  // ── ACTIONS ────────────────────────────────────────────
  const [mode, setMode] = useState<ActionMode>("idle");
  const [idType, setIdType] = useState<string>("drivers_license");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [reviewReason, setReviewReason] = useState("");
  const [additionalDocs, setAdditionalDocs] = useState("");
  const [loading, setLoading] = useState(false);
  const [signedUrls, setSignedUrls] = useState<Array<{ id: string; doc_type: string; url: string | null }> | null>(null);

  const resetActionState = () => {
    setMode("idle");
    setReason("");
    setNotes("");
    setReviewReason("");
    setAdditionalDocs("");
  };

  const clientContext = (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
      <div>
        <div className="text-[10px] uppercase text-muted-foreground">Client</div>
        <div className="font-semibold flex items-center gap-1"><User className="h-3 w-3" /> {clientName}</div>
      </div>
      <div>
        <div className="text-[10px] uppercase text-muted-foreground">Courriel</div>
        <div className="font-medium truncate">{clientEmail ?? "—"}</div>
      </div>
      <div>
        <div className="text-[10px] uppercase text-muted-foreground">Statut KYC</div>
        <div className={cn("font-semibold flex items-center gap-1", kycState.color)}>
          <StateIcon className="h-3 w-3" /> {kycState.label}
        </div>
      </div>
      <div>
        <div className="text-[10px] uppercase text-muted-foreground">Dernière activité</div>
        <div className="font-medium">{fmtDate(latestSession?.updated_at || latestVerification?.updated_at)}</div>
      </div>
    </div>
  );

  // ═══════ Onglet ÉTAT ═══════
  const stateTab = (
    <div className="space-y-4 text-sm">
      <section>
        <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Dernière demande admin</h4>
        {!latestVerification && <p className="text-muted-foreground">Aucune demande de vérification n'a été envoyée.</p>}
        {latestVerification && (
          <div className="border rounded-md p-3 bg-background/40 space-y-1">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-medium">{latestVerification.reason || "Vérification d'identité"}</div>
                <div className="text-xs text-muted-foreground">
                  Type demandé : {latestVerification.requested_id_type} · Créée {fmtDate(latestVerification.created_at)}
                </div>
                {latestVerification.expires_at && (
                  <div className="text-xs text-muted-foreground">Expire {fmtDate(latestVerification.expires_at)}</div>
                )}
              </div>
              <Badge variant={STATUS_BADGE[latestVerification.status]?.variant ?? "secondary"}>
                {STATUS_BADGE[latestVerification.status]?.label ?? latestVerification.status}
              </Badge>
            </div>
            {latestVerification.rejection_reason && (
              <div className="text-xs text-red-500">Refus : {latestVerification.rejection_reason}</div>
            )}
          </div>
        )}
      </section>

      <section>
        <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Dernière soumission client (session)</h4>
        {!latestSession && <p className="text-muted-foreground">Le client n'a rien soumis.</p>}
        {latestSession && (
          <div className="border rounded-md p-3 bg-background/40 space-y-2">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-medium">Session {latestSession.id.slice(0, 8)}</div>
                <div className="text-xs text-muted-foreground">
                  Type: {latestSession.id_type || "—"} · Prov: {latestSession.id_province || "—"}
                </div>
                <div className="text-xs text-muted-foreground">
                  Soumis {fmtDate(latestSession.submitted_at)} · Révisé {fmtDate(latestSession.reviewed_at)}
                </div>
              </div>
              <Badge variant={STATUS_BADGE[latestSession.status]?.variant ?? "secondary"}>
                {STATUS_BADGE[latestSession.status]?.label ?? latestSession.status}
              </Badge>
            </div>
            {latestSession.review_reason && (
              <div className="text-xs text-amber-500">Note révision : {latestSession.review_reason}</div>
            )}

            <div className="border-t pt-2">
              <div className="text-xs font-semibold mb-1 flex items-center gap-1">
                <FileText className="h-3 w-3" /> Documents reçus ({docsQ.data?.length ?? 0})
              </div>
              {docsQ.isLoading && <p className="text-xs text-muted-foreground">Chargement…</p>}
              {docsQ.data && docsQ.data.length === 0 && <p className="text-xs text-muted-foreground">Aucun document.</p>}
              <ul className="space-y-1">
                {docsQ.data?.map((d: any) => (
                  <li key={d.id} className="text-xs flex justify-between border rounded px-2 py-1">
                    <span>{d.doc_type} <span className="text-muted-foreground">({d.mime_type || "?"})</span></span>
                    <span className="text-muted-foreground">{d.file_size_bytes ? `${Math.round(d.file_size_bytes / 1024)} Ko` : ""}</span>
                  </li>
                ))}
              </ul>
              {docsQ.data && docsQ.data.length > 0 && (
                <Button size="sm" variant="outline" className="mt-2" onClick={handleViewDocs} disabled={loading}>
                  <Eye className="h-3 w-3 mr-1" /> Générer URLs signées (5 min)
                </Button>
              )}
              {signedUrls && signedUrls.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {signedUrls.map((s) => (
                    <li key={s.id} className="text-xs">
                      <a href={s.url ?? "#"} target="_blank" rel="noreferrer" className="text-primary underline">
                        {s.doc_type}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </section>

      <section>
        <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Toutes les demandes ({verificationsQ.data?.length ?? 0})</h4>
        <div className="space-y-1">
          {verificationsQ.data?.map((v: any) => (
            <div key={v.id} className="text-xs flex justify-between border rounded px-2 py-1">
              <span>{fmtDate(v.created_at)} — {v.requested_id_type}</span>
              <Badge variant={STATUS_BADGE[v.status]?.variant ?? "secondary"}>
                {STATUS_BADGE[v.status]?.label ?? v.status}
              </Badge>
            </div>
          ))}
        </div>
      </section>
    </div>
  );

  // ═══════ Onglet HISTORIQUE ═══════
  const historyTab = (
    <div className="space-y-2 text-sm">
      {eventsQ.isLoading && <p className="text-muted-foreground">Chargement…</p>}
      {eventsQ.data && eventsQ.data.length === 0 && <p className="text-muted-foreground">Aucun événement KYC.</p>}
      {eventsQ.data?.map((e: any) => (
        <div key={e.id} className="border rounded p-2 text-xs bg-background/40">
          <div className="flex justify-between">
            <span className="font-medium">{e.event_type}</span>
            <span className="text-muted-foreground">{fmtDate(e.created_at)}</span>
          </div>
          <div className="text-muted-foreground">Acteur : {e.actor_role || "system"}</div>
          {e.details && Object.keys(e.details).length > 0 && (
            <pre className="text-[10px] mt-1 bg-muted/40 p-1 rounded overflow-auto max-h-20">
              {JSON.stringify(e.details, null, 2)}
            </pre>
          )}
        </div>
      ))}
    </div>
  );

  // ═══════ Onglet ACTIONS ═══════
  const canApprove = !!latestSession && ["submitted", "in_review"].includes(latestSession.status);
  const canReject = canApprove;
  const canAdditional = canApprove;
  const canResend = !!latestVerification && !["approved", "rejected"].includes(latestVerification.status);

  const currentActionMeta = getActionMeta(mode, {
    clientEmail,
    sessionId: latestSession?.id,
    verificationId: latestVerification?.id,
    idType,
    additionalDocs,
  });

  const actionsTab = (
    <div className="space-y-4 text-sm">
      <Alert className="bg-primary/5 border-primary/30">
        <Info className="h-4 w-4" />
        <AlertDescription>
          Choisissez une action. Aucune écriture avant <b>Confirmer</b>. Chaque action est journalisée dans
          <code className="mx-1 text-xs">admin_audit_log</code> et
          <code className="mx-1 text-xs">identity_verification_events</code>.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        <ActionCard active={mode === "request"} onClick={() => setMode("request")}
          icon={Send} title="Demander une vérification"
          desc="Crée une kyc_verifications + email officiel au client." />
        <ActionCard active={mode === "resend"} disabled={!canResend} onClick={() => setMode("resend")}
          icon={RefreshCw} title="Relancer"
          desc="Renvoie l'email de demande active." />
        <ActionCard active={mode === "additional"} disabled={!canAdditional} onClick={() => setMode("additional")}
          icon={FilePlus2} title="Documents supplémentaires"
          desc="Demande des pièces additionnelles sur la session en cours." />
        <ActionCard active={mode === "approve"} disabled={!canApprove} onClick={() => setMode("approve")}
          icon={CheckCircle2} title="Approuver"
          desc="Approuve la session et clôt les demandes liées." />
        <ActionCard active={mode === "reject"} disabled={!canReject} onClick={() => setMode("reject")}
          icon={XCircle} title="Rejeter"
          desc="Motif obligatoire. Notifie le client." />
      </div>

      {mode === "request" && (
        <div className="space-y-2 border rounded-md p-3 bg-muted/30">
          <div>
            <Label>Type de pièce demandée</Label>
            <Select value={idType} onValueChange={setIdType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ID_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Raison de la demande</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder="Ex. Vérification requise pour activation" />
          </div>
          <div>
            <Label>Notes internes (optionnel)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
      )}

      {mode === "reject" && (
        <div className="space-y-2 border rounded-md p-3 bg-muted/30">
          <Label>Motif de refus (obligatoire, envoyé au client)</Label>
          <Textarea value={reviewReason} onChange={(e) => setReviewReason(e.target.value)} rows={3}
            placeholder="Ex. Document illisible — photo floue." />
        </div>
      )}

      {mode === "additional" && (
        <div className="space-y-2 border rounded-md p-3 bg-muted/30">
          <Label>Instructions au client (obligatoire)</Label>
          <Textarea value={reviewReason} onChange={(e) => setReviewReason(e.target.value)} rows={2}
            placeholder="Ex. Merci de fournir également un justificatif de domicile." />
          <Label>Liste des documents attendus (séparés par des virgules)</Label>
          <Input value={additionalDocs} onChange={(e) => setAdditionalDocs(e.target.value)}
            placeholder="Justificatif de domicile, Selfie tenant la pièce" />
        </div>
      )}

      {mode === "approve" && (
        <div className="space-y-2 border rounded-md p-3 bg-muted/30">
          <Label>Note interne (optionnel)</Label>
          <Textarea value={reviewReason} onChange={(e) => setReviewReason(e.target.value)} rows={2} />
        </div>
      )}
    </div>
  );

  // ── Impact preview ──
  const impact: ImpactRow[] = currentActionMeta.impact;
  const impactedTables: ImpactedTable[] = currentActionMeta.tables;
  const plannedEmails: PlannedEmail[] = currentActionMeta.emails;

  async function handleViewDocs() {
    if (!latestSession) return;
    setLoading(true);
    const res = await callCoreAction<{ ok: boolean; documents: any[] }>(
      "kyc-account-actions",
      {
        action: "generate_signed_urls",
        client_user_id: clientId,
        session_id: latestSession.id,
      },
      {
        reason: "Consultation des documents KYC depuis Client 360",
        successMessage: "URLs signées générées (5 min)",
        queryClient: qc,
      },
    );
    setLoading(false);
    if (res.ok && res.data?.documents) setSignedUrls(res.data.documents);
  }

  const handleConfirm = async (motif: string) => {
    if (mode === "idle") { toast.error("Sélectionne une action"); return; }
    setLoading(true);

    let payload: Record<string, unknown> = { client_user_id: clientId, account_id: accountId };
    let successMsg = "Action KYC effectuée";

    switch (mode) {
      case "request":
        payload = {
          ...payload,
          action: "request_verification",
          requested_id_type: idType,
          reason: reason || "Vérification d'identité requise",
          notes: notes || null,
        };
        successMsg = "Demande KYC envoyée au client";
        break;
      case "resend":
        if (!latestVerification) { setLoading(false); toast.error("Aucune demande à relancer"); return; }
        payload = { ...payload, action: "resend_request", verification_id: latestVerification.id };
        successMsg = "Email de relance envoyé";
        break;
      case "approve":
        if (!latestSession) { setLoading(false); toast.error("Aucune session à approuver"); return; }
        payload = { ...payload, action: "approve_session", session_id: latestSession.id, review_reason: reviewReason || null };
        successMsg = "Identité approuvée";
        break;
      case "reject":
        if (!latestSession) { setLoading(false); toast.error("Aucune session à rejeter"); return; }
        if (!reviewReason.trim()) { setLoading(false); toast.error("Motif de refus obligatoire"); return; }
        payload = { ...payload, action: "reject_session", session_id: latestSession.id, review_reason: reviewReason };
        successMsg = "Identité rejetée — client notifié";
        break;
      case "additional":
        if (!latestSession) { setLoading(false); toast.error("Aucune session active"); return; }
        if (!reviewReason.trim()) { setLoading(false); toast.error("Instructions obligatoires"); return; }
        payload = {
          ...payload,
          action: "request_additional_docs",
          session_id: latestSession.id,
          review_reason: reviewReason,
          required_docs: additionalDocs.split(",").map((s) => s.trim()).filter(Boolean),
        };
        successMsg = "Demande de documents supplémentaires envoyée";
        break;
    }

    const res = await callCoreAction("kyc-account-actions", payload, {
      reason: motif,
      successMessage: successMsg,
      queryClient: qc,
    });
    setLoading(false);
    if (res.ok) {
      resetActionState();
      verificationsQ.refetch();
      sessionsQ.refetch();
      eventsQ.refetch();
    }
  };

  return (
    <ClientModuleShell
      open={open}
      onClose={() => { resetActionState(); onClose(); }}
      title="Vérification KYC — Centre de contrôle"
      subtitle={`${clientName} — orchestration KYC canonique`}
      clientId={clientId}
      moduleTag="core.kyc"
      clientContext={clientContext}
      badges={[
        { label: kycState.label, variant: latestSession?.status === "approved" ? "default" : "secondary" },
        ...(latestVerification?.status === "pending" ? [{ label: "Demande en cours", variant: "outline" as const }] : []),
      ]}
      state={stateTab}
      history={historyTab}
      actions={actionsTab}
      impact={impact}
      impactedTables={impactedTables}
      plannedEmails={plannedEmails}
      requireReason
      loading={loading}
      disabled={mode === "idle"}
      confirmLabel={
        mode === "request" ? "Envoyer la demande" :
        mode === "resend" ? "Relancer" :
        mode === "approve" ? "Approuver" :
        mode === "reject" ? "Rejeter" :
        mode === "additional" ? "Demander docs" : "Confirmer"
      }
      onConfirm={handleConfirm}
    />
  );
}

// ── helpers ──
function getActionMeta(
  mode: ActionMode,
  ctx: { clientEmail?: string | null; sessionId?: string; verificationId?: string; idType?: string; additionalDocs?: string },
): { impact: ImpactRow[]; tables: ImpactedTable[]; emails: PlannedEmail[] } {
  if (mode === "request") return {
    impact: [
      { label: "Type demandé", before: "—", after: ctx.idType ?? "—" },
      { label: "Statut", before: "Non demandé", after: "pending", delta: "→" },
    ],
    tables: [
      { table: "kyc_verifications", rows: 1, note: "insert" },
      { table: "admin_audit_log", rows: 1, note: "account_ops.kyc_request_verification" },
      { table: "email_queue", rows: 1 },
    ],
    emails: [{ template: "client_kyc_requested", recipient: ctx.clientEmail ?? "—" }],
  };
  if (mode === "resend") return {
    impact: [{ label: "Action", before: "Demande en attente", after: "Email renvoyé" }],
    tables: [
      { table: "admin_audit_log", rows: 1, note: "account_ops.kyc_resend_request" },
      { table: "email_queue", rows: 1 },
    ],
    emails: [{ template: "client_kyc_requested", recipient: ctx.clientEmail ?? "—", note: "rappel" }],
  };
  if (mode === "approve") return {
    impact: [{ label: "Session", before: "submitted / in_review", after: "approved", delta: "✔" }],
    tables: [
      { table: "identity_verification_sessions", rows: 1, note: "status=approved" },
      { table: "kyc_verifications", rows: 1, note: "status=approved (liée)" },
      { table: "identity_verification_events", rows: 1, note: "staff_approved" },
      { table: "admin_audit_log", rows: 1 },
      { table: "email_queue", rows: 1 },
    ],
    emails: [{ template: "client_kyc_approved", recipient: ctx.clientEmail ?? "—" }],
  };
  if (mode === "reject") return {
    impact: [{ label: "Session", before: "submitted / in_review", after: "rejected", delta: "✖" }],
    tables: [
      { table: "identity_verification_sessions", rows: 1, note: "status=rejected" },
      { table: "kyc_verifications", rows: 1, note: "status=rejected (liée)" },
      { table: "identity_verification_events", rows: 1, note: "staff_rejected" },
      { table: "admin_audit_log", rows: 1 },
      { table: "email_queue", rows: 1 },
    ],
    emails: [{ template: "client_kyc_rejected", recipient: ctx.clientEmail ?? "—" }],
  };
  if (mode === "additional") return {
    impact: [
      { label: "Session", before: "submitted", after: "additional_required" },
      { label: "Docs requis", before: "—", after: ctx.additionalDocs || "—" },
    ],
    tables: [
      { table: "identity_verification_sessions", rows: 1, note: "status=additional_required" },
      { table: "identity_verification_events", rows: 1, note: "staff_additional_required" },
      { table: "admin_audit_log", rows: 1 },
      { table: "email_queue", rows: 1 },
    ],
    emails: [{ template: "client_kyc_additional_docs", recipient: ctx.clientEmail ?? "—" }],
  };
  return { impact: [], tables: [], emails: [] };
}

function ActionCard({ active, disabled, onClick, icon: Icon, title, desc }: {
  active: boolean; disabled?: boolean; onClick: () => void; icon: any; title: string; desc: string;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "text-left border rounded-md p-3 transition",
        active ? "border-primary bg-primary/10 ring-1 ring-primary" : "border-border hover:bg-muted/40",
        disabled && "opacity-40 cursor-not-allowed",
      )}
    >
      <div className="flex items-center gap-2 font-semibold text-foreground text-xs">
        <Icon className="h-4 w-4" /> {title}
      </div>
      <div className="text-[11px] text-muted-foreground mt-1">{desc}</div>
    </button>
  );
}
