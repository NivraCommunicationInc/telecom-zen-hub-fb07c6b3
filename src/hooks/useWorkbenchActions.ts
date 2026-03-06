/**
 * useWorkbenchActions - All operational actions for the Order Processing Workspace
 * Handles: status changes, payment confirmation, equipment assignment, shipment updates,
 * appointment management, provisioning, and order completion.
 */
import { useState, useCallback } from "react";
import { adminClient as supabase } from "@/integrations/backend";
import { useActivityLog } from "@/hooks/useActivityLog";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export type ActionState = "idle" | "loading" | "success" | "error";

export function useWorkbenchActions(orderId: string, onRefresh: () => void) {
  const { user } = useAuth();
  const { logActivity } = useActivityLog();
  const [actionState, setActionState] = useState<ActionState>("idle");

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
        old_value: opts?.oldValue,
        new_value: opts?.newValue,
        changed_field: opts?.field,
      });
      setActionState("success");
      onRefresh();
    } catch (err: any) {
      setActionState("error");
      toast.error(err.message || "Erreur");
      throw err;
    }
  }, [logActivity, onRefresh]);

  // ── ORDER STATUS ──────────────────────────────────────────────
  const updateOrderStatus = useCallback(async (newStatus: string, reason?: string) => {
    await exec(
      async () => {
        const { error } = await supabase.from("orders").update({ status: newStatus, updated_at: new Date().toISOString() }).eq("id", orderId);
        if (error) throw error;
        toast.success(`Statut → ${newStatus}`);
      },
      "update_order_status", "order", orderId,
      { new_status: newStatus, reason },
      { field: "status", newValue: newStatus }
    );
  }, [orderId, exec]);

  // ── PAYMENT ───────────────────────────────────────────────────
  const confirmPayment = useCallback(async (reference: string, method: string, amount: number) => {
    await exec(
      async () => {
        const { error } = await supabase.from("orders").update({
          payment_status: "paid",
          payment_reference: reference,
          payment_method: method,
          payment_confirmed_at: new Date().toISOString(),
          amount_paid: amount,
        }).eq("id", orderId);
        if (error) throw error;

        // Also update billing_invoices for this order
        await supabase.from("billing_invoices")
          .update({ status: "paid", amount_paid: amount, balance_due: 0, paid_at: new Date().toISOString() })
          .eq("order_id", orderId)
          .eq("status", "pending");

        toast.success("Paiement confirmé ✓");
      },
      "confirm_payment", "order", orderId,
      { reference, method, amount },
      { field: "payment_status", oldValue: "pending", newValue: "paid" }
    );
  }, [orderId, exec]);

  const failPayment = useCallback(async (reason: string) => {
    await exec(
      async () => {
        const { error } = await supabase.from("orders").update({
          payment_status: "failed", failure_reason: reason,
        }).eq("id", orderId);
        if (error) throw error;
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
        // Mark stock as assigned
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
          status: "pending", last_error: null,
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
          execution_log: [...executionLog, { event: "manual_override", reason, timestamp: new Date().toISOString() }],
        }).eq("id", jobId);
        if (error) throw error;
        toast.success("Job complété (override) ✓");
      },
      "override_provisioning", "provisioning_job", jobId, { reason, order_id: orderId }
    );
  }, [orderId, exec]);

  const completeProvisioning = useCallback(async (jobId: string, providerRef?: string) => {
    await exec(
      async () => {
        const { error } = await supabase.from("provisioning_jobs").update({
          status: "completed",
          completed_at: new Date().toISOString(),
          provider_reference: providerRef || null,
        }).eq("id", jobId);
        if (error) throw error;
        toast.success("Activation complétée ✓");
      },
      "complete_provisioning", "provisioning_job", jobId, { provider_reference: providerRef, order_id: orderId }
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
  };
}
