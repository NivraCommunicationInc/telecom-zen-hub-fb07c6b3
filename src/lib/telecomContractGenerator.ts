import jsPDF from "jspdf";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  BUSINESS_INFO,
  CONTRACT_TERMS,
  LATE_PAYMENT_POLICY,
  LATE_PAYMENT_POLICY_EN,
  WARRANTY_POLICY,
  CANCELLATION_POLICY,
  NO_CREDIT_CHECK_POLICY,
} from "./contractPolicies";

export interface TelecomContractData {
  contractNumber: string;
  // Client Info
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  clientAccountNumber?: string;
  serviceAddress?: string;
  serviceCity?: string;
  serviceProvince?: string;
  servicePostalCode?: string;
  // Identity Validation
  idType?: string;
  idNumber?: string;
  idProvince?: string;
  idExpiration?: string;
  // Order Info
  orderNumber?: string;
  orderDate: string;
  servicePlan: string;
  bundleName?: string;
  category?: string;
  // Pricing
  subtotal: number;
  deliveryFee?: number;
  activationFee?: number;
  installationFee?: number;
  equipmentFee?: number;
  discountAmount?: number;
  tpsAmount: number;
  tvqAmount: number;
  totalAmount: number;
  // Equipment
  routerSerial?: string;
  terminalSerial?: string;
  simNumber?: string;
  imeiNumber?: string;
  // Status
  isSigned: boolean;
  signedAt?: string;
}

