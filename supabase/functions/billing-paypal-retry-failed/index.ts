// ============================================================
// B2: PayPal failed-charge retry (24h after first failure)
// ============================================================
// Looks for billing_payments with status='failed' provider='paypal'
// where the failure happened ≥24h ago and ≤72h ago, then retries
// the charge once. After 3 total attempts it stops (lifecycle
// suspension at J+5 takes over).
//
// Tracks via billing_payments.metadata.retry_count.
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

  const now = new Date();
  const window24h = new Date(now);
  window24h.setHours(window24h.getHours() - 24);
  const window72h = new Date(now);
  window72h.setHours(window72h.getHours() - 72);

  let retried = 0;
  let skipped = 0;
  const errors: string[] = [];

  try {
    // Failed PayPal payments in the 24-72h retry window
    const { data: failed, error } = await supabase
      .from("billing_payments")
      .select(`
        id, invoice_id, customer_id, amount, metadata, created_at,
        invoice:billing_invoices(id, invoice_number, status, subscription_id, total,
          customer:billing_customers(email, first_name, last_name))
      `)
      .eq("status", "failed")
      .eq("provider", "paypal")
      .lte("created_at", window24h.toISOString())
      .gte("created_at", window72h.toISOString());

    if (error) throw error;

    console.log(`[paypal-retry] Found ${failed?.length || 0} failed PayPal charges in retry window`);

    for (const pmt of failed || []) {
      const meta = (pmt.metadata as any) || {};
      const retryCount = Number(meta.retry_count || 0);

      if (retryCount >= 3) {
        // Retries exhausted — send Interac fallback email (idempotent via event_key)
        const inv = pmt.invoice as any;
        if (inv && !["paid", "void"].includes(inv.status) && inv.customer?.email) {
          const escalationKey = `paypal_escalated_${pmt.invoice_id}`;
          const { data: alreadySent } = await supabase
            .from("email_queue")
            .select("id")
            .eq("event_key", escalationKey)
            .limit(1)
            .maybeSingle();
          if (!alreadySent) {
            await supabase.from("email_queue").insert({
              event_key: escalationKey,
              to_email: inv.customer.email,
              template_key: "paypal_payment_exhausted",
              template_vars: {
                client_name: `${inv.customer.first_name} ${inv.customer.last_name}`.trim() || inv.customer.email,
                plan_name: (inv as any).plan_name || "",
                amount: inv.total,
                invoice_number: inv.invoice_number || "",
                interac_email: "support@nivra-telecom.ca",
              },
              status: "queued",
              attempts: 0,
              max_attempts: 3,
            });
            console.log(`[paypal-retry] Escalation email queued for invoice ${pmt.invoice_id} (retries exhausted)`);
          }
        }
        skipped++;
        continue;
      }

      // Skip if invoice already paid or void
      if (!pmt.invoice || ["paid", "void"].includes((pmt.invoice as any).status)) {
        skipped++;
        continue;
      }

      const sub = (pmt.invoice as any).subscription_id;
      if (!sub) {
        skipped++;
        continue;
      }

      try {
        // Trigger PayPal charge attempt
        const { error: chargeErr } = await supabase.functions.invoke("paypal-charge-subscription", {
          body: {
            subscription_id: sub,
            invoice_id: pmt.invoice_id,
            amount: pmt.amount,
          },
        });

        // Update retry count regardless of outcome
        await supabase
          .from("billing_payments")
          .update({
            metadata: { ...meta, retry_count: retryCount + 1, last_retry_at: now.toISOString() },
          })
          .eq("id", pmt.id);

        retried++;

        // Notify customer of retry
        const inv = pmt.invoice as any;
        if (inv.customer?.email) {
          const nextRetryDate = new Date(now);
          nextRetryDate.setHours(nextRetryDate.getHours() + 24);

          await supabase.from("email_queue").insert({
            event_key: `paypal_retry_${pmt.id}_${retryCount + 1}`,
            idempotency_key: `paypal_retry_${pmt.id}_${retryCount + 1}`,
            to_email: inv.customer.email,
            from_email: "Nivra Telecom <support@nivra-telecom.ca>",
            subject: chargeErr 
              ? `Paiement échoué — nouvelle tentative demain`
              : `Paiement réessayé avec succès`,
            template_key: "paypal_charge_failed_retry",
            template_vars: {
              client_name: `${inv.customer.first_name} ${inv.customer.last_name}`,
              invoice_number: inv.invoice_number,
              total: inv.total,
              retry_date: nextRetryDate.toISOString().split("T")[0],
              attempt: retryCount + 1,
            },
            status: "queued",
            attempts: 0,
            max_attempts: 3,
          });
        }

        console.log(`[paypal-retry] Retried payment ${pmt.id} (attempt ${retryCount + 1})`);
      } catch (err) {
        const msg = `Retry ${pmt.id}: ${err instanceof Error ? err.message : String(err)}`;
        errors.push(msg);
        console.error(`[paypal-retry] ${msg}`);
      }
    }

    return new Response(
      JSON.stringify({ success: true, retried, skipped, errors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[paypal-retry] Fatal: ${msg}`);
    return new Response(
      JSON.stringify({ error: msg, retried }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
