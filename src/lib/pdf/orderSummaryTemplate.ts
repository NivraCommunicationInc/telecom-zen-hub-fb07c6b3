/**
 * Nivra Order Summary Template — DISTINCT Pre-Billing Document
 * 
 * This is NOT an invoice. It is a confirmation of what the customer ordered.
 * Visually distinct: blue/informational theme, card-based layout, no tax registration.
 * 
 * Layout:
 * ┌─────────────────────────────────────────────┐
 * │ BLUE HEADER: SOMMAIRE DE COMMANDE           │
 * ├─────────────────────────────────────────────┤
 * │ Order banner with status                     │
 * │ Client + delivery info (cards)               │
 * │ Services ordered (card list, not table)      │
 * │ Equipment + fees (compact)                   │
 * │ Estimated total (not formal invoice total)   │
 * │ Next steps / activation info                 │
 * ├─────────────────────────────────────────────┤
 * │ Compact footer                               │
 * └─────────────────────────────────────────────┘
 */

import jsPDF from "jspdf";
import type { PDFGenerationResult } from "./types";
import { NIVRA, PDF_THEME } from "./companyInfo";

const C = PDF_THEME;

// ============================================================================
// DATA INTERFACE
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
  }>;

  fees: Array<{
    label: string;
    amount: number;
  }>;

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
}

// ============================================================================
// HELPERS
// ============================================================================

const fmt = (amount: number): string =>
  new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(amount || 0);

const fmtDate = (dateStr: string | undefined | null): string => {
  if (!dateStr) return "—";
  try {
    const raw = String(dateStr).trim();

    // Robust parsing for Postgres timestamps (e.g. "2026-03-18 14:19:49.142036+00")
    const ymd = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (ymd) {
      const year = Number(ymd[1]);
      const monthIdx = Number(ymd[2]) - 1;
      const day = Number(ymd[3]);
      const safeDate = new Date(year, monthIdx, day);
      const month = safeDate.toLocaleString("fr-CA", { month: "long" });
      return `${day} ${month} ${year}`;
    }

    const normalized = raw
      .replace(" ", "T")
      .replace(/([+-]\d{2})$/, "$1:00");

    const date = new Date(normalized);
    if (isNaN(date.getTime())) return "—";

    const year = date.getFullYear();
    const month = date.toLocaleString("fr-CA", { month: "long" });
    const day = date.getDate();
    return `${day} ${month} ${year}`;
  } catch {
    return "—";
  }
};

const fmtStatus = (status: string): { label: string; color: [number, number, number] } => {
  const map: Record<string, { label: string; color: [number, number, number] }> = {
    pending: { label: "En attente de confirmation", color: [245, 158, 11] },
    confirmed: { label: "Commande confirmée", color: [22, 163, 74] },
    processing: { label: "En traitement", color: [59, 130, 246] },
    paid: { label: "Paiement reçu", color: [22, 163, 74] },
    cancelled: { label: "Annulée", color: [239, 68, 68] },
    completed: { label: "Complétée", color: [22, 163, 74] },
  };
  return map[status] || { label: status, color: [100, 116, 139] };
};

const fmtPayMethod = (m: string | undefined): string => {
  if (!m) return "—";
  const map: Record<string, string> = {
    PayPal: "PayPal", paypal: "PayPal", Interac: "Virement Interac",
    interac: "Virement Interac", e_transfer: "Virement Interac",
    card: "Carte de crédit", "Credit Card": "Carte de crédit", stripe: "Carte de crédit",
  };
  return map[m] || m;
};

/** Format address with proper casing and postal code spacing */
const fmtAddress = (addr: string): string => {
  if (!addr) return "—";

  let result = addr.trim().replace(/\s+/g, " ");
  const cityFixes: Record<string, string> = {
    "saint jerome": "Saint-Jérôme",
    "saint-jerome": "Saint-Jérôme",
    "saint-j erome": "Saint-Jérôme",
    "st jerome": "Saint-Jérôme",
    "st-jerome": "Saint-Jérôme",
  };

  for (const [key, val] of Object.entries(cityFixes)) {
    const re = new RegExp(key, "gi");
    result = result.replace(re, val);
  }

  // Fix postal code spacing: "J7Z6Z3" -> "J7Z 6Z3"
  result = result.replace(/([A-Z]\d[A-Z])\s*(\d[A-Z]\d)/gi, "$1 $2");
  return result;
};

// ============================================================================
// MAIN GENERATOR
// ============================================================================

