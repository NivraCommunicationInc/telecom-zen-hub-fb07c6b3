/**
 * Nivra Contract Template V6.0 — Telecom-Grade Professional Standard (5 pages)
 *
 * Page 1: Header + Meta grid + Parties + Services table
 * Page 2: Promotions mensuelles + Frais uniques + Récap financier (2 boîtes hero)
 * Page 3: Conditions générales §1-§5 (carte de crédit, plus PayPal)
 * Page 4: Modalités de service §6-§12
 * Page 5: Déclaration + Signatures (Nivra auto-signée + client)
 */

import jsPDFModule from "npm:jspdf@2.5.2";
const jsPDF = (jsPDFModule as any).default || jsPDFModule;
type jsPDF = any;
import type { PDFGenerationResult } from "./types.ts";
import { NIVRA } from "./companyInfo.ts";

// ============================================================================
// CONTRACT DATA INTERFACE
// ============================================================================

export interface ContractDataV3 {
  contract_number: string;
  contract_date: string;
  terms_version: string;

  client_name: string;
  client_email: string;
  client_phone: string;
  client_dob?: string;
  billing_address: string;
  service_address: string;

  account_number: string;
  order_number: string;

  services: Array<{
    type: string;
    name: string;
    description?: string;
    monthly_price: number;
    quantity?: number;
  }>;

  equipment: Array<{
    name: string;
    quantity: number;
    unit_price: number;
  }>;

  one_time_fees: Array<{
    label: string;
    amount: number;
  }>;

  subtotal_monthly: number;
  subtotal_one_time: number;
  discount_amount: number;
  tax_gst: number;
  tax_qst: number;
  total_due_today: number;

  payment_method?: string;

  signature_name?: string;
  signature_date?: string;
  signature_ip?: string;
  is_signed?: boolean;

  admin_signature_name?: string;
  admin_signature_date?: string;

  discount_label?: string;

  has_discount?: boolean;
  discount_lines?: Array<{
    description: string;
    unit_price: number;
    duration_label?: string;
    code?: string;
  }>;

  sale_source?: string;
  agent_name?: string;
  agent_number?: string;

  mobile_assigned_number?: string;
  mobile_sim_iccid?: string;
  mobile_sim_carrier?: string;
  mobile_sim_type?: string;
  mobile_activated_at?: string;
  install_date?: string;
  technician_name?: string;
}

// ============================================================================
// HELPERS
// ============================================================================

const fmt = (amount: number): string =>
  new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD", minimumFractionDigits: 2 }).format(amount || 0);

const fmtDate = (dateStr: string | undefined | null): string => {
  if (!dateStr) return "—";
  const ymd = String(dateStr).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) {
    const d = new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
    return `${d.getDate()} ${d.toLocaleString("fr-CA", { month: "long" })} ${d.getFullYear()}`;
  }
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    return `${d.getDate()} ${d.toLocaleString("fr-CA", { month: "long" })} ${d.getFullYear()}`;
  }
  return "—";
};

// Palette
const NAVY: [number, number, number] = [10, 37, 64];
const BLUE: [number, number, number] = [0, 102, 204];
const LIGHT: [number, number, number] = [244, 247, 251];
const BORDER: [number, number, number] = [217, 226, 235];
const TEXT: [number, number, number] = [31, 41, 55];
const MUTED: [number, number, number] = [107, 114, 128];
const GREEN: [number, number, number] = [22, 163, 74];
const GREEN_DARK: [number, number, number] = [14, 124, 76];

const TOTAL_PAGES = 5;

