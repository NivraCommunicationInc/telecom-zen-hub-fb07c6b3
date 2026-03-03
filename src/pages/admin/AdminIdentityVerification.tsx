/**
 * Admin Identity Verification Dashboard
 * View sessions, review documents, approve/reject with mandatory reason, audit trail.
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
import { 
  Shield, CheckCircle2, XCircle, Clock, AlertCircle, Eye, 
  Search, RefreshCw, FileCheck, User, Calendar, Loader2
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminClient as dbClient } from "@/integrations/backend";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const STATUS_BADGE: Record<string, { label: string; variant: string; className: string }> = {
  created: { label: "Créée", variant: "outline", className: "bg-blue-50 text-blue-700 border-blue-200" },
  submitted: { label: "Soumise", variant: "outline", className: "bg-amber-50 text-amber-700 border-amber-200" },
  approved: { label: "Approuvée", variant: "outline", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  rejected: { label: "Refusée", variant: "outline", className: "bg-red-50 text-red-700 border-red-200" },
  manual_review: { label: "Révision", variant: "outline", className: "bg-purple-50 text-purple-700 border-purple-200" },
  expired: { label: "Expirée", variant: "outline", className: "bg-slate-50 text-slate-500 border-slate-200" },
};

const AdminIdentityVerification = () => {
  const queryClient = useQueryClient();
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewDecision, setReviewDecision] = useState<"approved" | "rejected" | "manual_review">("approved");
  const [reviewReason, setReviewReason] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

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

  // Get document URLs for viewing
  const getDocumentUrl = (path: string | null) => {
    if (!path) return null;
    const { data } = dbClient.storage.from("id-documents").getPublicUrl(path);
    return data?.publicUrl;
  };

  const filteredSessions = sessions.filter((s: any) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      s.id?.toLowerCase().includes(term) ||
      s.user_id?.toLowerCase().includes(term) ||
      s.checkout_type?.toLowerCase().includes(term)
    );
  });

  const pendingCount = sessions.filter((s: any) => s.status === "submitted").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-slate-700" />
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Vérification d'identité</h1>
            <p className="text-sm text-slate-500">Gérer les sessions de vérification QR</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {pendingCount > 0 && (
            <Badge className="bg-amber-100 text-amber-800 border-amber-300">
              {pendingCount} en attente
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
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Rechercher par ID de session ou utilisateur..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="submitted">Soumises (en attente)</SelectItem>
            <SelectItem value="approved">Approuvées</SelectItem>
            <SelectItem value="rejected">Refusées</SelectItem>
            <SelectItem value="created">Créées</SelectItem>
            <SelectItem value="expired">Expirées</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Sessions table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
        </div>
      ) : filteredSessions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-slate-500">
            Aucune session de vérification trouvée.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredSessions.map((session: any) => {
            const statusBadge = STATUS_BADGE[session.status] || STATUS_BADGE.created;
            return (
              <Card
                key={session.id}
                className={`cursor-pointer hover:shadow-md transition-shadow ${
                  session.status === "submitted" ? "border-amber-200 bg-amber-50/30" : ""
                }`}
                onClick={() => setSelectedSession(session)}
              >
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="font-mono text-xs text-slate-400">{session.id.slice(0, 8)}...</p>
                        <p className="text-sm font-medium text-slate-700 mt-1">
                          {session.checkout_type === "internet" ? "Internet" : session.checkout_type === "tv" ? "TV" : "Mobile"}
                        </p>
                      </div>
                      <Badge className={statusBadge.className}>{statusBadge.label}</Badge>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-xs text-slate-400">
                          {format(new Date(session.created_at), "d MMM yyyy HH:mm", { locale: fr })}
                        </p>
                        {session.id_type && (
                          <p className="text-xs text-slate-500 mt-1">{session.id_type}</p>
                        )}
                      </div>
                      {session.status === "submitted" && (
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedSession(session);
                            setReviewDialogOpen(true);
                          }}
                        >
                          <Eye className="w-4 h-4 mr-1" /> Réviser
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Session detail dialog */}
      <Dialog open={!!selectedSession && !reviewDialogOpen} onOpenChange={(o) => !o && setSelectedSession(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Détails de la session
            </DialogTitle>
          </DialogHeader>
          
          {selectedSession && (
            <Tabs defaultValue="info">
              <TabsList>
                <TabsTrigger value="info">Informations</TabsTrigger>
                <TabsTrigger value="documents">Documents</TabsTrigger>
                <TabsTrigger value="audit">Historique</TabsTrigger>
              </TabsList>

              <TabsContent value="info" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-slate-500">ID Session</Label>
                    <p className="font-mono text-sm">{selectedSession.id}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500">Statut</Label>
                    <Badge className={STATUS_BADGE[selectedSession.status]?.className}>
                      {STATUS_BADGE[selectedSession.status]?.label}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500">User ID</Label>
                    <p className="font-mono text-sm">{selectedSession.user_id}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500">Type checkout</Label>
                    <p className="text-sm">{selectedSession.checkout_type}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500">Créée le</Label>
                    <p className="text-sm">{format(new Date(selectedSession.created_at), "d MMM yyyy HH:mm:ss", { locale: fr })}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500">Expire le</Label>
                    <p className="text-sm">{format(new Date(selectedSession.expires_at), "d MMM yyyy HH:mm:ss", { locale: fr })}</p>
                  </div>
                  {selectedSession.id_type && (
                    <div>
                      <Label className="text-xs text-slate-500">Type de pièce</Label>
                      <p className="text-sm">{selectedSession.id_type}</p>
                    </div>
                  )}
                  {selectedSession.id_province && (
                    <div>
                      <Label className="text-xs text-slate-500">Province</Label>
                      <p className="text-sm">{selectedSession.id_province}</p>
                    </div>
                  )}
                  {selectedSession.review_reason && (
                    <div className="col-span-2">
                      <Label className="text-xs text-slate-500">Raison de la décision</Label>
                      <p className="text-sm">{selectedSession.review_reason}</p>
                    </div>
                  )}
                </div>

                {selectedSession.status === "submitted" && (
                  <Button
                    className="w-full"
                    onClick={() => setReviewDialogOpen(true)}
                  >
                    <FileCheck className="w-4 h-4 mr-2" /> Procéder à la révision
                  </Button>
                )}
              </TabsContent>

              <TabsContent value="documents" className="space-y-4">
                {selectedSession.document_front_path ? (
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs text-slate-500">Recto</Label>
                      <div className="mt-2 border border-slate-200 rounded-lg overflow-hidden">
                        <img 
                          src={getDocumentUrl(selectedSession.document_front_path) || ""} 
                          alt="Recto" 
                          className="w-full max-h-64 object-contain bg-slate-50"
                        />
                      </div>
                    </div>
                    {selectedSession.document_back_path && (
                      <div>
                        <Label className="text-xs text-slate-500">Verso</Label>
                        <div className="mt-2 border border-slate-200 rounded-lg overflow-hidden">
                          <img 
                            src={getDocumentUrl(selectedSession.document_back_path) || ""} 
                            alt="Verso" 
                            className="w-full max-h-64 object-contain bg-slate-50"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 text-center py-8">Aucun document soumis.</p>
                )}
              </TabsContent>

              <TabsContent value="audit" className="space-y-3">
                {sessionEvents.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-8">Aucun événement.</p>
                ) : (
                  sessionEvents.map((event: any) => (
                    <div key={event.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                      <Calendar className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-slate-700">{event.event_type}</p>
                        <p className="text-xs text-slate-400">
                          {format(new Date(event.created_at), "d MMM yyyy HH:mm:ss", { locale: fr })}
                          {event.actor_role && ` — ${event.actor_role}`}
                        </p>
                        {event.details && Object.keys(event.details).length > 0 && (
                          <pre className="text-xs text-slate-500 mt-1 whitespace-pre-wrap">
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Décision de vérification</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Décision *</Label>
              <Select value={reviewDecision} onValueChange={(v: any) => setReviewDecision(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="approved">✓ Approuver</SelectItem>
                  <SelectItem value="rejected">✗ Refuser</SelectItem>
                  <SelectItem value="manual_review">⚠ Révision manuelle requise</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Raison obligatoire *</Label>
              <Textarea
                value={reviewReason}
                onChange={(e) => setReviewReason(e.target.value)}
                placeholder="Décrivez la raison de votre décision..."
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
                reviewDecision === "rejected" ? "bg-red-600 hover:bg-red-700" :
                "bg-amber-600 hover:bg-amber-700"
              }
            >
              {reviewMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              Confirmer la décision
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminIdentityVerification;
