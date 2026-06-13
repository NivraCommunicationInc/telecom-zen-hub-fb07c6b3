import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface InboundEmail {
  from?: string;
  fromName?: string;
  to?: string;
  subject?: string;
  text?: string;
  html?: string;
  messageId?: string;
  inReplyTo?: string;
  references?: string;
  // Resend/Postmark/SendGrid may have different field names
  From?: string;
  FromName?: string;
  To?: string;
  Subject?: string;
  TextBody?: string;
  HtmlBody?: string;
  MessageID?: string;
  InReplyTo?: string;
  References?: string;
  // Raw payload for debugging
  [key: string]: unknown;
}

function extractReplyToken(toAddress: string | undefined): string | null {
  if (!toAddress) return null;
  
  // Match webform+TOKEN@domain pattern
  const match = toAddress.match(/webform\+([a-z0-9]+)@/i);
  return match ? match[1] : null;
}

function extractEmail(fromField: string | undefined): string | null {
  if (!fromField) return null;
  
  // Extract email from "Name <email@domain.com>" format
  const match = fromField.match(/<([^>]+)>/);
  if (match) return match[1].toLowerCase().trim();
  
  // Or just the email if no angle brackets
  if (fromField.includes("@")) {
    return fromField.toLowerCase().trim();
  }
  
  return null;
}

function extractName(fromField: string | undefined): string | null {
  if (!fromField) return null;
  
  // Extract name from "Name <email@domain.com>" format
  const match = fromField.match(/^([^<]+)</);
  if (match) return match[1].trim();
  
  return null;
}

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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse inbound email payload (format varies by provider)
    let emailData: InboundEmail;
    
    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      emailData = await req.json();
    } else if (contentType.includes("multipart/form-data") || contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData();
      emailData = Object.fromEntries(formData.entries()) as unknown as InboundEmail;
    } else {
      // Try JSON first, then fallback to text
      const text = await req.text();
      try {
        emailData = JSON.parse(text);
      } catch (_e) {
        console.error("Could not parse email payload:", text.substring(0, 500));
        return new Response(JSON.stringify({ error: "Invalid payload format" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    console.log("Inbound email received:", JSON.stringify(emailData).substring(0, 1000));

    // Normalize field names (different providers use different casing)
    const from = emailData.from || emailData.From || "";
    const to = emailData.to || emailData.To || "";
    const subject = emailData.subject || emailData.Subject || "";
    const textBody = emailData.text || emailData.TextBody || "";
    const htmlBody = emailData.html || emailData.HtmlBody || "";
    const messageId = emailData.messageId || emailData.MessageID || "";
    const inReplyTo = emailData.inReplyTo || emailData.InReplyTo || "";
    const references = emailData.references || emailData.References || "";

    // Try to find thread by reply token
    let threadId: string | null = null;
    const replyToken = extractReplyToken(to);
    
    if (replyToken) {
      const { data: emailMap } = await supabase
        .from("web_form_email_map")
        .select("thread_id")
        .eq("reply_token", replyToken)
        .single();
      
      if (emailMap) {
        threadId = emailMap.thread_id;
      }
    }

    // If no token, try to match by In-Reply-To or References headers
    if (!threadId && (inReplyTo || references)) {
      const refsToCheck = [inReplyTo, ...(references.split(/\s+/) || [])].filter(Boolean);
      
      for (const ref of refsToCheck) {
        const { data: message } = await supabase
          .from("web_form_messages")
          .select("thread_id")
          .eq("email_message_id", ref)
          .maybeSingle();
        
        if (message) {
          threadId = message.thread_id;
          break;
        }
      }
    }

    // If still no thread, try to match by sender email to recent open threads
    if (!threadId) {
      const senderEmail = extractEmail(from);
      if (senderEmail) {
        const { data: recentThread } = await supabase
          .from("web_form_threads")
          .select("id")
          .eq("contact_email", senderEmail)
          .in("status", ["new", "open", "pending"])
          .order("last_message_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (recentThread) {
          threadId = recentThread.id;
        }
      }
    }

    if (!threadId) {
      console.log("Could not match inbound email to any thread:", { from, to, subject });
      // Don't error - just log and return OK so the provider doesn't retry
      return new Response(
        JSON.stringify({ ok: true, matched: false, reason: "No matching thread found" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Fetch thread to verify and update
    const { data: thread } = await supabase
      .from("web_form_threads")
      .select("id, contact_email, contact_full_name, is_linked_client, linked_user_id")
      .eq("id", threadId)
      .single();

    if (!thread) {
      return new Response(
        JSON.stringify({ ok: true, matched: false, reason: "Thread not found" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const senderEmail = extractEmail(from) || thread.contact_email;
    const senderName = extractName(from) || emailData.fromName || thread.contact_full_name;

    // Determine sender type
    let senderType: "contact" | "client" = "contact";
    if (thread.is_linked_client && thread.linked_user_id) {
      // Check if the sender is the linked client
      const { data: linkedUser } = await supabase.auth.admin.getUserById(thread.linked_user_id);
      if (linkedUser?.user?.email?.toLowerCase() === senderEmail.toLowerCase()) {
        senderType = "client";
      }
    }

    // Insert message
    const { data: newMessage, error: messageError } = await supabase
      .from("web_form_messages")
      .insert({
        thread_id: threadId,
        sender_type: senderType,
        sender_email: senderEmail,
        sender_name: senderName,
        body_text: textBody || "(No text content)",
        body_html: htmlBody || null,
        direction: "inbound",
        email_message_id: messageId || null,
        email_in_reply_to: inReplyTo || null,
        raw_email_payload: emailData,
        is_internal_note: false,
      })
      .select()
      .single();

    if (messageError) {
      console.error("Failed to insert message:", messageError);
      throw new Error("Failed to save inbound message");
    }

    // Update thread
    await supabase
      .from("web_form_threads")
      .update({
        last_message_at: new Date().toISOString(),
        last_sender_type: senderType,
        status: "open",
        updated_at: new Date().toISOString(),
      })
      .eq("id", threadId);

    console.log("Inbound email ingested:", {
      thread_id: threadId,
      message_id: newMessage.id,
      from: senderEmail,
    });

    return new Response(
      JSON.stringify({ ok: true, matched: true, thread_id: threadId, message_id: newMessage.id }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("ingest-web-form-email error:", message);

    // Return 200 to prevent email provider retries
    return new Response(
      JSON.stringify({ ok: false, error: message }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
