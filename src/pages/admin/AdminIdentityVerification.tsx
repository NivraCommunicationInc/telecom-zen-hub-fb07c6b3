/**
 * Admin Identity Verification Dashboard
 * View sessions, review documents (signed URLs), approve/reject with mandatory reason, audit trail.
 * Features: urgent mismatch filter, side-by-side diff, highlight mismatches, order link.
 * Uses Drawer for advanced review (photos + order + actions in one panel).
 */
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter, DrawerClose } from "@/components/ui/drawer";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Shield, CheckCircle2, XCircle, Clock, AlertCircle, Eye,
  Search, RefreshCw, FileCheck, User, Calendar, Loader2, Globe, Monitor, Camera,
  AlertTriangle, ArrowRight, ExternalLink, Package
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminClient as dbClient } from "@/integrations/backend";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

// ... keep existing code (STATUS_BADGE, MATCH_STATUS_BADGE, SEVERITY_COLORS, MismatchDiff)

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  created: { label: "Créée", className: "bg-blue-50 text-blue-700 border-blue-200" },
  submitted: { label: "Soumise", className: "bg-amber-50 text-amber-700 border-amber-200" },
  approved: { label: "Approuvée", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  rejected: { label: "Refusée", className: "bg-red-50 text-red-700 border-red-200" },
  manual_review: { label: "Révision requise", className: "bg-purple-50 text-purple-700 border-purple-200" },
  expired: { label: "Expirée", className: "bg-slate-50 text-slate-500 border-slate-200" },
  pending_verification: { label: "Vérification en attente", className: "bg-amber-50 text-amber-700 border-amber-200" },
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
  const [drawerOpen, setDrawerOpen] = useState(false);
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
        .select("id, order_number, status, created_at, category, total_amount")
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
      setDrawerOpen(false);
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
    setReviewReason("");
    setReviewDecision("approved");
    setDrawerOpen(true);
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

      {/* Advanced Review Drawer — all-in-one: photos + order + match + actions */}
      <Drawer open={drawerOpen} onOpenChange={(o) => { setDrawerOpen(o); if (!o) setSelectedSession(null); }}>
        <DrawerContent className="max-h-[92vh]">
          <DrawerHeader className="border-b border-border pb-3">
            <DrawerTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Révision avancée
              {selectedSession?.match_result?.status && (
                <Badge className={MATCH_STATUS_BADGE[selectedSession.match_result.status]?.className || ""}>
                  {MATCH_STATUS_BADGE[selectedSession.match_result.status]?.label}
                </Badge>
              )}
              {selectedSession && (
                <Badge className={STATUS_BADGE[selectedSession.status]?.className || ""}>
                  {STATUS_BADGE[selectedSession.status]?.label}
                </Badge>
              )}
            </DrawerTitle>
          </DrawerHeader>

          {selectedSession && (
            <ScrollArea className="flex-1 px-4 pb-4 overflow-y-auto" style={{ maxHeight: "calc(92vh - 160px)" }}>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 py-4">
                {/* LEFT: Documents + Photos */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Camera className="w-4 h-4" /> Documents soumis
                  </h3>
                  {loadingUrls ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
                    </div>
                  ) : signedUrls.front ? (
                    <div className="space-y-3">
                      <div>
                        <Label className="text-xs text-muted-foreground">Recto</Label>
                        <div className="mt-1 border border-border rounded-lg overflow-hidden">
                          <img src={signedUrls.front} alt="Recto" className="w-full max-h-56 object-contain bg-muted" />
                        </div>
                      </div>
                      {signedUrls.back && (
                        <div>
                          <Label className="text-xs text-muted-foreground">Verso</Label>
                          <div className="mt-1 border border-border rounded-lg overflow-hidden">
                            <img src={signedUrls.back} alt="Verso" className="w-full max-h-56 object-contain bg-muted" />
                          </div>
                        </div>
                      )}
                      {signedUrls.selfie && (
                        <div>
                          <Label className="text-xs text-muted-foreground flex items-center gap-1">
                            <Camera className="w-3.5 h-3.5" /> Selfie
                          </Label>
                          <div className="mt-1 border border-border rounded-lg overflow-hidden">
                            <img src={signedUrls.selfie} alt="Selfie" className="w-full max-h-56 object-contain bg-muted" />
                          </div>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-muted-foreground">URLs signées: 5 min</p>
                        <Button variant="ghost" size="sm" onClick={() => fetchSignedUrls(selectedSession.id)}>
                          <RefreshCw className="w-3 h-3 mr-1" /> Rafraîchir
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground py-4">Aucun document soumis.</p>
                  )}

                  {/* Session info summary */}
                  <div className="p-3 bg-muted rounded-lg space-y-1.5 text-xs">
                    <div className="flex justify-between"><span className="text-muted-foreground">ID Session</span><span className="font-mono">{selectedSession.id.slice(0, 12)}...</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Type checkout</span><span>{selectedSession.checkout_type}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Pièce</span><span>{selectedSession.id_type || "—"}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Province</span><span>{selectedSession.id_province || "—"}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Tentatives</span><span>{selectedSession.submission_attempts || 0}/{selectedSession.max_attempts || 3}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Créée</span><span>{format(new Date(selectedSession.created_at), "d MMM yyyy HH:mm", { locale: fr })}</span></div>
                    {selectedSession.submitted_at && (
                      <div className="flex justify-between"><span className="text-muted-foreground">Soumise</span><span>{format(new Date(selectedSession.submitted_at), "d MMM yyyy HH:mm:ss", { locale: fr })}</span></div>
                    )}
                    {selectedSession.client_ip && (
                      <div className="flex justify-between"><span className="text-muted-foreground">IP</span><span>{selectedSession.client_ip}</span></div>
                    )}
                  </div>
                </div>

                {/* RIGHT: Match diff + Order + Actions */}
                <div className="space-y-4">
                  {/* OCR Match Result */}
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <FileCheck className="w-4 h-4" /> Correspondance OCR
                  </h3>
                  {selectedSession.match_result ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-foreground">Score :</span>
                        <span className={`text-2xl font-bold ${
                          selectedSession.match_result.match_score >= 100 ? "text-emerald-600" :
                          selectedSession.match_result.match_score >= 60 ? "text-amber-600" : "text-destructive"
                        }`}>
                          {selectedSession.match_result.match_score}%
                        </span>
                        {selectedSession.match_result.status === "approved_candidate" && (
                          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Candidat
                          </Badge>
                        )}
                      </div>
                      <MismatchDiff matchResult={selectedSession.match_result} checkoutFields={selectedSession.checkout_fields} />
                    </div>
                  ) : (
                    <div className="py-4 text-center text-muted-foreground text-sm border border-dashed border-border rounded-lg">
                      OCR pas encore disponible — l'extraction est en cours ou n'a pas été déclenchée.
                    </div>
                  )}

                  {/* Linked Orders */}
                  {linkedOrders.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <Package className="w-4 h-4" /> Commandes liées ({linkedOrders.length})
                      </h3>
                      {linkedOrders.map((order: any) => (
                        <div key={order.id} className="flex items-center justify-between p-3 bg-muted rounded-lg border border-border">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs font-mono">{order.order_number}</Badge>
                            <span className="text-xs text-muted-foreground">{order.category}</span>
                            {order.total_amount != null && (
                              <span className="text-xs font-medium">${Number(order.total_amount).toFixed(2)}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={
                              order.status === "confirmed" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                              order.status === "cancelled" ? "bg-red-50 text-red-700 border-red-200" :
                              order.status === "pending_verification" ? "bg-amber-50 text-amber-700 border-amber-200" :
                              "bg-blue-50 text-blue-700 border-blue-200"
                            }>{order.status}</Badge>
                            <Button variant="ghost" size="sm" asChild>
                              <a href={`/admin/orders?id=${order.id}`} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Audit Trail (compact) */}
                  {sessionEvents.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <Calendar className="w-4 h-4" /> Historique ({sessionEvents.length})
                      </h3>
                      <div className="max-h-40 overflow-y-auto space-y-1.5">
                        {sessionEvents.map((event: any) => (
                          <div key={event.id} className="flex items-center gap-2 p-2 bg-muted rounded text-xs">
                            <span className="font-medium text-foreground">{event.event_type}</span>
                            {event.actor_role && <Badge variant="outline" className="text-[10px]">{event.actor_role}</Badge>}
                            <span className="text-muted-foreground ml-auto">{format(new Date(event.created_at), "HH:mm:ss", { locale: fr })}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Review Decision */}
                  {(selectedSession.status === "manual_review" || selectedSession.status === "submitted") && (
                    <div className="space-y-3 p-4 bg-card border border-border rounded-lg">
                      <h3 className="text-sm font-semibold text-foreground">Décision</h3>

                      {/* Mismatch warning */}
                      {selectedSession.match_result?.status && selectedSession.match_result.status !== "approved_candidate" && (
                        <div className={`p-2 rounded-lg border text-xs ${
                          selectedSession.match_result.status === "mismatch" ? "bg-destructive/10 border-destructive/20" : "bg-amber-50 border-amber-200"
                        }`}>
                          <div className="flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
                            <span className="font-semibold">
                              {selectedSession.match_result.status === "mismatch" ? "⚠ MISMATCH" : "⚠ Partiel"}
                            </span>
                            <Badge variant="outline" className="text-[10px]">{selectedSession.match_result.match_score}%</Badge>
                          </div>
                        </div>
                      )}

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

                      <Textarea
                        value={reviewReason}
                        onChange={(e) => setReviewReason(e.target.value)}
                        placeholder={reviewDecision === "rejected" ? "Raison du refus (obligatoire)..." : "Note interne (obligatoire)..."}
                        rows={2}
                      />

                      <Button
                        onClick={handleReview}
                        disabled={!reviewReason.trim() || reviewMutation.isPending}
                        className={`w-full ${
                          reviewDecision === "approved" ? "bg-emerald-600 hover:bg-emerald-700" :
                          reviewDecision === "rejected" ? "bg-destructive hover:bg-destructive/90" :
                          "bg-amber-600 hover:bg-amber-700"
                        }`}
                      >
                        {reviewMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Confirmer la décision
                      </Button>
                    </div>
                  )}

                  {/* Already reviewed */}
                  {selectedSession.review_reason && (
                    <div className="p-3 bg-muted rounded-lg">
                      <Label className="text-xs text-muted-foreground">Raison de la décision</Label>
                      <p className="text-sm mt-1">{selectedSession.review_reason}</p>
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>
          )}

          <DrawerFooter className="border-t border-border pt-3">
            <DrawerClose asChild>
              <Button variant="outline">Fermer</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
};

export default AdminIdentityVerification;
