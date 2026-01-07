import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Package, Search, Eye, Calendar, User, DollarSign, ChevronLeft, ChevronRight, Lock } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useEmployeeOrdersList } from "@/hooks/useEmployeeOrdersList";


const EmployeeOrders = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [page, setPage] = useState(0);
  const pageSize = 25;

  // Debounced search
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    const timer = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  // Fetch orders from server endpoint
  const { orders, total, isLoading, error } = useEmployeeOrdersList(
    page,
    pageSize,
    statusFilter,
    debouncedSearch
  );

  const statusColors: Record<string, string> = {
    pending: "bg-amber-500/20 text-amber-500",
    processing: "bg-blue-500/20 text-blue-500",
    verification: "bg-purple-500/20 text-purple-500",
    shipped: "bg-cyan-500/20 text-cyan-500",
    completed: "bg-emerald-500/20 text-emerald-500",
    cancelled: "bg-red-500/20 text-red-500",
  };

  const statusLabels: Record<string, string> = {
    pending: "En attente",
    processing: "En traitement",
    verification: "Vérification",
    shipped: "Expédiée",
    completed: "Complétée",
    cancelled: "Annulée",
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Commandes</h1>
          <p className="text-muted-foreground mt-1">Consulter les commandes (lecture seule)</p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par numéro, client..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="pending">En attente</SelectItem>
              <SelectItem value="processing">En traitement</SelectItem>
              <SelectItem value="verification">Vérification</SelectItem>
              <SelectItem value="shipped">Expédiée</SelectItem>
              <SelectItem value="completed">Complétée</SelectItem>
              <SelectItem value="cancelled">Annulée</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Permission error */}
        {error && (
          <Card className="bg-destructive/10 border-destructive/20">
            <CardContent className="p-4 flex items-center gap-3">
              <Lock className="w-5 h-5 text-destructive" />
              <span className="text-destructive">
                {error instanceof Error && error.message.includes("Permission") 
                  ? "Vous n'avez pas la permission de voir les commandes."
                  : "Erreur lors du chargement des commandes."}
              </span>
            </CardContent>
          </Card>
        )}

        {/* Orders List */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Commandes ({total})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Chargement...</div>
            ) : orders && orders.length > 0 ? (
              <>
                <div className="space-y-2">
                  {orders.map((order: any) => (
                    <div
                      key={order.id}
                      className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-accent/30 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                          <Package className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground font-mono">
                            {order.order_number || order.confirmation_number || "—"}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {order.client_first_name} {order.client_last_name} • {order.service_type}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(order.created_at), "d MMM yyyy HH:mm", { locale: fr })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="font-medium">
                            {Number(order.total_amount || 0).toLocaleString("fr-CA", {
                              style: "currency",
                              currency: "CAD",
                            })}
                          </p>
                        </div>
                        <Badge className={statusColors[order.status] || statusColors.pending}>
                          {statusLabels[order.status] || order.status}
                        </Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedOrder(order);
                            setDetailsOpen(true);
                          }}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                    <p className="text-sm text-muted-foreground">
                      Page {page + 1} sur {totalPages}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(Math.max(0, page - 1))}
                        disabled={page === 0}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                        disabled={page >= totalPages - 1}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            ) : !error ? (
              <p className="text-center py-8 text-muted-foreground">Aucune commande trouvée</p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {/* Order Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Détails de la commande {selectedOrder?.order_number}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh]">
            {selectedOrder && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <span>
                        {selectedOrder.client_first_name} {selectedOrder.client_last_name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span>
                        {format(new Date(selectedOrder.created_at), "d MMMM yyyy HH:mm", { locale: fr })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <DollarSign className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium">
                        {Number(selectedOrder.total_amount || 0).toLocaleString("fr-CA", {
                          style: "currency",
                          currency: "CAD",
                        })}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Statut:</span>
                      <Badge className={statusColors[selectedOrder.status] || statusColors.pending}>
                        {statusLabels[selectedOrder.status] || selectedOrder.status}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Service:</span>
                      <span className="text-sm">{selectedOrder.service_type}</span>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">
                    Les commandes sont en lecture seule. Pour modifier, contactez un administrateur.
                  </p>
                </div>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default EmployeeOrders;
