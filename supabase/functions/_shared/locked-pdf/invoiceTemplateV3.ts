/**
 * Nivra Invoice Template V4.0 â€” LOCKED PRODUCTION (2026-03-20)
 * 
 * Approved canonical layout:
 * â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
 * â”‚ BLUE HEADER: NIVRA TELECOM   No XXXXXXX    â”‚
 * â”‚ FACTURE                                     â”‚
 * â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
 * â”‚ Client info          Adresse de service     â”‚
 * â”‚ Compte / Commande                           â”‚
 * â”‚ Date facturation     Date echeance          â”‚
 * â”‚ Periode                                     â”‚
 * â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
 * â”‚ Description | Type | Montant (table)        â”‚
 * â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
 * â”‚ Sous-total / TPS / TVQ / TOTAL              â”‚
 * â”‚ Montant paye / Solde / STATUT               â”‚
 * â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
 * â”‚ Footer: Nivra Telecom Inc. | TPS | TVQ      â”‚
 * â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
 */

import jsPDFModule from "npm:jspdf@2.5.2";
const jsPDF = (jsPDFModule as any).default || jsPDFModule;
type jsPDF = any;
import type { InvoiceDataV2, PDFGenerationResult } from "./types.ts";
import { NIVRA, TAX } from "./companyInfo.ts";

// ============================================================================
// HELPERS
// ============================================================================

const fmt = (amount: number): string =>
  new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD", minimumFractionDigits: 2 }).format(amount || 0);

const fmtDate = (dateStr: string | undefined | null): string => {
  if (!dateStr) return "â€”";
  if (dateStr.includes("DATE_") || dateStr.includes("PERIODE")) return dateStr;
  const ymd = String(dateStr).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) {
    const d = new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
    return `${d.getDate()} ${d.toLocaleString("fr-CA", { month: "long" })} ${d.getFullYear()}`;
  }
  return "â€”";
};

const fmtStatus = (status: string): string => {
  const map: Record<string, string> = {
    paid: "PAYEE", Paid: "PAYEE", pending: "EN ATTENTE", overdue: "EN RETARD",
    cancelled: "ANNULEE", void: "ANNULEE",
  };
  return map[status] || status.toUpperCase();
};

const typeLabel = (cat: string): string => {
  const key = (cat || "").toLowerCase();
  if (["internet", "mobile", "tv", "security", "service", "recurring"].includes(key)) return "Service";
  if (["equipment", "phone"].includes(key)) return "Ã‰quipement";
  if (["fee", "fees", "frais"].includes(key)) return "Frais";
  if (["adjustment", "ajustement", "proration", "prorata"].includes(key)) return "Ajustement";
  if (["discount", "rabais", "credit", "promo"].includes(key)) return "Rabais";
  // capitalise first letter for any unmapped type
  return cat.charAt(0).toUpperCase() + cat.slice(1);
};

// ============================================================================
// CANONICAL HEADER â€” Nivra Green/Blue header with document number
// ============================================================================

