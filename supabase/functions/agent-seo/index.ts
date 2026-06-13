/**
 * agent-seo — Daily 6h UTC. Weekly email report sent Mondays.
 */
import {
  corsHeaders, makeClient, logEvent, logAudit, updateRegistry,
  queueEmail, callGeminiJSON, jsonResponse, ADMIN_EMAIL,
} from "../_shared/agentHelpers.ts";

const AGENT = "seo-monitor";

const KEY_URLS = [
  "https://nivra-telecom.ca/",
  "https://nivra-telecom.ca/forfaits",
  "https://nivra-telecom.ca/internet-sans-contrat-montreal",
  "https://nivra-telecom.ca/alternative-bell-videotron-quebec",
  "https://nivra-telecom.ca/internet-montreal-nord",
  "https://nivra-telecom.ca/internet-prepaye-quebec",
];

async function measureLoad(url: string): Promise<{ ms: number; ok: boolean }> {
  const start = Date.now();
  try {
    const res = await fetch(url, { method: "GET", redirect: "follow" });
    const ms = Date.now() - start;
    // drain body
    await res.text();
    return { ms, ok: res.ok };
  } catch (_e) {
    return { ms: Date.now() - start, ok: false };
  }
}

async function checkIndexed(url: string): Promise<boolean> {
  try {
    const q = encodeURIComponent(`site:${url}`);
    const res = await fetch(`https://www.google.com/search?q=${q}`, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; NivraSEOAgent/1.0)" },
    });
    const html = await res.text();
    // crude heuristic — Google returns "no results" when not indexed
    return !/did not match any documents|n'a pas trouv/.test(html);
  } catch (_e) {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const t0 = Date.now();
  const supabase = makeClient();
  try {
    await logEvent(supabase, AGENT, "info", "Démarrage SEO Monitor quotidien");

    // STEP 1 — indexing
    const indexedResults: Array<{ url: string; indexed: boolean }> = [];
    for (const u of KEY_URLS) {
      const indexed = await checkIndexed(u);
      indexedResults.push({ url: u, indexed });
    }
    const indexedCount = indexedResults.filter((r) => r.indexed).length;

    // STEP 2 — sitemap
    let sitemapUrls = 0;
    try {
      const sm = await fetch("https://nivra-telecom.ca/sitemap.xml");
      const txt = await sm.text();
      sitemapUrls = (txt.match(/<loc>/g) ?? []).length;
    } catch (_e) { /* noop */ }

    // STEP 3 — page speed
    const loads: Array<{ url: string; ms: number; ok: boolean }> = [];
    for (const u of KEY_URLS) {
      const r = await measureLoad(u);
      loads.push({ url: u, ...r });
    }
    const avgMs = Math.round(loads.reduce((s, x) => s + x.ms, 0) / loads.length);
    const slow = loads.filter((x) => x.ms > 3000);

    // STEP 4 — Gemini analysis
    let analysis: { score?: number; recommendations?: string[]; top_recommendation?: string } = {};
    try {
      analysis = await callGeminiJSON(`Tu es l'analyste SEO de Nivra Telecom (Québec).
Données:
- Pages indexées: ${indexedCount}/${KEY_URLS.length}
- URLs dans le sitemap: ${sitemapUrls}
- Vitesse moyenne: ${avgMs}ms
- Pages lentes (>3s): ${slow.length}
- Détails: ${JSON.stringify({ indexedResults, loads }).slice(0, 1500)}

Réponds STRICTEMENT en JSON: { "score": 0, "top_recommendation": "...", "recommendations": ["..."] }`);
    } catch (e) {
      await logEvent(supabase, AGENT, "warning", "Analyse Gemini SEO indisponible", { error: String(e) });
    }

    const seoScore = analysis.score ?? Math.max(0, Math.min(100, Math.round(
      (indexedCount / KEY_URLS.length) * 60 + (avgMs < 2000 ? 40 : avgMs < 3000 ? 25 : 10),
    )));

    await logEvent(supabase, AGENT, "info", `Score SEO du jour: ${seoScore}/100`, {
      indexed: indexedCount, total: KEY_URLS.length, avg_ms: avgMs, slow_pages: slow.length,
    });

    // STEP 5 — weekly report (Mondays UTC)
    const isMonday = new Date().getUTCDay() === 1;
    if (isMonday) {
      await queueEmail(supabase, {
        toEmail: ADMIN_EMAIL,
        templateKey: "seo_weekly_report",
        subject: `Rapport SEO hebdomadaire — Score ${seoScore}/100`,
        templateVars: {
          indexed_count: indexedCount,
          avg_load_ms: avgMs,
          seo_score: seoScore,
          top_recommendation: analysis.top_recommendation || (analysis.recommendations?.[0] ?? "Continuer la production de contenu local."),
        },
        eventKey: `seo-weekly-${new Date().toISOString().slice(0, 10)}`,
      });
      await logEvent(supabase, AGENT, "email_sent", "Rapport SEO hebdomadaire envoyé");
    }

    await logAudit(supabase, AGENT, "seo_daily_check", "success",
      { indexed_count: indexedCount, sitemap_urls: sitemapUrls, avg_ms: avgMs, slow_pages: slow.length, seo_score: seoScore },
      Date.now() - t0);
    await updateRegistry(supabase, AGENT, true);
    return jsonResponse({ ok: true, seo_score: seoScore });
  } catch (e) {
    const msg = String(e);
    await logEvent(supabase, AGENT, "error", "Échec SEO Monitor", { error: msg });
    await logAudit(supabase, AGENT, "seo_daily_check", "failure", null, Date.now() - t0, msg);
    await updateRegistry(supabase, AGENT, false, msg);
    return jsonResponse({ ok: false, error: msg }, 500);
  }
});
