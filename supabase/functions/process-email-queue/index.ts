import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { generatePDFAttachment, type PDFAttachment, type InvoiceData, type ContractData, type SummaryData, type ReceiptData } from "../_shared/pdfGenerator.ts";

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

// Build invoice data from template vars
function buildInvoiceData(vars: Record<string, any>): InvoiceData {
  const canonicalTotal = Number(vars.total_payable ?? vars.canonical_total_payable ?? vars.total ?? vars.amount ?? 0) || 0;
  const canonicalAmountDue = Number(vars.amount_due_today ?? vars.balance_due ?? vars.canonical_balance_due ?? canonicalTotal) || 0;
  const canonicalSubtotal = Number(vars.subtotal ?? vars.taxable_base ?? vars.canonical_subtotal ?? canonicalTotal) || 0;
  const canonicalTps = Number(vars.tps_amount ?? vars.tps ?? vars.canonical_tps_amount ?? 0) || 0;
  const canonicalTvq = Number(vars.tvq_amount ?? vars.tvq ?? vars.canonical_tvq_amount ?? 0) || 0;

  return {
    invoice_number: vars.invoice_number || vars.invoiceNumber || `NV-${Date.now()}`,
    invoice_date: vars.invoice_date || vars.created_at || new Date().toISOString(),
    due_date: vars.due_date || vars.dueDate || new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
    account_number: vars.account_number || vars.client_number || '',
    period_start: vars.period_start || '',
    period_end: vars.period_end || '',
    client_name: vars.client_name || vars.name || 'Client',
    client_email: vars.client_email || vars.email || '',
    client_phone: vars.client_phone || vars.phone || '',
    client_address: vars.client_address || vars.address || '',
    services: vars.services || [
      { name: vars.service_type || 'Service Nivra', description: 'Service mensuel', price: canonicalTotal }
    ],
    subtotal: canonicalSubtotal,
    discount_label: vars.discount_label || (vars.discount_amount ? 'Rabais' : undefined),
    discount_amount: Number(vars.discount_amount ?? 0) || undefined,
    tps: canonicalTps,
    tvq: canonicalTvq,
    total: canonicalTotal,
    previous_balance: vars.previous_balance || 0,
    payments: vars.payments || [],
    balance_due: canonicalAmountDue,
  };
}

// Build receipt data from template vars
function buildReceiptData(vars: Record<string, any>): ReceiptData {
  const amountPaid = Number(vars.amount_paid_today ?? vars.canonical_amount_paid_today ?? vars.amount_paid ?? vars.amount ?? vars.total_payable ?? 0) || 0;
  const subtotal = Number(vars.subtotal ?? vars.taxable_base ?? 0) || 0;
  const tps = Number(vars.tps_amount ?? vars.tps ?? 0) || 0;
  const tvq = Number(vars.tvq_amount ?? vars.tvq ?? 0) || 0;
  const total = Number(vars.total_payable ?? vars.canonical_total_payable ?? vars.total ?? amountPaid) || 0;

  return {
    receipt_number: vars.payment_number || vars.receipt_number || `REC-${Date.now()}`,
    receipt_date: vars.paid_at || vars.payment_date || new Date().toISOString(),
    invoice_number: vars.invoice_number || '',
    account_number: vars.account_number || vars.client_number || '',
    client_name: vars.client_name || vars.name || 'Client',
    client_email: vars.client_email || vars.email || '',
    client_phone: vars.client_phone || vars.phone || '',
    client_address: vars.client_address || vars.address || '',
    payment_method: vars.payment_method || 'paypal',
    payment_reference: vars.payment_reference || vars.reference || '',
    amount_paid: amountPaid,
    subtotal,
    discount_label: vars.discount_label || (vars.discount_amount ? 'Rabais' : undefined),
    discount_amount: Number(vars.discount_amount ?? 0) || undefined,
    tps,
    tvq,
    total,
    services: vars.services,
  };
}

// Build contract data from template vars
function buildContractData(vars: Record<string, any>): ContractData {
  return {
    contract_number: vars.contract_number || `CTR-${Date.now()}`,
    effective_date: vars.effective_date || vars.created_at || new Date().toISOString(),
    client_name: vars.client_name || vars.name || 'Client',
    client_email: vars.client_email || vars.email || '',
    client_phone: vars.client_phone || vars.phone || '',
    client_address: vars.client_address || vars.address || '',
    client_dob: vars.client_dob || '',
    services: vars.services || [
      { name: vars.service_type || 'Service Nivra', description: '', monthly_price: vars.monthly_amount || 0 }
    ],
    equipment: vars.equipment || [],
    total_monthly: vars.total_monthly || vars.monthly_amount || 0,
    total_one_time: vars.total_one_time || 0,
    agent_name: vars.agent_name || '',
    agent_code: vars.agent_code || '',
  };
}

// Build summary data from template vars
function buildSummaryData(vars: Record<string, any>): SummaryData {
  const paidToday = Number(vars.amount_paid_today ?? vars.canonical_amount_paid_today ?? vars.total_payable ?? vars.total_amount ?? 0) || 0;
  const totalPayable = Number(vars.total_payable ?? vars.canonical_total_payable ?? vars.total ?? paidToday) || 0;
  const tps = Number(vars.tps_amount ?? vars.tps ?? vars.canonical_tps_amount ?? 0) || 0;
  const tvq = Number(vars.tvq_amount ?? vars.tvq ?? vars.canonical_tvq_amount ?? 0) || 0;

  return {
    order_number: vars.order_number || vars.order_id?.substring(0, 8) || "—",
    order_date: vars.order_date || vars.created_at || new Date().toISOString(),
    status: vars.status || 'En traitement',
    client_name: vars.client_name || vars.name || 'Client',
    client_email: vars.client_email || vars.email || '',
    client_phone: vars.client_phone || vars.phone || '',
    client_address: vars.client_address || vars.service_address || '',
    services: vars.services || [
      { name: vars.service_type || 'Service Nivra', price: paidToday || totalPayable, is_recurring: true }
    ],
    subtotal_recurring: Number(vars.monthly_recurring_amount ?? vars.subtotal_recurring ?? vars.monthly_amount ?? 0) || 0,
    subtotal_one_time: Number(vars.one_time_charges ?? vars.subtotal_one_time ?? vars.one_time_amount ?? 0) || 0,
    tps,
    tvq,
    total: totalPayable,
    installation_date: vars.installation_date || vars.scheduled_at || '',
  };
}

// Generate ALL 4 PDFs for full document set (order/payment confirmation)
function generateFullDocumentSet(vars: Record<string, any>): Array<{ filename: string; content: string }> {
  const validation = validatePDFClientData(vars);
  if (!validation.valid) {
    console.warn(`[PDF Safety] Missing client fields for full doc set: ${validation.missing.join(', ')}. Skipping PDF attachments.`);
    return [];
  }

  const attachments: Array<{ filename: string; content: string }> = [];

  // 1. Invoice PDF
  try {
    const invoiceData = buildInvoiceData(vars);
    const invoicePdf = generatePDFAttachment('invoice', invoiceData);
    if (invoicePdf) attachments.push({ filename: invoicePdf.filename, content: invoicePdf.content });
  } catch (e) { console.error('[PDF] Invoice generation failed:', e); }

  // 2. Receipt PDF
  try {
    const receiptData = buildReceiptData(vars);
    const receiptPdf = generatePDFAttachment('receipt', receiptData);
    if (receiptPdf) attachments.push({ filename: receiptPdf.filename, content: receiptPdf.content });
  } catch (e) { console.error('[PDF] Receipt generation failed:', e); }

  // 3. Contract PDF
  try {
    const contractData = buildContractData(vars);
    const contractPdf = generatePDFAttachment('contract', contractData);
    if (contractPdf) attachments.push({ filename: contractPdf.filename, content: contractPdf.content });
  } catch (e) { console.error('[PDF] Contract generation failed:', e); }

  // 4. Order Summary PDF
  try {
    const summaryData = buildSummaryData(vars);
    const summaryPdf = generatePDFAttachment('summary', summaryData);
    if (summaryPdf) attachments.push({ filename: summaryPdf.filename, content: summaryPdf.content });
  } catch (e) { console.error('[PDF] Summary generation failed:', e); }

  return attachments;
}

// Generate single PDF attachment from template vars (for non-full-set templates)
function generateEmailPDFAttachment(templateKey: string, vars: Record<string, any>): PDFAttachment | null {
  const pdfType = PDF_ATTACHMENT_TEMPLATES[templateKey];
  if (!pdfType) return null;

  const validation = validatePDFClientData(vars);
  if (!validation.valid) {
    console.warn(`[PDF Safety] Missing client fields for ${templateKey}: ${validation.missing.join(', ')}. Skipping PDF attachment.`);
    return null;
  }

  try {
    switch (pdfType) {
      case 'invoice':
        return generatePDFAttachment('invoice', buildInvoiceData(vars));
      case 'contract':
        return generatePDFAttachment('contract', buildContractData(vars));
      case 'summary':
        return generatePDFAttachment('summary', buildSummaryData(vars));
      case 'receipt':
        return generatePDFAttachment('receipt', buildReceiptData(vars));
        return null;
    }
  } catch (error) {
    console.error(`[PDF Generation] Error for template ${templateKey}:`, error);
    return null;
  }
}

// =============================================
// SHARED EMAIL LAYOUT COMPONENTS
// =============================================

// PROFESSIONAL BLUE DESIGN SYSTEM - #0066CC Primary
const emailStyles = {
  fontFamily: "Arial, Helvetica, 'Segoe UI', sans-serif",
  bgColor: "#F8FAFB",
  cardBg: "#ffffff",
  textPrimary: "#1A1A1A",
  textSecondary: "#4A4A4A",
  textMuted: "#6B7280",
  // Professional Blue Primary
  accent: "#0066CC",
  accentDark: "#004C99",
  accentLight: "#E6F0FA",
  // Status Colors
  success: "#059669",
  successBg: "#ECFDF5",
  successBorder: "#A7F3D0",
  warning: "#D97706",
  warningBg: "#FFFBEB",
  warningBorder: "#FCD34D",
  error: "#DC2626",
  errorBg: "#FEF2F2",
  errorBorder: "#FECACA",
  info: "#2563EB",
  infoBg: "#EFF6FF",
  infoBorder: "#BFDBFE",
  border: "#E5E7EB",
  footerBg: "#1F2937",
  footerText: "#D1D5DB",
};

const formatCurrency = (amount: number) => 
  new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(amount || 0);

const formatDate = (dateStr: string, includeTime = false) => {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr);
  if (includeTime) {
    return date.toLocaleString('fr-CA', { dateStyle: 'long', timeStyle: 'short' });
  }
  return date.toLocaleDateString('fr-CA', { dateStyle: 'long' });
};

// URL joining helper - guarantees exactly one slash between base and path
const joinUrl = (baseUrl: string, path: string): string => {
  const base = baseUrl.replace(/\/+$/, ''); // Remove trailing slashes
  const cleanPath = path.replace(/^\/+/, ''); // Remove leading slashes
  const result = `${base}/${cleanPath}`;
  
  // Validation: check for common URL joining errors
  if (result.includes('.appclient') || result.includes('.caclient') || result.includes('.app/client') === false && result.includes('.app') && result.includes('client')) {
    console.error(`[URL ERROR] Invalid URL detected: ${result}`);
  }
  
  return result;
};

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

