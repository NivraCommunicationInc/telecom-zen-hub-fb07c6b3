import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import jsPDF from "npm:jspdf@2.5.2";
import { sendResendEmail } from "../_shared/resendGateway.ts";


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ═══════════════════════════════════════════════════════════════
// COMPANY CONSTANTS
// ═══════════════════════════════════════════════════════════════
const NIVRA = {
  legalName: "NIVRA COMMUNICATIONS INC.",
  neq: "2291249786",
  tps: "TPS : 732287291 RT0001",
  tvq: "TVQ : 1229249786 TQ0001",
  email: "Support@nivra-telecom.ca",
  website: "www.nivra-telecom.ca",
  address: "1799 Av. Pierre-Péladeau, Laval, QC H7T 2Y5",
  division: "Service à la clientèle — Division facturation",
  tagline: "Fournisseur de services de télécommunications — Province de Québec",
};

// Colors
const NAVY: [number, number, number] = [15, 23, 42];
const TEAL: [number, number, number] = [20, 184, 166];
const BLUE: [number, number, number] = [0, 102, 204];
const WHITE: [number, number, number] = [255, 255, 255];
const LIGHT_BG: [number, number, number] = [248, 250, 252];
const TEXT: [number, number, number] = [30, 41, 59];
const TEXT_MUTED: [number, number, number] = [100, 116, 139];
const SUCCESS: [number, number, number] = [22, 163, 74];
const BORDER: [number, number, number] = [226, 232, 240];

const fmt = (amount: number): string =>
  new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD", minimumFractionDigits: 2 }).format(amount || 0);

const fmtDate = (dateStr: string | null): string => {
  if (!dateStr) return "";
  try { return new Date(dateStr).toLocaleDateString("fr-CA", { year: "numeric", month: "long", day: "numeric" }); }
  catch { return dateStr; }
};

const fmtShortDate = (dateStr: string | null): string => {
  if (!dateStr) return "";
  try { return new Date(dateStr).toLocaleDateString("fr-CA", { year: "numeric", month: "2-digit", day: "2-digit" }); }
  catch { return dateStr; }
};

// ═══════════════════════════════════════════════════════════════
// REAL ORDER DATA — Order #80876
// ═══════════════════════════════════════════════════════════════
const ORDER = {
  order_number: "80876",
  order_date: "2026-03-18T03:10:32.928Z",
  status: "confirmed",
  total_amount: 248.34,
};

const CLIENT = {
  first_name: "Camerhy",
  last_name: "Junior",
  full_name: "Camerhy Junior",
  email: "lavaud.oldo9902@icloud.com",
  phone: "(438) 792-3288",
};

const ACCOUNT = {
  account_number: "200700",
  service_address: "1477 rue des Rossignols",
  service_city: "Saint-Jérôme",
  service_province: "QC",
  service_postal_code: "J7Z 6Z3",
  full_service_address: "1477 rue des Rossignols, Saint-Jérôme, QC J7Z 6Z3",
};

const INVOICE = {
  invoice_number: "8548553",
  invoice_date: "2026-03-18",
  due_date: "2026-03-18",
  cycle_start: "2026-03-18",
  cycle_end: "2026-04-17",
  subtotal: 215.99,
  tps: 10.80,
  tvq: 21.55,
  total: 248.34,
  status: "paid",
  paid_at: "2026-03-18T03:10:32.928Z",
  payment_method: "card",
  balance_due: 0,
};

const PAYMENT = {
  payment_number: "5174657336",
  amount: 248.34,
  method: "card",
  status: "confirmed",
  received_at: "2026-03-18T03:10:32.928Z",
  provider: "PayPal",
};

// Invoice lines — EXCLUDING internal "Ajustement taxable de réconciliation"
const RECURRING_SERVICES = [
  { description: "GIGA + TV 25 choix", unit_price: 100.00, total: 100.00 },
  { description: "Mobile 75GB 4G Unlimited Canada", unit_price: 60.00, total: 60.00 },
  { description: "Spotify Premium", unit_price: 10.99, total: 10.99 },
];

const EQUIPMENT = [
  { description: "Nivra Born Wifi Router", unit_price: 60.00, total: 60.00 },
  { description: "Nivra 4K Smart Terminal", unit_price: 50.00, total: 50.00 },
  { description: "Nivra Physical SIM", unit_price: 25.00, total: 25.00 },
];

const FEES = [
  { description: "Frais d'activation", amount: 25.00 },
  { description: "Installation professionnelle", amount: 50.00 },
];

const DISCOUNT = {
  code: "EQUIP26",
  label: "Rabais EQUIP26 (100% équipement)",
  amount: 185.00,
};

// ═══════════════════════════════════════════════════════════════
// SHARED HEADER/FOOTER COMPONENTS
// ═══════════════════════════════════════════════════════════════

function drawInvoiceHeader(doc: any, pw: number) {
  // Navy bar
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pw, 32, "F");
  // Teal accent
  doc.setFillColor(...TEAL);
  doc.rect(0, 32, pw, 2, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...WHITE);
  doc.text(NIVRA.legalName, 15, 12);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(180, 190, 210);
  doc.text(NIVRA.division, 15, 18);
  doc.text(NIVRA.tagline, 15, 23);
  doc.text(`${NIVRA.address} | ${NIVRA.email}`, 15, 28);

  // Document type
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...TEAL);
  doc.text("FACTURE", pw - 15, 14, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(160, 170, 190);
  doc.text(`NEQ: ${NIVRA.neq} | ${NIVRA.tps} | ${NIVRA.tvq}`, pw - 15, 22, { align: "right" });
}

function drawInvoiceFooter(doc: any, pw: number, ph: number, pageNum: number, totalPages: number) {
  const footerH = 36;
  const footerY = ph - footerH;
  doc.setFillColor(...NAVY);
  doc.rect(0, footerY, pw, footerH, "F");
  doc.setFillColor(...TEAL);
  doc.rect(0, footerY, pw, 1.5, "F");

  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.text("POLITIQUE DE FACTURATION PRÉPAYÉE", 15, footerY + 6);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(5);
  const lines = [
    "Le cycle de facturation commence à la date de confirmation du paiement. Les services sont facturés à l'avance sur base mensuelle.",
    "Le paiement doit être confirmé AVANT la date de cycle (J0). Si non payé à J0, le service expire (non renouvelé).",
    "Aucun intérêt ni frais de réactivation pour non-renouvellement normal. Après 90 jours, le numéro peut devenir irrécupérable.",
    "Intérêt (5%/mois) + 15$ frais de réactivation s'appliquent UNIQUEMENT pour litiges bancaires/rétrofacturations.",
    "Garantie équipement: 12 mois fabricant dès activation. Perte/vol/dommages client exclus sauf approbation interne.",
  ];
  let ly = footerY + 11;
  lines.forEach(l => { doc.text(l, 15, ly); ly += 3; });

  doc.setFontSize(6.5);
  doc.text(`${NIVRA.legalName} — Page ${pageNum}/${totalPages}`, pw - 15, ph - 4, { align: "right" });
}

