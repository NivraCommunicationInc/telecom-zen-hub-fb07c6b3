/**
 * Admin KYC Verifications Center
 * Telecom-grade identity verification management.
 * Route: /admin/kyc-verifications
 * Features: case numbers, order linking, resubmission with required_docs, approve/reject with mandatory note.
 */
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Shield, CheckCircle2, XCircle, Clock, Eye,
  Search, RefreshCw, FileCheck, User, Calendar, Loader2, Camera,
  AlertTriangle, Package, ExternalLink, Copy, RotateCcw, Send,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminClient } from "@/integrations/backend";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const STATUS_CONFIG: Record<string, { label: string; className: string; icon: typeof Shield }> = {
  created: { label: "Créée", className: "bg-blue-50 text-blue-700 border-blue-200", icon: Clock },
  submitted: { label: "Soumise", className: "bg-amber-50 text-amber-700 border-amber-200", icon: Send },
  manual_review: { label: "En révision", className: "bg-purple-50 text-purple-700 border-purple-200", icon: Eye },
  approved: { label: "Approuvée", className: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  rejected: { label: "Refusée", className: "bg-red-50 text-red-700 border-red-200", icon: XCircle },
  expired: { label: "Expirée", className: "bg-slate-100 text-slate-500 border-slate-200", icon: Clock },
  resubmission_required: { label: "Resoumission requise", className: "bg-orange-50 text-orange-700 border-orange-200", icon: RotateCcw },
};

const MATCH_CONFIG: Record<string, { label: string; className: string }> = {
  approved_candidate: { label: "Match ✓", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  partial_match: { label: "Partiel ⚠", className: "bg-amber-50 text-amber-700 border-amber-200" },
  mismatch: { label: "Mismatch ✗", className: "bg-red-50 text-red-700 border-red-200" },
};

const ADDITIONAL_DOC_TYPES = [
  { value: "proof_of_address", label: "Preuve d'adresse" },
  { value: "bank_statement", label: "Relevé bancaire" },
  { value: "other_invoice", label: "Autre facture" },
  { value: "utility_bill", label: "Facture de services publics" },
  { value: "government_letter", label: "Lettre gouvernementale" },
];

const OCRDiffTable = ({ matchResult, checkoutFields }: { matchResult: any; checkoutFields: any }) => {
  if (!matchResult) return null;
  const extracted = matchResult.extracted_fields || {};
  const mismatches = matchResult.mismatch_fields || {};
  const fields = ["first_name", "last_name", "date_of_birth", "document_number", "expiry_date"];
  const labels: Record<string, string> = {
    first_name: "Prénom", last_name: "Nom", date_of_birth: "Date de naissance",
    document_number: "N° document", expiry_date: "Expiration",
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2 text-xs font-semibold text-muted-foreground border-b pb-2">
        <span>Champ</span><span>Attendu (checkout)</span><span>Extrait (OCR)</span>
      </div>
      {fields.map((f) => {
        const expected = checkoutFields?.[f] || "—";
        const got = extracted[f] || "—";
        const mm = mismatches[f];
        return (
          <div key={f} className={`grid grid-cols-3 gap-2 text-sm p-2 rounded ${mm ? "bg-destructive/10 border border-destructive/20" : expected !== "—" && !mm ? "bg-emerald-50/50" : ""}`}>
            <span className="font-medium flex items-center gap-1">
              {mm && <AlertTriangle className="w-3 h-3 text-destructive" />}
              {!mm && expected !== "—" && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
              {labels[f]}
            </span>
            <span className={mm ? "font-medium" : "text-muted-foreground"}>{expected}</span>
            <span className={mm ? "font-bold text-destructive" : "text-muted-foreground"}>{got}</span>
          </div>
        );
      })}
    </div>
  );
};

const AdminKYCVerifications = () => {
  const queryClient = useQueryClient();
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [reviewDecision, setReviewDecision] = useState<string>("approved");
  const [reviewReason, setReviewReason] = useState("");
  const [signedUrls, setSignedUrls] = useState<Record<string, string | null>>({});
  const [loadingUrls, setLoadingUrls] = useState(false);
  const [requiredDocs, setRequiredDocs] = useState<string[]>([]);
  const [customDocLabel, setCustomDocLabel] = useState("");

  // Fetch all sessions
  const { data: sessions = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-kyc-sessions", filterStatus],
    queryFn: async () => {
      let query = adminClient
        .from("identity_verification_sessions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (filterStatus !== "all") query = query.eq("status", filterStatus);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch profiles
  const userIds = [...new Set(sessions.map((s: any) => s.user_id))];
  const { data: profiles = [] } = useQuery({
    queryKey: ["admin-kyc-profiles", userIds.join(",")],
    queryFn: async () => {
      if (userIds.length === 0) return [];
      const { data } = await adminClient.from("profiles").select("id, full_name, email, phone").in("id", userIds);
      return data || [];
    },
    enabled: userIds.length > 0,
  });
  const profileMap = Object.fromEntries(profiles.map((p: any) => [p.id, p]));

  // Events for selected session
  const { data: sessionEvents = [] } = useQuery({
    queryKey: ["admin-kyc-events", selectedSession?.id],
    queryFn: async () => {
      if (!selectedSession?.id) return [];
      const { data } = await adminClient
        .from("identity_verification_events")
        .select("*")
        .eq("session_id", selectedSession.id)
        .order("created_at", { ascending: true });
      return data || [];
    },
    enabled: !!selectedSession?.id,
  });

  const fetchSignedUrls = async (sessionId: string) => {
    setLoadingUrls(true);
    try {
      const { data, error } = await adminClient.functions.invoke("admin-review-verification", {
        body: { action: "get_signed_urls", session_id: sessionId },
      });
      if (error) throw error;
      setSignedUrls(data?.urls || {});
    } catch {
      toast.error("Erreur chargement documents");
    } finally {
      setLoadingUrls(false);
    }
  };

  const reviewMutation = useMutation({
    mutationFn: async ({ sessionId, decision, reason, required_docs }: { sessionId: string; decision: string; reason: string; required_docs?: string[] }) => {
      const { data, error } = await adminClient.functions.invoke("admin-review-verification", {
        body: { session_id: sessionId, decision, reason, required_docs, idempotency_key: `review_${sessionId}_${Date.now()}` },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success("Décision enregistrée");
      queryClient.invalidateQueries({ queryKey: ["admin-kyc-sessions"] });
      setSheetOpen(false);
      setReviewReason("");
      setRequiredDocs([]);
      setCustomDocLabel("");
    },
    onError: (err: any) => toast.error(err.message || "Erreur"),
  });

  const handleOpenSession = (session: any) => {
    setSelectedSession(session);
    setSignedUrls({});
    setReviewReason("");
    setReviewDecision("approved");
    setRequiredDocs([]);
    setCustomDocLabel("");
    setSheetOpen(true);
    if (session.document_front_path) fetchSignedUrls(session.id);
  };

  const handleReview = () => {
    if (!reviewReason.trim()) { toast.error("Note obligatoire"); return; }
    if (!selectedSession?.id) return;
    const docs = reviewDecision === "resubmission_required"
      ? [...requiredDocs, ...(customDocLabel.trim() ? [customDocLabel.trim()] : [])]
      : undefined;
    reviewMutation.mutate({ sessionId: selectedSession.id, decision: reviewDecision, reason: reviewReason, required_docs: docs });
  };

  const copyToClipboard = (text: string) => { navigator.clipboard.writeText(text); toast.success("Copié"); };

  const filtered = sessions.filter((s: any) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const profile = profileMap[s.user_id];
    return (
      s.case_number?.toLowerCase().includes(term) ||
      s.order_number?.toLowerCase().includes(term) ||
      s.reference_code?.toLowerCase().includes(term) ||
      profile?.full_name?.toLowerCase().includes(term) ||
      profile?.email?.toLowerCase().includes(term) ||
      profile?.phone?.includes(term)
    );
  });

  const pendingCount = sessions.filter((s: any) => s.status === "manual_review").length;
  const resubCount = sessions.filter((s: any) => s.status === "resubmission_required").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-foreground" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Centre de vérification KYC</h1>
            <p className="text-sm text-muted-foreground">Gestion des vérifications d'identité — Numéros de dossier</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {pendingCount > 0 && <Badge className="bg-purple-100 text-purple-800 border-purple-300">{pendingCount} en révision</Badge>}
          {resubCount > 0 && <Badge className="bg-orange-100 text-orange-800 border-orange-300">{resubCount} resoumission</Badge>}
          <Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCw className="w-4 h-4 mr-1" /> Actualiser</Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Rechercher par N° dossier, commande, nom, email..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="manual_review">En révision</SelectItem>
            <SelectItem value="resubmission_required">Resoumission requise</SelectItem>
            <SelectItem value="submitted">Soumises</SelectItem>
            <SelectItem value="approved">Approuvées</SelectItem>
            <SelectItem value="rejected">Refusées</SelectItem>
            <SelectItem value="created">Créées</SelectItem>
            <SelectItem value="expired">Expirées</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Aucune session trouvée.</CardContent></Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N° Dossier</TableHead>
                <TableHead>Commande</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>OCR</TableHead>
                <TableHead>Créée le</TableHead>
                <TableHead>Dernière MAJ</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((session: any) => {
                const sc = STATUS_CONFIG[session.status] || STATUS_CONFIG.created;
                const matchStatus = session.match_result?.status;
                const mc = matchStatus ? MATCH_CONFIG[matchStatus] : null;
                const isMismatch = matchStatus === "mismatch" || matchStatus === "partial_match";
                const profile = profileMap[session.user_id];

                return (
                  <TableRow
                    key={session.id}
                    className={`cursor-pointer ${isMismatch ? "bg-destructive/5 hover:bg-destructive/10" : session.status === "manual_review" ? "bg-purple-50/30 hover:bg-purple-50/50" : "hover:bg-muted/50"}`}
                    onClick={() => handleOpenSession(session)}
                  >
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-mono font-semibold text-sm">{session.case_number || "—"}</span>
                        <span className="text-[10px] text-muted-foreground font-mono">Réf: {session.reference_code || session.id.slice(0, 8)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {session.order_number ? (
                        <Badge variant="outline" className="font-mono text-xs">{session.order_number}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Non liée</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{profile?.full_name || "—"}</span>
                        <span className="text-xs text-muted-foreground">{profile?.email || "—"}</span>
                      </div>
                    </TableCell>
                    <TableCell><Badge className={sc.className}>{sc.label}</Badge></TableCell>
                    <TableCell>
                      {mc ? (
                        <Badge className={mc.className}>
                          {session.match_result?.match_score != null && `${session.match_result.match_score}% `}{mc.label}
                        </Badge>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{format(new Date(session.created_at), "d MMM yyyy HH:mm", { locale: fr })}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{format(new Date(session.updated_at), "d MMM yyyy HH:mm", { locale: fr })}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant={isMismatch ? "destructive" : session.status === "manual_review" ? "default" : "outline"} onClick={(e) => { e.stopPropagation(); handleOpenSession(session); }}>
                        <Eye className="w-4 h-4 mr-1" /> Ouvrir
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Detail Sheet */}
      <Sheet open={sheetOpen} onOpenChange={(o) => { setSheetOpen(o); if (!o) setSelectedSession(null); }}>
        <SheetContent className="w-full sm:max-w-[900px] p-0 flex flex-col">
          <SheetHeader className="px-6 py-4 border-b">
            <SheetTitle className="flex items-center gap-3">
              <Shield className="w-5 h-5" />
              <span className="font-mono">{selectedSession?.case_number || "Session"}</span>
              {selectedSession && <Badge className={STATUS_CONFIG[selectedSession.status]?.className}>{STATUS_CONFIG[selectedSession.status]?.label}</Badge>}
            </SheetTitle>
          </SheetHeader>

          {selectedSession && (
            <ScrollArea className="flex-1 overflow-y-auto">
              <div className="px-6 py-4 space-y-6">
                {/* Documents section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold flex items-center gap-2"><Camera className="w-4 h-4" /> Documents soumis</h3>
                    {selectedSession.document_front_path && (
                      <Button variant="ghost" size="sm" onClick={() => fetchSignedUrls(selectedSession.id)}>
                        <RefreshCw className="w-3 h-3 mr-1" /> Rafraîchir
                      </Button>
                    )}
                  </div>

                  {loadingUrls ? (
                    <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
                  ) : signedUrls.front ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label className="text-xs text-muted-foreground">Recto</Label>
                        <div className="mt-1 border rounded-lg overflow-hidden bg-muted">
                          <img src={signedUrls.front} alt="Recto" className="w-full h-48 object-contain" />
                        </div>
                      </div>
                      {signedUrls.back && (
                        <div>
                          <Label className="text-xs text-muted-foreground">Verso</Label>
                          <div className="mt-1 border rounded-lg overflow-hidden bg-muted">
                            <img src={signedUrls.back} alt="Verso" className="w-full h-48 object-contain" />
                          </div>
                        </div>
                      )}
                      {signedUrls.selfie && (
                        <div>
                          <Label className="text-xs text-muted-foreground">Selfie</Label>
                          <div className="mt-1 border rounded-lg overflow-hidden bg-muted">
                            <img src={signedUrls.selfie} alt="Selfie" className="w-full h-48 object-contain" />
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="py-6 text-center text-muted-foreground border border-dashed rounded-lg">Aucun document soumis.</div>
                  )}
                </div>

                <Separator />

                {/* OCR section */}
                <div className="space-y-3">
                  <h3 className="font-semibold flex items-center gap-2"><FileCheck className="w-4 h-4" /> Correspondance OCR</h3>
                  {selectedSession.match_result ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <span className="text-sm">Score :</span>
                        <span className={`text-2xl font-bold ${
                          selectedSession.match_result.match_score >= 100 ? "text-emerald-600" :
                          selectedSession.match_result.match_score >= 60 ? "text-amber-600" : "text-destructive"
                        }`}>{selectedSession.match_result.match_score}%</span>
                        <Badge className={MATCH_CONFIG[selectedSession.match_result.status]?.className || ""}>
                          {MATCH_CONFIG[selectedSession.match_result.status]?.label || selectedSession.match_result.status}
                        </Badge>
                      </div>
                      <OCRDiffTable matchResult={selectedSession.match_result} checkoutFields={selectedSession.checkout_fields} />
                    </div>
                  ) : (
                    <div className="py-4 text-center text-muted-foreground border border-dashed rounded-lg text-sm">OCR non disponible.</div>
                  )}
                </div>

                <Separator />

                {/* Order section */}
                <div className="space-y-3">
                  <h3 className="font-semibold flex items-center gap-2"><Package className="w-4 h-4" /> Commande liée</h3>
                  {selectedSession.order_id ? (
                    <Card>
                      <CardContent className="py-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Badge variant="outline" className="font-mono text-sm">{selectedSession.order_number || "—"}</Badge>
                            <span className="text-xs text-muted-foreground font-mono">ID: {selectedSession.order_id.slice(0, 8)}...</span>
                          </div>
                          <Button variant="outline" size="sm" asChild>
                            <a href={`/admin/orders?id=${selectedSession.order_id}`} target="_blank"><ExternalLink className="w-3 h-3 mr-1" /> Voir commande</a>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="py-4 text-center text-muted-foreground border border-dashed rounded-lg text-sm">
                      Aucune commande liée à cette session.
                    </div>
                  )}
                </div>

                <Separator />

                {/* Session metadata */}
                <Card>
                  <CardContent className="py-3 space-y-2 text-xs">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex justify-between"><span className="text-muted-foreground">N° Dossier</span><span className="font-mono font-semibold">{selectedSession.case_number}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Code Réf.</span><span className="font-mono">{selectedSession.reference_code || selectedSession.id.slice(0, 8)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Type pièce</span><span>{selectedSession.id_type || "—"}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Province</span><span>{selectedSession.id_province || "—"}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Tentatives</span><span>{selectedSession.submission_attempts}/{selectedSession.max_attempts || 3}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">IP</span><span>{selectedSession.client_ip || "—"}</span></div>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button variant="outline" size="sm" onClick={() => copyToClipboard(selectedSession.case_number || selectedSession.id)}>
                        <Copy className="w-3 h-3 mr-1" /> Copier N°
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Client info */}
                {profileMap[selectedSession.user_id] && (
                  <Card>
                    <CardHeader className="py-2 px-4">
                      <CardTitle className="text-xs flex items-center gap-1"><User className="w-3 h-3" /> Client</CardTitle>
                    </CardHeader>
                    <CardContent className="py-2 px-4 text-sm space-y-1">
                      <p className="font-medium">{profileMap[selectedSession.user_id].full_name}</p>
                      <p className="text-muted-foreground">{profileMap[selectedSession.user_id].email}</p>
                      {profileMap[selectedSession.user_id].phone && <p className="text-muted-foreground">{profileMap[selectedSession.user_id].phone}</p>}
                    </CardContent>
                  </Card>
                )}

                {/* Timeline */}
                {sessionEvents.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="font-semibold flex items-center gap-2"><Calendar className="w-4 h-4" /> Historique</h3>
                    <div className="space-y-2">
                      {sessionEvents.map((event: any) => (
                        <div key={event.id} className="flex items-start gap-3 p-3 bg-muted rounded-lg text-sm">
                          <div className="w-2 h-2 mt-1.5 rounded-full bg-foreground shrink-0" />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{event.event_type}</span>
                              {event.actor_role && <Badge variant="outline" className="text-[10px]">{event.actor_role}</Badge>}
                            </div>
                            {event.details && typeof event.details === "object" && (
                              <p className="text-xs text-muted-foreground mt-1">{JSON.stringify(event.details)}</p>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground shrink-0">{format(new Date(event.created_at), "d MMM HH:mm:ss", { locale: fr })}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Decision Panel */}
                {(selectedSession.status === "manual_review" || selectedSession.status === "submitted" || selectedSession.status === "resubmission_required") && (
                  <div>
                    <Separator className="mb-4" />
                    <Card className="border-2 border-primary/20">
                      <CardHeader className="py-3">
                        <CardTitle className="text-sm">Décision administrative</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {selectedSession.match_result?.status && selectedSession.match_result.status !== "approved_candidate" && (
                          <div className="p-2 rounded bg-destructive/10 border border-destructive/20 text-xs flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-destructive" />
                            <span className="font-semibold">⚠ {selectedSession.match_result.status === "mismatch" ? "MISMATCH" : "Match partiel"} — Score: {selectedSession.match_result.match_score}%</span>
                          </div>
                        )}

                        <Select value={reviewDecision} onValueChange={setReviewDecision}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="approved">✓ Approuver — confirmer commande</SelectItem>
                            <SelectItem value="rejected">✗ Refuser — bloquer commande</SelectItem>
                            <SelectItem value="resubmission_required">🔄 Demander resoumission</SelectItem>
                          </SelectContent>
                        </Select>

                        {/* Required docs selector for resubmission */}
                        {reviewDecision === "resubmission_required" && (
                          <div className="space-y-2 p-3 bg-orange-50 rounded-lg border border-orange-200">
                            <Label className="text-xs font-semibold text-orange-800">Documents requis du client :</Label>
                            {ADDITIONAL_DOC_TYPES.map((doc) => (
                              <div key={doc.value} className="flex items-center gap-2">
                                <Checkbox
                                  id={doc.value}
                                  checked={requiredDocs.includes(doc.value)}
                                  onCheckedChange={(checked) => {
                                    setRequiredDocs(checked
                                      ? [...requiredDocs, doc.value]
                                      : requiredDocs.filter((d) => d !== doc.value)
                                    );
                                  }}
                                />
                                <label htmlFor={doc.value} className="text-sm">{doc.label}</label>
                              </div>
                            ))}
                            <div className="pt-1">
                              <Input
                                placeholder="Autre document (optionnel)..."
                                value={customDocLabel}
                                onChange={(e) => setCustomDocLabel(e.target.value)}
                                className="text-sm"
                              />
                            </div>
                          </div>
                        )}

                        <Textarea value={reviewReason} onChange={(e) => setReviewReason(e.target.value)} placeholder="Note interne obligatoire..." rows={2} />

                        <Button
                          onClick={handleReview}
                          disabled={!reviewReason.trim() || reviewMutation.isPending}
                          className={`w-full ${
                            reviewDecision === "approved" ? "bg-emerald-600 hover:bg-emerald-700" :
                            reviewDecision === "rejected" ? "bg-destructive hover:bg-destructive/90" :
                            "bg-orange-600 hover:bg-orange-700"
                          } text-white`}
                        >
                          {reviewMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                          Confirmer la décision
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Already reviewed */}
                {selectedSession.review_reason && (
                  <Card className="bg-muted">
                    <CardContent className="py-3">
                      <Label className="text-xs text-muted-foreground">Décision précédente</Label>
                      <p className="text-sm mt-1">{selectedSession.review_reason}</p>
                      {selectedSession.reviewed_at && (
                        <p className="text-xs text-muted-foreground mt-1">{format(new Date(selectedSession.reviewed_at), "d MMM yyyy HH:mm", { locale: fr })}</p>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            </ScrollArea>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default AdminKYCVerifications;
