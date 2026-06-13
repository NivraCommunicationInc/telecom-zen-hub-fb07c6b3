import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { Resend } from "../_shared/ResendProxy.ts";
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from "../_shared/rateLimit.ts";
import { verifyTurnstileToken, getClientIp, turnstileFailResponse } from "../_shared/turnstile.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface WebFormPayload {
  fullName: string;
  firstName?: string;
  lastName?: string;
  email: string;
  phone?: string;
  subject?: string;
  message: string;
  pageUrl?: string;
  preferredContact?: string;
  addressStreet?: string;
  addressCity?: string;
  addressProvince?: string;
  addressPostalCode?: string;
}

function validatePayload(body: unknown): WebFormPayload {
  if (!body || typeof body !== "object") {
    throw new Error("Corps de requête invalide");
  }

  const data = body as Record<string, unknown>;

  // Support both fullName and firstName/lastName
  let fullName = (data.fullName as string) || "";
  if (!fullName && (data.firstName || data.lastName)) {
    fullName = `${data.firstName || ""} ${data.lastName || ""}`.trim();
  }

  const email = (data.email as string) || "";
  const message = (data.message as string) || "";

  if (!fullName) throw new Error("Le nom complet est requis");
  if (!email) throw new Error("L'email est requis");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Format d'email invalide");
  }
  if (!message) throw new Error("Le message est requis");

  return {
    fullName,
    firstName: data.firstName as string,
    lastName: data.lastName as string,
    email: email.toLowerCase().trim(),
    phone: (data.phone as string) || null,
    subject: (data.subject as string) || "Formulaire Web",
    message,
    pageUrl: (data.pageUrl as string) || null,
    preferredContact: data.preferredContact as string,
    addressStreet: data.addressStreet as string,
    addressCity: data.addressCity as string,
    addressProvince: data.addressProvince as string,
    addressPostalCode: data.addressPostalCode as string,
  } as WebFormPayload;
}

