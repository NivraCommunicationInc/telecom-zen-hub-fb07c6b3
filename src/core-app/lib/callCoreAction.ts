/**
 * callCoreAction — Standard wrapper for every Core 360 write action.
 *
 * Guarantees:
 *  - JWT is attached automatically by supabase.functions.invoke
 *  - `reason` is mandatory (audit trail)
 *  - Real error body is surfaced (FunctionsHttpError.context.text())
 *  - Canonical caches are invalidated (client + operational)
 *  - Toast success / error with detail
 */
import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { toast } from "sonner";
import type { QueryClient } from "@tanstack/react-query";
import { invalidateAfterPayment } from "@/lib/queryInvalidation";

export interface CoreActionOptions {
  reason: string;
  successMessage?: string;
  errorMessage?: string;
  queryClient?: QueryClient;
  skipInvalidation?: boolean;
}

export interface CoreActionResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  status?: number;
}

export async function callCoreAction<T = unknown>(
  edgeFn: string,
  payload: Record<string, unknown>,
  opts: CoreActionOptions,
): Promise<CoreActionResult<T>> {
  if (!opts.reason || opts.reason.trim().length < 3) {
    const msg = "Motif requis (min. 3 caractères) pour toute action Core.";
    toast.error(msg);
    return { ok: false, error: msg };
  }

  try {
    const { data, error } = await supabase.functions.invoke(edgeFn, {
      body: { ...payload, __audit_reason: opts.reason },
    });

    if (error) {
      let detail = error.message;
      if (error instanceof FunctionsHttpError) {
        try {
          detail = await error.context.text();
        } catch { /* ignore */ }
      }
      console.error(`[callCoreAction] ${edgeFn} failed:`, detail);
      toast.error(opts.errorMessage ?? `Échec: ${edgeFn}`, { description: detail });
      return { ok: false, error: detail };
    }

    if (opts.queryClient && !opts.skipInvalidation) {
      invalidateAfterPayment(opts.queryClient);
    }
    if (opts.successMessage) toast.success(opts.successMessage);
    return { ok: true, data: data as T };
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    console.error(`[callCoreAction] ${edgeFn} threw:`, msg);
    toast.error(opts.errorMessage ?? `Erreur: ${edgeFn}`, { description: msg });
    return { ok: false, error: msg };
  }
}
