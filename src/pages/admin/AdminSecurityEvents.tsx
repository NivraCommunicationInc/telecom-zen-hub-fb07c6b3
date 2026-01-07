import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Shield, AlertTriangle, Lock, RefreshCw, Search, XCircle, CheckCircle, Clock, Loader2, Activity, ShieldAlert, ShieldCheck, Eye } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

type EventSeverity = "critical" | "warning" | "info" | "success";

interface SecurityEvent {
  id: string;
  event_type: string;
  severity: EventSeverity;
  actor_email?: string;
  actor_role?: string;
  target_email?: string;
  ip_address?: string;
  details?: Record<string, any>;
  created_at: string;
  source: string;
}

const EVENT_TYPE_CONFIG: Record<string, { label: string; severity: EventSeverity; icon: typeof Shield }> = {
  login_failed: { label: "Échec de connexion", severity: "warning", icon: XCircle },
  login_success: { label: "Connexion réussie", severity: "success", icon: CheckCircle },
  otp_failed: { label: "Échec OTP/2FA", severity: "warning", icon: Lock },
  otp_success: { label: "OTP vérifié", severity: "success", icon: ShieldCheck },
  rate_limit_hit: { label: "Rate limit atteint", severity: "critical", icon: AlertTriangle },
  access_denied: { label: "Accès refusé", severity: "critical", icon: XCircle },
  password_reset: { label: "Réinitialisation MDP", severity: "info", icon: Lock },
  account_locked: { label: "Compte verrouillé", severity: "critical", icon: Lock },
  suspicious_activity: { label: "Activité suspecte", severity: "critical", icon: ShieldAlert },
  pin_failed: { label: "Échec PIN", severity: "warning", icon: Lock },
  pin_unlock: { label: "Déverrouillage PIN", severity: "info", icon: ShieldCheck },
  security_flag: { label: "Signalement sécurité", severity: "critical", icon: AlertTriangle },
  session_expired: { label: "Session expirée", severity: "info", icon: Clock },
  admin_action: { label: "Action admin", severity: "info", icon: Shield },
};

const SEVERITY_STYLES: Record<EventSeverity, string> = {
  critical: "bg-red-500/20 text-red-500 border-red-500/30",
  warning: "bg-amber-500/20 text-amber-500 border-amber-500/30",
  info: "bg-blue-500/20 text-blue-500 border-blue-500/30",
  success: "bg-emerald-500/20 text-emerald-500 border-emerald-500/30",
};

