// ============================================================================
// core-apply-adjustment — Client 360 unified adjustments center
// ----------------------------------------------------------------------------
// One entry point for the four canonical adjustment workflows:
//   - credit           → INSERT INTO account_adjustments (type=credit)
//   - fee              → INSERT INTO account_adjustments (type=fee)
//   - promotion        → INSERT INTO account_promotions
//   - invoice_writeoff → delegates to collections-account-actions (writeoff)
//
// No parallel logic. Reuses existing tables/triggers already consumed by
// billing-lifecycle (monthly application), generate_account_renewal_invoice
// (promotions), and the collections file. Emits admin_audit_log for every
// action with before/after snapshots (module_tag='adjustments').
// ============================================================================
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Kind = "credit" | "fee" | "promotion" | "invoice_writeoff";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const authHeader = req.headers.get("authorization") ?? "";
    if (!authHeader) return json({ ok: false, error: "auth required" }, 401);

    const authed = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userRes, error: userErr } = await authed.auth.getUser();
    if (userErr || !userRes?.user) return json({ ok: false, error: "invalid session" }, 401);
    const user = userRes.user;

    const [{ data: isAdmin }, { data: isStaff }, { data: isCore }] = await Promise.all([
      authed.rpc("has_role", { _user_id: user.id, _role: "admin" }),
      authed.rpc("has_role", { _user_id: user.id, _role: "staff" }),
      authed.rpc("has_role", { _user_id: user.id, _role: "core" }),
    ]);
    if (!isAdmin && !isStaff && !isCore) {
      return json({ ok: false, error: "insufficient_privilege" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const {
      kind,
      account_id,
      client_id,
      amount,
      months,
      description,
      label,
      promotion_type,
      invoice_id,
      client_user_id,
      __audit_reason: reason,
    } = body ?? {};

    if (!kind || !["credit", "fee", "promotion", "invoice_writeoff"].includes(kind)) {
      return json({ ok: false, error: "invalid kind" }, 400);
    }
    if (!reason || String(reason).trim().length < 3) {
      return json({ ok: false, error: "audit reason required (min 3 chars)" }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── invoice write-off delegates to canonical collections function ────
    if (kind === "invoice_writeoff") {
      if (!isAdmin) return json({ ok: false, error: "writeoff reserved to admin" }, 403);
      if (!invoice_id) return json({ ok: false, error: "invoice_id required" }, 400);
      if (!client_user_id) return json({ ok: false, error: "client_user_id required" }, 400);

      const { data: invBefore } = await admin
        .from("billing_invoices")
        .select("id, invoice_number, balance_due, status, customer_id")
        .eq("id", invoice_id)
        .maybeSingle();

      const collRes = await fetch(
        `${Deno.env.get("SUPABASE_URL")}/functions/v1/collections-account-actions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: authHeader,
          },
          body: JSON.stringify({
            action: "writeoff",
            client_user_id,
            invoice_id,
            reason,
          }),
        },
      );
      const collJson = await collRes.json().catch(() => ({}));
      if (!collRes.ok) {
        return json({ ok: false, error: collJson?.error ?? "collections writeoff failed" }, collRes.status);
      }

      await admin.from("admin_audit_log").insert({
        admin_user_id: user.id,
        admin_email: user.email,
        action: "core_adjustment_writeoff",
        target_type: "billing_invoice",
        target_id: invoice_id,
        details: {
          module_tag: "adjustments",
          kind,
          client_id,
          client_user_id,
          account_id,
          reason,
          collections_action_id: collJson?.id ?? null,
          before_state: invBefore,
        },
      });

      // Traceability parity (Modules 5-8): activity + system note
      if (client_id) {
        try {
          await admin.from("client_activity_logs").insert({
            client_id,
            actor_user_id: user.id,
            actor_name: user.email ?? "Admin Core",
            actor_role: "admin_core",
            action_type: "adjustment_writeoff",
            entity_type: "billing_invoice",
            entity_id: invoice_id,
            summary: `Radiation de facture ${invBefore?.invoice_number ?? invoice_id.slice(0, 8)} — solde ${invBefore?.balance_due ?? 0}$`,
            before_data: { invoice: invBefore ?? null },
            after_data: {
              module_tag: "adjustments",
              collections_action_id: collJson?.id ?? null,
              reason,
            },
          });
          await admin.from("client_internal_notes").insert({
            client_id,
            note_type: "system",
            body: `Radiation de facture — Facture #${invBefore?.invoice_number ?? invoice_id.slice(0, 8)} — solde ${invBefore?.balance_due ?? 0}$ — motif: ${reason}`,
            created_by_user_id: user.id,
            created_by_role: "admin_core",
            created_by_name: user.email ?? "Admin Core",
          });
        } catch (e) {
          console.warn("[core-apply-adjustment] writeoff traceability failed:", (e as any)?.message);
        }
      }

      return json({ ok: true, collections_action_id: collJson?.id ?? null });
    }

    // ── credit / fee / promotion ────────────────────────────────────────
    if (!account_id) return json({ ok: false, error: "account_id required" }, 400);
    const amt = Number(amount);
    if (!isFinite(amt) || amt <= 0) return json({ ok: false, error: "amount must be > 0" }, 400);
    const m = Number(months);
    if (!Number.isInteger(m) || m < 1 || m > 24) return json({ ok: false, error: "months must be 1..24" }, 400);
    const desc = String(description ?? label ?? "").trim();
    if (desc.length < 3) return json({ ok: false, error: "description required (min 3 chars)" }, 400);

    // Before-state (aggregate active load)
    const [{ data: adjBefore }, { data: promoBefore }] = await Promise.all([
      admin.from("account_adjustments")
        .select("id, type, amount, status")
        .eq("account_id", account_id).eq("status", "active"),
      admin.from("account_promotions")
        .select("id, amount, is_active, months_remaining")
        .eq("account_id", account_id).eq("is_active", true),
    ]);

    let inserted_id: string | null = null;
    let target_table: "account_adjustments" | "account_promotions" = "account_adjustments";

    if (kind === "promotion") {
      target_table = "account_promotions";
      const { data, error } = await admin.from("account_promotions").insert({
        account_id,
        label: desc,
        promotion_type: (promotion_type as string) || "monthly_discount",
        amount: amt,
        duration_months: m,
        months_remaining: m,
        is_active: true,
        created_by_user_id: user.id,
        created_by_role: "admin_core",
        notes: reason,
      }).select("id").maybeSingle();
      if (error) return json({ ok: false, error: `promotion insert: ${error.message}` }, 500);
      inserted_id = data?.id ?? null;
    } else {
      const { data, error } = await admin.from("account_adjustments").insert({
        account_id,
        type: kind, // 'credit' | 'fee'
        amount: amt,
        description: desc,
        months_total: m,
        months_remaining: m,
        applied_count: 0,
        status: "active",
        created_by: user.id,
      }).select("id").maybeSingle();
      if (error) return json({ ok: false, error: `adjustment insert: ${error.message}` }, 500);
      inserted_id = data?.id ?? null;
    }

    await admin.from("admin_audit_log").insert({
      admin_user_id: user.id,
      admin_email: user.email,
      action: `core_adjustment_${kind}`,
      target_type: target_table,
      target_id: inserted_id,
      details: {
        module_tag: "adjustments",
        kind,
        client_id,
        account_id,
        amount: amt,
        months: m,
        description: desc,
        promotion_type: kind === "promotion" ? (promotion_type ?? "monthly_discount") : null,
        reason,
        before_state: {
          adjustments: adjBefore ?? [],
          promotions: promoBefore ?? [],
        },
        after_state: {
          inserted_id,
          target_table,
        },
      },
    });

    // Traceability parity (Modules 5-8): client_activity_logs always; system note
    // for credit/fee only (account_promotions has trg_note_account_promotion).
    if (client_id) {
      try {
        await admin.from("client_activity_logs").insert({
          client_id,
          action_type: `adjustment_${kind}`,
          action_data: {
            module_tag: "adjustments",
            kind,
            account_id,
            amount: amt,
            months: m,
            description: desc,
            promotion_type: kind === "promotion" ? (promotion_type ?? "monthly_discount") : null,
            target_table,
            target_id: inserted_id,
            reason,
          },
          performed_by: user.id,
          performed_by_role: "admin_core",
        });
        if (kind !== "promotion") {
          const label = kind === "credit" ? "Crédit récurrent" : "Frais récurrent";
          await admin.from("client_internal_notes").insert({
            client_id,
            note_type: "system",
            body: `${label} — ${amt.toFixed(2)}$ × ${m} mois — « ${desc} » — motif: ${reason}`,
            created_by_user_id: user.id,
            created_by_role: "admin_core",
            created_by_name: user.email ?? "Admin Core",
          });
        }
      } catch (e) {
        console.warn("[core-apply-adjustment] traceability failed:", (e as any)?.message);
      }
    }

    return json({ ok: true, id: inserted_id, target_table });
  } catch (e: any) {
    console.error("[core-apply-adjustment] fatal:", e);
    return json({ ok: false, error: e?.message ?? String(e) }, 500);
  }
});
