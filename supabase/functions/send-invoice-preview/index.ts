import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface SendInvoiceRequest {
  to: string;
  pdfBase64: string;
  filename?: string;
  subject?: string;
}

function buildEmailHtml(): string {
  // Keep this email template extremely compatible (inline styles, simple layout).
  // Note: We intentionally avoid external assets/fonts for deliverability.
  return `
    <!DOCTYPE html>
    <html lang="fr">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Nivra Telecom</title>
      </head>
      <body style="margin:0;padding:0;background:#F6F8FB;color:#0F172A;font-family:Arial,Helvetica,sans-serif;">
        <!-- Preheader (hidden) -->
        <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
          Votre document PDF Nivra est prêt.
        </div>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6F8FB;padding:24px 0;">
          <tr>
            <td align="center">
              <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="width:640px;max-width:92vw;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #E6EBF2;">
                <tr>
                  <td style="background:#0066CC;padding:18px 22px;">
                    <div style="font-size:18px;font-weight:700;letter-spacing:0.4px;color:#ffffff;">Nivra Telecom</div>
                    <div style="font-size:12px;opacity:0.9;color:#ffffff; margin-top:4px;">Télécom prépayée au Québec — simple, rapide, sans engagement</div>
                  </td>
                </tr>

                <tr>
                  <td style="padding:22px;">
                    <h1 style="margin:0 0 10px 0;font-size:18px;line-height:1.3;color:#0F172A;">Votre document PDF est joint</h1>
                    <p style="margin:0 0 14px 0;font-size:14px;line-height:1.6;color:#334155;">
                      Bonjour,<br />
                      Veuillez trouver en pièce jointe votre document au format PDF.
                    </p>

                    <div style="margin:16px 0;padding:14px 14px;border:1px solid #E6EBF2;border-radius:12px;background:#F8FAFC;">
                      <div style="font-size:12px;color:#64748B;margin-bottom:6px;">Besoin d’aide?</div>
                      <div style="font-size:14px;color:#0F172A;line-height:1.6;">
                        Répondez à ce courriel ou contactez-nous à
                        <a href="mailto:support@nivra-telecom.ca" style="color:#0066CC;text-decoration:none;font-weight:700;">support@nivra-telecom.ca</a>.
                      </div>
                    </div>

                    <p style="margin:0;font-size:12px;line-height:1.6;color:#64748B;">
                      Merci,<br />
                      <strong style="color:#0F172A;">L’équipe Nivra Telecom</strong>
                    </p>
                  </td>
                </tr>

                <tr>
                  <td style="padding:16px 22px;border-top:1px solid #E6EBF2;background:#FBFCFE;">
                    <div style="font-size:12px;line-height:1.6;color:#64748B;">
                      Nivra Telecom · 1799 Av. Pierre-Péladeau, Laval, QC H7T 2Y5<br />
                      <a href="mailto:support@nivra-telecom.ca" style="color:#0066CC;text-decoration:none;">support@nivra-telecom.ca</a>
                      · <a href="https://nivra-telecom.ca" style="color:#0066CC;text-decoration:none;">nivra-telecom.ca</a>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}

function buildEmailText(): string {
  return [
    "Bonjour,",
    "",
    "Veuillez trouver en pièce jointe votre document au format PDF.",
    "",
    "Besoin d’aide? Répondez à ce courriel ou écrivez à support@nivra-telecom.ca.",
    "",
    "Merci,",
    "L’équipe Nivra Telecom",
    "1799 Av. Pierre-Péladeau, Laval, QC H7T 2Y5",
    "nivra-telecom.ca",
  ].join("\n");
}

const handler = async (req: Request): Promise<Response> => {
  console.log("[send-invoice-preview] Request received");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, pdfBase64, filename, subject }: SendInvoiceRequest = await req.json();

    if (!to || !pdfBase64) {
      console.error("[send-invoice-preview] Missing required fields");
      return new Response(
        JSON.stringify({ error: "Missing required fields: to, pdfBase64" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Basic sanity check to avoid sending corrupted/empty attachments
    const cleanedBase64 = String(pdfBase64).trim();
    if (cleanedBase64.length < 1000) {
      console.error("[send-invoice-preview] PDF base64 too small — likely corrupted");
      return new Response(
        JSON.stringify({ error: "PDF invalide ou corrompu (base64 trop court)." }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`[send-invoice-preview] Sending invoice to: ${to}`);

    const emailResponse = await resend.emails.send({
      from: "Nivra Telecom <noreply@nivra-telecom.ca>",
      to: [to],
      subject: subject || "Nivra Telecom — Document PDF",
      replyTo: "support@nivra-telecom.ca",
      html: buildEmailHtml(),
      text: buildEmailText(),
      attachments: [
        {
          filename: filename || "Nivra-Document.pdf",
          content: cleanedBase64,
          contentType: "application/pdf",
        },
      ],
    });

    console.log("[send-invoice-preview] Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, messageId: emailResponse.id }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("[send-invoice-preview] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
