/**
 * pos-square-intent — create a field_payment_intents row so the POS agent
 * can charge a new order via SquarePaymentForm before the order/invoice
 * exists. The intent is later matched by square-charge-invoice using
 * intent_id.
 *
 * Body:
 *   { amount, customer_email?, customer_name?,
 *     description?, line_items?,               // shown on /payer/:id
 *     mode?: 'inline' | 'link' | 'email',     // default 'inline'
 *     send_email?: boolean }                   // force queue payment link email
 * Returns: { ok, intent_id, payment_url, email_sent, email_error? }
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

import { enqueueCommunication } from "../_shared/enqueueCommunication.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SITE_URL = "https://nivra-telecom.ca";
const SYSTEM_AGENT_ID = "00000000-0000-0000-0000-000000000001";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const json = (b: object, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));
    const amount = Number(body?.amount);
    if (!amount || amount <= 0) return json({ ok: false, error: "amount requis (> 0)" }, 400);

    const mode: "inline" | "link" | "email" = body?.mode === "email" || body?.send_email
      ? "email"
      : (body?.mode === "link" ? "link" : "inline");

    let agentId = SYSTEM_AGENT_ID;
    let agentName = "Nivra Telecom";
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (token && token !== Deno.env.get("SUPABASE_ANON_KEY")) {
      try {
        const { data: { user } } = await supabase.auth.getUser(token);
        if (user?.id) {
          agentId = user.id;
          const { data: prof } = await supabase.from("profiles").select("full_name").eq("user_id", user.id).maybeSingle();
          if (prof?.full_name) agentName = prof.full_name;
        }
      } catch { /* fallback */ }
    }

    // Longer lifetime for email links so the customer has time to pay
    const expiresMs = mode === "inline" ? 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
    const expires = new Date(Date.now() + expiresMs).toISOString();

    const lineItems = Array.isArray(body?.line_items) ? body.line_items : null;
    const description: string | null = typeof body?.description === "string" && body.description.trim()
      ? body.description.trim()
      : (lineItems && lineItems.length
          ? lineItems.map((li: any) => `${li?.name || "Article"}${li?.quantity && li.quantity > 1 ? ` ×${li.quantity}` : ""}`).join(", ")
          : null);

    const { data: intent, error } = await supabase
      .from("field_payment_intents")
      .insert({
        agent_id: agentId,
        amount,
        currency: "CAD",
        status: "pending",
        payment_method: mode === "inline" ? "square_inline" : "square_link",
        customer_email: body?.customer_email ?? null,
        customer_name: body?.customer_name ?? null,
        description,
        line_items: lineItems,
        expires_at: expires,
      })
      .select("id")
      .single();

    if (error || !intent) return json({ ok: false, error: error?.message || "insert failed" }, 500);

    const paymentUrl = `${SITE_URL}/payer/${intent.id}`;
    let emailSent = false;
    let emailError: string | null = null;

    if (mode === "email" && body?.customer_email) {
      try {
        const orderRef = `POS-${intent.id.slice(0, 8).toUpperCase()}`;
        let qErr: any = null;
        try { await enqueueCommunication({
          channel: "email",
          templateKey: "field_payment_link",
          recipient: body.customer_email,
          idempotencyKey: `pos_payment_link_${intent.id}`,
          templateVars: {
            client_name: body?.customer_name || "Client",
            first_name: (body?.customer_name || "Client").split(" ")[0],
            order_number: orderRef,
            invoice_number: orderRef,
            amount: Number(amount).toFixed(2),
            total: Number(amount).toFixed(2),
            payment_url: paymentUrl,
            approval_url: paymentUrl,
            summary: description || "Commande Nivra",
            description: description || "Commande Nivra",
            services: description || "Commande Nivra",
            agent_name: agentName,
            valid_until: "7 jours à compter de ce courriel",
          },
        }); } catch (__e) { qErr = __e; }
        if (qErr) {
          emailError = qErr.message;
          console.error("[pos-square-intent] email_queue insert failed:", qErr);
        } else {
          emailSent = true;
        }
      } catch (e: any) {
        emailError = e?.message || String(e);
        console.error("[pos-square-intent] email queue exception:", e);
      }
    }

    return json({ ok: true, intent_id: intent.id, payment_url: paymentUrl, email_sent: emailSent, email_error: emailError });
  } catch (e: any) {
    return json({ ok: false, error: e?.message || String(e) }, 500);
  }
});
