import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Billing V2 - Create Order
 * 
 * Creates billing records from a new order:
 * - 1 billing_customer (or gets existing)
 * - 1 billing_subscription per service
 * - 1 initial invoice per subscription with activation fee logic:
 *   - $25 for 1 service
 *   - $45 flat for 2+ services in same order
 */

interface ServiceItem {
  plan_code: string;
  plan_name: string;
  plan_price: number;
  category: string;
}

interface CreateOrderRequest {
  // Customer info
  user_id?: string; // Optional - may not exist in auth.users
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  // Services
  services: ServiceItem[];
  // Order reference (for tracking)
  order_id?: string;
  order_number?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: CreateOrderRequest = await req.json();
    
    // Validate required fields (user_id is optional)
    if (!body.email || !body.first_name || !body.last_name || !body.phone) {
      throw new Error("Missing required customer fields: email, first_name, last_name, phone");
    }
    
    if (!body.services || body.services.length === 0) {
      throw new Error("At least one service is required");
    }
    
    // Tax rates Quebec
    const TPS_RATE = 0.05;
    const TVQ_RATE = 0.09975;
    
    // Calculate activation fee based on service count
    const serviceCount = body.services.length;
    const activationFee = serviceCount === 1 ? 25.00 : 45.00;
    // Split activation fee across invoices (first invoice gets it all)
    const activationFeePerInvoice = serviceCount > 0 ? activationFee : 0;
    
    // Step 1: Get or create billing customer
    let customerId: string;
    
    // First check by email (always available)
    const { data: existingCustomer } = await supabase
      .from("billing_customers")
      .select("id")
      .eq("email", body.email)
      .single();
    
    if (existingCustomer) {
      customerId = existingCustomer.id;
      console.log(`[billing-create-order] Using existing customer: ${customerId}`);
      // Optionally link user_id if provided and not already linked
      if (body.user_id) {
        await supabase
          .from("billing_customers")
          .update({ user_id: body.user_id })
          .eq("id", customerId)
          .is("user_id", null);
      }
    } else {
      // Create new customer (user_id is nullable, so we can pass null if not provided)
      const { data: newCustomer, error: customerError } = await supabase
        .from("billing_customers")
        .insert({
          user_id: body.user_id || null, // Nullable - may not exist in auth.users
          first_name: body.first_name,
          last_name: body.last_name,
          email: body.email,
          phone: body.phone,
          status: 'active'
        })
        .select()
        .single();
      
      if (customerError) throw customerError;
      customerId = newCustomer.id;
      console.log(`[billing-create-order] Created new customer: ${customerId}`);
    }
    
    const results = {
      customer_id: customerId,
      subscriptions: [] as Array<{
        subscription_id: string;
        invoice_id: string;
        invoice_number: string;
        total: number;
      }>,
      total_amount: 0,
      activation_fee: activationFee
    };
    
    // Step 2: Create subscription + invoice for each service
    const cycleStartDate = new Date();
    const cycleEndDate = new Date();
    cycleEndDate.setDate(cycleEndDate.getDate() + 30);
    
    const cycleStartStr = cycleStartDate.toISOString().split('T')[0];
    const cycleEndStr = cycleEndDate.toISOString().split('T')[0];
    const dueDate = cycleEndStr;
    
