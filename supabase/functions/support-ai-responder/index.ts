/**
 * support-ai-responder v2 — Agent support Nivra Telecom
 *
 * Appelé par pg_cron toutes les 2 minutes (mode cron) ou en mode ticket unique.
 *
 * CAPACITÉS:
 * - Contexte complet: profil, compte, services actifs, abonnements, factures, commandes
 * - Catalogue forfaits depuis table services (prix bilingues en temps réel)
 * - Détection langue via profiles.preferred_language + heuristique
 * - Réponse autonome: forfaits/prix, statut, facturation, activation, couverture
 * - Escalade équipe: technique complexe, remboursement, plainte, confiance <80%
 * - Signature: "Équipe Support Nivra Telecom | nivra-telecom.ca/portal"
 *
 * Backend IA: LOVABLE_API_KEY (Gemini 2.5 Pro) sinon ANTHROPIC_API_KEY (claude-haiku-4-5-20251001)
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
const ADMIN_ESCALATION_EMAIL = Deno.env.get("ADMIN_ESCALATION_EMAIL") || "support@nivra-telecom.ca";
const PORTAL_URL = "https://nivra-telecom.ca/portal";

// ─────────────────────────────────────────────────────────
// AI CALL
// ─────────────────────────────────────────────────────────

async function callAI(systemPrompt: string, userPrompt: string): Promise<string> {
  if (LOVABLE_API_KEY) {
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
        max_tokens: 1500,
        temperature: 0.3,
      }),
    });
    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error(`Lovable AI Gateway ${resp.status}: ${txt.slice(0, 300)}`);
    }
    const json = await resp.json();
    return String(json.choices?.[0]?.message?.content ?? "").trim();
  }

  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1500,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });
  return String((message.content[0] as { text?: string })?.text ?? "").trim();
}

// ─────────────────────────────────────────────────────────
// LANGUAGE DETECTION
// ─────────────────────────────────────────────────────────

const FR_WORDS = ["je", "mon", "ma", "le", "la", "les", "de", "du", "et", "est", "pas", "pour",
  "avec", "sur", "votre", "vous", "merci", "bonjour", "problème", "question", "besoin",
  "aide", "facturation", "abonnement", "forfait", "connexion", "réseau", "internet", "téléphone"];

function detectLanguage(text: string, profileLang?: string | null): "fr" | "en" {
  if (profileLang === "en") return "en";
  if (profileLang === "fr") return "fr";
  const lc = text.toLowerCase();
  const frScore = FR_WORDS.filter((w) => lc.includes(` ${w} `) || lc.startsWith(`${w} `) || lc.includes(` ${w}`)).length;
  return frScore >= 2 ? "fr" : "en";
}

// ─────────────────────────────────────────────────────────
// DATA GATHERING
// ─────────────────────────────────────────────────────────

type SB = ReturnType<typeof createClient>;

async function gatherClientContext(supabase: SB, email: string) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("user_id, full_name, email, phone, preferred_language, account_status, client_number, service_address, service_city, service_province, balance, store_credit")
    .ilike("email", email)
    .maybeSingle();

  if (!profile?.user_id) {
    return { known: false, profile: null, account: null, serviceInstances: [], subscriptions: [], invoices: [], orders: [] };
  }

  const { data: account } = await supabase
    .from("accounts")
    .select("id, account_number, status, billing_address, billing_city, billing_province, next_invoice_date, paused_at, cancellation_reason")
    .eq("client_id", profile.user_id)
    .maybeSingle();

  const [{ data: serviceInstances }, { data: subscriptions }, { data: invoices }, { data: orders }] = await Promise.all([
    supabase
      .from("service_instances")
      .select("service_type, plan_name, status, monthly_price, start_date, end_date")
      .eq("account_id", account?.id ?? "")
      .in("status", ["active", "suspended", "pending"])
      .order("start_date", { ascending: false })
      .limit(5),

    supabase
      .from("billing_subscriptions")
      .select("plan_code, plan_name, plan_price, status, cycle_start_date, cycle_end_date, next_renewal_at, auto_billing_enabled, service_category, suspension_reason, recurring_provider")
      .eq("customer_id", profile.user_id)
      .order("created_at", { ascending: false })
      .limit(5),

    supabase
      .from("billing_invoices")
      .select("invoice_number, status, total, balance_due, due_date, paid_at, payment_method, cycle_start_date, cycle_end_date")
      .eq("customer_id", profile.user_id)
      .order("created_at", { ascending: false })
      .limit(4),

    supabase
      .from("orders")
      .select("order_number, status, service_type, total_amount, payment_status, created_at, tracking_number")
      .eq("user_id", profile.user_id)
      .order("created_at", { ascending: false })
      .limit(4),
  ]);

  return {
    known: true,
    profile,
    account,
    serviceInstances: serviceInstances ?? [],
    subscriptions: subscriptions ?? [],
    invoices: invoices ?? [],
    orders: orders ?? [],
  };
}

async function loadServicesCatalog(supabase: SB) {
  const { data } = await supabase
    .from("services")
    .select("category, name, name_en, price, plan_code, short_description, short_description_en")
    .eq("is_active", true)
    .order("category")
    .order("price")
    .limit(60);
  return data ?? [];
}

// ─────────────────────────────────────────────────────────
// PROMPT BUILDER
// ─────────────────────────────────────────────────────────

function buildSystemPrompt(lang: "fr" | "en", ctx: Awaited<ReturnType<typeof gatherClientContext>>, catalog: unknown[]): string {
  const isFr = lang === "fr";
  const catalogStr = JSON.stringify(catalog, null, 2);

  const clientSection = ctx.known && ctx.profile ? `
CLIENT IDENTIFIÉ / IDENTIFIED CLIENT:
- Nom/Name: ${ctx.profile.full_name ?? "N/A"}
- Email: ${ctx.profile.email}
- Téléphone/Phone: ${ctx.profile.phone ?? "N/A"}
- Adresse service: ${ctx.profile.service_address ?? ""}, ${ctx.profile.service_city ?? ""}, ${ctx.profile.service_province ?? ""}
- Numéro compte: ${ctx.account?.account_number ?? ctx.profile.client_number ?? "N/A"}
- Statut compte: ${ctx.account?.status ?? ctx.profile.account_status ?? "N/A"}
- Solde crédit: $${ctx.profile.balance ?? 0} | Crédit boutique: $${ctx.profile.store_credit ?? 0}
- Prochaine facture: ${ctx.account?.next_invoice_date ?? "N/A"}
${ctx.account?.paused_at ? `- COMPTE SUSPENDU depuis: ${ctx.account.paused_at}` : ""}

SERVICES ACTIFS / ACTIVE SERVICES:
${ctx.serviceInstances.length ? JSON.stringify(ctx.serviceInstances, null, 2) : "(aucun service trouvé)"}

ABONNEMENTS / SUBSCRIPTIONS:
${ctx.subscriptions.length ? JSON.stringify(ctx.subscriptions, null, 2) : "(aucun abonnement)"}

FACTURES RÉCENTES / RECENT INVOICES:
${ctx.invoices.length ? JSON.stringify(ctx.invoices, null, 2) : "(aucune facture)"}

COMMANDES RÉCENTES / RECENT ORDERS:
${ctx.orders.length ? JSON.stringify(ctx.orders, null, 2) : "(aucune commande)"}
` : `
CLIENT NON IDENTIFIÉ / UNKNOWN CLIENT:
L'email de l'expéditeur ne correspond à aucun compte Nivra Telecom.
Ne jamais divulguer d'informations sensibles. Demander de s'identifier ou de créer un compte.
`;

  return `Tu es l'agent support IA de Nivra Telecom, un fournisseur internet, TV et mobile au Québec.
Réponds ${isFr ? "en français" : "in English"} — la langue détectée du client est ${lang}.

${clientSection}

CATALOGUE FORFAITS NIVRA TELECOM (prix en CAD, avant taxes):
${catalogStr}

RÈGLES STRICTES:
1. Utilise SEULEMENT les vraies données du compte — ne jamais inventer
2. Les taxes QC sont: TPS 5% + TVQ 9.975% (total ~15%)
3. Pour activer un service: le client va sur ${PORTAL_URL}
4. Pour la couverture réseau: disponible sur nivra-telecom.ca/couverture
5. Les factures sont disponibles dans le portail: ${PORTAL_URL}

RÉPONDRE AUTONOMEMENT pour:
- Questions sur les forfaits et prix (utilise le catalogue ci-dessus)
- Statut d'une commande ou d'un abonnement (utilise les données ci-dessus)
- Questions de facturation générale (date de facturation, montant, statut paiement)
- Procédures d'activation (diriger vers ${PORTAL_URL})
- Questions sur la couverture réseau (diriger vers nivra-telecom.ca/couverture)
- Informations générales sur Nivra Telecom

ESCALADER À L'ÉQUIPE HUMAINE pour:
- Problème technique complexe (connexion internet impossible, équipement défectueux, etc.)
- Demande de remboursement
- Plainte formelle ou client insatisfait
- Mention de CRTC, avocat, juridique, tribunal
- Client inconnu demandant des infos sensibles sur un compte
- Tout ce dont tu n'es pas confiant à 80%+

FORMAT DE RÉPONSE OBLIGATOIRE — Réponds UNIQUEMENT avec ce JSON valide, sans markdown:
{
  "action": "respond" ou "escalate",
  "confidence": 0-100,
  "category": "plan|billing|order|service_status|activation|coverage|technical|refund|complaint|general|unknown",
  "language": "${lang}",
  "response": "Le texte complet de ta réponse au client (avec signature)",
  "escalation_reason": "null si action=respond, sinon explique pourquoi tu escalades"
}

SIGNATURE À INCLURE EN FIN DE RÉPONSE (${isFr ? "français" : "English"}):
${isFr
    ? `---\nÉquipe Support Nivra Telecom\n${PORTAL_URL} | support@nivra-telecom.ca`
    : `---\nNivra Telecom Support Team\n${PORTAL_URL} | support@nivra-telecom.ca`}
`;
}

// ─────────────────────────────────────────────────────────
// TICKET PROCESSOR
// ─────────────────────────────────────────────────────────

async function processTicket(supabase: SB, ticket_id: string): Promise<string> {
  const { data: ticket } = await supabase
    .from("support_tickets")
    .select("id, ticket_number, client_email, client_name, subject, body, description, status, ai_scheduled_at, account_id")
    .eq("id", ticket_id)
    .maybeSingle();

  if (!ticket) return "not_found";

  if (["ai_replied", "escalated", "resolved", "closed", "human_replied"].includes(ticket.status)) {
    return `skipped:${ticket.status}`;
  }

  // Gather all context in parallel
  const [ctx, catalog] = await Promise.all([
    gatherClientContext(supabase, ticket.client_email),
    loadServicesCatalog(supabase),
  ]);

  const messageBody = ticket.body || ticket.description || "";
  const lang = detectLanguage(messageBody + " " + ticket.subject, ctx.profile?.preferred_language);
  const systemPrompt = buildSystemPrompt(lang, ctx, catalog);

  const userPrompt = `Ticket: ${ticket.ticket_number}
Sujet: ${ticket.subject}
Message du client:
${messageBody}`;

  let aiRaw = "";
  let parsed: { action: string; confidence: number; category: string; language: string; response: string; escalation_reason: string | null } | null = null;

  try {
    aiRaw = await callAI(systemPrompt, userPrompt);
    // Extract JSON (AI might wrap in markdown code block)
    const jsonMatch = aiRaw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error("[support-ai-responder] AI call/parse failed for ticket", ticket_id, e);
    // Fallback: escalate
    parsed = {
      action: "escalate",
      confidence: 0,
      category: "unknown",
      language: lang,
      response: "",
      escalation_reason: `AI error: ${(e as Error).message?.slice(0, 200)}`,
    };
  }

  if (!parsed) {
    // Could not parse JSON — escalate
    parsed = {
      action: "escalate",
      confidence: 0,
      category: "unknown",
      language: lang,
      response: "",
      escalation_reason: `Could not parse AI response: ${aiRaw?.slice(0, 200)}`,
    };
  }

  const shouldEscalate =
    parsed.action === "escalate" ||
    parsed.confidence < 80 ||
    ["refund", "complaint"].includes(parsed.category) ||
    (parsed.response ?? "").toLowerCase().includes("[escalade]");

  if (shouldEscalate) {
    const reason = parsed.escalation_reason || `Confiance: ${parsed.confidence}% | Catégorie: ${parsed.category}`;

    await supabase
      .from("support_tickets")
      .update({
        status: "escalated",
        escalated_at: new Date().toISOString(),
        escalated_reason: reason,
        ai_confidence: (parsed.confidence ?? 0) / 100,
        ai_responded_at: new Date().toISOString(),
        ai_response: parsed.response || aiRaw,
        category: parsed.category ?? "general",
        internal_notes: `[IA] Escalade automatique — ${reason}`,
        updated_at: new Date().toISOString(),
      })
      .eq("id", ticket_id);

    // Internal note in ticket_replies
    await supabase.from("ticket_replies").insert({
      ticket_id,
      content: `🔴 Escalade automatique IA\nConfiance: ${parsed.confidence}%\nCatégorie: ${parsed.category}\nRaison: ${reason}`,
      is_admin: true,
      sender_type: "system",
      sender_role: "admin",
    });

    // Notify team
    await supabase.from("email_queue").insert({
      event_key: `escalation_${ticket.ticket_number}_${Date.now()}`,
      to_email: ADMIN_ESCALATION_EMAIL,
      template_key: "support_escalation",
      template_vars: {
        ticket_number: ticket.ticket_number,
        client_name: ticket.client_name ?? ctx.profile?.full_name ?? ticket.client_email,
        client_email: ticket.client_email,
        subject: ticket.subject,
        body: messageBody.slice(0, 2000),
        ai_reason: reason,
        account_number: ctx.account?.account_number ?? "Inconnu",
        confidence: parsed.confidence,
        category: parsed.category,
        portal_url: PORTAL_URL,
      },
      status: "queued",
      priority: "high",
      language: lang,
    });

    return `escalated:${parsed.category}:${parsed.confidence}%`;
  }

  // Auto-respond to client
  const responseText = parsed.response || aiRaw;

  await supabase
    .from("support_tickets")
    .update({
      status: "ai_replied",
      ai_response: responseText,
      ai_responded_at: new Date().toISOString(),
      ai_confidence: (parsed.confidence ?? 85) / 100,
      category: parsed.category ?? "general",
      first_response_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", ticket_id);

  await supabase.from("ticket_replies").insert({
    ticket_id,
    content: responseText,
    is_admin: true,
    sender_type: "ai",
    sender_role: "admin",
  });

  await supabase.from("email_queue").insert({
    event_key: `ai_reply_${ticket.ticket_number}_${Date.now()}`,
    to_email: ticket.client_email,
    template_key: "support_ai_reply",
    template_vars: {
      client_name: ticket.client_name ?? ctx.profile?.full_name ?? ticket.client_email,
      ticket_number: ticket.ticket_number,
      subject: `RE: ${ticket.subject}`,
      original_subject: ticket.subject,
      ai_response: responseText,
      account_number: ctx.account?.account_number ?? "Inconnu",
      portal_url: PORTAL_URL,
    },
    status: "queued",
    language: lang,
  });

  return `ai_replied:${parsed.category}:${parsed.confidence}%`;
}

// ─────────────────────────────────────────────────────────
// MAIN HANDLER
// ─────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch (_e) { /* empty body is ok */ }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // ── CRON MODE: process all pending tickets ──
  if (body.cron === true) {
    const { data: pending } = await supabase
      .from("support_tickets")
      .select("id")
      .lte("ai_scheduled_at", new Date().toISOString())
      .is("ai_responded_at", null)
      .eq("status", "open")
      .limit(10);

    if (!pending?.length) {
      return new Response(JSON.stringify({ ok: true, processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: Record<string, string> = {};
    for (const { id } of pending) {
      try {
        results[id] = await processTicket(supabase, id);
      } catch (e) {
        console.error("[support-ai-responder] cron: ticket", id, "failed:", e);
        results[id] = `error:${(e as Error).message?.slice(0, 100)}`;
      }
    }

    return new Response(JSON.stringify({ ok: true, processed: pending.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── SINGLE TICKET MODE ──
  const ticket_id = String(body.ticket_id ?? "");
  if (!ticket_id) {
    return new Response(JSON.stringify({ error: "ticket_id or cron:true required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const action = await processTicket(supabase, ticket_id);
  return new Response(JSON.stringify({ ok: true, action }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
