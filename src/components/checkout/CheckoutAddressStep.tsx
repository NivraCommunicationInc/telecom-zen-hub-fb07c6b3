/**
 * CheckoutAddressStep - Étape sélection/création d'adresse en checkout.
 * Pass 3A: entièrement branché sur ServiceAddressPicker.
 * Le composant crée le compte à la volée si nécessaire, puis délègue la sélection/création
 * d'adresse au picker partagé.
 */
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { portalClient as supabase } from "@/integrations/backend";
import { generateAccountNumber } from "@/lib/secureIdGenerator";
import { MapPin, Loader2 } from "lucide-react";
import { ServiceAddressPicker } from "@/components/service-address/ServiceAddressPicker";
import { useAccountAddresses } from "@/hooks/useAccountAddresses";

interface CheckoutAddressStepProps {
  userId: string;
  category: string;
  selectedAddressId: string | null;
  onAddressSelected: (addressId: string, addressLine: string, city: string, postalCode: string) => void;
  onNewAddressCreated?: (addressId: string) => void;
}

export const CheckoutAddressStep = ({
  userId,
  category,
  selectedAddressId,
  onAddressSelected,
  onNewAddressCreated,
}: CheckoutAddressStepProps) => {
  const isRequired = ["internet", "tv", "combo"].includes(category);
  const [bootstrapping, setBootstrapping] = useState(false);

  const { data: account, refetch: refetchAccount } = useQuery({
    queryKey: ["checkout-account", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts")
        .select("id")
        .eq("client_id", userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  const accountId = account?.id ?? null;
  const { addresses } = useAccountAddresses(accountId);

  // Auto-sélection : première adresse existante lorsque la liste arrive
  useEffect(() => {
    if (selectedAddressId || addresses.length === 0) return;
    const first = addresses[0];
    onAddressSelected(first.id, first.address_line, first.city || "", first.postal_code || "");
  }, [addresses, selectedAddressId, onAddressSelected]);

  const knownById = useMemo(() => {
    const m = new Map<string, typeof addresses[number]>();
    addresses.forEach((a) => m.set(a.id, a));
    return m;
  }, [addresses]);

  const ensureAccount = async (): Promise<string | null> => {
    if (accountId) return accountId;
    setBootstrapping(true);
    try {
      const { data, error } = await supabase
        .from("accounts")
        .insert({ client_id: userId, account_number: generateAccountNumber(), status: "active" })
        .select("id")
        .single();
      if (error) throw error;
      await refetchAccount();
      return data.id as string;
    } finally {
      setBootstrapping(false);
    }
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <MapPin className="w-5 h-5 text-cyan-500" />
          Adresse de service
          {isRequired && <Badge variant="outline" className="text-xs">Obligatoire</Badge>}
        </CardTitle>
        <CardDescription>
          {isRequired
            ? "Sélectionnez l'adresse où le service sera installé"
            : "Optionnel — adresse de livraison de l'équipement"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!accountId ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Préparation de votre compte…
            <button
              type="button"
              className="ml-auto underline text-xs"
              onClick={() => ensureAccount()}
              disabled={bootstrapping}
            >
              Ajouter une adresse maintenant
            </button>
          </div>
        ) : (
          <ServiceAddressPicker
            accountId={accountId}
            value={selectedAddressId ?? undefined}
            mode="cards"
            allowCreate
            onChange={(id, addr) => {
              const isNew = !knownById.has(id);
              onAddressSelected(id, addr.address_line, addr.city || "", addr.postal_code || "");
              if (isNew) onNewAddressCreated?.(id);
            }}
          />
        )}
      </CardContent>
    </Card>
  );
};

export default CheckoutAddressStep;
