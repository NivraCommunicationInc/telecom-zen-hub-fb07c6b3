import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { RefreshCw, Bug, CheckCircle, XCircle, AlertTriangle, ChevronDown, ChevronUp, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface DiagnosticResult {
  timestamp: string;
  employee: { id: string; email: string; name: string };
  permissions: Record<string, boolean>;
  counts: {
    orders: { total: number; error: string | null };
    tickets: { total: number; error: string | null };
    clients: { total: number; error: string | null };
    appointments: { total: number; error: string | null };
  };
}

interface LastResponse {
  request_id?: string;
  resolved_permissions?: Record<string, boolean>;
  applied_filters?: string[];
  total_count?: number;
  ok?: boolean;
  reason?: string;
  needed_permission?: string;
}

interface EmployeeDebugPanelProps {
  session: {
    token: string;
    employeeId: string;
    email: string;
    name: string;
    permissions: Record<string, boolean>;
  };
  currentCounts?: {
    orders?: number;
    tickets?: number;
    clients?: number;
  };
  lastResponse?: LastResponse;
}

const EmployeeDebugPanel = ({ session, currentCounts, lastResponse }: EmployeeDebugPanelProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [diagnostic, setDiagnostic] = useState<DiagnosticResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runDiagnostic = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("employee-data", {
        headers: { "x-employee-token": session.token },
        body: { action: "diagnostic_visibility_test", params: { log_to_audit: false } },
      });
      
      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(data.error);
      
      setDiagnostic(data.diagnostic);
    } catch (err: any) {
      console.error("Diagnostic error:", err);
      setError(err.message || "Erreur lors du diagnostic");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-50 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30"
      >
        <Bug className="w-4 h-4 mr-2 text-amber-500" />
        Debug
      </Button>
    );
  }

  const keyPermissions = ["can_view_orders", "can_view_tickets", "can_view_clients", "can_view_appointments"];

  return (
    <Card className="fixed bottom-4 right-4 z-50 w-[420px] max-h-[600px] overflow-auto shadow-xl border-amber-500/30 bg-background/95 backdrop-blur">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Bug className="w-4 h-4 text-amber-500" />
            Debug Panel (Employee)
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => setIsExpanded(!isExpanded)}>
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
              ✕
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-xs">
        {/* Session Info */}
        <div className="bg-muted/50 p-2 rounded">
          <p className="font-medium mb-1">Session</p>
          <p className="text-muted-foreground">{session.email}</p>
          <p className="text-muted-foreground">ID: {session.employeeId?.slice(0, 8)}...</p>
        </div>

        {/* Last Response Info (NEW) */}
        {lastResponse && (
          <div className={`p-2 rounded ${lastResponse.ok === false ? 'bg-red-500/10 border border-red-500/30' : 'bg-cyan-500/10'}`}>
            <p className="font-medium mb-1 flex items-center gap-2">
              {lastResponse.ok === false ? (
                <>
                  <XCircle className="w-3 h-3 text-red-500" />
                  Dernière requête refusée
                </>
              ) : (
                <>
                  <CheckCircle className="w-3 h-3 text-cyan-500" />
                  Dernière requête
                </>
              )}
            </p>
            {lastResponse.request_id && (
              <p className="text-muted-foreground">ID: {lastResponse.request_id}</p>
            )}
            {lastResponse.reason && (
              <p className="text-red-400">Raison: {lastResponse.reason}</p>
            )}
            {lastResponse.needed_permission && (
              <p className="text-amber-400">Permission requise: {lastResponse.needed_permission}</p>
            )}
            {lastResponse.applied_filters && lastResponse.applied_filters.length > 0 && (
              <div className="flex items-center gap-1 mt-1">
                <Filter className="w-3 h-3 text-muted-foreground" />
                <span className="text-muted-foreground">Filtres: {lastResponse.applied_filters.join(", ")}</span>
              </div>
            )}
            {lastResponse.total_count !== undefined && (
              <p className="text-muted-foreground">Total DB: {lastResponse.total_count}</p>
            )}
          </div>
        )}

        {/* Current Counts from UI */}
        {currentCounts && (
          <div className="bg-blue-500/10 p-2 rounded">
            <p className="font-medium mb-1">Counts affichés (UI)</p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-lg font-bold">{currentCounts.orders ?? "-"}</div>
                <div className="text-muted-foreground">Orders</div>
              </div>
              <div>
                <div className="text-lg font-bold">{currentCounts.tickets ?? "-"}</div>
                <div className="text-muted-foreground">Tickets</div>
              </div>
              <div>
                <div className="text-lg font-bold">{currentCounts.clients ?? "-"}</div>
                <div className="text-muted-foreground">Clients</div>
              </div>
            </div>
          </div>
        )}

        {/* Permissions */}
        <div className="bg-muted/50 p-2 rounded">
          <p className="font-medium mb-1">Permissions (token)</p>
          <div className="flex flex-wrap gap-1">
            {keyPermissions.map((perm) => (
              <Badge
                key={perm}
                variant={session.permissions?.[perm] ? "default" : "destructive"}
                className="text-xs"
              >
                {session.permissions?.[perm] ? <CheckCircle className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
                {perm.replace("can_view_", "")}
              </Badge>
            ))}
          </div>
          
          {/* Resolved permissions from last response */}
          {lastResponse?.resolved_permissions && isExpanded && (
            <div className="mt-2 pt-2 border-t border-border">
              <p className="font-medium mb-1 text-muted-foreground">Permissions résolues (serveur)</p>
              <div className="flex flex-wrap gap-1">
                {Object.entries(lastResponse.resolved_permissions).slice(0, 8).map(([perm, value]) => (
                  <Badge
                    key={perm}
                    variant={value ? "default" : "secondary"}
                    className="text-xs"
                  >
                    {value ? <CheckCircle className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
                    {perm.replace("can_", "").replace("_", " ")}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* Run Diagnostic */}
        <Button 
          onClick={runDiagnostic} 
          disabled={isLoading} 
          size="sm" 
          className="w-full"
          variant="outline"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Lancer diagnostic DB
        </Button>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 p-2 rounded text-red-500">
            <AlertTriangle className="w-4 h-4 inline mr-1" />
            {error}
          </div>
        )}

        {/* Diagnostic Results */}
        {diagnostic && (
          <div className="bg-emerald-500/10 p-2 rounded space-y-2">
            <p className="font-medium">Résultat diagnostic (Service Role)</p>
            <p className="text-muted-foreground">{new Date(diagnostic.timestamp).toLocaleTimeString()}</p>
            
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(diagnostic.counts).map(([key, value]) => (
                <div key={key} className="bg-background/50 p-2 rounded text-center">
                  <div className="text-lg font-bold">{value.total}</div>
                  <div className="text-muted-foreground capitalize">{key}</div>
                  {value.error && (
                    <div className="text-red-400 text-xs mt-1">{value.error}</div>
                  )}
                </div>
              ))}
            </div>

            {/* Comparison */}
            {currentCounts && (
              <div className="border-t pt-2 mt-2">
                <p className="font-medium mb-1">Comparaison UI vs DB</p>
                {(currentCounts.orders ?? 0) !== diagnostic.counts.orders.total && (
                  <div className="text-amber-400">
                    <AlertTriangle className="w-3 h-3 inline mr-1" />
                    Orders: UI={currentCounts.orders} vs DB={diagnostic.counts.orders.total}
                  </div>
                )}
                {(currentCounts.tickets ?? 0) !== diagnostic.counts.tickets.total && (
                  <div className="text-amber-400">
                    <AlertTriangle className="w-3 h-3 inline mr-1" />
                    Tickets: UI={currentCounts.tickets} vs DB={diagnostic.counts.tickets.total}
                  </div>
                )}
                {(currentCounts.clients ?? 0) !== diagnostic.counts.clients.total && (
                  <div className="text-amber-400">
                    <AlertTriangle className="w-3 h-3 inline mr-1" />
                    Clients: UI={currentCounts.clients} vs DB={diagnostic.counts.clients.total}
                  </div>
                )}
                {(currentCounts.orders ?? 0) === diagnostic.counts.orders.total &&
                 (currentCounts.tickets ?? 0) === diagnostic.counts.tickets.total &&
                 (currentCounts.clients ?? 0) === diagnostic.counts.clients.total && (
                  <div className="text-emerald-400">
                    <CheckCircle className="w-3 h-3 inline mr-1" />
                    Tous les counts correspondent!
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default EmployeeDebugPanel;
