// Redeployed: 2026-05-22-NOVA-SDK
// NOVA Brain — streaming Anthropic Claude via official SDK with reasoning layer + Oldo digital clone.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";


const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY missing" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return new Response(JSON.stringify({ error: "unauthenticated" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

    const userClient = createClient(supabaseUrl, serviceKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData } = await userClient.auth.getUser(token);
    if (!userData?.user) return new Response(JSON.stringify({ error: "unauthenticated" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: userData.user.id, _role: "admin" });
    if (!isAdmin) return new Response(JSON.stringify({ error: "admin role required" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

    const { messages, conversation_id } = await req.json();

    // Real-time context + memory + oldo_clone + recent decisions + recent alerts
    const [{ data: contextData }, { data: memories }, { data: oldoClone }, { data: recentDecisions }, { data: pendingAlerts }, { data: hotProspects }] = await Promise.all([
      userClient.rpc("get_nova_context"),
      admin.from("nova_memory").select("title, content, memory_type")
        .eq("is_active", true).neq("memory_type", "oldo_clone")
        .order("importance", { ascending: false }).limit(20),
      admin.from("nova_memory").select("title, content")
        .eq("is_active", true).eq("memory_type", "oldo_clone")
        .order("importance", { ascending: false }).limit(15),
      admin.from("nova_decisions").select("situation, decision_made, reasoning")
        .order("created_at", { ascending: false }).limit(10),
      admin.from("nova_actions").select("action_payload, created_at")
        .eq("action_type", "send_alert").eq("status", "pending")
        .order("created_at", { ascending: false }).limit(5),
      admin.from("crm_contacts").select("id, full_name, phone, priority, call_status, last_call_at, call_count")
        .not("call_status", "in", "(sold,not_interested,do_not_call)")
        .order("priority", { ascending: false }).limit(10),
    ]);

    const memoryContext = (memories ?? []).map((m: any) =>
      `[${String(m.memory_type).toUpperCase()}] ${m.title}: ${m.content}`).join("\n\n");
    const oldoCloneCtx = (oldoClone ?? []).map((m: any) => `- ${m.title}: ${m.content}`).join("\n");
    const decisionsCtx = (recentDecisions ?? []).map((d: any) =>
      `• Situation: ${d.situation} → Décision: ${d.decision_made} (${d.reasoning ?? ""})`).join("\n");
    const alertsCtx = (pendingAlerts ?? []).map((a: any) =>
      `🚨 ${a.action_payload?.title}: ${a.action_payload?.message}`).join("\n");
    const prospectsCtx = (hotProspects ?? []).map((p: any) =>
      `• ${p.full_name} (${p.phone}) — priorité ${p.priority}, statut ${p.call_status}, ${p.call_count ?? 0} appels`).join("\n");

    // Reasoning layer: conditional rules baked into the system prompt
    const ctx: any = contextData ?? {};
    const conditionalRules: string[] = [];
    if ((ctx.dlq_emails ?? 0) > 5) conditionalRules.push("⚠️ DLQ emails > 5 — ALERTER que le système email est cassé.");
    if ((ctx.sla_at_risk ?? 0) > 3) conditionalRules.push("⚠️ SLA dépassé sur > 3 plaintes — ESCALADE immédiate.");
    if ((ctx.open_complaints ?? 0) > 10) conditionalRules.push("⚠️ Plus de 10 plaintes ouvertes — priorité support.");
    if ((ctx.pending_orders ?? 0) > 20) conditionalRules.push("⚠️ Backlog commandes > 20 — traiter rapidement.");
    if ((ctx.crm_hot_leads ?? 0) > 0) conditionalRules.push(`🔥 ${ctx.crm_hot_leads} leads chauds en CRM — proposer un plan d'attaque.`);

    const systemPrompt = `Tu es NOVA, le Digital Brain de Nivra Telecom — co-fondateur IA d'Oldo Lavaud.

═══ IDENTITÉ ═══
- CEO télécoms 15 ans d'expérience Québec
- Direct, sans bullshit, orienté résultats
- Connaît Bell, Vidéotron, Fizz par cœur
- Parle français québécois professionnel
- Toujours 2-3 actions concrètes après chaque analyse
- Anticipe les problèmes

═══ RAISONNEMENT (analyse silencieuse avant de répondre) ═══
1. SITUATION ACTUELLE: ${JSON.stringify(ctx)}
2. RÈGLES CONDITIONNELLES DÉCLENCHÉES:
${conditionalRules.length ? conditionalRules.join("\n") : "Aucune règle critique déclenchée."}
3. ALERTES PROACTIVES (watchdog):
${alertsCtx || "Aucune alerte critique en attente."}
4. DÉCISIONS PASSÉES (apprentissage):
${decisionsCtx || "Pas encore d'historique de décisions."}
5. PRIORITÉS OLDO: Croissance MRR, agents performants, zéro bug prod, clients satisfaits.

═══ PROFIL OLDO (digital clone — adapte ton style) ═══
${oldoCloneCtx || "Apprentissage en cours — observe et adapte-toi."}

═══ MÉMOIRE ENTREPRISE ═══
${memoryContext}

═══ CRM — PROSPECTS CHAUDS ═══
${prospectsCtx || "Aucun prospect chaud actuellement."}

═══ CAPACITÉS D'ACTION ═══
send_email, launch_campaign, control_agent, modify_crm, generate_report, send_alert, create_ticket

Format action (ajoute à la fin si action requise):
<action>
{"type":"action_type","description":"...","payload":{...},"requires_approval":true}
</action>

═══ RÈGLES ABSOLUES ═══
1. Toujours basé sur les vraies données Nivra ci-dessus
2. Mentionne en premier les alertes critiques et règles déclenchées
3. Si Oldo demande "qui appeler aujourd'hui?", utilise la liste prospects chauds
4. Actions financières/irréversibles → requires_approval: true
5. Direct, professionnel, orienté croissance — pas de flatterie`;

    let response: any;
    try {
      const apiResp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-3-haiku-20240307",
          max_tokens: 2048,
          system: systemPrompt,
          messages,
        }),
      });
      const bodyText = await apiResp.text();
      if (!apiResp.ok) {
        console.error("[nova-brain] anthropic", apiResp.status, bodyText);
        return new Response(
          JSON.stringify({ error: "anthropic_error", status: apiResp.status, detail: bodyText }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      response = JSON.parse(bodyText);
    } catch (err) {
      console.error("[nova-brain] fetch error", err);
      return new Response(
        JSON.stringify({ error: "anthropic_error", detail: err instanceof Error ? err.message : String(err) }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const confidenceScore = Math.min(1, 0.5 + (memories?.length ?? 0) * 0.02 + (oldoClone?.length ?? 0) * 0.02);
    admin.from("nova_reasoning_log").insert({
      conversation_id: conversation_id ?? null,
      user_message: messages?.[messages.length - 1]?.content ?? "",
      reasoning_chain: { conditional_rules: conditionalRules, alerts_count: pendingAlerts?.length ?? 0, decisions_count: recentDecisions?.length ?? 0 },
      context_snapshot: ctx,
      confidence: confidenceScore,
    }).then(() => {}, () => {});

    const firstBlock = response.content?.[0];
    const text = firstBlock && firstBlock.type === "text" ? firstBlock.text : "";

    return new Response(
      JSON.stringify({ content: text, usage: response.usage, confidence: confidenceScore }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "X-Nova-Confidence": String(Math.round(confidenceScore * 100)),
        },
      },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
