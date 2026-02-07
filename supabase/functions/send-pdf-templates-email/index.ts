/**
 * Edge Function: Send PDF Templates by Email
 * - Mode 1 (legacy): envoie la documentation HTML des templates V2.4
 * - Mode 2 (nouveau): envoie un pack de PDFs en pièces jointes (base64) — réservé admin/staff
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { withSafeErrorHandling } from "../_shared/errorUtils.ts";

type Attachment = { filename: string; content: string; contentType: string };

const TEMPLATES_OVERVIEW = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; background: #f8fafc; }
    .header { background: #0F172A; color: white; padding: 25px; border-radius: 8px 8px 0 0; }
    .header h1 { margin: 0; font-size: 24px; }
    .header p { margin: 5px 0 0 0; color: #94a3b8; }
    .content { background: white; padding: 25px; border: 1px solid #e2e8f0; }
    .template-card { border: 1px solid #e2e8f0; border-radius: 8px; margin: 15px 0; overflow: hidden; }
    .template-header { background: #14B8A6; color: white; padding: 12px 15px; font-weight: bold; }
    .template-body { padding: 15px; }
    .template-body h4 { margin: 0 0 8px 0; color: #0F172A; }
    .template-body p { margin: 0 0 10px 0; color: #64748B; font-size: 14px; }
    .template-body ul { margin: 5px 0; padding-left: 20px; color: #334155; font-size: 13px; }
    .template-body li { margin: 3px 0; }
    .file-path { background: #f1f5f9; padding: 8px 12px; border-radius: 4px; font-family: monospace; font-size: 12px; color: #475569; margin-top: 10px; }
    .footer { background: #0F172A; color: #94a3b8; padding: 15px 25px; font-size: 12px; text-align: center; border-radius: 0 0 8px 8px; }
    .badge { display: inline-block; background: #14B8A6; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; margin-left: 8px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>📄 Templates PDF V2.4 — Nivra Telecom</h1>
    <p>Documentation des templates de facturation et contrats</p>
  </div>
  <div class="content">
    <p>Voici la liste complète des <strong>5 templates PDF V2.4</strong> utilisés dans le système de facturation Nivra :</p>
    <div class="template-card">
      <div class="template-header">📋 1. MODALITÉS DE SERVICE</div>
      <div class="template-body">
        <h4>Document ID: ND-TOS-2026-02-05</h4>
        <p>Document légal multi-pages (8+ pages) contenant les termes et conditions complets du service.</p>
        <p><strong>Interface:</strong> <code>TermsModalitesData</code></p>
        <div class="file-path">📁 src/lib/pdfEngine/termsModalitesPdfGenerator.ts</div>
      </div>
    </div>
    <div class="template-card">
      <div class="template-header">🛒 2. RÉSUMÉ DE COMMANDE</div>
      <div class="template-body">
        <p><strong>Interface:</strong> <code>OrderSummaryData</code></p>
        <div class="file-path">📁 src/lib/pdf/orderSummaryTemplate.ts</div>
      </div>
    </div>
    <div class="template-card">
      <div class="template-header">📝 3. CONTRAT DE SERVICE</div>
      <div class="template-body">
        <p><strong>Interface:</strong> <code>ContractData</code></p>
        <div class="file-path">📁 src/lib/pdf/contractTemplate.ts</div>
      </div>
    </div>
    <div class="template-card">
      <div class="template-header">💳 4. FACTURE UNIQUE (V2.4)</div>
      <div class="template-body">
        <p><strong>Interface:</strong> <code>InvoiceDataV2</code></p>
        <div class="file-path">📁 src/lib/pdf/invoiceOneTimeTemplateV2.ts</div>
      </div>
    </div>
    <div class="template-card">
      <div class="template-header">📅 5. FACTURE MENSUELLE (V2.4)</div>
      <div class="template-body">
        <p><strong>Interface:</strong> <code>InvoiceDataV2</code></p>
        <div class="file-path">📁 src/lib/pdf/invoiceMonthlyTemplateV2.ts</div>
      </div>
    </div>
  </div>
  <div class="footer">
    <p>© 2026 Nivra Communications Inc. — Templates PDF V2.4</p>
  </div>
</body>
</html>
`;

const buildBlankPackHtml = (filenames: string[]) => {
  const list = filenames.map((f) => `<li style="margin: 6px 0;">${f}</li>`).join("");
  return `
  <!doctype html>
  <html lang="fr">
    <body style="font-family: Arial, sans-serif; background: #f8fafc; padding: 24px; color: #0f172a;">
      <div style="max-width: 640px; margin: 0 auto; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
        <div style="background:#0F172A; color:#fff; padding: 18px 20px;">
          <div style="font-size: 18px; font-weight: 700;">Templates PDF V2.4 — Pack vierge</div>
          <div style="font-size: 12px; color:#94a3b8; margin-top: 4px;">Pièces jointes (PDF) — aucune donnée client réelle</div>
        </div>
        <div style="padding: 18px 20px;">
          <p style="margin: 0 0 12px; color:#334155;">
            Voici les PDFs de gabarit (vierges) en pièces jointes :
          </p>
          <ul style="margin: 0; padding-left: 18px; color:#0f172a;">${list}</ul>
          <p style="margin: 16px 0 0; font-size: 12px; color:#64748b;">
            Note: Les champs requis contiennent uniquement des placeholders (ex: "GABARIT") et des montants à 0.
          </p>
        </div>
      </div>
    </body>
  </html>
  `;
};

serve(async (req: Request): Promise<Response> => {
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;

  const corsHeaders = getCorsHeaders(req.headers.get("origin"));
  const fail = withSafeErrorHandling("send-pdf-templates-email", corsHeaders);

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const body = await req.json();
    const email: string | undefined = body?.email;
    const attachments: Attachment[] | undefined = body?.attachments;

    if (!email) {
      return fail("Email address is required", 400);
    }

    const hasAttachments = Array.isArray(attachments) && attachments.length > 0;

    // Security: only allow attachments mode for authenticated admin/staff
    if (hasAttachments) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return fail("Unauthorized", 401);
      }

      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

      const db = createClient(supabaseUrl, serviceKey);
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });

      const { data: { user }, error: userError } = await userClient.auth.getUser();
      if (userError || !user) {
        return fail("Invalid token", 401);
      }

      const { data: adminUser } = await db
        .from("admin_users")
        .select("id, is_active")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();

      const { data: employee } = await db
        .from("employees")
        .select("id, is_active")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();

      if (!adminUser && !employee) {
        return fail("Access denied", 403);
      }
    }

    const resend = new Resend(RESEND_API_KEY);

    const subject = hasAttachments
      ? "📎 Templates PDF V2.4 — Pack vierge (5 PDFs)"
      : "📄 Templates PDF V2.4 — Documentation";

    const filenames = hasAttachments ? (attachments || []).map((a) => a.filename) : [];

    const html = hasAttachments ? buildBlankPackHtml(filenames) : TEMPLATES_OVERVIEW;

    console.log("[send-pdf-templates-email] sending", {
      to: email,
      hasAttachments,
      attachmentCount: hasAttachments ? attachments!.length : 0,
      filenames,
    });

    const emailResult = await resend.emails.send({
      from: "Nivra Télécom <Support@nivra-telecom.ca>",
      to: [email],
      subject,
      replyTo: "support@nivra-telecom.ca",
      html,
      attachments: hasAttachments ? attachments : undefined,
    });

    console.log("[send-pdf-templates-email] Email sent:", emailResult);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Email envoyé à ${email}`,
        emailId: emailResult.id,
        attachmentCount: hasAttachments ? attachments!.length : 0,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error) {
    return fail(error);
  }
});
