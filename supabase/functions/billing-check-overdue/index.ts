import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * ══════════════════════════════════════════════════════════════════════
 * NIVRA BILLING RULE — CANONICAL OVERDUE & SUSPENSION LOGIC
 * ══════════════════════════════════════════════════════════════════════
 *
 * OFFICIAL RULE (immutable):
 *
 *   1. Billing cycle is anchored to the customer's service start date.
 *      Example: order on 21st → cycle day = 21st.
 *
 *   2. Renewal invoices are generated 2–3 days BEFORE the cycle day (J-3).
 *      Invoice due_date = the cycle day itself.
 *
 *   3. If invoice remains unpaid AFTER the due_date:
 *      → invoice status becomes "overdue" / balance_due.
 *
 *   4. A 5-day grace period applies after the due_date.
 *
 *   5. If still unpaid after due_date + 5 days:
 *      → service is automatically SUSPENDED.
 *      → invoice is voided (prepaid model, no debt accumulation).
 *
 * This function runs daily via CRON.
 * ══════════════════════════════════════════════════════════════════════
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    console.log(`[billing-check-overdue] Running canonical overdue check as of ${todayStr}`);

    const results = {
      marked_overdue: [] as string[],
      suspended: [] as string[],
      reminders_sent: 0,
      disputes_processed: 0,
      dispute_fees_applied: 0,
      dispute_expirations: 0,
      errors: [] as string[]
    };

    // =========================================================================
    // PART 1: DISPUTE/CHARGEBACK PROCESSING (Scenario B — separate timeline)
    // =========================================================================
    const { data: activeDisputes, error: disputeError } = await supabase
      .from("billing_system_alerts")
      .select("*")
      .eq("alert_type", "dispute_created")
      .eq("resolved", false);

    if (disputeError) {
      console.error("[billing-check-overdue] Failed to fetch disputes:", disputeError);
    } else if (activeDisputes && activeDisputes.length > 0) {
      console.log(`[billing-check-overdue] Processing ${activeDisputes.length} active disputes`);

      for (const dispute of activeDisputes) {
        try {
          const details = dispute.details as any;
          const createdAt = new Date(details.created_at || dispute.created_at);
          const daysSinceDispute = Math.floor((today.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

          // J+2: Apply 5% administrative fee
          if (daysSinceDispute >= 2 && !details.fee_applied) {
            const invoiceId = details.invoice_id;
            if (invoiceId) {
              const { data: invoice } = await supabase
                .from("billing_invoices")
                .select("total, fees")
                .eq("id", invoiceId)
                .single();

              if (invoice) {
                const adminFee = Number(invoice.total) * 0.05;
                const newFees = Number(invoice.fees || 0) + adminFee;

                await supabase
                  .from("billing_invoices")
                  .update({
                    fees: newFees,
                    notes: `[J+2 LITIGE] Frais administratifs 5%: ${adminFee.toFixed(2)}$`,
                    updated_at: new Date().toISOString(),
                  })
                  .eq("id", invoiceId);

                await supabase
                  .from("billing_system_alerts")
                  .update({
                    details: { ...details, fee_applied: true, fee_amount: adminFee },
                  })
                  .eq("id", dispute.id);

                results.dispute_fees_applied++;
                console.log(`[billing-check-overdue] Applied 5% admin fee ($${adminFee.toFixed(2)}) to invoice ${invoiceId}`);
              }
            }
          }

          // J+5: Force expire the subscription
          if (daysSinceDispute >= 5 && !details.expired) {
            const subscriptionId = details.subscription_id;
            if (subscriptionId) {
              await supabase
                .from("billing_subscriptions")
                .update({
                  status: "expired",
                  updated_at: new Date().toISOString(),
                })
                .eq("id", subscriptionId);

              await supabase
                .from("billing_system_alerts")
                .update({
                  details: { ...details, expired: true, expired_at: new Date().toISOString() },
                  resolved: true,
                  resolved_at: new Date().toISOString(),
                })
                .eq("id", dispute.id);

              results.dispute_expirations++;
              console.log(`[billing-check-overdue] Expired subscription ${subscriptionId} due to J+5 dispute rule`);
            }
          }

          results.disputes_processed++;
        } catch (err: unknown) {
          const errorMsg = `Failed to process dispute ${dispute.id}: ${err instanceof Error ? err.message : String(err)}`;
          console.error(`[billing-check-overdue] ${errorMsg}`);
          results.errors.push(errorMsg);
        }
      }
    }

    // =========================================================================
    // PART 2: CANONICAL OVERDUE PROCESSING (Scenario A — prepaid, no debt)
    // =========================================================================
    //
    // RULE:
    //   due_date = cycle day (e.g. the 21st)
    //   J0 = due_date itself → invoice becomes "overdue"
    //   J+5 = due_date + 5 days → subscription SUSPENDED, invoice VOIDED
    //
    // We find all pending invoices where due_date <= today (past due)
    // =========================================================================

    const { data: unpaidInvoices, error: fetchError } = await supabase
      .from("billing_invoices")
      .select(`
        *,
        customer:billing_customers(id, email, first_name, last_name, phone),
        subscription:billing_subscriptions(id, status, plan_name)
      `)
      .in("status", ["pending", "overdue"])
      .lte("due_date", todayStr);

    if (fetchError) throw fetchError;

    console.log(`[billing-check-overdue] Found ${unpaidInvoices?.length || 0} unpaid invoices past due_date`);

    for (const invoice of unpaidInvoices || []) {
      try {
        const dueDate = new Date(invoice.due_date);
        const daysPastDue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

        console.log(`[billing-check-overdue] Invoice ${invoice.invoice_number}: ${daysPastDue} days past due_date (${invoice.due_date})`);

        // ── J0 to J+4: Mark as overdue (grace period active) ──
        if (daysPastDue >= 0 && daysPastDue < 5 && invoice.status === "pending") {
          await supabase
            .from("billing_invoices")
            .update({
              status: "overdue",
              notes: `[J+${daysPastDue}] Facture en retard — période de grâce de 5 jours en cours`,
              updated_at: new Date().toISOString(),
            })
            .eq("id", invoice.id);

          results.marked_overdue.push(invoice.invoice_number);
          console.log(`[billing-check-overdue] Marked invoice ${invoice.invoice_number} as OVERDUE (J+${daysPastDue}, grace period)`);

          // Send overdue reminder email
          if (invoice.customer?.email) {
            const idempotencyKey = `billing_overdue_${invoice.id}_J${daysPastDue}`;
            await supabase.from("email_queue").insert({
              event_key: idempotencyKey,
              idempotency_key: idempotencyKey,
              to_email: invoice.customer.email,
              from_email: "Nivra Telecom <support@nivra-telecom.ca>",
              subject: `Nivra — Paiement en retard: facture #${invoice.invoice_number}`,
              template_key: "payment_overdue",
              template_vars: {
                client_name: `${invoice.customer.first_name} ${invoice.customer.last_name}`,
                invoice_number: invoice.invoice_number,
                plan_name: invoice.subscription?.plan_name || "Service Nivra",
                total: Number(invoice.total).toFixed(2),
                amount: Number(invoice.total).toFixed(2),
                due_date: invoice.due_date,
                days_past_due: daysPastDue,
                grace_days_remaining: 5 - daysPastDue,
                suspension_date: new Date(dueDate.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              },
              status: "queued",
              attempts: 0,
              max_attempts: 3,
              max_retries: 3,
            });
            results.reminders_sent++;
          }
        }

        // ══════════════════════════════════════════════════════════════
        // J+5: Grace period expired → SUSPEND service
        // Invoice stays OVERDUE (client can still pay to reactivate)
        // ══════════════════════════════════════════════════════════════
        if (daysPastDue >= 5 && daysPastDue < 10 && invoice.subscription?.status === "active") {
          // Suspend subscription (can be reactivated if client pays this invoice)
          await supabase
            .from("billing_subscriptions")
            .update({
              status: "suspended",
              updated_at: new Date().toISOString(),
            })
            .eq("id", invoice.subscription_id);

          // Invoice stays OVERDUE — client can still pay to reactivate
          if (invoice.status === "pending") {
            await supabase
              .from("billing_invoices")
              .update({
                status: "overdue",
                notes: `[J+${daysPastDue}] Service suspendu — la facture reste payable pour réactivation`,
                updated_at: new Date().toISOString(),
              })
              .eq("id", invoice.id);
          }

          // Send suspension email
          if (invoice.customer?.email) {
            const idempotencyKey = `billing_suspended_${invoice.id}`;
            await supabase.from("email_queue").insert({
              event_key: idempotencyKey,
              idempotency_key: idempotencyKey,
              to_email: invoice.customer.email,
              from_email: "Nivra Telecom <support@nivra-telecom.ca>",
              subject: `Nivra — Service suspendu: facture #${invoice.invoice_number}`,
              template_key: "service_suspended",
              template_vars: {
                client_name: `${invoice.customer.first_name} ${invoice.customer.last_name}`,
                invoice_number: invoice.invoice_number,
                plan_name: invoice.subscription?.plan_name || "Service Nivra",
                overdueAmount: Number(invoice.total).toFixed(2),
                suspendedDate: todayStr,
                days_past_due: daysPastDue,
                reactivation_window: "5 jours",
              },
              status: "queued",
              attempts: 0,
              max_attempts: 3,
              max_retries: 3,
            });
          }

          // Create system alert for admin visibility
          await supabase.from("billing_system_alerts").insert({
            alert_type: "subscription_suspended_nonpayment",
            entity_type: "subscription",
            entity_id: invoice.subscription_id,
            entity_reference: invoice.invoice_number,
            details: {
              invoice_id: invoice.id,
              invoice_number: invoice.invoice_number,
              customer_id: invoice.customer_id,
              amount: invoice.total,
              due_date: invoice.due_date,
              days_past_due: daysPastDue,
              suspended_at: new Date().toISOString(),
              void_scheduled_at: new Date(dueDate.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            },
          });

          results.suspended.push(invoice.invoice_number);
          console.log(`[billing-check-overdue] SUSPENDED subscription for invoice ${invoice.invoice_number} at J+${daysPastDue} — invoice stays overdue for reactivation`);
        }

        // ══════════════════════════════════════════════════════════════
        // J+10: Reactivation window expired → VOID invoice (no debt)
        // ══════════════════════════════════════════════════════════════
        if (daysPastDue >= 10 && (invoice.status === "overdue" || invoice.status === "pending")) {
          // Suspend subscription if somehow still active
          if (invoice.subscription?.status === "active") {
            await supabase
              .from("billing_subscriptions")
              .update({ status: "suspended", updated_at: new Date().toISOString() })
              .eq("id", invoice.subscription_id);
          }

          // NOW void the invoice — reactivation window closed
          await supabase
            .from("billing_invoices")
            .update({
              status: "void",
              notes: `[J+${daysPastDue}] Facture annulée — fenêtre de réactivation expirée (J+10). Modèle prépayé, aucune dette.`,
              updated_at: new Date().toISOString(),
            })
            .eq("id", invoice.id);

          results.suspended.push(invoice.invoice_number);
          console.log(`[billing-check-overdue] VOIDED invoice ${invoice.invoice_number} at J+${daysPastDue} — reactivation window expired`);
        }

        // ── J+5 reached on already-overdue invoice (subscription already suspended) ──
        if (daysPastDue >= 5 && daysPastDue < 10 && invoice.status === "overdue" && invoice.subscription?.status !== "active") {
          // Invoice stays overdue, subscription already suspended — just log
          console.log(`[billing-check-overdue] Invoice ${invoice.invoice_number} still overdue at J+${daysPastDue}, subscription already ${invoice.subscription?.status}`);
        }

      } catch (err: unknown) {
        const errorMsg = `Failed to process invoice ${invoice.invoice_number}: ${err instanceof Error ? err.message : String(err)}`;
        console.error(`[billing-check-overdue] ${errorMsg}`);
        results.errors.push(errorMsg);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        date: todayStr,
        rule: "due_date based: overdue at J0, suspended at J+5, void at J+10",
        ...results
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("[billing-check-overdue] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
