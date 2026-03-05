/**
 * WorkbenchAuditTab - Timeline of all events
 */
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Clock } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Props {
  activityLogs: any[];
}

export function WorkbenchAuditTab({ activityLogs }: Props) {
  if (activityLogs.length === 0) {
    return (
      <Card className="bg-slate-800/50 border-slate-700/50">
        <CardContent className="py-8 text-center text-muted-foreground">
          Aucune activité enregistrée.
        </CardContent>
      </Card>
    );
  }

  return (
    <ScrollArea className="h-[600px]">
      <div className="relative pl-6 space-y-0">
        {/* Vertical line */}
        <div className="absolute left-2 top-0 bottom-0 w-px bg-slate-700" />

        {activityLogs.map((log: any, i: number) => (
          <div key={log.id || i} className="relative pb-4">
            {/* Dot */}
            <div className="absolute -left-4 top-1.5 w-2.5 h-2.5 rounded-full bg-teal-400 border-2 border-slate-900" />

            <Card className="bg-slate-800/50 border-slate-700/50 ml-2">
              <CardContent className="pt-3 pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-white">{log.action}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {log.actor_name || log.actor_email || "Système"} 
                      {log.actor_role && <Badge variant="outline" className="ml-2 text-xs">{log.actor_role}</Badge>}
                    </p>
                    {log.changed_field && (
                      <p className="text-xs text-muted-foreground mt-1">
                        <span className="text-slate-500">{log.changed_field}:</span>{" "}
                        {log.old_value && <span className="text-red-400 line-through">{log.old_value}</span>}
                        {log.old_value && " → "}
                        {log.new_value && <span className="text-emerald-400">{log.new_value}</span>}
                      </p>
                    )}
                    {log.reason && (
                      <p className="text-xs text-amber-400 mt-1">Motif: {log.reason}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
                    <Clock className="h-3 w-3" />
                    {format(new Date(log.created_at), "dd/MM HH:mm", { locale: fr })}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
