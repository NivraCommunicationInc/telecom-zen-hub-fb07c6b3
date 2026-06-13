import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { enqueueEmail } from "../_shared/ResendProxy.ts";
import { violetShell } from "../_shared/violetEmailShell.ts";

interface CalendlyPayload {
  event: string;
  payload: {
    event: {
      uuid: string;
      name: string;
      start_time: string;
      end_time: string;
      status: string;
    };
    invitee: {
      uuid: string;
      email: string;
      name: string;
      questions_and_answers?: Array<{
        question: string;
        answer: string;
      }>;
    };
    scheduled_event?: {
      uuid: string;
      name: string;
      start_time: string;
      end_time: string;
    };
  };
}

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmacSha256Hex(secret: string, body: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Calendly header format: `t=<timestamp>,v1=<hex-hmac>`
async function verifyCalendlySignature(req: Request, rawBody: string): Promise<boolean> {
  const secret = Deno.env.get("CALENDLY_WEBHOOK_SIGNING_KEY");
  if (!secret) {
    console.error("[calendly-webhook] CALENDLY_WEBHOOK_SIGNING_KEY not configured â€” rejecting");
    return false;
  }
  const header = req.headers.get("calendly-webhook-signature");
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((p) => { const [k, v] = p.split("="); return [k?.trim(), v?.trim()]; }),
  ) as Record<string, string>;
  const t = parts["t"];
  const v1 = parts["v1"];
  if (!t || !v1) return false;
  // Reject signatures older than 5 minutes to prevent replay.
  const tsMs = Number(t) * 1000;
  if (!Number.isFinite(tsMs) || Math.abs(Date.now() - tsMs) > 5 * 60 * 1000) return false;
  const expected = await hmacSha256Hex(secret, `${t}.${rawBody}`);
  return timingSafeEqualStr(v1.toLowerCase(), expected.toLowerCase());
}

const handler = async (req: Request): Promise<Response> => {
  console.log("Calendly webhook received");
  
  // Handle CORS preflight
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;
  
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const rawBody = await req.text();
    if (!(await verifyCalendlySignature(req, rawBody))) {
      console.warn("[calendly-webhook] Rejected: invalid or missing signature");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    const payload: CalendlyPayload = JSON.parse(rawBody);
    console.log("Calendly payload:", JSON.stringify(payload, null, 2));

    const eventType = payload.event;
    const eventData = payload.payload;

    if (eventType === "invitee.created" || eventType === "invitee_created") {
      const scheduledEvent = eventData.scheduled_event || eventData.event;
      const invitee = eventData.invitee;

      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("email", invitee.email)
        .single();

      // Idempotency: skip if appointment already exists for this email + time
      const { data: existingAppt } = await supabase
        .from("appointments")
        .select("id")
        .eq("client_email", invitee.email.toLowerCase())
        .eq("scheduled_at", scheduledEvent.start_time)
        .maybeSingle();

      if (existingAppt) {
        console.log("Appointment already exists, skipping duplicate webhook:", existingAppt.id);
        return new Response(JSON.stringify({ success: true, appointment: existingAppt, deduplicated: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: appointment, error: insertError } = await supabase
        .from("appointments")
        .insert({
          title: scheduledEvent.name || "Rendez-vous",
          scheduled_at: scheduledEvent.start_time,
          status: "scheduled",
          client_email: invitee.email.toLowerCase(),
          client_id: existingProfile?.user_id || null,
          description: `Rendez-vous pris par ${invitee.name} via Calendly`,
        })
        .select()
        .single();

      if (insertError) {
        console.error("Error inserting appointment:", insertError);
        throw insertError;
      }

      console.log("Appointment created:", appointment);

      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      if (resendApiKey) {
        try {
          const eqResult = await enqueueEmail({
            to: invitee.email,
            templateKey: "custom_html",
            subject: "Confirmation de votre rendez-vous - Nivra",
            fromEmail: "Nivra <noreply@nivra-telecom.ca>",
            messageType: "appointment_confirmation",
            entityType: "appointment",
            entityId: appointment?.id,
            html: violetShell({
              preheader: "Votre rendez-vous Nivra est confirmÃ©.",
              badge: "RENDEZ-VOUS CONFIRMÃ‰",
              heroTitle: "Rendez-vous confirmÃ©",
              greeting: `Bonjour ${invitee.name},`,
              bodyHtml: "Votre rendez-vous a Ã©tÃ© confirmÃ©. Voici les dÃ©tails ci-dessous.",
              cardTitle: "Rendez-vous",
              cardRows: [
                ["Date et heure", new Date(scheduledEvent.start_time).toLocaleString('fr-CA', { dateStyle: 'full', timeStyle: 'short' })],
                ["Type", scheduledEvent.name || "Rendez-vous"],
              ],
            }),
          });
          console.log("Email queued:", eqResult);
        } catch (emailError) {
          console.error("Error queuing email:", emailError);
        }
      }

      return new Response(JSON.stringify({ success: true, appointment }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (eventType === "invitee.canceled" || eventType === "invitee_canceled") {
      const invitee = eventData.invitee;
      
      const { error: updateError } = await supabase
        .from("appointments")
        .update({ status: "cancelled" })
        .eq("client_email", invitee.email)
        .order("created_at", { ascending: false })
        .limit(1);

      if (updateError) {
        console.error("Error updating appointment:", updateError);
      }

      return new Response(JSON.stringify({ success: true, message: "Appointment cancelled" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    return new Response(JSON.stringify({ success: true, message: "Event processed" }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error) {
    console.error("Error in calendly-webhook:", error);
    const origin = req.headers.get('origin');
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...getCorsHeaders(origin) } }
    );
  }
};

serve(handler);
