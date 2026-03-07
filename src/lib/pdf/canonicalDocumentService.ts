/**
 * Canonical Document Service
 * 
 * SINGLE SOURCE OF TRUTH for PDF generation across admin AND client portals.
 * Both portals call the same functions with the same data builders.
 * 
 * The client portal must NEVER assemble its own document data.
 * It must use this service which mirrors the admin document pipeline exactly.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { generateInvoiceV3PDF } from "./invoiceTemplateV3";
import { generateContractV3PDF, type ContractDataV3 } from "./contractTemplateV3";
import { generateContractSummaryPDF, type ContractSummaryData } from "./contractSummaryTemplate";
import { generateOrderSummaryPDF, type OrderSummaryV3Data } from "./orderSummaryTemplate";
import { generateServiceTermsPDF, CURRENT_TERMS_VERSION } from "./serviceTermsTemplate";
import type { InvoiceDataV2, PDFGenerationResult, InvoiceItem } from "./types";
import { TAX } from "./companyInfo";
import { fetchInvoiceBreakdown, type InvoiceBreakdown } from "@/lib/billing/useInvoiceBreakdown";

// ============================================================================
// PORTABLE DATA FETCHER — works with ANY Supabase client (admin or portal)
// ============================================================================

export interface CanonicalDocumentData {
  order: any;
  profile: any;
  account: any;
  billingInvoice?: any;
  billingInvoiceLines?: any[];
  billingPayments?: any[];
  contract?: any;
  breakdown?: InvoiceBreakdown | null;
}

/**
 * Fetch all data needed for canonical document generation.
 * Works with both adminClient and portalClient.
 */
