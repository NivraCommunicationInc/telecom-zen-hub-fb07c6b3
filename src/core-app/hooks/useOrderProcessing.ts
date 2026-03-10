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
function buildWorkflow(order: any, channelSelection?: any): WorkflowStep[] {
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
    // Add TV channel step for TV/combo orders
    if (serviceType.includes("tv") || serviceType.includes("combo") || serviceType.includes("bundle")) {
      base.push({ id: "tv_channels", label: "Chaînes TV", status: "pending" });
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
    // Generic fallback
    base.push(
      { id: "fulfillment", label: "Fulfillment", status: "pending" },
      { id: "equipment", label: "Équipement", status: "pending" },
      { id: "activation", label: "Activation", status: "pending" },
      { id: "contracts", label: "Contrat & Documents", status: "pending" },
      { id: "shipping", label: "Expédition / Technicien", status: "pending" },
      { id: "completion", label: "Complétion", status: "pending" },
    );
  }

  return computeStepStatuses(base, order, channelSelection);
}

function computeStepStatuses(steps: WorkflowStep[], order: any, channelSelection?: any): WorkflowStep[] {
  if (!order) return steps;

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
      case "kyc":
        // Read canonical KYC status from the linked session first, fallback to order field
        if ((order._kycSessionStatus || order.id_verification_status) === "approved") status = "completed";
        else if ((order._kycSessionStatus || order.id_verification_status) === "rejected") status = "blocked";
        break;
      case "fulfillment":
        if (order.fulfillment_type && (order.service_location_id || order.shipping_address || order.client_full_address)) status = "completed";
        break;
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
  "client-orders",
  "client-invoices",
  "client-invoice-breakdowns",
  "client-billing-subscriptions-canonical",
  "client-billing-invoices-canonical",
  "client-billing-payments-canonical",
  "ledger-history-v2",
  "ledger-balance",
  "service-addresses",
  "address-service-counts",
  "client-services-orders",
  "overdue-count-unified",
  "admin-activity-logs",
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
  mode?: "automatic" | "manual";
}) {
  try {
    const templateVars = {
      ...(params.template_vars || {}),
      ...(params.mode === "manual" ? { manual_send: true } : {}),
    };

    const { error } = await supabase.from("email_queue").insert({
      to_email: params.to_email,
      template_key: params.template_key,
      event_key: params.event_key,
      idempotency_key: params.idempotency_key,
      subject: params.subject,
      entity_type: params.entity_type || "order",
      entity_id: params.entity_id,
      template_vars: templateVars,
      status: "queued",
    });
    if (error) console.error("[OrderProcessing] Email queue error:", error);
  } catch (err) {
    console.error("[OrderProcessing] Email queue exception:", err);
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
        .maybeSingle();

      // Fetch KYC session if linked
      let kycSession = null;
      if (order.identity_verification_session_id) {
        const { data } = await supabase
          .from("identity_verification_sessions")
          .select("*")
          .eq("id", order.identity_verification_session_id)
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

      // Compute installation time estimate
      const installationEstimate = computeInstallationEstimate(order, appointment);

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
        contracts: contracts || [],
        appointment,
        channelSelection,
        serviceAddresses: serviceAddresses || [],
        installationEstimate,
        kycSession,
        activityLogs: activityLogs || [],
      };
    },
  });

  const data = orderQuery.data;
  const workflow = data?.order ? buildWorkflow(data.order, data.channelSelection) : [];

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

  /* ── Update order fields ── */
  const updateOrder = useMutation({
    mutationFn: async (fields: Record<string, any>) => {
      const { error } = await supabase
        .from("orders")
        .update({ ...fields, updated_at: new Date().toISOString() })
        .eq("id", orderId!);
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(),
  });

  /* ── Change order status ── */
  const changeStatus = async (newStatus: string, reason?: string) => {
    const oldStatus = data?.order?.status;
    await updateOrder.mutateAsync({ status: newStatus });
    await logActivity(
      "status_change",
      "order",
      orderId,
      { old_status: oldStatus, new_status: newStatus, reason },
      { changedField: "status", oldValue: oldStatus, newValue: newStatus, reason }
    );

    // Queue email notification to client — map to existing template keys
    const email = getClientEmail();
    if (email) {
      // Map status to known template keys in process-email-queue
      const statusTemplateMap: Record<string, string> = {
        shipped: "order_shipped",
        delivered: "order_completed",
        completed: "order_completed",
        activated: "order_completed",
        installed: "order_completed",
        cancelled: "order_cancelled",
      };
      const templateKey = statusTemplateMap[newStatus] || "order_submitted";

      await queueClientEmail({
        to_email: email,
        template_key: templateKey,
        event_key: `order_status_${orderId}_${newStatus}_${Date.now()}`,
        idempotency_key: `auto_order_status_${orderId}_${newStatus}`,
        mode: "automatic",
        subject: `Mise à jour de votre commande — ${newStatus}`,
        entity_id: orderId,
        template_vars: {
          client_name: getClientName(),
          order_id: orderId,
          order_number: data?.order?.order_number || "",
          old_status: oldStatus,
          new_status: newStatus,
          reason: reason || "",
          status: newStatus,
        },
      });
    }

    toast.success(`Statut mis à jour: ${newStatus}`);
  };

  /* ── Confirm payment ── */
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

      const amountToApply = Number(targetInvoice.balance_due ?? targetInvoice.total ?? 0);
      if (amountToApply <= 0) {
        toast.info("Aucun solde à confirmer");
        return;
      }

      const { data: rpcResult, error } = await supabase.rpc("apply_payment_to_invoice" as any, {
        p_invoice_id: targetInvoice.id,
        p_amount: amountToApply,
        p_method: mapToBillingMethod(data?.order?.payment_method),
        p_provider: "admin_manual_confirmation",
        p_provider_payment_id: reference || `admin-${Date.now()}`,
        p_source: "admin",
        p_created_by_name: user?.email || "Admin",
        p_created_by_role: "admin",
        p_customer_id: targetInvoice.customer_id || null,
      });

      if (error) throw error;

      const rpcPayload = (rpcResult || {}) as any;
      if (!rpcPayload.success) {
        const message = rpcPayload.error || "Échec de synchronisation du paiement";
        if (rpcPayload.already_paid) {
          toast.info("Cette facture est déjà réglée");
          return;
        }
        throw new Error(message);
      }

      await updateOrder.mutateAsync({
        payment_confirmed_at: new Date().toISOString(),
        payment_reference: reference || data?.order?.payment_reference || "admin-confirmed",
      });

      await logActivity("payment_confirmed", "order", orderId, {
        reference,
        invoice_id: targetInvoice.id,
        invoice_number: targetInvoice.invoice_number,
        amount_applied: amountToApply,
        rpc_result: rpcPayload,
      });

      // Queue email notification
      const email = getClientEmail();
      if (email) {
        await queueClientEmail({
          to_email: email,
          template_key: "payment_confirmed",
          event_key: `payment_confirmed_${orderId}_${Date.now()}`,
          idempotency_key: `auto_payment_confirmed_${orderId}_${targetInvoice.id}`,
          mode: "automatic",
          subject: "Confirmation de paiement — Nivra",
          entity_id: orderId,
          template_vars: {
            client_name: getClientName(),
            order_id: orderId,
            invoice_id: targetInvoice.id,
            invoice_number: targetInvoice.invoice_number || "",
            order_number: data?.order?.order_number || "",
            amount: amountToApply,
            reference: reference || "",
          },
        });
      }

      invalidateAll();
      toast.success("Paiement confirmé et synchronisé");
    } catch (err: any) {
      console.error("[OrderProcessing] confirmPayment failed:", err);
      toast.error(err?.message || "Erreur lors de la confirmation du paiement");
      throw err;
    }
  };

  /* ── Mark payment invalid ── */
  const markPaymentInvalid = async () => {
    await updateOrder.mutateAsync({ payment_status: "failed" });
    await logActivity("payment_invalidated", "order", orderId, {});

    const email = getClientEmail();
    if (email) {
      await queueClientEmail({
        to_email: email,
        template_key: "payment_failed",
        event_key: `payment_failed_${orderId}_${Date.now()}`,
        subject: "Problème de paiement — Nivra",
        entity_id: orderId,
        template_vars: {
          client_name: getClientName(),
          order_number: data?.order?.order_number || "",
        },
      });
    }

    toast.warning("Paiement marqué comme invalide");
  };

  /* ── Mark payment partial ── */
  const markPaymentPartial = async () => {
    await updateOrder.mutateAsync({ payment_status: "partial" });
    await logActivity("payment_partial", "order", orderId, {});
    toast.info("Paiement marqué comme partiel");
  };

  /* ── Update fulfillment type ── */
  const setFulfillmentType = async (type: string) => {
    await updateOrder.mutateAsync({
      fulfillment_type: type,
      fulfillment_assigned_at: new Date().toISOString(),
    });
    await logActivity("fulfillment_assigned", "order", orderId, { fulfillment_type: type });
    toast.success(`Mode de livraison: ${type}`);
  };

  /* ── Assign equipment ── */
  const assignEquipment = async (fields: {
    sim_number?: string;
    imei_number?: string;
    serial_number?: string;
    equipment_id?: string;
    equipment_details?: any;
  }) => {
    await updateOrder.mutateAsync(fields);
    await logActivity("equipment_assigned", "order", orderId, fields);
    toast.success("Équipement assigné");
  };

  /* ── Update shipping ── */
  const updateShipping = async (fields: {
    carrier?: string;
    tracking_number?: string;
    tracking_url?: string;
    shipped_at?: string;
  }) => {
    await updateOrder.mutateAsync(fields);
    await logActivity("shipment_updated", "order", orderId, fields);

    // Send shipping notification if tracking was added
    if (fields.tracking_number) {
      const email = getClientEmail();
      if (email) {
        await queueClientEmail({
          to_email: email,
          template_key: "shipment_created",
          event_key: `shipment_${orderId}_${Date.now()}`,
          subject: "Votre commande a été expédiée — Nivra",
          entity_id: orderId,
          template_vars: {
            client_name: getClientName(),
            order_number: data?.order?.order_number || "",
            carrier: fields.carrier || "",
            tracking_number: fields.tracking_number || "",
            tracking_url: fields.tracking_url || "",
          },
        });
      }
    }

    toast.success("Expédition mise à jour");
  };

  /* ── Assign technician ── */
  const assignTechnician = async (technicianId: string) => {
    await updateOrder.mutateAsync({ technician_id: technicianId });
    await logActivity("technician_assigned", "order", orderId, { technician_id: technicianId });
    toast.success("Technicien assigné");
  };

  /* ── Add internal note ── */
  const addNote = async (note: string) => {
    const existing = data?.order?.internal_notes || "";
    const timestamp = new Date().toISOString();
    const entry = `[${timestamp}] ${user?.email}: ${note}`;
    const updated = existing ? `${existing}\n${entry}` : entry;
    await updateOrder.mutateAsync({ internal_notes: updated });
    await logActivity("note_added", "order", orderId, { note });
    toast.success("Note ajoutée");
  };

  /* ── Send notification to client ── */
  const sendClientNotification = async (templateKey: string, subject: string, extraVars?: Record<string, any>) => {
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
  };

  /* ── Sign contract (admin side) ── */
  const signContract = async (contractId: string) => {
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
  };

  /* ── Complete order ── */
  const completeOrder = async () => {
    // SYSTEMIC GUARD: Verify invoice is paid before allowing completion
    const invoice = data?.invoice;
    if (!invoice) {
      toast.error("Impossible de compléter : aucune facture liée à cette commande.");
      return;
    }
    const balanceDue = Number(invoice.balance_due ?? invoice.total ?? 1);
    const invoiceStatus = invoice.status;
    if (!["paid", "partially_paid"].includes(invoiceStatus || "") && balanceDue > 0) {
      toast.error(`Impossible de compléter : la facture ${invoice.invoice_number || ""} n'est pas payée (solde: ${balanceDue.toFixed(2)} $).`);
      return;
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
  };

  return {
    // Data
    order: data?.order,
    profile: data?.profile,
    account: data?.account,
    items: data?.items || [],
    invoice: data?.invoice,
    contracts: data?.contracts || [],
    appointment: data?.appointment,
    channelSelection: data?.channelSelection || null,
    serviceAddresses: data?.serviceAddresses || [],
    installationEstimate: data?.installationEstimate || null,
    kycSession: data?.kycSession,
    activityLogs: data?.activityLogs || [],
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
    setFulfillmentType,
    assignEquipment,
    updateShipping,
    assignTechnician,
    addNote,
    completeOrder,
    signContract,
    sendClientNotification,
    isUpdating: updateOrder.isPending,
  };
}
