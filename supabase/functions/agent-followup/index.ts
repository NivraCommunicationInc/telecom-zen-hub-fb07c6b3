/**
 * agent-followup — Daily 14h UTC.
 * Follows up on interested CRM prospects after 14+ days of silence.
 */
import {
  corsHeaders, makeClient, logEvent, logAudit, updateRegistry,
  queueEmail, callGeminiJSON, jsonResponse,
} from "../_shared/agentHelpers.ts";

const AGENT = "followup";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const t0 = Date.now();
  const supabase = makeClient();
  try {
    await logEvent(supabase, AGENT, "info", "Démarrage Follow-up Automatique");

    const { data: candidates } = await supabase
      .from("crm_contacts")
      .select("id, first_name, last_name, email, city, call_status, notes")
      .not("email", "is", null)
      .neq("email", "")
      .in("call_status", ["interested", "callback_scheduled", "no_answer"])
      .limit(200);

    const fourteenAgo = new Date(Date.now() - 14 * 86400_000).toISOString();
    const { data: recentQueue } = await supabase
      .from("email_queue")
      .select("template_vars")
      .gte("created_at", fourteenAgo)
      .in("template_key", ["crm_promo_blast", "crm_followup"]);
    const recentIds = new Set(
      (recentQueue ?? [])
        .map((r: any) => r.template_vars?.crm_contact_id)
        .filter(Boolean)
        .map((s: any) => String(s)),
    );
    const targets = (candidates ?? [])
      .filter((c: any) => !recentIds.has(String(c.id)))
      .slice(0, 30);

    if (targets.length === 0) {
      await logEvent(supabase, AGENT, "info", "Aucun prospect à relancer aujourd'hui");
      await logAudit(supabase, AGENT, "followup_daily", "skipped", { reason: "no_targets" }, Date.now() - t0);
      await updateRegistry(supabase, AGENT, true);
      return jsonResponse({ ok: true, sent: 0 });
    }

    let sent = 0;
    const errors: string[] = [];
    for (const c of targets as any[]) {
      try {
        const prompt = `Tu es l'agent commercial bienveillant de Nivra Telecom (Québec).

Tu relances ce prospect intéressé après 14+ jours sans contact:
Prénom: ${c.first_name || "Client"}
Ville: ${c.city || "Québec"}
Statut CRM: ${c.call_status}

OFFRES RÉELLES NIVRA (jamais inventer de prix):
- Internet GIGA 940 Mbps: 60$/mois
- Bundle GIGA + TV 25 choix: 100$/mois
- Mobile 75 Go 4G: 60$/30 jours
- Sans contrat, sans crédit
- Support local québécois

Angle à utiliser (différent d'un blast initial):
- Liberté sans contrat
- Accessibilité sans vérification de crédit
- Support local humain

L'email doit:
1. Être en français québécois naturel
2. Court (3-4 paragraphes)
3. Sujet rappelant qu'on pense à eux
4. CTA doux ("reprenons la conversation")
5. Mentionner sa ville si disponible
6. Ton chaleureux, jamais agressif

Réponds STRICTEMENT en JSON: { "subject": "...", "body_fr": "...", "cta_label": "..." }`;

        const ai = await callGeminiJSON(prompt);
        const subject = String(ai.subject || "On pensait à vous — Internet sans contrat");
        const bodyFr = String(ai.body_fr || "");
        const ctaLabel = String(ai.cta_label || "Reprendre où vous étiez");

        const r = await queueEmail(supabase, {
          toEmail: c.email,
          templateKey: "crm_followup",
          subject,
          templateVars: {
            crm_contact_id: c.id,
            first_name: c.first_name || "Client",
            city: c.city || "",
            subject,
            hero_title: subject,
            body_fr: bodyFr,
            cta_label: ctaLabel,
          },
          eventKey: `crm-followup-${c.id}-${new Date().toISOString().slice(0, 10)}`,
        });
        if (!r.ok) { errors.push(`${c.id}:${r.error}`); continue; }
        sent++;
        await logEvent(supabase, AGENT, "email_sent",
          `Relance envoyée à ${c.first_name ?? ""} ${c.last_name ?? ""} — ${c.city ?? "—"}`.trim(),
          { contact_id: c.id, email: c.email });
      } catch (e) {
        errors.push(`${c.id}:${String(e)}`);
      }
    }

    await logAudit(supabase, AGENT, "followup_daily", errors.length === 0 ? "success" : "warning",
      { sent_count: sent, errors: errors.slice(0, 5), targets_total: targets.length },
      Date.now() - t0,
      errors.length > 0 ? `${errors.length} errors` : undefined);
    await updateRegistry(supabase, AGENT, sent > 0 || errors.length === 0);
    return jsonResponse({ ok: true, sent, errors: errors.length });
  } catch (e) {
    const msg = String(e);
    await logEvent(supabase, AGENT, "error", "Échec Follow-up Automatique", { error: msg });
    await logAudit(supabase, AGENT, "followup_daily", "failure", null, Date.now() - t0, msg);
    await updateRegistry(supabase, AGENT, false, msg);
    return jsonResponse({ ok: false, error: msg }, 500);
  }
});
