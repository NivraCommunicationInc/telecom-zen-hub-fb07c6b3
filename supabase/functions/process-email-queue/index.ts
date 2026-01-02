import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailQueueItem {
  id: string;
  event_key: string;
  to_email: string;
  template_key: string;
  template_vars: Record<string, any>;
  status: string;
  attempts: number;
  max_attempts: number;
}

// Email templates with French/English support
const emailTemplates: Record<string, { subject: string; getHtml: (vars: Record<string, any>, baseUrl: string) => string }> = {
  order_submitted: {
    subject: "Confirmation de commande - Nivra",
    getHtml: (vars, baseUrl) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #0891b2, #06b6d4); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0;">Nivra</h1>
        </div>
        <div style="padding: 30px; background: #f8fafc;">
          <h2 style="color: #0f172a;">Bonjour ${vars.client_name || 'cher client'},</h2>
          <div style="background: #10b98120; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0;">
            <h3 style="color: #10b981; margin: 0 0 10px;">✅ Commande reçue!</h3>
            <p style="color: #475569; margin: 0;">Votre commande a été soumise avec succès.</p>
          </div>
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e2e8f0;">
            <p><strong>Numéro de commande:</strong> ${vars.order_number || vars.order_id}</p>
            <p><strong>Service:</strong> ${vars.service_type}</p>
            <p><strong>Montant:</strong> ${new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(vars.total_amount || 0)}</p>
          </div>
          <p style="color: #475569;">Consultez votre portail client pour suivre votre commande: <a href="${baseUrl}/portal/orders" style="color: #0891b2;">${baseUrl}/portal/orders</a></p>
          <p style="color: #475569;">L'équipe Nivra</p>
        </div>
        <div style="background: #0f172a; padding: 20px; text-align: center;">
          <p style="color: #94a3b8; margin: 0; font-size: 12px;">© ${new Date().getFullYear()} Nivra. Tous droits réservés.</p>
        </div>
      </div>
    `,
  },
  order_processed: {
    subject: "Commande en traitement - Nivra",
    getHtml: (vars, baseUrl) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #0891b2, #06b6d4); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0;">Nivra</h1>
        </div>
        <div style="padding: 30px; background: #f8fafc;">
          <h2>Bonjour ${vars.client_name},</h2>
          <div style="background: #0891b220; border-left: 4px solid #0891b2; padding: 15px; margin: 20px 0;">
            <h3 style="color: #0891b2;">📦 Commande en cours de traitement</h3>
            <p>Votre commande ${vars.order_number} est maintenant en traitement.</p>
          </div>
          <p><a href="${baseUrl}/portal/orders">Suivre ma commande</a></p>
          <p>L'équipe Nivra</p>
        </div>
      </div>
    `,
  },
  order_shipped: {
    subject: "Commande expédiée - Nivra",
    getHtml: (vars, baseUrl) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #0891b2, #06b6d4); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0;">Nivra</h1>
        </div>
        <div style="padding: 30px; background: #f8fafc;">
          <h2>Bonjour ${vars.client_name},</h2>
          <div style="background: #10b98120; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0;">
            <h3 style="color: #10b981;">🚚 Commande expédiée!</h3>
            <p>Votre commande ${vars.order_number} a été expédiée.</p>
          </div>
          <p><a href="${baseUrl}/portal/orders">Suivre ma commande</a></p>
          <p>L'équipe Nivra</p>
        </div>
      </div>
    `,
  },
  order_completed: {
    subject: "Commande terminée - Nivra",
    getHtml: (vars, baseUrl) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #0891b2, #06b6d4); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0;">Nivra</h1>
        </div>
        <div style="padding: 30px; background: #f8fafc;">
          <h2>Bonjour ${vars.client_name},</h2>
          <div style="background: #10b98120; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0;">
            <h3 style="color: #10b981;">✅ Commande terminée</h3>
            <p>Votre commande ${vars.order_number} a été complétée avec succès!</p>
          </div>
          <p>Merci de faire confiance à Nivra!</p>
          <p>L'équipe Nivra</p>
        </div>
      </div>
    `,
  },
  order_cancelled: {
    subject: "Commande annulée - Nivra",
    getHtml: (vars, baseUrl) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #0891b2, #06b6d4); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0;">Nivra</h1>
        </div>
        <div style="padding: 30px; background: #f8fafc;">
          <h2>Bonjour ${vars.client_name},</h2>
          <div style="background: #ef444420; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0;">
            <h3 style="color: #ef4444;">❌ Commande annulée</h3>
            <p>Votre commande ${vars.order_number} a été annulée.</p>
          </div>
          <p>Si vous avez des questions, contactez-nous au 438-544-2233.</p>
          <p>L'équipe Nivra</p>
        </div>
      </div>
    `,
  },
  invoice_created: {
    subject: "Nouvelle facture - Nivra",
    getHtml: (vars, baseUrl) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #0891b2, #06b6d4); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0;">Nivra</h1>
        </div>
        <div style="padding: 30px; background: #f8fafc;">
          <h2>Bonjour ${vars.client_name},</h2>
          <div style="background: #0891b220; border-left: 4px solid #0891b2; padding: 15px; margin: 20px 0;">
            <h3 style="color: #0891b2;">📄 Nouvelle facture</h3>
            <p>Une nouvelle facture a été créée pour votre compte.</p>
          </div>
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e2e8f0;">
            <p><strong>Facture:</strong> ${vars.invoice_number}</p>
            <p><strong>Montant:</strong> ${new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(vars.amount || 0)}</p>
            ${vars.due_date ? `<p><strong>Date d'échéance:</strong> ${new Date(vars.due_date).toLocaleDateString('fr-CA')}</p>` : ''}
          </div>
          <p><a href="${baseUrl}/portal/invoices" style="color: #0891b2;">Voir ma facture</a></p>
          <p>L'équipe Nivra</p>
        </div>
      </div>
    `,
  },
  payment_received: {
    subject: "Paiement reçu - Merci! - Nivra",
    getHtml: (vars, baseUrl) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #0891b2, #06b6d4); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0;">Nivra</h1>
        </div>
        <div style="padding: 30px; background: #f8fafc;">
          <h2>Bonjour ${vars.client_name},</h2>
          <div style="background: #10b98120; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0;">
            <h3 style="color: #10b981;">✅ Paiement reçu</h3>
            <p>Nous avons bien reçu votre paiement. Merci!</p>
          </div>
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e2e8f0;">
            <p><strong>Facture:</strong> ${vars.invoice_number}</p>
            <p><strong>Montant:</strong> ${new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(vars.amount || 0)}</p>
          </div>
          <p>Merci de faire confiance à Nivra!</p>
          <p>L'équipe Nivra</p>
        </div>
      </div>
    `,
  },
  invoice_overdue: {
    subject: "⚠️ Facture en retard - Nivra",
    getHtml: (vars, baseUrl) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #0891b2, #06b6d4); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0;">Nivra</h1>
        </div>
        <div style="padding: 30px; background: #f8fafc;">
          <h2>Bonjour ${vars.client_name},</h2>
          <div style="background: #f59e0b20; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
            <h3 style="color: #f59e0b;">⚠️ Rappel de paiement</h3>
            <p>Votre facture est maintenant en retard. Veuillez effectuer le paiement dès que possible.</p>
          </div>
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e2e8f0;">
            <p><strong>Facture:</strong> ${vars.invoice_number}</p>
            <p><strong>Montant dû:</strong> ${new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(vars.amount || 0)}</p>
          </div>
          <p><a href="${baseUrl}/portal/invoices" style="background: #0891b2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Payer maintenant</a></p>
          <p style="margin-top: 20px;">L'équipe Nivra</p>
        </div>
      </div>
    `,
  },
  payment_failed: {
    subject: "❌ Échec du paiement - Nivra",
    getHtml: (vars, baseUrl) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #0891b2, #06b6d4); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0;">Nivra</h1>
        </div>
        <div style="padding: 30px; background: #f8fafc;">
          <h2>Bonjour ${vars.client_name},</h2>
          <div style="background: #ef444420; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0;">
            <h3 style="color: #ef4444;">❌ Paiement non réussi</h3>
            <p>Votre paiement n'a pas pu être traité.</p>
          </div>
          <p>Veuillez vérifier vos informations de paiement et réessayer.</p>
          <p><a href="${baseUrl}/portal/invoices">Réessayer le paiement</a></p>
          <p>L'équipe Nivra</p>
        </div>
      </div>
    `,
  },
  ticket_created: {
    subject: "Ticket de support créé - Nivra",
    getHtml: (vars, baseUrl) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #0891b2, #06b6d4); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0;">Nivra</h1>
        </div>
        <div style="padding: 30px; background: #f8fafc;">
          <h2>Bonjour ${vars.client_name},</h2>
          <div style="background: #0891b220; border-left: 4px solid #0891b2; padding: 15px; margin: 20px 0;">
            <h3 style="color: #0891b2;">🎫 Ticket créé</h3>
            <p>Votre demande de support a été reçue.</p>
          </div>
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e2e8f0;">
            <p><strong>Ticket:</strong> ${vars.ticket_number}</p>
            <p><strong>Sujet:</strong> ${vars.subject}</p>
          </div>
          <p>Notre équipe vous répondra dans les plus brefs délais.</p>
          <p><a href="${baseUrl}/portal/tickets">Voir mon ticket</a></p>
          <p>L'équipe Nivra</p>
        </div>
      </div>
    `,
  },
  ticket_reply: {
    subject: "Nouvelle réponse à votre ticket - Nivra",
    getHtml: (vars, baseUrl) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #0891b2, #06b6d4); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0;">Nivra</h1>
        </div>
        <div style="padding: 30px; background: #f8fafc;">
          <h2>Bonjour ${vars.client_name},</h2>
          <div style="background: #10b98120; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0;">
            <h3 style="color: #10b981;">💬 Nouvelle réponse</h3>
            <p>Vous avez reçu une nouvelle réponse à votre ticket ${vars.ticket_number}.</p>
          </div>
          ${vars.reply_preview ? `<div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e2e8f0;"><p style="color: #64748b; font-style: italic;">"${vars.reply_preview}..."</p></div>` : ''}
          <p><a href="${baseUrl}/portal/tickets" style="background: #0891b2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Voir la réponse</a></p>
          <p style="margin-top: 20px;">L'équipe Nivra</p>
        </div>
      </div>
    `,
  },
  appointment_scheduled: {
    subject: "Rendez-vous confirmé - Nivra",
    getHtml: (vars, baseUrl) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #0891b2, #06b6d4); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0;">Nivra</h1>
        </div>
        <div style="padding: 30px; background: #f8fafc;">
          <h2>Bonjour ${vars.client_name},</h2>
          <div style="background: #10b98120; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0;">
            <h3 style="color: #10b981;">📅 Rendez-vous confirmé</h3>
            <p>Votre rendez-vous a été planifié avec succès.</p>
          </div>
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e2e8f0;">
            <p><strong>Titre:</strong> ${vars.title}</p>
            <p><strong>Date:</strong> ${vars.scheduled_at ? new Date(vars.scheduled_at).toLocaleString('fr-CA', { dateStyle: 'long', timeStyle: 'short' }) : 'À confirmer'}</p>
            ${vars.service_address ? `<p><strong>Adresse:</strong> ${vars.service_address}</p>` : ''}
          </div>
          <p><a href="${baseUrl}/portal/appointments">Voir mes rendez-vous</a></p>
          <p>L'équipe Nivra</p>
        </div>
      </div>
    `,
  },
  appointment_updated: {
    subject: "Rendez-vous mis à jour - Nivra",
    getHtml: (vars, baseUrl) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #0891b2, #06b6d4); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0;">Nivra</h1>
        </div>
        <div style="padding: 30px; background: #f8fafc;">
          <h2>Bonjour ${vars.client_name},</h2>
          <div style="background: #f59e0b20; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
            <h3 style="color: #f59e0b;">📅 Rendez-vous mis à jour</h3>
            <p>Votre rendez-vous a été modifié.</p>
          </div>
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e2e8f0;">
            <p><strong>Titre:</strong> ${vars.title}</p>
            <p><strong>Nouvelle date:</strong> ${vars.scheduled_at ? new Date(vars.scheduled_at).toLocaleString('fr-CA', { dateStyle: 'long', timeStyle: 'short' }) : 'À confirmer'}</p>
          </div>
          <p><a href="${baseUrl}/portal/appointments">Voir mes rendez-vous</a></p>
          <p>L'équipe Nivra</p>
        </div>
      </div>
    `,
  },
  appointment_cancelled: {
    subject: "Rendez-vous annulé - Nivra",
    getHtml: (vars, baseUrl) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #0891b2, #06b6d4); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0;">Nivra</h1>
        </div>
        <div style="padding: 30px; background: #f8fafc;">
          <h2>Bonjour ${vars.client_name},</h2>
          <div style="background: #ef444420; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0;">
            <h3 style="color: #ef4444;">❌ Rendez-vous annulé</h3>
            <p>Votre rendez-vous a été annulé.</p>
          </div>
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e2e8f0;">
            <p><strong>Titre:</strong> ${vars.title}</p>
          </div>
          <p>Pour reprogrammer, veuillez nous contacter au 438-544-2233.</p>
          <p>L'équipe Nivra</p>
        </div>
      </div>
    `,
  },
  test_email: {
    subject: "Test Email - Nivra System",
    getHtml: (vars, baseUrl) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #0891b2, #06b6d4); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0;">Nivra</h1>
        </div>
        <div style="padding: 30px; background: #f8fafc;">
          <h2>Test Email</h2>
          <div style="background: #10b98120; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0;">
            <h3 style="color: #10b981;">✅ Email System Working</h3>
            <p>This is a test email to verify the email system is configured correctly.</p>
          </div>
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e2e8f0;">
            <p><strong>Sent at:</strong> ${new Date().toISOString()}</p>
            <p><strong>To:</strong> ${vars.to_email}</p>
            <p><strong>Base URL:</strong> ${baseUrl}</p>
          </div>
          <p>L'équipe Nivra</p>
        </div>
      </div>
    `,
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const emailFromAddress = Deno.env.get("EMAIL_FROM_ADDRESS") || "Nivra <onboarding@resend.dev>";
  const appBaseUrl = Deno.env.get("APP_BASE_URL") || "https://nivratelecom.com";

  if (!resendApiKey) {
    console.error("RESEND_API_KEY not configured");
    return new Response(JSON.stringify({ error: "Email service not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    // Check if this is a test email request
    const url = new URL(req.url);
    if (url.searchParams.get("test") === "true") {
      const body = await req.json();
      const testEmail = body.to_email;
      
      if (!testEmail) {
        return new Response(JSON.stringify({ error: "to_email required for test" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const template = emailTemplates.test_email;
      const html = template.getHtml({ to_email: testEmail }, appBaseUrl);

      const emailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: emailFromAddress,
          to: [testEmail],
          subject: template.subject,
          html,
        }),
      });

      const result = await emailResponse.json();

      if (!emailResponse.ok) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: result.message || "Failed to send test email",
          details: result
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        success: true,
        recipient: testEmail,
        template: "test_email",
        provider_message_id: result.id,
        from: emailFromAddress,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Process email queue
    const { data: queuedEmails, error: fetchError } = await supabase
      .from("email_queue")
      .select("*")
      .eq("status", "queued")
      .lte("next_retry_at", new Date().toISOString())
      .order("created_at", { ascending: true })
      .limit(20);

    if (fetchError) {
      console.error("Error fetching email queue:", fetchError);
      throw fetchError;
    }

    console.log(`Processing ${queuedEmails?.length || 0} queued emails`);

    const results = [];

    for (const email of queuedEmails || []) {
      // Mark as processing
      await supabase
        .from("email_queue")
        .update({ status: "processing" })
        .eq("id", email.id);

      try {
        const template = emailTemplates[email.template_key];
        
        if (!template) {
          throw new Error(`Unknown template: ${email.template_key}`);
        }

        const html = template.getHtml(email.template_vars || {}, appBaseUrl);

        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: emailFromAddress,
            to: [email.to_email],
            subject: template.subject,
            html,
          }),
        });

        const result = await emailResponse.json();

        if (!emailResponse.ok) {
          throw new Error(result.message || "Failed to send email");
        }

        // Mark as sent
        await supabase
          .from("email_queue")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            provider_message_id: result.id,
            attempts: email.attempts + 1,
          })
          .eq("id", email.id);

        results.push({ id: email.id, status: "sent", provider_id: result.id });
        console.log(`Email sent: ${email.id} to ${email.to_email}`);

      } catch (sendError: any) {
        const newAttempts = email.attempts + 1;
        const maxAttempts = email.max_attempts || 5;
        const nextStatus = newAttempts >= maxAttempts ? "failed" : "queued";
        
        // Exponential backoff: 1min, 2min, 4min, 8min, 16min
        const backoffMinutes = Math.pow(2, newAttempts - 1);
        const nextRetry = new Date(Date.now() + backoffMinutes * 60 * 1000).toISOString();

        await supabase
          .from("email_queue")
          .update({
            status: nextStatus,
            attempts: newAttempts,
            last_error: sendError.message,
            next_retry_at: nextRetry,
          })
          .eq("id", email.id);

        results.push({ id: email.id, status: nextStatus, error: sendError.message });
        console.error(`Email failed: ${email.id}`, sendError.message);
      }
    }

    // Cleanup old rate limits (ignore errors)
    try {
      await supabase.rpc("cleanup_old_rate_limits");
    } catch (e) {
      // Ignore cleanup errors
    }

    return new Response(JSON.stringify({
      success: true,
      processed: results.length,
      results,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Error processing email queue:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
