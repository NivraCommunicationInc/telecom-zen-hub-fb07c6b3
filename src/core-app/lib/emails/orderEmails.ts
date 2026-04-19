/**
 * orderEmails.ts — Email factory functions for order processing triggers.
 *
 * Each function returns a row object ready to insert into `email_queue`.
 *
 * IMPORTANT — Template alignment with Resend registry:
 *   Every `template_key` below MUST exist in
 *   supabase/functions/_shared/resendTemplates.ts → RESEND_TEMPLATES.
 *   Variables use UPPERCASE names because Resend templates expect them
 *   in that format (CLIENT_FIRST_NAME, ORDER_NUMBER, AMOUNT, etc.).
 *
 *   Triggers that have NO matching Resend template fall back to
 *   `custom_html` and are clearly tagged with `__needs_template: true`
 *   in template_vars so we can list them later.
 *
 * Email failures must NEVER break order mutations — callers must use
 * try/catch independently. See useOrderProcessing.ts.
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

function firstName(order: AnyOrder, profile: AnyProfile): string {
  return (
    order?.client_first_name ||
    profile?.first_name ||
    (profile?.full_name ? String(profile.full_name).split(" ")[0] : "") ||
    "Client"
  );
}

function fullName(order: AnyOrder, profile: AnyProfile): string {
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

function portalLink(): string {
  return "https://nivra-telecom.ca/portal";
}

interface BuildArgs {
  order: AnyOrder;
  profile: AnyProfile;
  /** MUST be a key registered in RESEND_TEMPLATES */
  template_key: string;
  message_type: string;
  subject: string;
  variables?: Record<string, any>;
  scheduled_at?: string | null;
  idempotencySuffix?: string;
  /** True when no matching Resend template exists yet — falls back to custom_html */
  needsTemplate?: boolean;
}

function buildBase(args: BuildArgs): BaseRow {
  const {
    order, profile, template_key, message_type, subject,
    variables = {}, scheduled_at = null, idempotencySuffix, needsTemplate,
  } = args;
  const id = orderId(order);
  const suffix = idempotencySuffix || message_type;
  const ts = nowToken();

  const baseVars: Record<string, any> = {
    // Standard Resend template variables (UPPERCASE)
    CLIENT_FIRST_NAME: firstName(order, profile),
    CLIENT_FULL_NAME: fullName(order, profile),
    ORDER_NUMBER: orderNumber(order),
    PORTAL_LINK: portalLink(),
    ...variables,
  };

  if (needsTemplate) {
    baseVars.__needs_template = true;
  }

  return {
    to_email: recipientEmail(order, profile),
    template_key, // MUST exist in RESEND_TEMPLATES (or 'custom_html' fallback)
    message_type,
    subject,
    template_vars: baseVars,
    event_key: `${message_type}_${id}_${ts}`,
    idempotency_key: `auto_${suffix}_${id}`,
    entity_type: "order",
    entity_id: id,
    status: "queued",
    next_retry_at: scheduled_at,
  };
}

/* ─── COMMANDE ─── */

// Maps to RESEND_TEMPLATES.order_confirmation → "nivra_order_confirmation_fr-1"
export function orderConfirmed(order: AnyOrder, profile: AnyProfile) {
  return buildBase({
    order, profile,
    template_key: "order_confirmation",
    message_type: "order_confirmed",
    subject: `Confirmation de votre commande Nivra #${orderNumber(order)}`,
    variables: {
      MONTHLY_TOTAL: order?.monthly_total ?? null,
      ONE_TIME_TOTAL: order?.total_amount ?? order?.amount_total ?? null,
    },
  });
}

// No exact "order_modified" template — use custom_html fallback for now
export function orderModified(order: AnyOrder, profile: AnyProfile, changedFields?: Record<string, any>) {
  return buildBase({
    order, profile,
    template_key: "custom_html",
    message_type: "order_modified",
    subject: "Votre commande Nivra a été modifiée",
    variables: { CHANGED_FIELDS: changedFields || {} },
    idempotencySuffix: `order_modified_${nowToken()}`,
    needsTemplate: true,
  });
}

// Maps to RESEND_TEMPLATES.order_cancelled → "nivra_order_cancelled_fr"
export function orderCancelled(order: AnyOrder, profile: AnyProfile, reason?: string) {
  return buildBase({
    order, profile,
    template_key: "order_cancelled",
    message_type: "order_cancelled",
    subject: "Votre commande Nivra a été annulée",
    variables: { REASON: reason || "" },
  });
}

