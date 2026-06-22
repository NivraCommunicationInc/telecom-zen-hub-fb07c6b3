/**
 * emergency-cancel-queue
 * ONE-TIME USE — cancels all emails queued in the last N hours that haven't been sent yet.
 * Requires: { secret: "NIVRA_EMERGENCY_2026", hours_back: 6 }
 * Returns: { cancelled: number, list: [...] }
 */
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  let body: any = {};
  try { body = await req.json(); } catch { /* */ }

  if (body.secret !== "NIVRA_EMERGENCY_2026") return json({ error: "Unauthorized" }, 401);

  const hoursBack = Number(body.hours_back ?? 6);
  const cutoff = new Date(Date.now() - hoursBack * 3600 * 1000).toISOString();

  // Fetch what we're about to cancel (for the report)
  const { data: pending } = await supabase
    .from("email_queue")
    .select("id, to_email, template_key, created_at, status")
    .eq("status", "queued")
    .gte("created_at", cutoff)
    .order("created_at", { ascending: false });

  if (!pending?.length) return json({ cancelled: 0, list: [], message: "No pending emails found" });

  // Cancel them all
  const ids = pending.map((r: any) => r.id);
  const { error } = await supabase
    .from("email_queue")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .in("id", ids);

  if (error) return json({ error: error.message }, 500);

  return json({
    cancelled: ids.length,
    list: pending.map((r: any) => ({ id: r.id, to: r.to_email, template: r.template_key, queued_at: r.created_at })),
  });
});
