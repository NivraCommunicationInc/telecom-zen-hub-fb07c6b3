import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "../_shared/ResendProxy.ts";
import { jsPDF } from "npm:jspdf@2.5.2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================================================
// NIVRA COMMUNICATIONS INC. â€” Company Info
// ============================================================================
const CO = {
  name: "Nivra Communications Inc.",
  neq: "2291249786",
  tps: "732287291 RT0001",
  tvq: "1229249786 TQ0001",
  address: "Montréal, QC, Canada",
  email: "support@nivra-telecom.ca",
  phone: "(438) 600-1030",
  website: "nivra-telecom.ca",
};

const GST_RATE = 0.05;
const QST_RATE = 0.09975;

// ============================================================================
// SAMPLE DATA
// ============================================================================
const SAMPLE = {
  invoice_number: "INV-2026-00042",
  order_number: "ORD-99904",
  account_number: "NVR-100042",
  contract_number: "CTR-99904",
  date: "2026-03-04",
  due_date: "2026-04-03",
  customer: {
    name: "Jean-François Tremblay",
    email: "jf.tremblay@example.com",
    phone: "(514) 555-1234",
    billing: "4521 Rue Saint-Denis, Montréal, QC H2J 2L4",
    service: "4521 Rue Saint-Denis, Montréal, QC H2J 2L4",
  },
  items: [
    { desc: "Internet Résidentiel â€” Fibre 500", price: 65.00, recurring: true },
    { desc: "Location routeur Nivra Born WiFi", price: 0.00, recurring: true },
    { desc: "Frais d'activation", price: 30.00, recurring: false },
    { desc: "Installation professionnelle", price: 75.00, recurring: false },
  ],
  discount: { label: "Promo BIENVENUE50 â€” 50% premier mois", amount: 32.50 },
};

// ============================================================================
// HELPER: add styled text
// ============================================================================
function addHeader(doc: any, y: number): number {
  // Dark header bar
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 210, 38, "F");
  // Teal accent line
  doc.setFillColor(20, 184, 166);
  doc.rect(0, 38, 210, 2, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("Nivra", 15, 18);
  doc.setTextColor(20, 184, 166);
  doc.text("Telecom", 40, 18);

  doc.setTextColor(200, 200, 210);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(CO.name, 15, 26);
  doc.text(`NEQ: ${CO.neq} | TPS: ${CO.tps} | TVQ: ${CO.tvq}`, 15, 31);
  doc.text(`${CO.email} | ${CO.phone} | ${CO.website}`, 15, 36);

  return 48;
}

function addFooter(doc: any) {
  const pageH = doc.internal.pageSize.getHeight();
  doc.setFillColor(248, 250, 252);
  doc.rect(0, pageH - 18, 210, 18, "F");
  doc.setDrawColor(226, 232, 240);
  doc.line(0, pageH - 18, 210, pageH - 18);
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(7);
  doc.text(`${CO.name} | ${CO.address} | ${CO.email}`, 105, pageH - 11, { align: "center" });
  doc.text("Services prépayés â€” Aucun contrat Ã  durée déterminée", 105, pageH - 6, { align: "center" });
}

function label(doc: any, x: number, y: number, lbl: string, val: string) {
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(lbl, x, y);
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(val, x, y + 5);
}

function sectionTitle(doc: any, y: number, title: string): number {
  doc.setFillColor(248, 250, 252);
  doc.rect(15, y, 180, 8, "F");
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(title, 18, y + 5.5);
  return y + 12;
}

