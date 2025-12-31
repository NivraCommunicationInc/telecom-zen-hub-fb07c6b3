import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BillingNotificationRequest {
  email: string;
  name: string;
  type: "invoice_created" | "payment_received" | "payment_failed" | "invoice_overdue";
  invoiceNumber?: string;
  amount: number;
  dueDate?: string;
  paidAt?: string;
  paymentMethod?: string;
  notes?: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("Send billing notification received");

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
      invoiceNumber, 
      amount, 
      dueDate, 
      paidAt, 
      paymentMethod,
      notes 
    }: BillingNotificationRequest = await req.json();
    
    console.log("Sending billing notification to:", email, "Type:", type);

    const formatCurrency = (value: number) => {
      return new Intl.NumberFormat("fr-CA", {
        style: "currency",
        currency: "CAD",
      }).format(value);
    };

    const formatDate = (dateStr: string) => {
      return new Date(dateStr).toLocaleDateString("fr-CA", {
        dateStyle: "long",
      });
    };

    const typeConfigs = {
      invoice_created: {
        subject: `Nouvelle facture ${invoiceNumber || ""} - Nivra`,
        heading: "Nouvelle facture créée",
        message: "Une nouvelle facture a été créée pour votre compte.",
        color: "#0891b2",
        icon: "📄",
      },
      payment_received: {
        subject: "Confirmation de paiement - Nivra",
        heading: "Paiement reçu avec succès!",
        message: "Nous avons bien reçu votre paiement. Merci!",
        color: "#10b981",
        icon: "✅",
      },
      payment_failed: {
        subject: "Échec du paiement - Nivra",
        heading: "Paiement non réussi",
        message: "Votre paiement n'a pas pu être traité. Veuillez vérifier vos informations de paiement.",
        color: "#ef4444",
        icon: "❌",
      },
      invoice_overdue: {
        subject: "Facture en retard - Nivra",
        heading: "Rappel de paiement",
        message: "Votre facture est maintenant en retard. Veuillez effectuer le paiement dès que possible.",
        color: "#f59e0b",
        icon: "⚠️",
      },
    };

    const config = typeConfigs[type];

    let detailsHtml = "";
    
    if (invoiceNumber) {
      detailsHtml += `<p style="margin: 8px 0; color: #0f172a;"><strong>Numéro de facture:</strong> ${invoiceNumber}</p>`;
    }
    
    detailsHtml += `<p style="margin: 8px 0; color: #0f172a;"><strong>Montant:</strong> ${formatCurrency(amount)}</p>`;
    
    if (dueDate) {
      detailsHtml += `<p style="margin: 8px 0; color: #0f172a;"><strong>Date d'échéance:</strong> ${formatDate(dueDate)}</p>`;
    }
    
    if (paidAt) {
      detailsHtml += `<p style="margin: 8px 0; color: #0f172a;"><strong>Date de paiement:</strong> ${formatDate(paidAt)}</p>`;
    }
    
    if (paymentMethod) {
      detailsHtml += `<p style="margin: 8px 0; color: #0f172a;"><strong>Méthode de paiement:</strong> ${paymentMethod}</p>`;
    }
    
    if (notes) {
      detailsHtml += `<p style="margin: 8px 0; color: #64748b;"><strong>Notes:</strong> ${notes}</p>`;
    }

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
              <h1 style="color: white; margin: 0;">Nivra</h1>
            </div>
            <div style="padding: 30px; background: #f8fafc;">
              <h2 style="color: #0f172a;">Bonjour ${name || "cher client"},</h2>
              
              <div style="background: ${config.color}20; border-left: 4px solid ${config.color}; padding: 15px; margin: 20px 0;">
                <h3 style="color: ${config.color}; margin: 0 0 10px;">${config.icon} ${config.heading}</h3>
                <p style="color: #475569; margin: 0;">${config.message}</p>
              </div>
              
              <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e2e8f0;">
                <h4 style="margin: 0 0 15px; color: #0f172a;">Détails</h4>
                ${detailsHtml}
              </div>
              
              ${type === "invoice_created" || type === "invoice_overdue" ? `
                <div style="text-align: center; margin: 25px 0;">
                  <p style="color: #475569; margin-bottom: 15px;">Connectez-vous à votre portail client pour consulter et payer votre facture.</p>
                </div>
              ` : ""}
              
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
    console.error("Error in send-billing-notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);