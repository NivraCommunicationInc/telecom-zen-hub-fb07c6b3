/**
 * KYC Session Panel for Admin Order Details
 * Shows KYC status, document photos via signed URLs, and approve/reject actions.
 */
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter, DrawerClose } from "@/components/ui/drawer";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Shield, Eye, CheckCircle, XCircle, Loader2, Camera, RefreshCw, AlertTriangle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminClient as supabase } from "@/integrations/backend";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface KYCSessionPanelProps {
  orderId: string;
  sessionId: string;
  orderStatus: string;
  onDecision: () => void;
}

const KYC_STATUS: Record<string, { label: string; className: string }> = {
  created: { label: "Créée", className: "bg-blue-50 text-blue-700 border-blue-200" },
  submitted: { label: "Soumise", className: "bg-amber-50 text-amber-700 border-amber-200" },
  manual_review: { label: "Révision requise", className: "bg-purple-50 text-purple-700 border-purple-200" },
  approved: { label: "Approuvée", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  rejected: { label: "Refusée", className: "bg-red-50 text-red-700 border-red-200" },
  expired: { label: "Expirée", className: "bg-muted text-muted-foreground" },
};

export const KYCSessionPanel = ({ orderId, sessionId, orderStatus, onDecision }: KYCSessionPanelProps) => {
  const queryClient = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [signedUrls, setSignedUrls] = useState<Record<string, string | null>>({});
  const [loadingUrls, setLoadingUrls] = useState(false);
  const [reviewReason, setReviewReason] = useState("");

  // Fetch session
  const { data: session, isLoading } = useQuery({
    queryKey: ["kyc-session", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("identity_verification_sessions")
        .select("*")
        .eq("id", sessionId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const fetchSignedUrls = async () => {
    setLoadingUrls(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-review-verification", {
        body: { action: "get_signed_urls", session_id: sessionId },
      });
      if (error) throw error;
      setSignedUrls(data?.urls || {});
    } catch {
      toast.error("Erreur lors du chargement des documents");
    } finally {
      setLoadingUrls(false);
    }
  };

  const handleOpenDrawer = () => {
    setDrawerOpen(true);
    setReviewReason("");
    fetchSignedUrls();
  };

  // Approve/reject mutation
  const reviewMutation = useMutation({
    mutationFn: async ({ decision, reason }: { decision: string; reason: string }) => {
      const { data, error } = await supabase.functions.invoke("admin-review-verification", {
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
    onSuccess: (_, variables) => {
      toast.success(variables.decision === "approved" ? "KYC approuvé — commande confirmée" : "KYC refusé — commande annulée");
      queryClient.invalidateQueries({ queryKey: ["kyc-session", sessionId] });
      setDrawerOpen(false);
      onDecision();
    },
    onError: (err: any) => {
      toast.error(err.message || "Erreur");
    },
  });

  const handleDecision = (decision: "approved" | "rejected") => {
    if (!reviewReason.trim()) {
      toast.error("La note/raison est obligatoire");
      return;
    }
    reviewMutation.mutate({ decision, reason: reviewReason });
  };

  if (isLoading) {
    return (
      <Card className="border-purple-500/30 bg-purple-500/5">
        <CardContent className="py-6 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!session) return null;

  const statusBadge = KYC_STATUS[session.status] || KYC_STATUS.created;
  const canReview = session.status === "manual_review" || session.status === "submitted";

  return (
    <>
      <Card className="border-purple-500/30 bg-purple-500/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="w-4 h-4 text-purple-500" />
            Vérification d'identité (KYC)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Badge className={statusBadge.className}>{statusBadge.label}</Badge>
              <span className="text-xs text-muted-foreground font-mono">{sessionId.slice(0, 12)}...</span>
            </div>
            <Button size="sm" variant="outline" onClick={handleOpenDrawer}>
              <Eye className="w-4 h-4 mr-1" /> Voir documents
            </Button>
          </div>
          {session.id_type && (
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div><Label className="text-xs text-muted-foreground">Type</Label><p>{session.id_type}</p></div>
              <div><Label className="text-xs text-muted-foreground">Province</Label><p>{session.id_province || "—"}</p></div>
              <div><Label className="text-xs text-muted-foreground">Soumis</Label><p>{session.submitted_at ? format(new Date(session.submitted_at), "d MMM HH:mm", { locale: fr }) : "—"}</p></div>
            </div>
          )}
          {session.reviewed_at && (
            <div className="text-xs text-muted-foreground">
              Décision le {format(new Date(session.reviewed_at), "d MMM yyyy HH:mm", { locale: fr })} — {session.review_reason}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Document Viewer Drawer */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader className="border-b border-border pb-3">
            <DrawerTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Documents KYC — Commande
              <Badge className={statusBadge.className}>{statusBadge.label}</Badge>
            </DrawerTitle>
          </DrawerHeader>

          <ScrollArea className="flex-1 px-4 pb-4 overflow-y-auto" style={{ maxHeight: "calc(90vh - 140px)" }}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 py-4">
              {/* LEFT: Photos */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Camera className="w-4 h-4" /> Documents soumis
                </h3>
                {loadingUrls ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
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
                    <Button variant="ghost" size="sm" onClick={fetchSignedUrls}>
                      <RefreshCw className="w-3 h-3 mr-1" /> Rafraîchir URLs (5 min)
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-4">Aucun document soumis.</p>
                )}

                {/* Session info */}
                <div className="p-3 bg-muted rounded-lg space-y-1.5 text-xs">
                  <div className="flex justify-between"><span className="text-muted-foreground">Session</span><span className="font-mono">{sessionId.slice(0, 12)}...</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Type pièce</span><span>{session.id_type || "—"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Province</span><span>{session.id_province || "—"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Tentatives</span><span>{session.submission_attempts || 0}/{session.max_attempts || 3}</span></div>
                  {session.client_ip && <div className="flex justify-between"><span className="text-muted-foreground">IP</span><span>{session.client_ip}</span></div>}
                </div>
              </div>

              {/* RIGHT: OCR + Decision */}
              <div className="space-y-4">
                {/* OCR Match */}
                {session.match_result && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold">Correspondance OCR</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">Score :</span>
                      <span className={`text-xl font-bold ${
                        session.match_result.match_score >= 100 ? "text-emerald-600" :
                        session.match_result.match_score >= 60 ? "text-amber-600" : "text-destructive"
                      }`}>
                        {session.match_result.match_score}%
                      </span>
                    </div>
                    {session.match_result.status === "mismatch" && (
                      <div className="p-2 rounded-lg bg-destructive/10 border border-destructive/20 text-xs flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
                        <span className="font-semibold">MISMATCH détecté</span>
                      </div>
                    )}
                  </div>
                )}

                {!session.match_result && (
                  <div className="py-4 text-center text-muted-foreground text-sm border border-dashed border-border rounded-lg">
                    OCR pas encore disponible — extraction en cours ou non déclenchée.
                  </div>
                )}

                {/* Decision actions */}
                {canReview && (
                  <div className="space-y-3 p-4 bg-card border border-border rounded-lg">
                    <h3 className="text-sm font-semibold">Décision KYC</h3>

                    <Textarea
                      value={reviewReason}
                      onChange={(e) => setReviewReason(e.target.value)}
                      placeholder="Note / raison (obligatoire)..."
                      rows={2}
                    />

                    <div className="flex gap-2">
                      <Button
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                        onClick={() => handleDecision("approved")}
                        disabled={!reviewReason.trim() || reviewMutation.isPending}
                      >
                        {reviewMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        <CheckCircle className="w-4 h-4 mr-1" /> Approuver
                      </Button>
                      <Button
                        variant="destructive"
                        className="flex-1"
                        onClick={() => handleDecision("rejected")}
                        disabled={!reviewReason.trim() || reviewMutation.isPending}
                      >
                        <XCircle className="w-4 h-4 mr-1" /> Refuser
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Approuver → commande confirmée. Refuser → commande annulée.
                    </p>
                  </div>
                )}

                {/* Already reviewed */}
                {session.review_reason && (
                  <div className="p-3 bg-muted rounded-lg">
                    <Label className="text-xs text-muted-foreground">Raison de la décision</Label>
                    <p className="text-sm mt-1">{session.review_reason}</p>
                    {session.reviewed_at && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(session.reviewed_at), "d MMM yyyy HH:mm", { locale: fr })}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>

          <DrawerFooter className="border-t border-border pt-3">
            <DrawerClose asChild>
              <Button variant="outline">Fermer</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
};
