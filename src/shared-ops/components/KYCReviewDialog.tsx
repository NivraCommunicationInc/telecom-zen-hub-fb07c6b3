/**
 * KYCReviewDialog — Staff review of identity verifications for an Account 360.
 * Lists kyc_verifications + identity_verification_sessions for the client and lets
 * authorized staff request a new verification, approve / reject sessions, request
 * additional documents and preview signed-URL identity docs.
 */
import { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, ShieldCheck, FilePlus2, CheckCircle2, XCircle, FileQuestion,
  Eye, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  onClose: () => void;
  clientUserId: string;
  clientName?: string;
  accountId?: string | null;
}

interface KycVerification {
  id: string;
  status: string;
  requested_id_type: string;
  reason: string | null;
  notes: string | null;
  rejection_reason: string | null;
  created_at: string;
  expires_at: string;
  reviewed_at: string | null;
}

interface IvsSession {
  id: string;
  status: string;
  id_type: string | null;
  document_type: string | null;
  case_number: string | null;
  reference_code: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  review_reason: string | null;
  created_at: string;
  expires_at: string;
  additional_docs: any;
}

const ID_TYPES = [
  { value: "drivers_license", label: "Permis de conduire" },
  { value: "passport",        label: "Passeport" },
  { value: "provincial_id",   label: "Carte d'identité provinciale" },
  { value: "health_card",     label: "Carte d'assurance maladie" },
  { value: "other",           label: "Autre pièce" },
];

const ADDITIONAL_DOC_OPTIONS = [
  "Recto plus net",
  "Verso de la pièce",
  "Selfie tenant la pièce",
  "Preuve d'adresse récente (< 90 jours)",
  "Pièce non expirée",
  "Photo couleur (pas en noir et blanc)",
];

const KYC_STATUS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending:                { label: "En attente",   variant: "secondary"   },
  approved:               { label: "Approuvé",     variant: "default"     },
  rejected:               { label: "Refusé",       variant: "destructive" },
  expired:                { label: "Expiré",       variant: "outline"     },
};

const IVS_STATUS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  created:              { label: "Créée",                  variant: "outline"     },
  in_progress:          { label: "En cours",               variant: "secondary"   },
  submitted:            { label: "Soumise",                variant: "secondary"   },
  under_review:         { label: "En analyse",             variant: "default"     },
  additional_required:  { label: "Documents requis",       variant: "outline"     },
  approved:             { label: "Approuvée",              variant: "default"     },
  rejected:             { label: "Refusée",                variant: "destructive" },
  expired:              { label: "Expirée",                variant: "outline"     },
};

const fmtDateTime = (d?: string | null) => {
  if (!d) return "—";
  try { return new Date(d).toLocaleString("fr-CA"); }
  catch { return d; }
};

