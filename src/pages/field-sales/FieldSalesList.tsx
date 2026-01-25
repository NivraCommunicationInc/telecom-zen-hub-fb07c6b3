/**
 * FieldSalesList - List of all sales made by the field sales rep
 * Includes filters, search, and status indicators
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Search, Filter, Clock, CheckCircle, AlertCircle, 
  Loader2, ChevronRight, Calendar
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import StaffBackground from "@/components/staff/StaffBackground";
import { FieldSalesNav } from "@/components/field-sales/FieldSalesNav";

interface Sale {
  id: string;
  customer_name: string;
  customer_email: string;
  total_amount: number;
  payment_status: string;
  payment_method: string;
  sync_status: string;
  created_at: string;
  service_type: string;
}

const getServiceInfo = (serviceType: string) => {
  switch (serviceType) {
    case "internet":
      return { icon: "🌐", label: "Internet" };
    case "tv":
      return { icon: "📺", label: "Télévision" };
    case "mobile":
      return { icon: "📱", label: "Mobile" };
    case "bundle":
      return { icon: "📦", label: "Forfait" };
    default:
      return { icon: "📋", label: "Service" };
  }
};

export default function FieldSalesList() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState<Sale[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  useEffect(() => {
    loadSales();
  }, []);

  const loadSales = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const { data, error } = await supabase
        .from("field_sales_orders")
        .select("id, customer_name, customer_email, total_amount, payment_status, payment_method, sync_status, created_at, service_type")
        .eq("salesperson_id", session.user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setSales((data as unknown as Sale[]) || []);
    } catch (error) {
      console.error("Error loading sales:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredSales = sales.filter((sale) => {
    const matchesSearch = 
      sale.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sale.customer_email.toLowerCase().includes(searchQuery.toLowerCase());

    if (activeTab === "all") return matchesSearch;
    if (activeTab === "pending") return matchesSearch && sale.payment_status === "pending";
    if (activeTab === "confirmed") return matchesSearch && sale.payment_status === "confirmed";
    return matchesSearch;
  });

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "confirmed":
        return { label: "Payé", icon: CheckCircle, className: "text-emerald-400 bg-emerald-500/10" };
      case "pending":
        return { label: "En attente", icon: Clock, className: "text-amber-400 bg-amber-500/10" };
      case "failed":
        return { label: "Échec", icon: AlertCircle, className: "text-red-400 bg-red-500/10" };
      default:
        return { label: status, icon: Clock, className: "text-slate-400 bg-slate-500/10" };
    }
  };

  const getPaymentIcon = (method: string) => {
    switch (method) {
      case "interac": return "💳";
      case "paypal": return "🅿️";
      case "deferred": return "⏳";
      default: return "📋";
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
      <header className="sticky top-0 z-40 bg-slate-900/80 backdrop-blur-xl border-b border-slate-700/50">
        <div className="px-4 py-4">
          <h1 className="text-xl font-bold text-white mb-3">Mes Ventes</h1>
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher client, plan..."
              className="pl-10 bg-slate-800/50 border-slate-600 text-white placeholder:text-slate-500"
            />
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="px-4">
          <TabsList className="w-full bg-slate-800/50 border border-slate-700">
            <TabsTrigger value="all" className="flex-1 data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400">
              Toutes ({sales.length})
            </TabsTrigger>
            <TabsTrigger value="pending" className="flex-1 data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400">
              En attente ({sales.filter(s => s.payment_status === "pending").length})
            </TabsTrigger>
            <TabsTrigger value="confirmed" className="flex-1 data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400">
              Payées ({sales.filter(s => s.payment_status === "confirmed").length})
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </header>

      <main className="p-4 space-y-3 relative z-10">
        {filteredSales.length === 0 ? (
          <Card className="border-slate-700/50 bg-slate-900/60 backdrop-blur-xl">
            <CardContent className="py-12 text-center">
              <p className="text-slate-400">Aucune vente trouvée</p>
              <Button
                onClick={() => navigate("/field-sales/new-sale")}
                className="mt-4 bg-orange-500 hover:bg-orange-400"
              >
                Créer une vente
              </Button>
            </CardContent>
          </Card>
        ) : (
          filteredSales.map((sale) => {
            const status = getStatusConfig(sale.payment_status);
            const StatusIcon = status.icon;
            
            return (
              <button
                key={sale.id}
                onClick={() => navigate(`/field-sales/sales/${sale.id}`)}
                className="w-full text-left"
              >
                <Card className="border-slate-700/50 bg-slate-900/60 backdrop-blur-xl hover:border-orange-500/30 transition-all">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{getServiceInfo(sale.service_type).icon}</span>
                          <h3 className="text-white font-medium truncate">{sale.customer_name}</h3>
                        </div>
                        <p className="text-sm text-slate-400 truncate">{getServiceInfo(sale.service_type).label}</p>
                        <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(sale.created_at), "d MMM yyyy, HH:mm", { locale: fr })}
                        </div>
                      </div>
                      
                      <div className="text-right flex flex-col items-end gap-2">
                        <p className="text-orange-400 font-bold">{sale.total_amount.toFixed(2)} $</p>
                        <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${status.className}`}>
                          <StatusIcon className="h-3 w-3" />
                          {status.label}
                        </div>
                        {sale.sync_status === "pending" && (
                          <span className="text-[10px] text-amber-400">⏳ Non sync</span>
                        )}
                      </div>
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
