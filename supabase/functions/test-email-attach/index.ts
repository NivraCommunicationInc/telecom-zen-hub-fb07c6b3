import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const tests = [
    {
      event_key: "test_receipt_proof_final_001",
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
    },
    {
      event_key: "test_summary_proof_final_001",
      to_email: "nivratelecom@gmail.com",
      template_key: "order_submitted",
      template_vars: {
        client_name: "Table Lakay",
        order_number: "61567",
        order_id: "f473afe3-03f9-40d5-abfd-19880502249b",
        invoice_number: "4612661",
        invoice_id: "9665f877-ce11-4ba6-9578-e2ca7c4ac9e8",
        subtotal: "300.00",
        tps_amount: "15.00",
        tvq_amount: "29.93",
        total: "344.93",
        service_type: "Internet 300",
      },
    },
  ];

  const results = [];
  for (const t of tests) {
    const { error } = await supabase.from("email_queue").insert({
      event_key: t.event_key,
      to_email: t.to_email,
      template_key: t.template_key,
      template_vars: t.template_vars,
      status: "queued",
      attempts: 0,
      max_attempts: 5,
    });
    results.push({ event_key: t.event_key, error: error?.message || null });
  }

  return new Response(JSON.stringify({ results }), {
    headers: { "Content-Type": "application/json" },
  });
});
