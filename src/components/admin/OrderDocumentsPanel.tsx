/**
 * Admin Order Documents Panel
 * Shows invoice, contract, terms PDFs + KYC photos for an order
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileText, Download, ShieldCheck, AlertTriangle, Eye } from "lucide-react";
import { generateOrderDocuments, downloadPDF } from "@/lib/pdf/documentBuilder";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

interface OrderDocumentsPanelProps {
  orderId: string;
  orderNumber?: string;
  orderStatus?: string;
  kycSessionId?: string | null;
}

export function OrderDocumentsPanel({ orderId, orderNumber, orderStatus, kycSessionId }: OrderDocumentsPanelProps) {
  const [generating, setGenerating] = useState(false);

  const handleGenerateAll = async () => {
    setGenerating(true);
    try {
      const docs = await generateOrderDocuments(orderId);
      if (!docs) {
        toast.error("Impossible de récupérer les données de commande");
        return;
      }

      const results = [
        { name: "Facture", result: docs.invoice },
        { name: "Sommaire", result: docs.orderSummary },
        { name: "Contrat", result: docs.contract },
        { name: "Résumé contrat", result: docs.contractSummary },
        { name: "Modalités", result: docs.terms },
      ];

      results.forEach(({ name, result }) => {
        if (result.success) {
          downloadPDF(result);
          toast.success(`${name} téléchargée`);
        } else {
          toast.error(`${name}: ${result.error}`);
        }
      });
    } catch (err) {
      console.error("[OrderDocumentsPanel] Error:", err);
      toast.error("Erreur lors de la génération des documents");
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateSingle = async (type: "invoice" | "orderSummary" | "contract" | "contractSummary" | "terms") => {
    setGenerating(true);
    try {
      const docs = await generateOrderDocuments(orderId);
      if (!docs) {
        toast.error("Données indisponibles");
        return;
      }
      const result = docs[type];
      if (result.success) {
        downloadPDF(result);
        toast.success("Document téléchargé");
      } else {
        toast.error(result.error || "Erreur");
      }
    } catch (err) {
      toast.error("Erreur lors de la génération");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          Documents de la commande {orderNumber ? `#${orderNumber}` : ""}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Document buttons */}
        <div className="grid grid-cols-5 gap-2">
          <Button variant="outline" size="sm" onClick={() => handleGenerateSingle("invoice")} disabled={generating} className="text-xs">
            <Download className="w-3 h-3 mr-1" />
            Facture
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleGenerateSingle("orderSummary")} disabled={generating} className="text-xs">
            <Download className="w-3 h-3 mr-1" />
            Sommaire
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleGenerateSingle("contract")} disabled={generating} className="text-xs">
            <Download className="w-3 h-3 mr-1" />
            Contrat
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleGenerateSingle("contractSummary")} disabled={generating} className="text-xs">
            <Download className="w-3 h-3 mr-1" />
            RRE
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleGenerateSingle("terms")} disabled={generating} className="text-xs">
            <Download className="w-3 h-3 mr-1" />
            Modalités
          </Button>
        </div>

        {/* Download all */}
        <Button
          onClick={handleGenerateAll}
          disabled={generating}
          className="w-full"
          size="sm"
        >
          {generating ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <Download className="w-4 h-4 mr-2" />
          )}
          {generating ? "Génération..." : "Télécharger les 5 documents"}
        </Button>

        {/* KYC Status */}
        {kycSessionId && (
          <div className="flex items-center gap-2 p-2 rounded-md bg-muted">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground">Vérification d'identité liée</span>
            <Badge variant="outline" className="text-xs ml-auto">
              KYC
            </Badge>
          </div>
        )}

        {/* Order status */}
        {orderStatus && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Statut:</span>
            <Badge variant={orderStatus === "confirmed" ? "default" : "secondary"} className="text-xs">
              {orderStatus}
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default OrderDocumentsPanel;
