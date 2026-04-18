/**
 * orderEmails.ts — Email factory functions for order processing triggers.
 *
 * Each function returns a row object ready to insert into the `email_queue` table.
 * The actual `email_queue` schema uses (to_email, template_key, template_vars,
 * subject, event_key, idempotency_key, entity_type, entity_id, status,
 * next_retry_at) — these factories produce that shape directly so callers
 * can do: `supabase.from('email_queue').insert(orderEmails.xxx(order, profile))`.
 *
 * The conceptual fields requested in the spec are mapped as follows:
 *   - order_id        → entity_id (and template_vars.order_id)
 *   - recipient_email → to_email
 *   - recipient_name  → template_vars.recipient_name (+ client_name alias)
 *   - email_type      → template_key (and message_type)
 *   - subject         → subject
 *   - variables       → template_vars
 *   - scheduled_at    → next_retry_at  (null/now = send immediately)
 *
 * All mutations should call these via try/catch — an email failure must
 * NEVER break an order mutation. See useOrderProcessing.ts.
 *
 * All subject lines are professional French (Bell / Rogers tone).
 */

type AnyOrder = Record<string, any> | null | undefined;
type AnyProfile = Record<string, any> | null | undefined;

interface BaseRow {
  to_email: string;
  template_key: string;
  message_type: string;
  subject: string;
  template_vars: Record<string, any>;
  event_key: string;
  idempotency_key: string;
  entity_type: "order";
  entity_id: string;
  status: "queued";
  next_retry_at: string | null;
}

/* ─── Internal helpers ─── */

function recipientEmail(order: AnyOrder, profile: AnyProfile): string {
  return (
    order?.client_email ||
    profile?.email ||
    order?.email ||
    ""
  );
}

function recipientName(order: AnyOrder, profile: AnyProfile): string {
  return (
    profile?.full_name ||
    [order?.client_first_name, order?.client_last_name].filter(Boolean).join(" ") ||
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    "Client"
  );
}

function orderId(order: AnyOrder): string {
  return order?.id || "";
}

function orderNumber(order: AnyOrder): string {
  return order?.order_number || "";
}

function nowToken(): string {
  return Date.now().toString(36);
}

function buildBase(args: {
  order: AnyOrder;
  profile: AnyProfile;
  email_type: string;
  subject: string;
  variables?: Record<string, any>;
  scheduled_at?: string | null;
  /** Optional stable suffix to make idempotency_key unique per logical event */
  idempotencySuffix?: string;
}): BaseRow {
  const { order, profile, email_type, subject, variables = {}, scheduled_at = null, idempotencySuffix } = args;
  const id = orderId(order);
  const suffix = idempotencySuffix || email_type;
  const ts = nowToken();

  const baseVars: Record<string, any> = {
    order_id: id,
    order_number: orderNumber(order),
    recipient_name: recipientName(order, profile),
    client_name: recipientName(order, profile),
    client_email: recipientEmail(order, profile),
    ...variables,
  };

  return {
    to_email: recipientEmail(order, profile),
    template_key: email_type,
    message_type: email_type,
    subject,
    template_vars: baseVars,
    event_key: `${email_type}_${id}_${ts}`,
    idempotency_key: `auto_${suffix}_${id}`,
    entity_type: "order",
    entity_id: id,
    status: "queued",
    next_retry_at: scheduled_at,
  };
}

/* ─── COMMANDE ─── */

export function orderConfirmed(order: AnyOrder, profile: AnyProfile) {
  return buildBase({
    order,
    profile,
    email_type: "order_confirmed",
    subject: `Confirmation de votre commande Nivra #${orderNumber(order)}`,
    variables: {
      total_amount: order?.total_amount ?? order?.amount_total ?? null,
    },
  });
}

export function orderModified(order: AnyOrder, profile: AnyProfile, changedFields?: Record<string, any>) {
  return buildBase({
    order,
    profile,
    email_type: "order_modified",
    subject: "Votre commande Nivra a été modifiée",
    variables: {
      changed_fields: changedFields || {},
    },
    idempotencySuffix: `order_modified_${nowToken()}`,
  });
}

export function orderCancelled(order: AnyOrder, profile: AnyProfile, reason?: string) {
  return buildBase({
    order,
    profile,
    email_type: "order_cancelled",
    subject: "Votre commande Nivra a été annulée",
    variables: { reason: reason || "" },
  });
}

/* ─── PAIEMENT ─── */

export function paymentReceipt(order: AnyOrder, profile: AnyProfile, opts: {
  amount: number;
  invoice_number?: string;
  invoice_id?: string;
  reference?: string;
  payment_method?: string;
}) {
  const amount = Number(opts.amount || 0).toFixed(2);
  return buildBase({
    order,
    profile,
    email_type: "payment_receipt",
    subject: `Reçu de paiement — ${amount} $ — Nivra`,
    variables: {
      amount: opts.amount,
      amount_formatted: `${amount} $`,
      invoice_number: opts.invoice_number || "",
      invoice_id: opts.invoice_id || "",
      reference: opts.reference || "",
      payment_method: opts.payment_method || "",
    },
    idempotencySuffix: `payment_receipt_${opts.invoice_id || nowToken()}`,
  });
}

