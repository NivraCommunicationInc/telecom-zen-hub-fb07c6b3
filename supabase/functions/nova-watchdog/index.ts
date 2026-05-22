// Redeployed: 2026-05-22-NOVA-FIX
// NOVA Watchdog — proactive monitoring, runs every 30 minutes via cron.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Alert {
  severity: "critical" | "warning" | "info";
  title: string;
  message: string;
  category: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const admin = createClient(supabaseUrl, serviceKey);
    const alerts: Alert[] = [];

    // 1. DLQ emails
    const { count: dlq } = await admin.from("email_queue").select("*", { count: "exact", head: true }).eq("status", "dlq");
    if ((dlq ?? 0) > 3) {
      alerts.push({ severity: "critical", category: "email",
        title: "Emails en DLQ > 3", message: `${dlq} emails en dead-letter queue. Système email à vérifier.` });
    }

    // 2. SLA breached complaints
    const { count: slaBreach } = await admin.from("complaints").select("*", { count: "exact", head: true })
      .lt("sla_deadline", new Date().toISOString()).not("status", "in", "(resolved,closed)");
    if ((slaBreach ?? 0) > 3) {
      alerts.push({ severity: "critical", category: "support",
        title: "SLA dépassé sur plusieurs plaintes", message: `${slaBreach} plaintes ont dépassé leur SLA. Escalade requise.` });
    }

    // 3. Urgent new complaints
    const { count: urgent } = await admin.from("complaints").select("*", { count: "exact", head: true })
      .eq("priority", "urgent").not("status", "in", "(resolved,closed)");
    if ((urgent ?? 0) > 0) {
      alerts.push({ severity: "warning", category: "support",
        title: "Plaintes urgentes ouvertes", message: `${urgent} plaintes urgentes en attente de traitement.` });
    }

    // 4. No sales in 24h (using sales_commissions as proxy)
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { count: salesCount } = await admin.from("sales_commissions").select("*", { count: "exact", head: true })
      .gte("created_at", since);
    if ((salesCount ?? 0) === 0) {
      alerts.push({ severity: "warning", category: "sales",
        title: "Aucune vente en 24h", message: "Aucune commission enregistrée depuis 24h. Analyser causes." });
    }

    // 5. Pending orders backlog
    const { count: pending } = await admin.from("orders").select("*", { count: "exact", head: true }).eq("status", "pending");
    if ((pending ?? 0) > 20) {
      alerts.push({ severity: "warning", category: "operations",
        title: "Backlog commandes en attente", message: `${pending} commandes pending — traiter rapidement.` });
    }

    // Persist each alert as a nova_action (alert type)
    let inserted = 0;
    for (const a of alerts) {
      // Dedupe by title in last 6h
      const sixHoursAgo = new Date(Date.now() - 6 * 3600 * 1000).toISOString();
      const { data: existing } = await admin.from("nova_actions").select("id")
        .eq("action_type", "send_alert")
        .gte("created_at", sixHoursAgo)
        .filter("action_payload->>title", "eq", a.title)
        .maybeSingle();
      if (existing) continue;

      await admin.from("nova_actions").insert({
        action_type: "send_alert",
        action_payload: { title: a.title, message: a.message, severity: a.severity, category: a.category },
        status: a.severity === "critical" ? "pending" : "completed",
        requires_approval: a.severity === "critical",
        result: { source: "nova-watchdog", auto_generated: true },
      });

      // Critical → also enqueue email to Oldo
      if (a.severity === "critical") {
        await admin.from("email_queue").insert({
          to_email: "nivratelecom@gmail.com",
          template_key: "nova_alert_critical",
          template_vars: { title: a.title, message: a.message, category: a.category },
          status: "queued",
          language: "fr",
        });
      }
      inserted++;
    }

    return new Response(JSON.stringify({ ok: true, checked: alerts.length, inserted }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
