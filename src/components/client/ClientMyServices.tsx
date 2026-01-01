import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  Wifi, Tv, Smartphone, Shield, Package, AlertTriangle, 
  ArrowUpCircle, Pause, RefreshCw, FileWarning, MessageSquare,
  Loader2, CheckCircle, Clock, BarChart3
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

// Plans matching website exactly
const AVAILABLE_PLANS = {
  internet: [
    { id: "internet-100", name: "Internet Résidentiel 100", price: 49.99, speed: "100 Mbps haute vitesse" },
    { id: "internet-500", name: "Internet Résidentiel 500", price: 69.99, speed: "500 Mbps ultra-rapide" },
    { id: "internet-1gbps", name: "Internet Fibre 1Gbps", price: 89.99, speed: "1 Gbps fibre optique" },
  ],
  tv_bundles: [
    { id: "giga-tv-basic", name: "GIGA + TV Basic", price: 85, description: "Internet + TV de base" },
    { id: "tv-5-int-500", name: "TV 5 chaînes + Internet 500", price: 80, description: "5 chaînes au choix + 500 Mbps" },
    { id: "tv-10-int-500", name: "TV 10 chaînes + Internet 500", price: 90, description: "10 chaînes au choix + 500 Mbps" },
    { id: "tv-15-int-500", name: "TV 15 chaînes + Internet 500", price: 95, description: "15 chaînes au choix + 500 Mbps" },
    { id: "tv-25-int-500", name: "TV 25 chaînes + Internet 500", price: 110, description: "25 chaînes au choix + 500 Mbps" },
  ],
  mobile: [
    { id: "mobile-50", name: "Mobile 50$/30 jours", price: 50, data: "50-55 GB 4G" },
    { id: "mobile-60", name: "Mobile 60$/30 jours", price: 60, data: "75-80 GB 4G" },
  ],
};

const EQUIPMENT_ISSUE_TYPES = [
  { value: "defect", label: "Défaut de fabrication" },
  { value: "damaged", label: "Équipement endommagé" },
  { value: "stolen", label: "Équipement volé" },
  { value: "return_rental", label: "Retour équipement de location" },
];

const MOBILE_ISSUE_TYPES = [
  { value: "sim_stolen", label: "Carte SIM volée" },
  { value: "sim_lost", label: "Carte SIM perdue" },
  { value: "phone_lost", label: "Téléphone perdu" },
  { value: "request_new_sim", label: "Demande nouvelle SIM" },
  { value: "pause_plan", label: "Suspendre le forfait (frais continuent)" },
];

