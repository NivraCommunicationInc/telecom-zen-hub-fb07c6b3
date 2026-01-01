import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Package,
  LogOut,
  RefreshCw,
  Search,
  ArrowLeft,
  Eye,
  User,
  MapPin,
  Calendar,
  Clock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const statusLabels: Record<string, { label: string; color: string }> = {
  pending: { label: "En attente", color: "bg-yellow-500/20 text-yellow-600" },
  verification: { label: "Vérification", color: "bg-blue-500/20 text-blue-600" },
  processing: { label: "En traitement", color: "bg-cyan-500/20 text-cyan-600" },
  shipped: { label: "Expédié", color: "bg-purple-500/20 text-purple-600" },
  completed: { label: "Terminé", color: "bg-emerald-500/20 text-emerald-600" },
  cancelled: { label: "Annulé", color: "bg-red-500/20 text-red-600" },
};

const EmployeeOrders = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [session, setSession] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  useEffect(() => {
    const stored = localStorage.getItem("nivra_employee_session");
    if (!stored) {
      navigate("/employee/login");
      return;
    }
    try {
      const s = JSON.parse(stored);
      if (!s.permissions?.can_view_orders) {
        toast({ title: "Accès refusé", variant: "destructive" });
        navigate("/employee");
        return;
      }
      setSession(s);
    } catch {
      navigate("/employee/login");
    }
  }, [navigate, toast]);

  const fetchOrders = async () => {
    if (!session?.token) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("employee-data", {
        headers: { "x-employee-token": session.token },
        body: { action: "get_orders", params: { limit: 200 } },
      });
      if (error) throw error;
      setOrders(data?.orders || []);
      setLastRefresh(new Date());
    } catch (error) {
      console.error("Error fetching orders:", error);
      toast({ title: "Erreur", description: "Impossible de charger les commandes", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (session?.token) fetchOrders();
  }, [session?.token]);

  const handleLogout = () => {
    localStorage.removeItem("nivra_employee_session");
    navigate("/employee/login");
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = !search || 
      order.order_number?.toLowerCase().includes(search.toLowerCase()) ||
      order.client_email?.toLowerCase().includes(search.toLowerCase()) ||
      order.confirmation_number?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleUpdateStatus = async (orderId: string, newStatus: string) => {
    if (!session?.permissions?.can_edit_orders_status) {
      toast({ title: "Permission refusée", variant: "destructive" });
      return;
    }
    try {
      const { data, error } = await supabase.functions.invoke("employee-data", {
        headers: { "x-employee-token": session.token },
        body: { action: "update_order_status", params: { orderId, status: newStatus } },
      });
      if (error || data?.error) throw new Error(data?.error || error);
      toast({ title: "Statut mis à jour" });
      fetchOrders();
      setSelectedOrder(null);
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    }
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
              <Package className="w-6 h-6 text-blue-500" />
              <h1 className="font-display font-bold text-lg">Commandes</h1>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                <Clock className="w-3 h-3 inline mr-1" />
                {format(lastRefresh, "HH:mm")}
              </span>
              <Button variant="outline" size="sm" onClick={fetchOrders} disabled={isLoading}>
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
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par numéro ou email..."
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

        {/* Orders Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Aucune commande trouvée
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Commande</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Service</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">
                        {order.order_number || "N/A"}
                      </TableCell>
                      <TableCell>{order.client_email || "N/A"}</TableCell>
                      <TableCell>{order.service_type || "N/A"}</TableCell>
                      <TableCell>
                        <Badge className={statusLabels[order.status]?.color || "bg-gray-500/20"}>
                          {statusLabels[order.status]?.label || order.status}
                        </Badge>
                      </TableCell>
                      <TableCell>${order.total_amount?.toFixed(2) || "0.00"}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(order.created_at), "d MMM yyyy", { locale: fr })}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => setSelectedOrder(order)}>
                          <Eye className="w-4 h-4" />
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

      {/* Order Details Dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              {selectedOrder?.order_number || "Commande"}
            </DialogTitle>
            <DialogDescription>
              {selectedOrder?.confirmation_number && `Confirmation: ${selectedOrder.confirmation_number}`}
            </DialogDescription>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Statut</span>
                <Badge className={statusLabels[selectedOrder.status]?.color}>
                  {statusLabels[selectedOrder.status]?.label || selectedOrder.status}
                </Badge>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <span>{selectedOrder.client_email || "N/A"}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span>{format(new Date(selectedOrder.created_at), "d MMMM yyyy HH:mm", { locale: fr })}</span>
                </div>
              </div>

              <div className="border-t pt-4">
                <p className="text-sm font-medium mb-2">Service: {selectedOrder.service_type || "N/A"}</p>
                <p className="text-lg font-bold">Total: ${selectedOrder.total_amount?.toFixed(2) || "0.00"}</p>
              </div>

              {session?.permissions?.can_edit_orders_status && (
                <div className="border-t pt-4">
                  <p className="text-sm font-medium mb-2">Changer le statut</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(statusLabels).map(([key, { label }]) => (
                      <Button
                        key={key}
                        variant={selectedOrder.status === key ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleUpdateStatus(selectedOrder.id, key)}
                        disabled={selectedOrder.status === key}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EmployeeOrders;
