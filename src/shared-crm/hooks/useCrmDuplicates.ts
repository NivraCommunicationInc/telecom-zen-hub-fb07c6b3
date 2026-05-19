/**
 * useCrmDuplicates — Batch-checks contact phones against existing client base.
 * Returns a Set of contact IDs whose phone matches an existing profile.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { CrmContact } from "../lib/crmTypes";

export function useCrmDuplicates(contacts: CrmContact[]) {
  const [dupIds, setDupIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    const toCheck = contacts.filter((c) => c.phone).slice(0, 200);
    if (toCheck.length === 0) {
      setDupIds(new Set());
      return;
    }
    (async () => {
      const found = new Set<string>();
      // Limit concurrency
      await Promise.all(
        toCheck.map(async (c) => {
          try {
            const { data } = await supabase.rpc("crm_check_duplicate", { p_phone: c.phone! });
            const r = data as { ok?: boolean; is_duplicate?: boolean } | null;
            if (r?.ok && r.is_duplicate) found.add(c.id);
          } catch { /* ignore */ }
        })
      );
      if (!cancelled) setDupIds(found);
    })();
    return () => { cancelled = true; };
    // Re-run only when the set of contact IDs changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contacts.map((c) => c.id).join("|")]);

  return dupIds;
}
