import { useState, useEffect } from "react";
import ClientLayout from "@/components/client/ClientLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useClientAuth } from "@/hooks/useClientAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { portalClient as supabase } from "@/integrations/backend";
import { 
  Package, 
  Plus, 
  ArrowLeft, 
  AlertTriangle, 
  Clock, 
  CheckCircle2, 
  Truck, 
  XCircle,
  Upload,
  RefreshCw
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

const reasonOptions = [
  { value: "defective", label: "Défectueux (problème de fabrication)" },
  { value: "damaged", label: "Endommagé (dommages physiques)" },
  { value: "lost", label: "Perdu" },
  { value: "theft", label: "Volé" },
  { value: "malfunction", label: "Dysfonctionnement" },
  { value: "upgrade", label: "Mise à niveau" },
  { value: "other", label: "Autre / Inconnu" },
];

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  open: { label: "Ouvert", color: "bg-cyan-500/20 text-cyan-400", icon: Clock },
  awaiting_decision: { label: "En attente de décision", color: "bg-amber-500/20 text-amber-500", icon: Clock },
  awaiting_payment: { label: "En attente de paiement", color: "bg-orange-500/20 text-orange-500", icon: AlertTriangle },
  ready_to_ship: { label: "Prêt à expédier", color: "bg-blue-500/20 text-blue-500", icon: Package },
  shipped: { label: "Expédié", color: "bg-purple-500/20 text-purple-400", icon: Truck },
  delivered: { label: "Livré", color: "bg-emerald-500/20 text-emerald-500", icon: CheckCircle2 },
  cancelled: { label: "Annulé", color: "bg-red-500/20 text-red-400", icon: XCircle },
  closed: { label: "Fermé", color: "bg-muted text-muted-foreground", icon: CheckCircle2 },
};

