import { useState, useCallback, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import ClientLayout from "@/components/client/ClientLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FileText, Download, CheckCircle, Eye, Pen, AlertTriangle, AlertCircle } from "lucide-react";
import { useClientAuth } from "@/hooks/useClientAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { portalClient as portalSupabase } from "@/integrations/backend/portalClient";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { BUSINESS_INFO, CONTRACT_TERMS } from "@/lib/contractPolicies";
import PDFViewerDialog from "@/components/PDFViewerDialog";
import { usePDFViewer } from "@/hooks/usePDFViewer";
import { usePortalActivityLog } from "@/hooks/usePortalActivityLog";
import { TypedSignatureInput } from "@/components/client/TypedSignatureInput";
import CanvasSignaturePad from "@/components/client/CanvasSignaturePad";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useCanonicalClientData } from "@/hooks/useCanonicalClientData";
import { useClientPDF } from "@/hooks/useClientPDF";

/**
 * ClientContracts — CANONICAL DOCUMENT ARCHITECTURE
 * 
 * This page does NOT generate contract documents independently.
 * It uses the canonical document service (same engine as admin).
 * Zero ad-hoc data assembly. Zero hardcoded prices.
 * Zero client-side document math.
 * 
 * The signing flow remains client-side (it's a user action, not document generation).
 */

