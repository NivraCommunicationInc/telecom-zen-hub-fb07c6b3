/**
 * Admin Identity Verification Dashboard
 * View sessions, review documents (signed URLs), approve/reject with mandatory reason, audit trail.
 * Features: urgent mismatch filter, side-by-side diff, highlight mismatches, order link.
 */
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Shield, CheckCircle2, XCircle, Clock, AlertCircle, Eye,
  Search, RefreshCw, FileCheck, User, Calendar, Loader2, Globe, Monitor, Camera,
  AlertTriangle, ArrowRight, ExternalLink
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminClient as dbClient } from "@/integrations/backend";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  created: { label: "Créée", className: "bg-blue-50 text-blue-700 border-blue-200" },
  submitted: { label: "Soumise", className: "bg-amber-50 text-amber-700 border-amber-200" },
  approved: { label: "Approuvée", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  rejected: { label: "Refusée", className: "bg-red-50 text-red-700 border-red-200" },
  manual_review: { label: "Révision requise", className: "bg-purple-50 text-purple-700 border-purple-200" },
  expired: { label: "Expirée", className: "bg-slate-50 text-slate-500 border-slate-200" },
};

const MATCH_STATUS_BADGE: Record<string, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  approved_candidate: { label: "Match ✓", className: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  partial_match: { label: "Partiel ⚠", className: "bg-amber-50 text-amber-700 border-amber-200", icon: AlertTriangle },
  mismatch: { label: "Mismatch ✗", className: "bg-red-50 text-red-700 border-red-200", icon: XCircle },
  extraction_failed: { label: "Extraction échouée", className: "bg-slate-50 text-slate-500 border-slate-200", icon: AlertCircle },
};

const SEVERITY_COLORS: Record<string, string> = {
  strict: "bg-red-100 text-red-800 border-red-300",
  fuzzy: "bg-amber-100 text-amber-800 border-amber-300",
  normalized: "bg-blue-100 text-blue-800 border-blue-300",
};

/** Side-by-side diff component for mismatch fields */
const MismatchDiff = ({ matchResult, checkoutFields }: { matchResult: any; checkoutFields: any }) => {
  if (!matchResult || !matchResult.mismatch_fields) return null;
  const mismatches = matchResult.mismatch_fields;
  const extracted = matchResult.extracted_fields || {};

  const allFields = ["first_name", "last_name", "date_of_birth", "document_number", "expiry_date"];
  const fieldLabels: Record<string, string> = {
    first_name: "Prénom",
    last_name: "Nom",
    date_of_birth: "Date de naissance",
    document_number: "Numéro de document",
    expiry_date: "Date d'expiration",
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2 text-xs font-semibold text-muted-foreground border-b border-border pb-2">
        <span>Champ</span>
        <span>Checkout (attendu)</span>
        <span>OCR (extrait)</span>
      </div>
      {allFields.map((field) => {
        const expected = checkoutFields?.[field] || "—";
        const extractedVal = extracted[field] || "—";
        const mismatch = mismatches[field];
        const isMatch = !mismatch && expected !== "—";

        return (
          <div
            key={field}
            className={`grid grid-cols-3 gap-2 text-sm p-2 rounded-md ${
              mismatch ? "bg-destructive/10 border border-destructive/20" : isMatch ? "bg-emerald-50/50" : ""
            }`}
          >
            <span className="font-medium text-foreground flex items-center gap-1.5">
              {mismatch && <AlertTriangle className="w-3.5 h-3.5 text-destructive flex-shrink-0" />}
              {isMatch && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />}
              {fieldLabels[field] || field}
              {mismatch && (
                <Badge variant="outline" className={`text-[10px] ml-1 ${SEVERITY_COLORS[mismatch.severity] || ""}`}>
                  {mismatch.severity}
                </Badge>
              )}
            </span>
            <span className={mismatch ? "font-medium text-foreground" : "text-muted-foreground"}>{expected}</span>
            <span className={mismatch ? "font-bold text-destructive" : "text-muted-foreground"}>{extractedVal}</span>
          </div>
        );
      })}
      {matchResult.policy_notes?.length > 0 && (
        <div className="mt-3 p-3 bg-muted rounded-lg border border-border">
          <p className="text-xs font-semibold text-muted-foreground mb-1">Notes de politique :</p>
          {matchResult.policy_notes.map((note: string, i: number) => (
            <p key={i} className="text-xs text-muted-foreground">• {note}</p>
          ))}
        </div>
      )}
    </div>
  );
};

