/**
 * agent-sales — Detects upsell/cross-sell opportunities and sends
 * AI-personalized offers via Gemini 2.5 Pro. Tracks conversions.
 */
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const APP_URL = "https://nivra-telecom.ca";
const MAX_PER_RUN = 100;

async function logAudit(supabase: any, action: string, result: string, details: unknown, ms: number, err?: string) {
  await supabase.from("agent_audit_log").insert({
    agent_name: "agent-sales", action, result, details, execution_time_ms: ms, error_message: err,
  });
}

async function geminiOffer(client: any) {
  const prompt = `Client Nivra Telecom — Opportunité de vente additionnelle.

Profil:
- Nom: ${client.full_name}
- Forfait actuel: ${client.plan_name} à ${client.plan_price}$/mois
- Service actuel: ${client.current_service}
- Client depuis: ${client.age_days} jours
- Opportunité: ${client.opportunity_type}

Génère une offre personnalisée. Réponds STRICTEMENT en JSON:
{
  "hero_title": "titre accrocheur 1 ligne",
  "hook": "message d'accroche 1 ligne",
  "body": "bénéfices spécifiques pour CE client (HTML simple <br/>) — ton ami qui conseille, pas vendeur",
  "offer_label": "offre de transition (ex: premier mois -50%, installation offerte)",
  "new_plan_value": "valeur ajoutée ou économie",
  "urgency_days": 14
}`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${LOVABLE_API_KEY}` },
    body: JSON.stringify({
      model: "google/gemini-2.5-pro",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) return null;
  try { return JSON.parse((await res.json()).choices?.[0]?.message?.content ?? "{}"); }
  catch { return null; }
}

async function findOpportunities(supabase: any) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400_000).toISOString();
  const oneYearAgo = new Date(Date.now() - 365 * 86400_000).toISOString();
  const opportunities: any[] = [];

  const { data: subs } = await supabase.from("billing_subscriptions")
    .select("id, customer_id, plan_name, plan_price, service_category, created_at, status")
    .eq("status", "active").limit(2000);

  for (const sub of (subs ?? []) as any[]) {
    const { data: acc } = await supabase.from("accounts").select("id, status, created_at")
      .eq("client_id", sub.customer_id).maybeSingle();
    if (!acc || acc.status !== "active") continue;
    if (new Date(sub.created_at) > new Date(thirtyDaysAgo)) continue;

    // already contacted in last 30 days?
    const { data: recent } = await supabase.from("campaign_sends").select("id")
      .eq("account_id", acc.id).gte("created_at", thirtyDaysAgo).limit(1);
    if (recent && recent.length > 0) continue;

    // detect opportunity type
    const { data: allSubs } = await supabase.from("billing_subscriptions")
      .select("service_category, plan_name").eq("customer_id", sub.customer_id).eq("status", "active");
    const cats = new Set((allSubs ?? []).map((s: any) => s.service_category));
    let oppType: string | null = null;

    if (cats.has("internet") && !cats.has("tv")) oppType = "internet_to_bundle";
    else if ((cats.has("internet") || cats.has("tv")) && !cats.has("mobile")) oppType = "add_mobile";
    else if (new Date(acc.created_at) < new Date(oneYearAgo) && Number(sub.plan_price ?? 0) < 60) oppType = "loyalty_upgrade";

    if (!oppType) continue;

    const { data: p } = await supabase.from("profiles").select("email, first_name, full_name")
      .eq("user_id", sub.customer_id).maybeSingle();
    if (!p?.email) continue;

    opportunities.push({
      account_id: acc.id, email: p.email, first_name: p.first_name,
      full_name: p.full_name, plan_name: sub.plan_name, plan_price: sub.plan_price,
      current_service: sub.service_category, opportunity_type: oppType,
      age_days: Math.floor((Date.now() - new Date(acc.created_at).getTime()) / 86400_000),
    });
    if (opportunities.length >= MAX_PER_RUN) break;
  }
  return opportunities;
}

async function runDaily(supabase: any) {
  const opps = await findOpportunities(supabase);
  let sent = 0;
  for (const o of opps) {
    const ai = await geminiOffer(o);
    if (!ai) continue;

    // Create or get a "sales agent" pseudo campaign (one shared row)
    let campaignId: string | null = null;
    const { data: existing } = await supabase.from("marketing_campaigns")
      .select("id").eq("name", "Agent Ventes — Opportunités quotidiennes").maybeSingle();
    if (existing) campaignId = existing.id;
    else {
      const { data: created } = await supabase.from("marketing_campaigns").insert({
        name: "Agent Ventes — Opportunités quotidiennes",
        segment: "upsell",
        subject: "Offre personnalisée",
        status: "sent",
        ai_generated: true,
      }).select("id").maybeSingle();
      campaignId = created?.id ?? null;
    }

    await supabase.from("campaign_sends").insert({
      campaign_id: campaignId,
      account_id: o.account_id,
      email: o.email,
      client_name: o.full_name,
      personalization_vars: { opportunity_type: o.opportunity_type, ai_offer: ai },
      status: "queued",
    });

    await supabase.from("email_queue").insert({
      to_email: o.email,
      template_key: "sales_opportunity_offer",
      subject: ai.hero_title ?? "Une offre pour vous",
      template_vars: {
        client_name: o.full_name,
        first_name: o.first_name ?? "Client",
        hero_title: ai.hero_title ?? "Offre exclusive",
        hook: ai.hook ?? "",
        body_html: ai.body ?? "",
        current_plan: o.plan_name,
        current_price: o.plan_price,
        offer_label: ai.offer_label ?? "",
        new_plan_value: ai.new_plan_value ?? "",
        urgency_days: ai.urgency_days ?? 14,
        portal_url: `${APP_URL}/portail`,
      },
      status: "queued",
    });
    sent++;
  }
  return { opportunities: opps.length, offers_sent: sent };
}

async function trackConversions(supabase: any) {
  // Mark campaign_sends as converted when a new sub was added after send_at
  const since = new Date(Date.now() - 30 * 86400_000).toISOString();
  const { data: sends } = await supabase.from("campaign_sends")
    .select("id, account_id, sent_at, created_at, status")
    .eq("status", "sent").gte("created_at", since).limit(500);

  let converted = 0;
  for (const s of (sends ?? []) as any[]) {
    const { data: acc } = await supabase.from("accounts").select("client_id").eq("id", s.account_id).maybeSingle();
    if (!acc) continue;
    const { data: newSub } = await supabase.from("billing_subscriptions").select("id, created_at, plan_price")
      .eq("customer_id", acc.client_id).gt("created_at", s.sent_at ?? s.created_at)
      .order("created_at", { ascending: true }).limit(1).maybeSingle();
    if (newSub) {
      await supabase.from("campaign_sends").update({
        status: "converted", converted_at: new Date().toISOString(),
      }).eq("id", s.id);
      converted++;
    }
  }
  return { conversions_tracked: converted };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const _auth = req.headers.get("Authorization") ?? "";
  const _agentSecret = Deno.env.get("AGENT_SECRET");
  if (_auth !== `Bearer ${SERVICE_KEY}` && (!_agentSecret || _auth !== `Bearer ${_agentSecret}`)) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  const startedAt = Date.now();
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  try {
    let body: any = {};
    try { body = await req.json(); } catch (_e) { /* */ }

    if (body.action === "track_conversions") {
      const r = await trackConversions(supabase);
      await logAudit(supabase, "track_conversions", "success", r, Date.now() - startedAt);
      return new Response(JSON.stringify({ ok: true, ...r }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const r = await runDaily(supabase);
    await logAudit(supabase, "daily", "success", r, Date.now() - startedAt);
    return new Response(JSON.stringify({ ok: true, ...r }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    await logAudit(supabase, "error", "failure", null, Date.now() - startedAt, String(e));
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
