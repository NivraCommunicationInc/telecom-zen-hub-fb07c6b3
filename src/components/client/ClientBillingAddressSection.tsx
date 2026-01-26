import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { portalClient as supabase } from "@/integrations/backend";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Building2, Save, Loader2, MapPin } from "lucide-react";
import { AddressAutocomplete, type AddressValue } from "@/components/shared/AddressAutocomplete";
import { formatPostalCode } from "@/components/shared/AddressTypes";

interface ClientBillingAddressSectionProps {
  userId: string;
  serviceAddress?: string;
  serviceCity?: string;
  servicePostalCode?: string;
}

export const ClientBillingAddressSection = ({
  userId,
  serviceAddress,
  serviceCity,
  servicePostalCode,
}: ClientBillingAddressSectionProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [useSameAddress, setUseSameAddress] = useState(true);
  const [billingData, setBillingData] = useState({
    billing_address: "",
    billing_city: "",
    billing_province: "QC",
    billing_postal_code: "",
  });

  // Fetch account with billing address
  const { data: account, isLoading } = useQuery({
    queryKey: ["client-account-billing", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts")
        .select("id, billing_address, billing_city, billing_province, billing_postal_code")
        .eq("client_id", userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  // Initialize form data
  useEffect(() => {
    if (account) {
      const hasBillingAddress = !!(
        account.billing_address ||
        account.billing_city ||
        account.billing_postal_code
      );
      
      setUseSameAddress(!hasBillingAddress);
      
      if (hasBillingAddress) {
        setBillingData({
          billing_address: account.billing_address || "",
          billing_city: account.billing_city || "",
          billing_province: account.billing_province || "QC",
          billing_postal_code: account.billing_postal_code || "",
        });
      }
    }
  }, [account]);

  // Update billing address
  const updateMutation = useMutation({
    mutationFn: async (data: typeof billingData | null) => {
      if (!account?.id) throw new Error("No account found");
      
      const updateData = data || {
        billing_address: null,
        billing_city: null,
        billing_province: null,
        billing_postal_code: null,
      };

      const { error } = await supabase
        .from("accounts")
        .update(updateData)
        .eq("id", account.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-account-billing"] });
      toast({ title: "Adresse de facturation mise à jour" });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleToggleSameAddress = (checked: boolean) => {
    setUseSameAddress(checked);
    if (checked) {
      // Clear billing address when using same as service
      updateMutation.mutate(null);
    }
  };

  const handleSave = () => {
    updateMutation.mutate(billingData);
  };

  const handleAddressSelect = (details: AddressValue) => {
    setBillingData({
      billing_address: details.line1 || details.formatted,
      billing_city: details.city || billingData.billing_city,
      billing_province: details.region || "QC",
      billing_postal_code: details.postalCode || billingData.billing_postal_code,
    });
  };

  if (isLoading) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!account) {
    return null; // No account yet
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-cyan-400" />
          Adresse de facturation
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Toggle for same address */}
        <div className="flex items-center space-x-3 p-3 rounded-lg bg-accent/50">
          <Checkbox
            id="same-address"
            checked={useSameAddress}
            onCheckedChange={(checked) => handleToggleSameAddress(!!checked)}
          />
          <div className="flex-1">
            <label
              htmlFor="same-address"
              className="text-sm font-medium cursor-pointer"
            >
              Utiliser l'adresse de service
            </label>
            {useSameAddress && serviceAddress && (
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {serviceAddress}, {serviceCity}
              </p>
            )}
          </div>
        </div>

        {/* Billing address form */}
        {!useSameAddress && (
          <div className="space-y-4 pt-2">
            <div>
              <Label>Adresse de facturation</Label>
              <AddressAutocomplete
                value={billingData.billing_address}
                onValueChange={(value) =>
                  setBillingData({ ...billingData, billing_address: value })
                }
                onSelect={handleAddressSelect}
                placeholder="Rechercher une adresse..."
                restrictToQuebec={true}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Ville</Label>
                <Input
                  value={billingData.billing_city}
                  onChange={(e) =>
                    setBillingData({ ...billingData, billing_city: e.target.value })
                  }
                  placeholder="Montréal"
                />
              </div>
              <div>
                <Label>Code postal</Label>
                <Input
                  value={billingData.billing_postal_code}
                  onChange={(e) =>
                    setBillingData({
                      ...billingData,
                      billing_postal_code: formatPostalCode(e.target.value),
                    })
                  }
                  placeholder="H2X 1Y4"
                  maxLength={7}
                />
              </div>
            </div>

            <Button
              onClick={handleSave}
              disabled={updateMutation.isPending}
              className="w-full"
            >
              {updateMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Enregistrer
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ClientBillingAddressSection;
