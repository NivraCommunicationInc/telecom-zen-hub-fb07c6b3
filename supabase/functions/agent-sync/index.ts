/**
 * agent-sync — Agent 10: Synchronisation.
 * Verifies that orders, complaints, CRM sales and profiles are properly
 * synced with complete information. Auto-fixes when possible. Uses
 * Gemini 2.5 Pro to flag systemic issues. Sends an alert to ops if
 * critical sync issues are detected.
 *
 * Body: { test?: boolean }  (cron sends {} every 30 minutes)
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const ALERT_EMAIL = "nivratelecom@gmail.com";

type Issue = { code: string; severity: "info" | "warning" | "critical"; detail: string };

async function logSync(
  supabase: ReturnType<typeof createClient>,
  row: {
    sync_type: string;
    source_portal: string | null;
    record_id: string;
    record_reference?: string | null;
    issues: Issue[];
    auto_fixed?: boolean;
    fix_description?: string | null;
    requires_manual_review?: boolean;
  },
) {
  const status = row.auto_fixed
    ? "fixed"
    : row.issues.some((i) => i.severity === "critical")
    ? "error"
    : row.issues.some((i) => i.severity === "warning")
    ? "warning"
    : row.issues.length > 0
    ? "missing_data"
    : "ok";
  await supabase.from("sync_audit_log").insert({
    sync_type: row.sync_type,
    source_portal: row.source_portal,
    record_id: row.record_id,
    record_reference: row.record_reference ?? null,
    sync_status: status,
    issues_found: row.issues,
    auto_fixed: !!row.auto_fixed,
    fix_description: row.fix_description ?? null,
    requires_manual_review: !!row.requires_manual_review,
  });
}

function splitName(full: string): { first: string; last: string } {
  const parts = String(full ?? "").trim().split(/\s+/);
  return { first: parts[0] ?? "", last: parts.slice(1).join(" ") };
}

async function checkFieldOrders(supabase: ReturnType<typeof createClient>) {
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const { data: orders } = await supabase
    .from("field_sales_orders")
    .select("id, order_number, customer_name, customer_email, customer_phone, customer_address, customer_city, customer_postal_code")
    .gte("created_at", since)
    .limit(500);

  let processed = 0, fixed = 0, manual = 0;
  for (const o of (orders ?? []) as Array<Record<string, any>>) {
    if (!o.customer_email) continue;
    processed++;
    const email = String(o.customer_email).toLowerCase();
    const { data: profile } = await supabase
      .from("profiles")
      .select("user_id, full_name, first_name, last_name, service_address, service_city, service_postal_code, phone")
      .ilike("email", email)
      .maybeSingle();

    const issues: Issue[] = [];
    let autoFix = false;
    let fixDesc: string | null = null;

    if (!profile) {
      issues.push({ code: "no_profile", severity: "warning", detail: "Aucun profil trouvé pour cet email." });
    } else {
      const p = profile as Record<string, any>;
      if (!p.full_name || p.full_name === "Client") issues.push({ code: "profile_full_name_placeholder", severity: "critical", detail: "full_name est vide ou 'Client'." });
      if (!p.first_name) issues.push({ code: "profile_first_name_missing", severity: "warning", detail: "first_name manquant." });
      if (!p.service_address && o.customer_address) issues.push({ code: "service_address_missing", severity: "warning", detail: "service_address manquant côté profil." });
      if (!p.service_city && o.customer_city) issues.push({ code: "service_city_missing", severity: "warning", detail: "service_city manquant côté profil." });

      // Auto-fix: hydrate missing profile fields from order data.
      const patch: Record<string, any> = {};
      if (!p.first_name && o.customer_name) {
        const { first, last } = splitName(String(o.customer_name));
        if (first) patch.first_name = first;
        if (last && !p.last_name) patch.last_name = last;
      }
      if (!p.service_address && o.customer_address) patch.service_address = o.customer_address;
      if (!p.service_city && o.customer_city) patch.service_city = o.customer_city;
      if (!p.service_postal_code && o.customer_postal_code) patch.service_postal_code = o.customer_postal_code;
      if (!p.phone && o.customer_phone) patch.phone = o.customer_phone;
      if (Object.keys(patch).length > 0) {
        const { error } = await supabase.from("profiles").update(patch).eq("user_id", p.user_id);
        if (!error) {
          autoFix = true;
          fixed++;
          fixDesc = `Profil hydraté depuis la commande: ${Object.keys(patch).join(", ")}.`;
        }
      }
    }

    if (issues.length === 0 && !autoFix) continue;
    const needsManual = issues.some((i) => i.severity === "critical") && !autoFix;
    if (needsManual) manual++;
    await logSync(supabase, {
      sync_type: "order",
      source_portal: "field",
      record_id: String(o.id),
      record_reference: o.order_number ?? null,
      issues,
      auto_fixed: autoFix,
      fix_description: fixDesc,
      requires_manual_review: needsManual,
    });
  }
  return { processed, fixed, manual };
}

async function checkComplaints(supabase: ReturnType<typeof createClient>) {
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const { data: complaints } = await supabase
    .from("complaints")
    .select("id, ticket_number, submitted_by_email, account_id, sla_deadline, status, created_at")
    .gte("created_at", since)
    .limit(500);

  let fixed = 0, flagged = 0;
  for (const c of (complaints ?? []) as Array<Record<string, any>>) {
    const issues: Issue[] = [];
    let autoFix = false;
    let fixDesc: string | null = null;

    if (!c.ticket_number) issues.push({ code: "ticket_number_missing", severity: "warning", detail: "ticket_number absent." });
    if (!c.sla_deadline) issues.push({ code: "sla_deadline_missing", severity: "warning", detail: "sla_deadline non défini." });

    if (!c.account_id && c.submitted_by_email) {
      const email = String(c.submitted_by_email).toLowerCase();
      const { data: profile } = await supabase
        .from("profiles").select("user_id").ilike("email", email).maybeSingle();
      const uid = (profile as { user_id?: string } | null)?.user_id;
      if (uid) {
        const { data: account } = await supabase
          .from("accounts").select("id").eq("client_id", uid).maybeSingle();
        const aid = (account as { id?: string } | null)?.id;
        if (aid) {
          const { error } = await supabase.from("complaints").update({ account_id: aid }).eq("id", c.id);
          if (!error) {
            autoFix = true;
            fixed++;
            fixDesc = `account_id lié à ${aid} via email match.`;
          }
        } else {
          issues.push({ code: "account_unlinked", severity: "warning", detail: "Email trouvé mais pas de compte." });
        }
      } else {
        issues.push({ code: "no_matching_profile", severity: "info", detail: "Aucun profil pour cet email." });
      }
    }

    if (issues.length === 0 && !autoFix) continue;
    flagged++;
    await logSync(supabase, {
      sync_type: "complaint",
      source_portal: "public",
      record_id: String(c.id),
      record_reference: c.ticket_number ?? null,
      issues,
      auto_fixed: autoFix,
      fix_description: fixDesc,
    });
  }
  return { fixed, flagged };
}

async function checkCrmSales(supabase: ReturnType<typeof createClient>) {
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const { data: contacts } = await supabase
    .from("crm_contacts")
    .select("id, first_name, last_name, call_status, converted_to_user_id, updated_at")
    .eq("call_status", "sold")
    .is("converted_to_user_id", null)
    .gte("updated_at", since)
    .limit(200);

  let flagged = 0;
  for (const cc of (contacts ?? []) as Array<Record<string, any>>) {
    flagged++;
    await logSync(supabase, {
      sync_type: "crm_sale",
      source_portal: "crm",
      record_id: String(cc.id),
      record_reference: `${cc.first_name ?? ""} ${cc.last_name ?? ""}`.trim() || null,
      issues: [{ code: "crm_sale_not_converted", severity: "warning", detail: "Contact marqué sold mais aucun compte utilisateur lié." }],
      requires_manual_review: true,
    });
  }
  return { flagged };
}

async function checkProfiles(supabase: ReturnType<typeof createClient>) {
  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, full_name, email, phone, service_address, first_name")
    .or("full_name.is.null,full_name.eq.Client,first_name.is.null,phone.is.null")
    .eq("account_status", "active")
    .limit(500);

  let flagged = 0, fixed = 0;
  for (const p of (profiles ?? []) as Array<Record<string, any>>) {
    if (!p.email) continue;
    const issues: Issue[] = [];
    if (!p.full_name || p.full_name === "Client") issues.push({ code: "full_name_placeholder", severity: "critical", detail: "full_name vide ou 'Client'." });
    if (!p.first_name) issues.push({ code: "first_name_missing", severity: "warning", detail: "first_name manquant." });
    if (!p.phone) issues.push({ code: "phone_missing", severity: "warning", detail: "phone manquant." });
    if (!p.service_address) issues.push({ code: "service_address_missing", severity: "warning", detail: "service_address manquant." });

    let autoFix = false;
    let fixDesc: string | null = null;

    const { data: order } = await supabase
      .from("field_sales_orders")
      .select("customer_name, customer_phone, customer_address, customer_city, customer_postal_code")
      .ilike("customer_email", String(p.email).toLowerCase())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (order) {
      const o = order as Record<string, any>;
      const patch: Record<string, any> = {};
      if ((!p.first_name) && o.customer_name) {
        const { first, last } = splitName(String(o.customer_name));
        if (first) patch.first_name = first;
        if (last) patch.last_name = last;
        patch.full_name = o.customer_name;
      }
      if (!p.phone && o.customer_phone) patch.phone = o.customer_phone;
      if (!p.service_address && o.customer_address) patch.service_address = o.customer_address;
      if (Object.keys(patch).length > 0) {
        const { error } = await supabase.from("profiles").update(patch).eq("user_id", p.user_id);
        if (!error) { autoFix = true; fixed++; fixDesc = `Profil hydraté depuis field_sales_orders: ${Object.keys(patch).join(", ")}.`; }
      }
    }

    flagged++;
    await logSync(supabase, {
      sync_type: "profile",
      source_portal: "client",
      record_id: String(p.user_id),
      record_reference: p.email,
      issues,
      auto_fixed: autoFix,
      fix_description: fixDesc,
      requires_manual_review: !autoFix && issues.some((i) => i.severity === "critical"),
    });
  }
  return { flagged, fixed };
}

async function geminiAnalyze(summary: Record<string, unknown>) {
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [{
          role: "user",
          content: `Analyse ces résultats de synchronisation pour Nivra Telecom:\n${JSON.stringify(summary, null, 2)}\n\nIdentifie en JSON strict: { "systemic_issues": ["..."], "worst_portals": ["..."], "missing_fields": ["..."], "recommendations": ["..."], "priority_actions": ["..."] }`,
        }],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return JSON.parse(data.choices?.[0]?.message?.content ?? "{}");
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const startedAt = Date.now();
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    const orders = await checkFieldOrders(supabase);
    const complaints = await checkComplaints(supabase);
    const crm = await checkCrmSales(supabase);
    const profiles = await checkProfiles(supabase);

    const totalIssues = orders.manual + complaints.flagged + crm.flagged + profiles.flagged;
    const totalFixes = orders.fixed + complaints.fixed + profiles.fixed;

    const summary = {
      orders_checked: orders.processed,
      orders_auto_fixed: orders.fixed,
      orders_manual: orders.manual,
      complaints_flagged: complaints.flagged,
      complaints_fixed: complaints.fixed,
      crm_unconverted_sales: crm.flagged,
      profiles_flagged: profiles.flagged,
      profiles_fixed: profiles.fixed,
    };

    const ai = await geminiAnalyze(summary);

    // Alert if critical issues remain after fixes.
    const critical = orders.manual + crm.flagged;
    if (critical >= 3) {
      await supabase.from("email_queue").insert({
        to_email: ALERT_EMAIL,
        template_key: "sync_alert",
        subject: "Alerte synchronisation — Nivra",
        template_vars: {
          client_name: "Équipe Nivra",
          affected_orders: orders.manual,
          incomplete_profiles: profiles.flagged,
          unlinked_complaints: complaints.flagged,
          auto_fixes: totalFixes,
          recommendations: ai?.recommendations ?? [],
        },
        status: "queued",
      });
    }

    await supabase.from("agent_audit_log").insert({
      agent_name: "agent-sync",
      action: "sync_check",
      result: "success",
      execution_time_ms: Date.now() - startedAt,
      details: { summary, ai, total_issues: totalIssues, total_fixes: totalFixes },
    });

    return new Response(
      JSON.stringify({ ok: true, summary, ai }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    await supabase.from("agent_audit_log").insert({
      agent_name: "agent-sync",
      action: "sync_check",
      result: "failure",
      error_message: String(e),
      execution_time_ms: Date.now() - startedAt,
    });
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
