/**
 * Nivra Document Builder — Order→PDF Pipeline V4.0
 * 
 * SINGLE SOURCE OF TRUTH: Uses compute_invoice_breakdown RPC for ALL totals.
 * Zero client-side math. Profile/address data from DB.
 * 
 * Documents:
 * 1. Invoice PDF
 * 2. Order Summary PDF
 * 3. Service Contract PDF
 * 4. Contract Summary / RRE (1-page)
 * + Service Terms PDF
 */

import { adminClient as supabase } from "@/integrations/backend";
import { generateInvoiceV3PDF } from "./invoiceTemplateV3";
import { generateContractV3PDF, type ContractDataV3 } from "./contractTemplateV3";
import { generateContractSummaryPDF, type ContractSummaryData } from "./contractSummaryTemplate";
import { generateOrderSummaryPDF, type OrderSummaryV3Data } from "./orderSummaryTemplate";
import { generateServiceTermsPDF, CURRENT_TERMS_VERSION } from "./serviceTermsTemplate";
import type { InvoiceDataV2, PDFGenerationResult, InvoiceItem } from "./types";
import { TAX } from "./companyInfo";
import { fetchInvoiceBreakdown, type InvoiceBreakdown, type InvoiceBreakdownItem } from "@/lib/billing/useInvoiceBreakdown";

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
  // NEW: canonical breakdown from RPC
  breakdown?: InvoiceBreakdown | null;
}

// ============================================================================
// FIELD VALIDATION — "Non fourni par le client" (never N/A)
// ============================================================================

// Track missing fields for validation gate
const _missingFields: string[] = [];

function requireField(value: string | undefined | null, fieldName: string): string {
  if (!value || value === "—" || value === "N/A" || value === "À confirmer" || value === "000000" || value.trim() === "") {
    console.warn(`[DocumentBuilder] ⚠️ Champ manquant: ${fieldName}`);
    _missingFields.push(fieldName);
    return "Non fourni par le client";
  }
  return value.trim();
}

/**
 * Validates that all required fields are present BEFORE generating documents.
 * Returns list of missing fields. If non-empty, PDF generation MUST be blocked.
 */
export function validateDocumentData(data: OrderDocumentData): string[] {
  const missing: string[] = [];
  const { order, profile, account } = data;
  const clientName = buildClientName(order, profile);
  const addr = buildCustomerAddress(order, profile, account);

  const checks: [string | undefined | null, string][] = [
    [clientName, "client_name"],
    [order.client_email || profile?.email, "client_email"],
    [order.client_phone || profile?.phone, "client_phone"],
    [addr.address_line1, "address_line1"],
    [addr.city, "city"],
    [addr.postal_code, "postal_code"],
    [account?.account_number, "account_number"],
    [order.order_number?.toString(), "order_number"],
  ];

  for (const [val, name] of checks) {
    if (!val || val === "—" || val === "N/A" || val === "000000" || val.trim() === "") {
      missing.push(name);
    }
  }

  // breakdown is MANDATORY — no fallback path
  if (!data.breakdown) {
    missing.push("breakdown_rpc");
  }

  return missing;
}

// ============================================================================
// DATA FETCHER — single DB round-trip + breakdown RPC
// ============================================================================

export async function fetchOrderDocumentData(orderId: string): Promise<OrderDocumentData | null> {
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
    supabase.from("profiles").select("*").eq("user_id", order.user_id).maybeSingle(),
    supabase.from("accounts").select("*").eq("client_id", order.user_id).maybeSingle(),
    supabase.from("billing_invoices").select("*").eq("order_id", order.id).maybeSingle(),
    supabase.from("contracts").select("*").eq("order_id", order.id).order("created_at", { ascending: false }).maybeSingle(),
  ]);

  const invoiceId = invoiceRes.data?.id;
  let breakdown: InvoiceBreakdown | null = null;
  let billingPayments: any[] = [];
  let billingInvoiceLines: any[] = [];

  if (invoiceId) {
    // Fetch breakdown from RPC (SINGLE SOURCE OF TRUTH)
    try {
      breakdown = await fetchInvoiceBreakdown(invoiceId, supabase);
    } catch (e) {
      console.error("[DocumentBuilder] ⚠️ Breakdown RPC failed — documents may have inconsistent totals:", e);
    }

    // Also fetch raw data for backward compat (contract signatures etc.)
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
    breakdown,
  };
}

// ============================================================================
// ADDRESS BUILDER
// ============================================================================

function buildFullAddress(parts: { line1?: string; city?: string; province?: string; postal?: string }): string {
  return [parts.line1, parts.city, parts.province || "QC", parts.postal].filter(Boolean).join(", ");
}

