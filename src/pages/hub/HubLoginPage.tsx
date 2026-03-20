/**
 * HubLoginPage — Login + MFA for a specific portal selected from /hub.
 * URL: /hub/login?portal=core|employee|field|technician
 * Flow: Login → Role/Portal check → MFA → Redirect to portal
 */
import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Shield, Loader2, AlertCircle, ArrowLeft, Terminal, Briefcase, MapPin, Wrench } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { checkMfaStatus } from "@/lib/security/mfaUtils";
import MfaEnrollmentDialog from "@/components/security/MfaEnrollmentDialog";
import MfaVerificationGate from "@/components/security/MfaVerificationGate";
import { createHubSession, clearHubSession } from "@/lib/security/hubSession";
import { auditAccess } from "@/lib/security/internalAuditLogger";

const PORTAL_CONFIG: Record<string, { label: string; icon: typeof Terminal; color: string; accessKey: string; href: string }> = {
  core: { label: "Nivra Core", icon: Terminal, color: "text-green-600", accessKey: "can_access_core", href: "/core" },
  employee: { label: "Nivra Employee", icon: Briefcase, color: "text-blue-600", accessKey: "can_access_employee", href: "/employee" },
  field: { label: "Nivra Field", icon: MapPin, color: "text-amber-600", accessKey: "can_access_field", href: "/field" },
  technician: { label: "Nivra Technician", icon: Wrench, color: "text-purple-600", accessKey: "can_access_technician", href: "/staff/technician" },
};

const INTERNAL_ROLES = [
  "admin", "employee", "technician", "supervisor",
  "sales", "kyc_agent", "billing_admin", "techops", "support", "field_sales"
];

type Stage = "login" | "mfa_enroll" | "mfa_verify" | "redirecting";

