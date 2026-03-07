/**
 * Appointment Hold Manager
 * Persists appointment slot selection independently of order creation.
 * Pattern: HOLD → CONFIRM (same as KYC session pattern)
 */
import { portalClient } from "@/integrations/backend/portalClient";

const HOLD_STORAGE_KEY = "nivra_appointment_hold_id";

export interface AppointmentHold {
  appointmentId: string;
  holdExpiresAt: string;
  scheduledAt: string;
  timeSlot: string;
}

/**
 * Create a hold on a time slot. Returns the appointment ID.
 * Automatically cancels any previous hold for this client.
 */
export async function createAppointmentHold(params: {
  scheduledAt: string; // ISO datetime
  timeSlot: string;    // e.g. "18h - 20h"
  serviceType?: string;
  serviceAddress?: string;
  serviceCity?: string;
  servicePostalCode?: string;
  installationMethod?: string;
  installationId?: string;
  slotId?: string;
}): Promise<AppointmentHold | null> {
  const { data: authData } = await portalClient.auth.getUser();
  const userId = authData.user?.id;
  if (!userId) return null;

  const { data, error } = await portalClient.rpc("create_appointment_hold", {
    p_client_id: userId,
    p_scheduled_at: params.scheduledAt,
    p_time_slot: params.timeSlot,
    p_service_type: params.serviceType || "Internet",
    p_service_address: params.serviceAddress || "",
    p_service_city: params.serviceCity || "",
    p_service_postal_code: params.servicePostalCode || "",
    p_installation_method: params.installationMethod || "auto",
    p_installation_id: params.installationId || null,
    p_slot_id: params.slotId || null,
    p_hold_minutes: 30,
  });

  if (error) {
    console.error("[AppointmentHold] RPC error:", error);
    return null;
  }

  const result = typeof data === "string" ? JSON.parse(data) : data;
  if (!result?.success) {
    console.error("[AppointmentHold] Hold failed:", result?.error);
    return null;
  }

  const hold: AppointmentHold = {
    appointmentId: result.appointment_id,
    holdExpiresAt: result.hold_expires_at,
    scheduledAt: params.scheduledAt,
    timeSlot: params.timeSlot,
  };

  localStorage.setItem(HOLD_STORAGE_KEY, JSON.stringify(hold));
  console.log("[AppointmentHold] Hold created:", hold.appointmentId, "expires:", hold.holdExpiresAt);
  return hold;
}

/**
 * Restore an existing hold from localStorage + validate against DB.
 * Returns the hold if still valid, null if expired/not found.
 */
export async function restoreAppointmentHold(): Promise<AppointmentHold | null> {
  const stored = localStorage.getItem(HOLD_STORAGE_KEY);
  if (!stored) return null;

  try {
    const hold: AppointmentHold = JSON.parse(stored);

    // Check if expired client-side first
    if (new Date(hold.holdExpiresAt) < new Date()) {
      console.log("[AppointmentHold] Hold expired locally, clearing");
      clearAppointmentHold();
      return null;
    }

    // Validate against DB
    const { data } = await portalClient
      .from("appointments")
      .select("id, status, hold_expires_at, scheduled_at, description")
      .eq("id", hold.appointmentId)
      .maybeSingle();

    if (!data || data.status !== "hold") {
      console.log("[AppointmentHold] Hold no longer valid in DB:", data?.status);
      clearAppointmentHold();
      return null;
    }

    if (data.hold_expires_at && new Date(data.hold_expires_at) < new Date()) {
      console.log("[AppointmentHold] Hold expired in DB");
      clearAppointmentHold();
      return null;
    }

    // Update local copy with fresh DB data (preserve timeSlot from localStorage — DB description may differ)
    hold.holdExpiresAt = data.hold_expires_at || hold.holdExpiresAt;
    hold.scheduledAt = data.scheduled_at;
    localStorage.setItem(HOLD_STORAGE_KEY, JSON.stringify(hold));

    console.log("[AppointmentHold] Hold restored:", hold.appointmentId);
    return hold;
  } catch {
    clearAppointmentHold();
    return null;
  }
}

/**
 * Confirm the hold when the order is successfully created.
 */
export async function confirmAppointmentHold(orderId: string): Promise<boolean> {
  const stored = localStorage.getItem(HOLD_STORAGE_KEY);
  if (!stored) return false;

  try {
    const hold: AppointmentHold = JSON.parse(stored);
    const { data: authData } = await portalClient.auth.getUser();
    const userId = authData.user?.id;
    if (!userId) return false;

    const { data, error } = await portalClient.rpc("confirm_appointment_hold", {
      p_appointment_id: hold.appointmentId,
      p_order_id: orderId,
      p_client_id: userId,
    });

    if (error) {
      console.error("[AppointmentHold] Confirm RPC error:", error);
      return false;
    }

    const result = typeof data === "string" ? JSON.parse(data) : data;
    if (!result?.success) {
      console.error("[AppointmentHold] Confirm failed:", result?.error);
      return false;
    }

    console.log("[AppointmentHold] Hold confirmed for order:", orderId);
    // Don't clear from localStorage yet — cleared on full order completion
    return true;
  } catch (err) {
    console.error("[AppointmentHold] Confirm exception:", err);
    return false;
  }
}

/**
 * Clear hold from localStorage (after successful order completion).
 */
export function clearAppointmentHold(): void {
  localStorage.removeItem(HOLD_STORAGE_KEY);
}
