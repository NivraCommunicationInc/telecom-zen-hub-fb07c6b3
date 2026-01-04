import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

// Quebec tax rates
const TPS_RATE = 0.05;
const TVQ_RATE = 0.09975;

// Grace period for payment (15 days as per Nivra policy)
const PAYMENT_GRACE_DAYS = 15;

interface Subscription {
  id: string;
  user_id: string;
  plan_name: string;
  amount: number;
  next_invoice_date: string;
  bill_cycle_day: number;
}

interface Account {
  id: string;
  client_id: string;
  billing_cycle_day: number;
  next_invoice_date: string;
  status: string;
}

interface InvoiceResult {
  client_id: string;
  invoice_id: string;
  invoice_number: string;
  total: number;
  services_count: number;
}

// ========================================
// Billing Cycle Date Calculation (Rule 29/30/31)
// ========================================

/**
 * Get the last day of a given month
 */
function getLastDayOfMonth(year: number, month: number): number {
  // month is 1-12, JS Date uses 0-11
  // Setting day 0 of next month gives last day of current month
  return new Date(year, month, 0).getDate();
}

/**
 * Clamp billing day to valid day for the given month
 * Rule: If billing_day (e.g., 31) doesn't exist in the month (e.g., February),
 * use the last day of that month instead.
 */
function clampBillingDay(year: number, month: number, billingDay: number): number {
  const lastDay = getLastDayOfMonth(year, month);
  return Math.min(billingDay, lastDay);
}

/**
 * Calculate the next invoice date from current date, respecting the 29/30/31 rule
 * 
 * Examples:
 * - billing_day=31, current month=February 2026 → Feb 28, 2026
 * - billing_day=31, current month=March 2026 → Mar 31, 2026
 * - billing_day=30, current month=February 2026 → Feb 28, 2026
 * - billing_day=29, current month=February 2028 (leap year) → Feb 29, 2028
 */
