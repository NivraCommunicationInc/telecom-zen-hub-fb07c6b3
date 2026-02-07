import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mail, Send } from "lucide-react";
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
  getTermsModalitesFilename,
  type TermsModalitesData,
} from "@/lib/pdfEngine";

import {
  createBlankContractData,
  createBlankInvoiceDataV2,
  createBlankOrderSummaryData,
} from "@/lib/pdf/blankTemplateData";

type EmailAttachment = {
  filename: string;
  content: string; // base64
  contentType: string;
};

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
  const [email, setEmail] = useState("support@nivra-telecom.ca");
  const [isSending, setIsSending] = useState(false);

  // Build blank data once per page-load to keep the pack consistent
  const blankPack = useMemo(() => {
    const monthlyV2 = createBlankInvoiceDataV2("MONTHLY");
    const oneTimeV2 = createBlankInvoiceDataV2("ONETIME");
    const order = createBlankOrderSummaryData();
    const contract = createBlankContractData();

    const termsData: TermsModalitesData = {
      orderId: crypto.randomUUID(),
      orderNumber: order.order_number,
      accountNumber: order.account_number,
      issuedDate: new Date(),
      // IMPORTANT: do NOT include clientName/clientEmail (must stay blank)
    };

    return { monthlyV2, oneTimeV2, order, contract, termsData };
  }, []);

  const handleSend = async () => {
    if (!email.trim()) {
      toast({ title: "Erreur", description: "Entrez un email", variant: "destructive" });
      return;
    }

    setIsSending(true);
    try {
      // 1) Generate PDFs
      const termsBlob = generateTermsModalitesPDFBlob(blankPack.termsData);

      const orderRes = generateOrderSummaryPDF(blankPack.order);
      if (!orderRes.success || !orderRes.blob) throw new Error(orderRes.error || "Erreur génération Résumé");

      const contractRes = generateContractPDF(blankPack.contract);
      if (!contractRes.success || !contractRes.blob) throw new Error(contractRes.error || "Erreur génération Contrat");

      const oneTimeRes = generateInvoiceOneTimeV2PDF(blankPack.oneTimeV2);
      if (!oneTimeRes.success || !oneTimeRes.blob) throw new Error(oneTimeRes.error || "Erreur génération Facture unique");

      const monthlyRes = generateInvoiceMonthlyV2PDF(blankPack.monthlyV2);
      if (!monthlyRes.success || !monthlyRes.blob) throw new Error(monthlyRes.error || "Erreur génération Facture mensuelle");

      // 2) Convert to base64 for email attachments
      const attachments: EmailAttachment[] = [
        {
          filename: `Template-01-${getTermsModalitesFilename(blankPack.order.order_number).replace(/\.pdf$/i, "")}.pdf`,
          content: await blobToBase64(termsBlob),
          contentType: "application/pdf",
        },
        {
          filename: "Template-02-Resume-Commande.pdf",
          content: await blobToBase64(orderRes.blob),
          contentType: "application/pdf",
        },
        {
          filename: "Template-03-Contrat.pdf",
          content: await blobToBase64(contractRes.blob),
          contentType: "application/pdf",
        },
        {
          filename: "Template-04-Facture-Unique-V2.4.pdf",
          content: await blobToBase64(oneTimeRes.blob),
          contentType: "application/pdf",
        },
        {
          filename: "Template-05-Facture-Mensuelle-V2.4.pdf",
          content: await blobToBase64(monthlyRes.blob),
          contentType: "application/pdf",
        },
      ];

      // 3) Send via backend function (Resend)
      const { data, error } = await supabase.functions.invoke("send-pdf-templates-email", {
        body: {
          email: email.trim(),
          attachments,
          kind: "blank_templates_v2_4",
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Échec de l’envoi");

      toast({
        title: "Envoyé",
        description: `${attachments.length} PDFs envoyés à ${email.trim()}`,
      });
    } catch (e: any) {
      toast({
        title: "Erreur",
        description: e?.message || "Impossible d’envoyer les PDFs",
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
          Envoyer les templates PDF (vierges)
        </CardTitle>
        <CardDescription>
          Envoie 5 PDFs en pièces jointes (Modalités, Résumé, Contrat, Facture unique, Facture mensuelle) avec données neutres.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="text-sm text-muted-foreground">Email de destination</label>
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="support@nivra-telecom.ca"
            inputMode="email"
            autoComplete="email"
          />
        </div>
        <Button onClick={handleSend} disabled={isSending} className="sm:whitespace-nowrap">
          <Send className="h-4 w-4 mr-2" />
          {isSending ? "Envoi…" : "Envoyer (5 PDFs)"}
        </Button>
      </CardContent>
    </Card>
  );
}
