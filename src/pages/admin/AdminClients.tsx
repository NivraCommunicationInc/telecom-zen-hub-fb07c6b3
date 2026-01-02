import { useState, useRef, useEffect } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { 
  Users, Plus, Search, Eye, Upload, FileText, Trash2, 
  ShoppingBag, CreditCard, Ticket, Calendar, Bell, Package,
  DollarSign, Clock, AlertCircle, Wallet, Ban, Pause, Play, MinusCircle, PlusCircle,
  Router, Monitor, Smartphone, Shield, CheckCircle, XCircle, AlertTriangle,
  Phone, MapPin, User, IdCard, Wrench, Hash, Download, Edit, History,
  ExternalLink, Tv, Wifi, Save, RefreshCw, Printer, FilePlus, Receipt, Building2, Star, Mail
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, differenceInDays, addDays, addYears } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { useActivityLog } from "@/hooks/useActivityLog";
import { useRoleAccess } from "@/hooks/useRoleAccess";
import { ScrollArea } from "@/components/ui/scroll-area";
import { downloadInvoicePDF, viewInvoicePDF } from "@/lib/invoicePdfGenerator";
import { downloadContractPDF, viewContractPDF } from "@/lib/contractPdfGenerator";
import { AdminPinManagementCard } from "@/components/admin/AdminPinManagementCard";
import SecurityAlertBanner from "@/components/admin/SecurityAlertBanner";
import AdminSecurityControls from "@/components/admin/AdminSecurityControls";
import BackToTopButton from "@/components/ui/back-to-top-button";
import { useAuth } from "@/hooks/useAuth";
import ClientLogsTab from "@/components/admin/ClientLogsTab";
import { useClientActivityLog } from "@/hooks/useClientActivityLog";
import ClientBalanceBreakdown from "@/components/admin/ClientBalanceBreakdown";
import ClientInternalNotes from "@/components/admin/ClientInternalNotes";

// Public website plans mapping (must match exactly)
const publicPlans = {
  internet: [
    { id: "internet-100", name: "Internet 100 Mbps", price: 55, category: "Internet" },
    { id: "internet-500", name: "Internet 500 Mbps", price: 60, category: "Internet" },
    { id: "internet-940", name: "Internet 940 Mbps", price: 70, category: "Internet" },
  ],
  mobile: [
    { id: "mobile-50", name: "Mobile 50$/30 jours", price: 50, category: "Mobile", data: "50-55 GB 4G" },
    { id: "mobile-60", name: "Mobile 60$/30 jours", price: 60, category: "Mobile", data: "75-80 GB 4G" },
  ],
  tv: [
    { id: "tv-basic", name: "Internet 100 + TV Basic", price: 75, category: "TV+Internet", channels: 26 },
    { id: "tv-5choices", name: "Internet 500 + TV 5 choix", price: 80, category: "TV+Internet", channels: 32 },
    { id: "tv-10choices", name: "Internet 500 + TV 10 choix", price: 90, category: "TV+Internet", channels: 37 },
    { id: "tv-15choices", name: "Internet 500 + TV 15 choix", price: 95, category: "TV+Internet", channels: 42 },
    { id: "tv-25choices", name: "Internet 500 + TV 25 choix", price: 110, category: "TV+Internet", channels: 52 },
    { id: "giga-tv-basic", name: "GIGA + TV Basic", price: 85, category: "GIGA+TV", channels: 26 },
    { id: "giga-tv-5choices", name: "GIGA + TV 5 choix", price: 95, category: "GIGA+TV", channels: 32 },
    { id: "giga-tv-10choices", name: "GIGA + TV 10 choix", price: 105, category: "GIGA+TV", channels: 37 },
    { id: "giga-tv-15choices", name: "GIGA + TV 15 choix", price: 110, category: "GIGA+TV", channels: 42 },
    { id: "giga-tv-25choices", name: "GIGA + TV 25 choix", price: 120, category: "GIGA+TV", channels: 52 },
  ],
};

const allPlans = [...publicPlans.internet, ...publicPlans.mobile, ...publicPlans.tv];

