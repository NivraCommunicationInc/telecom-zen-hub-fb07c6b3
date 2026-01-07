import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tv, Search, Plus, Edit, XCircle, CheckCircle, Clock, AlertCircle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { employeeClient as supabase } from "@/integrations/backend/employeeClient";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { useEmployeeAuth } from "@/hooks/useEmployeeAuth";
import { useEmployeeActivityLog } from "@/hooks/useEmployeeActivityLog";

const EmployeeStreaming = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useEmployeeAuth();
  const { logActivity } = useEmployeeActivityLog();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedSubscription, setSelectedSubscription] = useState<any>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  // Form state for create/edit
  const [formData, setFormData] = useState({
    user_id: "",
    streaming_service_id: "",
    monthly_price: "",
    promo_code: "",
    internal_notes: "",
  });

  // Fetch subscriptions
  const { data: subscriptions, isLoading } = useQuery({
    queryKey: ["employee-streaming-subscriptions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_streaming_subscriptions")
        .select(`
          *,
          streaming_services:streaming_service_id (
            name,
            base_price,
            logo_url
          ),
          profiles:user_id (
            full_name,
            email,
            first_name,
            last_name
          )
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch streaming services for dropdown
  const { data: streamingServices } = useQuery({
    queryKey: ["employee-streaming-services"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("streaming_services")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  // Create subscription mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase.from("client_streaming_subscriptions").insert({
        user_id: data.user_id,
        streaming_service_id: data.streaming_service_id,
        monthly_price: parseFloat(data.monthly_price) || null,
        promo_code: data.promo_code || null,
        internal_notes: data.internal_notes || null,
        status: "active",
        start_date: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-streaming-subscriptions"] });
      toast({ title: "Abonnement créé avec succès" });
      setCreateOpen(false);
      logActivity("create_streaming_subscription", "streaming", formData.user_id);
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  // Cancel subscription mutation
  const cancelMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { error } = await supabase
        .from("client_streaming_subscriptions")
        .update({
          status: "cancelled",
          end_date: new Date().toISOString(),
          internal_notes: `Annulé par employé: ${reason}`,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-streaming-subscriptions"] });
      toast({ title: "Abonnement annulé" });
      setCancelOpen(false);
      setDetailsOpen(false);
      logActivity("cancel_streaming_subscription", "streaming", selectedSubscription?.id, { reason: cancelReason });
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const filteredSubscriptions = subscriptions?.filter((sub: any) => {
    const clientName = sub.profiles?.full_name || 
      `${sub.profiles?.first_name || ""} ${sub.profiles?.last_name || ""}`.trim();
    const serviceName = sub.streaming_services?.name || "";
    
    const matchesSearch = !searchQuery || 
      clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      serviceName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.profiles?.email?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || sub.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const statusColors: Record<string, string> = {
    active: "bg-emerald-500/20 text-emerald-500",
    cancelled: "bg-red-500/20 text-red-500",
    suspended: "bg-amber-500/20 text-amber-500",
    pending: "bg-blue-500/20 text-blue-500",
  };

  const statusLabels: Record<string, string> = {
    active: "Actif",
    cancelled: "Annulé",
    suspended: "Suspendu",
    pending: "En attente",
  };

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Streaming+</h1>
            <p className="text-muted-foreground mt-1">Gérer les abonnements streaming des clients</p>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nouvel abonnement
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par client, service..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="active">Actif</SelectItem>
              <SelectItem value="cancelled">Annulé</SelectItem>
              <SelectItem value="suspended">Suspendu</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Subscriptions List */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tv className="w-5 h-5" />
              Abonnements ({filteredSubscriptions?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Chargement...</div>
            ) : filteredSubscriptions && filteredSubscriptions.length > 0 ? (
              <div className="space-y-2">
                {filteredSubscriptions.map((sub: any) => {
                  const clientName = sub.profiles?.full_name || 
                    `${sub.profiles?.first_name || ""} ${sub.profiles?.last_name || ""}`.trim() ||
                    "Client";

                  return (
                    <div
                      key={sub.id}
                      className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-accent/30 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                          <Tv className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">
                            {sub.streaming_services?.name || "Service streaming"}
                          </p>
                          <p className="text-sm text-muted-foreground">{clientName}</p>
                          <p className="text-xs text-muted-foreground">
                            Depuis {format(new Date(sub.start_date || sub.created_at), "d MMM yyyy", { locale: fr })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="font-medium">
                            {Number(sub.monthly_price || sub.streaming_services?.base_price || 0).toLocaleString("fr-CA", {
                              style: "currency",
                              currency: "CAD",
                            })}
                            <span className="text-xs text-muted-foreground">/mois</span>
                          </p>
                        </div>
                        <Badge className={statusColors[sub.status] || statusColors.pending}>
                          {statusLabels[sub.status] || sub.status}
                        </Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedSubscription(sub);
                            setDetailsOpen(true);
                          }}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-center py-8 text-muted-foreground">Aucun abonnement trouvé</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create Subscription Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvel abonnement Streaming+</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>ID Client (user_id) *</Label>
              <Input
                value={formData.user_id}
                onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
                placeholder="UUID du client"
              />
            </div>
            <div>
              <Label>Service *</Label>
              <Select
                value={formData.streaming_service_id}
                onValueChange={(v) => setFormData({ ...formData, streaming_service_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un service" />
                </SelectTrigger>
                <SelectContent>
                  {streamingServices?.map((service: any) => (
                    <SelectItem key={service.id} value={service.id}>
                      {service.name} - {Number(service.base_price).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}/mois
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Prix mensuel (optionnel, remplace le prix de base)</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.monthly_price}
                onChange={(e) => setFormData({ ...formData, monthly_price: e.target.value })}
                placeholder="Ex: 14.99"
              />
            </div>
            <div>
              <Label>Code promo (optionnel)</Label>
              <Input
                value={formData.promo_code}
                onChange={(e) => setFormData({ ...formData, promo_code: e.target.value })}
                placeholder="Code promotionnel"
              />
            </div>
            <div>
              <Label>Notes internes</Label>
              <Textarea
                value={formData.internal_notes}
                onChange={(e) => setFormData({ ...formData, internal_notes: e.target.value })}
                placeholder="Notes visibles uniquement par le personnel"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Annuler</Button>
            <Button
              onClick={() => createMutation.mutate(formData)}
              disabled={createMutation.isPending || !formData.user_id || !formData.streaming_service_id}
            >
              {createMutation.isPending ? "Création..." : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Subscription Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Détails de l'abonnement</DialogTitle>
          </DialogHeader>
          {selectedSubscription && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Service</p>
                  <p className="font-medium">{selectedSubscription.streaming_services?.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Statut</p>
                  <Badge className={statusColors[selectedSubscription.status]}>
                    {statusLabels[selectedSubscription.status] || selectedSubscription.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Client</p>
                  <p className="font-medium">
                    {selectedSubscription.profiles?.full_name || 
                      `${selectedSubscription.profiles?.first_name || ""} ${selectedSubscription.profiles?.last_name || ""}`.trim()}
                  </p>
                  <p className="text-xs text-muted-foreground">{selectedSubscription.profiles?.email}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Prix mensuel</p>
                  <p className="font-medium">
                    {Number(selectedSubscription.monthly_price || selectedSubscription.streaming_services?.base_price || 0).toLocaleString("fr-CA", {
                      style: "currency",
                      currency: "CAD",
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Date de début</p>
                  <p>{format(new Date(selectedSubscription.start_date || selectedSubscription.created_at), "d MMMM yyyy", { locale: fr })}</p>
                </div>
                {selectedSubscription.end_date && (
                  <div>
                    <p className="text-sm text-muted-foreground">Date de fin</p>
                    <p>{format(new Date(selectedSubscription.end_date), "d MMMM yyyy", { locale: fr })}</p>
                  </div>
                )}
              </div>

              {selectedSubscription.internal_notes && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm font-medium mb-1">Notes internes</p>
                  <p className="text-sm text-muted-foreground">{selectedSubscription.internal_notes}</p>
                </div>
              )}

              {selectedSubscription.status === "active" && (
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={() => setCancelOpen(true)}
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Annuler l'abonnement
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation Dialog */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer l'annulation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-muted-foreground">
              Êtes-vous sûr de vouloir annuler cet abonnement? L'annulation prendra effet à la fin du cycle de facturation actuel.
            </p>
            <div>
              <Label>Raison de l'annulation *</Label>
              <Textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Expliquez la raison de l'annulation..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>Non, garder</Button>
            <Button
              variant="destructive"
              onClick={() => cancelMutation.mutate({ id: selectedSubscription?.id, reason: cancelReason })}
              disabled={cancelMutation.isPending || !cancelReason}
            >
              {cancelMutation.isPending ? "Annulation..." : "Oui, annuler"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default EmployeeStreaming;
