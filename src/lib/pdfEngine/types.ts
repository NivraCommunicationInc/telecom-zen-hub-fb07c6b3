/**
 * Nivra Document Engine - Types
 * Single source of truth for all PDF document generation
 */

// ============= SERVICE TYPES =============

export interface ServiceLineItem {
  type: "Mobile" | "Internet" | "TV" | "Streaming" | "Security" | "Other";
  name: string;
  description?: string;
  monthlyPrice: number;
  quantity?: number;
  /** e.g. "/mois", "/30 jours", "Frais unique" */
  priceLabel?: string;
  /** Is this a one-time charge or recurring */
  isOneTime?: boolean;
}

export interface TVChannelsSummary {
  baseChannels: number;
  optionalChannels: number;
  premiumChannels: number;
  premiumTotal?: number;
}

export interface EquipmentItem {
  name: string;
  quantity: number;
  unitPrice: number;
  serial?: string;
  warranty?: string;
}

export interface OneTimeFee {
  label: string;
  amount: number;
  description?: string;
}

export interface DiscountItem {
  label: string;
  amount: number;
  promoCode?: string;
  /** Discount type for categorization */
  type?: "promo" | "preauth" | "loyalty" | "multiLine" | "other";
}

// ============= CLIENT & COMPANY INFO =============

export interface ClientInfo {
  fullName: string;
  email: string;
  phone?: string;
  accountNumber?: string;
  billingAddress?: string;
  serviceAddress?: string;
  serviceCity?: string;
  serviceProvince?: string;
  servicePostalCode?: string;
}

export interface CompanyInfo {
  name: string;
  legalName: string;
  address: string;
  email: string;
  phone: string;
}

export interface AgentInfo {
  name: string;
  email?: string;
  role?: string;
}

// ============= BILLING & PAYMENT =============

export interface BillingSummary {
  subtotal: number;
  discountTotal: number;
  oneTimeTotal: number;
  tps: number;
  tvq: number;
  total: number;
  amountPaid?: number;
  balance?: number;
}

export interface PaymentInfo {
  method?: "credit_card" | "etransfer" | "cash" | "other";
  status: "pending" | "paid" | "overdue" | "cancelled";
  reference?: string;
  paidAt?: string;
  dueDate?: string;
}

// ============= DOCUMENT DATA =============

export interface DocumentMetadata {
  documentNumber: string;
  orderNumber?: string;
  date: string;
  effectiveDate?: string;
  version?: string;
}

/**
 * Unified document data structure for all PDF types
 */
export interface UnifiedDocumentData {
  // Document type
  docType: "contract" | "invoice" | "estimate";
  
  // Metadata
  metadata: DocumentMetadata;
  
  // Parties
  client: ClientInfo;
  company: CompanyInfo;
  agent?: AgentInfo;
  
  // Services (dynamic - only selected items appear)
  services: ServiceLineItem[];
  tvSummary?: TVChannelsSummary;
  
  // Equipment & Fees
  equipment: EquipmentItem[];
  oneTimeFees: OneTimeFee[];
  discounts: DiscountItem[];
  
  // Billing
  billing: BillingSummary;
  payment: PaymentInfo;
  
  // Contract-specific
  isSigned?: boolean;
  signedAt?: string;
  signatureMethod?: "electronic" | "manual";
  
  // Notes
  notes?: string;
  internalNotes?: string;
}

// ============= PDF LAYOUT CONSTANTS =============

export const PDF_LAYOUT = {
  pageWidth: 210, // A4 mm
  pageHeight: 297,
  marginLeft: 18,
  marginRight: 18,
  marginTop: 18,
  marginBottom: 22,
  contentWidth: 174, // 210 - 18 - 18
  
  // Typography
  fontSize: {
    title: 16,
    sectionTitle: 10,
    body: 8,
    small: 7,
    tiny: 6,
  },
  
  // Spacing
  lineHeight: {
    normal: 4.5,
    compact: 3.5,
    relaxed: 6,
  },
  
  // Colors (RGB tuples)
  colors: {
    primary: [15, 23, 42] as [number, number, number],     // Navy
    accent: [20, 184, 166] as [number, number, number],    // Teal
    text: [30, 41, 59] as [number, number, number],        // Dark gray
    muted: [100, 116, 139] as [number, number, number],    // Muted gray
    border: [203, 213, 225] as [number, number, number],   // Light border
    background: [248, 250, 252] as [number, number, number], // Light bg
    white: [255, 255, 255] as [number, number, number],
    success: [34, 197, 94] as [number, number, number],    // Green
    warning: [234, 179, 8] as [number, number, number],    // Yellow
    error: [239, 68, 68] as [number, number, number],      // Red
  },
} as const;

export type ColorKey = keyof typeof PDF_LAYOUT.colors;
