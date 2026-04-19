import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, User } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import Employee360Profile from "@/core-app/components/employee360/Employee360Profile";
import Employee360Remuneration from "@/core-app/components/employee360/Employee360Remuneration";
import Employee360Commissions from "@/core-app/components/employee360/Employee360Commissions";
import Employee360Payroll from "@/core-app/components/employee360/Employee360Payroll";
import Employee360Time from "@/core-app/components/employee360/Employee360Time";
import Employee360Documents from "@/core-app/components/employee360/Employee360Documents";
import Employee360History from "@/core-app/components/employee360/Employee360History";

const EMPLOYMENT_LABELS: Record<string, string> = {
  full_time: "Temps plein",
  part_time: "Temps partiel",
  contract: "Contractuel",
};

export default function CoreEmployee360() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Primary fetch: employee_records (the row the list links to)
  const { data: employee, isLoading } = useQuery({
    queryKey: ["employee-360-record", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_records")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const userId = employee?.user_id ?? null;

  // Secondary fetch: profiles (only if employee has a linked auth user)
  const { data: profileExtra } = useQuery({
    queryKey: ["employee-360-profile", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId!)
        .maybeSingle();
      return data;
    },
  });

  // Merge employee_records (canonical) + profiles (extra fields like avatar)
  const profile = employee
    ? {
        ...(profileExtra ?? {}),
        ...employee,
        full_name: `${employee.first_name ?? ""} ${employee.last_name ?? ""}`.trim(),
      }
    : null;

  const { data: roles } = useQuery({
    queryKey: ["employee-360-roles", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId!);
      return data?.map((r) => r.role) ?? [];
    },
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => navigate("/core/staff")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Retour
        </Button>
        <p className="text-muted-foreground">Employé introuvable.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/core/staff")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
          <User className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-foreground">
              {profile.full_name || `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() || "Sans nom"}
            </h1>
            {profile.employee_number && (
              <Badge variant="outline" className="text-xs">#{profile.employee_number}</Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {profile.job_title && <span>{profile.job_title}</span>}
            {profile.department && <><span>•</span><span>{profile.department}</span></>}
            {profile.employment_type && (
              <><span>•</span><Badge variant="secondary" className="text-[10px]">{EMPLOYMENT_LABELS[profile.employment_type] || profile.employment_type}</Badge></>
            )}
            {roles && roles.length > 0 && (
              <><span>•</span>{roles.map((r) => <Badge key={r} variant="outline" className="text-[10px]">{r}</Badge>)}</>
            )}
          </div>
        </div>
        {profile.hire_date && (
          <div className="text-right text-xs text-muted-foreground">
            <span>Embauché le</span>
            <p className="font-medium text-foreground">{format(new Date(profile.hire_date), "dd MMM yyyy", { locale: fr })}</p>
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList className="flex flex-wrap gap-1">
          <TabsTrigger value="profile">Profil</TabsTrigger>
          <TabsTrigger value="remuneration">Rémunération</TabsTrigger>
          <TabsTrigger value="commissions">Commissions</TabsTrigger>
          <TabsTrigger value="payroll">Paie</TabsTrigger>
          <TabsTrigger value="time">Temps</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="history">Historique</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Employee360Profile profile={profile} />
        </TabsContent>
        <TabsContent value="remuneration">
          <Employee360Remuneration profile={profile} userId={userId!} />
        </TabsContent>
        <TabsContent value="commissions">
          <Employee360Commissions userId={userId!} />
        </TabsContent>
        <TabsContent value="payroll">
          <Employee360Payroll userId={userId!} />
        </TabsContent>
        <TabsContent value="time">
          <Employee360Time userId={userId!} />
        </TabsContent>
        <TabsContent value="documents">
          <Employee360Documents userId={userId!} />
        </TabsContent>
        <TabsContent value="history">
          <Employee360History userId={userId!} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
