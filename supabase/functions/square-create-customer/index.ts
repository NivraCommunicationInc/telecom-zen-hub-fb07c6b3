import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SQUARE_API = "https://connect.squareup.com/v2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  const squareToken = Deno.env.get("SQUARE_ACCESS_TOKEN")!;

  try {
    const { customer_id } = await req.json();
    if (!customer_id) throw new Error("customer_id requis");

    // Get billing customer info
    const { data: bc, error: bcErr } = await supabase
      .from("billing_customers")
      .select("id, email, first_name, last_name, square_customer_id")
      .eq("id", customer_id)
      .single();
    if (bcErr || !bc) throw new Error("Client introuvable");

    // Already has Square customer
    if (bc.square_customer_id) {
      return new Response(JSON.stringify({ ok: true, square_customer_id: bc.square_customer_id, already_existed: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create Square customer
    const res = await fetch(`${SQUARE_API}/customers`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${squareToken}`,
        "Content-Type": "application/json",
        "Square-Version": "2024-11-20",
      },
      body: JSON.stringify({
        given_name: bc.first_name || "",
        family_name: bc.last_name || "",
        email_address: bc.email,
        reference_id: bc.id,
        idempotency_key: `create-customer-${bc.id}`,
      }),
    });

    const body = await res.json();
    if (!res.ok) throw new Error(`Square error: ${JSON.stringify(body.errors)}`);

    const squareCustomerId = body.customer.id;

    // Save to DB
    await supabase.from("billing_customers")
      .update({ square_customer_id: squareCustomerId })
      .eq("id", bc.id);

    return new Response(JSON.stringify({ ok: true, square_customer_id: squareCustomerId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[square-create-customer]", e);
    return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
