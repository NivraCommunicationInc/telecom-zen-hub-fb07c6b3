import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * PORTAL-ADD-CREDIT — Apply a Square capture as account credit
 *
 * Logic (Phase 3 V2 — Square-only):
 * 1. Authenticate the user
 * 2. Idempotency check on square capture id
 * 3. Resolve billing_customer
 * 4. Find unpaid invoices (oldest first)
 * 5. Apply payment to invoices via apply_payment_to_invoice RPC (provider=square)
 * 6. Any remaining amount → credit invoice + billing_payment (provider=square)
 * 7. Queue confirmation email
 *
 * Historique :
 * - Stripe décommissionné 2026-05-18.
 * - PayPal décommissionné Phase 3.C.4 (2026-07-07) — remplacé par Square.
 * Compat : le paramètre entrant peut encore s'appeler `paypal_capture_id`
 * pour rétrocompat frontend, mais il est traité comme un capture id neutre
 * (Square).
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
    // Accepte capture_id (nouveau, Square) OU paypal_capture_id (legacy rétrocompat frontend)
    const captureId: string | undefined = body.capture_id ?? body.paypal_capture_id;
    const { amount } = body;
    const userId = user.id;

    if (!amount || amount < 5) throw new Error("Montant minimum: 5$");
    if (amount > 1000) throw new Error("Montant maximum: 1000$");
    if (!paypal_capture_id) throw new Error("paypal_capture_id requis");

    // Idempotency: check if this PayPal capture was already processed
    const { data: existingPayment } = await db
      .from("billing_payments")
      .select("id")
      .eq("provider_payment_id", paypal_capture_id)
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

      const { data: rpcResult, error: rpcError } = await db.rpc("apply_payment_to_invoice", {
        p_invoice_id: inv.id,
        p_amount: applyAmount,
        p_method: "paypal",
        p_provider: "paypal",
        p_provider_payment_id: paypal_capture_id,
        p_source: "portal",
        p_created_by_name: `${customer.first_name} ${customer.last_name}`,
        p_created_by_role: "client",
        p_customer_id: customer.id,
      });

      if (rpcError) {
        console.error(`[portal-add-credit] RPC error for invoice ${inv.id}:`, rpcError);
        continue;
      }

      appliedInvoices.push({
        invoice_id: inv.id,
        invoice_number: inv.invoice_number,
        amount: applyAmount,
      });

      remainingAmount = Math.round((remainingAmount - applyAmount) * 100) / 100;

      // Auto-reactivate if this invoice fully paid a suspended subscription
      if (rpcResult?.is_fully_paid && rpcResult?.subscription_id) {
        const { reactivateIfSuspended } = await import("../_shared/reactivationEngine.ts");
        await reactivateIfSuspended(db, rpcResult.subscription_id, inv.id, "portal_credit");
      }
    }

    // 3. If there's remaining amount, record as credit payment
    let creditAmount = 0;
    if (remainingAmount > 0) {
      creditAmount = remainingAmount;

      const creditPaymentNumber = `PAY-CR-${Date.now()}`;

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
      }

      const { error: payErr } = await db.from("billing_payments").insert({
        customer_id: customer.id,
        invoice_id: creditInvoice?.id || (unpaidInvoices?.[0]?.id ?? null),
        payment_number: creditPaymentNumber,
        amount: creditAmount,
        method: "paypal",
        provider: "paypal",
        provider_payment_id: `${paypal_capture_id}_credit`,
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
    const { buildAutoDocPdfAttachment } = await import("../_shared/pdfFromDb.ts");
    const creditPdf = creditAmount > 0
      ? await buildAutoDocPdfAttachment("credit_note", {
          client_email: customer.email,
          first_name: customer.first_name,
          last_name: customer.last_name,
          amount: creditAmount,
          description: "Crédit appliqué au compte",
          credit_type: "credit",
        }).catch(() => null)
      : null;
    await db.from("email_queue").insert({
      event_key: `credit_payment_${paypal_capture_id}`,
      to_email: customer.email,
      template_key: "billing_credit_payment",
      template_vars: {
        clientName: `${customer.first_name} ${customer.last_name}`,
        totalPaid: amount.toFixed(2),
        appliedToBalance: (amount - creditAmount).toFixed(2),
        creditAdded: creditAmount.toFixed(2),
        appliedInvoices: appliedInvoices.map((i) => i.invoice_number).join(", ") || "Aucune",
      },
      attachments: creditPdf ? [creditPdf] : null,
      priority: 0,
    });

    return new Response(
      JSON.stringify({
        success: true,
        applied_invoices: appliedInvoices,
        credit_added: creditAmount,
        total_amount: amount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[portal-add-credit] error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erreur inconnue" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
