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
import { safePDFDownload, safePDFOpen } from "../pdfUtils";
import { 
  extractLineItemsFromOrder, 
  formatPeriodLabel,
  calculateLineItemTotals,
  type OrderLineItem 
} from "../orderLineItems";

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
  clientSignature?: string;
  clientSignatureType?: "canvas" | "text";
  
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
  
  // NEW: Structured line items from order.equipment_details
  equipmentDetails?: {
    line_items?: any[];
    [key: string]: any;
  };
}

/**
 * Maps OrderLineItem to ServiceLineItem for PDF
 */
function lineItemToServiceItem(item: OrderLineItem): ServiceLineItem {
  const typeMap: Record<string, ServiceLineItem['type']> = {
    internet: "Internet",
    tv: "TV",
    mobile: "Mobile",
    streaming: "Streaming",
    security: "Security",
    other: "Other",
  };
  
  return {
    type: typeMap[item.type] || "Other",
    name: item.name,
    monthlyPrice: item.unit_price >= 0 ? item.unit_price : 0, // Never use -1, show 0 instead
    quantity: item.qty,
    priceLabel: formatPeriodLabel(item.period),
    description: item.description,
    isOneTime: item.period === "one_time",
  };
}

/**
 * Maps OrderLineItem to EquipmentItem for PDF
 */
function lineItemToEquipment(item: OrderLineItem): EquipmentItem {
  return {
    name: item.name,
    quantity: item.qty,
    unitPrice: item.unit_price >= 0 ? item.unit_price : 0,
    warranty: "1 an",
  };
}

/**
 * Maps OrderLineItem to OneTimeFee for PDF
 */
function lineItemToFee(item: OrderLineItem): OneTimeFee {
  const price = item.unit_price >= 0 ? item.unit_price : 0;
  return {
    label: item.name,
    amount: price * item.qty,
    description: item.description,
  };
}

/**
 * Maps OrderLineItem (discount) to DiscountItem for PDF
 */
function lineItemToDiscount(item: OrderLineItem): DiscountItem {
  const price = item.unit_price >= 0 ? item.unit_price : 0;
  return {
    label: item.name,
    amount: price * item.qty,
    promoCode: item.ref_id,
    type: item.name.toLowerCase().includes('promo') ? 'promo' : 
          item.name.toLowerCase().includes('préauto') ? 'preauth' : 'other',
  };
}

/**
 * @deprecated Use generateUnifiedPDF from pdfEngine instead
 * Wrapper for backward compatibility with existing code
 */
