// ============================================================================
// core-apply-autopay-action — Client 360 unified AutoPay & Payment Method center
// ----------------------------------------------------------------------------
// Actions:
//   - enable_autopay      → billing_customers.autopay_enabled=true (card required)
//   - disable_autopay     → billing_customers.autopay_enabled=false (keep card)
//   - detach_card         → delegates to square-detach-card (disables autopay + removes card)
//   - retry_now           → resets autopay_next_attempt_at=now() on invoices,
//                           optionally triggers square-autopay-retry immediately
//   - record_replace_card → registers audit + activity log + note after SquareCardForm
//                           has attached a new card client-side (widget writes card fields).
//
// Reuses:
//   - Table billing_customers (autopay flags + Square card fields)
//   - Table billing_invoices  (autopay_retry_count, autopay_next_attempt_at, autopay_stopped)
//   - Edge Function square-detach-card (canonical card detach + email)
//   - Edge Function square-autopay-retry (canonical retry executor)
//
// Traceability parity with Modules 7/8/9/10:
//   - admin_audit_log         (admin_user_id / details) — F10-1 mapping enforced
//   - client_activity_logs    (action_type=autopay_*)
//   - client_internal_notes   (note_type=system)
// ============================================================================
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { writeAccountJournal } from "../_shared/writeAccountJournal.ts";

