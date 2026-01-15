import jsPDF from "jspdf";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { COMPANY_CONTACT, ETRANSFER_CONFIG } from "@/config/company";
import { calculateBillingTotals, TAX_RATES, type BillingInput } from "@/lib/pdfEngine/billingCalculator";
import { sanitizeLegalText } from "@/lib/pdfEngine/helpers";
import { validateOrderLineItems, logValidationResults } from "@/lib/billingValidation";

// =============================================================================
// NIVRA INVOICE PDF GENERATOR
// Single source of truth: billingCalculator.ts for all tax/total calculations
// CRITICAL: Company address is always Nivra's official address, never client's
// INVARIANT: Always compute totals from normalized line_items when available
// =============================================================================

// Business Information interface for dynamic values from site_settings
export interface BusinessInfo {
  name: string;
  division: string;
  description: string;
  address: string;
  email: string;
  phone: string;
  hours: string;
  neq: string;
}

// Default business info - ALWAYS use COMPANY_CONTACT as fallback
const getDefaultBusinessInfo = (): BusinessInfo => ({
  name: COMPANY_CONTACT.legalName.toUpperCase(),
  division: "Customer Service Agreement Billing Division",
  description: "Telecommunications Services Provider — Province of Québec",
  address: COMPANY_CONTACT.fullAddress, // 1799 Av. Pierre-Péladeau, Laval, QC H7T 2Y5
  email: COMPANY_CONTACT.supportEmailDisplay,
  phone: COMPANY_CONTACT.supportPhoneFormatted,
  hours: COMPANY_CONTACT.supportHours,
  neq: "2291249786",
});

// LEGACY CONSTANT for backward compatibility (uses defaults)
const NIVRA_BUSINESS = getDefaultBusinessInfo();

// Service line item for multi-service support
export interface InvoiceServiceItem {
  type: "Internet" | "Mobile" | "TV" | "Security" | "Streaming" | "Other";
  name: string;
  description?: string;
  quantity?: number;
  monthlyPrice: number;
  period?: string; // "/mois" or "/30 jours"
  isOneTime?: boolean;
}

export interface InvoiceData {
  invoiceNumber: string;
  orderNumber?: string;
  paymentReference?: string;
  clientNumber?: string; // Client account number
  clientAccountNumber?: string; // Alternative field name
  orderClientAccountNumber?: string; // From order data
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  clientAddress?: string;
  clientCity?: string;
  billingCycleStart?: string;
  billingCycleEnd?: string;
  
  // NEW: Multi-service support - array of recurring services from order line_items
  services?: InvoiceServiceItem[];
  
  // Structured line items from order (equipment_details.line_items)
  orderLineItems?: any[];
  
  // Legacy fields for backward compatibility
  subtotal: number;
  fees?: number;
  credits?: number;
  deliveryFee?: number;
  activationFee?: number;
  installationFee?: number;
  terminalFee?: number;
  terminalCount?: number;
  routerFee?: number;
  simFee?: number;
  simType?: "physical" | "esim";
  discountAmount?: number;
  preauthDiscount?: number;
  promoCode?: string;
  promoDescription?: string;
  tpsAmount?: number;
  tvqAmount?: number;
  lateFeeAmount?: number;
  dueDate?: string;
  createdAt: string;
  status: string;
  paidAt?: string;
  notes?: string;
  equipmentId?: string;
  routerSerial?: string;
  terminalSerials?: string[];
  simSerial?: string;
  serviceDescription?: string;
  servicePlan?: string;
  tvBundle?: string;
  mobilePlan?: string;
  streamingService?: string;
  deliveryMethod?: string;
  trackingNumber?: string;
  issuedBy?: string;
  issuedByRole?: string;
  issuedAt?: string;
  paymentMethod?: "credit_card" | "etransfer" | "cash" | "other";
  cardLast4?: string;
  cardType?: string;
  // Site settings override for dynamic contact values
  siteSettings?: {
    support_phone?: string;
    support_email?: string;
    address?: string;
    business_hours?: string;
  };
}

