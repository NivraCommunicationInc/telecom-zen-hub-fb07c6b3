import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Search, Plus, Tv, Music, Film, Users } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useNavigate } from "react-router-dom";

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

const EmployeeStreaming = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("services");
  const [subscriptionDialogOpen, setSubscriptionDialogOpen] = useState(false);

  // Fetch streaming services (employees can see all but not private_notes)
  const { data: services, isLoading: servicesLoading } = useQuery({
    queryKey: ["employee-streaming-services"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("streaming_services")
        .select("id, name, description, monthly_price, category, logo_url, features, is_active, created_at")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch client subscriptions (employees can see all but not internal_notes)
  const { data: subscriptions, isLoading: subsLoading } = useQuery({
    queryKey: ["employee-streaming-subscriptions"],
    queryFn: async () => {
      const { data: subs, error } = await supabase
        .from("client_streaming_subscriptions")
        .select("id, user_id, streaming_service_id, status, start_date, end_date, monthly_price, created_at, streaming_services(id, name, category)")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const userIds = [...new Set(subs?.map(s => s.user_id).filter(Boolean))];
      let profilesMap: Record<string, any> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name, email, client_number")
          .in("user_id", userIds);
        profiles?.forEach(p => { profilesMap[p.user_id] = p; });
      }

      return subs?.map(sub => ({
        ...sub,
        profile: profilesMap[sub.user_id] || null,
      }));
    },
  });

  // Fetch clients for subscription creation
  const { data: clients } = useQuery({
    queryKey: ["employee-clients-streaming"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, client_number")
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  // Create subscription (employees can create)
  const createSubscriptionMutation = useMutation({
    mutationFn: async (data: any) => {
      const service = services?.find(s => s.id === data.streaming_service_id);
      const { error } = await supabase.from("client_streaming_subscriptions").insert({
        user_id: data.user_id,
        streaming_service_id: data.streaming_service_id,
        monthly_price: service?.monthly_price || 0,
        status: "active",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-streaming-subscriptions"] });
      toast({ title: "Abonnement créé" });
      setSubscriptionDialogOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const filteredServices = services?.filter(s => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return s.name?.toLowerCase().includes(q) || s.description?.toLowerCase().includes(q);
  });

  const filteredSubscriptions = subscriptions?.filter(s => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.profile?.full_name?.toLowerCase().includes(q) ||
      s.profile?.email?.toLowerCase().includes(q) ||
      s.streaming_services?.name?.toLowerCase().includes(q)
    );
  });

  const CategoryIcon = ({ category }: { category: string }) => {
    const Icon = categoryIcons[category] || Tv;
    return <Icon className="w-4 h-4" />;
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <main className="flex-1 p-6">
          <div className="flex items-center gap-4 mb-6">
            <SidebarTrigger />
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Tv className="w-6 h-6 text-primary" />
                Streaming+
              </h1>
              <p className="text-muted-foreground text-sm">Services de streaming disponibles</p>
            </div>
          </div>

          <div className="space-y-6">
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
                <Card>
                  <CardContent className="pt-6">
                    {servicesLoading ? (
                      <p className="text-center py-8 text-muted-foreground">Chargement...</p>
                    ) : filteredServices?.length === 0 ? (
                      <p className="text-center py-8 text-muted-foreground">Aucun service trouvé</p>
                    ) : (
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {filteredServices?.map((service) => (
                          <Card key={service.id} className={!service.is_active ? "opacity-60" : ""}>
                            <CardHeader className="pb-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div className="p-2 rounded-lg bg-primary/10">
                                    <CategoryIcon category={service.category} />
                                  </div>
                                  <CardTitle className="text-lg">{service.name}</CardTitle>
                                </div>
                                <Badge variant={service.is_active ? "default" : "secondary"}>
                                  {service.is_active ? "Actif" : "Inactif"}
                                </Badge>
                              </div>
                            </CardHeader>
                            <CardContent>
                              <p className="text-sm text-muted-foreground mb-3">{service.description}</p>
                              <p className="text-xl font-bold text-primary">${service.monthly_price?.toFixed(2)}/mois</p>
                              {service.features && (service.features as string[]).length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-3">
                                  {(service.features as string[]).map((f, i) => (
                                    <Badge key={i} variant="outline" className="text-xs">{f}</Badge>
                                  ))}
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Subscriptions Tab */}
              <TabsContent value="subscriptions" className="space-y-4">
                <div className="flex justify-end">
                  <Button onClick={() => setSubscriptionDialogOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Nouvel abonnement
                  </Button>
                </div>

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
                            <TableHead>Service</TableHead>
                            <TableHead>Prix</TableHead>
                            <TableHead>Statut</TableHead>
                            <TableHead>Date début</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredSubscriptions?.map((sub) => (
                            <TableRow key={sub.id}>
                              <TableCell>
                                <div>
                                  <p className="font-medium">{sub.profile?.full_name || "Client inconnu"}</p>
                                  <p className="text-xs text-muted-foreground">{sub.profile?.email}</p>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <CategoryIcon category={sub.streaming_services?.category} />
                                  {sub.streaming_services?.name}
                                </div>
                              </TableCell>
                              <TableCell>${sub.monthly_price?.toFixed(2)}</TableCell>
                              <TableCell>
                                <Badge variant={statusLabels[sub.status]?.variant || "default"}>
                                  {statusLabels[sub.status]?.label || sub.status}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {sub.start_date && format(new Date(sub.start_date), "d MMM yyyy", { locale: fr })}
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
        </main>
      </div>

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
    </SidebarProvider>
  );
};

export default EmployeeStreaming;