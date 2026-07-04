/**
 * Nivra Receipt Template V2 — LOCKED (2026-07-01)
 *
 * 2-page premium receipt aligned with Invoice v5:
 *   Page 1: Green header, MONTANT RECU hero, client + service address,
 *           payment details box, invoice breakdown, rabais separated,
 *           TOTAL PAYE banner, last 3 payments history.
 *   Page 2: Refund & prorata policy + support box.
 *
 * All strings use plain latin-1 safe characters (no em-dash, no arrows,
 * no checkmarks) so Helvetica renders them correctly.
 */

import jsPDFModule from "npm:jspdf@2.5.2";
const jsPDF = (jsPDFModule as any).default || jsPDFModule;
type jsPDF = any;
import type { PDFGenerationResult } from "./types.ts";
import { NIVRA } from "./companyInfo.ts";

// ============================================================================
// DATA INTERFACE
// ============================================================================

export interface ReceiptData {
  receipt_number: string;
  payment_date: string;
  payment_method: string;
  amount_paid: number;

  invoice_number: string;
  invoice_total: number;
  order_number?: string;

  client_name: string;
  client_email: string;
  client_phone?: string;
  client_address?: string;
  account_number: string;

  billed_items?: Array<{ description: string; amount: number }>;

  transaction_reference?: string;
  balance_remaining?: number;

  // Canonical tax fields
  subtotal?: number;
  discount_amount?: number;
  discount_label?: string;
  tps_amount?: number;
  tvq_amount?: number;

  detailed_items?: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    line_total: number;
  }>;

  payment_status?: "paid" | "pending" | string;
  total_due?: number;

  // Field-sales attribution
  sale_source?: string;
  agent_name?: string;
  agent_number?: string;

  // v2 additions
  processed_by?: string;
  next_renewal_date?: string;
  account_status?: string; // "A jour" | "En retard" | ...
  previous_payments?: Array<{ date: string; method: string; amount: number }>;
}

// ============================================================================
// HELPERS (latin-1 safe)
// ============================================================================

const fmt = (amount: number): string =>
  new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD", minimumFractionDigits: 2 }).format(amount || 0);

const pad = (n: number) => String(n).padStart(2, "0");

const fmtDateShort = (dateStr: string | undefined | null): string => {
  if (!dateStr) return "-";
  const s = String(dateStr).trim();
  const ymd = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) return `${ymd[3]}/${ymd[2]}/${ymd[1]}`;
  const d = new Date(s);
  if (isNaN(d.getTime())) return "-";
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
};

