/**
 * useCheckoutDraft — universal cart-persistence hook.
 * Persists a snapshot to `localStorage` on every save() call, and (best-effort)
 * mirrors it into `public.checkout_sessions.draft_data` when the user is
 * signed in so agents/admins can recover an abandoned cart from any device.
 *
 * TTL: 30 days (matches the DB column default).
 *
 * Usage:
 *   const { draft, save, clear, hasDraft } = useCheckoutDraft("field_new_sale");
 *   useEffect(() => { if (draft) hydrateStateFromDraft(draft); }, []);
 *   useEffect(() => { save(currentState); }, [currentState]);
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const KEY_PREFIX = "nivra_checkout_draft:";

interface Envelope<T> {
  data: T;
  savedAt: number;
}

export interface UseCheckoutDraftResult<T> {
  draft: T | null;
  hasDraft: boolean;
  save: (data: T) => void;
  clear: () => void;
}

export function useCheckoutDraft<T = unknown>(source: string): UseCheckoutDraftResult<T> {
  const storageKey = KEY_PREFIX + source;
  const [draft, setDraft] = useState<T | null>(null);

  // Hydrate from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const env = JSON.parse(raw) as Envelope<T>;
      if (!env || typeof env.savedAt !== "number") return;
      if (Date.now() - env.savedAt > TTL_MS) {
        localStorage.removeItem(storageKey);
        return;
      }
      setDraft(env.data);
    } catch {
      localStorage.removeItem(storageKey);
    }
  }, [storageKey]);

  const save = useCallback(
    (data: T) => {
      try {
        const env: Envelope<T> = { data, savedAt: Date.now() };
        localStorage.setItem(storageKey, JSON.stringify(env));
      } catch {
        // Storage full or disabled — fail silently
      }
      // Mirror to DB (best-effort, fire-and-forget)
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (!user) return;
        supabase
          .from("checkout_sessions")
          .upsert(
            {
              user_id: user.id,
              status: "draft",
              draft_source: source,
              draft_data: data as unknown as any,
              cart_items: null,
              updated_at: new Date().toISOString(),
            } as never,
            { onConflict: "user_id" } as never,
          )
          .then(() => undefined, () => undefined);
      });
    },
    [storageKey, source],
  );

  const clear = useCallback(() => {
    try { localStorage.removeItem(storageKey); } catch { /* noop */ }
    setDraft(null);
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from("checkout_sessions").delete().eq("user_id", user.id).eq("draft_source", source)
        .then(() => undefined, () => undefined);
    });
  }, [storageKey, source]);

  return { draft, hasDraft: draft !== null, save, clear };
}
