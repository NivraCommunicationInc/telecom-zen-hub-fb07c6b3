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

    console.log(`[send-invoice-preview] Sending invoice to: ${to}`);

    const emailResponse = await resend.emails.send({
      from: "Nivra Telecom <noreply@nivra-telecom.ca>",
      to: [to],
      subject: subject || "Nivra Telecom - Aperçu Facture V2",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .header { background: #0066CC; color: white; padding: 20px; text-align: center; }
            .content { padding: 30px; }
            .footer { background: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 style="margin: 0;">Nivra Telecom</h1>
          </div>
          <div class="content">
            <h2>Aperçu du nouveau template de facture V2</h2>
            <p>Bonjour,</p>
            <p>Veuillez trouver ci-joint l'aperçu du nouveau template de facture mensuelle inspiré du design professionnel Rogers.</p>
            <p>Ce template inclut :</p>
            <ul>
              <li>En-tête horizontal avec logo et coordonnées</li>
              <li>Mise en page deux colonnes (Frais totaux / Sommaire)</li>
              <li>Tableau détaillé des services</li>
              <li>Section signature (manuscrite ou texte)</li>
              <li>Pied de page avec informations légales</li>
            </ul>
            <p>Merci de votre confiance.</p>
            <p><strong>L'équipe Nivra Telecom</strong></p>
          </div>
          <div class="footer">
            <p>Nivra Telecom | 1799 Av. Pierre-Péladeau, Laval, QC H7T 2Y5</p>
            <p>438-544-2233 | support@nivra-telecom.ca</p>
          </div>
        </body>
        </html>
      `,
      attachments: [
        {
          filename: filename || "Nivra-Facture-V2-Preview.pdf",
          content: pdfBase64,
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
