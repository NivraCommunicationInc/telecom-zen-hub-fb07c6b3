/**
 * useLoyaltyReferralRealtime — Subscribe to loyalty + referral tables and
 * trigger a callback (usually a refetch) whenever admin actions in Core
 * change the client's balances / referral state.
 *
 * Tables added to supabase_realtime publication (see July migration):
 *   loyalty_points, loyalty_transactions, loyalty_redemptions,
 *   client_referrals, client_referral_events
 */
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const TABLES = [
  "loyalty_points",
  "loyalty_transactions",
  "loyalty_redemptions",
  "client_referrals",
  "client_referral_events",
] as const;

export function useLoyaltyReferralRealtime(
  userId: string | null | undefined,
  onChange: () => void,
) {
  useEffect(() => {
    if (!userId) return;
    const channel = supabase.channel(`loyalty-referrals-${userId}`);
    for (const table of TABLES) {
      channel.on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table },
        () => onChange(),
      );
    }
    channel.subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, onChange]);
}
