/**
 * Nivra Modalités Template V2 - Professional Design
 * Modalités de service et renseignements importants
 * Inspired by Rogers "Modalités de service" document layout
 * 
 * Features:
 * - Clean section headers
 * - Numbered clauses
 * - Important notices highlighted
 * - Table of contents
 * - Professional legal document formatting
 */

import jsPDF from "jspdf";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { COMPANY_CONTACT } from "@/config/company";

// =============================================================================
// TYPES
// =============================================================================

export interface ModalitesV2Section {
  title: string;
  content: string[];
  subsections?: { title: string; content: string[] }[];
}

export interface ModalitesV2Data {
  // Document info
  documentNumber: string;
  version: string;
  effectiveDate: string;
  lastUpdated?: string;
  
  // Optional contract reference
  contractNumber?: string;
  clientName?: string;
  
  // Sections to include (uses defaults if not provided)
  customSections?: ModalitesV2Section[];
}

// =============================================================================
// DEFAULT SECTIONS
// =============================================================================

const DEFAULT_SECTIONS: ModalitesV2Section[] = [
  {
    title: "1. INTRODUCTION ET DÉFINITIONS",
    content: [
      "Les présentes modalités de service (« Modalités ») régissent votre utilisation des services de télécommunications fournis par Nivra Telecom (« Nivra », « nous », « notre »).",
      "« Client » désigne toute personne ou entité souscrivant à nos services.",
      "« Services » désigne l'ensemble des services Internet, téléphonie mobile, télévision et sécurité offerts par Nivra.",
      "« Équipement » désigne tout matériel fourni par Nivra pour l'utilisation des Services.",
    ],
  },
  {
    title: "2. NATURE DES SERVICES",
    content: [
      "Nivra offre des services de télécommunications prépayés sans engagement.",
      "Les services sont activés après réception et confirmation du paiement.",
      "Le cycle de facturation de 30 jours débute uniquement après confirmation du paiement initial.",
      "Les tarifs affichés n'incluent pas les taxes applicables (TPS et TVQ) sauf indication contraire.",
    ],
    subsections: [
      {
        title: "2.1 Services Internet",
        content: [
          "Les vitesses annoncées sont des vitesses maximales théoriques.",
          "Les performances réelles peuvent varier selon la congestion du réseau et l'équipement utilisé.",
          "Un technicien peut être requis pour l'installation initiale.",
        ],
      },
      {
        title: "2.2 Services Mobiles",
        content: [
          "Les services mobiles sont fournis via le réseau de nos partenaires.",
          "La couverture peut varier selon votre emplacement géographique.",
          "Le transfert de numéro (portabilité) est gratuit et prend généralement 2-3 jours ouvrables.",
        ],
      },
      {
        title: "2.3 Services Télévision (IPTV)",
        content: [
          "Une connexion Internet minimale de 25 Mbps est recommandée.",
          "L'équipement IPTV reste la propriété de Nivra et doit être retourné à la fin du service.",
        ],
      },
    ],
  },
  {
    title: "3. PAIEMENT ET FACTURATION",
    content: [
      "Tous les services sont prépayés. Le paiement doit être reçu avant l'activation ou le renouvellement.",
      "Le mode de paiement accepté est le virement Interac exclusivement.",
      "Les paiements doivent être envoyés à l'adresse courriel : support@nivra-telecom.ca",
      "Le cycle de 30 jours commence à la date de confirmation du paiement, non à la date d'envoi.",
      "En cas de non-paiement, les services seront suspendus à l'expiration du cycle en cours.",
    ],
    subsections: [
      {
        title: "3.1 Frais possibles",
        content: [
          "Frais d'activation : peuvent s'appliquer selon le forfait choisi.",
          "Frais de remplacement d'équipement : applicables en cas de perte ou dommage.",
          "Frais de retour d'équipement : aucun frais si retourné dans les 30 jours suivant l'annulation.",
          "Frais de non-retour d'équipement : valeur de remplacement de l'équipement.",
        ],
      },
    ],
  },
  {
    title: "4. ÉQUIPEMENT",
    content: [
      "L'équipement fourni par Nivra reste la propriété de Nivra Telecom.",
      "Le client est responsable de l'équipement tant qu'il est en sa possession.",
      "L'équipement doit être retourné en bon état dans les 30 jours suivant la fin du service.",
      "Des frais seront facturés pour tout équipement non retourné ou endommagé.",
    ],
  },
  {
    title: "5. ANNULATION ET RÉSILIATION",
    content: [
      "Le client peut annuler ses services en tout temps sans pénalité.",
      "L'annulation prend effet à la fin du cycle de facturation en cours.",
      "Aucun remboursement n'est offert pour la période non utilisée du cycle en cours.",
      "Pour annuler, contactez-nous par courriel à support@nivra-telecom.ca ou via le portail client.",
    ],
    subsections: [
      {
        title: "5.1 Période d'essai",
        content: [
          "Une période de rétractation de 15 jours s'applique à compter de l'activation.",
          "Pour être éligible au remboursement, les services ne doivent pas avoir été utilisés de manière substantielle.",
          "L'équipement doit être retourné en parfait état dans son emballage d'origine.",
        ],
      },
    ],
  },
  {
    title: "6. SUPPORT ET PLAINTES",
    content: [
      "Notre équipe de support est disponible par courriel à support@nivra-telecom.ca",
      "Téléphone : 438-544-2233 (heures d'ouverture variables)",
      "Nous nous engageons à répondre dans un délai de 24 à 48 heures ouvrables.",
      "Si votre problème n'est pas résolu à votre satisfaction, vous pouvez déposer une plainte auprès de la CPRST.",
    ],
    subsections: [
      {
        title: "6.1 Commission des plaintes relatives aux services de télécom-télévision (CPRST)",
        content: [
          "La CPRST est un organisme indépendant qui traite les plaintes des consommateurs.",
          "Site web : www.ccts-cprst.ca",
          "Téléphone sans frais : 1-888-221-1687",
        ],
      },
    ],
  },
  {
    title: "7. CONFIDENTIALITÉ",
    content: [
      "Nivra s'engage à protéger vos renseignements personnels conformément à la Loi 25 du Québec.",
      "Vos données sont utilisées uniquement pour la prestation des services et la gestion de votre compte.",
      "Nous ne vendons ni ne partageons vos données avec des tiers à des fins de marketing.",
      "Pour toute question sur la protection de vos données, consultez notre politique de confidentialité sur nivra-telecom.ca/privacy-policy",
    ],
  },
  {
    title: "8. MODIFICATIONS",
    content: [
      "Nivra se réserve le droit de modifier les présentes Modalités avec un préavis de 30 jours.",
      "Les modifications seront communiquées par courriel à l'adresse associée à votre compte.",
      "La poursuite de l'utilisation des services après l'entrée en vigueur des modifications constitue une acceptation de celles-ci.",
      "En cas de modification substantielle défavorable, vous pouvez résilier sans frais dans les 30 jours.",
    ],
  },
];

