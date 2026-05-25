/**
 * agent-crm-sequence — Multi-touch nurture sequence for CASL-consented CRM
 * contacts. Runs every 4h. Picks each contact's CURRENT step in the sequence
 * (based on the most recent crm_* template the contact received) and decides
 * whether the next step is due. Each step uses a DIFFERENT template_key so
 * the 7-day dedupe baked into agent-crm-email-blast / agent-followup does
 * not block sequence progression.
 *
 * Sequence
 *   Step 1: crm_promo_blast        Day  0     (handled by agent-crm-email-blast)
 *   Step 2: crm_sequence_social    Day  3     (+3d after step 1)
 *   Step 3: crm_sequence_savings   Day  7     (+4d after step 2)
 *   Step 4: crm_sequence_lastcall  Day 14     (+7d after step 3)
 *
 * After step 4 a contact exits the sequence. Re-entry can only happen via a
 * staff-driven workflow (call_status change → followup picks them back up).
 *
 * Volume cap per run: 80 contacts. Soft cap on Gemini cost.
 */
import {
  corsHeaders, makeClient, logEvent, logAudit, updateRegistry,
  queueEmail, callGeminiJSON, jsonResponse, requireServiceAuth,
  SUPABASE_URL, isInternalEmail,
} from "../_shared/agentHelpers.ts";
import { generateUnsubscribeToken } from "../_shared/unsubscribeToken.ts";

const AGENT = "crm-sequence";
const UNSUBSCRIBE_BASE = `${SUPABASE_URL}/functions/v1/email-unsubscribe`;

type Step = {
  key:
    | "crm_promo_blast"
    | "crm_sequence_social"
    | "crm_sequence_savings"
    | "crm_sequence_lastcall";
  next_template:
    | "crm_sequence_social"
    | "crm_sequence_savings"
    | "crm_sequence_lastcall"
    | null;
  next_in_days: number; // wait this many days after step.key before sending next_template
  default_subject: string;
  cta_label: string;
  badge: string;
  hero_title: string;
  angle_prompt: string;
};

