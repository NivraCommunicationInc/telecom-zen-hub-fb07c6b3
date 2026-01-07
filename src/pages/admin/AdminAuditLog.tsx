import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { 
  History, 
  Search, 
  Calendar,
  Filter,
  User,
  Shield,
  Key,
  UserPlus,
  UserX,
  UserCheck,
  RefreshCw
} from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import { adminClient as supabase } from "@/integrations/backend";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";

interface AuditLogEntry {
  id: string;
  created_at: string;
  admin_user_id: string;
  admin_email: string | null;
  action: string;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  target_type: string | null;
  target_id: string | null;
  target_email: string | null;
}

const actionConfig: Record<string, { label: string; icon: typeof Shield; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  password_changed: { label: "Mot de passe changé", icon: Key, variant: "default" },
  password_change_failed: { label: "Échec changement MDP", icon: Key, variant: "destructive" },
  password_change_error: { label: "Erreur changement MDP", icon: Key, variant: "destructive" },
  staff_created: { label: "Utilisateur créé", icon: UserPlus, variant: "default" },
  staff_disabled: { label: "Utilisateur désactivé", icon: UserX, variant: "destructive" },
  staff_enabled: { label: "Utilisateur activé", icon: UserCheck, variant: "secondary" },
  staff_role_changed: { label: "Rôle modifié", icon: RefreshCw, variant: "outline" },
  staff_password_reset_sent: { label: "Réinit. MDP envoyée", icon: Key, variant: "secondary" },
  admin_bootstrap: { label: "Bootstrap admin", icon: Shield, variant: "default" },
};

const AdminAuditLog = () => {
  const [searchEmail, setSearchEmail] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);

  const { data: logs, isLoading, refetch } = useQuery({
    queryKey: ["admin-audit-log", searchEmail, actionFilter, dateFrom, dateTo],
    queryFn: async () => {
      let query = supabase
        .from("admin_audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

      if (searchEmail.trim()) {
        query = query.or(`admin_email.ilike.%${searchEmail}%,target_email.ilike.%${searchEmail}%`);
      }

      if (actionFilter && actionFilter !== "all") {
        query = query.eq("action", actionFilter);
      }

      if (dateFrom) {
        query = query.gte("created_at", dateFrom.toISOString());
      }

      if (dateTo) {
        const endOfDay = new Date(dateTo);
        endOfDay.setHours(23, 59, 59, 999);
        query = query.lte("created_at", endOfDay.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as AuditLogEntry[];
    },
  });

  const clearFilters = () => {
    setSearchEmail("");
    setActionFilter("all");
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  const getActionDisplay = (action: string) => {
    const config = actionConfig[action];
    if (config) {
      const Icon = config.icon;
      return (
        <Badge variant={config.variant} className="gap-1">
          <Icon className="h-3 w-3" />
          {config.label}
        </Badge>
      );
    }
    return <Badge variant="outline">{action}</Badge>;
  };

  const formatDetails = (log: AuditLogEntry) => {
    const parts: string[] = [];
    
    if (log.target_email) {
      parts.push(`Cible: ${log.target_email}`);
    }
    
    if (log.details) {
      if (log.details.role) parts.push(`Rôle: ${log.details.role}`);
      if (log.details.old_role && log.details.new_role) {
        parts.push(`${log.details.old_role} → ${log.details.new_role}`);
      }
      if (log.details.reason) parts.push(`Raison: ${log.details.reason}`);
    }

    return parts.length > 0 ? parts.join(" • ") : "—";
  };

  const uniqueActions = logs 
    ? [...new Set(logs.map(l => l.action))].sort()
    : Object.keys(actionConfig);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Journal d'audit</h1>
            <p className="text-muted-foreground mt-1">Historique des actions administratives</p>
          </div>
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualiser
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filtres
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4 items-end">
              <div className="flex-1 min-w-[200px]">
                <label className="text-sm font-medium mb-1.5 block">Recherche par email</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="admin@nivratelecom.ca"
                    value={searchEmail}
                    onChange={(e) => setSearchEmail(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="min-w-[180px]">
                <label className="text-sm font-medium mb-1.5 block">Action</label>
                <Select value={actionFilter} onValueChange={setActionFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Toutes les actions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes les actions</SelectItem>
                    {uniqueActions.map(action => (
                      <SelectItem key={action} value={action}>
                        {actionConfig[action]?.label || action}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">Date début</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-[140px] justify-start text-left font-normal">
                      <Calendar className="mr-2 h-4 w-4" />
                      {dateFrom ? format(dateFrom, "dd MMM", { locale: fr }) : "—"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={dateFrom}
                      onSelect={setDateFrom}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">Date fin</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-[140px] justify-start text-left font-normal">
                      <Calendar className="mr-2 h-4 w-4" />
                      {dateTo ? format(dateTo, "dd MMM", { locale: fr }) : "—"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={dateTo}
                      onSelect={setDateTo}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <Button variant="ghost" onClick={clearFilters}>
                Effacer
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Audit Log Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Entrées du journal
            </CardTitle>
            <CardDescription>
              {logs?.length || 0} entrée(s) trouvée(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map(i => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : !logs || logs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Aucune entrée trouvée</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[180px]">Date/Heure</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Acteur</TableHead>
                      <TableHead>Détails</TableHead>
                      <TableHead className="w-[120px]">IP</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map(log => (
                      <TableRow key={log.id}>
                        <TableCell className="font-mono text-sm">
                          {format(new Date(log.created_at), "dd MMM yyyy HH:mm", { locale: fr })}
                        </TableCell>
                        <TableCell>
                          {getActionDisplay(log.action)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{log.admin_email || "—"}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[300px] truncate">
                          {formatDetails(log)}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {log.ip_address || "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminAuditLog;
