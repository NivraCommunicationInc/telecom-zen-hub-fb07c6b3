/**
 * support-ai-responder — Generates an AI reply (or escalates) for a support ticket.
 *
 * Uses Lovable AI Gateway (Gemini 2.5 Pro) — no external API key required.
 *
 * Flow:
 *   1. Load ticket; honor ai_scheduled_at delay
 *   2. Gather client context (account, recent orders/invoices/subscriptions)
 *   3. Call Lovable AI
 *   4. If response signals escalation: status=escalated + email admin
 *      Else: queue ai_reply email to client + status=ai_replied + save message
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const ADMIN_ESCALATION_EMAIL = Deno.env.get("ADMIN_ESCALATION_EMAIL") || "support@nivra-telecom.ca";

async function gatherClientContext(supabase: any, email: string) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("user_id, full_name, email")
    .ilike("email", email)
    .maybeSingle();

  if (!profile?.user_id) {
    return { account_number: null, client_name: email, orders: [], invoices: [], subscriptions: [], known: false };
  }

  const { data: account } = await supabase
    .from("accounts")
    .select("id, account_number, status")
    .eq("client_id", profile.user_id)
    .maybeSingle();

  const { data: orders } = await supabase
    .from("orders")
    .select("order_number, status, total_amount, created_at, payment_method")
    .eq("user_id", profile.user_id)
    .order("created_at", { ascending: false })
    .limit(5);

  let invoices: any[] = [];
  let subscriptions: any[] = [];
  if (account?.id) {
    const { data: inv } = await supabase
      .from("billing_invoices")
      .select("invoice_number, status, total, due_date")
      .eq("account_id", account.id)
      .order("created_at", { ascending: false })
      .limit(3);
    invoices = inv ?? [];

    const { data: subs } = await supabase
      .from("billing_subscriptions")
      .select("status, plan_price, cycle_end_date")
      .eq("account_id", account.id)
      .eq("status", "active")
      .limit(2);
    subscriptions = subs ?? [];
  }

  return {
    account_number: account?.account_number ?? null,
    account_status: account?.status ?? null,
    client_name: profile.full_name ?? email,
    orders: orders ?? [],
    invoices,
    subscriptions,
    known: true,
  };
}

async function callLovableAI(systemPrompt: string, userPrompt: string): Promise<string> {
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-pro",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 1000,
      temperature: 0.4,
    }),
  });

  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`AI Gateway error ${resp.status}: ${txt}`);
  }
  const json = await resp.json();
  return String(json.choices?.[0]?.message?.content ?? "").trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const ticket_id = String(body.ticket_id ?? "");
  if (!ticket_id) {
    return new Response(JSON.stringify({ error: "ticket_id required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { data: ticket, error: tErr } = await supabase
    .from("support_tickets")
    .select("id, ticket_number, client_email, client_name, subject, body, description, status, ai_scheduled_at, account_id")
    .eq("id", ticket_id)
    .maybeSingle();

  if (tErr || !ticket) {
    return new Response(JSON.stringify({ error: "Ticket not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Idempotency: if already replied or escalated, skip
  if (ticket.status === "ai_replied" || ticket.status === "escalated" || ticket.status === "resolved" || ticket.status === "closed") {
    return new Response(JSON.stringify({ ok: true, skipped: true, reason: `status=${ticket.status}` }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Honor scheduled time (10 min delay)
  if (ticket.ai_scheduled_at) {
    const sched = new Date(ticket.ai_scheduled_at).getTime();
    if (Date.now() < sched) {
      const waitMs = sched - Date.now();
      // Defer via setTimeout — edge runtime keeps the worker alive for the await
      await new Promise((r) => setTimeout(r, Math.min(waitMs, 10 * 60 * 1000)));
    }
  }

  // Re-fetch in case status changed during wait
  const { data: fresh } = await supabase
    .from("support_tickets")
    .select("status")
    .eq("id", ticket_id)
    .maybeSingle();
  if (fresh && ["ai_replied", "escalated", "resolved", "closed", "human_replied"].includes(fresh.status)) {
    return new Response(JSON.stringify({ ok: true, skipped: true, reason: `status=${fresh.status}` }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const context = await gatherClientContext(supabase, ticket.client_email);
  const messageBody = ticket.body || ticket.description || "";

  const systemPrompt = `Tu es l'agent support de Nivra Telecom, un fournisseur internet et TV au Québec.
Tu réponds aux clients en français ou en anglais selon leur langue.
Tu as accès aux informations du compte client.
Tu es professionnel, chaleureux et efficace.
Tu signes toujours: "Équipe Support Nivra Telecom" en français ou "Nivra Telecom Support Team" en anglais.

RÈGLES STRICTES:
- Utilise SEULEMENT les vraies données du compte
- Ne jamais inventer des informations
- Si tu n'es pas sûr à 80%: dis que tu escalades
- Réponds dans la même langue que le client
- Sois concis et professionnel
- Inclus toujours le numéro de ticket

INFORMATIONS COMPTE CLIENT:
Numéro compte: ${context.account_number ?? "Inconnu (client non identifié dans nos systèmes)"}
Nom: ${context.client_name}
Commandes récentes: ${JSON.stringify(context.orders)}
Factures récentes: ${JSON.stringify(context.invoices)}
Abonnement actif: ${JSON.stringify(context.subscriptions)}

TYPES DE QUESTIONS À ESCALADER (commence ta réponse par [ESCALADE]):
- Annulation de service
- Remboursement
- Plainte sérieuse
- Problème technique complexe
- Mention de CRTC, avocat, juridique
- Tout ce que tu ne comprends pas bien
- Client inconnu demandant des informations sensibles`;

  const userPrompt = `Ticket: ${ticket.ticket_number}
Sujet: ${ticket.subject}
Message du client: ${messageBody}

Réponds à ce client. Si tu dois escalader, commence ta réponse par [ESCALADE] et explique pourquoi.`;

  let aiText = "";
  try {
    aiText = await callLovableAI(systemPrompt, userPrompt);
  } catch (e) {
    console.error("[support-ai-responder] AI call failed", e);
    // Escalate on AI failure
    aiText = `[ESCALADE] L'agent IA n'a pas pu générer de réponse: ${(e as Error).message}`;
  }

  const lower = aiText.toLowerCase();
  const shouldEscalate =
    aiText.startsWith("[ESCALADE]") ||
    lower.includes("annul") ||
    lower.includes("remboursement") ||
    lower.includes("crtc") ||
    lower.includes("avocat") ||
    lower.includes("juridique");

  if (shouldEscalate) {
    await supabase
      .from("support_tickets")
      .update({
        status: "escalated",
        escalated_at: new Date().toISOString(),
        escalated_reason: aiText,
        ai_confidence: 0.0,
        ai_responded_at: new Date().toISOString(),
        ai_response: aiText,
        updated_at: new Date().toISOString(),
      })
      .eq("id", ticket_id);

    await supabase.from("ticket_replies").insert({
      ticket_id,
      content: aiText,
      sender_type: "system",
      sender_role: "admin",
      sender_name: "Système IA",
      is_internal_note: true,
      is_admin: true,
    });

    await supabase.from("email_queue").insert({
      event_key: `escalation_${ticket.ticket_number}`,
      to_email: ADMIN_ESCALATION_EMAIL,
      template_key: "support_escalation",
      template_vars: {
        ticket_number: ticket.ticket_number,
        client_name: ticket.client_name ?? "",
        client_email: ticket.client_email,
        subject: ticket.subject,
        body: messageBody,
        ai_reason: aiText,
        account_number: context.account_number ?? "Inconnu",
      },
      status: "queued",
    });

    return new Response(JSON.stringify({ ok: true, action: "escalated" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // AI responds to client
  await supabase
    .from("support_tickets")
    .update({
      status: "ai_replied",
      ai_response: aiText,
      ai_responded_at: new Date().toISOString(),
      ai_confidence: 0.85,
      updated_at: new Date().toISOString(),
    })
    .eq("id", ticket_id);

  await supabase.from("ticket_replies").insert({
    ticket_id,
    content: aiText,
    sender_type: "ai",
    sender_role: "admin",
    sender_name: "Équipe Support Nivra Telecom",
    is_admin: true,
  });

  await supabase.from("email_queue").insert({
    event_key: `ai_reply_${ticket.ticket_number}`,
    to_email: ticket.client_email,
    template_key: "support_ai_reply",
    template_vars: {
      client_name: ticket.client_name ?? context.client_name,
      ticket_number: ticket.ticket_number,
      subject: `RE: ${ticket.subject}`,
      original_subject: ticket.subject,
      ai_response: aiText,
      account_number: context.account_number ?? "Inconnu",
    },
    status: "queued",
  });

  return new Response(JSON.stringify({ ok: true, action: "ai_replied" }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