export const generateTelecomContractPDF = (data: TelecomContractData): jsPDF => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let currentY = margin;
  let pageNumber = 1;
  
  // Colors
  const navyColor: [number, number, number] = [10, 25, 47];
  const cyanAccent: [number, number, number] = [0, 188, 212];
  const darkText: [number, number, number] = [33, 33, 33];
  const grayText: [number, number, number] = [100, 100, 100];
  const lightGray: [number, number, number] = [245, 247, 250];
  
  const addNewPage = () => {
    addFooter();
    doc.addPage();
    pageNumber++;
    currentY = 25;
    addPageHeader();
  };
  
  const checkPageBreak = (neededHeight: number) => {
    if (currentY + neededHeight > pageHeight - 35) {
      addNewPage();
    }
  };
  
  const addPageHeader = () => {
    if (pageNumber > 1) {
      doc.setFillColor(...cyanAccent);
      doc.rect(0, 0, pageWidth, 3, "F");
      doc.setFillColor(...navyColor);
      doc.rect(0, 3, pageWidth, 15, "F");
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.text(BUSINESS_INFO.name.toUpperCase(), margin, 12);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(`Contrat N° ${data.contractNumber}`, pageWidth - margin, 12, { align: "right" });
      currentY = 25;
    }
  };
  
  const addFooter = () => {
    doc.setFillColor(...cyanAccent);
    doc.rect(0, pageHeight - 10, pageWidth, 2, "F");
    doc.setFontSize(6);
    doc.setTextColor(...grayText);
    doc.text(`${BUSINESS_INFO.legalName} | ${BUSINESS_INFO.phone} | ${BUSINESS_INFO.email}`, pageWidth / 2, pageHeight - 5, { align: "center" });
    doc.text(`Page ${pageNumber}`, pageWidth - margin, pageHeight - 5, { align: "right" });
    
    // Initials boxes
    doc.setDrawColor(...grayText);
    doc.setLineWidth(0.3);
    doc.rect(margin, pageHeight - 20, 18, 7);
    doc.rect(margin + 22, pageHeight - 20, 18, 7);
    doc.setFontSize(5);
    doc.text("Client", margin + 9, pageHeight - 22, { align: "center" });
    doc.text("Nivra", margin + 31, pageHeight - 22, { align: "center" });
  };
  
  const addSectionTitle = (titleFr: string, titleEn: string) => {
    checkPageBreak(16);
    currentY += 4;
    doc.setFillColor(...navyColor);
    doc.roundedRect(margin, currentY - 4, contentWidth, 9, 1, 1, "F");
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text(`${titleFr} / ${titleEn}`, margin + 4, currentY + 2);
    currentY += 10;
  };
  
  const addParagraph = (text: string, fontSize: number = 8, indent: number = 0) => {
    doc.setFontSize(fontSize);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...darkText);
    const lines = doc.splitTextToSize(text, contentWidth - indent);
    const lineHeight = fontSize * 0.4;
    checkPageBreak(lines.length * lineHeight + 3);
    doc.text(lines, margin + indent, currentY);
    currentY += lines.length * lineHeight + 2;
  };
  
  const addBilingualParagraph = (textFr: string, textEn: string, fontSize: number = 8) => {
    addParagraph(textFr, fontSize);
    currentY += 1;
    doc.setTextColor(...grayText);
    addParagraph(textEn, fontSize - 0.5);
    currentY += 2;
  };
  
  const addKeyValueRow = (keyFr: string, keyEn: string, value: string, y: number, x: number = margin) => {
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...grayText);
    doc.text(`${keyFr} / ${keyEn}:`, x, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...darkText);
    doc.text(value, x + 50, y);
    return y + 5;
  };
  
  // ========== PAGE 1: COVER ==========
  doc.setFillColor(...cyanAccent);
  doc.rect(0, 0, pageWidth, 4, "F");
  doc.setFillColor(...navyColor);
  doc.rect(0, 4, pageWidth, 45, "F");
  
  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text(BUSINESS_INFO.name.toUpperCase(), pageWidth / 2, 25, { align: "center" });
  doc.setFontSize(10);
  doc.setTextColor(...cyanAccent);
  doc.text("CONTRAT DE SERVICES TÉLÉCOM / TELECOM SERVICES CONTRACT", pageWidth / 2, 38, { align: "center" });
  doc.setFontSize(8);
  doc.setTextColor(200, 200, 200);
  doc.text(`${BUSINESS_INFO.phone} • ${BUSINESS_INFO.email}`, pageWidth / 2, 46, { align: "center" });
  
  currentY = 60;
  
  // Contract metadata
  doc.setFillColor(...lightGray);
  doc.roundedRect(margin, currentY, contentWidth, 25, 2, 2, "F");
  
  doc.setFontSize(7);
  let metaY = currentY + 7;
  metaY = addKeyValueRow("Contrat N°", "Contract #", data.contractNumber, metaY, margin + 5);
  metaY = addKeyValueRow("Date", "Date", format(new Date(data.orderDate), "d MMMM yyyy", { locale: fr }), metaY, margin + 5);
  if (data.orderNumber) {
    addKeyValueRow("Commande", "Order", data.orderNumber, currentY + 7, margin + 100);
  }
  addKeyValueRow("Version", "Version", CONTRACT_TERMS.version, currentY + 12, margin + 100);
  
  currentY += 32;
  
  // Parties
  addSectionTitle("LES PARTIES", "THE PARTIES");
  
  const partyWidth = (contentWidth - 8) / 2;
  
  // Provider
  doc.setFillColor(...navyColor);
  doc.roundedRect(margin, currentY, partyWidth, 35, 2, 2, "F");
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...cyanAccent);
  doc.text("LE PRESTATAIRE / THE PROVIDER", margin + 4, currentY + 8);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(255, 255, 255);
  doc.text(BUSINESS_INFO.legalName, margin + 4, currentY + 15);
  doc.text(BUSINESS_INFO.address, margin + 4, currentY + 20);
  doc.text(BUSINESS_INFO.phone, margin + 4, currentY + 25);
  doc.text(BUSINESS_INFO.email, margin + 4, currentY + 30);
  
  // Client
  const clientX = margin + partyWidth + 8;
  doc.setFillColor(...lightGray);
  doc.roundedRect(clientX, currentY, partyWidth, 35, 2, 2, "F");
  doc.setDrawColor(...cyanAccent);
  doc.setLineWidth(1);
  doc.line(clientX, currentY + 2, clientX, currentY + 33);
  
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...navyColor);
  doc.text("LE CLIENT / THE CLIENT", clientX + 4, currentY + 8);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...darkText);
  doc.text(data.clientName, clientX + 4, currentY + 15);
  doc.text(data.clientEmail, clientX + 4, currentY + 20);
  if (data.clientPhone) doc.text(data.clientPhone, clientX + 4, currentY + 25);
  if (data.clientAccountNumber) {
    doc.setFont("helvetica", "bold");
    doc.text(`# ${data.clientAccountNumber}`, clientX + 4, currentY + 30);
  }
  
  currentY += 42;
  
  // Service Address
  if (data.serviceAddress) {
    addSectionTitle("ADRESSE DE SERVICE", "SERVICE ADDRESS");
    const fullAddress = [
      data.serviceAddress,
      data.serviceCity,
      data.serviceProvince || "QC",
      data.servicePostalCode
    ].filter(Boolean).join(", ");
    addParagraph(fullAddress, 9);
    currentY += 3;
  }
  
  // Services Ordered
  addSectionTitle("SERVICES COMMANDÉS", "ORDERED SERVICES");
  
  doc.setFillColor(...lightGray);
  doc.roundedRect(margin, currentY, contentWidth, 22, 2, 2, "F");
  
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...navyColor);
  doc.text(data.servicePlan, margin + 5, currentY + 8);
  
  if (data.bundleName) {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...grayText);
    doc.text(`Forfait / Bundle: ${data.bundleName}`, margin + 5, currentY + 14);
  }
  if (data.category) {
    doc.text(`Catégorie / Category: ${data.category}`, margin + 5, currentY + 19);
  }
  
  currentY += 28;
  
  addFooter();
  
  // ========== PAGE 2: PRICING & EQUIPMENT ==========
  addNewPage();
  
  addSectionTitle("DÉTAILS FINANCIERS", "FINANCIAL DETAILS");
  
  // Pricing table
  doc.setFillColor(...lightGray);
  doc.roundedRect(margin, currentY, contentWidth, 55, 2, 2, "F");
  
  let priceY = currentY + 8;
  const priceCol1 = margin + 5;
  const priceCol2 = pageWidth - margin - 30;
  
  const addPriceRow = (labelFr: string, labelEn: string, amount: number, isNegative: boolean = false) => {
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...darkText);
    doc.text(`${labelFr} / ${labelEn}`, priceCol1, priceY);
    doc.setFont("helvetica", "bold");
    if (isNegative) {
      doc.setTextColor(34, 197, 94);
      doc.text(`-${amount.toFixed(2)} $`, priceCol2, priceY, { align: "right" });
    } else {
      doc.text(`${amount.toFixed(2)} $`, priceCol2, priceY, { align: "right" });
    }
    doc.setTextColor(...darkText);
    priceY += 5;
  };
  
  addPriceRow("Sous-total", "Subtotal", data.subtotal);
  if (data.deliveryFee && data.deliveryFee > 0) addPriceRow("Livraison", "Delivery", data.deliveryFee);
  if (data.activationFee && data.activationFee > 0) addPriceRow("Activation", "Activation", data.activationFee);
  if (data.installationFee && data.installationFee > 0) addPriceRow("Installation", "Installation", data.installationFee);
  if (data.equipmentFee && data.equipmentFee > 0) addPriceRow("Équipement", "Equipment", data.equipmentFee);
  if (data.discountAmount && data.discountAmount > 0) addPriceRow("Rabais", "Discount", data.discountAmount, true);
  addPriceRow("TPS (5%)", "GST (5%)", data.tpsAmount);
  addPriceRow("TVQ (9.975%)", "QST (9.975%)", data.tvqAmount);
  
  priceY += 2;
  doc.setDrawColor(...cyanAccent);
  doc.setLineWidth(0.5);
  doc.line(priceCol1, priceY - 3, priceCol2, priceY - 3);
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...navyColor);
  doc.text("TOTAL:", priceCol1, priceY + 2);
  doc.text(`${data.totalAmount.toFixed(2)} $ CAD`, priceCol2, priceY + 2, { align: "right" });
  
  currentY += 62;
  
  // Equipment
  if (data.routerSerial || data.terminalSerial || data.simNumber) {
    addSectionTitle("ÉQUIPEMENT ASSIGNÉ", "ASSIGNED EQUIPMENT");
    
    doc.setFillColor(...lightGray);
    const equipHeight = 35;
    doc.roundedRect(margin, currentY, contentWidth, equipHeight, 2, 2, "F");
    
    let eqY = currentY + 8;
    
    if (data.routerSerial) {
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...navyColor);
      doc.text("Nivra Born Wifi Router:", margin + 5, eqY);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...darkText);
      doc.text(`S/N: ${data.routerSerial} | Garantie: 1 an`, margin + 55, eqY);
      eqY += 7;
    }
    
    if (data.terminalSerial) {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...navyColor);
      doc.text("Nivra 4K Smart Terminal:", margin + 5, eqY);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...darkText);
      doc.text(`S/N: ${data.terminalSerial} | Garantie: 1 an`, margin + 55, eqY);
      eqY += 7;
    }
    
    if (data.simNumber || data.imeiNumber) {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...navyColor);
      doc.text("SIM/eSIM:", margin + 5, eqY);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...darkText);
      const simInfo = [data.simNumber ? `SIM: ${data.simNumber}` : null, data.imeiNumber ? `IMEI: ${data.imeiNumber}` : null].filter(Boolean).join(" | ");
      doc.text(simInfo, margin + 55, eqY);
    }
    
    currentY += equipHeight + 5;
  }
  
  // Identity
  if (data.idType && data.idNumber) {
    addSectionTitle("VALIDATION D'IDENTITÉ", "IDENTITY VALIDATION");
    
    doc.setFillColor(...lightGray);
    doc.roundedRect(margin, currentY, contentWidth, 20, 2, 2, "F");
    
    doc.setFontSize(7);
    let idY = currentY + 8;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...darkText);
    doc.text(`Type: ${data.idType}`, margin + 5, idY);
    doc.text(`N°: ${data.idNumber}`, margin + 50, idY);
    if (data.idProvince) doc.text(`Province: ${data.idProvince}`, margin + 100, idY);
    if (data.idExpiration) doc.text(`Exp: ${data.idExpiration}`, margin + 140, idY);
    
    currentY += 26;
  }
  
  // ========== PAGE 3: POLICIES (FRENCH) ==========
  addNewPage();
  
  addSectionTitle("POLITIQUES ET CONDITIONS", "POLICIES AND TERMS");
  
  // Late Payment
  doc.setFillColor(255, 245, 245);
  doc.roundedRect(margin, currentY, contentWidth, 38, 2, 2, "F");
  doc.setDrawColor(220, 50, 50);
  doc.setLineWidth(0.8);
  doc.line(margin, currentY, margin, currentY + 38);
  
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(180, 50, 50);
  doc.text("⚠ PAIEMENT EN RETARD / LATE PAYMENT", margin + 5, currentY + 7);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.setTextColor(...darkText);
  const lateLines = doc.splitTextToSize(`Intérêt de ${CONTRACT_TERMS.paymentTerms.lateInterestRate}% par mois sur tout solde impayé après ${CONTRACT_TERMS.paymentTerms.dueDays} jours. / ${CONTRACT_TERMS.paymentTerms.lateInterestRate}% monthly interest on any unpaid balance after ${CONTRACT_TERMS.paymentTerms.dueDays} days.`, contentWidth - 10);
  doc.text(lateLines, margin + 5, currentY + 14);
  
  currentY += 45;
  
  // Warranty
  addBilingualParagraph(
    `GARANTIE: ${WARRANTY_POLICY.fr.split('\n').slice(1, 3).join(' ')}`,
    `WARRANTY: ${WARRANTY_POLICY.en.split('\n').slice(1, 3).join(' ')}`
  );
  
  // Cancellation
  addBilingualParagraph(
    `ANNULATION: ${CANCELLATION_POLICY.fr.split('\n').slice(1, 4).join(' ')}`,
    `CANCELLATION: ${CANCELLATION_POLICY.en.split('\n').slice(1, 4).join(' ')}`
  );
  
  // No Credit Check
  addBilingualParagraph(
    `AUCUNE VÉRIFICATION DE CRÉDIT: ${NO_CREDIT_CHECK_POLICY.fr}`,
    `NO CREDIT CHECK: ${NO_CREDIT_CHECK_POLICY.en}`
  );
  
  // Confidentiality
  addBilingualParagraph(
    `CONFIDENTIALITÉ: ${CONTRACT_TERMS.confidentiality}`,
    `CONFIDENTIALITY: Client information is kept strictly confidential and will not be shared with third parties without explicit consent.`
  );
  
  // Data Protection
  addBilingualParagraph(
    `PROTECTION DES DONNÉES: ${CONTRACT_TERMS.dataProtection}`,
    `DATA PROTECTION: The Provider commits to protecting personal data in accordance with Quebec's privacy laws and Law 25.`
  );
  
  // Fraud/Abuse
  addBilingualParagraph(
    `FRAUDE ET ABUS: ${CONTRACT_TERMS.fraudAbuse}`,
    `FRAUD AND ABUSE: The Client agrees not to use services for illegal, fraudulent, or abusive purposes. Fraudulent behavior will result in immediate contract termination.`
  );
  
  // Jurisdiction
  addBilingualParagraph(
    `JURIDICTION: ${CONTRACT_TERMS.jurisdiction}`,
    `JURISDICTION: This contract is governed by the laws of Quebec and applicable federal laws of Canada.`
  );
  
  // ========== FINAL PAGE: SIGNATURES ==========
  addNewPage();
  
  addSectionTitle("SIGNATURES ET ENGAGEMENT", "SIGNATURES AND COMMITMENT");
  
  addBilingualParagraph(
    "Les parties déclarent avoir lu, compris et accepté l'ensemble des termes et conditions du présent contrat.",
    "The parties declare that they have read, understood, and accepted all terms and conditions of this contract."
  );
  
  currentY += 10;
  
  // Signature boxes
  const sigBoxWidth = (contentWidth - 10) / 2;
  const sigBoxHeight = 55;
  
  // Provider
  doc.setFillColor(...navyColor);
  doc.roundedRect(margin, currentY, sigBoxWidth, sigBoxHeight, 2, 2, "F");
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...cyanAccent);
  doc.text("POUR LE PRESTATAIRE", margin + sigBoxWidth / 2, currentY + 10, { align: "center" });
  doc.text("FOR THE PROVIDER", margin + sigBoxWidth / 2, currentY + 16, { align: "center" });
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text("Signature:", margin + 5, currentY + 30);
  doc.setDrawColor(100, 100, 100);
  doc.line(margin + 25, currentY + 30, margin + sigBoxWidth - 5, currentY + 30);
  doc.text("Date:", margin + 5, currentY + 42);
  doc.line(margin + 18, currentY + 42, margin + sigBoxWidth - 5, currentY + 42);
  
  // Client
  const clientSigX = margin + sigBoxWidth + 10;
  doc.setFillColor(...lightGray);
  doc.roundedRect(clientSigX, currentY, sigBoxWidth, sigBoxHeight, 2, 2, "F");
  doc.setDrawColor(...cyanAccent);
  doc.setLineWidth(1);
  doc.line(clientSigX, currentY + 2, clientSigX, currentY + sigBoxHeight - 2);
  
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...navyColor);
  doc.text("POUR LE CLIENT", clientSigX + sigBoxWidth / 2, currentY + 10, { align: "center" });
  doc.text("FOR THE CLIENT", clientSigX + sigBoxWidth / 2, currentY + 16, { align: "center" });
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...darkText);
  doc.text(`Nom / Name: ${data.clientName}`, clientSigX + 5, currentY + 26);
  doc.text("Signature:", clientSigX + 5, currentY + 36);
  doc.setDrawColor(...grayText);
  doc.line(clientSigX + 25, currentY + 36, clientSigX + sigBoxWidth - 5, currentY + 36);
  doc.text("Date:", clientSigX + 5, currentY + 46);
  doc.line(clientSigX + 18, currentY + 46, clientSigX + sigBoxWidth - 5, currentY + 46);
  
  currentY += sigBoxHeight + 15;
  
  // Status banner
  if (data.isSigned && data.signedAt) {
    doc.setFillColor(230, 255, 230);
    doc.roundedRect(margin, currentY, contentWidth, 22, 2, 2, "F");
    doc.setDrawColor(34, 197, 94);
    doc.setLineWidth(1);
    doc.roundedRect(margin, currentY, contentWidth, 22, 2, 2, "S");
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(34, 150, 94);
    doc.text("✓ CONTRAT SIGNÉ / CONTRACT SIGNED", pageWidth / 2, currentY + 10, { align: "center" });
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(`${format(new Date(data.signedAt), "d MMMM yyyy 'à' HH:mm", { locale: fr })}`, pageWidth / 2, currentY + 17, { align: "center" });
  } else {
    doc.setFillColor(255, 250, 235);
    doc.roundedRect(margin, currentY, contentWidth, 18, 2, 2, "F");
    doc.setDrawColor(234, 179, 8);
    doc.setLineWidth(1);
    doc.roundedRect(margin, currentY, contentWidth, 18, 2, 2, "S");
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(180, 130, 0);
    doc.text("⏳ EN ATTENTE DE SIGNATURE / AWAITING SIGNATURE", pageWidth / 2, currentY + 11, { align: "center" });
  }
  
  addFooter();
  
  return doc;
};

export const downloadTelecomContractPDF = (data: TelecomContractData): void => {
  const doc = generateTelecomContractPDF(data);
  doc.save(`Contrat-${data.contractNumber}.pdf`);
};

export const viewTelecomContractPDF = (data: TelecomContractData): void => {
  const doc = generateTelecomContractPDF(data);
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
};

export const getTelecomContractBlob = (data: TelecomContractData): Blob => {
  const doc = generateTelecomContractPDF(data);
  return doc.output("blob");
};
