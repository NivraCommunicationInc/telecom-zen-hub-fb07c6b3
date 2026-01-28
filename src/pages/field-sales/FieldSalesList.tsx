/**
 * FieldSalesList - iOS-style list of all sales made by the field sales rep
 */
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Search, Clock, CheckCircle, AlertCircle, 
  Loader2, Calendar, Wifi, Tv, Smartphone, Package,
  ChevronRight, RefreshCw, Plus
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import StaffBackground from "@/components/staff/StaffBackground";
import { IOSHeader } from "@/components/field-sales/ios/IOSHeader";
import { IOSBottomNav } from "@/components/field-sales/ios/IOSBottomNav";
import { IOSWidgetCard } from "@/components/field-sales/ios/IOSWidgetCard";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ServiceItem {
  offer_id: string;
  name: string;
  category: string;
  price_monthly: number;
  price_setup: number;
  quantity: number;
}

interface Sale {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  total_amount: number;
  payment_status: string;
  payment_method: string;
  sync_status: string;
  created_at: string;
  services: ServiceItem[];
}

const getCategoryIcon = (category: string) => {
  switch (category) {
    case "internet": return <Wifi className="h-5 w-5 text-blue-400" />;
    case "tv": return <Tv className="h-5 w-5 text-purple-400" />;
    case "mobile": return <Smartphone className="h-5 w-5 text-green-400" />;
    case "bundle": return <Package className="h-5 w-5 text-orange-400" />;
    default: return <Package className="h-5 w-5 text-slate-400" />;
  }
};

const getServiceSummary = (services: ServiceItem[]) => {
  if (!services || services.length === 0) return { icon: <Package className="h-5 w-5" />, label: "Aucun service" };
  
  if (services.length === 1) {
    return { 
      icon: getCategoryIcon(services[0].category), 
      label: services[0].name,
    };
  }
  
  const categories = [...new Set(services.map(s => s.category))];
  if (categories.length === 1) {
    return { 
      icon: getCategoryIcon(categories[0]), 
      label: `${services.length} services`,
    };
  }
  
  return { 
    icon: <Package className="h-5 w-5 text-orange-400" />, 
    label: `${services.length} services`,
  };
};