function drawHeader(doc: jsPDF, contractNum: string, subtitle: string, pageNum: number) {
  const pw = doc.internal.pageSize.getWidth();
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pw, 28, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text("NIVRA TELECOM", 15, 12);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(184, 207, 230);
  doc.text("CONTRAT DE SERVICE DE TELECOMMUNICATIONS", 15, 18);
  doc.text("NEQ 2291249786  |  TPS 732287291 RT0001  |  TVQ 1229249786 TQ0001", 15, 23);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text(subtitle, pw - 15, 12, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(184, 207, 230);
  doc.text(`No ${contractNum}`, pw - 15, 18, { align: "right" });
  doc.text(`Page ${pageNum} de ${TOTAL_PAGES}`, pw - 15, 23, { align: "right" });
}

function drawFooter(doc: jsPDF, pageNum: number) {
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  doc.setDrawColor(...BORDER);
  doc.line(15, ph - 14, pw - 15, ph - 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(...MUTED);
  doc.text(`${NIVRA.legalName || "NIVRA COMMUNICATIONS INC."}  |  ${NIVRA.email || "support@nivra-telecom.ca"}  |  ${NIVRA.website || "www.nivra-telecom.ca"}`, 15, ph - 9);
  doc.text(`Page ${pageNum} de ${TOTAL_PAGES}`, pw - 15, ph - 9, { align: "right" });
  doc.setFont("helvetica", "italic");
  doc.setFontSize(6);
  doc.text("Ce document constitue un contrat legalement contraignant.", pw / 2, ph - 5, { align: "center" });
}

function sectionTitle(doc: jsPDF, text: string, y: number): number {
  doc.setFillColor(...BLUE);
  doc.rect(15, y, 2.5, 6, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...NAVY);
  doc.text(text, 19, y + 4.5);
  return y + 9;
}

function subSection(doc: jsPDF, num: string, title: string, y: number): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...NAVY);
  doc.text(`${num}. ${title.toUpperCase()}`, 15, y);
  return y + 4;
}

function bullet(doc: jsPDF, text: string, y: number, wrapWidth: number = 175): number {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.8);
  doc.setTextColor(...TEXT);
  const lines = doc.splitTextToSize(text, wrapWidth);
  for (let i = 0; i < lines.length; i++) {
    doc.text((i === 0 ? "- " : "  ") + lines[i], 17, y);
    y += 3.3;
  }
  return y + 0.5;
}

// ============================================================================
// MAIN GENERATOR
// ============================================================================