// Professional email wrapper with header and footer
const wrapEmail = (content: string, ctaUrl?: string, ctaText?: string, supportEmail?: string) => {
  const email = supportEmail || "Support@nivra-telecom.ca";
  
  
  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Nivra Telecom</title>
  <!--[if mso]>
  <style type="text/css">
    table {border-collapse:collapse;border-spacing:0;margin:0;}
    div, td {padding:0;}
    div {margin:0 !important;}
  </style>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin:0; padding:0; background-color:${emailStyles.bgColor}; font-family:${emailStyles.fontFamily};">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:${emailStyles.bgColor};">
    <tr>
      <td align="center" style="padding:24px 16px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px; width:100%;">
          
          <!-- HEADER - Professional Blue -->
          <tr>
            <td style="background-color:${emailStyles.cardBg}; border-radius:12px 12px 0 0; padding:0;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="height:4px; background-color:${emailStyles.accent}; border-radius:12px 12px 0 0;"></td>
                </tr>
                <tr>
                  <td style="padding:28px 32px 20px; border-bottom:1px solid ${emailStyles.border};">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr>
                        <td>
                          <h1 style="margin:0; font-size:26px; font-weight:700; color:${emailStyles.accent}; letter-spacing:-0.5px;">Nivra Telecom</h1>
                          <p style="margin:4px 0 0; font-size:11px; color:${emailStyles.textMuted}; text-transform:uppercase; letter-spacing:1px;">Télécommunications</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- MAIN CONTENT -->
          <tr>
            <td style="background-color:${emailStyles.cardBg}; padding:0 32px 32px;">
              ${content}
            </td>
          </tr>
          
          <!-- CTA BUTTON -->
          ${ctaUrl ? `
          <tr>
            <td style="background-color:${emailStyles.cardBg}; padding:0 32px 32px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td align="center">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="border-radius:8px; background-color:${emailStyles.accent};">
                          <a href="${ctaUrl}" target="_blank" style="display:inline-block; padding:14px 32px; font-size:15px; font-weight:600; color:#ffffff; text-decoration:none; border-radius:8px;">
                            ${ctaText || "Ouvrir le portail"}
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top:12px;">
                    <p style="margin:0; font-size:12px; color:${emailStyles.textMuted};">
                      <a href="${ctaUrl}" style="color:${emailStyles.textMuted}; text-decoration:underline;">${ctaUrl}</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ` : ''}
          
          <!-- FOOTER - Professional Dark -->
          <tr>
            <td style="background-color:${emailStyles.footerBg}; border-radius:0 0 12px 12px; padding:32px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td align="center" style="padding-bottom:16px;">
                    <h4 style="margin:0; font-size:18px; font-weight:700; color:#ffffff;">Nivra Telecom</h4>
                    <p style="margin:8px 0 0; font-size:13px; color:${emailStyles.footerText};">
                      Fournisseur de services de télécommunications prépayés au Québec
                    </p>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-bottom:16px;">
                    <p style="margin:0; font-size:12px; color:${emailStyles.footerText};">
                      1799 Av. Pierre-Péladeau, Laval, QC H7T 2Y5
                    </p>
                    <p style="margin:8px 0 0; font-size:13px;">
                      <a href="mailto:${email}" style="color:#9CA3AF; text-decoration:none; white-space:nowrap;">${email}</a>
                    </p>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="border-top:1px solid #374151; padding-top:16px;">
                    <p style="margin:0; font-size:11px; color:#9CA3AF;">
                      © ${new Date().getFullYear()} Nivra Telecom Inc. Tous droits réservés.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

// Reusable details card component
const detailsCard = (items: Array<{ label: string; value: string }>) => `
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#fafafa; border-radius:8px; border:1px solid ${emailStyles.border}; margin:20px 0;">
    ${items.map((item, idx) => `
      <tr>
        <td style="padding:14px 16px; ${idx < items.length - 1 ? `border-bottom:1px solid ${emailStyles.border};` : ''}">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
              <td style="font-size:13px; color:${emailStyles.textMuted}; width:40%;">${item.label}</td>
              <td style="font-size:14px; color:${emailStyles.textPrimary}; font-weight:500; text-align:right;">${item.value}</td>
            </tr>
          </table>
        </td>
      </tr>
    `).join('')}
  </table>`;

// Status badge component — NO emojis (spam trigger for iCloud/Outlook)
const statusBadge = (type: 'success' | 'warning' | 'error' | 'info', _icon: string, titleFr: string, titleEn: string, messageFr: string, messageEn: string) => {
  const colors = {
    success: { bg: emailStyles.successBg, border: emailStyles.success, text: '#065f46' },
    warning: { bg: emailStyles.warningBg, border: emailStyles.warning, text: '#92400e' },
    error: { bg: emailStyles.errorBg, border: emailStyles.error, text: '#991b1b' },
    info: { bg: emailStyles.infoBg, border: emailStyles.info, text: '#075985' },
  };
  const c = colors[type];
  
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:20px 0;">
      <tr>
        <td style="background-color:${c.bg}; border-left:4px solid ${c.border}; border-radius:0 8px 8px 0; padding:16px 20px;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
              <td style="font-size:18px; font-weight:600; color:${c.text};">
                ${titleFr}
              </td>
            </tr>
            <tr>
              <td style="font-size:14px; color:${c.text}; padding-top:6px;">
                ${messageFr}
              </td>
            </tr>
            <tr>
              <td style="font-size:13px; color:${c.text}; opacity:0.8; padding-top:8px; font-style:italic;">
                ${messageEn}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;
};

// Greeting component
const greeting = (name?: string) => `
  <p style="margin:0 0 4px; font-size:16px; color:${emailStyles.textPrimary};">
    Bonjour${name ? ` <strong>${name}</strong>` : ''}, <span style="color:${emailStyles.textMuted}; font-size:14px;">/ Hello${name ? ` ${name}` : ''},</span>
  </p>`;

// =============================================
// EMAIL TEMPLATES
// =============================================

interface EmailConfig {
  baseUrl: string;
  supportEmail: string;
}

const emailTemplates: Record<string, { subject: string; getHtml: (vars: Record<string, any>, config: EmailConfig) => string }> = {
  
  // TEST EMAIL
  test_email: {
    subject: "Nivra — Test du système de courriel",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting()}
      ${statusBadge('success', '✅', 'Système fonctionnel', 'System working', 
        'Le système d\'envoi de courriels Nivra fonctionne correctement.',
        'The Nivra email system is working correctly.'
      )}
      ${detailsCard([
        { label: 'Destinataire / Recipient', value: vars.to_email || 'N/A' },
        { label: 'Envoyé le / Sent at', value: formatDate(new Date().toISOString(), true) },
      ])}
      <p style="margin:20px 0 0; font-size:14px; color:${emailStyles.textSecondary};">
        Ceci est un email de test à des fins de vérification interne.<br>
        <em style="color:${emailStyles.textMuted};">This is a test email for internal verification purposes.</em>
      </p>
    `, joinUrl(config.baseUrl, "/admin/email-activity"), "Voir l'activité / View activity", config.supportEmail),
  },

  // CUSTOM HTML PASSTHROUGH — for emails enqueued via ResendProxy / enqueueEmail.
  // The pre-built HTML is stored in template_vars._html; subject in _subject.
  custom_html: {
    subject: "Nivra Telecom",
    getHtml: (vars, config) => {
      if (vars._html) return vars._html;
      // Fallback: simple message wrapper
      return wrapEmail(`
        <p style="font-size:14px;color:${emailStyles.textSecondary};">
          ${vars.message || 'Contenu non disponible.'}
        </p>
      `, undefined, undefined, config.supportEmail);
    },
  },

  // ACCOUNT CREATED
  account_created: {
    subject: "Nivra — Bienvenue chez Nivra Telecom!",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('success', '🎉', 'Compte créé avec succès!', 'Account created successfully!',
        'Votre compte Nivra Telecom a été créé. Vous pouvez maintenant accéder à votre portail client.',
        'Your Nivra Telecom account has been created. You can now access your client portal.'
      )}
      ${detailsCard([
        { label: 'Numéro client / Client #', value: vars.client_number || 'À venir' },
        { label: 'Email', value: vars.email || vars.client_email || 'N/A' },
      ])}
      <p style="margin:20px 0 0; font-size:14px; color:${emailStyles.textSecondary};">
        Accédez à votre portail pour gérer vos services, factures et plus encore.<br>
        <em style="color:${emailStyles.textMuted};">Access your portal to manage your services, invoices and more.</em>
      </p>
    `, joinUrl(config.baseUrl, "/portal"), "Accéder au portail / Access portal", config.supportEmail),
  },

  // EMAIL VERIFIED
  email_verified: {
    subject: "Nivra — Email vérifié",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('success', '✅', 'Email vérifié!', 'Email verified!',
        'Votre adresse email a été vérifiée avec succès.',
        'Your email address has been successfully verified.'
      )}
      <p style="margin:20px 0 0; font-size:14px; color:${emailStyles.textSecondary};">
        Vous pouvez maintenant profiter de toutes les fonctionnalités de votre compte.<br>
        <em style="color:${emailStyles.textMuted};">You can now enjoy all the features of your account.</em>
      </p>
    `, joinUrl(config.baseUrl, "/portal"), "Ouvrir le portail / Open portal", config.supportEmail),
  },

  // PASSWORD RESET
  password_reset: {
    subject: "Nivra — Réinitialisation de mot de passe",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('info', '🔐', 'Demande de réinitialisation', 'Password reset request',
        'Une demande de réinitialisation de mot de passe a été effectuée pour votre compte.',
        'A password reset request was made for your account.'
      )}
      <p style="margin:20px 0; font-size:14px; color:${emailStyles.textSecondary};">
        Si vous n'avez pas fait cette demande, ignorez cet email.<br>
        <em style="color:${emailStyles.textMuted};">If you did not make this request, please ignore this email.</em>
      </p>
    `, vars.reset_link || joinUrl(config.baseUrl, "/reset-password"), "Réinitialiser / Reset password", config.supportEmail),
  },

  // ORDER SUBMITTED
  order_submitted: {
    subject: "Nivra — Commande reçue (#{{order_number}})",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('success', '✅', 'Commande reçue!', 'Order received!',
        'Votre commande a été soumise avec succès et est en cours de traitement.',
        'Your order has been submitted successfully and is being processed.'
      )}
      ${detailsCard([
        { label: 'Nº commande / Order #', value: vars.order_number || vars.order_id?.substring(0, 8) || 'N/A' },
        { label: 'Service', value: vars.service_type || 'N/A' },
        { label: 'Payé aujourd’hui / Paid today', value: formatCurrency(vars.amount_paid_today ?? vars.total_payable ?? vars.total_amount) },
        ...(vars.total_payable !== undefined ? [{ label: 'Total payable / Total payable', value: formatCurrency(vars.total_payable) }] : []),
        ...(vars.monthly_recurring_amount !== undefined ? [{ label: 'Mensuel récurrent / Recurring monthly', value: formatCurrency(vars.monthly_recurring_amount) }] : []),
        ...(vars.one_time_charges !== undefined ? [{ label: 'Frais uniques / One-time', value: formatCurrency(vars.one_time_charges) }] : []),
        ...(vars.discount_amount ? [{ label: 'Rabais total / Total discount', value: `-${formatCurrency(Math.abs(Number(vars.discount_amount) || 0))}` }] : []),
        ...(vars.tps_amount !== undefined ? [{ label: 'TPS', value: formatCurrency(vars.tps_amount) }] : []),
        ...(vars.tvq_amount !== undefined ? [{ label: 'TVQ', value: formatCurrency(vars.tvq_amount) }] : []),
        { label: 'Date', value: formatDate(new Date().toISOString()) },
      ])}
      <p style="margin:20px 0 0; font-size:14px; color:${emailStyles.textSecondary};">
        Suivez votre commande dans votre portail client.<br>
        <em style="color:${emailStyles.textMuted};">Track your order in your client portal.</em>
      </p>
    `, joinUrl(config.baseUrl, vars.portal_path || "/portal/orders"), "Voir ma commande / View my order", config.supportEmail),
  },

  // ORDER PROCESSED
  order_processed: {
    subject: "Nivra — Commande en traitement (#{{order_number}})",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('info', '📦', 'Commande en traitement', 'Order processing',
        'Votre commande est maintenant en cours de traitement par notre équipe.',
        'Your order is now being processed by our team.'
      )}
      ${detailsCard([
        { label: 'Nº commande / Order #', value: vars.order_number || 'N/A' },
        { label: 'Statut / Status', value: 'En traitement / Processing' },
      ])}
    `, joinUrl(config.baseUrl, vars.portal_path || "/portal/orders"), "Suivre ma commande / Track order", config.supportEmail),
  },

  // ORDER SHIPPED
  order_shipped: {
    subject: "Nivra — Commande expédiée (#{{order_number}})",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('success', '🚚', 'Commande expédiée!', 'Order shipped!',
        'Votre commande a été expédiée et est en route vers vous.',
        'Your order has been shipped and is on its way to you.'
      )}
      ${detailsCard([
        { label: 'Nº commande / Order #', value: vars.order_number || 'N/A' },
        { label: 'Nº suivi / Tracking #', value: vars.tracking_number || 'N/A' },
        ...(vars.tracking_url ? [{ label: 'Lien suivi / Tracking link', value: `<a href="${vars.tracking_url}" style="color:${emailStyles.accent};">Suivre / Track</a>` }] : []),
      ])}
    `, joinUrl(config.baseUrl, vars.portal_path || "/portal/orders"), "Voir ma commande / View order", config.supportEmail),
  },

  // ORDER COMPLETED
  order_completed: {
    subject: "Nivra — Commande terminée (#{{order_number}})",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('success', '✅', 'Commande complétée!', 'Order completed!',
        'Votre commande a été complétée avec succès. Merci de votre confiance!',
        'Your order has been completed successfully. Thank you for your trust!'
      )}
      ${detailsCard([
        { label: 'Nº commande / Order #', value: vars.order_number || 'N/A' },
        { label: 'Statut / Status', value: 'Complétée / Completed' },
      ])}
      <p style="margin:20px 0 0; font-size:14px; color:${emailStyles.textSecondary};">
        Merci de faire confiance à Nivra Telecom!<br>
        <em style="color:${emailStyles.textMuted};">Thank you for trusting Nivra Telecom!</em>
      </p>
    `, joinUrl(config.baseUrl, vars.portal_path || "/portal/orders"), "Voir mes commandes / View orders", config.supportEmail),
  },

  // ORDER CANCELLED
  order_cancelled: {
    subject: "Nivra — Commande annulée (#{{order_number}})",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('error', '❌', 'Commande annulée', 'Order cancelled',
        'Votre commande a été annulée.',
        'Your order has been cancelled.'
      )}
      ${detailsCard([
        { label: 'Nº commande / Order #', value: vars.order_number || 'N/A' },
        { label: 'Statut / Status', value: 'Annulée / Cancelled' },
      ])}
      <p style="margin:20px 0 0; font-size:14px; color:${emailStyles.textSecondary};">
        Pour toute question, contactez notre support.<br>
        <em style="color:${emailStyles.textMuted};">For any questions, contact our support.</em>
      </p>
    `, joinUrl(config.baseUrl, vars.portal_path || "/portal"), "Contacter support / Contact support", config.supportEmail),
  },

  // SHIPPING CREATED
  shipping_created: {
    subject: "Nivra — Expédition créée (#{{order_number}})",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('info', '📦', 'Expédition préparée', 'Shipment prepared',
        'L\'expédition de votre commande a été créée et sera bientôt en route.',
        'The shipment for your order has been created and will be on its way soon.'
      )}
      ${detailsCard([
        { label: 'Nº commande / Order #', value: vars.order_number || 'N/A' },
        { label: 'Adresse / Address', value: vars.shipping_address || 'N/A' },
      ])}
    `, joinUrl(config.baseUrl, vars.portal_path || "/portal/orders"), "Suivre ma commande / Track order", config.supportEmail),
  },

  // INVOICE CREATED
  invoice_created: {
    subject: "Nivra — Nouvelle facture (#{{invoice_number}})",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('info', '📄', 'Nouvelle facture', 'New invoice',
        'Une nouvelle facture a été générée pour votre compte.',
        'A new invoice has been generated for your account.'
      )}
      ${detailsCard([
        { label: 'Nº facture / Invoice #', value: vars.invoice_number || 'N/A' },
        { label: 'Montant / Amount', value: formatCurrency(vars.amount) },
        { label: 'Échéance / Due date', value: vars.due_date ? formatDate(vars.due_date) : 'N/A' },
      ])}
    `, joinUrl(config.baseUrl, "/portal/invoices"), "Voir ma facture / View invoice", config.supportEmail),
  },

  // PAYMENT RECEIVED
  payment_received: {
    subject: "Nivra — Paiement reçu (#{{invoice_number}})",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('success', '✅', 'Paiement reçu!', 'Payment received!',
        'Nous avons bien reçu votre paiement. Merci!',
        'We have received your payment. Thank you!'
      )}
      ${detailsCard([
        { label: 'Nº facture / Invoice #', value: vars.invoice_number || 'N/A' },
        { label: 'Montant payé / Amount paid', value: formatCurrency(vars.amount) },
        { label: 'Date', value: formatDate(new Date().toISOString()) },
      ])}
      <p style="margin:20px 0 0; font-size:14px; color:${emailStyles.textSecondary};">
        Merci de faire confiance à Nivra Telecom!<br>
        <em style="color:${emailStyles.textMuted};">Thank you for trusting Nivra Telecom!</em>
      </p>
    `, joinUrl(config.baseUrl, "/portal/invoices"), "Voir mes factures / View invoices", config.supportEmail),
  },

  // PAYMENT STATUS CHANGED
  payment_status_changed: {
    subject: "Nivra — Mise à jour de paiement (#{{invoice_number}})",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('info', '💳', 'Statut de paiement mis à jour', 'Payment status updated',
        `Le statut de votre paiement a été mis à jour: ${vars.status || 'N/A'}`,
        `Your payment status has been updated: ${vars.status || 'N/A'}`
      )}
      ${detailsCard([
        { label: 'Nº facture / Invoice #', value: vars.invoice_number || 'N/A' },
        { label: 'Nouveau statut / New status', value: vars.status || 'N/A' },
      ])}
    `, joinUrl(config.baseUrl, "/portal/invoices"), "Voir mes factures / View invoices", config.supportEmail),
  },

  // INVOICE OVERDUE
  invoice_overdue: {
    subject: "Nivra — Facture en retard (#{{invoice_number}})",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('warning', '⚠️', 'Facture en retard', 'Invoice overdue',
        'Votre facture est maintenant en retard. Veuillez effectuer le paiement dès que possible.',
        'Your invoice is now overdue. Please make the payment as soon as possible.'
      )}
      ${detailsCard([
        { label: 'Nº facture / Invoice #', value: vars.invoice_number || 'N/A' },
        { label: 'Montant dû / Amount due', value: formatCurrency(vars.amount) },
        { label: 'Échéance / Due date', value: vars.due_date ? formatDate(vars.due_date) : 'N/A' },
      ])}
    `, joinUrl(config.baseUrl, "/portal/invoices"), "Payer maintenant / Pay now", config.supportEmail),
  },

  // PAYMENT FAILED
  payment_failed: {
    subject: "Nivra — Échec du paiement (#{{invoice_number}})",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('error', '❌', 'Paiement non réussi', 'Payment failed',
        'Votre paiement n\'a pas pu être traité. Veuillez vérifier vos informations.',
        'Your payment could not be processed. Please verify your information.'
      )}
      ${detailsCard([
        { label: 'Nº facture / Invoice #', value: vars.invoice_number || 'N/A' },
        { label: 'Montant / Amount', value: formatCurrency(vars.amount) },
      ])}
      <p style="margin:20px 0 0; font-size:14px; color:${emailStyles.textSecondary};">
        Veuillez mettre à jour votre méthode de paiement et réessayer.<br>
        <em style="color:${emailStyles.textMuted};">Please update your payment method and try again.</em>
      </p>
    `, joinUrl(config.baseUrl, "/portal/invoices"), "Réessayer / Retry", config.supportEmail),
  },

  // TICKET CREATED
  ticket_created: {
    subject: "Nivra — Ticket de support créé (#{{ticket_number}})",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('info', '🎫', 'Ticket créé', 'Ticket created',
        'Votre demande de support a été reçue. Notre équipe vous répondra sous peu.',
        'Your support request has been received. Our team will respond shortly.'
      )}
      ${detailsCard([
        { label: 'Nº ticket / Ticket #', value: vars.ticket_number || 'N/A' },
        { label: 'Sujet / Subject', value: vars.subject || 'N/A' },
      ])}
    `, joinUrl(config.baseUrl, vars.portal_path || "/portal/tickets"), "Voir mon ticket / View ticket", config.supportEmail),
  },

  // TICKET REPLY
  ticket_reply: {
    subject: "Nivra — Nouvelle réponse à votre ticket (#{{ticket_number}})",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('success', '💬', 'Nouvelle réponse', 'New reply',
        'Vous avez reçu une nouvelle réponse à votre ticket de support.',
        'You have received a new reply to your support ticket.'
      )}
      ${detailsCard([
        { label: 'Nº ticket / Ticket #', value: vars.ticket_number || 'N/A' },
      ])}
      ${vars.reply_preview ? `
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:16px 0;">
          <tr>
            <td style="background-color:#fafafa; border-radius:8px; padding:16px; border-left:3px solid ${emailStyles.accent};">
              <p style="margin:0; font-size:14px; color:${emailStyles.textSecondary}; font-style:italic;">
                "${vars.reply_preview.length > 150 ? vars.reply_preview.substring(0, 150) + '...' : vars.reply_preview}"
              </p>
            </td>
          </tr>
        </table>
      ` : ''}
    `, joinUrl(config.baseUrl, vars.portal_path || "/portal/tickets"), "Voir la réponse / View reply", config.supportEmail),
  },

  // APPOINTMENT SCHEDULED
  appointment_scheduled: {
    subject: "Nivra — Rendez-vous confirmé",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('success', '📅', 'Rendez-vous confirmé', 'Appointment confirmed',
        'Votre rendez-vous a été planifié avec succès.',
        'Your appointment has been scheduled successfully.'
      )}
      ${detailsCard([
        { label: 'Titre / Title', value: vars.title || 'N/A' },
        { label: 'Date et heure / Date & time', value: vars.scheduled_at ? formatDate(vars.scheduled_at, true) : 'À confirmer / TBD' },
        ...(vars.service_address ? [{ label: 'Adresse / Address', value: vars.service_address }] : []),
      ])}
    `, joinUrl(config.baseUrl, vars.portal_path || "/portal/appointments"), "Voir mes rendez-vous / View appointments", config.supportEmail),
  },

  // APPOINTMENT UPDATED
  appointment_updated: {
    subject: "Nivra — Rendez-vous mis à jour",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('warning', '📅', 'Rendez-vous modifié', 'Appointment updated',
        'Votre rendez-vous a été modifié. Veuillez vérifier les nouveaux détails.',
        'Your appointment has been updated. Please check the new details.'
      )}
      ${detailsCard([
        { label: 'Titre / Title', value: vars.title || 'N/A' },
        { label: 'Nouvelle date / New date', value: vars.scheduled_at ? formatDate(vars.scheduled_at, true) : 'À confirmer / TBD' },
      ])}
    `, joinUrl(config.baseUrl, vars.portal_path || "/portal/appointments"), "Voir mes rendez-vous / View appointments", config.supportEmail),
  },

  // APPOINTMENT CANCELLED
  appointment_cancelled: {
    subject: "Nivra — Rendez-vous annulé",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('error', '❌', 'Rendez-vous annulé', 'Appointment cancelled',
        'Votre rendez-vous a été annulé.',
        'Your appointment has been cancelled.'
      )}
      ${detailsCard([
        { label: 'Titre / Title', value: vars.title || 'N/A' },
        ...(vars.cancellation_reason ? [{ label: 'Raison / Reason', value: vars.cancellation_reason }] : []),
      ])}
      <p style="margin:20px 0 0; font-size:14px; color:${emailStyles.textSecondary};">
        Pour reprogrammer, veuillez nous contacter à ${config.supportEmail}.<br>
        <em style="color:${emailStyles.textMuted};">To reschedule, please contact us at ${config.supportEmail}.</em>
      </p>
    `, joinUrl(config.baseUrl, vars.portal_path || "/portal/appointments"), "Reprogrammer / Reschedule", config.supportEmail),
  },

  // CONTRACT READY (Legacy - kept for compatibility)
  contract_ready: {
    subject: "Nivra — Contrat prêt à signer",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name || vars.clientName)}
      ${statusBadge('info', '📝', 'Contrat disponible', 'Contract ready',
        'Votre contrat est prêt à être signé. Veuillez le consulter dans votre portail.',
        'Your contract is ready to be signed. Please review it in your portal.'
      )}
      ${detailsCard([
        { label: 'Nº contrat / Contract #', value: vars.contract_number || vars.contractNumber || 'N/A' },
        { label: 'Commande / Order', value: vars.order_number || vars.orderNumber || 'N/A' },
      ])}
    `, joinUrl(config.baseUrl, vars.signatureUrl || vars.portal_path || "/portal/contracts"), "Signer le contrat / Sign contract", config.supportEmail),
  },

  // CONTRACT READY FOR SIGNATURE (V2.5 - Auto-generated on payment)
  contract_ready_for_signature: {
    subject: "Nivra — Votre contrat est prêt à signer (#{{contractNumber}})",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.clientName)}
      ${statusBadge('info', '📝', 'Action requise: Signature', 'Action required: Signature',
        'Votre paiement a été confirmé! Veuillez maintenant signer votre contrat de service.',
        'Your payment has been confirmed! Please now sign your service contract.'
      )}
      ${detailsCard([
        { label: 'Nº contrat / Contract #', value: vars.contractNumber || 'N/A' },
        { label: 'Commande / Order', value: vars.orderNumber || 'N/A' },
      ])}
      <p style="margin:20px 0 0; font-size:14px; color:${emailStyles.textSecondary};">
        La signature électronique est rapide et sécurisée. Une fois signé, vous recevrez une copie de votre contrat.<br>
        <em style="color:${emailStyles.textMuted};">Electronic signature is quick and secure. Once signed, you will receive a copy of your contract.</em>
      </p>
    `, joinUrl(config.baseUrl, vars.signatureUrl || "/portal/contracts"), "Signer mon contrat / Sign my contract", config.supportEmail),
  },

  // CONTRACT SENT TO CLIENT (Admin notification)
  contract_sent_to_client: {
    subject: "Nivra — Contrat envoyé au client (#{{contract_number}})",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.admin_name || 'Admin')}
      ${statusBadge('success', '📨', 'Contrat envoyé', 'Contract sent',
        'Le contrat a été envoyé au client pour signature.',
        'The contract has been sent to the client for signature.'
      )}
      ${detailsCard([
        { label: 'Nº contrat / Contract #', value: vars.contract_number || 'N/A' },
        { label: 'Client', value: vars.client_name || 'N/A' },
        { label: 'Email', value: vars.client_email || 'N/A' },
        { label: 'Envois / Sent count', value: vars.sent_count || '1' },
      ])}
    `, joinUrl(config.baseUrl, "/admin/contracts"), "Voir les contrats / View contracts", config.supportEmail),
  },

  // CONTRACT SIGNED
  contract_signed: {
    subject: "Nivra — Contrat signé (#{{contract_number}})",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('success', '✅', 'Contrat signé!', 'Contract signed!',
        'Votre contrat a été signé avec succès. Une copie est disponible dans votre portail.',
        'Your contract has been signed successfully. A copy is available in your portal.'
      )}
      ${detailsCard([
        { label: 'Nº contrat / Contract #', value: vars.contract_number || 'N/A' },
        { label: 'Signé le / Signed on', value: formatDate(vars.signed_at || new Date().toISOString()) },
      ])}
      <p style="margin:20px 0 0; font-size:14px; color:${emailStyles.textSecondary};">
        Merci de faire confiance à Nivra Telecom!<br>
        <em style="color:${emailStyles.textMuted};">Thank you for trusting Nivra Telecom!</em>
      </p>
    `, joinUrl(config.baseUrl, vars.portal_path || "/portal/contracts"), "Voir mes contrats / View contracts", config.supportEmail),
  },

  // =============================================
  // CANCELLATION TEMPLATES
  // =============================================

  // CANCELLATION RECEIVED
  cancellation_received: {
    subject: "Nivra — Demande d'annulation reçue (#{{request_number}})",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('info', '📋', 'Demande reçue', 'Request received',
        'Nous avons bien reçu votre demande d\'annulation de service.',
        'We have received your service cancellation request.'
      )}
      ${detailsCard([
        { label: 'Nº demande / Request #', value: vars.request_number || 'N/A' },
        { label: 'Service', value: vars.service_type || 'N/A' },
      ])}
      <p style="margin:20px 0 0; font-size:14px; color:${emailStyles.textSecondary};">
        Notre équipe examinera votre demande dans les plus brefs délais.<br>
        <em style="color:${emailStyles.textMuted};">Our team will review your request as soon as possible.</em>
      </p>
    `, joinUrl(config.baseUrl, "/portal/cancellations"), "Suivre ma demande / Track request", config.supportEmail),
  },

  // CANCELLATION SCHEDULED
  cancellation_scheduled: {
    subject: "Nivra — Annulation planifiée (#{{request_number}})",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('warning', '📅', 'Annulation planifiée', 'Cancellation scheduled',
        'Votre demande d\'annulation a été approuvée et planifiée.',
        'Your cancellation request has been approved and scheduled.'
      )}
      ${detailsCard([
        { label: 'Nº demande / Request #', value: vars.request_number || 'N/A' },
        { label: 'Service', value: vars.service_type || 'N/A' },
        { label: 'Date effective / Effective date', value: vars.effective_date ? formatDate(vars.effective_date) : 'À confirmer / TBD' },
      ])}
      ${vars.public_message ? `
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:16px 0;">
          <tr>
            <td style="background-color:#fafafa; border-radius:8px; padding:16px; border-left:3px solid ${emailStyles.accent};">
              <p style="margin:0; font-size:14px; color:${emailStyles.textSecondary};">
                ${vars.public_message}
              </p>
            </td>
          </tr>
        </table>
      ` : ''}
      <p style="margin:20px 0 0; font-size:14px; color:${emailStyles.textSecondary};">
        Votre service restera actif jusqu'à la date effective.<br>
        <em style="color:${emailStyles.textMuted};">Your service will remain active until the effective date.</em>
      </p>
    `, joinUrl(config.baseUrl, "/portal/cancellations"), "Voir les détails / View details", config.supportEmail),
  },

  // CANCELLATION COMPLETED
  cancellation_completed: {
    subject: "Nivra — Annulation complétée (#{{request_number}})",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('success', '✅', 'Annulation complétée', 'Cancellation completed',
        'Votre annulation de service est maintenant complétée.',
        'Your service cancellation is now complete.'
      )}
      ${detailsCard([
        { label: 'Nº demande / Request #', value: vars.request_number || 'N/A' },
        { label: 'Service', value: vars.service_type || 'N/A' },
        { label: 'Date d\'annulation / Cancellation date', value: vars.effective_date ? formatDate(vars.effective_date) : formatDate(new Date().toISOString()) },
      ])}
      ${vars.public_message ? `
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:16px 0;">
          <tr>
            <td style="background-color:#fafafa; border-radius:8px; padding:16px; border-left:3px solid ${emailStyles.accent};">
              <p style="margin:0; font-size:14px; color:${emailStyles.textSecondary};">
                ${vars.public_message}
              </p>
            </td>
          </tr>
        </table>
      ` : ''}
      <p style="margin:20px 0 0; font-size:14px; color:${emailStyles.textSecondary};">
        Merci d'avoir été client chez Nivra. Nous serons heureux de vous accueillir à nouveau.<br>
        <em style="color:${emailStyles.textMuted};">Thank you for being a Nivra customer. We'd be happy to welcome you back.</em>
      </p>
    `, joinUrl(config.baseUrl, "/portal"), "Retour au portail / Back to portal", config.supportEmail),
  },

  // CANCELLATION DECLINED
  cancellation_declined: {
    subject: "Nivra — Demande d'annulation refusée (#{{request_number}})",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('error', '❌', 'Demande refusée', 'Request declined',
        'Votre demande d\'annulation n\'a pas pu être approuvée.',
        'Your cancellation request could not be approved.'
      )}
      ${detailsCard([
        { label: 'Nº demande / Request #', value: vars.request_number || 'N/A' },
        { label: 'Service', value: vars.service_type || 'N/A' },
        ...(vars.decline_reason ? [{ label: 'Raison / Reason', value: vars.decline_reason }] : []),
      ])}
      ${vars.public_message ? `
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:16px 0;">
          <tr>
            <td style="background-color:#fafafa; border-radius:8px; padding:16px; border-left:3px solid ${emailStyles.accent};">
              <p style="margin:0; font-size:14px; color:${emailStyles.textSecondary};">
                ${vars.public_message}
              </p>
            </td>
          </tr>
        </table>
      ` : ''}
      <p style="margin:20px 0 0; font-size:14px; color:${emailStyles.textSecondary};">
        Pour toute question, contactez notre équipe de support.<br>
        <em style="color:${emailStyles.textMuted};">For any questions, please contact our support team.</em>
      </p>
    `, joinUrl(config.baseUrl, "/portal/cancellations"), "Contacter support / Contact support", config.supportEmail),
  },

  // =============================================
  // PAYMENT DISPUTE TEMPLATES
  // =============================================

  // DISPUTE RECEIVED
  dispute_received: {
    subject: "Nivra — Contestation de paiement reçue (#{{dispute_number}})",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('info', '📋', 'Contestation reçue', 'Dispute received',
        'Nous avons bien reçu votre contestation de paiement.',
        'We have received your payment dispute.'
      )}
      ${detailsCard([
        { label: 'Nº contestation / Dispute #', value: vars.dispute_number || 'N/A' },
        { label: 'Nº paiement / Payment #', value: vars.payment_reference || 'N/A' },
        { label: 'Montant / Amount', value: formatCurrency(vars.amount) },
        { label: 'Raison / Reason', value: vars.reason_code || 'N/A' },
      ])}
      <p style="margin:20px 0 0; font-size:14px; color:${emailStyles.textSecondary};">
        Notre équipe examinera votre contestation dans les plus brefs délais.<br>
        <em style="color:${emailStyles.textMuted};">Our team will review your dispute as soon as possible.</em>
      </p>
    `, joinUrl(config.baseUrl, "/portal/invoices"), "Suivre ma contestation / Track dispute", config.supportEmail),
  },

  // DISPUTE REQUEST INFO
  dispute_request_info: {
    subject: "Nivra — Information requise pour votre contestation (#{{dispute_number}})",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('warning', '❓', 'Information requise', 'Information required',
        'Nous avons besoin d\'informations supplémentaires pour traiter votre contestation.',
        'We need additional information to process your dispute.'
      )}
      ${detailsCard([
        { label: 'Nº contestation / Dispute #', value: vars.dispute_number || 'N/A' },
        { label: 'Nº paiement / Payment #', value: vars.payment_reference || 'N/A' },
        { label: 'Montant / Amount', value: formatCurrency(vars.amount) },
      ])}
      ${vars.public_message ? `
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:16px 0;">
          <tr>
            <td style="background-color:#fafafa; border-radius:8px; padding:16px; border-left:3px solid ${emailStyles.accent};">
              <p style="margin:0 0 4px; font-size:12px; font-weight:600; color:${emailStyles.textMuted};">Message de notre équipe / Message from our team:</p>
              <p style="margin:0; font-size:14px; color:${emailStyles.textSecondary};">
                ${vars.public_message}
              </p>
            </td>
          </tr>
        </table>
      ` : ''}
      <p style="margin:20px 0 0; font-size:14px; color:${emailStyles.textSecondary};">
        Veuillez répondre via votre portail client.<br>
        <em style="color:${emailStyles.textMuted};">Please respond through your client portal.</em>
      </p>
    `, joinUrl(config.baseUrl, "/portal/invoices"), "Répondre / Respond", config.supportEmail),
  },

  // DISPUTE RESOLVED APPROVED
  dispute_resolved_approved: {
    subject: "Nivra — Contestation approuvée (#{{dispute_number}})",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('success', '✅', 'Contestation approuvée!', 'Dispute approved!',
        'Votre contestation de paiement a été approuvée.',
        'Your payment dispute has been approved.'
      )}
      ${detailsCard([
        { label: 'Nº contestation / Dispute #', value: vars.dispute_number || 'N/A' },
        { label: 'Nº paiement / Payment #', value: vars.payment_reference || 'N/A' },
        { label: 'Montant / Amount', value: formatCurrency(vars.amount) },
      ])}
      ${vars.resolution_notes ? `
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:16px 0;">
          <tr>
            <td style="background-color:#d1fae5; border-radius:8px; padding:16px; border-left:3px solid ${emailStyles.success};">
              <p style="margin:0 0 4px; font-size:12px; font-weight:600; color:#065f46;">Résolution / Resolution:</p>
              <p style="margin:0; font-size:14px; color:#065f46;">
                ${vars.resolution_notes}
              </p>
            </td>
          </tr>
        </table>
      ` : ''}
      <p style="margin:20px 0 0; font-size:14px; color:${emailStyles.textSecondary};">
        Merci de votre patience. Un crédit sera appliqué à votre compte si applicable.<br>
        <em style="color:${emailStyles.textMuted};">Thank you for your patience. A credit will be applied to your account if applicable.</em>
      </p>
    `, joinUrl(config.baseUrl, "/portal/invoices"), "Voir mon compte / View account", config.supportEmail),
  },

  // DISPUTE RESOLVED REJECTED
  dispute_resolved_rejected: {
    subject: "Nivra — Contestation refusée (#{{dispute_number}})",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('error', '❌', 'Contestation refusée', 'Dispute rejected',
        'Votre contestation de paiement n\'a pas pu être approuvée.',
        'Your payment dispute could not be approved.'
      )}
      ${detailsCard([
        { label: 'Nº contestation / Dispute #', value: vars.dispute_number || 'N/A' },
        { label: 'Nº paiement / Payment #', value: vars.payment_reference || 'N/A' },
        { label: 'Montant / Amount', value: formatCurrency(vars.amount) },
      ])}
      ${vars.rejection_reason ? `
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:16px 0;">
          <tr>
            <td style="background-color:#fee2e2; border-radius:8px; padding:16px; border-left:3px solid ${emailStyles.error};">
              <p style="margin:0 0 4px; font-size:12px; font-weight:600; color:#991b1b;">Raison / Reason:</p>
              <p style="margin:0; font-size:14px; color:#991b1b;">
                ${vars.rejection_reason}
              </p>
            </td>
          </tr>
        </table>
      ` : ''}
      <p style="margin:20px 0 0; font-size:14px; color:${emailStyles.textSecondary};">
        Pour toute question, contactez notre équipe de support.<br>
        <em style="color:${emailStyles.textMuted};">For any questions, please contact our support team.</em>
      </p>
    `, joinUrl(config.baseUrl, "/portal/invoices"), "Contacter support / Contact support", config.supportEmail),
  },

  // =============================================
  // BILLING V2 TEMPLATES
  // =============================================

  // NEW INVOICE (Billing V2)
  billing_new_invoice: {
    subject: "Nivra — Nouvelle facture (#{{invoice_number}})",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.clientName)}
      ${statusBadge('info', '📄', 'Nouvelle facture', 'New invoice',
        'Une nouvelle facture a été générée pour votre abonnement Nivra.',
        'A new invoice has been generated for your Nivra subscription.'
      )}
      ${detailsCard([
        { label: 'Nº facture / Invoice #', value: vars.invoiceNumber || 'N/A' },
        { label: 'Forfait / Plan', value: vars.planName || 'N/A' },
        { label: 'Sous-total', value: '$' + (vars.subtotal || '0.00') },
        { label: 'TPS (5%)', value: '$' + (vars.tps || '0.00') },
        { label: 'TVQ (9.975%)', value: '$' + (vars.tvq || '0.00') },
        { label: 'Total', value: '$' + (vars.total || '0.00') },
        { label: 'Période', value: (vars.cycleStart || '') + ' → ' + (vars.cycleEnd || '') },
        { label: 'Échéance / Due date', value: vars.dueDate || 'N/A' },
      ])}
      <p style="margin:20px 0 0; font-size:14px; color:${emailStyles.textSecondary};">
        <strong>Paiement par Interac :</strong> Envoyez le montant à <strong>${config.supportEmail}</strong><br>
        <em style="color:${emailStyles.textMuted};">Payment by Interac: Send the amount to ${config.supportEmail}</em>
      </p>
    `, joinUrl(config.baseUrl, "/client/factures"), "Voir ma facture / View invoice", config.supportEmail),
  },

  // RENEWAL REMINDER J-3 (Billing V2)
  billing_renewal_reminder: {
    subject: "Nivra — Rappel de renouvellement dans {{daysRemaining}} jours",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.clientName)}
      ${statusBadge('warning', '⏰', 'Rappel de renouvellement', 'Renewal reminder',
        'Votre abonnement expire bientôt. Payez maintenant pour éviter toute interruption.',
        'Your subscription expires soon. Pay now to avoid any interruption.'
      )}
      ${detailsCard([
        { label: 'Nº facture / Invoice #', value: vars.invoiceNumber || 'N/A' },
        { label: 'Forfait / Plan', value: vars.planName || 'N/A' },
        { label: 'Montant dû / Amount due', value: '$' + (vars.total || '0.00') },
        { label: 'Échéance / Due date', value: vars.dueDate || 'N/A' },
        { label: 'Jours restants / Days remaining', value: (vars.daysRemaining || 3) + ' jours' },
      ])}
      <p style="margin:20px 0 0; font-size:14px; color:${emailStyles.textSecondary};">
        <strong>Paiement par Interac :</strong> Envoyez le montant à <strong>${config.supportEmail}</strong><br>
        <em style="color:${emailStyles.textMuted};">Payment by Interac: Send the amount to ${config.supportEmail}</em>
      </p>
    `, joinUrl(config.baseUrl, "/client/factures"), "Payer maintenant / Pay now", config.supportEmail),
  },

  // PAYMENT CONFIRMED (Billing V2)
  billing_payment_confirmed: {
    subject: "Nivra — Paiement reçu (#{{invoiceNumber}})",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.clientName)}
      ${statusBadge('success', '✅', 'Paiement confirmé!', 'Payment confirmed!',
        'Votre paiement a été reçu et votre service est maintenant actif.',
        'Your payment has been received and your service is now active.'
      )}
      ${detailsCard([
        { label: 'Nº facture / Invoice #', value: vars.invoiceNumber || 'N/A' },
        { label: 'Forfait / Plan', value: vars.planName || 'N/A' },
        { label: 'Montant payé / Amount paid', value: '$' + (vars.total || '0.00') },
        { label: 'Date de paiement / Paid on', value: vars.paidAt || 'N/A' },
        { label: 'Période active', value: (vars.cycleStart || '') + ' → ' + (vars.cycleEnd || '') },
      ])}
      <p style="margin:20px 0 0; font-size:14px; color:${emailStyles.textSecondary};">
        Merci pour votre confiance! Votre service est renouvelé pour 30 jours.<br>
        <em style="color:${emailStyles.textMuted};">Thank you for your trust! Your service is renewed for 30 days.</em>
      </p>
    `, joinUrl(config.baseUrl, "/client/dashboard"), "Accéder au portail / Access portal", config.supportEmail),
  },

  // PAYMENT OVERDUE (Billing V2)
  billing_payment_overdue: {
    subject: "Nivra — Paiement en retard (#{{invoiceNumber}})",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.clientName)}
      ${statusBadge('warning', '⚠️', 'Paiement en retard', 'Payment overdue',
        'Votre facture est en retard. Payez rapidement pour éviter une suspension.',
        'Your invoice is overdue. Pay quickly to avoid suspension.'
      )}
      ${detailsCard([
        { label: 'Nº facture / Invoice #', value: vars.invoiceNumber || 'N/A' },
        { label: 'Montant dû / Amount due', value: '$' + (vars.amountOwed || '0.00') },
        { label: 'Jours en retard / Days overdue', value: (vars.daysOverdue || 1) + ' jour(s)' },
      ])}
      <p style="margin:20px 0 0; font-size:14px; color:${emailStyles.textSecondary};">
        <strong>⚠️ Attention:</strong> Sans paiement sous 48h, votre service sera suspendu.<br>
        <em style="color:${emailStyles.textMuted};">Warning: Without payment within 48h, your service will be suspended.</em>
      </p>
    `, joinUrl(config.baseUrl, "/client/factures"), "Payer maintenant / Pay now", config.supportEmail),
  },

  // SERVICE SUSPENDED (Billing V2)
  billing_service_suspended: {
    subject: "Nivra — Service suspendu pour non-paiement",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.clientName)}
      ${statusBadge('error', '🚫', 'Service suspendu', 'Service suspended',
        'Votre service a été suspendu en raison d\'un paiement en retard.',
        'Your service has been suspended due to an overdue payment.'
      )}
      ${detailsCard([
        { label: 'Forfait / Plan', value: vars.planName || 'N/A' },
        { label: 'Nº facture / Invoice #', value: vars.invoiceNumber || 'N/A' },
        { label: 'Montant dû / Amount owed', value: '$' + (vars.amountOwed || '0.00') },
        { label: 'Jours avant annulation', value: (vars.daysUntilCancellation || 3) + ' jours' },
      ])}
      <p style="margin:20px 0 0; font-size:14px; color:${emailStyles.textSecondary};">
        <strong>⚠️ Important:</strong> Payez rapidement pour réactiver votre service. Après ${vars.daysUntilCancellation || 3} jours, votre abonnement sera annulé définitivement.<br>
        <em style="color:${emailStyles.textMuted};">Pay quickly to reactivate your service. After ${vars.daysUntilCancellation || 3} days, your subscription will be permanently cancelled.</em>
      </p>
    `, joinUrl(config.baseUrl, "/client/factures"), "Payer et réactiver / Pay and reactivate", config.supportEmail),
  },

  // SERVICE CANCELLED (Billing V2)
  billing_service_cancelled: {
    subject: "Nivra — Abonnement annulé",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.clientName)}
      ${statusBadge('error', '❌', 'Abonnement annulé', 'Subscription cancelled',
        'Votre abonnement a été annulé en raison d\'un non-paiement prolongé.',
        'Your subscription has been cancelled due to prolonged non-payment.'
      )}
      ${detailsCard([
        { label: 'Forfait / Plan', value: vars.planName || 'N/A' },
        { label: 'Nº facture / Invoice #', value: vars.invoiceNumber || 'N/A' },
        { label: 'Montant impayé / Unpaid amount', value: '$' + (vars.amountOwed || '0.00') },
      ])}
      <p style="margin:20px 0 0; font-size:14px; color:${emailStyles.textSecondary};">
        Nous sommes désolés de vous voir partir. Si vous souhaitez réactiver votre compte, contactez notre support.<br>
        <em style="color:${emailStyles.textMuted};">We're sorry to see you go. If you wish to reactivate your account, please contact our support.</em>
      </p>
    `, joinUrl(config.baseUrl, "/contact"), "Contacter support / Contact support", config.supportEmail),
  },

  // =============================================
  // PORTING TEMPLATES
  // =============================================

  // PORTING INITIATED
  porting_initiated: {
    subject: "Nivra — Transfert de numéro initié ({{phone_number}})",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('info', '📱', 'Transfert initié', 'Porting initiated',
        'Le transfert de votre numéro a été initié auprès de votre ancien fournisseur.',
        'The transfer of your phone number has been initiated with your previous provider.'
      )}
      ${detailsCard([
        { label: 'Numéro / Number', value: vars.phone_number || 'N/A' },
        { label: 'Statut / Status', value: 'En cours / In progress' },
        ...(vars.estimated_date ? [{ label: 'Date estimée / Estimated date', value: formatDate(vars.estimated_date) }] : []),
      ])}
      <p style="margin:20px 0 0; font-size:14px; color:${emailStyles.textSecondary};">
        Le processus prend généralement 2-5 jours ouvrables. Nous vous tiendrons informé.<br>
        <em style="color:${emailStyles.textMuted};">The process typically takes 2-5 business days. We'll keep you informed.</em>
      </p>
    `, joinUrl(config.baseUrl, vars.portal_path || "/portal/orders"), "Voir ma commande / View order", config.supportEmail),
  },

  // PORTING COMPLETED
  porting_completed: {
    subject: "Nivra — Transfert de numéro complété! ({{phone_number}})",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('success', '✅', 'Transfert complété!', 'Porting completed!',
        'Votre numéro a été transféré avec succès vers Nivra Telecom.',
        'Your phone number has been successfully transferred to Nivra Telecom.'
      )}
      ${detailsCard([
        { label: 'Numéro / Number', value: vars.phone_number || 'N/A' },
        { label: 'Statut / Status', value: 'Actif / Active' },
      ])}
      <p style="margin:20px 0 0; font-size:14px; color:${emailStyles.textSecondary};">
        Bienvenue chez Nivra! Votre numéro est maintenant actif sur notre réseau.<br>
        <em style="color:${emailStyles.textMuted};">Welcome to Nivra! Your number is now active on our network.</em>
      </p>
    `, joinUrl(config.baseUrl, vars.portal_path || "/portal"), "Accéder au portail / Access portal", config.supportEmail),
  },

  // PORTING FAILED
  porting_failed: {
    subject: "Nivra — Problème avec le transfert de numéro ({{phone_number}})",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('error', '❌', 'Problème de transfert', 'Porting issue',
        'Un problème est survenu lors du transfert de votre numéro.',
        'An issue occurred during the transfer of your phone number.'
      )}
      ${detailsCard([
        { label: 'Numéro / Number', value: vars.phone_number || 'N/A' },
        { label: 'Statut / Status', value: 'Échec / Failed' },
        ...(vars.failure_reason ? [{ label: 'Raison / Reason', value: vars.failure_reason }] : []),
      ])}
      <p style="margin:20px 0 0; font-size:14px; color:${emailStyles.textSecondary};">
        Notre équipe vous contactera pour résoudre ce problème. Vous pouvez aussi nous contacter directement.<br>
        <em style="color:${emailStyles.textMuted};">Our team will contact you to resolve this issue. You can also contact us directly.</em>
      </p>
    `, joinUrl(config.baseUrl, "/contact"), "Contacter support / Contact support", config.supportEmail),
  },

  // =============================================
  // INSTALLATION TEMPLATES
  // =============================================

  // INSTALLATION SCHEDULED
  installation_scheduled: {
    subject: "Nivra — Installation planifiée (#{{order_number}})",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('success', '📅', 'Installation planifiée', 'Installation scheduled',
        'Votre installation a été planifiée avec un de nos techniciens.',
        'Your installation has been scheduled with one of our technicians.'
      )}
      ${detailsCard([
        { label: 'Nº commande / Order #', value: vars.order_number || 'N/A' },
        { label: 'Date et heure / Date & time', value: vars.scheduled_date_time ? formatDate(vars.scheduled_date_time, true) : 'À confirmer / TBD' },
        ...(vars.service_address ? [{ label: 'Adresse / Address', value: vars.service_address }] : []),
        ...(vars.technician_name ? [{ label: 'Technicien / Technician', value: vars.technician_name }] : []),
      ])}
      <p style="margin:20px 0 0; font-size:14px; color:${emailStyles.textSecondary};">
        Veuillez vous assurer qu'un adulte est présent à l'adresse le jour de l'installation.<br>
        <em style="color:${emailStyles.textMuted};">Please ensure an adult is present at the address on the installation day.</em>
      </p>
    `, joinUrl(config.baseUrl, vars.portal_path || "/portal/orders"), "Voir ma commande / View order", config.supportEmail),
  },

  // TECHNICIAN EN ROUTE
  technician_en_route: {
    subject: "Nivra — Technicien en route! (#{{order_number}})",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('info', '🚗', 'Technicien en route', 'Technician on the way',
        'Notre technicien est en route vers votre adresse.',
        'Our technician is on the way to your address.'
      )}
      ${detailsCard([
        { label: 'Nº commande / Order #', value: vars.order_number || 'N/A' },
        ...(vars.service_address ? [{ label: 'Adresse / Address', value: vars.service_address }] : []),
        ...(vars.technician_name ? [{ label: 'Technicien / Technician', value: vars.technician_name }] : []),
      ])}
      <p style="margin:20px 0 0; font-size:14px; color:${emailStyles.textSecondary};">
        Veuillez vous assurer qu'un adulte est présent pour accueillir le technicien.<br>
        <em style="color:${emailStyles.textMuted};">Please ensure an adult is present to welcome the technician.</em>
      </p>
    `, joinUrl(config.baseUrl, vars.portal_path || "/portal/orders"), "Suivre ma commande / Track order", config.supportEmail),
  },

  // INSTALLATION IN PROGRESS
  installation_in_progress: {
    subject: "Nivra — Installation en cours (#{{order_number}})",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('info', '🔧', 'Installation en cours', 'Installation in progress',
        'L\'installation de vos services est actuellement en cours.',
        'The installation of your services is currently in progress.'
      )}
      ${detailsCard([
        { label: 'Nº commande / Order #', value: vars.order_number || 'N/A' },
        ...(vars.technician_name ? [{ label: 'Technicien / Technician', value: vars.technician_name }] : []),
      ])}
    `, joinUrl(config.baseUrl, vars.portal_path || "/portal/orders"), "Suivre ma commande / Track order", config.supportEmail),
  },

  // INSTALLATION COMPLETED
  installation_completed: {
    subject: "Nivra — Installation terminée! (#{{order_number}})",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('success', '✅', 'Installation terminée!', 'Installation completed!',
        'L\'installation de vos services a été complétée avec succès.',
        'The installation of your services has been completed successfully.'
      )}
      ${detailsCard([
        { label: 'Nº commande / Order #', value: vars.order_number || 'N/A' },
        { label: 'Statut / Status', value: 'Actif / Active' },
        ...(vars.service_address ? [{ label: 'Adresse / Address', value: vars.service_address }] : []),
      ])}
      <p style="margin:20px 0 0; font-size:14px; color:${emailStyles.textSecondary};">
        Merci de faire confiance à Nivra Telecom! Profitez de vos nouveaux services.<br>
        <em style="color:${emailStyles.textMuted};">Thank you for trusting Nivra Telecom! Enjoy your new services.</em>
      </p>
    `, joinUrl(config.baseUrl, vars.portal_path || "/portal"), "Accéder au portail / Access portal", config.supportEmail),
  },

  // =============================================
  // SERVICE STATUS TEMPLATES
  // =============================================

  // SERVICE ACTIVATED
  service_activated: {
    subject: "Nivra — Service activé",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('success', '✅', 'Service activé!', 'Service activated!',
        'Votre service est maintenant actif et prêt à utiliser.',
        'Your service is now active and ready to use.'
      )}
      ${detailsCard([
        { label: 'Service', value: vars.service_name || 'N/A' },
        { label: 'Type', value: vars.service_type || 'N/A' },
        { label: 'Statut / Status', value: vars.status_label || 'Actif / Active' },
      ])}
      <p style="margin:20px 0 0; font-size:14px; color:${emailStyles.textSecondary};">
        Merci de faire confiance à Nivra Telecom! Profitez de votre service.<br>
        <em style="color:${emailStyles.textMuted};">Thank you for trusting Nivra Telecom! Enjoy your service.</em>
      </p>
    `, joinUrl(config.baseUrl, vars.portal_path || "/portal/services"), "Voir mes services / View services", config.supportEmail),
  },

  // SERVICE SUSPENDED
  service_suspended: {
    subject: "Nivra — Service suspendu",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('warning', '⚠️', 'Service suspendu', 'Service suspended',
        'Votre service a été temporairement suspendu.',
        'Your service has been temporarily suspended.'
      )}
      ${detailsCard([
        { label: 'Service', value: vars.service_name || 'N/A' },
        { label: 'Type', value: vars.service_type || 'N/A' },
        ...(vars.reason ? [{ label: 'Raison / Reason', value: vars.reason }] : []),
      ])}
      <p style="margin:20px 0 0; font-size:14px; color:${emailStyles.textSecondary};">
        Pour réactiver votre service, veuillez contacter notre support ou régulariser votre compte.<br>
        <em style="color:${emailStyles.textMuted};">To reactivate your service, please contact our support or settle your account.</em>
      </p>
    `, joinUrl(config.baseUrl, vars.portal_path || "/portal/services"), "Contacter support / Contact support", config.supportEmail),
  },

  // SERVICE REACTIVATED
  service_reactivated: {
    subject: "Nivra — Service rétabli",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('success', '🔄', 'Service rétabli!', 'Service restored!',
        'Votre service a été rétabli et est à nouveau actif.',
        'Your service has been restored and is active again.'
      )}
      ${detailsCard([
        { label: 'Service', value: vars.service_name || 'N/A' },
        { label: 'Type', value: vars.service_type || 'N/A' },
        { label: 'Statut / Status', value: vars.status_label || 'Actif / Active' },
      ])}
      <p style="margin:20px 0 0; font-size:14px; color:${emailStyles.textSecondary};">
        Merci de votre patience. Profitez à nouveau de votre service!<br>
        <em style="color:${emailStyles.textMuted};">Thank you for your patience. Enjoy your service again!</em>
      </p>
    `, joinUrl(config.baseUrl, vars.portal_path || "/portal/services"), "Voir mes services / View services", config.supportEmail),
  },
  ticket_status_update: {
    subject: "Nivra — Mise à jour de votre ticket (#{{ticket_number}})",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('info', '🔄', 'Statut mis à jour', 'Status updated',
        'Le statut de votre ticket de support a été mis à jour.',
        'The status of your support ticket has been updated.'
      )}
      ${detailsCard([
        { label: 'Nº ticket / Ticket #', value: vars.ticket_number || 'N/A' },
        { label: 'Nouveau statut / New status', value: vars.status_label || vars.new_status || 'N/A' },
      ])}
    `, joinUrl(config.baseUrl, vars.portal_path || "/portal/tickets"), "Voir mon ticket / View ticket", config.supportEmail),
  },

  // TICKET RESOLVED
  ticket_resolved: {
    subject: "Nivra — Ticket résolu! (#{{ticket_number}})",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('success', '✅', 'Ticket résolu!', 'Ticket resolved!',
        'Votre ticket de support a été résolu.',
        'Your support ticket has been resolved.'
      )}
      ${detailsCard([
        { label: 'Nº ticket / Ticket #', value: vars.ticket_number || 'N/A' },
        { label: 'Statut / Status', value: 'Résolu / Resolved' },
      ])}
      <p style="margin:20px 0 0; font-size:14px; color:${emailStyles.textSecondary};">
        Merci de votre patience. N\'hésitez pas à nous contacter si vous avez d\'autres questions.<br>
        <em style="color:${emailStyles.textMuted};">Thank you for your patience. Don't hesitate to contact us if you have any other questions.</em>
      </p>
    `, joinUrl(config.baseUrl, vars.portal_path || "/portal/tickets"), "Voir mon ticket / View ticket", config.supportEmail),
  },

  // =============================================
  // PAYMENT REMINDER TEMPLATES (J-7, J-3, J-1, J+1)
  // =============================================

  // PAYMENT REMINDER 7 DAYS BEFORE
  payment_reminder_7days: {
    subject: "Nivra — Rappel: Paiement dû dans 7 jours (#{{invoice_number}})",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('info', '📅', 'Rappel de paiement', 'Payment reminder',
        'Votre facture arrive à échéance dans 7 jours.',
        'Your invoice is due in 7 days.'
      )}
      ${detailsCard([
        { label: 'Nº facture / Invoice #', value: vars.invoice_number || 'N/A' },
        { label: 'Montant dû / Amount due', value: formatCurrency(vars.balance_due || vars.amount) },
        { label: 'Échéance / Due date', value: vars.due_date ? formatDate(vars.due_date) : 'N/A' },
      ])}
      <p style="margin:20px 0 0; font-size:14px; color:${emailStyles.textSecondary};">
        Pour éviter toute interruption de service, veuillez effectuer votre paiement avant l'échéance.<br>
        <em style="color:${emailStyles.textMuted};">To avoid any service interruption, please make your payment before the due date.</em>
      </p>
    `, joinUrl(config.baseUrl, "/portal/invoices"), "Payer maintenant / Pay now", config.supportEmail),
  },

  // PAYMENT REMINDER 3 DAYS BEFORE
  payment_reminder_3days: {
    subject: "Nivra — Rappel: Paiement dû dans 3 jours (#{{invoice_number}})",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('warning', '⚠️', 'Rappel urgent', 'Urgent reminder',
        'Votre facture arrive à échéance dans 3 jours.',
        'Your invoice is due in 3 days.'
      )}
      ${detailsCard([
        { label: 'Nº facture / Invoice #', value: vars.invoice_number || 'N/A' },
        { label: 'Montant dû / Amount due', value: formatCurrency(vars.balance_due || vars.amount) },
        { label: 'Échéance / Due date', value: vars.due_date ? formatDate(vars.due_date) : 'N/A' },
      ])}
      <p style="margin:20px 0 0; font-size:14px; color:${emailStyles.textSecondary};">
        Payez maintenant pour éviter toute interruption de vos services Nivra.<br>
        <em style="color:${emailStyles.textMuted};">Pay now to avoid any interruption of your Nivra services.</em>
      </p>
    `, joinUrl(config.baseUrl, "/portal/invoices"), "Payer maintenant / Pay now", config.supportEmail),
  },

  // PAYMENT REMINDER 1 DAY BEFORE
  payment_reminder_1day: {
    subject: "Nivra — URGENT: Paiement dû demain (#{{invoice_number}})",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('warning', '⏰', 'Dernier rappel!', 'Final reminder!',
        'Votre facture arrive à échéance DEMAIN.',
        'Your invoice is due TOMORROW.'
      )}
      ${detailsCard([
        { label: 'Nº facture / Invoice #', value: vars.invoice_number || 'N/A' },
        { label: 'Montant dû / Amount due', value: formatCurrency(vars.balance_due || vars.amount) },
        { label: 'Échéance / Due date', value: vars.due_date ? formatDate(vars.due_date) : 'N/A' },
      ])}
      <p style="margin:20px 0 0; font-size:14px; color:${emailStyles.textSecondary};">
        <strong>Action requise immédiatement.</strong> Votre service sera suspendu si le paiement n'est pas reçu.<br>
        <em style="color:${emailStyles.textMuted};"><strong>Immediate action required.</strong> Your service will be suspended if payment is not received.</em>
      </p>
    `, joinUrl(config.baseUrl, "/portal/invoices"), "Payer maintenant / Pay now", config.supportEmail),
  },

  // PAYMENT DUE TODAY
  payment_due_today: {
    subject: "Nivra — Paiement dû AUJOURD'HUI (#{{invoice_number}})",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('error', '🚨', 'Paiement dû aujourd\'hui!', 'Payment due today!',
        'Votre facture est due AUJOURD\'HUI. Payez maintenant pour éviter l\'interruption.',
        'Your invoice is due TODAY. Pay now to avoid interruption.'
      )}
      ${detailsCard([
        { label: 'Nº facture / Invoice #', value: vars.invoice_number || 'N/A' },
        { label: 'Montant dû / Amount due', value: formatCurrency(vars.balance_due || vars.amount) },
        { label: 'Échéance / Due date', value: 'AUJOURD\'HUI / TODAY' },
      ])}
      <p style="margin:20px 0 0; font-size:14px; color:${emailStyles.textSecondary};">
        Votre service sera suspendu à minuit si le paiement n'est pas reçu.<br>
        <em style="color:${emailStyles.textMuted};">Your service will be suspended at midnight if payment is not received.</em>
      </p>
    `, joinUrl(config.baseUrl, "/portal/invoices"), "Payer maintenant / Pay now", config.supportEmail),
  },

  // PAYMENT OVERDUE 1 DAY (J+1)
  payment_overdue_1day: {
    subject: "Nivra — Service en risque: Paiement en retard (#{{invoice_number}})",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('error', '⚠️', 'Paiement en retard', 'Payment overdue',
        'Votre facture est en retard. Votre service peut être suspendu à tout moment.',
        'Your invoice is overdue. Your service may be suspended at any time.'
      )}
      ${detailsCard([
        { label: 'Nº facture / Invoice #', value: vars.invoice_number || 'N/A' },
        { label: 'Montant dû / Amount due', value: formatCurrency(vars.balance_due || vars.amount) },
        { label: 'Échéance / Due date', value: vars.due_date ? formatDate(vars.due_date) : 'N/A' },
        { label: 'Jours de retard / Days overdue', value: '1 jour / 1 day' },
      ])}
      <p style="margin:20px 0 0; font-size:14px; color:${emailStyles.textSecondary};">
        Effectuez votre paiement immédiatement pour rétablir votre compte.<br>
        <em style="color:${emailStyles.textMuted};">Make your payment immediately to restore your account.</em>
      </p>
    `, joinUrl(config.baseUrl, "/portal/invoices"), "Payer maintenant / Pay now", config.supportEmail),
  },

  // PAYMENT OVERDUE WITH LATE FEE (J+3)
  payment_overdue_late_fee: {
    subject: "Nivra — Frais de retard appliqués (#{{invoice_number}})",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('error', '💰', 'Frais de retard appliqués', 'Late fee applied',
        'Des frais de retard de 5% ont été ajoutés à votre facture impayée.',
        'A 5% late fee has been added to your unpaid invoice.'
      )}
      ${detailsCard([
        { label: 'Nº facture / Invoice #', value: vars.invoice_number || 'N/A' },
        { label: 'Montant original / Original amount', value: formatCurrency(vars.amount) },
        { label: 'Frais de retard / Late fee', value: formatCurrency((vars.amount || 0) * 0.05) },
        { label: 'Nouveau total / New total', value: formatCurrency((vars.amount || 0) * 1.05) },
      ])}
      <p style="margin:20px 0 0; font-size:14px; color:${emailStyles.textSecondary};">
        Payez maintenant pour éviter des frais supplémentaires et la suspension de votre service.<br>
        <em style="color:${emailStyles.textMuted};">Pay now to avoid additional fees and service suspension.</em>
      </p>
    `, joinUrl(config.baseUrl, "/portal/invoices"), "Payer maintenant / Pay now", config.supportEmail),
  },

  // SERVICE WILL BE SUSPENDED (J+5)
  service_suspension_warning: {
    subject: "Nivra — AVIS FINAL: Suspension imminente (#{{invoice_number}})",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('error', '🔴', 'AVIS FINAL DE SUSPENSION', 'FINAL SUSPENSION NOTICE',
        'Votre service sera suspendu dans 24 heures si le paiement n\'est pas reçu.',
        'Your service will be suspended in 24 hours if payment is not received.'
      )}
      ${detailsCard([
        { label: 'Nº facture / Invoice #', value: vars.invoice_number || 'N/A' },
        { label: 'Montant dû / Amount due', value: formatCurrency(vars.balance_due || vars.amount) },
        { label: 'Jours de retard / Days overdue', value: vars.days_overdue || '5+' },
      ])}
      <p style="margin:20px 0 0; font-size:14px; color:${emailStyles.textSecondary};">
        <strong>Ceci est votre dernier avis avant suspension.</strong> Une fois suspendu, des frais de reconnexion peuvent s'appliquer.<br>
        <em style="color:${emailStyles.textMuted};"><strong>This is your final notice before suspension.</strong> Once suspended, reconnection fees may apply.</em>
      </p>
    `, joinUrl(config.baseUrl, "/portal/invoices"), "Payer maintenant / Pay now", config.supportEmail),
  },

  // PAYMENT CONFIRMED (V2 Billing)
  payment_confirmed: {
    subject: "Nivra — Paiement confirmé! (#{{invoice_number}})",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('success', '✅', 'Paiement confirmé!', 'Payment confirmed!',
        'Votre paiement a été confirmé et votre service est maintenant actif.',
        'Your payment has been confirmed and your service is now active.'
      )}
      ${detailsCard([
        { label: 'Nº facture / Invoice #', value: vars.invoice_number || 'N/A' },
        { label: 'Montant payé / Amount paid', value: formatCurrency(vars.amount || vars.total) },
        { label: 'Date de confirmation / Confirmation date', value: formatDate(new Date().toISOString()) },
        ...(vars.cycle_start_date && vars.cycle_end_date ? [
          { label: 'Période de service / Service period', value: `${formatDate(vars.cycle_start_date)} - ${formatDate(vars.cycle_end_date)}` }
        ] : []),
      ])}
      <p style="margin:20px 0 0; font-size:14px; color:${emailStyles.textSecondary};">
        Merci de faire confiance à Nivra Telecom! Votre service est actif et prêt à utiliser.<br>
        <em style="color:${emailStyles.textMuted};">Thank you for trusting Nivra Telecom! Your service is active and ready to use.</em>
      </p>
    `, joinUrl(config.baseUrl, "/portal"), "Voir mes services / View services", config.supportEmail),
  },

  // RENEWAL INVOICE CREATED (V2 Billing)
  renewal_invoice_created: {
    subject: "Nivra — Facture de renouvellement (#{{invoice_number}})",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('info', '🔄', 'Renouvellement à venir', 'Upcoming renewal',
        'Votre facture de renouvellement a été générée. Payez avant l\'échéance pour continuer votre service.',
        'Your renewal invoice has been generated. Pay before the due date to continue your service.'
      )}
      ${detailsCard([
        { label: 'Nº facture / Invoice #', value: vars.invoice_number || 'N/A' },
        { label: 'Montant / Amount', value: formatCurrency(vars.amount || vars.total) },
        { label: 'Échéance / Due date', value: vars.due_date ? formatDate(vars.due_date) : 'N/A' },
        { label: 'Prochaine période / Next period', value: vars.cycle_start_date ? `${formatDate(vars.cycle_start_date)} - ${formatDate(vars.cycle_end_date)}` : 'N/A' },
      ])}
      <p style="margin:20px 0 0; font-size:14px; color:${emailStyles.textSecondary};">
        Service prépayé: payez avant l'échéance pour éviter l'interruption.<br>
        <em style="color:${emailStyles.textMuted};">Prepaid service: pay before the due date to avoid interruption.</em>
      </p>
    `, joinUrl(config.baseUrl, "/portal/invoices"), "Payer maintenant / Pay now", config.supportEmail),
  },

  // =============================================
  // SECURITY TEMPLATES
  // =============================================

  // LOGIN ALERT
  login_alert: {
    subject: "Nivra — Nouvelle connexion détectée",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('warning', '🔐', 'Connexion détectée', 'Login detected',
        'Une nouvelle connexion a été détectée sur votre compte Nivra.',
        'A new login was detected on your Nivra account.'
      )}
      ${detailsCard([
        { label: 'Date et heure / Date & time', value: vars.login_time ? formatDate(vars.login_time, true) : formatDate(new Date().toISOString(), true) },
        ...(vars.ip_address ? [{ label: 'Adresse IP / IP address', value: vars.ip_address }] : []),
        ...(vars.device ? [{ label: 'Appareil / Device', value: vars.device }] : []),
        ...(vars.location ? [{ label: 'Localisation / Location', value: vars.location }] : []),
      ])}
      <p style="margin:20px 0 0; font-size:14px; color:${emailStyles.textSecondary};">
        Si vous n'êtes pas à l'origine de cette connexion, changez votre mot de passe immédiatement.<br>
        <em style="color:${emailStyles.textMuted};">If you did not initiate this login, change your password immediately.</em>
      </p>
    `, joinUrl(config.baseUrl, "/portal/profile"), "Sécuriser mon compte / Secure my account", config.supportEmail),
  },

  // NEW DEVICE LOGIN
  new_device_login: {
    subject: "Nivra — Connexion depuis un nouvel appareil",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('warning', '📱', 'Nouvel appareil détecté', 'New device detected',
        'Une connexion depuis un appareil inconnu a été détectée.',
        'A login from an unknown device was detected.'
      )}
      ${detailsCard([
        { label: 'Date et heure / Date & time', value: vars.login_time ? formatDate(vars.login_time, true) : formatDate(new Date().toISOString(), true) },
        ...(vars.device ? [{ label: 'Appareil / Device', value: vars.device }] : []),
        ...(vars.ip_address ? [{ label: 'Adresse IP / IP address', value: vars.ip_address }] : []),
        ...(vars.browser ? [{ label: 'Navigateur / Browser', value: vars.browser }] : []),
      ])}
      <p style="margin:20px 0 0; font-size:14px; color:${emailStyles.textSecondary};">
        Si vous reconnaissez cette activité, aucune action n'est requise. Sinon, sécurisez votre compte.<br>
        <em style="color:${emailStyles.textMuted};">If you recognize this activity, no action is needed. Otherwise, secure your account.</em>
      </p>
    `, joinUrl(config.baseUrl, "/portal/profile"), "Sécuriser mon compte / Secure my account", config.supportEmail),
  },

  // PASSWORD CHANGED
  password_changed: {
    subject: "Nivra — Mot de passe modifié",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('info', '🔑', 'Mot de passe modifié', 'Password changed',
        'Le mot de passe de votre compte Nivra a été modifié avec succès.',
        'Your Nivra account password has been changed successfully.'
      )}
      ${detailsCard([
        { label: 'Date / Date', value: formatDate(new Date().toISOString(), true) },
        ...(vars.ip_address ? [{ label: 'Adresse IP / IP address', value: vars.ip_address }] : []),
      ])}
      <p style="margin:20px 0 0; font-size:14px; color:${emailStyles.textSecondary};">
        Si vous n'avez pas effectué ce changement, contactez immédiatement notre support.<br>
        <em style="color:${emailStyles.textMuted};">If you did not make this change, contact our support immediately.</em>
      </p>
    `, joinUrl(config.baseUrl, "/portal/profile"), "Voir mon profil / View profile", config.supportEmail),
  },

  // EMAIL CHANGED
  email_changed: {
    subject: "Nivra — Adresse email modifiée",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('warning', '📧', 'Email modifié', 'Email changed',
        'L\'adresse email associée à votre compte Nivra a été modifiée.',
        'The email address associated with your Nivra account has been changed.'
      )}
      ${detailsCard([
        { label: 'Ancien email / Old email', value: vars.old_email || 'N/A' },
        { label: 'Nouvel email / New email', value: vars.new_email || 'N/A' },
        { label: 'Date', value: formatDate(new Date().toISOString(), true) },
      ])}
      <p style="margin:20px 0 0; font-size:14px; color:${emailStyles.textSecondary};">
        Si vous n'avez pas effectué ce changement, contactez immédiatement notre support.<br>
        <em style="color:${emailStyles.textMuted};">If you did not make this change, contact our support immediately.</em>
      </p>
    `, joinUrl(config.baseUrl, "/portal/profile"), "Contacter support / Contact support", config.supportEmail),
  },

  // ACCOUNT LOCKED
  account_locked: {
    subject: "Nivra — Compte verrouillé",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('error', '🔒', 'Compte verrouillé', 'Account locked',
        'Votre compte a été verrouillé suite à plusieurs tentatives de connexion échouées.',
        'Your account has been locked due to multiple failed login attempts.'
      )}
      ${detailsCard([
        { label: 'Date / Date', value: formatDate(new Date().toISOString(), true) },
        ...(vars.ip_address ? [{ label: 'Adresse IP / IP address', value: vars.ip_address }] : []),
        ...(vars.unlock_time ? [{ label: 'Déverrouillage / Unlock at', value: formatDate(vars.unlock_time, true) }] : []),
      ])}
      <p style="margin:20px 0 0; font-size:14px; color:${emailStyles.textSecondary};">
        Si vous êtes à l'origine de ces tentatives, attendez le déverrouillage automatique ou réinitialisez votre mot de passe.<br>
        <em style="color:${emailStyles.textMuted};">If you made these attempts, wait for automatic unlock or reset your password.</em>
      </p>
    `, joinUrl(config.baseUrl, "/reset-password"), "Réinitialiser mot de passe / Reset password", config.supportEmail),
  },

  // AUDIT MAGIC LINK (admin access to client account)
  audit_magiclink: {
    subject: "Nivra — Lien d'accès sécurisé à votre compte",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name || 'Client')}
      ${statusBadge('warning', '🔑', 'Accès administratif', 'Administrative access',
        'Un administrateur Nivra a généré un lien d\'accès sécurisé à votre compte pour une intervention autorisée.',
        'A Nivra administrator has generated a secure access link to your account for an authorized intervention.'
      )}
      ${detailsCard([
        { label: 'Raison / Reason', value: vars.reason || 'Intervention administrative' },
        ...(vars.expires_at ? [{ label: 'Expire le / Expires at', value: formatDate(vars.expires_at, true) }] : []),
        ...(vars.created_at ? [{ label: 'Créé le / Created at', value: formatDate(vars.created_at, true) }] : []),
      ])}
      <p style="margin:20px 0 0; font-size:14px; color:${emailStyles.textSecondary};">
        Ce lien est à usage unique et expire automatiquement. Si vous n'avez pas demandé cette intervention, contactez-nous immédiatement.<br>
        <em style="color:${emailStyles.textMuted};">This link is single-use and expires automatically. If you did not request this, contact us immediately.</em>
      </p>
    `, vars.action_link || '#', "Accéder à mon compte / Access my account", config.supportEmail),
  },


  // IDENTITY VERIFICATION REQUESTED
  identity_verification_requested: {
    subject: "Nivra — Vérification d'identité requise",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('info', '🪪', 'Vérification requise', 'Verification required',
        'Nous avons besoin de vérifier votre identité pour sécuriser votre compte.',
        'We need to verify your identity to secure your account.'
      )}
      <p style="margin:20px 0; font-size:14px; color:${emailStyles.textSecondary};">
        Veuillez soumettre une pièce d'identité valide via votre portail client.<br>
        <em style="color:${emailStyles.textMuted};">Please submit a valid ID through your client portal.</em>
      </p>
      <p style="margin:0; font-size:13px; color:${emailStyles.textMuted};">
        Documents acceptés : permis de conduire, passeport, carte d'assurance maladie.<br>
        <em>Accepted documents: driver's license, passport, health card.</em>
      </p>
    `, joinUrl(config.baseUrl, "/portal/verification"), "Soumettre mes documents / Submit documents", config.supportEmail),
  },

  // IDENTITY DOCUMENT RECEIVED
  identity_document_received: {
    subject: "Nivra — Documents de vérification reçus",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('info', '📄', 'Documents reçus', 'Documents received',
        'Nous avons bien reçu vos documents de vérification d\'identité.',
        'We have received your identity verification documents.'
      )}
      <p style="margin:20px 0; font-size:14px; color:${emailStyles.textSecondary};">
        Notre équipe examinera vos documents dans un délai de 24-48 heures ouvrables.<br>
        <em style="color:${emailStyles.textMuted};">Our team will review your documents within 24-48 business hours.</em>
      </p>
    `, joinUrl(config.baseUrl, "/portal/verification"), "Suivre ma vérification / Track verification", config.supportEmail),
  },

  // IDENTITY VERIFIED
  identity_verified: {
    subject: "Nivra — Identité vérifiée avec succès!",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('success', '✅', 'Identité vérifiée!', 'Identity verified!',
        'Votre identité a été vérifiée avec succès.',
        'Your identity has been successfully verified.'
      )}
      <p style="margin:20px 0; font-size:14px; color:${emailStyles.textSecondary};">
        Votre compte est maintenant pleinement vérifié et sécurisé.<br>
        <em style="color:${emailStyles.textMuted};">Your account is now fully verified and secured.</em>
      </p>
    `, joinUrl(config.baseUrl, "/portal"), "Accéder au portail / Access portal", config.supportEmail),
  },

  // IDENTITY REJECTED
  identity_rejected: {
    subject: "Nivra — Vérification d'identité non approuvée",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('error', '❌', 'Vérification refusée', 'Verification rejected',
        'Vos documents de vérification n\'ont pas pu être approuvés.',
        'Your verification documents could not be approved.'
      )}
      ${vars.rejection_reason ? detailsCard([
        { label: 'Raison / Reason', value: vars.rejection_reason },
      ]) : ''}
      <p style="margin:20px 0; font-size:14px; color:${emailStyles.textSecondary};">
        Veuillez soumettre de nouveaux documents conformes aux exigences.<br>
        <em style="color:${emailStyles.textMuted};">Please submit new documents that meet the requirements.</em>
      </p>
    `, joinUrl(config.baseUrl, "/portal/verification"), "Resoumettre / Resubmit", config.supportEmail),
  },

  // =============================================
  // PROFILE CHANGE TEMPLATES
  // =============================================

  // PROFILE CHANGE REQUESTED
  profile_change_requested: {
    subject: "Nivra — Demande de modification de profil reçue",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('info', '📝', 'Demande reçue', 'Request received',
        'Votre demande de modification de profil a été soumise.',
        'Your profile change request has been submitted.'
      )}
      ${detailsCard([
        ...(vars.field_changed ? [{ label: 'Champ modifié / Field changed', value: vars.field_changed }] : []),
        { label: 'Statut / Status', value: 'En attente d\'approbation / Pending approval' },
      ])}
      <p style="margin:20px 0; font-size:14px; color:${emailStyles.textSecondary};">
        Un membre de notre équipe examinera votre demande sous 24-48 heures.<br>
        <em style="color:${emailStyles.textMuted};">A team member will review your request within 24-48 hours.</em>
      </p>
    `, joinUrl(config.baseUrl, "/portal/profile"), "Voir mon profil / View profile", config.supportEmail),
  },

  // PROFILE CHANGE APPROVED
  profile_change_approved: {
    subject: "Nivra — Modification de profil approuvée",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('success', '✅', 'Modification approuvée!', 'Change approved!',
        'Votre demande de modification de profil a été approuvée et appliquée.',
        'Your profile change request has been approved and applied.'
      )}
      ${detailsCard([
        ...(vars.field_changed ? [{ label: 'Champ modifié / Field changed', value: vars.field_changed }] : []),
        ...(vars.new_value ? [{ label: 'Nouvelle valeur / New value', value: vars.new_value }] : []),
      ])}
    `, joinUrl(config.baseUrl, "/portal/profile"), "Voir mon profil / View profile", config.supportEmail),
  },

  // PROFILE CHANGE REJECTED
  profile_change_rejected: {
    subject: "Nivra — Modification de profil refusée",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('error', '❌', 'Modification refusée', 'Change rejected',
        'Votre demande de modification de profil n\'a pas pu être approuvée.',
        'Your profile change request could not be approved.'
      )}
      ${detailsCard([
        ...(vars.field_changed ? [{ label: 'Champ / Field', value: vars.field_changed }] : []),
        ...(vars.rejection_reason ? [{ label: 'Raison / Reason', value: vars.rejection_reason }] : []),
      ])}
      <p style="margin:20px 0; font-size:14px; color:${emailStyles.textSecondary};">
        Pour toute question, contactez notre support.<br>
        <em style="color:${emailStyles.textMuted};">For any questions, contact our support.</em>
      </p>
    `, joinUrl(config.baseUrl, "/portal/profile"), "Contacter support / Contact support", config.supportEmail),
  },

  // =============================================
  // SERVICE CHANGE TEMPLATES
  // =============================================

  // PLAN CHANGED
  plan_changed: {
    subject: "Nivra — Forfait modifié",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('success', '🔄', 'Forfait modifié!', 'Plan changed!',
        'Votre forfait a été modifié avec succès.',
        'Your plan has been changed successfully.'
      )}
      ${detailsCard([
        ...(vars.old_plan ? [{ label: 'Ancien forfait / Old plan', value: vars.old_plan }] : []),
        ...(vars.new_plan ? [{ label: 'Nouveau forfait / New plan', value: vars.new_plan }] : []),
        ...(vars.effective_date ? [{ label: 'Effectif le / Effective on', value: formatDate(vars.effective_date) }] : []),
      ])}
    `, joinUrl(config.baseUrl, "/portal/services"), "Voir mes services / View services", config.supportEmail),
  },

  // SERVICE CHANGED
  service_changed: {
    subject: "Nivra — Service modifié",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('info', '🔧', 'Service modifié', 'Service changed',
        'Un changement a été appliqué à votre service.',
        'A change has been applied to your service.'
      )}
      ${detailsCard([
        { label: 'Service', value: vars.service_name || 'N/A' },
        ...(vars.change_description ? [{ label: 'Changement / Change', value: vars.change_description }] : []),
        ...(vars.effective_date ? [{ label: 'Effectif le / Effective on', value: formatDate(vars.effective_date) }] : []),
      ])}
    `, joinUrl(config.baseUrl, "/portal/services"), "Voir mes services / View services", config.supportEmail),
  },

  // SERVICE FAILED
  service_failed: {
    subject: "Nivra — Problème d'activation de service",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('error', '❌', 'Activation échouée', 'Activation failed',
        'Un problème est survenu lors de l\'activation de votre service.',
        'An issue occurred during the activation of your service.'
      )}
      ${detailsCard([
        { label: 'Service', value: vars.service_name || 'N/A' },
        ...(vars.failure_reason ? [{ label: 'Raison / Reason', value: vars.failure_reason }] : []),
      ])}
      <p style="margin:20px 0; font-size:14px; color:${emailStyles.textSecondary};">
        Notre équipe travaille à résoudre ce problème. Nous vous contacterons dès que possible.<br>
        <em style="color:${emailStyles.textMuted};">Our team is working to resolve this issue. We will contact you as soon as possible.</em>
      </p>
    `, joinUrl(config.baseUrl, "/portal/orders"), "Voir ma commande / View order", config.supportEmail),
  },

  // REFUND ISSUED
  refund_issued: {
    subject: "Nivra — Remboursement effectué (#{{invoice_number}})",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('success', '💰', 'Remboursement effectué', 'Refund issued',
        'Un remboursement a été effectué sur votre compte.',
        'A refund has been issued to your account.'
      )}
      ${detailsCard([
        ...(vars.invoice_number ? [{ label: 'Nº facture / Invoice #', value: vars.invoice_number }] : []),
        { label: 'Montant remboursé / Refund amount', value: formatCurrency(vars.refund_amount || vars.amount) },
        { label: 'Méthode / Method', value: vars.refund_method || 'N/A' },
        { label: 'Date', value: formatDate(new Date().toISOString()) },
      ])}
      <p style="margin:20px 0; font-size:14px; color:${emailStyles.textSecondary};">
        Le remboursement sera reflété sur votre compte dans les 5-10 jours ouvrables.<br>
        <em style="color:${emailStyles.textMuted};">The refund will be reflected in your account within 5-10 business days.</em>
      </p>
    `, joinUrl(config.baseUrl, "/portal/invoices"), "Voir mes factures / View invoices", config.supportEmail),
  },

  // INVOICE PAID (Receipt)
  invoice_paid: {
    subject: "Nivra — Facture payée (#{{invoice_number}})",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('success', '✅', 'Facture payée!', 'Invoice paid!',
        'Votre facture a été payée intégralement.',
        'Your invoice has been fully paid.'
      )}
      ${detailsCard([
        { label: 'Nº facture / Invoice #', value: vars.invoice_number || 'N/A' },
        { label: 'Montant payé / Amount paid', value: formatCurrency(vars.amount || vars.total) },
        { label: 'Date de paiement / Payment date', value: vars.paid_at ? formatDate(vars.paid_at) : formatDate(new Date().toISOString()) },
        ...(vars.payment_method ? [{ label: 'Méthode / Method', value: vars.payment_method }] : []),
      ])}
      <p style="margin:20px 0; font-size:14px; color:${emailStyles.textSecondary};">
        Merci! Votre reçu de paiement est disponible dans votre portail.<br>
        <em style="color:${emailStyles.textMuted};">Thank you! Your payment receipt is available in your portal.</em>
      </p>
    `, joinUrl(config.baseUrl, "/portal/invoices"), "Voir mon reçu / View receipt", config.supportEmail),
  },

  // APPOINTMENT REMINDER
  appointment_reminder: {
    subject: "Nivra — Rappel: Rendez-vous demain",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('info', '📅', 'Rappel de rendez-vous', 'Appointment reminder',
        'Votre rendez-vous est prévu pour demain.',
        'Your appointment is scheduled for tomorrow.'
      )}
      ${detailsCard([
        { label: 'Date et heure / Date & time', value: vars.scheduled_date_time ? formatDate(vars.scheduled_date_time, true) : 'N/A' },
        ...(vars.service_address ? [{ label: 'Adresse / Address', value: vars.service_address }] : []),
        ...(vars.technician_name ? [{ label: 'Technicien / Technician', value: vars.technician_name }] : []),
        ...(vars.service_type ? [{ label: 'Service', value: vars.service_type }] : []),
      ])}
      <p style="margin:20px 0; font-size:14px; color:${emailStyles.textSecondary};">
        Assurez-vous qu'un adulte est présent à l'adresse pour accueillir le technicien.<br>
        <em style="color:${emailStyles.textMuted};">Please ensure an adult is present at the address to welcome the technician.</em>
      </p>
    `, joinUrl(config.baseUrl, vars.portal_path || "/portal/orders"), "Voir mon rendez-vous / View appointment", config.supportEmail),
  },

  // APPOINTMENT COMPLETED
  appointment_completed: {
    subject: "Nivra — Rendez-vous terminé",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('success', '✅', 'Rendez-vous terminé!', 'Appointment completed!',
        'Votre rendez-vous a été complété avec succès.',
        'Your appointment has been completed successfully.'
      )}
      ${detailsCard([
        ...(vars.service_type ? [{ label: 'Service', value: vars.service_type }] : []),
        ...(vars.technician_name ? [{ label: 'Technicien / Technician', value: vars.technician_name }] : []),
      ])}
      <p style="margin:20px 0; font-size:14px; color:${emailStyles.textSecondary};">
        Merci de faire confiance à Nivra Telecom! Profitez de vos services.<br>
        <em style="color:${emailStyles.textMuted};">Thank you for trusting Nivra Telecom! Enjoy your services.</em>
      </p>
    `, joinUrl(config.baseUrl, "/portal"), "Accéder au portail / Access portal", config.supportEmail),
  },

  // MOBILE STATUS (Generic for send-mobile-status-email)
  mobile_status: {
    subject: "Nivra — Mise à jour de votre ligne mobile (#{{order_number}})",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('info', '📱', 'Mise à jour mobile', 'Mobile update',
        vars.status_message_fr || 'Le statut de votre ligne mobile a été mis à jour.',
        vars.status_message_en || 'Your mobile line status has been updated.'
      )}
      ${detailsCard([
        ...(vars.order_number ? [{ label: 'Nº commande / Order #', value: vars.order_number }] : []),
        { label: 'Statut / Status', value: vars.status_label || vars.status || 'N/A' },
        ...(vars.phone_number ? [{ label: 'Numéro / Number', value: vars.phone_number }] : []),
      ])}
    `, joinUrl(config.baseUrl, vars.portal_path || "/portal/orders"), "Suivre ma commande / Track order", config.supportEmail),
  },

  // INSTALLATION STATUS (Generic)
  installation_status: {
    subject: "Nivra — Mise à jour d'installation (#{{order_number}})",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('info', '🔧', 'Mise à jour installation', 'Installation update',
        vars.status_message_fr || 'Le statut de votre installation a été mis à jour.',
        vars.status_message_en || 'Your installation status has been updated.'
      )}
      ${detailsCard([
        ...(vars.order_number ? [{ label: 'Nº commande / Order #', value: vars.order_number }] : []),
        { label: 'Statut / Status', value: vars.status_label || vars.status || 'N/A' },
        ...(vars.service_address ? [{ label: 'Adresse / Address', value: vars.service_address }] : []),
      ])}
    `, joinUrl(config.baseUrl, vars.portal_path || "/portal/orders"), "Suivre ma commande / Track order", config.supportEmail),
  },

  // CANCELLATION CONFIRMED (alias for when user requests say this exact key)
  cancellation_confirmed: {
    subject: "Nivra — Annulation de service confirmée",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('info', '📋', 'Annulation confirmée', 'Cancellation confirmed',
        'Votre demande d\'annulation de service a été confirmée.',
        'Your service cancellation request has been confirmed.'
      )}
      ${detailsCard([
        ...(vars.service_name ? [{ label: 'Service', value: vars.service_name }] : []),
        ...(vars.effective_date ? [{ label: 'Date effective / Effective date', value: formatDate(vars.effective_date) }] : []),
      ])}
      <p style="margin:20px 0; font-size:14px; color:${emailStyles.textSecondary};">
        Merci d'avoir été client chez Nivra. Nous serons heureux de vous accueillir à nouveau.<br>
        <em style="color:${emailStyles.textMuted};">Thank you for being a Nivra customer. We'd be happy to welcome you back.</em>
      </p>
    `, joinUrl(config.baseUrl, "/portal"), "Retour au portail / Back to portal", config.supportEmail),
  },

  // INVOICE DUE REMINDER (generic)
  invoice_due_reminder: {
    subject: "Nivra — Rappel: Facture à payer (#{{invoice_number}})",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('warning', '📅', 'Rappel de paiement', 'Payment reminder',
        'Votre facture arrive bientôt à échéance.',
        'Your invoice is due soon.'
      )}
      ${detailsCard([
        { label: 'Nº facture / Invoice #', value: vars.invoice_number || 'N/A' },
        { label: 'Montant dû / Amount due', value: formatCurrency(vars.balance_due || vars.amount) },
        { label: 'Échéance / Due date', value: vars.due_date ? formatDate(vars.due_date) : 'N/A' },
      ])}
      <p style="margin:20px 0; font-size:14px; color:${emailStyles.textSecondary};">
        Payez avant l'échéance pour éviter toute interruption de service.<br>
        <em style="color:${emailStyles.textMuted};">Pay before the due date to avoid any service interruption.</em>
      </p>
    `, joinUrl(config.baseUrl, "/portal/invoices"), "Payer maintenant / Pay now", config.supportEmail),
  },

  // =============================================
  // PAYPAL RECURRING TEMPLATES
  // =============================================

  paypal_recurring_approval: {
    subject: "Nivra — Activez votre paiement automatique / Activate automatic payments",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('info', '🔄', 'Paiement automatique', 'Automatic payments',
        'Votre commande a été payée avec succès. Pour activer la facturation automatique mensuelle, veuillez approuver votre abonnement PayPal.',
        'Your order has been paid successfully. To activate automatic monthly billing, please approve your PayPal subscription.'
      )}
      ${detailsCard([
        ...(vars.order_number ? [{ label: 'Nº commande / Order #', value: vars.order_number }] : []),
        { label: 'Plan', value: vars.plan_name || 'N/A' },
        { label: 'Montant mensuel / Monthly amount', value: formatCurrency(vars.monthly_amount) },
      ])}
      <div style="text-align:center; margin:28px 0;">
        <a href="${vars.approval_url}" target="_blank" style="display:inline-block; background:${emailStyles.primary}; color:#fff; padding:14px 36px; border-radius:8px; text-decoration:none; font-weight:600; font-size:16px;">
          Approuver sur PayPal / Approve on PayPal
        </a>
      </div>
      <p style="margin:20px 0; font-size:13px; color:${emailStyles.textMuted};">
        Ce lien vous redirige vers PayPal pour autoriser les prélèvements automatiques mensuels. Aucun paiement supplémentaire ne sera prélevé aujourd'hui.<br>
        <em>This link redirects you to PayPal to authorize automatic monthly payments. No additional payment will be charged today.</em>
      </p>
    `, vars.approval_url || joinUrl(config.baseUrl, "/portal"), "Approuver sur PayPal / Approve on PayPal", config.supportEmail),
  },

  paypal_subscription_activated: {
    subject: "Nivra — Paiement automatique activé ✅ / Automatic payments activated",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('success', '✅', 'Paiement automatique activé', 'Automatic payments activated',
        'Votre abonnement PayPal est maintenant actif. Vos prochaines factures seront payées automatiquement.',
        'Your PayPal subscription is now active. Your future invoices will be paid automatically.'
      )}
      ${detailsCard([
        ...(vars.order_number ? [{ label: 'Nº commande / Order #', value: vars.order_number }] : []),
        { label: 'Plan', value: vars.plan_name || 'N/A' },
        { label: 'Montant mensuel / Monthly amount', value: formatCurrency(vars.monthly_amount) },
        ...(vars.next_billing_date ? [{ label: 'Prochain prélèvement / Next charge', value: formatDate(vars.next_billing_date) }] : []),
      ])}
    `, joinUrl(config.baseUrl, "/portal/subscriptions"), "Voir mes abonnements / View subscriptions", config.supportEmail),
  },

  paypal_subscription_cancelled: {
    subject: "Nivra — Paiement automatique annulé / Automatic payments cancelled",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('warning', '⚠️', 'Paiement automatique annulé', 'Automatic payments cancelled',
        'Votre abonnement PayPal a été annulé. Vos prochaines factures devront être payées manuellement.',
        'Your PayPal subscription has been cancelled. Future invoices must be paid manually.'
      )}
      ${detailsCard([
        { label: 'Plan', value: vars.plan_name || 'N/A' },
        ...(vars.reason ? [{ label: 'Raison / Reason', value: vars.reason }] : []),
      ])}
    `, joinUrl(config.baseUrl, "/portal/invoices"), "Voir mes factures / View invoices", config.supportEmail),
  },

  paypal_recurring_payment_failed: {
    subject: "Nivra — Échec du paiement automatique / Automatic payment failed",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('error', '❌', 'Échec du paiement', 'Payment failed',
        'Votre paiement automatique PayPal a échoué. Veuillez vérifier votre compte PayPal ou payer manuellement.',
        'Your automatic PayPal payment has failed. Please check your PayPal account or pay manually.'
      )}
      ${detailsCard([
        { label: 'Plan', value: vars.plan_name || 'N/A' },
        { label: 'Montant / Amount', value: formatCurrency(vars.amount) },
      ])}
    `, joinUrl(config.baseUrl, "/portal/invoices"), "Payer maintenant / Pay now", config.supportEmail),
  },
};

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

        // Generate attachments: passthrough > full document set > single PDF
        let attachments: Array<{ filename: string; content: string }> | undefined;
        if (templateVars._attachments && Array.isArray(templateVars._attachments)) {
          attachments = templateVars._attachments;
          console.log(`[ATTACHMENTS PASSTHROUGH] email_id=${email.id} count=${attachments.length}`);
        } else if (FULL_DOCUMENT_SET_TEMPLATES.has(templateKey)) {
          // Order/payment confirmation → attach ALL 4 PDFs
          const fullSet = generateFullDocumentSet(templateVars);
          if (fullSet.length > 0) {
            attachments = fullSet;
            console.log(`[FULL DOC SET] email_id=${email.id} files=${fullSet.map(f => f.filename).join(', ')}`);
          }
        } else {
          // Other templates → single PDF based on type
          const pdfAttachment = generateEmailPDFAttachment(templateKey, templateVars);
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
