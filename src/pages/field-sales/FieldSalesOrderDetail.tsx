/**
 * FieldSalesOrderDetail - Complete order detail page for field sales representatives
 * Full features: client info, services, payment, PDF generation, notes
 */
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { motion } from "framer-motion";
import StaffBackground from "@/components/staff/StaffBackground";
import { IOSHeader } from "@/components/field-sales/ios/IOSHeader";
import { IOSBottomNav } from "@/components/field-sales/ios/IOSBottomNav";
import { IOSWidgetCard } from "@/components/field-sales/ios/IOSWidgetCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  Tv,
  Smartphone,
  Loader2,
  CreditCard,
  MessageSquare,
  PenLine,
  Copy,
  ExternalLink,
  Image,
  AlertTriangle,
  Edit3,
  Save,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ServiceItem {
  offer_id: string;
  name: string;
  category: string;
  price_monthly: number;
  price_setup: number;
  quantity: number;
}

interface OrderDetails {
  id: string;
  local_id: string | null;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string;
  customer_address: string;
  customer_city: string | null;
  customer_postal_code: string | null;
  total_amount: number;
  payment_method: string | null;
  payment_status: string | null;
  payment_reference: string | null;
  sync_status: string | null;
  synced_at: string | null;
  created_at: string;
  converted_order_id: string | null;
  appointment_date: string | null;
  appointment_notes: string | null;
  location_photo_url: string | null;
  gps_latitude: number | null;
  gps_longitude: number | null;
  internal_notes: string | null;
  services: ServiceItem[];
  signature_captured_at: string | null;
}

const getCategoryIcon = (category: string) => {
  switch (category) {
    case "internet": return <Wifi className="h-5 w-5 text-blue-400" />;
    case "tv": return <Tv className="h-5 w-5 text-purple-400" />;
    case "mobile": return <Smartphone className="h-5 w-5 text-green-400" />;
    default: return <Package className="h-5 w-5 text-orange-400" />;
  }
};