export function generateContractV3PDF(data: ContractDataV3): PDFGenerationResult {
  try {
    if (!data.contract_number) return { success: false, error: "Numero de contrat manquant" };

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pw = doc.internal.pageSize.getWidth();

    // ===================================================================
    // PAGE 1 — SOMMAIRE ET SERVICES
    // ===================================================================
    drawHeader(doc, data.contract_number, "SOMMAIRE ET SERVICES", 1);
    let y = 36;

    // Badge
    doc.setFillColor(...BLUE);
    doc.roundedRect(15, y - 5, 75, 6.5, 1.5, 1.5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text("CONTRAT DE SERVICE - PREPAYE MENSUEL", 17.5, y - 0.7);
    y += 6;

    // Meta grid (2 rows x 3 cols)
    const meta = [
      ["N de commande", data.order_number || "—"],
      ["Compte client", data.account_number || "—"],
      ["Date d'emission", fmtDate(data.contract_date)],
      ["Cycle facturation", "Mensuel prepaye (30 j)"],
      ["Version contrat", data.terms_version || "v6.0"],
      ["Debut de service", fmtDate(data.contract_date)],
    ];
    const gridW = (pw - 30 - 4) / 3;
    for (let i = 0; i < meta.length; i++) {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = 15 + col * (gridW + 2);
      const yy = y + row * 11;
      doc.setFillColor(...LIGHT);
      doc.roundedRect(x, yy, gridW, 9, 1.5, 1.5, "F");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      doc.setTextColor(...MUTED);
      doc.text(meta[i][0].toUpperCase(), x + 2.5, yy + 3.5);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(...NAVY);
      doc.text(meta[i][1], x + 2.5, yy + 7.2);
    }
    y += 26;

    // Parties (2 columns)
    const boxW = (pw - 30 - 4) / 2;
    const drawParty = (x: number, title: string, lines: string[]) => {
      doc.setDrawColor(...BORDER);
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(x, y, boxW, 40, 2, 2, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(...NAVY);
      doc.text(title.toUpperCase(), x + 3, y + 5);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...TEXT);
      let yy = y + 10;
      for (const ln of lines) {
        const wrapped = doc.splitTextToSize(ln, boxW - 6);
        for (const w of wrapped) {
          if (yy < y + 39) {
            doc.text(w, x + 3, yy);
            yy += 4;
          }
        }
      }
    };
    drawParty(15, "Fournisseur", [
      "Nivra Communications Inc.",
      "2620 boul. Cure-Labelle, Laval, QC H7P 5J1",
      "Tel: (438) 448-4327",
      "support@nivra-telecom.ca",
      "NEQ 2291249786",
      "TPS 732287291 RT0001",
      "TVQ 1229249786 TQ0001",
    ]);
    drawParty(19 + boxW, "Client", [
      data.client_name || "—",
      data.service_address || data.billing_address || "—",
      data.client_phone ? `Tel: ${data.client_phone}` : "",
      data.client_email || "",
      `ID client : ${data.account_number || "—"}`,
    ].filter(Boolean) as string[]);
    y += 45;

    // Field-sales agent line
    if (data.sale_source === "field_sales" && (data.agent_name || data.agent_number)) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(7.5);
      doc.setTextColor(...MUTED);
      doc.text(`Representant : ${data.agent_name || "—"}  |  Badge : ${data.agent_number || "—"}  |  Vente terrain`, 15, y);
      y += 5;
    }

    // Services table
    y = sectionTitle(doc, "Services souscrits", y);
    doc.setFillColor(...NAVY);
    doc.rect(15, y, pw - 30, 6, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    doc.text("SERVICE", 17, y + 4);
    doc.text("TYPE", 95, y + 4);
    doc.text("QTE", 130, y + 4);
    doc.text("PRIX UNIT.", 165, y + 4, { align: "right" });
    doc.text("MONTANT", pw - 17, y + 4, { align: "right" });
    y += 6;

    let altRow = false;
    for (const svc of data.services) {
      const qty = svc.quantity && svc.quantity > 0 ? svc.quantity : 1;
      const line = svc.monthly_price * qty;
      if (altRow) {
        doc.setFillColor(...LIGHT);
        doc.rect(15, y, pw - 30, 5.5, "F");
      }
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...TEXT);
      const nm = doc.splitTextToSize(svc.name || "—", 76);
      doc.text(nm[0], 17, y + 3.8);
      doc.setTextColor(...MUTED);
      doc.text("Recurrent", 95, y + 3.8);
      doc.setTextColor(...TEXT);
      doc.text(String(qty), 132, y + 3.8);
      doc.text(fmt(svc.monthly_price), 165, y + 3.8, { align: "right" });
      doc.setFont("helvetica", "bold");
      doc.text(fmt(line), pw - 17, y + 3.8, { align: "right" });
      y += 5.5;
      altRow = !altRow;
    }
    doc.setDrawColor(...BORDER);
    doc.line(15, y, pw - 15, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...MUTED);
    doc.text("Sous-total mensuel:", 165, y, { align: "right" });
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...TEXT);
    doc.text(fmt(data.subtotal_monthly), pw - 17, y, { align: "right" });

    drawFooter(doc, 1);

    // ===================================================================
    // PAGE 2 — PROMOTIONS, FRAIS ET RECAPITULATIF
    // ===================================================================
    doc.addPage();
    drawHeader(doc, data.contract_number, "PROMOTIONS, FRAIS ET RECAPITULATIF", 2);
    y = 36;

    // PROMOTIONS
    y = sectionTitle(doc, "Promotions et rabais mensuels", y);
    doc.setFillColor(...NAVY);
    doc.rect(15, y, pw - 30, 6, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    doc.text("PROMOTION", 17, y + 4);
    doc.text("DUREE", 110, y + 4);
    doc.text("CODE", 145, y + 4);
    doc.text("MONTANT", pw - 17, y + 4, { align: "right" });
    y += 6;

    const promos = (data.has_discount && Array.isArray(data.discount_lines) && data.discount_lines.length > 0)
      ? data.discount_lines
      : (data.discount_amount > 0
          ? [{ description: data.discount_label || "Rabais promotionnel", unit_price: -Math.abs(data.discount_amount), duration_label: "1 cycle", code: "PROMO" }]
          : []);

    let totalPromo = 0;
    let totalPromoFirstMonth = 0;
    let totalPromoRecurring = 0;
    const isFirstMonthOnly = (dl: any) => {
      const dur = String(dl?.duration_label || "").toLowerCase();
      const desc = String(dl?.description || "").toLowerCase();
      return /1er\s*mois|premier\s*mois|first\s*month|^1\s*cycle$/.test(dur)
        || (/1er\s+mois|premier\s+mois|first\s+month|gratuit/.test(desc) && !/\/\s*mois/.test(desc));
    };
    if (promos.length === 0) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(...MUTED);
      doc.text("Aucun rabais applique a cette commande.", 17, y + 4);
      y += 6;
    } else {
      altRow = false;
      for (const dl of promos) {
        if (altRow) {
          doc.setFillColor(...LIGHT);
          doc.rect(15, y, pw - 30, 5.5, "F");
        }
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(...TEXT);
        doc.text(doc.splitTextToSize(dl.description || "—", 90)[0], 17, y + 3.8);
        doc.setTextColor(...MUTED);
        doc.text(dl.duration_label || "—", 110, y + 3.8);
        doc.setFont("courier", "normal");
        doc.text(dl.code || "—", 145, y + 3.8);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...GREEN);
        const amt = dl.unit_price < 0 ? dl.unit_price : -Math.abs(dl.unit_price);
        doc.text(fmt(amt), pw - 17, y + 3.8, { align: "right" });
        totalPromo += amt;
        if (isFirstMonthOnly(dl)) totalPromoFirstMonth += amt;
        else totalPromoRecurring += amt;
        y += 5.5;
        altRow = !altRow;
      }
      doc.setDrawColor(...BORDER);
      doc.line(15, y, pw - 15, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(...MUTED);
      doc.text("Total rabais mensuels:", 145, y, { align: "right" });
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...GREEN);
      doc.text(fmt(totalPromo), pw - 17, y, { align: "right" });
    }
    y += 9;

    // ONE-TIME FEES
    y = sectionTitle(doc, "Frais uniques (factures a l'activation)", y);
    doc.setFillColor(...NAVY);
    doc.rect(15, y, pw - 30, 6, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    doc.text("DESCRIPTION", 17, y + 4);
    doc.text("QTE", 130, y + 4);
    doc.text("PRIX UNIT.", 165, y + 4, { align: "right" });
    doc.text("MONTANT", pw - 17, y + 4, { align: "right" });
    y += 6;

    const feeLines: Array<{ label: string; qty: number; unit: number; total: number }> = [];
    for (const eq of data.equipment || []) {
      feeLines.push({ label: eq.name, qty: eq.quantity || 1, unit: eq.unit_price, total: (eq.quantity || 1) * eq.unit_price });
    }
    for (const fee of data.one_time_fees || []) {
      feeLines.push({ label: fee.label, qty: 1, unit: fee.amount, total: fee.amount });
    }

    if (feeLines.length === 0) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(...MUTED);
      doc.text("Aucun frais unique applique a cette commande.", 17, y + 4);
      y += 6;
    } else {
      altRow = false;
      for (const f of feeLines) {
        if (altRow) {
          doc.setFillColor(...LIGHT);
          doc.rect(15, y, pw - 30, 5.5, "F");
        }
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(...TEXT);
        doc.text(doc.splitTextToSize(f.label || "—", 105)[0], 17, y + 3.8);
        doc.text(String(f.qty), 132, y + 3.8);
        doc.text(fmt(f.unit), 165, y + 3.8, { align: "right" });
        doc.setFont("helvetica", "bold");
        doc.text(fmt(f.total), pw - 17, y + 3.8, { align: "right" });
        y += 5.5;
        altRow = !altRow;
      }
      doc.setDrawColor(...BORDER);
      doc.line(15, y, pw - 15, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(...MUTED);
      doc.text("Sous-total frais uniques:", 165, y, { align: "right" });
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...TEXT);
      doc.text(fmt(data.subtotal_one_time), pw - 17, y, { align: "right" });
    }
    y += 9;

    // RECAP FINANCIER (two hero boxes)
    y = sectionTitle(doc, "Recapitulatif financier", y);

    const bw = (pw - 30 - 4) / 2;
    // Recap mensuel = récurrent stable (les crédits 1er-mois-seul sont hors récurrent)
    const monthlyBase = data.subtotal_monthly + totalPromoRecurring;
    const monthlyGst = Math.round(monthlyBase * 0.05 * 100) / 100;
    const monthlyQst = Math.round(monthlyBase * 0.09975 * 100) / 100;
    const monthlyTotal = monthlyBase + monthlyGst + monthlyQst;

    // Blue box (monthly)
    doc.setFillColor(...NAVY);
    const boxH = totalPromoFirstMonth < 0 ? 58 : 52;
    doc.roundedRect(15, y, bw, boxH, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text("TOTAL MENSUEL RECURRENT", 18, y + 5.5);
    const monthlyRows: Array<[string, string]> = [
      ["Services", fmt(data.subtotal_monthly)],
      ["Rabais recurrent", fmt(totalPromoRecurring)],
      ["Sous-total", fmt(monthlyBase)],
      ["TPS 5%", fmt(monthlyGst)],
      ["TVQ 9.975%", fmt(monthlyQst)],
    ];
    let ry = y + 12;
    for (const [k, v] of monthlyRows) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(184, 207, 230);
      doc.text(k, 18, ry);
      doc.setTextColor(255, 255, 255);
      doc.text(v, 15 + bw - 3, ry, { align: "right" });
      ry += 4.5;
    }
    doc.setDrawColor(55, 90, 129);
    doc.line(18, ry - 1, 15 + bw - 3, ry - 1);
    ry += 3;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text("TOTAL / mois", 18, ry + 2);
    doc.setFontSize(13);
    doc.text(fmt(monthlyTotal), 15 + bw - 3, ry + 2, { align: "right" });
    if (totalPromoFirstMonth < 0) {
      ry += 6;
      doc.setFont("helvetica", "italic");
      doc.setFontSize(7);
      doc.setTextColor(184, 207, 230);
      doc.text(`1er mois : credit ${fmt(totalPromoFirstMonth)} applique une seule fois`, 18, ry + 2);
    }

    // Green box (one-time)
    const feesTotal = data.subtotal_one_time || 0;
    const feesGst = Math.round(feesTotal * 0.05 * 100) / 100;
    const feesQst = Math.round(feesTotal * 0.09975 * 100) / 100;
    const feesTotalWithTax = feesTotal + feesGst + feesQst;

    const x2 = 19 + bw;
    doc.setFillColor(...GREEN_DARK);
    doc.roundedRect(x2, y, bw, 52, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text("TOTAL UNIQUE A L'ACTIVATION", x2 + 3, y + 5.5);
    const feesRows = [
      ["Equipements + frais", fmt(feesTotal)],
      ["TPS 5%", fmt(feesGst)],
      ["TVQ 9.975%", fmt(feesQst)],
    ];
    ry = y + 12;
    for (const [k, v] of feesRows) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(183, 228, 199);
      doc.text(k, x2 + 3, ry);
      doc.setTextColor(255, 255, 255);
      doc.text(v, x2 + bw - 3, ry, { align: "right" });
      ry += 4.5;
    }
    ry += 8;
    doc.setDrawColor(10, 90, 55);
    doc.line(x2 + 3, ry - 4, x2 + bw - 3, ry - 4);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text("TOTAL une fois", x2 + 3, ry + 2);
    doc.setFontSize(13);
    doc.text(fmt(feesTotalWithTax), x2 + bw - 3, ry + 2, { align: "right" });

    drawFooter(doc, 2);

    // ===================================================================
    // PAGE 3 — CONDITIONS GENERALES (§1-§5)
    // ===================================================================
    doc.addPage();
    drawHeader(doc, data.contract_number, "CONDITIONS GENERALES", 3);
    y = 36;

    y = subSection(doc, "1", "Nature du service et activation", y);
    y = bullet(doc, "Nivra Telecom est un fournisseur de services de telecommunications prepaye a renouvellement mensuel.", y);
    y = bullet(doc, "Aucune verification de credit externe n'est effectuee lors de la souscription.", y);
    y = bullet(doc, `Le service debute a la date de livraison et d'installation de l'equipement, soit a compter du ${fmtDate(data.contract_date)} ou de la date effective d'activation.`, y);
    y = bullet(doc, "Nivra se reserve le droit de refuser, suspendre ou retarder toute commande si une fraude est suspectee, sans obligation de motiver sa decision.", y);
    y += 2;

    y = subSection(doc, "2", "Facturation et cycle de paiement", y);
    y = bullet(doc, "Le cycle de facturation est mensuel (30 jours), ancre a la date d'activation du service.", y);
    y = bullet(doc, "Une facture est generee et rendue disponible sur le portail client trois (3) jours avant la date de renouvellement.", y);
    y = bullet(doc, "La facture est un document informatif ; aucun service n'est fourni sans paiement confirme pour le cycle correspondant.", y);
    y = bullet(doc, "Taxes applicables : TPS (5 %) et TVQ (9,975 %), calculees conformement aux lois fiscales du Quebec.", y);
    y = bullet(doc, "Le client est responsable de consulter ses factures via le portail. Toute contestation doit etre soumise dans les trente (30) jours suivant l'emission.", y);
    y += 2;

    y = subSection(doc, "3", "Conditions de paiement", y);
    y = bullet(doc, "Methodes de paiement acceptees : carte de credit (Visa, Mastercard, American Express) via notre processeur securise, et virement Interac (e-Transfer).", y);
    y = bullet(doc, "Le paiement doit etre confirme AVANT la date de cycle pour renouveler le service.", y);
    y = bullet(doc, "La confirmation est automatique pour les paiements par carte de credit. Pour Interac, la confirmation est effectuee manuellement dans un delai de vingt-quatre (24) heures ouvrables.", y);
    y = bullet(doc, "Aucun paiement en especes, cheque ou mandat-poste n'est accepte.", y);
    y += 2;

    y = subSection(doc, "4a", "Changement de forfait", y);
    y = bullet(doc, "En cas de changement de forfait (upgrade), le nouveau tarif prend effet immediatement et un ajustement proratise au prorata journalier du cycle en cours est facture sur-le-champ.", y);
    y = bullet(doc, "En cas de reduction de forfait (downgrade), le changement prend effet au prochain cycle de renouvellement, sans frais ni remboursement pour le cycle en cours.", y);
    y += 2;

    y = subSection(doc, "4b", "Prelevements automatiques (Autopay)", y);
    y = bullet(doc, "L'activation du prelevement automatique par carte de credit accorde un rabais de 5,00 $/mois sur le tarif mensuel recurrent.", y);
    y = bullet(doc, "Le client peut activer ou desactiver l'autopay a tout moment via son portail client.", y);
    y = bullet(doc, "La desactivation de l'autopay entraine le retrait immediat du rabais, effectif des la prochaine facture.", y);
    y = bullet(doc, "Le prelevement est effectue automatiquement a la date d'echeance de la facture.", y);
    y += 2;

    y = subSection(doc, "5", "Promotions et rabais applicables", y);
    y = bullet(doc, "Les promotions actives sont detaillees a la Page 2 - Section \u00ab Promotions et rabais mensuels \u00bb.", y);
    y = bullet(doc, "Chaque promotion s'applique uniquement aux elements et a la duree specifies dans l'offre.", y);
    y = bullet(doc, "Les promotions sont non cumulables sauf indication contraire expresse.", y);
    y = bullet(doc, "Nivra se reserve le droit de modifier ou retirer toute offre promotionnelle a tout moment.", y);

    drawFooter(doc, 3);

    // ===================================================================
    // PAGE 4 — MODALITES DE SERVICE (§6-§12)
    // ===================================================================
    doc.addPage();
    drawHeader(doc, data.contract_number, "MODALITES DE SERVICE", 4);
    y = 36;

    y = subSection(doc, "6", "Non-renouvellement et consequences", y);
    y = bullet(doc, "En cas de non-paiement confirme a la date de cycle (jour d'echeance), la facture devient en souffrance.", y);
    y = bullet(doc, "Apres cinq (5) jours de retard (J+5), le service est suspendu. La facture demeure en souffrance et le client dispose d'un delai de reactivation de cinq (5) jours supplementaires.", y);
    y = bullet(doc, "Apres dix (10) jours de retard (J+10), la facture est annulee et aucune dette n'est portee au dossier. La reactivation requiert un nouveau cycle de paiement.", y);
    y = bullet(doc, "Le client conserve son numero et ses donnees pendant une periode de grace de quatre-vingt-dix (90) jours apres suspension. Apres 90 jours, le numero peut devenir irrecuperable.", y);
    y = bullet(doc, "Exception - Litiges et retrofacturations : en cas de chargeback ou fraude, des interets de 5 % par mois et des frais de reactivation de 15,00 $ plus taxes applicables (TPS/TVQ) s'appliquent. Le client doit contacter Nivra AVANT d'initier un litige bancaire ; toute retrofacturation abusive entraine la suspension immediate du service et des poursuites legales.", y);
    y += 2;

    y = subSection(doc, "7", "Resiliation", y);
    y = bullet(doc, "Le client peut resilier a tout moment via le portail client ou en contactant le service a la clientele.", y);
    y = bullet(doc, "Le service reste actif jusqu'a la fin du cycle prepaye en cours.", y);
    y = bullet(doc, "Aucun remboursement partiel n'est accorde pour les jours non utilises.", y);
    y = bullet(doc, "La portabilite du numero est disponible conformement aux directives du CRTC.", y);
    y = bullet(doc, "Nivra se reserve le droit de resilier immediatement le service en cas d'utilisation abusive, frauduleuse ou contraire aux presentes conditions.", y);
    y += 2;

    y = subSection(doc, "8", "Equipement", y);
    y = bullet(doc, "L'equipement fourni par Nivra (routeur, terminal TV, camera, etc.) est vendu au client comme frais unique ; il devient sa propriete apres paiement.", y);
    y = bullet(doc, "Le client est responsable de l'utilisation et de l'entretien de l'equipement.", y);
    y = bullet(doc, "Garantie fabricant : douze (12) mois a compter de la date d'activation. Perte, vol et dommages causes par le client sont exclus.", y);
    y = bullet(doc, "En cas de resiliation, l'equipement n'a pas a etre retourne sauf s'il a ete fourni en pret (indique explicitement sur la commande).", y);
    y += 2;

    y = subSection(doc, "9", "Suspension pour non-paiement", y);
    y = bullet(doc, "En cas de non-paiement a la date d'echeance (jour de cycle), la facture devient en souffrance (J0). Apres cinq (5) jours (J+5), le service est automatiquement suspendu.", y);
    y = bullet(doc, "Entre J+5 et J+10, le client peut reactiver son service en reglant la facture en souffrance. Apres J+10, la facture est annulee et la reactivation necessite un nouveau paiement complet.", y);
    y = bullet(doc, "Des frais de reactivation de 15,00 $ peuvent s'appliquer.", y);
    y += 2;

    y = subSection(doc, "10", "Limitation de responsabilite", y);
    y = bullet(doc, "Nivra n'est pas responsable des dommages indirects, consequentiels, speciaux ou punitifs resultant de l'utilisation ou de l'impossibilite d'utiliser les services.", y);
    y = bullet(doc, "La responsabilite totale de Nivra est limitee au montant paye par le client pour le service specifique concerne, au cours des trois (3) derniers mois.", y);
    y = bullet(doc, "Nivra ne garantit pas une disponibilite de 100 % et n'est pas responsable des interruptions causees par des pannes reseau, catastrophes naturelles ou interventions de tiers.", y);
    y += 2;

    y = subSection(doc, "11", "Protection des renseignements personnels", y);
    y = bullet(doc, "Nivra protege les renseignements personnels conformement a la Loi 25 du Quebec et a la LPRPDE federale.", y);
    y = bullet(doc, "Les donnees sont collectees uniquement pour la fourniture des services, la facturation, le support et la prevention de la fraude. Aucune donnee n'est vendue a des tiers.", y);
    y += 2;

    y = subSection(doc, "12", "Loi applicable et resolution des differends", y);
    y = bullet(doc, "Ce contrat est regi par les lois de la province de Quebec et les lois federales du Canada applicables.", y);
    y = bullet(doc, "Tout litige sera soumis aux tribunaux competents du district judiciaire de Montreal.", y);
    y = bullet(doc, "Les dispositions de la Loi sur la protection du consommateur (Quebec) s'appliquent.", y);
    y = bullet(doc, "Pour toute plainte : contacter support@nivra-telecom.ca. Delai de reponse : quarante-huit (48) heures ouvrables. En dernier recours : Commission des plaintes relatives aux services de telecom-television (CPRST).", y);

    drawFooter(doc, 4);

    // ===================================================================
    // PAGE 5 — DECLARATION ET SIGNATURES
    // ===================================================================
    doc.addPage();
    drawHeader(doc, data.contract_number, "DECLARATION ET SIGNATURES", 5);
    y = 36;

    y = sectionTitle(doc, "Declaration et acceptation", y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...TEXT);
    doc.text("En signant ce contrat, le client declare et confirme :", 15, y);
    y += 5;

    const decl: Array<[string, string]> = [
      ["a", "Avoir lu et compris l'integralite des conditions generales et des modalites de service ci-dessus ;"],
      ["b", "Avoir verifie l'exactitude des informations personnelles, de l'adresse de service et du sommaire financier ;"],
      ["c", "Accepter les tarifs mensuels recurrents et les frais uniques indiques au sommaire financier ;"],
      ["d", "Comprendre que les services Nivra sont prepayes a renouvellement mensuel et qu'aucun service n'est fourni sans paiement confirme ;"],
      ["e", "Accepter que les factures sont exclusivement numeriques et accessibles via le portail client ;"],
      ["f", "Comprendre la politique de resiliation, de remboursement et de retour d'equipement ;"],
      ["g", "Accepter les conditions de prelevement automatique par carte de credit et les promotions applicables, le cas echeant."],
    ];
    for (const [ltr, txt] of decl) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(...BLUE);
      doc.text(`(${ltr})`, 19, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...TEXT);
      const lines = doc.splitTextToSize(txt, 165);
      for (let i = 0; i < lines.length; i++) {
        doc.text(lines[i], 28, y);
        y += 4;
      }
      y += 0.5;
    }
    y += 3;

    // Acceptance banner
    doc.setFillColor(230, 244, 234);
    doc.roundedRect(15, y, pw - 30, 12, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...GREEN_DARK);
    doc.text("ACCEPTATION DU CLIENT", 18, y + 4.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...TEXT);
    doc.text("La signature electronique ci-dessous vaut acceptation pleine et entiere du present contrat, conformement a la LCCJTI (Quebec).", 18, y + 9);
    y += 18;

    // Signature boxes (side by side)
    const sbW = (pw - 30 - 4) / 2;
    // Nivra box
    doc.setDrawColor(...BORDER);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(15, y, sbW, 42, 2, 2, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...NAVY);
    doc.text("POUR NIVRA TELECOM", 18, y + 5);
    // Script signature
    doc.setFont("times", "italic");
    doc.setFontSize(22);
    doc.setTextColor(...NAVY);
    doc.text("Nivra Telecom", 20, y + 20);
    // Flourish
    doc.setDrawColor(...NAVY);
    doc.setLineWidth(0.6);
    (doc as any).lines(
      [[25, 1.5], [20, -2], [15, 1.2]],
      20,
      y + 22.5,
      [1, 1],
      "S",
      false,
    );
    doc.setLineWidth(0.2);
    // Line
    doc.setDrawColor(140, 150, 160);
    doc.line(18, y + 28, 15 + sbW - 3, y + 28);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text("Signature autorisee", 18, y + 31);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...TEXT);
    doc.text(`Signe electroniquement le : ${fmtDate(data.contract_date)}`, 18, y + 36);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text(data.admin_signature_name || "Service client - Nivra Communications Inc.", 18, y + 40);

    // Client box
    const x2b = 19 + sbW;
    doc.setDrawColor(...BORDER);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(x2b, y, sbW, 42, 2, 2, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...NAVY);
    doc.text("POUR LE CLIENT", x2b + 3, y + 5);
    if (data.is_signed && data.signature_name) {
      doc.setFont("times", "italic");
      doc.setFontSize(20);
      doc.setTextColor(...NAVY);
      doc.text(data.signature_name, x2b + 5, y + 20);
    }
    doc.setDrawColor(140, 150, 160);
    doc.line(x2b + 3, y + 28, x2b + sbW - 3, y + 28);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text("Signature du client", x2b + 3, y + 31);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...TEXT);
    if (data.is_signed) {
      doc.text(`Date : ${fmtDate(data.signature_date)}`, x2b + 3, y + 36);
      if (data.signature_ip) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(...MUTED);
        doc.text(`IP : ${data.signature_ip}`, x2b + 3, y + 40);
      }
    } else {
      doc.text("Date : En attente de signature du client", x2b + 3, y + 36);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(...MUTED);
      doc.text(data.client_name || "—", x2b + 3, y + 40);
    }

    drawFooter(doc, 5);

    const blob = doc.output("blob");
    // Sanitize filename with client name and contract number
    const safeName = (data.client_name || "Client").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "");
    const ym = (data.contract_date || "").slice(0, 7) || "";
    const filename = `Contrat_${safeName}_${data.contract_number}${ym ? `_${ym}` : ""}.pdf`;
    return {
      success: true,
      blob,
      filename,
    };
  } catch (error) {
    console.error("[ContractV6] Generation error:", error);
    return { success: false, error: (error as any)?.message || "Erreur de generation" };
  }
}

export default generateContractV3PDF;
