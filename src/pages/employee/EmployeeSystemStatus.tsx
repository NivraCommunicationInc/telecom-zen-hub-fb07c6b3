import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertTriangle,
  Info,
  CheckCircle,
  Clock,
  Wrench,
  Radio,
  Users,
  Briefcase,
  HardHat,
  Wifi,
  Tv,
  Smartphone,
  Film,
  Globe,
  CreditCard,
  Activity,
  RefreshCw,
  Zap,
  Server,
  ArrowLeft,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { Link } from "react-router-dom";

// Service icons mapping
const serviceIcons: Record<string, any> = {
  internet: Wifi,
  tv: Tv,
  mobile: Smartphone,
  streaming: Film,
  portal: Globe,
  billing: CreditCard,
};

// Service status configuration
const serviceStatusConfig: Record<string, { label: string; color: string; bgColor: string; textColor: string }> = {
  operational: { label: "Opérationnel", color: "bg-green-500", bgColor: "bg-green-50", textColor: "text-green-700" },
  degraded: { label: "Performance dégradée", color: "bg-yellow-500", bgColor: "bg-yellow-50", textColor: "text-yellow-700" },
  partial_outage: { label: "Panne partielle", color: "bg-orange-500", bgColor: "bg-orange-50", textColor: "text-orange-700" },
  major_outage: { label: "Panne majeure", color: "bg-red-500", bgColor: "bg-red-50", textColor: "text-red-700" },
  maintenance: { label: "Maintenance", color: "bg-blue-500", bgColor: "bg-blue-50", textColor: "text-blue-700" },
};

const statusTypeConfig: Record<string, { label: string; icon: any; color: string }> = {
  maintenance: { label: "Maintenance", icon: Wrench, color: "bg-amber-500" },
  incident: { label: "Incident", icon: AlertTriangle, color: "bg-red-500" },
  info: { label: "Information", icon: Info, color: "bg-blue-500" },
  resolved: { label: "Résolu", icon: CheckCircle, color: "bg-green-500" },
  scheduled: { label: "Planifié", icon: Clock, color: "bg-purple-500" },
};

const severityConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; color: string }> = {
  critical: { label: "Critique", variant: "destructive", color: "border-red-500 bg-red-50 text-red-800" },
  warning: { label: "Attention", variant: "secondary", color: "border-amber-500 bg-amber-50 text-amber-800" },
  info: { label: "Info", variant: "outline", color: "border-blue-500 bg-blue-50 text-blue-800" },
  success: { label: "Succès", variant: "default", color: "border-green-500 bg-green-50 text-green-800" },
};