const AdminClients = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { logActivity } = useActivityLog();
  const { isAdmin, permissions } = useRoleAccess();
  const { user } = useAuth();
  const { logClientActivity } = useClientActivityLog();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFilter, setSearchFilter] = useState<"all" | "name" | "email" | "phone" | "tag">("all");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [documentViewerOpen, setDocumentViewerOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<any>(null);
  const [orderDetailsOpen, setOrderDetailsOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [invoiceDetailsOpen, setInvoiceDetailsOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [deleteDocumentReason, setDeleteDocumentReason] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<any>(null);
  const [paymentDetailsOpen, setPaymentDetailsOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [equipmentEditOpen, setEquipmentEditOpen] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<any>(null);
  const [newClient, setNewClient] = useState({
    email: "",
    password: "",
    first_name: "",
    last_name: "",
    phone: "",
    date_of_birth: "",
    service_address: "",
    service_city: "",
    service_postal_code: "",
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // PIN Status state
  const [clientPinStatus, setClientPinStatus] = useState<{ hasPin: boolean; isDefault: boolean; lastUpdated?: string }>({
    hasPin: false,
    isDefault: false,
  });

  // Fetch all clients - show ALL profiles regardless of role
  const { data: clients, isLoading, refetch: refetchClients } = useQuery({
    queryKey: ["admin-clients"],
    queryFn: async () => {
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("user_id, role");

      const rolesMap = new Map(rolesData?.map(r => [r.user_id, r.role]) || []);
      
      return profilesData?.map(profile => ({
        ...profile,
        role: rolesMap.get(profile.user_id) || 'client',
        user_roles: [{ role: rolesMap.get(profile.user_id) || 'client' }]
      })) || [];
    },
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  // Real-time subscription for instant client visibility
  useEffect(() => {
    const channel = supabase
      .channel('admin-clients-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => refetchClients())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_roles' }, () => refetchClients())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [refetchClients]);

  // Fetch client-specific data when a client is selected
  const { data: clientOrders, refetch: refetchOrders } = useQuery({
    queryKey: ["client-orders", selectedClient?.user_id],
    queryFn: async () => {
      if (!selectedClient?.user_id) return [];
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .or(`user_id.eq.${selectedClient.user_id},client_email.eq.${selectedClient.email}`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedClient?.user_id,
  });

  // Fetch client payments
  const { data: clientPayments, refetch: refetchPayments } = useQuery({
    queryKey: ["client-payments", selectedClient?.user_id],
    queryFn: async () => {
      if (!selectedClient?.user_id) return [];
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .eq("user_id", selectedClient.user_id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedClient?.user_id,
  });

  const { data: clientBilling, refetch: refetchBilling } = useQuery({
    queryKey: ["client-billing", selectedClient?.user_id],
    queryFn: async () => {
      if (!selectedClient?.user_id) return [];
      const { data, error } = await supabase
        .from("billing")
        .select("*")
        .or(`user_id.eq.${selectedClient.user_id},client_email.eq.${selectedClient.email}`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedClient?.user_id,
  });

  const { data: clientTickets } = useQuery({
    queryKey: ["client-tickets", selectedClient?.user_id],
    queryFn: async () => {
      if (!selectedClient?.user_id) return [];
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .or(`user_id.eq.${selectedClient.user_id},client_email.eq.${selectedClient.email}`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedClient?.user_id,
  });

  const { data: clientSubscriptions, refetch: refetchSubscriptions } = useQuery({
    queryKey: ["client-subscriptions", selectedClient?.user_id],
    queryFn: async () => {
      if (!selectedClient?.user_id) return [];
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", selectedClient.user_id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedClient?.user_id,
  });

  const { data: clientAppointments } = useQuery({
    queryKey: ["client-appointments", selectedClient?.user_id],
    queryFn: async () => {
      if (!selectedClient?.user_id) return [];
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .or(`client_id.eq.${selectedClient.user_id},client_email.eq.${selectedClient.email}`)
        .order("scheduled_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedClient?.user_id,
  });

  const { data: clientDocuments, refetch: refetchDocuments } = useQuery({
    queryKey: ["client-documents", selectedClient?.user_id],
    queryFn: async () => {
      if (!selectedClient?.user_id) return [];
      const { data, error } = await supabase
        .from("client_documents")
        .select("*")
        .eq("user_id", selectedClient.user_id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedClient?.user_id,
  });

  const { data: clientContracts } = useQuery({
    queryKey: ["client-contracts", selectedClient?.user_id],
    queryFn: async () => {
      if (!selectedClient?.user_id) return [];
      const { data, error } = await supabase
        .from("contracts")
        .select("*")
        .eq("user_id", selectedClient.user_id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedClient?.user_id,
  });

  // Fetch activity logs for this client
  const { data: clientActivityLogs, refetch: refetchActivityLogs } = useQuery({
    queryKey: ["client-activity-logs", selectedClient?.user_id],
    queryFn: async () => {
      if (!selectedClient?.user_id) return [];
      const { data, error } = await supabase
        .from("activity_logs")
        .select("*")
        .or(`entity_id.eq.${selectedClient.id},user_id.eq.${selectedClient.user_id}`)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedClient?.user_id,
  });

  // Fetch client accounts (with credit class - internal only)
  const { data: clientAccounts } = useQuery({
    queryKey: ["client-accounts", selectedClient?.user_id],
    queryFn: async () => {
      if (!selectedClient?.user_id) return [];
      const { data, error } = await supabase
        .from("accounts")
        .select("*")
        .eq("client_id", selectedClient.user_id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedClient?.user_id,
  });

  const creditClassLabels: Record<string, { label: string; color: string }> = {
    A: { label: "Excellent", color: "bg-green-500" },
    B: { label: "Bon", color: "bg-blue-500" },
    C: { label: "Moyen", color: "bg-yellow-500" },
    D: { label: "Mauvais", color: "bg-red-500" },
  };

  // Filter clients with enhanced search
  const filteredClients = clients?.filter((client: any) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    
    switch (searchFilter) {
      case "name":
        return client.full_name?.toLowerCase().includes(query) ||
               client.first_name?.toLowerCase().includes(query) ||
               client.last_name?.toLowerCase().includes(query);
      case "email":
        return client.email?.toLowerCase().includes(query);
      case "phone":
        return client.phone?.includes(query);
      case "tag":
        return client.sector_tags?.some((tag: string) => tag.toLowerCase().includes(query));
      default:
        return (
          client.full_name?.toLowerCase().includes(query) ||
          client.first_name?.toLowerCase().includes(query) ||
          client.last_name?.toLowerCase().includes(query) ||
          client.email?.toLowerCase().includes(query) ||
          client.phone?.includes(query) ||
          client.client_number?.toLowerCase().includes(query) ||
          client.sector_tags?.some((tag: string) => tag.toLowerCase().includes(query))
        );
    }
  });

  const createClientMutation = useMutation({
    mutationFn: async (client: typeof newClient) => {
      const fullName = `${client.first_name} ${client.last_name}`.trim();
      
      // Use server-side edge function for secure user creation
      const { data, error } = await supabase.functions.invoke('admin-create-user', {
        body: {
          email: client.email,
          password: client.password,
          full_name: fullName,
          first_name: client.first_name,
          last_name: client.last_name,
          phone: client.phone,
          date_of_birth: client.date_of_birth || null,
          service_address: client.service_address || null,
          service_city: client.service_city || null,
          service_postal_code: client.service_postal_code || null,
          service_province: "QC",
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      return data;
    },
    onSuccess: async () => {
      const fullName = `${newClient.first_name} ${newClient.last_name}`.trim();
      await queryClient.invalidateQueries({ queryKey: ["admin-clients"] });
      await queryClient.refetchQueries({ queryKey: ["admin-clients"] });
      logActivity("create", "client", undefined, { email: newClient.email, full_name: fullName }, {
        changedField: "profile",
        reason: "Nouveau client créé par admin"
      });
      toast({ title: "Client créé avec succès", description: `${fullName} a été ajouté au système` });
      setCreateDialogOpen(false);
      setNewClient({ email: "", password: "", first_name: "", last_name: "", phone: "", date_of_birth: "", service_address: "", service_city: "", service_postal_code: "" });
    },
    onError: (error: any) => {
      toast({ title: "Erreur lors de la création", description: error.message, variant: "destructive" });
    },
  });

  const updateClientMutation = useMutation({
    mutationFn: async (client: any) => {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: client.full_name,
          first_name: client.first_name,
          last_name: client.last_name,
          phone: client.phone,
          internal_notes: client.internal_notes,
          sector_tags: client.sector_tags,
          employer_discount: client.employer_discount,
          balance: client.balance,
          store_credit: client.store_credit,
          account_status: client.account_status,
          id_type: client.id_type,
          id_number: client.id_number,
          id_province: client.id_province,
          id_expiration: client.id_expiration,
          date_of_birth: client.date_of_birth,
          service_address: client.service_address,
          service_city: client.service_city,
          service_postal_code: client.service_postal_code,
          service_province: client.service_province,
        })
        .eq("id", client.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-clients"] });
      refetchActivityLogs();
      
      // Log to client activity journal
      if (selectedClient?.user_id) {
        logClientActivity({
          clientId: selectedClient.user_id,
          actionType: "profile_update",
          entityType: "profile",
          summary: `Mise à jour du profil client: ${selectedClient?.full_name}`,
        });
      }
      
      logActivity("update", "client", selectedClient?.id, { full_name: selectedClient?.full_name }, {
        changedField: "profile",
        reason: "Mise à jour du profil client"
      });
      toast({ title: "Client mis à jour" });
    },
    onError: () => {
      toast({ title: "Erreur lors de la mise à jour", variant: "destructive" });
    },
  });

  const adjustBalanceMutation = useMutation({
    mutationFn: async ({ clientId, field, amount, operation }: { clientId: string; field: 'balance' | 'store_credit'; amount: number; operation: 'add' | 'remove' }) => {
      const { data: current, error: fetchError } = await supabase
        .from("profiles")
        .select(field)
        .eq("id", clientId)
        .maybeSingle();
      if (fetchError) throw fetchError;
      if (!current) throw new Error("Profile not found");
      
      const currentValue = Number(current?.[field] || 0);
      const newValue = operation === 'add' ? currentValue + amount : Math.max(0, currentValue - amount);
      
      const { error } = await supabase.from("profiles").update({ [field]: newValue }).eq("id", clientId);
      if (error) throw error;
      
      return newValue;
    },
    onSuccess: (newValue, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-clients"] });
      setSelectedClient((prev: any) => prev ? { ...prev, [variables.field]: newValue } : prev);
      refetchActivityLogs();
      
      // Log to client activity journal
      if (selectedClient?.user_id) {
        const actionType = variables.field === 'balance' 
          ? (variables.operation === 'add' ? 'balance_add' : 'balance_remove')
          : (variables.operation === 'add' ? 'credit_add' : 'credit_remove');
        const fieldLabel = variables.field === 'balance' ? 'solde' : 'crédit';
        
        logClientActivity({
          clientId: selectedClient.user_id,
          actionType: actionType as any,
          entityType: "billing",
          summary: `${variables.operation === 'add' ? 'Ajout' : 'Retrait'} de ${variables.amount}$ au ${fieldLabel}. Nouveau ${fieldLabel}: ${newValue}$`,
          beforeData: { [variables.field]: selectedClient?.[variables.field] || 0 },
          afterData: { [variables.field]: newValue },
        });
      }
      
      logActivity("update", "client", selectedClient?.id, { field: variables.field, operation: variables.operation, amount: variables.amount }, {
        changedField: variables.field,
        oldValue: String(selectedClient?.[variables.field] || 0),
        newValue: String(newValue),
        reason: variables.operation === 'add' ? "Ajout de montant" : "Retrait de montant"
      });
      toast({ title: variables.operation === 'add' ? "Montant ajouté" : "Montant retiré" });
    },
    onError: () => {
      toast({ title: "Erreur lors de la modification", variant: "destructive" });
    },
  });

  const uploadDocumentMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!selectedClient?.user_id) throw new Error("No client selected");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const documentUrl = `document://${file.name}`;
      const { error } = await supabase.from("client_documents").insert({
        user_id: selectedClient.user_id,
        uploaded_by: user.id,
        document_name: file.name,
        document_type: file.type.includes("pdf") ? "contract" : file.type.includes("image") ? "id" : "general",
        document_url: documentUrl,
      });
      if (error) throw error;
    },
    onSuccess: (_, file) => {
      refetchDocuments();
      refetchActivityLogs();
      
      // Log to client activity journal
      if (selectedClient?.user_id) {
        logClientActivity({
          clientId: selectedClient.user_id,
          actionType: "document_upload",
          entityType: "document",
          summary: `Document téléversé: ${file.name}`,
        });
      }
      
      logActivity("upload", "document", selectedClient?.id, { document_name: "document" }, {
        changedField: "documents",
        reason: "Document téléversé"
      });
      toast({ title: "Document ajouté" });
    },
    onError: () => {
      toast({ title: "Erreur lors de l'upload", variant: "destructive" });
    },
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: async ({ docId, reason }: { docId: string; reason: string }) => {
      const { error } = await supabase.from("client_documents").delete().eq("id", docId);
      if (error) throw error;
      return reason;
    },
    onSuccess: (reason) => {
      refetchDocuments();
      refetchActivityLogs();
      
      // Log to client activity journal
      if (selectedClient?.user_id) {
        logClientActivity({
          clientId: selectedClient.user_id,
          actionType: "document_delete",
          entityType: "document",
          entityId: documentToDelete?.id,
          summary: `Document supprimé: ${documentToDelete?.document_name}. Raison: ${reason || "Non spécifiée"}`,
        });
      }
      
      logActivity("delete", "document", documentToDelete?.id, { document_name: documentToDelete?.document_name }, {
        changedField: "documents",
        reason: reason || "Document supprimé par admin"
      });
      toast({ title: "Document supprimé" });
      setDeleteConfirmOpen(false);
      setDocumentToDelete(null);
      setDeleteDocumentReason("");
    },
  });

  const updateOrderMutation = useMutation({
    mutationFn: async (order: any) => {
      const { error } = await supabase
        .from("orders")
        .update({
          status: order.status,
          payment_reference: order.payment_reference,
          tracking_number: order.tracking_number,
          tracking_url: order.tracking_url,
          serial_number: order.serial_number,
          equipment_id: order.equipment_id,
          imei_number: order.imei_number,
          sim_number: order.sim_number,
          internal_notes: order.internal_notes,
          payment_status: order.payment_status,
        })
        .eq("id", order.id);
      if (error) throw error;
    },
    onSuccess: () => {
      refetchOrders();
      refetchActivityLogs();
      
      // Log to client activity journal
      if (selectedClient?.user_id) {
        logClientActivity({
          clientId: selectedClient.user_id,
          actionType: "order_status_change",
          entityType: "order",
          entityId: selectedOrder?.id,
          summary: `Commande ${selectedOrder?.order_number} mise à jour. Statut: ${selectedOrder?.status}`,
        });
      }
      
      logActivity("update", "order", selectedOrder?.id, { order_number: selectedOrder?.order_number }, {
        changedField: "order",
        reason: "Commande mise à jour"
      });
      toast({ title: "Commande mise à jour" });
    },
    onError: () => {
      toast({ title: "Erreur lors de la mise à jour", variant: "destructive" });
    },
  });

  const updateSubscriptionMutation = useMutation({
    mutationFn: async ({ id, status, reason }: { id: string; status: string; reason: string }) => {
      const { error } = await supabase.from("subscriptions").update({ status }).eq("id", id);
      if (error) throw error;
      return { id, status, reason };
    },
    onSuccess: ({ id, status, reason }) => {
      refetchSubscriptions();
      refetchActivityLogs();
      
      // Log to client activity journal
      if (selectedClient?.user_id) {
        logClientActivity({
          clientId: selectedClient.user_id,
          actionType: "subscription_change",
          entityType: "subscription",
          entityId: id,
          summary: `Abonnement ${status === 'active' ? 'activé' : status === 'paused' ? 'suspendu' : 'modifié'}. ${reason}`,
          afterData: { status },
        });
      }
      
      logActivity("update", "subscription", id, { status }, {
        changedField: "status",
        newValue: status,
        reason: reason
      });
      toast({ title: `Service ${status === 'active' ? 'activé' : status === 'paused' ? 'suspendu' : 'modifié'}` });
    },
    onError: () => {
      toast({ title: "Erreur lors de la mise à jour", variant: "destructive" });
    },
  });

  // Approve payment and update client balance
  const approvePaymentMutation = useMutation({
    mutationFn: async ({ paymentId, amount }: { paymentId: string; amount: number }) => {
      // Update payment status
      const { error: paymentError } = await supabase
        .from("payments")
        .update({ status: "completed" })
        .eq("id", paymentId);
      if (paymentError) throw paymentError;

      // Update client balance (reduce it by payment amount)
      if (selectedClient?.id) {
        const currentBalance = Number(selectedClient.balance || 0);
        const newBalance = Math.max(0, currentBalance - amount);
        const { error: balanceError } = await supabase
          .from("profiles")
          .update({ balance: newBalance })
          .eq("id", selectedClient.id);
        if (balanceError) throw balanceError;
        return { newBalance, amount };
      }
      return { newBalance: 0, amount };
    },
    onSuccess: ({ newBalance, amount }) => {
      refetchPayments();
      refetchActivityLogs();
      queryClient.invalidateQueries({ queryKey: ["admin-clients"] });
      setSelectedClient((prev: any) => prev ? { ...prev, balance: newBalance } : prev);
      logActivity("approve_payment", "payment", selectedPayment?.id, { 
        amount, 
        payment_reference: selectedPayment?.reference_number 
      }, {
        changedField: "balance",
        oldValue: String(selectedClient?.balance || 0),
        newValue: String(newBalance),
        reason: `Paiement approuvé: ${amount.toFixed(2)} $`
      });
      toast({ title: "Paiement approuvé", description: `Le solde client a été réduit de ${amount.toFixed(2)} $` });
      setPaymentDetailsOpen(false);
    },
    onError: () => {
      toast({ title: "Erreur lors de l'approbation", variant: "destructive" });
    },
  });

  // Generate invoice from order
  const handleGenerateInvoice = (order: any) => {
    if (!selectedClient) return;
    
    const invoiceData = {
      invoiceNumber: `INV-${Date.now().toString().slice(-8)}`,
      orderNumber: order.order_number,
      paymentReference: order.payment_reference,
      clientNumber: selectedClient.client_number,
      clientName: selectedClient.full_name || selectedClient.email,
      clientEmail: selectedClient.email,
      clientPhone: selectedClient.phone,
      subtotal: order.subtotal || 0,
      deliveryFee: order.delivery_fee || 0,
      activationFee: order.activation_fee || 0,
      installationFee: order.installation_fee || 0,
      terminalFee: order.terminal_fee || 0,
      routerFee: order.router_fee || 0,
      discountAmount: order.discount_amount || 0,
      tpsAmount: order.tps_amount || 0,
      tvqAmount: order.tvq_amount || 0,
      lateFeeAmount: order.late_fee_amount || 0,
      credits: order.credits_applied || 0,
      createdAt: order.created_at,
      status: order.payment_status || "pending",
      serviceDescription: order.service_type,
      equipmentId: order.equipment_id,
    };
    
    viewInvoicePDF(invoiceData);
    logActivity("generate_invoice", "order", order.id, { order_number: order.order_number }, {
      changedField: "invoice",
      reason: "Facture PDF générée"
    });
  };

  // Generate contract from order
  const handleGenerateContract = (order: any) => {
    if (!selectedClient) return;
    
    const contractData = {
      contractNumber: `CTR-${Date.now().toString().slice(-8)}`,
      contractName: `Contrat ${order.service_type}`,
      clientName: selectedClient.full_name || selectedClient.email,
      clientEmail: selectedClient.email,
      clientPhone: selectedClient.phone,
      clientAddress: `${selectedClient.service_address || ""}, ${selectedClient.service_city || ""}, ${selectedClient.service_province || "QC"} ${selectedClient.service_postal_code || ""}`.trim(),
      serviceDescription: order.service_type,
      monthlyAmount: order.subtotal || 0,
      totalAmount: order.total_amount || 0,
      startDate: order.created_at,
      durationMonths: 12,
      employeeName: "Nivra Télécom",
      employeeTitle: "Service Client",
      isSigned: false,
    };
    
    viewContractPDF(contractData);
    logActivity("generate_contract", "order", order.id, { order_number: order.order_number }, {
      changedField: "contract",
      reason: "Contrat PDF généré"
    });
  };

  const handleViewDetails = (client: any) => {
    setSelectedClient({ ...client, sector_tags: client.sector_tags || [] });
    setDetailsDialogOpen(true);
  };

  const handleAddTag = (tag: string) => {
    if (!tag.trim()) return;
    const currentTags = selectedClient.sector_tags || [];
    if (!currentTags.includes(tag)) {
      setSelectedClient({ ...selectedClient, sector_tags: [...currentTags, tag] });
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setSelectedClient({
      ...selectedClient,
      sector_tags: selectedClient.sector_tags.filter((t: string) => t !== tagToRemove),
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadDocumentMutation.mutate(file);
  };

  const handleViewDocument = (doc: any) => {
    setSelectedDocument(doc);
    setDocumentViewerOpen(true);
  };

  const handleViewOrder = (order: any) => {
    setSelectedOrder({ ...order });
    setOrderDetailsOpen(true);
  };

  const handleViewInvoice = (invoice: any) => {
    setSelectedInvoice(invoice);
    setInvoiceDetailsOpen(true);
  };

  const handleDeleteDocument = (doc: any) => {
    setDocumentToDelete(doc);
    setDeleteConfirmOpen(true);
  };

  const getSubscriptionStatus = (sub: any) => {
    if (!sub.next_billing_date) return null;
    const daysUntil = differenceInDays(new Date(sub.next_billing_date), new Date());
    if (daysUntil < 0) return { status: "overdue", color: "bg-red-500", text: "En retard" };
    if (daysUntil <= 7) return { status: "soon", color: "bg-amber-500", text: `${daysUntil}j` };
    if (daysUntil <= 30) return { status: "upcoming", color: "bg-cyan-500", text: `${daysUntil}j` };
    return { status: "ok", color: "bg-emerald-500", text: `${daysUntil}j` };
  };

  const getDocumentTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      contract: "Contrat",
      id: "Pièce d'identité",
      cv: "CV",
      invoice: "Facture",
      general: "Document général",
    };
    return labels[type] || type;
  };

  const statusColors: Record<string, string> = {
    pending: "bg-amber-500/20 text-amber-400",
    processing: "bg-cyan-500/20 text-cyan-400",
    completed: "bg-emerald-500/20 text-emerald-400",
    cancelled: "bg-red-500/20 text-red-400",
    paid: "bg-emerald-500/20 text-emerald-400",
    overdue: "bg-red-500/20 text-red-400",
    open: "bg-cyan-500/20 text-cyan-400",
    closed: "bg-muted text-muted-foreground",
    active: "bg-emerald-500/20 text-emerald-400",
    inactive: "bg-muted text-muted-foreground",
    paused: "bg-blue-500/20 text-blue-400",
    approved: "bg-emerald-500/20 text-emerald-400",
    rejected: "bg-red-500/20 text-red-400",
  };

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">Clients</h1>
            <p className="text-muted-foreground mt-1">Gérer tous les profils clients</p>
          </div>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="hero">
                <Plus className="w-4 h-4 mr-2" />
                Nouveau client
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <User className="w-5 h-5 text-cyan-400" />
                  Créer un nouveau client
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4 max-h-[70vh] overflow-y-auto pr-2">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Prénom *</Label>
                    <Input value={newClient.first_name} onChange={(e) => setNewClient({ ...newClient, first_name: e.target.value })} placeholder="Jean" />
                  </div>
                  <div>
                    <Label>Nom de famille *</Label>
                    <Input value={newClient.last_name} onChange={(e) => setNewClient({ ...newClient, last_name: e.target.value })} placeholder="Dupont" />
                  </div>
                </div>
                <div>
                  <Label>Courriel *</Label>
                  <Input type="email" value={newClient.email} onChange={(e) => setNewClient({ ...newClient, email: e.target.value })} placeholder="jean@exemple.com" />
                </div>
                <div>
                  <Label>Mot de passe temporaire *</Label>
                  <Input type="password" value={newClient.password} onChange={(e) => setNewClient({ ...newClient, password: e.target.value })} placeholder="••••••••" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Téléphone</Label>
                    <Input value={newClient.phone} onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })} placeholder="514-555-1234" />
                  </div>
                  <div>
                    <Label>Date de naissance</Label>
                    <Input type="date" value={newClient.date_of_birth} onChange={(e) => setNewClient({ ...newClient, date_of_birth: e.target.value })} />
                  </div>
                </div>
                <div className="border-t border-border pt-4">
                  <Label className="text-muted-foreground text-xs uppercase mb-2 block">Adresse de service</Label>
                  <div className="space-y-3">
                    <div>
                      <Label>Adresse</Label>
                      <Input value={newClient.service_address} onChange={(e) => setNewClient({ ...newClient, service_address: e.target.value })} placeholder="123 rue Exemple" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Ville</Label>
                        <Input value={newClient.service_city} onChange={(e) => setNewClient({ ...newClient, service_city: e.target.value })} placeholder="Montréal" />
                      </div>
                      <div>
                        <Label>Code postal</Label>
                        <Input value={newClient.service_postal_code} onChange={(e) => setNewClient({ ...newClient, service_postal_code: e.target.value })} placeholder="H1A 1A1" />
                      </div>
                    </div>
                  </div>
                </div>
                <Button className="w-full" onClick={() => createClientMutation.mutate(newClient)} disabled={!newClient.email || !newClient.password || !newClient.first_name || !newClient.last_name}>
                  <Plus className="w-4 h-4 mr-2" />
                  Créer le client
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Enhanced Search bar */}
        <div className="flex gap-2 max-w-xl">
          <Select value={searchFilter} onValueChange={(v: any) => setSearchFilter(v)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Filtrer par" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="name">Nom</SelectItem>
              <SelectItem value="email">Courriel</SelectItem>
              <SelectItem value="phone">Téléphone</SelectItem>
              <SelectItem value="tag">Tag service</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                searchFilter === "name" ? "Rechercher par nom..." :
                searchFilter === "email" ? "Rechercher par courriel..." :
                searchFilter === "phone" ? "Rechercher par téléphone..." :
                searchFilter === "tag" ? "Rechercher par tag..." :
                "Rechercher par nom, courriel, téléphone, numéro client..."
              }
              className="pl-10"
            />
          </div>
        </div>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-cyan-400" />
              Liste des clients ({filteredClients?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : filteredClients && filteredClients.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Nom</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Courriel</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Solde</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Crédit</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Statut</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Inscrit le</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredClients.map((client: any) => (
                      <tr key={client.id} className="border-b border-border/50 hover:bg-accent/50">
                        <td className="py-3 px-4 text-sm text-foreground font-medium">{client.full_name || "—"}</td>
                        <td className="py-3 px-4 text-sm text-foreground">{client.email || "—"}</td>
                        <td className="py-3 px-4 text-sm">
                          <span className={Number(client.balance || 0) > 0 ? "text-amber-500 font-medium" : "text-muted-foreground"}>
                            {Number(client.balance || 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm">
                          <span className={Number(client.store_credit || 0) > 0 ? "text-emerald-500 font-medium" : "text-muted-foreground"}>
                            {Number(client.store_credit || 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <Badge className={
                            client.account_status === 'active' ? "bg-emerald-500/20 text-emerald-400" :
                            client.account_status === 'frozen' ? "bg-blue-500/20 text-blue-400" :
                            client.account_status === 'hold' ? "bg-amber-500/20 text-amber-400" :
                            client.account_status === 'deactivated' ? "bg-red-500/20 text-red-400" :
                            "bg-emerald-500/20 text-emerald-400"
                          }>
                            {client.account_status === 'active' || !client.account_status ? 'Actif' :
                             client.account_status === 'frozen' ? 'Gelé' :
                             client.account_status === 'hold' ? 'Attente' : 'Désactivé'}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">
                          {format(new Date(client.created_at), "d MMM yyyy", { locale: fr })}
                        </td>
                        <td className="py-3 px-4">
                          <Button size="sm" variant="outline" onClick={() => handleViewDetails(client)}>
                            <Eye className="w-4 h-4 mr-2" />
                            Gérer
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">{searchQuery ? "Aucun client trouvé" : "Aucun client pour le moment"}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Client Management Dialog */}
        <Dialog 
          open={detailsDialogOpen} 
          onOpenChange={(open) => {
            // Only allow closing via explicit action, not from clicks inside
            if (!open) {
              setDetailsDialogOpen(false);
            }
          }}
        >
          <DialogContent 
            className="max-w-6xl h-[90vh] flex flex-col p-0"
            onPointerDownOutside={(e) => e.preventDefault()}
            onInteractOutside={(e) => e.preventDefault()}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sticky Header */}
            <div className="flex-shrink-0 bg-background border-b border-border px-6 py-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-cyan-500/10 flex items-center justify-center flex-shrink-0">
                    <User className="w-6 h-6 text-cyan-400" />
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
                    variant="outline" 
                    className={`border ${
                      selectedClient?.account_status === 'active' ? 'bg-emerald-500/20 text-emerald-500 border-emerald-500/30' :
                      selectedClient?.account_status === 'suspended' ? 'bg-red-500/20 text-red-500 border-red-500/30' :
                      selectedClient?.account_status === 'frozen' ? 'bg-blue-500/20 text-blue-500 border-blue-500/30' :
                      selectedClient?.account_status === 'hold' ? 'bg-amber-500/20 text-amber-500 border-amber-500/30' :
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
                    <Badge variant="outline" className="bg-amber-500/20 text-amber-500 border-amber-500/30">
                      <DollarSign className="w-3 h-3 mr-1" />
                      {Number(selectedClient.balance).toFixed(2)}$
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {selectedClient && (
              <Tabs defaultValue="profile" className="flex-1 flex flex-col min-h-0 px-6 pb-6">
                <TabsList className="grid grid-cols-9 w-full flex-shrink-0 overflow-x-auto sticky top-0 z-10 bg-background">
                  <TabsTrigger value="profile" className="text-xs">Profil</TabsTrigger>
                  <TabsTrigger value="identity" className="text-xs">Identité</TabsTrigger>
                  <TabsTrigger value="services" className="text-xs">Services</TabsTrigger>
                  <TabsTrigger value="equipment" className="text-xs">Équipement</TabsTrigger>
                  <TabsTrigger value="orders" className="text-xs">Commandes</TabsTrigger>
                  <TabsTrigger value="payments" className="text-xs">Paiements</TabsTrigger>
                  <TabsTrigger value="incidents" className="text-xs">Incidents</TabsTrigger>
                  <TabsTrigger value="documents" className="text-xs">Documents</TabsTrigger>
                  <TabsTrigger value="logs" className="text-xs">Logs</TabsTrigger>
                </TabsList>

                <div className="flex-1 overflow-y-auto mt-4 min-h-0">
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
                    <div className="p-4 bg-muted/50 rounded-lg border border-border">
                      <Label className="text-xs text-muted-foreground uppercase">Crédit en magasin</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-2xl font-bold text-emerald-500">
                          {Number(selectedClient.store_credit || 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                        </p>
                      </div>
                      <div className="flex gap-2 mt-2">
                        <Button size="sm" variant="outline" onClick={() => {
                          const amount = prompt("Montant de crédit à ajouter:");
                          if (amount && !isNaN(Number(amount))) {
                            adjustBalanceMutation.mutate({ clientId: selectedClient.id, field: 'store_credit', amount: Number(amount), operation: 'add' });
                          }
                        }}>
                          <PlusCircle className="w-4 h-4 mr-1" /> Ajouter
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => {
                          const amount = prompt("Montant de crédit à retirer:");
                          if (amount && !isNaN(Number(amount))) {
                            adjustBalanceMutation.mutate({ clientId: selectedClient.id, field: 'store_credit', amount: Number(amount), operation: 'remove' });
                          }
                        }}>
                          <MinusCircle className="w-4 h-4 mr-1" /> Retirer
                        </Button>
                      </div>
                    </div>

                    {/* Client Accounts with Credit Class (Internal) */}
                    <Card className="bg-amber-500/5 border-amber-500/30">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg flex items-center gap-2 text-amber-600">
                          <Star className="w-4 h-4" />
                          Comptes & Classe de crédit (INTERNE)
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {clientAccounts && clientAccounts.length > 0 ? (
                          clientAccounts.map((account: any) => (
                            <div key={account.id} className="flex items-center justify-between p-3 border rounded-lg bg-background">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <Building2 className="w-4 h-4 text-muted-foreground" />
                                  <span className="font-mono text-sm font-medium">{account.account_number}</span>
                                  <Badge variant="outline">{account.account_name}</Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {account.billing_address}, {account.billing_city}
                                </p>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${creditClassLabels[account.credit_class]?.color || "bg-gray-400"}`}>
                                  {account.credit_class || "?"}
                                </div>
                                <span className="text-sm font-medium">
                                  {creditClassLabels[account.credit_class]?.label || "Non défini"}
                                </span>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            Aucun compte associé. Créez un compte dans la section "Comptes".
                          </p>
                        )}
                      </CardContent>
                    </Card>

                    {/* PIN Management - Admin Only */}
                    <AdminPinManagementCard
                      client={{
                        id: selectedClient.id,
                        user_id: selectedClient.user_id,
                        email: selectedClient.email,
                        full_name: selectedClient.full_name,
                      }}
                      pinStatus={{
                        hasPin: !!selectedClient.client_pin_hash,
                        isDefault: selectedClient.pin_is_default || false,
                        lastUpdated: selectedClient.updated_at,
                      }}
                      onPinChanged={() => refetchClients()}
                      staffUser={{
                        id: user?.id || "",
                        name: "Admin",
                        role: "admin",
                      }}
                    />

                    {/* Security Controls - Admin Only */}
                    <AdminSecurityControls
                      clientId={selectedClient.user_id}
                      clientEmail={selectedClient.email}
                      securityStatus={selectedClient.security_status || "active"}
                      securityAlertLevel={selectedClient.security_alert_level || "none"}
                      securityReason={selectedClient.security_reason}
                      securityFlaggedAt={selectedClient.security_flagged_at}
                      securityFlaggedOrderId={selectedClient.security_flagged_order_id}
                      securityRequiresPinReset={selectedClient.security_requires_pin_reset || false}
                      onUpdate={(updatedProfile) => {
                        // Immediately update local state with the new profile data
                        if (updatedProfile) {
                          setSelectedClient((prev: any) => ({
                            ...prev,
                            security_status: updatedProfile.security_status,
                            security_alert_level: updatedProfile.security_alert_level,
                            security_reason: updatedProfile.security_reason,
                            security_flagged_at: updatedProfile.security_flagged_at,
                            security_flagged_order_id: updatedProfile.security_flagged_order_id,
                            security_requires_pin_reset: updatedProfile.security_requires_pin_reset,
                            account_status: updatedProfile.account_status,
                          }));
                        }
                        // Also refetch the full list to ensure cache is updated
                        refetchClients();
                      }}
                    />

                    {/* Internal Notes - Admin/Employee only */}
                    <ClientInternalNotes 
                      clientId={selectedClient.user_id} 
                      clientEmail={selectedClient.email}
                    />

                    <Card className="bg-card border-border">
                      <CardContent className="pt-6 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Prénom</Label>
                            <Input value={selectedClient.first_name || ""} onChange={(e) => setSelectedClient({ ...selectedClient, first_name: e.target.value })} />
                          </div>
                          <div>
                            <Label>Nom</Label>
                            <Input value={selectedClient.last_name || ""} onChange={(e) => setSelectedClient({ ...selectedClient, last_name: e.target.value })} />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Téléphone</Label>
                            <Input value={selectedClient.phone || ""} onChange={(e) => setSelectedClient({ ...selectedClient, phone: e.target.value })} />
                          </div>
                          <div>
                            <Label>Date de naissance</Label>
                            <Input type="date" value={selectedClient.date_of_birth || ""} onChange={(e) => setSelectedClient({ ...selectedClient, date_of_birth: e.target.value })} />
                          </div>
                        </div>
                        <div>
                          <Label>Adresse de service</Label>
                          <Input value={selectedClient.service_address || ""} onChange={(e) => setSelectedClient({ ...selectedClient, service_address: e.target.value })} />
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <Label>Ville</Label>
                            <Input value={selectedClient.service_city || ""} onChange={(e) => setSelectedClient({ ...selectedClient, service_city: e.target.value })} />
                          </div>
                          <div>
                            <Label>Province</Label>
                            <Input value={selectedClient.service_province || "QC"} onChange={(e) => setSelectedClient({ ...selectedClient, service_province: e.target.value })} />
                          </div>
                          <div>
                            <Label>Code postal</Label>
                            <Input value={selectedClient.service_postal_code || ""} onChange={(e) => setSelectedClient({ ...selectedClient, service_postal_code: e.target.value })} />
                          </div>
                        </div>
                        <div>
                          <Label>Statut du compte</Label>
                          <Select value={selectedClient.account_status || "active"} onValueChange={(v) => setSelectedClient({ ...selectedClient, account_status: v })}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="active">Actif</SelectItem>
                              <SelectItem value="hold">En attente</SelectItem>
                              <SelectItem value="frozen">Gelé</SelectItem>
                              <SelectItem value="deactivated">Désactivé</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Notes internes (admin seulement)</Label>
                          <Textarea value={selectedClient.internal_notes || ""} onChange={(e) => setSelectedClient({ ...selectedClient, internal_notes: e.target.value })} rows={3} />
                        </div>
                        <Button onClick={() => updateClientMutation.mutate(selectedClient)}>
                          <Save className="w-4 h-4 mr-2" />
                          Enregistrer le profil
                        </Button>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Identity Tab */}
                  <TabsContent value="identity" className="space-y-4 pr-4">
                    <Card className="bg-card border-border">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <IdCard className="w-5 h-5 text-cyan-400" />
                          Informations d'identité
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Type de pièce d'identité</Label>
                            <Select value={selectedClient.id_type || ""} onValueChange={(v) => setSelectedClient({ ...selectedClient, id_type: v })}>
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
                            <Select value={selectedClient.id_province || "QC"} onValueChange={(v) => setSelectedClient({ ...selectedClient, id_province: v })}>
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
                            <Input value={selectedClient.id_number || ""} onChange={(e) => setSelectedClient({ ...selectedClient, id_number: e.target.value })} placeholder="Numéro..." />
                          </div>
                          <div>
                            <Label>Date d'expiration</Label>
                            <Input type="date" value={selectedClient.id_expiration || ""} onChange={(e) => setSelectedClient({ ...selectedClient, id_expiration: e.target.value })} />
                          </div>
                        </div>
                        
                        {/* ID Document Preview */}
                        {clientDocuments?.filter((d: any) => d.document_type === 'id').length > 0 && (
                          <div className="p-4 bg-muted/50 rounded-lg border border-border">
                            <Label className="text-sm font-medium mb-3 block">Documents d'identité téléversés</Label>
                            <div className="space-y-2">
                              {clientDocuments?.filter((d: any) => d.document_type === 'id').map((doc: any) => (
                                <div key={doc.id} className="flex items-center justify-between p-2 bg-background rounded border">
                                  <div className="flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-cyan-400" />
                                    <span className="text-sm">{doc.document_name}</span>
                                  </div>
                                  <Button size="sm" variant="ghost" onClick={() => handleViewDocument(doc)}>
                                    <Eye className="w-4 h-4" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* ID Verification Actions */}
                        <div className="p-4 bg-muted/50 rounded-lg border border-border">
                          <Label className="text-sm font-medium mb-3 block">Statut de vérification</Label>
                          <div className="flex gap-3">
                            <Button 
                              variant="outline" 
                              className="flex-1 border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10"
                              onClick={() => {
                                logActivity("approve_id", "client", selectedClient.id, {
                                  id_type: selectedClient.id_type,
                                  id_number: selectedClient.id_number,
                                }, {
                                  changedField: "id_verification",
                                  newValue: "approved",
                                  reason: "Identité approuvée par admin"
                                });
                                refetchActivityLogs();
                                toast({ title: "Identité approuvée", description: "La vérification a été enregistrée." });
                              }}
                            >
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Approuver
                            </Button>
                            <Button 
                              variant="outline" 
                              className="flex-1 border-red-500/30 text-red-500 hover:bg-red-500/10"
                              onClick={() => {
                                const reason = prompt("Raison du rejet:");
                                if (reason) {
                                  logActivity("reject_id", "client", selectedClient.id, {
                                    id_type: selectedClient.id_type,
                                    id_number: selectedClient.id_number,
                                    rejection_reason: reason
                                  }, {
                                    changedField: "id_verification",
                                    newValue: "rejected",
                                    reason: `Identité rejetée: ${reason}`
                                  });
                                  refetchActivityLogs();
                                  toast({ title: "Identité rejetée", description: "Le rejet a été enregistré.", variant: "destructive" });
                                }
                              }}
                            >
                              <XCircle className="w-4 h-4 mr-2" />
                              Rejeter
                            </Button>
                          </div>
                        </div>
                        
                        <Button onClick={() => updateClientMutation.mutate(selectedClient)}>
                          <Save className="w-4 h-4 mr-2" />
                          Enregistrer les informations d'identité
                        </Button>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Services Tab */}
                  <TabsContent value="services" className="space-y-4 pr-4">
                    <Card className="bg-card border-border">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <Package className="w-5 h-5 text-cyan-400" />
                          Services souscrits
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {clientSubscriptions && clientSubscriptions.length > 0 ? (
                          <div className="space-y-3">
                            {clientSubscriptions.map((sub: any) => {
                              const renewalStatus = getSubscriptionStatus(sub);
                              return (
                                <div key={sub.id} className="p-4 border border-border rounded-lg">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-3">
                                      {sub.plan_name?.toLowerCase().includes("mobile") ? (
                                        <Smartphone className="w-6 h-6 text-blue-500" />
                                      ) : sub.plan_name?.toLowerCase().includes("tv") ? (
                                        <Monitor className="w-6 h-6 text-purple-500" />
                                      ) : (
                                        <Router className="w-6 h-6 text-cyan-500" />
                                      )}
                                      <div>
                                        <p className="font-medium text-foreground">{sub.plan_name}</p>
                                        <p className="text-sm text-muted-foreground">
                                          {Number(sub.amount).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}/{sub.billing_cycle === "monthly" ? "mois" : "an"}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {renewalStatus && (
                                        <Badge variant="outline" className={`${renewalStatus.color.replace('bg-', 'border-').replace('-500', '-500/30')} ${renewalStatus.color.replace('bg-', 'text-')}`}>
                                          <Bell className="w-3 h-3 mr-1" />
                                          {renewalStatus.text}
                                        </Badge>
                                      )}
                                      <Badge className={statusColors[sub.status] || statusColors.active}>
                                        {sub.status === "active" ? "Actif" : sub.status === "paused" ? "Suspendu" : "Inactif"}
                                      </Badge>
                                    </div>
                                  </div>
                                  <div className="flex gap-2 mt-3 pt-3 border-t border-border/50">
                                    {sub.status === 'active' ? (
                                      <Button size="sm" variant="outline" className="text-amber-500" onClick={() => {
                                        const reason = prompt("Raison de la suspension:");
                                        if (reason) {
                                          updateSubscriptionMutation.mutate({ id: sub.id, status: 'paused', reason });
                                        }
                                      }}>
                                        <Pause className="w-4 h-4 mr-1" /> Suspendre
                                      </Button>
                                    ) : (
                                      <Button size="sm" variant="outline" className="text-emerald-500" onClick={() => {
                                        updateSubscriptionMutation.mutate({ id: sub.id, status: 'active', reason: 'Service réactivé par admin' });
                                      }}>
                                        <Play className="w-4 h-4 mr-1" /> Activer
                                      </Button>
                                    )}
                                    <Button size="sm" variant="outline" className="text-red-500" onClick={() => {
                                      const reason = prompt("Raison de l'annulation:");
                                      if (reason) {
                                        updateSubscriptionMutation.mutate({ id: sub.id, status: 'cancelled', reason });
                                      }
                                    }}>
                                      <XCircle className="w-4 h-4 mr-1" /> Annuler
                                    </Button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-center py-8">
                            <Package className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                            <p className="text-muted-foreground">Aucun service souscrit</p>
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
                          <Router className="w-5 h-5 text-cyan-400" />
                          Équipement attribué
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {clientOrders && clientOrders.some((o: any) => o.service_type) ? (
                          <div className="space-y-4">
                            {clientOrders.map((order: any) => (
                              <div key={order.id} className="p-4 border border-border rounded-lg">
                                <div className="flex items-center justify-between mb-3">
                                  <span className="text-sm text-muted-foreground">Commande: {order.order_number}</span>
                                  <div className="flex items-center gap-2">
                                    <Badge className={statusColors[order.status] || statusColors.pending}>{order.status}</Badge>
                                    <Button size="sm" variant="ghost" onClick={() => handleViewOrder(order)}>
                                      <Edit className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </div>
                                
                                {/* Nivra Born Wifi Router */}
                                {(order.service_type?.toLowerCase().includes("internet") || order.service_type?.toLowerCase().includes("tv")) && (
                                  <div className="p-3 bg-muted/50 rounded-lg mb-2 hover:bg-muted/70 cursor-pointer" onClick={() => handleViewOrder(order)}>
                                    <div className="flex items-center gap-3">
                                      <Router className="w-5 h-5 text-cyan-500" />
                                      <div className="flex-1">
                                        <p className="font-medium text-sm">Nivra Born Wifi Router</p>
                                        <p className="text-xs text-muted-foreground">Frais unique: 60$</p>
                                      </div>
                                      <div className="text-right">
                                        {order.serial_number ? (
                                          <>
                                            <p className="text-xs text-muted-foreground">S/N: {order.serial_number}</p>
                                            <p className="text-xs text-muted-foreground">
                                              Garantie: {format(new Date(order.created_at), "d MMM yyyy", { locale: fr })} - {format(addYears(new Date(order.created_at), 1), "d MMM yyyy", { locale: fr })}
                                            </p>
                                            <Badge variant="outline" className={new Date() > addYears(new Date(order.created_at), 1) ? "text-red-500 border-red-500/30" : "text-emerald-500 border-emerald-500/30"}>
                                              {new Date() > addYears(new Date(order.created_at), 1) ? "Expiré" : "Valide"}
                                            </Badge>
                                          </>
                                        ) : (
                                          <Badge variant="outline" className="text-xs">Non assigné</Badge>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )}
                                
                                {/* Nivra 4K Smart Terminal */}
                                {order.service_type?.toLowerCase().includes("tv") && (
                                  <div className="p-3 bg-muted/50 rounded-lg mb-2 hover:bg-muted/70 cursor-pointer" onClick={() => handleViewOrder(order)}>
                                    <div className="flex items-center gap-3">
                                      <Monitor className="w-5 h-5 text-purple-500" />
                                      <div className="flex-1">
                                        <p className="font-medium text-sm">Nivra 4K Smart Terminal</p>
                                        <p className="text-xs text-muted-foreground">Frais: 50$/terminal × {order.terminal_count || 1}</p>
                                      </div>
                                      <div className="text-right">
                                        {order.equipment_id ? (
                                          <>
                                            <p className="text-xs text-muted-foreground">ID: {order.equipment_id}</p>
                                            {order.imei_number && <p className="text-xs text-muted-foreground">IMEI: {order.imei_number}</p>}
                                            <p className="text-xs text-muted-foreground">
                                              Garantie: {format(new Date(order.created_at), "d MMM yyyy", { locale: fr })} - {format(addYears(new Date(order.created_at), 1), "d MMM yyyy", { locale: fr })}
                                            </p>
                                            <Badge variant="outline" className={new Date() > addYears(new Date(order.created_at), 1) ? "text-red-500 border-red-500/30" : "text-emerald-500 border-emerald-500/30"}>
                                              {new Date() > addYears(new Date(order.created_at), 1) ? "Expiré" : "Valide"}
                                            </Badge>
                                          </>
                                        ) : (
                                          <Badge variant="outline" className="text-xs">Non assigné</Badge>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )}
                                
                                {/* SIM for Mobile */}
                                {order.service_type?.toLowerCase().includes("mobile") && (
                                  <div className="p-3 bg-muted/50 rounded-lg hover:bg-muted/70 cursor-pointer" onClick={() => handleViewOrder(order)}>
                                    <div className="flex items-center gap-3">
                                      <Smartphone className="w-5 h-5 text-blue-500" />
                                      <div className="flex-1">
                                        <p className="font-medium text-sm">Carte SIM / eSIM</p>
                                        <p className="text-xs text-muted-foreground">Frais unique: 25$</p>
                                      </div>
                                      <div className="text-right">
                                        {order.sim_number ? (
                                          <>
                                            <p className="text-xs text-muted-foreground">SIM: {order.sim_number}</p>
                                            {order.imei_number && <p className="text-xs text-muted-foreground">IMEI: {order.imei_number}</p>}
                                            <p className="text-xs text-muted-foreground">
                                              Activé: {format(new Date(order.created_at), "d MMM yyyy", { locale: fr })}
                                            </p>
                                          </>
                                        ) : (
                                          <Badge variant="outline" className="text-xs">Non assigné</Badge>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* Report Equipment Issue Button */}
                                <div className="mt-3 pt-3 border-t border-border/50">
                                  <Button size="sm" variant="outline" className="text-amber-500 border-amber-500/30" onClick={() => {
                                    const equipment = prompt("Équipement concerné? (Router, Terminal, SIM)");
                                    const issue = prompt("Type d'incident? (Défaut, Volé, Non retourné, Fin de vie)");
                                    if (equipment && issue) {
                                      logActivity("incident_equipment", "order", order.id, { 
                                        order_number: order.order_number,
                                        equipment, 
                                        issue 
                                      }, {
                                        changedField: "equipment_incident",
                                        reason: `${equipment}: ${issue}`
                                      });
                                      refetchActivityLogs();
                                      toast({ title: "Incident enregistré", description: `${equipment} - ${issue}` });
                                    }
                                  }}>
                                    <AlertTriangle className="w-4 h-4 mr-1" />
                                    Signaler incident
                                  </Button>
                                </div>
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
                      {clientOrders && clientOrders.length > 0 ? (
                        clientOrders.map((order: any) => (
                          <div key={order.id} className="p-4 border border-border rounded-lg">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <Package className="w-8 h-8 text-cyan-400" />
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
                                <Badge className={statusColors[order.status] || statusColors.pending}>{order.status}</Badge>
                                <Button size="sm" variant="outline" onClick={() => handleViewOrder(order)}>
                                  <Eye className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-8">
                          <ShoppingBag className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                          <p className="text-muted-foreground">Aucune commande</p>
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  {/* Payments Tab */}
                  <TabsContent value="payments" className="space-y-4 pr-4">
                    {/* Credits Display */}
                    {/* Balance Breakdown before payments */}
                    <ClientBalanceBreakdown 
                      clientUserId={selectedClient.user_id} 
                      clientEmail={selectedClient.email}
                      compact={true}
                    />

                    {/* Payment History */}
                    <Card className="bg-card border-border">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <CreditCard className="w-5 h-5 text-cyan-400" />
                          Historique des paiements
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {clientPayments && clientPayments.length > 0 ? (
                          <div className="space-y-3">
                            {clientPayments.map((payment: any) => (
                              <div key={payment.id} className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-accent/30 cursor-pointer" onClick={() => { setSelectedPayment(payment); setPaymentDetailsOpen(true); }}>
                                <div className="flex items-center gap-4">
                                  <DollarSign className="w-8 h-8 text-emerald-400" />
                                  <div>
                                    <p className="font-medium text-foreground">{payment.payment_reference || payment.reference_number}</p>
                                    <p className="text-sm text-muted-foreground">{format(new Date(payment.created_at), "d MMM yyyy HH:mm", { locale: fr })}</p>
                                    <p className="text-xs text-muted-foreground">{payment.payment_method} {payment.card_last_four && `•••• ${payment.card_last_four}`}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <div className="text-right">
                                    <span className="font-bold text-lg text-emerald-500">{Number(payment.amount).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                                    <Badge className={statusColors[payment.status] || "bg-emerald-500/20 text-emerald-400"}>
                                      {payment.status === "completed" ? "Complété" : payment.status === "pending" ? "En attente" : payment.status}
                                    </Badge>
                                  </div>
                                  <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setSelectedPayment(payment); setPaymentDetailsOpen(true); }}>
                                    <Eye className="w-4 h-4" />
                                  </Button>
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
                          <FileText className="w-5 h-5 text-cyan-400" />
                          Factures
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {clientBilling && clientBilling.length > 0 ? (
                          <div className="space-y-3">
                            {clientBilling.map((bill: any) => (
                              <div key={bill.id} className="flex items-center justify-between p-4 border border-border rounded-lg">
                                <div className="flex items-center gap-4">
                                  <FileText className="w-6 h-6 text-cyan-400" />
                                  <div>
                                    <p className="font-medium text-foreground">{bill.invoice_number || `Facture #${bill.id.slice(0, 8)}`}</p>
                                    <p className="text-sm text-muted-foreground">
                                      {format(new Date(bill.created_at), "d MMM yyyy", { locale: fr })}
                                      {bill.due_date && ` • Échéance: ${format(new Date(bill.due_date), "d MMM", { locale: fr })}`}
                                    </p>
                                    {bill.related_order_number && <p className="text-xs text-cyan-500">Commande: {bill.related_order_number}</p>}
                                  </div>
                                </div>
                                <div className="flex items-center gap-4">
                                  <span className="font-medium">{Number(bill.amount).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                                  <Badge className={statusColors[bill.status] || statusColors.pending}>
                                    {bill.status === "paid" ? "Payé" : bill.status === "overdue" ? "En retard" : "En attente"}
                                  </Badge>
                                  <Button size="sm" variant="outline" onClick={() => handleViewInvoice(bill)}>
                                    <Eye className="w-4 h-4" />
                                  </Button>
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
                        <p className="text-sm text-muted-foreground">Enregistrez les incidents signalés par le client. Ces informations sont visibles uniquement aux administrateurs.</p>
                        
                        <div className="grid grid-cols-2 gap-3">
                          <Button variant="outline" className="justify-start border-red-500/30 text-red-500 hover:bg-red-500/10" onClick={() => {
                            const details = prompt("Détails du signalement SIM volée/perdue:");
                            if (details) {
                              logActivity("incident_sim_lost", "client", selectedClient.id, { type: "sim_stolen_lost", details, fee: 25 }, {
                                changedField: "incident",
                                reason: `SIM volée/perdue: ${details}`
                              });
                              refetchActivityLogs();
                              toast({ title: "Incident enregistré", description: "SIM volée/perdue - Frais 25$ applicable pour remplacement" });
                            }
                          }}>
                            <Smartphone className="w-4 h-4 mr-2" />
                            SIM volée/perdue (25$)
                          </Button>
                          
                          <Button variant="outline" className="justify-start border-red-500/30 text-red-500 hover:bg-red-500/10" onClick={() => {
                            const details = prompt("Détails du signalement téléphone perdu:");
                            if (details) {
                              logActivity("incident_phone_lost", "client", selectedClient.id, { type: "phone_lost", details }, {
                                changedField: "incident",
                                reason: `Téléphone perdu: ${details}`
                              });
                              refetchActivityLogs();
                              toast({ title: "Incident enregistré", description: "Téléphone perdu enregistré" });
                            }
                          }}>
                            <Phone className="w-4 h-4 mr-2" />
                            Téléphone perdu
                          </Button>
                          
                          <Button variant="outline" className="justify-start border-amber-500/30 text-amber-500 hover:bg-amber-500/10" onClick={() => {
                            const equipment = prompt("Quel équipement? (Router, Terminal, etc.)");
                            const issue = prompt("Type de problème? (Défaut, Endommagé, Volé, Non retourné, Fin de vie)");
                            if (equipment && issue) {
                              logActivity("incident_equipment", "client", selectedClient.id, { type: "equipment_issue", equipment, issue }, {
                                changedField: "incident",
                                reason: `Équipement ${equipment}: ${issue}`
                              });
                              refetchActivityLogs();
                              toast({ title: "Incident enregistré", description: `${equipment} - ${issue}` });
                            }
                          }}>
                            <Wrench className="w-4 h-4 mr-2" />
                            Problème équipement
                          </Button>
                          
                          <Button variant="outline" className="justify-start border-blue-500/30 text-blue-500 hover:bg-blue-500/10" onClick={() => {
                            const reason = prompt("Raison de la pause:");
                            if (reason) {
                              logActivity("service_pause_request", "client", selectedClient.id, { type: "service_pause", reason, note: "Frais mensuels continuent" }, {
                                changedField: "service",
                                reason: `Pause service demandée: ${reason} (frais continuent)`
                              });
                              refetchActivityLogs();
                              toast({ title: "Demande enregistrée", description: "Pause service - Les frais mensuels continuent" });
                            }
                          }}>
                            <Pause className="w-4 h-4 mr-2" />
                            Pause service (frais continuent)
                          </Button>
                        </div>

                        {/* Recent Tickets */}
                        <div className="mt-6">
                          <Label className="text-sm font-medium mb-3 block">Tickets de support récents</Label>
                          {clientTickets && clientTickets.length > 0 ? (
                            <div className="space-y-2">
                              {clientTickets.slice(0, 5).map((ticket: any) => (
                                <div key={ticket.id} className="flex items-center justify-between p-3 border border-border rounded-lg">
                                  <div className="flex items-center gap-3">
                                    <Ticket className="w-5 h-5 text-cyan-400" />
                                    <div>
                                      <p className="text-sm font-medium text-foreground">{ticket.subject}</p>
                                      <p className="text-xs text-muted-foreground">{ticket.ticket_number} • {format(new Date(ticket.created_at), "d MMM yyyy", { locale: fr })}</p>
                                    </div>
                                  </div>
                                  <Badge className={statusColors[ticket.status] || statusColors.open}>
                                    {ticket.status === "open" ? "Ouvert" : ticket.status === "in_progress" ? "En cours" : "Fermé"}
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">Aucun ticket récent</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Documents Tab */}
                  <TabsContent value="documents" className="space-y-4 pr-4">
                    <div className="flex gap-2">
                      <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" />
                      <Button variant="outline" className="w-full" onClick={() => fileInputRef.current?.click()}>
                        <Upload className="w-4 h-4 mr-2" />
                        Téléverser un document
                      </Button>
                    </div>

                    <div className="space-y-2">
                      {/* Contracts Section */}
                      {clientContracts && clientContracts.length > 0 && (
                        <div className="mb-4">
                          <Label className="text-sm font-medium mb-2 block">Contrats</Label>
                          {clientContracts.map((contract: any) => (
                            <div key={contract.id} className="flex items-center justify-between p-3 border border-border rounded-lg mb-2">
                              <div className="flex items-center gap-3">
                                <FileText className="w-5 h-5 text-purple-400" />
                                <div>
                                  <p className="text-sm font-medium text-foreground">{contract.contract_name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {contract.contract_number} • {format(new Date(contract.created_at), "d MMM yyyy", { locale: fr })}
                                    {contract.is_signed && " • Signé"}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge className={contract.is_signed ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"}>
                                  {contract.is_signed ? "Signé" : "En attente"}
                                </Badge>
                                <Button size="sm" variant="ghost" onClick={() => handleViewDocument({ ...contract, document_name: contract.contract_name, document_url: contract.contract_url, document_type: 'contract' })}>
                                  <Eye className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Other Documents */}
                      {clientDocuments && clientDocuments.length > 0 ? (
                        clientDocuments.map((doc: any) => (
                          <div key={doc.id} className="flex items-center justify-between p-3 border border-border rounded-lg">
                            <div className="flex items-center gap-3">
                              <FileText className="w-5 h-5 text-cyan-400" />
                              <div>
                                <p className="text-sm font-medium text-foreground">{doc.document_name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {getDocumentTypeLabel(doc.document_type)} • {format(new Date(doc.created_at), "d MMM yyyy", { locale: fr })}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button size="sm" variant="ghost" onClick={() => handleViewDocument(doc)}>
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => handleDeleteDocument(doc)}>
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-8">
                          <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                          <p className="text-sm text-muted-foreground">Aucun document</p>
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  {/* Logs Tab */}
                  <TabsContent value="logs" className="space-y-4 pr-4">
                    <ClientLogsTab clientUserId={selectedClient.user_id} isAdmin={true} />
                  </TabsContent>
                </div>
              </Tabs>
            )}
            
            {/* Back to Top Button */}
            {detailsDialogOpen && <BackToTopButton />}
          </DialogContent>
        </Dialog>

        {/* Document Viewer Dialog */}
        <Dialog open={documentViewerOpen} onOpenChange={setDocumentViewerOpen}>
          <DialogContent className="max-w-3xl" onPointerDownOutside={(e) => e.preventDefault()} onClick={(e) => e.stopPropagation()}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-cyan-400" />
                {selectedDocument?.document_name}
              </DialogTitle>
            </DialogHeader>
            {selectedDocument && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                  <div>
                    <Label className="text-xs text-muted-foreground">Type</Label>
                    <p className="font-medium">{getDocumentTypeLabel(selectedDocument.document_type)}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Date d'upload</Label>
                    <p className="font-medium">{format(new Date(selectedDocument.created_at), "d MMM yyyy HH:mm", { locale: fr })}</p>
                  </div>
                </div>
                <div className="p-8 bg-muted/30 rounded-lg border border-dashed border-border text-center">
                  <FileText className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">Aperçu du document</p>
                  <p className="text-sm text-muted-foreground break-all">{selectedDocument.document_url}</p>
                </div>
                <div className="flex gap-2">
                  <Button 
                    className="flex-1" 
                    variant="outline"
                    onClick={async () => {
                      try {
                        if (selectedDocument.document_type === 'contract' && selectedDocument.contract_url) {
                          // This is a generated contract - use the contract generator
                          const contractData = {
                            contractNumber: selectedDocument.contract_url || selectedDocument.id?.slice(0, 8).toUpperCase(),
                            contractName: selectedDocument.document_name || "Contrat",
                            clientName: selectedClient?.full_name || "Client",
                            clientEmail: selectedClient?.email || "",
                            clientPhone: selectedClient?.phone || "",
                            serviceDescription: `Contrat de services - ${selectedDocument.document_name}`,
                            startDate: selectedDocument.created_at,
                            isSigned: selectedDocument.is_signed || false,
                            signedAt: selectedDocument.signed_at,
                            employeeName: "Nivra Télécom",
                            employeeTitle: "Service Client",
                          };
                          downloadContractPDF(contractData);
                        } else if (selectedDocument.document_url?.startsWith('http')) {
                          // External URL - fetch and download
                          const response = await fetch(selectedDocument.document_url);
                          if (!response.ok) throw new Error("Failed to fetch document");
                          const blob = await response.blob();
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = selectedDocument.document_name || "document";
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                          URL.revokeObjectURL(url);
                        } else {
                          toast({ title: "URL du document non disponible", variant: "destructive" });
                        }
                        toast({ title: "Document téléchargé" });
                      } catch (error) {
                        console.error("Download error:", error);
                        toast({ title: "Erreur lors du téléchargement", variant: "destructive" });
                      }
                    }}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Télécharger
                  </Button>
                  <Button 
                    className="flex-1" 
                    variant="outline"
                    onClick={async () => {
                      try {
                        if (selectedDocument.document_type === 'contract' && selectedDocument.contract_url) {
                          // This is a generated contract - use the contract generator
                          const contractData = {
                            contractNumber: selectedDocument.contract_url || selectedDocument.id?.slice(0, 8).toUpperCase(),
                            contractName: selectedDocument.document_name || "Contrat",
                            clientName: selectedClient?.full_name || "Client",
                            clientEmail: selectedClient?.email || "",
                            clientPhone: selectedClient?.phone || "",
                            serviceDescription: `Contrat de services - ${selectedDocument.document_name}`,
                            startDate: selectedDocument.created_at,
                            isSigned: selectedDocument.is_signed || false,
                            signedAt: selectedDocument.signed_at,
                            employeeName: "Nivra Télécom",
                            employeeTitle: "Service Client",
                          };
                          viewContractPDF(contractData);
                        } else if (selectedDocument.document_url?.startsWith('http')) {
                          // External URL - open safely in new tab
                          window.open(selectedDocument.document_url, "_blank", "noopener,noreferrer");
                        } else {
                          toast({ title: "URL du document non disponible", variant: "destructive" });
                        }
                      } catch (error) {
                        console.error("Open error:", error);
                        toast({ title: "Erreur lors de l'ouverture", variant: "destructive" });
                      }
                    }}
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Ouvrir
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Order Details Dialog */}
        <Dialog open={orderDetailsOpen} onOpenChange={setOrderDetailsOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" onPointerDownOutside={(e) => e.preventDefault()} onClick={(e) => e.stopPropagation()}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Package className="w-5 h-5 text-cyan-400" />
                Détails de la commande {selectedOrder?.order_number}
              </DialogTitle>
            </DialogHeader>
            {selectedOrder && (
              <div className="space-y-4">
                {/* Order Info Header */}
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
                      <p className="font-medium">{selectedOrder.created_by === 'admin' ? 'Admin' : 'Client'}</p>
                    </div>
                  </div>
                </div>

                {/* ID Verification Status */}
                <div className="p-4 bg-muted/30 rounded-lg border border-border">
                  <Label className="text-sm font-medium mb-3 block flex items-center gap-2">
                    <IdCard className="w-4 h-4 text-cyan-400" />
                    Vérification d'identité
                  </Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Statut</Label>
                      <Badge className={
                        selectedOrder.id_verification_status === 'approved' ? "bg-emerald-500/20 text-emerald-400" :
                        selectedOrder.id_verification_status === 'rejected' ? "bg-red-500/20 text-red-400" :
                        "bg-amber-500/20 text-amber-400"
                      }>
                        {selectedOrder.id_verification_status === 'approved' ? 'Approuvé' : 
                         selectedOrder.id_verification_status === 'rejected' ? 'Rejeté' : 'En attente'}
                      </Badge>
                    </div>
                    {selectedOrder.id_verified_at && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Vérifié le</Label>
                        <p className="text-sm">{format(new Date(selectedOrder.id_verified_at), "d MMM yyyy HH:mm", { locale: fr })}</p>
                      </div>
                    )}
                  </div>
                  {selectedOrder.id_verification_notes && (
                    <div className="mt-2">
                      <Label className="text-xs text-muted-foreground">Notes de vérification</Label>
                      <p className="text-sm text-muted-foreground">{selectedOrder.id_verification_notes}</p>
                    </div>
                  )}
                  {/* Client ID Details from Profile */}
                  {selectedClient && (
                    <div className="mt-3 pt-3 border-t border-border/50 grid grid-cols-4 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">Type:</span>
                        <p>{selectedClient.id_type === 'driver_license' ? 'Permis' : selectedClient.id_type === 'health_card' ? 'RAMQ' : selectedClient.id_type === 'passport' ? 'Passeport' : selectedClient.id_type || '—'}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Numéro:</span>
                        <p>{selectedClient.id_number || '—'}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Province:</span>
                        <p>{selectedClient.id_province || 'QC'}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Expiration:</span>
                        <p>{selectedClient.id_expiration ? format(new Date(selectedClient.id_expiration), "d MMM yyyy", { locale: fr }) : '—'}</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Statut</Label>
                    <Select value={selectedOrder.status} onValueChange={(v) => setSelectedOrder({ ...selectedOrder, status: v })}>
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
                    <Select value={selectedOrder.payment_status || "pending"} onValueChange={(v) => setSelectedOrder({ ...selectedOrder, payment_status: v })}>
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
                    <Input value={selectedOrder.payment_reference || ""} onChange={(e) => setSelectedOrder({ ...selectedOrder, payment_reference: e.target.value })} />
                  </div>
                  <div>
                    <Label>Numéro de suivi</Label>
                    <Input value={selectedOrder.tracking_number || ""} onChange={(e) => setSelectedOrder({ ...selectedOrder, tracking_number: e.target.value })} />
                  </div>
                </div>
                <div>
                  <Label>URL de suivi</Label>
                  <Input value={selectedOrder.tracking_url || ""} onChange={(e) => setSelectedOrder({ ...selectedOrder, tracking_url: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Numéro de série (Router)</Label>
                    <Input value={selectedOrder.serial_number || ""} onChange={(e) => setSelectedOrder({ ...selectedOrder, serial_number: e.target.value })} />
                  </div>
                  <div>
                    <Label>ID équipement (Terminal)</Label>
                    <Input value={selectedOrder.equipment_id || ""} onChange={(e) => setSelectedOrder({ ...selectedOrder, equipment_id: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>IMEI</Label>
                    <Input value={selectedOrder.imei_number || ""} onChange={(e) => setSelectedOrder({ ...selectedOrder, imei_number: e.target.value })} />
                  </div>
                  <div>
                    <Label>Numéro SIM</Label>
                    <Input value={selectedOrder.sim_number || ""} onChange={(e) => setSelectedOrder({ ...selectedOrder, sim_number: e.target.value })} />
                  </div>
                </div>
                <div>
                  <Label>Notes internes</Label>
                  <Textarea value={selectedOrder.internal_notes || ""} onChange={(e) => setSelectedOrder({ ...selectedOrder, internal_notes: e.target.value })} rows={3} />
                </div>
                
                {/* Order Financial Summary */}
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
                    {selectedOrder.late_fee_amount > 0 && <div className="flex justify-between text-red-500"><span>Frais retard (5%):</span><span>{Number(selectedOrder.late_fee_amount).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span></div>}
                    <div className="flex justify-between font-bold text-lg border-t pt-2"><span>Total:</span><span>{Number(selectedOrder.total_amount || 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span></div>
                  </div>
                </div>

                {/* PDF Generation Buttons */}
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" onClick={() => handleGenerateInvoice(selectedOrder)}>
                    <Receipt className="w-4 h-4 mr-2" />
                    Générer Facture PDF
                  </Button>
                  <Button variant="outline" onClick={() => handleGenerateContract(selectedOrder)}>
                    <FilePlus className="w-4 h-4 mr-2" />
                    Générer Contrat PDF
                  </Button>
                </div>

                <Button className="w-full" onClick={() => { updateOrderMutation.mutate(selectedOrder); setOrderDetailsOpen(false); }}>
                  <Save className="w-4 h-4 mr-2" />
                  Enregistrer les modifications
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Invoice Details Dialog */}
        <Dialog open={invoiceDetailsOpen} onOpenChange={setInvoiceDetailsOpen}>
          <DialogContent className="max-w-2xl" onPointerDownOutside={(e) => e.preventDefault()} onClick={(e) => e.stopPropagation()}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-cyan-400" />
                Détails de la facture {selectedInvoice?.invoice_number}
              </DialogTitle>
            </DialogHeader>
            {selectedInvoice && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                  <div>
                    <Label className="text-xs text-muted-foreground">Date de création</Label>
                    <p className="font-medium">{format(new Date(selectedInvoice.created_at), "d MMM yyyy", { locale: fr })}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Date d'échéance</Label>
                    <p className="font-medium">{selectedInvoice.due_date ? format(new Date(selectedInvoice.due_date), "d MMM yyyy", { locale: fr }) : "—"}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Statut</Label>
                    <Badge className={statusColors[selectedInvoice.status] || statusColors.pending}>
                      {selectedInvoice.status === "paid" ? "Payé" : selectedInvoice.status === "overdue" ? "En retard" : "En attente"}
                    </Badge>
                  </div>
                  {selectedInvoice.related_order_number && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Commande liée</Label>
                      <p className="font-medium text-cyan-500">{selectedInvoice.related_order_number}</p>
                    </div>
                  )}
                </div>

                {/* Invoice Breakdown */}
                <div className="p-4 bg-muted/50 rounded-lg border border-border">
                  <Label className="text-sm font-medium mb-3 block">Détail de la facture</Label>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span>Sous-total:</span><span>{Number(selectedInvoice.subtotal || selectedInvoice.amount).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span></div>
                    {selectedInvoice.delivery_fee > 0 && <div className="flex justify-between"><span>Livraison:</span><span>{Number(selectedInvoice.delivery_fee).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span></div>}
                    {selectedInvoice.activation_fee > 0 && <div className="flex justify-between"><span>Activation:</span><span>{Number(selectedInvoice.activation_fee).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span></div>}
                    {selectedInvoice.installation_fee > 0 && <div className="flex justify-between"><span>Installation:</span><span>{Number(selectedInvoice.installation_fee).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span></div>}
                    {selectedInvoice.fees > 0 && <div className="flex justify-between"><span>Frais équipement:</span><span>{Number(selectedInvoice.fees).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span></div>}
                    {selectedInvoice.discount_amount > 0 && <div className="flex justify-between text-emerald-500"><span>Rabais:</span><span>-{Number(selectedInvoice.discount_amount).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span></div>}
                    <div className="flex justify-between"><span>TPS (5%):</span><span>{Number(selectedInvoice.tps_amount || 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span></div>
                    <div className="flex justify-between"><span>TVQ (9.975%):</span><span>{Number(selectedInvoice.tvq_amount || 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span></div>
                    {selectedInvoice.late_fee_amount > 0 && <div className="flex justify-between text-red-500"><span>Frais retard (5%):</span><span>{Number(selectedInvoice.late_fee_amount).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span></div>}
                    {selectedInvoice.credits > 0 && <div className="flex justify-between text-emerald-500"><span>Crédits appliqués:</span><span>-{Number(selectedInvoice.credits).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span></div>}
                    <div className="flex justify-between font-bold text-lg border-t pt-2"><span>Total:</span><span>{Number(selectedInvoice.amount).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span></div>
                  </div>
                </div>

                {selectedInvoice.payment_reference && (
                  <div className="p-4 bg-emerald-500/10 rounded-lg border border-emerald-500/30">
                    <Label className="text-xs text-muted-foreground">Référence de paiement</Label>
                    <p className="font-medium text-emerald-500">{selectedInvoice.payment_reference}</p>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Document Confirmation Dialog */}
        <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <DialogContent onPointerDownOutside={(e) => e.preventDefault()} onClick={(e) => e.stopPropagation()}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-500">
                <Trash2 className="w-5 h-5" />
                Supprimer le document
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p>Êtes-vous sûr de vouloir supprimer <strong>{documentToDelete?.document_name}</strong>?</p>
              <div>
                <Label>Raison de la suppression (admin log)</Label>
                <Textarea value={deleteDocumentReason} onChange={(e) => setDeleteDocumentReason(e.target.value)} placeholder="Raison..." rows={2} />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>Annuler</Button>
                <Button variant="destructive" onClick={() => deleteDocumentMutation.mutate({ docId: documentToDelete?.id, reason: deleteDocumentReason })}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Supprimer
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>

        {/* Payment Details Dialog */}
        <Dialog open={paymentDetailsOpen} onOpenChange={setPaymentDetailsOpen}>
          <DialogContent className="max-w-lg" onPointerDownOutside={(e) => e.preventDefault()} onClick={(e) => e.stopPropagation()}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-400" />
                Détails du paiement
              </DialogTitle>
            </DialogHeader>
            {selectedPayment && (
              <div className="space-y-4">
                <div className="p-4 bg-muted/50 rounded-lg border border-border">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Référence</Label>
                      <p className="font-bold text-cyan-500">{selectedPayment.payment_reference || selectedPayment.reference_number}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Montant</Label>
                      <p className="font-bold text-2xl text-emerald-500">{Number(selectedPayment.amount).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Date</Label>
                      <p className="font-medium">{format(new Date(selectedPayment.created_at), "d MMM yyyy HH:mm", { locale: fr })}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Méthode</Label>
                      <p className="font-medium">{selectedPayment.payment_method} {selectedPayment.card_last_four && `•••• ${selectedPayment.card_last_four}`}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Statut</Label>
                      <Badge className={statusColors[selectedPayment.status] || "bg-amber-500/20 text-amber-400"}>
                        {selectedPayment.status === "completed" ? "Complété" : selectedPayment.status === "pending" ? "En attente" : selectedPayment.status}
                      </Badge>
                    </div>
                    {selectedPayment.received_by && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Reçu par</Label>
                        <p className="font-medium">{selectedPayment.received_by}</p>
                      </div>
                    )}
                  </div>
                </div>

                {selectedPayment.notes && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Notes</Label>
                    <p className="text-sm text-muted-foreground">{selectedPayment.notes}</p>
                  </div>
                )}

                {/* Client Balance Impact */}
                <div className="p-4 bg-amber-500/10 rounded-lg border border-amber-500/30">
                  <Label className="text-sm font-medium mb-2 block">Impact sur le solde client</Label>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Solde actuel:</span>
                      <p className="font-bold text-amber-500">{Number(selectedClient?.balance || 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Après approbation:</span>
                      <p className="font-bold text-emerald-500">{Math.max(0, Number(selectedClient?.balance || 0) - Number(selectedPayment.amount)).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</p>
                    </div>
                  </div>
                </div>

                {selectedPayment.status !== "completed" && (
                  <Button 
                    className="w-full bg-emerald-600 hover:bg-emerald-700" 
                    onClick={() => approvePaymentMutation.mutate({ 
                      paymentId: selectedPayment.id, 
                      amount: Number(selectedPayment.amount) 
                    })}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Approuver et mettre à jour le solde
                  </Button>
                )}

                {selectedPayment.status === "completed" && (
                  <div className="p-4 bg-emerald-500/10 rounded-lg border border-emerald-500/30 text-center">
                    <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                    <p className="font-medium text-emerald-500">Ce paiement a été approuvé</p>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminClients;
