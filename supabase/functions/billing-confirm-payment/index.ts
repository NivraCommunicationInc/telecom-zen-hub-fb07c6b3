import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * ============================================================================
 * BILLING V2 - CONFIRM INTERAC PAYMENT
 * ============================================================================
 * 
 * ┌────────────────────────────────────────────────────────────────────────┐
 * │  RÈGLE SYSTÈME VERROUILLÉE - MODÈLE 100% PRÉPAYÉ                       │
 * │                                                                         │
 * │  LE CYCLE DE FACTURATION NE COMMENCE JAMAIS À LA COMMANDE.             │
 * │  LE CYCLE COMMENCE UNIQUEMENT QUAND LE PAIEMENT INTERAC EST CONFIRMÉ.  │
 * │                                                                         │
 * │  Cette règle est IMMUABLE et protégée par des triggers SQL.            │
 * └────────────────────────────────────────────────────────────────────────┘
 * 
 * FLOW:
 * 1. Admin appelle cette fonction avec invoice_id
 * 2. La facture passe de 'pending' → 'paid' avec paid_at = NOW()
 * 3. Le trigger SQL (on_invoice_paid_update_subscription) s'exécute:
 *    - cycle_start_date = paid_at (date exacte de confirmation)
 *    - cycle_end_date = paid_at + 30 jours
 *    - subscription.status = 'active'
 * 4. Email de confirmation envoyé au client avec les vraies dates
 * 
 * PROTECTION:
 * - Le trigger protect_subscription_activation_trigger empêche toute
 *   activation sans facture payée (log + alerte + revert to pending)
 * 
 * @author Nivra Telecom
 * @version 2.0.0 - Prepaid Interac-Only Model
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
    
    // Current timestamp for payment confirmation
    const paidAt = new Date().toISOString();
    
    // Update payment record to confirmed
    const { error: paymentError } = await supabase
      .from("billing_payments")
      .update({
        status: 'confirmed',
        reference: body.payment_reference || null,
        confirmed_by: body.confirmed_by || 'admin',
        received_at: paidAt
      })
      .eq("invoice_id", body.invoice_id)
      .eq("status", "pending");
    
    if (paymentError) {
      console.error("[billing-confirm-payment] Payment update error:", paymentError);
    }
    
    // Calculate total confirmed payments for this invoice
    const { data: payments } = await supabase
      .from("billing_payments")
      .select("amount")
      .eq("invoice_id", body.invoice_id)
      .eq("status", "confirmed");
    
    const totalPaid = (payments || []).reduce((sum, p) => sum + Number(p.amount), 0);
    const newBalanceDue = Math.max(0, invoice.total - totalPaid);
    const isFullyPaid = newBalanceDue <= 0;
    
    // Update invoice with correct amounts and status
    // The SQL trigger will automatically:
    // 1. Recalculate cycle_start_date = paid_at
    // 2. Recalculate cycle_end_date = paid_at + 30 days
    // 3. Activate the subscription
    const { error: updateError } = await supabase
      .from("billing_invoices")
      .update({
        status: isFullyPaid ? 'paid' : 'pending',
        paid_at: isFullyPaid ? paidAt : null,
        amount_paid: totalPaid,
        balance_due: newBalanceDue
      })
      .eq("id", body.invoice_id);
    
    if (updateError) throw updateError;
    
    console.log(`[billing-confirm-payment] Invoice ${invoice.invoice_number}: total=${invoice.total}, paid=${totalPaid}, balance=${newBalanceDue}, status=${isFullyPaid ? 'paid' : 'pending'}`);
    
    // Fetch updated invoice to get real cycle dates (set by trigger)
    const { data: updatedInvoice } = await supabase
      .from("billing_invoices")
      .select("cycle_start_date, cycle_end_date")
      .eq("id", body.invoice_id)
      .single();
    
    // Queue confirmation email with REAL cycle dates
    if (invoice.customer) {
      const cycleStart = updatedInvoice?.cycle_start_date || new Date().toISOString().split('T')[0];
      const cycleEnd = updatedInvoice?.cycle_end_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      await supabase.from("email_queue").insert({
        to_email: invoice.customer.email,
        to_name: `${invoice.customer.first_name} ${invoice.customer.last_name}`,
        template_type: "billing_payment_confirmed",
        template_data: {
          clientName: `${invoice.customer.first_name} ${invoice.customer.last_name}`,
          invoiceNumber: invoice.invoice_number,
          planName: invoice.subscription?.plan_name || 'Service Nivra',
          total: invoice.total.toFixed(2),
          paidAt: new Date(paidAt).toLocaleDateString('fr-CA'),
          cycleStart: cycleStart,
          cycleEnd: cycleEnd
        },
        priority: "high"
      });
    }
    
    console.log(`[billing-confirm-payment] Invoice ${invoice.invoice_number} marked as PAID at ${paidAt}. Cycle activated via trigger.`);
    
    return new Response(
      JSON.stringify({
        success: true,
        invoice_number: invoice.invoice_number,
        status: 'paid',
        paid_at: paidAt,
        cycle_start_date: updatedInvoice?.cycle_start_date,
        cycle_end_date: updatedInvoice?.cycle_end_date
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
