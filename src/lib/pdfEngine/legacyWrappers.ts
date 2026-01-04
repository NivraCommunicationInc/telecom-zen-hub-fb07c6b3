/**
 * Nivra Document Engine - Legacy Wrappers
 * 
 * These wrappers provide backward compatibility with the old PDF generators.
 * They convert old data formats to the new UnifiedDocumentData and call the new engine.
 * 
 * DEPRECATION NOTICE: These wrappers are provided for migration purposes.
 * New code should use the new pdfEngine/generator.ts directly.
 */

import jsPDF from "jspdf";
import { 
  generateUnifiedPDF, 
  type UnifiedDocumentData,
  type ServiceLineItem,
  type EquipmentItem,
  type OneTimeFee,
  type DiscountItem,
} from "./index";
import { getCompanyInfo, calculateQuebecTaxes } from "./adapters";
import { ACTIVE_CONTRACT_TEMPLATE } from "../contractTemplate";

// ============= LEGACY INTERFACE: TelecomContractData =============

export interface LegacyTelecomContractData {
  // Template metadata
  contractId?: string;
  templateId?: string;
  templateVersion?: string;

  // Agreement Identification
  contractNumber: string;
  contractName?: string;
  orderReference?: string;
  accountKey?: string;
  contractVersion?: string;
  issueDate?: string;
  effectiveDate?: string;
  orderChannel?: string;
  contractStatus?: string;
  
  // Customer Information
  clientName: string;
  clientFirstName?: string;
  clientLastName?: string;
  clientType?: string;
  clientAccountNumber?: string;
  billingAddress?: string;
  serviceAddress?: string;
  clientAddress?: string;
  serviceCity?: string;
  serviceProvince?: string;
  servicePostalCode?: string;
  clientEmail: string;
  clientPhone?: string;
  authorizedUser?: string;
  
  // Services - individual plans
  servicePlan?: string;
  serviceDescription?: string;
  internetPlan?: string;
  internetPrice?: number;
  tvBundle?: string;
  tvPrice?: number;
  mobilePlan?: string;
  mobilePrice?: number;
  streamingPlan?: string;
  streamingPrice?: number;
  
  // Equipment
  routerSerial?: string;
  terminalSerial?: string;
  terminalCount?: number;
  
  // Fees
  activationFee?: number;
  deliveryFee?: number;
  installationFee?: number;
  terminalFee?: number;
  routerFee?: number;
  simFee?: number;
  monthlyAmount?: number;
  
  // Billing
  subtotal?: number;
  tpsAmount?: number;
  tvqAmount?: number;
  totalAmount?: number;
  discountAmount?: number;
  
  // Discounts - detailed
  preauthDiscount?: number;
  preauthEnabled?: boolean;
  promoCode?: string;
  promoDiscount?: number;
  loyaltyDiscount?: number;
  multiLineDiscount?: number;
  
  // Order
  orderDate?: string;
  startDate?: string;
  orderNumber?: string;
  durationMonths?: number;
  
  // ID Verification
  idType?: string;
  idNumber?: string;
  idProvince?: string;
  idExpiration?: string;
  clientDOB?: string;
  
  // Signatures
  isSigned: boolean;
  signedAt?: string;
  signatureMethod?: string;
  
  // Admin
  employeeName?: string;
  employeeRole?: string;
  employeeTitle?: string;
  employeeEmail?: string;
  adminName?: string;
  adminEmail?: string;
  
  // Legacy misc
  internalStatus?: string;
  category?: string;
  bundleName?: string;
}

/**
 * @deprecated Use generateUnifiedPDF from pdfEngine instead
 * Wrapper for backward compatibility with existing code
 */
