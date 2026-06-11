// Send "service activated" email when activation_request transitions to completed.
// Uses the EXACT same premium template as send-order-confirmation.
// BCC: support@nivra-telecom.ca + support@nivra-telecom.ca

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { Resend } from "../_shared/ResendProxy.ts";
import { escapeHtml } from "../_shared/emailTemplates/components.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

const BUSINESS_EMAILS = ["support@nivra-telecom.ca"];
const SUPPORT_EMAIL = "support@nivra-telecom.ca";
const PORTAL_LINK = "https://nivra-telecom.ca/portail";

interface RequestBody {
  activation_request_id: string;
  override_recipient?: string; // Test mode — redirect to this address
}

type ClientLang = "fr" | "en";

function resolveClientLanguage(profile: { preferred_language?: string | null } | null | undefined): ClientLang {
  return profile?.preferred_language === "fr" ? "fr" : "en";
}

function buildHtml(firstName: string, wifiName: string, lang: ClientLang): string {
  const isFr = lang === "fr";
  return violetShell({
    preheader: isFr ? "Bienvenue chez Nivra — votre service Internet est actif." : "Welcome to Nivra — your Internet service is now active.",
    badge: isFr ? "SERVICE ACTIF" : "SERVICE ACTIVE",
    heroTitle: isFr ? "Votre service est maintenant actif" : "Your service is now active",
    heroSub: isFr ? "Votre WiFi Nivra est prêt à utiliser." : "Your Nivra WiFi is ready to use.",
    greeting: isFr ? `Bonjour ${escapeHtml(firstName)},` : `Hello ${escapeHtml(firstName)},`,
    bodyHtml: isFr
      ? "Votre service Internet Nivra est maintenant actif. Vous pouvez connecter tous vos appareils à votre réseau WiFi."
      : "Your Nivra Internet service is now active. You can connect all your devices to your WiFi network.",
    cardTitle: isFr ? "Votre réseau WiFi" : "Your WiFi network",
    cardRows: [
      [isFr ? "Nom du réseau" : "Network name", wifiName],
    ],
    ctaPrimaryUrl: PORTAL_LINK,
    ctaPrimaryLabel: isFr ? "Mon espace client" : "My client portal",
  });
}


serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");
    const resend = new Resend(RESEND_API_KEY);
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const body = (await req.json()) as RequestBody;
    if (!body?.activation_request_id) {
      return new Response(JSON.stringify({ error: "activation_request_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: ar, error: arErr } = await supabase
      .from("activation_requests")
      .select("id, client_id, wifi_network_name, status")
      .eq("id", body.activation_request_id)
      .maybeSingle();
    if (arErr || !ar) throw new Error(`Activation request not found: ${arErr?.message}`);

    const { data: profile } = await supabase
      .from("profiles")
      .select("email, full_name, first_name, preferred_language")
      .eq("user_id", ar.client_id)
      .maybeSingle();

    const email = profile?.email;
    if (!email && !body.override_recipient) throw new Error("Client email not found");
    const firstName = profile?.first_name || (profile?.full_name ? profile.full_name.split(" ")[0] : "client");
    const clientLang = resolveClientLanguage(profile);

    const recipientEmail = body.override_recipient || email!;
    const isTest = !!body.override_recipient;

    const html = buildHtml(firstName, ar.wifi_network_name || "Nivra-WiFi", clientLang);

    const sendResp = await resend.emails.send({
      from: "Nivra Telecom <noreply@nivra-telecom.ca>",
      to: [recipientEmail],
      bcc: isTest ? [] : BUSINESS_EMAILS,
      reply_to: SUPPORT_EMAIL,
      subject: `${isTest ? "[TEST] " : ""}${clientLang === "fr" ? "Votre service Internet est maintenant actif" : "Your Nivra Internet service is now active"}`,
      html,
      headers: { "X-Entity-Ref-ID": `activation-success-${ar.id}${isTest ? '-test-' + Date.now() : ''}` },
    });

    console.log(`[send-activation-success-email] Sent to ${recipientEmail} for activation ${ar.id}${isTest ? ' [TEST MODE]' : ''}`);

    return new Response(JSON.stringify({
      success: true, message_id: sendResp.data?.id, activation_request_id: ar.id,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[send-activation-success-email] Error:", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
