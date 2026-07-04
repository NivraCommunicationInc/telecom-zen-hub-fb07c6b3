/**
 * persistOrderDocuments — Uploads the canonical V3 order PDFs (contract,
 * invoice, order summary) to the private `client-documents` storage bucket
 * and registers them in `client_auto_documents` so they appear in:
 *   - Core → Client Profile → Documents
 *   - Portal client → Mes documents
 *
 * The exact SAME `buildContractPdfAttachment` / `buildInvoicePdfAttachment` /
 * `buildSummaryPdfAttachment` are used for the email so the persisted PDF is
 * byte-identical to what the client received by email.
 *
 * Idempotent: uses `idempotency_key = order_<order_number>_<doc_type>` and
 * upserts by `(idempotency_key)`.
 */
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import {
  buildContractPdfAttachment,
  buildInvoicePdfAttachment,
  buildSummaryPdfAttachment,
  type QueuedAttachment,
} from "./pdfFromDb.ts";

const BUCKET = "client-documents";

function serviceClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function uploadOne(
  supabase: SupabaseClient,
  args: {
    accountId: string | null;
    clientId: string | null;
    orderId: string;
    orderNumber: string | number;
    docType: string;
    attachment: QueuedAttachment;
    recipientEmail: string | null;
  },
): Promise<{ ok: boolean; storage_path?: string; error?: string }> {
  const { accountId, clientId, orderId, orderNumber, docType, attachment, recipientEmail } = args;
  const scopeId = accountId || clientId || "unknown";
  const safeType = docType.replace(/[^a-z0-9_-]/gi, "_");
  const storage_path = `${scopeId}/orders/${orderNumber}/${safeType}.pdf`;
  const idempotency_key = `order_${orderNumber}_${safeType}`;

  const bytes = base64ToBytes(attachment.content);
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(storage_path, bytes, {
    contentType: "application/pdf",
    upsert: true,
  });
  if (upErr) {
    console.error("[persistOrderDocuments] upload failed:", storage_path, upErr.message);
    return { ok: false, error: upErr.message };
  }

  const row = {
    account_id: accountId,
    client_id: clientId,
    doc_type: docType,
    doc_number: String(orderNumber),
    event_type: "order_confirmation",
    idempotency_key,
    storage_path,
    file_size_bytes: bytes.byteLength,
    email_sent: true,
    email_sent_at: new Date().toISOString(),
    recipient_email: recipientEmail,
    metadata: { order_id: orderId, filename: attachment.filename, hash_sha256: attachment.hash_sha256 ?? null },
  };
  const { error: dbErr } = await supabase
    .from("client_auto_documents")
    .upsert(row, { onConflict: "idempotency_key" });
  if (dbErr) {
    console.error("[persistOrderDocuments] insert failed:", idempotency_key, dbErr.message);
    return { ok: false, error: dbErr.message, storage_path };
  }
  return { ok: true, storage_path };
}

/**
 * Fetches / regenerates + persists the 3 order documents.
 * Returns the attachments so the caller can also send them by email (avoids
 * a double regeneration).
 */
export async function persistOrderDocuments(orderId: string): Promise<{
  attachments: QueuedAttachment[];
  results: Array<{ doc_type: string; ok: boolean; storage_path?: string; error?: string }>;
}> {
  const supabase = serviceClient();

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select("id, order_number, account_id, user_id, client_email")
    .eq("id", orderId)
    .maybeSingle();
  if (orderErr || !order) {
    console.warn("[persistOrderDocuments] order not found:", orderId, orderErr?.message);
    return { attachments: [], results: [] };
  }

  const { data: invoice } = await supabase
    .from("billing_invoices")
    .select("id")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const [contract, invoicePdf, summary] = await Promise.all([
    buildContractPdfAttachment(orderId, { filenamePrefix: "contrat" }),
    invoice?.id ? buildInvoicePdfAttachment(invoice.id, "facture") : Promise.resolve(null),
    buildSummaryPdfAttachment(orderId, "sommaire_commande"),
  ]);

  const jobs: Array<{ doc_type: string; att: QueuedAttachment | null }> = [
    { doc_type: "order_contract", att: contract },
    { doc_type: "order_invoice",  att: invoicePdf },
    { doc_type: "order_summary",  att: summary },
  ];

  const results: Array<{ doc_type: string; ok: boolean; storage_path?: string; error?: string }> = [];
  const attachments: QueuedAttachment[] = [];

  for (const job of jobs) {
    if (!job.att) {
      results.push({ doc_type: job.doc_type, ok: false, error: "generation_failed_or_missing_source" });
      continue;
    }
    attachments.push(job.att);
    const r = await uploadOne(supabase, {
      accountId: (order as any).account_id ?? null,
      clientId: (order as any).user_id ?? null,
      orderId,
      orderNumber: (order as any).order_number,
      docType: job.doc_type,
      attachment: job.att,
      recipientEmail: (order as any).client_email ?? null,
    });
    results.push({ doc_type: job.doc_type, ...r });
  }

  return { attachments, results };
}
