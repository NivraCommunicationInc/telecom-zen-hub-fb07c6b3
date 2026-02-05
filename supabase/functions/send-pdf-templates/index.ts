import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { jsPDF } from "npm:jspdf@2.5.1";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Company info
const COMPANY = {
  name: "Nivra Telecom",
  legalName: "9477-4922 Québec inc. (Nivra Telecom)",
  address: "1799 Av. Pierre-Péladeau, Laval, QC H7T 2Y5",
  phone: "438-544-2233",
  email: "Support@nivra-telecom.ca",
  website: "nivra-telecom.ca",
  neq: "1176282285",
  gstNumber: "713971764RT0001",
  qstNumber: "1232379195TQ0001",
};

// Colors
const COLORS = {
  primary: [15, 23, 42] as [number, number, number],
  accent: [20, 184, 166] as [number, number, number],
  text: [51, 65, 85] as [number, number, number],
  lightGray: [241, 245, 249] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  success: [22, 163, 74] as [number, number, number],
};

function generateInvoiceV2PDF(): string {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  let y = 15;

  // Force white background
  doc.setFillColor(...COLORS.white);
  doc.rect(0, 0, pageWidth, pageHeight, "F");

  // Header bar
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, pageWidth, 28, "F");

  doc.setTextColor(...COLORS.white);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("NIVRA TELECOM", margin, 12);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Télécom prépayée au Québec", margin, 18);
  doc.text(`${COMPANY.phone} | ${COMPANY.email}`, margin, 23);

  // FACTURE label
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("FACTURE", pageWidth - margin, 14, { align: "right" });

  y = 38;

  // Invoice info box
  doc.setFillColor(...COLORS.lightGray);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 30, 3, 3, "F");

  doc.setTextColor(...COLORS.primary);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Numéro de facture:", margin + 5, y + 8);
  doc.text("Date de facturation:", margin + 5, y + 16);
  doc.text("Date d'échéance:", margin + 5, y + 24);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.text);
  doc.text("NV-2025-001234", margin + 55, y + 8);
  doc.text("5 février 2025", margin + 55, y + 16);
  doc.text("20 février 2025", margin + 55, y + 24);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.primary);
  doc.text("Numéro de compte:", pageWidth / 2 + 10, y + 8);
  doc.text("Période de service:", pageWidth / 2 + 10, y + 16);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.text);
  doc.text("ACC-123456", pageWidth - margin - 25, y + 8);
  doc.text("1 fév – 28 fév 2025", pageWidth - margin - 25, y + 16);

  y += 40;

  // Client info
  doc.setFillColor(...COLORS.accent);
  doc.rect(margin, y, 3, 20, "F");

  doc.setTextColor(...COLORS.primary);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Facturé à:", margin + 8, y + 7);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.text);
  doc.text("Jean-François Tremblay", margin + 8, y + 14);
  doc.text("1234 Rue de l'Exemple, Montréal, QC H1A 2B3", margin + 8, y + 20);

  y += 32;

  // Services table header
  doc.setFillColor(...COLORS.primary);
  doc.rect(margin, y, pageWidth - margin * 2, 10, "F");

  doc.setTextColor(...COLORS.white);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("SERVICE", margin + 5, y + 7);
  doc.text("DESCRIPTION", margin + 50, y + 7);
  doc.text("MONTANT", pageWidth - margin - 5, y + 7, { align: "right" });

  y += 12;

  // Services
  const services = [
    { name: "Internet 500 Mbps", desc: "Illimité, routeur inclus", price: 50.0 },
    { name: "TV Basic 26 chaînes", desc: "Terminal Nivra 4K inclus", price: 25.0 },
    { name: "Mobile 50GB", desc: "Appels illimités Canada", price: 50.0 },
  ];

  doc.setTextColor(...COLORS.text);
  doc.setFont("helvetica", "normal");

  services.forEach((service, i) => {
    const rowY = y + i * 10;
    if (i % 2 === 0) {
      doc.setFillColor(...COLORS.lightGray);
      doc.rect(margin, rowY - 3, pageWidth - margin * 2, 10, "F");
    }
    doc.text(service.name, margin + 5, rowY + 4);
    doc.text(service.desc, margin + 50, rowY + 4);
    doc.text(`${service.price.toFixed(2)} $`, pageWidth - margin - 5, rowY + 4, { align: "right" });
  });

  y += services.length * 10 + 10;

  // Totals
  doc.setDrawColor(200, 200, 200);
  doc.line(pageWidth / 2, y, pageWidth - margin, y);

  y += 8;
  const totals = [
    { label: "Sous-total", value: "125.00 $" },
    { label: "TPS (5%)", value: "6.25 $" },
    { label: "TVQ (9.975%)", value: "12.47 $" },
  ];

  doc.setFontSize(10);
  totals.forEach((item, i) => {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLORS.text);
    doc.text(item.label, pageWidth / 2 + 10, y + i * 7);
    doc.text(item.value, pageWidth - margin - 5, y + i * 7, { align: "right" });
  });

  y += totals.length * 7 + 5;

  // Total box
  doc.setFillColor(...COLORS.accent);
  doc.roundedRect(pageWidth / 2, y, pageWidth / 2 - margin, 14, 2, 2, "F");

  doc.setTextColor(...COLORS.white);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("TOTAL À PAYER", pageWidth / 2 + 8, y + 9);
  doc.text("143.72 $", pageWidth - margin - 5, y + 9, { align: "right" });

  y += 25;

  // Payment info
  doc.setFillColor(...COLORS.lightGray);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 24, 3, 3, "F");

  doc.setTextColor(...COLORS.primary);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Paiement par Virement Interac", margin + 5, y + 8);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.text);
  doc.setFontSize(9);
  doc.text("Courriel: paiement@nivra-telecom.ca", margin + 5, y + 15);
  doc.text("Mot de passe: nivra2025", margin + 5, y + 21);
  doc.text("Référence: NV-2025-001234", margin + 90, y + 15);

  // Footer
  const footerY = pageHeight - 20;
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, footerY - 5, pageWidth, 25, "F");

  doc.setTextColor(...COLORS.white);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(COMPANY.legalName, pageWidth / 2, footerY + 2, { align: "center" });
  doc.text(`${COMPANY.address} | ${COMPANY.phone} | ${COMPANY.email}`, pageWidth / 2, footerY + 8, { align: "center" });
  doc.text(`TPS: ${COMPANY.gstNumber} | TVQ: ${COMPANY.qstNumber}`, pageWidth / 2, footerY + 14, { align: "center" });

  return doc.output("datauristring").split(",")[1];
}

