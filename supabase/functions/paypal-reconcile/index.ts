/**
 * PayPal Reconciliation Edge Function
 * 
 * Synchronizes PayPal transactions with local billing_payments table.
 * Finds captured transactions in PayPal that weren't recorded locally
 * (e.g., due to client disconnection, browser crash, or network issues).
 * 
 * Can be called:
 * - Manually via admin dashboard
 * - Via cron job (e.g., every 6 hours)
 * 
 * Security: Requires admin authentication or cron secret
 */

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

interface PayPalTransaction {
  transaction_id: string;
  transaction_info: {
    transaction_id: string;
    transaction_event_code: string;
    transaction_initiation_date: string;
    transaction_amount: {
      currency_code: string;
      value: string;
    };
    transaction_status: string;
    payer_email?: string;
    payer_name?: string;
  };
  payer_info?: {
    email_address?: string;
    payer_name?: {
      given_name?: string;
      surname?: string;
    };
  };
  cart_info?: {
    item_details?: Array<{
      item_name?: string;
      item_description?: string;
    }>;
  };
}

interface ReconciliationResult {
  total_checked: number;
  new_payments_found: number;
  already_recorded: number;
  errors: string[];
  new_payments: Array<{
    transaction_id: string;
    amount: number;
    date: string;
    payer_email?: string;
  }>;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase: any = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    // Authentication: Check for cron secret or admin token
    const cronSecret = req.headers.get("x-cron-secret");
    const authHeader = req.headers.get("authorization");
    
    let isAuthorized = false;
    let adminEmail: string | null = null;

    // Cron job authentication
    if (cronSecret && cronSecret === Deno.env.get("BOOTSTRAP_TOKEN")) {
      isAuthorized = true;
      adminEmail = "system@cron";
    }

