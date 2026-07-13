/**
 * AccountAddressesTab — Vue Core/Admin des adresses de service.
 * Dossier cliquable par adresse: services, équipement, RDV, tickets et actions.
 *
 * IMPORTANT: L'ajout d'une adresse ici correspond au modèle MULTI-ADRESSES
 * (le compte a plusieurs adresses actives en parallèle). Ce n'est PAS un
 * déménagement — aucun email/PDF "changement d'adresse" n'est déclenché.
 * Le flow déménagement reste dédié (AdminDocumentsPanel → AddressChangeDialog).
 */
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
  orders?: any[];
}

export function AccountAddressesTab({ account, subscriptions, equipment = [], appointments = [], tickets = [], incidents = [], orders = [] }: AccountAddressesTabProps) {
  return (
    <AddressServiceWorkspace
      accountId={account?.id}
      account={account}
      subscriptions={subscriptions}
      equipment={equipment}
      appointments={appointments}
      tickets={tickets}
      incidents={incidents}
      orders={orders}
      mode="core"
    />
  );
}
