/**
 * pdfFromDb — Centralized helper to build PDF base64 attachments from DB IDs.
 *
 * Used by all transactional email senders that need to attach an Invoice,
 * Receipt, or Contract PDF to the outgoing email. Loads the canonical
 * data from billing_invoices / billing_invoice_lines / billing_customers /
 * orders / contracts and renders via the shared pdfGenerator.
 *
 * Every function is non-blocking: returns null on any error (the caller
 * should send the email anyway, just without the attachment) and logs
 * the failure to the console.
 */

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import {
  generateInvoicePDF,
  generateReceiptPDF,
  generateContractPDF,
  generateSummaryPDF,
  type InvoiceData,
  type ReceiptData,
  type ContractData,
  type SummaryData,
} from "./pdfGenerator.ts";

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

/**
 * Build an Invoice PDF attachment from a billing_invoices row id.
 * Returns null on any error; caller should still send the email.
 */
export async function buildInvoicePdfAttachment(
  invoiceId: string,
  filenamePrefix: string = "facture",
): Promise<QueuedAttachment | null> {
  try {
    const supabase = getServiceClient();

    const { data: invoice, error: invErr } = await supabase
      .from("billing_invoices")
      .select(`
        id, invoice_number, created_at, due_date, total, subtotal,
        tps_amount, tvq_amount, amount_paid, balance_due, status,
        cycle_start_date, cycle_end_date,
        billing_snapshot_account_number,
        customer:billing_customers(id, email, first_name, last_name, phone, user_id),
        order:orders(id, order_number, service_type),
        lines:billing_invoice_lines(description, quantity, unit_price, line_total, line_type)
      `)
      .eq("id", invoiceId)
      .maybeSingle();

    if (invErr || !invoice) {
      console.warn(`[pdfFromDb] invoice ${invoiceId} not found:`, invErr?.message);
      return null;
    }

    const customer = (invoice as any).customer || {};
    const lines: any[] = (invoice as any).lines || [];
    const clientName = `${customer.first_name || ""} ${customer.last_name || ""}`.trim() || "Client";

    // Resolve account_number — required by generateInvoicePDF
    let accountNumber = (invoice as any).billing_snapshot_account_number || "";
    if (!accountNumber && customer.user_id) {
      const { data: acct } = await supabase
        .from("accounts")
        .select("account_number, billing_address, billing_city, billing_postal_code")
        .eq("client_id", customer.user_id)
        .maybeSingle();
      accountNumber = acct?.account_number || "";
    }
    if (!accountNumber) {
      console.warn(`[pdfFromDb] invoice ${invoiceId} has no account_number — skipping PDF`);
      return null;
    }

    // Resolve client address
    const { data: acctRow } = customer.user_id
      ? await supabase
          .from("accounts")
          .select("billing_address, billing_city, billing_province, billing_postal_code")
          .eq("client_id", customer.user_id)
          .maybeSingle()
      : { data: null as any };

    const clientAddress = acctRow
      ? [acctRow.billing_address, acctRow.billing_city, acctRow.billing_province, acctRow.billing_postal_code]
          .filter(Boolean)
          .join(", ")
      : undefined;

    const services = lines.length
      ? lines.map((l) => ({
          name: l.description || "Service",
          description: l.line_type || "",
          price: Number(l.line_total ?? l.unit_price ?? 0),
          quantity: Number(l.quantity || 1),
        }))
      : [
          {
            name: "Service Nivra",
            price: Number((invoice as any).subtotal ?? (invoice as any).total ?? 0),
            quantity: 1,
          },
        ];

    const data: InvoiceData = {
      invoice_number: (invoice as any).invoice_number || `INV-${invoiceId.slice(0, 8)}`,
      invoice_date: (invoice as any).created_at,
      due_date: (invoice as any).due_date,
      account_number: accountNumber,
      period_start: (invoice as any).cycle_start_date,
      period_end: (invoice as any).cycle_end_date,
      client_name: clientName,
      client_email: customer.email,
      client_phone: customer.phone,
      client_address: clientAddress,
      services,
      subtotal: Number((invoice as any).subtotal || 0),
      tps: Number((invoice as any).tps_amount || 0),
      tvq: Number((invoice as any).tvq_amount || 0),
      total: Number((invoice as any).total || 0),
      balance_due: Number((invoice as any).balance_due ?? (invoice as any).total ?? 0),
      status: (invoice as any).status,
    };

    const base64 = generateInvoicePDF(data);
    const invNum = (invoice as any).invoice_number || invoiceId.slice(0, 8);
    return {
      filename: `${filenamePrefix}-${invNum}.pdf`,
      content: base64,
      contentType: "application/pdf",
    };
  } catch (err) {
    console.error("[pdfFromDb] buildInvoicePdfAttachment error:", err);
    return null;
  }
}

