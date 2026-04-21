// ============================================================================
// SEND CLIENT DOCUMENT — NIVRA TELECOM
// Reads a pending_document_jobs entry in 'generated' state, downloads the PDF
// from the 'client-documents' bucket, sends an email with attachment to the
// client, then marks the job as 'sent'. Idempotent.
// ============================================================================
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Resend } from "../_shared/ResendProxy.ts";

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

function buildEmailHtml(label: string, clientName: string, docNumber: string | null) {
  const refLine = docNumber
    ? `<p style="margin:0 0 12px 0;color:#0F766E;font-size:14px;"><strong>Référence :</strong> ${docNumber}</p>`
    : "";
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background-color:#f8fafc;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;padding:40px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
<tr><td style="background:linear-gradient(135deg,#0F172A 0%,#1E293B 100%);padding:32px 40px;text-align:center;">
<h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;">Nivra<span style="color:#14B8A6;">Telecom</span></h1>
</td></tr>
<tr><td style="padding:40px;">
<h2 style="margin:0 0 16px 0;color:#0F172A;font-size:22px;">${label}</h2>
<p style="margin:0 0 24px 0;color:#334155;font-size:16px;line-height:1.7;">Bonjour <strong>${clientName}</strong>,</p>
<p style="margin:0 0 24px 0;color:#334155;font-size:16px;line-height:1.7;">Veuillez trouver ci-joint le document suivant : <strong>${label}</strong>. Ce document est également disponible dans votre portail client à tout moment.</p>
<div style="background-color:#F0FDFA;border-left:4px solid #14B8A6;padding:16px 20px;border-radius:0 8px 8px 0;margin-bottom:24px;">
${refLine}
<p style="margin:0;color:#0F766E;font-size:14px;">Pour consulter tous vos documents : <a href="https://nivra-telecom.ca/portal/documents" style="color:#0F766E;text-decoration:underline;">portail client</a></p>
</div>
<p style="margin:24px 0 0 0;color:#334155;font-size:16px;">Cordialement,<br><strong>L'équipe Nivra Telecom</strong></p>
</td></tr>
<tr><td style="background-color:#F8FAFC;padding:24px 40px;border-top:1px solid #E2E8F0;text-align:center;">
<p style="margin:0;color:#64748B;font-size:13px;">Nivra Communications Inc. | Laval, Québec</p>
<p style="margin:4px 0 0 0;color:#64748B;font-size:13px;">support@nivra-telecom.ca</p>
</td></tr>
</table></td></tr></table></body></html>`;
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

    // 2. Resolve recipient email (job.recipient_email > client_id lookup)
    let recipient = job.recipient_email as string | null;
    let clientName = "Client";
    if (!recipient) {
      const { data: prof } = await admin
        .from("profiles")
        .select("email, first_name, last_name, full_name")
        .eq("id", job.client_id)
        .maybeSingle();
      recipient = prof?.email || null;
      clientName = prof?.full_name || [prof?.first_name, prof?.last_name].filter(Boolean).join(" ") || "Client";
    } else {
      const { data: prof } = await admin
        .from("profiles")
        .select("first_name, last_name, full_name")
        .eq("id", job.client_id)
        .maybeSingle();
      clientName = prof?.full_name || [prof?.first_name, prof?.last_name].filter(Boolean).join(" ") || "Client";
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
    const docNum = (job.event_payload as any)?.doc_number || null;
    const filename = job.storage_path.split("/").pop() || `${job.doc_type}.pdf`;

    // 4. Send email
    const emailResp = await resend.emails.send({
      from: FROM_ADDRESS,
      to: [recipient],
      reply_to: REPLY_TO,
      subject: `${label} – Nivra Telecom`,
      html: buildEmailHtml(label, clientName, docNum),
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
