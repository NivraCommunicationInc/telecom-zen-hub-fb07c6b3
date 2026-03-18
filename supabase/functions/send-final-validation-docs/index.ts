import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { jsPDF } from "npm:jspdf@2.5.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================================================
// REAL TRANSACTION DATA — Order #80876 / Invoice #8548553
// ============================================================================
const CO = {
  name: "Nivra Communications Inc.",
  neq: "2291249786",
  tps: "732287291 RT0001",
  tvq: "1229249786 TQ0001",
  address: "1799 Av. Pierre-Péladeau, Laval, QC H7T 2Y5",
  email: "Support@nivra-telecom.ca",
  website: "www.nivra-telecom.ca",
  division: "Service à la clientèle — Division facturation",
  tagline: "Fournisseur de services de télécommunications — Province de Québec",
};

const CLIENT = {
  name: "Camerhy Junior",
  firstName: "Camerhy",
  lastName: "Junior",
  email: "lavaud.oldo9902@icloud.com",
  phone: "(438) 792-3288",
  billingAddress: "1477 rue des rossignols, Saint Jerome, QC J7Z6Z3",
  serviceAddress: "1477 rue des rossignols, Saint Jerome, QC J7Z6Z3",
};

const ACCOUNT_NUMBER = "200700";
const ORDER_NUMBER = "80876";
const INVOICE_NUMBER = "8548553";
const ORDER_DATE = "2026-03-18";
const DUE_DATE = "2026-03-18";
const PAYMENT_NUMBER = "5174657336";
const PAYMENT_METHOD = "Carte de crédit (Stripe)";

const LINES = [
  { desc: "GIGA + TV 25 choix", amount: 100.00, type: "service" },
  { desc: "Mobile 75GB 4G Unlimited Canada", amount: 60.00, type: "service" },
  { desc: "Spotify Premium", amount: 10.99, type: "service" },
  { desc: "Nivra Born Wifi Router", amount: 60.00, type: "equipment" },
  { desc: "Nivra 4K Smart Terminal", amount: 50.00, type: "equipment" },
  { desc: "Nivra Physical SIM", amount: 25.00, type: "equipment" },
  { desc: "Frais d'activation", amount: 25.00, type: "fee" },
  { desc: "Installation professionnelle", amount: 50.00, type: "fee" },
  { desc: "Rabais EQUIP26 (100% services)", amount: -185.00, type: "discount" },
  { desc: "Ajustement taxable de réconciliation", amount: 20.00, type: "fee" },
];

const SUBTOTAL = 215.99;
const TPS = 10.80;
const TVQ = 21.55;
const TOTAL = 248.34;

// ============================================================================
// PDF HELPERS
// ============================================================================
function addHeader(doc: any): number {
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 210, 40, "F");
  doc.setFillColor(20, 184, 166);
  doc.rect(0, 40, 210, 2, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("Nivra", 15, 18);
  doc.setTextColor(20, 184, 166);
  doc.text("Telecom", 40, 18);

  doc.setTextColor(200, 200, 210);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.text(CO.name, 15, 26);
  doc.text(CO.division, 15, 30);
  doc.text(`NEQ: ${CO.neq}  |  TPS: ${CO.tps}  |  TVQ: ${CO.tvq}`, 15, 34);
  doc.text(`${CO.email}  |  ${CO.website}`, 15, 38);

  return 50;
}

function addFooter(doc: any) {
  const h = doc.internal.pageSize.getHeight();
  doc.setFillColor(248, 250, 252);
  doc.rect(0, h - 20, 210, 20, "F");
  doc.setDrawColor(226, 232, 240);
  doc.line(0, h - 20, 210, h - 20);
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(7);
  doc.text(CO.name + "  |  " + CO.address, 105, h - 13, { align: "center" });
  doc.text(CO.tagline, 105, h - 8, { align: "center" });
  doc.text(`${CO.email}  |  ${CO.website}`, 105, h - 4, { align: "center" });
}

