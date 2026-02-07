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
      disputes_processed: 0,
      dispute_fees_applied: 0,
      dispute_expirations: 0,
      errors: [] as string[]
    };
    
    // =========================================================================
    // PART 1: DISPUTE/CHARGEBACK J+2 and J+5 PROCESSING (Scenario B)
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
              // Get current invoice
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
                
                // Mark fee as applied
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
              
              // Mark as expired in alert
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
    // PART 2: NORMAL NON-RENEWAL PROCESSING (Scenario A - NO DEBT)
    // =========================================================================
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
        
        // ⚠️ PREPAID MODEL: NO DEBT, NO LATE FEES FOR NORMAL NON-RENEWAL
        // J0 immediate: Service expires (not "suspended with debt")
        
        if (daysPastDue >= 0 && invoice.subscription?.status === 'active') {
          // IMMEDIATE: Mark invoice as void (not overdue - prepaid terminology)
          await supabase
            .from("billing_invoices")
            .update({ 
              status: 'void',
              notes: `[NON-RENOUVELLEMENT] Service non renouvelé à J0 (modèle prépayé - aucune dette créée)`,
              updated_at: new Date().toISOString()
            })
            .eq("id", invoice.id);
          
          // Mark subscription as expired
          await supabase
            .from("billing_subscriptions")
            .update({ 
              status: 'expired',
              updated_at: new Date().toISOString()
            })
            .eq("id", invoice.subscription_id);
          
          // Send non-renewal email (NOT overdue/debt language)
          if (invoice.customer) {
            await supabase.from("email_queue").insert({
              to_email: invoice.customer.email,
              to_name: `${invoice.customer.first_name} ${invoice.customer.last_name}`,
              template_type: "billing_service_not_renewed",
              template_data: {
                clientName: `${invoice.customer.first_name} ${invoice.customer.last_name}`,
                planName: invoice.subscription?.plan_name || 'Service',
                invoiceNumber: invoice.invoice_number,
                // NO amount owed - prepaid model, just explain renewal is needed
              },
              priority: "high"
            });
          }
          
          results.cancelled.push(invoice.invoice_number);
          console.log(`[billing-check-overdue] Non-renewal: subscription expired for invoice ${invoice.invoice_number} (no debt)`);
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
