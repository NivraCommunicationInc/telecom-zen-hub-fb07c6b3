/**
 * Admin Order Documents Panel
 * Shows invoice, contract, terms PDFs + KYC photos for an order
 * With diagnostic info when generation fails
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileText, Download, ShieldCheck, AlertTriangle, CheckCircle } from "lucide-react";
import { generateOrderDocuments, downloadPDF, fetchOrderDocumentData, validateDocumentData } from "@/lib/pdf/documentBuilder";
import { toast } from "sonner";

interface OrderDocumentsPanelProps {
  orderId: string;
  orderNumber?: string;
  orderStatus?: string;
  kycSessionId?: string | null;
}

type DocType = "invoice" | "receipt" | "orderSummary" | "contract" | "contractSummary" | "terms";

const DOC_LABELS: Record<DocType, string> = {
  invoice: "Facture",
  receipt: "Reçu",
  orderSummary: "Sommaire",
  contract: "Contrat",
  contractSummary: "RRE",
  terms: "Modalités",
};

export function OrderDocumentsPanel({ orderId, orderNumber, orderStatus, kycSessionId }: OrderDocumentsPanelProps) {
  const [generating, setGenerating] = useState(false);
  const [missingFields, setMissingFields] = useState<string[] | null>(null);
  const [lastResults, setLastResults] = useState<Record<string, boolean> | null>(null);

  const handleCheckReadiness = async () => {
    setGenerating(true);
    try {
      const data = await fetchOrderDocumentData(orderId);
      if (!data) {
        setMissingFields(["order_data_unavailable"]);
        toast.error("Données de commande introuvables");
        return;
      }
      const missing = validateDocumentData(data);
      setMissingFields(missing);
      if (missing.length === 0) {
        toast.success("Tous les champs requis sont présents — prêt pour génération");
      } else {
        toast.warning(`${missing.length} champ(s) manquant(s) — voir détails ci-dessous`);
      }
    } catch (err) {
      console.error("[OrderDocumentsPanel] Check error:", err);
      toast.error("Erreur lors de la vérification");
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateAll = async () => {
    setGenerating(true);
    setLastResults(null);
    try {
      const docs = await generateOrderDocuments(orderId);
      if (!docs) {
        // Fetch diagnostics
        await handleCheckReadiness();
        toast.error("Génération bloquée — champs obligatoires manquants");
        return;
      }

      const results: Record<string, boolean> = {};
      const entries: { name: string; key: DocType; result: any }[] = [
        { name: "Facture", key: "invoice", result: docs.invoice },
        { name: "Sommaire", key: "orderSummary", result: docs.orderSummary },
        { name: "Contrat", key: "contract", result: docs.contract },
        { name: "RRE", key: "contractSummary", result: docs.contractSummary },
        { name: "Modalités", key: "terms", result: docs.terms },
      ];

      let successCount = 0;
      entries.forEach(({ name, key, result }) => {
        results[key] = result.success;
        if (result.success) {
          downloadPDF(result);
          successCount++;
        } else {
          toast.error(`${name}: ${result.error}`);
        }
      });

      setLastResults(results);
      if (successCount === 5) {
        toast.success("5 documents téléchargés ✓");
      } else {
        toast.warning(`${successCount}/5 documents générés`);
      }
    } catch (err) {
      console.error("[OrderDocumentsPanel] Error:", err);
      toast.error("Erreur lors de la génération des documents");
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateSingle = async (type: DocType) => {
    setGenerating(true);
    try {
      const docs = await generateOrderDocuments(orderId);
      if (!docs) {
        await handleCheckReadiness();
        toast.error("Génération bloquée — champs manquants");
        return;
      }
      const result = docs[type];
      if (result.success) {
        downloadPDF(result);
        toast.success(`${DOC_LABELS[type]} téléchargé ✓`);
        setLastResults(prev => ({ ...prev, [type]: true }));
      } else {
        toast.error(result.error || "Erreur");
        setLastResults(prev => ({ ...prev, [type]: false }));
      }
    } catch (err) {
      toast.error("Erreur lors de la génération");
    } finally {
      setGenerating(false);
    }
  };

  const FIELD_LABELS: Record<string, { label: string; source: string }> = {
    client_name: { label: "Nom du client", source: "orders.client_first_name / profiles.full_name" },
    client_email: { label: "Courriel", source: "orders.client_email / profiles.email" },
    client_phone: { label: "Téléphone", source: "orders.client_phone / profiles.phone" },
    address_line1: { label: "Adresse", source: "orders.shipping_address / accounts.primary_service_address" },
    city: { label: "Ville", source: "orders.shipping_city / accounts.primary_service_city" },
    postal_code: { label: "Code postal", source: "orders.shipping_postal_code / accounts.primary_service_postal_code" },
    account_number: { label: "Numéro de compte", source: "accounts.account_number (auto-généré)" },
    order_number: { label: "Numéro de commande", source: "orders.order_number" },
    financial_data: { label: "Données financières", source: "billing_invoices ou orders.total_amount" },
    order_data_unavailable: { label: "Données de commande", source: "orders (table principale)" },
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          Documents {orderNumber ? `#${orderNumber}` : ""}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Document buttons */}
        <div className="grid grid-cols-5 gap-2">
          {(Object.entries(DOC_LABELS) as [DocType, string][]).map(([key, label]) => (
            <Button
              key={key}
              variant="outline"
              size="sm"
              onClick={() => handleGenerateSingle(key)}
              disabled={generating}
              className="text-xs relative"
            >
              <Download className="w-3 h-3 mr-1" />
              {label}
              {lastResults?.[key] === true && (
                <CheckCircle className="w-3 h-3 text-emerald-400 absolute -top-1 -right-1" />
              )}
              {lastResults?.[key] === false && (
                <AlertTriangle className="w-3 h-3 text-red-400 absolute -top-1 -right-1" />
              )}
            </Button>
          ))}
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

        {/* Check readiness */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleCheckReadiness}
          disabled={generating}
          className="w-full text-xs"
        >
          Vérifier les prérequis
        </Button>

        {/* Missing fields diagnostic */}
        {missingFields !== null && missingFields.length > 0 && (
          <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 space-y-1">
            <p className="text-xs font-medium text-destructive flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              {missingFields.length} champ(s) manquant(s) bloquent la génération :
            </p>
            <ul className="text-xs text-muted-foreground space-y-1 pl-4">
              {missingFields.map(f => {
                const info = FIELD_LABELS[f];
                return (
                  <li key={f}>
                    <span className="text-foreground font-medium">• {info?.label || f}</span>
                    {info?.source && <span className="text-muted-foreground ml-1">— source : <code className="text-xs bg-muted px-1 rounded">{info.source}</code></span>}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {missingFields !== null && missingFields.length === 0 && (
          <div className="p-2 rounded-md bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2">
            <CheckCircle className="w-3 h-3 text-emerald-400" />
            <span className="text-xs text-emerald-400">Prêt pour génération</span>
          </div>
        )}

        {/* KYC Status */}
        {kycSessionId && (
          <div className="flex items-center gap-2 p-2 rounded-md bg-muted">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground">Vérification d'identité liée</span>
            <Badge variant="outline" className="text-xs ml-auto">KYC</Badge>
          </div>
        )}

        {/* Order status */}
        {orderStatus && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Statut:</span>
            <Badge variant={orderStatus === "confirmed" || orderStatus === "completed" ? "default" : "secondary"} className="text-xs">
              {orderStatus}
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default OrderDocumentsPanel;
