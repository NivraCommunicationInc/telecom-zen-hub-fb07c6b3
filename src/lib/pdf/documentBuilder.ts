/**
 * Nivra Document Builder — Order→PDF Pipeline V3.1
 * 
 * Takes an order ID and generates all 4+1 required documents:
 * 1. Invoice PDF (V3 TELUS-grade)
 * 2. Order Summary PDF (V3)
 * 3. Service Contract PDF (V3)
 * 4. Contract Summary / RRE (1-page)
 * + Service Terms PDF (Modalités de service)
 * 
 * SINGLE SOURCE OF TRUTH: One normalized data fetch, used by all templates.
 * All totals come from DB (billing_invoices). PDF templates PRINT ONLY, never recalculate.
 */

import { supabase } from "@/integrations/supabase/client";
import { generateInvoiceV3PDF } from "./invoiceTemplateV3";
import { generateContractV3PDF, type ContractDataV3 } from "./contractTemplateV3";
import { generateContractSummaryPDF, type ContractSummaryData } from "./contractSummaryTemplate";
import { generateOrderSummaryPDF, type OrderSummaryV3Data } from "./orderSummaryTemplate";
import { generateServiceTermsPDF, CURRENT_TERMS_VERSION } from "./serviceTermsTemplate";
import type { InvoiceDataV2, PDFGenerationResult, InvoiceItem } from "./types";
import { TAX } from "./companyInfo";

// ============================================================================
// TYPES
// ============================================================================

export interface OrderDocuments {
  invoice: PDFGenerationResult;
  orderSummary: PDFGenerationResult;
  contract: PDFGenerationResult;
  contractSummary: PDFGenerationResult;
  terms: PDFGenerationResult;
}

export interface OrderDocumentData {
  orderId: string;
  order: any;
  profile: any;
  account: any;
  billingInvoice?: any;
  billingInvoiceLines?: any[];
  billingPayments?: any[];
  contract?: any;
}

// ============================================================================
// FIELD VALIDATION — "Non fourni par le client" + server warning
// ============================================================================

function requireField(value: string | undefined | null, fieldName: string): string {
  if (!value || value === "—" || value === "N/A" || value === "À confirmer" || value.trim() === "") {
    console.warn(`[DocumentBuilder] CHAMP CRITIQUE MANQUANT: ${fieldName} — sera affiché comme "Non fourni par le client"`);
    return "Non fourni par le client";
  }
  return value.trim();
}

// ============================================================================
// DATA FETCHER — single DB round-trip
// ============================================================================

export async function fetchOrderDocumentData(orderId: string): Promise<OrderDocumentData | null> {
  // Fetch order
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .single();

  if (orderError || !order) {
    console.error("[DocumentBuilder] Order not found:", orderId, orderError);
    return null;
  }

  // Fetch all related data in parallel
  const [profileRes, accountRes, invoiceRes, contractRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", order.user_id).single(),
    supabase.from("accounts").select("*").eq("client_id", order.user_id).maybeSingle(),
    supabase.from("billing_invoices").select("*").eq("order_id", order.id).maybeSingle(),
    supabase.from("contracts").select("*").eq("order_id", order.id).order("created_at", { ascending: false }).maybeSingle(),
  ]);

  // Fetch payments and invoice lines AFTER we have the invoice ID
  const invoiceId = invoiceRes.data?.id;
  let billingPayments: any[] = [];
  let billingInvoiceLines: any[] = [];

  if (invoiceId) {
    const [paymentsRes, linesRes] = await Promise.all([
      supabase.from("billing_payments").select("*").eq("invoice_id", invoiceId).order("created_at", { ascending: false }),
      supabase.from("billing_invoice_lines").select("*").eq("invoice_id", invoiceId).order("created_at", { ascending: true }),
    ]);
    billingPayments = paymentsRes.data || [];
    billingInvoiceLines = linesRes.data || [];
  }

  return {
    orderId,
    order,
    profile: profileRes.data,
    account: accountRes.data,
    billingInvoice: invoiceRes.data,
    billingInvoiceLines,
    billingPayments,
    contract: contractRes.data,
  };
}

// ============================================================================
// ADDRESS BUILDER
// ============================================================================

function buildFullAddress(parts: { line1?: string; city?: string; province?: string; postal?: string }): string {
  return [parts.line1, parts.city, parts.province || "QC", parts.postal].filter(Boolean).join(", ");
}

