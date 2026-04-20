/**
 * pdfFromDb — Centralized helper to build PDF base64 attachments from DB IDs.
 *
 * LOCKED TEMPLATES ONLY (V4.0 — 2026-03-20):
 *   - Invoice  → locked-pdf/invoiceTemplateV3.ts  (generateInvoiceV3PDF)
 *   - Receipt  → locked-pdf/receiptTemplate.ts    (generateReceiptPDF)
 *   - Contract → locked-pdf/contractTemplateV3.ts (generateContractV3PDF)
 *   - Summary  → locked-pdf/orderSummaryTemplate.ts (generateOrderSummaryPDF)
 *
 * NEVER use the legacy ./pdfGenerator.ts here. These are the only approved
 * generators per src/lib/pdf/LOCKED_TEMPLATES.md.
 *
 * Every function is non-blocking: returns null on any error so the caller
 * can still send the email (without the attachment).
 */

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { generateInvoiceV3PDF } from "./locked-pdf/invoiceTemplateV3.ts";
import { generateReceiptPDF, type ReceiptData } from "./locked-pdf/receiptTemplate.ts";
import { generateContractV3PDF, type ContractDataV3 } from "./locked-pdf/contractTemplateV3.ts";
import { generateOrderSummaryPDF, type OrderSummaryV3Data } from "./locked-pdf/orderSummaryTemplate.ts";
import type { InvoiceDataV2 } from "./locked-pdf/types.ts";

export interface QueuedAttachment {
  filename: string;
  content: string; // base64
  contentType: string;
}

function getServiceClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key);
}

/** Convert a Blob returned by jsPDF into a base64 string. */
async function blobToBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < buf.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, Array.from(buf.subarray(i, i + CHUNK)) as any);
  }
  return btoa(binary);
}