export function generateTelecomContractPDFLegacy(data: LegacyTelecomContractData): jsPDF {
  // PRIORITY: Use structured line_items from equipmentDetails if available
  const lineItems = extractLineItemsFromOrder(data.equipmentDetails);
  const hasLineItems = lineItems && lineItems.length > 0;
  
  // Build services, equipment, fees, and discounts from line_items OR fallback to legacy fields
  let services: ServiceLineItem[] = [];
  let equipment: EquipmentItem[] = [];
  let oneTimeFees: OneTimeFee[] = [];
  let discounts: DiscountItem[] = [];
  
  if (hasLineItems) {
    // === PRIMARY PATH: Use structured line_items ONLY ===
    // CRITICAL: When line_items exist, NEVER add fallback services
    // Only show what was actually selected by the client
    
    console.log("[Contract PDF] Using line_items from equipmentDetails:", lineItems);
    
    for (const item of lineItems!) {
      // FILTER: Only include items with valid data
      // Must have: name, qty > 0, and valid price >= 0
      if (!item.name || item.name.trim() === "") continue;
      if (item.qty <= 0) continue;
      // Accept price >= 0 (0 is valid for free items)
      if (item.unit_price < 0) {
        console.warn(`[Contract PDF] Skipping item with invalid price: ${item.name}`, item);
        continue;
      }
      
      if (item.category === "service") {
        services.push(lineItemToServiceItem(item));
      } else if (item.category === "equipment") {
        equipment.push(lineItemToEquipment(item));
      } else if (item.category === "fee") {
        oneTimeFees.push(lineItemToFee(item));
      } else if (item.category === "discount") {
        discounts.push(lineItemToDiscount(item));
      }
    }
    
    console.log("[Contract PDF] Filtered services:", services.length, "equipment:", equipment.length, "fees:", oneTimeFees.length, "discounts:", discounts.length);
    
    // Calculate totals from line items (only valid items)
    const validLineItems = lineItems!.filter(item => item.unit_price >= 0 && item.qty > 0);
    const totals = calculateLineItemTotals(validLineItems);
    const taxableAmount = Math.max(0, totals.serviceSubtotal + totals.equipmentSubtotal + totals.feeSubtotal - totals.discountTotal);
    const taxes = calculateQuebecTaxes(taxableAmount);
    
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
        subtotal: totals.serviceSubtotal,
        oneTimeTotal: totals.equipmentSubtotal + totals.feeSubtotal,
        discountTotal: totals.discountTotal,
        tps: data.tpsAmount ?? taxes.tps,
        tvq: data.tvqAmount ?? taxes.tvq,
        total: data.totalAmount || (taxableAmount + taxes.tps + taxes.tvq),
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
  
  // === FALLBACK PATH: Use legacy individual fields ===
  // Helper to determine if price is valid
  const hasValidPrice = (price: number | undefined): boolean => {
    return price !== undefined && price !== null && price >= 0;
  };
  
  if (data.internetPlan) {
    services.push({ 
      type: "Internet", 
      name: data.internetPlan, 
      monthlyPrice: hasValidPrice(data.internetPrice) ? data.internetPrice! : 0,
      priceLabel: "/mois",
    });
  }
  if (data.tvBundle) {
    services.push({ 
      type: "TV", 
      name: data.tvBundle, 
      description: "Requiert Internet", 
      monthlyPrice: hasValidPrice(data.tvPrice) ? data.tvPrice! : 0,
      priceLabel: "/mois",
    });
  }
  if (data.mobilePlan) {
    services.push({ 
      type: "Mobile", 
      name: data.mobilePlan, 
      monthlyPrice: hasValidPrice(data.mobilePrice) ? data.mobilePrice! : 0,
      priceLabel: "/30 jours",
    });
  }
  if (data.streamingPlan) {
    services.push({ 
      type: "Streaming", 
      name: data.streamingPlan, 
      monthlyPrice: hasValidPrice(data.streamingPrice) ? data.streamingPrice! : 0,
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
          monthlyPrice: 0, // Unknown price shows as 0.00$
          priceLabel,
        });
      });
    } else {
      services.push({ 
        type: "Other", 
        name: planName, 
        monthlyPrice: (data.subtotal && data.subtotal > 0) ? data.subtotal : (data.monthlyAmount || 0),
        priceLabel: "/mois",
      });
    }
  }
  
  // Equipment from individual fields
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
  
  // One-time fees from individual fields
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
  
  // Discounts from individual fields
  if (data.promoDiscount && data.promoDiscount > 0) {
    discounts.push({
      label: "Rabais promotionnel",
      amount: data.promoDiscount,
      promoCode: data.promoCode,
      type: "promo",
    });
  }
  if (data.preauthDiscount && data.preauthDiscount > 0) {
    discounts.push({
      label: "Rabais paiement préautorisé",
      amount: data.preauthDiscount,
      type: "preauth",
    });
  }
  if (data.loyaltyDiscount && data.loyaltyDiscount > 0) {
    discounts.push({
      label: "Rabais fidélité",
      amount: data.loyaltyDiscount,
      type: "loyalty",
    });
  }
  if (data.multiLineDiscount && data.multiLineDiscount > 0) {
    discounts.push({
      label: "Rabais multi-services",
      amount: data.multiLineDiscount,
      type: "multiLine",
    });
  }
  
  // Calculate totals
  const equipmentTotal = equipment.reduce((sum, e) => sum + e.unitPrice * e.quantity, 0);
  const feesTotal = oneTimeFees.reduce((sum, f) => sum + f.amount, 0);
  const discountTotal = discounts.reduce((sum, d) => sum + d.amount, 0);
  const servicesSubtotal = services.reduce((sum, s) => sum + (s.monthlyPrice || 0) * (s.quantity || 1), 0);
  
  const taxableAmount = Math.max(0, servicesSubtotal + equipmentTotal + feesTotal - discountTotal);
  const taxes = calculateQuebecTaxes(taxableAmount);
  
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
      subtotal: servicesSubtotal > 0 ? servicesSubtotal : (data.subtotal || data.monthlyAmount || 0),
      oneTimeTotal: equipmentTotal + feesTotal,
      discountTotal,
      tps: data.tpsAmount ?? taxes.tps,
      tvq: data.tvqAmount ?? taxes.tvq,
      total: data.totalAmount || (taxableAmount + taxes.tps + taxes.tvq),
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
  // CRITICAL: Support for multi-service orders
  orderLineItems?: any[];
}

/**
 * @deprecated Use generateUnifiedPDF from pdfEngine instead
 * Wrapper for backward compatibility with existing code
 */
