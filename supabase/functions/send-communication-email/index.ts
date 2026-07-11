import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
// Module 46 (D46-D): route every outbound email through the canonical
// gateway (rpc_communication_enqueue). No direct email_queue inserts, no
// direct Resend calls — the sms/email drainers are the sole senders.
import { enqueueCommunication } from "../_shared/enqueueCommunication.ts";
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
    // RESEND_API_KEY is no longer read here — the drain worker owns delivery.
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the authenticated user. Default sender is the public support
    // mailbox — the private owner address must never appear to a client.
    const authHeader = req.headers.get("Authorization");
    let senderEmail = "support@nivra-telecom.ca";

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

        // D46-D: canonical gateway. Deterministic idempotency scoped to the
        // direct_email + recipient so duplicate clicks collapse into one send.
        const eqResult = await enqueueCommunication(supabase, {
          channel: "email",
          templateKey: "custom_html",
          recipient: recipient.email,
          idempotencyKey: `direct_email:${directEmailId}:${recipient.email.toLowerCase()}`,
          subject,
          bodyHtml: html,
          category: "operational",
          entityType: "direct_email",
          entityId: directEmailId,
          clientId: recipient.client_id ?? null,
          reason: "communication_email",
        });

        if (!eqResult?.success) {
          const msg = (eqResult as any)?.error || "Queue failed";
          console.error(`Failed to queue for ${recipient.email}:`, msg);
          errors.push(`${recipient.email}: ${msg}`);
          failedCount++;

          await supabase.from("direct_email_recipients").insert({
            direct_email_id: directEmailId,
            email: recipient.email,
            name: recipient.name,
            client_id: recipient.client_id,
            status: "failed",
            error_message: msg,
          });
        } else {
          console.log(`Email queued for ${recipient.email}: ${(eqResult as any).id ?? "ok"}`);
          sentCount++;

          await supabase.from("direct_email_recipients").insert({
            direct_email_id: directEmailId,
            email: recipient.email,
            name: recipient.name,
            client_id: recipient.client_id,
            status: "queued",
            resend_id: (eqResult as any).id ?? null,
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
