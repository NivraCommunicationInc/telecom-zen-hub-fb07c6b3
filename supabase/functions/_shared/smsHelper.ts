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

// =============================================
// PROFESSIONAL SMS TEMPLATES
// Format exact demandé par le client
// =============================================

const SMS_FOOTER = `
Nivra Telecom
Laval, QC, Canada
Support@nivratelecom.ca | 438-544-2233
Vous recevez ce texto suite à une action sur votre compte Nivra Telecom.
You are receiving this text because of an action on your Nivra Telecom account.`;

export const SMS_TEMPLATES = {
  // ═══════════════════════════════════════════
  // COMMANDES / ORDERS
  // ═══════════════════════════════════════════
  orderConfirmation: (params: { orderNumber: string; clientName: string; monthlyTotal: string }) =>
`Nivra Telecom

Bonjour ${params.clientName},

Votre commande ${params.orderNumber} est confirmée.
Total mensuel: ${params.monthlyTotal}

Vous pouvez suivre l'état de votre commande directement dans votre compte.
${SMS_FOOTER}`,

  // ═══════════════════════════════════════════
  // INSTALLATIONS
  // ═══════════════════════════════════════════
  installationScheduled: (params: { orderNumber: string; clientName: string; dateTime?: string }) =>
`Nivra Telecom

Bonjour ${params.clientName},

Votre installation est planifiée.
Commande: ${params.orderNumber}${params.dateTime ? `
Date: ${params.dateTime}` : ''}

Un technicien se présentera à votre adresse. Assurez-vous qu'un adulte soit présent.
${SMS_FOOTER}`,

  technicianEnRoute: (params: { clientName: string; technicianName?: string }) =>
`Nivra Telecom

Bonjour ${params.clientName},

Notre technicien${params.technicianName ? ` ${params.technicianName}` : ''} est en route vers votre domicile.
Arrivée estimée: 15-30 minutes

Merci de rester disponible.
${SMS_FOOTER}`,

  installationCompleted: (params: { clientName: string }) =>
`Nivra Telecom

Bonjour ${params.clientName},

Votre installation est terminée avec succès.
Vos services sont maintenant actifs.

Accédez à votre espace client: nivratelecom.ca/portal
${SMS_FOOTER}`,

  // ═══════════════════════════════════════════
  // PAIEMENTS
  // ═══════════════════════════════════════════
  paymentReceived: (params: { clientName: string; amount: string; invoiceNumber?: string }) =>
`Nivra Telecom

Bonjour ${params.clientName},

Paiement reçu: ${params.amount}${params.invoiceNumber ? `
Facture: ${params.invoiceNumber}` : ''}

Merci pour votre paiement. Votre reçu est disponible dans votre espace client.
${SMS_FOOTER}`,

  paymentOverdue: (params: { clientName: string; amount: string; dueDate?: string }) =>
`Nivra Telecom

Bonjour ${params.clientName},

Rappel: Un solde de ${params.amount} est dû sur votre compte${params.dueDate ? ` depuis le ${params.dueDate}` : ''}.

Pour éviter une interruption de service, veuillez effectuer votre paiement: nivratelecom.ca/portal
${SMS_FOOTER}`,

  // ═══════════════════════════════════════════
  // SERVICES
  // ═══════════════════════════════════════════
  serviceActivated: (params: { clientName: string; serviceName: string }) =>
`Nivra Telecom

Bonjour ${params.clientName},

Votre service ${params.serviceName} est maintenant actif.

Gérez votre compte: nivratelecom.ca/portal
${SMS_FOOTER}`,

  serviceSuspended: (params: { clientName: string; serviceName: string }) =>
`Nivra Telecom

Bonjour ${params.clientName},

Votre service ${params.serviceName} a été temporairement suspendu.

Contactez-nous pour rétablir votre service: 438-544-2233
${SMS_FOOTER}`,

  // ═══════════════════════════════════════════
  // STREAMING
  // ═══════════════════════════════════════════
  streamingActivated: (params: { clientName: string; serviceName: string }) =>
`Nivra Telecom

Bonjour ${params.clientName},

Votre abonnement ${params.serviceName} est maintenant actif.
Vos identifiants de connexion vous seront envoyés par email.

Bon visionnement!
${SMS_FOOTER}`,

  // ═══════════════════════════════════════════
  // MOBILE
  // ═══════════════════════════════════════════
  mobileActivated: (params: { clientName: string; phoneNumber?: string }) =>
`Nivra Telecom

Bonjour ${params.clientName},

Votre ligne mobile est activée${params.phoneNumber ? `: ${params.phoneNumber}` : ''}.

Insérez votre carte SIM et redémarrez votre appareil pour commencer.
${SMS_FOOTER}`,

  // ═══════════════════════════════════════════
  // TICKETS DE SUPPORT
  // ═══════════════════════════════════════════
  ticketCreated: (params: { clientName: string; ticketNumber: string; subject: string }) =>
`Nivra Telecom

Bonjour ${params.clientName},

Votre demande de support a été reçue.
Ticket: ${params.ticketNumber}
Sujet: ${params.subject}

Notre équipe traitera votre demande dans les plus brefs délais.
${SMS_FOOTER}`,

  ticketStatusUpdate: (params: { clientName: string; ticketNumber: string; newStatus: string; statusLabel: string }) =>
`Nivra Telecom

Bonjour ${params.clientName},

Mise à jour de votre ticket ${params.ticketNumber}.
Nouveau statut: ${params.statusLabel}

Consultez les détails: nivratelecom.ca/portal
${SMS_FOOTER}`,

  ticketResolved: (params: { clientName: string; ticketNumber: string }) =>
`Nivra Telecom

Bonjour ${params.clientName},

Votre demande ${params.ticketNumber} a été traitée et résolue.

Si vous avez d'autres questions, n'hésitez pas à nous contacter.
${SMS_FOOTER}`,

  // ═══════════════════════════════════════════
  // TRANSFERT DE NUMÉRO
  // ═══════════════════════════════════════════
  portingInitiated: (params: { clientName: string; phoneNumber: string; estimatedDate?: string }) =>
`Nivra Telecom

Bonjour ${params.clientName},

Transfert de numéro initié: ${params.phoneNumber}${params.estimatedDate ? `
Date estimée: ${params.estimatedDate}` : ''}

Important: Ne résiliez pas votre ancien service avant confirmation.
${SMS_FOOTER}`,

  portingCompleted: (params: { clientName: string; phoneNumber: string }) =>
`Nivra Telecom

Bonjour ${params.clientName},

Transfert complété: Votre numéro ${params.phoneNumber} est maintenant actif chez Nivra.

Redémarrez votre appareil pour finaliser l'activation.
${SMS_FOOTER}`,

  portingFailed: (params: { clientName: string; phoneNumber: string; reason?: string }) =>
`Nivra Telecom

Bonjour ${params.clientName},

Le transfert de ${params.phoneNumber} nécessite votre attention.${params.reason ? `
Raison: ${params.reason}` : ''}

Contactez-nous: 438-544-2233
${SMS_FOOTER}`,
};

/**
 * Fetch client phone from profiles table if not provided
 */
export async function fetchClientPhone(
  supabaseUrl: string,
  supabaseServiceKey: string,
  clientEmail?: string,
  clientId?: string
): Promise<{ phone: string | null; clientId: string | null }> {
  if (!supabaseUrl || !supabaseServiceKey) {
    return { phone: null, clientId: null };
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (clientId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("phone")
        .eq("id", clientId)
        .maybeSingle();

      if (profile?.phone) {
        return { phone: profile.phone, clientId };
      }
    }

    if (clientEmail) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, phone")
        .eq("email", clientEmail)
        .maybeSingle();

      if (profile?.phone) {
        return { phone: profile.phone, clientId: profile.id };
      }
    }

    return { phone: null, clientId: null };
  } catch (error) {
    console.error("Error fetching client phone:", error);
    return { phone: null, clientId: null };
  }
}
