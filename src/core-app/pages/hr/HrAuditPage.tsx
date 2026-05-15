/**
 * HrAuditPage — HR audit log viewer with filters.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { History, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const ACTION_COLORS: Record<string, string> = {
  create: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  update: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  delete: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  approve: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  reject: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  status_change: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
};

export default function HrAuditPage() {
  const [search, setSearch] = useState("");
  const [filterEntity, setFilterEntity] = useState("all");

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["hr-audit-log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hr_audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  const entityTypes = [...new Set(logs.map((l: any) => l.entity_type))].sort();

  const filtered = logs.filter((l: any) => {
    if (filterEntity !== "all" && l.entity_type !== filterEntity) return false;
    if (search) {
      const s = search.toLowerCase();
      if (
        !(l.action || "").toLowerCase().includes(s) &&
        !((l as any).actor_name || "").toLowerCase().includes(s) &&
        !(l.entity_type || "").toLowerCase().includes(s) &&
        !((l as any).field_changed || "").toLowerCase().includes(s)
      ) return false;
    }
    return true;
  });

  return (
    <div className="space-y-4 max-w-6xl">
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <History className="h-5 w-5 text-primary" />
          Audit HR
        </h1>
        <p className="text-xs text-muted-foreground">{logs.length} entrée(s) d'audit</p>
      </div>

      <div className="flex items-center gap-3">
        <Input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher action, acteur…" className="h-7 text-xs w-48" />
        <Select value={filterEntity} onValueChange={setFilterEntity}>
          <SelectTrigger className="h-7 text-xs w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes entités</SelectItem>
            {entityTypes.map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">Aucune entrée d'audit.</p>
          ) : (
            <div className="space-y-2">
              {filtered.map((log: any) => {
                const colorCls = ACTION_COLORS[log.action] || "bg-muted text-foreground";
                return (
                  <div key={log.id} className="flex items-start gap-3 rounded-md border border-border p-3">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${colorCls}`}>
                          {log.action}
                        </span>
                        <Badge variant="outline" className="text-[10px]">{log.entity_type}</Badge>
                        {log.actor_name && (
                          <span className="text-[10px] text-muted-foreground">par {log.actor_name}</span>
                        )}
                      </div>
                      {log.field_changed && (
                        <p className="text-xs text-muted-foreground">
                          <span className="font-medium">{log.field_changed}</span>:{" "}
                          <span className="line-through">{log.old_value || "—"}</span> → <span className="text-foreground">{log.new_value || "—"}</span>
                        </p>
                      )}
                      {log.notes && <p className="text-[10px] text-muted-foreground italic">{log.notes}</p>}
                    </div>
                    <span className="whitespace-nowrap text-[10px] text-muted-foreground shrink-0">
                      {format(new Date(log.created_at), "d MMM HH:mm", { locale: fr })}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
