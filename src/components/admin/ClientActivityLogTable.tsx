import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminClient as supabase } from "@/integrations/backend/adminClient";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { ChevronDown, ChevronRight, Search, Shield, History, Lock } from "lucide-react";
import { useRoleAccess } from "@/hooks/useRoleAccess";
import { actionTypeLabels, ActionType } from "@/hooks/useClientActivityLog";

interface ClientActivityLogTableProps {
  clientId: string;
}

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

const ClientActivityLogTable = ({ clientId }: ClientActivityLogTableProps) => {
  const { isAdmin } = useRoleAccess();
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Only fetch if admin
  const { data: logs, isLoading } = useQuery({
    queryKey: ["client-activity-logs", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_activity_logs")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return data;
    },
    enabled: isAdmin && !!clientId,
  });

  // If not admin, show restricted message
  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Lock className="w-12 h-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">Accès restreint</h3>
        <p className="text-muted-foreground">
          Journal visible uniquement par l'administrateur.
        </p>
      </div>
    );
  }

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const filteredLogs = logs?.filter((log) => {
    const matchesSearch =
      !searchQuery ||
      log.summary?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.actor_name?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesAction = actionFilter === "all" || log.action_type === actionFilter;
    const matchesRole = roleFilter === "all" || log.actor_role === roleFilter;

    return matchesSearch && matchesAction && matchesRole;
  });

  const uniqueActionTypes = [...new Set(logs?.map((log) => log.action_type) || [])];

  const renderJsonData = (data: any, label: string) => {
    if (!data || Object.keys(data).length === 0) return null;

    return (
      <div className="mt-2">
        <p className="text-xs font-medium text-muted-foreground mb-1">{label}:</p>
        <pre className="text-xs bg-muted/50 p-2 rounded overflow-x-auto max-h-32">
          {JSON.stringify(data, null, 2)}
        </pre>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Shield className="w-5 h-5 text-purple-400" />
        <h3 className="font-semibold text-lg">Journal d'activité (Admin uniquement)</h3>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher dans le résumé..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

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
      </div>

      {/* Logs Table */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : filteredLogs && filteredLogs.length > 0 ? (
        <div className="space-y-2">
          {filteredLogs.map((log) => (
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
                      <div className="text-sm">
                        <span className="text-muted-foreground">
                          {format(new Date(log.created_at), "d MMM yyyy", { locale: fr })}
                        </span>
                        <span className="text-muted-foreground ml-2">
                          {format(new Date(log.created_at), "HH:mm")}
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
    </div>
  );
};

export default ClientActivityLogTable;