export function paymentFailed(order: AnyOrder, profile: AnyProfile, reason?: string) {
  return buildBase({
    order,
    profile,
    email_type: "payment_failed",
    subject: "Action requise : votre paiement n'a pas été traité",
    variables: { reason: reason || "" },
    idempotencySuffix: `payment_failed_${nowToken()}`,
  });
}

/* ─── KYC ─── */

export function kycApproved(order: AnyOrder, profile: AnyProfile) {
  return buildBase({
    order,
    profile,
    email_type: "kyc_approved",
    subject: "Votre identité a été vérifiée avec succès",
  });
}

export function kycRejected(order: AnyOrder, profile: AnyProfile, reason?: string) {
  return buildBase({
    order,
    profile,
    email_type: "kyc_rejected",
    subject: "Action requise : votre document d'identité",
    variables: { reason: reason || "" },
    idempotencySuffix: `kyc_rejected_${nowToken()}`,
  });
}

export function kycDocumentRequired(order: AnyOrder, profile: AnyProfile) {
  return buildBase({
    order,
    profile,
    email_type: "kyc_document_required",
    subject: "Vérification d'identité requise pour activer votre service",
  });
}

/* ─── SIM / NUMÉRO ─── */

export function simActivated(order: AnyOrder, profile: AnyProfile, opts?: {
  phone_number?: string;
  sim_number?: string;
}) {
  return buildBase({
    order,
    profile,
    email_type: "sim_activated",
    subject: "Votre SIM Nivra est maintenant active",
    variables: {
      phone_number: opts?.phone_number || "",
      sim_number: opts?.sim_number || "",
    },
  });
}

export function esimReady(order: AnyOrder, profile: AnyProfile, opts?: {
  qr_code_url?: string;
  activation_code?: string;
  phone_number?: string;
}) {
  return buildBase({
    order,
    profile,
    email_type: "esim_ready",
    subject: "Votre eSIM est prête — QR code inclus",
    variables: {
      qr_code_url: opts?.qr_code_url || "",
      activation_code: opts?.activation_code || "",
      phone_number: opts?.phone_number || "",
    },
  });
}

export function portinInitiated(order: AnyOrder, profile: AnyProfile, opts?: {
  number_to_port?: string;
  current_carrier?: string;
}) {
  return buildBase({
    order,
    profile,
    email_type: "portin_initiated",
    subject: "Transfert de numéro en cours",
    variables: {
      number_to_port: opts?.number_to_port || "",
      current_carrier: opts?.current_carrier || "",
    },
  });
}

export function portinCompleted(order: AnyOrder, profile: AnyProfile, phoneNumber?: string) {
  return buildBase({
    order,
    profile,
    email_type: "portin_completed",
    subject: "Votre numéro a été transféré avec succès",
    variables: { phone_number: phoneNumber || "" },
  });
}

export function portinFailed(order: AnyOrder, profile: AnyProfile, reason?: string) {
  return buildBase({
    order,
    profile,
    email_type: "portin_failed",
    subject: "Problème avec le transfert de votre numéro",
    variables: { reason: reason || "" },
    idempotencySuffix: `portin_failed_${nowToken()}`,
  });
}

/* ─── INSTALLATION & RENDEZ-VOUS ─── */

function fmtDate(d?: string | null): string {
  if (!d) return "";
  try {
    return new Date(d).toLocaleDateString("fr-CA", { year: "numeric", month: "long", day: "numeric" });
  } catch {
    return String(d);
  }
}

