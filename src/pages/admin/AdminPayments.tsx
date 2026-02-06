/**
 * Admin Payments - Vue consolidée de tous les paiements
 * Supporte: PayPal, Interac, Carte, Manuel, etc.
 */

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import AdminLayout from "@/components/admin/AdminLayout";
import { adminClient as supabase } from "@/integrations/backend/adminClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  CreditCard,
  Search,
  RefreshCw,
  Eye,
  DollarSign,
  Calendar,
  Loader2,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Wallet,
  Banknote,
  ArrowUpDown,
  FileText,
  User,
  ExternalLink,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { getPaymentStatusInfo, getPaymentMethodLabel } from "@/lib/paymentStatusUtils";

// Type for unified payment record
interface UnifiedPayment {
  id: string;
  source_table: "billing_payments" | "payments" | "orders" | "activity_logs";
  method: string;
  amount: number;
  status: string;
  reference: string | null;
  provider: string | null;
  provider_payment_id: string | null;
  source: string | null;
  created_at: string;
  invoice_number: string | null;
  order_number: string | null;
  order_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_id: string | null;
  notes: string | null;
  created_by_name: string | null;
  error_reason: string | null;
}

// Method display config
const PAYMENT_METHOD_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  paypal: { label: "PayPal", icon: <Wallet className="h-4 w-4" />, color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  interac: { label: "Interac", icon: <Banknote className="h-4 w-4" />, color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
  e_transfer: { label: "Interac", icon: <Banknote className="h-4 w-4" />, color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
  card: { label: "Carte", icon: <CreditCard className="h-4 w-4" />, color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300" },
  credit_card: { label: "Carte", icon: <CreditCard className="h-4 w-4" />, color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300" },
  manual: { label: "Manuel", icon: <DollarSign className="h-4 w-4" />, color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300" },
  cash: { label: "Espèces", icon: <Banknote className="h-4 w-4" />, color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
};

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  confirmed: { label: "Confirmé", icon: <CheckCircle2 className="h-4 w-4" />, color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
  completed: { label: "Complété", icon: <CheckCircle2 className="h-4 w-4" />, color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
  captured: { label: "Capturé", icon: <CheckCircle2 className="h-4 w-4" />, color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
  pending: { label: "En attente", icon: <Clock className="h-4 w-4" />, color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300" },
  pre_authorized: { label: "Autorisé", icon: <CheckCircle2 className="h-4 w-4" />, color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300" },
  failed: { label: "Échoué", icon: <XCircle className="h-4 w-4" />, color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
  refunded: { label: "Remboursé", icon: <RefreshCw className="h-4 w-4" />, color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300" },
  error_captured: { label: "Erreur", icon: <AlertTriangle className="h-4 w-4" />, color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300" },
};

// Get contextual status label based on payment method (uses shared utility)
const getMethodAwareStatusLabel = (status: string, method: string): string => {
  return getPaymentStatusInfo(status, method).label;
};
 
 const formatCurrency = (amount: number) =>
   new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(amount || 0);
 
 const formatDate = (dateStr: string | null) => {
   if (!dateStr) return "N/A";
   return format(new Date(dateStr), "d MMM yyyy HH:mm", { locale: fr });
 };
 
 const AdminPayments = () => {
   const [searchQuery, setSearchQuery] = useState("");
   const [methodFilter, setMethodFilter] = useState<string>("all");
   const [statusFilter, setStatusFilter] = useState<string>("all");
   const [sortField, setSortField] = useState<"created_at" | "amount">("created_at");
   const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
   const [selectedPayment, setSelectedPayment] = useState<UnifiedPayment | null>(null);
   const [detailsOpen, setDetailsOpen] = useState(false);
 
   // Fetch all payments from billing_payments
   const { data: billingPayments, isLoading: billingLoading, refetch: refetchBilling } = useQuery({
     queryKey: ["admin-billing-payments"],
     queryFn: async () => {
       const { data, error } = await supabase
         .from("billing_payments")
         .select(`
           id, method, amount, status, reference, provider, provider_payment_id, source, created_at, legacy_note,
           invoice:billing_invoices(invoice_number),
           customer:billing_customers(id, first_name, last_name, email)
         `)
         .order("created_at", { ascending: false })
         .limit(500);
 
       if (error) throw error;
       return data;
     },
   });
 
   // Fetch all payments from legacy payments table
   const { data: legacyPayments, isLoading: legacyLoading, refetch: refetchLegacy } = useQuery({
     queryKey: ["admin-legacy-payments"],
     queryFn: async () => {
       const { data, error } = await supabase
         .from("payments")
         .select(`
           id, amount, payment_method, status, reference_number, payment_reference, 
           provider_payment_id, source, created_at, notes, error_reason,
           created_by_name, order_id,
           order:orders(order_number),
           billing:billing(invoice_number, client_email)
         `)
         .order("created_at", { ascending: false })
         .limit(500);
 
       if (error) throw error;
       return data;
     },
   });
 
  // Fetch PayPal/card payments from orders table (captured payments not in other tables)
  const { data: orderPayments, isLoading: ordersLoading, refetch: refetchOrders } = useQuery({
    queryKey: ["admin-order-payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(`
          id, order_number, total_amount, payment_reference, payment_status, payment_method, 
          status, created_at, client_email, client_first_name, client_last_name, client_phone,
          billing:billing(invoice_number)
        `)
        .not("payment_reference", "is", null)
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) throw error;
      return data;
    },
  });

  // Fallback: captures PayPal enregistrées sans lien explicite à une commande/facture
  // (ex: le front n'a pas passé invoice_id/order_id au moment de la capture).
  const {
    data: paypalCaptureLogs,
    isLoading: capturesLoading,
    refetch: refetchCaptures,
  } = useQuery({
    queryKey: ["admin-paypal-capture-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_logs")
        .select("id, created_at, entity_id, details")
        .eq("entity_type", "paypal_capture")
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) throw error;
      return data;
    },
  });

   // Unify payment data
   const unifiedPayments = useMemo<UnifiedPayment[]>(() => {
     const payments: UnifiedPayment[] = [];
    const seenRefs = new Set<string>();
 
     // Process billing_payments
     billingPayments?.forEach((p: any) => {
      if (p.reference) seenRefs.add(p.reference);
      if (p.provider_payment_id) seenRefs.add(p.provider_payment_id);
       payments.push({
         id: p.id,
         source_table: "billing_payments",
         method: p.method || "unknown",
         amount: p.amount,
         status: p.status || "pending",
         reference: p.reference,
         provider: p.provider,
         provider_payment_id: p.provider_payment_id,
         source: p.source,
         created_at: p.created_at,
         invoice_number: p.invoice?.invoice_number || null,
         order_number: null,
         order_id: null,
         customer_name: p.customer ? `${p.customer.first_name} ${p.customer.last_name}` : null,
         customer_email: p.customer?.email || null,
         customer_id: p.customer?.id || null,
         notes: p.legacy_note,
         created_by_name: null,
         error_reason: null,
       });
     });
 
     // Process legacy payments
     legacyPayments?.forEach((p: any) => {
      const ref = p.reference_number || p.payment_reference;
      if (ref) seenRefs.add(ref);
      if (p.provider_payment_id) seenRefs.add(p.provider_payment_id);
       payments.push({
         id: p.id,
         source_table: "payments",
         method: p.payment_method || "unknown",
         amount: p.amount,
         status: p.status || "pending",
         reference: p.reference_number || p.payment_reference,
         provider: null,
         provider_payment_id: p.provider_payment_id,
         source: p.source,
         created_at: p.created_at,
         invoice_number: p.billing?.invoice_number || null,
         order_number: p.order?.order_number || null,
         order_id: p.order_id,
         customer_name: null,
         customer_email: p.billing?.client_email || null,
         customer_id: null,
         notes: p.notes,
         created_by_name: p.created_by_name,
         error_reason: p.error_reason,
       });
     });
 
    // Process order payments (PayPal, card captures not in other tables)
    orderPayments?.forEach((p: any) => {
      // Skip if already tracked in payments tables
      if (p.payment_reference && seenRefs.has(p.payment_reference)) return;
      
      // Determine method from payment_method or payment_reference pattern
      let method = p.payment_method || "unknown";
      if (!method || method === "unknown") {
        if (p.payment_reference?.startsWith("PAYID-")) method = "paypal";
        else if (p.payment_reference?.startsWith("NIVRA-PAY-")) method = "interac";
        else method = "paypal";
      }
      
      // Map payment_status to unified status
      let status = "pending";
      if (p.payment_status === "captured" || p.payment_status === "completed") status = "confirmed";
      else if (p.payment_status === "failed") status = "failed";
      else if (p.payment_status === "refunded") status = "refunded";
      else if (p.payment_status) status = p.payment_status;
      
      if (p.payment_reference) seenRefs.add(p.payment_reference);

      payments.push({
        id: p.id,
        source_table: "orders",
        method,
        amount: p.total_amount || 0,
        status,
        reference: p.payment_reference,
        provider: method === "paypal" ? "paypal" : null,
        provider_payment_id: p.payment_reference,
        source: "order_checkout",
        created_at: p.created_at,
        invoice_number: p.billing?.[0]?.invoice_number || null,
        order_number: p.order_number,
        order_id: p.id,
        customer_name: [p.client_first_name, p.client_last_name].filter(Boolean).join(" ") || null,
        customer_email: p.client_email,
        customer_id: null,
        notes: null,
        created_by_name: null,
        error_reason: null,
      });
    });

    // Process PayPal capture logs (unlinked captures)
    paypalCaptureLogs?.forEach((log: any) => {
      const details = (log?.details || {}) as any;
      const captureId = details?.capture_id ? String(details.capture_id) : null;
      const paypalOrderId = details?.paypal_order_id ? String(details.paypal_order_id) : null;
      const payerEmail = details?.payer_email ? String(details.payer_email) : null;
      const amount = Number(details?.amount ?? 0);

      // Dedup si déjà présent via orders/payments/billing_payments
      if (captureId && seenRefs.has(captureId)) return;
      if (paypalOrderId && seenRefs.has(paypalOrderId)) return;

      if (captureId) seenRefs.add(captureId);
      if (paypalOrderId) seenRefs.add(paypalOrderId);

      payments.push({
        id: log.id,
        source_table: "activity_logs",
        method: "paypal",
        amount,
        status: "confirmed",
        reference: paypalOrderId,
        provider: "paypal",
        provider_payment_id: captureId,
        source: "paypal_capture",
        created_at: log.created_at,
        invoice_number: null,
        order_number: null,
        order_id: (log.entity_id as string | null) || null,
        customer_name: null,
        customer_email: payerEmail,
        customer_id: null,
        notes: "Capture PayPal (non liée à une commande/facture)",
        created_by_name: null,
        error_reason: null,
      });
    });

    return payments;
  }, [billingPayments, legacyPayments, orderPayments, paypalCaptureLogs]);
 
   // Filter and sort
   const filteredPayments = useMemo(() => {
     let result = [...unifiedPayments];
 
     // Search filter
     if (searchQuery.trim()) {
       const q = searchQuery.toLowerCase();
       result = result.filter((p) =>
         p.customer_name?.toLowerCase().includes(q) ||
         p.customer_email?.toLowerCase().includes(q) ||
         p.invoice_number?.toLowerCase().includes(q) ||
         p.order_number?.toLowerCase().includes(q) ||
         p.reference?.toLowerCase().includes(q) ||
         p.provider_payment_id?.toLowerCase().includes(q)
       );
     }
 
     // Method filter
     if (methodFilter !== "all") {
       result = result.filter((p) => {
         const method = p.method.toLowerCase();
         if (methodFilter === "interac") return method === "interac" || method === "e_transfer";
         return method === methodFilter;
       });
     }
 
     // Status filter
     if (statusFilter !== "all") {
       result = result.filter((p) => p.status === statusFilter);
     }
 
     // Sort
     result.sort((a, b) => {
       if (sortField === "created_at") {
         const dateA = new Date(a.created_at).getTime();
         const dateB = new Date(b.created_at).getTime();
         return sortOrder === "desc" ? dateB - dateA : dateA - dateB;
       }
       if (sortField === "amount") {
         return sortOrder === "desc" ? b.amount - a.amount : a.amount - b.amount;
       }
       return 0;
     });
 
     return result;
   }, [unifiedPayments, searchQuery, methodFilter, statusFilter, sortField, sortOrder]);
 
   // Stats
   const stats = useMemo(() => {
     const confirmed = unifiedPayments.filter((p) =>
       ["confirmed", "completed", "captured"].includes(p.status)
     );
     const pending = unifiedPayments.filter((p) => p.status === "pending");
     const failed = unifiedPayments.filter((p) =>
       ["failed", "error_captured"].includes(p.status)
     );
 
     return {
       total: unifiedPayments.length,
       totalAmount: confirmed.reduce((sum, p) => sum + p.amount, 0),
       pending: pending.length,
       pendingAmount: pending.reduce((sum, p) => sum + p.amount, 0),
       failed: failed.length,
     };
   }, [unifiedPayments]);
 
  const isLoading = billingLoading || legacyLoading || ordersLoading || capturesLoading;
 
   const handleRefresh = () => {
     refetchBilling();
     refetchLegacy();
    refetchOrders();
    refetchCaptures();
   };
 
   const toggleSort = (field: "created_at" | "amount") => {
     if (sortField === field) {
       setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"));
     } else {
       setSortField(field);
       setSortOrder("desc");
     }
   };
 
   const getMethodConfig = (method: string) => {
     const key = method.toLowerCase();
     return PAYMENT_METHOD_CONFIG[key] || {
       label: method,
       icon: <DollarSign className="h-4 w-4" />,
       color: "bg-gray-100 text-gray-800",
     };
   };
 
  const getStatusConfig = (status: string, method?: string) => {
    const baseConfig = STATUS_CONFIG[status] || {
      label: status,
      icon: <Clock className="h-4 w-4" />,
      color: "bg-gray-100 text-gray-800",
    };
    
    // Override label with method-aware version
    const contextualLabel = method 
      ? getMethodAwareStatusLabel(status, method)
      : baseConfig.label;
    
    return {
      ...baseConfig,
      label: contextualLabel,
    };
  };
 
   const openDetails = (payment: UnifiedPayment) => {
     setSelectedPayment(payment);
     setDetailsOpen(true);
   };
 
   return (
     <AdminLayout>
       <div className="p-6 space-y-6">
         {/* Header */}
         <div className="flex items-center justify-between flex-wrap gap-4">
           <div>
             <h1 className="text-2xl font-bold">Paiements</h1>
             <p className="text-muted-foreground">
               Vue consolidée de tous les paiements (PayPal, Interac, Carte, Manuel)
             </p>
           </div>
           <Button variant="outline" onClick={handleRefresh} disabled={isLoading}>
             <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
             Rafraîchir
           </Button>
         </div>
 
         {/* Stats Cards */}
         <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
           <Card>
             <CardHeader className="pb-2">
               <CardTitle className="text-sm font-medium text-muted-foreground">
                 Total paiements
               </CardTitle>
             </CardHeader>
             <CardContent>
               <div className="text-2xl font-bold flex items-center gap-2">
                 <CreditCard className="h-5 w-5 text-primary" />
                 {isLoading ? "..." : stats.total}
               </div>
             </CardContent>
           </Card>
 
           <Card>
             <CardHeader className="pb-2">
               <CardTitle className="text-sm font-medium text-muted-foreground">
                 Montant confirmé
               </CardTitle>
             </CardHeader>
             <CardContent>
               <div className="text-2xl font-bold flex items-center gap-2 text-green-600">
                 <TrendingUp className="h-5 w-5" />
                 {isLoading ? "..." : formatCurrency(stats.totalAmount)}
               </div>
             </CardContent>
           </Card>
 
           <Card>
             <CardHeader className="pb-2">
               <CardTitle className="text-sm font-medium text-muted-foreground">
                 En attente
               </CardTitle>
             </CardHeader>
             <CardContent>
               <div className="text-2xl font-bold flex items-center gap-2 text-amber-600">
                 <Clock className="h-5 w-5" />
                 {isLoading ? "..." : stats.pending}
                 <span className="text-sm font-normal text-muted-foreground">
                   ({formatCurrency(stats.pendingAmount)})
                 </span>
               </div>
             </CardContent>
           </Card>
 
           <Card>
             <CardHeader className="pb-2">
               <CardTitle className="text-sm font-medium text-muted-foreground">
                 Échoués
               </CardTitle>
             </CardHeader>
             <CardContent>
               <div className="text-2xl font-bold flex items-center gap-2 text-red-600">
                 <XCircle className="h-5 w-5" />
                 {isLoading ? "..." : stats.failed}
               </div>
             </CardContent>
           </Card>
         </div>
 
         {/* Filters */}
         <Card>
           <CardContent className="pt-6">
             <div className="flex flex-wrap gap-4 items-center">
               <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                 <Search className="h-4 w-4 text-muted-foreground" />
                 <Input
                   placeholder="Rechercher client, facture, commande, référence..."
                   value={searchQuery}
                   onChange={(e) => setSearchQuery(e.target.value)}
                   className="max-w-md"
                 />
               </div>
 
               <Select value={methodFilter} onValueChange={setMethodFilter}>
                 <SelectTrigger className="w-[160px]">
                   <SelectValue placeholder="Méthode" />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="all">Toutes méthodes</SelectItem>
                   <SelectItem value="paypal">PayPal</SelectItem>
                   <SelectItem value="interac">Interac</SelectItem>
                   <SelectItem value="card">Carte</SelectItem>
                   <SelectItem value="manual">Manuel</SelectItem>
                   <SelectItem value="cash">Espèces</SelectItem>
                 </SelectContent>
               </Select>
 
               <Select value={statusFilter} onValueChange={setStatusFilter}>
                 <SelectTrigger className="w-[160px]">
                   <SelectValue placeholder="Statut" />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="all">Tous statuts</SelectItem>
                   <SelectItem value="confirmed">Confirmé</SelectItem>
                   <SelectItem value="completed">Complété</SelectItem>
                   <SelectItem value="captured">Capturé</SelectItem>
                   <SelectItem value="pending">En attente</SelectItem>
                   <SelectItem value="failed">Échoué</SelectItem>
                   <SelectItem value="refunded">Remboursé</SelectItem>
                 </SelectContent>
               </Select>
             </div>
           </CardContent>
         </Card>
 
         {/* Payments Table */}
         <Card>
           <CardHeader>
             <CardTitle>Historique des paiements</CardTitle>
             <CardDescription>
               {filteredPayments.length} paiement{filteredPayments.length > 1 ? "s" : ""} trouvé{filteredPayments.length > 1 ? "s" : ""}
             </CardDescription>
           </CardHeader>
           <CardContent>
             {isLoading ? (
               <div className="flex justify-center py-12">
                 <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
               </div>
             ) : (
               <div className="overflow-x-auto">
                 <Table>
                   <TableHeader>
                     <TableRow>
                       <TableHead
                         className="cursor-pointer hover:bg-muted/50"
                         onClick={() => toggleSort("created_at")}
                       >
                         <div className="flex items-center gap-1">
                           Date
                           <ArrowUpDown className="h-3 w-3" />
                         </div>
                       </TableHead>
                       <TableHead>Méthode</TableHead>
                       <TableHead>Client</TableHead>
                       <TableHead>Facture/Commande</TableHead>
                       <TableHead
                         className="cursor-pointer hover:bg-muted/50 text-right"
                         onClick={() => toggleSort("amount")}
                       >
                         <div className="flex items-center gap-1 justify-end">
                           Montant
                           <ArrowUpDown className="h-3 w-3" />
                         </div>
                       </TableHead>
                       <TableHead>Statut</TableHead>
                       <TableHead>Référence</TableHead>
                       <TableHead className="text-right">Actions</TableHead>
                     </TableRow>
                   </TableHeader>
                   <TableBody>
                     {filteredPayments.length === 0 ? (
                       <TableRow>
                         <TableCell colSpan={8} className="text-center text-muted-foreground py-12">
                           Aucun paiement trouvé
                         </TableCell>
                       </TableRow>
                     ) : (
                       filteredPayments.map((payment) => {
                         const methodConfig = getMethodConfig(payment.method);
                         const statusConfig = getStatusConfig(payment.status, payment.method);
 
                         return (
                           <TableRow key={`${payment.source_table}-${payment.id}`}>
                             <TableCell className="font-mono text-xs">
                               {formatDate(payment.created_at)}
                             </TableCell>
                             <TableCell>
                               <Badge className={`${methodConfig.color} gap-1`}>
                                 {methodConfig.icon}
                                 {methodConfig.label}
                               </Badge>
                             </TableCell>
                             <TableCell>
                               {payment.customer_name && (
                                 <div className="font-medium">{payment.customer_name}</div>
                               )}
                               {payment.customer_email && (
                                 <div className="text-xs text-muted-foreground">
                                   {payment.customer_email}
                                 </div>
                               )}
                               {!payment.customer_name && !payment.customer_email && (
                                 <span className="text-muted-foreground">—</span>
                               )}
                             </TableCell>
                             <TableCell>
                               {payment.invoice_number && (
                                 <div className="flex items-center gap-1 text-xs">
                                   <FileText className="h-3 w-3" />
                                   {payment.invoice_number}
                                 </div>
                               )}
                               {payment.order_number && (
                                 <div className="flex items-center gap-1 text-xs">
                                   <Calendar className="h-3 w-3" />
                                   {payment.order_number}
                                 </div>
                               )}
                               {!payment.invoice_number && !payment.order_number && (
                                 <span className="text-muted-foreground">—</span>
                               )}
                             </TableCell>
                             <TableCell className="text-right font-semibold">
                               {formatCurrency(payment.amount)}
                             </TableCell>
                            <TableCell>
                              <Badge className={`${getStatusConfig(payment.status, payment.method).color} gap-1`}>
                                {getStatusConfig(payment.status, payment.method).icon}
                                {getStatusConfig(payment.status, payment.method).label}
                              </Badge>
                            </TableCell>
                             <TableCell>
                               <div className="max-w-[150px] truncate text-xs font-mono">
                                 {payment.provider_payment_id || payment.reference || "—"}
                               </div>
                             </TableCell>
                             <TableCell className="text-right">
                               <Button
                                 variant="ghost"
                                 size="sm"
                                 onClick={() => openDetails(payment)}
                               >
                                 <Eye className="h-4 w-4" />
                               </Button>
                             </TableCell>
                           </TableRow>
                         );
                       })
                     )}
                   </TableBody>
                 </Table>
               </div>
             )}
           </CardContent>
         </Card>
 
         {/* Payment Details Dialog */}
         <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
           <DialogContent className="max-w-2xl">
             <DialogHeader>
               <DialogTitle className="flex items-center gap-2">
                 <CreditCard className="h-5 w-5" />
                 Détails du paiement
               </DialogTitle>
               <DialogDescription>
                 ID: {selectedPayment?.id}
               </DialogDescription>
             </DialogHeader>
 
             {selectedPayment && (
               <ScrollArea className="max-h-[60vh]">
                 <div className="space-y-6 p-1">
                   {/* Basic Info */}
                   <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-1">
                       <p className="text-xs text-muted-foreground uppercase">Montant</p>
                       <p className="text-2xl font-bold">{formatCurrency(selectedPayment.amount)}</p>
                     </div>
                     <div className="space-y-1">
                       <p className="text-xs text-muted-foreground uppercase">Statut</p>
                      <Badge className={`${getStatusConfig(selectedPayment.status, selectedPayment.method).color} gap-1`}>
                        {getStatusConfig(selectedPayment.status, selectedPayment.method).icon}
                        {getStatusConfig(selectedPayment.status, selectedPayment.method).label}
                      </Badge>
                     </div>
                   </div>
 
                   {/* Method & Provider */}
                   <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-1">
                       <p className="text-xs text-muted-foreground uppercase">Méthode</p>
                       <Badge className={`${getMethodConfig(selectedPayment.method).color} gap-1`}>
                         {getMethodConfig(selectedPayment.method).icon}
                         {getMethodConfig(selectedPayment.method).label}
                       </Badge>
                     </div>
                     <div className="space-y-1">
                       <p className="text-xs text-muted-foreground uppercase">Fournisseur</p>
                       <p className="font-medium">{selectedPayment.provider || selectedPayment.method}</p>
                     </div>
                   </div>
 
                   {/* Date */}
                   <div className="space-y-1">
                     <p className="text-xs text-muted-foreground uppercase">Date de création</p>
                     <p className="font-medium">{formatDate(selectedPayment.created_at)}</p>
                   </div>
 
                   {/* Client Info */}
                   {(selectedPayment.customer_name || selectedPayment.customer_email) && (
                     <Card>
                       <CardHeader className="pb-2">
                         <CardTitle className="text-sm flex items-center gap-2">
                           <User className="h-4 w-4" />
                           Client
                         </CardTitle>
                       </CardHeader>
                       <CardContent className="space-y-2">
                         {selectedPayment.customer_name && (
                           <p className="font-medium">{selectedPayment.customer_name}</p>
                         )}
                         {selectedPayment.customer_email && (
                           <p className="text-sm text-muted-foreground">{selectedPayment.customer_email}</p>
                         )}
                       </CardContent>
                     </Card>
                   )}
 
                   {/* Invoice/Order Info */}
                   {(selectedPayment.invoice_number || selectedPayment.order_number) && (
                     <Card>
                       <CardHeader className="pb-2">
                         <CardTitle className="text-sm flex items-center gap-2">
                           <FileText className="h-4 w-4" />
                           Document associé
                         </CardTitle>
                       </CardHeader>
                       <CardContent className="space-y-2">
                         {selectedPayment.invoice_number && (
                           <div className="flex items-center gap-2">
                             <Badge variant="outline">Facture</Badge>
                             <span className="font-mono">{selectedPayment.invoice_number}</span>
                           </div>
                         )}
                         {selectedPayment.order_number && (
                           <div className="flex items-center gap-2">
                             <Badge variant="outline">Commande</Badge>
                             <span className="font-mono">{selectedPayment.order_number}</span>
                             {selectedPayment.order_id && (
                               <Button
                                 variant="ghost"
                                 size="sm"
                                 asChild
                               >
                                 <a href={`/admin/orders?id=${selectedPayment.order_id}`} target="_blank">
                                   <ExternalLink className="h-3 w-3" />
                                 </a>
                               </Button>
                             )}
                           </div>
                         )}
                       </CardContent>
                     </Card>
                   )}
 
                   {/* References */}
                   <Card>
                     <CardHeader className="pb-2">
                       <CardTitle className="text-sm">Références</CardTitle>
                     </CardHeader>
                     <CardContent className="space-y-3">
                       {selectedPayment.reference && (
                         <div>
                           <p className="text-xs text-muted-foreground">Référence</p>
                           <p className="font-mono text-sm break-all">{selectedPayment.reference}</p>
                         </div>
                       )}
                       {selectedPayment.provider_payment_id && (
                         <div>
                           <p className="text-xs text-muted-foreground">ID Transaction Fournisseur</p>
                           <p className="font-mono text-sm break-all">{selectedPayment.provider_payment_id}</p>
                         </div>
                       )}
                       {selectedPayment.source && (
                         <div>
                           <p className="text-xs text-muted-foreground">Source</p>
                           <Badge variant="outline">{selectedPayment.source}</Badge>
                         </div>
                       )}
                       {selectedPayment.created_by_name && (
                         <div>
                           <p className="text-xs text-muted-foreground">Créé par</p>
                           <p className="text-sm">{selectedPayment.created_by_name}</p>
                         </div>
                       )}
                     </CardContent>
                   </Card>
 
                   {/* Notes & Errors */}
                   {(selectedPayment.notes || selectedPayment.error_reason) && (
                     <Card>
                       <CardHeader className="pb-2">
                         <CardTitle className="text-sm">Notes & Erreurs</CardTitle>
                       </CardHeader>
                       <CardContent className="space-y-2">
                         {selectedPayment.notes && (
                           <div>
                             <p className="text-xs text-muted-foreground">Notes</p>
                             <p className="text-sm">{selectedPayment.notes}</p>
                           </div>
                         )}
                         {selectedPayment.error_reason && (
                           <div className="bg-red-50 dark:bg-red-950/20 p-3 rounded-md">
                             <p className="text-xs text-red-600 dark:text-red-400 font-medium">Raison d'erreur</p>
                             <p className="text-sm text-red-800 dark:text-red-300">{selectedPayment.error_reason}</p>
                           </div>
                         )}
                       </CardContent>
                     </Card>
                   )}
 
                   {/* Source Table */}
                   <div className="text-xs text-muted-foreground text-right">
                     Source: {selectedPayment.source_table}
                   </div>
                 </div>
               </ScrollArea>
             )}
           </DialogContent>
         </Dialog>
       </div>
     </AdminLayout>
   );
 };
 
 export default AdminPayments;