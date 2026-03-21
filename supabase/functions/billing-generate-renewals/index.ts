import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { computeTaxes } from "../_shared/tax-constants.ts";
// STRIPE DISABLED — import removed: createNivraPaymentIntent

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
        
        // ═══ PROMO DURATION CHECK ═══
        // If this subscription was created with a duration-limited promo,
        // check if we're still within the promo window and apply the discount.
        let promoDiscount = 0;
        let promoNote = "";
        
        if (sub.order_id) {
          // Look up the order's pricing_snapshot for promo info
          const { data: orderData } = await supabase
            .from("orders")
            .select("pricing_snapshot, promo_code")
            .eq("id", sub.order_id)
            .single();
          
          if (orderData?.promo_code && orderData?.pricing_snapshot) {
            const snapshot = orderData.pricing_snapshot;
            const promoApplied = snapshot?.promo_applied;
            
            if (promoApplied?.duration_months && promoApplied.duration === "limited") {
              // Count how many renewal invoices exist for this subscription
              const { count: renewalCount } = await supabase
                .from("billing_invoices")
                .select("id", { count: "exact", head: true })
                .eq("subscription_id", sub.id)
                .eq("type", "renewal")
                .not("status", "in", '("void","cancelled")');
              
              // +1 because the initial order invoice counts as cycle 1
              const currentCycle = (renewalCount || 0) + 1;
              
              if (currentCycle < promoApplied.duration_months) {
                // Still within promo window — apply discount
                promoDiscount = promoApplied.discount_amount || 0;
                promoNote = ` (Promo ${promoApplied.code}: -${promoDiscount}$ cycle ${currentCycle + 1}/${promoApplied.duration_months})`;
                console.log(`[billing-generate-renewals] Applying promo ${promoApplied.code}: -${promoDiscount}$ (cycle ${currentCycle + 1}/${promoApplied.duration_months})`);
              } else {
                console.log(`[billing-generate-renewals] Promo ${promoApplied.code} expired (cycle ${currentCycle + 1} > ${promoApplied.duration_months})`);
              }
            }
          }
        }
        
        // ═══ AUTOPAY DISCOUNT CHECK ═══
        // If customer has autopay enabled, apply $5 monthly discount
        let autopayDiscount = 0;
        let autopayNote = "";
        
        const { data: customerData } = await supabase
          .from("billing_customers")
          .select("autopay_enabled, autopay_discount_active, stripe_customer_id, default_payment_method_id")
          .eq("id", sub.customer_id)
          .single();
        
        const isAutopayEligible = customerData?.autopay_enabled && 
                                   customerData?.autopay_discount_active &&
                                   customerData?.stripe_customer_id &&
                                   customerData?.default_payment_method_id;
        
        if (isAutopayEligible) {
          autopayDiscount = 5;
          autopayNote = " (Rabais prélèvement automatique -5$)";
          console.log(`[billing-generate-renewals] Autopay discount: -5$ for customer ${sub.customer_id}`);
        }
        
        // Calculate amounts via canonical tax module
        const subtotal = Math.max(0, sub.plan_price - promoDiscount - autopayDiscount);
        const { tps: tpsAmount, tvq: tvqAmount, total } = computeTaxes(subtotal);
        
        // Due date = current cycle end date (J0) - prepaid model requires payment BEFORE service expires
        const dueDate = sub.cycle_end_date;
        
        // Determine payment method based on subscription/autopay
        const hasPayPalSubscription = !!sub.paypal_subscription_id;
        const paymentMethod = hasPayPalSubscription ? 'paypal' : (isAutopayEligible ? 'card' : 'interac');
        
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
            payment_method: paymentMethod,
            status: 'pending',
            cycle_start_date: newCycleStart.toISOString().split('T')[0],
            cycle_end_date: newCycleEnd.toISOString().split('T')[0],
            due_date: dueDate,
            notes: [promoNote, autopayNote].filter(Boolean).join("") || null
          })
          .select()
          .single();
        
        if (invoiceError) throw invoiceError;
        
        // Create invoice lines
        const invoiceLines: any[] = [
          {
            invoice_id: invoice.id,
            description: `${sub.plan_name} – Renouvellement 30 jours`,
            unit_price: sub.plan_price,
            quantity: 1,
            line_total: sub.plan_price,
            line_type: 'service'
          }
        ];
        
        // Add promo discount line if applicable
        if (promoDiscount > 0) {
          invoiceLines.push({
            invoice_id: invoice.id,
            description: `Rabais promotionnel${promoNote}`,
            unit_price: -promoDiscount,
            quantity: 1,
            line_total: -promoDiscount,
            line_type: 'discount'
          });
        }
        
        // ═══ AUTOPAY DISCOUNT LINE ═══
        if (autopayDiscount > 0) {
          invoiceLines.push({
            invoice_id: invoice.id,
            description: "Rabais prélèvement automatique",
            unit_price: -autopayDiscount,
            quantity: 1,
            line_total: -autopayDiscount,
            line_type: 'discount'
          });
        }
        
        await supabase
          .from("billing_invoice_lines")
          .insert(invoiceLines);
        
        // Create pending payment with appropriate method
        const { data: payNumData } = await supabase.rpc("generate_payment_number");
        const paymentNumber = payNumData || `PAY-${Date.now()}`;
        
        await supabase
          .from("billing_payments")
          .insert({
            invoice_id: invoice.id,
            customer_id: sub.customer_id,
            method: paymentMethod,
            provider: isAutopayEligible ? 'stripe' : (hasPayPalSubscription ? 'paypal' : 'interac'),
            amount: total,
            status: 'pending',
            payment_number: paymentNumber,
            source: 'live',
            created_by_name: 'billing_renewal',
            created_by_role: 'system',
          });
        
        // ═══ AUTOPAY: Auto-charge via Stripe ═══
        if (isAutopayEligible && customerData?.stripe_customer_id && customerData?.default_payment_method_id) {
          console.log(`[billing-generate-renewals] Triggering Stripe autopay for customer ${sub.customer_id}`);
          try {
            const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
            if (stripeKey) {
              const Stripe = (await import("npm:stripe@18")).default;
              const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
              
              const piResult = await createNivraPaymentIntent({
                stripe,
                customer_email: customerData.email || "",
                invoice_id: invoice.id,
                invoice_number: invoiceNumber,
                service_name: sub.plan_name || "Nivra Telecom",
                total_amount: total,
                subscription_id: sub.id,
                customer_id: sub.customer_id,
                existing_stripe_customer_id: customerData.stripe_customer_id,
                subtotal,
                tax_tps: tpsAmount,
                tax_tvq: tvqAmount,
                monthly_amount: sub.plan_price,
                discount_amount: promoDiscount > 0 ? promoDiscount : undefined,
                capture_method: "automatic",
                source: "autopay_renewal",
                intent_context: "autopay_renewal",
                off_session: true,
                confirm: true,
                payment_method: customerData.default_payment_method_id,
              });
              
              console.log(`[billing-generate-renewals] ✓ Stripe autopay PI ${piResult.payment_intent_id} status: ${piResult.status}`);
              
              // If succeeded immediately, apply payment
              if (piResult.status === "succeeded") {
                await supabase.rpc("apply_payment_to_invoice", {
                  p_invoice_id: invoice.id,
                  p_amount: total,
                  p_method: "card",
                  p_provider: "stripe",
                  p_provider_payment_id: piResult.payment_intent_id,
                  p_source: "live",
                  p_created_by_name: "autopay_renewal",
                  p_created_by_role: "system",
                  p_customer_id: sub.customer_id,
                });
                console.log(`[billing-generate-renewals] ✓ Autopay payment applied for invoice ${invoiceNumber}`);
              }
              // If requires_action, the webhook will handle it
            }
          } catch (chargeErr) {
            console.error(`[billing-generate-renewals] Stripe autopay error:`, chargeErr);
            // Continue - invoice remains pending for manual payment
          }
        }
        // If PayPal subscription, trigger automatic charge
        else if (hasPayPalSubscription) {
          console.log(`[billing-generate-renewals] Triggering PayPal auto-charge for ${sub.id}`);
          try {
            await supabase.functions.invoke("paypal-charge-subscription", {
              body: {
                subscription_id: sub.id,
                invoice_id: invoice.id,
                amount: total,
              },
            });
          } catch (chargeErr) {
            console.error(`[billing-generate-renewals] PayPal charge error:`, chargeErr);
          }
        }
        
        // Queue reminder email
        if (sub.customer) {
          await supabase.from("email_queue").insert({
            event_key: `billing_renewal_${sub.id}_${newCycleStart.toISOString().split('T')[0]}`,
            to_email: sub.customer.email,
            template_key: "invoice_created",
            template_vars: {
              client_name: `${sub.customer.first_name} ${sub.customer.last_name}`,
              invoice_number: invoiceNumber,
              plan_name: sub.plan_name,
              total: total.toFixed(2),
              amount: total.toFixed(2),
              due_date: dueDate,
              days_remaining: 3
            },
            status: "queued",
            attempts: 0,
            max_attempts: 5
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
