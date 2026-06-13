import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Migration script: Migrate existing clients to Billing V2
 * Creates billing_customers, billing_subscriptions, and initial invoices
 * from existing orders and profiles data
 * 
 * INTERAC ONLY - All invoices created with payment_method = 'interac'
 */

const TPS_RATE = 0.05;
const TVQ_RATE = 0.09975;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase: any = createClient<any>(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const dryRun = body.dry_run !== false; // Default to dry run
    
    console.log(`[billing-migrate-clients] Starting migration (dry_run: ${dryRun})`);
    
    const results = {
      dry_run: dryRun,
      customers_found: 0,
      customers_migrated: 0,
      subscriptions_created: 0,
      invoices_created: 0,
      already_migrated: 0,
      errors: [] as string[]
    };
    
    // Fetch completed/paid orders (these represent active services)
    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select(`
        id,
        user_id,
        client_email,
        client_first_name,
        client_last_name,
        client_phone,
        service_type,
        subtotal,
        status,
        payment_status,
        created_at
      `)
      .in("status", ["paid", "completed", "active"])
      .in("payment_status", ["paid", "captured", "completed"])
      .order("created_at", { ascending: false });
    
    if (ordersError) throw ordersError;
    
    results.customers_found = orders?.length || 0;
    console.log(`[billing-migrate-clients] Found ${results.customers_found} paid/completed orders to process`);
    
    // Group orders by user_id to create one customer per user
    const userOrders = new Map<string, typeof orders>();
    for (const order of orders || []) {
      if (!order.user_id) continue;
      if (!userOrders.has(order.user_id)) {
        userOrders.set(order.user_id, []);
      }
      userOrders.get(order.user_id)!.push(order);
    }
    
    console.log(`[billing-migrate-clients] Found ${userOrders.size} unique users with orders`);
    
    for (const [userId, userOrderList] of userOrders) {
      try {
        const firstOrder = userOrderList[0];
        
        // Check if already migrated
        const { data: existingCustomer } = await supabase
          .from("billing_customers")
          .select("id")
          .eq("user_id", userId)
          .single();
        
        if (existingCustomer) {
          results.already_migrated++;
          continue;
        }
        
        // Get profile info as fallback
        const { data: profile } = await supabase
          .from("profiles")
          .select("first_name, last_name, email, phone")
          .eq("id", userId)
          .single();
        
        const customerData = {
          user_id: userId,
          first_name: firstOrder.client_first_name || profile?.first_name || 'Client',
          last_name: firstOrder.client_last_name || profile?.last_name || '',
          email: firstOrder.client_email || profile?.email || '',
          phone: firstOrder.client_phone || profile?.phone || '',
          status: 'active' as const
        };
        
        if (!customerData.email) {
          results.errors.push(`Skipping user ${userId}: no email`);
          continue;
        }
        
        if (dryRun) {
          console.log(`[DRY RUN] Would migrate: ${customerData.email} with ${userOrderList.length} orders`);
          results.customers_migrated++;
          
          // Count services that would be created
          for (const order of userOrderList) {
            const services = parseServiceTypes(order.service_type);
            results.subscriptions_created += services.length;
            results.invoices_created += services.length;
          }
          continue;
        }
        
        // Create billing customer
        const { data: newCustomer, error: customerError } = await supabase
          .from("billing_customers")
          .insert(customerData)
          .select()
          .single();
        
        if (customerError) {
          throw new Error(`Failed to create customer: ${customerError.message}`);
        }
        
        results.customers_migrated++;
        
        // Create subscriptions for each service from the most recent order
        const mostRecentOrder = userOrderList[0];
        const services = parseServiceTypes(mostRecentOrder.service_type);
        
        const today = new Date();
        const cycleEnd = new Date();
        cycleEnd.setDate(today.getDate() + 30);
        const cycleStartStr = today.toISOString().split('T')[0];
        const cycleEndStr = cycleEnd.toISOString().split('T')[0];
        
        for (const service of services) {
          // Create subscription
          const { data: subscription, error: subError } = await supabase
            .from("billing_subscriptions")
            .insert({
              customer_id: newCustomer.id,
              plan_code: service.code,
              plan_name: service.name,
              plan_price: service.price,
              service_category: service.category,
              cycle_start_date: cycleStartStr,
              cycle_end_date: cycleEndStr,
              status: 'active'
            })
            .select()
            .single();
          
          if (subError) {
            console.error(`[billing-migrate-clients] Subscription error:`, subError);
            continue;
          }
          
          results.subscriptions_created++;
          
          // Generate invoice number
          const { data: invoiceNumberData } = await supabase
            .rpc("generate_billing_invoice_number");
          
          const invoiceNumber = invoiceNumberData || `MIG-${Date.now()}`;
          
          // Calculate amounts
          const subtotal = service.price;
          const tpsAmount = Math.round(subtotal * TPS_RATE * 100) / 100;
          const tvqAmount = Math.round(subtotal * TVQ_RATE * 100) / 100;
          const total = Math.round((subtotal + tpsAmount + tvqAmount) * 100) / 100;
          
          // Create pending invoice - INTERAC ONLY
          const { data: invoice, error: invoiceError } = await supabase
            .from("billing_invoices")
            .insert({
              subscription_id: subscription.id,
              customer_id: newCustomer.id,
              invoice_number: invoiceNumber,
              type: 'initial',
              subtotal,
              tps_amount: tpsAmount,
              tvq_amount: tvqAmount,
              total,
              currency: 'CAD',
              payment_method: 'interac', // INTERAC ONLY
              status: 'pending',
              cycle_start_date: cycleStartStr,
              cycle_end_date: cycleEndStr,
              due_date: cycleEndStr,
              notes: `Migration depuis commande ${mostRecentOrder.id}`
            })
            .select()
            .single();
          
          if (invoiceError) {
            console.error(`[billing-migrate-clients] Invoice error:`, invoiceError);
            continue;
          }
          
          results.invoices_created++;
          
          // Create invoice line
          await supabase.from("billing_invoice_lines").insert({
            invoice_id: invoice.id,
            description: `${service.name} – 30 jours`,
            unit_price: service.price,
            quantity: 1,
            line_total: service.price
          });
          
          // Create pending payment - INTERAC ONLY
          await supabase.from("billing_payments").insert({
            invoice_id: invoice.id,
            customer_id: newCustomer.id,
            method: 'interac',
            amount: total,
            status: 'pending'
          });
          
          // Update subscription with invoice reference
          await supabase
            .from("billing_subscriptions")
            .update({ last_invoice_id: invoice.id })
            .eq("id", subscription.id);
        }
        
        console.log(`[billing-migrate-clients] Migrated: ${customerData.email}`);
        
      } catch (err) {
        const errorMsg = `Failed to migrate user ${userId}: ${err instanceof Error ? err.message : String(err)}`;
        console.error(`[billing-migrate-clients] ${errorMsg}`);
        results.errors.push(errorMsg);
      }
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        ...results
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (error) {
    console.error("[billing-migrate-clients] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/**
 * Parse service_type string into individual services
 * Examples:
 * - "GIGA + TV 10 choix + 25 chaînes de base , Mobile 50GB 4G Unlimited Canada"
 * - "Internet Fibre 100Mbps"
 */
function parseServiceTypes(serviceType: string | null): { code: string; name: string; price: number; category: string }[] {
  if (!serviceType) return [];
  
  const services: { code: string; name: string; price: number; category: string }[] = [];
  
  // Split by comma
  const parts = serviceType.split(',').map(s => s.trim()).filter(Boolean);
  
  for (const part of parts) {
    let category = 'Other';
    let price = 0;
    
    // Detect category and estimate price
    const lowerPart = part.toLowerCase();
    
    if (lowerPart.includes('mobile') || lowerPart.includes('4g') || lowerPart.includes('5g')) {
      category = 'Mobile';
      if (lowerPart.includes('50gb')) price = 50;
      else if (lowerPart.includes('100gb')) price = 60;
      else if (lowerPart.includes('unlimited')) price = 70;
      else price = 45;
    } else if (lowerPart.includes('tv') || lowerPart.includes('chaîne')) {
      category = 'TV';
      if (lowerPart.includes('premium')) price = 80;
      else if (lowerPart.includes('10 choix')) price = 55;
      else price = 40;
    } else if (lowerPart.includes('internet') || lowerPart.includes('fibre') || lowerPart.includes('giga')) {
      category = 'Internet';
      if (lowerPart.includes('giga')) price = 85;
      else if (lowerPart.includes('500')) price = 75;
      else if (lowerPart.includes('200')) price = 60;
      else if (lowerPart.includes('100')) price = 50;
      else price = 45;
    } else if (lowerPart.includes('sécurité') || lowerPart.includes('security')) {
      category = 'Sécurité';
      price = 30;
    }
    
    services.push({
      code: part.toUpperCase().replace(/\s+/g, '_').substring(0, 50),
      name: part,
      price,
      category
    });
  }
  
  return services;
}
