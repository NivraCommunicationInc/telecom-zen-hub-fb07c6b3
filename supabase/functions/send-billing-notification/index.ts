import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { sendSmsNotification, SMS_TEMPLATES, toE164, fetchClientPhone } from "../_shared/smsHelper.ts";
import { 
  sendTemplateEmail, 
  formatCurrencyForTemplate,
  formatDateForTemplate,
  hasTemplate,
  type ResendTemplateKey
} from "../_shared/resendTemplates.ts";

// Map billing event types to Resend template keys
const BILLING_TEMPLATE_MAP: Record<string, ResendTemplateKey> = {
  invoice_created: "invoice_created",
  payment_received: "payment_receipt",
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
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) throw new Error("RESEND_API_KEY not configured");

    const { email, name, type, invoiceNumber, amount, dueDate, paidAt, paymentMethod, notes, phone, clientId } = await req.json();
    
    console.log(`[${requestId}] Billing notification: type=${type}, to=${email?.substring(0, 3)}***`);

    const formatCurrency = (value: number) => formatCurrencyForTemplate(value);
    const formatDate = (dateStr: string) => formatDateForTemplate(dateStr);

    const siteBaseUrl = Deno.env.get("SITE_URL") || "https://nivratelecom.ca";
    const portalUrl = `${siteBaseUrl}/portal`;

    // Check if we have a Resend template for this type
    const templateKey = BILLING_TEMPLATE_MAP[type];
    
    if (templateKey && hasTemplate(templateKey)) {
      // Use Resend template
      const variables: Record<string, string | number | undefined> = {
        CLIENT_FIRST_NAME: name?.split(" ")[0] || "Client",
        CLIENT_NAME: name || "Client",
        INVOICE_NUMBER: invoiceNumber || "",
        AMOUNT: formatCurrency(amount),
        DUE_DATE: dueDate ? formatDate(dueDate) : "",
        PAYMENT_DATE: paidAt ? formatDate(paidAt) : "",
        PAYMENT_METHOD: paymentMethod || "",
        PORTAL_LINK: portalUrl,
      };

      // Add type-specific variables
      if (type === "invoice_overdue" && dueDate) {
        const daysDiff = Math.floor((Date.now() - new Date(dueDate).getTime()) / (1000 * 60 * 60 * 24));
        variables.DAYS_OVERDUE = daysDiff > 0 ? String(daysDiff) : "0";
      }

      const result = await sendTemplateEmail({
        resendApiKey,
        templateKey,
        to: email,
        variables,
      });

      if (!result.success) {
        throw new Error(result.error || "Failed to send email");
      }

      console.log(`[${requestId}] Email sent via Resend template: ${templateKey}`);

      // Send SMS notification (non-blocking)
      await sendBillingSms(type, phone, email, clientId, name, formatCurrency(amount), invoiceNumber, dueDate ? formatDate(dueDate) : undefined);

      return new Response(JSON.stringify({ 
        success: true, 
        result: { id: result.id },
        method: "resend_template",
        template: templateKey
      }), { 
        status: 200, 
        headers: { "Content-Type": "application/json", ...corsHeaders } 
      });
    }

    // Fallback to hardcoded HTML for unmapped types
    console.log(`[${requestId}] No template for type=${type}, using hardcoded HTML`);
    
    const typeConfigs: Record<string, any> = {
      invoice_created: { subject: `Nouvelle facture ${invoiceNumber || ""} - Nivra`, heading: "Nouvelle facture créée", message: "Une nouvelle facture a été créée pour votre compte.", color: "#0891b2", icon: "📄" },
      payment_received: { subject: "Confirmation de paiement - Nivra", heading: "Paiement reçu avec succès!", message: "Nous avons bien reçu votre paiement. Merci!", color: "#10b981", icon: "✅" },
      payment_failed: { subject: "Échec du paiement - Nivra", heading: "Paiement non réussi", message: "Votre paiement n'a pas pu être traité.", color: "#ef4444", icon: "❌" },
      invoice_overdue: { subject: "Facture en retard - Nivra", heading: "Rappel de paiement", message: "Votre facture est maintenant en retard.", color: "#f59e0b", icon: "⚠️" },
    };

    const config = typeConfigs[type] || typeConfigs.invoice_created;
    let detailsHtml = invoiceNumber ? `<p><strong>Facture:</strong> ${invoiceNumber}</p>` : "";
    detailsHtml += `<p><strong>Montant:</strong> ${formatCurrency(amount)}</p>`;
    if (dueDate) detailsHtml += `<p><strong>Échéance:</strong> ${formatDate(dueDate)}</p>`;
    if (paidAt) detailsHtml += `<p><strong>Payé le:</strong> ${formatDate(paidAt)}</p>`;

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendApiKey}` },
      body: JSON.stringify({
        from: "Nivra Telecom <support@nivratelecom.ca>",
        reply_to: "support@nivratelecom.ca",
        to: [email],
        subject: config.subject,
        html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;"><div style="background: linear-gradient(135deg, #0891b2, #06b6d4); padding: 30px; text-align: center;"><h1 style="color: white;">Nivra Telecom</h1><p style="color: rgba(255,255,255,0.9); margin: 4px 0 0;">Votre service, simplifié.</p></div><div style="padding: 30px; background: #f8fafc;"><h2>Bonjour ${name || "cher client"},</h2><div style="background: ${config.color}20; border-left: 4px solid ${config.color}; padding: 15px; margin: 20px 0;"><h3 style="color: ${config.color};">${config.icon} ${config.heading}</h3><p>${config.message}</p></div><div style="background: white; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0;">${detailsHtml}</div><p>L'équipe Nivra</p></div><div style="padding: 24px 30px; background: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;"><p style="margin: 0 0 6px; font-size: 13px; font-weight: 600; color: #18181b;">Nivra Telecom</p><p style="margin: 0 0 6px; font-size: 12px; color: #71717a;">Laval, QC, Canada</p><p style="margin: 0 0 12px; font-size: 13px; color: #52525b;"><a href="mailto:support@nivratelecom.ca" style="color: #0d9488; text-decoration: none;">Support@nivratelecom.ca</a> | <a href="tel:4385442233" style="color: #0d9488; text-decoration: none;">438-544-2233</a></p><p style="margin: 0; font-size: 11px; color: #71717a;">Vous recevez cet email suite à une action sur votre compte Nivra Telecom.<br><em>You are receiving this email because of an action on your Nivra Telecom account.</em></p></div></div>`,
      }),
    });

    const result = await emailResponse.json();
    if (!emailResponse.ok) throw new Error(result.message);

    // Send SMS notification (non-blocking)
    await sendBillingSms(type, phone, email, clientId, name, formatCurrency(amount), invoiceNumber, dueDate ? formatDate(dueDate) : undefined);

    return new Response(JSON.stringify({ 
      success: true, 
      result,
      method: "hardcoded_html"
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
