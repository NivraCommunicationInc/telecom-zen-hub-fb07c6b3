/**
 * field-payment-intent-update
 * Public endpoint used by /payer/:intentId ("Revoir votre commande") so the
 * end client can:
 *   - update ONLY their contact info & addresses (never prices/services)
 *   - persist the electronic signature + consent flags before paying
 *   - request a different install date
 *
 * Never accept price/service/equipment mutations from the client — those come
 * from field_quotes and were locked by the agent.
 *
 * Body:
 *   {
 *     intent_id: string,
 *     mode: "edits" | "signature" | "install_change_request",
 *     edits?: {
 *       phone?: string, email?: string,
 *       service_address?: { address, apartment, city, province, postal_code },
 *       billing_address?: { address, apartment, city, province, postal_code },
 *     },
 *     signature?: { name: string, data_url: string, method: "typed"|"drawn" },
 *     consent_flags?: { accuracy: boolean, terms: boolean, activation: boolean },
 *     install_change_request?: { requested_date?: string, note?: string },
 *   }
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (b: unknown, s = 200) =>
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
    const { intent_id, mode, edits, signature, consent_flags, install_change_request } = body ?? {};

    if (!intent_id || typeof intent_id !== "string") {
      return json({ ok: false, error: "intent_id requis" }, 400);
    }
    if (!["edits", "signature", "install_change_request"].includes(mode)) {
      return json({ ok: false, error: "mode invalide" }, 400);
    }

    // Load intent + quote
    const { data: intent, error: iErr } = await supabase
      .from("field_payment_intents")
      .select("id, quote_id, status, paid_at, agent_id, client_edits")
      .eq("id", intent_id)
      .maybeSingle();
    if (iErr || !intent) return json({ ok: false, error: "Commande introuvable" }, 404);
    if (intent.status === "completed" || intent.paid_at) {
      return json({ ok: false, error: "Cette commande est déjà payée." }, 400);
    }

    const payerIp =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      null;

    // ── Contact / address edits ────────────────────────────────────────
    if (mode === "edits") {
      const e = edits || {};
      const allowed: Record<string, unknown> = {};
      if (typeof e.phone === "string" && e.phone.trim().length >= 7) allowed.phone = e.phone.trim();
      if (typeof e.email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.email)) {
        allowed.email = e.email.trim().toLowerCase();
      }
      const cleanAddr = (a: unknown) => {
        if (!a || typeof a !== "object") return null;
        const x = a as Record<string, unknown>;
        return {
          address: String(x.address || "").trim().slice(0, 200),
          apartment: String(x.apartment || "").trim().slice(0, 20),
          city: String(x.city || "").trim().slice(0, 100),
          province: String(x.province || "QC").trim().slice(0, 5),
          postal_code: String(x.postal_code || "").trim().slice(0, 10),
        };
      };
      const svc = cleanAddr(e.service_address);
      const bill = cleanAddr(e.billing_address);
      if (svc && svc.address) allowed.service_address = svc;
      if (bill && bill.address) allowed.billing_address = bill;

      if (Object.keys(allowed).length === 0) {
        return json({ ok: false, error: "Aucune modification valide fournie." }, 400);
      }

      // Merge into quote.client_info without touching pricing/services
      if (intent.quote_id) {
        const { data: q } = await supabase
          .from("field_quotes")
          .select("client_info")
          .eq("id", intent.quote_id)
          .maybeSingle();
        const ci = (q?.client_info as Record<string, unknown>) || {};
        const merged: Record<string, unknown> = { ...ci };
        if ("phone" in allowed) merged.phone = allowed.phone;
        if ("email" in allowed) merged.email = allowed.email;
        if ("service_address" in allowed) {
          const s = allowed.service_address as Record<string, string>;
          merged.address = s.address;
          merged.apartment = s.apartment;
          merged.city = s.city;
          merged.province = s.province;
          merged.postal_code = s.postal_code;
        }
        if ("billing_address" in allowed) merged.billing_address = allowed.billing_address;
        await supabase
          .from("field_quotes")
          .update({ client_info: merged })
          .eq("id", intent.quote_id);
      }

      // History on the intent
      const history = Array.isArray(intent.client_edits) ? (intent.client_edits as unknown[]) : [];
      history.push({ at: new Date().toISOString(), ip: payerIp, edits: allowed });
      await supabase
        .from("field_payment_intents")
        .update({
          client_edits: history,
          customer_email: "email" in allowed ? String(allowed.email) : undefined,
        } as never)
        .eq("id", intent_id);

      // Journal
      await supabase.rpc("log_field_order_event" as never, {
        p_intent_id: intent_id,
        p_event_type: "client_edited",
        p_payload: { edits: allowed, ip: payerIp } as never,
      }).then(undefined, () => {});

      return json({ ok: true, applied: allowed });
    }

    // ── Signature + consent ─────────────────────────────────────────────
    if (mode === "signature") {
      const s = signature || {};
      if (!s.name || typeof s.name !== "string" || s.name.trim().length < 3) {
        return json({ ok: false, error: "Nom complet requis (min 3 caractères)." }, 400);
      }
      if (!s.data_url || typeof s.data_url !== "string") {
        return json({ ok: false, error: "Signature manquante." }, 400);
      }
      const cf = consent_flags || {};
      if (!cf.accuracy || !cf.terms || !cf.activation) {
        return json({ ok: false, error: "Les trois consentements sont obligatoires." }, 400);
      }
      const payload = {
        name: String(s.name).trim().slice(0, 120),
        data_url: String(s.data_url).slice(0, 200_000), // ~200KB safety cap
        method: s.method === "drawn" ? "drawn" : "typed",
        signed_at: new Date().toISOString(),
        ip: payerIp,
      };
      await supabase
        .from("field_payment_intents")
        .update({ signature: payload, consent_flags: cf } as never)
        .eq("id", intent_id);

      await supabase.rpc("log_field_order_event" as never, {
        p_intent_id: intent_id,
        p_event_type: "signature_saved",
        p_payload: { name: payload.name, method: payload.method, ip: payerIp } as never,
      }).then(undefined, () => {});

      return json({ ok: true, signed_at: payload.signed_at });
    }

    // ── Install date change request ─────────────────────────────────────
    if (mode === "install_change_request") {
      const r = install_change_request || {};
      const note = `[CLIENT] Demande de modification de date d'installation. Nouvelle date souhaitée : ${
        r.requested_date || "non précisée"
      }. Note : ${String(r.note || "").slice(0, 500)}`;
      if (intent.quote_id) {
        await supabase.from("field_order_notes").insert({
          quote_id: intent.quote_id,
          intent_id,
          author: "client",
          note,
        } as never);
      }
      return json({ ok: true, requested: true });
    }

    return json({ ok: false, error: "Mode non pris en charge." }, 400);
  } catch (err) {
    console.error("[field-payment-intent-update] fatal:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return json({ ok: false, error: msg }, 500);
  }
});
