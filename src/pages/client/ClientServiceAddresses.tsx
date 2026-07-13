/**
 * Client Portal - Manage Service Addresses
 * Route: /portal/service-addresses
 *
 * Pass 3A: dossier multi-adresses complet.
 */
import ClientLayout from "@/components/client/ClientLayout";
import { useClientAuth } from "@/hooks/useClientAuth";
import { useCanonicalClientData } from "@/hooks/useCanonicalClientData";
import { ClientAddressWorkspace } from "@/components/service-address/ClientAddressWorkspace";
import { Loader2, MapPin } from "lucide-react";

const ClientServiceAddresses = () => {
  const { user } = useClientAuth();
  const { data: canonical, isLoading: canonicalLoading } = useCanonicalClientData(user?.id);
  const accountId = canonical?.account?.id ?? null;

  const loading = canonicalLoading;

  return (
    <ClientLayout>
      <div className="max-w-3xl mx-auto space-y-6 p-4 md:p-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MapPin className="w-6 h-6 text-cyan-500" />
            Mes adresses de service
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gérez les adresses où vos services sont installés. Aucune limite — ajoutez-en autant que nécessaire.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ClientAddressWorkspace
            accountId={accountId}
            subscriptions={canonical?.subscriptions || []}
            equipment={canonical?.equipment || []}
            appointments={canonical?.appointments || []}
            tickets={canonical?.supportTickets || []}
            orders={canonical?.orders || []}
          />
        )}
      </div>
    </ClientLayout>
  );
};

export default ClientServiceAddresses;
