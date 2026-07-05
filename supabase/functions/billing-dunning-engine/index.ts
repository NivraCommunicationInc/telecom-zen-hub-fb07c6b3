/**
 * billing-dunning-engine — Sequenced dunning: J+3 / J+7 / J+14
 *
 * Cron: 0 9 * * * (daily at 09:00 UTC)
 *
 * For each invoice with status='overdue' or 'failed':
 *   J+3  → Soft reminder email
 *   J+7  → Urgent email
 *   J+14 → Final email + suspend subscription
 *
 * Idempotent: checks activity_logs to avoid re-sending today's actions.
 * All emails go through email_queue (never direct Resend).
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { recordHeartbeat } from "../_shared/cronHeartbeat.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function daysDiff(dateStr: string): number {
  const date = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const headers = { ...corsHeaders, "Content-Type": "application/json" };
  const _cronStartedAt = new Date();


  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    let testEmailOverride: string | null = null;
    try {
      const body = await req.json().catch(() => ({}));
      if (typeof body.test_email === "string") testEmailOverride = body.test_email;
    } catch { /* */ }

    const todayStr = new Date().toISOString().split("T")[0];

    const { data: invoices, error: invErr } = await supabase
      .from("billing_invoices")
      .select(`
        id, invoice_number, total, balance_due, status, due_date, created_at,
        customer_id,
        customer:billing_customers(id, email, first_name, last_name, user_id),
        subscription_id
      `)
      .in("status", ["overdue", "failed"])
      .gt("balance_due", 0);

    if (invErr) throw invErr;

    const results = {
      processed: 0,
      actions: [] as string[],
      skipped: 0,
      errors: [] as string[],
    };

    for (const inv of invoices || []) {
      try {
        const customer = inv.customer as any;
        if (!customer?.email) { results.skipped++; continue; }

        const refDate = inv.due_date || inv.created_at;
        const daysOverdue = daysDiff(refDate);

        let actionType: "j3_soft" | "j7_urgent" | "j14_final" | null = null;
        if (daysOverdue >= 14) actionType = "j14_final";
        else if (daysOverdue >= 7) actionType = "j7_urgent";
        else if (daysOverdue >= 3) actionType = "j3_soft";

        if (!actionType) { results.skipped++; continue; }

        // Idempotency via activity_logs
        const { data: existingLog } = await supabase
          .from("activity_logs")
          .select("id")
          .eq("entity_type", "billing_invoice")
          .eq("entity_id", inv.id)
          .eq("action", `dunning_${actionType}`)
          .gte("created_at", `${todayStr}T00:00:00Z`)
          .maybeSingle();

        if (existingLog) { results.skipped++; continue; }

        const clientName = `${customer.first_name || ""} ${customer.last_name || ""}`.trim() || "Client";
        const amountFmt = Number(inv.balance_due || inv.total).toLocaleString("fr-CA", { style: "currency", currency: "CAD" });
        const toEmailAddr = testEmailOverride ?? customer.email;

        // Also idempotency via email_queue event_key
        const eventKey = `billing_dunning_${inv.id}_${actionType}_${todayStr}`;
        const { data: existingQueue } = await supabase
          .from("email_queue")
          .select("id")
          .eq("event_key", eventKey)
          .maybeSingle();
        if (existingQueue) { results.skipped++; continue; }

        let templateKey: string;
        let subject: string;
        let templateVars: Record<string, any>;

        if (actionType === "j3_soft") {
          templateKey = "billing_dunning_j3";
          subject = `Rappel de paiement — ${inv.invoice_number}`;
          templateVars = {
            first_name: customer.first_name || "Client",
            invoice_number: inv.invoice_number,
            amount: amountFmt,
            days_overdue: daysOverdue,
          };
        } else if (actionType === "j7_urgent") {
          templateKey = "billing_dunning_j7";
          subject = `URGENT — Facture ${inv.invoice_number} en retard`;
          templateVars = {
            first_name: customer.first_name || "Client",
            invoice_number: inv.invoice_number,
            amount: amountFmt,
            days_overdue: daysOverdue,
          };
        } else {
          templateKey = "billing_dunning_j14";
          subject = `Avis final — Service suspendu · ${inv.invoice_number}`;
          templateVars = {
            first_name: customer.first_name || "Client",
            invoice_number: inv.invoice_number,
            amount: amountFmt,
            days_overdue: daysOverdue,
          };
        }

        // Queue email via email_queue (never direct Resend)
        const { error: qErr } = await supabase.from("email_queue").insert({
          event_key: eventKey,
          idempotency_key: eventKey,
          to_email: toEmailAddr,
          from_email: "Nivra Telecom <facturation@nivra-telecom.ca>",
          subject,
          template_key: templateKey,
          template_vars: templateVars,
          status: "queued",
          attempts: 0,
          max_attempts: 3,
          priority: actionType === "j14_final" ? 1 : 0,
        });

        if (qErr) {
          results.errors.push(`Invoice ${inv.id}: email queue error: ${qErr.message}`);
          continue;
        }

        // Suspend subscription at J+14
        if (actionType === "j14_final" && inv.subscription_id) {
          await supabase
            .from("billing_subscriptions")
            .update({
              status: "suspended",
              suspension_reason: `Non-paiement — facture ${inv.invoice_number} (${daysOverdue} jours de retard)`,
              suspension_date: todayStr,
              updated_at: new Date().toISOString(),
            })
            .eq("id", inv.subscription_id);
        }

        // Log action in activity_logs (idempotency key)
        await supabase.from("activity_logs").insert({
          entity_type: "billing_invoice",
          entity_id: inv.id,
          action: `dunning_${actionType}`,
          actor_name: "billing-dunning-engine",
          actor_role: "system",
          user_id: customer.user_id || "00000000-0000-0000-0000-000000000000",
          details: {
            invoice_number: inv.invoice_number,
            days_overdue: daysOverdue,
            amount: inv.balance_due || inv.total,
            customer_email: customer.email,
            template_key: templateKey,
            subscription_suspended: actionType === "j14_final" && !!inv.subscription_id,
            test_mode: !!testEmailOverride,
          },
        });

        results.processed++;
        results.actions.push(`${actionType} → ${inv.invoice_number} (${daysOverdue}j)`);
      } catch (e: any) {
        results.errors.push(`Invoice ${inv.id}: ${e.message}`);
        console.error("[billing-dunning-engine] invoice error:", inv.id, e);
      }
    }

    console.log("[billing-dunning-engine] run complete", results);
    return new Response(JSON.stringify({ ok: true, ...results }), { headers });
  } catch (err) {
    console.error("[billing-dunning-engine] fatal error:", err);
    return new Response(
      JSON.stringify({ ok: false, error: err?.message || String(err) }),
      { status: 500, headers },
    );
  }
});
