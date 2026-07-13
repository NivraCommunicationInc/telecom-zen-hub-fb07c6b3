/**
 * useOrderProcessing — Data hook for Admin Order Processing Workspace
 * Single source of truth: all reads/writes go through adminClient → canonical DB tables.
 * Every mutation invalidates both admin and client query keys.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOptionalAuth } from "@/hooks/useAuth";
import { useActivityLog } from "@/hooks/useActivityLog";
import { toast } from "sonner";
import { orderEmails } from "@/core-app/lib/emails/orderEmails";
import { addClientAutoNote, fmtMoney } from "@/core-app/lib/clientAutoNotes";

import { enqueueCommunication } from "@/lib/enqueueCommunication";
/**
 * Append-only email enqueue. NEVER throws — an email failure must not break
 * any order mutation. Logs to console on failure.
 */
async function enqueueOrderEmail(row: Record<string, any> | null | undefined) {
  if (!row || !row.to_email || !row.entity_id) return;
  try {
    const idempotencyKey: string = row.idempotency_key
      ?? row.event_key
      ?? `order-email:${row.template_key ?? "generic"}:${row.entity_id}`;
    await enqueueCommunication({
      channel: "email",
      templateKey: row.template_key,
      recipient: row.to_email,
      idempotencyKey,
      templateVars: row.template_vars ?? row.variables ?? {},
      entityType: row.entity_type ?? "order",
      entityId: row.entity_id,
      subject: row.subject ?? null,
      scheduledFor: row.scheduled_for ?? row.scheduled_at ?? row.next_retry_at ?? null,
      priority: typeof row.priority === "number" ? row.priority : 0,
      toName: row.to_name ?? null,
      cc: row.cc ?? null,
      bcc: row.bcc ?? null,
      replyTo: row.reply_to ?? null,
      attachments: row.attachments ?? null,
    });
  } catch (err: any) {
    console.error("[orderEmails] enqueue exception:", err?.message, {
      template: row.template_key,
      entity: row.entity_id,
    });
  }
}

/** Map order payment_method values to valid billing_payment_method enum values.
 *  Falls back to 'manual' for null/unknown values so admin operations don't crash. */
function mapToBillingMethod(method?: string | null): "interac" | "manual" | "paypal" {
  if (!method) {
    console.warn("[mapToBillingMethod] payment_method missing — falling back to 'manual'");
    return "manual";
  }
  const m = method.toLowerCase();
  if (m === "paypal") return "paypal";
  if (m === "manual") return "manual";
  if (m === "interac" || m === "etransfer" || m === "e_transfer" || m === "virement") return "interac";
  console.warn(`[mapToBillingMethod] Unrecognized payment_method "${method}" — falling back to 'manual'`);
  return "manual";
}

/* ─── Types ─── */
export type WorkflowStepId =
  | "client_info"
  | "order_review"
  | "payment"
  | "kyc"
  | "fulfillment"
  | "equipment"
  | "activation"
  | "tv_channels"
  | "sim_esim"
  | "port_in"
  | "contracts"
  | "shipping"
  | "completion";

export type StepStatus = "pending" | "completed" | "blocked";

export interface WorkflowStep {
  id: WorkflowStepId;
  label: string;
  status: StepStatus;
  optional?: boolean;
}

/* ─── Installation time estimate ─── */
function computeInstallationEstimate(order: any, appointment: any): {
  label: string;
  minutes: number;
  wiringNeeded: boolean;
} {
  const svcType = (order?.service_type || "").toLowerCase();
  const installType = (order?.installation_type || appointment?.installation_method || "").toLowerCase();
  const wiringNeeded = installType.includes("new") || installType.includes("complex") || installType.includes("n2");

  let minutes = 60;
  let label = "~1 heure";

  if (wiringNeeded) {
    minutes = 120;
    label = "2 heures+ (nouveau câblage requis)";
  } else if (svcType.includes("tv") && svcType.includes("internet")) {
    minutes = 75;
    label = "~1h15 (Internet + TV, câblage existant)";
  } else if (svcType.includes("tv")) {
    minutes = 45;
    label = "~45 min (TV, câblage existant)";
  } else if (svcType.includes("internet")) {
    minutes = 30;
    label = "~30 min (Internet, câblage existant)";
  }

  return { label, minutes, wiringNeeded };
}

/* ─── Dynamic workflow per order type ─── */
function buildWorkflow(order: any, channelSelection?: any, mobileFulfillment?: any, appointment?: any): WorkflowStep[] {
  const serviceType = (order?.service_type || "").toLowerCase();
  const hasKyc = order?.kyc_policy !== "none" && order?.kyc_policy !== "skip";

  const base: WorkflowStep[] = [
    { id: "client_info", label: "Information client", status: "pending" },
    { id: "order_review", label: "Revue de commande", status: "pending" },
    { id: "payment", label: "Paiement & Facture", status: "pending" },
  ];

  if (hasKyc) {
    base.push({ id: "kyc", label: "Vérification KYC", status: "pending", optional: true });
  }

  if (serviceType.includes("mobile")) {
    base.push(
      { id: "sim_esim", label: "SIM / eSIM", status: "pending" },
      { id: "port_in", label: "Port-in numéro", status: "pending" },
      { id: "activation", label: "Activation / SIM", status: "pending" },
      { id: "equipment", label: "Équipement", status: "pending" },
      { id: "contracts", label: "Contrat & Documents", status: "pending" },
      { id: "shipping", label: "Expédition", status: "pending" },
      { id: "completion", label: "Complétion", status: "pending" },
    );
  } else if (serviceType.includes("internet") || serviceType.includes("tv") || serviceType.includes("bundle") || serviceType.includes("combo")) {
    base.push(
      { id: "fulfillment", label: "Fulfillment / Routing", status: "pending" },
      { id: "equipment", label: "Équipement", status: "pending" },
      { id: "shipping", label: "Technicien / Expédition", status: "pending" },
      { id: "activation", label: "Activation", status: "pending" },
    );
    if (serviceType.includes("tv") || serviceType.includes("combo") || serviceType.includes("bundle")) {
      base.push({ id: "tv_channels", label: "Chaînes TV", status: "pending" });
    }
    if (serviceType.includes("bundle") || serviceType.includes("combo")) {
      base.push(
        { id: "sim_esim", label: "SIM / eSIM", status: "pending" },
        { id: "port_in", label: "Port-in numéro", status: "pending" },
      );
    }
    base.push(
      { id: "contracts", label: "Contrat & Documents", status: "pending" },
      { id: "completion", label: "Complétion", status: "pending" },
    );
  } else if (serviceType.includes("streaming")) {
    base.push(
      { id: "activation", label: "Activation Streaming", status: "pending" },
      { id: "contracts", label: "Documents", status: "pending" },
      { id: "completion", label: "Complétion", status: "pending" },
    );
  } else {
    base.push(
      { id: "fulfillment", label: "Fulfillment", status: "pending" },
      { id: "equipment", label: "Équipement", status: "pending" },
      { id: "activation", label: "Activation", status: "pending" },
      { id: "contracts", label: "Contrat & Documents", status: "pending" },
      { id: "shipping", label: "Expédition / Technicien", status: "pending" },
      { id: "completion", label: "Complétion", status: "pending" },
    );
  }

  return computeStepStatuses(base, order, channelSelection, mobileFulfillment, appointment);
}

function computeStepStatuses(steps: WorkflowStep[], order: any, channelSelection?: any, mobileFulfillment?: any, appointment?: any): WorkflowStep[] {
  if (!order) return steps;
  const mf = mobileFulfillment || (order as any)._mobileFulfillment || null;
  const simCompleted = mf?.activation_status === "active";

  return steps.map((step) => {
    let status: StepStatus = "pending";
    switch (step.id) {
      case "client_info":
        if (order.client_first_name && order.client_last_name && order.client_email) status = "completed";
        break;
      case "order_review":
        if (order.status !== "pending" && order.status !== "submitted") status = "completed";
        break;
      case "payment": {
        const invoiceStatus = String(order._invoice_status || "").toLowerCase();
        const invoiceBalanceDue = Number(order._invoice_balance_due ?? NaN);

        if (invoiceStatus === "paid" || (!Number.isNaN(invoiceBalanceDue) && invoiceBalanceDue <= 0)) {
          status = "completed";
        } else if (order.payment_status === "failed") {
          status = "blocked";
        } else if (["paid", "captured", "confirmed"].includes(order.payment_status || "")) {
          // Backward-compatible fallback when invoice data is not available
          status = "completed";
        }
        break;
      }
      case "kyc": {
        // Source of truth (in order): orders.kyc_status, kycSession.status,
        // legacy id_verification_status. Also treat kyc_policy=none|skip as N/A.
        const orderKycStatus = (order as any).kyc_status || "not_required";
        const sessionStatus = (order as any)._kycSessionStatus || "";
        const legacyStatus = order.id_verification_status || "";
        const policy = (order as any).kyc_policy || "";
        if (
          orderKycStatus === "approved" ||
          orderKycStatus === "not_required" ||
          policy === "none" ||
          policy === "skip" ||
          sessionStatus === "approved" ||
          legacyStatus === "approved" ||
          legacyStatus === "verified"
        ) {
          status = "completed";
        } else if (
          orderKycStatus === "rejected" ||
          sessionStatus === "rejected" ||
          legacyStatus === "rejected"
        ) {
          status = "blocked";
        }
        break;
      }
      case "fulfillment": {
        // BUG-CORE-002C Phase 2 — Priority order:
        //   1) appointments.installation_method (canonical hold)
        //   2) orders.fulfillment_type (explicit self_install / technician)
        //   3) legacy fallback (fulfillment_type + address)
        const apptMethod = String(appointment?.installation_method || "").toLowerCase();
        const ft = String(order.fulfillment_type || "").toLowerCase();
        if (apptMethod === "technician" || apptMethod === "auto") {
          status = "completed";
        } else if (ft === "self_install" || ft === "technician" || ft === "installation") {
          status = "completed";
        } else if (order.fulfillment_type && (order.service_location_id || order.shipping_address || order.client_full_address)) {
          status = "completed";
        }
        break;
      }
      case "equipment":
        if (order.equipment_id || order.sim_number || order.serial_number) status = "completed";
        break;
      case "activation":
        if (["active", "activated", "completed", "delivered"].includes(order.status || "")) status = "completed";
        break;
      case "contracts":
        if (order.related_contract_id) status = "completed";
        break;
      case "tv_channels": {
        const channelStatus = String(channelSelection?.status || "").toLowerCase();
        const hasChannels =
          (Array.isArray(channelSelection?.channels) && channelSelection.channels.length > 0) ||
          (Array.isArray(order?.selected_channels) && order.selected_channels.length > 0);
        if ((channelStatus === "confirmed" && hasChannels && order.channel_selection_locked === true) ||
            (["activated", "completed", "delivered", "installation_completed"].includes(String(order?.status || "").toLowerCase()) && hasChannels)) {
          status = "completed";
        }
        break;
      }
      case "shipping":
        if (order.tracking_number || order.shipped_at || order.technician_id || order.status === "delivered") status = "completed";
        break;
      case "sim_esim":
        if (simCompleted) status = "completed";
        break;
      case "port_in": {
        // Port-in is optional — never block on absence.
        // Only mark as blocked when explicitly failed or cancelled.
        const portStatus = String(mf?.port_in_status || "").toLowerCase();
        if (portStatus === "completed") {
          status = "completed";
        } else if (portStatus === "failed" || portStatus === "cancelled") {
          status = "blocked";
        } else {
          // initiated / in_progress / confirmed / empty → pending (gray icon, no red triangle)
          status = "pending";
        }
        break;
      }
      case "completion":
        if (order.status === "completed") status = "completed";
        break;
    }
    return { ...step, status };
  });
}