const ClientMyServices = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);
  const [issueDialogOpen, setIssueDialogOpen] = useState(false);
  const [mobileIssueDialogOpen, setMobileIssueDialogOpen] = useState(false);
  const [ticketDialogOpen, setTicketDialogOpen] = useState(false);
  
  const [selectedService, setSelectedService] = useState<any>(null);
  const [selectedPlan, setSelectedPlan] = useState("");
  const [issueType, setIssueType] = useState("");
  const [issueDescription, setIssueDescription] = useState("");
  const [mobileIssueType, setMobileIssueType] = useState("");
  const [mobileIssueDescription, setMobileIssueDescription] = useState("");
  const [ticketSubject, setTicketSubject] = useState("");
  const [ticketDescription, setTicketDescription] = useState("");

  // Fetch subscriptions
  const { data: subscriptions, isLoading: loadingSubs } = useQuery({
    queryKey: ["client-services-subscriptions", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Fetch orders with equipment
  const { data: orders } = useQuery({
    queryKey: ["client-services-orders", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Fetch tickets for message updates
  const { data: tickets } = useQuery({
    queryKey: ["client-services-tickets", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*, ticket_replies(*)")
        .order("updated_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Create support ticket mutation
  const createTicketMutation = useMutation({
    mutationFn: async (ticketData: { subject: string; description: string; priority?: string }) => {
      const { data, error } = await supabase
        .from("support_tickets")
        .insert({
          user_id: user?.id,
          subject: ticketData.subject,
          description: ticketData.description,
          priority: ticketData.priority || "normal",
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["client-services-tickets"] });
      toast({ 
        title: "Ticket créé", 
        description: `Référence: ${data.ticket_number || data.id.slice(0, 8)}` 
      });
      setIssueDialogOpen(false);
      setMobileIssueDialogOpen(false);
      setTicketDialogOpen(false);
      resetForms();
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de créer le ticket", variant: "destructive" });
    },
  });

  // Request plan change/upgrade
  const requestPlanChangeMutation = useMutation({
    mutationFn: async (data: { currentPlan: string; newPlan: string; subscriptionId: string }) => {
      // Create a ticket for plan change request
      const { error } = await supabase
        .from("support_tickets")
        .insert({
          user_id: user?.id,
          subject: `Demande de changement de forfait`,
          description: `Changement demandé:\n- Forfait actuel: ${data.currentPlan}\n- Nouveau forfait: ${data.newPlan}\n- ID abonnement: ${data.subscriptionId}`,
          priority: "normal",
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-services-tickets"] });
      toast({ title: "Demande envoyée", description: "Notre équipe vous contactera sous peu" });
      setUpgradeDialogOpen(false);
      setSelectedPlan("");
    },
    onError: () => {
      toast({ title: "Erreur", variant: "destructive" });
    },
  });

  const resetForms = () => {
    setIssueType("");
    setIssueDescription("");
    setMobileIssueType("");
    setMobileIssueDescription("");
    setTicketSubject("");
    setTicketDescription("");
    setSelectedService(null);
  };

  const handleEquipmentIssue = () => {
    if (!issueType || !selectedService) return;
    const issueLabel = EQUIPMENT_ISSUE_TYPES.find(t => t.value === issueType)?.label || issueType;
    createTicketMutation.mutate({
      subject: `Problème équipement: ${issueLabel}`,
      description: `Type de problème: ${issueLabel}\nÉquipement: ${selectedService.service_type || selectedService.plan_name}\nCommande: ${selectedService.order_number || "N/A"}\n\nDétails: ${issueDescription || "Aucun détail fourni"}`,
      priority: issueType === "stolen" ? "high" : "normal",
    });
  };

  const handleMobileIssue = () => {
    if (!mobileIssueType || !selectedService) return;
    const issueLabel = MOBILE_ISSUE_TYPES.find(t => t.value === mobileIssueType)?.label || mobileIssueType;
    createTicketMutation.mutate({
      subject: `Mobile: ${issueLabel}`,
      description: `Type de demande: ${issueLabel}\nForfait: ${selectedService.plan_name}\nID: ${selectedService.id}\n\nDétails: ${mobileIssueDescription || "Aucun détail fourni"}`,
      priority: mobileIssueType.includes("stolen") ? "high" : "normal",
    });
  };

  const getServiceIcon = (type: string) => {
    if (type?.toLowerCase().includes("internet") || type?.toLowerCase().includes("fibre")) return Wifi;
    if (type?.toLowerCase().includes("tv") || type?.toLowerCase().includes("giga")) return Tv;
    if (type?.toLowerCase().includes("mobile")) return Smartphone;
    if (type?.toLowerCase().includes("security") || type?.toLowerCase().includes("sécurité")) return Shield;
    return Package;
  };

  const getServiceCategory = (planName: string) => {
    const name = planName?.toLowerCase() || "";
    if (name.includes("mobile")) return "mobile";
    if (name.includes("tv") || name.includes("giga")) return "tv";
    if (name.includes("internet") || name.includes("fibre")) return "internet";
    if (name.includes("security") || name.includes("sécurité")) return "security";
    return "other";
  };

  const activeServices = subscriptions?.filter((s: any) => s.status === "active" || s.status === "paused") || [];
  const pausedServices = subscriptions?.filter((s: any) => s.status === "paused") || [];
  const mobileServices = activeServices.filter((s: any) => getServiceCategory(s.plan_name) === "mobile");
  
  // Equipment from orders
  const equipmentOrders = orders?.filter((o: any) => 
    o.equipment_id || o.serial_number || o.imei_number || 
    (o.equipment_details && Array.isArray(o.equipment_details) && o.equipment_details.length > 0)
  ) || [];

  return (
    <div className="space-y-6">
      <Tabs defaultValue="services" className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-6">
          <TabsTrigger value="services">Mes services</TabsTrigger>
          <TabsTrigger value="equipment">Équipements</TabsTrigger>
          <TabsTrigger value="mobile">Mobile</TabsTrigger>
          <TabsTrigger value="updates">Mises à jour</TabsTrigger>
        </TabsList>

        {/* Active Services Tab */}
        <TabsContent value="services" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">Services actifs</h3>
            <Button variant="outline" size="sm" onClick={() => setTicketDialogOpen(true)}>
              <MessageSquare className="w-4 h-4 mr-2" />
              Nouveau ticket
            </Button>
          </div>

          {loadingSubs ? (
            <div className="space-y-3">
              {[1, 2].map(i => <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />)}
            </div>
          ) : activeServices.length > 0 ? (
            <div className="space-y-4">
              {activeServices.map((service: any) => {
                const Icon = getServiceIcon(service.plan_name);
                const category = getServiceCategory(service.plan_name);
                const isPaused = service.status === "paused";
                
                return (
                  <Card key={service.id} className="bg-card border-border">
                    <CardContent className="p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-start gap-4">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                            isPaused ? "bg-amber-500/20" : "bg-cyan-500/20"
                          }`}>
                            <Icon className={`w-6 h-6 ${isPaused ? "text-amber-500" : "text-cyan-500"}`} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold text-foreground">{service.plan_name}</h4>
                              {isPaused && (
                                <Badge className="bg-amber-500/20 text-amber-500">
                                  <Pause className="w-3 h-3 mr-1" />
                                  Suspendu
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {Number(service.amount).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}/
                              {service.billing_cycle === "monthly" ? "mois" : "an"}
                            </p>
                            {service.next_billing_date && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Prochaine facturation: {format(new Date(service.next_billing_date), "d MMM yyyy", { locale: fr })}
                              </p>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex flex-wrap gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              setSelectedService(service);
                              setUpgradeDialogOpen(true);
                            }}
                          >
                            <ArrowUpCircle className="w-4 h-4 mr-1" />
                            Changer forfait
                          </Button>
                          {category === "mobile" && (
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                setSelectedService(service);
                                setMobileIssueDialogOpen(true);
                              }}
                            >
                              <Smartphone className="w-4 h-4 mr-1" />
                              Gérer
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="bg-card border-border">
              <CardContent className="p-8 text-center">
                <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Aucun service actif</p>
                <Button variant="hero" className="mt-4" asChild>
                  <a href="/portal/new-order">Commander un service</a>
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Equipment Tab */}
        <TabsContent value="equipment" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">Mes équipements</h3>
          </div>

          {equipmentOrders.length > 0 ? (
            <div className="space-y-4">
              {equipmentOrders.map((order: any) => {
                const equipmentList = order.equipment_details && Array.isArray(order.equipment_details) 
                  ? order.equipment_details 
                  : [];
                
                // Calculate warranty status (1 year from order)
                const orderDate = new Date(order.created_at);
                const warrantyEnd = new Date(orderDate);
                warrantyEnd.setFullYear(warrantyEnd.getFullYear() + 1);
                const isUnderWarranty = new Date() < warrantyEnd;

                return (
                  <Card key={order.id} className="bg-card border-border">
                    <CardContent className="p-4">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Package className="w-5 h-5 text-cyan-500" />
                            <h4 className="font-semibold text-foreground">
                              {order.order_number || `Commande ${order.id.slice(0, 8)}`}
                            </h4>
                            <Badge className={isUnderWarranty ? "bg-emerald-500/20 text-emerald-500" : "bg-muted text-muted-foreground"}>
                              {isUnderWarranty ? "Sous garantie" : "Garantie expirée"}
                            </Badge>
                          </div>
                          
                          <div className="space-y-1 text-sm">
                            {order.equipment_id && (
                              <p className="text-muted-foreground">ID: {order.equipment_id}</p>
                            )}
                            {order.serial_number && (
                              <p className="text-muted-foreground">Série: {order.serial_number}</p>
                            )}
                            {order.imei_number && (
                              <p className="text-muted-foreground">IMEI: {order.imei_number}</p>
                            )}
                            {equipmentList.map((eq: any, idx: number) => (
                              <p key={idx} className="text-foreground">• {eq.name || eq}</p>
                            ))}
                          </div>
                          
                          <p className="text-xs text-muted-foreground mt-2">
                            Garantie jusqu'au: {format(warrantyEnd, "d MMM yyyy", { locale: fr })}
                          </p>
                        </div>
                        
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            setSelectedService(order);
                            setIssueDialogOpen(true);
                          }}
                        >
                          <AlertTriangle className="w-4 h-4 mr-1" />
                          Signaler un problème
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="bg-card border-border">
              <CardContent className="p-8 text-center">
                <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Aucun équipement enregistré</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Mobile Management Tab */}
        <TabsContent value="mobile" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">Forfaits mobiles</h3>
          </div>

          {mobileServices.length > 0 ? (
            <div className="space-y-4">
              {mobileServices.map((service: any) => {
                const isPaused = service.status === "paused";
                
                return (
                  <Card key={service.id} className="bg-card border-border">
                    <CardContent className="p-4">
                      <div className="flex flex-col gap-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-4">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                              isPaused ? "bg-amber-500/20" : "bg-emerald-500/20"
                            }`}>
                              <Smartphone className={`w-6 h-6 ${isPaused ? "text-amber-500" : "text-emerald-500"}`} />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-semibold text-foreground">{service.plan_name}</h4>
                                {isPaused && (
                                  <Badge className="bg-amber-500/20 text-amber-500">Suspendu</Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {Number(service.amount).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}/30 jours
                              </p>
                            </div>
                          </div>
                          <Badge variant="outline" className="hidden sm:flex">
                            <BarChart3 className="w-3 h-3 mr-1" />
                            Données: Voir forfait
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="text-amber-600"
                            onClick={() => {
                              setSelectedService(service);
                              setMobileIssueType("sim_stolen");
                              setMobileIssueDialogOpen(true);
                            }}
                          >
                            <FileWarning className="w-4 h-4 mr-1" />
                            SIM volée
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              setSelectedService(service);
                              setMobileIssueType("sim_lost");
                              setMobileIssueDialogOpen(true);
                            }}
                          >
                            <RefreshCw className="w-4 h-4 mr-1" />
                            SIM perdue
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              setSelectedService(service);
                              setMobileIssueType("phone_lost");
                              setMobileIssueDialogOpen(true);
                            }}
                          >
                            <Smartphone className="w-4 h-4 mr-1" />
                            Tél. perdu
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              setSelectedService(service);
                              setMobileIssueType("pause_plan");
                              setMobileIssueDialogOpen(true);
                            }}
                          >
                            <Pause className="w-4 h-4 mr-1" />
                            Suspendre
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="bg-card border-border">
              <CardContent className="p-8 text-center">
                <Smartphone className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Aucun forfait mobile actif</p>
                <Button variant="hero" className="mt-4" asChild>
                  <a href="/mobile-plans">Voir les forfaits mobiles</a>
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Updates Tab */}
        <TabsContent value="updates" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">Mises à jour récentes</h3>
          </div>

          {tickets && tickets.length > 0 ? (
            <div className="space-y-3">
              {tickets.map((ticket: any) => {
                const latestReply = ticket.ticket_replies?.sort((a: any, b: any) => 
                  new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                )[0];
                
                return (
                  <Card key={ticket.id} className="bg-card border-border">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-mono text-muted-foreground">
                              {ticket.ticket_number || ticket.id.slice(0, 8)}
                            </span>
                            <Badge className={
                              ticket.status === "open" ? "bg-cyan-500/20 text-cyan-500" :
                              ticket.status === "in_progress" ? "bg-amber-500/20 text-amber-500" :
                              "bg-muted text-muted-foreground"
                            }>
                              {ticket.status === "open" ? "Ouvert" : 
                               ticket.status === "in_progress" ? "En cours" : "Fermé"}
                            </Badge>
                          </div>
                          <h4 className="font-medium text-foreground">{ticket.subject}</h4>
                          {latestReply && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                              <span className="font-medium">{latestReply.is_admin ? "Support:" : "Vous:"}</span> {latestReply.content}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground mt-2">
                            <Clock className="w-3 h-3 inline mr-1" />
                            {format(new Date(ticket.updated_at), "d MMM yyyy 'à' HH:mm", { locale: fr })}
                          </p>
                        </div>
                        <Button variant="ghost" size="sm" asChild>
                          <a href="/portal/tickets">Voir</a>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="bg-card border-border">
              <CardContent className="p-8 text-center">
                <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Aucune mise à jour récente</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Upgrade/Change Plan Dialog */}
      <Dialog open={upgradeDialogOpen} onOpenChange={setUpgradeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Changer de forfait</DialogTitle>
            <DialogDescription>
              Sélectionnez votre nouveau forfait. Notre équipe vous contactera pour confirmer le changement.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>Forfait actuel</Label>
              <p className="text-foreground font-medium">{selectedService?.plan_name}</p>
            </div>
            <div>
              <Label>Nouveau forfait</Label>
              <Select value={selectedPlan} onValueChange={setSelectedPlan}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir un forfait" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="" disabled>Internet</SelectItem>
                  {AVAILABLE_PLANS.internet.map(plan => (
                    <SelectItem key={plan.id} value={plan.name}>
                      {plan.name} - {plan.price}$/mois
                    </SelectItem>
                  ))}
                  <SelectItem value="" disabled>TV + Internet</SelectItem>
                  {AVAILABLE_PLANS.tv_bundles.map(plan => (
                    <SelectItem key={plan.id} value={plan.name}>
                      {plan.name} - {plan.price}$/mois
                    </SelectItem>
                  ))}
                  <SelectItem value="" disabled>Mobile</SelectItem>
                  {AVAILABLE_PLANS.mobile.map(plan => (
                    <SelectItem key={plan.id} value={plan.name}>
                      {plan.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setUpgradeDialogOpen(false)}>
              Annuler
            </Button>
            <Button 
              variant="hero" 
              onClick={() => requestPlanChangeMutation.mutate({
                currentPlan: selectedService?.plan_name,
                newPlan: selectedPlan,
                subscriptionId: selectedService?.id,
              })}
              disabled={!selectedPlan || requestPlanChangeMutation.isPending}
            >
              {requestPlanChangeMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Demander le changement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Equipment Issue Dialog */}
      <Dialog open={issueDialogOpen} onOpenChange={setIssueDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Signaler un problème d'équipement</DialogTitle>
            <DialogDescription>
              Décrivez le problème rencontré avec votre équipement.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>Type de problème</Label>
              <Select value={issueType} onValueChange={setIssueType}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  {EQUIPMENT_ISSUE_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Détails (optionnel)</Label>
              <Textarea
                placeholder="Décrivez le problème..."
                value={issueDescription}
                onChange={(e) => setIssueDescription(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setIssueDialogOpen(false)}>
              Annuler
            </Button>
            <Button 
              variant="hero" 
              onClick={handleEquipmentIssue}
              disabled={!issueType || createTicketMutation.isPending}
            >
              {createTicketMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Soumettre
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mobile Issue Dialog */}
      <Dialog open={mobileIssueDialogOpen} onOpenChange={setMobileIssueDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gestion forfait mobile</DialogTitle>
            <DialogDescription>
              {mobileIssueType === "pause_plan" 
                ? "La suspension garde votre forfait actif. Les frais mensuels continuent d'être facturés."
                : "Décrivez votre demande concernant votre forfait mobile."
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>Type de demande</Label>
              <Select value={mobileIssueType} onValueChange={setMobileIssueType}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  {MOBILE_ISSUE_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {mobileIssueType === "pause_plan" && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <p className="text-sm text-amber-600">
                  <AlertTriangle className="w-4 h-4 inline mr-1" />
                  Les frais mensuels continuent pendant la suspension.
                </p>
              </div>
            )}
            <div>
              <Label>Détails (optionnel)</Label>
              <Textarea
                placeholder="Informations supplémentaires..."
                value={mobileIssueDescription}
                onChange={(e) => setMobileIssueDescription(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setMobileIssueDialogOpen(false)}>
              Annuler
            </Button>
            <Button 
              variant="hero" 
              onClick={handleMobileIssue}
              disabled={!mobileIssueType || createTicketMutation.isPending}
            >
              {createTicketMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Soumettre la demande
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Ticket Dialog */}
      <Dialog open={ticketDialogOpen} onOpenChange={setTicketDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Créer un ticket de support</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>Sujet</Label>
              <Select value={ticketSubject} onValueChange={setTicketSubject}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir un sujet" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Question facturation">Question facturation</SelectItem>
                  <SelectItem value="Problème technique">Problème technique</SelectItem>
                  <SelectItem value="Demande installation">Demande installation</SelectItem>
                  <SelectItem value="Changement de forfait">Changement de forfait</SelectItem>
                  <SelectItem value="Autre demande">Autre demande</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                placeholder="Décrivez votre demande en détail..."
                value={ticketDescription}
                onChange={(e) => setTicketDescription(e.target.value)}
                rows={5}
              />
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setTicketDialogOpen(false)}>
              Annuler
            </Button>
            <Button 
              variant="hero" 
              onClick={() => createTicketMutation.mutate({
                subject: ticketSubject,
                description: ticketDescription,
              })}
              disabled={!ticketSubject || !ticketDescription || createTicketMutation.isPending}
            >
              {createTicketMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Créer le ticket
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClientMyServices;
