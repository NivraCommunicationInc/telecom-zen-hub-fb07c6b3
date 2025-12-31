import { useState, useRef } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  Users, Plus, Search, Eye, Upload, FileText, Trash2, 
  ShoppingBag, CreditCard, Ticket, Calendar, Bell, Package,
  DollarSign, Clock, AlertCircle, Wallet, Ban, Pause, Play, MinusCircle, PlusCircle
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, differenceInDays, addDays } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { useActivityLog } from "@/hooks/useActivityLog";

const AdminClients = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { logActivity } = useActivityLog();
  const [searchQuery, setSearchQuery] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [newClient, setNewClient] = useState({
    email: "",
    password: "",
    full_name: "",
    phone: "",
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch all clients
  const { data: clients, isLoading } = useQuery({
    queryKey: ["admin-clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*, user_roles(role)")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Fetch client-specific data when a client is selected
  const { data: clientOrders } = useQuery({
    queryKey: ["client-orders", selectedClient?.user_id],
    queryFn: async () => {
      if (!selectedClient?.user_id) return [];
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .or(`user_id.eq.${selectedClient.user_id},client_email.eq.${selectedClient.email}`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedClient?.user_id,
  });

  const { data: clientBilling } = useQuery({
    queryKey: ["client-billing", selectedClient?.user_id],
    queryFn: async () => {
      if (!selectedClient?.user_id) return [];
      const { data, error } = await supabase
        .from("billing")
        .select("*")
        .or(`user_id.eq.${selectedClient.user_id},client_email.eq.${selectedClient.email}`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedClient?.user_id,
  });

  const { data: clientTickets } = useQuery({
    queryKey: ["client-tickets", selectedClient?.user_id],
    queryFn: async () => {
      if (!selectedClient?.user_id) return [];
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .or(`user_id.eq.${selectedClient.user_id},client_email.eq.${selectedClient.email}`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedClient?.user_id,
  });

  const { data: clientSubscriptions } = useQuery({
    queryKey: ["client-subscriptions", selectedClient?.user_id],
    queryFn: async () => {
      if (!selectedClient?.user_id) return [];
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", selectedClient.user_id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedClient?.user_id,
  });

  const { data: clientAppointments } = useQuery({
    queryKey: ["client-appointments", selectedClient?.user_id],
    queryFn: async () => {
      if (!selectedClient?.user_id) return [];
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .or(`client_id.eq.${selectedClient.user_id},client_email.eq.${selectedClient.email}`)
        .order("scheduled_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedClient?.user_id,
  });

  const { data: clientDocuments } = useQuery({
    queryKey: ["client-documents", selectedClient?.user_id],
    queryFn: async () => {
      if (!selectedClient?.user_id) return [];
      const { data, error } = await supabase
        .from("client_documents")
        .select("*")
        .eq("user_id", selectedClient.user_id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedClient?.user_id,
  });

  const filteredClients = clients?.filter((client: any) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      client.full_name?.toLowerCase().includes(query) ||
      client.email?.toLowerCase().includes(query) ||
      client.phone?.includes(query)
    );
  });

  const createClientMutation = useMutation({
    mutationFn: async (client: typeof newClient) => {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: client.email,
        password: client.password,
        options: {
          data: { full_name: client.full_name },
        },
      });
      if (authError) throw authError;

      if (authData.user) {
        const { error: profileError } = await supabase
          .from("profiles")
          .update({ phone: client.phone })
          .eq("user_id", authData.user.id);
        if (profileError) throw profileError;
      }
      return authData;
    },
    onSuccess: async () => {
      // Force immediate refetch to ensure the new client appears
      await queryClient.invalidateQueries({ queryKey: ["admin-clients"] });
      await queryClient.refetchQueries({ queryKey: ["admin-clients"] });
      logActivity("create", "client", undefined, { email: newClient.email });
      toast({ 
        title: "Client créé avec succès",
        description: `${newClient.full_name} a été ajouté au système`
      });
      setCreateDialogOpen(false);
      setNewClient({ email: "", password: "", full_name: "", phone: "" });
    },
    onError: (error: any) => {
      console.error("Client creation error:", error);
      toast({ title: "Erreur lors de la création", description: error.message, variant: "destructive" });
    },
  });

  const updateClientMutation = useMutation({
    mutationFn: async (client: any) => {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: client.full_name,
          phone: client.phone,
          internal_notes: client.internal_notes,
          sector_tags: client.sector_tags,
          employer_discount: client.employer_discount,
          balance: client.balance,
          store_credit: client.store_credit,
          account_status: client.account_status,
        })
        .eq("id", client.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-clients"] });
      logActivity("update", "client", selectedClient?.id);
      toast({ title: "Client mis à jour" });
    },
    onError: () => {
      toast({ title: "Erreur lors de la mise à jour", variant: "destructive" });
    },
  });

  const adjustBalanceMutation = useMutation({
    mutationFn: async ({ clientId, field, amount, operation }: { clientId: string; field: 'balance' | 'store_credit'; amount: number; operation: 'add' | 'remove' }) => {
      const { data: current, error: fetchError } = await supabase
        .from("profiles")
        .select(field)
        .eq("id", clientId)
        .single();
      if (fetchError) throw fetchError;
      
      const currentValue = Number(current?.[field] || 0);
      const newValue = operation === 'add' ? currentValue + amount : Math.max(0, currentValue - amount);
      
      const { error } = await supabase
        .from("profiles")
        .update({ [field]: newValue })
        .eq("id", clientId);
      if (error) throw error;
      
      return newValue;
    },
    onSuccess: (newValue, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-clients"] });
      setSelectedClient((prev: any) => prev ? { ...prev, [variables.field]: newValue } : prev);
      logActivity("update", "client", selectedClient?.id, { field: variables.field, operation: variables.operation });
      toast({ title: variables.operation === 'add' ? "Montant ajouté" : "Montant retiré" });
    },
    onError: () => {
      toast({ title: "Erreur lors de la modification", variant: "destructive" });
    },
  });

  const uploadDocumentMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!selectedClient?.user_id) throw new Error("No client selected");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const documentUrl = `document://${file.name}`;
      const { error } = await supabase.from("client_documents").insert({
        user_id: selectedClient.user_id,
        uploaded_by: user.id,
        document_name: file.name,
        document_type: file.type.includes("pdf") ? "contract" : "general",
        document_url: documentUrl,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-documents"] });
      logActivity("upload", "document", selectedClient?.id);
      toast({ title: "Document ajouté" });
    },
    onError: () => {
      toast({ title: "Erreur lors de l'upload", variant: "destructive" });
    },
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: async (docId: string) => {
      const { error } = await supabase.from("client_documents").delete().eq("id", docId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-documents"] });
      toast({ title: "Document supprimé" });
    },
  });

  const handleViewDetails = (client: any) => {
    setSelectedClient({ ...client, sector_tags: client.sector_tags || [] });
    setDetailsDialogOpen(true);
  };

  const handleAddTag = (tag: string) => {
    if (!tag.trim()) return;
    const currentTags = selectedClient.sector_tags || [];
    if (!currentTags.includes(tag)) {
      setSelectedClient({ ...selectedClient, sector_tags: [...currentTags, tag] });
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setSelectedClient({
      ...selectedClient,
      sector_tags: selectedClient.sector_tags.filter((t: string) => t !== tagToRemove),
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadDocumentMutation.mutate(file);
  };

  // Calculate renewal reminders
  const getSubscriptionStatus = (sub: any) => {
    if (!sub.next_billing_date) return null;
    const daysUntil = differenceInDays(new Date(sub.next_billing_date), new Date());
    if (daysUntil < 0) return { status: "overdue", color: "bg-red-500", text: "En retard" };
    if (daysUntil <= 7) return { status: "soon", color: "bg-amber-500", text: `${daysUntil}j` };
    if (daysUntil <= 30) return { status: "upcoming", color: "bg-cyan-500", text: `${daysUntil}j` };
    return { status: "ok", color: "bg-emerald-500", text: `${daysUntil}j` };
  };

  const statusColors: Record<string, string> = {
    pending: "bg-amber-500/20 text-amber-400",
    processing: "bg-cyan-500/20 text-cyan-400",
    completed: "bg-emerald-500/20 text-emerald-400",
    cancelled: "bg-red-500/20 text-red-400",
    paid: "bg-emerald-500/20 text-emerald-400",
    overdue: "bg-red-500/20 text-red-400",
    open: "bg-cyan-500/20 text-cyan-400",
    closed: "bg-muted text-muted-foreground",
    active: "bg-emerald-500/20 text-emerald-400",
    inactive: "bg-muted text-muted-foreground",
  };

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">Clients</h1>
            <p className="text-muted-foreground mt-1">Gérer tous les profils clients</p>
          </div>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="hero">
                <Plus className="w-4 h-4 mr-2" />
                Nouveau client
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Créer un client</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label>Nom complet</Label>
                  <Input
                    value={newClient.full_name}
                    onChange={(e) => setNewClient({ ...newClient, full_name: e.target.value })}
                    placeholder="Jean Dupont"
                  />
                </div>
                <div>
                  <Label>Courriel</Label>
                  <Input
                    type="email"
                    value={newClient.email}
                    onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                    placeholder="jean@exemple.com"
                  />
                </div>
                <div>
                  <Label>Mot de passe temporaire</Label>
                  <Input
                    type="password"
                    value={newClient.password}
                    onChange={(e) => setNewClient({ ...newClient, password: e.target.value })}
                    placeholder="••••••••"
                  />
                </div>
                <div>
                  <Label>Téléphone</Label>
                  <Input
                    value={newClient.phone}
                    onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                    placeholder="514-555-1234"
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={() => createClientMutation.mutate(newClient)}
                  disabled={!newClient.email || !newClient.password || !newClient.full_name}
                >
                  Créer le client
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search bar */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher par nom, courriel ou téléphone..."
            className="pl-10"
          />
        </div>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-cyan-400" />
              Liste des clients ({filteredClients?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : filteredClients && filteredClients.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Nom</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Courriel</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Solde</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Crédit</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Statut</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Inscrit le</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredClients.map((client: any) => (
                      <tr key={client.id} className="border-b border-border/50 hover:bg-accent/50">
                        <td className="py-3 px-4 text-sm text-foreground font-medium">
                          {client.full_name || "—"}
                        </td>
                        <td className="py-3 px-4 text-sm text-foreground">{client.email || "—"}</td>
                        <td className="py-3 px-4 text-sm">
                          <span className={Number(client.balance || 0) > 0 ? "text-amber-500 font-medium" : "text-muted-foreground"}>
                            {Number(client.balance || 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm">
                          <span className={Number(client.store_credit || 0) > 0 ? "text-emerald-500 font-medium" : "text-muted-foreground"}>
                            {Number(client.store_credit || 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <Badge
                            className={
                              client.account_status === 'active' ? "bg-emerald-500/20 text-emerald-400" :
                              client.account_status === 'frozen' ? "bg-blue-500/20 text-blue-400" :
                              client.account_status === 'hold' ? "bg-amber-500/20 text-amber-400" :
                              client.account_status === 'deactivated' ? "bg-red-500/20 text-red-400" :
                              "bg-emerald-500/20 text-emerald-400"
                            }
                          >
                            {client.account_status === 'active' || !client.account_status ? 'Actif' :
                             client.account_status === 'frozen' ? 'Gelé' :
                             client.account_status === 'hold' ? 'Attente' : 'Désactivé'}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">
                          {format(new Date(client.created_at), "d MMM yyyy", { locale: fr })}
                        </td>
                        <td className="py-3 px-4">
                          <Button size="sm" variant="outline" onClick={() => handleViewDetails(client)}>
                            <Eye className="w-4 h-4 mr-2" />
                            Gérer
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {searchQuery ? "Aucun client trouvé" : "Aucun client pour le moment"}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Client Management Dialog */}
        <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-cyan-400" />
                {selectedClient?.full_name || selectedClient?.email}
              </DialogTitle>
            </DialogHeader>
            {selectedClient && (
              <Tabs defaultValue="profile" className="mt-4">
                <TabsList className="grid grid-cols-6 w-full">
                  <TabsTrigger value="profile">Profil</TabsTrigger>
                  <TabsTrigger value="orders">Commandes</TabsTrigger>
                  <TabsTrigger value="billing">Paiements</TabsTrigger>
                  <TabsTrigger value="subscriptions">Abonnements</TabsTrigger>
                  <TabsTrigger value="tickets">Tickets</TabsTrigger>
                  <TabsTrigger value="documents">Documents</TabsTrigger>
                </TabsList>

                {/* Profile Tab */}
                <TabsContent value="profile" className="space-y-4 mt-4">
                  {/* Account Status Banner */}
                  {selectedClient.account_status && selectedClient.account_status !== 'active' && (
                    <div className={`p-4 rounded-lg border ${
                      selectedClient.account_status === 'frozen' ? 'bg-blue-500/10 border-blue-500/30' :
                      selectedClient.account_status === 'hold' ? 'bg-amber-500/10 border-amber-500/30' :
                      'bg-red-500/10 border-red-500/30'
                    }`}>
                      <div className="flex items-center gap-2">
                        {selectedClient.account_status === 'frozen' && <Pause className="w-5 h-5 text-blue-500" />}
                        {selectedClient.account_status === 'hold' && <Clock className="w-5 h-5 text-amber-500" />}
                        {selectedClient.account_status === 'deactivated' && <Ban className="w-5 h-5 text-red-500" />}
                        <span className={`font-medium ${
                          selectedClient.account_status === 'frozen' ? 'text-blue-500' :
                          selectedClient.account_status === 'hold' ? 'text-amber-500' : 'text-red-500'
                        }`}>
                          Compte {selectedClient.account_status === 'frozen' ? 'gelé' : 
                                  selectedClient.account_status === 'hold' ? 'en attente' : 'désactivé'}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Balance & Credit Management */}
                  <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg border border-border">
                    <div>
                      <Label className="text-xs text-muted-foreground uppercase">Solde dû</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-2xl font-bold text-amber-500">
                          {Number(selectedClient.balance || 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                        </p>
                      </div>
                      <div className="flex gap-2 mt-2">
                        <Button size="sm" variant="outline" onClick={() => {
                          const amount = prompt("Montant à ajouter au solde:");
                          if (amount && !isNaN(Number(amount))) {
                            adjustBalanceMutation.mutate({ clientId: selectedClient.id, field: 'balance', amount: Number(amount), operation: 'add' });
                          }
                        }}>
                          <PlusCircle className="w-4 h-4 mr-1" /> Ajouter
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => {
                          const amount = prompt("Montant à retirer du solde:");
                          if (amount && !isNaN(Number(amount))) {
                            adjustBalanceMutation.mutate({ clientId: selectedClient.id, field: 'balance', amount: Number(amount), operation: 'remove' });
                          }
                        }}>
                          <MinusCircle className="w-4 h-4 mr-1" /> Retirer
                        </Button>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground uppercase">Crédit disponible</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-2xl font-bold text-emerald-500">
                          {Number(selectedClient.store_credit || 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                        </p>
                      </div>
                      <div className="flex gap-2 mt-2">
                        <Button size="sm" variant="outline" onClick={() => {
                          const amount = prompt("Montant à ajouter au crédit:");
                          if (amount && !isNaN(Number(amount))) {
                            adjustBalanceMutation.mutate({ clientId: selectedClient.id, field: 'store_credit', amount: Number(amount), operation: 'add' });
                          }
                        }}>
                          <PlusCircle className="w-4 h-4 mr-1" /> Ajouter
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => {
                          const amount = prompt("Montant à retirer du crédit:");
                          if (amount && !isNaN(Number(amount))) {
                            adjustBalanceMutation.mutate({ clientId: selectedClient.id, field: 'store_credit', amount: Number(amount), operation: 'remove' });
                          }
                        }}>
                          <MinusCircle className="w-4 h-4 mr-1" /> Retirer
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Account Status Management */}
                  <div className="p-4 bg-muted/50 rounded-lg border border-border">
                    <Label className="text-sm font-medium mb-3 block">Statut du compte</Label>
                    <div className="grid grid-cols-4 gap-2">
                      <Button 
                        size="sm" 
                        variant={selectedClient.account_status === 'active' ? 'default' : 'outline'}
                        className={selectedClient.account_status === 'active' ? 'bg-emerald-500 hover:bg-emerald-600' : ''}
                        onClick={() => setSelectedClient({ ...selectedClient, account_status: 'active' })}
                      >
                        <Play className="w-4 h-4 mr-1" /> Actif
                      </Button>
                      <Button 
                        size="sm" 
                        variant={selectedClient.account_status === 'frozen' ? 'default' : 'outline'}
                        className={selectedClient.account_status === 'frozen' ? 'bg-blue-500 hover:bg-blue-600' : ''}
                        onClick={() => setSelectedClient({ ...selectedClient, account_status: 'frozen' })}
                      >
                        <Pause className="w-4 h-4 mr-1" /> Gelé
                      </Button>
                      <Button 
                        size="sm" 
                        variant={selectedClient.account_status === 'hold' ? 'default' : 'outline'}
                        className={selectedClient.account_status === 'hold' ? 'bg-amber-500 hover:bg-amber-600' : ''}
                        onClick={() => setSelectedClient({ ...selectedClient, account_status: 'hold' })}
                      >
                        <Clock className="w-4 h-4 mr-1" /> Attente
                      </Button>
                      <Button 
                        size="sm" 
                        variant={selectedClient.account_status === 'deactivated' ? 'default' : 'outline'}
                        className={selectedClient.account_status === 'deactivated' ? 'bg-red-500 hover:bg-red-600' : ''}
                        onClick={() => setSelectedClient({ ...selectedClient, account_status: 'deactivated' })}
                      >
                        <Ban className="w-4 h-4 mr-1" /> Désactivé
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Nom complet</Label>
                      <Input
                        value={selectedClient.full_name || ""}
                        onChange={(e) => setSelectedClient({ ...selectedClient, full_name: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Téléphone</Label>
                      <Input
                        value={selectedClient.phone || ""}
                        onChange={(e) => setSelectedClient({ ...selectedClient, phone: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Courriel</Label>
                    <Input value={selectedClient.email || ""} disabled className="bg-muted" />
                  </div>
                  <div>
                    <Label>Rabais employeur</Label>
                    <Input
                      value={selectedClient.employer_discount || ""}
                      onChange={(e) => setSelectedClient({ ...selectedClient, employer_discount: e.target.value })}
                      placeholder="Ex: 15% Entreprise XYZ"
                    />
                  </div>
                  <div>
                    <Label>Tags secteur</Label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {selectedClient.sector_tags?.map((tag: string) => (
                        <Badge key={tag} variant="secondary" className="cursor-pointer" onClick={() => handleRemoveTag(tag)}>
                          {tag} ×
                        </Badge>
                      ))}
                    </div>
                    <Input
                      placeholder="Ajouter un tag (Entrée pour confirmer)"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleAddTag(e.currentTarget.value);
                          e.currentTarget.value = "";
                        }
                      }}
                    />
                  </div>
                  <div>
                    <Label>Notes internes</Label>
                    <Textarea
                      value={selectedClient.internal_notes || ""}
                      onChange={(e) => setSelectedClient({ ...selectedClient, internal_notes: e.target.value })}
                      placeholder="Notes privées..."
                      rows={4}
                    />
                  </div>
                  <Button onClick={() => updateClientMutation.mutate(selectedClient)}>
                    Enregistrer les modifications
                  </Button>
                </TabsContent>

                {/* Orders Tab */}
                <TabsContent value="orders" className="mt-4">
                  <div className="space-y-3">
                    {clientOrders && clientOrders.length > 0 ? (
                      clientOrders.map((order: any) => (
                        <div key={order.id} className="flex items-center justify-between p-4 border border-border rounded-lg">
                          <div className="flex items-center gap-4">
                            <Package className="w-8 h-8 text-cyan-400" />
                            <div>
                              <p className="font-medium text-foreground">{order.service_type}</p>
                              <p className="text-sm text-muted-foreground">
                                {format(new Date(order.created_at), "d MMM yyyy", { locale: fr })}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            {order.total_amount && (
                              <span className="font-medium">${order.total_amount}</span>
                            )}
                            <Badge className={statusColors[order.status] || statusColors.pending}>
                              {order.status}
                            </Badge>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8">
                        <ShoppingBag className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                        <p className="text-muted-foreground">Aucune commande</p>
                      </div>
                    )}
                  </div>
                </TabsContent>

                {/* Billing Tab */}
                <TabsContent value="billing" className="mt-4">
                  <div className="space-y-3">
                    {clientBilling && clientBilling.length > 0 ? (
                      clientBilling.map((bill: any) => (
                        <div key={bill.id} className="flex items-center justify-between p-4 border border-border rounded-lg">
                          <div className="flex items-center gap-4">
                            <DollarSign className="w-8 h-8 text-cyan-400" />
                            <div>
                              <p className="font-medium text-foreground">
                                {bill.invoice_number || `Facture #${bill.id.slice(0, 8)}`}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {format(new Date(bill.created_at), "d MMM yyyy", { locale: fr })}
                                {bill.due_date && ` • Échéance: ${format(new Date(bill.due_date), "d MMM", { locale: fr })}`}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="font-medium">${bill.amount}</span>
                            <Badge className={statusColors[bill.status] || statusColors.pending}>
                              {bill.status === "paid" ? "Payé" : bill.status === "overdue" ? "En retard" : "En attente"}
                            </Badge>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8">
                        <CreditCard className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                        <p className="text-muted-foreground">Aucun paiement</p>
                      </div>
                    )}
                  </div>
                </TabsContent>

                {/* Subscriptions Tab */}
                <TabsContent value="subscriptions" className="mt-4">
                  <div className="space-y-3">
                    {clientSubscriptions && clientSubscriptions.length > 0 ? (
                      clientSubscriptions.map((sub: any) => {
                        const renewalStatus = getSubscriptionStatus(sub);
                        return (
                          <div key={sub.id} className="flex items-center justify-between p-4 border border-border rounded-lg">
                            <div className="flex items-center gap-4">
                              <Calendar className="w-8 h-8 text-cyan-400" />
                              <div>
                                <p className="font-medium text-foreground">{sub.plan_name}</p>
                                <p className="text-sm text-muted-foreground">
                                  ${sub.amount}/{sub.billing_cycle === "monthly" ? "mois" : "an"}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              {renewalStatus && (
                                <div className="flex items-center gap-2">
                                  <Bell className={`w-4 h-4 ${renewalStatus.status === "overdue" ? "text-red-400" : renewalStatus.status === "soon" ? "text-amber-400" : "text-muted-foreground"}`} />
                                  <span className="text-sm text-muted-foreground">
                                    Renouvellement: {renewalStatus.text}
                                  </span>
                                </div>
                              )}
                              <Badge className={statusColors[sub.status] || statusColors.active}>
                                {sub.status === "active" ? "Actif" : "Inactif"}
                              </Badge>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-center py-8">
                        <Calendar className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                        <p className="text-muted-foreground">Aucun abonnement</p>
                      </div>
                    )}
                  </div>
                </TabsContent>

                {/* Tickets Tab */}
                <TabsContent value="tickets" className="mt-4">
                  <div className="space-y-3">
                    {clientTickets && clientTickets.length > 0 ? (
                      clientTickets.map((ticket: any) => (
                        <div key={ticket.id} className="flex items-center justify-between p-4 border border-border rounded-lg">
                          <div className="flex items-center gap-4">
                            <Ticket className="w-8 h-8 text-cyan-400" />
                            <div>
                              <p className="font-medium text-foreground">{ticket.subject}</p>
                              <p className="text-sm text-muted-foreground">
                                {format(new Date(ticket.created_at), "d MMM yyyy", { locale: fr })}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <Badge className={ticket.priority === "high" ? "bg-red-500/20 text-red-400" : ticket.priority === "normal" ? "bg-amber-500/20 text-amber-400" : "bg-muted text-muted-foreground"}>
                              {ticket.priority === "high" ? "Urgent" : ticket.priority === "normal" ? "Normal" : "Bas"}
                            </Badge>
                            <Badge className={statusColors[ticket.status] || statusColors.open}>
                              {ticket.status === "open" ? "Ouvert" : ticket.status === "in_progress" ? "En cours" : "Fermé"}
                            </Badge>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8">
                        <Ticket className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                        <p className="text-muted-foreground">Aucun ticket</p>
                      </div>
                    )}
                  </div>
                </TabsContent>

                {/* Documents Tab */}
                <TabsContent value="documents" className="mt-4">
                  <div className="space-y-4">
                    <div className="flex gap-2">
                      <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        onChange={handleFileUpload}
                        accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                      />
                      <Button variant="outline" className="w-full" onClick={() => fileInputRef.current?.click()}>
                        <Upload className="w-4 h-4 mr-2" />
                        Téléverser un document
                      </Button>
                    </div>

                    <div className="space-y-2">
                      {clientDocuments && clientDocuments.length > 0 ? (
                        clientDocuments.map((doc: any) => (
                          <div key={doc.id} className="flex items-center justify-between p-3 border border-border rounded-lg">
                            <div className="flex items-center gap-3">
                              <FileText className="w-5 h-5 text-cyan-400" />
                              <div>
                                <p className="text-sm font-medium text-foreground">{doc.document_name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {format(new Date(doc.created_at), "d MMM yyyy", { locale: fr })}
                                </p>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (confirm("Supprimer ce document ?")) {
                                  deleteDocumentMutation.mutate(doc.id);
                                }
                              }}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-8">
                          <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                          <p className="text-sm text-muted-foreground">Aucun document</p>
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminClients;