// ═══════════════════════════════════════════════════════════════
// 1. INVOICE PDF — Official billing document
// ═══════════════════════════════════════════════════════════════
function generateInvoice(): Uint8Array {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const m = 15;
  const cw = pw - m * 2;

  // ════════════════════════════════════════════════════
  // PAGE 1: Client info + Sections A, B, C
  // ════════════════════════════════════════════════════
  drawInvoiceHeader(doc, pw);
  let y = 40;

  // ── TWO COLUMNS: Client Info + Invoice Details ──
  const colW = (cw - 8) / 2;
  const boxH = 62;

  // LEFT: FACTURÉ À
  doc.setFillColor(...LIGHT_BG);
  doc.roundedRect(m, y, colW, boxH, 2, 2, "F");
  doc.setFillColor(...TEAL);
  doc.rect(m, y, 3, boxH, "F");

  let ly = y + 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...NAVY);
  doc.text("FACTURÉ À", m + 7, ly);
  ly += 7;

  const drawClientField = (label: string, value: string) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...TEXT_MUTED);
    doc.text(label, m + 7, ly);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...TEXT);
    doc.text(value, m + 35, ly);
    ly += 5.5;
  };

  drawClientField("Nom", CLIENT.full_name);
  drawClientField("Courriel", CLIENT.email);
  drawClientField("Téléphone", CLIENT.phone);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...TEXT_MUTED);
  doc.text("Adresse fact.", m + 7, ly);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...TEXT);
  doc.text(ACCOUNT.service_address, m + 35, ly);
  ly += 4.5;
  doc.text(`${ACCOUNT.service_city}, ${ACCOUNT.service_province} ${ACCOUNT.service_postal_code}`, m + 35, ly);
  ly += 6;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...TEXT_MUTED);
  doc.text("Adresse service", m + 7, ly);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...TEXT);
  doc.text(ACCOUNT.full_service_address, m + 35, ly);

  // RIGHT: DÉTAILS FACTURE
  const rx = m + colW + 8;
  doc.setFillColor(...LIGHT_BG);
  doc.roundedRect(rx, y, colW, boxH, 2, 2, "F");
  doc.setFillColor(...BLUE);
  doc.rect(rx, y, 3, boxH, "F");

  let ry = y + 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...NAVY);
  doc.text("DÉTAILS FACTURE", rx + 7, ry);
  ry += 7;

  const drawRightField = (label: string, value: string, highlight = false) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...TEXT_MUTED);
    doc.text(label, rx + 7, ry);
    doc.setFont("helvetica", highlight ? "bold" : "normal");
    doc.setFontSize(highlight ? 9 : 8);
    doc.setTextColor(...(highlight ? BLUE : TEXT));
    doc.text(value, rx + 42, ry);
    ry += 5.5;
  };

  drawRightField("N° compte", ACCOUNT.account_number);
  drawRightField("N° facture", INVOICE.invoice_number);
  drawRightField("N° commande", ORDER.order_number);
  drawRightField("Émission", fmtDate(INVOICE.invoice_date));
  drawRightField("Échéance", fmtDate(INVOICE.due_date));
  drawRightField("Période", `${fmtShortDate(INVOICE.cycle_start)} au ${fmtShortDate(INVOICE.cycle_end)}`);

  // Status badge
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...TEXT_MUTED);
  doc.text("Statut", rx + 7, ry);
  const badgeLabel = "Payée";
  const badgeW = doc.getTextWidth(badgeLabel) + 6;
  doc.setFillColor(...SUCCESS);
  doc.roundedRect(rx + 42, ry - 3.5, badgeW, 5, 1, 1, "F");
  doc.setTextColor(...WHITE);
  doc.setFontSize(7);
  doc.text(badgeLabel, rx + 45, ry);

  y = y + boxH + 8;

  // ── Section helpers ──
  const drawSectionHeader = (title: string) => {
    doc.setFillColor(...LIGHT_BG);
    doc.rect(m, y, cw, 7, "F");
    doc.setFillColor(...TEAL);
    doc.rect(m, y, 3, 7, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...NAVY);
    doc.text(title, m + 7, y + 5);
    y += 10;
  };

  const drawTableHeader = (col3Label: string) => {
    doc.setFillColor(...NAVY);
    doc.rect(m, y, cw, 7, "F");
    doc.setTextColor(...WHITE);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text("Description", m + 3, y + 5);
    doc.text(col3Label, m + 100, y + 5);
    doc.text("P.U.", m + 130, y + 5);
    doc.text("Montant", m + 155, y + 5);
    y += 9;
  };

  const drawItemRow = (desc: string, col3: string, unitPrice: number, total: number, rowIndex: number) => {
    const rowH = 7;
    if (rowIndex % 2 === 0) {
      doc.setFillColor(250, 250, 252);
      doc.rect(m, y - 1, cw, rowH, "F");
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...TEXT);
    doc.text(desc, m + 3, y + 4);
    doc.setFontSize(7);
    doc.setTextColor(...TEXT_MUTED);
    doc.text(col3, m + 100, y + 4);
    doc.setFontSize(8);
    doc.setTextColor(...TEXT);
    doc.text(fmt(unitPrice), m + 130, y + 4);
    doc.setFont("helvetica", "bold");
    doc.text(fmt(total), m + 155, y + 4);
    y += rowH;
  };

  // ── SECTION A: SERVICES MENSUELS RÉCURRENTS ──
  drawSectionHeader("SECTION A — SERVICES MENSUELS RÉCURRENTS");
  drawTableHeader("Période");

  const period = `${fmtShortDate(INVOICE.cycle_start)} au ${fmtShortDate(INVOICE.cycle_end)}`;
  RECURRING_SERVICES.forEach((svc, i) => {
    drawItemRow(svc.description, period, svc.unit_price, svc.total, i);
  });

  doc.setDrawColor(...BORDER);
  doc.line(m, y, m + cw, y);
  y += 2;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...NAVY);
  doc.text("Sous-total services mensuels", m + cw - 85, y + 4);
  doc.text(fmt(170.99), m + cw - 2, y + 4, { align: "right" });
  y += 10;

  // ── SECTION B: FRAIS UNIQUES ──
  drawSectionHeader("SECTION B — FRAIS UNIQUES (ÉQUIPEMENT ET ACTIVATION)");
  drawTableHeader("Type");

  EQUIPMENT.forEach((eq, i) => {
    drawItemRow(eq.description, "Équipement", eq.unit_price, eq.total, i);
  });
  FEES.forEach((fee, i) => {
    drawItemRow(fee.description, "Frais", fee.amount, fee.amount, EQUIPMENT.length + i);
  });

  doc.setDrawColor(...BORDER);
  doc.line(m, y, m + cw, y);
  y += 2;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...NAVY);
  doc.text("Sous-total frais uniques", m + cw - 85, y + 4);
  doc.text(fmt(210.00), m + cw - 2, y + 4, { align: "right" });
  y += 10;

  // ── SECTION C: PROMOTIONS ──
  drawSectionHeader("SECTION C — PROMOTIONS ET RABAIS");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...TEXT);
  doc.text(DISCOUNT.label, m + 3, y + 4);
  doc.setFontSize(6.5);
  doc.setTextColor(...TEXT_MUTED);
  doc.text("(appliqué sur équipement et installation)", m + 3 + doc.getTextWidth(DISCOUNT.label) + 3, y + 4);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...SUCCESS);
  doc.text(`- ${fmt(DISCOUNT.amount)}`, m + cw - 2, y + 4, { align: "right" });
  y += 10;

  // ── Page 1 note ──
  doc.setDrawColor(...BORDER);
  doc.line(m, y, m + cw, y);
  y += 5;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.5);
  doc.setTextColor(...TEXT_MUTED);
  doc.text("Suite en page 2 — Sommaire financier et informations de paiement", pw / 2, y + 3, { align: "center" });

  // Page 1 footer (no billing policy — just branding)
  const footerY1 = ph - 12;
  doc.setFillColor(...NAVY);
  doc.rect(0, footerY1, pw, 12, "F");
  doc.setFillColor(...TEAL);
  doc.rect(0, footerY1, pw, 1, "F");
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.text(`${NIVRA.legalName} — ${NIVRA.address}`, 15, footerY1 + 7);
  doc.text("Page 1/2", pw - 15, footerY1 + 7, { align: "right" });

  // ════════════════════════════════════════════════════
  // PAGE 2: Financial summary + Payment + Policy
  // ════════════════════════════════════════════════════
  doc.addPage();
  drawInvoiceHeader(doc, pw);
  y = 40;

  // Page 2 subtitle
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...NAVY);
  doc.text("SOMMAIRE FINANCIER", m, y + 4);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...TEXT_MUTED);
  doc.text(`Facture N° ${INVOICE.invoice_number} — Compte ${ACCOUNT.account_number}`, m, y + 11);
  y += 18;

  // ── Financial summary box ──
  const summaryBoxH = 82;
  doc.setFillColor(...LIGHT_BG);
  doc.roundedRect(m, y, cw, summaryBoxH, 3, 3, "F");
  doc.setFillColor(...TEAL);
  doc.rect(m, y, 3, summaryBoxH, "F");

  let sy = y + 8;
  const totW = 92;
  const lx = m + 10;
  const vx = m + cw - 12;

  const drawSummaryLine = (label: string, value: string, opts: { bold?: boolean; color?: [number, number, number]; size?: number } = {}) => {
    doc.setFont("helvetica", opts.bold ? "bold" : "normal");
    doc.setFontSize(opts.size || 9);
    doc.setTextColor(...(opts.color || TEXT));
    doc.text(label, lx, sy);
    doc.text(value, vx, sy, { align: "right" });
    sy += 7;
  };

  drawSummaryLine("Services mensuels récurrents", fmt(170.99));
  drawSummaryLine("Frais uniques (équipement + activation)", fmt(210.00));
  drawSummaryLine("Rabais EQUIP26 (100% équipement)", `- ${fmt(185.00)}`, { color: SUCCESS });

  // Separator
  sy += 1;
  doc.setDrawColor(...BORDER);
  doc.line(lx, sy, vx, sy);
  sy += 5;

  drawSummaryLine("Sous-total avant taxes", fmt(INVOICE.subtotal), { bold: true });
  drawSummaryLine("TPS (5%)", fmt(INVOICE.tps));
  drawSummaryLine("TVQ (9,975%)", fmt(INVOICE.tvq));

  // Separator
  sy += 1;
  doc.setDrawColor(...BORDER);
  doc.line(lx, sy, vx, sy);
  sy += 5;

  drawSummaryLine("Total de la facture", fmt(INVOICE.total), { bold: true, size: 10 });

  y = y + summaryBoxH + 10;

  // ── Payment information box ──
  const payBoxH = 44;
  doc.setFillColor(240, 253, 244); // light green bg
  doc.roundedRect(m, y, cw, payBoxH, 3, 3, "F");
  doc.setFillColor(...SUCCESS);
  doc.rect(m, y, 3, payBoxH, "F");

  let py2 = y + 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...NAVY);
  doc.text("INFORMATIONS DE PAIEMENT", m + 10, py2);
  py2 += 8;

  const drawPayField = (label: string, value: string) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...TEXT_MUTED);
    doc.text(label, m + 10, py2);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...TEXT);
    doc.text(value, m + 55, py2);
    py2 += 6;
  };

  drawPayField("Montant payé", fmt(PAYMENT.amount));
  drawPayField("Méthode", "PayPal");
  drawPayField("Date", fmtDate(PAYMENT.received_at));
  drawPayField("Référence", PAYMENT.payment_number);

  y = y + payBoxH + 8;

  // ── Balance box ──
  doc.setFillColor(...NAVY);
  doc.roundedRect(m, y, cw, 14, 3, 3, "F");
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("SOLDE À PAYER", m + 10, y + 9.5);
  doc.text(fmt(0), m + cw - 12, y + 9.5, { align: "right" });
  y += 22;

  // ── Thank you note ──
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...TEXT_MUTED);
  doc.text("Merci de votre confiance. Un reçu de paiement distinct a été émis pour vos dossiers.", m, y + 3);

  // Page 2 footer with billing policy
  drawInvoiceFooter(doc, pw, ph, 2, 2);

  return doc.output("arraybuffer");
}

