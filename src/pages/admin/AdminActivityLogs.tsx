import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, User, Clock, FileText, Shield, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/admin/ui/PageHeader";
import { useQuery } from "@tanstack/react-query";
import { adminClient as supabase } from "@/integrations/backend";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useRoleAccess } from "@/hooks/useRoleAccess";

const actionLabels: Record<string, string> = {
  create: "a créé",
  update: "a modifié",
  delete: "a supprimé",
  payment: "a traité un paiement sur",
  notification_resent: "a renvoyé une notification pour",
  technician_assigned: "a assigné un technicien à",
  status_change: "a changé le statut de",
  id_verification: "a vérifié l'identité pour",
};

const entityLabels: Record<string, string> = {
  order: "commande",
  invoice: "facture",
  client: "client",
  ticket: "ticket",
  technician: "technicien",
  appointment: "rendez-vous",
  subscription: "abonnement",
  service: "service",
  contract: "contrat",
  payment: "paiement",
};

const roleColors: Record<string, string> = {
  Admin: "bg-red-500/20 text-red-500",
  Employé: "bg-blue-500/20 text-blue-500",
  Technicien: "bg-amber-500/20 text-amber-500",
  Client: "bg-emerald-500/20 text-emerald-500",
};

const AdminActivityLogs = () => {
  const navigate = useNavigate();
  const { isAdmin, permissions } = useRoleAccess();

  // Redirect non-admins
  useEffect(() => {
    if (!permissions.canViewActivityLogs && !isAdmin) {
      navigate("/admin");
    }
  }, [permissions, isAdmin, navigate]);

  const { data: logs, isLoading } = useQuery({
    queryKey: ["admin-activity-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
    enabled: isAdmin || permissions.canViewActivityLogs,
  });

  // Only admins can view this page
  if (!isAdmin && !permissions.canViewActivityLogs) {
    return (
      <AdminLayout>
        <div className="flex flex-col items-center justify-center py-20">
          <Shield className="w-16 h-16 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold text-foreground">Accès refusé</h2>
          <p className="text-muted-foreground mt-2">Seuls les administrateurs peuvent accéder au journal d'activité.</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <PageHeader
          title="Journal d'activité"
          subtitle="Historique complet des actions (Admin, Employé, Technicien)"
          breadcrumbs={[
            { label: "Admin", href: "/admin" },
            { label: "Journal d'activité" },
          ]}
          badge={
            <Badge className="bg-red-500/15 text-red-400 border-red-500/30">
              <Shield className="w-3 h-3 mr-1" />
              Admin uniquement
            </Badge>
          }
        />

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-cyan-400" />
              Activités récentes ({logs?.length || 0} entrées)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : logs && logs.length > 0 ? (
              <div className="space-y-3">
                {logs.map((log: any) => (
                  <div
                    key={log.id}
                    className="flex items-start gap-4 p-4 bg-accent/30 rounded-lg border border-border/50 hover:bg-accent/50 transition-colors"
                  >
                    {/* Activity indicator */}
                    <div className="w-2 h-2 rounded-full bg-cyan-400 mt-2 flex-shrink-0" />

                    {/* Main content */}
                    <div className="flex-1 min-w-0">
                      {/* Actor info */}
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <Badge className={roleColors[log.actor_role] || "bg-muted text-muted-foreground"}>
                          {log.actor_role || "N/A"}
                        </Badge>
                        <span className="font-medium text-foreground">
                          {log.actor_name || "Utilisateur inconnu"}
                        </span>
                        {log.actor_email && (
                          <span className="text-sm text-muted-foreground">
                            ({log.actor_email})
                          </span>
                        )}
                      </div>

                      {/* Action description */}
                      <p className="text-sm text-foreground">
                        {actionLabels[log.action] || log.action}{" "}
                        {log.entity_type && (
                          <span className="font-medium">
                            {entityLabels[log.entity_type] || log.entity_type}
                          </span>
                        )}
                        {log.entity_id && (
                          <span className="text-muted-foreground ml-1">
                            (ID: {log.entity_id.slice(0, 8)}...)
                          </span>
                        )}
                      </p>

                      {/* Changed field info */}
                      {log.changed_field && (
                        <div className="flex items-center gap-2 mt-1 text-sm">
                          <FileText className="w-3 h-3 text-muted-foreground" />
                          <span className="text-muted-foreground">
                            Champ: <span className="text-foreground">{log.changed_field}</span>
                          </span>
                          {log.old_value && log.new_value && (
                            <span className="text-muted-foreground">
                              ({log.old_value} → {log.new_value})
                            </span>
                          )}
                        </div>
                      )}

                      {/* Reason if provided */}
                      {log.reason && (
                        <div className="flex items-center gap-2 mt-1 text-sm">
                          <AlertTriangle className="w-3 h-3 text-amber-500" />
                          <span className="text-muted-foreground">
                            Raison: <span className="text-foreground">{log.reason}</span>
                          </span>
                        </div>
                      )}

                      {/* Details JSON if present */}
                      {log.details && Object.keys(log.details).length > 0 && (
                        <div className="mt-2 p-2 bg-background/50 rounded text-xs text-muted-foreground font-mono overflow-x-auto">
                          {JSON.stringify(log.details, null, 2)}
                        </div>
                      )}

                      {/* Timestamp */}
                      <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {format(new Date(log.created_at), "d MMMM yyyy 'à' HH:mm:ss", { locale: fr })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Activity className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Aucune activité enregistrée</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminActivityLogs;
