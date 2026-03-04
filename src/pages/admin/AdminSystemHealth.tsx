/**
 * Admin System Health — Carrier-grade monitoring dashboard
 * Shows cron runs, email queue, KYC health, and error logs.
 */
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Activity,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Mail,
  Shield,
  AlertTriangle,
  Server,
  Loader2,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { adminClient as supabase } from "@/integrations/backend";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const AdminSystemHealth = () => {
  // Cron / automation runs
  const { data: automationRuns, isLoading: loadingRuns, refetch: refetchRuns } = useQuery({
    queryKey: ["system-health-automation-runs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("billing_automation_runs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
  });

  // Email queue stats
  const { data: emailStats, isLoading: loadingEmail, refetch: refetchEmail } = useQuery({
    queryKey: ["system-health-email-stats"],
    queryFn: async () => {
      const { count: pendingCount } = await supabase
        .from("email_queue")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");

      const { count: failedCount } = await supabase
        .from("email_queue")
        .select("*", { count: "exact", head: true })
        .eq("status", "failed");

      const { count: sentCount } = await supabase
        .from("email_queue")
        .select("*", { count: "exact", head: true })
        .eq("status", "sent");

      const { data: recentFailed } = await supabase
        .from("email_queue")
        .select("*")
        .eq("status", "failed")
        .order("created_at", { ascending: false })
        .limit(10);

      return {
        pendingCount: pendingCount || 0,
        failedCount: failedCount || 0,
        sentCount: sentCount || 0,
        recentFailures: recentFailed || [],
      };
    },
  });

  // KYC health
  const { data: kycHealth, isLoading: loadingKyc, refetch: refetchKyc } = useQuery({
    queryKey: ["system-health-kyc"],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.functions.invoke("kyc-health");
        if (error) throw error;
        return data;
      } catch {
        return { status: "error", version: "unknown", timestamp: new Date().toISOString() };
      }
    },
  });

  // Admin notification logs (recent errors)
  const { data: recentErrors, isLoading: loadingErrors } = useQuery({
    queryKey: ["system-health-recent-errors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("billing_automation_runs")
        .select("*")
        .not("errors", "is", null)
        .order("started_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []).filter((r: any) => r.errors_count && r.errors_count > 0);
    },
  });

  const handleRefreshAll = () => {
    refetchRuns();
    refetchEmail();
    refetchKyc();
  };

  const isLoading = loadingRuns || loadingEmail || loadingKyc || loadingErrors;

  // Group automation runs by type for summary
  const runSummary = (automationRuns || []).reduce((acc: Record<string, any>, run: any) => {
    if (!acc[run.run_type] || new Date(run.started_at) > new Date(acc[run.run_type].started_at)) {
      acc[run.run_type] = run;
    }
    return acc;
  }, {} as Record<string, any>);

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground flex items-center gap-3">
              <Activity className="w-8 h-8 text-primary" />
              Santé du système
            </h1>
            <p className="text-muted-foreground mt-1">Surveillance carrier-grade — Nivra Telecom</p>
          </div>
          <Button variant="outline" onClick={handleRefreshAll} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Actualiser
          </Button>
        </div>

        {/* Top Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* KYC Health */}
          <Card className={kycHealth?.status === "healthy" ? "border-emerald-500/30" : "border-destructive/30"}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Shield className="w-4 h-4" />
                KYC Health
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingKyc ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <div className="space-y-1">
                  <Badge className={kycHealth?.status === "healthy" ? "bg-emerald-500/20 text-emerald-600" : "bg-destructive/20 text-destructive"}>
                    {kycHealth?.status === "healthy" ? "✓ Healthy" : "✗ Error"}
                  </Badge>
                  <p className="text-xs text-muted-foreground">v{kycHealth?.version || "?"}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Email Queue */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Mail className="w-4 h-4" />
                File d'attente emails
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingEmail ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold">{emailStats?.pendingCount || 0}</span>
                    <span className="text-xs text-muted-foreground">en attente</span>
                  </div>
                  <div className="flex gap-3 text-xs">
                    <span className="text-emerald-600">{emailStats?.sentCount || 0} envoyés</span>
                    <span className="text-destructive">{emailStats?.failedCount || 0} échoués</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Automation Runs */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Server className="w-4 h-4" />
                Jobs automatisés
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingRuns ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <div className="space-y-1">
                  <span className="text-2xl font-bold">{Object.keys(runSummary).length}</span>
                  <span className="text-xs text-muted-foreground ml-1">types de jobs</span>
                  <p className="text-xs text-muted-foreground">{automationRuns?.length || 0} exécutions récentes</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Errors */}
          <Card className={(recentErrors?.length || 0) > 0 ? "border-destructive/30" : "border-emerald-500/30"}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Erreurs récentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <span className="text-2xl font-bold">{recentErrors?.length || 0}</span>
                <span className="text-xs text-muted-foreground ml-1">runs avec erreurs</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Cron Job Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Dernière exécution par type de job
            </CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(runSummary).length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune exécution enregistrée.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-3 text-muted-foreground font-medium">Job</th>
                      <th className="text-left py-2 px-3 text-muted-foreground font-medium">Dernière exécution</th>
                      <th className="text-left py-2 px-3 text-muted-foreground font-medium">Statut</th>
                      <th className="text-left py-2 px-3 text-muted-foreground font-medium">Renouvellements</th>
                      <th className="text-left py-2 px-3 text-muted-foreground font-medium">Expirés</th>
                      <th className="text-left py-2 px-3 text-muted-foreground font-medium">Erreurs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(runSummary).map(([type, run]: [string, any]) => (
                      <tr key={type} className="border-b border-border/50">
                        <td className="py-2 px-3 font-mono text-xs">{type}</td>
                        <td className="py-2 px-3 text-xs">
                          {format(new Date(run.started_at), "d MMM HH:mm:ss", { locale: fr })}
                        </td>
                        <td className="py-2 px-3">
                          <Badge className={run.status === "completed" ? "bg-emerald-500/20 text-emerald-600" : "bg-destructive/20 text-destructive"}>
                            {run.status === "completed" ? <CheckCircle className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
                            {run.status}
                          </Badge>
                        </td>
                        <td className="py-2 px-3 text-xs">{run.renewals_generated || 0}</td>
                        <td className="py-2 px-3 text-xs">{run.subscriptions_expired || 0}</td>
                        <td className="py-2 px-3 text-xs">
                          {(run.errors_count || 0) > 0 ? (
                            <span className="text-destructive font-bold">{run.errors_count}</span>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Automation Runs */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Server className="w-4 h-4" />
                20 dernières exécutions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-[400px]">
                <div className="space-y-2">
                  {(automationRuns || []).map((run: any) => (
                    <div key={run.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50 text-xs">
                      <div className="flex items-center gap-2">
                        {run.status === "completed" ? (
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-destructive" />
                        )}
                        <span className="font-mono">{run.run_type}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {(run.errors_count || 0) > 0 && (
                          <Badge variant="destructive" className="text-xs">{run.errors_count} err</Badge>
                        )}
                        <span className="text-muted-foreground">
                          {format(new Date(run.started_at), "d MMM HH:mm", { locale: fr })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Email Failures */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Mail className="w-4 h-4 text-destructive" />
                10 derniers emails échoués
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-[400px]">
                {(emailStats?.recentFailures || []).length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">Aucun email échoué récemment ✓</p>
                ) : (
                  <div className="space-y-2">
                    {(emailStats?.recentFailures || []).map((email: any) => (
                      <div key={email.id} className="p-2 rounded-lg bg-destructive/5 border border-destructive/20 text-xs space-y-1">
                        <div className="flex justify-between">
                          <span className="font-mono">{email.template_id || email.event_type || "unknown"}</span>
                          <span className="text-muted-foreground">
                            {format(new Date(email.created_at), "d MMM HH:mm", { locale: fr })}
                          </span>
                        </div>
                        <p className="text-muted-foreground truncate">{email.to_email || email.recipient || "—"}</p>
                        {email.error_message && (
                          <p className="text-destructive truncate">{email.error_message}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Error Details */}
        {(recentErrors?.length || 0) > 0 && (
          <Card className="border-destructive/30">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-destructive" />
                Détail des erreurs (runs avec erreurs)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-[300px]">
                <div className="space-y-3">
                  {(recentErrors || []).map((run: any) => (
                    <div key={run.id} className="p-3 rounded-lg bg-destructive/5 border border-destructive/20 text-xs space-y-1">
                      <div className="flex justify-between">
                        <span className="font-mono font-bold">{run.run_type}</span>
                        <span className="text-muted-foreground">
                          {format(new Date(run.started_at), "d MMM yyyy HH:mm", { locale: fr })}
                        </span>
                      </div>
                      <p className="text-destructive">{run.errors_count} erreur(s)</p>
                      {run.errors && (
                        <pre className="text-xs bg-muted p-2 rounded overflow-x-auto max-w-full">
                          {typeof run.errors === "string" ? run.errors : JSON.stringify(run.errors, null, 2)}
                        </pre>
                      )}
                      {run.summary && <p className="text-muted-foreground">{run.summary}</p>}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminSystemHealth;