/* ─── Invalidation keys (admin + client) ─── */
const INVALIDATION_KEYS = [
  "admin-orders",
  "admin-order-detail",
  "admin-order-overview",
  "core-order-detail",
  "canonical-client-data",
  "shared-client-profile",
  "account-profile",
  "account-profile-orders",
  "account-profile-invoices",
  "account-profile-payments",
  "account-profile-subscriptions",
  "client-orders",
  "client-orders-all",
  "client-order-lifecycle",
  "client-orders-for-docs",
  "client-orders-in-progress",
  "client-invoices",
  "client-invoice-breakdowns",
  "client-payments",
  "client-contracts",
  "client-contracts-for-docs",
  "client-auto-documents",
  "client-orders-in-progress-appointments",
  "billing-hub-unpaid",
  "billing-hub-all-invoices",
  "client-profile-dashboard",
  "client-account",
  "client-account-billing",
  "client-account-identity",
  "client-billing-subscriptions",
  "client-billing-subscriptions-canonical",
  "client-subscriptions",
  "client-subscriptions-billing",
  "client-monthly-invoices",
  "client-billing-invoices-canonical",
  "client-billing-payments-canonical",
  "billing-invoices",
  "billing-payments",
  "account-profile-billing-customer",
  "account-docs-contracts",
  "ledger-history-v2",
  "ledger-balance",
  "portal-section-badges",
  "service-addresses",
  "address-service-counts",
  "client-services-orders",
  "overdue-count-unified",
  "admin-activity-logs",
  "client-internal-notes-shared",
  "core-client-notes",
  "account-360-notes",
];

/* ─── Email queue helper ─── */
async function queueClientEmail(params: {
  to_email: string;
  template_key: string;
  event_key: string;
  subject: string;
  entity_type?: string;
  entity_id?: string;
  template_vars?: Record<string, any>;
  idempotency_key?: string;
  scheduled_for?: string | null;
  mode?: "automatic" | "manual";
}) {
  try {
    const templateVars = {
      ...(params.template_vars || {}),
      ...(params.mode === "manual" ? { manual_send: true } : {}),
    };

    let error: any = null;
    try { await enqueueCommunication({
      channel: "email",
      templateKey: params.template_key,
      recipient: params.to_email,
      idempotencyKey: params.idempotency_key,
      templateVars: templateVars,
      subject: params.subject,
      entityType: params.entity_type || "order",
      entityId: params.entity_id,
      scheduledFor: params.scheduled_for ?? null,
    }); } catch (__e) { error = __e; }
    if (error) {
      console.error("[GUARDRAIL][EmailQueue] Insert failed:", error.message, { template: params.template_key, entity: params.entity_id });
      toast.warning(`⚠ Courriel non envoyé (${params.template_key}) — ${error.message}`);
    }
  } catch (err: any) {
    console.error("[GUARDRAIL][EmailQueue] Exception:", err?.message, { template: params.template_key });
    toast.warning(`⚠ Courriel non envoyé (${params.template_key})`);
  }
}

