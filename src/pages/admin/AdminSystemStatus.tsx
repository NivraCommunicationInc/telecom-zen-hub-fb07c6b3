import { useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  Edit,
  Trash2,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle,
  Clock,
  Wrench,
  Radio,
  Eye,
  EyeOff,
  Lock,
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
  TrendingUp,
  RefreshCw,
  Zap,
  Server,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminClient as supabase } from "@/integrations/backend";
import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { ScrollArea } from "@/components/ui/scroll-area";

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

const servicesList = [
  { id: "internet", label: "Internet" },
  { id: "tv", label: "Télévision" },
  { id: "streaming", label: "Streaming+" },
  { id: "mobile", label: "Mobile" },
  { id: "portal", label: "Portail client" },
  { id: "billing", label: "Facturation" },
];

const AdminSystemStatus = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<any>(null);
  const [selectedService, setSelectedService] = useState<any>(null);
  
  const [newStatus, setNewStatus] = useState({
    title: "",
    message: "",
    status_type: "info",
    severity: "info",
    is_active: true,
    is_banner: true,
    starts_at: "",
    ends_at: "",
    affected_services: [] as string[],
    show_to_clients: true,
    show_to_employees: true,
    show_to_technicians: true,
    internal_notes: "",
  });

  // Fetch service status
  const { data: services, isLoading: servicesLoading, refetch: refetchServices } = useQuery({
    queryKey: ["admin-service-status"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_status")
        .select("*")
        .order("service_name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch all system status announcements
  const { data: statuses, isLoading } = useQuery({
    queryKey: ["admin-system-status"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_status")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Update service status
  const updateServiceMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase
        .from("service_status")
        .update({
          status: data.status,
          status_message: data.status_message || null,
          uptime_percent: data.uptime_percent,
          response_time_ms: data.response_time_ms,
          updated_by: user?.id,
        })
        .eq("id", data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-service-status"] });
      toast({ title: "Statut du service mis à jour" });
      setServiceDialogOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  // Create announcement
  const createMutation = useMutation({
    mutationFn: async (data: typeof newStatus) => {
      const { error } = await supabase.from("system_status").insert({
        title: data.title,
        message: data.message,
        status_type: data.status_type,
        severity: data.severity,
        is_active: data.is_active,
        is_banner: data.is_banner,
        starts_at: data.starts_at || null,
        ends_at: data.ends_at || null,
        affected_services: data.affected_services,
        show_to_clients: data.show_to_clients,
        show_to_employees: data.show_to_employees,
        show_to_technicians: data.show_to_technicians,
        internal_notes: data.internal_notes || null,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-system-status"] });
      queryClient.invalidateQueries({ queryKey: ["system-status"] });
      toast({ title: "Annonce créée avec succès" });
      setCreateDialogOpen(false);
      resetNewStatus();
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  // Update announcement
  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase
        .from("system_status")
        .update({
          title: data.title,
          message: data.message,
          status_type: data.status_type,
          severity: data.severity,
          is_active: data.is_active,
          is_banner: data.is_banner,
          starts_at: data.starts_at || null,
          ends_at: data.ends_at || null,
          affected_services: data.affected_services,
          show_to_clients: data.show_to_clients,
          show_to_employees: data.show_to_employees,
          show_to_technicians: data.show_to_technicians,
          internal_notes: data.internal_notes || null,
        })
        .eq("id", data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-system-status"] });
      queryClient.invalidateQueries({ queryKey: ["system-status"] });
      toast({ title: "Annonce mise à jour" });
      setEditDialogOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  // Delete announcement
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("system_status").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-system-status"] });
      queryClient.invalidateQueries({ queryKey: ["system-status"] });
      toast({ title: "Annonce supprimée" });
    },
  });

  // Toggle active
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("system_status")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-system-status"] });
      queryClient.invalidateQueries({ queryKey: ["system-status"] });
    },
  });

  const resetNewStatus = () => {
    setNewStatus({
      title: "",
      message: "",
      status_type: "info",
      severity: "info",
      is_active: true,
      is_banner: true,
      starts_at: "",
      ends_at: "",
      affected_services: [],
      show_to_clients: true,
      show_to_employees: true,
      show_to_technicians: true,
      internal_notes: "",
    });
  };

  const activeStatuses = statuses?.filter(s => s.is_active) || [];
  const inactiveStatuses = statuses?.filter(s => !s.is_active) || [];

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
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Radio className="w-8 h-8 text-primary" />
              Statut Système
            </h1>
            <p className="text-muted-foreground">Surveillance et gestion des services Nivra</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => refetchServices()}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Actualiser
            </Button>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Nouvelle annonce
            </Button>
          </div>
        </div>

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
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
            <TabsTrigger value="announcements">Annonces ({activeStatuses.length})</TabsTrigger>
            <TabsTrigger value="history">Historique</TabsTrigger>
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
                      className={`cursor-pointer hover:shadow-lg transition-all ${statusConfig.bgColor} border-l-4 ${statusConfig.color.replace('bg-', 'border-')}`}
                      onClick={() => {
                        setSelectedService(service);
                        setServiceDialogOpen(true);
                      }}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${statusConfig.color}`}>
                              <ServiceIcon name={service.service_name} />
                            </div>
                            <div>
                              <CardTitle className="text-lg">{service.display_name}</CardTitle>
                              <CardDescription className="text-xs">{service.description}</CardDescription>
                            </div>
                          </div>
                          <Button variant="ghost" size="sm">
                            <Edit className="w-4 h-4" />
                          </Button>
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

                        {/* Last Updated */}
                        <div className="text-xs text-muted-foreground">
                          Mis à jour {formatDistanceToNow(new Date(service.updated_at), { addSuffix: true, locale: fr })}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-100">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{services?.filter(s => s.status === "operational").length || 0}</p>
                      <p className="text-sm text-muted-foreground">Opérationnels</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-100">
                      <AlertCircle className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{services?.filter(s => s.status === "degraded").length || 0}</p>
                      <p className="text-sm text-muted-foreground">Dégradés</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-100">
                      <Wrench className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{services?.filter(s => s.status === "maintenance").length || 0}</p>
                      <p className="text-sm text-muted-foreground">Maintenance</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-red-100">
                      <AlertTriangle className="w-5 h-5 text-red-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{services?.filter(s => s.status === "major_outage" || s.status === "partial_outage").length || 0}</p>
                      <p className="text-sm text-muted-foreground">Incidents</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Announcements Tab */}
          <TabsContent value="announcements" className="space-y-4">
            {isLoading ? (
              <p className="text-center py-8 text-muted-foreground">Chargement...</p>
            ) : activeStatuses.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Info className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Aucune annonce active</p>
                  <Button className="mt-4" onClick={() => setCreateDialogOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Créer une annonce
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {activeStatuses.map((status) => (
                  <Card
                    key={status.id}
                    className={`border-l-4 ${severityConfig[status.severity]?.color || "border-gray-300 bg-gray-50"}`}
                  >
                    <CardContent className="py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <div className={`p-1.5 rounded ${statusTypeConfig[status.status_type]?.color}`}>
                              <StatusIcon type={status.status_type} />
                            </div>
                            <span className="font-semibold">{status.title}</span>
                            <Badge variant={severityConfig[status.severity]?.variant}>
                              {severityConfig[status.severity]?.label}
                            </Badge>
                            {status.is_banner && <Badge variant="outline">Bannière</Badge>}
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">{status.message}</p>
                          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                            {status.starts_at && (
                              <span>Début: {format(new Date(status.starts_at), "d MMM yyyy HH:mm", { locale: fr })}</span>
                            )}
                            {status.ends_at && (
                              <span>• Fin: {format(new Date(status.ends_at), "d MMM yyyy HH:mm", { locale: fr })}</span>
                            )}
                          </div>
                          {Array.isArray(status.affected_services) && status.affected_services.length > 0 && (
                            <div className="flex gap-1 mt-2">
                              {(status.affected_services as string[]).map((s) => (
                                <Badge key={s} variant="outline" className="text-xs">
                                  {servicesList.find(svc => svc.id === s)?.label || s}
                                </Badge>
                              ))}
                            </div>
                          )}
                          {status.internal_notes && (
                            <div className="mt-2 p-2 bg-amber-100 rounded text-xs text-amber-800 flex items-start gap-1">
                              <Lock className="w-3 h-3 mt-0.5 shrink-0" />
                              {status.internal_notes}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSelectedStatus({
                                ...status,
                                starts_at: status.starts_at ? new Date(status.starts_at).toISOString().slice(0, 16) : "",
                                ends_at: status.ends_at ? new Date(status.ends_at).toISOString().slice(0, 16) : "",
                              });
                              setEditDialogOpen(true);
                            }}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => toggleActiveMutation.mutate({ id: status.id, is_active: false })}
                          >
                            <EyeOff className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => {
                              if (confirm("Supprimer cette annonce?")) deleteMutation.mutate(status.id);
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <EyeOff className="w-5 h-5" />
                  Historique des annonces ({inactiveStatuses.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {inactiveStatuses.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">Aucun historique</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Titre</TableHead>
                        <TableHead>Sévérité</TableHead>
                        <TableHead>Créé le</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {inactiveStatuses.slice(0, 20).map((status) => (
                        <TableRow key={status.id} className="opacity-70">
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <StatusIcon type={status.status_type} />
                              {statusTypeConfig[status.status_type]?.label}
                            </div>
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">{status.title}</TableCell>
                          <TableCell>
                            <Badge variant={severityConfig[status.severity]?.variant}>
                              {severityConfig[status.severity]?.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {format(new Date(status.created_at), "d MMM yyyy", { locale: fr })}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => toggleActiveMutation.mutate({ id: status.id, is_active: true })}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-destructive"
                                onClick={() => {
                                  if (confirm("Supprimer?")) deleteMutation.mutate(status.id);
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Service Status Dialog */}
      <Dialog open={serviceDialogOpen} onOpenChange={setServiceDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedService && <ServiceIcon name={selectedService.service_name} />}
              Modifier le statut du service
            </DialogTitle>
            <DialogDescription>
              {selectedService?.display_name} - {selectedService?.description}
            </DialogDescription>
          </DialogHeader>
          {selectedService && (
            <div className="space-y-4">
              <div>
                <Label>Statut</Label>
                <Select 
                  value={selectedService.status} 
                  onValueChange={(v) => setSelectedService({ ...selectedService, status: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(serviceStatusConfig).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${config.color}`} />
                          {config.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Message de statut (optionnel)</Label>
                <Textarea
                  value={selectedService.status_message || ""}
                  onChange={(e) => setSelectedService({ ...selectedService, status_message: e.target.value })}
                  placeholder="Ex: Maintenance planifiée jusqu'à 14h..."
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Disponibilité (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={selectedService.uptime_percent || 100}
                    onChange={(e) => setSelectedService({ ...selectedService, uptime_percent: parseFloat(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>Temps de réponse (ms)</Label>
                  <Input
                    type="number"
                    value={selectedService.response_time_ms || ""}
                    onChange={(e) => setSelectedService({ ...selectedService, response_time_ms: parseInt(e.target.value) || null })}
                    placeholder="150"
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setServiceDialogOpen(false)}>Annuler</Button>
            <Button 
              onClick={() => updateServiceMutation.mutate(selectedService)}
              disabled={updateServiceMutation.isPending}
            >
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Announcement Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Nouvelle annonce système</DialogTitle>
            <DialogDescription>
              Créez une annonce pour informer les utilisateurs du statut des services
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-4">
              <div>
                <Label>Titre *</Label>
                <Input
                  value={newStatus.title}
                  onChange={(e) => setNewStatus({ ...newStatus, title: e.target.value })}
                  placeholder="Maintenance planifiée du réseau"
                />
              </div>
              <div>
                <Label>Message *</Label>
                <Textarea
                  value={newStatus.message}
                  onChange={(e) => setNewStatus({ ...newStatus, message: e.target.value })}
                  placeholder="Description détaillée..."
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Type</Label>
                  <Select value={newStatus.status_type} onValueChange={(v) => setNewStatus({ ...newStatus, status_type: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(statusTypeConfig).map(([key, config]) => (
                        <SelectItem key={key} value={key}>
                          <div className="flex items-center gap-2">
                            <config.icon className="w-4 h-4" />
                            {config.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Sévérité</Label>
                  <Select value={newStatus.severity} onValueChange={(v) => setNewStatus({ ...newStatus, severity: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(severityConfig).map(([key, config]) => (
                        <SelectItem key={key} value={key}>{config.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Date de début</Label>
                  <Input
                    type="datetime-local"
                    value={newStatus.starts_at}
                    onChange={(e) => setNewStatus({ ...newStatus, starts_at: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Date de fin</Label>
                  <Input
                    type="datetime-local"
                    value={newStatus.ends_at}
                    onChange={(e) => setNewStatus({ ...newStatus, ends_at: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label className="mb-2 block">Services affectés</Label>
                <div className="flex flex-wrap gap-3">
                  {servicesList.map((service) => (
                    <label key={service.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={newStatus.affected_services?.includes(service.id)}
                        onCheckedChange={(checked) => {
                          const newServices = checked
                            ? [...(newStatus.affected_services || []), service.id]
                            : (newStatus.affected_services || []).filter((s: string) => s !== service.id);
                          setNewStatus({ ...newStatus, affected_services: newServices });
                        }}
                      />
                      {service.label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="border-t pt-4">
                <Label className="mb-2 block">Visible pour</Label>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={newStatus.show_to_clients}
                      onCheckedChange={(v) => setNewStatus({ ...newStatus, show_to_clients: !!v })}
                    />
                    <Users className="w-4 h-4" /> Clients
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={newStatus.show_to_employees}
                      onCheckedChange={(v) => setNewStatus({ ...newStatus, show_to_employees: !!v })}
                    />
                    <Briefcase className="w-4 h-4" /> Employés
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={newStatus.show_to_technicians}
                      onCheckedChange={(v) => setNewStatus({ ...newStatus, show_to_technicians: !!v })}
                    />
                    <HardHat className="w-4 h-4" /> Techniciens
                  </label>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2">
                  <Switch
                    checked={newStatus.is_active}
                    onCheckedChange={(v) => setNewStatus({ ...newStatus, is_active: v })}
                  />
                  <span className="text-sm">Actif immédiatement</span>
                </label>
                <label className="flex items-center gap-2">
                  <Switch
                    checked={newStatus.is_banner}
                    onCheckedChange={(v) => setNewStatus({ ...newStatus, is_banner: v })}
                  />
                  <span className="text-sm">Afficher en bannière</span>
                </label>
              </div>
              <div className="border-t pt-4">
                <Label className="flex items-center gap-2 text-amber-700">
                  <Lock className="w-4 h-4" />
                  Notes internes (Admin uniquement)
                </Label>
                <Textarea
                  value={newStatus.internal_notes}
                  onChange={(e) => setNewStatus({ ...newStatus, internal_notes: e.target.value })}
                  placeholder="Notes privées..."
                  rows={2}
                  className="mt-2 border-amber-200 bg-amber-50/50"
                />
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Annuler</Button>
            <Button
              onClick={() => createMutation.mutate(newStatus)}
              disabled={createMutation.isPending || !newStatus.title || !newStatus.message}
            >
              Créer l'annonce
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Announcement Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Modifier l'annonce</DialogTitle>
          </DialogHeader>
          {selectedStatus && (
            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="space-y-4">
                <div>
                  <Label>Titre *</Label>
                  <Input
                    value={selectedStatus.title}
                    onChange={(e) => setSelectedStatus({ ...selectedStatus, title: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Message *</Label>
                  <Textarea
                    value={selectedStatus.message}
                    onChange={(e) => setSelectedStatus({ ...selectedStatus, message: e.target.value })}
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Type</Label>
                    <Select value={selectedStatus.status_type} onValueChange={(v) => setSelectedStatus({ ...selectedStatus, status_type: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(statusTypeConfig).map(([key, config]) => (
                          <SelectItem key={key} value={key}>
                            <div className="flex items-center gap-2">
                              <config.icon className="w-4 h-4" />
                              {config.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Sévérité</Label>
                    <Select value={selectedStatus.severity} onValueChange={(v) => setSelectedStatus({ ...selectedStatus, severity: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(severityConfig).map(([key, config]) => (
                          <SelectItem key={key} value={key}>{config.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Date de début</Label>
                    <Input
                      type="datetime-local"
                      value={selectedStatus.starts_at}
                      onChange={(e) => setSelectedStatus({ ...selectedStatus, starts_at: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Date de fin</Label>
                    <Input
                      type="datetime-local"
                      value={selectedStatus.ends_at}
                      onChange={(e) => setSelectedStatus({ ...selectedStatus, ends_at: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label className="mb-2 block">Services affectés</Label>
                  <div className="flex flex-wrap gap-3">
                    {servicesList.map((service) => (
                      <label key={service.id} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={selectedStatus.affected_services?.includes(service.id)}
                          onCheckedChange={(checked) => {
                            const newServices = checked
                              ? [...(selectedStatus.affected_services || []), service.id]
                              : (selectedStatus.affected_services || []).filter((s: string) => s !== service.id);
                            setSelectedStatus({ ...selectedStatus, affected_services: newServices });
                          }}
                        />
                        {service.label}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2">
                    <Switch
                      checked={selectedStatus.is_active}
                      onCheckedChange={(v) => setSelectedStatus({ ...selectedStatus, is_active: v })}
                    />
                    <span className="text-sm">Actif</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <Switch
                      checked={selectedStatus.is_banner}
                      onCheckedChange={(v) => setSelectedStatus({ ...selectedStatus, is_banner: v })}
                    />
                    <span className="text-sm">Bannière</span>
                  </label>
                </div>
                <div className="border-t pt-4">
                  <Label className="flex items-center gap-2 text-amber-700">
                    <Lock className="w-4 h-4" />
                    Notes internes
                  </Label>
                  <Textarea
                    value={selectedStatus.internal_notes || ""}
                    onChange={(e) => setSelectedStatus({ ...selectedStatus, internal_notes: e.target.value })}
                    rows={2}
                    className="mt-2 border-amber-200 bg-amber-50/50"
                  />
                </div>
              </div>
            </ScrollArea>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Annuler</Button>
            <Button
              onClick={() => updateMutation.mutate(selectedStatus)}
              disabled={updateMutation.isPending}
            >
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminSystemStatus;