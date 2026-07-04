/**
 * Nivra Order Summary Template V5.0 — 2026-07-01
 *
 * Approved redesign (chat 2026-07-01) — telecom-grade 2 pages:
 *   PAGE 1 — Overview
 *     • Corporate blue header (#0066CC) + order number + emit date
 *     • Meta grid (client / account / contact / service address /
 *       representative / install date / status)
 *     • Two hero boxes side-by-side:
 *         PAYÉ AUJOURD'HUI (green)  |  FACTURÉ CHAQUE MOIS (blue)
 *     • Services table (récurrent mensuel) with per-line prices
 *     • Promotions table (durée + rabais/mois) — only if any
 *     • Frais uniques table (activation, équipement, prorata)
 *     • Recap two-columns box: Récurrent mensuel  |  Paiement initial
 *   PAGE 2 — Next steps
 *     • Timeline (5 numbered blue circles + real dates)
 *     • Mode de paiement + autopay status
 *     • Amber info box (KYC / equipment excl / promo end)
 *     • Support contacts + portal link
 *
 * Same OrderSummaryV3Data interface as before — no upstream refactor needed.
 */

import jsPDF from "jspdf";
import type { PDFGenerationResult } from "./types";
import { NIVRA } from "./companyInfo";

// ============================================================================
// DATA INTERFACE (unchanged — kept for compatibility with pdfFromDb.ts)
// ============================================================================

export interface OrderSummaryV3Data {
  order_number: string;
  order_date: string;
  order_status: string;

  client_name: string;
  client_email: string;
  client_phone: string;
  client_dob?: string;
  service_address: string;
  billing_address?: string;
  delivery_method?: string;

  account_number: string;

  services: Array<{
    type: string;
    name: string;
    description?: string;
    monthly_price: number;
    addons?: string[];
    promo?: string;
    phone_number?: string;
    activation_date?: string;
  }>;

  equipment: Array<{
    name: string;
    quantity: number;
    unit_price: number;
    serial?: string;
    imei?: string;
    storage?: string;
    color?: string;
    condition?: string;
    warranty_days?: number;
  }>;

  fees: Array<{ label: string; amount: number }>;

  subtotal_monthly: number;
  subtotal_onetime: number;
  discount_amount: number;
  discount_label?: string;
  tax_gst: number;
  tax_qst: number;
  total_due: number;

  payment_method?: string;
  payment_status?: string;
  estimated_activation?: string;

  mobile_assigned_number?: string;
  mobile_sim_iccid?: string;
  mobile_sim_carrier?: string;
  mobile_sim_type?: string;
  mobile_activated_at?: string;
  install_date?: string;
  technician_name?: string;

  sale_source?: string;
  agent_name?: string;
  agent_number?: string;

  // Optional promo enrichment (may be absent — falls back to discount_label)
  promotions?: Array<{ code?: string; label?: string; duration?: string; monthly_discount?: number }>;
}

// ============================================================================
// PALETTE (mirrors invoice v4 / receipt v2 / contract v6)
// ============================================================================

const BLUE: [number, number, number] = [0, 102, 204];      // #0066CC
const NAVY: [number, number, number] = [10, 37, 64];       // #0A2540
const GREEN: [number, number, number] = [34, 120, 60];     // #22783C
const GREEN_SOFT: [number, number, number] = [230, 244, 234];
const BLUE_SOFT: [number, number, number] = [231, 241, 251];
const GREY_LINE: [number, number, number] = [217, 221, 227];
const GREY_TXT: [number, number, number] = [74, 85, 104];
const GREY_BG: [number, number, number] = [245, 247, 250];
const ZEBRA: [number, number, number] = [249, 250, 252];
const AMBER_BG: [number, number, number] = [255, 247, 224];
const AMBER_BR: [number, number, number] = [224, 168, 0];

// ============================================================================
// HELPERS
// ============================================================================

const fmt = (n: number): string =>
  new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD", minimumFractionDigits: 2 }).format(n || 0);

const s = (v: unknown): string => {
  if (v === null || v === undefined) return "—";
  const t = String(v).trim();
  return t.length ? t : "—";
};

