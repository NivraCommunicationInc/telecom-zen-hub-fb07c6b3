import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * ============================================================================
 * BILLING V2 - CREATE ORDER (v2.1 - Smart Payment Detection)
 * ============================================================================
 * 
 * ┌────────────────────────────────────────────────────────────────────────┐
 * │  RÈGLE SYSTÈME VERROUILLÉE - MODÈLE 100% PRÉPAYÉ                       │
 * │                                                                         │
 * │  LE CYCLE DE FACTURATION NE COMMENCE JAMAIS À LA COMMANDE.             │
 * │  LE CYCLE COMMENCE UNIQUEMENT QUAND LE PAIEMENT EST CONFIRMÉ.          │
 * │                                                                         │
 * │  MISE À JOUR v2.1: Détection intelligente de la méthode de paiement    │
 * │  - PayPal: Si capture_id fourni → Invoice PAID + Payment CONFIRMED     │
 * │  - Interac: Invoice PENDING + Payment PENDING                          │
 * │                                                                         │
 * │  Cette règle est IMMUABLE et protégée par des triggers SQL.            │
 * └────────────────────────────────────────────────────────────────────────┘
 * 
 * @author Nivra Telecom
 * @version 2.1.0 - Smart Payment Detection
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ServiceItem {
  plan_code: string;
  plan_name: string;
  plan_price: number;
  category: string;
}

/**
 * BILLING TOTALS - Source of Truth from Checkout Snapshot (v2.2)
 * These values come directly from the client's checkout and MUST be used as-is
 * to ensure PDF invoices match exactly what the client saw.
 */
interface BillingTotals {
  subtotal: number;           // Gross subtotal before taxes and discounts
  discount_amount: number;    // Applied promo/preauth discount
  welcome_discount_amount?: number; // Welcome discount for new customers (50% on services)
  base_amount: number;        // Taxable amount (subtotal - discount)
  tps_amount: number;         // TPS (5%)
  tvq_amount: number;         // TVQ (9.975%)
  total: number;              // Final total to pay
  promo_code?: string;        // Applied promo code
  promo_name?: string;        // Promo description
  payment_method?: string;    // Payment method used
  monthly_recurring?: number; // Monthly recurring amount
  one_time_fees?: number;     // One-time fees
}

interface CreateOrderRequest {
  // Customer info — identity hydrated from profiles server-side
  user_id?: string;
  first_name?: string;  // Optional: overridden by profile if user_id provided
  last_name?: string;   // Optional: overridden by profile if user_id provided
  email?: string;       // Optional: overridden by profile if user_id provided
  phone: string;
  // Services
  services: ServiceItem[];
  // Order reference
  order_id?: string;
  order_number?: string;
  // PAYMENT INFO (v2.1) - Smart detection
  payment_method?: 'paypal' | 'interac' | 'etransfer' | 'credit_card' | 'promo_free';
  payment_status?: 'paid' | 'captured' | 'pending' | 'pre_authorized';
  payment_reference?: string; // PayPal capture_id or Interac reference
  total_amount?: number; // Total amount paid (for PayPal)
  // BILLING TOTALS (v2.2) - Snapshot from checkout as source of truth
  billing_totals?: BillingTotals;
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
    
    // IDENTITY CORE: Hydrate identity from profiles if user_id provided
    if (body.user_id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, last_name, email, phone")
        .eq("user_id", body.user_id)
        .maybeSingle();
      
      if (profile) {
        if (profile.first_name) body.first_name = profile.first_name;
        if (profile.last_name) body.last_name = profile.last_name;
        if (profile.email) body.email = profile.email;
        if (profile.phone && !body.phone) body.phone = profile.phone;
      }
    }

    console.log("[billing-create-order] Received request:", {
      email: body.email,
      payment_method: body.payment_method,
      payment_status: body.payment_status,
      payment_reference: body.payment_reference,
      services_count: body.services?.length,
    });
    
    // Validate required fields
    if (!body.email || !body.first_name || !body.last_name || !body.phone) {
      throw new Error("Missing required customer fields: email, first_name, last_name, phone");
    }
    
    if (!body.services || body.services.length === 0) {
      throw new Error("At least one service is required");
    }
    
    // SMART PAYMENT DETECTION (v2.1)
    // Determine if this is a completed PayPal payment or pending Interac
    const isPayPalPaid = (
      body.payment_method === 'paypal' && 
      body.payment_reference && 
      (body.payment_status === 'paid' || body.payment_status === 'captured')
    );
    
    const effectivePaymentMethod = body.payment_method === 'etransfer' ? 'interac' : (body.payment_method || 'interac');
    const effectiveInvoiceStatus = isPayPalPaid ? 'paid' : 'pending';
    const effectivePaymentStatus = isPayPalPaid ? 'confirmed' : 'pending';
    
