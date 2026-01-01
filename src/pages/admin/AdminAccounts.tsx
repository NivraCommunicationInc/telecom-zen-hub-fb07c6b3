import { useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
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
  Search,
  Eye,
  Plus,
  Building2,
  MapPin,
  Calendar,
  CreditCard,
  FileText,
  History,
  Star,
  Edit,
  Save,
  User,
  Receipt,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, addMonths, setDate } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";

const creditClassLabels: Record<string, { label: string; color: string }> = {
  A: { label: "Excellent", color: "bg-green-500" },
  B: { label: "Bon", color: "bg-blue-500" },
  C: { label: "Moyen", color: "bg-yellow-500" },
  D: { label: "Mauvais", color: "bg-red-500" },
};

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  active: { label: "Actif", variant: "default" },
  suspended: { label: "Suspendu", variant: "secondary" },
  closed: { label: "Fermé", variant: "destructive" },
};

const AdminAccounts = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAccount, setSelectedAccount] = useState<any>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingCreditClass, setEditingCreditClass] = useState(false);
  const [newCreditClass, setNewCreditClass] = useState("C");
  const [addLocationOpen, setAddLocationOpen] = useState(false);
  const [newLocation, setNewLocation] = useState({
    label: "",
    service_address: "",
    service_city: "",
    service_postal_code: "",
  });

  // Fetch all accounts with client info
  const { data: accounts, isLoading } = useQuery({
    queryKey: ["admin-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts")
        .select(`
          *,
          profiles:client_id (
            id,
            user_id,
            full_name,
            email,
            phone,
            client_number
          )
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch clients for new account creation
  const { data: clients } = useQuery({
    queryKey: ["admin-clients-for-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, user_id, full_name, email, client_number")
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch service locations for selected account
  const { data: serviceLocations, refetch: refetchLocations } = useQuery({
    queryKey: ["account-locations", selectedAccount?.id],
    queryFn: async () => {
      if (!selectedAccount?.id) return [];
      const { data, error } = await supabase
        .from("account_service_locations")
        .select("*")
        .eq("account_id", selectedAccount.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedAccount?.id,
  });

  // Fetch orders for selected account
  const { data: accountOrders } = useQuery({
    queryKey: ["account-orders", selectedAccount?.id],
    queryFn: async () => {
      if (!selectedAccount?.id) return [];
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("account_id", selectedAccount.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedAccount?.id,
  });

  // Fetch invoices for selected account
  const { data: accountInvoices } = useQuery({
    queryKey: ["account-invoices", selectedAccount?.id],
    queryFn: async () => {
      if (!selectedAccount?.id) return [];
      const { data, error } = await supabase
        .from("billing")
        .select("*")
        .eq("user_id", selectedAccount.client_id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedAccount?.id,
  });

  // Create new account
  const createAccountMutation = useMutation({
    mutationFn: async (data: { client_id: string; account_name: string; billing_address: string; billing_city: string; billing_postal_code: string; billing_cycle_day: number }) => {
      const { error } = await supabase.from("accounts").insert([{
        client_id: data.client_id,
        account_name: data.account_name,
        billing_address: data.billing_address,
        billing_city: data.billing_city,
        billing_postal_code: data.billing_postal_code,
        primary_service_address: data.billing_address,
        primary_service_city: data.billing_city,
        primary_service_postal_code: data.billing_postal_code,
        billing_cycle_day: data.billing_cycle_day,
      } as any]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-accounts"] });
      toast({ title: "Compte créé avec succès" });
      setCreateDialogOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  // Update credit class (Admin only)
  const updateCreditClassMutation = useMutation({
    mutationFn: async ({ accountId, creditClass }: { accountId: string; creditClass: string }) => {
      const { error } = await supabase
        .from("accounts")
        .update({
          credit_class: creditClass,
          credit_last_reviewed_at: new Date().toISOString(),
          credit_last_reviewed_by_admin_id: user?.id,
        })
        .eq("id", accountId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-accounts"] });
      toast({ title: "Classe de crédit mise à jour" });
      setEditingCreditClass(false);
      if (selectedAccount) {
        setSelectedAccount({ ...selectedAccount, credit_class: newCreditClass });
      }
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  // Add service location
  const addLocationMutation = useMutation({
    mutationFn: async (data: typeof newLocation & { account_id: string }) => {
      const { error } = await supabase.from("account_service_locations").insert({
        account_id: data.account_id,
        label: data.label,
        service_address: data.service_address,
        service_city: data.service_city,
        service_postal_code: data.service_postal_code,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      refetchLocations();
      toast({ title: "Adresse de service ajoutée" });
      setAddLocationOpen(false);
      setNewLocation({ label: "", service_address: "", service_city: "", service_postal_code: "" });
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  // Filter accounts
  const filteredAccounts = accounts?.filter((account: any) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      account.account_number?.toLowerCase().includes(query) ||
      account.account_name?.toLowerCase().includes(query) ||
      account.profiles?.full_name?.toLowerCase().includes(query) ||
      account.profiles?.email?.toLowerCase().includes(query) ||
      account.billing_address?.toLowerCase().includes(query)
    );
  });

  // Calculate billing cycle info
  const getBillingCycleInfo = (account: any) => {
    const cycleDay = account.billing_cycle_day || 1;
    const today = new Date();
    let cycleStart = setDate(today, cycleDay);
    if (cycleStart > today) {
      cycleStart = addMonths(cycleStart, -1);
    }
    const cycleEnd = addMonths(cycleStart, 1);
    cycleEnd.setDate(cycleEnd.getDate() - 1);
    const nextInvoice = addMonths(cycleStart, 1);
    
    return {
      cycleStart: format(cycleStart, "d MMM yyyy", { locale: fr }),
      cycleEnd: format(cycleEnd, "d MMM yyyy", { locale: fr }),
      nextInvoice: format(nextInvoice, "d MMM yyyy", { locale: fr }),
    };
  };

  const openAccountDetails = (account: any) => {
    setSelectedAccount(account);
    setNewCreditClass(account.credit_class || "C");
    setDetailsDialogOpen(true);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Comptes</h1>
            <p className="text-muted-foreground">Gestion des comptes clients et cycles de facturation</p>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nouveau Compte
          </Button>
        </div>

        {/* Search */}
        <Card>
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Rechercher par numéro de compte, nom, email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Accounts List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Comptes ({filteredAccounts?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-center py-8 text-muted-foreground">Chargement...</p>
            ) : filteredAccounts?.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">Aucun compte trouvé</p>
            ) : (
              <div className="space-y-3">
                {filteredAccounts?.map((account: any) => (
                  <div
                    key={account.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-medium text-primary">{account.account_number}</span>
                        <Badge variant={statusLabels[account.status]?.variant || "default"}>
                          {statusLabels[account.status]?.label || account.status}
                        </Badge>
                        <div className={`w-3 h-3 rounded-full ${creditClassLabels[account.credit_class]?.color || "bg-gray-400"}`} title={`Crédit: ${creditClassLabels[account.credit_class]?.label || "N/A"}`} />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {account.account_name} • {account.profiles?.full_name || "Client inconnu"}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {account.primary_service_address}, {account.primary_service_city}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => openAccountDetails(account)}>
                      <Eye className="w-4 h-4 mr-2" />
                      Détails
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Account Details Dialog */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <Building2 className="w-5 h-5" />
              {selectedAccount?.account_number} - {selectedAccount?.account_name}
            </DialogTitle>
          </DialogHeader>
          
          <ScrollArea className="max-h-[70vh]">
            <Tabs defaultValue="info" className="w-full">
              <TabsList className="w-full justify-start">
                <TabsTrigger value="info">Informations</TabsTrigger>
                <TabsTrigger value="locations">Adresses</TabsTrigger>
                <TabsTrigger value="billing">Facturation</TabsTrigger>
                <TabsTrigger value="orders">Commandes</TabsTrigger>
                <TabsTrigger value="credit">Crédit (Interne)</TabsTrigger>
              </TabsList>

              <TabsContent value="info" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Numéro de compte</Label>
                    <p className="font-mono font-medium">{selectedAccount?.account_number}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Statut</Label>
                    <Badge variant={statusLabels[selectedAccount?.status]?.variant || "default"}>
                      {statusLabels[selectedAccount?.status]?.label || selectedAccount?.status}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Client</Label>
                    <p className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      {selectedAccount?.profiles?.full_name}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Email</Label>
                    <p>{selectedAccount?.profiles?.email}</p>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-muted-foreground">Adresse de facturation</Label>
                    <p className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      {selectedAccount?.billing_address}, {selectedAccount?.billing_city}, {selectedAccount?.billing_postal_code}
                    </p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="locations" className="space-y-4 mt-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-medium">Adresses de service</h3>
                  <Button size="sm" onClick={() => setAddLocationOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Ajouter
                  </Button>
                </div>
                
                {/* Primary address */}
                <div className="p-4 border rounded-lg bg-accent/30">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge>Principal</Badge>
                  </div>
                  <p className="text-sm">
                    {selectedAccount?.primary_service_address}, {selectedAccount?.primary_service_city}, {selectedAccount?.primary_service_postal_code}
                  </p>
                </div>

                {/* Additional locations */}
                {serviceLocations?.map((loc: any) => (
                  <div key={loc.id} className="p-4 border rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline">{loc.label}</Badge>
                      {!loc.is_active && <Badge variant="secondary">Inactif</Badge>}
                    </div>
                    <p className="text-sm">
                      {loc.service_address}, {loc.service_city}, {loc.service_postal_code}
                    </p>
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="billing" className="space-y-4 mt-4">
                {selectedAccount && (
                  <>
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          Cycle de facturation
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <Label className="text-muted-foreground">Jour du cycle</Label>
                            <p className="font-medium">{selectedAccount.billing_cycle_day} du mois</p>
                          </div>
                          <div>
                            <Label className="text-muted-foreground">Cycle actuel</Label>
                            <p className="text-sm">
                              {getBillingCycleInfo(selectedAccount).cycleStart} - {getBillingCycleInfo(selectedAccount).cycleEnd}
                            </p>
                          </div>
                          <div>
                            <Label className="text-muted-foreground">Prochaine facture</Label>
                            <p className="text-sm font-medium text-primary">
                              {getBillingCycleInfo(selectedAccount).nextInvoice}
                            </p>
                          </div>
                        </div>
                        <Button variant="outline" className="w-full">
                          <Receipt className="w-4 h-4 mr-2" />
                          Générer facture mensuelle
                        </Button>
                      </CardContent>
                    </Card>

                    <h3 className="font-medium">Factures récentes</h3>
                    {accountInvoices?.length === 0 ? (
                      <p className="text-muted-foreground text-sm">Aucune facture</p>
                    ) : (
                      <div className="space-y-2">
                        {accountInvoices?.slice(0, 5).map((invoice: any) => (
                          <div key={invoice.id} className="flex justify-between items-center p-3 border rounded-lg">
                            <div>
                              <p className="font-mono text-sm">{invoice.invoice_number}</p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(invoice.created_at), "d MMM yyyy", { locale: fr })}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-medium">${invoice.amount?.toFixed(2)}</p>
                              <Badge variant={invoice.status === "paid" ? "default" : "secondary"}>
                                {invoice.status}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </TabsContent>

              <TabsContent value="orders" className="space-y-4 mt-4">
                <h3 className="font-medium">Commandes du compte</h3>
                {accountOrders?.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Aucune commande</p>
                ) : (
                  <div className="space-y-2">
                    {accountOrders?.map((order: any) => (
                      <div key={order.id} className="flex justify-between items-center p-3 border rounded-lg">
                        <div>
                          <p className="font-mono text-sm">{order.order_number}</p>
                          <p className="text-xs text-muted-foreground">
                            {order.service_type} • {format(new Date(order.created_at), "d MMM yyyy", { locale: fr })}
                          </p>
                        </div>
                        <Badge>{order.status}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="credit" className="space-y-4 mt-4">
                <Card className="border-amber-500/50 bg-amber-50/10">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2 text-amber-600">
                      <Star className="w-4 h-4" />
                      Classe de crédit (INTERNE UNIQUEMENT)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Cette information est strictement interne. Elle n'est jamais visible par les clients.
                    </p>
                    
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        {editingCreditClass ? (
                          <Select value={newCreditClass} onValueChange={setNewCreditClass}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="A">A - Excellent</SelectItem>
                              <SelectItem value="B">B - Bon</SelectItem>
                              <SelectItem value="C">C - Moyen</SelectItem>
                              <SelectItem value="D">D - Mauvais</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${creditClassLabels[selectedAccount?.credit_class]?.color || "bg-gray-400"}`}>
                              {selectedAccount?.credit_class || "?"}
                            </div>
                            <span className="font-medium">
                              {creditClassLabels[selectedAccount?.credit_class]?.label || "Non défini"}
                            </span>
                          </div>
                        )}
                      </div>
                      
                      {editingCreditClass ? (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => updateCreditClassMutation.mutate({ accountId: selectedAccount.id, creditClass: newCreditClass })}
                            disabled={updateCreditClassMutation.isPending}
                          >
                            <Save className="w-4 h-4 mr-1" />
                            Enregistrer
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingCreditClass(false)}>
                            Annuler
                          </Button>
                        </div>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => setEditingCreditClass(true)}>
                          <Edit className="w-4 h-4 mr-1" />
                          Modifier
                        </Button>
                      )}
                    </div>

                    {selectedAccount?.credit_last_reviewed_at && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <History className="w-3 h-3" />
                        Dernière révision: {format(new Date(selectedAccount.credit_last_reviewed_at), "d MMM yyyy à HH:mm", { locale: fr })}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Create Account Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouveau Compte</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              createAccountMutation.mutate({
                client_id: formData.get("client_id") as string,
                account_name: formData.get("account_name") as string,
                billing_address: formData.get("billing_address") as string,
                billing_city: formData.get("billing_city") as string,
                billing_postal_code: formData.get("billing_postal_code") as string,
                billing_cycle_day: parseInt(formData.get("billing_cycle_day") as string) || 1,
              });
            }}
            className="space-y-4"
          >
            <div>
              <Label htmlFor="client_id">Client *</Label>
              <Select name="client_id" required>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un client..." />
                </SelectTrigger>
                <SelectContent>
                  {clients?.map((client: any) => (
                    <SelectItem key={client.user_id} value={client.user_id}>
                      {client.full_name} ({client.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="account_name">Nom du compte</Label>
              <Input name="account_name" placeholder="ex: Résidence principale" defaultValue="Principal" />
            </div>
            <div>
              <Label htmlFor="billing_address">Adresse de facturation *</Label>
              <Input name="billing_address" required placeholder="123 rue Exemple" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="billing_city">Ville *</Label>
                <Input name="billing_city" required placeholder="Montréal" />
              </div>
              <div>
                <Label htmlFor="billing_postal_code">Code postal *</Label>
                <Input name="billing_postal_code" required placeholder="H2X 1Y4" />
              </div>
            </div>
            <div>
              <Label htmlFor="billing_cycle_day">Jour du cycle de facturation</Label>
              <Select name="billing_cycle_day" defaultValue="1">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                    <SelectItem key={day} value={day.toString()}>
                      {day}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={createAccountMutation.isPending}>
                Créer le compte
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Location Dialog */}
      <Dialog open={addLocationOpen} onOpenChange={setAddLocationOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter une adresse de service</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Libellé *</Label>
              <Input
                value={newLocation.label}
                onChange={(e) => setNewLocation({ ...newLocation, label: e.target.value })}
                placeholder="ex: Bureau, Chalet, Triplex B"
              />
            </div>
            <div>
              <Label>Adresse *</Label>
              <Input
                value={newLocation.service_address}
                onChange={(e) => setNewLocation({ ...newLocation, service_address: e.target.value })}
                placeholder="123 rue Exemple"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Ville</Label>
                <Input
                  value={newLocation.service_city}
                  onChange={(e) => setNewLocation({ ...newLocation, service_city: e.target.value })}
                  placeholder="Montréal"
                />
              </div>
              <div>
                <Label>Code postal</Label>
                <Input
                  value={newLocation.service_postal_code}
                  onChange={(e) => setNewLocation({ ...newLocation, service_postal_code: e.target.value })}
                  placeholder="H2X 1Y4"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddLocationOpen(false)}>Annuler</Button>
            <Button
              onClick={() => {
                if (selectedAccount && newLocation.label && newLocation.service_address) {
                  addLocationMutation.mutate({ ...newLocation, account_id: selectedAccount.id });
                }
              }}
              disabled={addLocationMutation.isPending || !newLocation.label || !newLocation.service_address}
            >
              Ajouter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminAccounts;