function buildCustomerAddress(order: any, profile: any, account: any): {
  billing: string;
  service: string;
  address_line1: string;
  city: string;
  province: string;
  postal_code: string;
} {
  // Service address: order shipping > account primary_service > profile
  const address_line1 = order.shipping_address || account?.primary_service_address || profile?.address || "";
  const city = order.shipping_city || account?.primary_service_city || "";
  const province = order.shipping_province || account?.primary_service_province || "QC";
  const postal_code = order.shipping_postal_code || account?.primary_service_postal_code || "";

  const serviceAddr = buildFullAddress({ line1: address_line1, city, province, postal: postal_code });

  // Billing address: account billing > same as service
  const billingAddr = account?.billing_address
    ? buildFullAddress({
        line1: account.billing_address,
        city: account.billing_city,
        province: account.billing_province || "QC",
        postal: account.billing_postal_code,
      })
    : serviceAddr;

  return {
    billing: billingAddr || serviceAddr || "",
    service: serviceAddr || billingAddr || "",
    address_line1,
    city,
    province,
    postal_code,
  };
}

// ============================================================================
// CLIENT NAME BUILDER
// ============================================================================

function buildClientName(order: any, profile: any): string {
  // Priority: order fields > profile fields
  const fromOrder = [order.client_first_name, order.client_last_name].filter(Boolean).join(" ");
  if (fromOrder) return fromOrder;

  if (profile?.full_name) return profile.full_name;
  const fromProfile = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ");
  if (fromProfile) return fromProfile;

  return ""; // Will be caught by requireField
}

// ============================================================================
// LINE ITEMS PARSER — builds structured items from order data
// ============================================================================

interface ParsedLineItems {
  services: Array<{ type: string; name: string; description?: string; monthly_price: number; addons?: string[]; promo?: string; phone_number?: string; activation_date?: string }>;
  equipment: Array<{ name: string; quantity: number; unit_price: number; serial?: string }>;
  fees: Array<{ label: string; amount: number }>;
  invoiceItems: InvoiceItem[];
}

