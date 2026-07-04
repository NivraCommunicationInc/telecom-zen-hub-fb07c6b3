/**
 * AccountAddressesTab — Vue Core/Admin des adresses de service.
 * Pass 3A: 100% branché sur les primitives partagées
 *   - useAccountAddresses (source unique)
 *   - AddressBlock (rendu)
 *   - ServiceAddressPicker (création via son dialog inline)
 */
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { supabase as clientSupabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAccountAddresses } from "@/hooks/useAccountAddresses";
import { AddressBlock } from "@/components/service-address/AddressBlock";
import { ServiceAddressPicker } from "@/components/service-address/ServiceAddressPicker";

interface AccountAddressesTabProps {
  account: any;
  /** Legacy prop kept for API compat; ignored (data now flows via useAccountAddresses). */
  locations?: any[];
  subscriptions: any[];
}

export function AccountAddressesTab({ account, subscriptions }: AccountAddressesTabProps) {
  const { toast } = useToast();
  const { addresses, isLoading, softDelete } = useAccountAddresses(account?.id);
  const [pickerKey, setPickerKey] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const countBySa = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of subscriptions || []) {
      const key = s.service_address_id || s.address_id;
      if (!key) continue;
      m.set(key, (m.get(key) ?? 0) + 1);
    }
    return m;
  }, [subscriptions]);

  const handleDelete = async (id: string) => {
    try {
      await softDelete(id);
      toast({ title: "Adresse supprimée" });
    } catch (e: any) {
      toast({ title: "Erreur", description: e?.message, variant: "destructive" });
    }
  };

  const notifyClient = (id: string, addr: any) => {
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">
          Adresses de service ({addresses.length})
        </h3>
      </div>

      {/* Composant partagé : liste + création inline via son dialog */}
      <ServiceAddressPicker
        key={pickerKey}
        accountId={account?.id}
        value={selectedId ?? undefined}
        mode="cards"
        allowCreate
        label={undefined}
        emptyLabel={isLoading ? "Chargement…" : "Aucune adresse enregistrée"}
        onChange={(id, addr) => {
          setSelectedId(id);
          // Nouvelle adresse fraîchement créée ? Notifier le client.
          if (!addresses.some((a) => a.id === id)) notifyClient(id, addr);
          setPickerKey((k) => k + 1);
        }}
      />

      {/* Détail par adresse (composant partagé AddressBlock) */}
      {addresses.map((addr) => (
        <AddressBlock
          key={addr.id}
          address={addr}
          badges={
            <Badge variant="outline" className="text-[10px]">
              {countBySa.get(addr.id) ?? 0} service(s) actif(s)
            </Badge>
          }
          actions={
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive hover:bg-destructive/10 h-8 w-8"
              onClick={() => handleDelete(addr.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          }
        >
          <p className="text-xs text-muted-foreground">
            Créée le {new Date(addr.created_at).toLocaleDateString("fr-CA")}
            {addr.created_via ? ` • via ${addr.created_via}` : ""}
          </p>
          {addr.contact_name && (
            <p className="text-xs">Contact: {addr.contact_name}{addr.contact_phone ? ` • ${addr.contact_phone}` : ""}</p>
          )}
        </AddressBlock>
      ))}
    </div>
  );
}