/* ─── PAIEMENT ─── */

// Maps to RESEND_TEMPLATES.payment_receipt → "nivra_payment_receipt_fr"
export function paymentReceipt(order: AnyOrder, profile: AnyProfile, opts: {
  amount: number;
  invoice_number?: string;
  invoice_id?: string;
  reference?: string;
  payment_method?: string;
  payment_date?: string;
}) {
  const amount = Number(opts.amount || 0).toFixed(2);
  return buildBase({
    order, profile,
    template_key: "payment_receipt",
    message_type: "payment_receipt",
    subject: `Reçu de paiement — ${amount} $ — Nivra`,
    variables: {
      AMOUNT: `${amount} $`,
      PAYMENT_DATE: opts.payment_date || new Date().toLocaleDateString("fr-CA"),
      INVOICE_NUMBER: opts.invoice_number || "",
      PAYMENT_METHOD: opts.payment_method || "",
    },
    idempotencySuffix: `payment_receipt_${opts.invoice_id || nowToken()}`,
  });
}

// Maps to RESEND_TEMPLATES.payment_failed → "nivra_payment_failed_fr-1"
export function paymentFailed(order: AnyOrder, profile: AnyProfile, reason?: string) {
  return buildBase({
    order, profile,
    template_key: "payment_failed",
    message_type: "payment_failed",
    subject: "Action requise : votre paiement n'a pas été traité",
    variables: { REASON: reason || "" },
    idempotencySuffix: `payment_failed_${nowToken()}`,
  });
}

/* ─── KYC ─── */

// Maps to RESEND_TEMPLATES.identity_verified → "identity_verified_fr"
export function kycApproved(order: AnyOrder, profile: AnyProfile) {
  return buildBase({
    order, profile,
    template_key: "identity_verified",
    message_type: "kyc_approved",
    subject: "Votre identité a été vérifiée avec succès",
  });
}

// Maps to RESEND_TEMPLATES.identity_rejected → "identity_rejected_fr"
export function kycRejected(order: AnyOrder, profile: AnyProfile, reason?: string) {
  return buildBase({
    order, profile,
    template_key: "identity_rejected",
    message_type: "kyc_rejected",
    subject: "Action requise : votre document d'identité",
    variables: { REASON: reason || "" },
    idempotencySuffix: `kyc_rejected_${nowToken()}`,
  });
}

// Maps to RESEND_TEMPLATES.identity_verification_requested
export function kycDocumentRequired(order: AnyOrder, profile: AnyProfile) {
  return buildBase({
    order, profile,
    template_key: "identity_verification_requested",
    message_type: "kyc_document_required",
    subject: "Vérification d'identité requise pour activer votre service",
  });
}

/* ─── SIM / NUMÉRO — no matching templates yet, fallback to custom_html ─── */

export function simActivated(order: AnyOrder, profile: AnyProfile, opts?: {
  phone_number?: string;
  sim_number?: string;
}) {
  return buildBase({
    order, profile,
    template_key: "service_activated", // closest match
    message_type: "sim_activated",
    subject: "Votre SIM Nivra est maintenant active",
    variables: {
      PHONE_NUMBER: opts?.phone_number || "",
      SIM_NUMBER: opts?.sim_number || "",
    },
  });
}

export function esimReady(order: AnyOrder, profile: AnyProfile, opts?: {
  qr_code_url?: string;
  activation_code?: string;
  phone_number?: string;
}) {
  return buildBase({
    order, profile,
    template_key: "custom_html",
    message_type: "esim_ready",
    subject: "Votre eSIM est prête — QR code inclus",
    variables: {
      QR_CODE_URL: opts?.qr_code_url || "",
      ACTIVATION_CODE: opts?.activation_code || "",
      PHONE_NUMBER: opts?.phone_number || "",
    },
    needsTemplate: true,
  });
}

export function portinInitiated(order: AnyOrder, profile: AnyProfile, opts?: {
  number_to_port?: string;
  current_carrier?: string;
}) {
  return buildBase({
    order, profile,
    template_key: "custom_html",
    message_type: "portin_initiated",
    subject: "Transfert de numéro en cours",
    variables: {
      NUMBER_TO_PORT: opts?.number_to_port || "",
      CURRENT_CARRIER: opts?.current_carrier || "",
    },
    needsTemplate: true,
  });
}

