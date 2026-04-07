import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { sendSmsNotification, SMS_TEMPLATES, toE164, fetchClientPhone } from "../_shared/smsHelper.ts";
import { formatCurrencyForTemplate, formatDateForTemplate } from "../_shared/resendTemplates.ts";
import { queueRenderedEmail } from "../_shared/templateRenderer.ts";

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
    
    if (!supabaseUrl || !supabaseServiceKey) throw new Error("Missing Supabase configuration");

    const { email, name, type, invoiceNumber, amount, dueDate, paidAt, paymentMethod, notes, phone, clientId } = await req.json();
    
    console.log(`[${requestId}] Billing notification: type=${type}, to=${email?.substring(0, 3)}***`);
    if (!email) throw new Error("Email is required");

    const templateKey = BILLING_TEMPLATE_MAP[type];
    if (!templateKey) throw new Error(`Unknown billing notification type: ${type}`);

    const eventKey = `billing_${type}_${invoiceNumber || clientId || email}_${new Date().toISOString().split('T')[0]}`;

    const templateVars: Record<string, any> = {
      client_name: name || "Client",
      client_email: email,
      invoice_number: invoiceNumber || "",
      amount: amount || 0,
      due_date: dueDate || "",
      paid_at: paidAt || "",
      payment_method: paymentMethod || "",
    };

    if (type === "invoice_overdue" && dueDate) {
      const daysDiff = Math.floor((Date.now() - new Date(dueDate).getTime()) / (1000 * 60 * 60 * 24));
      templateVars.days_overdue = daysDiff > 0 ? daysDiff : 0;
    }

    const result = await queueRenderedEmail({ eventKey, templateKey, toEmail: email, templateVars });

    console.log(`[${requestId}] Email ${result.alreadyQueued ? "already queued" : "queued"} template: ${templateKey}`);

    // SMS
    await sendBillingSms(type, phone, email, clientId, name, formatCurrencyForTemplate(amount || 0), invoiceNumber, dueDate ? formatDateForTemplate(dueDate) : undefined);

    return new Response(JSON.stringify({ success: true, event_key: eventKey, template: templateKey, method: "pgmq" }), { 
      status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } 
    });
  } catch (error: any) {
    console.error(`[${requestId}] Error:`, error);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, headers: { "Content-Type": "application/json", ...getCorsHeaders(req.headers.get('origin')) } 
    });
  }
};

async function sendBillingSms(type: string, phone: string | undefined, email: string, clientId: string | undefined, name: string, formattedAmount: string, invoiceNumber?: string, formattedDueDate?: string) {
  let phoneForSms = phone;
  let clientIdForSms = clientId;

  if (!phoneForSms && email) {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (supabaseUrl && supabaseServiceKey) {
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
        smsMessage = SMS_TEMPLATES.paymentReceived({ clientName, amount: formattedAmount, invoiceNumber });
        break;
      case "invoice_overdue":
        smsMessage = SMS_TEMPLATES.paymentOverdue({ clientName, amount: formattedAmount, dueDate: formattedDueDate });
        break;
    }
    if (smsMessage) {
      await sendSmsNotification({ to: phoneForSms, message: smsMessage, clientId: clientIdForSms, eventType: `billing_${type}`, eventKey: invoiceNumber ? `billing_${invoiceNumber}_${type}` : undefined });
    }
  }
}

serve(handler);
