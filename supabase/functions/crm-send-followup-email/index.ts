/**
 * crm-send-followup-email — Send a templated post-call follow-up email
 * to a CRM contact. Available templates: brochure, pricing, thanks, recap.
 */
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type TemplateKey = "brochure" | "pricing" | "thanks" | "recap";

const TEMPLATES: Record<TemplateKey, { subject: string; body: (n: string) => string }> = {
  brochure: {
    subject: "Nivra Télécom — Notre brochure d'offres",
    body: (n) => `Bonjour ${n},\n\nMerci pour notre échange. Vous trouverez ci-joint l'aperçu de nos forfaits Internet, TV et Mobile.\n\nN'hésitez pas à nous écrire si vous avez des questions.\n\nÉquipe Nivra Télécom`,
  },
  pricing: {
    subject: "Nivra Télécom — Récapitulatif tarifaire",
    body: (n) => `Bonjour ${n},\n\nVoici le récapitulatif des prix que nous avons abordés :\n\n• Internet : à partir de [À COMPLÉTER] $/mois\n• TV : à partir de [À COMPLÉTER] $/mois\n• Mobile : à partir de [À COMPLÉTER] $/mois\n\nÉquipement requis (Borne WiFi 60$, Terminal TV 50$, SIM 30$) en supplément.\n\nÉquipe Nivra Télécom`,
  },
  thanks: {
    subject: "Merci de votre intérêt — Nivra Télécom",
    body: (n) => `Bonjour ${n},\n\nMerci d'avoir pris le temps de discuter avec nous. Nous restons à votre disposition pour toute question.\n\nÉquipe Nivra Télécom`,
  },
  recap: {
    subject: "Récapitulatif de notre appel — Nivra Télécom",
    body: (n) => `Bonjour ${n},\n\nSuite à notre appel, voici un bref récapitulatif :\n\n• Forfait discuté : [À COMPLÉTER]\n• Adresse de service : [À COMPLÉTER]\n• Prochaines étapes : [À COMPLÉTER]\n\nNous reviendrons vers vous comme convenu.\n\nÉquipe Nivra Télécom`,
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { contact_id, template, custom_message } = await req.json();
    if (!contact_id || !template || !(template in TEMPLATES)) {
      return new Response(JSON.stringify({ ok: false, error: "invalid_input" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: c, error } = await admin
      .from("crm_contacts")
      .select("id, first_name, full_name, email")
      .eq("id", contact_id)
      .maybeSingle();
    if (error || !c?.email) {
      return new Response(JSON.stringify({ ok: false, error: "contact_or_email_missing" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const tpl = TEMPLATES[template as TemplateKey];
    const name = c.first_name ?? c.full_name ?? "";
    const message = custom_message?.trim() || tpl.body(name);

    await admin.functions.invoke("send-communication-email", {
      body: {
        subject: tpl.subject,
        message,
        recipients: [{ email: c.email, name: c.full_name ?? c.email, client_id: c.id }],
      },
    });

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