export function generateTelecomContractPDFLegacy(data: LegacyTelecomContractData): jsPDF {
  // Build services array from legacy fields - include ALL selected services with prices
  // IMPORTANT: Each service MUST be on its own row, never concatenated
  const services: ServiceLineItem[] = [];
  
  // Helper to determine if price is valid (not undefined and not 0 when it shouldn't be)
  const hasValidPrice = (price: number | undefined): boolean => {
    return price !== undefined && price !== null;
  };
  
  if (data.internetPlan) {
    services.push({ 
      type: "Internet", 
      name: data.internetPlan, 
      // Use -1 as sentinel for "Prix à confirmer" - will be handled in generator
      monthlyPrice: hasValidPrice(data.internetPrice) ? data.internetPrice! : -1,
      priceLabel: "/mois",
    });
  }
  if (data.tvBundle) {
    services.push({ 
      type: "TV", 
      name: data.tvBundle, 
      description: "Requiert Internet", 
      monthlyPrice: hasValidPrice(data.tvPrice) ? data.tvPrice! : -1,
      priceLabel: "/mois",
    });
  }
  if (data.mobilePlan) {
    services.push({ 
      type: "Mobile", 
      name: data.mobilePlan, 
      monthlyPrice: hasValidPrice(data.mobilePrice) ? data.mobilePrice! : -1,
      priceLabel: "/30 jours",
    });
  }
  if (data.streamingPlan) {
    services.push({ 
      type: "Streaming", 
      name: data.streamingPlan, 
      monthlyPrice: hasValidPrice(data.streamingPrice) ? data.streamingPrice! : -1,
      priceLabel: "/mois",
    });
  }
  
  // Fallback to generic service only if no services found
  if (services.length === 0 && (data.servicePlan || data.serviceDescription || data.contractName)) {
    const planName = data.servicePlan || data.serviceDescription || data.contractName || "Services";
    // Try to split by comma or + to get individual services
    const parts = planName.split(/[,+]/).map(s => s.trim()).filter(Boolean);
    
    if (parts.length > 1) {
      // Multiple services detected in the string - create separate entries
      parts.forEach(part => {
        // Try to detect service type from the part name
        const partLower = part.toLowerCase();
        let type: "Mobile" | "Internet" | "TV" | "Streaming" | "Security" | "Other" = "Other";
        let priceLabel = "/mois";
        
        if (partLower.includes('internet') || partLower.includes('fibre')) {
          type = "Internet";
        } else if (partLower.includes('tv') || partLower.includes('télé')) {
          type = "TV";
        } else if (partLower.includes('mobile') || partLower.includes('cellulaire')) {
          type = "Mobile";
          priceLabel = "/30 jours";
        } else if (partLower.includes('streaming')) {
          type = "Streaming";
        }
        
        services.push({ 
          type, 
          name: part, 
          monthlyPrice: -1, // Price unknown for parsed services
          priceLabel,
        });
      });
    } else {
      // Single service or unparseable - use as-is
      services.push({ 
        type: "Other", 
        name: planName, 
        monthlyPrice: (data.subtotal && data.subtotal > 0) ? data.subtotal : (data.monthlyAmount || -1),
        priceLabel: "/mois",
      });
    }
  }
  
  // Build equipment array
  const equipment: EquipmentItem[] = [];
  
  if (data.routerFee && data.routerFee > 0) {
    equipment.push({
      name: "Routeur Nivra Born WiFi",
      quantity: 1,
      unitPrice: data.routerFee,
      serial: data.routerSerial,
      warranty: "1 an",
    });
  }
  
  if (data.terminalFee && data.terminalFee > 0) {
    equipment.push({
      name: "Terminal Nivra 4K Smart",
      quantity: data.terminalCount || 1,
      unitPrice: data.terminalFee / (data.terminalCount || 1),
      serial: data.terminalSerial,
      warranty: "1 an",
    });
  }
  
  // Build fees array
  const oneTimeFees: OneTimeFee[] = [];
  
  if (data.activationFee && data.activationFee > 0) {
    oneTimeFees.push({ label: "Frais d'activation", amount: data.activationFee });
  }
  if (data.deliveryFee && data.deliveryFee > 0) {
    oneTimeFees.push({ label: "Frais de livraison", amount: data.deliveryFee });
  }
  if (data.installationFee && data.installationFee > 0) {
    oneTimeFees.push({ label: "Installation professionnelle", amount: data.installationFee });
  }
  if (data.simFee && data.simFee > 0) {
    oneTimeFees.push({ label: "Carte SIM", amount: data.simFee });
  }
  
  // DISCOUNTS REMOVED - Per requirement, no discounts should appear in contracts
  // Keep empty discounts array for type compatibility
  const discounts: DiscountItem[] = [];
  
  // Calculate totals - ignore services with unknown price (-1)
  const equipmentTotal = equipment.reduce((sum, e) => sum + e.unitPrice * e.quantity, 0);
  const feesTotal = oneTimeFees.reduce((sum, f) => sum + f.amount, 0);
  
  // Calculate services subtotal - only include services with known prices (not -1)
  const servicesSubtotal = services.reduce((sum, s) => {
    if (s.monthlyPrice > 0) {
      return sum + s.monthlyPrice * (s.quantity || 1);
    }
    return sum;
  }, 0);
  
  const unifiedData: UnifiedDocumentData = {
    docType: "contract",
    metadata: {
      documentNumber: data.contractNumber,
      orderNumber: data.orderReference || data.orderNumber,
      date: data.issueDate || data.orderDate || data.startDate || new Date().toISOString(),
      effectiveDate: data.effectiveDate || data.orderDate || data.startDate,
      version: data.templateVersion || ACTIVE_CONTRACT_TEMPLATE.version,
    },
    client: {
      fullName: data.clientName || `${data.clientFirstName || ""} ${data.clientLastName || ""}`.trim(),
      email: data.clientEmail,
      phone: data.clientPhone,
      accountNumber: data.clientAccountNumber || data.accountKey,
      serviceAddress: data.serviceAddress,
      serviceCity: data.serviceCity,
      serviceProvince: data.serviceProvince || "QC",
      servicePostalCode: data.servicePostalCode,
      billingAddress: data.billingAddress,
    },
    company: getCompanyInfo(),
    agent: data.employeeName ? {
      name: data.employeeName,
      role: data.employeeRole,
    } : undefined,
    services,
    equipment,
    oneTimeFees,
    discounts,
    billing: {
      // Use calculated services subtotal if available, otherwise fall back to data.subtotal
      subtotal: servicesSubtotal > 0 ? servicesSubtotal : (data.subtotal || data.monthlyAmount || 0),
      oneTimeTotal: equipmentTotal + feesTotal,
      discountTotal: 0, // No discounts - always 0
      tps: data.tpsAmount || 0,
      tvq: data.tvqAmount || 0,
      total: data.totalAmount || data.monthlyAmount || 0,
    },
    payment: {
      status: "pending",
    },
    isSigned: data.isSigned,
    signedAt: data.signedAt,
    signatureMethod: data.signatureMethod as "electronic" | "manual" | undefined,
  };
  
  return generateUnifiedPDF(unifiedData);
}

