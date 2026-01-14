import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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
    let senderEmail = "admin@nivratelecom.ca";
    
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

    // Build HTML email
    const buildHtmlEmail = (recipientName: string, plainMessage: string) => {
      // Replace variables
      let processedMessage = plainMessage
        .replace(/\{\{client_name\}\}/g, recipientName || "Client")
        .replace(/\{\{client_email\}\}/g, "");

      // Convert line breaks to <br>
      const htmlMessage = processedMessage.replace(/\n/g, "<br>");

      return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f4f4f5;">
    <tr>
      <td style="padding:40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="margin:0 auto;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#0891b2 0%,#06b6d4 100%);padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;">Nivra Télécom</h1>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding:40px;">
              <p style="margin:0 0 16px;color:#374151;font-size:16px;line-height:1.6;">
                Bonjour ${recipientName || ""},
              </p>
              <div style="margin:0 0 24px;color:#374151;font-size:16px;line-height:1.6;">
                ${htmlMessage}
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#f9fafb;padding:24px 40px;border-top:1px solid #e5e7eb;">
              <p style="margin:0 0 8px;color:#6b7280;font-size:14px;text-align:center;">
                Nivra Télécom - Votre fournisseur de confiance
              </p>
              <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">
                © ${new Date().getFullYear()} Nivra Télécom. Tous droits réservés.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `.trim();
    };

    // Send emails
    let sentCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    for (const recipient of recipients) {
      try {
        const html = buildHtmlEmail(recipient.name, message);

        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: "Nivra Télécom <communication@nivratelecom.ca>",
            reply_to: "support@nivratelecom.ca",
            to: [recipient.email],
            subject,
            html,
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          console.error(`Failed to send to ${recipient.email}:`, result);
          errors.push(`${recipient.email}: ${result.message || "Failed"}`);
          failedCount++;
          
          // Log individual send failure
          await supabase.from("direct_email_recipients").insert({
            direct_email_id: directEmailId,
            email: recipient.email,
            name: recipient.name,
            client_id: recipient.client_id,
            status: "failed",
            error_message: result.message || "Failed to send",
          });
        } else {
          console.log(`Email sent to ${recipient.email}: ${result.id}`);
          sentCount++;
          
          // Log individual send success
          await supabase.from("direct_email_recipients").insert({
            direct_email_id: directEmailId,
            email: recipient.email,
            name: recipient.name,
            client_id: recipient.client_id,
            status: "sent",
            resend_id: result.id,
            sent_at: new Date().toISOString(),
          });
        }

        // Rate limiting: 10 emails per second max
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`Error sending to ${recipient.email}:`, error);
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
