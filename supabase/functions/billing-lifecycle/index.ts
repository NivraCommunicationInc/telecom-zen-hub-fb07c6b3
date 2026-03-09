import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TPS_RATE = 0.05;
const TVQ_RATE = 0.09975;

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
// STEP 1 — Expire subscriptions past cycle_end_date
// Handles BOTH 'active' AND 'pending' statuses
// Scenario A: No debt. subscription=expired, invoice=void
// ========================================
async function processExpirations(
  supabase: ReturnType<typeof createClient>,
  stats: RunStats,
) {
  const today = todayStr();

  // Find subscriptions with cycle_end_date <= today in active OR pending status
  const { data: expired, error } = await supabase
    .from("billing_subscriptions")
    .select("*, customer:billing_customers(id, email, first_name, last_name)")
    .in("status", ["active", "pending"])
    .lte("cycle_end_date", today);

  if (error) {
    stats.errors.push(`Expiration query error: ${error.message}`);
    stats.errors_count++;
    return;
  }

  console.log(`[lifecycle] Found ${expired?.length || 0} expired subscriptions (active + pending)`);

  for (const sub of expired || []) {
    try {
      // Check if there's a PAID renewal invoice for the next cycle
      const nextCycleStart = sub.cycle_end_date;
      const { data: paidRenewal } = await supabase
        .from("billing_invoices")
        .select("id")
        .eq("subscription_id", sub.id)
        .eq("type", "renewal")
        .eq("cycle_start_date", nextCycleStart)
        .eq("status", "paid")
        .maybeSingle();

      if (paidRenewal) {
        // Renewal was paid — extend the subscription
        const newEnd = addDays(nextCycleStart, 30);
        await supabase
          .from("billing_subscriptions")
          .update({
            cycle_start_date: nextCycleStart,
            cycle_end_date: newEnd,
            status: "active",
          })
          .eq("id", sub.id);

        stats.processed_items.push({
          action: "renewed",
          subscription_id: sub.id,
          plan: sub.plan_name,
          new_cycle_end: newEnd,
        });
        console.log(`[lifecycle] Renewed subscription ${sub.id} to ${newEnd}`);
        continue;
      }

      // No paid renewal → Scenario A: expire (no debt, never "overdue")
      const { error: expErr } = await supabase
        .from("billing_subscriptions")
        .update({ status: "expired", updated_at: new Date().toISOString() })
        .eq("id", sub.id);

      if (expErr) {
        console.error(`[lifecycle] Failed to expire sub ${sub.id}:`, expErr);
        stats.errors.push(`Failed to expire ${sub.id}: ${expErr.message}`);
        stats.errors_count++;
        continue;
      }

      stats.subscriptions_expired++;

      // Void ALL unpaid invoices for this subscription (pending, overdue, draft)
      const { data: unpaidInvoices } = await supabase
        .from("billing_invoices")
        .select("id, status")
        .eq("subscription_id", sub.id)
        .in("status", ["pending", "overdue", "draft"]);

      for (const inv of unpaidInvoices || []) {
        const { error: voidErr } = await supabase
          .from("billing_invoices")
          .update({ status: "void" })
          .eq("id", inv.id);
        if (!voidErr) stats.invoices_voided++;
        else {
          stats.errors.push(`Failed to void ${inv.id}: ${voidErr.message}`);
          stats.errors_count++;
        }
      }

      // Also void any invoices linked by customer_id (for subs without subscription_id on invoice)
      const { data: customerUnpaid } = await supabase
        .from("billing_invoices")
        .select("id, status")
        .eq("customer_id", sub.customer_id)
        .in("status", ["pending", "overdue", "draft"])
        .is("subscription_id", null);

      for (const inv of customerUnpaid || []) {
        const { error: voidErr } = await supabase
          .from("billing_invoices")
          .update({ status: "void" })
          .eq("id", inv.id);
        if (!voidErr) stats.invoices_voided++;
      }

      stats.processed_items.push({
        action: "expired",
        subscription_id: sub.id,
        previous_status: sub.status,
        plan: sub.plan_name,
        customer: sub.customer?.email,
        invoices_voided: (unpaidInvoices?.length || 0) + (customerUnpaid?.length || 0),
      });

      console.log(
        `[lifecycle] Expired subscription ${sub.id} (${sub.plan_name}, was: ${sub.status}), voided ${(unpaidInvoices?.length || 0) + (customerUnpaid?.length || 0)} invoices`,
      );
    } catch (err: unknown) {
      const msg = `Expiration error for ${sub.id}: ${err instanceof Error ? err.message : String(err)}`;
      stats.errors.push(msg);
      stats.errors_count++;
      console.error(`[lifecycle] ${msg}`);
    }
  }
}

