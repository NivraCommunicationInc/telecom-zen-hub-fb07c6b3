import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "../_shared/ResendProxy.ts";
import { violetShell } from "../_shared/violetEmailShell.ts";

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
  return violetShell({
    preheader: "Votre document PDF Nivra est prêt.",
    badge: "DOCUMENT JOINT",
    heroTitle: "Votre document est joint",
    heroSub: "Vous trouverez le PDF en pièce jointe à ce courriel.",
    bodyHtml: "Bonjour, veuillez trouver en pièce jointe votre document au format PDF.",
  });
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
