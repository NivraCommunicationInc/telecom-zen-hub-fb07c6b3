import { estimateTaxes } from "@/lib/pricing/serverTaxEngine";
/**
 * Nivra Contract Summary PDF Generator
 * Design exactement comme le PDF fourni "Resume_Contrat_CTR-QC-ORD-2026-1108.pdf"
 * 
 * Structure:
 * - Header: Teal bar + Navy header avec "NIVRA COMMUNICATIONS INC." + "RÉSUMÉ DU CONTRAT"
 * - Document reference box avec CTR#, ORD#, INV#, Compte#
 * - CLIENT section (fond navy)
 * - SERVICES SOUSCRITS section (fond navy)
 * - DATES ET CYCLE section (fond navy)
 * - BLOC B — FRAIS UNIQUES section (fond navy)
 * - PAIEMENT — INTERAC section (fond navy) avec notice importante
 * - ACCEPTATION section (fond navy)
 * - Signatures (Client + Nivra)
 */

import jsPDF from "jspdf";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { ContractSummaryData } from "@/components/contract/ContractSummaryView";
import { COMPANY_CONTACT } from "@/config/company";

// =============================================================================
// COLORS - Matching the provided PDF exactly
// =============================================================================

const COLORS = {
  headerBg: [15, 23, 42] as [number, number, number],        // #0F172A - Slate 900
  accentTeal: [20, 184, 166] as [number, number, number],    // #14B8A6 - Teal
  sectionHeader: [30, 41, 59] as [number, number, number],   // #1E293B - Slate 800 (pour les titres de section)
  text: [30, 41, 59] as [number, number, number],            // #1E293B
  textLight: [100, 116, 139] as [number, number, number],    // #64748B
  textMuted: [148, 163, 184] as [number, number, number],    // #94A3B8
  white: [255, 255, 255] as [number, number, number],
  background: [248, 250, 252] as [number, number, number],   // #F8FAFC
  border: [203, 213, 225] as [number, number, number],       // #CBD5E1
};

const PAGE = {
  width: 210,
  height: 297,
  marginLeft: 15,
  marginRight: 15,
  marginTop: 15,
  marginBottom: 15,
  get contentWidth() { return this.width - this.marginLeft - this.marginRight; },
};

// =============================================================================
// HELPERS
// =============================================================================

const formatCurrency = (amount: number | undefined) => {
  if (amount === undefined || amount === null) return "—";
  return new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" })
    .format(amount)
    .replace("CA", "")
    .trim();
};

const formatDate = (dateStr: string | undefined) => {
  if (!dateStr) return "À confirmer";
  try {
    return format(new Date(dateStr), "d MMMM yyyy", { locale: fr });
  } catch {
    return dateStr;
  }
};

// =============================================================================
// MAIN GENERATOR
// =============================================================================

