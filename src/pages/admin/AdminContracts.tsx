import { useState, useEffect } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Download, Send, Plus, Eye, Trash2, RefreshCw, Package, User, CheckCircle, RotateCw, Wifi, Tv, Smartphone, Shield, Play, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { downloadTelecomContractPDF, viewTelecomContractPDF, type TelecomContractData } from "@/lib/pdfEngine";
import { BUSINESS_INFO, CONTRACT_TERMS } from "@/lib/contractPolicies";
import { ACTIVE_CONTRACT_TEMPLATE } from "@/lib/contractTemplate";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/useAuth";
import { useActivityLog } from "@/hooks/useActivityLog";

interface ContractFormData {
  user_id: string;
  contract_name: string;
  service_description: string;
  monthly_amount?: number;
  total_amount?: number;
  start_date: string;
  end_date?: string;
  duration_months?: number;
  notes?: string;
  employee_name: string;
  employee_title: string;
}

interface ActiveService {
  id: string;
  type: 'subscription' | 'order';
  serviceName: string;
  category: string;
  userId: string;
  clientName: string;
  clientEmail: string;
  clientNumber?: string;
  amount: number;
  status: string;
  createdAt: string;
  hasContract: boolean;
  profile: any;
  originalData: any;
}

const AdminContracts = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { logActivity } = useActivityLog();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);
  const [isRegenerateDialogOpen, setIsRegenerateDialogOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState<any>(null);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [formData, setFormData] = useState<ContractFormData>({
    user_id: "",
    contract_name: "",
    service_description: "",
    start_date: new Date().toISOString().split("T")[0],
    employee_name: "",
    employee_title: "Conseiller Télécom",
  });

  // Fetch ALL contracts with client profile data
  const { data: contracts, isLoading, refetch: refetchContracts } = useQuery({
    queryKey: ["admin-contracts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contracts")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      
      // Fetch profiles and linked orders separately for each contract
      const contractsWithProfiles = await Promise.all(
        (data || []).map(async (contract) => {
          const [profileResult, orderResult] = await Promise.all([
            supabase
              .from("profiles")
              .select("*")
              .eq("user_id", contract.user_id)
              .maybeSingle(),
            supabase
              .from("orders")
              .select("*, equipment_details, promo_code, discount_amount, preauth_discount")
              .eq("related_contract_id", contract.id)
              .maybeSingle(),
          ]);
          return { 
            ...contract, 
            profiles: profileResult.data,
            linkedOrder: orderResult.data,
          };
        })
      );
      
      return contractsWithProfiles;
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  // Fetch orders that need contracts (shipped/delivered with telecom plans)
  const { data: ordersNeedingContracts } = useQuery({
    queryKey: ["orders-needing-contracts"],
    queryFn: async () => {
      const { data: orders, error } = await supabase
        .from("orders")
        .select("*")
        .in("status", ["shipped", "delivered"])
        .is("related_contract_id", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      
      // Filter for telecom plans (Internet, TV, Mobile with SIM)
      const telecomOrders = (orders || []).filter(order => {
        const serviceType = order.service_type?.toLowerCase() || "";
        const hasTelecom = serviceType.includes("internet") || 
                          serviceType.includes("tv") || 
                          serviceType.includes("mobile") ||
                          serviceType.includes("giga");
        return hasTelecom;
      });
      
      // Get profiles for these orders
      const ordersWithProfiles = await Promise.all(
        telecomOrders.map(async (order) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("*")
            .eq("user_id", order.user_id)
            .maybeSingle();
          return { ...order, profile };
        })
      );
      
      return ordersWithProfiles;
    },
    staleTime: 30000,
  });

  // Fetch ALL active services for contract regeneration
  const { data: activeServices, refetch: refetchActiveServices } = useQuery({
    queryKey: ["active-services-for-contracts"],
    queryFn: async () => {
      const services: ActiveService[] = [];
      
      // Get active subscriptions
      const { data: subscriptions } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("status", "active");
      
      // Get completed/delivered orders
      const { data: orders } = await supabase
        .from("orders")
        .select("*")
        .in("status", ["completed", "delivered", "active", "shipped"]);
      
      // Get existing contracts to check which services already have one
      const { data: existingContracts } = await supabase
        .from("contracts")
        .select("user_id, contract_name");
      
      // Get all profiles for these users
      const userIds = [
        ...(subscriptions || []).map(s => s.user_id),
        ...(orders || []).map(o => o.user_id)
      ];
      const uniqueUserIds = [...new Set(userIds)];
      
      const { data: profiles } = await supabase
        .from("profiles")
        .select("*")
        .in("user_id", uniqueUserIds);
      
      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
      
      // Process subscriptions
      for (const sub of subscriptions || []) {
        const profile = profileMap.get(sub.user_id);
        const hasContract = existingContracts?.some(
          c => c.user_id === sub.user_id && c.contract_name.toLowerCase().includes(sub.plan_name.toLowerCase())
        ) || false;
        
        // Determine category from plan name
        let category = "Télécom";
        const planLower = sub.plan_name.toLowerCase();
        if (planLower.includes("internet") || planLower.includes("giga") || planLower.includes("fibre")) category = "Internet";
        else if (planLower.includes("tv") || planLower.includes("télé")) category = "TV";
        else if (planLower.includes("mobile") || planLower.includes("cellulaire")) category = "Mobile";
        else if (planLower.includes("sécurité") || planLower.includes("security")) category = "Sécurité";
        else if (planLower.includes("streaming") || planLower.includes("netflix") || planLower.includes("disney")) category = "Streaming";
        
        services.push({
          id: `sub-${sub.id}`,
          type: 'subscription',
          serviceName: sub.plan_name,
          category,
          userId: sub.user_id,
          clientName: profile?.full_name || profile?.email || "N/A",
          clientEmail: profile?.email || "",
          clientNumber: profile?.client_number,
          amount: sub.amount,
          status: sub.status,
          createdAt: sub.created_at,
          hasContract,
          profile,
          originalData: sub,
        });
      }
      
      // Process orders
      for (const order of orders || []) {
        const profile = profileMap.get(order.user_id);
        const hasContract = order.related_contract_id != null || existingContracts?.some(
          c => c.user_id === order.user_id && c.contract_name.toLowerCase().includes(order.service_type.toLowerCase())
        ) || false;
        
        // Determine category from service type
        let category = "Télécom";
        const serviceTypeLower = order.service_type.toLowerCase();
        if (serviceTypeLower.includes("internet") || serviceTypeLower.includes("giga") || serviceTypeLower.includes("fibre")) category = "Internet";
        else if (serviceTypeLower.includes("tv") || serviceTypeLower.includes("télé") || serviceTypeLower.includes("bundle")) category = "TV + Internet";
        else if (serviceTypeLower.includes("mobile") || serviceTypeLower.includes("cellulaire") || serviceTypeLower.includes("sim")) category = "Mobile";
        else if (serviceTypeLower.includes("sécurité") || serviceTypeLower.includes("security")) category = "Sécurité";
        else if (serviceTypeLower.includes("streaming")) category = "Streaming";
        
        services.push({
          id: `ord-${order.id}`,
          type: 'order',
          serviceName: order.service_type,
          category,
          userId: order.user_id,
          clientName: profile?.full_name || order.client_email || "N/A",
          clientEmail: profile?.email || order.client_email || "",
          clientNumber: profile?.client_number,
          amount: order.total_amount || 0,
          status: order.status,
          createdAt: order.created_at,
          hasContract,
          profile,
          originalData: order,
        });
      }
      
      return services;
    },
    staleTime: 30000,
  });

  const { data: clients } = useQuery({
    queryKey: ["admin-clients-for-contracts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, email, full_name, phone, client_number, service_address, service_city, service_province, service_postal_code, id_type, id_number, id_province, id_expiration")
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  // Real-time subscription for contracts
  useEffect(() => {
    const channel = supabase
      .channel('admin-contracts-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contracts' }, () => {
        refetchContracts();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [refetchContracts]);

  // Auto-generate contract for an order
  const generateContractForOrderMutation = useMutation({
    mutationFn: async (order: any) => {
      const profile = order.profile;
      const contractNumber = `CTR-${Date.now().toString(36).toUpperCase()}`;
      
      // Create contract in database
      const { data: newContract, error } = await supabase
        .from("contracts")
        .insert({
          user_id: order.user_id,
          contract_name: `Contrat de services - ${order.service_type}`,
          contract_url: contractNumber,
          contract_number: contractNumber,
          is_signed: false,
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // Link contract to order
      await supabase
        .from("orders")
        .update({ related_contract_id: newContract.id })
        .eq("id", order.id);
      
      return { contract: newContract, order, profile };
    },
    onSuccess: (data) => {
      toast.success(`Contrat ${data.contract.contract_number} généré pour la commande ${data.order.order_number}`);
      queryClient.invalidateQueries({ queryKey: ["admin-contracts"] });
      queryClient.invalidateQueries({ queryKey: ["orders-needing-contracts"] });
    },
    onError: (error) => {
      console.error(error);
      toast.error("Erreur lors de la génération du contrat");
    },
  });

  const createContractMutation = useMutation({
    mutationFn: async (data: ContractFormData) => {
      const contractNumber = `CTR-${Date.now().toString(36).toUpperCase()}`;
      const { error } = await supabase.from("contracts").insert({
        user_id: data.user_id,
        contract_name: data.contract_name,
        contract_url: contractNumber,
        contract_number: contractNumber,
        is_signed: false,
      });
      if (error) throw error;
      return { ...data, contractNumber };
    },
    onSuccess: () => {
      toast.success("Contrat créé avec succès");
      queryClient.invalidateQueries({ queryKey: ["admin-contracts"] });
      setIsCreateDialogOpen(false);
      resetForm();
    },
    onError: () => {
      toast.error("Erreur lors de la création du contrat");
    },
  });

  const deleteContractMutation = useMutation({
    mutationFn: async (contractId: string) => {
      const { error } = await supabase.from("contracts").delete().eq("id", contractId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Contrat supprimé");
      queryClient.invalidateQueries({ queryKey: ["admin-contracts"] });
    },
    onError: () => {
      toast.error("Erreur lors de la suppression");
    },
  });

  // Regenerate contracts for active services
  const regenerateContractsMutation = useMutation({
    mutationFn: async (serviceIds: string[]) => {
      const results: { success: string[]; failed: string[] } = { success: [], failed: [] };
      
      for (const serviceId of serviceIds) {
        const service = activeServices?.find(s => s.id === serviceId);
        if (!service) continue;
        
        try {
          const contractNumber = `CTR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
          const profile = service.profile;
          
          // Build contract name with service details
          const contractName = `Contrat ${service.category} - ${service.serviceName}`;
          
          // Create contract
          const { data: newContract, error } = await supabase
            .from("contracts")
            .insert({
              user_id: service.userId,
              contract_name: contractName,
              contract_url: contractNumber,
              contract_number: contractNumber,
              is_signed: false,
            })
            .select()
            .single();
          
          if (error) throw error;
          
          // If it's an order, link the contract
          if (service.type === 'order') {
            const orderId = serviceId.replace('ord-', '');
            await supabase
              .from("orders")
              .update({ related_contract_id: newContract.id })
              .eq("id", orderId);
          }
          
          results.success.push(service.serviceName);
        } catch (err) {
          console.error(`Failed to generate contract for ${service.serviceName}:`, err);
          results.failed.push(service.serviceName);
        }
      }
      
      return results;
    },
    onSuccess: (results) => {
      if (results.success.length > 0) {
        toast.success(`${results.success.length} contrat(s) généré(s) avec succès`);
      }
      if (results.failed.length > 0) {
        toast.error(`${results.failed.length} contrat(s) ont échoué`);
      }
      queryClient.invalidateQueries({ queryKey: ["admin-contracts"] });
      queryClient.invalidateQueries({ queryKey: ["active-services-for-contracts"] });
      queryClient.invalidateQueries({ queryKey: ["orders-needing-contracts"] });
      setIsRegenerateDialogOpen(false);
      setSelectedServices([]);
    },
    onError: () => {
      toast.error("Erreur lors de la régénération des contrats");
    },
  });

  const markAsSignedMutation = useMutation({
    mutationFn: async (contract: any) => {
      const signedAt = new Date().toISOString();
      const { error } = await supabase
        .from("contracts")
        .update({ is_signed: true, signed_at: signedAt })
        .eq("id", contract.id);
      if (error) throw error;
      return { contract, signedAt };
    },
    onSuccess: async (data) => {
      const { contract, signedAt } = data;
      const client = contract.profiles;
      
      // Log the signature activity (Admin marking as signed)
      await logActivity(
        "Signed",
        "contract",
        contract.id,
        {
          signedAt,
          signatureActor: "Admin",
          adminEmail: user?.email,
          clientName: client?.full_name || "N/A",
          clientEmail: client?.email || "N/A",
          contractName: contract.contract_name,
          contractNumber: contract.contract_number || contract.contract_url,
        },
        {
          changedField: "is_signed",
          oldValue: "false",
          newValue: "true",
        }
      );
      
      toast.success("Contrat marqué comme signé");
      queryClient.invalidateQueries({ queryKey: ["admin-contracts"] });
      setIsPreviewDialogOpen(false);
    },
    onError: () => {
      toast.error("Erreur lors de la mise à jour");
    },
  });

  const resetForm = () => {
    setFormData({
      user_id: "",
      contract_name: "",
      service_description: "",
      start_date: new Date().toISOString().split("T")[0],
      employee_name: "",
      employee_title: "Conseiller Télécom",
    });
  };

  const buildContractData = (contract: any): TelecomContractData => {
    const client = contract.profiles;
    const linkedOrder = contract.linkedOrder;
    const fullName = client?.full_name || "Client";
    const nameParts = fullName.split(" ");
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";
    
    // Get equipment details from linked order if available
    const equipmentDetails = linkedOrder?.equipment_details;
    
    return {
      contractId: contract.id,
      templateId: (contract as any).template_id || ACTIVE_CONTRACT_TEMPLATE.id,
      templateVersion: (contract as any).template_version || ACTIVE_CONTRACT_TEMPLATE.version,

      contractNumber: contract.contract_number || contract.contract_url || `NVR-CSA-QC-2026-${contract.id.slice(0, 5).toUpperCase()}`,
      clientFirstName: firstName,
      clientLastName: lastName,
      clientName: fullName,
      clientEmail: client?.email || "",
      clientPhone: client?.phone,
      clientAccountNumber: client?.client_number,
      serviceAddress: client?.service_address,
      serviceCity: client?.service_city,
      serviceProvince: client?.service_province || "QC",
      servicePostalCode: client?.service_postal_code,
      idType: client?.id_type,
      idNumber: client?.id_number,
      idProvince: client?.id_province,
      idExpiration: client?.id_expiration,
      orderDate: linkedOrder?.created_at || contract.created_at,
      orderReference: linkedOrder?.order_number,
      servicePlan: contract.contract_name,
      
      // Fees from linked order
      activationFee: Number(linkedOrder?.activation_fee ?? 0),
      deliveryFee: Number(linkedOrder?.delivery_fee ?? 0),
      installationFee: Number(linkedOrder?.installation_fee ?? 0),
      terminalFee: Number(linkedOrder?.terminal_fee ?? 0),
      terminalCount: Number(linkedOrder?.terminal_count ?? 0),
      routerFee: Number(linkedOrder?.router_fee ?? 0),
      
      // Billing from linked order
      subtotal: Number(linkedOrder?.subtotal ?? 0),
      tpsAmount: Number(linkedOrder?.tps_amount ?? 0),
      tvqAmount: Number(linkedOrder?.tvq_amount ?? 0),
      totalAmount: Number(linkedOrder?.total_amount ?? 0),
      
      // Promo/discounts from linked order
      promoCode: linkedOrder?.promo_code || undefined,
      promoDiscount: Number(linkedOrder?.discount_amount ?? 0),
      preauthDiscount: Number(linkedOrder?.preauth_discount ?? 0),
      
      isSigned: contract.is_signed || false,
      signedAt: contract.signed_at,
      
      // CRITICAL: Pass structured line_items for dynamic PDF generation
      equipmentDetails: equipmentDetails as { [key: string]: any; line_items?: any[] } | undefined,
    };
  };

  const handleDownloadContract = (contract: any) => {
    const data = buildContractData(contract);
    downloadTelecomContractPDF(data);
    toast.success("Contrat téléchargé");
  };

  const handleViewContract = (contract: any) => {
    const data = buildContractData(contract);
    viewTelecomContractPDF(data);
  };

  const handlePreviewContract = (contract: any) => {
    setSelectedContract(contract);
    setIsPreviewDialogOpen(true);
  };

  const handleSendContract = async (contract: any) => {
    const client = contract.profiles;
    if (!client?.email) {
      toast.error("Aucun courriel client disponible");
      return;
    }

    try {
      const portalUrl = `${window.location.origin}/portal/contracts`;
      
      await supabase.functions.invoke("send-contract-notification", {
        body: {
          email: client.email,
          name: client.full_name || "Client",
          contractName: contract.contract_name,
          contractNumber: contract.contract_number || contract.contract_url,
          portalUrl,
        },
      });

      toast.success("Notification envoyée au client");
    } catch (error) {
      console.error("Failed to send contract notification:", error);
      toast.error("Erreur lors de l'envoi de la notification");
    }
  };

  const handleCreateContract = () => {
    if (!formData.user_id || !formData.contract_name) {
      toast.error("Veuillez remplir tous les champs obligatoires");
      return;
    }
    createContractMutation.mutate(formData);
  };

  const handleGenerateAllPending = async () => {
    if (!ordersNeedingContracts || ordersNeedingContracts.length === 0) {
      toast.info("Aucune commande en attente de contrat");
      return;
    }
    
    for (const order of ordersNeedingContracts) {
      await generateContractForOrderMutation.mutateAsync(order);
    }
  };

  const toggleServiceSelection = (serviceId: string) => {
    setSelectedServices(prev => 
      prev.includes(serviceId)
        ? prev.filter(id => id !== serviceId)
        : [...prev, serviceId]
    );
  };

  const selectAllServices = () => {
    const servicesWithoutContract = activeServices?.filter(s => !s.hasContract) || [];
    setSelectedServices(servicesWithoutContract.map(s => s.id));
  };

  const deselectAllServices = () => {
    setSelectedServices([]);
  };

  const handleRegenerateContracts = () => {
    if (selectedServices.length === 0) {
      toast.error("Veuillez sélectionner au moins un service");
      return;
    }
    regenerateContractsMutation.mutate(selectedServices);
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "Internet": return <Wifi className="w-4 h-4 text-blue-500" />;
      case "TV": case "TV + Internet": return <Tv className="w-4 h-4 text-purple-500" />;
      case "Mobile": return <Smartphone className="w-4 h-4 text-green-500" />;
      case "Sécurité": return <Shield className="w-4 h-4 text-red-500" />;
      case "Streaming": return <Play className="w-4 h-4 text-orange-500" />;
      default: return <Package className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const servicesWithoutContract = activeServices?.filter(s => !s.hasContract) || [];
  const servicesWithContract = activeServices?.filter(s => s.hasContract) || [];

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">Contrats & Documents</h1>
            <p className="text-muted-foreground mt-1">Gérer les contrats clients signés</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => refetchContracts()}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Actualiser
            </Button>
            <Button 
              variant="outline" 
              onClick={() => {
                refetchActiveServices();
                setIsRegenerateDialogOpen(true);
              }}
              className="border-amber-500 text-amber-500 hover:bg-amber-500/10"
            >
              <RotateCw className="w-4 h-4 mr-2" />
              Régénérer contrats
            </Button>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-cyan-500 hover:bg-cyan-600">
                  <Plus className="w-4 h-4 mr-2" />
                  Nouveau contrat
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" onPointerDownOutside={(e) => e.preventDefault()}>
                <DialogHeader>
                  <DialogTitle>Créer un nouveau contrat</DialogTitle>
                </DialogHeader>
                <div className="space-y-6 py-4">
                  <div className="space-y-2">
                    <Label>Client *</Label>
                    <Select
                      value={formData.user_id}
                      onValueChange={(value) => setFormData({ ...formData, user_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner un client" />
                      </SelectTrigger>
                      <SelectContent>
                        {clients?.map((client) => (
                          <SelectItem key={client.user_id} value={client.user_id}>
                            {client.full_name || client.email} {client.client_number ? `(${client.client_number})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Nom du contrat *</Label>
                    <Input
                      value={formData.contract_name}
                      onChange={(e) => setFormData({ ...formData, contract_name: e.target.value })}
                      placeholder="Ex: Services de courtage télécom entreprise"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Description des services</Label>
                    <Textarea
                      value={formData.service_description}
                      onChange={(e) => setFormData({ ...formData, service_description: e.target.value })}
                      placeholder="Décrivez les services inclus dans ce contrat..."
                      rows={4}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Montant mensuel ($)</Label>
                      <Input
                        type="number"
                        value={formData.monthly_amount || ""}
                        onChange={(e) => setFormData({ ...formData, monthly_amount: parseFloat(e.target.value) || undefined })}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Montant total ($)</Label>
                      <Input
                        type="number"
                        value={formData.total_amount || ""}
                        onChange={(e) => setFormData({ ...formData, total_amount: parseFloat(e.target.value) || undefined })}
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Date de début *</Label>
                      <Input
                        type="date"
                        value={formData.start_date}
                        onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Durée (mois)</Label>
                      <Input
                        type="number"
                        value={formData.duration_months || ""}
                        onChange={(e) => setFormData({ ...formData, duration_months: parseInt(e.target.value) || undefined })}
                        placeholder="12"
                      />
                    </div>
                  </div>

                  <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                    <p className="text-sm font-medium text-foreground">Politiques incluses automatiquement :</p>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      <li>• Intérêt de {CONTRACT_TERMS.disputeChargeback.interestRate}% par mois (contestation bancaire/chargeback seulement)</li>
                      <li>• Délai de paiement de {CONTRACT_TERMS.paymentTerms.dueDays} jours</li>
                      <li>• Préavis de résiliation de {CONTRACT_TERMS.cancellation.noticeDays} jours</li>
                      <li>• Garantie équipement: {CONTRACT_TERMS.warranty.duration}</li>
                      <li>• Aucune vérification de crédit</li>
                      <li>• Clause de confidentialité et protection des données</li>
                      <li>• Juridiction: Province de Québec</li>
                    </ul>
                  </div>

                  <div className="flex justify-end gap-3 pt-4">
                    <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                      Annuler
                    </Button>
                    <Button
                      onClick={handleCreateContract}
                      disabled={createContractMutation.isPending}
                      className="bg-cyan-500 hover:bg-cyan-600"
                    >
                      Créer le contrat
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Pending Orders Alert */}
        {ordersNeedingContracts && ordersNeedingContracts.length > 0 && (
          <Card className="bg-amber-500/10 border-amber-500/30">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-amber-500">
                <Package className="w-5 h-5" />
                Commandes en attente de contrat ({ordersNeedingContracts.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {ordersNeedingContracts.slice(0, 5).map((order: any) => (
                  <div key={order.id} className="flex items-center justify-between p-3 bg-background rounded-lg border border-border">
                    <div>
                      <p className="font-medium text-sm">{order.order_number} - {order.service_type}</p>
                      <p className="text-xs text-muted-foreground">
                        {order.profile?.full_name || order.client_email} • Statut: {order.status}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => generateContractForOrderMutation.mutate(order)}
                      disabled={generateContractForOrderMutation.isPending}
                    >
                      Générer contrat
                    </Button>
                  </div>
                ))}
                {ordersNeedingContracts.length > 5 && (
                  <p className="text-xs text-muted-foreground text-center">
                    +{ordersNeedingContracts.length - 5} autres commandes
                  </p>
                )}
              </div>
              <Button
                className="w-full mt-4"
                variant="outline"
                onClick={handleGenerateAllPending}
                disabled={generateContractForOrderMutation.isPending}
              >
                Générer tous les contrats en attente
              </Button>
            </CardContent>
          </Card>
        )}

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-cyan-400" />
              Liste des contrats ({contracts?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : contracts && contracts.length > 0 ? (
              <div className="space-y-3">
                {contracts.map((c: any) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/30 transition-colors"
                  >
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-foreground">{c.contract_name}</p>
                        <Badge className="text-xs">
                          {c.contract_number || c.contract_url || c.id.slice(0, 8).toUpperCase()}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <User className="w-3 h-3" />
                        <span>{c.profiles?.full_name || c.profiles?.email || "Client non assigné"}</span>
                        {c.profiles?.client_number && (
                          <span className="text-cyan-500">({c.profiles.client_number})</span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Créé le {format(new Date(c.created_at), "d MMM yyyy", { locale: fr })}</span>
                        {c.signed_at && (
                          <span className="text-emerald-500">
                            Signé le {format(new Date(c.signed_at), "d MMM yyyy", { locale: fr })}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        className={
                          c.is_signed
                            ? "bg-emerald-500/20 text-emerald-500"
                            : "bg-amber-500/20 text-amber-500"
                        }
                      >
                        {c.is_signed ? "Signé" : "En attente"}
                      </Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handlePreviewContract(c)}
                        title="Aperçu"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleViewContract(c)}
                        title="Ouvrir PDF"
                      >
                        <FileText className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDownloadContract(c)}
                        title="Télécharger PDF"
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleSendContract(c)}
                        title="Envoyer par courriel"
                      >
                        <Send className="w-4 h-4" />
                      </Button>
                      {!c.is_signed && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => markAsSignedMutation.mutate(c)}
                          className="text-emerald-500 hover:text-emerald-600"
                          title="Marquer comme signé"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (confirm("Supprimer ce contrat ?")) {
                            deleteContractMutation.mutate(c.id);
                          }
                        }}
                        className="text-destructive hover:text-destructive"
                        title="Supprimer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Aucun contrat</p>
                <Button
                  className="mt-4"
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(true)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Créer le premier contrat
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Contract Preview Dialog - Premium Carrier-Grade Design */}
        <Dialog open={isPreviewDialogOpen} onOpenChange={setIsPreviewDialogOpen}>
          <DialogContent 
            className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0"
            onPointerDownOutside={(e) => e.preventDefault()}
            onInteractOutside={(e) => e.preventDefault()}
            onClick={(e) => e.stopPropagation()}
          >
            {selectedContract && (
              <>
                {/* Premium Header Band */}
                <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white px-6 py-5 relative overflow-hidden">
                  {/* Accent line */}
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-400 via-cyan-400 to-teal-400" />
                  
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-xl font-bold tracking-wide">NIVRA COMMUNICATIONS INC.</h2>
                      <p className="text-teal-400 text-sm font-medium mt-1">CUSTOMER SERVICE AGREEMENT</p>
                      <p className="text-slate-400 text-xs mt-1">Licensed Telecommunications Provider — Québec</p>
                    </div>
                    
                    {/* Reference Box */}
                    <div className="bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 text-right">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider">Contract ID</p>
                      <p className="text-sm font-mono font-bold text-teal-400">
                        {selectedContract.contract_number || `NVR-CSA-${selectedContract.id.slice(0, 5).toUpperCase()}`}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1">
                        {format(new Date(selectedContract.created_at), "dd MMM yyyy").toUpperCase()}
                      </p>
                    </div>
                  </div>
                </div>

                <ScrollArea className="flex-1 max-h-[60vh]">
                  <div className="p-6 space-y-6">
                    
                    {/* Section 1: Parties */}
                    <div>
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-7 h-7 rounded bg-slate-900 flex items-center justify-center text-white text-xs font-bold">1</div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wide">Parties</h3>
                        <div className="flex-1 h-px bg-gradient-to-r from-teal-500 to-transparent" />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        {/* Provider */}
                        <div className="bg-slate-900 rounded-lg p-4 relative overflow-hidden">
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-teal-500" />
                          <p className="text-[10px] text-teal-400 uppercase tracking-wider font-bold mb-2">Service Provider</p>
                          <p className="text-white text-sm font-medium">{BUSINESS_INFO.legalName}</p>
                          <p className="text-slate-400 text-xs mt-1">{BUSINESS_INFO.address}</p>
                          <p className="text-slate-400 text-xs">{BUSINESS_INFO.phone}</p>
                          <p className="text-slate-400 text-xs">{BUSINESS_INFO.email}</p>
                        </div>
                        
                        {/* Client */}
                        <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg p-4 relative overflow-hidden">
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-cyan-500" />
                          <p className="text-[10px] text-cyan-600 dark:text-cyan-400 uppercase tracking-wider font-bold mb-2">Client (Subscriber)</p>
                          <p className="text-slate-900 dark:text-white text-sm font-medium">{selectedContract.profiles?.full_name || "N/A"}</p>
                          <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">{selectedContract.profiles?.email}</p>
                          {selectedContract.profiles?.phone && (
                            <p className="text-slate-500 dark:text-slate-400 text-xs">{selectedContract.profiles.phone}</p>
                          )}
                          {selectedContract.profiles?.client_number && (
                            <p className="text-cyan-600 dark:text-cyan-400 text-xs font-mono font-bold mt-2">
                              Account: {selectedContract.profiles.client_number}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Section 2: Agreement Details */}
                    <div>
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-7 h-7 rounded bg-slate-900 flex items-center justify-center text-white text-xs font-bold">2</div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wide">Agreement Identification</h3>
                        <div className="flex-1 h-px bg-gradient-to-r from-teal-500 to-transparent" />
                      </div>
                      
                      <div className="bg-slate-50 dark:bg-slate-800/30 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-900 text-white">
                            <tr>
                              <th className="text-left px-4 py-2 text-xs font-bold uppercase">Identifier</th>
                              <th className="text-left px-4 py-2 text-xs font-bold uppercase">Value</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                            <tr>
                              <td className="px-4 py-2 text-slate-600 dark:text-slate-400">Contract ID</td>
                              <td className="px-4 py-2 font-mono font-medium">{selectedContract.contract_number || selectedContract.id.slice(0, 8).toUpperCase()}</td>
                            </tr>
                            <tr className="bg-white dark:bg-slate-800/50">
                              <td className="px-4 py-2 text-slate-600 dark:text-slate-400">Agreement Version</td>
                              <td className="px-4 py-2 font-medium">{CONTRACT_TERMS.version}</td>
                            </tr>
                            <tr>
                              <td className="px-4 py-2 text-slate-600 dark:text-slate-400">Issue Date</td>
                              <td className="px-4 py-2 font-medium">{format(new Date(selectedContract.created_at), "d MMMM yyyy", { locale: fr })}</td>
                            </tr>
                            <tr className="bg-white dark:bg-slate-800/50">
                              <td className="px-4 py-2 text-slate-600 dark:text-slate-400">Status</td>
                              <td className="px-4 py-2">
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                                  selectedContract.is_signed 
                                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" 
                                    : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                                }`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${selectedContract.is_signed ? "bg-emerald-500" : "bg-amber-500"}`} />
                                  {selectedContract.is_signed ? "Executed" : "Awaiting Signature"}
                                </span>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Section 3: Services */}
                    <div>
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-7 h-7 rounded bg-slate-900 flex items-center justify-center text-white text-xs font-bold">3</div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wide">Services Subscribed</h3>
                        <div className="flex-1 h-px bg-gradient-to-r from-teal-500 to-transparent" />
                      </div>
                      
                      <div className="bg-gradient-to-r from-slate-50 to-white dark:from-slate-800/50 dark:to-slate-800/30 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                        <p className="text-lg font-bold text-slate-900 dark:text-white">{selectedContract.contract_name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Bound to all services selected through the Nivra platform</p>
                      </div>
                    </div>

                    {/* Section 4: Service Address */}
                    {selectedContract.profiles?.service_address && (
                      <div>
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-7 h-7 rounded bg-slate-900 flex items-center justify-center text-white text-xs font-bold">4</div>
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wide">Service Address</h3>
                          <div className="flex-1 h-px bg-gradient-to-r from-teal-500 to-transparent" />
                        </div>
                        
                        <div className="bg-slate-50 dark:bg-slate-800/30 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                          <p className="text-sm font-medium">
                            {selectedContract.profiles.service_address}, {selectedContract.profiles.service_city}, {selectedContract.profiles.service_province || "QC"} {selectedContract.profiles.service_postal_code}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Section 5: Identity Validation */}
                    {selectedContract.profiles?.id_type && (
                      <div>
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-7 h-7 rounded bg-slate-900 flex items-center justify-center text-white text-xs font-bold">5</div>
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wide">Identity Validation</h3>
                          <div className="flex-1 h-px bg-gradient-to-r from-teal-500 to-transparent" />
                        </div>
                        
                        <div className="grid grid-cols-4 gap-3">
                          <div className="bg-slate-50 dark:bg-slate-800/30 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
                            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Type</p>
                            <p className="text-sm font-medium mt-1">{selectedContract.profiles.id_type}</p>
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-800/30 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
                            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Number</p>
                            <p className="text-sm font-medium mt-1 font-mono">{selectedContract.profiles.id_number}</p>
                          </div>
                          {selectedContract.profiles.id_province && (
                            <div className="bg-slate-50 dark:bg-slate-800/30 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
                              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Province</p>
                              <p className="text-sm font-medium mt-1">{selectedContract.profiles.id_province}</p>
                            </div>
                          )}
                          {selectedContract.profiles.id_expiration && (
                            <div className="bg-slate-50 dark:bg-slate-800/30 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
                              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Expiry</p>
                              <p className="text-sm font-medium mt-1">{selectedContract.profiles.id_expiration}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Section 6: Policy Summary */}
                    <div>
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-7 h-7 rounded bg-slate-900 flex items-center justify-center text-white text-xs font-bold">6</div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wide">Policy Summary</h3>
                        <div className="flex-1 h-px bg-gradient-to-r from-teal-500 to-transparent" />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-amber-50 dark:bg-amber-950/20 rounded-lg p-3 border-l-4 border-amber-500">
                          <p className="text-[10px] text-amber-600 dark:text-amber-400 uppercase tracking-wider font-bold">Dispute/Chargeback Only</p>
                          <p className="text-sm font-medium text-amber-700 dark:text-amber-300 mt-1">{CONTRACT_TERMS.disputeChargeback.interestRate}% per month</p>
                          <p className="text-[10px] text-amber-500/70 mt-1">+ ${CONTRACT_TERMS.disputeChargeback.reactivationFee} reconnection fee</p>
                        </div>
                        <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-3 border-l-4 border-blue-500">
                          <p className="text-[10px] text-blue-600 dark:text-blue-400 uppercase tracking-wider font-bold">Warranty</p>
                          <p className="text-sm font-medium text-blue-700 dark:text-blue-300 mt-1">{CONTRACT_TERMS.warranty.duration}</p>
                          <p className="text-[10px] text-blue-500/70 mt-1">{CONTRACT_TERMS.warranty.coverage}</p>
                        </div>
                        <div className="bg-amber-50 dark:bg-amber-950/20 rounded-lg p-3 border-l-4 border-amber-500">
                          <p className="text-[10px] text-amber-600 dark:text-amber-400 uppercase tracking-wider font-bold">Cancellation</p>
                          <p className="text-sm font-medium text-amber-700 dark:text-amber-300 mt-1">{CONTRACT_TERMS.cancellation.afterDeliveryCharge}</p>
                          <p className="text-[10px] text-amber-500/70 mt-1">{CONTRACT_TERMS.cancellation.noticeDays} days notice</p>
                        </div>
                        <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-lg p-3 border-l-4 border-emerald-500">
                          <p className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase tracking-wider font-bold">Credit Check</p>
                          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300 mt-1">Not Required</p>
                          <p className="text-[10px] text-emerald-500/70 mt-1">Pre-authorization only</p>
                        </div>
                      </div>
                    </div>

                    {/* Section 7: Signatures */}
                    <div>
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-7 h-7 rounded bg-slate-900 flex items-center justify-center text-white text-xs font-bold">7</div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wide">Signatures</h3>
                        <div className="flex-1 h-px bg-gradient-to-r from-teal-500 to-transparent" />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        {/* Client Signature - LEFT */}
                        <div className="bg-slate-50 dark:bg-slate-800/30 rounded-lg p-4 border border-slate-200 dark:border-slate-700 relative overflow-hidden">
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-cyan-500" />
                          <p className="text-[10px] text-cyan-600 dark:text-cyan-400 uppercase tracking-wider font-bold mb-3">Client e-Signature</p>
                          <p className="text-sm font-medium">{selectedContract.profiles?.full_name || "—"}</p>
                          <div className="border-b-2 border-dashed border-slate-300 dark:border-slate-600 h-10 mt-4 mb-2" />
                          <p className="text-[10px] text-slate-400 text-center">Signature</p>
                        </div>
                        
                        {/* Company Signature - RIGHT */}
                        <div className="bg-slate-900 rounded-lg p-4 relative overflow-hidden">
                          <div className="absolute right-0 top-0 bottom-0 w-1 bg-teal-500" />
                          <p className="text-[10px] text-teal-400 uppercase tracking-wider font-bold mb-3">Nivra Authorized Representative</p>
                          <p className="text-sm font-medium text-white">Nivra Communications Inc.</p>
                          <div className="border-b-2 border-dashed border-slate-600 h-10 mt-4 mb-2" />
                          <p className="text-[10px] text-slate-500 text-center">Authorized Signature</p>
                        </div>
                      </div>
                    </div>

                    {/* Execution Status Banner */}
                    {selectedContract.is_signed && selectedContract.signed_at ? (
                      <div className="bg-gradient-to-r from-emerald-50 to-emerald-100 dark:from-emerald-950/30 dark:to-emerald-900/20 border-2 border-emerald-400 rounded-xl p-5 text-center">
                        <div className="flex items-center justify-center gap-2 mb-2">
                          <CheckCircle className="w-6 h-6 text-emerald-500" />
                          <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">
                            AGREEMENT EXECUTED
                          </p>
                        </div>
                        <p className="text-sm text-emerald-600 dark:text-emerald-300">
                          Electronically signed on {format(new Date(selectedContract.signed_at), "d MMMM yyyy 'at' HH:mm", { locale: fr })}
                        </p>
                      </div>
                    ) : (
                      <div className="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-900/20 border-2 border-amber-400 border-dashed rounded-xl p-5 text-center">
                        <div className="flex items-center justify-center gap-2 mb-2">
                          <Clock className="w-6 h-6 text-amber-500" />
                          <p className="text-lg font-bold text-amber-700 dark:text-amber-400">
                            AWAITING CLIENT SIGNATURE
                          </p>
                        </div>
                        <p className="text-sm text-amber-600 dark:text-amber-300">
                          Contract pending client review and acceptance
                        </p>
                      </div>
                    )}

                    {/* Legal Footer */}
                    <div className="border-t border-slate-200 dark:border-slate-700 pt-4 mt-6">
                      <p className="text-[10px] text-slate-400 text-center">
                        {BUSINESS_INFO.legalName} — {BUSINESS_INFO.address} — {BUSINESS_INFO.phone}
                      </p>
                      <p className="text-[10px] text-slate-400 text-center mt-1">
                        Licensed Telecommunications Services Provider — Province of Québec
                      </p>
                    </div>
                  </div>
                </ScrollArea>
              </>
            )}
            <DialogFooter className="border-t pt-4">
              <Button variant="outline" onClick={() => setIsPreviewDialogOpen(false)}>
                Fermer
              </Button>
              {selectedContract && !selectedContract.is_signed && (
                <Button
                  variant="outline"
                  onClick={() => markAsSignedMutation.mutate(selectedContract)}
                  className="text-emerald-500 border-emerald-500 hover:bg-emerald-500/10"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Marquer signé
                </Button>
              )}
              {selectedContract && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => handleViewContract(selectedContract)}
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Ouvrir PDF
                  </Button>
                  <Button
                    onClick={() => handleDownloadContract(selectedContract)}
                    className="bg-cyan-500 hover:bg-cyan-600"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Télécharger PDF
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Contract Regeneration Dialog */}
        <Dialog open={isRegenerateDialogOpen} onOpenChange={setIsRegenerateDialogOpen}>
          <DialogContent 
            className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
            onPointerDownOutside={(e) => e.preventDefault()}
            onInteractOutside={(e) => e.preventDefault()}
            onClick={(e) => e.stopPropagation()}
          >
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <RotateCw className="w-5 h-5 text-amber-500" />
                Régénérer contrats pour services actifs
              </DialogTitle>
            </DialogHeader>
            
            <div className="text-sm text-muted-foreground mb-4">
              Sélectionnez les services pour lesquels vous souhaitez générer des contrats. Les contrats seront créés et liés aux profils clients.
            </div>

            <ScrollArea className="flex-1 max-h-[60vh]">
              <div className="space-y-6 pr-4">
                {/* Services without contracts */}
                {servicesWithoutContract.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-foreground flex items-center gap-2">
                        <Package className="w-4 h-4 text-amber-500" />
                        Services sans contrat ({servicesWithoutContract.length})
                      </h3>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={selectAllServices}>
                          Tout sélectionner
                        </Button>
                        <Button size="sm" variant="ghost" onClick={deselectAllServices}>
                          Désélectionner
                        </Button>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      {servicesWithoutContract.map(service => (
                        <div
                          key={service.id}
                          className={`flex items-center gap-3 p-3 border rounded-lg transition-colors cursor-pointer ${
                            selectedServices.includes(service.id)
                              ? "border-cyan-500 bg-cyan-500/5"
                              : "border-border hover:bg-muted/30"
                          }`}
                          onClick={() => toggleServiceSelection(service.id)}
                        >
                          <Checkbox
                            checked={selectedServices.includes(service.id)}
                            onCheckedChange={() => toggleServiceSelection(service.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div className="flex items-center gap-2">
                            {getCategoryIcon(service.category)}
                            <Badge variant="outline" className="text-xs">
                              {service.category}
                            </Badge>
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-sm">{service.serviceName}</p>
                            <p className="text-xs text-muted-foreground">
                              {service.clientName}
                              {service.clientNumber && ` (${service.clientNumber})`}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-sm">${service.amount.toFixed(2)}</p>
                            <p className="text-xs text-muted-foreground">
                              {service.type === 'subscription' ? 'Abonnement' : 'Commande'} • {service.status}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {servicesWithoutContract.length === 0 && (
                  <div className="text-center py-8">
                    <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                    <p className="text-muted-foreground">Tous les services actifs ont déjà un contrat</p>
                  </div>
                )}

                {/* Services with contracts (for reference) */}
                {servicesWithContract.length > 0 && (
                  <div className="space-y-3 border-t pt-4">
                    <h3 className="font-semibold text-muted-foreground flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-500" />
                      Services avec contrat existant ({servicesWithContract.length})
                    </h3>
                    
                    <div className="space-y-2 opacity-60">
                      {servicesWithContract.slice(0, 5).map(service => (
                        <div
                          key={service.id}
                          className="flex items-center gap-3 p-3 border border-border/50 rounded-lg bg-muted/20"
                        >
                          <CheckCircle className="w-4 h-4 text-emerald-500" />
                          <div className="flex items-center gap-2">
                            {getCategoryIcon(service.category)}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-sm">{service.serviceName}</p>
                            <p className="text-xs text-muted-foreground">{service.clientName}</p>
                          </div>
                          <Badge className="bg-emerald-500/20 text-emerald-500">Contrat existant</Badge>
                        </div>
                      ))}
                      {servicesWithContract.length > 5 && (
                        <p className="text-xs text-muted-foreground text-center">
                          +{servicesWithContract.length - 5} autres services avec contrat
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            <DialogFooter className="border-t pt-4">
              <div className="flex items-center justify-between w-full">
                <p className="text-sm text-muted-foreground">
                  {selectedServices.length} service(s) sélectionné(s)
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setIsRegenerateDialogOpen(false)}>
                    Annuler
                  </Button>
                  <Button
                    onClick={handleRegenerateContracts}
                    disabled={selectedServices.length === 0 || regenerateContractsMutation.isPending}
                    className="bg-amber-500 hover:bg-amber-600 text-white"
                  >
                    {regenerateContractsMutation.isPending ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Génération...
                      </>
                    ) : (
                      <>
                        <FileText className="w-4 h-4 mr-2" />
                        Générer {selectedServices.length} contrat(s)
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminContracts;
