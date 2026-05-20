import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminClient as supabase } from "@/integrations/backend";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
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
import { format, subDays, isWithinInterval } from "date-fns";
import { fr } from "date-fns/locale";
import {
  User,
  Mail,
  Phone,
  Calendar,
  Shield,
  Eye,
  History,
  BarChart3,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  KeyRound,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  Search,
  ExternalLink,
  Users,
  Ticket,
  Package,
  CreditCard,
  Settings,
  AlertTriangle,
  Save,
} from "lucide-react";
import { actionTypeLabels, ActionType } from "@/hooks/useClientActivityLog";
import { Link } from "react-router-dom";

interface Employee {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: string;
  is_active: boolean;
  permissions_json: Record<string, boolean> | null;
  created_at: string;
  updated_at: string;
}

interface EmployeeProfileDialogProps {
  employee: Employee | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

// Access method labels
const methodLabels: Record<string, { label: string; icon: any }> = {
  pin: { label: "NIP", icon: KeyRound },
  email_otp: { label: "OTP", icon: Mail },
  dob_postal: { label: "Vérification", icon: Calendar },
  email_postal: { label: "Email+Postal", icon: Mail },
  admin_bypass: { label: "Bypass", icon: ShieldCheck },
};

// Role labels
const roleColors: Record<string, string> = {
  admin: "bg-purple-500/20 text-purple-400",
  employee: "bg-blue-500/20 text-blue-400",
  technician: "bg-amber-500/20 text-amber-400",
};

export const EmployeeProfileDialog = ({
  employee,
  isOpen,
  onClose,
  onUpdate,
}: EmployeeProfileDialogProps) => {
  const [activeTab, setActiveTab] = useState("overview");
  const [accessSearch, setAccessSearch] = useState("");
  const [accessResultFilter, setAccessResultFilter] = useState("all");
  const [activitySearch, setActivitySearch] = useState("");
  const [activityTypeFilter, setActivityTypeFilter] = useState("all");
  const [kpiPeriod, setKpiPeriod] = useState<"7" | "30">("7");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [internalNotes, setInternalNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  // Fetch employee's access logs (clients they accessed)
  // Query by staff_user_id (employee table id), staff_email, or staff_name
  const { data: accessLogs, isLoading: accessLoading } = useQuery({
    queryKey: ["employee-access-logs", employee?.id, employee?.email],
    queryFn: async () => {
      if (!employee) return [];
      
      // First try by staff_user_id (employee table id) which is what gets logged
      const { data: byId, error: idError } = await supabase
        .from("client_access_logs")
        .select("*")
        .eq("staff_user_id", employee.id)
        .order("created_at", { ascending: false })
        .limit(200);
      
      if (!idError && byId && byId.length > 0) {
        return byId;
      }
      
      // Fallback: Try by email
      const { data: byEmail, error: emailError } = await supabase
        .from("client_access_logs")
        .select("*")
        .eq("staff_email", employee.email)
        .order("created_at", { ascending: false })
        .limit(200);
      
      if (!emailError && byEmail && byEmail.length > 0) {
        return byEmail;
      }
      
      // Last fallback: try by name
      const { data: byName } = await supabase
        .from("client_access_logs")
        .select("*")
        .eq("staff_name", employee.full_name)
        .order("created_at", { ascending: false })
        .limit(200);
      
      return byName || [];
    },
    enabled: !!employee?.id && isOpen,
  });

  // Fetch employee's activity logs (changes they made)
  // Query by actor_user_id (employee table id), or actor_name as fallback
  const { data: activityLogs, isLoading: activityLoading } = useQuery({
    queryKey: ["employee-activity-logs", employee?.id, employee?.email],
    queryFn: async () => {
      if (!employee) return [];
      
      // First: try by employee table id (what employees use as actor_user_id)
      const { data: byEmployeeId, error: empIdError } = await supabase
        .from("client_activity_logs")
        .select("*")
        .eq("actor_user_id", employee.id)
        .order("created_at", { ascending: false })
        .limit(200);
      
      if (!empIdError && byEmployeeId && byEmployeeId.length > 0) {
        return byEmployeeId;
      }
      
      // Second: try to find auth user_id via profiles (if employee also has a Supabase auth account)
      const { data: profile } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("email", employee.email)
        .maybeSingle();

      if (profile?.user_id) {
        const { data, error } = await supabase
          .from("client_activity_logs")
          .select("*")
          .eq("actor_user_id", profile.user_id)
          .order("created_at", { ascending: false })
          .limit(200);
        if (!error && data && data.length > 0) {
          return data;
        }
      }
      
      // Last fallback: query by actor_name matching email or full_name
      const { data: byName } = await supabase
        .from("client_activity_logs")
        .select("*")
        .or(`actor_name.eq.${employee.email},actor_name.eq.${employee.full_name}`)
        .order("created_at", { ascending: false })
        .limit(200);
      
      return byName || [];
    },
    enabled: !!employee?.id && isOpen,
  });

  // Fetch audit logs for this employee
  const { data: auditLogs } = useQuery({
    queryKey: ["employee-audit-logs", employee?.id],
    queryFn: async () => {
      if (!employee) return [];
      const { data, error } = await supabase
        .from("employee_audit_logs")
        .select("*")
        .eq("target_employee_id", employee.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: !!employee?.id && isOpen,
  });

  // Fetch client profiles to resolve names for activity logs
  const clientIds = useMemo(() => {
    const ids = new Set<string>();
    activityLogs?.forEach((log) => {
      if (log.client_id) ids.add(log.client_id);
    });
    accessLogs?.forEach((log) => {
      if (log.client_id) ids.add(log.client_id);
    });
    return Array.from(ids);
  }, [activityLogs, accessLogs]);

  const { data: clientProfiles } = useQuery({
    queryKey: ["client-profiles-for-employee-logs", clientIds],
    queryFn: async () => {
      if (clientIds.length === 0) return {};
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, first_name, last_name")
        .in("user_id", clientIds);
      
      const map: Record<string, string> = {};
      data?.forEach((p) => {
        map[p.user_id] = p.full_name || `${p.first_name || ""} ${p.last_name || ""}`.trim() || p.email || "Client";
      });
      return map;
    },
    enabled: clientIds.length > 0,
  });

  // Helper to get client name
  const getClientName = (clientId: string | null, fallback?: string): string => {
    if (!clientId) return fallback || "—";
    return clientProfiles?.[clientId] || fallback || `Client ${clientId.slice(0, 8)}...`;
  };

  // Compute KPIs
  const kpis = useMemo(() => {
    if (!accessLogs || !activityLogs) return null;

    const days = parseInt(kpiPeriod);
    const startDate = subDays(new Date(), days);
    const endDate = new Date();

    const recentAccessLogs = accessLogs.filter((log) =>
      isWithinInterval(new Date(log.created_at), { start: startDate, end: endDate })
    );

    const recentActivityLogs = activityLogs.filter((log) =>
      isWithinInterval(new Date(log.created_at), { start: startDate, end: endDate })
    );

    const successfulAccesses = recentAccessLogs.filter((l) => l.result === "success").length;
    const failedAccesses = recentAccessLogs.filter((l) => l.result === "fail").length;

    // Count by action type
    const actionCounts: Record<string, number> = {};
    recentActivityLogs.forEach((log) => {
      actionCounts[log.action_type] = (actionCounts[log.action_type] || 0) + 1;
    });

    const uniqueClientsAccessed = new Set(recentAccessLogs.filter(l => l.result === "success").map((l) => l.client_id)).size;

    return {
      totalAccesses: successfulAccesses,
      failedAccesses,
      uniqueClients: uniqueClientsAccessed,
      totalActions: recentActivityLogs.length,
      actionCounts,
      avgActionsPerDay: (recentActivityLogs.length / days).toFixed(1),
    };
  }, [accessLogs, activityLogs, kpiPeriod]);

  // Filter access logs
  const filteredAccessLogs = useMemo(() => {
    if (!accessLogs) return [];
    return accessLogs.filter((log) => {
      const matchesSearch =
        !accessSearch ||
        log.client_name?.toLowerCase().includes(accessSearch.toLowerCase()) ||
        log.access_method?.toLowerCase().includes(accessSearch.toLowerCase());
      const matchesResult = accessResultFilter === "all" || log.result === accessResultFilter;
      return matchesSearch && matchesResult;
    });
  }, [accessLogs, accessSearch, accessResultFilter]);

  // Filter activity logs
  const filteredActivityLogs = useMemo(() => {
    if (!activityLogs) return [];
    return activityLogs.filter((log) => {
      const matchesSearch =
        !activitySearch ||
        log.summary?.toLowerCase().includes(activitySearch.toLowerCase());
      const matchesType = activityTypeFilter === "all" || log.action_type === activityTypeFilter;
      return matchesSearch && matchesType;
    });
  }, [activityLogs, activitySearch, activityTypeFilter]);

  const uniqueActionTypes = useMemo(() => {
    if (!activityLogs) return [];
    return [...new Set(activityLogs.map((log) => log.action_type))];
  }, [activityLogs]);

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const handleSaveNotes = async () => {
    // Notes would be saved to a notes field on employee or a separate table
    // For now, we'll log this action
    setSavingNotes(true);
    try {
      await supabase.from("employee_audit_logs").insert({
        actor_role: "admin",
        action: "UPDATE_INTERNAL_NOTES",
        target_employee_id: employee?.id,
        target_employee_email: employee?.email,
        details_json: { notes: internalNotes },
      });
      onUpdate();
    } catch (error) {
      console.error("Error saving notes:", error);
    } finally {
      setSavingNotes(false);
    }
  };

  if (!employee) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <User className="w-5 h-5 text-primary" />
            </div>
            <div>
              <span className="text-xl">{employee.full_name}</span>
              <div className="flex items-center gap-2 mt-1">
                <Badge className={roleColors[employee.role] || "bg-muted"}>
                  {employee.role === "employee" ? "Employé" : employee.role}
                </Badge>
                <Badge variant={employee.is_active ? "default" : "destructive"}>
                  {employee.is_active ? "Actif" : "Désactivé"}
                </Badge>
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="overview" className="gap-2">
              <User className="w-4 h-4" />
              Aperçu
            </TabsTrigger>
            <TabsTrigger value="access" className="gap-2">
              <Eye className="w-4 h-4" />
              Accès
            </TabsTrigger>
            <TabsTrigger value="activity" className="gap-2">
              <History className="w-4 h-4" />
              Activité
            </TabsTrigger>
            <TabsTrigger value="kpis" className="gap-2">
              <BarChart3 className="w-4 h-4" />
              KPIs
            </TabsTrigger>
            <TabsTrigger value="notes" className="gap-2">
              <FileText className="w-4 h-4" />
              Notes
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 mt-4">
            {/* Overview Tab */}
            <TabsContent value="overview" className="m-0 space-y-4">
              {/* Debug Panel - Admin only diagnostic info */}
              <Card className="border-amber-500/30 bg-amber-500/5">
                <CardHeader className="py-3">
                  <CardTitle className="text-sm flex items-center gap-2 text-amber-600">
                    <AlertTriangle className="w-4 h-4" />
                    Diagnostic (Admin)
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-1 text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <span className="text-muted-foreground">Email employé:</span>
                    <span className="font-mono">{employee.email}</span>
                    <span className="text-muted-foreground">Employé:</span>
                    <span className="text-xs">{employee.full_name || employee.email || "Agent inconnu"}</span>
                    <span className="text-muted-foreground">Accès trouvés:</span>
                    <span className={accessLogs?.length ? "text-emerald-500" : "text-red-500"}>
                      {accessLoading ? "..." : accessLogs?.length || 0}
                    </span>
                    <span className="text-muted-foreground">Activités trouvées:</span>
                    <span className={activityLogs?.length ? "text-emerald-500" : "text-red-500"}>
                      {activityLoading ? "..." : activityLogs?.length || 0}
                    </span>
                  </div>
                  {(!accessLogs?.length && !activityLogs?.length && !accessLoading && !activityLoading) && (
                    <p className="text-amber-600 mt-2">
                      ⚠️ Aucun log trouvé. Les actions doivent être effectuées avec les outils de journalisation.
                    </p>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <User className="w-5 h-5" />
                    Informations
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Email</Label>
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      <span>{employee.email}</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Téléphone</Label>
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <span>{employee.phone || "—"}</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Créé le</Label>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span>{format(new Date(employee.created_at), "d MMM yyyy", { locale: fr })}</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Dernière mise à jour</Label>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <span>{format(new Date(employee.updated_at), "d MMM yyyy HH:mm", { locale: fr })}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    Permissions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-2">
                    {Object.entries(employee.permissions_json || {}).map(([key, value]) => (
                      <div key={key} className="flex items-center gap-2">
                        {value ? (
                          <CheckCircle className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-muted-foreground" />
                        )}
                        <span className={`text-sm ${value ? "" : "text-muted-foreground"}`}>
                          {key.replace(/_/g, " ").replace("can ", "")}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Recent Audit Logs */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <History className="w-5 h-5" />
                    Historique du compte
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {auditLogs && auditLogs.length > 0 ? (
                    <div className="space-y-2">
                      {auditLogs.slice(0, 5).map((log) => (
                        <div key={log.id} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                          <div className="flex items-center gap-2">
                            <Settings className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm">{log.action}</span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(log.created_at), "d MMM yyyy HH:mm", { locale: fr })}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Aucun historique disponible
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Access History Tab */}
            <TabsContent value="access" className="m-0 space-y-4">
              <div className="flex gap-3 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher par client..."
                    value={accessSearch}
                    onChange={(e) => setAccessSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={accessResultFilter} onValueChange={setAccessResultFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Résultat" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous</SelectItem>
                    <SelectItem value="success">Succès</SelectItem>
                    <SelectItem value="fail">Échec</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {accessLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : filteredAccessLogs.length > 0 ? (
                <div className="space-y-2">
                  {filteredAccessLogs.map((log) => {
                    const method = methodLabels[log.access_method] || { label: log.access_method, icon: Eye };
                    const MethodIcon = method.icon;

                    return (
                      <div
                        key={log.id}
                        className={`p-3 border rounded-lg ${
                          log.result === "fail" ? "border-red-500/30 bg-red-500/5" : "border-border"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {log.result === "success" ? (
                              <CheckCircle className="w-5 h-5 text-emerald-500" />
                            ) : (
                              <XCircle className="w-5 h-5 text-red-500" />
                            )}
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{log.client_name || "Client"}</span>
                                <Badge variant="outline" className="text-xs">
                                  <MethodIcon className="w-3 h-3 mr-1" />
                                  {method.label}
                                </Badge>
                                {log.failed_attempt_count > 0 && (
                                  <Badge variant="destructive" className="text-xs">
                                    <AlertTriangle className="w-3 h-3 mr-1" />
                                    Tentative #{log.failed_attempt_count}
                                  </Badge>
                                )}
                              </div>
                              {log.access_reason && (
                                <p className="text-xs text-muted-foreground">
                                  Raison: {log.access_reason}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(log.created_at), "d MMM yyyy HH:mm", { locale: fr })}
                            </span>
                            <Link to={`/admin/clients?id=${log.client_id}`}>
                              <Button variant="ghost" size="sm">
                                <ExternalLink className="w-4 h-4" />
                              </Button>
                            </Link>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Eye className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">Aucun accès enregistré</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Les accès aux profils clients via la vérification NIP sont journalisés automatiquement.
                  </p>
                </div>
              )}
            </TabsContent>

            {/* Activity Tab */}
            <TabsContent value="activity" className="m-0 space-y-4">
              <div className="flex gap-3 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher..."
                    value={activitySearch}
                    onChange={(e) => setActivitySearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={activityTypeFilter} onValueChange={setActivityTypeFilter}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Type d'action" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes les actions</SelectItem>
                    {uniqueActionTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {actionTypeLabels[type as ActionType] || type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {activityLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : filteredActivityLogs.length > 0 ? (
                <div className="space-y-2">
                  {filteredActivityLogs.map((log) => (
                    <Collapsible key={log.id} open={expandedRows.has(log.id)}>
                      <div className="border border-border rounded-lg">
                        <CollapsibleTrigger asChild>
                          <button
                            className="w-full p-3 flex items-center gap-3 text-left hover:bg-accent/50"
                            onClick={() => toggleRow(log.id)}
                          >
                            {expandedRows.has(log.id) ? (
                              <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-muted-foreground" />
                            )}
                            <div className="flex-1 grid grid-cols-5 gap-2 items-center">
                              <span className="text-sm text-muted-foreground">
                                {format(new Date(log.created_at), "d MMM HH:mm", { locale: fr })}
                              </span>
                              <Link 
                                to={`/admin/clients?id=${log.client_id}`}
                                className="text-sm font-medium text-primary hover:underline truncate"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {getClientName(log.client_id)}
                              </Link>
                              <Badge variant="secondary" className="w-fit text-xs">
                                {actionTypeLabels[log.action_type as ActionType] || log.action_type}
                              </Badge>
                              <span className="text-sm truncate col-span-2">{log.summary}</span>
                            </div>
                          </button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="px-10 pb-3 border-t border-border/50 pt-2 space-y-2">
                            <div className="grid grid-cols-3 gap-4 text-sm">
                              <div>
                                <span className="text-muted-foreground">Client: </span>
                                <Link 
                                  to={`/admin/clients?id=${log.client_id}`}
                                  className="text-primary hover:underline"
                                >
                                  {getClientName(log.client_id)}
                                </Link>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Entité: </span>
                                <span>{log.entity_type || "—"}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">ID: </span>
                                <span className="font-mono text-xs">{log.entity_id?.slice(0, 8) || "—"}</span>
                              </div>
                            </div>
                            {log.before_data && Object.keys(log.before_data).length > 0 && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-1">Avant:</p>
                                <pre className="text-xs bg-muted/50 p-2 rounded overflow-x-auto max-h-24">
                                  {JSON.stringify(log.before_data, null, 2)}
                                </pre>
                              </div>
                            )}
                            {log.after_data && Object.keys(log.after_data).length > 0 && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-1">Après:</p>
                                <pre className="text-xs bg-muted/50 p-2 rounded overflow-x-auto max-h-24">
                                  {JSON.stringify(log.after_data, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <History className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">Aucune activité enregistrée</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Les modifications de profils clients, commandes, et facturation sont journalisées automatiquement.
                  </p>
                </div>
              )}
            </TabsContent>

            {/* KPIs Tab */}
            <TabsContent value="kpis" className="m-0 space-y-4">
              <div className="flex justify-end mb-4">
                <Select value={kpiPeriod} onValueChange={(v) => setKpiPeriod(v as "7" | "30")}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">7 derniers jours</SelectItem>
                    <SelectItem value="30">30 derniers jours</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {kpis ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                          <Users className="w-5 h-5 text-emerald-500" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Clients accédés</p>
                          <p className="text-2xl font-bold">{kpis.uniqueClients}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                          <Eye className="w-5 h-5 text-blue-500" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Accès réussis</p>
                          <p className="text-2xl font-bold">{kpis.totalAccesses}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                          <XCircle className="w-5 h-5 text-red-500" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Accès échoués</p>
                          <p className="text-2xl font-bold">{kpis.failedAccesses}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                          <History className="w-5 h-5 text-purple-500" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Actions totales</p>
                          <p className="text-2xl font-bold">{kpis.totalActions}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center">
                          <BarChart3 className="w-5 h-5 text-cyan-500" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Moy. actions/jour</p>
                          <p className="text-2xl font-bold">{kpis.avgActionsPerDay}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <div className="text-center py-8">
                  <BarChart3 className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">Calcul des KPIs en cours...</p>
                </div>
              )}

              {/* Action breakdown */}
              {kpis && Object.keys(kpis.actionCounts).length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Répartition des actions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(kpis.actionCounts)
                        .sort(([, a], [, b]) => b - a)
                        .slice(0, 10)
                        .map(([action, count]) => (
                          <div key={action} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                            <span className="text-sm">
                              {actionTypeLabels[action as ActionType] || action}
                            </span>
                            <Badge variant="secondary">{count}</Badge>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Notes Tab */}
            <TabsContent value="notes" className="m-0 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Notes internes (Admin uniquement)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    placeholder="Notes HR/Ops internes sur cet employé..."
                    value={internalNotes}
                    onChange={(e) => setInternalNotes(e.target.value)}
                    rows={6}
                  />
                  <Button onClick={handleSaveNotes} disabled={savingNotes}>
                    <Save className="w-4 h-4 mr-2" />
                    {savingNotes ? "Enregistrement..." : "Enregistrer les notes"}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default EmployeeProfileDialog;
