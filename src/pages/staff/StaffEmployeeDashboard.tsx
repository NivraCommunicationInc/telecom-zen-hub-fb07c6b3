import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Users, LogOut, Loader2, ShoppingCart, FileText, 
  Ticket, DollarSign, Phone, Search, Plus, Clock,
  CheckCircle, AlertCircle, RefreshCw
} from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface RecentOrder {
  id: string;
  order_number: string;
  status: string;
  created_at: string;
  client_email: string;
  total_amount: number;
}

interface OpenTicket {
  id: string;
  ticket_number: string;
  subject: string;
  priority: string;
  created_at: string;
  client_email: string;
}

export default function StaffEmployeeDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [openTickets, setOpenTickets] = useState<OpenTicket[]>([]);
  const [stats, setStats] = useState({
    pendingOrders: 0,
    openTickets: 0,
    pendingPayments: 0,
  });

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        navigate("/staff");
        return;
      }

      const { data: hasRole } = await supabase.rpc("has_staff_role", {
        _user_id: session.user.id,
        _role: "employee",
      });

      if (!hasRole) {
        toast.error("Accès non autorisé");
        navigate("/staff");
        return;
      }

      await fetchData();
      setLoading(false);
    };

    checkAuth();
  }, [navigate]);

  const fetchData = async () => {
    try {
      // Fetch recent orders
      const { data: orders } = await supabase
        .from("orders")
        .select("id, order_number, status, created_at, client_email, total_amount")
        .order("created_at", { ascending: false })
        .limit(10);

      setRecentOrders(orders || []);

      // Fetch open tickets
      const { data: tickets } = await supabase
        .from("support_tickets")
        .select("id, ticket_number, subject, priority, created_at, client_email")
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(10);

      setOpenTickets(tickets || []);

      // Fetch stats
      const [pendingOrders, openTicketsCount, pendingPayments] = await Promise.all([
        supabase.from("orders").select("id", { count: "exact", head: true }).in("status", ["pending", "processing"]),
        supabase.from("support_tickets").select("id", { count: "exact", head: true }).eq("status", "open"),
        supabase.from("billing").select("id", { count: "exact", head: true }).eq("status", "pending"),
      ]);

      setStats({
        pendingOrders: pendingOrders.count || 0,
        openTickets: openTicketsCount.count || 0,
        pendingPayments: pendingPayments.count || 0,
      });
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Déconnexion réussie");
    navigate("/staff");
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/admin/clients?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      pending: { label: "En attente", variant: "secondary" },
      processing: { label: "En cours", variant: "default" },
      completed: { label: "Complétée", variant: "outline" },
      cancelled: { label: "Annulée", variant: "destructive" },
    };
    const c = config[status] || { label: status, variant: "secondary" };
    return <Badge variant={c.variant}>{c.label}</Badge>;
  };

  const getPriorityBadge = (priority: string) => {
    const config: Record<string, { label: string; className: string }> = {
      low: { label: "Basse", className: "bg-slate-500" },
      medium: { label: "Moyenne", className: "bg-blue-500" },
      high: { label: "Haute", className: "bg-orange-500" },
      urgent: { label: "Urgente", className: "bg-red-500" },
    };
    const c = config[priority] || { label: priority, className: "bg-slate-500" };
    return <Badge className={c.className}>{c.label}</Badge>;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="bg-slate-800/50 backdrop-blur border-b border-slate-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600">
              <Users className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Service Client</h1>
              <p className="text-sm text-slate-400">Nivra Telecom</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              onClick={() => fetchData()}
              className="text-slate-400 hover:text-white hover:bg-slate-700"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              onClick={handleLogout}
              className="text-slate-400 hover:text-white hover:bg-slate-700"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Déconnexion
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* Search Bar */}
        <Card className="border-slate-700 bg-slate-800/50 backdrop-blur">
          <CardContent className="pt-6">
            <form onSubmit={handleSearch} className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher un client (nom, email, téléphone, numéro de compte)..."
                  className="pl-10 bg-slate-700 border-slate-600 text-white placeholder:text-slate-500"
                />
              </div>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                Rechercher
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Stats & Quick Actions */}
        <div className="grid md:grid-cols-4 gap-4">
          <div className="p-4 rounded-lg border border-orange-500/50 bg-orange-500/10">
            <div className="flex items-center gap-2 mb-2">
              <ShoppingCart className="h-4 w-4 text-orange-500" />
              <span className="text-sm text-slate-400">Commandes en attente</span>
            </div>
            <p className="text-2xl font-bold text-orange-500">{stats.pendingOrders}</p>
          </div>
          
          <div className="p-4 rounded-lg border border-pink-500/50 bg-pink-500/10">
            <div className="flex items-center gap-2 mb-2">
              <Ticket className="h-4 w-4 text-pink-500" />
              <span className="text-sm text-slate-400">Tickets ouverts</span>
            </div>
            <p className="text-2xl font-bold text-pink-500">{stats.openTickets}</p>
          </div>
          
          <div className="p-4 rounded-lg border border-yellow-500/50 bg-yellow-500/10">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-yellow-500" />
              <span className="text-sm text-slate-400">Paiements en attente</span>
            </div>
            <p className="text-2xl font-bold text-yellow-500">{stats.pendingPayments}</p>
          </div>

          <button
            onClick={() => navigate("/admin/orders/new")}
            className="p-4 rounded-lg border border-green-500 bg-green-500/10 hover:bg-green-500/20 transition-colors flex items-center justify-center gap-2 text-green-500"
          >
            <Plus className="h-5 w-5" />
            <span className="font-medium">Nouvelle commande</span>
          </button>
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button
            onClick={() => navigate("/admin/orders")}
            className="p-4 rounded-lg border border-slate-600 bg-slate-700/50 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors flex items-center gap-3"
          >
            <ShoppingCart className="h-5 w-5" />
            <span className="font-medium">Commandes</span>
          </button>
          <button
            onClick={() => navigate("/admin/clients")}
            className="p-4 rounded-lg border border-slate-600 bg-slate-700/50 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors flex items-center gap-3"
          >
            <Users className="h-5 w-5" />
            <span className="font-medium">Clients</span>
          </button>
          <button
            onClick={() => navigate("/admin/support")}
            className="p-4 rounded-lg border border-slate-600 bg-slate-700/50 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors flex items-center gap-3"
          >
            <Ticket className="h-5 w-5" />
            <span className="font-medium">Tickets</span>
          </button>
          <button
            onClick={() => navigate("/admin/billing")}
            className="p-4 rounded-lg border border-slate-600 bg-slate-700/50 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors flex items-center gap-3"
          >
            <FileText className="h-5 w-5" />
            <span className="font-medium">Factures</span>
          </button>
        </div>

        {/* Recent Orders & Tickets */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Recent Orders */}
          <Card className="border-slate-700 bg-slate-800/50 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Commandes récentes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentOrders.length === 0 ? (
                <p className="text-slate-400 text-center py-4">Aucune commande</p>
              ) : (
                recentOrders.map((order) => (
                  <button
                    key={order.id}
                    onClick={() => navigate(`/admin/orders/${order.id}`)}
                    className="w-full p-3 rounded-lg border border-slate-600 bg-slate-700/50 hover:bg-slate-700 transition-colors text-left"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-white">{order.order_number}</span>
                      {getStatusBadge(order.status)}
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-400">{order.client_email || "Client"}</span>
                      <span className="text-slate-400">
                        {format(new Date(order.created_at), "d MMM", { locale: fr })}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </CardContent>
          </Card>

          {/* Open Tickets */}
          <Card className="border-slate-700 bg-slate-800/50 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Ticket className="h-5 w-5" />
                Tickets ouverts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {openTickets.length === 0 ? (
                <p className="text-slate-400 text-center py-4">Aucun ticket ouvert</p>
              ) : (
                openTickets.map((ticket) => (
                  <button
                    key={ticket.id}
                    onClick={() => navigate(`/admin/support/${ticket.id}`)}
                    className="w-full p-3 rounded-lg border border-slate-600 bg-slate-700/50 hover:bg-slate-700 transition-colors text-left"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-white">{ticket.ticket_number}</span>
                      {getPriorityBadge(ticket.priority || "medium")}
                    </div>
                    <p className="text-sm text-slate-300 truncate mb-1">{ticket.subject}</p>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-400">{ticket.client_email}</span>
                      <span className="text-slate-400">
                        {format(new Date(ticket.created_at), "d MMM", { locale: fr })}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