export default function HubLoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const portalId = searchParams.get("portal");
  const portal = portalId ? PORTAL_CONFIG[portalId] : null;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("login");
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  // Check if already authenticated on mount
  useEffect(() => {
    if (!portal) {
      setCheckingSession(false);
      return;
    }
    
    const checkExisting = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          setCheckingSession(false);
          return;
        }
        await verifyAndProceed(session.user.id);
      } catch {
        setCheckingSession(false);
      }
    };
    checkExisting();
  }, [portal]);

  const verifyAndProceed = async (userId: string) => {
    if (!portal || !portalId) return;

    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("role, status, is_active, can_access_core, can_access_employee, can_access_field, can_access_technician")
      .eq("user_id", userId)
      .eq("status", "active")
      .in("role", INTERNAL_ROLES)
      .maybeSingle();

    if (roleError || !roleData || !roleData.is_active) {
      await supabase.auth.signOut();
      setError("Accès refusé. Vous n'avez aucun rôle interne actif.");
      setCheckingSession(false);
      setLoading(false);
      return;
    }

    const accessKeyMap: Record<string, keyof typeof roleData> = {
      can_access_core: "can_access_core",
      can_access_employee: "can_access_employee",
      can_access_field: "can_access_field",
      can_access_technician: "can_access_technician",
    };
    const hasPortalAccess = roleData[accessKeyMap[portal.accessKey] as keyof typeof roleData];
    if (!hasPortalAccess) {
      await supabase.auth.signOut();
      setError(`Accès refusé à ${portal.label}. Contactez votre administrateur.`);
      setCheckingSession(false);
      setLoading(false);
      return;
    }

    const isAdminRole = roleData.role === "admin";
    const mfa = await checkMfaStatus();

    if (isAdminRole) {
      if (!mfa.isEnrolled) {
        setStage("mfa_enroll");
        setCheckingSession(false);
        setLoading(false);
        return;
      }
      if (!mfa.isVerified) {
        setMfaFactorId(mfa.factorId ?? null);
        setStage("mfa_verify");
        setCheckingSession(false);
        setLoading(false);
        return;
      }
    } else {
      if (mfa.isEnrolled && !mfa.isVerified) {
        setMfaFactorId(mfa.factorId ?? null);
        setStage("mfa_verify");
        setCheckingSession(false);
        setLoading(false);
        return;
      }
    }

    createHubSession(userId);
    await auditAccess("hub_access", portalId);
    await auditAccess("portal_entry", portalId);

    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.email) {
      await supabase.from("hub_login_audit").insert({
        user_id: userId,
        email: session.user.email,
        event: "login_success",
        portal_accessed: portalId,
      });
    }

    setStage("redirecting");
    navigate(portal.href, { replace: true });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!portal) return;
    setError(null);
    setLoading(true);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError || !data.session) {
        setError("Identifiants invalides.");
        setLoading(false);
        return;
      }

      await verifyAndProceed(data.session.user.id);
    } catch (err) {
      console.error("[HubLogin] Error:", err);
      setError("Erreur de connexion. Veuillez réessayer.");
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    clearHubSession();
    await supabase.auth.signOut();
    navigate("/hub", { replace: true });
  };

  if (!portal) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-4">
        <div className="text-center">
          <p className="text-sm text-[#374151] mb-4">Aucun espace sélectionné.</p>
          <Button asChild variant="outline" className="border-[#E5E7EB] text-[#374151] hover:text-black">
            <Link to="/hub">Retour au Hub</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-green-500" />
          <p className="text-sm text-[#374151]">Vérification de la session…</p>
        </div>
      </div>
    );
  }

  if (stage === "mfa_enroll") {
    return (
      <MfaEnrollmentDialog
        onComplete={() => { window.location.reload(); }}
        onCancel={handleLogout}
      />
    );
  }

  if (stage === "mfa_verify" && mfaFactorId) {
    return (
      <MfaVerificationGate
        factorId={mfaFactorId}
        onVerified={async () => {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            createHubSession(session.user.id);
            await auditAccess("hub_access", portalId!);
            await auditAccess("portal_entry", portalId!);
            navigate(portal.href, { replace: true });
          }
        }}
        onLogout={handleLogout}
      />
    );
  }

  if (stage === "redirecting") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-green-500" />
          <p className="text-sm text-[#374151]">Redirection vers {portal.label}…</p>
        </div>
      </div>
    );
  }

  const PortalIcon = portal.icon;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        {/* Back to hub */}
        <div className="mb-6">
          <Link to="/hub" className="inline-flex items-center gap-1.5 text-xs text-[#6B7280] hover:text-black transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" />
            Retour à la sélection
          </Link>
        </div>

        {/* Card */}
        <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm p-8">
          {/* Branding */}
          <div className="text-center mb-8">
            <div className="h-12 w-12 mx-auto rounded-xl bg-green-500 flex items-center justify-center mb-4">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-xl font-bold text-black tracking-tight">Nivra Internal</h1>
            <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-50 border border-[#E5E7EB]">
              <PortalIcon className={`h-4 w-4 ${portal.color}`} />
              <span className="text-xs font-medium text-[#374151]">{portal.label}</span>
            </div>
          </div>

          {/* Login form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Input
                type="email"
                placeholder="Courriel professionnel"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="h-11 bg-white border-[#E5E7EB] text-black placeholder:text-[#9CA3AF] focus:border-green-500 focus:ring-green-500/20"
              />
            </div>
            <div>
              <Input
                type="password"
                placeholder="Mot de passe"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="h-11 bg-white border-[#E5E7EB] text-black placeholder:text-[#9CA3AF] focus:border-green-500 focus:ring-green-500/20"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
                <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                <p className="text-xs text-red-600">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-green-500 hover:bg-green-600 text-white font-medium"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Connexion"
              )}
            </Button>
          </form>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-[10px] text-[#9CA3AF] uppercase tracking-widest">
            Réservé au personnel autorisé
          </p>
        </div>
      </div>
    </div>
  );
}
