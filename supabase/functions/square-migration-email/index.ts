/**
 * square-migration-email
 * One-shot function: queues the "paypal_migration_to_square" email for every
 * active subscription that has a paypal_subscription_id but no square_card_id.
 *
 * Call once manually after Square is fully set up:
 *   POST /functions/v1/square-migration-email
 *   Authorization: Bearer <service_role_key or admin JWT>
 *
 * Returns: { ok, sent: number, skipped: number, clients: string[] }
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

import { enqueueCommunication } from "../_shared/enqueueCommunication.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SETUP_URL = "https://nivra-telecom.ca/portal/billing";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const json = (body: object, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Find active subscriptions with PayPal but no Square card
    const { data: subs, error } = await supabase
      .from("billing_subscriptions")
      .select(`
        id, plan_name, plan_price, customer_id,
        customer:billing_customers(email, first_name, last_name, square_card_id, user_id)
      `)
      .eq("status", "active")
      .not("paypal_subscription_id", "is", null);

    if (error) throw error;

    let sent = 0;
    let skipped = 0;
    const clients: string[] = [];

    for (const sub of subs || []) {
      const customer = sub.customer as any;

      // Skip clients who already have a Square card
      if (customer?.square_card_id) {
        skipped++;
        continue;
      }

      const email = customer?.email;
      if (!email) { skipped++; continue; }

      const firstName = customer?.first_name || "Client";
      const clientName = [customer?.first_name, customer?.last_name].filter(Boolean).join(" ") || "Client";

      // Idempotency: skip if already queued this migration email for this customer
      const { data: existing } = await supabase
        .from("email_queue")
        .select("id")
        .eq("event_key", `square_migration_${sub.customer_id}`)
        .maybeSingle();

      if (existing) { skipped++; continue; }

      await enqueueCommunication({
        channel: "email",
        templateKey: "paypal_migration_to_square",
        recipient: email,
        idempotencyKey: `square_migration_${sub.customer_id}`,
        templateVars: {
          client_name: clientName,
          first_name: firstName,
          plan_name: sub.plan_name || "Forfait Nivra",
          monthly_amount: Number(sub.plan_price || 0).toFixed(2),
          setup_url: SETUP_URL,
        },
      });

      sent++;
      clients.push(`${clientName} <${email}>`);
      console.log(`[square-migration-email] Queued for ${email} (sub ${sub.id})`);
    }

    console.log(`[square-migration-email] Done — sent: ${sent}, skipped: ${skipped}`);
    return json({ ok: true, sent, skipped, clients });
  } catch (err: any) {
    console.error("[square-migration-email] Fatal:", err);
    return json({ ok: false, error: err?.message || String(err) }, 500);
  }
});