export default function FieldSalesList() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sales, setSales] = useState<Sale[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState(searchParams.get("filter") || "all");

  useEffect(() => {
    loadSales();
  }, []);

  const loadSales = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        toast.error("Session expirée");
        navigate("/field-sales");
        return;
      }

      const { data, error } = await supabase
        .from("field_sales_orders")
        .select("id, customer_name, customer_email, customer_phone, total_amount, payment_status, payment_method, sync_status, created_at, services")
        .eq("salesperson_id", session.user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      const parsedSales = (data || []).map(sale => ({
        ...sale,
        services: Array.isArray(sale.services) ? (sale.services as unknown as ServiceItem[]) : [],
      }));
      
      setSales(parsedSales);
    } catch (error) {
      console.error("Error loading sales:", error);
      toast.error("Erreur de chargement");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadSales();
  };

  const filteredSales = sales.filter((sale) => {
    const matchesSearch = 
      sale.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sale.customer_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sale.customer_phone.includes(searchQuery);

    if (activeTab === "all") return matchesSearch;
    if (activeTab === "pending") return matchesSearch && sale.payment_status === "pending";
    if (activeTab === "confirmed") return matchesSearch && sale.payment_status === "confirmed";
    return matchesSearch;
  });

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "confirmed":
        return { label: "Payé", icon: CheckCircle, className: "bg-emerald-500/20 text-emerald-400" };
      case "pending":
        return { label: "En attente", icon: Clock, className: "bg-amber-500/20 text-amber-400" };
      case "failed":
        return { label: "Échec", icon: AlertCircle, className: "bg-red-500/20 text-red-400" };
      default:
        return { label: status, icon: Clock, className: "bg-slate-500/20 text-slate-400" };
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center relative bg-slate-950">
        <StaffBackground />
        <div className="flex flex-col items-center gap-4 z-10">
          <div className="p-4 rounded-2xl bg-blue-500/20">
            <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
          </div>
          <p className="text-slate-400 font-medium">Chargement des ventes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative bg-slate-950">
      <StaffBackground />
      
      <IOSHeader
        title="Mes Ventes"
        subtitle={`${sales.length} vente(s)`}
        onRefresh={handleRefresh}
        isRefreshing={refreshing}
        rightContent={
          <Button
            size="icon"
            onClick={() => navigate("/field-sales/pos")}
            className="bg-orange-500 hover:bg-orange-400 text-white rounded-xl h-9 w-9"
          >
            <Plus className="h-5 w-5" />
          </Button>
        }
      />

      <main className="relative z-10 pb-24">
        <div className="sticky top-[60px] z-30 bg-slate-950/95 backdrop-blur-xl border-b border-slate-800/60 px-4 py-3 space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher..."
              className="pl-10 bg-slate-900/80 border-slate-800/60 text-white placeholder:text-slate-600 rounded-xl"
            />
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full bg-slate-900/80 border border-slate-800/60 p-1 rounded-2xl">
              <TabsTrigger 
                value="all" 
                className="flex-1 rounded-xl data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400 text-sm"
              >
                Toutes ({sales.length})
              </TabsTrigger>
              <TabsTrigger 
                value="pending" 
                className="flex-1 rounded-xl data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400 text-sm"
              >
                En attente ({sales.filter(s => s.payment_status === "pending").length})
              </TabsTrigger>
              <TabsTrigger 
                value="confirmed" 
                className="flex-1 rounded-xl data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400 text-sm"
              >
                Payées ({sales.filter(s => s.payment_status === "confirmed").length})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="p-4 space-y-3">
          <AnimatePresence mode="popLayout">
            {filteredSales.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <IOSWidgetCard className="p-12 text-center">
                  <Package className="h-12 w-12 text-slate-700 mx-auto mb-4" />
                  <p className="text-slate-400 mb-4">
                    {searchQuery ? "Aucune vente trouvée" : "Aucune vente encore"}
                  </p>
                  <Button
                    onClick={() => navigate("/field-sales/pos")}
                    className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 rounded-xl"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Créer une vente
                  </Button>
                </IOSWidgetCard>
              </motion.div>
            ) : (
              filteredSales.map((sale, index) => {
                const status = getStatusConfig(sale.payment_status);
                const StatusIcon = status.icon;
                const serviceInfo = getServiceSummary(sale.services);
                
                return (
                  <motion.button
                    key={sale.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: index * 0.03 }}
                    onClick={() => navigate(`/field-sales/sales/${sale.id}`)}
                    className="w-full text-left"
                  >
                    <IOSWidgetCard className="p-4 hover:border-orange-500/30 transition-all active:scale-[0.98]">
                      <div className="flex items-center gap-3">
                        {/* Service Icon */}
                        <div className="p-2.5 rounded-xl bg-slate-800/80 shrink-0">
                          {serviceInfo.icon}
                        </div>
                        
                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <h3 className="text-white font-medium truncate">{sale.customer_name}</h3>
                            <p className="text-orange-400 font-bold shrink-0 ml-2">
                              {sale.total_amount.toFixed(2)} $
                            </p>
                          </div>
                          
                          <p className="text-sm text-slate-500 truncate mb-1.5">
                            {serviceInfo.label}
                          </p>
                          
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-xs text-slate-600">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(sale.created_at), "d MMM, HH:mm", { locale: fr })}
                            </div>
                            
                            <div className={cn(
                              "flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium",
                              status.className
                            )}>
                              <StatusIcon className="h-3 w-3" />
                              {status.label}
                            </div>
                          </div>
                        </div>
                        
                        <ChevronRight className="h-5 w-5 text-slate-700 shrink-0" />
                      </div>
                      
                      {sale.sync_status === "pending" && (
                        <div className="mt-3 pt-3 border-t border-slate-800/40">
                          <div className="flex items-center gap-2 text-xs text-amber-400">
                            <Clock className="h-3 w-3" />
                            En attente de synchronisation
                          </div>
                        </div>
                      )}
                    </IOSWidgetCard>
                  </motion.button>
                );
              })
            )}
          </AnimatePresence>
        </div>
      </main>

      <IOSBottomNav />
    </div>
  );
}
