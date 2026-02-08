/**
 * Nivra Invoice Monthly Template V2.4
 * Template professionnel style opérateur (Rogers/Telus/Bell)
 * 
 * Layout: A4/Letter printable
 * Design: Navy header (#0F172A), Teal accent (#14B8A6), clean grid layout
 */

import jsPDF from "jspdf";
import type { InvoiceDataV2, PDFGenerationResult, InvoiceMonthlyData } from "./types";
import { NIVRA_COMPANY, PREPAID_LEGAL_FOOTER, convertToV2Invoice } from "./types";

// ============================================================================
// COLORS
// ============================================================================

const COLORS = {
  navy: { r: 15, g: 23, b: 42 },      // #0F172A
  teal: { r: 20, g: 184, b: 166 },     // #14B8A6
  white: { r: 255, g: 255, b: 255 },
  gray: { r: 100, g: 116, b: 139 },    // #64748B
  lightGray: { r: 241, g: 245, b: 249 }, // #F1F5F9
  dark: { r: 30, g: 41, b: 59 },       // #1E293B
  success: { r: 34, g: 197, b: 94 },   // #22C55E
  error: { r: 239, g: 68, b: 68 },     // #EF4444
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatCurrency(amount: number): string {
  return amount.toFixed(2);
}

/**
 * Formate une date de manière sécurisée
 * Gère les placeholders de templates vierges et les dates invalides
 */
function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  
  // Placeholder pour template vierge - retourner tel quel
  if (dateStr.includes("DATE_") || dateStr.includes("PERIODE") || dateStr.includes("DEBUT_") || dateStr.includes("FIN_")) {
    return dateStr;
  }
  
  const date = new Date(dateStr);
  
  // Vérifier si la date est valide
  if (isNaN(date.getTime())) {
    console.warn(`[InvoiceMonthlyV2] Date invalide ignorée: "${dateStr}"`);
    return "—";
  }
  
  return date.toLocaleDateString("fr-CA", { 
    year: "numeric", 
    month: "long", 
    day: "numeric" 
  });
}

function formatPercentage(rate: number): string {
  return (rate * 100).toFixed(rate === 0.05 ? 0 : 3) + "%";
}

/**
 * Formate la méthode de paiement pour affichage
 */
function formatPaymentMethod(method: string): string {
  const methods: Record<string, string> = {
    "PayPal": "PayPal",
    "paypal": "PayPal",
    "Interac": "Virement Interac",
    "interac": "Virement Interac",
    "e_transfer": "Virement Interac",
    "Credit Card": "Carte de crédit",
    "card": "Carte de crédit",
    "Manual": "Manuel",
    "cash": "Comptant",
  };
  return methods[method] || method;
}

// ============================================================================
// MAIN GENERATOR
// ============================================================================

