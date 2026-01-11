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
  Trash2,
  Ban,
  CheckCircle,
  RefreshCw,
  DollarSign,
  AlertTriangle,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminClient as supabase } from "@/integrations/backend";
import { format, addMonths, setDate } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { AddressAutocomplete, type AddressValue } from "@/components/shared/AddressAutocomplete";

const creditClassLabels: Record<string, { label: string; color: string }> = {
  A: { label: "Excellent", color: "bg-green-500" },
  B: { label: "Bon", color: "bg-blue-500" },
  C: { label: "Moyen", color: "bg-yellow-500" },
  D: { label: "Mauvais", color: "bg-red-500" },
};

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  active: { label: "Actif", variant: "default" },
  suspended: { label: "Suspendu", variant: "secondary" },
  closed: { label: "Fermé", variant: "destructive" },
  pending: { label: "En attente", variant: "outline" },
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
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [newStatus, setNewStatus] = useState("active");
  const [statusReason, setStatusReason] = useState("");
  const [editAccountOpen, setEditAccountOpen] = useState(false);
  const [editedAccount, setEditedAccount] = useState<any>(null);
  const [newAccountForm, setNewAccountForm] = useState({
    client_id: "",
    account_name: "Principal",
    billing_address: "",
    billing_city: "",
    billing_postal_code: "",
    billing_cycle_day: 1,
  });

  // Fetch all accounts
  const { data: accounts, isLoading } = useQuery({
    queryKey: ["admin-accounts"],
    queryFn: async () => {
      // Fetch accounts first
      const { data: accountsData, error: accountsError } = await supabase
        .from("accounts")
        .select("*")
        .order("created_at", { ascending: false });
      if (accountsError) throw accountsError;
      
      // Get unique client IDs
      const clientIds = [...new Set(accountsData?.map(a => a.client_id).filter(Boolean))];
      
      // Fetch profiles for those clients
      let profilesMap: Record<string, any> = {};
      if (clientIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, user_id, full_name, email, phone, client_number")
          .in("user_id", clientIds);
        
        profilesData?.forEach(p => {
          profilesMap[p.user_id] = p;
        });
      }
      
      // Merge accounts with profiles
      return accountsData?.map(account => ({
        ...account,
        profiles: profilesMap[account.client_id] || null,
      }));
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

  // Update account status
  const updateStatusMutation = useMutation({
    mutationFn: async ({ accountId, status }: { accountId: string; status: string }) => {
      const { error } = await supabase
        .from("accounts")
        .update({ status })
        .eq("id", accountId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-accounts"] });
      toast({ title: "Statut du compte mis à jour" });
      setStatusDialogOpen(false);
      if (selectedAccount) {
        setSelectedAccount({ ...selectedAccount, status: newStatus });
      }
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  // Update account details
  const updateAccountMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase
        .from("accounts")
        .update({
          account_name: data.account_name,
          billing_address: data.billing_address,
          billing_city: data.billing_city,
          billing_postal_code: data.billing_postal_code,
          primary_service_address: data.primary_service_address,
          primary_service_city: data.primary_service_city,
          primary_service_postal_code: data.primary_service_postal_code,
          billing_cycle_day: data.billing_cycle_day,
        })
        .eq("id", data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-accounts"] });
      toast({ title: "Compte mis à jour" });
      setEditAccountOpen(false);
      if (selectedAccount && editedAccount) {
        setSelectedAccount({ ...selectedAccount, ...editedAccount });
      }
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  // Delete service location
  const deleteLocationMutation = useMutation({
    mutationFn: async (locationId: string) => {
      const { error } = await supabase
        .from("account_service_locations")
        .delete()
        .eq("id", locationId);
      if (error) throw error;
    },
    onSuccess: () => {
      refetchLocations();
      toast({ title: "Adresse supprimée" });
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
                    <div className="flex items-center gap-2">
                      <Badge variant={statusLabels[selectedAccount?.status]?.variant || "default"}>
                        {statusLabels[selectedAccount?.status]?.label || selectedAccount?.status}
                      </Badge>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => {
                          setNewStatus(selectedAccount?.status || "active");
                          setStatusDialogOpen(true);
                        }}
                      >
                        <Edit className="w-3 h-3" />
                      </Button>
                    </div>
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
                  <div className="col-span-2">
                    <Label className="text-muted-foreground">Créé le</Label>
                    <p className="text-sm">
                      {selectedAccount?.created_at && format(new Date(selectedAccount.created_at), "d MMM yyyy à HH:mm", { locale: fr })}
                    </p>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="border-t pt-4 mt-4">
                  <Label className="text-muted-foreground mb-3 block">Actions rapides</Label>
                  <div className="flex flex-wrap gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setEditedAccount({
                          id: selectedAccount?.id,
                          account_name: selectedAccount?.account_name || "",
                          billing_address: selectedAccount?.billing_address || "",
                          billing_city: selectedAccount?.billing_city || "",
                          billing_postal_code: selectedAccount?.billing_postal_code || "",
                          primary_service_address: selectedAccount?.primary_service_address || "",
                          primary_service_city: selectedAccount?.primary_service_city || "",
                          primary_service_postal_code: selectedAccount?.primary_service_postal_code || "",
                          billing_cycle_day: selectedAccount?.billing_cycle_day || 1,
                        });
                        setEditAccountOpen(true);
                      }}
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Modifier le compte
                    </Button>
                    {selectedAccount?.status !== "suspended" && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="text-amber-600 border-amber-300 hover:bg-amber-50"
                        onClick={() => {
                          setNewStatus("suspended");
                          setStatusDialogOpen(true);
                        }}
                      >
                        <Ban className="w-4 h-4 mr-2" />
                        Suspendre
                      </Button>
                    )}
                    {selectedAccount?.status === "suspended" && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="text-green-600 border-green-300 hover:bg-green-50"
                        onClick={() => {
                          setNewStatus("active");
                          setStatusDialogOpen(true);
                        }}
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Réactiver
                      </Button>
                    )}
                    {selectedAccount?.status !== "closed" && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="text-destructive border-destructive/30 hover:bg-destructive/10"
                        onClick={() => {
                          setNewStatus("closed");
                          setStatusDialogOpen(true);
                        }}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Fermer le compte
                      </Button>
                    )}
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
                  <div key={loc.id} className="p-4 border rounded-lg flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline">{loc.label}</Badge>
                        {!loc.is_active && <Badge variant="secondary">Inactif</Badge>}
                      </div>
                      <p className="text-sm">
                        {loc.service_address}, {loc.service_city}, {loc.service_postal_code}
                      </p>
                    </div>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => deleteLocationMutation.mutate(loc.id)}
                      disabled={deleteLocationMutation.isPending}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
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
              createAccountMutation.mutate({
                client_id: newAccountForm.client_id,
                account_name: newAccountForm.account_name,
                billing_address: newAccountForm.billing_address,
                billing_city: newAccountForm.billing_city,
                billing_postal_code: newAccountForm.billing_postal_code,
                billing_cycle_day: newAccountForm.billing_cycle_day,
              });
            }}
            className="space-y-4"
          >
            <div>
              <Label htmlFor="client_id">Client *</Label>
              <Select 
                value={newAccountForm.client_id} 
                onValueChange={(v) => setNewAccountForm({ ...newAccountForm, client_id: v })}
              >
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
              <Input 
                value={newAccountForm.account_name} 
                onChange={(e) => setNewAccountForm({ ...newAccountForm, account_name: e.target.value })}
                placeholder="ex: Résidence principale" 
              />
            </div>
            <div>
              <Label htmlFor="billing_address">Adresse de facturation *</Label>
              <AddressAutocomplete
                value={newAccountForm.billing_address}
                onValueChange={(value) => setNewAccountForm({ ...newAccountForm, billing_address: value })}
                onSelect={(details: AddressValue) => {
                  // Defense-in-depth: also call setter with formatted address
                  const addressText = details.formatted || details.line1;
                  setNewAccountForm({
                    ...newAccountForm,
                    billing_address: addressText,
                    billing_city: details.city || newAccountForm.billing_city,
                    billing_postal_code: details.postalCode || newAccountForm.billing_postal_code,
                  });
                }}
                placeholder="Rechercher une adresse..."
                restrictToQuebec={true}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="billing_city">Ville *</Label>
                <Input 
                  value={newAccountForm.billing_city} 
                  onChange={(e) => setNewAccountForm({ ...newAccountForm, billing_city: e.target.value })}
                  required 
                  placeholder="Montréal" 
                />
              </div>
              <div>
                <Label htmlFor="billing_postal_code">Code postal *</Label>
                <Input 
                  value={newAccountForm.billing_postal_code} 
                  onChange={(e) => setNewAccountForm({ ...newAccountForm, billing_postal_code: e.target.value })}
                  required 
                  placeholder="H2X 1Y4" 
                />
              </div>
            </div>
            <div>
              <Label htmlFor="billing_cycle_day">Jour du cycle de facturation</Label>
              <Select 
                value={newAccountForm.billing_cycle_day.toString()} 
                onValueChange={(v) => setNewAccountForm({ ...newAccountForm, billing_cycle_day: parseInt(v) })}
              >
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
              <Button 
                type="submit" 
                disabled={createAccountMutation.isPending || !newAccountForm.client_id || !newAccountForm.billing_address}
              >
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
              <AddressAutocomplete
                value={newLocation.service_address}
                onValueChange={(value) => setNewLocation({ ...newLocation, service_address: value })}
                onSelect={(details: AddressValue) => {
                  // Defense-in-depth: also call setter with formatted address
                  const addressText = details.formatted || details.line1;
                  setNewLocation({
                    ...newLocation,
                    service_address: addressText,
                    service_city: details.city || newLocation.service_city,
                    service_postal_code: details.postalCode || newLocation.service_postal_code,
                  });
                }}
                placeholder="Rechercher une adresse..."
                restrictToQuebec={true}
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

      {/* Change Status Dialog */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Changer le statut du compte
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nouveau statut</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Actif</SelectItem>
                  <SelectItem value="suspended">Suspendu</SelectItem>
                  <SelectItem value="pending">En attente</SelectItem>
                  <SelectItem value="closed">Fermé</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Raison (optionnel)</Label>
              <Textarea
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                placeholder="Raison du changement de statut..."
                rows={3}
              />
            </div>
            {newStatus === "closed" && (
              <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
                <p className="text-sm text-destructive flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Attention: La fermeture d'un compte est une action importante. Le client ne pourra plus accéder à ses services.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              variant={newStatus === "closed" ? "destructive" : "default"}
              onClick={() => {
                if (selectedAccount) {
                  updateStatusMutation.mutate({ accountId: selectedAccount.id, status: newStatus });
                }
              }}
              disabled={updateStatusMutation.isPending}
            >
              {updateStatusMutation.isPending ? "En cours..." : "Confirmer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Account Dialog */}
      <Dialog open={editAccountOpen} onOpenChange={setEditAccountOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Modifier le compte</DialogTitle>
          </DialogHeader>
          {editedAccount && (
            <div className="space-y-4">
              <div>
                <Label>Nom du compte</Label>
                <Input
                  value={editedAccount.account_name}
                  onChange={(e) => setEditedAccount({ ...editedAccount, account_name: e.target.value })}
                />
              </div>
              <div className="border-t pt-4">
                <Label className="text-muted-foreground block mb-3">Adresse de facturation</Label>
                <div className="space-y-3">
                  <AddressAutocomplete
                    value={editedAccount.billing_address || ""}
                    onValueChange={(value) => setEditedAccount({ ...editedAccount, billing_address: value })}
                    onSelect={(details: AddressValue) => {
                      setEditedAccount({
                        ...editedAccount,
                        billing_address: details.line1,
                        billing_city: details.city || editedAccount.billing_city,
                        billing_province: details.region || "QC",
                        billing_postal_code: details.postalCode || editedAccount.billing_postal_code,
                      });
                    }}
                    placeholder="Rechercher une adresse..."
                    restrictToQuebec={true}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      placeholder="Ville"
                      value={editedAccount.billing_city}
                      onChange={(e) => setEditedAccount({ ...editedAccount, billing_city: e.target.value })}
                    />
                    <Input
                      placeholder="Code postal"
                      value={editedAccount.billing_postal_code}
                      onChange={(e) => setEditedAccount({ ...editedAccount, billing_postal_code: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <div className="border-t pt-4">
                <Label className="text-muted-foreground block mb-3">Adresse de service principale</Label>
                <div className="space-y-3">
                  <AddressAutocomplete
                    value={editedAccount.primary_service_address || ""}
                    onValueChange={(value) => setEditedAccount({ ...editedAccount, primary_service_address: value })}
                    onSelect={(details: AddressValue) => {
                      setEditedAccount({
                        ...editedAccount,
                        primary_service_address: details.line1,
                        primary_service_city: details.city || editedAccount.primary_service_city,
                        primary_service_province: details.region || "QC",
                        primary_service_postal_code: details.postalCode || editedAccount.primary_service_postal_code,
                      });
                    }}
                    placeholder="Rechercher une adresse..."
                    restrictToQuebec={true}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      placeholder="Ville"
                      value={editedAccount.primary_service_city}
                      onChange={(e) => setEditedAccount({ ...editedAccount, primary_service_city: e.target.value })}
                    />
                    <Input
                      placeholder="Code postal"
                      value={editedAccount.primary_service_postal_code}
                      onChange={(e) => setEditedAccount({ ...editedAccount, primary_service_postal_code: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <div>
                <Label>Jour du cycle de facturation</Label>
                <Select 
                  value={editedAccount.billing_cycle_day?.toString()} 
                  onValueChange={(v) => setEditedAccount({ ...editedAccount, billing_cycle_day: parseInt(v) })}
                >
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
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditAccountOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={() => {
                if (editedAccount) {
                  updateAccountMutation.mutate(editedAccount);
                }
              }}
              disabled={updateAccountMutation.isPending}
            >
              <Save className="w-4 h-4 mr-2" />
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminAccounts;
