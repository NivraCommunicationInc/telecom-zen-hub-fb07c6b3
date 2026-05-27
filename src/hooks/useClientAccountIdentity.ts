import { useQuery } from "@tanstack/react-query";
import { portalClient } from "@/integrations/backend/portalClient";

type AccountIdentity = {
  accountNumber: string | null;
  clientNumber: string | null;
  source: "accounts" | "none";
};

const cleanValue = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  return cleaned.length > 0 ? cleaned : null;
};

/**
 * Resolves canonical account identity for a user.
 *
 * HARD INVARIANT:
 * - account_number can ONLY come from accounts (active row)
 * - profiles and invoice snapshots are NEVER used as account_number display sources
 * - if invoices exist without an active account row, throw a system integrity error
 */
export const useClientAccountIdentity = (userId?: string) => {
  return useQuery<AccountIdentity>({
    queryKey: ["client-account-identity", userId],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) {
        return { accountNumber: null, clientNumber: null, source: "none" };
      }

      const { data, error } = await portalClient.rpc("get_customer_portal_snapshot", {
        _user_id: userId,
      });
      if (error) throw error;

      const snapshot = (data || {}) as any;
      const accountNumber = cleanValue(snapshot?.account?.account_number);
      const clientNumber = cleanValue(snapshot?.identifiers?.clientNumber ?? snapshot?.profile?.client_number);

      if (accountNumber) {
        return {
          accountNumber,
          clientNumber,
          source: "accounts",
        };
      }

      return {
        accountNumber: null,
        clientNumber,
        source: "none",
      };
    },
  });
};
