/**
 * useAccountServiceTree — arbre agrégé compte → adresses → services.
 * Une seule requête RPC pour tous les portails. Aucune logique de regroupement côté front.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { portalClient } from "@/integrations/backend/portalClient";

export interface AddressServiceNode {
  address: {
    id: string;
    account_id: string;
    address_line: string;
    city: string | null;
    province: string | null;
    postal_code: string | null;
    [key: string]: any;
  };
  subscriptions: any[];
  service_instances?: any[];
  equipment: any[];
  appointments: any[];
  tickets: any[];
  incidents: any[];
}

export interface AccountServiceTree {
  account_id: string;
  addresses: AddressServiceNode[];
}

export function useAccountServiceTree(accountId: string | null | undefined) {
  const backend =
    typeof window !== "undefined" && window.location.pathname.startsWith("/portal")
      ? portalClient
      : supabase;

  return useQuery<AccountServiceTree>({
    queryKey: ["account-service-tree", accountId],
    enabled: !!accountId,
    queryFn: async () => {
      const { data, error } = await backend.rpc("get_account_service_tree", {
        _account_id: accountId as string,
      } as any);
      if (error) throw error;
      return (data as unknown as AccountServiceTree) || { account_id: accountId!, addresses: [] };
    },
  });
}
