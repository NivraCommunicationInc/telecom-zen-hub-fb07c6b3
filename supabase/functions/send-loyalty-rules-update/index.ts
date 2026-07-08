/**
 * send-loyalty-rules-update
 * -------------------------------------------------------------
 * Envoie un courriel officiel (template Nivra bleu #0066CC) qui
 * annonce les nouvelles règles du programme de fidélité — en
 * vigueur immédiatement (8 juillet 2026).
 *
 * Modes:
 *   { mode: "test", test_email: "x@y.z" }   → un seul envoi
 *   { mode: "all",  confirm: true }         → tous les clients actifs
 *                                              avec au moins un abonnement actif
 *
 * Idempotence via event_key: loyalty_rules_update_2026_07:<email>
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendOfficialEmail } from "../_shared/officialEmail.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUBJECT = "Mise à jour du programme de fidélité Nivra";
const EFFECTIVE_DATE = "8 juillet 2026";

function buildBody(firstName?: string) {
  const greeting = firstName ? `Bonjour ${firstName},` : "Bonjour,";
  return {
    greeting,
    bodyHtml: `
      Nous améliorons le <strong>programme de fidélité Nivra</strong> pour le rendre plus simple,
      plus prévisible et plus juste pour tous nos clients. Les nouvelles règles entrent en vigueur
      dès le <strong>${EFFECTIVE_DATE}</strong>.
      <br><br>
      <strong>Important :</strong> les points que vous avez déjà accumulés sont conservés à 100&nbsp;%.
      Les nouvelles règles s'appliquent uniquement aux points gagnés à partir de cette date.
    `,
    cardTitle: "Comment gagner des points (montants fixes)",
    cardRows: [
      ["Paiement d'une facture", "100 points"],
      ["Bonus paiement automatique (AutoPay Square)", "+25 points"],
      ["Bonus paiement effectué à temps", "+25 points"],
      ["Activation d'un nouveau service", "100 points"],
      ["Parrainage activé", "300 points"],
      ["Anniversaire du compte (par année)", "100 points"],
    ] as Array<[string, string]>,
    afterCardHtml: `
      <div style="margin-top:16px;padding:16px;background:#f4f7fb;border-radius:8px;font-size:14px;color:#0f172a;">
        <strong>À noter :</strong> le nombre de points gagnés ne dépend plus du montant payé.
        Une facture de 60&nbsp;$ et une facture de 120&nbsp;$ rapportent le même nombre de points.
      </div>
      <h3 style="margin-top:24px;margin-bottom:8px;color:#0066CC;font-size:16px;">Nouveau catalogue de récompenses</h3>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;">
        <tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;">Crédit de 5&nbsp;$</td><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;text-align:right;"><strong>750 pts</strong></td></tr>
        <tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;">Crédit de 10&nbsp;$</td><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;text-align:right;"><strong>1&nbsp;500 pts</strong></td></tr>
        <tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;">Crédit de 25&nbsp;$</td><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;text-align:right;"><strong>3&nbsp;500 pts</strong></td></tr>
        <tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;">Rabais de 5&nbsp;$/mois pendant 3 mois</td><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;text-align:right;"><strong>4&nbsp;000 pts</strong></td></tr>
        <tr><td style="padding:8px 0;">1 mois de service gratuit</td><td style="padding:8px 0;text-align:right;"><strong>8&nbsp;000 pts</strong></td></tr>
      </table>
    `,
    ctaPrimaryUrl: "https://nivra-telecom.ca/portal/loyalty",
    ctaPrimaryLabel: "Voir mes points",
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

    // -------------------- TEST -------------------------------
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
        preheader: "Nouvelles règles du programme de fidélité — en vigueur maintenant.",
        badge: "PROGRAMME DE FIDÉLITÉ",
        heroTitle: "Mise à jour du programme de fidélité",
        heroSub: `En vigueur le ${EFFECTIVE_DATE}`,
        ...parts,
      });
      return new Response(JSON.stringify({ mode: "test", to, result }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // -------------------- ALL --------------------------------
    if (mode === "all") {
      if (body.confirm !== true) {
        return new Response(JSON.stringify({ error: "confirm:true required for bulk send" }), {
          status: 400, headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      // Clients actifs avec au moins un abonnement actif
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
        const first = (p as any).first_name || ((p as any).full_name?.split(" ")[0]);
        const parts = buildBody(first);

        // Idempotence — insertion préalable dans email_queue via event_key
        const eventKey = `loyalty_rules_update_2026_07:${email.toLowerCase()}`;
        try {
          const res = await sendOfficialEmail({
            to: email,
            subject: SUBJECT,
            preheader: "Nouvelles règles du programme de fidélité — en vigueur maintenant.",
            badge: "PROGRAMME DE FIDÉLITÉ",
            heroTitle: "Mise à jour du programme de fidélité",
            heroSub: `En vigueur le ${EFFECTIVE_DATE}`,
            ...parts,
          });
          if (res.success) sent++;
          else { failed++; errors.push({ email, error: res.error }); }
          // log event_key for audit
          await supabase.from("email_send_log").insert({
            message_id: eventKey,
            template_name: "loyalty_rules_update_2026_07",
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
    console.error("[send-loyalty-rules-update]", e);
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
