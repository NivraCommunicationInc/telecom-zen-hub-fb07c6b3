import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ProratePreview {
  account_id: string;
  service_address_id: string;
  activation_date: string;
  anchor_day: number;
  prev_anchor: string;
  next_anchor: string;
  days_in_cycle: number;
  days_remaining: number;
  monthly_price_cents: number;
  prorata_cents: number;
  is_zero: boolean;
}

interface Args {
  accountId?: string | null;
  serviceAddressId?: string | null;
  monthlyPriceCents?: number | null;
  activationDate?: string;
  enabled?: boolean;
}

/**
 * Read-only preview of the prorata amount for a single service.
 * All math is computed server-side by public.preview_prorata.
 */
export function useProratePreview({
  accountId,
  serviceAddressId,
  monthlyPriceCents,
  activationDate,
  enabled = true,
}: Args) {
  const isReady =
    enabled &&
    !!accountId &&
    !!serviceAddressId &&
    typeof monthlyPriceCents === "number" &&
    monthlyPriceCents >= 0;

  return useQuery<ProratePreview | null>({
    queryKey: [
      "prorata-preview",
      accountId,
      serviceAddressId,
      monthlyPriceCents,
      activationDate ?? "today",
    ],
    enabled: isReady,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("preview_prorata" as any, {
        p_account_id: accountId,
        p_service_address_id: serviceAddressId,
        p_monthly_price_cents: monthlyPriceCents,
        p_activation_date: activationDate ?? new Date().toISOString().slice(0, 10),
      });
      if (error) throw error;
      return (data as unknown) as ProratePreview;
    },
  });
}
