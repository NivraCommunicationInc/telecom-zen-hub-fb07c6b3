/**
 * Shared SMS notification helper
 * Sends SMS via OpenPhone API and logs to telephony_logs
 * Messages will appear in the Admin Telephony section
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface SmsNotification {
  to: string; // E.164 format phone number
  message: string;
  clientId?: string;
  eventType: string; // e.g., "order_confirmation", "installation_status", etc.
  eventKey?: string; // For idempotency
}

export interface SmsResult {
  success: boolean;
  messageId?: string;
  error?: string;
  skipped?: boolean;
  reason?: string;
}

/**
 * Format phone number to E.164 format (required by OpenPhone)
 */
export function toE164(phone: string): string | null {
  if (!phone) return null;
  
  const digits = phone.replace(/\D/g, '');
  
  // Already has country code (11 digits starting with 1)
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  
  // 10-digit Canadian/US number
  if (digits.length === 10) {
    // Validate area code (cannot start with 0 or 1)
    if (digits[0] === '0' || digits[0] === '1') {
      return null;
    }
    return `+1${digits}`;
  }
  
  // Already E.164 with plus
  if (phone.startsWith('+') && digits.length >= 10 && digits.length <= 15) {
    return `+${digits}`;
  }
  
  return null;
}

/**
 * Send SMS notification via OpenPhone
 * This is a fire-and-forget function - it won't block email sending
 */
export async function sendSmsNotification(notification: SmsNotification): Promise<SmsResult> {
  const requestId = crypto.randomUUID().slice(0, 8);
  console.log(`[SMS-${requestId}] Attempting to send SMS notification...`);
  
  try {
    const OPENPHONE_API_KEY = Deno.env.get("OPENPHONE_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!OPENPHONE_API_KEY) {
      console.log(`[SMS-${requestId}] OpenPhone API key not configured, skipping SMS`);
      return { success: false, skipped: true, reason: "OpenPhone not configured" };
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      console.log(`[SMS-${requestId}] Supabase not configured, skipping SMS`);
      return { success: false, skipped: true, reason: "Supabase not configured" };
    }

    // Validate phone number
    const e164Phone = toE164(notification.to);
    if (!e164Phone) {
      console.log(`[SMS-${requestId}] Invalid phone number: ${notification.to}`);
      return { success: false, error: "Invalid phone number format" };
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Idempotency check if eventKey provided
    if (notification.eventKey) {
      const { data: existingSms } = await supabase
        .from("telephony_logs")
        .select("id")
        .eq("action", "sms")
        .eq("direction", "outbound")
        .ilike("message_preview", `%[AUTO:${notification.eventKey}]%`)
        .maybeSingle();

      if (existingSms) {
        console.log(`[SMS-${requestId}] SMS already sent for event: ${notification.eventKey}`);
        return { success: true, skipped: true, reason: "Already sent" };
      }
    }

    // Get OpenPhone phone numbers
    const phoneNumbersRes = await fetch("https://api.openphone.com/v1/phone-numbers", {
      headers: {
        "Authorization": OPENPHONE_API_KEY,
        "Content-Type": "application/json",
      },
    });

    if (!phoneNumbersRes.ok) {
      const errText = await phoneNumbersRes.text();
      console.error(`[SMS-${requestId}] Failed to get OpenPhone numbers:`, errText);
      return { success: false, error: "Failed to get OpenPhone numbers" };
    }

    const phoneNumbersData = await phoneNumbersRes.json();
    const phoneNumbers = phoneNumbersData.data || [];

    if (phoneNumbers.length === 0) {
      console.log(`[SMS-${requestId}] No OpenPhone numbers available`);
      return { success: false, error: "No OpenPhone numbers available" };
    }

    // Use first available phone number
    const fromPhoneNumberId = phoneNumbers[0].id;

    // Add event marker to message for tracking (hidden at end)
    const messageWithMarker = notification.eventKey 
      ? `${notification.message}\n\n[AUTO:${notification.eventKey}]`
      : notification.message;

    // Send SMS via OpenPhone
    console.log(`[SMS-${requestId}] Sending to: ${e164Phone}`);
    const smsRes = await fetch("https://api.openphone.com/v1/messages", {
      method: "POST",
      headers: {
        "Authorization": OPENPHONE_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromPhoneNumberId,
        to: [e164Phone],
        content: messageWithMarker,
      }),
    });

    if (!smsRes.ok) {
      const errText = await smsRes.text();
      console.error(`[SMS-${requestId}] OpenPhone SMS error:`, errText);
      return { success: false, error: "Failed to send SMS" };
    }

    const smsData = await smsRes.json();
    const messageId = smsData.data?.id;

    console.log(`[SMS-${requestId}] ✅ SMS sent successfully: ${messageId}`);

    // Log to telephony_logs for visibility in Admin Telephony section
    await supabase.from("telephony_logs").insert({
      client_id: notification.clientId || null,
      phone_number: e164Phone,
      action: "sms",
      direction: "outbound",
      agent_user_id: null, // System-generated
      agent_name: "Système Auto",
      openphone_message_id: messageId || null,
      message_preview: notification.message.substring(0, 100),
      status: "sent",
    });

    return { success: true, messageId };

  } catch (error) {
    console.error(`[SMS-${requestId}] Error:`, error);
    return { success: false, error: (error as Error)?.message || "Unknown error" };
  }
}

