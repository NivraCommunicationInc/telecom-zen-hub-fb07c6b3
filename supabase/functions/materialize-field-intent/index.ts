import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.24.2";

const BodySchema = z.object({
  intent_id: z.string().uuid().optional(),
  field_ref: z.string().regex(/^#?FIELD-[0-9a-f]{8}$/i).optional(),
}).refine((v) => v.intent_id || v.field_ref, { message: "intent_id ou field_ref requis" });

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

function splitName(name: string | null | undefined) {
  const cleaned = String(name || "").trim().replace(/\s+/g, " ");
  if (!cleaned) return { firstName: null, lastName: null };
  const [first, ...rest] = cleaned.split(" ");
  return { firstName: first || null, lastName: rest.join(" ") || null };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Méthode non supportée" }, 405);

  try {
    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);

    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return json({ error: "Non autorisé" }, 401);

    const authClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });

    const { data: userData, error: userErr } = await authClient.auth.getUser(token);
    const userId = userData?.user?.id;
    if (userErr || !userId) return json({ error: "Session invalide" }, 401);

    const { data: allowed } = await admin.rpc("has_role", { _user_id: userId, _role: "admin" });
    const { data: allowedEmployee } = await admin.rpc("has_role", { _user_id: userId, _role: "employee" });
    const { data: allowedSupport } = await admin.rpc("has_role", { _user_id: userId, _role: "support" });
    if (!allowed && !allowedEmployee && !allowedSupport) return json({ error: "Accès refusé" }, 403);

    let intentId = parsed.data.intent_id || null;
    if (!intentId && parsed.data.field_ref) {
      const prefix = parsed.data.field_ref.replace(/^#?FIELD-/i, "").toLowerCase();
      const { data: intents, error } = await admin
        .from("field_payment_intents")
        .select("id, converted_order_id, created_at")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      const match = (intents || []).find((i: any) => String(i.id).toLowerCase().startsWith(prefix));
      if (!match) return json({ error: "Intention FIELD introuvable" }, 404);
      if (match.converted_order_id) return json({ order_id: match.converted_order_id, already_converted: true });
      intentId = match.id;
    }

    const { data: intent, error: intentErr } = await admin
      .from("field_payment_intents")
      .select("*")
      .eq("id", intentId)
      .maybeSingle();
    if (intentErr) throw intentErr;
    if (!intent) return json({ error: "Intention FIELD introuvable" }, 404);
    if (intent.converted_order_id) return json({ order_id: intent.converted_order_id, already_converted: true });

    const orderNumber = `FIELD-${String(intent.id).slice(0, 8).toUpperCase()}`;
    const { data: existingOrder } = await admin.from("orders").select("id").eq("order_number", orderNumber).maybeSingle();
    if (existingOrder?.id) {
      await admin.from("field_payment_intents").update({ converted_order_id: existingOrder.id }).eq("id", intent.id);
      return json({ order_id: existingOrder.id, already_converted: true });
    }

    const { data: quote } = intent.quote_id
      ? await admin.from("field_quotes").select("*").eq("id", intent.quote_id).maybeSingle()
      : { data: null as any };

    const ci = (quote?.client_info || {}) as Record<string, any>;
    const email = String(intent.customer_email || ci.email || "").trim().toLowerCase();
    if (!email) return json({ error: "Courriel client manquant sur la vente FIELD" }, 400);

    const { data: profile } = await admin.from("profiles").select("user_id, full_name, email, phone").ilike("email", email).limit(1).maybeSingle();
    if (!profile?.user_id) return json({ error: "Profil client introuvable pour cette vente FIELD" }, 409);

    let { data: account } = await admin.from("accounts").select("id").eq("client_id", profile.user_id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!account?.id) {
      const { data: acctNum, error: acctNumErr } = await admin.rpc("generate_account_number");
      if (acctNumErr || !acctNum) throw acctNumErr || new Error("generate_account_number failed");
      const { data: newAccount, error: acctErr } = await admin.from("accounts").insert({
        client_id: profile.user_id,
        account_number: String(acctNum),
        account_name: intent.customer_name || profile.full_name || "Client Terrain",
        status: "active",
        billing_address: ci.address || null,
        billing_city: ci.city || null,
        billing_postal_code: ci.postal_code || null,
        billing_province: "QC",
      }).select("id").single();
      if (acctErr) throw acctErr;
      account = newAccount;
    }

    const fullName = intent.customer_name || profile.full_name || `${ci.first_name || ""} ${ci.last_name || ""}`.trim();
    const { firstName, lastName } = splitName(fullName);
    const services = Array.isArray(quote?.services) ? quote.services : [];
    const equipment = Array.isArray(quote?.equipment) ? quote.equipment : [];
    const serviceName = services.map((s: any) => s?.name).filter(Boolean).join(" + ") || "Vente terrain";

    const { data: order, error: orderErr } = await admin.from("orders").insert({
      user_id: profile.user_id,
      account_id: account.id,
      order_number: orderNumber,
      created_by: "field_sales",
      source: "field_sales",
      created_by_agent_id: intent.agent_id,
      agent_name: quote?.agent_name || null,
      client_email: email,
      client_phone: ci.phone || profile.phone || null,
      client_first_name: ci.first_name || firstName,
      client_last_name: ci.last_name || lastName,
      client_dob: ci.date_of_birth || null,
      service_type: serviceName,
      category: "Field Sales",
      subtotal: Number(quote?.subtotal ?? intent.amount ?? 0),
      activation_fee: Number(quote?.activation_fee ?? 0),
      tps_amount: Number(quote?.tps ?? 0),
      tvq_amount: Number(quote?.tvq ?? 0),
      total_amount: Number(quote?.total ?? intent.amount ?? 0),
      status: "pending_payment",
      payment_status: intent.status || "pending",
      payment_method: intent.payment_method || "manual",
      amount_paid: 0,
      shipping_address: ci.address || null,
      shipping_city: ci.city || null,
      shipping_postal_code: ci.postal_code || null,
      equipment_details: { line_items: [...services, ...equipment], services, equipment, generated_at: new Date().toISOString(), version: 2 },
      notes: `Vente terrain — Intent: ${intent.id}`,
      internal_notes: `[VENTE TERRAIN — matérialisée depuis intent ${intent.id}]`,
      environment: "live",
    }).select("id, order_number").single();
    if (orderErr) throw orderErr;

    await admin.from("field_payment_intents").update({ converted_order_id: order.id }).eq("id", intent.id);
    if (intent.quote_id) await admin.from("field_quotes").update({ converted_order_id: order.id, status: "converted" }).eq("id", intent.quote_id);

    return json({ order_id: order.id, order_number: order.order_number, already_converted: false });
  } catch (err: any) {
    console.error("[materialize-field-intent]", err);
    return json({ error: err?.message || "Erreur serveur" }, 500);
  }
});
