import { createClient } from "npm:@supabase/supabase-js@2";
import { createHmac } from "node:crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-square-hmacsha256-signature",
};

// Verify Square webhook signature
function verifySignature(body: string, signature: string, sigKey: string, url: string): boolean {
  const combined = url + body;
  const hmac = createHmac("sha256", sigKey).update(combined).digest("base64");
  return hmac === signature;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  const sigKey = Deno.env.get("SQUARE_WEBHOOK_SIGNATURE_KEY") || "";

  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-square-hmacsha256-signature") || "";
    const webhookUrl = `${req.url}`;

    // Verify signature if key is configured
    if (sigKey && signature) {
      const valid = verifySignature(rawBody, signature, sigKey, webhookUrl);
      if (!valid) {
        console.error("[square-webhook] Invalid signature");
        return new Response("Unauthorized", { status: 401 });
      }
    }

    const event = JSON.parse(rawBody);
    const eventType = event.type;
    const data = event.data?.object;

    console.log(`[square-webhook] Event: ${eventType}`);

    // ── payment.completed ──────────────────────────────────────────────────
    if (eventType === "payment.completed") {
      const payment = data?.payment;
      if (!payment) return new Response("ok", { status: 200 });

      const squarePaymentId = payment.id;
      const idempotencyKey = payment.order_id || payment.id;

      // Find the payment record by square_payment_id or idempotency_key (invoice_id)
      const { data: bp } = await supabase
        .from("billing_payments")
        .select("id, invoice_id, customer_id")
        .eq("square_payment_id", squarePaymentId)
        .maybeSingle();

      if (bp) {
        await supabase.from("billing_payments")
          .update({ status: "confirmed" })
          .eq("id", bp.id);

        await supabase.from("billing_invoices")
          .update({ status: "paid", balance_due: 0, paid_at: new Date().toISOString() })
          .eq("id", bp.invoice_id);

        console.log(`[square-webhook] ✅ Payment confirmed: ${squarePaymentId}`);
      }
    }

    // ── payment.failed ─────────────────────────────────────────────────────
    if (eventType === "payment.failed") {
      const payment = data?.payment;
      if (!payment) return new Response("ok", { status: 200 });

      const squarePaymentId = payment.id;

      const { data: bp } = await supabase
        .from("billing_payments")
        .select("id, invoice_id, customer_id")
        .eq("square_payment_id", squarePaymentId)
        .maybeSingle();

      if (bp) {
        await supabase.from("billing_payments")
          .update({ status: "failed" })
          .eq("id", bp.id);

        // Alert
        await supabase.from("billing_system_alerts").insert({
          alert_type: "square_payment_failed",
          entity_type: "billing_invoice",
          entity_id: bp.invoice_id,
          severity: "warning",
          details: { message: `Paiement Square échoué: ${squarePaymentId}`, square_payment_id: squarePaymentId },
        }).catch(() => {});

        console.log(`[square-webhook] ❌ Payment failed: ${squarePaymentId}`);
      }
    }

    // ── card.updated / card.disabled ───────────────────────────────────────
    if (eventType === "card.disabled") {
      const card = data?.card;
      if (card?.id) {
        await supabase.from("billing_customers")
          .update({ square_card_id: null })
          .eq("square_card_id", card.id);
        console.log(`[square-webhook] Card disabled: ${card.id}`);
      }
    }

    return new Response(JSON.stringify({ ok: true, type: eventType }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[square-webhook] Error:", e);
    return new Response("ok", { status: 200 }); // Always 200 to Square
  }
});
