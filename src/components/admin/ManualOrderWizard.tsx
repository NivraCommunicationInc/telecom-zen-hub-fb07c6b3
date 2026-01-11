import { useState, useMemo, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Package, Plus, Minus, Truck, ShoppingCart, Loader2, ArrowRight, ArrowLeft,
  User, Check, CreditCard, Wifi, Smartphone, Tv, Shield, Calendar, Clock,
  FileText, AlertCircle, CheckCircle2, MapPin, Receipt, Wrench, MonitorPlay,
  Building2, Mail, Phone, UserPlus
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminClient as supabase } from "@/integrations/backend";
import { useToast } from "@/hooks/use-toast";
import { useActivityLog } from "@/hooks/useActivityLog";
import { useAuth } from "@/hooks/useAuth";
import { format, addDays } from "date-fns";
import { fr } from "date-fns/locale";
import { CreateClientDialog } from "./CreateClientDialog";
import { validateDob, getMaxDobDate, MIN_AGE_TELECOM, parseDate } from "@/lib/validation/dob";
import { AddressAutocomplete, AddressValue } from "@/components/shared/AddressAutocomplete";

// Constants
const TPS_RATE = 0.05;
const TVQ_RATE = 0.09975;
const DELIVERY_FEES = { standard: 30, uber: 45, shipHome: 15 };
const ACTIVATION_FEE = 25;
const INSTALLATION_FEE = 75;

// Service plans matching public website
const SERVICE_PLANS = {
  internet: [
    { id: "internet-100", name: "Internet 100 Mbps", price: 55, category: "Internet", description: "Parfait pour 1-2 utilisateurs" },
    { id: "internet-500", name: "Internet 500 Mbps", price: 60, category: "Internet", description: "Idéal pour familles" },
    { id: "internet-940", name: "Internet 940 Mbps", price: 70, category: "Internet", description: "Ultra rapide pour gamers/streamers" },
  ],
  mobile: [
    { id: "mobile-50", name: "Mobile 50$/30 jours", price: 50, category: "Mobile", data: "50-55 GB 4G", description: "50-55 GB données 4G" },
    { id: "mobile-60", name: "Mobile 60$/30 jours", price: 60, category: "Mobile", data: "75-80 GB 4G", description: "75-80 GB données 4G" },
  ],
  tv: [
    { id: "tv-basic", name: "Internet 100 + TV Basic", price: 75, category: "TV+Internet", channels: 26, freeChoices: 0 },
    { id: "tv-5choices", name: "Internet 500 + TV 5 choix", price: 80, category: "TV+Internet", channels: 32, freeChoices: 5 },
    { id: "tv-10choices", name: "Internet 500 + TV 10 choix", price: 90, category: "TV+Internet", channels: 37, freeChoices: 10 },
    { id: "tv-15choices", name: "Internet 500 + TV 15 choix", price: 95, category: "TV+Internet", channels: 42, freeChoices: 15 },
    { id: "tv-25choices", name: "Internet 500 + TV 25 choix", price: 110, category: "TV+Internet", channels: 52, freeChoices: 25 },
    { id: "giga-tv-basic", name: "GIGA + TV Basic", price: 85, category: "GIGA+TV", channels: 26, freeChoices: 0 },
    { id: "giga-tv-5choices", name: "GIGA + TV 5 choix", price: 95, category: "GIGA+TV", channels: 32, freeChoices: 5 },
    { id: "giga-tv-10choices", name: "GIGA + TV 10 choix", price: 105, category: "GIGA+TV", channels: 37, freeChoices: 10 },
    { id: "giga-tv-15choices", name: "GIGA + TV 15 choix", price: 110, category: "GIGA+TV", channels: 42, freeChoices: 15 },
    { id: "giga-tv-25choices", name: "GIGA + TV 25 choix", price: 120, category: "GIGA+TV", channels: 52, freeChoices: 25 },
  ],
  security: [
    { id: "security-basic", name: "Sécurité Basic", price: 29.99, category: "Sécurité", description: "Système d'alarme de base" },
    { id: "security-pro", name: "Sécurité Pro", price: 49.99, category: "Sécurité", description: "Caméras + Alarme" },
  ],
};

// Equipment configuration
const EQUIPMENT_CONFIG = {
  terminal: { name: "Nivra 4K Smart Terminal", price: 50, maxQuantity: 4 },
  router: { name: "Nivra Born Wifi Router", price: 60 },
  sim: { name: "Nivra SIM", price: 25 },
};

// E-Transfer statuses must match DB constraint exactly (case-sensitive)
const ETRANSFER_STATUSES = [
  { value: "Pending", label: "Pending" },
  { value: "In verification", label: "In verification" },
  { value: "Complete", label: "Complete" },
  { value: "Declined", label: "Declined" },
  { value: "Fraud", label: "Fraud" },
];

interface ManualOrderWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  preselectedClientId?: string;
}

interface OrderState {
  // Step 1: Client
  clientId: string;
  clientDob: string; // REQUIRED - Date of birth for the client (YYYY-MM-DD)
  // Step 2: Services
  selectedPlans: Array<{ plan: any; quantity: number }>;
  terminalQuantity: number;
  includeRouter: boolean;
  simType: "esim" | "physical" | null;
  // TV channels
  selectedFreeChannels: any[];
  selectedPaidChannels: any[];
  // Streaming add-ons
  selectedStreamingServices: any[];
  // Step 3: Delivery/Installation
  deliveryMethod: "standard" | "uber" | "shipHome" | null;
  installationType: "auto" | "technician";
  serviceAddress: string;
  serviceCity: string;
  serviceProvince: string;
  servicePostalCode: string;
  appointmentDate: string;
  appointmentTime: string;
  internalNotes: string;
  // Step 4: Payment
  paymentMethod: "card" | "etransfer";
  etransferStatus: string;
  // Promo
  promoCode: string;
  discountAmount: number;
}