export async function fetchCanonicalDocumentData(
  client: SupabaseClient,
  params: { orderId?: string; invoiceId?: string; contractId?: string; userId?: string }
): Promise<CanonicalDocumentData | null> {
  let order: any = null;
  let billingInvoice: any = null;

  // Route 1: from orderId
  if (params.orderId) {
    const { data } = await client.from("orders").select("*").eq("id", params.orderId).maybeSingle();
    order = data;
  }

  // Route 2: from invoiceId → get order
  if (params.invoiceId) {
    const { data: inv } = await client.from("billing_invoices").select("*").eq("id", params.invoiceId).maybeSingle();
    billingInvoice = inv;
    if (inv?.order_id && !order) {
      const { data } = await client.from("orders").select("*").eq("id", inv.order_id).maybeSingle();
      order = data;
    }
  }

  // Route 3: from contractId → get order
  if (params.contractId && !order) {
    const { data: ct } = await client.from("contracts").select("*").eq("id", params.contractId).maybeSingle();
    if (ct?.order_id) {
      const { data } = await client.from("orders").select("*").eq("id", ct.order_id).maybeSingle();
      order = data;
    }
  }

  if (!order) {
    console.error("[CanonicalDocService] No order found for params:", params);
    return null;
  }

  const userId = order.user_id || params.userId;

  // Fetch all related data in parallel
  const [profileRes, accountRes, invoiceRes, contractRes] = await Promise.all([
    client.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
    client.from("accounts").select("*").eq("client_id", userId).order("created_at", { ascending: true }).limit(1).maybeSingle(),
    billingInvoice
      ? Promise.resolve({ data: billingInvoice, error: null })
      : client.from("billing_invoices").select("*").eq("order_id", order.id).maybeSingle(),
    client.from("contracts").select("*").eq("order_id", order.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const invoice = invoiceRes.data;
  const invoiceId = invoice?.id;
  let breakdown: InvoiceBreakdown | null = null;
  let billingPayments: any[] = [];
  let billingInvoiceLines: any[] = [];

  if (invoiceId) {
    try {
      breakdown = await fetchInvoiceBreakdown(invoiceId, client);
    } catch (e) {
      console.error("[CanonicalDocService] Breakdown RPC failed:", e);
    }

    const [paymentsRes, linesRes] = await Promise.all([
      client.from("billing_payments").select("*").eq("invoice_id", invoiceId).order("created_at", { ascending: false }),
      client.from("billing_invoice_lines").select("*").eq("invoice_id", invoiceId).order("created_at", { ascending: true }),
    ]);
    billingPayments = paymentsRes.data || [];
    billingInvoiceLines = linesRes.data || [];
  }

  return {
    order,
    profile: profileRes.data,
    account: accountRes.data,
    billingInvoice: invoice,
    billingInvoiceLines,
    billingPayments,
    contract: contractRes.data,
    breakdown,
  };
}

// ============================================================================
// SHARED HELPERS — identical to documentBuilder.ts (single logic)
// ============================================================================

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
  const province = order.shipping_province || account?.primary_service_province || "QC";
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

// ============================================================================
// BREAKDOWN → STRUCTURED DATA (identical to documentBuilder.ts)
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

    if (item.line_type === "discount" || item.line_type === "credit") {
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
    services, equipment, fees, invoiceItems, discounts,
    subtotal: bd.subtotal, subtotalMonthly, subtotalOnetime,
    discountAmount: bd.discounts_total,
    tpsAmount: bd.tps_amount, tvqAmount: bd.tvq_amount,
    total: bd.total, amountPaid: bd.amount_paid, balanceDue: bd.balance_due,
  };
}

function fallbackStructure(order: any, billingInvoice: any, billingInvoiceLines: any[], billingPayments: any[]): StructuredFromBreakdown {
  const services: StructuredFromBreakdown["services"] = [];
  const equipment: StructuredFromBreakdown["equipment"] = [];
  const fees: StructuredFromBreakdown["fees"] = [];
  const invoiceItems: InvoiceItem[] = [];

  if (billingInvoiceLines?.length > 0) {
    for (const line of billingInvoiceLines) {
      const desc = line.description || "Service";
      const amount = Number(line.line_total || 0);
      const qty = Number(line.quantity || 1);
      const unitPrice = Number(line.unit_price || amount);
      const lineType = line.line_type || "service";
      if (lineType === "discount" || lineType === "credit" || amount < 0) continue;
      if (lineType === "equipment") {
        equipment.push({ name: desc, quantity: qty, unit_price: unitPrice });
        invoiceItems.push({ category: "Equipment", description: desc, qty, unit_price: unitPrice, amount, is_recurring: false });
      } else if (lineType === "fee") {
        fees.push({ label: desc, amount });
        invoiceItems.push({ category: "Fees", description: desc, qty, unit_price: unitPrice, amount, is_recurring: false });
      } else {
        services.push({ type: "Service", name: desc, monthly_price: amount });
        invoiceItems.push({ category: "Other" as any, description: desc, qty, unit_price: unitPrice, amount, is_recurring: true });
      }
    }
  } else if (order.service_type) {
    const price = Number(order.subtotal || order.total_amount || 0);
    services.push({ type: order.category || "Service", name: order.service_type, monthly_price: price });
    invoiceItems.push({ category: "Other" as any, description: order.service_type, qty: 1, unit_price: price, amount: price, is_recurring: true });
  }

  const subtotalMonthly = services.reduce((s, sv) => s + sv.monthly_price, 0);
  const subtotalOnetime = equipment.reduce((s, e) => s + e.unit_price * e.quantity, 0) + fees.reduce((s, f) => s + f.amount, 0);
  const subtotal = billingInvoice ? Number(billingInvoice.subtotal || 0) : subtotalMonthly + subtotalOnetime;
  const discountAmount = Number(order.discount_amount || 0);
  const taxableBase = Math.max(0, subtotal - discountAmount);
  const tpsAmount = billingInvoice ? Number(billingInvoice.tps_amount || 0) : Math.round(taxableBase * TAX.GST_RATE * 100) / 100;
  const tvqAmount = billingInvoice ? Number(billingInvoice.tvq_amount || 0) : Math.round(taxableBase * TAX.QST_RATE * 100) / 100;
  const total = billingInvoice ? Number(billingInvoice.total || 0) : Math.round((taxableBase + tpsAmount + tvqAmount) * 100) / 100;
  const amountPaid = billingPayments
    .filter((p: any) => p.status === "confirmed" || p.status === "completed" || p.status === "captured")
    .reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0) || Number(order.amount_paid || 0);
  const balanceDue = Math.max(0, Math.round((total - amountPaid) * 100) / 100);

  return {
    services, equipment, fees, invoiceItems,
    discounts: discountAmount > 0 ? [{ label: order.promo_code ? `Promo: ${order.promo_code}` : "Rabais appliqué", amount: discountAmount }] : [],
    subtotal, subtotalMonthly, subtotalOnetime, discountAmount, tpsAmount, tvqAmount, total, amountPaid, balanceDue,
  };
}

// ============================================================================
// CANONICAL BUILDERS — identical output to documentBuilder.ts
// ============================================================================

export function buildCanonicalInvoiceData(data: CanonicalDocumentData): InvoiceDataV2 {
  const { order, profile, account, billingInvoice, billingInvoiceLines, billingPayments = [], breakdown } = data;
  const addr = buildCustomerAddress(order, profile, account);
  const paymentMethod = resolvePaymentMethod(order, billingPayments);
  const clientName = buildClientName(order, profile);

  const structured = breakdown
    ? structureFromBreakdown(breakdown, order)
    : fallbackStructure(order, billingInvoice, billingInvoiceLines || [], billingPayments);

  const invoiceStatus = breakdown?.status || billingInvoice?.status ||
    (["captured", "paid", "confirmed"].includes(order.payment_status) ? "paid" : "unpaid");

  // Use immutable snapshot data (source of truth for documents)
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
      label: d.label, amount: d.amount, applies_to: "services",
    })) : [],

    subtotal: structured.subtotal,
    taxes: {
      gst_rate: TAX.GST_RATE, gst_amount: structured.tpsAmount,
      qst_rate: TAX.QST_RATE, qst_amount: structured.tvqAmount,
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

export function buildCanonicalContractData(data: CanonicalDocumentData): ContractDataV3 {
  const { order, profile, account, contract, billingInvoice, billingInvoiceLines, billingPayments = [], breakdown } = data;
  const addr = buildCustomerAddress(order, profile, account);
  const paymentMethod = resolvePaymentMethod(order, billingPayments);
  const clientName = buildClientName(order, profile);

  const structured = breakdown
    ? structureFromBreakdown(breakdown, order)
    : fallbackStructure(order, billingInvoice, billingInvoiceLines || [], billingPayments);

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
    signature_name: contract?.client_signer_name || contract?.client_signature || clientName,
    signature_date: contract?.client_signed_at || contract?.signed_at,
    signature_ip: contract?.client_ip,
    admin_signature_name: contract?.admin_signer_name,
    admin_signature_date: contract?.admin_signed_at,
  };
}

