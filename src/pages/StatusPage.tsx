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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { format } from "date-fns";
import { fr, enUS } from "date-fns/locale";

const statusTypeIcons: Record<string, any> = {
  maintenance: Wrench,
  incident: AlertTriangle,
  info: Info,
  resolved: CheckCircle,
  scheduled: Clock,
};

const severityConfig: Record<string, { bg: string; text: string; border: string; label: string }> = {
  critical: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200", label: "Critique" },
  warning: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", label: "Avertissement" },
  info: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", label: "Information" },
  success: { bg: "bg-green-50", text: "text-green-700", border: "border-green-200", label: "Résolu" },
};

const statusTypeLabels: Record<string, string> = {
  maintenance: "Maintenance",
  incident: "Incident",
  info: "Annonce",
  resolved: "Résolu",
  scheduled: "Planifié",
};

const serviceIcons: Record<string, any> = {
  internet: Wifi,
  tv: Tv,
  mobile: Smartphone,
  streaming: Film,
  portal: Globe,
  billing: CreditCard,
};

const serviceStatusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  operational: { label: "Opérationnel", color: "bg-green-500", bgColor: "bg-green-50" },
  degraded: { label: "Dégradé", color: "bg-yellow-500", bgColor: "bg-yellow-50" },
  partial_outage: { label: "Panne partielle", color: "bg-orange-500", bgColor: "bg-orange-50" },
  major_outage: { label: "Panne majeure", color: "bg-red-500", bgColor: "bg-red-50" },
  maintenance: { label: "Maintenance", color: "bg-blue-500", bgColor: "bg-blue-50" },
};

