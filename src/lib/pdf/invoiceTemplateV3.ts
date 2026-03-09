/**
 * Nivra Invoice Template V3.0 — TELUS-Grade
 * 
 * Unified template for both MONTHLY and ONETIME invoices.
 * Matches Canadian telecom operator standards (TELUS/Bell/Rogers style).
 * 
 * Layout:
 * ┌─────────────────────────────────────────────┐
 * │ NAVY HEADER: NIVRA COMMUNICATIONS INC.      │
 * │ Teal accent bar                              │
 * ├─────────────────────────────────────────────┤
 * │ [FACTURÉ À]          [DÉTAILS FACTURE]      │
 * │  Client info           Account#, Invoice#   │
 * │  Billing addr          Order#, Dates        │
 * │  Service addr          Status               │
 * ├─────────────────────────────────────────────┤
 * │ DÉTAIL DES SERVICES                         │
 * │ ┌──────┬──────────┬────┬──────┬──────┐     │
 * │ │Desc  │ Période  │Qté │P.U.  │Total │     │
 * │ ├──────┼──────────┼────┼──────┼──────┤     │
 * │ │...   │          │    │      │      │     │
 * │ └──────┴──────────┴────┴──────┴──────┘     │
 * ├─────────────────────────────────────────────┤
 * │                    Sous-total    XXX.XX $   │
 * │                    TPS (5%)       XX.XX $   │
 * │                    TVQ (9.975%)   XX.XX $   │
 * │                    ████████████████████████ │
 * │                    █ TOTAL DÛ    XXX.XX $ █ │
 * │                    ████████████████████████ │
 * ├─────────────────────────────────────────────┤
 * │ REÇU DE PAIEMENT / INSTRUCTIONS PAIEMENT   │
 * ├─────────────────────────────────────────────┤
 * │ NAVY FOOTER: Legal, NEQ, TPS, TVQ          │
 * └─────────────────────────────────────────────┘
 */

import jsPDF from "jspdf";
import type { InvoiceDataV2, PDFGenerationResult } from "./types";
import { NIVRA, TAX, PDF_THEME } from "./companyInfo";
import {
  assertPrintableText,
  sanitizeCustomerData,
  sanitizePaymentData,
  sanitizeDescription,
} from "./pdfTextSanitizer";

// ============================================================================
// HELPERS
// ============================================================================

const C = PDF_THEME;

const fmt = (amount: number): string => {
  return new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD", minimumFractionDigits: 2 }).format(amount || 0);
};

/** For critical fields that MUST be present on the document */
const critical = (value: string | undefined | null, fieldName: string): string => {
  if (!value || value === "—" || value === "N/A" || value.trim() === "") {
    console.warn(`[InvoiceV3] Champ critique manquant: ${fieldName}`);
    return "Non fourni par le client";
  }
  return value;
};

const fmtDate = (dateStr: string | undefined | null): string => {
  if (!dateStr) return "—";
  if (dateStr.includes("DATE_") || dateStr.includes("PERIODE")) return dateStr;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-CA", { year: "numeric", month: "long", day: "numeric" });
};

const fmtShortDate = (dateStr: string | undefined | null): string => {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-CA", { year: "numeric", month: "2-digit", day: "2-digit" });
};

const fmtStatus = (status: string): string => {
  const map: Record<string, string> = {
    paid: "Payée", Paid: "Payée",
    paid_by_promo: "Payée (promo)", 
    pending: "En attente", Pending: "En attente",
    unpaid: "Non payée", Unpaid: "Non payée",
    partially_paid: "Partiellement payée",
    Issued: "Émise", cancelled: "Annulée", Cancelled: "Annulée",
    expired: "Expirée", Expired: "Expirée", void: "Annulée",
    overdue: "Renouvellement requis", not_renewed: "Non renouvelée",
  };
  return map[status] || status;
};

const fmtPayMethod = (m: string): string => {
  const map: Record<string, string> = {
    PayPal: "PayPal", paypal: "PayPal", Interac: "Virement Interac",
    interac: "Virement Interac", e_transfer: "Virement Interac",
    "Credit Card": "Carte de crédit", card: "Carte de crédit",
    cash: "Comptant", Manual: "Manuel",
  };
  return map[m] || m;
};

// ============================================================================
// PAGE HELPERS
// ============================================================================

