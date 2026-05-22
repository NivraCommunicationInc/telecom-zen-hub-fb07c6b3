// Submit an NPS survey response, validated server-side by public_token.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const contentLength = req.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > 5_000) {
      return new Response(JSON.stringify({ error: "payload_too_large" }), {
        status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => null);
    const token = typeof body?.token === "string" ? body.token.trim() : "";
    const scoreRaw = body?.score;
    const commentRaw = typeof body?.comment === "string" ? body.comment : null;

    if (!token || token.length < 8 || token.length > 200) {
      return new Response(JSON.stringify({ error: "invalid_token" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const score = Number(scoreRaw);
    if (!Number.isInteger(score) || score < 0 || score > 10) {
      return new Response(JSON.stringify({ error: "invalid_score" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const comment = commentRaw ? commentRaw.slice(0, 2000).replace(/<[^>]*>/g, "") : null;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: survey, error: lookupErr } = await supabase
      .from("nps_surveys")
      .select("id, responded_at")
      .eq("public_token", token)
      .maybeSingle();

    if (lookupErr || !survey) {
      return new Response(JSON.stringify({ error: "invalid_or_expired" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (survey.responded_at) {
      return new Response(JSON.stringify({ error: "already_submitted" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: updErr } = await supabase
      .from("nps_surveys")
      .update({ score, comment, responded_at: new Date().toISOString() })
      .eq("public_token", token)
      .is("responded_at", null);

    if (updErr) {
      return new Response(JSON.stringify({ error: "update_failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (_e) {
    return new Response(JSON.stringify({ error: "internal_error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
