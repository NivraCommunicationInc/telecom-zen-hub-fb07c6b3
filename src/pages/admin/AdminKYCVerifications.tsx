/**
 * Admin KYC Verifications Center
 * Telecom-grade identity verification management.
 * Route: /admin/kyc-verifications
 * Features: case numbers, order linking, pending_docs with per-doc tracking, approve/reject with mandatory note.
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Shield, CheckCircle2, XCircle, Clock, Eye,
  Search, RefreshCw, FileCheck, User, Calendar, Loader2, Camera,
  AlertTriangle, Package, ExternalLink, Copy, RotateCcw, Send,
  PauseCircle, FileUp, Plus, Trash2, Check, X, Lock,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminClient } from "@/integrations/backend";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const STATUS_CONFIG: Record<string, { label: string; className: string; icon: typeof Shield }> = {
  created: { label: "Créée", className: "bg-sky-500/15 text-sky-400 border-sky-500/25", icon: Clock },
  submitted: { label: "Soumise", className: "bg-amber-500/15 text-amber-400 border-amber-500/25", icon: Send },
  in_review: { label: "En cours d'examen", className: "bg-violet-500/15 text-violet-400 border-violet-500/25", icon: Eye },
  manual_review: { label: "En révision", className: "bg-violet-500/15 text-violet-400 border-violet-500/25", icon: Eye },
  pending_docs: { label: "En attente de documents", className: "bg-amber-500/15 text-amber-400 border-amber-500/25", icon: PauseCircle },
  approved: { label: "Approuvée", className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25", icon: CheckCircle2 },
  rejected: { label: "Refusée", className: "bg-red-500/15 text-red-400 border-red-500/25", icon: XCircle },
  expired: { label: "Expirée", className: "bg-muted text-muted-foreground border-border", icon: Clock },
  resubmission_required: { label: "Resoumission requise", className: "bg-amber-500/15 text-amber-400 border-amber-500/25", icon: RotateCcw },
};

const MATCH_CONFIG: Record<string, { label: string; className: string }> = {
  approved_candidate: { label: "Match ✓", className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" },
  partial_match: { label: "Partiel ⚠", className: "bg-amber-500/15 text-amber-400 border-amber-500/25" },
  mismatch: { label: "Mismatch ✗", className: "bg-red-500/15 text-red-400 border-red-500/25" },
};

const DOC_TYPE_OPTIONS = [
  { value: "proof_of_address", label: "Preuve d'adresse" },
  { value: "bank_statement", label: "Relevé bancaire" },
  { value: "utility_bill", label: "Facture de services publics" },
  { value: "government_letter", label: "Lettre gouvernementale" },
  { value: "other_invoice", label: "Autre facture" },
  { value: "id_front", label: "Recto pièce d'identité" },
  { value: "id_back", label: "Verso pièce d'identité" },
  { value: "selfie", label: "Selfie" },
];

const DOC_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  requested: { label: "Demandé", className: "bg-amber-500/15 text-amber-400 border-amber-500/25" },
  uploaded: { label: "Téléversé", className: "bg-sky-500/15 text-sky-400 border-sky-500/25" },
  accepted: { label: "Accepté", className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" },
  rejected: { label: "Refusé", className: "bg-red-500/15 text-red-400 border-red-500/25" },
};

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
        <span>Champ</span><span>Attendu</span><span>Extrait (OCR)</span>
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

interface DocRequest {
  doc_type: string;
  instructions: string;
}

const AdminKYCVerifications = () => {
  const queryClient = useQueryClient();
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [reviewDecision, setReviewDecision] = useState<string>("approved");
  const [reviewReason, setReviewReason] = useState("");
  const [signedUrls, setSignedUrls] = useState<Record<string, string | null>>({});
  const [docSignedUrls, setDocSignedUrls] = useState<Record<string, string>>({});
  const [loadingUrls, setLoadingUrls] = useState(false);

  // Request docs modal
  const [requestDocsOpen, setRequestDocsOpen] = useState(false);
  const [docRequests, setDocRequests] = useState<DocRequest[]>([{ doc_type: "proof_of_address", instructions: "" }]);
  const [requestNote, setRequestNote] = useState("");

  // Per-doc review
  const [docReviewNote, setDocReviewNote] = useState("");

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

  // Requested docs for selected session
  const { data: requestedDocs = [], refetch: refetchDocs } = useQuery({
    queryKey: ["admin-kyc-requested-docs", selectedSession?.id],
    queryFn: async () => {
      if (!selectedSession?.id) return [];
      const { data } = await adminClient
        .from("kyc_requested_documents")
        .select("*")
        .eq("kyc_session_id", selectedSession.id)
        .order("requested_at", { ascending: true });
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
      setDocSignedUrls(data?.doc_urls || {});
    } catch {
      toast.error("Erreur chargement documents");
    } finally {
      setLoadingUrls(false);
    }
  };

  // Review mutation (approve/reject)
  const reviewMutation = useMutation({
    mutationFn: async ({ sessionId, decision, reason }: { sessionId: string; decision: string; reason: string }) => {
      const { data, error } = await adminClient.functions.invoke("admin-review-verification", {
        body: { session_id: sessionId, decision, reason, idempotency_key: `review_${sessionId}_${Date.now()}` },
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
    },
    onError: (err: any) => toast.error(err.message || "Erreur"),
  });

  // Request docs mutation
  const requestDocsMutation = useMutation({
    mutationFn: async ({ sessionId, docs, note }: { sessionId: string; docs: DocRequest[]; note: string }) => {
      const { data, error } = await adminClient.functions.invoke("admin-review-verification", {
        body: {
          action: "request_documents",
          session_id: sessionId,
          requested_documents: docs,
          reason: note,
          idempotency_key: `reqd_${sessionId}_${Date.now()}`,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success("Documents demandés — client notifié");
      queryClient.invalidateQueries({ queryKey: ["admin-kyc-sessions"] });
      setRequestDocsOpen(false);
      setDocRequests([{ doc_type: "proof_of_address", instructions: "" }]);
      setRequestNote("");
      refetchDocs();
    },
    onError: (err: any) => toast.error(err.message || "Erreur"),
  });

  // Per-doc accept/reject mutation
  const docReviewMutation = useMutation({
    mutationFn: async ({ docId, decision, note }: { docId: string; decision: "accepted" | "rejected"; note: string }) => {
      const { data, error } = await adminClient.functions.invoke("admin-review-verification", {
        body: { action: "review_document", document_id: docId, decision, review_note: note },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success("Document traité");
      refetchDocs();
      queryClient.invalidateQueries({ queryKey: ["admin-kyc-sessions"] });
    },
    onError: (err: any) => toast.error(err.message || "Erreur"),
  });

  // Delete KYC documents mutation
  const deleteDocsMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const { data, error } = await adminClient.functions.invoke("admin-review-verification", {
        body: { action: "delete_documents", session_id: sessionId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      toast.success(`${data.files_deleted} fichier(s) supprimé(s) du stockage`);
      queryClient.invalidateQueries({ queryKey: ["admin-kyc-sessions"] });
      if (selectedSession) fetchSignedUrls(selectedSession.id);
    },
    onError: (err: any) => toast.error(err.message || "Erreur"),
  });

  const handleOpenSession = (session: any) => {
    setSelectedSession(session);
    setSignedUrls({});
    setDocSignedUrls({});
    setReviewReason("");
    setReviewDecision("approved");
    setSheetOpen(true);
    if (session.document_front_path) fetchSignedUrls(session.id);
  };

  const handleReview = () => {
    if (!reviewReason.trim()) { toast.error("Note obligatoire"); return; }
    if (!selectedSession?.id) return;
    reviewMutation.mutate({ sessionId: selectedSession.id, decision: reviewDecision, reason: reviewReason });
  };

  const handleOpenRequestDocs = () => {
    setDocRequests([{ doc_type: "proof_of_address", instructions: "" }]);
    setRequestNote("");
    setRequestDocsOpen(true);
  };

  const handleSubmitRequestDocs = () => {
    if (!selectedSession?.id) return;
    if (docRequests.length === 0) { toast.error("Ajoutez au moins un document"); return; }
    if (!requestNote.trim()) { toast.error("Note obligatoire"); return; }
    requestDocsMutation.mutate({ sessionId: selectedSession.id, docs: docRequests, note: requestNote });
  };

  const addDocRow = () => setDocRequests([...docRequests, { doc_type: "", instructions: "" }]);
  const removeDocRow = (idx: number) => setDocRequests(docRequests.filter((_, i) => i !== idx));
  const updateDocRow = (idx: number, field: keyof DocRequest, value: string) => {
    const updated = [...docRequests];
    updated[idx] = { ...updated[idx], [field]: value };
    setDocRequests(updated);
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

  const pendingCount = sessions.filter((s: any) => ["manual_review", "submitted", "in_review"].includes(s.status)).length;
  const pendingDocsCount = sessions.filter((s: any) => s.status === "pending_docs").length;

  const canReview = selectedSession && ["manual_review", "submitted", "in_review", "pending_docs"].includes(selectedSession.status);

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
          {pendingCount > 0 && <Badge className="bg-violet-500/15 text-violet-400 border-violet-500/25">{pendingCount} à traiter</Badge>}
          {pendingDocsCount > 0 && <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/25">{pendingDocsCount} en attente docs</Badge>}
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
            <SelectItem value="submitted">Soumises</SelectItem>
            <SelectItem value="in_review">En cours d'examen</SelectItem>
            <SelectItem value="manual_review">En révision</SelectItem>
            <SelectItem value="pending_docs">En attente de documents</SelectItem>
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
                    className={`cursor-pointer ${isMismatch ? "bg-red-500/5 hover:bg-red-500/10" : session.status === "pending_docs" ? "bg-amber-500/5 hover:bg-amber-500/10" : session.status === "manual_review" || session.status === "submitted" ? "bg-violet-500/5 hover:bg-violet-500/10" : "hover:bg-muted/50"}`}
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
                      <Button size="sm" variant={isMismatch ? "destructive" : ["manual_review", "submitted", "in_review"].includes(session.status) ? "default" : "outline"} onClick={(e) => { e.stopPropagation(); handleOpenSession(session); }}>
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

                {/* Requested Documents Section */}
                {requestedDocs.length > 0 && (
                  <>
                    <div className="space-y-3">
                      <h3 className="font-semibold flex items-center gap-2"><FileUp className="w-4 h-4" /> Documents demandés ({requestedDocs.length})</h3>
                      <div className="space-y-2">
                        {requestedDocs.map((doc: any) => {
                          const ds = DOC_STATUS_CONFIG[doc.status] || DOC_STATUS_CONFIG.requested;
                          const docLabel = DOC_TYPE_OPTIONS.find(d => d.value === doc.doc_type)?.label || doc.doc_type;
                          return (
                            <Card key={doc.id} className={`${doc.status === "uploaded" ? "border-blue-300 bg-blue-50/30" : doc.status === "rejected" ? "border-red-300 bg-red-50/30" : ""}`}>
                              <CardContent className="py-3 space-y-2">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-sm">{docLabel}</span>
                                    <Badge className={ds.className}>{ds.label}</Badge>
                                  </div>
                                  <span className="text-xs text-muted-foreground">{format(new Date(doc.requested_at), "d MMM HH:mm", { locale: fr })}</span>
                                </div>
                                {doc.instructions && <p className="text-xs text-muted-foreground italic">"{doc.instructions}"</p>}
                                
                                {/* Show uploaded file with view button */}
                                {doc.uploaded_file_url && (doc.status === "uploaded" || doc.status === "accepted") && (
                                  <div className="flex items-center gap-2 text-xs">
                                    <FileCheck className="w-3 h-3 text-blue-600" />
                                    <span className="text-blue-700">Fichier téléversé le {doc.uploaded_at ? format(new Date(doc.uploaded_at), "d MMM HH:mm", { locale: fr }) : "—"}</span>
                                    {docSignedUrls[doc.id] ? (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-6 px-2 text-xs text-blue-700 hover:text-blue-900"
                                        onClick={() => window.open(docSignedUrls[doc.id], "_blank")}
                                      >
                                        <Eye className="w-3 h-3 mr-1" /> Voir le document
                                      </Button>
                                    ) : (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-6 px-2 text-xs text-muted-foreground"
                                        onClick={() => selectedSession && fetchSignedUrls(selectedSession.id)}
                                      >
                                        <RefreshCw className="w-3 h-3 mr-1" /> Charger URL
                                      </Button>
                                    )}
                                  </div>
                                )}

                                {doc.review_note && (
                                  <p className="text-xs bg-muted p-2 rounded">Note: {doc.review_note}</p>
                                )}

                                {/* Accept/Reject buttons for uploaded docs */}
                                {doc.status === "uploaded" && (
                                  <div className="flex items-center gap-2 pt-1">
                                    <Input
                                      placeholder="Note (optionnel)..."
                                      className="flex-1 text-xs h-8"
                                      value={docReviewNote}
                                      onChange={(e) => setDocReviewNote(e.target.value)}
                                    />
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                                      disabled={docReviewMutation.isPending}
                                      onClick={() => { docReviewMutation.mutate({ docId: doc.id, decision: "accepted", note: docReviewNote }); setDocReviewNote(""); }}
                                    >
                                      <Check className="w-3 h-3 mr-1" /> Accepter
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="text-red-700 border-red-300 hover:bg-red-50"
                                      disabled={docReviewMutation.isPending}
                                      onClick={() => { docReviewMutation.mutate({ docId: doc.id, decision: "rejected", note: docReviewNote }); setDocReviewNote(""); }}
                                    >
                                      <X className="w-3 h-3 mr-1" /> Refuser
                                    </Button>
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </div>
                    <Separator />
                  </>
                )}

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
                    <div className="py-4 text-center text-muted-foreground border border-dashed rounded-lg text-sm">Aucune commande liée.</div>
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

                {/* Retention status + Delete button */}
                {(selectedSession.retention_status === "locked" || selectedSession.retention_status === "deleted") && (
                  <Card className={selectedSession.retention_status === "deleted" ? "border-destructive/30 bg-destructive/5" : "border-amber-300 bg-amber-50/50"}>
                    <CardContent className="py-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm">
                          <Lock className="w-4 h-4" />
                          <span className="font-medium">
                            {selectedSession.retention_status === "deleted" ? "Documents supprimés" : "Documents verrouillés"}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {selectedSession.retention_status}
                          </Badge>
                        </div>
                        {selectedSession.retention_status === "locked" && (
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={deleteDocsMutation.isPending}
                            onClick={() => {
                              if (confirm("Supprimer définitivement tous les documents KYC du stockage ? Cette action est irréversible.")) {
                                deleteDocsMutation.mutate(selectedSession.id);
                              }
                            }}
                          >
                            {deleteDocsMutation.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Trash2 className="w-3 h-3 mr-1" />}
                            Supprimer les documents
                          </Button>
                        )}
                      </div>
                      {selectedSession.documents_deleted_at && (
                        <p className="text-xs text-muted-foreground">
                          Supprimés le {format(new Date(selectedSession.documents_deleted_at), "d MMM yyyy HH:mm", { locale: fr })}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )}


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
                {canReview && (
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

                        <div className="flex gap-2">
                          <div className="flex-1">
                            <Select value={reviewDecision} onValueChange={setReviewDecision}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="approved">✓ Approuver — confirmer commande</SelectItem>
                                <SelectItem value="rejected">✗ Refuser — bloquer commande</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <Button variant="outline" className="text-orange-700 border-orange-300 hover:bg-orange-50" onClick={handleOpenRequestDocs}>
                            <PauseCircle className="w-4 h-4 mr-1" /> Mettre en attente
                          </Button>
                        </div>

                        <Textarea value={reviewReason} onChange={(e) => setReviewReason(e.target.value)} placeholder="Note interne obligatoire..." rows={2} />

                        <Button
                          onClick={handleReview}
                          disabled={!reviewReason.trim() || reviewMutation.isPending}
                          className={`w-full ${reviewDecision === "approved" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-destructive hover:bg-destructive/90"} text-white`}
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

      {/* Request Documents Dialog */}
      <Dialog open={requestDocsOpen} onOpenChange={setRequestDocsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PauseCircle className="w-5 h-5 text-orange-600" />
              Mettre en attente — Demander des documents
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Le statut passera à <Badge className="bg-orange-50 text-orange-700 border-orange-200">En attente de documents</Badge> et le client sera notifié.
            </p>

            <div className="space-y-3">
              <Label className="text-sm font-semibold">Documents à demander</Label>
              {docRequests.map((dr, idx) => (
                <div key={idx} className="flex gap-2 items-start">
                  <div className="flex-1 space-y-1">
                    <Select value={dr.doc_type} onValueChange={(v) => updateDocRow(idx, "doc_type", v)}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Type de document" /></SelectTrigger>
                      <SelectContent>
                        {DOC_TYPE_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                        <SelectItem value="custom">Autre (personnalisé)</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      placeholder="Instructions pour le client (ex: Facture Hydro-Québec < 90 jours)"
                      className="text-xs h-8"
                      value={dr.instructions}
                      onChange={(e) => updateDocRow(idx, "instructions", e.target.value)}
                    />
                  </div>
                  {docRequests.length > 1 && (
                    <Button variant="ghost" size="sm" className="mt-0.5" onClick={() => removeDocRow(idx)}>
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addDocRow}>
                <Plus className="w-3 h-3 mr-1" /> Ajouter un document
              </Button>
            </div>

            <div>
              <Label className="text-sm font-semibold">Note pour le client (obligatoire)</Label>
              <Textarea value={requestNote} onChange={(e) => setRequestNote(e.target.value)} placeholder="Expliquez ce qui est nécessaire..." rows={2} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRequestDocsOpen(false)}>Annuler</Button>
            <Button
              className="bg-orange-600 hover:bg-orange-700 text-white"
              disabled={!requestNote.trim() || docRequests.length === 0 || requestDocsMutation.isPending}
              onClick={handleSubmitRequestDocs}
            >
              {requestDocsMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Envoyer la demande
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminKYCVerifications;
