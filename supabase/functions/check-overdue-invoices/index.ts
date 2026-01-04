import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

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
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
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

    let sentCount = 0;
    let updatedCount = 0;

    for (const invoice of overdueInvoices) {
      const profile = profileMap.get(invoice.user_id);
      const email = profile?.email || invoice.client_email;

      if (!email) {
        console.log(`No email for invoice ${invoice.id}, skipping notification`);
        continue;
      }

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

      try {
        const formatCurrency = (value: number) => {
          return new Intl.NumberFormat("fr-CA", {
            style: "currency",
            currency: "CAD",
          }).format(value);
        };

        const formatDate = (dateStr: string) => {
          return new Date(dateStr).toLocaleDateString("fr-CA", {
            dateStyle: "long",
          });
        };

        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: "Nivra <onboarding@resend.dev>",
            to: [email],
            subject: `Rappel - Facture ${invoice.invoice_number || ""} en retard - Nivra`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #0891b2, #06b6d4); padding: 30px; text-align: center;">
                  <h1 style="color: white; margin: 0;">Nivra</h1>
                </div>
                <div style="padding: 30px; background: #f8fafc;">
                  <h2 style="color: #0f172a;">Bonjour ${profile?.full_name || "cher client"},</h2>
                  
                  <div style="background: #fef3c720; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
                    <h3 style="color: #f59e0b; margin: 0 0 10px;">⚠️ Rappel de paiement</h3>
                    <p style="color: #475569; margin: 0;">Votre facture est maintenant en retard. Veuillez effectuer le paiement dès que possible pour éviter des frais supplémentaires.</p>
                  </div>
                  
                  <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e2e8f0;">
                    <h4 style="margin: 0 0 15px; color: #0f172a;">Détails de la facture</h4>
                    <p style="margin: 8px 0; color: #0f172a;"><strong>Numéro de facture:</strong> ${invoice.invoice_number || invoice.id.slice(0, 8)}</p>
                    <p style="margin: 8px 0; color: #0f172a;"><strong>Montant dû:</strong> ${formatCurrency(total)}</p>
                    <p style="margin: 8px 0; color: #ef4444;"><strong>Date d'échéance:</strong> ${formatDate(invoice.due_date)} (dépassée)</p>
                  </div>
                  
                  <div style="text-align: center; margin: 25px 0;">
                    <p style="color: #475569; margin-bottom: 15px;">Connectez-vous à votre portail client pour consulter et payer votre facture.</p>
                  </div>
                  
                  <p style="color: #475569;">Si vous avez des questions ou si vous avez déjà effectué ce paiement, veuillez nous contacter au 514-544-2233.</p>
                  <p style="color: #475569;">Cordialement,<br>L'équipe Nivra</p>
                </div>
                <div style="background: #0f172a; padding: 20px; text-align: center;">
                  <p style="color: #94a3b8; margin: 0; font-size: 12px;">© 2024 Nivra. Tous droits réservés.</p>
                </div>
              </div>
            `,
          }),
        });

        if (emailResponse.ok) {
          sentCount++;
          console.log(`Sent overdue reminder to ${email} for invoice ${invoice.id}`);
        } else {
          const errorResult = await emailResponse.json();
          console.error(`Failed to send email to ${email}:`, errorResult);
        }
      } catch (emailError) {
        console.error(`Error sending email to ${email}:`, emailError);
      }
    }

    console.log(`Processed ${overdueInvoices.length} invoices, updated ${updatedCount}, sent ${sentCount} notifications`);

    return new Response(
      JSON.stringify({ 
        message: "Overdue invoices processed", 
        total: overdueInvoices.length,
        updated: updatedCount,
        notificationsSent: sentCount 
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