const AdminSecurityEvents = () => {
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [timeRange, setTimeRange] = useState<string>("24h");

  // Calculate time range
  const getTimeFilter = () => {
    const now = new Date();
    switch (timeRange) {
      case "1h": return new Date(now.getTime() - 60 * 60 * 1000).toISOString();
      case "24h": return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      case "7d": return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      case "30d": return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      default: return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    }
  };

  // Fetch security events from multiple sources
  const { data: events, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["security-events", timeRange, severityFilter, search],
    queryFn: async (): Promise<SecurityEvent[]> => {
      const timeFilter = getTimeFilter();
      const allEvents: SecurityEvent[] = [];

      // Fetch from admin_audit_log
      const { data: auditLogs } = await supabase
        .from("admin_audit_log")
        .select("*")
        .gte("created_at", timeFilter)
        .order("created_at", { ascending: false })
        .limit(200);

      if (auditLogs) {
        auditLogs.forEach((log: any) => {
          const eventType = mapAuditAction(log.action);
          allEvents.push({
            id: log.id,
            event_type: eventType,
            severity: EVENT_TYPE_CONFIG[eventType]?.severity || "info",
            actor_email: log.admin_email,
            actor_role: "admin",
            target_email: log.target_email,
            ip_address: log.ip_address,
            details: log.details,
            created_at: log.created_at,
            source: "admin_audit",
          });
        });
      }

      // Fetch from security_action_logs
      const { data: securityLogs } = await supabase
        .from("security_action_logs")
        .select("*")
        .gte("created_at", timeFilter)
        .order("created_at", { ascending: false })
        .limit(200);

      if (securityLogs) {
        securityLogs.forEach((log: any) => {
          const eventType = mapSecurityAction(log.action);
          allEvents.push({
            id: log.id,
            event_type: eventType,
            severity: EVENT_TYPE_CONFIG[eventType]?.severity || "warning",
            actor_email: log.action_by_name,
            actor_role: log.action_by_role,
            target_email: log.client_email,
            details: { ...log.details, reason: log.reason },
            created_at: log.created_at,
            source: "security_action",
          });
        });
      }

      // Fetch from client_access_logs (failed attempts)
      const { data: accessLogs } = await supabase
        .from("client_access_logs")
        .select("*")
        .gte("created_at", timeFilter)
        .order("created_at", { ascending: false })
        .limit(200);

      if (accessLogs) {
        accessLogs.forEach((log: any) => {
          if (log.result === "denied" || log.failed_attempt_count > 0) {
            allEvents.push({
              id: log.id,
              event_type: log.result === "denied" ? "access_denied" : "pin_failed",
              severity: log.result === "denied" ? "critical" : "warning",
              actor_email: log.staff_email,
              actor_role: log.staff_role,
              target_email: log.client_name,
              details: { 
                failed_attempts: log.failed_attempt_count,
                access_method: log.access_method,
                reason: log.access_reason 
              },
              created_at: log.created_at,
              source: "client_access",
            });
          }
        });
      }

      // Sort all events by date
      allEvents.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      // Apply filters
      let filtered = allEvents;

      if (severityFilter !== "all") {
        filtered = filtered.filter(e => e.severity === severityFilter);
      }

      if (search) {
        const searchLower = search.toLowerCase();
        filtered = filtered.filter(e => 
          e.actor_email?.toLowerCase().includes(searchLower) ||
          e.target_email?.toLowerCase().includes(searchLower) ||
          e.event_type.toLowerCase().includes(searchLower) ||
          e.ip_address?.includes(search)
        );
      }

      return filtered.slice(0, 500);
    },
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });

  // Stats calculations
  const stats = {
    critical: events?.filter(e => e.severity === "critical").length || 0,
    warning: events?.filter(e => e.severity === "warning").length || 0,
    info: events?.filter(e => e.severity === "info").length || 0,
    total: events?.length || 0,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <Shield className="w-8 h-8 text-primary" />
            Événements de sécurité
          </h1>
          <p className="text-muted-foreground mt-1">
            Surveillance en temps réel des événements de sécurité
          </p>
        </div>
        <Button 
          onClick={() => refetch()} 
          variant="outline"
          disabled={isRefetching}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isRefetching ? "animate-spin" : ""}`} />
          Actualiser
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-red-500/10 border-red-500/30">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-red-500/20 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-500">{stats.critical}</p>
              <p className="text-xs text-muted-foreground">Critiques</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-amber-500/10 border-amber-500/30">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <ShieldAlert className="w-6 h-6 text-amber-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-500">{stats.warning}</p>
              <p className="text-xs text-muted-foreground">Avertissements</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-blue-500/10 border-blue-500/30">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <Activity className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-500">{stats.info}</p>
              <p className="text-xs text-muted-foreground">Informations</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
              <Eye className="w-6 h-6 text-muted-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par email, IP, type..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Sévérité" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                <SelectItem value="critical">Critiques</SelectItem>
                <SelectItem value="warning">Avertissements</SelectItem>
                <SelectItem value="info">Informations</SelectItem>
                <SelectItem value="success">Succès</SelectItem>
              </SelectContent>
            </Select>
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Période" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1h">Dernière heure</SelectItem>
                <SelectItem value="24h">24 heures</SelectItem>
                <SelectItem value="7d">7 jours</SelectItem>
                <SelectItem value="30d">30 jours</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Events Table */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg">Journal des événements</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : events && events.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">Date/Heure</TableHead>
                    <TableHead className="w-[180px]">Type</TableHead>
                    <TableHead>Acteur</TableHead>
                    <TableHead>Cible</TableHead>
                    <TableHead>Détails</TableHead>
                    <TableHead className="w-[100px]">Sévérité</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((event) => {
                    const config = EVENT_TYPE_CONFIG[event.event_type] || { 
                      label: event.event_type, 
                      severity: "info",
                      icon: Activity 
                    };
                    const Icon = config.icon;

                    return (
                      <TableRow key={`${event.source}-${event.id}`}>
                        <TableCell className="font-mono text-sm">
                          {format(new Date(event.created_at), "dd/MM HH:mm:ss", { locale: fr })}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Icon className={`w-4 h-4 ${SEVERITY_STYLES[event.severity].split(" ")[1]}`} />
                            <span className="text-sm">{config.label}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm font-medium">{event.actor_email || "—"}</p>
                            {event.actor_role && (
                              <p className="text-xs text-muted-foreground">{event.actor_role}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {event.target_email || "—"}
                        </TableCell>
                        <TableCell>
                          {event.details && (
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {JSON.stringify(event.details).slice(0, 50)}...
                            </p>
                          )}
                          {event.ip_address && (
                            <p className="text-xs font-mono text-muted-foreground">
                              IP: {event.ip_address}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={SEVERITY_STYLES[event.severity]}>
                            {event.severity}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <ShieldCheck className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Aucun événement de sécurité trouvé</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

// Helper functions to map actions to event types
function mapAuditAction(action: string): string {
  const lowerAction = action.toLowerCase();
  if (lowerAction.includes("login") && lowerAction.includes("fail")) return "login_failed";
  if (lowerAction.includes("login")) return "login_success";
  if (lowerAction.includes("otp") && lowerAction.includes("fail")) return "otp_failed";
  if (lowerAction.includes("otp")) return "otp_success";
  if (lowerAction.includes("lock")) return "account_locked";
  if (lowerAction.includes("password") || lowerAction.includes("reset")) return "password_reset";
  if (lowerAction.includes("denied") || lowerAction.includes("unauthorized")) return "access_denied";
  return "admin_action";
}

function mapSecurityAction(action: string): string {
  const lowerAction = action.toLowerCase();
  if (lowerAction.includes("flag") || lowerAction.includes("fraud")) return "security_flag";
  if (lowerAction.includes("suspend")) return "account_locked";
  if (lowerAction.includes("unlock") || lowerAction.includes("lift")) return "pin_unlock";
  return "suspicious_activity";
}

export default AdminSecurityEvents;
