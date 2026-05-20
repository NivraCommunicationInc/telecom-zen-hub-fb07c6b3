/**
 * useProfileName — resolves a user UUID to a human-readable display name.
 * Fallback chain: profiles.full_name → profiles.email → "Agent inconnu".
 * Module-level cache avoids refetching the same user across the app.
 *
 * Use this everywhere instead of showing a raw UUID (or truncated UUID)
 * for fields like agent_id, locked_by, created_by, hired_by, reviewed_by,
 * imported_by, assigned_to, technician_id, salesperson_id, approved_by,
 * rejected_by.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const cache: Record<string, string> = {};
const inflight: Record<string, Promise<string>> = {};

async function fetchName(userId: string): Promise<string> {
  if (cache[userId]) return cache[userId];
  if (inflight[userId]) return inflight[userId];
  inflight[userId] = (async () => {
    const { data } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("user_id", userId)
      .maybeSingle();
    const display =
      (data?.full_name && String(data.full_name).trim()) ||
      data?.email ||
      "Agent inconnu";
    cache[userId] = display;
    delete inflight[userId];
    return display;
  })();
  return inflight[userId];
}

export function useProfileName(userId?: string | null, fallback = "—"): string {
  const initial = userId && cache[userId] ? cache[userId] : userId ? "…" : fallback;
  const [name, setName] = useState<string>(initial);

  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      setName(fallback);
      return;
    }
    if (cache[userId]) {
      setName(cache[userId]);
      return;
    }
    fetchName(userId).then((display) => {
      if (!cancelled) setName(display);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, fallback]);

  return name;
}

/**
 * Resolve many user UUIDs in one round-trip. Returns a map { user_id: displayName }.
 * Cached entries are reused. Use for tables/lists.
 */
export async function resolveProfileNames(
  userIds: Array<string | null | undefined>,
): Promise<Record<string, string>> {
  const unique = Array.from(
    new Set(userIds.filter((x): x is string => typeof x === "string" && !!x)),
  );
  const missing = unique.filter((id) => !cache[id]);
  if (missing.length > 0) {
    const { data } = await supabase
      .from("profiles")
      .select("user_id, full_name, email")
      .in("user_id", missing);
    for (const id of missing) {
      const row = (data ?? []).find((r: any) => r.user_id === id);
      cache[id] =
        (row?.full_name && String(row.full_name).trim()) ||
        row?.email ||
        "Agent inconnu";
    }
  }
  const out: Record<string, string> = {};
  for (const id of unique) out[id] = cache[id] ?? "Agent inconnu";
  return out;
}

/**
 * Small inline component for tables/cells: <ProfileName userId={row.agent_id} />
 */
export function ProfileName({
  userId,
  fallback = "—",
  className,
}: {
  userId?: string | null;
  fallback?: string;
  className?: string;
}) {
  const name = useProfileName(userId, fallback);
  return <span className={className}>{name}</span>;
}
