/**
 * Nivra Invoice One-Time Template V2.5
 * Template professionnel style opérateur (Rogers/Telus/Bell)
 * Pour équipements, activation, livraison, frais uniques
 * 
 * V2.5 CHANGES:
 * - Layout: Invoice details now uses proper 2-column table (no overlay)
 * - Sanitization: All text fields pass through assertPrintableText
 * - Payment: Global conditional logic for paid vs unpaid
 * 
 * Layout: A4/Letter printable
 * Design: Navy header (#0F172A), Teal accent (#14B8A6), clean grid layout
 */

import jsPDF from "jspdf";
import type { InvoiceDataV2, PDFGenerationResult, InvoiceOneTimeData } from "./types";
import { NIVRA_COMPANY, convertToV2Invoice } from "./types";
import { 
  assertPrintableText, 
  sanitizeCustomerData, 
  sanitizePaymentData,
  sanitizeDescription 
} from "./pdfTextSanitizer";

// ============================================================================
// COLORS
// ============================================================================

const COLORS = {
  navy: { r: 15, g: 23, b: 42 },
  teal: { r: 20, g: 184, b: 166 },
  white: { r: 255, g: 255, b: 255 },
  gray: { r: 100, g: 116, b: 139 },
  lightGray: { r: 241, g: 245, b: 249 },
  dark: { r: 30, g: 41, b: 59 },
  success: { r: 34, g: 197, b: 94 },
  error: { r: 239, g: 68, b: 68 },
};

// ============================================================================
// HELPERS
// ============================================================================

function formatCurrency(amount: number): string {
  return (amount || 0).toFixed(2);
}

/**
 * Formate une date de manière sécurisée
 * Gère les placeholders de templates vierges et les dates invalides
 */