function generateContractPDF(): string {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  let y = 15;

  // Force white background
  doc.setFillColor(...COLORS.white);
  doc.rect(0, 0, pageWidth, pageHeight, "F");

  // Header
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, pageWidth, 25, "F");

  doc.setTextColor(...COLORS.white);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("CONTRAT DE SERVICE", pageWidth / 2, 14, { align: "center" });

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Nivra Telecom — Télécom prépayée au Québec", pageWidth / 2, 21, { align: "center" });

  y = 35;

  // Contract number box
  doc.setFillColor(...COLORS.lightGray);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 18, 3, 3, "F");

  doc.setTextColor(...COLORS.primary);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Numéro de contrat:", margin + 5, y + 8);
  doc.text("Date d'entrée en vigueur:", pageWidth / 2 + 5, y + 8);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.text);
  doc.text("CTR-2025-001234", margin + 50, y + 8);
  doc.text("5 février 2025", pageWidth / 2 + 55, y + 8);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.primary);
  doc.text("Client:", margin + 5, y + 14);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.text);
  doc.text("Jean-François Tremblay", margin + 22, y + 14);

  y += 28;

  // Services section
  doc.setFillColor(...COLORS.accent);
  doc.rect(margin, y, 4, 8, "F");

  doc.setTextColor(...COLORS.primary);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Services inclus", margin + 8, y + 6);

  y += 14;

  const services = [
    "Internet 500 Mbps — Illimité",
    "TV Basic 26 chaînes avec Terminal Nivra 4K",
    "Mobile 50GB — Appels illimités Canada",
  ];

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.text);

  services.forEach((service, i) => {
    doc.setFillColor(...COLORS.accent);
    doc.circle(margin + 3, y + i * 8 + 2, 1.5, "F");
    doc.text(service, margin + 10, y + i * 8 + 4);
  });

  y += services.length * 8 + 15;

  // Terms section
  doc.setFillColor(...COLORS.accent);
  doc.rect(margin, y, 4, 8, "F");

  doc.setTextColor(...COLORS.primary);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Conditions générales", margin + 8, y + 6);

  y += 14;

  const terms = [
    "1. Le présent contrat est sans engagement et peut être résilié en tout temps.",
    "2. Les services sont prépayés et activés après réception du paiement.",
    "3. L'équipement demeure la propriété de Nivra Telecom.",
    "4. Le client s'engage à utiliser les services conformément aux lois en vigueur.",
    "5. Nivra Telecom se réserve le droit de modifier les tarifs avec préavis de 30 jours.",
  ];

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.text);

  terms.forEach((term, i) => {
    doc.text(term, margin, y + i * 7);
  });

  y += terms.length * 7 + 20;

  // Signature section
  doc.setFillColor(...COLORS.lightGray);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 35, 3, 3, "F");

  doc.setTextColor(...COLORS.primary);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Signatures", margin + 5, y + 8);

  doc.setDrawColor(150, 150, 150);
  doc.line(margin + 10, y + 25, margin + 70, y + 25);
  doc.line(pageWidth / 2 + 10, y + 25, pageWidth - margin - 10, y + 25);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.text);
  doc.text("Signature du client", margin + 25, y + 31);
  doc.text("Signature de l'agent Nivra", pageWidth / 2 + 30, y + 31);

  // Footer
  const footerY = pageHeight - 15;
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, footerY - 5, pageWidth, 20, "F");

  doc.setTextColor(...COLORS.white);
  doc.setFontSize(7);
  doc.text(`${COMPANY.legalName} | ${COMPANY.address} | ${COMPANY.phone}`, pageWidth / 2, footerY + 4, { align: "center" });
  doc.text(`NEQ: ${COMPANY.neq} | TPS: ${COMPANY.gstNumber} | TVQ: ${COMPANY.qstNumber}`, pageWidth / 2, footerY + 9, { align: "center" });

  return doc.output("datauristring").split(",")[1];
}

