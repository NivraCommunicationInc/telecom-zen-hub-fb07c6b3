import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { portalClient as supabase } from "@/integrations/backend";
import { useClientAuth } from "@/hooks/useClientAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import ClientLayout from "@/components/client/ClientLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { 
  Package, 
  Plus, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Truck, 
  FileText,
  MessageSquare,
  ArrowRight,
  RefreshCw,
  Smartphone,
  Router,
  CreditCard,
  Wrench,
  Calendar
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface ReplacementTicket {
  id: string;
  ticket_number: string;
  category: string;
  reason: string;
  reason_details: string;
  client_message: string;
  preferred_fulfillment: string;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
}

interface ReplacementShipment {
  id: string;
  ticket_id: string;
  carrier: string;
  tracking_number: string;
  tracking_url: string;
  status: string;
  shipped_at: string;
  delivered_at: string;
}

interface TimelineEvent {
  id: string;
  ticket_id: string;
  event_type: string;
  event_title: string;
  event_description: string;
  created_at: string;
}

interface Invoice {
  id: string;
  invoice_number: string;
  amount: number;
  status: string;
  created_at: string;
  replacement_ticket_id: string | null;
}

const CATEGORIES = [
  { value: "sim", label: { fr: "Carte SIM", en: "SIM Card" }, icon: CreditCard },
  { value: "router", label: { fr: "Routeur", en: "Router" }, icon: Router },
  { value: "terminal", label: { fr: "Terminal TV", en: "TV Terminal" }, icon: Package },
  { value: "phone", label: { fr: "Téléphone", en: "Phone" }, icon: Smartphone },
  { value: "accessory", label: { fr: "Accessoire", en: "Accessory" }, icon: Package },
  { value: "equipment", label: { fr: "Autre équipement", en: "Other Equipment" }, icon: Wrench },
];

const REASONS = [
  { value: "lost", label: { fr: "Perdu", en: "Lost" } },
  { value: "stolen", label: { fr: "Volé", en: "Stolen" } },
  { value: "broken", label: { fr: "Brisé", en: "Broken" } },
  { value: "defective", label: { fr: "Défectueux", en: "Defective" } },
  { value: "upgrade", label: { fr: "Mise à niveau", en: "Upgrade" } },
  { value: "other", label: { fr: "Autre", en: "Other" } },
];

const FULFILLMENT_OPTIONS = [
  { value: "ship", label: { fr: "Livraison par la poste", en: "Ship to me" }, icon: Truck },
  { value: "technician", label: { fr: "Installation par technicien", en: "Technician installation" }, icon: Wrench },
  { value: "pickup", label: { fr: "Ramassage en magasin", en: "Store pickup" }, icon: Package },
];

const ClientReplacementRequest = () => {
  const { user } = useClientAuth();
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const isFrench = language === "fr";
  
  const [activeTab, setActiveTab] = useState("my-requests");
  const [showForm, setShowForm] = useState(false);
  
  // Form state
  const [category, setCategory] = useState("");
  const [reason, setReason] = useState("");
  const [reasonDetails, setReasonDetails] = useState("");
  const [clientMessage, setClientMessage] = useState("");
  const [preferredFulfillment, setPreferredFulfillment] = useState("ship");
  const [billableAcknowledged, setBillableAcknowledged] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState("");

  // Fetch user profile
  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch user accounts
  const { data: accounts = [] } = useQuery({
    queryKey: ["client-accounts", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("accounts")
        .select("*")
        .eq("client_id", user.id)
        .eq("status", "active");
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch replacement tickets
  const { data: tickets = [], isLoading: ticketsLoading } = useQuery({
    queryKey: ["client-replacement-tickets", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("replacement_request_tickets")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ReplacementTicket[];
    },
    enabled: !!user?.id,
  });

  // Fetch shipments for user's tickets
  const { data: shipments = [] } = useQuery({
    queryKey: ["client-replacement-shipments", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("replacement_shipments")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ReplacementShipment[];
    },
    enabled: !!user?.id,
  });

  // Fetch timeline events
  const { data: timelineEvents = [] } = useQuery({
    queryKey: ["client-replacement-timeline", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("replacement_timeline")
        .select("*")
        .eq("visible_to_client", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as TimelineEvent[];
    },
    enabled: !!user?.id,
  });

  // Fetch related invoices
  const { data: invoices = [] } = useQuery({
    queryKey: ["client-replacement-invoices", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("billing")
        .select("id, invoice_number, amount, status, created_at, replacement_ticket_id")
        .eq("user_id", user.id)
        .not("replacement_ticket_id", "is", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Invoice[];
    },
    enabled: !!user?.id,
  });

  // Create ticket mutation
  const createTicketMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Not authenticated");
      
      const { data, error } = await supabase
        .from("replacement_request_tickets")
        .insert({
          user_id: user.id,
          account_id: selectedAccountId || null,
          client_email: profile?.email || user.email,
          client_name: profile?.full_name || "",
          category,
          reason,
          reason_details: reasonDetails,
          client_message: clientMessage,
          preferred_fulfillment: preferredFulfillment,
          billable_acknowledged: billableAcknowledged,
          status: "open",
          priority: "normal",
        })
        .select()
        .single();
      
      if (error) throw error;

      // Add timeline event
      await supabase.from("replacement_timeline").insert({
        ticket_id: data.id,
        event_type: "ticket_created",
        event_title: isFrench ? "Demande créée" : "Request Created",
        event_description: isFrench 
          ? `Demande de remplacement pour ${getCategoryLabel(category)}`
          : `Replacement request for ${getCategoryLabel(category)}`,
        visible_to_client: true,
        actor_id: user.id,
        actor_name: profile?.full_name || "Client",
        actor_role: "client",
      });

      return data;
    },
    onSuccess: () => {
      toast.success(isFrench ? "Demande soumise avec succès!" : "Request submitted successfully!");
      setShowForm(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["client-replacement-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["client-replacement-timeline"] });
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const resetForm = () => {
    setCategory("");
    setReason("");
    setReasonDetails("");
    setClientMessage("");
    setPreferredFulfillment("ship");
    setBillableAcknowledged(false);
    setSelectedAccountId("");
  };

  const getCategoryLabel = (cat: string) => {
    const found = CATEGORIES.find(c => c.value === cat);
    return found ? found.label[isFrench ? "fr" : "en"] : cat;
  };

  const getReasonLabel = (r: string) => {
    const found = REASONS.find(x => x.value === r);
    return found ? found.label[isFrench ? "fr" : "en"] : r;
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }> = {
      open: { label: isFrench ? "Ouvert" : "Open", variant: "default", icon: <Clock className="w-3 h-3" /> },
      needs_quote: { label: isFrench ? "Devis en cours" : "Quote Pending", variant: "secondary", icon: <FileText className="w-3 h-3" /> },
      quote_sent: { label: isFrench ? "Devis envoyé" : "Quote Sent", variant: "secondary", icon: <FileText className="w-3 h-3" /> },
      invoiced: { label: isFrench ? "Facturé" : "Invoiced", variant: "outline", icon: <FileText className="w-3 h-3" /> },
      awaiting_payment: { label: isFrench ? "Attente paiement" : "Awaiting Payment", variant: "outline", icon: <CreditCard className="w-3 h-3" /> },
      paid: { label: isFrench ? "Payé" : "Paid", variant: "default", icon: <CheckCircle2 className="w-3 h-3" /> },
      fulfillment_in_progress: { label: isFrench ? "En cours" : "In Progress", variant: "secondary", icon: <Truck className="w-3 h-3" /> },
      completed: { label: isFrench ? "Terminé" : "Completed", variant: "default", icon: <CheckCircle2 className="w-3 h-3" /> },
      cancelled: { label: isFrench ? "Annulé" : "Cancelled", variant: "destructive", icon: <AlertCircle className="w-3 h-3" /> },
    };
    const config = statusConfig[status] || { label: status, variant: "outline" as const, icon: null };
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        {config.icon}
        {config.label}
      </Badge>
    );
  };

  const canSubmit = category && reason && billableAcknowledged;

  return (
    <ClientLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <RefreshCw className="h-8 w-8 text-primary" />
              {isFrench ? "Remplacement & Accessoires" : "Replacement & Accessories"}
            </h1>
            <p className="text-muted-foreground mt-1">
              {isFrench 
                ? "Demandez un remplacement de SIM, équipement ou accessoire" 
                : "Request a SIM, equipment, or accessory replacement"}
            </p>
          </div>
          {!showForm && (
            <Button onClick={() => setShowForm(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              {isFrench ? "Nouvelle demande" : "New Request"}
            </Button>
          )}
        </div>

        {/* New Request Form */}
        {showForm && (
          <Card className="border-primary/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                {isFrench ? "Nouvelle demande de remplacement" : "New Replacement Request"}
              </CardTitle>
              <CardDescription>
                {isFrench 
                  ? "Remplissez le formulaire pour soumettre votre demande"
                  : "Fill out the form to submit your request"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Account Selection */}
              {accounts.length > 0 && (
                <div className="space-y-2">
                  <Label>{isFrench ? "Compte" : "Account"}</Label>
                  <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                    <SelectTrigger>
                      <SelectValue placeholder={isFrench ? "Sélectionner un compte" : "Select account"} />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map(acc => (
                        <SelectItem key={acc.id} value={acc.id}>
                          {acc.account_number} - {acc.account_name || "Primary"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Category Selection */}
              <div className="space-y-2">
                <Label>{isFrench ? "Type d'article *" : "Item Type *"}</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {CATEGORIES.map(cat => {
                    const Icon = cat.icon;
                    const isSelected = category === cat.value;
                    return (
                      <div
                        key={cat.value}
                        className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                          isSelected 
                            ? "border-primary bg-primary/10" 
                            : "border-border hover:border-primary/50"
                        }`}
                        onClick={() => setCategory(cat.value)}
                      >
                        <div className="flex items-center gap-2">
                          <Icon className={`h-5 w-5 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                          <span className={isSelected ? "font-medium" : ""}>{cat.label[isFrench ? "fr" : "en"]}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Reason Selection */}
              <div className="space-y-2">
                <Label>{isFrench ? "Raison *" : "Reason *"}</Label>
                <Select value={reason} onValueChange={setReason}>
                  <SelectTrigger>
                    <SelectValue placeholder={isFrench ? "Sélectionner la raison" : "Select reason"} />
                  </SelectTrigger>
                  <SelectContent>
                    {REASONS.map(r => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label[isFrench ? "fr" : "en"]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Reason Details */}
              <div className="space-y-2">
                <Label>{isFrench ? "Détails supplémentaires" : "Additional Details"}</Label>
                <Textarea
                  value={reasonDetails}
                  onChange={(e) => setReasonDetails(e.target.value)}
                  placeholder={isFrench ? "Décrivez la situation..." : "Describe the situation..."}
                  rows={3}
                />
              </div>

              {/* Preferred Fulfillment */}
              <div className="space-y-2">
                <Label>{isFrench ? "Mode de livraison préféré" : "Preferred Fulfillment"}</Label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {FULFILLMENT_OPTIONS.map(opt => {
                    const Icon = opt.icon;
                    const isSelected = preferredFulfillment === opt.value;
                    return (
                      <div
                        key={opt.value}
                        className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                          isSelected 
                            ? "border-primary bg-primary/10" 
                            : "border-border hover:border-primary/50"
                        }`}
                        onClick={() => setPreferredFulfillment(opt.value)}
                      >
                        <div className="flex items-center gap-2">
                          <Icon className={`h-5 w-5 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                          <span className={isSelected ? "font-medium" : ""}>{opt.label[isFrench ? "fr" : "en"]}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Additional Message */}
              <div className="space-y-2">
                <Label>{isFrench ? "Message (optionnel)" : "Message (optional)"}</Label>
                <Textarea
                  value={clientMessage}
                  onChange={(e) => setClientMessage(e.target.value)}
                  placeholder={isFrench ? "Informations supplémentaires..." : "Additional information..."}
                  rows={2}
                />
              </div>

              {/* Billable Acknowledgement */}
              <Card className="bg-amber-500/10 border-amber-500/30">
                <CardContent className="py-4">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="billable"
                      checked={billableAcknowledged}
                      onCheckedChange={(checked) => setBillableAcknowledged(checked as boolean)}
                    />
                    <div>
                      <Label htmlFor="billable" className="font-medium cursor-pointer">
                        {isFrench 
                          ? "Je comprends que le remplacement peut être facturé *"
                          : "I understand that the replacement may be billable *"}
                      </Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        {isFrench
                          ? "Une facture sera émise avant l'expédition ou l'installation. Le traitement commencera après réception du paiement."
                          : "An invoice will be issued before shipping or installation. Processing will begin after payment is received."}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => { setShowForm(false); resetForm(); }}>
                  {isFrench ? "Annuler" : "Cancel"}
                </Button>
                <Button 
                  onClick={() => createTicketMutation.mutate()}
                  disabled={!canSubmit || createTicketMutation.isPending}
                >
                  {createTicketMutation.isPending 
                    ? (isFrench ? "Envoi..." : "Submitting...") 
                    : (isFrench ? "Soumettre la demande" : "Submit Request")}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs for requests and history */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="my-requests" className="gap-2">
              <Package className="h-4 w-4" />
              {isFrench ? "Mes demandes" : "My Requests"}
            </TabsTrigger>
            <TabsTrigger value="tracking" className="gap-2">
              <Truck className="h-4 w-4" />
              {isFrench ? "Suivi" : "Tracking"}
            </TabsTrigger>
          </TabsList>

          {/* My Requests Tab */}
          <TabsContent value="my-requests" className="space-y-4">
            {ticketsLoading ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  {isFrench ? "Chargement..." : "Loading..."}
                </CardContent>
              </Card>
            ) : tickets.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Package className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
                  <h3 className="text-lg font-semibold mb-2">
                    {isFrench ? "Aucune demande" : "No Requests"}
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    {isFrench 
                      ? "Vous n'avez pas encore de demande de remplacement."
                      : "You don't have any replacement requests yet."}
                  </p>
                  <Button onClick={() => setShowForm(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    {isFrench ? "Créer une demande" : "Create Request"}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {tickets.map(ticket => {
                  const ticketInvoices = invoices.filter(inv => inv.replacement_ticket_id === ticket.id);
                  const ticketTimeline = timelineEvents.filter(ev => ev.ticket_id === ticket.id);
                  const ticketShipment = shipments.find(s => s.ticket_id === ticket.id);
                  
                  return (
                    <Card key={ticket.id} className="border-l-4 border-l-primary">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-lg flex items-center gap-2">
                              {ticket.ticket_number}
                              {getStatusBadge(ticket.status)}
                            </CardTitle>
                            <CardDescription>
                              {getCategoryLabel(ticket.category)} • {getReasonLabel(ticket.reason)}
                            </CardDescription>
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(ticket.created_at), "d MMM yyyy", { locale: isFrench ? fr : undefined })}
                          </span>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Reason Details */}
                        {ticket.reason_details && (
                          <div className="text-sm text-muted-foreground">
                            {ticket.reason_details}
                          </div>
                        )}

                        {/* Invoice Info */}
                        {ticketInvoices.length > 0 && (
                          <div className="bg-muted/50 rounded-lg p-3">
                            <h4 className="font-medium flex items-center gap-2 mb-2">
                              <FileText className="h-4 w-4" />
                              {isFrench ? "Facture" : "Invoice"}
                            </h4>
                            {ticketInvoices.map(inv => (
                              <div key={inv.id} className="flex items-center justify-between text-sm">
                                <span>{inv.invoice_number}</span>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">${inv.amount.toFixed(2)}</span>
                                  <Badge variant={inv.status === "paid" ? "default" : "outline"}>
                                    {inv.status === "paid" 
                                      ? (isFrench ? "Payé" : "Paid") 
                                      : (isFrench ? "En attente" : "Pending")}
                                  </Badge>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Shipment Tracking */}
                        {ticketShipment && (
                          <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-3 border border-green-200 dark:border-green-900">
                            <h4 className="font-medium flex items-center gap-2 mb-2 text-green-700 dark:text-green-400">
                              <Truck className="h-4 w-4" />
                              {isFrench ? "Suivi d'expédition" : "Shipment Tracking"}
                            </h4>
                            <div className="text-sm space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">{isFrench ? "Transporteur" : "Carrier"}:</span>
                                <span>{ticketShipment.carrier}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">{isFrench ? "Numéro de suivi" : "Tracking #"}:</span>
                                {ticketShipment.tracking_url ? (
                                  <a 
                                    href={ticketShipment.tracking_url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline"
                                  >
                                    {ticketShipment.tracking_number}
                                  </a>
                                ) : (
                                  <span>{ticketShipment.tracking_number}</span>
                                )}
                              </div>
                              {ticketShipment.shipped_at && (
                                <div className="flex items-center justify-between">
                                  <span className="text-muted-foreground">{isFrench ? "Expédié le" : "Shipped on"}:</span>
                                  <span>{format(new Date(ticketShipment.shipped_at), "d MMM yyyy")}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Timeline Preview */}
                        {ticketTimeline.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="text-sm font-medium text-muted-foreground">
                              {isFrench ? "Dernières mises à jour" : "Recent Updates"}
                            </h4>
                            <div className="space-y-2">
                              {ticketTimeline.slice(0, 3).map(event => (
                                <div key={event.id} className="flex items-start gap-2 text-sm">
                                  <div className="w-2 h-2 rounded-full bg-primary mt-1.5" />
                                  <div>
                                    <span className="font-medium">{event.event_title}</span>
                                    <span className="text-muted-foreground ml-2">
                                      {format(new Date(event.created_at), "d MMM HH:mm", { locale: isFrench ? fr : undefined })}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Tracking Tab */}
          <TabsContent value="tracking" className="space-y-4">
            {shipments.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Truck className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
                  <h3 className="text-lg font-semibold mb-2">
                    {isFrench ? "Aucune expédition" : "No Shipments"}
                  </h3>
                  <p className="text-muted-foreground">
                    {isFrench 
                      ? "Vos expéditions apparaîtront ici une fois traitées."
                      : "Your shipments will appear here once processed."}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {shipments.map(shipment => (
                  <Card key={shipment.id}>
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="p-3 rounded-full bg-primary/10">
                            <Truck className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{shipment.carrier}</p>
                            <p className="text-sm text-muted-foreground">{shipment.tracking_number}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant={shipment.status === "delivered" ? "default" : "secondary"}>
                            {shipment.status === "delivered" 
                              ? (isFrench ? "Livré" : "Delivered")
                              : shipment.status === "shipped"
                              ? (isFrench ? "Expédié" : "Shipped")
                              : (isFrench ? "En transit" : "In Transit")}
                          </Badge>
                          {shipment.tracking_url && (
                            <a
                              href={shipment.tracking_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-primary hover:underline block mt-1"
                            >
                              {isFrench ? "Suivre le colis" : "Track Package"}
                            </a>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </ClientLayout>
  );
};

export default ClientReplacementRequest;