export function generateInvoiceMonthlyV2PDF(data: InvoiceDataV2): PDFGenerationResult {
  try {
    if (!data.invoice_number) {
      return { success: false, error: "Numéro de facture manquant" };
    }
    if (!data.customer?.full_name || !data.customer?.email) {
      return { success: false, error: "Informations client incomplètes" };
    }

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - margin * 2;
    let y = margin;

    // ========================================================================
    // HEADER BAR (Navy with Teal accent)
    // ========================================================================
    doc.setFillColor(COLORS.navy.r, COLORS.navy.g, COLORS.navy.b);
    doc.rect(0, 0, pageWidth, 45, "F");
    
    // Teal accent line
    doc.setFillColor(COLORS.teal.r, COLORS.teal.g, COLORS.teal.b);
    doc.rect(0, 45, pageWidth, 3, "F");

    // Company info (left side)
    doc.setTextColor(COLORS.white.r, COLORS.white.g, COLORS.white.b);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(NIVRA_COMPANY.company_legal_name, margin, 15);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(NIVRA_COMPANY.company_department, margin, 21);
    doc.text(NIVRA_COMPANY.company_tagline, margin, 26);
    doc.text(NIVRA_COMPANY.company_address, margin, 32);
    doc.text(NIVRA_COMPANY.company_support, margin, 37);

    // Document type (right side)
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("Document de facturation", pageWidth - margin, 15, { align: "right" });
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("FACTURE MENSUELLE", pageWidth - margin, 25, { align: "right" });
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Devise : ${data.currency || "CAD"}`, pageWidth - margin, 33, { align: "right" });

    y = 55;

    // ========================================================================
    // CLIENT INFO + INVOICE DETAILS (Two columns)
    // ========================================================================
    const colWidth = contentWidth / 2 - 5;
    
    // Left column: Client info
    doc.setFillColor(COLORS.lightGray.r, COLORS.lightGray.g, COLORS.lightGray.b);
    doc.rect(margin, y, colWidth, 55, "F");
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(COLORS.dark.r, COLORS.dark.g, COLORS.dark.b);
    doc.text("Informations client", margin + 5, y + 8);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(COLORS.gray.r, COLORS.gray.g, COLORS.gray.b);
    
    const clientLabels = ["Nom", "Courriel", "Téléphone", "Adresse"];
    const clientValues = [
      data.customer.full_name,
      data.customer.email,
      data.customer.phone || "—",
      `${data.customer.address_line1}${data.customer.address_line2 ? "\n" + data.customer.address_line2 : ""}\n${data.customer.city}, ${data.customer.province} ${data.customer.postal_code}`
    ];
    
    let clientY = y + 16;
    clientLabels.forEach((label, i) => {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(COLORS.gray.r, COLORS.gray.g, COLORS.gray.b);
      doc.text(label, margin + 5, clientY);
      
      doc.setFont("helvetica", "normal");
      doc.setTextColor(COLORS.dark.r, COLORS.dark.g, COLORS.dark.b);
      
      if (label === "Adresse") {
        const lines = clientValues[i].split("\n");
        lines.forEach((line, li) => {
          doc.text(line, margin + 30, clientY + (li * 4));
        });
        clientY += lines.length * 4;
      } else {
        doc.text(clientValues[i], margin + 30, clientY);
        clientY += 7;
      }
    });

    // Right column: Invoice details
    const rightColX = margin + colWidth + 10;
    doc.setFillColor(COLORS.lightGray.r, COLORS.lightGray.g, COLORS.lightGray.b);
    doc.rect(rightColX, y, colWidth, 55, "F");
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(COLORS.dark.r, COLORS.dark.g, COLORS.dark.b);
    doc.text("Détails facture", rightColX + 5, y + 8);
    
    const invoiceLabels = ["N° compte", "N° facture", "Date d'émission", "Échéance", "Période", "Statut"];
    const invoiceValues = [
      data.account_number,
      data.invoice_number,
      formatDate(data.invoice_date),
      formatDate(data.due_date),
      data.billing_period_start && data.billing_period_end 
        ? `${formatDate(data.billing_period_start)} → ${formatDate(data.billing_period_end)}`
        : "—",
      data.status
    ];
    
    let invoiceY = y + 16;
    invoiceLabels.forEach((label, i) => {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(COLORS.gray.r, COLORS.gray.g, COLORS.gray.b);
      doc.text(label, rightColX + 5, invoiceY);
      
      doc.setFont("helvetica", "normal");
      doc.setTextColor(COLORS.dark.r, COLORS.dark.g, COLORS.dark.b);
      doc.text(invoiceValues[i], rightColX + 40, invoiceY);
      invoiceY += 7;
    });

    // Total box (bottom right of right column)
    const totalBoxY = y + 30;
    doc.setFillColor(COLORS.teal.r, COLORS.teal.g, COLORS.teal.b);
    doc.rect(rightColX + colWidth - 50, totalBoxY, 45, 20, "F");
    
    doc.setTextColor(COLORS.white.r, COLORS.white.g, COLORS.white.b);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text("Total à payer", rightColX + colWidth - 27.5, totalBoxY + 6, { align: "center" });
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(`${formatCurrency(data.balance_due)} $`, rightColX + colWidth - 27.5, totalBoxY + 15, { align: "center" });

    y = y + 60;

    // ========================================================================
    // SERVICES TABLE
    // ========================================================================
    y += 5;
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(COLORS.dark.r, COLORS.dark.g, COLORS.dark.b);
    doc.text("Détails des services et frais", margin, y);
    
    y += 5;
    
    // Table header
    doc.setFillColor(COLORS.navy.r, COLORS.navy.g, COLORS.navy.b);
    doc.rect(margin, y, contentWidth, 8, "F");
    
    doc.setTextColor(COLORS.white.r, COLORS.white.g, COLORS.white.b);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    
    const cols = [
      { label: "Description", x: margin + 3, width: 70 },
      { label: "Période", x: margin + 73, width: 40 },
      { label: "Qté", x: margin + 113, width: 15 },
      { label: "Prix", x: margin + 128, width: 25 },
      { label: "Montant", x: margin + 153, width: 25 },
    ];
    
    cols.forEach(col => {
      doc.text(col.label, col.x, y + 5.5);
    });
    
    y += 8;

    // Table rows
    doc.setTextColor(COLORS.dark.r, COLORS.dark.g, COLORS.dark.b);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    
    data.items.forEach((item, i) => {
      const rowH = 12;
      
      if (i % 2 === 1) {
        doc.setFillColor(COLORS.lightGray.r, COLORS.lightGray.g, COLORS.lightGray.b);
        doc.rect(margin, y, contentWidth, rowH, "F");
      }
      
      // Description
      const desc = item.description;
      doc.setFont("helvetica", "normal");
      doc.text(desc.substring(0, 45), cols[0].x, y + 5);
      
      // Reference if exists
      if (item.reference) {
        doc.setFontSize(6);
        doc.setTextColor(COLORS.gray.r, COLORS.gray.g, COLORS.gray.b);
        doc.text(`Réf.: ${item.reference}`, cols[0].x, y + 9);
        doc.setFontSize(8);
        doc.setTextColor(COLORS.dark.r, COLORS.dark.g, COLORS.dark.b);
      }
      
      // Period
      doc.text(item.period || "—", cols[1].x, y + 5);
      
      // Qty
      doc.text(String(item.qty), cols[2].x, y + 5);
      
      // Unit price
      doc.text(`${formatCurrency(item.unit_price)} $`, cols[3].x, y + 5);
      
      // Amount
      doc.setFont("helvetica", "bold");
      doc.text(`${formatCurrency(item.amount)} $`, cols[4].x, y + 5);
      doc.setFont("helvetica", "normal");
      
      y += rowH;
    });

    // ========================================================================
    // PREPAID NOTE
    // ========================================================================
    y += 5;
    
    doc.setFillColor(248, 250, 252);
    doc.rect(margin, y, contentWidth, 18, "F");
    doc.setDrawColor(COLORS.teal.r, COLORS.teal.g, COLORS.teal.b);
    doc.rect(margin, y, contentWidth, 18, "S");
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(COLORS.gray.r, COLORS.gray.g, COLORS.gray.b);
    doc.text("Rappel (prépayé à expérience postpayée).", margin + 3, y + 5);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(
      "Une facture est affichée avant le cycle pour permettre le renouvellement. Sans paiement confirmé à la date de cycle (J0),",
      margin + 3, y + 10
    );
    doc.text(
      "le service n'est pas renouvelé (statut : Expiré) — aucun intérêt ni frais pour non-renouvellement normal.",
      margin + 3, y + 14
    );

    y += 23;

    // ========================================================================
    // TOTALS SECTION
    // ========================================================================
    const totalsX = margin + contentWidth - 70;
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(COLORS.dark.r, COLORS.dark.g, COLORS.dark.b);
    
    // Subtotal
    doc.text("Sous-total", totalsX, y);
    doc.text(`${formatCurrency(data.subtotal)} $`, totalsX + 65, y, { align: "right" });
    y += 5;
    
    // Discounts
    if (data.discounts && data.discounts.length > 0) {
      doc.setTextColor(COLORS.success.r, COLORS.success.g, COLORS.success.b);
      data.discounts.forEach(discount => {
        doc.text(discount.label, totalsX, y);
        doc.text(`-${formatCurrency(discount.amount)} $`, totalsX + 65, y, { align: "right" });
        y += 5;
      });
      doc.setTextColor(COLORS.dark.r, COLORS.dark.g, COLORS.dark.b);
    }
    
    // Taxes
    doc.text(`TPS (${formatPercentage(data.taxes.gst_rate)})`, totalsX, y);
    doc.text(`${formatCurrency(data.taxes.gst_amount)} $`, totalsX + 65, y, { align: "right" });
    y += 5;
    
    doc.text(`TVQ (${formatPercentage(data.taxes.qst_rate)})`, totalsX, y);
    doc.text(`${formatCurrency(data.taxes.qst_amount)} $`, totalsX + 65, y, { align: "right" });
    y += 5;
    
    // Total
    doc.setFont("helvetica", "bold");
    doc.text("Total", totalsX, y);
    doc.text(`${formatCurrency(data.total)} $`, totalsX + 65, y, { align: "right" });
    y += 5;
    
    // Payments received
    if (data.payments_total && data.payments_total > 0) {
      doc.setTextColor(COLORS.success.r, COLORS.success.g, COLORS.success.b);
      doc.text("Paiements reçus", totalsX, y);
      doc.text(`-${formatCurrency(data.payments_total)} $`, totalsX + 65, y, { align: "right" });
      y += 5;
    }
    
    // Balance due
    doc.setFillColor(COLORS.navy.r, COLORS.navy.g, COLORS.navy.b);
    doc.rect(totalsX - 5, y - 2, 75, 8, "F");
    
    doc.setTextColor(COLORS.white.r, COLORS.white.g, COLORS.white.b);
    doc.setFont("helvetica", "bold");
    doc.text("Solde à payer", totalsX, y + 3.5);
    doc.text(`${formatCurrency(data.balance_due)} $`, totalsX + 65, y + 3.5, { align: "right" });

    y += 15;

    // ========================================================================
    // PAYMENT SECTION - Conditional: Instructions OR Confirmation
    // ========================================================================
    const isPaid = data.status === "Paid" || data.status === "paid" || data.balance_due === 0;
    
    if (isPaid && data.payments && data.payments.length > 0) {
      // ====== PAYMENT CONFIRMED BLOCK ======
      const payment = data.payments[0]; // Primary payment
      
      doc.setFillColor(COLORS.success.r, COLORS.success.g, COLORS.success.b);
      doc.rect(margin, y - 5, contentWidth, 8, "F");
      
      doc.setTextColor(COLORS.white.r, COLORS.white.g, COLORS.white.b);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("✓ PAIEMENT CONFIRMÉ", margin + 5, y);
      
      y += 8;
      
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y, contentWidth, 26, "F");
      doc.setDrawColor(COLORS.success.r, COLORS.success.g, COLORS.success.b);
      doc.rect(margin, y, contentWidth, 26, "S");
      
      doc.setTextColor(COLORS.dark.r, COLORS.dark.g, COLORS.dark.b);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      
      // Payment method
      const methodLabel = formatPaymentMethod(payment.method);
      doc.text(`Méthode: ${methodLabel}`, margin + 5, y + 6);
      
      // Payment date
      const paidDate = payment.paid_at ? formatDate(payment.paid_at) : "—";
      doc.text(`Date: ${paidDate}`, margin + 5, y + 12);
      
      // Transaction ID / Reference
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      if (payment.processor_txn_id) {
        doc.text(`ID Transaction: ${payment.processor_txn_id}`, margin + 5, y + 18);
      } else if (payment.payment_reference) {
        doc.text(`Référence: ${payment.payment_reference}`, margin + 5, y + 18);
      }
      
      // Amount confirmed
      doc.setFont("helvetica", "bold");
      doc.setTextColor(COLORS.success.r, COLORS.success.g, COLORS.success.b);
      doc.text(`Montant confirmé: ${formatCurrency(payment.paid_amount)} $`, margin + contentWidth - 60, y + 12);
      
      y += 31;
    } else {
      // ====== PAYMENT INSTRUCTIONS BLOCK ======
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(COLORS.dark.r, COLORS.dark.g, COLORS.dark.b);
      doc.text("Instructions de paiement Interac • PayPal • Carte", margin, y);
      
      y += 5;
      
      doc.setFillColor(COLORS.lightGray.r, COLORS.lightGray.g, COLORS.lightGray.b);
      doc.rect(margin, y, contentWidth, 30, "F");
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text("Virement Interac (e-Transfer)", margin + 5, y + 7);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text("Courriel: Support@nivra-telecom.ca", margin + 5, y + 13);
      doc.text("Question secrète: Numéro de facture", margin + 5, y + 18);
      doc.text(`Réponse: ${data.invoice_number}`, margin + 5, y + 23);
      
      doc.setFont("helvetica", "italic");
      doc.setFontSize(7);
      doc.setTextColor(COLORS.gray.r, COLORS.gray.g, COLORS.gray.b);
      doc.text("Les paiements sont confirmés avant activation/renouvellement.", margin + 5, y + 28);

      y += 35;
    }

    // ========================================================================
    // LEGAL FOOTER
    // ========================================================================
    // Ensure we have space for footer
    if (y > pageHeight - 40) {
      doc.addPage();
      y = margin;
    }
    
    doc.setFillColor(COLORS.navy.r, COLORS.navy.g, COLORS.navy.b);
    doc.rect(0, pageHeight - 35, pageWidth, 35, "F");
    
    doc.setTextColor(COLORS.white.r, COLORS.white.g, COLORS.white.b);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text("POLITIQUE DE FACTURATION PRÉPAYÉE", margin, pageHeight - 28);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.5);
    
    const footerLines = [
      "Le cycle de facturation commence uniquement à la date de confirmation du paiement (Interac/PayPal/Carte). Les services sont facturés à l'avance.",
      "Le paiement doit être confirmé AVANT la date de cycle (J0) pour renouveler le service. Si non payé à J0, le service n'est pas renouvelé (Expiré).",
      "Aucun intérêt ni frais de réactivation pour non-renouvellement normal. Après 90 jours sans renouvellement, le numéro de téléphone peut devenir irrécupérable (nouveau numéro requis).",
      "Intérêt (5%/mois) + 15$ frais de réactivation s'appliquent UNIQUEMENT pour litiges bancaires/rétrofacturations. Les délais d'exécution et d'activation s'appliquent selon la catégorie de commande.",
      "Garantie équipement: 12 mois fabricant dès activation. Perte/vol/dommages client exclus sauf approbation interne. Les enregistrements de factures, références de paiement et attributions d'équipement",
      "sont stockés dans les systèmes internes Nivra et ne sont pas partagés à l'externe."
    ];
    
    let footerY = pageHeight - 24;
    footerLines.forEach(line => {
      doc.text(line, margin, footerY);
      footerY += 3.5;
    });

    // ========================================================================
    // GENERATE BLOB
    // ========================================================================
    const blob = doc.output("blob");
    const filename = `Facture_Mensuelle_${data.invoice_number}_${data.invoice_date.replace(/-/g, "")}.pdf`;

    return { success: true, blob, filename };
  } catch (error) {
    console.error("[InvoiceMonthlyV2PDF] Generation error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erreur inconnue",
    };
  }
}

// ============================================================================
// WRAPPER FOR LEGACY FORMAT
// ============================================================================

export function generateInvoiceMonthlyPDFFromLegacy(data: InvoiceMonthlyData): PDFGenerationResult {
  const v2Data = convertToV2Invoice(data, "MONTHLY");
  return generateInvoiceMonthlyV2PDF(v2Data);
}

export default generateInvoiceMonthlyV2PDF;