const StatusPage = () => {
  const { language } = useLanguage();
  const isFr = language === "fr";
  const dateLocale = isFr ? fr : enUS;

  // Fetch all active announcements (public can see those with show_to_clients = true)
  const { data: announcements, isLoading: announcementsLoading } = useQuery({
    queryKey: ["public-system-status"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_status")
        .select("id, title, message, status_type, severity, starts_at, ends_at, affected_services, created_at")
        .eq("is_active", true)
        .eq("show_to_clients", true)
        .order("severity", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    refetchInterval: 60000,
  });

  // Fetch service status
  const { data: services, isLoading: servicesLoading } = useQuery({
    queryKey: ["public-service-status"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_status")
        .select("service_name, display_name, status, status_message, uptime_percent")
        .order("service_name");
      if (error) throw error;
      return data;
    },
    refetchInterval: 60000,
  });

  const operationalCount = services?.filter(s => s.status === "operational").length || 0;
  const totalServices = services?.length || 0;
  const allOperational = operationalCount === totalServices && totalServices > 0;

  const ServiceIcon = ({ name }: { name: string }) => {
    const Icon = serviceIcons[name] || Server;
    return <Icon className="w-5 h-5 text-white" />;
  };

  // Filter active announcements (within time window)
  const activeAnnouncements = announcements?.filter((a) => {
    const now = new Date();
    if (a.starts_at && new Date(a.starts_at) > now) return false;
    if (a.ends_at && new Date(a.ends_at) < now) return false;
    return true;
  }) || [];

  // Upcoming scheduled announcements
  const upcomingAnnouncements = announcements?.filter((a) => {
    const now = new Date();
    return a.starts_at && new Date(a.starts_at) > now;
  }) || [];

  // Past announcements (ended)
  const pastAnnouncements = announcements?.filter((a) => {
    const now = new Date();
    return a.ends_at && new Date(a.ends_at) < now;
  }).slice(0, 5) || [];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
        {/* Page Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            {isFr ? "État des systèmes" : "System Status"}
          </h1>
          <p className="text-muted-foreground">
            {isFr 
              ? "Consultez l'état de nos services et les annonces importantes." 
              : "Check the status of our services and important announcements."}
          </p>
        </div>

        {/* Overall Status Banner */}
        <Card className={cn(
          "mb-8 border-2",
          allOperational 
            ? "bg-green-50 border-green-200" 
            : "bg-amber-50 border-amber-200"
        )}>
          <CardContent className="py-6">
            <div className="flex items-center justify-center gap-3">
              {allOperational ? (
                <>
                  <CheckCircle className="w-8 h-8 text-green-600" />
                  <span className="text-xl font-semibold text-green-700">
                    {isFr ? "Tous les systèmes sont opérationnels" : "All systems operational"}
                  </span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-8 h-8 text-amber-600" />
                  <span className="text-xl font-semibold text-amber-700">
                    {isFr 
                      ? `${operationalCount}/${totalServices} services opérationnels` 
                      : `${operationalCount}/${totalServices} services operational`}
                  </span>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Active Announcements */}
        {activeAnnouncements.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              {isFr ? "Annonces en cours" : "Active Announcements"}
            </h2>
            <div className="space-y-4">
              {activeAnnouncements.map((announcement) => {
                const config = severityConfig[announcement.severity] || severityConfig.info;
                const Icon = statusTypeIcons[announcement.status_type] || Info;
                return (
                  <Card key={announcement.id} className={cn("border-2", config.border, config.bg)}>
                    <CardContent className="py-4">
                      <div className="flex items-start gap-3">
                        <div className={cn("p-2 rounded-lg", config.text, "bg-white/50")}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <h3 className={cn("font-semibold", config.text)}>
                              {announcement.title}
                            </h3>
                            <Badge variant="outline" className={cn("text-xs", config.text, config.border)}>
                              {statusTypeLabels[announcement.status_type] || announcement.status_type}
                            </Badge>
                          </div>
                          <p className="text-sm text-foreground/80 mb-2">
                            {announcement.message}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            {announcement.starts_at && (
                              <span>
                                {isFr ? "Début:" : "Start:"} {format(new Date(announcement.starts_at), "PPp", { locale: dateLocale })}
                              </span>
                            )}
                            {announcement.ends_at && (
                              <span>
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
          </section>
        )}

        {/* Upcoming Announcements */}
        {upcomingAnnouncements.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-500" />
              {isFr ? "Maintenances planifiées" : "Scheduled Maintenance"}
            </h2>
            <div className="space-y-4">
              {upcomingAnnouncements.map((announcement) => {
                const Icon = statusTypeIcons[announcement.status_type] || Clock;
                return (
                  <Card key={announcement.id} className="border-2 border-blue-200 bg-blue-50">
                    <CardContent className="py-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg text-blue-700 bg-white/50">
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-blue-700 mb-1">
                            {announcement.title}
                          </h3>
                          <p className="text-sm text-foreground/80 mb-2">
                            {announcement.message}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            {announcement.starts_at && (
                              <span>
                                {isFr ? "Prévu le:" : "Scheduled:"} {format(new Date(announcement.starts_at), "PPp", { locale: dateLocale })}
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
          </section>
        )}

        {/* Service Status Grid */}
        {services && services.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Server className="w-5 h-5 text-primary" />
              {isFr ? "État des services" : "Service Status"}
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {services.map((service) => {
                const config = serviceStatusConfig[service.status] || serviceStatusConfig.operational;
                return (
                  <Card key={service.service_name} className={cn("border", config.bgColor)}>
                    <CardContent className="py-4">
                      <div className="flex items-center gap-3 mb-2">
                        <div className={cn("p-2 rounded-lg", config.color)}>
                          <ServiceIcon name={service.service_name} />
                        </div>
                        <span className="font-medium text-sm">{service.display_name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={cn("w-2 h-2 rounded-full", config.color)} />
                        <span className="text-sm text-muted-foreground">{config.label}</span>
                      </div>
                      {service.status_message && (
                        <p className="text-xs text-muted-foreground mt-2">{service.status_message}</p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        )}

        {/* No active issues message */}
        {activeAnnouncements.length === 0 && upcomingAnnouncements.length === 0 && (
          <Card className="bg-green-50 border-green-200 mb-8">
            <CardContent className="py-8 text-center">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-green-700 mb-1">
                {isFr ? "Aucune annonce active" : "No Active Announcements"}
              </h3>
              <p className="text-sm text-green-600">
                {isFr 
                  ? "Tous nos services fonctionnent normalement." 
                  : "All our services are functioning normally."}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Past Announcements */}
        {pastAnnouncements.length > 0 && (
          <section>
            <h2 className="text-xl font-semibold mb-4 text-muted-foreground flex items-center gap-2">
              <Clock className="w-5 h-5" />
              {isFr ? "Annonces récentes terminées" : "Recent Past Announcements"}
            </h2>
            <div className="space-y-3">
              {pastAnnouncements.map((announcement) => (
                <Card key={announcement.id} className="bg-muted/30">
                  <CardContent className="py-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium text-sm text-muted-foreground">
                          {announcement.title}
                        </h3>
                        <p className="text-xs text-muted-foreground/70">
                          {announcement.ends_at && format(new Date(announcement.ends_at), "PPp", { locale: dateLocale })}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs text-green-600 border-green-300">
                        {isFr ? "Terminé" : "Resolved"}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default StatusPage;
