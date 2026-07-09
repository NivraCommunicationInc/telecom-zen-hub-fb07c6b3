// Weekly scan: queue Google Review request emails for active clients
// who have never reviewed and have not received a review email in the last 30 days.
import { createClient } from "npm:@supabase/supabase-js@2";
import { reportEdgeError } from "../_shared/sentry.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const AGENT = "agent-review-request";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const results: Array<Record<string, unknown>> = [];
  const startedAt = Date.now();

  try {
    // 1. Active accounts created >= 7 days ago, with email
    const { data: accounts, error: accErr } = await supabase
      .from("accounts")
      .select("id, user_id, status, created_at, profiles:profiles!inner(email, first_name, language)")
      .eq("status", "active")
      .lte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .limit(500);

    if (accErr) throw accErr;

    for (const a of accounts ?? []) {
      const profile = Array.isArray((a as any).profiles) ? (a as any).profiles[0] : (a as any).profiles;
      const email = profile?.email;
      if (!email) continue;

      // 2. Skip if already submitted a review
      const { count: submitted } = await supabase
        .from("client_reviews")
        .select("id", { count: "exact", head: true })
        .eq("account_id", a.id)
        .eq("status", "submitted");
      if ((submitted ?? 0) > 0) continue;

      // 3. Skip if review email queued in last 30 days
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { count: recent } = await supabase
        .from("email_queue")
        .select("id", { count: "exact", head: true })
        .eq("template_key", "review_request_activation")
        .gte("created_at", since)
        .filter("template_vars->>account_id", "eq", a.id);
      if ((recent ?? 0) > 0) continue;

      // 4. Ensure client_reviews row exists (activation)
      const { data: existingCr } = await supabase
        .from("client_reviews")
        .select("review_token")
        .eq("account_id", a.id)
        .eq("trigger_type", "activation")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let reviewToken = existingCr?.review_token as string | undefined;
      if (!reviewToken) {
        const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        const { data: inserted } = await supabase
          .from("client_reviews")
          .insert({
            account_id: a.id,
            trigger_type: "activation",
            token_expires_at: expires,
            status: "pending",
          })
          .select("review_token")
          .single();
        reviewToken = inserted?.review_token as string | undefined;
      }

      const language = profile?.language || "fr";
      const eventKey = `review_request_activation_weekly_${a.id}_${new Date().toISOString().slice(0, 10)}`;

      // 5. Queue email
      const { error: qErr } = await supabase.from("email_queue").insert({
        event_key: eventKey,
        to_email: email,
        template_key: "review_request_activation",
        template_vars: {
          first_name: profile?.first_name || "Client",
          account_id: a.id,
          review_url: `https://nivra-telecom.ca/avis/${reviewToken}`,
          google_review_url: "https://share.google/y07QHAdHSZDBDFa9q",
          language,
        },
        status: "queued",
        language,
      });

      results.push({ account_id: a.id, queued: !qErr, error: qErr?.message });
    }

    const queued = results.filter((r) => r.queued === true).length;
    // Audit trail — was missing entirely. Every weekly run now leaves a trace
    // in agent_audit_log + agent_events so operators can answer "did the
    // review-request agent run last Sunday and what did it do?".
    await supabase.from("agent_audit_log").insert({
      agent_name: AGENT,
      action: "weekly_review_blast",
      result: "success",
      execution_time_ms: Date.now() - startedAt,
      details: {
        accounts_processed: results.length,
        emails_queued: queued,
      },
    });
    await supabase.from("agent_events").insert({
      agent_name: AGENT,
      event_type: queued > 0 ? "success" : "info",
      message: `Review request blast — ${queued} email(s) queued out of ${results.length} eligible accounts`,
      details: { accounts_processed: results.length, emails_queued: queued },
    });

    return new Response(
      JSON.stringify({ ok: true, processed: results.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // Log the failure so silent breakage stops being a thing.
    await supabase.from("agent_audit_log").insert({
      agent_name: AGENT,
      action: "weekly_review_blast",
      result: "failure",
      error_message: msg,
      execution_time_ms: Date.now() - startedAt,
    }).then(() => undefined, () => undefined);
    reportEdgeError(e, { function: AGENT }).catch(() => {});
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
