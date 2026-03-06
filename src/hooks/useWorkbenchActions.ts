/**
 * useWorkbenchActions - All operational actions for the Order Processing Workspace
 * Handles: status changes, payment confirmation, equipment assignment, shipment updates,
 * appointment management, provisioning, dispatch routing, and order completion.
 */
import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { adminClient as supabase } from "@/integrations/backend";
import { useActivityLog } from "@/hooks/useActivityLog";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export type ActionState = "idle" | "loading" | "success" | "error";

export function useWorkbenchActions(orderId: string, onRefresh: () => void) {
  const { user, role } = useAuth();
  const { logActivity } = useActivityLog();
  const queryClient = useQueryClient();
  const [actionState, setActionState] = useState<ActionState>("idle");

  const invalidateAfterMutation = useCallback(async () => {
    await Promise.allSettled([
      queryClient.invalidateQueries({ queryKey: ["workbench-order", orderId] }),
      queryClient.invalidateQueries({ queryKey: ["workbench-billing", orderId] }),
      queryClient.invalidateQueries({ queryKey: ["workbench-invoices", orderId] }),
      queryClient.invalidateQueries({ queryKey: ["workbench-audit", orderId] }),
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] }),
      queryClient.invalidateQueries({ queryKey: ["client-orders"] }),
      queryClient.invalidateQueries({ queryKey: ["client-orders-all"] }),
      queryClient.invalidateQueries({ queryKey: ["client-invoice-breakdowns"] }),
      queryClient.invalidateQueries({ queryKey: ["pending-invoices-unified"] }),
      queryClient.invalidateQueries({ queryKey: ["ledger-balance"] }),
      queryClient.invalidateQueries({ queryKey: ["overdue-count-unified"] }),
    ]);
  }, [queryClient, orderId]);

  const exec = useCallback(async (
    fn: () => Promise<void>,
    action: string,
    entityType: string,
    entityId: string,
    details?: Record<string, any>,
    opts?: { oldValue?: string; newValue?: string; field?: string }
  ) => {
    setActionState("loading");
    try {
      await fn();
      await logActivity(action, entityType, entityId, details, {
        reason: details?.reason,
        oldValue: opts?.oldValue,
        newValue: opts?.newValue,
        changedField: opts?.field,
      });
      await Promise.allSettled([Promise.resolve(onRefresh()), invalidateAfterMutation()]);
      setActionState("success");
    } catch (err: any) {
      setActionState("error");
      toast.error(err.message || "Erreur");
      throw err;
    }
  }, [logActivity, onRefresh, invalidateAfterMutation]);

  const getPrimaryInvoice = useCallback(async () => {
    const { data, error } = await supabase
      .from("billing_invoices")
      .select("id, customer_id, status, amount_paid, balance_due")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error("Aucune facture canonique liée à cette commande");
    return data;
  }, [orderId]);

  // ── ORDER STATUS ──────────────────────────────────────────────
  const updateOrderStatus = useCallback(async (newStatus: string, reason?: string) => {
    await exec(
      async () => {
        const now = new Date().toISOString();
        const patch: Record<string, any> = {
          status: newStatus,
          updated_at: now,
        };

        if (newStatus === "completed") {
          patch.processed_at = now;
          patch.processed_by = user?.id || null;
        }

        const { error } = await supabase.from("orders").update(patch).eq("id", orderId);
        if (error) throw error;
        toast.success(`Statut → ${newStatus}`);
      },
      "update_order_status", "order", orderId,
      { new_status: newStatus, reason },
      { field: "status", newValue: newStatus }
    );
  }, [orderId, user?.id, exec]);

  // ── PAYMENT (CANONICAL: billing_invoices + billing_payments via RPC) ──
  const confirmPayment = useCallback(async (reference: string, method: string, amount: number) => {
    await exec(
      async () => {
        const invoice = await getPrimaryInvoice();
        const normalizedMethod = method === "interac" || method === "paypal" ? method : "manual";

        const { error: rpcError } = await (supabase as any).rpc("apply_payment_to_invoice", {
          p_invoice_id: invoice.id,
          p_customer_id: invoice.customer_id,
          p_amount: amount,
          p_method: normalizedMethod,
          p_provider: "admin_workbench",
          p_provider_payment_id: reference || `admin-${orderId}-${Date.now()}`,
          p_source: "admin_workbench",
          p_created_by_name: user?.email || "admin",
          p_created_by_role: role || "admin",
        });

        if (rpcError) throw rpcError;

        const { data: updatedInvoice, error: invoiceError } = await supabase
          .from("billing_invoices")
          .select("status, amount_paid, balance_due")
          .eq("id", invoice.id)
          .single();
        if (invoiceError) throw invoiceError;

        const orderPaymentStatus =
          updatedInvoice.status === "paid" || updatedInvoice.status === "paid_by_promo"
            ? "paid"
            : updatedInvoice.status === "partially_paid"
              ? "captured"
              : updatedInvoice.status === "failed"
                ? "failed"
                : "pending";

        const { error: orderError } = await supabase.from("orders").update({
          payment_status: orderPaymentStatus,
          payment_reference: reference || null,
          payment_method: method,
          payment_confirmed_at: new Date().toISOString(),
          amount_paid: Number(updatedInvoice.amount_paid || 0),
          updated_at: new Date().toISOString(),
        }).eq("id", orderId);

        if (orderError) throw orderError;
        toast.success("Paiement confirmé ✓");
      },
      "confirm_payment", "order", orderId,
      { reference, method, amount },
      { field: "payment_status", oldValue: "pending", newValue: "paid" }
    );
  }, [orderId, role, user?.email, getPrimaryInvoice, exec]);

  const failPayment = useCallback(async (reason: string) => {
    await exec(
      async () => {
        const now = new Date().toISOString();
        const { error } = await supabase.from("orders").update({
          payment_status: "failed",
          failure_reason: reason,
          updated_at: now,
        }).eq("id", orderId);
        if (error) throw error;

        const { error: invoiceError } = await supabase
          .from("billing_invoices")
          .update({ status: "failed" })
          .eq("order_id", orderId)
          .in("status", ["pending", "overdue", "partially_paid"]);

        if (invoiceError) throw invoiceError;
        toast.success("Paiement marqué échoué");
      },
      "fail_payment", "order", orderId, { reason },
      { field: "payment_status", newValue: "failed" }
    );
  }, [orderId, exec]);

  // ── SHIPMENT ──────────────────────────────────────────────────
  const updateShipment = useCallback(async (shipmentId: string, data: {
    carrier?: string; tracking_number?: string; tracking_url?: string; status?: string;
    actual_ship_date?: string; actual_delivery_date?: string; notes?: string;
  }) => {
    await exec(
      async () => {
        const { error } = await supabase.from("shipments").update({ ...data, updated_at: new Date().toISOString() }).eq("id", shipmentId);
        if (error) throw error;
        toast.success("Expédition mise à jour ✓");
      },
      "update_shipment", "shipment", shipmentId, data,
      { field: "status", newValue: data.status }
    );
  }, [exec]);

  // ── EQUIPMENT / INVENTORY ─────────────────────────────────────
  const assignEquipment = useCallback(async (stockItemId: string, orderItemId?: string, shipmentId?: string) => {
    await exec(
      async () => {
        const { error } = await supabase.from("inventory_assignments").insert({
          stock_item_id: stockItemId,
          order_id: orderId,
          order_item_id: orderItemId || null,
          shipment_id: shipmentId || null,
          status: "assigned",
          assigned_at: new Date().toISOString(),
          assigned_by: user?.id || null,
        });
        if (error) throw error;
        await supabase.from("inventory_stock").update({ status: "assigned" }).eq("id", stockItemId);
        toast.success("Équipement assigné ✓");
      },
      "assign_equipment", "inventory_assignment", stockItemId, { order_id: orderId }
    );
  }, [orderId, user, exec]);

  // ── APPOINTMENT ───────────────────────────────────────────────
  const updateAppointment = useCallback(async (appointmentId: string, data: {
    status?: string; technician_id?: string; scheduled_at?: string;
    internal_notes?: string; cancellation_reason?: string;
  }) => {
    await exec(
      async () => {
        const { error } = await supabase.from("appointments").update({
          ...data, updated_at: new Date().toISOString(), updated_by: user?.id || null,
        }).eq("id", appointmentId);
        if (error) throw error;
        toast.success("Rendez-vous mis à jour ✓");
      },
      "update_appointment", "appointment", appointmentId, data,
      { field: "status", newValue: data.status }
    );
  }, [user, exec]);

  // ── PROVISIONING ──────────────────────────────────────────────
  const retryProvisioning = useCallback(async (jobId: string) => {
    await exec(
      async () => {
        const { error } = await supabase.from("provisioning_jobs").update({
          status: "queued", error_message: null, error_code: null,
        }).eq("id", jobId);
        if (error) throw error;
        toast.success("Job relancé ✓");
      },
      "retry_provisioning", "provisioning_job", jobId, { order_id: orderId }
    );
  }, [orderId, exec]);

  const overrideProvisioning = useCallback(async (jobId: string, reason: string, executionLog: any[]) => {
    await exec(
      async () => {
        const { error } = await supabase.from("provisioning_jobs").update({
          status: "completed",
          completed_at: new Date().toISOString(),
          manual_override_by: user?.id || null,
          manual_override_at: new Date().toISOString(),
          manual_override_reason: reason,
          execution_log: [...executionLog, { event: "manual_override", reason, timestamp: new Date().toISOString() }],
        }).eq("id", jobId);
        if (error) throw error;
        toast.success("Job complété (override) ✓");
      },
      "override_provisioning", "provisioning_job", jobId, { reason, order_id: orderId }
    );
  }, [orderId, user, exec]);

  const completeProvisioning = useCallback(async (jobId: string, providerRef?: string) => {
    await exec(
      async () => {
        const { error } = await supabase.from("provisioning_jobs").update({
          status: "completed",
          completed_at: new Date().toISOString(),
          result_data: providerRef ? { provider_reference: providerRef } : null,
        }).eq("id", jobId);
        if (error) throw error;
        toast.success("Activation complétée ✓");
      },
      "complete_provisioning", "provisioning_job", jobId, { provider_reference: providerRef, order_id: orderId }
    );
  }, [orderId, exec]);

  // ── DISPATCH / ROUTING ────────────────────────────────────────
  const assignToShipping = useCallback(async (notes?: string) => {
    await exec(
      async () => {
        const { error } = await supabase.from("orders").update({
          fulfillment_type: "shipping",
          fulfillment_assigned_at: new Date().toISOString(),
          fulfillment_notes: notes || null,
          status: "fulfillment_pending",
          updated_at: new Date().toISOString(),
        }).eq("id", orderId);
        if (error) throw error;
        toast.success("Assigné à l'expédition ✓");
      },
      "assign_to_shipping", "order", orderId,
      { fulfillment_type: "shipping", notes },
      { field: "fulfillment_type", newValue: "shipping" }
    );
  }, [orderId, exec]);

  const assignToTechnician = useCallback(async (technicianId?: string, notes?: string) => {
    await exec(
      async () => {
        const updateData: Record<string, any> = {
          fulfillment_type: "installation",
          fulfillment_assigned_at: new Date().toISOString(),
          fulfillment_notes: notes || null,
          status: "fulfillment_pending",
          updated_at: new Date().toISOString(),
        };
        const { error } = await supabase.from("orders").update(updateData).eq("id", orderId);
        if (error) throw error;

        if (technicianId) {
          await supabase.from("appointments")
            .update({ technician_id: technicianId, updated_at: new Date().toISOString() })
            .eq("order_id", orderId)
            .in("status", ["scheduled", "confirmed"]);
        }
        toast.success("Assigné à l'installation ✓");
      },
      "assign_to_technician", "order", orderId,
      { fulfillment_type: "installation", technician_id: technicianId, notes },
      { field: "fulfillment_type", newValue: "installation" }
    );
  }, [orderId, exec]);

  // ── ORDER FIELDS (inline edits) ───────────────────────────────
  const updateOrderField = useCallback(async (field: string, value: any, oldValue?: any) => {
    await exec(
      async () => {
        const { error } = await supabase.from("orders").update({ [field]: value, updated_at: new Date().toISOString() }).eq("id", orderId);
        if (error) throw error;
      },
      "update_order_field", "order", orderId, { field, value },
      { field, oldValue: String(oldValue ?? ""), newValue: String(value) }
    );
  }, [orderId, exec]);

  return {
    actionState,
    // Order
    updateOrderStatus,
    updateOrderField,
    // Payment
    confirmPayment,
    failPayment,
    // Shipment
    updateShipment,
    // Equipment
    assignEquipment,
    // Appointment
    updateAppointment,
    // Provisioning
    retryProvisioning,
    overrideProvisioning,
    completeProvisioning,
    // Dispatch routing
    assignToShipping,
    assignToTechnician,
  };
}
