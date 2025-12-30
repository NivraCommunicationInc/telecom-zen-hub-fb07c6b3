import jsPDF from "jspdf";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  BUSINESS_INFO,
  CONTRACT_TERMS,
  LATE_PAYMENT_POLICY,
  CLIENT_OBLIGATIONS,
  PROVIDER_OBLIGATIONS,
} from "./contractPolicies";

interface ContractData {
  contractNumber: string;
  contractName: string;
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  clientAddress?: string;
  serviceDescription: string;
  monthlyAmount?: number;
  totalAmount?: number;
  startDate: string;
  endDate?: string;
  durationMonths?: number;
  notes?: string;
  employeeName: string;
  employeeTitle: string;
  isSigned: boolean;
  signedAt?: string;
  clientSignature?: string;
  employeeSignature?: string;
}

export const generateContractPDF = (data: ContractData): jsPDF => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let currentY = margin;
  let pageNumber = 1;
  
  const primaryColor: [number, number, number] = [0, 188, 212]; // Cyan
  const darkColor: [number, number, number] = [30, 30, 30];
  const grayColor: [number, number, number] = [100, 100, 100];
  
  // Helper functions
  const addNewPage = () => {
    doc.addPage();
    pageNumber++;
    currentY = margin;
    addPageHeader();
    addInitialsBox();
  };
  
  const checkPageBreak = (neededHeight: number) => {
    if (currentY + neededHeight > pageHeight - 40) {
      addNewPage();
    }
  };
  
  const addPageHeader = () => {
    if (pageNumber > 1) {
      doc.setFontSize(8);
      doc.setTextColor(...grayColor);
      doc.text(`Contrat N° ${data.contractNumber} - Page ${pageNumber}`, margin, 10);
      doc.text(BUSINESS_INFO.name, pageWidth - margin, 10, { align: "right" });
      currentY = 20;
    }
  };
  
  const addInitialsBox = () => {
    // Add initials box at bottom right of each page
    const boxX = pageWidth - 45;
    const boxY = pageHeight - 25;
    
    doc.setDrawColor(...grayColor);
    doc.setLineWidth(0.3);
    doc.rect(boxX, boxY, 25, 12);
    doc.setFontSize(6);
    doc.setTextColor(...grayColor);
    doc.text("Paraphe Client", boxX + 12.5, boxY - 2, { align: "center" });
    
    doc.rect(boxX - 30, boxY, 25, 12);
    doc.text("Paraphe Nivra", boxX - 17.5, boxY - 2, { align: "center" });
  };
  
  const addSectionTitle = (title: string) => {
    checkPageBreak(15);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...primaryColor);
    currentY += 8;
    doc.text(title, margin, currentY);
    currentY += 2;
    doc.setDrawColor(...primaryColor);
    doc.setLineWidth(0.5);
    doc.line(margin, currentY, margin + 50, currentY);
    currentY += 8;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...darkColor);
  };
  
  const addParagraph = (text: string, fontSize: number = 9) => {
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(text, contentWidth);
    const lineHeight = fontSize * 0.5;
    checkPageBreak(lines.length * lineHeight + 5);
    doc.text(lines, margin, currentY);
    currentY += lines.length * lineHeight + 3;
  };
  
  const addBulletPoint = (text: string) => {
    doc.setFontSize(9);
    const bulletText = `• ${text}`;
    const lines = doc.splitTextToSize(bulletText, contentWidth - 5);
    checkPageBreak(lines.length * 4.5 + 2);
    doc.text(lines, margin + 5, currentY);
    currentY += lines.length * 4.5 + 1;
  };
  
  // ========== PAGE 1: COVER ==========
  // Header with logo placeholder and company info
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 50, "F");
  
  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text(BUSINESS_INFO.name.toUpperCase(), pageWidth / 2, 25, { align: "center" });
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Courtier Télécom Indépendant", pageWidth / 2, 35, { align: "center" });
  doc.text(`${BUSINESS_INFO.phone} | ${BUSINESS_INFO.email}`, pageWidth / 2, 42, { align: "center" });
  
  currentY = 70;
  
  // Contract title
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...darkColor);
  doc.text("CONTRAT DE SERVICES", pageWidth / 2, currentY, { align: "center" });
  doc.text("DE COURTAGE TÉLÉCOM", pageWidth / 2, currentY + 10, { align: "center" });
  
  currentY += 25;
  
  // Contract info box
  doc.setFillColor(245, 245, 245);
  doc.roundedRect(margin, currentY, contentWidth, 35, 3, 3, "F");
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...darkColor);
  doc.text(`Contrat N° : ${data.contractNumber}`, margin + 10, currentY + 10);
  doc.text(`Version : ${CONTRACT_TERMS.version}`, pageWidth - margin - 10, currentY + 10, { align: "right" });
  
  doc.setFont("helvetica", "normal");
  doc.text(`Date d'émission : ${format(new Date(), "d MMMM yyyy", { locale: fr })}`, margin + 10, currentY + 20);
  doc.text(`Date de début : ${format(new Date(data.startDate), "d MMMM yyyy", { locale: fr })}`, margin + 10, currentY + 28);
  
  if (data.endDate) {
    doc.text(`Date de fin : ${format(new Date(data.endDate), "d MMMM yyyy", { locale: fr })}`, pageWidth - margin - 10, currentY + 20, { align: "right" });
  }
  if (data.durationMonths) {
    doc.text(`Durée : ${data.durationMonths} mois`, pageWidth - margin - 10, currentY + 28, { align: "right" });
  }
  
  currentY += 50;
  
  // Parties information
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...primaryColor);
  doc.text("ENTRE LES PARTIES SOUSSIGNÉES :", margin, currentY);
  currentY += 12;
  
  // Provider box
  doc.setDrawColor(...primaryColor);
  doc.setLineWidth(1);
  doc.roundedRect(margin, currentY, contentWidth / 2 - 5, 45, 2, 2, "S");
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...darkColor);
  doc.text("LE PRESTATAIRE", margin + 5, currentY + 8);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(BUSINESS_INFO.legalName, margin + 5, currentY + 16);
  doc.text(BUSINESS_INFO.address, margin + 5, currentY + 22);
  doc.text(`Tél: ${BUSINESS_INFO.phone}`, margin + 5, currentY + 28);
  doc.text(`Courriel: ${BUSINESS_INFO.email}`, margin + 5, currentY + 34);
  
  // Client box
  const clientBoxX = margin + contentWidth / 2 + 5;
  doc.roundedRect(clientBoxX, currentY, contentWidth / 2 - 5, 45, 2, 2, "S");
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("LE CLIENT", clientBoxX + 5, currentY + 8);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(data.clientName, clientBoxX + 5, currentY + 16);
  doc.text(data.clientEmail, clientBoxX + 5, currentY + 22);
  if (data.clientPhone) doc.text(`Tél: ${data.clientPhone}`, clientBoxX + 5, currentY + 28);
  if (data.clientAddress) {
    const addrLines = doc.splitTextToSize(data.clientAddress, contentWidth / 2 - 15);
    doc.text(addrLines, clientBoxX + 5, currentY + 34);
  }
  
  currentY += 60;
  
  // Service description
  addSectionTitle("ARTICLE 1 - OBJET DU CONTRAT");
  addParagraph(data.serviceDescription || "Le présent contrat a pour objet de définir les conditions dans lesquelles le Prestataire fournira au Client des services de courtage et d'optimisation télécom.");
  
  addInitialsBox();
  
  // ========== PAGE 2: SERVICES & OBLIGATIONS ==========
  addNewPage();
  
  addSectionTitle("ARTICLE 2 - SERVICES FOURNIS");
  addParagraph("Le Prestataire s'engage à fournir les services suivants :");
  CONTRACT_TERMS.services.forEach((service) => addBulletPoint(service));
  
  currentY += 5;
  addSectionTitle("ARTICLE 3 - INDÉPENDANCE DU PRESTATAIRE");
  addParagraph(CONTRACT_TERMS.independence);
  
  currentY += 5;
  addSectionTitle("ARTICLE 4 - OBLIGATIONS DU PRESTATAIRE");
  PROVIDER_OBLIGATIONS.forEach((obligation) => addBulletPoint(obligation));
  
  currentY += 5;
  addSectionTitle("ARTICLE 5 - OBLIGATIONS DU CLIENT");
  CLIENT_OBLIGATIONS.forEach((obligation) => addBulletPoint(obligation));
  
  addInitialsBox();
  
  // ========== PAGE 3: FINANCIAL TERMS ==========
  addNewPage();
  
  addSectionTitle("ARTICLE 6 - CONDITIONS FINANCIÈRES");
  
  if (data.monthlyAmount) {
    addParagraph(`Montant mensuel : ${data.monthlyAmount.toFixed(2)} $ CAD`);
  }
  if (data.totalAmount) {
    addParagraph(`Montant total du contrat : ${data.totalAmount.toFixed(2)} $ CAD`);
  }
  
  addParagraph(`Méthodes de paiement acceptées : ${CONTRACT_TERMS.paymentTerms.acceptedMethods.join(", ")}`);
  addParagraph(`Délai de paiement : ${CONTRACT_TERMS.paymentTerms.dueDays} jours suivant la date de facturation`);
  
  currentY += 5;
  addSectionTitle("ARTICLE 7 - POLITIQUE DE PAIEMENT EN RETARD");
  doc.setFillColor(255, 245, 245);
  const latePaymentLines = doc.splitTextToSize(LATE_PAYMENT_POLICY, contentWidth - 10);
  const boxHeight = latePaymentLines.length * 4.5 + 10;
  checkPageBreak(boxHeight + 10);
  doc.roundedRect(margin, currentY - 3, contentWidth, boxHeight, 2, 2, "F");
  doc.setDrawColor(220, 50, 50);
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, currentY - 3, contentWidth, boxHeight, 2, 2, "S");
  doc.setFontSize(8);
  doc.setTextColor(150, 50, 50);
  doc.text(latePaymentLines, margin + 5, currentY + 5);
  currentY += boxHeight + 5;
  
  currentY += 5;
  addSectionTitle("ARTICLE 8 - RÉSILIATION");
  addParagraph(`Préavis requis : ${CONTRACT_TERMS.cancellation.noticeDays} jours`);
  addParagraph(`Frais de résiliation anticipée : ${CONTRACT_TERMS.cancellation.earlyTerminationFee}`);
  
  addInitialsBox();
  
  // ========== PAGE 4: LEGAL TERMS ==========
  addNewPage();
  
  addSectionTitle("ARTICLE 9 - CONFIDENTIALITÉ");
  addParagraph(CONTRACT_TERMS.confidentiality);
  
  currentY += 5;
  addSectionTitle("ARTICLE 10 - PROTECTION DES DONNÉES");
  addParagraph(CONTRACT_TERMS.dataProtection);
  
  currentY += 5;
  addSectionTitle("ARTICLE 11 - LIMITATION DE RESPONSABILITÉ");
  addParagraph(CONTRACT_TERMS.liability);
  
  currentY += 5;
  addSectionTitle("ARTICLE 12 - DROIT APPLICABLE");
  addParagraph(CONTRACT_TERMS.jurisdiction);
  
  if (data.notes) {
    currentY += 5;
    addSectionTitle("ARTICLE 13 - DISPOSITIONS PARTICULIÈRES");
    addParagraph(data.notes);
  }
  
  addInitialsBox();
  
  // ========== PAGE 5: SIGNATURES ==========
  addNewPage();
  
  addSectionTitle("SIGNATURES ET ENGAGEMENT");
  
  addParagraph("Les parties déclarent avoir lu et compris l'ensemble des termes et conditions du présent contrat. En signant ci-dessous, les parties s'engagent à respecter les obligations définies dans ce document.");
  
  currentY += 10;
  
  // Signature boxes
  const sigBoxWidth = contentWidth / 2 - 10;
  const sigBoxHeight = 70;
  
  // Provider signature
  doc.setDrawColor(...primaryColor);
  doc.setLineWidth(1);
  doc.roundedRect(margin, currentY, sigBoxWidth, sigBoxHeight, 3, 3, "S");
  
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...primaryColor);
  doc.text("POUR LE PRESTATAIRE", margin + sigBoxWidth / 2, currentY + 10, { align: "center" });
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...darkColor);
  doc.text(`Nom : ${data.employeeName}`, margin + 5, currentY + 22);
  doc.text(`Titre : ${data.employeeTitle}`, margin + 5, currentY + 30);
  
  doc.text("Signature :", margin + 5, currentY + 42);
  doc.setDrawColor(...grayColor);
  doc.setLineWidth(0.3);
  doc.line(margin + 30, currentY + 42, margin + sigBoxWidth - 5, currentY + 42);
  
  doc.text("Date :", margin + 5, currentY + 55);
  doc.line(margin + 20, currentY + 55, margin + sigBoxWidth - 5, currentY + 55);
  
  if (data.employeeSignature) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(12);
    doc.text(data.employeeSignature, margin + sigBoxWidth / 2, currentY + 40, { align: "center" });
  }
  
  // Client signature
  const clientSigX = margin + sigBoxWidth + 20;
  doc.setDrawColor(...primaryColor);
  doc.setLineWidth(1);
  doc.roundedRect(clientSigX, currentY, sigBoxWidth, sigBoxHeight, 3, 3, "S");
  
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...primaryColor);
  doc.text("POUR LE CLIENT", clientSigX + sigBoxWidth / 2, currentY + 10, { align: "center" });
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...darkColor);
  doc.text(`Nom : ${data.clientName}`, clientSigX + 5, currentY + 22);
  
  doc.text("Signature :", clientSigX + 5, currentY + 42);
  doc.setDrawColor(...grayColor);
  doc.line(clientSigX + 30, currentY + 42, clientSigX + sigBoxWidth - 5, currentY + 42);
  
  doc.text("Date :", clientSigX + 5, currentY + 55);
  doc.line(clientSigX + 20, currentY + 55, clientSigX + sigBoxWidth - 5, currentY + 55);
  
  if (data.clientSignature) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(12);
    doc.text(data.clientSignature, clientSigX + sigBoxWidth / 2, currentY + 40, { align: "center" });
  }
  
  currentY += sigBoxHeight + 15;
  
  // Contract status
  if (data.isSigned && data.signedAt) {
    doc.setFillColor(230, 255, 230);
    doc.roundedRect(margin, currentY, contentWidth, 25, 3, 3, "F");
    doc.setDrawColor(50, 150, 50);
    doc.setLineWidth(1);
    doc.roundedRect(margin, currentY, contentWidth, 25, 3, 3, "S");
    
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(50, 150, 50);
    doc.text("✓ CONTRAT SIGNÉ", pageWidth / 2, currentY + 10, { align: "center" });
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Signé le : ${format(new Date(data.signedAt), "d MMMM yyyy 'à' HH:mm", { locale: fr })}`, pageWidth / 2, currentY + 18, { align: "center" });
  } else {
    doc.setFillColor(255, 250, 230);
    doc.roundedRect(margin, currentY, contentWidth, 20, 3, 3, "F");
    doc.setDrawColor(200, 150, 50);
    doc.setLineWidth(1);
    doc.roundedRect(margin, currentY, contentWidth, 20, 3, 3, "S");
    
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(200, 150, 50);
    doc.text("⏳ EN ATTENTE DE SIGNATURE", pageWidth / 2, currentY + 12, { align: "center" });
  }
  
  currentY += 35;
  
  // Legal notice
  doc.setFillColor(245, 245, 245);
  doc.roundedRect(margin, currentY, contentWidth, 30, 2, 2, "F");
  doc.setFontSize(7);
  doc.setTextColor(...grayColor);
  const legalNotice = `Ce document constitue un contrat légal entre les parties susmentionnées. Les conditions générales de ce contrat sont régies par les lois de la province de Québec. Pour toute question, veuillez contacter ${BUSINESS_INFO.email} ou appeler le ${BUSINESS_INFO.phone}. Version du contrat: ${CONTRACT_TERMS.version} - Dernière mise à jour: ${CONTRACT_TERMS.lastUpdated}`;
  const legalLines = doc.splitTextToSize(legalNotice, contentWidth - 10);
  doc.text(legalLines, margin + 5, currentY + 8);
  
  // Footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...grayColor);
    doc.text(`${BUSINESS_INFO.legalName} - ${BUSINESS_INFO.address}`, pageWidth / 2, pageHeight - 10, { align: "center" });
    doc.text(`Page ${i} / ${totalPages}`, pageWidth - margin, pageHeight - 10, { align: "right" });
  }
  
  return doc;
};

export const downloadContractPDF = (data: ContractData) => {
  const doc = generateContractPDF(data);
  doc.save(`Contrat_${data.contractNumber}_${data.clientName.replace(/\s+/g, '_')}.pdf`);
};
