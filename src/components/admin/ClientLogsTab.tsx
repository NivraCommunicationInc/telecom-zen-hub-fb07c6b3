import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  ChevronDown, 
  ChevronRight, 
  Search, 
  Eye, 
  History, 
  KeyRound, 
  Mail, 
  Calendar, 
  ShieldCheck,
  CheckCircle,
  XCircle,
  Clock,
  Lock
} from "lucide-react";
import { actionTypeLabels, ActionType } from "@/hooks/useClientActivityLog";

interface ClientLogsTabProps {
  clientUserId: string;
  isAdmin: boolean;
}

// Access method display config
const methodLabels: Record<string, { label: string; icon: any; color: string }> = {
  pin: { label: "NIP", icon: KeyRound, color: "bg-blue-500/20 text-blue-600" },
  email_otp: { label: "OTP Email", icon: Mail, color: "bg-purple-500/20 text-purple-600" },
  dob_postal: { label: "Vérification DOB", icon: Calendar, color: "bg-cyan-500/20 text-cyan-600" },
  email_postal: { label: "Vérification Email", icon: Mail, color: "bg-teal-500/20 text-teal-600" },
  admin_bypass: { label: "Admin Bypass", icon: ShieldCheck, color: "bg-amber-500/20 text-amber-600" },
};

// Reason labels
const reasonLabels: Record<string, string> = {
  billing: "Facturation",
  plan_change: "Changement de forfait",
  equipment: "Équipement",
  appointment: "Rendez-vous",
  support: "Support",
  other: "Autre",
};

// Role display config
const roleColors: Record<string, string> = {
  admin: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  employee: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  technician: "bg-amber-500/20 text-amber-400 border-amber-500/30",
};

const roleLabels: Record<string, string> = {
  admin: "Admin",
  employee: "Employé",
  technician: "Technicien",
};

// Redact sensitive data for employees
const redactSensitiveData = (data: any): any => {
  if (!data) return data;
  const sensitiveFields = ['date_of_birth', 'dob', 'postal_code', 'email', 'otp', 'pin', 'id_number'];
  const redacted = { ...data };
  
  for (const key of Object.keys(redacted)) {
    if (sensitiveFields.some(f => key.toLowerCase().includes(f))) {
      redacted[key] = '***';
    } else if (typeof redacted[key] === 'object' && redacted[key] !== null) {
      redacted[key] = redactSensitiveData(redacted[key]);
    }
  }
  return redacted;
};

