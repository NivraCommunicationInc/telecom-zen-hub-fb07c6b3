import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
// LOCKED PDF TEMPLATES — approved production designs, DO NOT replace with pdfGenerator.ts
import { generateInvoiceV3PDF } from "../_shared/locked-pdf/invoiceTemplateV3.ts";
import { generateReceiptPDF } from "../_shared/locked-pdf/receiptTemplate.ts";
import { generateContractV3PDF } from "../_shared/locked-pdf/contractTemplateV3.ts";
import { generateOrderSummaryPDF } from "../_shared/locked-pdf/orderSummaryTemplate.ts";
import type { InvoiceDataV2 } from "../_shared/locked-pdf/types.ts";
import type { ReceiptData as LockedReceiptData } from "../_shared/locked-pdf/receiptTemplate.ts";
import type { ContractDataV3 } from "../_shared/locked-pdf/contractTemplateV3.ts";
import type { OrderSummaryV3Data } from "../_shared/locked-pdf/orderSummaryTemplate.ts";

type PDFType = "invoice" | "receipt" | "contract" | "summary";

interface PDFAttachment {
  filename: string;
  content: string;
}

interface EmailQueueItem {
  id: string;
  event_key: string;
  to_email: string;
  template_key: string;
  template_vars: Record<string, any>;
  status: string;
  attempts: number;
  max_attempts: number;
}

// Templates that should include PDF attachments
// Single-type attachment templates (strict one-email -> one-PDF mapping)
const PDF_ATTACHMENT_TEMPLATES: Record<string, 'invoice' | 'receipt' | 'contract' | 'summary'> = {
  'invoice_created': 'invoice',
  'billing_new_invoice': 'invoice',
  'renewal_invoice_created': 'invoice',
  'contract_ready': 'contract',
  'contract_signed': 'contract',
  'contract_ready_for_signature': 'contract',
  'order_submitted': 'summary',
  'order_confirmation': 'summary',
  'payment_receipt': 'receipt',
  'payment_confirmed': 'receipt',
  'payment_received': 'receipt',
  'invoice_paid': 'receipt',
};

// Full bundle disabled by default to avoid wrong attachment routing per template.
const FULL_DOCUMENT_SET_TEMPLATES = new Set<string>([]);

// Validate required client fields for PDF generation
function validatePDFClientData(vars: Record<string, any>): { valid: boolean; missing: string[] } {
  const missing: string[] = [];
  const name = vars.client_name || vars.name;
  const email = vars.client_email || vars.email;
  const phone = vars.client_phone || vars.phone;
  const address = vars.client_address || vars.address || vars.service_address;
  
  if (!name || name === 'Client' || name.trim() === '') missing.push('client_name');
  if (!email || email.trim() === '') missing.push('client_email');
  if (!phone || phone.trim() === '') missing.push('client_phone');
  if (!address || address.trim() === '') missing.push('client_address');
  
  return { valid: missing.length === 0, missing };
}

// ============================================================================
// LOCKED PDF BRIDGE — Maps template_vars → locked template interfaces
// Uses ONLY: generateInvoiceV3PDF, generateReceiptPDF, generateContractV3PDF, generateOrderSummaryPDF
// These are the APPROVED production templates. DO NOT replace with any other generator.
// ============================================================================

const n = (v: unknown): number => { const x = Number(v); return Number.isFinite(x) ? x : 0; };

const blobToBase64 = async (blob: Blob): Promise<string> => {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
};

function buildInvoiceData(vars: Record<string, any>): InvoiceDataV2 {
  const total = n(vars.total_payable ?? vars.canonical_total_payable ?? vars.total ?? vars.amount);
  const subtotal = n(vars.subtotal ?? vars.taxable_base ?? vars.canonical_subtotal ?? total);
  const tps = n(vars.tps_amount ?? vars.tps ?? vars.canonical_tps_amount);
  const tvq = n(vars.tvq_amount ?? vars.tvq ?? vars.canonical_tvq_amount);
  const balanceDue = n(vars.amount_due_today ?? vars.balance_due ?? vars.canonical_balance_due ?? total);
  const discountAmt = n(vars.discount_amount);
  const addr = (vars.client_address || vars.address || vars.service_address || "").split(",").map((s: string) => s.trim());

  const sourceItems = vars.items || vars.billed_items || vars.services || [];
  const items = (Array.isArray(sourceItems) ? sourceItems : []).map((it: any) => ({
    category: (it.category || it.type || "Other") as any,
    description: it.description || it.name || it.label || "Service Nivra",
    period: it.period,
    qty: Math.max(1, n(it.qty ?? it.quantity ?? 1)),
    unit_price: n(it.unit_price ?? it.price ?? it.monthly_price ?? it.amount),
    amount: n(it.amount ?? it.line_total ?? it.total ?? it.monthly_price ?? it.price),
    is_recurring: Boolean(it.is_recurring ?? true),
  }));
  if (items.length === 0) items.push({ category: "Other" as any, description: vars.service_type || "Service Nivra", qty: 1, unit_price: subtotal, amount: subtotal, is_recurring: true });

  return {
    invoice_type: "ONETIME",
    invoice_number: vars.invoice_number || vars.invoiceNumber || `NV-${Date.now()}`,
    invoice_date: vars.invoice_date || vars.created_at || new Date().toISOString(),
    due_date: vars.due_date || vars.dueDate || new Date(Date.now() + 15*86400000).toISOString(),
    account_number: vars.account_number || vars.client_number || "",
    billing_period_start: vars.period_start || vars.billing_period_start,
    billing_period_end: vars.period_end || vars.billing_period_end,
    currency: "CAD",
    status: (vars.invoice_status || vars.status || "pending") as any,
    customer: {
      full_name: vars.client_name || vars.name || "Client",
      email: vars.client_email || vars.email || "",
      phone: vars.client_phone || vars.phone,
      address_line1: addr[0] || "—",
      city: vars.client_city || addr[1] || "Laval",
      province: vars.client_province || addr[2] || "QC",
      postal_code: vars.client_postal_code || addr[3] || "",
    },
    items,
    discounts: discountAmt > 0 ? [{ label: vars.discount_label || "Rabais", amount: discountAmt }] : [],
    subtotal,
    taxes: { gst_rate: 0.05, gst_amount: tps, qst_rate: 0.09975, qst_amount: tvq },
    total,
    balance_due: balanceDue,
    payments_total: n(vars.amount_paid_today ?? vars.amount_paid),
  };
}

