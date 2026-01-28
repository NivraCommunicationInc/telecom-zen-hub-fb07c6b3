/**
 * FieldSalesAccount - iOS-style account settings and profile for field sales rep
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { 
  User, LogOut, Key, Shield, Mail, Phone, 
  Loader2, ChevronRight, Building, Settings,
  Bell, HelpCircle, FileText
} from "lucide-react";
import { toast } from "sonner";
import StaffBackground from "@/components/staff/StaffBackground";
import { IOSHeader } from "@/components/field-sales/ios/IOSHeader";
import { IOSBottomNav } from "@/components/field-sales/ios/IOSBottomNav";
import { IOSWidgetCard } from "@/components/field-sales/ios/IOSWidgetCard";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

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

  const initials = profile?.full_name
    ?.split(" ")
    .map(n => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?";

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center relative bg-slate-950">
        <StaffBackground />
        <div className="flex flex-col items-center gap-4 z-10">
          <div className="p-4 rounded-2xl bg-purple-500/20">
            <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
          </div>
          <p className="text-slate-400 font-medium">Chargement...</p>
        </div>
      </div>
    );
  }

  const menuItems = [
    {
      section: "Paramètres",
      items: [
        { icon: Key, label: "Modifier mon PIN", color: "text-orange-400", onClick: () => {} },
        { icon: Bell, label: "Notifications", color: "text-blue-400", onClick: () => {} },
        { icon: Shield, label: "Sécurité", color: "text-emerald-400", onClick: () => {} },
      ]
    },
    {
      section: "Aide",
      items: [
        { icon: HelpCircle, label: "Centre d'aide", color: "text-cyan-400", onClick: () => {} },
        { icon: FileText, label: "Conditions d'utilisation", color: "text-slate-400", onClick: () => {} },
      ]
    },
  ];

  return (
    <div className="min-h-screen relative bg-slate-950">
      <StaffBackground />
      
      <IOSHeader
        title="Mon Compte"
        subtitle="Profil et paramètres"
      />

      <main className="relative z-10 pb-24">
        <div className="p-4 space-y-4">
          {/* Profile Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <IOSWidgetCard className="p-6">
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20 border-4 border-orange-500/30">
                  <AvatarFallback className="bg-gradient-to-br from-orange-500 to-amber-500 text-white text-2xl font-bold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-white">{profile?.full_name}</h2>
                  <p className="text-sm text-slate-400">Vendeur Terrain</p>
                  <p className="text-xs text-orange-400 mt-1">Nivra Télécom</p>
                </div>
              </div>
            </IOSWidgetCard>
          </motion.div>

          {/* Contact Info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <IOSWidgetCard className="overflow-hidden">
              <div className="p-4 border-b border-slate-800/60">
                <h3 className="text-white font-semibold">Informations de contact</h3>
              </div>
              <div className="divide-y divide-slate-800/40">
                <div className="flex items-center gap-3 p-4">
                  <div className="p-2 rounded-xl bg-blue-500/20">
                    <Mail className="h-5 w-5 text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-slate-500">Email</p>
                    <p className="text-white font-medium">{profile?.email}</p>
                  </div>
                </div>
                {profile?.phone && (
                  <div className="flex items-center gap-3 p-4">
                    <div className="p-2 rounded-xl bg-emerald-500/20">
                      <Phone className="h-5 w-5 text-emerald-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-slate-500">Téléphone</p>
                      <p className="text-white font-medium">{profile.phone}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3 p-4">
                  <div className="p-2 rounded-xl bg-purple-500/20">
                    <Building className="h-5 w-5 text-purple-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-slate-500">Entreprise</p>
                    <p className="text-white font-medium">Nivra Télécom</p>
                  </div>
                </div>
              </div>
            </IOSWidgetCard>
          </motion.div>

          {/* Settings Menu */}
          {menuItems.map((section, sectionIdx) => (
            <motion.div
              key={sectionIdx}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + sectionIdx * 0.1 }}
            >
              <IOSWidgetCard className="overflow-hidden">
                <div className="p-4 border-b border-slate-800/60">
                  <h3 className="text-white font-semibold">{section.section}</h3>
                </div>
                <div className="divide-y divide-slate-800/40">
                  {section.items.map((item, itemIdx) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={itemIdx}
                        onClick={item.onClick}
                        className="w-full flex items-center justify-between p-4 hover:bg-slate-800/40 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <Icon className={cn("h-5 w-5", item.color)} />
                          <span className="text-white font-medium">{item.label}</span>
                        </div>
                        <ChevronRight className="h-5 w-5 text-slate-600" />
                      </button>
                    );
                  })}
                </div>
              </IOSWidgetCard>
            </motion.div>
          ))}

          {/* Account Info */}
          {roleData && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <IOSWidgetCard className="p-4">
                <h3 className="text-white font-semibold mb-3">Informations du compte</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Compte créé</span>
                    <span className="text-white">
                      {new Date(roleData.created_at).toLocaleDateString("fr-CA")}
                    </span>
                  </div>
                  {roleData.onboarding_completed_at && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Configuration terminée</span>
                      <span className="text-white">
                        {new Date(roleData.onboarding_completed_at).toLocaleDateString("fr-CA")}
                      </span>
                    </div>
                  )}
                </div>
              </IOSWidgetCard>
            </motion.div>
          )}

          {/* Logout */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Button
              onClick={handleLogout}
              variant="outline"
              className="w-full h-12 border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300 rounded-2xl"
            >
              <LogOut className="h-5 w-5 mr-2" />
              Se déconnecter
            </Button>
          </motion.div>
        </div>
      </main>

      <IOSBottomNav />
    </div>
  );
}
