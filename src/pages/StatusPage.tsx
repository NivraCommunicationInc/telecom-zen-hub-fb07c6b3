import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { 
  CheckCircle, 
  AlertTriangle, 
  AlertCircle, 
  Wrench, 
  Clock, 
  Info,
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
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { format, formatDistanceToNow } from "date-fns";
import { fr, enUS } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const statusTypeIcons: Record<string, any> = {
  maintenance: Wrench,
  incident: AlertTriangle,
  info: Info,
  resolved: CheckCircle,
  scheduled: Clock,
};

const severityConfig: Record<string, { bg: string; text: string; border: string; label: string; icon: any }> = {
  critical: { bg: "bg-red-500", text: "text-white", border: "border-red-500", label: "Critique", icon: AlertCircle },
  warning: { bg: "bg-orange-500", text: "text-white", border: "border-orange-500", label: "Panne partielle", icon: AlertTriangle },
  info: { bg: "bg-blue-500", text: "text-white", border: "border-blue-500", label: "Information", icon: Info },
  success: { bg: "bg-green-500", text: "text-white", border: "border-green-500", label: "Opérationnel", icon: CheckCircle },
};

const serviceIcons: Record<string, any> = {
  internet: Wifi,
  tv: Tv,
  mobile: Smartphone,
  streaming: Film,
  portal: Globe,
  billing: CreditCard,
};

const serviceStatusConfig: Record<string, { label: string; color: string; bgColor: string; badgeBg: string; badgeText: string }> = {
  operational: { label: "Opérationnel", color: "bg-green-500", bgColor: "bg-green-50 dark:bg-green-950/30", badgeBg: "bg-green-500", badgeText: "text-white" },
  degraded: { label: "Performance dégradée", color: "bg-amber-500", bgColor: "bg-amber-50 dark:bg-amber-950/30", badgeBg: "bg-amber-500", badgeText: "text-white" },
  partial_outage: { label: "Panne partielle", color: "bg-orange-500", bgColor: "bg-orange-50 dark:bg-orange-950/30", badgeBg: "bg-orange-500", badgeText: "text-white" },
  major_outage: { label: "Panne majeure", color: "bg-red-500", bgColor: "bg-red-50 dark:bg-red-950/30", badgeBg: "bg-red-500", badgeText: "text-white" },
  maintenance: { label: "Maintenance en cours", color: "bg-blue-500", bgColor: "bg-blue-50 dark:bg-blue-950/30", badgeBg: "bg-blue-500", badgeText: "text-white" },
};

const StatusPage = () => {
  const { language } = useLanguage();
  const isFr = language === "fr";
  const dateLocale = isFr ? fr : enUS;
  const [lastRefresh, setLastRefresh] = useState(new Date());

  // Fetch service status
  const { data: services, isLoading: servicesLoading, refetch: refetchServices } = useQuery({
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

  // Fetch all active announcements
  const { data: announcements, isLoading: announcementsLoading, refetch: refetchAnnouncements } = useQuery({
    queryKey: ["public-system-status"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_status")
        .select("*")
        .eq("is_active", true)
        .eq("show_to_clients", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    refetchInterval: 60000,
  });

  const handleRefresh = async () => {
    await Promise.all([refetchServices(), refetchAnnouncements()]);
    setLastRefresh(new Date());
  };

  // Calculate stats
  const operationalCount = services?.filter(s => s.status === "operational").length || 0;
  const degradedCount = services?.filter(s => s.status === "degraded").length || 0;
  const maintenanceCount = services?.filter(s => s.status === "maintenance").length || 0;
  const incidentCount = services?.filter(s => s.status === "partial_outage" || s.status === "major_outage").length || 0;
  const totalServices = services?.length || 0;
  const allOperational = operationalCount === totalServices && totalServices > 0;

  // Filter announcements
  const activeAnnouncements = announcements?.filter((a) => {
    const now = new Date();
    if (a.starts_at && new Date(a.starts_at) > now) return false;
    if (a.ends_at && new Date(a.ends_at) < now) return false;
    return true;
  }) || [];

  const upcomingAnnouncements = announcements?.filter((a) => {
    const now = new Date();
    return a.starts_at && new Date(a.starts_at) > now;
  }) || [];

  // Determine overall status
  const getOverallStatus = () => {
    if (incidentCount > 0) return { label: "Incident en cours", severity: "critical", icon: AlertCircle };
    if (degradedCount > 0 || maintenanceCount > 0) return { label: "Panne partielle", severity: "warning", icon: AlertTriangle };
    return { label: "Tous les systèmes opérationnels", severity: "success", icon: CheckCircle };
  };

  const overallStatus = getOverallStatus();
  const overallConfig = severityConfig[overallStatus.severity];

  const ServiceIcon = ({ name }: { name: string }) => {
    const Icon = serviceIcons[name] || Server;
    return <Icon className="w-5 h-5" />;
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

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background via-background to-muted/20">
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

        {/* Tabs for navigation */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-flex">
            <TabsTrigger value="overview" className="gap-2">
              <Server className="w-4 h-4 hidden sm:inline" />
              {isFr ? "Vue d'ensemble" : "Overview"}
            </TabsTrigger>
            <TabsTrigger value="announcements" className="gap-2">
              <Info className="w-4 h-4 hidden sm:inline" />
              {isFr ? `Annonces (${activeAnnouncements.length + upcomingAnnouncements.length})` : `Announcements (${activeAnnouncements.length + upcomingAnnouncements.length})`}
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <Clock className="w-4 h-4 hidden sm:inline" />
              {isFr ? "Historique" : "History"}
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Service Status Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {services?.map((service) => {
                const config = serviceStatusConfig[service.status] || serviceStatusConfig.operational;
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
                            <span className="sr-only">{service.display_name}</span>
                          </div>
                          <div>
                            <h3 className="font-semibold text-foreground">{service.display_name}</h3>
                            <p className="text-xs text-muted-foreground line-clamp-1">{service.description}</p>
                          </div>
                        </div>
                        <ExternalLink className="w-4 h-4 text-muted-foreground/50" />
                      </div>
                      
                      <Badge className={cn("mb-3", config.badgeBg, config.badgeText)}>
                        {config.label}
                      </Badge>
                      
                      {service.status_message && (
                        <p className="text-xs text-muted-foreground mb-3 bg-muted/50 p-2 rounded">
                          {service.status_message}
                        </p>
                      )}
                      
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">{isFr ? "Disponibilité" : "Uptime"}</span>
                          <span className="font-medium">{service.uptime_percent?.toFixed(2) || "100.00"}%</span>
                        </div>
                        <Progress 
                          value={service.uptime_percent || 100} 
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
          </TabsContent>

          {/* Announcements Tab */}
          <TabsContent value="announcements" className="space-y-6">
            {activeAnnouncements.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                  {isFr ? "Annonces actives" : "Active Announcements"}
                </h2>
                {activeAnnouncements.map((announcement) => {
                  const Icon = statusTypeIcons[announcement.status_type] || Info;
                  return (
                    <Card key={announcement.id} className="border-l-4 border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/20">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          <div className="p-2 rounded-lg bg-amber-500">
                            <Icon className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-foreground">{announcement.title}</h3>
                              <Badge variant="outline" className="text-xs">
                                {announcement.status_type === "maintenance" ? "Maintenance" : announcement.status_type === "incident" ? "Incident" : "Annonce"}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mb-3">{announcement.message}</p>
                            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                              {announcement.starts_at && (
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {isFr ? "Début:" : "Start:"} {format(new Date(announcement.starts_at), "PPp", { locale: dateLocale })}
                                </span>
                              )}
                              {announcement.ends_at && (
                                <span className="flex items-center gap-1">
                                  <ChevronRight className="w-3 h-3" />
                                  {isFr ? "Fin:" : "End:"} {format(new Date(announcement.ends_at), "PPp", { locale: dateLocale })}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {upcomingAnnouncements.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Clock className="w-5 h-5 text-blue-500" />
                  {isFr ? "Maintenances planifiées" : "Scheduled Maintenance"}
                </h2>
                {upcomingAnnouncements.map((announcement) => {
                  const Icon = statusTypeIcons[announcement.status_type] || Clock;
                  return (
                    <Card key={announcement.id} className="border-l-4 border-l-blue-500 bg-blue-50/50 dark:bg-blue-950/20">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          <div className="p-2 rounded-lg bg-blue-500">
                            <Icon className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold text-foreground mb-1">{announcement.title}</h3>
                            <p className="text-sm text-muted-foreground mb-3">{announcement.message}</p>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {isFr ? "Prévu le:" : "Scheduled:"} {format(new Date(announcement.starts_at!), "PPp", { locale: dateLocale })}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {activeAnnouncements.length === 0 && upcomingAnnouncements.length === 0 && (
              <Card className="bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-900">
                <CardContent className="py-12 text-center">
                  <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-green-700 dark:text-green-400 mb-2">
                    {isFr ? "Aucune annonce active" : "No Active Announcements"}
                  </h3>
                  <p className="text-muted-foreground">
                    {isFr 
                      ? "Tous nos services fonctionnent normalement. Aucune maintenance planifiée." 
                      : "All our services are functioning normally. No scheduled maintenance."}
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="space-y-4">
            <Card className="bg-muted/30">
              <CardContent className="py-12 text-center">
                <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-muted-foreground mb-2">
                  {isFr ? "Historique des incidents" : "Incident History"}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {isFr 
                    ? "L'historique des 30 derniers jours sera bientôt disponible." 
                    : "The last 30 days history will be available soon."}
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

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
