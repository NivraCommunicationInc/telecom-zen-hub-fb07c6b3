import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY")!;
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json();
    const { action, payment_intent_id, payment_id, invoice_id } = body;

    if (action === "confirm") {
      const pi = await stripe.paymentIntents.confirm(payment_intent_id, {
        payment_method: "pm_card_visa",
        return_url: "https://telecom-zen-hub.lovable.app/checkout/complete",
      });
      return new Response(JSON.stringify({
        id: pi.id, status: pi.status, capture_method: pi.capture_method,
        amount: pi.amount, amount_capturable: pi.amount_capturable,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "capture") {
      const captured = await stripe.paymentIntents.capture(payment_intent_id);
      const capturedDollars = captured.amount_received / 100;

      if (payment_id) {
        await supabase.from("billing_payments").update({
          status: "confirmed", authorization_status: "captured",
          captured_at: new Date().toISOString(), captured_by: "admin_validation_test",
          confirmed_by: "admin_validation_test", received_at: new Date().toISOString(),
        }).eq("id", payment_id);
      }
      if (invoice_id) {
        const { data: inv } = await supabase.from("billing_invoices").select("amount_paid, total").eq("id", invoice_id).single();
        if (inv) {
          const newPaid = (inv.amount_paid ?? 0) + capturedDollars;
          const newBalance = Math.max(0, (inv.total ?? 0) - newPaid);
          await supabase.from("billing_invoices").update({
            amount_paid: newPaid, balance_due: newBalance,
            status: newBalance <= 0 ? "paid" : "partially_paid",
            paid_at: newBalance <= 0 ? new Date().toISOString() : null,
          }).eq("id", invoice_id);
        }
      }
      return new Response(JSON.stringify({
        id: captured.id, status: captured.status, amount_received: captured.amount_received,
        amount_captured: capturedDollars,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "cancel") {
      const cancelled = await stripe.paymentIntents.cancel(payment_intent_id, {
        cancellation_reason: "requested_by_customer",
      });
      if (payment_id) {
        await supabase.from("billing_payments").update({
          status: "cancelled", authorization_status: "cancelled",
        }).eq("id", payment_id);
      }
      if (invoice_id) {
        await supabase.from("billing_invoices").update({ status: "unpaid" }).eq("id", invoice_id);
      }
      return new Response(JSON.stringify({
        id: cancelled.id, status: cancelled.status,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    throw new Error("Unknown action");
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