function buildCustomerAddress(order: any, profile: any, account: any) {
  const address_line1 = order.shipping_address || account?.primary_service_address || profile?.address || profile?.service_address || "";
  const city = order.shipping_city || account?.primary_service_city || profile?.service_city || "";
  const province = order.shipping_province || account?.primary_service_province || profile?.service_province || "QC";
  const postal_code = order.shipping_postal_code || account?.primary_service_postal_code || profile?.service_postal_code || "";
  const serviceAddr = buildFullAddress({ line1: address_line1, city, province, postal: postal_code });
  const billingAddr = account?.billing_address
    ? buildFullAddress({ line1: account.billing_address, city: account.billing_city, province: account.billing_province || "QC", postal: account.billing_postal_code })
    : serviceAddr;
  return { billing: billingAddr || serviceAddr || "", service: serviceAddr || billingAddr || "", address_line1, city, province, postal_code };
}

// ============================================================================
// CLIENT NAME BUILDER
// ============================================================================

function buildClientName(order: any, profile: any): string {
  const fromOrder = [order.client_first_name, order.client_last_name].filter(Boolean).join(" ");
  if (fromOrder) return fromOrder;
  if (profile?.full_name) return profile.full_name;
  return [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "";
}

// ============================================================================
// BREAKDOWN → STRUCTURED DATA (replaces all client-side math)
// ============================================================================

interface StructuredFromBreakdown {
  services: Array<{ type: string; name: string; description?: string; monthly_price: number; addons?: string[]; promo?: string; phone_number?: string; activation_date?: string }>;
  equipment: Array<{ name: string; quantity: number; unit_price: number; serial?: string }>;
  fees: Array<{ label: string; amount: number }>;
  invoiceItems: InvoiceItem[];
  discounts: Array<{ label: string; amount: number }>;
  subtotal: number;
  subtotalMonthly: number;
  subtotalOnetime: number;
  discountAmount: number;
  tpsAmount: number;
  tvqAmount: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
}

function structureFromBreakdown(bd: InvoiceBreakdown, order: any): StructuredFromBreakdown {
  const services: StructuredFromBreakdown["services"] = [];
  const equipment: StructuredFromBreakdown["equipment"] = [];
  const fees: StructuredFromBreakdown["fees"] = [];
  const discounts: StructuredFromBreakdown["discounts"] = [];
  const invoiceItems: InvoiceItem[] = [];

  for (const item of bd.items) {
    const amount = item.line_total_cents / 100;
    const unitPrice = item.unit_price_cents / 100;
    const qty = item.quantity || 1;

    if (item.line_type === "discount") {
      discounts.push({ label: item.description, amount: Math.abs(amount) });
      continue;
    }

    if (item.line_type === "credit") {
      discounts.push({ label: item.description, amount: Math.abs(amount) });
      continue;
    }

    const descLower = item.description.toLowerCase();

    if (item.line_type === "equipment") {
      equipment.push({ name: item.description, quantity: qty, unit_price: unitPrice });
      invoiceItems.push({ category: "Equipment", description: item.description, qty, unit_price: unitPrice, amount, is_recurring: false });
    } else if (item.line_type === "fee") {
      fees.push({ label: item.description, amount });
      invoiceItems.push({ category: "Fees", description: item.description, qty, unit_price: unitPrice, amount, is_recurring: false });
    } else {
      // service
      const type = descLower.includes("internet") ? "Internet"
        : descLower.includes("mobile") ? "Mobile"
        : descLower.includes("tv") || descLower.includes("télé") ? "TV"
        : descLower.includes("streaming") ? "Streaming"
        : "Service";
      services.push({ type, name: item.description, monthly_price: amount });
      invoiceItems.push({
        category: type as any,
        description: item.description,
        qty, unit_price: unitPrice, amount,
        is_recurring: bd.type === "renewal",
        service_address: order.shipping_address,
      });
    }
  }

  const subtotalMonthly = services.reduce((s, sv) => s + sv.monthly_price, 0);
  const subtotalOnetime = equipment.reduce((s, e) => s + e.unit_price * e.quantity, 0) + fees.reduce((s, f) => s + f.amount, 0);

  return {
    services,
    equipment,
    fees,
    invoiceItems,
    discounts,
    subtotal: bd.subtotal,
    subtotalMonthly,
    subtotalOnetime,
    discountAmount: bd.discounts_total,
    tpsAmount: bd.tps_amount,
    tvqAmount: bd.tvq_amount,
    total: bd.total,
    amountPaid: bd.amount_paid,
    balanceDue: bd.balance_due,
  };
}
// fallbackStructure SUPPRIMÉ — génération bloquée si compute_invoice_breakdown échoue

// ============================================================================
// PAYMENT METHOD RESOLVER
// ============================================================================

function resolvePaymentMethod(order: any, payments: any[]): string {
  const completed = payments.find((p: any) => p.status === "confirmed" || p.status === "completed");
  if (completed?.method) return completed.method;
  return order.payment_method || "";
}

// ============================================================================
// DOCUMENT DATA BUILDERS — all use breakdown as source of truth
// ============================================================================

export function buildInvoiceData(data: OrderDocumentData): InvoiceDataV2 {
  const { order, profile, account, billingInvoice, billingInvoiceLines, billingPayments = [], breakdown } = data;
  const addr = buildCustomerAddress(order, profile, account);
  const paymentMethod = resolvePaymentMethod(order, billingPayments);
  const clientName = buildClientName(order, profile);

  // BREAKDOWN IS MANDATORY — no fallback path
  if (!breakdown) {
    throw new Error("[DocumentBuilder] ⛔ compute_invoice_breakdown RPC requis. Génération bloquée sans données autoritaires.");
  }
  const structured = structureFromBreakdown(breakdown, order);

  const invoiceStatus = breakdown?.status || billingInvoice?.status ||
    (["captured", "paid", "confirmed"].includes(order.payment_status) ? "paid" : "unpaid");

  // Use snapshot data if available
  const snapshotClient = billingInvoice?.billing_snapshot_client as any;
  const snapshotAccountNumber = billingInvoice?.billing_snapshot_account_number;

  const invoiceData: InvoiceDataV2 = {
    invoice_type: order.category === "Delivery" || !structured.invoiceItems.some(i => i.is_recurring) ? "ONETIME" : "MONTHLY",
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

    items: structured.invoiceItems.map(item => ({
      ...item,
      service_address: item.service_address || addr.service || undefined,
      reference: order.order_number?.toString(),
    })),

    discounts: structured.discounts.length > 0 ? structured.discounts.map(d => ({
      label: d.label,
      amount: d.amount,
      applies_to: "services",
    })) : [],

    subtotal: structured.subtotal,
    subtotal_monthly: structured.subtotalMonthly,
    subtotal_onetime: structured.subtotalOnetime,
    taxes: {
      gst_rate: TAX.GST_RATE,
      gst_amount: structured.tpsAmount,
      qst_rate: TAX.QST_RATE,
      qst_amount: structured.tvqAmount,
    },
    total: structured.total,
    balance_due: structured.balanceDue,

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
      : structured.amountPaid > 0
        ? [{
            method: paymentMethod || "Interac",
            status: "Confirmed" as const,
            paid_amount: structured.amountPaid,
            paid_at: order.paid_at || billingInvoice?.paid_at || order.updated_at,
            payment_reference: order.payment_reference || "—",
            processor_txn_id: order.paypal_capture_id || order.provider_payment_id,
          }]
        : [],
    payments_total: structured.amountPaid,
  };

  (invoiceData as any).order_number = order.order_number?.toString();
  return invoiceData;
}

export function buildOrderSummaryData(data: OrderDocumentData): OrderSummaryV3Data {
  const { order, profile, account, billingInvoice, billingInvoiceLines, billingPayments = [], breakdown } = data;
  const addr = buildCustomerAddress(order, profile, account);
  const paymentMethod = resolvePaymentMethod(order, billingPayments);
  const clientName = buildClientName(order, profile);

  if (!breakdown) {
    throw new Error("[DocumentBuilder] ⛔ compute_invoice_breakdown RPC requis pour le sommaire de commande.");
  }
  const structured = structureFromBreakdown(breakdown, order);

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
    services: structured.services.map(s => ({
      type: s.type, name: s.name, description: s.description,
      monthly_price: s.monthly_price, addons: s.addons,
      promo: s.promo, phone_number: s.phone_number,
      activation_date: s.activation_date,
    })),
    equipment: structured.equipment.map(e => ({ name: e.name, quantity: e.quantity, unit_price: e.unit_price, serial: e.serial })),
    fees: structured.fees,
    subtotal_monthly: structured.subtotalMonthly,
    subtotal_onetime: structured.subtotalOnetime,
    discount_amount: structured.discountAmount,
    discount_label: order.promo_code ? `Promo: ${order.promo_code}` : undefined,
    tax_gst: structured.tpsAmount,
    tax_qst: structured.tvqAmount,
    total_due: structured.total,
    payment_method: paymentMethod,
    payment_status: order.payment_status,
    estimated_activation: order.estimated_activation,
  };
}

