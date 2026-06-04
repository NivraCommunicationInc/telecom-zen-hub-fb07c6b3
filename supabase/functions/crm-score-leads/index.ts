import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireServiceAuth, makeClient, logEvent } from "../_shared/agentHelpers.ts";

const AGENT = "crm-score-leads";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: { "Access-Control-Allow-Origin": "*" } });
  const unauth = requireServiceAuth(req);
  if (unauth) return unauth;

  const supabase = makeClient();

  const { data: contacts } = await supabase
    .from("contact_requests")
    .select("id, email, status, created_at, source, notes, last_contact_at")
    .not("status", "in", '("sold","disqualified","unsubscribed")')
    .limit(500);

  let scored = 0;
  for (const c of (contacts ?? []) as any[]) {
    let score = 0;
    const ageDays = Math.floor((Date.now() - new Date(c.created_at).getTime()) / 86400_000);

    // Source quality
    if (c.source === "referral") score += 30;
    else if (c.source === "website") score += 20;
    else if (c.source === "cold_call") score += 5;

    // Engagement
    if (c.status === "interested") score += 25;
    else if (c.status === "callback_scheduled") score += 35;
    else if (c.status === "called") score += 10;

    // Recency (recent = higher score)
    if (ageDays <= 7) score += 20;
    else if (ageDays <= 30) score += 10;
    else if (ageDays > 90) score -= 10;

    // Last contact recency
    if (c.last_contact_at) {
      const daysSinceContact = Math.floor((Date.now() - new Date(c.last_contact_at).getTime()) / 86400_000);
      if (daysSinceContact <= 3) score += 15;
    }

    const finalScore = Math.max(0, Math.min(100, score));

    await supabase.from("crm_contacts").update({
      lead_score: finalScore,
      lead_category: finalScore >= 70 ? "hot" : finalScore >= 40 ? "warm" : "cold",
      scored_at: new Date().toISOString(),
    }).eq("id", c.id);
    scored++;
  }

  await logEvent(supabase, AGENT, "info", `Lead scoring completed: ${scored} contacts scored`);
  return new Response(JSON.stringify({ ok: true, scored }), { headers: { "Content-Type": "application/json" } });
});
