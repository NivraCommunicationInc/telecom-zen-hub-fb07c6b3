import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * CRON: Daily renewal invoice generation
 * Runs at 00:00 daily
 * Generates renewal invoices for subscriptions ending in 3 days (J-3)
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Tax rates Quebec
    const TPS_RATE = 0.05;
    const TVQ_RATE = 0.09975;
    
    // Calculate J-3 date
    const today = new Date();
    const targetDate = new Date();
    targetDate.setDate(today.getDate() + 3);
    const targetDateStr = targetDate.toISOString().split('T')[0];
    
    console.log(`[billing-generate-renewals] Looking for subscriptions ending on ${targetDateStr}`);
    
    // Find active subscriptions ending in 3 days
    const { data: subscriptions, error: subError } = await supabase
      .from("billing_subscriptions")
      .select(`
        *,
        customer:billing_customers(id, email, first_name, last_name)
      `)
      .eq("status", "active")
      .eq("cycle_end_date", targetDateStr);
    
    if (subError) throw subError;
    
    console.log(`[billing-generate-renewals] Found ${subscriptions?.length || 0} subscriptions to renew`);
    
    const results = {
      processed: 0,
      invoices_created: [] as string[],
      errors: [] as string[]
    };
    
    for (const sub of subscriptions || []) {
      try {
        // Check if renewal invoice already exists for this cycle
        const newCycleStart = new Date(sub.cycle_end_date);
        const newCycleEnd = new Date(sub.cycle_end_date);
        newCycleEnd.setDate(newCycleEnd.getDate() + 30);
        
        const { data: existingInvoice } = await supabase
          .from("billing_invoices")
          .select("id")
          .eq("subscription_id", sub.id)
          .eq("type", "renewal")
          .eq("cycle_start_date", newCycleStart.toISOString().split('T')[0])
          .single();
        
        if (existingInvoice) {
          console.log(`[billing-generate-renewals] Invoice already exists for subscription ${sub.id}`);
          continue;
        }
        
        // Generate invoice number
        const { data: invoiceNumberData } = await supabase
          .rpc("generate_billing_invoice_number");
        
        const invoiceNumber = invoiceNumberData || `INV-${Date.now()}`;
        
        // Calculate amounts
        const subtotal = sub.plan_price;
        const tpsAmount = Math.round(subtotal * TPS_RATE * 100) / 100;
        const tvqAmount = Math.round(subtotal * TVQ_RATE * 100) / 100;
        const total = Math.round((subtotal + tpsAmount + tvqAmount) * 100) / 100;
        
        // Due date = new cycle end date
        const dueDate = newCycleEnd.toISOString().split('T')[0];
        
        // Create renewal invoice
        const { data: invoice, error: invoiceError } = await supabase
          .from("billing_invoices")
          .insert({
            subscription_id: sub.id,
            customer_id: sub.customer_id,
            invoice_number: invoiceNumber,
            type: 'renewal',
            subtotal,
            tps_amount: tpsAmount,
            tvq_amount: tvqAmount,
            total,
            currency: 'CAD',
            payment_method: 'interac',
            status: 'pending',
            cycle_start_date: newCycleStart.toISOString().split('T')[0],
            cycle_end_date: newCycleEnd.toISOString().split('T')[0],
            due_date: dueDate
          })
          .select()
          .single();
        
        if (invoiceError) throw invoiceError;
        
        // Create invoice line
        await supabase
          .from("billing_invoice_lines")
          .insert({
            invoice_id: invoice.id,
            description: `${sub.plan_name} – Renouvellement 30 jours`,
            unit_price: sub.plan_price,
            quantity: 1,
            line_total: sub.plan_price
          });
        
        // Create pending payment
        await supabase
          .from("billing_payments")
          .insert({
            invoice_id: invoice.id,
            customer_id: sub.customer_id,
            method: 'interac',
            amount: total,
            status: 'pending'
          });
        
        // Queue reminder email
        if (sub.customer) {
          await supabase.from("email_queue").insert({
            to_email: sub.customer.email,
            to_name: `${sub.customer.first_name} ${sub.customer.last_name}`,
            template_type: "billing_renewal_reminder",
            template_data: {
              clientName: `${sub.customer.first_name} ${sub.customer.last_name}`,
              invoiceNumber: invoiceNumber,
              planName: sub.plan_name,
              total: total.toFixed(2),
              dueDate: dueDate,
              daysRemaining: 3
            },
            priority: "high"
          });
        }
        
        results.invoices_created.push(invoiceNumber);
        results.processed++;
        
        console.log(`[billing-generate-renewals] Created renewal invoice ${invoiceNumber} for subscription ${sub.id}`);
        
      } catch (err: unknown) {
        const errorMsg = `Failed to process subscription ${sub.id}: ${err instanceof Error ? err.message : String(err)}`;
        console.error(`[billing-generate-renewals] ${errorMsg}`);
        results.errors.push(errorMsg);
      }
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        date: targetDateStr,
        ...results
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (error: unknown) {
    console.error("[billing-generate-renewals] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