function formatDate(dateStr: string | undefined | null): string {
  if (!dateStr) return "—";
  
  // Placeholder pour template vierge - retourner tel quel
  if (dateStr.includes("DATE_") || dateStr.includes("PERIODE") || dateStr.includes("DEBUT_") || dateStr.includes("FIN_")) {
    return dateStr;
  }
  
  const date = new Date(dateStr);
  
  // Vérifier si la date est valide
  if (isNaN(date.getTime())) {
    console.warn(`[InvoiceOneTimeV2] Date invalide ignorée: "${dateStr}"`);
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
  return methods[method] || assertPrintableText(method, "payment_method");
}

/**
 * Formate le statut pour affichage
 */
function formatStatus(status: string): string {
  const statuses: Record<string, string> = {
    "Paid": "Payé",
    "paid": "Payé",
    "Pending": "En attente",
    "pending": "En attente",
    "Issued": "Émise",
    "issued": "Émise",
    "Cancelled": "Annulée",
    "cancelled": "Annulée",
    "Expired": "Expirée",
    "expired": "Expirée",
    "overdue": "En retard",
  };
  return statuses[status] || status;
}

// ============================================================================
// MAIN GENERATOR
// ============================================================================

export function generateInvoiceOneTimeV2PDF(data: InvoiceDataV2): PDFGenerationResult {
  try {
    // Validate required fields
    if (!data.invoice_number) {
      return { success: false, error: "Numéro de facture manquant" };
    }
    if (!data.customer?.full_name || !data.customer?.email) {
      return { success: false, error: "Informations client incomplètes" };
    }

    // Sanitize all customer data globally
    const customer = sanitizeCustomerData(data.customer);

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - margin * 2;
    let y = margin;

    // ========================================================================
    // HEADER BAR
    // ========================================================================
    doc.setFillColor(COLORS.navy.r, COLORS.navy.g, COLORS.navy.b);
    doc.rect(0, 0, pageWidth, 45, "F");
    
    doc.setFillColor(COLORS.teal.r, COLORS.teal.g, COLORS.teal.b);
    doc.rect(0, 45, pageWidth, 3, "F");

    // Company info
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

    // Document type
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("Document de facturation", pageWidth - margin, 15, { align: "right" });
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("FACTURE UNIQUE", pageWidth - margin, 25, { align: "right" });
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Devise : ${data.currency || "CAD"}`, pageWidth - margin, 33, { align: "right" });

    y = 55;

    // ========================================================================
    // CLIENT + INVOICE INFO - FIXED LAYOUT
    // ========================================================================
    const colWidth = contentWidth / 2 - 5;
    const boxHeight = 52; // Fixed height for both boxes
    
    // Left: Client
    doc.setFillColor(COLORS.lightGray.r, COLORS.lightGray.g, COLORS.lightGray.b);
    doc.rect(margin, y, colWidth, boxHeight, "F");
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(COLORS.dark.r, COLORS.dark.g, COLORS.dark.b);
    doc.text("Informations client", margin + 5, y + 8);
    
    doc.setFontSize(8);
    
    const clientLabelX = margin + 5;
    const clientValueX = margin + 32;
    let clientY = y + 16;
    
    // Nom
    doc.setFont("helvetica", "bold");
    doc.setTextColor(COLORS.gray.r, COLORS.gray.g, COLORS.gray.b);
    doc.text("Nom", clientLabelX, clientY);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(COLORS.dark.r, COLORS.dark.g, COLORS.dark.b);
    doc.text(customer.full_name, clientValueX, clientY);
    clientY += 6;
    
    // Email
    doc.setFont("helvetica", "bold");
    doc.setTextColor(COLORS.gray.r, COLORS.gray.g, COLORS.gray.b);
    doc.text("Courriel", clientLabelX, clientY);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(COLORS.dark.r, COLORS.dark.g, COLORS.dark.b);
    doc.text(customer.email.substring(0, 30), clientValueX, clientY);
    clientY += 6;
    
    // Phone
    doc.setFont("helvetica", "bold");
    doc.setTextColor(COLORS.gray.r, COLORS.gray.g, COLORS.gray.b);
    doc.text("Téléphone", clientLabelX, clientY);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(COLORS.dark.r, COLORS.dark.g, COLORS.dark.b);
    doc.text(customer.phone || "—", clientValueX, clientY);
    clientY += 6;
    
    // Address
    doc.setFont("helvetica", "bold");
    doc.setTextColor(COLORS.gray.r, COLORS.gray.g, COLORS.gray.b);
    doc.text("Adresse", clientLabelX, clientY);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(COLORS.dark.r, COLORS.dark.g, COLORS.dark.b);
    doc.text(customer.address_line1.substring(0, 30), clientValueX, clientY);
    clientY += 4;
    if (customer.address_line2) {
      doc.text(customer.address_line2.substring(0, 30), clientValueX, clientY);
      clientY += 4;
    }
    doc.text(`${customer.city}, ${customer.province} ${customer.postal_code}`, clientValueX, clientY);

    // Right: Invoice details - PROPER TABLE LAYOUT (no overlay)
    const rightColX = margin + colWidth + 10;
    doc.setFillColor(COLORS.lightGray.r, COLORS.lightGray.g, COLORS.lightGray.b);
    doc.rect(rightColX, y, colWidth, boxHeight, "F");
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(COLORS.dark.r, COLORS.dark.g, COLORS.dark.b);
    doc.text("Détails facture", rightColX + 5, y + 8);
    
    doc.setFontSize(8);
    
    const invLabelX = rightColX + 5;
    const invValueX = rightColX + 40;
    let invoiceY = y + 16;
    
    // All invoice fields in proper 2-column table layout
    const invoiceFields = [
      { label: "N° compte", value: assertPrintableText(data.account_number, "account_number") },
      { label: "N° facture", value: assertPrintableText(data.invoice_number, "invoice_number") },
      { label: "Date d'émission", value: formatDate(data.invoice_date) },
      { label: "Échéance", value: formatDate(data.due_date) },
      { label: "Statut", value: formatStatus(data.status) },
    ];
    
    invoiceFields.forEach(({ label, value }) => {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(COLORS.gray.r, COLORS.gray.g, COLORS.gray.b);
      doc.text(label, invLabelX, invoiceY);
      
      doc.setFont("helvetica", "normal");
      doc.setTextColor(COLORS.dark.r, COLORS.dark.g, COLORS.dark.b);
      doc.text(value.substring(0, 25), invValueX, invoiceY);
      invoiceY += 6;
    });
    
    // Total à payer - as separate row in table (NOT overlay)
    doc.setFont("helvetica", "bold");
    doc.setTextColor(COLORS.teal.r, COLORS.teal.g, COLORS.teal.b);
    doc.text("Total à payer", invLabelX, invoiceY);
    doc.setFontSize(11);
    doc.text(`${formatCurrency(data.balance_due)} $`, invValueX, invoiceY);

    y = y + boxHeight + 5;

    // ========================================================================
    // ITEMS TABLE
    // ========================================================================
    y += 3;
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(COLORS.dark.r, COLORS.dark.g, COLORS.dark.b);
    doc.text("Détails — vente unique", margin, y);
    
    y += 5;
    
    // Table header
    doc.setFillColor(COLORS.navy.r, COLORS.navy.g, COLORS.navy.b);
    doc.rect(margin, y, contentWidth, 8, "F");
    
    doc.setTextColor(COLORS.white.r, COLORS.white.g, COLORS.white.b);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    
    const cols = [
      { label: "Description", x: margin + 3, width: 90 },
      { label: "Qté", x: margin + 93, width: 20 },
      { label: "Prix", x: margin + 113, width: 30 },
      { label: "Montant", x: margin + 143, width: 35 },
    ];
    
    cols.forEach(col => {
      doc.text(col.label, col.x, y + 5.5);
    });
    
    y += 8;

    // Rows
    doc.setTextColor(COLORS.dark.r, COLORS.dark.g, COLORS.dark.b);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    
    data.items.forEach((item, i) => {
      const rowH = item.reference ? 14 : 10;
      
      if (i % 2 === 1) {
        doc.setFillColor(COLORS.lightGray.r, COLORS.lightGray.g, COLORS.lightGray.b);
        doc.rect(margin, y, contentWidth, rowH, "F");
      }
      
      // Description - sanitized
      const desc = sanitizeDescription(item.description);
      doc.setFont("helvetica", "normal");
      doc.text(desc.substring(0, 55), cols[0].x, y + 5);
      
      // Reference - sanitized
      if (item.reference) {
        doc.setFontSize(6);
        doc.setTextColor(COLORS.gray.r, COLORS.gray.g, COLORS.gray.b);
        doc.text(`Réf.: ${assertPrintableText(item.reference, "reference")}`, cols[0].x, y + 10);
        doc.setFontSize(8);
        doc.setTextColor(COLORS.dark.r, COLORS.dark.g, COLORS.dark.b);
      }
      
      doc.text(String(item.qty), cols[1].x, y + 5);
      doc.text(`${formatCurrency(item.unit_price)} $`, cols[2].x, y + 5);
      
      doc.setFont("helvetica", "bold");
      doc.text(`${formatCurrency(item.amount)} $`, cols[3].x, y + 5);
      doc.setFont("helvetica", "normal");
      
      y += rowH;
    });

    // ========================================================================
    // NOTE BOX
    // ========================================================================
    y += 5;
    
    doc.setFillColor(248, 250, 252);
    doc.rect(margin, y, contentWidth, 14, "F");
    doc.setDrawColor(COLORS.teal.r, COLORS.teal.g, COLORS.teal.b);
    doc.rect(margin, y, contentWidth, 14, "S");
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(COLORS.gray.r, COLORS.gray.g, COLORS.gray.b);
    doc.text("Note.", margin + 3, y + 5);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(
      "Cette facture concerne des frais uniques (ex.: équipement, SIM/eSIM, activation, livraison, installation).",
      margin + 3, y + 9
    );
    doc.text(
      "Les garanties et exclusions applicables sont celles indiquées aux Modalités de service.",
      margin + 3, y + 12
    );

    y += 18;

    // ========================================================================
    // TOTALS
    // ========================================================================
    const totalsX = margin + contentWidth - 70;
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(COLORS.dark.r, COLORS.dark.g, COLORS.dark.b);
    
    doc.text("Sous-total", totalsX, y);
    doc.text(`${formatCurrency(data.subtotal)} $`, totalsX + 65, y, { align: "right" });
    y += 5;
    
    if (data.discounts && data.discounts.length > 0) {
      doc.setTextColor(COLORS.success.r, COLORS.success.g, COLORS.success.b);
      data.discounts.forEach(discount => {
        const discountLabel = assertPrintableText(discount.label, "discount_label");
        doc.text(discountLabel, totalsX, y);
        doc.text(`-${formatCurrency(discount.amount)} $`, totalsX + 65, y, { align: "right" });
        y += 5;
      });
      doc.setTextColor(COLORS.dark.r, COLORS.dark.g, COLORS.dark.b);
    }
    
    doc.text(`TPS (${formatPercentage(data.taxes.gst_rate)})`, totalsX, y);
    doc.text(`${formatCurrency(data.taxes.gst_amount)} $`, totalsX + 65, y, { align: "right" });
    y += 5;
    
    doc.text(`TVQ (${formatPercentage(data.taxes.qst_rate)})`, totalsX, y);
    doc.text(`${formatCurrency(data.taxes.qst_amount)} $`, totalsX + 65, y, { align: "right" });
    y += 5;
    
    doc.setFont("helvetica", "bold");
    doc.text("Total", totalsX, y);
    doc.text(`${formatCurrency(data.total)} $`, totalsX + 65, y, { align: "right" });
    y += 5;
    
    if (data.payments_total && data.payments_total > 0) {
      doc.setTextColor(COLORS.success.r, COLORS.success.g, COLORS.success.b);
      doc.text("Paiements reçus", totalsX, y);
      doc.text(`-${formatCurrency(data.payments_total)} $`, totalsX + 65, y, { align: "right" });
      y += 5;
    }
    
    doc.setFillColor(COLORS.navy.r, COLORS.navy.g, COLORS.navy.b);
    doc.rect(totalsX - 5, y - 2, 75, 8, "F");
    
    doc.setTextColor(COLORS.white.r, COLORS.white.g, COLORS.white.b);
    doc.setFont("helvetica", "bold");
    doc.text("Solde à payer", totalsX, y + 3.5);
    doc.text(`${formatCurrency(data.balance_due)} $`, totalsX + 65, y + 3.5, { align: "right" });

    y += 15;

    // ========================================================================
    // PAYMENT SECTION - GLOBAL CONDITIONAL LOGIC
    // Rule: if status === "paid" OR balance_due === 0 → show confirmation
    //       else → show payment instructions
    // ========================================================================
    const isPaid = 
      data.status?.toLowerCase() === "paid" || 
      data.status?.toLowerCase() === "payé" ||
      data.balance_due === 0;
    
    if (isPaid && data.payments && data.payments.length > 0) {
      // ====== PAYMENT CONFIRMED BLOCK ======
      const payment = data.payments[0]; // Primary payment
      const sanitizedPayment = sanitizePaymentData(payment);
      
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
      const methodLabel = formatPaymentMethod(sanitizedPayment.method);
      doc.text(`Méthode: ${methodLabel}`, margin + 5, y + 6);
      
      // Payment date
      const paidDate = formatDate(sanitizedPayment.paid_at);
      doc.text(`Date: ${paidDate}`, margin + 5, y + 12);
      
      // Transaction ID / Reference - from billing_payments
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      const txnId = sanitizedPayment.processor_txn_id !== "—" 
        ? sanitizedPayment.processor_txn_id 
        : sanitizedPayment.payment_reference;
      if (txnId && txnId !== "—") {
        doc.text(`Référence paiement: ${txnId}`, margin + 5, y + 18);
      }
      
      // Amount confirmed
      doc.setFont("helvetica", "bold");
      doc.setTextColor(COLORS.success.r, COLORS.success.g, COLORS.success.b);
      doc.text(`Montant confirmé: ${formatCurrency(sanitizedPayment.paid_amount)} $`, margin + contentWidth - 60, y + 12);
      
      y += 31;
    } else {
      // ====== PAYMENT INSTRUCTIONS BLOCK (only if NOT paid) ======
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(COLORS.dark.r, COLORS.dark.g, COLORS.dark.b);
      doc.text("Instructions de paiement Interac • PayPal • Carte", margin, y);
      
      y += 5;
      
      doc.setFillColor(COLORS.lightGray.r, COLORS.lightGray.g, COLORS.lightGray.b);
      doc.rect(margin, y, contentWidth, 22, "F");
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text("Virement Interac (e-Transfer)", margin + 5, y + 7);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text("Courriel: Support@nivra-telecom.ca", margin + 5, y + 12);
      doc.text("Question secrète: Numéro de facture", margin + 5, y + 16);
      doc.text(`Réponse: ${assertPrintableText(data.invoice_number, "invoice_number")}`, margin + 5, y + 20);

      y += 27;
    }

    // ========================================================================
    // LEGAL FOOTER
    // ========================================================================
    if (y > pageHeight - 40) {
      doc.addPage();
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
      "Intérêt (5%/mois) + 15$ frais de réactivation s'appliquent UNIQUEMENT pour litiges bancaires/rétrofacturations.",
      "Garantie équipement: 12 mois fabricant dès activation. Perte/vol/dommages client exclus sauf approbation interne."
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
    const invoiceDate = data.invoice_date?.replace(/-/g, "") || "unknown";
    const filename = `Facture_${data.invoice_number}_${invoiceDate}.pdf`;

    return { success: true, blob, filename };
  } catch (error) {
    console.error("[InvoiceOneTimeV2PDF] Generation error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erreur inconnue",
    };
  }
}

// ============================================================================
// WRAPPER FOR LEGACY FORMAT
// ============================================================================

export function generateInvoiceOneTimePDFFromLegacy(data: InvoiceOneTimeData): PDFGenerationResult {
  const v2Data = convertToV2Invoice(data, "ONETIME");
  return generateInvoiceOneTimeV2PDF(v2Data);
}

export default generateInvoiceOneTimeV2PDF;