const fmtDateTime = (dateStr: string | undefined | null): string => {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return fmtDateShort(dateStr);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} a ${pad(d.getHours())}h${pad(d.getMinutes())}`;
};

const fmtMethod = (m: string): string => {
  const map: Record<string, string> = {
    card: "PayPal", "Credit Card": "PayPal",
    paypal: "PayPal", PayPal: "PayPal",
    interac: "Virement Interac e-Transfer",
    e_transfer: "Virement Interac e-Transfer",
    cash: "Comptant", card_manual: "Carte (manuel)",
  };
  return map[m] || m;
};

// Parse "Ligne 1, Ville QC H1G 3L5, Canada" -> {line1, city_line, country}
function parseAddress(addr?: string): { line1: string; cityLine: string; country: string } {
  if (!addr) return { line1: "", cityLine: "", country: "" };
  const parts = addr.split(",").map((s) => s.trim()).filter(Boolean);
  return {
    line1: parts[0] || "",
    cityLine: parts[1] || "",
    country: parts.slice(2).join(", ") || "",
  };
}

// Colors — official document chrome is corporate blue (#0066CC).
const GREEN: [number, number, number] = [0, 102, 204];
const GREEN_DARK: [number, number, number] = [0, 76, 153];
const GREEN_LIGHT: [number, number, number] = [220, 252, 231];
const GREEN_TINT: [number, number, number] = [187, 247, 208];
const NAVY: [number, number, number] = [15, 23, 42];
const TEXT: [number, number, number] = [31, 41, 55];
const MUTED: [number, number, number] = [107, 114, 128];
const GREY_BG: [number, number, number] = [243, 244, 246];
const BORDER: [number, number, number] = [229, 231, 235];
const BLUE: [number, number, number] = [0, 102, 204];
const AMBER: [number, number, number] = [180, 83, 9];

// ============================================================================
// MAIN GENERATOR
// ============================================================================

export function generateReceiptPDF(data: ReceiptData): PDFGenerationResult {
  try {
    if (!data.receipt_number) return { success: false, error: "Numero de recu manquant" };

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pw = doc.internal.pageSize.getWidth();   // 210
    const ph = doc.internal.pageSize.getHeight();  // 297
    const isPending = data.payment_status === "pending";

    // ---------- PAGE 1 ----------
    // CORPORATE BLUE HEADER
    doc.setFillColor(...GREEN);
    doc.rect(0, 0, pw, 42, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(255, 255, 255);
    doc.text("NIVRA TELECOM", 15, 18);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(isPending ? "Avis de paiement en traitement" : "Recu officiel de paiement", 15, 25);

    doc.setFontSize(8);
    doc.setTextColor(220, 252, 231);
    doc.text("Fournisseur Internet, TV & Mobile prepaye - Quebec", 15, 32);

    // Right side header
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(`No ${data.receipt_number}`, pw - 15, 16, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Facture liee : #${data.invoice_number || "-"}`, pw - 15, 22, { align: "right" });
    doc.text(`Emis le ${fmtDateShort(data.payment_date)}`, pw - 15, 28, { align: "right" });

    // Status pill
    const pillW = 44, pillH = 8;
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(pw - 15 - pillW, 32, pillW, pillH, 1.5, 1.5, "F");
    if (isPending) {
      doc.setTextColor(...AMBER);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text("EN TRAITEMENT", pw - 15 - pillW / 2, 37.5, { align: "center" });
    } else {
      doc.setTextColor(...GREEN_DARK);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text("PAYE INTEGRAL", pw - 15 - pillW / 2, 37.5, { align: "center" });
    }

    let y = 55;

    // HERO — MONTANT RECU
    doc.setFillColor(...GREEN_LIGHT);
    doc.roundedRect(15, y, pw - 30, 26, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...GREEN_DARK);
    doc.text(isPending ? "MONTANT ATTENDU" : "MONTANT RECU", 20, y + 8);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(...NAVY);
    const heroAmount = isPending
      ? Number(data.total_due ?? data.invoice_total ?? 0)
      : Number(data.amount_paid || 0);
    doc.text(`${fmt(heroAmount)} CAD`, 20, y + 20);

    // Right side of hero
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text("Statut du compte", pw - 20, y + 8, { align: "right" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...GREEN_DARK);
    doc.text((data.account_status || "A JOUR").toUpperCase(), pw - 20, y + 15, { align: "right" });
    if (data.next_renewal_date) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...MUTED);
      doc.text(`Prochain renouv. : ${fmtDateShort(data.next_renewal_date)}`, pw - 20, y + 20, { align: "right" });
    }
    y += 34;

    // TWO-COLUMN CLIENT + SERVICE ADDRESS
    const colGap = 10;
    const colW = (pw - 30 - colGap) / 2;
    const leftX = 15;
    const rightX = 15 + colW + colGap;

    const drawBlock = (x: number, title: string, lines: Array<[string | null, string]>) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(...NAVY);
      doc.text(title.toUpperCase(), x, y);
      doc.setDrawColor(...GREEN);
      doc.setLineWidth(0.6);
      doc.line(x, y + 1.5, x + 25, y + 1.5);
      let yy = y + 8;
      for (const [label, val] of lines) {
        if (label) {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(7.5);
          doc.setTextColor(...MUTED);
          doc.text(label, x, yy);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(9);
          doc.setTextColor(...TEXT);
          doc.text(val || "-", x + 22, yy);
        } else {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(9);
          doc.setTextColor(...TEXT);
          doc.text(val || "-", x, yy);
        }
        yy += 5;
      }
      return yy;
    };

    const addr = parseAddress(data.client_address);
    const y1 = drawBlock(leftX, "Client", [
      [null, data.client_name || "-"],
      [null, data.client_email || "-"],
      ...(data.client_phone ? [[null, data.client_phone] as [null, string]] : []),
      ["Compte", data.account_number || "-"],
      ...(data.order_number ? [["Commande", `#${data.order_number}`] as [string, string]] : []),
    ]);
    const y2 = drawBlock(rightX, "Adresse de service", [
      [null, addr.line1 || "-"],
      ...(addr.cityLine ? [[null, addr.cityLine] as [null, string]] : []),
      ...(addr.country ? [[null, addr.country] as [null, string]] : []),
    ]);
    y = Math.max(y1, y2) + 4;

    // PAYMENT DETAILS BOX
    const pdRows: Array<[string, string]> = [
      ["Date du paiement", fmtDateTime(data.payment_date)],
      ["Methode", fmtMethod(data.payment_method)],
      ...(data.transaction_reference ? [["Reference transaction", data.transaction_reference] as [string, string]] : []),
      ["Facture reglee", `#${data.invoice_number || "-"}`],
      ...(data.processed_by ? [["Traite par", data.processed_by] as [string, string]] : []),
    ];
    const boxH = 10 + pdRows.length * 5.5;
    doc.setFillColor(...GREY_BG);
    doc.setDrawColor(...BORDER);
    doc.roundedRect(15, y, pw - 30, boxH, 2, 2, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...NAVY);
    doc.text("DETAILS DU PAIEMENT", 20, y + 6.5);
    let ry = y + 13;
    for (const [lbl, val] of pdRows) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...MUTED);
      doc.text(lbl, 20, ry);
      doc.setFontSize(9);
      doc.setTextColor(...TEXT);
      doc.text(String(val), 75, ry);
      ry += 5.5;
    }
    y += boxH + 8;

    // FIELD-SALES AGENT (optional)
    if (data.sale_source === "field_sales" && (data.agent_name || data.agent_number)) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(...NAVY);
      doc.text("REPRESENTANT COMMERCIAL", 15, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...TEXT);
      doc.text(`Nom : ${data.agent_name || "-"}   Badge : ${data.agent_number || "-"}`, 15, y);
      y += 8;
    }

    // BREAKDOWN TABLE
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...NAVY);
    doc.text("VENTILATION DE LA FACTURE REGLEE", 15, y);
    doc.setDrawColor(...GREEN);
    doc.setLineWidth(0.6);
    doc.line(15, y + 1.5, 65, y + 1.5);
    y += 6;

    // Header row
    doc.setFillColor(249, 250, 251);
    doc.rect(15, y, pw - 30, 6, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text("DESCRIPTION", 18, y + 4);
    doc.text("QTE", 130, y + 4, { align: "right" });
    doc.text("PRIX UNIT.", 158, y + 4, { align: "right" });
    doc.text("MONTANT", pw - 18, y + 4, { align: "right" });
    y += 8;

    const items = data.detailed_items && data.detailed_items.length > 0
      ? data.detailed_items
      : (data.billed_items || []).map((b) => ({
          description: b.description,
          quantity: 1,
          unit_price: b.amount,
          line_total: b.amount,
        }));

    const positive = items.filter((it) => Number(it.line_total || 0) >= 0 && !/rabais|credit|discount|promotion/i.test(it.description || ""));
    const negatives = items.filter((it) => Number(it.line_total || 0) < 0 || /rabais|credit|discount|promotion/i.test(it.description || ""));

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...TEXT);
    for (const it of positive) {
      const desc = doc.splitTextToSize(it.description || "Article", 100);
      doc.text(desc, 18, y);
      doc.text(String(it.quantity || 1), 130, y, { align: "right" });
      doc.text(fmt(Number(it.unit_price || 0)), 158, y, { align: "right" });
      doc.text(fmt(Number(it.line_total || 0)), pw - 18, y, { align: "right" });
      y += Math.max(5, desc.length * 4.2);
    }

    // Rabais / credits section
    if (negatives.length > 0 || (data.discount_amount && data.discount_amount > 0)) {
      y += 2;
      doc.setDrawColor(...BORDER);
      doc.line(15, y, pw - 15, y);
      y += 5;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(...AMBER);
      doc.text("RABAIS & CREDITS APPLIQUES", 18, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      for (const it of negatives) {
        doc.setTextColor(...TEXT);
        doc.text(it.description || "Rabais", 18, y);
        doc.setTextColor(...AMBER);
        const amount = Number(it.line_total ?? it.unit_price ?? 0);
        const shown = amount > 0 ? -amount : amount;
        doc.text(fmt(shown), pw - 18, y, { align: "right" });
        y += 5;
      }
      if (data.discount_amount && data.discount_amount > 0 && negatives.length === 0) {
        doc.setTextColor(...TEXT);
        doc.text(data.discount_label || "Promotion", 18, y);
        doc.setTextColor(...AMBER);
        doc.text(fmt(-data.discount_amount), pw - 18, y, { align: "right" });
        y += 5;
      }
    }

    // TOTALS
    y += 4;
    doc.setDrawColor(...BORDER);
    doc.line(120, y, pw - 15, y);
    y += 5;
    const tLabel = 158, tVal = pw - 18;
    const drawTotal = (lbl: string, val: string, opts: { bold?: boolean; color?: [number, number, number] } = {}) => {
      doc.setFont("helvetica", opts.bold ? "bold" : "normal");
      doc.setFontSize(9);
      doc.setTextColor(...(opts.color || MUTED));
      doc.text(lbl, tLabel, y, { align: "right" });
      doc.setTextColor(...TEXT);
      doc.text(val, tVal, y, { align: "right" });
      y += 5.5;
    };
    drawTotal("Sous-total", fmt(Number(data.subtotal ?? data.invoice_total ?? 0)));
    drawTotal("TPS (5%)", fmt(Number(data.tps_amount || 0)));
    drawTotal("TVQ (9,975%)", fmt(Number(data.tvq_amount || 0)));
    y += 1;
    doc.setDrawColor(...NAVY);
    doc.setLineWidth(0.4);
    doc.line(120, y, pw - 15, y);
    y += 6;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...NAVY);
    doc.text("Total facture", tLabel, y, { align: "right" });
    doc.text(fmt(Number(data.invoice_total || 0)), tVal, y, { align: "right" });
    y += 10;

    // TOTAL PAYE banner
    doc.setFillColor(...(isPending ? AMBER : GREEN));
    doc.roundedRect(15, y, pw - 30, 14, 2, 2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(isPending ? "MONTANT DU" : "TOTAL PAYE", 20, y + 9);
    doc.setFontSize(13);
    const balance = Number(data.balance_remaining || 0);
    const rightLine = isPending
      ? `${fmt(Number(data.total_due ?? data.invoice_total ?? 0))}`
      : `${fmt(Number(data.amount_paid || 0))}   -   Solde ${fmt(balance)}`;
    doc.text(rightLine, pw - 20, y + 9, { align: "right" });
    y += 20;

    // PAYMENT HISTORY
    if (!isPending && data.previous_payments && data.previous_payments.length > 0) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(...NAVY);
      doc.text("HISTORIQUE - DERNIERS PAIEMENTS", 15, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...MUTED);
      for (const p of data.previous_payments.slice(0, 3)) {
        doc.text(`${fmtDateShort(p.date)}   -   ${fmtMethod(p.method || "")}`, 18, y);
        doc.setTextColor(...TEXT);
        doc.text(`${fmt(Number(p.amount || 0))}   Paye`, pw - 18, y, { align: "right" });
        doc.setTextColor(...MUTED);
        y += 4.5;
      }
    }

    // FOOTER PAGE 1
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text(
      `${NIVRA.legalName}   -   ${NIVRA.tpsLabel}   -   ${NIVRA.tvqLabel}   -   NEQ ${NIVRA.neq}`,
      pw / 2, ph - 18, { align: "center" }
    );
    doc.text(`${NIVRA.email}   -   ${NIVRA.website}`, pw / 2, ph - 13, { align: "center" });
    doc.setFont("helvetica", "italic");
    doc.setFontSize(6.5);
    doc.setTextColor(156, 163, 175);
    doc.text("Ce recu constitue une preuve officielle de paiement  -  Page 1 de 2", pw / 2, ph - 8, { align: "center" });

    // ---------- PAGE 2 ----------
    doc.addPage();
    doc.setFillColor(...GREEN);
    doc.rect(0, 0, pw, 22, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(255, 255, 255);
    doc.text("Politique de remboursement & prorata", 15, 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Recu ${data.receipt_number}  -  Page 2 de 2`, pw - 15, 14, { align: "right" });

    let y2p = 35;
    const section = (title: string, lines: string[]) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(...NAVY);
      doc.text(title, 15, y2p);
      y2p += 6;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(55, 65, 81);
      for (const line of lines) {
        const wrapped = doc.splitTextToSize(line, pw - 30);
        doc.text(wrapped, 15, y2p);
        y2p += wrapped.length * 5;
      }
      y2p += 4;
    };

    section("1. Droit d'annulation", [
      "Vous pouvez annuler votre service a tout moment via votre portail client (portal.nivra-telecom.ca) ou en contactant support@nivra-telecom.ca. L'annulation prend effet a la fin du cycle de facturation en cours.",
    ]);
    section("2. Calcul du prorata", [
      "En cas d'annulation ou de changement de forfait en cours de cycle, Nivra calcule un prorata base sur les jours non consommes :",
      "     Remboursement = (Montant paye x Jours restants) / 30",
      "Le credit est applique automatiquement a votre compte sous 3 jours ouvrables.",
    ]);
    section("3. Delais de remboursement", [
      "-  Virement Interac : 1 a 3 jours ouvrables",
      "-  PayPal : 3 a 5 jours ouvrables",
      "-  Carte de credit (via PayPal) : 5 a 10 jours ouvrables selon l'emetteur",
    ]);
    section("4. Frais non remboursables", [
      "Les frais d'activation ponctuels, equipements livres (borne WiFi, terminal TV, carte SIM) et frais de deplacement technicien ne sont pas remboursables une fois la livraison ou l'installation confirmee.",
    ]);

    // Support box
    y2p += 4;
    const supH = 32;
    doc.setFillColor(...GREY_BG);
    doc.setDrawColor(...BORDER);
    doc.roundedRect(15, y2p, pw - 30, supH, 2, 2, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...NAVY);
    doc.text("Besoin d'aide avec ce paiement ?", 20, y2p + 8);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(55, 65, 81);
    doc.text("Contactez notre equipe support par courriel - nous repondons sous 24h ouvrables :", 20, y2p + 15);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...BLUE);
    doc.text(NIVRA.email, 20, y2p + 22);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(`Mentionnez toujours le numero de recu ${data.receipt_number} pour un traitement plus rapide.`, 20, y2p + 28);

    // Footer P2
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text(
      `${NIVRA.legalName}   -   ${NIVRA.tpsLabel}   -   ${NIVRA.tvqLabel}   -   NEQ ${NIVRA.neq}`,
      pw / 2, ph - 15, { align: "center" }
    );
    doc.text(`${NIVRA.email}   -   ${NIVRA.website}`, pw / 2, ph - 10, { align: "center" });

    const blob = doc.output("blob");
    // NOTE: filename intentionally omitted so pdfFromDb builds
    // "Recu_Prenom-Nom_<num>_YYYY-MM.pdf" (avoids UUID names).
    return { success: true, blob };
  } catch (error: any) {
    console.error("[ReceiptV2] Generation error:", error);
    return { success: false, error: error?.message || "Erreur de generation" };
  }
}

export default generateReceiptPDF;
