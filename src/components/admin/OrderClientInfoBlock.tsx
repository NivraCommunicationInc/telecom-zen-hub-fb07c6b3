import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { User, Edit2, Mail, Phone, MapPin, AlertTriangle, CheckCircle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminClient as supabase } from "@/integrations/backend";
import { useToast } from "@/hooks/use-toast";

interface ClientInfo {
  full_name: string;
  email: string;
  phone: string;
  date_of_birth: string;
  service_address: string;
  billing_address: string;
}

interface OrderClientInfoBlockProps {
  orderId: string;
  userId: string;
  orderProfile?: {
    full_name?: string;
    email?: string;
    phone?: string;
    service_address?: string;
    billing_address?: string;
  } | null;
  onInfoUpdated?: () => void;
}

const REQUIRED_FIELDS = ["full_name", "email", "phone", "service_address", "billing_address"] as const;

/**
 * Resolves client data with priority: snapshot → order direct fields → profile → fallback
 * v2.2: Now also reads from order direct fields (client_email, client_full_address, etc.)
 */
const resolveClientData = (
  snapshot: Record<string, any> | null,
  profile: Record<string, any> | null,
  orderDirect?: Record<string, any> | null
): ClientInfo => {
  const resolve = (fields: string[], fallback = ""): string => {
    // Priority 1: Snapshot
    for (const field of fields) {
      if (snapshot?.[field] && String(snapshot[field]).trim()) {
        return String(snapshot[field]).trim();
      }
    }
    // Priority 2: Order direct fields
    for (const field of fields) {
      if (orderDirect?.[field] && String(orderDirect[field]).trim()) {
        return String(orderDirect[field]).trim();
      }
    }
    // Priority 3: Profile
    for (const field of fields) {
      if (profile?.[field] && String(profile[field]).trim()) {
        return String(profile[field]).trim();
      }
    }
    return fallback;
  };

  // Build composite address from snapshot components if full_service_address is not available
  const buildAddressFromComponents = (): string => {
    const components = [
      snapshot?.service_apartment ? `${snapshot.service_apartment} - ` : '',
      snapshot?.service_address || snapshot?.serviceAddress || '',
      snapshot?.service_city || snapshot?.serviceCity || '',
      snapshot?.service_province || snapshot?.serviceProvince || '',
      snapshot?.service_postal_code || snapshot?.servicePostalCode || '',
    ].filter(Boolean);
    
    if (components.length >= 2) {
      return components.join(', ').replace(', ,', ',').trim();
    }
    return '';
  };
  
  // Build address from order direct fields
  const buildAddressFromOrderDirect = (): string => {
    if (orderDirect?.client_full_address) {
      return String(orderDirect.client_full_address).trim();
    }
    const components = [
      orderDirect?.shipping_address,
      orderDirect?.shipping_city,
      orderDirect?.shipping_province,
      orderDirect?.shipping_postal_code,
    ].filter(Boolean);
    
    if (components.length >= 2) {
      return components.join(', ').trim();
    }
    return '';
  };

  // Build full name from order direct fields
  const buildNameFromOrderDirect = (): string => {
    if (orderDirect?.client_first_name || orderDirect?.client_last_name) {
      return `${orderDirect.client_first_name || ''} ${orderDirect.client_last_name || ''}`.trim();
    }
    return '';
  };

  // Priority: full_service_address → built from components → order direct → profile
  const serviceAddress = 
    resolve(["full_service_address", "fullServiceAddress"]) ||
    buildAddressFromComponents() ||
    buildAddressFromOrderDirect() ||
    resolve(["serviceAddress", "service_address", "address"]);
  
  return {
    full_name: resolve(["legalName", "full_name", "fullName"]) || buildNameFromOrderDirect(),
    email: resolve(["email", "client_email"]),
    phone: resolve(["phone", "telephone", "client_phone"]),
    date_of_birth: resolve(["dateOfBirth", "date_of_birth", "birthDate", "client_dob"]),
    service_address: serviceAddress,
    billing_address: resolve(["billingAddress", "billing_address"]) || serviceAddress,
  };
};

/**
 * Validates client info and returns missing fields
 */