/* ─── Main hook ─── */
export function useOrderProcessing(orderId: string | undefined) {
  const queryClient = useQueryClient();
  const { user } = useOptionalAuth();
  const { logActivity } = useActivityLog();
  const [activeStep, setActiveStep] = useState<WorkflowStepId>("client_info");

  /* ── Fetch order with profile ── */
  const orderQuery = useQuery({
    queryKey: ["admin-order-detail", orderId],
    enabled: !!orderId,
    queryFn: async () => {
      const { data: order, error } = await supabase
        .from("orders")
        .select("*")
        .eq("id", orderId!)
        .single();
      if (error) throw error;

      // Fetch profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", order.user_id)
        .maybeSingle();

      // Fetch account
      const { data: account } = await supabase
        .from("accounts")
        .select("*")
        .eq("client_id", order.user_id)
        .maybeSingle();

      // Fetch order items
      const { data: items } = await supabase
        .from("order_items")
        .select("*")
        .eq("order_id", orderId!);

      // Fetch canonical invoice from billing_invoices (prefer open invoice if multiple)
      const { data: invoices } = await supabase
        .from("billing_invoices")
        .select("*")
        .eq("order_id", orderId!)
        .order("created_at", { ascending: false });

      const invoice = (invoices || []).find((inv: any) => {
        const status = String(inv?.status || "").toLowerCase();
        const balanceDue = Number(inv?.balance_due ?? 0);
        return !["paid", "paid_by_promo", "void", "cancelled"].includes(status) && balanceDue > 0;
      }) || (invoices?.[0] ?? null);

      // Fetch billing_invoice_lines for full itemized breakdown
      let invoiceLines: any[] = [];
      if (invoice?.id) {
        const { data: lines } = await supabase
          .from("billing_invoice_lines")
          .select("*")
          .eq("invoice_id", invoice.id)
          .order("created_at", { ascending: true });
        invoiceLines = lines || [];
      }

      // Fetch contracts
      const { data: contracts } = await supabase
        .from("contracts")
        .select("*")
        .eq("order_id", orderId!)
        .order("created_at", { ascending: false });

      // Fetch appointment
      const { data: appointment } = await supabase
        .from("appointments")
        .select("*")
        .eq("order_id", orderId!)
        .neq("status", "cancelled")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Fetch KYC session: try by session ID first, then by order_id
      let kycSession = null;
      if (order.identity_verification_session_id) {
        const { data } = await supabase
          .from("identity_verification_sessions")
          .select("*")
          .eq("id", order.identity_verification_session_id)
          .maybeSingle();
        kycSession = data;
      }
      if (!kycSession) {
        const { data } = await supabase
          .from("identity_verification_sessions")
          .select("*")
          .eq("order_id", orderId!)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        kycSession = data;
      }

      // Fetch activity logs
      const { data: activityLogs } = await supabase
        .from("activity_logs")
        .select("*")
        .eq("entity_type", "order")
        .eq("entity_id", orderId!)
        .order("created_at", { ascending: false })
        .limit(50);

      // Fetch channel selections for TV/combo orders (strictly by order first)
      let channelSelection = null;
      const svcType = (order.service_type || "").toLowerCase();
      if (svcType.includes("tv") || svcType.includes("combo") || svcType.includes("bundle")) {
        const { data: csByOrder } = await supabase
          .from("channel_selections")
          .select("*")
          .eq("order_id", order.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const { data: csByUser } = !csByOrder
          ? await supabase
              .from("channel_selections")
              .select("*")
              .eq("user_id", order.user_id)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle()
          : { data: null as any };

        channelSelection = csByOrder || csByUser || null;

        if (!channelSelection && Array.isArray(order.selected_channels) && order.selected_channels.length > 0) {
          channelSelection = {
            id: null,
            user_id: order.user_id,
            order_id: order.id,
            channels: order.selected_channels,
            status: order.channel_selection_locked ? "confirmed" : "pending",
            total_price: 0,
          };
        }
      }

      // Fetch client service addresses for admin by-address management
      const { data: serviceAddresses } = account?.id
        ? await supabase
            .from("service_addresses")
            .select("*")
            .eq("account_id", account.id)
            .eq("is_active", true)
            .order("is_default", { ascending: false })
            .order("created_at", { ascending: true })
        : { data: [] as any[] };

      // Fetch mobile fulfillment data for mobile orders
      let mobileFulfillment = null;
      if (svcType.includes("mobile")) {
        const { data: mf } = await supabase
          .from("mobile_fulfillment")
          .select("*")
          .eq("order_id", orderId!)
          .maybeSingle();
        mobileFulfillment = mf;
      }

      // Compute installation time estimate
      const installationEstimate = computeInstallationEstimate(order, appointment);

      // ★ Incomplete-data alert (set by fn_flag_incomplete_order trigger)
      const { data: incompleteAlert } = await supabase
        .from("billing_system_alerts")
        .select("id, details, created_at")
        .eq("alert_type", "incomplete_data")
        .eq("entity_type", "order")
        .eq("entity_id", orderId!)
        .eq("resolved", false)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Enrich order with canonical KYC status from session for workflow step computation
      const enrichedOrder = {
        ...order,
        _kycSessionStatus: kycSession?.status || null,
        _invoice_status: invoice?.status || null,
        _invoice_balance_due: invoice?.balance_due ?? null,
      };

      return {
        order: enrichedOrder,
        profile,
        account,
        items: items || [],
        invoice,
        invoiceLines,
        contracts: contracts || [],
        appointment,
        channelSelection,
        serviceAddresses: serviceAddresses || [],
        installationEstimate,
        mobileFulfillment,
        kycSession,
        activityLogs: activityLogs || [],
        incompleteAlert: incompleteAlert || null,
      };
    },
  });

  const data = orderQuery.data;
  const workflow = data?.order ? buildWorkflow(data.order, data.channelSelection, data.mobileFulfillment, data.appointment) : [];

  /* ── Invalidate everything ── */
  const invalidateAll = () => {
    INVALIDATION_KEYS.forEach((key) => {
      queryClient.invalidateQueries({ queryKey: [key] });
    });
  };

  /* ── Get client email for notifications ── */
  const getClientEmail = (): string | null => {
    return data?.order?.client_email || data?.profile?.email || null;
  };

  const getClientName = (): string => {
    return data?.profile?.full_name
      || [data?.order?.client_first_name, data?.order?.client_last_name].filter(Boolean).join(" ")
      || "Client";
  };

  /* ── Auto-note shortcut bound to this order's client ──
   * Writes to BOTH client_internal_notes (client profile) and
   * activity_logs (order timeline) so notes are visible everywhere. */
  const noteClient = (event: Parameters<typeof addClientAutoNote>[0]["event"], detail?: string, metadata?: Record<string, any>) => {
    const clientId = data?.order?.user_id;
    if (!clientId) return;
    addClientAutoNote({
      clientId,
      event,
      detail,
      metadata,
      orderId: orderId || null,
    });
  };

  /* ── Update order fields ── */
  const updateOrder = useMutation({
    mutationFn: async (fields: Record<string, any>) => {
      const { error } = await supabase
        .from("orders")
        .update({ ...fields, updated_at: new Date().toISOString() })
        .eq("id", orderId!);
      if (error) throw error;
      return fields;
    },
    onSuccess: (fields) => {
      invalidateAll();
      // ── order_modified email (append-only, non-blocking) ──
      try {
        const order = data?.order;
        const profile = data?.profile;
        if (order && profile && fields && typeof fields === "object") {
          // Skip pure auto-bookkeeping updates that aren't real "modifications"
          const noisyOnly = Object.keys(fields).every((k) =>
            ["updated_at", "processed_at", "processed_by", "payment_confirmed_at"].includes(k)
          );
          if (!noisyOnly) {
            enqueueOrderEmail(orderEmails.orderModified(order, profile, fields as any));
            const changedKeys = Object.keys(fields).filter((k) => k !== "updated_at");
            noteClient("order_modified", `Champs: ${changedKeys.join(", ")}`, fields);
          }
        }
      } catch (e: any) {
        console.error("[orderEmails] updateOrder hook error:", e?.message);
      }
    },
  });

  /* ── Change order status ──
   * Nivra Core admins/staff have full authority to advance an order through
   * any lifecycle stage (processing, shipping, completion) WITHOUT requiring
   * the client contract signature. The contract can still be signed in
   * parallel by the client. Legacy `forceOverride` / `overrideReason`
   * options are accepted for backward compatibility but no longer required. */
  type ChangeStatusOpts = { reason?: string; forceOverride?: boolean; overrideReason?: string };
  const changeStatus = async (newStatus: string, opts?: string | ChangeStatusOpts) => {
    const oldStatus = data?.order?.status;
    const normalized: ChangeStatusOpts = typeof opts === "string" ? { reason: opts } : (opts || {});
    const reason = normalized.reason;

    // Use safe transition for completion states from intake states
    const intakeStates = ["submitted", "pending_admin_review", "received"];
    const completionStates = ["completed", "activated", "fulfilled", "delivered", "installation_completed"];
    if (intakeStates.includes(oldStatus || "") && completionStates.includes(newStatus)) {
      // Step through operational states to satisfy DB guard
      await updateOrder.mutateAsync({ status: "confirmed" });
      await logActivity("status_change", "order", orderId, {
        old_status: oldStatus, new_status: "confirmed", reason: "Auto-transition"
      });
      await updateOrder.mutateAsync({ status: "processing" });
      await logActivity("status_change", "order", orderId, {
        old_status: "confirmed", new_status: "processing", reason: "Auto-transition"
      });
    }

    await updateOrder.mutateAsync({ status: newStatus });
    await logActivity(
      "status_change",
      "order",
      orderId,
      { old_status: oldStatus, new_status: newStatus, reason },
      { changedField: "status", oldValue: oldStatus, newValue: newStatus, reason }
    );

    // Queue email notification to client — ONLY for client-meaningful milestones.
    // Intermediate internal transitions (confirmed, processing, on_hold, fraud, etc.)
    // must NOT spam the customer with a new email each time.
    const email = getClientEmail();
    const statusTemplateMap: Record<string, string> = {
      shipped: "order_shipped",
      delivered: "order_completed",
      completed: "order_completed",
      activated: "order_completed",
      installed: "order_completed",
      cancelled: "order_cancelled",
      installation_in_progress: "installation_in_progress",
      installation_completed: "installation_completed",
      installation_failed: "installation_failed",
    };
    const templateKey = statusTemplateMap[newStatus];
    if (email && templateKey) {
      await queueClientEmail({
        to_email: email,
        template_key: templateKey,
        // Stable event_key — UNIQUE constraint on email_queue.event_key prevents
        // duplicate sends when the same status is re-applied or replayed.
        event_key: `order_status_${orderId}_${newStatus}`,
        idempotency_key: `auto_order_status_${orderId}_${newStatus}`,
        mode: "automatic",
        subject: `Mise à jour de votre commande — ${newStatus}`,
        entity_id: orderId,
        template_vars: {
          client_name: getClientName(),
          order_id: orderId,
          order_number: data?.order?.order_number || "",
          account_number: (data as any)?.profile?.account_number || (data as any)?.order?.account_number || "",
          old_status: oldStatus,
          new_status: newStatus,
          reason: reason || "",
          status: newStatus,
        },
      });
    }


    toast.success(`Statut mis à jour: ${newStatus}`);
    noteClient("status_changed", `${oldStatus || "—"} → ${newStatus}${reason ? ` (${reason})` : ""}`, {
      order_number: data?.order?.order_number,
      old_status: oldStatus,
      new_status: newStatus,
    });

    // ── order_cancelled email (append-only) ──
    try {
      if (newStatus === "cancelled" && data?.order && data?.profile) {
        await enqueueOrderEmail(
          orderEmails.orderCancelled(data.order, data.profile, reason)
        );
      }
    } catch (e: any) {
      console.error("[orderEmails] order_cancelled enqueue error:", e?.message);
    }
  };

  /* ── Confirm payment ──
   * BUG 1 fix: DB trigger fn_guard_billable_records_require_confirmed_order blocks
   * billing writes when order.status NOT IN ('submitted','pending_admin_review',
   * 'confirmed','completed','activated','delivered'). For agents to confirm
   * payment on ANY order (e.g. provisioning_failed, fraud, on_hold), we
   * auto-promote the order to 'confirmed' first as an admin override. */
  const confirmPayment = async (reference?: string) => {
    try {
      const targetInvoice = data?.invoice;
      if (!targetInvoice?.id) {
        throw new Error("Aucune facture canonique liée à cette commande");
      }

      const currentStatus = String(targetInvoice.status || "").toLowerCase();
      const currentBalanceDue = Number(targetInvoice.balance_due ?? 0);

      if (["paid", "paid_by_promo", "void", "cancelled"].includes(currentStatus) || currentBalanceDue <= 0) {
        toast.info("Cette facture est déjà réglée");
        return;
      }

      // ★ ADMIN OVERRIDE — bypass BILLING_GUARD_BLOCKED for any non-billable status
      const BILLABLE_STATUSES = ["submitted", "pending_admin_review", "confirmed", "completed", "activated", "delivered"];
      const orderStatus = String(data?.order?.status || "").toLowerCase();
      if (orderStatus && !BILLABLE_STATUSES.includes(orderStatus)) {
        console.warn(`[confirmPayment] Order status '${orderStatus}' is not billable — auto-promoting to 'confirmed' (admin override)`);
        // Use SECURITY DEFINER RPC with extended statement_timeout (30s) to
        // accommodate the heavy AFTER-UPDATE trigger cascade on orders
        // (commission, contract generation, email enqueue, projections...).
        const { error: promoteErr } = await supabase.rpc(
          "admin_promote_order_to_confirmed" as any,
          { p_order_id: orderId! }
        );
        if (promoteErr) {
          console.error("[confirmPayment] Failed to override order status:", promoteErr);
          throw new Error(`Impossible de débloquer la commande (${orderStatus}) pour confirmation de paiement: ${promoteErr.message}`);
        }
        await logActivity("status_override_for_payment", "order", orderId, {
          from_status: orderStatus,
          to_status: "confirmed",
          reason: "Admin override to enable payment confirmation",
        });
      }

      // Step 1: Find the EXISTING pending payment for this invoice
      // Valid billing_payment_status enum: pending | confirmed | failed | cancelled | refunded
      const { data: existingPayments, error: fetchError } = await supabase
        .from("billing_payments")
        .select("*")
        .eq("invoice_id", targetInvoice.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1);

      if (fetchError) throw fetchError;

      let existingPayment = existingPayments?.[0];

      // If no billing_payments record exists, create one from order data
      // This handles orders where checkout stored payment info on orders table only
      if (!existingPayment) {
        const order = data?.order;
        if (!order?.payment_method && !order?.payment_reference) {
          throw new Error("Aucun paiement en attente trouvé pour cette facture. Utilisez 'Enregistrer paiement' pour créer un nouveau paiement.");
        }

        // Map order payment_method to billing_payment_method enum
        const methodMap: Record<string, string> = {
          etransfer: "interac",
          interac: "interac",
          card: "card",
          paypal: "paypal",
          manual: "manual",
        };
        const billingMethod = methodMap[order.payment_method || ""] || "manual";

        const paymentNumber = `PAY-${Date.now().toString(36).toUpperCase()}`;
        const { data: created, error: createErr } = await supabase
          .from("billing_payments")
          .insert({
            payment_number: paymentNumber,
            invoice_id: targetInvoice.id,
            customer_id: targetInvoice.customer_id,
            amount: Number(targetInvoice.total),
            method: billingMethod as any,
            status: "pending" as any,
            reference: reference || order.payment_reference || null,
            source: "admin_confirm",
            environment: order.environment || "production",
          })
          .select("*")
          .single();

        if (createErr) throw createErr;
        existingPayment = created;
      }

      // Step 2: UPDATE the existing payment — preserve original provider and method
      const now = new Date().toISOString();
      const { error: updatePaymentError } = await supabase
        .from("billing_payments")
        .update({
          status: "confirmed" as any,
          confirmed_by: user?.id || null,
          received_at: now,
          reference: reference || existingPayment.reference,
        })
        .eq("id", existingPayment.id);

      if (updatePaymentError) throw updatePaymentError;

      // Step 3: Update the invoice — mark as paid
      const newAmountPaid = Number(targetInvoice.amount_paid ?? 0) + Number(existingPayment.amount);
      const newBalanceDue = Math.max(0, Number(targetInvoice.total) - newAmountPaid);
      const isFullyPaid = newBalanceDue <= 0.01;

      const { error: updateInvoiceError } = await supabase
        .from("billing_invoices")
        .update({
          amount_paid: Math.round(newAmountPaid * 100) / 100,
          balance_due: Math.round(newBalanceDue * 100) / 100,
          status: (isFullyPaid ? "paid" : "partially_paid") as any,
          paid_at: isFullyPaid ? now : targetInvoice.paid_at,
          payment_method: existingPayment.method,
        })
        .eq("id", targetInvoice.id);

      if (updateInvoiceError) throw updateInvoiceError;

      // Step 4: Update order record
      await updateOrder.mutateAsync({
        payment_confirmed_at: now,
        payment_reference: reference || existingPayment.reference || data?.order?.payment_reference || "admin-confirmed",
      });

      await logActivity("payment_confirmed", "order", orderId, {
        reference,
        payment_id: existingPayment.id,
        payment_number: existingPayment.payment_number,
        invoice_id: targetInvoice.id,
        invoice_number: targetInvoice.invoice_number,
        amount_confirmed: existingPayment.amount,
        original_method: existingPayment.method,
        original_provider: existingPayment.provider,
      });

      // ── BUG #19 fix: force portal snapshot refresh (belt-and-suspenders on top of triggers) ──
      // This guarantees customer_portal_snapshots reflects the paid state BEFORE any client-side
      // read (which uses get_customer_portal_snapshot RPC with a 15s cache window).
      try {
        const clientUserId = data?.profile?.user_id || data?.order?.user_id || null;
        if (clientUserId) {
          await supabase.rpc("refresh_customer_portal_snapshot", {
            _user_id: clientUserId,
            _event_source: "order_processing_payment_confirmed",
            _event_id: null as any,
          });
        }
      } catch (e: any) {
        console.warn("[confirmPayment] portal snapshot refresh failed (non-fatal):", e?.message);
      }

      invalidateAll();
      // ★ BUG 2 fix: force immediate refetch so UI updates without waiting for stale-time
      try { await orderQuery.refetch(); } catch (e: any) { console.warn("[confirmPayment] refetch failed:", e?.message); }

      toast.success("Paiement confirmé et synchronisé");
      noteClient("payment_confirmed", `${fmtMoney(Number(existingPayment.amount))} — Facture ${targetInvoice.invoice_number || ""} (commande #${data?.order?.order_number || ""})`, {
        invoice_id: targetInvoice.id,
        payment_id: existingPayment.id,
        reference,
      });

      // Reçu client: centralisé par le déclencheur backend billing_payments.
    } catch (err: any) {
      console.error("[OrderProcessing] confirmPayment failed:", err);
      toast.error(err?.message || "Erreur lors de la confirmation du paiement");
      throw err;
    }
  };

  /* ── Mark payment invalid ── */
  /* PRODUCTION FIX: Updates billing_payments + recalculates invoice balance_due from confirmed payments. */
  const markPaymentInvalid = async (reason?: string) => {
    try {
      const targetInvoice = data?.invoice;

      // GUARD: Check invoice exists
      if (!targetInvoice?.id) {
        toast.error("Aucune facture liée — impossible de marquer le paiement invalide");
        return;
      }

      // GUARD: Don't invalidate on already-void invoices
      const invStatus = String(targetInvoice.status || "").toLowerCase();
      if (["void", "cancelled"].includes(invStatus)) {
        toast.info("Facture déjà annulée — aucune action nécessaire");
        return;
      }

      // Update billing_payments if a pending payment exists
      let invalidatedAmount = 0;
      const { data: pendingPayments } = await supabase
        .from("billing_payments")
        .select("id, amount")
        .eq("invoice_id", targetInvoice.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1);

      if (pendingPayments?.[0]) {
        invalidatedAmount = Number(pendingPayments[0].amount || 0);
        const { error: payErr } = await supabase
          .from("billing_payments")
          .update({
            status: "failed" as any,
            legacy_note: reason || "Marqué invalide par admin",
          })
          .eq("id", pendingPayments[0].id);
        if (payErr) throw payErr;
        console.info("[GUARDRAIL][PaymentInvalid] Payment marked failed:", pendingPayments[0].id);
      } else {
        console.warn("[GUARDRAIL][PaymentInvalid] No pending payment found for invoice:", targetInvoice.id);
      }

      // Recalculate invoice totals from confirmed payments only (SSOT)
      const { data: confirmedPayments } = await supabase
        .from("billing_payments")
        .select("amount")
        .eq("invoice_id", targetInvoice.id)
        .eq("status", "confirmed");

      const totalPaid = (confirmedPayments || []).reduce((sum, p) => sum + Number(p.amount || 0), 0);
      const invoiceTotal = Number(targetInvoice.total || 0);
      const newBalanceDue = Math.max(0, Math.round((invoiceTotal - totalPaid) * 100) / 100);
      const newAmountPaid = Math.round(totalPaid * 100) / 100;
      const newStatus = newAmountPaid <= 0 ? "pending" : (newBalanceDue <= 0.01 ? "paid" : "partially_paid");

      const { error: invErr } = await supabase
        .from("billing_invoices")
        .update({
          amount_paid: newAmountPaid,
          balance_due: newBalanceDue,
          status: newStatus as any,
        })
        .eq("id", targetInvoice.id);
      if (invErr) throw invErr;

      await updateOrder.mutateAsync({ payment_status: "failed" });
      await logActivity("payment_invalidated", "order", orderId, {
        reason,
        invalidated_amount: invalidatedAmount,
        invoice_id: targetInvoice.id,
      });

      invalidateAll();
      toast.warning("Paiement marqué comme invalide — facture recalculée");
      noteClient("payment_invalid", `${fmtMoney(invalidatedAmount)} invalidé — Raison: ${reason || "non précisée"}`, {
        invoice_id: targetInvoice.id,
        amount: invalidatedAmount,
        reason,
      });

    } catch (err: any) {
      console.error("[GUARDRAIL][PaymentInvalid] Failed:", err);
      toast.error(`Erreur invalidation paiement: ${err?.message || "Erreur inconnue"}`);
    }
  };

  /* ── Mark payment partial ── */
  const markPaymentPartial = async () => {
    try {
      const targetInvoice = data?.invoice;
      if (!targetInvoice?.id) {
        toast.error("Aucune facture liée — impossible de marquer partiel");
        return;
      }

      // GUARD: Already paid
      if (targetInvoice.status === "paid" && Number(targetInvoice.balance_due ?? 0) <= 0) {
        toast.info("Facture déjà entièrement payée");
        return;
      }

      // Recalculate from confirmed payments only
      const { data: confirmedPayments } = await supabase
        .from("billing_payments")
        .select("amount")
        .eq("invoice_id", targetInvoice.id)
        .eq("status", "confirmed");

      const totalPaid = (confirmedPayments || []).reduce((sum, p) => sum + Number(p.amount || 0), 0);
      const invoiceTotal = Number(targetInvoice.total || 0);
      const newBalanceDue = Math.max(0, Math.round((invoiceTotal - totalPaid) * 100) / 100);

      const { error: invErr } = await supabase
        .from("billing_invoices")
        .update({
          status: "partially_paid" as any,
          amount_paid: Math.round(totalPaid * 100) / 100,
          balance_due: newBalanceDue,
        })
        .eq("id", targetInvoice.id);
      if (invErr) throw invErr;

      await updateOrder.mutateAsync({ payment_status: "partial" });
      await logActivity("payment_partial", "order", orderId, { invoice_id: targetInvoice.id });
      invalidateAll();
      toast.info("Paiement marqué comme partiel — facture recalculée");
      noteClient("payment_partial", `Facture ${targetInvoice.invoice_number || ""} marquée comme partiellement payée`, {
        invoice_id: targetInvoice.id,
      });
    } catch (err: any) {
      console.error("[GUARDRAIL][PaymentPartial] Failed:", err);
      toast.error(`Erreur paiement partiel: ${err?.message || "Erreur inconnue"}`);
    }
  };

  /* ── Record a manual payment (cash / cheque / virement / interac / autre) ──
   * Creates a confirmed billing_payments row, recomputes invoice totals,
   * and logs the activity. Used when no canonical pending payment exists. */
  const recordManualPayment = async (params: {
    amount: number;
    method: "cash" | "cheque" | "virement" | "interac" | "autre";
    reference?: string;
    note?: string;
  }) => {
    try {
      const targetInvoice = data?.invoice;
      if (!targetInvoice?.id) {
        toast.error("Aucune facture liée — impossible d'enregistrer un paiement");
        return;
      }
      const amount = Number(params.amount);
      if (!amount || amount <= 0) {
        toast.error("Montant invalide");
        return;
      }

      const methodMap: Record<typeof params.method, "interac" | "manual" | "paypal"> = {
        cash: "manual",
        cheque: "manual",
        virement: "interac",
        interac: "interac",
        autre: "manual",
      };
      const billingMethod = methodMap[params.method];
      const now = new Date().toISOString();
      const paymentNumber = `PAY-${Date.now().toString(36).toUpperCase()}`;

      const { data: created, error: createErr } = await supabase
        .from("billing_payments")
        .insert({
          payment_number: paymentNumber,
          invoice_id: targetInvoice.id,
          customer_id: targetInvoice.customer_id,
          amount,
          method: billingMethod as any,
          status: "confirmed" as any,
          reference: params.reference || null,
          legacy_note: params.note || `Paiement manuel (${params.method})`,
          confirmed_by: user?.id || null,
          received_at: now,
          source: "admin_manual_confirmation",
          environment: data?.order?.environment || "production",
        })
        .select("*")
        .single();
      if (createErr) throw createErr;

      // Recalculate invoice totals from confirmed payments only
      const { data: confirmedPayments } = await supabase
        .from("billing_payments")
        .select("amount")
        .eq("invoice_id", targetInvoice.id)
        .eq("status", "confirmed");

      const totalPaid = (confirmedPayments || []).reduce((sum, p) => sum + Number(p.amount || 0), 0);
      const invoiceTotal = Number(targetInvoice.total || 0);
      const newBalanceDue = Math.max(0, Math.round((invoiceTotal - totalPaid) * 100) / 100);
      const newAmountPaid = Math.round(totalPaid * 100) / 100;
      const isFullyPaid = newBalanceDue <= 0.01;
      const newStatus = isFullyPaid ? "paid" : (newAmountPaid > 0 ? "partially_paid" : "pending");

      const { error: invErr } = await supabase
        .from("billing_invoices")
        .update({
          amount_paid: newAmountPaid,
          balance_due: newBalanceDue,
          status: newStatus as any,
          paid_at: isFullyPaid ? now : targetInvoice.paid_at,
          payment_method: billingMethod as any,
        })
        .eq("id", targetInvoice.id);
      if (invErr) throw invErr;

      await updateOrder.mutateAsync({
        payment_confirmed_at: isFullyPaid ? now : data?.order?.payment_confirmed_at,
        payment_reference: params.reference || data?.order?.payment_reference,
      });

      await logActivity("payment_recorded_manual", "order", orderId, {
        method: params.method,
        amount,
        reference: params.reference,
        note: params.note,
        payment_id: created?.id,
        invoice_id: targetInvoice.id,
        new_balance_due: newBalanceDue,
        invoice_status: newStatus,
      });

      invalidateAll();
      toast.success(`Paiement de ${amount.toFixed(2)} $ enregistré`);
      noteClient("payment_recorded", `${fmtMoney(amount)} (${params.method})${params.reference ? ` — Réf: ${params.reference}` : ""}`, {
        amount, method: params.method, reference: params.reference,
      });

      // Reçu client: centralisé par le déclencheur backend billing_payments.
      return created;
    } catch (err: any) {
      console.error("[GUARDRAIL][ManualPayment] Failed:", err);
      toast.error(`Erreur paiement manuel: ${err?.message || "Erreur inconnue"}`);
      throw err;
    }
  };

  /* ── Update fulfillment type ── */
  const setFulfillmentType = async (type: string) => {
    try {
      // GUARD: Terminal orders cannot change fulfillment
      if (["cancelled", "activated"].includes(data?.order?.status || "")) {
        toast.error("Commande terminée — impossible de modifier le fulfillment");
        return;
      }
      await updateOrder.mutateAsync({
        fulfillment_type: type,
        fulfillment_assigned_at: new Date().toISOString(),
      });
      await logActivity("fulfillment_assigned", "order", orderId, { fulfillment_type: type });
      toast.success(`Mode de livraison: ${type}`);
      noteClient("fulfillment_set", `Type: ${type}`);
    } catch (err: any) {
      console.error("[GUARDRAIL][Fulfillment] Failed:", err);
      toast.error(`Erreur fulfillment: ${err?.message || "Erreur inconnue"}`);
    }
  };

  /* ── Update fulfillment details (dynamic fields per type) ── */
  const updateFulfillmentDetails = async (fields: Record<string, any>) => {
    try {
      const {
        appointment_scheduled_at: appointmentScheduledAt,
        appointment_slot_window: appointmentSlotWindow,
        ...orderFields
      } = fields;

      await updateOrder.mutateAsync(orderFields);

      const shouldPersistAppointment =
        typeof appointmentScheduledAt !== "undefined" || typeof fields.technician_id !== "undefined";

      if (shouldPersistAppointment && appointmentScheduledAt) {
        const appointmentPayload: Record<string, any> = {
          order_id: orderId,
          client_id: data?.order?.user_id || null,
          client_email: data?.order?.client_email || data?.profile?.email || null,
          client_phone: data?.order?.client_phone || data?.profile?.phone || null,
          service_address:
            data?.appointment?.service_address ||
            data?.order?.service_address ||
            data?.order?.shipping_address ||
            data?.order?.client_full_address ||
            null,
          service_city: data?.appointment?.service_city || data?.order?.shipping_city || null,
          service_postal_code: data?.appointment?.service_postal_code || data?.order?.shipping_postal_code || null,
          title: `Installation — ${data?.order?.order_number || orderId}`,
          scheduled_at: appointmentScheduledAt,
          technician_id: fields.technician_id || null,
          internal_notes: fields.appointment_notes || null,
          installation_method: "technician",
          service_type: data?.order?.service_type || "installation",
          status: data?.appointment?.status || "hold",
          updated_at: new Date().toISOString(),
        };

        if (appointmentSlotWindow?.start && appointmentSlotWindow?.end) {
          appointmentPayload.metadata = {
            ...(data?.appointment?.metadata || {}),
            slot_window: appointmentSlotWindow,
            source: "core_order_fulfillment",
          };
        }

        const { error: appointmentError } = data?.appointment?.id
          ? await supabase
              .from("appointments")
              .update(appointmentPayload)
              .eq("id", data.appointment.id)
          : await supabase.from("appointments").insert(appointmentPayload);

        if (appointmentError) throw appointmentError;
        queryClient.invalidateQueries({ queryKey: ["appointment-slot-availability"] });
      }

      await logActivity("fulfillment_details_updated", "order", orderId, fields);
      toast.success("Détails de fulfillment mis à jour");
    } catch (err: any) {
      console.error("[GUARDRAIL][FulfillmentDetails] Failed:", err);
      toast.error(`Erreur mise à jour fulfillment: ${err?.message || "Erreur inconnue"}`);
    }
  };

  /* ── Assign equipment ── */
  const assignEquipment = async (fields: {
    sim_number?: string;
    imei_number?: string;
    serial_number?: string;
    equipment_id?: string;
    equipment_details?: any;
  }) => {
    try {
      // GUARD: Terminal orders
      if (["cancelled"].includes(data?.order?.status || "")) {
        toast.error("Commande annulée — impossible d'assigner de l'équipement");
        return;
      }
      await updateOrder.mutateAsync(fields);
      await logActivity("equipment_assigned", "order", orderId, fields);
      console.info("[GUARDRAIL][Equipment] Assigned:", { orderId, fields: Object.keys(fields) });
      const summary = [
        fields.serial_number && `S/N: ${fields.serial_number}`,
        fields.sim_number && `SIM: ${fields.sim_number}`,
        fields.imei_number && `IMEI: ${fields.imei_number}`,
      ].filter(Boolean).join(" · ") || "équipement";
      noteClient("equipment_assigned", summary, fields);
      toast.success("Équipement assigné");
    } catch (err: any) {
      console.error("[GUARDRAIL][Equipment] Failed:", err);
      toast.error(`Erreur assignation équipement: ${err?.message || "Erreur inconnue"}`);
      throw err;
    }
  };

  /* ── Replace equipment ──
   * Marks the currently assigned equipment as returned and (optionally) assigns
   * a new in-stock unit to this order. Logs activity and queues an optional
   * notification email. Email failures must never break the mutation. */
  const replaceEquipment = async (params: {
    old_serial_number: string;
    reason: string;
    new_equipment_id?: string;
  }) => {
    const oldSerial = (params.old_serial_number || "").trim();
    const reason = (params.reason || "").trim();
    if (!oldSerial) {
      toast.error("Numéro de série de l'ancien équipement requis");
      throw new Error("OLD_SERIAL_REQUIRED");
    }
    if (!reason) {
      toast.error("Raison du remplacement requise");
      throw new Error("REASON_REQUIRED");
    }

    try {
      const nowIso = new Date().toISOString();

      // 1. Locate the currently assigned equipment by serial number (scoped to this order if possible)
      const { data: oldEquip, error: oldFindErr } = await supabase
        .from("equipment_inventory")
        .select("id, serial_number, sku, catalog_name, status, order_id, notes")
        .eq("serial_number", oldSerial)
        .maybeSingle();
      if (oldFindErr) throw oldFindErr;
      if (!oldEquip) {
        toast.error(`Équipement S/N ${oldSerial} introuvable dans l'inventaire`);
        throw new Error("OLD_EQUIPMENT_NOT_FOUND");
      }

      // 2. Mark old equipment as returned (clear order link, stamp retired_at, append reason in notes)
      const returnNote = `[Retour ${new Date().toLocaleDateString("fr-CA")}] ${reason}`;
      const mergedNotes = oldEquip.notes ? `${oldEquip.notes}\n${returnNote}` : returnNote;
      const { error: oldUpdErr } = await supabase
        .from("equipment_inventory")
        .update({
          status: "returned",
          order_id: null,
          retired_at: nowIso,
          notes: mergedNotes,
          updated_at: nowIso,
        })
        .eq("id", oldEquip.id);
      if (oldUpdErr) throw oldUpdErr;

      // 3. If a replacement was selected, assign it to this order
      let newEquip: any = null;
      if (params.new_equipment_id) {
        const { data: candidate, error: newFindErr } = await supabase
          .from("equipment_inventory")
          .select("id, serial_number, sku, catalog_name, status")
          .eq("id", params.new_equipment_id)
          .maybeSingle();
        if (newFindErr) throw newFindErr;
        if (!candidate) {
          toast.error("Équipement de remplacement introuvable");
          throw new Error("NEW_EQUIPMENT_NOT_FOUND");
        }
        const status = String(candidate.status || "").toLowerCase();
        if (status !== "in_stock" && status !== "available") {
          toast.error(`L'équipement sélectionné n'est pas en stock (${candidate.status})`);
          throw new Error("NEW_EQUIPMENT_NOT_AVAILABLE");
        }

        const { error: newUpdErr } = await supabase
          .from("equipment_inventory")
          .update({
            status: "assigned",
            order_id: orderId,
            assigned_at: nowIso,
            assigned_by: user?.id || null,
            updated_at: nowIso,
          })
          .eq("id", candidate.id);
        if (newUpdErr) throw newUpdErr;
        newEquip = candidate;

        // 4. Reflect new serial on the order so downstream UI/contracts stay in sync
        try {
          await updateOrder.mutateAsync({
            serial_number: candidate.serial_number || null,
          });
        } catch (e: any) {
          console.warn("[Equipment] order serial sync failed:", e?.message);
        }
      }

      // 5. Activity log entry
      const noteParts = [`Remplacement: ${reason}`, `Ancien S/N: ${oldSerial}`];
      if (newEquip?.serial_number) noteParts.push(`Nouveau S/N: ${newEquip.serial_number}`);
      await logActivity("equipment_replaced", "order", orderId, {
        old_serial_number: oldSerial,
        old_equipment_id: oldEquip.id,
        new_equipment_id: newEquip?.id || null,
        new_serial_number: newEquip?.serial_number || null,
        reason,
        note: noteParts.join(" · "),
      });

      // 6. Optional email notification (append-only, must never throw)
      try {
        const email = getClientEmail();
        if (email) {
          await queueClientEmail({
            to_email: email,
            template_key: "equipment_replaced",
            event_key: `equipment_replaced_${orderId}_${Date.now()}`,
            idempotency_key: `equipment_replaced_${orderId}_${oldEquip.id}`,
            subject: "Votre équipement a été remplacé — Nivra",
            entity_id: orderId,
            template_vars: {
              client_name: getClientName(),
              order_number: data?.order?.order_number || "",
              old_serial_number: oldSerial,
              new_serial_number: newEquip?.serial_number || "",
              reason,
            },
          });
        }
      } catch (e: any) {
        console.error("[orderEmails] equipment_replaced enqueue error:", e?.message);
      }

      // 7. Invalidate caches
      invalidateAll();

      // 8. Success toast
      toast.success("Équipement remplacé avec succès");
      noteClient("equipment_replaced", `Ancien S/N ${oldSerial}${newEquip?.serial_number ? ` → Nouveau S/N ${newEquip.serial_number}` : ""} — Raison: ${reason}`, {
        old_serial: oldSerial,
        new_serial: newEquip?.serial_number,
        reason,
      });
      return { old: oldEquip, new: newEquip };
    } catch (err: any) {
      console.error("[GUARDRAIL][Equipment] Replace failed:", err);
      const code = String(err?.message || "");
      if (
        ![
          "OLD_SERIAL_REQUIRED",
          "REASON_REQUIRED",
          "OLD_EQUIPMENT_NOT_FOUND",
          "NEW_EQUIPMENT_NOT_FOUND",
          "NEW_EQUIPMENT_NOT_AVAILABLE",
        ].some((k) => code.includes(k))
      ) {
        toast.error(`Erreur de remplacement: ${err?.message || "Erreur inconnue"}`);
      }
      throw err;
    }
  };

  /* ── Update shipping ── */
  const updateShipping = async (fields: {
    carrier?: string;
    tracking_number?: string;
    tracking_url?: string;
    shipped_at?: string;
  }) => {
    try {
      await updateOrder.mutateAsync(fields);
      await logActivity("shipment_updated", "order", orderId, fields);

      toast.success("Expédition mise à jour");
      if (fields.tracking_number) {
        noteClient("shipping_updated", `${fields.carrier || "Transporteur"} — Suivi ${fields.tracking_number}`, fields);
      }

      // ── Generate delivery-slip PDF, persist to documents, send email ──
      // The edge function handles: PDF generation → storage upload →
      // client_auto_documents insert (portail + Core Documents) → corporate
      // blue email with PDF attached and tracking button.
      if (fields.tracking_number) {
        try {
          const { data: slipRes, error: slipErr } = await supabase.functions.invoke(
            "order-shipping-notify",
            {
              body: {
                order_id: orderId,
                carrier: fields.carrier || "",
                tracking_number: fields.tracking_number,
                tracking_url: fields.tracking_url || "",
              },
            },
          );
          if (slipErr) {
            console.error("[order-shipping-notify] invoke error:", slipErr);
            toast.warning("Expédition enregistrée, mais l'envoi du bon de livraison a échoué.");
          } else if (slipRes?.success) {
            toast.success("Bon de livraison envoyé au client");
          }
        } catch (e: any) {
          console.error("[order-shipping-notify] threw:", e?.message);
        }
      }
    } catch (err: any) {
      console.error("[GUARDRAIL][Shipping] Failed:", err);
      toast.error(`Erreur expédition: ${err?.message || "Erreur inconnue"}`);
    }
  };

  /* ── Assign technician ── */
  const assignTechnician = async (technicianId: string) => {
    try {
      // GUARD: Validate tech ID
      if (!technicianId) {
        toast.error("ID technicien manquant");
        return;
      }

      await updateOrder.mutateAsync({ technician_id: technicianId });

      // Also update the linked appointment if one exists
      if (data?.appointment?.id) {
        const { error: aptErr } = await supabase
          .from("appointments")
          .update({
            technician_id: technicianId,
            updated_at: new Date().toISOString(),
          })
          .eq("id", data.appointment.id);
        if (aptErr) {
          console.warn("[GUARDRAIL][Technician] Appointment update failed:", aptErr.message);
          toast.warning("Technicien assigné à la commande, mais erreur lors de la mise à jour du rendez-vous");
        }
      }

      await logActivity("technician_assigned", "order", orderId, { technician_id: technicianId });

      toast.success("Technicien assigné");
      noteClient("technician_assigned", `Technicien ${technicianId.slice(0, 8)}${data?.appointment?.scheduled_at ? ` — installation ${new Date(data.appointment.scheduled_at).toLocaleString("fr-CA")}` : ""}`, {
        technician_id: technicianId,
        appointment_id: data?.appointment?.id,
      });
    } catch (err: any) {
      console.error("[GUARDRAIL][Technician] Failed:", err);
      toast.error(`Erreur assignation technicien: ${err?.message || "Erreur inconnue"}`);
    }
  };

  /* ── Add internal note (manual, written by an agent) ──
   * Writes to THREE surfaces so the note is visible everywhere:
   *   1. orders.internal_notes  (legacy inline field)
   *   2. activity_logs          (order timeline) — via logActivity('note_added')
   *   3. client_internal_notes  (client profile) — note_type='admin'
   */
  const addNote = async (note: string) => {
    try {
      if (!note?.trim()) {
        toast.error("Note vide — rien à ajouter");
        return;
      }
      const trimmed = note.trim();
      const existing = data?.order?.internal_notes || "";
      const timestamp = new Date().toISOString();
      const entry = `[${timestamp}] ${user?.email}: ${trimmed}`;
      const updated = existing ? `${existing}\n${entry}` : entry;

      // 1. Inline note field on order
      await updateOrder.mutateAsync({ internal_notes: updated });

      // 2. Activity log — appears on the order timeline
      await logActivity("note_added", "order", orderId, { note: trimmed });

      // 3. Client profile note — fire-and-forget
      const clientId = data?.order?.user_id;
      if (clientId) {
        try {
          const { writeAccountJournal } = await import("@/lib/writeAccountJournal");
          const minuteBucket = new Date().toISOString().slice(0, 16);
          await writeAccountJournal({
            targetTable: "client_internal_notes",
            eventKey: `note:order:${orderId}:${user?.id ?? "anon"}:${minuteBucket}`,
            visibility: "staff",
            payload: {
              client_id: clientId,
              note_type: "admin",
              body: `[Commande #${data?.order?.order_number || orderId?.slice(0, 8) || "—"}] ${trimmed}`,
            },
          });
        } catch (e: any) {
          console.warn("[addNote] client_internal_notes mirror failed:", e?.message);
        }
      }

      toast.success("Note ajoutée");
    } catch (err: any) {
      console.error("[GUARDRAIL][Note] Failed:", err);
      toast.error(`Erreur ajout note: ${err?.message || "Erreur inconnue"}`);
    }
  };

  /* ── Send notification to client ── */
  const sendClientNotification = async (templateKey: string, subject: string, extraVars?: Record<string, any>) => {
    try {
      const officialDocumentKeys = new Set([
        "invoice_sent",
        "document_contract_sent",
        "document_invoice_sent",
        "document_summary_sent",
        "document_receipt_sent",
        "all_documents_sent",
        "payment_receipt",
        "payment_confirmed",
      ]);
      const orderPaymentStatus = String(data?.order?.payment_status || "").toLowerCase();
      const invoiceStatus = String(data?.invoice?.status || "").toLowerCase();
      const invoiceBalance = Number(data?.invoice?.balance_due ?? 999999);
      const paymentConfirmed = ["paid", "confirmed", "completed", "captured", "succeeded"].includes(orderPaymentStatus)
        && (["paid", "confirmed", "completed", "captured", "succeeded"].includes(invoiceStatus) || invoiceBalance <= 0.01);
      if (officialDocumentKeys.has(templateKey) && !paymentConfirmed) {
        toast.error("Documents bloqués: le paiement doit être confirmé avant tout envoi au client.");
        return;
      }
      const email = getClientEmail();
      if (!email) {
        toast.error("Aucun courriel client disponible");
        return;
      }
      await queueClientEmail({
        to_email: email,
        template_key: templateKey,
        event_key: `manual_${templateKey}_${orderId}_${Date.now()}`,
        mode: "manual",
        subject,
        entity_id: orderId,
        template_vars: {
          client_name: getClientName(),
          order_id: orderId,
          order_number: data?.order?.order_number || "",
          ...extraVars,
        },
      });
      await logActivity("notification_sent", "order", orderId, { template_key: templateKey, to: email });
      toast.success("Notification envoyée au client");
    } catch (err: any) {
      console.error("[GUARDRAIL][Notification] Failed:", err);
      toast.error(`Erreur envoi notification: ${err?.message || "Erreur inconnue"}`);
    }
  };

  /* ── Sign contract (admin side) ── */
  const signContract = async (contractId: string) => {
    try {
      // GUARD: Validate contract ID
      if (!contractId) {
        toast.error("ID de contrat manquant");
        return;
      }

      // GUARD: Check if contract is already signed
      const existing = data?.contracts?.find((c: any) => c.id === contractId);
      if (existing?.is_signed) {
        toast.info("Ce contrat est déjà signé");
        return;
      }

      const { error } = await supabase
        .from("contracts")
        .update({
          is_signed: true,
          admin_signed_at: new Date().toISOString(),
          admin_signer_id: user?.id || null,
          admin_signer_name: user?.email || "Admin",
          status: "signed_by_admin",
          updated_at: new Date().toISOString(),
        })
        .eq("id", contractId);
      if (error) throw error;
      await logActivity("contract_signed_admin", "order", orderId, { contract_id: contractId });

      // Also update order to link the contract
      await updateOrder.mutateAsync({ related_contract_id: contractId });

      invalidateAll();
      toast.success("Contrat signé (admin)");
      noteClient("contract_signed_admin", `Contrat ${contractId.slice(0, 8)} signé par un agent autorisé`, {
        contract_id: contractId,
      });

      // ── contract_signed email (append-only) ──
      try {
        if (data?.order && data?.profile) {
          await enqueueOrderEmail(
            orderEmails.contractSigned(data.order, data.profile, contractId)
          );
        }
      } catch (e: any) {
        console.error("[orderEmails] contract_signed enqueue error:", e?.message);
      }
    } catch (err: any) {
      console.error("[GUARDRAIL][Contract] Sign failed:", err);
      toast.error(`Erreur signature contrat: ${err?.message || "Erreur inconnue"}`);
    }
  };

  /* ── Transition order through operational states safely ── */
  const ensureOperationalState = async (targetStatus: string) => {
    const current = data?.order?.status || "";
    const intakeStates = ["submitted", "pending_admin_review", "received"];
    const completionStates = ["completed", "activated", "fulfilled", "delivered", "installation_completed"];
    const alreadyOperational = ["confirmed", "processing", "in_progress", "provisioning", "shipping",
      "installing", "shipped", "delivered", "technician_en_route", "installation_completed", "completed"];

    // If we're in an intake state and targeting a completion state,
    // we must step through operational states first to satisfy the DB trigger
    if (intakeStates.includes(current) && completionStates.includes(targetStatus)) {
      // Step 1: Move to "confirmed"
      await updateOrder.mutateAsync({ status: "confirmed" });
      await logActivity("status_change", "order", orderId, {
        old_status: current, new_status: "confirmed", reason: "Auto-transition vers état opérationnel"
      });
      // Step 2: Move to "processing"
      await updateOrder.mutateAsync({ status: "processing" });
      await logActivity("status_change", "order", orderId, {
        old_status: "confirmed", new_status: "processing", reason: "Auto-transition vers état opérationnel"
      });
      // Step 3: Now we can safely set the target
      await updateOrder.mutateAsync({ status: targetStatus });
      return;
    }

    // If already in an operational or completed state, transition directly
    if (alreadyOperational.includes(current)) {
      await updateOrder.mutateAsync({ status: targetStatus });
      return;
    }

    // Fallback: set directly
    await updateOrder.mutateAsync({ status: targetStatus });
  };

  /* ── Activate service — provisions subscription + marks order completed ── */
  const activateService = async (opts?: {
    providerRef?: string;
    activationNotes?: string;
    forceOverride?: boolean;
    overrideReason?: string;
  }) => {
    const invoice = data?.invoice;
    const order = data?.order;
    const forceOverride = !!opts?.forceOverride;
    const overrideReason = (opts?.overrideReason || "").trim();

    const balanceDue = Number(invoice?.balance_due ?? invoice?.total ?? 1);
    const invoiceStatus = invoice?.status;
    const orderPaymentStatus = String((order as any)?.payment_status || "").toLowerCase();
    const orderPaid = orderPaymentStatus === "paid" || orderPaymentStatus === "confirmed" || !!((order as any)?.payment_confirmed_at);
    const invoicePaid = orderPaid || (!!invoice && (["paid", "partially_paid", "paid_by_promo"].includes(invoiceStatus || "") || balanceDue <= 0));

    const kycStatus = String((order as any)?.kyc_status || "not_required").toLowerCase();
    const kycPolicy = String((order as any)?.kyc_policy || "none").toLowerCase();
    const kycRequired = kycPolicy !== "none" && kycPolicy !== "skip";
    const kycOk = !kycRequired || kycStatus === "approved" || kycStatus === "not_required";

    const blockers: string[] = [];
    if (!invoice && !orderPaid) {
      blockers.push("aucune facture liée à cette commande");
    } else if (!invoicePaid) {
      blockers.push(`la facture ${invoice?.invoice_number || ""} n'est pas payée (solde: ${balanceDue.toFixed(2)} $)`);
    }
    if (!kycOk) {
      blockers.push(`kyc_status est ${kycStatus}`);
    }

    if (blockers.length > 0) {
      if (!forceOverride) {
        const msg = `Impossible d'activer : ${blockers.join(" · ")}.`;
        toast.error(msg);
        throw new Error(msg);
      }
      if (!overrideReason) {
        const msg = "Une justification est obligatoire pour forcer l'activation";
        toast.error(msg);
        throw new Error(msg);
      }
      await logActivity(
        "activation_master_override",
        "order",
        orderId,
        {
          override_reason: overrideReason,
          blockers,
          invoice_id: invoice?.id ?? null,
          invoice_number: invoice?.invoice_number ?? null,
          balance_due: invoice ? balanceDue : null,
          kyc_status: kycStatus,
          kyc_policy: kycPolicy,
        },
        { reason: overrideReason }
      );
      toast.warning(`Activation forcée — raison: ${overrideReason}`);
    }

    // Step 1: Call canonical provisioning RPC (idempotent — safe to call multiple times)
    const { data: provResult, error: provError } = await supabase.rpc(
      "provision_services_for_order" as any,
      { p_order_id: orderId }
    );

    const provPayload = (provResult || {}) as any;
    if (provError || !provPayload.success) {
      const errMsg = provPayload?.error || provError?.message || "Échec du provisionnement";
      // DUPLICATE_SERVICE_AT_ADDRESS is non-fatal if we already provisioned
      if (errMsg !== "DUPLICATE_SERVICE_AT_ADDRESS") {
        console.error("[Activation] Provisioning failed:", errMsg, provPayload);
        toast.error(`Provisionnement échoué: ${errMsg}`);
        return;
      }
    }

    // Step 2: Update account status only.
    // Billing anchor/cycle bootstrap is handled by the backend provisioning RPC/trigger.
    // The frontend must never write billing_cycle_day/anchor fields during activation,
    // because those fields are immutable once the account has billable subscriptions.
    const account = data?.account;
    if (account?.id) {
      await supabase.from("accounts").update({
        status: "active",
        updated_at: new Date().toISOString(),
      }).eq("id", account.id);
    }

    // Step 3: Save provider ref and activation notes on order
    // Use ensureOperationalState to safely transition through required states
    if (opts?.providerRef) {
      await updateOrder.mutateAsync({ confirmation_number: opts.providerRef });
    }
    if (opts?.activationNotes) {
      const existing = data?.order?.internal_notes || "";
      await updateOrder.mutateAsync({ internal_notes: existing + `\n[Activation] ${opts.activationNotes}` });
    }

    await ensureOperationalState("activated");
    // CANONICAL: service_activated_at must be set so the
    // fn_activate_sub_on_order_activation trigger starts the billing cycle.
    await updateOrder.mutateAsync({
      processed_at: new Date().toISOString(),
      processed_by: user?.id,
      service_activated_at: new Date().toISOString(),
      service_activated_by: user?.id,
      service_activation_source: "core_admin",
    });

    // Step 4: Log activity
    await logActivity("service_activated", "order", orderId, {
      provisioning_result: provPayload,
      provider_ref: opts?.providerRef,
      subscription_id: provPayload?.subscription_id,
      services_created: provPayload?.services_created,
    });

    // Step 5: Queue activation notification to client
    const email = getClientEmail();
    if (email) {
      await queueClientEmail({
        to_email: email,
        template_key: "order_completed",
        event_key: `service_activated_${orderId}_${Date.now()}`,
        idempotency_key: `auto_service_activated_${orderId}`,
        mode: "automatic",
        subject: "Votre service est activé — Nivra",
        entity_id: orderId,
        template_vars: {
          client_name: getClientName(),
          order_id: orderId,
          order_number: data?.order?.order_number || "",
          service_type: data?.order?.service_type || "",
        },
      });

      const contract = data?.contracts?.[0];
      if (contract?.signature_token) {
        await queueClientEmail({
          to_email: email,
          template_key: "contract_sign_request",
          event_key: `contract_sign_request_${orderId}_${contract.id}`,
          idempotency_key: `contract_sign_request_${contract.id}`,
          mode: "automatic",
          subject: "Votre contrat est prêt à signer — Nivra",
          entity_id: orderId,
          template_vars: {
            client_name: getClientName(),
            order_id: orderId,
            order_number: data?.order?.order_number || "",
            service: data?.order?.service_type || "Service Nivra",
            contract_number: contract.contract_number || contract.contract_url || "",
            signature_url: `https://nivra-telecom.ca/signer/${contract.signature_token}`,
          },
        });
      }
    }

    invalidateAll();
    toast.success("Service activé — abonnement créé");
    noteClient("service_activated", `${data?.order?.service_type || "Service"} activé le ${new Date().toLocaleDateString("fr-CA")} (commande #${data?.order?.order_number || ""})`, {
      service_type: data?.order?.service_type,
      provider_ref: opts?.providerRef,
      subscription_id: provPayload?.subscription_id,
    });

    // ── service_activated + welcome_to_nivra emails (append-only) ──
    try {
      if (data?.order && data?.profile) {
        const mf = data?.mobileFulfillment;
        await enqueueOrderEmail(
          orderEmails.serviceActivated(data.order, data.profile, {
            phone_number: mf?.assigned_number || mf?.port_in_number || null,
            iccid: mf?.sim_iccid || null,
            carrier: mf?.sim_carrier || null,
            plan: data.order?.service_type || null,
          })
        );
        await enqueueOrderEmail(
          orderEmails.welcomeToNivra(data.order, data.profile)
        );
      }
    } catch (e: any) {
      console.error("[orderEmails] service_activated/welcome enqueue error:", e?.message);
    }
  };

  /* ── Complete order ── */
  const completeOrder = async (opts?: { forceOverride?: boolean; overrideReason?: string }) => {
    try {
      // GUARD: Already completed
      if (data?.order?.status === "completed") {
        toast.info("Commande déjà complétée");
        return;
      }

      // SYSTEMIC GUARD: Verify invoice is paid before allowing completion
      const invoice = data?.invoice;
      if (!invoice) {
        toast.error("Impossible de compléter : aucune facture liée à cette commande.");
        return;
      }
      const balanceDue = Number(invoice.balance_due ?? invoice.total ?? 1);
      const invoiceStatus = invoice.status;
      const invoicePaid = ["paid", "partially_paid"].includes(invoiceStatus || "") || balanceDue <= 0;
      const forceOverride = !!opts?.forceOverride;
      const overrideReason = (opts?.overrideReason || "").trim();

      if (!invoicePaid) {
        if (!forceOverride) {
          toast.error(`Impossible de compléter : la facture ${invoice.invoice_number || ""} n'est pas payée (solde: ${balanceDue.toFixed(2)} $).`);
          return;
        }
        if (!overrideReason) {
          toast.error("Une justification est obligatoire pour forcer la complétion");
          return;
        }
        await logActivity("completion_forced_unpaid", "order", orderId, {
          invoice_id: invoice.id,
          invoice_number: invoice.invoice_number,
          balance_due: balanceDue,
          override_reason: overrideReason,
        });
        toast.warning("Commande complétée sans paiement confirmé");
      }

      await changeStatus("completed");
      await updateOrder.mutateAsync({ processed_at: new Date().toISOString(), processed_by: user?.id });

      // Queue completion notification
      const email = getClientEmail();
      if (email) {
        await queueClientEmail({
          to_email: email,
          template_key: "order_completed",
          event_key: `order_completed_${orderId}_${Date.now()}`,
          idempotency_key: `auto_order_completed_${orderId}`,
          mode: "automatic",
          subject: "Votre commande est complétée — Nivra",
          entity_id: orderId,
          template_vars: {
            client_name: getClientName(),
            order_id: orderId,
            order_number: data?.order?.order_number || "",
          },
        });
      }

      toast.success("Commande complétée");
      noteClient("order_completed", `Commande #${data?.order?.order_number || ""} marquée comme complétée`);
    } catch (err: any) {
      console.error("[GUARDRAIL][Complete] Failed:", err);
      toast.error(`Erreur complétion: ${err?.message || "Erreur inconnue"}`);
    }
  };

  /* ── SIM / eSIM / Port-in mutations ── */
  const upsertMobileFulfillment = async (patch: Record<string, any>) => {
    const order = data?.order;
    if (!order?.id || !order?.user_id) {
      throw new Error("Commande introuvable pour la mise à jour mobile");
    }
    const existing = data?.mobileFulfillment;
    if (existing?.id) {
      const { error } = await supabase
        .from("mobile_fulfillment")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("mobile_fulfillment")
        .insert({
          order_id: order.id,
          user_id: order.user_id,
          ...patch,
        });
      if (error) throw error;
    }
  };

  const activateSim = async (opts: {
    iccid: string;
    imei?: string | null;
    phone_number: string;
    sim_type: string;
    operator: string;
    plan: string;
  }) => {
    try {
      await upsertMobileFulfillment({
        sim_iccid: opts.iccid,
        sim_type: opts.sim_type,
        sim_carrier: opts.operator,
        assigned_number: opts.phone_number,
        number_assigned_at: new Date().toISOString(),
        number_assigned_by: user?.id || null,
        activation_status: "active",
        activated_at: new Date().toISOString(),
      });
      await logActivity("sim_activated", "order", orderId, {
        iccid: opts.iccid, operator: opts.operator, plan: opts.plan,
      });
      invalidateAll();
      toast.success("SIM activée");
      noteClient("sim_activated", `Numéro ${opts.phone_number} — ICCID ${opts.iccid} (${opts.operator})`, opts);
      try {
        if (data?.order && data?.profile) {
          await enqueueOrderEmail(
            orderEmails.simActivated(data.order, data.profile, {
              phone_number: opts.phone_number,
              sim_number: opts.iccid,
            })
          );
        }
      } catch (e: any) {
        console.error("[orderEmails] sim_activated enqueue error:", e?.message);
      }
    } catch (err: any) {
      console.error("[SIM] Activation failed:", err);
      toast.error(`Erreur activation SIM: ${err?.message || "Erreur inconnue"}`);
    }
  };

  const deactivateSim = async () => {
    try {
      await upsertMobileFulfillment({ activation_status: "deactivated" });
      await logActivity("sim_deactivated", "order", orderId, {});
      invalidateAll();
      toast.success("SIM désactivée");
      noteClient("sim_deactivated", "SIM désactivée par l'agent");
    } catch (err: any) {
      console.error("[SIM] Deactivation failed:", err);
      toast.error(`Erreur désactivation SIM: ${err?.message || "Erreur inconnue"}`);
    }
  };

  const activateEsim = async (opts: { eid: string; profile_type: string }) => {
    try {
      await upsertMobileFulfillment({
        sim_type: "esim",
        sim_iccid: opts.eid,
        activation_status: "active",
        activated_at: new Date().toISOString(),
      });
      await logActivity("esim_activated", "order", orderId, {
        eid: opts.eid, profile_type: opts.profile_type,
      });
      invalidateAll();
      toast.success("eSIM activée — QR code généré");
      noteClient("esim_activated", `EID ${opts.eid} — Profil ${opts.profile_type}`, opts);
      try {
        if (data?.order && data?.profile) {
          await enqueueOrderEmail(
            orderEmails.esimReady(data.order, data.profile, {
              activation_code: opts.eid,
            })
          );
        }
      } catch (e: any) {
        console.error("[orderEmails] esim_ready enqueue error:", e?.message);
      }
    } catch (err: any) {
      console.error("[eSIM] Activation failed:", err);
      toast.error(`Erreur activation eSIM: ${err?.message || "Erreur inconnue"}`);
    }
  };

  const resendEsimQr = async () => {
    try {
      if (data?.order && data?.profile) {
        await enqueueOrderEmail(
          orderEmails.esimReady(data.order, data.profile, {
            activation_code: data?.mobileFulfillment?.sim_iccid || "",
          })
        );
      }
      await logActivity("esim_qr_resent", "order", orderId, {});
      toast.success("QR code envoyé au client");
    } catch (err: any) {
      console.error("[eSIM] QR resend failed:", err);
      toast.error(`Erreur envoi QR: ${err?.message || "Erreur inconnue"}`);
    }
  };

  const submitPortIn = async (opts: {
    number: string;
    current_operator: string;
    account_number: string;
    pin?: string | null;
    requested_date?: string | null;
    time_slot?: string | null;
  }) => {
    try {
      await upsertMobileFulfillment({
        port_in_requested: true,
        port_in_number: opts.number,
        port_in_carrier: opts.current_operator,
        port_in_account_number: opts.account_number,
        port_in_status: "initiated",
        port_in_submitted_at: new Date().toISOString(),
      });
      await logActivity("portin_submitted", "order", orderId, {
        number: opts.number,
        current_operator: opts.current_operator,
        requested_date: opts.requested_date,
        time_slot: opts.time_slot,
      });
      invalidateAll();
      toast.success("Demande de port-in soumise");
      noteClient("portin_submitted", `Numéro ${opts.number} — Opérateur ${opts.current_operator}`, opts);
      try {
        if (data?.order && data?.profile) {
          await enqueueOrderEmail(
            orderEmails.portinInitiated(data.order, data.profile, {
              number_to_port: opts.number,
              current_carrier: opts.current_operator,
            })
          );
        }
      } catch (e: any) {
        console.error("[orderEmails] portin_initiated enqueue error:", e?.message);
      }
    } catch (err: any) {
      console.error("[PortIn] Submit failed:", err);
      toast.error(`Erreur soumission port-in: ${err?.message || "Erreur inconnue"}`);
    }
  };

  const updatePortInStatus = async (status: string) => {
    try {
      const patch: Record<string, any> = { port_in_status: status };
      if (status === "completed") patch.port_in_completed_at = new Date().toISOString();
      await upsertMobileFulfillment(patch);
      await logActivity("portin_status_changed", "order", orderId, { new_status: status });
      invalidateAll();
      toast.success(`Statut port-in: ${status}`);
      noteClient("portin_status_changed", `Nouveau statut: ${status}`);
      try {
        if (data?.order && data?.profile) {
          if (status === "completed") {
            await enqueueOrderEmail(
              orderEmails.portinCompleted(data.order, data.profile, data?.mobileFulfillment?.port_in_number)
            );
          } else if (status === "failed") {
            await enqueueOrderEmail(
              orderEmails.portinFailed(data.order, data.profile, "Échec du transfert")
            );
          }
        }
      } catch (e: any) {
        console.error("[orderEmails] portin status enqueue error:", e?.message);
      }
    } catch (err: any) {
      console.error("[PortIn] Status update failed:", err);
      toast.error(`Erreur mise à jour statut: ${err?.message || "Erreur inconnue"}`);
    }
  };

  const cancelPortIn = async () => {
    try {
      await upsertMobileFulfillment({ port_in_status: "cancelled" });
      await logActivity("portin_cancelled", "order", orderId, {});
      invalidateAll();
      toast.success("Port-in annulé");
      noteClient("portin_cancelled", "Port-in annulé");
    } catch (err: any) {
      console.error("[PortIn] Cancel failed:", err);
      toast.error(`Erreur annulation port-in: ${err?.message || "Erreur inconnue"}`);
    }
  };

  /* ── KYC: Request identity verification ──
   * Delegates to the `send-kyc-request` edge function which uses the service
   * role to: create a kyc_requests row, set orders.kyc_status='pending',
   * send the branded email, and log the activity.
   * This bypasses RLS on identity_verification_sessions / kyc_requests.
   */
  const requestIdentityVerification = async (opts?: { email?: string; notes?: string }) => {
    try {
      const order = data?.order;
      const profile = data?.profile;
      if (!order) throw new Error("Commande introuvable");

      const recipientEmail = opts?.email || order.client_email || profile?.email;
      if (!recipientEmail) throw new Error("Aucun courriel client disponible");

      // send-kyc-request deploys with Pro upgrade — direct DB path as fallback
      const token = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 48 * 3600 * 1000).toISOString();

      const { data: kycRow, error: kycErr } = await (supabase as any)
        .from("kyc_requests")
        .upsert({
          order_id: orderId,
          client_email: recipientEmail,
          token,
          status: "pending",
          requested_at: new Date().toISOString(),
          expires_at: expiresAt,
          notes: opts?.notes || null,
        }, { onConflict: "order_id" })
        .select("id")
        .maybeSingle();
      if (kycErr) throw kycErr;

      await enqueueCommunication({
        channel: "email",
        templateKey: "kyc_request",
        recipient: recipientEmail,
        idempotencyKey: `kyc-request:${kycRow?.id ?? orderId}`,
        templateVars: {
          kyc_link: `https://nivra-telecom.ca/verification/${token}`,
          expires_hours: 48,
          notes: opts?.notes || null,
        },
        priority: 1,
        entityType: "kyc_request",
        entityId: kycRow?.id ?? null,
      });

      await (supabase as any).from("orders").update({ kyc_status: "pending", kyc_request_id: kycRow?.id }).eq("id", orderId);

      invalidateAll();
      toast.success(`Lien de vérification envoyé à ${recipientEmail}`);
      noteClient("kyc_requested", `Lien envoyé à ${recipientEmail}${opts?.notes ? ` — ${opts.notes}` : ""}`);
      return { success: true };
    } catch (err: any) {
      console.error("[KYC] requestIdentityVerification failed:", err);
      toast.error(`Erreur d'envoi: ${err?.message || "Erreur inconnue"}`);
      throw err;
    }
  };

  /* ── KYC: Request resubmission of an existing session ──
   * Re-issues a KYC request via the same edge function (service-role insert,
   * email + activity log). The previous kyc_requests row remains in history.
   */
  const requestKycResubmission = async (opts?: { reason?: string }) => {
    try {
      const order = data?.order;
      if (!order) throw new Error("Commande introuvable");

      // send-kyc-request deploys with Pro upgrade — direct DB path as fallback
      const recipientEmailResub = order?.client_email;
      if (recipientEmailResub) {
        const token = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + 48 * 3600 * 1000).toISOString();
        const { data: kycRow } = await (supabase as any)
          .from("kyc_requests")
          .upsert({ order_id: orderId, client_email: recipientEmailResub, token, status: "pending", requested_at: new Date().toISOString(), expires_at: expiresAt, notes: opts?.reason || null }, { onConflict: "order_id" })
          .select("id").maybeSingle();
        await enqueueCommunication({
          channel: "email",
          templateKey: "kyc_request",
          recipient: recipientEmailResub,
          idempotencyKey: `kyc-request-resubmit:${kycRow?.id ?? orderId}`,
          templateVars: { kyc_link: `https://nivra-telecom.ca/verification/${token}`, expires_hours: 48 },
          priority: 1,
          entityType: "kyc_request",
          entityId: kycRow?.id ?? null,
        });
        await (supabase as any).from("orders").update({ kyc_status: "pending", kyc_request_id: kycRow?.id }).eq("id", orderId);
      }

      await logActivity("kyc_resubmission_requested", "order", orderId, {
        reason: opts?.reason || null,
      });

      invalidateAll();
      toast.success("Demande de resoumission envoyée");
      noteClient("kyc_resubmission", opts?.reason || "Documents additionnels demandés");
      return { success: true };
    } catch (err: any) {
      console.error("[KYC] requestKycResubmission failed:", err);
      toast.error(`Erreur: ${err?.message || "Erreur inconnue"}`);
      throw err;
    }
  };

  /* ── KYC: Approve identity verification ──
   * Uses the `admin-review-verification` edge function (service role) which:
   *  - Updates identity_verification_sessions (status, reviewed_at/by, reason)
   *  - Updates linked orders (id_verification_status, id_verified_at)
   *  - Logs identity_verification_events
   * We additionally enqueue the branded "kyc_approved" client email and an
   * activity_log entry tied to the order.
   */
  const approveKyc = async (opts?: { reason?: string }) => {
    try {
      const order = data?.order;
      const profile = data?.profile;
      const session = data?.kycSession;
      if (!order) throw new Error("Commande introuvable");

      const reason = (opts?.reason || "").trim() || "Approuvé par agent — documents conformes";
      const now = new Date().toISOString();
      let result: any = null;

      if (session?.id) {
        const response = await supabase.functions.invoke("admin-review-verification", {
          body: {
            session_id: session.id,
            decision: "approved",
            reason,
            idempotency_key: `kyc_approve_${session.id}_${Date.now()}`,
          },
        });
        if (response.error) throw response.error;
        if (response.data?.error) throw new Error(response.data.error);
        result = response.data;
      }

      const orderPatch: Record<string, any> = {
        kyc_status: "approved",
        id_verification_status: "verified",
        id_verified_at: now,
        id_verification_notes: reason,
        updated_at: now,
      };

      if (session?.id && !order.identity_verification_session_id) {
        orderPatch.identity_verification_session_id = session.id;
      }

      const { error: orderUpdateError } = await supabase
        .from("orders")
        .update(orderPatch)
        .eq("id", order.id);
      if (orderUpdateError) throw orderUpdateError;

      await enqueueOrderEmail(orderEmails.kycApproved(order, profile));

      await logActivity("kyc_approved", "order", orderId, {
        session_id: session?.id ?? null,
        reason,
        order_kyc_status: "approved",
      });

      invalidateAll();
      await orderQuery.refetch();
      toast.success("KYC approuvé");
      noteClient("kyc_approved", reason);
      return result ?? { success: true, order_id: order.id, kyc_status: "approved" };
    } catch (err: any) {
      console.error("[KYC] approveKyc failed:", err);
      toast.error(`Erreur d'approbation: ${err?.message || "Erreur inconnue"}`);
      throw err;
    }
  };

  /* ── KYC: Reject identity verification ──
   * Uses `admin-review-verification` with decision='rejected'. A non-empty
   * reason is required (validated client-side and re-validated by the edge fn).
   */
  const rejectKyc = async (opts: { reason: string }) => {
    try {
      const reason = (opts?.reason || "").trim();
      if (!reason) {
        throw new Error("Une raison est obligatoire pour rejeter un document");
      }

      const order = data?.order;
      const profile = data?.profile;
      const session = data?.kycSession;
      if (!order) throw new Error("Commande introuvable");
      if (!session?.id) throw new Error("Aucune session KYC associée à cette commande");

      const { data: result, error } = await supabase.functions.invoke("admin-review-verification", {
        body: {
          session_id: session.id,
          decision: "rejected",
          reason,
          idempotency_key: `kyc_reject_${session.id}_${Date.now()}`,
        },
      });
      if (error) throw error;
      if (result?.error) throw new Error(result.error);

      // Enqueue branded rejection email with reason
      await enqueueOrderEmail(orderEmails.kycRejected(order, profile, reason));

      // Order-scoped activity log entry
      await logActivity("kyc_rejected", "order", orderId, {
        session_id: session.id,
        reason,
      });

      invalidateAll();
      toast.warning("KYC rejeté — client notifié");
      noteClient("kyc_rejected", `Raison: ${reason}`);
      return result;
    } catch (err: any) {
      console.error("[KYC] rejectKyc failed:", err);
      toast.error(err?.message || "Erreur de rejet");
      throw err;
    }
  };

  return {
    // Data
    order: data?.order,
    profile: data?.profile,
    account: data?.account,
    items: data?.items || [],
    invoice: data?.invoice,
    invoiceLines: data?.invoiceLines || [],
    contracts: data?.contracts || [],
    appointment: data?.appointment,
    channelSelection: data?.channelSelection || null,
    serviceAddresses: data?.serviceAddresses || [],
    installationEstimate: data?.installationEstimate || null,
    mobileFulfillment: data?.mobileFulfillment || null,
    portRequest: data?.order?.port_request || null,
    kycSession: data?.kycSession,
    activityLogs: data?.activityLogs || [],
    incompleteAlert: data?.incompleteAlert || null,
    isLoading: orderQuery.isLoading,
    error: orderQuery.error,
    refetch: orderQuery.refetch,

    // Workflow
    workflow,
    activeStep,
    setActiveStep,
    currentUserId: user?.id || null,

    // Mutations
    updateOrder: updateOrder.mutateAsync,
    changeStatus,
    confirmPayment,
    markPaymentInvalid,
    markPaymentPartial,
    recordManualPayment,
    setFulfillmentType,
    updateFulfillmentDetails,
    assignEquipment,
    replaceEquipment,
    updateShipping,
    assignTechnician,
    addNote,
    activateService,
    completeOrder,
    signContract,
    sendClientNotification,
    activateSim,
    deactivateSim,
    activateEsim,
    resendEsimQr,
    submitPortIn,
    updatePortInStatus,
    cancelPortIn,
    requestIdentityVerification,
    requestKycResubmission,
    approveKyc,
    rejectKyc,
    isUpdating: updateOrder.isPending,
  };
}
