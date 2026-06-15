/**
 * notify-activation-request
 * Sends an email alert to support@nivra-telecom.ca AND support@nivra-telecom.ca
 * when a new activation request is submitted by a client.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { Resend } from "../_shared/ResendProxy.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_RECIPIENTS = ["support@nivra-telecom.ca"];
const ADMIN_BASE_URL = Deno.env.get("ADMIN_BASE_URL") || "https://www.nivra-telecom.ca";

interface RequestBody {
  activation_request_id: string;
}

serve(async (req) => {
  const requestId = crypto.randomUUID();
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: RequestBody = await req.json();
    if (!body.activation_request_id) {
      return new Response(
        JSON.stringify({ error: "activation_request_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Fetch activation request
    const { data: ar, error: arErr } = await supabase
      .from("activation_requests")
      .select("*")
      .eq("id", body.activation_request_id)
      .maybeSingle();

    if (arErr || !ar) {
      console.error(`[${requestId}] activation request not found:`, arErr);
      return new Response(
        JSON.stringify({ error: "activation request not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Already notified â€” idempotency
    if (ar.business_notified) {
      console.log(`[${requestId}] already notified for ${body.activation_request_id}`);
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "already_notified" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Fetch client
    const { data: client } = await supabase
      .from("profiles")
      .select("full_name, email, client_number, phone")
      .eq("user_id", ar.client_id)
      .maybeSingle();

    const clientName = client?.full_name || "Client inconnu";
    const clientEmail = client?.email || "â€”";
    const clientNumber = client?.client_number || "â€”";
    const adminLink = `${ADMIN_BASE_URL}/core/activations`;

    const subject = `ðŸ”” Nouvelle demande d'activation â€” ${clientName}`;

    const html = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><title>${subject}</title></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background-color:#f3f4f6;">
  <table role="presentation" style="width:100%;border-collapse:collapse;">
    <tr><td align="center" style="padding:40px 20px;">
      <table role="presentation" style="max-width:600px;width:100%;border-collapse:collapse;">
        <tr><td style="background:linear-gradient(135deg,#0066CC,#0052a3);padding:24px;text-align:center;border-radius:12px 12px 0 0;">
          <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">ðŸ”” Nouvelle demande d'activation</h1>
        </td></tr>
        <tr><td style="background:#fff;padding:30px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;">
          <p style="margin:0 0 20px;color:#374151;font-size:15px;">Une nouvelle demande d'activation WiFi vient d'être soumise.</p>
          <table role="presentation" style="width:100%;background:#f9fafb;border-radius:8px;margin-bottom:20px;">
            <tr><td style="padding:16px;">
              <p style="margin:0 0 6px;font-size:13px;color:#6b7280;"><strong>Client:</strong> ${clientName}</p>
              <p style="margin:0 0 6px;font-size:13px;color:#6b7280;"><strong>Compte:</strong> #${clientNumber}</p>
              <p style="margin:0 0 6px;font-size:13px;color:#6b7280;"><strong>Courriel:</strong> ${clientEmail}</p>
              <p style="margin:0 0 6px;font-size:13px;color:#6b7280;"><strong>Téléphone contact:</strong> ${ar.contact_phone}</p>
              <p style="margin:0 0 6px;font-size:13px;color:#6b7280;"><strong>Réseau WiFi demandé:</strong> <code>${ar.wifi_network_name}</code></p>
              <p style="margin:0;font-size:13px;color:#6b7280;"><strong>Soumis Ã :</strong> ${new Date(ar.submitted_at).toLocaleString("fr-CA", { timeZone: "America/Toronto" })}</p>
            </td></tr>
          </table>
          ${ar.client_notes ? `<div style="background:#fffbeb;border-left:4px solid #f59e0b;padding:12px;border-radius:0 8px 8px 0;margin-bottom:20px;"><p style="margin:0;font-size:13px;color:#92400e;"><strong>Notes du client:</strong> ${ar.client_notes}</p></div>` : ""}
          <table role="presentation" style="width:100%;"><tr><td align="center">
            <a href="${adminLink}" style="display:inline-block;background:#0066CC;color:#fff;padding:14px 32px;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;">Traiter la demande â†’</a>
          </td></tr></table>
        </td></tr>
        <tr><td style="background:#1f2937;padding:20px;text-align:center;border-radius:0 0 12px 12px;">
          <p style="margin:0;color:#9ca3af;font-size:12px;">Notification automatique â€” Nivra Télécom Admin</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

    let emailsSent = 0;
    if (resendApiKey) {
      const resend = new Resend(resendApiKey);
      for (const to of ADMIN_RECIPIENTS) {
        try {
          await resend.emails.send({
            from: "Nivra Activations <support@nivra-telecom.ca>",
            to: [to],
            subject,
            html,
          });
          emailsSent++;
          console.log(`[${requestId}] sent to ${to}`);
        } catch (e) {
          console.error(`[${requestId}] failed to ${to}:`, e);
        }
      }
    } else {
      console.warn(`[${requestId}] RESEND_API_KEY not set â€” skipping email`);
    }

    // Mark as notified
    await supabase
      .from("activation_requests")
      .update({ business_notified: true })
      .eq("id", body.activation_request_id);

    return new Response(
      JSON.stringify({ success: true, emails_sent: emailsSent }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error(`[${requestId}] error:`, err);
    return new Response(
      JSON.stringify({ error: err?.message || String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
