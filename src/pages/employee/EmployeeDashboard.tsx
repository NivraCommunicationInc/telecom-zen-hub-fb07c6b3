import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { employeeClient as supabase } from "@/integrations/backend/employeeClient";
import { Package, MessageSquare, XCircle, AlertTriangle, Clock, CheckCircle, Activity, Wifi, WifiOff, Server, AlertCircle, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Link } from "react-router-dom";
import { useEmployeeAuth } from "@/hooks/useEmployeeAuth";
import { useServerEmployeePermissions } from "@/hooks/useServerEmployeePermissions";
import { useState, useEffect } from "react";

interface ApiDebugInfo {
  endpoint: string;
  status: number | null;
  message: string;
  timestamp: string;
}

const EmployeeDashboard = () => {
  const { user, session } = useEmployeeAuth();
  const { permissions, isLoading: permissionsLoading, error: permissionsError, can } = useServerEmployeePermissions();
  const [lastApiCall, setLastApiCall] = useState<ApiDebugInfo | null>(null);

  // Track API calls for debug card
  const updateApiDebug = (endpoint: string, status: number | null, message: string) => {
    setLastApiCall({
      endpoint,
      status,
      message,
      timestamp: new Date().toISOString(),
    });
  };

  // Pending orders count - only if permitted
  const { data: pendingOrdersCount, error: ordersError, isLoading: ordersLoading } = useQuery({
    queryKey: ["employee-pending-orders"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .in("status", ["pending", "processing", "verification"]);
      
      if (error) {
        updateApiDebug("/orders (count)", null, error.message);
        throw error;
      }
      updateApiDebug("/orders (count)", 200, "OK");
      return count || 0;
    },
    enabled: can("can_view_orders"),
  });

  // Open tickets count - only if permitted
  const { data: openTicketsCount, error: ticketsError, isLoading: ticketsLoading } = useQuery({
    queryKey: ["employee-open-tickets"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("support_tickets")
        .select("*", { count: "exact", head: true })
        .in("status", ["open", "pending", "in_progress"]);
      
      if (error) {
        updateApiDebug("/support_tickets (count)", null, error.message);
        throw error;
      }
      updateApiDebug("/support_tickets (count)", 200, "OK");
      return count || 0;
    },
    enabled: can("can_create_tickets"),
  });

  // Pending cancellations count
  const { data: pendingCancellationsCount, error: cancellationsError } = useQuery({
    queryKey: ["employee-pending-cancellations"],
    queryFn: async () => {
      try {
        const { count, error } = await supabase
          .from("support_tickets")
          .select("*", { count: "exact", head: true })
          .eq("category", "cancellation")
          .in("status", ["open", "pending", "in_progress"]);
        
        if (error) {
          updateApiDebug("/support_tickets (cancellations)", null, error.message);
          return 0;
        }
        updateApiDebug("/support_tickets (cancellations)", 200, "OK");
        return count || 0;
      } catch { 
        return 0; 
      }
    },
    enabled: can("can_view_cancellations"),
  });

  // Pending disputes count
  const { data: pendingDisputesCount, error: disputesError } = useQuery({
    queryKey: ["employee-pending-disputes"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("payment_disputes")
        .select("*", { count: "exact", head: true })
        .in("status", ["submitted", "under_review", "awaiting_client"]);
      
      if (error) {
        updateApiDebug("/payment_disputes (count)", null, error.message);
        throw error;
      }
      updateApiDebug("/payment_disputes (count)", 200, "OK");
      return count || 0;
    },
    enabled: can("can_view_disputes"),
  });

  // Recent activity
  const { data: recentActivity, error: activityError, isLoading: activityLoading } = useQuery({
    queryKey: ["employee-recent-activity"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);
      
      if (error) {
        updateApiDebug("/activity_logs", null, error.message);
        throw error;
      }
      updateApiDebug("/activity_logs", 200, "OK");
      return data || [];
    },
  });

  // Collect all errors
  const hasAnyError = permissionsError || ordersError || ticketsError || activityError;

  const stats = [
    {
      label: "Commandes en attente",
      value: pendingOrdersCount || 0,
      icon: Package,
      color: "text-amber-500",
      bg: "bg-amber-500/20",
      href: "/employee/orders",
      permission: "can_view_orders",
      loading: ordersLoading,
      error: ordersError,
    },
    {
      label: "Tickets ouverts",
      value: openTicketsCount || 0,
      icon: MessageSquare,
      color: "text-cyan-500",
      bg: "bg-cyan-500/20",
      href: "/employee/tickets",
      permission: "can_create_tickets",
      loading: ticketsLoading,
      error: ticketsError,
    },
    {
      label: "Annulations en attente",
      value: pendingCancellationsCount || 0,
      icon: XCircle,
      color: "text-red-500",
      bg: "bg-red-500/20",
      href: "/employee/cancellations",
      permission: "can_view_cancellations",
      error: cancellationsError,
    },
    {
      label: "Contestations en attente",
      value: pendingDisputesCount || 0,
      icon: AlertTriangle,
      color: "text-purple-500",
      bg: "bg-purple-500/20",
      href: "/employee/payment-disputes",
      permission: "can_view_disputes",
      error: disputesError,
    },
  ].filter(stat => !stat.permission || can(stat.permission as any));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Tableau de bord</h1>
        <p className="text-muted-foreground mt-1">Vue d'ensemble de vos tâches</p>
      </div>

      {/* System Status Card - Always visible for debugging */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="w-5 h-5 text-primary" />
            État du système
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Session Status */}
          <div className="flex items-center justify-between p-3 bg-accent/30 rounded-lg">
            <div className="flex items-center gap-3">
              {session ? (
                <Wifi className="w-5 h-5 text-emerald-500" />
              ) : (
                <WifiOff className="w-5 h-5 text-red-500" />
              )}
              <div>
                <p className="text-sm font-medium text-foreground">Session employé</p>
                <p className="text-xs text-muted-foreground">
                  {user?.email || "Non connecté"}
                </p>
              </div>
            </div>
            <Badge className={session ? "bg-emerald-500/20 text-emerald-500" : "bg-red-500/20 text-red-500"}>
              {session ? "Active" : "Inactive"}
            </Badge>
          </div>

          {/* Permissions Status */}
          <div className="flex items-center justify-between p-3 bg-accent/30 rounded-lg">
            <div className="flex items-center gap-3">
              {permissionsLoading ? (
                <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
              ) : permissionsError ? (
                <AlertCircle className="w-5 h-5 text-red-500" />
              ) : (
                <Server className="w-5 h-5 text-emerald-500" />
              )}
              <div>
                <p className="text-sm font-medium text-foreground">Permissions serveur</p>
                <p className="text-xs text-muted-foreground">
                  {permissionsLoading ? "Chargement..." : 
                   permissionsError ? "Erreur de chargement" : 
                   `${Object.values(permissions).filter(Boolean).length} permissions actives`}
                </p>
              </div>
            </div>
            <Badge className={
              permissionsLoading ? "bg-muted text-muted-foreground" :
              permissionsError ? "bg-red-500/20 text-red-500" : 
              "bg-emerald-500/20 text-emerald-500"
            }>
              {permissionsLoading ? "..." : permissionsError ? "Erreur" : "OK"}
            </Badge>
          </div>

          {/* Last API Call Debug */}
          {lastApiCall && (
            <div className="flex items-center justify-between p-3 bg-accent/30 rounded-lg">
              <div className="flex items-center gap-3">
                <Server className={`w-5 h-5 ${lastApiCall.status === 200 ? "text-emerald-500" : "text-red-500"}`} />
                <div>
                  <p className="text-sm font-medium text-foreground font-mono">{lastApiCall.endpoint}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(lastApiCall.timestamp), "HH:mm:ss", { locale: fr })}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <Badge className={lastApiCall.status === 200 ? "bg-emerald-500/20 text-emerald-500" : "bg-red-500/20 text-red-500"}>
                  {lastApiCall.status || "ERR"}
                </Badge>
                {lastApiCall.status !== 200 && (
                  <p className="text-xs text-red-500 mt-1">{lastApiCall.message}</p>
                )}
              </div>
            </div>
          )}

          {/* Error Display */}
          {hasAnyError && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
              <div className="flex items-center gap-2 text-red-500 mb-2">
                <AlertCircle className="w-5 h-5" />
                <span className="font-medium">Erreur API détectée</span>
              </div>
              <div className="text-sm text-red-400 space-y-1 font-mono">
                {permissionsError && (
                  <p>Permissions: {(permissionsError as Error).message}</p>
                )}
                {ordersError && (
                  <p>Commandes: {(ordersError as Error).message}</p>
                )}
                {ticketsError && (
                  <p>Tickets: {(ticketsError as Error).message}</p>
                )}
                {activityError && (
                  <p>Activité: {(activityError as Error).message}</p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats Cards - Only show permitted */}
      {stats.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <Link key={stat.label} to={stat.href}>
              <Card className="bg-card border-border hover:border-primary/50 transition-colors cursor-pointer">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-lg ${stat.bg} flex items-center justify-center`}>
                    {stat.loading ? (
                      <Loader2 className={`w-6 h-6 ${stat.color} animate-spin`} />
                    ) : stat.error ? (
                      <AlertCircle className="w-6 h-6 text-red-500" />
                    ) : (
                      <stat.icon className={`w-6 h-6 ${stat.color}`} />
                    )}
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">
                      {stat.loading ? "..." : stat.error ? "!" : stat.value}
                    </p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* No permissions message */}
      {stats.length === 0 && !permissionsLoading && (
        <Card className="bg-amber-500/10 border-amber-500/30">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">Aucune permission active</h3>
            <p className="text-muted-foreground">
              Votre compte n'a pas de permissions assignées. Contactez un administrateur.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Recent Activity */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-muted-foreground" />
            Activité récente
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activityLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : activityError ? (
            <div className="text-center py-8">
              <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
              <p className="text-red-500 font-medium">Erreur de chargement</p>
              <p className="text-sm text-muted-foreground font-mono">{(activityError as Error).message}</p>
            </div>
          ) : recentActivity && recentActivity.length > 0 ? (
            <div className="space-y-3">
              {recentActivity.map((activity: any) => (
                <div key={activity.id} className="flex items-start gap-3 p-3 bg-accent/30 rounded-lg">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                    <CheckCircle className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{activity.action}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {activity.entity_type} • {activity.actor_name || "Système"}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {format(new Date(activity.created_at), "d MMM HH:mm", { locale: fr })}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">Aucune activité récente</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default EmployeeDashboard;