export function portinCompleted(order: AnyOrder, profile: AnyProfile, phoneNumber?: string) {
  return buildBase({
    order, profile,
    template_key: "custom_html",
    message_type: "portin_completed",
    subject: "Votre numéro a été transféré avec succès",
    variables: { PHONE_NUMBER: phoneNumber || "" },
    needsTemplate: true,
  });
}

export function portinFailed(order: AnyOrder, profile: AnyProfile, reason?: string) {
  return buildBase({
    order, profile,
    template_key: "custom_html",
    message_type: "portin_failed",
    subject: "Problème avec le transfert de votre numéro",
    variables: { REASON: reason || "" },
    idempotencySuffix: `portin_failed_${nowToken()}`,
    needsTemplate: true,
  });
}

/* ─── INSTALLATION & RENDEZ-VOUS ─── */

function fmtDate(d?: string | null): string {
  if (!d) return "";
  try {
    return new Date(d).toLocaleDateString("fr-CA", { year: "numeric", month: "long", day: "numeric" });
  } catch { return String(d); }
}
function fmtTime(d?: string | null): string {
  if (!d) return "";
  try {
    return new Date(d).toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
}

// Maps to RESEND_TEMPLATES.appointment_scheduled → "appointment_scheduled_fr"
export function appointmentConfirmed(order: AnyOrder, profile: AnyProfile, appointment?: {
  scheduled_at?: string | null;
  technician_name?: string;
  service_address?: string;
}) {
  const date = fmtDate(appointment?.scheduled_at);
  const time = fmtTime(appointment?.scheduled_at);
  return buildBase({
    order, profile,
    template_key: "appointment_scheduled",
    message_type: "appointment_confirmed",
    subject: `Rendez-vous d'installation confirmé — ${date} à ${time}`,
    variables: {
      APPOINTMENT_DATE: date,
      APPOINTMENT_TIME: time,
      APPOINTMENT_TYPE: "Installation",
      APPOINTMENT_ADDRESS_LINE1: appointment?.service_address || "",
      TECHNICIAN_NAME: appointment?.technician_name || "",
    },
  });
}

// Maps to RESEND_TEMPLATES.appointment_reminder → "appointment_reminder_fr"
export function appointmentReminder24h(order: AnyOrder, profile: AnyProfile, scheduledAt: string) {
  const time = fmtTime(scheduledAt);
  const sendAt = new Date(new Date(scheduledAt).getTime() - 24 * 60 * 60 * 1000).toISOString();
  return buildBase({
    order, profile,
    template_key: "appointment_reminder",
    message_type: "appointment_reminder_24h",
    subject: `Rappel : votre installation est demain à ${time}`,
    variables: {
      APPOINTMENT_DATE: fmtDate(scheduledAt),
      APPOINTMENT_TIME: time,
      WINDOW: "24h",
    },
    scheduled_at: sendAt,
    idempotencySuffix: `appt_reminder_24h_${scheduledAt}`,
  });
}

// Maps to RESEND_TEMPLATES.technician_on_the_way → "technician_on_the_way_fr"
export function appointmentReminder2h(order: AnyOrder, profile: AnyProfile, scheduledAt: string) {
  const sendAt = new Date(new Date(scheduledAt).getTime() - 2 * 60 * 60 * 1000).toISOString();
  return buildBase({
    order, profile,
    template_key: "technician_on_the_way",
    message_type: "appointment_reminder_2h",
    subject: "Votre technicien arrive dans 2 heures",
    variables: {
      APPOINTMENT_TIME: fmtTime(scheduledAt),
    },
    scheduled_at: sendAt,
    idempotencySuffix: `appt_reminder_2h_${scheduledAt}`,
  });
}

export function appointmentMissedByClient(order: AnyOrder, profile: AnyProfile) {
  return buildBase({
    order, profile,
    template_key: "custom_html",
    message_type: "appointment_missed_by_client",
    subject: "Rendez-vous manqué — reprogrammez votre installation",
    idempotencySuffix: `appt_missed_${nowToken()}`,
    needsTemplate: true,
  });
}

export function appointmentCancelledByNivra(order: AnyOrder, profile: AnyProfile, reason?: string) {
  return buildBase({
    order, profile,
    template_key: "custom_html",
    message_type: "appointment_cancelled_by_nivra",
    subject: "Votre rendez-vous a été annulé — nous vous recontactons",
    variables: { REASON: reason || "" },
    idempotencySuffix: `appt_cancelled_nivra_${nowToken()}`,
    needsTemplate: true,
  });
}

// No "equipment_shipped" template — use order_processing as closest, fallback flagged
export function equipmentShipped(order: AnyOrder, profile: AnyProfile, opts: {
  carrier?: string;
  tracking_number: string;
  tracking_url?: string;
}) {
  return buildBase({
    order, profile,
    template_key: "order_processing",
    message_type: "equipment_shipped",
    subject: `Votre équipement Nivra est en route — suivi : ${opts.tracking_number}`,
    variables: {
      CARRIER: opts.carrier || "",
      TRACKING_NUMBER: opts.tracking_number,
      TRACKING_URL: opts.tracking_url || "",
    },
    idempotencySuffix: `equipment_shipped_${opts.tracking_number}`,
  });
}

export function equipmentDelivered(order: AnyOrder, profile: AnyProfile) {
  return buildBase({
    order, profile,
    template_key: "custom_html",
    message_type: "equipment_delivered",
    subject: "Votre équipement a été livré",
    needsTemplate: true,
  });
}

/* ─── ACTIVATION ─── */

// Maps to RESEND_TEMPLATES.service_activated → "service_activated_fr"
export function serviceActivated(order: AnyOrder, profile: AnyProfile, opts?: {
  phone_number?: string | null;
  iccid?: string | null;
  carrier?: string | null;
  plan?: string | null;
}) {
  return buildBase({
    order, profile,
    template_key: "service_activated",
    message_type: "service_activated",
    subject: "Votre service Nivra est maintenant actif",
    variables: {
      SERVICE_TYPE: order?.service_type || "",
      service_type: order?.service_type || "",
      service: opts?.plan || order?.service_type || "",
      phone_number: opts?.phone_number || "",
      iccid: opts?.iccid || "",
      carrier: opts?.carrier || "",
      plan: opts?.plan || order?.service_type || "",
    },
  });
}


// No dedicated welcome template — fallback. account_created exists but is signup-specific.
export function welcomeToNivra(order: AnyOrder, profile: AnyProfile) {
  return buildBase({
    order, profile,
    template_key: "account_created",
    message_type: "welcome_to_nivra",
    subject: "Bienvenue chez Nivra — tout ce que vous devez savoir",
    variables: {
      EMAIL: recipientEmail(order, profile),
    },
  });
}

/* ─── CONTRAT ─── */

// No "contract_ready_to_sign" — use custom_html
export function contractReadyToSign(order: AnyOrder, profile: AnyProfile, opts?: {
  contract_id?: string;
  signature_url?: string;
}) {
  return buildBase({
    order, profile,
    template_key: "custom_html",
    message_type: "contract_ready_to_sign",
    subject: "Votre contrat est prêt à signer",
    variables: {
      CONTRACT_ID: opts?.contract_id || "",
      SIGNATURE_URL: opts?.signature_url || "",
    },
    idempotencySuffix: `contract_ready_${opts?.contract_id || nowToken()}`,
    needsTemplate: true,
  });
}

export function contractReminder(order: AnyOrder, profile: AnyProfile, opts?: {
  contract_id?: string;
  signature_url?: string;
}) {
  return buildBase({
    order, profile,
    template_key: "custom_html",
    message_type: "contract_reminder",
    subject: "Rappel : votre contrat Nivra attend votre signature",
    variables: {
      CONTRACT_ID: opts?.contract_id || "",
      SIGNATURE_URL: opts?.signature_url || "",
    },
    idempotencySuffix: `contract_reminder_${nowToken()}`,
    needsTemplate: true,
  });
}

// Maps to RESEND_TEMPLATES.contract_signed → "contract_signed_fr"
export function contractSigned(order: AnyOrder, profile: AnyProfile, contractId?: string) {
  return buildBase({
    order, profile,
    template_key: "contract_signed",
    message_type: "contract_signed",
    subject: "Contrat signé — votre copie est disponible",
    variables: { CONTRACT_ID: contractId || "" },
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
