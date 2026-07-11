import { createClient } from "npm:@supabase/supabase-js@2";
import { enqueueCommunication } from "../_shared/enqueueCommunication.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // Get all unique active customer IDs
    const { data: activeSubs, error: subsErr } = await supabase
      .from("billing_subscriptions")
      .select("customer_id")
      .eq("status", "active");

    if (subsErr) throw subsErr;
    if (!activeSubs?.length) {
      return new Response(JSON.stringify({ ok: true, sent: 0, message: "Aucun client actif" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const customerIds = [...new Set(activeSubs.map((s) => s.customer_id))];

    // Get customer info
    const { data: customers, error: custErr } = await supabase
      .from("billing_customers")
      .select("id, email, first_name, last_name, user_id")
      .in("id", customerIds);

    if (custErr) throw custErr;

    // Get account numbers from profiles
    const userIds = (customers || []).map((c) => c.user_id).filter(Boolean);
    const { data: profilesList } = await supabase
      .from("profiles")
      .select("user_id, account_number")
      .in("user_id", userIds);

    const accountByUserId: Record<string, string> = {};
    for (const p of profilesList || []) {
      accountByUserId[p.user_id] = p.account_number || "";
    }

    // Get all open/pending invoices for these customers
    const { data: invoices } = await supabase
      .from("billing_invoices")
      .select("customer_id, balance_due, due_date, status")
      .in("customer_id", customerIds)
      .in("status", ["open", "pending", "overdue"]);

    // Group invoices by customer_id
    const invoicesByCustomer: Record<string, Array<{ balance_due: number; due_date: string | null }>> = {};
    for (const inv of invoices || []) {
      if (!invoicesByCustomer[inv.customer_id]) invoicesByCustomer[inv.customer_id] = [];
      invoicesByCustomer[inv.customer_id].push(inv);
    }

    // Build email queue rows
    const emailRows = [];
    for (const bc of customers || []) {
      if (!bc.email) continue;

      const custInvoices = invoicesByCustomer[bc.id] || [];
      const totalBalance = custInvoices.reduce((sum, inv) => sum + Number(inv.balance_due || 0), 0);
      const latestDueDate = custInvoices
        .filter((i) => i.due_date)
        .sort((a, b) => new Date(b.due_date!).getTime() - new Date(a.due_date!).getTime())[0]
        ?.due_date || null;

      const accountNumber = accountByUserId[bc.user_id] || "";

      emailRows.push({
        event_key: `interac-migration-2026-06-${bc.id}`,
        to_email: bc.email,
        template_key: "interac_migration_notice",
        template_vars: {
          first_name: bc.first_name || "Client",
          last_name: bc.last_name || "",
          account_number: accountNumber,
          balance_due: totalBalance,
          has_balance: totalBalance > 0,
          due_date: latestDueDate,
          invoice_count: custInvoices.length,
        },
        status: "queued",
        max_attempts: 3,
      });
    }

    if (emailRows.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0, message: "Aucun courriel à envoyer" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let enqueued = 0;
    for (const row of emailRows) {
      try {
        await enqueueCommunication(supabase, {
          channel: "email",
          recipient: row.to_email,
          templateKey: row.template_key,
          templateVars: row.template_vars,
          idempotencyKey: row.event_key,
          maxAttempts: row.max_attempts,
        });
        enqueued++;
      } catch (e) {
        console.warn("[send-interac-migration-notice] enqueue failed", row.to_email, e);
      }
    }
    console.log(`[send-interac-migration-notice] enqueued=${enqueued}/${emailRows.length}`);

    console.log(`[send-interac-migration-notice] ✅ ${emailRows.length} courriels mis en file`);

    return new Response(
      JSON.stringify({
        ok: true,
        sent: emailRows.length,
        customers: emailRows.map((r) => ({ email: r.to_email, balance_due: r.template_vars.balance_due })),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[send-interac-migration-notice]", e);
    return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
