/**
 * Resend Email Templates Configuration
 * Maps internal template keys to Resend template slugs
 */

// Template mapping - internal key => Resend template slug
export const RESEND_TEMPLATES = {
  // Appointments
  appointment_scheduled: "appointment_scheduled_fr",
  
  // Contracts
  contract_signed: "contract_signed_fr",
  
  // Account/Access
  account_blocked: "account_blocked_fr",
  online_access_blocked: "online_access_blocked_fr",
  online_account_blocked: "online_account_blocked_fr",
  account_created: "account_created_fr",
  
  // Service Cancellations
  service_cancellation_requested: "service_cancellation_requested_fr",
  service_cancellation_request: "service_cancellation_request_fr",
  service_cancellation: "service_cancellation_f",
  service_cancelled_90_days: "service_cancelled_90_days_fr",
  
  // SIM/Mobile
  sim_lost: "sim_lost_fr",
  sim_lost_replacement: "sim_lost_replacement_fr",
  
  // Payments
  payment_contested: "payment_contested_fr",
  payment_declined: "nivra_payment_declined_fr",
  payment_failed: "nivra_payment_failed_fr-1",
  payment_verification: "nivra_payment_verification_fr",
  payment_receipt: "nivra_payment_receipt_fr",
  
  // Tickets
  ticket_created: "ticket_created_fr",
  ticket_creation_confirmation: "ticket-creation-confirmation",
  
  // Channel/Plan Changes
  channels_change_requested: "channels_change_requested_fr",
  plan_change_requested: "plan_change_requested_fr",
  
  // Orders
  order_confirmation: "nivra_order_confirmation_fr-1",
  order_processing: "nivra_order_processing_fr",
  order_in_progress: "nivra_order_in_progress_fr",
  order_completed: "nivra_order_completed_fr",
  order_cancelled: "nivra_order_cancelled_fr",
  
  // Auth/Account
  password_reset: "nivra_password_reset_fr",
  email_verification: "nivra_email_verification_fr",
  
  // Billing/Invoices
  invoice_created: "nivra_invoice_created_fr",
  invoice_reminder: "nivra_invoice_reminder_fr",
  invoice_overdue: "nivra_invoice_overdue_fr",
  
  // Refunds
  refund_processed: "nivra_refund_processed_fr",
} as const;

export type ResendTemplateKey = keyof typeof RESEND_TEMPLATES;

// Default sender configuration
export const EMAIL_SENDER = {
  from: "Nivra Télécom <Support@nivra-telecom.ca>",
  replyTo: "Support@nivra-telecom.ca",
};

/**
 * Get Resend template slug by internal key
 */
export function getTemplateSlug(key: ResendTemplateKey): string {
  return RESEND_TEMPLATES[key];
}

/**
 * Check if a template key exists
 */
export function hasTemplate(key: string): key is ResendTemplateKey {
  return key in RESEND_TEMPLATES;
}

/**
 * Send email using Resend template
 * Uses template slug (name) instead of template ID
 */
export async function sendTemplateEmail(params: {
  resendApiKey: string;
  templateKey: ResendTemplateKey;
  to: string | string[];
  variables: Record<string, string | number | undefined>;
  subject?: string; // Optional override
}): Promise<{ success: boolean; id?: string; error?: string }> {
  const { resendApiKey, templateKey, to, variables, subject } = params;
  
  const templateSlug = getTemplateSlug(templateKey);
  const toAddresses = Array.isArray(to) ? to : [to];
  
  console.log(`[sendTemplateEmail] Sending template "${templateSlug}" to ${toAddresses.length} recipient(s)`);
  console.log(`[sendTemplateEmail] Variables:`, JSON.stringify(variables));
  
  try {
    // Clean variables - remove undefined values and ensure proper types
    const cleanVariables: Record<string, string | number> = {};
    for (const [key, value] of Object.entries(variables)) {
      if (value !== undefined && value !== null) {
        cleanVariables[key] = value;
      }
    }
    
    // Build request payload - Resend API 2025 format
    // template must be an object with id (slug/UUID) and variables
    const payload: Record<string, unknown> = {
      from: EMAIL_SENDER.from,
      reply_to: EMAIL_SENDER.replyTo,
      to: toAddresses,
      template: {
        id: templateSlug,
        variables: cleanVariables,
      },
    };
    
    // Only add subject if explicitly provided (otherwise Resend uses template subject)
    if (subject) {
      payload.subject = subject;
    }
    
    console.log(`[sendTemplateEmail] Request payload:`, JSON.stringify(payload));
    
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error(`[sendTemplateEmail] Resend API error:`, JSON.stringify(result));
      return { 
        success: false, 
        error: result.message || result.error || JSON.stringify(result) 
      };
    }

    console.log(`[sendTemplateEmail] Email sent successfully: ${result.id}`);
    return { success: true, id: result.id };
    
  } catch (error) {
    console.error(`[sendTemplateEmail] Exception:`, error);
    return { 
      success: false, 
      error: (error as Error)?.message || "Failed to send email" 
    };
  }
}

/**
 * Variable mappings for each template type
 * These define what variables each template expects
 */
export const TEMPLATE_VARIABLES = {
  appointment_scheduled: {
    required: ["CLIENT_FIRST_NAME", "APPOINTMENT_DATE", "APPOINTMENT_TIME"],
    optional: ["APPOINTMENT_TYPE", "ORDER_NUMBER", "APPOINTMENT_ADDRESS_LINE1", "APPOINTMENT_ADDRESS_LINE2", "APPOINTMENT_INSTRUCTIONS", "PORTAL_LINK", "RESCHEDULE_LINK"],
  },
  order_confirmation: {
    required: ["CLIENT_FIRST_NAME", "ORDER_NUMBER"],
    optional: ["SERVICES_LIST", "DELIVERY_TYPE", "MONTHLY_TOTAL", "ONE_TIME_TOTAL", "PORTAL_LINK"],
  },
  invoice_created: {
    required: ["CLIENT_FIRST_NAME", "INVOICE_NUMBER", "AMOUNT"],
    optional: ["DUE_DATE", "PORTAL_LINK"],
  },
  invoice_overdue: {
    required: ["CLIENT_FIRST_NAME", "INVOICE_NUMBER", "AMOUNT", "DUE_DATE"],
    optional: ["DAYS_OVERDUE", "PORTAL_LINK"],
  },
  payment_receipt: {
    required: ["CLIENT_FIRST_NAME", "AMOUNT", "PAYMENT_DATE"],
    optional: ["INVOICE_NUMBER", "PAYMENT_METHOD", "PORTAL_LINK"],
  },
  ticket_created: {
    required: ["CLIENT_FIRST_NAME", "TICKET_NUMBER", "SUBJECT"],
    optional: ["PORTAL_LINK"],
  },
  account_created: {
    required: ["CLIENT_FIRST_NAME"],
    optional: ["PORTAL_LINK", "EMAIL"],
  },
  // Add more as needed...
} as const;

/**
 * Helper to format currency for templates
 */
export function formatCurrencyForTemplate(amount: number): string {
  return new Intl.NumberFormat("fr-CA", { 
    style: "currency", 
    currency: "CAD" 
  }).format(amount);
}

/**
 * Helper to format date for templates
 */
export function formatDateForTemplate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("fr-CA", { dateStyle: "long" });
}

/**
 * Helper to format datetime for templates
 */
export function formatDateTimeForTemplate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("fr-CA", { 
    dateStyle: "long", 
    timeStyle: "short" 
  });
}