export function KYCReviewDialog({
  open, onClose, clientUserId, clientName = "Client", accountId,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [verifications, setVerifications] = useState<KycVerification[]>([]);
  const [sessions, setSessions] = useState<IvsSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  // new request form
  const [newIdType, setNewIdType] = useState("drivers_license");
  const [newReason, setNewReason] = useState("");
  const [newNotes, setNewNotes] = useState("");

  // session review form
  const [reviewReason, setReviewReason] = useState("");
  const [requiredDocs, setRequiredDocs] = useState<string[]>([]);

  // docs preview
  const [docs, setDocs] = useState<Array<{ id: string; doc_type: string; mime_type: string | null; url: string | null }>>([]);

  const selectedSession = useMemo(
    () => sessions.find((s) => s.id === selectedSessionId) || null,
    [sessions, selectedSessionId],
  );

  const loadData = async () => {
    setLoading(true);
    try {
      const [vRes, sRes] = await Promise.all([
        supabase
          .from("kyc_verifications")
          .select("id, status, requested_id_type, reason, notes, rejection_reason, created_at, expires_at, reviewed_at")
          .eq("client_id", clientUserId)
          .order("created_at", { ascending: false }),
        supabase
          .from("identity_verification_sessions")
          .select("id, status, id_type, document_type, case_number, reference_code, submitted_at, reviewed_at, review_reason, created_at, expires_at, additional_docs")
          .eq("user_id", clientUserId)
          .order("created_at", { ascending: false })
          .limit(20),
      ]);
      setVerifications((vRes.data as KycVerification[]) || []);
      const sList = (sRes.data as IvsSession[]) || [];
      setSessions(sList);
      if (!selectedSessionId && sList.length) setSelectedSessionId(sList[0].id);
    } catch (e) {
      toast.error((e as Error).message || "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    setSelectedSessionId(null);
    setNewIdType("drivers_license"); setNewReason(""); setNewNotes("");
    setReviewReason(""); setRequiredDocs([]); setDocs([]);
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, clientUserId]);

  const invoke = async (action: string, extra: Record<string, unknown> = {}) => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("kyc-account-actions", {
        body: { action, client_user_id: clientUserId, account_id: accountId ?? null, ...extra },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("Action exécutée");
      setReviewReason(""); setRequiredDocs([]);
      setNewReason(""); setNewNotes("");
      if (action === "generate_signed_urls") {
        setDocs(((data as any)?.documents as any[]) || []);
      } else {
        setDocs([]);
        await loadData();
      }
    } catch (e) {
      toast.error((e as Error).message || "Échec de l'action");
    } finally {
      setBusy(false);
    }
  };

  const toggleRequired = (doc: string) => {
    setRequiredDocs((cur) => cur.includes(doc) ? cur.filter((d) => d !== doc) : [...cur, doc]);
  };

  const canReviewSession = !!selectedSession && !["approved", "rejected"].includes(selectedSession.status);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-violet-400" />
            Vérification d'identité — {clientName}
          </DialogTitle>
          <DialogDescription>
            Demander, réviser et finaliser la vérification KYC de ce client.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <Tabs defaultValue={sessions.length ? "sessions" : "request"} className="w-full">
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="sessions">Sessions ({sessions.length})</TabsTrigger>
              <TabsTrigger value="requests">Demandes ({verifications.length})</TabsTrigger>
              <TabsTrigger value="request">Nouvelle demande</TabsTrigger>
            </TabsList>

            {/* SESSIONS */}
            <TabsContent value="sessions" className="space-y-3 pt-3">
              {sessions.length === 0 ? (
                <div className="text-center py-6 text-sm text-muted-foreground">
                  Aucune session de vérification trouvée.
                </div>
              ) : (
                <>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto rounded border p-2">
                    {sessions.map((s) => {
                      const st = IVS_STATUS[s.status] ?? { label: s.status, variant: "outline" as const };
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => { setSelectedSessionId(s.id); setDocs([]); }}
                          className={`w-full text-left px-3 py-2 rounded text-xs border transition-colors
                            ${selectedSessionId === s.id ? "border-violet-500 bg-violet-500/10" : "border-transparent hover:border-border bg-muted/40"}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono">{s.case_number || s.reference_code || s.id.slice(0, 8)}</span>
                            <Badge variant={st.variant} className="text-[9px] h-4">{st.label}</Badge>
                          </div>
                          <div className="mt-1 text-[10px] text-muted-foreground">
                            {s.document_type || s.id_type || "—"} — créée {fmtDateTime(s.created_at)}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {selectedSession && (
                    <div className="rounded border p-3 space-y-3 text-xs bg-muted/30">
                      <div className="grid grid-cols-2 gap-3">
                        <div><span className="text-muted-foreground">Soumise:</span> {fmtDateTime(selectedSession.submitted_at)}</div>
                        <div><span className="text-muted-foreground">Expire:</span> {fmtDateTime(selectedSession.expires_at)}</div>
                        <div><span className="text-muted-foreground">Révisée:</span> {fmtDateTime(selectedSession.reviewed_at)}</div>
                        <div><span className="text-muted-foreground">Pièce:</span> {selectedSession.document_type || selectedSession.id_type || "—"}</div>
                      </div>
                      {selectedSession.review_reason && (
                        <div>
                          <div className="font-semibold mb-1">Dernier message</div>
                          <div className="whitespace-pre-wrap">{selectedSession.review_reason}</div>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2 pt-1">
                        <Button size="sm" variant="outline" disabled={busy}
                          onClick={() => invoke("generate_signed_urls", { session_id: selectedSession.id })}>
                          <Eye className="h-4 w-4 mr-2" />Voir les documents
                        </Button>
                      </div>

                      {docs.length > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                          {docs.map((d) => (
                            <a key={d.id} href={d.url || "#"} target="_blank" rel="noreferrer"
                              className="block rounded border p-2 bg-background hover:border-violet-500">
                              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">{d.doc_type}</div>
                              {d.url && d.mime_type?.startsWith("image/") ? (
                                <img src={d.url} alt={d.doc_type} className="h-24 w-full object-cover rounded" />
                              ) : (
                                <div className="h-24 flex items-center justify-center text-xs text-muted-foreground">
                                  {d.url ? "Ouvrir le fichier" : "Indisponible"}
                                </div>
                              )}
                              <div className="text-[9px] text-muted-foreground mt-1">URL signée — 5 min</div>
                            </a>
                          ))}
                        </div>
                      )}

                      {canReviewSession && (
                        <div className="space-y-2 pt-2 border-t">
                          <div>
                            <Label className="text-xs">Motif / instructions (obligatoire pour refus ou docs supplémentaires)</Label>
                            <Textarea rows={2} value={reviewReason} onChange={(e) => setReviewReason(e.target.value)}
                              placeholder="Ex: photo floue, pièce expirée, etc." />
                          </div>
                          <div>
                            <Label className="text-xs">Documents supplémentaires à demander</Label>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {ADDITIONAL_DOC_OPTIONS.map((opt) => (
                                <button
                                  key={opt}
                                  type="button"
                                  onClick={() => toggleRequired(opt)}
                                  className={`px-2 py-1 rounded text-[10px] border transition-colors
                                    ${requiredDocs.includes(opt) ? "border-violet-500 bg-violet-500/10 text-violet-300" : "border-border text-muted-foreground hover:border-violet-500/50"}`}
                                >
                                  {opt}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2 pt-1">
                            <Button size="sm" variant="default" disabled={busy}
                              onClick={() => invoke("approve_session", { session_id: selectedSession.id, review_reason: reviewReason || null })}>
                              <CheckCircle2 className="h-4 w-4 mr-2" />Approuver
                            </Button>
                            <Button size="sm" variant="destructive" disabled={busy || !reviewReason.trim()}
                              onClick={() => invoke("reject_session", { session_id: selectedSession.id, review_reason: reviewReason })}>
                              <XCircle className="h-4 w-4 mr-2" />Refuser
                            </Button>
                            <Button size="sm" variant="outline" disabled={busy || !reviewReason.trim()}
                              onClick={() => invoke("request_additional_docs", { session_id: selectedSession.id, review_reason: reviewReason, required_docs: requiredDocs })}>
                              <FileQuestion className="h-4 w-4 mr-2" />Demander documents supplémentaires
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </TabsContent>

            {/* REQUESTS */}
            <TabsContent value="requests" className="space-y-2 pt-3">
              {verifications.length === 0 ? (
                <div className="text-center py-6 text-sm text-muted-foreground">
                  Aucune demande de vérification enregistrée.
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {verifications.map((v) => {
                    const st = KYC_STATUS[v.status] ?? { label: v.status, variant: "outline" as const };
                    const canResend = v.status === "pending";
                    return (
                      <div key={v.id} className="rounded border bg-muted/40 p-2 text-xs">
                        <div className="flex items-center justify-between">
                          <Badge variant={st.variant}>{st.label}</Badge>
                          <span className="text-[10px] text-muted-foreground">
                            Créée {fmtDateTime(v.created_at)} · Expire {fmtDateTime(v.expires_at)}
                          </span>
                        </div>
                        <div className="mt-1">
                          <strong>{ID_TYPES.find((t) => t.value === v.requested_id_type)?.label || v.requested_id_type}</strong>
                          {v.reason && <> — {v.reason}</>}
                        </div>
                        {v.notes && <div className="text-muted-foreground mt-1">Notes: {v.notes}</div>}
                        {v.rejection_reason && (
                          <div className="text-red-400 mt-1">Refus: {v.rejection_reason}</div>
                        )}
                        {canResend && (
                          <div className="mt-2">
                            <Button size="sm" variant="outline" disabled={busy}
                              onClick={() => invoke("resend_request", { verification_id: v.id })}>
                              <RefreshCw className="h-3 w-3 mr-2" />Renvoyer le courriel
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* NEW REQUEST */}
            <TabsContent value="request" className="space-y-3 pt-3">
              <div>
                <Label className="text-xs">Type de pièce demandée</Label>
                <Select value={newIdType} onValueChange={setNewIdType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ID_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Motif (affiché au client)</Label>
                <Input value={newReason} onChange={(e) => setNewReason(e.target.value)}
                  placeholder="Ex: Activation initiale, mise à jour annuelle…" />
              </div>
              <div>
                <Label className="text-xs">Notes internes (facultatif)</Label>
                <Textarea rows={2} value={newNotes} onChange={(e) => setNewNotes(e.target.value)} />
              </div>
              <Button disabled={busy} onClick={() => invoke("request_verification", {
                requested_id_type: newIdType, reason: newReason, notes: newNotes,
              })}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FilePlus2 className="h-4 w-4 mr-2" />}
                Demander la vérification
              </Button>
              <p className="text-[10px] text-muted-foreground">
                Un courriel branded est envoyé au client avec un lien vers son portail. La demande expire après 14 jours.
              </p>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
