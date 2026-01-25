/**
 * FieldSalesAccount - Account settings and profile for field sales rep
 * Includes logout, PIN change, and profile info
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  User, LogOut, Key, Shield, Mail, Phone, 
  Loader2, ChevronRight, Building
} from "lucide-react";
import { toast } from "sonner";
import StaffBackground from "@/components/staff/StaffBackground";
import { FieldSalesNav } from "@/components/field-sales/FieldSalesNav";

interface ProfileData {
  full_name: string;
  email: string;
  phone: string | null;
}

interface RoleData {
  created_at: string;
  onboarding_completed_at: string | null;
}

export default function FieldSalesAccount() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [roleData, setRoleData] = useState<RoleData | null>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const [profileRes, roleRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("full_name, email, phone")
          .eq("user_id", session.user.id)
          .maybeSingle(),
        supabase
          .from("user_roles")
          .select("created_at, onboarding_completed_at")
          .eq("user_id", session.user.id)
          .eq("role", "field_sales")
          .maybeSingle(),
      ]);

      if (profileRes.data) {
        setProfile({
          full_name: profileRes.data.full_name || session.user.email?.split("@")[0] || "Utilisateur",
          email: profileRes.data.email || session.user.email || "",
          phone: profileRes.data.phone,
        });
      }

      if (roleRes.data) {
        setRoleData(roleRes.data);
      }
    } catch (error) {
      console.error("Error loading profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Déconnexion réussie");
    navigate("/field-sales");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center relative">
        <StaffBackground />
        <Loader2 className="h-10 w-10 animate-spin text-orange-400 z-10" />
      </div>
    );
  }

  return (
    <div className="min-h-screen relative pb-20">
      <StaffBackground />
      
      {/* Header */}
      <header className="sticky top-0 z-40 bg-slate-900/80 backdrop-blur-xl border-b border-slate-700/50">
        <div className="px-4 py-4">
          <h1 className="text-xl font-bold text-white">Mon Compte</h1>
        </div>
      </header>

      <main className="p-4 space-y-4 relative z-10">
        {/* Profile Card */}
        <Card className="border-slate-700/50 bg-slate-900/60 backdrop-blur-xl">
          <CardContent className="py-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-500 to-amber-400 flex items-center justify-center">
                <User className="h-8 w-8 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">{profile?.full_name}</h2>
                <p className="text-sm text-slate-400">Vendeur Terrain</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact Info */}
        <Card className="border-slate-700/50 bg-slate-900/60 backdrop-blur-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-base">Informations de contact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/50">
              <Mail className="h-5 w-5 text-orange-400" />
              <div>
                <p className="text-xs text-slate-400">Email</p>
                <p className="text-white">{profile?.email}</p>
              </div>
            </div>
            {profile?.phone && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/50">
                <Phone className="h-5 w-5 text-orange-400" />
                <div>
                  <p className="text-xs text-slate-400">Téléphone</p>
                  <p className="text-white">{profile.phone}</p>
                </div>
              </div>
            )}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/50">
              <Building className="h-5 w-5 text-orange-400" />
              <div>
                <p className="text-xs text-slate-400">Entreprise</p>
                <p className="text-white">Nivra Télécom</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Settings */}
        <Card className="border-slate-700/50 bg-slate-900/60 backdrop-blur-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-base">Paramètres</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <button
              onClick={() => navigate("/field-sales/change-pin")}
              className="w-full flex items-center justify-between p-4 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Key className="h-5 w-5 text-orange-400" />
                <span className="text-white">Modifier mon PIN</span>
              </div>
              <ChevronRight className="h-5 w-5 text-slate-400" />
            </button>

            <button
              className="w-full flex items-center justify-between p-4 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors"
              disabled
            >
              <div className="flex items-center gap-3">
                <Shield className="h-5 w-5 text-orange-400" />
                <span className="text-white">Sécurité</span>
              </div>
              <ChevronRight className="h-5 w-5 text-slate-400" />
            </button>
          </CardContent>
        </Card>

        {/* Account Info */}
        {roleData && (
          <Card className="border-slate-700/50 bg-slate-900/60 backdrop-blur-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-base">Informations du compte</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Compte créé</span>
                  <span className="text-white">
                    {new Date(roleData.created_at).toLocaleDateString("fr-CA")}
                  </span>
                </div>
                {roleData.onboarding_completed_at && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Configuration terminée</span>
                    <span className="text-white">
                      {new Date(roleData.onboarding_completed_at).toLocaleDateString("fr-CA")}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Logout */}
        <Button
          onClick={handleLogout}
          variant="outline"
          className="w-full border-red-500/50 text-red-400 hover:bg-red-500/10 hover:text-red-300"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Se déconnecter
        </Button>
      </main>

      <FieldSalesNav />
    </div>
  );
}
