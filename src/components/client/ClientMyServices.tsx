import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useClientAuth } from "@/hooks/useClientAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { portalSupabase } from "@/integrations/supabase/portalClient";
import { 
  Wifi, Tv, Smartphone, Shield, Package, AlertTriangle, 
  ArrowUpCircle, Pause, RefreshCw, FileWarning, MessageSquare,
  Loader2, CheckCircle, Clock, BarChart3, CreditCard, DollarSign,
  Receipt, AlertCircle, CalendarIcon, History, Tag, Phone, ScanLine,
  Upload, Lock, Eye, ShieldCheck, FileText, MapPin, Building2,
  Crown, Star, Settings, Wrench, AlertOctagon, Info, Plus, MonitorPlay
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { usePortalActivityLog } from "@/hooks/usePortalActivityLog";

// Plans matching website exactly - DO NOT modify
const AVAILABLE_PLANS = {
  internet: [
    { id: "internet-100", name: "Internet 100 Mbps", price: 55, speed: "100 Mbps haute vitesse" },
    { id: "internet-500", name: "Internet 500 Mbps", price: 60, speed: "500 Mbps ultra-rapide" },
    { id: "internet-940", name: "Internet 940 Mbps", price: 70, speed: "940 Mbps fibre" },
  ],
  tv_bundles: [
    { id: "tv-basic", name: "Internet 100 + TV Basic", price: 75, description: "26 chaînes générales" },
    { id: "tv-5choices", name: "Internet 500 + TV 5 choix", price: 80, description: "32 chaînes populaires" },
    { id: "tv-10choices", name: "Internet 500 + TV 10 choix", price: 90, description: "37 chaînes + sports" },
    { id: "tv-15choices", name: "Internet 500 + TV 15 choix", price: 95, description: "42 chaînes + sports" },
    { id: "tv-25choices", name: "Internet 500 + TV 25 choix", price: 110, description: "52 chaînes + sports" },
    { id: "giga-tv-basic", name: "GIGA + TV Basic", price: 85, description: "Internet 1Gbps + 26 chaînes" },
    { id: "giga-tv-5choices", name: "GIGA + TV 5 choix", price: 95, description: "Internet 1Gbps + 32 chaînes" },
    { id: "giga-tv-10choices", name: "GIGA + TV 10 choix", price: 105, description: "Internet 1Gbps + 37 chaînes" },
    { id: "giga-tv-15choices", name: "GIGA + TV 15 choix", price: 110, description: "Internet 1Gbps + 42 chaînes" },
    { id: "giga-tv-25choices", name: "GIGA + TV 25 choix", price: 120, description: "Internet 1Gbps + 52 chaînes" },
  ],
  // Mobile plans - EXACTLY matching public website MobilePlans.tsx
  mobile: [
    { id: "mobile-50", name: "Forfait Mobile 50$/30 jours", price: 50, data: "50-55 GB 4G (avec/sans Auto Top-Up)" },
    { id: "mobile-60", name: "Forfait Mobile 60$/30 jours", price: 60, data: "75-80 GB 4G (avec/sans Auto Top-Up)" },
  ],
  // Streaming+ services
  streaming: [
    { id: "streaming-basic", name: "Streaming+ Basic", price: 9.99, description: "Accès de base aux contenus" },
    { id: "streaming-premium", name: "Streaming+ Premium", price: 14.99, description: "4K + Multi-écrans + Téléchargement" },
    { id: "streaming-family", name: "Streaming+ Famille", price: 19.99, description: "6 profils + Contrôle parental" },
  ],
};

const EQUIPMENT_ISSUE_TYPES = [
  { value: "defect", label: "Défaut de fabrication", warrantyPath: true },
  { value: "damaged", label: "Équipement endommagé", warrantyPath: true },
  { value: "stolen", label: "Équipement volé", warrantyPath: true },
  { value: "lost", label: "Équipement perdu", warrantyPath: true },
  { value: "return_rental", label: "Retour équipement de location", warrantyPath: false },
  { value: "not_returned", label: "Équipement non retourné (signaler)", warrantyPath: false },
];

const MOBILE_ISSUE_TYPES = [
  { value: "sim_stolen", label: "Carte SIM volée" },
  { value: "sim_lost", label: "Carte SIM perdue" },
  { value: "phone_lost", label: "Téléphone perdu" },
  { value: "request_new_sim", label: "Commander nouvelle SIM" },
  { value: "request_esim", label: "Commander eSIM" },
  { value: "number_change", label: "Demande changement de numéro" },
  { value: "pause_plan", label: "Suspendre le forfait (frais continuent)" },
];

const SERVICE_TAGS = [
  { value: "residential", label: "Résidentiel", color: "bg-blue-500/20 text-blue-500" },
  { value: "business", label: "Business", color: "bg-purple-500/20 text-purple-500" },
  { value: "multi_address", label: "Multi-adresse", color: "bg-amber-500/20 text-amber-500" },
  { value: "vip", label: "VIP", color: "bg-gradient-to-r from-yellow-500/20 to-amber-500/20 text-yellow-600" },
];

const SLA_TIERS = [
  { value: "standard", label: "Standard", icon: Settings },
  { value: "priority", label: "Priorité", icon: Star },
  { value: "vip", label: "VIP", icon: Crown },
];

// Quebec phone prefixes
const QC_VALID_PREFIXES = ["418", "367", "514", "263", "450", "579", "354", "819", "873", "468"];

const ClientMyServices = () => {
  const { user } = useClientAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { logActivity } = usePortalActivityLog();
  
  // Dialog states
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);
  const [issueDialogOpen, setIssueDialogOpen] = useState(false);
  const [mobileIssueDialogOpen, setMobileIssueDialogOpen] = useState(false);
  const [ticketDialogOpen, setTicketDialogOpen] = useState(false);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [suspensionDialogOpen, setSuspensionDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [numberChangeDialogOpen, setNumberChangeDialogOpen] = useState(false);
  const [simOrderDialogOpen, setSimOrderDialogOpen] = useState(false);
  const [documentUploadOpen, setDocumentUploadOpen] = useState(false);
  
  // Form states
  const [selectedService, setSelectedService] = useState<any>(null);
  const [selectedPlan, setSelectedPlan] = useState("");
  const [issueType, setIssueType] = useState("");
  const [issueDescription, setIssueDescription] = useState("");
  const [mobileIssueType, setMobileIssueType] = useState("");
  const [mobileIssueDescription, setMobileIssueDescription] = useState("");
  const [ticketSubject, setTicketSubject] = useState("");
  const [ticketDescription, setTicketDescription] = useState("");
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>();
  const [suspensionEndDate, setSuspensionEndDate] = useState<Date | undefined>();
  const [newPhoneNumber, setNewPhoneNumber] = useState("");
  const [phoneNumberError, setPhoneNumberError] = useState("");
  const [simType, setSimType] = useState<"sim" | "esim">("sim");
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);

  // Fetch subscriptions
  const { data: subscriptions, isLoading: loadingSubs } = useQuery({
    queryKey: ["client-services-subscriptions", user?.id],
    queryFn: async () => {
      const { data, error } = await portalSupabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Fetch orders with equipment - exclude cancelled from client view
  const { data: orders } = useQuery({
    queryKey: ["client-services-orders", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      // SECURITY: Always filter by user_id to prevent data leakage
      const { data, error } = await portalSupabase
        .from("orders")
        .select("*")
        .eq("user_id", user.id)
        .neq("status", "cancelled") // Exclude cancelled orders from client view
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Fetch tickets for message updates
  const { data: tickets } = useQuery({
    queryKey: ["client-services-tickets", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      // SECURITY: Always filter by user_id to prevent data leakage
      const { data, error } = await portalSupabase
        .from("support_tickets")
        .select("*, ticket_replies(*)")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Fetch profile for credit balance and province
  const { data: profile } = useQuery({
    queryKey: ["client-profile-credit", user?.id],
    queryFn: async () => {
      const { data, error } = await portalSupabase
        .from("profiles")
        .select("store_credit, balance, service_province, service_city")
        .eq("user_id", user?.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch billing/invoices for payment info and overdue status
  const { data: billingRecords } = useQuery({
    queryKey: ["client-billing-info", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      // SECURITY: Always filter by user_id to prevent data leakage
      const { data, error } = await portalSupabase
        .from("billing")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Fetch payments for last payment reference
  const { data: payments } = useQuery({
    queryKey: ["client-payments-info", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      // SECURITY: Always filter by user_id to prevent data leakage
      const { data, error } = await portalSupabase
        .from("payments")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Fetch client documents
  const { data: documents } = useQuery({
    queryKey: ["client-documents", user?.id],
    queryFn: async () => {
      const { data, error } = await portalSupabase
        .from("client_documents")
        .select("*")
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Create support ticket mutation
  const createTicketMutation = useMutation({
    mutationFn: async (ticketData: { 
      subject: string; 
      description: string; 
      priority?: string;
      relatedServiceId?: string;
      relatedEquipmentId?: string;
    }) => {
      const { data, error } = await portalSupabase
        .from("support_tickets")
        .insert({
          user_id: user?.id,
          subject: ticketData.subject,
          description: ticketData.description,
          priority: ticketData.priority || "normal",
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["client-services-tickets"] });
      // Log activity for admin visibility
      logActivity("create", "ticket", data.id, { 
        subject: data.subject,
        priority: data.priority,
        ticket_number: data.ticket_number 
      }, {
        changedField: "support_ticket",
        reason: data.subject
      });
      toast({ 
        title: "Ticket créé", 
        description: `Référence: ${data.ticket_number || data.id.slice(0, 8)}` 
      });
      setIssueDialogOpen(false);
      setMobileIssueDialogOpen(false);
      setTicketDialogOpen(false);
      setScheduleDialogOpen(false);
      setSuspensionDialogOpen(false);
      setNumberChangeDialogOpen(false);
      setSimOrderDialogOpen(false);
      resetForms();
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de créer le ticket", variant: "destructive" });
    },
  });

  // Request plan change/upgrade
  const requestPlanChangeMutation = useMutation({
    mutationFn: async (data: { currentPlan: string; newPlan: string; subscriptionId: string }) => {
      const { error } = await portalSupabase
        .from("support_tickets")
        .insert({
          user_id: user?.id,
          subject: `Demande de changement de forfait`,
          description: `Changement demandé:\n- Forfait actuel: ${data.currentPlan}\n- Nouveau forfait: ${data.newPlan}\n- ID abonnement: ${data.subscriptionId}`,
          priority: "normal",
        });
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["client-services-tickets"] });
      // Log activity for admin visibility
      logActivity("update", "subscription", variables.subscriptionId, { 
        current_plan: variables.currentPlan,
        new_plan: variables.newPlan 
      }, {
        changedField: "plan",
        oldValue: variables.currentPlan,
        newValue: variables.newPlan,
        reason: "Client demande de changement de forfait"
      });
      toast({ title: "Demande envoyée", description: "Notre équipe vous contactera sous peu" });
      setUpgradeDialogOpen(false);
      setSelectedPlan("");
    },
    onError: () => {
      toast({ title: "Erreur", variant: "destructive" });
    },
  });

  const resetForms = () => {
    setIssueType("");
    setIssueDescription("");
    setMobileIssueType("");
    setMobileIssueDescription("");
    setTicketSubject("");
    setTicketDescription("");
    setSelectedService(null);
    setScheduledDate(undefined);
    setSuspensionEndDate(undefined);
    setNewPhoneNumber("");
    setPhoneNumberError("");
  };

  // Validate Quebec phone number
  const validateQCPhoneNumber = (phone: string): boolean => {
    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length < 10) return false;
    const prefix = cleanPhone.substring(0, 3);
    return QC_VALID_PREFIXES.includes(prefix);
  };

  const handlePhoneNumberChange = (value: string) => {
    setNewPhoneNumber(value);
    if (value.length >= 3) {
      const cleanPhone = value.replace(/\D/g, "");
      const prefix = cleanPhone.substring(0, 3);
      if (!QC_VALID_PREFIXES.includes(prefix)) {
        setPhoneNumberError(`Préfixe ${prefix} non valide au Québec. Préfixes valides: 418/367, 514/263, 450/579/354, 819/873/468`);
      } else {
        setPhoneNumberError("");
      }
    }
  };

  const handleEquipmentIssue = () => {
    if (!issueType || !selectedService) return;
    const issueInfo = EQUIPMENT_ISSUE_TYPES.find(t => t.value === issueType);
    const warrantyNote = issueInfo?.warrantyPath 
      ? "\n\n[Chemin garantie: Remplacement sous garantie si applicable]" 
      : "";
    createTicketMutation.mutate({
      subject: `Problème équipement: ${issueInfo?.label}`,
      description: `Type de problème: ${issueInfo?.label}\nÉquipement: ${selectedService.service_type || selectedService.plan_name}\nCommande: ${selectedService.order_number || "N/A"}\n\nDétails: ${issueDescription || "Aucun détail fourni"}${warrantyNote}`,
      priority: issueType === "stolen" ? "high" : "normal",
      relatedEquipmentId: selectedService.equipment_id,
    });
  };

  const handleMobileIssue = () => {
    if (!mobileIssueType || !selectedService) return;
    const issueLabel = MOBILE_ISSUE_TYPES.find(t => t.value === mobileIssueType)?.label || mobileIssueType;
    
    let extraInfo = "";
    if (mobileIssueType === "request_new_sim" || mobileIssueType === "request_esim") {
      extraInfo = "\n\n[PAIEMENT REQUIS: 25$ avant activation]";
    }
    if (mobileIssueType === "sim_stolen" || mobileIssueType === "sim_lost") {
      extraInfo = "\n\n[Note: Remplacement SIM disponible - 25$ frais applicable]\n[Service reste actif, frais mensuels continuent]";
    }
    if (mobileIssueType === "number_change") {
      extraInfo = "\n\n[APPROBATION ADMIN requise]";
    }
    if (mobileIssueType === "pause_plan") {
      extraInfo = "\n\n[APPROBATION ADMIN requise]\n[Note: Les frais mensuels continuent pendant la suspension]";
    }
    
    createTicketMutation.mutate({
      subject: `Mobile: ${issueLabel}`,
      description: `Type de demande: ${issueLabel}\nForfait: ${selectedService.plan_name}\nID: ${selectedService.id}${extraInfo}\n\nDétails: ${mobileIssueDescription || "Aucun détail fourni"}`,
      priority: mobileIssueType.includes("stolen") ? "high" : "normal",
      relatedServiceId: selectedService.id,
    });
  };

  const handleScheduleActivation = () => {
    if (!scheduledDate || !selectedService) return;
    createTicketMutation.mutate({
      subject: `Activation différée programmée`,
      description: `Demande d'activation programmée:\n- Service: ${selectedService.plan_name}\n- Date souhaitée: ${format(scheduledDate, "d MMMM yyyy", { locale: fr })}\n- ID: ${selectedService.id}`,
      priority: "normal",
      relatedServiceId: selectedService.id,
    });
  };

  const handleSuspensionRequest = () => {
    if (!suspensionEndDate || !selectedService) return;
    createTicketMutation.mutate({
      subject: `Suspension temporaire programmée`,
      description: `Demande de suspension temporaire:\n- Service: ${selectedService.plan_name}\n- Suspendre jusqu'au: ${format(suspensionEndDate, "d MMMM yyyy", { locale: fr })}\n- ID: ${selectedService.id}\n\n[APPROBATION ADMIN requise]\n[Note: Les frais mensuels continuent pendant la suspension]`,
      priority: "normal",
      relatedServiceId: selectedService.id,
    });
  };

  const handleNumberChangeRequest = () => {
    if (!newPhoneNumber || phoneNumberError || !selectedService) return;
    createTicketMutation.mutate({
      subject: `Demande de changement de numéro`,
      description: `Demande de changement de numéro:\n- Forfait: ${selectedService.plan_name}\n- Nouveau numéro souhaité: ${newPhoneNumber}\n- ID: ${selectedService.id}\n\n[APPROBATION ADMIN requise]`,
      priority: "normal",
      relatedServiceId: selectedService.id,
    });
  };

  const handleSimOrder = () => {
    if (!selectedService) return;
    createTicketMutation.mutate({
      subject: `Commander ${simType === "esim" ? "eSIM" : "nouvelle SIM"} (25$)`,
      description: `Commande ${simType === "esim" ? "eSIM" : "carte SIM"}:\n- Forfait: ${selectedService.plan_name}\n- Type: ${simType.toUpperCase()}\n- Frais: 25,00 $ CAD\n- ID: ${selectedService.id}\n\n[PAIEMENT REQUIS: 25$ avant activation]\n[Frais appliqué automatiquement au prochain checkout]`,
      priority: "normal",
      relatedServiceId: selectedService.id,
    });
  };

  const getServiceIcon = (type: string) => {
    if (type?.toLowerCase().includes("streaming")) return MonitorPlay;
    if (type?.toLowerCase().includes("internet") || type?.toLowerCase().includes("fibre")) return Wifi;
    if (type?.toLowerCase().includes("tv") || type?.toLowerCase().includes("giga")) return Tv;
    if (type?.toLowerCase().includes("mobile")) return Smartphone;
    if (type?.toLowerCase().includes("security") || type?.toLowerCase().includes("sécurité")) return Shield;
    return Package;
  };

  const getServiceCategory = (planName: string) => {
    const name = planName?.toLowerCase() || "";
    if (name.includes("streaming")) return "streaming";
    if (name.includes("mobile")) return "mobile";
    if (name.includes("tv") || name.includes("giga")) return "tv";
    if (name.includes("internet") || name.includes("fibre")) return "internet";
    if (name.includes("security") || name.includes("sécurité")) return "security";
    return "other";
  };

  // Active subscriptions
  const activeSubscriptions = subscriptions?.filter((s: any) => s.status === "active" || s.status === "paused") || [];
  
  // Processed/completed orders that represent active services
  const activeOrderServices = orders?.filter((o: any) => 
    ["completed", "active", "installed", "delivered"].includes(o.status?.toLowerCase())
  ).map((order: any) => {
    const planInfo = getPlanInfoFromOrder(order);
    return {
      id: order.id,
      source: "order",
      order_number: order.order_number,
      plan_name: planInfo.name || order.service_type,
      amount: order.subtotal || order.total_amount || 0,
      billing_cycle: "monthly",
      status: order.status === "paused" ? "paused" : "active",
      service_type: order.service_type,
      category: order.category,
      created_at: order.created_at,
      data_allowance: planInfo.data,
      calls_allowance: planInfo.calls,
      texts_allowance: planInfo.texts,
      data_used: order.data_used || 0,
      equipment_details: order.equipment_details,
      selected_channels: order.selected_channels,
    };
  }) || [];

  // Combine subscriptions and order-based services
  const allActiveServices = [
    ...activeSubscriptions.map((s: any) => ({ ...s, source: "subscription" })),
    ...activeOrderServices,
  ];

  const mobileServices = allActiveServices.filter((s: any) => 
    getServiceCategory(s.plan_name || s.service_type) === "mobile"
  );
  
  // Equipment from orders - exclude cancelled orders
  const equipmentOrders = orders?.filter((o: any) => 
    o.status !== "cancelled" && (
      o.equipment_id || o.serial_number || o.imei_number || 
      (o.equipment_details && Array.isArray(o.equipment_details) && o.equipment_details.length > 0)
    )
  ) || [];

  // Billing calculations
  const lastPayment = payments?.[0];
  const overdueInvoices = billingRecords?.filter((b: any) => 
    b.status === "overdue" || (b.due_date && new Date(b.due_date) < new Date() && b.status !== "paid")
  ) || [];
  const clientCredit = Number(profile?.store_credit || 0);
  const accountBalance = Number(profile?.balance || 0);

  // Calculate split billing totals
  const billingTotals = billingRecords?.reduce((acc: any, b: any) => {
    acc.total += Number(b.amount || 0);
    acc.equipmentFees += Number(b.installation_fee || 0) + Number(b.activation_fee || 0);
    acc.overdue += b.status === "overdue" ? Number(b.amount || 0) : 0;
    acc.credits += Number(b.credits || 0);
    return acc;
  }, { total: 0, equipmentFees: 0, overdue: 0, credits: 0 }) || { total: 0, equipmentFees: 0, overdue: 0, credits: 0 };

  // Check if service is in Quebec
  const isQuebecService = profile?.service_province === "QC" || profile?.service_province === "Québec";

  function getPlanInfoFromOrder(order: any) {
    const serviceType = order.service_type?.toLowerCase() || "";
    const category = order.category?.toLowerCase() || "";
    
    if (serviceType.includes("mobile") || category === "mobile") {
      if (serviceType.includes("60") || order.subtotal === 60) {
        return { 
          name: "Mobile 60$/30 jours", 
          data: "75-80 GB 4G", 
          calls: "Appels illimités Canada/US",
          texts: "Textos illimités",
          dataGB: 80
        };
      }
      return { 
        name: "Mobile 50$/30 jours", 
        data: "50-55 GB 4G", 
        calls: "Appels illimités Canada/US",
        texts: "Textos illimités",
        dataGB: 55
      };
    }
    
    if (serviceType.includes("tv") && serviceType.includes("internet")) {
      if (serviceType.includes("25")) return { name: "TV 25 chaînes + Internet 500", speed: "500 Mbps", channels: 25 };
      if (serviceType.includes("15")) return { name: "TV 15 chaînes + Internet 500", speed: "500 Mbps", channels: 15 };
      if (serviceType.includes("10")) return { name: "TV 10 chaînes + Internet 500", speed: "500 Mbps", channels: 10 };
      if (serviceType.includes("5")) return { name: "TV 5 chaînes + Internet 500", speed: "500 Mbps", channels: 5 };
      if (serviceType.includes("giga") || serviceType.includes("basic")) return { name: "GIGA + TV Basic", speed: "1 Gbps", channels: "Base" };
      return { name: order.service_type, speed: "500 Mbps" };
    }
    
    if (serviceType.includes("internet") || serviceType.includes("fibre")) {
      if (serviceType.includes("1g") || serviceType.includes("fibre")) return { name: "Internet Fibre 1Gbps", speed: "1 Gbps fibre optique" };
      if (serviceType.includes("500")) return { name: "Internet Résidentiel 500", speed: "500 Mbps ultra-rapide" };
      return { name: "Internet Résidentiel 100", speed: "100 Mbps haute vitesse" };
    }
    
    if (serviceType.includes("tv")) return { name: order.service_type, channels: order.selected_channels?.length || 0 };
    
    return { name: order.service_type || "Service" };
  }

  return (
    <div className="space-y-6">
      {/* Province & Eligibility Notice */}
      {profile && (
        <div className="flex items-center gap-2 text-sm">
          <MapPin className="w-4 h-4 text-muted-foreground" />
          <span className="text-muted-foreground">Province: </span>
          <Badge variant="outline" className={isQuebecService ? "border-emerald-500 text-emerald-600" : "border-red-500 text-red-500"}>
            {profile.service_province || "Non défini"}
          </Badge>
          {!isQuebecService && (
            <span className="text-xs text-red-500">(Services limités au Québec uniquement)</span>
          )}
        </div>
      )}

      {/* Billing & Credit Summary Card */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Receipt className="w-4 h-4" />
            Facturation et crédits
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Crédit disponible</p>
              <p className="text-lg font-semibold text-emerald-500">
                {clientCredit.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
              </p>
            </div>
            
            <div>
              <p className="text-xs text-muted-foreground">Solde compte</p>
              <p className={`text-lg font-semibold ${accountBalance < 0 ? "text-red-500" : "text-foreground"}`}>
                {accountBalance.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
              </p>
            </div>
            
            <div>
              <p className="text-xs text-muted-foreground">Frais équipement</p>
              <p className="text-sm font-medium text-foreground">
                {billingTotals.equipmentFees.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
              </p>
            </div>
            
            <div>
              <p className="text-xs text-muted-foreground">En retard</p>
              {overdueInvoices.length > 0 ? (
                <div>
                  <p className="text-sm font-medium text-red-500">
                    {billingTotals.overdue.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                  </p>
                  <p className="text-xs text-red-400">+5% frais appliqué</p>
                </div>
              ) : (
                <p className="text-sm font-medium text-emerald-500">0,00 $</p>
              )}
            </div>
          </div>

          {/* Last Payment Reference */}
          {lastPayment && (
            <div className="mt-4 pt-4 border-t border-border">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Dernier paiement:</span>
                <span className="font-mono text-foreground">
                  {lastPayment.reference_number || lastPayment.payment_reference} 
                  <span className="text-muted-foreground ml-2">
                    ({Number(lastPayment.amount).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })})
                  </span>
                </span>
              </div>
            </div>
          )}

          {/* Partial Payment Indicator */}
          {billingRecords?.some((b: any) => b.status === "partial") && (
            <div className="mt-3 p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <p className="text-xs text-amber-600 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Paiement partiel détecté - solde restant affiché
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Security & Settings Row */}
      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-foreground">Authentification 2FA</span>
                <Switch 
                  checked={twoFactorEnabled} 
                  onCheckedChange={setTwoFactorEnabled}
                />
                <Badge variant="outline" className="text-xs">
                  {twoFactorEnabled ? "Activé" : "Désactivé"}
                </Badge>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setDocumentUploadOpen(true)}>
                <Upload className="w-4 h-4 mr-1" />
                Documents ({documents?.length || 0})
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <a href="/portal/tickets">
                  <Eye className="w-4 h-4 mr-1" />
                  Journal accès
                </a>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="services" className="w-full">
        <TabsList className="grid w-full grid-cols-6 mb-6">
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="streaming">Streaming</TabsTrigger>
          <TabsTrigger value="equipment">Équipements</TabsTrigger>
          <TabsTrigger value="mobile">Mobile</TabsTrigger>
          <TabsTrigger value="billing">Facturation</TabsTrigger>
          <TabsTrigger value="support">Support</TabsTrigger>
        </TabsList>

        {/* Active Services Tab */}
        <TabsContent value="services" className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-lg font-semibold text-foreground">Services actifs</h3>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setTicketDialogOpen(true)}>
                <MessageSquare className="w-4 h-4 mr-2" />
                Nouveau ticket
              </Button>
            </div>
          </div>

          {loadingSubs ? (
            <div className="space-y-3">
              {[1, 2].map(i => <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />)}
            </div>
          ) : allActiveServices.length > 0 ? (
            <div className="space-y-4">
              {allActiveServices.map((service: any) => {
                const Icon = getServiceIcon(service.plan_name || service.service_type);
                const category = getServiceCategory(service.plan_name || service.service_type);
                const isPaused = service.status === "paused";
                const isMobile = category === "mobile";
                
                return (
                  <Card key={service.id} className="bg-card border-border">
                    <CardContent className="p-4">
                      <div className="flex flex-col gap-4">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                          <div className="flex items-start gap-4">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                              isPaused ? "bg-amber-500/20" : "bg-cyan-500/20"
                            }`}>
                              <Icon className={`w-6 h-6 ${isPaused ? "text-amber-500" : "text-cyan-500"}`} />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-semibold text-foreground">{service.plan_name}</h4>
                                <Badge className="bg-emerald-500/20 text-emerald-500">Actif</Badge>
                                {isPaused && (
                                  <Badge className="bg-amber-500/20 text-amber-500">
                                    <Pause className="w-3 h-3 mr-1" />
                                    Suspendu
                                  </Badge>
                                )}
                                {service.source === "order" && (
                                  <span className="text-xs text-muted-foreground">
                                    #{service.order_number}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {Number(service.amount || 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}/
                                {service.billing_cycle === "monthly" ? "mois" : "an"}
                              </p>
                              
                              {/* Service Tags */}
                              <div className="flex gap-1 mt-2">
                                {SERVICE_TAGS.slice(0, 2).map(tag => (
                                  <Badge key={tag.value} variant="outline" className="text-xs">
                                    {tag.label}
                                  </Badge>
                                ))}
                              </div>

                              {/* SLA Tier */}
                              <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                                <ShieldCheck className="w-3 h-3" />
                                <span>SLA: Standard</span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex flex-col gap-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                setSelectedService(service);
                                setUpgradeDialogOpen(true);
                              }}
                            >
                              <ArrowUpCircle className="w-4 h-4 mr-1" />
                              Changer forfait
                            </Button>
                            
                            <div className="flex gap-1">
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => {
                                  setSelectedService(service);
                                  setScheduleDialogOpen(true);
                                }}
                              >
                                <CalendarIcon className="w-4 h-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => {
                                  setSelectedService(service);
                                  setSuspensionDialogOpen(true);
                                }}
                              >
                                <Pause className="w-4 h-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => {
                                  setSelectedService(service);
                                  setHistoryDialogOpen(true);
                                }}
                              >
                                <History className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>

                        {/* Mobile plan details */}
                        {isMobile && service.data_allowance && (
                          <div className="ml-16 grid grid-cols-3 gap-4 p-3 bg-muted/50 rounded-lg">
                            <div>
                              <p className="text-xs text-muted-foreground">Données</p>
                              <p className="text-sm font-medium text-foreground">{service.data_allowance}</p>
                              {service.data_used > 0 && (
                                <p className="text-xs text-cyan-500">{service.data_used} GB utilisés</p>
                              )}
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Appels</p>
                              <p className="text-sm font-medium text-foreground">{service.calls_allowance || "Illimités"}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Textos</p>
                              <p className="text-sm font-medium text-foreground">{service.texts_allowance || "Illimités"}</p>
                            </div>
                          </div>
                        )}

                        {/* TV channels info */}
                        {service.selected_channels && Array.isArray(service.selected_channels) && service.selected_channels.length > 0 && (
                          <div className="ml-16 p-3 bg-muted/50 rounded-lg">
                            <p className="text-xs text-muted-foreground mb-1">Chaînes ({service.selected_channels.length})</p>
                            <p className="text-sm text-foreground line-clamp-1">
                              {service.selected_channels.slice(0, 5).map((ch: any) => ch.name || ch).join(", ")}
                              {service.selected_channels.length > 5 && ` +${service.selected_channels.length - 5}`}
                            </p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="bg-card border-border">
              <CardContent className="p-8 text-center">
                <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Aucun service actif</p>
                <Button variant="hero" className="mt-4" asChild>
                  <a href="/portal/new-order">Commander un service</a>
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Streaming Tab */}
        <TabsContent value="streaming" className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-lg font-semibold text-foreground">Streaming+</h3>
            <Button variant="hero" size="sm" asChild>
              <a href="/portal/new-order">
                <Plus className="w-4 h-4 mr-2" />
                Ajouter un service streaming
              </a>
            </Button>
          </div>

          {/* Credit balance before paying reminder */}
          <Card className="bg-cyan-500/5 border-cyan-500/20">
            <CardContent className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-cyan-500" />
                <span className="text-sm text-foreground">Crédit disponible:</span>
                <span className="font-semibold text-cyan-500">
                  {clientCredit.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                </span>
              </div>
              <Badge variant="outline" className="text-xs">Applicable au prochain paiement</Badge>
            </CardContent>
          </Card>

          {/* Available Streaming Plans */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <MonitorPlay className="w-4 h-4 text-orange-500" />
                Offres Streaming+ disponibles
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {AVAILABLE_PLANS.streaming.map((plan) => (
                <div key={plan.id} className="flex items-center justify-between p-3 border border-border rounded-lg hover:border-cyan-500/50 transition-colors">
                  <div>
                    <p className="font-medium text-foreground">{plan.name}</p>
                    <p className="text-xs text-muted-foreground">{plan.description}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-foreground">{plan.price.toFixed(2)}$/mois</span>
                    <Button variant="outline" size="sm" asChild>
                      <a href="/portal/new-order">Souscrire</a>
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Active Streaming Subscriptions */}
          {allActiveServices.filter((s: any) => 
            (s.plan_name || s.service_type || "").toLowerCase().includes("streaming")
          ).length > 0 ? (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground">Mes abonnements actifs</h4>
              {allActiveServices
                .filter((s: any) => (s.plan_name || s.service_type || "").toLowerCase().includes("streaming"))
                .map((service: any) => (
                  <Card key={service.id} className="bg-card border-border">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
                            <MonitorPlay className="w-5 h-5 text-orange-500" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{service.plan_name || service.service_type}</p>
                            <p className="text-xs text-muted-foreground">
                              {Number(service.amount || 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}/mois
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className="bg-emerald-500/20 text-emerald-500">Actif</Badge>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => {
                              setSelectedService(service);
                              setTicketDialogOpen(true);
                              setTicketSubject("Problème tableau de bord Streaming");
                            }}
                          >
                            <AlertOctagon className="w-4 h-4 mr-1" />
                            Signaler problème
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          ) : (
            <Card className="bg-muted/30 border-dashed border-2 border-muted">
              <CardContent className="p-8 text-center">
                <MonitorPlay className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Aucun service streaming actif</p>
                <p className="text-sm text-muted-foreground mt-1">Sélectionnez une offre ci-dessus pour commencer</p>
              </CardContent>
            </Card>
          )}

          {/* Browser-only notice */}
          <Card className="bg-muted/50 border-border">
            <CardContent className="p-3 flex items-start gap-2">
              <Info className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <p className="text-xs text-muted-foreground">
                Streaming+ est accessible via navigateur web uniquement (aucune application mobile). 
                En cas de problème d'accès au tableau de bord, utilisez le bouton "Signaler problème" ci-dessus pour créer un ticket.
              </p>
            </CardContent>
          </Card>

          {/* Late fee warning for overdue streaming */}
          {overdueInvoices.some((inv: any) => 
            (inv.notes || "").toLowerCase().includes("streaming") || 
            (inv.related_order_number || "").toLowerCase().includes("streaming")
          ) && (
            <Card className="bg-red-500/10 border-red-500/30">
              <CardContent className="p-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-500" />
                <p className="text-sm text-red-600">
                  Paiement streaming en retard - 5% frais de retard appliqué automatiquement
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Equipment Tab */}
        <TabsContent value="equipment" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">Mes équipements</h3>
          </div>

          {equipmentOrders.length > 0 ? (
            <div className="space-y-4">
              <Card className="bg-emerald-500/5 border-emerald-500/20">
                <CardContent className="p-3 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                  <p className="text-sm text-emerald-600">Aucun problème d'équipement signalé</p>
                </CardContent>
              </Card>

              {equipmentOrders.map((order: any) => {
                const equipmentList = order.equipment_details && Array.isArray(order.equipment_details) 
                  ? order.equipment_details 
                  : [];
                
                const orderDate = new Date(order.created_at);
                const warrantyEnd = new Date(orderDate);
                warrantyEnd.setFullYear(warrantyEnd.getFullYear() + 1);
                const isUnderWarranty = new Date() < warrantyEnd;
                const isNearEndOfLife = new Date() > new Date(warrantyEnd.getTime() - 30 * 24 * 60 * 60 * 1000);

                const equipmentTypeName = order.service_type?.toLowerCase().includes("tv") 
                  ? "Nivra 4K Smart Terminal" 
                  : order.service_type?.toLowerCase().includes("internet") 
                  ? "Nivra Born Wifi Router" 
                  : order.service_type || "Équipement";

                return (
                  <Card key={order.id} className="bg-card border-border">
                    <CardContent className="p-4">
                      <div className="flex flex-col gap-4">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <Package className="w-5 h-5 text-cyan-500" />
                              <h4 className="font-semibold text-foreground">{equipmentTypeName}</h4>
                              <Badge className={isUnderWarranty ? "bg-emerald-500/20 text-emerald-500" : "bg-muted text-muted-foreground"}>
                                {isUnderWarranty ? "Sous garantie" : "Garantie expirée"}
                              </Badge>
                              {isNearEndOfLife && isUnderWarranty && (
                                <Badge className="bg-amber-500/20 text-amber-500">
                                  <AlertTriangle className="w-3 h-3 mr-1" />
                                  Fin de vie proche
                                </Badge>
                              )}
                            </div>
                            
                            <div className="space-y-1 text-sm">
                              <p className="text-muted-foreground">Commande: {order.order_number || order.id.slice(0, 8)}</p>
                              {order.equipment_id && <p className="text-muted-foreground">ID: {order.equipment_id}</p>}
                              {order.serial_number && <p className="text-muted-foreground">Série: {order.serial_number}</p>}
                              {order.imei_number && <p className="text-muted-foreground">IMEI: {order.imei_number}</p>}
                              {equipmentList.map((eq: any, idx: number) => (
                                <p key={idx} className="text-foreground">• {eq.name || eq}</p>
                              ))}
                            </div>
                            
                            <p className="text-xs text-muted-foreground mt-2">
                              Garantie fabricant: {format(warrantyEnd, "d MMM yyyy", { locale: fr })}
                            </p>

                            {/* Deposit tracking placeholder */}
                            <div className="mt-2 p-2 bg-muted/50 rounded text-xs">
                              <span className="text-muted-foreground">Dépôt équipement: </span>
                              <span className="text-foreground">0,00 $ (aucun dépôt requis)</span>
                            </div>
                          </div>
                          
                          <div className="flex flex-col gap-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                setSelectedService(order);
                                setIssueDialogOpen(true);
                              }}
                            >
                              <AlertTriangle className="w-4 h-4 mr-1" />
                              Signaler problème
                            </Button>
                            
                            {isNearEndOfLife && (
                              <Button variant="ghost" size="sm" className="text-amber-600">
                                <ArrowUpCircle className="w-4 h-4 mr-1" />
                                Mise à niveau
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="bg-card border-border">
              <CardContent className="p-8 text-center">
                <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Aucun équipement enregistré</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Mobile Tab */}
        <TabsContent value="mobile" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">Forfaits mobiles</h3>
          </div>

          {mobileServices.length > 0 ? (
            <div className="space-y-4">
              {mobileServices.map((service: any) => {
                const isPaused = service.status === "paused";
                
                return (
                  <Card key={service.id} className="bg-card border-border">
                    <CardContent className="p-4">
                      <div className="flex flex-col gap-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-4">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                              isPaused ? "bg-amber-500/20" : "bg-emerald-500/20"
                            }`}>
                              <Smartphone className={`w-6 h-6 ${isPaused ? "text-amber-500" : "text-emerald-500"}`} />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-semibold text-foreground">{service.plan_name}</h4>
                                {isPaused && <Badge className="bg-amber-500/20 text-amber-500">Suspendu</Badge>}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {Number(service.amount || 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}/30 jours
                              </p>
                              
                              {/* Data usage */}
                              {service.data_allowance && (
                                <div className="mt-2">
                                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                                    <span>Données utilisées</span>
                                    <span>{service.data_used || 0} GB / {service.data_allowance}</span>
                                  </div>
                                  <Progress value={(service.data_used || 0) / 80 * 100} className="h-2" />
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {/* Mobile Actions Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="text-amber-600"
                            onClick={() => {
                              setSelectedService(service);
                              setMobileIssueType("sim_stolen");
                              setMobileIssueDialogOpen(true);
                            }}
                          >
                            <FileWarning className="w-4 h-4 mr-1" />
                            SIM volée
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              setSelectedService(service);
                              setSimOrderDialogOpen(true);
                            }}
                          >
                            <ScanLine className="w-4 h-4 mr-1" />
                            Nouvelle SIM
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              setSelectedService(service);
                              setNumberChangeDialogOpen(true);
                            }}
                          >
                            <Phone className="w-4 h-4 mr-1" />
                            Changer #
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              setSelectedService(service);
                              setMobileIssueType("pause_plan");
                              setMobileIssueDialogOpen(true);
                            }}
                          >
                            <Pause className="w-4 h-4 mr-1" />
                            Suspendre
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="bg-card border-border">
              <CardContent className="p-8 text-center">
                <Smartphone className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Aucun forfait mobile actif</p>
                <Button variant="hero" className="mt-4" asChild>
                  <a href="/mobile-plans">Voir les forfaits</a>
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Billing Tab */}
        <TabsContent value="billing" className="space-y-4">
          <h3 className="text-lg font-semibold text-foreground">Détails facturation</h3>
          
          {/* Split Billing View */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card className="bg-card border-border">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground">Total facturé</p>
                <p className="text-xl font-bold text-foreground">
                  {billingTotals.total.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground">Frais équipement</p>
                <p className="text-xl font-bold text-foreground">
                  {billingTotals.equipmentFees.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground">Crédits appliqués</p>
                <p className="text-xl font-bold text-emerald-500">
                  -{billingTotals.credits.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                </p>
              </CardContent>
            </Card>
            <Card className={cn("border-border", billingTotals.overdue > 0 ? "bg-red-500/5" : "bg-card")}>
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground">En retard</p>
                <p className={`text-xl font-bold ${billingTotals.overdue > 0 ? "text-red-500" : "text-foreground"}`}>
                  {billingTotals.overdue.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Recent Invoices */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-sm">Factures récentes</CardTitle>
            </CardHeader>
            <CardContent>
              {billingRecords && billingRecords.length > 0 ? (
                <div className="space-y-2">
                  {billingRecords.slice(0, 5).map((invoice: any) => (
                    <div key={invoice.id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                      <div>
                        <p className="text-sm font-medium">{invoice.invoice_number || invoice.id.slice(0, 8)}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(invoice.created_at), "d MMM yyyy", { locale: fr })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">
                          {Number(invoice.amount).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                        </p>
                        <Badge className={
                          invoice.status === "paid" ? "bg-emerald-500/20 text-emerald-500" :
                          invoice.status === "overdue" ? "bg-red-500/20 text-red-500" :
                          invoice.status === "partial" ? "bg-amber-500/20 text-amber-500" :
                          "bg-muted text-muted-foreground"
                        }>
                          {invoice.status === "paid" ? "Payée" : 
                           invoice.status === "overdue" ? "En retard" :
                           invoice.status === "partial" ? "Partiel" : "En attente"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">Aucune facture</p>
              )}
            </CardContent>
          </Card>

          {/* Payment History */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-sm">Historique des paiements</CardTitle>
            </CardHeader>
            <CardContent>
              {payments && payments.length > 0 ? (
                <div className="space-y-2">
                  {payments.map((payment: any) => (
                    <div key={payment.id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                      <div>
                        <p className="text-sm font-mono">{payment.reference_number || payment.payment_reference}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(payment.created_at), "d MMM yyyy HH:mm", { locale: fr })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-emerald-500">
                          {Number(payment.amount).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                        </p>
                        <p className="text-xs text-muted-foreground">{payment.payment_method}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">Aucun paiement</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Support Tab */}
        <TabsContent value="support" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">Support & Tickets</h3>
            <Button variant="outline" size="sm" onClick={() => setTicketDialogOpen(true)}>
              <MessageSquare className="w-4 h-4 mr-2" />
              Nouveau ticket
            </Button>
          </div>

          {tickets && tickets.length > 0 ? (
            <div className="space-y-3">
              {tickets.map((ticket: any) => {
                const latestReply = ticket.ticket_replies?.sort((a: any, b: any) => 
                  new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                )[0];
                
                return (
                  <Card key={ticket.id} className="bg-card border-border">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-xs font-mono text-muted-foreground">
                              {ticket.ticket_number || ticket.id.slice(0, 8)}
                            </span>
                            <Badge className={
                              ticket.status === "open" ? "bg-cyan-500/20 text-cyan-500" :
                              ticket.status === "in_progress" ? "bg-amber-500/20 text-amber-500" :
                              "bg-muted text-muted-foreground"
                            }>
                              {ticket.status === "open" ? "Ouvert" : 
                               ticket.status === "in_progress" ? "En cours" : "Fermé"}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {ticket.priority === "high" ? "Haute" : 
                               ticket.priority === "urgent" ? "Urgent" : "Normal"}
                            </Badge>
                          </div>
                          <h4 className="font-medium text-foreground">{ticket.subject}</h4>
                          
                          {/* Full message history accordion */}
                          <Accordion type="single" collapsible className="mt-2">
                            <AccordionItem value="history" className="border-none">
                              <AccordionTrigger className="text-xs text-muted-foreground py-1 hover:no-underline">
                                Historique des messages ({ticket.ticket_replies?.length || 0})
                              </AccordionTrigger>
                              <AccordionContent>
                                <div className="space-y-2 mt-2">
                                  <div className="p-2 bg-muted/50 rounded text-sm">
                                    <p className="text-xs text-muted-foreground mb-1">Message initial</p>
                                    <p>{ticket.description}</p>
                                  </div>
                                  {ticket.ticket_replies?.map((reply: any) => (
                                    <div key={reply.id} className={cn(
                                      "p-2 rounded text-sm",
                                      reply.is_admin ? "bg-cyan-500/10" : "bg-muted/50"
                                    )}>
                                      <p className="text-xs text-muted-foreground mb-1">
                                        {reply.is_admin ? "Support" : "Vous"} - {format(new Date(reply.created_at), "d MMM HH:mm", { locale: fr })}
                                      </p>
                                      <p>{reply.content}</p>
                                    </div>
                                  ))}
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          </Accordion>
                          
                          <p className="text-xs text-muted-foreground mt-2">
                            <Clock className="w-3 h-3 inline mr-1" />
                            {format(new Date(ticket.updated_at), "d MMM yyyy 'à' HH:mm", { locale: fr })}
                          </p>
                        </div>
                        <Button variant="ghost" size="sm" asChild>
                          <a href="/portal/tickets">Voir</a>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="bg-card border-border">
              <CardContent className="p-8 text-center">
                <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Aucun ticket</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Schedule Activation Dialog */}
      <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Programmer l'activation</DialogTitle>
            <DialogDescription>
              Choisissez une date pour activer ce service.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>Service</Label>
              <p className="text-foreground font-medium">{selectedService?.plan_name}</p>
            </div>
            <div>
              <Label>Date d'activation souhaitée</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !scheduledDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {scheduledDate ? format(scheduledDate, "d MMMM yyyy", { locale: fr }) : "Choisir une date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={scheduledDate}
                    onSelect={setScheduledDate}
                    disabled={(date) => date < new Date()}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setScheduleDialogOpen(false)}>Annuler</Button>
            <Button variant="hero" onClick={handleScheduleActivation} disabled={!scheduledDate || createTicketMutation.isPending}>
              {createTicketMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Programmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Suspension Dialog */}
      <Dialog open={suspensionDialogOpen} onOpenChange={setSuspensionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspendre temporairement</DialogTitle>
            <DialogDescription>
              Demande d'approbation admin requise. Les frais mensuels continuent.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <p className="text-sm text-amber-600">
                <AlertTriangle className="w-4 h-4 inline mr-1" />
                Les frais mensuels continuent pendant la suspension.
              </p>
            </div>
            <div>
              <Label>Suspendre jusqu'au</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !suspensionEndDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {suspensionEndDate ? format(suspensionEndDate, "d MMMM yyyy", { locale: fr }) : "Choisir une date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={suspensionEndDate}
                    onSelect={setSuspensionEndDate}
                    disabled={(date) => date < new Date()}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setSuspensionDialogOpen(false)}>Annuler</Button>
            <Button variant="hero" onClick={handleSuspensionRequest} disabled={!suspensionEndDate || createTicketMutation.isPending}>
              {createTicketMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Demander suspension
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Historique des modifications</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-4">
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground">Création du service</p>
              <p className="text-sm">{selectedService?.plan_name}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {selectedService?.created_at && format(new Date(selectedService.created_at), "d MMM yyyy HH:mm", { locale: fr })}
              </p>
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Historique complet disponible prochainement
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHistoryDialogOpen(false)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Number Change Dialog */}
      <Dialog open={numberChangeDialogOpen} onOpenChange={setNumberChangeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Demande de changement de numéro</DialogTitle>
            <DialogDescription>
              Approbation admin requise. Numéros Québec uniquement.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>Nouveau numéro souhaité</Label>
              <Input
                placeholder="XXX-XXX-XXXX"
                value={newPhoneNumber}
                onChange={(e) => handlePhoneNumberChange(e.target.value)}
              />
              {phoneNumberError && (
                <p className="text-xs text-red-500 mt-1">{phoneNumberError}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Préfixes valides QC: 418/367, 514/263, 450/579/354, 819/873/468
              </p>
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setNumberChangeDialogOpen(false)}>Annuler</Button>
            <Button variant="hero" onClick={handleNumberChangeRequest} disabled={!newPhoneNumber || !!phoneNumberError || createTicketMutation.isPending}>
              {createTicketMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Soumettre demande
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SIM Order Dialog */}
      <Dialog open={simOrderDialogOpen} onOpenChange={setSimOrderDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Commander SIM/eSIM</DialogTitle>
            <DialogDescription>
              Paiement requis avant activation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <p className="text-sm text-amber-600">
                <Info className="w-4 h-4 inline mr-1" />
                Frais: <span className="font-bold">60,00 $</span> - Paiement requis avant activation.
              </p>
            </div>
            <div>
              <Label>Type de carte</Label>
              <Select value={simType} onValueChange={(v: "sim" | "esim") => setSimType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sim">Carte SIM physique (25$)</SelectItem>
                  <SelectItem value="esim">eSIM numérique (25$)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg text-sm">
              <p className="text-muted-foreground">
                La nouvelle SIM sera activée après réception du paiement. Vous recevrez une notification une fois activée.
              </p>
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setSimOrderDialogOpen(false)}>Annuler</Button>
            <Button variant="hero" onClick={handleSimOrder} disabled={createTicketMutation.isPending}>
              {createTicketMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Commander (25$)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Document Upload Dialog */}
      <Dialog open={documentUploadOpen} onOpenChange={setDocumentUploadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mes documents</DialogTitle>
            <DialogDescription>
              Documents de vérification et preuves.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {documents && documents.length > 0 ? (
              <div className="space-y-2">
                {documents.map((doc: any) => (
                  <div key={doc.id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">{doc.document_name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(doc.created_at), "d MMM yyyy", { locale: fr })}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">Aucun document</p>
            )}
            <div className="p-4 border-2 border-dashed border-border rounded-lg text-center">
              <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Téléversement disponible prochainement
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDocumentUploadOpen(false)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upgrade Dialog */}
      <Dialog open={upgradeDialogOpen} onOpenChange={setUpgradeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Changer de forfait</DialogTitle>
            <DialogDescription>
              Sélectionnez votre nouveau forfait.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>Forfait actuel</Label>
              <p className="text-foreground font-medium">{selectedService?.plan_name}</p>
            </div>
            <div>
              <Label>Nouveau forfait</Label>
              <Select value={selectedPlan} onValueChange={setSelectedPlan}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir un forfait" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="" disabled>Internet</SelectItem>
                  {AVAILABLE_PLANS.internet.map(plan => (
                    <SelectItem key={plan.id} value={plan.name}>
                      {plan.name} - {plan.price}$/mois
                    </SelectItem>
                  ))}
                  <SelectItem value="" disabled>TV + Internet</SelectItem>
                  {AVAILABLE_PLANS.tv_bundles.map(plan => (
                    <SelectItem key={plan.id} value={plan.name}>
                      {plan.name} - {plan.price}$/mois
                    </SelectItem>
                  ))}
                  <SelectItem value="" disabled>Mobile</SelectItem>
                  {AVAILABLE_PLANS.mobile.map(plan => (
                    <SelectItem key={plan.id} value={plan.name}>
                      {plan.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setUpgradeDialogOpen(false)}>Annuler</Button>
            <Button 
              variant="hero" 
              onClick={() => requestPlanChangeMutation.mutate({
                currentPlan: selectedService?.plan_name,
                newPlan: selectedPlan,
                subscriptionId: selectedService?.id,
              })}
              disabled={!selectedPlan || requestPlanChangeMutation.isPending}
            >
              {requestPlanChangeMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Demander le changement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Equipment Issue Dialog */}
      <Dialog open={issueDialogOpen} onOpenChange={setIssueDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Signaler un problème d'équipement</DialogTitle>
            <DialogDescription>
              Décrivez le problème. Remplacement sous garantie si applicable.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>Type de problème</Label>
              <Select value={issueType} onValueChange={setIssueType}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  {EQUIPMENT_ISSUE_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Détails</Label>
              <Textarea
                placeholder="Décrivez le problème..."
                value={issueDescription}
                onChange={(e) => setIssueDescription(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setIssueDialogOpen(false)}>Annuler</Button>
            <Button variant="hero" onClick={handleEquipmentIssue} disabled={!issueType || createTicketMutation.isPending}>
              {createTicketMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Soumettre
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mobile Issue Dialog */}
      <Dialog open={mobileIssueDialogOpen} onOpenChange={setMobileIssueDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gestion forfait mobile</DialogTitle>
            <DialogDescription>
              {mobileIssueType === "pause_plan" 
                ? "La suspension garde votre forfait actif. Les frais continuent."
                : "Décrivez votre demande."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>Type de demande</Label>
              <Select value={mobileIssueType} onValueChange={setMobileIssueType}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  {MOBILE_ISSUE_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {mobileIssueType === "pause_plan" && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <p className="text-sm text-amber-600">
                  <AlertTriangle className="w-4 h-4 inline mr-1" />
                  Les frais mensuels continuent pendant la suspension.
                </p>
              </div>
            )}
            <div>
              <Label>Détails</Label>
              <Textarea
                placeholder="Informations supplémentaires..."
                value={mobileIssueDescription}
                onChange={(e) => setMobileIssueDescription(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setMobileIssueDialogOpen(false)}>Annuler</Button>
            <Button variant="hero" onClick={handleMobileIssue} disabled={!mobileIssueType || createTicketMutation.isPending}>
              {createTicketMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Soumettre
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Ticket Dialog */}
      <Dialog open={ticketDialogOpen} onOpenChange={setTicketDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Créer un ticket de support</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>Sujet</Label>
              <Select value={ticketSubject} onValueChange={setTicketSubject}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir un sujet" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Question facturation">Question facturation</SelectItem>
                  <SelectItem value="Problème technique">Problème technique</SelectItem>
                  <SelectItem value="Demande installation">Demande installation</SelectItem>
                  <SelectItem value="Changement de forfait">Changement de forfait</SelectItem>
                  <SelectItem value="Autre demande">Autre demande</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                placeholder="Décrivez votre demande..."
                value={ticketDescription}
                onChange={(e) => setTicketDescription(e.target.value)}
                rows={5}
              />
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setTicketDialogOpen(false)}>Annuler</Button>
            <Button 
              variant="hero" 
              onClick={() => createTicketMutation.mutate({
                subject: ticketSubject,
                description: ticketDescription,
              })}
              disabled={!ticketSubject || !ticketDescription || createTicketMutation.isPending}
            >
              {createTicketMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Créer le ticket
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClientMyServices;
