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
  core: { label: "Nivra Core", icon: Terminal, color: "text-emerald-400", accessKey: "can_access_core", href: "/core" },
  employee: { label: "Nivra Employee", icon: Briefcase, color: "text-blue-400", accessKey: "can_access_employee", href: "/employee" },
  field: { label: "Nivra Field", icon: MapPin, color: "text-amber-400", accessKey: "can_access_field", href: "/field" },
  technician: { label: "Nivra Technician", icon: Wrench, color: "text-purple-400", accessKey: "can_access_technician", href: "/staff/technician" },
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
        // Already logged in — verify role + portal access + MFA
        await verifyAndProceed(session.user.id);
      } catch {
        setCheckingSession(false);
      }
    };
    checkExisting();
  }, [portal]);

  const verifyAndProceed = async (userId: string) => {
    if (!portal || !portalId) return;

    // Check role + portal access
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

    // Check MFA — Admin roles MUST enroll and verify TOTP.
    // Non-admin roles use their 4-digit PIN for security; TOTP is optional.
    const isAdminRole = roleData.role === "admin";
    const mfa = await checkMfaStatus();

    if (isAdminRole) {
      // Admin: mandatory TOTP enrollment + verification
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
      // Non-admin: if already enrolled in TOTP, must verify. Otherwise skip (PIN-based security).
      if (mfa.isEnrolled && !mfa.isVerified) {
        setMfaFactorId(mfa.factorId ?? null);
        setStage("mfa_verify");
        setCheckingSession(false);
        setLoading(false);
        return;
      }
    }

    // All clear — create hub session and redirect
    createHubSession(userId);
    await auditAccess("hub_access", portalId);
    await auditAccess("portal_entry", portalId);

    // Log the login
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

  // No portal selected — redirect to hub
  if (!portal) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(220,20%,6%)] px-4">
        <div className="text-center">
          <p className="text-sm text-[hsl(220,10%,50%)] mb-4">Aucun espace sélectionné.</p>
          <Button asChild variant="outline" className="border-[hsl(220,15%,18%)] text-[hsl(220,10%,60%)]">
            <Link to="/hub">Retour au Hub</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Checking existing session
  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(220,20%,6%)]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
          <p className="text-sm text-[hsl(220,10%,45%)]">Vérification de la session…</p>
        </div>
      </div>
    );
  }

  // MFA enrollment
  if (stage === "mfa_enroll") {
    return (
      <MfaEnrollmentDialog
        onComplete={() => {
          window.location.reload();
        }}
        onCancel={handleLogout}
      />
    );
  }

  // MFA verification
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

  // Redirecting
  if (stage === "redirecting") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(220,20%,6%)]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
          <p className="text-sm text-[hsl(220,10%,45%)]">Redirection vers {portal.label}…</p>
        </div>
      </div>
    );
  }

  const PortalIcon = portal.icon;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[hsl(220,20%,6%)] px-4">
      <div className="w-full max-w-sm">
        {/* Back to hub */}
        <div className="mb-6">
          <Link to="/hub" className="inline-flex items-center gap-1.5 text-xs text-[hsl(220,10%,40%)] hover:text-[hsl(220,10%,60%)] transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" />
            Retour à la sélection
          </Link>
        </div>

        {/* Branding */}
        <div className="text-center mb-8">
          <div className="h-12 w-12 mx-auto rounded-xl bg-emerald-600 flex items-center justify-center mb-4">
            <Shield className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">Nivra Internal</h1>
          <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[hsl(220,20%,10%)] border border-[hsl(220,15%,18%)]">
            <PortalIcon className={`h-4 w-4 ${portal.color}`} />
            <span className="text-xs font-medium text-[hsl(220,10%,60%)]">{portal.label}</span>
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
              className="h-11 bg-[hsl(220,20%,10%)] border-[hsl(220,15%,18%)] text-white placeholder:text-[hsl(220,10%,35%)] focus:border-emerald-500/50 focus:ring-emerald-500/20"
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
              className="h-11 bg-[hsl(220,20%,10%)] border-[hsl(220,15%,18%)] text-white placeholder:text-[hsl(220,10%,35%)] focus:border-emerald-500/50 focus:ring-emerald-500/20"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Connexion"
            )}
          </Button>
        </form>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-[10px] text-[hsl(220,10%,25%)] uppercase tracking-widest">
            Réservé au personnel autorisé
          </p>
        </div>
      </div>
    </div>
  );
}
