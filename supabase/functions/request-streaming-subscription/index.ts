import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { writeAccountJournal } from "../_shared/writeAccountJournal.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Authentification requise");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData.user) throw new Error("Utilisateur non authentifié");
    const user = userData.user;

    const body = await req.json();
    const { streaming_service_id, promo_code, notes } = body;
    if (!streaming_service_id) throw new Error("Service streaming requis");

    // 1. Load streaming service
    const { data: svc, error: svcErr } = await supabase
      .from("streaming_services")
      .select("id, name, monthly_price, category")
      .eq("id", streaming_service_id)
      .eq("is_active", true)
      .maybeSingle();
    if (svcErr || !svc) throw new Error("Service streaming introuvable ou inactif");

    // 2. Check duplicate active subscription
    const { data: existing } = await supabase
      .from("client_streaming_subscriptions")
      .select("id, status")
      .eq("user_id", user.id)
      .eq("streaming_service_id", streaming_service_id)
      .in("status", ["active", "pending"])
      .maybeSingle();
    if (existing) throw new Error(`Vous avez déjà un abonnement ${existing.status === "pending" ? "en attente" : "actif"} pour ce service`);

    // 3. Resolve account
    const { data: account } = await supabase
      .from("accounts")
      .select("id")
      .eq("client_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // 4. Create pending subscription record
    const { data: subscription, error: subErr } = await supabase
      .from("client_streaming_subscriptions")
      .insert({
        user_id: user.id,
        account_id: account?.id ?? null,
        streaming_service_id,
        monthly_price: Number(svc.monthly_price),
        status: "pending",
        promo_code: promo_code ?? null,
        internal_notes: notes ?? `Demande client portail (${new Date().toISOString()})`,
        start_date: new Date().toISOString(),
      })
      .select()
      .single();
    if (subErr) throw subErr;

    // 5. Notify Core via system note + activity log (fire and forget)
    try {
      await writeAccountJournal(supabase, {
        targetTable: "client_internal_notes",
        payload: {
          client_id: user.id,
          note_type: "system",
          body: `🎬 Nouvel abonnement streaming demandé : ${svc.name} (${Number(svc.monthly_price).toFixed(2)} $/mois)${promo_code ? ` — Code promo : ${promo_code}` : ""}`,
          created_by_user_id: user.id,
          created_by_role: "system_auto",
          created_by_name: "Système Nivra",
        },
        eventKey: `streaming_subscription:${subscription.id}:requested:note`,
        actor: { userId: user.id, role: "system_auto", name: "Système Nivra", email: null },
      });
    } catch (e) {
      console.warn("[request-streaming] note insert failed", e);
    }

    return new Response(
      JSON.stringify({
        success: true,
        subscription_id: subscription.id,
        status: "pending",
        message: `Demande envoyée — ${svc.name} sera activé sous peu et facturé ${Number(svc.monthly_price).toFixed(2)} $/mois sur votre prochaine facture.`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[request-streaming-subscription]", msg);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
