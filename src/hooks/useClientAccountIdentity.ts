import { useQuery } from "@tanstack/react-query";
import { portalClient } from "@/integrations/backend/portalClient";
import {
  assertCanonicalAccountInvariant,
  buildCanonicalAccountMaps,
  resolveCanonicalAccountNumber,
} from "@/lib/canonicalAccountResolver";

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

      const { data: profile } = await portalClient
        .from("profiles")
        .select("client_number")
        .eq("user_id", userId)
        .maybeSingle();

      const profileClientNumber = cleanValue(profile?.client_number);

      const maps = await buildCanonicalAccountMaps(portalClient, {
        userIds: [userId],
        accountIds: [userId],
      });
      const accountNumber = cleanValue(
        resolveCanonicalAccountNumber(maps, { userId }),
      ) ?? cleanValue((await portalClient.from("accounts").select("account_number").eq("client_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle()).data?.account_number);

      if (accountNumber) {
        return {
          accountNumber,
          clientNumber: profileClientNumber,
          source: "accounts",
        };
      }

      // HARD INVARIANT: invoices must never exist without canonical account identity
      const { data: billingCustomer } = await portalClient
        .from("billing_customers")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (billingCustomer?.id) {
        const { data: existingInvoice } = await portalClient
          .from("billing_invoices")
          .select("id")
          .eq("customer_id", billingCustomer.id)
          .limit(1)
          .maybeSingle();

        assertCanonicalAccountInvariant(
          "client_identity",
          userId,
          { customerId: billingCustomer.id, userId },
          existingInvoice?.id ? accountNumber : "ok",
        );
      }

      return {
        accountNumber: null,
        clientNumber: profileClientNumber,
        source: "none",
      };
    },
  });
};
