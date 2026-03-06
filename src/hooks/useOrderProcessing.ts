/**
 * useOrderProcessing — Data hook for Admin Order Processing Workspace
 * Single source of truth: all reads/writes go through adminClient → canonical DB tables.
 * Every mutation invalidates both admin and client query keys.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminClient as supabase } from "@/integrations/backend";
import { useAuth } from "@/hooks/useAuth";
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

/* ─── Dynamic workflow per order type ─── */
function buildWorkflow(order: any): WorkflowStep[] {
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
  } else if (serviceType.includes("internet") || serviceType.includes("tv") || serviceType.includes("bundle")) {
    base.push(
      { id: "fulfillment", label: "Fulfillment / Routing", status: "pending" },
      { id: "equipment", label: "Équipement", status: "pending" },
      { id: "shipping", label: "Technicien / Expédition", status: "pending" },
      { id: "activation", label: "Activation", status: "pending" },
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

  return computeStepStatuses(base, order);
}

function computeStepStatuses(steps: WorkflowStep[], order: any): WorkflowStep[] {
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
      case "payment":
        if (["paid", "captured", "confirmed"].includes(order.payment_status || "")) status = "completed";
        else if (order.payment_status === "failed") status = "blocked";
        break;
      case "kyc":
        // Read canonical KYC status from the linked session first, fallback to order field
        if ((order._kycSessionStatus || order.id_verification_status) === "approved") status = "completed";
        else if ((order._kycSessionStatus || order.id_verification_status) === "rejected") status = "blocked";
        break;
      case "fulfillment":
        if (order.fulfillment_type) status = "completed";
        break;
      case "equipment":
        if (order.equipment_id || order.sim_number || order.serial_number) status = "completed";
        break;
      case "activation":
        if (["active", "activated", "completed"].includes(order.status || "")) status = "completed";
        break;
      case "contracts":
        if (order.related_contract_id) status = "completed";
        break;
      case "shipping":
        if (order.tracking_number || order.shipped_at || order.technician_id) status = "completed";
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
  "client-orders",
  "client-invoices",
  "client-invoice-breakdowns",
  "ledger-balance",
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
}) {
  try {
    const { error } = await supabase.from("email_queue").insert({
      to_email: params.to_email,
      template_key: params.template_key,
      event_key: params.event_key,
      subject: params.subject,
      entity_type: params.entity_type || "order",
      entity_id: params.entity_id,
      template_vars: params.template_vars || {},
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
  const { user } = useAuth();
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

      // Fetch invoice from billing_invoices
      const { data: invoice } = await supabase
        .from("billing_invoices")
        .select("*")
        .eq("order_id", orderId!)
        .maybeSingle();

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

      // Enrich order with canonical KYC status from session for workflow step computation
      const enrichedOrder = {
        ...order,
        _kycSessionStatus: kycSession?.status || null,
      };

      return {
        order: enrichedOrder,
        profile,
        account,
        items: items || [],
        invoice,
        contracts: contracts || [],
        appointment,
        kycSession,
        activityLogs: activityLogs || [],
      };
    },
  });

  const data = orderQuery.data;
  const workflow = data?.order ? buildWorkflow(data.order) : [];

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
        subject: `Mise à jour de votre commande — ${newStatus}`,
        entity_id: orderId,
        template_vars: {
          client_name: getClientName(),
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
      if (data?.invoice) {
        const { error } = await supabase.rpc("apply_payment_to_invoice" as any, {
          p_invoice_id: data.invoice.id,
          p_amount: data.invoice.total,
          p_method: data.order?.payment_method || "manual",
          p_reference: reference || "admin-confirmed",
          p_provider_payment_id: reference || `admin-${Date.now()}`,
          p_admin_id: user?.id,
        });
        if (error) throw error;
      } else {
        await updateOrder.mutateAsync({
          payment_status: "confirmed",
          payment_confirmed_at: new Date().toISOString(),
          payment_reference: reference || "admin-confirmed",
        });
      }
    } catch (err: any) {
      if (err?.message?.includes("function") || err?.code === "PGRST202") {
        await updateOrder.mutateAsync({
          payment_status: "confirmed",
          payment_confirmed_at: new Date().toISOString(),
          payment_reference: reference || "admin-confirmed",
        });
      } else {
        throw err;
      }
    }

    await logActivity("payment_confirmed", "order", orderId, { reference });

    // Queue email notification
    const email = getClientEmail();
    if (email) {
      await queueClientEmail({
        to_email: email,
        template_key: "payment_confirmed",
        event_key: `payment_confirmed_${orderId}_${Date.now()}`,
        subject: "Confirmation de paiement — Nivra",
        entity_id: orderId,
        template_vars: {
          client_name: getClientName(),
          order_number: data?.order?.order_number || "",
          amount: data?.invoice?.total || data?.order?.total_amount || 0,
          reference: reference || "",
        },
      });
    }

    invalidateAll();
    toast.success("Paiement confirmé");
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
      event_key: `${templateKey}_${orderId}_${Date.now()}`,
      subject,
      entity_id: orderId,
      template_vars: {
        client_name: getClientName(),
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
    await changeStatus("completed");
    await updateOrder.mutateAsync({ processed_at: new Date().toISOString(), processed_by: user?.id });

    // Queue completion notification
    const email = getClientEmail();
    if (email) {
      await queueClientEmail({
        to_email: email,
        template_key: "order_completed",
        event_key: `order_completed_${orderId}_${Date.now()}`,
        subject: "Votre commande est complétée — Nivra",
        entity_id: orderId,
        template_vars: {
          client_name: getClientName(),
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
    kycSession: data?.kycSession,
    activityLogs: data?.activityLogs || [],
    isLoading: orderQuery.isLoading,
    error: orderQuery.error,
    refetch: orderQuery.refetch,

    // Workflow
    workflow,
    activeStep,
    setActiveStep,

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
