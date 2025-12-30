import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: CalendlyPayload = await req.json();
    console.log("Calendly payload:", JSON.stringify(payload, null, 2));

    const eventType = payload.event;
    const eventData = payload.payload;

    // Handle different Calendly events
    if (eventType === "invitee.created" || eventType === "invitee_created") {
      // New appointment booked
      const scheduledEvent = eventData.scheduled_event || eventData.event;
      const invitee = eventData.invitee;

      // Check if user exists with this email
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("email", invitee.email)
        .single();

      // Create appointment record - client_id is nullable, will be linked when user creates account
      const { data: appointment, error: insertError } = await supabase
        .from("appointments")
        .insert({
          title: scheduledEvent.name || "Consultation",
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

      // Send confirmation email
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      if (resendApiKey) {
        try {
          const emailResponse = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${resendApiKey}`,
            },
            body: JSON.stringify({
              from: "Nivra <onboarding@resend.dev>",
              to: [invitee.email],
              subject: "Confirmation de votre rendez-vous - Nivra",
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <div style="background: linear-gradient(135deg, #0891b2, #06b6d4); padding: 30px; text-align: center;">
                    <h1 style="color: white; margin: 0;">Nivra</h1>
                  </div>
                  <div style="padding: 30px; background: #f8fafc;">
                    <h2 style="color: #0f172a;">Bonjour ${invitee.name},</h2>
                    <p style="color: #475569; font-size: 16px;">Votre rendez-vous a été confirmé!</p>
                    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                      <p style="margin: 0; color: #0f172a;"><strong>Date et heure:</strong> ${new Date(scheduledEvent.start_time).toLocaleString('fr-CA', { dateStyle: 'full', timeStyle: 'short' })}</p>
                      <p style="margin: 10px 0 0; color: #0f172a;"><strong>Type:</strong> ${scheduledEvent.name}</p>
                    </div>
                    <p style="color: #475569;">Si vous avez des questions, n'hésitez pas à nous contacter.</p>
                    <p style="color: #475569;">Cordialement,<br>L'équipe Nivra</p>
                  </div>
                </div>
              `,
            }),
          });
          console.log("Email sent:", await emailResponse.json());
        } catch (emailError) {
          console.error("Error sending email:", emailError);
        }
      }

      return new Response(JSON.stringify({ success: true, appointment }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (eventType === "invitee.canceled" || eventType === "invitee_canceled") {
      // Appointment cancelled
      const invitee = eventData.invitee;
      
      // Update appointment status
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
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
