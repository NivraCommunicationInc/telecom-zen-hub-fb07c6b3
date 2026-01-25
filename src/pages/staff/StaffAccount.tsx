/**
 * StaffAccount - Staff member account settings
 * Staff portal - completely isolated from admin
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Settings, User, Mail, Phone, Key, Shield, LogOut, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import StaffBackground from "@/components/staff/StaffBackground";
import { StaffSidebar } from "@/components/staff/StaffSidebar";

export default function StaffAccount() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const { data: user } = useQuery({
    queryKey: ["staff-current-user"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get user profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      // Get user role
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role, onboarding_completed_at")
        .eq("user_id", user.id)
        .in("role", ["employee", "technician"])
        .maybeSingle();

      return {
        ...user,
        profile,
        staffRole: roleData?.role,
        onboardingCompleted: !!roleData?.onboarding_completed_at,
      };
    },
  });

  const passwordMutation = useMutation({
    mutationFn: async () => {
      if (newPassword !== confirmPassword) {
        throw new Error("Les mots de passe ne correspondent pas");
      }
      if (newPassword.length < 8) {
        throw new Error("Le mot de passe doit contenir au moins 8 caractères");
      }

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Mot de passe modifié avec succès");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/staff");
  };

  return (
    <div className="min-h-screen flex relative">
      <StaffBackground />
      <StaffSidebar onSignOut={handleSignOut} />
      
      <main className="flex-1 p-6 overflow-auto z-10">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/staff/dashboard")}
              className="text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <Settings className="h-6 w-6 text-teal-400" />
              Mon compte
            </h1>
          </div>
          <p className="text-slate-400 ml-14">Gérer vos paramètres de compte</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl">
          {/* Profile Info */}
          <Card className="bg-slate-800/50 border-slate-700/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <User className="h-5 w-5 text-teal-400" />
                Informations personnelles
              </CardTitle>
              <CardDescription>Vos informations de profil</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-slate-400">Nom complet</Label>
                <div className="flex items-center gap-2 p-3 bg-slate-900/50 rounded-lg border border-slate-700">
                  <User className="h-4 w-4 text-slate-500" />
                  <span className="text-white">
                    {user?.profile?.full_name || "Non défini"}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-400">Email</Label>
                <div className="flex items-center gap-2 p-3 bg-slate-900/50 rounded-lg border border-slate-700">
                  <Mail className="h-4 w-4 text-slate-500" />
                  <span className="text-white">{user?.email}</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-400">Téléphone</Label>
                <div className="flex items-center gap-2 p-3 bg-slate-900/50 rounded-lg border border-slate-700">
                  <Phone className="h-4 w-4 text-slate-500" />
                  <span className="text-white">
                    {user?.profile?.phone || "Non défini"}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-400">Rôle</Label>
                <div className="flex items-center gap-2 p-3 bg-slate-900/50 rounded-lg border border-slate-700">
                  <Shield className="h-4 w-4 text-slate-500" />
                  <span className="text-white capitalize">
                    {user?.staffRole || "Non défini"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Change Password */}
          <Card className="bg-slate-800/50 border-slate-700/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Key className="h-5 w-5 text-teal-400" />
                Changer le mot de passe
              </CardTitle>
              <CardDescription>
                Mettez à jour votre mot de passe de connexion
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">Nouveau mot de passe</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="bg-slate-900/50 border-slate-700 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirmer le mot de passe</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="bg-slate-900/50 border-slate-700 text-white"
                />
              </div>
              <Button
                onClick={() => passwordMutation.mutate()}
                disabled={passwordMutation.isPending || !newPassword || !confirmPassword}
                className="w-full bg-teal-600 hover:bg-teal-700"
              >
                {passwordMutation.isPending ? "Modification..." : "Modifier le mot de passe"}
              </Button>
            </CardContent>
          </Card>

          {/* Sign Out */}
          <Card className="bg-slate-800/50 border-slate-700/50 backdrop-blur-sm lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <LogOut className="h-5 w-5 text-red-400" />
                Déconnexion
              </CardTitle>
              <CardDescription>
                Se déconnecter du portail employé
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="destructive"
                onClick={handleSignOut}
                className="w-full sm:w-auto"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Se déconnecter
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