const initialOrderState: OrderState = {
  clientId: "",
  clientDob: "", // REQUIRED - must be filled before order creation
  selectedPlans: [],
  terminalQuantity: 1,
  includeRouter: false,
  simType: null,
  selectedFreeChannels: [],
  selectedPaidChannels: [],
  selectedStreamingServices: [],
  deliveryMethod: "standard",
  installationType: "auto",
  serviceAddress: "",
  serviceCity: "",
  serviceProvince: "QC",
  servicePostalCode: "",
  appointmentDate: "",
  appointmentTime: "",
  internalNotes: "",
  paymentMethod: "card",
  etransferStatus: "Pending",
  promoCode: "",
  discountAmount: 0,
};

export default function ManualOrderWizard({
  open,
  onOpenChange,
  onSuccess,
  preselectedClientId,
}: ManualOrderWizardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { logActivity } = useActivityLog();
  const { user } = useAuth();

  const [step, setStep] = useState(1);
  const [orderState, setOrderState] = useState<OrderState>({
    ...initialOrderState,
    clientId: preselectedClientId || "",
  });
  const [serviceTab, setServiceTab] = useState("internet");
  const [createClientOpen, setCreateClientOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState("");

  // Fetch clients
  const { data: clients, isLoading: loadingClients } = useQuery({
    queryKey: ["admin-clients-order-wizard"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, email, full_name, phone, service_address, service_city, service_province, service_postal_code")
        .order("full_name");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch TV channels
  const { data: tvChannels } = useQuery({
    queryKey: ["tv-channels-wizard"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tv_channels")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch streaming services
  const { data: streamingServices } = useQuery({
    queryKey: ["streaming-services-wizard"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("streaming_services")
        .select("*")
        .eq("is_active", true)
        .order("monthly_price");
      if (error) throw error;
      return data || [];
    },
  });

  // Get selected client
  const selectedClient = useMemo(() => {
    return clients?.find((c) => c.user_id === orderState.clientId);
  }, [clients, orderState.clientId]);

  // Filter clients by search
  const filteredClients = useMemo(() => {
    if (!clients) return [];
    if (!clientSearch) return clients.slice(0, 20);
    const search = clientSearch.toLowerCase();
    return clients.filter(
      (c) =>
        c.full_name?.toLowerCase().includes(search) ||
        c.email?.toLowerCase().includes(search) ||
        c.phone?.includes(search)
    ).slice(0, 20);
  }, [clients, clientSearch]);

  // Calculate service category for the order
  const serviceCategory = useMemo(() => {
    const categories = orderState.selectedPlans.map((p) => p.plan.category);
    if (categories.some((c) => c.includes("TV"))) return "tv";
    if (categories.some((c) => c === "Internet")) return "internet";
    if (categories.some((c) => c === "Mobile")) return "mobile";
    if (categories.some((c) => c === "Sécurité")) return "security";
    return "bundle";
  }, [orderState.selectedPlans]);

  // Determine free channel count from TV plan
  const freeChannelCount = useMemo(() => {
    const tvPlan = orderState.selectedPlans.find((p) => 
      p.plan.category.includes("TV") || p.plan.category.includes("GIGA")
    );
    return tvPlan?.plan.freeChoices || 0;
  }, [orderState.selectedPlans]);

  // Separate base and free-choice channels
  const baseChannels = useMemo(() => {
    return tvChannels?.filter((ch: any) => ch.base_pack === "base") || [];
  }, [tvChannels]);

  const freeChoiceChannels = useMemo(() => {
    return tvChannels?.filter((ch: any) => !ch.base_pack || ch.base_pack === "free_choice") || [];
  }, [tvChannels]);

  const premiumChannels = useMemo(() => {
    return tvChannels?.filter((ch: any) => ch.base_pack === "premium" && ch.price > 0) || [];
  }, [tvChannels]);

  // Calculate totals
  const calculations = useMemo(() => {
    // Monthly recurring
    const planMonthly = orderState.selectedPlans.reduce(
      (sum, p) => sum + p.plan.price * p.quantity, 0
    );
    const streamingMonthly = orderState.selectedStreamingServices.reduce(
      (sum, s: any) => sum + Number(s.monthly_price), 0
    );
    const paidChannelsMonthly = orderState.selectedPaidChannels.reduce(
      (sum, ch: any) => sum + Number(ch.price || 0), 0
    );
    const totalMonthly = planMonthly + streamingMonthly + paidChannelsMonthly;

    // One-time fees
    const terminalFee = orderState.terminalQuantity * EQUIPMENT_CONFIG.terminal.price;
    const routerFee = orderState.includeRouter ? EQUIPMENT_CONFIG.router.price : 0;
    const simFee = orderState.simType ? EQUIPMENT_CONFIG.sim.price : 0;
    const deliveryFee = orderState.deliveryMethod ? DELIVERY_FEES[orderState.deliveryMethod] : 0;
    const activationFee = orderState.selectedPlans.length > 0 ? ACTIVATION_FEE : 0;
    const installationFee = orderState.installationType === "technician" ? INSTALLATION_FEE : 0;
    
    const subtotalOneTime = terminalFee + routerFee + simFee + deliveryFee + activationFee + installationFee;
    const discountAmount = orderState.discountAmount;
    const taxableAmount = subtotalOneTime - discountAmount;
    const tps = taxableAmount * TPS_RATE;
    const tvq = taxableAmount * TVQ_RATE;
    const totalOneTime = taxableAmount + tps + tvq;

    return {
      planMonthly,
      streamingMonthly,
      paidChannelsMonthly,
      totalMonthly,
      terminalFee,
      routerFee,
      simFee,
      deliveryFee,
      activationFee,
      installationFee,
      subtotalOneTime,
      discountAmount,
      tps,
      tvq,
      totalOneTime,
      payToday: totalOneTime,
    };
  }, [orderState]);

  // Handle client selection and prefill address
  const handleClientSelect = useCallback((clientId: string) => {
    const client = clients?.find((c) => c.user_id === clientId);
    setOrderState((prev) => ({
      ...prev,
      clientId,
      serviceAddress: client?.service_address || "",
      serviceCity: client?.service_city || "",
      serviceProvince: client?.service_province || "QC",
      servicePostalCode: client?.service_postal_code || "",
    }));
  }, [clients]);

  // Handle plan selection
  const togglePlan = (plan: any) => {
    setOrderState((prev) => {
      const existing = prev.selectedPlans.find((p) => p.plan.id === plan.id);
      if (existing) {
        return {
          ...prev,
          selectedPlans: prev.selectedPlans.filter((p) => p.plan.id !== plan.id),
        };
      }
      return {
        ...prev,
        selectedPlans: [...prev.selectedPlans, { plan, quantity: 1 }],
      };
    });
  };

  // Handle free channel selection
  const toggleFreeChannel = (channel: any) => {
    setOrderState((prev) => {
      const isSelected = prev.selectedFreeChannels.some((ch) => ch.id === channel.id);
      if (isSelected) {
        return {
          ...prev,
          selectedFreeChannels: prev.selectedFreeChannels.filter((ch) => ch.id !== channel.id),
        };
      }
      if (prev.selectedFreeChannels.length >= freeChannelCount) {
        toast({ title: "Limite atteinte", description: `Maximum ${freeChannelCount} chaînes gratuites`, variant: "destructive" });
        return prev;
      }
      return {
        ...prev,
        selectedFreeChannels: [...prev.selectedFreeChannels, channel],
      };
    });
  };

  // Handle paid channel selection
  const togglePaidChannel = (channel: any) => {
    setOrderState((prev) => {
      const isSelected = prev.selectedPaidChannels.some((ch) => ch.id === channel.id);
      if (isSelected) {
        return {
          ...prev,
          selectedPaidChannels: prev.selectedPaidChannels.filter((ch) => ch.id !== channel.id),
        };
      }
      return {
        ...prev,
        selectedPaidChannels: [...prev.selectedPaidChannels, channel],
      };
    });
  };

  // Handle streaming service selection
  const toggleStreamingService = (service: any) => {
    setOrderState((prev) => {
      const isSelected = prev.selectedStreamingServices.some((s: any) => s.id === service.id);
      if (isSelected) {
        return {
          ...prev,
          selectedStreamingServices: prev.selectedStreamingServices.filter((s: any) => s.id !== service.id),
        };
      }
      return {
        ...prev,
        selectedStreamingServices: [...prev.selectedStreamingServices, service],
      };
    });
  };

  // Create order mutation
  const createOrderMutation = useMutation({
    mutationFn: async () => {
      if (!orderState.clientId) throw new Error("Client requis");
      if (orderState.selectedPlans.length === 0) throw new Error("Sélectionnez au moins un service");
      
      // CRITICAL: Validate DOB before order creation (required by DB)
      if (!orderState.clientDob || !orderState.clientDob.trim()) {
        throw new Error("Date de naissance requise");
      }
      const parsedDob = parseDate(orderState.clientDob);
      if (!parsedDob) {
        throw new Error("Format de date de naissance invalide");
      }
      const dobResult = validateDob(orderState.clientDob, { minAge: MIN_AGE_TELECOM, required: true });
      if (!dobResult.isValid) {
        throw new Error(dobResult.error?.fr || "Date de naissance invalide");
      }

      const client = clients?.find((c) => c.user_id === orderState.clientId);
      const mainPlan = orderState.selectedPlans[0]?.plan;

      // Determine service type
      let serviceType = "bundle";
      if (mainPlan?.category === "Mobile") serviceType = "mobile";
      else if (mainPlan?.category === "Internet") serviceType = "internet";
      else if (mainPlan?.category.includes("TV")) serviceType = "tv";
      else if (mainPlan?.category === "Sécurité") serviceType = "security";

      // Build equipment details JSON
      const equipmentDetails = {
        terminals: orderState.terminalQuantity,
        router: orderState.includeRouter,
        sim_type: orderState.simType,
      };

      // Build selected channels JSON
      const selectedChannels = {
        base: baseChannels.map((ch: any) => ({ id: ch.id, name: ch.name })),
        free_choice: orderState.selectedFreeChannels.map((ch: any) => ({ id: ch.id, name: ch.name })),
        premium: orderState.selectedPaidChannels.map((ch: any) => ({ id: ch.id, name: ch.name, price: ch.price })),
      };

      // Create order - client_dob is REQUIRED (enforced by trigger + CHECK)
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          user_id: orderState.clientId,
          client_email: client?.email,
          client_dob: orderState.clientDob, // REQUIRED - never null
          service_type: serviceType,
          category: mainPlan?.category || serviceType,
          order_type: "service",
          status: "pending",
          payment_status: orderState.paymentMethod === "etransfer" ? orderState.etransferStatus : "pending",
          subtotal: calculations.planMonthly,
          delivery_fee: calculations.deliveryFee,
          activation_fee: calculations.activationFee,
          installation_fee: calculations.installationFee,
          terminal_fee: calculations.terminalFee,
          router_fee: calculations.routerFee,
          discount_amount: calculations.discountAmount,
          tps_amount: calculations.tps,
          tvq_amount: calculations.tvq,
          total_amount: calculations.totalOneTime,
          delivery_method: orderState.deliveryMethod === "uber" ? "Uber Express" : 
                          orderState.deliveryMethod === "shipHome" ? "Expédition domicile" : "Standard Québec",
          shipping_address: orderState.serviceAddress,
          shipping_city: orderState.serviceCity,
          shipping_province: orderState.serviceProvince,
          shipping_postal_code: orderState.servicePostalCode,
          installation_type: orderState.installationType,
          equipment_details: equipmentDetails,
          selected_channels: selectedChannels,
          terminal_count: orderState.terminalQuantity,
          sim_type: orderState.simType,
          payment_method: orderState.paymentMethod,
          etransfer_status: orderState.paymentMethod === "etransfer" ? orderState.etransferStatus : null,
          internal_notes: orderState.internalNotes || null,
          notes: `Admin order: ${orderState.selectedPlans.map((p) => p.plan.name).join(", ")}`,
          created_by: "admin",
          promo_code: orderState.promoCode || null,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create billing invoice
      const { error: billingError } = await supabase
        .from("billing")
        .insert({
          user_id: orderState.clientId,
          client_email: client?.email,
          order_id: order.id,
          related_order_number: order.order_number,
          amount: calculations.totalOneTime,
          subtotal: calculations.subtotalOneTime,
          delivery_fee: calculations.deliveryFee,
          activation_fee: calculations.activationFee,
          installation_fee: calculations.installationFee,
          discount_amount: calculations.discountAmount,
          tps_amount: calculations.tps,
          tvq_amount: calculations.tvq,
          status: orderState.paymentMethod === "etransfer" && orderState.etransferStatus === "Complete" ? "paid" : "pending",
          due_date: format(addDays(new Date(), 5), "yyyy-MM-dd"),
        });

      if (billingError) {
        console.error("Failed to create billing:", billingError);
      }

      // Create TV setup ticket if TV service included (non-blocking)
      const hasTVService = orderState.selectedPlans.some((p) => 
        p.plan.category.includes("TV") || p.plan.category.includes("GIGA")
      );

      if (hasTVService) {
        try {
          const { error: ticketError } = await supabase.from("support_tickets").insert({
            user_id: orderState.clientId,
            client_email: client?.email,
            subject: `Configuration TV - Commande ${order.order_number}`,
            description: `Configuration des chaînes TV pour la commande ${order.order_number}.\n\nChaînes sélectionnées:\n- Base: ${baseChannels.length} chaînes\n- Choix gratuits: ${orderState.selectedFreeChannels.length}/${freeChannelCount}\n- Premium: ${orderState.selectedPaidChannels.length}`,
            status: "open",
            priority: "high",
            category: "tv_setup",
            issue_type: "TV_CONFIGURATION",
            related_order_id: order.id,
            related_order_reference: order.order_number,
            created_by_role: "admin",
            created_by_user_id: user?.id,
            id_verification_status: "not_received",
          });
          if (ticketError) {
            console.error("TV ticket creation failed (non-blocking):", ticketError);
          }
        } catch (ticketErr) {
          console.error("TV ticket creation exception (non-blocking):", ticketErr);
        }
      }

      return order;
    },
    onSuccess: (order) => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin-billing"] });
      logActivity("create", "order", order.id, {
        order_number: order.order_number,
        service_type: order.service_type,
        total_amount: order.total_amount,
      }, {
        changedField: "order",
        reason: "Commande créée manuellement par admin",
      });
      toast({
        title: "Commande créée avec succès",
        description: `Commande #${order.order_number} créée avec facture associée`,
      });
      resetForm();
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: any) => {
      toast({
        title: "Erreur lors de la création",
        description: error.message || "Impossible de créer la commande",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setStep(1);
    setOrderState(initialOrderState);
    setServiceTab("internet");
    setClientSearch("");
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  // Step validation - DOB is required at step 1 before proceeding
  const isDobValid = useMemo(() => {
    if (!orderState.clientDob) return false;
    const result = validateDob(orderState.clientDob, { minAge: MIN_AGE_TELECOM, required: true });
    return result.isValid;
  }, [orderState.clientDob]);

  const canProceed = useMemo(() => {
    switch (step) {
      case 1: return !!orderState.clientId && isDobValid;
      case 2: return orderState.selectedPlans.length > 0;
      case 3: return !!orderState.deliveryMethod && !!orderState.serviceAddress;
      case 4: return true;
      default: return true;
    }
  }, [step, orderState, isDobValid]);

  // Render step content
  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">Sélectionner un client</h3>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setCreateClientOpen(true)}
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Nouveau client
              </Button>
            </div>

            <Input
              placeholder="Rechercher par nom, email ou téléphone..."
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
              className="mb-3"
            />

            <ScrollArea className="h-64 border rounded-md">
              {loadingClients ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : filteredClients.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  Aucun client trouvé
                </div>
              ) : (
                <div className="p-2 space-y-2">
                  {filteredClients.map((client) => (
                    <div
                      key={client.user_id}
                      className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        orderState.clientId === client.user_id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                      onClick={() => handleClientSelect(client.user_id)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{client.full_name || "Sans nom"}</p>
                          <p className="text-sm text-muted-foreground">{client.email}</p>
                          {client.phone && (
                            <p className="text-xs text-muted-foreground">{client.phone}</p>
                          )}
                        </div>
                        {orderState.clientId === client.user_id && (
                          <CheckCircle2 className="w-5 h-5 text-primary" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            {selectedClient && (
              <Card className="bg-muted/30">
                <CardContent className="p-4 space-y-4">
                  <div>
                    <p className="text-sm font-medium mb-2">Client sélectionné:</p>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                        <User className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold">{selectedClient.full_name}</p>
                        <p className="text-sm text-muted-foreground">{selectedClient.email}</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* REQUIRED: Date of Birth field */}
                  <div className="space-y-2 pt-2 border-t">
                    <Label className="flex items-center gap-2 font-medium">
                      <Calendar className="w-4 h-4" />
                      Date de naissance <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      type="date"
                      value={orderState.clientDob}
                      onChange={(e) => setOrderState((prev) => ({ ...prev, clientDob: e.target.value }))}
                      max={getMaxDobDate(MIN_AGE_TELECOM)}
                      className="w-full"
                    />
                    {orderState.clientDob && (() => {
                      const result = validateDob(orderState.clientDob, { minAge: MIN_AGE_TELECOM, required: true });
                      if (!result.isValid) {
                        return (
                          <p className="text-xs text-destructive flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            {result.error?.fr || "Date de naissance invalide"}
                          </p>
                        );
                      }
                      return (
                        <p className="text-xs text-emerald-500 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Âge vérifié (13+ ans)
                        </p>
                      );
                    })()}
                    {!orderState.clientDob && (
                      <p className="text-xs text-amber-500 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Requis pour créer une commande
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Package className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">Sélection des services</h3>
            </div>

            <Tabs value={serviceTab} onValueChange={setServiceTab}>
              <TabsList className="grid grid-cols-4 w-full">
                <TabsTrigger value="internet" className="flex items-center gap-1">
                  <Wifi className="w-4 h-4" /> Internet
                </TabsTrigger>
                <TabsTrigger value="mobile" className="flex items-center gap-1">
                  <Smartphone className="w-4 h-4" /> Mobile
                </TabsTrigger>
                <TabsTrigger value="tv" className="flex items-center gap-1">
                  <Tv className="w-4 h-4" /> TV
                </TabsTrigger>
                <TabsTrigger value="security" className="flex items-center gap-1">
                  <Shield className="w-4 h-4" /> Sécurité
                </TabsTrigger>
              </TabsList>

              <ScrollArea className="h-48 mt-3 border rounded-md p-2">
                {serviceTab === "internet" && (
                  <div className="space-y-2">
                    {SERVICE_PLANS.internet.map((plan) => {
                      const isSelected = orderState.selectedPlans.some((p) => p.plan.id === plan.id);
                      return (
                        <div
                          key={plan.id}
                          className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                            isSelected ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                          }`}
                          onClick={() => togglePlan(plan)}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{plan.name}</p>
                              <p className="text-xs text-muted-foreground">{plan.description}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold">${plan.price}/mois</span>
                              {isSelected && <Check className="w-4 h-4 text-primary" />}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {serviceTab === "mobile" && (
                  <div className="space-y-2">
                    {SERVICE_PLANS.mobile.map((plan) => {
                      const isSelected = orderState.selectedPlans.some((p) => p.plan.id === plan.id);
                      return (
                        <div
                          key={plan.id}
                          className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                            isSelected ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                          }`}
                          onClick={() => togglePlan(plan)}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{plan.name}</p>
                              <p className="text-xs text-muted-foreground">{plan.data}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold">${plan.price}/mois</span>
                              {isSelected && <Check className="w-4 h-4 text-primary" />}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {/* SIM Type selection for mobile */}
                    {orderState.selectedPlans.some((p) => p.plan.category === "Mobile") && (
                      <div className="mt-4 p-3 bg-muted/30 rounded-lg">
                        <Label className="text-sm font-medium mb-2 block">Type de SIM</Label>
                        <RadioGroup
                          value={orderState.simType || ""}
                          onValueChange={(v) => setOrderState((prev) => ({ ...prev, simType: v as any }))}
                          className="flex gap-4"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="esim" id="esim" />
                            <Label htmlFor="esim">eSIM (+$25)</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="physical" id="physical" />
                            <Label htmlFor="physical">SIM physique (+$25)</Label>
                          </div>
                        </RadioGroup>
                      </div>
                    )}
                  </div>
                )}

                {serviceTab === "tv" && (
                  <div className="space-y-2">
                    {SERVICE_PLANS.tv.map((plan) => {
                      const isSelected = orderState.selectedPlans.some((p) => p.plan.id === plan.id);
                      return (
                        <div
                          key={plan.id}
                          className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                            isSelected ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                          }`}
                          onClick={() => togglePlan(plan)}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{plan.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {plan.channels} chaînes • {plan.freeChoices} choix gratuits
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold">${plan.price}/mois</span>
                              {isSelected && <Check className="w-4 h-4 text-primary" />}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {serviceTab === "security" && (
                  <div className="space-y-2">
                    {SERVICE_PLANS.security.map((plan) => {
                      const isSelected = orderState.selectedPlans.some((p) => p.plan.id === plan.id);
                      return (
                        <div
                          key={plan.id}
                          className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                            isSelected ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                          }`}
                          onClick={() => togglePlan(plan)}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{plan.name}</p>
                              <p className="text-xs text-muted-foreground">{plan.description}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold">${plan.price}/mois</span>
                              {isSelected && <Check className="w-4 h-4 text-primary" />}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </Tabs>

            {/* Equipment section for TV/Internet */}
            {orderState.selectedPlans.some((p) => p.plan.category.includes("TV") || p.plan.category.includes("GIGA")) && (
              <div className="space-y-3 p-3 bg-muted/30 rounded-lg">
                <Label className="font-medium">Équipement TV</Label>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Terminaux 4K (${EQUIPMENT_CONFIG.terminal.price} chaque)</span>
                  <div className="flex items-center gap-2">
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-8 w-8"
                      onClick={() => setOrderState((prev) => ({
                        ...prev,
                        terminalQuantity: Math.max(1, prev.terminalQuantity - 1),
                      }))}
                      disabled={orderState.terminalQuantity <= 1}
                    >
                      <Minus className="w-3 h-3" />
                    </Button>
                    <span className="w-8 text-center font-medium">{orderState.terminalQuantity}</span>
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-8 w-8"
                      onClick={() => setOrderState((prev) => ({
                        ...prev,
                        terminalQuantity: Math.min(EQUIPMENT_CONFIG.terminal.maxQuantity, prev.terminalQuantity + 1),
                      }))}
                      disabled={orderState.terminalQuantity >= EQUIPMENT_CONFIG.terminal.maxQuantity}
                    >
                      <Plus className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Router for Internet */}
            {orderState.selectedPlans.some((p) => p.plan.category === "Internet") && (
              <div className="flex items-center space-x-3 p-3 bg-muted/30 rounded-lg">
                <Checkbox
                  checked={orderState.includeRouter}
                  onCheckedChange={(checked) => setOrderState((prev) => ({
                    ...prev,
                    includeRouter: !!checked,
                  }))}
                />
                <Label>Inclure routeur Wifi (${EQUIPMENT_CONFIG.router.price})</Label>
              </div>
            )}

            {/* TV Channel Selection */}
            {freeChannelCount > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="font-medium flex items-center gap-2">
                    <Tv className="w-4 h-4" />
                    Chaînes gratuites ({orderState.selectedFreeChannels.length}/{freeChannelCount})
                  </Label>
                </div>
                <ScrollArea className="h-32 border rounded-md p-2">
                  <div className="grid grid-cols-2 gap-2">
                    {freeChoiceChannels.map((ch: any) => {
                      const isSelected = orderState.selectedFreeChannels.some((c) => c.id === ch.id);
                      return (
                        <div
                          key={ch.id}
                          className={`p-2 rounded border cursor-pointer text-sm ${
                            isSelected ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                          }`}
                          onClick={() => toggleFreeChannel(ch)}
                        >
                          <span>{ch.name}</span>
                          {isSelected && <Check className="w-3 h-3 inline ml-2 text-primary" />}
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Premium Channels */}
            {premiumChannels.length > 0 && freeChannelCount > 0 && (
              <div className="space-y-3">
                <Label className="font-medium">Chaînes premium (payantes)</Label>
                <ScrollArea className="h-24 border rounded-md p-2">
                  <div className="grid grid-cols-2 gap-2">
                    {premiumChannels.map((ch: any) => {
                      const isSelected = orderState.selectedPaidChannels.some((c) => c.id === ch.id);
                      return (
                        <div
                          key={ch.id}
                          className={`p-2 rounded border cursor-pointer text-sm ${
                            isSelected ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                          }`}
                          onClick={() => togglePaidChannel(ch)}
                        >
                          <span>{ch.name}</span>
                          <span className="text-xs text-muted-foreground ml-1">(+${ch.price}/mois)</span>
                          {isSelected && <Check className="w-3 h-3 inline ml-1 text-primary" />}
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Streaming Services */}
            {streamingServices && streamingServices.length > 0 && (
              <div className="space-y-3">
                <Label className="font-medium flex items-center gap-2">
                  <MonitorPlay className="w-4 h-4" />
                  Streaming+ (optionnel)
                </Label>
                <ScrollArea className="h-24 border rounded-md p-2">
                  <div className="grid grid-cols-2 gap-2">
                    {streamingServices.map((service: any) => {
                      const isSelected = orderState.selectedStreamingServices.some((s: any) => s.id === service.id);
                      return (
                        <div
                          key={service.id}
                          className={`p-2 rounded border cursor-pointer text-sm ${
                            isSelected ? "border-cyan-500 bg-cyan-500/5" : "border-border hover:border-cyan-500/50"
                          }`}
                          onClick={() => toggleStreamingService(service)}
                        >
                          <span>{service.name}</span>
                          <span className="text-xs text-cyan-500 ml-1">(+${service.monthly_price}/mois)</span>
                          {isSelected && <Check className="w-3 h-3 inline ml-1 text-cyan-500" />}
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Selected services summary */}
            {orderState.selectedPlans.length > 0 && (
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="p-3">
                  <p className="text-sm font-medium mb-2">Services sélectionnés:</p>
                  <div className="flex flex-wrap gap-2">
                    {orderState.selectedPlans.map((p) => (
                      <Badge key={p.plan.id} variant="secondary">
                        {p.plan.name} - ${p.plan.price}/mois
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Truck className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">Livraison & Installation</h3>
            </div>

            {/* Delivery method */}
            <div className="space-y-3">
              <Label className="font-medium">Méthode de livraison</Label>
              <RadioGroup
                value={orderState.deliveryMethod || ""}
                onValueChange={(v) => setOrderState((prev) => ({ ...prev, deliveryMethod: v as any }))}
                className="space-y-2"
              >
                <div className={`p-3 rounded-lg border-2 cursor-pointer ${orderState.deliveryMethod === "standard" ? "border-primary bg-primary/5" : "border-border"}`}>
                  <div className="flex items-center space-x-3">
                    <RadioGroupItem value="standard" id="standard" />
                    <Label htmlFor="standard" className="flex-1 cursor-pointer">
                      <span className="font-medium">Livraison standard</span>
                      <span className="text-sm text-muted-foreground block">24-78h ouvrables • ${DELIVERY_FEES.standard}</span>
                    </Label>
                  </div>
                </div>
                <div className={`p-3 rounded-lg border-2 cursor-pointer ${orderState.deliveryMethod === "uber" ? "border-primary bg-primary/5" : "border-border"}`}>
                  <div className="flex items-center space-x-3">
                    <RadioGroupItem value="uber" id="uber" />
                    <Label htmlFor="uber" className="flex-1 cursor-pointer">
                      <span className="font-medium">Express Uber</span>
                      <span className="text-sm text-muted-foreground block">~10h • Montréal région • ${DELIVERY_FEES.uber}</span>
                    </Label>
                  </div>
                </div>
                <div className={`p-3 rounded-lg border-2 cursor-pointer ${orderState.deliveryMethod === "shipHome" ? "border-primary bg-primary/5" : "border-border"}`}>
                  <div className="flex items-center space-x-3">
                    <RadioGroupItem value="shipHome" id="shipHome" />
                    <Label htmlFor="shipHome" className="flex-1 cursor-pointer">
                      <span className="font-medium">Expédition postale</span>
                      <span className="text-sm text-muted-foreground block">3-5 jours • ${DELIVERY_FEES.shipHome}</span>
                    </Label>
                  </div>
                </div>
              </RadioGroup>
            </div>

            {/* Installation type */}
            <div className="space-y-3">
              <Label className="font-medium">Installation</Label>
              <RadioGroup
                value={orderState.installationType}
                onValueChange={(v) => setOrderState((prev) => ({ ...prev, installationType: v as any }))}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="auto" id="auto" />
                  <Label htmlFor="auto">Auto-installation (gratuit)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="technician" id="technician" />
                  <Label htmlFor="technician">Technicien (+${INSTALLATION_FEE})</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Service address */}
            <div className="space-y-3 p-3 bg-muted/30 rounded-lg">
              <Label className="font-medium flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Adresse de service
              </Label>
              <AddressAutocomplete
                value={orderState.serviceAddress}
                onValueChange={(value) => setOrderState((prev) => ({ ...prev, serviceAddress: value }))}
                onSelect={(details: AddressValue) => {
                  setOrderState((prev) => ({
                    ...prev,
                    serviceAddress: details.line1,
                    serviceCity: details.city || prev.serviceCity,
                    serviceProvince: details.region || "QC",
                    servicePostalCode: details.postalCode || prev.servicePostalCode,
                  }));
                }}
                placeholder="Rechercher une adresse..."
                restrictToQuebec={true}
              />
              <div className="grid grid-cols-3 gap-2">
                <Input
                  placeholder="Ville"
                  value={orderState.serviceCity}
                  onChange={(e) => setOrderState((prev) => ({ ...prev, serviceCity: e.target.value }))}
                />
                <Input
                  placeholder="Province"
                  value={orderState.serviceProvince}
                  disabled
                />
                <Input
                  placeholder="Code postal"
                  value={orderState.servicePostalCode}
                  onChange={(e) => setOrderState((prev) => ({ ...prev, servicePostalCode: e.target.value.toUpperCase() }))}
                />
              </div>
            </div>

            {/* Appointment for technician */}
            {orderState.installationType === "technician" && (
              <div className="space-y-3 p-3 bg-muted/30 rounded-lg">
                <Label className="font-medium flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Rendez-vous technicien
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    type="date"
                    value={orderState.appointmentDate}
                    min={format(addDays(new Date(), 1), "yyyy-MM-dd")}
                    onChange={(e) => setOrderState((prev) => ({ ...prev, appointmentDate: e.target.value }))}
                  />
                  <Select
                    value={orderState.appointmentTime}
                    onValueChange={(v) => setOrderState((prev) => ({ ...prev, appointmentTime: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Heure" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="9:00-12:00">9h - 12h</SelectItem>
                      <SelectItem value="12:00-15:00">12h - 15h</SelectItem>
                      <SelectItem value="15:00-18:00">15h - 18h</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Internal notes */}
            <div className="space-y-2">
              <Label>Notes internes</Label>
              <Textarea
                placeholder="Notes pour cette commande..."
                value={orderState.internalNotes}
                onChange={(e) => setOrderState((prev) => ({ ...prev, internalNotes: e.target.value }))}
                rows={2}
              />
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <CreditCard className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">Paiement</h3>
            </div>

            {/* Payment method */}
            <div className="space-y-3">
              <Label className="font-medium">Méthode de paiement</Label>
              <RadioGroup
                value={orderState.paymentMethod}
                onValueChange={(v) => setOrderState((prev) => ({ ...prev, paymentMethod: v as any }))}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="card" id="card" />
                  <Label htmlFor="card">Carte de crédit</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="etransfer" id="etransfer" />
                  <Label htmlFor="etransfer">e-Transfer</Label>
                </div>
              </RadioGroup>
            </div>

            {/* E-Transfer status */}
            {orderState.paymentMethod === "etransfer" && (
              <div className="space-y-3 p-3 bg-muted/30 rounded-lg">
                <Label className="font-medium">Statut e-Transfer</Label>
                <Select
                  value={orderState.etransferStatus}
                  onValueChange={(v) => setOrderState((prev) => ({ ...prev, etransferStatus: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ETRANSFER_STATUSES.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-sm">
                  <p className="font-medium text-amber-600 mb-1 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Règles prépayé e-Transfer
                  </p>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>• Facture générée J-5 avant le Bill Cycle</li>
                    <li>• Paiement dû avant J0 pour renouvellement</li>
                    <li>• Si "In verification" à J0: grâce 24h</li>
                    <li>• Non-paiement = non-renouvellement (pas de frais)</li>
                  </ul>
                </div>
              </div>
            )}

            {/* Promo code */}
            <div className="space-y-2">
              <Label>Code promo (optionnel)</Label>
              <Input
                placeholder="Entrer un code promo..."
                value={orderState.promoCode}
                onChange={(e) => setOrderState((prev) => ({ ...prev, promoCode: e.target.value.toUpperCase() }))}
              />
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Receipt className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">Résumé de la commande</h3>
            </div>

            {/* Client */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <User className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{selectedClient?.full_name}</p>
                    <p className="text-sm text-muted-foreground">{selectedClient?.email}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Monthly recurring */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Mensuel récurrent</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {orderState.selectedPlans.map((p) => (
                  <div key={p.plan.id} className="flex justify-between text-sm">
                    <span>{p.plan.name}</span>
                    <span>${p.plan.price.toFixed(2)}</span>
                  </div>
                ))}
                {orderState.selectedStreamingServices.map((s: any) => (
                  <div key={s.id} className="flex justify-between text-sm">
                    <span>{s.name}</span>
                    <span>${Number(s.monthly_price).toFixed(2)}</span>
                  </div>
                ))}
                {orderState.selectedPaidChannels.map((ch: any) => (
                  <div key={ch.id} className="flex justify-between text-sm">
                    <span>{ch.name}</span>
                    <span>${Number(ch.price).toFixed(2)}</span>
                  </div>
                ))}
                <Separator />
                <div className="flex justify-between font-medium">
                  <span>Total mensuel</span>
                  <span>${calculations.totalMonthly.toFixed(2)}/mois</span>
                </div>
              </CardContent>
            </Card>

            {/* One-time fees */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Frais uniques (à payer aujourd'hui)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {calculations.terminalFee > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Terminaux ({orderState.terminalQuantity}x)</span>
                    <span>${calculations.terminalFee.toFixed(2)}</span>
                  </div>
                )}
                {calculations.routerFee > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Routeur Wifi</span>
                    <span>${calculations.routerFee.toFixed(2)}</span>
                  </div>
                )}
                {calculations.simFee > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>SIM ({orderState.simType})</span>
                    <span>${calculations.simFee.toFixed(2)}</span>
                  </div>
                )}
                {calculations.deliveryFee > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Livraison</span>
                    <span>${calculations.deliveryFee.toFixed(2)}</span>
                  </div>
                )}
                {calculations.activationFee > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Frais d'activation</span>
                    <span>${calculations.activationFee.toFixed(2)}</span>
                  </div>
                )}
                {calculations.installationFee > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Installation technicien</span>
                    <span>${calculations.installationFee.toFixed(2)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Sous-total</span>
                  <span>${calculations.subtotalOneTime.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>TPS (5%)</span>
                  <span>${calculations.tps.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>TVQ (9.975%)</span>
                  <span>${calculations.tvq.toFixed(2)}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-bold text-lg">
                  <span>Total à payer</span>
                  <span className="text-primary">${calculations.payToday.toFixed(2)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Payment method info */}
            <div className="p-3 bg-muted/30 rounded-lg text-sm">
              <p className="flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                <strong>Paiement:</strong> {orderState.paymentMethod === "card" ? "Carte de crédit" : "e-Transfer"}
                {orderState.paymentMethod === "etransfer" && ` (${orderState.etransferStatus})`}
              </p>
              <p className="flex items-center gap-2 mt-1">
                <MapPin className="w-4 h-4" />
                <strong>Adresse:</strong> {orderState.serviceAddress}, {orderState.serviceCity}
              </p>
            </div>

            {/* TV Ticket notice */}
            {orderState.selectedPlans.some((p) => p.plan.category.includes("TV")) && (
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-sm">
                <p className="font-medium text-blue-600 flex items-center gap-2">
                  <Tv className="w-4 h-4" />
                  Ticket TV sera créé automatiquement
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  ETA configuration: 2h-24h après soumission
                </p>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  const stepLabels = [
    { num: 1, label: "Client" },
    { num: 2, label: "Services" },
    { num: 3, label: "Livraison" },
    { num: 4, label: "Paiement" },
    { num: 5, label: "Résumé" },
  ];

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-primary" />
              Nouvelle commande manuelle
            </DialogTitle>
          </DialogHeader>

          {/* Step indicator */}
          <div className="flex items-center justify-between px-4 py-2 bg-muted/30 rounded-lg">
            {stepLabels.map((s, idx) => (
              <div
                key={s.num}
                className={`flex items-center ${idx < stepLabels.length - 1 ? "flex-1" : ""}`}
              >
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors ${
                    step >= s.num
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {step > s.num ? <Check className="w-4 h-4" /> : s.num}
                </div>
                <span className={`ml-2 text-xs hidden sm:inline ${step >= s.num ? "text-foreground" : "text-muted-foreground"}`}>
                  {s.label}
                </span>
                {idx < stepLabels.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-3 ${step > s.num ? "bg-primary" : "bg-muted"}`} />
                )}
              </div>
            ))}
          </div>

          {/* Step content */}
          <ScrollArea className="flex-1 px-1">
            <div className="p-4">{renderStep()}</div>
          </ScrollArea>

          {/* Footer actions */}
          <div className="flex items-center justify-between pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => step > 1 ? setStep(step - 1) : handleOpenChange(false)}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              {step > 1 ? "Retour" : "Annuler"}
            </Button>

            {step < 5 ? (
              <Button onClick={() => setStep(step + 1)} disabled={!canProceed}>
                Continuer
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button 
                onClick={() => createOrderMutation.mutate()}
                disabled={createOrderMutation.isPending}
              >
                {createOrderMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Création...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Créer la commande
                  </>
                )}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Create client dialog */}
      <CreateClientDialog
        open={createClientOpen}
        onOpenChange={setCreateClientOpen}
        onSuccess={(clientData) => {
          setClientSearch("");
          handleClientSelect(clientData.user_id);
          queryClient.invalidateQueries({ queryKey: ["admin-clients-order-wizard"] });
        }}
      />
    </>
  );
}
