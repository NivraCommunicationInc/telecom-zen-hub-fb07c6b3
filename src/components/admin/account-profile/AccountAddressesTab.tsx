/**
 * AccountAddressesTab — Vue Core/Admin des adresses de service.
 * Dossier cliquable par adresse: services, équipement, RDV, tickets et actions.
 */
import { supabase as clientSupabase } from "@/integrations/supabase/client";
import { AddressServiceWorkspace } from "@/components/service-address/AddressServiceWorkspace";

interface AccountAddressesTabProps {
  account: any;
  /** Legacy prop kept for API compat; ignored (data now flows via useAccountAddresses). */
  locations?: any[];
  subscriptions: any[];
}

export function AccountAddressesTab({ account, subscriptions }: AccountAddressesTabProps) {
  const notifyClient = (_id: string, addr: any) => {
    clientSupabase.functions.invoke("account-ops-actions", {
      body: {
        action: "notify_address_change",
        client_user_id: account.user_id,
        new_address: addr.address_line,
        new_city: addr.city,
        new_postal: addr.postal_code,
      },
    }).catch(() => {});
  };

  return <AddressServiceWorkspace accountId={account?.id} account={account} subscriptions={subscriptions} mode="core" onAddressCreated={notifyClient} />;
}