export const generateInvoicePDF = (data: InvoiceData): jsPDF => {
  // Build business info from site settings (if provided) or use defaults
  const businessInfo: BusinessInfo = {
    ...getDefaultBusinessInfo(),
    ...(data.siteSettings?.address && { address: data.siteSettings.address }),
    ...(data.siteSettings?.support_email && { email: data.siteSettings.support_email }),
    ...(data.siteSettings?.support_phone && { phone: data.siteSettings.support_phone }),
    ...(data.siteSettings?.business_hours && { hours: data.siteSettings.business_hours }),
  };
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  const topMargin = 15;
  const bottomMargin = 40;
  let currentY = margin;

  // Color palette
  const primaryColor: [number, number, number] = [0, 150, 180];
  const navyColor: [number, number, number] = [10, 25, 47];
  const darkColor: [number, number, number] = [30, 30, 30];
  const grayColor: [number, number, number] = [100, 100, 100];
  const lightGray: [number, number, number] = [150, 150, 150];
  const accentColor: [number, number, number] = [0, 120, 150];
  const successColor: [number, number, number] = [34, 197, 94];

  // Helper: check if we need a page break
  const checkPageBreak = (neededHeight: number): boolean => {
    if (currentY + neededHeight > pageHeight - bottomMargin) {
      doc.addPage();
      currentY = topMargin;
      return true;
    }
    return false;
  };

  // Helper: add wrapped text with sanitization and page break handling
  const addWrappedText = (
    text: string,
    x: number,
    maxWidth: number,
    lineHeight: number,
    fontSize: number = 6,
    color: [number, number, number] = lightGray
  ): void => {
    doc.setFontSize(fontSize);
    doc.setTextColor(...color);
    // CRITICAL: Always sanitize legal text before splitting
    const sanitizedText = sanitizeLegalText(text);
    const lines = doc.splitTextToSize(sanitizedText, maxWidth);
    const neededHeight = lines.length * lineHeight;
    
    checkPageBreak(neededHeight);
    
    for (let i = 0; i < lines.length; i++) {
      doc.text(lines[i], x, currentY);
      currentY += lineHeight;
    }
  };

  // ========================================================================
  // CLIENT ACCOUNT NUMBER - Robust fallback chain
  // Priority: clientNumber → clientAccountNumber → orderClientAccountNumber → N/A
  // ========================================================================
  const resolveClientAccountNumber = (): string => {
    const candidates = [
      data.clientNumber,
      data.clientAccountNumber,
      data.orderClientAccountNumber,
    ];
    
    for (const candidate of candidates) {
      if (candidate && typeof candidate === 'string' && candidate.trim() !== '' && candidate.trim().toUpperCase() !== 'N/A') {
        return candidate.trim();
      }
    }
    
    // Log error for missing account number - this indicates a data flow issue
    console.error("[Invoice PDF] MISSING client account number - check data source", {
      invoiceNumber: data.invoiceNumber,
      clientEmail: data.clientEmail,
      clientName: data.clientName,
      providedValues: { clientNumber: data.clientNumber, clientAccountNumber: data.clientAccountNumber, orderClientAccountNumber: data.orderClientAccountNumber },
    });
    
    return "N/A";
  };
  
  const clientAccountNumber = resolveClientAccountNumber();

  // ========================================================================
  // BUILD SERVICES LIST - Multi-service support from order line_items
  // CRITICAL: Must extract ALL services from orderLineItems when available
  // INVARIANT: Always compute from line_items, never from stored subtotal
  // ========================================================================
  
  // Run validation on orderLineItems if available
  if (data.orderLineItems && Array.isArray(data.orderLineItems) && data.orderLineItems.length > 0) {
    const validation = validateOrderLineItems({ line_items: data.orderLineItems });
    logValidationResults("Invoice PDF", validation);
    
    if (validation.blockingSave) {
      console.error("[Invoice PDF] BLOCKING ERRORS detected - PDF may have incorrect totals:", validation.errors);
    }
  }
  
  const buildServicesList = (): InvoiceServiceItem[] => {
    // PRIORITY 1: If services array is explicitly provided, use it
    if (data.services && data.services.length > 0) {
      return data.services.filter(s => !s.isOneTime && s.monthlyPrice >= 0);
    }
    
    // PRIORITY 2: Extract from orderLineItems (equipment_details.line_items)
    if (data.orderLineItems && Array.isArray(data.orderLineItems) && data.orderLineItems.length > 0) {
      const services: InvoiceServiceItem[] = [];
      
      for (const item of data.orderLineItems) {
        // Only include service category items (not equipment/fees/discounts)
        if (item.category !== "service") continue;
        if (item.period === "one_time") continue; // Skip one-time services
        
        // Map type to display type
        const typeMap: Record<string, InvoiceServiceItem["type"]> = {
          internet: "Internet",
          mobile: "Mobile",
          tv: "TV",
          streaming: "Streaming",
          security: "Security",
        };
        
        const displayType = typeMap[item.type?.toLowerCase()] || "Internet";
        const period = item.period === "30_days" ? "/30 jours" : "/mois";
        const unitPrice = typeof item.unit_price === "number" ? item.unit_price : 0;
        
        services.push({
          type: displayType,
          name: item.name || "Service",
          description: item.description || "",
          quantity: item.qty || 1,
          monthlyPrice: unitPrice,
          period,
          isOneTime: false,
        });
      }
      
      if (services.length > 0) {
        // Log success for debugging
        console.log(`[Invoice PDF] Extracted ${services.length} services from orderLineItems:`, 
          services.map(s => `${s.type}: ${s.name} @ $${s.monthlyPrice}`));
        return services;
      }
    }
    
    // PRIORITY 3: Fallback to legacy fields
    const services: InvoiceServiceItem[] = [];
    
    // Internet service
    if (data.servicePlan || data.serviceDescription) {
      services.push({
        type: "Internet",
        name: data.servicePlan || "Internet",
        description: data.serviceDescription || "",
        quantity: 1,
        monthlyPrice: data.subtotal || 0,
        period: "/mois",
      });
    }
    
    // TV Bundle
    if (data.tvBundle) {
      services.push({
        type: "TV",
        name: data.tvBundle,
        description: "Forfait télévision",
        quantity: 1,
        monthlyPrice: 0,
        period: "/mois",
      });
    }
    
    // Mobile Plan
    if (data.mobilePlan) {
      services.push({
        type: "Mobile",
        name: data.mobilePlan,
        description: "Forfait mobile prépayé",
        quantity: 1,
        monthlyPrice: 0,
        period: "/30 jours",
      });
    }
    
    // Streaming
    if (data.streamingService) {
      services.push({
        type: "Streaming",
        name: data.streamingService,
        description: "Service de streaming",
        quantity: 1,
        monthlyPrice: 0,
        period: "/mois",
      });
    }
    
    // LAST RESORT: Generic service if subtotal exists but no services found
    if (services.length === 0 && data.subtotal > 0) {
      console.warn("[Invoice PDF] No specific services found, using generic. Consider passing orderLineItems.");
      services.push({
        type: "Internet",
        name: "Services Télécommunications",
        description: "",
        quantity: 1,
        monthlyPrice: data.subtotal,
        period: "/mois",
      });
    }
    
    return services;
  };

  const recurringServices = buildServicesList();

  // ========================================================================
  // USE SHARED BILLING CALCULATOR - Single source of truth
  // CRITICAL: Extract equipment/fees from orderLineItems when available
  // ========================================================================
  
  // Extract equipment and fees from orderLineItems if available
  const extractedEquipment: { name: string; quantity: number; unitPrice: number; serial?: string }[] = [];
  const extractedFees: { label: string; amount: number }[] = [];
  const extractedDiscounts: { label: string; amount: number; type: "promo" | "preauth" | "loyalty" | "multiLine" | "other" }[] = [];
  
  if (data.orderLineItems && Array.isArray(data.orderLineItems)) {
    for (const item of data.orderLineItems) {
      const unitPrice = typeof item.unit_price === "number" ? item.unit_price : 0;
      const qty = item.qty || 1;
      
      if (item.category === "equipment" && unitPrice > 0) {
        extractedEquipment.push({
          name: item.name || "Équipement",
          quantity: qty,
          unitPrice: unitPrice,
        });
      } else if (item.category === "fee" && unitPrice > 0) {
        extractedFees.push({
          label: item.name || "Frais",
          amount: unitPrice * qty,
        });
      } else if (item.category === "discount" && unitPrice > 0) {
        extractedDiscounts.push({
          label: item.name || "Rabais",
          amount: unitPrice * qty,
          type: "promo",
        });
      }
    }
  }
  
  // Use extracted values if available, otherwise fall back to legacy fields
  const hasExtractedLineItems = extractedEquipment.length > 0 || extractedFees.length > 0;
  
  const equipmentList = hasExtractedLineItems 
    ? extractedEquipment 
    : [
        ...(data.routerFee ? [{ name: "Routeur", quantity: 1, unitPrice: data.routerFee, serial: data.routerSerial }] : []),
        ...(data.terminalFee ? [{ name: "Terminal", quantity: data.terminalCount || 1, unitPrice: data.terminalFee / (data.terminalCount || 1) }] : []),
        ...(data.simFee ? [{ name: "SIM", quantity: 1, unitPrice: data.simFee }] : []),
      ];
  
  const feesList = hasExtractedLineItems
    ? extractedFees
    : [
        ...(data.deliveryFee ? [{ label: "Livraison", amount: data.deliveryFee }] : []),
        ...(data.activationFee ? [{ label: "Activation", amount: data.activationFee }] : []),
        ...(data.installationFee ? [{ label: "Installation", amount: data.installationFee }] : []),
        ...(data.fees ? [{ label: "Frais additionnels", amount: data.fees }] : []),
      ];
  
  const discountsList = extractedDiscounts.length > 0
    ? extractedDiscounts
    : [
        ...(data.discountAmount ? [{ label: data.promoCode || "Rabais", amount: data.discountAmount, type: "promo" as const }] : []),
        ...(data.preauthDiscount ? [{ label: "Rabais préautorisé", amount: data.preauthDiscount, type: "preauth" as const }] : []),
      ];
  
  // Calculate totals from extracted line items
  const equipmentFees = equipmentList.reduce((sum, e) => sum + (e.unitPrice * e.quantity), 0);
  const otherFees = feesList.reduce((sum, f) => sum + f.amount, 0);
  const oneTimeTotal = equipmentFees + otherFees;
  const totalDiscount = discountsList.reduce((sum, d) => sum + d.amount, 0);
  
  // Calculate using shared billing calculator
  const billingInput: BillingInput = {
    services: recurringServices.map(s => ({
      type: s.type,
      name: s.name,
      description: s.description || "",
      monthlyPrice: s.monthlyPrice,
      quantity: s.quantity || 1,
      isOneTime: false,
      priceLabel: s.period || "/mois",
    })),
    equipment: equipmentList,
    oneTimeFees: feesList,
    discounts: discountsList,
  };
  
  const calculatedBilling = calculateBillingTotals(billingInput);
  
  // Invariant check: log if there's a mismatch
  if (!calculatedBilling.isValid && calculatedBilling.validationError) {
    console.error("[Invoice PDF] Billing invariant violation:", calculatedBilling.validationError);
  }
  
  // Use calculated values OR provided values (for backward compatibility)
  const tpsAmount = data.tpsAmount ?? calculatedBilling.tps;
  const tvqAmount = data.tvqAmount ?? calculatedBilling.tvq;
  const lateFeeAmount = data.lateFeeAmount || 0;
  const credits = data.credits || 0;
  
  // Calculate total using invariant: taxable = recurring + oneTime - discounts
  const taxableSubtotal = calculatedBilling.taxableSubtotal;
  const total = taxableSubtotal + tpsAmount + tvqAmount + lateFeeAmount - credits;

  // ============ HEADER SECTION - Always Nivra's address ============
  doc.setFillColor(...navyColor);
  doc.rect(0, 0, pageWidth, 52, "F");

  // Top accent line
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 3, "F");

  // Company name
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text(businessInfo.name, pageWidth / 2, 18, { align: "center" });

  // Division
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...primaryColor);
  doc.text(businessInfo.division, pageWidth / 2, 26, { align: "center" });

  // Description
  doc.setFontSize(8);
  doc.setTextColor(180, 180, 180);
  doc.text(businessInfo.description, pageWidth / 2, 33, { align: "center" });

  // CRITICAL: Always use Nivra's official address, never client address
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text(`Head Office: ${businessInfo.address}`, pageWidth / 2, 40, { align: "center" });
  doc.text(`Support: ${businessInfo.email} | ${businessInfo.phone}`, pageWidth / 2, 46, { align: "center" });

  currentY = 60;

  // ============ INVOICE TITLE & STATUS ============
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...darkColor);
  doc.text("FACTURE / INVOICE", margin, currentY);

  // Status badge
  const statusConfig: Record<string, { color: [number, number, number]; label: string }> = {
    paid: { color: [34, 197, 94], label: "PAYÉ" },
    pending: { color: [234, 179, 8], label: "EN ATTENTE" },
    overdue: { color: [239, 68, 68], label: "EN RETARD" },
    cancelled: { color: [156, 163, 175], label: "ANNULÉ" },
  };

  const statusInfo = statusConfig[data.status] || statusConfig.pending;
  doc.setFillColor(...statusInfo.color);
  doc.roundedRect(pageWidth - margin - 55, currentY - 12, 55, 16, 2, 2, "F");
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.text(statusInfo.label, pageWidth - margin - 27.5, currentY - 2, { align: "center" });

  currentY += 12;

  // ============ IDENTIFIERS SECTION ============
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, currentY, contentWidth, 38, 2, 2, "F");
  doc.setDrawColor(...primaryColor);
  doc.setLineWidth(0.5);
  doc.line(margin, currentY, margin, currentY + 38);

  const col1 = margin + 8;
  const col2 = margin + 55;
  const col3 = margin + 110;
  const col4 = margin + 155;

  // Row 1
  doc.setFontSize(6);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...lightGray);
  doc.text("NO. FACTURE", col1, currentY + 7);
  doc.text("RÉF. COMMANDE", col2, currentY + 7);
  doc.text("RÉF. PAIEMENT", col3, currentY + 7);
  doc.text("NO. COMPTE", col4, currentY + 7);

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...darkColor);
  doc.text(data.invoiceNumber || "—", col1, currentY + 13);
  doc.text(data.orderNumber || "—", col2, currentY + 13);
  doc.setTextColor(...primaryColor);
  doc.text(data.paymentReference || "—", col3, currentY + 13);
  doc.setTextColor(...darkColor);
  doc.text(clientAccountNumber, col4, currentY + 13);

  // Row 2
  doc.setFontSize(6);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...lightGray);
  doc.text("DATE D'ÉMISSION", col1, currentY + 23);
  doc.text("DÉBUT CYCLE", col2, currentY + 23);
  doc.text("FIN CYCLE", col3, currentY + 23);
  if (data.dueDate) {
    doc.text("ÉCHÉANCE", col4, currentY + 23);
  }

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...darkColor);
  doc.text(format(new Date(data.createdAt), "yyyy-MM-dd"), col1, currentY + 29);
  doc.text(data.billingCycleStart ? format(new Date(data.billingCycleStart), "yyyy-MM-dd") : format(new Date(data.createdAt), "yyyy-MM-dd"), col2, currentY + 29);
  doc.text(data.billingCycleEnd ? format(new Date(data.billingCycleEnd), "yyyy-MM-dd") : "—", col3, currentY + 29);
  if (data.dueDate) {
    doc.setTextColor(data.status === "overdue" ? 239 : darkColor[0], data.status === "overdue" ? 68 : darkColor[1], data.status === "overdue" ? 68 : darkColor[2]);
    doc.text(format(new Date(data.dueDate), "yyyy-MM-dd"), col4, currentY + 29);
  }

  currentY += 45;

  // ============ CLIENT DETAILS SECTION ============
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...accentColor);
  doc.text("INFORMATIONS CLIENT", margin, currentY);

  currentY += 6;
  doc.setDrawColor(...primaryColor);
  doc.setLineWidth(0.3);
  doc.line(margin, currentY, margin + 80, currentY);

  currentY += 6;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...darkColor);
  doc.setFontSize(8);

  // Account number - always show
  doc.text(`Numéro de compte : ${clientAccountNumber}`, margin, currentY);
  currentY += 5;
  doc.text(`Nom : ${data.clientName}`, margin, currentY);
  currentY += 5;
  doc.text(`Courriel : ${data.clientEmail}`, margin, currentY);
  if (data.clientPhone) {
    currentY += 5;
    doc.text(`Téléphone : ${data.clientPhone}`, margin, currentY);
  }
  if (data.clientAddress || data.clientCity) {
    currentY += 5;
    const address = [data.clientAddress, data.clientCity, "Québec, Canada"].filter(Boolean).join(", ");
    doc.text(`Adresse de service : ${address}`, margin, currentY);
  }

  currentY += 12;

  // ============ SERVICES SOUSCRITS SECTION - Multi-service ============
  if (recurringServices.length > 0) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...accentColor);
    doc.text("SERVICES SOUSCRITS", margin, currentY);

    currentY += 6;
    doc.setDrawColor(...primaryColor);
    doc.line(margin, currentY, margin + 60, currentY);

    currentY += 8;

    // Table header
    doc.setFillColor(...navyColor);
    doc.rect(margin, currentY, contentWidth, 8, "F");

    doc.setFontSize(6);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text("TYPE", margin + 3, currentY + 5.5);
    doc.text("FORFAIT / SERVICE", margin + 28, currentY + 5.5);
    doc.text("QTÉ", margin + 105, currentY + 5.5);
    doc.text("PRIX", margin + 125, currentY + 5.5);
    doc.text("PÉRIODE", margin + 155, currentY + 5.5);

    currentY += 12;

    // Service rows - one line per service
    let rowIndex = 0;
    let recurringTotal = 0;
    
    for (const service of recurringServices) {
      // Alternating background
      if (rowIndex % 2 === 0) {
        doc.setFillColor(252, 252, 253);
        doc.rect(margin, currentY - 3, contentWidth, 7, "F");
      }

      // Type column
      doc.setTextColor(...grayColor);
      doc.setFontSize(6);
      doc.text(service.type.toUpperCase(), margin + 3, currentY);

      // Name + description
      doc.setTextColor(...darkColor);
      doc.setFontSize(7);
      const serviceName = service.description 
        ? `${service.name} — ${service.description}`.substring(0, 50) 
        : service.name.substring(0, 50);
      doc.text(sanitizeLegalText(serviceName), margin + 28, currentY);

      // Quantity
      doc.text(String(service.quantity || 1), margin + 108, currentY);

      // Price
      const linePrice = service.monthlyPrice * (service.quantity || 1);
      recurringTotal += linePrice;
      doc.text(`${linePrice.toFixed(2)} $`, margin + 125, currentY);

      // Period
      doc.setTextColor(...lightGray);
      doc.text(service.period || "/mois", margin + 155, currentY);

      currentY += 7;
      rowIndex++;
      
      checkPageBreak(10);
    }

    // Recurring services subtotal
    currentY += 2;
    doc.setDrawColor(...grayColor);
    doc.setLineWidth(0.2);
    doc.line(margin + 100, currentY, pageWidth - margin, currentY);
    currentY += 5;
    
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...darkColor);
    doc.text("Sous-total services récurrents :", margin + 80, currentY);
    doc.text(`${recurringTotal.toFixed(2)} $`, pageWidth - margin - 5, currentY, { align: "right" });
    
    currentY += 10;
  }

  // ============ ONE-TIME FEES (EQUIPMENT + FEES) ============
  if (oneTimeTotal > 0) {
    checkPageBreak(40);
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...accentColor);
    doc.text("FRAIS UNIQUES / ONE-TIME FEES", margin, currentY);

    currentY += 6;
    doc.setDrawColor(...primaryColor);
    doc.line(margin, currentY, margin + 70, currentY);

    currentY += 8;

    // Table header
    doc.setFillColor(...navyColor);
    doc.rect(margin, currentY, contentWidth, 8, "F");

    doc.setFontSize(6);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text("CATÉGORIE", margin + 3, currentY + 5.5);
    doc.text("DESCRIPTION", margin + 40, currentY + 5.5);
    doc.text("MONTANT (CAD)", pageWidth - margin - 5, currentY + 5.5, { align: "right" });

    currentY += 12;

    let feeRowIndex = 0;
    
    const addFeeRow = (category: string, description: string, amount: number, isCredit: boolean = false) => {
      if (amount === 0) return;
      
      if (feeRowIndex % 2 === 0) {
        doc.setFillColor(252, 252, 253);
        doc.rect(margin, currentY - 3, contentWidth, 7, "F");
      }
      
      doc.setTextColor(...grayColor);
      doc.setFontSize(6);
      doc.text(category.toUpperCase(), margin + 3, currentY);
      
      doc.setTextColor(...darkColor);
      doc.setFontSize(7);
      doc.text(sanitizeLegalText(description), margin + 40, currentY);
      
      doc.setTextColor(isCredit ? successColor[0] : darkColor[0], isCredit ? successColor[1] : darkColor[1], isCredit ? successColor[2] : darkColor[2]);
      doc.text(`${isCredit ? "-" : ""}${amount.toFixed(2)} $`, pageWidth - margin - 5, currentY, { align: "right" });
      doc.setTextColor(...darkColor);
      
      currentY += 7;
      feeRowIndex++;
    };

    // Render equipment from extracted or legacy data
    for (const eq of equipmentList) {
      const desc = eq.serial 
        ? `${eq.name} (S/N: ${eq.serial})`
        : `${eq.name} — Garantie 1 an`;
      addFeeRow("Équipement", desc, eq.unitPrice * eq.quantity);
    }

    // Render fees from extracted or legacy data
    for (const fee of feesList) {
      // Determine category from label
      const lowerLabel = fee.label.toLowerCase();
      let category = "Frais";
      if (lowerLabel.includes("livraison") || lowerLabel.includes("delivery")) category = "Livraison";
      else if (lowerLabel.includes("installation")) category = "Installation";
      else if (lowerLabel.includes("activation")) category = "Activation";
      
      addFeeRow(category, fee.label, fee.amount);
    }

    currentY += 5;
  }

  // ============ DISCOUNTS ============
  if (totalDiscount > 0) {
    checkPageBreak(20);
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...accentColor);
    doc.text("RABAIS / DISCOUNTS", margin, currentY);

    currentY += 6;
    doc.setDrawColor(...primaryColor);
    doc.line(margin, currentY, margin + 50, currentY);
    currentY += 6;

    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    
    // Render discounts from extracted or legacy data
    for (const discount of discountsList) {
      doc.setTextColor(...grayColor);
      doc.text(discount.label, margin, currentY);
      doc.setTextColor(...successColor);
      doc.text(`-${discount.amount.toFixed(2)} $`, pageWidth - margin - 5, currentY, { align: "right" });
      currentY += 5;
    }

    currentY += 5;
  }

  // ============ BILLING BREAKDOWN - Using shared calculator ============
  checkPageBreak(50);
  
  doc.setDrawColor(...grayColor);
  doc.setLineWidth(0.2);
  doc.line(margin, currentY, pageWidth - margin, currentY);

  currentY += 8;

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...accentColor);
  doc.text("SOMMAIRE DE FACTURATION", margin, currentY);
  currentY += 8;

  const addSummaryRow = (label: string, value: string, isBold: boolean = false, color?: [number, number, number]) => {
    doc.setFont("helvetica", isBold ? "bold" : "normal");
    doc.setTextColor(...(color || darkColor));
    doc.setFontSize(8);
    doc.text(label, margin + 80, currentY);
    doc.text(value, pageWidth - margin - 5, currentY, { align: "right" });
    currentY += 6;
  };

  // Show recurring services subtotal
  addSummaryRow("Sous-total services (récurrent)", `${calculatedBilling.recurringSubtotal.toFixed(2)} $`);
  
  // Show one-time charges
  if (calculatedBilling.oneTimeSubtotal > 0) {
    addSummaryRow("Frais uniques (équipement + frais)", `${calculatedBilling.oneTimeSubtotal.toFixed(2)} $`);
  }
  
  // Show discounts
  if (calculatedBilling.discountTotal > 0) {
    addSummaryRow("Rabais appliqués", `-${calculatedBilling.discountTotal.toFixed(2)} $`, false, successColor);
  }
  
  // CRITICAL: Show taxable subtotal (invariant)
  addSummaryRow("Sous-total taxable", `${taxableSubtotal.toFixed(2)} $`, true);
  
  // Taxes calculated on taxable subtotal
  addSummaryRow(`TPS (5% de ${taxableSubtotal.toFixed(2)} $)`, `${tpsAmount.toFixed(2)} $`);
  addSummaryRow(`TVQ (9.975% de ${taxableSubtotal.toFixed(2)} $)`, `${tvqAmount.toFixed(2)} $`);

  if (lateFeeAmount > 0) {
    addSummaryRow("Frais de retard (5%)", `${lateFeeAmount.toFixed(2)} $`, false, [239, 68, 68]);
  }

  if (credits > 0) {
    addSummaryRow("Crédits appliqués", `-${credits.toFixed(2)} $`, false, successColor);
  }

  currentY += 3;

  // Total box
  doc.setFillColor(...navyColor);
  doc.roundedRect(margin + 90, currentY, contentWidth - 90, 12, 2, 2, "F");

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("TOTAL", margin + 100, currentY + 8);
  doc.setTextColor(...primaryColor);
  doc.text(`${total.toFixed(2)} $ CAD`, pageWidth - margin - 8, currentY + 8, { align: "right" });

  currentY += 20;

  // ============ TOTAL MENSUEL ESTIMÉ - WITH TAXES INCLUDED ============
  if (recurringServices.length > 0) {
    const monthlyEstimate = recurringServices.reduce((sum, s) => sum + (s.monthlyPrice * (s.quantity || 1)), 0);
    
    if (monthlyEstimate > 0) {
      // Calculate monthly taxes
      const monthlyTps = Math.round(monthlyEstimate * TAX_RATES.TPS * 100) / 100;
      const monthlyTvq = Math.round(monthlyEstimate * TAX_RATES.TVQ * 100) / 100;
      const monthlyTaxesTotal = monthlyTps + monthlyTvq;
      const monthlyWithTaxes = monthlyEstimate + monthlyTaxesTotal;
      
      checkPageBreak(55);
      
      // Increased box height for tax breakdown
      const baseHeight = 28;
      const serviceLineHeight = 4;
      const taxLinesHeight = 18;
      const boxHeight = baseHeight + (recurringServices.length * serviceLineHeight) + taxLinesHeight;
      
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(...accentColor);
      doc.setLineWidth(1);
      doc.roundedRect(margin, currentY, contentWidth, boxHeight, 2, 2, "FD");
      
      // Left accent bar
      doc.setFillColor(...accentColor);
      doc.rect(margin, currentY, 4, boxHeight, "F");
      
      // Header
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...darkColor);
      doc.text("TOTAL MENSUEL ESTIMÉ", margin + 10, currentY + 8);
      
      // Per-service breakdown
      let lineY = currentY + 14;
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...grayColor);
      
      for (const service of recurringServices) {
        const linePrice = service.monthlyPrice * (service.quantity || 1);
        if (linePrice > 0) {
          doc.text(`- ${service.name.substring(0, 40)}`, margin + 10, lineY);
          doc.text(`${linePrice.toFixed(2)} $${service.period || "/mois"}`, margin + contentWidth - 50, lineY, { align: "right" });
          lineY += serviceLineHeight;
        }
      }
      
      lineY += 3;
      
      // (a) Monthly recurring subtotal before taxes
      doc.setFontSize(7);
      doc.setTextColor(...grayColor);
      doc.text("Sous-total récurrent (avant taxes)", margin + 10, lineY);
      doc.setFont("helvetica", "bold");
      doc.text(`${monthlyEstimate.toFixed(2)} $`, margin + contentWidth - 50, lineY, { align: "right" });
      lineY += 5;
      
      // (b) Estimated monthly TPS+TVQ
      doc.setFont("helvetica", "normal");
      doc.text("TPS (5%) + TVQ (9.975%) estimées", margin + 10, lineY);
      doc.text(`${monthlyTaxesTotal.toFixed(2)} $`, margin + contentWidth - 50, lineY, { align: "right" });
      lineY += 5;
      
      // (c) Total monthly estimate taxes included - prominent display
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...primaryColor);
      doc.text(`~${monthlyWithTaxes.toFixed(2)} $/mois`, pageWidth - margin - 10, currentY + 10, { align: "right" });
      
      // Subtitle
      doc.setFontSize(6);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...lightGray);
      doc.text("(taxes incluses, services récurrents)", margin + 10, currentY + boxHeight - 3);
      
      currentY += boxHeight + 8;
    }
  }

  // ============ PAYMENT STATUS ============
  checkPageBreak(30);
  
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...accentColor);
  doc.text("STATUT DE PAIEMENT", margin, currentY);

  currentY += 6;
  doc.setDrawColor(...primaryColor);
  doc.line(margin, currentY, margin + 50, currentY);

  currentY += 6;
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...darkColor);

  doc.text(`Statut : ${statusInfo.label}`, margin, currentY);
  if (data.paidAt) {
    doc.text(`Traité le : ${format(new Date(data.paidAt), "yyyy-MM-dd HH:mm")}`, margin + 50, currentY);
  }
  currentY += 5;
  doc.text(`Solde client : ${total.toFixed(2)} $ CAD`, margin, currentY);

  currentY += 10;

  // Payment method box
  const isCreditCardPayment = data.paymentMethod === "credit_card" || 
    (data.cardLast4 && data.cardLast4.length === 4) ||
    (data.paymentReference?.toLowerCase().includes("card"));
  
  if (isCreditCardPayment) {
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, currentY, contentWidth, 18, 2, 2, "F");
    doc.setDrawColor(...primaryColor);
    doc.setLineWidth(0.3);
    doc.line(margin, currentY, margin, currentY + 18);

    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...darkColor);
    doc.text("Mode de paiement", margin + 6, currentY + 7);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...grayColor);
    
    let cardDisplay = "Carte de crédit";
    if (data.cardType && data.cardLast4) {
      cardDisplay = `${data.cardType} •••• ${data.cardLast4}`;
    } else if (data.cardLast4) {
      cardDisplay = `Carte •••• ${data.cardLast4}`;
    }
    
    doc.text(`Payé via : ${cardDisplay}`, margin + 6, currentY + 13);
    currentY += 24;
  } else {
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, currentY, contentWidth, 22, 2, 2, "F");
    doc.setDrawColor(...primaryColor);
    doc.setLineWidth(0.3);
    doc.line(margin, currentY, margin, currentY + 22);

    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...darkColor);
    doc.text("Instructions de paiement — Virement Interac", margin + 6, currentY + 7);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text("Courriel:", margin + 6, currentY + 14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...primaryColor);
    doc.text(ETRANSFER_CONFIG.emailDisplay, margin + 25, currentY + 14);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(...darkColor);
    doc.text(`Question/Réponse sécurité : ${ETRANSFER_CONFIG.securityQuestion} / ${data.invoiceNumber}`, margin + 6, currentY + 19);

    currentY += 28;
  }

  // ============ PREPAID BILLING POLICY ============
  // IMPROVED: Increased font size from 5.5-6 to 9.5-10 for readability
  checkPageBreak(50);
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...darkColor);
  doc.text("POLITIQUE DE FACTURATION PRÉPAYÉE", margin, currentY);
  currentY += 8;
  
  const policyTexts = [
    "Les services sont facturés à l'avance. Le paiement doit être confirmé AVANT la date de cycle (J0) pour renouveler le service.",
    "Si non payé à J0, le service n'est pas renouvelé (Expiré). Aucun intérêt ni frais de réactivation pour non-renouvellement normal.",
    "Après 90 jours sans renouvellement, le numéro de téléphone peut devenir irrécupérable (nouveau numéro requis).",
    "Intérêt (5%/mois) + 15$ frais de réactivation s'appliquent UNIQUEMENT pour litiges bancaires/rétrofacturations."
  ];
  
  doc.setFont("helvetica", "normal");
  for (let i = 0; i < policyTexts.length; i++) {
    const text = sanitizeLegalText(policyTexts[i]);
    // Larger font (9.5pt) with better line-height (5pt)
    const textColor: [number, number, number] = i === 3 ? [180, 80, 80] : grayColor;
    doc.setFontSize(9.5);
    doc.setTextColor(...textColor);
    
    // Use splitTextToSize for proper wrapping with page-break handling
    const lines = doc.splitTextToSize(text, contentWidth);
    const lineHeight = 5;
    const neededHeight = lines.length * lineHeight;
    
    if (checkPageBreak(neededHeight + 2)) {
      doc.addPage();
      currentY = topMargin;
    }
    
    for (const line of lines) {
      doc.text(line, margin, currentY);
      currentY += lineHeight;
    }
    currentY += 2; // Spacing between paragraphs
  }

  currentY += 6;

  // ============ NOTES ============
  // IMPROVED: Render as bullet list with structured fields, then long paragraph separately
  if (data.notes || data.orderNumber || data.paymentReference) {
    checkPageBreak(30);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...darkColor);
    doc.text("NOTES:", margin, currentY);
    currentY += 8;
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...grayColor);
    
    // Structured bullet list for key fields
    const bulletItems: string[] = [];
    
    if (data.orderNumber) {
      bulletItems.push(`Numéro de commande: ${data.orderNumber}`);
    }
    if (data.paymentReference) {
      bulletItems.push(`Référence paiement: ${data.paymentReference}`);
    }
    
    // Extract services summary from recurringServices
    if (recurringServices.length > 0) {
      const serviceNames = recurringServices.map(s => s.name).join(", ");
      bulletItems.push(`Services: ${serviceNames}`);
    }
    
    if (data.deliveryMethod) {
      const deliveryLabels: Record<string, string> = {
        pickup: "Ramassage sur place",
        delivery: "Livraison à domicile",
        installation: "Installation professionnelle",
      };
      bulletItems.push(`Livraison: ${deliveryLabels[data.deliveryMethod] || data.deliveryMethod}`);
    }
    
    if (data.promoCode) {
      const promoText = data.promoDescription 
        ? `${data.promoCode} — ${data.promoDescription}`
        : data.promoCode;
      bulletItems.push(`Code promo/Rabais: ${promoText}`);
    }
    
    // Render bullet list
    for (const item of bulletItems) {
      if (checkPageBreak(6)) {
        doc.addPage();
        currentY = topMargin;
      }
      doc.text(`• ${item}`, margin + 4, currentY);
      currentY += 6;
    }
    
    // Render long informational paragraph separately (from data.notes)
    if (data.notes) {
      currentY += 4;
      const sanitizedNotes = sanitizeLegalText(data.notes);
      const noteLines = doc.splitTextToSize(sanitizedNotes, contentWidth);
      const noteLineHeight = 5;
      
      for (const line of noteLines) {
        if (checkPageBreak(noteLineHeight + 2)) {
          doc.addPage();
          currentY = topMargin;
        }
        doc.text(line, margin, currentY);
        currentY += noteLineHeight;
      }
    }
    
    currentY += 6;
  }

  // ============ DISCLAIMER ============
  checkPageBreak(15);
  currentY += 5;
  
  const disclaimerTexts = [
    "Les délais d'exécution et d'activation s'appliquent selon la catégorie de commande. La garantie d'équipement est basée sur le fabricant pour 12 mois à partir de l'activation.",
    "Perte, vol ou dommages causés par le client sont exclus sauf approbation interne par l'administrateur. Tous les enregistrements de factures, références de paiement et attributions d'équipement sont stockés dans les systèmes internes Nivra et ne sont pas partagés à l'externe."
  ];
  
  for (const disclaimer of disclaimerTexts) {
    addWrappedText(disclaimer, margin, contentWidth, 3.5, 5.5, lightGray);
    currentY += 2;
  }

  // Signature line
  if (data.issuedBy || data.issuedByRole) {
    currentY += 4;
    checkPageBreak(10);
    doc.setFontSize(6);
    doc.setTextColor(...grayColor);
    doc.text("Émis par: ___________________________", margin, currentY);
    doc.text(`Rôle: ${data.issuedByRole || "Admin/Employé"}`, margin + 60, currentY);
    doc.text(`Horodatage: ${data.issuedAt || format(new Date(), "yyyy-MM-dd HH:mm")}`, margin + 110, currentY);
    currentY += 8;
  }

  // ============ FOOTER ON ALL PAGES ============
  const totalPages = doc.getNumberOfPages();
  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    doc.setPage(pageNum);
    
    const footerY = pageHeight - 18;
    
    // Footer divider
    doc.setDrawColor(...primaryColor);
    doc.setLineWidth(0.5);
    doc.line(margin, footerY, pageWidth - margin, footerY);
    
    // Bottom accent bar
    doc.setFillColor(...primaryColor);
    doc.rect(0, pageHeight - 4, pageWidth, 4, "F");

    // Business footer text - ALWAYS Nivra's address
    doc.setFontSize(6);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...grayColor);
    doc.text(`${businessInfo.name} | NEQ: ${businessInfo.neq} | ${businessInfo.address}`, pageWidth / 2, footerY + 8, { align: "center" });
    
    // Page number
    doc.setFontSize(5);
    doc.text(`Page ${pageNum} de ${totalPages}`, pageWidth - margin, footerY + 8, { align: "right" });
  }

  return doc;
};

import { safePDFDownload, safePDFOpen } from "./pdfUtils";

export const downloadInvoicePDF = (data: InvoiceData): void => {
  try {
    const doc = generateInvoicePDF(data);
    const blob = doc.output("blob");
    const filename = `Facture_${data.invoiceNumber}_${data.clientName.replace(/\s+/g, "_")}.pdf`;
    safePDFDownload(blob, filename);
  } catch (error) {
    console.error("Error generating invoice PDF:", error);
    throw new Error("Failed to generate invoice PDF");
  }
};

export const viewInvoicePDF = (data: InvoiceData): void => {
  try {
    const doc = generateInvoicePDF(data);
    const blob = doc.output("blob");
    const filename = `Facture_${data.invoiceNumber}.pdf`;
    safePDFOpen(blob, filename);
  } catch (error) {
    console.error("Error viewing invoice PDF:", error);
    throw new Error("Failed to open invoice PDF");
  }
};

export const getInvoicePDFBlob = (data: InvoiceData): Blob => {
  try {
    const doc = generateInvoicePDF(data);
    return doc.output("blob");
  } catch (error) {
    console.error("Error creating invoice PDF blob:", error);
    throw new Error("Failed to create invoice PDF");
  }
};
