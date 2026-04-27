/**
 * EmployeeSecurity — Real MFA status, last sign-in, and global sign-out.
 */
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, Shield, Key, AlertTriangle, LogOut, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import MFASetupModal from "@/components/shared/MFASetupModal";

export default function EmployeeSecurity() {
  const queryClient = useQueryClient();
  const [showMfaModal, setShowMfaModal] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["employee-security-status"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const [factorsRes, profileRes] = await Promise.all([
        supabase.auth.mfa.listFactors(),
        supabase
          .from("profiles")
          .select("mfa_configured_at, mfa_method")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);

      const totp = factorsRes.data?.totp ?? [];
      const phone = (factorsRes.data as any)?.phone ?? [];
      const profile = profileRes.data;

      return {
        userId: user.id,
        email: user.email,
        lastSignInAt: user.last_sign_in_at,
        totpActive: totp.some((f: any) => f.status === "verified"),
        phoneActive: phone.some?.((f: any) => f.status === "verified") ?? false,
        mfaConfiguredAt: profile?.mfa_configured_at ?? null,
        mfaMethod: profile?.mfa_method ?? null,
      };
    },
  });

  const mfaActive = !!data?.mfaConfiguredAt || !!data?.totpActive || !!data?.phoneActive;
  const methodLabel =
    data?.mfaMethod === "totp" || data?.totpActive
      ? "Application TOTP"
      : data?.mfaMethod === "email"
        ? "Courriel"
        : data?.phoneActive
          ? "SMS"
          : data?.mfaMethod ?? "—";

  const handleGlobalSignOut = async () => {
    if (!confirm("Déconnecter tous vos appareils ? Vous devrez vous reconnecter partout.")) return;
    setSigningOut(true);
    try {
      await supabase.auth.signOut({ scope: "global" });
      toast.success("Déconnecté de tous les appareils");
      window.location.href = "/hub";
    } catch (err: any) {
      toast.error(err?.message ?? "Erreur lors de la déconnexion");
    } finally {
      setSigningOut(false);
    }
  };

  const onMfaConfigured = () => {
    setShowMfaModal(false);
    queryClient.invalidateQueries({ queryKey: ["employee-security-status"] });
    toast.success("MFA configuré");
  };

  return (
    <div className="space-y-5 max-w-lg">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Sécurité</h1>
        <p className="text-sm text-[hsl(220,10%,45%)]">Paramètres de sécurité de votre compte</p>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
        </div>
      ) : (
        <div className="space-y-3">
          {/* MFA card */}
          <div className="rounded-xl border border-[hsl(220,15%,13%)] bg-[hsl(220,20%,8%)] p-4">
            <div className="flex items-start gap-3">
              <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${
                mfaActive ? "bg-emerald-500/10" : "bg-amber-500/10"
              }`}>
                {mfaActive
                  ? <Shield className="h-4 w-4 text-emerald-400" />
                  : <AlertTriangle className="h-4 w-4 text-amber-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white">Authentification à deux facteurs</p>
                {mfaActive ? (
                  <p className="text-xs text-emerald-400 mt-0.5">
                    MFA actif — {methodLabel}
                    {data?.mfaConfiguredAt && (
                      <span className="text-[hsl(220,10%,45%)]">
                        {" "}· configuré le {format(new Date(data.mfaConfiguredAt), "d MMM yyyy", { locale: fr })}
                      </span>
                    )}
                  </p>
                ) : (
                  <>
                    <p className="text-xs text-amber-400 mt-0.5">MFA non configuré</p>
                    <Button size="sm" className="mt-3 h-8 text-xs" onClick={() => setShowMfaModal(true)}>
                      Configurer le MFA maintenant
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Last sign-in */}
          <div className="rounded-xl border border-[hsl(220,15%,13%)] bg-[hsl(220,20%,8%)] p-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Key className="h-4 w-4 text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Dernière connexion</p>
                <p className="text-xs text-[hsl(220,10%,45%)]">
                  {data?.lastSignInAt
                    ? format(new Date(data.lastSignInAt), "d MMM yyyy 'à' HH:mm", { locale: fr })
                    : "—"}
                </p>
              </div>
            </div>
          </div>

          {/* Sessions */}
          <div className="rounded-xl border border-[hsl(220,15%,13%)] bg-[hsl(220,20%,8%)] p-4">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Lock className="h-4 w-4 text-purple-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-white">Sessions</p>
                <p className="text-xs text-[hsl(220,10%,45%)]">
                  Déconnectez-vous de tous les appareils si vous suspectez un accès non autorisé.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3 h-8 text-xs"
                  onClick={handleGlobalSignOut}
                  disabled={signingOut}
                >
                  {signingOut ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <LogOut className="h-3.5 w-3.5 mr-1" />}
                  Déconnecter tous les appareils
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showMfaModal && data?.userId && (
        <MFASetupModal userId={data.userId} onConfigured={onMfaConfigured} />
      )}
    </div>
  );
}