function parseLineItems(order: any, billingInvoiceLines?: any[]): ParsedLineItems {
  const services: ParsedLineItems["services"] = [];
  const equipment: ParsedLineItems["equipment"] = [];
  const fees: ParsedLineItems["fees"] = [];
  const invoiceItems: InvoiceItem[] = [];

  // PRIMARY: Use billing_invoice_lines if available (DB source of truth)
  if (billingInvoiceLines && billingInvoiceLines.length > 0) {
    billingInvoiceLines.forEach((line: any) => {
      const desc = line.description || "Service";
      const amount = Number(line.line_total || 0);
      const qty = Number(line.quantity || 1);
      const unitPrice = Number(line.unit_price || amount);

      // Categorize by description keywords
      const descLower = desc.toLowerCase();
      if (descLower.includes("activation")) {
        fees.push({ label: desc, amount });
        invoiceItems.push({ category: "Fees", description: desc, qty, unit_price: unitPrice, amount, is_recurring: false });
      } else if (descLower.includes("livraison") || descLower.includes("delivery")) {
        fees.push({ label: desc, amount });
        invoiceItems.push({ category: "Fees", description: desc, qty, unit_price: unitPrice, amount, is_recurring: false });
      } else if (descLower.includes("installation")) {
        fees.push({ label: desc, amount });
        invoiceItems.push({ category: "Fees", description: desc, qty, unit_price: unitPrice, amount, is_recurring: false });
      } else if (descLower.includes("sim") || descLower.includes("routeur") || descLower.includes("modem") || descLower.includes("terminal")) {
        equipment.push({ name: desc, quantity: qty, unit_price: unitPrice });
        invoiceItems.push({ category: "Equipment", description: desc, qty, unit_price: unitPrice, amount, is_recurring: false });
      } else if (descLower.includes("promo") || descLower.includes("rabais") || amount < 0) {
        invoiceItems.push({ category: "Other", description: desc, qty, unit_price: unitPrice, amount, is_recurring: false });
      } else {
        // Assume service
        const type = descLower.includes("internet") ? "Internet"
          : descLower.includes("mobile") ? "Mobile"
          : descLower.includes("tv") || descLower.includes("télé") ? "TV"
          : descLower.includes("streaming") ? "Streaming"
          : "Service";
        services.push({ type, name: desc, monthly_price: amount });
        invoiceItems.push({ category: type as any, description: desc, qty, unit_price: unitPrice, amount, is_recurring: true, service_address: order.shipping_address });
      }
    });

    return { services, equipment, fees, invoiceItems };
  }

  // FALLBACK: Parse from equipment_details JSON
  const eqDetails = order.equipment_details;
  if (eqDetails?.line_items && Array.isArray(eqDetails.line_items)) {
    eqDetails.line_items.forEach((item: any) => {
      const cat = item.category || item.type || "Other";
      const name = item.name || item.description || "Service";
      const price = Number(item.price || item.amount || item.unit_price || 0);
      const qty = Number(item.quantity || 1);

      if (item.type === "service" || ["Internet", "Mobile", "TV", "Streaming"].includes(cat)) {
        services.push({ type: cat, name, description: item.description, monthly_price: price, addons: item.addons, promo: item.promo, phone_number: item.phone_number, activation_date: item.activation_date });
        invoiceItems.push({ category: cat as any, description: name, qty, unit_price: price, amount: price * qty, is_recurring: true, service_address: order.shipping_address });
      } else if (item.type === "equipment") {
        equipment.push({ name, quantity: qty, unit_price: price, serial: item.serial });
        invoiceItems.push({ category: "Equipment", description: name, qty, unit_price: price, amount: price * qty, is_recurring: false, reference: item.serial });
      } else if (item.type === "fee") {
        fees.push({ label: name, amount: price });
        invoiceItems.push({ category: "Fees", description: name, qty: 1, unit_price: price, amount: price, is_recurring: false });
      } else {
        invoiceItems.push({ category: cat as any, description: name, qty, unit_price: price, amount: price * qty, is_recurring: false });
      }
    });
  }

  // LAST RESORT: create items from order-level fields
  if (invoiceItems.length === 0) {
    if (order.service_type) {
      const price = Number(order.subtotal || order.total_amount || 0);
      services.push({ type: order.category || "Service", name: order.service_type, monthly_price: price });
      invoiceItems.push({
        category: (order.category || "Other") as any,
        description: order.service_type,
        qty: 1, unit_price: price, amount: price,
        is_recurring: order.category !== "Delivery",
        service_address: order.shipping_address,
      });
    }

    if (Number(order.activation_fee) > 0) {
      fees.push({ label: "Frais d'activation", amount: order.activation_fee });
      invoiceItems.push({ category: "Fees", description: "Frais d'activation", qty: 1, unit_price: order.activation_fee, amount: order.activation_fee, is_recurring: false });
    }
    if (Number(order.delivery_fee) > 0) {
      fees.push({ label: "Frais de livraison", amount: order.delivery_fee });
      invoiceItems.push({ category: "Fees", description: "Frais de livraison", qty: 1, unit_price: order.delivery_fee, amount: order.delivery_fee, is_recurring: false });
    }
    if (Number(order.installation_fee) > 0) {
      fees.push({ label: "Installation professionnelle", amount: order.installation_fee });
      invoiceItems.push({ category: "Fees", description: "Installation professionnelle", qty: 1, unit_price: order.installation_fee, amount: order.installation_fee, is_recurring: false });
    }
    if (Number(order.router_fee) > 0) {
      equipment.push({ name: "Routeur Nivra Born WiFi", quantity: 1, unit_price: order.router_fee });
      invoiceItems.push({ category: "Equipment", description: "Routeur Nivra Born WiFi", qty: 1, unit_price: order.router_fee, amount: order.router_fee, is_recurring: false });
    }
  }

  return { services, equipment, fees, invoiceItems };
}

// ============================================================================
// TOTALS CALCULATOR — DB-first, fallback to calculated
// ============================================================================

interface NormalizedTotals {
  subtotal: number;
  discountAmount: number;
  tpsAmount: number;
  tvqAmount: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
  subtotalMonthly: number;
  subtotalOnetime: number;
}

