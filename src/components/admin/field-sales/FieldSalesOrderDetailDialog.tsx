/**
 * FieldSalesOrderDetailDialog - Detailed view of field sales order with contract/invoice generation
 */
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { adminClient as adminSupabase } from "@/integrations/backend/adminClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Package,
  DollarSign,
  FileText,
  Receipt,
  CheckCircle,
  Clock,
  XCircle,
  Wifi,
  WifiOff,
  Cloud,
  ArrowUpRight,
  Loader2,
  Printer,
  Download,
  CreditCard,
  AlertTriangle,
  Eye,
} from "lucide-react";

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

interface FieldSalesOrderDetailDialogProps {
  order: FieldSalesOrder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FieldSalesOrderDetailDialog({
  order,
  open,
  onOpenChange,
}: FieldSalesOrderDetailDialogProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isGeneratingContract, setIsGeneratingContract] = useState(false);
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);

  // Convert to main order mutation
  const convertOrderMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await adminSupabase.functions.invoke("field-sales-sync", {
        body: { 
          action: "convert_single",
          field_order_id: order!.id 
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
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  // Generate contract PDF
  const generateContractPDF = async () => {
    if (!order) return;
    
    setIsGeneratingContract(true);
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

      toast({ title: "Contrat généré", description: "Le PDF a été téléchargé" });
    } catch (error: any) {
      console.error("Error generating contract:", error);
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } finally {
      setIsGeneratingContract(false);
    }
  };

  // Generate invoice PDF
  const generateInvoicePDF = async () => {
    if (!order) return;
    
    setIsGeneratingInvoice(true);
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

      toast({ title: "Facture générée", description: "Le PDF a été téléchargé" });
    } catch (error: any) {
      console.error("Error generating invoice:", error);
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } finally {
      setIsGeneratingInvoice(false);
    }
  };

  if (!order) return null;

  const getSyncStatusBadge = (status: string) => {
    switch (status) {
      case "synced":
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-0"><Wifi className="w-3 h-3 mr-1" />Synchronisée</Badge>;
      case "pending":
        return <Badge className="bg-amber-500/20 text-amber-400 border-0"><Cloud className="w-3 h-3 mr-1" />En attente</Badge>;
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
        return <Badge className="bg-amber-500/20 text-amber-400 border-0"><Clock className="w-3 h-3 mr-1" />En attente</Badge>;
      case "failed":
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Échoué</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPaymentMethodLabel = (method: string) => {
    switch (method) {
      case "interac": return "Interac e-Transfer";
      case "paypal": return "PayPal";
      case "deferred": return "Différé";
      case "cash": return "Comptant";
      default: return method;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-700 max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-4">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-orange-500 to-amber-400">
              <Package className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-lg font-bold">
                Commande {order.order_number || `FS-${order.id.slice(0, 8)}`}
              </p>
              <p className="text-sm text-slate-400 font-normal">
                Créée le {format(new Date(order.created_at), "d MMMM yyyy à HH:mm", { locale: fr })}
              </p>
            </div>
            <div className="flex gap-2">
              {getSyncStatusBadge(order.sync_status)}
              {getPaymentStatusBadge(order.payment_status)}
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Customer Info */}
          <Card className="border-slate-700 bg-slate-800/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-slate-400 flex items-center gap-2">
                <User className="h-4 w-4" />
                Informations client
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <User className="h-4 w-4 text-slate-500" />
                  <span className="text-white font-medium">{order.customer_name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-slate-500" />
                  <span className="text-slate-300">{order.customer_email}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-slate-500" />
                  <span className="text-slate-300">{order.customer_phone}</span>
                </div>
                <div className="flex items-center gap-3">
                  <MapPin className="h-4 w-4 text-slate-500" />
                  <span className="text-slate-300">
                    {order.customer_address}
                    {order.service_city && `, ${order.service_city}`}
                  </span>
                </div>
              </div>
              
              {/* View Client Profile Button */}
              {order.converted_order_id && (
                <div className="pt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/admin/orders/${order.converted_order_id}`)}
                    className="border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/20"
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Voir le profil client
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Service Details */}
          <Card className="border-slate-700 bg-slate-800/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-slate-400 flex items-center gap-2">
                <Package className="h-4 w-4" />
                Détails du service
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-500">Type de service</p>
                  <p className="text-white font-medium capitalize">{order.service_type}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Plan</p>
                  <p className="text-white font-medium">{order.plan_name}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Prix mensuel</p>
                  <p className="text-cyan-400 font-bold text-lg">${order.monthly_price.toFixed(2)}/mois</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Représentant</p>
                  <p className="text-white">{order.salesperson_name || "—"}</p>
                </div>
              </div>

              {order.appointment_date && (
                <div className="mt-4 p-3 rounded-lg bg-slate-900/50">
                  <div className="flex items-center gap-2 text-slate-400 mb-1">
                    <Calendar className="h-4 w-4" />
                    <span className="text-sm">Rendez-vous d'installation</span>
                  </div>
                  <p className="text-white">
                    {format(new Date(order.appointment_date), "EEEE d MMMM yyyy à HH:mm", { locale: fr })}
                  </p>
                  {order.appointment_notes && (
                    <p className="text-sm text-slate-400 mt-1">{order.appointment_notes}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment Info */}
          <Card className="border-slate-700 bg-slate-800/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-slate-400 flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Paiement
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-slate-500">Montant total</p>
                  <p className="text-emerald-400 font-bold text-xl">${order.total_amount.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Méthode</p>
                  <div className="flex items-center gap-2 mt-1">
                    <CreditCard className="h-4 w-4 text-slate-500" />
                    <span className="text-white">{getPaymentMethodLabel(order.payment_method)}</span>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Statut</p>
                  <div className="mt-1">
                    {getPaymentStatusBadge(order.payment_status)}
                  </div>
                </div>
              </div>
              {order.payment_reference && (
                <div className="mt-3 p-2 rounded bg-slate-900/50">
                  <p className="text-xs text-slate-500">Référence</p>
                  <p className="text-slate-300 font-mono text-sm">{order.payment_reference}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notes */}
          {order.notes && (
            <Card className="border-slate-700 bg-slate-800/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-slate-400">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-300">{order.notes}</p>
              </CardContent>
            </Card>
          )}

          <Separator className="bg-slate-700" />

          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={generateContractPDF}
              disabled={isGeneratingContract}
              className="border-orange-500/50 text-orange-400 hover:bg-orange-500/20"
            >
              {isGeneratingContract ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileText className="h-4 w-4 mr-2" />
              )}
              Contrat PDF
            </Button>

            <Button
              variant="outline"
              onClick={generateInvoicePDF}
              disabled={isGeneratingInvoice}
              className="border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/20"
            >
              {isGeneratingInvoice ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Receipt className="h-4 w-4 mr-2" />
              )}
              Facture PDF
            </Button>

            {order.converted_order_id ? (
              <Button
                variant="outline"
                onClick={() => navigate(`/admin/orders/${order.converted_order_id}`)}
                className="border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/20"
              >
                <ArrowUpRight className="h-4 w-4 mr-2" />
                Voir commande principale
              </Button>
            ) : order.sync_status === "synced" ? (
              <Button
                onClick={() => convertOrderMutation.mutate()}
                disabled={convertOrderMutation.isPending}
                className="bg-gradient-to-r from-cyan-500 to-teal-400 text-white"
              >
                {convertOrderMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <ArrowUpRight className="h-4 w-4 mr-2" />
                )}
                Convertir en commande
              </Button>
            ) : (
              <div className="flex items-center gap-2 text-amber-400 text-sm">
                <AlertTriangle className="h-4 w-4" />
                Synchroniser avant de convertir
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
