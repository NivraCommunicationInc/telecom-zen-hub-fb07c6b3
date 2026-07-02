/**
 * pos-square-intent — create a field_payment_intents row so the POS agent
 * can charge a new order via SquarePaymentForm before the order/invoice
 * exists. The intent is later matched by square-charge-invoice using
 * intent_id.
 *
 * Body: { amount, customer_email?, customer_name? }
 * Returns: { ok, intent_id }
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_AGENT_ID = "00000000-0000-0000-0000-000000000001";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const json = (b: object, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));
    const amount = Number(body?.amount);
    if (!amount || amount <= 0) return json({ ok: false, error: "amount requis (> 0)" }, 400);

    let agentId = SYSTEM_AGENT_ID;
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (token && token !== Deno.env.get("SUPABASE_ANON_KEY")) {
      try {
        const { data: { user } } = await supabase.auth.getUser(token);
        if (user?.id) agentId = user.id;
      } catch { /* fallback */ }
    }

    const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1h

    const { data, error } = await supabase
      .from("field_payment_intents")
      .insert({
        agent_id: agentId,
        amount,
        currency: "CAD",
        status: "pending",
        payment_method: "square",
        customer_email: body?.customer_email ?? null,
        customer_name: body?.customer_name ?? null,
        expires_at: expires,
      })
      .select("id")
      .single();

    if (error) return json({ ok: false, error: error.message }, 500);
    return json({ ok: true, intent_id: data.id });
  } catch (e: any) {
    return json({ ok: false, error: e?.message || String(e) }, 500);
  }
});