function computeTotals(
  billingInvoice: any | null,
  invoiceItems: InvoiceItem[],
  services: ParsedLineItems["services"],
  equipment: ParsedLineItems["equipment"],
  fees: ParsedLineItems["fees"],
  order: any,
  payments: any[]
): NormalizedTotals {
  // Monthly vs one-time split (for summaries)
  const subtotalMonthly = services.reduce((sum, s) => sum + s.monthly_price, 0);
  const subtotalOnetime = equipment.reduce((sum, e) => sum + e.unit_price * e.quantity, 0)
    + fees.reduce((sum, f) => sum + f.amount, 0);

  // PREFER billing_invoices as source of truth
  if (billingInvoice) {
    const subtotal = Number(billingInvoice.subtotal || 0);
    const tpsAmount = Number(billingInvoice.tps_amount || 0);
    const tvqAmount = Number(billingInvoice.tvq_amount || 0);
    const total = Number(billingInvoice.total || 0);
    const amountPaid = Number(billingInvoice.amount_paid || 0);
    const balanceDue = Math.max(0, Math.round((total - amountPaid) * 100) / 100);

    return {
      subtotal, discountAmount: 0, tpsAmount, tvqAmount, total,
      amountPaid, balanceDue, subtotalMonthly, subtotalOnetime,
    };
  }

  // FALLBACK: calculate from line items
  const subtotal = invoiceItems.reduce((sum, item) => sum + item.amount, 0);
  const discountAmount = Number(order.discount_amount || 0);
  const taxableBase = Math.max(0, subtotal - discountAmount);
  const tpsAmount = Number(order.tps_amount) || Math.round(taxableBase * TAX.GST_RATE * 100) / 100;
  const tvqAmount = Number(order.tvq_amount) || Math.round(taxableBase * TAX.QST_RATE * 100) / 100;
  const total = Math.round((taxableBase + tpsAmount + tvqAmount) * 100) / 100;

  // Amount paid from confirmed payments
  const amountPaid = payments
    .filter((p: any) => p.status === "confirmed" || p.status === "completed" || p.status === "captured")
    .reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0)
    || Number(order.amount_paid || 0);
  const balanceDue = Math.max(0, Math.round((total - amountPaid) * 100) / 100);

  return {
    subtotal, discountAmount, tpsAmount, tvqAmount, total,
    amountPaid, balanceDue, subtotalMonthly, subtotalOnetime,
  };
}

// ============================================================================
// PAYMENT METHOD RESOLVER — single source of truth
// ============================================================================

function resolvePaymentMethod(order: any, payments: any[]): string {
  // Check actual completed payments first
  const completedPayment = payments.find((p: any) => p.status === "confirmed" || p.status === "completed");
  if (completedPayment?.method) return completedPayment.method;
  // Fall back to order
  return order.payment_method || "";
}

// ============================================================================
// DOCUMENT DATA BUILDERS
// ============================================================================

export function buildInvoiceData(data: OrderDocumentData): InvoiceDataV2 {
  const { order, profile, account, billingInvoice, billingInvoiceLines, billingPayments = [] } = data;
  const addr = buildCustomerAddress(order, profile, account);
  const { invoiceItems } = parseLineItems(order, billingInvoiceLines);
  const totals = computeTotals(billingInvoice, invoiceItems, [], [], [], order, billingPayments);
  const paymentMethod = resolvePaymentMethod(order, billingPayments);

  // Status from billing_invoices or order
  const invoiceStatus = billingInvoice?.status ||
    (["captured", "paid", "confirmed"].includes(order.payment_status) ? "paid" : "unpaid");

  const clientName = buildClientName(order, profile);

  // Use snapshot data from billing_invoices if available
  const snapshotClient = billingInvoice?.billing_snapshot_client as any;
  const snapshotAccountNumber = billingInvoice?.billing_snapshot_account_number;

  const invoiceData: InvoiceDataV2 = {
    invoice_type: order.category === "Delivery" || !invoiceItems.some(i => i.is_recurring) ? "ONETIME" : "MONTHLY",
    invoice_number: billingInvoice?.invoice_number || order.order_number?.toString() || requireField(null, "invoice_number"),
    invoice_date: billingInvoice?.created_at || order.created_at,
    due_date: billingInvoice?.due_date || new Date(new Date(order.created_at).getTime() + 30 * 86400000).toISOString(),
    account_number: requireField(snapshotAccountNumber || account?.account_number, "account_number"),
    billing_period_start: billingInvoice?.cycle_start_date,
    billing_period_end: billingInvoice?.cycle_end_date,
    currency: "CAD",
    status: invoiceStatus as any,

    customer: {
      full_name: requireField(snapshotClient?.full_name || clientName, "client_name"),
      email: requireField(snapshotClient?.email || order.client_email || profile?.email, "client_email"),
      phone: requireField(snapshotClient?.phone || order.client_phone || profile?.phone, "client_phone"),
      address_line1: requireField(snapshotClient?.address_line1 || addr.address_line1, "address_line1"),
      city: requireField(snapshotClient?.city || addr.city, "city"),
      province: snapshotClient?.province || addr.province || "QC",
      postal_code: requireField(snapshotClient?.postal_code || addr.postal_code, "postal_code"),
    },

    items: invoiceItems.map(item => ({
      ...item,
      service_address: item.service_address || addr.service || undefined,
      reference: order.order_number?.toString(),
    })),

    discounts: totals.discountAmount > 0 ? [{
      label: order.promo_code ? `Promo: ${order.promo_code}` : "Rabais appliqué",
      amount: totals.discountAmount,
    }] : [],

    subtotal: totals.subtotal,
    taxes: {
      gst_rate: TAX.GST_RATE,
      gst_amount: totals.tpsAmount,
      qst_rate: TAX.QST_RATE,
      qst_amount: totals.tvqAmount,
    },
    total: totals.total,
    balance_due: totals.balanceDue,

    payments: billingPayments.length > 0
      ? billingPayments
          .filter((p: any) => p.status === "confirmed" || p.status === "completed" || p.status === "captured")
          .map((p: any) => ({
            method: p.method || paymentMethod,
            status: "Confirmed" as const,
            paid_amount: Number(p.amount || 0),
            paid_at: p.received_at || p.created_at,
            payment_reference: p.reference || "—",
            processor_txn_id: p.provider_payment_id,
          }))
      : totals.amountPaid > 0
        ? [{
            method: paymentMethod || "Interac",
            status: "Confirmed" as const,
            paid_amount: totals.amountPaid,
            paid_at: order.paid_at || billingInvoice?.paid_at || order.updated_at,
            payment_reference: order.payment_reference || "—",
            processor_txn_id: order.paypal_capture_id || order.provider_payment_id,
          }]
        : [],
    payments_total: totals.amountPaid,
  };

  (invoiceData as any).order_number = order.order_number?.toString();
  return invoiceData;
}

