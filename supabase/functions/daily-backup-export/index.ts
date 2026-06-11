/**
 * daily-backup-export — Generates daily XLSX backup of all critical business data
 * and emails it to operations contacts via Resend (with attachment).
 *
 * Triggered by pg_cron daily at 06:00 ET.
 * Deduplication: only one export per calendar day (America/Toronto).
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import * as XLSX from "npm:xlsx@0.18.5";

const RECIPIENTS = [
  "support@nivra-telecom.ca",
  "support@nivra-telecom.ca",
];

const TIMEZONE = "America/Toronto";

Deno.serve(async (req) => {
  // Accept POST from cron or manual trigger
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const supabase = createClient(supabaseUrl, serviceKey);

  // Today's date in Toronto timezone
  const today = new Date().toLocaleDateString("en-CA", { timeZone: TIMEZONE });
  const generatedAt = new Date().toISOString();

  console.log(`[DAILY-BACKUP] Starting for date: ${today}`);

  // ── DEDUPLICATION ─────────────────────────────────────────────
  const { data: existing } = await supabase
    .from("daily_backup_log")
    .select("id")
    .eq("backup_date", today)
    .eq("status", "success")
    .maybeSingle();

  if (existing) {
    console.log(`[DAILY-BACKUP] Already sent for ${today}, skipping.`);
    return new Response(JSON.stringify({ skipped: true, reason: "already_sent", date: today }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Insert a pending log row
  const { data: logRow } = await supabase
    .from("daily_backup_log")
    .insert({ backup_date: today, status: "pending", generated_at: generatedAt })
    .select("id")
    .single();
  const logId = logRow?.id;

  try {
    // ── QUERY ALL DATA ────────────────────────────────────────────

    // 1. Clients (accounts + profiles)
    const { data: accounts, error: accErr } = await supabase
      .from("accounts")
      .select("account_number, account_name, client_id, status, primary_service_address, primary_service_city, primary_service_postal_code, primary_service_province, billing_cycle_day, next_invoice_date, created_at")
      .order("created_at", { ascending: false })
      .limit(5000);
    if (accErr) throw new Error(`Accounts query failed: ${accErr.message}`);

    const clientIds = [...new Set((accounts || []).map((a: any) => a.client_id).filter(Boolean))];
    let profileMap = new Map<string, any>();
    if (clientIds.length > 0) {
      // Batch fetch profiles in chunks of 200
      for (let i = 0; i < clientIds.length; i += 200) {
        const chunk = clientIds.slice(i, i + 200);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name, email, phone")
          .in("user_id", chunk);
        for (const p of profiles || []) profileMap.set(p.user_id, p);
      }
    }

    const clientsRows = (accounts || []).map((a: any) => {
      const p = profileMap.get(a.client_id);
      return {
        "Account Number": a.account_number ?? "",
        "Account Name": a.account_name ?? p?.full_name ?? "",
        "Email": p?.email ?? "",
        "Phone": p?.phone ?? "",
        "Service Address": [a.primary_service_address, a.primary_service_city, a.primary_service_province, a.primary_service_postal_code].filter(Boolean).join(", "),
        "Status": a.status ?? "",
        "Billing Cycle Day": a.billing_cycle_day ?? "",
        "Next Invoice Date": a.next_invoice_date ?? "",
        "Created": a.created_at ?? "",
      };
    });

    // 2. Orders
    const { data: orders, error: ordErr } = await supabase
      .from("orders")
      .select("order_number, status, payment_status, service_type, order_type, created_at, environment, user_id, account_id")
      .order("created_at", { ascending: false })
      .limit(5000);
    if (ordErr) throw new Error(`Orders query failed: ${ordErr.message}`);

    const ordersRows = (orders || []).map((o: any) => ({
      "Order Number": o.order_number ?? "",
      "Status": o.status ?? "",
      "Payment Status": o.payment_status ?? "",
      "Service Type": o.service_type ?? "",
      "Order Type": o.order_type ?? "",
      "Created": o.created_at ?? "",
      "Environment": o.environment ?? "",
    }));

    // 3. Subscriptions
    const { data: subs, error: subErr } = await supabase
      .from("billing_subscriptions")
      .select("id, customer_id, plan_code, plan_name, plan_price, status, cycle_start_date, cycle_end_date, next_renewal_at, recurring_provider, recurring_setup_status, created_at, environment, order_id, service_category")
      .order("created_at", { ascending: false })
      .limit(5000);
    if (subErr) throw new Error(`Subscriptions query failed: ${subErr.message}`);

    // Fetch billing_customers for subscription customer names
    const custIds = [...new Set((subs || []).map((s: any) => s.customer_id).filter(Boolean))];
    let custMap = new Map<string, any>();
    if (custIds.length > 0) {
      for (let i = 0; i < custIds.length; i += 200) {
        const chunk = custIds.slice(i, i + 200);
        const { data: custs } = await supabase
          .from("billing_customers")
          .select("id, first_name, last_name, email, phone")
          .in("id", chunk);
        for (const c of custs || []) custMap.set(c.id, c);
      }
    }

    const subsRows = (subs || []).map((s: any) => {
      const c = custMap.get(s.customer_id);
      return {
        "Subscription ID": s.id ?? "",
        "Customer": c ? `${c.first_name} ${c.last_name}`.trim() : s.customer_id ?? "",
        "Plan": s.plan_name ?? s.plan_code ?? "",
        "Price": s.plan_price ?? "",
        "Status": s.status ?? "",
        "Category": s.service_category ?? "",
        "Cycle Start": s.cycle_start_date ?? "",
        "Cycle End": s.cycle_end_date ?? "",
        "Next Renewal": s.next_renewal_at ?? "",
        "Recurring Provider": s.recurring_provider ?? "",
        "Setup Status": s.recurring_setup_status ?? "",
        "Environment": s.environment ?? "",
        "Created": s.created_at ?? "",
      };
    });

    // 4. Invoices
    const { data: invoices, error: invErr } = await supabase
      .from("billing_invoices")
      .select("invoice_number, status, type, subtotal, tps_amount, tvq_amount, total, amount_paid, balance_due, due_date, paid_at, created_at, environment, customer_id, late_fee_applied")
      .order("created_at", { ascending: false })
      .limit(5000);
    if (invErr) throw new Error(`Invoices query failed: ${invErr.message}`);

    const invoicesRows = (invoices || []).map((inv: any) => {
      const c = custMap.get(inv.customer_id);
      return {
        "Invoice #": inv.invoice_number ?? "",
        "Customer": c ? `${c.first_name} ${c.last_name}`.trim() : "",
        "Status": inv.status ?? "",
        "Type": inv.type ?? "",
        "Subtotal": inv.subtotal ?? 0,
        "TPS": inv.tps_amount ?? 0,
        "TVQ": inv.tvq_amount ?? 0,
        "Total": inv.total ?? 0,
        "Amount Paid": inv.amount_paid ?? 0,
        "Balance Due": inv.balance_due ?? 0,
        "Due Date": inv.due_date ?? "",
        "Paid At": inv.paid_at ?? "",
        "Late Fee": inv.late_fee_applied ? "Yes" : "No",
        "Environment": inv.environment ?? "",
        "Created": inv.created_at ?? "",
      };
    });

    // 5. Payments
    const { data: payments, error: payErr } = await supabase
      .from("billing_payments")
      .select("payment_number, invoice_id, customer_id, method, status, amount, reference, provider, provider_payment_id, received_at, created_at, environment")
      .order("created_at", { ascending: false })
      .limit(5000);
    if (payErr) throw new Error(`Payments query failed: ${payErr.message}`);

    const paymentsRows = (payments || []).map((p: any) => {
      const c = custMap.get(p.customer_id);
      return {
        "Payment #": p.payment_number ?? "",
        "Customer": c ? `${c.first_name} ${c.last_name}`.trim() : "",
        "Method": p.method ?? "",
        "Status": p.status ?? "",
        "Amount": p.amount ?? 0,
        "Reference": p.reference ?? "",
        "Provider": p.provider ?? "",
        "Provider ID": p.provider_payment_id ?? "",
        "Received At": p.received_at ?? "",
        "Environment": p.environment ?? "",
        "Created": p.created_at ?? "",
      };
    });

    // 6. Summary calculations
    const activeSubs = (subs || []).filter((s: any) => s.status === "active").length;
    const pendingSubs = (subs || []).filter((s: any) => s.status === "pending").length;
    const suspendedSubs = (subs || []).filter((s: any) => s.status === "suspended").length;
    const overdueInvoices = (invoices || []).filter((i: any) => i.status === "overdue").length;
    const totalUnpaidBalance = (invoices || [])
      .filter((i: any) => !["paid", "paid_by_promo", "void", "cancelled"].includes(i.status))
      .reduce((sum: number, i: any) => sum + (i.balance_due ?? 0), 0);
    const todayPayments = (payments || []).filter((p: any) => p.created_at?.startsWith(today));
    const todayPaymentsTotal = todayPayments.reduce((sum: number, p: any) => sum + (p.amount ?? 0), 0);
    const todayOrders = (orders || []).filter((o: any) => o.created_at?.startsWith(today)).length;
    const todayActivations = (orders || []).filter((o: any) => o.status === "activated" && o.created_at?.startsWith(today)).length;

    const summaryRows = [
      { "Metric": "Date", "Value": today },
      { "Metric": "Generated At (UTC)", "Value": generatedAt },
      { "Metric": "Environment", "Value": "all" },
      { "Metric": "", "Value": "" },
      { "Metric": "Total Clients/Accounts", "Value": (accounts || []).length },
      { "Metric": "Total Active Subscriptions", "Value": activeSubs },
      { "Metric": "Total Pending Subscriptions", "Value": pendingSubs },
      { "Metric": "Total Suspended Subscriptions", "Value": suspendedSubs },
      { "Metric": "Total Overdue Invoices", "Value": overdueInvoices },
      { "Metric": "Total Unpaid Balance ($)", "Value": totalUnpaidBalance.toFixed(2) },
      { "Metric": "Total Payments Today", "Value": todayPayments.length },
      { "Metric": "Total Payment Amount Today ($)", "Value": todayPaymentsTotal.toFixed(2) },
      { "Metric": "Orders Created Today", "Value": todayOrders },
      { "Metric": "Activations Today", "Value": todayActivations },
      { "Metric": "", "Value": "" },
      { "Metric": "Row Counts", "Value": "" },
      { "Metric": "  Clients tab", "Value": clientsRows.length },
      { "Metric": "  Orders tab", "Value": ordersRows.length },
      { "Metric": "  Subscriptions tab", "Value": subsRows.length },
      { "Metric": "  Invoices tab", "Value": invoicesRows.length },
      { "Metric": "  Payments tab", "Value": paymentsRows.length },
    ];

    // ── GENERATE XLSX ──────────────────────────────────────────────
    const wb = XLSX.utils.book_new();

    const addSheet = (name: string, data: any[]) => {
      const ws = XLSX.utils.json_to_sheet(data.length > 0 ? data : [{ "No data": "" }]);
      XLSX.utils.book_append_sheet(wb, ws, name);
    };

    addSheet("Summary", summaryRows);
    addSheet("Clients", clientsRows);
    addSheet("Orders", ordersRows);
    addSheet("Subscriptions", subsRows);
    addSheet("Invoices", invoicesRows);
    addSheet("Payments", paymentsRows);

    const xlsxBuffer = XLSX.write(wb, { type: "base64", bookType: "xlsx" });
    const filename = `Nivra_Daily_Backup_${today}.xlsx`;

    console.log(`[DAILY-BACKUP] XLSX generated: ${filename}, tabs: 6`);

    // ── SEND EMAIL VIA RESEND ──────────────────────────────────────
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured — cannot send backup email.");
    }

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2 style="color: #1a1a2e;">Nivra Daily Backup — ${today}</h2>
        <p>Le fichier de sauvegarde quotidien est joint à ce courriel.</p>
        <table style="border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding: 4px 12px; font-weight: bold;">Comptes</td><td style="padding: 4px 12px;">${clientsRows.length}</td></tr>
          <tr><td style="padding: 4px 12px; font-weight: bold;">Abonnements actifs</td><td style="padding: 4px 12px;">${activeSubs}</td></tr>
          <tr><td style="padding: 4px 12px; font-weight: bold;">Factures en retard</td><td style="padding: 4px 12px;">${overdueInvoices}</td></tr>
          <tr><td style="padding: 4px 12px; font-weight: bold;">Solde impayé</td><td style="padding: 4px 12px;">${totalUnpaidBalance.toFixed(2)} $</td></tr>
          <tr><td style="padding: 4px 12px; font-weight: bold;">Paiements aujourd'hui</td><td style="padding: 4px 12px;">${todayPayments.length} (${todayPaymentsTotal.toFixed(2)} $)</td></tr>
        </table>
        <p style="color: #666; font-size: 12px;">Généré automatiquement le ${generatedAt}</p>
      </div>
    `;

    const resendPayload = {
      from: "Nivra Telecom <support@nivra-telecom.ca>",
      to: RECIPIENTS,
      subject: `Nivra Daily Backup - ${today}`,
      html: emailHtml,
      attachments: [
        {
          filename,
          content: xlsxBuffer,
        },
      ],
    };

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(resendPayload),
    });

    if (!resendRes.ok) {
      const errText = await resendRes.text();
      throw new Error(`Resend API error (${resendRes.status}): ${errText}`);
    }

    const resendResult = await resendRes.json();
    console.log(`[DAILY-BACKUP] Email sent successfully via Resend: ${resendResult.id}`);

    // ── UPDATE LOG ─────────────────────────────────────────────────
    if (logId) {
      const { error: logErr } = await supabase
        .from("daily_backup_log")
        .update({
          status: "success",
          email_id: resendResult.id,
          row_counts: {
            clients: clientsRows.length,
            orders: ordersRows.length,
            subscriptions: subsRows.length,
            invoices: invoicesRows.length,
            payments: paymentsRows.length,
          },
          completed_at: new Date().toISOString(),
        })
        .eq("id", logId);
      if (logErr) console.error("[DAILY-BACKUP] Failed to update log — deduplication may fail next run:", logErr.message);
    }

    return new Response(JSON.stringify({
      success: true,
      date: today,
      filename,
      email_id: resendResult.id,
      rows: {
        clients: clientsRows.length,
        orders: ordersRows.length,
        subscriptions: subsRows.length,
        invoices: invoicesRows.length,
        payments: paymentsRows.length,
      },
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[DAILY-BACKUP] FAILED:`, errorMsg);

    // Update log with failure
    if (logId) {
      await supabase
        .from("daily_backup_log")
        .update({ status: "failed", error_message: errorMsg, completed_at: new Date().toISOString() })
        .eq("id", logId);
    }

    // Send failure alert via Resend
    if (resendApiKey) {
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Nivra Telecom <support@nivra-telecom.ca>",
            to: RECIPIENTS,
            subject: `Nivra Daily Backup FAILED - ${today}`,
            html: `
              <div style="font-family: Arial, sans-serif; padding: 20px;">
                <h2 style="color: #dc2626;">⚠️ Daily Backup Failed</h2>
                <p><strong>Date:</strong> ${today}</p>
                <p><strong>Error:</strong></p>
                <pre style="background: #f5f5f5; padding: 12px; border-radius: 4px; overflow-x: auto;">${errorMsg}</pre>
                <p style="color: #666; font-size: 12px;">Investigate immediately — backup data not delivered.</p>
              </div>
            `,
          }),
        });
        console.log(`[DAILY-BACKUP] Failure alert sent to recipients.`);
      } catch (alertErr) {
        console.error(`[DAILY-BACKUP] Could not send failure alert:`, alertErr);
      }
    }

    return new Response(JSON.stringify({ success: false, error: errorMsg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
