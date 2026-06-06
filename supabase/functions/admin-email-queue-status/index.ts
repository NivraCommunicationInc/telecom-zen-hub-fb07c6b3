import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const supabase: any = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const url = new URL(req.url);
  const eventKeyPrefix = url.searchParams.get("prefix") || "billing_policy_update_2026_06";

  const { data, error } = await supabase
    .from("email_queue")
    .select("to_email, status, attempts, created_at, sent_at, error_message")
    .like("event_key", `${eventKeyPrefix}:%`)
    .order("created_at");

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ count: data?.length ?? 0, emails: data ?? [] }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
