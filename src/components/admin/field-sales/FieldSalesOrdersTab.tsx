/**
 * FieldSalesOrdersTab - Orders management for field sales with integration to main orders
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { adminClient as adminSupabase } from "@/integrations/backend/adminClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import {
  Package,
  Clock,
  CheckCircle,
  XCircle,
  Wifi,
  Cloud,
  RefreshCw,
  Eye,
  ArrowUpRight,
  MoreHorizontal,
  FileText,
  Phone,
  Loader2,
  Filter,
  Receipt,
} from "lucide-react";
import { FieldSalesOrderDetailDialog } from "./FieldSalesOrderDetailDialog";

interface FieldSalesOrder {
  id: string;
  order_number: string | null;
  local_id: string | null;
  salesperson_id: string;
  salesperson_name?: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_address: string;
  service_city: string | null;
  service_postal_code?: string | null;
  service_type: string;
  plan_name: string;
  monthly_price: number;
  total_amount: number;
  payment_method: string;
  payment_status: string;
  payment_reference?: string | null;
  sync_status: string;
  synced_at: string | null;
  created_at: string;
  converted_order_id: string | null;
  appointment_date: string | null;
  appointment_notes: string | null;
  signature_data?: string | null;
  notes?: string | null;
}

interface FieldSalesOrdersTabProps {
  onForceSync: () => void;
  isSyncing: boolean;
  pendingSyncs: number;
}

export function FieldSalesOrdersTab({ onForceSync, isSyncing, pendingSyncs }: FieldSalesOrdersTabProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [syncFilter, setSyncFilter] = useState<string>("all");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [selectedOrder, setSelectedOrder] = useState<FieldSalesOrder | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  // Fetch orders
  const { data: orders, isLoading, refetch } = useQuery({
    queryKey: ["admin-field-sales-orders-full", syncFilter, paymentFilter],
    queryFn: async () => {
      let query = adminSupabase
        .from("field_sales_orders")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

      if (syncFilter !== "all") {
        query = query.eq("sync_status", syncFilter);
      }

      if (paymentFilter !== "all") {
        query = query.eq("payment_status", paymentFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Get salesperson names
      if (data && data.length > 0) {
        const salespersonIds = [...new Set(data.map(o => o.salesperson_id))];
        const { data: profiles } = await adminSupabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", salespersonIds);

        return data.map(order => ({
          ...order,
          salesperson_name: profiles?.find(p => p.user_id === order.salesperson_id)?.full_name || "—",
        })) as FieldSalesOrder[];
      }

      return data as FieldSalesOrder[];
    },
  });

  // Convert to main order mutation
  const convertOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const { data, error } = await adminSupabase.functions.invoke("field-sales-sync", {
        body: { 
          action: "convert_single",
          field_order_id: orderId 
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({ 
        title: "Commande convertie", 
        description: `Nouvelle commande créée: ${data?.order_number || ""}` 
      });
      queryClient.invalidateQueries({ queryKey: ["admin-field-sales-orders-full"] });
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const getSyncStatusBadge = (status: string) => {
    switch (status) {
      case "synced":
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-0"><Wifi className="w-3 h-3 mr-1" />Sync</Badge>;
      case "pending":
        return <Badge className="bg-amber-500/20 text-amber-400 border-0"><Cloud className="w-3 h-3 mr-1" />Attente</Badge>;
      case "failed":
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Échec</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPaymentStatusBadge = (status: string) => {
    switch (status) {
      case "confirmed":
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-0"><CheckCircle className="w-3 h-3 mr-1" />Payé</Badge>;
      case "pending":
        return <Badge className="bg-amber-500/20 text-amber-400 border-0"><Clock className="w-3 h-3 mr-1" />Attente</Badge>;
      case "failed":
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Échoué</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPaymentMethodLabel = (method: string) => {
    switch (method) {
      case "interac":
        return "Interac";
      case "paypal":
        return "PayPal";
      case "deferred":
        return "Différé";
      case "cash":
        return "Comptant";
      default:
        return method;
    }
  };

  return (
    <div className="space-y-4">
      {/* Action Bar */}
      {pendingSyncs > 0 && (
        <Card className="border-amber-500/50 bg-amber-500/10">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Cloud className="h-5 w-5 text-amber-400" />
                <div>
                  <p className="font-medium text-amber-400">
                    {pendingSyncs} commande(s) en attente de synchronisation
                  </p>
                  <p className="text-sm text-amber-400/70">
                    Ces ventes hors ligne doivent être synchronisées avec le système principal
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={onForceSync}
                disabled={isSyncing}
                className="border-amber-500 text-amber-400 hover:bg-amber-500/20"
              >
                {isSyncing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Forcer la synchronisation
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-slate-700 bg-slate-800/50">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-orange-400" />
                Commandes terrain
              </CardTitle>
              <CardDescription>
                Toutes les ventes porte-à-porte et leur statut d'intégration
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={syncFilter} onValueChange={setSyncFilter}>
                <SelectTrigger className="w-36 bg-slate-900/50 border-slate-700">
                  <Wifi className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Sync" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="synced">Synchronisées</SelectItem>
                  <SelectItem value="pending">En attente</SelectItem>
                  <SelectItem value="failed">Échouées</SelectItem>
                </SelectContent>
              </Select>
              <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                <SelectTrigger className="w-36 bg-slate-900/50 border-slate-700">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Paiement" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="confirmed">Payées</SelectItem>
                  <SelectItem value="pending">En attente</SelectItem>
                  <SelectItem value="failed">Échouées</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="icon"
                onClick={() => refetch()}
                className="border-slate-700"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : !orders || orders.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <Package className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg">Aucune commande terrain</p>
              <p className="text-sm mt-1">Les ventes effectuées par les représentants apparaîtront ici</p>
            </div>
          ) : (
            <ScrollArea className="h-[600px]">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-700 hover:bg-transparent">
                    <TableHead className="text-slate-400">Date</TableHead>
                    <TableHead className="text-slate-400">Vendeur</TableHead>
                    <TableHead className="text-slate-400">Client</TableHead>
                    <TableHead className="text-slate-400">Service</TableHead>
                    <TableHead className="text-slate-400">Montant</TableHead>
                    <TableHead className="text-slate-400">Paiement</TableHead>
                    <TableHead className="text-slate-400">Sync</TableHead>
                    <TableHead className="text-slate-400 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow 
                      key={order.id} 
                      className="border-slate-700 cursor-pointer hover:bg-slate-800/50"
                      onClick={() => {
                        setSelectedOrder(order);
                        setDetailDialogOpen(true);
                      }}
                    >
                      <TableCell>
                        <div>
                          <p className="text-white font-medium">
                            {format(new Date(order.created_at), "dd MMM", { locale: fr })}
                          </p>
                          <p className="text-xs text-slate-500">
                            {format(new Date(order.created_at), "HH:mm")}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-white">
                        {order.salesperson_name}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-white font-medium">{order.customer_name}</p>
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <Phone className="h-3 w-3" />
                            {order.customer_phone}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-white capitalize">{order.service_type}</p>
                          <p className="text-xs text-slate-500">{order.plan_name}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-white font-bold">${order.total_amount.toFixed(2)}</p>
                          <p className="text-xs text-slate-500">{getPaymentMethodLabel(order.payment_method)}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getPaymentStatusBadge(order.payment_status)}
                      </TableCell>
                      <TableCell>
                        {getSyncStatusBadge(order.sync_status)}
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-slate-800 border-slate-700">
                            <DropdownMenuItem 
                              onClick={() => {
                                setSelectedOrder(order);
                                setDetailDialogOpen(true);
                              }}
                              className="text-white hover:bg-slate-700"
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              Voir détails
                            </DropdownMenuItem>
                            {order.converted_order_id && (
                              <DropdownMenuItem
                                onClick={() => navigate(`/admin/orders/${order.converted_order_id}`)}
                                className="text-white hover:bg-slate-700"
                              >
                                <ArrowUpRight className="h-4 w-4 mr-2" />
                                Voir commande liée
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem 
                              onClick={async () => {
                                setSelectedOrder(order);
                                // Quick contract generation
                                try {
                                  const { generateFieldSalesContractPDF } = await import("@/lib/fieldSalesContractGenerator");
                                  await generateFieldSalesContractPDF({
                                    orderNumber: order.order_number || `FS-${order.id.slice(0, 8)}`,
                                    createdAt: order.created_at,
                                    customer: {
                                      name: order.customer_name,
                                      email: order.customer_email,
                                      phone: order.customer_phone,
                                      address: order.customer_address,
                                      city: order.service_city || "",
                                      postalCode: order.service_postal_code || "",
                                    },
                                    service: {
                                      type: order.service_type,
                                      planName: order.plan_name,
                                      monthlyPrice: order.monthly_price,
                                    },
                                    payment: {
                                      method: order.payment_method,
                                      status: order.payment_status,
                                      totalAmount: order.total_amount,
                                      reference: order.payment_reference || null,
                                    },
                                    salespersonName: order.salesperson_name || "Représentant",
                                    appointmentDate: order.appointment_date,
                                    appointmentNotes: order.appointment_notes,
                                    signatureData: order.signature_data,
                                  });
                                  toast({ title: "Contrat généré" });
                                } catch (error: any) {
                                  toast({ title: "Erreur", description: error.message, variant: "destructive" });
                                }
                              }}
                              className="text-white hover:bg-slate-700"
                            >
                              <FileText className="h-4 w-4 mr-2" />
                              Générer contrat
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={async () => {
                                try {
                                  const { generateFieldSalesInvoicePDF } = await import("@/lib/fieldSalesInvoiceGenerator");
                                  await generateFieldSalesInvoicePDF({
                                    invoiceNumber: `INV-FS-${order.id.slice(0, 8).toUpperCase()}`,
                                    orderNumber: order.order_number || `FS-${order.id.slice(0, 8)}`,
                                    createdAt: order.created_at,
                                    customer: {
                                      name: order.customer_name,
                                      email: order.customer_email,
                                      phone: order.customer_phone,
                                      address: order.customer_address,
                                      city: order.service_city || "",
                                      postalCode: order.service_postal_code || "",
                                    },
                                    service: {
                                      type: order.service_type,
                                      planName: order.plan_name,
                                      monthlyPrice: order.monthly_price,
                                    },
                                    payment: {
                                      method: order.payment_method,
                                      status: order.payment_status,
                                      totalAmount: order.total_amount,
                                      reference: order.payment_reference || null,
                                    },
                                  });
                                  toast({ title: "Facture générée" });
                                } catch (error: any) {
                                  toast({ title: "Erreur", description: error.message, variant: "destructive" });
                                }
                              }}
                              className="text-white hover:bg-slate-700"
                            >
                              <Receipt className="h-4 w-4 mr-2" />
                              Générer facture
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-slate-700" />
                            {!order.converted_order_id && order.sync_status === "synced" && (
                              <DropdownMenuItem
                                onClick={() => convertOrderMutation.mutate(order.id)}
                                disabled={convertOrderMutation.isPending}
                                className="text-cyan-400 hover:bg-cyan-500/20"
                              >
                                <ArrowUpRight className="h-4 w-4 mr-2" />
                                Convertir en commande
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Order Detail Dialog */}
      <FieldSalesOrderDetailDialog
        order={selectedOrder}
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
      />
    </div>
  );
}
