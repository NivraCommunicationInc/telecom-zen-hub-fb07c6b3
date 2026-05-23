/**
 * cancel-account — Orchestrated, idempotent account cancellation.
 *
 * One call cascades through every system that needs to know:
 *   1. Cancel all PayPal billing agreements (via paypal-cancel-subscription)
 *   2. Mark all billing_subscriptions for this account as 'cancelled'
 *   3. Void any pending / partially_paid invoices (balance_due → 0)
 *   4. Flag unpaid commissions for clawback (status='clawback_pending')
 *   5. Freeze account_promotions (is_active=false) and account_adjustments
 *   6. Queue cancellation confirmation email
 *   7. If scope='full', set accounts.status='closed' (which triggers
 *      doc_cancellation_on_account → PDF generation automatically)
 *   8. Write one billing_subscription_trace_audit row per subscription
 *   9. Persist a cancellation_runs row with the full step-by-step log
 *
 * The function NEVER throws once it has the cancellation_run id — every
 * step is wrapped so a single failure doesn't leave the account in a half-
 * cancelled state. Failures are recorded in `errors` and the run ends in
 * status='completed_with_errors' so ops can re-run / patch manually.
 *
 * Request body:
 *   {
 *     account_id: string,
 *     scope?: "full" | "service",        // default: "service"
 *     reason?: string,
 *   }
 *
 * Auth:
 *   - Admin / supervisor / employee → can cancel any account
 *   - Authenticated client → can cancel ONLY their own account
 *   - Anyone else → 401
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { reportEdgeError } from "../_shared/sentry.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface CancelRequest {
  account_id: string;
  scope?: "full" | "service";
  reason?: string;
}

type StepEntry = {
  step: string;
  ok: boolean;
  detail?: unknown;
  at: string;
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

async function resolveCaller(authHeader: string | null): Promise<{
  userId: string | null;
  email: string | null;
  role: string | null;
}> {
  if (!authHeader) return { userId: null, email: null, role: null };
  try {
    const supaAuth = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await supaAuth.auth.getUser();
    if (!user) return { userId: null, email: null, role: null };

    const admin = createClient<any>(SUPABASE_URL, SERVICE_KEY);
    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("status", "active");

    const role =
      (roles ?? []).find((r: any) => ["admin", "supervisor", "employee"].includes(r.role))?.role ??
      "client";

    return { userId: user.id, email: user.email ?? null, role };
  } catch {
    return { userId: null, email: null, role: null };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase: any = createClient(SUPABASE_URL, SERVICE_KEY);
  const startedAt = Date.now();
  let runId: string | null = null;
  const steps: StepEntry[] = [];
  const errors: unknown[] = [];

  // Local helper that always pushes to `steps` so we never lose breadcrumbs.
  const recordStep = (step: string, ok: boolean, detail?: unknown) => {
    steps.push({ step, ok, detail, at: new Date().toISOString() });
    if (!ok) errors.push({ step, detail });
  };

  try {
    const body: CancelRequest = await req.json();

    if (!body?.account_id) {
      return new Response(
        JSON.stringify({ error: "Missing account_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const scope = body.scope === "full" ? "full" : "service";
    const reason = body.reason?.trim() || (scope === "full"
      ? "Account closed by request"
      : "Service cancelled by request");

    // ────────────────────────────────────────────────────────────────
    // AUTH — must be staff OR the account owner.
    // ────────────────────────────────────────────────────────────────
    const caller = await resolveCaller(req.headers.get("Authorization"));
    if (!caller.userId) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: account, error: accountErr } = await supabase
      .from("accounts")
      .select("id, client_id, status, account_number")
      .eq("id", body.account_id)
      .single();

    if (accountErr || !account) {
      return new Response(
        JSON.stringify({ error: "Account not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const isStaff = caller.role === "admin" || caller.role === "supervisor" || caller.role === "employee";
    const isOwner = account.client_id === caller.userId;

    if (!isStaff && !isOwner) {
      return new Response(
        JSON.stringify({ error: "Forbidden — cancellation requires staff or account-owner privileges" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Idempotency: if a run is already in flight for this account, return it
    // instead of starting a parallel one. Prevents double-cancellations from
    // a double-click.
    {
      const { data: inFlight } = await supabase
        .from("cancellation_runs")
        .select("id, status, started_at")
        .eq("account_id", body.account_id)
        .eq("status", "running")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (inFlight) {
        return new Response(
          JSON.stringify({
            ok: true,
            already_running: true,
            run_id: inFlight.id,
            message: "A cancellation is already in progress for this account.",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // ────────────────────────────────────────────────────────────────
    // CREATE the cancellation_runs row — from here on we MUST complete
    // it, even partially. Each failure goes to `errors` and `steps`.
    // ────────────────────────────────────────────────────────────────
    const { data: runRow, error: runErr } = await supabase
      .from("cancellation_runs")
      .insert({
        account_id: account.id,
        initiated_by_user_id: caller.userId,
        initiated_by_email: caller.email,
        initiated_by_role: isStaff ? caller.role : "client",
        reason,
        scope,
        status: "running",
      })
      .select("id")
      .single();

    if (runErr || !runRow) {
      console.error("[cancel-account] Failed to create run row:", runErr);
      return new Response(
        JSON.stringify({ error: "Could not start cancellation", detail: runErr?.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    runId = runRow.id;
    recordStep("run_started", true, { run_id: runId, scope, reason });

    // ────────────────────────────────────────────────────────────────
    // STEP 1 — Cancel PayPal billing agreements for every active sub.
    // ────────────────────────────────────────────────────────────────
    let paypalCancellations = 0;
    let subscriptionsCancelled = 0;
    const cancellableStatuses = ["active", "pending", "suspended"];

    const { data: subs } = await supabase
      .from("billing_subscriptions")
      .select("id, status, paypal_subscription_id, customer_id, plan_name")
      .in("status", cancellableStatuses)
      .in("customer_id",
        // sub.customer_id → billing_customers.id → user_id → account.client_id
        (await supabase
          .from("billing_customers")
          .select("id")
          .eq("user_id", account.client_id)).data?.map((c: any) => c.id) ?? ["00000000-0000-0000-0000-000000000000"],
      );

    for (const sub of subs ?? []) {
      // 1a. PayPal cancel (only if a binding exists)
      if (sub.paypal_subscription_id) {
        try {
          const resp = await fetch(
            `${SUPABASE_URL}/functions/v1/paypal-cancel-subscription`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${SERVICE_KEY}`,
              },
              body: JSON.stringify({
                subscription_id: sub.id,
                account_id: account.id,
                reason: `cancel-account run ${runId}: ${reason}`,
              }),
            },
          );
          const ok = resp.ok;
          const text = await resp.text();
          recordStep(`paypal_cancel_${sub.id}`, ok, { http: resp.status, body: text.slice(0, 500) });
          if (ok) paypalCancellations++;
        } catch (e) {
          recordStep(`paypal_cancel_${sub.id}`, false, {
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }

      // 1b. Force-update the local status to 'cancelled' (covers the case
      //     where paypal-cancel-subscription left the row in another state,
      //     and the case where there was no PayPal binding to begin with).
      const { error: updErr } = await supabase
        .from("billing_subscriptions")
        .update({
          status: "cancelled",
          auto_billing_enabled: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", sub.id);

      if (updErr) {
        recordStep(`sub_update_${sub.id}`, false, { error: updErr.message });
      } else {
        subscriptionsCancelled++;
        recordStep(`sub_update_${sub.id}`, true, { plan: sub.plan_name });
      }

      // 1c. Trace audit row per subscription
      await supabase.from("billing_subscription_trace_audit").insert({
        subscription_id: sub.id,
        customer_id: sub.customer_id,
        action: "cancelled_by_engine",
        source_type: "cancel-account",
        source_id: runId,
        details: { reason, scope, run_id: runId },
        reason: `Cancelled via cancel-account run ${runId}`,
      }).then(() => undefined, () => undefined); // best-effort

      // 1d. Flag unpaid commissions tied to this sub for clawback review.
      try {
        const { data: commUpdated } = await supabase
          .from("sales_commissions")
          .update({ status: "clawback_pending", notes: `Auto-clawback flag — cancel-account run ${runId}` })
          .eq("subscription_id", sub.id)
          .in("status", ["pending", "pending_activation", "validated", "approved"])
          .select("id");
        const count = commUpdated?.length ?? 0;
        recordStep(`commissions_flagged_${sub.id}`, true, { count });
      } catch (e) {
        recordStep(`commissions_flagged_${sub.id}`, false, {
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    // ────────────────────────────────────────────────────────────────
    // STEP 2 — Void pending / partially-paid invoices for this account.
    // ────────────────────────────────────────────────────────────────
    let invoicesVoided = 0;
    try {
      const { data: pendingInvoices } = await supabase
        .from("billing_invoices")
        .select("id, status, balance_due")
        .in("customer_id",
          (await supabase
            .from("billing_customers")
            .select("id")
            .eq("user_id", account.client_id)).data?.map((c: any) => c.id) ?? [],
        )
        .in("status", ["pending", "partially_paid", "overdue", "draft"]);

      for (const inv of pendingInvoices ?? []) {
        const { error: voidErr } = await supabase
          .from("billing_invoices")
          .update({
            status: "void",
            balance_due: 0,
            notes: `Voided by cancel-account run ${runId}`,
            updated_at: new Date().toISOString(),
          })
          .eq("id", inv.id);
        if (!voidErr) invoicesVoided++;
      }
      recordStep("invoices_voided", true, { count: invoicesVoided });
    } catch (e) {
      recordStep("invoices_voided", false, {
        error: e instanceof Error ? e.message : String(e),
      });
    }

    // ────────────────────────────────────────────────────────────────
    // STEP 3 — Freeze active promotions and adjustments.
    // ────────────────────────────────────────────────────────────────
    let promotionsFrozen = 0;
    let adjustmentsCancelled = 0;
    try {
      const { data: promoUpd } = await supabase
        .from("account_promotions")
        .update({ is_active: false, expires_at: new Date().toISOString() })
        .eq("account_id", account.id)
        .eq("is_active", true)
        .select("id");
      promotionsFrozen = promoUpd?.length ?? 0;
      recordStep("promotions_frozen", true, { count: promotionsFrozen });
    } catch (e) {
      recordStep("promotions_frozen", false, {
        error: e instanceof Error ? e.message : String(e),
      });
    }
    try {
      const { data: adjUpd } = await supabase
        .from("account_adjustments")
        .update({ status: "cancelled" })
        .eq("account_id", account.id)
        .eq("status", "active")
        .select("id");
      adjustmentsCancelled = adjUpd?.length ?? 0;
      recordStep("adjustments_cancelled", true, { count: adjustmentsCancelled });
    } catch (e) {
      recordStep("adjustments_cancelled", false, {
        error: e instanceof Error ? e.message : String(e),
      });
    }

    // ────────────────────────────────────────────────────────────────
    // STEP 4 — Queue cancellation confirmation email.
    // ────────────────────────────────────────────────────────────────
    let emailQueued = false;
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("email, full_name, first_name, last_name")
        .eq("user_id", account.client_id)
        .maybeSingle();
      if (profile?.email) {
        const { error: emailErr } = await supabase.from("email_queue").insert({
          event_key: `cancel_account_${runId}`,
          to_email: profile.email,
          template_key: "subscription_cancellation_confirmation",
          template_vars: {
            client_name: profile.full_name || `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() || "Client",
            account_number: account.account_number,
            reason,
            subscriptions_cancelled: subscriptionsCancelled,
            invoices_voided: invoicesVoided,
            scope,
            cancellation_date: new Date().toLocaleDateString("fr-CA"),
          },
          status: "queued",
          attempts: 0,
          max_attempts: 5,
        });
        if (!emailErr) emailQueued = true;
        recordStep("email_queued", !emailErr, emailErr ? { error: emailErr.message } : { to: profile.email });
      } else {
        recordStep("email_queued", false, { reason: "no_profile_email" });
      }
    } catch (e) {
      recordStep("email_queued", false, {
        error: e instanceof Error ? e.message : String(e),
      });
    }

    // ────────────────────────────────────────────────────────────────
    // STEP 5 — If scope=full, close the account.
    //           doc_cancellation_on_account trigger fires from this UPDATE
    //           and generates the cancellation PDF automatically.
    // ────────────────────────────────────────────────────────────────
    let accountClosed = false;
    if (scope === "full") {
      try {
        const { error: closeErr } = await supabase
          .from("accounts")
          .update({ status: "closed", updated_at: new Date().toISOString() })
          .eq("id", account.id);
        if (!closeErr) {
          accountClosed = true;
          recordStep("account_closed", true, { account_id: account.id });
        } else {
          recordStep("account_closed", false, { error: closeErr.message });
        }
      } catch (e) {
        recordStep("account_closed", false, {
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    // ────────────────────────────────────────────────────────────────
    // FINALIZE the run row.
    // ────────────────────────────────────────────────────────────────
    const finalStatus = errors.length === 0 ? "completed" : "completed_with_errors";
    const durationMs = Date.now() - startedAt;
    await supabase
      .from("cancellation_runs")
      .update({
        status: finalStatus,
        steps,
        errors,
        paypal_cancellations: paypalCancellations,
        subscriptions_cancelled: subscriptionsCancelled,
        invoices_voided: invoicesVoided,
        commissions_flagged: steps
          .filter((s) => s.step.startsWith("commissions_flagged_") && s.ok)
          .reduce((acc, s) => acc + Number((s.detail as any)?.count ?? 0), 0),
        promotions_frozen: promotionsFrozen,
        adjustments_cancelled: adjustmentsCancelled,
        email_queued: emailQueued,
        account_closed: accountClosed,
        duration_ms: durationMs,
        completed_at: new Date().toISOString(),
      })
      .eq("id", runId);

    return new Response(
      JSON.stringify({
        ok: true,
        run_id: runId,
        status: finalStatus,
        scope,
        account_closed: accountClosed,
        summary: {
          paypal_cancellations: paypalCancellations,
          subscriptions_cancelled: subscriptionsCancelled,
          invoices_voided: invoicesVoided,
          promotions_frozen: promotionsFrozen,
          adjustments_cancelled: adjustmentsCancelled,
          email_queued: emailQueued,
          errors: errors.length,
        },
        duration_ms: durationMs,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[cancel-account] fatal:", err);
    reportEdgeError(err, { function: "cancel-account", run_id: runId }).catch(() => {});

    // Best-effort finalization on fatal error.
    if (runId) {
      try {
        await supabase
          .from("cancellation_runs")
          .update({
            status: "failed",
            steps,
            errors: [...errors, { fatal: err instanceof Error ? err.message : String(err) }],
            duration_ms: Date.now() - startedAt,
            completed_at: new Date().toISOString(),
          })
          .eq("id", runId);
      } catch {
        // give up — Sentry already has the failure
      }
    }

    return new Response(
      JSON.stringify({
        ok: false,
        run_id: runId,
        error: err instanceof Error ? err.message : String(err),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});