const validateClientInfo = (info: ClientInfo): { isValid: boolean; missingFields: string[] } => {
  const fieldLabels: Record<string, string> = {
    full_name: "Nom complet",
    email: "Email",
    phone: "Téléphone",
    service_address: "Adresse de service",
    billing_address: "Adresse de facturation",
  };
  
  const missingFields: string[] = [];
  
  for (const field of REQUIRED_FIELDS) {
    if (!info[field] || !info[field].trim()) {
      missingFields.push(fieldLabels[field]);
    }
  }
  
  return {
    isValid: missingFields.length === 0,
    missingFields,
  };
};

export const OrderClientInfoBlock = ({
  orderId,
  userId,
  orderProfile,
  onInfoUpdated,
}: OrderClientInfoBlockProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState<ClientInfo>({
    full_name: "",
    email: "",
    phone: "",
    date_of_birth: "",
    service_address: "",
    billing_address: "",
  });

  // Fetch order snapshot
  const { data: orderSnapshot, refetch: refetchSnapshot } = useQuery({
    queryKey: ["order-snapshot", orderId],
    enabled: !!orderId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_snapshots")
        .select("*")
        .eq("order_id", orderId)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Fetch order direct fields (v2.2 - fallback when snapshot missing)
  const { data: orderDirect, refetch: refetchOrderDirect } = useQuery({
    queryKey: ["order-direct-fields", orderId],
    enabled: !!orderId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("client_first_name, client_last_name, client_dob, client_phone, client_email, client_full_address, shipping_address, shipping_city, shipping_province, shipping_postal_code")
        .eq("id", orderId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Fetch live profile as fallback
  const { data: liveProfile, refetch: refetchProfile } = useQuery({
    queryKey: ["client-profile-for-order", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Resolve client info with priority: snapshot → order direct → profile
  const clientSnapshot = (orderSnapshot?.client_snapshot || {}) as Record<string, any>;
  const profile = liveProfile || orderProfile || {};
  const clientInfo = resolveClientData(clientSnapshot, profile as Record<string, any>, orderDirect as Record<string, any> | null);
  const validation = validateClientInfo(clientInfo);

  // Initialize edit form when opening dialog
  useEffect(() => {
    if (editDialogOpen) {
      setEditForm({ ...clientInfo });
    }
  }, [editDialogOpen]);

  // Mutation to update both profile and snapshot
  const updateClientInfoMutation = useMutation({
    mutationFn: async (formData: ClientInfo) => {
      // 1. Update the profile
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: formData.full_name,
          email: formData.email,
          phone: formData.phone,
          service_address: formData.service_address,
          billing_address: formData.billing_address,
        })
        .eq("user_id", userId);

      if (profileError) throw profileError;

      // 2. Update the order snapshot (client_snapshot JSONB)
      if (orderSnapshot?.id) {
        const updatedClientSnapshot = {
          ...clientSnapshot,
          legalName: formData.full_name,
          full_name: formData.full_name,
          email: formData.email,
          phone: formData.phone,
          serviceAddress: formData.service_address,
          service_address: formData.service_address,
          billingAddress: formData.billing_address,
          billing_address: formData.billing_address,
        };

        const { error: snapshotError } = await supabase
          .from("order_snapshots")
          .update({ client_snapshot: updatedClientSnapshot })
          .eq("id", orderSnapshot.id);

        if (snapshotError) throw snapshotError;
      } else {
        // Create new snapshot if none exists
        const newClientSnapshot = {
          legalName: formData.full_name,
          full_name: formData.full_name,
          email: formData.email,
          phone: formData.phone,
          serviceAddress: formData.service_address,
          service_address: formData.service_address,
          billingAddress: formData.billing_address,
          billing_address: formData.billing_address,
        };

        const { error: insertError } = await supabase
          .from("order_snapshots")
          .insert({
            order_id: orderId,
            version: 1,
            client_snapshot: newClientSnapshot,
          });

        if (insertError) throw insertError;
      }

      return formData;
    },
    onSuccess: () => {
      toast({
        title: "Informations mises à jour",
        description: "Le profil et le snapshot de la commande ont été mis à jour.",
      });
      setEditDialogOpen(false);
      refetchSnapshot();
      refetchProfile();
      refetchOrderDirect();
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      queryClient.invalidateQueries({ queryKey: ["order-details", orderId] });
      queryClient.invalidateQueries({ queryKey: ["order-direct-fields", orderId] });
      onInfoUpdated?.();
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de mettre à jour les informations.",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    const formValidation = validateClientInfo(editForm);
    if (!formValidation.isValid) {
      toast({
        title: "Champs obligatoires manquants",
        description: `Veuillez remplir: ${formValidation.missingFields.join(", ")}`,
        variant: "destructive",
      });
      return;
    }
    updateClientInfoMutation.mutate(editForm);
  };

  const dataSource = orderSnapshot?.client_snapshot ? "Snapshot" : "Profil";

  return (
    <>
      <Card className={`border-2 ${validation.isValid ? "border-emerald-500/30 bg-emerald-500/5" : "border-destructive/30 bg-destructive/5"}`}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Informations du client
              <Badge variant="outline" className="text-xs">
                {dataSource}
              </Badge>
              {validation.isValid ? (
                <Badge className="bg-emerald-500/20 text-emerald-500 text-xs">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Complet
                </Badge>
              ) : (
                <Badge variant="destructive" className="text-xs">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  Incomplet
                </Badge>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditDialogOpen(true)}
              className="gap-1"
            >
              <Edit2 className="w-3 h-3" />
              Modifier
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Validation Warning */}
          {!validation.isValid && (
            <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
              <p className="text-sm text-destructive font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Génération de contrat bloquée
              </p>
              <p className="text-xs text-destructive/80 mt-1">
                Champs manquants: {validation.missingFields.join(", ")}
              </p>
            </div>
          )}

          {/* Client Info Grid */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <User className="w-3 h-3" />
                Nom complet
              </Label>
              <p className={`font-medium ${!clientInfo.full_name ? "text-destructive" : ""}`}>
                {clientInfo.full_name || "—"}
              </p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Mail className="w-3 h-3" />
                Email
              </Label>
              <p className={`font-medium ${!clientInfo.email ? "text-destructive" : ""}`}>
                {clientInfo.email || "—"}
              </p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Phone className="w-3 h-3" />
                Téléphone
              </Label>
              <p className={`font-medium ${!clientInfo.phone ? "text-destructive" : ""}`}>
                {clientInfo.phone || "—"}
              </p>
            </div>
            <div className="col-span-2">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                Adresse de service
              </Label>
              <p className={`font-medium ${!clientInfo.service_address ? "text-destructive" : ""}`}>
                {clientInfo.service_address || "—"}
              </p>
            </div>
            <div className="col-span-2">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                Adresse de facturation
              </Label>
              <p className={`font-medium ${!clientInfo.billing_address ? "text-destructive" : ""}`}>
                {clientInfo.billing_address || "—"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="w-5 h-5" />
              Modifier les informations du client
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="full_name">Nom complet *</Label>
              <Input
                id="full_name"
                value={editForm.full_name}
                onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                placeholder="Prénom Nom"
              />
            </div>

            <div>
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                placeholder="client@email.com"
              />
            </div>

            <div>
              <Label htmlFor="phone">Téléphone *</Label>
              <Input
                id="phone"
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                placeholder="514-123-4567"
              />
            </div>

            <div>
              <Label htmlFor="service_address">Adresse de service *</Label>
              <Input
                id="service_address"
                value={editForm.service_address}
                onChange={(e) => setEditForm({ ...editForm, service_address: e.target.value })}
                placeholder="123 Rue Exemple, Montréal, QC H2X 1Y4"
              />
            </div>

            <div>
              <Label htmlFor="billing_address">Adresse de facturation *</Label>
              <Input
                id="billing_address"
                value={editForm.billing_address}
                onChange={(e) => setEditForm({ ...editForm, billing_address: e.target.value })}
                placeholder="Même que service ou différente"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Laissez vide pour utiliser l'adresse de service.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleSave}
              disabled={updateClientInfoMutation.isPending}
            >
              {updateClientInfoMutation.isPending ? "Sauvegarde..." : "Sauvegarder"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default OrderClientInfoBlock;
