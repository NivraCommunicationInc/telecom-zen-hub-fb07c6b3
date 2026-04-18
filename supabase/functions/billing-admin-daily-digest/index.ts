/**
 * billing-admin-daily-digest — P0 GAP #8
 *
 * Sends a daily digest email (8h AM) to admin recipients
 * if there are any overdue accounts. Groups by:
 *   - Warning (J0–J+2)
 *   - Urgent  (J+3–J+4)
 *   - Suspended (J+5+)
 *
 * Idempotent per UTC day.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ADMIN_RECIPIENTS = ["support@nivra-telecom.ca", "nivratelecom@gmail.com"];

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function daysBetween(dateStr: string, today: Date): number {
  const d = new Date(dateStr);
  return Math.floor((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const today = todayStr();
  const todayDate = new Date(today);

  try {
    // Fetch all overdue invoices
    const { data: overdue, error } = await supabase
      .from("billing_invoices")
      .select("id, invoice_number, total, due_date, status")
      .in("status", ["overdue", "pending"])
      .lte("due_date", today);

    if (error) throw error;

    const list = overdue || [];
    if (list.length === 0) {
      console.log("[digest] No overdue accounts — skipping email");
      return new Response(
        JSON.stringify({ success: true, sent: false, reason: "no_overdue" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let warning = 0; // J0–J+2
    let urgent = 0; // J+3–J+4
    let suspended = 0; // J+5+
    let totalAmount = 0;

    for (const inv of list) {
      const days = daysBetween(inv.due_date as string, todayDate);
      const amt = Number(inv.total || 0);
      totalAmount += amt;
      if (days >= 5) suspended++;
      else if (days >= 3) urgent++;
      else if (days >= 0) warning++;
    }

    // Idempotent per day
    const eventKeyBase = `admin_digest_overdue_${today}`;
    let queued = 0;

    for (const recipient of ADMIN_RECIPIENTS) {
      const eventKey = `${eventKeyBase}_${recipient}`;
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
        subject: `📊 Rapport souffrance — ${list.length} compte${list.length > 1 ? "s" : ""} en retard`,
        template_key: "admin_overdue_daily_digest",
        template_vars: {
          report_date: today,
          total_overdue_count: list.length,
          warning_count: warning,
          urgent_count: urgent,
          suspended_count: suspended,
          total_amount_overdue: totalAmount.toFixed(2),
        },
        status: "queued",
        attempts: 0,
        max_attempts: 3,
      });
      queued++;
    }

    console.log(`[digest] Queued ${queued} digest emails (overdue=${list.length})`);

    return new Response(
      JSON.stringify({
        success: true,
        sent: queued > 0,
        recipients: queued,
        overdue_total: list.length,
        warning,
        urgent,
        suspended,
        total_amount: totalAmount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[digest] error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
