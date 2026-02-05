/**
 * PDF Engine Test Page
 * Temporary QA tool - Download sample PDFs to verify layout and formatting
 * Access: /admin/pdf-test (admin auth required)
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, FileText, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import AdminLayout from "@/components/admin/AdminLayout";
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
import type { UnifiedDocumentData } from "@/lib/pdfEngine/types";

const AdminPDFTest = () => {
  const handleDownload = (data: UnifiedDocumentData, filename: string) => {
    downloadUnifiedPDF(data, filename);
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
