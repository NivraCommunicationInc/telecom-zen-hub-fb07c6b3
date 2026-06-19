import { useQuery } from "@tanstack/react-query";
import { portalClient } from "@/integrations/backend/portalClient";

export interface ClientPromo {
  id: string;
  label: string;
  amount: number;
  months_remaining: number | null;
  duration_months: number | null;
  promotion_type: string;
  promo_code: string | null;
  expires_at: string | null;
}

export interface ClientCredit {
  id: string;
  description: string;
  amount: number;
  months_remaining: number | null;
  months_total: number | null;
  is_permanent: boolean;
  type: string;
  expires_at: string | null;
}

export function useClientPerks(userId: string | null | undefined) {
  return useQuery<{ promotions: ClientPromo[]; credits: ClientCredit[] }>({
    queryKey: ["client-perks", userId],
    enabled: !!userId,
    staleTime: 30_000,
    queryFn: async () => {
      if (!userId) return { promotions: [], credits: [] };
      const { data, error } = await portalClient.rpc("get_client_perks", { p_user_id: userId });
      if (error) throw error;
      const result = data as any;
      return {
        promotions: (result?.promotions ?? []) as ClientPromo[],
        credits:    (result?.adjustments ?? []) as ClientCredit[],
      };
    },
  });
}
