/**
 * Nivra Order Summary Template V3 — TELUS-Grade
 * 
 * Professional order summary matching carrier standards.
 * Uses NIVRA company info from companyInfo.ts (single source of truth).
 * Multi-service sections, proper totals, no N/A.
 */

import jsPDF from "jspdf";
import type { PDFGenerationResult } from "./types";
import { NIVRA, TAX, PDF_THEME } from "./companyInfo";

const C = PDF_THEME;

// ============================================================================
// DATA INTERFACE
// ============================================================================

export interface OrderSummaryV3Data {
  order_number: string;
  order_date: string;
  order_status: string; // "pending" | "confirmed" | "processing" | "cancelled"

  // Client
  client_name: string;
  client_email: string;
  client_phone: string;
  client_dob?: string;
  service_address: string;
  billing_address?: string;
  delivery_method?: string;

  // Account
  account_number: string;

  // Services (multi-service, 1 section per type)
  services: Array<{
    type: string; // "Mobile" | "Internet" | "TV" | "Streaming"
    name: string;
    description?: string;
    monthly_price: number;
    addons?: string[];
    promo?: string;
    phone_number?: string; // for mobile
    activation_date?: string;
  }>;

  // Equipment (each on its own line)
  equipment: Array<{
    name: string;
    quantity: number;
    unit_price: number;
    serial?: string;
  }>;

  // One-time fees
  fees: Array<{
    label: string;
    amount: number;
  }>;

  // Totals (DB-calculated, PDF prints only)
  subtotal_monthly: number;
  subtotal_onetime: number;
  discount_amount: number;
  discount_label?: string;
  tax_gst: number;
  tax_qst: number;
  total_due: number;

  // Payment
  payment_method?: string;
  payment_status?: string;
  estimated_activation?: string;
}

// ============================================================================
// HELPERS
// ============================================================================

const fmt = (amount: number): string =>
  new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(amount || 0);

const fmtDate = (dateStr: string | undefined | null): string => {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("fr-CA", { year: "numeric", month: "long", day: "numeric" });
  } catch {
    return dateStr;
  }
};

const critical = (value: string | undefined | null, fieldName: string): string => {
  if (!value || value === "—" || value === "N/A" || value.trim() === "") {
    console.warn(`[OrderSummaryV3] Champ critique manquant: ${fieldName}`);
    return "Non fourni par le client";
  }
  return value;
};

const fmtStatus = (status: string): string => {
  const map: Record<string, string> = {
    pending: "En attente", confirmed: "Confirmée", processing: "En traitement",
    cancelled: "Annulée", paid: "Confirmée",
  };
  return map[status] || status;
};

const fmtPayMethod = (m: string | undefined): string => {
  if (!m) return "—";
  const map: Record<string, string> = {
    PayPal: "PayPal", paypal: "PayPal", Interac: "Virement Interac",
    interac: "Virement Interac", e_transfer: "Virement Interac",
    card: "Carte de crédit", "Credit Card": "Carte de crédit",
  };
  return map[m] || m;
};

// ============================================================================
// PAGE COMPONENTS
// ============================================================================

function drawHeader(doc: jsPDF) {
  const pw = doc.internal.pageSize.getWidth();
  doc.setFillColor(...C.navy);
  doc.rect(0, 0, pw, 32, "F");
  doc.setFillColor(...C.teal);
  doc.rect(0, 32, pw, 2, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...C.white);
  doc.text(NIVRA.legalName, 15, 12);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(180, 190, 210);
  doc.text(NIVRA.division, 15, 18);
  doc.text(NIVRA.tagline, 15, 23);
  doc.text(`${NIVRA.address} | ${NIVRA.email}`, 15, 28);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...C.teal);
  doc.text("SOMMAIRE DE COMMANDE", pw - 15, 14, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(160, 170, 190);
  doc.text(`NEQ: ${NIVRA.neq} | ${NIVRA.tpsLabel} | ${NIVRA.tvqLabel}`, pw - 15, 22, { align: "right" });
}

