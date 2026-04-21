/**
 * useDocumentJobWorker
 * ====================
 * Background worker hook that runs in any STAFF-authenticated portal
 * (Nivra Core / Employee). It claims pending document jobs from the
 * `pending_document_jobs` queue, generates PDFs in the browser using
 * the existing jsPDF templates, uploads them to Supabase Storage, then
 * triggers the `send-client-document` edge function to email + log them.
 *
 * Strategy C (validated 2026-04-21): browser-only worker. No external
 * service. Jobs simply wait if no staff is connected.
 *
 * Mount this ONCE in the staff app shell (e.g., CoreLayout, EmployeeLayout).
 */
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { dispatchAutoDocument, type AutoDocType } from "@/lib/pdf/autoDocumentDispatcher";

const POLL_INTERVAL_MS = 30_000; // 30s baseline poll
const STORAGE_BUCKET = "client-documents";

export interface DocumentJobWorkerOptions {
  enabled?: boolean;
  onJobProcessed?: (jobId: string, success: boolean) => void;
}

export function useDocumentJobWorker(opts: DocumentJobWorkerOptions = {}) {
  const { enabled = true, onJobProcessed } = opts;
  const isProcessingRef = useRef(false);
  const intervalRef = useRef<number | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const processOne = async () => {
      if (isProcessingRef.current) return;
      isProcessingRef.current = true;
      try {
        // Claim a job atomically
        const { data: job, error: claimErr } = await supabase.rpc(
          "claim_pending_document_job",
          { p_worker_id: null } as any,
        );
        if (claimErr) {
          // Most common error: not staff. Silently ignore.
          if (!/unauthorized/i.test(claimErr.message)) {
            console.warn("[doc-worker] claim error:", claimErr.message);
          }
          return;
        }
        if (!job || (Array.isArray(job) && job.length === 0)) return;
        const claimed: any = Array.isArray(job) ? job[0] : job;
        if (!claimed?.id) return;

        try {
          // 1. Generate PDF in browser
          const dispatched = dispatchAutoDocument(
            claimed.doc_type as AutoDocType,
            claimed.event_payload || {},
          );

          // 2. Upload to private bucket: {client_id}/{doc_type}/{idempotency_key}.pdf
          const safeIdem = String(claimed.idempotency_key).replace(/[^a-zA-Z0-9_-]/g, "_");
          const storagePath = `${claimed.client_id}/${claimed.doc_type}/${safeIdem}.pdf`;
          const { error: uploadErr } = await supabase.storage
            .from(STORAGE_BUCKET)
            .upload(storagePath, dispatched.blob, {
              contentType: "application/pdf",
              upsert: true,
            });
          if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message}`);

          // 3. Mark generated → creates client_auto_documents entry
          const { error: markErr } = await supabase.rpc("mark_document_job_generated", {
            p_job_id: claimed.id,
            p_storage_path: storagePath,
            p_file_size_bytes: dispatched.fileSizeBytes,
            p_doc_number: dispatched.docNumber || null,
          } as any);
          if (markErr) throw new Error(`Mark generated failed: ${markErr.message}`);

          // 4. Trigger send edge function (fire-and-forget; it will retry independently)
          await supabase.functions.invoke("send-client-document", {
            body: { job_id: claimed.id },
          });

          onJobProcessed?.(claimed.id, true);
        } catch (workErr: any) {
          console.error("[doc-worker] job failed:", claimed.id, workErr);
          await supabase.rpc("mark_document_job_failed", {
            p_job_id: claimed.id,
            p_error: String(workErr?.message || workErr).slice(0, 500),
          } as any);
          onJobProcessed?.(claimed.id, false);
        }

        // Drain: try one more right away if a job was processed
        setTimeout(() => {
          isProcessingRef.current = false;
          processOne();
        }, 1000);
        return;
      } finally {
        isProcessingRef.current = false;
      }
    };

    // Initial drain + polling
    processOne();
    intervalRef.current = window.setInterval(processOne, POLL_INTERVAL_MS);

    // Realtime: react to new jobs immediately
    const channel = supabase
      .channel("pending_document_jobs_worker")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "pending_document_jobs" },
        () => processOne(),
      )
      .subscribe();
    channelRef.current = channel;

    return () => {
      if (intervalRef.current != null) window.clearInterval(intervalRef.current);
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [enabled, onJobProcessed]);
}
