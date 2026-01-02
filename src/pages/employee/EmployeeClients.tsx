import { useEffect, useState, useRef } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Users,
  LogOut,
  RefreshCw,
  Search,
  ArrowLeft,
  Eye,
  Mail,
  Phone,
  MapPin,
  Clock,
  CreditCard,
  Shield,
  CheckCircle,
  XCircle,
  AlertCircle,
  Edit,
  User,
  IdCard,
  Package,
  DollarSign,
  FileText,
  Calendar,
  Ticket,
  Router,
  Smartphone,
  Monitor,
  AlertTriangle,
  PlusCircle,
  MinusCircle,
  Pause,
  Ban,
  Save,
  Play,
  Wrench,
  Receipt,
  Tv,
  Wifi,
  History,
  Plus,
  UserPlus,
  Lock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, differenceInDays } from "date-fns";
import { fr } from "date-fns/locale";
import { ClientAccessGateModal } from "@/components/admin/ClientAccessGateModal";
import { useClientAccessGate } from "@/hooks/useClientAccessGate";
import SecurityAlertBanner from "@/components/admin/SecurityAlertBanner";
import BackToTopButton from "@/components/ui/back-to-top-button";
import ClientLogsTab from "@/components/admin/ClientLogsTab";
import ClientBalanceBreakdown from "@/components/admin/ClientBalanceBreakdown";

const statusLabels: Record<string, { label: string; color: string }> = {
  active: { label: "Actif", color: "bg-emerald-500/20 text-emerald-600" },
  suspended: { label: "Suspendu", color: "bg-red-500/20 text-red-600" },
  pending: { label: "En attente", color: "bg-yellow-500/20 text-yellow-600" },
  inactive: { label: "Inactif", color: "bg-gray-500/20 text-gray-600" },
  hold: { label: "En attente", color: "bg-amber-500/20 text-amber-600" },
  frozen: { label: "Gelé", color: "bg-blue-500/20 text-blue-600" },
  deactivated: { label: "Désactivé", color: "bg-red-500/20 text-red-600" },
};

const orderStatusColors: Record<string, string> = {
  pending: "bg-amber-500/20 text-amber-400",
  processing: "bg-cyan-500/20 text-cyan-400",
  completed: "bg-emerald-500/20 text-emerald-400",
  cancelled: "bg-red-500/20 text-red-400",
  shipped: "bg-blue-500/20 text-blue-400",
  paid: "bg-emerald-500/20 text-emerald-400",
  overdue: "bg-red-500/20 text-red-400",
  open: "bg-cyan-500/20 text-cyan-400",
  closed: "bg-muted text-muted-foreground",
  active: "bg-emerald-500/20 text-emerald-400",
  paused: "bg-blue-500/20 text-blue-400",
};