// =============================================================================
// CONSTANTS
// =============================================================================

const COLORS = {
  primary: [0, 102, 204] as [number, number, number],
  secondary: [0, 51, 102] as [number, number, number],
  accent: [52, 211, 153] as [number, number, number],
  text: [33, 33, 33] as [number, number, number],
  textLight: [117, 117, 117] as [number, number, number],
  border: [224, 224, 224] as [number, number, number],
  background: [250, 250, 250] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
};

const PAGE_CONFIG = {
  marginLeft: 20,
  marginRight: 20,
  marginTop: 20,
  marginBottom: 25,
  pageWidth: 210,
  pageHeight: 297,
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return format(date, "d MMMM yyyy", { locale: fr });
  } catch {
    return dateStr;
  }
}

// =============================================================================
// MAIN GENERATOR
// =============================================================================

export function generateModalitesV2PDF(data: ModalitesV2Data): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const { marginLeft, marginRight, marginTop, marginBottom, pageWidth, pageHeight } = PAGE_CONFIG;
  const contentWidth = pageWidth - marginLeft - marginRight;
  
  let y = marginTop;
  let pageNumber = 1;
  
  const sections = data.customSections || DEFAULT_SECTIONS;
  
  // Helper to add new page
  const addNewPage = () => {
    doc.addPage();
    pageNumber++;
    y = marginTop;
    
    // Header on continuation pages
    doc.setFillColor(...COLORS.accent);
    doc.rect(0, 0, pageWidth, 2, "F");
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.textLight);
    doc.text("MODALITÉS DE SERVICE NIVRA TELECOM", marginLeft, 10);
    doc.text(`Page ${pageNumber}`, pageWidth - marginRight, 10, { align: "right" });
    
    y = 18;
  };
  
  // Check if we need a new page
  const checkPageBreak = (neededSpace: number) => {
    if (y + neededSpace > pageHeight - marginBottom) {
      addNewPage();
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // COVER PAGE / HEADER
  // ─────────────────────────────────────────────────────────────────────────
  
  // Top accent bar
  doc.setFillColor(...COLORS.accent);
  doc.rect(0, 0, pageWidth, 4, "F");
  
  // Title area
  doc.setFillColor(...COLORS.primary);
  doc.rect(marginLeft, y, contentWidth, 35, "F");
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...COLORS.white);
  doc.text("MODALITÉS DE SERVICE", marginLeft + 10, y + 15);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.text("et autres renseignements importants", marginLeft + 10, y + 23);
  
  // Logo
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("NIVRA TELECOM", pageWidth - marginRight - 10, y + 18, { align: "right" });
  
  y += 40;
  
  // Document info box
  doc.setFillColor(...COLORS.background);
  doc.setDrawColor(...COLORS.border);
  doc.roundedRect(marginLeft, y, contentWidth, 20, 2, 2, "FD");
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.textLight);
  
  const infoY = y + 6;
  doc.text("Document", marginLeft + 5, infoY);
  doc.text("Version", marginLeft + 50, infoY);
  doc.text("En vigueur depuis", marginLeft + 90, infoY);
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.text);
  doc.text(data.documentNumber, marginLeft + 5, infoY + 6);
  doc.text(data.version, marginLeft + 50, infoY + 6);
  doc.text(formatDate(data.effectiveDate), marginLeft + 90, infoY + 6);
  
  if (data.lastUpdated) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.textLight);
    doc.text(`Dernière mise à jour: ${formatDate(data.lastUpdated)}`, pageWidth - marginRight - 5, infoY + 6, { align: "right" });
  }
  
  y += 28;
  
  // If linked to a contract
  if (data.contractNumber && data.clientName) {
    doc.setFillColor(232, 245, 253); // Light blue
    doc.roundedRect(marginLeft, y, contentWidth, 12, 2, 2, "F");
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.primary);
    doc.text(
      `Ce document fait partie intégrante du contrat ${data.contractNumber} pour ${data.clientName}`,
      marginLeft + 5,
      y + 7
    );
    
    y += 18;
  }
  
  // Table of contents
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.primary);
  doc.text("TABLE DES MATIÈRES", marginLeft, y);
  
  y += 6;
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.text);
  
  sections.forEach((section) => {
    doc.text(section.title, marginLeft + 5, y);
    y += 5;
  });
  
  y += 10;
  
  // ─────────────────────────────────────────────────────────────────────────
  // SECTIONS
  // ─────────────────────────────────────────────────────────────────────────
  
  sections.forEach((section) => {
    // Estimate space needed for section header + first paragraph
    checkPageBreak(25);
    
    // Section title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...COLORS.primary);
    doc.text(section.title, marginLeft, y);
    
    y += 6;
    
    // Section content
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.text);
    
    section.content.forEach((paragraph) => {
      const lines = doc.splitTextToSize(paragraph, contentWidth - 5);
      const lineHeight = 4;
      const neededSpace = lines.length * lineHeight + 3;
      
      checkPageBreak(neededSpace);
      
      doc.text(lines, marginLeft + 3, y);
      y += neededSpace;
    });
    
    // Subsections
    if (section.subsections) {
      section.subsections.forEach((sub) => {
        checkPageBreak(15);
        
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(...COLORS.secondary);
        doc.text(sub.title, marginLeft + 5, y);
        
        y += 5;
        
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(...COLORS.text);
        
        sub.content.forEach((paragraph) => {
          const lines = doc.splitTextToSize(`• ${paragraph}`, contentWidth - 15);
          const lineHeight = 3.5;
          const neededSpace = lines.length * lineHeight + 2;
          
          checkPageBreak(neededSpace);
          
          doc.text(lines, marginLeft + 8, y);
          y += neededSpace;
        });
      });
    }
    
    y += 5;
  });
  
  // ─────────────────────────────────────────────────────────────────────────
  // FINAL NOTICE
  // ─────────────────────────────────────────────────────────────────────────
  
  checkPageBreak(30);
  
  doc.setFillColor(255, 243, 224); // Light orange
  doc.setDrawColor(255, 152, 0);   // Orange border
  doc.roundedRect(marginLeft, y, contentWidth, 20, 2, 2, "FD");
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.text);
  doc.text("AVIS IMPORTANT", marginLeft + 5, y + 6);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(
    "En utilisant les services de Nivra Telecom, vous reconnaissez avoir lu et accepté les présentes Modalités.",
    marginLeft + 5,
    y + 12
  );
  doc.text(
    "Conservez ce document pour référence. Il fait partie intégrante de votre entente de service.",
    marginLeft + 5,
    y + 17
  );
  
  y += 28;
  
  // ─────────────────────────────────────────────────────────────────────────
  // FOOTER ON ALL PAGES
  // ─────────────────────────────────────────────────────────────────────────
  
  const totalPages = doc.getNumberOfPages();
  
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    
    const footerY = pageHeight - 12;
    
    doc.setDrawColor(...COLORS.border);
    doc.line(marginLeft, footerY - 3, pageWidth - marginRight, footerY - 3);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.textLight);
    
    doc.text(
      `${COMPANY_CONTACT.legalName} — ${COMPANY_CONTACT.fullAddress}`,
      pageWidth / 2,
      footerY,
      { align: "center" }
    );
    doc.text(
      `${COMPANY_CONTACT.supportEmailDisplay} — 438-544-2233 — nivra-telecom.ca`,
      pageWidth / 2,
      footerY + 4,
      { align: "center" }
    );
    
    doc.setFont("helvetica", "bold");
    doc.text(`Page ${i} / ${totalPages}`, pageWidth - marginRight, footerY + 2, { align: "right" });
    doc.text(data.documentNumber, marginLeft, footerY + 2);
  }

  return doc;
}

/**
 * Generate and download the modalités PDF
 */
export function downloadModalitesV2PDF(data: ModalitesV2Data): void {
  const doc = generateModalitesV2PDF(data);
  const fileName = `Modalites_Service_Nivra_${data.version}.pdf`;
  doc.save(fileName);
}

export default generateModalitesV2PDF;
