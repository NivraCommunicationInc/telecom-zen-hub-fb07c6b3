/**
 * send-quote-email — Professional transactional email for quote delivery.
 * Builds Nivra-branded HTML and enqueues via Lovable email pipeline (pgmq).
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import {
  emailDocument, header, contentWrapper, footer, statusBanner,
  sectionHeader, infoRow, button, amountBox, greeting, bodyText, divider,
  colors, fonts, escapeHtml, formatCurrencySimple,
} from "../_shared/emailTemplates/components.ts";

interface QuoteEmailRequest {
  quoteId: string;
  mode?: "quote" | "checkout_link";
}

function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h\d|li|tr|table|section)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

serve(async (req) => {
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Authenticate caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { quoteId, mode = "quote" }: QuoteEmailRequest = await req.json();
    if (!quoteId) {
      return new Response(JSON.stringify({ error: "quoteId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch quote
    const { data: quote, error: qErr } = await supabase
      .from("quotes")
      .select("*, checkout_token")
      .eq("id", quoteId)
      .single();

    if (qErr || !quote) {
      return new Response(JSON.stringify({ error: "Quote not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine recipient — mask PII for anonymous/unreliable identity quotes
    let recipientEmail: string | null = null;
    let clientName = "Client";
    const isAnonymous = quote.requires_identity_capture === true;

    if (quote.is_prospect) {
      recipientEmail = quote.prospect_email;
      // For anonymous quotes, hide name in email greeting
      clientName = isAnonymous ? "Client" : (quote.prospect_name || "Client");
    } else if (quote.customer_user_id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("user_id", quote.customer_user_id)
        .maybeSingle();
      recipientEmail = profile?.email || null;
      clientName = profile?.full_name || "Client";
    }

    if (!recipientEmail) {
      return new Response(JSON.stringify({ error: "Aucune adresse courriel disponible" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ensure transactional emails always have a valid unsubscribe token
    let unsubscribeToken: string | null = null;
    const { data: existingUnsubToken } = await supabase
      .from("email_unsubscribe_tokens")
      .select("token")
      .eq("email", recipientEmail)
      .maybeSingle();

    if (existingUnsubToken?.token) {
      unsubscribeToken = existingUnsubToken.token;
    } else {
      const generatedToken = crypto.randomUUID();
      const { error: insertTokenError } = await supabase
        .from("email_unsubscribe_tokens")
        .insert({ email: recipientEmail, token: generatedToken });

      if (insertTokenError) {
        // Handle race (another process inserted same email simultaneously)
        const { data: racedToken } = await supabase
          .from("email_unsubscribe_tokens")
          .select("token")
          .eq("email", recipientEmail)
          .maybeSingle();
        unsubscribeToken = racedToken?.token || null;
      } else {
        unsubscribeToken = generatedToken;
      }
    }

    if (!unsubscribeToken) {
      return new Response(JSON.stringify({ error: "Impossible de générer le token de désabonnement" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch lines
    const { data: lines } = await supabase
      .from("quote_lines")
      .select("*")
      .eq("quote_id", quoteId)
      .order("created_at", { ascending: true });

    // Fetch approved adjustments
    const { data: adjustments } = await supabase
      .from("quote_adjustments")
      .select("*")
      .eq("quote_id", quoteId)
      .eq("approval_status", "approved");

    // Build public URL
    const appBaseUrl = Deno.env.get("APP_BASE_URL") || "https://nivra-telecom.ca";
    const publicUrl = `${appBaseUrl}/quote?token=${quote.public_token}`;

    // Format dates
    const validUntilFormatted = quote.valid_until
      ? new Date(quote.valid_until).toLocaleDateString("fr-CA", { year: "numeric", month: "long", day: "numeric" })
      : null;

    // Build services table rows
    const monthlyLines = (lines || []).filter((l: any) => l.billing_frequency === "monthly");
    const oneTimeLines = (lines || []).filter((l: any) => l.billing_frequency === "one_time");

    const buildServiceRows = (items: any[], freqLabel: string) => items.map((l: any) => `
      <tr>
        <td style="color: ${colors.textPrimary}; font-size: 14px; padding: 10px 0; border-bottom: 1px solid ${colors.borderLight};">
          ${escapeHtml(l.label)}${l.quantity > 1 ? ` <span style="color: ${colors.textMuted};">× ${l.quantity}</span>` : ""}
        </td>
        <td style="color: ${colors.textPrimary}; font-size: 14px; font-weight: 600; text-align: right; padding: 10px 0; border-bottom: 1px solid ${colors.borderLight};">
          ${formatCurrencySimple(l.unit_price * l.quantity)} ${freqLabel}
        </td>
      </tr>
    `).join("");

    // Build services section
    let servicesHtml = "";

    if (monthlyLines.length > 0) {
      servicesHtml += `
        <p style="color: ${colors.textMuted}; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; margin: 16px 0 8px 0;">Services mensuels récurrents</p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
          ${buildServiceRows(monthlyLines, "/mois")}
        </table>
      `;
    }

    if (oneTimeLines.length > 0) {
      servicesHtml += `
        <p style="color: ${colors.textMuted}; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; margin: 16px 0 8px 0;">Frais uniques</p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
          ${buildServiceRows(oneTimeLines, "")}
        </table>
      `;
    }

    // Adjustments
    let adjustmentsHtml = "";
    if (adjustments && adjustments.length > 0) {
      adjustmentsHtml = adjustments.map((a: any) => `
        <tr>
          <td style="color: ${colors.textMuted}; font-size: 14px; padding: 8px 0;">${escapeHtml(a.label)}</td>
          <td style="color: #DC2626; font-size: 14px; font-weight: 600; text-align: right; padding: 8px 0;">
            -${formatCurrencySimple(a.amount)}
          </td>
        </tr>
      `).join("");

      adjustmentsHtml = `
        ${divider()}
        <p style="color: ${colors.textMuted}; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; margin: 0 0 8px 0;">Ajustements</p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
          ${adjustmentsHtml}
        </table>
      `;
    }

    // Totals section
    const totalsHtml = `
      ${divider()}
      <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
        ${infoRow("Sous-total", formatCurrencySimple(Number(quote.subtotal || 0)))}
        ${Number(quote.discounts_total) > 0 ? `
          <tr>
            <td style="color: #DC2626; font-size: 14px; padding: 10px 0; border-bottom: 1px solid ${colors.borderLight};">Rabais</td>
            <td style="color: #DC2626; font-size: 14px; font-weight: 600; text-align: right; padding: 10px 0; border-bottom: 1px solid ${colors.borderLight};">
              -${formatCurrencySimple(Number(quote.discounts_total))}
            </td>
          </tr>
        ` : ""}
        ${infoRow("Taxes (TPS + TVQ)", formatCurrencySimple(Number(quote.taxes_total || 0)))}
      </table>
      ${amountBox("Total dû maintenant", formatCurrencySimple(Number(quote.total_due_now || 0)))}
      <div style="margin-top: 12px; padding: 12px 16px; background-color: ${colors.primaryLight}; border-radius: 6px; text-align: center;">
        <span style="color: ${colors.primary}; font-size: 14px; font-weight: 600;">
          Mensuel récurrent : ${formatCurrencySimple(Number(quote.total_monthly || 0))} /mois
        </span>
      </div>
    `;

    // Validity notice
    const validityHtml = validUntilFormatted
      ? `<p style="color: ${colors.textMuted}; font-size: 13px; margin: 16px 0 0 0; text-align: center;">
          ⏳ Cette soumission est valide jusqu'au <strong>${validUntilFormatted}</strong>
        </p>`
      : "";

    // Client note
    const noteHtml = quote.client_note
      ? `<div style="margin-top: 20px; padding: 16px; background-color: ${colors.bgSection}; border-radius: 6px; border-left: 3px solid ${colors.primary};">
          <p style="color: ${colors.textMuted}; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 6px 0;">Message</p>
          <p style="color: ${colors.textPrimary}; font-size: 14px; margin: 0; line-height: 1.5;">${escapeHtml(quote.client_note)}</p>
        </div>`
      : "";

    // Full email content
    const emailContent = `
      ${header()}
      ${statusBanner("info", "📋", "Votre soumission est prête", `Soumission ${escapeHtml(quote.quote_number)}`)}
      ${contentWrapper(`
        ${greeting(clientName)}
        ${bodyText("Nous avons préparé une soumission personnalisée pour vos services de télécommunications. Consultez les détails ci-dessous et accédez à votre soumission en ligne pour l'accepter.")}
        
        ${sectionHeader("Détail des services")}
        ${servicesHtml}
        ${adjustmentsHtml}
        ${totalsHtml}
        ${validityHtml}
        ${noteHtml}
        
        <div style="margin-top: 32px; text-align: center;">
          ${button("Voir ma soumission", publicUrl)}
          <p style="color: ${colors.textMuted}; font-size: 12px; margin: 12px 0 0 0;">
            Ou copiez ce lien : <a href="${publicUrl}" style="color: ${colors.primary}; word-break: break-all;">${publicUrl}</a>
          </p>
        </div>
      `)}
      ${footer("support@nivra-telecom.ca")}
    `;

    let finalSubject: string;
    let finalHtml: string;
    let finalText: string;
    let label: string;
    let eventType: string;

    if (mode === "checkout_link") {
      // Build checkout link email
      let checkoutToken = quote.checkout_token;
      if (!checkoutToken) {
        checkoutToken = crypto.randomUUID();
        await supabase.from("quotes").update({ checkout_token: checkoutToken }).eq("id", quoteId);
      }
      const checkoutUrl = `${appBaseUrl}/quote-checkout?token=${checkoutToken}`;

      finalSubject = `Finalisez votre commande — Soumission ${quote.quote_number || ""}`;
      const preheader = `Complétez votre soumission ${quote.quote_number} pour activer vos services.`;
      
      const checkoutContent = `
        ${header()}
        ${statusBanner("info", "✅", "Soumission acceptée", `Soumission ${escapeHtml(quote.quote_number)}`)}
        ${contentWrapper(`
          ${greeting(clientName)}
          ${bodyText("Votre soumission a été acceptée! Pour compléter votre commande, veuillez remplir le formulaire de finalisation ci-dessous.")}
          
          ${sectionHeader("Résumé")}
          ${amountBox("Total dû maintenant", formatCurrencySimple(Number(quote.total_due_now || 0)))}
          <div style="margin-top: 12px; padding: 12px 16px; background-color: ${colors.primaryLight}; border-radius: 6px; text-align: center;">
            <span style="color: ${colors.primary}; font-size: 14px; font-weight: 600;">
              Mensuel récurrent : ${formatCurrencySimple(Number(quote.total_monthly || 0))} /mois
            </span>
          </div>
          
          <div style="margin-top: 32px; text-align: center;">
            ${button("Compléter ma commande", checkoutUrl)}
            <p style="color: ${colors.textMuted}; font-size: 12px; margin: 12px 0 0 0;">
              Ou copiez ce lien : <a href="${checkoutUrl}" style="color: ${colors.primary}; word-break: break-all;">${checkoutUrl}</a>
            </p>
          </div>
        `)}
        ${footer("support@nivra-telecom.ca")}
      `;

      finalHtml = emailDocument(finalSubject, preheader, checkoutContent);
      finalText = htmlToPlainText(finalHtml) || `Finalisez votre commande — Soumission ${quote.quote_number || quote.id}`;
      label = "quote_checkout_link";
      eventType = "checkout_link_sent";
    } else {
      // Standard quote email
      finalSubject = `Soumission ${quote.quote_number} — Nivra Telecom`;
      const preheader = `Votre soumission ${quote.quote_number} est prête. Total : ${formatCurrencySimple(Number(quote.total_due_now || 0))}`;
      finalHtml = emailDocument(finalSubject, preheader, emailContent);
      finalText = htmlToPlainText(finalHtml) || `Soumission ${quote.quote_number} — Total ${formatCurrencySimple(Number(quote.total_due_now || 0))}`;
      label = "quote_sent";
      eventType = "email_sent";
    }

    // Generate unique message ID for deduplication
    const messageId = `${label}_${quoteId}_${Date.now()}`;

    // Enqueue via Lovable pgmq pipeline
    const { error: enqueueError } = await supabase.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: {
        to: recipientEmail,
        from: `Nivra Telecom <notify@notify.nivra-telecom.ca>`,
        sender_domain: "notify.nivra-telecom.ca",
        subject: finalSubject,
        html: finalHtml,
        text: finalText,
        purpose: "transactional",
        unsubscribe_token: unsubscribeToken,
        label,
        idempotency_key: messageId,
        message_id: messageId,
        queued_at: new Date().toISOString(),
      },
    });

    if (enqueueError) {
      console.error("[send-quote-email] Enqueue error:", enqueueError);
      throw new Error(`Erreur d'envoi: ${enqueueError.message}`);
    }

    // Log pending in email_send_log
    await supabase.from("email_send_log").insert({
      message_id: messageId,
      template_name: label,
      recipient_email: recipientEmail,
      status: "pending",
    });

    // Update quote timestamps
    await supabase
      .from("quotes")
      .update({ last_sent_at: new Date().toISOString() })
      .eq("id", quoteId);

    // Log event
    await supabase.from("quote_events").insert({
      quote_id: quoteId,
      event_type: eventType,
      actor_user_id: user.id,
      actor_role: "staff",
      message: `Courriel envoyé à ${recipientEmail}`,
      metadata: { recipient: recipientEmail, message_id: messageId },
    });

    console.log(`[send-quote-email] Enqueued ${label} for ${quote.quote_number} to ${recipientEmail}`);

    return new Response(JSON.stringify({ success: true, recipientEmail }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[send-quote-email] Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
