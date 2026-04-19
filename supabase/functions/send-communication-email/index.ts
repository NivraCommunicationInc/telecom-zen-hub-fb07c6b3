import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { enqueueEmail } from "../_shared/ResendProxy.ts";
import { violetShell } from "../_shared/violetEmailShell.ts";

interface Recipient {
  email: string;
  name: string;
  client_id?: string | null;
}

interface SendRequest {
  subject: string;
  message: string;
  recipients: Recipient[];
}

serve(async (req) => {
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;
  
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the authenticated user
    const authHeader = req.headers.get("Authorization");
    let senderEmail = "admin@nivra-telecom.ca";
    
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user?.email) {
        senderEmail = user.email;
      }
    }

    const { subject, message, recipients }: SendRequest = await req.json();

    if (!subject?.trim()) {
      throw new Error("Le sujet est requis");
    }

    if (!message?.trim()) {
      throw new Error("Le message est requis");
    }

    if (!recipients?.length) {
      throw new Error("Aucun destinataire");
    }

    console.log(`[send-communication-email] Sending to ${recipients.length} recipients`);

    // Create the direct email record first
    const { data: directEmail, error: insertError } = await supabase
      .from("direct_emails")
      .insert({
        subject,
        message,
        recipients_count: recipients.length,
        sent_count: 0,
        failed_count: 0,
        status: "sending",
        sent_by_email: senderEmail,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Failed to create direct_email record:", insertError);
      throw insertError;
    }

    const directEmailId = directEmail.id;

    // Build HTML email — Violet Bold shell
    const buildHtmlEmail = (recipientName: string, plainMessage: string) => {
      const processedMessage = plainMessage
        .replace(/\{\{client_name\}\}/g, recipientName || "Client")
        .replace(/\{\{client_email\}\}/g, "");
      const htmlMessage = processedMessage.replace(/\n/g, "<br>");

      return violetShell({
        preheader: subject,
        badge: "MESSAGE NIVRA",
        heroTitle: subject,
        greeting: recipientName ? `Bonjour ${recipientName},` : undefined,
        bodyHtml: htmlMessage,
      });
    };

    // Send emails
    let sentCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    for (const recipient of recipients) {
      try {
        const html = buildHtmlEmail(recipient.name, message);

        const eqResult = await enqueueEmail({
          to: recipient.email,
          templateKey: "custom_html",
          subject,
          html,
          fromEmail: "Nivra Télécom <communication@nivra-telecom.ca>",
          replyTo: "support@nivra-telecom.ca",
          messageType: "communication_email",
          entityType: "direct_email",
          entityId: directEmailId,
          eventKey: `comm_${directEmailId}_${recipient.email}`,
        });

        if (!eqResult.success) {
          console.error(`Failed to queue for ${recipient.email}:`, eqResult.error);
          errors.push(`${recipient.email}: ${eqResult.error || "Queue failed"}`);
          failedCount++;
          
          await supabase.from("direct_email_recipients").insert({
            direct_email_id: directEmailId,
            email: recipient.email,
            name: recipient.name,
            client_id: recipient.client_id,
            status: "failed",
            error_message: eqResult.error || "Failed to queue",
          });
        } else {
          console.log(`Email queued for ${recipient.email}: ${eqResult.id}`);
          sentCount++;
          
          await supabase.from("direct_email_recipients").insert({
            direct_email_id: directEmailId,
            email: recipient.email,
            name: recipient.name,
            client_id: recipient.client_id,
            status: "queued",
            resend_id: eqResult.id,
          });
        }

      } catch (error) {
        console.error(`Error queuing for ${recipient.email}:`, error);
        errors.push(`${recipient.email}: ${(error as Error).message}`);
        failedCount++;
        
        await supabase.from("direct_email_recipients").insert({
          direct_email_id: directEmailId,
          email: recipient.email,
          name: recipient.name,
          client_id: recipient.client_id,
          status: "failed",
          error_message: (error as Error).message,
        });
      }
    }

    // Update the direct email record with final counts
    await supabase
      .from("direct_emails")
      .update({
        sent_count: sentCount,
        failed_count: failedCount,
        status: failedCount === recipients.length ? "failed" : "sent",
        sent_at: new Date().toISOString(),
      })
      .eq("id", directEmailId);

    console.log(`[send-communication-email] Complete: ${sentCount} sent, ${failedCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        direct_email_id: directEmailId,
        total: recipients.length,
        sent: sentCount,
        failed: failedCount,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[send-communication-email] Error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
