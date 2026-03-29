/**
 * RhProfile — Employee's own profile view (read + limited edit).
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Loader2, Mail, Phone, Briefcase, MapPin } from "lucide-react";

export default function RhProfile() {
  const { data: profile, isLoading } = useQuery({
    queryKey: ["rh-my-profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();
      return data;
    },
  });

  const { data: roleData } = useQuery({
    queryKey: ["rh-my-role"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from("user_roles")
        .select("role, status, is_active, onboarding_completed_at")
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();
      return data;
    },
  });

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const fields = [
    { icon: Mail, label: "Courriel", value: profile?.email },
    { icon: Phone, label: "Téléphone", value: profile?.phone },
    { icon: Briefcase, label: "Poste", value: profile?.job_title },
    { icon: MapPin, label: "Adresse", value: profile?.address },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <User className="h-6 w-6 text-violet-600" />
          Mon profil employé
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {profile?.first_name} {profile?.last_name}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Rôle : {roleData?.role || "—"} • Statut : {roleData?.status || "—"}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {fields.map((f) => (
            <div key={f.label} className="flex items-center gap-3">
              <f.icon className="h-4 w-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">{f.label}</p>
                <p className="text-sm font-medium text-foreground">{f.value || "—"}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
