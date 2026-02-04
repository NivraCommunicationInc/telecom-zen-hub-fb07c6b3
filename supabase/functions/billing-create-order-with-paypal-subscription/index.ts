import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * ============================================================================
 * BILLING V2 - CREATE ORDER WITH PAYPAL SUBSCRIPTION
 * ============================================================================
 * 
 * This function creates billing records for a new order with PayPal auto-billing.
 * Customers who opt-in receive a $5/month discount on their subscription.
 * PayPal handles automatic monthly charges.
 * 
 * FLOW:
 * 1. Create/get billing_customer
 * 2. Create PayPal billing plan with discounted price
 * 3. Create PayPal subscription and get approval URL
 * 4. Create billing_subscription (pending) with PayPal IDs
 * 5. Create initial invoice (pending)
 * 6. Customer approves via PayPal → webhook activates everything
 * 
 * @author Nivra Telecom
 * @version 2.1.0 - PayPal Auto-Billing with Discount
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Auto-billing discount amount
const AUTO_BILLING_DISCOUNT = 5.00;

interface ServiceItem {
  plan_code: string;
  plan_name: string;
  plan_price: number;
  category: string;
}

interface CreateOrderRequest {
  user_id?: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  services: ServiceItem[];
  order_id?: string;
  order_number?: string;
  // PayPal auto-billing
  enable_auto_billing: boolean;
}

