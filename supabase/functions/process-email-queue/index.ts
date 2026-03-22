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

// ============================================================================
// CANONICAL PDF GENERATION — fetches real data from DB, identical to frontend
// No template_vars-based reconstruction. Uses compute_invoice_breakdown RPC.
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

// --- Helpers mirroring src/lib/pdf/canonicalDocumentService.ts ---

function requireField(value: string | undefined | null, fieldName: string): string {
  if (!value || value === "—" || value === "N/A" || value === "À confirmer" || value === "000000" || value.trim() === "") {
    return "Non fourni par le client";
  }
  return value.trim();
}

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

function buildClientName(order: any, profile: any): string {
  const fromOrder = [order.client_first_name, order.client_last_name].filter(Boolean).join(" ");
  if (fromOrder) return fromOrder;
  if (profile?.full_name) return profile.full_name;
  return [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "";
}

function resolvePaymentMethod(order: any, payments: any[]): string {
  const completed = payments.find((p: any) => p.status === "confirmed" || p.status === "completed");
  if (completed?.method) return completed.method;
  return order.payment_method || "";
}

interface BreakdownItem {
  description: string;
  line_type: string;
  quantity: number;
  unit_price_cents: number;
  line_total_cents: number;
}

interface Breakdown {
  items: BreakdownItem[];
  subtotal: number;
  tps_amount: number;
  tvq_amount: number;
  total: number;
  amount_paid: number;
  balance_due: number;
  discounts_total: number;
  status: string;
  type: string;
  order_id?: string;
  used_stored_totals?: boolean;
}

function structureFromBreakdown(bd: Breakdown, order: any) {
  const services: Array<{ type: string; name: string; monthly_price: number }> = [];
  const equipment: Array<{ name: string; quantity: number; unit_price: number }> = [];
  const fees: Array<{ label: string; amount: number }> = [];
  const discounts: Array<{ label: string; amount: number }> = [];
  const invoiceItems: Array<{ category: string; description: string; qty: number; unit_price: number; amount: number; is_recurring: boolean; service_address?: string }> = [];

  for (const item of bd.items) {
    const amount = item.line_total_cents / 100;
    const unitPrice = item.unit_price_cents / 100;
    const qty = item.quantity || 1;

    if (item.line_type === "discount" || item.line_type === "credit") {
      discounts.push({ label: item.description, amount: Math.abs(amount) });
      continue;
    }

    const descLower = item.description.toLowerCase();
    const isFee = descLower.includes("frais") || descLower.includes("activation") || descLower.includes("livraison") || descLower.includes("installation") || descLower.includes("shipping") || descLower.includes("delivery");
    const isEquipment = descLower.includes("routeur") || descLower.includes("router") || descLower.includes("modem") || descLower.includes("terminal") || descLower.includes("décodeur") || descLower.includes("sim") || descLower.includes("équipement");

    if (item.line_type === "equipment" || isEquipment) {
      equipment.push({ name: item.description, quantity: qty, unit_price: unitPrice });
      invoiceItems.push({ category: "Equipment", description: item.description, qty, unit_price: unitPrice, amount, is_recurring: false });
    } else if (item.line_type === "fee" || isFee) {
      fees.push({ label: item.description, amount });
      invoiceItems.push({ category: "Fees", description: item.description, qty, unit_price: unitPrice, amount, is_recurring: false });
    } else {
      const type = descLower.includes("internet") || descLower.includes("giga") ? "Internet"
        : descLower.includes("mobile") || descLower.includes("talk") || descLower.includes("text") ? "Mobile"
        : descLower.includes("tv") || descLower.includes("télé") ? "TV"
        : descLower.includes("streaming") ? "Streaming"
        : descLower.includes("sécurité") || descLower.includes("security") ? "Sécurité"
        : "Télécom";
      services.push({ type, name: item.description, monthly_price: amount });
      invoiceItems.push({ category: type, description: item.description, qty, unit_price: unitPrice, amount, is_recurring: bd.type === "renewal", service_address: order.shipping_address });
    }
  }

  const subtotalMonthly = services.reduce((s, sv) => s + sv.monthly_price, 0);
  const subtotalOnetime = equipment.reduce((s, e) => s + e.unit_price * e.quantity, 0) + fees.reduce((s, f) => s + f.amount, 0);

  return { services, equipment, fees, invoiceItems, discounts, subtotal: bd.subtotal, subtotalMonthly, subtotalOnetime, discountAmount: bd.discounts_total, tpsAmount: bd.tps_amount, tvqAmount: bd.tvq_amount, total: bd.total, amountPaid: bd.amount_paid, balanceDue: bd.balance_due };
}

// --- Canonical data fetcher (mirrors fetchCanonicalDocumentData) ---

async function fetchCanonicalData(supabase: ReturnType<typeof createClient>, vars: Record<string, any>) {
  let order: any = null;
  let billingInvoice: any = null;

  const orderId = vars.order_id;
  const invoiceId = vars.invoice_id;
  const invoiceNumber = vars.invoice_number;

  // Route 1: from invoice_id
  if (invoiceId) {
    const { data } = await supabase.from("billing_invoices").select("*").eq("id", invoiceId).maybeSingle();
    billingInvoice = data;
    if (data?.order_id) {
      const { data: o } = await supabase.from("orders").select("*").eq("id", data.order_id).maybeSingle();
      order = o;
    }
  }

  // Route 2: from invoice_number
  if (!billingInvoice && invoiceNumber) {
    const { data } = await supabase.from("billing_invoices").select("*").eq("invoice_number", invoiceNumber).order("created_at", { ascending: false }).limit(1).maybeSingle();
    billingInvoice = data;
    if (data?.order_id && !order) {
      const { data: o } = await supabase.from("orders").select("*").eq("id", data.order_id).maybeSingle();
      order = o;
    }
  }

  // Route 3: from order_id
  if (!order && orderId) {
    const { data } = await supabase.from("orders").select("*").eq("id", orderId).maybeSingle();
    order = data;
  }

  // Get invoice from order if not yet found
  if (!billingInvoice && order?.id) {
    const { data } = await supabase.from("billing_invoices").select("*").eq("order_id", order.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    billingInvoice = data;
  }

  if (!order) {
    console.warn("[PDF CANONICAL] No order found for PDF generation");
    return null;
  }

  const userId = order.user_id;
  const invId = billingInvoice?.id;

  // Fetch all related data in parallel
  const [profileRes, accountRes, contractRes, paymentsRes, linesRes] = await Promise.all([
    userId ? supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle() : Promise.resolve({ data: null }),
    userId ? supabase.from("accounts").select("*").eq("client_id", userId).order("created_at", { ascending: true }).limit(1).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("contracts").select("*").eq("order_id", order.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    invId ? supabase.from("billing_payments").select("*").eq("invoice_id", invId).order("created_at", { ascending: false }) : Promise.resolve({ data: [] }),
    invId ? supabase.from("billing_invoice_lines").select("*").eq("invoice_id", invId).order("created_at", { ascending: true }) : Promise.resolve({ data: [] }),
  ]);

  // Fetch breakdown via RPC
  let breakdown: Breakdown | null = null;
  if (invId) {
    try {
      const { data, error } = await supabase.rpc("compute_invoice_breakdown", { p_invoice_id: invId });
      if (!error && data) {
        breakdown = data as unknown as Breakdown;
      } else {
        console.warn("[PDF CANONICAL] compute_invoice_breakdown failed:", error);
      }
    } catch (e) {
      console.warn("[PDF CANONICAL] Breakdown RPC exception:", e);
    }
  }

  return {
    order,
    profile: profileRes.data,
    account: accountRes.data,
    billingInvoice,
    billingPayments: paymentsRes.data || [],
    billingInvoiceLines: linesRes.data || [],
    contract: contractRes.data,
    breakdown,
  };
}

// --- Canonical PDF builders (mirrors canonicalDocumentService.ts + documentBuilder.ts) ---

function buildCanonicalInvoiceData(data: any): InvoiceDataV2 {
  const { order, profile, account, billingInvoice, billingPayments = [], breakdown } = data;
  const addr = buildCustomerAddress(order, profile, account);
  const paymentMethod = resolvePaymentMethod(order, billingPayments);
  const clientName = buildClientName(order, profile);

  if (!breakdown) throw new Error("Breakdown requis pour facture");
  const s = structureFromBreakdown(breakdown, order);

  const invoiceStatus = breakdown.status || billingInvoice?.status || (["captured", "paid", "confirmed"].includes(order.payment_status) ? "paid" : "unpaid");
  const snapshotClient = billingInvoice?.billing_snapshot_client as any;
  const liveAccountNumber = account?.account_number;
  const snapshotAccountNumber = billingInvoice?.billing_snapshot_account_number;

  return {
    invoice_type: "ONETIME",
    invoice_number: billingInvoice?.invoice_number || order.order_number?.toString() || "—",
    invoice_date: billingInvoice?.created_at || order.created_at,
    due_date: billingInvoice?.due_date || billingInvoice?.created_at || order.created_at,
    account_number: requireField(liveAccountNumber || snapshotAccountNumber, "account_number"),
    billing_period_start: billingInvoice?.cycle_start_date,
    billing_period_end: billingInvoice?.cycle_end_date,
    currency: "CAD",
    status: invoiceStatus as any,
    customer: {
      full_name: requireField(snapshotClient?.full_name || snapshotClient?.name || clientName, "client_name"),
      email: requireField(snapshotClient?.email || order.client_email || profile?.email, "client_email"),
      phone: requireField(snapshotClient?.phone || order.client_phone || profile?.phone, "client_phone"),
      address_line1: requireField(snapshotClient?.address_line1 || addr.address_line1, "address_line1"),
      city: requireField(snapshotClient?.city || addr.city, "city"),
      province: snapshotClient?.province || addr.province || "QC",
      postal_code: requireField(snapshotClient?.postal_code || addr.postal_code, "postal_code"),
    },
    items: s.invoiceItems.map(item => ({ ...item, category: item.category as any, service_address: item.service_address || addr.service || undefined, reference: order.order_number?.toString() })),
    discounts: s.discounts.map(d => ({ label: d.label, amount: d.amount, applies_to: "services" })),
    subtotal: s.subtotal,
    subtotal_monthly: s.subtotalMonthly,
    subtotal_onetime: s.subtotalOnetime,
    taxes: { gst_rate: 0.05, gst_amount: s.tpsAmount, qst_rate: 0.09975, qst_amount: s.tvqAmount },
    total: s.total,
    balance_due: s.balanceDue,
    payments: billingPayments.filter((p: any) => ["confirmed", "completed", "captured"].includes(p.status)).map((p: any) => ({
      method: p.method || paymentMethod, status: "Confirmed" as const, paid_amount: Number(p.amount || 0),
      paid_at: p.received_at || p.created_at, payment_reference: p.payment_number || p.reference || "—", processor_txn_id: p.provider_payment_id,
    })),
    payments_total: s.amountPaid,
  };
}

function buildCanonicalReceiptData(data: any): LockedReceiptData | null {
  const { order, profile, account, billingInvoice, billingPayments = [], breakdown } = data;
  const clientName = buildClientName(order, profile);
  const addr = buildCustomerAddress(order, profile, account);

  const confirmedPayment = billingPayments.find((p: any) => ["confirmed", "completed", "captured"].includes(p.status));
  if (!confirmedPayment && (!breakdown || breakdown.amount_paid <= 0)) return null;

  const amountPaid = confirmedPayment ? Number(confirmedPayment.amount) : (breakdown?.amount_paid || 0);

  return {
    receipt_number: confirmedPayment?.payment_number || confirmedPayment?.reference || billingInvoice?.invoice_number || order.order_number?.toString() || "—",
    payment_date: confirmedPayment?.received_at || confirmedPayment?.created_at || order.paid_at || order.updated_at || "",
    payment_method: confirmedPayment?.method || order.payment_method || "Interac",
    amount_paid: amountPaid,
    invoice_number: billingInvoice?.invoice_number || order.order_number?.toString() || "",
    invoice_total: breakdown?.total || billingInvoice?.total || 0,
    order_number: order.order_number?.toString(),
    client_name: requireField(clientName, "client_name"),
    client_email: requireField(order.client_email || profile?.email, "client_email"),
    client_phone: order.client_phone || profile?.phone || undefined,
    client_address: addr.billing || addr.service || undefined,
    account_number: requireField(account?.account_number, "account_number"),
    billed_items: breakdown ? breakdown.items.filter((i: any) => i.line_type !== "discount" && i.line_type !== "credit").map((i: any) => ({ description: i.description, amount: i.line_total_cents / 100 })) : undefined,
    transaction_reference: confirmedPayment?.provider_payment_id || confirmedPayment?.reference || undefined,
    balance_remaining: breakdown ? breakdown.balance_due : (billingInvoice?.balance_due || 0),
    subtotal: breakdown?.subtotal,
    discount_amount: breakdown?.discounts_total || 0,
    discount_label: breakdown?.items.filter((i: any) => i.line_type === "discount").map((i: any) => i.description).join(", ") || undefined,
    tps_amount: breakdown?.tps_amount,
    tvq_amount: breakdown?.tvq_amount,
  };
}

function buildCanonicalContractData(data: any): ContractDataV3 {
  const { order, profile, account, contract, billingPayments = [], breakdown } = data;
  const addr = buildCustomerAddress(order, profile, account);
  const paymentMethod = resolvePaymentMethod(order, billingPayments);
  const clientName = buildClientName(order, profile);

  if (!breakdown) throw new Error("Breakdown requis pour contrat");
  const s = structureFromBreakdown(breakdown, order);

  return {
    contract_number: contract?.contract_number || order.related_contract_id || `CTR-${order.order_number || order.id?.slice(0, 8)}`,
    contract_date: contract?.created_at || order.created_at,
    terms_version: "v5.0",
    client_name: requireField(clientName, "client_name"),
    client_email: requireField(order.client_email || profile?.email, "client_email"),
    client_phone: requireField(order.client_phone || profile?.phone, "client_phone"),
    client_dob: order.client_dob,
    billing_address: requireField(addr.billing, "billing_address"),
    service_address: requireField(addr.service, "service_address"),
    account_number: requireField(account?.account_number, "account_number"),
    order_number: requireField(order.order_number?.toString(), "order_number"),
    services: s.services,
    equipment: s.equipment,
    one_time_fees: s.fees,
    subtotal_monthly: s.subtotalMonthly,
    subtotal_one_time: s.subtotalOnetime,
    discount_amount: s.discountAmount,
    tax_gst: s.tpsAmount,
    tax_qst: s.tvqAmount,
    total_due_today: s.total,
    payment_method: paymentMethod,
    is_signed: contract?.is_signed || contract?.status === "signed_by_client" || contract?.status === "fully_signed",
    signature_name: contract?.client_signer_name || clientName,
    signature_date: contract?.client_signed_at || contract?.signed_at,
    signature_ip: contract?.client_ip,
    admin_signature_name: contract?.admin_signer_name,
    admin_signature_date: contract?.admin_signed_at,
  };
}

function buildCanonicalSummaryData(data: any): OrderSummaryV3Data {
  const { order, profile, account, billingPayments = [], breakdown } = data;
  const addr = buildCustomerAddress(order, profile, account);
  const paymentMethod = resolvePaymentMethod(order, billingPayments);
  const clientName = buildClientName(order, profile);

  if (!breakdown) throw new Error("Breakdown requis pour sommaire");
  const s = structureFromBreakdown(breakdown, order);

  return {
    order_number: requireField(order.order_number?.toString(), "order_number"),
    order_date: order.created_at,
    order_status: order.status || "pending",
    client_name: requireField(clientName, "client_name"),
    client_email: requireField(order.client_email || profile?.email, "client_email"),
    client_phone: requireField(order.client_phone || profile?.phone, "client_phone"),
    service_address: requireField(addr.service, "service_address"),
    account_number: requireField(account?.account_number, "account_number"),
    services: s.services,
    equipment: s.equipment,
    fees: s.fees,
    subtotal_monthly: s.subtotalMonthly,
    subtotal_onetime: s.subtotalOnetime,
    discount_amount: s.discountAmount,
    discount_label: s.discounts.length > 0 ? s.discounts.map(d => d.label).join(", ") : order.promo_code ? `Promo: ${order.promo_code}` : undefined,
    tax_gst: s.tpsAmount,
    tax_qst: s.tvqAmount,
    total_due: s.total,
    delivery_method: order.delivery_method || order.installation_method,
    payment_method: paymentMethod,
    payment_status: order.payment_status,
    estimated_activation: order.estimated_activation,
  };
}

// --- Generate PDF using locked templates ---

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

// --- Main canonical PDF attachment generator ---

async function generateCanonicalPDFAttachment(
  supabase: ReturnType<typeof createClient>,
  templateKey: string,
  vars: Record<string, any>,
): Promise<PDFAttachment | null> {
  const pdfType = PDF_ATTACHMENT_TEMPLATES[templateKey];
  if (!pdfType) return null;

  try {
    const canonicalData = await fetchCanonicalData(supabase, vars);
    if (!canonicalData) {
      console.warn(`[PDF CANONICAL] No canonical data found for ${templateKey}, skipping PDF attachment`);
      return null;
    }

    if (!canonicalData.breakdown) {
      console.warn(`[PDF CANONICAL] No breakdown available for ${templateKey}, skipping PDF attachment`);
      return null;
    }

    let pdfData: any;
    if (pdfType === "invoice") {
      pdfData = buildCanonicalInvoiceData(canonicalData);
    } else if (pdfType === "receipt") {
      pdfData = buildCanonicalReceiptData(canonicalData);
      if (!pdfData) {
        console.warn(`[PDF CANONICAL] No confirmed payment for receipt, skipping`);
        return null;
      }
    } else if (pdfType === "contract") {
      pdfData = buildCanonicalContractData(canonicalData);
    } else {
      pdfData = buildCanonicalSummaryData(canonicalData);
    }

    return await lockedPdfToAttachment(pdfType, pdfData);
  } catch (error) {
    console.error(`[PDF CANONICAL] Error generating ${pdfType} for ${templateKey}:`, error);
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
            .select("service_address, service_city, service_province, service_postal_code")
            .eq("id", cust.user_id)
            .maybeSingle();
          if (profile?.service_address) {
            enriched.client_address = [profile.service_address, profile.service_city, profile.service_province, profile.service_postal_code].filter(Boolean).join(", ");
            if (profile.service_city) enriched.client_city = profile.service_city;
            if (profile.service_province) enriched.client_province = profile.service_province;
            if (profile.service_postal_code) enriched.client_postal_code = profile.service_postal_code;
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
          .select("user_id, client_full_address, shipping_address, shipping_city, shipping_province, shipping_postal_code")
          .eq("id", orderId)
          .maybeSingle();
        const orderAddr = order?.client_full_address || order?.shipping_address;
        if (orderAddr) {
          enriched.client_address = enriched.service_address = orderAddr;
          if (order?.shipping_city) enriched.client_city = order.shipping_city;
          if (order?.shipping_postal_code) enriched.client_postal_code = order.shipping_postal_code;
        }
        if (!hasPhone && order?.user_id) {
          const { data: prof } = await supabase
            .from("profiles")
            .select("phone, service_address, service_city, service_province, service_postal_code")
            .eq("id", order.user_id)
            .maybeSingle();
          if (prof?.phone && !enriched.client_phone) enriched.client_phone = prof.phone;
          if (prof?.service_address && !enriched.client_address) {
            enriched.client_address = [prof.service_address, prof.service_city, prof.service_province, prof.service_postal_code].filter(Boolean).join(", ");
          }
        }
      }
    }

    // Strategy 3: Look up via to_email as last resort
    if ((!enriched.client_phone || !enriched.client_address) && vars.to_email) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("phone, service_address, service_city, service_province, service_postal_code")
        .eq("email", vars.to_email)
        .maybeSingle();
      if (prof) {
        if (!enriched.client_phone && prof.phone) enriched.client_phone = prof.phone;
        if (!enriched.client_address && prof.service_address) {
          enriched.client_address = [prof.service_address, prof.service_city, prof.service_province, prof.service_postal_code].filter(Boolean).join(", ");
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

        // Generate PDF attachment from CANONICAL database data (not template_vars)
        let attachments: Array<{ filename: string; content: string }> | undefined;
        if (templateVars._attachments && Array.isArray(templateVars._attachments)) {
          attachments = templateVars._attachments;
          console.log(`[ATTACHMENTS PASSTHROUGH] email_id=${email.id} count=${attachments.length}`);
        } else {
          const pdfAttachment = await generateCanonicalPDFAttachment(supabase, templateKey, templateVars);
          if (pdfAttachment) {
            attachments = [{ filename: pdfAttachment.filename, content: pdfAttachment.content }];
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