function drawNivraHeader(doc: jsPDF, docType: string) {
  const pw = doc.internal.pageSize.getWidth();

  // Navy header
  doc.setFillColor(...C.navy);
  doc.rect(0, 0, pw, 32, "F");

  // Teal accent line
  doc.setFillColor(...C.teal);
  doc.rect(0, 32, pw, 2, "F");

  // Company name
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...C.white);
  doc.text(NIVRA.legalName, 15, 12);

  // Division
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(180, 190, 210);
  doc.text(NIVRA.division, 15, 18);
  doc.text(NIVRA.tagline, 15, 23);
  doc.text(`${NIVRA.address} | ${NIVRA.email}`, 15, 28);

  // Document type badge
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...C.teal);
  doc.text(docType, pw - 15, 14, { align: "right" });

  // NEQ line
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(160, 170, 190);
  doc.text(`NEQ: ${NIVRA.neq} | ${NIVRA.tpsLabel} | ${NIVRA.tvqLabel}`, pw - 15, 22, { align: "right" });
}

function drawNivraFooter(doc: jsPDF, pageNum: number, totalPages: number) {
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const footerH = 38;
  const footerY = ph - footerH;

  // Navy footer bar
  doc.setFillColor(...C.navy);
  doc.rect(0, footerY, pw, footerH, "F");

  // Teal accent on top
  doc.setFillColor(...C.teal);
  doc.rect(0, footerY, pw, 1.5, "F");

  doc.setTextColor(...C.white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("POLITIQUE DE FACTURATION PRÉPAYÉE", 15, footerY + 6);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.5);

  const lines = [
    "Le cycle de facturation commence à la date de confirmation du paiement (Interac/PayPal/Carte). Les services sont facturés à l'avance.",
    "Le paiement doit être confirmé AVANT la date de cycle (J0). Si non payé à J0, le service n'est pas renouvelé (Expiré).",
    "Aucun intérêt ni frais de réactivation pour non-renouvellement normal. Après 90 jours, le numéro peut devenir irrécupérable.",
    "Intérêt (5%/mois) + 15$ frais de réactivation s'appliquent UNIQUEMENT pour litiges bancaires/rétrofacturations.",
    "Garantie équipement: 12 mois fabricant dès activation. Perte/vol/dommages client exclus sauf approbation interne.",
  ];

  let ly = footerY + 11;
  lines.forEach(l => { doc.text(l, 15, ly); ly += 3.2; });

  // Page number
  doc.setFontSize(7);
  doc.text(`${NIVRA.legalName} — Page ${pageNum}/${totalPages}`, pw - 15, ph - 4, { align: "right" });
}

// ============================================================================
// MAIN GENERATOR V3
// ============================================================================

