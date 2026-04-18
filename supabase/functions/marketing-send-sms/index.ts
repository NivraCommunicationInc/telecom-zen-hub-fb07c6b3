/**
 * marketing-send-sms — Admin-only manual SMS send via OpenPhone.
 * Logs into telephony_logs + marketing_conversations.
 */
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey);
    const { data: { user }, error: authErr } = await userClient.auth.getUser(auth.replace("Bearer ", ""));
    if (authErr || !user) return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { to, message, conversation_id } = await req.json();
    if (!to || !message) return new Response(JSON.stringify({ error: "to and message required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const OPENPHONE_API_KEY = Deno.env.get("OPENPHONE_API_KEY");
    if (!OPENPHONE_API_KEY) return new Response(JSON.stringify({ error: "OPENPHONE_API_KEY not set" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const pnRes = await fetch("https://api.openphone.com/v1/phone-numbers", {
      headers: { Authorization: OPENPHONE_API_KEY, "Content-Type": "application/json" },
    });
    const pnJson = await pnRes.json();
    const fromNumber = pnJson?.data?.[0]?.phoneNumber;
    if (!fromNumber) return new Response(JSON.stringify({ error: "No OpenPhone number available" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const sendRes = await fetch("https://api.openphone.com/v1/messages", {
      method: "POST",
      headers: { Authorization: OPENPHONE_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ content: message, from: fromNumber, to: [to] }),
    });
    const sendJson = await sendRes.json().catch(() => null);
    if (!sendRes.ok) {
      return new Response(JSON.stringify({ error: "OpenPhone send failed", details: sendJson }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Resolve / upsert conversation
    let convId = conversation_id || null;
    if (!convId) {
      const { data: existing } = await admin
        .from("marketing_conversations").select("id").eq("phone_number", to).maybeSingle();
      if (existing) convId = existing.id;
      else {
        const { data: created } = await admin
          .from("marketing_conversations")
          .insert({ phone_number: to, status: "human_takeover", ai_enabled: false })
          .select("id").single();
        convId = created?.id || null;
      }
    }

    if (convId) {
      await admin.from("marketing_conversations").update({
        last_message_preview: message.substring(0, 280),
        last_message_at: new Date().toISOString(),
      }).eq("id", convId);
    }

    await admin.from("telephony_logs").insert({
      phone_number: to,
      action: "sms",
      direction: "outbound",
      openphone_message_id: sendJson?.data?.id || null,
      message_preview: message.substring(0, 500),
      status: "sent",
      agent_user_id: user.id,
      agent_email: user.email || null,
      marketing_conversation_id: convId,
    });

    return new Response(JSON.stringify({ success: true, message_id: sendJson?.data?.id, conversation_id: convId }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