const SEQUENCE: Step[] = [
  {
    key: "crm_promo_blast",
    next_template: "crm_sequence_social",
    next_in_days: 3,
    default_subject: "Ce que nos clients disent — Nivra Telecom",
    cta_label: "Découvrir les témoignages",
    badge: "VOIX DES CLIENTS",
    hero_title: "Ils ont fait le saut. Vous?",
    angle_prompt:
      "Angle: PREUVE SOCIALE. Tu écris la 2e touche d'une séquence, 3 jours après l'offre initiale. " +
      "Mentionne 2 micro-témoignages crédibles de Québécois qui ont quitté Bell ou Vidéotron pour Nivra " +
      "(exemple: 'Marc, Montréal, $35/mois de moins sur sa facture'). Pas de fausses citations longues — " +
      "phrases courtes, naturelles. Conclus en proposant une discussion sans engagement.",
  },
  {
    key: "crm_sequence_social",
    next_template: "crm_sequence_savings",
    next_in_days: 4,
    default_subject: "720$/an d'économies vs Bell — calcul réel",
    cta_label: "Voir l'économie complète",
    badge: "CALCUL D'ÉCONOMIE",
    hero_title: "Combien Bell vous coûte de trop?",
    angle_prompt:
      "Angle: CALCUL D'ÉCONOMIE CONCRET. Tu écris la 3e touche, 7 jours après l'offre initiale. " +
      "Décompose un calcul simple: Bell Internet ~100-120$/mois, Nivra GIGA 60$/mois. " +
      "Soustraction mensuelle puis annuelle (720$/an). Sois précis, pas vendeur. Termine par une " +
      "phrase qui invite à essayer un mois (rappelle que c'est sans contrat).",
  },
  {
    key: "crm_sequence_savings",
    next_template: "crm_sequence_lastcall",
    next_in_days: 7,
    default_subject: "Dernière relance — votre offre Nivra",
    cta_label: "Réserver ma place",
    badge: "DERNIÈRE RELANCE",
    hero_title: "On respecte votre boîte courriel",
    angle_prompt:
      "Angle: DERNIÈRE RELANCE RESPECTUEUSE. Tu écris la 4e et dernière touche, 14 jours après l'offre initiale. " +
      "Reconnais que ça fait plusieurs courriels. Dis qu'après celui-ci on arrête de les contacter. " +
      "Re-rappelle brièvement la valeur (GIGA 60$, sans contrat, sans crédit). Termine par une porte ouverte: " +
      "ils peuvent toujours revenir plus tard. Aucun argument pressant ou trompeur.",
  },
  {
    key: "crm_sequence_lastcall",
    next_template: null, // end of sequence
    next_in_days: 0,
    default_subject: "",
    cta_label: "",
    badge: "",
    hero_title: "",
    angle_prompt: "",
  },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const unauth = requireServiceAuth(req);
  if (unauth) return unauth;

  const t0 = Date.now();
  const supabase = makeClient();
  const MAX_PER_RUN = 80;

  try {
    await logEvent(supabase, AGENT, "info", "Démarrage de la séquence de nurture CRM");

    // STEP 1 — pull consenting contacts
    const { data: candidatesRaw } = await supabase
      .from("crm_contacts")
      .select("id, first_name, last_name, email, city, call_status")
      .not("email", "is", null)
      .neq("email", "")
      .eq("marketing_consent", true)
      .is("unsubscribed_at", null)
      .not("email", "ilike", "%@nivra-telecom.ca")
      .not("email", "ilike", "%@nivratelecom.ca")
      .not("call_status", "in", "(sold,do_not_call,not_interested)")
      .limit(400);

    const candidates = (candidatesRaw ?? []).filter(
      (c: any) => !isInternalEmail(c.email),
    );

    if (candidates.length === 0) {
      await logEvent(supabase, AGENT, "info", "Aucun contact consenting éligible");
      await logAudit(supabase, AGENT, "sequence_tick", "skipped", { reason: "no_candidates" }, Date.now() - t0);
      await updateRegistry(supabase, AGENT, true);
      return jsonResponse({ ok: true, sent: 0 });
    }

    // STEP 2 — suppression cross-check
    const emailsLower = candidates
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
    const eligible = candidates.filter(
      (c: any) => !suppressedSet.has(String(c.email).toLowerCase()),
    );

    // STEP 3 — for each contact, find their most recent crm_* send
    const contactIds = eligible.map((c: any) => String(c.id));
    const sequenceKeys = [
      "crm_promo_blast",
      "crm_sequence_social",
      "crm_sequence_savings",
      "crm_sequence_lastcall",
      "crm_followup",
    ];
    const { data: history } = await supabase
      .from("email_queue")
      .select("template_key, template_vars, created_at")
      .in("template_key", sequenceKeys)
      .gte("created_at", new Date(Date.now() - 60 * 86400_000).toISOString())
      .order("created_at", { ascending: false })
      .limit(5000);

    // Index latest send per contact_id
    const latestByContact = new Map<string, { template_key: string; created_at: string }>();
    for (const row of history ?? []) {
      const cid = String((row as any).template_vars?.crm_contact_id || "");
      if (!cid) continue;
      if (!latestByContact.has(cid)) {
        latestByContact.set(cid, {
          template_key: (row as any).template_key,
          created_at: (row as any).created_at,
        });
      }
    }

    // STEP 4 — pick contacts whose NEXT step is due
    type Due = { contact: any; step: Step };
    const due: Due[] = [];
    for (const c of eligible) {
      const last = latestByContact.get(String(c.id));
      // Contacts with no prior send go to agent-crm-email-blast, not here.
      // (Phase B sequence assumes step 1 already fired.)
      if (!last) continue;
      const step = SEQUENCE.find((s) => s.key === last.template_key);
      if (!step || step.next_template === null) continue; // unknown template OR sequence complete

      const daysSince = (Date.now() - new Date(last.created_at).getTime()) / 86400_000;
      if (daysSince < step.next_in_days) continue;

      due.push({ contact: c, step });
      if (due.length >= MAX_PER_RUN) break;
    }

    if (due.length === 0) {
      await logEvent(supabase, AGENT, "info", "Aucun contact dû pour la prochaine touche");
      await logAudit(supabase, AGENT, "sequence_tick", "skipped",
        { reason: "no_due", eligible_total: eligible.length, history_rows: history?.length ?? 0 },
        Date.now() - t0);
      await updateRegistry(supabase, AGENT, true);
      return jsonResponse({ ok: true, sent: 0 });
    }

    // STEP 5 — for each due contact, generate copy + enqueue
    let sent = 0;
    const errors: string[] = [];
    const stepCounts: Record<string, number> = {};
    for (const { contact: c, step } of due) {
      try {
        const nextTemplate = step.next_template!;
        const prompt = `Tu es l'agent commercial respectueux de Nivra Telecom (Québec).

Tu écris la prochaine touche d'une séquence de nurture pour ce prospect:
Prénom: ${c.first_name || "Client"}
Ville: ${c.city || "Québec"}
Touche précédente: ${step.key}
Touche actuelle: ${nextTemplate}

${step.angle_prompt}

OFFRES RÉELLES NIVRA (jamais inventer de prix):
- Internet GIGA 940 Mbps: 60$/mois
- Bundle GIGA + TV 25 choix: 100$/mois
- Mobile 75 Go 4G: 60$/30 jours
- Sans contrat, sans crédit, support local Quebec

Contraintes:
1. Français québécois naturel
2. Court — 3 à 4 paragraphes
3. Sujet accrocheur mais honnête
4. Mentionne la ville du prospect si disponible
5. CTA clair en lien avec l'angle de la touche
6. Ton bienveillant, jamais agressif
7. Conforme Loi 25 / CASL — pas de pression mensongère

Réponds STRICTEMENT en JSON: { "subject": "...", "body_fr": "...", "cta_label": "..." }`;

        const ai = await callGeminiJSON(prompt);
        const subject = String(ai.subject || step.default_subject).slice(0, 200);
        const bodyFr = String(ai.body_fr || "");
        const ctaLabel = String(ai.cta_label || step.cta_label);

        const unsubscribeToken = await generateUnsubscribeToken(c.email);
        const unsubscribeUrl = `${UNSUBSCRIBE_BASE}?token=${encodeURIComponent(unsubscribeToken)}`;

        const r = await queueEmail(supabase, {
          toEmail: c.email,
          templateKey: nextTemplate,
          subject,
          templateVars: {
            crm_contact_id: c.id,
            first_name: c.first_name || "Client",
            city: c.city || "",
            subject,
            hero_title: ai.subject ? subject : step.hero_title,
            badge: step.badge,
            body_fr: bodyFr,
            cta_label: ctaLabel,
            unsubscribe_url: unsubscribeUrl,
          },
          eventKey: `${nextTemplate}-${c.id}-${new Date().toISOString().slice(0, 10)}`,
        });
        if (!r.ok) {
          errors.push(`${c.id}:${r.error}`);
          continue;
        }
        sent++;
        stepCounts[nextTemplate] = (stepCounts[nextTemplate] ?? 0) + 1;

        await supabase
          .from("crm_contacts")
          .update({ last_marketing_email_at: new Date().toISOString() })
          .eq("id", c.id);

        await logEvent(supabase, AGENT, "email_sent",
          `Séquence ${nextTemplate} → ${c.first_name ?? ""} ${c.last_name ?? ""} — ${c.city ?? "—"}`.trim(),
          { contact_id: c.id, email: c.email, prev_step: step.key, next_template: nextTemplate });
      } catch (e) {
        errors.push(`${c.id}:${String(e)}`);
      }
    }

    await logAudit(
      supabase, AGENT, "sequence_tick",
      errors.length === 0 ? "success" : "warning",
      {
        sent_count: sent,
        eligible_total: eligible.length,
        due_total: due.length,
        step_breakdown: stepCounts,
        errors: errors.slice(0, 5),
      },
      Date.now() - t0,
      errors.length > 0 ? `${errors.length} errors` : undefined,
    );
    await updateRegistry(supabase, AGENT, sent > 0 || errors.length === 0);
    return jsonResponse({ ok: true, sent, errors: errors.length, step_breakdown: stepCounts });
  } catch (e) {
    const msg = String(e);
    await logEvent(supabase, AGENT, "error", "Échec de la séquence", { error: msg });
    await logAudit(supabase, AGENT, "sequence_tick", "failure", null, Date.now() - t0, msg);
    await updateRegistry(supabase, AGENT, false, msg);
    return jsonResponse({ ok: false, error: msg }, 500);
  }
});
