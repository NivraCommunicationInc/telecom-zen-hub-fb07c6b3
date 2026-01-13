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
// Format: Clean, structured, bilingual-friendly
// =============================================

const COMPANY_LINE = "— Nivra Télécom";
const SUPPORT_PHONE = "438-544-2233";
const PORTAL_URL = "nivratelecom.ca/portal";

export const SMS_TEMPLATES = {
  // ═══════════════════════════════════════════
  // COMMANDES / ORDERS
  // ═══════════════════════════════════════════
  orderConfirmation: (params: { orderNumber: string; clientName: string; monthlyTotal: string }) =>
`Bonjour ${params.clientName},

Votre commande ${params.orderNumber} a été reçue et est en cours de traitement.

💰 Total mensuel: ${params.monthlyTotal}

Prochaine étape: Notre équipe vous contactera sous 24h pour confirmer les détails.

${COMPANY_LINE}
📞 ${SUPPORT_PHONE}`,

  // ═══════════════════════════════════════════
  // INSTALLATIONS
  // ═══════════════════════════════════════════
  installationScheduled: (params: { orderNumber: string; clientName: string; dateTime?: string }) =>
`Bonjour ${params.clientName},

Votre rendez-vous d'installation est confirmé.

📅 ${params.dateTime ? `Date: ${params.dateTime}` : 'Un technicien vous sera assigné sous peu.'}
📋 Référence: ${params.orderNumber}

Merci de vous assurer qu'un adulte soit présent.

${COMPANY_LINE}
📞 ${SUPPORT_PHONE}`,

  technicianEnRoute: (params: { clientName: string; technicianName?: string }) =>
`Bonjour ${params.clientName},

Notre technicien${params.technicianName ? ` ${params.technicianName}` : ''} est en route vers votre domicile.

⏱️ Arrivée estimée: 15-30 minutes

Merci de rester disponible pour son arrivée.

${COMPANY_LINE}
📞 ${SUPPORT_PHONE}`,

  installationCompleted: (params: { clientName: string }) =>
`Bonjour ${params.clientName},

✅ Votre installation est terminée avec succès!

Vos services sont maintenant actifs. Accédez à votre espace client pour gérer votre compte:
🔗 ${PORTAL_URL}

Merci de votre confiance.

${COMPANY_LINE}
📞 ${SUPPORT_PHONE}`,

  // ═══════════════════════════════════════════
  // PAIEMENTS
  // ═══════════════════════════════════════════
  paymentReceived: (params: { clientName: string; amount: string; invoiceNumber?: string }) =>
`Bonjour ${params.clientName},

✅ Paiement reçu

💰 Montant: ${params.amount}${params.invoiceNumber ? `\n📋 Facture: ${params.invoiceNumber}` : ''}

Merci pour votre paiement. Votre reçu sera disponible dans votre espace client.

${COMPANY_LINE}
📞 ${SUPPORT_PHONE}`,

  paymentOverdue: (params: { clientName: string; amount: string; dueDate?: string }) =>
`Bonjour ${params.clientName},

⚠️ Rappel de paiement

Un solde de ${params.amount} est dû sur votre compte${params.dueDate ? ` depuis le ${params.dueDate}` : ''}.

Pour éviter une interruption de service, veuillez régulariser votre situation:
🔗 ${PORTAL_URL}

${COMPANY_LINE}
📞 ${SUPPORT_PHONE}`,

  // ═══════════════════════════════════════════
  // SERVICES
  // ═══════════════════════════════════════════
  serviceActivated: (params: { clientName: string; serviceName: string }) =>
`Bonjour ${params.clientName},

✅ Service activé

Votre service ${params.serviceName} est maintenant actif et prêt à utiliser.

Gérez votre compte:
🔗 ${PORTAL_URL}

${COMPANY_LINE}
📞 ${SUPPORT_PHONE}`,

  serviceSuspended: (params: { clientName: string; serviceName: string }) =>
`Bonjour ${params.clientName},

⚠️ Service suspendu

Votre service ${params.serviceName} a été temporairement suspendu.

Pour rétablir votre service, contactez notre équipe:
📞 ${SUPPORT_PHONE}

${COMPANY_LINE}`,

  // ═══════════════════════════════════════════
  // STREAMING
  // ═══════════════════════════════════════════
  streamingActivated: (params: { clientName: string; serviceName: string }) =>
`Bonjour ${params.clientName},

✅ Abonnement streaming activé

Votre abonnement ${params.serviceName} est maintenant actif!

📧 Vos identifiants de connexion vous seront envoyés par email.

Bon visionnement!

${COMPANY_LINE}
📞 ${SUPPORT_PHONE}`,

  // ═══════════════════════════════════════════
  // MOBILE
  // ═══════════════════════════════════════════
  mobileActivated: (params: { clientName: string; phoneNumber?: string }) =>
`Bonjour ${params.clientName},

✅ Ligne mobile activée${params.phoneNumber ? `\n📱 Numéro: ${params.phoneNumber}` : ''}

Insérez votre carte SIM et redémarrez votre appareil pour commencer à utiliser votre ligne.

${COMPANY_LINE}
📞 ${SUPPORT_PHONE}`,

  // ═══════════════════════════════════════════
  // TICKETS DE SUPPORT
  // ═══════════════════════════════════════════
  ticketCreated: (params: { clientName: string; ticketNumber: string; subject: string }) =>
`Bonjour ${params.clientName},

📋 Demande de support reçue

Numéro de ticket: ${params.ticketNumber}
Sujet: ${params.subject}

Notre équipe traitera votre demande dans les plus brefs délais. Vous recevrez une mise à jour par email.

${COMPANY_LINE}
📞 ${SUPPORT_PHONE}`,

  ticketStatusUpdate: (params: { clientName: string; ticketNumber: string; newStatus: string; statusLabel: string }) =>
`Bonjour ${params.clientName},

📋 Mise à jour de votre ticket ${params.ticketNumber}

Nouveau statut: ${params.statusLabel}

Consultez les détails dans votre espace client:
🔗 ${PORTAL_URL}

${COMPANY_LINE}
📞 ${SUPPORT_PHONE}`,

  ticketResolved: (params: { clientName: string; ticketNumber: string }) =>
`Bonjour ${params.clientName},

✅ Ticket résolu

Votre demande ${params.ticketNumber} a été traitée et résolue.

Si vous avez d'autres questions, n'hésitez pas à nous contacter.

Merci de votre confiance.

${COMPANY_LINE}
📞 ${SUPPORT_PHONE}`,

  // ═══════════════════════════════════════════
  // TRANSFERT DE NUMÉRO
  // ═══════════════════════════════════════════
  portingInitiated: (params: { clientName: string; phoneNumber: string; estimatedDate?: string }) =>
`Bonjour ${params.clientName},

📱 Transfert de numéro initié

Numéro: ${params.phoneNumber}${params.estimatedDate ? `\n📅 Date estimée: ${params.estimatedDate}` : ''}

Votre demande de transfert est en cours de traitement. Nous vous notifierons dès que le transfert sera complété.

⚠️ Important: Ne résiliez pas votre ancien service avant confirmation.

${COMPANY_LINE}
📞 ${SUPPORT_PHONE}`,

  portingCompleted: (params: { clientName: string; phoneNumber: string }) =>
`Bonjour ${params.clientName},

✅ Transfert de numéro complété

Votre numéro ${params.phoneNumber} est maintenant actif chez Nivra!

Redémarrez votre appareil pour finaliser l'activation.

Bienvenue chez Nivra Télécom!

${COMPANY_LINE}
📞 ${SUPPORT_PHONE}`,

  portingFailed: (params: { clientName: string; phoneNumber: string; reason?: string }) =>
`Bonjour ${params.clientName},

⚠️ Transfert de numéro en attente

Le transfert de ${params.phoneNumber} nécessite votre attention.${params.reason ? `\n\nRaison: ${params.reason}` : ''}

Contactez-nous pour résoudre cette situation:
📞 ${SUPPORT_PHONE}

${COMPANY_LINE}`,
};
