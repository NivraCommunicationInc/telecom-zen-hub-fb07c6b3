// pause-auto-resume — Module 25
// Cron horaire : lève automatiquement les pauses temporaires dont
// `paused_until` est atteint. Route via `account-ops-actions` avec
// `auto_resume: true` pour conserver un unique chemin canonique
// (audit + activity + note + email queue).

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const nowIso = new Date().toISOString();

  const { data: due, error } = await admin
    .from("accounts")
    .select("id, client_id, paused_until")
    .eq("status", "suspended")
    .not("paused_until", "is", null)
    .lte("paused_until", nowIso)
    .limit(200);

  if (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: Array<{ account_id: string; ok: boolean; error?: string }> = [];

  for (const row of due ?? []) {
    try {
      // Direct call: we already hold service-role. Call the canonical EF so
      // audit/activity/note/email are all produced by the same code path.
      const resp = await fetch(`${url}/functions/v1/account-ops-actions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
        },
        body: JSON.stringify({
          action: "unpause_account",
          client_user_id: (row as any).client_id,
          account_id: (row as any).id,
          auto_resume: true,
          reason: "auto_resume",
        }),
      });
      const text = await resp.text();
      results.push({
        account_id: (row as any).id,
        ok: resp.ok,
        error: resp.ok ? undefined : text,
      });
    } catch (e) {
      results.push({ account_id: (row as any).id, ok: false, error: (e as Error).message });
    }
  }

  // Heartbeat
  try {
    await admin.from("cron_heartbeats").insert({
      job_name: "pause-auto-resume",
      ran_at: nowIso,
      status: "ok",
      details: { processed: results.length, failed: results.filter((r) => !r.ok).length },
    });
  } catch (_e) { /* ignore */ }

  return new Response(JSON.stringify({ ok: true, processed: results.length, results }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