// ============= LEGACY INTERFACE: InvoiceData =============

export interface LegacyInvoiceData {
  invoiceNumber: string;
  orderNumber?: string;
  paymentReference?: string;
  clientNumber?: string;
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  clientAddress?: string;
  clientCity?: string;
  subtotal: number;
  fees?: number;
  credits?: number;
  deliveryFee?: number;
  activationFee?: number;
  installationFee?: number;
  terminalFee?: number;
  terminalCount?: number;
  routerFee?: number;
  routerSerial?: string;
  terminalSerials?: string[];
  simFee?: number;
  simSerial?: string;
  simType?: "physical" | "esim";
  discountAmount?: number;
  preauthDiscount?: number;
  tpsAmount?: number;
  tvqAmount?: number;
  lateFeeAmount?: number;
  dueDate?: string;
  createdAt: string;
  status: string;
  paidAt?: string;
  notes?: string;
  equipmentId?: string;
  servicePlan?: string;
  serviceDescription?: string;
  tvBundle?: string;
  mobilePlan?: string;
  streamingService?: string;
  deliveryMethod?: string;
  trackingNumber?: string;
  issuedBy?: string;
  issuedByRole?: string;
  issuedAt?: string;
  billingCycleStart?: string;
  billingCycleEnd?: string;
}

/**
 * @deprecated Use generateUnifiedPDF from pdfEngine instead
 * Wrapper for backward compatibility with existing code
 */