function drawCanonicalHeader(doc: jsPDF, title: string, docNumber: string, color: [number, number, number]) {
  const pw = doc.internal.pageSize.getWidth();
  doc.setFillColor(...color);
  doc.rect(0, 0, pw, 40, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text("NIVRA TELECOM", 15, 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(title, 15, 28);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(`No ${docNumber}`, pw - 15, 18, { align: "right" });
}

function drawCanonicalFooter(doc: jsPDF) {
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text(
    `${NIVRA.tradeName} Inc. | ${NIVRA.email} | ${NIVRA.website}`,
    pw / 2, ph - 18, { align: "center" }
  );
  doc.text(
    `${NIVRA.tpsLabel} | ${NIVRA.tvqLabel}`,
    pw / 2, ph - 13, { align: "center" }
  );
}

function drawClientBlock(doc: jsPDF, data: {
  name: string; email: string; phone?: string; address?: string;
  city?: string; province?: string; postal?: string;
  account: string; orderNum?: string;
}, y: number): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text("Client", 15, y);
  if (data.address) doc.text("Adresse de service", 110, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(data.name || "â€”", 15, y);
  if (data.address) doc.text(data.address, 110, y);
  y += 5;
  if (data.email) doc.text(data.email, 15, y);
  if (data.city) {
    doc.text(`${data.city}, ${data.province || "QC"} ${data.postal || ""}`, 110, y);
  }
  y += 5;
  if (data.phone) { doc.text(data.phone, 15, y); y += 5; }

  doc.setFontSize(8);
  let idLine = `Compte: ${data.account}`;
  if (data.orderNum) idLine += `  |  Commande: ${data.orderNum}`;
  doc.text(idLine, 15, y);
  y += 8;
  return y;
}

// ============================================================================
// MAIN GENERATOR â€” Canonical Invoice PDF
// ============================================================================

export function generateInvoiceV3PDF(data: InvoiceDataV2): PDFGenerationResult {
  try {
    if (!data.invoice_number) return { success: false, error: "Numero de facture manquant" };
    if (!data.items || data.items.length === 0) return { success: false, error: "Aucun item a facturer" };

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    // Header â€” Blue
    drawCanonicalHeader(doc, "FACTURE", data.invoice_number, [30, 64, 120]);

    // Client block
    let y = drawClientBlock(doc, {
      name: data.customer?.full_name || "â€”",
      email: data.customer?.email || "",
      phone: data.customer.phone,
      address: data.customer.address_line1,
      city: data.customer.city,
      province: data.customer.province,
      postal: data.customer.postal_code,
      account: data.account_number,
      orderNum: undefined,
    }, 50);

    // Dates
    doc.setFontSize(9);
    doc.text(`Date de facturation: ${fmtDate(data.invoice_date)}`, 15, y);
    doc.text(`Date d'echeance: ${fmtDate(data.due_date)}`, 110, y);
    y += 6;
    if (data.billing_period_start && data.billing_period_end) {
      doc.text(`Periode: ${fmtDate(data.billing_period_start)} au ${fmtDate(data.billing_period_end)}`, 15, y);
      y += 6;
    }
    y += 4;

    // FIELD-SALES AGENT BLOCK (ADD-ONLY â€” conditional, additive optional fields on InvoiceDataV2)
    const fsData = data as any;
    if (fsData.sale_source === "field_sales" && (fsData.agent_name || fsData.agent_number)) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(30, 64, 120);
      doc.text("Representant commercial", 15, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(40, 40, 40);
      doc.text(`Nom : ${fsData.agent_name || "â€”"}`, 17, y); y += 5;
      doc.text(`Badge : ${fsData.agent_number || "â€”"}`, 17, y); y += 5;
      doc.text("Type de vente : Vente terrain (Porte-a-porte)", 17, y); y += 6;
      doc.setTextColor(0, 0, 0);
    }

    // Items table
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setFillColor(240, 240, 240);
    doc.rect(15, y, 170, 7, "F");
    doc.setTextColor(0, 0, 0);
    doc.text("Description", 17, y + 5);
    doc.text("Type", 130, y + 5);
    doc.text("Montant", 180, y + 5, { align: "right" });
    y += 8;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);

    // Description column fits from x=17 to x=128 (111mm).
    // splitTextToSize wraps long descriptions so they never overflow into the Type column.
    const DESC_MAX_W = 108;
    const LINE_H = 5; // mm per wrapped line

    function drawRow(
      doc: jsPDF,
      description: string,
      typeCol: string,
      amountStr: string,
      yStart: number,
      colorRgb: [number, number, number],
    ): number {
      const lines: string[] = doc.splitTextToSize(description, DESC_MAX_W);
      const rowH = Math.max(7, lines.length * LINE_H + 3);
      const textY = yStart + LINE_H;
      doc.setTextColor(...colorRgb);
      doc.text(lines, 17, textY);
      doc.text(typeCol, 130, textY);
      doc.text(amountStr, 180, textY, { align: "right" });
      doc.setDrawColor(230, 230, 230);
      doc.line(15, yStart + rowH, 185, yStart + rowH);
      return yStart + rowH;
    }

    // Render items
    for (const item of data.items) {
      y = drawRow(doc, item.description, typeLabel(item.category), fmt(item.amount), y, [0, 0, 0]);
    }

    // Discounts
    if (data.discounts && data.discounts.length > 0) {
      for (const d of data.discounts) {
        y = drawRow(doc, d.label, "Rabais", fmt(-d.amount), y, [0, 128, 0]);
      }
    }

    doc.setTextColor(0, 0, 0);
    y += 6;

    // Totals block (right-aligned)
    const tx = 120;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("Sous-total", tx, y); doc.text(fmt(data.subtotal), 180, y, { align: "right" }); y += 6;
    doc.text(`TPS (5%)`, tx, y); doc.text(fmt(data.taxes.gst_amount), 180, y, { align: "right" }); y += 6;
    doc.text(`TVQ (9,975%)`, tx, y); doc.text(fmt(data.taxes.qst_amount), 180, y, { align: "right" }); y += 8;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("TOTAL", tx, y); doc.text(fmt(data.total), 180, y, { align: "right" }); y += 10;

    // Payment status
    const totalPaid = data.payments_total ?? data.payments?.reduce((s, p) => s + p.paid_amount, 0) ?? 0;
    if (totalPaid > 0) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(0, 128, 0);
      doc.text("Montant paye", tx, y); doc.text(fmt(totalPaid), 180, y, { align: "right" }); y += 7;
      doc.text("Solde", tx, y); doc.text(fmt(data.balance_due), 180, y, { align: "right" }); y += 8;

      // Status badge
      doc.setFontSize(8);
      doc.setFillColor(220, 255, 220);
      doc.rect(tx, y, 65, 6, "F");
      doc.setTextColor(0, 100, 0);
      doc.text(`STATUT: ${fmtStatus(data.status)}`, tx + 32.5, y + 4.5, { align: "center" });
    }

    doc.setTextColor(0, 0, 0);

    // Footer
    drawCanonicalFooter(doc);

    const blob = doc.output("blob");
    return {
      success: true,
      blob,
      filename: `Facture_${data.invoice_number}_Nivra.pdf`,
    };
  } catch (error) {
    console.error("[InvoiceV4] Generation error:", error);
    return { success: false, error: error?.message || "Erreur de generation" };
  }
}

// ============================================================================
// CONVENIENCE EXPORTS (keep backward compat)
// ============================================================================

export function generateInvoiceMonthlyV3PDF(data: InvoiceDataV2): PDFGenerationResult {
  return generateInvoiceV3PDF({ ...data, invoice_type: "MONTHLY" });
}

export function generateInvoiceOneTimeV3PDF(data: InvoiceDataV2): PDFGenerationResult {
  return generateInvoiceV3PDF({ ...data, invoice_type: "ONETIME" });
}

export default generateInvoiceV3PDF;
