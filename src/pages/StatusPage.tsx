import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { 
  CheckCircle, 
  AlertTriangle, 
  AlertCircle, 
  Wrench, 
  Clock, 
  Wifi,
  Tv,
  Smartphone,
  Film,
  Globe,
  CreditCard,
  Server,
  RefreshCw,
  Activity,
  Shield,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { format, formatDistanceToNow } from "date-fns";
import { fr, enUS } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const serviceIcons: Record<string, any> = {
  internet: Wifi,
  tv: Tv,
  mobile: Smartphone,
  streaming: Film,
  portal: Globe,
  billing: CreditCard,
};

const serviceStatusConfig: Record<string, { label: string; labelEn: string; color: string; bgColor: string; badgeBg: string; badgeText: string }> = {
  operational: { label: "Opérationnel", labelEn: "Operational", color: "bg-green-500", bgColor: "bg-green-50 dark:bg-green-950/30", badgeBg: "bg-green-500", badgeText: "text-white" },
  degraded: { label: "Performance dégradée", labelEn: "Degraded", color: "bg-amber-500", bgColor: "bg-amber-50 dark:bg-amber-950/30", badgeBg: "bg-amber-500", badgeText: "text-white" },
  partial_outage: { label: "Panne partielle", labelEn: "Partial Outage", color: "bg-orange-500", bgColor: "bg-orange-50 dark:bg-orange-950/30", badgeBg: "bg-orange-500", badgeText: "text-white" },
  major_outage: { label: "Panne majeure", labelEn: "Major Outage", color: "bg-red-500", bgColor: "bg-red-50 dark:bg-red-950/30", badgeBg: "bg-red-500", badgeText: "text-white" },
  maintenance: { label: "Maintenance en cours", labelEn: "Under Maintenance", color: "bg-blue-500", bgColor: "bg-blue-50 dark:bg-blue-950/30", badgeBg: "bg-blue-500", badgeText: "text-white" },
};

const StatusPage = () => {
  const { language } = useLanguage();
  const isFr = language === "fr";
  const dateLocale = isFr ? fr : enUS;
  const [lastRefresh, setLastRefresh] = useState(new Date());

  // Fetch service status
  const { data: services, refetch: refetchServices } = useQuery({
    queryKey: ["public-service-status"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_status")
        .select("*")
        .order("display_name");
      if (error) throw error;
      return data;
    },
    refetchInterval: 60000,
  });

  const handleRefresh = async () => {
    await refetchServices();
    setLastRefresh(new Date());
  };

  // Calculate stats
  const operationalCount = services?.filter(s => s.status === "operational").length || 0;
  const degradedCount = services?.filter(s => s.status === "degraded").length || 0;
  const maintenanceCount = services?.filter(s => s.status === "maintenance").length || 0;
  const incidentCount = services?.filter(s => s.status === "partial_outage" || s.status === "major_outage").length || 0;
  const totalServices = services?.length || 0;

  // Determine overall status
  const getOverallStatus = () => {
    if (incidentCount > 0) return { label: isFr ? "Incident en cours" : "Ongoing Incident", severity: "critical", icon: AlertCircle };
    if (degradedCount > 0 || maintenanceCount > 0) return { label: isFr ? "Perturbation en cours" : "Service Disruption", severity: "warning", icon: AlertTriangle };
    return { label: isFr ? "Tous les systèmes opérationnels" : "All Systems Operational", severity: "success", icon: CheckCircle };
  };

  const overallStatus = getOverallStatus();

  const ServiceIcon = ({ name }: { name: string }) => {
    const Icon = serviceIcons[name] || Server;
    return <Icon className="w-5 h-5 text-white" />;
  };

  const getServiceCardBorderColor = (status: string) => {
    switch (status) {
      case "operational": return "border-l-green-500";
      case "degraded": return "border-l-amber-500";
      case "partial_outage": return "border-l-orange-500";
      case "major_outage": return "border-l-red-500";
      case "maintenance": return "border-l-blue-500";
      default: return "border-l-muted";
    }
  };

  // Calculate display uptime based on status
  const getDisplayUptime = (service: any) => {
    const baseUptime = service.uptime_percent || 100;
    if (service.status === "operational") return baseUptime;
    if (service.status === "degraded") return Math.min(baseUptime, 97);
    if (service.status === "partial_outage") return Math.min(baseUptime, 85);
    if (service.status === "major_outage") return Math.min(baseUptime, 60);
    if (service.status === "maintenance") return baseUptime;
    return baseUptime;
  };

  return (
    <div className="min-h-screen flex flex-col public-light" >
      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-8 max-w-6xl">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-primary/10">
              <Activity className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                {isFr ? "État des systèmes" : "System Status"}
              </h1>
              <p className="text-muted-foreground text-sm">
                {isFr ? "Surveillance et état des services Nivra" : "Nivra services monitoring and status"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground hidden md:inline-flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {isFr ? "Dernière vérification:" : "Last check:"} {format(lastRefresh, "HH:mm")}
            </span>
            <Button variant="outline" size="sm" onClick={handleRefresh} className="gap-2">
              <RefreshCw className="w-4 h-4" />
              {isFr ? "Actualiser" : "Refresh"}
            </Button>
          </div>
        </div>

        {/* Overall Status Banner */}
        <Card className={cn(
          "mb-8 overflow-hidden border-0 shadow-lg",
          overallStatus.severity === "success" && "bg-gradient-to-r from-green-500 to-emerald-600",
          overallStatus.severity === "warning" && "bg-gradient-to-r from-orange-500 to-amber-600",
          overallStatus.severity === "critical" && "bg-gradient-to-r from-red-500 to-rose-600",
        )}>
          <CardContent className="py-6 px-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-white/20 backdrop-blur-sm">
                <overallStatus.icon className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl md:text-2xl font-bold text-white">
                  {overallStatus.label}
                </h2>
                <p className="text-white/80 text-sm">
                  {operationalCount}/{totalServices} {isFr ? "services opérationnels" : "services operational"}
                </p>
              </div>
              <div className="hidden md:block text-right text-white/70 text-sm">
                <span className="flex items-center gap-1">
                  <Shield className="w-4 h-4" />
                  {format(lastRefresh, "HH:mm", { locale: dateLocale })}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Service Status Grid */}
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {services?.map((service) => {
              const config = serviceStatusConfig[service.status] || serviceStatusConfig.operational;
              const displayUptime = getDisplayUptime(service);
              
              return (
                <Card 
                  key={service.id} 
                  className={cn(
                    "border-l-4 transition-all hover:shadow-md",
                    getServiceCardBorderColor(service.status),
                    config.bgColor
                  )}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={cn("p-2 rounded-lg", config.color)}>
                          <ServiceIcon name={service.service_name} />
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground">{service.display_name}</h3>
                          <p className="text-xs text-muted-foreground line-clamp-1">{service.description}</p>
                        </div>
                      </div>
                    </div>
                    
                    <Badge className={cn("mb-3", config.badgeBg, config.badgeText)}>
                      {isFr ? config.label : config.labelEn}
                    </Badge>
                    
                    {service.status_message && (
                      <p className="text-xs text-muted-foreground mb-3 bg-muted/50 p-2 rounded">
                        {service.status_message}
                      </p>
                    )}
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{isFr ? "Disponibilité" : "Uptime"}</span>
                        <span className="font-medium">{displayUptime.toFixed(2)}%</span>
                      </div>
                      <Progress 
                        value={displayUptime} 
                        className="h-1.5"
                      />
                    </div>
                    
                    <div className="mt-3 pt-3 border-t border-border/50">
                      <p className="text-xs text-muted-foreground">
                        {isFr ? "Mis à jour" : "Updated"} {service.updated_at ? formatDistanceToNow(new Date(service.updated_at), { addSuffix: true, locale: dateLocale }) : "-"}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Stats Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <Card className="bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500">
                  <CheckCircle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-700 dark:text-green-400">{operationalCount}</p>
                  <p className="text-xs text-green-600 dark:text-green-500">{isFr ? "Opérationnels" : "Operational"}</p>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500">
                  <AlertTriangle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">{degradedCount}</p>
                  <p className="text-xs text-amber-600 dark:text-amber-500">{isFr ? "Dégradés" : "Degraded"}</p>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500">
                  <Wrench className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">{maintenanceCount}</p>
                  <p className="text-xs text-blue-600 dark:text-blue-500">{isFr ? "Maintenance" : "Maintenance"}</p>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-500">
                  <AlertCircle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-700 dark:text-red-400">{incidentCount}</p>
                  <p className="text-xs text-red-600 dark:text-red-500">{isFr ? "Incidents" : "Incidents"}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Contact Support */}
        <Card className="mt-8 bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
          <CardContent className="py-6 px-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h3 className="font-semibold text-foreground mb-1">
                  {isFr ? "Besoin d'aide?" : "Need help?"}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {isFr 
                    ? "Notre équipe de support est disponible pour vous aider." 
                    : "Our support team is available to help you."}
                </p>
              </div>
              <Button asChild>
                <a href="/nous-joindre">
                  {isFr ? "Nous contacter" : "Contact us"}
                  <ChevronRight className="w-4 h-4 ml-1" />
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>

      <Footer />
    </div>
  );
};

export default StatusPage;
