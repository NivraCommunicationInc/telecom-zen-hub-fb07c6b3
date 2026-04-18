import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { verifyUnsubscribeToken } from "../_shared/unsubscribeToken.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

/**
 * Public unsubscribe endpoint — no auth required.
 *
 * GET  ?token=xxx           → validate token, return { email, status }
 * POST { token, action }    → action = 'unsubscribe' | 'resubscribe'
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let token: string | null = null;
    let action: "unsubscribe" | "resubscribe" = "unsubscribe";

    if (req.method === "GET") {
      const url = new URL(req.url);
      token = url.searchParams.get("token");
    } else if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      token = body.token ?? null;
      if (body.action === "resubscribe") action = "resubscribe";
    }

    if (!token) {
      return json({ ok: false, error: "missing_token" }, 400);
    }

    const email = await verifyUnsubscribeToken(token);
    if (!email) {
      return json({ ok: false, error: "invalid_token" }, 400);
    }

    // GET — just validate + return current status
    if (req.method === "GET") {
      const { data: existing } = await supabase
        .from("email_unsubscribes")
        .select("id, is_active")
        .eq("email", email)
        .maybeSingle();
      return json({
        ok: true,
        email,
        status: existing?.is_active ? "unsubscribed" : "subscribed",
      });
    }

    // POST — perform action
    // Lookup client_id (required column on email_unsubscribes)
    const { data: client } = await supabase
      .from("clients")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (action === "unsubscribe") {
      // Upsert as active unsubscribe
      const { data: existing } = await supabase
        .from("email_unsubscribes")
        .select("id")
        .eq("email", email)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("email_unsubscribes")
          .update({
            is_active: true,
            reason: "user_request",
            source: "public_unsubscribe_page",
            unsubscribed_at: new Date().toISOString(),
            resubscribed_at: null,
          })
          .eq("id", existing.id);
      } else {
        await supabase.from("email_unsubscribes").insert({
          email,
          client_id: client?.id ?? "00000000-0000-0000-0000-000000000000",
          is_active: true,
          reason: "user_request",
          source: "public_unsubscribe_page",
        });
      }
      return json({ ok: true, email, status: "unsubscribed" });
    }

    // resubscribe
    const { data: existing } = await supabase
      .from("email_unsubscribes")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("email_unsubscribes")
        .update({
          is_active: false,
          resubscribed_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    }
    return json({ ok: true, email, status: "subscribed" });
  } catch (err) {
    console.error("[email-unsubscribe]", err);
    return json({ ok: false, error: (err as Error).message }, 500);
  }

  function json(payload: unknown, status = 200) {
    return new Response(JSON.stringify(payload), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
