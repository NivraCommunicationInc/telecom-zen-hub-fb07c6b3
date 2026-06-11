/**
 * agent-support — Customer Support AI.
 * Processes new support tickets, classifies + responds via Gemini 2.5 Pro,
 * escalates complex cases to Core.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const INTERNAL_EMAIL = "support@nivra-telecom.ca";
const CONFIDENCE_THRESHOLD = 0.85;
const MAX_PER_RUN = 50;

async function logAudit(
  supabase: any, action: string, result: string, details: unknown, ms: number, err?: string,
) {
  await supabase.from("agent_audit_log").insert({
    agent_name: "agent-support", action, result, details, execution_time_ms: ms, error_message: err,
  });
}

async function getClientContext(supabase: any, email: string) {
  const { data: profile } = await supabase.from("profiles")
    .select("user_id, first_name, full_name, email").eq("email", email).maybeSingle();
  if (!profile) return { profile: null, account: null, history: {} };

  const { data: account } = await supabase.from("accounts")
    .select("id, status, created_at").eq("client_id", profile.user_id).maybeSingle();

  const { data: sub } = account ? await supabase.from("billing_subscriptions")
    .select("plan_name, plan_price, status").eq("customer_id", profile.user_id).maybeSingle() : { data: null };

  const { data: complaints } = await supabase.from("complaints")
    .select("id, resolved_at").eq("user_id", profile.user_id).limit(20);

  const { data: pastTickets } = await supabase.from("support_tickets_ai")
    .select("id, category, status").eq("from_email", email).limit(20);

  return {
    profile, account,
    history: {
      subscription: sub,
      complaints_total: complaints?.length ?? 0,
      complaints_open: (complaints ?? []).filter((c: any) => !c.resolved_at).length,
      past_tickets: pastTickets?.length ?? 0,
    },
  };
}

async function geminiAnalyze(ticket: any, ctx: any) {
  const isEn = /^[\x00-\x7F\s]+$/.test(ticket.subject + " " + ticket.body) && !/é|è|à|ç/i.test(ticket.subject + " " + ticket.body);
  const prompt = `Tu es l'agent support de Nivra Telecom (télécom prépayé Québec).
Analyse cette demande client et fournis une réponse JSON STRICTE.

Contexte client:
${JSON.stringify(ctx.history, null, 2)}
Profil: ${ctx.profile ? `${ctx.profile.full_name} (client connu)` : "INCONNU - pas dans la base"}

Email reçu:
Sujet: ${ticket.subject ?? "(aucun)"}
Corps: ${ticket.body}

Règles:
- Jamais promettre de remboursement sans vérifier
- Jamais donner d'infos compte sans vérification
- Si technique: donner étapes dépannage standards
- Si facturation: expliquer prépayé Nivra
- Si résiliation: tenter rétention (ton chaleureux)
- Confiance minimale pour répondre auto: 0.85
- Si client inconnu OU sentiment angry OU catégorie cancellation OU priorité urgent: confidence doit être < 0.85 (escalader)

Réponds STRICTEMENT en JSON:
{
  "category": "billing|technical|account|installation|equipment|cancellation|complaint|information|other",
  "priority": "urgent|high|normal|low",
  "sentiment": "positive|neutral|frustrated|angry|urgent",
  "summary": "résumé 1 phrase",
  "can_auto_respond": true|false,
  "ai_response": "réponse complète ${isEn ? "en anglais" : "en français"} professionnelle signée 'L'équipe Nivra Telecom' (HTML simple <br/> autorisé)",
  "escalation_reason": "raison si pas auto",
  "confidence": 0.0-1.0
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
  if (!res.ok) throw new Error(`AI ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return JSON.parse(data.choices?.[0]?.message?.content ?? "{}");
}

async function processTicket(supabase: any, ticket: any) {
  const ctx = await getClientContext(supabase, ticket.from_email);
  const analysis = await geminiAnalyze(ticket, ctx);

  const forceEscalate =
    analysis.category === "cancellation" ||
    analysis.sentiment === "angry" ||
    analysis.priority === "urgent" ||
    Number(analysis.confidence ?? 0) < CONFIDENCE_THRESHOLD ||
    !analysis.can_auto_respond;

  const update: any = {
    account_id: ctx.account?.id ?? null,
    category: analysis.category ?? "other",
    priority: analysis.priority ?? "normal",
    sentiment: analysis.sentiment ?? "neutral",
    ai_confidence: Number(analysis.confidence ?? 0),
    ai_response: analysis.ai_response ?? null,
    updated_at: new Date().toISOString(),
  };

  if (forceEscalate) {
    update.ai_escalated = true;
    update.escalation_reason = analysis.escalation_reason ?? "Confiance insuffisante ou cas sensible";
    update.status = "escalated";

    await supabase.from("email_queue").insert({
      to_email: INTERNAL_EMAIL,
      template_key: "support_escalation_alert",
      subject: `[ESCALADE] Ticket ${ticket.ticket_number} — ${update.category}`,
      template_vars: {
        ticket_number: ticket.ticket_number,
        from_name: ticket.from_name ?? "Client",
        from_email: ticket.from_email,
        category: update.category,
        priority: update.priority,
        sentiment: update.sentiment,
        escalation_reason: update.escalation_reason,
        original_subject: ticket.subject ?? "",
        original_body: ticket.body,
      },
      status: "queued",
    });
  } else {
    update.ai_response_sent = true;
    update.status = "ai_responded";

    await supabase.from("email_queue").insert({
      to_email: ticket.from_email,
      template_key: "support_ai_response",
      subject: `Réponse — Ticket ${ticket.ticket_number}`,
      template_vars: {
        client_name: ticket.from_name ?? "Client",
        first_name: ctx.profile?.first_name ?? ticket.from_name ?? "Client",
        ticket_number: ticket.ticket_number,
        ai_response: analysis.ai_response,
      },
      status: "queued",
    });
  }

  await supabase.from("support_tickets_ai").update(update).eq("id", ticket.id);
  return { ticket_id: ticket.id, escalated: forceEscalate, confidence: update.ai_confidence };
}

async function runQueue(supabase: any) {
  const { data: tickets } = await supabase.from("support_tickets_ai")
    .select("*").eq("status", "new").order("created_at", { ascending: true }).limit(MAX_PER_RUN);
  const results: any[] = [];
  for (const t of (tickets ?? []) as any[]) {
    try { results.push(await processTicket(supabase, t)); }
    catch (e) { results.push({ ticket_id: t.id, error: String(e) }); }
  }
  return { processed: results.length, results };
}

function isAuthorized(req: Request): boolean {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (authHeader === `Bearer ${SERVICE_KEY}`) return true;
  const agentSecret = Deno.env.get("AGENT_SECRET");
  if (agentSecret && authHeader === `Bearer ${agentSecret}`) return true;
  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (!isAuthorized(req)) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const startedAt = Date.now();
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  try {
    let body: any = {};
    try { body = await req.json(); } catch { /* */ }

    // Inbound email webhook ingestion
    if (body.action === "ingest_email" && body.email) {
      const e = body.email;
      const { data, error } = await supabase.from("support_tickets_ai").insert({
        source: "email",
        from_email: String(e.from ?? "").toLowerCase().slice(0, 320),
        from_name: e.from_name ?? null,
        subject: e.subject ?? null,
        body: String(e.body ?? "").slice(0, 50000),
      }).select().single();
      if (error) throw error;
      await logAudit(supabase, "ingest_email", "success", { ticket_id: data.id }, Date.now() - startedAt);
      return new Response(JSON.stringify({ ok: true, ticket_id: data.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const r = await runQueue(supabase);
    await logAudit(supabase, "process_queue", "success", r, Date.now() - startedAt);
    return new Response(JSON.stringify({ ok: true, ...r }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    await logAudit(supabase, "error", "failure", null, Date.now() - startedAt, String(e));
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
