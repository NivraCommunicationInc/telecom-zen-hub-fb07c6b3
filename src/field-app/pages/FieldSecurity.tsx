/**
 * FieldSecurity — Real MFA status, last sign-in, and global sign-out.
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, Shield, Key, AlertTriangle, LogOut, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import MFASetupModal from "@/components/shared/MFASetupModal";

export default function FieldSecurity() {
  const queryClient = useQueryClient();
  const [showMfaModal, setShowMfaModal] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["field-security-status"],
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
    queryClient.invalidateQueries({ queryKey: ["field-security-status"] });
    toast.success("MFA configuré");
  };

  return (
    <div className="max-w-lg mx-auto space-y-5 field-page-enter">
      <h1 className="text-xl font-bold text-white">Sécurité</h1>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-[hsl(var(--field-text-muted))]">
          <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
        </div>
      ) : (
        <div className="bg-[hsl(var(--field-card))] border border-[hsl(var(--field-border-subtle))] rounded-xl p-5 space-y-4">
          {/* MFA status */}
          <div className="flex items-start gap-3">
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
              mfaActive ? "bg-[hsl(var(--field-success)/0.15)]" : "bg-[hsl(var(--field-warning)/0.15)]"
            }`}>
              {mfaActive
                ? <Shield className="h-5 w-5 text-[hsl(var(--field-success))]" />
                : <AlertTriangle className="h-5 w-5 text-[hsl(var(--field-warning))]" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">Authentification MFA</p>
              {mfaActive ? (
                <p className="text-xs text-[hsl(var(--field-success))] mt-0.5">
                  MFA actif — {methodLabel}
                </p>
              ) : (
                <>
                  <p className="text-xs text-[hsl(var(--field-warning))] mt-0.5">MFA non configuré</p>
                  <button
                    onClick={() => setShowMfaModal(true)}
                    className="mt-2 px-3 py-1.5 rounded-md bg-[hsl(var(--field-accent))] text-white text-xs font-medium hover:opacity-90"
                  >
                    Configurer le MFA maintenant
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Last sign-in */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-[hsl(var(--field-accent)/0.15)] flex items-center justify-center">
              <Key className="h-5 w-5 text-[hsl(var(--field-accent-glow))]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Dernière connexion</p>
              <p className="text-xs text-[hsl(var(--field-text-muted))]">
                {data?.lastSignInAt
                  ? format(new Date(data.lastSignInAt), "d MMM yyyy 'à' HH:mm", { locale: fr })
                  : "—"}
              </p>
            </div>
          </div>

          {/* Sessions */}
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-[hsl(var(--field-warning)/0.15)] flex items-center justify-center">
              <Lock className="h-5 w-5 text-[hsl(var(--field-warning))]" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-white">Sessions actives</p>
              <p className="text-xs text-[hsl(var(--field-text-muted))]">
                Déconnectez tous les appareils si vous suspectez un accès non autorisé.
              </p>
              <button
                onClick={handleGlobalSignOut}
                disabled={signingOut}
                className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[hsl(var(--field-border-subtle))] text-white text-xs font-medium hover:bg-white/5 disabled:opacity-50"
              >
                {signingOut ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
                Déconnecter tous les appareils
              </button>
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
