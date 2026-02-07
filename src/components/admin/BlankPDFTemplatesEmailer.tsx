import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, Send, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

import {
  generateContractPDF,
  generateInvoiceMonthlyV2PDF,
  generateInvoiceOneTimeV2PDF,
  generateOrderSummaryPDF,
} from "@/lib/pdf";

import {
  generateTermsModalitesPDFBlob,
  type TermsModalitesData,
} from "@/lib/pdfEngine";

import {
  createBlankContractData,
  createBlankInvoiceDataV2,
  createBlankOrderSummaryData,
} from "@/lib/pdf/blankTemplateData";

const TEMPLATE_WATERMARK = "DOCUMENT MODÈLE — TEMPLATE VIERGE";

type EmailAttachment = {
  filename: string;
  content: string; // base64
  contentType: string;
};

type SendResult = {
  success: boolean;
  emailId?: string;
  attachments?: { filename: string; size: number }[];
  error?: string;
};

const FIXED_RECIPIENT = "Support@nivra-telecom.ca";

const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result || "");
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
};

export function BlankPDFTemplatesEmailer() {
  const { toast } = useToast();
  const [isSending, setIsSending] = useState(false);
  const [lastResult, setLastResult] = useState<SendResult | null>(null);

  // Build blank data once per page-load to keep the pack consistent
  const blankPack = useMemo(() => {
    const monthlyV2 = createBlankInvoiceDataV2("MONTHLY");
    const oneTimeV2 = createBlankInvoiceDataV2("ONETIME");
    const order = createBlankOrderSummaryData();
    const contract = createBlankContractData();

    const termsData: TermsModalitesData = {
      orderId: crypto.randomUUID(),
      orderNumber: "#COMMANDE",
      accountNumber: "#COMPTE",
      issuedDate: new Date(),
      // NO client name/email - blank template
    };

    return { monthlyV2, oneTimeV2, order, contract, termsData };
  }, []);

  const handleSend = async () => {
    setIsSending(true);
    setLastResult(null);
    
    try {
      // 1) Generate PDFs with watermark
      const termsBlob = generateTermsModalitesPDFBlob(blankPack.termsData);

      const orderRes = generateOrderSummaryPDF(blankPack.order);
      if (!orderRes.success || !orderRes.blob) throw new Error(orderRes.error || "Erreur génération Résumé");

      const contractRes = generateContractPDF(blankPack.contract);
      if (!contractRes.success || !contractRes.blob) throw new Error(contractRes.error || "Erreur génération Contrat");

      const oneTimeRes = generateInvoiceOneTimeV2PDF(blankPack.oneTimeV2);
      if (!oneTimeRes.success || !oneTimeRes.blob) throw new Error(oneTimeRes.error || "Erreur génération Facture unique");

      const monthlyRes = generateInvoiceMonthlyV2PDF(blankPack.monthlyV2);
      if (!monthlyRes.success || !monthlyRes.blob) throw new Error(monthlyRes.error || "Erreur génération Facture mensuelle");

      // 2) Convert to base64 for email attachments with V2.5 filenames
      const attachments: EmailAttachment[] = [
        {
          filename: "TEMPLATE-Modalites-V2.5.pdf",
          content: await blobToBase64(termsBlob),
          contentType: "application/pdf",
        },
        {
          filename: "TEMPLATE-ResumeCommande-V2.5.pdf",
          content: await blobToBase64(orderRes.blob),
          contentType: "application/pdf",
        },
        {
          filename: "TEMPLATE-Contrat-V2.5.pdf",
          content: await blobToBase64(contractRes.blob),
          contentType: "application/pdf",
        },
        {
          filename: "TEMPLATE-Facture-Unique-V2.5.pdf",
          content: await blobToBase64(oneTimeRes.blob),
          contentType: "application/pdf",
        },
        {
          filename: "TEMPLATE-Facture-Mensuelle-V2.5.pdf",
          content: await blobToBase64(monthlyRes.blob),
          contentType: "application/pdf",
        },
      ];

      // Calculate sizes
      const attachmentDetails = attachments.map(a => ({
        filename: a.filename,
        size: Math.round((a.content.length * 3) / 4), // base64 to bytes approximation
      }));

      // 3) Send via edge function
      const { data, error } = await supabase.functions.invoke("send-pdf-templates-email", {
        body: {
          email: FIXED_RECIPIENT,
          attachments,
          kind: "blank_templates_v2_5",
          watermark: TEMPLATE_WATERMARK,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Échec de l'envoi");

      const result: SendResult = {
        success: true,
        emailId: data.emailId,
        attachments: attachmentDetails,
      };
      
      setLastResult(result);

      toast({
        title: "✅ Envoyé avec succès",
        description: `${attachments.length} PDFs envoyés à ${FIXED_RECIPIENT}`,
      });
    } catch (e: any) {
      const result: SendResult = {
        success: false,
        error: e?.message || "Impossible d'envoyer les PDFs",
      };
      setLastResult(result);
      
      toast({
        title: "Erreur",
        description: result.error,
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-primary" />
          Envoyer Templates PDF V2.5 (Vierges)
        </CardTitle>
        <CardDescription>
          Envoie 5 PDFs vierges avec placeholders neutres (CLIENT_NOM, FORFAIT, etc.) 
          et watermark "{TEMPLATE_WATERMARK}" à <strong>{FIXED_RECIPIENT}</strong>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
          <p className="font-medium mb-2">📎 Fichiers joints :</p>
          <ul className="list-disc list-inside space-y-1">
            <li>TEMPLATE-Modalites-V2.5.pdf</li>
            <li>TEMPLATE-ResumeCommande-V2.5.pdf</li>
            <li>TEMPLATE-Contrat-V2.5.pdf</li>
            <li>TEMPLATE-Facture-Unique-V2.5.pdf</li>
            <li>TEMPLATE-Facture-Mensuelle-V2.5.pdf</li>
          </ul>
        </div>

        <Button onClick={handleSend} disabled={isSending} className="w-full sm:w-auto">
          <Send className="h-4 w-4 mr-2" />
          {isSending ? "Génération et envoi…" : `Envoyer à ${FIXED_RECIPIENT}`}
        </Button>

        {lastResult && (
          <div className={`p-3 rounded-md text-sm ${lastResult.success ? 'bg-primary/10 border border-primary/20' : 'bg-destructive/10 border border-destructive/20'}`}>
            {lastResult.success ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-primary font-medium">
                  <CheckCircle className="h-4 w-4" />
                  Email envoyé avec succès
                </div>
                <p className="text-muted-foreground">ID: {lastResult.emailId}</p>
                <div className="text-foreground">
                  <p className="font-medium">Pièces jointes :</p>
                  <ul className="list-disc list-inside text-muted-foreground">
                    {lastResult.attachments?.map((a, i) => (
                      <li key={i}>{a.filename} ({Math.round(a.size / 1024)} KB)</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <p className="text-destructive">❌ Erreur : {lastResult.error}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
