// Send NPS survey to a client (idempotent within 90 days)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { account_id } = await req.json();
    if (!account_id) {
      return new Response(JSON.stringify({ error: "account_id required" }), { status: 400, headers: corsHeaders });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Already sent in 90d?
    const since = new Date(Date.now() - 90 * 86400 * 1000).toISOString();
    const { data: recent } = await supabase
      .from("nps_surveys").select("id").eq("account_id", account_id).gte("sent_at", since).maybeSingle();
    if (recent) {
      return new Response(JSON.stringify({ skipped: "recent_survey_exists" }), { headers: corsHeaders });
    }

    const { data: account } = await supabase
      .from("accounts").select("id, client_id").eq("id", account_id).maybeSingle();
    if (!account) return new Response(JSON.stringify({ error: "account_not_found" }), { status: 404, headers: corsHeaders });

    const { data: profile } = await supabase
      .from("profiles").select("email, full_name, preferred_language").eq("user_id", account.client_id).maybeSingle();
    if (!profile?.email) return new Response(JSON.stringify({ error: "no_email" }), { status: 400, headers: corsHeaders });

    const { data: inserted, error: insErr } = await supabase
      .from("nps_surveys")
      .insert({ account_id, client_id: account.client_id, trigger_event: "manual" })
      .select("id, public_token").single();
    if (insErr) throw insErr;

    const npsUrl = `https://nivra-telecom.ca/nps/${inserted.public_token}`;
    await supabase.from("email_queue").insert({
      event_key: `nps_${inserted.id}`,
      to_email: profile.email,
      template_key: "nps_survey",
      template_vars: {
        client_name: profile.full_name || "Client",
        nps_url: npsUrl,
        nps_token: inserted.public_token,
      },
      language: profile.preferred_language || "fr",
      status: "queued",
    });

    return new Response(JSON.stringify({ survey_url: npsUrl, id: inserted.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500, headers: corsHeaders });
  }
});