function generateSummaryPDF(): string {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  let y = 15;

  // Force white background
  doc.setFillColor(...COLORS.white);
  doc.rect(0, 0, pageWidth, pageHeight, "F");

  // Header
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, pageWidth, 25, "F");

  doc.setTextColor(...COLORS.white);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("SOMMAIRE DE COMMANDE", pageWidth / 2, 14, { align: "center" });

  doc.setFontSize(9);
  doc.text("Nivra Telecom", pageWidth / 2, 21, { align: "center" });

  y = 35;

  // Order info
  doc.setFillColor(...COLORS.accent);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 22, 3, 3, "F");

  doc.setTextColor(...COLORS.white);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Commande #CMD-2025-001234", margin + 5, y + 9);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Date: 5 février 2025", margin + 5, y + 16);
  doc.text("Statut: En attente d'installation", pageWidth / 2, y + 16);

  y += 32;

  // Client section
  doc.setTextColor(...COLORS.primary);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Informations client", margin, y);

  y += 8;
  doc.setFillColor(...COLORS.lightGray);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 28, 3, 3, "F");

  doc.setFontSize(9);
  doc.setTextColor(...COLORS.text);
  doc.setFont("helvetica", "normal");
  doc.text("Nom: Jean-François Tremblay", margin + 5, y + 8);
  doc.text("Courriel: jean.tremblay@email.com", margin + 5, y + 15);
  doc.text("Téléphone: 514-555-1234", margin + 5, y + 22);
  doc.text("Adresse: 1234 Rue de l'Exemple", pageWidth / 2, y + 8);
  doc.text("Ville: Montréal, QC H1A 2B3", pageWidth / 2, y + 15);

  y += 38;

  // Services ordered
  doc.setTextColor(...COLORS.primary);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Services commandés", margin, y);

  y += 8;

  const services = [
    { name: "Internet 500 Mbps", price: "50.00 $" },
    { name: "TV Basic 26 chaînes", price: "25.00 $" },
    { name: "Terminal Nivra 4K (équipement)", price: "50.00 $" },
    { name: "Routeur Nivra Born Wifi (équipement)", price: "60.00 $" },
  ];

  doc.setFillColor(...COLORS.primary);
  doc.rect(margin, y, pageWidth - margin * 2, 8, "F");

  doc.setTextColor(...COLORS.white);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("SERVICE", margin + 5, y + 5.5);
  doc.text("PRIX", pageWidth - margin - 5, y + 5.5, { align: "right" });

  y += 10;

  doc.setTextColor(...COLORS.text);
  doc.setFont("helvetica", "normal");

  services.forEach((service, i) => {
    if (i % 2 === 0) {
      doc.setFillColor(...COLORS.lightGray);
      doc.rect(margin, y - 2, pageWidth - margin * 2, 8, "F");
    }
    doc.text(service.name, margin + 5, y + 4);
    doc.text(service.price, pageWidth - margin - 5, y + 4, { align: "right" });
    y += 8;
  });

  y += 5;

  // Totals
  const totals = [
    { label: "Sous-total mensuel:", value: "75.00 $" },
    { label: "Équipements (une fois):", value: "110.00 $" },
    { label: "TPS (5%):", value: "9.25 $" },
    { label: "TVQ (9.975%):", value: "18.47 $" },
  ];

  totals.forEach((item) => {
    doc.text(item.label, pageWidth / 2 + 10, y);
    doc.text(item.value, pageWidth - margin - 5, y, { align: "right" });
    y += 6;
  });

  y += 5;

  // Total box
  doc.setFillColor(...COLORS.success);
  doc.roundedRect(pageWidth / 2, y, pageWidth / 2 - margin, 12, 2, 2, "F");

  doc.setTextColor(...COLORS.white);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("TOTAL", pageWidth / 2 + 8, y + 8);
  doc.text("212.72 $", pageWidth - margin - 5, y + 8, { align: "right" });

  // Footer
  const footerY = pageHeight - 15;
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, footerY - 5, pageWidth, 20, "F");

  doc.setTextColor(...COLORS.white);
  doc.setFontSize(7);
  doc.text(`${COMPANY.name} | ${COMPANY.address} | ${COMPANY.phone} | ${COMPANY.email}`, pageWidth / 2, footerY + 6, { align: "center" });

  return doc.output("datauristring").split(",")[1];
}

