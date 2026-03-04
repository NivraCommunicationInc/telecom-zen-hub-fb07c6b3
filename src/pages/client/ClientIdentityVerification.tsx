/**
 * Client Portal - Identity Verification Status & Resubmission
 * Route: /portal/identity-verification
 * Shows KYC status, timeline, and resubmission flow.
 */
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import ClientLayout from "@/components/client/ClientLayout";
import {
  Shield, CheckCircle2, XCircle, Clock, Loader2, Camera,
  Upload, AlertTriangle, RotateCcw, QrCode, Smartphone, FileCheck
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { portalClient } from "@/integrations/backend/portalClient";
import { useClientAuth } from "@/hooks/useClientAuth";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import QRVerificationStep from "@/components/checkout/QRVerificationStep";

const STATUS_CLIENT: Record<string, { label: string; description: string; className: string; icon: typeof Shield }> = {
  created: { label: "En attente", description: "Veuillez scanner le code QR et soumettre vos documents.", className: "bg-blue-50 text-blue-700 border-blue-200", icon: Clock },
  submitted: { label: "Documents soumis", description: "Vos documents ont été reçus et sont en cours de traitement.", className: "bg-amber-50 text-amber-700 border-amber-200", icon: FileCheck },
  manual_review: { label: "En cours de révision", description: "Un agent examine vos documents. Vous serez notifié du résultat.", className: "bg-purple-50 text-purple-700 border-purple-200", icon: Shield },
  approved: { label: "Vérification approuvée", description: "Votre identité a été confirmée. Votre commande est en cours de traitement.", className: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  rejected: { label: "Vérification refusée", description: "Votre vérification a été refusée. Veuillez contacter le support pour plus d'informations.", className: "bg-red-50 text-red-700 border-red-200", icon: XCircle },
  expired: { label: "Expirée", description: "Le lien de vérification a expiré. Vous pouvez en générer un nouveau.", className: "bg-slate-100 text-slate-500 border-slate-200", icon: Clock },
  resubmission_required: { label: "Resoumission requise", description: "L'administrateur a demandé de nouveaux documents. Veuillez resoumettre.", className: "bg-orange-50 text-orange-700 border-orange-200", icon: RotateCcw },
};

const ClientIdentityVerification = () => {
  const { user } = useClientAuth();
  const [showQR, setShowQR] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent));
  }, []);

  // Fetch user's verification sessions
  const { data: sessions = [], isLoading, refetch } = useQuery({
    queryKey: ["client-kyc-sessions", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await portalClient
        .from("identity_verification_sessions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Fetch linked orders for sessions
  const sessionIds = sessions.map((s: any) => s.id);
  const { data: linkedOrders = [] } = useQuery({
    queryKey: ["client-kyc-orders", sessionIds.join(",")],
    queryFn: async () => {
      if (sessionIds.length === 0) return [];
      const { data } = await portalClient
        .from("orders")
        .select("id, order_number, status, identity_verification_session_id")
        .in("identity_verification_session_id", sessionIds);
      return data || [];
    },
    enabled: sessionIds.length > 0,
  });

  const orderMap = Object.fromEntries(linkedOrders.map((o: any) => [o.identity_verification_session_id, o]));

  // Fetch events for the latest session
  const latestSession = sessions[0];
  const { data: events = [] } = useQuery({
    queryKey: ["client-kyc-events", latestSession?.id],
    queryFn: async () => {
      if (!latestSession?.id) return [];
      const { data } = await portalClient
        .from("identity_verification_events")
        .select("id, event_type, created_at, actor_role")
        .eq("session_id", latestSession.id)
        .order("created_at", { ascending: true });
      return data || [];
    },
    enabled: !!latestSession?.id,
  });

  const canResubmit = latestSession?.status === "resubmission_required" || latestSession?.status === "created";
  const needsVerification = !latestSession || latestSession.status === "expired";

  const handleVerificationApproved = () => {
    setShowQR(false);
    refetch();
    toast.success("Documents soumis avec succès !");
  };

  return (
    <ClientLayout>
      <div className="space-y-6 max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-teal-700" />
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Vérification d'identité</h1>
            <p className="text-sm text-slate-500">Consultez le statut de votre vérification d'identité</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
        ) : needsVerification && !showQR ? (
          /* No session yet - offer to start verification */
          <Card className="border-teal-200">
            <CardContent className="py-8 text-center space-y-4">
              <Shield className="w-12 h-12 text-teal-600 mx-auto" />
              <h2 className="text-lg font-semibold text-slate-900">Aucune vérification en cours</h2>
              <p className="text-slate-500 text-sm max-w-md mx-auto">
                Pour effectuer certaines opérations, une vérification d'identité peut être requise.
                Vous pouvez démarrer le processus dès maintenant.
              </p>
              <Button onClick={() => setShowQR(true)} className="bg-teal-700 hover:bg-teal-800 text-white">
                {isMobile ? (
                  <><Camera className="w-4 h-4 mr-2" /> Prendre des photos maintenant</>
                ) : (
                  <><QrCode className="w-4 h-4 mr-2" /> Démarrer la vérification</>
                )}
              </Button>
            </CardContent>
          </Card>
        ) : showQR ? (
          /* QR / capture step */
          <Card>
            <CardContent className="py-6">
              <QRVerificationStep
                userId={user?.id || ""}
                checkoutType="portal"
                isFrench={true}
                onVerified={(sessionId) => {
                  handleVerificationApproved();
                }}
                onSessionGenerated={(sessionId) => {
                  // Session created, will refresh on submit
                }}
              />
              <div className="mt-4 text-center">
                <Button variant="outline" onClick={() => { setShowQR(false); refetch(); }}>Annuler</Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          /* Show session(s) */
          <>
            {sessions.map((session: any, idx: number) => {
              const sc = STATUS_CLIENT[session.status] || STATUS_CLIENT.created;
              const StatusIcon = sc.icon;
              const order = orderMap[session.id];
              const isLatest = idx === 0;

              return (
                <Card key={session.id} className={`${isLatest ? "border-teal-200 shadow-sm" : "opacity-75"}`}>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <StatusIcon className="w-5 h-5" />
                        <span className="text-base">{sc.label}</span>
                        <Badge className={sc.className}>{session.status}</Badge>
                      </div>
                      {isLatest && <Badge variant="outline" className="text-xs">Dernière</Badge>}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-slate-600">{sc.description}</p>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <Label className="text-xs text-slate-400">N° de dossier</Label>
                        <p className="font-mono font-semibold">{session.case_number || "—"}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-slate-400">Commande liée</Label>
                        <p className="font-mono">{order?.order_number || "Aucune"}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-slate-400">Date de création</Label>
                        <p>{format(new Date(session.created_at), "d MMMM yyyy à HH:mm", { locale: fr })}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-slate-400">Dernière mise à jour</Label>
                        <p>{format(new Date(session.updated_at), "d MMMM yyyy à HH:mm", { locale: fr })}</p>
                      </div>
                    </div>

                    {/* Rejection reason */}
                    {session.status === "rejected" && session.review_reason && (
                      <div className="p-3 bg-red-50 rounded-lg border border-red-200 text-sm">
                        <p className="font-semibold text-red-800">Raison du refus :</p>
                        <p className="text-red-700 mt-1">{session.review_reason}</p>
                      </div>
                    )}

                    {/* Resubmission prompt */}
                    {session.status === "resubmission_required" && isLatest && (
                      <div className="p-4 bg-orange-50 rounded-lg border border-orange-200 space-y-3">
                        <div className="flex items-center gap-2">
                          <RotateCcw className="w-4 h-4 text-orange-700" />
                          <p className="font-semibold text-orange-800">Nouveaux documents requis</p>
                        </div>
                        {session.review_reason && (
                          <p className="text-sm text-orange-700">{session.review_reason}</p>
                        )}
                        <Button onClick={() => setShowQR(true)} className="bg-orange-600 hover:bg-orange-700 text-white">
                          {isMobile ? (
                            <><Camera className="w-4 h-4 mr-2" /> Prendre les photos</>
                          ) : (
                            <><QrCode className="w-4 h-4 mr-2" /> Scanner le QR code</>
                          )}
                        </Button>
                      </div>
                    )}

                    {/* Timeline for latest session */}
                    {isLatest && events.length > 0 && (
                      <div className="space-y-2">
                        <Separator />
                        <h4 className="text-sm font-semibold text-slate-700">Chronologie</h4>
                        <div className="space-y-2">
                          {events.map((event: any) => {
                            const eventLabels: Record<string, string> = {
                              session_created: "Session créée",
                              documents_submitted: "Documents soumis",
                              admin_approved: "Vérification approuvée",
                              admin_rejected: "Vérification refusée",
                              admin_resubmission_required: "Resoumission demandée",
                              admin_viewed_documents: "Documents consultés",
                              order_activated_on_approval: "Commande activée",
                            };
                            return (
                              <div key={event.id} className="flex items-center gap-3 text-sm">
                                <div className="w-2 h-2 rounded-full bg-teal-500 shrink-0" />
                                <span className="flex-1">{eventLabels[event.event_type] || event.event_type}</span>
                                <span className="text-xs text-slate-400">
                                  {format(new Date(event.created_at), "d MMM HH:mm", { locale: fr })}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </>
        )}
      </div>
    </ClientLayout>
  );
};

export default ClientIdentityVerification;
