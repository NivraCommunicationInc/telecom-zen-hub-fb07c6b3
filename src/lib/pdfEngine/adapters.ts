/**
 * Nivra Document Engine - Adapters
 * 
 * These adapters convert existing data structures from the application
 * into the UnifiedDocumentData format used by the new PDF engine.
 * 
 * This allows gradual migration from old generators to the new unified system.
 */

import type { 
  UnifiedDocumentData, 
  ServiceLineItem, 
  EquipmentItem, 
  OneTimeFee,
  DiscountItem,
  BillingSummary,
  ClientInfo,
  CompanyInfo,
  TVChannelsSummary,
} from "./types";
import { BUSINESS_INFO, CONTRACT_TERMS } from "../contractPolicies";

// ============= HELPER FUNCTIONS =============

/**
 * Gets company info from centralized config
 */
export function getCompanyInfo(): CompanyInfo {
  return {
    name: BUSINESS_INFO.brandName,
    legalName: BUSINESS_INFO.legalName,
    address: BUSINESS_INFO.address,
    email: BUSINESS_INFO.email,
    phone: BUSINESS_INFO.phone,
  };
}

/**
 * Calculates taxes for Quebec (TPS + TVQ)
 */
export function calculateQuebecTaxes(subtotal: number): { tps: number; tvq: number } {
  const TPS_RATE = 0.05;
  const TVQ_RATE = 0.09975;
  
  return {
    tps: Math.round(subtotal * TPS_RATE * 100) / 100,
    tvq: Math.round(subtotal * TVQ_RATE * 100) / 100,
  };
}

// ============= ORDER TO DOCUMENT ADAPTER =============

export interface OrderData {
  id: string;
  order_number: string;
  created_at: string;
  status: string;
  category?: string;
  
  // Client
  client_first_name: string;
  client_last_name: string;
  client_email: string;
  client_phone?: string;
  client_account_number?: string;
  
  // Addresses
  service_address?: string;
  service_city?: string;
  service_province?: string;
  service_postal_code?: string;
  billing_address?: string;
  
  // Service info with prices
  service_plan?: string;
  internet_plan?: string;
  internet_price?: number;
  tv_bundle?: string;
  tv_price?: number;
  mobile_plan?: string;
  mobile_price?: number;
  streaming_plan?: string;
  streaming_price?: number;
  
  // TV summary
  tv_base_channels?: number;
  tv_optional_channels?: number;
  tv_premium_channels?: number;
  tv_premium_total?: number;
  
  // Billing
  subtotal?: number;
  activation_fee?: number;
  delivery_fee?: number;
  installation_fee?: number;
  terminal_fee?: number;
  terminal_count?: number;
  router_fee?: number;
  sim_fee?: number;
  discount_amount?: number;
  promo_code?: string;
  promo_discount?: number;
  preauth_discount?: number;
  preauth_enabled?: boolean;
  loyalty_discount?: number;
  multi_line_discount?: number;
  tps_amount?: number;
  tvq_amount?: number;
  total_amount?: number;
  
  // Payment
  payment_status?: string;
  payment_reference?: string;
  paid_at?: string;
  due_date?: string;
  
  // Admin
  processed_by_name?: string;
  processed_by_email?: string;
  processed_by_role?: string;
  
  // Notes
  notes?: string;
  internal_notes?: string;
}

/**
 * Converts order data to UnifiedDocumentData for PDF generation
 */
