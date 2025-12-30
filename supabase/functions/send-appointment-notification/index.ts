import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  email: string;
  name: string;
  appointmentTitle: string;
  appointmentDate: string;
  status: "confirmed" | "updated" | "cancelled" | "completed";
  notes?: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("Send appointment notification received");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const { email, name, appointmentTitle, appointmentDate, status, notes }: NotificationRequest = await req.json();
    console.log("Sending notification to:", email, "Status:", status);

    const statusMessages = {
      confirmed: {
        subject: "Confirmation de votre rendez-vous - Nivra",
        heading: "Votre rendez-vous est confirmé!",
        message: "Nous avons bien confirmé votre rendez-vous.",
        color: "#10b981",
      },
      updated: {
        subject: "Mise à jour de votre rendez-vous - Nivra",
        heading: "Votre rendez-vous a été modifié",
        message: "Les détails de votre rendez-vous ont été mis à jour.",
        color: "#f59e0b",
      },
      cancelled: {
        subject: "Annulation de votre rendez-vous - Nivra",
        heading: "Votre rendez-vous a été annulé",
        message: "Nous vous informons que votre rendez-vous a été annulé.",
        color: "#ef4444",
      },
      completed: {
        subject: "Rendez-vous terminé - Nivra",
        heading: "Merci pour votre visite!",
        message: "Votre rendez-vous s'est bien déroulé. Merci de votre confiance!",
        color: "#6366f1",
      },
    };

    const statusConfig = statusMessages[status];
    const formattedDate = new Date(appointmentDate).toLocaleString("fr-CA", {
      dateStyle: "full",
      timeStyle: "short",
    });

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: "Nivra <onboarding@resend.dev>",
        to: [email],
        subject: statusConfig.subject,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #0891b2, #06b6d4); padding: 30px; text-align: center;">
              <h1 style="color: white; margin: 0;">Nivra</h1>
            </div>
            <div style="padding: 30px; background: #f8fafc;">
              <h2 style="color: #0f172a;">Bonjour ${name || "cher client"},</h2>
              <div style="background: ${statusConfig.color}20; border-left: 4px solid ${statusConfig.color}; padding: 15px; margin: 20px 0;">
                <h3 style="color: ${statusConfig.color}; margin: 0 0 10px;">${statusConfig.heading}</h3>
                <p style="color: #475569; margin: 0;">${statusConfig.message}</p>
              </div>
              <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e2e8f0;">
                <p style="margin: 0; color: #0f172a;"><strong>Rendez-vous:</strong> ${appointmentTitle}</p>
                <p style="margin: 10px 0 0; color: #0f172a;"><strong>Date et heure:</strong> ${formattedDate}</p>
                ${notes ? `<p style="margin: 10px 0 0; color: #64748b;"><strong>Notes:</strong> ${notes}</p>` : ""}
              </div>
              <p style="color: #475569;">Si vous avez des questions, n'hésitez pas à nous contacter au 438-544-2233.</p>
              <p style="color: #475569;">Cordialement,<br>L'équipe Nivra</p>
            </div>
            <div style="background: #0f172a; padding: 20px; text-align: center;">
              <p style="color: #94a3b8; margin: 0; font-size: 12px;">© 2024 Nivra. Tous droits réservés.</p>
            </div>
          </div>
        `,
      }),
    });

    const result = await emailResponse.json();
    console.log("Email sent result:", result);

    if (!emailResponse.ok) {
      throw new Error(result.message || "Failed to send email");
    }

    return new Response(JSON.stringify({ success: true, result }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-appointment-notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