export function buildContractData(data: OrderDocumentData): ContractDataV3 {
  const { order, profile, account, contract, billingInvoice, billingInvoiceLines, billingPayments = [], breakdown } = data;
  const addr = buildCustomerAddress(order, profile, account);
  const paymentMethod = resolvePaymentMethod(order, billingPayments);
  const clientName = buildClientName(order, profile);

  if (!breakdown) {
    throw new Error("[DocumentBuilder] ⛔ compute_invoice_breakdown RPC requis pour le contrat.");
  }
  const structured = structureFromBreakdown(breakdown, order);

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
    services: structured.services,
    equipment: structured.equipment,
    one_time_fees: structured.fees,
    subtotal_monthly: structured.subtotalMonthly,
    subtotal_one_time: structured.subtotalOnetime,
    discount_amount: structured.discountAmount,
    tax_gst: structured.tpsAmount,
    tax_qst: structured.tvqAmount,
    total_due_today: structured.total,
    payment_method: paymentMethod,
    is_signed: contract?.is_signed || contract?.status === "signed_by_client" || contract?.status === "fully_signed",
    signature_name: contract?.client_signer_name || clientName,
    signature_date: contract?.client_signed_at || contract?.signed_at,
    signature_ip: contract?.client_ip,
    admin_signature_name: contract?.admin_signer_name,
    admin_signature_date: contract?.admin_signed_at,
  };
}

