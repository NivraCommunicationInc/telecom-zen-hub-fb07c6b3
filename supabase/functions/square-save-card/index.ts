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
    const { source_id, customer_id, verification_token } = await req.json();
    if (!source_id || !customer_id) throw new Error("source_id et customer_id requis");

    // Get or create Square customer first
    const { data: bc, error: bcErr } = await supabase
      .from("billing_customers")
      .select("id, email, first_name, last_name, square_customer_id")
      .eq("id", customer_id)
      .single();
    if (bcErr || !bc) throw new Error("Client introuvable");

    let squareCustomerId = bc.square_customer_id;

    // Auto-create Square customer if needed
    if (!squareCustomerId) {
      const createRes = await fetch(
        `${Deno.env.get("SUPABASE_URL")!.replace("supabase.co", "supabase.co")}/functions/v1/square-create-customer`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ customer_id }),
        }
      );
      const createBody = await createRes.json();
      if (!createBody.ok) throw new Error(`Création client Square échouée: ${createBody.error}`);
      squareCustomerId = createBody.square_customer_id;
    }

    // Save card on file
    const payload: Record<string, unknown> = {
      source_id,
      idempotency_key: `save-card-${customer_id}-${Date.now()}`,
      card: {
        customer_id: squareCustomerId,
      },
    };
    if (verification_token) payload.verification_token = verification_token;

    const res = await fetch(`${SQUARE_API}/cards`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${squareToken}`,
        "Content-Type": "application/json",
        "Square-Version": "2024-11-20",
      },
      body: JSON.stringify(payload),
    });

    const body = await res.json();
    if (!res.ok) throw new Error(`Square error: ${JSON.stringify(body.errors)}`);

    const squareCardId = body.card.id;
    const cardBrand = body.card.card_brand;
    const last4 = body.card.last_4;

    // Save card ID to billing_customers
    await supabase.from("billing_customers")
      .update({ square_card_id: squareCardId })
      .eq("id", customer_id);

    return new Response(JSON.stringify({
      ok: true,
      square_card_id: squareCardId,
      card_brand: cardBrand,
      last_4: last4,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[square-save-card]", e);
    return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