const ClientContracts = () => {
  const { user } = useClientAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { logActivity } = usePortalActivityLog();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedContract, setSelectedContract] = useState<any>(null);
  const [signDialogOpen, setSignDialogOpen] = useState(false);
  const [isAgreed, setIsAgreed] = useState(false);
  const [signatureMode, setSignatureMode] = useState<"typed" | "canvas">("typed");
  const [typedSignature, setTypedSignature] = useState("");
  const [canvasSignature, setCanvasSignature] = useState<string | null>(null);
  const [signatureError, setSignatureError] = useState<string | null>(null);
  const pdfViewer = usePDFViewer();
  const { data: canonicalData, isLoading: canonicalLoading } = useCanonicalClientData(user?.id);

  const contracts = canonicalData?.contracts || [];
  const profile = canonicalData?.profile;
  const isLoading = canonicalLoading;

  // Sign contract mutation
  const signContractMutation = useMutation({
    mutationFn: async ({ contractId, signature, signatureType }: { contractId: string; signature: string; signatureType: "text" | "canvas" }) => {
      const signedAt = new Date().toISOString();
      const { error } = await portalSupabase
        .from("contracts")
        .update({
          is_signed: true,
          signed_at: signedAt,
          client_signature: signature,
          client_signature_type: signatureType,
        } as any)
        .eq("id", contractId)
        .eq("user_id", user?.id);

      if (error) throw error;
      return { contractId, signedAt, signature, signatureType };
    },
    onSuccess: async (data) => {
      await logActivity(
        "Signed",
        "contract",
        data.contractId,
        {
          signedAt: data.signedAt,
          signatureActor: "Client",
          signatureType: data.signatureType,
          clientName: profile?.full_name || user?.email,
          clientEmail: profile?.email || user?.email,
          contractName: selectedContract?.contract_name,
          contractNumber: selectedContract?.contract_number || selectedContract?.contract_url,
        },
        {
          changedField: "is_signed",
          oldValue: "false",
          newValue: "true",
        }
      );

      queryClient.invalidateQueries({ queryKey: ["canonical-client-data", user?.id] });
      toast({
        title: "Contrat signé avec succès",
        description: "Votre signature a été enregistrée. Vous pouvez télécharger le contrat signé.",
      });
      setSignDialogOpen(false);
      setSelectedContract(null);
      setIsAgreed(false);
      setSignatureMode("typed");
      setTypedSignature("");
      setCanvasSignature(null);
      setSignatureError(null);
    },
    onError: (error) => {
      console.error("Contract sign error:", error);
      toast({ title: "Erreur lors de la signature", variant: "destructive" });
    },
  });

  // ── SERVER-SIDE PDF GENERATION ──────────────────────────────
  const clientPDF = useClientPDF();

  const handleDownloadContract = useCallback(async (contract: any) => {
    if (!contract) { toast({ title: "Contrat non trouvé", variant: "destructive" }); return; }
    await clientPDF.download("contract", contract.id);
    if (!clientPDF.error) {
      await logActivity("Downloaded", "contract_pdf", contract.id, { contractId: contract.id });
    }
  }, [clientPDF, logActivity, toast]);

  const handleViewPDF = useCallback(async (contract: any) => {
    if (!contract) { toast({ title: "Contrat non trouvé", variant: "destructive" }); return; }
    await clientPDF.view("contract", contract.id);
    if (!clientPDF.error) {
      await logActivity("Viewed", "contract_pdf", contract.id, { contractId: contract.id });
    }
  }, [clientPDF, logActivity, toast]);

  const openSignDialog = (contract: any) => {
    setSelectedContract(contract);
    setIsAgreed(false);
    setSignatureMode("typed");
    setTypedSignature(profile?.full_name || user?.email || "");
    setCanvasSignature(null);
    setSignatureError(null);
    setSignDialogOpen(true);
  };

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token || !contracts?.length) return;

    const matchedContract = contracts.find((contract: any) => contract.signature_token === token);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("token");
    setSearchParams(nextParams, { replace: true });

    if (!matchedContract) {
      toast({
        title: "Lien de signature invalide",
        description: "Aucun contrat correspondant n'a été trouvé dans votre portail.",
        variant: "destructive",
      });
      return;
    }

    if (matchedContract.is_signed) {
      toast({
        title: "Contrat déjà signé",
        description: "Ce contrat est déjà signé dans votre portail.",
      });
      return;
    }

    openSignDialog(matchedContract);
  }, [contracts, openSignDialog, searchParams, setSearchParams, toast]);

  const handleSign = () => {
    if (signatureMode === "typed") {
      if (!typedSignature.trim()) {
        setSignatureError("Veuillez taper votre nom pour signer");
        return;
      }
      if (typedSignature.trim().length < 3) {
        setSignatureError("Le nom doit contenir au moins 3 caractères");
        return;
      }
      setSignatureError(null);
      signContractMutation.mutate({
        contractId: selectedContract.id,
        signature: typedSignature.trim(),
        signatureType: "text",
      });
    } else {
      if (!canvasSignature) {
        setSignatureError("Veuillez dessiner votre signature");
        return;
      }
      setSignatureError(null);
      signContractMutation.mutate({
        contractId: selectedContract.id,
        signature: canvasSignature,
        signatureType: "canvas",
      });
    }
  };

  return (
    <ClientLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Mes contrats</h1>
          <p className="text-muted-foreground mt-1">Consultez et signez vos contrats</p>
        </div>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-cyan-400" />
              Contrats
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2].map((i) => (
                  <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : contracts && contracts.length > 0 ? (
              <div className="space-y-4">
                {contracts.map((contract: any) => (
                  <div
                    key={contract.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border border-border rounded-lg hover:border-cyan-400/30 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-medium text-foreground">{contract.contract_name}</h3>
                        <Badge
                          className={
                            contract.is_signed
                              ? "bg-emerald-500/20 text-emerald-500"
                              : "bg-amber-500/20 text-amber-500"
                          }
                        >
                          {contract.is_signed ? "Signé" : "En attente de signature"}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        N° {contract.contract_number || contract.contract_url || contract.id.slice(0, 8).toUpperCase()}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Créé le {format(new Date(contract.created_at), "d MMMM yyyy", { locale: fr })}
                        {contract.signed_at && (
                          <span className="text-emerald-500 ml-2">
                            • Signé le {format(new Date(contract.signed_at), "d MMMM yyyy", { locale: fr })}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {!contract.is_signed && (
                        <Button
                          variant="hero"
                          size="sm"
                          onClick={() => openSignDialog(contract)}
                        >
                          <Pen className="w-4 h-4 mr-2" />
                          Signer
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewPDF(contract)}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        Voir PDF
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownloadContract(contract)}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Télécharger
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Aucun contrat disponible</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sign Contract Dialog */}
        <Dialog open={signDialogOpen} onOpenChange={setSignDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Signature du contrat</DialogTitle>
            </DialogHeader>
            {selectedContract && (
              <div className="space-y-6 py-4">
                {/* Contract Preview */}
                <div className="space-y-4">
                  {/* Header */}
                  <div className="bg-cyan-500 text-white rounded-lg p-6 text-center">
                    <h2 className="text-2xl font-bold">{BUSINESS_INFO.name.toUpperCase()}</h2>
                    <p className="text-sm opacity-90">Compagnie Télécom Indépendante</p>
                    <p className="text-xs opacity-75 mt-1">
                      {BUSINESS_INFO.phone} | {BUSINESS_INFO.email}
                    </p>
                  </div>

                  {/* Contract Info */}
                  <div className="bg-muted rounded-lg p-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Contrat N° :</span>{" "}
                        {selectedContract.contract_number || selectedContract.contract_url || selectedContract.id.slice(0, 8).toUpperCase()}
                      </div>
                      <div>
                        <span className="font-medium">Version :</span> {CONTRACT_TERMS.version}
                      </div>
                      <div>
                        <span className="font-medium">Date d'émission :</span>{" "}
                        {format(new Date(selectedContract.created_at), "d MMMM yyyy", { locale: fr })}
                      </div>
                      <div>
                        <span className="font-medium">Nom du contrat :</span> {selectedContract.contract_name}
                      </div>
                    </div>
                  </div>

                  {/* Parties */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="border border-cyan-500 rounded-lg p-4">
                      <h3 className="font-bold text-cyan-500 mb-2">LE PRESTATAIRE</h3>
                      <p className="text-sm">{BUSINESS_INFO.legalName}</p>
                      <p className="text-sm text-muted-foreground">{BUSINESS_INFO.address}</p>
                      <p className="text-sm text-muted-foreground">{BUSINESS_INFO.phone}</p>
                    </div>
                    <div className="border border-cyan-500 rounded-lg p-4">
                      <h3 className="font-bold text-cyan-500 mb-2">LE CLIENT</h3>
                      <p className="text-sm">{profile?.full_name || "Non fourni par le client"}</p>
                      <p className="text-sm text-muted-foreground">{profile?.email || user?.email}</p>
                      {profile?.phone && (
                        <p className="text-sm text-muted-foreground">{profile.phone}</p>
                      )}
                    </div>
                  </div>

                  {/* Services */}
                  <div className="space-y-2">
                    <h3 className="font-bold text-cyan-500">SERVICES FOURNIS</h3>
                    <ul className="text-sm space-y-1">
                      {CONTRACT_TERMS.services.map((service, index) => (
                        <li key={index}>• {service}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Terms */}
                  <div className="space-y-2">
                    <h3 className="font-bold text-cyan-500">CONDITIONS</h3>
                    <ul className="text-sm space-y-1 text-muted-foreground">
                      <li>• Service prépayé — paiement requis avant Bill Cycle pour renouveler</li>
                      <li>• Non-renouvellement au Bill Cycle si non payé (aucun intérêt/frais pour non-renouvellement normal)</li>
                      <li>• Préavis de résiliation de {CONTRACT_TERMS.cancellation.noticeDays} jours</li>
                      <li>• Frais après livraison: {CONTRACT_TERMS.cancellation.afterDeliveryCharge}</li>
                    </ul>
                  </div>

                  {/* Dispute/Chargeback Warning */}
                  <Alert className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <AlertDescription>
                      <strong className="text-amber-600 dark:text-amber-400">CONTESTATION BANCAIRE / CHARGEBACK</strong>
                      <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                        Un intérêt de {CONTRACT_TERMS.disputeChargeback.interestRate}% par mois + frais de réactivation de {CONTRACT_TERMS.disputeChargeback.reactivationFee}$ s'appliquent UNIQUEMENT en cas de contestation bancaire ou chargeback confirmé contre le client.
                      </p>
                    </AlertDescription>
                  </Alert>
                </div>

                {/* Signature Section */}
                <div className="border-t pt-6">
                  <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                    <Pen className="w-5 h-5 text-primary" />
                    Votre signature
                  </h3>
                  {/* Mode toggle */}
                  <div className="flex gap-2 mb-4">
                    <button
                      type="button"
                      onClick={() => { setSignatureMode("typed"); setSignatureError(null); }}
                      className={`flex-1 py-2 text-sm rounded-lg border transition-colors ${signatureMode === "typed" ? "border-cyan-400 bg-cyan-400/10 text-cyan-400" : "border-border text-muted-foreground"}`}
                    >
                      Taper mon nom
                    </button>
                    <button
                      type="button"
                      onClick={() => { setSignatureMode("canvas"); setCanvasSignature(null); setSignatureError(null); }}
                      className={`flex-1 py-2 text-sm rounded-lg border transition-colors ${signatureMode === "canvas" ? "border-cyan-400 bg-cyan-400/10 text-cyan-400" : "border-border text-muted-foreground"}`}
                    >
                      Dessiner ma signature
                    </button>
                  </div>
                  {signatureMode === "typed" ? (
                    <TypedSignatureInput
                      value={typedSignature}
                      onChange={setTypedSignature}
                      placeholder="Tapez votre nom complet"
                      label="Signez en tapant votre nom"
                      required
                      error={signatureError || undefined}
                    />
                  ) : (
                    <CanvasSignaturePad
                      onConfirm={(b64) => { setCanvasSignature(b64); setSignatureError(null); }}
                    />
                  )}
                  {signatureMode === "canvas" && canvasSignature && (
                    <p className="text-xs text-emerald-500 mt-2">✓ Signature enregistrée — vous pouvez procéder.</p>
                  )}
                  {signatureError && <p className="text-xs text-destructive mt-2">{signatureError}</p>}
                </div>

                {/* Agreement Checkbox */}
                <div className="flex items-start gap-3 p-4 bg-muted rounded-lg">
                  <input
                    type="checkbox"
                    id="agreement"
                    checked={isAgreed}
                    onChange={(e) => setIsAgreed(e.target.checked)}
                    className="mt-1 h-5 w-5 rounded border-border"
                  />
                  <label htmlFor="agreement" className="text-sm text-foreground">
                    J'ai lu et j'accepte les termes et conditions de ce contrat. Je comprends que cette signature électronique a la même valeur juridique qu'une signature manuscrite conformément à la Loi concernant le cadre juridique des technologies de l'information (L.R.Q., c. C-1.1).
                  </label>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button variant="outline" onClick={() => setSignDialogOpen(false)}>
                    Annuler
                  </Button>
                  <Button
                    variant="hero"
                    onClick={handleSign}
                    disabled={!isAgreed || (signatureMode === "typed" ? !typedSignature.trim() : !canvasSignature) || signContractMutation.isPending}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    {signContractMutation.isPending ? "Signature en cours..." : "Signer le contrat"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* PDF Viewer Dialog */}
        <PDFViewerDialog
          open={pdfViewer.isOpen}
          onOpenChange={pdfViewer.setOpen}
          pdfBlob={pdfViewer.pdfBlob}
          title={pdfViewer.title}
          filename={pdfViewer.filename}
          isLoading={pdfViewer.isLoading}
          error={pdfViewer.error}
        />
      </div>
    </ClientLayout>
  );
};

export default ClientContracts;
