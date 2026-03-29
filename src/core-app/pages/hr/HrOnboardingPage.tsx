/**
 * HrOnboardingPage — Tracks employees in pending_invitation or onboarding status.
 */
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UserPlus, FolderOpen, Mail, Clock } from "lucide-react";
import { corePath } from "@/core-app/lib/corePaths";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export default function HrOnboardingPage() {
  const navigate = useNavigate();

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ["hr-onboarding"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_records")
        .select("*")
        .in("status", ["pending_invitation", "onboarding"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <UserPlus className="h-5 w-5 text-primary" />
          Onboarding
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          {employees.length} employé(s) en cours d'intégration
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Numéro</TableHead>
                <TableHead className="text-xs">Nom</TableHead>
                <TableHead className="text-xs">Poste</TableHead>
                <TableHead className="text-xs">Statut</TableHead>
                <TableHead className="text-xs">Invitation envoyée</TableHead>
                <TableHead className="text-xs">Créé le</TableHead>
                <TableHead className="text-xs w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground text-xs">Chargement…</TableCell>
                </TableRow>
              ) : employees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground text-xs">
                    Aucun employé en onboarding
                  </TableCell>
                </TableRow>
              ) : (
                employees.map((emp) => (
                  <TableRow key={emp.id} className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(corePath(`/hr/employees/${emp.id}`))}>
                    <TableCell className="text-xs font-mono text-primary">{emp.employee_number}</TableCell>
                    <TableCell className="text-xs font-medium">{emp.first_name} {emp.last_name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{emp.job_title || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={emp.status === "pending_invitation" ? "outline" : "secondary"} className="text-[10px]">
                        {emp.status === "pending_invitation" ? (
                          <><Mail className="h-2.5 w-2.5 mr-1" />Invitation en attente</>
                        ) : (
                          <><Clock className="h-2.5 w-2.5 mr-1" />En cours</>
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {emp.invitation_sent_at
                        ? format(new Date(emp.invitation_sent_at), "d MMM yyyy HH:mm", { locale: fr })
                        : "Non envoyée"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {format(new Date(emp.created_at), "d MMM yyyy", { locale: fr })}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                        onClick={(e) => { e.stopPropagation(); navigate(corePath(`/hr/employees/${emp.id}`)); }}>
                        <FolderOpen className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
