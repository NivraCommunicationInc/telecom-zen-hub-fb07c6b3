/**
 * Nivra PDF Templates - Standardized Data Contract V2.4
 * 
 * All placeholders follow the exact naming convention defined in billing_v2.md
 * Number formats: No identifier starts with 0 or 1 (always 2-9)
 */

// ============================================================================
// COMPANY HEADER (A. En-tête entreprise)
// ============================================================================

export interface CompanyInfo {
  company_legal_name: string;
  company_department: string;
  company_tagline: string;
  company_address: string;
  company_support: string;
  company_phone: string;
  company_website: string;
  company_neq: string;
  company_tps: string;
  company_tvq: string;
}

export const NIVRA_COMPANY: CompanyInfo = {
  company_legal_name: "NIVRA COMMUNICATIONS INC.",
  company_department: "Service à la clientèle — Division facturation",
  company_tagline: "Fournisseur de services de télécommunications — Province de Québec",
  company_address: "Siège social : 1799 Av. Pierre-Péladeau, Laval, QC H7T 2Y5",
  company_support: "Support : Support@nivra-telecom.ca",
  company_phone: "438-544-2233",
  company_website: "www.nivra-telecom.ca",
  company_neq: "2291249786",
  company_tps: "TPS : 732287291 RT0001",
  company_tvq: "TVQ : 1229249786 TQ0001",
};

// Legacy alias for backward compatibility
export interface CompanyHeaderInfo {
  name: string;
  division: string;
  province: string;
  address: string;
  email: string;
  neq?: string;
}

export const NIVRA_HEADER: CompanyHeaderInfo = {
  name: "NIVRA COMMUNICATIONS INC.",
  division: "Billing Division",
  province: "Québec",
  address: "1799 Av. Pierre-Péladeau, Laval, QC H7T 2Y5",
  email: "Support@nivra-telecom.ca",
  neq: "2291249786",
};

// ============================================================================
// CUSTOMER (C. Client)
// ============================================================================

export interface Customer {
  full_name: string;
  email: string;
  phone?: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  province: string;
  postal_code: string;
}

// ============================================================================
// INVOICE LINE ITEMS (D. Lignes de facturation)
// ============================================================================

export type ItemCategory = "Internet" | "Mobile" | "TV" | "Equipment" | "Fees" | "Security" | "Streaming" | "Other";

export interface InvoiceItem {
  category: ItemCategory;
  description: string;
  period?: string; // e.g., "2026-02-06 → 2026-03-07" or empty for one-time
  qty: number;
  unit_price: number;
  amount: number; // qty * unit_price
  is_recurring?: boolean;
  service_address?: string;
  reference?: string; // SIM/IMEI/Serial/Line
}

// Legacy line format for backward compatibility
export interface InvoiceLine {
  service_type: "Internet" | "TV" | "Mobile" | "Security" | "Streaming" | string;
  service_description: string;
  service_period: string;
  service_price: number;
  service_promo?: string | null;
  service_total: number;
}

export interface OneTimeItem {
  item_name: string;
  item_description?: string;
  qty: number;
  unit_price: number;
  line_total: number;
  serial_number?: string | null;
}

// ============================================================================
// DISCOUNTS (E. Promotions / rabais)
// ============================================================================

export interface Discount {
  label: string; // e.g., "Promo -$5/mois (3 mois)"
  amount: number; // Positive value, displayed as negative
  applies_to?: string;
}

// ============================================================================
// TAXES (F. Taxes)
// ============================================================================

export interface Taxes {
  gst_rate: number; // 0.05
  gst_amount: number;
  qst_rate: number; // 0.09975
  qst_amount: number;
}

// ============================================================================
// PAYMENT (G. Paiement)
// ============================================================================

export type PaymentMethod = "PayPal" | "Interac" | "Credit Card" | "Manual" | "paypal" | "interac" | "card" | "cash" | "e_transfer" | string;
export type PaymentStatus = "Captured" | "Confirmed" | "Pending" | "Failed" | "Refunded" | "captured" | "confirmed" | "pending" | "failed" | "refunded";

