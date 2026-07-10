// ============================================================================
// core-issue-compensation — Canonical entry point for "Bon de compensation"
// ----------------------------------------------------------------------------
// Only path allowed to insert a compensation voucher into account_adjustments.
// Guarantees (F34-1 → F34-22):
//   - Strict RBAC (admin | supervisor | billing_admin)
//   - Ownership validation (account belongs to client_id)
//   - Server-side amount resolution (compute_month_free_value for month_free)
//   - Amount caps per role
//   - Idempotency (UNIQUE(account_id, idempotency_key))
//   - Mandatory expiration + category
//   - Anti-self-attribution (agent != account owner)
//   - Mapped to 'credit' type so existing lifecycle consumes it
//   - Emits admin_audit_log + client_activity_logs + client_internal_notes
//   - Enqueues email via email_queue (event_key, ON CONFLICT)
// ============================================================================
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CATEGORIES = ["service_issue", "retention", "billing_error", "goodwill", "other"] as const;
type Category = typeof CATEGORIES[number];

// Caps by role (F34-4, F34-13)
const AMOUNT_CAPS: Record<string, number> = {
  support: 25,
  sales: 25,
  employee: 50,
  billing_admin: 150,
  supervisor: 200,
  admin: 500,
};

const APPROVAL_THRESHOLD = 150; // above this, admin-only (F34-15)
const DEFAULT_EXPIRY_DAYS = 90;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const authHeader = req.headers.get("authorization") ?? "";
    if (!authHeader) return json({ ok: false, error: "auth_required" }, 401);

    const authed = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userRes, error: userErr } = await authed.auth.getUser();
    if (userErr || !userRes?.user) return json({ ok: false, error: "invalid_session" }, 401);
    const user = userRes.user;

    // Resolve highest role
    const rolesToCheck = ["admin", "supervisor", "billing_admin", "employee", "sales", "support"];
    const roleChecks = await Promise.all(
      rolesToCheck.map((r) => authed.rpc("has_role", { _user_id: user.id, _role: r })),
    );
    const grantedRoles = rolesToCheck.filter((_, i) => Boolean(roleChecks[i]?.data));
    if (grantedRoles.length === 0) return json({ ok: false, error: "insufficient_privilege" }, 403);
    // Only admin/supervisor/billing_admin allowed (F34-5)
    const canIssue = grantedRoles.some((r) => ["admin", "supervisor", "billing_admin"].includes(r));
    if (!canIssue) return json({ ok: false, error: "role_cannot_issue_compensation" }, 403);
    const primaryRole = grantedRoles.includes("admin") ? "admin"
      : grantedRoles.includes("supervisor") ? "supervisor"
      : "billing_admin";
    const cap = AMOUNT_CAPS[primaryRole] ?? 0;

    const body = await req.json().catch(() => ({}));
    const {
      account_id,
      client_id,
      preset,            // "amount" | "month_free"
      amount: reqAmount, // only used when preset='amount'
      category,
      incident_ref,
      ticket_id,
      idempotency_key,
      expires_in_days,
      __audit_reason: reason,
    } = body ?? {};

    if (!account_id) return json({ ok: false, error: "account_id_required" }, 400);
    if (!client_id) return json({ ok: false, error: "client_id_required" }, 400);
    if (!reason || String(reason).trim().length < 3) {
      return json({ ok: false, error: "audit_reason_required_min_3" }, 400);
    }
    if (!idempotency_key || String(idempotency_key).length < 8) {
      return json({ ok: false, error: "idempotency_key_required_min_8" }, 400);
    }
    if (!CATEGORIES.includes(category)) {
      return json({ ok: false, error: `category_must_be_${CATEGORIES.join("|")}` }, 400);
    }
    if (!["amount", "month_free"].includes(preset)) {
      return json({ ok: false, error: "preset_must_be_amount_or_month_free" }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Ownership validation (F34-1)
    const { data: acc } = await admin
      .from("accounts")
      .select("id, client_id, account_number, status")
      .eq("id", account_id)
      .maybeSingle();
    if (!acc) return json({ ok: false, error: "account_not_found" }, 404);
    if (acc.client_id !== client_id) return json({ ok: false, error: "ownership_mismatch" }, 403);

    // Anti-self-attribution (F34-14)
    if (acc.client_id === user.id) {
      return json({ ok: false, error: "self_attribution_forbidden" }, 403);
    }

    // Idempotency short-circuit
    const { data: existing } = await admin
      .from("account_adjustments")
      .select("id, amount, status, metadata")
      .eq("account_id", account_id)
      .eq("idempotency_key", idempotency_key)
      .maybeSingle();
    if (existing) {
      return json({ ok: true, id: existing.id, idempotent: true });
    }

    // Server-side amount resolution (F34-3)
    let finalAmount: number;
    let amountSource: string;
    if (preset === "month_free") {
      const { data: mfv, error: mfvErr } = await admin.rpc("compute_month_free_value", { _account_id: account_id });
      if (mfvErr) return json({ ok: false, error: `compute_month_free_value: ${mfvErr.message}` }, 500);
      const row = Array.isArray(mfv) ? mfv[0] : mfv;
      finalAmount = Number(row?.monthly_amount ?? 0);
      amountSource = String(row?.source ?? "unknown");
    } else {
      const n = Number(reqAmount);
      if (!isFinite(n) || n <= 0) return json({ ok: false, error: "amount_must_be_positive" }, 400);
      finalAmount = n;
      amountSource = "operator_input";
    }

    // Caps (F34-4)
    if (finalAmount <= 0) return json({ ok: false, error: "amount_zero_forbidden" }, 400);
    if (finalAmount > cap) {
      return json({ ok: false, error: `amount_${finalAmount}_exceeds_cap_${cap}_for_role_${primaryRole}` }, 403);
    }
    // High-value approval (F34-15): only admin above threshold
    if (finalAmount > APPROVAL_THRESHOLD && primaryRole !== "admin") {
      return json({ ok: false, error: `high_value_requires_admin_approval_threshold_${APPROVAL_THRESHOLD}` }, 403);
    }

    // Expiration (F34-7)
    const days = Number.isInteger(expires_in_days) && expires_in_days > 0 && expires_in_days <= 365
      ? expires_in_days
      : DEFAULT_EXPIRY_DAYS;
    const expiresAt = new Date(Date.now() + days * 86400_000).toISOString();

    // Metadata (F34-16, F34-17)
    const metadata = {
      compensation: {
        category,
        incident_ref: incident_ref ?? null,
        ticket_id: ticket_id ?? null,
        issued_by_role: primaryRole,
        issued_by_user_id: user.id,
        amount_source: amountSource,
        preset,
      },
    };

    // Insert (mapped to type='credit' — F34-2)
    const desc = preset === "month_free"
      ? `Bon de compensation — 1 mois gratuit (${finalAmount.toFixed(2)}$) — ${reason}`
      : `Bon de compensation — ${finalAmount.toFixed(2)}$ — ${reason}`;

    const { data: inserted, error: insErr } = await admin
      .from("account_adjustments")
      .insert({
        account_id,
        type: "credit",
        amount: finalAmount,
        description: desc,
        months_total: 1,
        months_remaining: 1,
        applied_count: 0,
        status: "active",
        is_permanent: false,
        applies_to: "next_invoice",
        expires_at: expiresAt,
        idempotency_key,
        metadata,
        created_by: user.id,
      })
      .select("id")
      .maybeSingle();

    if (insErr) {
      // Duplicate idempotency race: re-fetch
      if (String(insErr.message).includes("uq_account_adjustments_idempotency")) {
        const { data: race } = await admin
          .from("account_adjustments")
          .select("id")
          .eq("account_id", account_id)
          .eq("idempotency_key", idempotency_key)
          .maybeSingle();
        if (race) return json({ ok: true, id: race.id, idempotent: true });
      }
      return json({ ok: false, error: `insert_failed: ${insErr.message}` }, 500);
    }

    const adjustmentId = inserted?.id!;

    // Audit + traceability (F34-10, F34-11)
    await admin.from("admin_audit_log").insert({
      admin_user_id: user.id,
      admin_email: user.email,
      action: "compensation_issued",
      target_type: "account_adjustments",
      target_id: adjustmentId,
      details: {
        module_tag: "compensation",
        account_id,
        client_id,
        amount: finalAmount,
        preset,
        category,
        incident_ref: incident_ref ?? null,
        ticket_id: ticket_id ?? null,
        role: primaryRole,
        amount_source: amountSource,
        reason,
        idempotency_key,
        expires_at: expiresAt,
      },
    });

    try {
      await admin.from("client_activity_logs").insert({
        client_id,
        actor_user_id: user.id,
        actor_name: user.email ?? "Admin Core",
        actor_role: primaryRole,
        action_type: "compensation_issued",
        entity_type: "account_adjustments",
        entity_id: adjustmentId,
        summary: `Bon de compensation — ${finalAmount.toFixed(2)}$ (${category})`,
        after_data: { adjustment_id: adjustmentId, category, amount: finalAmount, expires_at: expiresAt },
      });
      await admin.from("client_internal_notes").insert({
        client_id,
        note_type: "system",
        body: `Bon de compensation émis — ${finalAmount.toFixed(2)}$ — catégorie: ${category} — motif: ${reason}`,
        created_by_user_id: user.id,
        created_by_role: primaryRole,
        created_by_name: user.email ?? "Admin Core",
      });
    } catch (e) {
      console.warn("[core-issue-compensation] traceability:", (e as any)?.message);
    }

    // Email via email_queue (F34-9, F34-22) — idempotent via event_key
    try {
      const { data: profile } = await admin
        .from("profiles").select("email, full_name").eq("user_id", client_id).maybeSingle();
      if (profile?.email) {
        await admin.from("email_queue").insert({
          event_key: `compensation_voucher:${adjustmentId}`,
          idempotency_key: `compensation:${adjustmentId}`,
          to_email: profile.email,
          template_key: "compensation_voucher",
          template_vars: {
            client_name: profile.full_name ?? "",
            amount: finalAmount.toFixed(2),
            category,
            expires_at: expiresAt,
            account_number: acc.account_number ?? "",
          },
          entity_type: "account_adjustments",
          entity_id: adjustmentId,
          language: "fr",
          message_type: "compensation",
          status: "pending",
        });
      }
    } catch (e) {
      console.warn("[core-issue-compensation] email enqueue:", (e as any)?.message);
    }

    return json({
      ok: true,
      id: adjustmentId,
      amount: finalAmount,
      amount_source: amountSource,
      expires_at: expiresAt,
      category,
    });
  } catch (e: any) {
    console.error("[core-issue-compensation] fatal:", e);
    return json({ ok: false, error: e?.message ?? String(e) }, 500);
  }
});
