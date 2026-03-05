/**
 * Client Portal - Manage Service Addresses
 * Route: /portal/service-addresses
 * CRUD for service_addresses linked to the client's account.
 */
import { useEffect, useState } from "react";
import ClientLayout from "@/components/client/ClientLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useClientAuth } from "@/hooks/useClientAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { portalClient as supabase } from "@/integrations/backend";
import { AddressAutocomplete, type AddressValue } from "@/components/shared/AddressAutocomplete";
import { formatPostalCode } from "@/components/shared/AddressTypes";
import { toast } from "sonner";
import {
  MapPin, Plus, Star, Trash2, Loader2, Home, Building2, Edit2, Check, X, AlertCircle
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";

interface ServiceAddress {
  id: string;
  account_id: string;
  label: string;
  address_line: string;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  is_default: boolean;
  is_active: boolean;
  address_hash: string | null;
  created_at: string | null;
}

const ClientServiceAddresses = () => {
  const { user } = useClientAuth();
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Fetch account
  const { data: account } = useQuery({
    queryKey: ["client-account-for-addresses", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts")
        .select("id")
        .eq("client_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch billing customer (for subscription counts)
  const { data: billingCustomer } = useQuery({
    queryKey: ["billing-customer-for-addresses", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("billing_customers")
        .select("id")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch addresses (with explicit count for audit/debug visibility)
  const { data: addressesPayload, isLoading } = useQuery({
    queryKey: ["service-addresses", account?.id],
    queryFn: async () => {
      const { data, error, count } = await supabase
        .from("service_addresses")
        .select("*", { count: "exact" })
        .eq("account_id", account!.id)
        .eq("is_active", true)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return {
        account_id: account!.id,
        rows: (data || []) as ServiceAddress[],
        count: count ?? 0,
      };
    },
    enabled: !!account?.id,
  });

  const addresses = addressesPayload?.rows || [];
  const addressesCount = addressesPayload?.count ?? 0;

  // Count active/pending/suspended services per address
  const { data: addressServiceCounts = {} } = useQuery({
    queryKey: ["address-service-counts", billingCustomer?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("billing_subscriptions")
        .select("address_id")
        .eq("customer_id", billingCustomer!.id)
        .in("status", ["active", "pending", "suspended"])
        .not("address_id", "is", null);
      if (error) throw error;

      return (data || []).reduce((acc, row: { address_id: string | null }) => {
        if (!row.address_id) return acc;
        acc[row.address_id] = (acc[row.address_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
    },
    enabled: !!billingCustomer?.id,
  });

  useEffect(() => {
    if (import.meta.env.PROD) return;
    if (!account?.id) return;
    console.info("[AUDIT][service-addresses]", {
      account_id: account.id,
      count: addressesCount,
      rows: addresses,
    });
  }, [account?.id, addressesCount, addresses]);

  return (
    <ClientLayout>
      <div className="max-w-3xl mx-auto space-y-6 p-4 md:p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <MapPin className="w-6 h-6 text-cyan-500" />
              Mes adresses de service
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Gérez les adresses où vos services sont installés
            </p>
          </div>
          <Button onClick={() => setShowAdd(true)} disabled={showAdd} size="sm">
            <Plus className="w-4 h-4 mr-1" /> Ajouter
          </Button>
        </div>

        {showAdd && account && (
          <AddressForm
            accountId={account.id}
            onDone={() => { setShowAdd(false); queryClient.invalidateQueries({ queryKey: ["service-addresses"] }); }}
            onCancel={() => setShowAdd(false)}
          />
        )}

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : addresses.length === 0 && !showAdd ? (
          <Card className="bg-card border-border">
            <CardContent className="py-12 text-center">
              <Home className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">Aucune adresse enregistrée</p>
              <Button onClick={() => setShowAdd(true)} variant="outline" className="mt-4">
                <Plus className="w-4 h-4 mr-1" /> Ajouter une adresse
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {addresses.map((addr) => (
              editingId === addr.id ? (
                <AddressForm
                  key={addr.id}
                  accountId={addr.account_id}
                  existing={addr}
                  onDone={() => { setEditingId(null); queryClient.invalidateQueries({ queryKey: ["service-addresses"] }); }}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <AddressCard
                  key={addr.id}
                  address={addr}
                  serviceCount={addressServiceCounts[addr.id] || 0}
                  onEdit={() => setEditingId(addr.id)}
                  onSetDefault={() => {
                    supabase
                      .from("service_addresses")
                      .update({ is_default: true })
                      .eq("id", addr.id)
                      .then(() => {
                        queryClient.invalidateQueries({ queryKey: ["service-addresses"] });
                        toast.success("Adresse par défaut mise à jour");
                      });
                  }}
                  onDeactivate={async () => {
                    const { error } = await supabase
                      .from("service_addresses")
                      .update({ is_active: false })
                      .eq("id", addr.id);
                    if (error) {
                      toast.error("Impossible de retirer cette adresse");
                    } else {
                      queryClient.invalidateQueries({ queryKey: ["service-addresses"] });
                      toast.success("Adresse retirée");
                    }
                  }}
                />
              )
            ))}
          </div>
        )}
      </div>
    </ClientLayout>
  );
};

// --- Address Card ---
const AddressCard = ({
  address, serviceCount, onEdit, onSetDefault, onDeactivate
}: {
  address: ServiceAddress;
  serviceCount: number;
  onEdit: () => void;
  onSetDefault: () => void;
  onDeactivate: () => void;
}) => (
  <Card className="bg-card border-border">
    <CardContent className="p-4 flex items-start gap-4">
      <div className="rounded-full bg-accent p-2.5 mt-0.5">
        <MapPin className="w-5 h-5 text-cyan-500" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-sm">{address.label}</span>
          {address.is_default && (
            <Badge variant="secondary" className="text-xs gap-1">
              <Star className="w-3 h-3" /> Par défaut
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {address.address_line}
        </p>
        <p className="text-xs text-muted-foreground">
          {address.city}{address.province ? `, ${address.province}` : ""} {address.postal_code}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {serviceCount} service{serviceCount > 1 ? "s" : ""}
        </p>
      </div>
      <div className="flex gap-1 shrink-0">
        {!address.is_default && (
          <Button variant="ghost" size="icon" onClick={onSetDefault} title="Définir par défaut">
            <Star className="w-4 h-4" />
          </Button>
        )}
        <Button variant="ghost" size="icon" onClick={onEdit} title="Modifier">
          <Edit2 className="w-4 h-4" />
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" title="Retirer">
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Retirer cette adresse?</AlertDialogTitle>
              <AlertDialogDescription>
                L'adresse sera désactivée mais les services existants ne seront pas affectés.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction onClick={onDeactivate}>Confirmer</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </CardContent>
  </Card>
);

// --- Address Form (Add/Edit) ---
const AddressForm = ({
  accountId, existing, onDone, onCancel
}: {
  accountId: string;
  existing?: ServiceAddress;
  onDone: () => void;
  onCancel: () => void;
}) => {
  const [label, setLabel] = useState(existing?.label || "");
  const [addressLine, setAddressLine] = useState(existing?.address_line || "");
  const [city, setCity] = useState(existing?.city || "");
  const [province] = useState(existing?.province || "QC");
  const [postalCode, setPostalCode] = useState(existing?.postal_code || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleAddressSelect = (details: AddressValue) => {
    setAddressLine(details.line1);
    if (details.city) setCity(details.city);
    if (details.postalCode) setPostalCode(details.postalCode);
    if (!label && details.city) setLabel(details.city);
  };

  const handleSave = async () => {
    if (!addressLine.trim() || !city.trim() || !postalCode.trim()) {
      setError("Veuillez remplir tous les champs obligatoires.");
      return;
    }
    setSaving(true);
    setError("");

    const payload = {
      label: label.trim() || city.trim(),
      address_line: addressLine.trim(),
      city: city.trim(),
      province,
      postal_code: formatPostalCode(postalCode),
    };

    try {
      if (existing) {
        const { error: err } = await supabase
          .from("service_addresses")
          .update(payload)
          .eq("id", existing.id);
        if (err) throw err;
        toast.success("Adresse mise à jour");
      } else {
        const { error: err } = await supabase
          .from("service_addresses")
          .insert({ ...payload, account_id: accountId });
        if (err) {
          if (err.code === "23505") {
            setError("Cette adresse existe déjà dans votre compte.");
            setSaving(false);
            return;
          }
          throw err;
        }
        toast.success("Adresse ajoutée");
      }
      onDone();
    } catch (e: any) {
      setError(e.message || "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="bg-card border-border border-cyan-500/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Building2 className="w-4 h-4 text-cyan-500" />
          {existing ? "Modifier l'adresse" : "Nouvelle adresse"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label>Nom / étiquette</Label>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex: Maison, Bureau, Chalet" />
        </div>
        <div>
          <Label>Adresse (numéro + rue) <span className="text-destructive">*</span></Label>
          <AddressAutocomplete
            value={addressLine}
            onValueChange={setAddressLine}
            onSelect={handleAddressSelect}
            placeholder="Rechercher une adresse..."
            restrictToQuebec={true}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Ville <span className="text-destructive">*</span></Label>
            <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Montréal" />
          </div>
          <div>
            <Label>Code postal <span className="text-destructive">*</span></Label>
            <Input
              value={postalCode}
              onChange={(e) => setPostalCode(formatPostalCode(e.target.value))}
              placeholder="H2X 1Y4"
              maxLength={7}
            />
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-md p-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <Button onClick={handleSave} disabled={saving} size="sm">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Check className="w-4 h-4 mr-1" />}
            {existing ? "Enregistrer" : "Ajouter"}
          </Button>
          <Button variant="ghost" onClick={onCancel} size="sm">
            <X className="w-4 h-4 mr-1" /> Annuler
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ClientServiceAddresses;
