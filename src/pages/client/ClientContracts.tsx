import { useState, useCallback } from "react";
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
import { FileText, Download, CheckCircle, Eye, Pen } from "lucide-react";
import { useClientAuth } from "@/hooks/useClientAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { portalSupabase } from "@/integrations/supabase/portalClient";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { generateTelecomContractPDF, type TelecomContractData } from "@/lib/pdfEngine";
import { BUSINESS_INFO, CONTRACT_TERMS } from "@/lib/contractPolicies";
import { ACTIVE_CONTRACT_TEMPLATE } from "@/lib/contractTemplate";
import { hashBlobSHA256Hex } from "@/lib/pdfHash";
import { safePDFDownload } from "@/lib/pdfUtils";
import PDFViewerDialog from "@/components/PDFViewerDialog";
import { usePDFViewer } from "@/hooks/usePDFViewer";
import { usePortalActivityLog } from "@/hooks/usePortalActivityLog";

const ClientContracts = () => {
  const { user } = useClientAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { logActivity } = usePortalActivityLog();
  const [selectedContract, setSelectedContract] = useState<any>(null);
  const [signDialogOpen, setSignDialogOpen] = useState(false);
  const [isAgreed, setIsAgreed] = useState(false);
  const pdfViewer = usePDFViewer();

  // Fetch contracts for current user
  const { data: contracts, isLoading } = useQuery({
    queryKey: ["client-contracts", user?.id],
    queryFn: async () => {
      const { data, error } = await portalSupabase
        .from("contracts")
        .select("*")
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Fetch current profile for signature
  const { data: profile } = useQuery({
    queryKey: ["client-profile", user?.id],
    queryFn: async () => {
      const { data, error } = await portalSupabase
        .from("profiles")
        .select("*")
        .eq("user_id", user?.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Sign contract mutation with activity logging
  const signContractMutation = useMutation({
    mutationFn: async (contractId: string) => {
      const signedAt = new Date().toISOString();
      const { error } = await portalSupabase
        .from("contracts")
        .update({
          is_signed: true,
          signed_at: signedAt,
        })
        .eq("id", contractId)
        .eq("user_id", user?.id);

      if (error) throw error;
      
      // Return data for logging
      return { contractId, signedAt };
    },
    onSuccess: async (data) => {
      // Log the signature activity
      await logActivity(
        "Signed",
        "contract",
        data.contractId,
        {
          signedAt: data.signedAt,
          signatureActor: "Client",
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
      
      // Invalidate with exact key used in query
      queryClient.invalidateQueries({ queryKey: ["client-contracts", user?.id] });
      toast({ title: "Contrat signé avec succès", description: "Vous pouvez maintenant télécharger votre contrat signé." });
      setSignDialogOpen(false);
      setSelectedContract(null);
      setIsAgreed(false);
    },
    onError: (error) => {
      console.error("Contract sign error:", error);
      toast({ title: "Erreur lors de la signature", variant: "destructive" });
    },
  });

  const handleDownloadContract = async (contract: any) => {
    try {
      if (!contract) {
        toast({ title: "Contrat non trouvé", variant: "destructive" });
        return;
      }

      // Fetch linked order with service details INCLUDING equipment_details for line_items
      const { data: linkedOrder } = await portalSupabase
        .from("orders")
        .select(`
          id, order_number, created_at, service_type,
          subtotal, tps_amount, tvq_amount, total_amount, 
          activation_fee, delivery_fee, installation_fee, terminal_fee, terminal_count, router_fee,
          equipment_details, promo_code, discount_amount, preauth_discount
        `)
        .eq("related_contract_id", contract.id)
        .maybeSingle();
      
      // Import line item utilities
      const { extractLineItemsFromOrder, calculateLineItemTotals } = await import("@/lib/orderLineItems");
      
      // Parse service type to determine individual services and prices
      const serviceType = String(linkedOrder?.service_type || contract.contract_name || "").toLowerCase();
      const subtotal = Number(linkedOrder?.subtotal ?? 0);
      const equipmentDetails = linkedOrder?.equipment_details;
      const lineItems = extractLineItemsFromOrder(equipmentDetails);
      
      // Build individual service prices based on line_items OR fallback parsing
      let internetPlan: string | undefined;
      let internetPrice: number | undefined;
      let tvBundle: string | undefined;
      let tvPrice: number | undefined;
      let mobilePlan: string | undefined;
      let mobilePrice: number | undefined;
      let streamingPlan: string | undefined;
      let streamingPrice: number | undefined;
      
      if (lineItems && lineItems.length > 0) {
        // Use structured line_items as primary source
        for (const item of lineItems) {
          if (item.category === 'service') {
            const itemType = item.type?.toLowerCase() || '';
            const price = item.unit_price >= 0 ? item.unit_price : undefined;
            
            if (itemType === 'internet') {
              internetPlan = item.name;
              internetPrice = price;
            } else if (itemType === 'tv') {
              tvBundle = item.name;
              tvPrice = price;
            } else if (itemType === 'mobile') {
              mobilePlan = item.name;
              mobilePrice = price;
            } else if (itemType === 'streaming') {
              // Aggregate streaming services
              if (!streamingPlan) {
                streamingPlan = item.name;
                streamingPrice = price;
              } else {
                streamingPlan += `, ${item.name}`;
                streamingPrice = (streamingPrice || 0) + (price || 0);
              }
            }
          }
        }
      } else {
        // Fallback: Parse service_type string if no line_items found
        if (serviceType.includes("internet") || serviceType.includes("fibre")) {
          internetPlan = "Internet Résidentiel";
          internetPrice = subtotal > 0 ? subtotal : 0;
        }
        if (serviceType.includes("tv") || serviceType.includes("télé")) {
          tvBundle = "Forfait TV";
          tvPrice = 0;
        }
        if (serviceType.includes("mobile") || serviceType.includes("cellulaire")) {
          mobilePlan = "Forfait Mobile Prépayé";
          mobilePrice = 0;
        }
        if (serviceType.includes("streaming")) {
          streamingPlan = "Streaming+";
          streamingPrice = 0;
        }
      }
      
      const hasSpecificServices = internetPlan || tvBundle || mobilePlan || streamingPlan;

      const templateId = (contract as any).template_id || ACTIVE_CONTRACT_TEMPLATE.id;
      const templateVersion = (contract as any).template_version || ACTIVE_CONTRACT_TEMPLATE.version;

      const contractData: TelecomContractData = {
        contractId: contract.id,
        templateId,
        templateVersion,

        contractNumber:
          contract.contract_number ||
          contract.contract_url ||
          `CTR-${contract.id.slice(0, 8).toUpperCase()}`,
        orderReference: linkedOrder?.order_number || undefined,
        orderDate: linkedOrder?.created_at || contract.created_at,

        clientName: profile?.full_name || "Client",
        clientFirstName: (profile?.full_name || "Client").split(" ")[0] || "",
        clientLastName: (profile?.full_name || "Client").split(" ").slice(1).join(" ") || "",
        clientEmail: profile?.email || user?.email || "",
        clientPhone: profile?.phone || "",

        billingAddress: profile?.service_address || "",
        serviceAddress: profile?.service_address || "",
        serviceCity: profile?.service_city || "",
        serviceProvince: profile?.service_province || "QC",
        servicePostalCode: profile?.service_postal_code || "",

        // Individual service plans with prices
        internetPlan: internetPlan,
        internetPrice: internetPrice,
        tvBundle: tvBundle,
        tvPrice: tvPrice,
        mobilePlan: mobilePlan,
        mobilePrice: mobilePrice,
        streamingPlan: streamingPlan,
        streamingPrice: streamingPrice,
        
        // Fallback service plan only if no specific services detected
        servicePlan: hasSpecificServices ? undefined : (contract.contract_name || "Services"),

        activationFee: Number(linkedOrder?.activation_fee ?? CONTRACT_TERMS.fees.activation),
        deliveryFee: Number(linkedOrder?.delivery_fee ?? CONTRACT_TERMS.fees.delivery),
        installationFee: Number(linkedOrder?.installation_fee ?? 0),
        terminalFee: Number(linkedOrder?.terminal_fee ?? 0),
        terminalCount: Number(linkedOrder?.terminal_count ?? 0),
        routerFee: Number(linkedOrder?.router_fee ?? 0),

        subtotal: subtotal,
        tpsAmount: Number(linkedOrder?.tps_amount ?? 0),
        tvqAmount: Number(linkedOrder?.tvq_amount ?? 0),
        totalAmount: Number(linkedOrder?.total_amount ?? 0),
        
        // Promo/discounts
        promoCode: linkedOrder?.promo_code || undefined,
        promoDiscount: Number(linkedOrder?.discount_amount ?? 0),
        preauthDiscount: Number(linkedOrder?.preauth_discount ?? 0),

        isSigned: Boolean(contract.is_signed),
        signedAt: contract.signed_at || undefined,
        
        // CRITICAL: Pass structured line_items for dynamic PDF generation
        equipmentDetails: equipmentDetails as { [key: string]: any; line_items?: any[] } | undefined,
      };

      const doc = generateTelecomContractPDF(contractData);
      const blob = doc.output("blob");
      const pdfHash = await hashBlobSHA256Hex(blob);
      const generatedAt = new Date().toISOString();

      await portalSupabase
        .from("contracts")
        .update({
          template_id: templateId,
          template_version: templateVersion,
          pdf_hash: pdfHash,
          pdf_generated_at: generatedAt,
        } as any)
        .eq("id", contract.id)
        .eq("user_id", user?.id);

      await logActivity(
        "Generated",
        "contract_pdf",
        contract.id,
        {
          orderId: linkedOrder?.id || null,
          contractId: contract.id,
          templateId,
          templateVersion,
          timestamp: generatedAt,
          pdfHash,
        },
        { changedField: "pdf_generated_at", newValue: generatedAt }
      );

      const filename = `TSA-${contract.id}-${templateVersion}.pdf`;
      safePDFDownload(blob, filename);

      toast({ title: "Contrat téléchargé" });
    } catch (error: any) {
      console.error("Download error:", error);
      toast({
        title: "Erreur lors du téléchargement",
        description: "Veuillez réessayer",
        variant: "destructive",
      });
    }
  };

  const handleViewPDF = useCallback(
    async (contract: any) => {
      if (!contract) {
        toast({ title: "Contrat non trouvé", variant: "destructive" });
        return;
      }

      // Fetch linked order with service details
      const { data: linkedOrder } = await portalSupabase
        .from("orders")
        .select(`
          id, order_number, created_at, service_type,
          subtotal, tps_amount, tvq_amount, total_amount, 
          activation_fee, delivery_fee, installation_fee, terminal_fee, terminal_count, router_fee
        `)
        .eq("related_contract_id", contract.id)
        .maybeSingle();
      
      // Parse service type to determine individual services and prices
      const serviceType = String(linkedOrder?.service_type || contract.contract_name || "").toLowerCase();
      const subtotal = Number(linkedOrder?.subtotal ?? 0);
      
      // Build individual service prices based on service type
      let internetPlan: string | undefined;
      let internetPrice: number | undefined;
      let tvBundle: string | undefined;
      let tvPrice: number | undefined;
      let mobilePlan: string | undefined;
      let mobilePrice: number | undefined;
      let streamingPlan: string | undefined;
      let streamingPrice: number | undefined;
      
      if (serviceType.includes("internet") || serviceType.includes("fibre")) {
        internetPlan = "Internet Résidentiel";
        internetPrice = subtotal > 0 ? subtotal : 50;
      }
      if (serviceType.includes("tv") || serviceType.includes("télé")) {
        tvBundle = "Forfait TV";
        tvPrice = 35;
      }
      if (serviceType.includes("mobile") || serviceType.includes("cellulaire")) {
        mobilePlan = "Forfait Mobile Prépayé";
        mobilePrice = 60;
      }
      if (serviceType.includes("streaming")) {
        streamingPlan = "Streaming+";
        streamingPrice = 15;
      }
      
      const hasSpecificServices = internetPlan || tvBundle || mobilePlan || streamingPlan;

      const templateId = (contract as any).template_id || ACTIVE_CONTRACT_TEMPLATE.id;
      const templateVersion = (contract as any).template_version || ACTIVE_CONTRACT_TEMPLATE.version;

      const contractData: TelecomContractData = {
        contractId: contract.id,
        templateId,
        templateVersion,

        contractNumber:
          contract.contract_number ||
          contract.contract_url ||
          `CTR-${contract.id.slice(0, 8).toUpperCase()}`,
        orderReference: linkedOrder?.order_number || undefined,
        orderDate: linkedOrder?.created_at || contract.created_at,

        clientName: profile?.full_name || "Client",
        clientFirstName: (profile?.full_name || "Client").split(" ")[0] || "",
        clientLastName: (profile?.full_name || "Client").split(" ").slice(1).join(" ") || "",
        clientEmail: profile?.email || user?.email || "",
        clientPhone: profile?.phone || "",

        billingAddress: profile?.service_address || "",
        serviceAddress: profile?.service_address || "",
        serviceCity: profile?.service_city || "",
        serviceProvince: profile?.service_province || "QC",
        servicePostalCode: profile?.service_postal_code || "",

        // Individual service plans with prices
        internetPlan: internetPlan,
        internetPrice: internetPrice,
        tvBundle: tvBundle,
        tvPrice: tvPrice,
        mobilePlan: mobilePlan,
        mobilePrice: mobilePrice,
        streamingPlan: streamingPlan,
        streamingPrice: streamingPrice,
        
        // Fallback service plan only if no specific services detected
        servicePlan: hasSpecificServices ? undefined : (contract.contract_name || "Services"),

        activationFee: Number(linkedOrder?.activation_fee ?? CONTRACT_TERMS.fees.activation),
        deliveryFee: Number(linkedOrder?.delivery_fee ?? CONTRACT_TERMS.fees.delivery),
        installationFee: Number(linkedOrder?.installation_fee ?? 0),
        terminalFee: Number(linkedOrder?.terminal_fee ?? 0),
        terminalCount: Number(linkedOrder?.terminal_count ?? 0),
        routerFee: Number(linkedOrder?.router_fee ?? 0),

        subtotal: subtotal,
        tpsAmount: Number(linkedOrder?.tps_amount ?? 0),
        tvqAmount: Number(linkedOrder?.tvq_amount ?? 0),
        totalAmount: Number(linkedOrder?.total_amount ?? 0),

        isSigned: Boolean(contract.is_signed),
        signedAt: contract.signed_at || undefined,
      };

      const filename = `TSA-${contract.id}-${templateVersion}.pdf`;

      await pdfViewer.openWithGenerator(
        async () => {
          const doc = generateTelecomContractPDF(contractData);
          const blob = doc.output("blob");
          const pdfHash = await hashBlobSHA256Hex(blob);
          const generatedAt = new Date().toISOString();

          await portalSupabase
            .from("contracts")
            .update({
              template_id: templateId,
              template_version: templateVersion,
              pdf_hash: pdfHash,
              pdf_generated_at: generatedAt,
            } as any)
            .eq("id", contract.id)
            .eq("user_id", user?.id);

          await logActivity(
            "Generated",
            "contract_pdf",
            contract.id,
            {
              orderId: linkedOrder?.id || null,
              contractId: contract.id,
              templateId,
              templateVersion,
              timestamp: generatedAt,
              pdfHash,
            },
            { changedField: "pdf_generated_at", newValue: generatedAt }
          );

          return blob;
        },
        `Contrat - ${contract.contract_name || contractData.contractNumber}`,
        filename
      );
    },
    [profile, user?.email, user?.id, pdfViewer, toast, logActivity]
  );

  const openSignDialog = (contract: any) => {
    setSelectedContract(contract);
    setIsAgreed(false);
    setSignDialogOpen(true);
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
                        N° {contract.contract_url || contract.id.slice(0, 8).toUpperCase()}
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
                        {selectedContract.contract_url || selectedContract.id.slice(0, 8).toUpperCase()}
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
                      <p className="text-sm">{profile?.full_name || "N/A"}</p>
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
                      <li>• Paiement sous {CONTRACT_TERMS.paymentTerms.dueDays} jours</li>
                      <li>• Intérêt de {CONTRACT_TERMS.paymentTerms.lateInterestRate}% par mois sur paiements en retard</li>
                      <li>• Préavis de résiliation de {CONTRACT_TERMS.cancellation.noticeDays} jours</li>
                      <li>• Frais après livraison: {CONTRACT_TERMS.cancellation.afterDeliveryCharge}</li>
                    </ul>
                  </div>

                  {/* Late Payment Warning */}
                  <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                    <h3 className="font-bold text-red-600 dark:text-red-400 mb-2">
                      POLITIQUE DE PAIEMENT EN RETARD
                    </h3>
                    <p className="text-sm text-red-700 dark:text-red-300">
                      Un intérêt de {CONTRACT_TERMS.paymentTerms.lateInterestRate}% par mois sera appliqué sur tout solde impayé après {CONTRACT_TERMS.paymentTerms.dueDays} jours.
                    </p>
                  </div>
                </div>

                {/* Agreement Checkbox */}
                <div className="flex items-start gap-3 p-4 bg-muted rounded-lg">
                  <input
                    type="checkbox"
                    id="agreement"
                    checked={isAgreed}
                    onChange={(e) => setIsAgreed(e.target.checked)}
                    className="mt-1"
                  />
                  <label htmlFor="agreement" className="text-sm text-foreground">
                    J'ai lu et j'accepte les termes et conditions de ce contrat. Je comprends que cette signature électronique a la même valeur juridique qu'une signature manuscrite.
                  </label>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button variant="outline" onClick={() => setSignDialogOpen(false)}>
                    Annuler
                  </Button>
                  <Button
                    variant="hero"
                    onClick={() => signContractMutation.mutate(selectedContract.id)}
                    disabled={!isAgreed || signContractMutation.isPending}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Signer le contrat
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