function buildReceiptData(vars: Record<string, any>): LockedReceiptData {
  return {
    receipt_number: vars.payment_number || vars.receipt_number || `REC-${Date.now()}`,
    payment_date: vars.paid_at || vars.payment_date || new Date().toISOString(),
    payment_method: vars.payment_method || "paypal",
    amount_paid: n(vars.amount_paid_today ?? vars.canonical_amount_paid_today ?? vars.amount_paid ?? vars.amount ?? vars.total_payable),
    invoice_number: vars.invoice_number || "",
    invoice_total: n(vars.invoice_total ?? vars.total_payable ?? vars.total),
    order_number: vars.order_number || vars.order_id,
    client_name: vars.client_name || vars.name || "Client",
    client_email: vars.client_email || vars.email || "",
    client_phone: vars.client_phone || vars.phone,
    client_address: vars.client_address || vars.address,
    account_number: vars.account_number || vars.client_number || "",
    billed_items: Array.isArray(vars.billed_items) ? vars.billed_items.map((it: any) => ({
      description: it.description || it.name || "Service",
      amount: n(it.amount ?? it.line_total),
    })) : undefined,
    transaction_reference: vars.payment_reference || vars.reference || vars.transaction_reference,
    balance_remaining: n(vars.balance_remaining ?? vars.balance_due),
    subtotal: n(vars.subtotal ?? vars.taxable_base),
    discount_label: vars.discount_label || (n(vars.discount_amount) > 0 ? "Rabais" : undefined),
    discount_amount: n(vars.discount_amount) || undefined,
    tps_amount: n(vars.tps_amount ?? vars.tps),
    tvq_amount: n(vars.tvq_amount ?? vars.tvq),
  };
}

function buildContractData(vars: Record<string, any>): ContractDataV3 {
  return {
    contract_number: vars.contract_number || `CTR-${Date.now()}`,
    contract_date: vars.contract_date || vars.effective_date || vars.created_at || new Date().toISOString(),
    terms_version: vars.terms_version || "v5.0",
    client_name: vars.client_name || vars.name || "Client",
    client_email: vars.client_email || vars.email || "",
    client_phone: vars.client_phone || vars.phone || "—",
    client_dob: vars.client_dob,
    billing_address: vars.billing_address || vars.client_address || vars.address || "—",
    service_address: vars.service_address || vars.client_address || vars.address || "—",
    account_number: vars.account_number || vars.client_number || "—",
    order_number: vars.order_number || vars.order_id || "—",
    services: vars.services || [{ type: "Internet", name: vars.service_type || "Service Nivra", monthly_price: n(vars.monthly_amount) }],
    equipment: vars.equipment || [],
    one_time_fees: vars.one_time_fees || vars.fees || [],
    subtotal_monthly: n(vars.subtotal_monthly ?? vars.monthly_amount ?? vars.monthly_recurring_amount),
    subtotal_one_time: n(vars.subtotal_one_time ?? vars.one_time_charges ?? vars.total_one_time),
    discount_amount: n(vars.discount_amount),
    tax_gst: n(vars.tax_gst ?? vars.tps_amount ?? vars.tps),
    tax_qst: n(vars.tax_qst ?? vars.tvq_amount ?? vars.tvq),
    total_due_today: n(vars.total_due_today ?? vars.amount_paid_today ?? vars.total_payable ?? vars.total),
    payment_method: vars.payment_method,
    signature_name: vars.signature_name,
    signature_date: vars.signature_date,
    signature_ip: vars.signature_ip,
    is_signed: Boolean(vars.is_signed ?? false),
    discount_label: vars.discount_label,
  };
}

function buildSummaryData(vars: Record<string, any>): OrderSummaryV3Data {
  const total = n(vars.total_payable ?? vars.canonical_total_payable ?? vars.total ?? vars.amount_paid_today);
  return {
    order_number: vars.order_number || vars.order_id?.substring(0, 8) || "—",
    order_date: vars.order_date || vars.created_at || new Date().toISOString(),
    order_status: vars.order_status || vars.status || "submitted",
    client_name: vars.client_name || vars.name || "Client",
    client_email: vars.client_email || vars.email || "",
    client_phone: vars.client_phone || vars.phone || "—",
    service_address: vars.service_address || vars.client_address || vars.address || "—",
    account_number: vars.account_number || vars.client_number || "—",
    services: vars.services || [{ type: "Internet", name: vars.service_type || "Service Nivra", monthly_price: n(vars.monthly_recurring_amount ?? vars.monthly_amount) }],
    equipment: vars.equipment || [],
    fees: vars.fees || [],
    subtotal_monthly: n(vars.monthly_recurring_amount ?? vars.subtotal_monthly ?? vars.subtotal_recurring ?? vars.monthly_amount),
    subtotal_onetime: n(vars.one_time_charges ?? vars.subtotal_onetime ?? vars.subtotal_one_time),
    discount_amount: n(vars.discount_amount),
    discount_label: vars.discount_label,
    tax_gst: n(vars.tps_amount ?? vars.tps ?? vars.canonical_tps_amount),
    tax_qst: n(vars.tvq_amount ?? vars.tvq ?? vars.canonical_tvq_amount),
    total_due: total,
    delivery_method: vars.delivery_method,
    payment_method: vars.payment_method,
    payment_status: vars.payment_status,
    estimated_activation: vars.estimated_activation || vars.installation_date || vars.scheduled_at,
  };
}

