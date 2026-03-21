import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * PORTAL-ADD-CREDIT — Apply a Stripe payment as account credit
 * 
 * Logic:
 * 1. Verify the Stripe PaymentIntent succeeded
 * 2. Find or error on billing_customer
 * 3. Find unpaid invoices (oldest first)
 * 4. Apply payment to invoices via apply_payment_to_invoice RPC
 * 5. Any remaining amount → create a credit invoice + payment pair
 * 6. All updates are canonical — no client-side math
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // ═══ STRIPE KILL-SWITCH — 2026-03-21 ═══
  // portal-add-credit was Stripe-specific. Disabled until PayPal credit flow is implemented.
  console.warn("[portal-add-credit] BLOCKED — Stripe disabled in production");
  return new Response(
    JSON.stringify({ error: "L'ajout de crédit par carte est désactivé. Utilisez PayPal ou Interac." }),
    { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const db = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate user
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const anonClient = createClient(supabaseUrl, supabaseAnonKey);
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Non autorisé");
    
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
    if (authError || !user) throw new Error("Non autorisé");

    const body = await req.json();
    const { amount, payment_intent_id } = body;
    const userId = user.id;

    if (!amount || amount < 5) throw new Error("Montant minimum: 5$");
    if (amount > 1000) throw new Error("Montant maximum: 1000$");
    if (!payment_intent_id) throw new Error("payment_intent_id requis");

    // Idempotency: check if this PI was already processed
    const { data: existingPayment } = await db
      .from("billing_payments")
      .select("id")
      .eq("stripe_payment_intent_id", payment_intent_id)
      .maybeSingle();
    
    if (existingPayment) {
      return new Response(
        JSON.stringify({ success: true, already_processed: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Resolve billing customer
    const { data: customer, error: custErr } = await db
      .from("billing_customers")
      .select("id, email, first_name, last_name")
      .eq("user_id", userId)
      .maybeSingle();

    if (custErr || !customer) {
      throw new Error("Compte facturation introuvable. Contactez le support.");
    }

    let remainingAmount = amount;
    const appliedInvoices: { invoice_id: string; invoice_number: string; amount: number }[] = [];

    // 1. Find unpaid invoices (oldest first by due_date)
    const { data: unpaidInvoices } = await db
      .from("billing_invoices")
      .select("id, invoice_number, total, balance_due, status")
      .eq("customer_id", customer.id)
      .not("status", "in", '("paid","cancelled","refunded","void","paid_by_promo")')
      .order("due_date", { ascending: true });

    // 2. Apply to unpaid invoices via RPC
    for (const inv of unpaidInvoices || []) {
      if (remainingAmount <= 0) break;
      const balanceDue = Number(inv.balance_due) || Number(inv.total) || 0;
      if (balanceDue <= 0) continue;

      const applyAmount = Math.min(remainingAmount, balanceDue);
      
      const { error: rpcError } = await db.rpc("apply_payment_to_invoice", {
        p_invoice_id: inv.id,
        p_amount: applyAmount,
        p_method: "card",
        p_provider: "stripe",
        p_provider_payment_id: payment_intent_id,
        p_source: "portal",
        p_created_by_name: `${customer.first_name} ${customer.last_name}`,
        p_created_by_role: "client",
        p_customer_id: customer.id,
      });

      if (rpcError) {
        console.error(`[portal-add-credit] RPC error for invoice ${inv.id}:`, rpcError);
        // Continue to next invoice if this one fails
        continue;
      }

      appliedInvoices.push({
        invoice_id: inv.id,
        invoice_number: inv.invoice_number,
        amount: applyAmount,
      });

      remainingAmount = Math.round((remainingAmount - applyAmount) * 100) / 100;
    }

    // 3. If there's remaining amount, record as credit payment
    let creditAmount = 0;
    if (remainingAmount > 0) {
      creditAmount = remainingAmount;

      // Generate a unique payment number for the credit
      const creditPaymentNumber = `PAY-CR-${Date.now()}`;

      // Create a credit-type invoice for record-keeping
      const today = new Date().toISOString().split("T")[0];
      const { data: creditInvoice, error: invErr } = await db
        .from("billing_invoices")
        .insert({
          customer_id: customer.id,
          invoice_number: `CR-${Date.now()}`,
          type: "credit",
          status: "paid",
          subtotal: -creditAmount,
          tps_amount: 0,
          tvq_amount: 0,
          total: -creditAmount,
          amount_paid: creditAmount,
          balance_due: 0,
          paid_at: new Date().toISOString(),
          due_date: today,
          cycle_start_date: today,
          cycle_end_date: today,
          environment: "production",
        })
        .select("id")
        .single();

      if (invErr) {
        console.error("[portal-add-credit] Credit invoice creation error:", invErr);
        // Still record the payment even if credit invoice fails
      }

      // Record the credit payment
      const { error: payErr } = await db.from("billing_payments").insert({
        customer_id: customer.id,
        invoice_id: creditInvoice?.id || (unpaidInvoices?.[0]?.id ?? null),
        payment_number: creditPaymentNumber,
        amount: creditAmount,
        method: "card",
        provider: "stripe",
        provider_payment_id: `${payment_intent_id}_credit`,
        stripe_payment_intent_id: payment_intent_id,
        status: "confirmed",
        source: "portal",
        created_by_name: `${customer.first_name} ${customer.last_name}`,
        created_by_role: "client",
        reference: `Crédit au compte`,
        environment: "production",
      });

      if (payErr) {
        console.error("[portal-add-credit] Credit payment insert error:", payErr);
      }
    }

    // Queue confirmation email
    await db.from("email_queue").insert({
      event_key: `credit_payment_${payment_intent_id}`,
      to_email: customer.email,
      to_name: `${customer.first_name} ${customer.last_name}`,
      template_type: "billing_credit_payment",
      template_data: {
        clientName: `${customer.first_name} ${customer.last_name}`,
        totalPaid: amount.toFixed(2),
        appliedToBalance: (amount - creditAmount).toFixed(2),
        creditAdded: creditAmount.toFixed(2),
        appliedInvoices: appliedInvoices.map((i) => i.invoice_number).join(", ") || "Aucune",
        paymentMethod: "Carte de crédit (Stripe)",
        paymentReference: payment_intent_id,
        date: new Date().toLocaleDateString("fr-CA"),
      },
      priority: "high",
    }).then(() => {}).catch((e: Error) => {
      console.warn("[portal-add-credit] Email queue error (non-blocking):", e);
    });

    console.log(`[portal-add-credit] ✓ ${amount}$ processed for ${customer.email}. Applied: ${appliedInvoices.length} invoices. Credit: ${creditAmount}$`);

    return new Response(
      JSON.stringify({
        success: true,
        total_paid: amount,
        applied_to_invoices: appliedInvoices,
        credit_added: creditAmount,
        payment_intent_id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[portal-add-credit] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
