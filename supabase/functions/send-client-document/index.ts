// ============================================================================
// SEND CLIENT DOCUMENT — NIVRA TELECOM
// Uses the official "Corporate Blue" email template (components.ts) for ALL
// document delivery emails. NEVER use a custom navy/teal template here.
// ============================================================================
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Resend } from "../_shared/ResendProxy.ts";
import {
  emailDocument, header, statusBanner, contentWrapper, footer,
  sectionHeader, helpSection, infoRow, button,
  colors, escapeHtml,
} from "../_shared/emailTemplates/components.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const STORAGE_BUCKET = "client-documents";
const FROM_ADDRESS = "Nivra Telecom <noreply@nivra-telecom.ca>";
const REPLY_TO = "support@nivra-telecom.ca";
const SUPPORT_EMAIL = "support@nivra-telecom.ca";

interface RequestBody {
  job_id: string;
}

const DOC_LABELS: Record<string, string> = {
  welcome_letter: "Lettre de bienvenue",
  address_change: "Changement d'adresse",
  payment_method_change: "Changement de mode de paiement",
  service_certificate: "Attestation de service",
  suspension_notice: "Avis de suspension de service",
  cancellation_confirmation: "Confirmation d'annulation",
  chargeback_notice: "Avis de chargeback",
  final_refund_receipt: "Reçu de remboursement final",
  delivery_slip: "Bon de livraison",
  return_instructions: "Instructions de retour d'équipement",
  installation_report: "Rapport d'installation",
  activation_confirmation: "Confirmation d'activation de service",
  contract_amendment: "Avenant au contrat de service",
  formal_demand: "Mise en demeure",
  collections_transfer: "Transfert au recouvrement",
  complaint_acknowledgment: "Accusé de réception de plainte",
  preauthorization_confirmation: "Confirmation de préautorisation",
};

// Per-doc-type banner config (icon + color tone)
const DOC_BANNER: Record<string, { icon: string; type: "success" | "info" | "warning" | "error" }> = {
  welcome_letter: { icon: "👋", type: "info" },
  service_certificate: { icon: "📄", type: "info" },
  activation_confirmation: { icon: "✅", type: "success" },
  cancellation_confirmation: { icon: "✅", type: "success" },
  preauthorization_confirmation: { icon: "🔒", type: "info" },
  installation_report: { icon: "🛠️", type: "info" },
  delivery_slip: { icon: "📦", type: "info" },
  return_instructions: { icon: "📦", type: "warning" },
  address_change: { icon: "📍", type: "info" },
  payment_method_change: { icon: "💳", type: "info" },
  contract_amendment: { icon: "📝", type: "info" },
  complaint_acknowledgment: { icon: "📨", type: "info" },
  final_refund_receipt: { icon: "💰", type: "success" },
  suspension_notice: { icon: "⚠️", type: "warning" },
  chargeback_notice: { icon: "⚠️", type: "warning" },
  formal_demand: { icon: "⚠️", type: "error" },
  collections_transfer: { icon: "⚠️", type: "error" },
};

