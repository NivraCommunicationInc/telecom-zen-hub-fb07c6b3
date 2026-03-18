import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY")!;
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const { payment_intent_id } = await req.json();
    
    const pi = await stripe.paymentIntents.confirm(payment_intent_id, {
      payment_method: "pm_card_visa",
      return_url: "https://telecom-zen-hub.lovable.app/checkout/complete",
    });
    
    return new Response(JSON.stringify({
      id: pi.id,
      status: pi.status,
      capture_method: pi.capture_method,
      amount: pi.amount,
      amount_capturable: pi.amount_capturable,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
