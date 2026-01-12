import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Phone, MessageSquare, ArrowUpRight, ArrowDownLeft, Clock } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { adminClient as supabase } from "@/integrations/backend/adminClient";

interface ClientCommunicationsPanelProps {
  clientId: string;
  clientPhone?: string;
}

interface CommunicationLog {
  id: string;
  created_at: string;
  action: string;
  direction: "inbound" | "outbound";
  duration_seconds?: number;
  notes?: string;
  agent_name?: string;
}

/**
 * Panel showing recent communications (calls/SMS) for a client
 * Uses internal telephony_logs table for audit
 * OpenPhone API integration would be added when keys are configured
 */
export const ClientCommunicationsPanel = ({ clientId, clientPhone }: ClientCommunicationsPanelProps) => {
  // Fetch communication logs from our internal audit table
  const { data: logs, isLoading } = useQuery({
    queryKey: ["client-communications", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("telephony_logs")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(20);
      
      if (error) {
        // Table might not exist yet - return empty
        console.warn("telephony_logs not available:", error.message);
        return [];
      }
      return data as CommunicationLog[];
    },
    enabled: !!clientId,
  });

  const getActionIcon = (action: string) => {
    if (action === "call" || action === "appel") {
      return <Phone className="w-4 h-4" />;
    }
    return <MessageSquare className="w-4 h-4" />;
  };

  const getDirectionIcon = (direction: string) => {
    if (direction === "outbound") {
      return <ArrowUpRight className="w-3 h-3 text-cyan-500" />;
    }
    return <ArrowDownLeft className="w-3 h-3 text-emerald-500" />;
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return null;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Phone className="w-5 h-5 text-cyan-400" />
          Communications récentes
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-muted animate-pulse rounded" />
            ))}
          </div>
        ) : logs && logs.length > 0 ? (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {logs.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-cyan-500/10 flex items-center justify-center">
                    {getActionIcon(log.action)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium capitalize">
                        {log.action === "call" ? "Appel" : "SMS"}
                      </span>
                      {getDirectionIcon(log.direction)}
                      {log.duration_seconds && (
                        <Badge variant="outline" className="text-xs">
                          <Clock className="w-3 h-3 mr-1" />
                          {formatDuration(log.duration_seconds)}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {log.agent_name || "Agent"} • {format(new Date(log.created_at), "d MMM HH:mm", { locale: fr })}
                    </p>
                  </div>
                </div>
                {log.notes && (
                  <p className="text-xs text-muted-foreground max-w-[150px] truncate">
                    {log.notes}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Phone className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Aucune communication enregistrée</p>
            <p className="text-xs mt-1">
              Les appels et SMS apparaîtront ici
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ClientCommunicationsPanel;
