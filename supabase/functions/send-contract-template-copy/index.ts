/**
 * One-shot edge function: Sends the V5.0 contract template PDF
 * (blank, no client data) to support@nivra-telecom.ca for archival/review.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "../_shared/ResendProxy.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { pdfBase64, recipient, filename } = body;
    let attachments = body.attachments;

    if (!recipient) throw new Error("recipient requis");
    if (!attachments && pdfBase64) {
      attachments = [{ filename: filename || "document.pdf", content: pdfBase64 }];
    }
    if (!attachments?.length) throw new Error("attachments ou pdfBase64 requis");

    const dateStr = new Date().toLocaleDateString("fr-CA", {
      year: "numeric", month: "long", day: "numeric", timeZone: "America/Montreal",
    });

    const fileList = attachments.map((a: any) => `<li style="margin:4px 0;color:#334155;font-size:14px;">ðŸ“Ž ${a.filename}</li>`).join("");

    const emailResponse = await resend.emails.send({
      from: "Nivra Telecom <noreply@nivra-telecom.ca>",
      to: [recipient],
      reply_to: "support@nivra-telecom.ca",
      subject: body.subject || `Copie de tous les templates PDF Nivra (${attachments.length} documents)`,
      html: `
<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 20px;"><tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,.1);">
      <tr><td style="background:linear-gradient(135deg,#0F172A 0%,#1E293B 100%);padding:32px 40px;text-align:center;">
        <h1 style="margin:0;color:#fff;font-size:28px;font-weight:700;">Nivra<span style="color:#14B8A6;">Telecom</span></h1>
        <p style="margin:8px 0 0;color:#94A3B8;font-size:14px;">Templates PDF â€” usage interne</p>
      </td></tr>
      <tr><td style="padding:40px;">
        <h2 style="margin:0 0 16px;color:#0F172A;font-size:22px;font-weight:600;">${attachments.length} templates PDF en piÃ¨ces jointes</h2>
        <p style="margin:0 0 16px;color:#334155;font-size:16px;line-height:1.7;">${body.intro || "Copie vierge de tous les templates PDF actuellement utilisÃ©s par le moteur Nivra."}</p>
        <div style="background:#F0FDFA;border-left:4px solid #14B8A6;padding:16px 20px;border-radius:0 8px 8px 0;margin-bottom:24px;">
          <p style="margin:0 0 8px;color:#0F766E;font-size:14px;font-weight:600;">Documents inclus :</p>
          <ul style="margin:0;padding-left:20px;">${fileList}</ul>
        </div>
        <p style="margin:0;color:#64748B;font-size:13px;line-height:1.6;">Champs dynamiques entre crochets [...]. Watermark "DOCUMENT MODÃˆLE" appliquÃ©.</p>
      </td></tr>
      <tr><td style="background:#F8FAFC;padding:24px 40px;border-top:1px solid #E2E8F0;text-align:center;">
        <p style="margin:0 0 8px;color:#64748B;font-size:13px;">Nivra Communications Inc. | Laval, QuÃ©bec</p>
        <p style="margin:0;color:#94A3B8;font-size:12px;">${dateStr}</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`,
      attachments,
    });

    return new Response(
      JSON.stringify({ success: true, emailId: emailResponse.id, recipient }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error) {
    console.error("[send-contract-template-copy] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