const ClientEquipmentReplacement = () => {
  const { user } = useClientAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);

  // Form state
  const [formData, setFormData] = useState({
    linkedOrderId: "",
    equipmentId: "",
    equipmentName: "",
    equipmentSerial: "",
    reason: "",
    reasonDetails: "",
    preferredAddress: "",
    preferredCity: "",
    preferredPostalCode: "",
    billableAcknowledged: false,
  });

  // Fetch client profile for default address
  const { data: profile } = useQuery({
    queryKey: ["client-profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user?.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch client orders with equipment
  const { data: orders } = useQuery({
    queryKey: ["client-orders-equipment", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      // SECURITY: Always filter by user_id to prevent data leakage
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Fetch replacement tickets
  const { data: tickets, isLoading } = useQuery({
    queryKey: ["client-replacement-tickets", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("replacement_tickets")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Fetch replacement order for selected ticket
  const { data: replacementOrder } = useQuery({
    queryKey: ["replacement-order", selectedTicket?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("replacement_orders")
        .select("*")
        .eq("replacement_ticket_id", selectedTicket?.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!selectedTicket?.id,
  });

  // Set default address from profile
  useEffect(() => {
    if (profile && !formData.preferredAddress) {
      setFormData(prev => ({
        ...prev,
        preferredAddress: profile.service_address || "",
        preferredCity: profile.service_city || "",
        preferredPostalCode: profile.service_postal_code || "",
      }));
    }
  }, [profile]);

  // Update equipment info when order is selected
  const handleOrderSelect = (orderId: string) => {
    const order = orders?.find((o: any) => o.id === orderId);
    if (order) {
      const equipmentDetails = order.equipment_details as any[] || [];
      const firstEquipment = equipmentDetails[0] || {};
      
      setFormData(prev => ({
        ...prev,
        linkedOrderId: orderId,
        equipmentId: order.equipment_id || firstEquipment.id || "",
        equipmentName: firstEquipment.name || order.service_type || "",
        equipmentSerial: order.serial_number || firstEquipment.serial || "",
      }));
    }
  };

  // Create ticket mutation
  const createTicketMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const order = orders?.find((o: any) => o.id === data.linkedOrderId);
      
      const { data: newTicket, error } = await supabase
        .from("replacement_tickets")
        .insert({
          user_id: user?.id,
          client_email: profile?.email,
          linked_order_id: data.linkedOrderId || null,
          linked_order_number: order?.order_number || null,
          equipment_id: data.equipmentId,
          equipment_name: data.equipmentName,
          equipment_serial: data.equipmentSerial,
          reason: data.reason as any,
          reason_details: data.reasonDetails,
          preferred_address: data.preferredAddress,
          preferred_city: data.preferredCity,
          preferred_postal_code: data.preferredPostalCode,
          billable_acknowledged: data.billableAcknowledged,
          status: "open",
        })
        .select()
        .single();
      
      if (error) throw error;
      return newTicket;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-replacement-tickets"] });
      toast({ title: "Demande créée", description: "Votre demande de remplacement a été soumise." });
      setCreateDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      console.error("Create ticket error:", error);
      toast({ title: "Erreur", description: "Impossible de créer la demande.", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      linkedOrderId: "",
      equipmentId: "",
      equipmentName: "",
      equipmentSerial: "",
      reason: "",
      reasonDetails: "",
      preferredAddress: profile?.service_address || "",
      preferredCity: profile?.service_city || "",
      preferredPostalCode: profile?.service_postal_code || "",
      billableAcknowledged: false,
    });
  };

  // Detail view for selected ticket
  if (selectedTicket) {
    const StatusIcon = statusConfig[selectedTicket.status]?.icon || Clock;
    const statusInfo = statusConfig[selectedTicket.status] || statusConfig.open;
    const reasonLabel = reasonOptions.find(r => r.value === selectedTicket.reason)?.label || selectedTicket.reason;

    return (
      <ClientLayout>
        <div className="space-y-6">
          <Button variant="ghost" onClick={() => setSelectedTicket(null)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour aux demandes
          </Button>

          <Card className="bg-card border-border">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <RefreshCw className="w-5 h-5 text-cyan-400" />
                    {selectedTicket.ticket_number}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Créé le {format(new Date(selectedTicket.created_at), "d MMMM yyyy 'à' HH:mm", { locale: fr })}
                  </p>
                </div>
                <Badge className={statusInfo.color}>
                  <StatusIcon className="w-3 h-3 mr-1" />
                  {statusInfo.label}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Equipment Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-accent/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">Équipement</p>
                  <p className="font-medium">{selectedTicket.equipment_name || "—"}</p>
                  {selectedTicket.equipment_serial && (
                    <p className="text-xs text-muted-foreground font-mono mt-1">
                      S/N: {selectedTicket.equipment_serial}
                    </p>
                  )}
                </div>
                <div className="p-4 bg-accent/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">Commande liée</p>
                  <p className="font-medium font-mono">{selectedTicket.linked_order_number || "—"}</p>
                </div>
              </div>

              {/* Reason */}
              <div className="p-4 bg-accent/50 rounded-lg">
                <p className="text-sm text-muted-foreground">Raison du remplacement</p>
                <p className="font-medium">{reasonLabel}</p>
                {selectedTicket.reason_details && (
                  <p className="text-sm mt-2">{selectedTicket.reason_details}</p>
                )}
              </div>

              {/* Delivery Address */}
              <div className="p-4 bg-accent/50 rounded-lg">
                <p className="text-sm text-muted-foreground">Adresse de livraison préférée</p>
                <p className="font-medium">
                  {[selectedTicket.preferred_address, selectedTicket.preferred_city, selectedTicket.preferred_postal_code]
                    .filter(Boolean)
                    .join(", ") || "Adresse de service par défaut"}
                </p>
              </div>

              {/* Replacement Order Status */}
              {replacementOrder && (
                <div className="border border-border rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Commande de remplacement</h3>
                    <Badge variant="outline" className="font-mono">
                      {replacementOrder.order_number}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Type</p>
                      <p className="font-medium">
                        {replacementOrder.order_type === "warranty_replacement" 
                          ? "Remplacement sous garantie" 
                          : "Remplacement payant"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Statut</p>
                      <Badge className={statusConfig[replacementOrder.status]?.color || "bg-muted"}>
                        {statusConfig[replacementOrder.status]?.label || replacementOrder.status}
                      </Badge>
                    </div>
                  </div>

                  {replacementOrder.order_type === "paid_replacement" && replacementOrder.total_amount > 0 && (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">Total à payer</p>
                          <p className="text-xs text-muted-foreground">
                            Facture: {replacementOrder.invoice_number || "En attente"}
                          </p>
                        </div>
                        <p className="text-xl font-bold">{replacementOrder.total_amount.toFixed(2)} $</p>
                      </div>
                      {replacementOrder.invoice_status !== "paid" && (
                        <p className="text-xs text-amber-500 mt-2">
                          L'expédition sera effectuée après confirmation du paiement.
                        </p>
                      )}
                    </div>
                  )}

                  {replacementOrder.tracking_number && (
                    <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                      <p className="text-sm font-medium flex items-center gap-2">
                        <Truck className="w-4 h-4" />
                        Numéro de suivi
                      </p>
                      <p className="font-mono text-sm mt-1">{replacementOrder.tracking_number}</p>
                      {replacementOrder.tracking_url && (
                        <a 
                          href={replacementOrder.tracking_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-xs text-cyan-400 hover:underline mt-1 inline-block"
                        >
                          Suivre le colis →
                        </a>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Next Steps */}
              {selectedTicket.status === "open" && (
                <div className="p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
                  <h4 className="font-medium flex items-center gap-2 mb-2">
                    <Clock className="w-4 h-4" />
                    Prochaines étapes
                  </h4>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li>• Votre demande est en cours d'examen par notre équipe</li>
                    <li>• Vous serez notifié de la décision (garantie ou facturable)</li>
                    <li>• Si un paiement est requis, une facture vous sera envoyée</li>
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </ClientLayout>
    );
  }

  return (
    <ClientLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">Remplacement d'équipement</h1>
            <p className="text-muted-foreground mt-1">Demandez le remplacement de vos équipements</p>
          </div>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="hero">
                <Plus className="w-4 h-4 mr-2" />
                Nouvelle demande
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Demande de remplacement d'équipement</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                {/* Order Selection */}
                <div>
                  <Label>Commande liée (optionnel)</Label>
                  <Select value={formData.linkedOrderId} onValueChange={handleOrderSelect}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner une commande" />
                    </SelectTrigger>
                    <SelectContent>
                      {orders?.map((order: any) => (
                        <SelectItem key={order.id} value={order.id}>
                          {order.order_number} — {order.service_type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Equipment Info */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Nom de l'équipement</Label>
                    <Input
                      value={formData.equipmentName}
                      onChange={(e) => setFormData({ ...formData, equipmentName: e.target.value })}
                      placeholder="Ex: Routeur, Terminal TV"
                    />
                  </div>
                  <div>
                    <Label>Numéro de série</Label>
                    <Input
                      value={formData.equipmentSerial}
                      onChange={(e) => setFormData({ ...formData, equipmentSerial: e.target.value })}
                      placeholder="S/N"
                    />
                  </div>
                </div>

                {/* Reason Selection */}
                <div>
                  <Label>Raison du remplacement *</Label>
                  <Select 
                    value={formData.reason} 
                    onValueChange={(v) => setFormData({ ...formData, reason: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner une raison" />
                    </SelectTrigger>
                    <SelectContent>
                      {reasonOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Additional Details */}
                <div>
                  <Label>Détails supplémentaires</Label>
                  <Textarea
                    value={formData.reasonDetails}
                    onChange={(e) => setFormData({ ...formData, reasonDetails: e.target.value })}
                    placeholder="Décrivez le problème en détail..."
                    rows={3}
                  />
                </div>

                {/* Delivery Address */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Adresse de livraison préférée</Label>
                  <Input
                    value={formData.preferredAddress}
                    onChange={(e) => setFormData({ ...formData, preferredAddress: e.target.value })}
                    placeholder="Adresse"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      value={formData.preferredCity}
                      onChange={(e) => setFormData({ ...formData, preferredCity: e.target.value })}
                      placeholder="Ville"
                    />
                    <Input
                      value={formData.preferredPostalCode}
                      onChange={(e) => setFormData({ ...formData, preferredPostalCode: e.target.value })}
                      placeholder="Code postal"
                    />
                  </div>
                </div>

                {/* Acknowledgement */}
                <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="acknowledge"
                      checked={formData.billableAcknowledged}
                      onCheckedChange={(checked) => 
                        setFormData({ ...formData, billableAcknowledged: checked as boolean })
                      }
                    />
                    <label htmlFor="acknowledge" className="text-sm leading-snug cursor-pointer">
                      <span className="font-medium text-amber-400">Je comprends que</span>{" "}
                      le remplacement peut être facturable selon la couverture de garantie. 
                      L'expédition ne sera effectuée qu'après confirmation du paiement si applicable.
                    </label>
                  </div>
                </div>

                <Button
                  className="w-full"
                  variant="hero"
                  onClick={() => createTicketMutation.mutate(formData)}
                  disabled={
                    !formData.reason || 
                    !formData.billableAcknowledged || 
                    createTicketMutation.isPending
                  }
                >
                  {createTicketMutation.isPending ? "Envoi..." : "Soumettre la demande"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-cyan-400" />
              Mes demandes de remplacement
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2].map((i) => (
                  <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : tickets && tickets.length > 0 ? (
              <div className="space-y-4">
                {tickets.map((ticket: any) => {
                  const statusInfo = statusConfig[ticket.status] || statusConfig.open;
                  const StatusIcon = statusInfo.icon;
                  const reasonLabel = reasonOptions.find(r => r.value === ticket.reason)?.label || ticket.reason;

                  return (
                    <div
                      key={ticket.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-accent/50 rounded-lg cursor-pointer hover:bg-accent/70 transition-colors"
                      onClick={() => setSelectedTicket(ticket)}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <span className="font-mono text-sm text-cyan-400">{ticket.ticket_number}</span>
                          <Badge className={statusInfo.color}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {statusInfo.label}
                          </Badge>
                        </div>
                        <p className="font-medium">{ticket.equipment_name || "Équipement"}</p>
                        <p className="text-sm text-muted-foreground">{reasonLabel}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(ticket.created_at), "d MMM yyyy 'à' HH:mm", { locale: fr })}
                        </p>
                      </div>
                      {ticket.linked_order_number && (
                        <Badge variant="outline" className="font-mono">
                          {ticket.linked_order_number}
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">Aucune demande de remplacement</p>
                <Button variant="hero" onClick={() => setCreateDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Créer une demande
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ClientLayout>
  );
};

export default ClientEquipmentReplacement;