const EmployeeSystemStatus = () => {
  const [activeTab, setActiveTab] = useState("overview");

  // Fetch service status
  const { data: services, isLoading: servicesLoading, refetch: refetchServices } = useQuery({
    queryKey: ["employee-service-status"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_status")
        .select("*")
        .order("service_name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch system status announcements visible to employees
  const { data: statuses, isLoading } = useQuery({
    queryKey: ["employee-system-status"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_status")
        .select("*")
        .eq("show_to_employees", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const activeStatuses = statuses?.filter(s => s.is_active) || [];

  // Calculate overall system status
  const getOverallStatus = () => {
    if (!services) return "operational";
    const hasOutage = services.some(s => s.status === "major_outage");
    const hasPartialOutage = services.some(s => s.status === "partial_outage");
    const hasDegraded = services.some(s => s.status === "degraded");
    const hasMaintenance = services.some(s => s.status === "maintenance");
    
    if (hasOutage) return "major_outage";
    if (hasPartialOutage) return "partial_outage";
    if (hasDegraded) return "degraded";
    if (hasMaintenance) return "maintenance";
    return "operational";
  };

  const overallStatus = getOverallStatus();
  const operationalCount = services?.filter(s => s.status === "operational").length || 0;
  const totalServices = services?.length || 0;

  const StatusIcon = ({ type }: { type: string }) => {
    const config = statusTypeConfig[type];
    const Icon = config?.icon || Info;
    return <Icon className="w-4 h-4" />;
  };

  const ServiceIcon = ({ name }: { name: string }) => {
    const Icon = serviceIcons[name] || Server;
    return <Icon className="w-5 h-5" />;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/employee">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Retour
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Radio className="w-6 h-6 text-primary" />
                Statut Système
              </h1>
              <p className="text-sm text-muted-foreground">Surveillance des services Nivra (lecture seule)</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => refetchServices()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Actualiser
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Overall Status Card */}
        <Card className={`border-2 ${serviceStatusConfig[overallStatus]?.bgColor} ${serviceStatusConfig[overallStatus]?.color.replace('bg-', 'border-')}`}>
          <CardContent className="py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`p-4 rounded-full ${serviceStatusConfig[overallStatus]?.color}`}>
                  {overallStatus === "operational" ? (
                    <CheckCircle className="w-8 h-8 text-white" />
                  ) : overallStatus === "maintenance" ? (
                    <Wrench className="w-8 h-8 text-white" />
                  ) : (
                    <AlertTriangle className="w-8 h-8 text-white" />
                  )}
                </div>
                <div>
                  <h2 className={`text-2xl font-bold ${serviceStatusConfig[overallStatus]?.textColor}`}>
                    {serviceStatusConfig[overallStatus]?.label}
                  </h2>
                  <p className="text-muted-foreground">
                    {operationalCount}/{totalServices} services opérationnels
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Activity className="w-4 h-4" />
                  Dernière vérification: {format(new Date(), "HH:mm", { locale: fr })}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
            <TabsTrigger value="announcements">Annonces ({activeStatuses.length})</TabsTrigger>
          </TabsList>

          {/* Overview Tab - Service Cards */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {servicesLoading ? (
                <p className="col-span-full text-center py-8 text-muted-foreground">Chargement...</p>
              ) : (
                services?.map((service) => {
                  const statusConfig = serviceStatusConfig[service.status] || serviceStatusConfig.operational;
                  return (
                    <Card 
                      key={service.id} 
                      className={`${statusConfig.bgColor} border-l-4 ${statusConfig.color.replace('bg-', 'border-')}`}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${statusConfig.color}`}>
                            <ServiceIcon name={service.service_name} />
                          </div>
                          <div>
                            <CardTitle className="text-lg">{service.display_name}</CardTitle>
                            <CardDescription className="text-xs">{service.description}</CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Badge className={`${statusConfig.color} text-white`}>
                            {statusConfig.label}
                          </Badge>
                          {service.status_message && (
                            <span className="text-xs text-muted-foreground truncate max-w-[150px]">
                              {service.status_message}
                            </span>
                          )}
                        </div>
                        
                        {/* Uptime Progress */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Disponibilité</span>
                            <span className="font-medium">{service.uptime_percent?.toFixed(2) || "100.00"}%</span>
                          </div>
                          <Progress value={service.uptime_percent || 100} className="h-2" />
                        </div>

                        {/* Response Time */}
                        {service.response_time_ms && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Zap className="w-3 h-3" />
                            <span>Temps de réponse: {service.response_time_ms}ms</span>
                          </div>
                        )}

                        {/* Last Incident */}
                        {service.last_incident_at && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <AlertTriangle className="w-3 h-3" />
                            <span>Dernier incident: {formatDistanceToNow(new Date(service.last_incident_at), { addSuffix: true, locale: fr })}</span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </TabsContent>

          {/* Announcements Tab */}
          <TabsContent value="announcements" className="space-y-4">
            {isLoading ? (
              <p className="text-center py-8 text-muted-foreground">Chargement...</p>
            ) : activeStatuses.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                  <h3 className="text-lg font-medium">Aucune annonce active</h3>
                  <p className="text-muted-foreground">Tous les services fonctionnent normalement</p>
                </CardContent>
              </Card>
            ) : (
              activeStatuses.map((status) => {
                const typeConfig = statusTypeConfig[status.status_type] || statusTypeConfig.info;
                const sevConfig = severityConfig[status.severity] || severityConfig.info;
                const TypeIcon = typeConfig.icon;
                const affectedServices = (status.affected_services as string[]) || [];

                return (
                  <Card key={status.id} className={`border-l-4 ${sevConfig.color}`}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${typeConfig.color}`}>
                            <TypeIcon className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">{status.title}</CardTitle>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant={sevConfig.variant}>{sevConfig.label}</Badge>
                              <Badge variant="outline">{typeConfig.label}</Badge>
                              {status.is_banner && (
                                <Badge variant="secondary">Bannière</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(status.created_at), { addSuffix: true, locale: fr })}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm">{status.message}</p>
                      
                      {affectedServices.length > 0 && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-muted-foreground">Services affectés:</span>
                          {affectedServices.map(svc => (
                            <Badge key={svc} variant="outline" className="text-xs">
                              {svc}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {/* Timing info */}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        {status.starts_at && (
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Début: {format(new Date(status.starts_at), "dd MMM yyyy HH:mm", { locale: fr })}
                          </div>
                        )}
                        {status.ends_at && (
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Fin: {format(new Date(status.ends_at), "dd MMM yyyy HH:mm", { locale: fr })}
                          </div>
                        )}
                      </div>

                      {/* Visibility */}
                      <div className="flex items-center gap-4 pt-2 border-t">
                        <span className="text-xs text-muted-foreground">Visible par:</span>
                        <div className="flex items-center gap-2">
                          {status.show_to_clients && (
                            <Badge variant="outline" className="text-xs">
                              <Users className="w-3 h-3 mr-1" />
                              Clients
                            </Badge>
                          )}
                          {status.show_to_employees && (
                            <Badge variant="outline" className="text-xs">
                              <Briefcase className="w-3 h-3 mr-1" />
                              Employés
                            </Badge>
                          )}
                          {status.show_to_technicians && (
                            <Badge variant="outline" className="text-xs">
                              <HardHat className="w-3 h-3 mr-1" />
                              Techniciens
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default EmployeeSystemStatus;
