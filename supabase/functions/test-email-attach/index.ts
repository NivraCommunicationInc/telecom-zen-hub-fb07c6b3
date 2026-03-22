import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Test 1: direct SQL insert
  const { data: sqlResult, error: sqlErr } = await supabase.rpc("execute_sql" as any, {
    sql: "SELECT auth.role() as role"
  });

  // Test 2: Try insert + immediate read
  const testKey = "test_receipt_proof_" + Date.now();
  const { error: insertErr } = await supabase.from("email_queue").insert({
    event_key: testKey,
    to_email: "nivratelecom@gmail.com",
    template_key: "payment_confirmed",
    template_vars: {
      client_name: "Table Lakay",
      invoice_number: "4612661",
      invoice_id: "9665f877-ce11-4ba6-9578-e2ca7c4ac9e8",
      amount: "344.93",
      total_payable: "344.93",
      payment_method: "interac",
      subtotal: "300.00",
      tps_amount: "15.00",
      tvq_amount: "29.93",
    },
    status: "queued",
    attempts: 0,
    max_attempts: 5,
  });

  // Try to read it back
  const { data: readBack, error: readErr } = await supabase
    .from("email_queue")
    .select("id, event_key, status")
    .eq("event_key", testKey)
    .maybeSingle();

  // Count total queued
  const { count } = await supabase
    .from("email_queue")
    .select("*", { count: "exact", head: true })
    .in("status", ["queued", "pending"]);

  return new Response(JSON.stringify({
    testKey,
    insertError: insertErr?.message || null,
    insertCode: insertErr?.code || null,
    readBack,
    readError: readErr?.message || null,
    queuedCount: count,
  }, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
});
