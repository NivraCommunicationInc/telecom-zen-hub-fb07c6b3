// ============================================================
// B2: J+25 Autopay activation invitations
// ============================================================
// Finds active subscriptions WITHOUT paypal_subscription_id whose
// current cycle is 25+ days old (i.e. ~5 days before next renewal),
// and sends them a one-click invitation to enable PayPal autopay.
//
// Idempotent: tracks via email_queue.event_key = `autopay_invite_${sub.id}_${cycle_start}`.
// Runs daily via pg_cron.
// ============================================================

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase: any = createClient<any>(supabaseUrl, supabaseServiceKey);

  const today = new Date();
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - 25); // sub started 25+ days ago
  const cutoffStr = cutoff.toISOString().split("T")[0];

  let processed = 0;
  let queued = 0;
  const errors: string[] = [];

  try {
    // Active subs, no PayPal autopay, cycle started ≥25 days ago
    const { data: subs, error: subErr } = await supabase
      .from("billing_subscriptions")
      .select(`
        id, plan_name, plan_price, customer_id, cycle_start_date, cycle_end_date,
        paypal_subscription_id,
        customer:billing_customers(email, first_name, last_name)
      `)
      .eq("status", "active")
      .is("paypal_subscription_id", null)
      .lte("cycle_start_date", cutoffStr);

    if (subErr) throw subErr;

    console.log(`[autopay-invite] Found ${subs?.length || 0} subs eligible for J+25 invitation`);

    for (const sub of subs || []) {
      processed++;
      try {
        if (!sub.customer?.email) continue;

        const eventKey = `autopay_invite_${sub.id}_${sub.cycle_start_date}`;

        // Idempotency
        const { data: existing } = await supabase
          .from("email_queue")
          .select("id")
          .or(`event_key.eq.${eventKey},idempotency_key.eq.${eventKey}`)
          .maybeSingle();

        if (existing) continue;

        await supabase.from("email_queue").insert({
          event_key: eventKey,
          idempotency_key: eventKey,
          to_email: sub.customer.email,
          from_email: "Nivra Telecom <support@nivra-telecom.ca>",
          subject: "Évitez les coupures — activez le paiement automatique",
          template_key: "autopay_activation_invitation",
          template_vars: {
            client_name: `${sub.customer.first_name} ${sub.customer.last_name}`,
            plan_name: sub.plan_name,
            monthly_total: sub.plan_price,
            next_renewal_date: sub.cycle_end_date,
            activation_link: `https://nivra-telecom.ca/portail/facturation?action=enable_autopay&sub=${sub.id}`,
          },
          status: "queued",
          attempts: 0,
          max_attempts: 3,
          max_retries: 3,
        });
        queued++;
      } catch (err) {
        const msg = `Sub ${sub.id}: ${err instanceof Error ? err.message : String(err)}`;
        errors.push(msg);
        console.error(`[autopay-invite] ${msg}`);
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed, queued, errors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[autopay-invite] Fatal: ${msg}`);
    return new Response(
      JSON.stringify({ error: msg, processed, queued }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
