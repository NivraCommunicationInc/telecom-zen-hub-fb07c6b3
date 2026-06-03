/**
 * agent-marketing — AI-driven marketing campaigns.
 * Actions: create_ai_campaign | send_campaign | auto
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

type Segment =
  | "all_active" | "internet_only" | "no_tv" | "high_value" | "at_risk"
  | "no_mobile" | "churned_90days" | "new_30days" | "long_term_1year";

const SEGMENT_LABELS: Record<Segment, string> = {
  all_active: "Tous les clients actifs",
  internet_only: "Clients Internet uniquement",
  no_tv: "Clients sans service TV",
  high_value: "Clients à valeur élevée (≥100$/mois)",
  at_risk: "Clients à risque (paiement en retard)",
  no_mobile: "Clients sans forfait mobile",
  churned_90days: "Anciens clients (résiliés <90j)",
  new_30days: "Nouveaux clients (<30j)",
  long_term_1year: "Clients fidèles (>1 an)",
};

function randomPromoCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return `NIVRA-${code}`;
}

async function geminiCampaign(segment: Segment) {
  const prompt = `Tu es le directeur marketing de Nivra Telecom, fournisseur Internet/TV prépayé sans contrat au Québec.
Génère une campagne email promotionnelle personnalisée pour le segment: ${segment} (${SEGMENT_LABELS[segment]}).

Contexte Nivra:
- Forfait Internet GIGA: 60$/mois
- Bundle GIGA + TV: 100$/mois
- Mobile: 60$/30 jours
- Aucun contrat, aucune vérification crédit
- Support local québécois

Crée:
1. Sujet email accrocheur (FR + EN)
2. Corps email professionnel (FR + EN) personnalisé avec [first_name], offre claire, CTA fort, ton chaleureux mais pro
3. Type d'offre recommandé (discount_percent, discount_fixed, free_month, upgrade, bundle, referral_bonus, loyalty_reward)
4. Valeur de l'offre suggérée (nombre)
5. Code promo unique format NIVRA-XXXX

Règles: jamais de concurrents, prix avant taxes, offre 7 jours, LCAP.

Réponds STRICTEMENT en JSON: { "name": "...", "subject_fr": "...", "subject_en": "...", "body_fr": "...", "body_en": "...", "offer_type": "...", "offer_value": 0, "promo_code": "NIVRA-XXXX", "personalization_notes": "..." }`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${LOVABLE_API_KEY}` },
    body: JSON.stringify({
      model: "google/gemini-2.5-pro",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) throw new Error(`Gemini failed: ${res.status}`);
  const data = await res.json();
  const json = JSON.parse(data.choices?.[0]?.message?.content ?? "{}");
  if (!json.promo_code) json.promo_code = randomPromoCode();
  return json;
}

async function buildRecipients(supabase: ReturnType<typeof createClient>, segment: Segment) {
  // Fetch active accounts joined with profile + active subscription. We resolve
  // gracefully against the actual schema (accounts.client_id → profiles.user_id,
  // billing_subscriptions.customer_id → profiles.user_id, plan_price as monthly amount).
  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, client_id, status, created_at, cancelled_at")
    .in("status", segment === "churned_90days" ? ["cancelled"] : ["active"])
    .limit(2000);

  if (!accounts || accounts.length === 0) return [];

  const clientIds = Array.from(new Set(accounts.map((a: any) => a.client_id).filter(Boolean)));
  const [{ data: profiles }, { data: subs }] = await Promise.all([
    supabase.from("profiles").select("user_id, email, first_name, last_name, full_name").in("user_id", clientIds),
    supabase.from("billing_subscriptions").select("customer_id, plan_name, plan_price, service_category, status").in("customer_id", clientIds),
  ]);

  const profileMap = new Map<string, any>((profiles ?? []).map((p: any) => [p.user_id, p]));
  const subsByCustomer = new Map<string, any[]>();
  for (const s of (subs ?? []) as any[]) {
    const arr = subsByCustomer.get(s.customer_id) ?? [];
    arr.push(s);
    subsByCustomer.set(s.customer_id, arr);
  }

  const now = Date.now();
  const out: Array<{ account_id: string; email: string; first_name: string; full_name: string; plan_name: string; monthly_amount: number }> = [];

  for (const a of accounts as any[]) {
    const p = profileMap.get(a.client_id);
    if (!p?.email) continue;
    const clientSubs = (subsByCustomer.get(a.client_id) ?? []).filter((s) => s.status === "active");
    const monthlyAmount = clientSubs.reduce((sum, s) => sum + Number(s.plan_price ?? 0), 0);
    const categories = new Set(clientSubs.map((s) => String(s.service_category ?? "").toLowerCase()));
    const planName = clientSubs.map((s) => s.plan_name).filter(Boolean).join(" + ") || "Forfait Nivra";

    let include = false;
    switch (segment) {
      case "all_active": include = a.status === "active"; break;
      case "internet_only": include = categories.has("internet") && !categories.has("tv"); break;
      case "no_tv": include = !categories.has("tv"); break;
      case "high_value": include = monthlyAmount >= 100; break;
      case "no_mobile": include = !categories.has("mobile"); break;
      case "new_30days": include = (now - new Date(a.created_at).getTime()) < 30 * 86400_000; break;
      case "long_term_1year": include = (now - new Date(a.created_at).getTime()) > 365 * 86400_000 && a.status === "active"; break;
      case "churned_90days": include = a.status === "cancelled" && a.cancelled_at && (now - new Date(a.cancelled_at).getTime()) < 90 * 86400_000; break;
      case "at_risk": include = a.status === "active"; break; // simplified: needs payment history
    }
    if (!include) continue;

    out.push({
      account_id: a.id,
      email: p.email,
      first_name: p.first_name ?? p.full_name?.split(" ")[0] ?? "Client",
      full_name: p.full_name ?? `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() ?? "Client",
      plan_name: planName,
      monthly_amount: monthlyAmount,
    });
  }
  return out;
}

function fillTemplate(body: string, vars: Record<string, string>): string {
  let out = body;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replaceAll(`[${k}]`, v);
  }
  return out;
}

async function logAudit(supabase: any, action: string, result: string, details: unknown, ms: number, error?: string) {
  await supabase.from("agent_audit_log").insert({
    agent_name: "agent-marketing", action, result, details, execution_time_ms: ms, error_message: error,
  });
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
    try { body = await req.json(); } catch { /* empty */ }
    const action = body.action ?? "auto";

    if (action === "create_ai_campaign") {
      const segment = (body.segment ?? "all_active") as Segment;
      const ai = await geminiCampaign(segment);
      const { data: inserted, error } = await supabase.from("marketing_campaigns").insert({
        name: ai.name ?? `Campagne IA — ${SEGMENT_LABELS[segment]}`,
        campaign_type: "promotion",
        target_segment: segment,
        subject_fr: ai.subject_fr ?? "Offre exclusive Nivra",
        subject_en: ai.subject_en ?? "Exclusive Nivra offer",
        body_fr: ai.body_fr ?? "",
        body_en: ai.body_en ?? "",
        offer_type: ai.offer_type ?? "discount_fixed",
        offer_value: Number(ai.offer_value ?? 10),
        offer_valid_days: 7,
        promo_code: ai.promo_code ?? randomPromoCode(),
        ai_generated: true,
        ai_personalization_notes: ai.personalization_notes ?? null,
        status: "draft",
      }).select("id").maybeSingle();
      if (error) throw error;
      await logAudit(supabase, "create_ai_campaign", "success", { campaign_id: inserted?.id, segment }, Date.now() - startedAt);
      return new Response(JSON.stringify({ ok: true, campaign_id: inserted?.id, ai }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "send_campaign") {
      const campaignId = body.campaign_id;
      if (!campaignId) throw new Error("campaign_id required");
      const { data: campaign } = await supabase.from("marketing_campaigns").select("*").eq("id", campaignId).maybeSingle();
      if (!campaign) throw new Error("campaign not found");
      const segment = campaign.target_segment as Segment;
      const recipients = await buildRecipients(supabase, segment);

      const validUntil = new Date(Date.now() + (campaign.offer_valid_days ?? 7) * 86400_000)
        .toISOString().slice(0, 10);

      const sendsRows: any[] = [];
      const queueRows: any[] = [];

      for (const r of recipients) {
        const offerDetails = campaign.offer_type === "discount_percent"
          ? `${campaign.offer_value}% de rabais`
          : campaign.offer_type === "discount_fixed"
          ? `${campaign.offer_value}$ de rabais`
          : campaign.offer_type === "free_month"
          ? `1 mois gratuit`
          : `Offre spéciale (${campaign.offer_value})`;

        const vars: Record<string, string> = {
          first_name: r.first_name,
          plan_name: r.plan_name,
          monthly_amount: r.monthly_amount.toFixed(2),
          offer_details: offerDetails,
          promo_code: campaign.promo_code ?? "",
          offer_valid_until: validUntil,
        };
        const personalizedBody = fillTemplate(campaign.body_fr ?? "", vars);
        const personalizedSubject = fillTemplate(campaign.subject_fr ?? "", vars);

        sendsRows.push({
          campaign_id: campaignId,
          account_id: r.account_id,
          email: r.email,
          client_name: r.full_name,
          personalization_vars: vars,
          status: "queued",
        });
        queueRows.push({
          to_email: r.email,
          template_key: "marketing_promotion",
          subject: personalizedSubject,
          template_vars: {
            client_name: r.full_name,
            first_name: r.first_name,
            campaign_id: campaignId,
            hero_title: personalizedSubject,
            body_html: personalizedBody.replace(/\n/g, "<br/>"),
            offer_details: offerDetails,
            promo_code: campaign.promo_code ?? "",
            offer_valid_until: validUntil,
          },
          status: "queued",
        });
      }

      // Insert in chunks
      for (let i = 0; i < sendsRows.length; i += 200) {
        await supabase.from("campaign_sends").insert(sendsRows.slice(i, i + 200));
      }
      for (let i = 0; i < queueRows.length; i += 200) {
        await supabase.from("email_queue").insert(queueRows.slice(i, i + 200));
      }
      await supabase.from("marketing_campaigns").update({
        status: "running",
        sent_count: recipients.length,
        updated_at: new Date().toISOString(),
      }).eq("id", campaignId);

      await logAudit(supabase, "send_campaign", "success", { campaign_id: campaignId, sent_count: recipients.length, segment }, Date.now() - startedAt);
      return new Response(JSON.stringify({ ok: true, sent_count: recipients.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // action === "auto" — pick a segment & generate
    if (action === "auto") {
      const segments: Segment[] = ["new_30days", "long_term_1year", "no_tv", "high_value", "no_mobile"];
      const pick = segments[Math.floor(Math.random() * segments.length)];
      const ai = await geminiCampaign(pick);
      const { data: inserted } = await supabase.from("marketing_campaigns").insert({
        name: ai.name ?? `Auto-campagne — ${SEGMENT_LABELS[pick]}`,
        campaign_type: "promotion",
        target_segment: pick,
        subject_fr: ai.subject_fr ?? "Offre exclusive Nivra",
        subject_en: ai.subject_en ?? "Exclusive Nivra offer",
        body_fr: ai.body_fr ?? "",
        body_en: ai.body_en ?? "",
        offer_type: ai.offer_type ?? "discount_fixed",
        offer_value: Number(ai.offer_value ?? 10),
        offer_valid_days: 7,
        promo_code: ai.promo_code ?? randomPromoCode(),
        ai_generated: true,
        ai_personalization_notes: ai.personalization_notes ?? null,
        status: "draft",
      }).select("id").maybeSingle();
      await logAudit(supabase, "auto_create", "success", { campaign_id: inserted?.id, segment: pick }, Date.now() - startedAt);
      return new Response(JSON.stringify({ ok: true, campaign_id: inserted?.id, segment: pick, ai }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (e) {
    await logAudit(supabase, "error", "failure", null, Date.now() - startedAt, String(e));
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