const fmtDate = (dateStr: string | undefined | null, opts: { withWeekday?: boolean } = {}): string => {
  if (!dateStr) return "—";
  const m = String(dateStr).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "—";
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const wd = opts.withWeekday ? d.toLocaleString("fr-CA", { weekday: "long" }) + " " : "";
  return `${wd}${d.getDate()} ${d.toLocaleString("fr-CA", { month: "long" })} ${d.getFullYear()}`;
};

const addDays = (dateStr: string | undefined | null, days: number): string => {
  if (!dateStr) return "";
  const m = String(dateStr).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "";
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// A4: 210 x 297 mm. Working margins: 15mm both sides -> width = 180mm.
const PW = 210;
const PH = 297;
const M = 15;
const CW = PW - 2 * M; // 180

// ============================================================================
// SHARED CHROME
// ============================================================================

function drawHeader(doc: jsPDF, orderNumber: string, emitDate: string) {
  doc.setFillColor(...BLUE);
  doc.rect(0, 0, PW, 32, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("NIVRA TELECOM", M, 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Sommaire de commande", M, 22);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(`Commande N° ${orderNumber}`, PW - M, 13, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(`Émis le ${emitDate}`, PW - M, 20, { align: "right" });
  doc.setFontSize(7.5);
  doc.text("Document de confirmation — Non facturable", PW - M, 26, { align: "right" });
}

function drawFooter(doc: jsPDF, page: number, total: number) {
  doc.setDrawColor(...GREY_LINE);
  doc.setLineWidth(0.2);
  doc.line(M, PH - 15, PW - M, PH - 15);
  doc.setTextColor(...GREY_TXT);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(`Nivra Telecom Inc. — ${NIVRA.address || "Montréal, QC"}`, M, PH - 10);
  doc.text(`${NIVRA.email}  ·  ${NIVRA.website}`, M, PH - 6);
  doc.text(`Page ${page} / ${total}`, PW - M, PH - 8, { align: "right" });
}

function sectionTitle(doc: jsPDF, y: number, label: string): number {
  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  const up = label.toUpperCase();
  doc.text(up, M, y);
  doc.setDrawColor(...BLUE);
  doc.setLineWidth(0.6);
  const w = doc.getTextWidth(up);
  doc.line(M, y + 1.5, M + w, y + 1.5);
  return y + 6;
}

// ============================================================================
// PAGE 1 BUILDERS
// ============================================================================

function drawMetaGrid(doc: jsPDF, d: OrderSummaryV3Data, y: number): number {
  const rows: Array<[string, string, string, string]> = [];
  rows.push(["Client", s(d.client_name), "N° Compte", s(d.account_number)]);
  rows.push(["Courriel", s(d.client_email), "Téléphone", s(d.client_phone)]);
  const addr = s(d.service_address);
  rows.push(["Adresse de service", addr, "", ""]);
  if (d.sale_source === "field_sales" && (d.agent_name || d.agent_number)) {
    rows.push([
      "Représentant",
      `${d.agent_name || "—"}${d.agent_number ? ` (${d.agent_number})` : ""}`,
      "Type de vente",
      "Terrain — Porte-à-porte",
    ]);
  }
  if (d.install_date) {
    rows.push([
      "Date d'installation prévue",
      fmtDate(d.install_date, { withWeekday: true }),
      "Statut commande",
      d.order_status ? d.order_status[0].toUpperCase() + d.order_status.slice(1) : "Confirmée",
    ]);
  } else {
    rows.push([
      "Statut commande",
      d.order_status ? d.order_status[0].toUpperCase() + d.order_status.slice(1) : "Confirmée",
      "Paiement",
      d.payment_status || "Reçu",
    ]);
  }

  const rowH = 9;
  const midX = M + CW / 2 + 2;

  for (let i = 0; i < rows.length; i++) {
    const [la, va, lb, vb] = rows[i];
    const yy = y + i * rowH;
    doc.setTextColor(...GREY_TXT);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(la.toUpperCase(), M, yy);
    if (lb) doc.text(lb.toUpperCase(), midX, yy);
    doc.setTextColor(...NAVY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.text(va, M, yy + 4);
    if (lb) doc.text(vb, midX, yy + 4);
  }
  return y + rows.length * rowH + 2;
}

function computeSplitTotals(d: OrderSummaryV3Data) {
  const monthlyGross = d.subtotal_monthly || 0;
  const discount = d.discount_amount || 0;
  const monthlyNet = Math.max(0, monthlyGross - discount);
  const onetime = d.subtotal_onetime || 0;
  const taxTotal = (d.tax_gst || 0) + (d.tax_qst || 0);
  const preTax = monthlyNet + onetime;
  const monthlyTaxShare = preTax > 0 ? (taxTotal * monthlyNet) / preTax : 0;
  const onetimeTaxShare = taxTotal - monthlyTaxShare;
  const monthlyGst = preTax > 0 ? ((d.tax_gst || 0) * monthlyNet) / preTax : 0;
  const monthlyQst = preTax > 0 ? ((d.tax_qst || 0) * monthlyNet) / preTax : 0;
  const onetimeGst = (d.tax_gst || 0) - monthlyGst;
  const onetimeQst = (d.tax_qst || 0) - monthlyQst;
  const monthlyTotal = monthlyNet + monthlyTaxShare;
  const paidToday = onetime + onetimeTaxShare + monthlyTotal; // total_due includes both
  // Prefer canonical total_due when it exists
  return {
    monthlyGross,
    discount,
    monthlyNet,
    onetime,
    monthlyGst,
    monthlyQst,
    onetimeGst,
    onetimeQst,
    monthlyTotal,
    paidToday: d.total_due || paidToday,
  };
}

function drawHeroBoxes(doc: jsPDF, d: OrderSummaryV3Data, y: number, split: ReturnType<typeof computeSplitTotals>): number {
  const gap = 4;
  const boxW = (CW - gap) / 2;
  const boxH = 22;
  // Paid today (green)
  doc.setFillColor(...GREEN_SOFT);
  doc.setDrawColor(...GREEN);
  doc.setLineWidth(0.4);
  doc.roundedRect(M, y, boxW, boxH, 1.5, 1.5, "FD");
  doc.setTextColor(...GREEN);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("PAYÉ AUJOURD'HUI", M + 3, y + 5);
  doc.setTextColor(...NAVY);
  doc.setFontSize(16);
  doc.text(fmt(split.paidToday), M + 3, y + 13);
  doc.setTextColor(...GREY_TXT);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  const method = d.payment_method || "Paiement enregistré";
  doc.text(`Frais uniques + prorata + taxes  ·  ${method}`, M + 3, y + 19);

  // Monthly (blue)
  const rx = M + boxW + gap;
  doc.setFillColor(...BLUE_SOFT);
  doc.setDrawColor(...BLUE);
  doc.roundedRect(rx, y, boxW, boxH, 1.5, 1.5, "FD");
  doc.setTextColor(...BLUE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("FACTURÉ CHAQUE MOIS", rx + 3, y + 5);
  doc.setTextColor(...NAVY);
  doc.setFontSize(16);
  doc.text(fmt(split.monthlyTotal), rx + 3, y + 13);
  doc.setTextColor(...GREY_TXT);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  const nextInvoice = d.install_date
    ? `Prochaine facture ${fmtDate(addDays(d.install_date, 30))}`
    : "Prochaine facture selon date d'activation";
  doc.text(`Récurrent après promo  ·  ${nextInvoice}`, rx + 3, y + 19);

  return y + boxH + 4;
}

type Col = { header: string; width: number; align?: "L" | "R" | "C" };

function drawTable(
  doc: jsPDF,
  y: number,
  cols: Col[],
  rows: string[][],
  totalRow?: string[],
): number {
  const rowH = 6.2;
  const headerH = 5.5;
  const totalW = cols.reduce((s, c) => s + c.width, 0);

  // Header
  doc.setFillColor(...NAVY);
  doc.rect(M, y, totalW, headerH, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.8);
  let cx = M;
  for (const col of cols) {
    const tx = col.align === "R" ? cx + col.width - 2 : col.align === "C" ? cx + col.width / 2 : cx + 2;
    doc.text(col.header, tx, y + 3.8, { align: col.align === "R" ? "right" : col.align === "C" ? "center" : "left" });
    cx += col.width;
  }

  let yy = y + headerH;
  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  for (let ri = 0; ri < rows.length; ri++) {
    if (ri % 2 === 0) {
      doc.setFillColor(...ZEBRA);
      doc.rect(M, yy, totalW, rowH, "F");
    }
    cx = M;
    for (let ci = 0; ci < cols.length; ci++) {
      const col = cols[ci];
      const val = rows[ri][ci] || "";
      const tx = col.align === "R" ? cx + col.width - 2 : col.align === "C" ? cx + col.width / 2 : cx + 2;
      doc.text(val, tx, yy + 4.1, { align: col.align === "R" ? "right" : col.align === "C" ? "center" : "left" });
      cx += col.width;
    }
    yy += rowH;
  }
  if (totalRow) {
    doc.setFillColor(...GREY_BG);
    doc.rect(M, yy, totalW, rowH + 0.5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    cx = M;
    for (let ci = 0; ci < cols.length; ci++) {
      const col = cols[ci];
      const val = totalRow[ci] || "";
      const tx = col.align === "R" ? cx + col.width - 2 : col.align === "C" ? cx + col.width / 2 : cx + 2;
      doc.text(val, tx, yy + 4.3, { align: col.align === "R" ? "right" : col.align === "C" ? "center" : "left" });
      cx += col.width;
    }
    yy += rowH + 0.5;
  }
  // Outer border
  doc.setDrawColor(...GREY_LINE);
  doc.setLineWidth(0.2);
  doc.rect(M, y, totalW, yy - y);
  return yy + 2;
}

function drawRecapBoxes(doc: jsPDF, y: number, split: ReturnType<typeof computeSplitTotals>, d: OrderSummaryV3Data): number {
  const gap = 4;
  const boxW = (CW - gap) / 2;
  const boxH = 38;

  // Left: recurrent monthly
  doc.setFillColor(...GREY_BG);
  doc.roundedRect(M, y, boxW, boxH, 1.5, 1.5, "F");
  doc.setTextColor(...BLUE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("RÉCURRENT MENSUEL", M + 3, y + 5);
  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  const rows1: [string, string][] = [
    ["Services", fmt(split.monthlyGross)],
  ];
  if (split.discount > 0) rows1.push(["Promotion", `-${fmt(split.discount)}`]);
  rows1.push(["TPS (5%)", fmt(split.monthlyGst)]);
  rows1.push(["TVQ (9,975%)", fmt(split.monthlyQst)]);
  let yy = y + 11;
  for (const [l, v] of rows1) {
    doc.text(l, M + 3, yy);
    doc.text(v, M + boxW - 3, yy, { align: "right" });
    yy += 4.2;
  }
  doc.setDrawColor(...GREY_LINE);
  doc.line(M + 3, yy - 1, M + boxW - 3, yy - 1);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Total mensuel", M + 3, yy + 4);
  doc.text(fmt(split.monthlyTotal), M + boxW - 3, yy + 4, { align: "right" });

  // Right: paid today
  const rx = M + boxW + gap;
  doc.setFillColor(...GREY_BG);
  doc.roundedRect(rx, y, boxW, boxH, 1.5, 1.5, "F");
  doc.setTextColor(...GREEN);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("PAIEMENT INITIAL", rx + 3, y + 5);
  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  const rows2: [string, string][] = [
    ["Frais uniques (HT)", fmt(split.onetime)],
    ["Premier mois (net)", fmt(split.monthlyNet)],
    ["TPS (5%)", fmt(d.tax_gst || 0)],
    ["TVQ (9,975%)", fmt(d.tax_qst || 0)],
  ];
  yy = y + 11;
  for (const [l, v] of rows2) {
    doc.text(l, rx + 3, yy);
    doc.text(v, rx + boxW - 3, yy, { align: "right" });
    yy += 4.2;
  }
  doc.setDrawColor(...GREY_LINE);
  doc.line(rx + 3, yy - 1, rx + boxW - 3, yy - 1);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Payé aujourd'hui", rx + 3, yy + 4);
  doc.text(fmt(split.paidToday), rx + boxW - 3, yy + 4, { align: "right" });

  return y + boxH + 2;
}

// ============================================================================
// PAGE 2 BUILDERS
// ============================================================================

function drawTimeline(doc: jsPDF, y: number, d: OrderSummaryV3Data): number {
  const install = d.install_date;
  const shipDate = install ? addDays(install, -5) : "";
  const activateDate = install || "";
  const firstRenewal = install ? addDays(install, 30) : "";
  const method = d.payment_method || "Mode de paiement enregistré";

  const steps: Array<[string, string, string, string]> = [
    ["1", `Aujourd'hui — ${d.order_date ? fmtDate(d.order_date) : ""}`, "Commande confirmée",
      `Paiement de ${fmt(d.total_due || 0)} reçu. Vérification KYC en cours (auto-approbation habituellement < 5 min).`],
    ["2", shipDate ? fmtDate(shipDate) : "2-3 jours ouvrables", "Expédition équipement",
      "Équipements livrés par transporteur. Numéro de suivi envoyé par courriel."],
    ["3", install ? fmtDate(install, { withWeekday: true }) : "Sur rendez-vous", "Installation à domicile",
      "Technicien Nivra sur place. Aucun paiement supplémentaire requis."],
    ["4", activateDate ? fmtDate(activateDate) : "Le jour de l'installation", "Activation service",
      "Confirmation d'activation envoyée. Début de la période de facturation."],
    ["5", firstRenewal ? fmtDate(firstRenewal) : "30 jours après activation", "1ère facture de renouvellement",
      `${fmt(computeSplitTotals(d).monthlyTotal)} prélevé automatiquement (${method}).`],
  ];

  let yy = y;
  for (const [num, date, title, desc] of steps) {
    // circle
    doc.setFillColor(...BLUE);
    doc.circle(M + 3.5, yy + 3.5, 3.2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text(num, M + 3.5, yy + 4.7, { align: "center" });

    doc.setTextColor(...GREY_TXT);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(date.toUpperCase(), M + 9, yy + 1.5);

    doc.setTextColor(...NAVY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.text(title, M + 9, yy + 6);

    doc.setTextColor(...GREY_TXT);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    const wrapped = doc.splitTextToSize(desc, CW - 12);
    doc.text(wrapped, M + 9, yy + 11);

    yy += 17 + Math.max(0, (wrapped.length - 1) * 3.5);
  }
  return yy + 2;
}

function drawPaymentBox(doc: jsPDF, y: number, d: OrderSummaryV3Data): number {
  doc.setFillColor(...GREY_BG);
  doc.roundedRect(M, y, CW, 18, 1.5, 1.5, "F");
  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(d.payment_method || "Paiement enregistré", M + 4, y + 6);
  doc.setTextColor(...GREY_TXT);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text("Autopay : ACTIVÉ  ·  Prélèvement automatique le jour anniversaire de la facturation", M + 4, y + 11);
  doc.text("Vous pouvez modifier votre mode de paiement en tout temps depuis votre portail client.", M + 4, y + 15.5);
  return y + 22;
}

function drawInfoBox(doc: jsPDF, y: number): number {
  const h = 22;
  doc.setFillColor(...AMBER_BG);
  doc.setDrawColor(...AMBER_BR);
  doc.setLineWidth(0.3);
  doc.roundedRect(M, y, CW, h, 1.5, 1.5, "FD");
  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("À conserver", M + 4, y + 5);
  doc.setTextColor(...GREY_TXT);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("• Ce sommaire n'est pas une facture officielle. La facture PDF sera envoyée dès l'activation du service.", M + 4, y + 10);
  doc.text("• Aucun rabais promo n'est appliqué aux frais d'équipement ni aux frais d'activation.", M + 4, y + 14);
  doc.text("• Les promotions à durée limitée se terminent automatiquement à la fin de la période indiquée.", M + 4, y + 18);
  return y + h + 4;
}

function drawSupport(doc: jsPDF, y: number): number {
  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text("Support client", M, y);
  doc.setTextColor(...GREY_TXT);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(`${NIVRA.email}  ·  ${NIVRA.website}/portal`, M, y + 5);
  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text("Portail client", M, y + 13);
  doc.setTextColor(...GREY_TXT);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(`Suivi commande, factures, changement de forfait, gestion autopay : ${NIVRA.website}/portal`, M, y + 18);
  return y + 24;
}

// ============================================================================
// MAIN GENERATOR
// ============================================================================

export function generateOrderSummaryPDF(data: OrderSummaryV3Data): PDFGenerationResult;
export function generateOrderSummaryPDF(data: any): PDFGenerationResult;
export function generateOrderSummaryPDF(data: any): PDFGenerationResult {
  try {
    const d: OrderSummaryV3Data = data;
    if (!d.order_number) return { success: false, error: "Numero de commande manquant" };

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const emitDate = d.order_date ? fmtDate(d.order_date) : fmtDate(new Date().toISOString().slice(0, 10));
    const split = computeSplitTotals(d);

    // ===== PAGE 1 =====
    drawHeader(doc, d.order_number, emitDate);
    let y = 40;
    y = drawMetaGrid(doc, d, y);
    y = drawHeroBoxes(doc, d, y + 2, split);

    // Services table
    y = sectionTitle(doc, y + 2, "Services souscrits (récurrent mensuel)");
    const svcRows = (d.services || []).map((sv) => [
      sv.name || "—",
      sv.description || sv.addons?.join(", ") || "",
      "1",
      fmt(sv.monthly_price || 0),
    ]);
    if (svcRows.length === 0) svcRows.push(["Aucun service récurrent", "", "", fmt(0)]);
    y = drawTable(doc, y, [
      { header: "Service", width: 45 },
      { header: "Détails", width: 85 },
      { header: "Qté", width: 15, align: "C" },
      { header: "Prix/mois", width: 35, align: "R" },
    ], svcRows, ["", "Sous-total récurrent", "", fmt(split.monthlyGross)]);

    // Promotions table (only if any)
    const promoRows: string[][] = [];
    if (d.promotions && d.promotions.length > 0) {
      for (const p of d.promotions) {
        promoRows.push([
          p.code || "—",
          p.label || "Promotion",
          p.duration || "—",
          `-${fmt(p.monthly_discount || 0)}`,
        ]);
      }
    } else if (split.discount > 0) {
      promoRows.push([
        "—",
        d.discount_label || "Promotion appliquée",
        "—",
        `-${fmt(split.discount)}`,
      ]);
    }
    if (promoRows.length > 0) {
      y = sectionTitle(doc, y + 2, "Promotion appliquée");
      y = drawTable(doc, y, [
        { header: "Code", width: 30 },
        { header: "Description", width: 85 },
        { header: "Durée", width: 30, align: "C" },
        { header: "Rabais/mois", width: 35, align: "R" },
      ], promoRows);
    }

    // Frais uniques (equipment + fees + prorata)
    const oneTimeRows: string[][] = [];
    for (const eq of d.equipment || []) {
      const parts = [eq.name];
      if (eq.storage) parts.push(eq.storage);
      if (eq.color) parts.push(eq.color);
      oneTimeRows.push([
        eq.name || "Équipement",
        parts.slice(1).join(" · ") || "Équipement",
        String(eq.quantity || 1),
        fmt((eq.unit_price || 0) * (eq.quantity || 1)),
      ]);
    }
    for (const f of d.fees || []) {
      oneTimeRows.push([f.label || "Frais", "", "1", fmt(f.amount || 0)]);
    }
    if (oneTimeRows.length > 0) {
      y = sectionTitle(doc, y + 2, "Frais uniques (payés aujourd'hui)");
      y = drawTable(doc, y, [
        { header: "Item", width: 45 },
        { header: "Détails", width: 85 },
        { header: "Qté", width: 15, align: "C" },
        { header: "Prix", width: 35, align: "R" },
      ], oneTimeRows, ["", "Sous-total frais uniques", "", fmt(split.onetime)]);
    }

    // Recap two-cols
    y = drawRecapBoxes(doc, y + 2, split, d);

    drawFooter(doc, 1, 2);

    // ===== PAGE 2 =====
    doc.addPage();
    drawHeader(doc, d.order_number, emitDate);
    y = 40;
    y = sectionTitle(doc, y, "Prochaines étapes");
    y = drawTimeline(doc, y, d);
    y = sectionTitle(doc, y + 2, "Mode de paiement & autopay");
    y = drawPaymentBox(doc, y, d);
    y = sectionTitle(doc, y, "Informations importantes");
    y = drawInfoBox(doc, y);
    y = sectionTitle(doc, y, "Besoin d'aide ?");
    y = drawSupport(doc, y);

    drawFooter(doc, 2, 2);

    const blob = doc.output("blob");
    return {
      success: true,
      blob,
      filename: `Sommaire_${d.order_number}_Nivra.pdf`,
    };
  } catch (error: any) {
    console.error("[OrderSummaryV5] Generation error:", error);
    return { success: false, error: error?.message || "Erreur de generation" };
  }
}

export default generateOrderSummaryPDF;
