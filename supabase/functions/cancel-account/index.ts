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
import { checkStaffAuth } from "../_shared/adminAuth.ts";

import { enqueueCommunication } from "../_shared/enqueueCommunication.ts";
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
      .eq("user_id", user.id);

    // Also allow admin_users (active admins)
    const { data: _adminRow } = await admin.from("admin_users").select("user_id").eq("user_id", user.id).eq("is_active", true).maybeSingle();

    const role = _adminRow
      ? "admin"
      : (roles ?? []).find((r: any) => ["admin", "supervisor", "employee"].includes(r.role))?.role ?? "client";

    return { userId: user.id, email: user.email ?? null, role };
  } catch (_e) {
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
    // Exception: if the "running" run is > 10 minutes old, treat it as stale
    // (process died mid-way) and mark it failed so a fresh run can proceed.
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
        const ageMs = Date.now() - new Date(inFlight.started_at).getTime();
        if (ageMs < 10 * 60 * 1000) {
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
        // Stale run — mark failed and proceed
        await supabase
          .from("cancellation_runs")
          .update({ status: "failed", completed_at: new Date().toISOString(), errors: [{ fatal: "stale_run_detected" }] })
          .eq("id", inFlight.id);
        console.warn(`[cancel-account] Stale run ${inFlight.id} marked failed (age ${Math.round(ageMs / 60000)}m) — starting fresh run.`);
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

    // TOCTOU mitigation: if two requests raced past the inFlight check, detect
    // the duplicate immediately after insert and discard the later run.
    {
      const { data: concurrent } = await supabase
        .from("cancellation_runs")
        .select("id, started_at")
        .eq("account_id", account.id)
        .eq("status", "running")
        .order("started_at", { ascending: true });

      if (concurrent && concurrent.length > 1) {
        const first = concurrent[0];
        if (first.id !== runRow.id) {
          await supabase
            .from("cancellation_runs")
            .update({ status: "cancelled", completed_at: new Date().toISOString() })
            .eq("id", runRow.id)
            .eq("status", "running");
          return new Response(
            JSON.stringify({ ok: true, already_running: true, run_id: first.id, message: "A cancellation is already in progress." }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      }
    }

    runId = runRow.id;
    recordStep("run_started", true, { run_id: runId, scope, reason });

    // Pre-fetch billing customer IDs once — reused in STEP 1 and STEP 2 (C2.1 fix)
    const { data: billingCustomers, error: custLookupErr } = await supabase
      .from("billing_customers")
      .select("id")
      .eq("user_id", account.client_id);
    if (custLookupErr) throw new Error(`billing_customers lookup failed: ${custLookupErr.message}`);
    const billingCustomerIds: string[] = billingCustomers?.map((c: any) => c.id) ?? [];
    if (billingCustomerIds.length === 0) {
      recordStep("billing_customer_lookup", false, { warning: "No billing_customers record found — no subscriptions or invoices to process" });
    }

    // ────────────────────────────────────────────────────────────────
    // STEP 1 — Cancel active subscriptions.
    // Phase 3.C.4 : PayPal est décommissionné. Aucune annulation d'entente
    // PayPal côté API n'est plus effectuée — les paypal_subscription_id
    // historiques restent en base pour audit uniquement.
    // ────────────────────────────────────────────────────────────────
    const paypalCancellations = 0; // legacy metric kept for report shape
    let subscriptionsCancelled = 0;
    const cancellableStatuses = ["active", "pending", "suspended"];

    const subsQuery = supabase
      .from("billing_subscriptions")
      .select("id, status, customer_id, plan_name, plan_price, cycle_start_date, cycle_end_date")
      .in("status", cancellableStatuses);
    const { data: subs } = billingCustomerIds.length > 0
      ? await subsQuery.in("customer_id", billingCustomerIds)
      : { data: [] };

    for (const sub of subs ?? []) {


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

        // Also clawback field_commissions (terrain agents) tied to this subscription
        try {
          const { data: fieldUpdated } = await supabase
            .from("field_commissions")
            .update({
              status: "clawback_pending",
              notes: `Auto-clawback — cancel-account run ${runId}`,
            })
            .eq("subscription_id", sub.id)
            .in("status", ["pending", "approved"])
            .select("id");
          recordStep(`field_commissions_flagged_${sub.id}`, true, { count: fieldUpdated?.length ?? 0 });
        } catch (e) {
          recordStep(`field_commissions_flagged_${sub.id}`, false, {
            error: e instanceof Error ? e.message : String(e),
          });
        }
      } catch (e) {
        recordStep(`commissions_flagged_${sub.id}`, false, {
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    // ────────────────────────────────────────────────────────────────
    // STEP 1.5 — Prorata CREDIT for unused days on PAID renewal cycles.
    // Prepaid model: client already paid for days they will not consume.
    // We compute credit = plan_price * (daysRemaining / cycleTotalDays)
    // for each active subscription with a current cycle still running,
    // and write it as an account_adjustments(type='credit') row that
    // automatically reduces the next renewal (or stays unused if account
    // is closed in full scope).
    // ────────────────────────────────────────────────────────────────
    let prorataCreditTotal = 0;
    const todayDate = new Date();
    for (const sub of subs ?? []) {
      try {
        if (!sub.cycle_end_date || !sub.cycle_start_date) continue;
        const cycleEnd = new Date(sub.cycle_end_date);
        const cycleStart = new Date(sub.cycle_start_date);
        if (cycleEnd <= todayDate) continue; // cycle already over — nothing prepaid to refund
        const planPrice = Number((sub as any).plan_price || 0);
        if (planPrice <= 0) continue;
        const daysRemaining = Math.max(0, Math.ceil((cycleEnd.getTime() - todayDate.getTime()) / 86_400_000));
        const cycleTotalDays = Math.max(28, Math.round((cycleEnd.getTime() - cycleStart.getTime()) / 86_400_000));
        if (daysRemaining === 0) continue;
        const creditAmount = Math.round(planPrice * (daysRemaining / cycleTotalDays) * 100) / 100;
        if (creditAmount < 0.01) continue;

        const { error: credErr } = await supabase.from("account_adjustments").insert({
          account_id: account.id,
          type: "credit",
          amount: creditAmount,
          description: `Crédit prorata annulation — ${(sub as any).plan_name || "Forfait"} (${daysRemaining}/${cycleTotalDays} jours non utilisés) — run ${runId}`,
          months_total: 1,
          months_remaining: 1,
          applied_count: 0,
          status: "active",
          is_permanent: false,
          applies_to: "next_invoice",
        });
        if (credErr) {
          recordStep(`prorata_credit_${sub.id}`, false, { error: credErr.message });
        } else {
          prorataCreditTotal = Math.round((prorataCreditTotal + creditAmount) * 100) / 100;
          recordStep(`prorata_credit_${sub.id}`, true, { credit: creditAmount, days_remaining: daysRemaining, cycle_total: cycleTotalDays });
        }
      } catch (e) {
        recordStep(`prorata_credit_${sub.id}`, false, { error: e instanceof Error ? e.message : String(e) });
      }
    }
    recordStep("prorata_credits_total", true, { total: prorataCreditTotal });

    // ────────────────────────────────────────────────────────────────
    // STEP 2 — Void pending / partially-paid invoices for this account.
    // ────────────────────────────────────────────────────────────────
    let invoicesVoided = 0;
    try {
      const invoicesQuery = supabase
        .from("billing_invoices")
        .select("id, status, balance_due")
        .in("status", ["pending", "partially_paid", "overdue", "draft"]);
      const { data: pendingInvoices } = billingCustomerIds.length > 0
        ? await invoicesQuery.in("customer_id", billingCustomerIds)
        : { data: [] };

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
        const { buildAutoDocPdfAttachment } = await import("../_shared/pdfFromDb.ts");
        const cancelPdf = await buildAutoDocPdfAttachment("cancellation_confirmation", {
          client_email: profile.email,
          first_name: profile.first_name,
          last_name: profile.last_name,
          account_number: account.account_number,
          cancellation_date: new Date().toISOString(),
          reason: reason || "—",
        }).catch(() => null);
        const { error: emailErr } = await enqueueCommunication({
          channel: "email",
          templateKey: "subscription_cancellation_confirmation",
          recipient: profile.email,
          idempotencyKey: `cancel_account_${runId}`,
          templateVars: {
            client_name: profile.full_name || `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() || "Client",
            account_number: account.account_number,
            reason,
            subscriptions_cancelled: subscriptionsCancelled,
            invoices_voided: invoicesVoided,
            scope,
            cancellation_date: new Date().toLocaleDateString("fr-CA"),
          },
          attachments: cancelPdf ? [cancelPdf] : null,
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
      } catch (_e) {
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