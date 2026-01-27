/**
 * FieldSalesList - Professional list of all sales made by the field sales rep
 * Uses correct DB schema with services JSONB
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  Search, Clock, CheckCircle, AlertCircle, 
  Loader2, Calendar, Wifi, Tv, Smartphone, Package,
  ChevronRight, RefreshCw
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import StaffBackground from "@/components/staff/StaffBackground";
import { FieldSalesNav } from "@/components/field-sales/FieldSalesNav";
import { toast } from "sonner";

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
    case "internet": return <Wifi className="h-4 w-4 text-blue-400" />;
    case "tv": return <Tv className="h-4 w-4 text-purple-400" />;
    case "mobile": return <Smartphone className="h-4 w-4 text-green-400" />;
    case "bundle": return <Package className="h-4 w-4 text-orange-400" />;
    default: return <Package className="h-4 w-4 text-slate-400" />;
  }
};

const getServiceSummary = (services: ServiceItem[]) => {
  if (!services || services.length === 0) return { icon: <Package className="h-4 w-4" />, label: "Aucun service" };
  
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
      label: `${services.length} services ${categories[0]}`,
    };
  }
  
  return { 
    icon: <Package className="h-4 w-4 text-orange-400" />, 
    label: `${services.length} services (multi)`,
  };
};

export default function FieldSalesList() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sales, setSales] = useState<Sale[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");

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
      
      // Parse services JSON safely
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
        return { label: "Payé", icon: CheckCircle, className: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" };
      case "pending":
        return { label: "En attente", icon: Clock, className: "text-amber-400 bg-amber-500/10 border-amber-500/30" };
      case "failed":
        return { label: "Échec", icon: AlertCircle, className: "text-red-400 bg-red-500/10 border-red-500/30" };
      default:
        return { label: status, icon: Clock, className: "text-slate-400 bg-slate-500/10 border-slate-500/30" };
    }
  };

  const getPaymentMethodLabel = (method: string) => {
    switch (method) {
      case "interac": return "💳 Interac";
      case "paypal": return "🅿️ PayPal";
      case "deferred": return "⏳ Différé";
      default: return method;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center relative">
        <StaffBackground />
        <Loader2 className="h-10 w-10 animate-spin text-orange-400 z-10" />
      </div>
    );
  }

  return (
    <div className="min-h-screen relative pb-20">
      <StaffBackground />
      
      {/* Header */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-xl border-b border-slate-700/50">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-xl font-bold text-white">Mes Ventes</h1>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              disabled={refreshing}
              className="text-slate-400 hover:text-white"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
          </div>
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher client, email, téléphone..."
              className="pl-10 bg-slate-800/50 border-slate-600 text-white placeholder:text-slate-500"
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="px-4 pb-3">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full grid grid-cols-3 bg-slate-800/50 border border-slate-700">
              <TabsTrigger value="all" className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400">
                Toutes ({sales.length})
              </TabsTrigger>
              <TabsTrigger value="pending" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400">
                En attente ({sales.filter(s => s.payment_status === "pending").length})
              </TabsTrigger>
              <TabsTrigger value="confirmed" className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400">
                Payées ({sales.filter(s => s.payment_status === "confirmed").length})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </header>

      <main className="p-4 space-y-3 relative z-10">
        {filteredSales.length === 0 ? (
          <Card className="border-slate-700/50 bg-slate-900/60 backdrop-blur-xl">
            <CardContent className="py-12 text-center">
              <Package className="h-12 w-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400 mb-4">
                {searchQuery ? "Aucune vente trouvée" : "Aucune vente encore"}
              </p>
              <Button
                onClick={() => navigate("/field-sales/new-sale")}
                className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400"
              >
                Créer une vente
              </Button>
            </CardContent>
          </Card>
        ) : (
          filteredSales.map((sale) => {
            const status = getStatusConfig(sale.payment_status);
            const StatusIcon = status.icon;
            const serviceInfo = getServiceSummary(sale.services);
            
            return (
              <button
                key={sale.id}
                onClick={() => navigate(`/field-sales/sales/${sale.id}`)}
                className="w-full text-left"
              >
                <Card className="border-slate-700/50 bg-slate-900/60 backdrop-blur-xl hover:border-orange-500/30 transition-all">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      {/* Service Icon */}
                      <div className="p-2 rounded-lg bg-slate-800/50 shrink-0">
                        {serviceInfo.icon}
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="text-white font-medium truncate">{sale.customer_name}</h3>
                          <p className="text-orange-400 font-bold text-sm shrink-0 ml-2">
                            {sale.total_amount.toFixed(2)} $
                          </p>
                        </div>
                        
                        <p className="text-sm text-slate-400 truncate mb-2">
                          {serviceInfo.label}
                        </p>
                        
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(sale.created_at), "d MMM, HH:mm", { locale: fr })}
                            <span className="text-slate-600">•</span>
                            <span>{getPaymentMethodLabel(sale.payment_method)}</span>
                          </div>
                          
                          <Badge variant="outline" className={`text-[10px] ${status.className}`}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {status.label}
                          </Badge>
                        </div>
                        
                        {sale.sync_status === "pending" && (
                          <div className="mt-2">
                            <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-500/30 bg-amber-500/10">
                              ⏳ Non synchronisé
                            </Badge>
                          </div>
                        )}
                      </div>
                      
                      <ChevronRight className="h-5 w-5 text-slate-600 shrink-0" />
                    </div>
                  </CardContent>
                </Card>
              </button>
            );
          })
        )}
      </main>

      <FieldSalesNav />
    </div>
  );
}
