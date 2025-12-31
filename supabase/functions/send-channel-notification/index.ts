import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ChannelNotificationRequest {
  email: string;
  name: string;
  type: "confirmed" | "cancelled";
  channels: Array<{ name: string; price: number }>;
  totalPrice: number;
  notes?: string;
  ticketNumber?: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("Send channel notification received");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const { 
      email, 
      name, 
      type, 
      channels,
      totalPrice,
      notes,
      ticketNumber
    }: ChannelNotificationRequest = await req.json();
    
    console.log("Sending channel notification to:", email, "Type:", type);

    const formatCurrency = (value: number) => {
      return new Intl.NumberFormat("fr-CA", {
        style: "currency",
        currency: "CAD",
      }).format(value);
    };

    const typeConfigs = {
      confirmed: {
        subject: "Sélection de chaînes confirmée - Nivra",
        heading: "Votre sélection de chaînes a été confirmée! 🎉",
        message: "Bonne nouvelle! Votre sélection de chaînes TV a été approuvée et sera activée sous peu.",
        color: "#10b981",
        icon: "✅",
        statusText: "Confirmée",
      },
      cancelled: {
        subject: "Sélection de chaînes annulée - Nivra",
        heading: "Votre sélection de chaînes a été annulée",
        message: "Votre demande de sélection de chaînes TV n'a pas pu être traitée.",
        color: "#ef4444",
        icon: "❌",
        statusText: "Annulée",
      },
    };

    const config = typeConfigs[type];

    // Build channels list HTML
    const channelsListHtml = channels.map(ch => 
      `<tr>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${ch.name}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: right;">${ch.price === 0 ? 'Inclus' : formatCurrency(ch.price)}</td>
      </tr>`
    ).join('');

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: "Nivra <onboarding@resend.dev>",
        to: [email],
        subject: config.subject,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #0891b2, #06b6d4); padding: 30px; text-align: center;">
              <h1 style="color: white; margin: 0;">📺 Nivra TV</h1>
            </div>
            <div style="padding: 30px; background: #f8fafc;">
              <h2 style="color: #0f172a;">Bonjour ${name || "cher client"},</h2>
              
              <div style="background: ${config.color}20; border-left: 4px solid ${config.color}; padding: 15px; margin: 20px 0;">
                <h3 style="color: ${config.color}; margin: 0 0 10px;">${config.icon} ${config.heading}</h3>
                <p style="color: #475569; margin: 0;">${config.message}</p>
              </div>
              
              ${ticketNumber ? `<p style="color: #64748b; font-size: 14px;"><strong>Numéro de ticket:</strong> ${ticketNumber}</p>` : ''}
              
              <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e2e8f0;">
                <h4 style="margin: 0 0 15px; color: #0f172a;">Chaînes sélectionnées (${channels.length})</h4>
                <table style="width: 100%; border-collapse: collapse;">
                  <thead>
                    <tr style="background: #f1f5f9;">
                      <th style="padding: 10px; text-align: left; font-weight: 600;">Chaîne</th>
                      <th style="padding: 10px; text-align: right; font-weight: 600;">Prix/mois</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${channelsListHtml}
                  </tbody>
                  <tfoot>
                    <tr style="background: #0891b210;">
                      <td style="padding: 12px; font-weight: bold;">Total mensuel</td>
                      <td style="padding: 12px; text-align: right; font-weight: bold; color: #0891b2;">${formatCurrency(totalPrice)}/mois</td>
                    </tr>
                  </tfoot>
                </table>
                <p style="font-size: 12px; color: #64748b; margin-top: 10px;">+ taxes applicables (TPS 5% + TVQ 9.975%)</p>
              </div>
              
              ${notes ? `
                <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0;">
                  <h4 style="margin: 0 0 10px; color: #92400e;">📝 Notes de l'administrateur</h4>
                  <p style="color: #78350f; margin: 0;">${notes}</p>
                </div>
              ` : ''}
              
              ${type === 'confirmed' ? `
                <div style="background: #ecfdf5; padding: 15px; border-radius: 8px; margin: 20px 0;">
                  <h4 style="margin: 0 0 10px; color: #065f46;">📋 Prochaines étapes</h4>
                  <ol style="color: #047857; margin: 0; padding-left: 20px;">
                    <li style="margin-bottom: 8px;">Vos chaînes seront activées dans les 2-24 heures</li>
                    <li style="margin-bottom: 8px;">Vous recevrez une confirmation une fois l'activation terminée</li>
                    <li>Les frais seront ajoutés à votre prochaine facture</li>
                  </ol>
                </div>
              ` : `
                <div style="background: #fef2f2; padding: 15px; border-radius: 8px; margin: 20px 0;">
                  <h4 style="margin: 0 0 10px; color: #991b1b;">📞 Besoin d'aide?</h4>
                  <p style="color: #7f1d1d; margin: 0;">Si vous avez des questions concernant cette annulation, n'hésitez pas à nous contacter.</p>
                </div>
              `}
              
              <p style="color: #475569;">Pour toute question, contactez-nous au <strong>438-544-2233</strong>.</p>
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
    console.error("Error in send-channel-notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
