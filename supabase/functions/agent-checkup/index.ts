/**
 * agent-checkup
 * --------------
 * Daily agent (07:00 UTC). Finds active clients whose last service check-up
 * was 80, 85 or 90 days ago (or who never had one) and emails the operations
 * inbox (nivratelecom@gmail.com) with a list + a CSV attachment so an agent
 * can call each client for a service verification.
 *
 * Internal-only digest. Never sends anything to clients.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALERT_EMAIL = "nivratelecom@gmail.com";
const TARGET_DAYS = [80, 85, 90];

function fmtDateISO(d: Date | string | null | undefined): string {
  if (!d) return "";
  const dt = typeof d === "string" ? new Date(d) : d;
  if (isNaN(dt.getTime())) return "";
  return dt.toISOString().slice(0, 10);
}

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v).replace(/\r?\n/g, " ").trim();
  if (/[",;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase: any = createClient(supabaseUrl, serviceKey);

  const startedAt = new Date().toISOString();

  try {
    // Pull active accounts with their last checkup (computed in JS – avoids
    // a complex SQL view and matches the schema reality exactly).
    const { data: accounts, error: accountsError } = await supabase
      .from("accounts")
      .select(`
        id, account_number, created_at, status, client_id,
        primary_service_address, primary_service_city, primary_service_province, primary_service_postal_code
      `)
      .eq("status", "active")
      .limit(2000);
    if (accountsError) throw accountsError;
    const activeAccounts = (accounts ?? []) as any[];
    if (activeAccounts.length === 0) {
      return new Response(JSON.stringify({ ok: true, due: 0, emailed: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accountIds = activeAccounts.map((a) => a.id);
    const userIds = activeAccounts.map((a) => a.client_id).filter(Boolean);

    const [profilesRes, subsRes, checkupsRes] = await Promise.all([
      supabase.from("profiles").select("user_id, first_name, last_name, email, phone").in("user_id", userIds),
      supabase.from("billing_subscriptions").select("order_id, plan_name, plan_price, status, next_renewal_at, environment, cycle_start_date").eq("status", "active"),
      supabase.from("client_checkups").select("account_id, checked_at").in("account_id", accountIds),
    ]);

    const profilesByUser = new Map<string, any>();
    for (const p of (profilesRes.data ?? []) as any[]) profilesByUser.set(p.user_id, p);

    const lastCheckupByAccount = new Map<string, string>();
    for (const c of (checkupsRes.data ?? []) as any[]) {
      const prev = lastCheckupByAccount.get(c.account_id);
      if (!prev || new Date(c.checked_at) > new Date(prev)) lastCheckupByAccount.set(c.account_id, c.checked_at);
    }

    // Map orders→accounts so we can join active subs to accounts.
    const { data: ordersForSubs } = await supabase
      .from("orders")
      .select("id, account_id")
      .in("account_id", accountIds);
    const orderToAccount = new Map<string, string>();
    for (const o of (ordersForSubs ?? []) as any[]) if (o.account_id) orderToAccount.set(o.id, o.account_id);

    const subsByAccount = new Map<string, any>();
    for (const s of (subsRes.data ?? []) as any[]) {
      const accId = s.order_id ? orderToAccount.get(s.order_id) : null;
      if (accId && !subsByAccount.has(accId)) subsByAccount.set(accId, s);
    }

    const now = Date.now();
    const due: any[] = [];
    for (const a of activeAccounts) {
      const last = lastCheckupByAccount.get(a.id) ?? a.created_at;
      if (!last) continue;
      const days = Math.floor((now - new Date(last).getTime()) / (1000 * 60 * 60 * 24));
      if (!TARGET_DAYS.includes(days)) continue;
      const prof = a.client_id ? profilesByUser.get(a.client_id) : null;
      const sub = subsByAccount.get(a.id);
      due.push({
        account_id: a.id,
        account_number: a.account_number ?? "",
        first_name: prof?.first_name ?? "",
        last_name: prof?.last_name ?? "",
        full_name: [prof?.first_name, prof?.last_name].filter(Boolean).join(" ").trim() || "—",
        email: prof?.email ?? "",
        phone: prof?.phone ?? "",
        address: [a.primary_service_address, a.primary_service_city, a.primary_service_province, a.primary_service_postal_code]
          .filter(Boolean).join(", "),
        plan_name: sub?.plan_name ?? "",
        plan_price: sub?.plan_price ?? "",
        next_renewal_at: fmtDateISO(sub?.next_renewal_at),
        account_created_at: fmtDateISO(a.created_at),
        last_checkup: fmtDateISO(last),
        days_since_last_checkup: days,
      });
    }

    if (due.length === 0) {
      return new Response(JSON.stringify({ ok: true, due: 0, emailed: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build CSV
    const headers = [
      "account_number", "full_name", "email", "phone", "address",
      "plan_name", "plan_price", "next_renewal_at", "account_created_at",
      "last_checkup", "days_since_last_checkup",
    ];
    const csvRows = [headers.join(",")];
    for (const r of due) csvRows.push(headers.map((h) => csvEscape((r as any)[h])).join(","));
    const csv = csvRows.join("\n");
    const csvBase64 = btoa(unescape(encodeURIComponent(csv)));
    const today = new Date().toISOString().slice(0, 10);

    // Inline HTML list — kept readable for an internal email digest.
    const listHtml = due
      .map(
        (r) => `
          <tr>
            <td style="padding:6px 10px;border-bottom:1px solid #eee;">${r.account_number}</td>
            <td style="padding:6px 10px;border-bottom:1px solid #eee;">${r.full_name}</td>
            <td style="padding:6px 10px;border-bottom:1px solid #eee;">${r.email}</td>
            <td style="padding:6px 10px;border-bottom:1px solid #eee;">${r.phone || "—"}</td>
            <td style="padding:6px 10px;border-bottom:1px solid #eee;">${r.plan_name || "—"}</td>
            <td style="padding:6px 10px;border-bottom:1px solid #eee;">${r.days_since_last_checkup} j</td>
          </tr>`,
      )
      .join("");

    const eventKey = `agent_checkup_${today}`;
    const { error: qErr } = await supabase.from("email_queue").insert({
      event_key: eventKey,
      to_email: ALERT_EMAIL,
      template_key: "checkup_reminder",
      template_vars: {
        count: due.length,
        date: today,
        clients: due,
        clients_html_rows: listHtml,
      },
      attachments: [
        {
          filename: `checkup-${today}.csv`,
          content: csvBase64,
          contentType: "text/csv",
        },
      ],
      status: "queued",
      attempts: 0,
      max_attempts: 5,
      language: "fr",
    });

    await supabase
      .from("agent_registry")
      .update({
        last_run_at: startedAt,
        last_success_at: new Date().toISOString(),
        total_runs: (await supabase.rpc("noop")).error ? 0 : 0,
      })
      .eq("agent_name", "checkup");

    return new Response(
      JSON.stringify({ ok: true, due: due.length, emailed: !qErr, error: qErr?.message ?? null }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("[agent-checkup] error", e);
    await supabase
      .from("agent_registry")
      .update({ last_run_at: startedAt, last_error_at: new Date().toISOString(), last_error_message: String(e?.message ?? e) })
      .eq("agent_name", "checkup");
    return new Response(JSON.stringify({ ok: false, error: String(e?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