export function generateOrderSummaryPDF(data: OrderSummaryV3Data): PDFGenerationResult;
export function generateOrderSummaryPDF(data: any): PDFGenerationResult;
export function generateOrderSummaryPDF(data: any): PDFGenerationResult {
  try {
    const d: OrderSummaryV3Data = data.services && Array.isArray(data.services) && data.services.length > 0 && data.services[0].type !== undefined
      ? data
      : convertLegacyData(data);

    if (!d.order_number) return { success: false, error: "Numéro de commande manquant" };
    if (!d.client_name || !d.client_email) return { success: false, error: "Informations client incomplètes" };

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const m = 15;
    const cw = pw - m * 2;

    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, pw, ph, "F");

    // ========================================================================
    // BLUE HEADER — distinct from invoice (navy) and receipt (green)
    // ========================================================================
    doc.setFillColor(37, 99, 235); // vivid blue
    doc.rect(0, 0, pw, 34, "F");
    doc.setFillColor(96, 165, 250); // lighter blue accent
    doc.rect(0, 34, pw, 2, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text("NIVRA TELECOM", m, 14);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(191, 219, 254);
    doc.text("Confirmation de votre commande", m, 21);
    doc.text(`${NIVRA.email} | ${NIVRA.website}`, m, 27);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text("SOMMAIRE DE COMMANDE", pw - m, 14, { align: "right" });

    let y = 44;

    // ========================================================================
    // ORDER BANNER with status
    // ========================================================================
    const status = fmtStatus(d.order_status || "pending");

    doc.setFillColor(...C.lightBg);
    doc.roundedRect(m, y, cw, 22, 3, 3, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...C.navy);
    doc.text(`Commande #${d.order_number}`, m + 8, y + 9);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...C.textMuted);
    doc.text(`Passée le ${fmtDate(d.order_date)}`, m + 8, y + 16);

    // Status pill
    const pillW = doc.getTextWidth(status.label) + 12;
    doc.setFillColor(...status.color);
    doc.roundedRect(pw - m - pillW - 4, y + 5, pillW, 8, 4, 4, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);
    doc.text(status.label.toUpperCase(), pw - m - pillW / 2 - 4 + 6, y + 10.5, { align: "center" });

    y += 28;

    // ========================================================================
    // CLIENT + DELIVERY INFO — two cards side by side
    // ========================================================================
    const colW = (cw - 6) / 2;

    // Left: Client info
    doc.setFillColor(239, 246, 255); // blue-50
    doc.setDrawColor(191, 219, 254);
    doc.setLineWidth(0.3);
    doc.roundedRect(m, y, colW, 40, 2, 2, "FD");
    doc.setLineWidth(0.2);

    let ly = y + 7;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(37, 99, 235);
    doc.text("VOS INFORMATIONS", m + 6, ly);
    ly += 6;

    const drawField = (label: string, value: string) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(...C.textMuted);
      doc.text(label, m + 6, ly);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...C.text);
      doc.text((value || "—").substring(0, 30), m + 6, ly + 4);
      ly += 9;
    };

    drawField("Nom", d.client_name);
    drawField("Courriel", d.client_email);
    drawField("Compte", d.account_number);

    // Right: Delivery info
    const rx = m + colW + 6;
    doc.setFillColor(239, 246, 255);
    doc.setDrawColor(191, 219, 254);
    doc.setLineWidth(0.3);
    doc.roundedRect(rx, y, colW, 40, 2, 2, "FD");
    doc.setLineWidth(0.2);

    let ry = y + 7;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(37, 99, 235);
    doc.text("LIVRAISON & ACTIVATION", rx + 6, ry);
    ry += 6;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...C.textMuted);
    doc.text("Adresse de service", rx + 6, ry);
    doc.setFontSize(7.5);
    doc.setTextColor(...C.text);
    const formattedAddress = fmtAddress(d.service_address || "—");
    const addressParts = formattedAddress.split(",").map((p) => p.trim()).filter(Boolean);
    const addressLine1 = addressParts[0] || formattedAddress;
    const addressLine2 = addressParts.length > 1 ? addressParts.slice(1).join(", ") : "";

    const addrLines = [
      ...doc.splitTextToSize(addressLine1, colW - 14),
      ...(addressLine2 ? doc.splitTextToSize(addressLine2, colW - 14) : []),
    ];

    doc.text(addrLines.slice(0, 2), rx + 6, ry + 4);
    ry += 4 + Math.min(addrLines.length, 2) * 4;

    if (d.delivery_method) {
      doc.setFontSize(7);
      doc.setTextColor(...C.textMuted);
      doc.text("Mode", rx + 6, ry + 2);
      doc.setFontSize(7.5);
      doc.setTextColor(...C.text);
      doc.text(d.delivery_method, rx + 6, ry + 6);
      ry += 10;
    }

    if (d.estimated_activation) {
      doc.setFontSize(7);
      doc.setTextColor(...C.textMuted);
      doc.text("Activation prévue", rx + 6, ry + 2);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(22, 163, 74);
      doc.text(fmtDate(d.estimated_activation), rx + 6, ry + 6);
    }

    y += 46;

    // ========================================================================
    // SERVICES — card-based layout (NOT table — visually distinct from invoice)
    // ========================================================================
    if (d.services.length > 0) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(37, 99, 235);
      doc.text("Ce que vous avez commandé", m, y + 4);
      y += 10;

      d.services.forEach((svc) => {
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.roundedRect(m, y, cw, 16, 2, 2, "FD");
        doc.setLineWidth(0.2);

        // Service type badge
        doc.setFillColor(37, 99, 235);
        doc.roundedRect(m + 4, y + 3, 22, 5, 1, 1, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(6);
        doc.setTextColor(255, 255, 255);
        doc.text(svc.type.toUpperCase(), m + 15, y + 6.5, { align: "center" });

        // Service name
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(...C.navy);
        doc.text(svc.name, m + 30, y + 7);

        // Price
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(37, 99, 235);
        doc.text(`${fmt(svc.monthly_price)}/mois`, pw - m - 4, y + 7, { align: "right" });

        // Promo badge if applicable
        if (svc.promo) {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(6.5);
          doc.setTextColor(22, 163, 74);
          doc.text(`★ ${svc.promo}`, m + 30, y + 12);
        }

        y += 19;
      });
    }

    // ========================================================================
    // EQUIPMENT + FEES — compact list
    // ========================================================================
    if (d.equipment.length > 0 || d.fees.length > 0) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(...C.navy);
      doc.text("Équipements et frais", m, y + 4);
      y += 8;

      d.equipment.forEach((eq) => {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(...C.text);
        doc.text(`• ${eq.name}${eq.quantity > 1 ? ` (×${eq.quantity})` : ""}`, m + 4, y + 3);
        doc.setFont("helvetica", "bold");
        doc.text(fmt(eq.unit_price * eq.quantity), pw - m - 4, y + 3, { align: "right" });
        y += 6;
      });

      d.fees.forEach((fee) => {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(...C.text);
        doc.text(`• ${fee.label}`, m + 4, y + 3);
        doc.setFont("helvetica", "bold");
        doc.text(fmt(fee.amount), pw - m - 4, y + 3, { align: "right" });
        y += 6;
      });

      y += 4;
    }

    // ========================================================================
    // ESTIMATED TOTAL — NOT a formal invoice total
    // ========================================================================
    y += 4;
    doc.setFillColor(37, 99, 235);
    doc.roundedRect(pw / 2, y, pw / 2 - m, 32, 3, 3, "F");

    let ty = y + 8;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(191, 219, 254);

    if (d.subtotal_monthly > 0) {
      doc.text("Services mensuels", pw / 2 + 8, ty);
      doc.text(fmt(d.subtotal_monthly), pw - m - 8, ty, { align: "right" });
      ty += 5;
    }
    if (d.subtotal_onetime > 0) {
      doc.text("Frais uniques", pw / 2 + 8, ty);
      doc.text(fmt(d.subtotal_onetime), pw - m - 8, ty, { align: "right" });
      ty += 5;
    }
    if (d.discount_amount > 0) {
      doc.setTextColor(134, 239, 172);
      doc.text(d.discount_label || "Rabais", pw / 2 + 8, ty);
      doc.text(`- ${fmt(d.discount_amount)}`, pw - m - 8, ty, { align: "right" });
      doc.setTextColor(191, 219, 254);
      ty += 5;
    }

    // Total line
    doc.setDrawColor(96, 165, 250);
    doc.line(pw / 2 + 8, ty - 1, pw - m - 8, ty - 1);
    ty += 3;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text("Total estimé (taxes incl.)", pw / 2 + 8, ty + 1);
    doc.text(fmt(d.total_due), pw - m - 8, ty + 1, { align: "right" });

    y += 38;

    // Payment method note
    if (d.payment_method) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...C.textMuted);
      doc.text(`Mode de paiement choisi : ${fmtPayMethod(d.payment_method)}`, m, y);
      y += 6;
    }

    // ========================================================================
    // NEXT STEPS — informational, distinct from invoice
    // ========================================================================
    y += 4;
    doc.setFillColor(254, 252, 232); // yellow-50
    doc.setDrawColor(253, 224, 71); // yellow-300
    doc.setLineWidth(0.3);
    doc.roundedRect(m, y, cw, 34, 2, 2, "FD");
    doc.setLineWidth(0.2);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(161, 98, 7);
    doc.text("PROCHAINES ETAPES", m + 6, y + 7);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(120, 83, 9);
    doc.text("1. Confirmation de paiement", m + 6, y + 14);
    doc.text("2. Activation du service", m + 6, y + 19);
    doc.text("3. Vous recevrez votre facture officielle et votre contrat", m + 6, y + 24);
    doc.text(`Pour toute question : ${NIVRA.email}`, m + 6, y + 30);

    // ========================================================================
    // COMPACT BLUE FOOTER
    // ========================================================================
    doc.setFillColor(37, 99, 235);
    doc.rect(0, ph - 14, pw, 14, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.text(`${NIVRA.legalName} — ${NIVRA.address}`, pw / 2, ph - 9, { align: "center" });
    doc.text(`Ce sommaire est un document informatif et ne constitue pas une facture.`, pw / 2, ph - 5, { align: "center" });

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
