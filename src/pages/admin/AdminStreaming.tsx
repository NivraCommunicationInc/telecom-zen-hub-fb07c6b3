import { useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Tv,
  Music,
  Film,
  Users,
  Eye,
  EyeOff,
  DollarSign,
  Calendar,
  Lock,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminClient as supabase } from "@/integrations/backend/adminClient";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";

const categoryIcons: Record<string, any> = {
  video: Film,
  music: Music,
  streaming: Tv,
};

const categoryLabels: Record<string, string> = {
  video: "Vidéo",
  music: "Musique",
  streaming: "Streaming",
};

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  active: { label: "Actif", variant: "default" },
  paused: { label: "Suspendu", variant: "secondary" },
  cancelled: { label: "Annulé", variant: "destructive" },
};

const AdminStreaming = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("subscriptions");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [subscriptionDialogOpen, setSubscriptionDialogOpen] = useState(false);
  const [viewSubscriptionDialog, setViewSubscriptionDialog] = useState(false);
  const [addNoteDialog, setAddNoteDialog] = useState(false);
  const [changeStatusDialog, setChangeStatusDialog] = useState(false);
  const [selectedService, setSelectedService] = useState<any>(null);
  const [selectedSubscription, setSelectedSubscription] = useState<any>(null);
  const [newNote, setNewNote] = useState("");
  const [newStatus, setNewStatus] = useState("");
  
  // Filters for subscriptions
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("newest");
  
  const [newService, setNewService] = useState({
    name: "",
    description: "",
    monthly_price: "",
    category: "video",
    logo_url: "",
    features: "",
    private_notes: "",
    is_active: true,
  });

  // Fetch streaming services
  const { data: services, isLoading: servicesLoading } = useQuery({
    queryKey: ["admin-streaming-services"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("streaming_services")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch client subscriptions with profiles, accounts, and payment methods
  const { data: subscriptions, isLoading: subsLoading } = useQuery({
    queryKey: ["admin-streaming-subscriptions"],
    queryFn: async () => {
      const { data: subs, error } = await supabase
        .from("client_streaming_subscriptions")
        .select("*, streaming_services(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;

      // Fetch profiles for user_ids
      const userIds = [...new Set(subs?.map(s => s.user_id).filter(Boolean))];
      let profilesMap: Record<string, any> = {};
      let accountsMap: Record<string, any> = {};
      let paymentMethodsMap: Record<string, any> = {};
      
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name, email, phone, client_number")
          .in("user_id", userIds);
        profiles?.forEach(p => { profilesMap[p.user_id] = p; });
        
        // Fetch accounts
        const { data: accounts } = await supabase
          .from("accounts")
          .select("id, account_number, client_id")
          .in("client_id", userIds);
        accounts?.forEach(a => { accountsMap[a.client_id] = a; });
        
        // Fetch payment methods
        const { data: paymentMethods } = await supabase
          .from("payment_methods")
          .select("user_id, card_type, last_four, is_preauthorized")
          .in("user_id", userIds)
          .eq("is_default", true);
        paymentMethods?.forEach(pm => { paymentMethodsMap[pm.user_id] = pm; });
      }

      return subs?.map(sub => ({
        ...sub,
        profile: profilesMap[sub.user_id] || null,
        account: accountsMap[sub.user_id] || null,
        payment_method: paymentMethodsMap[sub.user_id] || null,
      }));
    },
  });

  // Fetch clients for subscription creation
  const { data: clients } = useQuery({
    queryKey: ["admin-clients-streaming"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, client_number")
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  // Create service
  const createServiceMutation = useMutation({
    mutationFn: async (data: typeof newService) => {
      const featuresArray = data.features
        .split(",")
        .map(f => f.trim())
        .filter(Boolean);
      
      const { error } = await supabase.from("streaming_services").insert({
        name: data.name,
        description: data.description,
        monthly_price: parseFloat(data.monthly_price) || 0,
        category: data.category,
        logo_url: data.logo_url || null,
        features: featuresArray,
        private_notes: data.private_notes || null,
        is_active: data.is_active,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-streaming-services"] });
      toast({ title: "Service de streaming créé" });
      setCreateDialogOpen(false);
      resetNewService();
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  // Update service
  const updateServiceMutation = useMutation({
    mutationFn: async (data: any) => {
      const featuresArray = typeof data.features === "string"
        ? data.features.split(",").map((f: string) => f.trim()).filter(Boolean)
        : data.features;
      
      const { error } = await supabase
        .from("streaming_services")
        .update({
          name: data.name,
          description: data.description,
          monthly_price: parseFloat(data.monthly_price) || 0,
          category: data.category,
          logo_url: data.logo_url || null,
          features: featuresArray,
          private_notes: data.private_notes || null,
          is_active: data.is_active,
        })
        .eq("id", data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-streaming-services"] });
      toast({ title: "Service mis à jour" });
      setEditDialogOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  // Delete service
  const deleteServiceMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("streaming_services")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-streaming-services"] });
      toast({ title: "Service supprimé" });
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  // Create subscription
  const createSubscriptionMutation = useMutation({
    mutationFn: async (data: any) => {
      const service = services?.find(s => s.id === data.streaming_service_id);
      const { error } = await supabase.from("client_streaming_subscriptions").insert({
        user_id: data.user_id,
        streaming_service_id: data.streaming_service_id,
        monthly_price: service?.monthly_price || 0,
        status: "active",
        internal_notes: data.internal_notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-streaming-subscriptions"] });
      toast({ title: "Abonnement créé" });
      setSubscriptionDialogOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  // Update subscription status with audit logging
  const updateSubscriptionMutation = useMutation({
    mutationFn: async ({ id, status, internal_notes, userId }: { id: string; status?: string; internal_notes?: string; userId?: string }) => {
      const updateData: any = { updated_at: new Date().toISOString() };
      if (status) updateData.status = status;
      if (internal_notes !== undefined) updateData.internal_notes = internal_notes;
      
      const { error } = await supabase
        .from("client_streaming_subscriptions")
        .update(updateData)
        .eq("id", id);
      if (error) throw error;
      
      // Log to activity_logs
      try {
        await supabase.from("activity_logs").insert({
          user_id: "system",
          entity_type: "streaming_subscription",
          entity_id: id,
          action: status ? `status_changed_to_${status}` : "note_updated",
          actor_name: "Admin",
          actor_role: "admin",
          details: { 
            subscription_id: id, 
            new_status: status,
            note_added: internal_notes ? true : false,
          },
        });
      } catch (logError) {
        console.warn("Failed to log activity:", logError);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-streaming-subscriptions"] });
      toast({ title: "Abonnement mis à jour" });
      setChangeStatusDialog(false);
      setAddNoteDialog(false);
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const resetNewService = () => {
    setNewService({
      name: "",
      description: "",
      monthly_price: "",
      category: "video",
      logo_url: "",
      features: "",
      private_notes: "",
      is_active: true,
    });
  };

  const filteredServices = services?.filter(s => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return s.name?.toLowerCase().includes(q) || s.description?.toLowerCase().includes(q);
  });

  const filteredSubscriptions = subscriptions?.filter(s => {
    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchesSearch = (
        s.profile?.full_name?.toLowerCase().includes(q) ||
        s.profile?.email?.toLowerCase().includes(q) ||
        s.profile?.client_number?.toLowerCase().includes(q) ||
        s.streaming_services?.name?.toLowerCase().includes(q) ||
        s.id?.toLowerCase().includes(q)
      );
      if (!matchesSearch) return false;
    }
    
    // Status filter
    if (statusFilter !== "all" && s.status !== statusFilter) return false;
    
    // Plan filter
    if (planFilter !== "all" && s.streaming_service_id !== planFilter) return false;
    
    return true;
  })?.sort((a, b) => {
    // Sorting
    switch (sortBy) {
      case "oldest":
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      case "next_billing":
        return (a.end_date || "9999") > (b.end_date || "9999") ? 1 : -1;
      case "price_high":
        return (b.monthly_price || 0) - (a.monthly_price || 0);
      case "price_low":
        return (a.monthly_price || 0) - (b.monthly_price || 0);
      case "newest":
      default:
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
  });

  const CategoryIcon = ({ category }: { category: string }) => {
    const Icon = categoryIcons[category] || Tv;
    return <Icon className="w-4 h-4" />;
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Tv className="w-8 h-8 text-primary" />
              Streaming+
            </h1>
            <p className="text-muted-foreground">Gestion des services de streaming et abonnements clients</p>
          </div>
        </div>

        {/* Search */}
        <Card>
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Rechercher services ou clients..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="services">Services ({services?.length || 0})</TabsTrigger>
            <TabsTrigger value="subscriptions">Abonnements ({subscriptions?.length || 0})</TabsTrigger>
          </TabsList>

          {/* Services Tab */}
          <TabsContent value="services" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Nouveau service
              </Button>
            </div>

            <Card>
              <CardContent className="pt-6">
                {servicesLoading ? (
                  <p className="text-center py-8 text-muted-foreground">Chargement...</p>
                ) : filteredServices?.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">Aucun service trouvé</p>
                ) : (
                  <div className="space-y-4">
                    {filteredServices?.map((service) => (
                      <div
                        key={service.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/30 transition-colors"
                      >
                        <div className="flex items-start gap-4">
                          <div className={`p-3 rounded-lg ${service.is_active ? "bg-primary/10" : "bg-muted"}`}>
                            <CategoryIcon category={service.category} />
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{service.name}</span>
                              <Badge variant={service.is_active ? "default" : "secondary"}>
                                {service.is_active ? "Actif" : "Inactif"}
                              </Badge>
                              <Badge variant="outline">{categoryLabels[service.category] || service.category}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{service.description}</p>
                            <p className="text-lg font-bold text-primary">${service.monthly_price?.toFixed(2)}/mois</p>
                            {Array.isArray(service.features) && service.features.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {(service.features as string[]).slice(0, 3).map((f, i) => (
                                  <Badge key={i} variant="outline" className="text-xs">{f}</Badge>
                                ))}
                                {(service.features as string[]).length > 3 && (
                                  <Badge variant="outline" className="text-xs">+{(service.features as string[]).length - 3}</Badge>
                                )}
                              </div>
                            )}
                            {/* Private notes - Admin only */}
                            {service.private_notes && (
                              <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800 flex items-start gap-2">
                                <Lock className="w-3 h-3 mt-0.5 shrink-0" />
                                <span>{service.private_notes}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedService({
                                ...service,
                                features: Array.isArray(service.features) ? service.features.join(", ") : "",
                              });
                              setEditDialogOpen(true);
                            }}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:bg-destructive/10"
                            onClick={() => {
                              if (confirm("Supprimer ce service?")) {
                                deleteServiceMutation.mutate(service.id);
                              }
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Subscriptions Tab */}
          <TabsContent value="subscriptions" className="space-y-4">
            {/* Filters */}
            <Card>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Statut</Label>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="Tous les statuts" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tous les statuts</SelectItem>
                        <SelectItem value="active">Actif</SelectItem>
                        <SelectItem value="paused">Suspendu</SelectItem>
                        <SelectItem value="cancelled">Annulé</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Service</Label>
                    <Select value={planFilter} onValueChange={setPlanFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="Tous les services" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tous les services</SelectItem>
                        {services?.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Tri</Label>
                    <Select value={sortBy} onValueChange={setSortBy}>
                      <SelectTrigger>
                        <SelectValue placeholder="Tri par" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="newest">Plus récent</SelectItem>
                        <SelectItem value="oldest">Plus ancien</SelectItem>
                        <SelectItem value="next_billing">Prochain renouvellement</SelectItem>
                        <SelectItem value="price_high">Prix (décroissant)</SelectItem>
                        <SelectItem value="price_low">Prix (croissant)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button onClick={() => setSubscriptionDialogOpen(true)} className="w-full">
                      <Plus className="w-4 h-4 mr-2" />
                      Nouvel abonnement
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                {subsLoading ? (
                  <p className="text-center py-8 text-muted-foreground">Chargement...</p>
                ) : filteredSubscriptions?.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">Aucun abonnement trouvé</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Client</TableHead>
                        <TableHead>Compte</TableHead>
                        <TableHead>Service</TableHead>
                        <TableHead>Prix</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead>Date début</TableHead>
                        <TableHead>Promo</TableHead>
                        <TableHead>Paiement</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSubscriptions?.map((sub) => (
                        <TableRow key={sub.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{sub.profile?.full_name || "Client inconnu"}</p>
                              <p className="text-xs text-muted-foreground">{sub.profile?.email}</p>
                              {sub.profile?.phone && (
                                <p className="text-xs text-muted-foreground">{sub.profile.phone}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="font-mono text-xs">{sub.profile?.client_number || sub.account?.account_number || "—"}</span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <CategoryIcon category={sub.streaming_services?.category} />
                              {sub.streaming_services?.name}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="font-medium">${sub.monthly_price?.toFixed(2)}</span>
                            {sub.discount_amount && sub.discount_amount > 0 && (
                              <span className="text-xs text-emerald-600 block">-${sub.discount_amount.toFixed(2)}</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={statusLabels[sub.status]?.variant || "default"}>
                              {statusLabels[sub.status]?.label || sub.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {sub.start_date && format(new Date(sub.start_date), "d MMM yyyy", { locale: fr })}
                              {sub.end_date && (
                                <p className="text-xs text-muted-foreground">
                                  → {format(new Date(sub.end_date), "d MMM yyyy", { locale: fr })}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {sub.promo_code ? (
                              <div className="text-xs">
                                <Badge variant="outline" className="text-emerald-600">{sub.promo_code}</Badge>
                                {sub.discount_amount && <span className="block mt-1">-${sub.discount_amount}</span>}
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {sub.payment_method ? (
                              <span className="text-xs">
                                {sub.payment_method.card_type} •••• {sub.payment_method.last_four}
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-xs">Interac</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {/* View details */}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setSelectedSubscription(sub);
                                  setViewSubscriptionDialog(true);
                                }}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              {/* Change status */}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setSelectedSubscription(sub);
                                  setNewStatus(sub.status);
                                  setChangeStatusDialog(true);
                                }}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              {/* Add note */}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setSelectedSubscription(sub);
                                  setNewNote(sub.internal_notes || "");
                                  setAddNoteDialog(true);
                                }}
                              >
                                <Lock className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* View Subscription Dialog */}
      <Dialog open={viewSubscriptionDialog} onOpenChange={setViewSubscriptionDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Détails de l'abonnement</DialogTitle>
          </DialogHeader>
          {selectedSubscription && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Client</Label>
                  <p className="font-medium">{selectedSubscription.profile?.full_name || "—"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Email</Label>
                  <p className="text-sm">{selectedSubscription.profile?.email || "—"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Téléphone</Label>
                  <p className="text-sm">{selectedSubscription.profile?.phone || "—"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">N° Compte</Label>
                  <p className="font-mono text-sm">{selectedSubscription.profile?.client_number || selectedSubscription.account?.account_number || "—"}</p>
                </div>
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Service</Label>
                  <p className="font-medium">{selectedSubscription.streaming_services?.name}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Prix mensuel</Label>
                  <p className="font-bold text-primary">${selectedSubscription.monthly_price?.toFixed(2)}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Statut</Label>
                  <Badge variant={statusLabels[selectedSubscription.status]?.variant || "default"}>
                    {statusLabels[selectedSubscription.status]?.label || selectedSubscription.status}
                  </Badge>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Date de début</Label>
                  <p className="text-sm">{selectedSubscription.start_date ? format(new Date(selectedSubscription.start_date), "d MMMM yyyy", { locale: fr }) : "—"}</p>
                </div>
              </div>
              {(selectedSubscription.promo_code || selectedSubscription.discount_amount) && (
                <>
                  <Separator />
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Code promo</Label>
                      <Badge variant="outline" className="text-emerald-600">{selectedSubscription.promo_code || "—"}</Badge>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Rabais</Label>
                      <p className="text-emerald-600 font-medium">-${selectedSubscription.discount_amount?.toFixed(2) || "0.00"}</p>
                    </div>
                  </div>
                </>
              )}
              <Separator />
              <div>
                <Label className="text-xs text-muted-foreground">Notes internes</Label>
                <p className="text-sm bg-amber-50 p-2 rounded border border-amber-200 min-h-[40px]">
                  {selectedSubscription.internal_notes || "Aucune note"}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
                <div>
                  <Label className="text-xs">Créé le</Label>
                  <p>{format(new Date(selectedSubscription.created_at), "d MMM yyyy HH:mm", { locale: fr })}</p>
                </div>
                <div>
                  <Label className="text-xs">Mis à jour</Label>
                  <p>{selectedSubscription.updated_at ? format(new Date(selectedSubscription.updated_at), "d MMM yyyy HH:mm", { locale: fr }) : "—"}</p>
                </div>
              </div>
              <div className="flex gap-2 pt-4">
                <Button variant="outline" size="sm" onClick={() => window.open(`/admin/clients?id=${selectedSubscription.user_id}`, '_blank')}>
                  <Users className="w-4 h-4 mr-2" />
                  Profil client
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Change Status Dialog */}
      <Dialog open={changeStatusDialog} onOpenChange={setChangeStatusDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Changer le statut</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Select value={newStatus} onValueChange={setNewStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Actif</SelectItem>
                <SelectItem value="paused">Suspendu</SelectItem>
                <SelectItem value="cancelled">Annulé</SelectItem>
              </SelectContent>
            </Select>
            <DialogFooter>
              <Button variant="outline" onClick={() => setChangeStatusDialog(false)}>
                Annuler
              </Button>
              <Button 
                onClick={() => {
                  if (selectedSubscription && newStatus) {
                    updateSubscriptionMutation.mutate({ id: selectedSubscription.id, status: newStatus });
                  }
                }}
                disabled={updateSubscriptionMutation.isPending}
              >
                Confirmer
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Note Dialog */}
      <Dialog open={addNoteDialog} onOpenChange={setAddNoteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter une note interne</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea 
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Note interne (visible uniquement par l'admin)..."
              rows={4}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddNoteDialog(false)}>
                Annuler
              </Button>
              <Button 
                onClick={() => {
                  if (selectedSubscription) {
                    updateSubscriptionMutation.mutate({ id: selectedSubscription.id, internal_notes: newNote });
                  }
                }}
                disabled={updateSubscriptionMutation.isPending}
              >
                Sauvegarder
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Service Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nouveau service de streaming</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh]">
            <div className="space-y-4 pr-4">
              <div>
                <Label>Nom du service *</Label>
                <Input
                  value={newService.name}
                  onChange={(e) => setNewService({ ...newService, name: e.target.value })}
                  placeholder="Netflix Premium"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={newService.description}
                  onChange={(e) => setNewService({ ...newService, description: e.target.value })}
                  placeholder="Description du service..."
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Prix mensuel ($) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={newService.monthly_price}
                    onChange={(e) => setNewService({ ...newService, monthly_price: e.target.value })}
                    placeholder="19.99"
                  />
                </div>
                <div>
                  <Label>Catégorie</Label>
                  <Select value={newService.category} onValueChange={(v) => setNewService({ ...newService, category: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="video">Vidéo</SelectItem>
                      <SelectItem value="music">Musique</SelectItem>
                      <SelectItem value="streaming">Streaming</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Fonctionnalités (séparées par virgule)</Label>
                <Textarea
                  value={newService.features}
                  onChange={(e) => setNewService({ ...newService, features: e.target.value })}
                  placeholder="4K Ultra HD, 4 écrans simultanés, Téléchargements illimités"
                  rows={2}
                />
              </div>
              <div>
                <Label>URL du logo</Label>
                <Input
                  value={newService.logo_url}
                  onChange={(e) => setNewService({ ...newService, logo_url: e.target.value })}
                  placeholder="https://..."
                />
              </div>
              <div className="border-t pt-4">
                <Label className="flex items-center gap-2 text-amber-700">
                  <Lock className="w-4 h-4" />
                  Notes privées (Admin uniquement)
                </Label>
                <Textarea
                  value={newService.private_notes}
                  onChange={(e) => setNewService({ ...newService, private_notes: e.target.value })}
                  placeholder="Notes internes visibles uniquement par les administrateurs..."
                  rows={3}
                  className="mt-2 border-amber-200 bg-amber-50/50"
                />
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  checked={newService.is_active}
                  onCheckedChange={(v) => setNewService({ ...newService, is_active: v })}
                />
                <Label>Service actif</Label>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Annuler</Button>
            <Button
              onClick={() => createServiceMutation.mutate(newService)}
              disabled={createServiceMutation.isPending || !newService.name || !newService.monthly_price}
            >
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Service Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Modifier le service</DialogTitle>
          </DialogHeader>
          {selectedService && (
            <ScrollArea className="max-h-[70vh]">
              <div className="space-y-4 pr-4">
                <div>
                  <Label>Nom du service *</Label>
                  <Input
                    value={selectedService.name}
                    onChange={(e) => setSelectedService({ ...selectedService, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea
                    value={selectedService.description || ""}
                    onChange={(e) => setSelectedService({ ...selectedService, description: e.target.value })}
                    rows={2}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Prix mensuel ($) *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={selectedService.monthly_price}
                      onChange={(e) => setSelectedService({ ...selectedService, monthly_price: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Catégorie</Label>
                    <Select
                      value={selectedService.category}
                      onValueChange={(v) => setSelectedService({ ...selectedService, category: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="video">Vidéo</SelectItem>
                        <SelectItem value="music">Musique</SelectItem>
                        <SelectItem value="streaming">Streaming</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Fonctionnalités (séparées par virgule)</Label>
                  <Textarea
                    value={selectedService.features || ""}
                    onChange={(e) => setSelectedService({ ...selectedService, features: e.target.value })}
                    rows={2}
                  />
                </div>
                <div>
                  <Label>URL du logo</Label>
                  <Input
                    value={selectedService.logo_url || ""}
                    onChange={(e) => setSelectedService({ ...selectedService, logo_url: e.target.value })}
                  />
                </div>
                <div className="border-t pt-4">
                  <Label className="flex items-center gap-2 text-amber-700">
                    <Lock className="w-4 h-4" />
                    Notes privées (Admin uniquement)
                  </Label>
                  <Textarea
                    value={selectedService.private_notes || ""}
                    onChange={(e) => setSelectedService({ ...selectedService, private_notes: e.target.value })}
                    rows={3}
                    className="mt-2 border-amber-200 bg-amber-50/50"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={selectedService.is_active}
                    onCheckedChange={(v) => setSelectedService({ ...selectedService, is_active: v })}
                  />
                  <Label>Service actif</Label>
                </div>
              </div>
            </ScrollArea>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Annuler</Button>
            <Button
              onClick={() => updateServiceMutation.mutate(selectedService)}
              disabled={updateServiceMutation.isPending}
            >
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Subscription Dialog */}
      <Dialog open={subscriptionDialogOpen} onOpenChange={setSubscriptionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvel abonnement streaming</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              createSubscriptionMutation.mutate({
                user_id: formData.get("user_id"),
                streaming_service_id: formData.get("streaming_service_id"),
                internal_notes: formData.get("internal_notes"),
              });
            }}
            className="space-y-4"
          >
            <div>
              <Label>Client *</Label>
              <Select name="user_id" required>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un client..." />
                </SelectTrigger>
                <SelectContent>
                  {clients?.map((c) => (
                    <SelectItem key={c.user_id} value={c.user_id}>
                      {c.full_name} ({c.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Service de streaming *</Label>
              <Select name="streaming_service_id" required>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un service..." />
                </SelectTrigger>
                <SelectContent>
                  {services?.filter(s => s.is_active).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} - ${s.monthly_price?.toFixed(2)}/mois
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="border-t pt-4">
              <Label className="flex items-center gap-2 text-amber-700">
                <Lock className="w-4 h-4" />
                Notes internes (Admin uniquement)
              </Label>
              <Textarea
                name="internal_notes"
                placeholder="Notes visibles uniquement par les administrateurs..."
                rows={2}
                className="mt-2 border-amber-200 bg-amber-50/50"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSubscriptionDialogOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={createSubscriptionMutation.isPending}>
                Créer l'abonnement
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminStreaming;