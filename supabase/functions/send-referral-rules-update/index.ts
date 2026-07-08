/**
 * send-referral-rules-update
 * -------------------------------------------------------------
 * Annonce la refonte du programme de parrainage Nivra Telecom.
 * Template officiel bleu #0066CC — même architecture que
 * send-loyalty-rules-update.
 *
 * Modes:
 *   { mode: "test", test_email: "x@y.z" }   → un seul envoi
 *   { mode: "all",  confirm: true }         → clients actifs avec
 *                                              abonnement actif
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendOfficialEmail } from "../_shared/officialEmail.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUBJECT = "Nouveau programme de parrainage Nivra Telecom — 25 $ + 300 points";
const EFFECTIVE_DATE = "8 juillet 2026";

function buildBody(firstName?: string) {
  const greeting = firstName ? `Bonjour ${firstName},` : "Bonjour,";
  return {
    greeting,
    bodyHtml: `
      Nous simplifions et améliorons notre <strong>programme de parrainage</strong> pour le rendre
      plus clair, plus rapide et plus rentable pour vous. Les nouvelles règles entrent en vigueur
      dès le <strong>${EFFECTIVE_DATE}</strong>.
      <br><br>
      Partagez votre code de parrainage avec vos proches et gagnez
      <strong>25 $</strong> + <strong>300 points de fidélité</strong> pour chaque parrainage qualifié —
      <strong>sans aucun plafond</strong>.
    `,
    cardTitle: "Nouvelles règles du programme",
    cardRows: [
      ["Récompense parrain", "25 $ + 300 points"],
      ["Condition de qualification", "3 factures mensuelles consécutives payées"],
      ["Compte du filleul", "Actif au moment de la validation"],
      ["Mode de versement recommandé", "Interac e-Transfer"],
      ["Autre choix", "Carte prépayée Visa/Mastercard"],
      ["Délai de versement", "7 à 14 jours après validation"],
      ["Plafond de références", "Aucun"],
    ] as Array<[string, string]>,
    afterCardHtml: `
      <h3 style="margin-top:24px;margin-bottom:8px;color:#0066CC;font-size:16px;">Comment ça fonctionne&nbsp;?</h3>
      <ol style="margin:0;padding-left:20px;font-size:14px;color:#0f172a;line-height:1.7;">
        <li>Partagez votre code de parrainage.</li>
        <li>Votre proche commande chez Nivra Telecom en utilisant votre code.</li>
        <li>Il complète <strong>3 factures mensuelles consécutives</strong> entièrement payées.</li>
        <li>Nous validons automatiquement le dossier.</li>
        <li>Vous recevez <strong>25 $</strong> ainsi que <strong>300 points de fidélité</strong>.</li>
      </ol>
      <div style="margin-top:16px;padding:16px;background:#f4f7fb;border-radius:8px;font-size:13px;color:#475569;">
        <strong>Rappel&nbsp;:</strong> l'auto-parrainage est interdit, un seul parrain par nouveau client,
        et Nivra Telecom se réserve le droit de refuser tout parrainage frauduleux.
      </div>
    `,
    ctaPrimaryUrl: "https://nivra-telecom.ca/portal/referrals",
    ctaPrimaryLabel: "Partager mon code",
    ctaSecondaryUrl: "https://nivra-telecom.ca/parrainage",
    ctaSecondaryLabel: "Voir le programme",
    helpHtml: `Une question&nbsp;? Écrivez-nous à <a href="mailto:support@nivra-telecom.ca" style="color:#0066CC;">support@nivra-telecom.ca</a>.`,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const body = await req.json().catch(() => ({}));
    const mode = body.mode ?? "test";

    if (mode === "test") {
      const to = body.test_email;
      if (!to) {
        return new Response(JSON.stringify({ error: "test_email required" }), {
          status: 400, headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      const parts = buildBody();
      const result = await sendOfficialEmail({
        to,
        subject: SUBJECT,
        preheader: "Nouveau programme de parrainage — 25 $ + 300 points, sans plafond.",
        badge: "PROGRAMME DE PARRAINAGE",
        heroTitle: "Un nouveau programme, encore plus généreux",
        heroSub: `En vigueur le ${EFFECTIVE_DATE}`,
        ...parts,
      });
      return new Response(JSON.stringify({ mode: "test", to, result }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    if (mode === "all") {
      if (body.confirm !== true) {
        return new Response(JSON.stringify({ error: "confirm:true required for bulk send" }), {
          status: 400, headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      const { data: subs, error: subsErr } = await supabase
        .from("billing_subscriptions")
        .select("customer_id")
        .eq("status", "active");
      if (subsErr) throw subsErr;
      const customerIds = Array.from(new Set((subs ?? []).map((s: any) => s.customer_id).filter(Boolean)));

      if (customerIds.length === 0) {
        return new Response(JSON.stringify({ mode: "all", total: 0, sent: 0 }), {
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      const { data: profiles, error: profErr } = await supabase
        .from("billing_customers")
        .select("id, email, first_name, last_name")
        .in("id", customerIds);
      if (profErr) throw profErr;

      let sent = 0, skipped = 0, failed = 0;
      const errors: any[] = [];

      for (const p of profiles ?? []) {
        const email = (p as any).email;
        if (!email) { skipped++; continue; }
        const first = (p as any).first_name || "";
        const parts = buildBody(first);
        const eventKey = `referral_rules_update_2026_07:${email.toLowerCase()}`;
        try {
          const res = await sendOfficialEmail({
            to: email,
            subject: SUBJECT,
            preheader: "Nouveau programme de parrainage — 25 $ + 300 points, sans plafond.",
            badge: "PROGRAMME DE PARRAINAGE",
            heroTitle: "Un nouveau programme, encore plus généreux",
            heroSub: `En vigueur le ${EFFECTIVE_DATE}`,
            ...parts,
          });
          if (res.success) sent++;
          else { failed++; errors.push({ email, error: res.error }); }
          await supabase.from("email_send_log").insert({
            message_id: eventKey,
            template_name: "referral_rules_update_2026_07",
            recipient_email: email,
            status: res.success ? "sent" : "failed",
            error_message: res.success ? null : String(res.error ?? ""),
          }).select().maybeSingle();
        } catch (e: any) {
          failed++;
          errors.push({ email, error: String(e?.message ?? e) });
        }
      }

      return new Response(JSON.stringify({
        mode: "all", total: profiles?.length ?? 0, sent, skipped, failed, errors: errors.slice(0, 20),
      }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "invalid mode" }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[send-referral-rules-update]", e);
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