// ═══════════════════════════════════════════════════════════════
// 2. RECEIPT PDF — Payment proof only
// ═══════════════════════════════════════════════════════════════
function generateReceipt(): Uint8Array {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const m = 15;
  const cw = pw - m * 2;

  // GREEN HEADER
  doc.setFillColor(...SUCCESS);
  doc.rect(0, 0, pw, 36, "F");
  doc.setFillColor(34, 197, 94);
  doc.rect(0, 36, pw, 2, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...WHITE);
  doc.text(NIVRA.legalName, m, 14);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(220, 252, 231);
  doc.text(NIVRA.address, m, 21);
  doc.text(`${NIVRA.email} | ${NIVRA.website}`, m, 27);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...WHITE);
  doc.text("RECU DE PAIEMENT", pw - m, 16, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(220, 252, 231);
  doc.text(`NEQ: ${NIVRA.neq}`, pw - m, 24, { align: "right" });

  let y = 46;

  // PAYÉ watermark
  doc.setFont("helvetica", "bold");
  doc.setFontSize(72);
  doc.setTextColor(22, 163, 74);
  try {
    const gState = new (doc as any).GState({ opacity: 0.06 });
    (doc as any).setGState(gState);
    doc.text("PAYE", pw / 2, 160, { align: "center", angle: -25 });
    const gStateN = new (doc as any).GState({ opacity: 1 });
    (doc as any).setGState(gStateN);
  } catch (_e) { /* GState may not be available */ }

  // ── Receipt number banner ──
  doc.setFillColor(...SUCCESS);
  doc.roundedRect(m, y, cw, 12, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...WHITE);
  doc.text(`Recu de paiement N. ${PAYMENT.payment_number}`, pw / 2, y + 8, { align: "center" });
  y += 18;

  // ── TWO COLUMNS: Client Identity + Payment Details ──
  const colW = (cw - 8) / 2;

  // LEFT: CLIENT
  const clientBoxH = 72;
  doc.setFillColor(...LIGHT_BG);
  doc.roundedRect(m, y, colW, clientBoxH, 2, 2, "F");
  doc.setFillColor(...SUCCESS);
  doc.rect(m, y, 3, clientBoxH, "F");

  let ly = y + 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...NAVY);
  doc.text("CLIENT", m + 7, ly);
  ly += 8;

  const drawLeftField = (label: string, value: string) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...TEXT_MUTED);
    doc.text(label, m + 7, ly);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...TEXT);
    doc.text(value, m + 7, ly + 4.5);
    ly += 10;
  };

  drawLeftField("Nom", CLIENT.full_name);
  drawLeftField("Courriel", CLIENT.email);
  drawLeftField("Telephone", CLIENT.phone);
  drawLeftField("Adresse", `${ACCOUNT.service_address}, ${ACCOUNT.service_city}`);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...TEXT);
  doc.text(`${ACCOUNT.service_province} ${ACCOUNT.service_postal_code}`, m + 7, ly);
  ly += 6;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...TEXT_MUTED);
  doc.text("N. compte", m + 7, ly);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...NAVY);
  doc.text(ACCOUNT.account_number, m + 30, ly);

  // RIGHT: PAIEMENT
  const rx = m + colW + 8;
  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(187, 247, 208);
  doc.setLineWidth(0.5);
  doc.roundedRect(rx, y, colW, clientBoxH, 2, 2, "FD");
  doc.setLineWidth(0.2);
  doc.setFillColor(...SUCCESS);
  doc.rect(rx, y, 3, clientBoxH, "F");

  let ry = y + 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...SUCCESS);
  doc.text("PAIEMENT", rx + 7, ry);
  ry += 8;

  const drawRF = (label: string, value: string, isBold = false) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...TEXT_MUTED);
    doc.text(label, rx + 7, ry);
    doc.setFont("helvetica", isBold ? "bold" : "normal");
    doc.setFontSize(isBold ? 10 : 8);
    if (isBold) { doc.setTextColor(...SUCCESS); } else { doc.setTextColor(...TEXT); }
    doc.text(value, rx + 7, ry + 4.5);
    ry += 10;
  };

  drawRF("Date de paiement", fmtDate(PAYMENT.received_at));
  drawRF("Mode de paiement", "Carte de credit");
  drawRF("Montant paye", fmt(PAYMENT.amount), true);

  // Separator
  doc.setDrawColor(187, 247, 208);
  doc.line(rx + 7, ry - 2, rx + colW - 7, ry - 2);
  ry += 3;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...TEXT_MUTED);
  doc.text("N. facture", rx + 7, ry);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...TEXT);
  doc.text(INVOICE.invoice_number, rx + 7, ry + 4.5);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...TEXT_MUTED);
  doc.text("N. commande", rx + colW / 2, ry);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...TEXT);
  doc.text(`#${ORDER.order_number}`, rx + colW / 2, ry + 4.5);

  ry += 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...TEXT_MUTED);
  doc.text("Solde restant", rx + 7, ry);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...SUCCESS);
  doc.text(fmt(0), rx + 7, ry + 4.5);

  y += clientBoxH + 10;

  // ── SHORT SERVICE SUMMARY ──
  doc.setFillColor(...LIGHT_BG);
  doc.roundedRect(m, y, cw, 8, 2, 2, "F");
  doc.setFillColor(...NAVY);
  doc.rect(m, y, 3, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...NAVY);
  doc.text("SERVICES FACTURES", m + 7, y + 5.5);
  y += 11;

  const allBilledItems = [
    ...RECURRING_SERVICES.map(s => ({ label: s.description, amount: s.total, type: "Mensuel" })),
    ...EQUIPMENT.map(e => ({ label: e.description, amount: e.total, type: "Equipement" })),
    ...FEES.map(f => ({ label: f.description, amount: f.amount, type: "Frais" })),
  ];

  allBilledItems.forEach((item, i) => {
    if (i % 2 === 0) {
      doc.setFillColor(250, 250, 252);
      doc.rect(m, y - 1.5, cw, 6.5, "F");
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...TEXT);
    doc.text(item.label, m + 4, y + 2.5);
    doc.setFontSize(6.5);
    doc.setTextColor(...TEXT_MUTED);
    doc.text(item.type, m + 100, y + 2.5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...TEXT);
    doc.text(fmt(item.amount), m + cw - 4, y + 2.5, { align: "right" });
    y += 6.5;
  });

  // Discount line
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...SUCCESS);
  doc.text(DISCOUNT.label, m + 4, y + 2.5);
  doc.setFont("helvetica", "bold");
  doc.text(`- ${fmt(DISCOUNT.amount)}`, m + cw - 4, y + 2.5, { align: "right" });
  y += 8;

  // Taxes + total mini summary
  doc.setDrawColor(...BORDER);
  doc.line(m + cw - 70, y, m + cw, y);
  y += 4;

  const drawMiniTotalLine = (label: string, value: string, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(bold ? 8.5 : 7.5);
    if (bold) { doc.setTextColor(...NAVY); } else { doc.setTextColor(...TEXT_MUTED); }
    doc.text(label, m + cw - 70, y);
    if (bold) { doc.setTextColor(...NAVY); } else { doc.setTextColor(...TEXT); }
    doc.text(value, m + cw - 4, y, { align: "right" });
    y += 5;
  };

  drawMiniTotalLine("Sous-total", fmt(INVOICE.subtotal));
  drawMiniTotalLine("TPS (5%)", fmt(INVOICE.tps));
  drawMiniTotalLine("TVQ (9,975%)", fmt(INVOICE.tvq));
  drawMiniTotalLine("Total paye", fmt(INVOICE.total), true);

  y += 6;

  // Legal note
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...TEXT_MUTED);
  const legalNote = `Ce recu confirme la reception du paiement indique ci-dessus. Il ne remplace pas la facture officielle. Conservez ce document pour vos dossiers. Pour toute question, contactez-nous a ${NIVRA.email}.`;
  const legalLines = doc.splitTextToSize(legalNote, cw);
  doc.text(legalLines, m, y);

  // Green footer
  doc.setFillColor(...SUCCESS);
  doc.rect(0, ph - 16, pw, 16, "F");
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.text(`${NIVRA.legalName} — ${NIVRA.address}`, pw / 2, ph - 10, { align: "center" });
  doc.text(`${NIVRA.tps} | ${NIVRA.tvq}`, pw / 2, ph - 5.5, { align: "center" });

  return doc.output("arraybuffer");
}

