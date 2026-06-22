import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { computeTaxes } from "../_shared/tax-constants.ts";
import { enforceBillingRateLimit } from "../_shared/billingRateLimit.ts";
import { reportEdgeError } from "../_shared/sentry.ts";
import { suspendNivraPayPalSubscription, cancelNivraPayPalSubscription } from "../_shared/nivraPayPalSubscriptionFactory.ts";

// Test isolation: when set, all client emails are redirected to this address.
// Set via body.test_email — never persists across requests.
let _testEmailOverride: string | null = null;
function toEmail(real: string): string { return _testEmailOverride ?? real; }

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Tax rates imported from _shared/tax-constants.ts

interface RunStats {
  subscriptions_expired: number;
  invoices_voided: number;
  invoices_overdue: number;
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
    invoices_overdue: 0,
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

function formatMoneyServer(n: number): string {
  const num = isFinite(n) ? n : 0;
  return num.toLocaleString("fr-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " $";
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

// ========================================
// STEP 1 — Suspend/void subscriptions past due_date + grace period
// ══════════════════════════════════════════════════════════════════
// CANONICAL NIVRA BILLING RULE:
//   - due_date = the cycle day (billing_cycle_day of the month)
//   - J0 (due_date) → invoice becomes overdue
//   - J+5 (due_date + 5 days) → subscription SUSPENDED, invoice stays OVERDUE
//     (client can still pay to reactivate within 5 more days)
//   - J+10 (due_date + 10 days) → invoice VOIDED, no debt, no reactivation via this invoice
// ══════════════════════════════════════════════════════════════════
async function processExpirations(
  supabase: any,
  stats: RunStats,
) {
  const today = todayStr();

  const suspendCutoff = addDays(today, -5);

  const { data: pastGraceInvoices, error } = await supabase
    .from("billing_invoices")
    .select("*, subscription:billing_subscriptions(id, status, plan_name, customer_id, paypal_subscription_id), customer:billing_customers(id, email, first_name, last_name)")
    .in("status", ["pending", "overdue"])
    .lte("due_date", suspendCutoff);

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

      // Check if there's a PAID invoice for this same subscription/cycle (late payment)
      const { data: paidInvoice } = await supabase
        .from("billing_invoices")
        .select("id")
        .eq("subscription_id", sub.id)
        .eq("status", "paid")
        .eq("cycle_start_date", inv.cycle_start_date)
        .maybeSingle();

      if (paidInvoice) {
        await supabase
          .from("billing_invoices")
          .update({ status: "void", notes: "Duplicate — already paid" })
          .eq("id", inv.id);
        stats.invoices_voided++;
        continue;
      }

      const dueDate = new Date(inv.due_date);
      const daysPastDue = Math.floor((new Date(today).getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

      // J+10+: VOID the invoice (reactivation window closed)
      // P1 GAP #3+#4: Set subscription AND account status to 'cancelled' (not 'expired'/'suspended')
      if (daysPastDue >= 10) {
        // Mark subscription as cancelled (final terminal state)
        await supabase
          .from("billing_subscriptions")
          .update({
            status: "cancelled",
            auto_billing_enabled: false,
            updated_at: new Date().toISOString(),
          })
          .eq("id", sub.id);

        // Cancel PayPal subscription so no further charges occur
        if (sub.paypal_subscription_id) {
          const { success: ppOk, error: ppErr } = await cancelNivraPayPalSubscription(
            sub.paypal_subscription_id,
            `Annulé J+${daysPastDue} — fenêtre de réactivation expirée (facture ${inv.invoice_number})`,
          );
          console.log(ppOk
            ? `[lifecycle] ✓ PayPal subscription ${sub.paypal_subscription_id} cancelled`
            : `[lifecycle] ⚠ PayPal cancel failed ${sub.paypal_subscription_id}: ${ppErr}`
          );
        }

        // Mark related account as cancelled + stamp cancelled_at
        try {
          const { data: bcust } = await supabase
            .from("billing_customers")
            .select("user_id")
            .eq("id", sub.customer_id)
            .maybeSingle();
          if (bcust?.user_id) {
            await supabase
              .from("accounts")
              .update({
                status: "cancelled",
                cancelled_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq("client_id", bcust.user_id)
              .neq("status", "cancelled"); // idempotent
          }
        } catch (acctErr) {
          console.error(`[lifecycle] account cancellation error:`, acctErr);
        }

        await supabase
          .from("billing_invoices")
          .update({
            status: "void",
            notes: `[LIFECYCLE J+${daysPastDue}] Abonnement annulé — fenêtre de réactivation expirée (J+10). Aucune dette.`,
          })
          .eq("id", inv.id);

        stats.invoices_voided++;
        stats.processed_items.push({
          action: "voided_reactivation_expired",
          invoice_id: inv.id,
          invoice_number: inv.invoice_number,
          due_date: inv.due_date,
          days_past_due: daysPastDue,
        });

        // Queue void notification email (J+10)
        if (inv.customer?.email) {
          const voidKey = `billing_voided_${inv.id}`;
          const { data: existingVoid } = await supabase
            .from("email_queue")
            .select("id")
            .or(`event_key.eq.${voidKey},idempotency_key.eq.${voidKey}`)
            .maybeSingle();
          if (!existingVoid) {
            await supabase.from("email_queue").insert({
              event_key: voidKey,
              idempotency_key: voidKey,
              to_email: toEmail(inv.customer.email),
              from_email: "Nivra Telecom <support@nivra-telecom.ca>",
              subject: `Nivra — Facture annulée (#${inv.invoice_number})`,
              template_key: "invoice_voided",
              template_vars: {
                client_name: `${inv.customer.first_name} ${inv.customer.last_name}`,
                invoice_number: inv.invoice_number,
                plan_name: sub.plan_name || "Service Nivra",
                total: inv.total?.toFixed(2),
                due_date: inv.due_date,
                void_reason: "Fenêtre de réactivation expirée (J+10)",
              },
              status: "queued",
              attempts: 0,
              max_attempts: 3,
            });
            stats.reminders_queued++;
          }
        }

        // P0 GAP #8 — Admin alert (J+10 cancellation)
        await queueAdminAlert(
          supabase,
          "admin_alert_cancelled",
          {
            client_full_name: `${inv.customer?.first_name || ""} ${inv.customer?.last_name || ""}`.trim(),
            client_email: inv.customer?.email || "",
            account_number: "—",
            invoice_number: inv.invoice_number,
            total: inv.total?.toFixed(2),
            amount: inv.total?.toFixed(2),
            due_date: inv.due_date,
          },
          `admin_cancelled_${inv.id}`,
        );

        console.log(`[lifecycle] VOIDED invoice ${inv.invoice_number} at J+${daysPastDue} — reactivation window expired`);
        continue;
      }

      // J+5 to J+9: SUSPEND subscription, keep invoice OVERDUE
      if (sub.status === "active" || sub.status === "pending") {
        const { error: suspErr } = await supabase
          .from("billing_subscriptions")
          .update({ status: "suspended", updated_at: new Date().toISOString() })
          .eq("id", sub.id);

        if (suspErr) {
          stats.errors.push(`Failed to suspend ${sub.id}: ${suspErr.message}`);
          stats.errors_count++;
          continue;
        }

        // Suspend PayPal subscription so no further charges occur
        if (sub.paypal_subscription_id) {
          const { success: ppOk, error: ppErr } = await suspendNivraPayPalSubscription(
            sub.paypal_subscription_id,
            `Non-paiement — suspendu J+${daysPastDue} (facture ${inv.invoice_number})`,
          );
          if (ppOk) {
            console.log(`[lifecycle] ✓ PayPal subscription ${sub.paypal_subscription_id} suspended`);
          } else {
            console.error(`[lifecycle] ⚠ PayPal suspend failed ${sub.paypal_subscription_id}: ${ppErr}`);
            stats.errors.push(`PayPal suspend failed for sub ${sub.id}: ${ppErr}`);
          }
        }

        if (inv.status === "pending") {
          await supabase
            .from("billing_invoices")
            .update({
              status: "overdue",
              notes: `[LIFECYCLE J+${daysPastDue}] Service suspendu — facture payable pour réactivation (void à J+10)`,
            })
            .eq("id", inv.id);
        }

        stats.subscriptions_expired++;
        stats.processed_items.push({
          action: "suspended_grace_expired",
          subscription_id: sub.id,
          invoice_id: inv.id,
          invoice_number: inv.invoice_number,
          due_date: inv.due_date,
          days_past_due: daysPastDue,
          plan: sub.plan_name,
        });

        // Queue suspension notification email (J+5, once per invoice)
        if (inv.customer?.email) {
          const suspKey = `billing_suspended_${inv.id}`;
          const { data: existingSusp } = await supabase
            .from("email_queue")
            .select("id")
            .or(`event_key.eq.${suspKey},idempotency_key.eq.${suspKey}`)
            .maybeSingle();
          if (!existingSusp) {
            const { buildAutoDocPdfAttachment } = await import("../_shared/pdfFromDb.ts");
            const suspPdf = await buildAutoDocPdfAttachment("suspension_notice", {
              client_email: inv.customer.email,
              first_name: inv.customer.first_name,
              last_name: inv.customer.last_name,
              service_name: sub.plan_name || "Service Nivra",
              suspension_date: today,
              amount_due: inv.total,
              invoice_numbers: [inv.invoice_number],
              reason: "Solde impayé",
            });
            await supabase.from("email_queue").insert({
              event_key: suspKey,
              idempotency_key: suspKey,
              to_email: toEmail(inv.customer.email),
              from_email: "Nivra Telecom <support@nivra-telecom.ca>",
              subject: `Nivra — Service suspendu (#${inv.invoice_number})`,
              template_key: "service_suspended",
              template_vars: {
                client_name: `${inv.customer.first_name} ${inv.customer.last_name}`,
                invoice_number: inv.invoice_number,
                plan_name: sub.plan_name || "Service Nivra",
                total: inv.total?.toFixed(2),
                amount: inv.total?.toFixed(2),
                due_date: inv.due_date,
                suspension_date: today,
                void_date: addDays(inv.due_date, 10),
                reactivation_window: "5 jours",
                payment_link: "https://nivra-telecom.ca/portail/facturation",
              },
              attachments: suspPdf ? [suspPdf] : null,
              status: "queued",
              attempts: 0,
              max_attempts: 3,
            });
            stats.reminders_queued++;
          }
        }

        // P0 GAP #8 — Admin alert (J+5 suspension)
        await queueAdminAlert(
          supabase,
          "admin_alert_suspended",
          {
            client_full_name: `${inv.customer?.first_name || ""} ${inv.customer?.last_name || ""}`.trim(),
            client_email: inv.customer?.email || "",
            account_number: "—",
            invoice_number: inv.invoice_number,
            total: inv.total?.toFixed(2),
            amount: inv.total?.toFixed(2),
            due_date: inv.due_date,
            void_date: addDays(inv.due_date, 10),
          },
          `admin_suspended_${inv.id}`,
        );

        console.log(
          `[lifecycle] SUSPENDED subscription ${sub.id} (${sub.plan_name}), invoice ${inv.invoice_number} stays OVERDUE — reactivation until J+10`,
        );
      }
    } catch (err) {
      const msg = `Expiration error for invoice ${inv.id}: ${err instanceof Error ? err.message : String(err)}`;
      stats.errors.push(msg);
      stats.errors_count++;
      console.error(`[lifecycle] ${msg}`);
    }
  }
}

// ========================================
// ADMIN ALERTS — P0 GAP #8
// Sends alert emails to admin recipients (suspension, cancellation)
// ========================================
const ADMIN_ALERT_RECIPIENTS = ["support@nivra-telecom.ca"];

async function queueAdminAlert(
  supabase: any,
  templateKey: "admin_alert_suspended" | "admin_alert_cancelled",
  vars: Record<string, unknown>,
  uniqueKey: string,
) {
  for (const recipient of ADMIN_ALERT_RECIPIENTS) {
    const eventKey = `${uniqueKey}_${recipient}`;
    try {
      const { data: existing } = await supabase
        .from("email_queue")
        .select("id")
        .or(`event_key.eq.${eventKey},idempotency_key.eq.${eventKey}`)
        .maybeSingle();
      if (existing) continue;

      await supabase.from("email_queue").insert({
        event_key: eventKey,
        idempotency_key: eventKey,
        to_email: recipient,
        from_email: "Nivra Telecom <support@nivra-telecom.ca>",
        subject:
          templateKey === "admin_alert_suspended"
            ? `🔴 Service suspendu — ${vars.client_full_name || "Client"}`
            : `⚫ Abonnement annulé — ${vars.client_full_name || "Client"}`,
        template_key: templateKey,
        template_vars: vars,
        status: "queued",
        attempts: 0,
        max_attempts: 3,
      });
    } catch (e) {
      console.error(`[lifecycle] queueAdminAlert error (${recipient}):`, e);
    }
  }
}

// ========================================
// P0 GAP #1 — J+2 suspension warning email
// Sent 2 days after due_date when invoice is still overdue (3 days before J+5 suspension)
// Threshold lowered from J+3 → J+2 per ops request: clients should hear from
// recouvrement faster when an invoice goes unpaid.
// ========================================
async function processSuspensionWarningJ3(
  supabase: any,
  stats: RunStats,
  today: string,
) {
  const targetDueDate = addDays(today, -2); // due_date was 2 days ago

  const { data: invoices, error } = await supabase
    .from("billing_invoices")
    .select(
      "id, invoice_number, total, due_date, customer:billing_customers(id, email, first_name, last_name)",
    )
    .eq("status", "overdue")
    .eq("due_date", targetDueDate);

  if (error) {
    stats.errors.push(`J+2 warning query error: ${error.message}`);
    stats.errors_count++;
    return;
  }

  console.log(`[lifecycle] Found ${invoices?.length || 0} invoices at J+2 needing suspension warning`);

  for (const inv of invoices || []) {
    if (!inv.customer?.email) continue;

    // Keep the legacy event_key prefix so we don't double-send to customers
    // who already received the J+3 version on a previous run.
    const eventKey = `billing_warning_j3_${inv.id}`;
    const { data: existing } = await supabase
      .from("email_queue")
      .select("id")
      .or(`event_key.eq.${eventKey},idempotency_key.eq.${eventKey}`)
      .maybeSingle();
    if (existing) continue;

    const suspensionDate = addDays(inv.due_date as string, 5);
    const { error: queueErr } = await supabase.from("email_queue").insert({
      event_key: eventKey,
      idempotency_key: eventKey,
      to_email: inv.customer.email,
      from_email: "Nivra Telecom <support@nivra-telecom.ca>",
      subject: `Rappel: votre facture Nivra (#${inv.invoice_number})`,
      template_key: "invoice_suspension_warning",
      template_vars: {
        client_name: `${inv.customer.first_name} ${inv.customer.last_name}`,
        invoice_number: inv.invoice_number,
        total: (inv.total as number)?.toFixed(2),
        amount: (inv.total as number)?.toFixed(2),
        due_date: inv.due_date,
        suspension_date: suspensionDate,
        payment_link: "https://nivra-telecom.ca/portail/facturation",
      },
      status: "queued",
      attempts: 0,
      max_attempts: 3,
    });

    if (queueErr) {
      stats.errors.push(`J+2 warning queue error ${inv.invoice_number}: ${queueErr.message}`);
      stats.errors_count++;
    } else {
      stats.reminders_queued++;
      console.log(`[lifecycle] Queued J+2 suspension warning for ${inv.invoice_number} → ${inv.customer.email}`);
    }
  }
}

// ========================================
// STEP 3 — Queue payment reminder emails at J-7, J-3, J-1, J0
// ========================================
async function processReminders(
  supabase: any,
  stats: RunStats,
) {
  const today = todayStr();
  const reminderOffsets = [
    { days: 7, label: "J-7", template: "payment_reminder_7days" },
    { days: 3, label: "J-3", template: "payment_reminder_3days" },
    { days: 1, label: "J-1", template: "payment_reminder_1day" },
    { days: 0, label: "J0", template: "payment_due_today" },
  ];

  // P0 GAP #1 — J+3 suspension warning (overdue 3 days, 2 days before J+5 suspension)
  await processSuspensionWarningJ3(supabase, stats, today);

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
// STEP 4 — Mark invoices OVERDUE at J0 (due_date passed, not yet J+5)
// CANONICAL RULE:
//   J0: invoice pending → overdue (service still active, payment past due)
//   J+5: handled by processExpirations → subscription suspended
//   J+10: handled by processExpirations → invoice voided
// This step fills the J0-to-J+4 gap where invoices were incorrectly
// staying "pending" even after due_date had passed.
// ========================================
async function processOverdue(
  supabase: any,
  stats: RunStats,
) {
  const today = todayStr();
  const suspendCutoff = addDays(today, -5); // J+5 boundary — handled by processExpirations

  // Find pending invoices where due_date has passed (J0+) but NOT yet J+5
  // These should be marked overdue but subscription stays active
  const { data: newlyOverdue, error } = await supabase
    .from("billing_invoices")
    .select("id, invoice_number, due_date, subscription_id, customer_id, total, customer:billing_customers(email, first_name, last_name)")
    .eq("status", "pending")
    .lte("due_date", today)        // due_date <= today (past due)
    .gt("due_date", suspendCutoff); // due_date > today-5 (not yet J+5)

  if (error) {
    stats.errors.push(`Overdue transition query error: ${error.message}`);
    stats.errors_count++;
    return;
  }

  console.log(`[lifecycle] Found ${newlyOverdue?.length || 0} invoices to mark overdue (J0 to J+4)`);

  for (const inv of newlyOverdue || []) {
    try {
      const dueDate = new Date(inv.due_date);
      const daysPastDue = Math.floor((new Date(today).getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

      // Mark invoice as overdue
      const { error: updateErr } = await supabase
        .from("billing_invoices")
        .update({
          status: "overdue",
          notes: `[LIFECYCLE J+${daysPastDue}] Paiement en retard — service actif jusqu'à J+5, suspension si non payé.`,
        })
        .eq("id", inv.id);

      if (updateErr) {
        stats.errors.push(`Failed to mark overdue ${inv.invoice_number}: ${updateErr.message}`);
        stats.errors_count++;
        continue;
      }

      // Queue overdue notification email (once, at J0)
      if (daysPastDue === 0 && inv.customer?.email) {
        const idempotencyKey = `billing_overdue_${inv.id}_J0_${today}`;
        const { data: existingEmail } = await supabase
          .from("email_queue")
          .select("id")
          .or(`event_key.eq.${idempotencyKey},idempotency_key.eq.${idempotencyKey}`)
          .maybeSingle();

        if (!existingEmail) {
          await supabase.from("email_queue").insert({
            event_key: idempotencyKey,
            idempotency_key: idempotencyKey,
            to_email: inv.customer.email,
            from_email: "Nivra Telecom <support@nivra-telecom.ca>",
            subject: `Nivra — Paiement en retard (#${inv.invoice_number})`,
            template_key: "payment_overdue",
            template_vars: {
              client_name: `${inv.customer.first_name} ${inv.customer.last_name}`,
              invoice_number: inv.invoice_number,
              total: inv.total?.toFixed(2),
              amount: inv.total?.toFixed(2),
              due_date: inv.due_date,
              suspension_date: addDays(inv.due_date, 5),
              void_date: addDays(inv.due_date, 10),
              payment_link: "https://nivra-telecom.ca/portail/facturation",
            },
            status: "queued",
            attempts: 0,
            max_attempts: 3,
              });
          stats.reminders_queued++;
        }
      }

      stats.invoices_overdue++;
      stats.processed_items.push({
        action: "marked_overdue",
        invoice_id: inv.id,
        invoice_number: inv.invoice_number,
        due_date: inv.due_date,
        days_past_due: daysPastDue,
      });

      console.log(`[lifecycle] Marked invoice ${inv.invoice_number} OVERDUE at J+${daysPastDue} — service stays active until J+5`);
    } catch (err) {
      const msg = `Overdue transition error for ${inv.id}: ${err instanceof Error ? err.message : String(err)}`;
      stats.errors.push(msg);
      stats.errors_count++;
    }
  }
}

// ========================================
// STEP 5 — Cleanup: void overdue invoices ONLY after J+10
// CANONICAL RULE: overdue invoices stay overdue from J0 to J+9.
// Subscription suspended at J+5 (processExpirations).
// Invoice voided at J+10+ (this step + processExpirations safety net).
// ========================================
async function cleanupOverdueInvoices(
  supabase: any,
  stats: RunStats,
) {
  const today = todayStr();
  const voidCutoff = addDays(today, -10); // Only void if due_date was 10+ days ago

  const { data: overdueInvoices, error } = await supabase
    .from("billing_invoices")
    .select("id, invoice_number, due_date")
    .eq("status", "overdue")
    .lte("due_date", voidCutoff);

  if (error) {
    stats.errors.push(`Overdue cleanup error: ${error.message}`);
    stats.errors_count++;
    return;
  }

  for (const inv of overdueInvoices || []) {
    const { error: voidErr } = await supabase
      .from("billing_invoices")
      .update({
        status: "void",
        notes: `[LIFECYCLE CLEANUP] Voided at J+10+ — reactivation window expired`,
      })
      .eq("id", inv.id);

    if (!voidErr) {
      stats.invoices_voided++;
      console.log(`[lifecycle] Voided overdue invoice ${inv.invoice_number} (past J+10)`);
    }
  }
}

// ========================================
// STEP 4 — Advance referral qualifying_cycles_paid when a renewal invoice is paid
// ========================================
async function advanceReferralCycles(
  supabase: any,
  stats: RunStats,
) {
  try {
    // Find client_referrals that are not yet qualified (qualifying_cycles_paid < required_cycles)
    const { data: pendingReferrals, error } = await supabase
      .from("client_referrals")
      .select("id, referrer_user_id, referred_user_id, referred_billing_customer_id, qualifying_cycles_paid, required_cycles, reward_status, reward_amount, reward_type, status")
      .in("reward_status", ["not_eligible", "pending"])
      .lt("qualifying_cycles_paid", 3);

    if (error || !pendingReferrals?.length) return;

    for (const ref of pendingReferrals) {
      try {
        // Count total paid renewal invoices for this referred customer
        const customerId = ref.referred_billing_customer_id;
        if (!customerId) continue;

        const { count: paidRenewals } = await supabase
          .from("billing_invoices")
          .select("id", { count: "exact", head: true })
          .eq("customer_id", customerId)
          .eq("type", "renewal")
          .eq("status", "paid");

        const actualCycles = Math.min(paidRenewals || 0, ref.required_cycles || 3);
        if (actualCycles <= (ref.qualifying_cycles_paid || 0)) continue;

        const isQualified = actualCycles >= (ref.required_cycles || 3);
        const updatePayload: Record<string, any> = {
          qualifying_cycles_paid: actualCycles,
          updated_at: new Date().toISOString(),
        };
        if (isQualified) {
          updatePayload.reward_status = "reward_pending";
          updatePayload.qualified_at = new Date().toISOString();
          updatePayload.status = "qualified";
        }

        await supabase
          .from("client_referrals")
          .update(updatePayload)
          .eq("id", ref.id);

        console.log(`[lifecycle] Referral ${ref.id}: cycles ${ref.qualifying_cycles_paid} → ${actualCycles}${isQualified ? " (QUALIFIED — reward_pending)" : ""}`);

        // Auto-qualify email: notify referrer that their referral is now qualified
        if (isQualified && ref.referrer_user_id) {
          try {
            const eventKey = `referral_auto_qualified_${ref.id}`;
            const { data: alreadySent } = await supabase
              .from("email_queue").select("id").eq("event_key", eventKey).limit(1).maybeSingle();
            if (!alreadySent) {
              const [{ data: referrerProfile }, { data: referredProfile }] = await Promise.all([
                supabase.from("profiles").select("email, first_name").eq("user_id", ref.referrer_user_id).maybeSingle(),
                supabase.from("profiles").select("first_name, last_name").eq("user_id", ref.referred_user_id).maybeSingle(),
              ]);
              if (referrerProfile?.email) {
                const rewardAmt = Number(ref.reward_amount ?? 25);
                const referredName = [referredProfile?.first_name, referredProfile?.last_name].filter(Boolean).join(" ") || "votre filleul";
                await supabase.from("email_queue").insert({
                  event_key: eventKey,
                  to_email: toEmail(referrerProfile.email),
                  template_key: "client_referral_qualified",
                  template_vars: {
                    first_name: referrerProfile.first_name || "Client",
                    to_email: referrerProfile.email,
                    referred_name: referredName,
                    reward_amount: new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(rewardAmt),
                  },
                  status: "queued",
                  attempts: 0,
                  max_attempts: 3,
                });
                console.log(`[lifecycle] Referral ${ref.id}: qualified email queued for ${referrerProfile.email}`);
              }
            }
          } catch (emailErr) {
            console.error(`[lifecycle] Referral ${ref.id}: email error:`, emailErr instanceof Error ? emailErr.message : emailErr);
          }
        }
      } catch (refErr) {
        const msg = `Referral cycle error ${ref.id}: ${refErr instanceof Error ? refErr.message : String(refErr)}`;
        stats.errors.push(msg);
        stats.errors_count++;
      }
    }
  } catch (err) {
    const msg = `Referral cycle step error: ${err instanceof Error ? err.message : String(err)}`;
    stats.errors.push(msg);
    stats.errors_count++;
  }
}

// ========================================
// STEP 7 — Chargeback fees engine
// CANONICAL RULE:
//   - Active chargeback (accounts.has_active_chargeback = true):
//       Apply 5% MONTHLY interest on outstanding balance_due,
//       added as a billing_invoice_lines row (line_type = 'fee')
//       on the most recent open invoice. Idempotent per calendar month
//       via accounts.chargeback_last_interest_at.
//   - Resolved chargeback (chargeback_resolved_at set, fee not yet applied):
//       Apply $15 reactivation fee + TPS/TVQ as billing_invoice_lines.
//       Idempotent via accounts.chargeback_reactivation_fee_applied_at.
// ========================================
async function processChargebackFees(
  supabase: any,
  stats: RunStats,
) {
  const today = new Date();
  const todayIso = today.toISOString();
  const monthKey = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}`;

  // ─── Part A: Monthly 5% interest on active chargebacks ──────────────────
  const { data: activeAccounts, error: cbErr } = await supabase
    .from("accounts")
    .select("id, account_number, client_id, has_active_chargeback, chargeback_opened_at, chargeback_last_interest_at")
    .eq("has_active_chargeback", true);

  if (cbErr) {
    stats.errors.push(`Chargeback fetch error: ${cbErr.message}`);
    stats.errors_count++;
  }

  for (const acct of activeAccounts || []) {
    try {
      const lastApplied = acct.chargeback_last_interest_at
        ? new Date(acct.chargeback_last_interest_at as string)
        : null;
      const lastKey = lastApplied
        ? `${lastApplied.getUTCFullYear()}-${String(lastApplied.getUTCMonth() + 1).padStart(2, "0")}`
        : null;
      if (lastKey === monthKey) continue;

      const { data: bcust } = await supabase
        .from("billing_customers")
        .select("id")
        .eq("user_id", acct.client_id as string)
        .maybeSingle();
      if (!bcust?.id) continue;

      const { data: openInvoice } = await supabase
        .from("billing_invoices")
        .select("id, invoice_number, balance_due, total, subtotal")
        .eq("customer_id", bcust.id)
        .in("status", ["pending", "overdue"])
        .order("due_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!openInvoice) continue;

      const balanceDue = Number(openInvoice.balance_due ?? openInvoice.total ?? 0);
      if (balanceDue <= 0) continue;

      const interest = Math.round(balanceDue * 0.05 * 100) / 100;
      if (interest <= 0) continue;

      const { error: lineErr } = await supabase
        .from("billing_invoice_lines")
        .insert({
          invoice_id: openInvoice.id,
          line_type: "fee",
          description: "Intérêt contestation bancaire (5%/mois)",
          quantity: 1,
          unit_price: interest,
          line_total: interest,
          metadata: {
            source: "billing_lifecycle.chargeback_interest",
            month: monthKey,
            base_amount: balanceDue,
            account_id: acct.id,
          },
        });
      if (lineErr) {
        stats.errors.push(`Chargeback interest line error (acct ${acct.account_number}): ${lineErr.message}`);
        stats.errors_count++;
        continue;
      }

      const newSubtotal = Number(openInvoice.subtotal ?? 0) + interest;
      const newTotal = Number(openInvoice.total ?? 0) + interest;
      const newBalance = Number(openInvoice.balance_due ?? 0) + interest;
      await supabase
        .from("billing_invoices")
        .update({
          subtotal: Math.round(newSubtotal * 100) / 100,
          total: Math.round(newTotal * 100) / 100,
          balance_due: Math.round(newBalance * 100) / 100,
        })
        .eq("id", openInvoice.id);

      await supabase
        .from("accounts")
        .update({
          chargeback_last_interest_at: todayIso,
          updated_at: todayIso,
        })
        .eq("id", acct.id);

      stats.processed_items.push({
        action: "chargeback_interest_applied",
        account_id: acct.id,
        account_number: acct.account_number,
        invoice_id: openInvoice.id,
        invoice_number: openInvoice.invoice_number,
        month: monthKey,
        base_amount: balanceDue,
        interest,
      });

      console.log(
        `[lifecycle] Chargeback interest +${interest}$ applied to ${openInvoice.invoice_number} (acct ${acct.account_number}, ${monthKey})`,
      );
    } catch (err) {
      stats.errors.push(`Chargeback interest error: ${err instanceof Error ? err.message : String(err)}`);
      stats.errors_count++;
    }
  }

  // ─── Part B: $15 reactivation fee on resolved chargebacks ───────────────
  const { data: resolvedAccounts, error: resErr } = await supabase
    .from("accounts")
    .select("id, account_number, client_id, chargeback_resolved_at, chargeback_reactivation_fee_applied_at")
    .eq("has_active_chargeback", false)
    .not("chargeback_resolved_at", "is", null)
    .is("chargeback_reactivation_fee_applied_at", null);

  if (resErr) {
    stats.errors.push(`Chargeback resolved fetch error: ${resErr.message}`);
    stats.errors_count++;
  }

  const REACT_FEE = 15;
  const { tps: reactTps, tvq: reactTvq, total: reactTotal } = computeTaxes(REACT_FEE);

  for (const acct of resolvedAccounts || []) {
    try {
      const { data: bcust } = await supabase
        .from("billing_customers")
        .select("id")
        .eq("user_id", acct.client_id as string)
        .maybeSingle();
      if (!bcust?.id) continue;

      const { data: targetInvoice } = await supabase
        .from("billing_invoices")
        .select("id, invoice_number, subtotal, tps_amount, tvq_amount, total, balance_due, status")
        .eq("customer_id", bcust.id)
        .in("status", ["pending", "overdue", "paid"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!targetInvoice) {
        console.log(`[lifecycle] No invoice to attach reactivation fee for ${acct.account_number}`);
        continue;
      }

      const { error: lineErr } = await supabase
        .from("billing_invoice_lines")
        .insert({
          invoice_id: targetInvoice.id,
          line_type: "fee",
          description: "Frais de réactivation — Résolution contestation bancaire",
          quantity: 1,
          unit_price: REACT_FEE,
          line_total: REACT_FEE,
          metadata: {
            source: "billing_lifecycle.chargeback_reactivation",
            account_id: acct.id,
            tps: reactTps,
            tvq: reactTvq,
            total_with_tax: reactTotal,
          },
        });
      if (lineErr) {
        stats.errors.push(`Chargeback reactivation line error: ${lineErr.message}`);
        stats.errors_count++;
        continue;
      }

      if (targetInvoice.status !== "paid") {
        const newSubtotal = Number(targetInvoice.subtotal ?? 0) + REACT_FEE;
        const newTps = Number(targetInvoice.tps_amount ?? 0) + reactTps;
        const newTvq = Number(targetInvoice.tvq_amount ?? 0) + reactTvq;
        const newTotal = Number(targetInvoice.total ?? 0) + reactTotal;
        const newBalance = Number(targetInvoice.balance_due ?? 0) + reactTotal;
        await supabase
          .from("billing_invoices")
          .update({
            subtotal: Math.round(newSubtotal * 100) / 100,
            tps_amount: Math.round(newTps * 100) / 100,
            tvq_amount: Math.round(newTvq * 100) / 100,
            total: Math.round(newTotal * 100) / 100,
            balance_due: Math.round(newBalance * 100) / 100,
          })
          .eq("id", targetInvoice.id);
      }

      await supabase
        .from("accounts")
        .update({
          chargeback_reactivation_fee_applied_at: todayIso,
          updated_at: todayIso,
        })
        .eq("id", acct.id);

      stats.processed_items.push({
        action: "chargeback_reactivation_fee_applied",
        account_id: acct.id,
        account_number: acct.account_number,
        invoice_id: targetInvoice.id,
        invoice_number: targetInvoice.invoice_number,
        fee: REACT_FEE,
        tps: reactTps,
        tvq: reactTvq,
        total: reactTotal,
      });

      console.log(
        `[lifecycle] Chargeback reactivation fee ${reactTotal}$ applied to ${targetInvoice.invoice_number} (acct ${acct.account_number})`,
      );
    } catch (err) {
      stats.errors.push(`Chargeback reactivation error: ${err instanceof Error ? err.message : String(err)}`);
      stats.errors_count++;
    }
  }
}

// ========================================
// STEP 2 — Formal demand at J+7 (after suspension at J+5, before void at J+10)
// Idempotent via event_key: billing_demande_<invoice_id>
// ========================================
async function processFormalDemandJ7(
  supabase: any,
  stats: RunStats,
) {
  const today = todayStr();
  const j7 = addDays(today, -7);

  const { data: invoices, error } = await supabase
    .from("billing_invoices")
    .select("id, invoice_number, total, due_date, customer:billing_customers(id, email, first_name, last_name)")
    .eq("status", "overdue")
    .eq("due_date", j7);

  if (error) {
    stats.errors.push(`FormalDemandJ7 query error: ${error.message}`);
    stats.errors_count++;
    return;
  }
  if (!invoices?.length) return;

  for (const inv of invoices) {
    try {
      const customer = inv.customer;
      if (!customer?.email) continue;

      const eventKey = `billing_demande_${inv.id}`;
      const { data: existing } = await supabase
        .from("email_queue")
        .select("id")
        .eq("event_key", eventKey)
        .maybeSingle();
      if (existing) continue;

      const { buildAutoDocPdfAttachment } = await import("../_shared/pdfFromDb.ts");
      const voidDate = addDays(inv.due_date, 10);
      const demandPdf = await buildAutoDocPdfAttachment("formal_demand", {
        client_email: customer.email,
        first_name: customer.first_name,
        last_name: customer.last_name,
        invoice_number: inv.invoice_number,
        total_due: Number(inv.total || 0),
        void_date: voidDate,
      }).catch(() => null);

      await supabase.from("email_queue").insert({
        to_email: toEmail(customer.email),
        template_key: "formal_demand_notice",
        template_vars: {
          first_name: customer.first_name || "Client",
          to_email: customer.email,
          invoice_number: inv.invoice_number,
          total_due: Number(inv.total || 0),
          response_deadline: voidDate,
          void_date: voidDate,
        },
        attachments: demandPdf ? [demandPdf] : null,
        event_key: eventKey,
        status: "queued",
        priority: 1,
      });

      stats.reminders_queued++;
    } catch (err) {
      stats.errors.push(`FormalDemandJ7 error (invoice ${inv.id}): ${err instanceof Error ? err.message : String(err)}`);
      stats.errors_count++;
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

  const rl = await enforceBillingRateLimit(req, "billing-lifecycle", corsHeaders);
  if (rl) return rl;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase: any = createClient<any>(supabaseUrl, supabaseServiceKey);

  let mode = "daily_lifecycle";
  try {
    const body = await req.json().catch(() => ({}));
    if (body.mode === "backfill") mode = "backfill";
    if (body.mode === "manual") mode = "manual";
    _testEmailOverride = typeof body.test_email === "string" ? body.test_email : null;
  } catch (_e) {
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
    // STEP 1: Process expirations (J+5 suspend, J+10 void)
    await processExpirations(supabase, stats);

    // STEP 2: Formal demand at J+7 (after suspension, before void)
    if (mode !== "backfill") {
      await processFormalDemandJ7(supabase, stats);
    }

    // STEP 3: Queue payment reminders (J-7, J-3, J-1, J0)
    if (mode !== "backfill") {
      await processReminders(supabase, stats);
    }

    // STEP 4: Mark invoices OVERDUE at J0 (pending → overdue, service stays active)
    await processOverdue(supabase, stats);

    // STEP 5: Advance referral qualifying cycles for paid invoices
    await advanceReferralCycles(supabase, stats);

    // STEP 6: Cleanup — void overdue invoices past J+10 (safety net)
    await cleanupOverdueInvoices(supabase, stats);

    // STEP 7: Chargeback fees engine (5%/month interest + $15 reactivation fee)
    await processChargebackFees(supabase, stats);

    const summary = [
      `Expired: ${stats.subscriptions_expired}`,
      `Voided: ${stats.invoices_voided}`,
      `Overdue: ${stats.invoices_overdue}`,
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
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[lifecycle] Fatal error: ${msg}`);

    // Alert ops via Sentry — lifecycle failing silently was a long-standing
    // pain point. Now any fatal in the daily cron pages immediately.
    reportEdgeError(error, {
      function: "billing-lifecycle",
      run_id: runId,
      partial_stats: stats,
    }).catch(() => {});

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
