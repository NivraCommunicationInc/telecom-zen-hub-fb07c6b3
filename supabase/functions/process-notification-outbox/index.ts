/**
 * Edge Function: process-notification-outbox
 * Processes queued notifications and sends emails via Resend.
 * Called by pg_cron or manually.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { enqueueEmail } from "../_shared/ResendProxy.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Fetch queued notifications (batch of 50)
    const { data: notifications, error: fetchErr } = await supabase
      .from("notification_outbox")
      .select("*")
      .eq("status", "queued")
      .order("created_at", { ascending: true })
      .limit(50);

    if (fetchErr) throw new Error(`Fetch error: ${fetchErr.message}`);
    if (!notifications?.length) {
      return new Response(JSON.stringify({ message: "No queued notifications" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: Array<{ id: string; status: string; error?: string }> = [];

    for (const notif of notifications) {
      try {
        const htmlContent = buildEmailHtml(notif);

        const eqResult = await enqueueEmail({
          to: notif.to_email,
          templateKey: "custom_html",
          subject: notif.subject,
          html: htmlContent,
          fromEmail: "Nivra Télécom <Support@nivra-telecom.ca>",
          replyTo: "Support@nivra-telecom.ca",
          messageType: notif.event_type || "notification",
          entityType: "notification_outbox",
          entityId: notif.id,
          eventKey: `outbox_${notif.id}`,
        });

        if (!eqResult.success) {
          throw new Error(eqResult.error || "Failed to queue email");
        }

        await supabase
          .from("notification_outbox")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .eq("id", notif.id);

        results.push({ id: notif.id, status: "sent" });
      } catch (sendErr: unknown) {
        const msg = sendErr instanceof Error ? sendErr.message : "Unknown error";
        const newRetry = (notif.retry_count || 0) + 1;
        await supabase
          .from("notification_outbox")
          .update({
            status: newRetry >= 5 ? "failed" : "queued",
            error_message: msg,
            retry_count: newRetry,
          })
          .eq("id", notif.id);
        results.push({ id: notif.id, status: "failed", error: msg });
      }
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[process-notification-outbox] Error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

/** Build HTML email from notification outbox entry */
function buildEmailHtml(notif: {
  event_type: string;
  to_name?: string;
  payload_json: Record<string, unknown>;
  subject: string;
}): string {
  const payload = notif.payload_json || {};
  const name = (notif.to_name || payload.client_name || "") as string;

  const templates: Record<string, () => string> = {
    KYC_DOC_UPLOADED: () => `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <div style="background:#2563eb;color:white;padding:16px 24px;border-radius:8px 8px 0 0">
          <h2 style="margin:0">Document KYC téléversé</h2>
        </div>
        <div style="background:#fff;padding:24px;border:1px solid #e5e7eb;border-radius:0 0 8px 8px">
          <p>Un client a téléversé un document pour sa vérification d'identité.</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0">
            <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280">Dossier</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:bold">${payload.case_number || "—"}</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280">Client</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">${payload.client_name || "—"} (${payload.client_email || ""})</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280">Type de document</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">${payload.doc_type || "—"}</td></tr>
            <tr><td style="padding:8px;color:#6b7280">Téléversé à</td><td style="padding:8px">${payload.uploaded_at || "—"}</td></tr>
          </table>
          <p style="text-align:center;margin:24px 0">
            <a href="https://nivra-telecom.ca/admin/kyc-verifications" style="background:#2563eb;color:white;padding:12px 32px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block">Examiner le dossier</a>
          </p>
        </div>
      </div>`,

    KYC_DOC_REQUESTED: () => `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <div style="background:#f97316;color:white;padding:16px 24px;border-radius:8px 8px 0 0">
          <h2 style="margin:0">Documents requis</h2>
        </div>
        <div style="background:#fff;padding:24px;border:1px solid #e5e7eb;border-radius:0 0 8px 8px">
          <p>Bonjour ${name},</p>
          <p>Notre équipe a besoin de documents supplémentaires pour compléter votre vérification d'identité.</p>
          <p><strong>Dossier :</strong> ${payload.case_number || "—"}</p>
          ${payload.reason ? `<p><strong>Note :</strong> ${payload.reason}</p>` : ""}
          <p style="text-align:center;margin:24px 0">
            <a href="https://nivra-telecom.ca/portal/identity-verification" style="background:#f97316;color:white;padding:12px 32px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block">Téléverser mes documents</a>
          </p>
          <p style="color:#6b7280;font-size:12px">Si vous avez des questions, contactez notre support.</p>
        </div>
      </div>`,

    KYC_APPROVED: () => `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <div style="background:#059669;color:white;padding:16px 24px;border-radius:8px 8px 0 0">
          <h2 style="margin:0">Vérification approuvée</h2>
        </div>
        <div style="background:#fff;padding:24px;border:1px solid #e5e7eb;border-radius:0 0 8px 8px">
          <p>Bonjour ${name},</p>
          <p>Votre vérification d'identité a été approuvée. Votre commande est maintenant en cours de traitement.</p>
          <p style="color:#6b7280;font-size:12px">Dossier : ${payload.case_number || "—"}</p>
        </div>
      </div>`,

    KYC_REJECTED: () => `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <div style="background:#dc2626;color:white;padding:16px 24px;border-radius:8px 8px 0 0">
          <h2 style="margin:0">Vérification refusée</h2>
        </div>
        <div style="background:#fff;padding:24px;border:1px solid #e5e7eb;border-radius:0 0 8px 8px">
          <p>Bonjour ${name},</p>
          <p>Votre vérification d'identité a été refusée.</p>
          ${payload.reason ? `<p><strong>Raison :</strong> ${payload.reason}</p>` : ""}
          <p>Si vous pensez qu'il s'agit d'une erreur, veuillez contacter notre support.</p>
          <p style="color:#6b7280;font-size:12px">Dossier : ${payload.case_number || "—"}</p>
        </div>
      </div>`,

    KYC_SUBMITTED: () => `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <div style="background:#2563eb;color:white;padding:16px 24px;border-radius:8px 8px 0 0">
          <h2 style="margin:0">Nouvelle soumission KYC</h2>
        </div>
        <div style="background:#fff;padding:24px;border:1px solid #e5e7eb;border-radius:0 0 8px 8px">
          <p>Un client a soumis une vérification d'identité.</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0">
            <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280">Dossier</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:bold">${payload.case_number || "—"}</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280">Commande</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">${payload.order_number || "—"}</td></tr>
            <tr><td style="padding:8px;color:#6b7280">Client</td><td style="padding:8px">${payload.client_name || "—"} (${payload.client_email || ""})</td></tr>
          </table>
          <p style="text-align:center;margin:24px 0">
            <a href="https://nivra-telecom.ca/admin/kyc-verifications" style="background:#2563eb;color:white;padding:12px 32px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block">Examiner le dossier</a>
          </p>
        </div>
      </div>`,
  };

  // Default fallback
  const builder = templates[notif.event_type];
  if (builder) return builder();

  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
      <div style="background:#374151;color:white;padding:16px 24px;border-radius:8px 8px 0 0">
        <h2 style="margin:0">Notification Nivra</h2>
      </div>
      <div style="background:#fff;padding:24px;border:1px solid #e5e7eb;border-radius:0 0 8px 8px">
        <p>${name ? `Bonjour ${name},` : ""}</p>
        <p>${notif.subject}</p>
        <pre style="background:#f3f4f6;padding:12px;border-radius:4px;font-size:12px;overflow:auto">${JSON.stringify(payload, null, 2)}</pre>
      </div>
    </div>`;
}
