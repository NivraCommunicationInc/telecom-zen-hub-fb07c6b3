/**
 * agent-retention — daily risk scoring + AI-personalized retention offers.
 * Also handles monthly winback campaigns for churned clients.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

async function calcRisk(supabase: any, account: any, sub: any): Promise<{ score: number; factors: Record<string, number> }> {
  const factors: Record<string, number> = {};

  // Payment history (30 pts)
  const { data: failedPayments } = await supabase.from("payments")
    .select("id").eq("client_id", account.client_id).eq("status", "failed")
    .gte("created_at", new Date(Date.now() - 180 * 86400_000).toISOString());
  const failedCount = failedPayments?.length ?? 0;
  factors.payment = failedCount >= 2 ? 20 : failedCount === 1 ? 10 : 0;
  if (sub?.next_renewal_at && new Date(sub.next_renewal_at) < new Date()) factors.payment += 10;

  // Support (20 pts)
  const { data: complaints } = await supabase.from("complaints")
    .select("id, resolved_at").eq("user_id", account.client_id);
  const open = (complaints ?? []).filter((c: any) => !c.resolved_at).length;
  const totalC = complaints?.length ?? 0;
  factors.support = open > 0 ? 20 : totalC >= 2 ? 15 : totalC === 1 ? 5 : 0;

  // Age (10 pts)
  const ageDays = Math.floor((Date.now() - new Date(account.created_at).getTime()) / 86400_000);
  factors.age = ageDays < 90 ? 10 : ageDays < 365 ? 5 : 0;

  // Plan value (10 pts)
  const amount = Number(sub?.plan_price ?? 0);
  factors.plan_value = amount >= 100 ? 0 : amount >= 60 ? 5 : 10;

  // Engagement (30 pts) — simplified to cancellation requests / pause
  if (account.status === "paused") factors.engagement = 20;
  else factors.engagement = 0;

  const score = Math.min(100, Object.values(factors).reduce((a, b) => a + b, 0));
  return { score, factors };
}

async function geminiOffer(client: any) {
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${LOVABLE_API_KEY}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [{
          role: "user",
          content: `Client Nivra Telecom à risque.\nScore de rétention: ${client.score}/100\nProfil:\n- Nom: ${client.full_name}\n- Forfait: ${client.plan_name} à ${client.amount}$/mois\n- Client depuis: ${client.age_days} jours\n- Facteurs de risque: ${JSON.stringify(client.factors)}\n\nGénère une offre de rétention ultra-personnalisée (chaleureuse, humaine, non-agressive). Réponds STRICTEMENT en JSON: {"hero_title":"...","body":"...","offer_type":"discount_percent|free_month|upgrade","offer_value":number,"cta":"...","urgency_days":7}`,
        }],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return JSON.parse(data.choices?.[0]?.message?.content ?? "{}");
  } catch { return null; }
}

async function logAudit(supabase: any, action: string, result: string, details: unknown, ms: number, err?: string) {
  await supabase.from("agent_audit_log").insert({
    agent_name: "agent-retention", action, result, details, execution_time_ms: ms, error_message: err,
  });
}

async function runDaily(supabase: any) {
  const { data: accounts } = await supabase.from("accounts").select("id, client_id, status, created_at").eq("status", "active").limit(2000);
  let scored = 0, offersSent = 0;
  for (const a of (accounts ?? []) as any[]) {
    const { data: sub } = await supabase.from("billing_subscriptions").select("plan_name, plan_price, next_renewal_at, status").eq("customer_id", a.client_id).eq("status", "active").maybeSingle();
    const { score, factors } = await calcRisk(supabase, a, sub);
    scored++;
    if (score < 60) continue;
    const { data: p } = await supabase.from("profiles").select("email, first_name, full_name").eq("user_id", a.client_id).maybeSingle();
    if (!p?.email) continue;

    const ageDays = Math.floor((Date.now() - new Date(a.created_at).getTime()) / 86400_000);
    const ai = await geminiOffer({
      full_name: p.full_name, plan_name: sub?.plan_name ?? "Forfait Nivra",
      amount: sub?.plan_price ?? 0, age_days: ageDays, factors, score,
    });

    await supabase.from("retention_actions").insert({
      account_id: a.id, risk_score: score, risk_factors: factors,
      action_type: score >= 80 ? "personal_outreach" : "email_offer",
      offer_details: ai ?? {}, status: "sent", sent_at: new Date().toISOString(),
    });
    await supabase.from("email_queue").insert({
      to_email: p.email,
      template_key: "retention_offer",
      subject: ai?.hero_title ?? "Offre personnalisée Nivra Telecom",
      template_vars: {
        client_name: p.full_name, first_name: p.first_name ?? "Client",
        hero_title: ai?.hero_title ?? "Une offre rien que pour vous",
        body_html: (ai?.body ?? "Nous tenons à vous garder dans la famille Nivra.").replace(/\n/g, "<br/>"),
        offer_type: ai?.offer_type ?? "discount_percent",
        offer_value: ai?.offer_value ?? 10,
        cta_label: ai?.cta ?? "Voir mon offre",
        urgency_days: ai?.urgency_days ?? 7,
        account_id: a.id,
      },
      status: "queued",
    });
    offersSent++;
  }
  return { scored, offers_sent: offersSent };
}

async function runWinback(supabase: any) {
  const cutoff = new Date(Date.now() - 90 * 86400_000).toISOString();
  const { data: accounts } = await supabase.from("accounts")
    .select("id, client_id, cancelled_at")
    .eq("status", "cancelled")
    .gte("cancelled_at", cutoff)
    .limit(500);
  let sent = 0;
  for (const a of (accounts ?? []) as any[]) {
    const { data: p } = await supabase.from("profiles").select("email, first_name, full_name").eq("user_id", a.client_id).maybeSingle();
    if (!p?.email) continue;
    await supabase.from("email_queue").insert({
      to_email: p.email,
      template_key: "winback_offer",
      subject: "On vous manque — Revenez chez Nivra",
      template_vars: {
        client_name: p.full_name, first_name: p.first_name ?? "Client", account_id: a.id,
      },
      status: "queued",
    });
    sent++;
  }
  return { winback_sent: sent };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const startedAt = Date.now();
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  try {
    let body: any = {};
    try { body = await req.json(); } catch { /* empty */ }
    if (body.action === "winback") {
      const r = await runWinback(supabase);
      await logAudit(supabase, "winback", "success", r, Date.now() - startedAt);
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
