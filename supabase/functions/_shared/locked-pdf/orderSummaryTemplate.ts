/**
 * Nivra Order Summary Template V4.0 — LOCKED PRODUCTION (2026-03-20)
 * 
 * Approved canonical layout:
 * ┌─────────────────────────────────────────────┐
 * │ BLUE HEADER: NIVRA TELECOM   No XXXXX      │
 * │ SOMMAIRE DE COMMANDE                        │
 * ├─────────────────────────────────────────────┤
 * │ Client info + Adresse de service             │
 * │ "Votre selection"                            │
 * │ Services mensuels recurrents (light blue)    │
 * │ Frais uniques (light blue)                   │
 * │ Promotion appliquee (light green)            │
 * │ Sous-total / TPS / TVQ / TOTAL               │
 * │ PROCHAINES ETAPES (blue box)                 │
 * ├─────────────────────────────────────────────┤
 * │ Footer                                       │
 * └─────────────────────────────────────────────┘
 */

import jsPDFModule from "npm:jspdf@2.5.2";
const jsPDF = (jsPDFModule as any).default || jsPDFModule;
type jsPDF = any;
import type { PDFGenerationResult } from "./types.ts";
import { NIVRA } from "./companyInfo.ts";

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
    imei?: string;
    storage?: string;
    color?: string;
    condition?: string;
    warranty_days?: number;
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

  // New canonical activation/install details
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
  return "—";
};

// ============================================================================
// MAIN GENERATOR
// ============================================================================

