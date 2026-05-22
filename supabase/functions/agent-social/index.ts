/**
 * agent-social — Monday/Wednesday/Friday 12h UTC.
 * Generates a Facebook+Instagram post for admin approval.
 */
import {
  corsHeaders, makeClient, logEvent, logAudit, updateRegistry,
  queueEmail, callGeminiJSON, jsonResponse, ADMIN_EMAIL,
} from "../_shared/agentHelpers.ts";

const AGENT = "social-media";

const POST_TYPES = ["promotion", "testimonial_style", "educational", "comparison_bell"] as const;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const t0 = Date.now();
  const supabase = makeClient();
  try {
    await logEvent(supabase, AGENT, "info", "Démarrage Social Media Publisher");

    // STEP 1 — real offers
    const { data: offers } = await supabase
      .from("site_offers")
      .select("name_fr, price_monthly, features_json, offer_type")
      .eq("is_active", true);

    const dayIdx = new Date().getUTCDay(); // 1=Mon 3=Wed 5=Fri
    const postType = POST_TYPES[(dayIdx % POST_TYPES.length)];

    // STEP 2 — Gemini
    const ai = await callGeminiJSON(`Tu es le gestionnaire de réseaux sociaux de Nivra Telecom au Québec.

Génère un post Facebook/Instagram PROFESSIONNEL et ACCROCHEUR pour promouvoir nos services.

DONNÉES RÉELLES NIVRA (utilise UNIQUEMENT ces prix):
- Internet GIGA 940 Mbps: 60$/mois
- Bundle GIGA + TV 25 choix: 100$/mois
- Sans contrat, sans crédit
- Alternative Bell/Vidéotron

Règles:
1. Utilise UNIQUEMENT ces prix réels
2. Français québécois naturel
3. Émojis appropriés
4. Hashtags pertinents (#InternetQuébec #SansContrat #NivraTelecom #MontréalInternet #AlternativeBell)
5. Call-to-action fort
6. Maximum 300 mots
7. Ton: dynamique, québécois, honnête

Type de post aujourd'hui: ${postType}

Réponds STRICTEMENT en JSON: { "post_text": "...", "hashtags": ["#..."], "post_type": "${postType}" }`);

    const postText = String(ai.post_text || "").trim();
    const hashtags: string[] = Array.isArray(ai.hashtags) ? ai.hashtags : [];
    if (!postText) throw new Error("Gemini returned empty post_text");

    // STEP 3 — persist
    const { data: inserted, error: insErr } = await supabase
      .from("social_media_posts")
      .insert({
        platform: "both",
        post_text: postText,
        hashtags,
        post_type: postType,
        status: "pending",
        generated_by: "nova",
      })
      .select("id")
      .maybeSingle();
    if (insErr) throw insErr;

    // STEP 4 — notify admin
    await queueEmail(supabase, {
      toEmail: ADMIN_EMAIL,
      templateKey: "social_post_ready",
      subject: `Nouveau post réseaux sociaux à approuver (${postType})`,
      templateVars: {
        post_id: inserted?.id,
        post_text: postText,
        hashtags,
        post_type: postType,
      },
      eventKey: `social-${inserted?.id ?? Date.now()}`,
    });

    await logEvent(supabase, AGENT, "action",
      `Post ${postType} généré et en attente d'approbation`,
      { post_id: inserted?.id, offers_loaded: offers?.length ?? 0 });
    await logAudit(supabase, AGENT, "generate_post", "success",
      { post_id: inserted?.id, post_type: postType, hashtags_count: hashtags.length },
      Date.now() - t0);
    await updateRegistry(supabase, AGENT, true);
    return jsonResponse({ ok: true, post_id: inserted?.id, post_type: postType });
  } catch (e) {
    const msg = String(e);
    await logEvent(supabase, AGENT, "error", "Échec Social Media Publisher", { error: msg });
    await logAudit(supabase, AGENT, "generate_post", "failure", null, Date.now() - t0, msg);
    await updateRegistry(supabase, AGENT, false, msg);
    return jsonResponse({ ok: false, error: msg }, 500);
  }
});
