// ============================================================================
// core-record-payment — Client 360 "Enregistrer paiement" (offline methods)
// ----------------------------------------------------------------------------
// Canonical path (NO parallel system):
//   - Payment RPC : public.apply_payment_to_invoice (7 args → uuid)
//     handles billing_payments insert + invoice sync + provenance.
//     Triggers already fire: receipt email (trg_payment_receipt_email),
//     loyalty (trg_earn_loyalty_on_payment), SMS (trg_queue_payment_sms).
//   - Credit RPC  : public.apply_credit_to_invoice for method='credit_account'
//     (draws from account_adjustments credits, non-cash).
//   - Audit       : public.admin_audit_log (before/after invoice snapshot).
//
// PayPal is REFUSED (Phase 3.B decommission).
// Card/Square is refused here — routed to core-process-card-payment on
// the invoice page (needs a tokenized Web Payments SDK source_id).
// ============================================================================
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { writeAccountJournal } from "../_shared/writeAccountJournal.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Method = "cash" | "cheque" | "interac" | "credit_account";

const METHOD_MAP: Record<Method, { rpc_method: string; provider: string; enum: string }> = {
  cash:           { rpc_method: "manual",  provider: "cash",    enum: "manual"  },
  cheque:         { rpc_method: "manual",  provider: "cheque",  enum: "manual"  },
  interac:        { rpc_method: "interac", provider: "interac", enum: "interac" },
  credit_account: { rpc_method: "credit",  provider: "credit",  enum: "manual"  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const authHeader = req.headers.get("authorization") ?? "";
    if (!authHeader) return json({ ok: false, error: "auth required" }, 401);

    // Auth client (verifies JWT + drives RLS)
    const authed = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userRes, error: userErr } = await authed.auth.getUser();
    if (userErr || !userRes?.user) return json({ ok: false, error: "invalid session" }, 401);
    const user = userRes.user;

    // Role check via canonical has_role
    const { data: roleOk } = await authed.rpc("has_role", {
      _user_id: user.id, _role: "admin",
    });
    const { data: staffOk } = await authed.rpc("has_role", {
      _user_id: user.id, _role: "staff",
    });
    if (!roleOk && !staffOk) return json({ ok: false, error: "insufficient_privilege" }, 403);

    const body = await req.json().catch(() => ({}));
    const {
      invoice_id,
      amount,
      method,
      reference,
      note,
      credit_id,               // required when method='credit_account'
      __audit_reason: reason,
      idempotency_key,
    } = body ?? {};

    if (!invoice_id || typeof invoice_id !== "string") return json({ ok: false, error: "invoice_id required" }, 400);
    const amt = Number(amount);
    if (!isFinite(amt) || amt <= 0) return json({ ok: false, error: "amount must be > 0" }, 400);
    if (!method || !(method in METHOD_MAP)) return json({ ok: false, error: "unsupported method" }, 400);
    if (!reason || String(reason).trim().length < 3) return json({ ok: false, error: "audit reason required (min 3 chars)" }, 400);
    if (String(method).toLowerCase().includes("paypal")) {
      return json({ ok: false, error: "PayPal is decommissioned (Phase 3.B)" }, 400);
    }

    // Service role for the actual writes (RPC + audit).
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── Load invoice (before-state) ──────────────────────────────────────
    const { data: invBefore, error: invErr } = await admin
      .from("billing_invoices")
      .select("id, invoice_number, customer_id, account_id, total, amount_paid, balance_due, status, order_id, currency")
      .eq("id", invoice_id)
      .maybeSingle();
    if (invErr || !invBefore) return json({ ok: false, error: "invoice not found" }, 404);
    if (["void", "cancelled", "refunded"].includes(String(invBefore.status))) {
      return json({ ok: false, error: `invoice status=${invBefore.status} — cannot record payment` }, 409);
    }

    // Resolve customer identity (billing_customers has no account_id — use invoice.account_id)
    const { data: cust } = await admin
      .from("billing_customers")
      .select("user_id, email")
      .eq("id", invBefore.customer_id)
      .maybeSingle();
    const account_id = (invBefore as any).account_id ?? null;

    const map = METHOD_MAP[method as Method];
    const context = {
      source: "core_record_payment",
      admin_user_id: user.id,
      admin_email: user.email,
      note: note ?? null,
      idempotency_key: idempotency_key ?? null,
      reason,
    };

    let payment_id: string | null = null;
    let line_id: string | null = null;

    if (method === "credit_account") {
      if (!credit_id) return json({ ok: false, error: "credit_id required for credit_account method" }, 400);
      // Verify credit is active + belongs to same account
      const { data: cred } = await admin
        .from("account_adjustments")
        .select("id, account_id, amount, applied_count, months_total, status, type")
        .eq("id", credit_id)
        .maybeSingle();
      if (!cred) return json({ ok: false, error: "credit not found" }, 404);
      if (cred.type !== "credit") return json({ ok: false, error: "adjustment is not a credit" }, 400);
      if (cred.status !== "active") return json({ ok: false, error: `credit status=${cred.status}` }, 409);
      if (account_id && cred.account_id !== account_id) {
        return json({ ok: false, error: "credit does not belong to invoice account" }, 409);
      }
      const { data: lineIdRes, error: rpcErr } = await admin.rpc("apply_credit_to_invoice", {
        p_invoice_id: invoice_id,
        p_credit_id:  credit_id,
        p_amount:     amt,
        p_context:    context,
      });
      if (rpcErr) return json({ ok: false, error: `apply_credit_to_invoice: ${rpcErr.message}` }, 500);
      line_id = lineIdRes as string;
    } else {
      const extRef = reference ?? `CORE-${Date.now().toString(36).toUpperCase()}`;
      const { data: payRes, error: rpcErr } = await admin.rpc("apply_payment_to_invoice", {
        p_invoice_id:          invoice_id,
        p_amount:              amt,
        p_method:              map.rpc_method,
        p_provider:            map.provider,
        p_provider_payment_id: extRef,
        p_provider_order_id:   null,
        p_customer_id:         invBefore.customer_id,
        p_source:              "admin",
        p_created_by_name:     user.email ?? null,
        p_created_by_role:     "admin",
      });
      if (rpcErr) return json({ ok: false, error: `apply_payment_to_invoice: ${rpcErr.message}` }, 500);
      // RPC returns jsonb { success, payment_id, ... } — extract id
      const payJson: any = payRes;
      if (payJson && payJson.success === false) {
        return json({ ok: false, error: `apply_payment_to_invoice: ${payJson.error ?? "unknown"}` }, 409);
      }
      payment_id = (payJson?.payment_id as string) ?? null;
    }

    // ── After-state ──────────────────────────────────────────────────────
    const { data: invAfter } = await admin
      .from("billing_invoices")
      .select("id, invoice_number, total, amount_paid, balance_due, status, paid_at")
      .eq("id", invoice_id)
      .maybeSingle();

    // ── Admin audit ──────────────────────────────────────────────────────
    await admin.from("admin_audit_log").insert({
      admin_user_id: user.id,
      admin_email:   user.email,
      action:        "core_record_payment",
      target_type:   "billing_invoice",
      target_id:     invoice_id,
      target_email:  cust?.email ?? null,
      details: {
        module_tag:  "record_payment",
        client_id:   cust?.user_id ?? null,
        account_id:  account_id ?? null,
        method,
        provider:    map.provider,
        amount:      amt,
        reference:   reference ?? null,
        note:        note ?? null,
        reason,
        credit_id:   credit_id ?? null,
        payment_id,
        line_id,
        before_state: invBefore,
        after_state:  invAfter,
      },
    });

    // ── Client activity log + system note (traçabilité client) ──────────
    if (cust?.user_id) {
      const amountLabel = new Intl.NumberFormat("fr-CA", {
        style: "currency", currency: "CAD",
      }).format(amt);
      const methodLabel = method === "credit_account"
        ? "Crédit compte"
        : method === "cash" ? "Argent comptant"
        : method === "cheque" ? "Chèque"
        : "Interac / Virement";
      const invNum = invBefore.invoice_number ?? invoice_id.slice(0, 8);

      await admin.from("client_activity_logs").insert({
        client_id:     cust.user_id,
        actor_user_id: user.id,
        actor_name:    user.email ?? null,
        actor_role:    "admin",
        action_type:   "payment_recorded",
        entity_type:   "billing_invoice",
        entity_id:     invoice_id,
        summary:       `Paiement ${amountLabel} enregistré sur facture ${invNum} — ${methodLabel} — motif: ${reason}`,
        before_data:   { balance_due: invBefore.balance_due, status: invBefore.status },
        after_data:    { balance_due: invAfter?.balance_due, status: invAfter?.status },
      });

      await admin.from("client_internal_notes").insert({
        client_id:          cust.user_id,
        account_id:         account_id ?? null,
        note_type:          "system",
        body:               `Paiement ${amountLabel} enregistré (${methodLabel}) sur facture ${invNum} — par ${user.email ?? user.id} — motif: ${reason}${reference ? ` — ref ${reference}` : ""}`,
        created_by_user_id: user.id,
        created_by_role:    "admin",
        created_by_name:    user.email ?? null,
      });
    }

    return json({
      ok: true,
      payment_id,
      line_id,
      invoice: invAfter,
    });
  } catch (e: any) {
    console.error("[core-record-payment] fatal:", e);
    return json({ ok: false, error: e?.message ?? String(e) }, 500);
  }
});
