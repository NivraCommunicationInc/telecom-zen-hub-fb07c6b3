/**
 * Nivra Document Builder — Order→PDF Pipeline
 * 
 * Takes an order ID and generates all 3 required documents:
 * 1. Invoice PDF (V3 TELUS-grade)
 * 2. Service Contract PDF (V3)
 * 3. Service Terms PDF (Modalités de service)
 * 
 * This is the SINGLE ENTRY POINT for generating order documents.
 * It handles data fetching, mapping, and PDF generation.
 */

import { supabase } from "@/integrations/supabase/client";
import { generateInvoiceV3PDF } from "./invoiceTemplateV3";
import { generateContractV3PDF, type ContractDataV3 } from "./contractTemplateV3";
import { generateServiceTermsPDF, CURRENT_TERMS_VERSION } from "./serviceTermsTemplate";
import type { InvoiceDataV2, PDFGenerationResult, InvoiceItem } from "./types";
import { TAX } from "./companyInfo";

// ============================================================================
// TYPES
// ============================================================================

export interface OrderDocuments {
  invoice: PDFGenerationResult;
  contract: PDFGenerationResult;
  terms: PDFGenerationResult;
}

export interface OrderDocumentData {
  orderId: string;
  order: any;
  profile: any;
  account: any;
  billingInvoice?: any;
  billingPayments?: any[];
}

// ============================================================================
// DATA FETCHER
// ============================================================================

export async function fetchOrderDocumentData(orderId: string): Promise<OrderDocumentData | null> {
  // Fetch order with all relevant data
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .single();

  if (orderError || !order) {
    console.error("[DocumentBuilder] Order not found:", orderId, orderError);
    return null;
  }

  // Fetch profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", order.user_id)
    .single();

  // Fetch account
  const { data: account } = await supabase
    .from("accounts")
    .select("*")
    .eq("client_id", order.user_id)
    .maybeSingle();

  // Fetch billing invoice if exists
  const { data: billingInvoice } = await supabase
    .from("billing_invoices")
    .select("*")
    .eq("id", order.id)
    .maybeSingle();

  // Fetch billing payments
  const { data: billingPayments } = await supabase
    .from("billing_payments")
    .select("*")
    .eq("invoice_id", order.id)
    .order("created_at", { ascending: false });

  return {
    orderId,
    order,
    profile,
    account,
    billingInvoice,
    billingPayments: billingPayments || [],
  };
}

// ============================================================================
// DATA MAPPERS
// ============================================================================

function buildCustomerAddress(order: any, profile: any, account: any): {
  billing: string;
  service: string;
  address_line1: string;
  city: string;
  province: string;
  postal_code: string;
} {
  // Service address from order
  const serviceAddr = [
    order.shipping_address,
    order.shipping_city,
    order.shipping_province || "QC",
    order.shipping_postal_code,
  ].filter(Boolean).join(", ");

  // Billing address from account or profile
  const billingAddr = account ? [
    account.billing_address,
    account.billing_city,
    account.billing_province || "QC",
    account.billing_postal_code,
  ].filter(Boolean).join(", ") : serviceAddr;

  return {
    billing: billingAddr || serviceAddr || "—",
    service: serviceAddr || billingAddr || "—",
    address_line1: order.shipping_address || account?.billing_address || profile?.address || "—",
    city: order.shipping_city || account?.billing_city || "",
    province: order.shipping_province || account?.billing_province || "QC",
    postal_code: order.shipping_postal_code || account?.billing_postal_code || "",
  };
}