export function buildContractSummaryData(data: OrderDocumentData): ContractSummaryData {
  const { order, profile, account, contract, billingInvoice, billingInvoiceLines, billingPayments = [], breakdown } = data;
  const addr = buildCustomerAddress(order, profile, account);
  const paymentMethod = resolvePaymentMethod(order, billingPayments);
  const clientName = buildClientName(order, profile);

  if (!breakdown) {
    throw new Error("[DocumentBuilder] ⛔ compute_invoice_breakdown RPC requis pour le résumé de contrat.");
  }
  const structured = structureFromBreakdown(breakdown, order);

  const allOneTimeFees = [
    ...structured.equipment.map(e => ({ label: e.name, amount: e.unit_price * e.quantity })),
    ...structured.fees,
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
    services: structured.services.map(s => ({ type: s.type, name: s.name, monthly_price: s.monthly_price })),
    one_time_fees: allOneTimeFees,
    subtotal_monthly: structured.subtotalMonthly,
    subtotal_one_time: structured.subtotalOnetime,
    discount_amount: structured.discountAmount,
    tax_gst: structured.tpsAmount,
    tax_qst: structured.tvqAmount,
    total_due_today: structured.total,
    payment_method: requireField(paymentMethod, "payment_method"),
    bill_cycle_day: account?.billing_cycle_day || undefined,
    activation_date: order.estimated_activation,
  };
}

// ============================================================================
// MAIN PIPELINE
// ============================================================================

export async function generateOrderDocuments(orderId: string): Promise<OrderDocuments | null> {
  console.log(`[DocumentBuilder V4] Generating documents for order: ${orderId}`);

  const data = await fetchOrderDocumentData(orderId);
  if (!data) {
    console.error("[DocumentBuilder] Could not fetch order data");
    return null;
  }

  // VALIDATION GATE: Warn about missing fields but DO NOT block generation
  // Documents must still be viewable even with partial data
  const missingFields = validateDocumentData(data);
  if (missingFields.length > 0) {
    console.warn(`[DocumentBuilder] ⚠️ Champs manquants (non bloquant): ${missingFields.join(", ")}`);
    // Log alert for admin awareness, but continue generation
    try {
      await supabase.from("billing_system_alerts").insert({
        alert_type: "pdf_missing_data_warning",
        entity_type: "order",
        entity_id: orderId,
        details: { missing_fields: missingFields, order_id: orderId, order_number: data.order?.order_number },
      });
    } catch (alertErr) {
      console.error("[DocumentBuilder] Could not create alert:", alertErr);
    }
    // Continue generation — documents will show "Non fourni par le client" for missing fields
  }

  if (!data.breakdown) {
    console.error(`[DocumentBuilder V4] ⛔ compute_invoice_breakdown RPC a échoué — génération BLOQUÉE`);
    const blockedResult: PDFGenerationResult = { success: false, error: "Données de facturation indisponibles (RPC breakdown requis)" };
    return {
      invoice: blockedResult,
      orderSummary: blockedResult,
      contract: blockedResult,
      contractSummary: blockedResult,
      terms: generateServiceTermsPDF(),
    };
  }

  console.log(`[DocumentBuilder V4] ✅ Using compute_invoice_breakdown RPC (source of truth)`);

  const invoiceData = buildInvoiceData(data);
  const invoice = generateInvoiceV3PDF(invoiceData);

  const orderSummaryData = buildOrderSummaryData(data);
  const orderSummary = generateOrderSummaryPDF(orderSummaryData);

  const contractData = buildContractData(data);
  const contract = generateContractV3PDF(contractData);

  const contractSummaryData = buildContractSummaryData(data);
  const contractSummary = generateContractSummaryPDF(contractSummaryData);

  const terms = generateServiceTermsPDF();

  console.log(`[DocumentBuilder V4] Generated: invoice=${invoice.success}, summary=${orderSummary.success}, contract=${contract.success}, rre=${contractSummary.success}, terms=${terms.success}`);

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