// ============================================================================
// INVOICE — uses locked invoiceTemplateV3 (generateInvoiceV3PDF)
// ============================================================================
export async function buildInvoicePdfAttachment(
  invoiceId: string,
  filenamePrefix: string = "Facture",
): Promise<QueuedAttachment | null> {
  try {
    const supabase = getServiceClient();

    const { data: invoice, error: invErr } = await supabase
      .from("billing_invoices")
      .select(`
        id, invoice_number, created_at, due_date, total, subtotal,
        tps_amount, tvq_amount, amount_paid, balance_due, status,
        cycle_start_date, cycle_end_date, type,
        billing_snapshot_account_number,
        customer:billing_customers(id, email, first_name, last_name, phone, user_id),
        order:orders(id, order_number, service_type),
        lines:billing_invoice_lines(description, quantity, unit_price, line_total, line_type, metadata)
      `)
      .eq("id", invoiceId)
      .maybeSingle();

    if (invErr || !invoice) {
      console.warn(`[pdfFromDb] invoice ${invoiceId} not found:`, invErr?.message);
      return null;
    }

    const customer = (invoice as any).customer || {};
    const lines: any[] = (invoice as any).lines || [];
    const order = (invoice as any).order || {};
    const clientName = `${customer.first_name || ""} ${customer.last_name || ""}`.trim() || "Client";

    let accountNumber = (invoice as any).billing_snapshot_account_number || "";
    let acctRow: any = null;
    if (customer.user_id) {
      const { data } = await supabase
        .from("accounts")
        .select("account_number, billing_address, billing_city, billing_province, billing_postal_code")
        .eq("client_id", customer.user_id)
        .maybeSingle();
      acctRow = data;
      if (!accountNumber) accountNumber = data?.account_number || "";
    }
    if (!accountNumber) {
      console.warn(`[pdfFromDb] invoice ${invoiceId} has no account_number — skipping PDF`);
      return null;
    }

    const items = lines.map((l) => ({
      category: (l.line_type as any) || "Other",
      description: l.description || "Service",
      qty: Number(l.quantity || 1),
      unit_price: Number(l.unit_price ?? 0),
      amount: Number(l.line_total ?? l.unit_price ?? 0),
      is_recurring: l.line_type === "recurring" || l.line_type === "service",
    }));

    const isPaid = ((invoice as any).status || "").toLowerCase() === "paid";

    const data: InvoiceDataV2 = {
      invoice_type: ((invoice as any).type || "MONTHLY").toUpperCase() === "ONETIME" ? "ONETIME" : "MONTHLY",
      invoice_number: (invoice as any).invoice_number || `INV-${invoiceId.slice(0, 8)}`,
      invoice_date: (invoice as any).created_at,
      due_date: (invoice as any).due_date,
      account_number: accountNumber,
      billing_period_start: (invoice as any).cycle_start_date,
      billing_period_end: (invoice as any).cycle_end_date,
      currency: "CAD",
      status: ((invoice as any).status || "Pending") as any,
      customer: {
        full_name: clientName,
        email: customer.email || "",
        phone: customer.phone || undefined,
        address_line1: acctRow?.billing_address || "",
        city: acctRow?.billing_city || "",
        province: acctRow?.billing_province || "QC",
        postal_code: acctRow?.billing_postal_code || "",
      },
      items: items.length ? items : [{
        category: "Other",
        description: "Service Nivra",
        qty: 1,
        unit_price: Number((invoice as any).subtotal ?? (invoice as any).total ?? 0),
        amount: Number((invoice as any).subtotal ?? (invoice as any).total ?? 0),
      }],
      subtotal: Number((invoice as any).subtotal || 0),
      taxes: {
        gst_rate: 0.05,
        gst_amount: Number((invoice as any).tps_amount || 0),
        qst_rate: 0.09975,
        qst_amount: Number((invoice as any).tvq_amount || 0),
      },
      total: Number((invoice as any).total || 0),
      balance_due: Number((invoice as any).balance_due ?? (invoice as any).total ?? 0),
      payments_total: Number((invoice as any).amount_paid || 0),
      payments: isPaid ? [{
        method: "Confirmed" as any,
        status: "Confirmed" as any,
        paid_amount: Number((invoice as any).amount_paid || (invoice as any).total || 0),
        payment_reference: "",
      }] : [],
    };

    const result = generateInvoiceV3PDF(data);
    if (!result.success || !result.blob) {
      console.warn(`[pdfFromDb] generateInvoiceV3PDF failed: ${result.error}`);
      return null;
    }
    const base64 = await blobToBase64(result.blob);
    const invNum = (invoice as any).invoice_number || invoiceId.slice(0, 8);
    return {
      filename: result.filename || `${filenamePrefix}_${invNum}_Nivra.pdf`,
      content: base64,
      contentType: "application/pdf",
    };
  } catch (err) {
    console.error("[pdfFromDb] buildInvoicePdfAttachment error:", err);
    return null;
  }
}