    console.log("[billing-create-order] Payment detection:", {
      isPayPalPaid,
      effectivePaymentMethod,
      effectiveInvoiceStatus,
      effectivePaymentStatus,
    });
    
    // Tax rates Quebec
    const TPS_RATE = 0.05;
    const TVQ_RATE = 0.09975;
    
    // BILLING TOTALS V2.2 - Use checkout snapshot as source of truth when provided
    const hasBillingTotals = body.billing_totals && 
      typeof body.billing_totals.total === 'number' && 
      body.billing_totals.total >= 0;
    
    console.log("[billing-create-order] Billing totals detection:", {
      hasBillingTotals,
      billing_totals: body.billing_totals,
    });
    
    // Calculate activation fee based on service count (fallback if not in billing_totals)
    const serviceCount = body.services.length;
    const activationFee = serviceCount === 1 ? 25.00 : 45.00;
    const activationFeePerInvoice = serviceCount > 0 ? activationFee : 0;
    
    // Step 1: Get or create billing customer
    let customerId: string;
    
    const { data: existingCustomer } = await supabase
      .from("billing_customers")
      .select("id")
      .eq("email", body.email)
      .single();
    
    if (existingCustomer) {
      customerId = existingCustomer.id;
      console.log(`[billing-create-order] Using existing customer: ${customerId}`);
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
      console.log(`[billing-create-order] Created new customer: ${customerId}`);
    }
    
    // Resolve address_id for residential services (Internet, TV, Combo)
    // Required by chk_residential_address_required constraint
    let addressId: string | null = null;
    const needsAddress = body.services.some(s => 
      ['internet', 'tv', 'combo', 'combo_tv_internet'].includes(s.category?.toLowerCase() || '')
    );
    