function buildEmailHtml(templates: string[]): string {
  const templateList = templates.map((t) => `<li style="margin-bottom:6px;">${t}</li>`).join("");

  return `
    <!DOCTYPE html>
    <html lang="fr">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Nivra Telecom - Documents PDF</title>
      </head>
      <body style="margin:0;padding:0;background:#F6F8FB;color:#0F172A;font-family:Arial,Helvetica,sans-serif;">
        <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
          Vos documents PDF Nivra Telecom sont prêts.
        </div>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6F8FB;padding:24px 0;">
          <tr>
            <td align="center">
              <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="width:640px;max-width:92vw;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #E6EBF2;">
                <tr>
                  <td style="background:#0066CC;padding:20px 24px;">
                    <div style="font-size:20px;font-weight:700;color:#ffffff;">Nivra Telecom</div>
                    <div style="font-size:12px;opacity:0.9;color:#ffffff;margin-top:4px;">Documents PDF — Templates officiels</div>
                  </td>
                </tr>

                <tr>
                  <td style="padding:24px;">
                    <h1 style="margin:0 0 12px 0;font-size:18px;color:#0F172A;">Vos documents sont joints</h1>
                    <p style="margin:0 0 16px 0;font-size:14px;line-height:1.6;color:#334155;">
                      Bonjour,<br /><br />
                      Veuillez trouver en pièces jointes les documents PDF suivants :
                    </p>

                    <ul style="margin:0 0 16px 0;padding-left:20px;font-size:14px;color:#334155;line-height:1.8;">
                      ${templateList}
                    </ul>

                    <div style="margin:20px 0;padding:16px;border:1px solid #E6EBF2;border-radius:12px;background:#F8FAFC;">
                      <div style="font-size:12px;color:#64748B;margin-bottom:6px;">Besoin d'aide?</div>
                      <div style="font-size:14px;color:#0F172A;">
                        Répondez à ce courriel ou contactez-nous à
                        <a href="mailto:support@nivra-telecom.ca" style="color:#0066CC;text-decoration:none;font-weight:700;">support@nivra-telecom.ca</a>
                      </div>
                    </div>

                    <p style="margin:0;font-size:13px;color:#64748B;">
                      Cordialement,<br />
                      <strong style="color:#0F172A;">L'équipe Nivra Telecom</strong>
                    </p>
                  </td>
                </tr>

                <tr>
                  <td style="padding:16px 24px;border-top:1px solid #E6EBF2;background:#FBFCFE;">
                    <div style="font-size:11px;color:#64748B;text-align:center;">
                      ${COMPANY.legalName}<br />
                      ${COMPANY.address} | ${COMPANY.phone}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("[send-pdf-templates] Request received");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, templates } = await req.json();

    if (!to) {
      return new Response(
        JSON.stringify({ error: "Missing 'to' email address" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Default: send all templates
    const templatesToSend = templates || ["invoice", "contract", "summary"];

    console.log(`[send-pdf-templates] Generating PDFs for: ${templatesToSend.join(", ")}`);

    const attachments: { filename: string; content: string; contentType: string }[] = [];
    const templateNames: string[] = [];

    if (templatesToSend.includes("invoice")) {
      attachments.push({
        filename: "Facture-V2-Nivra.pdf",
        content: generateInvoiceV2PDF(),
        contentType: "application/pdf",
      });
      templateNames.push("Facture V2 (Invoice Template)");
    }

    if (templatesToSend.includes("contract")) {
      attachments.push({
        filename: "Contrat-Nivra.pdf",
        content: generateContractPDF(),
        contentType: "application/pdf",
      });
      templateNames.push("Contrat de Service (Contract Template)");
    }

    if (templatesToSend.includes("summary")) {
      attachments.push({
        filename: "Sommaire-Commande-Nivra.pdf",
        content: generateSummaryPDF(),
        contentType: "application/pdf",
      });
      templateNames.push("Sommaire de Commande (Order Summary Template)");
    }

    console.log(`[send-pdf-templates] Sending ${attachments.length} PDFs to: ${to}`);

    const emailResponse = await resend.emails.send({
      from: "Nivra Telecom <noreply@nivra-telecom.ca>",
      to: [to],
      subject: `Nivra Telecom — Documents PDF (${attachments.length} fichiers)`,
      replyTo: "support@nivra-telecom.ca",
      html: buildEmailHtml(templateNames),
      attachments,
    });

    console.log("[send-pdf-templates] Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, messageId: emailResponse.id, templatesSent: templateNames }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("[send-pdf-templates] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
