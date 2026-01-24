/**
 * Hook to send admin notifications for new events
 */

import { supabase } from "@/integrations/supabase/client";

export type AdminNotificationEventType = 
  | "new_order"
  | "new_ticket"
  | "ticket_reply"
  | "new_appointment"
  | "channel_change_request"
  | "plan_change_request"
  | "new_contact_request"
  | "cancellation_request"
  | "payment_dispute"
  | "new_replacement_request";

export interface AdminNotificationParams {
  event_type: AdminNotificationEventType;
  event_id?: string;
  event_number?: string;
  client_name?: string;
  client_email?: string;
  client_phone?: string;
  summary?: string;
  details?: Record<string, unknown>;
  priority?: "low" | "normal" | "high" | "urgent";
  admin_portal_link?: string;
}

/**
 * Send admin notification via edge function
 * This is a fire-and-forget function - errors are logged but don't block the UI
 */
export async function notifyAdmin(params: AdminNotificationParams): Promise<void> {
  try {
    console.log("[notifyAdmin] Sending notification:", params.event_type, params.event_number);
    
    const { error } = await supabase.functions.invoke("notify-admin", {
      body: params,
    });

    if (error) {
      console.error("[notifyAdmin] Error sending notification:", error);
    } else {
      console.log("[notifyAdmin] Notification sent successfully");
    }
  } catch (err) {
    console.error("[notifyAdmin] Exception:", err);
    // Don't throw - this is a non-critical operation
  }
}

/**
 * Helper to build admin portal link
 */
export function getAdminPortalLink(path: string): string {
  const baseUrl = window.location.origin;
  return `${baseUrl}${path}`;
}

/**
 * React hook for admin notifications
 */
export function useAdminNotification() {
  const sendNotification = async (params: AdminNotificationParams) => {
    await notifyAdmin(params);
  };

  return { sendNotification, notifyAdmin, getAdminPortalLink };
}
