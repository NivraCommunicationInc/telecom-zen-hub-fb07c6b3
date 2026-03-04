/**
 * Client Portal - Identity Verification Status & Resubmission
 * Route: /portal/identity-verification
 * Shows KYC status, timeline, and additional doc upload when admin requests resubmission.
 */
import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import ClientLayout from "@/components/client/ClientLayout";
import {
  Shield, CheckCircle2, XCircle, Clock, Loader2, Camera,
  Upload, RotateCcw, QrCode, FileCheck, FileUp, Check
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  resubmission_required: { label: "Documents supplémentaires requis", description: "L'administrateur a demandé des documents supplémentaires. Veuillez les téléverser ci-dessous.", className: "bg-orange-50 text-orange-700 border-orange-200", icon: RotateCcw },
};

const DOC_LABELS: Record<string, string> = {
  proof_of_address: "Preuve d'adresse",
  bank_statement: "Relevé bancaire",
  other_invoice: "Autre facture",
  utility_bill: "Facture de services publics",
  government_letter: "Lettre gouvernementale",
};

const ClientIdentityVerification = () => {
  const { user } = useClientAuth();
  const queryClient = useQueryClient();
  const [showQR, setShowQR] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const [uploadedDocs, setUploadedDocs] = useState<Record<string, boolean>>({});
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    setIsMobile(/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent));
  }, []);

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

  const needsVerification = !latestSession || latestSession.status === "expired";
  const requiredDocs: string[] = (latestSession?.required_docs as string[]) || [];
  const isResubmission = latestSession?.status === "resubmission_required";

  const handleUploadDoc = async (docType: string, file: File) => {
    if (!latestSession?.id || !user?.id) return;
    setUploadingDoc(docType);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/${latestSession.id}/additional/${docType}.${ext}`;

      const { error: uploadError } = await portalClient.storage
        .from("id-documents")
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      // Update session additional_docs
      const currentDocs = (latestSession.additional_docs as Record<string, string>) || {};
      const updatedDocs = { ...currentDocs, [docType]: path };
      await portalClient
        .from("identity_verification_sessions")
        .update({ additional_docs: updatedDocs, updated_at: new Date().toISOString() })
        .eq("id", latestSession.id);

      setUploadedDocs((prev) => ({ ...prev, [docType]: true }));
      toast.success(`Document "${DOC_LABELS[docType] || docType}" téléversé`);
      refetch();
    } catch (err: any) {
      toast.error(err.message || "Erreur lors du téléversement");
    } finally {
      setUploadingDoc(null);
    }
  };

  const handleFileChange = (docType: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUploadDoc(docType, file);
  };

  const handleVerificationDone = () => {
    setShowQR(false);
    refetch();
    toast.success("Documents soumis avec succès !");
  };

  return (
    <ClientLayout>
      <div className="space-y-6 max-w-3xl mx-auto">
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
          <Card className="border-teal-200">
            <CardContent className="py-8 text-center space-y-4">
              <Shield className="w-12 h-12 text-teal-600 mx-auto" />
              <h2 className="text-lg font-semibold text-slate-900">Aucune vérification en cours</h2>
              <p className="text-slate-500 text-sm max-w-md mx-auto">
                Pour effectuer certaines opérations, une vérification d'identité peut être requise.
              </p>
              <Button onClick={() => setShowQR(true)} className="bg-teal-700 hover:bg-teal-800 text-white">
                {isMobile ? <><Camera className="w-4 h-4 mr-2" /> Prendre des photos</> : <><QrCode className="w-4 h-4 mr-2" /> Démarrer la vérification</>}
              </Button>
            </CardContent>
          </Card>
        ) : showQR ? (
          <Card>
            <CardContent className="py-6">
              <QRVerificationStep
                userId={user?.id || ""}
                checkoutType="portal"
                isFrench={true}
                onVerified={() => handleVerificationDone()}
                onSessionGenerated={() => {}}
              />
              <div className="mt-4 text-center">
                <Button variant="outline" onClick={() => { setShowQR(false); refetch(); }}>Annuler</Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {sessions.map((session: any, idx: number) => {
              const sc = STATUS_CLIENT[session.status] || STATUS_CLIENT.created;
              const StatusIcon = sc.icon;
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
                        <p className="font-mono">{session.order_number || "Aucune"}</p>
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

                    {/* Resubmission: additional docs upload */}
                    {session.status === "resubmission_required" && isLatest && (
                      <div className="p-4 bg-orange-50 rounded-lg border border-orange-200 space-y-4">
                        <div className="flex items-center gap-2">
                          <RotateCcw className="w-4 h-4 text-orange-700" />
                          <p className="font-semibold text-orange-800">Documents supplémentaires requis</p>
                        </div>
                        {session.review_reason && (
                          <p className="text-sm text-orange-700">{session.review_reason}</p>
                        )}

                        {/* Upload area for each required doc */}
                        {requiredDocs.length > 0 ? (
                          <div className="space-y-3">
                            {requiredDocs.map((docType: string) => {
                              const alreadyUploaded = uploadedDocs[docType] || !!((session.additional_docs as any)?.[docType]);
                              return (
                                <div key={docType} className="flex items-center justify-between p-3 bg-white rounded-lg border border-orange-100">
                                  <div className="flex items-center gap-2">
                                    {alreadyUploaded ? <Check className="w-4 h-4 text-emerald-600" /> : <FileUp className="w-4 h-4 text-orange-600" />}
                                    <span className="text-sm font-medium">{DOC_LABELS[docType] || docType}</span>
                                  </div>
                                  {alreadyUploaded ? (
                                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">Téléversé</Badge>
                                  ) : (
                                    <>
                                      <input
                                        ref={(el) => { fileInputRefs.current[docType] = el; }}
                                        type="file"
                                        accept="image/*,.pdf"
                                        capture={isMobile ? "environment" : undefined}
                                        className="hidden"
                                        onChange={handleFileChange(docType)}
                                      />
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={uploadingDoc === docType}
                                        onClick={() => fileInputRefs.current[docType]?.click()}
                                      >
                                        {uploadingDoc === docType ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
                                        {isMobile ? "Photo" : "Téléverser"}
                                      </Button>
                                    </>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          /* No specific docs requested - allow re-upload via QR */
                          <Button onClick={() => setShowQR(true)} className="bg-orange-600 hover:bg-orange-700 text-white">
                            {isMobile ? <><Camera className="w-4 h-4 mr-2" /> Prendre les photos</> : <><QrCode className="w-4 h-4 mr-2" /> Scanner le QR code</>}
                          </Button>
                        )}
                      </div>
                    )}

                    {/* Timeline */}
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
                              admin_resubmission_required: "Documents supplémentaires demandés",
                              admin_viewed_documents: "Documents consultés par un agent",
                              order_activated_on_approval: "Commande activée",
                            };
                            return (
                              <div key={event.id} className="flex items-center gap-3 text-sm">
                                <div className="w-2 h-2 rounded-full bg-teal-500 shrink-0" />
                                <span className="flex-1">{eventLabels[event.event_type] || event.event_type}</span>
                                <span className="text-xs text-slate-400">{format(new Date(event.created_at), "d MMM HH:mm", { locale: fr })}</span>
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