    if (needsAddress) {
      const resolveUserId = body.user_id;
      
      // Strategy 1: Resolve from order shipping fields
      if (body.order_id) {
        try {
          const { data: orderData, error: orderErr } = await supabase
            .from("orders")
            .select("shipping_address, shipping_city, shipping_province, shipping_postal_code, user_id")
            .eq("id", body.order_id)
            .single();
          
          console.log(`[billing-create-order] Order lookup: found=${!!orderData}, error=${orderErr?.message || 'none'}, address=${orderData?.shipping_address}`);
          
          if (orderData?.shipping_address) {
            const clientId = orderData.user_id || resolveUserId;
            
            // Find ALL accounts for this user - use select without maybeSingle to avoid errors
            const { data: accounts, error: accErr } = await supabase
              .from("accounts")
              .select("id")
              .eq("client_id", clientId)
              .order("created_at", { ascending: true })
              .limit(5);
            
            console.log(`[billing-create-order] Account lookup: found=${accounts?.length || 0}, error=${accErr?.message || 'none'}`);
            
            if (accounts && accounts.length > 0) {
              // Search across ALL accounts for matching address
              for (const account of accounts) {
                const { data: existingAddrs, error: addrErr } = await supabase
                  .from("service_addresses")
                  .select("id")
                  .eq("account_id", account.id)
                  .eq("address_line", orderData.shipping_address)
                  .limit(1);
                
                if (existingAddrs && existingAddrs.length > 0) {
                  addressId = existingAddrs[0].id;
                  console.log(`[billing-create-order] Found existing address: ${addressId} on account ${account.id}`);
                  break;
                }
              }
              
              // If not found on any account, create on first account
              if (!addressId) {
                const targetAccountId = accounts[0].id;
                console.log(`[billing-create-order] Creating new address on account ${targetAccountId}`);
                const { data: newAddr, error: newAddrErr } = await supabase
                  .from("service_addresses")
                  .insert({
                    account_id: targetAccountId,
                    label: orderData.shipping_city || "Adresse principale",
                    address_line: orderData.shipping_address,
                    city: orderData.shipping_city || null,
                    province: orderData.shipping_province || "QC",
                    postal_code: orderData.shipping_postal_code || null,
                    is_primary: true,
                    is_default: true,
                  })
                  .select("id")
                  .single();
                
                if (newAddrErr) {
                  console.error(`[billing-create-order] Address create error: ${newAddrErr.message}`);
                  // Try RPC fallback
                  const { data: rpcAddr } = await supabase.rpc("resolve_or_create_service_address", {
                    p_account_id: targetAccountId,
                    p_address_line: orderData.shipping_address,
                    p_city: orderData.shipping_city || '',
                    p_province: orderData.shipping_province || 'QC',
                    p_postal_code: orderData.shipping_postal_code || '',
                  });
                  if (rpcAddr) addressId = rpcAddr;
                } else if (newAddr) {
                  addressId = newAddr.id;
                }
              }
            } else {
              // No account exists - create one, then create address
              console.log(`[billing-create-order] No account found for client ${clientId}, creating one`);
              const { data: newAccount, error: newAccErr } = await supabase
                .from("accounts")
                .insert({
                  client_id: clientId,
                  account_number: String(Math.floor(100000 + Math.random() * 900000)),
                  status: "active",
                  primary_service_address: orderData.shipping_address,
                  primary_service_city: orderData.shipping_city,
                  primary_service_province: orderData.shipping_province || "QC",
                  primary_service_postal_code: orderData.shipping_postal_code,
                })
                .select("id")
                .single();
              
              if (newAccErr) {
                console.error(`[billing-create-order] Account create error: ${newAccErr.message}`);
              } else if (newAccount) {
                const { data: newAddr } = await supabase
                  .from("service_addresses")
                  .insert({
                    account_id: newAccount.id,
                    label: orderData.shipping_city || "Adresse principale",
                    address_line: orderData.shipping_address,
                    city: orderData.shipping_city || null,
                    province: orderData.shipping_province || "QC",
                    postal_code: orderData.shipping_postal_code || null,
                    is_primary: true,
                    is_default: true,
                  })
                  .select("id")
                  .single();
                if (newAddr) addressId = newAddr.id;
              }
            }
          }
        } catch (addrResolveErr) {
          console.error(`[billing-create-order] Address resolution exception:`, addrResolveErr);
        }
      }
      
      console.log(`[billing-create-order] Final address resolution: addressId=${addressId}, needsAddress=${needsAddress}`);
      
      // HARD FAIL if residential service needs address but none resolved
      if (!addressId) {
        console.error(`[billing-create-order] CRITICAL: Cannot resolve address for residential service. order_id=${body.order_id}`);
      }
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
      activation_fee: activationFee,
      payment_method: effectivePaymentMethod,
      invoice_status: effectiveInvoiceStatus,
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
      
      // Determine if this service needs address_id
      const serviceNeedsAddress = ['internet', 'tv', 'combo', 'combo_tv_internet'].includes(
        service.category?.toLowerCase() || ''
      );
      
      // Create subscription with appropriate status (IDEMPOTENT — reuse if exists)
      const subscriptionStatus = isPayPalPaid ? 'active' : 'pending';
      let subscription: { id: string } | null = null;
      
      // Check for existing subscription first (created by orchestrate_order RPC)
      if (body.order_id) {
        const { data: existingSub } = await supabase
          .from("billing_subscriptions")
          .select("id")
          .eq("order_id", body.order_id)
          .eq("customer_id", customerId)
          .limit(1)
          .maybeSingle();
        
        if (existingSub) {
          subscription = existingSub;
          console.log(`[billing-create-order] Reusing existing subscription: ${subscription.id}`);
        }
      }
      
      if (!subscription) {
        const { data: newSub, error: subError } = await supabase
          .from("billing_subscriptions")
          .insert({
            customer_id: customerId,
            plan_code: service.plan_code,
            plan_name: service.plan_name,
            plan_price: service.plan_price,
            service_category: service.category,
            cycle_start_date: cycleStartStr,
            cycle_end_date: cycleEndStr,
            status: subscriptionStatus,
            auto_billing_enabled: isPayPalPaid,
            order_id: body.order_id || null,
            address_id: serviceNeedsAddress ? addressId : null,
          })
          .select()
          .single();
        
        if (subError) throw subError;
        subscription = newSub;
        console.log(`[billing-create-order] Created new subscription: ${subscription!.id}`);
      }
      
      // Generate invoice number
      const { data: invoiceNumberData } = await supabase
        .rpc("generate_billing_invoice_number");
      
      const invoiceNumber = invoiceNumberData || `INV-${Date.now()}-${i}`;
      
      // V2.2: Use billing_totals from checkout when available (first invoice only)
      // This ensures PDF matches exactly what client saw at checkout
      let subtotal: number;
      let tpsAmount: number;
      let tvqAmount: number;
      let total: number;
      let discountAmount = 0;
      let invoiceActivationFee = i === 0 ? activationFeePerInvoice : 0;
      
      if (hasBillingTotals && i === 0) {
        // USE CHECKOUT SNAPSHOT AS SOURCE OF TRUTH
        const bt = body.billing_totals!;
        subtotal = bt.subtotal;
        tpsAmount = bt.tps_amount;
        tvqAmount = bt.tvq_amount;
        total = bt.total;
        discountAmount = bt.discount_amount || 0;
        
        console.log("[billing-create-order] Using checkout billing_totals:", {
          subtotal, tpsAmount, tvqAmount, total, discountAmount
        });
      } else {
        // FALLBACK: Calculate amounts (legacy behavior)
        subtotal = service.plan_price + invoiceActivationFee;
        tpsAmount = Math.round(subtotal * TPS_RATE * 100) / 100;
        tvqAmount = Math.round(subtotal * TVQ_RATE * 100) / 100;
        total = Math.round((subtotal + tpsAmount + tvqAmount) * 100) / 100;
      }
      
      // Create invoice with SMART status + order linkage
      const invoiceData: Record<string, any> = {
        subscription_id: subscription!.id,
        customer_id: customerId,
        invoice_number: invoiceNumber,
        type: 'initial',
        subtotal,
        activation_fee: invoiceActivationFee,
        tps_amount: tpsAmount,
        tvq_amount: tvqAmount,
        total,
        currency: 'CAD',
        payment_method: effectivePaymentMethod,
        status: effectiveInvoiceStatus,
        cycle_start_date: cycleStartStr,
        cycle_end_date: cycleEndStr,
        due_date: dueDate,
        order_id: body.order_id || null,
        notes: body.order_number 
          ? `Commande: ${body.order_number}${discountAmount > 0 ? ` | Rabais: -${discountAmount.toFixed(2)}$` : ''}${body.billing_totals?.promo_code ? ` (${body.billing_totals.promo_code})` : ''}`
          : null,
      };
      
      // If PayPal paid, set amount_paid and balance_due
      if (isPayPalPaid) {
        invoiceData.amount_paid = total;
        invoiceData.balance_due = 0;
        invoiceData.paid_at = new Date().toISOString();
      }
      
      const { data: invoice, error: invoiceError } = await supabase
        .from("billing_invoices")
        .insert(invoiceData)
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
      
      // Welcome discount line (50% on services for new customers - first invoice only)
      const welcomeDiscountAmt = hasBillingTotals && i === 0 ? (body.billing_totals!.welcome_discount_amount || 0) : 0;
      if (welcomeDiscountAmt > 0) {
        lines.push({
          invoice_id: invoice.id,
          description: "Rabais nouveau client (50% — 1er mois)",
          unit_price: -welcomeDiscountAmt,
          quantity: 1,
          line_total: -welcomeDiscountAmt
        });
        console.log(`[billing-create-order] Added welcome discount line: -${welcomeDiscountAmt}`);
      }
      
      await supabase.from("billing_invoice_lines").insert(lines);
      
      // Create payment record with SMART status
      const paymentData: Record<string, any> = {
        invoice_id: invoice.id,
        customer_id: customerId,
        method: effectivePaymentMethod,
        amount: total,
        status: effectivePaymentStatus,
        source: 'live',
      };
      
      // Add PayPal-specific fields if PayPal payment
      if (isPayPalPaid && effectivePaymentMethod === 'paypal') {
        paymentData.provider = 'paypal';
        paymentData.provider_payment_id = body.payment_reference;
        paymentData.received_at = new Date().toISOString();
      }
      
      await supabase.from("billing_payments").insert(paymentData);
      
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
      
      console.log(`[billing-create-order] Created subscription ${subscription.id} (status: ${subscriptionStatus}) with invoice ${invoiceNumber} (status: ${effectiveInvoiceStatus})`);
    }
    