function fmtTime(d?: string | null): string {
  if (!d) return "";
  try {
    return new Date(d).toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export function appointmentConfirmed(order: AnyOrder, profile: AnyProfile, appointment?: {
  scheduled_at?: string | null;
  technician_name?: string;
  service_address?: string;
}) {
  const date = fmtDate(appointment?.scheduled_at);
  const time = fmtTime(appointment?.scheduled_at);
  return buildBase({
    order,
    profile,
    email_type: "appointment_confirmed",
    subject: `Rendez-vous d'installation confirmé — ${date} à ${time}`,
    variables: {
      scheduled_at: appointment?.scheduled_at || null,
      date,
      time,
      technician_name: appointment?.technician_name || "",
      service_address: appointment?.service_address || "",
    },
  });
}

export function appointmentReminder24h(order: AnyOrder, profile: AnyProfile, scheduledAt: string) {
  const time = fmtTime(scheduledAt);
  const sendAt = new Date(new Date(scheduledAt).getTime() - 24 * 60 * 60 * 1000).toISOString();
  return buildBase({
    order,
    profile,
    email_type: "appointment_reminder_24h",
    subject: `Rappel : votre installation est demain à ${time}`,
    variables: {
      scheduled_at: scheduledAt,
      time,
      date: fmtDate(scheduledAt),
    },
    scheduled_at: sendAt,
    idempotencySuffix: `appt_reminder_24h_${scheduledAt}`,
  });
}

export function appointmentReminder2h(order: AnyOrder, profile: AnyProfile, scheduledAt: string) {
  const sendAt = new Date(new Date(scheduledAt).getTime() - 2 * 60 * 60 * 1000).toISOString();
  return buildBase({
    order,
    profile,
    email_type: "appointment_reminder_2h",
    subject: "Votre technicien arrive dans 2 heures",
    variables: {
      scheduled_at: scheduledAt,
      time: fmtTime(scheduledAt),
    },
    scheduled_at: sendAt,
    idempotencySuffix: `appt_reminder_2h_${scheduledAt}`,
  });
}

export function appointmentMissedByClient(order: AnyOrder, profile: AnyProfile) {
  return buildBase({
    order,
    profile,
    email_type: "appointment_missed_by_client",
    subject: "Rendez-vous manqué — reprogrammez votre installation",
    idempotencySuffix: `appt_missed_${nowToken()}`,
  });
}

export function appointmentCancelledByNivra(order: AnyOrder, profile: AnyProfile, reason?: string) {
  return buildBase({
    order,
    profile,
    email_type: "appointment_cancelled_by_nivra",
    subject: "Votre rendez-vous a été annulé — nous vous recontactons",
    variables: { reason: reason || "" },
    idempotencySuffix: `appt_cancelled_nivra_${nowToken()}`,
  });
}

export function equipmentShipped(order: AnyOrder, profile: AnyProfile, opts: {
  carrier?: string;
  tracking_number: string;
  tracking_url?: string;
}) {
  return buildBase({
    order,
    profile,
    email_type: "equipment_shipped",
    subject: `Votre équipement Nivra est en route — suivi : ${opts.tracking_number}`,
    variables: {
      carrier: opts.carrier || "",
      tracking_number: opts.tracking_number,
      tracking_url: opts.tracking_url || "",
    },
    idempotencySuffix: `equipment_shipped_${opts.tracking_number}`,
  });
}

export function equipmentDelivered(order: AnyOrder, profile: AnyProfile) {
  return buildBase({
    order,
    profile,
    email_type: "equipment_delivered",
    subject: "Votre équipement a été livré",
  });
}

/* ─── ACTIVATION ─── */

export function serviceActivated(order: AnyOrder, profile: AnyProfile) {
  return buildBase({
    order,
    profile,
    email_type: "service_activated",
    subject: "Votre service Nivra est maintenant actif",
    variables: {
      service_type: order?.service_type || "",
    },
  });
}

export function welcomeToNivra(order: AnyOrder, profile: AnyProfile) {
  return buildBase({
    order,
    profile,
    email_type: "welcome_to_nivra",
    subject: "Bienvenue chez Nivra — tout ce que vous devez savoir",
    variables: {
      service_type: order?.service_type || "",
    },
  });
}

/* ─── CONTRAT ─── */

export function contractReadyToSign(order: AnyOrder, profile: AnyProfile, opts?: {
  contract_id?: string;
  signature_url?: string;
}) {
  return buildBase({
    order,
    profile,
    email_type: "contract_ready_to_sign",
    subject: "Votre contrat est prêt à signer",
    variables: {
      contract_id: opts?.contract_id || "",
      signature_url: opts?.signature_url || "",
    },
    idempotencySuffix: `contract_ready_${opts?.contract_id || nowToken()}`,
  });
}

export function contractReminder(order: AnyOrder, profile: AnyProfile, opts?: {
  contract_id?: string;
  signature_url?: string;
}) {
  return buildBase({
    order,
    profile,
    email_type: "contract_reminder",
    subject: "Rappel : votre contrat Nivra attend votre signature",
    variables: {
      contract_id: opts?.contract_id || "",
      signature_url: opts?.signature_url || "",
    },
    idempotencySuffix: `contract_reminder_${nowToken()}`,
  });
}

export function contractSigned(order: AnyOrder, profile: AnyProfile, contractId?: string) {
  return buildBase({
    order,
    profile,
    email_type: "contract_signed",
    subject: "Contrat signé — votre copie est disponible",
    variables: { contract_id: contractId || "" },
    idempotencySuffix: `contract_signed_${contractId || nowToken()}`,
  });
}

/* ─── Aggregate export for convenience ─── */
export const orderEmails = {
  orderConfirmed,
  orderModified,
  orderCancelled,
  paymentReceipt,
  paymentFailed,
  kycApproved,
  kycRejected,
  kycDocumentRequired,
  simActivated,
  esimReady,
  portinInitiated,
  portinCompleted,
  portinFailed,
  appointmentConfirmed,
  appointmentReminder24h,
  appointmentReminder2h,
  appointmentMissedByClient,
  appointmentCancelledByNivra,
  equipmentShipped,
  equipmentDelivered,
  serviceActivated,
  welcomeToNivra,
  contractReadyToSign,
  contractReminder,
  contractSigned,
};

export default orderEmails;