// ============================================================================
// RECEIPT — uses locked receiptTemplate (generateReceiptPDF)
// ============================================================================
export async function buildReceiptPdfAttachment(
  invoiceId: string,
  filenamePrefix: string = "Recu",
): Promise<QueuedAttachment | null> {
  try {
    const supabase = getServiceClient();

    const { data: invoice, error: invErr } = await supabase
      .from("billing_invoices")
      .select(`
        id, invoice_number, created_at, paid_at, total, subtotal,
        tps_amount, tvq_amount, amount_paid, payment_method, balance_due,
        billing_snapshot_account_number,
        customer:billing_customers(email, first_name, last_name, phone, user_id),
        order:orders(order_number),
        lines:billing_invoice_lines(description, line_total, line_type)
      `)
      .eq("id", invoiceId)
      .maybeSingle();

    if (invErr || !invoice) {
      console.warn(`[pdfFromDb] receipt invoice ${invoiceId} not found:`, invErr?.message);
      return null;
    }

    const { data: payment } = await supabase
      .from("billing_payments")
      .select("amount, method, reference, received_at, captured_at, created_at, payment_number")
      .eq("invoice_id", invoiceId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const customer = (invoice as any).customer || {};
    const order = (invoice as any).order || {};
    const lines: any[] = (invoice as any).lines || [];
    const clientName = `${customer.first_name || ""} ${customer.last_name || ""}`.trim() || "Client";

    let accountNumber = (invoice as any).billing_snapshot_account_number || "";
    let acctRow: any = null;
    if (customer.user_id) {
      const { data } = await supabase
        .from("accounts")
        .select("account_number, billing_address, billing_city, billing_province, billing_postal_code")
        .eq("client_id", customer.user_id)
        .maybeSingle();
      acctRow = data;
      if (!accountNumber) accountNumber = data?.account_number || "";
    }
    if (!accountNumber) {
      console.warn(`[pdfFromDb] receipt ${invoiceId} has no account_number — skipping PDF`);
      return null;
    }

    const clientAddress = acctRow
      ? [acctRow.billing_address, acctRow.billing_city, acctRow.billing_province, acctRow.billing_postal_code]
          .filter(Boolean).join(", ")
      : undefined;

    const data: ReceiptData = {
      receipt_number: payment?.payment_number || `REC-${invoiceId.slice(0, 8)}`,
      payment_date: payment?.received_at || payment?.captured_at || (invoice as any).paid_at || new Date().toISOString(),
      payment_method: payment?.method || (invoice as any).payment_method || "Inconnu",
      amount_paid: Number(payment?.amount ?? (invoice as any).amount_paid ?? (invoice as any).total ?? 0),
      invoice_number: (invoice as any).invoice_number || "",
      invoice_total: Number((invoice as any).total || 0),
      order_number: order.order_number || undefined,
      client_name: clientName,
      client_email: customer.email || "",
      client_phone: customer.phone || undefined,
      client_address: clientAddress,
      account_number: accountNumber,
      billed_items: lines.map((l) => ({
        description: l.description || "Article",
        amount: Number(l.line_total || 0),
      })),
      transaction_reference: payment?.reference || undefined,
      balance_remaining: Number((invoice as any).balance_due || 0),
      subtotal: Number((invoice as any).subtotal || 0),
      tps_amount: Number((invoice as any).tps_amount || 0),
      tvq_amount: Number((invoice as any).tvq_amount || 0),
    };

    const result = generateReceiptPDF(data);
    if (!result.success || !result.blob) {
      console.warn(`[pdfFromDb] generateReceiptPDF failed: ${result.error}`);
      return null;
    }
    const base64 = await blobToBase64(result.blob);
    const num = payment?.payment_number || (invoice as any).invoice_number || invoiceId.slice(0, 8);
    return {
      filename: result.filename || `${filenamePrefix}_${num}_Nivra.pdf`,
      content: base64,
      contentType: "application/pdf",
    };
  } catch (err) {
    console.error("[pdfFromDb] buildReceiptPdfAttachment error:", err);
    return null;
  }
}

// ============================================================================
// CONTRACT — uses locked contractTemplateV3 (generateContractV3PDF)
// ============================================================================
export async function buildContractPdfAttachment(
  orderId: string,
  opts: { contractNumber?: string; filenamePrefix?: string } = {},
): Promise<QueuedAttachment | null> {
  try {
    const supabase = getServiceClient();

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select(`
        id, order_number, created_at, service_type, category,
        client_email, client_first_name, client_last_name, client_phone,
        client_full_address,
        shipping_address, shipping_city, shipping_postal_code,
        subtotal, total_amount, tps_amount, tvq_amount,
        equipment_details, equipment_line_details,
        user_id
      `)
      .eq("id", orderId)
      .maybeSingle();

    if (orderErr || !order) {
      console.warn(`[pdfFromDb] order ${orderId} not found:`, orderErr?.message);
      return null;
    }

    const o = order as any;
    const clientName = `${o.client_first_name || ""} ${o.client_last_name || ""}`.trim() || "Client";
    const clientAddress = o.client_full_address
      || [o.shipping_address, o.shipping_city, o.shipping_postal_code].filter(Boolean).join(", ");

    let accountNumber = "";
    if (o.user_id) {
      const { data: acct } = await supabase
        .from("accounts")
        .select("account_number")
        .eq("client_id", o.user_id)
        .maybeSingle();
      accountNumber = acct?.account_number || "";
    }

    const lineDetails = Array.isArray(o.equipment_line_details) ? o.equipment_line_details : [];
    const monthlyLines = lineDetails.filter((l: any) => l?.is_recurring || l?.recurring);
    const oneTimeLines = lineDetails.filter((l: any) => !(l?.is_recurring || l?.recurring));

    const services = monthlyLines.length > 0
      ? monthlyLines.map((l: any) => ({
          type: l.type || o.service_type || "Service",
          name: l.name || l.product_name || "Service",
          description: l.description || "",
          monthly_price: Number(l.price || l.unit_price || 0),
        }))
      : [{
          type: o.service_type || "Service",
          name: o.service_type || o.category || "Service Nivra",
          description: "",
          monthly_price: Number(o.subtotal || o.total_amount || 0),
        }];

    const equipment = oneTimeLines
      .filter((l: any) => (l.category === "Equipment" || l.kind === "equipment" || l.is_equipment))
      .map((l: any) => ({
        name: l.name || l.product_name || "Equipement",
        quantity: Number(l.quantity || 1),
        unit_price: Number(l.price || l.unit_price || 0),
      }));

    const oneTimeFees = oneTimeLines
      .filter((l: any) => !(l.category === "Equipment" || l.kind === "equipment" || l.is_equipment))
      .map((l: any) => ({
        label: l.name || l.product_name || l.description || "Frais",
        amount: Number(l.price || l.unit_price || 0),
      }));

    const subtotalMonthly = services.reduce((acc: number, s: any) => acc + s.monthly_price, 0);
    const subtotalOneTime = oneTimeLines.reduce((acc: number, l: any) => acc + Number(l.price || l.unit_price || 0), 0);

    const data: ContractDataV3 = {
      contract_number: opts.contractNumber || `CTR-${o.order_number || orderId.slice(0, 8)}`,
      contract_date: o.created_at,
      terms_version: "V5.0",
      client_name: clientName,
      client_email: o.client_email || "",
      client_phone: o.client_phone || "",
      billing_address: clientAddress || "",
      service_address: clientAddress || "",
      account_number: accountNumber || "—",
      order_number: o.order_number || orderId.slice(0, 8),
      services,
      equipment,
      one_time_fees: oneTimeFees,
      subtotal_monthly: subtotalMonthly,
      subtotal_one_time: subtotalOneTime,
      discount_amount: 0,
      tax_gst: Number(o.tps_amount || 0),
      tax_qst: Number(o.tvq_amount || 0),
      total_due_today: Number(o.total_amount || 0),
    };

    const result = generateContractV3PDF(data);
    if (!result.success || !result.blob) {
      console.warn(`[pdfFromDb] generateContractV3PDF failed: ${result.error}`);
      return null;
    }
    const base64 = await blobToBase64(result.blob);
    const prefix = opts.filenamePrefix || "Contrat";
    return {
      filename: result.filename || `${prefix}_${o.order_number || orderId.slice(0, 8)}_Nivra.pdf`,
      content: base64,
      contentType: "application/pdf",
    };
  } catch (err) {
    console.error("[pdfFromDb] buildContractPdfAttachment error:", err);
    return null;
  }
}

// ============================================================================
// ORDER SUMMARY — uses locked orderSummaryTemplate (generateOrderSummaryPDF)
// ============================================================================
export async function buildSummaryPdfAttachment(
  orderId: string,
  filenamePrefix: string = "Sommaire",
): Promise<QueuedAttachment | null> {
  try {
    const supabase = getServiceClient();

    const { data: o, error } = await supabase
      .from("orders")
      .select(`
        id, order_number, created_at, status, service_type, category,
        subtotal, tps_amount, tvq_amount, total_amount,
        appointment_date,
        client_first_name, client_last_name, client_email, client_phone,
        client_full_address,
        shipping_address, shipping_city, shipping_postal_code,
        equipment_line_details, equipment_details, user_id
      `)
      .eq("id", orderId)
      .maybeSingle();

    if (error || !o) {
      console.warn("[pdfFromDb] buildSummaryPdfAttachment: order not found", orderId, error?.message);
      return null;
    }

    const clientName = [(o as any).client_first_name, (o as any).client_last_name].filter(Boolean).join(" ").trim() || "Client";
    const clientAddr = (o as any).client_full_address
      || [(o as any).shipping_address, (o as any).shipping_city, (o as any).shipping_postal_code].filter(Boolean).join(", ")
      || "";

    let accountNumber = "";
    if ((o as any).user_id) {
      const { data: acct } = await supabase
        .from("accounts")
        .select("account_number")
        .eq("client_id", (o as any).user_id)
        .maybeSingle();
      accountNumber = acct?.account_number || "";
    }

    const items = Array.isArray((o as any).equipment_line_details) ? (o as any).equipment_line_details : [];
    const monthly = items.filter((l: any) => l?.is_recurring || l?.recurring);
    const oneTime = items.filter((l: any) => !(l?.is_recurring || l?.recurring));

    const services = monthly.length > 0
      ? monthly.map((l: any) => ({
          type: l.type || (o as any).service_type || "Service",
          name: l.name || l.product_name || "Service",
          description: l.description || "",
          monthly_price: Number(l.price || l.unit_price || 0),
        }))
      : [{
          type: (o as any).service_type || "Service",
          name: (o as any).service_type || (o as any).category || "Service Nivra",
          description: "",
          monthly_price: Number((o as any).subtotal || (o as any).total_amount || 0),
        }];

    const equipment = oneTime
      .filter((l: any) => (l.category === "Equipment" || l.kind === "equipment" || l.is_equipment))
      .map((l: any) => ({
        name: l.name || l.product_name || "Equipement",
        quantity: Number(l.quantity || 1),
        unit_price: Number(l.price || l.unit_price || 0),
      }));

    const fees = oneTime
      .filter((l: any) => !(l.category === "Equipment" || l.kind === "equipment" || l.is_equipment))
      .map((l: any) => ({
        label: l.name || l.product_name || l.description || "Frais",
        amount: Number(l.price || l.unit_price || 0),
      }));

    const subtotalMonthly = services.reduce((acc: number, s: any) => acc + s.monthly_price, 0);
    const subtotalOneTime = oneTime.reduce((acc: number, l: any) => acc + Number(l.price || l.unit_price || 0), 0);

    const data: OrderSummaryV3Data = {
      order_number: (o as any).order_number || orderId.slice(0, 8).toUpperCase(),
      order_date: (o as any).created_at,
      order_status: (o as any).status || "En cours",
      client_name: clientName,
      client_email: (o as any).client_email || "",
      client_phone: (o as any).client_phone || "",
      service_address: clientAddr,
      account_number: accountNumber || "—",
      services,
      equipment,
      fees,
      subtotal_monthly: subtotalMonthly,
      subtotal_onetime: subtotalOneTime,
      discount_amount: 0,
      tax_gst: Number((o as any).tps_amount || 0),
      tax_qst: Number((o as any).tvq_amount || 0),
      total_due: Number((o as any).total_amount || (o as any).subtotal || subtotalMonthly + subtotalOneTime),
      estimated_activation: (o as any).appointment_date || undefined,
    };

    const result = generateOrderSummaryPDF(data);
    if (!result.success || !result.blob) {
      console.warn(`[pdfFromDb] generateOrderSummaryPDF failed: ${result.error}`);
      return null;
    }
    const base64 = await blobToBase64(result.blob);
    return {
      filename: result.filename || `${filenamePrefix}_${(o as any).order_number || orderId.slice(0, 8)}_Nivra.pdf`,
      content: base64,
      contentType: "application/pdf",
    };
  } catch (err) {
    console.error("[pdfFromDb] buildSummaryPdfAttachment error:", err);
    return null;
  }
}
