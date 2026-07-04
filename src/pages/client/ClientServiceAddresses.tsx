/**
 * Client Portal - Manage Service Addresses
 * Route: /portal/service-addresses
 *
 * Pass 3A: entièrement branché sur les primitives partagées.
 * Une seule implémentation partout : useAccountAddresses + ServiceAddressPicker + AddressBlock.
 */
import ClientLayout from "@/components/client/ClientLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useClientAuth } from "@/hooks/useClientAuth";
import { useCanonicalClientData } from "@/hooks/useCanonicalClientData";
import { useAccountAddresses } from "@/hooks/useAccountAddresses";
import { ServiceAddressPicker } from "@/components/service-address/ServiceAddressPicker";
import { AddressBlock } from "@/components/service-address/AddressBlock";
import { Loader2, MapPin, Home, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useMemo, useState } from "react";

const ClientServiceAddresses = () => {
  const { user } = useClientAuth();
  const { data: canonical, isLoading: canonicalLoading } = useCanonicalClientData(user?.id);
  const accountId = canonical?.account?.id ?? null;

  const { addresses, isLoading, softDelete, deleting } = useAccountAddresses(accountId);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const serviceCountByAddress = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of (canonical?.subscriptions || []) as any[]) {
      const key = s.service_address_id || s.address_id;
      if (!key) continue;
      if (!["active", "pending", "suspended"].includes(String(s.status))) continue;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [canonical?.subscriptions]);

  const handleDelete = async (id: string) => {
    try {
      await softDelete(id);
      toast.success("Adresse supprimée");
    } catch (e: any) {
      toast.error(e?.message || "Suppression impossible");
    }
  };

  const loading = canonicalLoading || isLoading;

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

        {accountId && (
          <ServiceAddressPicker
            accountId={accountId}
            value={selectedId ?? undefined}
            onChange={(id) => setSelectedId(id)}
            mode="cards"
            allowCreate
            emptyLabel="Aucune adresse enregistrée"
          />
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : addresses.length === 0 ? (
          <Card className="bg-card border-border">
            <CardContent className="py-12 text-center">
              <Home className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">Aucune adresse enregistrée</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {addresses.map((addr) => (
              <AddressBlock
                key={addr.id}
                address={addr}
                badges={
                  <Badge variant="outline" className="text-[10px]">
                    {serviceCountByAddress.get(addr.id) ?? 0} service(s)
                  </Badge>
                }
                actions={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:bg-destructive/10 h-8 w-8"
                    onClick={() => handleDelete(addr.id)}
                    disabled={deleting}
                    aria-label="Supprimer cette adresse"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                }
              >
                <p className="text-xs text-muted-foreground">
                  Ajoutée le {new Date(addr.created_at).toLocaleDateString("fr-CA")}
                </p>
              </AddressBlock>
            ))}
          </div>
        )}
      </div>
    </ClientLayout>
  );
};

export default ClientServiceAddresses;
