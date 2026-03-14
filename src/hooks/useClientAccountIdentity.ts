import { useQuery } from "@tanstack/react-query";
import { portalClient } from "@/integrations/backend/portalClient";

type AccountIdentity = {
  accountNumber: string | null;
  clientNumber: string | null;
  source: "accounts" | "profiles" | "invoice_snapshot" | "none";
};

const cleanValue = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  return cleaned.length > 0 ? cleaned : null;
};

/**
 * Resolves the canonical account number for a user.
 *
 * Priority order (accounts table is the single source of truth):
 *   1. accounts table  — the ONLY canonical source for account_number
 *   2. invoice snapshot — fallback if account row missing but invoice exists
 *   3. profiles table   — last resort only (may contain stale data)
 *
 * The client_number is always read from profiles (informational only).
 */
export const useClientAccountIdentity = (userId?: string) => {
  return useQuery<AccountIdentity>({
    queryKey: ["client-account-identity", userId],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) {
        return { accountNumber: null, clientNumber: null, source: "none" };
      }

      // Always read client_number from profiles (informational, not authoritative for account_number)
      const { data: profile } = await portalClient
        .from("profiles")
        .select("id, account_number, client_number")
        .eq("user_id", userId)
        .maybeSingle();

      const profileClientNumber = cleanValue(profile?.client_number);

      // 1) CANONICAL: accounts table is the single source of truth
      {
        const { data: accountRow } = await portalClient
          .from("accounts")
          .select("account_number")
          .eq("client_id", userId)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const accountsNumber = cleanValue(accountRow?.account_number);
        if (accountsNumber) {
          return {
            accountNumber: accountsNumber,
            clientNumber: profileClientNumber,
            source: "accounts",
          };
        }
      }

      // 2) FALLBACK: invoice snapshot (if account row doesn't exist yet)
      {
        const { data: billingCustomer } = await portalClient
          .from("billing_customers")
          .select("id")
          .eq("user_id", userId)
          .maybeSingle();

        if (billingCustomer?.id) {
          const { data: lastInvoice } = await portalClient
            .from("billing_invoices")
            .select("billing_snapshot_account_number")
            .eq("customer_id", billingCustomer.id)
            .not("billing_snapshot_account_number", "is", null)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          const snapshotNumber = cleanValue(lastInvoice?.billing_snapshot_account_number);
          if (snapshotNumber) {
            return {
              accountNumber: snapshotNumber,
              clientNumber: profileClientNumber,
              source: "invoice_snapshot",
            };
          }
        }
      }

      // 3) LAST RESORT: profiles table (may contain stale data)
      const profileAccountNumber = cleanValue(profile?.account_number);
      if (profileAccountNumber) {
        return {
          accountNumber: profileAccountNumber,
          clientNumber: profileClientNumber,
          source: "profiles",
        };
      }

      return {
        accountNumber: null,
        clientNumber: profileClientNumber,
        source: "none",
      };
    },
  });
};
