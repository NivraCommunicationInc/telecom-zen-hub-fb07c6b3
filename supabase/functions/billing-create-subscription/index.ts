import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { computeTaxes } from "../_shared/tax-constants.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateSubscriptionRequest {
  customer_id?: string;
  // If no customer_id, create new customer
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  user_id?: string;
  // Subscription details
  plan_code: string;
  plan_name: string;
  plan_price: number;
  payment_method?: 'interac' | 'manual';
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: CreateSubscriptionRequest = await req.json();
    
    let customerId = body.customer_id;
    
    // Step 1: Create or get customer
    if (!customerId) {
      if (!body.email || !body.first_name || !body.last_name || !body.phone) {
        throw new Error("Missing customer details: first_name, last_name, email, phone required");
      }
      
      // Check if customer exists by email
      const { data: existingCustomer } = await supabase
        .from("billing_customers")
        .select("id")
        .eq("email", body.email)
        .single();
      
      if (existingCustomer) {
        customerId = existingCustomer.id;
      } else {
        const { data: newCustomer, error: customerError } = await supabase
          .from("billing_customers")
          .insert({
            first_name: body.first_name,
            last_name: body.last_name,
            email: body.email,
            phone: body.phone,
            user_id: body.user_id || null,
            status: 'active'
          })
          .select()
          .single();
        
        if (customerError) throw customerError;
        customerId = newCustomer.id;
      }
    }
    
    // Step 2: Create subscription
    const cycleStartDate = new Date();
    const cycleEndDate = new Date();
    cycleEndDate.setDate(cycleEndDate.getDate() + 30);
    
    const { data: subscription, error: subError } = await supabase
      .from("billing_subscriptions")
      .insert({
        customer_id: customerId,
        plan_code: body.plan_code,
        plan_name: body.plan_name,
        plan_price: body.plan_price,
        cycle_start_date: cycleStartDate.toISOString().split('T')[0],
        cycle_end_date: cycleEndDate.toISOString().split('T')[0],
        status: 'pending'
      })
      .select()
      .single();
    
    if (subError) throw subError;
    
    // Step 3: Generate invoice number
    const { data: invoiceNumberData } = await supabase
      .rpc("generate_billing_invoice_number");
    
    const invoiceNumber = invoiceNumberData || `INV-${Date.now()}`;
    
    // Step 4: Calculate amounts via canonical tax module
    const subtotal = body.plan_price;
    const { tps: tpsAmount, tvq: tvqAmount, total } = computeTaxes(subtotal);
    
    // Due date = cycle end date
    const dueDate = cycleEndDate.toISOString().split('T')[0];
    
    // Step 5: Create invoice WITH lines atomically via RPC
    const { data: invoiceId, error: invoiceError } = await supabase
      .rpc("create_invoice_with_lines", {
        p_subscription_id: subscription.id,
        p_customer_id: customerId,
        p_invoice_number: invoiceNumber,
        p_type: 'initial',
        p_subtotal: subtotal,
        p_tps_amount: tpsAmount,
        p_tvq_amount: tvqAmount,
        p_total: total,
        p_payment_method: body.payment_method || 'interac',
        p_cycle_start: cycleStartDate.toISOString().split('T')[0],
        p_cycle_end: cycleEndDate.toISOString().split('T')[0],
        p_due_date: dueDate,
        p_order_id: null,
        p_lines: JSON.stringify([{
          description: `${body.plan_name} – 30 jours`,
          unit_price: body.plan_price,
          quantity: 1,
          line_total: body.plan_price,
          line_type: 'service'
        }])
      });
    
    if (invoiceError) throw invoiceError;

    // Step 6: Create pending payment record
    await supabase
      .from("billing_payments")
      .insert({
        invoice_id: invoiceId,
        customer_id: customerId,
        method: body.payment_method || 'interac',
        amount: total,
        status: 'pending'
      });
    
    // Step 8: Queue welcome email with invoice
    const { data: customer } = await supabase
      .from("billing_customers")
      .select("email, first_name, last_name")
      .eq("id", customerId)
      .single();
    
    if (customer) {
      await supabase.from("email_queue").insert({
        event_key: `billing_sub_${subscription.id}_${invoiceNumber}`,
        to_email: customer.email,
        template_key: "invoice_created",
        template_vars: {
          client_name: `${customer.first_name} ${customer.last_name}`,
          invoice_number: invoiceNumber,
          plan_name: body.plan_name,
          subtotal: subtotal.toFixed(2),
          tps_amount: tpsAmount.toFixed(2),
          tvq_amount: tvqAmount.toFixed(2),
          total: total.toFixed(2),
          amount: total.toFixed(2),
          due_date: dueDate,
          cycle_start: cycleStartDate.toISOString().split('T')[0],
          cycle_end: cycleEndDate.toISOString().split('T')[0]
        },
        status: "queued",
        attempts: 0,
        max_attempts: 5
      });
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        customer_id: customerId,
        subscription_id: subscription.id,
        invoice_id: invoiceId,
        invoice_number: invoiceNumber,
        total
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (error: unknown) {
    console.error("Error creating subscription:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