// ========================================
// STEP 2 — Generate renewal invoices at J-3
// ========================================
async function processRenewals(
  supabase: ReturnType<typeof createClient>,
  stats: RunStats,
) {
  const targetDate = addDays(todayStr(), 3);

  const { data: subscriptions, error } = await supabase
    .from("billing_subscriptions")
    .select("*, customer:billing_customers(id, email, first_name, last_name)")
    .eq("status", "active")
    .eq("cycle_end_date", targetDate);

  if (error) {
    stats.errors.push(`Renewal query error: ${error.message}`);
    stats.errors_count++;
    return;
  }

  console.log(
    `[lifecycle] Found ${subscriptions?.length || 0} subscriptions ending on ${targetDate} (J-3)`,
  );

  for (const sub of subscriptions || []) {
    try {
      const newCycleStart = sub.cycle_end_date;
      const newCycleEnd = addDays(newCycleStart, 30);

      // Idempotency: check if renewal already exists for this period
      const { data: existing } = await supabase
        .from("billing_invoices")
        .select("id")
        .eq("subscription_id", sub.id)
        .eq("type", "renewal")
        .eq("cycle_start_date", newCycleStart)
        .maybeSingle();

      if (existing) {
        console.log(`[lifecycle] Renewal already exists for ${sub.id}, skipping`);
        continue;
      }

      // Generate invoice number
      const { data: invoiceNumberData } = await supabase.rpc(
        "generate_billing_invoice_number",
      );
      const invoiceNumber = invoiceNumberData || `INV-${Date.now()}`;

      // Fetch active subscription services for multi-line invoice
      const { data: subServices } = await supabase
        .from("billing_subscription_services")
        .select("*")
        .eq("subscription_id", sub.id)
        .eq("is_active", true);

      // Calculate subtotal from individual services (or fallback to plan_price)
      let subtotal: number;
      const hasServices = subServices && subServices.length > 0;
      if (hasServices) {
        subtotal = subServices.reduce((sum, svc) => sum + (Number(svc.unit_price) * (svc.quantity || 1)), 0);
      } else {
        subtotal = sub.plan_price;
      }
      const tpsAmount = Math.round(subtotal * TPS_RATE * 100) / 100;
      const tvqAmount = Math.round(subtotal * TVQ_RATE * 100) / 100;
      const total = Math.round((subtotal + tpsAmount + tvqAmount) * 100) / 100;

      const hasPayPal = !!sub.paypal_subscription_id;
      const paymentMethod = hasPayPal ? "paypal" : "interac";

      // Create renewal invoice
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

      // Create invoice lines — one per active service, always set line_type
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

      // PayPal auto-charge if applicable
      if (hasPayPal) {
        console.log(`[lifecycle] Triggering PayPal auto-charge for ${sub.id}`);
        try {
          await supabase.functions.invoke("paypal-charge-subscription", {
            body: {
              subscription_id: sub.id,
              invoice_id: invoice.id,
              amount: total,
            },
          });
        } catch (chargeErr) {
          console.error(`[lifecycle] PayPal charge error:`, chargeErr);
        }
      }

      stats.renewals_generated++;
      stats.processed_items.push({
        action: "renewal_created",
        subscription_id: sub.id,
        invoice_number: invoiceNumber,
        total,
        plan: sub.plan_name,
        customer: sub.customer?.email,
      });

      console.log(
        `[lifecycle] Created renewal ${invoiceNumber} for ${sub.id} (${sub.plan_name})`,
      );
    } catch (err: unknown) {
      const msg = `Renewal error for ${sub.id}: ${err instanceof Error ? err.message : String(err)}`;
      stats.errors.push(msg);
      stats.errors_count++;
      console.error(`[lifecycle] ${msg}`);
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

    // Find pending invoices due on this date
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

      // Idempotency key: unique per invoice + reminder type + date
      const idempotencyKey = `billing_reminder_${inv.id}_${offset.label}_${today}`;

      // Check if already queued (by event_key OR idempotency_key)
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

    console.log(
      `[lifecycle] Processed ${offset.label} reminders: ${invoices?.length || 0} invoices checked`,
    );
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

  // Find all overdue invoices with due_date in the past — prepaid model never has overdue
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
      console.log(`[lifecycle] Voided overdue invoice ${inv.invoice_number} (prepaid cleanup)`);
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

  // Create run record
  const { data: run } = await supabase
    .from("billing_automation_runs")
    .insert({ run_type: mode, status: "running" })
    .select()
    .single();

  const runId = run?.id;

  console.log(`[lifecycle] Starting ${mode} run (id: ${runId})`);

  try {
    // STEP 1: Process expirations (active + pending with past cycle_end)
    await processExpirations(supabase, stats);

    // STEP 2: Generate renewals at J-3 (not for backfill)
    if (mode !== "backfill") {
      await processRenewals(supabase, stats);
    }

    // STEP 3: Queue reminders (not for backfill)
    if (mode !== "backfill") {
      await processReminders(supabase, stats);
    }

    // STEP 4: Cleanup any leftover overdue invoices (prepaid model)
    await cleanupOverdueInvoices(supabase, stats);

    // Update run record
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
