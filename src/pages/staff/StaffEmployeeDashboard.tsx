import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Users, LogOut, Loader2, ShoppingCart, FileText, 
  Ticket, DollarSign, Search, Clock, RefreshCw,
  User, Phone, Mail, MapPin, AlertTriangle, CheckCircle,
  XCircle, Clock3, Shield, Eye
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import StaffBackground from "@/components/staff/StaffBackground";
import { StaffSidebar } from "@/components/staff/StaffSidebar";
import { StaffClientAccessGate, useStaffClientAccess } from "@/components/staff/StaffClientAccessGate";

interface RecentOrder {
  id: string;
  order_number: string;
  status: string;
  created_at: string;
  client_email: string;
  total_amount: number;
  service_type: string;
}

interface OpenTicket {
  id: string;
  ticket_number: string;
  subject: string;
  priority: string;
  created_at: string;
  client_email: string;
  status: string;
}

interface ClientSearchResult {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  client_number: string | null;
  service_address: string | null;
}

interface StaffInfo {
  name: string;
  email: string;
}

export default function StaffEmployeeDashboard() {
  const navigate = useNavigate();
  const { checkAccess } = useStaffClientAccess();
  
  const [loading, setLoading] = useState(true);
  const [staffInfo, setStaffInfo] = useState<StaffInfo | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<ClientSearchResult[]>([]);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [openTickets, setOpenTickets] = useState<OpenTicket[]>([]);
  const [stats, setStats] = useState({
    pendingOrders: 0,
    openTickets: 0,
    pendingPayments: 0,
    activeClients: 0,
  });
  
  // Client access gate state
  const [selectedClient, setSelectedClient] = useState<ClientSearchResult | null>(null);
  const [showAccessGate, setShowAccessGate] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      await Promise.all([fetchStaffInfo(), fetchData()]);
      setLoading(false);
    };
    loadData();
  }, []);

  const fetchStaffInfo = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, email")
          .eq("user_id", session.user.id)
          .maybeSingle();
        
        setStaffInfo({
          name: profile?.full_name || session.user.email?.split("@")[0] || "Employé",
          email: session.user.email || "",
        });
      }
    } catch (error) {
      console.error("Error fetching staff info:", error);
    }
  };

  const fetchData = async () => {
    try {
      const [ordersRes, ticketsRes, statsRes] = await Promise.all([
        supabase
          .from("orders")
          .select("id, order_number, status, created_at, client_email, total_amount, service_type")
          .order("created_at", { ascending: false })
          .limit(15),
        supabase
          .from("support_tickets")
          .select("id, ticket_number, subject, priority, created_at, client_email, status")
          .in("status", ["open", "in_progress"])
          .order("created_at", { ascending: false })
          .limit(15),
        Promise.all([
          supabase.from("orders").select("id", { count: "exact", head: true }).in("status", ["pending", "processing"]),
          supabase.from("support_tickets").select("id", { count: "exact", head: true }).eq("status", "open"),
          supabase.from("billing").select("id", { count: "exact", head: true }).eq("status", "pending"),
          supabase.from("profiles").select("id", { count: "exact", head: true }),
        ]),
      ]);

      setRecentOrders(ordersRes.data || []);
      setOpenTickets(ticketsRes.data || []);
      setStats({
        pendingOrders: statsRes[0].count || 0,
        openTickets: statsRes[1].count || 0,
        pendingPayments: statsRes[2].count || 0,
        activeClients: statsRes[3].count || 0,
      });
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      toast.error("Veuillez entrer au moins 2 caractères");
      return;
    }

    setIsSearching(true);
    setSearchResults([]);

    try {
      const query = searchQuery.trim().toLowerCase();
      
      const { data, error } = await supabase
        .from("profiles")
        .select("id, user_id, full_name, email, phone, client_number, service_address")
        .or(`email.ilike.%${query}%,full_name.ilike.%${query}%,phone.ilike.%${query}%,client_number.ilike.%${query}%`)
        .limit(20);

      if (error) throw error;

      setSearchResults(data || []);
      
      if (!data?.length) {
        toast.info("Aucun client trouvé");
      }
    } catch (error) {
      console.error("Search error:", error);
      toast.error("Erreur lors de la recherche");
    } finally {
      setIsSearching(false);
    }
  };

  const handleClientClick = (client: ClientSearchResult) => {
    // Check if we already have access
    if (checkAccess(client.user_id)) {
      // Already have access, navigate directly
      navigateToClientProfile(client.user_id);
    } else {
      // Need to authenticate
      setSelectedClient(client);
      setShowAccessGate(true);
    }
  };

  const navigateToClientProfile = (clientUserId: string) => {
    navigate(`/staff/clients/${clientUserId}`);
  };

  const handleAccessGranted = () => {
    if (selectedClient) {
      navigateToClientProfile(selectedClient.user_id);
    }
    setShowAccessGate(false);
    setSelectedClient(null);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Déconnexion réussie");
    navigate("/staff");
  };

  const getStatusConfig = (status: string) => {
    const configs: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
      pending: { label: "En attente", icon: <Clock3 className="h-3 w-3" />, className: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
      processing: { label: "En cours", icon: <RefreshCw className="h-3 w-3" />, className: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
      completed: { label: "Terminée", icon: <CheckCircle className="h-3 w-3" />, className: "bg-green-500/20 text-green-400 border-green-500/30" },
      cancelled: { label: "Annulée", icon: <XCircle className="h-3 w-3" />, className: "bg-red-500/20 text-red-400 border-red-500/30" },
      open: { label: "Ouvert", icon: <AlertTriangle className="h-3 w-3" />, className: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
      in_progress: { label: "En cours", icon: <RefreshCw className="h-3 w-3" />, className: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
    };
    return configs[status] || { label: status, icon: null, className: "bg-slate-500/20 text-slate-400" };
  };

  const getPriorityConfig = (priority: string) => {
    const configs: Record<string, { label: string; className: string }> = {
      low: { label: "Basse", className: "bg-slate-600 text-slate-200" },
      medium: { label: "Moyenne", className: "bg-blue-600 text-white" },
      high: { label: "Haute", className: "bg-orange-600 text-white" },
      urgent: { label: "Urgente", className: "bg-red-600 text-white animate-pulse" },
    };
    return configs[priority] || { label: priority, className: "bg-slate-600" };
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center relative">
        <StaffBackground />
        <Loader2 className="h-10 w-10 animate-spin text-teal-400 z-10" />
      </div>
    );
  }

  return (
    <div className="min-h-screen relative flex">
      <StaffBackground />
      
      {/* Sidebar */}
      <StaffSidebar 
        onSignOut={handleLogout}
        userEmail={staffInfo?.email}
        userName={staffInfo?.name}
      />
      
      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Header for mobile */}
        <header className="lg:hidden sticky top-0 z-50 bg-slate-900/80 backdrop-blur-xl border-b border-slate-700/50">
          <div className="px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-400 shadow-lg shadow-teal-500/20">
                  <Users className="h-6 w-6 text-slate-900" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">Portail Employé</h1>
                  <p className="text-sm text-slate-400">Bienvenue, {staffInfo?.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => fetchData()}
                  className="text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  onClick={handleLogout}
                  className="text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Déconnexion
                </Button>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 relative z-10 space-y-6 overflow-auto">
        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard 
            label="Commandes en attente" 
            value={stats.pendingOrders} 
            icon={<ShoppingCart className="h-5 w-5" />}
            color="orange"
          />
          <StatCard 
            label="Tickets ouverts" 
            value={stats.openTickets} 
            icon={<Ticket className="h-5 w-5" />}
            color="pink"
          />
          <StatCard 
            label="Paiements en attente" 
            value={stats.pendingPayments} 
            icon={<DollarSign className="h-5 w-5" />}
            color="yellow"
          />
          <StatCard 
            label="Clients actifs" 
            value={stats.activeClients} 
            icon={<Users className="h-5 w-5" />}
            color="teal"
          />
        </div>

        {/* Search Section */}
        <Card className="border-slate-700/50 bg-slate-900/60 backdrop-blur-xl shadow-xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-white flex items-center gap-2">
              <Search className="h-5 w-5 text-teal-400" />
              Recherche Client
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSearch} className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Nom, email, téléphone ou numéro de compte..."
                  className="pl-10 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                />
              </div>
              <Button 
                type="submit" 
                disabled={isSearching}
                className="bg-gradient-to-r from-teal-500 to-cyan-500 text-slate-900 hover:from-teal-600 hover:to-cyan-600"
              >
                {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Rechercher"}
              </Button>
            </form>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-sm text-slate-400 mb-2">{searchResults.length} résultat(s)</p>
                <ScrollArea className="max-h-64">
                  <div className="space-y-2">
                    {searchResults.map((client) => (
                      <button
                        key={client.id}
                        onClick={() => handleClientClick(client)}
                        className="w-full p-4 rounded-lg border border-slate-700 bg-slate-800/50 hover:bg-slate-700/50 transition-colors text-left group"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <div className="p-2 rounded-full bg-slate-700 group-hover:bg-teal-500/20 transition-colors">
                              <User className="h-4 w-4 text-slate-400 group-hover:text-teal-400" />
                            </div>
                            <div>
                              <p className="font-medium text-white">{client.full_name || "Client"}</p>
                              <div className="flex flex-wrap gap-3 mt-1 text-sm text-slate-400">
                                {client.email && (
                                  <span className="flex items-center gap-1">
                                    <Mail className="h-3 w-3" />
                                    {client.email}
                                  </span>
                                )}
                                {client.phone && (
                                  <span className="flex items-center gap-1">
                                    <Phone className="h-3 w-3" />
                                    {client.phone}
                                  </span>
                                )}
                              </div>
                              {client.client_number && (
                                <p className="text-xs text-slate-500 mt-1">{client.client_number}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Shield className="h-4 w-4 text-amber-400" />
                            <Eye className="h-4 w-4 text-teal-400" />
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tabs for Orders and Tickets */}
        <Tabs defaultValue="orders" className="w-full">
          <TabsList className="bg-slate-800/50 border border-slate-700">
            <TabsTrigger value="orders" className="data-[state=active]:bg-teal-500/20 data-[state=active]:text-teal-400">
              <ShoppingCart className="h-4 w-4 mr-2" />
              Commandes récentes
            </TabsTrigger>
            <TabsTrigger value="tickets" className="data-[state=active]:bg-teal-500/20 data-[state=active]:text-teal-400">
              <Ticket className="h-4 w-4 mr-2" />
              Tickets ouverts
            </TabsTrigger>
          </TabsList>

          <TabsContent value="orders" className="mt-4">
            <Card className="border-slate-700/50 bg-slate-900/60 backdrop-blur-xl">
              <CardContent className="pt-6">
                {recentOrders.length === 0 ? (
                  <p className="text-slate-400 text-center py-8">Aucune commande récente</p>
                ) : (
                  <div className="space-y-3">
                    {recentOrders.map((order) => {
                      const status = getStatusConfig(order.status);
                      return (
                        <button
                          key={order.id}
                          onClick={() => navigate(`/staff/orders/${order.id}`)}
                          className="w-full p-4 rounded-lg border border-slate-700 bg-slate-800/30 hover:bg-slate-800/50 hover:border-teal-500/50 transition-all text-left group"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                              <span className="font-mono font-semibold text-white group-hover:text-teal-400 transition-colors">{order.order_number}</span>
                              <Badge className={`${status.className} flex items-center gap-1`}>
                                {status.icon}
                                {status.label}
                              </Badge>
                            </div>
                            <span className="text-lg font-semibold text-teal-400">
                              {order.total_amount?.toFixed(2)} $
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-sm text-slate-400">
                            <span>{order.client_email || "Client"}</span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {format(new Date(order.created_at), "d MMM yyyy", { locale: fr })}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
                <Button
                  variant="outline"
                  onClick={() => navigate("/staff/orders")}
                  className="w-full mt-4 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800"
                >
                  Voir toutes les commandes
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tickets" className="mt-4">
            <Card className="border-slate-700/50 bg-slate-900/60 backdrop-blur-xl">
              <CardContent className="pt-6">
                {openTickets.length === 0 ? (
                  <p className="text-slate-400 text-center py-8">Aucun ticket ouvert</p>
                ) : (
                  <div className="space-y-3">
                    {openTickets.map((ticket) => {
                      const priority = getPriorityConfig(ticket.priority || "medium");
                      const status = getStatusConfig(ticket.status);
                      return (
                        <button
                          key={ticket.id}
                          onClick={() => navigate(`/staff/tickets/${ticket.id}`)}
                          className="w-full p-4 rounded-lg border border-slate-700 bg-slate-800/30 hover:bg-slate-800/50 hover:border-teal-500/50 transition-all text-left group"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-3">
                              <span className="font-mono font-semibold text-white group-hover:text-teal-400 transition-colors">{ticket.ticket_number}</span>
                              <Badge className={priority.className}>
                                {priority.label}
                              </Badge>
                              <Badge className={`${status.className} flex items-center gap-1`}>
                                {status.icon}
                                {status.label}
                              </Badge>
                            </div>
                          </div>
                          <p className="text-slate-300 mb-2 line-clamp-1">{ticket.subject}</p>
                          <div className="flex items-center justify-between text-sm text-slate-400">
                            <span>{ticket.client_email}</span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {format(new Date(ticket.created_at), "d MMM yyyy", { locale: fr })}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
                <Button
                  variant="outline"
                  onClick={() => navigate("/staff/tickets")}
                  className="w-full mt-4 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800"
                >
                  Voir tous les tickets
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Quick Links Section */}
        <Card className="border-slate-700/50 bg-slate-900/60 backdrop-blur-xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-white text-lg">Accès rapide</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              <Button
                variant="outline"
                onClick={() => navigate("/staff/clients")}
                className="h-auto py-4 flex flex-col gap-2 border-slate-700 hover:border-teal-500/50 hover:bg-slate-800/50"
              >
                <Users className="h-5 w-5 text-teal-400" />
                <span className="text-sm">Clients</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate("/staff/orders")}
                className="h-auto py-4 flex flex-col gap-2 border-slate-700 hover:border-teal-500/50 hover:bg-slate-800/50"
              >
                <ShoppingCart className="h-5 w-5 text-teal-400" />
                <span className="text-sm">Commandes</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate("/staff/billing")}
                className="h-auto py-4 flex flex-col gap-2 border-slate-700 hover:border-teal-500/50 hover:bg-slate-800/50"
              >
                <DollarSign className="h-5 w-5 text-teal-400" />
                <span className="text-sm">Facturation</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate("/staff/appointments")}
                className="h-auto py-4 flex flex-col gap-2 border-slate-700 hover:border-teal-500/50 hover:bg-slate-800/50"
              >
                <Clock className="h-5 w-5 text-teal-400" />
                <span className="text-sm">RDV</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate("/staff/tv-channels")}
                className="h-auto py-4 flex flex-col gap-2 border-slate-700 hover:border-teal-500/50 hover:bg-slate-800/50"
              >
                <Ticket className="h-5 w-5 text-teal-400" />
                <span className="text-sm">TV</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate("/staff/notes")}
                className="h-auto py-4 flex flex-col gap-2 border-slate-700 hover:border-teal-500/50 hover:bg-slate-800/50"
              >
                <FileText className="h-5 w-5 text-teal-400" />
                <span className="text-sm">Notes</span>
              </Button>
            </div>
          </CardContent>
        </Card>
        </main>
      </div>

      {/* Client Access Gate Dialog */}
      {selectedClient && (
        <StaffClientAccessGate
          clientId={selectedClient.user_id}
          clientName={selectedClient.full_name || undefined}
          clientEmail={selectedClient.email || undefined}
          isOpen={showAccessGate}
          onClose={() => {
            setShowAccessGate(false);
            setSelectedClient(null);
          }}
          onAccessGranted={handleAccessGranted}
        />
      )}
    </div>
  );
}

function StatCard({ 
  label, 
  value, 
  icon, 
  color 
}: { 
  label: string; 
  value: number; 
  icon: React.ReactNode; 
  color: "orange" | "pink" | "yellow" | "teal";
}) {
  const colorClasses = {
    orange: "border-orange-500/30 bg-orange-500/10 text-orange-400",
    pink: "border-pink-500/30 bg-pink-500/10 text-pink-400",
    yellow: "border-amber-500/30 bg-amber-500/10 text-amber-400",
    teal: "border-teal-500/30 bg-teal-500/10 text-teal-400",
  };

  return (
    <div className={`p-4 rounded-xl border ${colorClasses[color]} backdrop-blur-sm`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-sm text-slate-400">{label}</span>
      </div>
      <p className="text-3xl font-bold">{value}</p>
    </div>
  );
}