// ═══════════════════════════════════════════════════════════════
// 3. ORDER SUMMARY PDF — Pre-billing order confirmation
// ═══════════════════════════════════════════════════════════════
function generateOrderSummary(): Uint8Array {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const m = 15;
  const cw = pw - m * 2;

  // BLUE HEADER
  doc.setFillColor(37, 99, 235);
  doc.rect(0, 0, pw, 34, "F");
  doc.setFillColor(96, 165, 250);
  doc.rect(0, 34, pw, 2, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...WHITE);
  doc.text("NIVRA TELECOM", m, 14);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(191, 219, 254);
  doc.text("Confirmation de votre commande", m, 21);
  doc.text(`${NIVRA.email} | ${NIVRA.website}`, m, 27);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...WHITE);
  doc.text("SOMMAIRE DE COMMANDE", pw - m, 14, { align: "right" });

  let y = 44;

  // Order banner
  doc.setFillColor(...LIGHT_BG);
  doc.roundedRect(m, y, cw, 22, 3, 3, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...NAVY);
  doc.text(`Commande #${ORDER.order_number}`, m + 8, y + 9);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...TEXT_MUTED);
  doc.text(`Passée le ${fmtDate(ORDER.order_date)}`, m + 8, y + 16);

  // Status pill
  const statusLabel = "COMMANDE CONFIRMÉE";
  const pillW = doc.getTextWidth(statusLabel) + 12;
  doc.setFillColor(...SUCCESS);
  doc.roundedRect(pw - m - pillW - 4, y + 5, pillW, 8, 4, 4, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...WHITE);
  doc.text(statusLabel, pw - m - pillW / 2 - 4 + 6, y + 10.5, { align: "center" });

  y += 28;

  // Two-column client + delivery
  const colW = (cw - 6) / 2;

  // Left: Client info
  doc.setFillColor(239, 246, 255);
  doc.setDrawColor(191, 219, 254);
  doc.setLineWidth(0.3);
  doc.roundedRect(m, y, colW, 42, 2, 2, "FD");
  doc.setLineWidth(0.2);

  let ly = y + 7;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(37, 99, 235);
  doc.text("VOS INFORMATIONS", m + 6, ly);
  ly += 7;

  const drawField = (label: string, value: string) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...TEXT_MUTED);
    doc.text(label, m + 6, ly);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...TEXT);
    doc.text(value, m + 6, ly + 4);
    ly += 10;
  };

  drawField("Nom", CLIENT.full_name);
  drawField("Courriel", CLIENT.email);
  drawField("Compte", ACCOUNT.account_number);

  // Right: Delivery
  const rx = m + colW + 6;
  doc.setFillColor(239, 246, 255);
  doc.setDrawColor(191, 219, 254);
  doc.setLineWidth(0.3);
  doc.roundedRect(rx, y, colW, 42, 2, 2, "FD");
  doc.setLineWidth(0.2);

  let ry = y + 7;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(37, 99, 235);
  doc.text("LIVRAISON & ACTIVATION", rx + 6, ry);
  ry += 7;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...TEXT_MUTED);
  doc.text("Adresse de service", rx + 6, ry);
  doc.setFontSize(8);
  doc.setTextColor(...TEXT);
  doc.text(ACCOUNT.service_address, rx + 6, ry + 4);
  ry += 9;
  doc.text(`${ACCOUNT.service_city}, ${ACCOUNT.service_province} ${ACCOUNT.service_postal_code}`, rx + 6, ry);
  ry += 7;

  doc.setFontSize(7);
  doc.setTextColor(...TEXT_MUTED);
  doc.text("Mode de paiement", rx + 6, ry);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...TEXT);
  doc.text("Carte de crédit", rx + 6, ry + 4);

  y += 48;

  // ── SERVICES COMMANDÉS ──
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(37, 99, 235);
  doc.text("Services commandés", m, y + 4);
  y += 10;

  const drawServiceCard = (type: string, name: string, price: number) => {
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.3);
    doc.roundedRect(m, y, cw, 14, 2, 2, "FD");
    doc.setLineWidth(0.2);

    // Type badge
    doc.setFillColor(37, 99, 235);
    doc.roundedRect(m + 4, y + 4, 24, 5, 1, 1, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6);
    doc.setTextColor(...WHITE);
    doc.text(type, m + 16, y + 7.5, { align: "center" });

    // Name
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...NAVY);
    doc.text(name, m + 32, y + 9);

    // Price
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(37, 99, 235);
    doc.text(`${fmt(price)}/mois`, pw - m - 4, y + 9, { align: "right" });

    y += 17;
  };

  drawServiceCard("INTERNET+TV", "GIGA + TV 25 choix", 100.00);
  drawServiceCard("MOBILE", "Mobile 75GB 4G Unlimited Canada", 60.00);
  drawServiceCard("STREAMING", "Spotify Premium", 10.99);

  // ── EQUIPMENT AND FEES ──
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...NAVY);
  doc.text("Équipements et frais", m, y + 4);
  y += 8;

  const allItems = [
    ...EQUIPMENT.map(e => ({ label: e.description, amount: e.total })),
    ...FEES.map(f => ({ label: f.description, amount: f.amount })),
  ];

  allItems.forEach(item => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...TEXT);
    doc.text(`•  ${item.label}`, m + 4, y + 3);
    doc.setFont("helvetica", "bold");
    doc.text(fmt(item.amount), pw - m - 4, y + 3, { align: "right" });
    y += 6;
  });

  // Discount
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...SUCCESS);
  doc.text(`•  ${DISCOUNT.label}`, m + 4, y + 3);
  doc.setFont("helvetica", "bold");
  doc.text(`- ${fmt(DISCOUNT.amount)}`, pw - m - 4, y + 3, { align: "right" });
  y += 10;

  // ── ESTIMATED TOTAL ──
  doc.setFillColor(37, 99, 235);
  doc.roundedRect(pw / 2, y, pw / 2 - m, 32, 3, 3, "F");

  let ty = y + 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(191, 219, 254);

  doc.text("Services mensuels", pw / 2 + 8, ty);
  doc.text(fmt(170.99), pw - m - 8, ty, { align: "right" });
  ty += 5;

  doc.text("Frais uniques", pw / 2 + 8, ty);
  doc.text(fmt(210.00), pw - m - 8, ty, { align: "right" });
  ty += 5;

  doc.setTextColor(134, 239, 172);
  doc.text("Rabais EQUIP26", pw / 2 + 8, ty);
  doc.text(`- ${fmt(185.00)}`, pw - m - 8, ty, { align: "right" });
  ty += 6;

  doc.setDrawColor(96, 165, 250);
  doc.line(pw / 2 + 8, ty - 1, pw - m - 8, ty - 1);
  ty += 3;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...WHITE);
  doc.text("Total estimé (taxes incl.)", pw / 2 + 8, ty + 1);
  doc.text(fmt(ORDER.total_amount), pw - m - 8, ty + 1, { align: "right" });

  y += 38;

  // Next steps — expanded box to prevent overflow
  y += 4;
  doc.setFillColor(254, 252, 232);
  doc.setDrawColor(253, 224, 71);
  doc.setLineWidth(0.3);
  doc.roundedRect(m, y, cw, 34, 2, 2, "FD");
  doc.setLineWidth(0.2);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(161, 98, 7);
  doc.text("PROCHAINES ETAPES", m + 6, y + 7);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(120, 83, 9);
  doc.text("1. Confirmation de paiement", m + 6, y + 14);
  doc.text("2. Activation du service", m + 6, y + 19);
  doc.text("3. Reception de la facture officielle et du contrat", m + 6, y + 24);
  doc.setFontSize(7);
  doc.text(`Pour toute question : ${NIVRA.email}`, m + 6, y + 30);

  // Blue footer
  doc.setFillColor(37, 99, 235);
  doc.rect(0, ph - 14, pw, 14, "F");
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.text(`${NIVRA.legalName} — ${NIVRA.address}`, pw / 2, ph - 9, { align: "center" });
  doc.text("Ce sommaire est un document informatif et ne constitue pas une facture.", pw / 2, ph - 5, { align: "center" });

  return doc.output("arraybuffer");
}