// Minute bucket in base36 — used only when no stable business identity
// exists to anchor idempotency (e.g. record_replace_card, non-scoped retry).
function isoMinuteBucket36(d: Date = new Date()): string {
  return Math.floor(d.getTime() / 60_000).toString(36);
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Action =
  | "enable_autopay"
  | "disable_autopay"
  | "detach_card"
  | "retry_now"
  | "record_replace_card";

const VALID_ACTIONS: Action[] = [
  "enable_autopay", "disable_autopay", "detach_card", "retry_now", "record_replace_card",
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const authHeader = req.headers.get("authorization") ?? "";
    if (!authHeader) return json({ ok: false, error: "auth required" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authed = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
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
      action,
      customer_id,
      client_id,
      account_id,
      invoice_id,
      replaced_card,
      __audit_reason: reason,
    } = body ?? {};

    if (!action || !VALID_ACTIONS.includes(action)) {
      return json({ ok: false, error: "invalid action" }, 400);
    }
    if (!reason || String(reason).trim().length < 3) {
      return json({ ok: false, error: "audit reason required (min 3 chars)" }, 400);
    }
    if (!customer_id) return json({ ok: false, error: "customer_id required" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: bcBefore, error: bcErr } = await admin
      .from("billing_customers")
      .select("id, email, first_name, last_name, user_id, autopay_enabled, autopay_discount_active, square_customer_id, square_card_id, square_card_brand, square_card_last4")
      .eq("id", customer_id)
      .maybeSingle();
    if (bcErr || !bcBefore) return json({ ok: false, error: "billing customer not found" }, 404);

    const effectiveClientId = client_id ?? bcBefore.user_id ?? null;

    // ── Traceability helpers ─────────────────────────────────────────────
    const writeAudit = async (auditAction: string, after: Record<string, unknown>) => {
      const { error: audErr } = await admin.from("admin_audit_log").insert({
        admin_user_id: user.id,
        admin_email: user.email ?? null,
        action: auditAction,
        target_type: "billing_customers",
        target_id: customer_id,
        target_email: bcBefore.email ?? null,
        details: {
          module_tag: "autopay",
          action,
          client_id: effectiveClientId,
          account_id,
          customer_id,
          reason,
          before_state: bcBefore,
          after_state: after,
        },
      });
      if (audErr) console.error("[autopay-audit-insert]", audErr);
    };

    const writeActivityAndNote = async (
      summary: string,
      actionType: string,
      afterData: Record<string, unknown>,
      eventScope: string,
    ) => {
      if (!effectiveClientId) return;
      const actor = {
        userId: user.id,
        role: "admin",
        name: user.email ?? "core-admin",
        email: user.email ?? null,
      };
      try {
        await writeAccountJournal(admin, {
          targetTable: "client_activity_logs",
          eventKey: `autopay:${customer_id}:${eventScope}:activity`,
          correlationId: reason ?? null,
          actor,
          payload: {
            client_id:     effectiveClientId,
            actor_user_id: user.id,
            actor_name:    user.email ?? null,
            actor_role:    "admin",
            action_type:   actionType,
            entity_type:   "billing_customer",
            entity_id:     customer_id,
            summary,
            after_data:    afterData,
          },
        });
        await writeAccountJournal(admin, {
          targetTable: "client_internal_notes",
          eventKey: `autopay:${customer_id}:${eventScope}:note`,
          correlationId: reason ?? null,
          actor,
          payload: {
            client_id:          effectiveClientId,
            account_id:         account_id ?? null,
            note_type:          "system",
            body:               `${summary} — par ${user.email ?? user.id}`,
            created_by_user_id: user.id,
            created_by_role:    "admin",
            created_by_name:    user.email ?? null,
          },
        });
      } catch (e) { console.error("[autopay-activity-note]", e); }
    };

    const auditAction = `core_autopay_${action}`;

    // ── enable ──────────────────────────────────────────────────────────
    if (action === "enable_autopay") {
      if (!bcBefore.square_card_id || !bcBefore.square_customer_id) {
        return json({ ok: false, error: "aucune carte Square enregistrée — ajouter une méthode avant d'activer l'AutoPay" }, 400);
      }
      if (bcBefore.autopay_enabled) {
        return json({ ok: true, already_enabled: true });
      }
      const { error: upErr } = await admin
        .from("billing_customers")
        .update({ autopay_enabled: true, autopay_consent_at: new Date().toISOString() })
        .eq("id", customer_id);
      if (upErr) return json({ ok: false, error: `update failed: ${upErr.message}` }, 500);

      await writeAudit(auditAction, { autopay_enabled: true });
      await writeActivityAndNote(
        `AutoPay activé sur la carte ${bcBefore.square_card_brand} •••• ${bcBefore.square_card_last4} — motif: ${reason}`,
        "autopay_enabled",
        { autopay_enabled: true, card_last4: bcBefore.square_card_last4 },
      );
      return json({ ok: true });
    }

    // ── disable (keep card on file) ─────────────────────────────────────
    if (action === "disable_autopay") {
      if (!bcBefore.autopay_enabled) return json({ ok: true, already_disabled: true });
      const { error: upErr } = await admin
        .from("billing_customers")
        .update({ autopay_enabled: false, autopay_discount_active: false })
        .eq("id", customer_id);
      if (upErr) return json({ ok: false, error: `update failed: ${upErr.message}` }, 500);

      await writeAudit(auditAction, { autopay_enabled: false, autopay_discount_active: false });
      await writeActivityAndNote(
        `AutoPay suspendu (carte conservée) — motif: ${reason}`,
        "autopay_disabled",
        { autopay_enabled: false },
      );
      return json({ ok: true });
    }

    // ── detach card (canonical → square-detach-card) ────────────────────
    if (action === "detach_card") {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/square-detach-card`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
        body: JSON.stringify({ customer_id, channel: "core", staff_actor_name: user.email }),
      });
      const detachJson = await res.json().catch(() => ({}));
      if (!res.ok || !detachJson?.ok) {
        return json({ ok: false, error: detachJson?.error ?? "detach failed" }, res.status || 500);
      }
      await writeAudit(auditAction, { square_card_id: null, autopay_enabled: false });
      await writeActivityAndNote(
        `Carte Square retirée (•••• ${bcBefore.square_card_last4 ?? "?"}) + AutoPay désactivé — motif: ${reason}`,
        "autopay_card_detached",
        { square_card_id: null, autopay_enabled: false },
      );
      return json({ ok: true });
    }

    // ── retry_now ───────────────────────────────────────────────────────
    if (action === "retry_now") {
      if (!bcBefore.autopay_enabled) return json({ ok: false, error: "AutoPay désactivé" }, 400);
      if (!bcBefore.square_card_id) return json({ ok: false, error: "aucune carte enregistrée" }, 400);

      const q = admin
        .from("billing_invoices")
        .update({ autopay_next_attempt_at: new Date().toISOString(), autopay_stopped: false })
        .eq("customer_id", customer_id)
        .in("status", ["pending", "overdue", "failed", "partially_paid"])
        .gt("balance_due", 0);
      const scoped = invoice_id ? q.eq("id", invoice_id) : q;
      const { data: updated, error: upErr } = await scoped.select("id, invoice_number");
      if (upErr) return json({ ok: false, error: `reschedule failed: ${upErr.message}` }, 500);

      // Kick the canonical retry executor immediately
      let executor: any = null;
      try {
        const execRes = await fetch(`${SUPABASE_URL}/functions/v1/square-autopay-retry`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
        });
        executor = await execRes.json().catch(() => ({}));
      } catch (e) {
        console.warn("[core-apply-autopay-action] retry executor invoke failed:", e);
      }

      await writeAudit(auditAction, {
        invoices_rescheduled: updated ?? [],
        executor_summary: executor,
      });
      await writeActivityAndNote(
        `Relance AutoPay forcée — ${updated?.length ?? 0} facture(s) reprogrammée(s) — motif: ${reason}`,
        "autopay_retry_forced",
        { invoices_rescheduled_count: updated?.length ?? 0, invoice_id: invoice_id ?? null },
      );
      return json({ ok: true, invoices_rescheduled: updated ?? [], executor });
    }

    // ── record_replace_card ─────────────────────────────────────────────
    // The Square widget has already attached the card to billing_customers.
    // We only stamp the audit trail + activity log + note with the operator identity.
    if (action === "record_replace_card") {
      const brand = replaced_card?.brand ?? bcBefore.square_card_brand ?? "?";
      const last4 = replaced_card?.last4 ?? bcBefore.square_card_last4 ?? "?";
      await writeAudit(auditAction, {
        square_card_brand: brand,
        square_card_last4: last4,
      });
      await writeActivityAndNote(
        `Méthode de paiement remplacée — ${brand} •••• ${last4} — motif: ${reason}`,
        "autopay_card_replaced",
        { square_card_brand: brand, square_card_last4: last4 },
      );
      return json({ ok: true });
    }

    return json({ ok: false, error: "unhandled action" }, 400);
  } catch (e: any) {
    console.error("[core-apply-autopay-action] fatal:", e);
    return new Response(
      JSON.stringify({ ok: false, error: e?.message ?? String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
