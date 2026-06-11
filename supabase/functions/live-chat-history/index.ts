/**
 * live-chat-history
 *
 * Public endpoint that returns live chat messages for a given session_id.
 *
 * Security model:
 * - Visitors are anonymous; the unguessable client-generated session_id (UUID v4)
 *   acts as the access token.
 * - The DB has table-level RLS that restricts SELECT on live_chat_messages to
 *   marketing staff only. Visitors cannot read their own history through the
 *   public REST API anymore — they read it through this function via the
 *   service role.
 * - We require session_id to be a valid UUID and return ONLY rows scoped to
 *   that session_id, with attachment_url freshly re-signed.
 */
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: { session_id?: string; limit?: number };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const sessionId = (body?.session_id ?? "").trim();
  if (!sessionId || !UUID_RE.test(sessionId)) {
    return new Response(JSON.stringify({ error: "invalid_session_id" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const limit = Math.min(Math.max(Number(body?.limit) || 50, 1), 200);

  const { data: messages, error: msgErr } = await admin
    .from("live_chat_messages")
    .select(
      "id, session_id, role, content, attachment_url, attachment_path, attachment_name, attachment_type, attachment_size, admin_user_id, admin_name, admin_seen_at, created_at",
    )
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (msgErr) {
    return new Response(
      JSON.stringify({ error: "fetch_failed", detail: msgErr.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  // Re-sign attachment URLs (1h)
  const enriched = await Promise.all(
    (messages ?? []).map(async (m: any) => {
      if (m.attachment_path) {
        const { data: signed } = await admin.storage
          .from("chat-attachments")
          .createSignedUrl(m.attachment_path, 60 * 60);
        if (signed?.signedUrl) m.attachment_url = signed.signedUrl;
      }
      return m;
    }),
  );

  const { data: session } = await admin
    .from("live_chat_sessions")
    .select("status")
    .eq("session_id", sessionId)
    .maybeSingle();

  return new Response(
    JSON.stringify({
      ok: true,
      messages: enriched,
      session_status: session?.status ?? null,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