const EmployeeClients = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const [session, setSession] = useState<any>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchFilter, setSearchFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // PIN Gate state
  const [pinGateModalOpen, setPinGateModalOpen] = useState(false);
  const [pendingClientAccess, setPendingClientAccess] = useState<any>(null);
  const { isClientVerified, verifyClient, clearAllVerifications } = useClientAccessGate();
  
  // Client-specific data
  const [clientOrders, setClientOrders] = useState<any[]>([]);
  const [clientBilling, setClientBilling] = useState<any[]>([]);
  const [clientPayments, setClientPayments] = useState<any[]>([]);
  const [clientTickets, setClientTickets] = useState<any[]>([]);
  const [clientAppointments, setClientAppointments] = useState<any[]>([]);
  const [clientSubscriptions, setClientSubscriptions] = useState<any[]>([]);
  const [clientDocuments, setClientDocuments] = useState<any[]>([]);
  const [isLoadingClientData, setIsLoadingClientData] = useState(false);

  // Order details dialog
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [orderDetailsOpen, setOrderDetailsOpen] = useState(false);

  // Invoice details dialog
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [invoiceDetailsOpen, setInvoiceDetailsOpen] = useState(false);

  // Balance adjustment
  const [balanceAmount, setBalanceAmount] = useState("");
  const [balanceField, setBalanceField] = useState<"balance" | "store_credit">("balance");

  // Create client dialog
  const [showCreateClientDialog, setShowCreateClientDialog] = useState(false);
  const [newClient, setNewClient] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    date_of_birth: "",
    service_address: "",
    service_city: "",
    service_postal_code: "",
    service_province: "QC",
  });

  useEffect(() => {
    const stored = localStorage.getItem("nivra_employee_session");
    if (!stored) {
      navigate("/employee/login");
      return;
    }
    try {
      const s = JSON.parse(stored);
      if (!s.permissions?.can_view_clients) {
        toast({ title: "Accès refusé", variant: "destructive" });
        navigate("/employee");
        return;
      }
      setSession(s);
    } catch {
      navigate("/employee/login");
    }
  }, [navigate, toast]);

  const fetchClients = async () => {
    if (!session?.token) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("employee-data", {
        headers: { "x-employee-token": session.token },
        body: { action: "get_clients", params: { limit: 200 } },
      });
      if (error) throw error;
      setClients(data?.clients || []);
      setLastRefresh(new Date());
    } catch (error) {
      console.error("Error:", error);
      toast({ title: "Erreur", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (session?.token) fetchClients();
  }, [session?.token]);

  // Handle action param
  useEffect(() => {
    const action = searchParams.get("action");
    if (action === "new" && session?.permissions?.can_edit_clients) {
      setShowCreateClientDialog(true);
      searchParams.delete("action");
      setSearchParams(searchParams);
    }
  }, [searchParams, session]);

  const handleCreateClient = async () => {
    if (!session?.permissions?.can_edit_clients) {
      toast({ title: "Permission refusée", variant: "destructive" });
      return;
    }
    if (!newClient.email || !newClient.first_name || !newClient.last_name) {
      toast({ title: "Veuillez remplir les champs obligatoires", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("employee-data", {
        headers: { "x-employee-token": session.token },
        body: { action: "create_client_profile", params: newClient },
      });
      if (error || data?.error) throw new Error(data?.error || error);
      toast({ title: "Client créé", description: `Numéro: ${data.client?.client_number}` });
      setShowCreateClientDialog(false);
      setNewClient({ first_name: "", last_name: "", email: "", phone: "", date_of_birth: "", service_address: "", service_city: "", service_postal_code: "", service_province: "QC" });
      fetchClients();
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const fetchClientData = async (client: any) => {
    if (!session?.token || !client?.user_id) return;
    setIsLoadingClientData(true);
    try {
      const { data, error } = await supabase.functions.invoke("employee-data", {
        headers: { "x-employee-token": session.token },
        body: { 
          action: "get_client_details", 
          params: { 
            clientId: client.id,
            userId: client.user_id,
            email: client.email 
          } 
        },
      });
      if (error) throw error;
      setClientOrders(data?.orders || []);
      setClientBilling(data?.billing || []);
      setClientPayments(data?.payments || []);
      setClientTickets(data?.tickets || []);
      setClientAppointments(data?.appointments || []);
      setClientSubscriptions(data?.subscriptions || []);
      setClientDocuments(data?.documents || []);
    } catch (error) {
      console.error("Error fetching client data:", error);
    } finally {
      setIsLoadingClientData(false);
    }
  };

  const handleLogout = () => {
    clearAllVerifications(); // Clear PIN verifications on logout
    localStorage.removeItem("nivra_employee_session");
    navigate("/employee/login");
  };

  const filteredClients = clients.filter(client => {
    if (!search && statusFilter === "all") return true;
    
    const query = search.toLowerCase();
    let matchesSearch = true;
    
    if (search) {
      switch (searchFilter) {
        case "name":
          matchesSearch = client.full_name?.toLowerCase().includes(query) ||
                         client.first_name?.toLowerCase().includes(query) ||
                         client.last_name?.toLowerCase().includes(query);
          break;
        case "email":
          matchesSearch = client.email?.toLowerCase().includes(query);
          break;
        case "phone":
          matchesSearch = client.phone?.includes(query);
          break;
        default:
          matchesSearch = 
            client.full_name?.toLowerCase().includes(query) ||
            client.email?.toLowerCase().includes(query) ||
            client.client_number?.toLowerCase().includes(query) ||
            client.phone?.includes(query);
      }
    }
    
    const matchesStatus = statusFilter === "all" || client.account_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Handle client selection with PIN gate enforcement
  const handleSelectClient = (client: any) => {
    // Check if client is already verified in this session
    if (isClientVerified(client.user_id)) {
      // Already verified, open directly
      setSelectedClient({ ...client, sector_tags: client.sector_tags || [] });
      setDetailsDialogOpen(true);
      fetchClientData(client);
    } else {
      // Need to verify - show PIN gate modal
      setPendingClientAccess(client);
      setPinGateModalOpen(true);
    }
  };

  // Handle successful PIN verification
  const handlePinAccessGranted = () => {
    if (pendingClientAccess) {
      verifyClient(pendingClientAccess.user_id);
      setSelectedClient({ ...pendingClientAccess, sector_tags: pendingClientAccess.sector_tags || [] });
      setDetailsDialogOpen(true);
      fetchClientData(pendingClientAccess);
      setPinGateModalOpen(false);
      setPendingClientAccess(null);
    }
  };

  const handlePinGateClose = () => {
    setPinGateModalOpen(false);
    setPendingClientAccess(null);
  };

  const handleUpdateClient = async () => {
    if (!session?.permissions?.can_edit_clients || !selectedClient) {
      toast({ title: "Permission refusée", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke("employee-data", {
        headers: { "x-employee-token": session.token },
        body: { 
          action: "update_client", 
          params: { 
            clientId: selectedClient.id,
            updates: {
              full_name: selectedClient.full_name,
              first_name: selectedClient.first_name,
              last_name: selectedClient.last_name,
              phone: selectedClient.phone,
              date_of_birth: selectedClient.date_of_birth,
              service_address: selectedClient.service_address,
              service_city: selectedClient.service_city,
              service_postal_code: selectedClient.service_postal_code,
              service_province: selectedClient.service_province,
              account_status: selectedClient.account_status,
              id_type: selectedClient.id_type,
              id_number: selectedClient.id_number,
              id_province: selectedClient.id_province,
              id_expiration: selectedClient.id_expiration,
            }
          } 
        },
      });
      if (error) throw error;
      toast({ title: "Client mis à jour avec succès" });
      fetchClients();
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAdjustBalance = async (operation: "add" | "remove") => {
    if (!session?.permissions?.can_edit_clients || !selectedClient || !balanceAmount) {
      toast({ title: "Permission refusée ou montant invalide", variant: "destructive" });
      return;
    }
    const amount = parseFloat(balanceAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "Montant invalide", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke("employee-data", {
        headers: { "x-employee-token": session.token },
        body: { 
          action: "adjust_client_balance", 
          params: { 
            clientId: selectedClient.id,
            field: balanceField,
            amount,
            operation
          } 
        },
      });
      if (error) throw error;
      
      const currentValue = Number(selectedClient[balanceField] || 0);
      const newValue = operation === "add" ? currentValue + amount : Math.max(0, currentValue - amount);
      setSelectedClient({ ...selectedClient, [balanceField]: newValue });
      setBalanceAmount("");
      toast({ title: operation === "add" ? "Montant ajouté" : "Montant retiré" });
      fetchClients();
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateOrder = async () => {
    if (!session?.permissions?.can_edit_orders_status || !selectedOrder) {
      toast({ title: "Permission refusée", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke("employee-data", {
        headers: { "x-employee-token": session.token },
        body: { 
          action: "update_order", 
          params: { 
            orderId: selectedOrder.id,
            updates: {
              status: selectedOrder.status,
              payment_status: selectedOrder.payment_status,
              payment_reference: selectedOrder.payment_reference,
              tracking_number: selectedOrder.tracking_number,
              tracking_url: selectedOrder.tracking_url,
              serial_number: selectedOrder.serial_number,
              equipment_id: selectedOrder.equipment_id,
              imei_number: selectedOrder.imei_number,
              sim_number: selectedOrder.sim_number,
              internal_notes: selectedOrder.internal_notes,
            }
          } 
        },
      });
      if (error) throw error;
      toast({ title: "Commande mise à jour" });
      setOrderDetailsOpen(false);
      if (selectedClient) fetchClientData(selectedClient);
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getSubscriptionStatus = (sub: any) => {
    if (!sub.next_billing_date) return null;
    const daysUntil = differenceInDays(new Date(sub.next_billing_date), new Date());
    if (daysUntil < 0) return { status: "overdue", color: "bg-red-500", text: "En retard" };
    if (daysUntil <= 7) return { status: "soon", color: "bg-amber-500", text: `${daysUntil}j` };
    if (daysUntil <= 30) return { status: "upcoming", color: "bg-cyan-500", text: `${daysUntil}j` };
    return { status: "ok", color: "bg-emerald-500", text: `${daysUntil}j` };
  };

  if (!session) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link to="/employee">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Retour
                </Button>
              </Link>
              <Users className="w-6 h-6 text-primary" />
              <h1 className="font-display font-bold text-lg">Clients</h1>
            </div>
            <div className="flex items-center gap-2">
              {session?.permissions?.can_edit_clients && (
                <Button variant="outline" size="sm" onClick={() => setShowCreateClientDialog(true)}>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Nouveau
                </Button>
              )}
              <span className="text-xs text-muted-foreground">
                <Clock className="w-3 h-3 inline mr-1" />
                {format(lastRefresh, "HH:mm")}
              </span>
              <Button variant="outline" size="sm" onClick={fetchClients} disabled={isLoading}>
                <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
              </Button>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-4">
        {/* Enhanced Search */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Select value={searchFilter} onValueChange={setSearchFilter}>
            <SelectTrigger className="w-full sm:w-[140px]">
              <SelectValue placeholder="Filtrer par" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="name">Nom</SelectItem>
              <SelectItem value="email">Courriel</SelectItem>
              <SelectItem value="phone">Téléphone</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={
                searchFilter === "name" ? "Rechercher par nom..." :
                searchFilter === "email" ? "Rechercher par courriel..." :
                searchFilter === "phone" ? "Rechercher par téléphone..." :
                "Rechercher par nom, email, téléphone, numéro client..."
              }
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              {Object.entries(statusLabels).map(([key, { label }]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Clients Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Liste des clients ({filteredClients.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : filteredClients.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                Aucun client trouvé
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client #</TableHead>
                    <TableHead>Nom</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Téléphone</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Solde</TableHead>
                    <TableHead>Crédit</TableHead>
                    <TableHead>Inscrit le</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClients.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell className="font-medium">{client.client_number || "N/A"}</TableCell>
                      <TableCell>{client.full_name || "N/A"}</TableCell>
                      <TableCell className="text-sm">{client.email || "N/A"}</TableCell>
                      <TableCell>{client.phone || "N/A"}</TableCell>
                      <TableCell>
                        <Badge className={statusLabels[client.account_status]?.color || statusLabels.active.color}>
                          {statusLabels[client.account_status]?.label || "Actif"}
                        </Badge>
                      </TableCell>
                      <TableCell className={Number(client.balance || 0) > 0 ? "text-red-500 font-medium" : ""}>
                        ${Math.abs(Number(client.balance || 0)).toFixed(2)}
                        {Number(client.balance || 0) > 0 && " dû"}
                      </TableCell>
                      <TableCell className="text-emerald-500">
                        ${Number(client.store_credit || 0).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(client.created_at), "d MMM yyyy", { locale: fr })}
                      </TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" onClick={() => handleSelectClient(client)}>
                          <Eye className="w-4 h-4 mr-2" />
                          Gérer
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Client Management Dialog */}
      <Dialog 
        open={detailsDialogOpen} 
        onOpenChange={(open) => {
          if (!open) setDetailsDialogOpen(false);
        }}
      >
        <DialogContent 
          className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col p-0"
          onPointerDownOutside={(e) => e.preventDefault()}
        >
          {/* Sticky Header */}
          <div className="sticky top-0 z-10 bg-background border-b border-border px-6 py-4 flex-shrink-0">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <User className="w-6 h-6 text-primary" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-semibold text-lg truncate">
                    {selectedClient?.full_name || selectedClient?.email}
                  </h2>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    {selectedClient?.client_number && (
                      <span className="font-mono">{selectedClient.client_number}</span>
                    )}
                    {selectedClient?.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {selectedClient.phone}
                      </span>
                    )}
                    {selectedClient?.email && (
                      <span className="hidden md:flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        {selectedClient.email}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <Badge 
                  className={`${
                    selectedClient?.account_status === 'active' ? 'bg-emerald-500/20 text-emerald-500' :
                    selectedClient?.account_status === 'suspended' ? 'bg-red-500/20 text-red-500' :
                    selectedClient?.account_status === 'frozen' ? 'bg-blue-500/20 text-blue-500' :
                    selectedClient?.account_status === 'hold' ? 'bg-amber-500/20 text-amber-500' :
                    'bg-muted text-muted-foreground'
                  }`}
                >
                  {selectedClient?.account_status === 'active' ? 'Actif' :
                   selectedClient?.account_status === 'suspended' ? 'Suspendu' :
                   selectedClient?.account_status === 'frozen' ? 'Gelé' :
                   selectedClient?.account_status === 'hold' ? 'En attente' :
                   selectedClient?.account_status === 'deactivated' ? 'Désactivé' : 'Actif'}
                </Badge>
                {selectedClient?.security_status === 'suspended' && (
                  <Badge variant="destructive" className="flex items-center gap-1">
                    <Shield className="w-3 h-3" />
                    {selectedClient?.security_alert_level === 'fraud' ? 'Fraude' : 'Risque'}
                  </Badge>
                )}
                {selectedClient?.balance > 0 && (
                  <Badge className="bg-amber-500/20 text-amber-500">
                    <DollarSign className="w-3 h-3 mr-1" />
                    {Number(selectedClient.balance).toFixed(2)}$
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {selectedClient && (
            <Tabs defaultValue="profile" className="flex-1 overflow-hidden flex flex-col px-6 pb-6">
              <TabsList className="grid grid-cols-10 w-full flex-shrink-0 overflow-x-auto">
                <TabsTrigger value="profile" className="text-xs">Profil</TabsTrigger>
                <TabsTrigger value="identity" className="text-xs">Identité</TabsTrigger>
                <TabsTrigger value="services" className="text-xs">Services</TabsTrigger>
                <TabsTrigger value="equipment" className="text-xs">Équipement</TabsTrigger>
                <TabsTrigger value="orders" className="text-xs">Commandes</TabsTrigger>
                <TabsTrigger value="payments" className="text-xs">Paiements</TabsTrigger>
                <TabsTrigger value="incidents" className="text-xs">Incidents</TabsTrigger>
                <TabsTrigger value="documents" className="text-xs">Documents</TabsTrigger>
                <TabsTrigger value="tickets" className="text-xs">Tickets</TabsTrigger>
                <TabsTrigger value="logs" className="text-xs">Logs</TabsTrigger>
              </TabsList>

              <ScrollArea className="flex-1 mt-4 min-h-0">
                {isLoadingClientData && (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                  </div>
                )}

                {/* Profile Tab */}
                <TabsContent value="profile" className="space-y-4 pr-4">
                  {/* Security Alert Banner */}
                  <SecurityAlertBanner
                    alertLevel={selectedClient.security_alert_level || "none"}
                    flaggedAt={selectedClient.security_flagged_at}
                    flaggedOrderId={selectedClient.security_flagged_order_id}
                    securityStatus={selectedClient.security_status}
                    securityReason={selectedClient.security_reason}
                  />

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
                          Compte {selectedClient.account_status === 'frozen' ? 'gelé' : selectedClient.account_status === 'hold' ? 'en attente' : 'désactivé'}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Balance Breakdown - Derived from Invoices */}
                  <ClientBalanceBreakdown 
                    clientUserId={selectedClient.user_id} 
                    clientEmail={selectedClient.email}
                  />

                  {/* Store Credit Management */}
                  {session?.permissions?.can_edit_clients && (
                    <div className="p-4 bg-muted/50 rounded-lg border border-border">
                      <Label className="text-xs text-muted-foreground uppercase">Crédit en magasin</Label>
                      <p className="text-2xl font-bold text-emerald-500 mt-1">
                        {Number(selectedClient.store_credit || 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                      </p>
                      <div className="flex gap-2 mt-2">
                        <Input
                          type="number"
                          placeholder="Montant"
                          value={balanceField === "store_credit" ? balanceAmount : ""}
                          onChange={(e) => { setBalanceField("store_credit"); setBalanceAmount(e.target.value); }}
                          className="w-24"
                        />
                        <Button size="sm" variant="outline" onClick={() => { setBalanceField("store_credit"); handleAdjustBalance("add"); }} disabled={isSubmitting}>
                          <PlusCircle className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => { setBalanceField("store_credit"); handleAdjustBalance("remove"); }} disabled={isSubmitting}>
                          <MinusCircle className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Profile Fields */}
                  <Card className="bg-card border-border">
                    <CardContent className="pt-6 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Prénom</Label>
                          <Input 
                            value={selectedClient.first_name || ""} 
                            onChange={(e) => setSelectedClient({ ...selectedClient, first_name: e.target.value })} 
                            disabled={!session?.permissions?.can_edit_clients}
                          />
                        </div>
                        <div>
                          <Label>Nom</Label>
                          <Input 
                            value={selectedClient.last_name || ""} 
                            onChange={(e) => setSelectedClient({ ...selectedClient, last_name: e.target.value })} 
                            disabled={!session?.permissions?.can_edit_clients}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Téléphone</Label>
                          <Input 
                            value={selectedClient.phone || ""} 
                            onChange={(e) => setSelectedClient({ ...selectedClient, phone: e.target.value })} 
                            disabled={!session?.permissions?.can_edit_clients}
                          />
                        </div>
                        <div>
                          <Label>Date de naissance</Label>
                          <Input 
                            type="date" 
                            value={selectedClient.date_of_birth || ""} 
                            onChange={(e) => setSelectedClient({ ...selectedClient, date_of_birth: e.target.value })} 
                            disabled={!session?.permissions?.can_edit_clients}
                          />
                        </div>
                      </div>
                      <div>
                        <Label>Adresse de service</Label>
                        <Input 
                          value={selectedClient.service_address || ""} 
                          onChange={(e) => setSelectedClient({ ...selectedClient, service_address: e.target.value })} 
                          disabled={!session?.permissions?.can_edit_clients}
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <Label>Ville</Label>
                          <Input 
                            value={selectedClient.service_city || ""} 
                            onChange={(e) => setSelectedClient({ ...selectedClient, service_city: e.target.value })} 
                            disabled={!session?.permissions?.can_edit_clients}
                          />
                        </div>
                        <div>
                          <Label>Province</Label>
                          <Input 
                            value={selectedClient.service_province || "QC"} 
                            onChange={(e) => setSelectedClient({ ...selectedClient, service_province: e.target.value })} 
                            disabled={!session?.permissions?.can_edit_clients}
                          />
                        </div>
                        <div>
                          <Label>Code postal</Label>
                          <Input 
                            value={selectedClient.service_postal_code || ""} 
                            onChange={(e) => setSelectedClient({ ...selectedClient, service_postal_code: e.target.value })} 
                            disabled={!session?.permissions?.can_edit_clients}
                          />
                        </div>
                      </div>
                      <div>
                        <Label>Statut du compte</Label>
                        <Select 
                          value={selectedClient.account_status || "active"} 
                          onValueChange={(v) => setSelectedClient({ ...selectedClient, account_status: v })}
                          disabled={!session?.permissions?.can_edit_clients}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">Actif</SelectItem>
                            <SelectItem value="hold">En attente</SelectItem>
                            <SelectItem value="frozen">Gelé</SelectItem>
                            <SelectItem value="suspended">Suspendu</SelectItem>
                            <SelectItem value="deactivated">Désactivé</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {session?.permissions?.can_edit_clients && (
                        <Button onClick={handleUpdateClient} disabled={isSubmitting}>
                          <Save className="w-4 h-4 mr-2" />
                          Enregistrer le profil
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Identity Tab */}
                <TabsContent value="identity" className="space-y-4 pr-4">
                  <Card className="bg-card border-border">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <IdCard className="w-5 h-5 text-primary" />
                        Informations d'identité
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Type de pièce d'identité</Label>
                          <Select 
                            value={selectedClient.id_type || ""} 
                            onValueChange={(v) => setSelectedClient({ ...selectedClient, id_type: v })}
                            disabled={!session?.permissions?.can_edit_clients}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Sélectionner..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="driver_license">Permis de conduire</SelectItem>
                              <SelectItem value="health_card">Carte d'assurance maladie</SelectItem>
                              <SelectItem value="passport">Passeport</SelectItem>
                              <SelectItem value="other">Autre</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Province d'émission</Label>
                          <Select 
                            value={selectedClient.id_province || "QC"} 
                            onValueChange={(v) => setSelectedClient({ ...selectedClient, id_province: v })}
                            disabled={!session?.permissions?.can_edit_clients}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Sélectionner..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="QC">Québec</SelectItem>
                              <SelectItem value="ON">Ontario</SelectItem>
                              <SelectItem value="BC">Colombie-Britannique</SelectItem>
                              <SelectItem value="AB">Alberta</SelectItem>
                              <SelectItem value="other">Autre</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Numéro de pièce d'identité</Label>
                          <Input 
                            value={selectedClient.id_number || ""} 
                            onChange={(e) => setSelectedClient({ ...selectedClient, id_number: e.target.value })} 
                            placeholder="Numéro..."
                            disabled={!session?.permissions?.can_edit_clients}
                          />
                        </div>
                        <div>
                          <Label>Date d'expiration</Label>
                          <Input 
                            type="date" 
                            value={selectedClient.id_expiration || ""} 
                            onChange={(e) => setSelectedClient({ ...selectedClient, id_expiration: e.target.value })} 
                            disabled={!session?.permissions?.can_edit_clients}
                          />
                        </div>
                      </div>
                      {session?.permissions?.can_edit_clients && (
                        <Button onClick={handleUpdateClient} disabled={isSubmitting}>
                          <Save className="w-4 h-4 mr-2" />
                          Enregistrer l'identité
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Services Tab */}
                <TabsContent value="services" className="space-y-4 pr-4">
                  <Card className="bg-card border-border">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Wifi className="w-5 h-5 text-primary" />
                        Abonnements actifs
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {clientSubscriptions.length > 0 ? (
                        <div className="space-y-3">
                          {clientSubscriptions.map((sub: any) => {
                            const billingStatus = getSubscriptionStatus(sub);
                            return (
                              <div key={sub.id} className="flex items-center justify-between p-4 border border-border rounded-lg">
                                <div className="flex items-center gap-4">
                                  {sub.plan_name?.toLowerCase().includes("internet") && <Wifi className="w-8 h-8 text-cyan-400" />}
                                  {sub.plan_name?.toLowerCase().includes("mobile") && <Smartphone className="w-8 h-8 text-purple-400" />}
                                  {sub.plan_name?.toLowerCase().includes("tv") && <Tv className="w-8 h-8 text-pink-400" />}
                                  {!sub.plan_name?.toLowerCase().includes("internet") && 
                                   !sub.plan_name?.toLowerCase().includes("mobile") && 
                                   !sub.plan_name?.toLowerCase().includes("tv") && 
                                   <Package className="w-8 h-8 text-primary" />}
                                  <div>
                                    <p className="font-medium text-foreground">{sub.plan_name}</p>
                                    <p className="text-sm text-muted-foreground">
                                      Depuis {format(new Date(sub.start_date), "d MMM yyyy", { locale: fr })}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-4">
                                  <span className="font-medium">{Number(sub.amount).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}/mois</span>
                                  <Badge className={orderStatusColors[sub.status] || orderStatusColors.active}>
                                    {sub.status === "active" ? "Actif" : sub.status === "paused" ? "Suspendu" : sub.status}
                                  </Badge>
                                  {billingStatus && (
                                    <Badge className={`${billingStatus.color}/20 text-${billingStatus.color.replace("bg-", "")}`}>
                                      {billingStatus.text}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <Wifi className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                          <p className="text-muted-foreground">Aucun abonnement actif</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Equipment Tab */}
                <TabsContent value="equipment" className="space-y-4 pr-4">
                  <Card className="bg-card border-border">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Router className="w-5 h-5 text-primary" />
                        Équipement assigné
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {clientOrders.filter(o => o.serial_number || o.equipment_id || o.sim_number).length > 0 ? (
                        <div className="space-y-4">
                          {clientOrders.filter(o => o.serial_number || o.equipment_id || o.sim_number).map((order: any) => (
                            <div key={order.id} className="p-4 border border-border rounded-lg space-y-3">
                              <div className="flex items-center justify-between">
                                <p className="font-medium">{order.order_number} - {order.service_type}</p>
                                <Badge className={orderStatusColors[order.status]}>{order.status}</Badge>
                              </div>
                              
                              {order.serial_number && (
                                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                                  <Router className="w-5 h-5 text-cyan-400" />
                                  <div className="flex-1">
                                    <p className="font-medium text-sm">Router WiFi</p>
                                    <p className="text-xs text-muted-foreground">S/N: {order.serial_number}</p>
                                  </div>
                                </div>
                              )}
                              
                              {order.equipment_id && (
                                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                                  <Monitor className="w-5 h-5 text-purple-400" />
                                  <div className="flex-1">
                                    <p className="font-medium text-sm">Terminal TV</p>
                                    <p className="text-xs text-muted-foreground">ID: {order.equipment_id}</p>
                                  </div>
                                </div>
                              )}
                              
                              {order.sim_number && (
                                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                                  <Smartphone className="w-5 h-5 text-blue-400" />
                                  <div className="flex-1">
                                    <p className="font-medium text-sm">Carte SIM</p>
                                    <p className="text-xs text-muted-foreground">SIM: {order.sim_number}</p>
                                    {order.imei_number && <p className="text-xs text-muted-foreground">IMEI: {order.imei_number}</p>}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <Router className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                          <p className="text-muted-foreground">Aucun équipement attribué</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Orders Tab */}
                <TabsContent value="orders" className="space-y-4 pr-4">
                  <div className="space-y-3">
                    {clientOrders.length > 0 ? (
                      clientOrders.map((order: any) => (
                        <div key={order.id} className="p-4 border border-border rounded-lg">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <Package className="w-8 h-8 text-primary" />
                              <div>
                                <p className="font-medium text-foreground">{order.order_number || order.service_type}</p>
                                <p className="text-sm text-muted-foreground">{format(new Date(order.created_at), "d MMM yyyy", { locale: fr })}</p>
                                <p className="text-xs text-muted-foreground">{order.service_type}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              {order.total_amount && (
                                <span className="font-medium">{Number(order.total_amount).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                              )}
                              <Badge className={orderStatusColors[order.status] || orderStatusColors.pending}>{order.status}</Badge>
                              <Button size="sm" variant="outline" onClick={() => { setSelectedOrder({ ...order }); setOrderDetailsOpen(true); }}>
                                <Eye className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8">
                        <Package className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                        <p className="text-muted-foreground">Aucune commande</p>
                      </div>
                    )}
                  </div>
                </TabsContent>

                {/* Payments Tab */}
                <TabsContent value="payments" className="space-y-4 pr-4">
                  {/* Credits Display */}
                  <div className="p-4 bg-muted/50 rounded-lg border border-border">
                    <Label className="text-sm font-medium mb-2 block">État du compte</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Solde dû</p>
                        <p className="font-bold text-lg text-amber-500">{Number(selectedClient?.balance || 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Crédit disponible</p>
                        <p className="font-bold text-lg text-emerald-500">{Number(selectedClient?.store_credit || 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</p>
                      </div>
                    </div>
                  </div>

                  {/* Payment History */}
                  <Card className="bg-card border-border">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <CreditCard className="w-5 h-5 text-primary" />
                        Historique des paiements
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {clientPayments.length > 0 ? (
                        <div className="space-y-3">
                          {clientPayments.map((payment: any) => (
                            <div key={payment.id} className="flex items-center justify-between p-4 border border-border rounded-lg">
                              <div className="flex items-center gap-4">
                                <DollarSign className="w-8 h-8 text-emerald-400" />
                                <div>
                                  <p className="font-medium text-foreground">{payment.reference_number}</p>
                                  <p className="text-sm text-muted-foreground">{format(new Date(payment.created_at), "d MMM yyyy HH:mm", { locale: fr })}</p>
                                  <p className="text-xs text-muted-foreground">{payment.payment_method} {payment.card_last_four && `•••• ${payment.card_last_four}`}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <span className="font-bold text-lg text-emerald-500">{Number(payment.amount).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                                <Badge className={orderStatusColors[payment.status] || orderStatusColors.completed}>
                                  {payment.status === "completed" ? "Complété" : payment.status}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <CreditCard className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                          <p className="text-muted-foreground">Aucun paiement</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Invoices */}
                  <Card className="bg-card border-border">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <FileText className="w-5 h-5 text-primary" />
                        Factures
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {clientBilling.length > 0 ? (
                        <div className="space-y-3">
                          {clientBilling.map((bill: any) => (
                            <div key={bill.id} className="flex items-center justify-between p-4 border border-border rounded-lg">
                              <div className="flex items-center gap-4">
                                <FileText className="w-6 h-6 text-primary" />
                                <div>
                                  <p className="font-medium text-foreground">{bill.invoice_number || `Facture #${bill.id.slice(0, 8)}`}</p>
                                  <p className="text-sm text-muted-foreground">
                                    {format(new Date(bill.created_at), "d MMM yyyy", { locale: fr })}
                                    {bill.due_date && ` • Échéance: ${format(new Date(bill.due_date), "d MMM", { locale: fr })}`}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-4">
                                <span className="font-medium">{Number(bill.amount).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                                <Badge className={orderStatusColors[bill.status] || orderStatusColors.pending}>
                                  {bill.status === "paid" ? "Payé" : bill.status === "overdue" ? "En retard" : "En attente"}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                          <p className="text-muted-foreground">Aucune facture</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Incidents Tab */}
                <TabsContent value="incidents" className="space-y-4 pr-4">
                  <Card className="bg-card border-border">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <AlertTriangle className="w-5 h-5 text-amber-400" />
                        Signalements et incidents
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm text-muted-foreground">Enregistrez les incidents signalés par le client.</p>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <Button variant="outline" className="justify-start border-red-500/30 text-red-500 hover:bg-red-500/10" onClick={() => {
                          toast({ title: "Incident SIM volée/perdue", description: "Créez un ticket de support pour ce signalement." });
                        }}>
                          <Smartphone className="w-4 h-4 mr-2" />
                          SIM volée/perdue (60$)
                        </Button>
                        
                        <Button variant="outline" className="justify-start border-red-500/30 text-red-500 hover:bg-red-500/10" onClick={() => {
                          toast({ title: "Téléphone perdu", description: "Créez un ticket de support pour ce signalement." });
                        }}>
                          <Phone className="w-4 h-4 mr-2" />
                          Téléphone perdu
                        </Button>
                        
                        <Button variant="outline" className="justify-start border-amber-500/30 text-amber-500 hover:bg-amber-500/10" onClick={() => {
                          toast({ title: "Problème équipement", description: "Créez un ticket de support pour ce signalement." });
                        }}>
                          <Wrench className="w-4 h-4 mr-2" />
                          Problème équipement
                        </Button>
                        
                        <Button variant="outline" className="justify-start border-blue-500/30 text-blue-500 hover:bg-blue-500/10" onClick={() => {
                          toast({ title: "Pause de service", description: "Créez un ticket de support pour cette demande." });
                        }}>
                          <Pause className="w-4 h-4 mr-2" />
                          Demande pause service
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Documents Tab */}
                <TabsContent value="documents" className="space-y-4 pr-4">
                  <Card className="bg-card border-border">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <FileText className="w-5 h-5 text-primary" />
                        Documents du client
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {clientDocuments.length > 0 ? (
                        <div className="space-y-3">
                          {clientDocuments.map((doc: any) => (
                            <div key={doc.id} className="flex items-center justify-between p-4 border border-border rounded-lg">
                              <div className="flex items-center gap-4">
                                <FileText className="w-6 h-6 text-primary" />
                                <div>
                                  <p className="font-medium text-foreground">{doc.document_name}</p>
                                  <p className="text-sm text-muted-foreground">
                                    {doc.document_type} • {format(new Date(doc.created_at), "d MMM yyyy", { locale: fr })}
                                  </p>
                                </div>
                              </div>
                              <Button size="sm" variant="outline">
                                <Eye className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                          <p className="text-muted-foreground">Aucun document</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Tickets Tab */}
                <TabsContent value="tickets" className="space-y-4 pr-4">
                  <Card className="bg-card border-border">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Ticket className="w-5 h-5 text-primary" />
                        Tickets de support
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {clientTickets.length > 0 ? (
                        <div className="space-y-3">
                          {clientTickets.map((ticket: any) => (
                            <div key={ticket.id} className="flex items-center justify-between p-4 border border-border rounded-lg">
                              <div className="flex items-center gap-4">
                                <Ticket className="w-6 h-6 text-primary" />
                                <div>
                                  <p className="font-medium text-foreground">{ticket.ticket_number || ticket.subject}</p>
                                  <p className="text-sm text-muted-foreground">{ticket.subject}</p>
                                  <p className="text-xs text-muted-foreground">{format(new Date(ticket.created_at), "d MMM yyyy", { locale: fr })}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge className={orderStatusColors[ticket.status] || orderStatusColors.open}>
                                  {ticket.status === "open" ? "Ouvert" : ticket.status === "in_progress" ? "En cours" : ticket.status === "closed" ? "Fermé" : ticket.status}
                                </Badge>
                                <Badge variant="outline">{ticket.priority}</Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <Ticket className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                          <p className="text-muted-foreground">Aucun ticket</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Logs Tab */}
                <TabsContent value="logs" className="space-y-4 pr-4">
                  <ClientLogsTab clientUserId={selectedClient.user_id} isAdmin={false} />
                </TabsContent>
              </ScrollArea>
            </Tabs>
          )}
          
          {/* Back to Top Button */}
          {detailsDialogOpen && <BackToTopButton />}
        </DialogContent>
      </Dialog>

      {/* Order Details Dialog */}
      <Dialog open={orderDetailsOpen} onOpenChange={setOrderDetailsOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" />
              Détails de la commande {selectedOrder?.order_number}
            </DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-lg border border-border">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <Label className="text-xs text-muted-foreground">Service</Label>
                    <p className="font-medium">{selectedOrder.service_type}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Date de commande</Label>
                    <p className="font-medium">{format(new Date(selectedOrder.created_at), "d MMM yyyy HH:mm", { locale: fr })}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Créé par</Label>
                    <p className="font-medium">{selectedOrder.created_by === 'admin' ? 'Admin' : selectedOrder.created_by === 'employee' ? 'Employé' : 'Client'}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Statut</Label>
                  <Select 
                    value={selectedOrder.status} 
                    onValueChange={(v) => setSelectedOrder({ ...selectedOrder, status: v })}
                    disabled={!session?.permissions?.can_edit_orders_status}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">En attente</SelectItem>
                      <SelectItem value="processing">En traitement</SelectItem>
                      <SelectItem value="shipped">Expédié</SelectItem>
                      <SelectItem value="completed">Complété</SelectItem>
                      <SelectItem value="cancelled">Annulé</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Statut paiement</Label>
                  <Select 
                    value={selectedOrder.payment_status || "pending"} 
                    onValueChange={(v) => setSelectedOrder({ ...selectedOrder, payment_status: v })}
                    disabled={!session?.permissions?.can_confirm_payments}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">En attente</SelectItem>
                      <SelectItem value="partial">Partiel</SelectItem>
                      <SelectItem value="paid">Payé</SelectItem>
                      <SelectItem value="refunded">Remboursé</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Référence paiement</Label>
                  <Input 
                    value={selectedOrder.payment_reference || ""} 
                    onChange={(e) => setSelectedOrder({ ...selectedOrder, payment_reference: e.target.value })}
                    disabled={!session?.permissions?.can_confirm_payments} 
                  />
                </div>
                <div>
                  <Label>Numéro de suivi</Label>
                  <Input 
                    value={selectedOrder.tracking_number || ""} 
                    onChange={(e) => setSelectedOrder({ ...selectedOrder, tracking_number: e.target.value })}
                    disabled={!session?.permissions?.can_ship_orders} 
                  />
                </div>
              </div>

              <div>
                <Label>URL de suivi</Label>
                <Input 
                  value={selectedOrder.tracking_url || ""} 
                  onChange={(e) => setSelectedOrder({ ...selectedOrder, tracking_url: e.target.value })}
                  disabled={!session?.permissions?.can_ship_orders} 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Numéro de série (Router)</Label>
                  <Input 
                    value={selectedOrder.serial_number || ""} 
                    onChange={(e) => setSelectedOrder({ ...selectedOrder, serial_number: e.target.value })}
                    disabled={!session?.permissions?.can_edit_orders_status} 
                  />
                </div>
                <div>
                  <Label>ID équipement (Terminal)</Label>
                  <Input 
                    value={selectedOrder.equipment_id || ""} 
                    onChange={(e) => setSelectedOrder({ ...selectedOrder, equipment_id: e.target.value })}
                    disabled={!session?.permissions?.can_edit_orders_status} 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>IMEI</Label>
                  <Input 
                    value={selectedOrder.imei_number || ""} 
                    onChange={(e) => setSelectedOrder({ ...selectedOrder, imei_number: e.target.value })}
                    disabled={!session?.permissions?.can_edit_orders_status} 
                  />
                </div>
                <div>
                  <Label>Numéro SIM</Label>
                  <Input 
                    value={selectedOrder.sim_number || ""} 
                    onChange={(e) => setSelectedOrder({ ...selectedOrder, sim_number: e.target.value })}
                    disabled={!session?.permissions?.can_edit_orders_status} 
                  />
                </div>
              </div>

              <div>
                <Label>Notes internes</Label>
                <Textarea 
                  value={selectedOrder.internal_notes || ""} 
                  onChange={(e) => setSelectedOrder({ ...selectedOrder, internal_notes: e.target.value })} 
                  rows={3}
                  disabled={!session?.permissions?.can_edit_orders_status}
                />
              </div>

              <div className="p-4 bg-muted/50 rounded-lg border border-border">
                <Label className="text-sm font-medium mb-3 block">Récapitulatif financier</Label>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span>Sous-total:</span><span>{Number(selectedOrder.subtotal || 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span></div>
                  <div className="flex justify-between"><span>Livraison:</span><span>{Number(selectedOrder.delivery_fee || 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span></div>
                  <div className="flex justify-between"><span>Activation:</span><span>{Number(selectedOrder.activation_fee || 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span></div>
                  <div className="flex justify-between"><span>Installation:</span><span>{Number(selectedOrder.installation_fee || 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span></div>
                  {selectedOrder.discount_amount > 0 && <div className="flex justify-between text-emerald-500"><span>Rabais:</span><span>-{Number(selectedOrder.discount_amount).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span></div>}
                  <div className="flex justify-between"><span>TPS:</span><span>{Number(selectedOrder.tps_amount || 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span></div>
                  <div className="flex justify-between"><span>TVQ:</span><span>{Number(selectedOrder.tvq_amount || 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span></div>
                  <div className="flex justify-between font-bold text-lg border-t pt-2"><span>Total:</span><span>{Number(selectedOrder.total_amount || 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span></div>
                </div>
              </div>

              {(session?.permissions?.can_edit_orders_status || session?.permissions?.can_ship_orders || session?.permissions?.can_confirm_payments) && (
                <Button className="w-full" onClick={handleUpdateOrder} disabled={isSubmitting}>
                  <Save className="w-4 h-4 mr-2" />
                  Enregistrer les modifications
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Client Dialog */}
      <Dialog open={showCreateClientDialog} onOpenChange={setShowCreateClientDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5" />
              Nouveau client
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Prénom *</Label>
                <Input value={newClient.first_name} onChange={(e) => setNewClient({ ...newClient, first_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Nom *</Label>
                <Input value={newClient.last_name} onChange={(e) => setNewClient({ ...newClient, last_name: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Courriel *</Label>
                <Input type="email" value={newClient.email} onChange={(e) => setNewClient({ ...newClient, email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Téléphone</Label>
                <Input value={newClient.phone} onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Adresse de service</Label>
              <Input value={newClient.service_address} onChange={(e) => setNewClient({ ...newClient, service_address: e.target.value })} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Ville</Label>
                <Input value={newClient.service_city} onChange={(e) => setNewClient({ ...newClient, service_city: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Code postal</Label>
                <Input value={newClient.service_postal_code} onChange={(e) => setNewClient({ ...newClient, service_postal_code: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Province</Label>
                <Input value={newClient.service_province} onChange={(e) => setNewClient({ ...newClient, service_province: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateClientDialog(false)}>Annuler</Button>
            <Button onClick={handleCreateClient} disabled={isSubmitting || !newClient.email || !newClient.first_name}>
              {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
              Créer le client
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PIN Gate Modal for Client Access */}
      {pendingClientAccess && (
        <ClientAccessGateModal
          isOpen={pinGateModalOpen}
          onClose={handlePinGateClose}
          onAccessGranted={handlePinAccessGranted}
          client={{
            id: pendingClientAccess.id,
            user_id: pendingClientAccess.user_id,
            full_name: pendingClientAccess.full_name,
            email: pendingClientAccess.email,
            date_of_birth: pendingClientAccess.date_of_birth,
            service_postal_code: pendingClientAccess.service_postal_code,
          }}
          staffUser={{
            id: session?.employee_id || "",
            name: session?.full_name || session?.email || "Employee",
            email: session?.email,
            role: "employee",
          }}
          isAdminBypass={false}
        />
      )}
    </div>
  );
};

export default EmployeeClients;
