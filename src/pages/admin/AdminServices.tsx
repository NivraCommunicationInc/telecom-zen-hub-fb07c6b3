import { useState, useEffect } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { 
  Settings, Plus, Pencil, Trash2, Wifi, Tv, Smartphone, Shield, 
  Package, Router, CreditCard, Truck, FileCheck, Search, RefreshCw,
  ChevronDown, ChevronRight, Info, Eye, EyeOff, Clock, Zap,
  CheckCircle2, XCircle, AlertTriangle, Archive, Star
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";
import { useToast } from "@/hooks/use-toast";
import { useActivityLog } from "@/hooks/useActivityLog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

const categories = [
  "Internet",
  "TV",
  "TV + Internet",
  "GIGA Bundles",
  "Mobile",
  "Sécurité",
  "Équipement",
];

const categoryIcons: Record<string, any> = {
  "Internet": Wifi,
  "TV": Tv,
  "TV + Internet": Tv,
  "GIGA Bundles": Package,
  "Mobile": Smartphone,
  "Sécurité": Shield,
  "Équipement": Router,
};

const categoryColors: Record<string, string> = {
  "Internet": "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  "TV": "bg-purple-500/20 text-purple-400 border-purple-500/30",
  "TV + Internet": "bg-purple-500/20 text-purple-400 border-purple-500/30",
  "GIGA Bundles": "bg-amber-500/20 text-amber-400 border-amber-500/30",
  "Mobile": "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  "Sécurité": "bg-red-500/20 text-red-400 border-red-500/30",
  "Équipement": "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

// Official service catalogue with expanded plan details
const officialCatalogue = [
  // Internet Plans
  {
    name: "Internet Résidentiel 100 Mbps",
    category: "Internet",
    price: 55,
    description: "Download up to 100 Mbps, Unlimited data, Nivra Born Wifi Router included, 7/7 tech support",
    billing_type: "monthly",
    plan_details: {
      speed: "100 Mbps download",
      data: "Unlimited",
      router: "Nivra Born Wifi Router included",
      support: "7/7 technical support",
      features: ["Unlimited data", "No contract required", "Free installation (eligible areas)"]
    }
  },
  {
    name: "Internet Résidentiel 500 Mbps",
    category: "Internet",
    price: 60,
    description: "Download up to 500 Mbps, Unlimited data, Priority support, 4K streaming",
    billing_type: "monthly",
    plan_details: {
      speed: "500 Mbps download",
      data: "Unlimited",
      router: "Nivra Born Wifi Router included",
      support: "Priority support",
      features: ["4K streaming optimized", "Unlimited data", "No contract required", "Free installation (eligible areas)"]
    }
  },
  {
    name: "Internet Coaxial GIGA 940 Mbps",
    category: "Internet",
    price: 70,
    description: "Download up to 940 Mbps, Unlimited data, VIP support, ultra-low latency",
    billing_type: "monthly",
    plan_details: {
      speed: "940 Mbps download (GIGA Speed)",
      data: "Unlimited",
      router: "Nivra Born Wifi Router included",
      support: "VIP support",
      features: ["Ultra-low latency", "Unlimited data", "No contract required", "Free installation (eligible areas)", "Ideal for gaming & streaming"]
    }
  },
  // TV + Internet Bundles
  {
    name: "Internet 100 + TV Basic",
    category: "TV + Internet",
    price: 75,
    description: "26 general channels included",
    billing_type: "monthly",
    plan_details: {
      internet: "100 Mbps download",
      channels: 26,
      channel_type: "General channels",
      features: ["Unlimited data", "Nivra Born Wifi Router included", "7/7 support"]
    }
  },
  {
    name: "Internet 500 + TV 5 choix",
    category: "TV + Internet",
    price: 80,
    description: "32 popular channels, 5 channels picker",
    billing_type: "monthly",
    plan_details: {
      internet: "500 Mbps download",
      channels: 32,
      channel_type: "Popular channels",
      picker: "5 channels picker",
      features: ["Unlimited data", "Nivra Born Wifi Router included", "Priority support"]
    }
  },
  {
    name: "Internet 500 + TV 10 choix",
    category: "TV + Internet",
    price: 90,
    description: "37 popular + sports channels, 10 channels picker",
    billing_type: "monthly",
    plan_details: {
      internet: "500 Mbps download",
      channels: 37,
      channel_type: "Popular + sports channels",
      picker: "10 channels picker",
      features: ["Unlimited data", "Nivra Born Wifi Router included", "Priority support"]
    }
  },
  {
    name: "Internet 500 + TV 15 choix",
    category: "TV + Internet",
    price: 95,
    description: "42 popular + sports channels, 15 channels picker",
    billing_type: "monthly",
    plan_details: {
      internet: "500 Mbps download",
      channels: 42,
      channel_type: "Popular + sports channels",
      picker: "15 channels picker",
      features: ["Unlimited data", "Nivra Born Wifi Router included", "Priority support"]
    }
  },
  {
    name: "Internet 500 + TV 25 choix",
    category: "TV + Internet",
    price: 110,
    description: "52 popular + sports channels, 25 channels picker, VIP support",
    billing_type: "monthly",
    plan_details: {
      internet: "500 Mbps download",
      channels: 52,
      channel_type: "Popular + sports channels",
      picker: "25 channels picker",
      features: ["Unlimited data", "Nivra Born Wifi Router included", "VIP support"]
    }
  },
  // GIGA Bundles
  {
    name: "GIGA + TV Basic",
    category: "GIGA Bundles",
    price: 85,
    description: "26 general channels included",
    billing_type: "monthly",
    plan_details: {
      internet: "940 Mbps download (GIGA Speed)",
      channels: 26,
      channel_type: "General channels",
      features: ["Unlimited data", "Ultra-low latency", "Nivra Born Wifi Router included", "VIP support"]
    }
  },
  {
    name: "GIGA + TV 5 choix",
    category: "GIGA Bundles",
    price: 95,
    description: "32 popular channels, 5 channels picker",
    billing_type: "monthly",
    plan_details: {
      internet: "940 Mbps download (GIGA Speed)",
      channels: 32,
      channel_type: "Popular channels",
      picker: "5 channels picker",
      features: ["Unlimited data", "Ultra-low latency", "Nivra Born Wifi Router included", "VIP support"]
    }
  },
  {
    name: "GIGA + TV 10 choix",
    category: "GIGA Bundles",
    price: 105,
    description: "37 popular + sports channels, 10 channels picker",
    billing_type: "monthly",
    plan_details: {
      internet: "940 Mbps download (GIGA Speed)",
      channels: 37,
      channel_type: "Popular + sports channels",
      picker: "10 channels picker",
      features: ["Unlimited data", "Ultra-low latency", "Nivra Born Wifi Router included", "VIP support"]
    }
  },
  {
    name: "GIGA + TV 15 choix",
    category: "GIGA Bundles",
    price: 110,
    description: "42 popular + sports channels, 15 channels picker",
    billing_type: "monthly",
    plan_details: {
      internet: "940 Mbps download (GIGA Speed)",
      channels: 42,
      channel_type: "Popular + sports channels",
      picker: "15 channels picker",
      features: ["Unlimited data", "Ultra-low latency", "Nivra Born Wifi Router included", "VIP support"]
    }
  },
  {
    name: "GIGA + TV 25 choix",
    category: "GIGA Bundles",
    price: 120,
    description: "52 popular + sports channels, 25 channels picker, VIP support",
    billing_type: "monthly",
    plan_details: {
      internet: "940 Mbps download (GIGA Speed)",
      channels: 52,
      channel_type: "Popular + sports channels",
      picker: "25 channels picker",
      features: ["Unlimited data", "Ultra-low latency", "Nivra Born Wifi Router included", "VIP support"]
    }
  },
  // Mobile Plans
  {
    name: "Mobile 50$/30 jours",
    category: "Mobile",
    price: 50,
    description: "Auto Top-Up: 55 GB 4G, No Top-Up: 50 GB 4G, Unlimited Canada calling, Unlimited international SMS/MMS",
    billing_type: "30_days",
    plan_details: {
      data_with_topup: "55 GB 4G",
      data_without_topup: "50 GB 4G",
      calls: "Unlimited Canada-wide calls",
      texts: "Unlimited international SMS/MMS",
      features: ["Voicemail", "Call display", "Call waiting", "Call forwarding", "Conference calling"],
      delivery: "Delivery only",
      sim_fees: { physical: 25, esim: 25 }
    }
  },
  {
    name: "Mobile 60$/30 jours",
    category: "Mobile",
    price: 60,
    description: "Auto Top-Up: 80 GB 4G, No Top-Up: 75 GB 4G, Unlimited Canada calling, Unlimited international SMS/MMS",
    billing_type: "30_days",
    plan_details: {
      data_with_topup: "80 GB 4G",
      data_without_topup: "75 GB 4G",
      calls: "Unlimited Canada-wide calls",
      texts: "Unlimited international SMS/MMS",
      features: ["Voicemail", "Call display", "Call waiting", "Call forwarding", "Conference calling"],
      delivery: "Delivery only",
      sim_fees: { physical: 25, esim: 25 }
    }
  },
  // Equipment
  {
    name: "Router Nivra Born Wifi",
    category: "Équipement",
    price: 60,
    description: "Frais uniques, 1-year manufacturer warranty, defects covered",
    billing_type: "one_time",
    plan_details: {
      type: "Router",
      warranty: "1-year manufacturer warranty",
      coverage: "Defects covered"
    }
  },
  {
    name: "Terminal Nivra 4K Smart",
    category: "Équipement",
    price: 50,
    description: "Par terminal (max 4), paid before installation, 1-year manufacturer warranty",
    billing_type: "one_time",
    plan_details: {
      type: "TV Terminal",
      max_quantity: 4,
      warranty: "1-year manufacturer warranty",
      note: "Paid before installation"
    }
  },
  {
    name: "Physical SIM",
    category: "Équipement",
    price: 25,
    description: "Frais uniques, 1-year warranty defects covered",
    billing_type: "one_time",
    plan_details: {
      type: "SIM Card",
      format: "Physical SIM",
      warranty: "1-year warranty",
      admin_note: "SIM fee for mobile plans"
    }
  },
  {
    name: "eSIM",
    category: "Équipement",
    price: 25,
    description: "Frais uniques, 1-year warranty defects covered",
    billing_type: "one_time",
    plan_details: {
      type: "SIM Card",
      format: "eSIM (digital)",
      warranty: "1-year warranty",
      admin_note: "eSIM fee for mobile plans"
    }
  },
  // Security Plans
  {
    name: "Sécurité Maison",
    category: "Sécurité",
    price: 39.99,
    description: "Alarm system + connected cameras",
    billing_type: "monthly",
    plan_details: {
      type: "Residential Security",
      includes: ["Alarm system", "Connected cameras"],
      support: "24/7 monitoring available"
    }
  },
  {
    name: "Sécurité Entreprise",
    category: "Sécurité",
    price: 99.99,
    description: "Full security solution for PME/PMI",
    billing_type: "monthly",
    plan_details: {
      type: "Business Security",
      includes: ["Complete alarm system", "HD cameras", "Access control"],
      support: "24/7 monitoring included"
    }
  },
];

// Status configuration
const STATUS_CONFIG = {
  active: { label: "Actif", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", icon: CheckCircle2 },
  inactive: { label: "Inactif", color: "bg-muted text-muted-foreground border-border", icon: XCircle },
  end_of_life: { label: "Fin de vie", color: "bg-orange-500/20 text-orange-400 border-orange-500/30", icon: AlertTriangle },
  archived: { label: "Archivé", color: "bg-slate-500/20 text-slate-400 border-slate-500/30", icon: Archive },
};

const AdminServices = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { logActivity } = useActivityLog();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [expandedCategories, setExpandedCategories] = useState<string[]>(categories);
  const [expandedDetails, setExpandedDetails] = useState<string[]>([]);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "",
    price: "",
    is_active: true,
  });

  const { data: services, isLoading, refetch } = useQuery({
    queryKey: ["admin-services"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .order("category", { ascending: true })
        .order("price", { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  // Seed catalogue mutation
  const seedCatalogueMutation = useMutation({
    mutationFn: async () => {
      const { data: existing } = await supabase
        .from("services")
        .select("name");
      
      const existingNames = new Set(existing?.map(s => s.name) || []);
      const newServices = officialCatalogue.filter(s => !existingNames.has(s.name));
      
      if (newServices.length === 0) {
        return { inserted: 0 };
      }

      const { error } = await supabase.from("services").insert(
        newServices.map(s => ({
          name: s.name,
          category: s.category,
          price: s.price,
          description: s.description,
          is_active: true,
        }))
      );

      if (error) throw error;
      return { inserted: newServices.length };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-services"] });
      if (data.inserted > 0) {
        toast({ title: `${data.inserted} services ajoutés au catalogue` });
      } else {
        toast({ title: "Catalogue déjà à jour" });
      }
    },
    onError: (error: any) => {
      toast({ 
        title: "Erreur lors de l'initialisation", 
        description: error?.message,
        variant: "destructive" 
      });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { data: newService, error } = await supabase.from("services").insert({
        name: data.name,
        description: data.description,
        category: data.category,
        price: data.price ? parseFloat(data.price) : null,
        is_active: data.is_active,
      }).select().single();
      if (error) throw error;
      return newService;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-services"] });
      logActivity("create", "service", data.id, { name: data.name });
      toast({ title: "Service créé avec succès" });
      resetForm();
    },
    onError: () => {
      toast({ title: "Erreur lors de la création", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const { error } = await supabase
        .from("services")
        .update({
          name: data.name,
          description: data.description,
          category: data.category,
          price: data.price ? parseFloat(data.price) : null,
          is_active: data.is_active,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-services"] });
      logActivity("update", "service", editingService?.id);
      toast({ title: "Service mis à jour" });
      resetForm();
    },
    onError: () => {
      toast({ title: "Erreur lors de la mise à jour", variant: "destructive" });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("services")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-services"] });
      toast({ title: variables.is_active ? "Service activé" : "Service désactivé" });
    },
    onError: () => {
      toast({ title: "Erreur lors de la mise à jour", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("services").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-services"] });
      toast({ title: "Service supprimé" });
    },
    onError: () => {
      toast({ title: "Erreur lors de la suppression", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({ name: "", description: "", category: "", price: "", is_active: true });
    setEditingService(null);
    setIsDialogOpen(false);
  };

  const handleEdit = (service: any) => {
    setEditingService(service);
    setFormData({
      name: service.name,
      description: service.description || "",
      category: service.category,
      price: service.price?.toString() || "",
      is_active: service.is_active,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingService) {
      updateMutation.mutate({ id: editingService.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const toggleDetails = (serviceId: string) => {
    setExpandedDetails(prev => 
      prev.includes(serviceId) 
        ? prev.filter(id => id !== serviceId)
        : [...prev, serviceId]
    );
  };

  const viewPlanDetails = (service: any) => {
    setSelectedService(service);
    setDetailsDialogOpen(true);
  };

  // Get plan details from catalogue
  const getPlanDetails = (serviceName: string) => {
    const catalogueItem = officialCatalogue.find(item => item.name === serviceName);
    return catalogueItem?.plan_details || null;
  };

  // Filter and group services
  const filteredServices = services?.filter((service: any) => {
    const matchesSearch = service.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      service.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === "all" || service.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const groupedServices = filteredServices?.reduce((acc: Record<string, any[]>, service: any) => {
    const cat = service.category || "Autre";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(service);
    return acc;
  }, {});

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const formatPrice = (price: number | null, category: string) => {
    if (!price) return "—";
    const isEquipment = category === "Équipement";
    const isMobile = category === "Mobile";
    
    const formatted = Number(price).toLocaleString("fr-CA", {
      style: "currency",
      currency: "CAD",
    });
    
    if (isEquipment) return `${formatted} (frais uniques)`;
    if (isMobile) return `${formatted}/30 jours`;
    return `${formatted}/mois`;
  };

  const renderPlanDetailsContent = (planDetails: any, category: string) => {
    if (!planDetails) return null;

    return (
      <div className="space-y-4 text-sm">
        {/* Internet Plans */}
        {category === "Internet" && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-accent/30 rounded-lg p-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Vitesse</p>
                <p className="font-semibold text-cyan-400">{planDetails.speed}</p>
              </div>
              <div className="bg-accent/30 rounded-lg p-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Données</p>
                <p className="font-semibold text-emerald-400">{planDetails.data}</p>
              </div>
            </div>
            <div className="bg-accent/30 rounded-lg p-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Routeur</p>
              <p className="font-medium">{planDetails.router}</p>
            </div>
            <div className="bg-accent/30 rounded-lg p-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Support</p>
              <p className="font-medium">{planDetails.support}</p>
            </div>
            {planDetails.features && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Fonctionnalités incluses</p>
                <ul className="space-y-1">
                  {planDetails.features.map((feature: string, idx: number) => (
                    <li key={idx} className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

        {/* TV + Internet Bundles */}
        {(category === "TV + Internet" || category === "GIGA Bundles") && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-accent/30 rounded-lg p-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Internet</p>
                <p className="font-semibold text-cyan-400">{planDetails.internet}</p>
              </div>
              <div className="bg-accent/30 rounded-lg p-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Chaînes</p>
                <p className="font-semibold text-purple-400">{planDetails.channels} chaînes</p>
              </div>
            </div>
            <div className="bg-accent/30 rounded-lg p-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Type de chaînes</p>
              <p className="font-medium">{planDetails.channel_type}</p>
            </div>
            {planDetails.picker && (
              <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Sélection personnalisée</p>
                <p className="font-medium text-purple-400">{planDetails.picker}</p>
              </div>
            )}
            {planDetails.features && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Fonctionnalités incluses</p>
                <ul className="space-y-1">
                  {planDetails.features.map((feature: string, idx: number) => (
                    <li key={idx} className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

        {/* Mobile Plans */}
        {category === "Mobile" && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Avec Auto Top-Up</p>
                <p className="font-semibold text-emerald-400">{planDetails.data_with_topup}</p>
              </div>
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Sans Auto Top-Up</p>
                <p className="font-semibold text-amber-400">{planDetails.data_without_topup}</p>
              </div>
            </div>
            <div className="bg-accent/30 rounded-lg p-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Appels</p>
              <p className="font-medium">{planDetails.calls}</p>
            </div>
            <div className="bg-accent/30 rounded-lg p-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Textos</p>
              <p className="font-medium">{planDetails.texts}</p>
            </div>
            {planDetails.features && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Fonctionnalités incluses</p>
                <ul className="grid grid-cols-2 gap-1">
                  {planDetails.features.map((feature: string, idx: number) => (
                    <li key={idx} className="flex items-center gap-2">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      <span className="text-xs">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {planDetails.sim_fees && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                  <Shield className="w-3 h-3 inline mr-1" />
                  Frais SIM (Admin privé)
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>Physical SIM: <span className="font-bold">${planDetails.sim_fees.physical}</span></div>
                  <div>eSIM: <span className="font-bold">${planDetails.sim_fees.esim}</span></div>
                </div>
              </div>
            )}
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
              <p className="text-xs font-medium text-blue-400">
                <Truck className="w-3 h-3 inline mr-1" />
                {planDetails.delivery}
              </p>
            </div>
          </>
        )}

        {/* Equipment */}
        {category === "Équipement" && (
          <>
            <div className="bg-accent/30 rounded-lg p-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Type</p>
              <p className="font-medium">{planDetails.type}</p>
            </div>
            {planDetails.format && (
              <div className="bg-accent/30 rounded-lg p-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Format</p>
                <p className="font-medium">{planDetails.format}</p>
              </div>
            )}
            <div className="bg-accent/30 rounded-lg p-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Garantie</p>
              <p className="font-medium">{planDetails.warranty}</p>
            </div>
            {planDetails.max_quantity && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Quantité max</p>
                <p className="font-medium text-amber-400">{planDetails.max_quantity} par installation</p>
              </div>
            )}
            {planDetails.admin_note && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                <p className="text-xs font-medium text-red-400">
                  <Shield className="w-3 h-3 inline mr-1" />
                  Note admin: {planDetails.admin_note}
                </p>
              </div>
            )}
          </>
        )}

        {/* Security Plans */}
        {category === "Sécurité" && (
          <>
            <div className="bg-accent/30 rounded-lg p-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Type</p>
              <p className="font-medium">{planDetails.type}</p>
            </div>
            {planDetails.includes && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Inclus</p>
                <ul className="space-y-1">
                  {planDetails.includes.map((item: string, idx: number) => (
                    <li key={idx} className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="bg-accent/30 rounded-lg p-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Support</p>
              <p className="font-medium">{planDetails.support}</p>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">Catalogue de services</h1>
            <p className="text-muted-foreground mt-1">Gérer les plans et tarifs offerts sur le site public</p>
          </div>
          <div className="flex gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline" 
                    onClick={() => seedCatalogueMutation.mutate()}
                    disabled={seedCatalogueMutation.isPending}
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${seedCatalogueMutation.isPending ? 'animate-spin' : ''}`} />
                    Initialiser catalogue
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Ajouter tous les services officiels manquants</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="hero" onClick={() => resetForm()}>
                  <Plus className="w-4 h-4 mr-2" />
                  Ajouter un service
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border max-w-lg">
                <DialogHeader>
                  <DialogTitle>
                    {editingService ? "Modifier le service" : "Nouveau service"}
                  </DialogTitle>
                  <DialogDescription>
                    {editingService ? "Mettre à jour les informations du service" : "Créer un nouveau service dans le catalogue"}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nom du service</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Ex: Internet 500 Mbps"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">Catégorie</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(v) => setFormData({ ...formData, category: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner une catégorie" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Caractéristiques du service..."
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="price">Prix (CAD)</Label>
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="is_active">Service actif (visible sur le site)</Label>
                    <Switch
                      id="is_active"
                      checked={formData.is_active}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                    />
                  </div>
                  <div className="flex gap-3 justify-end pt-2">
                    <Button type="button" variant="outline" onClick={resetForm}>
                      Annuler
                    </Button>
                    <Button type="submit" variant="hero">
                      {editingService ? "Mettre à jour" : "Créer"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Business Rules Info */}
        <Alert className="bg-accent/50 border-accent">
          <Info className="h-4 w-4" />
          <AlertTitle>Règles d'affaires</AlertTitle>
          <AlertDescription className="text-sm space-y-1">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
              <div className="flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-cyan-400" />
                <span>Pièce d'identité gouvernementale requise</span>
              </div>
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-400" />
                <span>Aucune vérification de crédit</span>
              </div>
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-amber-400" />
                <span>Uber Express (10h, Grand Montréal): $45</span>
              </div>
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-purple-400" />
                <span>Standard: 24-78h ouvrables (Québec)</span>
              </div>
            </div>
          </AlertDescription>
        </Alert>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-2xl font-bold text-foreground">{services?.length || 0}</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Actifs</p>
              <p className="text-2xl font-bold text-emerald-400">
                {services?.filter((s: any) => s.is_active).length || 0}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Inactifs</p>
              <p className="text-2xl font-bold text-muted-foreground">
                {services?.filter((s: any) => !s.is_active).length || 0}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Internet</p>
              <p className="text-2xl font-bold text-cyan-400">
                {services?.filter((s: any) => s.category === "Internet").length || 0}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">TV Bundles</p>
              <p className="text-2xl font-bold text-purple-400">
                {services?.filter((s: any) => s.category === "TV + Internet" || s.category === "GIGA Bundles").length || 0}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Mobile</p>
              <p className="text-2xl font-bold text-emerald-400">
                {services?.filter((s: any) => s.category === "Mobile").length || 0}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un service..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Catégorie" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les catégories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Services by Category */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : groupedServices && Object.keys(groupedServices).length > 0 ? (
          <div className="space-y-4">
            {categories.map((category) => {
              const categoryServices = groupedServices[category];
              if (!categoryServices || categoryServices.length === 0) return null;
              
              const CategoryIcon = categoryIcons[category] || Settings;
              const isExpanded = expandedCategories.includes(category);

              return (
                <Card key={category} className="bg-card border-border overflow-hidden">
                  <Collapsible open={isExpanded} onOpenChange={() => toggleCategory(category)}>
                    <CollapsibleTrigger asChild>
                      <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${categoryColors[category] || 'bg-muted'}`}>
                              <CategoryIcon className="w-5 h-5" />
                            </div>
                            <div>
                              <CardTitle className="text-lg">{category}</CardTitle>
                              <CardDescription>
                                {categoryServices.length} service{categoryServices.length > 1 ? 's' : ''}
                              </CardDescription>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="hidden sm:flex">
                              {categoryServices.filter((s: any) => s.is_active).length} actif(s)
                            </Badge>
                            {isExpanded ? (
                              <ChevronDown className="w-5 h-5 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="w-5 h-5 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="pt-0">
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead>
                              <tr className="border-b border-border">
                                <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Service</th>
                                <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Prix</th>
                                <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Statut</th>
                                <th className="text-center py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Visible</th>
                                <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {categoryServices.map((service: any) => {
                                const planDetails = getPlanDetails(service.name);
                                const isDetailsExpanded = expandedDetails.includes(service.id);

                                return (
                                  <>
                                    <tr key={service.id} className="border-b border-border/50 hover:bg-accent/30 transition-colors">
                                      <td className="py-3 px-4">
                                        <div className="flex items-start gap-2">
                                          <div className="flex-1">
                                            <p className="text-sm text-foreground font-medium">{service.name}</p>
                                            <p className="text-xs text-muted-foreground line-clamp-2 max-w-md">{service.description}</p>
                                          </div>
                                          {planDetails && (
                                            <TooltipProvider>
                                              <Tooltip>
                                                <TooltipTrigger asChild>
                                                  <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-6 w-6 p-0"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      toggleDetails(service.id);
                                                    }}
                                                  >
                                                    {isDetailsExpanded ? (
                                                      <EyeOff className="w-3 h-3 text-muted-foreground" />
                                                    ) : (
                                                      <Eye className="w-3 h-3 text-muted-foreground" />
                                                    )}
                                                  </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                  {isDetailsExpanded ? "Masquer détails" : "Voir détails (Admin)"}
                                                </TooltipContent>
                                              </Tooltip>
                                            </TooltipProvider>
                                          )}
                                        </div>
                                      </td>
                                      <td className="py-3 px-4">
                                        <span className="text-sm font-semibold text-foreground">
                                          {formatPrice(service.price, service.category)}
                                        </span>
                                      </td>
                                      <td className="py-3 px-4">
                                        <Badge
                                          className={
                                            service.is_active
                                              ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                                              : "bg-muted text-muted-foreground"
                                          }
                                        >
                                          {service.is_active ? "Actif" : "Inactif"}
                                        </Badge>
                                      </td>
                                      <td className="py-3 px-4 text-center">
                                        <Switch
                                          checked={service.is_active}
                                          onCheckedChange={(checked) =>
                                            toggleActiveMutation.mutate({ id: service.id, is_active: checked })
                                          }
                                        />
                                      </td>
                                      <td className="py-3 px-4">
                                        <div className="flex gap-1 justify-end">
                                          {planDetails && (
                                            <TooltipProvider>
                                              <Tooltip>
                                                <TooltipTrigger asChild>
                                                  <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => viewPlanDetails(service)}
                                                  >
                                                    <Info className="w-4 h-4 text-blue-400" />
                                                  </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>Détails du plan</TooltipContent>
                                              </Tooltip>
                                            </TooltipProvider>
                                          )}
                                          <TooltipProvider>
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <Button
                                                  variant="ghost"
                                                  size="icon"
                                                  onClick={() => handleEdit(service)}
                                                >
                                                  <Pencil className="w-4 h-4" />
                                                </Button>
                                              </TooltipTrigger>
                                              <TooltipContent>Modifier</TooltipContent>
                                            </Tooltip>
                                          </TooltipProvider>
                                          <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                              <Button variant="ghost" size="icon">
                                                <Trash2 className="w-4 h-4 text-destructive" />
                                              </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                              <AlertDialogHeader>
                                                <AlertDialogTitle>Supprimer ce service?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                  Cette action est irréversible. Le service "{service.name}" sera définitivement supprimé du catalogue.
                                                </AlertDialogDescription>
                                              </AlertDialogHeader>
                                              <AlertDialogFooter>
                                                <AlertDialogCancel>Annuler</AlertDialogCancel>
                                                <AlertDialogAction
                                                  onClick={() => deleteMutation.mutate(service.id)}
                                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                >
                                                  Supprimer
                                                </AlertDialogAction>
                                              </AlertDialogFooter>
                                            </AlertDialogContent>
                                          </AlertDialog>
                                        </div>
                                      </td>
                                    </tr>
                                    {/* Expandable Plan Details Row */}
                                    {isDetailsExpanded && planDetails && (
                                      <tr key={`${service.id}-details`}>
                                        <td colSpan={5} className="p-0">
                                          <div className="bg-accent/20 border-y border-border p-4">
                                            <div className="flex items-center gap-2 mb-3">
                                              <Shield className="w-4 h-4 text-amber-400" />
                                              <span className="text-xs font-medium text-amber-400 uppercase tracking-wider">
                                                Détails du plan (Admin privé)
                                              </span>
                                            </div>
                                            {renderPlanDetailsContent(planDetails, service.category)}
                                          </div>
                                        </td>
                                      </tr>
                                    )}
                                  </>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </CardContent>
                    </CollapsibleContent>
                  </Collapsible>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="bg-card border-border">
            <CardContent className="py-12">
              <div className="text-center">
                <Settings className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Aucun service trouvé</p>
                <p className="text-sm text-muted-foreground mt-1 mb-4">
                  Cliquez sur "Initialiser catalogue" pour ajouter les services officiels
                </p>
                <Button 
                  variant="hero" 
                  onClick={() => seedCatalogueMutation.mutate()}
                  disabled={seedCatalogueMutation.isPending}
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${seedCatalogueMutation.isPending ? 'animate-spin' : ''}`} />
                  Initialiser le catalogue
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Plan Details Dialog */}
        <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
          <DialogContent className="bg-card border-border max-w-lg">
            <DialogHeader>
              <div className="flex items-center gap-3">
                {selectedService && (
                  <div className={`p-2 rounded-lg ${categoryColors[selectedService.category] || 'bg-muted'}`}>
                    {(() => {
                      const Icon = categoryIcons[selectedService.category] || Settings;
                      return <Icon className="w-5 h-5" />;
                    })()}
                  </div>
                )}
                <div>
                  <DialogTitle>{selectedService?.name}</DialogTitle>
                  <DialogDescription>
                    {selectedService && formatPrice(selectedService.price, selectedService.category)}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
            
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 flex items-center gap-2">
              <Shield className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-medium text-amber-400">
                Informations réservées aux administrateurs
              </span>
            </div>
            
            <ScrollArea className="max-h-[60vh]">
              {selectedService && renderPlanDetailsContent(
                getPlanDetails(selectedService.name),
                selectedService.category
              )}
            </ScrollArea>
            
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDetailsDialogOpen(false)}>
                Fermer
              </Button>
              <Button variant="hero" onClick={() => {
                setDetailsDialogOpen(false);
                if (selectedService) handleEdit(selectedService);
              }}>
                <Pencil className="w-4 h-4 mr-2" />
                Modifier
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminServices;
