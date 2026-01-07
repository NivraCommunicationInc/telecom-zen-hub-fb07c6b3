import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { 
  Shield, AlertTriangle, CheckCircle, Clock, Activity, 
  Lock, Unlock, Ban, RefreshCw, Eye
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface SecurityIncident {
  id: string;
  incident_type: string;
  severity: string;
  title: string;
  description: string;
  status: string;
  auto_mitigated: boolean;
  mitigation_action: string | null;
  created_at: string;
  resolved_at: string | null;
  metadata: Record<string, unknown>;
}

const AdminSecurityGuardian = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");

  const { data: incidents, isLoading } = useQuery({
    queryKey: ["security-incidents", statusFilter, severityFilter],
    queryFn: async () => {
      let query = supabase
        .from("security_incidents")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }
      if (severityFilter !== "all") {
        query = query.eq("severity", severityFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as SecurityIncident[];
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["security-stats"],
    queryFn: async () => {
      const { data: newCount } = await supabase
        .from("security_incidents")
        .select("id", { count: "exact" })
        .eq("status", "new");

      const { data: criticalCount } = await supabase
        .from("security_incidents")
        .select("id", { count: "exact" })
        .eq("severity", "critical")
        .neq("status", "resolved");

      const { data: mitigatedCount } = await supabase
        .from("security_incidents")
        .select("id", { count: "exact" })
        .eq("auto_mitigated", true);

      return {
        new: newCount?.length || 0,
        critical: criticalCount?.length || 0,
        autoMitigated: mitigatedCount?.length || 0,
      };
    },
  });

  const resolveIncidentMutation = useMutation({
    mutationFn: async (incidentId: string) => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user?.id)
        .single();

      const { error } = await supabase
        .from("security_incidents")
        .update({
          status: "resolved",
          resolved_at: new Date().toISOString(),
          resolved_by_id: user?.id,
          resolved_by_name: profile?.full_name || "Admin",
        })
        .eq("id", incidentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["security-incidents"] });
      queryClient.invalidateQueries({ queryKey: ["security-stats"] });
      toast.success("Incident résolu");
    },
  });

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "critical":
        return <Badge variant="destructive">Critique</Badge>;
      case "high":
        return <Badge className="bg-orange-500">Élevé</Badge>;
      case "medium":
        return <Badge variant="secondary">Moyen</Badge>;
      case "low":
        return <Badge variant="outline">Faible</Badge>;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "new":
        return <Badge variant="default"><AlertTriangle className="w-3 h-3 mr-1" />Nouveau</Badge>;
      case "investigating":
        return <Badge variant="secondary"><Eye className="w-3 h-3 mr-1" />Investigation</Badge>;
      case "mitigated":
        return <Badge className="bg-blue-500"><Shield className="w-3 h-3 mr-1" />Atténué</Badge>;
      case "resolved":
        return <Badge variant="outline"><CheckCircle className="w-3 h-3 mr-1" />Résolu</Badge>;
      case "false_positive":
        return <Badge variant="outline">Faux positif</Badge>;
      default:
        return null;
    }
  };

  const getIncidentIcon = (type: string) => {
    switch (type) {
      case "rate_limit_exceeded":
        return <Ban className="w-5 h-5 text-orange-500" />;
      case "failed_login_spike":
        return <Lock className="w-5 h-5 text-red-500" />;
      case "suspicious_activity":
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      default:
        return <Activity className="w-5 h-5 text-blue-500" />;
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="w-6 h-6" />
              Security Guardian
            </h1>
            <p className="text-muted-foreground">
              Monitoring automatisé et incidents de sécurité
            </p>
          </div>
          <Button variant="outline" onClick={() => queryClient.invalidateQueries()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Actualiser
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Nouveaux incidents</p>
                  <p className="text-2xl font-bold">{stats?.new || 0}</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
          <Card className={stats?.critical ? "border-destructive" : ""}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Critiques non résolus</p>
                  <p className="text-2xl font-bold text-destructive">{stats?.critical || 0}</p>
                </div>
                <Shield className="w-8 h-8 text-destructive" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Auto-atténués</p>
                  <p className="text-2xl font-bold text-emerald-600">{stats?.autoMitigated || 0}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-emerald-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex gap-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="new">Nouveaux</SelectItem>
              <SelectItem value="investigating">Investigation</SelectItem>
              <SelectItem value="mitigated">Atténués</SelectItem>
              <SelectItem value="resolved">Résolus</SelectItem>
            </SelectContent>
          </Select>

          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Sévérité" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes sévérités</SelectItem>
              <SelectItem value="critical">Critique</SelectItem>
              <SelectItem value="high">Élevé</SelectItem>
              <SelectItem value="medium">Moyen</SelectItem>
              <SelectItem value="low">Faible</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Incidents List */}
        <Card>
          <CardHeader>
            <CardTitle>Incidents récents</CardTitle>
            <CardDescription>
              Liste des incidents détectés par le système
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px]">
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Chargement...</div>
              ) : incidents?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="w-12 h-12 mx-auto mb-2 text-emerald-500" />
                  <p>Aucun incident détecté</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {incidents?.map((incident) => (
                    <div
                      key={incident.id}
                      className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          {getIncidentIcon(incident.incident_type)}
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium">{incident.title}</h4>
                              {getSeverityBadge(incident.severity)}
                              {getStatusBadge(incident.status)}
                              {incident.auto_mitigated && (
                                <Badge variant="outline" className="text-emerald-600 border-emerald-600">
                                  <Shield className="w-3 h-3 mr-1" />
                                  Auto
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mb-2">
                              {incident.description}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(incident.created_at), "d MMM yyyy HH:mm:ss", { locale: fr })}
                            </p>
                            {incident.mitigation_action && (
                              <p className="text-xs mt-1 text-blue-600">
                                Action: {incident.mitigation_action}
                              </p>
                            )}
                          </div>
                        </div>
                        {incident.status !== "resolved" && incident.status !== "false_positive" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => resolveIncidentMutation.mutate(incident.id)}
                          >
                            Résoudre
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminSecurityGuardian;
