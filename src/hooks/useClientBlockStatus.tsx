import { useQuery } from "@tanstack/react-query";
import { portalClient as portalSupabase } from "@/integrations/backend";
import { useClientAuth } from "@/hooks/useClientAuth";

export interface ClientBlockStatus {
  accountStatus: "active" | "blocked";
  onlineAccessStatus: "active" | "blocked";
  blockedReason: string | null;
  blockedAt: string | null;
  isAccountBlocked: boolean;
  isOnlineAccessBlocked: boolean;
}

export const useClientBlockStatus = () => {
  const { user } = useClientAuth();

  const query = useQuery({
    queryKey: ["client-block-status", user?.id],
    queryFn: async (): Promise<ClientBlockStatus | null> => {
      if (!user?.id) return null;

      const { data, error } = await portalSupabase
        .from("profiles")
        .select("account_status, online_access_status, blocked_reason, blocked_at")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error || !data) return null;

      return {
        accountStatus: (data.account_status as "active" | "blocked") || "active",
        onlineAccessStatus: (data.online_access_status as "active" | "blocked") || "active",
        blockedReason: data.blocked_reason,
        blockedAt: data.blocked_at,
        isAccountBlocked: data.account_status === "blocked",
        isOnlineAccessBlocked: data.online_access_status === "blocked",
      };
    },
    enabled: !!user?.id,
    staleTime: 30 * 1000, // 30 seconds
    refetchOnWindowFocus: true,
  });

  return {
    ...query,
    status: query.data,
    isAccountBlocked: query.data?.isAccountBlocked ?? false,
    isOnlineAccessBlocked: query.data?.isOnlineAccessBlocked ?? false,
    blockedReason: query.data?.blockedReason ?? null,
  };
};