// Generate a single PDF using the LOCKED templates and return base64 for Resend attachment
async function lockedPdfToAttachment(
  pdfType: PDFType,
  data: InvoiceDataV2 | LockedReceiptData | ContractDataV3 | OrderSummaryV3Data,
): Promise<PDFAttachment | null> {
  const result =
    pdfType === "invoice" ? generateInvoiceV3PDF(data as InvoiceDataV2)
    : pdfType === "receipt" ? generateReceiptPDF(data as LockedReceiptData)
    : pdfType === "contract" ? generateContractV3PDF(data as ContractDataV3)
    : generateOrderSummaryPDF(data as OrderSummaryV3Data);

  if (!result.success || !result.blob) {
    console.error(`[LOCKED PDF] ${pdfType} generation failed:`, result.error);
    return null;
  }
  return { filename: result.filename || `Nivra-${pdfType}.pdf`, content: await blobToBase64(result.blob) };
}

// Generate ALL 4 PDFs for full document set
async function generateFullDocumentSet(vars: Record<string, any>): Promise<Array<{ filename: string; content: string }>> {
  const validation = validatePDFClientData(vars);
  if (!validation.valid) {
    console.warn(`[PDF Safety] Missing client fields for full doc set: ${validation.missing.join(', ')}. Skipping.`);
    return [];
  }
  const attachments: Array<{ filename: string; content: string }> = [];
  for (const [type, builder] of [
    ["invoice", buildInvoiceData],
    ["receipt", buildReceiptData],
    ["contract", buildContractData],
    ["summary", buildSummaryData],
  ] as const) {
    try {
      const pdf = await lockedPdfToAttachment(type as PDFType, (builder as any)(vars));
      if (pdf) attachments.push(pdf);
    } catch (e) { console.error(`[PDF] ${type} failed:`, e); }
  }
  return attachments;
}

// Generate single PDF attachment for a specific email template
async function generateEmailPDFAttachment(templateKey: string, vars: Record<string, any>): Promise<PDFAttachment | null> {
  const pdfType = PDF_ATTACHMENT_TEMPLATES[templateKey];
  if (!pdfType) return null;
  const validation = validatePDFClientData(vars);
  if (!validation.valid) {
    console.warn(`[PDF Safety] Missing fields for ${templateKey}: ${validation.missing.join(', ')}. Skipping.`);
    return null;
  }
  try {
    const builders: Record<string, () => any> = {
      invoice: () => buildInvoiceData(vars),
      receipt: () => buildReceiptData(vars),
      contract: () => buildContractData(vars),
      summary: () => buildSummaryData(vars),
    };
    return await lockedPdfToAttachment(pdfType, builders[pdfType]());
  } catch (error) {
    console.error(`[PDF] Error for ${templateKey}:`, error);
    return null;
  }
}

// =============================================
// SHARED EMAIL LAYOUT COMPONENTS
// =============================================

import { emailStyles, formatCurrency, formatDate, joinUrl, wrapEmail, detailsCard, statusBadge, greeting, emailTemplates } from "../_shared/email-templates.ts";
import type { EmailConfig } from "../_shared/email-templates.ts";

const toMoney = (value: unknown): number | null => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
};

const PAYMENT_AMOUNT_TEMPLATES = new Set([
  "payment_confirmed",
  "payment_received",
  "payment_receipt",
  "invoice_paid",
]);

const ORDER_CONFIRMATION_TEMPLATES = new Set([
  "order_submitted",
  "order_confirmation",
]);

const DUE_AMOUNT_TEMPLATES = new Set([
  "invoice_created",
  "invoice_overdue",
  "payment_reminder_1day",
  "payment_due_today",
  "payment_overdue_1day",
  "service_suspension_warning",
  "renewal_invoice_created",
]);

