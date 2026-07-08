/**
 * billing-daily-overdue-reminders
 *
 * Sends ONE email PER UNPAID INVOICE PER DAY.
 * If a customer has 3 unpaid invoices, they receive 3 emails today.
 * Idempotent via overdue_reminder_log (UNIQUE on invoice_id + reminder_date).
 *
 * Each email links the customer to /portal/billing where they can pay
 * their TOTAL BALANCE through the Square/card payment flow.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { recordHeartbeat } from "../_shared/cronHeartbeat.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function daysBetween(dateStr: string, today: Date): number {
  const d = new Date(dateStr);
  return Math.floor((today.getTime() - d.getTime()) / 86400000);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase: any = createClient<any>(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const _hbStarted = new Date();
  const today = todayStr();
  const todayDate = new Date(today);

  try {
    // Fetch all unpaid (past-due or pending past due_date) invoices with customer info
    const { data: overdue, error } = await supabase
      .from("billing_invoices")
      .select(`
        id, invoice_number, total, balance_due, amount_paid, due_date, status, customer_id,
        customer:billing_customers(id, email, first_name, last_name, user_id)
      `)
      .in("status", ["overdue", "pending", "partially_paid"])
      .lte("due_date", today);

    if (error) throw error;

    const list = (overdue || []).filter((inv: any) => {
      const bal = Number(inv.balance_due ?? (inv.total - (inv.amount_paid || 0)));
      return bal > 0 && inv.customer?.email;
    });

    let queued = 0;
    let skipped = 0;

    // Pre-compute per-customer total ACCOUNT balances (same formula as ledger)
    // balance = sum(non-cancelled invoice totals) - sum(confirmed payments)
    const customerBalances = new Map<string, number>();
    const uniqueCustomerIds = Array.from(new Set(list.map((inv: any) => inv.customer_id)));
    for (const cid of uniqueCustomerIds) {
      const { data: allInv } = await supabase
        .from("billing_invoices")
        .select("total")
        .eq("customer_id", cid)
        .not("status", "in", '("cancelled","refunded","void")');
      const { data: allPay } = await supabase
        .from("billing_payments")
        .select("amount")
        .eq("customer_id", cid)
        .eq("status", "confirmed");
      const debits = (allInv || []).reduce((s, i: any) => s + (Number(i.total) || 0), 0);
      const credits = (allPay || []).reduce((s, p: any) => s + (Number(p.amount) || 0), 0);
      customerBalances.set(cid, Math.round((debits - credits) * 100) / 100);
    }

    for (const inv of list as any[]) {
      const customer = inv.customer;
      const recipient = customer.email;
      const balanceDue = Number(inv.balance_due ?? (inv.total - (inv.amount_paid || 0)));
      const totalCustomerBalance = customerBalances.get(inv.customer_id) || balanceDue;
      const daysOverdue = daysBetween(inv.due_date, todayDate);

      // Idempotency: check log
      const { data: existingLog } = await supabase
        .from("overdue_reminder_log")
        .select("id")
        .eq("invoice_id", inv.id)
        .eq("reminder_date", today)
        .maybeSingle();
      if (existingLog) { skipped++; continue; }

      const eventKey = `overdue_daily_${inv.id}_${today}`;

      // Skip if already in email_queue
      const { data: existingQueue } = await supabase
        .from("email_queue")
        .select("id")
        .or(`event_key.eq.${eventKey},idempotency_key.eq.${eventKey}`)
        .maybeSingle();
      if (existingQueue) { skipped++; continue; }

      const { data: queueRow, error: qErr } = await supabase.from("email_queue").insert({
        event_key: eventKey,
        idempotency_key: eventKey,
        to_email: recipient,
        from_email: "Nivra Telecom <support@nivra-telecom.ca>",
        subject: `Rappel — Facture ${inv.invoice_number} en attente de paiement`,
        template_key: "overdue_invoice_daily_reminder",
        template_vars: {
          customer_first_name: customer.first_name || "",
          customer_last_name: customer.last_name || "",
          invoice_number: inv.invoice_number,
          invoice_balance: balanceDue.toFixed(2),
          due_date: inv.due_date,
          days_overdue: daysOverdue,
          total_account_balance: totalCustomerBalance.toFixed(2),
          pay_balance_url: "https://nivra-telecom.ca/portal/billing",
        },
        status: "queued",
        attempts: 0,
        max_attempts: 3,
      }).select("id").maybeSingle();

      if (qErr) {
        console.error(`[reminders] enqueue failed for invoice ${inv.id}:`, qErr.message);
        continue;
      }

      // Log the reminder
      await supabase.from("overdue_reminder_log").insert({
        invoice_id: inv.id,
        customer_id: inv.customer_id,
        reminder_date: today,
        email_queue_id: queueRow?.id ?? null,
        recipient_email: recipient,
        days_overdue: daysOverdue,
        invoice_balance: balanceDue,
        total_account_balance: totalCustomerBalance,
      });

      queued++;
    }

    console.log(`[reminders] day=${today} queued=${queued} skipped=${skipped} total=${list.length}`);
    await recordHeartbeat(supabase, "billing-daily-overdue-reminders", "success", _hbStarted, { date: today, queued, skipped, total_unpaid: list.length });
    return new Response(JSON.stringify({
      success: true, date: today, queued, skipped, total_unpaid: list.length,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    const msg = err instanceof Error ? err.message : JSON.stringify(err);
    console.error("[reminders] error:", msg);
    await recordHeartbeat(supabase, "billing-daily-overdue-reminders", "error", _hbStarted, {}, msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
