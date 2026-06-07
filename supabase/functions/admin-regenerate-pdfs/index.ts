/**
 * admin-regenerate-pdfs
 *
 * Regenerates ALL existing auto-documents PDFs using stored event_payload.
 * Overwrites old storage files (upsert: true). Does NOT re-send emails.
 * Logs every operation to pdf_regeneration_runs table.
 *
 * POST (no body needed)
 * Authorization: Bearer <admin JWT>
 *
 * Returns JSON: { total, succeeded, failed, skipped, log: [...] }
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { dispatchAutoDocument, type AutoDocType } from "../_shared/pdf/dispatcher.ts";

const SUPABASE_URL     = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY         = Deno.env.get("SUPABASE_ANON_KEY")!;
const STORAGE_BUCKET   = "client-documents";

Deno.serve(async (req) => {
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;
  const cors = getCorsHeaders(req.headers.get("origin"));

  /* ── 1. Verify admin JWT ─────────────────────────────────────────── */
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return new Response(JSON.stringify({ error: "Non authentifié" }), {
      status: 401, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const authClient = createClient(SUPABASE_URL, ANON_KEY);
  const { data: { user }, error: authErr } = await authClient.auth.getUser(token);
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: "Token invalide" }), {
      status: 401, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Verify admin role
  const { data: roleRow } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .in("role", ["admin", "super_admin"])
    .maybeSingle();

  if (!roleRow) {
    return new Response(JSON.stringify({ error: "Accès réservé aux administrateurs" }), {
      status: 403, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  /* ── 2. Load all completed jobs with stored PDF ───────────────────── */
  const { data: jobs, error: jobsErr } = await admin
    .from("pending_document_jobs")
    .select("id, client_id, doc_type, event_payload, idempotency_key, storage_path, client_auto_document_id")
    .in("status", ["generated", "sent"])
    .not("storage_path", "is", null)
    .not("event_payload", "is", null)
    .order("created_at", { ascending: true });

  if (jobsErr) {
    return new Response(JSON.stringify({ error: "Erreur lecture jobs: " + jobsErr.message }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const allJobs = jobs || [];
  const startedAt = new Date().toISOString();

  let succeeded = 0;
  let failed = 0;
  const log: Array<{
    job_id: string;
    client_id: string;
    doc_type: string;
    storage_path: string;
    status: "ok" | "failed";
    old_size_bytes?: number;
    new_size_bytes?: number;
    error?: string;
  }> = [];

  /* ── 3. Regenerate each PDF ──────────────────────────────────────── */
  for (const job of allJobs) {
    const entry: (typeof log)[number] = {
      job_id: job.id,
      client_id: job.client_id,
      doc_type: job.doc_type,
      storage_path: job.storage_path,
      status: "failed",
    };

    try {
      // Regenerate PDF using stored event_payload
      const dispatched = await dispatchAutoDocument(
        job.doc_type as AutoDocType,
        job.event_payload || {},
      );

      // Overwrite in storage (upsert: true deletes old + uploads new)
      const { error: uploadErr } = await admin.storage
        .from(STORAGE_BUCKET)
        .upload(job.storage_path, dispatched.bytes, {
          contentType: "application/pdf",
          upsert: true,
        });

      if (uploadErr) throw new Error("Upload storage: " + uploadErr.message);

      entry.new_size_bytes = dispatched.fileSizeBytes;
      entry.status = "ok";

      // Update client_auto_documents to record new file size + regeneration time
      if (job.client_auto_document_id) {
        await admin
          .from("client_auto_documents")
          .update({
            file_size_bytes: dispatched.fileSizeBytes,
            updated_at: new Date().toISOString(),
          })
          .eq("id", job.client_auto_document_id);
      }

      succeeded++;
    } catch (err: any) {
      entry.status = "failed";
      entry.error = String(err?.message || err).slice(0, 400);
      failed++;
      console.error(`[admin-regenerate-pdfs] ${job.doc_type} / ${job.id} FAILED:`, entry.error);
    }

    log.push(entry);
  }

  /* ── 4. Persist run log to pdf_regeneration_runs ─────────────────── */
  const completedAt = new Date().toISOString();
  await admin
    .from("pdf_regeneration_runs")
    .insert({
      triggered_by: user.id,
      triggered_at: startedAt,
      completed_at: completedAt,
      total: allJobs.length,
      succeeded,
      failed,
      log_json: log,
    })
    .catch((e: any) =>
      console.warn("[admin-regenerate-pdfs] log insert failed (table may not exist):", e?.message),
    );

  const summary = {
    triggered_by: user.id,
    triggered_at: startedAt,
    completed_at: completedAt,
    total: allJobs.length,
    succeeded,
    failed,
    log,
  };

  console.log(
    `[admin-regenerate-pdfs] done — total=${allJobs.length} ok=${succeeded} failed=${failed}`,
  );

  return new Response(JSON.stringify(summary, null, 2), {
    status: 200,
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
