import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ContractNotificationRequest {
  email: string;
  name: string;
  contractName: string;
  contractNumber: string;
  portalUrl: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, name, contractName, contractNumber, portalUrl }: ContractNotificationRequest = await req.json();

    console.log("Sending contract notification to:", email);

    const emailResponse = await resend.emails.send({
      from: "Nivra Télécom <onboarding@resend.dev>",
      to: [email],
      subject: `Contrat à signer - ${contractName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
            <tr>
              <td style="padding: 40px 30px; text-align: center; background: linear-gradient(135deg, #0891b2, #06b6d4);">
                <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold; letter-spacing: 2px;">NIVRA</h1>
                <p style="margin: 8px 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">Courtier Télécom Indépendant</p>
              </td>
            </tr>
            <tr>
              <td style="padding: 40px 30px;">
                <h2 style="margin: 0 0 20px; color: #0f172a; font-size: 22px;">Bonjour ${name},</h2>
                <p style="margin: 0 0 20px; color: #475569; line-height: 1.6;">
                  Un nouveau contrat a été préparé pour vous et attend votre signature.
                </p>
                
                <table width="100%" cellpadding="0" cellspacing="0" style="margin: 25px 0; background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
                  <tr>
                    <td style="padding: 20px;">
                      <p style="margin: 0 0 10px; color: #64748b; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Détails du contrat</p>
                      <p style="margin: 0 0 8px; color: #0f172a; font-size: 16px;"><strong>Nom:</strong> ${contractName}</p>
                      <p style="margin: 0; color: #0f172a; font-size: 16px;"><strong>Numéro:</strong> ${contractNumber}</p>
                    </td>
                  </tr>
                </table>
                
                <p style="margin: 0 0 25px; color: #475569; line-height: 1.6;">
                  Veuillez vous connecter à votre portail client pour consulter et signer le contrat.
                </p>
                
                <table cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                  <tr>
                    <td style="background: linear-gradient(135deg, #0891b2, #06b6d4); border-radius: 8px;">
                      <a href="${portalUrl}" style="display: inline-block; padding: 14px 30px; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 16px;">
                        Voir le contrat
                      </a>
                    </td>
                  </tr>
                </table>
                
                <p style="margin: 30px 0 0; color: #94a3b8; font-size: 13px; line-height: 1.6;">
                  Si vous avez des questions, n'hésitez pas à nous contacter par courriel ou téléphone.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding: 25px 30px; background-color: #f8fafc; border-top: 1px solid #e2e8f0;">
                <p style="margin: 0; color: #64748b; font-size: 12px; text-align: center;">
                  Nivra Télécom | Montréal, QC | 438-544-2233 | Nivratelecom@gmail.com
                </p>
                <p style="margin: 8px 0 0; color: #94a3b8; font-size: 11px; text-align: center;">
                  Ce courriel a été envoyé automatiquement. Merci de ne pas y répondre directement.
                </p>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    });

    console.log("Contract notification sent successfully:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-contract-notification function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
