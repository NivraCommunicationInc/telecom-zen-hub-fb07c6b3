/**
 * Edge Function: Send Blank PDF Templates
 * Generates 5 blank PDF templates server-side and sends them as email attachments.
 * NO authentication required - this is an internal tool.
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "../_shared/ResendProxy.ts";
// @deno-types="npm:jspdf@2.5.1"
import { jsPDF } from "npm:jspdf@2.5.1";

import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

const RECIPIENT = "Support@nivra-telecom.ca";
const WATERMARK = "DOCUMENT MODÈLE — TEMPLATE VIERGE";

// Helper: Generate a simple placeholder PDF
function generatePlaceholderPDF(title: string, docType: string, fields: { label: string; value: string }[]): string {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  // Header background
  doc.setFillColor(15, 23, 42); // #0F172A
  doc.rect(0, 0, pageWidth, 35, "F");
  
  // Logo/Company name
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("NIVRA COMMUNICATIONS INC.", 15, 15);
  
  // Document type
  doc.setFontSize(14);
  doc.setFont("helvetica", "normal");
  doc.text(docType, 15, 25);
  
  // Watermark
  doc.setTextColor(200, 200, 200);
  doc.setFontSize(10);
  doc.text(WATERMARK, pageWidth / 2, 32, { align: "center" });
  
  // Title
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(title, 15, 50);
  
  // Version badge
  doc.setFillColor(20, 184, 166); // Teal
  doc.roundedRect(pageWidth - 35, 45, 25, 8, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.text("V2.5", pageWidth - 22.5, 50, { align: "center" });
  
  // Fields
  doc.setTextColor(71, 85, 105); // Slate
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  
  let y = 65;
  for (const field of fields) {
    doc.setFont("helvetica", "bold");
    doc.text(`${field.label}:`, 15, y);
    doc.setFont("helvetica", "normal");
    doc.text(field.value, 70, y);
    y += 8;
  }
  
  // Table header
  y += 10;
  doc.setFillColor(241, 245, 249); // Slate-100
  doc.rect(15, y - 5, pageWidth - 30, 10, "F");
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Description", 20, y);
  doc.text("Qté", 110, y);
  doc.text("Prix unit.", 130, y);
  doc.text("Total", 160, y);
  
  // Table row
  y += 12;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text("FORFAIT_NOM", 20, y);
  doc.text("1", 110, y);
  doc.text("0,00 $", 130, y);
  doc.text("0,00 $", 160, y);
  
  // Totals section
  y += 20;
  doc.setDrawColor(226, 232, 240);
  doc.line(100, y, pageWidth - 15, y);
  y += 8;
  
  const totals = [
    { label: "Sous-total", value: "0,00 $" },
    { label: "TPS (0%)", value: "0,00 $" },
    { label: "TVQ (0%)", value: "0,00 $" },
    { label: "TOTAL", value: "0,00 $", bold: true },
  ];
  
  for (const t of totals) {
    if (t.bold) {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42);
    } else {
      doc.setFont("helvetica", "normal");
      doc.setTextColor(71, 85, 105);
    }
    doc.text(t.label, 120, y);
    doc.text(t.value, 160, y);
    y += 7;
  }
  
  // Footer
  doc.setTextColor(148, 163, 184);
  doc.setFontSize(8);
  doc.text("Ce document est un modèle de démonstration — aucune donnée réelle", pageWidth / 2, pageHeight - 15, { align: "center" });
  doc.text("© 2026 Nivra Communications Inc.", pageWidth / 2, pageHeight - 10, { align: "center" });
  
  // Return as base64
  return doc.output("datauristring").split(",")[1];
}

// Generate all 5 templates
function generateAllTemplates(): { filename: string; content: string; contentType: string }[] {
  const commonFields = [
    { label: "Numéro", value: "#DOCUMENT" },
    { label: "Date", value: "DATE_EMISSION" },
    { label: "Client", value: "CLIENT_NOM" },
    { label: "Email", value: "CLIENT_EMAIL" },
    { label: "Téléphone", value: "CLIENT_TEL" },
    { label: "Adresse", value: "CLIENT_ADRESSE" },
    { label: "Compte", value: "#COMPTE" },
  ];
  
  return [
    {
      filename: "TEMPLATE-Modalites-V2.5.pdf",
      content: generatePlaceholderPDF(
        "Modalités de Service",
        "CONDITIONS GÉNÉRALES",
        [
          { label: "Document ID", value: "ND-TOS-2026" },
          { label: "Version", value: "V2.5" },
          { label: "Commande", value: "#COMMANDE" },
          { label: "Compte", value: "#COMPTE" },
          { label: "Date émission", value: "DATE_EMISSION" },
        ]
      ),
      contentType: "application/pdf",
    },
    {
      filename: "TEMPLATE-ResumeCommande-V2.5.pdf",
      content: generatePlaceholderPDF(
        "Résumé de Commande",
        "SOMMAIRE",
        [
          { label: "Commande", value: "#COMMANDE" },
          ...commonFields.slice(1),
        ]
      ),
      contentType: "application/pdf",
    },
    {
      filename: "TEMPLATE-Contrat-V2.5.pdf",
      content: generatePlaceholderPDF(
        "Contrat de Service",
        "CONTRAT",
        [
          { label: "Contrat", value: "#CONTRAT" },
          ...commonFields.slice(1),
        ]
      ),
      contentType: "application/pdf",
    },
    {
      filename: "TEMPLATE-Facture-Unique-V2.5.pdf",
      content: generatePlaceholderPDF(
        "Facture Unique",
        "FACTURE — ÉQUIPEMENT & FRAIS",
        [
          { label: "Facture", value: "#FACTURE" },
          ...commonFields.slice(1),
        ]
      ),
      contentType: "application/pdf",
    },
    {
      filename: "TEMPLATE-Facture-Mensuelle-V2.5.pdf",
      content: generatePlaceholderPDF(
        "Facture Mensuelle",
        "FACTURE — ABONNEMENT",
        [
          { label: "Facture", value: "#FACTURE" },
          { label: "Période", value: "DEBUT_PERIODE — FIN_PERIODE" },
          ...commonFields.slice(1),
        ]
      ),
      contentType: "application/pdf",
    },
  ];
}

// Email HTML template
function buildEmailHtml(filenames: string[]): string {
  const list = filenames.map((f) => `<li style="margin: 6px 0;">📄 ${f}</li>`).join("");
  return `
  <!doctype html>
  <html lang="fr">
    <body style="font-family: Arial, sans-serif; background: #f8fafc; padding: 24px; color: #0f172a;">
      <div style="max-width: 640px; margin: 0 auto; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
        <div style="background:#0F172A; color:#fff; padding: 18px 20px;">
          <div style="font-size: 18px; font-weight: 700;">📎 Templates PDF V2.5 — Pack vierge</div>
          <div style="font-size: 12px; color:#94a3b8; margin-top: 4px;">5 pièces jointes PDF — aucune donnée client réelle</div>
        </div>
        <div style="padding: 18px 20px;">
          <p style="margin: 0 0 12px; color:#334155; font-weight: 500;">
            Voici les 5 templates PDF vierges en pièces jointes :
          </p>
          <ul style="margin: 0; padding-left: 18px; color:#0f172a; line-height: 1.8;">${list}</ul>
          <div style="margin: 16px 0 0; padding: 12px; background: #f1f5f9; border-radius: 6px;">
            <p style="margin: 0; font-size: 12px; color:#475569;">
              <strong>Contenu des PDFs :</strong><br/>
              • Placeholders neutres : CLIENT_NOM, FORFAIT, ADRESSE, DATE, #COMMANDE, etc.<br/>
              • Tous montants et taxes = 0<br/>
              • Aucune donnée client, forfait ou service réelle
            </p>
            <p style="margin: 8px 0 0; font-size: 11px; color:#94a3b8; font-style: italic;">
              Watermark: "${WATERMARK}"
            </p>
          </div>
        </div>
        <div style="background:#f8fafc; padding: 12px 20px; border-top: 1px solid #e2e8f0;">
          <p style="margin: 0; font-size: 11px; color:#64748b; text-align: center;">
            © 2026 Nivra Communications Inc. — Templates V2.5
          </p>
        </div>
      </div>
    </body>
  </html>
  `;
}

serve(async (req: Request): Promise<Response> => {
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;

  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY not configured");
    }

    // Generate all 5 PDFs server-side
    console.log("[send-blank-pdf-templates] Generating 5 PDFs...");
    const attachments = generateAllTemplates();
    
    const attachmentDetails = attachments.map(a => ({
      filename: a.filename,
      size: Math.round((a.content.length * 3) / 4), // base64 to bytes
    }));
    
    console.log("[send-blank-pdf-templates] PDFs generated:", attachmentDetails);

    const resend = new Resend(RESEND_API_KEY);
    const filenames = attachments.map(a => a.filename);
    
    console.log("[send-blank-pdf-templates] Sending email to:", RECIPIENT);
    
    const emailResult = await resend.emails.send({
      from: "Nivra Télécom <Support@nivra-telecom.ca>",
      to: [RECIPIENT],
      subject: "📎 Templates PDF V2.5 — Pack vierge (5 PDFs)",
      replyTo: "support@nivra-telecom.ca",
      html: buildEmailHtml(filenames),
      attachments,
    });

    console.log("[send-blank-pdf-templates] Email sent:", emailResult);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Email envoyé à ${RECIPIENT}`,
        emailId: (emailResult as any)?.id,
        attachmentCount: attachments.length,
        attachments: attachmentDetails,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: unknown) {
    console.error("[send-blank-pdf-templates] Error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
