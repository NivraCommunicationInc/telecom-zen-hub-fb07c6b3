/**
 * nivra-diagnostic — lecture seule, aucune modification
 * Requiert: { secret: "NIVRA_DIAG_2026", action: "..." }
 *
 * actions:
 *   "oldo_profile"        — toutes les données de Oldo Lavaud (profiles, accounts, billing_customers)
 *   "active_clients_scan" — scan profil complet de tous les clients actifs
 *   "billing_health"      — subscriptions + invoices incohérentes
 */
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  let body: any = {};
  try { body = await req.json(); } catch { /* */ }
  if (body.secret !== "NIVRA_DIAG_2026") return json({ error: "Unauthorized" }, 401);

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // ─────────────────────────────────────────────────────────────────────────
  if (body.action === "oldo_profile") {
    // Search by first_name OR email patterns for Oldo / Lavaud
    const [p1, p2, p3, p4] = await Promise.all([
      sb.from("profiles").select("*").or("first_name.ilike.%oldo%,last_name.ilike.%lavaud%,email.ilike.%oldo%"),
      sb.from("billing_customers").select("*").or("first_name.ilike.%oldo%,last_name.ilike.%lavaud%,email.ilike.%oldo%"),
      sb.from("accounts").select("*").limit(1000),
      sb.from("profiles").select("*").in("email", ["oldo.lavaud3112@icloud.com","oldol@gmail.com","oldo@nivra-telecom.ca"]),
    ]);

    // Cross-ref accounts with profiles found
    const profileUserIds = [...(p1.data ?? []), ...(p4.data ?? [])].map((p: any) => p.user_id).filter(Boolean);
    const { data: matchedAccounts } = profileUserIds.length
      ? await sb.from("accounts").select("*").in("client_id", profileUserIds)
      : { data: [] };

    const { data: matchedBillingCustomers } = profileUserIds.length
      ? await sb.from("billing_customers").select("*").in("user_id", profileUserIds)
      : { data: [] };

    return json({
      profiles_by_name: p1.data,
      profiles_by_email: p4.data,
      billing_customers_by_name: p2.data,
      billing_customers_by_user_id: matchedBillingCustomers,
      accounts_matched: matchedAccounts,
      errors: [p1.error?.message, p2.error?.message, p3.error?.message, p4.error?.message].filter(Boolean),
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  if (body.action === "active_clients_scan") {
    // All active accounts + their profiles + billing_customers
    const { data: accounts, error: errA } = await sb
      .from("accounts")
      .select("id, client_id, status, created_at")
      .eq("status", "active")
      .limit(500);
    if (errA) return json({ error: errA.message }, 500);

    const clientIds = (accounts ?? []).map((a: any) => a.client_id).filter(Boolean);

    const [{ data: profiles }, { data: bcs }] = await Promise.all([
      sb.from("profiles").select("user_id, email, first_name, last_name, phone").in("user_id", clientIds),
      sb.from("billing_customers").select("id, user_id, email, first_name, last_name, phone").in("user_id", clientIds),
    ]);

    // Build comparison map
    const profileMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));
    const bcMap = new Map((bcs ?? []).map((b: any) => [b.user_id, b]));

    const report = (accounts ?? []).map((a: any) => {
      const p = profileMap.get(a.client_id) ?? null;
      const bc = bcMap.get(a.client_id) ?? null;
      const issues: string[] = [];

      if (!p) issues.push("NO_PROFILE");
      if (!bc) issues.push("NO_BILLING_CUSTOMER");
      if (p && (!p.first_name || p.first_name.trim() === "")) issues.push("MISSING_FIRST_NAME");
      if (p && (!p.last_name || p.last_name.trim() === "")) issues.push("MISSING_LAST_NAME");
      if (p && (!p.email || !p.email.includes("@"))) issues.push("INVALID_EMAIL");
      if (bc && (!bc.email || !bc.email.includes("@"))) issues.push("BILLING_INVALID_EMAIL");
      if (p && bc && p.email?.toLowerCase() !== bc.email?.toLowerCase()) issues.push("EMAIL_MISMATCH");
      if (p && bc && (p.first_name?.toLowerCase() !== bc.first_name?.toLowerCase())) issues.push("FIRST_NAME_MISMATCH");
      if (p && bc && (p.last_name?.toLowerCase() !== bc.last_name?.toLowerCase())) issues.push("LAST_NAME_MISMATCH");

      return {
        account_id: a.id,
        client_id: a.client_id,
        profile: p ? { email: p.email, first_name: p.first_name, last_name: p.last_name, phone: p.phone } : null,
        billing_customer: bc ? { email: bc.email, first_name: bc.first_name, last_name: bc.last_name, phone: bc.phone } : null,
        issues,
        ok: issues.length === 0,
      };
    });

    const anomalies = report.filter(r => !r.ok);
    return json({ total_accounts: (accounts ?? []).length, anomalies_count: anomalies.length, anomalies, all_clean: report.filter(r => r.ok).map(r => r.profile?.email) });
  }

  // ─────────────────────────────────────────────────────────────────────────
  if (body.action === "billing_health") {
    const since60 = new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString().split("T")[0];
    const overdueCutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().split("T")[0];

    // Get ALL subscription statuses to understand what values exist
    const { data: allSubs, error: eS } = await sb
      .from("billing_subscriptions")
      .select("id, customer_id, status, plan_name, created_at")
      .limit(300);

    // Count by status
    const statusCounts: Record<string, number> = {};
    for (const s of allSubs ?? []) {
      statusCounts[s.status] = (statusCounts[s.status] ?? 0) + 1;
    }

    // Active-like subs (open or active or subscribed)
    const activeLike = (allSubs ?? []).filter((s: any) =>
      ["active","open","subscribed","current"].includes(s.status)
    );

    // Check for subs with no invoice in last 60 days
    const subIds = activeLike.map((s: any) => s.id);
    const { data: recentInvs } = subIds.length
      ? await sb.from("billing_invoices").select("subscription_id, status, due_date").in("subscription_id", subIds).gte("created_at", since60)
      : { data: [] };

    const subWithInv = new Set((recentInvs ?? []).map((i: any) => i.subscription_id));
    const subsNoInvoice = activeLike.filter((s: any) => !subWithInv.has(s.id));

    // Overdue invoices > 30 days
    const { data: overdueInvs, error: eO } = await sb
      .from("billing_invoices")
      .select("id, invoice_number, status, due_date, total, customer_id, type")
      .eq("status", "overdue")
      .lte("due_date", overdueCutoff)
      .limit(100);

    // Pending (adjustment) invoices from plan changes — check if any stuck
    const { data: pendingAdj, error: eP } = await sb
      .from("billing_invoices")
      .select("id, invoice_number, status, due_date, total, customer_id, type, created_at")
      .eq("type", "adjustment")
      .eq("status", "pending")
      .limit(50);

    // Duplicate invoice numbers
    const { data: dupeCheck, error: eD } = await sb
      .from("billing_invoices")
      .select("invoice_number")
      .gte("created_at", since60)
      .limit(500);

    const seenNums = new Map<string, number>();
    for (const inv of dupeCheck ?? []) {
      seenNums.set(inv.invoice_number, (seenNums.get(inv.invoice_number) ?? 0) + 1);
    }
    const duplicates = [...seenNums.entries()].filter(([, c]) => c > 1).map(([n, c]) => ({ invoice_number: n, count: c }));

    return json({
      subscription_status_breakdown: statusCounts,
      total_subscriptions: (allSubs ?? []).length,
      active_like_subscriptions: activeLike.length,
      subs_no_invoice_60d: subsNoInvoice.map(s => ({ id: s.id, customer_id: s.customer_id, plan: s.plan_name, status: s.status })),
      overdue_30d_plus: (overdueInvs ?? []).map(i => ({ id: i.id, number: i.invoice_number, due: i.due_date, total: i.total, type: i.type })),
      pending_adjustment_invoices: (pendingAdj ?? []).map(i => ({ id: i.id, number: i.invoice_number, due: i.due_date, total: i.total, created: i.created_at })),
      duplicate_invoice_numbers: duplicates,
      errors: [eS?.message, eO?.message, eP?.message, eD?.message].filter(Boolean),
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  if (body.action === "email_audit") {
    // ALL billing_customers (not just active) vs their profiles
    const { data: allBcs, error: eBc } = await sb
      .from("billing_customers")
      .select("id, user_id, email, first_name, last_name, created_at, updated_at, status")
      .not("user_id", "is", null)
      .limit(500);

    if (eBc) return json({ error: eBc.message }, 500);

    const userIds = (allBcs ?? []).map((b: any) => b.user_id).filter(Boolean);
    const { data: profiles, error: eP } = await sb
      .from("profiles")
      .select("user_id, email, first_name, last_name, created_at, updated_at, client_number")
      .in("user_id", userIds)
      .limit(500);

    if (eP) return json({ error: eP.message }, 500);

    const profMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));

    const mismatches: any[] = [];
    const matches: any[] = [];

    for (const bc of allBcs ?? []) {
      const p = profMap.get(bc.user_id);
      if (!p) { mismatches.push({ reason: "NO_PROFILE", billing_customer: bc }); continue; }

      const bcEmail = (bc.email ?? "").toLowerCase().trim();
      const pEmail = (p.email ?? "").toLowerCase().trim();

      if (bcEmail === pEmail) {
        matches.push(p.email);
        continue;
      }

      // Determine which came first
      const bcCreated = new Date(bc.created_at).getTime();
      const pCreated = new Date(p.created_at).getTime();
      const bcUpdated = new Date(bc.updated_at).getTime();
      const pUpdated = new Date(p.updated_at).getTime();

      const olderSource = bcCreated <= pCreated ? "billing_customers" : "profiles";
      const firstEmail = olderSource === "billing_customers" ? bc.email : p.email;
      const secondEmail = olderSource === "billing_customers" ? p.email : bc.email;
      const secondUpdated = olderSource === "billing_customers" ? p.updated_at : bc.updated_at;

      mismatches.push({
        user_id: bc.user_id,
        client_number: p.client_number,
        billing_customer_status: bc.status,
        billing_email: bc.email,
        profile_email: p.email,
        billing_created: bc.created_at,
        billing_updated: bc.updated_at,
        profile_created: p.created_at,
        profile_updated: p.updated_at,
        older_source: olderSource,
        first_email: firstEmail,
        second_email: secondEmail,
        second_appeared_at: secondUpdated,
        internal_emails: (bcEmail.includes("@nivra-internal.local") || pEmail.includes("@nivra-internal.local")),
      });
    }

    return json({
      total_billing_customers: (allBcs ?? []).length,
      emails_match: matches.length,
      emails_mismatch: mismatches.filter(m => !m.internal_emails && m.reason !== "NO_PROFILE").length,
      internal_anonymized: mismatches.filter(m => m.internal_emails).length,
      no_profile: mismatches.filter(m => m.reason === "NO_PROFILE").length,
      mismatches: mismatches.filter(m => !m.internal_emails),
      internal_accounts: mismatches.filter(m => m.internal_emails).map(m => m.billing_email),
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  if (body.action === "auth_sync_check") {
    // For the 4 known mismatched users: compare auth.users.email vs profiles.email vs billing_customers.email
    // Find all mismatches first (same logic as email_audit)
    const { data: allBcs } = await sb
      .from("billing_customers")
      .select("id, user_id, email, first_name, last_name, status")
      .not("user_id", "is", null)
      .limit(500);

    const userIds = (allBcs ?? []).map((b: any) => b.user_id).filter(Boolean);
    const { data: profiles } = await sb
      .from("profiles")
      .select("user_id, email, first_name, last_name, client_number")
      .in("user_id", userIds);

    const profMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));

    const mismatched = (allBcs ?? []).filter((bc: any) => {
      const p = profMap.get(bc.user_id);
      if (!p) return false;
      const bcEmail = (bc.email ?? "").toLowerCase().trim();
      const pEmail = (p.email ?? "").toLowerCase().trim();
      return bcEmail !== pEmail && !bcEmail.includes("@nivra-internal.local") && !pEmail.includes("@nivra-internal.local");
    });

    // For each mismatched user, check auth.users.email
    const results = await Promise.all(mismatched.map(async (bc: any) => {
      const p = profMap.get(bc.user_id);
      let authEmail: string | null = null;
      let authError: string | null = null;

      try {
        const { data: authUser, error: authErr } = await sb.auth.admin.getUserById(bc.user_id);
        if (authErr) authError = authErr.message;
        else authEmail = authUser?.user?.email ?? null;
      } catch (e: any) {
        authError = e.message;
      }

      const correction_safe = authEmail !== p?.email;
      // Safe to update profiles.email = billing.email ONLY if auth email matches billing (not portal)
      const auth_matches_billing = authEmail?.toLowerCase() === bc.email?.toLowerCase();
      const auth_matches_profile = authEmail?.toLowerCase() === p?.email?.toLowerCase();

      return {
        client_number: p?.client_number,
        user_id: bc.user_id,
        billing_email: bc.email,
        profile_email: p?.email,
        auth_email: authEmail,
        auth_error: authError,
        // Risk assessment
        auth_matches_billing,
        auth_matches_profile,
        // If auth uses portal email: changing profiles.email is safe (portal login unaffected)
        // If auth uses billing email: changing profiles.email is also safe (auth not in profiles table)
        // Auth email is the true login email — profiles.email is only display/contact
        profile_email_safe_to_update: true,
        recommended_correction: `profiles.email → "${bc.email}" (billing is source of truth)`,
        // If auth email differs from billing AND from portal: there's a 3-way mismatch
        three_way_mismatch: authEmail && authEmail.toLowerCase() !== bc.email?.toLowerCase() && authEmail.toLowerCase() !== p?.email?.toLowerCase(),
      };
    }));

    return json({
      mismatches_found: results.length,
      results,
      summary: results.map(r => ({
        client: r.client_number,
        billing: r.billing_email,
        profile: r.profile_email,
        auth: r.auth_email,
        three_way: r.three_way_mismatch,
      })),
    });
  }

  return json({ error: "Unknown action. Use: oldo_profile | active_clients_scan | billing_health | email_audit | auth_sync_check" }, 400);
});