export function generateOrderSummaryPDF(data: OrderSummaryV3Data): PDFGenerationResult;
export function generateOrderSummaryPDF(data: any): PDFGenerationResult;
export function generateOrderSummaryPDF(data: any): PDFGenerationResult {
  try {
    // Normalize data if needed (accept both old and new format)
    const d: OrderSummaryV3Data = data;
    if (!d.order_number) return { success: false, error: "Numero de commande manquant" };

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pw = doc.internal.pageSize.getWidth();

    // BLUE HEADER
    doc.setFillColor(41, 98, 168);
    doc.rect(0, 0, pw, 40, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.text("NIVRA TELECOM", 15, 16);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text("SOMMAIRE DE COMMANDE", 15, 28);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(`No ${d.order_number}`, pw - 15, 18, { align: "right" });

    // CLIENT BLOCK
    let y = 50;
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Client", 15, y);
    doc.text("Adresse de service", 110, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(d.client_name || "", 15, y);
    // Parse service address
    const addrParts = (d.service_address || "").split(",").map((s: string) => s.trim());
    doc.text(addrParts[0] || "", 110, y);
    y += 5;
    doc.text(d.client_email || "", 15, y);
    if (addrParts.length > 1) doc.text(addrParts.slice(1).join(", "), 110, y);
    y += 5;
    if (d.client_phone) { doc.text(d.client_phone, 15, y); y += 5; }
    doc.setFontSize(8);
    doc.text(`Compte: ${d.account_number}  |  Commande: ${d.order_number}`, 15, y);
    y += 10;

    // VOTRE SELECTION
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Votre selection", 15, y);
    doc.setDrawColor(0, 0, 0);
    doc.line(15, y + 1.5, 185, y + 1.5);
    y += 8;

    // Services mensuels recurrents
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setFillColor(235, 242, 255);
    doc.rect(15, y, 170, 7, "F");
    doc.setTextColor(0, 0, 0);
    doc.text("Services mensuels recurrents", 17, y + 5);
    y += 9;
    doc.setFont("helvetica", "normal");
    for (const svc of d.services || []) {
      doc.text(svc.name, 20, y);
      doc.text(`${fmt(svc.monthly_price)}/mois`, 185, y, { align: "right" });
      y += 6;
    }
    y += 3;

    // Frais uniques
    const hasEquipOrFees = (d.equipment?.length > 0) || (d.fees?.length > 0);
    if (hasEquipOrFees) {
      doc.setFont("helvetica", "bold");
      doc.setFillColor(235, 242, 255);
      doc.rect(15, y, 170, 7, "F");
      doc.text("Frais uniques", 17, y + 5);
      y += 9;
      doc.setFont("helvetica", "normal");
      for (const eq of d.equipment || []) {
        // Build enriched equipment label: "iPhone 16 Pro Max - 256GB - Titane naturel - Neuf"
        const parts: string[] = [eq.name];
        if (eq.storage) parts.push(eq.storage);
        if (eq.color) parts.push(eq.color);
        if (eq.condition) {
          const condMap: Record<string, string> = { new: "Neuf", refurbished: "Remis a neuf", used: "Usage" };
          parts.push(condMap[eq.condition] || eq.condition);
        }
        const label = parts.join(" - ");
        doc.text(label, 20, y);
        doc.text(fmt(eq.unit_price * eq.quantity), 185, y, { align: "right" });
        y += 5;
        if (eq.imei || eq.serial || eq.warranty_days) {
          doc.setFontSize(7);
          doc.setTextColor(100, 100, 100);
          const meta: string[] = [];
          if (eq.imei) meta.push(`IMEI: ${eq.imei}`);
          if (eq.serial) meta.push(`S/N: ${eq.serial}`);
          if (eq.warranty_days) meta.push(`Garantie: ${eq.warranty_days} jours`);
          doc.text(meta.join("  |  "), 22, y);
          doc.setFontSize(9);
          doc.setTextColor(0, 0, 0);
          y += 5;
        }
        y += 1;
      }
      for (const fee of d.fees || []) {
        doc.text(fee.label, 20, y);
        doc.text(fmt(fee.amount), 185, y, { align: "right" });
        y += 6;
      }
      y += 3;
    }

    // ACTIVATION / INSTALLATION DETAILS (mobile/internet/TV)
    const hasActivation = d.mobile_assigned_number || d.mobile_sim_iccid || d.install_date || d.technician_name;
    if (hasActivation) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setFillColor(220, 240, 255);
      doc.rect(15, y, 170, 7, "F");
      doc.setTextColor(0, 0, 0);
      doc.text("Details d'activation / installation", 17, y + 5);
      y += 9;
      doc.setFont("helvetica", "normal");
      if (d.mobile_assigned_number) { doc.text(`Numero attribue: ${d.mobile_assigned_number}`, 20, y); y += 5; }
      if (d.mobile_sim_iccid) { doc.text(`SIM ICCID: ${d.mobile_sim_iccid}` + (d.mobile_sim_type ? ` (${d.mobile_sim_type})` : ""), 20, y); y += 5; }
      if (d.mobile_sim_carrier) { doc.text(`Reseau: ${d.mobile_sim_carrier}`, 20, y); y += 5; }
      if (d.mobile_activated_at) { doc.text(`Activation mobile: ${fmtDate(d.mobile_activated_at)}`, 20, y); y += 5; }
      if (d.install_date) { doc.text(`Date d'installation: ${fmtDate(d.install_date)}`, 20, y); y += 5; }
      if (d.technician_name) { doc.text(`Technicien: ${d.technician_name}`, 20, y); y += 5; }
      y += 3;
    }

    // Promotion
    if (d.discount_amount > 0) {
      doc.setFont("helvetica", "bold");
      doc.setFillColor(220, 255, 220);
      doc.rect(15, y, 170, 7, "F");
      doc.text("Promotion appliquee", 17, y + 5);
      y += 9;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0, 128, 0);
      doc.text(d.discount_label || "Promotion", 20, y);
      doc.text(fmt(-d.discount_amount), 185, y, { align: "right" });
      doc.setTextColor(0, 0, 0);
      y += 8;
    }

    y += 3;

    // TOTALS — use CANONICAL values from compute_invoice_breakdown (zero local math)
    const tx = 120;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const canonicalSubtotal = (d.subtotal_monthly || 0) + (d.subtotal_onetime || 0);
    doc.text("Sous-total", tx, y); doc.text(fmt(canonicalSubtotal), 185, y, { align: "right" }); y += 6;
    // Discount already shown in "Promotion appliquee" card above — show net subtotal in totals
    if (d.discount_amount > 0) {
      const netSubtotal = canonicalSubtotal - d.discount_amount;
      doc.text("Sous-total apres rabais", tx, y); doc.text(fmt(netSubtotal), 185, y, { align: "right" }); y += 6;
    }
    doc.text("TPS (5%)", tx, y); doc.text(fmt(d.tax_gst), 185, y, { align: "right" }); y += 6;
    doc.text("TVQ (9,975%)", tx, y); doc.text(fmt(d.tax_qst), 185, y, { align: "right" }); y += 8;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("TOTAL", tx, y); doc.text(fmt(d.total_due), 185, y, { align: "right" }); y += 12;

    // PROCHAINES ETAPES
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setFillColor(235, 242, 255);
    doc.rect(15, y, 170, 7, "F");
    doc.text("PROCHAINES ETAPES", 17, y + 5);
    y += 10;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const steps = [
      "1. Votre paiement a ete confirme avec succes.",
      "2. Notre equipe prepare votre commande pour livraison.",
      "3. Vous recevrez votre facture officielle et votre contrat.",
      "4. Votre service sera active dans les plus brefs delais.",
    ];
    for (const step of steps) {
      doc.text(step, 20, y);
      y += 6;
    }

    // FOOTER
    const ph = doc.internal.pageSize.getHeight();
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.text(
      `${NIVRA.tradeName} Inc. | ${NIVRA.email} | ${NIVRA.website}`,
      pw / 2, ph - 15, { align: "center" }
    );

    const blob = doc.output("blob");
    return {
      success: true,
      blob,
      filename: `Sommaire_${d.order_number}_Nivra.pdf`,
    };
  } catch (error: any) {
    console.error("[OrderSummaryV4] Generation error:", error);
    return { success: false, error: error?.message || "Erreur de generation" };
  }
}

export default generateOrderSummaryPDF;