export function generateInvoicePDFLegacy(data: LegacyInvoiceData): jsPDF {
  const services: ServiceLineItem[] = [];
  
  if (data.servicePlan || data.serviceDescription) {
    services.push({
      type: "Other",
      name: data.servicePlan || data.serviceDescription || "Services",
      monthlyPrice: data.subtotal,
    });
  }
  
  const oneTimeFees: OneTimeFee[] = [];
  
  if (data.activationFee && data.activationFee > 0) {
    oneTimeFees.push({ label: "Frais d'activation", amount: data.activationFee });
  }
  if (data.deliveryFee && data.deliveryFee > 0) {
    oneTimeFees.push({ label: "Frais de livraison", amount: data.deliveryFee });
  }
  if (data.installationFee && data.installationFee > 0) {
    oneTimeFees.push({ label: "Installation", amount: data.installationFee });
  }
  if (data.terminalFee && data.terminalFee > 0) {
    oneTimeFees.push({ label: "Terminal", amount: data.terminalFee });
  }
  if (data.routerFee && data.routerFee > 0) {
    oneTimeFees.push({ label: "Routeur", amount: data.routerFee });
  }
  if (data.simFee && data.simFee > 0) {
    oneTimeFees.push({ label: "Carte SIM", amount: data.simFee });
  }
  if (data.fees && data.fees > 0) {
    oneTimeFees.push({ label: "Frais supplémentaires", amount: data.fees });
  }
  
  const discounts: DiscountItem[] = [];
  if (data.discountAmount && data.discountAmount > 0) {
    discounts.push({ label: "Rabais", amount: data.discountAmount });
  }
  if (data.credits && data.credits > 0) {
    discounts.push({ label: "Crédits", amount: data.credits });
  }
  
  const feesTotal = oneTimeFees.reduce((sum, f) => sum + f.amount, 0);
  const discountTotal = discounts.reduce((sum, d) => sum + d.amount, 0);
  
  const taxableAmount = data.subtotal + feesTotal - discountTotal;
  const taxes = calculateQuebecTaxes(taxableAmount);
  
  const unifiedData: UnifiedDocumentData = {
    docType: "invoice",
    metadata: {
      documentNumber: data.invoiceNumber,
      orderNumber: data.orderNumber,
      date: data.createdAt,
    },
    client: {
      fullName: data.clientName,
      email: data.clientEmail,
      phone: data.clientPhone,
      accountNumber: data.clientNumber,
      serviceAddress: data.clientAddress,
      serviceCity: data.clientCity,
    },
    company: getCompanyInfo(),
    services,
    equipment: [],
    oneTimeFees,
    discounts,
    billing: {
      subtotal: data.subtotal,
      oneTimeTotal: feesTotal,
      discountTotal,
      tps: data.tpsAmount ?? taxes.tps,
      tvq: data.tvqAmount ?? taxes.tvq,
      total: taxableAmount + (data.tpsAmount ?? taxes.tps) + (data.tvqAmount ?? taxes.tvq),
    },
    payment: {
      status: data.status === "paid" ? "paid" : 
              data.status === "overdue" ? "overdue" : 
              data.status === "cancelled" ? "cancelled" : "pending",
      reference: data.paymentReference,
      paidAt: data.paidAt,
      dueDate: data.dueDate,
    },
    notes: data.notes,
  };
  
  return generateUnifiedPDF(unifiedData);
}

// ============= RE-EXPORTS FOR COMPATIBILITY =============

/**
 * @deprecated Use generateUnifiedPDF from pdfEngine instead
 */
export const generateTelecomContractPDF = generateTelecomContractPDFLegacy;

/**
 * @deprecated Use generateUnifiedPDF from pdfEngine instead  
 */
export const generateInvoicePDF = generateInvoicePDFLegacy;

// Type re-exports for compatibility
export type TelecomContractData = LegacyTelecomContractData;
export type InvoiceData = LegacyInvoiceData;

// ============= DOWNLOAD & VIEW HELPERS =============

export function downloadTelecomContractPDF(data: LegacyTelecomContractData): void {
  const doc = generateTelecomContractPDFLegacy(data);
  const blob = doc.output("blob");
  const filename = `Contrat_${data.contractNumber}.pdf`;
  
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function viewTelecomContractPDF(data: LegacyTelecomContractData): void {
  const doc = generateTelecomContractPDFLegacy(data);
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
}

export function getTelecomContractBlob(data: LegacyTelecomContractData): Blob {
  const doc = generateTelecomContractPDFLegacy(data);
  return doc.output("blob");
}

export function downloadInvoicePDFLegacy(data: LegacyInvoiceData): void {
  const doc = generateInvoicePDFLegacy(data);
  const blob = doc.output("blob");
  const filename = `Facture_${data.invoiceNumber}.pdf`;
  
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function viewInvoicePDFLegacy(data: LegacyInvoiceData): void {
  const doc = generateInvoicePDFLegacy(data);
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
}

export function getInvoicePDFBlob(data: LegacyInvoiceData): Blob {
  const doc = generateInvoicePDFLegacy(data);
  return doc.output("blob");
}

// Re-export for compatibility with old names
export const downloadInvoicePDF = downloadInvoicePDFLegacy;
export const viewInvoicePDF = viewInvoicePDFLegacy;

// Aliases for old contractPdfGenerator names
export const downloadContractPDF = downloadTelecomContractPDF;
export const viewContractPDF = viewTelecomContractPDF;
export const getContractPDFBlob = getTelecomContractBlob;
