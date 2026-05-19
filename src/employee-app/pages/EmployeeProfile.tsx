/**
 * EmployeeProfile — My profile page for employee.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User, Loader2, Shield, Bell } from "lucide-react";
import { PushNotificationToggle } from "@/components/PushNotificationToggle";

export default function EmployeeProfile() {
  const [profile, setProfile] = useState<any>(null);
  const [role, setRole] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const [profileRes, roleRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", session.user.id).maybeSingle(),
        supabase.from("user_roles").select("role, status, is_active, can_access_employee, mfa_enrolled_at")
          .eq("user_id", session.user.id).eq("status", "active").maybeSingle(),
      ]);

      setProfile({ ...profileRes.data, email: session.user.email });
      setRole(roleRes.data);
      setLoading(false);
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-lg">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Mon profil</h1>
        <p className="text-sm text-[hsl(220,10%,45%)]">Informations de votre compte employé</p>
      </div>

      <div className="rounded-xl border border-[hsl(220,15%,13%)] bg-[hsl(220,20%,8%)] p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-blue-600/15 flex items-center justify-center">
            <User className="h-6 w-6 text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">{profile?.full_name ?? "—"}</p>
            <p className="text-xs text-[hsl(220,10%,45%)]">{profile?.email ?? "—"}</p>
          </div>
        </div>

        <div className="space-y-2 text-xs">
          <Row label="Rôle" value={role?.role ?? "—"} />
          <Row label="Statut" value={role?.is_active ? "Actif" : "Inactif"} />
          <Row label="Accès Employé" value={role?.can_access_employee ? "✓ Autorisé" : "✗ Non autorisé"} />
          <Row label="MFA" value={role?.mfa_enrolled_at ? "✓ Activé" : "✗ Non configuré"} />
          <Row label="Téléphone" value={profile?.phone ?? "—"} />
        </div>
      </div>

      <div className="rounded-xl border border-[hsl(220,15%,13%)] bg-[hsl(220,20%,8%)] p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-blue-400" />
          <h2 className="text-sm font-semibold text-white">Notifications push</h2>
        </div>
        <p className="text-xs text-[hsl(220,10%,55%)]">
          Recevez les alertes (nouveaux tickets, KYC, escalades) directement sur cet appareil, même quand l'application est fermée.
        </p>
        <PushNotificationToggle />
      </div>

      <div className="rounded-xl border border-[hsl(220,15%,13%)] bg-[hsl(220,20%,8%)] p-4">
        <div className="flex items-center gap-2 text-[hsl(220,10%,40%)]">
          <Shield className="h-3.5 w-3.5" />
          <span className="text-[10px] uppercase tracking-widest font-medium">
            Session sécurisée · Portail Employé
          </span>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1 border-b border-[hsl(220,15%,10%)]">
      <span className="text-[hsl(220,10%,45%)]">{label}</span>
      <span className="text-white">{value}</span>
    </div>
  );
}
