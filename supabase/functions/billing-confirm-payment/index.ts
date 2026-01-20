import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ConfirmPaymentRequest {
  invoice_id: string;
  payment_reference?: string;
  confirmed_by?: string;
}

/**
 * Confirm payment for an invoice (typically Interac)
 * This triggers the SQL trigger to activate the subscription
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: ConfirmPaymentRequest = await req.json();
    
    if (!body.invoice_id) {
      throw new Error("invoice_id is required");
    }
    
    // Get invoice details
    const { data: invoice, error: invoiceError } = await supabase
      .from("billing_invoices")
      .select(`
        *,
        customer:billing_customers(id, email, first_name, last_name),
        subscription:billing_subscriptions(id, plan_name)
      `)
      .eq("id", body.invoice_id)
      .single();
    
    if (invoiceError || !invoice) {
      throw new Error("Invoice not found");
    }
    
    if (invoice.status === 'paid') {
      return new Response(
        JSON.stringify({ success: true, message: "Invoice already paid" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Update payment record
    const { error: paymentError } = await supabase
      .from("billing_payments")
      .update({
        status: 'confirmed',
        reference: body.payment_reference || null,
        confirmed_by: body.confirmed_by || null,
        received_at: new Date().toISOString()
      })
      .eq("invoice_id", body.invoice_id)
      .eq("status", "pending");
    
    if (paymentError) {
      console.error("Payment update error:", paymentError);
    }
    
    // Update invoice status to PAID
    // This triggers the SQL trigger to update subscription
    const { error: updateError } = await supabase
      .from("billing_invoices")
      .update({
        status: 'paid',
        paid_at: new Date().toISOString()
      })
      .eq("id", body.invoice_id);
    
    if (updateError) throw updateError;
    
    // Queue confirmation email
    if (invoice.customer) {
      await supabase.from("email_queue").insert({
        to_email: invoice.customer.email,
        to_name: `${invoice.customer.first_name} ${invoice.customer.last_name}`,
        template_type: "billing_payment_confirmed",
        template_data: {
          clientName: `${invoice.customer.first_name} ${invoice.customer.last_name}`,
          invoiceNumber: invoice.invoice_number,
          planName: invoice.subscription?.plan_name || 'Service Nivra',
          total: invoice.total.toFixed(2),
          paidAt: new Date().toLocaleDateString('fr-CA'),
          cycleStart: invoice.cycle_start_date,
          cycleEnd: invoice.cycle_end_date
        },
        priority: "high"
      });
    }
    
    console.log(`[billing-confirm-payment] Invoice ${invoice.invoice_number} marked as paid`);
    
    return new Response(
      JSON.stringify({
        success: true,
        invoice_number: invoice.invoice_number,
        status: 'paid'
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (error: unknown) {
    console.error("[billing-confirm-payment] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
