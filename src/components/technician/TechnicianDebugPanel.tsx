import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Bug, CheckCircle, XCircle, AlertTriangle, ChevronDown, ChevronUp, Filter } from "lucide-react";

interface TechnicianDebugPanelProps {
  session: {
    token: string;
    id: string;
    email?: string;
    full_name: string;
  };
  lastResponse?: {
    ok?: boolean;
    request_id?: string;
    resolved_permissions?: Record<string, boolean>;
    permission_source?: string;
    applied_filters?: string[];
    counts?: {
      total: number;
      current: number;
      history: number;
      workOrders: number;
      legacyOrders: number;
      legacyAppointments: number;
    };
    db_counts?: {
      work_orders: number;
      orders: number;
      appointments: number;
    };
    assignment_field_used?: string;
    reason?: string;
    needed_permission?: string;
  };
  currentCounts?: {
    current?: number;
    history?: number;
    total?: number;
  };
}

const TechnicianDebugPanel = ({ session, lastResponse, currentCounts }: TechnicianDebugPanelProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

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

  const keyPermissions = ["can_view_appointments", "view_appointments", "manage_appointments"];

  return (
    <Card className="fixed bottom-4 right-4 z-50 w-[420px] max-h-[600px] overflow-auto shadow-xl border-amber-500/30 bg-background/95 backdrop-blur">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Bug className="w-4 h-4 text-amber-500" />
            Debug Panel (Technician)
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
          <p className="text-muted-foreground">{session.full_name}</p>
          <p className="text-muted-foreground">{session.email || 'N/A'}</p>
          <p className="text-muted-foreground">ID: {session.id?.slice(0, 8)}...</p>
        </div>

        {/* Last Response Info */}
        {lastResponse && (
          <div className={`p-2 rounded ${lastResponse.ok === false ? 'bg-red-500/10 border border-red-500/30' : 'bg-cyan-500/10'}`}>
            <p className="font-medium mb-1 flex items-center gap-2">
              {lastResponse.ok === false ? (
                <>
                  <XCircle className="w-3 h-3 text-red-500" />
                  Requête refusée
                </>
              ) : (
                <>
                  <CheckCircle className="w-3 h-3 text-cyan-500" />
                  Dernière requête OK
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
            {lastResponse.permission_source && (
              <p className="text-muted-foreground">Source: {lastResponse.permission_source}</p>
            )}
            {lastResponse.applied_filters && lastResponse.applied_filters.length > 0 && (
              <div className="flex items-center gap-1 mt-1">
                <Filter className="w-3 h-3 text-muted-foreground" />
                <span className="text-muted-foreground">Filtres: {lastResponse.applied_filters.join(", ")}</span>
              </div>
            )}
            {lastResponse.assignment_field_used && isExpanded && (
              <p className="text-muted-foreground text-xs mt-1">Champ assignation: {lastResponse.assignment_field_used}</p>
            )}
          </div>
        )}

        {/* DB Counts from backend */}
        {lastResponse?.db_counts && (
          <div className="bg-purple-500/10 p-2 rounded">
            <p className="font-medium mb-1">Counts DB (filtrés)</p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-lg font-bold">{lastResponse.db_counts.work_orders}</div>
                <div className="text-muted-foreground">Work Orders</div>
              </div>
              <div>
                <div className="text-lg font-bold">{lastResponse.db_counts.orders}</div>
                <div className="text-muted-foreground">Orders</div>
              </div>
              <div>
                <div className="text-lg font-bold">{lastResponse.db_counts.appointments}</div>
                <div className="text-muted-foreground">Appointments</div>
              </div>
            </div>
          </div>
        )}

        {/* Current Counts from UI */}
        {currentCounts && (
          <div className="bg-blue-500/10 p-2 rounded">
            <p className="font-medium mb-1">Counts affichés (UI)</p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-lg font-bold">{currentCounts.total ?? "-"}</div>
                <div className="text-muted-foreground">Total</div>
              </div>
              <div>
                <div className="text-lg font-bold">{currentCounts.current ?? "-"}</div>
                <div className="text-muted-foreground">Actif</div>
              </div>
              <div>
                <div className="text-lg font-bold">{currentCounts.history ?? "-"}</div>
                <div className="text-muted-foreground">Historique</div>
              </div>
            </div>
          </div>
        )}

        {/* Resolved Permissions */}
        {lastResponse?.resolved_permissions && (
          <div className="bg-muted/50 p-2 rounded">
            <p className="font-medium mb-1">Permissions résolues</p>
            <div className="flex flex-wrap gap-1">
              {keyPermissions.map((perm) => (
                <Badge
                  key={perm}
                  variant={lastResponse.resolved_permissions?.[perm] ? "default" : "secondary"}
                  className="text-xs"
                >
                  {lastResponse.resolved_permissions?.[perm] ? <CheckCircle className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
                  {perm.replace("can_", "").replace("_", " ")}
                </Badge>
              ))}
            </div>
            
            {isExpanded && (
              <div className="mt-2 pt-2 border-t border-border">
                <p className="font-medium mb-1 text-muted-foreground">Toutes les permissions</p>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(lastResponse.resolved_permissions).map(([perm, value]) => (
                    <Badge
                      key={perm}
                      variant={value ? "default" : "outline"}
                      className="text-xs"
                    >
                      {perm}: {value ? "✓" : "✗"}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <Separator />

        {/* Comparison */}
        {lastResponse?.counts && currentCounts && (
          <div className="bg-emerald-500/10 p-2 rounded">
            <p className="font-medium mb-1">Comparaison Backend vs UI</p>
            {lastResponse.counts.total === (currentCounts.total || 0) ? (
              <div className="text-emerald-400">
                <CheckCircle className="w-3 h-3 inline mr-1" />
                Total correspond: {lastResponse.counts.total}
              </div>
            ) : (
              <div className="text-amber-400">
                <AlertTriangle className="w-3 h-3 inline mr-1" />
                Différence: Backend={lastResponse.counts.total} vs UI={currentCounts.total}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TechnicianDebugPanel;
