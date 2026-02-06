import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================================================
// SEND TERMS PDF EMAIL — NIVRA TELECOM
// Envoie le PDF officiel des Modalités de service aux clients
// Version: 2026-02-06
// ============================================================================

// URL du PDF officiel hébergé dans le projet
const TERMS_PDF_URL = "https://telecom-zen-hub.lovable.app/documents/Nivra_Telecom_Modalites_de_service_v2026-02-05.pdf";
const TERMS_PDF_FILENAME = "Nivra_Telecom_Modalites_de_service_v2026-02-05.pdf";

interface EmailRequest {
  to: string;
  order_id?: string;
  client_name?: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, order_id, client_name }: EmailRequest = await req.json();

    if (!to) {
      throw new Error("Email recipient (to) is required");
    }

    console.log(`[send-terms-pdf-email] Sending terms PDF to: ${to}`);
    console.log(`[send-terms-pdf-email] Order ID: ${order_id || 'N/A'}`);
    console.log(`[send-terms-pdf-email] Client: ${client_name || 'N/A'}`);

    // Fetch the official PDF from the hosted URL
    console.log(`[send-terms-pdf-email] Fetching PDF from: ${TERMS_PDF_URL}`);
    const pdfResponse = await fetch(TERMS_PDF_URL);
    
    if (!pdfResponse.ok) {
      throw new Error(`Failed to fetch PDF: ${pdfResponse.status} ${pdfResponse.statusText}`);
    }

    const pdfArrayBuffer = await pdfResponse.arrayBuffer();
    const pdfBase64 = btoa(String.fromCharCode(...new Uint8Array(pdfArrayBuffer)));

    console.log(`[send-terms-pdf-email] PDF fetched successfully, size: ${pdfArrayBuffer.byteLength} bytes`);

    // Format current date
    const now = new Date();
    const dateStr = now.toLocaleDateString('fr-CA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'America/Montreal'
    });

    // Send email with PDF attachment
    const emailResponse = await resend.emails.send({
      from: "Nivra Telecom <noreply@nivra-telecom.ca>",
      to: [to],
      reply_to: "support@nivra-telecom.ca",
      subject: `Modalités de service – Nivra Telecom${order_id ? ` (Commande ${order_id})` : ''}`,
      html: `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Modalités de service – Nivra Telecom</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #0F172A 0%, #1E293B 100%); padding: 32px 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">
                Nivra<span style="color: #14B8A6;">Telecom</span>
              </h1>
              <p style="margin: 8px 0 0 0; color: #94A3B8; font-size: 14px;">
                Services de télécommunications prépayés
              </p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 16px 0; color: #0F172A; font-size: 22px; font-weight: 600;">
                Modalités de service
              </h2>
              
              ${client_name ? `
              <p style="margin: 0 0 24px 0; color: #64748B; font-size: 16px; line-height: 1.6;">
                Bonjour <strong style="color: #0F172A;">${client_name}</strong>,
              </p>
              ` : ''}
              
              <p style="margin: 0 0 24px 0; color: #334155; font-size: 16px; line-height: 1.7;">
                Veuillez trouver ci-joint les <strong>Modalités de service</strong> de Nivra Telecom. 
                Ce document décrit les conditions applicables à tous nos services de télécommunications.
              </p>
              
              ${order_id ? `
              <div style="background-color: #F0FDFA; border-left: 4px solid #14B8A6; padding: 16px 20px; border-radius: 0 8px 8px 0; margin-bottom: 24px;">
                <p style="margin: 0; color: #0F766E; font-size: 14px;">
                  <strong>Référence de commande :</strong> ${order_id}
                </p>
              </div>
              ` : ''}
              
              <div style="background-color: #F8FAFC; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                <p style="margin: 0 0 12px 0; color: #0F172A; font-size: 14px; font-weight: 600;">
                  📎 Document joint :
                </p>
                <p style="margin: 0; color: #64748B; font-size: 14px;">
                  ${TERMS_PDF_FILENAME}
                </p>
              </div>
              
              <p style="margin: 0 0 24px 0; color: #334155; font-size: 16px; line-height: 1.7;">
                Nous vous remercions de votre confiance et restons à votre disposition pour toute question.
              </p>
              
              <p style="margin: 0; color: #334155; font-size: 16px; line-height: 1.7;">
                Cordialement,<br>
                <strong>L'équipe Nivra Telecom</strong>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #F8FAFC; padding: 24px 40px; border-top: 1px solid #E2E8F0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="text-align: center;">
                    <p style="margin: 0 0 8px 0; color: #64748B; font-size: 13px;">
                      Nivra Communications Inc. | Montréal, Québec
                    </p>
                    <p style="margin: 0 0 8px 0; color: #64748B; font-size: 13px;">
                      📧 support@nivra-telecom.ca | 🌐 nivra-telecom.ca
                    </p>
                    <p style="margin: 0; color: #94A3B8; font-size: 12px;">
                      ${dateStr}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `,
      attachments: [
        {
          filename: TERMS_PDF_FILENAME,
          content: pdfBase64,
        }
      ],
    });

    console.log(`[send-terms-pdf-email] Email sent successfully:`, emailResponse);

    return new Response(
      JSON.stringify({
        success: true,
        emailId: emailResponse.id,
        message: `Modalités PDF envoyées à ${to}`,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("[send-terms-pdf-email] Error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