export function orderToDocumentData(
  order: OrderData,
  docType: "contract" | "invoice" | "estimate"
): UnifiedDocumentData {
  
  // Build services list (only selected services) with individual prices
  const services: ServiceLineItem[] = [];
  
  if (order.internet_plan) {
    services.push({
      type: "Internet",
      name: order.internet_plan,
      monthlyPrice: order.internet_price || 0,
      priceLabel: "/mois",
    });
  }
  
  if (order.tv_bundle) {
    services.push({
      type: "TV",
      name: order.tv_bundle,
      description: "Requiert Internet actif",
      monthlyPrice: order.tv_price || 0,
      priceLabel: "/mois",
    });
  }
  
  if (order.mobile_plan) {
    services.push({
      type: "Mobile",
      name: order.mobile_plan,
      monthlyPrice: order.mobile_price || 0,
      priceLabel: "/30 jours",
    });
  }
  
  if (order.streaming_plan) {
    services.push({
      type: "Streaming",
      name: order.streaming_plan,
      monthlyPrice: order.streaming_price || 0,
      priceLabel: "/mois",
    });
  }
  
  // If we have a generic service plan and no specific services
  if (services.length === 0 && order.service_plan) {
    services.push({
      type: "Other",
      name: order.service_plan,
      monthlyPrice: order.subtotal || 0,
      priceLabel: "/mois",
    });
  }
  
  // TV summary (only if TV is selected)
  let tvSummary: TVChannelsSummary | undefined;
  if (order.tv_bundle && (order.tv_base_channels || order.tv_optional_channels || order.tv_premium_channels)) {
    tvSummary = {
      baseChannels: order.tv_base_channels || 0,
      optionalChannels: order.tv_optional_channels || 0,
      premiumChannels: order.tv_premium_channels || 0,
      premiumTotal: order.tv_premium_total,
    };
  }
  
  // Equipment (only if present)
  const equipment: EquipmentItem[] = [];
  
  if (order.router_fee && order.router_fee > 0) {
    equipment.push({
      name: "Routeur Nivra Born WiFi",
      quantity: 1,
      unitPrice: order.router_fee,
      warranty: "1 an",
    });
  }
  
  if (order.terminal_fee && order.terminal_fee > 0) {
    equipment.push({
      name: "Terminal Nivra 4K Smart",
      quantity: order.terminal_count || 1,
      unitPrice: CONTRACT_TERMS.fees.tvTerminal,
      warranty: "1 an",
    });
  }
  
  // One-time fees (only non-zero)
  const oneTimeFees: OneTimeFee[] = [];
  
  if (order.activation_fee && order.activation_fee > 0) {
    oneTimeFees.push({
      label: "Frais d'activation",
      amount: order.activation_fee,
    });
  }
  
  if (order.delivery_fee && order.delivery_fee > 0) {
    oneTimeFees.push({
      label: "Frais de livraison",
      amount: order.delivery_fee,
      description: "Livraison standard Québec",
    });
  }
  
  if (order.installation_fee && order.installation_fee > 0) {
    oneTimeFees.push({
      label: "Installation professionnelle",
      amount: order.installation_fee,
    });
  }
  
  if (order.sim_fee && order.sim_fee > 0) {
    oneTimeFees.push({
      label: "Carte SIM",
      amount: order.sim_fee,
    });
  }
  
  // Discounts - detailed breakdown (only if present)
  const discounts: DiscountItem[] = [];
  
  // Pre-authorized payment discount
  if (order.preauth_discount && order.preauth_discount > 0) {
    discounts.push({
      label: "Rabais paiement préautorisé",
      amount: order.preauth_discount,
      type: "preauth",
    });
  } else if (order.preauth_enabled) {
    // Show label even if amount not specified yet
    discounts.push({
      label: "Rabais paiement préautorisé",
      amount: 0,
      type: "preauth",
    });
  }
  
  // Promo code discount
  if (order.promo_discount && order.promo_discount > 0) {
    discounts.push({
      label: "Code promo",
      amount: order.promo_discount,
      promoCode: order.promo_code,
      type: "promo",
    });
  }
  
  // Loyalty discount
  if (order.loyalty_discount && order.loyalty_discount > 0) {
    discounts.push({
      label: "Rabais fidélité",
      amount: order.loyalty_discount,
      type: "loyalty",
    });
  }
  
  // Multi-line discount
  if (order.multi_line_discount && order.multi_line_discount > 0) {
    discounts.push({
      label: "Rabais multi-lignes",
      amount: order.multi_line_discount,
      type: "multiLine",
    });
  }
  
  // Generic discount (fallback for legacy data without categorization)
  if (order.discount_amount && order.discount_amount > 0 && discounts.length === 0) {
    discounts.push({
      label: "Rabais promotionnel",
      amount: order.discount_amount,
      promoCode: order.promo_code,
      type: "promo",
    });
  }
  
  // Calculate billing
  const subtotal = order.subtotal || 0;
  const oneTimeTotal = oneTimeFees.reduce((sum, f) => sum + f.amount, 0) +
    equipment.reduce((sum, e) => sum + e.unitPrice * e.quantity, 0);
  // Sum all discounts from the discounts array
  const discountTotal = discounts.reduce((sum, d) => sum + d.amount, 0);
  
  const taxableAmount = subtotal + oneTimeTotal - discountTotal;
  const taxes = calculateQuebecTaxes(taxableAmount);
  
  const billing: BillingSummary = {
    subtotal,
    oneTimeTotal,
    discountTotal,
    tps: order.tps_amount ?? taxes.tps,
    tvq: order.tvq_amount ?? taxes.tvq,
    total: order.total_amount || (taxableAmount + taxes.tps + taxes.tvq),
  };
  
  // Client info
  const client: ClientInfo = {
    fullName: `${order.client_first_name} ${order.client_last_name}`.trim(),
    email: order.client_email,
    phone: order.client_phone,
    accountNumber: order.client_account_number,
    serviceAddress: order.service_address,
    serviceCity: order.service_city,
    serviceProvince: order.service_province || "QC",
    servicePostalCode: order.service_postal_code,
    billingAddress: order.billing_address,
  };
  
  // Payment status mapping
  const paymentStatusMap: Record<string, "pending" | "paid" | "overdue" | "cancelled"> = {
    pending: "pending",
    unpaid: "pending",
    paid: "paid",
    completed: "paid",
    overdue: "overdue",
    cancelled: "cancelled",
  };
  
  return {
    docType,
    metadata: {
      documentNumber: order.order_number || order.id,
      orderNumber: order.order_number,
      date: order.created_at,
      effectiveDate: order.created_at,
    },
    client,
    company: getCompanyInfo(),
    agent: order.processed_by_name ? {
      name: order.processed_by_name,
      email: order.processed_by_email,
      role: order.processed_by_role,
    } : undefined,
    services,
    tvSummary,
    equipment,
    oneTimeFees,
    discounts,
    billing,
    payment: {
      status: paymentStatusMap[order.payment_status || "pending"] || "pending",
      reference: order.payment_reference,
      paidAt: order.paid_at,
      dueDate: order.due_date,
    },
    notes: order.notes,
  };
}