async function resolveCanonicalFinancialVars(
  supabase: ReturnType<typeof createClient>,
  emailRow: Record<string, any>,
  templateKey: string,
  incomingVars: Record<string, any>,
): Promise<Record<string, any>> {
  const vars = { ...incomingVars };

  try {
    const invoiceIdFromEntity = emailRow.entity_type === "invoice" ? emailRow.entity_id : null;
    const orderIdFromEntity = emailRow.entity_type === "order" ? emailRow.entity_id : null;

    const requestedInvoiceId = String(vars.invoice_id || invoiceIdFromEntity || "").trim();
    const requestedInvoiceNumber = String(vars.invoice_number || "").trim();
    const requestedOrderId = String(vars.order_id || orderIdFromEntity || "").trim();
    const requestedOrderNumber = String(vars.order_number || "").trim();
    const paymentRef = String(vars.payment_reference || vars.reference || "").trim();

    let invoice: Record<string, any> | null = null;
    let order: Record<string, any> | null = null;
    let payment: Record<string, any> | null = null;

    if (requestedInvoiceId) {
      const { data } = await supabase
        .from("billing_invoices")
        .select("id, order_id, invoice_number, subtotal, tps_amount, tvq_amount, total, amount_paid, balance_due, status, due_date")
        .eq("id", requestedInvoiceId)
        .maybeSingle();
      invoice = data as Record<string, any> | null;
    }

    if (!invoice && requestedInvoiceNumber) {
      const { data } = await supabase
        .from("billing_invoices")
        .select("id, order_id, invoice_number, subtotal, tps_amount, tvq_amount, total, amount_paid, balance_due, status, due_date")
        .eq("invoice_number", requestedInvoiceNumber)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      invoice = data as Record<string, any> | null;
    }

    if (!invoice && requestedOrderId) {
      const { data } = await supabase
        .from("billing_invoices")
        .select("id, order_id, invoice_number, subtotal, tps_amount, tvq_amount, total, amount_paid, balance_due, status, due_date")
        .eq("order_id", requestedOrderId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      invoice = data as Record<string, any> | null;
    }

    const resolvedOrderId = requestedOrderId || String(invoice?.order_id || "").trim();

    if (resolvedOrderId) {
      const { data } = await supabase
        .from("orders")
        .select("id, order_number, total_amount, payment_method, payment_reference, pricing_snapshot")
        .eq("id", resolvedOrderId)
        .maybeSingle();
      order = data as Record<string, any> | null;
    }

    if (!order && requestedOrderNumber) {
      const { data } = await supabase
        .from("orders")
        .select("id, order_number, total_amount, payment_method, payment_reference, pricing_snapshot")
        .eq("order_number", requestedOrderNumber)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      order = data as Record<string, any> | null;
    }

    const invoiceId = String(invoice?.id || "").trim();
    if (invoiceId) {
      const { data: payments } = await supabase
        .from("billing_payments")
        .select("amount, method, payment_number, reference, provider_payment_id, status, created_at")
        .eq("invoice_id", invoiceId)
        .order("created_at", { ascending: false })
        .limit(10);

      const paymentRows = (payments || []) as Record<string, any>[];
      payment = paymentRows.find((p) =>
        paymentRef && (p.provider_payment_id === paymentRef || p.reference === paymentRef)
      )
        || paymentRows.find((p) => ["confirmed", "completed"].includes(String(p.status || "")))
        || paymentRows[0]
        || null;
    }

    const snapshot = (order?.pricing_snapshot || {}) as Record<string, any>;
    const promoDiscount = toMoney(snapshot?.promo_discount) || 0;
    const welcomeDiscount = toMoney(snapshot?.welcome_discount) || 0;

    const canonicalSubtotal = toMoney(snapshot?.taxable_base ?? snapshot?.subtotal ?? invoice?.subtotal ?? vars.subtotal);
    const canonicalTps = toMoney(snapshot?.tps_amount ?? invoice?.tps_amount ?? vars.tps_amount ?? vars.tps);
    const canonicalTvq = toMoney(snapshot?.tvq_amount ?? invoice?.tvq_amount ?? vars.tvq_amount ?? vars.tvq);
    const canonicalDiscount = toMoney(snapshot?.discount_total_combined ?? (promoDiscount + welcomeDiscount) ?? vars.discount_amount);
    const canonicalRecurring = toMoney(snapshot?.recurring_subtotal ?? vars.monthly_recurring_amount);
    const canonicalOneTime = toMoney(snapshot?.one_time_subtotal ?? vars.one_time_charges ?? vars.one_time_total);

    const canonicalTotalPayable = toMoney(
      invoice?.total ??
      snapshot?.grand_total ??
      order?.total_amount ??
      vars.total_payable ??
      vars.canonical_total_payable ??
      vars.total ??
      vars.amount,
    );

    const canonicalAmountPaidTotal = toMoney(
      invoice?.amount_paid ?? vars.amount_paid_total ?? vars.canonical_amount_paid_total,
    );

    const canonicalAmountDue = toMoney(
      invoice?.balance_due ??
      vars.amount_due_today ??
      vars.balance_due ??
      ((canonicalTotalPayable || 0) - (canonicalAmountPaidTotal || 0)),
    );

    const canonicalAmountPaidToday = ORDER_CONFIRMATION_TEMPLATES.has(templateKey)
      ? toMoney(payment?.amount ?? canonicalAmountPaidTotal ?? canonicalTotalPayable ?? vars.amount_paid_today ?? vars.amount_paid)
      : toMoney(
        payment?.amount ??
        vars.amount_paid_today ??
        vars.amount_paid ??
        (PAYMENT_AMOUNT_TEMPLATES.has(templateKey)
          ? (canonicalAmountPaidTotal ?? canonicalTotalPayable)
          : null),
      );

    const merged: Record<string, any> = {
      ...vars,
      order_id: vars.order_id || order?.id || invoice?.order_id || undefined,
      order_number: vars.order_number || order?.order_number || undefined,
      invoice_id: vars.invoice_id || invoice?.id || undefined,
      invoice_number: vars.invoice_number || invoice?.invoice_number || undefined,
      payment_method: vars.payment_method || payment?.method || order?.payment_method || undefined,
      payment_reference: vars.payment_reference || vars.reference || payment?.provider_payment_id || payment?.reference || order?.payment_reference || undefined,
      reference: vars.reference || payment?.provider_payment_id || payment?.reference || order?.payment_reference || undefined,
      subtotal: canonicalSubtotal ?? vars.subtotal,
      tps_amount: canonicalTps ?? vars.tps_amount,
      tvq_amount: canonicalTvq ?? vars.tvq_amount,
      taxes_total: toMoney((canonicalTps || 0) + (canonicalTvq || 0)),
      discount_amount: canonicalDiscount ?? vars.discount_amount,
      monthly_recurring_amount: canonicalRecurring ?? vars.monthly_recurring_amount,
      one_time_charges: canonicalOneTime ?? vars.one_time_charges ?? vars.one_time_total,
      total_payable: canonicalTotalPayable ?? vars.total_payable,
      canonical_total_payable: canonicalTotalPayable,
      amount_paid_total: canonicalAmountPaidTotal ?? vars.amount_paid_total,
      canonical_amount_paid_total: canonicalAmountPaidTotal,
      amount_paid_today: canonicalAmountPaidToday ?? vars.amount_paid_today,
      canonical_amount_paid_today: canonicalAmountPaidToday,
      amount_due_today: canonicalAmountDue ?? vars.amount_due_today,
      canonical_balance_due: canonicalAmountDue,
      total_amount: ORDER_CONFIRMATION_TEMPLATES.has(templateKey)
        ? (canonicalAmountPaidToday ?? canonicalTotalPayable ?? vars.total_amount)
        : vars.total_amount,
    };

    if (PAYMENT_AMOUNT_TEMPLATES.has(templateKey)) {
      merged.amount = canonicalAmountPaidToday ?? canonicalAmountPaidTotal ?? canonicalTotalPayable ?? vars.amount;
      merged.total = canonicalTotalPayable ?? vars.total;
      merged.balance_due = canonicalAmountDue ?? vars.balance_due;
    } else if (DUE_AMOUNT_TEMPLATES.has(templateKey)) {
      merged.amount = canonicalAmountDue ?? canonicalTotalPayable ?? vars.amount;
      merged.total = canonicalTotalPayable ?? vars.total;
      merged.balance_due = canonicalAmountDue ?? vars.balance_due;
    }

    return merged;
  } catch (error) {
    console.error("[email-canonical-financial] Failed to enrich template vars:", error);
    return vars;
  }
}

// =============================================
// CLIENT DATA ENRICHMENT FOR PDF ATTACHMENTS
// Fetches missing client fields (phone, address) from DB
// so validatePDFClientData() doesn't silently skip PDFs.
// =============================================
async function enrichClientDataForPDF(
  supabase: ReturnType<typeof createClient>,
  vars: Record<string, any>,
  templateKey: string,
): Promise<Record<string, any>> {
  // Only enrich for templates that need PDF attachments
  const pdfType = PDF_ATTACHMENT_TEMPLATES[templateKey];
  if (!pdfType && !FULL_DOCUMENT_SET_TEMPLATES.has(templateKey)) return vars;

  const hasPhone = !!(vars.client_phone || vars.phone);
  const hasAddress = !!(vars.client_address || vars.address || vars.service_address);
  const hasEmail = !!(vars.client_email || vars.email);

  // If all fields present, skip lookup
  if (hasPhone && hasAddress && hasEmail) return vars;

  const enriched = { ...vars };

  try {
    // Strategy 1: Look up billing_customer via invoice
    const invoiceId = vars.invoice_id;
    const invoiceNumber = vars.invoice_number;
    let customerId: string | null = null;

    if (invoiceId) {
      const { data: inv } = await supabase
        .from("billing_invoices")
        .select("customer_id")
        .eq("id", invoiceId)
        .maybeSingle();
      customerId = inv?.customer_id || null;
    }
    if (!customerId && invoiceNumber) {
      const { data: inv } = await supabase
        .from("billing_invoices")
        .select("customer_id")
        .eq("invoice_number", invoiceNumber)
        .maybeSingle();
      customerId = inv?.customer_id || null;
    }

    if (customerId) {
      const { data: cust } = await supabase
        .from("billing_customers")
        .select("email, phone, user_id")
        .eq("id", customerId)
        .maybeSingle();

      if (cust) {
        if (!hasEmail && cust.email) enriched.client_email = cust.email;
        if (!hasPhone && cust.phone) enriched.client_phone = cust.phone;

        // Look up profile for address if still missing
        if (!hasAddress && cust.user_id) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("address, city, province, postal_code")
            .eq("id", cust.user_id)
            .maybeSingle();
          if (profile?.address) {
            enriched.client_address = [profile.address, profile.city, profile.province, profile.postal_code].filter(Boolean).join(", ");
            if (profile.city) enriched.client_city = profile.city;
            if (profile.province) enriched.client_province = profile.province;
            if (profile.postal_code) enriched.client_postal_code = profile.postal_code;
          }
        }
      }
    }

    // Strategy 2: Look up via order → accounts → profiles
    if (!enriched.client_address && !enriched.service_address) {
      const orderId = vars.order_id;
      if (orderId) {
        const { data: order } = await supabase
          .from("orders")
          .select("user_id, service_address, service_city, service_postal_code")
          .eq("id", orderId)
          .maybeSingle();
        if (order?.service_address) {
          enriched.client_address = enriched.service_address = order.service_address;
          if (order.service_city) enriched.client_city = order.service_city;
          if (order.service_postal_code) enriched.client_postal_code = order.service_postal_code;
        }
        if (!hasPhone && order?.user_id) {
          const { data: prof } = await supabase
            .from("profiles")
            .select("phone, address, city, province, postal_code")
            .eq("id", order.user_id)
            .maybeSingle();
          if (prof?.phone && !enriched.client_phone) enriched.client_phone = prof.phone;
          if (prof?.address && !enriched.client_address) {
            enriched.client_address = [prof.address, prof.city, prof.province, prof.postal_code].filter(Boolean).join(", ");
          }
        }
      }
    }

    // Strategy 3: Look up via to_email as last resort
    if ((!enriched.client_phone || !enriched.client_address) && vars.to_email) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("phone, address, city, province, postal_code")
        .eq("email", vars.to_email)
        .maybeSingle();
      if (prof) {
        if (!enriched.client_phone && prof.phone) enriched.client_phone = prof.phone;
        if (!enriched.client_address && prof.address) {
          enriched.client_address = [prof.address, prof.city, prof.province, prof.postal_code].filter(Boolean).join(", ");
        }
      }
    }

    // Final fallback: use placeholder values so PDF is still generated
    // Better to send a PDF with "—" than no PDF at all
    if (!enriched.client_phone && !enriched.phone) enriched.client_phone = "—";
    if (!enriched.client_address && !enriched.address && !enriched.service_address) enriched.client_address = "—";
    if (!enriched.client_email && !enriched.email) enriched.client_email = vars.to_email || "—";

    console.log(`[PDF ENRICH] template=${templateKey} enriched: phone=${!!enriched.client_phone} address=${!!enriched.client_address} email=${!!enriched.client_email}`);
  } catch (err) {
    console.warn("[PDF ENRICH] Lookup failed, using fallbacks:", err);
    // Fallback so PDF still generates
    if (!enriched.client_phone && !enriched.phone) enriched.client_phone = "—";
    if (!enriched.client_address && !enriched.address && !enriched.service_address) enriched.client_address = "—";
    if (!enriched.client_email && !enriched.email) enriched.client_email = vars.to_email || "—";
  }

  return enriched;
}


