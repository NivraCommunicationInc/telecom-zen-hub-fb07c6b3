import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Quebec tax rates
const TPS_RATE = 0.05;
const TVQ_RATE = 0.09975;

interface Subscription {
  id: string;
  user_id: string;
  plan_name: string;
  amount: number;
  next_invoice_date: string;
  bill_cycle_day: number;
}

interface InvoiceResult {
  client_id: string;
  invoice_id: string;
  invoice_number: string;
  total: number;
  services_count: number;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const today = new Date().toISOString().split("T")[0];
    console.log(`[generate-monthly-invoices] Starting invoice generation for date: ${today}`);

    // 1. Find all subscriptions where next_invoice_date = today
    const { data: subscriptions, error: subsError } = await supabase
      .from("subscriptions")
      .select("id, user_id, plan_name, amount, next_invoice_date, bill_cycle_day")
      .eq("next_invoice_date", today)
      .in("status", ["active", "shipped", "installed", "installation_completed"]);

    if (subsError) {
      console.error("[generate-monthly-invoices] Error fetching subscriptions:", subsError);
      throw subsError;
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log("[generate-monthly-invoices] No subscriptions due for invoicing today");
      return new Response(
        JSON.stringify({ message: "No invoices to generate", count: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[generate-monthly-invoices] Found ${subscriptions.length} subscriptions due for invoicing`);

    // 2. Group subscriptions by client
    const clientSubscriptions = new Map<string, Subscription[]>();
    for (const sub of subscriptions) {
      const clientId = sub.user_id;
      if (!clientSubscriptions.has(clientId)) {
        clientSubscriptions.set(clientId, []);
      }
      clientSubscriptions.get(clientId)!.push(sub);
    }

    const results: InvoiceResult[] = [];
    const errors: { client_id: string; error: string }[] = [];

    // 3. Generate one invoice per client
    for (const [clientId, subs] of clientSubscriptions) {
      try {
        // Calculate period
        const periodStart = new Date(today);
        const periodEnd = new Date(periodStart);
        periodEnd.setMonth(periodEnd.getMonth() + 1);
        periodEnd.setDate(periodEnd.getDate() - 1);

        // Check if invoice already exists for this period
        const { data: existingInvoice } = await supabase
          .from("monthly_invoices")
          .select("id")
          .eq("client_id", clientId)
          .eq("period_start", today)
          .maybeSingle();

        if (existingInvoice) {
          console.log(`[generate-monthly-invoices] Invoice already exists for client ${clientId} period ${today}`);
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
            period_start: today,
            period_end: periodEnd.toISOString().split("T")[0],
            issue_date: today,
            due_date: today, // Prepaid: due immediately
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

        console.log(`[generate-monthly-invoices] Created invoice ${invoice.invoice_number} for client ${clientId}`);

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

        // Update subscriptions: advance next_invoice_date by 1 month
        for (const sub of subs) {
          const nextDate = new Date(sub.next_invoice_date);
          nextDate.setMonth(nextDate.getMonth() + 1);
          
          await supabase
            .from("subscriptions")
            .update({
              next_invoice_date: nextDate.toISOString().split("T")[0],
              last_invoiced_through: periodEnd.toISOString().split("T")[0],
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

    // 4. Check for overdue invoices and suspend services (grace period: 5 days)
    const graceDays = 5;
    const overdueDate = new Date();
    overdueDate.setDate(overdueDate.getDate() - graceDays);
    
    const { data: overdueInvoices } = await supabase
      .from("monthly_invoices")
      .select("id, client_id")
      .eq("status", "issued")
      .lt("due_date", overdueDate.toISOString().split("T")[0]);

    if (overdueInvoices && overdueInvoices.length > 0) {
      console.log(`[generate-monthly-invoices] Found ${overdueInvoices.length} overdue invoices`);
      
      for (const inv of overdueInvoices) {
        // Mark invoice as overdue
        await supabase
          .from("monthly_invoices")
          .update({ status: "overdue" })
          .eq("id", inv.id);

        // Suspend client's subscriptions
        await supabase
          .from("subscriptions")
          .update({ status: "suspended" })
          .eq("user_id", inv.client_id)
          .in("status", ["active", "shipped", "installed", "installation_completed"]);

        console.log(`[generate-monthly-invoices] Suspended services for client ${inv.client_id} due to overdue invoice`);
      }
    }

    console.log(`[generate-monthly-invoices] Completed. Generated ${results.length} invoices, ${errors.length} errors`);

    return new Response(
      JSON.stringify({
        message: `Generated ${results.length} invoices`,
        invoices: results,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[generate-monthly-invoices] Fatal error:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