function drawFooter(doc: jsPDF, pageNum: number, totalPages: number) {
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  doc.setFillColor(...C.navy);
  doc.rect(0, ph - 16, pw, 16, "F");
  doc.setFillColor(...C.teal);
  doc.rect(0, ph - 16, pw, 1.5, "F");
  doc.setTextColor(...C.white);
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "normal");
  doc.text(`${NIVRA.legalName} — ${NIVRA.address}`, pw / 2, ph - 10, { align: "center" });
  doc.text(`NEQ: ${NIVRA.neq} | ${NIVRA.tpsLabel} | ${NIVRA.tvqLabel}`, pw / 2, ph - 6, { align: "center" });
  doc.setFontSize(7);
  doc.text(`Page ${pageNum} / ${totalPages}`, pw - 15, ph - 8, { align: "right" });
}

function sectionTitle(doc: jsPDF, title: string, y: number, m: number, cw: number): number {
  doc.setFillColor(...C.lightBg);
  doc.rect(m, y, cw, 7, "F");
  doc.setFillColor(...C.teal);
  doc.rect(m, y, 3, 7, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...C.navy);
  doc.text(title, m + 7, y + 5);
  return y + 10;
}

// ============================================================================
// MAIN GENERATOR
// ============================================================================

export function generateOrderSummaryPDF(data: OrderSummaryV3Data): PDFGenerationResult;
export function generateOrderSummaryPDF(data: any): PDFGenerationResult;
export function generateOrderSummaryPDF(data: any): PDFGenerationResult {
  try {
    // Support legacy format
    const d: OrderSummaryV3Data = data.services && !Array.isArray(data.services?.[0]?.type !== undefined ? data.services : [])
      ? data
      : convertLegacyData(data);

    if (!d.order_number) return { success: false, error: "Numéro de commande manquant" };
    if (!d.client_name || !d.client_email) return { success: false, error: "Informations client incomplètes" };

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pw = doc.internal.pageSize.getWidth();
    const m = 15;
    const cw = pw - m * 2;

    doc.setFillColor(...C.white);
    doc.rect(0, 0, pw, doc.internal.pageSize.getHeight(), "F");

    drawHeader(doc);
    let y = 40;

    // === ORDER BANNER ===
    doc.setFillColor(...C.blue);
    doc.roundedRect(m, y, cw, 18, 2, 2, "F");
    doc.setTextColor(...C.white);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(`Commande #${d.order_number}`, m + 5, y + 8);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Date: ${fmtDate(d.order_date)} | Statut: ${fmtStatus(d.order_status || "pending")}`, m + 5, y + 14);
    if (d.delivery_method) {
      doc.text(`Livraison: ${d.delivery_method}`, pw - m - 5, y + 14, { align: "right" });
    }
    y += 24;

    // === CLIENT INFO (2-column) ===
    y = sectionTitle(doc, "INFORMATIONS CLIENT", y, m, cw);
    const colW = (cw - 8) / 2;

    doc.setFillColor(...C.lightBg);
    doc.roundedRect(m, y, colW, 38, 2, 2, "F");
    doc.setFillColor(...C.teal);
    doc.rect(m, y, 3, 38, "F");

    let ly = y + 7;
    const drawClientField = (label: string, value: string) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(...C.textMuted);
      doc.text(label, m + 7, ly);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...C.text);
      doc.text(value.substring(0, 32), m + 30, ly);
      ly += 6;
    };

    drawClientField("Nom", critical(d.client_name, "client_name"));
    drawClientField("Courriel", critical(d.client_email, "client_email"));
    drawClientField("Téléphone", critical(d.client_phone, "client_phone"));
    if (d.client_dob) drawClientField("Naissance", fmtDate(d.client_dob));
    drawClientField("Compte #", critical(d.account_number, "account_number"));

    // Right column: addresses
    const rx = m + colW + 8;
    doc.setFillColor(...C.lightBg);
    doc.roundedRect(rx, y, colW, 38, 2, 2, "F");
    doc.setFillColor(...C.blue);
    doc.rect(rx, y, 3, 38, "F");

    let ry = y + 7;
    const drawAddrField = (label: string, value: string) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(...C.textMuted);
      doc.text(label, rx + 7, ry);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...C.text);
      const lines = doc.splitTextToSize(value, colW - 14);
      doc.text(lines.slice(0, 2), rx + 7, ry + 4);
      ry += 4 + Math.min(lines.length, 2) * 4 + 2;
    };

    drawAddrField("Adresse service", critical(d.service_address, "service_address"));
    if (d.billing_address && d.billing_address !== d.service_address) {
      drawAddrField("Adresse facturation", d.billing_address);
    }
    if (d.estimated_activation) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(...C.textMuted);
      doc.text("Activation prévue", rx + 7, ry);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...C.success);
      doc.text(fmtDate(d.estimated_activation), rx + 7, ry + 5);
    }

    y += 44;

    // === SERVICES (1 section per type) ===
    if (d.services.length > 0) {
      y = sectionTitle(doc, "SERVICES COMMANDÉS", y, m, cw);

      // Table header
      doc.setFillColor(...C.navy);
      doc.rect(m, y, cw, 7, "F");
      doc.setTextColor(...C.white);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.text("TYPE", m + 3, y + 5);
      doc.text("PLAN / DESCRIPTION", m + 28, y + 5);
      doc.text("MENSUEL", pw - m - 3, y + 5, { align: "right" });
      y += 9;

      d.services.forEach((svc, i) => {
        if (i % 2 === 0) {
          doc.setFillColor(250, 250, 252);
          doc.rect(m, y - 1, cw, 8, "F");
        }
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(...C.teal);
        doc.text(svc.type.toUpperCase(), m + 3, y + 4);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(...C.text);
        const desc = svc.name + (svc.description ? ` — ${svc.description}` : "");
        doc.text(desc.substring(0, 50), m + 28, y + 4);
        doc.setFont("helvetica", "bold");
        doc.text(fmt(svc.monthly_price), pw - m - 3, y + 4, { align: "right" });
        y += 8;

        // Addons, promo, phone number
        if (svc.addons && svc.addons.length > 0) {
          doc.setFontSize(6.5);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(...C.textMuted);
          doc.text(`  Options: ${svc.addons.join(", ")}`, m + 28, y + 2);
          y += 5;
        }
        if (svc.promo) {
          doc.setFontSize(6.5);
          doc.setTextColor(...C.success);
          doc.text(`  Promo: ${svc.promo}`, m + 28, y + 2);
          y += 5;
        }
        if (svc.phone_number) {
          doc.setFontSize(6.5);
          doc.setTextColor(...C.textMuted);
          doc.text(`  Numéro: ${svc.phone_number}`, m + 28, y + 2);
          y += 5;
        }
      });
      y += 3;
    }

    // === EQUIPMENT ===
    if (d.equipment.length > 0) {
      y = sectionTitle(doc, "ÉQUIPEMENTS", y, m, cw);
      d.equipment.forEach((eq, i) => {
        if (i % 2 === 0) {
          doc.setFillColor(250, 250, 252);
          doc.rect(m, y - 1, cw, 7, "F");
        }
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(...C.text);
        doc.text(eq.name + (eq.serial ? ` (S/N: ${eq.serial})` : ""), m + 5, y + 4);
        doc.text(`${eq.quantity}x`, m + 110, y + 4);
        doc.setFont("helvetica", "bold");
        doc.text(fmt(eq.unit_price * eq.quantity), pw - m - 3, y + 4, { align: "right" });
        y += 7;
      });
      y += 3;
    }

    // === ONE-TIME FEES ===
    if (d.fees.length > 0) {
      y = sectionTitle(doc, "FRAIS UNIQUES", y, m, cw);
      d.fees.forEach((fee) => {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(...C.text);
        doc.text(fee.label, m + 5, y + 4);
        doc.setFont("helvetica", "bold");
        doc.text(fmt(fee.amount), pw - m - 3, y + 4, { align: "right" });
        y += 7;
      });
      y += 3;
    }

    // === TOTALS ===
    y += 5;
    const totW = 85;
    const tx = m + cw - totW;

    const drawTotalLine = (label: string, value: string, opts: { bold?: boolean; bg?: [number, number, number]; textColor?: [number, number, number] } = {}) => {
      if (opts.bg) {
        doc.setFillColor(...opts.bg);
        doc.roundedRect(tx - 3, y - 2, totW + 6, 9, 1, 1, "F");
        doc.setTextColor(...(opts.textColor || C.white));
      } else {
        doc.setTextColor(...(opts.textColor || C.text));
      }
      doc.setFont("helvetica", opts.bold ? "bold" : "normal");
      doc.setFontSize(9);
      doc.text(label, tx, y + 4);
      doc.text(value, tx + totW, y + 4, { align: "right" });
      y += opts.bg ? 12 : 6;
    };

    if (d.subtotal_monthly > 0) drawTotalLine("Mensuel récurrent", fmt(d.subtotal_monthly));
    if (d.subtotal_onetime > 0) drawTotalLine("Frais uniques", fmt(d.subtotal_onetime));
    if (d.discount_amount > 0) drawTotalLine(d.discount_label || "Rabais", `- ${fmt(d.discount_amount)}`, { textColor: C.success });
    drawTotalLine(TAX.GST_LABEL, fmt(d.tax_gst));
    drawTotalLine(TAX.QST_LABEL, fmt(d.tax_qst));

    drawTotalLine("TOTAL À PAYER", fmt(d.total_due), { bold: true, bg: C.navy });

    // Payment method
    if (d.payment_method) {
      y += 3;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...C.textMuted);
      doc.text(`Mode de paiement : ${fmtPayMethod(d.payment_method)}`, tx, y);
    }

    drawFooter(doc, 1, 1);

    const blob = doc.output("blob");
    const filename = `Sommaire-${d.order_number}.pdf`;
    return { success: true, blob, filename };
  } catch (error) {
    console.error("[OrderSummaryV3] Generation error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Erreur inconnue" };
  }
}

/** Convert legacy OrderSummaryData to V3 format */
function convertLegacyData(data: any): OrderSummaryV3Data {
  const services = (data.services || []).map((s: any) => ({
    type: s.service_type || "Service",
    name: s.service_description || s.service_type || "Service",
    monthly_price: s.service_total || s.service_price || 0,
  }));

  const equipment = (data.items || []).map((item: any) => ({
    name: item.item_name || "Équipement",
    quantity: item.qty || 1,
    unit_price: item.unit_price || 0,
    serial: item.serial_number,
  }));

  return {
    order_number: data.order_number || "—",
    order_date: data.order_date || "",
    order_status: data.payment_status || "pending",
    client_name: data.client_name || "Non fourni par le client",
    client_email: data.client_email || "Non fourni par le client",
    client_phone: data.client_phone || "Non fourni par le client",
    service_address: data.service_address || "Non fourni par le client",
    billing_address: data.billing_address,
    account_number: data.account_number || "Non fourni par le client",
    services,
    equipment,
    fees: [],
    subtotal_monthly: data.subtotal_services || 0,
    subtotal_onetime: data.subtotal_equipment || 0,
    discount_amount: data.total_discounts || 0,
    discount_label: data.promo_description,
    tax_gst: data.tax_gst || 0,
    tax_qst: data.tax_qst || 0,
    total_due: data.total_due || 0,
    payment_method: data.payment_method,
    payment_status: data.payment_status,
    estimated_activation: data.estimated_activation,
  };
}

export default generateOrderSummaryPDF;