export function buildOrderSummaryData(data: OrderDocumentData): OrderSummaryV3Data {
  const { order, profile, account, billingInvoice, billingInvoiceLines, billingPayments = [] } = data;
  const addr = buildCustomerAddress(order, profile, account);
  const { services, equipment, fees, invoiceItems } = parseLineItems(order, billingInvoiceLines);
  const totals = computeTotals(billingInvoice, invoiceItems, services, equipment, fees, order, billingPayments);
  const paymentMethod = resolvePaymentMethod(order, billingPayments);

  const clientName = buildClientName(order, profile);

  return {
    order_number: requireField(order.order_number?.toString(), "order_number"),
    order_date: order.created_at,
    order_status: order.status || "pending",
    client_name: requireField(clientName, "client_name"),
    client_email: requireField(order.client_email || profile?.email, "client_email"),
    client_phone: requireField(order.client_phone || profile?.phone, "client_phone"),
    client_dob: order.client_dob,
    service_address: requireField(addr.service, "service_address"),
    billing_address: addr.billing !== addr.service ? addr.billing : undefined,
    account_number: requireField(account?.account_number, "account_number"),
    delivery_method: order.delivery_method || order.installation_method,
    services: services.map(s => ({
      type: s.type,
      name: s.name,
      description: s.description,
      monthly_price: s.monthly_price,
      addons: s.addons,
      promo: s.promo,
      phone_number: s.phone_number,
      activation_date: s.activation_date,
    })),
    equipment: equipment.map(e => ({
      name: e.name,
      quantity: e.quantity,
      unit_price: e.unit_price,
      serial: e.serial,
    })),
    fees,
    subtotal_monthly: totals.subtotalMonthly,
    subtotal_onetime: totals.subtotalOnetime,
    discount_amount: totals.discountAmount,
    discount_label: order.promo_code ? `Promo: ${order.promo_code}` : undefined,
    tax_gst: totals.tpsAmount,
    tax_qst: totals.tvqAmount,
    total_due: totals.total,
    payment_method: paymentMethod,
    payment_status: order.payment_status,
    estimated_activation: order.estimated_activation,
  };
}

