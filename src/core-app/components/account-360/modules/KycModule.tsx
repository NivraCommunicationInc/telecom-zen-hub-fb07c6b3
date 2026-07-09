/**
 * KycModule — Client 360 KYC command center.
 *
 * Orchestre le workflow KYC canonique déjà existant dans Nivra :
 *  - Tables : kyc_verifications, identity_verification_sessions,
 *             identity_documents, identity_verification_events,
 *             kyc_requested_documents, admin_audit_log, email_queue.
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
  XCircle, FilePlus2, Eye, Info, Clock, User, FileText, Link2, Copy,
  ExternalLink, Download, Mail, AlertCircle,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
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

const ID_TYPES = [
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
  approved: { label: "Approuvé", variant: "default" },
  rejected: { label: "Rejeté", variant: "destructive" },
  expired: { label: "Expiré", variant: "outline" },
  uploaded: { label: "Reçu", variant: "default" },
  requested: { label: "Attendu", variant: "outline" },
};

const fmtDate = (d: string | null | undefined) =>
  !d ? "—" : format(new Date(d), "dd MMM yyyy HH:mm", { locale: fr });

const fmtRelative = (d: string | null | undefined) =>
  !d ? "—" : formatDistanceToNow(new Date(d), { locale: fr, addSuffix: true });

const APP_URL = "https://nivra-telecom.ca";

type ActionMode = "idle" | "request" | "resend" | "approve" | "reject" | "additional";

export function KycModule({ open, onClose, accountId, clientId, clientName, clientEmail }: Props) {
  const qc = useQueryClient();

  useModuleRealtime({
    tables: ["kyc_verifications", "identity_verification_sessions", "identity_verification_events", "identity_documents", "kyc_requested_documents"],
    clientId,
  });

  const verificationsQ = useQuery({
    queryKey: ["core-kyc-verifications", clientId],
    enabled: open && !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase.from("kyc_verifications").select("*").eq("client_id", clientId).order("created_at", { ascending: false }).limit(20);
      if (error) throw error;
      return data || [];
    },
  });

  const sessionsQ = useQuery({
    queryKey: ["core-kyc-sessions", clientId],
    enabled: open && !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase.from("identity_verification_sessions").select("*").eq("user_id", clientId).order("created_at", { ascending: false }).limit(20);
      if (error) throw error;
      return data || [];
    },
  });

  const latestVerification = verificationsQ.data?.[0];
  const latestSession = sessionsQ.data?.[0];
  const selectedSessionId = latestSession?.id ?? null;

  const docsQ = useQuery({
    queryKey: ["core-kyc-docs", selectedSessionId],
    enabled: open && !!selectedSessionId,
    queryFn: async () => {
      const { data, error } = await supabase.from("identity_documents").select("id, doc_type, mime_type, file_size_bytes, created_at").eq("kyc_session_id", selectedSessionId as string);
      if (error) throw error;
      return data || [];
    },
  });

  const requestedDocsQ = useQuery({
    queryKey: ["core-kyc-requested-docs", selectedSessionId],
    enabled: open && !!selectedSessionId,
    queryFn: async () => {
      const { data, error } = await supabase.from("kyc_requested_documents").select("*").eq("kyc_session_id", selectedSessionId as string).order("requested_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const eventsQ = useQuery({
    queryKey: ["core-kyc-events", clientId, sessionsQ.data?.map((s: any) => s.id).join(",")],
    enabled: open && !!clientId,
    queryFn: async () => {
      const sessionIds = (sessionsQ.data ?? []).map((s: any) => s.id);
      if (sessionIds.length === 0) return [];
      const { data, error } = await supabase.from("identity_verification_events").select("*").in("session_id", sessionIds).order("created_at", { ascending: false }).limit(80);
      if (error) throw error;
      return data || [];
    },
  });

  const kycState = useMemo(() => {
    if (latestSession?.status === "approved") return { label: "Vérifié", color: "text-emerald-500", icon: ShieldCheck, level: "Niveau 2 — Documents validés" };
    if (latestSession?.status === "rejected") return { label: "Rejeté", color: "text-red-500", icon: ShieldAlert, level: "Aucun" };
    if (latestSession?.status === "additional_required") return { label: "Docs additionnels", color: "text-amber-500", icon: ShieldQuestion, level: "Niveau 1 — Partiel" };
    if (latestSession?.status === "submitted" || latestSession?.status === "in_review") return { label: "En révision", color: "text-blue-500", icon: Clock, level: "Niveau 1 — Soumis" };
    if (latestVerification?.status === "pending") return { label: "Demande envoyée", color: "text-amber-500", icon: Clock, level: "Aucun" };
    return { label: "Non vérifié", color: "text-muted-foreground", icon: ShieldQuestion, level: "Aucun" };
  }, [latestSession, latestVerification]);

  const StateIcon = kycState.icon;

  const [mode, setMode] = useState<ActionMode>("idle");
  const [idType, setIdType] = useState("drivers_license");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [reviewReason, setReviewReason] = useState("");
  const [additionalDocs, setAdditionalDocs] = useState("");
  const [loading, setLoading] = useState(false);
  const [signedUrls, setSignedUrls] = useState<Array<{ id: string; doc_type: string; mime_type: string | null; url: string | null }> | null>(null);

  const resetActionState = () => { setMode("idle"); setReason(""); setNotes(""); setReviewReason(""); setAdditionalDocs(""); };

  // ═══════ BLOC RÉSUMÉ ═══════
  const receivedCount = docsQ.data?.length ?? 0;
  const requestedList = requestedDocsQ.data ?? [];
  const missingCount = requestedList.filter((r: any) => r.status === "requested" || !r.uploaded_at).length;
  const rejectedCount = requestedList.filter((r: any) => r.status === "rejected").length;
  const additionalDocsList: string[] = Array.isArray(latestSession?.additional_docs) ? latestSession.additional_docs : [];

  const publicToken = latestSession?.public_token;
  const kycLink = publicToken ? `${APP_URL}/verification/${publicToken}` : null;

  const summaryBlock = (
    <div className="grid grid-cols-2 md:grid-cols-6 gap-3 border rounded-lg p-3 bg-muted/20">
      <div>
        <div className="text-[10px] uppercase text-muted-foreground">Statut</div>
        <div className={cn("font-bold flex items-center gap-1 text-sm", kycState.color)}>
          <StateIcon className="h-3.5 w-3.5" /> {kycState.label}
        </div>
      </div>
      <div>
        <div className="text-[10px] uppercase text-muted-foreground">Niveau</div>
        <div className="text-xs font-medium">{kycState.level}</div>
      </div>
      <div>
        <div className="text-[10px] uppercase text-muted-foreground">Dernière action</div>
        <div className="text-xs font-medium">{fmtRelative(latestSession?.reviewed_at || latestSession?.updated_at || latestVerification?.updated_at)}</div>
      </div>
      <div>
        <div className="text-[10px] uppercase text-muted-foreground">Agent responsable</div>
        <div className="text-xs font-medium truncate">{latestSession?.reviewed_by ? latestSession.reviewed_by.slice(0, 8) : "—"}</div>
      </div>
      <div>
        <div className="text-[10px] uppercase text-muted-foreground">Ouverture demande</div>
        <div className="text-xs font-medium">{fmtRelative(latestVerification?.created_at)}</div>
      </div>
      <div>
        <div className="text-[10px] uppercase text-muted-foreground">Docs reçus / attendus</div>
        <div className="text-xs font-bold">{receivedCount} / {receivedCount + missingCount}</div>
      </div>
    </div>
  );

  const clientContext = (
    <div className="space-y-3">
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
          <div className="text-[10px] uppercase text-muted-foreground">ID client</div>
          <div className="font-mono text-[10px] truncate">{clientId.slice(0, 8)}…</div>
        </div>
        <div>
          <div className="text-[10px] uppercase text-muted-foreground">Compte</div>
          <div className="font-mono text-[10px] truncate">{accountId?.slice(0, 8) ?? "—"}…</div>
        </div>
      </div>
      {summaryBlock}
    </div>
  );

  // ═══════ BLOC LIEN KYC ═══════
  const copyLink = async () => {
    if (!kycLink) return;
    await navigator.clipboard.writeText(kycLink);
    toast.success("Lien KYC copié");
  };

  const linkBlock = (
    <section className="border rounded-md p-3 bg-background/40">
      <div className="text-xs font-semibold uppercase text-muted-foreground mb-2 flex items-center gap-1">
        <Link2 className="h-3 w-3" /> Lien de vérification sécurisé
      </div>
      {!kycLink && (
        <p className="text-xs text-muted-foreground">
          Aucune session avec lien public disponible. Créer une demande crée automatiquement le lien envoyé au client par courriel.
        </p>
      )}
      {kycLink && (
        <div className="space-y-2">
          <code className="block text-[10px] bg-muted/50 p-2 rounded break-all">{kycLink}</code>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={copyLink}>
              <Copy className="h-3 w-3 mr-1" /> Copier
            </Button>
            <Button size="sm" variant="outline" asChild>
              <a href={kycLink} target="_blank" rel="noreferrer">
                <ExternalLink className="h-3 w-3 mr-1" /> Ouvrir
              </a>
            </Button>
            {latestVerification && !["approved", "rejected"].includes(latestVerification.status) && (
              <Button size="sm" variant="outline" onClick={() => setMode("resend")}>
                <Mail className="h-3 w-3 mr-1" /> Renvoyer le courriel
              </Button>
            )}
            <div className="text-[10px] text-muted-foreground flex items-center gap-1 ml-auto">
              <Clock className="h-3 w-3" /> Expire {fmtDate(latestSession?.expires_at)}
            </div>
          </div>
        </div>
      )}
    </section>
  );

  // ═══════ BLOC DOCUMENTS CATÉGORISÉS ═══════
  const receivedDocs = (docsQ.data ?? []) as any[];
  const rejectedDocs = requestedList.filter((r: any) => r.status === "rejected");
  const missingDocs = requestedList.filter((r: any) => r.status === "requested" || (!r.uploaded_at && r.status !== "rejected"));

  const findSignedUrl = (docId: string) => signedUrls?.find((s) => s.id === docId)?.url ?? null;

  const docsBlock = (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1">
          <FileText className="h-3 w-3" /> Documents ({receivedCount} reçus · {missingCount} manquants · {rejectedCount} refusés)
        </h4>
        {receivedCount > 0 && (
          <Button size="sm" variant="outline" onClick={handleViewDocs} disabled={loading}>
            <Eye className="h-3 w-3 mr-1" /> Générer URLs signées (5 min)
          </Button>
        )}
      </div>

      {/* Reçus */}
      <div>
        <div className="text-[10px] uppercase font-semibold text-emerald-500 mb-1">✓ Reçus ({receivedCount})</div>
        {receivedCount === 0 && <p className="text-xs text-muted-foreground italic">Aucun document reçu.</p>}
        <ul className="space-y-1">
          {receivedDocs.map((d: any) => {
            const url = findSignedUrl(d.id);
            return (
              <li key={d.id} className="text-xs border rounded px-2 py-1.5 flex items-center justify-between bg-emerald-500/5">
                <div>
                  <span className="font-medium">{d.doc_type}</span>{" "}
                  <span className="text-muted-foreground">({d.mime_type || "?"} · {d.file_size_bytes ? `${Math.round(d.file_size_bytes / 1024)} Ko` : "?"})</span>
                  <div className="text-[10px] text-muted-foreground">Déposé {fmtDate(d.created_at)}</div>
                </div>
                {url && (
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" asChild><a href={url} target="_blank" rel="noreferrer"><Eye className="h-3 w-3" /></a></Button>
                    <Button size="sm" variant="ghost" asChild><a href={url} download><Download className="h-3 w-3" /></a></Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {/* Manquants */}
      <div>
        <div className="text-[10px] uppercase font-semibold text-amber-500 mb-1">⏳ Manquants ({missingCount})</div>
        {missingCount === 0 && <p className="text-xs text-muted-foreground italic">Aucun document en attente.</p>}
        <ul className="space-y-1">
          {missingDocs.map((r: any) => (
            <li key={r.id} className="text-xs border rounded px-2 py-1.5 bg-amber-500/5">
              <span className="font-medium">{r.doc_type}</span>
              {r.instructions && <div className="text-[10px] text-muted-foreground">{r.instructions}</div>}
              <div className="text-[10px] text-muted-foreground">Demandé {fmtDate(r.requested_at)}</div>
            </li>
          ))}
        </ul>
      </div>

      {/* Supplémentaires demandés (via session.additional_docs) */}
      {additionalDocsList.length > 0 && (
        <div>
          <div className="text-[10px] uppercase font-semibold text-blue-500 mb-1">📎 Documents supplémentaires demandés ({additionalDocsList.length})</div>
          <ul className="space-y-1">
            {additionalDocsList.map((d, i) => (
              <li key={i} className="text-xs border rounded px-2 py-1.5 bg-blue-500/5">{d}</li>
            ))}
          </ul>
          {latestSession?.review_reason && (
            <div className="text-[10px] text-muted-foreground mt-1 italic">Instructions : {latestSession.review_reason}</div>
          )}
        </div>
      )}

      {/* Refusés */}
      <div>
        <div className="text-[10px] uppercase font-semibold text-red-500 mb-1">✖ Refusés ({rejectedCount})</div>
        {rejectedCount === 0 && <p className="text-xs text-muted-foreground italic">Aucun document refusé.</p>}
        <ul className="space-y-1">
          {rejectedDocs.map((r: any) => (
            <li key={r.id} className="text-xs border rounded px-2 py-1.5 bg-red-500/5">
              <div className="font-medium">{r.doc_type}</div>
              {r.review_note && <div className="text-[10px] text-red-500">Raison : {r.review_note}</div>}
              <div className="text-[10px] text-muted-foreground">Révisé {fmtDate(r.reviewed_at)}</div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );

  // ═══════ Onglet ÉTAT ═══════
  const stateTab = (
    <div className="space-y-4 text-sm">
      {linkBlock}
      {docsBlock}

      <section>
        <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Toutes les demandes admin ({verificationsQ.data?.length ?? 0})</h4>
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

  // ═══════ Onglet HISTORIQUE (timeline unifiée) ═══════
  const timeline = useMemo(() => {
    const items: Array<{ ts: string; type: string; label: string; details?: any; source: string }> = [];
    // Demandes admin
    (verificationsQ.data ?? []).forEach((v: any) => {
      items.push({ ts: v.created_at, type: "request_created", label: `Demande créée (${v.requested_id_type})`, source: "kyc_verifications", details: { reason: v.reason } });
      if (v.reviewed_at) items.push({ ts: v.reviewed_at, type: `admin_${v.status}`, label: `Demande ${v.status}`, source: "kyc_verifications" });
    });
    // Sessions client
    (sessionsQ.data ?? []).forEach((s: any) => {
      items.push({ ts: s.created_at, type: "session_opened", label: "Session KYC créée (lien ouvert)", source: "identity_verification_sessions" });
      if (s.submitted_at) items.push({ ts: s.submitted_at, type: "docs_submitted", label: "Documents déposés par le client", source: "identity_verification_sessions" });
      if (s.reviewed_at) items.push({ ts: s.reviewed_at, type: `session_${s.status}`, label: `Session ${s.status}`, details: { reason: s.review_reason }, source: "identity_verification_sessions" });
    });
    // Événements détaillés
    (eventsQ.data ?? []).forEach((e: any) => {
      items.push({ ts: e.created_at, type: e.event_type, label: e.event_type.replace(/_/g, " "), details: e.details, source: "identity_verification_events" });
    });
    return items.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
  }, [verificationsQ.data, sessionsQ.data, eventsQ.data]);

  const historyTab = (
    <div className="space-y-2 text-sm">
      {timeline.length === 0 && <p className="text-muted-foreground">Aucun événement KYC.</p>}
      {timeline.map((e, i) => (
        <div key={i} className="border-l-2 border-primary/40 pl-3 py-1 text-xs">
          <div className="flex justify-between items-start">
            <span className="font-medium">{e.label}</span>
            <span className="text-muted-foreground text-[10px]">{fmtDate(e.ts)}</span>
          </div>
          <div className="text-[10px] text-muted-foreground">Source : <code>{e.source}</code></div>
          {e.details && Object.keys(e.details).length > 0 && (
            <pre className="text-[10px] mt-1 bg-muted/40 p-1 rounded overflow-auto max-h-20">{JSON.stringify(e.details, null, 2)}</pre>
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

  const currentActionMeta = getActionMeta(mode, { clientEmail, idType, additionalDocs });

  const actionsTab = (
    <div className="space-y-4 text-sm">
      <Alert className="bg-primary/5 border-primary/30">
        <Info className="h-4 w-4" />
        <AlertDescription>
          Aucune écriture avant <b>Confirmer</b>. Chaque action est journalisée dans
          <code className="mx-1 text-xs">admin_audit_log</code> et
          <code className="mx-1 text-xs">identity_verification_events</code>.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        <ActionCard active={mode === "request"} onClick={() => setMode("request")} icon={Send} title="Demander une vérification" desc="Crée kyc_verifications + email officiel." />
        <ActionCard active={mode === "resend"} disabled={!canResend} onClick={() => setMode("resend")} icon={RefreshCw} title="Relancer" desc="Renvoie l'email de demande active." />
        <ActionCard active={mode === "additional"} disabled={!canAdditional} onClick={() => setMode("additional")} icon={FilePlus2} title="Documents supplémentaires" desc="Pièces additionnelles sur la session." />
        <ActionCard active={mode === "approve"} disabled={!canApprove} onClick={() => setMode("approve")} icon={CheckCircle2} title="Approuver" desc="Approuve la session et clôt les demandes." />
        <ActionCard active={mode === "reject"} disabled={!canReject} onClick={() => setMode("reject")} icon={XCircle} title="Rejeter" desc="Motif obligatoire. Notifie le client." />
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
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex. Vérification requise pour activation" />
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
          <Textarea value={reviewReason} onChange={(e) => setReviewReason(e.target.value)} rows={3} placeholder="Ex. Document illisible — photo floue." />
        </div>
      )}

      {mode === "additional" && (
        <div className="space-y-2 border rounded-md p-3 bg-muted/30">
          <Label>Instructions au client (obligatoire)</Label>
          <Textarea value={reviewReason} onChange={(e) => setReviewReason(e.target.value)} rows={2} placeholder="Ex. Merci de fournir également un justificatif de domicile." />
          <Label>Liste des documents attendus (séparés par des virgules)</Label>
          <Input value={additionalDocs} onChange={(e) => setAdditionalDocs(e.target.value)} placeholder="Justificatif de domicile, Selfie tenant la pièce" />
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

  const impact: ImpactRow[] = currentActionMeta.impact;
  const impactedTables: ImpactedTable[] = currentActionMeta.tables;
  const plannedEmails: PlannedEmail[] = currentActionMeta.emails;

  async function handleViewDocs() {
    if (!latestSession) return;
    setLoading(true);
    const res = await callCoreAction<{ ok: boolean; documents: any[] }>(
      "kyc-account-actions",
      { action: "generate_signed_urls", client_user_id: clientId, session_id: latestSession.id },
      { reason: "Consultation des documents KYC depuis Client 360", successMessage: "URLs signées générées (5 min)", queryClient: qc },
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
        payload = { ...payload, action: "request_verification", requested_id_type: idType, reason: reason || "Vérification d'identité requise", notes: notes || null };
        successMsg = "Demande KYC envoyée au client";
        break;
      case "resend":
        if (!latestVerification) { setLoading(false); toast.error("Aucune demande à relancer"); return; }
        payload = { ...payload, action: "resend_request", verification_id: latestVerification.id };
        successMsg = "Email de relance envoyé";
        break;
      case "approve":
        if (!latestSession) { setLoading(false); toast.error("Aucune session"); return; }
        payload = { ...payload, action: "approve_session", session_id: latestSession.id, review_reason: reviewReason || null };
        successMsg = "Identité approuvée";
        break;
      case "reject":
        if (!latestSession) { setLoading(false); toast.error("Aucune session"); return; }
        if (!reviewReason.trim()) { setLoading(false); toast.error("Motif de refus obligatoire"); return; }
        payload = { ...payload, action: "reject_session", session_id: latestSession.id, review_reason: reviewReason };
        successMsg = "Identité rejetée — client notifié";
        break;
      case "additional":
        if (!latestSession) { setLoading(false); toast.error("Aucune session"); return; }
        if (!reviewReason.trim()) { setLoading(false); toast.error("Instructions obligatoires"); return; }
        payload = { ...payload, action: "request_additional_docs", session_id: latestSession.id, review_reason: reviewReason, required_docs: additionalDocs.split(",").map((s) => s.trim()).filter(Boolean) };
        successMsg = "Documents supplémentaires demandés";
        break;
    }

    const res = await callCoreAction("kyc-account-actions", payload, { reason: motif, successMessage: successMsg, queryClient: qc });
    setLoading(false);
    if (res.ok) {
      resetActionState();
      verificationsQ.refetch(); sessionsQ.refetch(); eventsQ.refetch(); requestedDocsQ.refetch();
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
        ...(missingCount > 0 ? [{ label: `${missingCount} manquant${missingCount > 1 ? "s" : ""}`, variant: "outline" as const }] : []),
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

function getActionMeta(mode: ActionMode, ctx: { clientEmail?: string | null; idType?: string; additionalDocs?: string }) {
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
    impact: [{ label: "Action", before: "Demande active", after: "Email renvoyé" }],
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
      { table: "identity_verification_sessions", rows: 1, note: "status=additional_required + additional_docs[]" },
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