export const ClientLogsTab = ({ clientUserId, isAdmin }: ClientLogsTabProps) => {
  const [activeTab, setActiveTab] = useState("access");
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [resultFilter, setResultFilter] = useState<string>("all");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Fetch access logs
  const { data: accessLogs, isLoading: accessLoading } = useQuery({
    queryKey: ["client-access-logs", clientUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_access_logs")
        .select("*")
        .eq("client_id", clientUserId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
    enabled: !!clientUserId,
  });

  // Fetch activity logs
  const { data: activityLogs, isLoading: activityLoading } = useQuery({
    queryKey: ["client-activity-logs", clientUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_activity_logs")
        .select("*")
        .eq("client_id", clientUserId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
    enabled: !!clientUserId,
  });

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  // Filter access logs
  const filteredAccessLogs = accessLogs?.filter((log) => {
    const matchesSearch =
      !searchQuery ||
      log.staff_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.access_method?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesRole = roleFilter === "all" || log.staff_role === roleFilter;
    const matchesResult = resultFilter === "all" || log.result === resultFilter;

    return matchesSearch && matchesRole && matchesResult;
  });

  // Filter activity logs
  const filteredActivityLogs = activityLogs?.filter((log) => {
    const matchesSearch =
      !searchQuery ||
      log.summary?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.actor_name?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesAction = actionFilter === "all" || log.action_type === actionFilter;
    const matchesRole = roleFilter === "all" || log.actor_role === roleFilter;

    return matchesSearch && matchesAction && matchesRole;
  });

  const uniqueActionTypes = [...new Set(activityLogs?.map((log) => log.action_type) || [])];

  const renderJsonData = (data: any, label: string) => {
    if (!data || Object.keys(data).length === 0) return null;
    // Redact for employees
    const displayData = isAdmin ? data : redactSensitiveData(data);

    return (
      <div className="mt-2">
        <p className="text-xs font-medium text-muted-foreground mb-1">{label}:</p>
        <pre className="text-xs bg-muted/50 p-2 rounded overflow-x-auto max-h-32">
          {JSON.stringify(displayData, null, 2)}
        </pre>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-2 w-full max-w-sm">
          <TabsTrigger value="access" className="gap-2">
            <Eye className="w-4 h-4" />
            Accès au compte
          </TabsTrigger>
          <TabsTrigger value="activity" className="gap-2">
            <History className="w-4 h-4" />
            Journal d'activité
          </TabsTrigger>
        </TabsList>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mt-4 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Rôle" />
            </SelectTrigger>
            <SelectContent className="bg-popover border border-border z-50">
              <SelectItem value="all">Tous les rôles</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="employee">Employé</SelectItem>
              <SelectItem value="technician">Technicien</SelectItem>
            </SelectContent>
          </Select>

          {activeTab === "access" && (
            <Select value={resultFilter} onValueChange={setResultFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Résultat" />
              </SelectTrigger>
              <SelectContent className="bg-popover border border-border z-50">
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="success">Succès</SelectItem>
                <SelectItem value="fail">Échec</SelectItem>
              </SelectContent>
            </Select>
          )}

          {activeTab === "activity" && (
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Type d'action" />
              </SelectTrigger>
              <SelectContent className="bg-popover border border-border z-50">
                <SelectItem value="all">Toutes les actions</SelectItem>
                {uniqueActionTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {actionTypeLabels[type as ActionType] || type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Access Logs Tab */}
        <TabsContent value="access" className="mt-0">
          <ScrollArea className="h-[400px] pr-4">
            {accessLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : filteredAccessLogs && filteredAccessLogs.length > 0 ? (
              <div className="space-y-2">
                {filteredAccessLogs.map((log) => {
                  const method = methodLabels[log.access_method] || { 
                    label: log.access_method, 
                    icon: Eye, 
                    color: "bg-gray-500/20 text-gray-600" 
                  };
                  const MethodIcon = method.icon;

                  return (
                    <Collapsible key={log.id} open={expandedRows.has(log.id)}>
                      <div className={`border rounded-lg ${
                        log.result === "fail" 
                          ? "bg-red-500/5 border-red-500/20" 
                          : "bg-card border-border"
                      }`}>
                        <CollapsibleTrigger asChild>
                          <button
                            className="w-full p-3 flex items-start gap-3 text-left hover:bg-accent/50 transition-colors"
                            onClick={() => toggleRow(log.id)}
                          >
                            <div className="flex-shrink-0 mt-1">
                              {expandedRows.has(log.id) ? (
                                <ChevronDown className="w-4 h-4 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                              )}
                            </div>

                            <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-4 gap-2">
                              {/* Date/Time */}
                              <div className="flex items-center gap-2 text-sm">
                                <Clock className="w-3 h-3 text-muted-foreground" />
                                <span className="text-muted-foreground">
                                  {format(new Date(log.created_at), "d MMM yyyy HH:mm", { locale: fr })}
                                </span>
                              </div>

                              {/* Actor */}
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium truncate">
                                  {log.staff_name || "—"}
                                </span>
                                <Badge
                                  variant="outline"
                                  className={`text-xs ${roleColors[log.staff_role] || ""}`}
                                >
                                  {roleLabels[log.staff_role] || log.staff_role}
                                </Badge>
                              </div>

                              {/* Method */}
                              <div>
                                <Badge className={method.color}>
                                  <MethodIcon className="w-3 h-3 mr-1" />
                                  {method.label}
                                </Badge>
                              </div>

                              {/* Result */}
                              <div className="flex items-center gap-2">
                                {log.result === "success" ? (
                                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                                ) : (
                                  <XCircle className="w-4 h-4 text-red-500" />
                                )}
                                <span className={`text-sm ${
                                  log.result === "success" ? "text-emerald-500" : "text-red-500"
                                }`}>
                                  {log.result === "success" ? "Succès" : "Échec"}
                                </span>
                                {log.result === "fail" && log.failed_attempt_count > 0 && (
                                  <Badge variant="destructive" className="text-xs">
                                    Tentative #{log.failed_attempt_count}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </button>
                        </CollapsibleTrigger>

                        <CollapsibleContent>
                          <div className="px-10 pb-3 space-y-2 border-t border-border/50 pt-2">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="text-muted-foreground">Raison d'accès: </span>
                                <span className="font-medium">
                                  {log.access_reason ? (reasonLabels[log.access_reason] || log.access_reason) : "—"}
                                </span>
                              </div>
                              {isAdmin && log.staff_email && (
                                <div>
                                  <span className="text-muted-foreground">Email: </span>
                                  <span className="font-mono text-xs">{log.staff_email}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <Eye className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground">Aucun accès enregistré</p>
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        {/* Activity Logs Tab */}
        <TabsContent value="activity" className="mt-0">
          <ScrollArea className="h-[400px] pr-4">
            {activityLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : filteredActivityLogs && filteredActivityLogs.length > 0 ? (
              <div className="space-y-2">
                {filteredActivityLogs.map((log) => (
                  <Collapsible key={log.id} open={expandedRows.has(log.id)}>
                    <div className="border border-border rounded-lg bg-card">
                      <CollapsibleTrigger asChild>
                        <button
                          className="w-full p-3 flex items-start gap-3 text-left hover:bg-accent/50 transition-colors"
                          onClick={() => toggleRow(log.id)}
                        >
                          <div className="flex-shrink-0 mt-1">
                            {expandedRows.has(log.id) ? (
                              <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-muted-foreground" />
                            )}
                          </div>

                          <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-4 gap-2">
                            {/* Date/Time */}
                            <div className="flex items-center gap-2 text-sm">
                              <Clock className="w-3 h-3 text-muted-foreground" />
                              <span className="text-muted-foreground">
                                {format(new Date(log.created_at), "d MMM yyyy HH:mm", { locale: fr })}
                              </span>
                            </div>

                            {/* Actor */}
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium truncate">
                                {log.actor_name || "—"}
                              </span>
                              <Badge
                                variant="outline"
                                className={`text-xs ${roleColors[log.actor_role] || ""}`}
                              >
                                {roleLabels[log.actor_role] || log.actor_role}
                              </Badge>
                            </div>

                            {/* Action */}
                            <div>
                              <Badge variant="secondary" className="text-xs">
                                {actionTypeLabels[log.action_type as ActionType] || log.action_type}
                              </Badge>
                            </div>

                            {/* Summary */}
                            <div className="text-sm text-foreground truncate">
                              {log.summary}
                            </div>
                          </div>
                        </button>
                      </CollapsibleTrigger>

                      <CollapsibleContent>
                        <div className="px-10 pb-3 space-y-2 border-t border-border/50 pt-2">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">Type d'entité: </span>
                              <span className="font-medium">{log.entity_type || "—"}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">ID entité: </span>
                              <span className="font-mono text-xs">
                                {log.entity_id?.slice(0, 8) || "—"}
                              </span>
                            </div>
                          </div>

                          {renderJsonData(log.before_data, "Avant")}
                          {renderJsonData(log.after_data, "Après")}
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
              </div>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ClientLogsTab;
