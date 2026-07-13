/**
 * pdfFromDb — Centralized helper to build PDF base64 attachments from DB IDs.
 *
 * LOCKED TEMPLATES ONLY (V4.0 — 2026-03-20):
 *   - Invoice  → locked-pdf/invoiceTemplateV3.ts  (generateInvoiceV3PDF)
 *   - Receipt  → locked-pdf/receiptTemplate.ts    (generateReceiptPDF)
 *   - Contract → locked-pdf/contractTemplateV3.ts (generateContractV3PDF)
 *   - Summary  → locked-pdf/orderSummaryTemplate.ts (generateOrderSummaryPDF)
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
import { CONTRACT } from "./locked-pdf/companyInfo.ts";
import { cleanPdfText } from "./locked-pdf/textSanitize.ts";

export interface QueuedAttachment {
  filename: string;
  content: string; // base64
  contentType: string;
  hash_sha256?: string; // SHA-256 of raw PDF bytes for integrity verification
}

function getServiceClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key);
}

/** SHA-256 of raw PDF bytes as a lowercase hex string. */
async function computePdfHash(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const hashBuf = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
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

const CONDITION_LABEL_FR: Record<string, string> = {
  new: "Neuf",
  refurbished: "Remis a neuf",
  used: "Usage",
};

/**
 * Resolve the best available address for a client.
 * Priority: accounts.billing_* -> orders.shipping_* -> profiles.service_*
 */
async function resolveClientAddress(
  supabase: SupabaseClient,
  opts: { userId?: string | null; orderId?: string | null; accountId?: string | null },
): Promise<{
  billing: { line1: string; city: string; province: string; postal: string };
  service: { line1: string; city: string; province: string; postal: string };
}> {
  let billing = { line1: "", city: "", province: "QC", postal: "" };
  let service = { line1: "", city: "", province: "QC", postal: "" };

  // 1) accounts.billing_*  +  accounts.primary_service_*
  if (opts.accountId || opts.userId) {
    let q = supabase
      .from("accounts")
      .select(
        "billing_address, billing_city, billing_province, billing_postal_code, primary_service_address, primary_service_city, primary_service_province, primary_service_postal_code",
      );
    q = opts.accountId ? q.eq("id", opts.accountId) : q.eq("client_id", opts.userId);
    const { data: acct } = await q.maybeSingle();
    if (acct?.billing_address) {
      billing = {
        line1: acct.billing_address || "",
        city: acct.billing_city || "",
        province: acct.billing_province || "QC",
        postal: acct.billing_postal_code || "",
      };
    }
    if (acct?.primary_service_address) {
      service = {
        line1: acct.primary_service_address || "",
        city: acct.primary_service_city || "",
        province: acct.primary_service_province || "QC",
        postal: acct.primary_service_postal_code || "",
      };
    }
  }

  // 2) orders.shipping_*
  if (opts.orderId && (!service.line1 || !billing.line1)) {
    const { data: ord } = await supabase
      .from("orders")
      .select("shipping_address, shipping_city, shipping_province, shipping_postal_code")
      .eq("id", opts.orderId)
      .maybeSingle();
    if (ord?.shipping_address) {
      const shipped = {
        line1: ord.shipping_address || "",
        city: ord.shipping_city || "",
        province: ord.shipping_province || "QC",
        postal: ord.shipping_postal_code || "",
      };
      if (!service.line1) service = shipped;
      if (!billing.line1) billing = shipped;
    }
  }

  // 3) profiles.service_*  (FIX: profiles keys off user_id, not id)
  if (opts.userId && (!service.line1 || !billing.line1)) {
    const { data: prof } = await supabase
      .from("profiles")
      .select("service_address, service_city, service_province, service_postal_code")
      .eq("user_id", opts.userId)
      .maybeSingle();
    if (prof?.service_address) {
      const profAddr = {
        line1: prof.service_address || "",
        city: prof.service_city || "",
        province: prof.service_province || "QC",
        postal: prof.service_postal_code || "",
      };
      if (!service.line1) service = profAddr;
      if (!billing.line1) billing = profAddr;
    }
  }

  // 4) Cross-fill: if one address is set and the other isn't, mirror it.
  //    A billing address is required for a legal invoice; if we only have a
  //    service address, use it as the billing address (and vice versa).
  if (!billing.line1 && service.line1) billing = { ...service };
  if (!service.line1 && billing.line1) service = { ...billing };

  return { billing, service };
}

function joinAddress(a: { line1: string; city: string; province: string; postal: string }): string {
  const cityProvPostal = [a.city, a.province, a.postal].filter(Boolean).join(" ");
  return [a.line1, cityProvPostal, "Canada"].filter((s) => s && s.trim()).join(", ");
}

/**
 * Multi-address support (Pass 3A): resolve the true service address for an
 * order. Reads orders.service_address_id → service_addresses. Returns null
 * when the order has no explicit service_address_id (fall back to account
 * primary or shipping snapshot).
 */
async function resolveOrderServiceAddress(
  supabase: SupabaseClient,
  orderId: string,
): Promise<string | null> {
  try {
    const { data: ord } = await supabase
      .from("orders")
      .select("service_address_id")
      .eq("id", orderId)
      .maybeSingle();
    const saId = (ord as any)?.service_address_id;
    if (!saId) return null;
    const { data: sa } = await supabase
      .from("service_addresses")
      .select("address_line, city, province, postal_code")
      .eq("id", saId)
      .maybeSingle();
    if (!sa) return null;
    return joinAddress({
      line1: (sa as any).address_line || "",
      city: (sa as any).city || "",
      province: (sa as any).province || "QC",
      postal: (sa as any).postal_code || "",
    });
  } catch (e) {
    console.warn("[pdfFromDb] resolveOrderServiceAddress error:", (e as any)?.message || e);
    return null;
  }
}


/**
 * Fetch phone + mobile + appointment + technician details for an order.
 * All fields are optional; returns whatever could be resolved.
 */
async function fetchOrderTelecomDetails(
  supabase: SupabaseClient,
  orderId: string,
): Promise<{
  phones: Array<{
    brand: string;
    model: string;
    storage: string;
    color: string;
    condition: string;
    imei: string;
    warranty_days: number;
  }>;
  mobile?: {
    assigned_number?: string;
    sim_iccid?: string;
    sim_carrier?: string;
    sim_type?: string;
    activated_at?: string;
  };
  install_date?: string;
  technician_name?: string;
}> {
  const out: any = { phones: [] };

  // phone_orders + phone_inventory (multiple devices possible)
  const { data: phoneOrders } = await supabase
    .from("phone_orders")
    .select(
      "phone_inventory_id, selected_color, selected_storage, phone_inventory:phone_inventory_id(brand, model, storage, color, condition, imei, warranty_days)",
    )
    .eq("order_id", orderId);

  if (Array.isArray(phoneOrders)) {
    for (const po of phoneOrders) {
      const inv: any = (po as any).phone_inventory || {};
      out.phones.push({
        brand: inv.brand || "",
        model: inv.model || "",
        storage: (po as any).selected_storage || inv.storage || "",
        color: (po as any).selected_color || inv.color || "",
        condition: inv.condition || "",
        imei: inv.imei || "",
        warranty_days: Number(inv.warranty_days || 0),
      });
    }
  }

  // mobile_fulfillment
  const { data: mf } = await supabase
    .from("mobile_fulfillment")
    .select("assigned_number, sim_iccid, sim_carrier, sim_type, activated_at")
    .eq("order_id", orderId)
    .maybeSingle();
  if (mf) {
    out.mobile = {
      assigned_number: (mf as any).assigned_number || undefined,
      sim_iccid: (mf as any).sim_iccid || undefined,
      sim_carrier: (mf as any).sim_carrier || undefined,
      sim_type: (mf as any).sim_type || undefined,
      activated_at: (mf as any).activated_at || undefined,
    };
  }

  // appointments + technician
  const { data: appt } = await supabase
    .from("appointments")
    .select("scheduled_at, technician_id")
    .eq("order_id", orderId)
    .order("scheduled_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (appt?.scheduled_at) out.install_date = (appt as any).scheduled_at;
  if (appt?.technician_id) {
    const { data: tech } = await supabase
      .from("technicians")
      .select("full_name")
      .eq("id", (appt as any).technician_id)
      .maybeSingle();
    if (tech?.full_name) out.technician_name = (tech as any).full_name;
  }

  return out;
}

function buildEnrichedDescription(
  baseDescription: string,
  phone?: {
    brand: string;
    model: string;
    storage: string;
    color: string;
    condition: string;
    imei: string;
  },
): string {
  if (!phone || !phone.model) return baseDescription;
  const parts = [
    [phone.brand, phone.model].filter(Boolean).join(" "),
    phone.storage,
    phone.color,
    CONDITION_LABEL_FR[phone.condition] || phone.condition,
  ].filter(Boolean);
  let label = parts.join(" — ");
  if (phone.imei) label += `  (IMEI: ${phone.imei})`;
  return label || baseDescription;
}

type CanonicalPdfLine = {
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  line_type: string;
  metadata?: Record<string, any> | null;
};

type PdfSectionLines = {
  services: Array<{ type: string; name: string; description?: string; monthly_price: number; quantity?: number }>;
  equipment: Array<{ name: string; quantity: number; unit_price: number }>;
  fees: Array<{ label: string; amount: number }>;
  discounts: Array<{ description: string; unit_price: number; duration_label?: string; code?: string }>;
};

function canonicalLineKind(line: CanonicalPdfLine): "service" | "equipment" | "fee" | "discount" | "other" {
  const lt = String(line.line_type || "").toLowerCase();
  const desc = String(line.description || "").toLowerCase();
  if (lt === "discount" || desc.includes("rabais") || desc.includes("crédit") || desc.includes("credit") || desc.includes("promotion")) return "discount";
  if (["service", "recurring", "subscription", "plan"].includes(lt)) return "service";
  if (["equipment", "phone", "hardware"].includes(lt)) return "equipment";
  if (["fee", "fees", "frais", "activation", "shipping", "delivery", "onetime", "one_time", "one-time"].includes(lt)) return "fee";
  if (desc.includes("borne") || desc.includes("terminal") || desc.includes("sim")) return "equipment";
  if (desc.includes("frais") || desc.includes("livraison") || desc.includes("expédition") || desc.includes("activation")) return "fee";
  return "other";
}

function cleanServiceName(description: string): string {
  return cleanPdfText(description || "Service", "Service").replace(/\s+[—-]\s+30\s+jours\s*$/i, "").trim() || "Service";
}

function durationFromPromotionLabel(description: string): string | undefined {
  const d = cleanPdfText(description || "", "");
  const months = d.match(/(\d+)\s*mois/i)?.[1];
  if (months) return `${months} mois`;
  if (/1er\s+mois|premier\s+mois/i.test(d)) return "1er mois";
  return undefined;
}

function splitDiscountLineForPdf(
  line: CanonicalPdfLine,
  monthlyServiceSubtotal: number,
): Array<{ description: string; unit_price: number; duration_label?: string; code?: string }> {
  const rawDescription = cleanPdfText(line.description || "Rabais", "Rabais");
  const rawAmount = Math.abs(Number(line.line_total ?? line.unit_price ?? 0));
  const meta: any = line.metadata || {};
  const code = cleanPdfText(meta.code || meta.promo_code || meta.discount_code || "", "") || undefined;

  if (Array.isArray(meta.lines) || Array.isArray(meta.discount_lines) || Array.isArray(meta.promotions)) {
    const nested = (meta.lines || meta.discount_lines || meta.promotions) as any[];
    return nested.map((p: any) => ({
      description: cleanPdfText(p.description || p.label || p.name || rawDescription, "Rabais"),
      unit_price: Math.abs(Number(p.amount ?? p.unit_price ?? p.line_total ?? 0)),
      duration_label: cleanPdfText(p.duration_label || p.duration || durationFromPromotionLabel(String(p.description || p.label || p.name || "")) || "", "") || undefined,
      code: cleanPdfText(p.code || p.promo_code || code || "", "") || undefined,
    })).filter((p) => p.unit_price > 0);
  }

  const hasCombinedFirstMonth = /1er\s+mois|premier\s+mois|first\s+month/i.test(rawDescription)
    && rawDescription.includes("+")
    && monthlyServiceSubtotal > 0
    && rawAmount > monthlyServiceSubtotal;

  if (hasCombinedFirstMonth) {
    const parts = rawDescription.split(/\s+\+\s+/).map((p) => p.trim()).filter(Boolean);
    const firstMonthPart = parts.find((p) => /1er\s+mois|premier\s+mois|first\s+month/i.test(p)) || "Crédit promotionnel — 1er mois";
    const recurringPart = parts.find((p) => !/1er\s+mois|premier\s+mois|first\s+month/i.test(p)) || rawDescription;
    const remainder = Math.max(0, Math.round((rawAmount - monthlyServiceSubtotal) * 100) / 100);
    return [
      {
        description: firstMonthPart,
        unit_price: monthlyServiceSubtotal,
        duration_label: "1er mois",
        code,
      },
      ...(remainder > 0 ? [{
        description: recurringPart,
        unit_price: remainder,
        duration_label: durationFromPromotionLabel(recurringPart),
        code,
      }] : []),
    ];
  }

  return [{
    description: rawDescription,
    unit_price: rawAmount,
    duration_label: durationFromPromotionLabel(rawDescription),
    code,
  }];
}

function buildPdfSectionsFromInvoiceLines(lines: CanonicalPdfLine[], phones: any[] = []): PdfSectionLines {
  const services: PdfSectionLines["services"] = [];
  const equipment: PdfSectionLines["equipment"] = [];
  const fees: PdfSectionLines["fees"] = [];
  const discountSourceLines: CanonicalPdfLine[] = [];
  let phoneIdx = 0;

  for (const line of lines) {
    const kind = canonicalLineKind(line);
    if (kind === "discount") {
      discountSourceLines.push(line);
      continue;
    }
    if (kind === "service") {
      services.push({
        type: String((line.metadata as any)?.service_type || "Service"),
        name: cleanServiceName(line.description),
        description: cleanPdfText((line.metadata as any)?.description || "", ""),
        monthly_price: Number(line.unit_price || line.line_total || 0),
        quantity: Number(line.quantity || 1),
      });
      continue;
    }
    if (kind === "equipment") {
      let label = line.description || "Equipement";
      const phone = phones[phoneIdx];
      if (phone && (phone.model || phone.imei)) {
        label = buildEnrichedDescription(label, phone);
        phoneIdx += 1;
      }
      equipment.push({
        name: cleanPdfText(label, "Equipement"),
        quantity: Number(line.quantity || 1),
        unit_price: Number(line.unit_price || line.line_total || 0),
      });
      continue;
    }
    if (kind === "fee" || kind === "other") {
      fees.push({
        label: cleanPdfText(line.description || "Frais", "Frais"),
        amount: Number(line.line_total ?? line.unit_price ?? 0),
      });
    }
  }

  const monthlyServiceSubtotal = services.reduce(
    (sum, service) => sum + Number(service.monthly_price || 0) * Number(service.quantity || 1),
    0,
  );
  const discounts = discountSourceLines.flatMap((line) => splitDiscountLineForPdf(line, monthlyServiceSubtotal));

  return { services, equipment, fees, discounts };
}

async function fetchInvoiceSectionLinesForOrder(
  supabase: SupabaseClient,
  orderId: string,
  phones: any[] = [],
): Promise<{
  invoice: { id: string; subtotal: number; tps_amount: number; tvq_amount: number; total: number } | null;
  sections: PdfSectionLines;
}> {
  const { data: invoice } = await supabase
    .from("billing_invoices")
    .select("id, subtotal, tps_amount, tvq_amount, total")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!(invoice as any)?.id) {
    return { invoice: null, sections: { services: [], equipment: [], fees: [], discounts: [] } };
  }

  const { data: rawLines } = await supabase
    .from("billing_invoice_lines")
    .select("description, quantity, unit_price, line_total, line_type, metadata")
    .eq("invoice_id", (invoice as any).id)
    .order("created_at", { ascending: true });

  const lines = (Array.isArray(rawLines) ? rawLines : []).map((l: any) => ({
    description: String(l.description || ""),
    quantity: Number(l.quantity || 1),
    unit_price: Number(l.unit_price || 0),
    line_total: Number(l.line_total ?? l.unit_price ?? 0),
    line_type: String(l.line_type || ""),
    metadata: l.metadata || null,
  }));

  return {
    invoice: {
      id: (invoice as any).id,
      subtotal: Number((invoice as any).subtotal || 0),
      tps_amount: Number((invoice as any).tps_amount || 0),
      tvq_amount: Number((invoice as any).tvq_amount || 0),
      total: Number((invoice as any).total || 0),
    },
    sections: buildPdfSectionsFromInvoiceLines(lines, phones),
  };
}

/**
 * Resolve field-sales agent attribution for an order.
 * Returns null when order is not from field_sales (web/online).
 * Only ADDS data, never blocks PDF generation.
 */
async function resolveAgentAttribution(
  supabase: SupabaseClient,
  orderId: string | null,
): Promise<{ sale_source: string; agent_name?: string; agent_number?: string } | null> {
  try {
    if (!orderId) return null;
    const { data: o } = await supabase
      .from("orders")
      .select("source, created_by_agent_id, agent_name")
      .eq("id", orderId)
      .maybeSingle();
    if (!o || (o as any).source !== "field_sales") return null;
    let agentName: string | undefined = (o as any).agent_name || undefined;
    let agentNumber: string | undefined;
    const agentId = (o as any).created_by_agent_id as string | null;
    if (agentId) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("full_name, agent_number, badge_number")
        .eq("user_id", agentId)
        .maybeSingle();
      if (prof) {
        agentName = agentName || (prof as any).full_name || undefined;
        agentNumber = (prof as any).agent_number || (prof as any).badge_number || undefined;
      }
    }
    return { sale_source: "field_sales", agent_name: agentName, agent_number: agentNumber };
  } catch (e) {
    console.warn("[pdfFromDb] resolveAgentAttribution error:", (e as any)?.message || e);
    return null;
  }
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
        cycle_start_date, cycle_end_date, type, order_id, account_id,
        address_snapshot, billing_snapshot_client, billing_snapshot_account_number,
        customer:billing_customers(id, email, first_name, last_name, phone, user_id),
        order:orders(id, order_number, service_type, client_full_address),
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
    const order = (invoice as any).order || {};
    const orderId: string | null = (invoice as any).order_id || order?.id || null;
    const invoiceAccountId: string | null = (invoice as any).account_id || null;
    const snapshotClient = ((invoice as any).billing_snapshot_client || {}) as any;
    const orderNumber: string | undefined = order?.order_number || undefined;
    const orderClientFullAddress: string = (order as any).client_full_address || "";
    let linkedUserId: string | null = customer.user_id || null;
    let accountNumber = String((invoice as any).billing_snapshot_account_number || "").trim();
    if (invoiceAccountId) {
      const { data } = await supabase
        .from("accounts")
        .select("account_number, client_id")
        .eq("id", invoiceAccountId)
        .maybeSingle();
      if (!accountNumber) accountNumber = data?.account_number || "";
      if (!linkedUserId) linkedUserId = data?.client_id || null;
    }

    let clientName = String(snapshotClient?.full_name || snapshotClient?.name || "").trim()
      || [customer.first_name, customer.last_name].filter(Boolean).join(" ");
    if (!clientName && linkedUserId) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("full_name, first_name, last_name")
        .eq("user_id", linkedUserId)
        .maybeSingle();
      clientName = (prof as any)?.full_name || [(prof as any)?.first_name, (prof as any)?.last_name].filter(Boolean).join(" ");
    }
    clientName = clientName || "Client";

    if (!accountNumber && linkedUserId) {
      const { data } = await supabase
        .from("accounts")
        .select("account_number")
        .eq("client_id", linkedUserId)
        .maybeSingle();
      if (!accountNumber) accountNumber = data?.account_number || "";
    }
    if (!accountNumber) {
      // billing_customer has no linked auth user — use ID prefix as fallback so PDF still generates
      accountNumber = `CUS-${(customer.id || "000000").slice(0, 6).toUpperCase()}`;
      console.warn(`[pdfFromDb] invoice ${invoiceId}: no account_number, using fallback ${accountNumber}`);
      supabase.from("billing_system_alerts").insert({
        alert_type: "pdf_missing_account_number",
        entity_type: "billing_invoice",
        entity_id: invoiceId,
        severity: "medium",
        details: { invoice_number: (invoice as any).invoice_number, customer_id: customer.id },
        resolved: false,
      }).catch(() => {});
    }

    // Address: use billing_invoices.address_snapshot (figé à la création) first,
    // then fall back to live accounts/profiles chain only if snapshot absent
    const addrSnap = (invoice as any).address_snapshot;
    const invoiceAddr = addrSnap?.address
      ? { line1: addrSnap.address || "", city: addrSnap.city || "", province: addrSnap.province || "QC", postal: addrSnap.postal_code || "" }
      : null;
    const addr = invoiceAddr
      ? { billing: invoiceAddr, service: invoiceAddr }
      : await resolveClientAddress(supabase, { userId: linkedUserId, orderId, accountId: invoiceAccountId });

    // Phone enrichment if invoice ties to an order with phone(s)
    const hasEquipmentLine = lines.some(
      (l) => (l.line_type || "").toLowerCase() === "equipment" || (l.line_type || "").toLowerCase() === "phone",
    );
    let phones: any[] = [];
    if (orderId && hasEquipmentLine) {
      const tele = await fetchOrderTelecomDetails(supabase, orderId);
      phones = tele.phones;
    }

    // Canonical detailed sections from billing_invoice_lines — no merged fallback.
    const invoiceSections = buildPdfSectionsFromInvoiceLines(lines as CanonicalPdfLine[], phones);
    const mappedItems = [
      ...invoiceSections.services.map((s) => ({
        category: "service" as any,
        description: s.name,
        qty: Number(s.quantity || 1),
        unit_price: Number(s.monthly_price || 0),
        amount: Number(s.monthly_price || 0) * Number(s.quantity || 1),
        is_recurring: true,
      })),
      ...invoiceSections.equipment.map((e) => ({
        category: "equipment" as any,
        description: e.name,
        qty: Number(e.quantity || 1),
        unit_price: Number(e.unit_price || 0),
        amount: Number(e.unit_price || 0) * Number(e.quantity || 1),
        is_recurring: false,
      })),
      ...invoiceSections.fees.map((f) => ({
        category: "fee" as any,
        description: f.label,
        qty: 1,
        unit_price: Number(f.amount || 0),
        amount: Number(f.amount || 0),
        is_recurring: false,
      })),
    ];

    // Build discounts[] for the invoice template's discount section, split when a combined promo line exists.
    const discounts = invoiceSections.discounts.length > 0
      ? invoiceSections.discounts.map((l) => ({ label: l.description || "Rabais", amount: Math.abs(Number(l.unit_price || 0)) }))
      : undefined;

    // If billing_invoice_lines has no service lines, fall back to order_items for real service names
    let items = mappedItems;
    if (items.length === 0 && orderId) {
      const { data: orderItems } = await supabase
        .from("order_items")
        .select("service_type, plan_name, description, unit_price, quantity, line_total, is_recurring")
        .eq("order_id", orderId)
        .order("item_number", { ascending: true });
      if (Array.isArray(orderItems) && orderItems.length > 0) {
        items = (orderItems as any[]).map((r) => ({
          category: (r.service_type as any) || "Other",
          description: cleanPdfText(r.plan_name || r.description || r.service_type || "Service", "Service"),
          qty: Number(r.quantity || 1),
          unit_price: Number(r.unit_price ?? 0),
          amount: Number(r.line_total ?? r.unit_price ?? 0),
          is_recurring: r.is_recurring === true,
        }));
      }
    }

    const isPaid = ((invoice as any).status || "").toLowerCase() === "paid";

    const data: InvoiceDataV2 & { order_number?: string } = {
      invoice_type: ((invoice as any).type || "").toUpperCase() === "ONETIME" ? "ONETIME" : "MONTHLY",
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
        email: snapshotClient?.email || customer.email || "",
        phone: snapshotClient?.phone || customer.phone || undefined,
        address_line1: snapshotClient?.address_line1 || addr.billing.line1 || orderClientFullAddress || "",
        city: snapshotClient?.city || addr.billing.city,
        province: snapshotClient?.province || addr.billing.province,
        postal_code: snapshotClient?.postal_code || addr.billing.postal,
      },
      items: items.length ? items : [{
        category: "Other",
        description: order?.service_type || "Service Nivra",
        qty: 1,
        unit_price: Number((invoice as any).subtotal ?? (invoice as any).total ?? 0),
        amount: Number((invoice as any).subtotal ?? (invoice as any).total ?? 0),
      }],
      discounts,
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
      order_number: orderNumber,
    };

    // ADD-ONLY: attach field-sales agent attribution
    const agentInfo = await resolveAgentAttribution(supabase, orderId);
    if (agentInfo) Object.assign(data, agentInfo);

    const result = generateInvoiceV3PDF(data);
    if (!result.success || !result.blob) {
      console.warn(`[pdfFromDb] generateInvoiceV3PDF failed: ${result.error}`);
      return null;
    }
    const [base64, hash_sha256] = await Promise.all([
      blobToBase64(result.blob),
      computePdfHash(result.blob),
    ]);
    const invNum = (invoice as any).invoice_number || invoiceId.slice(0, 8);
    const safeName = clientName.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "Client";
    const period = (invoice as any).cycle_start_date
      ? String((invoice as any).cycle_start_date).slice(0, 7)
      : String((invoice as any).created_at || "").slice(0, 7);
    const periodPart = period ? `_${period}` : "";
    return {
      filename: result.filename || `${filenamePrefix}_${safeName}_${invNum}${periodPart}.pdf`,
      content: base64,
      contentType: "application/pdf",
      hash_sha256,
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
        address_snapshot, billing_snapshot_client, billing_snapshot_account_number, order_id, account_id,
        customer:billing_customers(id, email, first_name, last_name, phone, user_id),
        order:orders(order_number, client_full_address),
        lines:billing_invoice_lines(description, quantity, unit_price, line_total, line_type)
      `)
      .eq("id", invoiceId)
      .maybeSingle();

    if (invErr || !invoice) {
      console.warn(`[pdfFromDb] receipt invoice ${invoiceId} not found:`, invErr?.message);
      return null;
    }

    const { data: payment } = await supabase
      .from("billing_payments")
      .select(
        "amount, method, reference, received_at, captured_at, created_at, payment_number, provider_payment_id",
      )
      .eq("invoice_id", invoiceId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const customer = (invoice as any).customer || {};
    const order = (invoice as any).order || {};
    const lines: any[] = (invoice as any).lines || [];
    const invoiceAccountId: string | null = (invoice as any).account_id || null;
    const snapshotClient = ((invoice as any).billing_snapshot_client || {}) as any;
    let linkedUserId: string | null = customer.user_id || null;
    let clientName = String(snapshotClient?.full_name || snapshotClient?.name || "").trim()
      || [customer.first_name, customer.last_name].filter(Boolean).join(" ");

    let accountNumber = String((invoice as any).billing_snapshot_account_number || "").trim();
    if (invoiceAccountId) {
      const { data } = await supabase
        .from("accounts")
        .select("account_number, client_id")
        .eq("id", invoiceAccountId)
        .maybeSingle();
      if (!accountNumber) accountNumber = data?.account_number || "";
      if (!linkedUserId) linkedUserId = data?.client_id || null;
    }
    if (!clientName && linkedUserId) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("full_name, first_name, last_name")
        .eq("user_id", linkedUserId)
        .maybeSingle();
      clientName = (prof as any)?.full_name || [(prof as any)?.first_name, (prof as any)?.last_name].filter(Boolean).join(" ");
    }
    clientName = clientName || "Client";

    if (!accountNumber && linkedUserId) {
      const { data } = await supabase
        .from("accounts")
        .select("account_number")
        .eq("client_id", linkedUserId)
        .maybeSingle();
      if (!accountNumber) accountNumber = data?.account_number || "";
    }
    if (!accountNumber) {
      console.warn(`[pdfFromDb] receipt ${invoiceId} has no account_number — skipping PDF`);
      const supabaseAlert = getServiceClient();
      await supabaseAlert.from("billing_system_alerts").insert({
        alert_type: "pdf_missing_account_number",
        entity_type: "billing_receipt",
        entity_id: invoiceId,
        severity: "high",
        details: { invoice_number: (invoice as any).invoice_number, customer_id: customer.id },
        resolved: false,
      }).catch(() => {});
      return null;
    }

    // Address: use billing_invoices.address_snapshot (figé) first, then live fallback
    const rcptAddrSnap = (invoice as any).address_snapshot;
    let clientAddress: string | undefined;
    if (rcptAddrSnap?.address) {
      clientAddress = joinAddress({
        line1: rcptAddrSnap.address || "",
        city: rcptAddrSnap.city || "",
        province: rcptAddrSnap.province || "QC",
        postal: rcptAddrSnap.postal_code || "",
      }) || undefined;
    }
    if (!clientAddress) {
      const addr = await resolveClientAddress(supabase, {
        userId: linkedUserId,
        orderId: (invoice as any).order_id || null,
        accountId: invoiceAccountId,
      });
      const receiptOrderFullAddress: string = (order as any).client_full_address || "";
      clientAddress = joinAddress(addr.service) || joinAddress(addr.billing) || receiptOrderFullAddress || undefined;
    }

    // ADD-ONLY: detect unpaid card_manual flow → payment_status='pending'
    let orderPaymentMethod: string | null = null;
    if ((invoice as any).order_id) {
      const { data: ord } = await supabase
        .from("orders")
        .select("payment_method")
        .eq("id", (invoice as any).order_id)
        .maybeSingle();
      orderPaymentMethod = (ord as any)?.payment_method || null;
    }
    const hasConfirmedPayment = !!payment && Number(payment?.amount || 0) > 0;
    const isCardManualPending = !hasConfirmedPayment && orderPaymentMethod === "card_manual";
    const paymentStatus: "paid" | "pending" = isCardManualPending ? "pending" : "paid";

    const receiptSections = buildPdfSectionsFromInvoiceLines(lines as CanonicalPdfLine[]);
    const receiptDetailedItems = [
      ...receiptSections.services.map((s) => ({
        description: s.name,
        quantity: Number(s.quantity || 1),
        unit_price: Number(s.monthly_price || 0),
        line_total: Number(s.monthly_price || 0) * Number(s.quantity || 1),
      })),
      ...receiptSections.equipment.map((e) => ({
        description: e.name,
        quantity: Number(e.quantity || 1),
        unit_price: Number(e.unit_price || 0),
        line_total: Number(e.unit_price || 0) * Number(e.quantity || 1),
      })),
      ...receiptSections.fees.map((f) => ({
        description: f.label,
        quantity: 1,
        unit_price: Number(f.amount || 0),
        line_total: Number(f.amount || 0),
      })),
      ...receiptSections.discounts.map((d) => ({
        description: d.duration_label ? `${d.description} (${d.duration_label})` : d.description,
        quantity: 1,
        unit_price: -Math.abs(Number(d.unit_price || 0)),
        line_total: -Math.abs(Number(d.unit_price || 0)),
      })),
    ];

    // Previous payments (last 3, excluding the current one)
    let previousPayments: Array<{ date: string; method: string; amount: number }> = [];
    if (customer.user_id) {
      const { data: histRaw } = await supabase
        .from("billing_payments")
        .select("amount, method, received_at, captured_at, created_at, invoice_id, billing_customer_id")
        .order("created_at", { ascending: false })
        .limit(20);
      const hist = (histRaw || [])
        .filter((p: any) => p.invoice_id !== invoiceId && Number(p.amount || 0) > 0)
        .slice(0, 3);
      previousPayments = hist.map((p: any) => ({
        date: p.received_at || p.captured_at || p.created_at || "",
        method: p.method || "",
        amount: Number(p.amount || 0),
      }));
    }

    // Next renewal date (best-effort from subscriptions)
    let nextRenewalDate: string | undefined;
    if (customer.user_id) {
      const { data: sub } = await supabase
        .from("billing_subscriptions")
        .select("current_period_end, next_billing_date")
        .eq("user_id", customer.user_id)
        .in("status", ["active", "trialing"])
        .order("current_period_end", { ascending: true })
        .limit(1)
        .maybeSingle();
      nextRenewalDate = (sub as any)?.next_billing_date || (sub as any)?.current_period_end || undefined;
    }

    const data: ReceiptData = {
      receipt_number: payment?.payment_number || `REC-${invoiceId.slice(0, 8)}`,
      payment_date: payment?.received_at || payment?.captured_at || (invoice as any).paid_at || undefined,
      payment_method: payment?.method || orderPaymentMethod || (invoice as any).payment_method || "Inconnu",
      amount_paid: hasConfirmedPayment
        ? Number(payment?.amount ?? (invoice as any).amount_paid ?? 0)
        : 0,
      invoice_number: (invoice as any).invoice_number || "",
      invoice_total: Number((invoice as any).total || 0),
      order_number: order.order_number || undefined,
      client_name: clientName,
      client_email: snapshotClient?.email || customer.email || "",
      client_phone: snapshotClient?.phone || customer.phone || undefined,
      client_address: clientAddress,
      account_number: accountNumber,
      billed_items: receiptDetailedItems.map((l) => ({
        description: l.description || "Article",
        amount: Number(l.line_total || 0),
      })),
      detailed_items: receiptDetailedItems,
      transaction_reference:
        payment?.reference || (payment as any)?.provider_payment_id || undefined,
      balance_remaining: Number((invoice as any).balance_due || 0),
      subtotal: Number((invoice as any).subtotal || 0),
      discount_amount: receiptSections.discounts.reduce((s, d) => s + Math.abs(Number(d.unit_price || 0)), 0),
      discount_label: receiptSections.discounts[0]?.description,
      tps_amount: Number((invoice as any).tps_amount || 0),
      tvq_amount: Number((invoice as any).tvq_amount || 0),
      payment_status: paymentStatus,
      total_due: Number((invoice as any).total || 0),
      processed_by: (payment as any)?.provider_payment_id ? "Passerelle de paiement" : "Systeme automatique",
      next_renewal_date: nextRenewalDate,
      account_status: "A jour",
      previous_payments: previousPayments,
    };

    // ADD-ONLY: attach field-sales agent attribution
    const agentInfo = await resolveAgentAttribution(supabase, (invoice as any).order_id || null);
    if (agentInfo) Object.assign(data, agentInfo);

    const result = generateReceiptPDF(data);
    if (!result.success || !result.blob) {
      console.warn(`[pdfFromDb] generateReceiptPDF failed: ${result.error}`);
      return null;
    }
    const [base64, hash_sha256] = await Promise.all([
      blobToBase64(result.blob),
      computePdfHash(result.blob),
    ]);
    const num = payment?.payment_number || (invoice as any).invoice_number || invoiceId.slice(0, 8);
    const safeName = clientName.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "Client";
    const period = String((invoice as any).cycle_start_date || (invoice as any).created_at || "").slice(0, 7);
    const periodPart = period ? `_${period}` : "";
    return {
      filename: result.filename || `${filenamePrefix}_${safeName}_${num}${periodPart}.pdf`,
      content: base64,
      contentType: "application/pdf",
      hash_sha256,
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
        shipping_address, shipping_city, shipping_province, shipping_postal_code,
        subtotal, total_amount, tps_amount, tvq_amount, discount_amount,
        equipment_details,
        user_id
      `)
      .eq("id", orderId)
      .maybeSingle();

    if (orderErr || !order) {
      console.warn(`[pdfFromDb] order ${orderId} not found:`, orderErr?.message);
      return null;
    }

    const o = order as any;
    // orders.client_first_name/last_name are snapshot fields captured at order creation
    const clientName = [o.client_first_name, o.client_last_name].filter(Boolean).join(" ") || "Client";

    // Account number + phone fallback + autopay status — single billing_customers query
    let accountNumber = "";
    let clientPhone = o.client_phone || "";
    let paymentMethod = "Manuel";
    if (o.user_id) {
      const [acctRes, billingCustRes, subRes] = await Promise.all([
        supabase.from("accounts").select("account_number").eq("client_id", o.user_id).maybeSingle(),
        supabase.from("billing_customers").select("phone").eq("user_id", o.user_id).maybeSingle(),
        supabase.from("billing_subscriptions").select("auto_billing_enabled").eq("order_id", orderId).maybeSingle(),
      ]);
      accountNumber = acctRes.data?.account_number || "";
      if (!clientPhone) clientPhone = billingCustRes.data?.phone || "";
      if (subRes.data?.auto_billing_enabled) paymentMethod = "PPA (Prélèvement Pré-Autorisé)";
      // Final fallback: profiles.phone
      if (!clientPhone) {
        const { data: prof } = await supabase.from("profiles").select("phone").eq("user_id", o.user_id).maybeSingle();
        clientPhone = prof?.phone || "";
      }
    }

    // Telecom details (phones, mobile_fulfillment, appointments, technicians)
    const tele = await fetchOrderTelecomDetails(supabase, orderId);

    // Canonical PDF section source: billing_invoice_lines mirrors the financial truth.
    const invoiceProjection = await fetchInvoiceSectionLinesForOrder(supabase, orderId, tele.phones);
    const hasCanonicalSections = invoiceProjection.sections.services.length > 0
      || invoiceProjection.sections.equipment.length > 0
      || invoiceProjection.sections.fees.length > 0
      || invoiceProjection.sections.discounts.length > 0;

    let services = invoiceProjection.sections.services;
    let equipment: Array<{ name: string; quantity: number; unit_price: number }> = invoiceProjection.sections.equipment;
    let oneTimeFees: Array<{ label: string; amount: number }> = invoiceProjection.sections.fees;

    if (!hasCanonicalSections) {
      const { data: orderItems } = await supabase
        .from("order_items")
        .select("service_type, plan_code, plan_name, description, unit_price, quantity, line_total, is_recurring")
        .eq("order_id", orderId)
        .order("item_number", { ascending: true });

      const itemsRows = Array.isArray(orderItems) ? orderItems : [];
      const recurringRows = itemsRows.filter((r: any) => r.is_recurring === true);
      const oneTimeRows = itemsRows.filter((r: any) => r.is_recurring === false);

      services = recurringRows.map((r: any) => ({
        type: r.service_type || o.service_type || "Service",
        name: r.plan_name || r.description || "Service",
        description: r.description || "",
        monthly_price: Number(r.unit_price || 0),
      }));

      if (oneTimeRows.length > 0) {
        let phoneIdx = 0;
        for (const r of oneTimeRows) {
          const st = (r.service_type || "").toLowerCase();
          const isEquipment = st === "equipment" || st === "phone";
          if (isEquipment) {
            let label = r.plan_name || r.description || "Equipement";
            const phone = tele.phones[phoneIdx];
            if (phone && (st === "phone" || phone.model)) {
              label = buildEnrichedDescription(label, phone);
              phoneIdx += 1;
            }
            equipment.push({
              name: label,
              quantity: Number(r.quantity || 1),
              unit_price: Number(r.unit_price || 0),
            });
          } else {
            oneTimeFees.push({
              label: r.plan_name || r.description || "Frais",
              amount: Number(r.line_total || r.unit_price || 0),
            });
          }
        }
      }
    }

    // Fallback to equipment_line_details snapshot if order_items is empty
    if (services.length === 0 && equipment.length === 0 && oneTimeFees.length === 0) {
      const lineDetails = Array.isArray(o.equipment_line_details) ? o.equipment_line_details : [];
      const monthlyLines = lineDetails.filter((l: any) => l?.is_recurring || l?.recurring);
      const oneTimeLines = lineDetails.filter((l: any) => !(l?.is_recurring || l?.recurring));
      services = monthlyLines.length > 0
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
      equipment = oneTimeLines
        .filter((l: any) => (l.category === "Equipment" || l.kind === "equipment" || l.is_equipment))
        .map((l: any) => ({
          name: l.name || l.product_name || "Equipement",
          quantity: Number(l.quantity || 1),
          unit_price: Number(l.price || l.unit_price || 0),
        }));
      oneTimeFees = oneTimeLines
        .filter((l: any) => !(l.category === "Equipment" || l.kind === "equipment" || l.is_equipment))
        .map((l: any) => ({
          label: cleanPdfText(l.name || l.product_name || l.description || "Frais", "Frais"),
          amount: Number(l.price || l.unit_price || 0),
        }));
    }

    const subtotalMonthly = services.reduce((acc: number, s: any) => acc + s.monthly_price, 0);
    const subtotalOneTime =
      equipment.reduce((acc, e) => acc + e.unit_price * e.quantity, 0)
      + oneTimeFees.reduce((acc, f) => acc + f.amount, 0);

    // CANONICAL TAX SOURCE: billing_invoices is the source of truth (post-discount).
    // orders.tps_amount/tvq_amount may reflect pre-discount taxes — never use for contract math.
    // Take the FIRST invoice for this order (the original one-time charge), not the most recent
    const invoiceForTaxes = invoiceProjection.invoice;
    const taxGst = invoiceForTaxes
      ? Number((invoiceForTaxes as any).tps_amount || 0)
      : Number(o.tps_amount || 0);
    const taxQst = invoiceForTaxes
      ? Number((invoiceForTaxes as any).tvq_amount || 0)
      : Number(o.tvq_amount || 0);
    const totalDueToday = invoiceForTaxes
      ? Number((invoiceForTaxes as any).total || 0)
      : Number(o.total_amount || 0);

    // Real promotion lines from billing_invoice_lines, split by promotion when possible.
    let contractDiscountLines = invoiceProjection.sections.discounts;
    const discountAmount = contractDiscountLines.length > 0
      ? contractDiscountLines.reduce((s, l) => s + Math.abs(Number(l.unit_price || 0)), 0)
      : Number(o.discount_amount || 0);
    const contractDiscountLabel = contractDiscountLines[0]?.description;

    // Address (Pass 3A multi-address):
    //   - service_address = orders.service_address_id → service_addresses (canonical)
    //   - billing_address = accounts.billing_* (primary billing address)
    //   - Both fall back to shipping/live chain only when explicit sources missing.
    const explicitServiceAddress = await resolveOrderServiceAddress(supabase, orderId);
    const orderShipping = o.shipping_address
      ? joinAddress({ line1: o.shipping_address, city: o.shipping_city || "", province: o.shipping_province || "QC", postal: o.shipping_postal_code || "" })
      : "";
    let billingAddress = "";
    let serviceAddress = explicitServiceAddress || "";
    // Always try to resolve the true billing address from the account first.
    const addr = await resolveClientAddress(supabase, { userId: o.user_id, orderId });
    billingAddress = joinAddress(addr.billing) || orderShipping || o.client_full_address || "";
    if (!serviceAddress) {
      serviceAddress = joinAddress(addr.service) || orderShipping || o.client_full_address || "";
    }


    // Real signature data from contracts table (if exists)
    let signature: {
      signature_name?: string;
      signature_date?: string;
      signature_ip?: string;
      is_signed?: boolean;
      contract_number?: string;
    } = {};
    {
      const { data: contractRow } = await supabase
        .from("contracts")
        .select("contract_number, client_signer_name, client_signed_at, client_signed_ip, is_signed")
        .eq("order_id", orderId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (contractRow) {
        signature = {
          signature_name: (contractRow as any).client_signer_name || undefined,
          signature_date: (contractRow as any).client_signed_at || undefined,
          signature_ip: (contractRow as any).client_signed_ip || undefined,
          is_signed: !!(contractRow as any).is_signed,
          contract_number: (contractRow as any).contract_number || undefined,
        };
      }
    }

    const data: ContractDataV3 = {
      contract_number:
        opts.contractNumber || signature.contract_number || `CTR-${o.order_number || orderId.slice(0, 8)}`,
      contract_date: o.created_at,
      terms_version: CONTRACT.TERMS_VERSION,
      client_name: clientName,
      client_email: o.client_email || "",
      client_phone: clientPhone,
      billing_address: billingAddress,
      service_address: serviceAddress,
      account_number: accountNumber || "—",
      order_number: o.order_number || orderId.slice(0, 8),
      services,
      equipment,
      one_time_fees: oneTimeFees,
      subtotal_monthly: subtotalMonthly,
      subtotal_one_time: subtotalOneTime,
      discount_amount: discountAmount,
      discount_label: contractDiscountLabel,
      has_discount: contractDiscountLines.length > 0,
      discount_lines: contractDiscountLines,
      tax_gst: taxGst,
      tax_qst: taxQst,
      total_due_today: totalDueToday,
      payment_method: paymentMethod,
      signature_name: signature.signature_name,
      signature_date: signature.signature_date,
      signature_ip: signature.signature_ip,
      is_signed: signature.is_signed,
      mobile_assigned_number: tele.mobile?.assigned_number,
      mobile_sim_iccid: tele.mobile?.sim_iccid,
      mobile_sim_carrier: tele.mobile?.sim_carrier,
      mobile_sim_type: tele.mobile?.sim_type,
      mobile_activated_at: tele.mobile?.activated_at,
      install_date: tele.install_date,
      technician_name: tele.technician_name,
    };

    // ADD-ONLY: attach field-sales agent attribution
    const agentInfo = await resolveAgentAttribution(supabase, orderId);
    if (agentInfo) Object.assign(data, agentInfo);

    const result = generateContractV3PDF(data);
    if (!result.success || !result.blob) {
      console.warn(`[pdfFromDb] generateContractV3PDF failed: ${result.error}`);
      return null;
    }
    const [base64, hash_sha256] = await Promise.all([
      blobToBase64(result.blob),
      computePdfHash(result.blob),
    ]);
    const prefix = opts.filenamePrefix || "Contrat";
    const safeName = clientName.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "Client";
    return {
      filename: result.filename || `${prefix}_${safeName}_${o.order_number || orderId.slice(0, 8)}.pdf`,
      content: base64,
      contentType: "application/pdf",
      hash_sha256,
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
        shipping_address, shipping_city, shipping_province, shipping_postal_code,
        equipment_details, user_id
      `)
      .eq("id", orderId)
      .maybeSingle();

    if (error || !o) {
      console.warn("[pdfFromDb] buildSummaryPdfAttachment: order not found", orderId, error?.message);
      return null;
    }

    let clientName = [(o as any).client_first_name, (o as any).client_last_name].filter(Boolean).join(" ");
    if (!clientName && (o as any).user_id) {
      const { data: _prof } = await supabase.from("profiles").select("first_name, last_name").eq("user_id", (o as any).user_id).maybeSingle();
      clientName = [(_prof as any)?.first_name, (_prof as any)?.last_name].filter(Boolean).join(" ");
    }
    clientName = clientName || "Client";

    // Pass 3A: prefer orders.service_address_id → service_addresses over
    // legacy snapshots so multi-address orders show the right address.
    const explicitSummarySA = await resolveOrderServiceAddress(supabase, orderId);
    const addr = await resolveClientAddress(supabase, { userId: (o as any).user_id, orderId });
    const clientAddr = explicitSummarySA
      || joinAddress(addr.service)
      || (o as any).client_full_address
      || [(o as any).shipping_address, (o as any).shipping_city, (o as any).shipping_postal_code]
        .filter(Boolean).join(", ")
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

    // Telecom details (phones / mobile / appointment / technician)
    const tele = await fetchOrderTelecomDetails(supabase, orderId);

    const summaryProjection = await fetchInvoiceSectionLinesForOrder(supabase, orderId, tele.phones);
    const hasSummaryCanonicalSections = summaryProjection.sections.services.length > 0
      || summaryProjection.sections.equipment.length > 0
      || summaryProjection.sections.fees.length > 0
      || summaryProjection.sections.discounts.length > 0;

    let services = summaryProjection.sections.services;
    let equipment: any[] = summaryProjection.sections.equipment;
    let fees: Array<{ label: string; amount: number }> = summaryProjection.sections.fees;

    if (!hasSummaryCanonicalSections) {
      const { data: orderItems } = await supabase
        .from("order_items")
        .select("service_type, plan_name, description, unit_price, quantity, line_total, is_recurring")
        .eq("order_id", orderId)
        .order("item_number", { ascending: true });

      const itemsRows = Array.isArray(orderItems) ? orderItems : [];
      const recurringRows = itemsRows.filter((r: any) => r.is_recurring === true);
      const oneTimeRows = itemsRows.filter((r: any) => r.is_recurring === false);

      services = recurringRows.map((r: any) => ({
        type: r.service_type || (o as any).service_type || "Service",
        name: r.plan_name || r.description || "Service",
        description: r.description || "",
        monthly_price: Number(r.unit_price || 0),
      }));

      if (oneTimeRows.length > 0) {
        let phoneIdx = 0;
        for (const r of oneTimeRows) {
          const st = (r.service_type || "").toLowerCase();
          const isEquipment = st === "equipment" || st === "phone";
          if (isEquipment) {
            const phone = tele.phones[phoneIdx];
            equipment.push({
              name: r.plan_name || r.description || "Equipement",
              quantity: Number(r.quantity || 1),
              unit_price: Number(r.unit_price || 0),
              imei: phone?.imei,
              storage: phone?.storage,
              color: phone?.color,
              condition: phone?.condition,
              warranty_days: phone?.warranty_days,
            });
            if (phone) phoneIdx += 1;
          } else {
            fees.push({
              label: r.plan_name || r.description || "Frais",
              amount: Number(r.line_total || r.unit_price || 0),
            });
          }
        }
      }
    }

    // Fallback on snapshot when order_items absent
    if (services.length === 0 && equipment.length === 0 && fees.length === 0) {
      const items = Array.isArray((o as any).equipment_line_details) ? (o as any).equipment_line_details : [];
      const monthly = items.filter((l: any) => l?.is_recurring || l?.recurring);
      const oneTime = items.filter((l: any) => !(l?.is_recurring || l?.recurring));
      services = monthly.length > 0
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
      equipment = oneTime
        .filter((l: any) => (l.category === "Equipment" || l.kind === "equipment" || l.is_equipment))
        .map((l: any) => ({
          name: cleanPdfText(l.name || l.product_name || "Equipement", "Equipement"),
          quantity: Number(l.quantity || 1),
          unit_price: Number(l.price || l.unit_price || 0),
        }));
      fees = oneTime
        .filter((l: any) => !(l.category === "Equipment" || l.kind === "equipment" || l.is_equipment))
        .map((l: any) => ({
          label: cleanPdfText(l.name || l.product_name || l.description || "Frais", "Frais"),
          amount: Number(l.price || l.unit_price || 0),
        }));
    }

    const subtotalMonthly = services.reduce((acc: number, s: any) => acc + s.monthly_price, 0);
    const subtotalOneTime =
      equipment.reduce((acc: number, e: any) => acc + Number(e.unit_price || 0) * Number(e.quantity || 1), 0)
      + fees.reduce((acc: number, f: any) => acc + Number(f.amount || 0), 0);

    // CANONICAL TOTALS — pull from billing_invoices (post-discount) when available
    const summaryInvoice = summaryProjection.invoice;

    const summaryPromotions = summaryProjection.sections.discounts.map((d) => ({
      code: d.code,
      label: d.description,
      duration: d.duration_label,
      monthly_discount: Math.abs(Number(d.unit_price || 0)),
    }));
    const summaryDiscountAmount = summaryPromotions.reduce((s, p) => s + Math.abs(Number(p.monthly_discount || 0)), 0);
    const summaryDiscountLabel = summaryPromotions[0]?.label;

    const canonicalTaxGst = summaryInvoice
      ? Number((summaryInvoice as any).tps_amount || 0)
      : Number((o as any).tps_amount || 0);
    const canonicalTaxQst = summaryInvoice
      ? Number((summaryInvoice as any).tvq_amount || 0)
      : Number((o as any).tvq_amount || 0);
    const canonicalTotal = summaryInvoice
      ? Number((summaryInvoice as any).total || 0)
      : Number((o as any).total_amount || (o as any).subtotal || subtotalMonthly + subtotalOneTime);

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
      discount_amount: summaryDiscountAmount,
      discount_label: summaryDiscountLabel,
      tax_gst: canonicalTaxGst,
      tax_qst: canonicalTaxQst,
      total_due: canonicalTotal,
      estimated_activation: tele.install_date || (o as any).appointment_date || undefined,
      mobile_assigned_number: tele.mobile?.assigned_number,
      mobile_sim_iccid: tele.mobile?.sim_iccid,
      mobile_sim_carrier: tele.mobile?.sim_carrier,
      mobile_sim_type: tele.mobile?.sim_type,
      mobile_activated_at: tele.mobile?.activated_at,
      install_date: tele.install_date,
      technician_name: tele.technician_name,
      promotions: summaryPromotions,
    };

    // ADD-ONLY: attach field-sales agent attribution
    const agentInfo = await resolveAgentAttribution(supabase, orderId);
    if (agentInfo) Object.assign(data, agentInfo);

    const result = generateOrderSummaryPDF(data);
    if (!result.success || !result.blob) {
      console.warn(`[pdfFromDb] generateOrderSummaryPDF failed: ${result.error}`);
      return null;
    }
    const base64 = await blobToBase64(result.blob);
    const safeName = clientName.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "Client";
    return {
      filename: result.filename || `${filenamePrefix}_${safeName}_${(o as any).order_number || orderId.slice(0, 8)}.pdf`,
      content: base64,
      contentType: "application/pdf",
    };
  } catch (err) {
    console.error("[pdfFromDb] buildSummaryPdfAttachment error:", err);
    return null;
  }
}

// ============================================================================
// AUTO-DOC DISPATCHER — wraps pdf/dispatcher.ts for any of the 19 notice types
// ============================================================================
export async function buildAutoDocPdfAttachment(
  docType: string,
  payload: Record<string, any>,
): Promise<QueuedAttachment | null> {
  try {
    const { dispatchAutoDocument } = await import("./pdf/dispatcher.ts");
    const result = await dispatchAutoDocument(docType as any, payload);
    const bytes = result.bytes;
    let binary = "";
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)) as any);
    }
    return {
      filename: result.filename,
      content: btoa(binary),
      contentType: "application/pdf",
    };
  } catch (err) {
    console.error(`[pdfFromDb] buildAutoDocPdfAttachment(${docType}) error:`, err);
    return null;
  }
}
