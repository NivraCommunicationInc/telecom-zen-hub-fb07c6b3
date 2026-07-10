/**
 * MODULE 39 — Frontend helper for the canonical `document-actions` Edge Function.
 * Every document write (register after upload, soft delete, restore, signed URL)
 * MUST go through this helper. No direct table writes are allowed.
 */
import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { toast } from "sonner";

export type DocTable = "client_documents" | "order_documents" | "hr_documents" | "client_auto_documents";
export type DocAction = "register" | "soft_delete" | "restore" | "signed_url" | "purge_expired";

export interface DocumentActionOptions {
  action: DocAction;
  table?: DocTable;
  document_id?: string;
  payload?: Record<string, unknown>;
  ttl_seconds?: number;
  reason: string;
  idempotency_key?: string;
  successMessage?: string;
  errorMessage?: string;
  silent?: boolean;
}

export interface DocumentActionResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

export async function callDocumentAction<T = unknown>(
  opts: DocumentActionOptions,
): Promise<DocumentActionResult<T>> {
  if (!opts.reason || opts.reason.trim().length < 3) {
    const msg = "Motif requis (min. 3 caractères) pour toute action Documents.";
    if (!opts.silent) toast.error(msg);
    return { ok: false, error: msg };
  }
  const body: Record<string, unknown> = {
    action: opts.action,
    reason: opts.reason,
    idempotency_key: opts.idempotency_key ?? crypto.randomUUID(),
  };
  if (opts.table) body.table = opts.table;
  if (opts.document_id) body.document_id = opts.document_id;
  if (opts.payload) body.payload = opts.payload;
  if (opts.ttl_seconds) body.ttl_seconds = opts.ttl_seconds;

  try {
    const { data, error } = await supabase.functions.invoke("document-actions", { body });
    if (error) {
      let detail = error.message;
      if (error instanceof FunctionsHttpError) {
        try { detail = await error.context.text(); } catch { /* ignore */ }
      }
      console.error(`[document-actions:${opts.action}]`, detail);
      if (!opts.silent) toast.error(opts.errorMessage ?? `Échec: document-actions/${opts.action}`, { description: detail });
      return { ok: false, error: detail };
    }
    if (!opts.silent && opts.successMessage) toast.success(opts.successMessage);
    return { ok: true, data: data as T };
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    if (!opts.silent) toast.error(opts.errorMessage ?? `Erreur document-actions`, { description: msg });
    return { ok: false, error: msg };
  }
}