    for (let i = 0; i < body.services.length; i++) {
      const service = body.services[i];
      
      // Create subscription
      const { data: subscription, error: subError } = await supabase
        .from("billing_subscriptions")
        .insert({
          customer_id: customerId,
          plan_code: service.plan_code,
          plan_name: service.plan_name,
          plan_price: service.plan_price,
          service_category: service.category,
          cycle_start_date: cycleStartStr,
          cycle_end_date: cycleEndStr,
          status: 'pending'
        })
        .select()
        .single();
      
      if (subError) throw subError;
      
      // Generate invoice number
      const { data: invoiceNumberData } = await supabase
        .rpc("generate_billing_invoice_number");
      
      const invoiceNumber = invoiceNumberData || `INV-${Date.now()}-${i}`;
      
      // Calculate amounts - activation fee only on first invoice
      const invoiceActivationFee = i === 0 ? activationFeePerInvoice : 0;
      const subtotal = service.plan_price + invoiceActivationFee;
      const tpsAmount = Math.round(subtotal * TPS_RATE * 100) / 100;
      const tvqAmount = Math.round(subtotal * TVQ_RATE * 100) / 100;
      const total = Math.round((subtotal + tpsAmount + tvqAmount) * 100) / 100;
      
      // Create invoice - ALWAYS Interac, ALWAYS pending
      const { data: invoice, error: invoiceError } = await supabase
        .from("billing_invoices")
        .insert({
          subscription_id: subscription.id,
          customer_id: customerId,
          invoice_number: invoiceNumber,
          type: 'initial',
          subtotal,
          activation_fee: invoiceActivationFee,
          tps_amount: tpsAmount,
          tvq_amount: tvqAmount,
          total,
          currency: 'CAD',
          payment_method: 'interac', // INTERAC ONLY
          status: 'pending',
          cycle_start_date: cycleStartStr,
          cycle_end_date: cycleEndStr,
          due_date: dueDate,
          notes: body.order_number ? `Commande: ${body.order_number}` : null
        })
        .select()
        .single();
      
      if (invoiceError) throw invoiceError;
      
      // Create invoice lines
      const lines = [
        {
          invoice_id: invoice.id,
          description: `${service.plan_name} – 30 jours`,
          unit_price: service.plan_price,
          quantity: 1,
          line_total: service.plan_price
        }
      ];
      
      if (invoiceActivationFee > 0) {
        lines.push({
          invoice_id: invoice.id,
          description: serviceCount === 1 ? "Frais d'activation (1 service)" : "Frais d'activation (multi-services)",
          unit_price: invoiceActivationFee,
          quantity: 1,
          line_total: invoiceActivationFee
        });
      }
      
      await supabase.from("billing_invoice_lines").insert(lines);
      
      // Create pending payment record - ALWAYS Interac
      await supabase
        .from("billing_payments")
        .insert({
          invoice_id: invoice.id,
          customer_id: customerId,
          method: 'interac', // INTERAC ONLY
          amount: total,
          status: 'pending'
        });
      
      // Update subscription with last_invoice_id
      await supabase
        .from("billing_subscriptions")
        .update({ last_invoice_id: invoice.id })
        .eq("id", subscription.id);
      
      results.subscriptions.push({
        subscription_id: subscription.id,
        invoice_id: invoice.id,
        invoice_number: invoiceNumber,
        total
      });
      
      results.total_amount += total;
      
      console.log(`[billing-create-order] Created subscription ${subscription.id} with invoice ${invoiceNumber}`);
    }
    
    // Step 3: Queue welcome email with Interac payment instructions
    await supabase.from("email_queue").insert({
      to_email: body.email,
      to_name: `${body.first_name} ${body.last_name}`,
      template_type: "billing_new_invoice",
      template_data: {
        clientName: `${body.first_name} ${body.last_name}`,
        invoiceNumber: results.subscriptions[0]?.invoice_number || 'N/A',
        planName: body.services.map(s => s.plan_name).join(', '),
        subtotal: body.services.reduce((sum, s) => sum + s.plan_price, 0).toFixed(2),
        activationFee: activationFee.toFixed(2),
        tps: (results.total_amount * 0.05 / 1.14975).toFixed(2),
        tvq: (results.total_amount * 0.09975 / 1.14975).toFixed(2),
        total: results.total_amount.toFixed(2),
        dueDate: dueDate,
        cycleStart: cycleStartStr,
        cycleEnd: cycleEndStr,
        serviceCount: serviceCount,
        // Interac instructions
        paymentMethod: 'Interac e-Transfer',
        paymentEmail: 'Support@nivratelecom.ca'
      },
      priority: "high"
    });
    
    console.log(`[billing-create-order] Order processed: ${results.subscriptions.length} subscriptions, total: $${results.total_amount.toFixed(2)}`);
    
    return new Response(
      JSON.stringify({
        success: true,
        ...results
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (error: unknown) {
    console.error("[billing-create-order] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
