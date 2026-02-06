/**
 * Nivra PDF Templates - Shared Types
 * Types used by Invoice Monthly, Invoice One-Time, and Order Summary templates
 */

// ============================================================================
// INVOICE LINE ITEMS
// ============================================================================

export interface InvoiceLine {
  service_type: "Internet" | "TV" | "Mobile" | "Security" | "Streaming" | string;
  service_description: string;
  service_period: string; // e.g., "01/02/2026 - 01/03/2026"
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
// INVOICE COMMON FIELDS
// ============================================================================

export interface InvoiceBaseFields {
  account_number: string;
  invoice_number: string;
  invoice_date: string;
  bill_cycle_date: number; // Day of month (1-28)
  cycle_start: string;
  cycle_end: string;
  status: "pending" | "paid" | "overdue" | "cancelled";
  subtotal_before_discounts: number;
  total_discounts: number;
  subtotal_after_discounts: number;
  tax_gst: number; // TPS 5%
  tax_qst: number; // TVQ 9.975%
  total_due: number;
  payment_reference?: string | null;
}

// ============================================================================
// INVOICE MONTHLY DATA
// ============================================================================

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

// ============================================================================
// INVOICE ONE-TIME DATA
// ============================================================================

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

// ============================================================================
// ORDER SUMMARY DATA
// ============================================================================

export interface OrderSummaryData {
  order_number: string;
  order_date: string;
  account_number: string;
  
  // Client info
  client_name: string;
  client_email: string;
  client_phone?: string;
  service_address: string;
  billing_address?: string;
  
  // Services subscribed
  services: InvoiceLine[];
  
  // Equipment and one-time fees
  items: OneTimeItem[];
  
  // Totals
  subtotal_services: number;
  subtotal_equipment: number;
  total_discounts: number;
  subtotal_before_tax: number;
  tax_gst: number;
  tax_qst: number;
  total_due: number;
  
  // Payment
  payment_status: "pending" | "paid" | "processing";
  payment_method?: string | null;
  payment_reference?: string | null;
  paid_at?: string | null;
  
  // Promo
  promo_code?: string | null;
  promo_description?: string | null;
  
  // Dates
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
// COMPANY HEADER INFO
// ============================================================================

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
// LEGAL FOOTER - PREPAID MODEL
// ============================================================================

export const PREPAID_LEGAL_FOOTER = `
AVIS LÉGAL — SERVICE PRÉPAYÉ SANS CONTRAT

Ce document constitue une facture pour des services de télécommunications prépayés fournis par Nivra Communications Inc. 
Aucun engagement contractuel minimum n'est requis. Le service est renouvelé mensuellement sur paiement préalable.

• Les montants affichés sont en dollars canadiens (CAD) et incluent les taxes applicables (TPS 5%, TVQ 9.975%).
• Le paiement doit être reçu avant la date d'échéance pour maintenir le service actif.
• En cas de non-paiement à l'échéance, le service sera suspendu sans préavis additionnel.
• Des frais de retard de 5% peuvent s'appliquer aux montants impayés après 48 heures.
• Pour toute question, contactez Support@nivra-telecom.ca

Nivra Communications Inc. — NEQ 2291249786 — Province de Québec, Canada
`.trim();
