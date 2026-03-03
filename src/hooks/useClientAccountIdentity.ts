import { useQuery } from "@tanstack/react-query";
import { portalClient } from "@/integrations/backend/portalClient";

type AccountIdentity = {
  accountNumber: string | null;
  clientNumber: string | null;
  source: "profiles" | "accounts" | "invoice_snapshot" | "none";
};

const cleanValue = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  return cleaned.length > 0 ? cleaned : null;
};

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
        .select("id, account_number, client_number")
        .eq("user_id", userId)
        .maybeSingle();

      const profileAccountNumber = cleanValue(profile?.account_number);
      const profileClientNumber = cleanValue(profile?.client_number);

      if (profileAccountNumber || profileClientNumber) {
        return {
          accountNumber: profileAccountNumber ?? profileClientNumber,
          clientNumber: profileClientNumber,
          source: "profiles",
        };
      }

      if (profile?.id) {
        const { data: accountRow } = await portalClient
          .from("accounts")
          .select("account_number")
          .eq("client_id", profile.id)
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

      return {
        accountNumber: null,
        clientNumber: profileClientNumber,
        source: "none",
      };
    },
  });
};
