/**
 * core-square-payment-link
 * Creates a field_payment_intent linked to an existing billing invoice,
 * optionally sends the payment URL by email, and returns the URL.
 *
 * Body: { invoice_id, customer_email?, customer_name?, mode?: 'email'|'direct' }
 * Returns: { ok, payment_url, email_sent }
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SITE_URL = "https://nivra-telecom.ca";
const SYSTEM_AGENT_ID = "00000000-0000-0000-0000-000000000001";

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

    const body = await req.json();
    const { invoice_id, customer_email, customer_name, mode } = body;

    if (!invoice_id) return json({ ok: false, error: "invoice_id requis" }, 400);

    // Try to extract caller's user_id from JWT (for agent_id audit trail)
    let agentId = SYSTEM_AGENT_ID;
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (token && token !== Deno.env.get("SUPABASE_ANON_KEY")) {
      try {
        const { data: { user } } = await supabase.auth.getUser(token);
        if (user?.id) agentId = user.id;
      } catch { /* use system fallback */ }
    }

    // Load invoice to get amount + customer data
    const { data: inv, error: invErr } = await supabase
      .from("billing_invoices")
      .select(
        "id, invoice_number, balance_due, total, customer_id, " +
        "customer:billing_customers(email, first_name, last_name)",
      )
      .eq("id", invoice_id)
      .single();

    if (invErr || !inv) return json({ ok: false, error: "Facture introuvable" }, 404);

    const balance = Number(inv.balance_due ?? inv.total ?? 0);
    if (balance <= 0) return json({ ok: false, error: "Facture déjà payée" }, 400);

    const resolvedEmail = customer_email || (inv.customer as any)?.email || null;
    const resolvedName = customer_name ||
      `${(inv.customer as any)?.first_name || ""} ${(inv.customer as any)?.last_name || ""}`.trim() ||
      null;

    // Create field_payment_intent linked to this invoice
    const { data: intent, error: intentErr } = await supabase
      .from("field_payment_intents")
      .insert({
        agent_id: agentId,
        amount: balance,
        currency: "CAD",
        status: "pending",
        payment_method: "square",
        customer_email: resolvedEmail,
        customer_name: resolvedName,
        converted_invoice_id: invoice_id,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
      })
      .select("id")
      .single();

    if (intentErr || !intent) {
      console.error("[core-square-payment-link] Insert error:", intentErr);
      return json({ ok: false, error: "Erreur création lien" }, 500);
    }

    const paymentUrl = `${SITE_URL}/payer/${intent.id}`;
    let emailSent = false;

    // Send email if mode = 'email' and we have an email address
    if (mode === "email" && resolvedEmail) {
      try {
        await supabase.from("email_queue").insert({
          event_key: `payment_link_${intent.id}`,
          to_email: resolvedEmail,
          template_key: "invoice_payment_link",
          template_vars: {
            client_name: resolvedName || "Client",
            first_name: (inv.customer as any)?.first_name || resolvedName || "Client",
            invoice_number: inv.invoice_number || "",
            amount: balance.toFixed(2),
            payment_url: paymentUrl,
          },
          status: "queued",
          attempts: 0,
          max_attempts: 5,
        });
        emailSent = true;
      } catch (e) {
        console.warn("[core-square-payment-link] Email queue failed (non-fatal):", e);
      }
    }

    console.log("[core-square-payment-link] Created intent", intent.id, "for invoice", invoice_id);
    return json({ ok: true, payment_url: paymentUrl, intent_id: intent.id, email_sent: emailSent });

  } catch (err: any) {
    console.error("[core-square-payment-link] Fatal:", err);
    return json({ ok: false, error: err?.message || String(err) }, 500);
  }
});
