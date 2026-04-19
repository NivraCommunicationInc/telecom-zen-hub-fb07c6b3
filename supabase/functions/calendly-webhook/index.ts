import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { enqueueEmail } from "../_shared/ResendProxy.ts";

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

    const payload: CalendlyPayload = await req.json();
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
              preheader: "Votre rendez-vous Nivra est confirmé.",
              badge: "RENDEZ-VOUS CONFIRMÉ",
              heroTitle: "Rendez-vous confirmé",
              greeting: `Bonjour ${invitee.name},`,
              bodyHtml: "Votre rendez-vous a été confirmé. Voici les détails ci-dessous.",
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
  } catch (error: any) {
    console.error("Error in calendly-webhook:", error);
    const origin = req.headers.get('origin');
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...getCorsHeaders(origin) } }
    );
  }
};

serve(handler);
