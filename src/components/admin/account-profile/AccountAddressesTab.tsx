/**
 * AccountAddressesTab — Manage account service locations
 */
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { MapPin, Plus, Trash2, Edit, Home, Building } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { adminClient as supabase } from "@/integrations/backend";
import { supabase as clientSupabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AddressAutocomplete, type AddressValue } from "@/components/shared/AddressAutocomplete";

interface AccountAddressesTabProps {
  account: any;
  locations: any[];
  subscriptions: any[];
}

export function AccountAddressesTab({ account, locations, subscriptions }: AccountAddressesTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [newLoc, setNewLoc] = useState({ label: "", service_address: "", service_city: "", service_postal_code: "" });

  const addMutation = useMutation({
    mutationFn: async (data: typeof newLoc) => {
      // R1 canonical write via RPC (account_service_locations INSERTs are blocked)
      const { error } = await supabase.rpc("resolve_or_create_service_address", {
        p_account_id: account.id,
        p_address: data.service_address,
        p_city: data.service_city,
        p_province: "QC",
        p_postal: data.service_postal_code,
        p_created_via: "admin",
        p_label: data.label || null,
      });
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["account-profile-locations"] });
      toast({ title: "Adresse ajoutée" });
      setAddOpen(false);
      setNewLoc({ label: "", service_address: "", service_city: "", service_postal_code: "" });
      // Notify client — fire and forget, address is already saved
      clientSupabase.functions.invoke("account-ops-actions", {
        body: {
          action: "notify_address_change",
          client_user_id: account.user_id,
          new_address: variables.service_address,
          new_city: variables.service_city,
          new_postal: variables.service_postal_code,
          old_address: account.primary_service_address || undefined,
        },
      }).catch(() => {});
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // R1: soft-delete on canonical service_addresses
      const { error } = await supabase
        .from("service_addresses")
        .update({ is_active: false, deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["account-profile-locations"] });
      toast({ title: "Adresse supprimée" });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  // Count services per address
  const servicesAtAddress = (addressId: string | null) => {
    return subscriptions.filter((s: any) => s.address_id === addressId).length;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Adresses de service ({locations.length + 1})</h3>
        <Button variant="outline" size="sm" onClick={() => setAddOpen(true)} className="gap-1.5 text-xs">
          <Plus className="h-3.5 w-3.5" />
          Ajouter une adresse
        </Button>
      </div>

      {/* Primary address */}
      <Card className="border-primary/30">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center">
                <Home className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Badge>Principal</Badge>
                  <Badge variant="outline" className="text-[10px]">Facturation</Badge>
                </div>
                <p className="text-sm font-medium">
                  {account.primary_service_address}
                  {account.primary_service_city && `, ${account.primary_service_city}`}
                  {account.primary_service_postal_code && ` ${account.primary_service_postal_code}`}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {servicesAtAddress(null)} service(s) actif(s)
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Additional locations */}
      {locations.map((loc: any) => (
        <Card key={loc.id}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center">
                  <Building className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline">{loc.label}</Badge>
                    {!loc.is_active && <Badge variant="secondary">Inactif</Badge>}
                  </div>
                  <p className="text-sm font-medium">
                    {loc.service_address}
                    {loc.service_city && `, ${loc.service_city}`}
                    {loc.service_postal_code && ` ${loc.service_postal_code}`}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {servicesAtAddress(loc.id)} service(s) actif(s)
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive hover:bg-destructive/10 h-8 w-8"
                onClick={() => deleteMutation.mutate(loc.id)}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Add Address Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter une adresse de service</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Libellé *</Label>
              <Input
                value={newLoc.label}
                onChange={(e) => setNewLoc({ ...newLoc, label: e.target.value })}
                placeholder="ex: Bureau, Chalet, Triplex B"
              />
            </div>
            <div>
              <Label>Adresse *</Label>
              <AddressAutocomplete
                value={newLoc.service_address}
                onValueChange={(v) => setNewLoc({ ...newLoc, service_address: v })}
                onSelect={(d: AddressValue) => {
                  setNewLoc({
                    ...newLoc,
                    service_address: d.formatted || d.line1,
                    service_city: d.city || newLoc.service_city,
                    service_postal_code: d.postalCode || newLoc.service_postal_code,
                  });
                }}
                placeholder="Rechercher une adresse..."
                restrictToQuebec
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Ville</Label>
                <Input value={newLoc.service_city} onChange={(e) => setNewLoc({ ...newLoc, service_city: e.target.value })} />
              </div>
              <div>
                <Label>Code postal</Label>
                <Input value={newLoc.service_postal_code} onChange={(e) => setNewLoc({ ...newLoc, service_postal_code: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Annuler</Button>
            <Button
              onClick={() => addMutation.mutate(newLoc)}
              disabled={addMutation.isPending || !newLoc.label || !newLoc.service_address}
            >
              Ajouter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