/**
 * Build a Receipt PDF attachment from a billing_invoices row id (paid invoice).
 */
export async function buildReceiptPdfAttachment(
  invoiceId: string,
  filenamePrefix: string = "recu-paiement",
): Promise<QueuedAttachment | null> {
  try {
    const supabase = getServiceClient();

    const { data: invoice, error: invErr } = await supabase
      .from("billing_invoices")
      .select(`
        id, invoice_number, created_at, paid_at, total, subtotal,
        tps_amount, tvq_amount, amount_paid, payment_method,
        billing_snapshot_account_number,
        customer:billing_customers(email, first_name, last_name, user_id)
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
    const clientName = `${customer.first_name || ""} ${customer.last_name || ""}`.trim() || "Client";

    let accountNumber = (invoice as any).billing_snapshot_account_number || "";
    if (!accountNumber && customer.user_id) {
      const { data: acct } = await supabase
        .from("accounts")
        .select("account_number")
        .eq("client_id", customer.user_id)
        .maybeSingle();
      accountNumber = acct?.account_number || "";
    }
    if (!accountNumber) {
      console.warn(`[pdfFromDb] receipt ${invoiceId} has no account_number — skipping PDF`);
      return null;
    }

    const data: ReceiptData = {
      receipt_number: payment?.payment_number || `REC-${invoiceId.slice(0, 8)}`,
      payment_date: payment?.received_at || payment?.captured_at || (invoice as any).paid_at || new Date().toISOString(),
      account_number: accountNumber,
      invoice_number: (invoice as any).invoice_number || "",
      client_name: clientName,
      client_email: customer.email,
      payment_method: payment?.method || (invoice as any).payment_method || "Inconnu",
      reference: payment?.reference || undefined,
      amount: Number(payment?.amount ?? (invoice as any).amount_paid ?? (invoice as any).total ?? 0),
      subtotal: Number((invoice as any).subtotal || 0),
      tps: Number((invoice as any).tps_amount || 0),
      tvq: Number((invoice as any).tvq_amount || 0),
      total: Number((invoice as any).total || 0),
    };

    const base64 = generateReceiptPDF(data);
    const num = payment?.payment_number || (invoice as any).invoice_number || invoiceId.slice(0, 8);
    return {
      filename: `${filenamePrefix}-${num}.pdf`,
      content: base64,
      contentType: "application/pdf",
    };
  } catch (err) {
    console.error("[pdfFromDb] buildReceiptPdfAttachment error:", err);
    return null;
  }
}

/**
 * Build a Contract PDF attachment from an order_id.
 * Pulls order, services, customer, and renders the standard contract.
 */
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
        subtotal, total_amount, equipment_details, equipment_line_details,
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

    // Derive services from equipment_line_details (array) when present
    const lineDetails = Array.isArray(o.equipment_line_details) ? o.equipment_line_details : [];
    const monthlyLines = lineDetails.filter((l: any) => l?.is_recurring || l?.recurring);
    const oneTimeLines = lineDetails.filter((l: any) => !(l?.is_recurring || l?.recurring));
    const totalMonthly = monthlyLines.reduce((acc: number, l: any) => acc + Number(l.price || l.unit_price || 0), 0);
    const totalOneTime = oneTimeLines.reduce((acc: number, l: any) => acc + Number(l.price || l.unit_price || 0), 0);

    const services = lineDetails.length > 0
      ? lineDetails.map((l: any) => ({
          name: l.name || l.product_name || "Article",
          description: l.description || o.service_type || "",
          monthly_price: Number(l.price || l.unit_price || 0),
        }))
      : [{
          name: o.service_type || o.category || "Service Nivra",
          description: "",
          monthly_price: Number(o.subtotal || o.total_amount || 0),
        }];

    const data: ContractData = {
      contract_number: opts.contractNumber || `CTR-${o.order_number || orderId.slice(0, 8)}`,
      effective_date: o.created_at,
      client_name: clientName,
      client_email: o.client_email,
      client_phone: o.client_phone,
      client_address: clientAddress,
      services,
      total_monthly: totalMonthly || Number(o.subtotal || 0),
      total_one_time: totalOneTime,
    };

    const base64 = generateContractPDF(data);
    const prefix = opts.filenamePrefix || "contrat-service";
    return {
      filename: `${prefix}-${o.order_number || orderId.slice(0, 8)}.pdf`,
      content: base64,
      contentType: "application/pdf",
    };
  } catch (err) {
    console.error("[pdfFromDb] buildContractPdfAttachment error:", err);
    return null;
  }
}

/**
 * Build an Order Summary PDF attachment from an orders row id.
 * Used by service-activation, shipment, and order-modified emails.
 * Returns null on any error; caller should still send the email.
 */
export async function buildSummaryPdfAttachment(
  orderId: string,
  filenamePrefix: string = "sommaire-commande",
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
        equipment_line_details, equipment_details
      `)
      .eq("id", orderId)
      .maybeSingle();

    if (error || !o) {
      console.warn("[pdfFromDb] buildSummaryPdfAttachment: order not found", orderId, error?.message);
      return null;
    }

    const clientName = [o.client_first_name, o.client_last_name].filter(Boolean).join(" ").trim() || "Client";
    const clientAddr = (o as any).client_full_address
      || [o.shipping_address, o.shipping_city, o.shipping_postal_code].filter(Boolean).join(", ")
      || undefined;

    // Build services list from equipment_line_details (array of line items)
    const services: SummaryData["services"] = [];
    const items = Array.isArray((o as any).equipment_line_details) ? (o as any).equipment_line_details : [];
    if (items.length > 0) {
      for (const it of items) {
        services.push({
          name: it.name || it.product_name || it.description || "Article",
          price: Number(it.price || it.unit_price || it.total || 0),
          is_recurring: !!(it.is_recurring || it.recurring || it.type === "subscription"),
        });
      }
    } else {
      // Fallback: single line from order subtotal
      services.push({
        name: o.service_type || o.category || "Service Nivra",
        price: Number(o.subtotal || o.total_amount || 0),
        is_recurring: true,
      });
    }

    const subtotalRecurring = services.filter((s) => s.is_recurring).reduce((acc, s) => acc + s.price, 0);
    const subtotalOneTime = services.filter((s) => !s.is_recurring).reduce((acc, s) => acc + s.price, 0);

    const data: SummaryData = {
      order_number: o.order_number || orderId.slice(0, 8).toUpperCase(),
      order_date: o.created_at,
      status: o.status || "En cours",
      client_name: clientName,
      client_email: o.client_email || undefined,
      client_phone: o.client_phone || undefined,
      client_address: clientAddr,
      services,
      subtotal_recurring: subtotalRecurring,
      subtotal_one_time: subtotalOneTime,
      tps: Number(o.tps_amount || 0),
      tvq: Number(o.tvq_amount || 0),
      total: Number(o.total_amount || o.subtotal || subtotalRecurring + subtotalOneTime),
      installation_date: (o as any).appointment_date || undefined,
    };

    const base64 = generateSummaryPDF(data);
    return {
      filename: `${filenamePrefix}-${o.order_number || orderId.slice(0, 8)}.pdf`,
      content: base64,
      contentType: "application/pdf",
    };
  } catch (err) {
    console.error("[pdfFromDb] buildSummaryPdfAttachment error:", err);
    return null;
  }
}
