/**
 * Billing System V2 - TypeScript Types
 * Auto-generated from database schema
 */

// Enums
export type BillingCustomerStatus = 'active' | 'suspended' | 'closed';
export type BillingSubscriptionStatus = 'active' | 'pending' | 'suspended' | 'cancelled';
export type BillingInvoiceType = 'initial' | 'renewal' | 'adjustment' | 'credit';
export type BillingInvoiceStatus = 'draft' | 'pending' | 'partially_paid' | 'paid' | 'paid_by_promo' | 'failed' | 'cancelled' | 'refunded' | 'overdue' | 'void' | 'not_renewed';
export type BillingPaymentMethod = 'interac' | 'manual' | 'paypal';
export type BillingPaymentStatus = 'pending' | 'confirmed' | 'failed';

// Tables
export interface BillingCustomer {
  id: string;
  user_id: string | null;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  status: BillingCustomerStatus;
  created_at: string;
  updated_at: string;
}

export interface BillingSubscription {
  id: string;
  customer_id: string;
  plan_code: string;
  plan_name: string;
  plan_price: number;
  cycle_start_date: string;
  cycle_end_date: string;
  status: BillingSubscriptionStatus;
  last_invoice_id: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  customer?: BillingCustomer;
}

export interface BillingInvoice {
  id: string;
  subscription_id: string | null;
  customer_id: string;
  invoice_number: string;
  type: BillingInvoiceType;
  subtotal: number;
  tps_amount: number;
  tvq_amount: number;
  total: number;
  currency: string;
  payment_method: BillingPaymentMethod;
  status: BillingInvoiceStatus;
  cycle_start_date: string;
  cycle_end_date: string;
  due_date: string;
  notes: string | null;
  created_at: string;
  paid_at: string | null;
  // Joined data
  customer?: BillingCustomer;
  subscription?: BillingSubscription;
  lines?: BillingInvoiceLine[];
  payments?: BillingPayment[];
}

export interface BillingInvoiceLine {
  id: string;
  invoice_id: string;
  description: string;
  unit_price: number;
  quantity: number;
  line_total: number;
  created_at: string;
}

export interface BillingPayment {
  id: string;
  invoice_id: string;
  customer_id: string;
  method: BillingPaymentMethod;
  amount: number;
  status: BillingPaymentStatus;
  reference: string | null;
  received_at: string | null;
  confirmed_by: string | null;
  created_at: string;
}

// API Request/Response types
export interface CreateSubscriptionRequest {
  customer_id?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  user_id?: string;
  plan_code: string;
  plan_name: string;
  plan_price: number;
  payment_method?: BillingPaymentMethod;
}

export interface CreateSubscriptionResponse {
  success: boolean;
  customer_id: string;
  subscription_id: string;
  invoice_id: string;
  invoice_number: string;
  total: number;
}

export interface ConfirmPaymentRequest {
  invoice_id: string;
  payment_reference?: string;
  confirmed_by?: string;
}

// Status display helpers
export const BILLING_INVOICE_STATUS_LABELS: Record<BillingInvoiceStatus, string> = {
  draft: 'Brouillon',
  pending: 'En attente',
  partially_paid: 'Partiellement payée',
  paid: 'Payée',
  paid_by_promo: 'Payée par promo',
  failed: 'Échouée',
  cancelled: 'Annulée',
  refunded: 'Remboursée',
  overdue: 'En retard',
  void: 'Annulée',
  not_renewed: 'Non renouvelée',
};

export const BILLING_INVOICE_STATUS_COLORS: Record<BillingInvoiceStatus, string> = {
  draft: 'bg-gray-100 text-gray-800',
  pending: 'bg-yellow-100 text-yellow-800',
  partially_paid: 'bg-orange-100 text-orange-800',
  paid: 'bg-green-100 text-green-800',
  paid_by_promo: 'bg-purple-100 text-purple-800',
  failed: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-600',
  refunded: 'bg-purple-100 text-purple-800',
  overdue: 'bg-red-100 text-red-800',
  void: 'bg-gray-100 text-gray-500',
  not_renewed: 'bg-gray-100 text-gray-600',
};

export const BILLING_SUBSCRIPTION_STATUS_LABELS: Record<BillingSubscriptionStatus, string> = {
  active: 'Actif',
  pending: 'En attente',
  suspended: 'Suspendu',
  cancelled: 'Annulé'
};

export const BILLING_SUBSCRIPTION_STATUS_COLORS: Record<BillingSubscriptionStatus, string> = {
  active: 'bg-green-100 text-green-800',
  pending: 'bg-yellow-100 text-yellow-800',
  suspended: 'bg-orange-100 text-orange-800',
  cancelled: 'bg-red-100 text-red-800'
};

/**
 * @deprecated — PHASE 2: Use estimateTaxes() from '@/lib/pricing/serverTaxEngine' instead.
 * These constants are FROZEN and will be removed in Phase 3.
 */
export const BILLING_TAX_RATES = {
  /** @deprecated */ TPS: 0.05,
  /** @deprecated */ TVQ: 0.09975
} as const;

/**
 * @deprecated Use compute_invoice_breakdown RPC instead. Client-side math is forbidden.
 */
export function calculateBillingTotals(subtotal: number): {
  subtotal: number;
  tps: number;
  tvq: number;
  total: number;
} {
  console.warn("[DEPRECATED] calculateBillingTotals called — use compute_invoice_breakdown RPC instead");
  const { estimateTaxes } = require("@/lib/pricing/serverTaxEngine");
  const result = estimateTaxes(subtotal);
  return { subtotal, tps: result.tps, tvq: result.tvq, total: result.total };
}
