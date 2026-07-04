/**
 * notify-activation-request
 * Sends an email alert to support@nivra-telecom.ca AND support@nivra-telecom.ca
 * when a new activation request is submitted by a client.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { Resend } from "../_shared/ResendProxy.ts";
import { violetShell } from "../_shared/violetEmailShell.ts";

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

    const subject = `🔔 Nouvelle demande d'activation — ${clientName}`;

    const cardRows: [string, string][] = [
      ["Client", clientName],
      ["Compte", `#${clientNumber}`],
      ["Courriel", clientEmail],
      ["Téléphone contact", String(ar.contact_phone ?? "—")],
      ["Réseau WiFi demandé", String(ar.wifi_network_name ?? "—")],
      ["Soumis à", new Date(ar.submitted_at).toLocaleString("fr-CA", { timeZone: "America/Toronto" })],
    ];
    const html = violetShell({
      preheader: `Nouvelle demande d'activation WiFi — ${clientName}`,
      badge: "DEMANDE D'ACTIVATION",
      heroTitle: "Nouvelle demande d'activation WiFi",
      heroSub: clientName,
      bodyHtml: "Une nouvelle demande d'activation WiFi vient d'être soumise par un client.",
      cardTitle: "Détails de la demande",
      cardRows,
      ctaPrimaryUrl: adminLink,
      ctaPrimaryLabel: "Traiter la demande",
      helpHtml: ar.client_notes ? `<strong>Notes du client :</strong> ${String(ar.client_notes)}` : undefined,
      helpVariant: ar.client_notes ? "warning" : undefined,
    });


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