// ═══════════════════════════════════════════════════════════════
// 4. CONTRACT PDF — Legal service agreement (4 pages)
// ═══════════════════════════════════════════════════════════════
function generateContract(): Uint8Array {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const m = 15;
  const cw = pw - m * 2;
  const totalPages = 4;

  const drawHeader = (title: string) => {
    doc.setFillColor(...NAVY);
    doc.rect(0, 0, pw, 28, "F");
    doc.setFillColor(...TEAL);
    doc.rect(0, 28, pw, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(...WHITE);
    doc.text(NIVRA.legalName, 15, 12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(180, 190, 210);
    doc.text(NIVRA.address, 15, 19);
    doc.text(NIVRA.email, 15, 24);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...TEAL);
    doc.text(title, pw - 15, 14, { align: "right" });
  };

  const drawFooter = (pageNum: number) => {
    doc.setFillColor(...NAVY);
    doc.rect(0, ph - 14, pw, 14, "F");
    doc.setTextColor(...WHITE);
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "normal");
    doc.text(`${NIVRA.legalName} — ${NIVRA.address}`, pw / 2, ph - 9, { align: "center" });
    doc.text(`NEQ: ${NIVRA.neq} | ${NIVRA.tps} | ${NIVRA.tvq}`, pw / 2, ph - 5, { align: "center" });
    doc.setFontSize(7);
    doc.text(`Page ${pageNum} / ${totalPages}`, pw - 15, ph - 7, { align: "right" });
  };

  const sectionTitle = (title: string, yPos: number): number => {
    doc.setFillColor(...LIGHT_BG);
    doc.rect(m, yPos, cw, 7, "F");
    doc.setFillColor(...TEAL);
    doc.rect(m, yPos, 3, 7, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...NAVY);
    doc.text(title, m + 7, yPos + 5);
    return yPos + 10;
  };

  // === PAGE 1 ===
  drawHeader("CONTRAT DE SERVICE");
  let y = 36;

  // Contract ID banner
  doc.setFillColor(...BLUE);
  doc.roundedRect(m, y, cw, 18, 2, 2, "F");
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(`Contrat N° CTR-${ORDER.order_number}`, pw / 2, y + 8, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Date d'entrée en vigueur: ${fmtDate(ORDER.order_date)} | Commande: #${ORDER.order_number}`, pw / 2, y + 14, { align: "center" });
  y += 24;

  // Client info
  y = sectionTitle("INFORMATIONS DU CLIENT", y);

  doc.setFillColor(...LIGHT_BG);
  doc.roundedRect(m, y, cw, 40, 2, 2, "F");

  const fields = [
    ["Nom complet", CLIENT.full_name],
    ["Courriel", CLIENT.email],
    ["Téléphone", CLIENT.phone],
    ["Adresse de facturation", ACCOUNT.full_service_address],
    ["Adresse de service", ACCOUNT.full_service_address],
    ["N° compte", ACCOUNT.account_number],
  ];

  let fy = y + 6;
  fields.forEach(([label, value]) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...TEXT_MUTED);
    doc.text(`${label}:`, m + 5, fy);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...TEXT);
    doc.text(value, m + 48, fy);
    fy += 5.8;
  });
  y += 44;

  // Services table
  y = sectionTitle("SERVICES SOUSCRITS", y);
  doc.setFillColor(...NAVY);
  doc.rect(m, y, cw, 7, "F");
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("TYPE", m + 3, y + 5);
  doc.text("PLAN / DESCRIPTION", m + 30, y + 5);
  doc.text("MENSUEL", pw - m - 3, y + 5, { align: "right" });
  y += 9;

  const services = [
    { type: "INTERNET+TV", name: "GIGA + TV 25 choix", price: 100.00 },
    { type: "MOBILE", name: "Mobile 75GB 4G Unlimited Canada", price: 60.00 },
    { type: "STREAMING", name: "Spotify Premium", price: 10.99 },
  ];

  services.forEach((svc, i) => {
    if (i % 2 === 0) {
      doc.setFillColor(250, 250, 252);
      doc.rect(m, y - 1, cw, 7, "F");
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...TEAL);
    doc.text(svc.type, m + 3, y + 4);
    doc.setTextColor(...TEXT);
    doc.text(svc.name, m + 30, y + 4);
    doc.setFont("helvetica", "bold");
    doc.text(fmt(svc.price), pw - m - 3, y + 4, { align: "right" });
    y += 7;
  });
  y += 3;

  // Equipment
  y = sectionTitle("ÉQUIPEMENTS (FRAIS UNIQUES)", y);
  EQUIPMENT.forEach((eq, i) => {
    if (i % 2 === 0) {
      doc.setFillColor(250, 250, 252);
      doc.rect(m, y - 1, cw, 7, "F");
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...TEXT);
    doc.text(eq.description, m + 5, y + 4);
    doc.setFont("helvetica", "bold");
    doc.text(fmt(eq.total), pw - m - 3, y + 4, { align: "right" });
    y += 7;
  });
  y += 3;

  // Fees
  y = sectionTitle("FRAIS D'ACTIVATION", y);
  FEES.forEach(fee => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...TEXT);
    doc.text(fee.description, m + 5, y + 4);
    doc.text(fmt(fee.amount), pw - m - 3, y + 4, { align: "right" });
    y += 7;
  });
  y += 3;

  // Financial reference
  y += 2;
  doc.setFillColor(...LIGHT_BG);
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  doc.roundedRect(m, y, cw, 18, 2, 2, "FD");
  doc.setLineWidth(0.2);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...NAVY);
  doc.text("RÉFÉRENCE FINANCIÈRE", m + 5, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...TEXT);
  doc.text(`Services mensuels récurrents : ${fmt(170.99)}/mois | Mode de paiement : Carte de crédit`, m + 5, y + 12);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(6.5);
  doc.setTextColor(...TEXT_MUTED);
  doc.text("Le détail complet des montants, taxes et frais est présenté sur la facture officielle jointe.", m + 5, y + 17);

  drawFooter(1);

  // === PAGE 2: TERMS ===
  doc.addPage();
  drawHeader("CONDITIONS GÉNÉRALES");
  y = 36;

  // Payment method
  y += 3;
  y = sectionTitle("MODE DE PAIEMENT", y);
  doc.setFillColor(...LIGHT_BG);
  doc.roundedRect(m, y, cw, 14, 2, 2, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...TEXT);
  doc.text("Mode de paiement sélectionné : Carte de crédit", m + 5, y + 6);
  doc.setFontSize(7);
  doc.setTextColor(...TEXT_MUTED);
  doc.text("Le cycle de facturation commence après confirmation du paiement par le fournisseur.", m + 5, y + 11);
  y += 18;

  const terms = [
    { title: "1. DURÉE ET RÉSILIATION", content: "Le présent contrat est sans engagement et peut être résilié en tout temps par le client avec un préavis de 30 jours. Les services sont fournis sur une base mensuelle prépayée. Aucuns frais de résiliation ne s'appliquent. À la résiliation, le client doit retourner tout équipement fourni dans les 15 jours." },
    { title: "2. PAIEMENT ET FACTURATION", content: "Les services sont prépayés. Le paiement doit être reçu et confirmé avant l'activation ou le renouvellement. Nivra accepte les virements Interac, PayPal et cartes de crédit. Le cycle de facturation commence à la date de confirmation du paiement. Sans paiement confirmé à la date de renouvellement (J0), le service expire automatiquement." },
    { title: "3. PAIEMENT AUTOMATIQUE (AUTOPAY)", content: "Le client peut activer le prélèvement automatique mensuel via carte de crédit enregistrée de manière sécurisée. Tant que le paiement automatique est actif, un rabais mensuel de 5,00 $ est appliqué sur les services récurrents admissibles. Ce rabais est retiré immédiatement et sans préavis si le client désactive le paiement automatique, et s'applique uniquement aux factures futures — il n'est jamais rétroactif. Le montant est prélevé automatiquement 3 jours avant la date de renouvellement du cycle." },
    { title: "4. SUSPENSION POUR NON-PAIEMENT", content: "En cas de non-paiement à la date de renouvellement (J0), le service n'est pas renouvelé et passe au statut « Expiré ». Aucun intérêt ni frais de réactivation ne s'appliquent pour un non-renouvellement normal. Après 90 jours sans renouvellement, le numéro de téléphone peut devenir irrécupérable. Des intérêts de 5 % par mois et des frais de réactivation de 15 $ s'appliquent UNIQUEMENT en cas de litiges bancaires ou de rétrofacturations." },
    { title: "5. ÉQUIPEMENT", content: "L'équipement fourni (routeur, terminal TV, carte SIM, etc.) demeure la propriété de Nivra Communications Inc. et doit être retourné en bon état à la résiliation. Garantie fabricant de 12 mois dès activation. Perte, vol et dommages causés par le client sont exclus sauf approbation interne." },
    { title: "6. UTILISATION ACCEPTABLE", content: "Le client s'engage à utiliser les services conformément aux lois en vigueur au Canada et au Québec. Toute utilisation abusive, frauduleuse ou contraire aux politiques de Nivra peut entraîner la suspension immédiate des services sans préavis ni compensation." },
    { title: "7. MODIFICATIONS TARIFAIRES", content: "Nivra se réserve le droit de modifier les tarifs, frais et conditions applicables avec un préavis écrit de 30 jours transmis par courriel. Le client peut résilier sans frais s'il n'accepte pas les modifications, dans les 30 jours suivant la réception de l'avis." },
    { title: "8. LIMITATION DE RESPONSABILITÉ", content: "Nivra Communications Inc. n'est pas responsable des dommages indirects, consécutifs, spéciaux ou punitifs. La responsabilité totale de Nivra est limitée au montant des frais effectivement payés par le client au cours des trois (3) derniers mois de service. La disponibilité de service cible est de 99,5 % sur base mensuelle." },
    { title: "9. LOI APPLICABLE ET JURIDICTION", content: "Le présent contrat est régi par les lois de la province de Québec et les lois fédérales du Canada. Tout litige sera soumis à la compétence exclusive des tribunaux de la province de Québec, district de Laval." },
  ];

  terms.forEach(term => {
    if (y > ph - 45) {
      drawFooter(2);
      doc.addPage();
      drawHeader("CONDITIONS GÉNÉRALES (suite)");
      y = 36;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...NAVY);
    doc.text(term.title, m, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...TEXT);
    const lines = doc.splitTextToSize(term.content, cw);
    doc.text(lines, m, y);
    y += lines.length * 3.5 + 5;
  });

  drawFooter(2);

  // === PAGE 3: ANNEXES ===
  doc.addPage();
  drawHeader("ANNEXES");
  y = 36;

  const annexes = [
    { title: "ANNEXE A — NIVEAUX DE SERVICE (SLA)", content: "Nivra s'engage à fournir une disponibilité de 99,5% sur base mensuelle. Les interruptions planifiées seront communiquées 48 heures à l'avance par courriel. En cas de panne majeure (> 24h consécutives), un crédit proportionnel sera appliqué automatiquement au prochain cycle." },
    { title: "ANNEXE B — PROTECTION DES RENSEIGNEMENTS PERSONNELS", content: "Nivra protège les renseignements personnels conformément à la Loi 25 du Québec et à la LPRPDE fédérale. Les données sont collectées uniquement pour la fourniture des services, la facturation et le support. Aucune donnée n'est vendue à des tiers. Le client peut demander l'accès, la rectification ou la suppression de ses données en contactant support@nivra-telecom.ca." },
    { title: "ANNEXE C — PROCÉDURE DE PLAINTES ET RÉSOLUTION DE DIFFÉRENDS", content: "Pour toute plainte : contacter support@nivra-telecom.ca. Délai de réponse : 48 heures ouvrables. Si non résolue : escalade au gestionnaire de service. En dernier recours : Commission des plaintes relatives aux services de télécom (CPRST) ou le CRTC." },
  ];

  annexes.forEach(annex => {
    y = sectionTitle(annex.title, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...TEXT);
    const lines = doc.splitTextToSize(annex.content, cw - 10);
    doc.text(lines, m + 5, y);
    y += lines.length * 3.8 + 10;
  });

  // Terms version
  y += 5;
  doc.setFillColor(...LIGHT_BG);
  doc.setDrawColor(...TEAL);
  doc.setLineWidth(0.5);
  doc.roundedRect(m, y, cw, 12, 1, 1, "FD");
  doc.setLineWidth(0.2);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...NAVY);
  doc.text("RÉFÉRENCE AUX MODALITÉS DE SERVICE", m + 5, y + 5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...TEXT_MUTED);
  doc.text("Ce contrat est soumis aux Modalités de service Nivra Telecom (version v2026.01.02-Prepaid-01), disponibles sur le portail client.", m + 5, y + 10);

  drawFooter(3);

  // === PAGE 4: SIGNATURES ===
  doc.addPage();
  drawHeader("ACCEPTATION");
  y = 36;

  y = sectionTitle("ACCEPTATION DU CONTRAT", y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...TEXT);
  const acceptText = "En signant le présent contrat, le Client déclare avoir lu, compris et accepté l'ensemble des conditions générales, annexes et Modalités de service ci-dessus. Le Client confirme que les informations fournies sont exactes et complètes.";
  const acceptLines = doc.splitTextToSize(acceptText, cw);
  doc.text(acceptLines, m, y);
  y += acceptLines.length * 4 + 15;

  const boxW = (cw - 15) / 2;

  // Client signature box
  doc.setFillColor(...LIGHT_BG);
  doc.roundedRect(m, y, boxW, 50, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...NAVY);
  doc.text("SIGNATURE DU CLIENT", m + 5, y + 10);

  // Show signed
  doc.setFont("helvetica", "italic");
  doc.setFontSize(12);
  doc.setTextColor(...BLUE);
  doc.text(CLIENT.full_name, m + 10, y + 25);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...TEXT_MUTED);
  doc.text(`Signé le: ${fmtDate(ORDER.order_date)}`, m + 10, y + 32);
  doc.text("Acceptation en ligne lors du checkout", m + 10, y + 37);

  // Nivra representative
  const agentX = m + boxW + 15;
  doc.setFillColor(...LIGHT_BG);
  doc.roundedRect(agentX, y, boxW, 50, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...NAVY);
  doc.text("REPRÉSENTANT NIVRA", agentX + 5, y + 10);
  doc.setDrawColor(...TEXT_MUTED);
  doc.line(agentX + 10, y + 32, agentX + boxW - 10, y + 32);
  doc.setFontSize(7);
  doc.setTextColor(...TEXT_MUTED);
  doc.text("Signature", agentX + 10, y + 37);
  doc.text("Agent: _______________", agentX + 10, y + 43);

  y += 60;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.setTextColor(...TEXT_MUTED);
  doc.text(`Generated by Nivra – Contract Engine – Template v2026.01.02-Prepaid-01 – ContractID: CTR-${ORDER.order_number}`, pw / 2, y, { align: "center" });

  drawFooter(4);

  return doc.output("arraybuffer");
}

