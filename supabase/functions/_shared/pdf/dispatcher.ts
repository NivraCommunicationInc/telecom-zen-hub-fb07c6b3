/**
 * Server-side Auto Document Dispatcher (Deno).
 * Mirror of src/lib/pdf/autoDocumentDispatcher.ts.
 * Returns Uint8Array bytes from the PDF blob produced by jsPDF.
 *
 * Also normalizes/enriches the raw event payload coming from DB triggers
 * so each template receives the exact shape it expects (defensive defaults).
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { generateWelcomeLetterPDF } from "./welcomeLetterTemplate.ts";
import { generateAddressChangePDF } from "./addressChangeTemplate.ts";
import { generatePaymentMethodChangePDF } from "./paymentMethodChangeTemplate.ts";
import { generateServiceCertificatePDF } from "./serviceCertificateTemplate.ts";
import { generateSuspensionNoticePDF } from "./suspensionNoticeTemplate.ts";
import { generateCancellationConfirmationPDF } from "./cancellationConfirmationTemplate.ts";
import { generateChargebackNoticePDF } from "./chargebackNoticeTemplate.ts";
import { generateFinalRefundReceiptPDF } from "./finalRefundReceiptTemplate.ts";
import { generateDeliverySlipPDF } from "./deliverySlipTemplate.ts";
import { generateReturnInstructionsPDF } from "./returnInstructionsTemplate.ts";
import { generateInstallationReportPDF } from "./installationReportTemplate.ts";
import { generateActivationConfirmationPDF } from "./activationConfirmationTemplate.ts";
import { generateContractAmendmentPDF } from "./contractAmendmentTemplate.ts";
import { generateFormalDemandPDF } from "./formalDemandTemplate.ts";
import { generateCollectionsTransferPDF } from "./collectionsTransferTemplate.ts";
import { generateComplaintAcknowledgmentPDF } from "./complaintAcknowledgmentTemplate.ts";
import { generatePreauthorizationConfirmationPDF } from "./preauthorizationConfirmationTemplate.ts";

export type AutoDocType =
  | "welcome_letter"
  | "address_change"
  | "payment_method_change"
  | "service_certificate"
  | "suspension_notice"
  | "cancellation_confirmation"
  | "chargeback_notice"
  | "final_refund_receipt"
  | "delivery_slip"
  | "return_instructions"
  | "installation_report"
  | "activation_confirmation"
  | "contract_amendment"
  | "formal_demand"
  | "collections_transfer"
  | "complaint_acknowledgment"
  | "preauthorization_confirmation";

export interface DispatchResult {
  bytes: Uint8Array;
  filename: string;
  docNumber?: string;
  fileSizeBytes: number;
}

// --------------------------------------------------------------------------
// Payload helpers
// --------------------------------------------------------------------------

const nowIso = () => new Date().toISOString();

// Lazily-initialized admin client used only to enrich payloads when the
// trigger payload is incomplete (e.g. missing monthly amount, activation date,
// service address). Strict fail-soft: if enrichment fails we fall back to the
// raw payload — generation never throws because of enrichment.
let _admin: any = null;
function getAdmin() {
  if (_admin) return _admin;
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  _admin = createClient(url, key);
  return _admin;
}

/**
 * Pull authoritative client/account/subscription data from the database when
 * the trigger payload is missing key fields. Best-effort — never throws.
 */
