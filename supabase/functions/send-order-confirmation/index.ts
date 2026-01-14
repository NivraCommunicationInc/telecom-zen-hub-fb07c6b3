import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSmsNotification, SMS_TEMPLATES, toE164 } from "../_shared/smsHelper.ts";
import { sendTemplateEmail, formatCurrencyForTemplate, EMAIL_SENDER } from "../_shared/resendTemplates.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const formatCurrency = (amount: number): string => {
  const formatted = (amount || 0).toFixed(2);
  return `${formatted}$`;
};

// Mask email for logging (privacy)
const maskEmail = (email: string): string => {
  if (!email || !email.includes("@")) return "***";
  const [local, domain] = email.split("@");
  const maskedLocal = local.length > 2 ? local.slice(0, 2) + "***" : "***";
  return `${maskedLocal}@${domain}`;
};

interface OrderConfirmationRequest {
  order_id: string;
  client_email: string;
  client_first_name?: string;
  client_phone?: string;
  client_id?: string;
  order_number: string;
  services: Array<{ name: string; price: number; period?: string }>;
  monthly_total_tax_in: number;
  one_time_total: number;
  delivery_method?: string;
  payment_reference?: string;
  force?: boolean;
}

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID();
  console.log(`[${requestId}] ========================================`);
  console.log(`[${requestId}] send-order-confirmation invoked (RESEND TEMPLATE)`);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const logResult = (status: "sent" | "skipped_already_sent" | "error", extra: Record<string, unknown> = {}) => {
    console.log(`[${requestId}] RESULT:`, JSON.stringify({ 
      request_id: requestId, 
      status, 
      ...extra 
    }));
  };

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!resendApiKey) {
      console.error(`[${requestId}] RESEND_API_KEY not configured`);
      logResult("error", { error: "RESEND_API_KEY not configured" });
      return new Response(JSON.stringify({ error: "Email service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error(`[${requestId}] Supabase credentials not configured`);
      logResult("error", { error: "Supabase credentials not configured" });
      return new Response(JSON.stringify({ error: "Database service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: OrderConfirmationRequest = await req.json();
    const {
      order_id,
      client_email,
      client_first_name,
      client_phone,
      client_id,
      order_number,
      services,
      monthly_total_tax_in,
      one_time_total,
      delivery_method,
      force = false,
    } = body;

    console.log(`[${requestId}] Request: order_id=${order_id}, order_number=${order_number}, force=${force}`);
    console.log(`[${requestId}] to_email=${maskEmail(client_email)}`);

    if (!order_id || !client_email || !order_number) {
      console.error(`[${requestId}] Missing required fields`);
      logResult("error", { error: "Missing required fields", order_id, order_number });
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch order details and do idempotency check
    const { data: orderData, error: checkError } = await supabase
      .from("orders")
      .select("confirmation_email_sent_at, client_phone, user_id")
      .eq("id", order_id)
      .single();

    if (checkError) {
      console.error(`[${requestId}] Error checking order:`, checkError);
      logResult("error", { error: "Order not found", order_id });
      return new Response(JSON.stringify({ error: "Order not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const phoneForSms = client_phone || orderData?.client_phone;
    const clientIdForSms = client_id || orderData?.user_id;

    // IDEMPOTENCY CHECK
    if (!force && orderData?.confirmation_email_sent_at) {
      console.log(`[${requestId}] Email already sent at ${orderData.confirmation_email_sent_at}`);
      logResult("skipped_already_sent", { 
        order_id, 
        order_number, 
        to_email: maskEmail(client_email),
        sent_at: orderData.confirmation_email_sent_at 
      });
      return new Response(JSON.stringify({ 
        success: true, 
        already_sent: true,
        status: "skipped_already_sent",
        sent_at: orderData.confirmation_email_sent_at,
        message: "Email already sent for this order (use force=true to resend)"
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build delivery type label
    const deliveryTypeLabel = (() => {
      switch (delivery_method) {
        case "technician": return "Installation par technicien";
        case "uber": return "Express Uber (10h)";
        case "auto": return "Auto-installation avec livraison";
        case "shipHome": return "Expédition à domicile (3-5 jours)";
        case "standard": return "Livraison standard (24-78h)";
        default: return delivery_method || "Standard";
      }
    })();

    // Build services list
    const servicesList = (services || [])
      .map(s => {
        const periodLabel = s.period === "30 jours" ? "/30 jours" : "/mois";
        return `${s.name} — ${formatCurrency(s.price)}${periodLabel}`;
      })
      .join(", ");

    const siteBaseUrl = Deno.env.get("SITE_URL") || "https://nivratelecom.ca";

    console.log(`[${requestId}] Sending order confirmation via Resend template...`);

    // Send email using Resend template
    const emailResult = await sendTemplateEmail({
      resendApiKey,
      templateKey: "order_confirmation",
      to: client_email,
      variables: {
        CLIENT_FIRST_NAME: client_first_name || "Client",
        ORDER_NUMBER: order_number,
        SERVICES_LIST: servicesList || "Services commandés",
        DELIVERY_TYPE: deliveryTypeLabel,
        MONTHLY_TOTAL: formatCurrencyForTemplate(monthly_total_tax_in),
        ONE_TIME_TOTAL: formatCurrencyForTemplate(one_time_total),
        PORTAL_LINK: `${siteBaseUrl}/portal`,
      },
    });

    if (!emailResult.success) {
      console.error(`[${requestId}] Resend error:`, emailResult.error);
      
      await supabase.from("email_queue").insert({
        event_key: `order_confirmation_${order_id}`,
        template_key: "order_confirmation",
        to_email: client_email,
        status: "failed",
        last_error: emailResult.error,
      });

      logResult("error", {
        order_id,
        order_number,
        to_email: maskEmail(client_email),
        error: emailResult.error,
      });

      return new Response(JSON.stringify({ 
        success: false, 
        status: "error",
        error: "Email sending failed",
        details: emailResult.error,
        request_id: requestId
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[${requestId}] ✅ Email sent successfully via Resend template`);
    console.log(`[${requestId}] resend_message_id=${emailResult.id}`);

    // Mark email as sent (idempotency)
    const { error: updateError } = await supabase
      .from("orders")
      .update({ confirmation_email_sent_at: new Date().toISOString() })
      .eq("id", order_id);

    if (updateError) {
      console.warn(`[${requestId}] Failed to update confirmation_email_sent_at:`, updateError);
    }

    // Log success to email_queue
    await supabase.from("email_queue").insert({
      event_key: `order_confirmation_${order_id}`,
      template_key: "order_confirmation",
      to_email: client_email,
      status: "sent",
      sent_at: new Date().toISOString(),
      provider_message_id: emailResult.id || null,
    });

    logResult("sent", {
      order_id,
      order_number,
      to_email: maskEmail(client_email),
      method: "resend_template",
      resend_message_id: emailResult.id,
      forced: force,
    });

    // Send SMS notification (non-blocking)
    if (phoneForSms && toE164(phoneForSms)) {
      console.log(`[${requestId}] Sending SMS notification...`);
      const smsResult = await sendSmsNotification({
        to: phoneForSms,
        message: SMS_TEMPLATES.orderConfirmation({
          orderNumber: order_number,
          clientName: client_first_name || "Client",
          monthlyTotal: formatCurrency(monthly_total_tax_in),
        }),
        clientId: clientIdForSms,
        eventType: "order_confirmation",
        eventKey: `order_confirmation_${order_id}`,
      });
      console.log(`[${requestId}] SMS result:`, JSON.stringify(smsResult));
    }

    console.log(`[${requestId}] ========================================`);
    
    return new Response(JSON.stringify({ 
      success: true, 
      status: "sent",
      message_id: emailResult.id,
      order_number,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error(`[${requestId}] Exception:`, error);
    logResult("error", { error: (error as Error)?.message });
    return new Response(JSON.stringify({ 
      error: "An unexpected error occurred",
      request_id: requestId 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