// ============================================================================
// GENERATE INVOICE PDF
// ============================================================================
function generateInvoicePDF(): string {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = addHeader(doc, 0);

  // Title
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("FACTURE", 15, y);

  // Status badge
  doc.setFillColor(20, 184, 166);
  doc.roundedRect(160, y - 6, 35, 8, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("PAYÉE", 177.5, y - 1, { align: "center" });

  y += 10;

  // Metadata grid
  label(doc, 15, y, "NÂ° Facture", SAMPLE.invoice_number);
  label(doc, 65, y, "NÂ° Commande", SAMPLE.order_number);
  label(doc, 115, y, "NÂ° Compte", SAMPLE.account_number);
  label(doc, 160, y, "Date", SAMPLE.date);
  y += 14;
  label(doc, 160, y, "Échéance", SAMPLE.due_date);

  // Customer
  label(doc, 15, y, "Client", SAMPLE.customer.name);
  label(doc, 15, y + 10, "Adresse de facturation", SAMPLE.customer.billing);
  label(doc, 15, y + 20, "Adresse de service", SAMPLE.customer.service);
  label(doc, 115, y, "Courriel", SAMPLE.customer.email);
  label(doc, 115, y + 10, "Téléphone", SAMPLE.customer.phone);

  y += 34;

  // Line items table
  y = sectionTitle(doc, y, "DÉTAIL DES SERVICES ET FRAIS");

  // Table header
  doc.setFillColor(15, 23, 42);
  doc.rect(15, y, 180, 7, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("Description", 18, y + 5);
  doc.text("Type", 130, y + 5);
  doc.text("Montant", 185, y + 5, { align: "right" });
  y += 10;

  let subtotal = 0;
  SAMPLE.items.forEach((item, i) => {
    if (i % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(15, y - 3, 180, 7, "F");
    }
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(item.desc, 18, y + 1.5);

    // Type badge
    const typeLabel = item.recurring ? "Récurrent" : "Unique";
    const badgeColor = item.recurring ? [20, 184, 166] : [99, 102, 241];
    doc.setFillColor(badgeColor[0], badgeColor[1], badgeColor[2]);
    doc.roundedRect(128, y - 2, 22, 5, 1.5, 1.5, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(6.5);
    doc.text(typeLabel, 139, y + 1.5, { align: "center" });

    doc.setTextColor(30, 41, 59);
    doc.setFontSize(9);
    doc.text(`${item.price.toFixed(2)} $`, 185, y + 1.5, { align: "right" });
    subtotal += item.price;
    y += 8;
  });

  y += 4;

  // Totals
  doc.setDrawColor(226, 232, 240);
  doc.line(120, y, 195, y);
  y += 6;

  const fmtLine = (lbl: string, val: string, bold = false) => {
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(lbl, 125, y);
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.text(val, 185, y, { align: "right" });
    y += 6;
  };

  fmtLine("Sous-total", `${subtotal.toFixed(2)} $`);
  fmtLine(`Rabais (${SAMPLE.discount.label})`, `- ${SAMPLE.discount.amount.toFixed(2)} $`);
  const taxable = subtotal - SAMPLE.discount.amount;
  const gst = Math.round(taxable * GST_RATE * 100) / 100;
  const qst = Math.round(taxable * QST_RATE * 100) / 100;
  fmtLine(`TPS (${(GST_RATE * 100).toFixed(3)}%)`, `${gst.toFixed(2)} $`);
  fmtLine(`TVQ (${(QST_RATE * 100).toFixed(3)}%)`, `${qst.toFixed(2)} $`);

  const total = Math.round((taxable + gst + qst) * 100) / 100;
  doc.setFillColor(15, 23, 42);
  doc.roundedRect(120, y - 2, 75, 9, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("TOTAL", 125, y + 4);
  doc.text(`${total.toFixed(2)} $`, 190, y + 4, { align: "right" });
  y += 16;

  // Payment receipt
  y = sectionTitle(doc, y, "REÇU DE PAIEMENT");
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Méthode: Virement Interac`, 18, y + 4);
  doc.text(`Montant: ${total.toFixed(2)} $`, 18, y + 10);
  doc.text(`Date: ${SAMPLE.date}`, 100, y + 4);
  doc.text(`Référence: ETR-20260304-001`, 100, y + 10);

  addFooter(doc);

  return doc.output("datauristring").split(",")[1];
}

// ============================================================================
// GENERATE CONTRACT PDF
// ============================================================================
function generateContractPDF(): string {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = addHeader(doc, 0);

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("CONTRAT DE SERVICE", 15, y);
  y += 12;

  // Contract metadata
  label(doc, 15, y, "NÂ° Contrat", SAMPLE.contract_number);
  label(doc, 65, y, "Date d'entrée en vigueur", SAMPLE.date);
  label(doc, 130, y, "Version des modalités", "v2026-02-05");
  y += 14;

  // Parties
  y = sectionTitle(doc, y, "PARTIES AU CONTRAT");
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Fournisseur:", 18, y + 4);
  doc.setFont("helvetica", "normal");
  doc.text(`${CO.name} (NEQ: ${CO.neq})`, 50, y + 4);
  doc.text(`${CO.address} | ${CO.email} | ${CO.phone}`, 50, y + 10);

  doc.setFont("helvetica", "bold");
  doc.text("Client:", 18, y + 20);
  doc.setFont("helvetica", "normal");
  doc.text(SAMPLE.customer.name, 50, y + 20);
  doc.text(SAMPLE.customer.billing, 50, y + 26);
  doc.text(`${SAMPLE.customer.email} | ${SAMPLE.customer.phone}`, 50, y + 32);
  y += 42;

  // Account info
  label(doc, 18, y, "NÂ° Compte", SAMPLE.account_number);
  label(doc, 80, y, "NÂ° Commande", SAMPLE.order_number);
  y += 14;

  // Services
  y = sectionTitle(doc, y, "SERVICES SOUSCRITS");
  doc.setFillColor(15, 23, 42);
  doc.rect(15, y, 180, 7, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("Service", 18, y + 5);
  doc.text("Prix mensuel", 185, y + 5, { align: "right" });
  y += 10;

  doc.setTextColor(30, 41, 59);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Internet Résidentiel â€” Fibre 500", 18, y + 2);
  doc.text("65,00 $ / mois", 185, y + 2, { align: "right" });
  y += 8;
  doc.text("Location routeur Nivra Born WiFi", 18, y + 2);
  doc.text("Inclus", 185, y + 2, { align: "right" });
  y += 14;

  // Addresses
  y = sectionTitle(doc, y, "ADRESSES");
  label(doc, 18, y, "Adresse de facturation", SAMPLE.customer.billing);
  label(doc, 18, y + 10, "Adresse de service", SAMPLE.customer.service);
  y += 24;

  // Financial summary
  y = sectionTitle(doc, y, "SOMMAIRE FINANCIER");
  const fmtLine2 = (lbl: string, val: string) => {
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(9);
    doc.text(lbl, 18, y + 2);
    doc.setTextColor(15, 23, 42);
    doc.text(val, 185, y + 2, { align: "right" });
    y += 7;
  };
  fmtLine2("Mensuel récurrent", "65,00 $");
  fmtLine2("Frais uniques", "105,00 $");
  fmtLine2("Rabais appliqué", "- 32,50 $");
  fmtLine2("TPS + TVQ", "20,53 $");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  fmtLine2("Total dû aujourd'hui", "158,03 $");
  y += 8;

  // Terms clause
  y = sectionTitle(doc, y, "CONDITIONS");
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  const terms = [
    "â€¢ Ce contrat est régi par les Modalités de service Nivra Telecom (version v2026-02-05).",
    "â€¢ Services prépayés â€” Aucun engagement Ã  durée déterminée.",
    "â€¢ Le client peut résilier Ã  tout moment en contactant le support.",
    "â€¢ Les prix indiqués n'incluent pas les taxes applicables sauf mention contraire.",
    "â€¢ Nivra se réserve le droit de modifier ses tarifs avec un préavis de 30 jours.",
  ];
  terms.forEach(t => {
    doc.text(t, 18, y + 2);
    y += 5;
  });

  addFooter(doc);
  return doc.output("datauristring").split(",")[1];
}

// ============================================================================
// GENERATE SERVICE TERMS PDF
// ============================================================================
function generateTermsPDF(): string {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = addHeader(doc, 0);

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("MODALITÉS DE SERVICE", 15, y);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text("Version v2026-02-05 â€” En vigueur Ã  compter du 5 février 2026", 15, y + 8);
  y += 18;

  const sections = [
    { title: "1. DÉFINITIONS ET PORTÉE", content: "Les présentes modalités régissent l'ensemble des services de télécommunications fournis par Nivra Communications Inc. (Â« Nivra Â») au client. En utilisant nos services, le client accepte les présentes conditions dans leur intégralité." },
    { title: "2. SERVICES OFFERTS", content: "Nivra offre des services de téléphonie mobile prépayée, d'Internet résidentiel, de télévision et de sécurité selon la disponibilité Ã  l'adresse du client. Tous les services sont fournis sur une base prépayée, sans contrat Ã  durée déterminée." },
    { title: "3. INSCRIPTION ET ACTIVATION", content: "Le client doit fournir des informations exactes lors de l'inscription. L'activation des services est conditionnelle Ã  la vérification de l'identité et au paiement complet des frais applicables." },
    { title: "4. TARIFICATION ET PAIEMENT", content: "Tous les prix sont en dollars canadiens. Les taxes (TPS et TVQ) s'appliquent conformément Ã  la législation en vigueur. Le paiement est exigé avant l'activation des services." },
    { title: "5. UTILISATION ACCEPTABLE", content: "Le client s'engage Ã  utiliser les services conformément aux lois applicables et aux politiques d'utilisation acceptable de Nivra. Toute utilisation abusive, frauduleuse ou illégale peut entraîner la suspension ou la résiliation des services." },
    { title: "6. PROTECTION DES RENSEIGNEMENTS", content: "Nivra s'engage Ã  protéger les renseignements personnels du client conformément Ã  la Loi sur la protection des renseignements personnels et les documents électroniques (LPRPDE) et Ã  la Loi 25 du Québec." },
    { title: "7. SUSPENSION ET RÉSILIATION", content: "Le client peut résilier ses services Ã  tout moment. Nivra peut suspendre les services en cas de non-paiement ou de violation des présentes modalités, avec un préavis raisonnable." },
    { title: "8. LIMITATION DE RESPONSABILITÉ", content: "La responsabilité de Nivra est limitée au montant des frais payés par le client pour la période de service concernée. Nivra n'est pas responsable des dommages indirects." },
    { title: "9. MODIFICATIONS", content: "Nivra se réserve le droit de modifier les présentes modalités avec un préavis de 30 jours. Le client sera informé par courriel ou via son espace client." },
    { title: "10. DROIT APPLICABLE", content: "Les présentes modalités sont régies par les lois de la province de Québec et les lois fédérales du Canada applicables." },
  ];

  sections.forEach(s => {
    if (y > 260) {
      addFooter(doc);
      doc.addPage();
      y = addHeader(doc, 0);
    }
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(s.title, 15, y);
    y += 6;
    doc.setTextColor(51, 65, 85);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(s.content, 175);
    doc.text(lines, 15, y);
    y += lines.length * 4.5 + 6;
  });

  // Contact
  y += 4;
  doc.setFillColor(240, 253, 250);
  doc.roundedRect(15, y, 180, 20, 3, 3, "F");
  doc.setTextColor(15, 118, 110);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Pour toute question concernant ces modalités :", 20, y + 7);
  doc.setFont("helvetica", "normal");
  doc.text(`${CO.email} | ${CO.phone} | ${CO.website}`, 20, y + 14);

  addFooter(doc);
  return doc.output("datauristring").split(",")[1];
}

// ============================================================================
// HANDLER
// ============================================================================
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to } = await req.json();
    if (!to) throw new Error("Email 'to' is required");

    console.log(`[send-sample-documents] Generating 3 PDFs for: ${to}`);

    const invoiceB64 = generateInvoicePDF();
    const contractB64 = generateContractPDF();
    const termsB64 = generateTermsPDF();

    console.log("[send-sample-documents] PDFs generated, sending email...");

    const emailRes = await resend.emails.send({
      from: "Nivra Telecom <noreply@nivra-telecom.ca>",
      to: [to],
      reply_to: "support@nivra-telecom.ca",
      subject: "Documents Nivra Telecom â€” Facture, Contrat & Modalités (V3 Sample)",
      headers: {
        "X-Entity-Ref-ID": `sample-docs-${Date.now()}`,
        "Precedence": "bulk",
      },
      html: `
<!DOCTYPE html>
<html lang="fr">
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8fafc;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
<tr><td style="background:linear-gradient(135deg,#0F172A,#1E293B);padding:32px 40px;text-align:center;">
<h1 style="margin:0;color:#fff;font-size:28px;font-weight:700;">Nivra<span style="color:#14B8A6;">Telecom</span></h1>
<p style="margin:8px 0 0;color:#94A3B8;font-size:14px;">Documents de service â€” Version V3</p>
</td></tr>
<tr><td style="padding:40px;">
<h2 style="margin:0 0 16px;color:#0F172A;font-size:20px;">Vos documents sont joints</h2>
<p style="color:#334155;font-size:16px;line-height:1.7;">
Veuillez trouver ci-joints les 3 documents générés par le nouveau système V3 :</p>
<ul style="color:#334155;font-size:15px;line-height:2;">
<li><strong>Facture</strong> â€” Nivra_Facture_INV-2026-00042.pdf</li>
<li><strong>Contrat de service</strong> â€” Nivra_Contrat_CTR-99904.pdf</li>
<li><strong>Modalités de service</strong> â€” Nivra_Modalites_v2026-02-05.pdf</li>
</ul>
<p style="color:#64748B;font-size:14px;margin-top:24px;">Ces documents utilisent le format TELUS-grade avec données d'exemple.</p>
</td></tr>
<tr><td style="background:#F8FAFC;padding:20px 40px;border-top:1px solid #E2E8F0;text-align:center;">
<p style="margin:0;color:#64748B;font-size:12px;">Nivra Communications Inc. | Montréal, QC | support@nivra-telecom.ca</p>
</td></tr>
</table>
</td></tr></table>
</body></html>`,
      attachments: [
        { filename: "Nivra_Facture_INV-2026-00042.pdf", content: invoiceB64 },
        { filename: "Nivra_Contrat_CTR-99904.pdf", content: contractB64 },
        { filename: "Nivra_Modalites_v2026-02-05.pdf", content: termsB64 },
      ],
    });

    console.log("[send-sample-documents] Email sent:", emailRes);

    return new Response(JSON.stringify({ success: true, emailId: emailRes.id }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error) {
    console.error("[send-sample-documents] Error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
