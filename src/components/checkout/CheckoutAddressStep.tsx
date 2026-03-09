/**
 * CheckoutAddressStep - Address selection/creation step for checkout.
 * Lets user pick an existing address or add a new one.
 * For internet/tv/combo: required. For mobile: optional.
 */
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useQuery } from "@tanstack/react-query";
import { portalClient as supabase } from "@/integrations/backend";
import { AddressAutocomplete, type AddressValue } from "@/components/shared/AddressAutocomplete";
import { formatPostalCode } from "@/components/shared/AddressTypes";
import {
  MapPin, Plus, Star, Loader2, Home, AlertCircle, Check
} from "lucide-react";

interface CheckoutAddressStepProps {
  userId: string;
  category: string; // 'internet' | 'tv' | 'combo' | 'mobile'
  selectedAddressId: string | null;
  onAddressSelected: (addressId: string, addressLine: string, city: string, postalCode: string) => void;
  /** If new address created, pass back for order storage */
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
  const [showNewForm, setShowNewForm] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newCity, setNewCity] = useState("");
  const [newPostalCode, setNewPostalCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Fetch account
  const { data: account } = useQuery({
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

  // Fetch addresses
  const { data: addresses = [], isLoading, refetch } = useQuery({
    queryKey: ["checkout-addresses", account?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_addresses")
        .select("*")
        .eq("account_id", account!.id)
        .eq("is_active", true)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!account?.id,
  });

  // Auto-select default address
  useEffect(() => {
    if (!selectedAddressId && addresses.length > 0) {
      const defaultAddr = addresses.find((a: any) => a.is_default) || addresses[0];
      if (defaultAddr) {
        onAddressSelected(
          defaultAddr.id,
          defaultAddr.address_line,
          defaultAddr.city || "",
          defaultAddr.postal_code || ""
        );
      }
    }
  }, [addresses, selectedAddressId]);

  const handleAddressSelect = (details: AddressValue) => {
    setNewAddress(details.line1);
    if (details.city) setNewCity(details.city);
    if (details.postalCode) setNewPostalCode(details.postalCode);
    if (!newLabel && details.city) setNewLabel(details.city);
  };

  const handleSaveNew = async () => {
    if (!newAddress.trim() || !newCity.trim() || !newPostalCode.trim()) {
      setError("Veuillez remplir tous les champs obligatoires.");
      return;
    }

    // If no account yet, create one first
    let accountId = account?.id;
    if (!accountId) {
      try {
        const { data: newAcct, error: acctErr } = await supabase
          .from("accounts")
          .insert({
            client_id: userId,
            account_number: generateAccountNumber(),
            status: "active",
          })
          .select("id")
          .single();
        if (acctErr) throw acctErr;
        accountId = newAcct.id;
      } catch (e: any) {
        setError("Impossible de créer le compte. " + (e.message || ""));
        return;
      }
    }

    setSaving(true);
    setError("");

    try {
      const { data, error: err } = await supabase
        .from("service_addresses")
        .insert({
          account_id: accountId,
          label: newLabel.trim() || newCity.trim(),
          address_line: newAddress.trim(),
          city: newCity.trim(),
          province: "QC",
          postal_code: formatPostalCode(newPostalCode),
        })
        .select("id, address_line, city, postal_code")
        .single();

      if (err) {
        if (err.code === "23505") {
          setError("Cette adresse existe déjà dans votre compte. Sélectionnez-la dans la liste.");
          setSaving(false);
          return;
        }
        throw err;
      }

      onAddressSelected(data.id, data.address_line, data.city || "", data.postal_code || "");
      onNewAddressCreated?.(data.id);
      setShowNewForm(false);
      refetch();
    } catch (e: any) {
      setError(e.message || "Erreur");
    } finally {
      setSaving(false);
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
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : addresses.length > 0 ? (
          <RadioGroup
            value={selectedAddressId || ""}
            onValueChange={(id) => {
              const addr = addresses.find((a: any) => a.id === id);
              if (addr) {
                onAddressSelected(addr.id, addr.address_line, addr.city || "", addr.postal_code || "");
              }
            }}
            className="space-y-2"
          >
            {addresses.map((addr: any) => (
              <label
                key={addr.id}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedAddressId === addr.id
                    ? "border-cyan-500 bg-cyan-500/5"
                    : "border-border hover:border-muted-foreground/30"
                }`}
              >
                <RadioGroupItem value={addr.id} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{addr.label}</span>
                    {addr.is_default && (
                      <Badge variant="secondary" className="text-xs gap-1">
                        <Star className="w-3 h-3" /> Défaut
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {addr.address_line}, {addr.city} {addr.postal_code}
                  </p>
                </div>
                {selectedAddressId === addr.id && (
                  <Check className="w-4 h-4 text-cyan-500 shrink-0" />
                )}
              </label>
            ))}
          </RadioGroup>
        ) : (
          <div className="text-center py-4">
            <Home className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Aucune adresse enregistrée</p>
          </div>
        )}

        {!showNewForm ? (
          <Button variant="outline" size="sm" onClick={() => setShowNewForm(true)} className="w-full">
            <Plus className="w-4 h-4 mr-1" /> Ajouter une nouvelle adresse
          </Button>
        ) : (
          <div className="space-y-3 p-3 rounded-lg border border-dashed border-cyan-500/40 bg-accent/30">
            <p className="text-sm font-medium">Nouvelle adresse</p>
            <div>
              <Label className="text-xs">Nom / étiquette</Label>
              <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Maison, Bureau..." className="h-9" />
            </div>
            <div>
              <Label className="text-xs">Adresse <span className="text-destructive">*</span></Label>
              <AddressAutocomplete
                value={newAddress}
                onValueChange={setNewAddress}
                onSelect={handleAddressSelect}
                placeholder="Rechercher une adresse..."
                restrictToQuebec={true}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Ville <span className="text-destructive">*</span></Label>
                <Input value={newCity} onChange={(e) => setNewCity(e.target.value)} placeholder="Montréal" className="h-9" />
              </div>
              <div>
                <Label className="text-xs">Code postal <span className="text-destructive">*</span></Label>
                <Input
                  value={newPostalCode}
                  onChange={(e) => setNewPostalCode(formatPostalCode(e.target.value))}
                  placeholder="H2X 1Y4"
                  maxLength={7}
                  className="h-9"
                />
              </div>
            </div>
            {error && (
              <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 rounded p-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
              </div>
            )}
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSaveNew} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Check className="w-4 h-4 mr-1" />}
                Ajouter
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowNewForm(false)}>Annuler</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CheckoutAddressStep;