// =============================================
// MAIN SERVER HANDLER
// =============================================

Deno.serve(async (req) => {
  const corsPreflightResponse = handleCorsPreflightRequest(req);
  if (corsPreflightResponse) return corsPreflightResponse;
  
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const emailFromAddress = "Nivra Telecom <support@nivra-telecom.ca>";
  const emailReplyTo = "support@nivra-telecom.ca";
  
  // Default values (fallback)
  const defaultSupportEmail = "support@nivra-telecom.ca";
  const defaultSupportPhone = "";
  const defaultAddress = "1799 Av. Pierre-Péladeau, Laval, QC H7T 2Y5";
  const defaultHours = "Lun–Ven : 9 h – 22 h | Sam–Dim : 9 h – 20 h";
  
  // Validate APP_BASE_URL - must be single valid URL, never ALLOWED_ORIGINS
  const rawAppBaseUrl = Deno.env.get("APP_BASE_URL");
  let appBaseUrl = "https://nivra-telecom.ca"; // Safe default
  
  if (rawAppBaseUrl) {
    // Check for comma (multiple URLs) or invalid URL format
    if (rawAppBaseUrl.includes(",")) {
      console.error(`[EMAIL CONFIG ERROR] APP_BASE_URL contains multiple URLs: "${rawAppBaseUrl}". Using fallback.`);
    } else {
      try {
        new URL(rawAppBaseUrl); // Validate URL format
        appBaseUrl = rawAppBaseUrl.replace(/\/+$/, ""); // Remove trailing slashes
      } catch {
        console.error(`[EMAIL CONFIG ERROR] APP_BASE_URL is not a valid URL: "${rawAppBaseUrl}". Using fallback.`);
      }
    }
  } else {
    console.warn("[EMAIL CONFIG] APP_BASE_URL not set, using fallback: https://nivra-telecom.ca");
  }

  if (!resendApiKey) {
    console.error("RESEND_API_KEY not configured");
    return new Response(JSON.stringify({ error: "Email service not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Load site_settings as source of truth for contact values
  let supportEmail = defaultSupportEmail;
  let supportPhone = defaultSupportPhone;
  let supportAddress = defaultAddress;
  let supportHours = defaultHours;
  
  try {
    const { data: settings, error: settingsError } = await supabase
      .from("site_settings")
      .select("key, value_text")
      .in("key", ["support_email", "support_phone", "address", "business_hours"])
      .eq("is_public", true);
    
    if (!settingsError && settings) {
      for (const row of settings) {
        if (row.key === "support_email" && row.value_text) {
          supportEmail = row.value_text;
        } else if (row.key === "support_phone" && row.value_text) {
          supportPhone = row.value_text;
        } else if (row.key === "address" && row.value_text) {
          supportAddress = row.value_text;
        } else if (row.key === "business_hours" && row.value_text) {
          supportHours = row.value_text;
        }
      }
      console.log("[EMAIL CONFIG] Loaded site_settings:", { supportEmail, supportPhone, supportAddress, supportHours });
    } else if (settingsError) {
      console.warn("[EMAIL CONFIG] Failed to load site_settings, using defaults:", settingsError.message);
    }
  } catch (e) {
    console.warn("[EMAIL CONFIG] Error loading site_settings, using defaults:", e);
  }
  
  const emailConfig: EmailConfig = {
    baseUrl: appBaseUrl,
    supportEmail,
  };

  try {
    // Check if this is a test email request
    const url = new URL(req.url);
    if (url.searchParams.get("test") === "true") {
      const body = await req.json();
      const testEmail = body.to_email;
      
      if (!testEmail) {
        return new Response(JSON.stringify({ error: "to_email required for test" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const template = emailTemplates.test_email;
      
      // Replace template variables in subject
      let subject = template.subject;
      
      const html = template.getHtml({ to_email: testEmail }, emailConfig);

      console.log(`Sending test email to: ${testEmail}`);

      const emailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resendApiKey}`,
        },
          body: JSON.stringify({
            from: emailFromAddress,
            reply_to: emailReplyTo,
            to: [testEmail],
            subject,
            html,
            text: `Nivra Telecom - Test email envoyé avec succès. Ceci est un test du système de courriels.`,
            headers: {
              "List-Unsubscribe": `<mailto:unsubscribe@nivra-telecom.ca?subject=unsubscribe>`,
              "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
              "X-Entity-Ref-ID": `test-${Date.now()}`,
            },
        }),
      });

      const result = await emailResponse.json();

      if (!emailResponse.ok) {
        console.error("Test email failed:", result);
        return new Response(JSON.stringify({ 
          success: false, 
          error: result.message || "Failed to send test email",
          details: result
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log("Test email sent successfully:", result);

      return new Response(JSON.stringify({
        success: true,
        recipient: testEmail,
        template: "test_email",
        provider_message_id: result.id,
        from: emailFromAddress,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Process email queue - fetch both 'queued' and 'pending' status
    const { data: queuedEmails, error: fetchError } = await supabase
      .from("email_queue")
      .select("*")
      .in("status", ["queued", "pending"])
      .or(`next_retry_at.is.null,next_retry_at.lte.${new Date().toISOString()}`)
      .order("created_at", { ascending: true })
      .limit(20);

    if (fetchError) {
      console.error("Error fetching email queue:", fetchError);
      throw fetchError;
    }

    console.log(`Processing ${queuedEmails?.length || 0} queued emails`);

    const results = [];

    for (const email of queuedEmails || []) {
      // Mark as processing
      await supabase
        .from("email_queue")
        .update({ status: "processing" })
        .eq("id", email.id);

      try {
        // TEMPLATE KEY ALIASES - map old keys to new professional templates
        const templateKeyAliases: Record<string, string> = {
          'order_confirmation': 'order_submitted',
          'order_confirmation_html': 'order_submitted',
          'nivra_order_confirmation_fr': 'order_submitted',
          'payment_received': 'payment_confirmed',
          'payment_receipt': 'payment_confirmed',
          'billing_new_invoice': 'invoice_created',
          'billing_payment_confirmed': 'payment_confirmed',
          'billing_renewal_reminder': 'invoice_overdue',
          // --- Missing templates mapped to existing ones ---
          'invoice_sent': 'invoice_created',
          'document_contract_sent': 'order_completed',
          'document_invoice_sent': 'invoice_created',
          'document_summary_sent': 'order_submitted',
          'document_terms_sent': 'order_submitted',
          'appointment_confirmed': 'order_processed',
          'shipment_created': 'shipping_created',
          'order_status_changed': 'order_processed',
          'all_documents_sent': 'order_completed',
        };
        
        // Support both template_key and template_type (Billing V2 uses template_type)
        const rawTemplateKey = email.template_key || email.template_type || 'unknown';
        const templateKey = templateKeyAliases[rawTemplateKey] || rawTemplateKey;
        
        // Support both template_vars and template_data (Billing V2 uses template_data)
        const rawTemplateVars = email.template_vars || email.template_data || {};
        const templateVars = await resolveCanonicalFinancialVars(
          supabase,
          email as Record<string, any>,
          templateKey,
          rawTemplateVars,
        );
        
        const template = emailTemplates[templateKey];
        
        if (!template) {
          console.warn(`Unknown template: ${rawTemplateKey} (resolved to: ${templateKey}), skipping...`);
          // Mark as failed with descriptive error
          await supabase
            .from("email_queue")
            .update({
              status: "failed",
              last_error: `Template inconnu: ${rawTemplateKey}`,
              attempts: email.attempts + 1,
            })
            .eq("id", email.id);
          results.push({ id: email.id, status: "failed", error: `Unknown template: ${rawTemplateKey}` });
          continue;
        }

        const html = template.getHtml(templateVars, emailConfig);
        
        // Replace template variables in subject
        // Subject: prefer override from template_vars (custom_html emails), then template default
        let subject = templateVars._subject || template.subject;
        const vars = templateVars;
        if (vars.order_number) subject = subject.replace('{{order_number}}', vars.order_number);
        if (vars.invoice_number) subject = subject.replace('{{invoice_number}}', vars.invoice_number);
        if (vars.ticket_number) subject = subject.replace('{{ticket_number}}', vars.ticket_number);
        if (vars.contract_number) subject = subject.replace('{{contract_number}}', vars.contract_number);
        if (vars.request_number) subject = subject.replace('{{request_number}}', vars.request_number);
        if (vars.dispute_number) subject = subject.replace('{{dispute_number}}', vars.dispute_number);

        // Plain text: prefer override, then auto-generate
        const plainText = templateVars._text || `${subject}\n\nPour voir ce message, ouvrez votre portail client Nivra Telecom.\nTo view this message, open your Nivra Telecom client portal.\n\nNivra Telecom - ${emailConfig.supportEmail}`;

        // Support from/reply-to overrides from template_vars (queued custom_html emails via ResendProxy)
        const effectiveFrom = templateVars._from_email || emailFromAddress;
        const effectiveReplyTo = templateVars._reply_to || emailReplyTo;

        // DOMAIN VALIDATION: Only allow verified Resend domains
        const ALLOWED_DOMAINS = ['nivra-telecom.ca', 'send.nivra-telecom.ca', 'nivra.ca', 'nivratelecom.ca', 'resend.dev'];
        
        // ROBUST EMAIL EXTRACTION: Handle various formats
        // - "Nivra Telecom <support@nivra-telecom.ca>"
        // - "support@nivra-telecom.ca"
        // - "Nivra <support@nivra-telecom.ca>" (with trailing chars)
        let actualEmail = effectiveFrom.trim();
        
        // Extract email from angle brackets if present
        const emailMatch = emailFromAddress.match(/<([^>]+)>/);
        if (emailMatch && emailMatch[1]) {
          actualEmail = emailMatch[1].trim();
        }
        
        // Clean any remaining special characters from the email
        actualEmail = actualEmail.replace(/[<>]/g, '').trim();
        
        // Extract domain (everything after the @ sign)
        const atIndex = actualEmail.lastIndexOf('@');
        let fromDomain = '';
        if (atIndex !== -1 && atIndex < actualEmail.length - 1) {
          fromDomain = actualEmail.substring(atIndex + 1).toLowerCase().trim();
          // Remove any trailing characters that might have slipped through
          fromDomain = fromDomain.replace(/[^a-z0-9.-]/g, '');
        }
        
        console.log(`[DOMAIN CHECK] From: "${emailFromAddress}" → Email: "${actualEmail}" → Domain: "${fromDomain}"`);
        
        if (!fromDomain || !ALLOWED_DOMAINS.some(d => fromDomain === d || fromDomain.endsWith('.' + d))) {
          const domainError = `BLOQUÉ: Domaine From non vérifié (${fromDomain}). Domaines autorisés: ${ALLOWED_DOMAINS.join(', ')}`;
          console.error(domainError);
          
          await supabase
            .from("email_queue")
            .update({
              status: "failed",
              last_error: domainError,
              attempts: email.attempts + 1,
              from_email: emailFromAddress,
              subject: subject,
            })
            .eq("id", email.id);
          
          results.push({ id: email.id, status: "failed", error: domainError });
          continue;
        }

        // Enrich client data for PDF generation (fetch missing phone/address from DB)
        const pdfVars = await enrichClientDataForPDF(supabase, templateVars, templateKey);

        // Generate attachments: passthrough > full document set > single PDF
        let attachments: Array<{ filename: string; content: string }> | undefined;
        if (pdfVars._attachments && Array.isArray(pdfVars._attachments)) {
          attachments = pdfVars._attachments;
          console.log(`[ATTACHMENTS PASSTHROUGH] email_id=${email.id} count=${attachments.length}`);
        } else if (FULL_DOCUMENT_SET_TEMPLATES.has(templateKey)) {
          const fullSet = await generateFullDocumentSet(pdfVars);
          if (fullSet.length > 0) {
            attachments = fullSet;
            console.log(`[FULL DOC SET] email_id=${email.id} files=${fullSet.map(f => f.filename).join(', ')}`);
          }
        } else {
          const pdfAttachment = await generateEmailPDFAttachment(templateKey, pdfVars);
          if (pdfAttachment) {
            attachments = [{
              filename: pdfAttachment.filename,
              content: pdfAttachment.content,
            }];
            console.log(`[PDF ATTACHED] email_id=${email.id} file=${pdfAttachment.filename}`);
          }
        }

        const emailPayload: Record<string, any> = {
          from: effectiveFrom,
          reply_to: effectiveReplyTo,
          to: [email.to_email],
          subject,
          html,
          text: plainText,
          headers: {
            "List-Unsubscribe": `<mailto:unsubscribe@nivra-telecom.ca?subject=unsubscribe>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            "X-Entity-Ref-ID": email.id,
            "Precedence": "bulk",
          },
        };
        
        // Add attachments if we have any
        if (attachments && attachments.length > 0) {
          emailPayload.attachments = attachments;
        }

        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify(emailPayload),
        });

        const result = await emailResponse.json();
        
        // Log full Resend response for diagnostics
        console.log(`[RESEND RESPONSE] email_id=${email.id}, response=`, JSON.stringify(result));

        if (!emailResponse.ok) {
          throw new Error(result.message || "Failed to send email");
        }

        // Mark as sent with full diagnostic data
        await supabase
          .from("email_queue")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            provider_message_id: result.id,
            provider_status: "sent",
            from_email: emailFromAddress,
            subject: subject,
            resend_response: result,
            attempts: email.attempts + 1,
          })
          .eq("id", email.id);

        results.push({ id: email.id, status: "sent", provider_id: result.id });
        console.log(`[EMAIL SENT] id=${email.id} to=${email.to_email} resend_id=${result.id}`);

      } catch (sendError: any) {
        const newAttempts = email.attempts + 1;
        const maxAttempts = email.max_attempts || 5;
        const nextStatus = newAttempts >= maxAttempts ? "failed" : "queued";
        
        // Exponential backoff: 1min, 2min, 4min, 8min, 16min
        const backoffMinutes = Math.pow(2, newAttempts - 1);
        const nextRetry = new Date(Date.now() + backoffMinutes * 60 * 1000).toISOString();

        await supabase
          .from("email_queue")
          .update({
            status: nextStatus,
            attempts: newAttempts,
            last_error: sendError.message,
            next_retry_at: nextRetry,
          })
          .eq("id", email.id);

        results.push({ id: email.id, status: nextStatus, error: sendError.message });
        console.error(`Email failed: ${email.id}`, sendError.message);
      }
    }

    // Cleanup old rate limits (ignore errors)
    try {
      await supabase.rpc("cleanup_old_rate_limits");
    } catch (e) {
      // Ignore cleanup errors
    }

    return new Response(JSON.stringify({
      success: true,
      processed: results.length,
      results,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    // Generate error ID for tracking without exposing details
    const errorId = `ERR-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().substring(0, 4).toUpperCase()}`;
    console.error(`[${errorId}] Error processing email queue:`, error);
    
    // Return generic error message with tracking ID
    const isProd = Deno.env.get("DENO_DEPLOYMENT_ID") !== undefined;
    const safeMessage = isProd 
      ? `Erreur serveur. (Réf: ${errorId})`
      : (error?.message || "Erreur inconnue");
    
    return new Response(JSON.stringify({ error: safeMessage, errorId }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
