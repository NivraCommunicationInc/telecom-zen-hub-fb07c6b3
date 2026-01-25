/**
 * StaffOrders - Employee portal orders view
 */
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  ShoppingCart, Search, Loader2, RefreshCw, Clock, 
  CheckCircle, XCircle, AlertTriangle, User, DollarSign, ArrowLeft
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import StaffBackground from "@/components/staff/StaffBackground";

export default function StaffOrders() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: orders, isLoading, refetch } = useQuery({
    queryKey: ["staff-orders", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const filteredOrders = orders?.filter(order => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      order.order_number?.toLowerCase().includes(q) ||
      order.client_email?.toLowerCase().includes(q) ||
      order.service_type?.toLowerCase().includes(q)
    );
  });

  const getStatusConfig = (status: string) => {
    const configs: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
      pending: { label: "En attente", icon: <Clock className="h-3 w-3" />, className: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
      processing: { label: "En cours", icon: <RefreshCw className="h-3 w-3 animate-spin" />, className: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
      completed: { label: "Terminée", icon: <CheckCircle className="h-3 w-3" />, className: "bg-green-500/20 text-green-400 border-green-500/30" },
      cancelled: { label: "Annulée", icon: <XCircle className="h-3 w-3" />, className: "bg-red-500/20 text-red-400 border-red-500/30" },
      confirmed: { label: "Confirmée", icon: <CheckCircle className="h-3 w-3" />, className: "bg-teal-500/20 text-teal-400 border-teal-500/30" },
    };
    return configs[status] || { label: status, icon: null, className: "bg-slate-500/20 text-slate-400" };
  };

  return (
    <div className="min-h-screen relative">
      <StaffBackground />
      
      <div className="relative z-10 p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/staff/dashboard")}
              className="text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="p-3 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-400 shadow-lg">
              <ShoppingCart className="h-6 w-6 text-slate-900" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Commandes</h1>
              <p className="text-slate-400">Gérer les commandes clients</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => refetch()}
            className="text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {/* Filters */}
        <Card className="border-slate-700/50 bg-slate-900/60 backdrop-blur-xl">
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher par numéro, email ou service..."
                  className="pl-10 bg-slate-800/50 border-slate-700 text-white"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-48 bg-slate-800/50 border-slate-700 text-white">
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="pending">En attente</SelectItem>
                  <SelectItem value="processing">En cours</SelectItem>
                  <SelectItem value="confirmed">Confirmée</SelectItem>
                  <SelectItem value="completed">Terminée</SelectItem>
                  <SelectItem value="cancelled">Annulée</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Orders List */}
        <Card className="border-slate-700/50 bg-slate-900/60 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-white flex items-center justify-between">
              <span>Commandes ({filteredOrders?.length || 0})</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-teal-400" />
              </div>
            ) : !filteredOrders?.length ? (
              <p className="text-slate-400 text-center py-8">Aucune commande trouvée</p>
            ) : (
              <ScrollArea className="max-h-[600px]">
                <div className="space-y-3">
                  {filteredOrders.map((order) => {
                    const status = getStatusConfig(order.status);
                    return (
                      <Link
                        key={order.id}
                        to={`/staff/orders/${order.id}`}
                        className="block p-4 rounded-lg border border-slate-700 bg-slate-800/30 hover:bg-slate-800/50 hover:border-teal-500/50 transition-all"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <span className="font-mono font-semibold text-white text-lg">{order.order_number}</span>
                            <Badge className={`${status.className} flex items-center gap-1`}>
                              {status.icon}
                              {status.label}
                            </Badge>
                          </div>
                          <span className="text-xl font-bold text-teal-400">
                            {order.total_amount?.toFixed(2)} $
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm text-slate-400">
                          <div className="flex items-center gap-4">
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {order.client_email || "Client"}
                            </span>
                            <span>{order.service_type}</span>
                          </div>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(new Date(order.created_at), "d MMM yyyy HH:mm", { locale: fr })}
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
