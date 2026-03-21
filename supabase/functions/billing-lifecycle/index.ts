import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { computeTaxes } from "../_shared/tax-constants.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Tax rates imported from _shared/tax-constants.ts

interface RunStats {
  subscriptions_expired: number;
  invoices_voided: number;
  renewals_generated: number;
  reminders_queued: number;
  errors_count: number;
  processed_items: unknown[];
  errors: string[];
}

function newStats(): RunStats {
  return {
    subscriptions_expired: 0,
    invoices_voided: 0,
    renewals_generated: 0,
    reminders_queued: 0,
    errors_count: 0,
    processed_items: [],
    errors: [],
  };
}

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

// ========================================
// STEP 1 — Suspend/expire subscriptions past due_date + grace period
// ══════════════════════════════════════════════════════════════════
// CANONICAL NIVRA BILLING RULE:
//   - due_date = the cycle day (billing_cycle_day of the month)
//   - J0 (due_date) → invoice becomes overdue
//   - J+5 (due_date + 5 days) → subscription SUSPENDED, invoice VOIDED
//   - No debt accumulation (prepaid model)
// ══════════════════════════════════════════════════════════════════
async function processExpirations(
  supabase: ReturnType<typeof createClient>,
  stats: RunStats,
) {
  const today = todayStr();
  const todayDate = new Date(today);

  // Find subscriptions with unpaid invoices past due_date + 5 days (grace expired)
  const graceCutoff = addDays(today, -5); // invoices with due_date <= this are past grace

  const { data: pastGraceInvoices, error } = await supabase
    .from("billing_invoices")
    .select("*, subscription:billing_subscriptions(id, status, plan_name, customer_id)")
    .in("status", ["pending", "overdue"])
    .lte("due_date", graceCutoff);

  if (error) {
    stats.errors.push(`Expiration query error: ${error.message}`);
    stats.errors_count++;
    return;
  }

  console.log(`[lifecycle] Found ${pastGraceInvoices?.length || 0} invoices past 5-day grace period`);

  for (const inv of pastGraceInvoices || []) {
    try {
      const sub = inv.subscription;
      if (!sub) continue;

      // Skip already suspended/expired
      if (sub.status !== "active" && sub.status !== "pending") {
        // Just void the invoice if still pending/overdue
        await supabase
          .from("billing_invoices")
          .update({ status: "void", updated_at: new Date().toISOString() })
          .eq("id", inv.id);
        stats.invoices_voided++;
        continue;
      }

      // Check if there's a PAID invoice for this same subscription/cycle (late payment)
      const { data: paidInvoice } = await supabase
        .from("billing_invoices")
        .select("id")
        .eq("subscription_id", sub.id)
        .eq("status", "paid")
        .eq("cycle_start_date", inv.cycle_start_date)
        .maybeSingle();

      if (paidInvoice) {
        // Already paid separately — void duplicate and skip
        await supabase
          .from("billing_invoices")
          .update({ status: "void", notes: "Duplicate — already paid" })
          .eq("id", inv.id);
        stats.invoices_voided++;
        continue;
      }

      // SUSPEND the subscription (J+5 grace expired)
      const { error: suspErr } = await supabase
        .from("billing_subscriptions")
        .update({ status: "suspended", updated_at: new Date().toISOString() })
        .eq("id", sub.id);

      if (suspErr) {
        stats.errors.push(`Failed to suspend ${sub.id}: ${suspErr.message}`);
        stats.errors_count++;
        continue;
      }

      // VOID the invoice (prepaid model — no debt)
      await supabase
        .from("billing_invoices")
        .update({
          status: "void",
          notes: `[LIFECYCLE] Service suspendu — période de grâce de 5 jours expirée (due_date: ${inv.due_date})`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", inv.id);

      stats.subscriptions_expired++;
      stats.invoices_voided++;

      stats.processed_items.push({
        action: "suspended_grace_expired",
        subscription_id: sub.id,
        invoice_id: inv.id,
        invoice_number: inv.invoice_number,
        due_date: inv.due_date,
        plan: sub.plan_name,
      });

      console.log(
        `[lifecycle] SUSPENDED subscription ${sub.id} (${sub.plan_name}), voided invoice ${inv.invoice_number} — grace period expired (due: ${inv.due_date})`,
      );
    } catch (err: unknown) {
      const msg = `Expiration error for invoice ${inv.id}: ${err instanceof Error ? err.message : String(err)}`;
      stats.errors.push(msg);
      stats.errors_count++;
      console.error(`[lifecycle] ${msg}`);
    }
  }

  // Also void any orphaned unpaid invoices for already-expired/suspended subscriptions
  const { data: orphanInvoices } = await supabase
    .from("billing_invoices")
    .select("id, invoice_number, subscription:billing_subscriptions(status)")
    .in("status", ["pending", "overdue"])
    .lte("due_date", graceCutoff);

  for (const inv of orphanInvoices || []) {
    if (inv.subscription?.status === "suspended" || inv.subscription?.status === "expired") {
      await supabase
        .from("billing_invoices")
        .update({ status: "void", updated_at: new Date().toISOString() })
        .eq("id", inv.id);
      stats.invoices_voided++;
    }
  }
}

// ========================================
// STEP 2 — Generate renewal invoices at J-3
// ANCHORED TO accounts.next_invoice_date + billing_cycle_day
// Uses generate_account_renewal_invoice RPC for atomicity
// ========================================
async function processRenewals(
  supabase: ReturnType<typeof createClient>,
  stats: RunStats,
) {
  const today = new Date();
  const targetDate = new Date();
  targetDate.setDate(today.getDate() + 3);
  const targetDateStr = targetDate.toISOString().split("T")[0];

  // Find accounts whose next_invoice_date is within 3 days
  const { data: accounts, error } = await supabase
    .from("accounts")
    .select("id, account_number, client_id, billing_cycle_day, next_invoice_date, status")
    .in("status", ["active", null])
    .lte("next_invoice_date", targetDateStr)
    .not("next_invoice_date", "is", null);

  if (error) {
    stats.errors.push(`Renewal account query error: ${error.message}`);
    stats.errors_count++;
    return;
  }

  console.log(
    `[lifecycle] Found ${accounts?.length || 0} accounts with next_invoice_date <= ${targetDateStr}`,
  );

  for (const acct of accounts || []) {
    try {
      // Call the atomic RPC to generate renewal invoice
      const { data: result, error: rpcErr } = await supabase
        .rpc("generate_account_renewal_invoice", { p_account_id: acct.id });

      if (rpcErr) {
        stats.errors.push(`RPC error for account ${acct.account_number}: ${rpcErr.message}`);
        stats.errors_count++;
        continue;
      }

      const res = result as any;

      if (res?.error) {
        if (res.error === "RENEWAL_ALREADY_EXISTS") {
          console.log(`[lifecycle] Renewal already exists for account ${acct.account_number}, skipping`);
          continue;
        }
        if (res.error === "NO_ACTIVE_SERVICES") {
          console.log(`[lifecycle] No active services for account ${acct.account_number}, skipping`);
          continue;
        }
        stats.errors.push(`Account ${acct.account_number}: ${res.error}`);
        stats.errors_count++;
        continue;
      }

      // Queue reminder email
      const { data: customer } = await supabase
        .from("billing_customers")
        .select("email, first_name, last_name")
        .eq("user_id", acct.client_id)
        .maybeSingle();

      if (customer?.email) {
        const idempotencyKey = `billing_renewal_${acct.id}_${res.cycle_start}`;
        await supabase.from("email_queue").insert({
          event_key: idempotencyKey,
          idempotency_key: idempotencyKey,
          to_email: customer.email,
          from_email: "Nivra Telecom <support@nivra-telecom.ca>",
          subject: `Nivra — Facture de renouvellement #${res.invoice_number}`,
          template_key: "invoice_created",
          template_vars: {
            client_name: `${customer.first_name} ${customer.last_name}`,
            invoice_number: res.invoice_number,
            total: Number(res.total).toFixed(2),
            amount: Number(res.total).toFixed(2),
            due_date: res.cycle_start,
            cycle_start: res.cycle_start,
            cycle_end: res.cycle_end,
          },
          status: "queued",
          attempts: 0,
          max_attempts: 3,
          max_retries: 3,
        });
      }

      stats.renewals_generated++;
      stats.processed_items.push({
        action: "renewal_created",
        account_id: acct.id,
        account_number: acct.account_number,
        invoice_number: res.invoice_number,
        total: res.total,
        lines: res.lines,
      });

      console.log(
        `[lifecycle] Created renewal ${res.invoice_number} for account ${acct.account_number} (${res.total} $)`,
      );
    } catch (err: unknown) {
      const msg = `Renewal error for account ${acct.account_number}: ${err instanceof Error ? err.message : String(err)}`;
      stats.errors.push(msg);
      stats.errors_count++;
      console.error(`[lifecycle] ${msg}`);
    }
  }

  // FALLBACK: Also process subscriptions with cycle_end_date approach
  // for subscriptions not yet linked to an account
  await processLegacyRenewals(supabase, stats);
}

// Legacy renewal for subscriptions without account linkage
async function processLegacyRenewals(
  supabase: ReturnType<typeof createClient>,
  stats: RunStats,
) {
  const targetDate = addDays(todayStr(), 3);

  const { data: subscriptions, error } = await supabase
    .from("billing_subscriptions")
    .select("*, customer:billing_customers(id, email, first_name, last_name)")
    .eq("status", "active")
    .eq("cycle_end_date", targetDate);

  if (error) return;

  for (const sub of subscriptions || []) {
    try {
      // Skip if customer is linked to an account (handled by account-based renewal)
      if (sub.customer?.id) {
        const { data: acctCheck } = await supabase
          .from("accounts")
          .select("id")
          .eq("client_id", sub.customer.id)
          .not("next_invoice_date", "is", null)
          .maybeSingle();
        // If account has user_id matching, check via billing_customers.user_id
        const { data: bcCheck } = await supabase
          .from("billing_customers")
          .select("user_id")
          .eq("id", sub.customer_id)
          .maybeSingle();
        if (bcCheck?.user_id) {
          const { data: acctByClient } = await supabase
            .from("accounts")
            .select("id")
            .eq("client_id", bcCheck.user_id)
            .maybeSingle();
          if (acctByClient) {
            console.log(`[lifecycle] Skipping legacy renewal for ${sub.id} — handled by account-based flow`);
            continue;
          }
        }
      }

      const newCycleStart = sub.cycle_end_date;
      const newCycleEnd = addDays(newCycleStart, 30);

      // Idempotency check
      const { data: existing } = await supabase
        .from("billing_invoices")
        .select("id")
        .eq("subscription_id", sub.id)
        .eq("type", "renewal")
        .eq("cycle_start_date", newCycleStart)
        .maybeSingle();

      if (existing) continue;

      const { data: invoiceNumberData } = await supabase.rpc("generate_billing_invoice_number");
      const invoiceNumber = invoiceNumberData || `INV-${Date.now()}`;

      const { data: subServices } = await supabase
        .from("billing_subscription_services")
        .select("*")
        .eq("subscription_id", sub.id)
        .eq("is_active", true);

      let subtotal: number;
      const hasServices = subServices && subServices.length > 0;
      if (hasServices) {
        subtotal = subServices.reduce((sum, svc) => sum + (Number(svc.unit_price) * (svc.quantity || 1)), 0);
      } else {
        subtotal = sub.plan_price;
      }
      const { tps: tpsAmount, tvq: tvqAmount, total } = computeTaxes(subtotal);

      const hasPayPal = !!sub.paypal_subscription_id;
      const paymentMethod = hasPayPal ? "paypal" : "interac";

      const { data: invoice, error: invErr } = await supabase
        .from("billing_invoices")
        .insert({
          subscription_id: sub.id,
          customer_id: sub.customer_id,
          invoice_number: invoiceNumber,
          type: "renewal",
          subtotal,
          tps_amount: tpsAmount,
          tvq_amount: tvqAmount,
          total,
          balance_due: total,
          currency: "CAD",
          payment_method: paymentMethod,
          status: "pending",
          cycle_start_date: newCycleStart,
          cycle_end_date: newCycleEnd,
          due_date: sub.cycle_end_date,
        })
        .select()
        .single();

      if (invErr) throw invErr;

      if (hasServices) {
        const lines = subServices.map((svc) => ({
          invoice_id: invoice.id,
          description: `${svc.service_name} – Renouvellement 30 jours`,
          unit_price: Number(svc.unit_price),
          quantity: svc.quantity || 1,
          line_total: Number(svc.unit_price) * (svc.quantity || 1),
          line_type: 'service' as const,
        }));
        await supabase.from("billing_invoice_lines").insert(lines);
      } else {
        await supabase.from("billing_invoice_lines").insert({
          invoice_id: invoice.id,
          description: `${sub.plan_name} – Renouvellement 30 jours`,
          unit_price: sub.plan_price,
          quantity: 1,
          line_total: sub.plan_price,
          line_type: 'service',
        });
      }

      if (hasPayPal) {
        try {
          await supabase.functions.invoke("paypal-charge-subscription", {
            body: { subscription_id: sub.id, invoice_id: invoice.id, amount: total },
          });
        } catch (chargeErr) {
          console.error(`[lifecycle] PayPal charge error:`, chargeErr);
        }
      }

      stats.renewals_generated++;
      stats.processed_items.push({
        action: "legacy_renewal_created",
        subscription_id: sub.id,
        invoice_number: invoiceNumber,
        total,
        plan: sub.plan_name,
      });

      console.log(`[lifecycle] Created legacy renewal ${invoiceNumber} for sub ${sub.id}`);
    } catch (err: unknown) {
      const msg = `Legacy renewal error for ${sub.id}: ${err instanceof Error ? err.message : String(err)}`;
      stats.errors.push(msg);
      stats.errors_count++;
    }
  }
}

// ========================================
// STEP 3 — Queue payment reminder emails at J-7, J-3, J-1, J0
// ========================================
async function processReminders(
  supabase: ReturnType<typeof createClient>,
  stats: RunStats,
) {
  const today = todayStr();
  const reminderOffsets = [
    { days: 7, label: "J-7", template: "payment_reminder_7days" },
    { days: 3, label: "J-3", template: "payment_reminder_3days" },
    { days: 1, label: "J-1", template: "payment_reminder_1day" },
    { days: 0, label: "J0", template: "payment_due_today" },
  ];

  for (const offset of reminderOffsets) {
    const targetDate = addDays(today, offset.days);

    const { data: invoices, error } = await supabase
      .from("billing_invoices")
      .select(
        "*, customer:billing_customers(id, email, first_name, last_name), subscription:billing_subscriptions(plan_name)",
      )
      .eq("status", "pending")
      .eq("due_date", targetDate);

    if (error) {
      stats.errors.push(`Reminder query error (${offset.label}): ${error.message}`);
      stats.errors_count++;
      continue;
    }

    for (const inv of invoices || []) {
      if (!inv.customer?.email) continue;

      const idempotencyKey = `billing_reminder_${inv.id}_${offset.label}_${today}`;

      const { data: existing } = await supabase
        .from("email_queue")
        .select("id")
        .or(`event_key.eq.${idempotencyKey},idempotency_key.eq.${idempotencyKey}`)
        .maybeSingle();

      if (existing) continue;

      const planName = inv.subscription?.plan_name || inv.notes || "Service Nivra";
      const clientName = `${inv.customer.first_name} ${inv.customer.last_name}`;

      const subjectMap: Record<string, string> = {
        "J-7": `Nivra — Rappel: votre service expire dans 7 jours (#${inv.invoice_number})`,
        "J-3": `Nivra — Rappel: renouvellement dans 3 jours (#${inv.invoice_number})`,
        "J-1": `Nivra — Dernier rappel: paiement requis demain (#${inv.invoice_number})`,
        "J0": `Nivra — Action requise aujourd'hui: renouvelez votre service (#${inv.invoice_number})`,
      };

      const { error: queueErr } = await supabase.from("email_queue").insert({
        event_key: idempotencyKey,
        idempotency_key: idempotencyKey,
        to_email: inv.customer.email,
        from_email: "Nivra Telecom <support@nivra-telecom.ca>",
        subject: subjectMap[offset.label] || `Nivra — Rappel de paiement (#${inv.invoice_number})`,
        template_key: offset.template,
        template_vars: {
          client_name: clientName,
          invoice_number: inv.invoice_number,
          plan_name: planName,
          total: inv.total?.toFixed(2),
          amount: inv.total?.toFixed(2),
          due_date: inv.due_date,
          days_remaining: offset.days,
          reminder_type: offset.label,
          cycle_start: inv.cycle_start_date,
          cycle_end: inv.cycle_end_date,
          payment_link: "https://nivra-telecom.ca/portail/facturation",
        },
        status: "queued",
        attempts: 0,
        max_attempts: 3,
        max_retries: 3,
      });

      if (queueErr) {
        stats.errors.push(
          `Reminder queue error for ${inv.invoice_number} (${offset.label}): ${queueErr.message}`,
        );
        stats.errors_count++;
      } else {
        stats.reminders_queued++;
        console.log(`[lifecycle] Queued ${offset.label} reminder for ${inv.invoice_number} → ${inv.customer.email}`);
      }
    }
  }
}

// ========================================
// STEP 4 — Cleanup: void any leftover "overdue" invoices (prepaid = no overdue)
// ========================================
async function cleanupOverdueInvoices(
  supabase: ReturnType<typeof createClient>,
  stats: RunStats,
) {
  const today = todayStr();

  const { data: overdueInvoices, error } = await supabase
    .from("billing_invoices")
    .select("id, invoice_number, due_date")
    .eq("status", "overdue")
    .lt("due_date", today);

  if (error) {
    stats.errors.push(`Overdue cleanup error: ${error.message}`);
    stats.errors_count++;
    return;
  }

  for (const inv of overdueInvoices || []) {
    const { error: voidErr } = await supabase
      .from("billing_invoices")
      .update({ status: "void" })
      .eq("id", inv.id);

    if (!voidErr) {
      stats.invoices_voided++;
      console.log(`[lifecycle] Voided overdue invoice ${inv.invoice_number}`);
    }
  }
}

// ========================================
// Main handler
// ========================================
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let mode = "daily_lifecycle";
  try {
    const body = await req.json().catch(() => ({}));
    if (body.mode === "backfill") mode = "backfill";
    if (body.mode === "manual") mode = "manual";
  } catch {
    // default mode
  }

  const stats = newStats();

  const { data: run } = await supabase
    .from("billing_automation_runs")
    .insert({ run_type: mode, status: "running" })
    .select()
    .single();

  const runId = run?.id;

  console.log(`[lifecycle] Starting ${mode} run (id: ${runId})`);

  try {
    // STEP 1: Process expirations
    await processExpirations(supabase, stats);

    // STEP 2: Generate renewals (account-anchored + legacy fallback)
    if (mode !== "backfill") {
      await processRenewals(supabase, stats);
    }

    // STEP 3: Queue reminders
    if (mode !== "backfill") {
      await processReminders(supabase, stats);
    }

    // STEP 4: Cleanup overdue invoices
    await cleanupOverdueInvoices(supabase, stats);

    const summary = [
      `Expired: ${stats.subscriptions_expired}`,
      `Voided: ${stats.invoices_voided}`,
      `Renewals: ${stats.renewals_generated}`,
      `Reminders: ${stats.reminders_queued}`,
      `Errors: ${stats.errors_count}`,
    ].join(", ");

    if (runId) {
      await supabase
        .from("billing_automation_runs")
        .update({
          status: stats.errors_count > 0 ? "completed_with_errors" : "completed",
          completed_at: new Date().toISOString(),
          subscriptions_expired: stats.subscriptions_expired,
          invoices_voided: stats.invoices_voided,
          renewals_generated: stats.renewals_generated,
          reminders_queued: stats.reminders_queued,
          errors_count: stats.errors_count,
          processed_items: stats.processed_items,
          errors: stats.errors,
          summary,
        })
        .eq("id", runId);
    }

    console.log(`[lifecycle] Completed: ${summary}`);

    return new Response(
      JSON.stringify({ success: true, run_id: runId, mode, summary, stats }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[lifecycle] Fatal error: ${msg}`);

    if (runId) {
      await supabase
        .from("billing_automation_runs")
        .update({
          status: "failed",
          completed_at: new Date().toISOString(),
          errors: [...stats.errors, msg],
          errors_count: stats.errors_count + 1,
          summary: `FATAL: ${msg}`,
        })
        .eq("id", runId);
    }

    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