function labelVal(doc: any, x: number, y: number, lbl: string, val: string) {
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(7.5);
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

function fmtCAD(n: number): string {
  return new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(n);
}

function typeLabel(t: string): string {
  switch (t) {
    case "service": return "Récurrent";
    case "equipment": return "Équipement";
    case "fee": return "Unique";
    case "discount": return "Rabais";
    default: return t;
  }
}

function typeColor(t: string): [number, number, number] {
  switch (t) {
    case "service": return [20, 184, 166];
    case "equipment": return [99, 102, 241];
    case "fee": return [245, 158, 11];
    case "discount": return [239, 68, 68];
    default: return [100, 116, 139];
  }
}

// ============================================================================
// INVOICE PDF
// ============================================================================
function generateInvoicePDF(): string {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = addHeader(doc);

  // Title + status badge
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("FACTURE", 15, y);

  doc.setFillColor(22, 163, 74);
  doc.roundedRect(160, y - 6, 35, 8, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.text("PAYÉE", 177.5, y - 1, { align: "center" });
  y += 10;

  // Metadata
  labelVal(doc, 15, y, "N° Facture", INVOICE_NUMBER);
  labelVal(doc, 55, y, "N° Commande", ORDER_NUMBER);
  labelVal(doc, 95, y, "N° Compte", ACCOUNT_NUMBER);
  labelVal(doc, 140, y, "Date", ORDER_DATE);
  labelVal(doc, 175, y, "Échéance", DUE_DATE);
  y += 14;

  // Client info
  labelVal(doc, 15, y, "Client", CLIENT.name);
  labelVal(doc, 95, y, "Courriel", CLIENT.email);
  y += 10;
  labelVal(doc, 15, y, "Adresse de facturation", CLIENT.billingAddress);
  labelVal(doc, 95, y, "Téléphone", CLIENT.phone);
  y += 10;
  labelVal(doc, 15, y, "Adresse de service", CLIENT.serviceAddress);
  y += 14;

  // Line items
  y = sectionTitle(doc, y, "DÉTAIL DES SERVICES ET FRAIS");

  // Table header
  doc.setFillColor(15, 23, 42);
  doc.rect(15, y, 180, 7, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("Description", 18, y + 5);
  doc.text("Type", 128, y + 5);
  doc.text("Montant", 192, y + 5, { align: "right" });
  y += 10;

  LINES.forEach((line, i) => {
    if (i % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(15, y - 3, 180, 7, "F");
    }
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.text(line.desc, 18, y + 1.5);

    // Type badge
    const [r, g, b] = typeColor(line.type);
    doc.setFillColor(r, g, b);
    doc.roundedRect(126, y - 2, 24, 5, 1.5, 1.5, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(6);
    doc.text(typeLabel(line.type), 138, y + 1.5, { align: "center" });

    doc.setTextColor(line.type === "discount" ? 239 : 30, line.type === "discount" ? 68 : 41, line.type === "discount" ? 68 : 59);
    doc.setFontSize(8.5);
    doc.text(fmtCAD(line.amount), 192, y + 1.5, { align: "right" });
    y += 7;
  });

  y += 6;

  // Totals
  doc.setDrawColor(226, 232, 240);
  doc.line(120, y, 195, y);
  y += 6;

  const totalLine = (lbl: string, val: string, bold = false) => {
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(lbl, 125, y);
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.text(val, 192, y, { align: "right" });
    y += 6;
  };

  totalLine("Sous-total", fmtCAD(SUBTOTAL));
  totalLine("TPS (5,000 %)", fmtCAD(TPS));
  totalLine("TVQ (9,975 %)", fmtCAD(TVQ));

  y += 2;
  doc.setFillColor(15, 23, 42);
  doc.roundedRect(120, y - 2, 75, 10, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("TOTAL", 125, y + 5);
  doc.text(fmtCAD(TOTAL), 190, y + 5, { align: "right" });
  y += 18;

  // Payment receipt
  y = sectionTitle(doc, y, "REÇU DE PAIEMENT");
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Méthode: ${PAYMENT_METHOD}`, 18, y + 4);
  doc.text(`Montant: ${fmtCAD(TOTAL)}`, 18, y + 10);
  doc.text(`Date: ${ORDER_DATE}`, 110, y + 4);
  doc.text(`N° Paiement: ${PAYMENT_NUMBER}`, 110, y + 10);

  addFooter(doc);
  return doc.output("datauristring").split(",")[1];
}

// ============================================================================
// CONTRACT PDF
// ============================================================================
function generateContractPDF(): string {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = addHeader(doc);

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("CONTRAT DE SERVICE", 15, y);
  y += 12;

  labelVal(doc, 15, y, "N° Contrat", `CTR-${ORDER_NUMBER}`);
  labelVal(doc, 65, y, "N° Commande", ORDER_NUMBER);
  labelVal(doc, 115, y, "N° Compte", ACCOUNT_NUMBER);
  labelVal(doc, 165, y, "Date", ORDER_DATE);
  y += 14;

  // Parties
  y = sectionTitle(doc, y, "PARTIES AU CONTRAT");
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Fournisseur:", 18, y + 4);
  doc.setFont("helvetica", "normal");
  doc.text(`${CO.name} (NEQ: ${CO.neq})`, 50, y + 4);
  doc.text(CO.address, 50, y + 10);

  doc.setFont("helvetica", "bold");
  doc.text("Client:", 18, y + 20);
  doc.setFont("helvetica", "normal");
  doc.text(CLIENT.name, 50, y + 20);
  doc.text(CLIENT.billingAddress, 50, y + 26);
  doc.text(`${CLIENT.email}  |  ${CLIENT.phone}`, 50, y + 32);
  y += 42;

  // Services
  y = sectionTitle(doc, y, "SERVICES SOUSCRITS");
  doc.setFillColor(15, 23, 42);
  doc.rect(15, y, 180, 7, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("Service / Article", 18, y + 5);
  doc.text("Type", 128, y + 5);
  doc.text("Montant", 192, y + 5, { align: "right" });
  y += 10;

  LINES.forEach((line, i) => {
    if (i % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(15, y - 3, 180, 7, "F");
    }
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.text(line.desc, 18, y + 1.5);

    const [r, g, b] = typeColor(line.type);
    doc.setFillColor(r, g, b);
    doc.roundedRect(126, y - 2, 24, 5, 1.5, 1.5, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(6);
    doc.text(typeLabel(line.type), 138, y + 1.5, { align: "center" });

    doc.setTextColor(line.type === "discount" ? 239 : 30, line.type === "discount" ? 68 : 41, line.type === "discount" ? 68 : 59);
    doc.setFontSize(8.5);
    doc.text(fmtCAD(line.amount), 192, y + 1.5, { align: "right" });
    y += 7;
  });

  y += 6;

  // Financial summary
  y = sectionTitle(doc, y, "SOMMAIRE FINANCIER");
  const fLine = (lbl: string, val: string) => {
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(9);
    doc.text(lbl, 18, y + 2);
    doc.setTextColor(15, 23, 42);
    doc.text(val, 192, y + 2, { align: "right" });
    y += 7;
  };
  fLine("Sous-total", fmtCAD(SUBTOTAL));
  fLine("TPS (5,000 %)", fmtCAD(TPS));
  fLine("TVQ (9,975 %)", fmtCAD(TVQ));
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  fLine("Total", fmtCAD(TOTAL));
  y += 6;

  // Terms
  y = sectionTitle(doc, y, "CONDITIONS GÉNÉRALES");
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  const terms = [
    "• Services prépayés — Aucun engagement à durée déterminée.",
    "• Le client peut résilier à tout moment en contactant le support.",
    "• Les prix n'incluent pas les taxes applicables sauf mention contraire.",
    "• Nivra se réserve le droit de modifier ses tarifs avec un préavis de 30 jours.",
    "• Ce contrat est régi par les lois de la province de Québec.",
  ];
  terms.forEach(t => {
    doc.text(t, 18, y + 2);
    y += 5;
  });

  addFooter(doc);
  return doc.output("datauristring").split(",")[1];
}

// ============================================================================
// ORDER SUMMARY PDF
// ============================================================================
function generateOrderSummaryPDF(): string {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = addHeader(doc);

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("SOMMAIRE DE COMMANDE", 15, y);

  doc.setFillColor(22, 163, 74);
  doc.roundedRect(155, y - 6, 40, 8, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.text("CONFIRMÉE", 175, y - 1, { align: "center" });
  y += 10;

  // Metadata
  labelVal(doc, 15, y, "N° Commande", ORDER_NUMBER);
  labelVal(doc, 65, y, "N° Facture", INVOICE_NUMBER);
  labelVal(doc, 115, y, "N° Compte", ACCOUNT_NUMBER);
  labelVal(doc, 165, y, "Date", ORDER_DATE);
  y += 14;

  // Client
  labelVal(doc, 15, y, "Client", CLIENT.name);
  labelVal(doc, 95, y, "Courriel", CLIENT.email);
  y += 10;
  labelVal(doc, 15, y, "Téléphone", CLIENT.phone);
  labelVal(doc, 95, y, "Adresse de service", CLIENT.serviceAddress);
  y += 14;

  // Line items
  y = sectionTitle(doc, y, "ARTICLES ET SERVICES COMMANDÉS");
  doc.setFillColor(15, 23, 42);
  doc.rect(15, y, 180, 7, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("Description", 18, y + 5);
  doc.text("Type", 128, y + 5);
  doc.text("Montant", 192, y + 5, { align: "right" });
  y += 10;

  LINES.forEach((line, i) => {
    if (i % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(15, y - 3, 180, 7, "F");
    }
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.text(line.desc, 18, y + 1.5);

    const [r, g, b] = typeColor(line.type);
    doc.setFillColor(r, g, b);
    doc.roundedRect(126, y - 2, 24, 5, 1.5, 1.5, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(6);
    doc.text(typeLabel(line.type), 138, y + 1.5, { align: "center" });

    doc.setTextColor(line.type === "discount" ? 239 : 30, line.type === "discount" ? 68 : 41, line.type === "discount" ? 68 : 59);
    doc.setFontSize(8.5);
    doc.text(fmtCAD(line.amount), 192, y + 1.5, { align: "right" });
    y += 7;
  });

  y += 6;

  // Totals
  doc.setDrawColor(226, 232, 240);
  doc.line(120, y, 195, y);
  y += 6;

  const totalLine = (lbl: string, val: string) => {
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(lbl, 125, y);
    doc.setTextColor(15, 23, 42);
    doc.text(val, 192, y, { align: "right" });
    y += 6;
  };

  totalLine("Sous-total", fmtCAD(SUBTOTAL));
  totalLine("TPS (5,000 %)", fmtCAD(TPS));
  totalLine("TVQ (9,975 %)", fmtCAD(TVQ));

  y += 2;
  doc.setFillColor(15, 23, 42);
  doc.roundedRect(120, y - 2, 75, 10, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("TOTAL", 125, y + 5);
  doc.text(fmtCAD(TOTAL), 190, y + 5, { align: "right" });
  y += 18;

  // Payment info
  y = sectionTitle(doc, y, "PAIEMENT");
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Méthode: ${PAYMENT_METHOD}`, 18, y + 4);
  doc.text(`Montant: ${fmtCAD(TOTAL)}`, 18, y + 10);
  doc.text(`Statut: Confirmé`, 110, y + 4);
  doc.text(`N° Paiement: ${PAYMENT_NUMBER}`, 110, y + 10);

  addFooter(doc);
  return doc.output("datauristring").split(",")[1];
}

// ============================================================================
// EMAIL HTML WRAPPER
// ============================================================================
function emailHtml(docType: string, clientName: string, orderNum: string): string {
  const portalUrl = "https://nivra-telecom.ca/portal";
  
  const typeLabel = docType === "invoice" ? "Facture" : docType === "contract" ? "Contrat de service" : "Sommaire de commande";
  const typeDesc = docType === "invoice" 
    ? `Votre facture #${INVOICE_NUMBER} pour la commande #${orderNum} est jointe à ce courriel.`
    : docType === "contract" 
    ? `Votre contrat de service pour la commande #${orderNum} est joint à ce courriel.`
    : `Le sommaire de votre commande #${orderNum} est joint à ce courriel.`;

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f1f5f9;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
  <tr><td style="background:linear-gradient(135deg,#0c1929,#1e3a5f);padding:32px 40px;text-align:center;">
    <h1 style="margin:0;font-size:32px;font-weight:800;letter-spacing:-0.03em;">
      <span style="color:#fff;">Nivra</span>
    </h1>
    <p style="margin:4px 0 0;font-size:11px;font-weight:600;letter-spacing:3px;text-transform:uppercase;color:#22d3ee;">Télécommunications</p>
  </td></tr>
  <tr><td style="padding:40px 40px 24px;">
    <h2 style="color:#0f172a;font-size:20px;margin:0 0 8px;">${typeLabel}</h2>
    <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 24px;">
      Bonjour ${clientName},<br><br>
      ${typeDesc}<br><br>
      Vous pouvez consulter ce document en pièce jointe ou accéder à votre espace client pour tous vos documents.
    </p>
    <table cellpadding="0" cellspacing="0"><tr><td style="background:linear-gradient(135deg,#0ea5e9,#0284c7);border-radius:10px;padding:14px 32px;">
      <a href="${portalUrl}" style="color:#fff;text-decoration:none;font-size:15px;font-weight:600;">Accéder à mon espace client</a>
    </td></tr></table>
  </td></tr>
  <tr><td style="padding:0 40px 32px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:12px;padding:20px;">
      <tr>
        <td style="color:#64748b;font-size:13px;">Commande</td>
        <td style="color:#0f172a;font-size:13px;font-weight:600;text-align:right;">#${orderNum}</td>
      </tr>
      <tr>
        <td style="color:#64748b;font-size:13px;padding-top:8px;">Compte</td>
        <td style="color:#0f172a;font-size:13px;font-weight:600;text-align:right;padding-top:8px;">${ACCOUNT_NUMBER}</td>
      </tr>
      <tr>
        <td style="color:#64748b;font-size:13px;padding-top:8px;">Total</td>
        <td style="color:#0f172a;font-size:13px;font-weight:600;text-align:right;padding-top:8px;">${fmtCAD(TOTAL)}</td>
      </tr>
    </table>
  </td></tr>
  <tr><td style="background:#f8fafc;padding:24px 40px;border-top:1px solid #e2e8f0;text-align:center;">
    <p style="color:#94a3b8;font-size:12px;margin:0;">
      ${CO.name}<br>
      ${CO.address}<br>
      ${CO.email}  |  ${CO.website}
    </p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
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
    if (!to) throw new Error("'to' email required");

    const RESEND_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_KEY) throw new Error("RESEND_API_KEY not configured");

    console.log(`[final-validation] Generating 3 real PDFs for: ${to}`);

    const invoiceB64 = generateInvoicePDF();
    const contractB64 = generateContractPDF();
    const summaryB64 = generateOrderSummaryPDF();

    console.log("[final-validation] PDFs generated. Sending 3 separate emails...");

    const sendEmail = async (subject: string, html: string, filename: string, b64: string) => {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_KEY}`,
        },
        body: JSON.stringify({
          from: "Nivra Telecom <Support@nivra-telecom.ca>",
          to: [to],
          reply_to: "Support@nivra-telecom.ca",
          subject,
          html,
          attachments: [{ filename, content: b64 }],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(`Resend error: ${JSON.stringify(data)}`);
      return data;
    };

    // Send 3 separate emails
    const [r1, r2, r3] = await Promise.all([
      sendEmail(
        `Facture #${INVOICE_NUMBER} — Commande #${ORDER_NUMBER} | Nivra Telecom`,
        emailHtml("invoice", CLIENT.firstName, ORDER_NUMBER),
        `Facture_${INVOICE_NUMBER}_Nivra.pdf`,
        invoiceB64
      ),
      sendEmail(
        `Contrat de service — Commande #${ORDER_NUMBER} | Nivra Telecom`,
        emailHtml("contract", CLIENT.firstName, ORDER_NUMBER),
        `Contrat_CTR-${ORDER_NUMBER}_Nivra.pdf`,
        contractB64
      ),
      sendEmail(
        `Sommaire de commande #${ORDER_NUMBER} | Nivra Telecom`,
        emailHtml("summary", CLIENT.firstName, ORDER_NUMBER),
        `Sommaire_${ORDER_NUMBER}_Nivra.pdf`,
        summaryB64
      ),
    ]);

    console.log("[final-validation] All 3 emails sent:", JSON.stringify({ r1, r2, r3 }));

    return new Response(JSON.stringify({
      success: true,
      emails: {
        invoice: r1,
        contract: r2,
        summary: r3,
      },
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err: any) {
    console.error("[final-validation] Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
