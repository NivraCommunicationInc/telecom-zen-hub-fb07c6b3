import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

const handler = async (req: Request): Promise<Response> => {
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;
  
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) throw new Error("RESEND_API_KEY not configured");

    const { email, name, type, invoiceNumber, amount, dueDate, paidAt, paymentMethod, notes } = await req.json();
    
    const formatCurrency = (value: number) => new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(value);
    const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString("fr-CA", { dateStyle: "long" });

    const typeConfigs: Record<string, any> = {
      invoice_created: { subject: `Nouvelle facture ${invoiceNumber || ""} - Nivra`, heading: "Nouvelle facture créée", message: "Une nouvelle facture a été créée pour votre compte.", color: "#0891b2", icon: "📄" },
      payment_received: { subject: "Confirmation de paiement - Nivra", heading: "Paiement reçu avec succès!", message: "Nous avons bien reçu votre paiement. Merci!", color: "#10b981", icon: "✅" },
      payment_failed: { subject: "Échec du paiement - Nivra", heading: "Paiement non réussi", message: "Votre paiement n'a pas pu être traité.", color: "#ef4444", icon: "❌" },
      invoice_overdue: { subject: "Facture en retard - Nivra", heading: "Rappel de paiement", message: "Votre facture est maintenant en retard.", color: "#f59e0b", icon: "⚠️" },
    };

    const config = typeConfigs[type];
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
        html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;"><div style="background: linear-gradient(135deg, #0891b2, #06b6d4); padding: 30px; text-align: center;"><h1 style="color: white;">Nivra Telecom</h1><p style="color: rgba(255,255,255,0.9); margin: 4px 0 0;">Votre service, simplifié.</p></div><div style="padding: 30px; background: #f8fafc;"><h2>Bonjour ${name || "cher client"},</h2><div style="background: ${config.color}20; border-left: 4px solid ${config.color}; padding: 15px; margin: 20px 0;"><h3 style="color: ${config.color};">${config.icon} ${config.heading}</h3><p>${config.message}</p></div><div style="background: white; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0;">${detailsHtml}</div><p>L'équipe Nivra</p></div><div style="padding: 24px 30px; background: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;"><p style="margin: 0 0 6px; font-size: 13px; font-weight: 600; color: #18181b;">Nivra Telecom</p><p style="margin: 0 0 6px; font-size: 12px; color: #71717a;">Laval, QC, Canada</p><p style="margin: 0 0 12px; font-size: 13px; color: #52525b;"><a href="mailto:support@nivratelecom.ca" style="color: #0d9488; text-decoration: none;">Support@nivratelecom.ca</a> | <a href="tel:5145442233" style="color: #0d9488; text-decoration: none;">514-544-2233</a></p><p style="margin: 0; font-size: 11px; color: #71717a;">Vous recevez cet email suite à une action sur votre compte Nivra Telecom.<br><em>You are receiving this email because of an action on your Nivra Telecom account.</em></p></div></div>`,
      }),
    });

    const result = await emailResponse.json();
    if (!emailResponse.ok) throw new Error(result.message);

    return new Response(JSON.stringify({ success: true, result }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json", ...getCorsHeaders(req.headers.get('origin')) } });
  }
};

serve(handler);
