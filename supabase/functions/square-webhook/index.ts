/**
 * square-webhook
 * Receives Square webhook events. Primarily handles payment disputes (chargebacks).
 * COF charge outcomes are handled synchronously by square-charge-subscription,
 * so this webhook focuses on post-charge events: DISPUTE_CREATED and payment.updated FAILED.
 *
 * Square signature verification: SQUARE_WEBHOOK_SIGNATURE_KEY must be set in Supabase secrets.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-square-hmacsha256-signature",
};

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

    // Verify Square webhook signature
    const signatureKey = Deno.env.get("SQUARE_WEBHOOK_SIGNATURE_KEY");
    const rawBody = await req.text();

    if (signatureKey) {
      const signatureHeader = req.headers.get("x-square-hmacsha256-signature") || "";
      const webhookUrl = req.headers.get("x-forwarded-url") || req.url;

      const enc = new TextEncoder();
      const keyData = enc.encode(signatureKey);
      const msgData = enc.encode(webhookUrl + rawBody);

      const cryptoKey = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
      const sigBuf = await crypto.subtle.sign("HMAC", cryptoKey, msgData);
      const expected = btoa(String.fromCharCode(...new Uint8Array(sigBuf)));

      if (expected !== signatureHeader) {
        console.warn("[square-webhook] Signature mismatch — rejected");
        return json({ error: "Invalid signature" }, 401);
      }
    } else {
      console.warn("[square-webhook] SQUARE_WEBHOOK_SIGNATURE_KEY not set — skipping verification (dev mode)");
    }

    const event = JSON.parse(rawBody);
    const eventType: string = event.type || "";
    const eventId: string = event.event_id || "";

    console.log(`[square-webhook] Event: ${eventType} (${eventId})`);

    if (eventType === "payment.updated") {
      const payment = event.data?.object?.payment;
      if (!payment) return json({ ok: true, skipped: "no payment object" });

      const paymentId: string = payment.id;
      const status: string = payment.status;

      if (status === "FAILED") {
        const { data: bp } = await supabase
          .from("billing_payments")
          .select("id, invoice_id, customer_id, amount")
          .eq("provider_payment_id", paymentId)
          .maybeSingle();

        if (bp) {
          await supabase
            .from("billing_payments")
            .update({ status: "failed", metadata: { square_status: status, failed_at: new Date().toISOString() } })
            .eq("id", bp.id);

          await supabase.from("billing_system_alerts").insert({
            alert_type: "square_payment_failed_webhook",
            entity_type: "billing_payment",
            entity_id: bp.id,
            severity: "warning",
            details: { payment_id: paymentId, invoice_id: bp.invoice_id, amount: bp.amount, square_status: status },
          });

          console.log(`[square-webhook] Payment ${paymentId} marked FAILED`);
        }
      }
    }

    if (eventType === "dispute.created" || eventType === "dispute.state.changed") {
      const dispute = event.data?.object?.dispute;
      if (!dispute) return json({ ok: true, skipped: "no dispute object" });

      const disputeId: string = dispute.id;
      const state: string = dispute.state;

      await supabase.from("billing_system_alerts").insert({
        alert_type: "square_dispute",
        entity_type: "square_payment",
        entity_reference: dispute.disputed_payment?.payment_id || disputeId,
        severity: "critical",
        details: {
          message: `Litige Square ${state} — ${(dispute.amount_money?.amount || 0) / 100} $ CAD`,
          dispute_id: disputeId,
          state,
          reason: dispute.reason,
          due_at: dispute.due_at,
          amount_cents: dispute.amount_money?.amount,
          payment_id: dispute.disputed_payment?.payment_id,
        },
      });

      console.log(`[square-webhook] Dispute ${disputeId} state=${state} — critical alert created`);
    }

    return json({ ok: true, event_type: eventType });
  } catch (err: any) {
    console.error("[square-webhook] Fatal:", err);
    return json({ ok: false, error: err?.message || String(err) }, 500);
  }
});
