import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

type Props = { userId: string };

export default function Employee360History({ userId }: Props) {
  const { data: auditLogs, isLoading } = useQuery({
    queryKey: ["e360-audit", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("hr_audit_log")
        .select("*")
        .eq("target_user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  const { data: withdrawals } = useQuery({
    queryKey: ["e360-withdrawals", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("commission_withdrawal_requests")
        .select("*")
        .eq("employee_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });

  const { data: disputes } = useQuery({
    queryKey: ["e360-disputes", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("commission_disputes")
        .select("*")
        .eq("employee_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });

  if (isLoading) {
    return <div className="flex h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Retraits */}
      {withdrawals && withdrawals.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Demandes de retrait ({withdrawals.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {withdrawals.map((w) => (
              <div key={w.id} className="flex items-center justify-between rounded border border-border p-2.5 text-sm">
                <div>
                  <span className="font-medium">{(w.amount ?? 0).toFixed(2)} $</span>
                  <span className="ml-2 text-xs text-muted-foreground">{format(new Date(w.created_at), "dd MMM yyyy", { locale: fr })}</span>
                </div>
                <Badge variant={w.status === "approved" ? "default" : w.status === "rejected" ? "destructive" : "secondary"}>{w.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Contestations */}
      {disputes && disputes.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Contestations ({disputes.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {disputes.map((d) => (
              <div key={d.id} className="rounded border border-border p-2.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{format(new Date(d.created_at), "dd MMM yyyy", { locale: fr })}</span>
                  <Badge variant={d.status === "resolved" ? "default" : d.status === "rejected" ? "destructive" : "secondary"}>{d.status}</Badge>
                </div>
                {d.reason && <p className="mt-1 text-xs text-muted-foreground">{d.reason}</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Audit log */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Journal d'audit ({auditLogs?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {!auditLogs?.length ? (
            <p className="text-sm text-muted-foreground">Aucune entrée d'audit.</p>
          ) : (
            auditLogs.map((log) => (
              <div key={log.id} className="flex items-start gap-3 rounded border border-border p-2.5 text-xs">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{log.action}</Badge>
                    <span className="text-muted-foreground">{log.entity_type}</span>
                  </div>
                  {log.field_changed && (
                    <p className="mt-1 text-muted-foreground">
                      {log.field_changed}: <span className="line-through">{log.old_value}</span> → <span className="text-foreground">{log.new_value}</span>
                    </p>
                  )}
                </div>
                <span className="whitespace-nowrap text-muted-foreground">{format(new Date(log.created_at), "dd MMM HH:mm", { locale: fr })}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
