/**
 * process-notification-outbox — Drain queued notifications using
 * the unified Violet Bold email shell.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { enqueueEmail } from "../_shared/ResendProxy.ts";
import { violetShell, violetEsc } from "../_shared/violetEmailShell.ts";

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
          fromEmail: "Nivra Telecom <support@nivra-telecom.ca>",
          replyTo: "support@nivra-telecom.ca",
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
      } catch (sendErr) {
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
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[process-notification-outbox] Error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function buildEmailHtml(notif: {
  event_type: string;
  to_name?: string;
  payload_json: Record<string, unknown>;
  subject: string;
}): string {
  const payload = notif.payload_json || {};
  const name = (notif.to_name || (payload.client_name as string) || "") as string;
  const greeting = name ? `Bonjour ${name},` : undefined;
  const verificationUrl = String(payload.kyc_link || payload.verification_url || (payload.token ? `https://nivra-telecom.ca/verification/${payload.token}` : "https://nivra-telecom.ca/verification/"));

  const get = (k: string) => (payload[k] as string) || "—";

  switch (notif.event_type) {
    case "KYC_DOC_UPLOADED":
      return violetShell({
        preheader: "Un client a téléversé un document d'identité.",
        badge: "DOCUMENT REÇU",
        heroTitle: "Document KYC téléversé",
        bodyHtml: "Un client a téléversé un document pour sa vérification d'identité.",
        cardTitle: "Détails",
        cardRows: [
          ["Dossier", get("case_number")],
          ["Client", `${get("client_name")} (${get("client_email")})`],
          ["Type", get("doc_type")],
          ["Téléversé", get("uploaded_at")],
        ],
        ctaPrimaryUrl: "https://nivra-telecom.ca/admin/kyc-verifications",
        ctaPrimaryLabel: "Examiner le dossier",
      });

    case "KYC_DOC_REQUESTED":
      return violetShell({
        preheader: "Documents supplémentaires requis pour votre vérification.",
        badge: "ACTION REQUISE",
        heroTitle: "Documents requis",
        greeting,
        bodyHtml: `Notre équipe a besoin de documents supplémentaires pour compléter votre vérification d'identité.${payload.reason ? `<br><br><strong>Note :</strong> ${violetEsc(payload.reason)}` : ""}`,
        cardTitle: "Dossier",
        cardRows: [["Dossier", get("case_number")]],
        ctaPrimaryUrl: verificationUrl,
        ctaPrimaryLabel: "Téléverser mes documents",
        helpVariant: "warning",
      });

    case "KYC_APPROVED":
      return violetShell({
        preheader: "Votre vérification a été approuvée.",
        badge: "IDENTITÉ VÉRIFIÉE",
        heroTitle: "Votre identité a été vérifiée",
        greeting,
        bodyHtml: "Votre vérification d'identité a été approuvée. Votre commande est maintenant en cours de traitement.",
        cardTitle: "Détails",
        cardRows: [["Dossier", get("case_number")], ["Statut", "Approuvé"]],
      });

    case "KYC_REJECTED":
      return violetShell({
        preheader: "Votre vérification d'identité a été refusée.",
        badge: "ACTION REQUISE",
        heroTitle: "Document d'identité refusé",
        greeting,
        bodyHtml: `Votre vérification d'identité a été refusée.${payload.reason ? `<br><br><strong>Raison :</strong> ${violetEsc(payload.reason)}` : ""}`,
        cardTitle: "Détails",
        cardRows: [["Dossier", get("case_number")]],
        ctaPrimaryUrl: "mailto:support@nivra-telecom.ca",
        ctaPrimaryLabel: "Contacter le support",
        helpVariant: "warning",
      });

    case "KYC_SUBMITTED":
      return violetShell({
        preheader: "Nouvelle soumission KYC à examiner.",
        badge: "NOUVELLE SOUMISSION",
        heroTitle: "Nouvelle soumission KYC",
        bodyHtml: "Un client a soumis une vérification d'identité.",
        cardTitle: "Détails",
        cardRows: [
          ["Dossier", get("case_number")],
          ["Commande", get("order_number")],
          ["Client", `${get("client_name")} (${get("client_email")})`],
        ],
        ctaPrimaryUrl: "https://nivra-telecom.ca/admin/kyc-verifications",
        ctaPrimaryLabel: "Examiner le dossier",
      });

    default:
      return violetShell({
        preheader: notif.subject || "Notification Nivra Telecom",
        badge: "NOTIFICATION",
        heroTitle: notif.subject || "Notification Nivra",
        greeting,
        bodyHtml: notif.subject || "Vous avez une nouvelle notification.",
      });
  }
}
