/**
 * CoreMyAccountPage — Current staff member's account settings.
 * Mirrors old admin AdminAccount / AdminAccountProfile.
 */
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Save, Shield, Key, LogOut, Mail, Phone } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";

export default function CoreMyAccountPage() {
  const [tab, setTab] = useState("profile");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const queryClient = useQueryClient();

  const { data: session } = useQuery({
    queryKey: ["core-my-session"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },
  });

  const userId = session?.user?.id;

  const { data: profile, isLoading } = useQuery({
    queryKey: ["core-my-profile", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: roles = [] } = useQuery({
    queryKey: ["core-my-roles", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role, status")
        .eq("user_id", userId!)
        .eq("status", "active");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: securityCodes = [] } = useQuery({
    queryKey: ["core-my-security-codes", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("admin_security_codes")
        .select("created_at, updated_at")
        .eq("admin_user_id", userId!)
        .limit(1);
      return data || [];
    },
  });

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
      setPhone(profile.phone || "");
    }
  }, [profile]);

  const updateProfileMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName, phone })
        .eq("user_id", userId!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profil mis à jour");
      queryClient.invalidateQueries({ queryKey: ["core-my-profile"] });
    },
    onError: () => toast.error("Erreur"),
  });

  const changePasswordMutation = useMutation({
    mutationFn: async () => {
      if (newPassword !== confirmPassword) throw new Error("Les mots de passe ne correspondent pas");
      if (newPassword.length < 8) throw new Error("Le mot de passe doit contenir au moins 8 caractères");
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Mot de passe modifié");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const ROLE_LABELS: Record<string, string> = {
    admin: "Administrateur", employee: "Employé", technician: "Technicien",
    supervisor: "Superviseur", sales: "Ventes", support: "Support",
    kyc_agent: "Agent KYC", billing_admin: "Admin Facturation", techops: "Opérations Tech",
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center gap-2">
        <User className="h-5 w-5 text-emerald-400" />
        <h1 className="text-lg font-semibold text-white">Mon compte</h1>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-[hsl(220,15%,12%)] border border-[hsl(220,15%,18%)]">
          <TabsTrigger value="profile"><User className="h-3 w-3 mr-1" /> Profil</TabsTrigger>
          <TabsTrigger value="security"><Shield className="h-3 w-3 mr-1" /> Sécurité</TabsTrigger>
          <TabsTrigger value="sessions"><Key className="h-3 w-3 mr-1" /> Sessions</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-4">
          <div className="bg-[hsl(220,15%,10%)] rounded-lg border border-[hsl(220,15%,16%)] p-4 space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-[hsl(220,15%,14%)]">
              <div className="h-12 w-12 rounded-full bg-emerald-600/20 flex items-center justify-center">
                <User className="h-6 w-6 text-emerald-400" />
              </div>
              <div>
                <p className="text-white font-medium">{profile?.full_name || "—"}</p>
                <p className="text-xs text-[hsl(220,10%,50%)]">{session?.user?.email}</p>
              </div>
              <div className="ml-auto flex gap-1.5">
                {roles.map((r: any) => (
                  <Badge key={r.role} className="text-[10px] bg-emerald-500/20 text-emerald-400">
                    {ROLE_LABELS[r.role] || r.role}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs text-[hsl(220,10%,60%)]">Nom complet</Label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)}
                  className="bg-[hsl(220,15%,12%)] border-[hsl(220,15%,20%)] text-white text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-[hsl(220,10%,60%)]">Téléphone</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)}
                  className="bg-[hsl(220,15%,12%)] border-[hsl(220,15%,20%)] text-white text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-[hsl(220,10%,60%)]">Email</Label>
                <Input value={session?.user?.email || ""} disabled
                  className="bg-[hsl(220,15%,14%)] border-[hsl(220,15%,20%)] text-[hsl(220,10%,50%)] text-xs" />
              </div>
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => updateProfileMutation.mutate()}
                disabled={updateProfileMutation.isPending}
              >
                <Save className="h-3.5 w-3.5 mr-1.5" /> Enregistrer
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <div className="bg-[hsl(220,15%,10%)] rounded-lg border border-[hsl(220,15%,16%)] p-4 space-y-4">
            <h3 className="text-sm font-medium text-white">Changer le mot de passe</h3>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs text-[hsl(220,10%,60%)]">Nouveau mot de passe</Label>
                <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                  className="bg-[hsl(220,15%,12%)] border-[hsl(220,15%,20%)] text-white text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-[hsl(220,10%,60%)]">Confirmer le mot de passe</Label>
                <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                  className="bg-[hsl(220,15%,12%)] border-[hsl(220,15%,20%)] text-white text-xs" />
              </div>
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => changePasswordMutation.mutate()}
                disabled={changePasswordMutation.isPending}
              >
                <Key className="h-3.5 w-3.5 mr-1.5" /> Modifier le mot de passe
              </Button>
            </div>

            {securityCodes.length > 0 && (
              <div className="pt-3 border-t border-[hsl(220,15%,14%)]">
                <p className="text-xs text-[hsl(220,10%,50%)]">
                  Code de sécurité configuré le {securityCodes[0].created_at ? format(new Date(securityCodes[0].created_at), "dd MMM yyyy", { locale: fr }) : "—"}
                </p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="sessions">
          <div className="bg-[hsl(220,15%,10%)] rounded-lg border border-[hsl(220,15%,16%)] p-4 space-y-3">
            <h3 className="text-sm font-medium text-white">Session active</h3>
            <div className="text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-[hsl(220,10%,50%)]">Connecté depuis</span>
                <span className="text-white">
                  {session?.user?.last_sign_in_at
                    ? format(new Date(session.user.last_sign_in_at), "PPpp", { locale: fr })
                    : "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[hsl(220,10%,50%)]">Expire</span>
                <span className="text-white">
                  {session?.expires_at
                    ? format(new Date(session.expires_at * 1000), "PPpp", { locale: fr })
                    : "—"}
                </span>
              </div>
            </div>
            <Button
              size="sm"
              variant="destructive"
              onClick={async () => {
                await supabase.auth.signOut();
                window.location.href = "/core/login";
              }}
            >
              <LogOut className="h-3.5 w-3.5 mr-1.5" /> Déconnexion
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
