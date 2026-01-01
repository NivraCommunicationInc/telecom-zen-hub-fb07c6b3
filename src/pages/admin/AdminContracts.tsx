import { useState, useEffect } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Download, Send, Plus, Eye, Trash2, RefreshCw, Package, User, CheckCircle, RotateCw, Wifi, Tv, Smartphone, Shield, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { downloadTelecomContractPDF, viewTelecomContractPDF, TelecomContractData } from "@/lib/telecomContractGenerator";
import { BUSINESS_INFO, CONTRACT_TERMS } from "@/lib/contractPolicies";
import { Checkbox } from "@/components/ui/checkbox";

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
      
      // Fetch profiles separately for each contract
      const contractsWithProfiles = await Promise.all(
        (data || []).map(async (contract) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("*")
            .eq("user_id", contract.user_id)
            .maybeSingle();
          return { ...contract, profiles: profile };
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
    mutationFn: async (contractId: string) => {
      const { error } = await supabase
        .from("contracts")
        .update({ is_signed: true, signed_at: new Date().toISOString() })
        .eq("id", contractId);
      if (error) throw error;
    },
    onSuccess: () => {
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
    return {
      contractNumber: contract.contract_number || contract.contract_url || `CTR-${contract.id.slice(0, 8).toUpperCase()}`,
      clientName: client?.full_name || "Client",
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
      orderDate: contract.created_at,
      servicePlan: contract.contract_name,
      subtotal: 0,
      tpsAmount: 0,
      tvqAmount: 0,
      totalAmount: 0,
      isSigned: contract.is_signed || false,
      signedAt: contract.signed_at,
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
                      <li>• Intérêt de {CONTRACT_TERMS.paymentTerms.lateInterestRate}% par mois sur paiements en retard</li>
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
                          onClick={() => markAsSignedMutation.mutate(c.id)}
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

        {/* Contract Preview Dialog */}
        <Dialog open={isPreviewDialogOpen} onOpenChange={setIsPreviewDialogOpen}>
          <DialogContent 
            className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
            onPointerDownOutside={(e) => e.preventDefault()}
            onInteractOutside={(e) => e.preventDefault()}
            onClick={(e) => e.stopPropagation()}
          >
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-cyan-400" />
                Aperçu du contrat
              </DialogTitle>
            </DialogHeader>
            {selectedContract && (
              <ScrollArea className="flex-1">
                <div className="space-y-6 py-4 pr-4">
                  {/* Header */}
                  <div className="bg-gradient-to-r from-cyan-500 to-cyan-600 text-white rounded-lg p-6 text-center">
                    <h2 className="text-2xl font-bold">{BUSINESS_INFO.name.toUpperCase()}</h2>
                    <p className="text-sm opacity-90">Compagnie Télécom Indépendante</p>
                    <p className="text-xs opacity-75 mt-1">
                      {BUSINESS_INFO.phone} | {BUSINESS_INFO.email}
                    </p>
                  </div>

                  {/* Contract Info */}
                  <div className="bg-muted rounded-lg p-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Contrat N° :</span>{" "}
                        {selectedContract.contract_number || selectedContract.contract_url || selectedContract.id.slice(0, 8).toUpperCase()}
                      </div>
                      <div>
                        <span className="font-medium">Version :</span> {CONTRACT_TERMS.version}
                      </div>
                      <div>
                        <span className="font-medium">Date d'émission :</span>{" "}
                        {format(new Date(selectedContract.created_at), "d MMMM yyyy", { locale: fr })}
                      </div>
                      <div>
                        <span className="font-medium">Statut :</span>{" "}
                        <Badge
                          className={
                            selectedContract.is_signed
                              ? "bg-emerald-500/20 text-emerald-500"
                              : "bg-amber-500/20 text-amber-500"
                          }
                        >
                          {selectedContract.is_signed ? "Signé" : "En attente"}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Parties */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-900 text-white rounded-lg p-4">
                      <h3 className="font-bold text-cyan-400 mb-2">LE PRESTATAIRE / THE PROVIDER</h3>
                      <p className="text-sm">{BUSINESS_INFO.legalName}</p>
                      <p className="text-sm text-gray-300">{BUSINESS_INFO.address}</p>
                      <p className="text-sm text-gray-300">{BUSINESS_INFO.phone}</p>
                      <p className="text-sm text-gray-300">{BUSINESS_INFO.email}</p>
                    </div>
                    <div className="border-l-4 border-cyan-500 bg-muted rounded-lg p-4">
                      <h3 className="font-bold text-cyan-500 mb-2">LE CLIENT / THE CLIENT</h3>
                      <p className="text-sm font-medium">{selectedContract.profiles?.full_name || "N/A"}</p>
                      <p className="text-sm text-muted-foreground">{selectedContract.profiles?.email}</p>
                      {selectedContract.profiles?.phone && (
                        <p className="text-sm text-muted-foreground">{selectedContract.profiles.phone}</p>
                      )}
                      {selectedContract.profiles?.client_number && (
                        <p className="text-sm font-medium text-cyan-500 mt-1">
                          # {selectedContract.profiles.client_number}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Service Address */}
                  {selectedContract.profiles?.service_address && (
                    <div className="bg-muted rounded-lg p-4">
                      <h3 className="font-bold text-cyan-500 mb-2">ADRESSE DE SERVICE / SERVICE ADDRESS</h3>
                      <p className="text-sm">
                        {selectedContract.profiles.service_address}, {selectedContract.profiles.service_city}, {selectedContract.profiles.service_province || "QC"} {selectedContract.profiles.service_postal_code}
                      </p>
                    </div>
                  )}

                  {/* Contract Details */}
                  <div className="space-y-4">
                    <h3 className="font-bold text-cyan-500">OBJET DU CONTRAT / CONTRACT OBJECT</h3>
                    <p className="text-sm">{selectedContract.contract_name}</p>
                  </div>

                  {/* Identity */}
                  {selectedContract.profiles?.id_type && (
                    <div className="bg-muted rounded-lg p-4">
                      <h3 className="font-bold text-cyan-500 mb-2">VALIDATION D'IDENTITÉ / IDENTITY VALIDATION</h3>
                      <div className="grid grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Type:</span> {selectedContract.profiles.id_type}
                        </div>
                        <div>
                          <span className="text-muted-foreground">N°:</span> {selectedContract.profiles.id_number}
                        </div>
                        {selectedContract.profiles.id_province && (
                          <div>
                            <span className="text-muted-foreground">Province:</span> {selectedContract.profiles.id_province}
                          </div>
                        )}
                        {selectedContract.profiles.id_expiration && (
                          <div>
                            <span className="text-muted-foreground">Exp:</span> {selectedContract.profiles.id_expiration}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Policies Summary */}
                  <div className="space-y-3">
                    <h3 className="font-bold text-cyan-500">POLITIQUES INCLUSES / INCLUDED POLICIES</h3>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded p-3">
                        <p className="font-medium text-red-600 dark:text-red-400 text-xs">PAIEMENT EN RETARD</p>
                        <p className="text-xs">{CONTRACT_TERMS.paymentTerms.lateInterestRate}% par mois</p>
                      </div>
                      <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded p-3">
                        <p className="font-medium text-blue-600 dark:text-blue-400 text-xs">GARANTIE</p>
                        <p className="text-xs">{CONTRACT_TERMS.warranty.duration} - {CONTRACT_TERMS.warranty.coverage}</p>
                      </div>
                      <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded p-3">
                        <p className="font-medium text-amber-600 dark:text-amber-400 text-xs">ANNULATION</p>
                        <p className="text-xs">{CONTRACT_TERMS.cancellation.earlyTerminationFee}</p>
                      </div>
                      <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded p-3">
                        <p className="font-medium text-emerald-600 dark:text-emerald-400 text-xs">CRÉDIT</p>
                        <p className="text-xs">Aucune vérification de crédit</p>
                      </div>
                    </div>
                  </div>

                  {/* Signatures */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-900 text-white rounded-lg p-4">
                      <h3 className="font-bold text-cyan-400 text-center mb-4">POUR LE PRESTATAIRE</h3>
                      <div className="border-b border-dashed border-gray-500 h-10 mb-2" />
                      <p className="text-xs text-gray-400 text-center">Signature</p>
                    </div>
                    <div className="border-l-4 border-cyan-500 bg-muted rounded-lg p-4">
                      <h3 className="font-bold text-cyan-500 text-center mb-4">POUR LE CLIENT</h3>
                      <div className="border-b border-dashed border-muted-foreground h-10 mb-2" />
                      <p className="text-xs text-muted-foreground text-center">Signature</p>
                    </div>
                  </div>

                  {selectedContract.is_signed && selectedContract.signed_at && (
                    <div className="bg-emerald-100 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-700 rounded-lg p-4 text-center">
                      <p className="font-bold text-emerald-600 dark:text-emerald-400">
                        ✓ CONTRAT SIGNÉ ÉLECTRONIQUEMENT
                      </p>
                      <p className="text-sm text-emerald-700 dark:text-emerald-300">
                        {format(new Date(selectedContract.signed_at), "d MMMM yyyy 'à' HH:mm", { locale: fr })}
                      </p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}
            <DialogFooter className="border-t pt-4">
              <Button variant="outline" onClick={() => setIsPreviewDialogOpen(false)}>
                Fermer
              </Button>
              {selectedContract && !selectedContract.is_signed && (
                <Button
                  variant="outline"
                  onClick={() => markAsSignedMutation.mutate(selectedContract.id)}
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