    // Step 3: Queue appropriate email based on payment status
    const templateKey = isPayPalPaid ? 'payment_confirmed' : 'invoice_created';
    
    await supabase.from("email_queue").insert({
      event_key: `billing_order_${results.customer_id}_${Date.now()}`,
      to_email: body.email,
      template_key: templateKey,
      template_vars: {
        client_name: `${body.first_name} ${body.last_name}`,
        invoice_number: results.subscriptions[0]?.invoice_number || 'N/A',
        plan_name: body.services.map(s => s.plan_name).join(', '),
        subtotal: body.services.reduce((sum, s) => sum + s.plan_price, 0).toFixed(2),
        activation_fee: activationFee.toFixed(2),
        tps_amount: (results.total_amount * 0.05 / 1.14975).toFixed(2),
        tvq_amount: (results.total_amount * 0.09975 / 1.14975).toFixed(2),
        total: results.total_amount.toFixed(2),
        amount: results.total_amount.toFixed(2),
        due_date: dueDate,
        cycle_start: cycleStartStr,
        cycle_end: cycleEndStr,
        service_count: serviceCount,
        payment_method: effectivePaymentMethod === 'paypal' ? 'PayPal' : 'Interac e-Transfer',
        payment_email: 'support@nivra-telecom.ca',
        reference: body.payment_reference || null,
      },
      status: "queued",
      attempts: 0,
      max_attempts: 5
    });
    
    console.log(`[billing-create-order] Order processed: ${results.subscriptions.length} subscriptions, total: $${results.total_amount.toFixed(2)}, method: ${effectivePaymentMethod}, status: ${effectiveInvoiceStatus}`);
    
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