export default function FieldSalesOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [activeTab, setActiveTab] = useState("details");
  const [isGeneratingContract, setIsGeneratingContract] = useState(false);
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);
  const [showPhoto, setShowPhoto] = useState(false);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [editedNotes, setEditedNotes] = useState("");
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  useEffect(() => {
    loadOrder();
  }, [id]);

  const loadOrder = async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        toast.error("Session expirée");
        navigate("/field-sales");
        return;
      }

      const { data, error } = await supabase
        .from("field_sales_orders")
        .select("*")
        .eq("id", id)
        .eq("salesperson_id", session.user.id)
        .maybeSingle();

      if (error) throw error;
      
      if (!data) {
        toast.error("Commande non trouvée");
        navigate("/field-sales/sales");
        return;
      }

      const parsedServices = Array.isArray(data.services) 
        ? (data.services as unknown as ServiceItem[]) 
        : [];

      setOrder({
        id: data.id,
        local_id: data.local_id,
        customer_name: data.customer_name,
        customer_email: data.customer_email,
        customer_phone: data.customer_phone,
        customer_address: data.customer_address,
        customer_city: data.customer_city,
        customer_postal_code: data.customer_postal_code,
        total_amount: data.total_amount,
        payment_method: data.payment_method,
        payment_status: data.payment_status,
        payment_reference: data.payment_reference,
        sync_status: data.sync_status,
        synced_at: data.synced_at,
        created_at: data.created_at,
        converted_order_id: data.converted_order_id,
        appointment_date: data.appointment_date,
        appointment_notes: data.appointment_notes,
        location_photo_url: data.location_photo_url,
        gps_latitude: data.gps_latitude,
        gps_longitude: data.gps_longitude,
        internal_notes: data.internal_notes,
        services: parsedServices,
        signature_captured_at: data.signature_captured_at,
      });
      setEditedNotes(data.internal_notes || "");
    } catch (error) {
      console.error("Error loading order:", error);
      toast.error("Erreur de chargement");
    } finally {
      setLoading(false);
    }
  };

  // Get primary service info from services array
  const getPrimaryServiceInfo = (services: ServiceItem[]) => {
    if (services.length === 0) return { name: "Service", category: "autre", monthlyPrice: 0 };
    const primary = services[0];
    const totalMonthly = services.reduce((sum, s) => sum + (s.price_monthly * (s.quantity || 1)), 0);
    return { 
      name: primary.name, 
      category: primary.category, 
      monthlyPrice: totalMonthly 
    };
  };

  // Generate contract PDF
  const generateContractPDF = async () => {
    if (!order) return;
    
    setIsGeneratingContract(true);
    try {
      const { generateFieldSalesContractPDF } = await import("@/lib/fieldSalesContractGenerator");
      const serviceInfo = getPrimaryServiceInfo(order.services);
      
      await generateFieldSalesContractPDF({
        orderNumber: `FS-${order.id.slice(0, 8)}`,
        createdAt: order.created_at,
        customer: {
          name: order.customer_name,
          email: order.customer_email || "",
          phone: order.customer_phone,
          address: order.customer_address,
          city: order.customer_city || "",
          postalCode: order.customer_postal_code || "",
        },
        service: {
          type: serviceInfo.category,
          planName: serviceInfo.name,
          monthlyPrice: serviceInfo.monthlyPrice,
        },
        payment: {
          method: order.payment_method || "pending",
          status: order.payment_status || "pending",
          totalAmount: order.total_amount,
          reference: order.payment_reference || null,
        },
        salespersonName: "Représentant",
        appointmentDate: order.appointment_date,
        appointmentNotes: order.appointment_notes,
        signatureData: null,
      });

      toast.success("Contrat PDF téléchargé");
    } catch (error: any) {
      console.error("Error generating contract:", error);
      toast.error("Erreur lors de la génération");
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
      const serviceInfo = getPrimaryServiceInfo(order.services);
      
      await generateFieldSalesInvoicePDF({
        invoiceNumber: `INV-FS-${order.id.slice(0, 8).toUpperCase()}`,
        orderNumber: `FS-${order.id.slice(0, 8)}`,
        createdAt: order.created_at,
        customer: {
          name: order.customer_name,
          email: order.customer_email || "",
          phone: order.customer_phone,
          address: order.customer_address,
          city: order.customer_city || "",
          postalCode: order.customer_postal_code || "",
        },
        service: {
          type: serviceInfo.category,
          planName: serviceInfo.name,
          monthlyPrice: serviceInfo.monthlyPrice,
        },
        payment: {
          method: order.payment_method || "pending",
          status: order.payment_status || "pending",
          totalAmount: order.total_amount,
          reference: order.payment_reference || null,
        },
      });

      toast.success("Facture PDF téléchargée");
    } catch (error: any) {
      console.error("Error generating invoice:", error);
      toast.error("Erreur lors de la génération");
    } finally {
      setIsGeneratingInvoice(false);
    }
  };

  // Save notes
  const saveNotes = async () => {
    if (!order) return;
    
    setIsSavingNotes(true);
    try {
      const { error } = await supabase
        .from("field_sales_orders")
        .update({ internal_notes: editedNotes })
        .eq("id", order.id);

      if (error) throw error;

      setOrder({ ...order, internal_notes: editedNotes });
      setIsEditingNotes(false);
      toast.success("Notes enregistrées");
    } catch (error: any) {
      console.error("Error saving notes:", error);
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setIsSavingNotes(false);
    }
  };

  // Copy to clipboard
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copié`);
  };

  const getPaymentStatusConfig = (status: string | null) => {
    switch (status) {
      case "confirmed":
        return { label: "Payé", icon: CheckCircle, className: "bg-emerald-500/20 text-emerald-400" };
      case "pending":
        return { label: "En attente", icon: Clock, className: "bg-amber-500/20 text-amber-400" };
      case "failed":
        return { label: "Échec", icon: XCircle, className: "bg-red-500/20 text-red-400" };
      default:
        return { label: "En attente", icon: Clock, className: "bg-slate-500/20 text-slate-400" };
    }
  };

  const getSyncStatusConfig = (status: string | null) => {
    switch (status) {
      case "synced":
        return { label: "Synchronisée", icon: CheckCircle, className: "bg-cyan-500/20 text-cyan-400" };
      case "pending":
        return { label: "En attente", icon: Clock, className: "bg-amber-500/20 text-amber-400" };
      case "failed":
        return { label: "Échec sync", icon: AlertTriangle, className: "bg-red-500/20 text-red-400" };
      default:
        return { label: "Non sync", icon: Clock, className: "bg-slate-500/20 text-slate-400" };
    }
  };

  const getPaymentMethodLabel = (method: string | null) => {
    switch (method) {
      case "interac": return "Interac e-Transfer";
      case "paypal": return "PayPal";
      case "deferred": return "Différé (facturation)";
      case "cash": return "Comptant";
      default: return method || "Non spécifié";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center relative bg-slate-950">
        <StaffBackground />
        <div className="flex flex-col items-center gap-4 z-10">
          <div className="p-4 rounded-2xl bg-orange-500/20">
            <Loader2 className="h-8 w-8 animate-spin text-orange-400" />
          </div>
          <p className="text-slate-400 font-medium">Chargement de la commande...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center relative bg-slate-950">
        <StaffBackground />
        <div className="flex flex-col items-center gap-4 z-10 text-center p-6">
          <Package className="h-12 w-12 text-slate-600" />
          <p className="text-slate-400">Commande non trouvée</p>
          <Button onClick={() => navigate("/field-sales/sales")} variant="outline">
            Retour aux ventes
          </Button>
        </div>
      </div>
    );
  }

  const paymentStatus = getPaymentStatusConfig(order.payment_status);
  const syncStatus = getSyncStatusConfig(order.sync_status);
  const PaymentStatusIcon = paymentStatus.icon;
  const SyncStatusIcon = syncStatus.icon;
  const serviceInfo = getPrimaryServiceInfo(order.services);

  return (
    <div className="min-h-screen relative bg-slate-950">
      <StaffBackground />
      
      <IOSHeader
        title={`FS-${order.id.slice(0, 8)}`}
        subtitle={format(new Date(order.created_at), "d MMMM yyyy", { locale: fr })}
        showBack
        onBack={() => navigate("/field-sales/sales")}
        onRefresh={loadOrder}
      />

      <main className="relative z-10 pb-28">
        {/* Status Badges */}
        <div className="px-4 py-3 flex items-center gap-2 overflow-x-auto">
          <Badge className={cn("shrink-0 flex items-center gap-1", paymentStatus.className)}>
            <PaymentStatusIcon className="h-3 w-3" />
            {paymentStatus.label}
          </Badge>
          <Badge className={cn("shrink-0 flex items-center gap-1", syncStatus.className)}>
            <SyncStatusIcon className="h-3 w-3" />
            {syncStatus.label}
          </Badge>
          <Badge className="bg-slate-800 text-slate-300 border-slate-700 shrink-0">
            {getPaymentMethodLabel(order.payment_method)}
          </Badge>
        </div>

        {/* Tabs Navigation */}
        <div className="px-4 mb-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full bg-slate-900/80 border border-slate-800/60 p-1 rounded-2xl">
              <TabsTrigger 
                value="details" 
                className="flex-1 rounded-xl data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400 text-sm"
              >
                Détails
              </TabsTrigger>
              <TabsTrigger 
                value="client" 
                className="flex-1 rounded-xl data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400 text-sm"
              >
                Client
              </TabsTrigger>
              <TabsTrigger 
                value="documents" 
                className="flex-1 rounded-xl data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400 text-sm"
              >
                Documents
              </TabsTrigger>
            </TabsList>

            {/* Details Tab */}
            <TabsContent value="details" className="mt-4 space-y-4">
              {/* Total Amount Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <IOSWidgetCard className="p-5 bg-gradient-to-br from-orange-500/10 to-amber-500/5 border-orange-500/30">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-400">Montant total</p>
                      <p className="text-3xl font-bold text-orange-400">{order.total_amount.toFixed(2)} $</p>
                    </div>
                    <div className="p-3 rounded-xl bg-orange-500/20">
                      <DollarSign className="h-8 w-8 text-orange-400" />
                    </div>
                  </div>
                  {serviceInfo.monthlyPrice > 0 && (
                    <p className="text-sm text-slate-500 mt-2">
                      Mensualité: <span className="text-cyan-400">{serviceInfo.monthlyPrice.toFixed(2)} $/mois</span>
                    </p>
                  )}
                </IOSWidgetCard>
              </motion.div>

              {/* Services */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <IOSWidgetCard className="p-4">
                  <h3 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Services commandés ({order.services.length})
                  </h3>
                  
                  {order.services.length > 0 ? (
                    <div className="space-y-3">
                      {order.services.map((service, idx) => (
                        <div key={idx} className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/50">
                          <div className="p-2 rounded-lg bg-slate-700/50">
                            {getCategoryIcon(service.category)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-medium truncate">{service.name}</p>
                            <p className="text-xs text-slate-500 capitalize">{service.category}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-cyan-400 font-medium">{service.price_monthly.toFixed(2)} $/mois</p>
                            {service.price_setup > 0 && (
                              <p className="text-xs text-slate-500">+ {service.price_setup.toFixed(2)} $ install.</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-slate-800/50 text-center">
                      <p className="text-slate-400">Aucun service détaillé</p>
                    </div>
                  )}
                </IOSWidgetCard>
              </motion.div>

              {/* Payment Details */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
              >
                <IOSWidgetCard className="p-4">
                  <h3 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    Informations de paiement
                  </h3>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Méthode</span>
                      <span className="text-white">{getPaymentMethodLabel(order.payment_method)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Statut</span>
                      <Badge className={paymentStatus.className}>
                        <PaymentStatusIcon className="h-3 w-3 mr-1" />
                        {paymentStatus.label}
                      </Badge>
                    </div>
                    {order.payment_reference && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Référence</span>
                        <button 
                          onClick={() => copyToClipboard(order.payment_reference!, "Référence")}
                          className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300"
                        >
                          <span className="font-mono text-sm">{order.payment_reference}</span>
                          <Copy className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </IOSWidgetCard>
              </motion.div>

              {/* Appointment */}
              {order.appointment_date && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <IOSWidgetCard className="p-4 border-purple-500/30 bg-purple-500/5">
                    <h3 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Rendez-vous d'installation
                    </h3>
                    <p className="text-white font-medium">
                      {format(new Date(order.appointment_date), "EEEE d MMMM yyyy 'à' HH:mm", { locale: fr })}
                    </p>
                    {order.appointment_notes && (
                      <p className="text-sm text-slate-400 mt-2">{order.appointment_notes}</p>
                    )}
                  </IOSWidgetCard>
                </motion.div>
              )}

              {/* Notes */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
              >
                <IOSWidgetCard className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-slate-400 flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      Notes internes
                    </h3>
                    {!isEditingNotes && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsEditingNotes(true)}
                        className="text-slate-400 hover:text-white h-8 px-2"
                      >
                        <Edit3 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  
                  {isEditingNotes ? (
                    <div className="space-y-3">
                      <Textarea
                        value={editedNotes}
                        onChange={(e) => setEditedNotes(e.target.value)}
                        placeholder="Ajouter des notes..."
                        className="bg-slate-800/50 border-slate-700 text-white resize-none"
                        rows={4}
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={saveNotes}
                          disabled={isSavingNotes}
                          className="bg-orange-500 hover:bg-orange-400"
                        >
                          {isSavingNotes ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-1" />
                          ) : (
                            <Save className="h-4 w-4 mr-1" />
                          )}
                          Enregistrer
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setIsEditingNotes(false);
                            setEditedNotes(order.internal_notes || "");
                          }}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Annuler
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className={cn(
                      "text-sm",
                      order.internal_notes ? "text-slate-300" : "text-slate-600 italic"
                    )}>
                      {order.internal_notes || "Aucune note"}
                    </p>
                  )}
                </IOSWidgetCard>
              </motion.div>
            </TabsContent>

            {/* Client Tab */}
            <TabsContent value="client" className="mt-4 space-y-4">
              {/* Client Info */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <IOSWidgetCard className="p-4">
                  <h3 className="text-sm font-medium text-slate-400 mb-4 flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Informations client
                  </h3>
                  
                  <div className="space-y-4">
                    {/* Name */}
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-slate-800">
                        <User className="h-4 w-4 text-orange-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-slate-500">Nom complet</p>
                        <p className="text-white font-medium">{order.customer_name}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-white"
                        onClick={() => copyToClipboard(order.customer_name, "Nom")}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Email */}
                    {order.customer_email && (
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-slate-800">
                          <Mail className="h-4 w-4 text-cyan-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-slate-500">Courriel</p>
                          <p className="text-white truncate">{order.customer_email}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-white"
                          onClick={() => copyToClipboard(order.customer_email!, "Courriel")}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    )}

                    {/* Phone */}
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-slate-800">
                        <Phone className="h-4 w-4 text-emerald-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-slate-500">Téléphone</p>
                        <p className="text-white">{order.customer_phone}</p>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-white"
                          onClick={() => copyToClipboard(order.customer_phone, "Téléphone")}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-emerald-400 hover:text-emerald-300"
                          onClick={() => window.open(`tel:${order.customer_phone}`)}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Address */}
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-slate-800 mt-1">
                        <MapPin className="h-4 w-4 text-purple-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-slate-500">Adresse de service</p>
                        <p className="text-white">{order.customer_address}</p>
                        {(order.customer_city || order.customer_postal_code) && (
                          <p className="text-slate-400 text-sm">
                            {order.customer_city}{order.customer_city && order.customer_postal_code && ", "}{order.customer_postal_code}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-white"
                        onClick={() => copyToClipboard(
                          `${order.customer_address}${order.customer_city ? `, ${order.customer_city}` : ""}${order.customer_postal_code ? ` ${order.customer_postal_code}` : ""}`,
                          "Adresse"
                        )}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </IOSWidgetCard>
              </motion.div>

              {/* GPS Location */}
              {(order.gps_latitude && order.gps_longitude) && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <IOSWidgetCard className="p-4">
                    <h3 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Position GPS
                    </h3>
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <p className="text-white font-mono text-sm">
                          {order.gps_latitude.toFixed(6)}, {order.gps_longitude.toFixed(6)}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/20"
                        onClick={() => window.open(
                          `https://www.google.com/maps?q=${order.gps_latitude},${order.gps_longitude}`,
                          "_blank"
                        )}
                      >
                        <ExternalLink className="h-4 w-4 mr-1" />
                        Carte
                      </Button>
                    </div>
                  </IOSWidgetCard>
                </motion.div>
              )}

              {/* Signature Status */}
              {order.signature_captured_at && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                >
                  <IOSWidgetCard className="p-4 border-emerald-500/30 bg-emerald-500/5">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-emerald-500/20">
                        <PenLine className="h-5 w-5 text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-white font-medium">Signature capturée</p>
                        <p className="text-xs text-slate-400">
                          {format(new Date(order.signature_captured_at), "d MMM yyyy 'à' HH:mm", { locale: fr })}
                        </p>
                      </div>
                    </div>
                  </IOSWidgetCard>
                </motion.div>
              )}

              {/* Photo */}
              {order.location_photo_url && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <IOSWidgetCard className="p-4">
                    <h3 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
                      <Image className="h-4 w-4" />
                      Photo de la vente
                    </h3>
                    <Dialog open={showPhoto} onOpenChange={setShowPhoto}>
                      <DialogTrigger asChild>
                        <button className="w-full rounded-xl overflow-hidden">
                          <img 
                            src={order.location_photo_url} 
                            alt="Photo de vente" 
                            className="w-full h-40 object-cover hover:opacity-90 transition-opacity"
                          />
                        </button>
                      </DialogTrigger>
                      <DialogContent className="bg-slate-900 border-slate-700 max-w-lg">
                        <DialogHeader>
                          <DialogTitle className="text-white">Photo de la vente</DialogTitle>
                        </DialogHeader>
                        <img 
                          src={order.location_photo_url} 
                          alt="Photo de vente" 
                          className="w-full rounded-lg"
                        />
                      </DialogContent>
                    </Dialog>
                  </IOSWidgetCard>
                </motion.div>
              )}
            </TabsContent>

            {/* Documents Tab */}
            <TabsContent value="documents" className="mt-4 space-y-4">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <IOSWidgetCard className="p-4">
                  <h3 className="text-sm font-medium text-slate-400 mb-4 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Générer des documents
                  </h3>
                  
                  <div className="space-y-3">
                    {/* Contract PDF */}
                    <Button
                      onClick={generateContractPDF}
                      disabled={isGeneratingContract}
                      className="w-full justify-start bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 border border-orange-500/30"
                      variant="outline"
                    >
                      {isGeneratingContract ? (
                        <Loader2 className="h-5 w-5 mr-3 animate-spin" />
                      ) : (
                        <FileText className="h-5 w-5 mr-3" />
                      )}
                      <div className="text-left">
                        <p className="font-medium">Contrat de service</p>
                        <p className="text-xs text-orange-400/70">PDF avec conditions</p>
                      </div>
                    </Button>

                    {/* Invoice PDF */}
                    <Button
                      onClick={generateInvoicePDF}
                      disabled={isGeneratingInvoice}
                      className="w-full justify-start bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30"
                      variant="outline"
                    >
                      {isGeneratingInvoice ? (
                        <Loader2 className="h-5 w-5 mr-3 animate-spin" />
                      ) : (
                        <Receipt className="h-5 w-5 mr-3" />
                      )}
                      <div className="text-left">
                        <p className="font-medium">Facture</p>
                        <p className="text-xs text-emerald-400/70">PDF avec détail des frais</p>
                      </div>
                    </Button>
                  </div>
                </IOSWidgetCard>
              </motion.div>

              {/* Order Info */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <IOSWidgetCard className="p-4">
                  <h3 className="text-sm font-medium text-slate-400 mb-3">Informations de la commande</h3>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Numéro</span>
                      <span className="text-white font-mono">FS-{order.id.slice(0, 8)}</span>
                    </div>
                    {order.local_id && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">ID local</span>
                        <span className="text-slate-400 font-mono text-xs">{order.local_id.slice(0, 8)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-slate-500">Créée le</span>
                      <span className="text-slate-300">
                        {format(new Date(order.created_at), "d MMM yyyy 'à' HH:mm", { locale: fr })}
                      </span>
                    </div>
                    {order.synced_at && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Synchronisée</span>
                        <span className="text-cyan-400">
                          {format(new Date(order.synced_at), "d MMM yyyy 'à' HH:mm", { locale: fr })}
                        </span>
                      </div>
                    )}
                    {order.converted_order_id && (
                      <div className="flex justify-between items-center pt-2 border-t border-slate-800">
                        <span className="text-slate-500">Commande principale</span>
                        <Badge className="bg-cyan-500/20 text-cyan-400">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Convertie
                        </Badge>
                      </div>
                    )}
                  </div>
                </IOSWidgetCard>
              </motion.div>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <IOSBottomNav />
    </div>
  );
}
