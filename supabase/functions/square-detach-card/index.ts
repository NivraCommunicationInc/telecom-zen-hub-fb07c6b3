/**
 * square-detach-card — Désactive le PPA/autopay d'un client.
 *
 * Effets:
 *  1. Détache la carte côté Square (best-effort)
 *  2. Efface square_card_id + card display fields et met autopay_enabled=false
 *  3. Note interne + email "autopay_cancelled"
 *
 * Body: { customer_id, channel?, staff_actor_name? }
 */
import { createClient } from "npm:@supabase/supabase-js@2";

import { enqueueCommunication } from "../_shared/enqueueCommunication.ts";
import { writeAccountJournal } from "../_shared/writeAccountJournal.ts";
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
    const { customer_id, channel = "portal", staff_actor_name = null } = await req.json();
    if (!customer_id) throw new Error("customer_id requis");

    const { data: bc, error: bcErr } = await supabase
      .from("billing_customers")
      .select("id, email, first_name, last_name, user_id, square_card_id, square_card_brand, square_card_last4")
      .eq("id", customer_id)
      .single();
    if (bcErr || !bc) throw new Error("Client introuvable");

    if (!bc.square_card_id) {
      return new Response(
        JSON.stringify({ ok: true, already_detached: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Best-effort disable at Square (won't fail the flow if Square is unreachable)
    try {
      await fetch(`${SQUARE_API}/cards/${bc.square_card_id}/disable`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${squareToken}`,
          "Content-Type": "application/json",
          "Square-Version": "2024-11-20",
        },
      });
    } catch (sqErr) {
      console.warn("[square-detach-card] Square disable failed (continuing):", sqErr);
    }

    const priorBrand = bc.square_card_brand || "CARD";
    const priorLast4 = bc.square_card_last4 || "????";

    await supabase
      .from("billing_customers")
      .update({
        square_card_id: null,
        square_card_brand: null,
        square_card_last4: null,
        square_card_exp_month: null,
        square_card_exp_year: null,
        autopay_enabled: false,
        autopay_discount_active: false,
      })
      .eq("id", customer_id);

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
    const noteActor = staff_actor_name ? `${staff_actor_name} (${channelLabel})` : channelLabel;
    const noteBody = `Paiement automatique désactivé — carte ${priorBrand} •••• ${priorLast4} — via ${noteActor}`;

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
        console.warn("[square-detach-card] note write failed:", noteErr);
      }
    }

    if (bc.email) {
      try {
        await enqueueCommunication({
          channel: "email",
          templateKey: "autopay_cancelled",
          recipient: bc.email,
          idempotencyKey: `autopay-cancelled-${customer_id}-${Date.now()}`,
          templateVars: {
            client_name: `${bc.first_name || ""} ${bc.last_name || ""}`.trim() || bc.email,
            card_brand: priorBrand,
            card_last4: priorLast4,
            cancelled_at: new Date().toISOString(),
            channel: channelLabel,
          },
        });
      } catch (emailErr) {
        console.warn("[square-detach-card] email enqueue failed:", emailErr);
      }
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[square-detach-card]", e);
    return new Response(
      JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