function generateReplyToken(): string {
  // CSPRNG: 12 random bytes -> 24 hex chars (96 bits of entropy)
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Méthode non autorisée" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Rate limit: 10 submissions per minute per IP
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rateCheck = await checkRateLimit({ key: `web_form:${clientIp}`, maxAttempts: 10, windowMs: 60_000 });
    if (!rateCheck.allowed) {
      return rateLimitResponse(rateCheck, corsHeaders, "fr");
    }

    const body = await req.json();

    // Turnstile anti-bot verification
    const turnstileToken = body.turnstileToken ?? body.cfTurnstileResponse ?? "";
    const isHuman = await verifyTurnstileToken(turnstileToken, clientIp);
    if (!isHuman) {
      return turnstileFailResponse(corsHeaders);
    }

    const payload = validatePayload(body);
    const userAgent = req.headers.get("user-agent") || "Unknown";

    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if email belongs to an existing user
    const { data: existingUser } = await supabase
      .from("users")
      .select("id, email")
      .eq("email", payload.email)
      .maybeSingle();

    const isLinkedClient = !!existingUser;
    const linkedUserId = existingUser?.id || null;

    // Create thread
    const { data: thread, error: threadError } = await supabase
      .from("web_form_threads")
      .insert({
        subject: payload.subject || "Formulaire Web",
        contact_full_name: payload.fullName,
        contact_email: payload.email,
        contact_phone: payload.phone,
        page_url: payload.pageUrl,
        is_linked_client: isLinkedClient,
        linked_user_id: linkedUserId,
        status: "new",
        last_sender_type: "contact",
      })
      .select("id, thread_number")
      .single();

    if (threadError || !thread) {
      console.error("Thread creation error:", threadError);
      throw new Error("Impossible de créer la conversation");
    }

    // Build message body with all details
    const messageBody = [
      payload.message,
      "",
      "---",
      `Nom: ${payload.fullName}`,
      `Email: ${payload.email}`,
      payload.phone ? `Téléphone: ${payload.phone}` : null,
      payload.preferredContact ? `Contact préféré: ${payload.preferredContact}` : null,
      payload.addressStreet ? `Adresse: ${payload.addressStreet}` : null,
      payload.addressCity ? `Ville: ${payload.addressCity}` : null,
      payload.addressProvince ? `Province: ${payload.addressProvince}` : null,
      payload.addressPostalCode ? `Code postal: ${payload.addressPostalCode}` : null,
      payload.pageUrl ? `Page: ${payload.pageUrl}` : null,
      `User-Agent: ${userAgent}`,
    ]
      .filter(Boolean)
      .join("\n");

    // Create first message
    const { error: messageError } = await supabase
      .from("web_form_messages")
      .insert({
        thread_id: thread.id,
        sender_type: "contact",
        sender_email: payload.email,
        sender_name: payload.fullName,
        body_text: messageBody,
        direction: "inbound",
        is_internal_note: false,
      });

    if (messageError) {
      console.error("Message creation error:", messageError);
      throw new Error("Impossible d'enregistrer le message");
    }

    // Generate reply token for email threading
    const replyToken = generateReplyToken();
    await supabase.from("web_form_email_map").insert({
      thread_id: thread.id,
      reply_token: replyToken,
    });

    // Send confirmation email
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (resendApiKey) {
      try {
        const resend = new Resend(resendApiKey);

        const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #16a34a; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 24px; border-radius: 0 0 8px 8px; }
    .message-box { background: white; padding: 16px; border-radius: 8px; border-left: 4px solid #16a34a; margin: 16px 0; }
    .footer { text-align: center; color: #666; font-size: 12px; margin-top: 24px; }
    .ref { background: #e5e7eb; padding: 8px 12px; border-radius: 4px; display: inline-block; font-family: monospace; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">✓ Message reçu</h1>
    </div>
    <div class="content">
      <p>Bonjour ${escapeHtml(payload.fullName)},</p>
      <p>Nous avons bien reçu votre message. Notre équipe vous répondra sous peu.</p>
      
      <p><strong>Votre message:</strong></p>
      <div class="message-box">
        ${escapeHtml(payload.message).replace(/\n/g, "<br>")}
      </div>
      
      <p><strong>Numéro de référence:</strong></p>
      <p class="ref">${escapeHtml(thread.thread_number)}</p>
      
      <p style="margin-top: 24px;">Vous pouvez répondre directement à cet email pour continuer la conversation.</p>
    </div>
    <div class="footer">
      <p>Nivra Télécom<br>
      support@nivra-telecom.ca</p>
    </div>
  </div>
</body>
</html>`;

        const supportEmail = Deno.env.get("SUPPORT_EMAIL") || "support@nivra-telecom.ca";

        await resend.emails.send({
          from: `Nivra Télécom <${supportEmail}>`,
          to: [payload.email],
          subject: `Confirmation — Formulaire Web reçu [${thread.thread_number}]`,
          html: emailHtml,
          reply_to: `webform+${replyToken}@nivra-telecom.ca`,
          headers: {
            "X-Thread-ID": thread.id,
            "X-Thread-Number": thread.thread_number,
          },
        });

        console.log("Confirmation email sent to:", payload.email);
      } catch (emailError) {
        // Don't fail the request if email fails
        console.error("Email send error:", emailError);
      }
    }

    // LEGACY: Also insert into contact_requests if table exists
    try {
      await supabase.from("contact_requests").insert({
        name: payload.fullName,
        first_name: payload.firstName,
        last_name: payload.lastName,
        email: payload.email,
        phone: payload.phone || "",
        subject: payload.subject,
        notes: payload.message,
        page_url: payload.pageUrl,
        source: "web_form",
        status: "new",
        consent_given: true,
      });
    } catch (_e) {
      // Ignore if table doesn't exist or insert fails
    }

    return new Response(
      JSON.stringify({
        ok: true,
        thread_id: thread.id,
        thread_number: thread.thread_number,
      }),
      {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    console.error("submit-web-form error:", message);

    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