// ============= BILLING RECORD TO INVOICE ADAPTER =============

export interface BillingRecord {
  id: string;
  invoice_number: string;
  created_at: string;
  due_date?: string;
  status: string;
  
  // Client
  user_id: string;
  client_email?: string;
  
  // Amounts
  subtotal?: number;
  fees?: number;
  delivery_fee?: number;
  activation_fee?: number;
  installation_fee?: number;
  credits?: number;
  discount_amount?: number;
  tps_amount?: number;
  tvq_amount?: number;
  amount: number;
  amount_paid?: number;
  
  // Payment
  paid_at?: string;
  payment_reference?: string;
  
  // Related
  related_order_number?: string;
  order_id?: string;
  
  // Notes
  notes?: string;
}

export interface ClientProfile {
  first_name?: string;
  last_name?: string;
  email: string;
  phone?: string;
  account_number?: string;
  service_address?: string;
  service_city?: string;
}

/**
 * Converts billing record to UnifiedDocumentData for invoice PDF
 */
export function billingToInvoiceData(
  billing: BillingRecord,
  client: ClientProfile,
  servicePlan?: string
): UnifiedDocumentData {
  
  const services: ServiceLineItem[] = [];
  
  if (servicePlan) {
    services.push({
      type: "Other",
      name: servicePlan,
      monthlyPrice: billing.subtotal || 0,
    });
  } else if (billing.subtotal && billing.subtotal > 0) {
    services.push({
      type: "Other",
      name: "Services de télécommunications",
      monthlyPrice: billing.subtotal,
    });
  }
  
  const oneTimeFees: OneTimeFee[] = [];
  
  if (billing.activation_fee && billing.activation_fee > 0) {
    oneTimeFees.push({ label: "Frais d'activation", amount: billing.activation_fee });
  }
  if (billing.delivery_fee && billing.delivery_fee > 0) {
    oneTimeFees.push({ label: "Frais de livraison", amount: billing.delivery_fee });
  }
  if (billing.installation_fee && billing.installation_fee > 0) {
    oneTimeFees.push({ label: "Installation", amount: billing.installation_fee });
  }
  if (billing.fees && billing.fees > 0) {
    oneTimeFees.push({ label: "Frais supplémentaires", amount: billing.fees });
  }
  
  const discounts: DiscountItem[] = [];
  
  if (billing.discount_amount && billing.discount_amount > 0) {
    discounts.push({ label: "Rabais", amount: billing.discount_amount });
  }
  if (billing.credits && billing.credits > 0) {
    discounts.push({ label: "Crédits appliqués", amount: billing.credits });
  }
  
  const subtotal = billing.subtotal || 0;
  const oneTimeTotal = oneTimeFees.reduce((sum, f) => sum + f.amount, 0);
  const discountTotal = (billing.discount_amount || 0) + (billing.credits || 0);
  
  return {
    docType: "invoice",
    metadata: {
      documentNumber: billing.invoice_number || billing.id,
      orderNumber: billing.related_order_number,
      date: billing.created_at,
    },
    client: {
      fullName: [client.first_name, client.last_name].filter(Boolean).join(" ") || "Client",
      email: client.email,
      phone: client.phone,
      accountNumber: client.account_number,
      serviceAddress: client.service_address,
      serviceCity: client.service_city,
    },
    company: getCompanyInfo(),
    services,
    equipment: [],
    oneTimeFees,
    discounts,
    billing: {
      subtotal,
      oneTimeTotal,
      discountTotal,
      tps: billing.tps_amount || 0,
      tvq: billing.tvq_amount || 0,
      total: billing.amount,
      amountPaid: billing.amount_paid,
      balance: billing.amount - (billing.amount_paid || 0),
    },
    payment: {
      status: billing.status === "paid" ? "paid" : 
              billing.status === "overdue" ? "overdue" :
              billing.status === "cancelled" ? "cancelled" : "pending",
      reference: billing.payment_reference,
      paidAt: billing.paid_at,
      dueDate: billing.due_date,
    },
    notes: billing.notes,
  };
}