function parseLineItems(order: any): {
  services: Array<{ type: string; name: string; description?: string; monthly_price: number }>;
  equipment: Array<{ name: string; quantity: number; unit_price: number }>;
  fees: Array<{ label: string; amount: number }>;
  invoiceItems: InvoiceItem[];
} {
  const services: Array<{ type: string; name: string; description?: string; monthly_price: number }> = [];
  const equipment: Array<{ name: string; quantity: number; unit_price: number }> = [];
  const fees: Array<{ label: string; amount: number }> = [];
  const invoiceItems: InvoiceItem[] = [];

  // Parse from equipment_details (structured line items)
  const eqDetails = order.equipment_details;
  if (eqDetails?.line_items && Array.isArray(eqDetails.line_items)) {
    eqDetails.line_items.forEach((item: any) => {
      const cat = item.category || item.type || "Other";
      const name = item.name || item.description || "Service";
      const price = Number(item.price || item.amount || item.unit_price || 0);
      const qty = Number(item.quantity || 1);

      if (item.type === "service" || cat === "Internet" || cat === "Mobile" || cat === "TV") {
        services.push({ type: cat, name, monthly_price: price });
        invoiceItems.push({
          category: cat as any,
          description: name,
          qty,
          unit_price: price,
          amount: price * qty,
          is_recurring: true,
          service_address: order.shipping_address || undefined,
        });
      } else if (item.type === "equipment") {
        equipment.push({ name, quantity: qty, unit_price: price });
        invoiceItems.push({
          category: "Equipment",
          description: name,
          qty,
          unit_price: price,
          amount: price * qty,
          is_recurring: false,
        });
      } else if (item.type === "fee") {
        fees.push({ label: name, amount: price });
        invoiceItems.push({
          category: "Fees",
          description: name,
          qty: 1,
          unit_price: price,
          amount: price,
          is_recurring: false,
        });
      } else {
        invoiceItems.push({
          category: cat as any,
          description: name,
          qty,
          unit_price: price,
          amount: price * qty,
          is_recurring: false,
        });
      }
    });
  }

  // Fallback: create items from order fields if no line items
  if (invoiceItems.length === 0) {
    if (order.service_type) {
      const price = Number(order.subtotal || 0);
      services.push({ type: order.category || "Service", name: order.service_type, monthly_price: price });
      invoiceItems.push({
        category: (order.category || "Other") as any,
        description: `Commande: ${order.order_number || order.id.slice(0, 8)}`,
        qty: 1,
        unit_price: price,
        amount: price,
        is_recurring: order.category !== "Delivery",
        service_address: order.shipping_address || undefined,
      });
    }

    // Add fees from order fields
    if (order.activation_fee > 0) {
      fees.push({ label: "Frais d'activation", amount: order.activation_fee });
      invoiceItems.push({ category: "Fees", description: "Frais d'activation", qty: 1, unit_price: order.activation_fee, amount: order.activation_fee, is_recurring: false });
    }
    if (order.delivery_fee > 0) {
      fees.push({ label: "Frais de livraison", amount: order.delivery_fee });
      invoiceItems.push({ category: "Fees", description: "Frais de livraison", qty: 1, unit_price: order.delivery_fee, amount: order.delivery_fee, is_recurring: false });
    }
    if (order.installation_fee > 0) {
      fees.push({ label: "Installation professionnelle", amount: order.installation_fee });
      invoiceItems.push({ category: "Fees", description: "Installation professionnelle", qty: 1, unit_price: order.installation_fee, amount: order.installation_fee, is_recurring: false });
    }
    if (order.router_fee > 0) {
      equipment.push({ name: "Routeur Nivra Born WiFi", quantity: 1, unit_price: order.router_fee });
      invoiceItems.push({ category: "Equipment", description: "Routeur Nivra Born WiFi", qty: 1, unit_price: order.router_fee, amount: order.router_fee, is_recurring: false });
    }
  }

  return { services, equipment, fees, invoiceItems };
}

// ============================================================================
// DOCUMENT GENERATORS
// ============================================================================

