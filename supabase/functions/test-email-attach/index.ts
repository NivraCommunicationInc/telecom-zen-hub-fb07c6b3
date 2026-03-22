import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Check what's in the queue
  const { data: existing, error: qErr } = await supabase
    .from("email_queue")
    .select("id, event_key, template_key, status, created_at")
    .in("event_key", ["test_receipt_proof_final_001", "test_summary_proof_final_001"]);

  // Also check all queued
  const { data: allQueued, error: aErr } = await supabase
    .from("email_queue")
    .select("id, event_key, template_key, status")
    .in("status", ["queued", "pending"])
    .order("created_at", { ascending: false })
    .limit(10);

  return new Response(JSON.stringify({ 
    existing, 
    existingError: qErr?.message,
    allQueued,
    allQueuedError: aErr?.message,
  }, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
});