    // Admin authentication
    if (!isAuthorized && authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      
      if (!authError && user) {
        // Verify admin role
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "admin")
          .maybeSingle();
        
        if (roleData) {
          isAuthorized = true;
          adminEmail = user.email;
        }
      }
    }

    if (!isAuthorized) {
      console.log("[PayPalReconcile] Unauthorized access attempt");
      return new Response(
        JSON.stringify({ error: "Unauthorized", ok: false }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[PayPalReconcile] Starting reconciliation, initiated by:", adminEmail);

    // Parse request body for optional parameters
    let daysBack = 7; // Default: check last 7 days
    let dryRun = false;
    
    try {
      const body = await req.json();
      if (body.days_back && typeof body.days_back === "number") {
        daysBack = Math.min(Math.max(body.days_back, 1), 31); // 1-31 days
      }
      if (body.dry_run === true) {
        dryRun = true;
      }
    } catch {
      // No body or invalid JSON, use defaults
    }

    // Get PayPal access token
    const clientId = Deno.env.get("PAYPAL_CLIENT_ID");
    const clientSecret = Deno.env.get("PAYPAL_SECRET");
    
    if (!clientId || !clientSecret) {
      console.error("[PayPalReconcile] Missing PayPal credentials");
      return new Response(
        JSON.stringify({ error: "PayPal credentials not configured", ok: false }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get PayPal access token
    const authResponse = await fetch("https://api-m.paypal.com/v1/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      },
      body: "grant_type=client_credentials",
    });

    if (!authResponse.ok) {
      const errorText = await authResponse.text();
      console.error("[PayPalReconcile] Failed to get PayPal token:", errorText);
      return new Response(
        JSON.stringify({ error: "Failed to authenticate with PayPal", ok: false }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { access_token } = await authResponse.json();

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    const startDateStr = startDate.toISOString().split("T")[0] + "T00:00:00Z";
    const endDateStr = endDate.toISOString().split("T")[0] + "T23:59:59Z";

    console.log(`[PayPalReconcile] Checking transactions from ${startDateStr} to ${endDateStr}`);

    // Fetch PayPal transactions (completed captures)
    const transactionsUrl = new URL("https://api-m.paypal.com/v1/reporting/transactions");
    transactionsUrl.searchParams.set("start_date", startDateStr);
    transactionsUrl.searchParams.set("end_date", endDateStr);
    transactionsUrl.searchParams.set("transaction_status", "S"); // Successful
    transactionsUrl.searchParams.set("fields", "all");
    transactionsUrl.searchParams.set("page_size", "100");

    const transResponse = await fetch(transactionsUrl.toString(), {
      headers: {
        "Authorization": `Bearer ${access_token}`,
        "Content-Type": "application/json",
      },
    });

    if (!transResponse.ok) {
      const errorText = await transResponse.text();
      console.error("[PayPalReconcile] Failed to fetch transactions:", errorText);
      return new Response(
        JSON.stringify({ error: "Failed to fetch PayPal transactions", ok: false }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const transData = await transResponse.json();
    const transactions: PayPalTransaction[] = transData.transaction_details || [];
    
    console.log(`[PayPalReconcile] Found ${transactions.length} PayPal transactions`);

    // Filter for capture events only (T0006 = Capture, T0007 = Refund)
    const captureTransactions = transactions.filter(t => 
      t.transaction_info?.transaction_event_code === "T0006" ||
      t.transaction_info?.transaction_event_code === "T0003" // Payment received
    );

    console.log(`[PayPalReconcile] ${captureTransactions.length} are capture transactions`);

    const result: ReconciliationResult = {
      total_checked: captureTransactions.length,
      new_payments_found: 0,
      already_recorded: 0,
      errors: [],
      new_payments: [],
    };

    // Check each transaction against our database
    for (const trans of captureTransactions) {
      const transId = trans.transaction_info?.transaction_id;
      if (!transId) continue;

      // Check if this transaction is already recorded
      const { data: existingPayment } = await supabase
        .from("billing_payments")
        .select("id")
        .or(`provider_payment_id.eq.${transId},reference.eq.${transId}`)
        .maybeSingle();

      // Also check orders table for payment_reference
      const { data: existingOrder } = await supabase
        .from("orders")
        .select("id")
        .eq("payment_reference", transId)
        .maybeSingle();

      if (existingPayment || existingOrder) {
        result.already_recorded++;
        continue;
      }

      // New payment found!
      const amount = parseFloat(trans.transaction_info?.transaction_amount?.value || "0");
      const date = trans.transaction_info?.transaction_initiation_date;
      const payerEmail = trans.payer_info?.email_address || trans.transaction_info?.payer_email;

      console.log(`[PayPalReconcile] Found unrecorded payment: ${transId}, $${amount}, ${payerEmail}`);

      result.new_payments.push({
        transaction_id: transId,
        amount,
        date: date || new Date().toISOString(),
        payer_email: payerEmail,
      });
      result.new_payments_found++;

      // If not dry run, try to create the payment record
      if (!dryRun) {
        try {
          // Try to find the customer by email
          let customerId: string | null = null;
          if (payerEmail) {
            const { data: customer } = await supabase
              .from("billing_customers")
              .select("id")
              .eq("email", payerEmail)
              .maybeSingle();
            
            customerId = customer?.id || null;
          }

          if (customerId) {
            // Create the payment record
            const { error: insertError } = await supabase
              .from("billing_payments")
              .insert({
                customer_id: customerId,
                amount: amount,
                method: "paypal",
                status: "confirmed",
                provider: "paypal",
                provider_payment_id: transId,
                reference: transId,
                notes: `Réconcilié automatiquement le ${new Date().toISOString()}`,
                source: "reconciliation",
                created_by_id: null,
                created_by_name: "Système de réconciliation",
                created_by_role: "system",
              });

            if (insertError) {
              console.error(`[PayPalReconcile] Failed to insert payment ${transId}:`, insertError);
              result.errors.push(`Failed to insert ${transId}: ${insertError.message}`);
            } else {
              console.log(`[PayPalReconcile] Successfully recorded payment ${transId}`);
            }
          } else {
            // Log orphan transaction for manual review
            await supabase.from("activity_logs").insert({
              action: "paypal_orphan_transaction",
              description: `Transaction PayPal non attribuée: ${transId} ($${amount})`,
              metadata: {
                transaction_id: transId,
                amount,
                payer_email: payerEmail,
                date,
                requires_manual_review: true,
              },
              user_id: null,
            });
            
            result.errors.push(`Orphan transaction (no matching customer): ${transId}`);
          }
        } catch (err) {
          console.error(`[PayPalReconcile] Error processing ${transId}:`, err);
          result.errors.push(`Error processing ${transId}: ${String(err)}`);
        }
      }
    }

    // Log the reconciliation run
    await supabase.from("admin_audit_log").insert({
      admin_user_id: null,
      admin_email: adminEmail,
      action: "paypal_reconciliation",
      details: {
        days_checked: daysBack,
        dry_run: dryRun,
        total_checked: result.total_checked,
        new_payments_found: result.new_payments_found,
        already_recorded: result.already_recorded,
        errors_count: result.errors.length,
      },
      target_type: "billing",
      target_id: null,
    });

    console.log("[PayPalReconcile] Reconciliation complete:", {
      total: result.total_checked,
      new: result.new_payments_found,
      existing: result.already_recorded,
      errors: result.errors.length,
    });

    return new Response(
      JSON.stringify({ 
        ok: true, 
        dry_run: dryRun,
        result,
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (error) {
    console.error("[PayPalReconcile] Unexpected error:", error);
    return new Response(
      JSON.stringify({ 
        error: "Internal server error", 
        message: String(error),
        ok: false 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
