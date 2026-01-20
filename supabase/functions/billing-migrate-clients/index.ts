import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Migration script: Migrate existing clients to new billing system
 * This creates billing_customers and billing_subscriptions from existing data
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const dryRun = body.dry_run !== false; // Default to dry run
    
    console.log(`[billing-migrate-clients] Starting migration (dry_run: ${dryRun})`);
    
    const results = {
      dry_run: dryRun,
      customers_found: 0,
      customers_migrated: 0,
      subscriptions_created: 0,
      already_migrated: 0,
      errors: [] as string[]
    };
    
    // Fetch existing profiles with active accounts
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select(`
        id,
        first_name,
        last_name,
        email,
        phone,
        created_at
      `)
      .not("email", "is", null);
    
    if (profilesError) throw profilesError;
    
    results.customers_found = profiles?.length || 0;
    console.log(`[billing-migrate-clients] Found ${results.customers_found} profiles to migrate`);
    
    for (const profile of profiles || []) {
      try {
        // Check if already migrated
        const { data: existingCustomer } = await supabase
          .from("billing_customers")
          .select("id")
          .eq("email", profile.email)
          .single();
        
        if (existingCustomer) {
          results.already_migrated++;
          continue;
        }
        
        if (dryRun) {
          console.log(`[billing-migrate-clients] [DRY RUN] Would migrate: ${profile.email}`);
          results.customers_migrated++;
          continue;
        }
        
        // Create billing customer
        const { data: newCustomer, error: customerError } = await supabase
          .from("billing_customers")
          .insert({
            user_id: profile.id,
            first_name: profile.first_name || 'Client',
            last_name: profile.last_name || '',
            email: profile.email,
            phone: profile.phone || '',
            status: 'active'
          })
          .select()
          .single();
        
        if (customerError) {
          throw new Error(`Failed to create customer: ${customerError.message}`);
        }
        
        results.customers_migrated++;
        
        // Check for active services from client_services or orders
        const { data: activeServices } = await supabase
          .from("client_services")
          .select("*")
          .eq("user_id", profile.id)
          .eq("status", "active");
        
        // Create subscriptions for active services
        for (const service of activeServices || []) {
          const today = new Date();
          const cycleEnd = new Date();
          cycleEnd.setDate(today.getDate() + 30);
          
          const { error: subError } = await supabase
            .from("billing_subscriptions")
            .insert({
              customer_id: newCustomer.id,
              plan_code: service.service_type || 'UNKNOWN',
              plan_name: service.service_name || 'Service Nivra',
              plan_price: service.monthly_price || 0,
              cycle_start_date: today.toISOString().split('T')[0],
              cycle_end_date: cycleEnd.toISOString().split('T')[0],
              status: 'active'
            });
          
          if (!subError) {
            results.subscriptions_created++;
          }
        }
        
        console.log(`[billing-migrate-clients] Migrated: ${profile.email}`);
        
      } catch (err: unknown) {
        const errorMsg = `Failed to migrate ${profile.email}: ${err instanceof Error ? err.message : String(err)}`;
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
    
  } catch (error: unknown) {
    console.error("[billing-migrate-clients] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