function buildEmailHtml(opts: {
  label: string;
  clientName: string;
  docNumber: string | null;
  docType: string;
}): string {
  const { label, clientName, docNumber, docType } = opts;
  const banner = DOC_BANNER[docType] || { icon: "📄", type: "info" as const };

  const detailsRows = [
    docNumber ? infoRow("Numéro de document", docNumber) : "",
    infoRow("Type de document", label),
    infoRow("Date d'émission", new Date().toLocaleDateString("fr-CA", { year: "numeric", month: "long", day: "numeric" })),
  ].join("");

  const content = `
    ${header()}
    ${statusBanner(banner.type, banner.icon, label, "Document officiel Nivra Telecom")}
    ${contentWrapper(`
      <p style="color:${colors.textPrimary};font-size:16px;line-height:1.6;margin:0 0 16px 0;">
        Bonjour <strong>${escapeHtml(clientName)}</strong>,
      </p>
      <p style="color:${colors.textSecondary};font-size:15px;line-height:1.6;margin:0 0 24px 0;">
        Veuillez trouver ci-joint votre document : <strong>${escapeHtml(label)}</strong>.
        Ce document est également disponible en tout temps dans votre portail client.
      </p>

      ${sectionHeader("Détails du document")}
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:24px;">
        ${detailsRows}
      </table>

      <div style="text-align:center;margin:32px 0;">
        ${button("Accéder au portail client", "https://nivra-telecom.ca/portal/documents", "primary")}
      </div>

      <p style="color:${colors.textSecondary};font-size:14px;line-height:1.6;margin:24px 0 0 0;">
        Si vous avez des questions concernant ce document, notre équipe est disponible par courriel.
      </p>

      ${helpSection(SUPPORT_EMAIL)}
    `)}
    ${footer(SUPPORT_EMAIL)}
  `;

  return emailDocument(label, `${label} – Nivra Telecom`, content);
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { job_id }: RequestBody = await req.json();
    if (!job_id) throw new Error("job_id is required");

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // 1. Load job
    const { data: job, error: jobErr } = await admin
      .from("pending_document_jobs")
      .select("*")
      .eq("id", job_id)
      .maybeSingle();
    if (jobErr) throw jobErr;
    if (!job) throw new Error(`Job ${job_id} not found`);
    if (job.status === "sent") {
      return new Response(JSON.stringify({ success: true, alreadySent: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (job.status !== "generated") {
      throw new Error(`Job ${job_id} is in status '${job.status}', expected 'generated'`);
    }
    if (!job.storage_path) throw new Error("Job has no storage_path");

    // 2. Resolve recipient email + client name
    let recipient = job.recipient_email as string | null;
    let clientName = "Client";
    {
      const { data: prof } = await admin
        .from("profiles")
        .select("email, first_name, last_name, full_name")
        .eq("id", job.client_id)
        .maybeSingle();
      if (!recipient) recipient = prof?.email || null;
      clientName = prof?.full_name
        || [prof?.first_name, prof?.last_name].filter(Boolean).join(" ")
        || (job.event_payload as any)?.full_name
        || (job.event_payload as any)?.first_name
        || "Client";
    }
    if (!recipient) throw new Error(`No recipient email for client ${job.client_id}`);

    // 3. Download PDF from storage
    const { data: fileBlob, error: dlErr } = await admin.storage
      .from(STORAGE_BUCKET)
      .download(job.storage_path);
    if (dlErr || !fileBlob) throw new Error(`Storage download failed: ${dlErr?.message || "no data"}`);

    const arrayBuf = await fileBlob.arrayBuffer();
    const pdfBase64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuf)));

    const label = DOC_LABELS[job.doc_type] || "Document Nivra Telecom";
    const docNum = (job.event_payload as any)?.doc_number
      || (job.event_payload as any)?.amendment_number
      || (job.event_payload as any)?.confirmation_number
      || (job.event_payload as any)?.certificate_number
      || (job.event_payload as any)?.letter_number
      || (job.event_payload as any)?.notice_number
      || null;
    const filename = job.storage_path.split("/").pop() || `${job.doc_type}.pdf`;

    // 4. Send email using the OFFICIAL corporate blue template
    const emailResp = await resend.emails.send({
      from: FROM_ADDRESS,
      to: [recipient],
      reply_to: REPLY_TO,
      subject: `${label} – Nivra Telecom`,
      html: buildEmailHtml({ label, clientName, docNumber: docNum, docType: job.doc_type }),
      attachments: [{ filename, content: pdfBase64 }],
    });

    // 5. Mark job + client_auto_documents as sent
    await admin
      .from("pending_document_jobs")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", job_id);

    if (job.client_auto_document_id) {
      await admin
        .from("client_auto_documents")
        .update({
          email_sent: true,
          email_sent_at: new Date().toISOString(),
          email_message_id: (emailResp as any)?.id || null,
          recipient_email: recipient,
        })
        .eq("id", job.client_auto_document_id);
    }

    console.log(`[send-client-document] sent job=${job_id} to=${recipient} doc=${job.doc_type}`);

    return new Response(
      JSON.stringify({ success: true, emailId: (emailResp as any)?.id, recipient }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("[send-client-document] error:", err);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
