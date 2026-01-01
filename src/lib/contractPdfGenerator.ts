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
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let currentY = margin;
  let pageNumber = 1;
  
  // Professional telecom color scheme - deep navy & cyan accent
  const navyColor: [number, number, number] = [10, 25, 47];
  const cyanAccent: [number, number, number] = [0, 188, 212];
  const darkText: [number, number, number] = [33, 33, 33];
  const grayText: [number, number, number] = [100, 100, 100];
  const lightGray: [number, number, number] = [245, 247, 250];
  
  // Helper functions
  const addNewPage = () => {
    doc.addPage();
    pageNumber++;
    currentY = 25;
    addPageHeader();
  };
  
  const checkPageBreak = (neededHeight: number) => {
    if (currentY + neededHeight > pageHeight - 30) {
      addNewPage();
    }
  };
  
  const addPageHeader = () => {
    if (pageNumber > 1) {
      // Top line accent
      doc.setFillColor(...cyanAccent);
      doc.rect(0, 0, pageWidth, 3, "F");
      
      // Header bar
      doc.setFillColor(...navyColor);
      doc.rect(0, 3, pageWidth, 18, "F");
      
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.text(BUSINESS_INFO.name.toUpperCase(), margin, 14);
      
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(`Contrat N° ${data.contractNumber}`, pageWidth - margin, 14, { align: "right" });
      
      currentY = 28;
    }
  };
  
  const addFooter = (pageNum: number, totalPages: number) => {
    // Bottom accent line
    doc.setFillColor(...cyanAccent);
    doc.rect(0, pageHeight - 12, pageWidth, 2, "F");
    
    doc.setFontSize(7);
    doc.setTextColor(...grayText);
    doc.text(`${BUSINESS_INFO.legalName} | ${BUSINESS_INFO.address} | ${BUSINESS_INFO.phone}`, pageWidth / 2, pageHeight - 6, { align: "center" });
    doc.text(`Page ${pageNum} / ${totalPages}`, pageWidth - margin, pageHeight - 6, { align: "right" });
    
    // Initials boxes
    doc.setDrawColor(...grayText);
    doc.setLineWidth(0.3);
    
    // Client initials
    doc.rect(margin, pageHeight - 22, 20, 8);
    doc.setFontSize(5);
    doc.text("Paraphe Client", margin + 10, pageHeight - 24, { align: "center" });
    
    // Provider initials
    doc.rect(margin + 25, pageHeight - 22, 20, 8);
    doc.text("Paraphe Nivra", margin + 35, pageHeight - 24, { align: "center" });
  };
  
  const addSectionTitle = (title: string, articleNum?: number) => {
    checkPageBreak(18);
    currentY += 6;
    
    // Section background
    doc.setFillColor(...navyColor);
    doc.roundedRect(margin, currentY - 5, contentWidth, 10, 1, 1, "F");
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    const titleText = articleNum ? `ARTICLE ${articleNum} — ${title}` : title;
    doc.text(titleText, margin + 5, currentY + 1);
    
    currentY += 12;
  };
  
  const addParagraph = (text: string, fontSize: number = 9, indent: number = 0) => {
    doc.setFontSize(fontSize);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...darkText);
    const lines = doc.splitTextToSize(text, contentWidth - indent);
    const lineHeight = fontSize * 0.45;
    checkPageBreak(lines.length * lineHeight + 4);
    doc.text(lines, margin + indent, currentY);
    currentY += lines.length * lineHeight + 3;
  };
  
  const addBulletPoint = (text: string, bulletChar: string = "•") => {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...darkText);
    
    // Bullet
    doc.setTextColor(...cyanAccent);
    doc.text(bulletChar, margin + 5, currentY);
    
    // Text
    doc.setTextColor(...darkText);
    const lines = doc.splitTextToSize(text, contentWidth - 15);
    checkPageBreak(lines.length * 4 + 2);
    doc.text(lines, margin + 12, currentY);
    currentY += lines.length * 4 + 1.5;
  };
  
  const addKeyValue = (key: string, value: string, y: number, x: number = margin) => {
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...grayText);
    doc.text(key, x, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...darkText);
    doc.text(value, x, y + 4);
  };
  
  // ========== PAGE 1: COVER ==========
  // Top accent stripe
  doc.setFillColor(...cyanAccent);
  doc.rect(0, 0, pageWidth, 4, "F");
  
  // Navy header
  doc.setFillColor(...navyColor);
  doc.rect(0, 4, pageWidth, 55, "F");
  
  // Company name
  doc.setFontSize(32);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text(BUSINESS_INFO.name.toUpperCase(), pageWidth / 2, 28, { align: "center" });
  
  // Tagline with accent
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...cyanAccent);
  doc.text("COMPAGNIE TÉLÉCOM INDÉPENDANTE", pageWidth / 2, 38, { align: "center" });
  
  // Contact info
  doc.setFontSize(9);
  doc.setTextColor(200, 200, 200);
  doc.text(`${BUSINESS_INFO.phone}  •  ${BUSINESS_INFO.email}  •  ${BUSINESS_INFO.address}`, pageWidth / 2, 50, { align: "center" });
  
  currentY = 75;
  
  // Contract type banner
  doc.setFillColor(...lightGray);
  doc.roundedRect(margin, currentY - 8, contentWidth, 28, 3, 3, "F");
  doc.setDrawColor(...cyanAccent);
  doc.setLineWidth(0.8);
  doc.line(margin, currentY - 8, margin, currentY + 20);
  
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...navyColor);
  doc.text("CONTRAT DE SERVICES", margin + 8, currentY + 2);
  doc.setFontSize(14);
  doc.text("DE COURTAGE TÉLÉCOM", margin + 8, currentY + 12);
  
  currentY += 35;
  
  // Contract metadata box
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(...navyColor);
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, currentY, contentWidth, 32, 2, 2, "S");
  
  // Contract info grid
  addKeyValue("CONTRAT N°", data.contractNumber, currentY + 8, margin + 8);
  addKeyValue("VERSION", CONTRACT_TERMS.version, currentY + 8, margin + 55);
  addKeyValue("DATE D'ÉMISSION", format(new Date(), "d MMMM yyyy", { locale: fr }), currentY + 8, margin + 100);
  addKeyValue("DATE DE DÉBUT", format(new Date(data.startDate), "d MMMM yyyy", { locale: fr }), currentY + 20, margin + 8);
  if (data.durationMonths) {
    addKeyValue("DURÉE", `${data.durationMonths} mois`, currentY + 20, margin + 100);
  }
  
  currentY += 45;
  
  // Parties section
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...navyColor);
  doc.text("ENTRE LES PARTIES SOUSSIGNÉES", margin, currentY);
  
  currentY += 10;
  
  // Provider card
  doc.setFillColor(...navyColor);
  doc.roundedRect(margin, currentY, (contentWidth - 10) / 2, 50, 2, 2, "F");
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...cyanAccent);
  doc.text("LE PRESTATAIRE", margin + 8, currentY + 10);
  
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(255, 255, 255);
  doc.text(BUSINESS_INFO.legalName, margin + 8, currentY + 20);
  doc.text(BUSINESS_INFO.address, margin + 8, currentY + 27);
  doc.text(`Tél: ${BUSINESS_INFO.phone}`, margin + 8, currentY + 34);
  doc.text(BUSINESS_INFO.email, margin + 8, currentY + 41);
  
  // Client card
  const clientCardX = margin + (contentWidth - 10) / 2 + 10;
  doc.setFillColor(...lightGray);
  doc.roundedRect(clientCardX, currentY, (contentWidth - 10) / 2, 50, 2, 2, "F");
  doc.setDrawColor(...cyanAccent);
  doc.setLineWidth(1);
  doc.line(clientCardX, currentY + 2, clientCardX, currentY + 48);
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...navyColor);
  doc.text("LE CLIENT", clientCardX + 8, currentY + 10);
  
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...darkText);
  doc.text(data.clientName, clientCardX + 8, currentY + 20);
  doc.text(data.clientEmail, clientCardX + 8, currentY + 27);
  if (data.clientPhone) doc.text(`Tél: ${data.clientPhone}`, clientCardX + 8, currentY + 34);
  if (data.clientAddress) doc.text(data.clientAddress, clientCardX + 8, currentY + 41);
  
  currentY += 60;
  
  // Object of contract
  addSectionTitle("OBJET DU CONTRAT", 1);
  addParagraph(data.serviceDescription || "Le présent contrat définit les modalités selon lesquelles le Prestataire fournira au Client des services professionnels de courtage et d'optimisation télécom, agissant exclusivement dans l'intérêt du Client.");
  
  addFooter(pageNumber, 5);
  
  // ========== PAGE 2: SERVICES ==========
  addNewPage();
  
  addSectionTitle("SERVICES FOURNIS", 2);
  addParagraph("Dans le cadre de ce contrat, le Prestataire s'engage à fournir les services suivants :");
  currentY += 2;
  
  CONTRACT_TERMS.services.forEach((service) => addBulletPoint(service, "▸"));
  
  currentY += 5;
  addSectionTitle("INDÉPENDANCE DU PRESTATAIRE", 3);
  addParagraph(CONTRACT_TERMS.independence);
  
  currentY += 5;
  addSectionTitle("OBLIGATIONS DU PRESTATAIRE", 4);
  PROVIDER_OBLIGATIONS.forEach((obligation) => addBulletPoint(obligation, "▸"));
  
  currentY += 5;
  addSectionTitle("OBLIGATIONS DU CLIENT", 5);
  CLIENT_OBLIGATIONS.forEach((obligation) => addBulletPoint(obligation, "▸"));
  
  addFooter(pageNumber, 5);
  
  // ========== PAGE 3: FINANCIAL ==========
  addNewPage();
  
  addSectionTitle("CONDITIONS FINANCIÈRES", 6);
  
  // Financial summary box
  doc.setFillColor(...lightGray);
  doc.roundedRect(margin, currentY, contentWidth, 35, 2, 2, "F");
  
  let finY = currentY + 10;
  if (data.monthlyAmount) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...grayText);
    doc.text("Montant mensuel:", margin + 8, finY);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...navyColor);
    doc.text(`${data.monthlyAmount.toFixed(2)} $ CAD`, margin + 60, finY);
    finY += 8;
  }
  if (data.totalAmount) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...grayText);
    doc.text("Montant total du contrat:", margin + 8, finY);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...navyColor);
    doc.text(`${data.totalAmount.toFixed(2)} $ CAD`, margin + 60, finY);
    finY += 8;
  }
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...grayText);
  doc.text("Méthodes de paiement acceptées:", margin + 8, finY);
  doc.setTextColor(...darkText);
  doc.text(CONTRACT_TERMS.paymentTerms.acceptedMethods.join(", "), margin + 75, finY);
  
  currentY += 45;
  
  addParagraph(`Délai de paiement : ${CONTRACT_TERMS.paymentTerms.dueDays} jours suivant la date de facturation.`);
  
  currentY += 5;
  addSectionTitle("POLITIQUE DE PAIEMENT EN RETARD", 7);
  
  // Warning box
  doc.setFillColor(255, 240, 240);
  doc.roundedRect(margin, currentY, contentWidth, 25, 2, 2, "F");
  doc.setDrawColor(220, 50, 50);
  doc.setLineWidth(0.8);
  doc.line(margin, currentY, margin, currentY + 25);
  
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(180, 50, 50);
  doc.text("⚠ AVERTISSEMENT", margin + 5, currentY + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  const lateLines = doc.splitTextToSize(LATE_PAYMENT_POLICY, contentWidth - 10);
  doc.text(lateLines, margin + 5, currentY + 12);
  
  currentY += 35;
  
  addSectionTitle("RÉSILIATION", 8);
  addParagraph(`Préavis requis : ${CONTRACT_TERMS.cancellation.noticeDays} jours`);
  addParagraph(`Frais après livraison : ${CONTRACT_TERMS.cancellation.afterDeliveryCharge}`);
  
  addFooter(pageNumber, 5);
  
  // ========== PAGE 4: LEGAL ==========
  addNewPage();
  
  addSectionTitle("CONFIDENTIALITÉ", 9);
  addParagraph(CONTRACT_TERMS.confidentiality);
  
  currentY += 5;
  addSectionTitle("PROTECTION DES DONNÉES", 10);
  addParagraph(CONTRACT_TERMS.dataProtection);
  
  currentY += 5;
  addSectionTitle("LIMITATION DE RESPONSABILITÉ", 11);
  addParagraph(CONTRACT_TERMS.liability);
  
  currentY += 5;
  addSectionTitle("DROIT APPLICABLE", 12);
  addParagraph(CONTRACT_TERMS.jurisdiction);
  
  if (data.notes) {
    currentY += 5;
    addSectionTitle("DISPOSITIONS PARTICULIÈRES", 13);
    addParagraph(data.notes);
  }
  
  addFooter(pageNumber, 5);
  
  // ========== PAGE 5: SIGNATURES ==========
  addNewPage();
  
  addSectionTitle("SIGNATURES ET ENGAGEMENT");
  
  addParagraph("Les parties déclarent avoir lu, compris et accepté l'ensemble des termes et conditions du présent contrat. En apposant leur signature ci-dessous, les parties s'engagent à respecter les obligations définies dans ce document.");
  
  currentY += 15;
  
  // Signature boxes
  const sigBoxWidth = (contentWidth - 15) / 2;
  const sigBoxHeight = 65;
  
  // Provider signature box
  doc.setFillColor(...navyColor);
  doc.roundedRect(margin, currentY, sigBoxWidth, sigBoxHeight, 3, 3, "F");
  
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...cyanAccent);
  doc.text("POUR LE PRESTATAIRE", margin + sigBoxWidth / 2, currentY + 12, { align: "center" });
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(200, 200, 200);
  doc.text(`Nom: ${data.employeeName}`, margin + 8, currentY + 24);
  doc.text(`Titre: ${data.employeeTitle}`, margin + 8, currentY + 32);
  
  doc.setTextColor(255, 255, 255);
  doc.text("Signature:", margin + 8, currentY + 45);
  doc.setDrawColor(100, 100, 100);
  doc.setLineWidth(0.3);
  doc.line(margin + 32, currentY + 45, margin + sigBoxWidth - 8, currentY + 45);
  
  doc.text("Date:", margin + 8, currentY + 55);
  doc.line(margin + 22, currentY + 55, margin + sigBoxWidth - 8, currentY + 55);
  
  // Client signature box
  const clientSigX = margin + sigBoxWidth + 15;
  doc.setFillColor(...lightGray);
  doc.roundedRect(clientSigX, currentY, sigBoxWidth, sigBoxHeight, 3, 3, "F");
  doc.setDrawColor(...cyanAccent);
  doc.setLineWidth(1.5);
  doc.line(clientSigX, currentY + 3, clientSigX, currentY + sigBoxHeight - 3);
  
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...navyColor);
  doc.text("POUR LE CLIENT", clientSigX + sigBoxWidth / 2, currentY + 12, { align: "center" });
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...grayText);
  doc.text(`Nom: ${data.clientName}`, clientSigX + 8, currentY + 24);
  
  doc.setTextColor(...darkText);
  doc.text("Signature:", clientSigX + 8, currentY + 45);
  doc.setDrawColor(...grayText);
  doc.setLineWidth(0.3);
  doc.line(clientSigX + 32, currentY + 45, clientSigX + sigBoxWidth - 8, currentY + 45);
  
  doc.text("Date:", clientSigX + 8, currentY + 55);
  doc.line(clientSigX + 22, currentY + 55, clientSigX + sigBoxWidth - 8, currentY + 55);
  
  currentY += sigBoxHeight + 20;
  
  // Contract status banner
  if (data.isSigned && data.signedAt) {
    doc.setFillColor(230, 255, 230);
    doc.roundedRect(margin, currentY, contentWidth, 28, 3, 3, "F");
    doc.setDrawColor(34, 197, 94);
    doc.setLineWidth(1);
    doc.roundedRect(margin, currentY, contentWidth, 28, 3, 3, "S");
    
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(34, 150, 94);
    doc.text("✓ CONTRAT SIGNÉ ÉLECTRONIQUEMENT", pageWidth / 2, currentY + 12, { align: "center" });
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Signé le ${format(new Date(data.signedAt), "d MMMM yyyy 'à' HH:mm", { locale: fr })}`, pageWidth / 2, currentY + 22, { align: "center" });
  } else {
    doc.setFillColor(255, 250, 235);
    doc.roundedRect(margin, currentY, contentWidth, 22, 3, 3, "F");
    doc.setDrawColor(234, 179, 8);
    doc.setLineWidth(1);
    doc.roundedRect(margin, currentY, contentWidth, 22, 3, 3, "S");
    
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(180, 130, 0);
    doc.text("⏳ EN ATTENTE DE SIGNATURE", pageWidth / 2, currentY + 14, { align: "center" });
  }
  
  currentY += 35;
  
  // Legal disclaimer
  doc.setFillColor(...lightGray);
  doc.roundedRect(margin, currentY, contentWidth, 30, 2, 2, "F");
  doc.setFontSize(6);
  doc.setTextColor(...grayText);
  const legalNotice = `Ce document constitue un contrat juridiquement contraignant entre les parties susmentionnées. La signature électronique a la même valeur légale qu'une signature manuscrite en vertu de la Loi concernant le cadre juridique des technologies de l'information du Québec. Pour toute question relative à ce contrat, veuillez contacter ${BUSINESS_INFO.email} ou ${BUSINESS_INFO.phone}. Version: ${CONTRACT_TERMS.version} | Dernière mise à jour: ${CONTRACT_TERMS.lastUpdated}`;
  const legalLines = doc.splitTextToSize(legalNotice, contentWidth - 10);
  doc.text(legalLines, margin + 5, currentY + 6);
  
  // Add footers to all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addFooter(i, totalPages);
  }
  
  return doc;
};

export const downloadContractPDF = (data: ContractData) => {
  const doc = generateContractPDF(data);
  doc.save(`Contrat_${data.contractNumber}_${data.clientName.replace(/\s+/g, '_')}.pdf`);
};

export const viewContractPDF = (data: ContractData) => {
  const doc = generateContractPDF(data);
  const pdfBlob = doc.output("blob");
  const url = URL.createObjectURL(pdfBlob);
  window.open(url, "_blank");
};