// ============================================================================
// CANONICAL PDF GENERATORS — wrapper functions
// ============================================================================

/**
 * Generate canonical invoice PDF from any Supabase client.
 * Returns identical output regardless of admin or portal context.
 */
export async function generateCanonicalInvoicePDF(
  client: SupabaseClient,
  invoiceId: string
): Promise<PDFGenerationResult> {
  try {
    // Get breakdown from RPC (canonical source of truth)
    const breakdown = await fetchInvoiceBreakdown(invoiceId, client);
    if (!breakdown) {
      return { success: false, error: "Aucune donnée de facturation trouvée" };
    }

    // Get order data if available
    let order: any = null;
    if (breakdown.order_id) {
      const { data } = await client.from("orders").select("*").eq("id", breakdown.order_id).maybeSingle();
      order = data;
    }

    // If no order, build minimal order-like object from breakdown
    if (!order) {
      order = {
        id: breakdown.order_id || invoiceId,
        user_id: null,
        created_at: breakdown.created_at,
        status: breakdown.status,
      };
    }

    const userId = order.user_id;
    const [profileRes, accountRes] = await Promise.all([
      userId ? client.from("profiles").select("*").eq("user_id", userId).maybeSingle() : Promise.resolve({ data: null }),
      userId ? client.from("accounts").select("*").eq("client_id", userId).order("created_at", { ascending: true }).limit(1).maybeSingle() : Promise.resolve({ data: null }),
    ]);

    // Fetch payments
    const { data: payments } = await client.from("billing_payments").select("*").eq("invoice_id", invoiceId).order("created_at", { ascending: false });

    // Get billing invoice for snapshot data
    const { data: billingInvoice } = await client.from("billing_invoices").select("*").eq("id", invoiceId).maybeSingle();

    const docData: CanonicalDocumentData = {
      order,
      profile: profileRes.data,
      account: accountRes.data,
      billingInvoice,
      billingPayments: payments || [],
      breakdown,
    };

    const invoiceData = buildCanonicalInvoiceData(docData);
    return generateInvoiceV3PDF(invoiceData);
  } catch (e: any) {
    console.error("[CanonicalDocService] Invoice PDF generation failed:", e);
    return { success: false, error: e.message || "Erreur de génération" };
  }
}

/**
 * Generate canonical contract PDF from any Supabase client.
 */
export async function generateCanonicalContractPDF(
  client: SupabaseClient,
  contractId: string
): Promise<PDFGenerationResult> {
  try {
    const data = await fetchCanonicalDocumentData(client, { contractId });
    if (!data) {
      return { success: false, error: "Données du contrat introuvables" };
    }

    const contractData = buildCanonicalContractData(data);
    return generateContractV3PDF(contractData);
  } catch (e: any) {
    console.error("[CanonicalDocService] Contract PDF generation failed:", e);
    return { success: false, error: e.message || "Erreur de génération" };
  }
}
