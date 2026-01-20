import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * CRON: Daily overdue invoice check
 * Runs at 00:00 daily
 * 
 * Rules:
 * - 2 days after cycle_end_date with unpaid invoice → suspend subscription
 * - 5 days after cycle_end_date with unpaid invoice → cancel subscription
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
    
    // Date thresholds
    const suspendThreshold = new Date();
    suspendThreshold.setDate(today.getDate() - 2);
    const suspendDateStr = suspendThreshold.toISOString().split('T')[0];
    
    const cancelThreshold = new Date();
    cancelThreshold.setDate(today.getDate() - 5);
    const cancelDateStr = cancelThreshold.toISOString().split('T')[0];
    
    console.log(`[billing-check-overdue] Checking overdue invoices as of ${todayStr}`);
    console.log(`[billing-check-overdue] Suspend threshold: ${suspendDateStr}, Cancel threshold: ${cancelDateStr}`);
    
    const results = {
      suspended: [] as string[],
      cancelled: [] as string[],
      reminders_sent: 0,
      errors: [] as string[]
    };
    
    // Find pending invoices past due date
    const { data: overdueInvoices, error: fetchError } = await supabase
      .from("billing_invoices")
      .select(`
        *,
        customer:billing_customers(id, email, first_name, last_name, phone),
        subscription:billing_subscriptions(id, status, plan_name)
      `)
      .eq("status", "pending")
      .lte("cycle_end_date", todayStr);
    
    if (fetchError) throw fetchError;
    
    console.log(`[billing-check-overdue] Found ${overdueInvoices?.length || 0} overdue invoices`);
    
    for (const invoice of overdueInvoices || []) {
      try {
        const cycleEndDate = new Date(invoice.cycle_end_date);
        const daysPastDue = Math.floor((today.getTime() - cycleEndDate.getTime()) / (1000 * 60 * 60 * 24));
        
        console.log(`[billing-check-overdue] Invoice ${invoice.invoice_number}: ${daysPastDue} days past due`);
        
        // 5+ days: Cancel subscription
        if (daysPastDue >= 5 && invoice.subscription?.status !== 'cancelled') {
          // Update invoice to failed
          await supabase
            .from("billing_invoices")
            .update({ status: 'failed' })
            .eq("id", invoice.id);
          
          // Cancel subscription
          await supabase
            .from("billing_subscriptions")
            .update({ 
              status: 'cancelled',
              updated_at: new Date().toISOString()
            })
            .eq("id", invoice.subscription_id);
          
          // Send cancellation email
          if (invoice.customer) {
            await supabase.from("email_queue").insert({
              to_email: invoice.customer.email,
              to_name: `${invoice.customer.first_name} ${invoice.customer.last_name}`,
              template_type: "billing_service_cancelled",
              template_data: {
                clientName: `${invoice.customer.first_name} ${invoice.customer.last_name}`,
                planName: invoice.subscription?.plan_name || 'Service',
                invoiceNumber: invoice.invoice_number,
                amountOwed: invoice.total.toFixed(2)
              },
              priority: "high"
            });
          }
          
          results.cancelled.push(invoice.invoice_number);
          console.log(`[billing-check-overdue] Cancelled subscription for invoice ${invoice.invoice_number}`);
          
        // 2-4 days: Suspend subscription
        } else if (daysPastDue >= 2 && invoice.subscription?.status === 'active') {
          // Suspend subscription
          await supabase
            .from("billing_subscriptions")
            .update({ 
              status: 'suspended',
              updated_at: new Date().toISOString()
            })
            .eq("id", invoice.subscription_id);
          
          // Send suspension email/SMS
          if (invoice.customer) {
            await supabase.from("email_queue").insert({
              to_email: invoice.customer.email,
              to_name: `${invoice.customer.first_name} ${invoice.customer.last_name}`,
              template_type: "billing_service_suspended",
              template_data: {
                clientName: `${invoice.customer.first_name} ${invoice.customer.last_name}`,
                planName: invoice.subscription?.plan_name || 'Service',
                invoiceNumber: invoice.invoice_number,
                amountOwed: invoice.total.toFixed(2),
                daysUntilCancellation: 5 - daysPastDue
              },
              priority: "urgent"
            });
          }
          
          results.suspended.push(invoice.invoice_number);
          console.log(`[billing-check-overdue] Suspended subscription for invoice ${invoice.invoice_number}`);
          
        // 1 day: Send reminder
        } else if (daysPastDue === 1 && invoice.customer) {
          await supabase.from("email_queue").insert({
            to_email: invoice.customer.email,
            to_name: `${invoice.customer.first_name} ${invoice.customer.last_name}`,
            template_type: "billing_payment_overdue",
            template_data: {
              clientName: `${invoice.customer.first_name} ${invoice.customer.last_name}`,
              invoiceNumber: invoice.invoice_number,
              amountOwed: invoice.total.toFixed(2),
              daysOverdue: 1
            },
            priority: "high"
          });
          
          results.reminders_sent++;
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