function calculateNextInvoiceDate(billingDay: number, fromDate: Date): Date {
  let year = fromDate.getFullYear();
  let month = fromDate.getMonth() + 1; // Convert to 1-12
  
  // If we've already passed the billing day this month, go to next month
  const currentDay = fromDate.getDate();
  if (currentDay >= billingDay) {
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  
  // Apply the 29/30/31 clamping rule
  const actualDay = clampBillingDay(year, month, billingDay);
  
  return new Date(year, month - 1, actualDay);
}

/**
 * Calculate the period end date (day before next billing cycle)
 */
function calculatePeriodEnd(billingDay: number, periodStart: Date): Date {
  const nextCycle = calculateNextInvoiceDate(billingDay, periodStart);
  const periodEnd = new Date(nextCycle);
  periodEnd.setDate(periodEnd.getDate() - 1);
  return periodEnd;
}

/**
 * Format date as YYYY-MM-DD string
 */
function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

/**
 * Add days to a date
 */
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// ========================================
// Main Invoice Generation Handler
// ========================================

Deno.serve(async (req) => {
  // Handle CORS preflight
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;
  
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const today = new Date();
    const todayStr = formatDate(today);
    console.log(`[generate-monthly-invoices] Starting invoice generation for date: ${todayStr}`);

    // ========================================
    // Step 1: Find subscriptions due for invoicing
    // ========================================
    const { data: subscriptions, error: subsError } = await supabase
      .from("subscriptions")
      .select("id, user_id, plan_name, amount, next_invoice_date, bill_cycle_day")
      .lte("next_invoice_date", todayStr)
      .in("status", ["active", "shipped", "installed", "installation_completed"]);

    if (subsError) {
      console.error("[generate-monthly-invoices] Error fetching subscriptions:", subsError);
      throw subsError;
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log("[generate-monthly-invoices] No subscriptions due for invoicing today");
    } else {
      console.log(`[generate-monthly-invoices] Found ${subscriptions.length} subscriptions due for invoicing`);
    }

    // Group subscriptions by client
    const clientSubscriptions = new Map<string, Subscription[]>();
    for (const sub of subscriptions || []) {
      const clientId = sub.user_id;
      if (!clientSubscriptions.has(clientId)) {
        clientSubscriptions.set(clientId, []);
      }
      clientSubscriptions.get(clientId)!.push(sub);
    }

    const results: InvoiceResult[] = [];
    const errors: { client_id: string; error: string }[] = [];

    // ========================================
    // Step 2: Generate invoices per client
    // ========================================
    for (const [clientId, subs] of clientSubscriptions) {
      try {
        // Use the bill_cycle_day from the first subscription (all should match for same client)
        const billingDay = subs[0].bill_cycle_day || new Date(subs[0].next_invoice_date).getDate();
        
        // Calculate period dates
        const issueDate = new Date(subs[0].next_invoice_date);
        const periodStart = issueDate;
        const periodEnd = calculatePeriodEnd(billingDay, periodStart);
        const dueDate = addDays(issueDate, PAYMENT_GRACE_DAYS);

        // Check if invoice already exists for this period
        const { data: existingInvoice } = await supabase
          .from("monthly_invoices")
          .select("id")
          .eq("client_id", clientId)
          .eq("period_start", formatDate(periodStart))
          .maybeSingle();

        if (existingInvoice) {
          console.log(`[generate-monthly-invoices] Invoice already exists for client ${clientId} period ${formatDate(periodStart)}`);
          continue;
        }

        // Calculate totals
        const subtotal = subs.reduce((sum, s) => sum + (s.amount || 0), 0);
        const tpsAmount = Math.round(subtotal * TPS_RATE * 100) / 100;
        const tvqAmount = Math.round(subtotal * TVQ_RATE * 100) / 100;
        const total = Math.round((subtotal + tpsAmount + tvqAmount) * 100) / 100;

        // Create invoice
        const { data: invoice, error: invoiceError } = await supabase
          .from("monthly_invoices")
          .insert({
            client_id: clientId,
            period_start: formatDate(periodStart),
            period_end: formatDate(periodEnd),
            issue_date: formatDate(issueDate),
            due_date: formatDate(dueDate), // 15 days after issue date
            status: "issued",
            subtotal,
            tps_amount: tpsAmount,
            tvq_amount: tvqAmount,
            total,
          })
          .select()
          .single();

        if (invoiceError) {
          console.error(`[generate-monthly-invoices] Error creating invoice for client ${clientId}:`, invoiceError);
          errors.push({ client_id: clientId, error: invoiceError.message });
          continue;
        }

        console.log(`[generate-monthly-invoices] Created invoice ${invoice.invoice_number} for client ${clientId} (due: ${formatDate(dueDate)})`);

        // Create invoice lines
        const invoiceLines = subs.map((sub) => ({
          invoice_id: invoice.id,
          subscription_id: sub.id,
          description: sub.plan_name || "Service mensuel",
          quantity: 1,
          unit_price: sub.amount || 0,
          line_total: sub.amount || 0,
        }));

        const { error: linesError } = await supabase
          .from("monthly_invoice_lines")
          .insert(invoiceLines);

        if (linesError) {
          console.error(`[generate-monthly-invoices] Error creating invoice lines:`, linesError);
        }

        // Update subscriptions: advance next_invoice_date respecting 29/30/31 rule
        for (const sub of subs) {
          const subBillingDay = sub.bill_cycle_day || billingDay;
          const currentInvoiceDate = new Date(sub.next_invoice_date);
          const nextInvoiceDate = calculateNextInvoiceDate(subBillingDay, currentInvoiceDate);
          
          console.log(`[generate-monthly-invoices] Advancing subscription ${sub.id}: ${sub.next_invoice_date} -> ${formatDate(nextInvoiceDate)} (billing day: ${subBillingDay})`);
          
          await supabase
            .from("subscriptions")
            .update({
              next_invoice_date: formatDate(nextInvoiceDate),
              last_invoiced_through: formatDate(periodEnd),
            })
            .eq("id", sub.id);
        }

        results.push({
          client_id: clientId,
          invoice_id: invoice.id,
          invoice_number: invoice.invoice_number,
          total,
          services_count: subs.length,
        });
      } catch (err) {
        console.error(`[generate-monthly-invoices] Error processing client ${clientId}:`, err);
        errors.push({ client_id: clientId, error: String(err) });
      }
    }

    // ========================================
    // Step 3: Check for overdue invoices (15 days grace period)
    // ========================================
    const overdueThreshold = addDays(today, -PAYMENT_GRACE_DAYS);
    
    const { data: overdueInvoices } = await supabase
      .from("monthly_invoices")
      .select("id, client_id, invoice_number, due_date")
      .eq("status", "issued")
      .lt("due_date", formatDate(overdueThreshold));

    let suspendedCount = 0;

    if (overdueInvoices && overdueInvoices.length > 0) {
      console.log(`[generate-monthly-invoices] Found ${overdueInvoices.length} overdue invoices (past ${PAYMENT_GRACE_DAYS} days)`);
      
      for (const inv of overdueInvoices) {
        // Mark invoice as overdue
        await supabase
          .from("monthly_invoices")
          .update({ status: "overdue" })
          .eq("id", inv.id);

        // Suspend client's subscriptions
        const { data: suspendedSubs } = await supabase
          .from("subscriptions")
          .update({ status: "suspended" })
          .eq("user_id", inv.client_id)
          .in("status", ["active", "shipped", "installed", "installation_completed"])
          .select("id");

        // Also update account status to suspended
        await supabase
          .from("accounts")
          .update({ status: "suspended" })
          .eq("client_id", inv.client_id);

        suspendedCount++;
        console.log(`[generate-monthly-invoices] Suspended services for client ${inv.client_id} due to overdue invoice ${inv.invoice_number} (due: ${inv.due_date})`);
      }
    }

    console.log(`[generate-monthly-invoices] Completed. Generated ${results.length} invoices, ${suspendedCount} accounts suspended, ${errors.length} errors`);

    return new Response(
      JSON.stringify({
        message: `Generated ${results.length} invoices`,
        invoices: results,
        suspended_accounts: suspendedCount,
        payment_grace_days: PAYMENT_GRACE_DAYS,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[generate-monthly-invoices] Fatal error:", error);
    const origin = req.headers.get('origin');
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" } }
    );
  }
});