export interface Payment {
  method: PaymentMethod;
  status: PaymentStatus;
  paid_amount: number;
  paid_at?: string;
  payment_reference: string; // 8 digits internal
  processor_txn_id?: string; // PayPal id / Stripe id etc.
}

// ============================================================================
// INVOICE IDENTITY (B. Facture identité)
// ============================================================================

export type InvoiceType = "MONTHLY" | "ONETIME";
export type InvoiceStatus = "Issued" | "Paid" | "Pending" | "Cancelled" | "Expired" | "pending" | "paid" | "overdue" | "cancelled";

export interface InvoiceIdentity {
  invoice_type: InvoiceType;
  invoice_number: string; // 7 digits (2-9xxxxxx)
  invoice_date: string; // YYYY-MM-DD
  due_date: string; // YYYY-MM-DD
  account_number: string; // 6 digits (2-9xxxxx)
  billing_period_start?: string; // For monthly
  billing_period_end?: string; // For monthly
  currency: string; // "CAD"
  status: InvoiceStatus;
}

// ============================================================================
// FULL INVOICE DATA (Standardized V2.4)
// ============================================================================

export interface InvoiceDataV2 extends InvoiceIdentity {
  // Company (auto-filled from NIVRA_COMPANY)
  company?: CompanyInfo;
  
  // Customer
  customer: Customer;
  
  // Line items
  items: InvoiceItem[];
  
  // Discounts
  discounts?: Discount[];
  
  // Totals
  subtotal: number;
  taxes: Taxes;
  total: number;
  balance_due: number;
  
  // Payments
  payments?: Payment[];
  payments_total?: number; // Sum of confirmed/captured payments
  
  // Payment instructions (optional custom)
  payment_instructions?: string;
}

// ============================================================================
// LEGACY FORMATS (Backward Compatibility)
// ============================================================================

export interface InvoiceBaseFields {
  account_number: string;
  invoice_number: string;
  invoice_date: string;
  bill_cycle_date: number;
  cycle_start: string;
  cycle_end: string;
  status: "pending" | "paid" | "overdue" | "cancelled";
  subtotal_before_discounts: number;
  total_discounts: number;
  subtotal_after_discounts: number;
  tax_gst: number;
  tax_qst: number;
  total_due: number;
  payment_reference?: string | null;
}

export interface InvoiceMonthlyData extends InvoiceBaseFields {
  client_name: string;
  client_email: string;
  client_phone?: string;
  client_address: string;
  invoice_lines: InvoiceLine[];
  paid_at?: string | null;
  payment_method?: string | null;
  notes?: string | null;
}

export interface InvoiceOneTimeData extends InvoiceBaseFields {
  client_name: string;
  client_email: string;
  client_phone?: string;
  client_address: string;
  items: OneTimeItem[];
  order_number?: string;
  paid_at?: string | null;
  payment_method?: string | null;
  notes?: string | null;
}

export interface OrderSummaryData {
  order_number: string;
  order_date: string;
  account_number: string;
  client_name: string;
  client_email: string;
  client_phone?: string;
  service_address: string;
  billing_address?: string;
  services: InvoiceLine[];
  items: OneTimeItem[];
  subtotal_services: number;
  subtotal_equipment: number;
  total_discounts: number;
  subtotal_before_tax: number;
  tax_gst: number;
  tax_qst: number;
  total_due: number;
  payment_status: "pending" | "paid" | "processing";
  payment_method?: string | null;
  payment_reference?: string | null;
  paid_at?: string | null;
  promo_code?: string | null;
  promo_description?: string | null;
  estimated_activation?: string | null;
  first_billing_date?: string | null;
}

// ============================================================================
// PDF GENERATION RESULT
// ============================================================================

export interface PDFGenerationResult {
  success: boolean;
  blob?: Blob;
  filename?: string;
  error?: string;
}

// ============================================================================
// LEGAL FOOTER - PREPAID MODEL
// ============================================================================