const AdminIdentityVerification = () => {
  const queryClient = useQueryClient();
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewDecision, setReviewDecision] = useState<"approved" | "rejected" | "manual_review">("approved");
  const [reviewReason, setReviewReason] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showMismatchOnly, setShowMismatchOnly] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [signedUrls, setSignedUrls] = useState<Record<string, string | null>>({});
  const [loadingUrls, setLoadingUrls] = useState(false);

  // Fetch sessions
  const { data: sessions = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-id-verification-sessions", filterStatus],
    queryFn: async () => {
      let query = dbClient
        .from("identity_verification_sessions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (filterStatus !== "all") {
        query = query.eq("status", filterStatus);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch events for selected session
  const { data: sessionEvents = [] } = useQuery({
    queryKey: ["admin-id-verification-events", selectedSession?.id],
    queryFn: async () => {
      if (!selectedSession?.id) return [];
      const { data, error } = await dbClient
        .from("identity_verification_events")
        .select("*")
        .eq("session_id", selectedSession.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedSession?.id,
  });

  // Fetch linked orders for selected session
  const { data: linkedOrders = [] } = useQuery({
    queryKey: ["admin-id-verification-orders", selectedSession?.id],
    queryFn: async () => {
      if (!selectedSession?.id) return [];
      const { data, error } = await dbClient
        .from("orders")
        .select("id, order_number, status, created_at, category")
        .eq("identity_verification_session_id", selectedSession.id);
      if (error) return [];
      return data || [];
    },
    enabled: !!selectedSession?.id,
  });

  // Fetch signed URLs for documents
  const fetchSignedUrls = async (sessionId: string) => {
    setLoadingUrls(true);
    try {
      const { data, error } = await dbClient.functions.invoke("admin-review-verification", {
        body: { action: "get_signed_urls", session_id: sessionId },
      });
      if (error) throw error;
      setSignedUrls(data?.urls || {});
    } catch (err: any) {
      toast.error("Erreur lors du chargement des documents");
      console.error(err);
    } finally {
      setLoadingUrls(false);
    }
  };

  // Review mutation
  const reviewMutation = useMutation({
    mutationFn: async ({ sessionId, decision, reason }: { sessionId: string; decision: string; reason: string }) => {
      const { data, error } = await dbClient.functions.invoke("admin-review-verification", {
        body: {
          session_id: sessionId,
          decision,
          reason,
          idempotency_key: `review_${sessionId}_${Date.now()}`,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success("Décision enregistrée");
      queryClient.invalidateQueries({ queryKey: ["admin-id-verification-sessions"] });
      setReviewDialogOpen(false);
      setReviewReason("");
      setSelectedSession(null);
    },
    onError: (err: any) => {
      toast.error(err.message || "Erreur lors de la révision");
    },
  });

  const handleReview = () => {
    if (!reviewReason.trim()) {
      toast.error("La raison est obligatoire");
      return;
    }
    if (!selectedSession?.id) return;
    reviewMutation.mutate({
      sessionId: selectedSession.id,
      decision: reviewDecision,
      reason: reviewReason,
    });
  };

  const handleOpenSession = (session: any) => {
    setSelectedSession(session);
    setSignedUrls({});
    if (session.document_front_path) {
      fetchSignedUrls(session.id);
    }
  };

  const getMatchStatus = (session: any) => {
    return session.match_result?.status || null;
  };

  const filteredSessions = sessions.filter((s: any) => {
    if (showMismatchOnly) {
      const ms = getMatchStatus(s);
      if (ms !== "mismatch" && ms !== "partial_match") return false;
    }
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      s.id?.toLowerCase().includes(term) ||
      s.user_id?.toLowerCase().includes(term) ||
      s.checkout_type?.toLowerCase().includes(term) ||
      s.id_type?.toLowerCase().includes(term)
    );
  });

  const pendingCount = sessions.filter((s: any) => s.status === "manual_review").length;
  const mismatchCount = sessions.filter((s: any) => {
    const ms = getMatchStatus(s);
    return ms === "mismatch" || ms === "partial_match";
  }).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-foreground" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Vérifications d'identité</h1>
            <p className="text-sm text-muted-foreground">Gérer les sessions de vérification QR</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {mismatchCount > 0 && (
            <Button
              variant={showMismatchOnly ? "default" : "outline"}
              size="sm"
              onClick={() => setShowMismatchOnly(!showMismatchOnly)}
              className={showMismatchOnly ? "bg-destructive hover:bg-destructive/90" : "border-destructive/50 text-destructive"}
            >
              <AlertTriangle className="w-4 h-4 mr-1" />
              {mismatchCount} mismatch{mismatchCount > 1 ? "s" : ""}
            </Button>
          )}
          {pendingCount > 0 && (
            <Badge className="bg-purple-100 text-purple-800 border-purple-300">
              {pendingCount} en révision
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" /> Actualiser
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher par ID, utilisateur, type de pièce..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="manual_review">🔍 Révision requise</SelectItem>
            <SelectItem value="submitted">📥 Soumises</SelectItem>
            <SelectItem value="approved">✓ Approuvées</SelectItem>
            <SelectItem value="rejected">✗ Refusées</SelectItem>
            <SelectItem value="created">Créées</SelectItem>
            <SelectItem value="expired">Expirées</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Sessions table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
        </div>
      ) : filteredSessions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Aucune session de vérification trouvée.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Session</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Pièce</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>OCR Match</TableHead>
                <TableHead>Créée le</TableHead>
                <TableHead>Tentatives</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSessions.map((session: any) => {
                const badge = STATUS_BADGE[session.status] || STATUS_BADGE.created;
                const matchStatus = getMatchStatus(session);
                const matchBadge = matchStatus ? MATCH_STATUS_BADGE[matchStatus] : null;
                const isMismatch = matchStatus === "mismatch" || matchStatus === "partial_match";

                return (
                  <TableRow
                    key={session.id}
                    className={`cursor-pointer ${
                      isMismatch ? "bg-destructive/5 hover:bg-destructive/10" :
                      session.status === "manual_review" ? "bg-purple-50/50" : ""
                    }`}
                    onClick={() => handleOpenSession(session)}
                  >
                    <TableCell className="font-mono text-xs">{session.id.slice(0, 8)}...</TableCell>
                    <TableCell className="text-sm">
                      {session.checkout_type === "internet" ? "Internet" : session.checkout_type === "tv" ? "TV" : "Mobile"}
                    </TableCell>
                    <TableCell className="text-sm">{session.id_type || "—"}</TableCell>
                    <TableCell><Badge className={badge.className}>{badge.label}</Badge></TableCell>
                    <TableCell>
                      {matchBadge ? (
                        <Badge className={matchBadge.className}>
                          {session.match_result?.match_score != null && `${session.match_result.match_score}% `}
                          {matchBadge.label}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {format(new Date(session.created_at), "d MMM yyyy HH:mm", { locale: fr })}
                    </TableCell>
                    <TableCell className="text-sm">{session.submission_attempts || 0}/{session.max_attempts || 3}</TableCell>
                    <TableCell className="text-right">
                      {(session.status === "manual_review" || session.status === "submitted") && (
                        <Button
                          size="sm"
                          variant={isMismatch ? "destructive" : "default"}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenSession(session);
                            setReviewDialogOpen(true);
                          }}
                        >
                          {isMismatch && <AlertTriangle className="w-4 h-4 mr-1" />}
                          <Eye className="w-4 h-4 mr-1" /> Réviser
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Session detail dialog */}
      <Dialog open={!!selectedSession && !reviewDialogOpen} onOpenChange={(o) => !o && setSelectedSession(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Détails de la session
              {selectedSession?.match_result?.status && (
                <Badge className={MATCH_STATUS_BADGE[selectedSession.match_result.status]?.className || ""}>
                  {MATCH_STATUS_BADGE[selectedSession.match_result.status]?.label}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {selectedSession && (
            <Tabs defaultValue="matching">
              <TabsList>
                <TabsTrigger value="matching">
                  Correspondance
                  {(selectedSession.match_result?.status === "mismatch" || selectedSession.match_result?.status === "partial_match") && (
                    <AlertTriangle className="w-3.5 h-3.5 ml-1 text-destructive" />
                  )}
                </TabsTrigger>
                <TabsTrigger value="documents">Documents</TabsTrigger>
                <TabsTrigger value="info">Informations</TabsTrigger>
                <TabsTrigger value="audit">Historique</TabsTrigger>
              </TabsList>

              {/* Matching tab — side-by-side diff */}
              <TabsContent value="matching" className="space-y-4">
                {selectedSession.match_result ? (
                  <>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-foreground">Score :</span>
                        <span className={`text-2xl font-bold ${
                          selectedSession.match_result.match_score >= 100 ? "text-emerald-600" :
                          selectedSession.match_result.match_score >= 60 ? "text-amber-600" : "text-destructive"
                        }`}>
                          {selectedSession.match_result.match_score}%
                        </span>
                      </div>
                      {selectedSession.match_result.status === "approved_candidate" && (
                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Candidat à l'approbation
                        </Badge>
                      )}
                    </div>
                    <MismatchDiff matchResult={selectedSession.match_result} checkoutFields={selectedSession.checkout_fields} />
                  </>
                ) : (
                  <div className="py-8 text-center text-muted-foreground text-sm">
                    Aucune donnée OCR disponible. L'extraction n'a pas encore été effectuée.
                  </div>
                )}

                {/* Linked orders */}
                {linkedOrders.length > 0 && (
                  <div className="mt-4 p-3 bg-muted rounded-lg border border-border">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">Commandes liées :</p>
                    {linkedOrders.map((order: any) => (
                      <div key={order.id} className="flex items-center justify-between p-2 bg-background rounded border border-border mb-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">{order.order_number}</Badge>
                          <span className="text-xs text-muted-foreground">{order.category}</span>
                          <Badge className={
                            order.status === "confirmed" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                            order.status === "cancelled" ? "bg-red-50 text-red-700 border-red-200" :
                            "bg-amber-50 text-amber-700 border-amber-200"
                          }>{order.status}</Badge>
                        </div>
                        <Button variant="ghost" size="sm" asChild>
                          <a href={`/admin/orders?id=${order.id}`} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {(selectedSession.status === "manual_review" || selectedSession.status === "submitted") && (
                  <Button className="w-full" onClick={() => setReviewDialogOpen(true)}>
                    <FileCheck className="w-4 h-4 mr-2" /> Procéder à la révision
                  </Button>
                )}
              </TabsContent>

              <TabsContent value="documents" className="space-y-4">
                {loadingUrls ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
                  </div>
                ) : signedUrls.front ? (
                  <div className="space-y-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Recto</Label>
                      <div className="mt-2 border border-border rounded-lg overflow-hidden">
                        <img src={signedUrls.front} alt="Recto" className="w-full max-h-72 object-contain bg-muted" />
                      </div>
                    </div>
                    {signedUrls.back && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Verso</Label>
                        <div className="mt-2 border border-border rounded-lg overflow-hidden">
                          <img src={signedUrls.back} alt="Verso" className="w-full max-h-72 object-contain bg-muted" />
                        </div>
                      </div>
                    )}
                    {signedUrls.selfie && (
                      <div>
                        <Label className="text-xs text-muted-foreground flex items-center gap-1">
                          <Camera className="w-3.5 h-3.5" /> Selfie
                        </Label>
                        <div className="mt-2 border border-border rounded-lg overflow-hidden">
                          <img src={signedUrls.selfie} alt="Selfie" className="w-full max-h-72 object-contain bg-muted" />
                        </div>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground text-center">
                      Les URLs signées expirent dans 5 minutes.
                    </p>
                    <Button variant="outline" size="sm" onClick={() => fetchSignedUrls(selectedSession.id)}>
                      <RefreshCw className="w-3.5 h-3.5 mr-1" /> Rafraîchir les images
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">Aucun document soumis.</p>
                )}
              </TabsContent>

              <TabsContent value="info" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">ID Session</Label>
                    <p className="font-mono text-sm">{selectedSession.id}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Statut</Label>
                    <Badge className={STATUS_BADGE[selectedSession.status]?.className}>
                      {STATUS_BADGE[selectedSession.status]?.label}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">User ID</Label>
                    <p className="font-mono text-sm">{selectedSession.user_id}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Type checkout</Label>
                    <p className="text-sm">{selectedSession.checkout_type}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Créée le</Label>
                    <p className="text-sm">{format(new Date(selectedSession.created_at), "d MMM yyyy HH:mm:ss", { locale: fr })}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Expire le</Label>
                    <p className="text-sm">{format(new Date(selectedSession.expires_at), "d MMM yyyy HH:mm:ss", { locale: fr })}</p>
                  </div>
                  {selectedSession.id_type && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Type de pièce</Label>
                      <p className="text-sm">{selectedSession.id_type}</p>
                    </div>
                  )}
                  {selectedSession.id_province && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Province</Label>
                      <p className="text-sm">{selectedSession.id_province}</p>
                    </div>
                  )}
                  <div>
                    <Label className="text-xs text-muted-foreground">Tentatives</Label>
                    <p className="text-sm">{selectedSession.submission_attempts || 0} / {selectedSession.max_attempts || 3}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Régénérations QR</Label>
                    <p className="text-sm">{selectedSession.qr_regeneration_count || 0} / 3</p>
                  </div>
                </div>

                {(selectedSession.client_ip || selectedSession.client_user_agent) && (
                  <div className="p-3 bg-muted rounded-lg space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Informations client</p>
                    {selectedSession.client_ip && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Globe className="w-3.5 h-3.5" />
                        <span>IP: {selectedSession.client_ip}</span>
                      </div>
                    )}
                    {selectedSession.client_user_agent && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Monitor className="w-3.5 h-3.5" />
                        <span className="truncate">{selectedSession.client_user_agent}</span>
                      </div>
                    )}
                  </div>
                )}

                {selectedSession.review_reason && (
                  <div className="p-3 bg-muted rounded-lg">
                    <Label className="text-xs text-muted-foreground">Raison de la décision</Label>
                    <p className="text-sm mt-1">{selectedSession.review_reason}</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="audit" className="space-y-3">
                {sessionEvents.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Aucun événement.</p>
                ) : (
                  sessionEvents.map((event: any) => (
                    <div key={event.id} className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                      <Calendar className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-foreground">{event.event_type}</p>
                          {event.actor_role && (
                            <Badge variant="outline" className="text-xs">{event.actor_role}</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {format(new Date(event.created_at), "d MMM yyyy HH:mm:ss", { locale: fr })}
                        </p>
                        {event.ip_address && (
                          <p className="text-xs text-muted-foreground">IP: {event.ip_address}</p>
                        )}
                        {event.details && Object.keys(event.details).length > 0 && (
                          <pre className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap bg-background p-2 rounded border border-border">
                            {JSON.stringify(event.details, null, 2)}
                          </pre>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Review decision dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Décision de vérification</DialogTitle>
          </DialogHeader>

          {/* Show mismatch summary in review dialog */}
          {selectedSession?.match_result?.status && selectedSession.match_result.status !== "approved_candidate" && (
            <div className={`p-3 rounded-lg border ${
              selectedSession.match_result.status === "mismatch" ? "bg-destructive/10 border-destructive/20" : "bg-amber-50 border-amber-200"
            }`}>
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className={`w-4 h-4 ${
                  selectedSession.match_result.status === "mismatch" ? "text-destructive" : "text-amber-600"
                }`} />
                <span className="text-sm font-semibold">
                  {selectedSession.match_result.status === "mismatch" ? "⚠ MISMATCH BLOQUANT" : "⚠ Correspondance partielle"}
                </span>
                <Badge variant="outline">{selectedSession.match_result.match_score}%</Badge>
              </div>
              {selectedSession.match_result.mismatch_fields && Object.entries(selectedSession.match_result.mismatch_fields).map(([field, info]: [string, any]) => (
                <p key={field} className="text-xs text-muted-foreground ml-6">
                  <strong>{field}</strong>: "{info.expected}" → "{info.extracted}" ({info.severity})
                </p>
              ))}
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Décision *</Label>
              <Select value={reviewDecision} onValueChange={(v: any) => setReviewDecision(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="approved">✓ Approuver — activer les services</SelectItem>
                  <SelectItem value="rejected">✗ Refuser — annuler la commande</SelectItem>
                  <SelectItem value="manual_review">⚠ Garder en révision</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>
                {reviewDecision === "rejected" ? "Raison du refus *" : "Note interne *"}
              </Label>
              <Textarea
                value={reviewReason}
                onChange={(e) => setReviewReason(e.target.value)}
                placeholder={
                  reviewDecision === "rejected"
                    ? "Décrivez la raison du refus..."
                    : "Ajoutez une note interne obligatoire..."
                }
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleReview}
              disabled={!reviewReason.trim() || reviewMutation.isPending}
              className={
                reviewDecision === "approved" ? "bg-emerald-600 hover:bg-emerald-700" :
                reviewDecision === "rejected" ? "bg-destructive hover:bg-destructive/90" :
                "bg-amber-600 hover:bg-amber-700"
              }
            >
              {reviewMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirmer la décision
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminIdentityVerification;
