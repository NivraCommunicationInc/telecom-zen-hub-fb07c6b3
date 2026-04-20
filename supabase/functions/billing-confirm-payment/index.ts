import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * ============================================================================
 * BILLING V2 - CONFIRM INTERAC PAYMENT
 * ============================================================================
 * 
 * Uses apply_payment_to_invoice RPC (SINGLE SOURCE OF TRUTH).
 * No manual amount_paid/balance_due recalculation.
 * 
 * FLOW:
 * 1. Admin calls with invoice_id + payment_reference
 * 2. RPC handles: insert payment, update invoice, sync order
 * 3. SQL trigger handles subscription activation + cycle dates
 * 4. Confirmation email queued
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ConfirmPaymentRequest {
  invoice_id: string;
  payment_reference?: string;
  confirmed_by?: string;
}

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

    // ★ USE THE CANONICAL RPC — SINGLE SOURCE OF TRUTH ★
    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      "apply_payment_to_invoice",
      {
        p_invoice_id: body.invoice_id,
        p_amount: invoice.total,
        p_method: "interac",
        p_provider: "interac",
        p_provider_payment_id: body.payment_reference || `interac_${Date.now()}`,
        p_source: "admin_confirm",
        p_created_by_name: body.confirmed_by || "admin",
        p_created_by_role: "admin",
        p_customer_id: invoice.customer_id,
      }
    );

    if (rpcError) {
      console.error("[billing-confirm-payment] RPC error:", rpcError);
      throw new Error(`apply_payment_to_invoice failed: ${rpcError.message}`);
    }

    if (rpcResult?.already_processed) {
      return new Response(
        JSON.stringify({ success: true, message: "Payment already processed (idempotent)" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[billing-confirm-payment] ★ Payment applied via RPC:`, rpcResult);

    // Fetch updated invoice to get real cycle dates (set by trigger)
    const { data: updatedInvoice } = await supabase
      .from("billing_invoices")
      .select("cycle_start_date, cycle_end_date, paid_at, status")
      .eq("id", body.invoice_id)
      .single();
    
    const paidAt = updatedInvoice?.paid_at || new Date().toISOString();

    // Queue confirmation email (with receipt PDF, non-blocking)
    if (invoice.customer && rpcResult?.is_fully_paid) {
      const cycleStart = updatedInvoice?.cycle_start_date || new Date().toISOString().split('T')[0];
      const cycleEnd = updatedInvoice?.cycle_end_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const { buildReceiptPdfAttachment } = await import("../_shared/pdfFromDb.ts");
      const pdfAttachment = await buildReceiptPdfAttachment(body.invoice_id, "recu-paiement");

      await supabase.from("email_queue").insert({
        event_key: `interac_confirmed_${body.invoice_id}`,
        to_email: invoice.customer.email,
        to_name: `${invoice.customer.first_name} ${invoice.customer.last_name}`,
        template_type: "billing_payment_confirmed",
        template_data: {
          clientName: `${invoice.customer.first_name} ${invoice.customer.last_name}`,
          invoiceNumber: invoice.invoice_number,
          planName: invoice.subscription?.plan_name || 'Service Nivra',
          total: invoice.total.toFixed(2),
          paidAt: new Date(paidAt).toLocaleDateString('fr-CA'),
          cycleStart,
          cycleEnd,
        },
        attachments: pdfAttachment ? [pdfAttachment] : null,
        priority: "high"
      });
    }
    
    console.log(`[billing-confirm-payment] ✓ Invoice ${invoice.invoice_number} confirmed. Status: ${updatedInvoice?.status}`);
    
    return new Response(
      JSON.stringify({
        success: true,
        invoice_number: invoice.invoice_number,
        status: updatedInvoice?.status || rpcResult?.invoice_status,
        paid_at: paidAt,
        cycle_start_date: updatedInvoice?.cycle_start_date,
        cycle_end_date: updatedInvoice?.cycle_end_date,
        rpc_result: rpcResult,
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