export function buildInvoiceData(data: OrderDocumentData): InvoiceDataV2 {
  const { order, profile, account } = data;
  const addr = buildCustomerAddress(order, profile, account);
  const { invoiceItems } = parseLineItems(order);

  // Calculate totals from line items
  const subtotal = invoiceItems.reduce((sum, item) => sum + item.amount, 0);
  const discountAmount = Number(order.discount_amount || 0);
  const taxableBase = Math.max(0, subtotal - discountAmount);
  const tpsAmount = Number(order.tps_amount) || Math.round(taxableBase * TAX.GST_RATE * 100) / 100;
  const tvqAmount = Number(order.tvq_amount) || Math.round(taxableBase * TAX.QST_RATE * 100) / 100;
  const total = Math.round((taxableBase + tpsAmount + tvqAmount) * 100) / 100;
  const amountPaid = Number(order.amount_paid || 0);
  const balanceDue = Math.max(0, Math.round((total - amountPaid) * 100) / 100);

  // Payment status mapping
  const isPaid = order.payment_status === "captured" || order.payment_status === "paid" || order.payment_status === "confirmed";
  const invoiceStatus = isPaid ? "Paid" : "Pending";

  const clientName = [order.client_first_name, order.client_last_name].filter(Boolean).join(" ")
    || profile?.full_name || profile?.first_name && profile?.last_name ? `${profile.first_name} ${profile.last_name}` : "Client";

  const invoiceData: InvoiceDataV2 = {
    invoice_type: order.category === "Delivery" || !invoiceItems.some(i => i.is_recurring) ? "ONETIME" : "MONTHLY",
    invoice_number: order.order_number?.toString() || order.id.slice(0, 7),
    invoice_date: order.created_at,
    due_date: new Date(new Date(order.created_at).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    account_number: account?.account_number || "—",
    currency: "CAD",
    status: invoiceStatus as any,

    customer: {
      full_name: clientName,
      email: order.client_email || profile?.email || "—",
      phone: order.client_phone || profile?.phone || "—",
      address_line1: addr.address_line1,
      city: addr.city,
      province: addr.province,
      postal_code: addr.postal_code,
    },

    items: invoiceItems.map(item => ({
      ...item,
      service_address: item.service_address || addr.service,
      reference: order.order_number?.toString(),
    })),

    discounts: discountAmount > 0 ? [{
      label: order.promo_code ? `Promo: ${order.promo_code}` : "Rabais appliqué",
      amount: discountAmount,
    }] : [],

    subtotal,
    taxes: {
      gst_rate: TAX.GST_RATE,
      gst_amount: tpsAmount,
      qst_rate: TAX.QST_RATE,
      qst_amount: tvqAmount,
    },
    total,
    balance_due: balanceDue,

    payments: isPaid ? [{
      method: order.payment_method || "Interac",
      status: "Confirmed",
      paid_amount: amountPaid || total,
      paid_at: order.paid_at || order.updated_at,
      payment_reference: order.payment_reference || "—",
    }] : [],
    payments_total: isPaid ? (amountPaid || total) : 0,
  };

  // Add order_number as custom field
  (invoiceData as any).order_number = order.order_number?.toString();

  return invoiceData;
}

export function buildContractData(data: OrderDocumentData): ContractDataV3 {
  const { order, profile, account } = data;
  const addr = buildCustomerAddress(order, profile, account);
  const { services, equipment, fees } = parseLineItems(order);

  const clientName = [order.client_first_name, order.client_last_name].filter(Boolean).join(" ")
    || profile?.full_name || "Client";

  const subtotalMonthly = services.reduce((sum, s) => sum + s.monthly_price, 0);
  const subtotalOneTime = equipment.reduce((sum, e) => sum + e.unit_price * e.quantity, 0)
    + fees.reduce((sum, f) => sum + f.amount, 0);
  const discountAmount = Number(order.discount_amount || 0);
  const taxableBase = Math.max(0, subtotalMonthly + subtotalOneTime - discountAmount);
  const taxGst = Number(order.tps_amount) || Math.round(taxableBase * TAX.GST_RATE * 100) / 100;
  const taxQst = Number(order.tvq_amount) || Math.round(taxableBase * TAX.QST_RATE * 100) / 100;

  return {
    contract_number: order.related_contract_id || `CTR-${order.order_number || order.id.slice(0, 8)}`,
    contract_date: order.created_at,
    terms_version: CURRENT_TERMS_VERSION,
    client_name: clientName,
    client_email: order.client_email || profile?.email || "—",
    client_phone: order.client_phone || profile?.phone || "—",
    client_dob: order.client_dob,
    billing_address: addr.billing,
    service_address: addr.service,
    account_number: account?.account_number || "—",
    order_number: order.order_number?.toString() || "—",
    services,
    equipment,
    one_time_fees: fees,
    subtotal_monthly: subtotalMonthly,
    subtotal_one_time: subtotalOneTime,
    discount_amount: discountAmount,
    tax_gst: taxGst,
    tax_qst: taxQst,
    total_due_today: Math.round((taxableBase + taxGst + taxQst) * 100) / 100,
    payment_method: order.payment_method,
  };
}

// ============================================================================
// MAIN PIPELINE
// ============================================================================

export async function generateOrderDocuments(orderId: string): Promise<OrderDocuments | null> {
  console.log(`[DocumentBuilder] Generating documents for order: ${orderId}`);

  const data = await fetchOrderDocumentData(orderId);
  if (!data) {
    console.error("[DocumentBuilder] Could not fetch order data");
    return null;
  }

  // 1. Invoice
  const invoiceData = buildInvoiceData(data);
  const invoice = generateInvoiceV3PDF(invoiceData);

  // 2. Contract
  const contractData = buildContractData(data);
  const contract = generateContractV3PDF(contractData);

  // 3. Service Terms
  const terms = generateServiceTermsPDF();

  console.log(`[DocumentBuilder] Generated: invoice=${invoice.success}, contract=${contract.success}, terms=${terms.success}`);

  return { invoice, contract, terms };
}

/** Download a PDF blob */
export function downloadPDF(result: PDFGenerationResult) {
  if (!result.success || !result.blob || !result.filename) return;
  const url = URL.createObjectURL(result.blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = result.filename;
  a.click();
  URL.revokeObjectURL(url);
}
