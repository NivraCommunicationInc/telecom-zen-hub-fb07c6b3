/**
 * Generate a standalone PDF for Contract Summary (Résumé du contrat)
 */

import jsPDF from "jspdf";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { ContractSummaryData } from "@/components/contract/ContractSummaryView";
import { BUSINESS_INFO } from "./contractPolicies";

const formatCurrency = (amount: number | undefined) => {
  if (amount === undefined || amount === null) return "—";
  return new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(amount);
};

const formatDate = (dateStr: string | undefined) => {
  if (!dateStr) return "À confirmer";
  try {
    return format(new Date(dateStr), "d MMMM yyyy", { locale: fr });
  } catch {
    return dateStr;
  }
};

export async function generateContractSummaryPDF(data: ContractSummaryData): Promise<void> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginLeft = 15;
  const marginRight = 15;
  const contentWidth = pageWidth - marginLeft - marginRight;
  let currentY = 15;

  // Colors
  const primaryNavy: [number, number, number] = [15, 23, 42];
  const accentTeal: [number, number, number] = [20, 184, 166];
  const textDark: [number, number, number] = [30, 41, 59];
  const textMuted: [number, number, number] = [100, 116, 139];
  const borderLight: [number, number, number] = [203, 213, 225];
  const bgLight: [number, number, number] = [248, 250, 252];
  const white: [number, number, number] = [255, 255, 255];

  // Helper to add section title
  const addSectionTitle = (title: string) => {
    currentY += 4;
    doc.setFillColor(...primaryNavy);
    doc.rect(marginLeft, currentY - 3, contentWidth, 6, "F");
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...white);
    doc.text(title.toUpperCase(), marginLeft + 2, currentY + 1);
    currentY += 8;
  };

  const addLabelValue = (label: string, value: string) => {
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...textMuted);
    doc.text(`${label}:`, marginLeft, currentY);
    doc.setTextColor(...textDark);
    doc.text(value || "À confirmer", marginLeft + 50, currentY);
    currentY += 4.5;
  };

  // ========== HEADER ==========
  doc.setFillColor(...accentTeal);
  doc.rect(0, 0, pageWidth, 3, "F");
  doc.setFillColor(...primaryNavy);
  doc.rect(0, 3, pageWidth, 22, "F");

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...white);
  doc.text("NIVRA COMMUNICATIONS INC.", pageWidth / 2, 12, { align: "center" });

  doc.setFontSize(10);
  doc.setTextColor(...accentTeal);
  doc.text("RÉSUMÉ DU CONTRAT", pageWidth / 2, 20, { align: "center" });

  currentY = 32;

  // Contract reference
  doc.setFillColor(...bgLight);
  doc.setDrawColor(...borderLight);
  doc.roundedRect(marginLeft, currentY, contentWidth, 12, 1, 1, "FD");
  doc.setFontSize(7);
  doc.setTextColor(...textDark);
  doc.text(`Contrat #: ${data.contractNumber || data.orderNumber || data.orderId.slice(0, 8)}`, marginLeft + 3, currentY + 5);
  doc.text(`Version: ${data.agreementVersion || 1}`, marginLeft + 80, currentY + 5);
  doc.text(`Date: ${formatDate(data.snapshotCreatedAt)}`, marginLeft + 120, currentY + 5);
  currentY += 18;

  // ========== CLIENT SECTION ==========
  addSectionTitle("Client");
  addLabelValue("Nom légal", data.client.legalName);
  addLabelValue("Téléphone", data.client.phone);
  addLabelValue("Courriel", data.client.email);
  addLabelValue("Adresse de service", `${data.client.serviceAddress || ""}, ${data.client.serviceCity || ""} ${data.client.serviceProvince || "QC"} ${data.client.servicePostalCode || ""}`);
  if (data.client.billingAddress && data.client.billingAddress !== data.client.serviceAddress) {
    addLabelValue("Adresse de facturation", data.client.billingAddress);
  }
  addLabelValue("ID compte client", data.accountNumber || data.client.accountId || "À confirmer");
  currentY += 2;

  // ========== SERVICES SECTION ==========
  addSectionTitle("Services souscrits");
  
  const totalMonthly = data.services.reduce((sum, s) => sum + (s.monthlyPrice || 0), 0) + 
    (data.tvChannels?.premiumTotal || 0);

  data.services.forEach(service => {
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...textDark);
    doc.text(`☐ ${service.type}`, marginLeft, currentY);
    doc.setFont("helvetica", "normal");
    doc.text(`— Forfait: ${service.planName}`, marginLeft + 25, currentY);
    if (service.speed) {
      doc.text(`| Vitesse: ${service.speed}`, marginLeft + 90, currentY);
    }
    doc.text(`| Prix/mois: ${formatCurrency(service.monthlyPrice)}`, marginLeft + 130, currentY);
    currentY += 4.5;

    if (service.portability) {
      doc.setTextColor(...textMuted);
      doc.text(`   Portabilité: Oui | Numéro: ${service.numberToPort || "À confirmer"}`, marginLeft + 5, currentY);
      currentY += 4;
    }
  });

  // TV Channels
  if (data.tvChannels) {
    currentY += 2;
    doc.setTextColor(...textMuted);
    doc.setFontSize(6);
    doc.text(`Base Channels: ${data.tvChannels.baseChannels || 25}/26 (obligatoires)`, marginLeft + 5, currentY);
    currentY += 3.5;
    doc.text(`Free-Choice: ${data.tvChannels.freeChoiceCount || 0} chaînes | Premium: ${data.tvChannels.premiumCount || 0} chaînes (${formatCurrency(data.tvChannels.premiumTotal || 0)})`, marginLeft + 5, currentY);
    currentY += 4;
  }

  doc.setDrawColor(...borderLight);
  doc.line(marginLeft, currentY, pageWidth - marginRight, currentY);
  currentY += 4;
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...primaryNavy);
  doc.setFontSize(8);
  doc.text(`Total mensuel estimé: ${formatCurrency(totalMonthly)}/mois`, marginLeft, currentY);
  currentY += 6;

  // ========== DATES SECTION ==========
  addSectionTitle("Dates et facturation");
  addLabelValue("Date création compte", formatDate(data.dates.accountCreated));
  addLabelValue("Bill Cycle (jour)", data.dates.billCycleDay ? String(data.dates.billCycleDay) : "À confirmer");
  addLabelValue("Date activation/installation", formatDate(data.dates.activationDate));
  addLabelValue("Prochaine facture", formatDate(data.dates.nextInvoiceDate));
  if (data.dates.dueDate) {
    addLabelValue("Échéance", formatDate(data.dates.dueDate));
  }
  currentY += 2;

  // ========== ONE-TIME FEES ==========
  addSectionTitle("Frais uniques / équipements vendus");

  const fees = data.oneTimeFees;
  if (fees.router && fees.router > 0) addLabelValue("Routeur", formatCurrency(fees.router));
  if (fees.terminal4k && fees.terminal4k > 0) addLabelValue("Terminal 4K", formatCurrency(fees.terminal4k));
  if (fees.activationFee && fees.activationFee > 0) addLabelValue("Frais d'activation", formatCurrency(fees.activationFee));
  if (fees.installationFee && fees.installationFee > 0) addLabelValue("Frais d'installation (standard)", formatCurrency(fees.installationFee));
  if (fees.installationComplex && fees.installationComplex > 0) addLabelValue("Frais d'installation (complexe)", formatCurrency(fees.installationComplex));
  if (fees.deliveryFee && fees.deliveryFee > 0) addLabelValue("Frais de livraison", formatCurrency(fees.deliveryFee));
  
  doc.setTextColor(...textMuted);
  doc.setFontSize(6);
  doc.text("Frais de réactivation (rappel): 15 $", marginLeft, currentY);
  currentY += 6;

  // ========== PAYMENT SECTION ==========
  addSectionTitle("Paiement");
  const methodLabel = data.payment.method === "card" ? "Carte" : 
                      data.payment.method === "etransfer" ? "e-Transfer" : 
                      `Autre: ${data.payment.method}`;
  addLabelValue("Mode", `☐ ${methodLabel}`);
  if (data.payment.method === "etransfer" && data.payment.etransferRule) {
    const ruleLabel = data.payment.etransferRule === "after_receipt" 
      ? "Après réception" 
      : "Après réception et vérification";
    addLabelValue("Règle activation", `☐ ${ruleLabel}`);
  }
  if (data.payment.deposit && data.payment.deposit > 0) {
    addLabelValue("Dépôt", formatCurrency(data.payment.deposit));
    if (data.payment.depositConditions) {
      addLabelValue("Conditions dépôt", data.payment.depositConditions);
    }
  }
  currentY += 4;

  // ========== ACCEPTANCE SECTION ==========
  addSectionTitle("Acceptation");
  doc.setFontSize(6);
  doc.setTextColor(...textDark);
  const acceptanceText = "Le Client déclare avoir lu et accepté : Annexe A — Termes & Conditions, Annexe B — Conditions spécifiques, Annexe C — Installation, Annexe D — Paiements, Annexe E — Support/SLA (si applicable).";
  const lines = doc.splitTextToSize(acceptanceText, contentWidth);
  doc.text(lines, marginLeft, currentY);
  currentY += lines.length * 3.5 + 6;

  // Signature boxes
  const sigBoxWidth = (contentWidth - 10) / 2;
  const sigBoxHeight = 25;

  // Client signature
  doc.setDrawColor(...borderLight);
  doc.setFillColor(...bgLight);
  doc.roundedRect(marginLeft, currentY, sigBoxWidth, sigBoxHeight, 1, 1, "FD");
  doc.setFontSize(6);
  doc.setTextColor(...textMuted);
  doc.text("Signature Client: _________________", marginLeft + 3, currentY + 10);
  doc.text("Date: ___/___/______", marginLeft + 3, currentY + 18);

  // Nivra signature
  doc.setFillColor(...primaryNavy);
  doc.roundedRect(marginLeft + sigBoxWidth + 10, currentY, sigBoxWidth, sigBoxHeight, 1, 1, "F");
  doc.setTextColor(...white);
  doc.text("Signature Nivra: _________________", marginLeft + sigBoxWidth + 13, currentY + 10);
  doc.text("Date: ___/___/______", marginLeft + sigBoxWidth + 13, currentY + 18);

  // Footer
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(5);
  doc.setTextColor(...textMuted);
  doc.text(
    `${BUSINESS_INFO.legalName} — ${BUSINESS_INFO.address} — ${BUSINESS_INFO.email}`,
    pageWidth / 2,
    pageHeight - 8,
    { align: "center" }
  );

  // Download
  const fileName = `Resume_Contrat_${data.contractNumber || data.orderNumber || data.orderId.slice(0, 8)}.pdf`;
  doc.save(fileName);
}

export default generateContractSummaryPDF;
