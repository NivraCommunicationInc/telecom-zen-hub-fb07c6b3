/**
 * HrBadgePage — HR/admin badge generator. Lists employees and allows
 * generating/printing/emailing a badge for any selected employee.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Search, IdCard } from "lucide-react";
import EmployeeBadgePreview from "@/components/employee/EmployeeBadgePreview";

interface EmployeeRow {
  user_id: string;
  full_name: string | null;
  email: string | null;
  agent_number: string | null;
  role: string;
}

export default function HrBadgePage() {
  const [search, setSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ["hr-badge-employees"],
    queryFn: async (): Promise<EmployeeRow[]> => {
      const { data: roleRows } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .eq("is_active", true)
        .neq("role", "client");
      const ids = Array.from(new Set((roleRows ?? []).map((r) => r.user_id)));
      if (!ids.length) return [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, agent_number")
        .in("user_id", ids);
      const byId = new Map((profiles ?? []).map((p) => [p.user_id, p]));
      return ids.map((id) => {
        const p = byId.get(id) ?? { user_id: id, full_name: null, email: null, agent_number: null };
        const role = (roleRows ?? []).find((r) => r.user_id === id)?.role ?? "employee";
        return { ...p, user_id: id, role } as EmployeeRow;
      }).sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? ""));
    },
  });

  const filtered = employees.filter((e) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      (e.full_name ?? "").toLowerCase().includes(s) ||
      (e.email ?? "").toLowerCase().includes(s) ||
      (e.agent_number ?? "").toLowerCase().includes(s)
    );
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <IdCard className="h-6 w-6" /> Badges employés
        </h1>
        <p className="text-sm text-muted-foreground">
          Générez et envoyez un badge numérique pour n'importe quel employé.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6">
        <Card className="p-4">
          <div className="relative mb-3">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Rechercher employé…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground p-4">
              <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
            </div>
          ) : (
            <div className="space-y-1 max-h-[60vh] overflow-y-auto">
              {filtered.map((e) => (
                <Button
                  key={e.user_id}
                  variant={selectedUserId === e.user_id ? "default" : "ghost"}
                  className="w-full justify-start h-auto py-2"
                  onClick={() => setSelectedUserId(e.user_id)}
                >
                  <div className="text-left">
                    <div className="text-sm font-medium">{e.full_name || e.email}</div>
                    <div className="text-xs opacity-75">
                      {e.role}{e.agent_number ? ` · ${e.agent_number}` : ""}
                    </div>
                  </div>
                </Button>
              ))}
              {filtered.length === 0 && (
                <div className="text-sm text-muted-foreground p-4 text-center">
                  Aucun employé trouvé.
                </div>
              )}
            </div>
          )}
        </Card>

        <div>
          {selectedUserId ? (
            <EmployeeBadgePreview key={selectedUserId} targetUserId={selectedUserId} />
          ) : (
            <div className="text-muted-foreground p-6">
              Sélectionnez un employé pour générer son badge.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