// SMS message templates
export const SMS_TEMPLATES = {
  // Order confirmations
  orderConfirmation: (params: { orderNumber: string; clientName: string; monthlyTotal: string }) =>
    `Nivra: Bonjour ${params.clientName}! Votre commande #${params.orderNumber} est confirmée. Total mensuel: ${params.monthlyTotal}. Nous vous contactons bientôt! Questions? 438-544-2233`,

  // Installation status
  installationScheduled: (params: { orderNumber: string; clientName: string; dateTime?: string }) =>
    `Nivra: ${params.clientName}, votre installation #${params.orderNumber} est planifiée${params.dateTime ? ` pour le ${params.dateTime}` : ''}. Un technicien vous sera assigné. 438-544-2233`,

  technicianEnRoute: (params: { clientName: string; technicianName?: string }) =>
    `Nivra: ${params.clientName}, notre technicien${params.technicianName ? ` ${params.technicianName}` : ''} est en route! Merci de rester disponible. 438-544-2233`,

  installationCompleted: (params: { clientName: string }) =>
    `Nivra: ${params.clientName}, installation terminée! Profitez de vos services. Accédez à votre portail: nivratelecom.ca/portal. Questions? 438-544-2233`,

  // Payments
  paymentReceived: (params: { clientName: string; amount: string; invoiceNumber?: string }) =>
    `Nivra: ${params.clientName}, paiement de ${params.amount} reçu${params.invoiceNumber ? ` pour facture #${params.invoiceNumber}` : ''}. Merci! 438-544-2233`,

  paymentOverdue: (params: { clientName: string; amount: string; dueDate?: string }) =>
    `Nivra: ${params.clientName}, rappel - facture de ${params.amount} en retard${params.dueDate ? ` depuis le ${params.dueDate}` : ''}. Réglez via nivratelecom.ca/portal ou 438-544-2233`,

  // Service status
  serviceActivated: (params: { clientName: string; serviceName: string }) =>
    `Nivra: ${params.clientName}, votre service ${params.serviceName} est maintenant actif! Profitez-en. Questions? 438-544-2233`,

  serviceSuspended: (params: { clientName: string; serviceName: string }) =>
    `Nivra: ${params.clientName}, votre service ${params.serviceName} a été suspendu. Contactez-nous au 438-544-2233 pour plus d'informations.`,

  // Streaming activation
  streamingActivated: (params: { clientName: string; serviceName: string }) =>
    `Nivra: ${params.clientName}, votre abonnement ${params.serviceName} est activé! Vos identifiants vous seront envoyés par email. 438-544-2233`,

  // Mobile activation
  mobileActivated: (params: { clientName: string; phoneNumber?: string }) =>
    `Nivra: ${params.clientName}, votre ligne mobile${params.phoneNumber ? ` ${params.phoneNumber}` : ''} est activée! Insérez votre SIM et redémarrez. 438-544-2233`,
};
