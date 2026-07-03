import { createClient } from "npm:@supabase/supabase-js@2";
import { writePaymentAutoNote } from "../_shared/paymentAutoNote.ts";


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SQUARE_API = "https://connect.squareup.com/v2";
const LOCATION_ID = Deno.env.get("SQUARE_LOCATION_ID")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  const squareToken = Deno.env.get("SQUARE_ACCESS_TOKEN")!;

  try {
    const { subscription_id, invoice_id, amount } = await req.json();
    if (!subscription_id || !invoice_id || amount === undefined) {
      throw new Error("subscription_id, invoice_id et amount requis");
    }

    // Get subscription + customer info
    const { data: sub, error: subErr } = await supabase
      .from("billing_subscriptions")
      .select("id, customer_id, plan_name, billing_customers(id, email, square_customer_id, square_card_id)")
      .eq("id", subscription_id)
      .single();
    if (subErr || !sub) throw new Error("Subscription introuvable");

    const bc = sub.billing_customers as any;
    if (!bc?.square_customer_id || !bc?.square_card_id) {
      return new Response(JSON.stringify({ ok: false, error: "NO_SQUARE_CARD", message: "Client n'a pas de carte Square enregistrée" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Amount in cents (Square uses smallest currency unit)
    const amountCents = Math.round(Number(amount) * 100);

    // Create Square payment
    const res = await fetch(`${SQUARE_API}/payments`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${squareToken}`,
        "Content-Type": "application/json",
        "Square-Version": "2024-11-20",
      },
      body: JSON.stringify({
        source_id: bc.square_card_id,
        idempotency_key: `charge-${invoice_id}`,
        amount_money: {
          amount: amountCents,
          currency: "CAD",
        },
        customer_id: bc.square_customer_id,
        location_id: LOCATION_ID,
        note: `Facture ${invoice_id} — ${sub.plan_name || "Abonnement Nivra"}`,
        autocomplete: true,
      }),
    });

    const body = await res.json();

    if (!res.ok) {
      const errMsg = body.errors?.map((e: any) => e.detail).join(", ") || "Square payment failed";
      console.error("[square-charge-subscription] Payment failed:", errMsg);
      return new Response(JSON.stringify({ ok: false, error: errMsg }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payment = body.payment;
    const squarePaymentId = payment.id;
    const receiptUrl = payment.receipt_url || null;

    // Update billing_payment record with Square info
    await supabase.from("billing_payments")
      .update({
        square_payment_id: squarePaymentId,
        square_receipt_url: receiptUrl,
        status: "confirmed",
        provider: "square",
      })
      .eq("invoice_id", invoice_id)
      .eq("status", "pending");

    // Mark invoice as paid
    await supabase.from("billing_invoices")
      .update({ status: "paid", balance_due: 0, paid_at: new Date().toISOString() })
      .eq("id", invoice_id);

    console.log(`[square-charge-subscription] ✅ Charged ${amount} CAD for invoice ${invoice_id}, Square payment ${squarePaymentId}`);

    return new Response(JSON.stringify({
      ok: true,
      square_payment_id: squarePaymentId,
      receipt_url: receiptUrl,
      amount_charged: amount,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[square-charge-subscription]", e);
    return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
