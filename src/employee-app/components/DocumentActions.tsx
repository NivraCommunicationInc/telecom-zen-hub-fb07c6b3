/**
 * DocumentActions — View/download canonical documents (invoice, receipt, contract, order summary).
 * Uses existing canonical PDF generation paths. No template changes.
 * Optional resend to client via transactional email pipeline.
 */
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FileText, Download, Send, Loader2, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { logInternalAudit } from "@/lib/security/internalAuditLogger";
import {
  generateCanonicalInvoicePDF,
  generateCanonicalContractPDF,
} from "@/lib/pdf/canonicalDocumentService";
import {
  generateCanonicalReceiptPDF,
  generateCanonicalOrderSummaryPDF,
} from "@/lib/pdf/canonicalDocumentExtensions";
import { safePDFDownload } from "@/lib/pdfUtils";

type DocType = "invoice" | "receipt" | "contract" | "order_summary";

interface Props {
  orderId?: string;
  invoiceId?: string;
  contractId?: string;
  clientEmail?: string;
  clientName?: string;
  orderNumber?: string;
  invoiceNumber?: string;
  compact?: boolean;
}

const DOC_CONFIG: Record<DocType, { label: string; icon: string }> = {
  invoice: { label: "Facture", icon: "📄" },
  receipt: { label: "Reçu", icon: "🧾" },
  contract: { label: "Contrat", icon: "📋" },
  order_summary: { label: "Sommaire", icon: "📑" },
};

export function DocumentActions({
  orderId,
  invoiceId,
  contractId,
  clientEmail,
  clientName,
  orderNumber,
  invoiceNumber,
  compact = false,
}: Props) {
  const [generating, setGenerating] = useState<DocType | null>(null);
  const [resending, setResending] = useState<DocType | null>(null);

  const availableDocs: DocType[] = [];
  if (invoiceId) availableDocs.push("invoice");
  if (invoiceId) availableDocs.push("receipt");
  if (contractId || orderId) availableDocs.push("contract");
  if (orderId) availableDocs.push("order_summary");

  if (availableDocs.length === 0) return null;

  const generateDocument = async (type: DocType) => {
    switch (type) {
      case "invoice":
        return generateCanonicalInvoicePDF(supabase, invoiceId!);
      case "receipt":
        return generateCanonicalReceiptPDF(supabase, invoiceId!);
      case "contract":
        return generateCanonicalContractPDF(supabase, contractId || orderId!);
      case "order_summary":
        return generateCanonicalOrderSummaryPDF(supabase, orderId!);
    }
  };

  const handleView = async (type: DocType) => {
    setGenerating(type);
    try {
      const result = await generateDocument(type);

      if (result?.success && result.blob) {
        const url = URL.createObjectURL(result.blob);
        const opened = window.open(url, "_blank", "noopener,noreferrer");
        if (!opened) {
          toast.error("Impossible d'ouvrir l'aperçu (popup bloquée)");
          URL.revokeObjectURL(url);
          return;
        }
        setTimeout(() => URL.revokeObjectURL(url), 60_000);

        await logInternalAudit({
          action: `document_viewed_${type}`,
          category: "operations",
          portal: "employee",
          targetType: "document",
          targetId: orderId || invoiceId || contractId || "unknown",
        });
      } else {
        toast.error(result?.error || `Échec de génération: ${DOC_CONFIG[type].label}`);
      }
    } catch (err: any) {
      toast.error(err.message || "Erreur de génération");
    } finally {
      setGenerating(null);
    }
  };

  const handleDownload = async (type: DocType) => {
    setGenerating(type);
    try {
      const result = await generateDocument(type);

      if (result?.success && result.blob) {
        safePDFDownload(result.blob, result.filename || `${type}.pdf`);
        toast.success(`${DOC_CONFIG[type].label} téléchargé`);

        await logInternalAudit({
          action: `document_downloaded_${type}`,
          category: "operations",
          portal: "employee",
          targetType: "document",
          targetId: orderId || invoiceId || contractId || "unknown",
        });
      } else {
        toast.error(result?.error || `Échec de génération: ${DOC_CONFIG[type].label}`);
      }
    } catch (err: any) {
      toast.error(err.message || "Erreur de génération");
    } finally {
      setGenerating(null);
    }
  };

  const handleResend = async (type: DocType) => {
    if (!clientEmail) {
      toast.error("Email client introuvable");
      return;
    }

    setResending(type);
    try {
      const templateMap: Record<DocType, string> = {
        invoice: "invoice_created",
        receipt: "payment_confirmed",
        contract: "contract_ready",
        order_summary: "order_confirmation",
      };

      const idempotencyKey = `employee_resend_${type}_${orderId || invoiceId}_${Date.now()}`;

      const { error } = await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: templateMap[type],
          recipientEmail: clientEmail,
          idempotencyKey,
          templateData: {
            name: clientName ?? "Client",
            order_number: orderNumber,
            invoice_number: invoiceNumber,
          },
        },
      });

      if (error) throw error;

      toast.success(`${DOC_CONFIG[type].label} renvoyé à ${clientEmail}`);

      await logInternalAudit({
        action: `document_resent_${type}`,
        category: "operations",
        portal: "employee",
        targetType: "document",
        targetId: orderId || invoiceId || contractId || "unknown",
      });
    } catch (err: any) {
      toast.error(err.message || "Erreur d'envoi");
    } finally {
      setResending(null);
    }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-1 flex-wrap">
        {availableDocs.map((type) => (
          <button
            key={type}
            onClick={() => handleDownload(type)}
            disabled={generating === type}
            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-40"
            title={`Télécharger ${DOC_CONFIG[type].label}`}
          >
            {generating === type ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
            {DOC_CONFIG[type].label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <FileText className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Documents</h3>
      </div>
      <div className="space-y-2">
        {availableDocs.map((type) => (
          <div key={type} className="flex items-center justify-between py-1.5">
            <span className="text-xs text-foreground flex items-center gap-1.5">
              <span>{DOC_CONFIG[type].icon}</span> {DOC_CONFIG[type].label}
            </span>
            <div className="flex items-center gap-1">
                <button
                  onClick={() => handleView(type)}
                  disabled={generating === type}
                  className={cn(
                    "flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors disabled:opacity-40",
                    "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  )}
                >
                  {generating === type ? <Loader2 className="h-3 w-3 animate-spin" /> : <Eye className="h-3 w-3" />}
                  Voir
                </button>
              <button
                onClick={() => handleDownload(type)}
                disabled={generating === type}
                className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors disabled:opacity-40",
                  "text-primary bg-primary/10 hover:bg-primary/20"
                )}
              >
                {generating === type ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                Télécharger
              </button>
              {clientEmail && (
                <button
                  onClick={() => handleResend(type)}
                  disabled={resending === type}
                  className={cn(
                    "flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors disabled:opacity-40",
                    "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  )}
                  title={`Renvoyer à ${clientEmail}`}
                >
                  {resending === type ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                  Envoyer
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
