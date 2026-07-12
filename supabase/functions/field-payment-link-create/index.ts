/**
 * field-payment-link-create
 * Agent → Client secure Square payment link.
 *
 * Reads a `field_quotes` row prepared by the agent, creates a
 * `field_payment_intents` row (payment_method='square'), and enqueues the
 * `field_payment_link` email with the /payer/{intent.id} URL.
 *
 * Body: { quote_id, mode?: 'email'|'link_only', override_email? }
 * Returns: { ok, payment_url, intent_id, expires_at, email_sent }
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

import { enqueueCommunication } from "../_shared/enqueueCommunication.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SITE_URL = "https://nivra-telecom.ca";
const EXPIRY_DAYS = 7;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (b: object, s = 200) =>
    new Response(JSON.stringify(b), {
      status: s,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));
    const { quote_id, mode = "email", override_email } = body ?? {};
    if (!quote_id) return json({ ok: false, error: "quote_id requis" }, 400);

    // Identify caller (agent) — must own the quote or be staff. We resolve
    // agent from JWT if present, then fall back to quote.agent_id.
    let callerId: string | null = null;
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (token && token !== Deno.env.get("SUPABASE_ANON_KEY")) {
      try {
        const { data: { user } } = await supabase.auth.getUser(token);
        if (user?.id) callerId = user.id;
      } catch { /* anonymous ok — commission still attributed to quote.agent_id */ }
    }

    // Load quote
    const { data: quote, error: qErr } = await supabase
      .from("field_quotes")
      .select("id, agent_id, agent_name, client_info, services, equipment, discount, total, status, install_date, install_mode, subtotal, tps, tvq, activation_fee")
      .eq("id", quote_id)
      .maybeSingle();

    if (qErr || !quote) return json({ ok: false, error: "Soumission introuvable" }, 404);
    if (quote.status === "converted") return json({ ok: false, error: "Cette soumission a déjà été convertie en commande." }, 400);

    const ci: any = quote.client_info || {};
    const resolvedEmail = override_email || ci.email || null;
    const resolvedName =
      `${ci.first_name || ci.firstName || ""} ${ci.last_name || ci.lastName || ""}`.trim() ||
      "Client";
    const total = Number(quote.total || 0);
    if (total <= 0) return json({ ok: false, error: "Montant total invalide" }, 400);

    // Reuse an existing pending intent for this quote if present (idempotent)
    const { data: existing } = await supabase
      .from("field_payment_intents")
      .select("id, expires_at, status")
      .eq("quote_id", quote_id)
      .eq("status", "pending")
      .maybeSingle();

    let intentId: string;
    let expiresAt: string;

    if (existing && new Date(existing.expires_at).getTime() > Date.now()) {
      intentId = existing.id;
      expiresAt = existing.expires_at;
    } else {
      expiresAt = new Date(Date.now() + EXPIRY_DAYS * 86400_000).toISOString();
      const { data: intent, error: insErr } = await supabase
        .from("field_payment_intents")
        .insert({
          quote_id: quote.id,
          agent_id: quote.agent_id,
          amount: total,
          currency: "CAD",
          status: "pending",
          payment_method: "square",
          source: "field_agent_link",
          customer_email: resolvedEmail,
          customer_name: resolvedName,
          expires_at: expiresAt,
        })
        .select("id")
        .single();

      if (insErr || !intent) {
        console.error("[field-payment-link-create] insert error:", insErr);
        return json({ ok: false, error: "Erreur création du lien de paiement" }, 500);
      }
      intentId = intent.id;

      // Journal — link_created
      await supabase.rpc("log_field_order_event" as never, {
        p_intent_id: intentId,
        p_event_type: "link_created",
        p_payload: { quote_id: quote.id, amount: total, caller: callerId } as never,
      }).then(undefined, () => {});
    }

    // Materialize the Core shell order.
    // BUG-CORE-001: never block the submission on shell sync failure — Core materialization
    // is now retryable via field_order_sync_events (canonical retry infrastructure).
    let shellDeferred = false;
    try {
      const matResp = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/field-order-engine`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          apikey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
        },
        body: JSON.stringify({ action: "materialize_pending_from_quote", intent_id: intentId }),
      });
      const matData = await matResp.json().catch(() => null);
      if (!matResp.ok || !matData?.success) {
        // Hard failure BEFORE field_sales_orders row was created — nothing to retry from.
        // Log an alert but let the payment link continue; the retry worker will pick it up
        // from the intent itself.
        const reason = matData?.error || `HTTP ${matResp.status}`;
        console.warn("[field-payment-link-create] shell materialization deferred (pre-fso):", reason);
        shellDeferred = true;
        await supabase.from("billing_system_alerts").insert({
          alert_type: "shell_materialization_deferred",
          entity_type: "field_payment_intent",
          entity_id: intentId,
          entity_reference: quote_id,
          details: { reason, intent_id: intentId, quote_id, stage: "pre_fso" },
          resolved: false,
        } as any).then(undefined, () => {});
        await supabase.rpc("log_field_order_event" as never, {
          p_intent_id: intentId,
          p_event_type: "shell_materialization_deferred",
          p_payload: { reason, stage: "pre_fso" } as never,
        }).then(undefined, () => {});
      } else if (matData?.deferred) {
        shellDeferred = true;
        console.warn("[field-payment-link-create] shell materialization deferred (post-fso):", matData?.error);
      } else {
        console.log("[field-payment-link-create] shell order:", matData.order_id, "already:", !!matData.already_materialized);
      }
    } catch (e) {
      console.warn("[field-payment-link-create] shell materialization exception (deferred):", e);
      shellDeferred = true;
      await supabase.from("billing_system_alerts").insert({
        alert_type: "shell_materialization_deferred",
        entity_type: "field_payment_intent",
        entity_id: intentId,
        entity_reference: quote_id,
        details: { reason: e?.message || String(e), intent_id: intentId, quote_id, stage: "exception" },
        resolved: false,
      } as any).then(undefined, () => {});
    }

    const paymentUrl = `${SITE_URL}/payer/${intentId}`;

    let emailSent = false;

    if (mode === "email" && resolvedEmail) {
      const summary =
        (Array.isArray(quote.services) ? (quote.services as any[]) : [])
          .map((s: any) => s?.name)
          .filter(Boolean)
          .join(", ") || "Services Nivra";

      const monthlyTotal = (Array.isArray(quote.services) ? (quote.services as any[]) : [])
        .reduce((s: number, x: any) => s + Number(x?.monthlyPrice || 0), 0);
      const discountAmt = Number((quote as any).discount?.monthly_amount || (quote as any).discount?.amount || 0);
      const monthlyAfter = Math.max(0, monthlyTotal - discountAmt).toFixed(2);
      const installDateLabel = quote.install_date
        ? new Date(quote.install_date as string).toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" })
        : null;
      const equipmentLabel =
        (Array.isArray(quote.equipment) ? (quote.equipment as any[]) : [])
          .map((e: any) => `${e?.name}${e?.quantity > 1 ? ` ×${e.quantity}` : ""}`)
          .filter(Boolean)
          .join(", ") || null;

      try {
        let mailErr: any = null;
        try { await enqueueCommunication({
          channel: "email",
          templateKey: "field_payment_link",
          recipient: resolvedEmail,
          idempotencyKey: `field_payment_link_${intentId}`,
          templateVars: {
            client_name: resolvedName,
            first_name: ci.first_name || ci.firstName || "Client",
            agent_name: quote.agent_name || "Votre représentant Nivra",
            order_number: intentId,
            total: total.toFixed(2),
            monthly_after: monthlyAfter,
            install_date: installDateLabel,
            equipment: equipmentLabel,
            discount_label: (quote as any).discount?.name || (quote as any).discount?.label || null,
            summary,
            services: summary,
            payment_url: paymentUrl,
            approval_url: paymentUrl,
          },
        }); } catch (__e) { mailErr = __e; }

        if (mailErr) console.warn("[field-payment-link-create] email enqueue failed:", mailErr);
        else {
          emailSent = true;
          await supabase.rpc("log_field_order_event" as never, {
            p_intent_id: intentId,
            p_event_type: "email_sent",
            p_payload: { to: resolvedEmail } as never,
          }).then(undefined, () => {});
        }

        // Track link_sent on the quote (best-effort)
        await supabase
          .from("field_quotes")
          .update({ status: "sent", email_sent_at: new Date().toISOString() } as any)
          .eq("id", quote.id);
      } catch (e) {
        console.warn("[field-payment-link-create] email enqueue exception:", e);
      }
    }

    console.log(
      "[field-payment-link-create] intent",
      intentId,
      "quote",
      quote.id,
      "caller",
      callerId,
      "email_sent",
      emailSent,
    );

    return json({
      ok: true,
      intent_id: intentId,
      payment_url: paymentUrl,
      expires_at: expiresAt,
      email_sent: emailSent,
    });
  } catch (err: any) {
    console.error("[field-payment-link-create] fatal:", err);
    return json({ ok: false, error: err?.message || String(err) }, 500);
  }
});