export function buildContractData(data: OrderDocumentData): ContractDataV3 {
  const { order, profile, account, contract, billingInvoice, billingInvoiceLines, billingPayments = [] } = data;
  const addr = buildCustomerAddress(order, profile, account);
  const { services, equipment, fees, invoiceItems } = parseLineItems(order, billingInvoiceLines);
  const totals = computeTotals(billingInvoice, invoiceItems, services, equipment, fees, order, billingPayments);
  const paymentMethod = resolvePaymentMethod(order, billingPayments);

  const clientName = buildClientName(order, profile);

  return {
    contract_number: contract?.contract_number || order.related_contract_id || `CTR-${order.order_number || order.id.slice(0, 8)}`,
    contract_date: contract?.created_at || order.created_at,
    terms_version: CURRENT_TERMS_VERSION,
    client_name: requireField(clientName, "client_name"),
    client_email: requireField(order.client_email || profile?.email, "client_email"),
    client_phone: requireField(order.client_phone || profile?.phone, "client_phone"),
    client_dob: order.client_dob,
    billing_address: requireField(addr.billing, "billing_address"),
    service_address: requireField(addr.service, "service_address"),
    account_number: requireField(account?.account_number, "account_number"),
    order_number: requireField(order.order_number?.toString(), "order_number"),
    services,
    equipment,
    one_time_fees: fees,
    subtotal_monthly: totals.subtotalMonthly,
    subtotal_one_time: totals.subtotalOnetime,
    discount_amount: totals.discountAmount,
    tax_gst: totals.tpsAmount,
    tax_qst: totals.tvqAmount,
    total_due_today: totals.total,
    payment_method: paymentMethod,
    // Signatures from contract record
    is_signed: contract?.is_signed || contract?.status === "signed_by_client" || contract?.status === "fully_signed",
    signature_name: contract?.client_signer_name || clientName,
    signature_date: contract?.client_signed_at || contract?.signed_at,
    signature_ip: contract?.client_ip,
    admin_signature_name: contract?.admin_signer_name,
    admin_signature_date: contract?.admin_signed_at,
  };
}

export function buildContractSummaryData(data: OrderDocumentData): ContractSummaryData {
  const { order, profile, account, contract, billingInvoice, billingInvoiceLines, billingPayments = [] } = data;
  const addr = buildCustomerAddress(order, profile, account);
  const { services, equipment, fees, invoiceItems } = parseLineItems(order, billingInvoiceLines);
  const totals = computeTotals(billingInvoice, invoiceItems, services, equipment, fees, order, billingPayments);
  const paymentMethod = resolvePaymentMethod(order, billingPayments);

  const clientName = buildClientName(order, profile);

  // Combine equipment + fees into one_time_fees for RRE display
  const allOneTimeFees = [
    ...equipment.map(e => ({ label: e.name, amount: e.unit_price * e.quantity })),
    ...fees,
  ];

  return {
    contract_number: contract?.contract_number || order.related_contract_id || `CTR-${order.order_number || order.id.slice(0, 8)}`,
    order_number: requireField(order.order_number?.toString(), "order_number"),
    account_number: requireField(account?.account_number, "account_number"),
    contract_date: contract?.created_at || order.created_at,
    terms_version: CURRENT_TERMS_VERSION,
    client_name: requireField(clientName, "client_name"),
    client_email: requireField(order.client_email || profile?.email, "client_email"),
    client_phone: requireField(order.client_phone || profile?.phone, "client_phone"),
    service_address: requireField(addr.service, "service_address"),
    services: services.map(s => ({ type: s.type, name: s.name, monthly_price: s.monthly_price })),
    one_time_fees: allOneTimeFees,
    subtotal_monthly: totals.subtotalMonthly,
    subtotal_one_time: totals.subtotalOnetime,
    discount_amount: totals.discountAmount,
    tax_gst: totals.tpsAmount,
    tax_qst: totals.tvqAmount,
    total_due_today: totals.total,
    payment_method: requireField(paymentMethod, "payment_method"),
    bill_cycle_day: account?.billing_cycle_day || undefined,
    activation_date: order.estimated_activation,
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

  // Generate all 5 documents from single data source
  const invoiceData = buildInvoiceData(data);
  const invoice = generateInvoiceV3PDF(invoiceData);

  const orderSummaryData = buildOrderSummaryData(data);
  const orderSummary = generateOrderSummaryPDF(orderSummaryData);

  const contractData = buildContractData(data);
  const contract = generateContractV3PDF(contractData);

  const contractSummaryData = buildContractSummaryData(data);
  const contractSummary = generateContractSummaryPDF(contractSummaryData);

  const terms = generateServiceTermsPDF();

  console.log(`[DocumentBuilder] Generated: invoice=${invoice.success}, summary=${orderSummary.success}, contract=${contract.success}, rre=${contractSummary.success}, terms=${terms.success}`);

  return { invoice, orderSummary, contract, contractSummary, terms };
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
