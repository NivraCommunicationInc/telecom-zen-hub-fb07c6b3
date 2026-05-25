/**
 * agent-crm-email-blast — Daily 10h UTC.
 * Sends personalized promo emails to up to 50 CRM prospects with email.
 */
import {
  corsHeaders, makeClient, logEvent, logAudit, updateRegistry,
  queueEmail, callGeminiJSON, jsonResponse, requireServiceAuth,
  SUPABASE_URL, isInternalEmail,
} from "../_shared/agentHelpers.ts";
import { generateUnsubscribeToken } from "../_shared/unsubscribeToken.ts";

const AGENT = "crm-email-blast";
const UNSUBSCRIBE_BASE = `${SUPABASE_URL}/functions/v1/email-unsubscribe`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const unauth = requireServiceAuth(req);
  if (unauth) return unauth;
  const t0 = Date.now();
  const supabase = makeClient();
  try {
    await logEvent(supabase, AGENT, "info", "Démarrage du blast email CRM quotidien");

    // STEP 1 — prospects
    const { data: prospects, error: pErr } = await supabase.rpc("noop_unused" as any).then(
      () => ({ data: null, error: null }),
      () => ({ data: null, error: null }),
    );
    void prospects; void pErr;

    // CASL/Loi-25 gate: only contacts who consented and have not unsubscribed.
    // Also strip internal Nivra addresses (owner / staff registered themselves
    // at POS — must never receive their own promo as primary recipient).
    const { data: candidatesRaw } = await supabase
      .from("crm_contacts")
      .select("id, first_name, last_name, email, city, call_status, priority")
      .not("email", "is", null)
      .neq("email", "")
      .eq("marketing_consent", true)
      .is("unsubscribed_at", null)
      .not("email", "ilike", "%@nivra-telecom.ca")
      .not("email", "ilike", "%@nivratelecom.ca")
      .not("call_status", "in", "(sold,do_not_call,not_interested)")
      .limit(200);
    const candidates = (candidatesRaw ?? []).filter(
      (c: any) => !isInternalEmail(c.email),
    );

    // Filter out anyone already emailed in last 7 days
    const sevenAgo = new Date(Date.now() - 7 * 86400_000).toISOString();
    const ids = (candidates ?? []).map((c: any) => c.id);
    const { data: recentQueue } = await supabase
      .from("email_queue")
      .select("template_vars")
      .gte("created_at", sevenAgo)
      .in("template_key", ["crm_promo_blast", "crm_followup"]);
    const recentIds = new Set(
      (recentQueue ?? [])
        .map((r: any) => r.template_vars?.crm_contact_id)
        .filter(Boolean)
        .map((s: any) => String(s)),
    );

    // Global suppression list cross-check (someone may have unsubscribed under
    // a different consent surface — must still be honored here).
    const emailsLower = (candidates ?? [])
      .map((c: any) => String(c.email || "").trim().toLowerCase())
      .filter(Boolean);
    let suppressedSet = new Set<string>();
    if (emailsLower.length > 0) {
      const { data: suppressed } = await supabase
        .from("email_unsubscribes")
        .select("email")
        .in("email", emailsLower)
        .eq("is_active", true);
      suppressedSet = new Set((suppressed ?? []).map((r: any) => String(r.email).toLowerCase()));
    }

    const targets = (candidates ?? [])
      .filter((c: any) => !recentIds.has(String(c.id)))
      .filter((c: any) => !suppressedSet.has(String(c.email).toLowerCase()))
      .slice(0, 50);

    if (targets.length === 0) {
      await logEvent(supabase, AGENT, "info", "Aucun prospect éligible aujourd'hui");
      await logAudit(supabase, AGENT, "email_blast_daily", "skipped", { reason: "no_targets" }, Date.now() - t0);
      await updateRegistry(supabase, AGENT, true);
      return jsonResponse({ ok: true, sent: 0 });
    }

    // STEP 2 — get real offers (used in prompt context only)
    const { data: services } = await supabase
      .from("services")
      .select("name, price, billing_type, category")
      .eq("is_active", true)
      .order("price", { ascending: true });

    // STEP 3 & 4 — generate + queue
    let sent = 0;
    const errors: string[] = [];
    for (const c of targets as any[]) {
      try {
        const prompt = `Tu es l'agent marketing de Nivra Telecom au Québec.

Génère un email promotionnel PERSONNALISÉ pour ce prospect:
Prénom: ${c.first_name || "Client"}
Ville: ${c.city || "Québec"}

OFFRES RÉELLES NIVRA (utilise UNIQUEMENT ces prix, ne jamais inventer):
- Internet GIGA 940 Mbps: 60$/mois
- Bundle GIGA + TV 25 choix: 100$/mois
- Mobile 75 Go 4G: 60$/30 jours
- Borne WiFi: 60$ achat unique
- Sans contrat, sans vérification crédit
- Alternative à Bell et Vidéotron

L'email doit:
1. Être en français québécois naturel
2. Mentionner sa ville si disponible
3. Avoir un sujet accrocheur
4. Être court (3-4 paragraphes max)
5. Avoir un CTA clair
6. Mentionner l'économie vs Bell
7. Jamais mentionner de prix faux
8. Ton: chaleureux, direct, honnête

Réponds STRICTEMENT en JSON: { "subject": "...", "body_fr": "...", "cta_label": "..." }`;

        const ai = await callGeminiJSON(prompt);
        const subject = String(ai.subject || "Internet GIGA 60$/mois — Sans contrat, sans crédit");
        const bodyFr = String(ai.body_fr || "");
        const ctaLabel = String(ai.cta_label || "Voir nos forfaits");

        // Per-recipient HMAC-signed one-click unsubscribe URL (CASL requirement).
        const unsubscribeToken = await generateUnsubscribeToken(c.email);
        const unsubscribeUrl = `${UNSUBSCRIBE_BASE}?token=${encodeURIComponent(unsubscribeToken)}`;

        const r = await queueEmail(supabase, {
          toEmail: c.email,
          templateKey: "crm_promo_blast",
          subject,
          templateVars: {
            crm_contact_id: c.id,
            first_name: c.first_name || "Client",
            city: c.city || "",
            subject,
            hero_title: subject,
            body_fr: bodyFr,
            cta_label: ctaLabel,
            unsubscribe_url: unsubscribeUrl,
          },
          eventKey: `crm-blast-${c.id}-${new Date().toISOString().slice(0, 10)}`,
        });
        if (!r.ok) {
          errors.push(`${c.id}:${r.error}`);
          continue;
        }
        sent++;

        // Stamp last touch so analytics / cooldowns can rely on a single column
        await supabase
          .from("crm_contacts")
          .update({ last_marketing_email_at: new Date().toISOString() })
          .eq("id", c.id);

        await logEvent(supabase, AGENT, "email_sent",
          `Email promotionnel envoyé à ${c.first_name ?? ""} ${c.last_name ?? ""} — ${c.city ?? "—"}`.trim(),
          { contact_id: c.id, email: c.email, city: c.city });
      } catch (e) {
        errors.push(`${c.id}:${String(e)}`);
      }
    }

    await logAudit(supabase, AGENT, "email_blast_daily", errors.length === 0 ? "success" : "warning",
      { sent_count: sent, errors: errors.slice(0, 5), prospects_total: targets.length, services_loaded: services?.length ?? 0 },
      Date.now() - t0,
      errors.length > 0 ? `${errors.length} errors` : undefined);
    await updateRegistry(supabase, AGENT, errors.length === 0 || sent > 0);
    return jsonResponse({ ok: true, sent, errors: errors.length });
  } catch (e) {
    const msg = String(e);
    await logEvent(supabase, AGENT, "error", "Échec du blast email CRM", { error: msg });
    await logAudit(supabase, AGENT, "email_blast_daily", "failure", null, Date.now() - t0, msg);
    await updateRegistry(supabase, AGENT, false, msg);
    return jsonResponse({ ok: false, error: msg }, 500);
  }
});