export async function generateContractSummaryPDF(data: ContractSummaryData): Promise<void> {
  // Validation
  const requiredFields = ["legalName", "email", "phone", "serviceAddress"];
  const missingFields = requiredFields.filter(field => {
    const value = (data.client as any)[field];
    return !value || String(value).trim() === "";
  });
  
  const hasBillingAddress = (data.client as any).billingAddress || (data.client as any).serviceAddress;
  if (!hasBillingAddress) {
    missingFields.push("billingAddress");
  }
  
  if (missingFields.length > 0) {
    const errorMsg = `Coordonnées client incomplètes — impossible de générer le document. Champs manquants: ${missingFields.join(", ")}`;
    console.error("[ContractSummaryPDF] VALIDATION BLOCKED:", errorMsg);
    throw new Error(errorMsg);
  }

  const doc = new jsPDF();
  let y = PAGE.marginTop;

  // ==========================================================================
  // HEADER - Matching the PDF exactly
  // ==========================================================================
  
  // Top teal bar
  doc.setFillColor(...COLORS.accentTeal);
  doc.rect(0, 0, PAGE.width, 3, "F");
  
  // Main navy header
  doc.setFillColor(...COLORS.headerBg);
  doc.rect(0, 3, PAGE.width, 28, "F");
  
  // Company name
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...COLORS.white);
  doc.text("NIVRA COMMUNICATIONS INC.", PAGE.width / 2, 17, { align: "center" });
  
  // Document type
  doc.setFontSize(12);
  doc.setTextColor(...COLORS.accentTeal);
  doc.text("RÉSUMÉ DU CONTRAT", PAGE.width / 2, 26, { align: "center" });
  
  y = 38;
  
  // ==========================================================================
  // DOCUMENT REFERENCE BOX
  // ==========================================================================
  
  doc.setFillColor(...COLORS.background);
  doc.setDrawColor(...COLORS.border);
  doc.roundedRect(PAGE.marginLeft, y, PAGE.contentWidth, 22, 1, 1, "FD");
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.text);
  
  // Row 1: CTR#, ORD#, Date
  const contractNum = data.contractNumber || `CTR-${data.orderId?.slice(0, 8) || "UNKNOWN"}`;
  const orderNum = data.orderNumber || `ORD-${data.orderId?.slice(0, 8) || "UNKNOWN"}`;
  
  doc.text(`Contrat #: ${contractNum}`, PAGE.marginLeft + 5, y + 6);
  doc.text(`Commande #: ${orderNum}`, PAGE.marginLeft + 70, y + 6);
  doc.text(`Date: ${formatDate(data.snapshotCreatedAt)}`, PAGE.marginLeft + 140, y + 6);
  
  // Row 2: INV#, Compte#, Version
  doc.setFont("helvetica", "normal");
  const invoiceNum = (data as any).invoiceNumber || `INV-${data.orderId?.slice(0, 8) || "UNKNOWN"}`;
  const accountNum = data.accountNumber || data.client.accountId || "À confirmer";
  
  doc.text(`Facture #: ${invoiceNum}`, PAGE.marginLeft + 5, y + 14);
  doc.text(`Compte #: ${accountNum}`, PAGE.marginLeft + 70, y + 14);
  doc.text(`Version: ${data.agreementVersion || 1}`, PAGE.marginLeft + 140, y + 14);
  
  y += 28;
  
  // ==========================================================================
  // HELPER: Section Title (navy background like in the PDF)
  // ==========================================================================
  
  const addSectionTitle = (title: string) => {
    y += 3;
    doc.setFillColor(...COLORS.sectionHeader);
    doc.rect(PAGE.marginLeft, y, PAGE.contentWidth, 7, "F");
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.white);
    doc.text(title, PAGE.marginLeft + 3, y + 5);
    
    y += 10;
  };
  
  const addLabelValue = (label: string, value: string, labelWidth = 50) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.textLight);
    doc.text(`${label}:`, PAGE.marginLeft + 3, y);
    
    doc.setTextColor(...COLORS.text);
    doc.text(value || "À confirmer", PAGE.marginLeft + labelWidth, y);
    y += 5;
  };
  
  // ==========================================================================
  // CLIENT SECTION
  // ==========================================================================
  
  addSectionTitle("CLIENT");
  
  addLabelValue("Nom légal", data.client.legalName);
  addLabelValue("Téléphone", data.client.phone);
  addLabelValue("Courriel", data.client.email);
  
  const fullAddress = `${data.client.serviceAddress || ""}, ${data.client.serviceCity || ""} ${data.client.serviceProvince || "QC"} ${data.client.servicePostalCode || ""}`;
  addLabelValue("Adresse de service", fullAddress);
  addLabelValue("ID compte client", accountNum);
  
  // ==========================================================================
  // SERVICES SOUSCRITS
  // ==========================================================================
  
  addSectionTitle("SERVICES SOUSCRITS (DÉTAIL LIGNE PAR LIGNE)");
  
  // Calculate totals
  const totalMonthly = data.services.reduce((sum, s) => sum + (s.monthlyPrice || 0), 0) + 
    (data.tvChannels?.premiumTotal || 0);
  
  // Service types badge
  const serviceTypes = [...new Set(data.services.map(s => s.type.toUpperCase()))];
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.accentTeal);
  doc.text(serviceTypes.join(", "), PAGE.marginLeft + 3, y);
  
  // Service names + price
  const serviceNames = data.services.map(s => s.planName || s.type).join(", ");
  doc.setTextColor(...COLORS.text);
  doc.text(serviceNames, PAGE.marginLeft + 28, y);
  
  doc.text(`${formatCurrency(totalMonthly)}/mois`, PAGE.width - PAGE.marginRight - 3, y, { align: "right" });
  y += 6;
  
  // TV Channels info if applicable
  if (data.tvChannels) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.textMuted);
    doc.text(
      `Chaînes de base: ${data.tvChannels.baseChannels || 25}/26 | Au choix: ${data.tvChannels.freeChoiceCount || 0} | Premium: ${data.tvChannels.premiumCount || 0} (${formatCurrency(data.tvChannels.premiumTotal || 0)})`,
      PAGE.marginLeft + 10,
      y
    );
    y += 5;
  }
  
  // Subtotal
  doc.setDrawColor(...COLORS.border);
  doc.line(PAGE.marginLeft, y, PAGE.width - PAGE.marginRight, y);
  y += 5;
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.text);
  doc.text(`Sous-total mensuel (avant taxes): ${formatCurrency(totalMonthly)}/mois`, PAGE.marginLeft + 3, y);
  y += 8;
  
  // ==========================================================================
  // DATES ET CYCLE DE FACTURATION
  // ==========================================================================
  
  addSectionTitle("DATES ET CYCLE DE FACTURATION");
  
  addLabelValue("Date création compte", formatDate(data.dates.accountCreated));
  addLabelValue("Jour du cycle (Bill Cycle)", data.dates.billCycleDay ? String(data.dates.billCycleDay) : "À confirmer après paiement");
  addLabelValue("Date d'activation prévue", formatDate(data.dates.activationDate));
  addLabelValue("Prochaine facture", formatDate(data.dates.nextInvoiceDate));
  
  y += 2;
  
  // IMPORTANT notice box
  doc.setFillColor(...COLORS.background);
  doc.setDrawColor(...COLORS.accentTeal);
  doc.setLineWidth(0.8);
  doc.roundedRect(PAGE.marginLeft, y, PAGE.contentWidth, 14, 1, 1, "FD");
  doc.setLineWidth(0.2);
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.text);
  doc.text("IMPORTANT: Le cycle de facturation commence uniquement après confirmation du paiement Interac.", PAGE.marginLeft + 3, y + 5);
  
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.textMuted);
  doc.text("Les dates ci-dessus sont provisoires et seront confirmées à la réception du paiement.", PAGE.marginLeft + 3, y + 10);
  
  y += 18;
  
  // ==========================================================================
  // BLOC B — FRAIS UNIQUES
  // ==========================================================================
  
  addSectionTitle("BLOC B — FRAIS UNIQUES (UNE SEULE FOIS)");
  
  const fees = data.oneTimeFees;
  let oneTimeFeeTotal = 0;
  
  // Each fee on its own line
  if (fees.activationFee && fees.activationFee > 0) {
    const serviceCount = data.services.length;
    const feeLabel = serviceCount >= 2 ? "Frais d'activation (forfait groupé 2+ services)" : "Frais d'activation (1 service)";
    addLabelValue(feeLabel, formatCurrency(fees.activationFee), 90);
    oneTimeFeeTotal += fees.activationFee;
  }
  if (fees.deliveryFee && fees.deliveryFee > 0) {
    addLabelValue("Livraison standard Québec", formatCurrency(fees.deliveryFee), 90);
    oneTimeFeeTotal += fees.deliveryFee;
  }
  if (fees.router && fees.router > 0) {
    addLabelValue("Routeur Nivra Born WiFi", formatCurrency(fees.router), 90);
    oneTimeFeeTotal += fees.router;
  }
  if (fees.terminal4k && fees.terminal4k > 0) {
    addLabelValue("Terminal TV 4K", formatCurrency(fees.terminal4k), 90);
    oneTimeFeeTotal += fees.terminal4k;
  }
  if (fees.installationFee && fees.installationFee > 0) {
    addLabelValue("Installation standard", formatCurrency(fees.installationFee), 90);
    oneTimeFeeTotal += fees.installationFee;
  }
  
  // Totals
  const oneTimeTps = Math.round(oneTimeFeeTotal * 0.05 * 100) / 100;
  const oneTimeTvq = Math.round(oneTimeFeeTotal * 0.09975 * 100) / 100;
  const oneTimeTotalWithTax = oneTimeFeeTotal + oneTimeTps + oneTimeTvq;
  
  doc.setDrawColor(...COLORS.border);
  doc.line(PAGE.marginLeft, y, PAGE.width - PAGE.marginRight, y);
  y += 4;
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.setTextColor(...COLORS.textMuted);
  doc.text(`Sous-total unique: ${formatCurrency(oneTimeFeeTotal)} | TPS: ${formatCurrency(oneTimeTps)} | TVQ: ${formatCurrency(oneTimeTvq)}`, PAGE.marginLeft + 3, y);
  y += 4;
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.text);
  doc.text(`Total frais uniques avec taxes: ${formatCurrency(oneTimeTotalWithTax)}`, PAGE.marginLeft + 3, y);
  y += 5;
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.setTextColor(...COLORS.textMuted);
  doc.text("Frais de réactivation (si applicable après suspension): 15 $", PAGE.marginLeft + 3, y);
  y += 6;
  
  // ==========================================================================
  // PAIEMENT — INTERAC SEULEMENT
  // ==========================================================================
  
  addSectionTitle("PAIEMENT — INTERAC SEULEMENT");
  
  // Payment notice box
  doc.setFillColor(...COLORS.background);
  doc.setDrawColor(...COLORS.accentTeal);
  doc.setLineWidth(0.8);
  doc.roundedRect(PAGE.marginLeft, y, PAGE.contentWidth, 22, 1, 1, "FD");
  doc.setLineWidth(0.2);
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.text);
  doc.text(`Paiement uniquement par virement Interac à ${COMPANY_CONTACT.supportEmailDisplay}`, PAGE.marginLeft + 3, y + 6);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.textMuted);
  doc.text("Le service est activé dès réception et confirmation du paiement. Aucun paiement par carte n'est accepté.", PAGE.marginLeft + 3, y + 12);
  
  doc.setTextColor(...COLORS.accentTeal);
  doc.text("Le cycle de facturation commence uniquement à la date de confirmation du paiement Interac.", PAGE.marginLeft + 3, y + 18);
  
  y += 26;
  
  const methodLabel = data.payment.method === "card" ? "Carte (non disponible)" : 
                      data.payment.method === "etransfer" ? "Virement Interac ✓" : 
                      `Autre: ${data.payment.method}`;
  addLabelValue("Mode sélectionné", methodLabel, 50);
  
  // ==========================================================================
  // ACCEPTATION
  // ==========================================================================
  
  addSectionTitle("ACCEPTATION");
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.text);
  const acceptanceText = "Le Client déclare avoir lu et accepté : Annexe A — Termes & Conditions, Annexe B — Conditions spécifiques, Annexe C — Installation, Annexe D — Paiements, Annexe E — Support/SLA (si applicable).";
  const acceptLines = doc.splitTextToSize(acceptanceText, PAGE.contentWidth - 6);
  doc.text(acceptLines, PAGE.marginLeft + 3, y);
  y += acceptLines.length * 4 + 6;
  
  // ==========================================================================
  // FOOTER - Company info
  // ==========================================================================
  
  const footerY = PAGE.height - 35;
  
  // Company info centered
  doc.setFillColor(...COLORS.headerBg);
  doc.rect(PAGE.marginLeft, footerY, PAGE.contentWidth, 12, "F");
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.setTextColor(...COLORS.white);
  doc.text(
    `${COMPANY_CONTACT.legalName} — ${COMPANY_CONTACT.fullAddress}`,
    PAGE.width / 2,
    footerY + 5,
    { align: "center" }
  );
  doc.text(
    `${COMPANY_CONTACT.supportEmailDisplay} —`,
    PAGE.width / 2,
    footerY + 9,
    { align: "center" }
  );
  
  // Signatures
  const sigY = footerY + 15;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.text);
  doc.text("Signature Client: _________________", PAGE.marginLeft + 5, sigY);
  doc.text("Signature Nivra: _________________", PAGE.marginLeft + PAGE.contentWidth / 2 + 5, sigY);
  
  // Download
  const fileName = `Resume_Contrat_${data.contractNumber || data.orderNumber || data.orderId?.slice(0, 8) || "UNKNOWN"}.pdf`;
  doc.save(fileName);
}

export default generateContractSummaryPDF;
