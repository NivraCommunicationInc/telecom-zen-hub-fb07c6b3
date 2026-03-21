/**
 * field-sale-payment — V3: Uses centralized NivraPaymentIntentFactory
 * - action: "create_payment_link" → Creates Stripe Checkout session & sends link via email
 * - action: "create_payment_intent" → Creates PaymentIntent via shared factory
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "npm:stripe@18.5.0";
import { createNivraPaymentIntent } from "../_shared/nivraPaymentIntentFactory.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // ═══ STRIPE KILL-SWITCH — 2026-03-21 ═══
  console.warn("[field-sale-payment] BLOCKED — Stripe disabled in production");
  return new Response(
    JSON.stringify({ error: "Stripe field payments are disabled. Use PayPal instead." }),
    { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not configured");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const body = await req.json();
    const {
      action, amount, customer_email, customer_name, customer_phone,
      description, lead_id,
      order_id, order_number, invoice_id, invoice_number,
      service_name, plan_type, account_id, account_number,
      billing_address, billing_city, billing_province, billing_postal_code,
      customer_id, subscription_id,
    } = body;

    if (!action) throw new Error("Missing action parameter");
    if (!amount || amount <= 0) throw new Error("Invalid amount");

    const amountCents = Math.round(amount * 100);
    const origin = req.headers.get("origin") || "https://telecom-zen-hub.lovable.app";

    // ═══ RICH METADATA for Checkout Sessions ═══
    const sessionMetadata: Record<string, string> = {
      source: "field_sale",
      lead_id: lead_id || "",
      agent_context: "field_portal",
    };
    if (order_id) sessionMetadata.order_id = order_id;
    if (order_number) sessionMetadata.order_number = String(order_number);
    if (invoice_id) sessionMetadata.invoice_id = invoice_id;
    if (invoice_number) sessionMetadata.invoice_number = String(invoice_number);
    if (service_name) sessionMetadata.service_name = service_name;
    if (plan_type) sessionMetadata.plan_type = plan_type;
    if (account_number) sessionMetadata.account_number = String(account_number);
    sessionMetadata.total_amount = String(amount);

    if (action === "create_payment_link") {
      // Find or create Stripe customer for checkout session
      let stripeCustomerId: string | undefined;
      if (customer_email) {
        const customers = await stripe.customers.list({ email: customer_email, limit: 1 });
        if (customers.data.length > 0) {
          stripeCustomerId = customers.data[0].id;
        } else {
          const newCust = await stripe.customers.create({
            email: customer_email,
            ...(customer_name ? { name: customer_name } : {}),
            ...(customer_phone ? { phone: customer_phone } : {}),
            ...(billing_address ? {
              address: {
                line1: billing_address,
                city: billing_city || undefined,
                state: billing_province || "QC",
                postal_code: billing_postal_code || undefined,
                country: "CA",
              }
            } : {}),
          });
          stripeCustomerId = newCust.id;
        }
      }

      const sessionParams: Stripe.Checkout.SessionCreateParams = {
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "cad",
              product_data: {
                name: service_name || description || "Nivra — Commande terrain",
                description: order_number ? `Commande ${order_number}` : `Réf: ${lead_id || "N/A"}`,
              },
              unit_amount: amountCents,
            },
            quantity: 1,
          },
        ],
        customer: stripeCustomerId,
        customer_email: stripeCustomerId ? undefined : (customer_email || undefined),
        success_url: `${origin}/field/sale/success?payment=completed&leadId=${lead_id || ""}`,
        cancel_url: `${origin}/field/sale/success?payment=cancelled&leadId=${lead_id || ""}`,
        metadata: sessionMetadata,
      };

      const session = await stripe.checkout.sessions.create(sessionParams);

      // Send email with payment link if customer email provided
      if (customer_email) {
        const resendKey = Deno.env.get("RESEND_API_KEY");
        if (resendKey) {
          try {
            const emailRes = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${resendKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                from: "Nivra <noreply@notify.nivra-telecom.ca>",
                to: [customer_email],
                subject: "Votre lien de paiement Nivra",
                html: `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #000000;">Bonjour ${customer_name || ""},</h2>
                    <p style="color: #374151; font-size: 16px;">
                      Votre commande Nivra est prête. Cliquez sur le bouton ci-dessous pour procéder au paiement sécurisé.
                    </p>
                    <div style="text-align: center; margin: 30px 0;">
                      <a href="${session.url}" 
                         style="background-color: #22C55E; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                        Payer ${(amount).toFixed(2)} $ CAD
                      </a>
                    </div>
                    <p style="color: #6B7280; font-size: 14px;">
                      Ce lien est sécurisé et expire après usage. Si vous avez des questions, contactez-nous.
                    </p>
                    <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 20px 0;" />
                    <p style="color: #9CA3AF; font-size: 12px;">Nivra Télécom — Paiement sécurisé par Stripe</p>
                  </div>
                `,
              }),
            });
            const emailData = await emailRes.text();
            console.log("[field-sale-payment] Email sent:", emailRes.status, emailData);
          } catch (emailErr) {
            console.error("[field-sale-payment] Email send failed (non-blocking):", emailErr);
          }
        }
      }

      return new Response(
        JSON.stringify({ success: true, checkout_url: session.url, session_id: session.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    if (action === "create_payment_intent") {
      // ═══ USE CENTRALIZED FACTORY ═══
      const result = await createNivraPaymentIntent({
        stripe,
        customer_email: customer_email || "",
        invoice_id: invoice_id || "",
        invoice_number: invoice_number || "",
        service_name: service_name || "Nivra — Vente terrain",
        total_amount: amount,
        order_id,
        order_number: order_number ? String(order_number) : undefined,
        subscription_id,
        customer_name,
        customer_phone,
        customer_id,
        account_id,
        account_number: account_number ? String(account_number) : undefined,
        billing_address: billing_address ? {
          line1: billing_address,
          city: billing_city || undefined,
          state: billing_province || "QC",
          postal_code: billing_postal_code || undefined,
          country: "CA",
        } : undefined,
        plan_type,
        capture_method: "automatic",
        source: "field_sale",
        intent_context: "field_sale",
      });

      return new Response(
        JSON.stringify({
          success: true,
          client_secret: result.client_secret,
          payment_intent_id: result.payment_intent_id,
          livemode: result.livemode,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (error: unknown) {
    console.error("[field-sale-payment] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
