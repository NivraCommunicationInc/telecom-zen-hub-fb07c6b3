/**
 * Admin PDF Templates V2 Preview Page
 * Test and preview all V2 PDF templates (Invoice, Contract, Summary, Modalités)
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download, FileText, Mail, Loader2, CheckCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

// Import all V2 generators
import { downloadInvoiceV2PDF, generateInvoiceV2PDF, type InvoiceV2Data } from "@/lib/pdfEngine/invoiceTemplateV2";
import { downloadContractV2PDF, generateContractV2PDF, type ContractV2Data } from "@/lib/pdfEngine/contractTemplateV2";
import { downloadSummaryV2PDF, generateSummaryV2PDF, type SummaryV2Data } from "@/lib/pdfEngine/summaryTemplateV2";
import { downloadModalitesV2PDF, generateModalitesV2PDF, type ModalitesV2Data } from "@/lib/pdfEngine/modalitesTemplateV2";

// =============================================================================
// SAMPLE DATA
// =============================================================================

const sampleInvoiceData: InvoiceV2Data = {
  invoiceNumber: "INV-2026-001234",
  accountNumber: "5-0630-8172",
  paymentBankNumber: "50630817208",
  billingDate: new Date().toISOString(),
  dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  clientName: "Jean-Pierre Tremblay",
  clientEmail: "jp.tremblay@exemple.ca",
  clientPhone: "514-555-1234",
  clientAddress: "1234 Rue Principale",
  clientCity: "Laval",
  clientProvince: "QC",
  clientPostalCode: "H7T 2Y5",
  previousBalance: 0,
  carriedBalance: 0,
  services: [
    { type: "Internet", name: "Internet Fibre 500 Mbps", description: "Connexion fibre optique haute vitesse", quantity: 1, monthlyPrice: 75.00, period: "/mois" },
    { type: "TV", name: "Forfait TV Essentiel", description: "100+ chaînes HD", quantity: 1, monthlyPrice: 35.00, period: "/mois" },
    { type: "Mobile", name: "Forfait Mobile 15 Go", description: "Appels illimités Canada", quantity: 1, monthlyPrice: 45.00, period: "/30 jours" },
  ],
  oneTimeFees: [{ label: "Frais d'activation", amount: 25.00 }],
  discounts: [{ label: "Rabais fidélité", amount: 10.00 }],
  subtotal: 155.00,
  tps: 7.75,
  tvq: 15.46,
  total: 178.21,
  isPaid: false,
};

const sampleContractData: ContractV2Data = {
  contractNumber: "CTR-2026-001234",
  orderNumber: "ORD-2026-000567",
  accountNumber: "5-0630-8172",
  contractDate: new Date().toISOString(),
  activationDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
  clientName: "Jean-Pierre Tremblay",
  clientEmail: "jp.tremblay@exemple.ca",
  clientPhone: "514-555-1234",
  serviceAddress: "1234 Rue Principale",
  serviceCity: "Laval",
  serviceProvince: "QC",
  servicePostalCode: "H7T 2Y5",
  services: [
    { type: "Internet", name: "Internet Fibre 500 Mbps", description: "Connexion fibre optique haute vitesse", quantity: 1, monthlyPrice: 75.00, period: "/mois" },
    { type: "TV", name: "Forfait TV Essentiel", description: "100+ chaînes HD", quantity: 1, monthlyPrice: 35.00, period: "/mois" },
  ],
  oneTimeFees: [{ label: "Frais d'activation", amount: 25.00 }],
  discounts: [{ label: "Rabais fidélité", amount: 10.00 }],
  monthlySubtotal: 110.00,
  oneTimeSubtotal: 25.00,
  tps: 6.75,
  tvq: 13.47,
  totalFirstPayment: 155.22,
  monthlyTotal: 126.61,
  clientSignature: "Jean-Pierre Tremblay",
  clientSignatureType: "text",
  clientSignedAt: new Date().toISOString(),
  agentName: "Marie Dupont",
  agentSignedAt: new Date().toISOString(),
};

const sampleSummaryData: SummaryV2Data = {
  summaryNumber: "SUM-2026-001234",
  contractNumber: "CTR-2026-001234",
  orderNumber: "ORD-2026-000567",
  accountNumber: "5-0630-8172",
  issueDate: new Date().toISOString(),
  clientName: "Jean-Pierre Tremblay",
  clientEmail: "jp.tremblay@exemple.ca",
  clientPhone: "514-555-1234",
  serviceAddress: "1234 Rue Principale",
  serviceCity: "Laval",
  serviceProvince: "QC",
  servicePostalCode: "H7T 2Y5",
  services: [
    { type: "Internet", name: "Internet Fibre 500 Mbps", monthlyPrice: 75.00, details: ["Téléchargement: 500 Mbps", "Téléversement: 100 Mbps", "Données illimitées"] },
    { type: "TV", name: "Forfait TV Essentiel", monthlyPrice: 35.00, details: ["100+ chaînes HD", "Enregistreur DVR inclus"] },
  ],
  activationDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
  firstBillingDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
  monthlyTotal: 126.61,
  setupFees: 25.00,
  firstPayment: 155.22,
  contractDuration: "Sans engagement",
  equipment: [
    { name: "Modem Fibre Wi-Fi 6", status: "Inclus (prêt)" },
    { name: "Décodeur IPTV 4K", status: "Inclus (prêt)" },
  ],
};

const sampleModalitesData: ModalitesV2Data = {
  documentNumber: "MOD-2026-001",
  version: "2.1",
  effectiveDate: new Date().toISOString(),
  lastUpdated: new Date().toISOString(),
  contractNumber: "CTR-2026-001234",
  clientName: "Jean-Pierre Tremblay",
};

// =============================================================================
// COMPONENT
// =============================================================================

const AdminPDFTemplatesV2 = () => {
  const { toast } = useToast();
  const [isSending, setIsSending] = useState(false);
  const [emailAddress, setEmailAddress] = useState("");
  const [activeTab, setActiveTab] = useState("invoice");
  const [includeSignatures, setIncludeSignatures] = useState(true);
  const [markAsPaid, setMarkAsPaid] = useState(false);

  const handleDownload = (type: string) => {
    try {
      switch (type) {
        case "invoice":
          downloadInvoiceV2PDF({ ...sampleInvoiceData, isPaid: markAsPaid });
          break;
        case "contract":
          downloadContractV2PDF(includeSignatures ? sampleContractData : { ...sampleContractData, clientSignature: undefined, agentName: undefined });
          break;
        case "summary":
          downloadSummaryV2PDF(sampleSummaryData);
          break;
        case "modalites":
          downloadModalitesV2PDF(sampleModalitesData);
          break;
      }
      
      toast({
        title: "PDF téléchargé!",
        description: `Le template ${type} a été généré avec succès.`,
      });
    } catch (error) {
      console.error("PDF generation error:", error);
      toast({
        title: "Erreur",
        description: "Impossible de générer le PDF.",
        variant: "destructive",
      });
    }
  };

  const handleSendEmail = async (type: string) => {
    if (!emailAddress) {
      toast({
        title: "Erreur",
        description: "Veuillez entrer une adresse email.",
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);
    try {
      let pdfDoc;
      let filename;
      let subject;

      switch (type) {
        case "invoice":
          pdfDoc = generateInvoiceV2PDF({ ...sampleInvoiceData, isPaid: markAsPaid });
          filename = `Nivra-Facture-V2-${sampleInvoiceData.invoiceNumber}.pdf`;
          subject = `Nivra Telecom - Facture V2 (${sampleInvoiceData.invoiceNumber})`;
          break;
        case "contract":
          pdfDoc = generateContractV2PDF(includeSignatures ? sampleContractData : { ...sampleContractData, clientSignature: undefined, agentName: undefined });
          filename = `Nivra-Entente-V2-${sampleContractData.contractNumber}.pdf`;
          subject = `Nivra Telecom - Entente V2 (${sampleContractData.contractNumber})`;
          break;
        case "summary":
          pdfDoc = generateSummaryV2PDF(sampleSummaryData);
          filename = `Nivra-Sommaire-V2-${sampleSummaryData.summaryNumber}.pdf`;
          subject = `Nivra Telecom - Sommaire V2 (${sampleSummaryData.summaryNumber})`;
          break;
        case "modalites":
          pdfDoc = generateModalitesV2PDF(sampleModalitesData);
          filename = `Nivra-Modalites-V2-${sampleModalitesData.version}.pdf`;
          subject = `Nivra Telecom - Modalités de Service V2`;
          break;
        default:
          throw new Error("Type de document inconnu");
      }

      const pdfBase64 = pdfDoc.output('datauristring').split(',')[1];

      const { error } = await supabase.functions.invoke('send-invoice-preview', {
        body: { to: emailAddress, pdfBase64, filename, subject },
      });

      if (error) throw error;

      toast({
        title: "Email envoyé!",
        description: `Le document a été envoyé à ${emailAddress}`,
      });
    } catch (error: any) {
      console.error("Email send error:", error);
      toast({
        title: "Erreur d'envoi",
        description: error.message || "Impossible d'envoyer l'email.",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const templates = [
    { id: "invoice", name: "Facture", icon: "💰", description: "Facture mensuelle avec détail des services" },
    { id: "contract", name: "Entente", icon: "📝", description: "Contrat de service avec signatures" },
    { id: "summary", name: "Sommaire", icon: "📋", description: "Résumé des renseignements essentiels" },
    { id: "modalites", name: "Modalités", icon: "⚖️", description: "Conditions générales de service" },
  ];

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/admin/pdf-test">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <FileText className="h-6 w-6 text-accent" />
                Templates PDF V2
              </h1>
              <p className="text-muted-foreground">
                Prévisualisation et test de tous les templates professionnels
              </p>
            </div>
          </div>
        </div>

        {/* Email send bar */}
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <Input
                  type="email"
                  placeholder="email@exemple.com"
                  value={emailAddress}
                  onChange={(e) => setEmailAddress(e.target.value)}
                />
              </div>
              <Button 
                variant="outline"
                onClick={() => handleSendEmail(activeTab)}
                disabled={isSending || !emailAddress}
                className="gap-2"
              >
                {isSending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Mail className="h-4 w-4" />
                )}
                Envoyer {templates.find(t => t.id === activeTab)?.name}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Templates tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-4 w-full">
            {templates.map((t) => (
              <TabsTrigger key={t.id} value={t.id} className="gap-2">
                <span>{t.icon}</span>
                {t.name}
              </TabsTrigger>
            ))}
          </TabsList>

          {templates.map((template) => (
            <TabsContent key={template.id} value={template.id}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="text-2xl">{template.icon}</span>
                    {template.name} V2
                    <Badge variant="secondary" className="ml-2">Nouveau Design</Badge>
                  </CardTitle>
                  <CardDescription>{template.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Options specific to template */}
                  {template.id === "invoice" && (
                    <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Switch checked={markAsPaid} onCheckedChange={setMarkAsPaid} />
                        <Label>Marquer comme payé</Label>
                      </div>
                    </div>
                  )}

                  {template.id === "contract" && (
                    <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Switch checked={includeSignatures} onCheckedChange={setIncludeSignatures} />
                        <Label>Inclure les signatures</Label>
                      </div>
                    </div>
                  )}

                  {/* Preview description */}
                  <div className="p-4 border rounded-lg space-y-2">
                    <h4 className="font-medium">Contenu du template :</h4>
                    {template.id === "invoice" && (
                      <ul className="text-sm text-muted-foreground space-y-1">
                        <li>✓ En-tête horizontal avec numéro de compte</li>
                        <li>✓ Message de bienvenue personnalisé</li>
                        <li>✓ Deux colonnes: Total + Sommaire</li>
                        <li>✓ Tableau détaillé des services</li>
                        <li>✓ Section taxes (TPS/TVQ)</li>
                        <li>✓ Signatures client/agent</li>
                      </ul>
                    )}
                    {template.id === "contract" && (
                      <ul className="text-sm text-muted-foreground space-y-1">
                        <li>✓ En-tête professionnel avec numéros d'identification</li>
                        <li>✓ Informations client complètes</li>
                        <li>✓ Tableau des services avec badges colorés</li>
                        <li>✓ Section totaux avec premier paiement</li>
                        <li>✓ Modalités de paiement Interac</li>
                        <li>✓ Signatures client et agent avec dates</li>
                      </ul>
                    )}
                    {template.id === "summary" && (
                      <ul className="text-sm text-muted-foreground space-y-1">
                        <li>✓ Encadré "En un coup d'œil" avec totaux</li>
                        <li>✓ Liste des services avec détails</li>
                        <li>✓ Dates importantes (activation, facturation)</li>
                        <li>✓ Section équipement</li>
                        <li>✓ Vos droits (CPRST, annulation...)</li>
                      </ul>
                    )}
                    {template.id === "modalites" && (
                      <ul className="text-sm text-muted-foreground space-y-1">
                        <li>✓ Page couverture professionnelle</li>
                        <li>✓ Table des matières</li>
                        <li>✓ 8 sections de conditions détaillées</li>
                        <li>✓ Sous-sections numérotées</li>
                        <li>✓ Pied de page sur chaque page</li>
                      </ul>
                    )}
                  </div>

                  {/* Download button */}
                  <Button onClick={() => handleDownload(template.id)} className="w-full gap-2">
                    <Download className="h-4 w-4" />
                    Télécharger {template.name} PDF
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>

        {/* Status */}
        <Card className="bg-accent/10 border-accent/30">
          <CardContent className="py-4 flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-accent" />
            <div>
              <p className="font-medium text-foreground">4 Templates V2 Prêts</p>
              <p className="text-sm text-muted-foreground">Design professionnel inspiré Rogers avec signatures visibles</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminPDFTemplatesV2;
