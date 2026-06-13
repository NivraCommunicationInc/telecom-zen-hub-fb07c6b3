// ============================================================================
// PROCESS DOCUMENT JOBS â€” NIVRA TELECOM (Server-side autonomous worker)
// ============================================================================
// Strategy D (validated 2026-04-21): 100% server-side automation.
// Triggered every 60s by pg_cron. Claims pending jobs, generates PDFs with
// jsPDF (npm:jspdf) running in Deno, uploads to private storage, and triggers
// send-client-document. NO browser/staff dependency.
// ============================================================================
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { dispatchAutoDocument, type AutoDocType } from "../_shared/pdf/dispatcher.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STORAGE_BUCKET = "client-documents";
const MAX_JOBS_PER_RUN = 5; // process up to 5 jobs per cron tick
const WORKER_ID: string | null = null; // RPC expects UUID or null; cron has no UUID identity

interface JobRow {
  id: string;
  client_id: string;
  doc_type: string;
  idempotency_key: string;
  event_payload: Record<string, any> | null;
  status: string;
}

async function processOne(admin: any, job: JobRow): Promise<{ ok: boolean; error?: string }> {
  try {
    // 1. Generate PDF server-side
    const dispatched = await dispatchAutoDocument(
      job.doc_type as AutoDocType,
      job.event_payload || {},
    );

    // 2. Upload to private bucket
    const safeIdem = String(job.idempotency_key).replace(/[^a-zA-Z0-9_-]/g, "_");
    const storagePath = `${job.client_id}/${job.doc_type}/${safeIdem}.pdf`;
    const { error: uploadErr } = await admin.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, dispatched.bytes, {
        contentType: "application/pdf",
        upsert: true,
      });
    if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message}`);

    // 3. Mark job as generated (creates client_auto_documents row via RPC)
    const { error: markErr } = await admin.rpc("mark_document_job_generated", {
      p_job_id: job.id,
      p_storage_path: storagePath,
      p_file_size_bytes: dispatched.fileSizeBytes,
      p_doc_number: dispatched.docNumber || null,
    });
    if (markErr) throw new Error(`mark_generated failed: ${markErr.message}`);

    // 4. Trigger email dispatch (fire-and-forget â€” has its own retry)
    admin.functions.invoke("send-client-document", { body: { job_id: job.id } })
      .catch((e: any) => console.warn(`[process-document-jobs] send invoke failed for ${job.id}:`, e?.message));

    return { ok: true };
  } catch (err) {
    const errMsg = String(err?.message || err).slice(0, 500);
    console.error(`[process-document-jobs] job ${job.id} (${job.doc_type}) failed:`, errMsg);
    await admin.rpc("mark_document_job_failed", { p_job_id: job.id, p_error: errMsg })
      .then(() => {})
      .catch((e: any) => console.error("mark_failed RPC failed:", e?.message));
    return { ok: false, error: errMsg };
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startedAt = Date.now();
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  const results: Array<{ id: string; doc_type: string; ok: boolean; error?: string }> = [];

  try {
    // Drain up to MAX_JOBS_PER_RUN jobs sequentially
    for (let i = 0; i < MAX_JOBS_PER_RUN; i++) {
      const { data: claimed, error: claimErr } = await admin.rpc(
        "claim_pending_document_job",
        { p_worker_id: WORKER_ID },
      );
      if (claimErr) {
        console.error("[process-document-jobs] claim error:", claimErr.message);
        break;
      }
      const job: JobRow | null = Array.isArray(claimed) ? (claimed[0] || null) : claimed;
      if (!job?.id) break; // queue empty

      processed++;
      const r = await processOne(admin, job);
      if (r.ok) succeeded++; else failed++;
      results.push({ id: job.id, doc_type: job.doc_type, ok: r.ok, error: r.error });
    }

    const durationMs = Date.now() - startedAt;
    console.log(
      `[process-document-jobs] done in ${durationMs}ms â€” processed=${processed} ok=${succeeded} failed=${failed}`,
    );

    return new Response(
      JSON.stringify({ success: true, processed, succeeded, failed, durationMs, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[process-document-jobs] fatal:", err);
    return new Response(
      JSON.stringify({ success: false, error: err?.message || String(err), processed, succeeded, failed }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
