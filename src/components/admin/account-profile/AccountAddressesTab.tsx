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
  equipment?: any[];
  appointments?: any[];
  tickets?: any[];
  incidents?: any[];
}

export function AccountAddressesTab({ account, subscriptions, equipment = [], appointments = [], tickets = [], incidents = [] }: AccountAddressesTabProps) {
  const notifyClient = (_id: string, addr: any) => {
    clientSupabase.functions.invoke("account-ops-actions", {
      body: {
        action: "notify_address_change",
        client_user_id: account.user_id || account.client_id,
        new_address: addr.address_line,
        new_city: addr.city,
        new_postal: addr.postal_code,
      },
    }).catch(() => {});
  };

  return (
    <AddressServiceWorkspace
      accountId={account?.id}
      account={account}
      subscriptions={subscriptions}
      equipment={equipment}
      appointments={appointments}
      tickets={tickets}
      incidents={incidents}
      mode="core"
      onAddressCreated={notifyClient}
    />
  );
}