// ═══════════════════════════════════════════════════════════════
// EMAIL SENDER
// ═══════════════════════════════════════════════════════════════
async function sendEmail(to: string, subject: string, htmlBody: string, pdfBytes: Uint8Array, filename: string) {
  const RESEND_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_KEY) throw new Error("RESEND_API_KEY not set");

  const base64 = btoa(String.fromCharCode(...new Uint8Array(pdfBytes)));

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Nivra Telecom <no-reply@nivra-telecom.ca>",
      to: [to],
      subject,
      html: htmlBody,
      attachments: [{ filename, content: base64 }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend error: ${res.status} ${err}`);
  }
  return await res.json();
}

function wrapEmailHtml(docTitle: string, docDescription: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; margin: 0; padding: 40px 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
    <div style="background: #0f172a; padding: 24px 32px;">
      <h1 style="color: #ffffff; font-size: 20px; margin: 0;">NIVRA COMMUNICATIONS INC.</h1>
      <p style="color: #94a3b8; font-size: 13px; margin: 6px 0 0 0;">Fournisseur de services de télécommunications — Province de Québec</p>
    </div>
    <div style="padding: 32px;">
      <h2 style="color: #0f172a; font-size: 18px; margin: 0 0 12px 0;">${docTitle}</h2>
      <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">${docDescription}</p>
      <div style="background: #f1f5f9; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
        <p style="color: #334155; font-size: 13px; margin: 0;"><strong>Client:</strong> ${CLIENT.full_name}</p>
        <p style="color: #334155; font-size: 13px; margin: 4px 0 0 0;"><strong>Compte:</strong> ${ACCOUNT.account_number}</p>
        <p style="color: #334155; font-size: 13px; margin: 4px 0 0 0;"><strong>Commande:</strong> #${ORDER.order_number}</p>
      </div>
      <p style="color: #64748b; font-size: 12px; margin: 0;">Le document est joint en pièce jointe (PDF).</p>
    </div>
    <div style="background: #0f172a; padding: 16px 32px; text-align: center;">
      <p style="color: #94a3b8; font-size: 11px; margin: 0;">${NIVRA.legalName} — ${NIVRA.address}</p>
      <p style="color: #64748b; font-size: 11px; margin: 4px 0 0 0;">${NIVRA.email} | ${NIVRA.website}</p>
    </div>
  </div>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════════
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const to = "oldo.lavaud3112@icloud.com";

    // Generate all 4 PDFs
    const invoicePdf = generateInvoice();
    const receiptPdf = generateReceipt();
    const orderSummaryPdf = generateOrderSummary();
    const contractPdf = generateContract();

    // Send 4 separate emails
    const results = [];

    results.push(await sendEmail(
      to,
      `Facture N° ${INVOICE.invoice_number} — Nivra Telecom`,
      wrapEmailHtml("Votre facture", `Veuillez trouver ci-joint votre facture N° ${INVOICE.invoice_number} d'un montant de ${fmt(INVOICE.total)} pour la commande #${ORDER.order_number}.`),
      invoicePdf,
      `Facture_${INVOICE.invoice_number}_Nivra.pdf`
    ));

    results.push(await sendEmail(
      to,
      `Reçu de paiement N° ${PAYMENT.payment_number} — Nivra Telecom`,
      wrapEmailHtml("Votre reçu de paiement", `Votre paiement de ${fmt(PAYMENT.amount)} par carte de crédit a été confirmé. Ce reçu confirme la réception du paiement pour la facture N° ${INVOICE.invoice_number}.`),
      receiptPdf,
      `Recu_${PAYMENT.payment_number}_Nivra.pdf`
    ));

    results.push(await sendEmail(
      to,
      `Sommaire de commande #${ORDER.order_number} — Nivra Telecom`,
      wrapEmailHtml("Sommaire de votre commande", `Votre commande #${ORDER.order_number} a été confirmée. Ce sommaire récapitule les services, équipements et frais associés à votre commande.`),
      orderSummaryPdf,
      `Sommaire_${ORDER.order_number}_Nivra.pdf`
    ));

    results.push(await sendEmail(
      to,
      `Contrat de service CTR-${ORDER.order_number} — Nivra Telecom`,
      wrapEmailHtml("Votre contrat de service", `Votre contrat de service CTR-${ORDER.order_number} est joint en pièce jointe. Ce document contient les conditions générales, les annexes et les clauses légales applicables à vos services.`),
      contractPdf,
      `Contrat_CTR-${ORDER.order_number}_Nivra.pdf`
    ));

    return new Response(JSON.stringify({
      success: true,
      emails_sent: 4,
      results,
      order: ORDER.order_number,
      invoice: INVOICE.invoice_number,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
