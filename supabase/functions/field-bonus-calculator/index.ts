/**
 * field-bonus-calculator
 * Runs on the LAST THURSDAY of each month (cron fires every Thursday; the
 * function self-guards). For every field_sales agent, counts activated
 * orders in the current calendar month, matches against field_bonus_rules,
 * and inserts an approved `monthly_bonus` row in field_commissions.
 *
 * Idempotent per (agent, month) via field_commissions.notes marker
 * containing a `[bonus:YYYY-MM]` tag — no schema changes needed.
 *
 * Notifies the agent via employee_notifications and email_queue
 * (`hr_commission_generated` template — Violet Bold shell).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function isLastThursdayOfMonth(d: Date): boolean {
  if (d.getDay() !== 4) return false; // Thursday = 4
  const probe = new Date(d.getTime());
  probe.setDate(probe.getDate() + 7);
  return probe.getMonth() !== d.getMonth();
}

function monthBounds(d: Date): { start: string; endExclusive: string; tag: string } {
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  const endExclusive = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
  const tag = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  return { start: start.toISOString(), endExclusive: endExclusive.toISOString(), tag };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const force = new URL(req.url).searchParams.get("force") === "true";
  const now = new Date();

  if (!force && !isLastThursdayOfMonth(now)) {
    return new Response(
      JSON.stringify({ skipped: true, reason: "Not last Thursday of month" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { start, endExclusive, tag } = monthBounds(now);
  const marker = `[bonus:${tag}]`;

  // Bonus tiers (ordered: highest first)
  const { data: tiers, error: tiersErr } = await supabase
    .from("field_bonus_rules")
    .select("min_sales, max_sales, bonus_amount")
    .eq("is_active", true)
    .eq("period", "monthly")
    .order("min_sales", { ascending: false });

  if (tiersErr) {
    return new Response(JSON.stringify({ error: tiersErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const matchTier = (count: number) => {
    for (const t of tiers || []) {
      if (count >= t.min_sales && (t.max_sales == null || count <= t.max_sales)) {
        return Number(t.bonus_amount);
      }
    }
    return 0;
  };

  // All active field_sales agents
  const { data: agents } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("role", "field_sales")
    .eq("is_active", true);

  const results: any[] = [];

  for (const a of agents || []) {
    const agentId = (a as any).user_id;
    if (!agentId) continue;

    // Idempotency: skip if a monthly_bonus already exists for this month
    const { count: already } = await supabase
      .from("field_commissions")
      .select("id", { count: "exact", head: true })
      .eq("agent_id", agentId)
      .eq("commission_type", "monthly_bonus")
      .ilike("description", `%${marker}%`);

    if ((already || 0) > 0) {
      results.push({ agent_id: agentId, skipped: true, reason: "already paid" });
      continue;
    }

    // Count activated orders this month for this agent
    const { count: salesCount } = await supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("created_by_agent_id", agentId)
      .eq("status", "activated")
      .gte("updated_at", start)
      .lt("updated_at", endExclusive);

    const count = salesCount || 0;
    const bonus = matchTier(count);

    if (bonus <= 0) {
      results.push({ agent_id: agentId, sales: count, bonus: 0 });
      continue;
    }

    const description = `Bonus mensuel performance — ${count} ventes ${marker}`;

    const { error: insErr } = await supabase.from("field_commissions").insert({
      agent_id: agentId,
      amount: bonus,
      status: "approved",
      commission_type: "monthly_bonus",
      description,
      earned_at: new Date().toISOString(),
      approved_at: new Date().toISOString(),
    });

    if (insErr) {
      results.push({ agent_id: agentId, error: insErr.message });
      continue;
    }

    // In-app notification
    await supabase.from("employee_notifications").insert({
      user_id: agentId,
      notification_type: "system",
      title: `Bonus mensuel — ${bonus} $`,
      message: `Félicitations ! Votre bonus de ${bonus} $ pour ${count} ventes activées en ${tag} a été ajouté à votre paie.`,
      is_read: false,
    });

    // Get email
    const { data: profile } = await supabase
      .from("profiles")
      .select("email, full_name, first_name, last_name")
      .eq("user_id", agentId)
      .maybeSingle();

    const email = (profile as any)?.email;
    if (email) {
      const clientName =
        (profile as any)?.full_name ||
        [(profile as any)?.first_name, (profile as any)?.last_name].filter(Boolean).join(" ") ||
        "Collègue";

      await supabase.from("email_queue").insert({
        event_key: `field_bonus_${agentId}_${tag}`,
        to_email: email,
        template_key: "hr_commission_generated",
        template_vars: {
          client_name: clientName,
          amount: bonus,
          period_label: tag,
          portal_url: "https://nivra-telecom.ca/rh/commissions",
          context: `Bonus mensuel — ${count} ventes activées`,
        },
        message_type: "hr_commission_generated",
        entity_type: "field_bonus",
        entity_id: agentId,
        status: "queued",
      });
    }

    results.push({ agent_id: agentId, sales: count, bonus });
  }

  return new Response(
    JSON.stringify({ ok: true, month: tag, count: results.length, results }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
