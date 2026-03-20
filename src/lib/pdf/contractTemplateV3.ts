/**
 * Nivra Contract Template V4.0 — LOCKED PRODUCTION (2026-03-20)
 * 
 * Approved canonical layout — 3 pages:
 * Page 1: Header + Client + Sections 1-3
 * Page 2: Sections 4-7
 * Page 3: Sections 8-9 + Signatures + Footer
 */

import jsPDF from "jspdf";
import type { PDFGenerationResult } from "./types";
import { NIVRA } from "./companyInfo";

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

  // Promo info
  discount_label?: string;
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

function drawContractHeader(doc: jsPDF, contractNum: string) {
  const pw = doc.internal.pageSize.getWidth();
  doc.setFillColor(30, 64, 120);
  doc.rect(0, 0, pw, 40, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text("NIVRA TELECOM", 15, 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("CONTRAT DE SERVICE", 15, 28);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(`No ${contractNum}`, pw - 15, 18, { align: "right" });
}

function drawFooter(doc: jsPDF) {
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text(
    `${NIVRA.tradeName} Inc. | ${NIVRA.email} | ${NIVRA.website}`,
    pw / 2, ph - 10, { align: "center" }
  );
}

function sectionTitle(doc: jsPDF, num: number, title: string, y: number): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.text(`${num}. ${title}`, 15, y);
  return y + 9;
}

function bulletPoints(doc: jsPDF, items: string[], y: number): number {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  for (const item of items) {
    // Handle long text wrapping
    const lines = doc.splitTextToSize(`- ${item}`, 165);
    for (const line of lines) {
      if (y > 275) { doc.addPage(); y = 20; }
      doc.text(line, 20, y);
      y += 5;
    }
    y += 1;
  }
  return y;
}

// ============================================================================
// MAIN GENERATOR
// ============================================================================

export function generateContractV3PDF(data: ContractDataV3): PDFGenerationResult {
  try {
    if (!data.contract_number) return { success: false, error: "Numero de contrat manquant" };

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    // ===== PAGE 1 =====
    drawContractHeader(doc, data.contract_number);

    // Client block
    let y = 50;
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Titulaire du compte", 15, y);
    doc.text("Adresse de service", 110, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(data.client_name, 15, y);
    const addrParts = (data.service_address || "").split(",").map(s => s.trim());
    doc.text(addrParts[0] || "", 110, y);
    y += 5;
    doc.text(data.client_email, 15, y);
    if (addrParts.length > 1) doc.text(addrParts.slice(1).join(", "), 110, y);
    y += 5;
    if (data.client_phone) { doc.text(data.client_phone, 15, y); y += 5; }
    doc.setFontSize(8);
    doc.text(`Compte: ${data.account_number}  |  Commande: ${data.order_number}`, 15, y);
    y += 12;

    // Section 1: SERVICE ET TARIFICATION
    y = sectionTitle(doc, 1, "SERVICE ET TARIFICATION", y);
    const svcItems: string[] = [];
    for (const svc of data.services) {
      svcItems.push(`Service: ${svc.name}`);
      svcItems.push(`Tarif mensuel recurrent: ${fmt(svc.monthly_price)}/mois (avant taxes)`);
    }
    svcItems.push(`Date de debut du service: ${fmtDate(data.contract_date)}`);
    svcItems.push("Cycle de facturation: Mensuel");
    y = bulletPoints(doc, svcItems, y);
    y += 5;

    // Section 2: FRAIS INITIAUX ET PROMOTION
    y = sectionTitle(doc, 2, "FRAIS INITIAUX ET PROMOTION", y);
    const feeItems: string[] = [];
    for (const eq of data.equipment) {
      feeItems.push(`Equipement (${eq.name}): ${fmt(eq.unit_price * eq.quantity)}`);
    }
    for (const fee of data.one_time_fees) {
      feeItems.push(`${fee.label}: ${fmt(fee.amount)}`);
    }
    feeItems.push(`Total frais uniques: ${fmt(data.subtotal_one_time)}`);
    if (data.discount_amount > 0) {
      feeItems.push(`${data.discount_label || "Promotion"}: ${fmt(-data.discount_amount)}`);
    }
    const taxableBase = data.total_due_today - data.tax_gst - data.tax_qst;
    feeItems.push(`Sous-total apres promotion: ${fmt(taxableBase)}`);
    feeItems.push(`TPS (5%): ${fmt(data.tax_gst)} | TVQ (9,975%): ${fmt(data.tax_qst)}`);
    feeItems.push(`Total paye aujourd'hui: ${fmt(data.total_due_today)}`);
    y = bulletPoints(doc, feeItems, y);
    y += 5;

    // Section 3: CONDITIONS DE PAIEMENT
    y = sectionTitle(doc, 3, "CONDITIONS DE PAIEMENT", y);
    y = bulletPoints(doc, [
      "Le paiement mensuel est exigible selon le cycle de facturation.",
      "Les methodes de paiement acceptees sont: carte de credit, PayPal, virement Interac.",
      "Tout paiement en retard peut entrainer des frais de retard de 5.00 $.",
      "En cas de non-paiement apres 30 jours, le service pourra etre suspendu.",
    ], y);

    // ===== PAGE 2 =====
    doc.addPage();
    y = 20;

    // Section 4
    y = sectionTitle(doc, 4, "PRELEVEMENTS AUTOMATIQUES (AUTOPAY)", y);
    y = bulletPoints(doc, [
      "L'activation du prelevement automatique accorde un rabais de 5.00 $/mois.",
      "Le client peut activer ou desactiver l'autopay a tout moment via son portail.",
      "La desactivation de l'autopay entraine le retrait immediat du rabais mensuel.",
      "Le prelevement est effectue automatiquement a la date d'echeance de la facture.",
    ], y);
    y += 5;

    // Section 5
    y = sectionTitle(doc, 5, "RESILIATION ET ANNULATION", y);
    y = bulletPoints(doc, [
      "Le client peut resilier son service a tout moment sans penalite.",
      "Nivra est un service prepaye: il n'y a aucun engagement contractuel a long terme.",
      "La resiliation prend effet a la fin de la periode de facturation en cours.",
      "Aucun remboursement n'est accorde pour la periode en cours deja payee.",
      "L'equipement loue doit etre retourne dans les 14 jours suivant la resiliation.",
    ], y);
    y += 5;

    // Section 6
    y = sectionTitle(doc, 6, "SUSPENSION POUR NON-PAIEMENT", y);
    y = bulletPoints(doc, [
      "En cas de non-paiement de 30 jours ou plus, Nivra se reserve le droit de suspendre le service.",
      "La reactivation est conditionnelle au paiement integral du solde impaye.",
      "Des frais de reactivation de 15.00 $ peuvent s'appliquer.",
    ], y);
    y += 5;

    // Section 7
    y = sectionTitle(doc, 7, "MODIFICATION DES TARIFS", y);
    y = bulletPoints(doc, [
      "Nivra se reserve le droit de modifier ses tarifs avec un preavis ecrit de 30 jours.",
      "Le client peut resilier sans penalite dans les 30 jours suivant un avis de modification.",
    ], y);

    // ===== PAGE 3 =====
    doc.addPage();
    y = 20;

    // Section 8
    y = sectionTitle(doc, 8, "LIMITATION DE RESPONSABILITE", y);
    y = bulletPoints(doc, [
      "Nivra ne peut etre tenue responsable des interruptions de service liees a des facteurs externes (pannes reseau, catastrophes naturelles, interventions de tiers).",
      "La responsabilite maximale de Nivra est limitee au montant des frais mensuels du client pour le mois en cours.",
      "Nivra ne garantit pas une disponibilite de service de 100% et n'est pas responsable des pertes indirectes ou consequentielles.",
    ], y);
    y += 5;

    // Section 9
    y = sectionTitle(doc, 9, "LOI APPLICABLE", y);
    y = bulletPoints(doc, [
      "Ce contrat est regi par les lois de la province de Quebec, Canada.",
      "Tout litige sera soumis aux tribunaux competents du district judiciaire de Montreal.",
      "Les dispositions de la Loi sur la protection du consommateur (Quebec) s'appliquent.",
    ], y);
    y += 15;

    // SIGNATURES
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("SIGNATURES", 15, y);
    doc.setDrawColor(0, 0, 0);
    doc.line(15, y + 1.5, 185, y + 1.5);
    y += 12;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("Client:", 15, y);
    doc.text("Nivra Telecom Inc.:", 110, y);
    y += 15;
    doc.line(15, y, 90, y);
    doc.line(110, y, 185, y);
    y += 5;
    doc.text(data.client_name, 15, y);
    doc.text(data.admin_signature_name || "Representant autorise", 110, y);
    y += 5;
    doc.setFontSize(8);
    doc.text(data.is_signed ? `Date: ${fmtDate(data.signature_date)}` : "Date: En attente de signature", 15, y);
    doc.text(`Date: ${fmtDate(data.contract_date)}`, 110, y);
    y += 10;

    // Contract generation note
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    const note = `Ce contrat a ete genere automatiquement le ${fmtDate(data.contract_date)}. Contrat No ${data.contract_number}. En signant ce document, le client confirme avoir lu et accepte les termes et conditions ci-dessus.`;
    const noteLines = doc.splitTextToSize(note, 170);
    for (const nl of noteLines) {
      doc.text(nl, 15, y);
      y += 4;
    }

    // Footer on all pages
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      drawFooter(doc);
    }

    const blob = doc.output("blob");
    return {
      success: true,
      blob,
      filename: `Contrat_${data.contract_number}_Nivra.pdf`,
    };
  } catch (error: any) {
    console.error("[ContractV4] Generation error:", error);
    return { success: false, error: error?.message || "Erreur de generation" };
  }
}

export default generateContractV3PDF;
