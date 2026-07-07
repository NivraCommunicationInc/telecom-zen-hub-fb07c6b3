// ============================================================================
// SEND CLIENT DOCUMENT â€" NIVRA TELECOM
// Uses the official "Corporate Blue" email template (components.ts) for ALL
// document delivery emails. NEVER use a custom navy/teal template here.
// ============================================================================
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendResendEmail } from "../_shared/resendGateway.ts";


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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
  formal_demand: "Avis final de régularisation",
  collections_transfer: "Transfert au recouvrement",
  complaint_acknowledgment: "Accusé de réception de plainte",
  preauthorization_confirmation: "Confirmation de préautorisation",
};



function escapeHtml(s: string): string {
  return s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

import { violetShell } from "../_shared/violetEmailShell.ts";

function buildEmailHtml(opts: {
  label: string;
  clientName: string;
  docNumber: string | null;
  docType: string;
}): string {
  const { label, clientName, docNumber } = opts;
  const dateStr = new Date().toLocaleDateString("fr-CA", { year: "numeric", month: "long", day: "numeric" });
  const cardRows: [string, string][] = [];
  if (docNumber) cardRows.push(["Numéro de document", docNumber]);
  cardRows.push(["Type de document", label]);
  cardRows.push(["Date d'émission", dateStr]);
  return violetShell({
    preheader: `${label} — Nivra Telecom`,
    badge: "DOCUMENT OFFICIEL",
    heroTitle: label,
    heroSub: "Document Nivra Telecom",
    greeting: `Bonjour ${clientName},`,
    bodyHtml: `Veuillez trouver ci-joint votre document : <strong>${escapeHtml(label)}</strong>.<br>Ce document est également disponible en tout temps dans votre portail client.`,
    cardTitle: "Détails du document",
    cardRows,
    ctaPrimaryUrl: "https://nivra-telecom.ca/portal/documents",
    ctaPrimaryLabel: "Accéder au portail client",
    helpHtml: `Des questions ? Contactez-nous à <a href="mailto:${SUPPORT_EMAIL}" style="color:#0066CC;">${SUPPORT_EMAIL}</a>.`,
  });
}

Deno.serve(async (req: Request) => {
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
    const resendApiKey = Deno.env.get("RESEND_API_KEY") || "";
    const emailRespRaw = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendApiKey}` },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [recipient],
        reply_to: REPLY_TO,
        subject: `${label} – Nivra Telecom`,
        html: buildEmailHtml({ label, clientName, docNumber: docNum, docType: job.doc_type }),
        attachments: [{ filename, content: pdfBase64 }],
      }),
    });
    const emailResp = emailRespRaw.ok ? await emailRespRaw.json() : {};

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
          email_message_id: emailResp?.id || null,
          recipient_email: recipient,
        })
        .eq("id", job.client_auto_document_id);
    }

    console.log(`[send-client-document] sent job=${job_id} to=${recipient} doc=${job.doc_type}`);

    return new Response(
      JSON.stringify({ success: true, emailId: emailResp?.id, recipient }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[send-client-document] error:", err);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