export const PREPAID_LEGAL_FOOTER = `
POLITIQUE DE FACTURATION PRÉPAYÉE

Le cycle de facturation commence uniquement à la date de confirmation du paiement (Interac/PayPal/Carte). Les services sont facturés à l'avance.
Le paiement doit être confirmé AVANT la date de cycle (J0) pour renouveler le service. Si non payé à J0, le service n'est pas renouvelé (Expiré).
Aucun intérêt ni frais de réactivation pour non-renouvellement normal. Après 90 jours sans renouvellement, le numéro de téléphone peut devenir irrécupérable (nouveau numéro requis).
Intérêt (5%/mois) + 15$ frais de réactivation s'appliquent UNIQUEMENT pour litiges bancaires/rétrofacturations. Les délais d'exécution et d'activation s'appliquent selon la catégorie de commande.
Garantie équipement: 12 mois fabricant dès activation. Perte/vol/dommages client exclus sauf approbation interne. Les enregistrements de factures, références de paiement et attributions d'équipement
sont stockés dans les systèmes internes Nivra et ne sont pas partagés à l'externe.
`.trim();

// ============================================================================
// HELPER: Convert legacy format to V2.4
// ============================================================================

export function convertToV2Invoice(
  legacy: InvoiceMonthlyData | InvoiceOneTimeData,
  invoiceType: InvoiceType
): InvoiceDataV2 {
  const isMonthly = invoiceType === "MONTHLY";
  const items: InvoiceItem[] = [];
  
  if (isMonthly && "invoice_lines" in legacy) {
    legacy.invoice_lines.forEach(line => {
      items.push({
        category: line.service_type as ItemCategory,
        description: line.service_description,
        period: line.service_period,
        qty: 1,
        unit_price: line.service_price,
        amount: line.service_total,
        is_recurring: true,
      });
    });
  } else if ("items" in legacy) {
    legacy.items.forEach(item => {
      items.push({
        category: "Equipment",
        description: item.item_name + (item.item_description ? ` - ${item.item_description}` : ""),
        qty: item.qty,
        unit_price: item.unit_price,
        amount: item.line_total,
        is_recurring: false,
        reference: item.serial_number || undefined,
      });
    });
  }
  
  // Parse address
  const addressParts = legacy.client_address.split(",").map(s => s.trim());
  
  return {
    invoice_type: invoiceType,
    invoice_number: legacy.invoice_number,
    invoice_date: legacy.invoice_date,
    due_date: legacy.cycle_end,
    account_number: legacy.account_number,
    billing_period_start: isMonthly ? legacy.cycle_start : undefined,
    billing_period_end: isMonthly ? legacy.cycle_end : undefined,
    currency: "CAD",
    status: legacy.status === "paid" ? "Paid" : legacy.status === "overdue" ? "Expired" : "Pending",
    
    customer: {
      full_name: legacy.client_name,
      email: legacy.client_email,
      phone: legacy.client_phone,
      address_line1: addressParts[0] || "",
      city: addressParts[1] || "",
      province: addressParts[2]?.split(" ")[0] || "QC",
      postal_code: addressParts[2]?.split(" ").slice(1).join(" ") || "",
    },
    
    items,
    
    discounts: legacy.total_discounts > 0 ? [{
      label: "Rabais appliqué",
      amount: legacy.total_discounts,
    }] : [],
    
    subtotal: legacy.subtotal_before_discounts,
    taxes: {
      gst_rate: 0.05,
      gst_amount: legacy.tax_gst,
      qst_rate: 0.09975,
      qst_amount: legacy.tax_qst,
    },
    total: legacy.total_due,
    balance_due: legacy.total_due, // Will be recalculated if payments exist
    
    payments: legacy.paid_at ? [{
      method: legacy.payment_method || "Interac",
      status: "Confirmed",
      paid_amount: legacy.total_due,
      paid_at: legacy.paid_at,
      payment_reference: legacy.payment_reference || "",
    }] : [],
    payments_total: legacy.paid_at ? legacy.total_due : 0,
  };
}
