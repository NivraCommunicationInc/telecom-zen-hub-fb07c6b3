import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { sendSmsNotification, SMS_TEMPLATES, toE164, fetchClientPhone } from "../_shared/smsHelper.ts";
import { formatCurrencyForTemplate, formatDateForTemplate } from "../_shared/resendTemplates.ts";

/**
 * Send Billing Notification - Routes through email_queue for professional templates
 * 
 * Supported types:
 * - invoice_created
 * - payment_received  
 * - payment_failed
 * - invoice_overdue
 */

// Map billing event types to email_queue template keys
const BILLING_TEMPLATE_MAP: Record<string, string> = {
  invoice_created: "invoice_created",
  payment_received: "payment_received",
  payment_failed: "payment_failed",
  invoice_overdue: "invoice_overdue",
};

const handler = async (req: Request): Promise<Response> => {
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;
  
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  const requestId = crypto.randomUUID().slice(0, 8);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { 
      email, 
      name, 
      type, 
      invoiceNumber, 
      amount, 
      dueDate, 
      paidAt, 
      paymentMethod, 
      notes, 
      phone, 
      clientId 
    } = await req.json();
    
    console.log(`[${requestId}] Billing notification: type=${type}, to=${email?.substring(0, 3)}***`);

    if (!email) {
      throw new Error("Email is required");
    }

    const formatCurrency = (value: number) => formatCurrencyForTemplate(value);
    const formatDate = (dateStr: string) => formatDateForTemplate(dateStr);

    // Get the template key for this billing type
    const templateKey = BILLING_TEMPLATE_MAP[type];
    
    if (!templateKey) {
      throw new Error(`Unknown billing notification type: ${type}`);
    }

    // Create unique event key for idempotency
    const eventKey = `billing_${type}_${invoiceNumber || clientId || email}_${new Date().toISOString().split('T')[0]}`;

    // Check if this email was already queued (idempotency)
    const { data: existingEmail } = await supabase
      .from("email_queue")
      .select("id")
      .eq("event_key", eventKey)
      .maybeSingle();

    if (existingEmail) {
      console.log(`[${requestId}] Email already queued for event: ${eventKey}`);
      return new Response(JSON.stringify({ 
        success: true, 
        message: "Email already queued",
        event_key: eventKey
      }), { 
        status: 200, 
        headers: { "Content-Type": "application/json", ...corsHeaders } 
      });
    }

    // Build template variables
    const templateVars: Record<string, any> = {
      client_name: name || "Client",
      client_email: email,
      invoice_number: invoiceNumber || "",
      amount: amount || 0,
      due_date: dueDate || "",
      paid_at: paidAt || "",
      payment_method: paymentMethod || "",
    };

    // Add days overdue for overdue invoices
    if (type === "invoice_overdue" && dueDate) {
      const daysDiff = Math.floor((Date.now() - new Date(dueDate).getTime()) / (1000 * 60 * 60 * 24));
      templateVars.days_overdue = daysDiff > 0 ? daysDiff : 0;
    }

    // Queue email for processing by process-email-queue
    const { data: queuedEmail, error: queueError } = await supabase
      .from("email_queue")
      .insert({
        event_key: eventKey,
        to_email: email,
        template_key: templateKey,
        template_vars: templateVars,
        status: "queued",
        attempts: 0,
        max_attempts: 3,
      })
      .select("id")
      .single();

    if (queueError) {
      console.error(`[${requestId}] Failed to queue email:`, queueError);
      throw new Error(`Failed to queue email: ${queueError.message}`);
    }

    console.log(`[${requestId}] Email queued successfully: ${queuedEmail.id} with template: ${templateKey}`);

    // Send SMS notification (non-blocking)
    await sendBillingSms(type, phone, email, clientId, name, formatCurrency(amount), invoiceNumber, dueDate ? formatDate(dueDate) : undefined);

    return new Response(JSON.stringify({ 
      success: true, 
      email_id: queuedEmail.id,
      event_key: eventKey,
      template: templateKey,
      method: "email_queue"
    }), { 
      status: 200, 
      headers: { "Content-Type": "application/json", ...corsHeaders } 
    });

  } catch (error: any) {
    console.error(`[${requestId}] Error:`, error);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, 
      headers: { "Content-Type": "application/json", ...getCorsHeaders(req.headers.get('origin')) } 
    });
  }
};

// Helper function to send billing SMS
async function sendBillingSms(
  type: string, 
  phone: string | undefined, 
  email: string, 
  clientId: string | undefined,
  name: string,
  formattedAmount: string,
  invoiceNumber?: string,
  formattedDueDate?: string
) {
  let phoneForSms = phone;
  let clientIdForSms = clientId;

  if (!phoneForSms && email) {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (supabaseUrl && supabaseServiceKey) {
      console.log(`No phone provided, fetching from profiles...`);
      const phoneResult = await fetchClientPhone(supabaseUrl, supabaseServiceKey, email, clientId);
      phoneForSms = phoneResult.phone || undefined;
      clientIdForSms = phoneResult.clientId || clientId;
    }
  }

  if (phoneForSms && toE164(phoneForSms)) {
    const clientName = name || "Client";
    let smsMessage: string | null = null;

    switch (type) {
      case "payment_received":
        smsMessage = SMS_TEMPLATES.paymentReceived({
          clientName,
          amount: formattedAmount,
          invoiceNumber,
        });
        break;
      case "invoice_overdue":
        smsMessage = SMS_TEMPLATES.paymentOverdue({
          clientName,
          amount: formattedAmount,
          dueDate: formattedDueDate,
        });
        break;
    }

    if (smsMessage) {
      const smsResult = await sendSmsNotification({
        to: phoneForSms,
        message: smsMessage,
        clientId: clientIdForSms,
        eventType: `billing_${type}`,
        eventKey: invoiceNumber ? `billing_${invoiceNumber}_${type}` : undefined,
      });
      console.log(`Billing SMS result:`, JSON.stringify(smsResult));
    }
  }
}

serve(handler);