async function getPayPalAccessToken(): Promise<string> {
  const clientId = Deno.env.get("PAYPAL_CLIENT_ID");
  const clientSecret = Deno.env.get("PAYPAL_SECRET");
  
  if (!clientId || !clientSecret) {
    throw new Error("PayPal credentials not configured");
  }

  const auth = btoa(`${clientId}:${clientSecret}`);
  const response = await fetch("https://api-m.paypal.com/v1/oauth2/token", {
    method: "POST",
    headers: {
      "Authorization": `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    throw new Error("Failed to get PayPal access token");
  }

  const data = await response.json();
  return data.access_token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const baseUrl = Deno.env.get("APP_BASE_URL")?.split(",")[0] || "https://nivra-telecom.ca";

    const body: CreateOrderRequest = await req.json();
    
    // Validate required fields
    if (!body.email || !body.first_name || !body.last_name || !body.phone) {
      throw new Error("Missing required customer fields");
    }
    
    if (!body.services || body.services.length === 0) {
      throw new Error("At least one service is required");
    }

    if (!body.enable_auto_billing) {
      throw new Error("This endpoint requires enable_auto_billing=true. Use billing-create-order for non-auto-billing.");
    }
    
    // Tax rates Quebec
    const TPS_RATE = 0.05;
    const TVQ_RATE = 0.09975;
    
    // Calculate activation fee
    const serviceCount = body.services.length;
    const activationFee = serviceCount === 1 ? 25.00 : 45.00;
    
    // Calculate total monthly amount (with discount)
    const totalMonthlyBase = body.services.reduce((sum, s) => sum + s.plan_price, 0);
    const discountedMonthly = totalMonthlyBase - AUTO_BILLING_DISCOUNT;
    
    console.log(`[billing-create-order-paypal] Creating order with auto-billing. Monthly: ${totalMonthlyBase} → ${discountedMonthly} (${AUTO_BILLING_DISCOUNT}$ discount)`);
    
    // Step 1: Get or create billing customer
    let customerId: string;
    
    const { data: existingCustomer } = await supabase
      .from("billing_customers")
      .select("id")
      .eq("email", body.email)
      .single();
    
    if (existingCustomer) {
      customerId = existingCustomer.id;
      if (body.user_id) {
        await supabase
          .from("billing_customers")
          .update({ user_id: body.user_id })
          .eq("id", customerId)
          .is("user_id", null);
      }
    } else {
      const { data: newCustomer, error: customerError } = await supabase
        .from("billing_customers")
        .insert({
          user_id: body.user_id || null,
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
    }
    
    console.log(`[billing-create-order-paypal] Customer: ${customerId}`);
    
    // Step 2: Create PayPal billing plan
    const accessToken = await getPayPalAccessToken();
    
    // Create product with unique ID based on timestamp to avoid conflicts
    const productId = `NIVRA_SUB_${Date.now()}`;
    
    const productResponse = await fetch("https://api-m.paypal.com/v1/catalogs/products", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "PayPal-Request-Id": `prod_${Date.now()}`,
      },
      body: JSON.stringify({
        id: productId,
        name: `Abonnement Nivra - ${body.services.map(s => s.plan_name).join(" + ")}`,
        description: `Abonnement mensuel automatique Nivra Telecom avec rabais de ${AUTO_BILLING_DISCOUNT}$`,
        type: "SERVICE",
        category: "SOFTWARE",
      }),
    });

    if (!productResponse.ok) {
      const prodError = await productResponse.text();
      console.error("[PayPal] Product creation error:", prodError);
      throw new Error(`Failed to create product: ${prodError}`);
    }

    const productData = await productResponse.json();
    console.log(`[billing-create-order-paypal] PayPal product created: ${productData.id}`);
    
    // Create billing plan with discounted price
    const planPayload = {
      product_id: productData.id,
      name: `${body.services.map(s => s.plan_name).join(" + ")} - Auto-Paiement`,
      description: `Abonnement mensuel avec rabais de ${AUTO_BILLING_DISCOUNT}$`,
      billing_cycles: [
        {
          frequency: {
            interval_unit: "MONTH",
            interval_count: 1,
          },
          tenure_type: "REGULAR",
          sequence: 1,
          total_cycles: 0, // Unlimited
          pricing_scheme: {
            fixed_price: {
              value: discountedMonthly.toFixed(2),
              currency_code: "CAD",
            },
          },
        },
      ],
      payment_preferences: {
        auto_bill_outstanding: true,
        setup_fee: {
          value: (activationFee + discountedMonthly).toFixed(2), // First month + activation
          currency_code: "CAD",
        },
        setup_fee_failure_action: "CANCEL",
        payment_failure_threshold: 3,
      },
      taxes: {
        percentage: "14.975", // TPS + TVQ
        inclusive: false,
      },
    };
    
    const planResponse = await fetch("https://api-m.paypal.com/v1/billing/plans", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "PayPal-Request-Id": `plan_auto_${Date.now()}`,
      },
      body: JSON.stringify(planPayload),
    });

    if (!planResponse.ok) {
      const error = await planResponse.text();
      console.error("[PayPal] Plan creation error:", error);
      throw new Error(`Failed to create billing plan: ${error}`);
    }

    const planData = await planResponse.json();
    console.log(`[billing-create-order-paypal] PayPal plan created: ${planData.id}`);
    
    // Step 3: Create PayPal subscription
    const subscriptionPayload = {
      plan_id: planData.id,
      subscriber: {
        name: {
          given_name: body.first_name,
          surname: body.last_name,
        },
        email_address: body.email,
      },
      application_context: {
        brand_name: "Nivra Telecom",
        locale: "fr-CA",
        shipping_preference: "NO_SHIPPING",
        user_action: "SUBSCRIBE_NOW",
        return_url: `${baseUrl}/checkout/paypal-success?order=${body.order_id || "new"}`,
        cancel_url: `${baseUrl}/checkout/paypal-cancelled`,
      },
      custom_id: `order_${body.order_id || Date.now()}`,
    };

    const subscriptionResponse = await fetch("https://api-m.paypal.com/v1/billing/subscriptions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "PayPal-Request-Id": `sub_auto_${Date.now()}`,
      },
      body: JSON.stringify(subscriptionPayload),
    });

    if (!subscriptionResponse.ok) {
      const error = await subscriptionResponse.text();
      console.error("[PayPal] Subscription creation error:", error);
      throw new Error(`Failed to create subscription: ${error}`);
    }

    const paypalSubscription = await subscriptionResponse.json();
    const approvalUrl = paypalSubscription.links?.find((l: { rel: string }) => l.rel === "approve")?.href;
    
    console.log(`[billing-create-order-paypal] PayPal subscription created: ${paypalSubscription.id}`);
    
    // Step 4: Create billing records
    const cycleStartDate = new Date();
    const cycleEndDate = new Date();
    cycleEndDate.setDate(cycleEndDate.getDate() + 30);
    
    const cycleStartStr = cycleStartDate.toISOString().split('T')[0];
    const cycleEndStr = cycleEndDate.toISOString().split('T')[0];
    
    const results = {
      customer_id: customerId,
      subscriptions: [] as Array<{
        subscription_id: string;
        invoice_id: string;
        invoice_number: string;
        total: number;
      }>,
      total_amount: 0,
      activation_fee: activationFee,
      discount_applied: AUTO_BILLING_DISCOUNT,
      paypal_subscription_id: paypalSubscription.id,
      paypal_plan_id: planData.id,
      approval_url: approvalUrl,
    };
    
    // Create subscription + invoice for each service
    for (let i = 0; i < body.services.length; i++) {
      const service = body.services[i];
      
      // Apply discount proportionally to each service
      const serviceDiscountShare = (service.plan_price / totalMonthlyBase) * AUTO_BILLING_DISCOUNT;
      const discountedPrice = service.plan_price - serviceDiscountShare;
      
      // Create billing subscription with PayPal IDs
      const { data: subscription, error: subError } = await supabase
        .from("billing_subscriptions")
        .insert({
          customer_id: customerId,
          plan_code: service.plan_code,
          plan_name: service.plan_name,
          plan_price: discountedPrice, // Store discounted price
          service_category: service.category,
          cycle_start_date: cycleStartStr,
          cycle_end_date: cycleEndStr,
          status: 'pending',
          auto_billing_enabled: true,
          paypal_subscription_id: paypalSubscription.id,
          paypal_plan_id: planData.id,
        })
        .select()
        .single();
      
      if (subError) throw subError;
      
      // Generate unique invoice number
      const now = new Date();
      const dateStr = `${now.getFullYear().toString().slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
      const uniqueSuffix = `${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(-3).toUpperCase()}`;
      const invoiceNumber = `INV-${dateStr}-${uniqueSuffix}`;
      
      // Calculate amounts with discount
      const invoiceActivationFee = i === 0 ? activationFee : 0;
      const subtotal = discountedPrice + invoiceActivationFee;
      const tpsAmount = Math.round(subtotal * TPS_RATE * 100) / 100;
      const tvqAmount = Math.round(subtotal * TVQ_RATE * 100) / 100;
      const total = Math.round((subtotal + tpsAmount + tvqAmount) * 100) / 100;
      
      // Create invoice - PayPal method, pending
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
          payment_method: 'paypal',
          status: 'pending',
          cycle_start_date: cycleStartStr,
          cycle_end_date: cycleEndStr,
          due_date: cycleEndStr,
          notes: `Paiement automatique PayPal - Rabais ${AUTO_BILLING_DISCOUNT}$${body.order_number ? ` | Commande: ${body.order_number}` : ""}`
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
        },
        {
          invoice_id: invoice.id,
          description: `Rabais paiement automatique`,
          unit_price: -serviceDiscountShare,
          quantity: 1,
          line_total: -serviceDiscountShare
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
      
      // Create pending payment record
      await supabase.from("billing_payments").insert({
        invoice_id: invoice.id,
        customer_id: customerId,
        method: 'paypal',
        amount: total,
        status: 'pending',
        provider: 'paypal',
        provider_payment_id: paypalSubscription.id,
      });
      
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
    }
    
    // Queue confirmation email
    await supabase.from("email_queue").insert({
      event_key: `billing_paypal_${results.customer_id}_${Date.now()}`,
      to_email: body.email,
      template_key: "invoice_created",
      template_vars: {
        client_name: `${body.first_name} ${body.last_name}`,
        invoice_number: results.subscriptions[0]?.invoice_number || 'N/A',
        plan_name: body.services.map(s => s.plan_name).join(', '),
        subtotal: discountedMonthly.toFixed(2),
        activation_fee: activationFee.toFixed(2),
        discount: AUTO_BILLING_DISCOUNT.toFixed(2),
        total: results.total_amount.toFixed(2),
        amount: results.total_amount.toFixed(2),
        payment_method: 'PayPal (Paiement automatique)',
        auto_billing: true,
        monthly_discount: AUTO_BILLING_DISCOUNT,
      },
      status: "queued",
      attempts: 0,
      max_attempts: 5
    });
    
    // Log activity
    await supabase.from("activity_logs").insert({
      user_id: body.user_id || "00000000-0000-0000-0000-000000000000",
      entity_type: "billing_subscription",
      entity_id: results.subscriptions[0]?.subscription_id,
      action: "created_with_auto_billing",
      details: {
        paypal_subscription_id: paypalSubscription.id,
        paypal_plan_id: planData.id,
        discount_applied: AUTO_BILLING_DISCOUNT,
        total_amount: results.total_amount,
      },
    });
    
    console.log(`[billing-create-order-paypal] Order complete. Total: $${results.total_amount.toFixed(2)}, Approval URL: ${approvalUrl}`);
    
    return new Response(
      JSON.stringify({
        success: true,
        requires_approval: true,
        ...results
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (error: unknown) {
    console.error("[billing-create-order-paypal] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