async function enrichFromDb(
  docType: AutoDocType,
  p: Record<string, any>,
): Promise<Record<string, any>> {
  const admin = getAdmin();
  if (!admin) return p;
  const out: Record<string, any> = { ...p };

  try {
    // Resolve account by id, account_number, or client/customer
    let account: any = null;
    if (out.account_id) {
      const { data } = await admin.from("accounts").select("*").eq("id", out.account_id).maybeSingle();
      account = data;
    }
    if (!account && out.account_number) {
      const { data } = await admin.from("accounts").select("*").eq("account_number", out.account_number).maybeSingle();
      account = data;
    }
    if (!account && out.client_id) {
      const { data } = await admin.from("accounts").select("*").eq("client_id", out.client_id).order("created_at", { ascending: false }).limit(1).maybeSingle();
      account = data;
    }
    if (!account && (out.client_email || out.email)) {
      const email = out.client_email || out.email;
      const { data: cust } = await admin.from("billing_customers").select("user_id, first_name, last_name, email, phone").eq("email", email).maybeSingle();
      if (cust) {
        out.client_email = out.client_email || cust.email;
        out.client_phone = out.client_phone || cust.phone;
        // billing_customers names can be null — profiles is the source of truth
        if (cust.user_id) {
          const { data: prof } = await admin.from("profiles").select("first_name, last_name").eq("user_id", cust.user_id).maybeSingle();
          out.first_name = out.first_name || prof?.first_name || cust.first_name;
          out.last_name = out.last_name || prof?.last_name || cust.last_name;
          const { data: acc } = await admin.from("accounts").select("*").eq("client_id", cust.user_id).order("created_at", { ascending: false }).limit(1).maybeSingle();
          account = acc;
        } else {
          out.first_name = out.first_name || cust.first_name;
          out.last_name = out.last_name || cust.last_name;
        }
      }
    }

    if (account) {
      out.account_id = out.account_id || account.id;
      out.account_number = out.account_number || account.account_number;
      out.client_id = out.client_id || account.client_id;
      out.client_address = out.client_address || account.primary_service_address || account.billing_address || "";
      out.client_city = out.client_city || account.primary_service_city || account.billing_city || "";
      out.client_province = out.client_province || account.primary_service_province || account.billing_province || "QC";
      out.client_postal = out.client_postal || account.primary_service_postal_code || account.billing_postal_code || "";
      out.service_address = out.service_address || account.primary_service_address || account.billing_address || "";
      out.service_city = out.service_city || account.primary_service_city || account.billing_city || "";
      out.service_province = out.service_province || account.primary_service_province || account.billing_province || "QC";
      out.service_postal = out.service_postal || account.primary_service_postal_code || account.billing_postal_code || "";
      out.account_status = out.account_status || account.status || "active";
      // Resolve real name from profiles when billing_customers names are missing
      if (account.client_id && (!out.first_name || !out.last_name)) {
        const { data: prof } = await admin.from("profiles").select("first_name, last_name").eq("user_id", account.client_id).maybeSingle();
        if (prof) {
          out.first_name = out.first_name || prof.first_name;
          out.last_name = out.last_name || prof.last_name;
        }
      }
    }

    // For address_change: enrich old_address from service_addresses if not in payload
    if (docType === "address_change" && !out.old_address && account?.id) {
      const { data: addrs } = await admin
        .from("service_addresses")
        .select("address_line, city, province, postal_code")
        .eq("account_id", account.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (addrs?.address_line) {
        out.old_address = addrs.address_line;
        out.old_city = out.old_city || addrs.city || "";
        out.old_province = out.old_province || addrs.province || "QC";
        out.old_postal = out.old_postal || addrs.postal_code || "";
      }
    }

    // For payment_method_change: enrich old_method from most recent confirmed payment
    if (docType === "payment_method_change" && !out.old_method) {
      let custId = out.customer_id;
      if (!custId && (out.client_email || out.email)) {
        const { data: bc } = await admin.from("billing_customers").select("id").eq("email", out.client_email || out.email).maybeSingle();
        custId = bc?.id;
      }
      if (custId) {
        const { data: lastPay } = await admin
          .from("billing_payments")
          .select("method")
          .eq("customer_id", custId)
          .eq("status", "paid")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (lastPay?.method) out.old_method = lastPay.method;
      }
    }

    // Fetch most recent active subscription for service info
    const needsSub = ["service_certificate", "activation_confirmation", "welcome_letter", "suspension_notice", "cancellation_confirmation", "contract_amendment"].includes(docType);
    if (needsSub && (out.client_id || out.client_email || out.email)) {
      let customerId = out.customer_id;
      if (!customerId) {
        const email = out.client_email || out.email;
        if (email) {
          const { data: cust } = await admin.from("billing_customers").select("id").eq("email", email).maybeSingle();
          customerId = cust?.id;
        }
      }
      if (customerId) {
        // Prefer active/pending subscription; only fall back to cancelled/other if none active.
        // Without this guard a cancelled sub created after the active one wins, showing wrong price.
        const subSelect = "id, plan_name, plan_price, cycle_start_date, cycle_end_date, status, next_renewal_at, created_at, billing_cycle_anchor, order_id";
        const { data: activeSub } = await admin
          .from("billing_subscriptions")
          .select(subSelect)
          .eq("customer_id", customerId)
          .in("status", ["active", "pending"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        const sub = activeSub ?? (await admin
          .from("billing_subscriptions")
          .select(subSelect)
          .eq("customer_id", customerId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
        ).data ?? null;
        if (sub) {
          out.subscription_id = out.subscription_id || sub.id;
          out.service_name = out.service_name || sub.plan_name;
          out.plan_name = out.plan_name || sub.plan_name;
          out.activation_date = out.activation_date || sub.cycle_start_date || sub.created_at;
          out.active_since = out.active_since || sub.cycle_start_date || sub.created_at;
          out.next_billing_date = out.next_billing_date || sub.next_renewal_at;
          out.account_status = out.account_status || sub.status;
          if (!out.first_billing_cycle && sub.cycle_start_date && sub.cycle_end_date) {
            out.first_billing_cycle = `${sub.cycle_start_date} — ${sub.cycle_end_date}`;
          }
          // welcome_letter, service_certificate, activation_confirmation must show the price
          // frozen at order time (order_items.unit_price), never the live plan_price which
          // changes when the customer upgrades. Other doc types keep reading plan_price.
          const priceSnapshot = ["welcome_letter", "service_certificate", "activation_confirmation"].includes(docType);
          if (priceSnapshot && out.monthly_amount == null) {
            const orderId = (sub as any).order_id || out.order_id;
            let snapshotPrice: number | null = null;
            if (orderId) {
              const { data: items } = await admin
                .from("order_items")
                .select("unit_price")
                .eq("order_id", orderId)
                .eq("is_recurring", true);
              if (items && items.length > 0) {
                snapshotPrice = items.reduce((s: number, it: any) => s + Number(it.unit_price ?? 0), 0);
              }
            }
            out.monthly_amount = snapshotPrice ?? Number(sub.plan_price ?? 0);
          } else {
            out.monthly_amount = out.monthly_amount ?? Number(sub.plan_price ?? 0);
          }
        }
      }
    }

    // Fallback: if subscription lookup yielded no plan data, try most recent order
    if ((!out.monthly_amount || !out.service_name) && out.client_id) {
      try {
        const { data: order } = await admin
          .from("orders")
          .select("id, plan_name, plan_price, total_amount, service_name")
          .eq("user_id", out.client_id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (order) {
          out.service_name = out.service_name || order.service_name || order.plan_name;
          out.plan_name = out.plan_name || order.plan_name;
          // Same snapshot rule: price-sensitive docs use order_items, not order.plan_price.
          const priceSnapshot = ["welcome_letter", "service_certificate", "activation_confirmation"].includes(docType);
          if (priceSnapshot && out.monthly_amount == null) {
            const { data: items } = await admin
              .from("order_items")
              .select("unit_price")
              .eq("order_id", order.id)
              .eq("is_recurring", true);
            const snapshotPrice = items && items.length > 0
              ? items.reduce((s: number, it: any) => s + Number(it.unit_price ?? 0), 0)
              : null;
            out.monthly_amount = snapshotPrice ?? Number(order.plan_price ?? 0);
          } else {
            out.monthly_amount = out.monthly_amount ?? Number(order.plan_price ?? 0);
          }
        }
      } catch (_e) { /* silent */ }
    }
  } catch (e) {
    console.warn("[dispatcher] enrichFromDb soft-fail:", e?.message);
  }
  return out;
}

function pickClientName(p: Record<string, any>): string {
  const candidates = [
    p.client_name,
    p.full_name,
    [p.first_name, p.last_name].filter(Boolean).join(" "),
    p.name,
    p.email,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return "Client Nivra";
}

function pickAddress(p: Record<string, any>) {
  const a = (typeof p.service_address === "object" && p.service_address) || (typeof p.billing_address === "object" && p.billing_address) || {};
  return {
    street: a.street || (typeof p.service_address === "string" ? p.service_address : "") || (typeof p.billing_address === "string" ? p.billing_address : "") || p.address_line1 || "",
    city: a.city || p.service_city || p.city || "",
    province: a.province || p.service_province || p.province || "QC",
    postal_code: a.postal_code || p.service_postal || p.postal_code || "",
  };
}

/** Normalize payload and inject the fields each template expects. */
function normalizePayload(
  docType: AutoDocType,
  raw: Record<string, any>,
): Record<string, any> {
  const p = { ...(raw || {}) };
  const clientName = pickClientName(p);
  const addr = pickAddress(p);

  // Common fields that nearly every template uses
  const base = {
    ...p,
    client_name: clientName,
    client_email: p.client_email || p.email || "",
    client_phone: p.client_phone || p.phone || "",
    client_address: p.client_address || addr.street || "",
    client_city: p.client_city || addr.city || "",
    client_province: p.client_province || addr.province || "QC",
    client_postal: p.client_postal || addr.postal_code || "",
    account_number: p.account_number || "—",
    issue_date: p.issue_date || nowIso(),
    // Service fields — always have a value
    service_name: p.service_name || p.plan_name || "Service Nivra Telecom",
    monthly_amount: Number(p.monthly_amount ?? p.unit_price ?? p.plan_price ?? 0),
    activation_date: p.activation_date || p.active_since || p.created_at || nowIso(),
  };

  switch (docType) {
    case "welcome_letter":
      return {
        ...base,
        letter_number: p.letter_number || `BVN-${Date.now()}`,
        service_name: p.service_name || p.plan_name || base.service_name || "Service Nivra Telecom",
        activation_date: p.activation_date || p.created_at || nowIso(),
        monthly_amount: Number(p.monthly_amount ?? p.unit_price ?? p.plan_price ?? base.monthly_amount ?? 0),
        next_billing_date: p.next_billing_date || null,
        portal_url: p.portal_url || "https://nivra-telecom.ca/portal",
      };

    case "contract_amendment": {
      // Build a sensible "changes" array if trigger didn't provide one
      let changes: Array<{ field: string; old_value: string; new_value: string }> =
        Array.isArray(p.changes) ? p.changes : [];
      if (!changes.length) {
        if (p.change_type === "service_added" || p.service_name) {
          changes = [{
            field: "Service ajouté",
            old_value: "—",
            new_value: String(p.service_name || p.service_code || "Nouveau service"),
          }];
          const tarif = Number(p.unit_price ?? p.plan_price ?? p.monthly_amount ?? p.new_monthly_amount ?? 0);
          if (tarif > 0 || p.unit_price !== undefined) {
            changes.push({
              field: "Tarif mensuel",
              old_value: "—",
              new_value: `${tarif.toFixed(2)} $`,
            });
          }
        } else if (p.change_type === "service_removed") {
          changes = [{
            field: "Service retiré",
            old_value: String(p.service_name || p.service_code || "Service"),
            new_value: "—",
          }];
        } else {
          changes = [{
            field: "Modification",
            old_value: "—",
            new_value: String(p.change_type || "Mise Ã  jour du contrat"),
          }];
        }
      }
      // Sanitize each row
      changes = changes.map((c) => ({
        field: String(c?.field ?? "—"),
        old_value: String(c?.old_value ?? "—"),
        new_value: String(c?.new_value ?? "—"),
      }));
      return {
        ...base,
        amendment_number: p.amendment_number || `AMD-${Date.now()}`,
        original_contract_number: p.original_contract_number || base.account_number,
        original_contract_date: p.original_contract_date || p.account_created_at || nowIso(),
        effective_date: p.effective_date || nowIso(),
        changes,
        reason: p.reason || (p.change_type ? `Modification : ${p.change_type}` : undefined),
        new_monthly_amount: p.new_monthly_amount,
        notes: p.notes,
      };
    }

    case "address_change":
      return {
        ...base,
        notice_number: p.notice_number || `ADR-${Date.now()}`,
        old_address: p.old_address || "—",
        new_address: p.new_address || `${addr.street}, ${addr.city} ${addr.province} ${addr.postal_code}`,
        effective_date: p.effective_date || nowIso(),
      };

    case "payment_method_change":
      return {
        ...base,
        notice_number: p.notice_number || `PAY-${Date.now()}`,
        old_method: p.old_method || "—",
        new_method: p.new_method || "Nouveau moyen de paiement",
        effective_date: p.effective_date || nowIso(),
      };

    case "service_certificate": {
      const addr2 = pickAddress(p);
      return {
        ...base,
        certificate_number: p.certificate_number || `CRT-${Date.now()}`,
        service_name: p.service_name || p.plan_name || "Service Nivra",
        service_address: p.service_address && typeof p.service_address === "string" ? p.service_address : (addr2.street || base.client_address || "—"),
        service_city: p.service_city || addr2.city || base.client_city || "",
        service_province: p.service_province || addr2.province || base.client_province || "QC",
        service_postal: p.service_postal || addr2.postal_code || base.client_postal || "",
        activation_date: p.activation_date || p.active_since || nowIso(),
        active_since: p.active_since || p.activation_date || nowIso(),
        status: p.status || (p.account_status === "active" ? "Actif" : (p.account_status || "Actif")),
        monthly_amount: Number(p.monthly_amount ?? p.unit_price ?? 0),
        purpose: p.purpose,
      };
    }

    case "suspension_notice":
      return {
        ...base,
        notice_number: p.notice_number || `SUS-${Date.now()}`,
        service_name: p.service_name || p.plan_name || "Service Nivra",
        suspension_date: p.suspension_date || nowIso(),
        reason: p.reason || "Solde impayé",
        amount_due: Number(p.amount_due ?? 0),
        invoice_numbers: Array.isArray(p.invoice_numbers) ? p.invoice_numbers : undefined,
        reactivation_fee: p.reactivation_fee ? Number(p.reactivation_fee) : undefined,
        reactivation_instructions: p.reactivation_instructions || undefined,
      };

    case "cancellation_confirmation":
      return {
        ...base,
        confirmation_number: p.confirmation_number || `CAN-${Date.now()}`,
        service_name: p.service_name || p.plan_name || "Service Nivra",
        cancellation_date: p.cancellation_date || nowIso(),
        effective_date: p.effective_date || p.cancellation_date || nowIso(),
        reason: p.reason || "—",
        final_balance: Number(p.final_balance ?? p.amount_due ?? 0),
        equipment_to_return: Array.isArray(p.equipment_to_return) ? p.equipment_to_return : undefined,
        refund_pending: p.refund_pending ? Number(p.refund_pending) : undefined,
        notes: p.notes,
      };

    case "chargeback_notice":
      return {
        ...base,
        notice_number: p.notice_number || `CHB-${Date.now()}`,
        chargeback_date: p.chargeback_date || p.chargeback_opened_at || nowIso(),
        invoice_number: p.invoice_number || "—",
        invoice_date: p.invoice_date || p.created_at || base.issue_date,
        invoice_amount: Number(p.invoice_amount ?? p.amount ?? 0),
        chargeback_amount: Number(p.chargeback_amount ?? p.amount ?? 0),
        bank_reference: p.bank_reference || undefined,
        reason_code: p.reason_code || undefined,
        reactivation_fee: Number(p.reactivation_fee ?? 25),
        total_due: Number(p.total_due ?? (Number(p.chargeback_amount ?? p.amount ?? 0) + Number(p.reactivation_fee ?? 25))),
        response_deadline: p.response_deadline || p.due_date || nowIso(),
      };

    case "final_refund_receipt":
      return {
        ...base,
        receipt_number: p.receipt_number || `REF-${Date.now()}`,
        refund_amount: Number(p.refund_amount ?? 0),
        processed_date: p.processed_date || p.refund_date || nowIso(),
        refund_method: p.refund_method || p.method || "Remboursement manuel",
        reference_number: p.reference_number || p.reference || undefined,
        related_invoice: p.related_invoice || p.invoice_number || undefined,
        reason: p.reason || "Remboursement suite a annulation de service",
        account_closed: p.account_closed ?? false,
      };

    case "delivery_slip":
      return {
        ...base,
        slip_number: p.slip_number || `BL-${Date.now()}`,
        order_number: p.order_number || "—",
        carrier: p.carrier || "—",
        tracking_number: p.tracking_number || "—",
        estimated_delivery: p.estimated_delivery || undefined,
        delivery_address: p.delivery_address || base.client_address || "—",
        delivery_city: p.delivery_city || base.client_city || "",
        delivery_province: p.delivery_province || base.client_province || "QC",
        delivery_postal: p.delivery_postal || base.client_postal || "",
        items: Array.isArray(p.items)
          ? p.items.map((it: any) => ({
              description: it.description || it.name || String(it),
              serial_number: it.serial_number || it.imei || undefined,
              quantity: Number(it.quantity || 1),
            }))
          : Array.isArray(p.equipment_details)
            ? (p.equipment_details as any[]).map((e: any) => ({
                description: e.name || e.description || String(e),
                serial_number: e.serial_number || e.imei || undefined,
                quantity: Number(e.quantity || 1),
              }))
            : [],
      };

    case "return_instructions":
      return {
        ...base,
        instruction_number: p.instruction_number || `RET-${Date.now()}`,
        order_number: p.order_number || "—",
        items: Array.isArray(p.items) ? p.items.map((it: any) => ({
          description: it.description || it.name || String(it),
          serial_number: it.serial_number || it.imei || undefined,
        })) : [],
        return_deadline: p.return_deadline || p.due_date || nowIso(),
        return_address: p.return_address || "1799 Av. Pierre-Péladeau",
        return_city: p.return_city || "Laval",
        return_province: p.return_province || "QC",
        return_postal: p.return_postal || "H7T 2Y5",
        non_return_fee: Number(p.non_return_fee ?? 60),
        return_method: p.return_method || undefined,
        rma_number: p.rma_number || undefined,
      };

    case "installation_report":
      return {
        ...base,
        report_number: p.report_number || `INS-${Date.now()}`,
        appointment_date: p.appointment_date || p.installation_date || p.scheduled_at || nowIso(),
        technician_name: p.technician_name || "—",
        technician_id: p.technician_id || undefined,
        service_address: p.service_address || base.client_address || "—",
        service_city: p.service_city || base.client_city || "",
        service_province: p.service_province || base.client_province || "QC",
        service_postal: p.service_postal || base.client_postal || "",
        service_installed: p.service_installed || p.service_name || p.plan_name || "Service Nivra",
        equipment_installed: Array.isArray(p.equipment_installed) ? p.equipment_installed : [],
        outcome: p.outcome || "success",
        notes: p.notes,
        start_time: p.start_time || undefined,
        end_time: p.end_time || undefined,
        client_signature_required: p.client_signature_required ?? false,
      };

    case "activation_confirmation": {
      // Infer service type from plan name when not provided
      const sName = String(p.service_name || p.plan_name || "").toLowerCase();
      const inferredType: "mobile" | "internet" | "tv" | "other" =
        sName.includes("mobile") || sName.includes("forfait") ? "mobile" :
        sName.includes("tv") ? "tv" :
        sName.includes("internet") || sName.includes("fibre") || sName.includes("giga") ? "internet" : "other";
      return {
        ...base,
        confirmation_number: p.confirmation_number || `ACT-${Date.now()}`,
        activation_date: p.activation_date || nowIso(),
        service_name: p.service_name || p.plan_name || "Service Nivra",
        service_type: p.service_type || inferredType,
        monthly_amount: Number(p.monthly_amount ?? p.unit_price ?? 0),
        first_billing_cycle: p.first_billing_cycle || undefined,
        phone_number: p.phone_number,
        sim_iccid: p.sim_iccid,
        internet_speed: p.internet_speed,
        static_ip: p.static_ip,
        notes: p.notes,
      };
    }

    case "formal_demand":
      return {
        ...base,
        demand_number: p.demand_number || `MED-${Date.now()}`,
        demand_date: p.demand_date || nowIso(),
        total_due: Number(p.total_due ?? p.amount_due ?? 0),
        invoices: Array.isArray(p.invoices) ? p.invoices.map((inv: any) => ({
          invoice_number: String(inv.invoice_number || "—"),
          invoice_date: String(inv.invoice_date || inv.date || ""),
          amount: Number(inv.amount ?? 0),
          days_overdue: Number(inv.days_overdue ?? 0),
        })) : [],
        response_deadline: p.response_deadline || p.due_date || nowIso(),
        legal_basis: p.legal_basis || undefined,
      };

    case "collections_transfer":
      return {
        ...base,
        transfer_number: p.transfer_number || `COL-${Date.now()}`,
        transfer_effective_date: p.transfer_effective_date || p.transfer_date || nowIso(),
        total_transferred: Number(p.total_transferred ?? p.amount ?? 0),
        collection_agency_name: p.collection_agency_name || "Agence de recouvrement",
        collection_agency_phone: p.collection_agency_phone || undefined,
        collection_agency_email: p.collection_agency_email || undefined,
        collection_agency_reference: p.collection_agency_reference || undefined,
        credit_bureau_reported: p.credit_bureau_reported ?? false,
      };

    case "complaint_acknowledgment":
      return {
        ...base,
        acknowledgment_number: p.acknowledgment_number || `PLT-${Date.now()}`,
        complaint_received_date: p.complaint_received_date || p.complaint_date || nowIso(),
        complaint_summary: p.complaint_summary || p.complaint_subject || p.description || "Plainte client",
        case_number: p.case_number || p.ticket_number || p.acknowledgment_number || `PLT-${Date.now()}`,
        assigned_agent: p.assigned_agent || undefined,
        expected_resolution_date: p.expected_resolution_date || p.due_date || nowIso(),
        next_step: p.next_step || undefined,
      };

    case "preauthorization_confirmation":
      return {
        ...base,
        confirmation_number: p.confirmation_number || `PRE-${Date.now()}`,
        authorized_amount: Number(p.authorized_amount ?? 0),
        payment_method: p.payment_method || p.method || "Carte de credit",
        capture_deadline: p.capture_deadline || p.due_date || p.authorized_at || nowIso(),
        related_order: p.related_order || p.order_number || undefined,
        related_invoice: p.related_invoice || p.invoice_number || undefined,
        purpose: p.purpose || "Pre-autorisation de paiement",
        notes: p.notes || undefined,
      };

    default:
      return base;
  }
}

// --------------------------------------------------------------------------
// Result extraction (templates return { blob, filename })
// --------------------------------------------------------------------------

async function blobToBytes(blob: Blob): Promise<Uint8Array> {
  const ab = await blob.arrayBuffer();
  return new Uint8Array(ab);
}

async function toResult(
  result: { success: boolean; blob?: Blob; filename?: string; error?: string },
  fallbackFilename: string,
  docNumber?: string,
): Promise<DispatchResult> {
  if (!result.success || !result.blob) {
    throw new Error(result.error || "PDF generation failed");
  }
  const bytes = await blobToBytes(result.blob);
  return {
    bytes,
    filename: result.filename || fallbackFilename,
    docNumber,
    fileSizeBytes: bytes.byteLength,
  };
}

// --------------------------------------------------------------------------
// Public API
// --------------------------------------------------------------------------

export async function dispatchAutoDocument(
  docType: AutoDocType,
  payload: Record<string, any>,
): Promise<DispatchResult> {
  const enriched = await enrichFromDb(docType, payload || {});
  const p = normalizePayload(docType, enriched);
  switch (docType) {
    case "welcome_letter":
      return toResult(generateWelcomeLetterPDF(p as any), `Lettre_Bienvenue_${p.letter_number}.pdf`, p.letter_number);
    case "address_change":
      return toResult(generateAddressChangePDF(p as any), `Changement_Adresse_${p.notice_number}.pdf`, p.notice_number);
    case "payment_method_change":
      return toResult(generatePaymentMethodChangePDF(p as any), `Changement_Paiement_${p.notice_number}.pdf`, p.notice_number);
    case "service_certificate":
      return toResult(generateServiceCertificatePDF(p as any), `Attestation_Service_${p.certificate_number}.pdf`, p.certificate_number);
    case "suspension_notice":
      return toResult(generateSuspensionNoticePDF(p as any), `Avis_Suspension_${p.notice_number}.pdf`, p.notice_number);
    case "cancellation_confirmation":
      return toResult(generateCancellationConfirmationPDF(p as any), `Confirmation_Annulation_${p.confirmation_number}.pdf`, p.confirmation_number);
    case "chargeback_notice":
      return toResult(generateChargebackNoticePDF(p as any), `Avis_Chargeback_${p.notice_number}.pdf`, p.notice_number);
    case "final_refund_receipt":
      return toResult(generateFinalRefundReceiptPDF(p as any), `Recu_Remboursement_Final_${p.receipt_number}.pdf`, p.receipt_number);
    case "delivery_slip":
      return toResult(generateDeliverySlipPDF(p as any), `Bon_Livraison_${p.slip_number}.pdf`, p.slip_number);
    case "return_instructions":
      return toResult(generateReturnInstructionsPDF(p as any), `Instructions_Retour_${p.instruction_number}.pdf`, p.instruction_number);
    case "installation_report":
      return toResult(generateInstallationReportPDF(p as any), `Rapport_Installation_${p.report_number}.pdf`, p.report_number);
    case "activation_confirmation":
      return toResult(generateActivationConfirmationPDF(p as any), `Confirmation_Activation_${p.confirmation_number}.pdf`, p.confirmation_number);
    case "contract_amendment":
      return toResult(generateContractAmendmentPDF(p as any), `Avenant_Contrat_${p.amendment_number}.pdf`, p.amendment_number);
    case "formal_demand":
      return toResult(generateFormalDemandPDF(p as any), `Mise_en_Demeure_${p.demand_number}.pdf`, p.demand_number);
    case "collections_transfer":
      return toResult(generateCollectionsTransferPDF(p as any), `Transfert_Recouvrement_${p.transfer_number}.pdf`, p.transfer_number);
    case "complaint_acknowledgment":
      return toResult(generateComplaintAcknowledgmentPDF(p as any), `Accuse_Plainte_${p.acknowledgment_number}.pdf`, p.acknowledgment_number);
    case "preauthorization_confirmation":
      return toResult(generatePreauthorizationConfirmationPDF(p as any), `Confirmation_Preautorisation_${p.confirmation_number}.pdf`, p.confirmation_number);
    default:
      throw new Error(`Unknown doc_type: ${docType}`);
  }
}
