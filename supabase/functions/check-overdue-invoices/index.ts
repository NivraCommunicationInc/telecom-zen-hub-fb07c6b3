import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

/**
 * Check Overdue Invoices - Cron job that:
 * 1. Finds overdue invoices
 * 2. Applies late fees if not already applied
 * 3. Queues professional email notifications via email_queue
 */

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;
  
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  console.log("Check overdue invoices cron job started");

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const today = new Date().toISOString().split("T")[0];
    
    const { data: overdueInvoices, error: fetchError } = await supabase
      .from("billing")
      .select("*")
      .eq("status", "pending")
      .lt("due_date", today);

    if (fetchError) {
      console.error("Error fetching overdue invoices:", fetchError);
      throw fetchError;
    }

    console.log(`Found ${overdueInvoices?.length || 0} overdue invoices`);

    if (!overdueInvoices || overdueInvoices.length === 0) {
      return new Response(
        JSON.stringify({ message: "No overdue invoices found", processed: 0 }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const userIds = [...new Set(overdueInvoices.map((inv) => inv.user_id))];
    
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("user_id, email, full_name")
      .in("user_id", userIds);

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
    }

    const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) || []);

    let queuedCount = 0;
    let updatedCount = 0;

    for (const invoice of overdueInvoices) {
      const profile = profileMap.get(invoice.user_id);
      const email = profile?.email || invoice.client_email;

      if (!email) {
        console.log(`No email for invoice ${invoice.id}, skipping notification`);
        continue;
      }

      // Apply late fee if not already applied
      if (!invoice.late_fee_applied) {
        const lateFee = Number(invoice.amount) * 0.05;
        const { error: updateError } = await supabase
          .from("billing")
          .update({
            status: "overdue",
            fees: (Number(invoice.fees) || 0) + lateFee,
            late_fee_applied: true,
          })
          .eq("id", invoice.id);

        if (updateError) {
          console.error(`Error updating invoice ${invoice.id}:`, updateError);
        } else {
          updatedCount++;
          console.log(`Updated invoice ${invoice.id} to overdue with late fee`);
        }
      } else {
        await supabase
          .from("billing")
          .update({ status: "overdue" })
          .eq("id", invoice.id);
        updatedCount++;
      }

      const total = Number(invoice.amount) + (Number(invoice.fees) || 0) - (Number(invoice.credits) || 0);

      // Create unique event key for idempotency (one reminder per invoice per day)
      const eventKey = `invoice_overdue_${invoice.id}_${today}`;

      // Check if already queued today
      const { data: existingEmail } = await supabase
        .from("email_queue")
        .select("id")
        .eq("event_key", eventKey)
        .maybeSingle();

      if (existingEmail) {
        console.log(`Overdue email already queued for invoice ${invoice.id} today`);
        continue;
      }

      // Queue email for processing by process-email-queue with professional template
      const { error: queueError } = await supabase
        .from("email_queue")
        .insert({
          event_key: eventKey,
          to_email: email,
          template_key: "invoice_overdue",
          template_vars: {
            client_name: profile?.full_name || "Client",
            client_email: email,
            invoice_number: invoice.invoice_number || invoice.id.slice(0, 8),
            amount: total,
            due_date: invoice.due_date,
          },
          status: "queued",
          attempts: 0,
          max_attempts: 3,
        });

      if (queueError) {
        console.error(`Failed to queue overdue email for invoice ${invoice.id}:`, queueError);
      } else {
        queuedCount++;
        console.log(`Queued overdue reminder for invoice ${invoice.id} to ${email}`);
      }
    }

    console.log(`Processed ${overdueInvoices.length} invoices, updated ${updatedCount}, queued ${queuedCount} notifications`);

    return new Response(
      JSON.stringify({ 
        message: "Overdue invoices processed", 
        total: overdueInvoices.length,
        updated: updatedCount,
        notificationsQueued: queuedCount 
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in check-overdue-invoices:", error);
    const origin = req.headers.get('origin');
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...getCorsHeaders(origin) } }
    );
  }
};

serve(handler);
