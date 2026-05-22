/**
 * agent-google-ads — Every 6 hours.
 * Monitors Google Ads campaigns (account AW-18179904370).
 *
 * NOTE: Real Google Ads API calls require GOOGLE_ADS_DEVELOPER_TOKEN,
 * GOOGLE_ADS_OAUTH_REFRESH_TOKEN, GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET.
 * If those secrets are absent the agent runs in "monitor-only" mode:
 * logs that credentials are missing and exits gracefully. Once secrets
 * are added the live API integration kicks in automatically.
 */
import {
  corsHeaders, makeClient, logEvent, logAudit, updateRegistry,
  queueEmail, callGeminiJSON, jsonResponse, ADMIN_EMAIL,
} from "../_shared/agentHelpers.ts";

const AGENT = "google-ads-monitor";
const CUSTOMER_ID = "18179904370";

async function getAccessToken(): Promise<string | null> {
  const clientId = Deno.env.get("GOOGLE_ADS_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_ADS_CLIENT_SECRET");
  const refreshToken = Deno.env.get("GOOGLE_ADS_OAUTH_REFRESH_TOKEN");
  if (!clientId || !clientSecret || !refreshToken) return null;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) return null;
  const j = await res.json();
  return j.access_token ?? null;
}

async function gaqlSearch(token: string, query: string): Promise<any[]> {
  const devToken = Deno.env.get("GOOGLE_ADS_DEVELOPER_TOKEN")!;
  const res = await fetch(
    `https://googleads.googleapis.com/v17/customers/${CUSTOMER_ID}/googleAds:search`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "developer-token": devToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    },
  );
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Google Ads ${res.status}: ${t.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.results ?? [];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const t0 = Date.now();
  const supabase = makeClient();
  try {
    await logEvent(supabase, AGENT, "info", "Démarrage Google Ads Monitor");

    const token = await getAccessToken();
    if (!token) {
      await logEvent(supabase, AGENT, "warning",
        "Identifiants Google Ads manquants — exécution en mode passif",
        { missing: ["GOOGLE_ADS_DEVELOPER_TOKEN", "GOOGLE_ADS_CLIENT_ID", "GOOGLE_ADS_CLIENT_SECRET", "GOOGLE_ADS_OAUTH_REFRESH_TOKEN"] });
      await logAudit(supabase, AGENT, "monitor", "skipped",
        { reason: "missing_oauth_credentials", customer_id: CUSTOMER_ID }, Date.now() - t0);
      await updateRegistry(supabase, AGENT, true);
      return jsonResponse({ ok: true, skipped: "missing_oauth_credentials" });
    }

    const campaigns = await gaqlSearch(token, `
      SELECT campaign.name, campaign.status, campaign.serving_status,
        metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions
      FROM campaign
      WHERE segments.date DURING TODAY
    `);

    const rejected = await gaqlSearch(token, `
      SELECT ad_group_ad.ad.id, ad_group_ad.status,
        ad_group_ad.policy_summary.approval_status
      FROM ad_group_ad
      WHERE ad_group_ad.policy_summary.approval_status != 'APPROVED'
    `);

    const issuesFound = rejected.length > 0 || campaigns.some((c: any) =>
      c.campaign?.status !== "ENABLED" || (c.campaign?.servingStatus && c.campaign.servingStatus !== "SERVING"));

    let analysis: any = {};
    try {
      analysis = await callGeminiJSON(`Tu es l'analyste Google Ads de Nivra Telecom. Analyse ces métriques:
${JSON.stringify({ campaigns, rejected }).slice(0, 4000)}

Identifie:
1. Campagnes sous-performantes
2. Annonces rejetées
3. Budget restant aujourd'hui
4. Recommandations immédiates
5. Score performance 0-100

Réponds STRICTEMENT en JSON: { "score": 0, "recommendations": ["..."], "issues": [{"campaign":"...","status":"...","issue":"...","recommendation":"..."}] }`);
    } catch (e) {
      await logEvent(supabase, AGENT, "warning", "Analyse Gemini indisponible", { error: String(e) });
    }

    if (issuesFound && Array.isArray(analysis.issues)) {
      for (const iss of analysis.issues.slice(0, 5)) {
        await queueEmail(supabase, {
          toEmail: ADMIN_EMAIL,
          templateKey: "google_ads_alert",
          subject: `⚠ Alerte Google Ads — ${iss.campaign ?? "Campagne"}`,
          templateVars: {
            campaign_name: iss.campaign ?? "Campagne",
            status: iss.status ?? "—",
            issue_description: iss.issue ?? "Problème détecté",
            recommendation: iss.recommendation ?? "Vérifier dans Google Ads",
          },
          eventKey: `google-ads-alert-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        });
      }
      await logEvent(supabase, AGENT, "warning",
        `Google Ads — ${analysis.issues.length} problème(s) détecté(s)`,
        { score: analysis.score, count: analysis.issues.length });
    } else {
      await logEvent(supabase, AGENT, "success",
        "Google Ads — Toutes les campagnes en bonne santé",
        { campaigns: campaigns.length, score: analysis.score ?? null });
    }

    await logAudit(supabase, AGENT, "monitor", "success",
      { campaigns: campaigns.length, rejected_ads: rejected.length, score: analysis.score ?? null },
      Date.now() - t0);
    await updateRegistry(supabase, AGENT, true);
    return jsonResponse({ ok: true, campaigns: campaigns.length, rejected: rejected.length });
  } catch (e) {
    const msg = String(e);
    await logEvent(supabase, AGENT, "error", "Échec Google Ads Monitor", { error: msg });
    await logAudit(supabase, AGENT, "monitor", "failure", null, Date.now() - t0, msg);
    await updateRegistry(supabase, AGENT, false, msg);
    return jsonResponse({ ok: false, error: msg }, 500);
  }
});