export function generateInvoiceV3PDF(data: InvoiceDataV2): PDFGenerationResult {
  try {
    // Validate
    if (!data.invoice_number) return { success: false, error: "Numéro de facture manquant" };
    if (!data.customer?.full_name || !data.customer?.email) return { success: false, error: "Informations client incomplètes" };
    if (!data.items || data.items.length === 0) return { success: false, error: "Aucun item à facturer" };

    const customer = sanitizeCustomerData(data.customer);
    const isMonthly = data.invoice_type === "MONTHLY";

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const m = 15;
    const cw = pw - m * 2;
    const footerH = 38;
    const maxY = ph - footerH - 5;

    // ========================================================================
    // PAGE 1: HEADER
    // ========================================================================
    drawNivraHeader(doc, "FACTURE");

    let y = 40;

    // ========================================================================
    // TWO-COLUMN: CLIENT INFO + INVOICE DETAILS
    // ========================================================================
    const colW = (cw - 8) / 2;
    const boxH = 65;

    // --- LEFT: Client Info ---
    doc.setFillColor(...C.lightBg);
    doc.roundedRect(m, y, colW, boxH, 2, 2, "F");
    doc.setFillColor(...C.teal);
    doc.rect(m, y, 3, boxH, "F");

    let ly = y + 8;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...C.navy);
    doc.text("FACTURÉ À", m + 7, ly);
    ly += 7;

    const drawField = (label: string, value: string, isCritical = false) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(...C.textMuted);
      doc.text(label, m + 7, ly);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...C.text);
      const displayVal = isCritical ? critical(value, label) : assertPrintableText(value || "—", label);
      doc.text(displayVal.substring(0, 35), m + 35, ly);
      ly += 5.5;
    };

    drawField("Nom", customer.full_name, true);
    drawField("Courriel", customer.email, true);
    drawField("Téléphone", customer.phone, true);

    // Billing address
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...C.textMuted);
    doc.text("Adresse fact.", m + 7, ly);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...C.text);
    const addr1 = critical(customer.address_line1, "address_line1");
    doc.text(addr1.substring(0, 35), m + 35, ly);
    ly += 4.5;
    const cityLine = `${critical(customer.city, "city")}, ${customer.province || "QC"} ${customer.postal_code || ""}`.trim();
    doc.text(cityLine.substring(0, 35), m + 35, ly);
    ly += 6;

    // Service address (if different)
    const serviceAddr = data.items[0]?.service_address;
    if (serviceAddr && serviceAddr !== addr1) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(...C.textMuted);
      doc.text("Adresse service", m + 7, ly);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...C.text);
      doc.text(assertPrintableText(serviceAddr, "service_address").substring(0, 35), m + 35, ly);
    }

    // --- RIGHT: Invoice Details ---
    const rx = m + colW + 8;
    doc.setFillColor(...C.lightBg);
    doc.roundedRect(rx, y, colW, boxH, 2, 2, "F");
    doc.setFillColor(...C.blue);
    doc.rect(rx, y, 3, boxH, "F");

    let ry = y + 8;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...C.navy);
    doc.text("DÉTAILS FACTURE", rx + 7, ry);
    ry += 7;

    const drawRightField = (label: string, value: string, highlight = false) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(...C.textMuted);
      doc.text(label, rx + 7, ry);
      doc.setFont("helvetica", highlight ? "bold" : "normal");
      doc.setFontSize(highlight ? 9 : 8);
      doc.setTextColor(...(highlight ? C.blue : C.text));
      doc.text(assertPrintableText(value || "—", label).substring(0, 25), rx + 42, ry);
      ry += 5.5;
    };

    drawRightField("N° compte", critical(data.account_number, "account_number"));
    drawRightField("N° facture", critical(data.invoice_number, "invoice_number"));

    // Order number (if available in items reference or data)
    const orderNum = (data as any).order_number || data.items[0]?.reference || "";
    if (orderNum) {
      drawRightField("N° commande", orderNum);
    }

    drawRightField("Émission", fmtDate(data.invoice_date));
    drawRightField("Échéance", fmtDate(data.due_date));

    if (isMonthly && data.billing_period_start && data.billing_period_end) {
      drawRightField("Période", `${fmtShortDate(data.billing_period_start)} → ${fmtShortDate(data.billing_period_end)}`);
    }

    // Status badge
    const statusLabel = fmtStatus(data.status);
    const isPaidStatus = data.status?.toLowerCase() === "paid";
    const isPartial = data.status?.toLowerCase() === "partially_paid";
    const badgeColor: [number, number, number] = isPaidStatus ? C.success : isPartial ? C.warning : C.error;
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...C.textMuted);
    doc.text("Statut", rx + 7, ry);
    // Draw status badge
    const badgeW = doc.getTextWidth(statusLabel) + 6;
    doc.setFillColor(...badgeColor);
    doc.roundedRect(rx + 42, ry - 3.5, badgeW, 5, 1, 1, "F");
    doc.setTextColor(...C.white);
    doc.setFontSize(7);
    doc.text(statusLabel, rx + 45, ry);
    ry += 5.5;

    drawRightField("Total dû", fmt(data.balance_due), true);

    y = y + boxH + 8;

    // ========================================================================
    // STRUCTURED SECTIONS — separate recurring, one-time, discounts
    // ========================================================================

    // Categorize items from canonical data (NO recalculation)
    const recurringItems = data.items.filter(i => i.is_recurring);
    const onetimeItems = data.items.filter(i => !i.is_recurring);

    // Helper: draw a section header with teal accent
    const drawSectionHeader = (title: string) => {
      if (y > maxY - 30) {
        drawNivraFooter(doc, 1, 2);
        doc.addPage();
        drawNivraHeader(doc, "FACTURE (suite)");
        y = 40;
      }
      doc.setFillColor(...C.lightBg);
      doc.rect(m, y, cw, 7, "F");
      doc.setFillColor(...C.teal);
      doc.rect(m, y, 3, 7, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(...C.navy);
      doc.text(title, m + 7, y + 5);
      y += 10;
    };

    // Helper: draw table header row
    const drawTableHeader = (periodLabel: string) => {
      doc.setFillColor(...C.navy);
      doc.rect(m, y, cw, 7, "F");
      doc.setTextColor(...C.white);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      const colDef = [
        { label: "Description", x: m + 3 },
        { label: periodLabel, x: m + 78 },
        { label: "Qté", x: m + 115 },
        { label: "P.U.", x: m + 129 },
        { label: "Montant", x: m + 153 },
      ];
      colDef.forEach(c => doc.text(c.label, c.x, y + 5));
      y += 9;
    };

    // Helper: draw an item row
    const drawItemRow = (item: typeof data.items[0], rowIndex: number, periodField: string) => {
      if (y > maxY - 20) {
        drawNivraFooter(doc, 1, 2);
        doc.addPage();
        drawNivraHeader(doc, "FACTURE (suite)");
        y = 40;
      }
      const rowH = item.reference ? 11 : 8;
      if (rowIndex % 2 === 0) {
        doc.setFillColor(250, 250, 252);
        doc.rect(m, y - 1, cw, rowH, "F");
      }
      const desc = sanitizeDescription(item.description);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...C.text);
      doc.text(desc.substring(0, 48), m + 3, y + 4);
      if (item.category) {
        doc.setFontSize(6);
        doc.setTextColor(...C.teal);
        doc.text(`[${item.category}]`, m + 3 + doc.getTextWidth(desc.substring(0, 48)) + 2, y + 4);
      }
      doc.setFontSize(7);
      doc.setTextColor(...C.textMuted);
      doc.text((periodField || "—").substring(0, 22), m + 78, y + 4);
      doc.setTextColor(...C.text);
      doc.setFontSize(8);
      doc.text(String(item.qty), m + 115, y + 4);
      doc.text(fmt(item.unit_price), m + 129, y + 4);
      doc.setFont("helvetica", "bold");
      doc.text(fmt(item.amount), m + 153, y + 4);
      if (item.reference && isMonthly) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6);
        doc.setTextColor(...C.textMuted);
        doc.text(`Réf.: ${assertPrintableText(item.reference, "ref")}`, m + 3, y + 8.5);
      }
      y += rowH;
    };

    // Helper: draw section subtotal line
    const drawSectionSubtotal = (label: string, amount: number) => {
      doc.setDrawColor(...C.border);
      doc.line(m, y, m + cw, y);
      y += 2;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...C.navy);
      doc.text(label, m + cw - 85, y + 4);
      doc.text(fmt(amount), m + cw - 2, y + 4, { align: "right" });
      y += 8;
    };

    // ────────────────────────────────────────────────────────────
    // SECTION 1: MONTHLY / RECURRING SERVICES
    // ────────────────────────────────────────────────────────────
    if (recurringItems.length > 0) {
      drawSectionHeader("SECTION A — SERVICES MENSUELS RÉCURRENTS");
      drawTableHeader("Période");
      recurringItems.forEach((item, i) => {
        const period = item.period || (data.billing_period_start && data.billing_period_end
          ? `${fmtShortDate(data.billing_period_start)} → ${fmtShortDate(data.billing_period_end)}`
          : "—");
        drawItemRow(item, i, period);
      });
      if (data.subtotal_monthly !== undefined) {
        drawSectionSubtotal("Sous-total services mensuels", data.subtotal_monthly);
      }
    }

    // ────────────────────────────────────────────────────────────
    // SECTION 2: ONE-TIME FEES (equipment, activation, delivery…)
    // ────────────────────────────────────────────────────────────
    if (onetimeItems.length > 0) {
      drawSectionHeader("SECTION B — FRAIS UNIQUES");
      drawTableHeader("Réf.");
      onetimeItems.forEach((item, i) => {
        drawItemRow(item, i, item.reference || "—");
      });
      if (data.subtotal_onetime !== undefined) {
        drawSectionSubtotal("Sous-total frais uniques", data.subtotal_onetime);
      }
    }

    // If no items at all (shouldn't happen but safety)
    if (recurringItems.length === 0 && onetimeItems.length === 0) {
      drawSectionHeader("DÉTAIL DES SERVICES ET FRAIS");
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(...C.textMuted);
      doc.text("Aucun item à facturer.", m + 7, y + 4);
      y += 10;
    }

    // ────────────────────────────────────────────────────────────
    // SECTION 3: PROMOTIONS / DISCOUNTS
    // ────────────────────────────────────────────────────────────
    if (data.discounts && data.discounts.length > 0) {
      drawSectionHeader("SECTION C — PROMOTIONS ET RABAIS");
      data.discounts.forEach((d, i) => {
        if (y > maxY - 15) {
          drawNivraFooter(doc, 1, 2);
          doc.addPage();
          drawNivraHeader(doc, "FACTURE (suite)");
          y = 40;
        }
        if (i % 2 === 0) {
          doc.setFillColor(250, 250, 252);
          doc.rect(m, y - 1, cw, 8, "F");
        }
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(...C.text);
        doc.text(assertPrintableText(d.label, "discount"), m + 3, y + 4);
        if (d.applies_to) {
          doc.setFontSize(6);
          doc.setTextColor(...C.textMuted);
          doc.text(`(sur ${d.applies_to})`, m + 3 + doc.getTextWidth(d.label) + 3, y + 4);
        }
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(...C.success);
        doc.text(`- ${fmt(d.amount)}`, m + cw - 2, y + 4, { align: "right" });
        y += 8;
      });
      y += 3;
    }

    // ────────────────────────────────────────────────────────────
    // SECTION 4 & 5: TAXES + TOTAL PROGRESSION
    // ────────────────────────────────────────────────────────────
    if (y > maxY - 55) {
      drawNivraFooter(doc, 1, 2);
      doc.addPage();
      drawNivraHeader(doc, "FACTURE (suite)");
      y = 40;
    }

    drawSectionHeader("SOMMAIRE FINANCIER");

    const totW = 90;
    const tx = m + cw - totW;

    const drawTotalLine = (label: string, value: string, opts: { bold?: boolean; bg?: [number, number, number]; textColor?: [number, number, number]; fontSize?: number; indent?: boolean } = {}) => {
      if (opts.bg) {
        doc.setFillColor(...opts.bg);
        doc.roundedRect(tx - 3, y - 2, totW + 6, 9, 1, 1, "F");
        doc.setTextColor(...(opts.textColor || C.white));
      } else {
        doc.setTextColor(...(opts.textColor || C.text));
      }
      doc.setFont("helvetica", opts.bold ? "bold" : "normal");
      doc.setFontSize(opts.fontSize || 9);
      const labelX = opts.indent ? tx + 6 : tx;
      doc.text(label, labelX, y + 4);
      doc.text(value, tx + totW, y + 4, { align: "right" });
      y += opts.bg ? 12 : 6.5;
    };

    // Show structured subtotals if available
    if (data.subtotal_monthly !== undefined && data.subtotal_monthly > 0) {
      drawTotalLine("Services mensuels", fmt(data.subtotal_monthly), { indent: true });
    }
    if (data.subtotal_onetime !== undefined && data.subtotal_onetime > 0) {
      drawTotalLine("Frais uniques", fmt(data.subtotal_onetime), { indent: true });
    }

    drawTotalLine("Sous-total", fmt(data.subtotal), { bold: true });

    // Discounts summary
    if (data.discounts && data.discounts.length > 0) {
      const totalDiscount = data.discounts.reduce((sum, d) => sum + d.amount, 0);
      drawTotalLine("Rabais / promotions", `- ${fmt(totalDiscount)}`, { textColor: C.success });
    }

    // Taxes — with name + percentage
    drawTotalLine(`TPS (${(data.taxes.gst_rate * 100).toFixed(0)}%)`, fmt(data.taxes.gst_amount));
    drawTotalLine(`TVQ (${(data.taxes.qst_rate * 100).toFixed(3).replace(".", ",")}%)`, fmt(data.taxes.qst_amount));

    drawTotalLine("Total facture", fmt(data.total), { bold: true });

    // ────────────────────────────────────────────────────────────
    // SECTION 6: PAYMENTS
    // ────────────────────────────────────────────────────────────
    if (data.payments && data.payments.length > 0) {
      const confirmedPayments = data.payments.filter(p =>
        ["Confirmed", "confirmed", "Captured", "captured", "completed"].includes(p.status)
      );
      if (confirmedPayments.length > 0) {
        confirmedPayments.forEach(p => {
          const pData = sanitizePaymentData(p);
          drawTotalLine(
            `Paiement (${fmtPayMethod(pData.method)})`,
            `- ${fmt(pData.paid_amount)}`,
            { textColor: C.success }
          );
        });
      }
    } else if (data.payments_total && data.payments_total > 0) {
      drawTotalLine("Paiements reçus", `- ${fmt(data.payments_total)}`, { textColor: C.success });
    }

    // BALANCE DUE — prominent box
    drawTotalLine("SOLDE À PAYER", fmt(data.balance_due), { bold: true, bg: C.navy, fontSize: 10 });

    // ========================================================================
    // PAYMENT SECTION
    // ========================================================================
    const isPaid = data.status?.toLowerCase() === "paid" || data.balance_due === 0;

    if (isPaid && data.payments && data.payments.length > 0) {
      const payment = sanitizePaymentData(data.payments[0]);

      // Green banner
      doc.setFillColor(...C.success);
      doc.roundedRect(m, y, cw, 7, 1, 1, "F");
      doc.setTextColor(...C.white);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text("✓ PAIEMENT CONFIRMÉ", m + 5, y + 5);
      y += 10;

      // Payment details box
      doc.setFillColor(...C.lightBg);
      doc.setDrawColor(...C.success);
      doc.setLineWidth(0.5);
      doc.roundedRect(m, y, cw, 22, 1, 1, "FD");
      doc.setLineWidth(0.2);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...C.text);
      doc.text(`Méthode: ${fmtPayMethod(payment.method)}`, m + 5, y + 6);
      doc.text(`Date: ${fmtDate(payment.paid_at)}`, m + 5, y + 12);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      const ref = payment.processor_txn_id !== "—" ? payment.processor_txn_id : payment.payment_reference;
      if (ref && ref !== "—") {
        doc.text(`Référence: ${ref}`, m + 5, y + 17);
      }

      doc.setFont("helvetica", "bold");
      doc.setTextColor(...C.success);
      doc.setFontSize(9);
      doc.text(`Montant confirmé: ${fmt(payment.paid_amount)}`, m + cw - 5, y + 12, { align: "right" });

      y += 26;
    } else {
      // Payment instructions — adapt to selected method
      doc.setFillColor(...C.lightBg);
      doc.rect(m, y, cw, 7, "F");
      doc.setFillColor(...C.teal);
      doc.rect(m, y, 3, 7, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(...C.navy);
      doc.text("INSTRUCTIONS DE PAIEMENT", m + 7, y + 5);
      y += 10;

      const selectedMethod = (data.payments?.[0]?.method || "").toLowerCase();
      const isPayPal = selectedMethod.includes("paypal");

      if (isPayPal) {
        // PayPal instructions
        doc.setFillColor(...C.lightBg);
        doc.roundedRect(m, y, cw, 18, 1, 1, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(...C.text);
        doc.text("PayPal", m + 5, y + 6);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.text("Procédez au paiement via le portail client Nivra ou le lien PayPal fourni par courriel.", m + 5, y + 12);
        doc.text(`Référence de commande : ${assertPrintableText(data.invoice_number, "invoice_number")}`, m + 5, y + 17);
        y += 22;
      } else {
        // Interac / default instructions
        doc.setFillColor(...C.lightBg);
        doc.roundedRect(m, y, cw, 24, 1, 1, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(...C.text);
        doc.text("Virement Interac (e-Transfer)", m + 5, y + 6);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.text(`Courriel: ${NIVRA.email}`, m + 5, y + 12);
        doc.text("Question secrète: Numéro de facture", m + 5, y + 17);
        doc.text(`Réponse: ${assertPrintableText(data.invoice_number, "invoice_number")}`, m + 5, y + 22);
        y += 28;
      }
    }

    // ========================================================================
    // FOOTER
    // ========================================================================
    drawNivraFooter(doc, 1, 1);

    // Generate
    const blob = doc.output("blob");
    const dateStr = data.invoice_date?.replace(/-/g, "") || "unknown";
    const filename = `Facture_${data.invoice_number}_${dateStr}.pdf`;

    return { success: true, blob, filename };
  } catch (error) {
    console.error("[InvoiceV3] Generation error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Erreur inconnue" };
  }
}

// Backward-compatible wrappers
export function generateInvoiceMonthlyV3PDF(data: InvoiceDataV2): PDFGenerationResult {
  return generateInvoiceV3PDF({ ...data, invoice_type: "MONTHLY" });
}

export function generateInvoiceOneTimeV3PDF(data: InvoiceDataV2): PDFGenerationResult {
  return generateInvoiceV3PDF({ ...data, invoice_type: "ONETIME" });
}

export default generateInvoiceV3PDF;
