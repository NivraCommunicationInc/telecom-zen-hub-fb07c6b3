import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * PORTAL — SUBMIT INTERAC PAYMENT
 *
 * Called by the client portal when a customer submits an Interac e-Transfer reference.
 * Creates a pending payment record for admin validation.
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
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Authenticate the portal user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Non autorisé" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const anonClient = createClient(supabaseUrl, supabaseAnonKey);
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } = await anonClient.auth.getUser(token);
    if (authError || !userData.user) {
      return new Response(
        JSON.stringify({ error: "Session invalide" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = userData.user.id;
    const db = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { invoice_id, reference, amount } = body;

    if (!invoice_id || !reference?.trim()) {
      return new Response(
        JSON.stringify({ error: "invoice_id et reference sont requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!amount || amount <= 0) {
      return new Response(
        JSON.stringify({ error: "Montant invalide" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch invoice and verify it belongs to the authenticated user's customer record
    const { data: invoice, error: invError } = await db
      .from("billing_invoices")
      .select("id, invoice_number, status, customer_id, customer:billing_customers(id, user_id, email, first_name, last_name)")
      .eq("id", invoice_id)
      .single();

    if (invError || !invoice) {
      return new Response(
        JSON.stringify({ error: "Facture introuvable" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify ownership: the customer's user_id must match the authenticated user
    const customer = invoice.customer as any;
    if (!customer || customer.user_id !== userId) {
      return new Response(
        JSON.stringify({ error: "Accès refusé à cette facture" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (invoice.status === "paid") {
      return new Response(
        JSON.stringify({ error: "Cette facture est déjà payée" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for duplicate reference
    const { data: existingPayment } = await db
      .from("billing_payments")
      .select("id")
      .eq("invoice_id", invoice_id)
      .eq("reference", reference.trim())
      .eq("method", "interac")
      .maybeSingle();

    if (existingPayment) {
      console.log(`[portal-submit-interac] Duplicate reference ${reference} for invoice ${invoice.invoice_number}`);
      return new Response(
        JSON.stringify({ already_exists: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate payment number
    const paymentNumber = `PAY-INT-${Date.now().toString(36).toUpperCase()}`;

    // Create a pending payment record for admin validation
    const { error: insertError } = await db
      .from("billing_payments")
      .insert({
        invoice_id,
        customer_id: invoice.customer_id,
        amount,
        method: "interac",
        provider: "interac",
        reference: reference.trim(),
        payment_number: paymentNumber,
        status: "pending",
        source: "portal",
      });

    if (insertError) {
      console.error("[portal-submit-interac] Insert error:", insertError);
      return new Response(
        JSON.stringify({ error: "Erreur lors de l'enregistrement du paiement" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[portal-submit-interac] Payment ${paymentNumber} created for invoice ${invoice.invoice_number} ref=${reference}`);

    return new Response(
      JSON.stringify({ success: true, payment_number: paymentNumber }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[portal-submit-interac] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
