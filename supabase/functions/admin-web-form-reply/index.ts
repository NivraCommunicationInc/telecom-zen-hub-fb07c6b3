import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Verify admin/staff JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the user is admin/staff
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user is admin or staff
    const { data: adminUser } = await supabase
      .from("admin_users")
      .select("id, is_active")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    const { data: employee } = await supabase
      .from("employees")
      .select("id, is_active, role, full_name, email")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (!adminUser && !employee) {
      return new Response(JSON.stringify({ error: "Access denied" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const staffName = employee?.full_name || user.email || "Support Nivra";
    const staffEmail = employee?.email || user.email;

    const body = await req.json();
    const { thread_id, body_text, body_html, is_internal_note } = body;

    if (!thread_id) {
      return new Response(JSON.stringify({ error: "thread_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!body_text) {
      return new Response(JSON.stringify({ error: "body_text required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch thread
    const { data: thread, error: threadError } = await supabase
      .from("web_form_threads")
      .select("*")
      .eq("id", thread_id)
      .single();

    if (threadError || !thread) {
      return new Response(JSON.stringify({ error: "Thread not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert message
    const { data: message, error: messageError } = await supabase
      .from("web_form_messages")
      .insert({
        thread_id,
        sender_type: "admin",
        sender_email: staffEmail,
        sender_name: staffName,
        body_text,
        body_html,
        direction: "outbound",
        is_internal_note: is_internal_note || false,
      })
      .select()
      .single();

    if (messageError) {
      console.error("Message insert error:", messageError);
      throw new Error("Failed to save message");
    }

    // Update thread
    await supabase
      .from("web_form_threads")
      .update({
        last_message_at: new Date().toISOString(),
        last_sender_type: "admin",
        status: thread.status === "new" ? "open" : thread.status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", thread_id);

    // If not internal note, send email to contact
    if (!is_internal_note) {
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      if (resendApiKey) {
        try {
          const resend = new Resend(resendApiKey);

          // Get reply token
          const { data: emailMap } = await supabase
            .from("web_form_email_map")
            .select("reply_token")
            .eq("thread_id", thread_id)
            .single();

          const replyToken = emailMap?.reply_token;

          const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #16a34a; color: white; padding: 16px 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 24px; border-radius: 0 0 8px 8px; }
    .message-box { background: white; padding: 16px; border-radius: 8px; border-left: 4px solid #16a34a; margin: 16px 0; }
    .footer { text-align: center; color: #666; font-size: 12px; margin-top: 24px; }
    .ref { color: #888; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 style="margin: 0;">Réponse de Nivra Télécom</h2>
      <p class="ref" style="color: #d1fae5; margin: 4px 0 0 0;">Réf: ${thread.thread_number}</p>
    </div>
    <div class="content">
      <p>Bonjour ${thread.contact_full_name},</p>
      
      <div class="message-box">
        ${body_html || body_text.replace(/\n/g, "<br>")}
      </div>
      
      <p style="margin-top: 24px; color: #666;">Vous pouvez répondre directement à cet email pour continuer la conversation.</p>
    </div>
    <div class="footer">
      <p>${staffName}<br>Nivra Télécom</p>
    </div>
  </div>
</body>
</html>`;

          const supportEmail = Deno.env.get("SUPPORT_EMAIL") || "support@nivratelecom.ca";
          const replyTo = replyToken
            ? `webform+${replyToken}@nivratelecom.ca`
            : supportEmail;

          const emailResult = await resend.emails.send({
            from: `${staffName} - Nivra Télécom <${supportEmail}>`,
            to: [thread.contact_email],
            subject: `Re: Formulaire Web [${thread.thread_number}]`,
            html: emailHtml,
            reply_to: replyTo,
            headers: {
              "X-Thread-ID": thread_id,
              "X-Thread-Number": thread.thread_number,
            },
          });

          // Store email message ID for threading
          if (emailResult.data?.id) {
            await supabase
              .from("web_form_messages")
              .update({ email_message_id: emailResult.data.id })
              .eq("id", message.id);
          }

          console.log("Reply email sent:", emailResult);
        } catch (emailError) {
          console.error("Email send error:", emailError);
          // Don't fail the request
        }
      }
    }

    return new Response(
      JSON.stringify({ ok: true, message_id: message.id }),
      {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("admin-web-form-reply error:", message);

    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
