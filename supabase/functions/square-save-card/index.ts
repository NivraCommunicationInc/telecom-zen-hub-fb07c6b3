/**
 * square-save-card — Enregistre une carte "card-on-file" pour un client Nivra
 * et active le paiement pré-autorisé (PPA/autopay).
 *
 * Effets:
 *  1. Crée le customer Square si absent (via square-create-customer)
 *  2. Enregistre la carte auprès de Square (card on file)
 *  3. Persiste square_card_id + card_brand + last4 + expiration + autopay_enabled=true
 *  4. Écrit une note automatique dans client_internal_notes
 *  5. Enqueue email "autopay_activated" (template officiel bleu)
 *
 * Body:
 *  { source_id, customer_id, verification_token?, channel?, staff_actor_name? }
 *  channel: "portal" (client lui-même) | "core" | "hub" | "employee"
 */
import { createClient } from "npm:@supabase/supabase-js@2";

import { enqueueCommunication } from "../_shared/enqueueCommunication.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SQUARE_API = "https://connect.squareup.com/v2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  const squareToken = Deno.env.get("SQUARE_ACCESS_TOKEN")!;

  try {
    const {
      source_id,
      customer_id,
      user_id,
      verification_token,
      channel = "portal",
      staff_actor_name = null,
    } = await req.json();
    if (!source_id) throw new Error("source_id requis");
    if (!customer_id && !user_id) throw new Error("customer_id ou user_id requis");

    // Resolve or auto-create the billing_customers row.
    let bc: any = null;
    if (customer_id) {
      const { data } = await supabase
        .from("billing_customers")
        .select("id, email, first_name, last_name, square_customer_id, user_id")
        .eq("id", customer_id)
        .maybeSingle();
      bc = data;
    }
    if (!bc && user_id) {
      const { data } = await supabase
        .from("billing_customers")
        .select("id, email, first_name, last_name, square_customer_id, user_id")
        .eq("user_id", user_id)
        .maybeSingle();
      bc = data;
    }
    if (!bc && user_id) {
      // Bootstrap from profile
      const { data: prof } = await supabase
        .from("profiles")
        .select("first_name, last_name, full_name, email, phone")
        .eq("user_id", user_id)
        .maybeSingle();
      const email = prof?.email || "";
      const first_name =
        prof?.first_name || (prof?.full_name ? String(prof.full_name).split(" ").slice(0, -1).join(" ") || prof.full_name : "Client");
      const last_name =
        prof?.last_name || (prof?.full_name ? String(prof.full_name).split(" ").slice(-1)[0] : "");
      const phone = prof?.phone || "";
      if (!email) throw new Error("Profil client incomplet (email manquant)");
      const { data: created, error: createErr } = await supabase
        .from("billing_customers")
        .insert({
          user_id,
          email,
          first_name: first_name || "Client",
          last_name: last_name || "",
          phone: phone || "",
        })
        .select("id, email, first_name, last_name, square_customer_id, user_id")
        .single();
      if (createErr) throw new Error(`Création client échouée: ${createErr.message}`);
      bc = created;
    }
    if (!bc) throw new Error("Client introuvable");

    let squareCustomerId = bc.square_customer_id;
    if (!squareCustomerId) {
      const createRes = await fetch(
        `${Deno.env.get("SUPABASE_URL")!}/functions/v1/square-create-customer`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ customer_id: bc.id }),
        }
      );
      const createBody = await createRes.json();
      if (!createBody.ok) throw new Error(`Création client Square échouée: ${createBody.error}`);
      squareCustomerId = createBody.square_customer_id;
    }

    // Save card on file
    const payload: Record<string, unknown> = {
      source_id,
      // Square limit: idempotency_key <= 45 chars. Use random UUID (36) — a new
      // attempt should always be a new key (no dedupe on retry, user drives it).
      idempotency_key: crypto.randomUUID(),
      card: { customer_id: squareCustomerId },
    };
    if (verification_token) payload.verification_token = verification_token;

    const res = await fetch(`${SQUARE_API}/cards`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${squareToken}`,
        "Content-Type": "application/json",
        "Square-Version": "2024-11-20",
      },
      body: JSON.stringify(payload),
    });

    const body = await res.json();
    if (!res.ok) {
      const errMsg = body.errors?.map((e: any) => e.field ? `${e.detail} (champ: ${e.field})` : e.detail).join(", ") || "Erreur Square inconnue";
      throw new Error(errMsg);
    }

    const card = body.card;
    const squareCardId = card.id;
    const cardBrand = card.card_brand || "CARD";
    const last4 = card.last_4 || "????";
    const expMonth = card.exp_month || null;
    const expYear = card.exp_year || null;

    // Persist all card display fields + activate autopay
    await supabase
      .from("billing_customers")
      .update({
        square_card_id: squareCardId,
        square_card_brand: cardBrand,
        square_card_last4: last4,
        square_card_exp_month: expMonth,
        square_card_exp_year: expYear,
        autopay_enabled: true,
        autopay_discount_active: true,
        autopay_consent_at: new Date().toISOString(),
      })
      .eq("id", bc.id);

    // Auto-note (fire-and-forget)
    const channelLabel =
      channel === "portal"
        ? "Portail client"
        : channel === "core"
        ? "Nivra Core"
        : channel === "hub"
        ? "OneView"
        : channel === "employee"
        ? "Portail Employé"
        : String(channel);
    const noteActor = staff_actor_name
      ? `${staff_actor_name} (${channelLabel})`
      : channelLabel;
    const noteBody = `Paiement automatique activé — carte ${cardBrand} •••• ${last4} — via ${noteActor}`;
    if (bc.user_id) {
      try {
        await supabase.from("client_internal_notes").insert({
          client_id: bc.user_id,
          author_name: "Système Nivra",
          author_role: "system",
          note: noteBody,
          category: "billing",
        });
        await supabase.from("activity_logs").insert({
          entity_id: bc.user_id,
          entity_type: "client",
          action: noteBody,
          actor_name: "Système Nivra",
          actor_role: "system",
        });
      } catch (noteErr) {
        console.warn("[square-save-card] note write failed:", noteErr);
      }
    }

    // Confirmation email (template officiel bleu)
    if (bc.email) {
      try {
        await enqueueCommunication({
          channel: "email",
          templateKey: "autopay_activated",
          recipient: bc.email,
          idempotencyKey: `autopay-activated-${bc.id}-${Date.now()}`,
          templateVars: {
            client_name: `${bc.first_name || ""} ${bc.last_name || ""}`.trim() || bc.email,
            card_brand: cardBrand,
            card_last4: last4,
            activated_at: new Date().toISOString(),
            channel: channelLabel,
          },
        });
      } catch (emailErr) {
        console.warn("[square-save-card] email enqueue failed:", emailErr);
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        square_card_id: squareCardId,
        card_brand: cardBrand,
        last_4: last4,
        exp_month: expMonth,
        exp_year: expYear,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[square-save-card]", e);
    return new Response(
      JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
