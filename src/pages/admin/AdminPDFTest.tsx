/**
 * PDF Engine Test Page
 * Temporary QA tool - Download sample PDFs to verify layout and formatting
 * Access: /admin/pdf-test (admin auth required)
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, FileText, Sparkles, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import AdminLayout from "@/components/admin/AdminLayout";
import { toast } from "sonner";
import { safePDFDownload } from "@/lib/pdfUtils";
import { 
  downloadUnifiedPDF,
  sampleMobileOnly,
  sampleInternetInstall,
  sampleTVBundle,
  sampleFullCombo,
  sampleInvoiceMobile,
  sampleInvoiceTVBundle,
  sampleInvoiceFullCombo,
} from "@/lib/pdfEngine";
import { generateInvoicePDF, generateBlankInvoicePDF } from "@/lib/pdf/invoiceEngine";
import type { InvoiceDataV2 } from "@/lib/pdf/types";
import type { UnifiedDocumentData } from "@/lib/pdfEngine/types";

// Sample data for V2.5 Invoice Engine tests
const sampleOneTimeInvoiceV2: InvoiceDataV2 = {
  invoice_type: "ONETIME",
  invoice_number: "INV-2026-TEST-001",
  invoice_date: new Date().toISOString(),
  due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  account_number: "CLT-2026-0001",
  currency: "CAD",
  status: "Pending",
  customer: {
    full_name: "Jean-Pierre Tremblay",
    email: "jp.tremblay@example.com",
    phone: "514-555-1234",
    address_line1: "1234 Rue Principale",
    city: "Montréal",
    province: "QC",
    postal_code: "H2X 1A1",
  },
  items: [
    { category: "Equipment", description: "Routeur Nivra Born WiFi", qty: 1, unit_price: 60, amount: 60, is_recurring: false },
    { category: "Equipment", description: "Carte SIM Physique", qty: 1, unit_price: 30, amount: 30, is_recurring: false },
  ],
  discounts: [
    { label: "Rabais préautorisé", amount: 5, applies_to: "total" },
  ],
  subtotal: 85,
  taxes: { gst_rate: 0.05, gst_amount: 4.25, qst_rate: 0.09975, qst_amount: 8.48 },
  total: 97.73,
  balance_due: 97.73,
};

const sampleMonthlyInvoiceV2: InvoiceDataV2 = {
  invoice_type: "MONTHLY",
  invoice_number: "INV-2026-TEST-002",
  invoice_date: new Date().toISOString(),
  due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  account_number: "CLT-2026-0001",
  billing_period_start: new Date().toISOString(),
  billing_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  currency: "CAD",
  status: "Issued",
  customer: {
    full_name: "Jean-Pierre Tremblay",
    email: "jp.tremblay@example.com",
    phone: "514-555-1234",
    address_line1: "1234 Rue Principale",
    city: "Montréal",
    province: "QC",
    postal_code: "H2X 1A1",
  },
  items: [
    { category: "Internet", description: "Internet 500 Mbps Illimité", period: "Février 2026", qty: 1, unit_price: 50, amount: 50, is_recurring: true },
    { category: "Mobile", description: "Mobile 50GB 4G Canada", period: "Février 2026", qty: 1, unit_price: 50, amount: 50, is_recurring: true },
  ],
  discounts: [
    { label: "Rabais multi-service", amount: 10, applies_to: "total" },
  ],
  subtotal: 90,
  taxes: { gst_rate: 0.05, gst_amount: 4.50, qst_rate: 0.09975, qst_amount: 8.98 },
  total: 103.48,
  balance_due: 103.48,
};

const AdminPDFTest = () => {
  const [isGenerating, setIsGenerating] = useState<string | null>(null);
  
  const handleDownload = (data: UnifiedDocumentData, filename: string) => {
    downloadUnifiedPDF(data, filename);
  };

  // V2.5 Invoice Engine test handler
  const handleV25InvoiceTest = async (type: "ONETIME" | "MONTHLY" | "BLANK_ONETIME" | "BLANK_MONTHLY") => {
    setIsGenerating(type);
    try {
      let result;
      let filename = "";
      
      if (type === "BLANK_ONETIME") {
        console.log("[AdminPDFTest] Generating blank ONETIME template...");
        result = await generateBlankInvoicePDF("ONETIME");
        filename = "Template-Facture-Unique-V2.5.pdf";
      } else if (type === "BLANK_MONTHLY") {
        console.log("[AdminPDFTest] Generating blank MONTHLY template...");
        result = await generateBlankInvoicePDF("MONTHLY");
        filename = "Template-Facture-Mensuelle-V2.5.pdf";
      } else if (type === "ONETIME") {
        console.log("[AdminPDFTest] Generating real ONETIME invoice...");
        result = await generateInvoicePDF(sampleOneTimeInvoiceV2);
        filename = `Facture-${sampleOneTimeInvoiceV2.invoice_number}.pdf`;
      } else {
        console.log("[AdminPDFTest] Generating real MONTHLY invoice...");
        result = await generateInvoicePDF(sampleMonthlyInvoiceV2);
        filename = `Facture-${sampleMonthlyInvoiceV2.invoice_number}.pdf`;
      }
      
      if (result.success && result.blob) {
        safePDFDownload(result.blob, filename);
        toast.success(`✅ ${filename} généré avec succès! Vérifiez last_used_at dans /admin/qa`);
      } else {
        toast.error(`Erreur: ${result.error || "Génération échouée"}`);
      }
    } catch (error) {
      console.error("[AdminPDFTest] Error:", error);
      toast.error(`Exception: ${error instanceof Error ? error.message : "Erreur inconnue"}`);
    } finally {
      setIsGenerating(null);
    }
  };

  // Create invoice version of Internet+Install
  const sampleInvoiceInternet: UnifiedDocumentData = {
    ...sampleInternetInstall,
    docType: "invoice",
    metadata: {
      ...sampleInternetInstall.metadata,
      documentNumber: "INV-2026-0002",
    },
    payment: {
      status: "pending",
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    },
  };

  return (
    <AdminLayout>
      <div className="container mx-auto py-6 px-4 max-w-4xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">PDF Engine Test</h1>
            <p className="text-muted-foreground">
              Outil temporaire QA — Télécharger les PDFs pour vérifier le layout, l'espacement, et le contenu dynamique.
            </p>
          </div>
          <Link to="/admin/invoice-v2-preview">
            <Button className="gap-2">
              <Sparkles className="h-4 w-4" />
              Nouveau Template V2
            </Button>
          </Link>
        </div>

        {/* Contracts Section */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Contrats (Service Agreement)
            </CardTitle>
            <CardDescription>
              Télécharger les contrats de test avec différentes configurations de services
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Button
                onClick={() => handleDownload(sampleMobileOnly, "Contract-Mobile-Only.pdf")}
                className="w-full justify-start gap-2"
                variant="outline"
              >
                <Download className="h-4 w-4" />
                Mobile seulement
              </Button>
              
              <Button
                onClick={() => handleDownload(sampleInternetInstall, "Contract-Internet-Install.pdf")}
                className="w-full justify-start gap-2"
                variant="outline"
              >
                <Download className="h-4 w-4" />
                Internet + Installation + Rabais préauth
              </Button>
              
              <Button
                onClick={() => handleDownload(sampleTVBundle, "Contract-TV-Bundle.pdf")}
                className="w-full justify-start gap-2"
                variant="outline"
              >
                <Download className="h-4 w-4" />
                TV Bundle (résumé chaînes)
              </Button>

              <Button
                onClick={() => handleDownload(sampleFullCombo, "Contract-Full-Combo.pdf")}
                className="w-full justify-start gap-2"
                variant="hero"
              >
                <Download className="h-4 w-4" />
                COMBO: Internet + TV + Mobile (3 services + rabais)
              </Button>
            </div>

            <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
              <strong>Critères à vérifier :</strong>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>Nom entreprise: "Nivra Telecom"</li>
                <li>Email: support@nivra-telecom.ca</li>
                <li>Numéro de compte client visible</li>
                <li>TOUS les services sélectionnés avec prix individuels</li>
                <li>Rabais détaillés (préauth, promo, multi-lignes, fidélité)</li>
                <li>Aucun texte coupé ou superposé</li>
                <li>Sections vides cachées (pas de gros gaps)</li>
                <li>TV = résumé chaînes uniquement (pas de liste)</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Invoices Section */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Factures (Invoice)
            </CardTitle>
            <CardDescription>
              Télécharger les factures de test avec différents statuts de paiement
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Button
                onClick={() => handleDownload(sampleInvoiceMobile, "Invoice-Mobile-Paid.pdf")}
                className="w-full justify-start gap-2"
                variant="outline"
              >
                <Download className="h-4 w-4" />
                Mobile (Payée)
              </Button>
              
              <Button
                onClick={() => handleDownload(sampleInvoiceInternet, "Invoice-Internet-Pending.pdf")}
                className="w-full justify-start gap-2"
                variant="outline"
              >
                <Download className="h-4 w-4" />
                Internet (En attente)
              </Button>
              
              <Button
                onClick={() => handleDownload(sampleInvoiceTVBundle, "Invoice-TV-Bundle.pdf")}
                className="w-full justify-start gap-2"
                variant="outline"
              >
                <Download className="h-4 w-4" />
                TV Bundle
              </Button>

              <Button
                onClick={() => handleDownload(sampleInvoiceFullCombo, "Invoice-Full-Combo.pdf")}
                className="w-full justify-start gap-2"
                variant="hero"
              >
                <Download className="h-4 w-4" />
                COMBO: 3 services + rabais
              </Button>
            </div>

            <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
              <strong>Critères facture :</strong>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>Titre: "FACTURE / INVOICE"</li>
                <li>Statut paiement visible (Payé / En attente)</li>
                <li>Total et taxes QC (TPS + TVQ)</li>
                <li>Pas de section signature</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* V2.5 Invoice Engine Test Section - THIS USES THE UNIFIED ENGINE */}
        <Card className="mb-6 border-2 border-primary/50 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <Sparkles className="h-5 w-5" />
              Moteur Facture V2.5 (Unified Engine)
            </CardTitle>
            <CardDescription>
              <strong>TEST RÉEL:</strong> Ces boutons utilisent <code>generateInvoicePDF()</code> du <code>invoiceEngine.ts</code>.
              Après génération, <code>last_used_at</code> sera mis à jour dans <code>pdf_template_config</code>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Button
                onClick={() => handleV25InvoiceTest("ONETIME")}
                disabled={isGenerating !== null}
                className="w-full justify-start gap-2"
                variant="default"
              >
                {isGenerating === "ONETIME" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                Facture Unique V2.5 (RÉELLE)
              </Button>
              
              <Button
                onClick={() => handleV25InvoiceTest("MONTHLY")}
                disabled={isGenerating !== null}
                className="w-full justify-start gap-2"
                variant="default"
              >
                {isGenerating === "MONTHLY" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                Facture Mensuelle V2.5 (RÉELLE)
              </Button>
              
              <Button
                onClick={() => handleV25InvoiceTest("BLANK_ONETIME")}
                disabled={isGenerating !== null}
                className="w-full justify-start gap-2"
                variant="outline"
              >
                {isGenerating === "BLANK_ONETIME" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                Template Vierge (Unique)
              </Button>

              <Button
                onClick={() => handleV25InvoiceTest("BLANK_MONTHLY")}
                disabled={isGenerating !== null}
                className="w-full justify-start gap-2"
                variant="outline"
              >
                {isGenerating === "BLANK_MONTHLY" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                Template Vierge (Mensuelle)
              </Button>
            </div>

            <div className="text-sm text-primary-foreground/80 bg-primary/20 p-3 rounded-md">
              <strong>Vérification après génération:</strong>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>Ouvrir la console (F12) pour voir les logs <code>[InvoiceEngine]</code></li>
                <li>Aller sur <Link to="/admin/qa" className="underline font-medium">/admin/qa</Link> et rafraîchir</li>
                <li><code>last_used_at</code> doit changer pour le template utilisé</li>
                <li>Aucun "Invalid Date" dans le PDF généré</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Sample Data Info */}
        <Card>
          <CardHeader>
            <CardTitle>Données de test</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm space-y-2">
              <p><strong>Client:</strong> Jean-Pierre Tremblay</p>
              <p><strong>Adresse:</strong> 1234 Rue Principale, Montréal, QC H2X 1A1</p>
              <p><strong>Agent:</strong> Marie Lavoie (Conseillère)</p>
              <p><strong>Compte:</strong> CLT-2026-0001</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminPDFTest;