export function generateInvoicePDFLegacy(data: LegacyInvoiceData): jsPDF {
  const services: ServiceLineItem[] = [];
  const oneTimeFees: OneTimeFee[] = [];
  const equipment: EquipmentItem[] = [];
  const discounts: DiscountItem[] = [];
  
  // PRIORITY 1: Extract from orderLineItems if available (multi-service support)
  if (data.orderLineItems && Array.isArray(data.orderLineItems) && data.orderLineItems.length > 0) {
    for (const item of data.orderLineItems) {
      const unitPrice = typeof item.unit_price === "number" ? item.unit_price : 0;
      const qty = item.qty || 1;
      
      if (item.category === "service" && item.period !== "one_time") {
        // Map type to display type
        const typeMap: Record<string, ServiceLineItem["type"]> = {
          internet: "Internet",
          mobile: "Mobile",
          tv: "TV",
          streaming: "Streaming",
          security: "Security",
        };
        
        services.push({
          type: typeMap[item.type?.toLowerCase()] || "Other",
          name: item.name || "Service",
          description: item.description,
          monthlyPrice: unitPrice,
          quantity: qty,
          priceLabel: item.period === "30_days" ? "/30 jours" : "/mois",
        });
      } else if (item.category === "equipment" && unitPrice > 0) {
        equipment.push({
          name: item.name || "Équipement",
          quantity: qty,
          unitPrice: unitPrice,
        });
      } else if (item.category === "fee" && unitPrice > 0) {
        oneTimeFees.push({
          label: item.name || "Frais",
          amount: unitPrice * qty,
        });
      } else if (item.category === "discount" && unitPrice > 0) {
        discounts.push({
          label: item.name || "Rabais",
          amount: unitPrice * qty,
        });
      }
    }
    
    console.log(`[Legacy Invoice PDF] Extracted ${services.length} services from orderLineItems`);
  } else {
    // FALLBACK: Build from legacy fields
    if (data.servicePlan || data.serviceDescription) {
      services.push({
        type: "Other",
        name: data.servicePlan || data.serviceDescription || "Services",
        monthlyPrice: data.subtotal,
      });
    }
    
    // Equipment from legacy fields
    if (data.routerFee && data.routerFee > 0) {
      equipment.push({ name: "Routeur", quantity: 1, unitPrice: data.routerFee });
    }
    if (data.terminalFee && data.terminalFee > 0) {
      equipment.push({ name: "Terminal", quantity: data.terminalCount || 1, unitPrice: data.terminalFee / (data.terminalCount || 1) });
    }
    if (data.simFee && data.simFee > 0) {
      equipment.push({ name: "Carte SIM", quantity: 1, unitPrice: data.simFee });
    }
    
    // Fees from legacy fields
    if (data.activationFee && data.activationFee > 0) {
      oneTimeFees.push({ label: "Frais d'activation", amount: data.activationFee });
    }
    if (data.deliveryFee && data.deliveryFee > 0) {
      oneTimeFees.push({ label: "Frais de livraison", amount: data.deliveryFee });
    }
    if (data.installationFee && data.installationFee > 0) {
      oneTimeFees.push({ label: "Installation", amount: data.installationFee });
    }
    if (data.fees && data.fees > 0) {
      oneTimeFees.push({ label: "Frais supplémentaires", amount: data.fees });
    }
    
    // Discounts from legacy fields
    if (data.discountAmount && data.discountAmount > 0) {
      discounts.push({ label: "Rabais", amount: data.discountAmount });
    }
  }
  
  // Add credits as discount if not already in discounts
  if (data.credits && data.credits > 0) {
    discounts.push({ label: "Crédits", amount: data.credits });
  }
  
  // Calculate totals
  const servicesTotal = services.reduce((sum, s) => sum + (s.monthlyPrice * (s.quantity || 1)), 0);
  const equipmentTotal = equipment.reduce((sum, e) => sum + (e.unitPrice * e.quantity), 0);
  const feesTotal = oneTimeFees.reduce((sum, f) => sum + f.amount, 0);
  const discountTotal = discounts.reduce((sum, d) => sum + d.amount, 0);
  
  const taxableAmount = Math.max(0, servicesTotal + equipmentTotal + feesTotal - discountTotal);
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
    equipment,
    oneTimeFees,
    discounts,
    billing: {
      subtotal: servicesTotal > 0 ? servicesTotal : data.subtotal,
      oneTimeTotal: equipmentTotal + feesTotal,
      discountTotal,
      tps: data.tpsAmount ?? taxes.tps,
      tvq: data.tvqAmount ?? taxes.tvq,
      total: taxableAmount + (data.tpsAmount ?? taxes.tps) + (data.tvqAmount ?? taxes.tvq),
    },
    payment: {
      // PREPAID MODEL: Map legacy statuses to new terminology
      status: data.status === "paid" ? "paid" : 
              data.status === "overdue" ? "renewal_required" : 
              data.status === "void" ? "void" :
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
  safePDFDownload(blob, filename);
}

export function viewTelecomContractPDF(data: LegacyTelecomContractData): void {
  const doc = generateTelecomContractPDFLegacy(data);
  const blob = doc.output("blob");
  const filename = `Contrat_${data.contractNumber}.pdf`;
  safePDFOpen(blob, filename);
}

export function getTelecomContractBlob(data: LegacyTelecomContractData): Blob {
  const doc = generateTelecomContractPDFLegacy(data);
  return doc.output("blob");
}

export function downloadInvoicePDFLegacy(data: LegacyInvoiceData): void {
  const doc = generateInvoicePDFLegacy(data);
  const blob = doc.output("blob");
  const filename = `Facture_${data.invoiceNumber}.pdf`;
  safePDFDownload(blob, filename);
}

export function viewInvoicePDFLegacy(data: LegacyInvoiceData): void {
  const doc = generateInvoicePDFLegacy(data);
  const blob = doc.output("blob");
  const filename = `Facture_${data.invoiceNumber}.pdf`;
  safePDFOpen(blob, filename);
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
